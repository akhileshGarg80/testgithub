import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Sparkles,
  ChevronRight,
  FileCode,
  Layers,
  Plus,
  X,
  Search,
  HardDrive,
  Cpu,
  Maximize2,
  Minimize2,
  Trash2,
  Key,
  ShieldCheck,
  Check,
  RotateCcw,
  CheckSquare,
  Square as SquareIcon,
} from 'lucide-react';
import {
  ChatMessage,
  ActiveFile,
  GitHubRepo,
  GitHubTreeItem,
  GEMINI_MODELS,
  DEFAULT_GEMINI_MODEL,
  GeminiModelOption,
} from '../types';
import { ChatInput } from './ChatInput';
import { EmptyState } from './EmptyState';
import { ChatMessageItem } from './ChatMessageItem';
import { getPayloadAnalytics, formatByteSize } from '../utils/tokenCalc';
import { ErrorBoundary } from './ErrorBoundary';

interface ChatPanelProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSendMessage: (
    text: string,
    options?: {
      mode?: 'chat' | 'code';
      includeFile?: boolean;
      useMultiFiles?: boolean;
      selectedFilePaths?: string[];
      model?: string;
    }
  ) => void;
  onStopStreaming: () => void;
  hasKeyReady: boolean;
  onOpenApiKeyModal: () => void;
  activeFile: ActiveFile | null;
  onApplyCodeToFile: (code: string, targetPath?: string) => void;
  onDraftChange: (analytics: ReturnType<typeof getPayloadAnalytics> | null) => void;
  isOpen: boolean;
  onToggle: () => void;
  onClearChat?: () => void;

  // Multi-File selection props
  treeItems: GitHubTreeItem[];
  selectedChatFilePaths: string[];
  onToggleChatFile: (path: string) => void;
  onClearChatFiles: () => void;
  onSelectAllChatFiles: (paths: string[]) => void;
  isMultiFileMode: boolean;
  onToggleMultiFileMode: () => void;

  // Repository context
  selectedRepo: GitHubRepo | null;

  // Gemini Chat Model selection & Custom Models List
  selectedChatModel?: GeminiModelOption;
  onSelectChatModel?: (model: GeminiModelOption) => void;
  availableGeminiModels?: GeminiModelOption[];
  isRepoSidebarOpen?: boolean;
}

export function ChatPanel({
  messages,
  isStreaming,
  onSendMessage,
  onStopStreaming,
  hasKeyReady,
  onOpenApiKeyModal,
  activeFile,
  onApplyCodeToFile,
  onDraftChange,
  isOpen,
  onToggle,
  onClearChat,
  treeItems,
  selectedChatFilePaths,
  onToggleChatFile,
  onClearChatFiles,
  onSelectAllChatFiles,
  isMultiFileMode,
  onToggleMultiFileMode,
  selectedRepo,
  selectedChatModel,
  onSelectChatModel,
  availableGeminiModels,
  isRepoSidebarOpen = true,
}: ChatPanelProps) {
  const [chatMode, setChatMode] = useState<'chat' | 'code'>('chat');
  const [attachFileContext, setAttachFileContext] = useState<boolean>(true);
  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(false);
  const [pickerSearch, setPickerSearch] = useState<string>('');
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Models list (dynamic from custom models or defaults)
  const modelsList = useMemo(() => {
    return availableGeminiModels && availableGeminiModels.length > 0
      ? availableGeminiModels
      : GEMINI_MODELS;
  }, [availableGeminiModels]);

  const activeChatModel = useMemo(() => {
    if (selectedChatModel) {
      const match = modelsList.find((m) => m.id === selectedChatModel.id);
      return match || selectedChatModel;
    }
    return modelsList[0] || DEFAULT_GEMINI_MODEL;
  }, [selectedChatModel, modelsList]);

  const handleChooseChatModel = (model: GeminiModelOption) => {
    onSelectChatModel?.(model);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Filter repository files for the picker dialog
  const repoFilesOnly = useMemo(() => {
    return treeItems.filter((item) => item.type === 'blob');
  }, [treeItems]);

  const filteredPickerFiles = useMemo(() => {
    if (!pickerSearch.trim()) return repoFilesOnly;
    const q = pickerSearch.toLowerCase();
    return repoFilesOnly.filter((f) => f.path.toLowerCase().includes(q));
  }, [repoFilesOnly, pickerSearch]);

  // Calculate estimated tokens for selected files
  const estimatedAttachedTokens = useMemo(() => {
    const totalBytes = selectedChatFilePaths.reduce((acc, path) => {
      const item = treeItems.find((t) => t.path === path);
      return acc + (item?.size || 1000);
    }, 0);
    return Math.round(totalBytes / 4);
  }, [selectedChatFilePaths, treeItems]);

  const totalSessionTokens = useMemo(() => {
    return messages.reduce((acc, msg) => {
      return acc + (msg.tokenUsage ? msg.tokenUsage.totalTokens : msg.inputTokens || 0);
    }, 0);
  }, [messages]);

  const handleSend = (text: string) => {
    onSendMessage(text, {
      mode: chatMode,
      includeFile: !isMultiFileMode && attachFileContext && Boolean(activeFile),
      useMultiFiles: isMultiFileMode && selectedChatFilePaths.length > 0,
      selectedFilePaths: selectedChatFilePaths,
      model: activeChatModel.id,
    });
  };

  if (!isOpen) return null;

  return (
    <ErrorBoundary fallbackTitle="Gemini Chat Panel Error">
      <div
        id="gemini-chat-overlay-panel"
        className={`fixed top-14 bottom-0 right-0 z-40 bg-slate-950 border-l border-blue-500/30 flex flex-col shadow-2xl transition-all duration-200 overflow-hidden ${
          isMaximized || !isRepoSidebarOpen
            ? 'left-0'
            : 'left-0 sm:left-64 md:left-72 lg:left-80'
        }`}
      >
        {/* Top Header Bar (Like GroqPanel: Opens cleanly over the project with zero restrictions) */}
        <div className="p-3 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 via-indigo-500/20 to-sky-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="w-4 h-4 text-blue-400" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                  <span>Gemini AI Studio</span>
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-blue-950/60 border border-blue-500/40 text-blue-300">
                    Google GenAI
                  </span>
                </h2>

                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700/80 text-emerald-400">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>localStorage</span>
                </span>

                <div className="hidden md:flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-400">
                  <Cpu className="w-3 h-3 text-blue-400" />
                  <span>Tokens: {totalSessionTokens.toLocaleString()}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 truncate">
                {selectedRepo ? (
                  <>
                    Working on <span className="text-blue-300 font-mono">@{selectedRepo.full_name}</span>
                    {isMultiFileMode && selectedChatFilePaths.length > 0 && (
                      <span className="text-emerald-400 font-mono ml-1">
                        • {selectedChatFilePaths.length} files attached (~{estimatedAttachedTokens.toLocaleString()} tokens)
                      </span>
                    )}
                  </>
                ) : (
                  'Select a repository to scan or chat freely'
                )}
              </p>
            </div>
          </div>

          {/* Model Switcher & Control Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Dynamic Model Dropdown / Switcher */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 max-w-[260px] sm:max-w-none">
              {modelsList.length <= 4 ? (
                <div className="flex items-center gap-0.5">
                  {modelsList.map((model) => {
                    const isSelected = activeChatModel.id === model.id;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => handleChooseChatModel(model)}
                        className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                        }`}
                        title={`${model.name} - ${model.description}`}
                      >
                        <span className="truncate max-w-[90px]">{model.shortName || model.name}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-1 px-1.5 py-0.5">
                  <Cpu className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <select
                    value={activeChatModel.id}
                    onChange={(e) => {
                      const found = modelsList.find((m) => m.id === e.target.value);
                      if (found) handleChooseChatModel(found);
                    }}
                    className="bg-transparent text-blue-300 text-xs font-semibold focus:outline-none cursor-pointer pr-1 max-w-[150px] sm:max-w-[220px] truncate"
                  >
                    {modelsList.map((m) => (
                      <option key={m.id} value={m.id} className="bg-slate-900 text-slate-200">
                        {m.name} ({m.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Key Config Button */}
            <button
              type="button"
              onClick={onOpenApiKeyModal}
              className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                hasKeyReady
                  ? 'border-emerald-600/50 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50'
                  : 'border-blue-500/50 bg-blue-950/50 text-blue-300 hover:bg-blue-900/50 animate-pulse'
              }`}
              title="Configure API Keys & Add Custom Models"
            >
              <Key className="w-3.5 h-3.5" />
              <span className="hidden xl:inline text-[10px]">
                {hasKeyReady ? 'Models & Keys' : 'Set Key'}
              </span>
            </button>

            {/* Maximize / Dock Button */}
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer hidden sm:flex"
              title={isMaximized ? 'Dock (Show left sidebar)' : 'Maximize across screen'}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Clear Chat Button */}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (onClearChat) {
                    onClearChat();
                  }
                }}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Clear conversation"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onToggle}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Close Gemini Panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Subheader: Context Selector & Mode Bar */}
        <div className="px-3 py-2 border-b border-slate-800/80 bg-slate-900/40 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            {/* Multi-File Mode Selector */}
            <button
              type="button"
              onClick={() => setIsPickerOpen(true)}
              className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>
                Files to Scan ({selectedChatFilePaths.length}/{repoFilesOnly.length})
              </span>
              <span className="text-[10px] text-blue-300 font-mono">
                ~{estimatedAttachedTokens.toLocaleString()} tokens
              </span>
            </button>

            {/* Multi-File Mode Toggle */}
            <button
              type="button"
              onClick={onToggleMultiFileMode}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                isMultiFileMode
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                  : 'bg-slate-900 hover:bg-slate-850 text-slate-400 border border-slate-800'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isMultiFileMode ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></span>
              <span>{isMultiFileMode ? 'Multi-File Active' : 'Single File Mode'}</span>
            </button>

            {/* Active File Context Chip if single-file mode */}
            {!isMultiFileMode && activeFile && (
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 text-[11px] text-slate-300 border border-slate-800 font-mono">
                <FileCode className="w-3 h-3 text-indigo-400" />
                <span className="truncate max-w-[180px]">{activeFile.name}</span>
                <label className="flex items-center gap-1 cursor-pointer ml-1 text-[10px] text-slate-400">
                  <input
                    type="checkbox"
                    checked={attachFileContext}
                    onChange={(e) => setAttachFileContext(e.target.checked)}
                    className="w-3 h-3 rounded accent-blue-500"
                  />
                  <span>include</span>
                </label>
              </div>
            )}
          </div>

          {/* Mode Switch: Chat Q&A vs Code Studio */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setChatMode('chat')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                chatMode === 'chat'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Chat Q&A
            </button>
            <button
              type="button"
              onClick={() => setChatMode('code')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                chatMode === 'code'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Code Studio
            </button>
          </div>
        </div>

        {/* Selected Files Chips Carousel (if any selected) */}
        {selectedChatFilePaths.length > 0 && (
          <div className="px-3 py-1.5 bg-slate-950/80 border-b border-slate-800/60 flex items-center gap-1.5 overflow-x-auto shrink-0 text-xs">
            <span className="text-[10px] text-slate-400 font-medium shrink-0">Attached:</span>
            {selectedChatFilePaths.slice(0, 10).map((path) => (
              <span
                key={path}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-950/70 border border-blue-800/50 text-[10px] font-mono text-blue-200 shrink-0"
              >
                <FileCode className="w-2.5 h-2.5 text-blue-400" />
                <span className="truncate max-w-[140px]">{path.split('/').pop()}</span>
                <button
                  type="button"
                  onClick={() => onToggleChatFile(path)}
                  className="hover:text-rose-300 cursor-pointer ml-0.5"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            {selectedChatFilePaths.length > 10 && (
              <span className="text-[10px] text-slate-400 font-mono shrink-0">
                +{selectedChatFilePaths.length - 10} more
              </span>
            )}
            <button
              type="button"
              onClick={onClearChatFiles}
              className="text-[10px] text-slate-500 hover:text-rose-400 ml-auto shrink-0 cursor-pointer"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Multi-File Context Selector Modal Dialog */}
        {isPickerOpen && (
          <div
            id="gemini-file-picker-overlay"
            className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col p-4 animate-in fade-in duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    Attach Repository Files for AI Context
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Analyze logic, cross-file imports, and architecture in one prompt
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search & Actions Bar */}
            <div className="py-2.5 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Search repository files (e.g. index.ts, App.tsx)..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-slate-400">
                  Showing {filteredPickerFiles.length} of {repoFilesOnly.length} files
                </span>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const allPaths = filteredPickerFiles.map((f) => f.path);
                      onSelectAllChatFiles(allPaths);
                    }}
                    className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                  >
                    Select visible
                  </button>
                  <span className="text-slate-700">•</span>
                  <button
                    type="button"
                    onClick={onClearChatFiles}
                    className="text-slate-400 hover:text-rose-400 cursor-pointer"
                  >
                    Clear selection
                  </button>
                </div>
              </div>
            </div>

            {/* File List Scroll Area */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-900 rounded-xl border border-slate-800/80 bg-slate-900/40 p-1.5">
              {filteredPickerFiles.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No files matching "{pickerSearch}"
                </div>
              ) : (
                filteredPickerFiles.map((file) => {
                  const isSelected = selectedChatFilePaths.includes(file.path);
                  return (
                    <div
                      key={file.path}
                      onClick={() => onToggleChatFile(file.path)}
                      className={`flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-950/50 text-blue-200 border border-blue-800/50'
                          : 'hover:bg-slate-850 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleChatFile(file.path)}
                          className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-blue-500 accent-blue-500 cursor-pointer shrink-0"
                        />
                        <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="text-xs font-mono truncate">{file.path}</span>
                      </div>
                      {typeof file.size === 'number' && (
                        <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-2">
                          {formatByteSize(file.size)}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between mt-3">
              <div className="text-xs text-slate-300">
                <strong className="text-blue-400">{selectedChatFilePaths.length}</strong> files selected
                {selectedChatFilePaths.length > 0 && (
                  <span className="text-slate-500 ml-1">
                    (~{estimatedAttachedTokens.toLocaleString()} tokens)
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-md shadow-blue-600/30"
              >
                Apply Selection
              </button>
            </div>
          </div>
        )}

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {messages.length === 0 ? (
            <EmptyState
              onSelectPrompt={(p) => handleSend(p)}
              hasCustomKey={hasKeyReady}
              onOpenApiKeyModal={onOpenApiKeyModal}
            />
          ) : (
            messages.map((msg, index) => (
              <ChatMessageItem
                key={msg.id || index}
                message={msg}
                isStreaming={isStreaming && index === messages.length - 1}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <ChatInput
          onSendMessage={handleSend}
          isStreaming={isStreaming}
          onStopStreaming={onStopStreaming}
          hasKeyReady={hasKeyReady}
          onOpenApiKeyModal={onOpenApiKeyModal}
          selectedModel={activeChatModel}
          onSelectModel={handleChooseChatModel}
          selectedModelName={activeChatModel.name}
          onDraftChange={onDraftChange}
        />
      </div>
    </ErrorBoundary>
  );
}
