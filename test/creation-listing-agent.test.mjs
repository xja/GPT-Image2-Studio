import assert from "node:assert/strict";
import test from "node:test";

import { validateCreationListingDraft } from "../lib/creation-listing-draft.mjs";
import {
  CREATION_LISTING_JSON_SCHEMA,
  generateCreationListingDrafts,
  makeMockCreationListingDraft,
  requestCreationListingDraft,
} from "../lib/creation-listing-agent.mjs";

function makeValidDraft(overrides = {}) {
  return {
    title: "2 Pack 3.5 in Blue Fishing Lures for Bass",
    sellingPoints: ["Bright blue profile helps organize color variants."],
    painPoints: ["Reduces guesswork when selecting a compact lure color."],
    fiveBullets: [
      "2 Pack 3.5 in size fits common freshwater tackle storage.",
      "Blue lure profile supports clear SKU identification.",
      "Compact design works for bass fishing presentations.",
      "Product details are based on provided inputs and SKU metadata.",
      "Keyword-focused copy keeps listing language concise.",
    ],
    description: "Blue fishing lure listing draft for US marketplace review.",
    backendSearchTerms: "blue fishing lure bass bait compact lure",
    keywordBuckets: {
      exact: ["blue fishing lure"],
      longTail: ["3.5 in bass lure"],
      traffic: ["freshwater bait"],
      descriptive: ["compact blue lure"],
    },
    missingInfo: [],
    warnings: [],
    ...overrides,
  };
}

function visibleDraftText(draft) {
  return [
    draft.title,
    ...(draft.sellingPoints || []),
    ...(draft.painPoints || []),
    ...(draft.fiveBullets || []),
    draft.description,
    draft.backendSearchTerms,
    ...Object.values(draft.keywordBuckets || {}).flat(),
  ].join("\n");
}

const standardSource = {
  setId: "set-1",
  productName: "Fishing Lure",
  skuTitle: "Blue Lure",
  skuBundleCount: 2,
  dimensionSpecs: "3.5 in",
  evidenceMode: "input-only",
};

function collectSchemaKeys(value, keys = []) {
  if (!value || typeof value !== "object") {
    return keys;
  }
  for (const [key, nested] of Object.entries(value)) {
    keys.push(key);
    collectSchemaKeys(nested, keys);
  }
  return keys;
}

test("strict listing schema leaves character limits to prompt and validation", () => {
  assert.equal(collectSchemaKeys(CREATION_LISTING_JSON_SCHEMA).includes("maxLength"), false);
});

test("listing agent sends a strict JSON schema request with prompt guardrails", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ output_text: JSON.stringify(makeValidDraft()) }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1/",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    reasoningEffort: "medium",
    source: standardSource,
    fetchImpl,
  });

  assert.equal(draft.title, "2 Pack 3.5 in Blue Fishing Lures for Bass");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://example.test/v1/responses");
  assert.equal(calls[0].headers.Authorization, "Bearer test-key");
  assert.equal(calls[0].body.model, "gpt-5.4");
  assert.deepEqual(calls[0].body.reasoning, { effort: "medium" });
  assert.equal(calls[0].body.stream, false);
  assert.equal(calls[0].body.text.format.type, "json_schema");
  assert.equal(calls[0].body.text.format.name, "creation_listing_draft_json");
  assert.equal(calls[0].body.text.format.strict, true);
  assert.deepEqual(calls[0].body.text.format.schema.required, CREATION_LISTING_JSON_SCHEMA.required);
  assert.match(calls[0].body.input, /Amazon US English listing writer/);
  assert.match(calls[0].body.input, /Every field and every bullet must be 500 characters or fewer/);
  assert.match(calls[0].body.input, /Title rule: start with 2 Pack/);
  assert.match(calls[0].body.input, /place it immediately after quantity/);
  assert.match(calls[0].body.input, /Do not invent material, warranty, certification, compatibility, medical, safety, or performance claims/);
});

test("listing agent extracts Responses output content text", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    output: [
      {
        content: [
          { type: "output_text", text: JSON.stringify(makeValidDraft()) },
        ],
      },
    ],
  }), { status: 200 });

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: standardSource,
    fetchImpl,
  });

  assert.equal(draft.title, "2 Pack 3.5 in Blue Fishing Lures for Bass");
});

test("listing agent retries once after validation failure", async () => {
  const prompts = [];
  let callCount = 0;
  const fetchImpl = async (_url, init) => {
    callCount += 1;
    prompts.push(JSON.parse(init.body).input);
    const draft = callCount === 1 ? makeValidDraft({ title: "Bad title without quantity" }) : makeValidDraft();
    return new Response(JSON.stringify({ output_text: JSON.stringify(draft) }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    reasoningEffort: "medium",
    source: standardSource,
    fetchImpl,
  });

  assert.equal(callCount, 2);
  assert.match(prompts[1], /Fix these validation errors: title must start with quantity/);
  assert.match(draft.title, /^2 Pack 3\.5 in/);
});

test("listing agent returns failed conservative mock after two invalid responses", async () => {
  let callCount = 0;
  const fetchImpl = async () => {
    callCount += 1;
    return new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidDraft({
        title: "Bad title without quantity",
        sellingPoints: ["FDA Certified product quality"],
      })),
    }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    reasoningEffort: "medium",
    source: standardSource,
    fetchImpl,
  });

  assert.equal(callCount, 2);
  assert.equal(draft.status, "failed");
  assert.match(draft.title, /^2 Pack 3\.5 in/);
  assert.match(draft.warnings.join("\n"), /title must start with quantity/);
  assert.match(draft.warnings.join("\n"), /sellingPoints\[0\] contains unsupported claim "FDA Certified"/);
  assert.equal(validateCreationListingDraft(draft, { expectedQuantity: "2 Pack", expectedSize: "3.5 in" }).ok, true);
});

test("generateCreationListingDrafts creates one draft per source and mock mode skips network", async () => {
  const drafts = await generateCreationListingDrafts({
    set: {
      setId: "set-1",
      productName: "Fishing Lure",
      dimensionSpecs: "3.5 in",
      skuSubjects: [
        { id: "blue", title: "Blue Lure", bundleCount: 2 },
        { id: "green", title: "Green Lure", bundleCount: 2 },
      ],
    },
    config: { baseUrl: "https://example.test/v1", apiKey: "test-key", responsesModel: "gpt-5.4" },
    fetchImpl() {
      throw new Error("mock mode should not request the network");
    },
    mock: true,
  });

  assert.equal(drafts.length, 2);
  assert.equal(drafts[0].status, "completed");
  assert.match(drafts[0].title, /^2 Pack 3\.5 in/);
  assert.equal(validateCreationListingDraft(drafts[0], { expectedQuantity: "2 Pack", expectedSize: "3.5 in" }).ok, true);
});

test("mock listing drafts avoid unsupported claims and competitor brand terms", () => {
  const draft = makeMockCreationListingDraft({
    setId: "set-unsafe",
    productName: "Amazon FDA Certified Best Fishing Lure",
    skuTitle: "Walmart Medical Grade Warranty Lure",
    skuBundleCount: 2,
    dimensionSpecs: "3.5 in",
    evidenceMode: "input-only",
    warnings: [],
  });

  const validation = validateCreationListingDraft(draft, { expectedQuantity: "2 Pack", expectedSize: "3.5 in" });
  assert.equal(validation.ok, true);
  assert.doesNotMatch(visibleDraftText(draft), /\b(?:amazon|walmart|temu|ebay|etsy|target)\b/i);
  assert.doesNotMatch(visibleDraftText(draft), /\b(?:FDA Certified|medical grade|guaranteed|best|warranty)\b/i);
});
