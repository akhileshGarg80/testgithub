import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Zap,
  X,
  Sparkles,
  FileCode,
  CheckSquare,
  Square,
  Lock,
  Layers,
  Send,
  Square as StopSquare,
  Copy,
  Check,
  Download,
  Trash2,
  Cpu,
  Search,
  BookOpen,
  ShieldAlert,
  Compass,
  Code2,
  Maximize2,
  Minimize2,
  AlertCircle,
  Key,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  GroqChatMessage,
  GroqModelId,
  GroqModelOption,
  GROQ_MODELS,
  DEFAULT_GROQ_MODEL,
  GitHubRepo,
  GitHubTreeItem,
  ActiveFile,
} from '../types';
import { streamGroqChat } from '../services/apiClient';
import { estimateTokens, formatByteSize } from '../utils/tokenCalc';
import { isGroqExemptFile, getGroqExemptReason } from '../utils/groqExclusions';
import { ErrorBoundary } from './ErrorBoundary';

interface GroqPanelProps {
  isOpen: boolean;
  onClose: () => void;
  repo: GitHubRepo | null;
  treeItems: GitHubTreeItem[];
  branch: string;
  groqApiKey: string;
  hasGroqEnvFallback?: boolean;
  onOpenApiKeyModal: () => void;
  onSaveGroqApiKey?: (key: string) => void;
  activeFile: ActiveFile | null;
  onOpenFileInEditor?: (path: string) => void;
  onApplyCodeToFile?: (code: string, targetPath?: string) => void;
  isRepoSidebarOpen?: boolean;
  availableGroqModels?: GroqModelOption[];
}

function GroqCodeBlock({
  className,
  children,
  onApplyCodeToFile,
}: {
  className?: string;
  children?: React.ReactNode;
  onApplyCodeToFile?: (code: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const textContent = String(children || '').replace(/\n$/, '');
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="my-2.5 rounded-lg overflow-hidden border border-slate-800 bg-slate-950 font-mono text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400">
        <span className="text-amber-400 font-semibold">{lang || 'code'}</span>
        <div className="flex items-center gap-2">
          {onApplyCodeToFile && (
            <button
              type="button"
              onClick={() => onApplyCodeToFile(textContent)}
              className="text-amber-300 hover:text-amber-200 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60 hover:bg-amber-900/60 flex items-center gap-1 cursor-pointer transition-colors text-[10px]"
              title="Apply this code to currently active file"
            >
              Apply to File
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="hover:text-white text-slate-400 flex items-center gap-1 cursor-pointer transition-colors py-0.5 px-1.5 rounded hover:bg-slate-800"
            title="Copy code"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
      <pre className="p-3 overflow-x-auto text-slate-200 leading-relaxed text-xs">
        <code>{textContent}</code>
      </pre>
    </div>
  );
}

export function GroqPanel({
  isOpen,
  onClose,
  repo,
  treeItems,
  branch,
  groqApiKey,
  hasGroqEnvFallback = false,
  onOpenApiKeyModal,
  onSaveGroqApiKey,
  activeFile,
  onOpenFileInEditor,
  onApplyCodeToFile,
  isRepoSidebarOpen = true,
  availableGroqModels,
}: GroqPanelProps) {
  const groqModelsList = useMemo(() => {
    return availableGroqModels && availableGroqModels.length > 0
      ? availableGroqModels
      : GROQ_MODELS;
  }, [availableGroqModels]);

  // Model selection (default to first available model)
  const [selectedModelId, setSelectedModelId] = useState<GroqModelId>(() => {
    return groqModelsList[0]?.id || 'llama-3.3-70b-versatile';
  });

  // In-panel Groq API key (pure localStorage, no .env required)
  const [localGroqKey, setLocalGroqKey] = useState<string>(() => {
    return (
      groqApiKey ||
      localStorage.getItem('groq_chat_api_key') ||
      localStorage.getItem('groq_api_key') ||
      ''
    );
  });
  const [keyInputValue, setKeyInputValue] = useState('');
  const [isKeyConfigOpen, setIsKeyConfigOpen] = useState(false);

  useEffect(() => {
    if (groqApiKey) {
      setLocalGroqKey(groqApiKey);
    } else {
      const stored =
        localStorage.getItem('groq_chat_api_key') ||
        localStorage.getItem('groq_api_key') ||
        '';
      setLocalGroqKey(stored);
    }
  }, [groqApiKey]);

  // Safe load of messages from localStorage (filters invalid items)
  const [messages, setMessages] = useState<GroqChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('groq_chat_history');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((m) => m && typeof m.content === 'string')
        .map((m) => ({
          ...m,
          timestamp: typeof m.timestamp === 'number' && !isNaN(m.timestamp) ? m.timestamp : Date.now(),
          tokenCount: typeof m.tokenCount === 'number' ? m.tokenCount : 0,
        }));
    } catch {
      return [];
    }
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [currentPromptTokens, setCurrentPromptTokens] = useState<number>(0);
  const [currentOutputTokens, setCurrentOutputTokens] = useState<number>(0);

  // File selection for repo scan
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [fileFilterSearch, setFileFilterSearch] = useState('');
  const [isFileSelectorExpanded, setIsFileSelectorExpanded] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Filter eligible source code files (exclude node_modules, lock files, binary files)
  const fileAnalysis = useMemo(() => {
    const safeItems = Array.isArray(treeItems) ? treeItems : [];
    const blobs = safeItems.filter((item) => item && item.type === 'blob' && typeof item.path === 'string');
    const eligible: GitHubTreeItem[] = [];
    const excluded: { item: GitHubTreeItem; reason: string }[] = [];

    blobs.forEach((item) => {
      if (isGroqExemptFile(item.path)) {
        excluded.push({ item, reason: getGroqExemptReason(item.path) || 'Ignored by default' });
      } else {
        eligible.push(item);
      }
    });

    return { blobs, eligible, excluded };
  }, [treeItems]);

  const filteredItems = useMemo(() => {
    const q = fileFilterSearch.trim().toLowerCase();
    const blobs = fileAnalysis.blobs;
    if (!q) return blobs;
    return blobs.filter((item) => item && item.path && item.path.toLowerCase().includes(q));
  }, [fileAnalysis.blobs, fileFilterSearch]);

  // Default selection: when a repo loads or on initial open, auto-select all eligible files
  useEffect(() => {
    if (fileAnalysis.eligible.length > 0 && selectedPaths.length === 0) {
      const defaultPaths = fileAnalysis.eligible.slice(0, 30).map((f) => f.path);
      setSelectedPaths(defaultPaths);
    }
  }, [fileAnalysis.eligible, repo?.id]);

  // Persist messages safely
  useEffect(() => {
    try {
      localStorage.setItem('groq_chat_history', JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Auto-scroll on new streaming chunks
  useEffect(() => {
    if (isStreaming || messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContent, isStreaming]);

  // Calculate live tokens for selected files
  const liveSelectedTokens = useMemo(() => {
    if (!selectedPaths.length) return 0;
    const safeItems = Array.isArray(treeItems) ? treeItems : [];
    const totalBytes = selectedPaths.reduce((sum, p) => {
      const item = safeItems.find((t) => t && t.path === p);
      return sum + (item?.size || 1500);
    }, 0);
    return Math.round(totalBytes / 3.8);
  }, [selectedPaths, treeItems]);

  // Calculate live input prompt tokens
  const liveInputTokens = useMemo(() => {
    return estimateTokens(inputPrompt);
  }, [inputPrompt]);

  // Total session tokens consumed
  const totalSessionTokens = useMemo(() => {
    return messages.reduce((acc, m) => acc + (m.tokenCount || 0), 0);
  }, [messages]);

  // Safe date formatting helper (never throws)
  const formatTimestamp = (ts?: number) => {
    if (!ts || isNaN(Number(ts))) return '';
    try {
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const currentModel =
    groqModelsList.find((m) => m.id === selectedModelId) || groqModelsList[0] || DEFAULT_GROQ_MODEL;
  const effectiveKey = (localGroqKey || groqApiKey || '').trim();
  const hasKeyReady = Boolean(effectiveKey);

  const handleSaveLocalKey = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = keyInputValue.trim();
    if (!clean) return;
    setLocalGroqKey(clean);
    localStorage.setItem('groq_chat_api_key', clean);
    localStorage.setItem('groq_api_key', clean);
    if (onSaveGroqApiKey) {
      onSaveGroqApiKey(clean);
    }
    setKeyInputValue('');
    setIsKeyConfigOpen(false);
  };

  const handleClearLocalKey = () => {
    setLocalGroqKey('');
    localStorage.removeItem('groq_chat_api_key');
    localStorage.removeItem('groq_api_key');
    if (onSaveGroqApiKey) {
      onSaveGroqApiKey('');
    }
  };

  const handleToggleFile = (path: string) => {
    if (isGroqExemptFile(path)) return;
    setSelectedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const handleSelectAllEligible = () => {
    setSelectedPaths(fileAnalysis.eligible.map((f) => f.path));
  };

  const handleClearSelection = () => {
    setSelectedPaths([]);
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleDownloadDoc = (title: string, text: string) => {
    const filename = `${title.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.md`;
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  const executeGroqScan = async (promptText: string, isDocRequest = false) => {
    if (!promptText.trim()) return;

    if (!effectiveKey) {
      setIsKeyConfigOpen(true);
      return;
    }

    const userMsgId = `user_${Date.now()}`;
    const userTokensEst = estimateTokens(promptText) + liveSelectedTokens;

    const userMessage: GroqChatMessage = {
      id: userMsgId,
      role: 'user',
      content: promptText,
      timestamp: Date.now(),
      tokenCount: userTokensEst,
      modelUsed: currentModel.id,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    setIsStreaming(true);
    setStreamingContent('');
    setCurrentPromptTokens(userTokensEst);
    setCurrentOutputTokens(0);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let filesContext = '';
    if (selectedPaths.length > 0 && repo) {
      filesContext = `\n\n### SELECTED REPOSITORY FILES CONTEXT (${selectedPaths.length} files included):\n`;
      filesContext += selectedPaths.map((p) => `- ${p}`).join('\n');
      filesContext += '\n\n';
    }

    const systemInstruction = `You are an elite Staff Software Engineer, Systems Architect, and Technical Writer powered by Groq's high-speed inference (${currentModel.name}).
You are analyzing the GitHub repository "${repo ? repo.full_name : 'Current Project'}" on branch "${branch}".

Your instructions:
1. Provide highly structured, visually attractive, and publication-ready documentation.
2. Use markdown formatting with clear headings, badges, bullet points, ASCII system architecture flowcharts, and exact syntax-highlighted code blocks.
3. If asked to generate docs ("ek docs banao", "docs", "documentation"), provide:
   - Project Name & Executive Summary
   - Tech Stack & Key Dependencies
   - Architecture & Directory Layout (ASCII Tree)
   - Detailed File-by-File Breakdown for all selected files
   - Step-by-Step Local Setup and Production Deployment Guide
4. Emphasize speed, code correctness, and clean explanations. Avoid marketing buzzwords.`;

    const fullPrompt = `${promptText}${filesContext}`;

    const apiMessages: Array<{ role: string; content: string }> = [];
    messages.slice(-6).forEach((m) => {
      apiMessages.push({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      });
    });
    apiMessages.push({ role: 'user', content: fullPrompt });

    let accumulatedText = '';

    try {
      await streamGroqChat({
        messages: apiMessages,
        apiKey: effectiveKey,
        model: currentModel.id,
        systemInstruction,
        signal: abortController.signal,
        onChunk: (chunk) => {
          accumulatedText += chunk;
          setStreamingContent(accumulatedText);
          setCurrentOutputTokens(estimateTokens(accumulatedText));
        },
        onUsage: (usage) => {
          if (usage.candidatesTokens) setCurrentOutputTokens(usage.candidatesTokens);
        },
      });

      const assistantMsg: GroqChatMessage = {
        id: `groq_ast_${Date.now()}`,
        role: 'assistant',
        content: accumulatedText,
        timestamp: Date.now(),
        tokenCount: estimateTokens(accumulatedText),
        modelUsed: currentModel.id,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingContent('');
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const errorContent = `Groq Error: ${err.message || 'Failed to complete Groq request.'}\n\nPlease verify your Groq API key in localStorage. You can obtain a free key at https://console.groq.com/keys`;
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: 'assistant',
            content: errorContent,
            timestamp: Date.now(),
            tokenCount: estimateTokens(errorContent),
            modelUsed: currentModel.id,
          },
        ]);
      }
      setStreamingContent('');
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  if (!isOpen) return null;

  return (
    <ErrorBoundary fallbackTitle="Groq Panel Error">
      <div
        id="groq-chat-overlay-panel"
        className={`fixed top-14 bottom-0 right-0 z-40 bg-slate-950 border-l border-amber-500/30 flex flex-col shadow-2xl transition-all duration-200 overflow-hidden ${
          isMaximized || !isRepoSidebarOpen
            ? 'left-0'
            : 'left-0 sm:left-64 md:left-72 lg:left-80'
        }`}
      >
        {/* Top Header Bar */}
        <div className="p-3 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 shadow-sm">
              <Zap className="w-4 h-4 text-amber-400" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                  <span>Groq AI Studio</span>
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300">
                    Ultra Fast
                  </span>
                </h2>

                {/* Storage badge (localStorage) */}
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700/80 text-emerald-400">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>localStorage</span>
                </span>

                {/* Live Session Tokens */}
                <div className="hidden md:flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-400">
                  <Cpu className="w-3 h-3 text-amber-400" />
                  <span>Session: {totalSessionTokens.toLocaleString()} tokens</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 truncate">
                {repo ? (
                  <>
                    Scanning <span className="text-amber-300 font-mono">@{repo.full_name}</span> ({selectedPaths.length}/{fileAnalysis.eligible.length} files selected • ~{liveSelectedTokens.toLocaleString()} tokens)
                  </>
                ) : (
                  'Select a repository from the left panel to scan'
                )}
              </p>
            </div>
          </div>

          {/* Model Switcher & Control Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Model Toggle Buttons / Select */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              {groqModelsList.length <= 3 ? (
                groqModelsList.map((model) => {
                  const isSelected = selectedModelId === model.id;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => setSelectedModelId(model.id)}
                      className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                      }`}
                      title={`${model.name} (${model.speed}) - ${model.description}`}
                    >
                      <span>{model.shortName || model.name}</span>
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                          isSelected ? 'bg-amber-700 text-amber-100' : 'text-slate-500'
                        }`}
                      >
                        {model.speed}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="flex items-center gap-1 px-1.5 py-0.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <select
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    className="bg-transparent text-amber-300 text-xs font-semibold focus:outline-none cursor-pointer pr-1 max-w-[140px] sm:max-w-[200px] truncate"
                  >
                    {groqModelsList.map((m) => (
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
              onClick={() => setIsKeyConfigOpen(!isKeyConfigOpen)}
              className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                hasKeyReady
                  ? 'border-emerald-600/50 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50'
                  : 'border-amber-500/50 bg-amber-950/50 text-amber-300 hover:bg-amber-900/50 animate-pulse'
              }`}
              title={hasKeyReady ? 'Groq Key Active in localStorage (Click to edit)' : 'Enter Groq API Key (Stored in localStorage)'}
            >
              <Key className="w-3.5 h-3.5" />
              <span className="hidden xl:inline text-[10px]">
                {hasKeyReady ? 'Key Saved' : 'Enter Key'}
              </span>
            </button>

            {/* Maximize / Dock Button */}
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer hidden sm:flex"
              title={isMaximized ? 'Dock (Show left panels)' : 'Maximize across screen'}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Clear Chat */}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Clear all Groq chat messages?')) {
                    setMessages([]);
                    localStorage.removeItem('groq_chat_history');
                  }
                }}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Clear Groq Chat History"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Close Button */}
            <button
              id="close-groq-panel-btn"
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-rose-950/60 hover:text-rose-300 rounded-lg transition-colors cursor-pointer"
              title="Close Groq Chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* In-Panel LocalStorage Key Setup Drawer */}
        {(!hasKeyReady || isKeyConfigOpen) && (
          <div className="p-3 bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/70 border-b border-amber-600/40 shrink-0">
            <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-amber-300 font-semibold text-xs mb-1">
                  <Key className="w-4 h-4 text-amber-400" />
                  <span>Groq API Key (localStorage me safe save hogi — .env ki zaroorat nahi hai)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Aapki key sirf aapke local browser ke <code>localStorage</code> me safe rahegi. Free key lene ke liye{' '}
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-400 hover:underline inline-flex items-center gap-0.5"
                  >
                    console.groq.com/keys <ExternalLink className="w-2.5 h-2.5" />
                  </a>{' '}
                  par jayein.
                </p>
              </div>

              <form onSubmit={handleSaveLocalKey} className="flex items-center gap-2 shrink-0">
                <input
                  type="password"
                  value={keyInputValue}
                  onChange={(e) => setKeyInputValue(e.target.value)}
                  placeholder={hasKeyReady ? '••••••••••••••••' : 'gsk_... (paste here)'}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 font-mono focus:outline-none focus:border-amber-500 w-48 sm:w-56"
                />
                <button
                  type="submit"
                  disabled={!keyInputValue.trim()}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs whitespace-nowrap"
                >
                  Save Key
                </button>
                {hasKeyReady && (
                  <button
                    type="button"
                    onClick={handleClearLocalKey}
                    className="px-2 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                    title="Remove key from localStorage"
                  >
                    Clear
                  </button>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Repository File Selection Banner */}
        <div className="px-3 py-2 border-b border-slate-800/80 bg-slate-900/40 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFileSelectorExpanded(!isFileSelectorExpanded)}
              className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Files to Scan ({selectedPaths.length}/{fileAnalysis.eligible.length})</span>
              <span className="text-[10px] text-amber-300 font-mono">
                ~{liveSelectedTokens.toLocaleString()} tokens
              </span>
            </button>

            {/* Exclusion badge */}
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2 py-0.5 rounded">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span>node_modules & lock files auto-skipped</span>
            </span>
          </div>

          {/* Quick Document Action Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              disabled={isStreaming || !repo}
              onClick={() =>
                executeGroqScan(
                  `Generate a complete, publication-grade, attractive technical documentation document for this repository "${repo?.full_name}".
Include:
1. Executive Summary & Core Value Proposition
2. Architecture Diagram (ASCII workflow)
3. Module Breakdown (Folder by folder, File by file for all selected files)
4. Key APIs, Types, and Function Signatures
5. Step-by-Step Developer Setup and Production Deployment instructions.`,
                  true
                )
              }
              className="px-2.5 py-1 rounded-md text-xs font-semibold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Generate Complete Docs</span>
            </button>

            <button
              type="button"
              disabled={isStreaming || !repo}
              onClick={() =>
                executeGroqScan(
                  `Analyze the architectural design and data flow of this repository. Provide an ASCII flowchart showing component hierarchy, state flow, and external API integrations. Highlight bottlenecks and architectural strengths.`
                )
              }
              className="px-2 py-1 rounded-md text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Compass className="w-3 h-3 text-blue-400" />
              <span>Architecture</span>
            </button>

            <button
              type="button"
              disabled={isStreaming || !repo}
              onClick={() =>
                executeGroqScan(
                  `Perform a security and bug audit on the selected files of this repository. List potential edge cases, unhandled promises, memory leak risks, and security sanitization issues with recommended code fixes.`
                )
              }
              className="px-2 py-1 rounded-md text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
            >
              <ShieldAlert className="w-3 h-3 text-rose-400" />
              <span>Security Audit</span>
            </button>
          </div>
        </div>

        {/* Collapsible File Selection Drawer */}
        {isFileSelectorExpanded && (
          <div className="p-3 border-b border-slate-800 bg-slate-900/90 max-h-60 overflow-y-auto shrink-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={fileFilterSearch}
                  onChange={(e) => setFileFilterSearch(e.target.value)}
                  placeholder="Search repository files..."
                  className="w-full pl-8 pr-3 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllEligible}
                  className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
                >
                  Select All Eligible
                </button>
                <span className="text-slate-600">•</span>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
            </div>

            {/* File List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1">
              {filteredItems.map((item) => {
                const isSelected = selectedPaths.includes(item.path);
                const isExcluded = isGroqExemptFile(item.path);
                const reason = getGroqExemptReason(item.path);

                return (
                  <div
                    key={item.path}
                    onClick={() => !isExcluded && handleToggleFile(item.path)}
                    className={`flex items-center justify-between p-1.5 rounded text-xs transition-colors ${
                      isExcluded
                        ? 'opacity-40 cursor-not-allowed bg-slate-950/40 text-slate-600'
                        : isSelected
                        ? 'bg-amber-950/40 border border-amber-500/40 text-amber-200 cursor-pointer'
                        : 'hover:bg-slate-800 text-slate-300 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isExcluded ? (
                        <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                      ) : isSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      )}
                      <span className="truncate font-mono text-[11px]">{item.path}</span>
                    </div>

                    <div className="shrink-0 flex items-center gap-1">
                      {isExcluded ? (
                        <span className="text-[9px] font-mono text-slate-500 bg-slate-900 px-1 py-0.5 rounded border border-slate-800">
                          {reason || 'Disabled'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-500">
                          {formatByteSize(item.size || 0)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Conversation Stream Display */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !streamingContent && (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-lg mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                <Zap className="w-7 h-7" />
              </div>

              <h3 className="text-base font-bold text-white mb-1">
                Groq Repository Chat & Documentation
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Ask anything about the codebase or let Groq scan the whole repository using{' '}
                <strong className="text-amber-300">{currentModel.name}</strong> at blazing fast speeds ({currentModel.speed}).
                <br />
                <span className="text-emerald-400 font-medium">node_modules</span> and lock files are automatically disabled and excluded.
              </p>

              {/* Quick Prompt Cards */}
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                <button
                  type="button"
                  disabled={!repo}
                  onClick={() =>
                    executeGroqScan(
                      `Puri repository ka complete, highly attractive documentation banao with architecture diagrams, module breakdown, and API references.`
                    )
                  }
                  className="p-3 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 transition-all cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-semibold text-slate-200">Complete Repo Docs</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Full scan & attractive architecture documentation
                  </p>
                </button>

                <button
                  type="button"
                  disabled={!repo}
                  onClick={() =>
                    executeGroqScan(
                      `Scan this repository and explain the complete tech stack, dependencies, and main entry points.`
                    )
                  }
                  className="p-3 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 transition-all cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Code2 className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-semibold text-slate-200">Tech Stack & Architecture</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Detailed stack evaluation & entry files
                  </p>
                </button>

                <button
                  type="button"
                  disabled={!repo}
                  onClick={() =>
                    executeGroqScan(
                      `Identify potential bugs, edge cases, or optimization points across the selected files.`
                    )
                  }
                  className="p-3 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 transition-all cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldAlert className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-semibold text-slate-200">Bug & Security Audit</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Find logic flaws, uncaught errors & fix suggestions
                  </p>
                </button>

                <button
                  type="button"
                  disabled={!repo}
                  onClick={() =>
                    executeGroqScan(
                      `Write step-by-step instructions to set up, build, test, and deploy this repository locally and on cloud services.`
                    )
                  }
                  className="p-3 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 transition-all cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-semibold text-slate-200">Setup & Deploy Guide</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Zero to production launch instructions
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Existing Messages */}
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isCopied = copiedId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
              >
                {/* Message Header Badge */}
                <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400 px-1">
                  {isUser ? (
                    <span className="font-semibold text-slate-300">You</span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-semibold text-amber-300">
                        {msg.modelUsed || currentModel.name}
                      </span>
                    </div>
                  )}

                  {/* Token Badge */}
                  {typeof msg.tokenCount === 'number' && msg.tokenCount > 0 && (
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400">
                      {msg.tokenCount.toLocaleString()} tokens
                    </span>
                  )}

                  <span className="text-slate-600">•</span>
                  <span className="text-[10px]">{formatTimestamp(msg.timestamp)}</span>

                  {/* Action buttons on assistant message */}
                  {!isUser && (
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className="p-1 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Copy response"
                      >
                        {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadDoc('Groq_Repository_Doc', msg.content)}
                        className="p-1 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Download as Markdown (.md)"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`p-3.5 rounded-2xl max-w-4xl w-full text-xs leading-relaxed ${
                    isUser
                      ? 'bg-blue-600/20 border border-blue-500/30 text-blue-100 rounded-tr-xs'
                      : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-xs shadow-md'
                  }`}
                >
                  <div className="markdown-body text-slate-200 leading-relaxed max-w-none break-words">
                    <Markdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ className, children, ...props }: any) {
                          const textContent = String(children || '');
                          const isMultiline = textContent.includes('\n');
                          if (isMultiline) {
                            return (
                              <GroqCodeBlock
                                className={className}
                                onApplyCodeToFile={onApplyCodeToFile}
                              >
                                {children}
                              </GroqCodeBlock>
                            );
                          }
                          return (
                            <code className="px-1 py-0.5 rounded bg-slate-950 text-amber-300 font-mono text-[11px] border border-slate-800" {...props}>
                              {children}
                            </code>
                          );
                        },
                        p({ children }) {
                          return <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>;
                        },
                        ul({ children }) {
                          return <ul className="list-disc pl-5 mb-2.5 space-y-1">{children}</ul>;
                        },
                        ol({ children }) {
                          return <ol className="list-decimal pl-5 mb-2.5 space-y-1">{children}</ol>;
                        },
                        li({ children }) {
                          return <li className="leading-relaxed">{children}</li>;
                        },
                        h1({ children }) {
                          return <h1 className="text-base font-bold text-white mt-3 mb-1.5">{children}</h1>;
                        },
                        h2({ children }) {
                          return <h2 className="text-sm font-bold text-amber-300 mt-2.5 mb-1">{children}</h2>;
                        },
                        h3({ children }) {
                          return <h3 className="text-xs font-semibold text-slate-200 mt-2 mb-1">{children}</h3>;
                        },
                        table({ children }) {
                          return (
                            <div className="overflow-x-auto my-2 rounded-lg border border-slate-800">
                              <table className="min-w-full text-xs text-left border-collapse">{children}</table>
                            </div>
                          );
                        },
                        th({ children }) {
                          return <th className="border-b border-slate-800 bg-slate-900/90 px-3 py-1.5 font-semibold text-slate-300">{children}</th>;
                        },
                        td({ children }) {
                          return <td className="border-b border-slate-850 px-3 py-1.5 text-slate-300">{children}</td>;
                        },
                      }}
                    >
                      {msg.content}
                    </Markdown>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Live Streaming Content Bubble */}
          {isStreaming && (
            <div className="flex flex-col items-start max-w-full">
              <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400 px-1">
                <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="font-semibold text-amber-300">{currentModel.name}</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-600/40 text-amber-300 animate-pulse">
                  Streaming ~{currentOutputTokens.toLocaleString()} tokens
                </span>
              </div>

              <div className="p-3.5 rounded-2xl rounded-tl-xs max-w-4xl w-full bg-slate-900 border border-amber-500/30 text-slate-100 text-xs shadow-md">
                <div className="markdown-body text-slate-200 leading-relaxed max-w-none break-words">
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {streamingContent || 'Analyzing repository files with Groq...'}
                  </Markdown>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Box and Live Token Counter */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/90 shrink-0">
          {/* Token Counter Strip */}
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2 px-1">
            <div className="flex items-center gap-2">
              <span>
                Files Context:{' '}
                <strong className="text-amber-300">~{liveSelectedTokens.toLocaleString()} tokens</strong> ({selectedPaths.length} files)
              </span>
              <span className="text-slate-600">•</span>
              <span>
                Prompt: <strong className="text-blue-300">{liveInputTokens} tokens</strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-amber-400">
              <Zap className="w-3.5 h-3.5" />
              <span>Speed: {currentModel.speed}</span>
            </div>
          </div>

          {/* Input Textarea & Send Control */}
          <div className="relative flex items-end gap-2 bg-slate-950 rounded-xl border border-slate-700/80 p-2 focus-within:border-amber-500/80 transition-colors">
            <textarea
              id="groq-chat-textarea"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isStreaming) executeGroqScan(inputPrompt);
                }
              }}
              placeholder={
                repo
                  ? `Ask Groq (${currentModel.shortName}) about ${repo.name} or type "ek docs banao"...`
                  : 'Select a repository on the left to start scanning...'
              }
              rows={2}
              className="flex-1 bg-transparent text-xs text-slate-100 placeholder:text-slate-500 resize-none focus:outline-none max-h-32"
            />

            <div className="flex items-center gap-1.5 shrink-0">
              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStopStreaming}
                  className="p-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1 text-xs font-semibold cursor-pointer shadow-sm"
                  title="Stop Generation"
                >
                  <StopSquare className="w-4 h-4 fill-white" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  id="groq-send-btn"
                  type="button"
                  disabled={!inputPrompt.trim() && selectedPaths.length === 0}
                  onClick={() => executeGroqScan(inputPrompt)}
                  className="p-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  title="Send message to Groq"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
