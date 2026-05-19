import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  appendBrowserConfigToFormData,
  normalizeBrowserPrivateConfig,
  toPublicBrowserConfig,
} from "../public/lib/browser-config.mjs";

test("browser config module normalizes private config without requiring window globals", () => {
  const normalized = normalizeBrowserPrivateConfig({
    baseUrl: "https://example.test/v1/",
    apiKey: "sk-browser-secret",
    responsesModel: "gpt-5.5",
  });
  const publicConfig = toPublicBrowserConfig(normalized, { defaults: { size: "auto" } });
  const formData = appendBrowserConfigToFormData(new FormData(), () => normalized);

  assert.deepEqual(normalized, {
    baseUrl: "https://example.test/v1/",
    apiKey: "sk-browser-secret",
    responsesModel: "gpt-5.5",
  });
  assert.equal(publicConfig.apiKeyConfigured, true);
  assert.equal(publicConfig.apiKeyMask, "sk-b***cret");
  assert.equal(publicConfig.defaults.size, "auto");
  assert.equal(formData.get("baseUrl"), "https://example.test/v1/");
  assert.equal(formData.get("apiKey"), "sk-browser-secret");
  assert.equal(formData.get("responsesModel"), "gpt-5.5");
});

test("public app shell delegates browser config and cache behavior to public modules", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const lineCount = app.split(/\r?\n/).length;

  assert.match(app, /from "\/lib\/browser-config\.mjs"/);
  assert.match(app, /from "\/lib\/browser-image-cache\.mjs"/);
  assert.match(app, /from "\/lib\/generation-client\.mjs"/);
  assert.ok(lineCount < 13550, `public/app.js should shrink as shell responsibilities move out, got ${lineCount}`);
});
