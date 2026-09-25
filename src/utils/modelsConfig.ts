import {
  GeminiModelOption,
  GroqModelOption,
  GEMINI_MODELS as DEFAULT_GEMINI_MODELS_LIST,
  GROQ_MODELS as DEFAULT_GROQ_MODELS_LIST,
} from '../types';

export const STORAGE_KEY_GEMINI_MODELS = 'gemini_custom_models';
export const STORAGE_KEY_GROQ_MODELS = 'groq_custom_models';

export interface PopularModelPreset {
  id: string;
  name: string;
  category: 'fast' | 'reasoning' | 'balanced' | 'flagship';
  note: string;
}

export const POPULAR_GEMINI_SUGGESTIONS: PopularModelPreset[] = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', category: 'fast', note: 'Fast & responsive coding' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', category: 'reasoning', note: 'Deep reasoning & logic' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', category: 'fast', note: 'Next-gen multimodal' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', category: 'flagship', note: '2M Long Context' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', category: 'fast', note: 'High speed generation' },
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', category: 'flagship', note: 'Flagship Speed' },
];

export const POPULAR_GROQ_SUGGESTIONS: PopularModelPreset[] = [
  { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 (70B)', category: 'reasoning', note: 'Deep reasoning on Groq' },
  { id: 'qwen-2.5-coder-32b', name: 'Qwen 2.5 Coder (32B)', category: 'reasoning', note: 'Specialized for coding' },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', category: 'flagship', note: '128k ~280 t/s' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', category: 'fast', note: 'Ultra fast ~850 t/s' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', category: 'balanced', note: '32k context MoE' },
  { id: 'gemma2-9b-it', name: 'Gemma 2 9B IT', category: 'balanced', note: 'Google compact high-iq' },
];

/**
 * Format a human-readable title from a raw model string
 */
export function formatModelDisplayName(rawId: string): string {
  const clean = rawId.trim();
  if (!clean) return 'Custom Model';
  
  // Replace underscores and hyphens with spaces
  return clean
    .split(/[-_]/)
    .map((word) => {
      if (word.match(/^(ai|id|io|llm|moe|it|r1|70b|8b|32b|9b|11b)$/i)) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Build a standard GeminiModelOption from a custom model string
 */
export function createCustomGeminiModelOption(modelId: string): GeminiModelOption {
  const cleanId = modelId.trim();
  const displayName = formatModelDisplayName(cleanId);
  const words = displayName.split(' ');
  const shortName = words.length > 2 ? `${words[0]} ${words[1]}` : displayName;

  return {
    id: cleanId,
    name: displayName,
    shortName,
    badge: 'Custom Added',
    speed: 'User Configured',
    description: `User-defined model: ${cleanId}. Full parameter access.`,
    tagColor: 'text-indigo-300 border-indigo-500/40 bg-indigo-950/40',
    isCustom: true,
  };
}

/**
 * Build a standard GroqModelOption from a custom model string
 */
export function createCustomGroqModelOption(modelId: string): GroqModelOption {
  const cleanId = modelId.trim();
  const displayName = formatModelDisplayName(cleanId);
  const words = displayName.split(' ');
  const shortName = words.length > 2 ? `${words[0]} ${words[1]}` : displayName;

  return {
    id: cleanId,
    name: displayName,
    shortName,
    badge: 'Custom Added',
    speed: 'Groq LPUs',
    contextWindow: 'Auto context',
    description: `User-defined Groq model: ${cleanId}. High-speed inference.`,
    tagColor: 'text-amber-300 border-amber-500/40 bg-amber-950/40',
    isCustom: true,
  };
}

/**
 * Load configured Gemini models from localStorage or fallback to clean defaults
 */
export function loadConfiguredGeminiModels(): GeminiModelOption[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GEMINI_MODELS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse saved Gemini models:', err);
  }
  return DEFAULT_GEMINI_MODELS_LIST;
}

/**
 * Save configured Gemini models to localStorage
 */
export function saveConfiguredGeminiModels(models: GeminiModelOption[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_GEMINI_MODELS, JSON.stringify(models));
  } catch (err) {
    console.warn('Failed to save Gemini models:', err);
  }
}

/**
 * Load configured Groq models from localStorage or fallback to clean defaults
 */
export function loadConfiguredGroqModels(): GroqModelOption[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GROQ_MODELS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse saved Groq models:', err);
  }
  return DEFAULT_GROQ_MODELS_LIST;
}

/**
 * Save configured Groq models to localStorage
 */
export function saveConfiguredGroqModels(models: GroqModelOption[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_GROQ_MODELS, JSON.stringify(models));
  } catch (err) {
    console.warn('Failed to save Groq models:', err);
  }
}
