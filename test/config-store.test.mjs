import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createConfigStore } from "../lib/config-store.mjs";

test("config store returns empty public config before any save", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-config-"));
  const store = createConfigStore({ rootDir });

  const config = await store.readPublicConfig();

  assert.equal(config.baseUrl, "https://api.openai.com/v1");
  assert.equal(config.apiKeyConfigured, false);
  assert.equal(config.apiKeyMask, undefined);
  assert.equal(config.responsesModel, "gpt-5.4");
  assert.deepEqual(config.defaults, {
    size: "1024x1536",
    quality: "high",
    format: "png",
    reasoningEffort: "xhigh",
  });
  assert.deepEqual(config.limits, {
    maxConcurrentTasksPerSession: 12,
    maxParallelTasksPerSession: 4,
    maxReferenceImages: 6,
  });
  assert.deepEqual(config.reasoningEfforts, ["low", "medium", "high", "xhigh"]);
});

test("config store persists private config and only exposes masked api key publicly", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-config-"));
  const store = createConfigStore({ rootDir });

  await store.saveConfig({
    baseUrl: "https://example.com/v1",
    apiKey: "placeholder-test-key-1234567890",
    responsesModel: "gpt-5.4",
    defaults: {
      size: "1536x1024",
      quality: "medium",
      format: "png",
      reasoningEffort: "medium",
    },
  });

  const publicConfig = await store.readPublicConfig();
  const privateConfig = await store.readPrivateConfig();
  const raw = JSON.parse(
    await readFile(join(rootDir, ".local", "config.json"), "utf8"),
  );

  assert.equal(publicConfig.baseUrl, "https://example.com/v1");
  assert.equal(publicConfig.apiKeyConfigured, true);
  assert.match(publicConfig.apiKeyMask, /^plac.*7890$/);
  assert.equal(publicConfig.responsesModel, "gpt-5.4");
  assert.deepEqual(publicConfig.defaults, {
    size: "1536x1024",
    quality: "medium",
    format: "png",
    reasoningEffort: "medium",
  });

  assert.equal(privateConfig.apiKey, "placeholder-test-key-1234567890");
  assert.equal(raw.apiKey, "placeholder-test-key-1234567890");
});
