import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  appendBrowserConfigToFormData,
  normalizeBrowserPrivateConfig,
  toPublicBrowserConfig,
} from "../public/lib/browser-config.mjs";
import { createCreationListingController } from "../public/lib/creation-listing-view.mjs";

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
  assert.match(app, /from "\/lib\/creation-listing-view\.mjs"/);
  assert.ok(lineCount < 15500, `public/app.js should stay below the shell budget, got ${lineCount}`);
});

test("creation listing controller sends browser-private request config", async () => {
  let capturedRequest = null;
  const selectedSet = {
    setId: "creation-set-api-key",
    productName: "Listing Probe",
  };
  const state = {
    creation: {
      listingGeneratingSetId: "",
      recordSetId: "",
      sets: [selectedSet],
    },
  };
  const controller = createCreationListingController({
    compactErrorMessage: (message) => message,
    fetchImpl: async (url, options) => {
      capturedRequest = {
        url,
        body: JSON.parse(options.body),
      };
      return new Response(
        JSON.stringify({
          ok: true,
          set: {
            ...selectedSet,
            listingDrafts: [{ title: "1 Pack Listing Probe" }],
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    },
    getRequestConfig: () => ({
      baseUrl: "https://api.example.test/v1",
      apiKey: "sk-browser-secret",
      responsesModel: "gpt-5.5",
    }),
    getSelectedSet: () => selectedSet,
    nowIso: () => "2026-05-24T00:00:00.000Z",
    refs: {},
    renderRecordView: () => {},
    setFeedback: () => {},
    state,
    upsertSet: (set) => {
      state.creation.sets = [set];
      return set;
    },
  });

  const nextSet = await controller.generate();

  assert.equal(capturedRequest.url, "/api/creation/listings");
  assert.deepEqual(capturedRequest.body, {
    baseUrl: "https://api.example.test/v1",
    apiKey: "sk-browser-secret",
    responsesModel: "gpt-5.5",
    setId: selectedSet.setId,
  });
  assert.equal(nextSet.listingDrafts.length, 1);
  assert.equal(state.creation.listingGeneratingSetId, "");
  assert.equal(state.creation.recordSetId, selectedSet.setId);
});
