import { useState, useEffect } from 'react';
import {
  Key,
  Eye,
  EyeOff,
  Save,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  ExternalLink,
  X,
  Github,
  Sparkles,
  Zap,
  Plus,
  RotateCcw,
  Cpu,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { GeminiModelOption, GroqModelOption, GEMINI_MODELS, GROQ_MODELS } from '../types';
import {
  loadConfiguredGeminiModels,
  saveConfiguredGeminiModels,
  loadConfiguredGroqModels,
  saveConfiguredGroqModels,
  createCustomGeminiModelOption,
  createCustomGroqModelOption,
  POPULAR_GEMINI_SUGGESTIONS,
  POPULAR_GROQ_SUGGESTIONS,
} from '../utils/modelsConfig';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentApiKey: string;
  onSaveApiKey: (key: string) => void;
  hasEnvKeyFallback: boolean;
  currentGithubToken?: string;
  onSaveGithubToken?: (token: string) => void;
  currentGroqApiKey?: string;
  onSaveGroqApiKey?: (key: string) => void;
  hasGroqEnvFallback?: boolean;
  geminiModels?: GeminiModelOption[];
  onSaveGeminiModels?: (models: GeminiModelOption[]) => void;
  groqModels?: GroqModelOption[];
  onSaveGroqModels?: (models: GroqModelOption[]) => void;
}

export function ApiKeyModal({
  isOpen,
  onClose,
  currentApiKey,
  onSaveApiKey,
  hasEnvKeyFallback,
  currentGithubToken = '',
  onSaveGithubToken,
  currentGroqApiKey = '',
  onSaveGroqApiKey,
  hasGroqEnvFallback = false,
  geminiModels,
  onSaveGeminiModels,
  groqModels,
  onSaveGroqModels,
}: ApiKeyModalProps) {
  const [activeTab, setActiveTab] = useState<'gemini' | 'groq' | 'github'>('gemini');
  const [keyValue, setKeyValue] = useState(currentApiKey);
  const [githubTokenValue, setGithubTokenValue] = useState(currentGithubToken);
  const [groqKeyValue, setGroqKeyValue] = useState(currentGroqApiKey);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Custom Models States
  const [geminiList, setGeminiList] = useState<GeminiModelOption[]>(() => {
    return geminiModels && geminiModels.length > 0 ? geminiModels : loadConfiguredGeminiModels();
  });
  const [groqList, setGroqList] = useState<GroqModelOption[]>(() => {
    return groqModels && groqModels.length > 0 ? groqModels : loadConfiguredGroqModels();
  });

  const [newGeminiInput, setNewGeminiInput] = useState('');
  const [newGroqInput, setNewGroqInput] = useState('');
  const [modelError, setModelError] = useState<string | null>(null);

  useEffect(() => {
    setKeyValue(currentApiKey);
    setGithubTokenValue(currentGithubToken);
    setGroqKeyValue(currentGroqApiKey);
    if (geminiModels && geminiModels.length > 0) {
      setGeminiList(geminiModels);
    }
    if (groqModels && groqModels.length > 0) {
      setGroqList(groqModels);
    }
  }, [currentApiKey, currentGithubToken, currentGroqApiKey, geminiModels, groqModels, isOpen]);

  if (!isOpen) return null;

  // Add Gemini Model
  const handleAddGemini = (modelIdToAdd?: string) => {
    const rawId = (modelIdToAdd || newGeminiInput).trim();
    if (!rawId) return;

    if (geminiList.some((m) => m.id.toLowerCase() === rawId.toLowerCase())) {
      setModelError(`Model "${rawId}" already exists in your Gemini models list.`);
      setTimeout(() => setModelError(null), 3000);
      return;
    }

    const newOption = createCustomGeminiModelOption(rawId);
    const updated = [...geminiList, newOption];
    setGeminiList(updated);
    setNewGeminiInput('');
    setModelError(null);
  };

  // Remove Gemini Model
  const handleRemoveGemini = (id: string) => {
    if (geminiList.length <= 1) {
      setModelError('Kam se kam ek Gemini model rehna jaruri hai.');
      setTimeout(() => setModelError(null), 3000);
      return;
    }
    setGeminiList((prev) => prev.filter((m) => m.id !== id));
  };

  // Reset Gemini Models
  const handleResetGemini = () => {
    setGeminiList(GEMINI_MODELS);
  };

  // Add Groq Model
  const handleAddGroq = (modelIdToAdd?: string) => {
    const rawId = (modelIdToAdd || newGroqInput).trim();
    if (!rawId) return;

    if (groqList.some((m) => m.id.toLowerCase() === rawId.toLowerCase())) {
      setModelError(`Model "${rawId}" already exists in your Groq models list.`);
      setTimeout(() => setModelError(null), 3000);
      return;
    }

    const newOption = createCustomGroqModelOption(rawId);
    const updated = [...groqList, newOption];
    setGroqList(updated);
    setNewGroqInput('');
    setModelError(null);
  };

  // Remove Groq Model
  const handleRemoveGroq = (id: string) => {
    if (groqList.length <= 1) {
      setModelError('Kam se kam ek Groq model rehna jaruri hai.');
      setTimeout(() => setModelError(null), 3000);
      return;
    }
    setGroqList((prev) => prev.filter((m) => m.id !== id));
  };

  // Reset Groq Models
  const handleResetGroq = () => {
    setGroqList(GROQ_MODELS);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveApiKey(keyValue.trim());
    if (onSaveGithubToken) {
      onSaveGithubToken(githubTokenValue.trim());
    }
    if (onSaveGroqApiKey) {
      onSaveGroqApiKey(groqKeyValue.trim());
    }

    // Save models
    if (onSaveGeminiModels) {
      onSaveGeminiModels(geminiList);
      saveConfiguredGeminiModels(geminiList);
    }
    if (onSaveGroqModels) {
      onSaveGroqModels(groqList);
      saveConfiguredGroqModels(groqList);
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  const handleClear = () => {
    if (activeTab === 'gemini') {
      setKeyValue('');
      onSaveApiKey('');
    } else if (activeTab === 'github') {
      setGithubTokenValue('');
      if (onSaveGithubToken) onSaveGithubToken('');
    } else {
      setGroqKeyValue('');
      if (onSaveGroqApiKey) onSaveGroqApiKey('');
    }
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div
        id="api-key-modal-card"
        className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700/80 p-5 sm:p-6 shadow-2xl text-slate-100 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
      >
        {/* Close Button */}
        <button
          id="close-api-key-modal-btn"
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer z-10"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>API Keys & Custom Models Studio</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                localStorage
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Set API keys & add unlimited custom Gemini & Groq model names
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 mb-4 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('gemini')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'gemini'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gemini ({geminiList.length})</span>
            {keyValue ? <span className="w-2 h-2 rounded-full bg-emerald-400 ml-1"></span> : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('groq')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'groq'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>Groq ({groqList.length})</span>
            {groqKeyValue ? <span className="w-2 h-2 rounded-full bg-emerald-400 ml-1"></span> : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('github')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'github'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Github className="w-3.5 h-3.5" />
            <span>GitHub PAT</span>
            {githubTokenValue ? <span className="w-2 h-2 rounded-full bg-emerald-400 ml-1"></span> : null}
          </button>
        </div>

        {/* Error Notification if any */}
        {modelError && (
          <div className="mb-3 p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2 shrink-0 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{modelError}</span>
          </div>
        )}

        {/* Scrollable Form Content */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto pr-1 space-y-4">
          {activeTab === 'gemini' ? (
            <div className="space-y-4">
              {/* API Key Input */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span>Google Gemini API Key</span>
                  </label>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-400 hover:text-blue-300 underline flex items-center gap-1"
                  >
                    Get free key <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="relative">
                  <input
                    id="gemini-api-key-input"
                    type={showGeminiKey ? 'text' : 'password'}
                    value={keyValue}
                    onChange={(e) => setKeyValue(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full pl-3.5 pr-10 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder:text-slate-600 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    title={showGeminiKey ? 'Hide key' : 'Show key'}
                  >
                    {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {hasEnvKeyFallback && !keyValue && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-950/30 p-2 rounded-lg border border-emerald-900/40">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Default server GEMINI_API_KEY available. Custom key is optional.</span>
                  </div>
                )}
              </div>

              {/* Gemini Custom Models Section */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-white">
                      Gemini Models ({geminiList.length})
                    </span>
                    <span className="text-[10px] text-slate-400">
                      (Chat dropdown me appear honge)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetGemini}
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer hover:underline"
                    title="Reset to default Gemini models"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Defaults</span>
                  </button>
                </div>

                {/* Add Model Input Bar */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newGeminiInput}
                    onChange={(e) => setNewGeminiInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddGemini();
                      }
                    }}
                    placeholder="Enter custom model ID (e.g. gemini-2.5-flash, gemini-2.5-pro)"
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddGemini()}
                    disabled={!newGeminiInput.trim()}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Model</span>
                  </button>
                </div>

                {/* Quick Add Suggestions */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block font-medium">
                    Popular suggestions (Click to add):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_GEMINI_SUGGESTIONS.map((preset) => {
                      const alreadyAdded = geminiList.some(
                        (m) => m.id.toLowerCase() === preset.id.toLowerCase()
                      );
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() => handleAddGemini(preset.id)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-colors flex items-center gap-1 ${
                            alreadyAdded
                              ? 'bg-slate-900/60 text-slate-500 border border-slate-800 cursor-default'
                              : 'bg-slate-900 text-blue-300 hover:bg-blue-950/60 hover:text-blue-200 border border-blue-900/50 cursor-pointer'
                          }`}
                          title={alreadyAdded ? 'Already added' : `Add ${preset.name} (${preset.note})`}
                        >
                          <span>{preset.id}</span>
                          {!alreadyAdded && <Plus className="w-2.5 h-2.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Current Active Models List */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto divide-y divide-slate-900 rounded-xl bg-slate-900/50 border border-slate-800/80 p-1.5">
                  {geminiList.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-850/50 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0"></span>
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-200 block truncate">
                            {m.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 block truncate">
                            {m.id}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/70 border border-blue-800/50 text-blue-300">
                          {m.badge || (m.isCustom ? 'Custom' : 'Preset')}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveGemini(m.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors cursor-pointer"
                          title="Remove model"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : activeTab === 'groq' ? (
            <div className="space-y-4">
              {/* Groq API Key Input */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Groq API Key (Browser localStorage)</span>
                  </label>
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-amber-400 hover:text-amber-300 underline flex items-center gap-1"
                  >
                    Get free Groq key <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="relative">
                  <input
                    id="groq-api-key-input"
                    type={showGroqKey ? 'text' : 'password'}
                    value={groqKeyValue}
                    onChange={(e) => setGroqKeyValue(e.target.value)}
                    placeholder="gsk_..."
                    className="w-full pl-3.5 pr-10 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder:text-slate-600 text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGroqKey(!showGroqKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    title={showGroqKey ? 'Hide key' : 'Show key'}
                  >
                    {showGroqKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-950/40 border border-amber-800/40 text-[11px] text-amber-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Stored securely in browser localStorage. No server restart needed.</span>
                </div>
              </div>

              {/* Groq Custom Models Section */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">
                      Groq Models ({groqList.length})
                    </span>
                    <span className="text-[10px] text-slate-400">
                      (Groq studio panel me appear honge)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetGroq}
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer hover:underline"
                    title="Reset to default Groq models"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Defaults</span>
                  </button>
                </div>

                {/* Add Model Input Bar */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newGroqInput}
                    onChange={(e) => setNewGroqInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddGroq();
                      }
                    }}
                    placeholder="Enter custom Groq model (e.g. deepseek-r1-distill-llama-70b, qwen-2.5-coder-32b)"
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddGroq()}
                    disabled={!newGroqInput.trim()}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Model</span>
                  </button>
                </div>

                {/* Quick Add Suggestions for Groq */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block font-medium">
                    Popular suggestions (Click to add):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_GROQ_SUGGESTIONS.map((preset) => {
                      const alreadyAdded = groqList.some(
                        (m) => m.id.toLowerCase() === preset.id.toLowerCase()
                      );
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() => handleAddGroq(preset.id)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-colors flex items-center gap-1 ${
                            alreadyAdded
                              ? 'bg-slate-900/60 text-slate-500 border border-slate-800 cursor-default'
                              : 'bg-slate-900 text-amber-300 hover:bg-amber-950/60 hover:text-amber-200 border border-amber-900/50 cursor-pointer'
                          }`}
                          title={alreadyAdded ? 'Already added' : `Add ${preset.name} (${preset.note})`}
                        >
                          <span>{preset.id}</span>
                          {!alreadyAdded && <Plus className="w-2.5 h-2.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Current Active Groq Models List */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto divide-y divide-slate-900 rounded-xl bg-slate-900/50 border border-slate-800/80 p-1.5">
                  {groqList.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-850/50 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-200 block truncate">
                            {m.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 block truncate">
                            {m.id}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/70 border border-amber-800/50 text-amber-300">
                          {m.badge || (m.isCustom ? 'Custom' : 'Preset')}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveGroq(m.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors cursor-pointer"
                          title="Remove model"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200">
                    GitHub Personal Access Token (PAT)
                  </label>
                  <a
                    href="https://github.com/settings/tokens?type=beta"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-400 hover:text-blue-300 underline flex items-center gap-1"
                  >
                    Create token <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="relative">
                  <input
                    id="github-token-input"
                    type={showGithubToken ? 'text' : 'password'}
                    value={githubTokenValue}
                    onChange={(e) => setGithubTokenValue(e.target.value)}
                    placeholder="ghp_... or github_pat_..."
                    className="w-full pl-3.5 pr-10 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder:text-slate-600 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGithubToken(!showGithubToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    title={showGithubToken ? 'Hide token' : 'Show token'}
                  >
                    {showGithubToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                  GitHub PAT token allows cloning, forking, committing changes directly, viewing private repositories, and raises API rate limits to <strong>5,000 requests/hour</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Privacy Note */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>All API keys and custom model lists are stored purely in your browser's local storage.</span>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 shrink-0">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 p-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                Clear {activeTab === 'gemini' ? 'Gemini Key' : activeTab === 'groq' ? 'Groq Key' : 'GitHub Token'}
              </span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                id="save-api-keys-btn"
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-md shadow-blue-600/30 cursor-pointer"
              >
                {savedSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Configuration</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
