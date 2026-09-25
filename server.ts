import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

function extractCleanErrorMessage(error: any): string {
  if (!error) return "Failed to communicate with Gemini API.";
  let msg = typeof error === "string" ? error : error?.message || "";
  try {
    let parsed = JSON.parse(msg);
    if (parsed.error && typeof parsed.error === "object") {
      if (parsed.error.message) {
        try {
          const nested = JSON.parse(parsed.error.message);
          if (nested.error?.message) return nested.error.message;
        } catch {
          return parsed.error.message;
        }
      }
    }
    if (parsed.message) return parsed.message;
  } catch {
    // string is not JSON, use directly
  }
  return msg || "An unexpected error occurred while communicating with Gemini.";
}

function isRetryableGeminiError(error: any): boolean {
  if (!error) return false;
  const msg = typeof error === 'string' ? error : error?.message || JSON.stringify(error);
  return (
    error?.status === 429 ||
    error?.code === 429 ||
    error?.status === 503 ||
    error?.code === 503 ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('quota') ||
    msg.includes('Quota exceeded') ||
    msg.includes('rate-limits')
  );
}

async function executeGeminiWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  initialDelayMs = 2000
): Promise<T> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (err: any) {
      if (isRetryableGeminiError(err) && attempt < maxRetries) {
        attempt++;
        const waitTime = initialDelayMs * Math.pow(2, attempt - 1);
        console.warn(`[Gemini Retryable Error 429/503] Retrying in ${waitTime}ms (attempt ${attempt}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Maximum retry attempts reached.");
}

function getGeminiModelForSdk(requestedModel?: string): string {
  if (!requestedModel || !requestedModel.trim()) return "gemini-3.8-flash";
  return requestedModel.trim();
}

const PORT = 3000;

async function startServer() {
  const app = express();

  app.use(express.json({ limit: "15mb" }));

  // Health and config status endpoint
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      hasEnvKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()),
      hasGroqEnvKey: Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()),
    });
  });

  function getGitHubHeaders(token?: string) {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Gemini-GitHub-Studio-App",
    };
    if (token && token.trim()) {
      headers["Authorization"] = `Bearer ${token.trim()}`;
    }
    return headers;
  }

  // GitHub Authenticated User profile endpoint
  app.get("/api/github/user", async (req, res) => {
    try {
      const token = ((req.headers["x-github-token"] as string) || (req.query.token as string))?.trim();
      if (!token) {
        return res.status(401).json({ error: "GitHub Personal Access Token required hai." });
      }

      const ghRes = await fetch("https://api.github.com/user", {
        headers: getGitHubHeaders(token),
      });

      if (!ghRes.ok) {
        const errJson = await ghRes.json().catch(() => ({}));
        return res.status(ghRes.status).json({
          error: errJson.message || `GitHub authentication error: ${ghRes.statusText}`,
        });
      }

      const userData = await ghRes.json();
      res.json({
        login: userData.login,
        name: userData.name || userData.login,
        avatar_url: userData.avatar_url,
        html_url: userData.html_url,
        public_repos: userData.public_repos,
        total_private_repos: userData.total_private_repos,
        owned_private_repos: userData.owned_private_repos,
        bio: userData.bio,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch user profile." });
    }
  });

  // GitHub Direct Commit & Push endpoint
  app.post("/api/github/commit-file", async (req, res) => {
    try {
      const { owner, repo, path: filePath, content, message, branch, sha } = req.body;
      const token = ((req.headers["x-github-token"] as string) || (req.body.token as string))?.trim();

      if (!token) {
        return res.status(401).json({ error: "GitHub Personal Access Token is required to commit and push changes." });
      }

      if (!owner || !repo || !filePath) {
        return res.status(400).json({ error: "Owner, repo, and file path are required." });
      }

      const commitMessage = (message || `Update ${filePath}`).trim();
      const targetBranch = (branch || "main").trim();

      // If SHA not provided, attempt to fetch current file SHA from GitHub
      let fileSha = sha;
      if (!fileSha) {
        try {
          const checkRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}?ref=${encodeURIComponent(targetBranch)}`,
            { headers: getGitHubHeaders(token) }
          );
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.sha) {
              fileSha = checkData.sha;
            }
          }
        } catch {
          // New file creation or branch default
        }
      }

      const putBody: any = {
        message: commitMessage,
        content: Buffer.from(content || "", "utf-8").toString("base64"),
        branch: targetBranch,
      };

      if (fileSha) {
        putBody.sha = fileSha;
      }

      const putRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}`,
        {
          method: "PUT",
          headers: getGitHubHeaders(token),
          body: JSON.stringify(putBody),
        }
      );

      if (!putRes.ok) {
        const errJson = await putRes.json().catch(() => ({}));
        return res.status(putRes.status).json({
          error: errJson.message || `Failed to commit to GitHub: ${putRes.statusText}`,
        });
      }

      const result = await putRes.json();
      res.json({
        success: true,
        commit: result.commit,
        content: result.content,
        message: `Successfully pushed commit to ${owner}/${repo} (${targetBranch})`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to commit and push file to GitHub." });
    }
  });

  // GitHub Repos list endpoint (Supports pagination & "all" repos load)
  app.get("/api/github/repos", async (req, res) => {
    try {
      const username = (req.query.username as string)?.trim();
      const token = ((req.headers["x-github-token"] as string) || (req.query.token as string))?.trim();
      const limitParam = (req.query.limit as string)?.trim().toLowerCase() || "100";
      const loadAll = limitParam === "all" || req.query.all === "true";

      if (!username && !token) {
        return res.status(400).json({ error: "Username ya GitHub Token required hai." });
      }

      let allRepos: any[] = [];
      let page = 1;
      const maxPages = loadAll ? 30 : Math.min(Math.ceil(parseInt(limitParam, 10) / 100) || 1, 30);

      while (page <= maxPages) {
        let url = "";
        if (username) {
          url = `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&page=${page}&sort=updated`;
        } else {
          url = `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator`;
        }

        const ghRes = await fetch(url, { headers: getGitHubHeaders(token) });
        if (!ghRes.ok) {
          // If first page failed, return error
          if (page === 1) {
            const errJson = await ghRes.json().catch(() => ({}));
            return res.status(ghRes.status).json({
              error: errJson.message || `GitHub API error: ${ghRes.statusText}`,
            });
          }
          break; // end of pages or rate limit
        }

        const pageRepos = await ghRes.json();
        if (!Array.isArray(pageRepos) || pageRepos.length === 0) {
          break;
        }

        allRepos.push(...pageRepos);

        // If returned items is less than 100, no more pages exist
        if (pageRepos.length < 100) {
          break;
        }

        page++;
      }

      res.json({ repos: allRepos, total: allRepos.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch repositories." });
    }
  });

  // GitHub Recursive Repo Tree endpoint with .gitignore awareness
  app.get("/api/github/tree", async (req, res) => {
    try {
      const owner = (req.query.owner as string)?.trim();
      const repo = (req.query.repo as string)?.trim();
      let branch = (req.query.branch as string)?.trim();
      const token = ((req.headers["x-github-token"] as string) || (req.query.token as string))?.trim();

      if (!owner || !repo) {
        return res.status(400).json({ error: "Owner and repo are required." });
      }

      // If branch not supplied, get default branch
      if (!branch) {
        const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: getGitHubHeaders(token),
        });
        if (repoRes.ok) {
          const repoData = await repoRes.json();
          branch = repoData.default_branch || "main";
        } else {
          branch = "main";
        }
      }

      // Fetch recursive tree
      const treeRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
        { headers: getGitHubHeaders(token) }
      );

      if (!treeRes.ok) {
        const errJson = await treeRes.json().catch(() => ({}));
        return res.status(treeRes.status).json({
          error: errJson.message || `Failed to fetch tree: ${treeRes.statusText}`,
        });
      }

      const treeData = await treeRes.json();
      const items = treeData.tree || [];

      // Check for .gitignore
      let gitignorePatterns: string[] = ["node_modules", "dist", ".git", ".next", "build", ".cache", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"];
      let gitignoreRaw = "";
      const gitignoreItem = items.find((i: any) => i.path === ".gitignore");

      if (gitignoreItem) {
        const rawRes = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/.gitignore`,
          { headers: getGitHubHeaders(token) }
        );
        if (rawRes.ok) {
          gitignoreRaw = await rawRes.text();
          const parsed = gitignoreRaw
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith("#"));
          gitignorePatterns = Array.from(new Set([...gitignorePatterns, ...parsed]));
        }
      }

      res.json({
        branch,
        truncated: Boolean(treeData.truncated),
        items,
        gitignorePatterns,
        gitignoreRaw,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch repository tree." });
    }
  });

  // GitHub File Content endpoint
  app.get("/api/github/file", async (req, res) => {
    try {
      const owner = (req.query.owner as string)?.trim();
      const repo = (req.query.repo as string)?.trim();
      const filePath = (req.query.path as string)?.trim();
      const ref = (req.query.ref as string)?.trim() || "main";
      const token = ((req.headers["x-github-token"] as string) || (req.query.token as string))?.trim();

      if (!owner || !repo || !filePath) {
        return res.status(400).json({ error: "Owner, repo and path are required." });
      }

      const fileRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}?ref=${encodeURIComponent(ref)}`,
        { headers: getGitHubHeaders(token) }
      );

      if (!fileRes.ok) {
        const errJson = await fileRes.json().catch(() => ({}));
        return res.status(fileRes.status).json({
          error: errJson.message || `Failed to fetch file: ${fileRes.statusText}`,
        });
      }

      const fileData = await fileRes.json();
      let content = "";
      if (fileData.encoding === "base64" && fileData.content) {
        content = Buffer.from(fileData.content, "base64").toString("utf-8");
      } else if (typeof fileData.content === "string") {
        content = fileData.content;
      }

      res.json({
        name: fileData.name,
        path: fileData.path,
        sha: fileData.sha,
        size: fileData.size,
        content,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load file content." });
    }
  });

  // GitHub Commits list endpoint
  app.get("/api/github/commits", async (req, res) => {
    try {
      const owner = (req.query.owner as string)?.trim();
      const repo = (req.query.repo as string)?.trim();
      const branch = (req.query.branch as string)?.trim();
      const perPage = parseInt((req.query.per_page as string) || "30", 10);
      const token = ((req.headers["x-github-token"] as string) || (req.query.token as string))?.trim();

      if (!owner || !repo) {
        return res.status(400).json({ error: "Owner and repo are required." });
      }

      let url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${perPage}`;
      if (branch) {
        url += `&sha=${encodeURIComponent(branch)}`;
      }

      const ghRes = await fetch(url, { headers: getGitHubHeaders(token) });
      if (!ghRes.ok) {
        const errJson = await ghRes.json().catch(() => ({}));
        return res.status(ghRes.status).json({
          error: errJson.message || `GitHub API error: ${ghRes.statusText}`,
        });
      }

      const commits = await ghRes.json();
      res.json({ commits: Array.isArray(commits) ? commits : [] });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch commits." });
    }
  });

  // GitHub Commit Detail & Diff endpoint
  app.get("/api/github/commit-detail", async (req, res) => {
    try {
      const owner = (req.query.owner as string)?.trim();
      const repo = (req.query.repo as string)?.trim();
      const ref = (req.query.ref as string)?.trim();
      const token = ((req.headers["x-github-token"] as string) || (req.query.token as string))?.trim();

      if (!owner || !repo || !ref) {
        return res.status(400).json({ error: "Owner, repo and commit ref are required." });
      }

      const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`, {
        headers: getGitHubHeaders(token),
      });

      if (!ghRes.ok) {
        const errJson = await ghRes.json().catch(() => ({}));
        return res.status(ghRes.status).json({
          error: errJson.message || `Failed to fetch commit: ${ghRes.statusText}`,
        });
      }

      const data = await ghRes.json();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch commit diff." });
    }
  });

  // GitHub Pull Requests endpoint
  app.get("/api/github/pulls", async (req, res) => {
    try {
      const owner = (req.query.owner as string)?.trim();
      const repo = (req.query.repo as string)?.trim();
      const state = (req.query.state as string)?.trim() || "all";
      const token = ((req.headers["x-github-token"] as string) || (req.query.token as string))?.trim();

      if (!owner || !repo) {
        return res.status(400).json({ error: "Owner and repo are required." });
      }

      const ghRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls?state=${encodeURIComponent(state)}&per_page=30&sort=updated`,
        { headers: getGitHubHeaders(token) }
      );

      if (!ghRes.ok) {
        const errJson = await ghRes.json().catch(() => ({}));
        return res.status(ghRes.status).json({
          error: errJson.message || `Failed to fetch pull requests: ${ghRes.statusText}`,
        });
      }

      const pulls = await ghRes.json();
      res.json({ pulls: Array.isArray(pulls) ? pulls : [] });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch pull requests." });
    }
  });

  // GitHub Issues endpoint
  app.get("/api/github/issues", async (req, res) => {
    try {
      const owner = (req.query.owner as string)?.trim();
      const repo = (req.query.repo as string)?.trim();
      const state = (req.query.state as string)?.trim() || "all";
      const token = ((req.headers["x-github-token"] as string) || (req.query.token as string))?.trim();

      if (!owner || !repo) {
        return res.status(400).json({ error: "Owner and repo are required." });
      }

      const ghRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues?state=${encodeURIComponent(state)}&per_page=30&sort=updated`,
        { headers: getGitHubHeaders(token) }
      );

      if (!ghRes.ok) {
        const errJson = await ghRes.json().catch(() => ({}));
        return res.status(ghRes.status).json({
          error: errJson.message || `Failed to fetch issues: ${ghRes.statusText}`,
        });
      }

      const issues = await ghRes.json();
      // Filter out pull requests which GitHub returns in issues endpoint
      const pureIssues = Array.isArray(issues) ? issues.filter((i: any) => !i.pull_request) : [];
      res.json({ issues: pureIssues });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch issues." });
    }
  });

  // Helper to detect deployment provider from URL and environment name
  function detectProviderFromUrl(url: string, envName = ""): string {
    const lowerUrl = url.toLowerCase();
    const lowerEnv = envName.toLowerCase();

    if (lowerUrl.includes("onrender.com") || lowerEnv.includes("render")) return "Render";
    if (lowerUrl.includes("netlify.app") || lowerEnv.includes("netlify")) return "Netlify";
    if (lowerUrl.includes("vercel.app") || lowerEnv.includes("vercel")) return "Vercel";
    if (lowerUrl.includes("github.io") || lowerEnv.includes("github-pages") || lowerEnv.includes("github pages")) return "GitHub Pages";
    if (lowerUrl.includes("pages.dev") || lowerUrl.includes("workers.dev") || lowerEnv.includes("cloudflare")) return "Cloudflare";
    if (lowerUrl.includes("railway.app") || lowerEnv.includes("railway")) return "Railway";
    if (lowerUrl.includes("herokuapp.com") || lowerEnv.includes("heroku")) return "Heroku";
    if (lowerUrl.includes("fly.dev") || lowerEnv.includes("fly")) return "Fly.io";
    if (lowerUrl.includes("web.app") || lowerUrl.includes("firebaseapp.com") || lowerEnv.includes("firebase")) return "Firebase";
    if (lowerUrl.includes("surge.sh") || lowerEnv.includes("surge")) return "Surge";
    if (lowerUrl.includes("amplifyapp.com") || lowerEnv.includes("amplify")) return "AWS Amplify";
    if (lowerUrl.includes("supabase.co") || lowerEnv.includes("supabase")) return "Supabase";
    return "Web Application";
  }

  // In-memory cache for live deployments discovery (3-minute TTL for instant responses)
  const deploymentsCache = new Map<string, { timestamp: number; data: any }>();

  // Ultra-Fast High-Speed Streaming Proxy for Live Sites (Bypasses restrictive X-Frame-Options/CSP for zero-delay iframe embedding)
  app.get("/api/proxy-site", async (req, res) => {
    try {
      const targetUrl = (req.query.url as string)?.trim();
      if (!targetUrl || (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://"))) {
        return res.status(400).send("Valid target URL is required");
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const fetchRes = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      clearTimeout(timeout);

      const contentType = fetchRes.headers.get("content-type") || "text/html";

      // Strip frame restrictions so it embeds smoothly without delay
      res.removeHeader("X-Frame-Options");
      res.removeHeader("Content-Security-Policy");
      res.removeHeader("Content-Security-Policy-Report-Only");
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=180");

      if (contentType.includes("text/html")) {
        let html = await fetchRes.text();
        const baseTag = `<base href="${targetUrl}">`;
        if (html.includes("<head>")) {
          html = html.replace("<head>", `<head>${baseTag}`);
        } else if (html.includes("<HEAD>")) {
          html = html.replace("<HEAD>", `<HEAD>${baseTag}`);
        } else {
          html = `${baseTag}${html}`;
        }
        return res.send(html);
      } else {
        const arrayBuffer = await fetchRes.arrayBuffer();
        return res.send(Buffer.from(arrayBuffer));
      }
    } catch (err: any) {
      res.status(502).send(`Unable to proxy site: ${err.message || 'Timeout or network issue'}`);
    }
  });

  // GitHub Deployments and Live Production URL discovery endpoint (Ultra-Fast Parallel Discovery with in-memory caching)
  app.get("/api/github/deployments", async (req, res) => {
    try {
      const owner = (req.query.owner as string)?.trim();
      const repo = (req.query.repo as string)?.trim();
      const token = ((req.headers["x-github-token"] as string) || (req.query.token as string))?.trim();

      if (!owner || !repo) {
        return res.status(400).json({ error: "Owner and repo are required." });
      }

      // Check cache first for instant sub-millisecond response
      const cacheKey = `${owner.toLowerCase()}/${repo.toLowerCase()}`;
      const cached = deploymentsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 180000) {
        return res.json(cached.data);
      }

      const liveUrls: Array<{
        id: string;
        repoFullName: string;
        repoName: string;
        environment: string;
        url: string;
        creator: string;
        createdAt: string;
        provider: string;
      }> = [];

      const seenUrls = new Set<string>();

      const addLiveUrl = (item: {
        id: string;
        environment: string;
        url: string;
        creator?: string;
        createdAt?: string;
        provider?: string;
      }) => {
        let cleanUrl = item.url.trim();
        cleanUrl = cleanUrl.replace(/[.,;)>\]]+$/, "");
        if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) return;
        const normalized = cleanUrl.toLowerCase().replace(/\/+$/, "");
        if (seenUrls.has(normalized)) return;
        seenUrls.add(normalized);

        liveUrls.push({
          id: item.id,
          repoFullName: `${owner}/${repo}`,
          repoName: repo,
          environment: item.environment || "Production",
          url: cleanUrl,
          creator: item.creator || "CI/CD Deployment",
          createdAt: item.createdAt || new Date().toISOString(),
          provider: item.provider || detectProviderFromUrl(cleanUrl, item.environment),
        });
      };

      // Execute all 5 discovery checks simultaneously in parallel with fast timeouts
      await Promise.allSettled([
        // 1. Check official GitHub Deployments API & Statuses
        (async () => {
          try {
            const deploymentsUrl = `https://api.github.com/repos/${owner}/${repo}/deployments?per_page=15`;
            const ghRes = await fetch(deploymentsUrl, {
              headers: getGitHubHeaders(token),
              signal: AbortSignal.timeout(3000),
            });
            if (ghRes.ok) {
              const deployments = await ghRes.json();
              if (Array.isArray(deployments)) {
                await Promise.allSettled(
                  deployments.slice(0, 8).map(async (dep: any) => {
                    try {
                      const statusUrl =
                        dep.statuses_url ||
                        `https://api.github.com/repos/${owner}/${repo}/deployments/${dep.id}/statuses`;
                      const statusRes = await fetch(statusUrl, {
                        headers: getGitHubHeaders(token),
                        signal: AbortSignal.timeout(2000),
                      });
                      if (statusRes.ok) {
                        const statuses = await statusRes.json();
                        if (Array.isArray(statuses) && statuses.length > 0) {
                          const latestSuccess =
                            statuses.find(
                              (s: any) => s.state === 'success' && (s.environment_url || s.target_url)
                            ) || statuses[0];

                          const targetUrl = latestSuccess?.environment_url || latestSuccess?.target_url;
                          if (targetUrl) {
                            addLiveUrl({
                              id: `gh-dep-${dep.id}`,
                              environment: dep.environment || 'Production',
                              url: targetUrl,
                              creator: dep.creator?.login || 'CI/CD Bot',
                              createdAt: dep.created_at,
                            });
                          }
                        }
                      }
                    } catch {
                      // ignore individual status timeout
                    }
                  })
                );
              }
            }
          } catch {
            // ignore
          }
        })(),

        // 2. Check GitHub Pages API
        (async () => {
          try {
            const pagesRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, {
              headers: getGitHubHeaders(token),
              signal: AbortSignal.timeout(2500),
            });
            if (pagesRes.ok) {
              const pagesData = await pagesRes.json();
              if (pagesData && pagesData.html_url) {
                addLiveUrl({
                  id: `gh-pages-${owner}-${repo}`,
                  environment: 'GitHub Pages',
                  url: pagesData.html_url,
                  provider: 'GitHub Pages',
                  createdAt: pagesData.updated_at,
                });
              }
            }
          } catch {
            // ignore
          }
        })(),

        // 3. Check Repository Metadata Homepage
        (async () => {
          try {
            const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
              headers: getGitHubHeaders(token),
              signal: AbortSignal.timeout(2500),
            });
            if (repoRes.ok) {
              const repoData = await repoRes.json();
              if (
                repoData &&
                repoData.homepage &&
                (repoData.homepage.startsWith('http://') || repoData.homepage.startsWith('https://'))
              ) {
                addLiveUrl({
                  id: `repo-homepage-${owner}-${repo}`,
                  environment: 'Homepage / Live Site',
                  url: repoData.homepage,
                  createdAt: repoData.updated_at,
                });
              }
            }
          } catch {
            // ignore
          }
        })(),

        // 4. Check README.md for live demo links across Render, Netlify, Vercel, etc.
        (async () => {
          try {
            const readmeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
              headers: getGitHubHeaders(token),
              signal: AbortSignal.timeout(2500),
            });
            if (readmeRes.ok) {
              const readmeData = await readmeRes.json();
              if (readmeData && readmeData.content) {
                const readmeText = Buffer.from(readmeData.content, 'base64').toString('utf-8');

                const platformRegexes = [
                  { regex: /https:\/\/[a-zA-Z0-9_.-]+\.onrender\.com[^\s\)"'<>"]*/gi, provider: 'Render' },
                  { regex: /https:\/\/[a-zA-Z0-9_.-]+\.netlify\.app[^\s\)"'<>"]*/gi, provider: 'Netlify' },
                  { regex: /https:\/\/[a-zA-Z0-9_.-]+\.vercel\.app[^\s\)"'<>"]*/gi, provider: 'Vercel' },
                  { regex: /https:\/\/[a-zA-Z0-9_.-]+\.pages\.dev[^\s\)"'<>"]*/gi, provider: 'Cloudflare' },
                  { regex: /https:\/\/[a-zA-Z0-9_.-]+\.(?:up\.)?railway\.app[^\s\)"'<>"]*/gi, provider: 'Railway' },
                  { regex: /https:\/\/[a-zA-Z0-9_.-]+\.herokuapp\.com[^\s\)"'<>"]*/gi, provider: 'Heroku' },
                  { regex: /https:\/\/[a-zA-Z0-9_.-]+\.fly\.dev[^\s\)"'<>"]*/gi, provider: 'Fly.io' },
                  { regex: /https:\/\/[a-zA-Z0-9_.-]+\.(?:web\.app|firebaseapp\.com)[^\s\)"'<>"]*/gi, provider: 'Firebase' },
                  { regex: /https:\/\/[a-zA-Z0-9_.-]+\.surge\.sh[^\s\)"'<>"]*/gi, provider: 'Surge' },
                  { regex: /https:\/\/[a-zA-Z0-9_.-]+\.amplifyapp\.com[^\s\)"'<>"]*/gi, provider: 'AWS Amplify' },
                  { regex: /https:\/\/[a-zA-Z0-9_.-]+\.github\.io\/[^\s\)"'<>"]*/gi, provider: 'GitHub Pages' },
                ];

                platformRegexes.forEach(({ regex, provider }) => {
                  const matches = readmeText.match(regex);
                  if (matches) {
                    matches.slice(0, 3).forEach((matchedUrl, idx) => {
                      addLiveUrl({
                        id: `readme-${provider.toLowerCase().replace(/\s+/g, '-')}-${idx}`,
                        environment: `${provider} Live Site`,
                        url: matchedUrl,
                        provider,
                      });
                    });
                  }
                });

                const demoLinkRegex =
                  /\[(?:Live Demo|Demo|Live Site|Website|App|Live Preview|Deployed Application|Preview)\]\((https?:\/\/[^\s\)]+)\)/gi;
                let demoMatch;
                let demoIdx = 0;
                while ((demoMatch = demoLinkRegex.exec(readmeText)) !== null && demoIdx < 4) {
                  const url = demoMatch[1];
                  if (url && !url.includes('github.com') && !url.includes('badge')) {
                    addLiveUrl({
                      id: `readme-demo-link-${demoIdx}`,
                      environment: 'README Demo Link',
                      url,
                      provider: detectProviderFromUrl(url, 'Demo Link'),
                    });
                    demoIdx++;
                  }
                }
              }
            }
          } catch {
            // ignore
          }
        })(),

        // 5. Check package.json for "homepage"
        (async () => {
          try {
            const pkgRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/package.json`, {
              headers: getGitHubHeaders(token),
              signal: AbortSignal.timeout(2000),
            });
            if (pkgRes.ok) {
              const pkgData = await pkgRes.json();
              if (pkgData && pkgData.content) {
                const pkgJson = JSON.parse(Buffer.from(pkgData.content, 'base64').toString('utf-8'));
                if (
                  pkgJson.homepage &&
                  (pkgJson.homepage.startsWith('http://') || pkgJson.homepage.startsWith('https://'))
                ) {
                  addLiveUrl({
                    id: `pkg-homepage-${owner}-${repo}`,
                    environment: 'package.json homepage',
                    url: pkgJson.homepage,
                    provider: detectProviderFromUrl(pkgJson.homepage, 'package.json'),
                  });
                }
              }
            }
          } catch {
            // ignore
          }
        })(),
      ]);

      const result = { deployments: liveUrls, total: liveUrls.length };
      deploymentsCache.set(cacheKey, { timestamp: Date.now(), data: result });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch deployments." });
    }
  });

  // In-memory cache for user-wide live deployments (3-minute TTL)
  const userDeploymentsCache = new Map<string, { timestamp: number; data: any }>();

  // Comprehensive User-Wide Live Sites & Deployments Scanner
  // Scans all repos of a user for active live sites (GitHub Pages, Vercel, Netlify, Render, Cloudflare, etc.)
  app.post("/api/github/scan-user-deployments", async (req, res) => {
    try {
      const username = (req.body.username as string)?.trim();
      const inputRepos = req.body.repos as any[] | undefined;
      const token = ((req.headers["x-github-token"] as string) || (req.body.token as string))?.trim();

      if (!username && (!inputRepos || inputRepos.length === 0)) {
        return res.status(400).json({ error: "Username or repos list is required." });
      }

      const cacheKey = (username || "token-user").toLowerCase();
      const cached = userDeploymentsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 180000 && (!inputRepos || inputRepos.length === 0)) {
        return res.json(cached.data);
      }

      let reposList: any[] = [];
      if (Array.isArray(inputRepos) && inputRepos.length > 0) {
        reposList = inputRepos;
      } else if (username) {
        const ghRes = await fetch(
          `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`,
          { headers: getGitHubHeaders(token) }
        );
        if (ghRes.ok) {
          reposList = await ghRes.json();
        }
      }

      const allLiveUrls: Array<{
        id: string;
        repoFullName: string;
        repoName: string;
        environment: string;
        url: string;
        creator: string;
        createdAt: string;
        provider: string;
        isLive?: boolean;
      }> = [];
      const seenUrls = new Set<string>();

      const addLiveUrl = (item: {
        id: string;
        repoFullName: string;
        repoName: string;
        environment: string;
        url: string;
        creator?: string;
        createdAt?: string;
        provider?: string;
      }) => {
        let cleanUrl = item.url.trim();
        cleanUrl = cleanUrl.replace(/[.,;)>\]]+$/, "");
        if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) return;
        if (cleanUrl.includes("github.com") && !cleanUrl.includes(".github.io")) return;
        if (cleanUrl.includes("shields.io") || cleanUrl.includes("badge") || cleanUrl.includes("npmjs.com")) return;

        const normalized = cleanUrl.toLowerCase().replace(/\/+$/, "");
        if (seenUrls.has(normalized)) return;
        seenUrls.add(normalized);

        allLiveUrls.push({
          id: item.id,
          repoFullName: item.repoFullName,
          repoName: item.repoName,
          environment: item.environment || "Production",
          url: cleanUrl,
          creator: item.creator || "Deployment",
          createdAt: item.createdAt || new Date().toISOString(),
          provider: item.provider || detectProviderFromUrl(cleanUrl, item.environment),
          isLive: true,
        });
      };

      // 1. Instant check: inspect repo metadata from reposList (homepage and has_pages)
      for (const repo of reposList) {
        const ownerLogin = repo.owner?.login || username || "";
        const repoName = repo.name;
        const repoFullName = repo.full_name || `${ownerLogin}/${repoName}`;

        // Check if repo has explicit homepage
        if (repo.homepage && (repo.homepage.startsWith("http://") || repo.homepage.startsWith("https://"))) {
          addLiveUrl({
            id: `homepage-${repo.id || repoName}`,
            repoFullName,
            repoName,
            environment: "Homepage / Production",
            url: repo.homepage,
            provider: detectProviderFromUrl(repo.homepage, "homepage"),
            createdAt: repo.updated_at,
          });
        }

        // Check if repo has GitHub Pages enabled
        if (repo.has_pages) {
          const isUserPages = repoName.toLowerCase() === `${ownerLogin.toLowerCase()}.github.io`;
          const ghPagesUrl = isUserPages
            ? `https://${ownerLogin.toLowerCase()}.github.io/`
            : `https://${ownerLogin.toLowerCase()}.github.io/${repoName}/`;

          addLiveUrl({
            id: `pages-${repo.id || repoName}`,
            repoFullName,
            repoName,
            environment: "GitHub Pages",
            url: ghPagesUrl,
            provider: "GitHub Pages",
            createdAt: repo.updated_at,
          });
        }
      }

      // 2. High-speed batch inspection for candidate active repos (up to 30 repos sorted by updated_at)
      const candidateRepos = reposList.slice(0, 30);

      const batchPromises = candidateRepos.map(async (repo) => {
        const ownerLogin = repo.owner?.login || username || "";
        const repoName = repo.name;
        const repoFullName = repo.full_name || `${ownerLogin}/${repoName}`;
        const defaultBranch = repo.default_branch || "main";

        // 2a. Check GitHub Deployments API
        const depPromise = (async () => {
          try {
            const depRes = await fetch(
              `https://api.github.com/repos/${ownerLogin}/${repoName}/deployments?per_page=5`,
              {
                headers: getGitHubHeaders(token),
                signal: AbortSignal.timeout(2500),
              }
            );
            if (depRes.ok) {
              const deps = await depRes.json();
              if (Array.isArray(deps) && deps.length > 0) {
                for (const dep of deps.slice(0, 3)) {
                  try {
                    const statusUrl = dep.statuses_url || `https://api.github.com/repos/${ownerLogin}/${repoName}/deployments/${dep.id}/statuses`;
                    const statusRes = await fetch(statusUrl, {
                      headers: getGitHubHeaders(token),
                      signal: AbortSignal.timeout(1800),
                    });
                    if (statusRes.ok) {
                      const statuses = await statusRes.json();
                      if (Array.isArray(statuses) && statuses.length > 0) {
                        const target = statuses.find((s: any) => s.state === "success" && (s.environment_url || s.target_url)) || statuses[0];
                        const liveUrl = target?.environment_url || target?.target_url;
                        if (liveUrl) {
                          addLiveUrl({
                            id: `dep-${dep.id}`,
                            repoFullName,
                            repoName,
                            environment: dep.environment || "Production",
                            url: liveUrl,
                            creator: dep.creator?.login || "CI/CD Bot",
                            createdAt: dep.created_at,
                          });
                        }
                      }
                    }
                  } catch {
                    // skip individual status timeout
                  }
                }
              }
            }
          } catch {
            // ignore
          }
        })();

        // 2b. Check raw README.md from raw.githubusercontent.com
        const readmePromise = (async () => {
          try {
            const rawReadmeRes = await fetch(
              `https://raw.githubusercontent.com/${ownerLogin}/${repoName}/${defaultBranch}/README.md`,
              { signal: AbortSignal.timeout(2200) }
            );
            if (rawReadmeRes.ok) {
              const readmeText = await rawReadmeRes.text();
              const platformRegexes = [
                { regex: /https:\/\/[a-zA-Z0-9_.-]+\.vercel\.app[^\s\)"'<>"]*/gi, provider: "Vercel" },
                { regex: /https:\/\/[a-zA-Z0-9_.-]+\.netlify\.app[^\s\)"'<>"]*/gi, provider: "Netlify" },
                { regex: /https:\/\/[a-zA-Z0-9_.-]+\.onrender\.com[^\s\)"'<>"]*/gi, provider: "Render" },
                { regex: /https:\/\/[a-zA-Z0-9_.-]+\.pages\.dev[^\s\)"'<>"]*/gi, provider: "Cloudflare" },
                { regex: /https:\/\/[a-zA-Z0-9_.-]+\.(?:up\.)?railway\.app[^\s\)"'<>"]*/gi, provider: "Railway" },
                { regex: /https:\/\/[a-zA-Z0-9_.-]+\.herokuapp\.com[^\s\)"'<>"]*/gi, provider: "Heroku" },
                { regex: /https:\/\/[a-zA-Z0-9_.-]+\.fly\.dev[^\s\)"'<>"]*/gi, provider: "Fly.io" },
                { regex: /https:\/\/[a-zA-Z0-9_.-]+\.(?:web\.app|firebaseapp\.com)[^\s\)"'<>"]*/gi, provider: "Firebase" },
                { regex: /https:\/\/[a-zA-Z0-9_.-]+\.surge\.sh[^\s\)"'<>"]*/gi, provider: "Surge" },
                { regex: /https:\/\/[a-zA-Z0-9_.-]+\.amplifyapp\.com[^\s\)"'<>"]*/gi, provider: "AWS Amplify" },
                { regex: /https:\/\/[a-zA-Z0-9_.-]+\.github\.io\/[^\s\)"'<>"]*/gi, provider: "GitHub Pages" },
              ];

              for (const { regex, provider } of platformRegexes) {
                const matches = readmeText.match(regex);
                if (matches && matches.length > 0) {
                  for (let i = 0; i < Math.min(matches.length, 2); i++) {
                    addLiveUrl({
                      id: `readme-${repoName}-${provider.toLowerCase()}-${i}`,
                      repoFullName,
                      repoName,
                      environment: `${provider} Live Site`,
                      url: matches[i],
                      provider,
                      createdAt: repo.updated_at,
                    });
                  }
                }
              }

              // Also check markdown [Live Demo](url) or [Website](url)
              const demoLinkRegex = /\[(?:Live Demo|Demo|Live Site|Website|App|Live Preview|Deployed Application|Preview)\]\((https?:\/\/[^\s\)]+)\)/gi;
              let demoMatch;
              let dIdx = 0;
              while ((demoMatch = demoLinkRegex.exec(readmeText)) !== null && dIdx < 2) {
                const url = demoMatch[1];
                if (url && !url.includes("github.com") && !url.includes("badge") && !url.includes("shields.io")) {
                  addLiveUrl({
                    id: `readme-demo-${repoName}-${dIdx}`,
                    repoFullName,
                    repoName,
                    environment: "README Demo Link",
                    url,
                    provider: detectProviderFromUrl(url, "Demo"),
                    createdAt: repo.updated_at,
                  });
                  dIdx++;
                }
              }
            }
          } catch {
            // ignore
          }
        })();

        await Promise.allSettled([depPromise, readmePromise]);
      });

      await Promise.allSettled(batchPromises);

      const responseData = {
        username: username || "user",
        deployments: allLiveUrls,
        total: allLiveUrls.length,
        scannedReposCount: reposList.length,
      };

      userDeploymentsCache.set(cacheKey, { timestamp: Date.now(), data: responseData });
      res.json(responseData);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to scan user deployments." });
    }
  });

  // AI Commit Explainer Document generator
  app.post("/api/github/explain-commit", async (req, res) => {
    try {
      const headerKey = req.headers["x-gemini-api-key"] as string | undefined;
      const bodyKey = req.body.apiKey as string | undefined;
      const effectiveKey = (headerKey && headerKey.trim()) || (bodyKey && bodyKey.trim()) || process.env.GEMINI_API_KEY;

      if (!effectiveKey || !effectiveKey.trim()) {
        return res.status(400).json({
          error: "Gemini API key is required. Please set GEMINI_API_KEY or configure it in Settings.",
        });
      }

      const { commitSha, commitMessage, authorName, stats, files, repoFullName, model } = req.body;
      const targetModel = getGeminiModelForSdk(model || "gemini-3.5-flash-lite");

      const ai = new GoogleGenAI({
        apiKey: effectiveKey.trim(),
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

      // Format file changes and sample patch diffs
      const fileListSummary = (files || [])
        .map((f: any) => {
          let str = `- **${f.filename}** (${f.status}, +${f.additions} -${f.deletions})`;
          if (f.patch) {
            str += `\n\`\`\`diff\n${f.patch.slice(0, 1500)}\n\`\`\``;
          }
          return str;
        })
        .slice(0, 10)
        .join("\n\n");

      const prompt = `You are an elite Senior Software Architect and Git Code Reviewer.
Analyze this GitHub commit in repository "${repoFullName || 'Repository'}":

Commit SHA: ${commitSha}
Author: ${authorName}
Commit Message: "${commitMessage}"
Stats: Total changed: ${stats?.total || 0} (+${stats?.additions || 0}, -${stats?.deletions || 0})

Changed Files & Diffs:
${fileListSummary || "No patch data provided."}

Generate a clear, structured, and comprehensive Markdown documentation of this commit following this EXACT two-level hierarchy:

---

## 🎯 1. Master Purpose & Overall Intent (Kyu Aur Kya Banane Ki Koshish Ki Gayi)
- **High-Level Intent & Goal**: Explain clearly in accessible, precise language what feature, capability, refactor, or bug fix this commit was trying to build/solve (e.g. why was this change created, user/system benefit).
- **Global Multi-File Scope (All Files Summary)**: Explain the big picture of what happened across ALL touched files combined, and how they connect with each other to accomplish this goal.
- **Architectural & Runtime Impact**: What changes in state flow, user experience, API communication, or application logic.

---

## 📂 2. File-by-File Documentation & Breakdown (Neeche Har File Ke Changes Ka Detailed Doc)
*(For EVERY changed file listed above, provide a dedicated sub-section documenting what was changed in that specific file)*:

For each file, format as:
### 📄 \`[filepath]\` (\`[status]\`, +[additions] / -[deletions])
- **File Responsibility in Commit**: What this file does and why it was modified in this commit.
- **Key Modifications**: Specific changes made (e.g. new methods, imported packages, modified interfaces, UI markup changes, bug fixes).
- **Code Highlights & Explanation**: Short explanation of the code additions or removals in this file.

---

## 🔍 3. Code Diff Highlights & Logic Insights
- Highlight key code snippets, edge cases handled, or algorithmic updates.

## 🧪 4. Testing & Verification Checklist
- Step-by-step instructions on how to test and verify these changes in the project.

Format cleanly with headers, bold text, code blocks, and bullet points.`;

      const candidateModels = Array.from(
        new Set([targetModel, "gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-3.1-pro-preview"])
      );

      let markdown = "";
      let modelUsed = targetModel;

      for (const candidate of candidateModels) {
        try {
          const response = await executeGeminiWithRetry(
            () =>
              ai.models.generateContent({
                model: candidate,
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                  maxOutputTokens: 65536,
                  systemInstruction:
                    "You are an expert Git reviewer and technical architect. Provide deep, accurate, and easy-to-understand explanations of code diffs and commits in clear English/Hinglish with structured top-level intent followed by file-by-file documentation.",
                },
              }),
            1,
            1200
          );
          if (response?.text) {
            markdown = response.text;
            modelUsed = candidate;
            break;
          }
        } catch (mErr: any) {
          console.warn(`[Commit Explainer: Model ${candidate} unavailable]:`, mErr?.message || mErr);
        }
      }

      if (!markdown) {
        // High-demand fallback: generate rich structured document directly from commit data
        markdown = `# 🎯 Commit Analysis: \`${commitSha?.slice(0, 7) || 'HEAD'}\`

> ⚠️ *Note: Upstream AI models are temporarily experiencing high demand. Showing structured analysis from Git commit data.*

- **Commit Message**: ${commitMessage}
- **Author**: ${authorName || 'Unknown'}
- **Total Changes**: Total: ${stats?.total || files?.length || 0} (+${stats?.additions || 0}, -${stats?.deletions || 0})

---

## 📂 Changed Files in this Commit
${(files || []).map((f: any) => `- **\`${f.filename}\`** (${f.status}, +${f.additions || 0} / -${f.deletions || 0})`).join('\n')}

---

## 🔍 Patch Diff Highlights
${fileListSummary || 'No patch diff available.'}`;
      }

      res.json({
        sha: commitSha,
        commitMessage,
        authorName,
        markdown,
        modelUsed,
      });
    } catch (error: any) {
      console.error("Commit analysis error:", error);
      res.status(500).json({ error: extractCleanErrorMessage(error) });
    }
  });

  // GitHub Clone & Push to User's Account endpoint
  app.post("/api/github/clone-repo", async (req, res) => {
    try {
      const token = ((req.headers["x-github-token"] as string) || req.body.token)?.trim();
      if (!token) {
        return res.status(401).json({
          error: "GitHub Personal Access Token (PAT) with 'repo' scope is required to clone and push to your GitHub account. Please add it in Keys Settings.",
        });
      }

      const {
        sourceOwner,
        sourceRepo,
        sourceBranch = "main",
        targetRepoName,
        targetDescription = "",
        isPrivate = false,
        cloneType = "standalone", // 'standalone' | 'fork'
      } = req.body;

      if (!sourceOwner || !sourceRepo || !targetRepoName) {
        return res.status(400).json({ error: "Source owner, source repo, and target repository name are required." });
      }

      // 1. Verify user token & get authenticated username
      const userRes = await fetch("https://api.github.com/user", {
        headers: getGitHubHeaders(token),
      });
      if (!userRes.ok) {
        const err = await userRes.json().catch(() => ({}));
        return res.status(userRes.status).json({
          error: `GitHub Token invalid or expired: ${err.message || userRes.statusText}`,
        });
      }
      const userData = await userRes.json();
      const targetOwner = userData.login;

      if (cloneType === "fork") {
        // Prevent self-fork which GitHub API rejects with 404
        if (sourceOwner.toLowerCase() === targetOwner.toLowerCase()) {
          return res.status(400).json({
            error: `GitHub does not allow forking your own repository (${sourceOwner}/${sourceRepo}) into the same account. Please switch to "Standalone Clone" strategy to create a new copy with all files.`,
            isSelfFork: true,
          });
        }

        // Execute GitHub Fork API
        const forkRes = await fetch(`https://api.github.com/repos/${sourceOwner}/${sourceRepo}/forks`, {
          method: "POST",
          headers: getGitHubHeaders(token),
          body: JSON.stringify({
            name: targetRepoName.trim(),
            default_branch_only: false,
          }),
        });

        if (!forkRes.ok) {
          const err = await forkRes.json().catch(() => ({}));
          let detailedMessage = err.message || forkRes.statusText;
          if (forkRes.status === 404) {
            detailedMessage = `GitHub returned 404 Not Found. This occurs when: (1) You cannot fork your own repository into the same account, (2) The repository is private and your token lacks read access, or (3) Forking is disabled in repo settings. Please use "Standalone Clone" instead.`;
          }
          return res.status(forkRes.status).json({
            error: `Failed to fork repository: ${detailedMessage}`,
            status: forkRes.status,
          });
        }

        const forkData = await forkRes.json();
        return res.json({
          success: true,
          method: "fork",
          repo: forkData,
          message: `Successfully forked ${sourceOwner}/${sourceRepo} to ${forkData.full_name}!`,
        });
      }

      // Standalone Clone & Push to User's Account
      // Step A: Create new repo under authenticated user
      const createRepoRes = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: getGitHubHeaders(token),
        body: JSON.stringify({
          name: targetRepoName.trim(),
          description: targetDescription || `Cloned from ${sourceOwner}/${sourceRepo} via Gemini Chat`,
          private: Boolean(isPrivate),
          auto_init: true, // initializes with README so default branch exists
        }),
      });

      if (!createRepoRes.ok) {
        const err = await createRepoRes.json().catch(() => ({}));
        return res.status(createRepoRes.status).json({
          error: `Failed to create repository "${targetRepoName}" on GitHub: ${err.message || createRepoRes.statusText}`,
        });
      }

      const newRepoData = await createRepoRes.json();
      const targetBranch = newRepoData.default_branch || "main";

      // Step B: Fetch source tree
      const treeRes = await fetch(
        `https://api.github.com/repos/${sourceOwner}/${sourceRepo}/git/trees/${encodeURIComponent(sourceBranch)}?recursive=1`,
        { headers: getGitHubHeaders(token) }
      );

      if (!treeRes.ok) {
        const err = await treeRes.json().catch(() => ({}));
        return res.status(treeRes.status).json({
          error: `Could not fetch files from source repo ${sourceOwner}/${sourceRepo}: ${err.message}`,
        });
      }

      const treeData = await treeRes.json();
      const rawItems: any[] = treeData.tree || [];
      // Only keep blob items
      const blobItems = rawItems.filter((i) => i.type === "blob" && !i.path.startsWith(".git/"));

      // Step C: Push files to the new repository in parallel batches
      const targetTreeEntries: { path: string; mode: string; type: string; sha: string }[] = [];
      const batchSize = 6;
      for (let i = 0; i < blobItems.length; i += batchSize) {
        const batch = blobItems.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (item) => {
            try {
              // Fetch blob content from source
              const blobRes = await fetch(
                `https://api.github.com/repos/${sourceOwner}/${sourceRepo}/git/blobs/${item.sha}`,
                { headers: getGitHubHeaders(token) }
              );
              if (!blobRes.ok) return;
              const blobJson = await blobRes.json();

              // Create blob in target repo
              const createBlobRes = await fetch(
                `https://api.github.com/repos/${targetOwner}/${newRepoData.name}/git/blobs`,
                {
                  method: "POST",
                  headers: getGitHubHeaders(token),
                  body: JSON.stringify({
                    content: blobJson.content,
                    encoding: blobJson.encoding || "base64",
                  }),
                }
              );

              if (createBlobRes.ok) {
                const createdBlobData = await createBlobRes.json();
                targetTreeEntries.push({
                  path: item.path,
                  mode: item.mode || "100644",
                  type: "blob",
                  sha: createdBlobData.sha,
                });
              }
            } catch (e) {
              console.warn(`Error copying file ${item.path}:`, e);
            }
          })
        );
      }

      if (targetTreeEntries.length > 0) {
        // Step D: Create Git Tree
        const createTreeRes = await fetch(
          `https://api.github.com/repos/${targetOwner}/${newRepoData.name}/git/trees`,
          {
            method: "POST",
            headers: getGitHubHeaders(token),
            body: JSON.stringify({
              tree: targetTreeEntries,
            }),
          }
        );

        if (createTreeRes.ok) {
          const createdTreeData = await createTreeRes.json();

          // Step E: Get latest commit SHA on target branch
          let parentCommitSha: string | undefined;
          const refRes = await fetch(
            `https://api.github.com/repos/${targetOwner}/${newRepoData.name}/git/refs/heads/${encodeURIComponent(targetBranch)}`,
            { headers: getGitHubHeaders(token) }
          );
          if (refRes.ok) {
            const refData = await refRes.json();
            parentCommitSha = refData.object?.sha;
          }

          // Step F: Create Commit
          const commitRes = await fetch(
            `https://api.github.com/repos/${targetOwner}/${newRepoData.name}/git/commits`,
            {
              method: "POST",
              headers: getGitHubHeaders(token),
              body: JSON.stringify({
                message: `Clone from ${sourceOwner}/${sourceRepo} (${targetTreeEntries.length} files)\n\nCloned and published via Gemini Chat`,
                tree: createdTreeData.sha,
                parents: parentCommitSha ? [parentCommitSha] : [],
              }),
            }
          );

          if (commitRes.ok) {
            const createdCommitData = await commitRes.json();

            // Step G: Update Reference
            await fetch(
              `https://api.github.com/repos/${targetOwner}/${newRepoData.name}/git/refs/heads/${encodeURIComponent(targetBranch)}`,
              {
                method: "PATCH",
                headers: getGitHubHeaders(token),
                body: JSON.stringify({
                  sha: createdCommitData.sha,
                  force: true,
                }),
              }
            );
          }
        }
      }

      res.json({
        success: true,
        method: "standalone",
        repo: newRepoData,
        filesCount: targetTreeEntries.length,
        message: `Successfully cloned and pushed ${targetTreeEntries.length} files to ${newRepoData.full_name}!`,
      });
    } catch (err: any) {
      console.error("Clone repo error:", err);
      res.status(500).json({ error: err.message || "Failed to clone repository to your GitHub account." });
    }
  });

  // Project Unified Deep Scan (Whole project scanned together -> 4 Large Documents)
  app.post("/api/repo/deep-scan", async (req, res) => {
    try {
      const headerKey = req.headers["x-gemini-api-key"] as string | undefined;
      const bodyKey = req.body.apiKey as string | undefined;
      const effectiveKey = (headerKey && headerKey.trim()) || (bodyKey && bodyKey.trim()) || process.env.GEMINI_API_KEY;

      if (!effectiveKey || !effectiveKey.trim()) {
        return res.status(400).json({
          error: "Gemini API key is required. Please set GEMINI_API_KEY or enter your key in Settings.",
        });
      }

      const { repoFullName, repoName, description, fileList, sampleFilesContent, model } = req.body;
      const targetModel = getGeminiModelForSdk(model || "gemini-3.8-flash");

      const ai = new GoogleGenAI({
        apiKey: effectiveKey.trim(),
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

      const fileListFormatted = Array.isArray(fileList) ? fileList.join("\n") : fileList;

      const prompt = `You are a Principal Software Architect and Lead Systems Engineer.
Perform an exhaustive, complete deep scan of the entire repository "${repoFullName || repoName}" in one unified pass.
Repository Description: ${description || "No description provided"}

Here is the complete file list of the entire project:
${fileListFormatted}

Key source files content overview:
${sampleFilesContent || "No sample content provided."}

Generate 4 SEPARATE, LARGE, FULLY EXPANDED MARKDOWN DOCUMENTS for this project (Do not truncate or stop halfway, generate the complete comprehensive content):

1. **PROJECT OVERVIEW (Kyu ban raha hai / Purpose & Vision)**:
   - Detailed explanation of why this website/project exists (kyu aur kis liye banaya gaya hai).
   - Core problem statement, target audience, and business/technical goals.
   - Comprehensive system walkthrough explaining the entire concept from scratch.
   - User journey and execution workflows.

2. **ALL ENDPOINTS DIRECTORY (All API & Route Endpoints across whole site)**:
   - Exhaustive table and individual breakdowns of EVERY endpoint, API route, server controller, client fetch handler, and GitHub API integration.
   - Method (GET/POST/PUT/DELETE/WS), Path, Description, Authentication, Request Params/Body, Response format, and File Location.
   - If frontend-only or hybrid, include all routing endpoints, fetch endpoints, and GitHub REST API integration points.

3. **STRUCTURE & ARCHITECTURE (Complete Codebase Structure & System Design)**:
   - Full directory layout and folder organization breakdown.
   - Technical stack (Frontend, Backend, Styling, State Management, Build tools).
   - Data flow diagrams (ASCII/Mermaid) showing how state moves across components and server.
   - Design patterns, component hierarchy, and dependency relationships.

4. **FEATURES CATALOG (Kya kya features hain - Complete feature breakdown)**:
   - Detailed catalog of every single feature and capability implemented in this site.
   - For each feature: what it does, how it works, files implementing it, user interactions, and technical highlights.

Return the response in the following EXACT JSON format:
\`\`\`json
{
  "projectOverviewDoc": "# 📄 Project Overview: ${repoName || repoFullName}\\n\\n## 🎯 Why This Project Exists (Kyu ban raha hai)\\n...",
  "endpointsDoc": "# 🔌 Complete Endpoints Directory: ${repoName || repoFullName}\\n\\n## 📋 Endpoints Overview Table\\n...",
  "structureArchitectureDoc": "# 🏛️ Codebase Structure & Architecture: ${repoName || repoFullName}\\n\\n## 📁 Directory Structure Breakdown\\n...",
  "featuresCatalogDoc": "# ⚡ Features & Capabilities Catalog: ${repoName || repoFullName}\\n\\n## 🚀 Complete Feature Inventory\\n..."
}
\`\`\``;

      let response: any;
      try {
        response = await executeGeminiWithRetry(() =>
          ai.models.generateContent({
            model: targetModel,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
              maxOutputTokens: 65536,
              systemInstruction: "You are an elite technical documentation writer and principal system architect. Deliver large, rich, complete production-grade technical documents with pristine markdown formatting without truncating.",
            },
          })
        );
      } catch (scanErr: any) {
        console.warn(`[Deep Scan with ${targetModel} failed, retrying with gemini-3.8-flash]:`, scanErr?.message);
        response = await executeGeminiWithRetry(() =>
          ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
              maxOutputTokens: 65536,
              systemInstruction: "You are an elite technical documentation writer and principal system architect. Deliver large, rich, complete production-grade technical documents with pristine markdown formatting.",
            },
          })
        );
      }

      const responseText = response.text || "";
      let jsonResult: any = null;

      try {
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonResult = JSON.parse(jsonMatch[1]);
        } else {
          jsonResult = JSON.parse(responseText);
        }
      } catch {
        jsonResult = {
          projectOverviewDoc: `# 📄 Project Overview: ${repoName || repoFullName}\n\n## 🎯 Why This Project Exists\n\n${responseText}`,
          endpointsDoc: `# 🔌 Endpoints Directory\n\n${responseText}`,
          structureArchitectureDoc: `# 🏛️ Architecture & Structure\n\n${responseText}`,
          featuresCatalogDoc: `# ⚡ Features Catalog\n\n${responseText}`,
        };
      }

      res.json(jsonResult);
    } catch (error: any) {
      console.error("Deep scan error:", error);
      res.status(500).json({ error: extractCleanErrorMessage(error) });
    }
  });

  // Server-side Gemini Architecture & Endpoints Deep Analysis
  app.post("/api/repo/analyze-architecture", async (req, res) => {
    try {
      const headerKey = req.headers["x-gemini-api-key"] as string | undefined;
      const bodyKey = req.body.apiKey as string | undefined;
      const effectiveKey = (headerKey && headerKey.trim()) || (bodyKey && bodyKey.trim()) || process.env.GEMINI_API_KEY;

      if (!effectiveKey || !effectiveKey.trim()) {
        return res.status(400).json({
          error: "Gemini API key is required. Please set GEMINI_API_KEY or provide your API key in Settings.",
        });
      }

      const { repoFullName, repoName, fileList, sampleFilesContent, description, model } = req.body;
      const targetModel = getGeminiModelForSdk(model || "gemini-3.8-flash");

      const ai = new GoogleGenAI({
        apiKey: effectiveKey.trim(),
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const prompt = `You are a Principal Software Architect conducting an in-depth codebase audit of the GitHub repository "${repoFullName || repoName}".
Repository Description: ${description || "No description provided"}

Here is the complete filtered list of files in the repository:
${Array.isArray(fileList) ? fileList.slice(0, 150).join("\n") : fileList}

Key files content overview:
${sampleFilesContent || "No extra file content provided."}

Perform an exhaustive, deep analysis of this project and generate a structured report covering:
1. Why the project exists (kyu aur kis liye banaya gaya hai).
2. Its complete technical architecture (frontend, backend, state, styling, data flow).
3. EVERY API/route/endpoint in the application.
4. An index/breakdown for each file listed above (purpose, what is inside, key exports, dependencies).

Return the response in the following exact JSON format:
\`\`\`json
{
  "projectName": "${repoName || repoFullName}",
  "projectPurpose": "Detailed explanation of why this project is built (kyu aur kis liye banaya gaya hai), its core vision, target users, and key problem it solves.",
  "coreArchitecture": "Step-by-step technical architecture explanation: frontend, backend, state management, build system, styling, external services, folder layout breakdown.",
  "techStack": [
    { "category": "Frontend / UI", "items": ["React", "TypeScript", "Tailwind CSS", "Vite"] },
    { "category": "Backend / Server", "items": ["Node.js", "Express"] },
    { "category": "AI / APIs", "items": ["Google Gemini API", "GitHub REST API"] },
    { "category": "Tools & Build", "items": ["esbuild", "PostCSS"] }
  ],
  "dataFlow": "Detailed walkthrough of the end-to-end data flow from user action to server processing to response display.",
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/example",
      "description": "Clear explanation of what this endpoint does",
      "fileLocation": "server.ts",
      "payload": "Query parameters or JSON body",
      "response": "JSON payload structure",
      "auth": "Public / Bearer Token"
    }
  ],
  "endpointsMarkdown": "A complete, beautifully formatted Markdown table & breakdown of all discovered endpoints, routes, controllers, or API handlers.",
  "fullMarkdown": "A complete, comprehensive standalone Markdown document summarizing the whole architecture, why it was made, data flow, endpoints, and deployment instructions.",
  "setupGuide": "Step-by-step setup, installation, environment variable configuration, and deployment instructions.",
  "filesSummary": {
    "src/App.tsx": {
      "purpose": "Main React application component orchestrating state and layout.",
      "summary": "Handles repo selection, active files, dual vertical tabs, and chat workspace.",
      "keyExports": ["App"],
      "dependencies": ["react", "lucide-react"]
    }
  }
}
\`\`\`

IMPORTANT: Include EVERY endpoint and summarize the purpose of files in "filesSummary".`;

      let response: any;
      try {
        response = await executeGeminiWithRetry(() =>
          ai.models.generateContent({
            model: targetModel,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
              maxOutputTokens: 65536,
              systemInstruction: "You are an expert software architect and technical writer. Provide precise, accurate, comprehensive, and complete structured insights about repositories without truncating.",
            },
          })
        );
      } catch (archErr: any) {
        console.warn(`[Architecture Analysis with ${targetModel} failed, retrying with gemini-3.8-flash]:`, archErr?.message);
        response = await executeGeminiWithRetry(() =>
          ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
              maxOutputTokens: 65536,
              systemInstruction: "You are an expert software architect and technical writer. Provide precise, accurate, and structured insights about repositories.",
            },
          })
        );
      }

      const responseText = response.text || "";
      let jsonResult: any = null;

      try {
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonResult = JSON.parse(jsonMatch[1]);
        } else {
          jsonResult = JSON.parse(responseText);
        }
      } catch (parseErr) {
        // Fallback structured object from raw text
        jsonResult = {
          projectName: repoName || repoFullName,
          projectPurpose: `Analysis for ${repoFullName}. Full technical overview generated by Gemini.`,
          coreArchitecture: responseText,
          techStack: [],
          dataFlow: "Standard client-server architecture.",
          endpoints: [],
          endpointsMarkdown: responseText,
          fullMarkdown: responseText,
          setupGuide: "See repository README.md for setup instructions.",
          filesSummary: {},
        };
      }

      res.json(jsonResult);
    } catch (error: any) {
      console.error("Architecture analysis error:", error);
      res.status(500).json({ error: extractCleanErrorMessage(error) });
    }
  });

  // Server-side Gemini Single File Markdown Doc Generator
  app.post("/api/repo/analyze-file", async (req, res) => {
    try {
      const headerKey = req.headers["x-gemini-api-key"] as string | undefined;
      const bodyKey = req.body.apiKey as string | undefined;
      const effectiveKey = (headerKey && headerKey.trim()) || (bodyKey && bodyKey.trim()) || process.env.GEMINI_API_KEY;

      if (!effectiveKey || !effectiveKey.trim()) {
        return res.status(400).json({
          error: "Gemini API key is required. Please set GEMINI_API_KEY or enter your API key in Settings.",
        });
      }

      const { repoFullName, filePath, fileName, fileContent, language, model } = req.body;
      const targetModel = getGeminiModelForSdk(model || "gemini-3.8-flash");

      if (!filePath) {
        return res.status(400).json({ error: "filePath is required." });
      }

      const ai = new GoogleGenAI({
        apiKey: effectiveKey.trim(),
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const prompt = `You are an elite software documentation engineer.
Analyze the following source file from repository "${repoFullName || 'Repository'}":

File Path: \`${filePath}\`
Language: \`${language || 'text'}\`

Source Code:
\`\`\`${language || ''}
${(fileContent || '').slice(0, 25000)}
\`\`\`

Generate a comprehensive Markdown documentation for this single file.
Your response MUST be in this JSON structure:
\`\`\`json
{
  "path": "${filePath}",
  "name": "${fileName || filePath.split('/').pop()}",
  "language": "${language || 'text'}",
  "purpose": "A clear, concise 1-2 sentence summary of what this file is for (kam kya hai - exact role in the project).",
  "summary": "Detailed explanation of what is inside this file (kya kya hai is file me): internal logic, state variables, key mechanisms, and behavior.",
  "keyExports": ["ExportedFunction1", "ExportedComponent", "TypeInterface", "RouteHandler"],
  "dependencies": ["react", "lucide-react", "../types"],
  "mdContent": "# Markdown documentation for ${filePath}\\n\\n## 📌 Purpose (Kam kya hai)\\n...\\n\\n## 🔍 What is Inside (Kya kya code hai)\\n...\\n\\n## ⚙️ Key Functions & Exports\\n...\\n\\n## 🔗 Dependencies & Connections\\n..."
}
\`\`\``;

      let docResult: any = null;
      try {
        const response = await executeGeminiWithRetry(() =>
          ai.models.generateContent({
            model: targetModel,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
              maxOutputTokens: 65536,
              systemInstruction: "You are a senior code analyst. Create complete, structured, high-clarity markdown documentation for source code files without truncating.",
            },
          }),
          2,
          2000
        );

        const responseText = response.text || "";
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          docResult = JSON.parse(jsonMatch[1]);
        } else {
          docResult = JSON.parse(responseText);
        }
      } catch (aiErr: any) {
        console.warn(`[File Analysis AI Warning] for ${filePath}:`, extractCleanErrorMessage(aiErr));
        // Graceful fallback markdown so 429 doesn't fail the whole app
        const ext = filePath.split('.').pop() || '';
        const name = fileName || filePath.split('/').pop() || filePath;
        docResult = {
          path: filePath,
          name,
          language: language || ext,
          purpose: `Source code file \`${name}\` in ${repoFullName || 'the project'}.`,
          summary: `Handles module implementation for ${filePath}.`,
          keyExports: [name],
          dependencies: [],
          mdContent: `# 📄 \`${filePath}\`\n\n## 📌 Purpose (Kam kya hai)\nSource code module for \`${name}\`.\n\n## 🔍 What is Inside (Kya kya code hai)\nImplements code logic and export definitions for \`${filePath}\`.\n\n- **Path**: \`${filePath}\`\n- **Type**: \`.${ext}\``,
          quotaFallback: true,
        };
      }

      res.json(docResult);
    } catch (error: any) {
      console.error("File doc analysis error:", error);
      res.status(500).json({ error: extractCleanErrorMessage(error) });
    }
  });

  // Chat completion endpoint (supports SSE streaming)
  app.post("/api/chat", async (req, res) => {
    try {
      const headerKey = req.headers["x-gemini-api-key"] as string | undefined;
      const bodyKey = req.body.apiKey as string | undefined;
      const effectiveKey = (headerKey && headerKey.trim()) || (bodyKey && bodyKey.trim()) || process.env.GEMINI_API_KEY;

      if (!effectiveKey || !effectiveKey.trim()) {
        return res.status(400).json({
          error: "Gemini API key is required. Please enter your API key in the top settings or provide GEMINI_API_KEY.",
        });
      }

      const { messages, model = "gemini-3.5-flash-lite", systemInstruction } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Messages array is required." });
      }

      const primaryModel = getGeminiModelForSdk(model);

      const ai = new GoogleGenAI({
        apiKey: effectiveKey.trim(),
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      // Prepare formatted contents for Gemini
      const formattedContents = messages.map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" || m.role === "model" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      // Setup Server-Sent Events headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      let responseStream: any;
      try {
        responseStream = await ai.models.generateContentStream({
          model: primaryModel,
          contents: formattedContents,
          config: {
            maxOutputTokens: 65536,
            systemInstruction:
              systemInstruction ||
              `You are a helpful, knowledgeable, and polite AI assistant powered by Google ${model || 'Gemini 3.8 Flash'}. Use clear markdown formatting (bolding, lists, code blocks) when beneficial.`,
          },
        });
      } catch (streamInitErr: any) {
        console.warn(`[Stream Model Error for ${primaryModel}, falling back to gemini-3.8-flash]:`, streamInitErr?.message);
        responseStream = await ai.models.generateContentStream({
          model: "gemini-3.8-flash",
          contents: formattedContents,
          config: {
            maxOutputTokens: 65536,
            systemInstruction:
              systemInstruction ||
              "You are a helpful, knowledgeable, and polite AI assistant powered by Google Gemini. Use clear markdown formatting (bolding, lists, code blocks) when beneficial.",
          },
        });
      }

      let latestUsage: any = null;

      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
        if (chunk.usageMetadata) {
          latestUsage = chunk.usageMetadata;
        }
      }

      if (latestUsage) {
        res.write(
          `data: ${JSON.stringify({
            usage: {
              promptTokens: latestUsage.promptTokenCount || 0,
              candidatesTokens: latestUsage.candidatesTokenCount || 0,
              totalTokens: latestUsage.totalTokenCount || 0,
            },
          })}\n\n`
        );
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error: any) {
      console.error("Gemini API stream error:", error);
      const errorMessage = extractCleanErrorMessage(error);
      
      if (!res.headersSent) {
        return res.status(500).json({ error: errorMessage });
      } else {
        res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        res.end();
      }
    }
  });

  // Groq Chat completion endpoint (supports SSE streaming with Llama 3.1 & Llama 3.3)
  app.post("/api/groq/chat", async (req, res) => {
    try {
      const headerKey = req.headers["x-groq-api-key"] as string | undefined;
      const bodyKey = req.body.apiKey as string | undefined;
      const effectiveKey = (headerKey && headerKey.trim()) || (bodyKey && bodyKey.trim()) || process.env.GROQ_API_KEY;

      if (!effectiveKey || !effectiveKey.trim()) {
        return res.status(400).json({
          error: "Groq API key is required. Please provide your Groq API key in Settings or the Groq panel (https://console.groq.com/keys).",
        });
      }

      const { messages, model = "llama-3.3-70b-versatile", systemInstruction, temperature = 0.6, max_tokens = 8192 } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Messages array is required." });
      }

      // Use requested model or fallback to llama-3.3-70b-versatile
      const validModel =
        model && typeof model === "string" && model.trim() ? model.trim() : "llama-3.3-70b-versatile";

      const formattedMessages: Array<{ role: string; content: string }> = [];

      if (systemInstruction && typeof systemInstruction === "string" && systemInstruction.trim()) {
        formattedMessages.push({
          role: "system",
          content: systemInstruction.trim(),
        });
      }

      messages.forEach((m: { role: string; content: string }) => {
        const role = m.role === "assistant" || m.role === "model" ? "assistant" : m.role === "system" ? "system" : "user";
        formattedMessages.push({
          role,
          content: m.content || "",
        });
      });

      // Call Groq API with stream: true
      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${effectiveKey.trim()}`,
          "Content-Type": "application/json",
          "User-Agent": "Gemini-GitHub-Studio-App",
        },
        body: JSON.stringify({
          model: validModel,
          messages: formattedMessages,
          temperature,
          max_tokens,
          stream: true,
        }),
      });

      if (!groqRes.ok) {
        const errJson = await groqRes.json().catch(() => ({}));
        const errMsg =
          errJson.error?.message ||
          (groqRes.status === 429
            ? "Groq Rate Limit Exceeded. Please try again in a few moments."
            : `Groq API Error (${groqRes.status}): ${groqRes.statusText}`);
        return res.status(groqRes.status).json({ error: errMsg });
      }

      if (!groqRes.body) {
        return res.status(502).json({ error: "No response body received from Groq." });
      }

      // Setup Server-Sent Events headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      const reader = groqRes.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const dataStr = trimmed.replace("data: ", "").trim();
          if (dataStr === "[DONE]") {
            res.write("data: [DONE]\n\n");
            res.end();
            return;
          }

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.error) {
              res.write(`data: ${JSON.stringify({ error: parsed.error.message || "Groq error" })}\n\n`);
              res.end();
              return;
            }

            const deltaText = parsed.choices?.[0]?.delta?.content;
            if (deltaText) {
              res.write(`data: ${JSON.stringify({ text: deltaText })}\n\n`);
            }

            if (parsed.usage) {
              res.write(
                `data: ${JSON.stringify({
                  usage: {
                    promptTokens: parsed.usage.prompt_tokens || 0,
                    candidatesTokens: parsed.usage.completion_tokens || 0,
                    totalTokens: parsed.usage.total_tokens || 0,
                  },
                })}\n\n`
              );
            }
          } catch {
            // ignore JSON parse fragments
          }
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error: any) {
      console.error("Groq API stream error:", error);
      const errMsg = error?.message || "Failed to communicate with Groq.";
      if (!res.headersSent) {
        return res.status(500).json({ error: errMsg });
      } else {
        res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
        res.end();
      }
    }
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Gemini Chat server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
