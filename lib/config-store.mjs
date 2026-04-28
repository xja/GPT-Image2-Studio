import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  DEFAULT_BASE_URL,
  DEFAULT_REASONING_EFFORT,
  MAX_CONCURRENT_TASKS_PER_SESSION,
  MAX_PARALLEL_TASKS_PER_SESSION,
  MAX_REFERENCE_IMAGES,
  REASONING_EFFORT_OPTIONS,
} from "./studio-constants.mjs";

export const DEFAULT_CONFIG = {
  baseUrl: DEFAULT_BASE_URL,
  apiKey: "",
  responsesModel: "gpt-5.4",
  defaults: {
    size: "1024x1536",
    quality: "high",
    format: "png",
    reasoningEffort: DEFAULT_REASONING_EFFORT,
  },
};

function mergeConfig(source = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...source,
    defaults: {
      ...DEFAULT_CONFIG.defaults,
      ...(source.defaults || {}),
    },
  };
}

function maskApiKey(apiKey) {
  if (!apiKey) {
    return undefined;
  }

  if (apiKey.length <= 8) {
    return `${apiKey.slice(0, 2)}***`;
  }

  return `${apiKey.slice(0, 4)}***${apiKey.slice(-4)}`;
}

export function createConfigStore({ rootDir }) {
  const localDir = join(rootDir, ".local");
  const configPath = join(localDir, "config.json");

  async function ensureDir() {
    await mkdir(localDir, { recursive: true });
  }

  async function readPrivateConfig() {
    try {
      const raw = await readFile(configPath, "utf8");
      return mergeConfig(JSON.parse(raw));
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") {
        return mergeConfig();
      }

      throw error;
    }
  }

  async function saveConfig(nextConfig) {
    await ensureDir();
    const currentConfig = await readPrivateConfig();
    const merged = mergeConfig({
      ...currentConfig,
      ...nextConfig,
      apiKey:
        nextConfig.apiKey === undefined || nextConfig.apiKey === ""
          ? currentConfig.apiKey
          : nextConfig.apiKey,
      defaults: {
        ...currentConfig.defaults,
        ...(nextConfig.defaults || {}),
      },
    });

    await writeFile(configPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
    return merged;
  }

  async function readPublicConfig() {
    const config = await readPrivateConfig();
    return {
      baseUrl: config.baseUrl,
      apiKeyConfigured: Boolean(config.apiKey),
      apiKeyMask: maskApiKey(config.apiKey),
      responsesModel: config.responsesModel,
      defaults: {
        ...config.defaults,
      },
      limits: {
        maxConcurrentTasksPerSession: MAX_CONCURRENT_TASKS_PER_SESSION,
        maxParallelTasksPerSession: MAX_PARALLEL_TASKS_PER_SESSION,
        maxReferenceImages: MAX_REFERENCE_IMAGES,
      },
      reasoningEfforts: [...REASONING_EFFORT_OPTIONS],
    };
  }

  return {
    configPath,
    readPrivateConfig,
    readPublicConfig,
    saveConfig,
  };
}
