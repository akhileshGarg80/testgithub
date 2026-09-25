import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  FolderGit2,
  Star,
  RefreshCw,
  Lock,
  ChevronLeft,
  User,
  Layers,
  Sparkles,
  Globe,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { GitHubRepo, GitHubUserProfile, ProductionDeploymentItem } from '../types';

interface RepoSidebarProps {
  repos: GitHubRepo[];
  selectedRepo: GitHubRepo | null;
  onSelectRepo: (repo: GitHubRepo) => void;
  username: string;
  onChangeUsername: (username: string) => void;
  onFetchRepos: (user: string, limit?: number | 'all') => void;
  isLoading: boolean;
  isOpen: boolean;
  onToggle: () => void;
  error?: string | null;
  onOpenSelfModal?: () => void;
  selfProfile?: GitHubUserProfile | null;
  hasGithubToken?: boolean;
  userLiveSites?: ProductionDeploymentItem[];
  isScanningLiveSites?: boolean;
  onOpenLiveSite?: (deployment: ProductionDeploymentItem) => void;
}

const PRESET_USERS = ['octocat', 'vercel', 'shadcn', 'facebook'];

export function RepoSidebar({
  repos,
  selectedRepo,
  onSelectRepo,
  username,
  onChangeUsername,
  onFetchRepos,
  isLoading,
  isOpen,
  onToggle,
  error,
  onOpenSelfModal,
  selfProfile,
  hasGithubToken,
  userLiveSites = [],
  isScanningLiveSites = false,
  onOpenLiveSite,
}: RepoSidebarProps) {
  const [searchInput, setSearchInput] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [fetchLimit, setFetchLimit] = useState<'100' | '250' | 'all'>('all');
  const [onlyLiveFilter, setOnlyLiveFilter] = useState<boolean>(false);

  useEffect(() => {
    setSearchInput(username);
  }, [username]);

  // Map each repo to its live deployment items (by full_name, name, or repo ID)
  const repoLiveDeploymentsMap = useMemo(() => {
    const map = new Map<string, ProductionDeploymentItem[]>();

    userLiveSites.forEach((dep) => {
      const fullKey = (dep.repoFullName || '').toLowerCase().trim();
      const nameKey = (dep.repoName || '').toLowerCase().trim();

      if (fullKey) {
        if (!map.has(fullKey)) map.set(fullKey, []);
        map.get(fullKey)!.push(dep);
      }
      if (nameKey && nameKey !== fullKey) {
        if (!map.has(nameKey)) map.set(nameKey, []);
        map.get(nameKey)!.push(dep);
      }
    });

    return map;
  }, [userLiveSites]);

  // Count repos that have active live deployments
  const liveReposCount = useMemo(() => {
    return repos.filter((r) => {
      const fullKey = r.full_name.toLowerCase();
      const nameKey = r.name.toLowerCase();
      const hasFromScan = repoLiveDeploymentsMap.has(fullKey) || repoLiveDeploymentsMap.has(nameKey);
      const hasFromMetadata = Boolean((r.homepage && r.homepage.startsWith('http')) || r.has_pages);
      return hasFromScan || hasFromMetadata;
    }).length;
  }, [repos, repoLiveDeploymentsMap]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    onChangeUsername(searchInput.trim());
    const limitArg = fetchLimit === 'all' ? 'all' : parseInt(fetchLimit, 10);
    onFetchRepos(searchInput.trim(), limitArg);
  };

  const handleLoadAll = () => {
    setFetchLimit('all');
    if (searchInput.trim() || username) {
      onFetchRepos(searchInput.trim() || username, 'all');
    }
  };

  const filteredRepos = repos.filter((r) => {
    const fullKey = r.full_name.toLowerCase();
    const nameKey = r.name.toLowerCase();
    const hasLive = repoLiveDeploymentsMap.has(fullKey) || repoLiveDeploymentsMap.has(nameKey) || (r.homepage && r.homepage.startsWith('http')) || r.has_pages;

    if (onlyLiveFilter && !hasLive) {
      return false;
    }

    if (!filterQuery.trim()) return true;

    return (
      r.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(filterQuery.toLowerCase())) ||
      (r.language && r.language.toLowerCase().includes(filterQuery.toLowerCase()))
    );
  });

  return (
    <div
      id="github-repos-sidebar"
      className={`${
        isOpen ? 'w-full md:w-60 lg:w-64' : 'w-0 hidden md:block'
      } shrink-0 border-r border-slate-800/80 bg-slate-950/95 flex flex-col h-full transition-all duration-200 overflow-hidden relative z-20`}
    >
      {/* Top Header */}
      <div className="p-2.5 border-b border-slate-800/80">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="p-1 rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/30 shrink-0">
              <FolderGit2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-[11px] font-bold text-slate-100 uppercase tracking-wider truncate">
              GitHub Repos
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-900 border border-slate-800 text-slate-300">
              {repos.length}
            </span>
            <button
              type="button"
              onClick={onToggle}
              className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 cursor-pointer shrink-0"
              title="Collapse Sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Username Search Form */}
        <form onSubmit={handleSearchSubmit} className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <User className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                id="github-username-input"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Username / Org..."
                className="w-full pl-7 pr-12 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                id="fetch-repos-btn"
                type="submit"
                disabled={isLoading}
                className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Load'}
              </button>
            </div>

            {/* Self Account Button */}
            {onOpenSelfModal && (
              <button
                id="self-account-btn"
                type="button"
                onClick={onOpenSelfModal}
                className={`px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-all cursor-pointer shrink-0 shadow-xs ${
                  selfProfile
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/60'
                    : hasGithubToken
                    ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60 hover:bg-indigo-900/80'
                    : 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-600/30'
                }`}
                title="Apna Personal GitHub Account (Self Mode) - Load own repos & edit/push"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Self</span>
              </button>
            )}
          </div>

          {/* Self Profile Connected Indicator */}
          {selfProfile && (
            <div className="p-1.5 rounded-lg bg-slate-900/90 border border-indigo-500/30 flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                {selfProfile.avatar_url ? (
                  <img src={selfProfile.avatar_url} alt="" className="w-4 h-4 rounded-full" />
                ) : (
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                )}
                <span className="text-[11px] font-mono text-indigo-300 truncate">
                  @{selfProfile.login}
                </span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-semibold shrink-0">
                  Self
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onChangeUsername(selfProfile.login);
                  onFetchRepos(selfProfile.login, 'all');
                }}
                className="text-[10px] text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer shrink-0"
              >
                My Repos
              </button>
            </div>
          )}

          {/* Load Limit Mode Switcher (100, 250, All) */}
          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-slate-500" />
              <span className="text-[10px] text-slate-400 font-medium">Fetch:</span>
            </div>
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-md p-0.5">
              <button
                type="button"
                onClick={() => setFetchLimit('100')}
                className={`px-1.5 py-0.2 rounded text-[9px] font-semibold transition-colors cursor-pointer ${
                  fetchLimit === '100'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Fetch up to 100 repositories"
              >
                100
              </button>
              <button
                type="button"
                onClick={() => setFetchLimit('250')}
                className={`px-1.5 py-0.2 rounded text-[9px] font-semibold transition-colors cursor-pointer ${
                  fetchLimit === '250'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Fetch up to 250 repositories"
              >
                250
              </button>
              <button
                type="button"
                onClick={() => setFetchLimit('all')}
                className={`px-1.5 py-0.2 rounded text-[9px] font-semibold transition-colors cursor-pointer ${
                  fetchLimit === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Fetch ALL repositories (thousands)"
              >
                All (Hajaro)
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
            <span className="text-[10px] text-slate-500 shrink-0">Try:</span>
            {PRESET_USERS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setSearchInput(preset);
                  onChangeUsername(preset);
                  const limitArg = fetchLimit === 'all' ? 'all' : parseInt(fetchLimit, 10);
                  onFetchRepos(preset, limitArg);
                }}
                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer shrink-0 ${
                  username.toLowerCase() === preset.toLowerCase()
                    ? 'bg-blue-950 text-blue-300 border-blue-700'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* Scope Filter Tabs: All vs Live Deployed Sites */}
      {repos.length > 0 && (
        <div className="px-2 py-1.5 border-b border-slate-800/80 bg-slate-900/50 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOnlyLiveFilter(false)}
            className={`flex-1 py-1 px-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
              !onlyLiveFilter
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>All Repos</span>
            <span className="text-[10px] px-1 py-0.2 rounded bg-black/30 font-mono">
              {repos.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setOnlyLiveFilter(true)}
            className={`flex-1 py-1 px-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
              onlyLiveFilter
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-400 hover:text-emerald-200 hover:bg-emerald-950/40 border border-emerald-800/40'
            }`}
            title="Show only repositories that have live sites deployed"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Live Sites</span>
            <span className="text-[10px] px-1 py-0.2 rounded bg-black/30 font-mono text-emerald-200">
              {liveReposCount}
            </span>
          </button>
        </div>
      )}

      {/* Filter inside repos */}
      {repos.length > 0 && (
        <div className="p-1.5 border-b border-slate-800/60 bg-slate-900/30">
          <div className="relative">
            <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter by name or language..."
              className="w-full pl-6 pr-2.5 py-1 rounded-md bg-slate-900/80 border border-slate-800 text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-700"
            />
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="p-2.5 m-1.5 rounded-lg bg-rose-950/40 border border-rose-800/50 text-[11px] text-rose-300">
          {error}
        </div>
      )}

      {/* Repos List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1 divide-y-0">
        {isLoading ? (
          <div className="py-10 text-center text-xs text-slate-400 space-y-2">
            <RefreshCw className="w-4 h-4 animate-spin mx-auto text-blue-400" />
            <p>Fetching repositories (including all pages)...</p>
          </div>
        ) : repos.length === 0 ? (
          <div className="py-8 text-center px-3">
            <FolderGit2 className="w-6 h-6 text-slate-600 mx-auto mb-1.5" />
            <p className="text-xs text-slate-400 font-medium">Koi repo nahi mila</p>
            <p className="text-[10px] text-slate-500 mt-1">
              Top par username dalein aur 'Load' karein.
            </p>
          </div>
        ) : filteredRepos.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            {onlyLiveFilter ? (
              <div className="space-y-1">
                <p>No live deployed sites found.</p>
                {isScanningLiveSites ? (
                  <p className="text-[10px] text-sky-400 animate-pulse">Deep scanning repositories...</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOnlyLiveFilter(false)}
                    className="text-indigo-400 hover:underline text-[10px]"
                  >
                    View all {repos.length} repos
                  </button>
                )}
              </div>
            ) : (
              `No repos matching "${filterQuery}"`
            )}
          </div>
        ) : (
          <>
            {filteredRepos.map((repo) => {
              const isSelected = selectedRepo?.id === repo.id;
              const fullKey = repo.full_name.toLowerCase();
              const nameKey = repo.name.toLowerCase();
              const repoDeployments = repoLiveDeploymentsMap.get(fullKey) || repoLiveDeploymentsMap.get(nameKey) || [];

              return (
                <button
                  key={repo.id}
                  id={`repo-item-${repo.id}`}
                  type="button"
                  onClick={() => onSelectRepo(repo)}
                  className={`w-full text-left p-2 rounded-lg transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-blue-950/60 border-blue-600/70 text-white shadow-xs'
                      : 'bg-slate-900/40 border-transparent hover:bg-slate-900/80 hover:border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="font-semibold text-xs text-slate-200 truncate flex items-center gap-1">
                      {repo.private && <Lock className="w-3 h-3 text-amber-400 shrink-0" />}
                      <span className="truncate">{repo.name}</span>
                    </div>
                    <div className="flex items-center gap-0.5 text-[10px] text-slate-400 font-mono shrink-0">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400/20" />
                      <span>{repo.stargazers_count}</span>
                    </div>
                  </div>

                  {repo.description && (
                    <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 leading-snug">
                      {repo.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                    {repo.language && (
                      <span className="flex items-center gap-1 text-slate-400 font-mono truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"></span>
                        <span className="truncate">{repo.language}</span>
                      </span>
                    )}
                    <span className="text-slate-600">•</span>
                    <span className="truncate">{repo.default_branch}</span>
                  </div>

                  {/* Live Deployed Site Badges */}
                  {repoDeployments.length > 0 ? (
                    <div className="mt-1.5 pt-1.5 border-t border-slate-800/60 flex flex-wrap items-center gap-1">
                      {repoDeployments.slice(0, 2).map((dep) => (
                        <span
                          key={dep.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectRepo(repo);
                            if (onOpenLiveSite) {
                              onOpenLiveSite(dep);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/70 transition-colors cursor-pointer group/live shadow-xs"
                          title={`Click to preview live site: ${dep.url}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                          <span className="font-bold">{dep.provider || 'Live'}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-70 group-hover/live:opacity-100 shrink-0" />
                        </span>
                      ))}
                      {repoDeployments.length > 2 && (
                        <span className="text-[9px] text-emerald-400 font-mono">
                          +{repoDeployments.length - 2}
                        </span>
                      )}
                    </div>
                  ) : repo.homepage ? (
                    <div className="mt-1.5 pt-1.5 border-t border-slate-800/60 flex items-center gap-1">
                      <a
                        href={repo.homepage}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/70 transition-colors"
                        title={`Live Site: ${repo.homepage}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                        <span>Live Site</span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                    </div>
                  ) : repo.has_pages ? (
                    <div className="mt-1.5 pt-1.5 border-t border-slate-800/60 flex items-center gap-1">
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRepo(repo);
                          if (onOpenLiveSite) {
                            const isRoot = repo.name.toLowerCase() === `${repo.owner.login.toLowerCase()}.github.io`;
                            const ghPagesUrl = isRoot
                              ? `https://${repo.owner.login.toLowerCase()}.github.io/`
                              : `https://${repo.owner.login.toLowerCase()}.github.io/${repo.name}/`;
                            onOpenLiveSite({
                              id: `pages-${repo.id}`,
                              repoFullName: repo.full_name,
                              repoName: repo.name,
                              environment: 'GitHub Pages',
                              url: ghPagesUrl,
                              provider: 'GitHub Pages',
                            });
                          }
                        }}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-950/90 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/70 transition-colors cursor-pointer"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shrink-0"></span>
                        <span>GitHub Pages</span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </span>
                    </div>
                  ) : null}
                </button>
              );
            })}

            {/* If 100 loaded and limit wasn't all, offer Load All */}
            {repos.length === 100 && fetchLimit !== 'all' && (
              <div className="p-2 pt-3 text-center">
                <button
                  type="button"
                  onClick={handleLoadAll}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  <span>Load All Repositories ({'>'}100)</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-2.5 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between bg-slate-950">
        <span>
          {filteredRepos.length} / {repos.length} Repos
        </span>
        {username && <span className="font-mono text-slate-400">@{username}</span>}
      </div>
    </div>
  );
}
