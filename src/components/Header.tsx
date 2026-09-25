import {
  Sparkles,
  Key,
  Plus,
  Trash2,
  Download,
  ShieldCheck,
  AlertTriangle,
  Cpu,
  FolderGit2,
  FolderTree,
  FileCode,
  MessageSquare,
  Github,
  GitCommit,
  GitFork,
  Globe,
  Sun,
  Moon,
  UploadCloud,
  User,
  Zap,
} from 'lucide-react';
import { FIXED_MODEL, GeminiModelOption, GitHubUserProfile } from '../types';

export type MobilePaneType = 'repos' | 'files' | 'code' | 'chat' | 'groq' | 'live' | 'activity';

interface HeaderProps {
  hasCustomKey: boolean;
  hasEnvKeyFallback: boolean;
  hasGithubToken: boolean;
  hasGroqKey?: boolean;
  hasGroqEnvFallback?: boolean;
  onOpenApiKeyModal: () => void;
  onNewChat: () => void;
  onDeleteChat: () => void;
  onExportChat: () => void;
  messageCount: number;
  isTokenSidebarOpen: boolean;
  onToggleTokenSidebar: () => void;
  totalTokensCount: number;
  isRepoSidebarOpen: boolean;
  onToggleRepoSidebar: () => void;
  isFileSidebarOpen: boolean;
  onToggleFileSidebar: () => void;
  isCodeWorkspaceOpen: boolean;
  onToggleCodeWorkspace: () => void;
  isChatOpen: boolean;
  onToggleChat: () => void;
  isActivityPanelOpen: boolean;
  onToggleActivityPanel: () => void;
  isLiveSitesOpen: boolean;
  onToggleLiveSites: () => void;
  isGroqOpen?: boolean;
  onToggleGroq?: () => void;
  onSelectMobilePane?: (pane: MobilePaneType) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  selectedModel?: GeminiModelOption;
  selectedRepoName?: string | null;
  onOpenCloneModal?: () => void;
  onOpenSyncModal?: () => void;
  isModified?: boolean;
  onOpenSelfModal?: () => void;
  selfProfile?: GitHubUserProfile | null;
  liveSitesCount?: number;
  isScanningLiveSites?: boolean;
}

export function Header({
  hasCustomKey,
  hasEnvKeyFallback,
  hasGithubToken,
  hasGroqKey = false,
  hasGroqEnvFallback = false,
  onOpenApiKeyModal,
  onNewChat,
  onDeleteChat,
  onExportChat,
  messageCount,
  isTokenSidebarOpen,
  onToggleTokenSidebar,
  totalTokensCount,
  isRepoSidebarOpen,
  onToggleRepoSidebar,
  isFileSidebarOpen,
  onToggleFileSidebar,
  isCodeWorkspaceOpen,
  onToggleCodeWorkspace,
  isChatOpen,
  onToggleChat,
  isActivityPanelOpen,
  onToggleActivityPanel,
  isLiveSitesOpen,
  onToggleLiveSites,
  isGroqOpen = false,
  onToggleGroq,
  onSelectMobilePane,
  theme,
  onToggleTheme,
  selectedModel,
  selectedRepoName,
  onOpenCloneModal,
  onOpenSyncModal,
  isModified,
  onOpenSelfModal,
  selfProfile,
  liveSitesCount = 0,
  isScanningLiveSites = false,
}: HeaderProps) {
  const activeModel = selectedModel || FIXED_MODEL;
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md px-2.5 sm:px-4 py-2">
      <div className="flex items-center justify-between gap-2">
        {/* Left: Brand & Panel Toggles */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight">Gemini Chat</h1>
              {/* Dynamic Model Badge */}
              <div
                id="active-model-header-badge"
                className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-950/70 border border-indigo-700/60 text-indigo-300 text-[11px] font-semibold"
                title={`Active Model: ${activeModel.name}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{activeModel.name}</span>
              </div>
            </div>
          </div>

          {/* Desktop Panel Toggle Icons */}
          <div className="hidden md:flex items-center gap-1 ml-1 sm:ml-2 pl-2 border-l border-slate-800">
            {/* 1. Repos Panel Toggle */}
            <button
              type="button"
              onClick={onToggleRepoSidebar}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isRepoSidebarOpen
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="Toggle GitHub Repos Panel"
            >
              <FolderGit2 className="w-3.5 h-3.5" />
            </button>

            {/* 2. Files Panel Toggle */}
            <button
              type="button"
              onClick={onToggleFileSidebar}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isFileSidebarOpen
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="Toggle Files & Folders Tree Panel"
            >
              <FolderTree className="w-3.5 h-3.5" />
            </button>

            {/* 3. Code Workspace Toggle */}
            <button
              id="top-nav-toggle-code-workspace"
              type="button"
              onClick={onToggleCodeWorkspace}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isCodeWorkspaceOpen
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="Toggle Center Code Workspace & Editor"
            >
              <FileCode className="w-3.5 h-3.5" />
            </button>

            {/* 4. Chat Panel Toggle */}
            <button
              type="button"
              onClick={onToggleChat}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isChatOpen
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="Toggle AI Chat & Code Studio Panel"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>

            {/* 5. Live Activity Toggle */}
            <button
              type="button"
              onClick={onToggleActivityPanel}
              className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                isActivityPanelOpen
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="Toggle Right GitHub Live Activity (Commits, Diffs, PRs, Issues)"
            >
              <GitCommit className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden xl:inline text-[11px]">Live Activity</span>
            </button>

            {/* 6. Live Sites & Production URLs Toggle */}
            <button
              id="top-nav-live-sites-btn"
              type="button"
              onClick={onToggleLiveSites}
              className={`px-2 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                isLiveSitesOpen
                  ? 'bg-sky-600/25 text-sky-300 border border-sky-500/40 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800/80 bg-slate-900/60'
              }`}
              title="Live Sites, Production Deployments & Ultra-Fast Web Runner"
            >
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[11px] font-semibold text-slate-200">Live Sites</span>
              {liveSitesCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 font-bold font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  {liveSitesCount}
                </span>
              ) : isScanningLiveSites ? (
                <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.2 rounded bg-sky-950/80 text-sky-300 border border-sky-800/60 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping"></span>
                  Scanning
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center text-[9px] px-1 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-mono">
                  Fast
                </span>
              )}
            </button>

            {/* 7. Groq AI Studio Overlay Toggle */}
            {onToggleGroq && (
              <button
                id="top-nav-groq-btn"
                type="button"
                onClick={onToggleGroq}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                  isGroqOpen
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white border border-amber-400/60 shadow-amber-600/30 shadow-md ring-1 ring-amber-400/40'
                    : 'text-amber-300 hover:text-white hover:bg-amber-950/60 border border-amber-600/40 bg-amber-950/30'
                }`}
                title="Groq AI Chat & Full Repo Scanner (Llama 3.1 & 3.3 Instant)"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
                <span>Groq</span>
                <span className="hidden lg:inline-flex text-[9px] px-1 py-0.2 rounded bg-amber-900/80 text-amber-200 font-mono">
                  Llama 3.3
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Center/Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Light / Dark Mode Toggle */}
          <button
            id="theme-toggle-btn"
            type="button"
            onClick={onToggleTheme}
            className="p-1.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-amber-400 hover:border-slate-700 transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
            )}
          </button>

          {/* Self Account Button in Header */}
          {onOpenSelfModal && (
            <button
              id="top-nav-self-account-btn"
              type="button"
              onClick={onOpenSelfModal}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-xs ${
                selfProfile
                  ? 'bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-200 border-indigo-700/60'
                  : hasGithubToken
                  ? 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
                  : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border-indigo-500/40'
              }`}
              title="Apna GitHub Account (Self Mode) - Load personal repos and push directly"
            >
              {selfProfile?.avatar_url ? (
                <img src={selfProfile.avatar_url} alt="" className="w-3.5 h-3.5 rounded-full" />
              ) : (
                <User className="w-3.5 h-3.5 text-indigo-400" />
              )}
              <span className="hidden sm:inline">
                {selfProfile ? `@${selfProfile.login}` : 'Self'}
              </span>
              <span className="sm:hidden">Self</span>
            </button>
          )}

          {/* "Sync to GitHub" (Direct Push) Button in Top Nav */}
          {onOpenSyncModal && (
            <button
              id="top-nav-sync-repo-btn"
              type="button"
              onClick={onOpenSyncModal}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-xs active:scale-95 cursor-pointer ${
                isModified
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-400/60 animate-pulse shadow-md shadow-emerald-600/30'
                  : 'bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 hover:text-emerald-100 border-emerald-800/60'
              }`}
              title="Sync & push changes directly to GitHub repository with commit comment"
            >
              <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline font-semibold">Sync to GitHub</span>
              <span className="sm:hidden">Sync</span>
              {isModified && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-ping"></span>
              )}
            </button>
          )}

          {/* "Clone to My GitHub" Button in Top Nav */}
          {onOpenCloneModal && (
            <button
              id="top-nav-clone-repo-btn"
              type="button"
              onClick={onOpenCloneModal}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 transition-all shadow-xs active:scale-95 cursor-pointer"
              title="Fork or clone repository directly into your own GitHub account"
            >
              <GitFork className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Fork / Clone</span>
              <span className="sm:hidden">Clone</span>
            </button>
          )}

          {/* Key Settings Button */}
          <button
            id="api-key-settings-btn"
            type="button"
            onClick={onOpenApiKeyModal}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
              hasCustomKey || hasGithubToken || hasGroqKey
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/60'
                : hasEnvKeyFallback || hasGroqEnvFallback
                ? 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                : 'bg-amber-950/60 text-amber-300 border-amber-700/60 hover:bg-amber-900/60 animate-pulse'
            }`}
            title="Configure API Keys & GitHub Tokens (Gemini, Groq, GitHub PAT)"
          >
            <Key className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">API Keys</span>
            {(hasCustomKey || hasGithubToken || hasGroqKey) && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            )}
          </button>

          {/* New Chat Button */}
          <button
            id="new-chat-btn"
            type="button"
            onClick={onNewChat}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-sm shadow-blue-600/30 cursor-pointer"
            title="Start a new chat session"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Chat</span>
          </button>

          {/* Delete chat history */}
          {messageCount > 0 && (
            <button
              id="delete-chat-history-btn"
              type="button"
              onClick={onDeleteChat}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Clear conversation history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Export chat history */}
          {messageCount > 0 && (
            <button
              id="export-chat-history-btn"
              type="button"
              onClick={onExportChat}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors hidden sm:flex items-center justify-center cursor-pointer"
              title="Export conversation as Markdown"
            >
              <Download className="w-4 h-4" />
            </button>
          )}

          {/* Toggle Token Sidebar button */}
          <button
            id="toggle-token-sidebar-btn"
            type="button"
            onClick={onToggleTokenSidebar}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all border cursor-pointer ${
              isTokenSidebarOpen
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
            title="Toggle Token Counter Sidebar"
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-mono text-[11px] hidden sm:inline">
              {totalTokensCount > 0 ? `${totalTokensCount.toLocaleString()} t` : 'Tokens'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Exclusive Navigation Tab Bar: Single active selection ensures full width display */}
      <div className="md:hidden flex items-center gap-1 overflow-x-auto no-scrollbar pt-2 mt-1.5 border-t border-slate-800/80">
        <button
          type="button"
          onClick={() => onSelectMobilePane?.('repos')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
            isRepoSidebarOpen
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
          title="Repositories"
        >
          <FolderGit2 className="w-3.5 h-3.5" />
          <span>Repos</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectMobilePane?.('files')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
            isFileSidebarOpen
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
          title="Files & Folders"
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span>Files</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectMobilePane?.('code')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
            isCodeWorkspaceOpen
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
          title="Code Editor"
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Code</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectMobilePane?.('groq')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
            isGroqOpen
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-xs'
              : 'bg-amber-950/50 text-amber-300 border border-amber-800/60'
          }`}
          title="Groq AI Chat & Repo Scanner"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Groq</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectMobilePane?.('chat')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
            isChatOpen
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
          title="Gemini Chat"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Gemini</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectMobilePane?.('live')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
            isLiveSitesOpen
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
          title="Live Sites"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Live</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectMobilePane?.('activity')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
            isActivityPanelOpen
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
          title="Activity"
        >
          <GitCommit className="w-3.5 h-3.5" />
          <span>Activity</span>
        </button>
      </div>
    </header>
  );
}
