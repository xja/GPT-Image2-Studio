import { normalizeApiBaseUrl } from "./api-base-url.mjs";

export const BROWSER_CONFIG_STORAGE_KEY = "image-studio-browser-config-v1";
export const CLIENT_SESSION_STORAGE_KEY = "image-studio-client-session-id";
export const DEFAULT_BROWSER_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_BROWSER_RESPONSES_MODEL = "gpt-5.5";

function getLocalStorage() {
  return globalThis.window?.localStorage || null;
}

export function getOrCreateClientSessionId(storage = getLocalStorage()) {
  const existing = storage?.getItem?.(CLIENT_SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const next = `studio-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  storage?.setItem?.(CLIENT_SESSION_STORAGE_KEY, next);
  return next;
}

export function maskBrowserApiKey(apiKey) {
  if (!apiKey) {
    return "";
  }

  if (apiKey.length <= 8) {
    return `${apiKey.slice(0, 2)}***`;
  }

  return `${apiKey.slice(0, 4)}***${apiKey.slice(-4)}`;
}

export function normalizeBrowserPrivateConfig(source = {}) {
  const baseUrl = normalizeApiBaseUrl(source.baseUrl, { defaultBaseUrl: DEFAULT_BROWSER_BASE_URL });
  const apiKey = String(source.apiKey || "").trim();
  const responsesModel = String(source.responsesModel || DEFAULT_BROWSER_RESPONSES_MODEL).trim();

  return {
    baseUrl: baseUrl || DEFAULT_BROWSER_BASE_URL,
    apiKey,
    responsesModel: responsesModel || DEFAULT_BROWSER_RESPONSES_MODEL,
  };
}

export function readBrowserPrivateConfig(storage = getLocalStorage()) {
  try {
    const raw = storage?.getItem?.(BROWSER_CONFIG_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return normalizeBrowserPrivateConfig(JSON.parse(raw));
  } catch (_error) {
    return null;
  }
}

export function toPublicBrowserConfig(privateConfig, baseConfig = {}) {
  const normalized = normalizeBrowserPrivateConfig(privateConfig);
  return {
    ...baseConfig,
    baseUrl: normalized.baseUrl,
    apiKeyConfigured: Boolean(normalized.apiKey),
    apiKeyMask: maskBrowserApiKey(normalized.apiKey),
    responsesModel: normalized.responsesModel,
  };
}

export function saveBrowserPrivateConfig(payload, storage = getLocalStorage()) {
  const current = readBrowserPrivateConfig(storage) || normalizeBrowserPrivateConfig();
  const next = normalizeBrowserPrivateConfig({
    ...current,
    baseUrl: payload.baseUrl,
    apiKey: payload.apiKey ? payload.apiKey : current.apiKey,
    responsesModel: payload.responsesModel,
  });

  storage?.setItem?.(BROWSER_CONFIG_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function appendBrowserConfigToFormData(formData, readConfig = readBrowserPrivateConfig) {
  const browserConfig = typeof readConfig === "function" ? readConfig() : readConfig;
  if (!browserConfig) {
    return formData;
  }

  formData.set("baseUrl", browserConfig.baseUrl);
  formData.set("apiKey", browserConfig.apiKey);
  formData.set("responsesModel", browserConfig.responsesModel);
  return formData;
}

export function getBrowserPrivateConfigRequestPayload(readConfig = readBrowserPrivateConfig) {
  const browserConfig = typeof readConfig === "function" ? readConfig() : readConfig;
  return browserConfig
    ? {
        baseUrl: browserConfig.baseUrl,
        apiKey: browserConfig.apiKey,
        responsesModel: browserConfig.responsesModel,
      }
    : {};
}
