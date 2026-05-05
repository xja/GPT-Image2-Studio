import test from "node:test";
import assert from "node:assert/strict";

import { mergeRequestPrivateConfig } from "../lib/request-private-config.mjs";

test("request private config uses browser-provided API settings when a key is present", () => {
  const fallback = {
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    responsesModel: "gpt-5.4",
    defaults: {
      reasoningEffort: "xhigh",
    },
  };
  const fields = {
    baseUrl: "https://example.test/v1",
    apiKey: "browser-key",
    responsesModel: "gpt-5.5",
  };

  const config = mergeRequestPrivateConfig(fields, fallback);

  assert.equal(config.baseUrl, "https://example.test/v1");
  assert.equal(config.apiKey, "browser-key");
  assert.equal(config.responsesModel, "gpt-5.5");
  assert.deepEqual(config.defaults, fallback.defaults);
});

test("request private config falls back to server config when no request key is present", () => {
  const fallback = {
    baseUrl: "https://api.openai.com/v1",
    apiKey: "server-key",
    responsesModel: "gpt-5.4",
  };

  assert.equal(mergeRequestPrivateConfig({}, fallback), fallback);
});
