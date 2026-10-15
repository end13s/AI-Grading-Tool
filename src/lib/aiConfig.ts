// User-supplied AI settings. The OpenAI key lives only in this browser's
// localStorage, so a deployed build never ships a key. VITE_OPENAI_API_KEY
// is honoured in `npm run dev` only and is stripped from production builds.

const API_KEY_STORAGE = 'openai_api_key';
const MODEL_STORAGE = 'openai_model';

export const DEFAULT_MODEL = 'gpt-5-mini';
export const SUGGESTED_MODELS = ['gpt-5-mini', 'gpt-5', 'gpt-5-nano', 'gpt-4o-mini'];

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function write(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Storage blocked (private mode etc.): the value lasts for this session only.
  }
}

export function getStoredApiKey(): string {
  const stored = read(API_KEY_STORAGE);
  if (stored) return stored;
  return import.meta.env.DEV ? (import.meta.env.VITE_OPENAI_API_KEY ?? '') : '';
}

export function storeApiKey(key: string) {
  write(API_KEY_STORAGE, key.trim());
}

export function getModel(): string {
  return read(MODEL_STORAGE) || DEFAULT_MODEL;
}

export function storeModel(model: string) {
  write(MODEL_STORAGE, model.trim());
}
