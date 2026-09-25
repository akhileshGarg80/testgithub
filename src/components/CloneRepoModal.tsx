import { useState, useEffect } from 'react';
import {
  GitFork,
  Github,
  X,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  FolderGit2,
  Lock,
  Globe,
  Copy,
  Check,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { GitHubRepo, GitHubTreeItem, GitHubUserProfile } from '../types';
import { cloneRepoToGitHubAccount } from '../services/apiClient';

interface CloneRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRepo: GitHubRepo | null;
  branch: string;
  treeItems: GitHubTreeItem[];
  githubToken: string;
  onSaveGithubToken: (token: string) => void;
  onSuccessClone?: (newRepo: GitHubRepo) => void;
  selfProfile?: GitHubUserProfile | null;
}

export function CloneRepoModal({
  isOpen,
  onClose,
  selectedRepo,
  branch,
  treeItems,
  githubToken,
  onSaveGithubToken,
  onSuccessClone,
  selfProfile,
}: CloneRepoModalProps) {
  const [repoName, setRepoName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [cloneType, setCloneType] = useState<'standalone' | 'fork'>('standalone');

  // Token input inside modal in case not already set
  const [tokenInput, setTokenInput] = useState<string>('');
  const [showTokenInput, setShowTokenInput] = useState<boolean>(false);

  // Execution states
  const [isCloning, setIsCloning] = useState<boolean>(false);
  const [cloningStep, setCloningStep] = useState<string>('');
  const [clonedResult, setClonedResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedCloneCmd, setCopiedCloneCmd] = useState<boolean>(false);

  const isOwnRepo = Boolean(
    selfProfile?.login &&
      selectedRepo?.owner?.login &&
      selfProfile.login.toLowerCase() === selectedRepo.owner.login.toLowerCase()
  );

  useEffect(() => {
    if (selectedRepo) {
      setRepoName(selectedRepo.name);
      setDescription(
        selectedRepo.description
          ? `${selectedRepo.description} (Cloned from ${selectedRepo.full_name})`
          : `Cloned from ${selectedRepo.full_name} via Gemini Chat`
      );
      // If user owns this repo, default to standalone because GitHub disallows self-fork
      if (
        selfProfile?.login &&
        selectedRepo.owner?.login &&
        selfProfile.login.toLowerCase() === selectedRepo.owner.login.toLowerCase()
      ) {
        setCloneType('standalone');
      }
    }
    setTokenInput(githubToken || '');
    setClonedResult(null);
    setError(null);
    setIsCloning(false);
    setCloningStep('');
  }, [selectedRepo, githubToken, selfProfile, isOpen]);

  if (!isOpen) return null;

  const effectiveToken = tokenInput.trim() || githubToken.trim();
  const fileBlobsCount = treeItems.filter((i) => i.type === 'blob').length;

  const handleStartClone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepo) {
      setError('Please select a repository first to clone.');
      return;
    }

    if (!effectiveToken) {
      setShowTokenInput(true);
      setError('Please enter a GitHub Personal Access Token (with repo scope) to clone to your account.');
      return;
    }

    // Save token if updated
    if (tokenInput.trim() && tokenInput.trim() !== githubToken) {
      onSaveGithubToken(tokenInput.trim());
    }

    const cleanName = repoName.trim().replace(/\s+/g, '-');
    if (!cleanName) {
      setError('Repository name is required.');
      return;
    }

    setIsCloning(true);
    setError(null);
    setClonedResult(null);
    setCloningStep(
      cloneType === 'fork'
        ? 'Creating fork on your GitHub account...'
        : 'Connecting to GitHub & creating new repository...'
    );

    try {
      if (cloneType === 'standalone') {
        setCloningStep(`Building file tree for ${fileBlobsCount || 'all'} files & committing...`);
      }

      const result = await cloneRepoToGitHubAccount({
        sourceOwner: selectedRepo.owner.login,
        sourceRepo: selectedRepo.name,
        sourceBranch: branch || 'main',
        targetRepoName: cleanName,
        targetDescription: description.trim(),
        isPrivate,
        cloneType,
        token: effectiveToken,
      });

      setClonedResult(result);
      setCloningStep('');
    } catch (err: any) {
      setError(err.message || 'Failed to clone repository. Please check your GitHub token permissions.');
    } finally {
      setIsCloning(false);
    }
  };

  const handleCopyCloneCmd = (cloneUrl: string) => {
    navigator.clipboard.writeText(`git clone ${cloneUrl}`);
    setCopiedCloneCmd(true);
    setTimeout(() => setCopiedCloneCmd(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div
        id="clone-repo-modal-card"
        className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700/80 p-5 sm:p-6 shadow-2xl text-slate-100 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
      >
        {/* Close Button */}
        <button
          id="close-clone-modal-btn"
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer z-10"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-800 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
            <GitFork className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Clone to My GitHub</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 text-[10px] font-mono border border-indigo-700/60">
                GitHub API
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Export and push this repository directly to your personal GitHub account
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {/* Source Repo Card */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FolderGit2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[11px] text-slate-400 block">Source Repository:</span>
                <span className="text-xs font-mono font-semibold text-slate-200 truncate block">
                  {selectedRepo ? selectedRepo.full_name : 'No repo selected'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                branch: {branch}
              </span>
              {fileBlobsCount > 0 && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {fileBlobsCount} files
                </span>
              )}
            </div>
          </div>

          {/* GitHub Token Connection Status */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <Github className="w-4 h-4 text-slate-300" />
                <span className="font-semibold text-slate-200">GitHub Authentication</span>
              </div>
              {effectiveToken ? (
                <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Token Active</span>
                  <button
                    type="button"
                    onClick={() => setShowTokenInput(!showTokenInput)}
                    className="text-slate-400 hover:text-slate-200 underline ml-1 cursor-pointer text-[10px]"
                  >
                    {showTokenInput ? 'Hide' : 'Change'}
                  </button>
                </div>
              ) : (
                <span className="text-amber-400 text-[11px] font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>Token Required</span>
                </span>
              )}
            </div>

            {(!effectiveToken || showTokenInput) && (
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <label className="text-[11px] text-slate-400 block">
                  GitHub Personal Access Token (PAT) with <code className="text-amber-300 font-mono">repo</code> scope:
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=Gemini+Chat+IDE"
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-medium flex items-center gap-1 shrink-0 border border-slate-700"
                  >
                    <span>Generate PAT</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Success Screen */}
          {clonedResult && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-700/60 space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Successfully Cloned to Your GitHub!</span>
              </div>

              <p className="text-xs text-emerald-200/90 leading-relaxed">
                {clonedResult.message || `Repository created at ${clonedResult.repo?.full_name}`}
              </p>

              {clonedResult.repo && (
                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-emerald-800/40 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-200 font-semibold truncate">
                      {clonedResult.repo.full_name}
                    </span>
                    <a
                      href={clonedResult.repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold text-[11px]"
                    >
                      <span>Open on GitHub</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {clonedResult.repo.clone_url && (
                    <div className="flex items-center justify-between gap-2 p-1.5 rounded bg-slate-900 font-mono text-[11px] text-slate-300">
                      <span className="truncate">git clone {clonedResult.repo.clone_url}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyCloneCmd(clonedResult.repo.clone_url)}
                        className="text-slate-400 hover:text-white p-1 shrink-0 cursor-pointer"
                        title="Copy Git Clone Command"
                      >
                        {copiedCloneCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                {onSuccessClone && clonedResult.repo && (
                  <button
                    type="button"
                    onClick={() => {
                      onSuccessClone(clonedResult.repo);
                      onClose();
                    }}
                    className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>Open in Gemini Chat IDE</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Form when not completed */}
          {!clonedResult && (
            <form onSubmit={handleStartClone} className="space-y-3.5">
              {/* Target Repo Name */}
              <div>
                <label className="text-xs font-semibold text-slate-200 block mb-1">
                  Target Repository Name <span className="text-rose-400">*</span>
                </label>
                <input
                  id="target-repo-name-input"
                  type="text"
                  required
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value.replace(/\s+/g, '-'))}
                  placeholder="my-new-repo"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-600 text-xs font-mono focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Will be created as <code className="text-indigo-300 font-mono">your-username/{repoName || 'my-new-repo'}</code>
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-slate-200 block mb-1">
                  Description <span className="text-slate-500 text-[10px]">(Optional)</span>
                </label>
                <textarea
                  id="target-repo-desc-input"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Repository description..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-600 text-xs focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Clone Mode Selection */}
              <div>
                <label className="text-xs font-semibold text-slate-200 block mb-1.5">
                  Clone Strategy
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    onClick={() => setCloneType('standalone')}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                      cloneType === 'standalone'
                        ? 'bg-indigo-950/50 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500/50'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs mb-0.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Standalone Clone</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Creates fresh independent repo with all files pushed cleanly (Guaranteed to work)
                    </p>
                  </div>

                  <div
                    onClick={() => setCloneType('fork')}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                      cloneType === 'fork'
                        ? 'bg-indigo-950/50 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500/50'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs mb-0.5">
                      <GitFork className="w-3.5 h-3.5 text-indigo-400" />
                      <span>GitHub Fork</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Forks directly on GitHub preserving full upstream commit history
                    </p>
                  </div>
                </div>

                {/* Warning if user attempts to fork their own repo */}
                {cloneType === 'fork' && isOwnRepo && (
                  <div className="mt-2 p-2.5 rounded-xl bg-amber-950/50 border border-amber-800/60 text-amber-200 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block">Notice: Apna repo khud fork nahi ho sakta</span>
                      <span className="text-[11px] text-amber-300/90 leading-tight block">
                        GitHub apne personal account ka repository usi account me fork karne par <strong>404 error</strong> deta hai. Kripya <strong>Standalone Clone</strong> select karein.
                      </span>
                      <button
                        type="button"
                        onClick={() => setCloneType('standalone')}
                        className="mt-1.5 text-xs text-white font-semibold underline hover:text-amber-100 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Switch to Standalone Clone abhi</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Visibility Options */}
              <div>
                <label className="text-xs font-semibold text-slate-200 block mb-1.5">
                  Visibility
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    onClick={() => setIsPrivate(false)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-2 ${
                      !isPrivate
                        ? 'bg-blue-950/40 border-blue-500 text-blue-200'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Globe className="w-4 h-4 text-blue-400 shrink-0" />
                    <div>
                      <span className="font-semibold text-xs block">Public</span>
                      <span className="text-[10px] text-slate-400 block">Anyone can see</span>
                    </div>
                  </div>

                  <div
                    onClick={() => setIsPrivate(true)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-2 ${
                      isPrivate
                        ? 'bg-blue-950/40 border-blue-500 text-blue-200'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <span className="font-semibold text-xs block">Private</span>
                      <span className="text-[10px] text-slate-400 block">Only you can see</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Error Box with 404 Explanation & 1-Click Fallback */}
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs space-y-2.5 animate-in fade-in">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span className="leading-snug font-medium">{error}</span>
                  </div>

                  {(error.includes('404') || cloneType === 'fork') && (
                    <div className="pt-2 border-t border-rose-900/60 text-[11px] text-rose-300/90 space-y-2">
                      <p className="font-bold text-amber-300 flex items-center gap-1.5">
                        <span>💡 GitHub Fork me 404 Error aane ke 3 mukhya kaaran:</span>
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-slate-300 pl-1 leading-relaxed">
                        <li>
                          <strong>1. Self-Forking ban:</strong> Agar aap <em>{selectedRepo?.full_name}</em> ke owner hain, to GitHub personal account me apna hi repo fork karne par 404 return karta hai.
                        </li>
                        <li>
                          <strong>2. Private Repository:</strong> Agar repository private hai to aapke token me <code className="text-amber-300 font-mono">repo</code> scope hona anivarya hai.
                        </li>
                        <li>
                          <strong>3. Forking Disabled:</strong> Repository setting me "Allow forking" band hone par GitHub 404 deta hai.
                        </li>
                      </ul>

                      <button
                        type="button"
                        onClick={() => {
                          setCloneType('standalone');
                          setError(null);
                        }}
                        className="w-full mt-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-95"
                      >
                        <Layers className="w-4 h-4" />
                        <span>👉 Switch to "Standalone Clone" (Works 100% without 404)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Loading Indicator */}
              {isCloning && (
                <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-700/60 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>{cloningStep || 'Cloning and pushing repository to your GitHub...'}</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full animate-pulse w-3/4 rounded-full"></div>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isCloning}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="submit-clone-repo-btn"
                  type="submit"
                  disabled={isCloning || !repoName.trim() || !selectedRepo}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                >
                  {isCloning ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Cloning...</span>
                    </>
                  ) : (
                    <>
                      <GitFork className="w-3.5 h-3.5" />
                      <span>Create & Push to My GitHub</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
