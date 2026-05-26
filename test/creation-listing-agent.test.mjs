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

function visibleChineseDisplayText(draft) {
  return [
    draft.zhDisplay?.title,
    ...(draft.zhDisplay?.sellingPoints || []),
    ...(draft.zhDisplay?.painPoints || []),
    ...(draft.zhDisplay?.fiveBullets || []),
    draft.zhDisplay?.description,
    draft.zhDisplay?.backendSearchTerms,
    ...Object.values(draft.zhDisplay?.keywordBuckets || {}).flat(),
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

test("strict listing schema marks every top-level property as required", () => {
  assert.deepEqual(
    [...CREATION_LISTING_JSON_SCHEMA.required].sort(),
    Object.keys(CREATION_LISTING_JSON_SCHEMA.properties).sort(),
  );
});

test("listing agent prompt uses dedicated SEO five-point constraints", async () => {
  const calls = [];
  const fetchImpl = async (_url, init) => {
    calls.push({ body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ output_text: JSON.stringify(makeValidDraft()) }), { status: 200 });
  };

  await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      productDescription: "Blue lure with metric and imperial size notes.",
      dimensionSpecs: "3.5 in / 9 cm",
      sellingPoints: ["Reflective finish", "Compact shape"],
    },
    fetchImpl,
  });

  const prompt = calls[0].body.input;
  assert.match(prompt, /Listing SEO Agent/);
  assert.match(prompt, /Five-point listing quality constraints/);
  assert.match(prompt, /high-search Amazon SEO/);
  assert.match(prompt, /metric and imperial units/);
  assert.match(prompt, /feature \+ buyer outcome/);
  assert.match(prompt, /pain point \+ solution/);
  assert.match(prompt, /exactly five bullets/);
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
  assert.ok(calls[0].body.text.format.schema.required.includes("zhDisplay"));
  assert.ok(calls[0].body.text.format.schema.properties.zhDisplay.required.includes("warnings"));
  assert.ok(calls[0].body.text.format.schema.properties.zhDisplay.required.includes("missingInfo"));
  assert.match(calls[0].body.input, /Amazon US English listing writer/);
  assert.match(calls[0].body.input, /Every field and every bullet must be 500 characters or fewer/);
  assert.match(calls[0].body.input, /Title rule: start with 2 Pack/);
  assert.match(calls[0].body.input, /place it immediately after quantity/);
  assert.match(calls[0].body.input, /Public listing fields must be English only/);
  assert.match(calls[0].body.input, /sellingPoints and painPoints must each be 500 English characters or fewer in total/);
  assert.match(calls[0].body.input, /zhDisplay/);
  assert.match(calls[0].body.input, /warnings and missingInfo/);
  assert.ok(calls[0].body.text.format.schema.properties.zhDisplay);
  assert.match(calls[0].body.input, /Do not use the phrase "Listing Draft"/);
  assert.match(calls[0].body.input, /Rufus-friendly/);
  assert.match(calls[0].body.input, /Do not invent material, warranty, certification, compatibility, medical, safety, or performance claims/);
});

test("listing agent times out stalled upstream requests", async () => {
  const fetchImpl = async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    });
  });

  await assert.rejects(
    requestCreationListingDraft({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      responsesModel: "gpt-5.4",
      source: standardSource,
      fetchImpl,
      requestTimeoutMs: 5,
    }),
    /Listing request timed out after 5ms/,
  );
});

test("listing agent accepts UI-only Chinese display text alongside English public copy", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    output_text: JSON.stringify(makeValidDraft({
      zhDisplay: {
        title: "2 件 3.5 英寸蓝色路亚鱼饵",
        sellingPoints: ["亮蓝色外观便于区分颜色变体。"],
        painPoints: ["减少挑选紧凑型鱼饵颜色时的判断成本。"],
        fiveBullets: [
          "2 件 3.5 英寸规格适合常见淡水钓具收纳。",
          "蓝色鱼饵外观便于识别 SKU。",
          "紧凑设计适用于鲈鱼钓法展示。",
          "商品细节基于已提供信息和 SKU 元数据。",
          "关键词导向文案保持简洁。",
        ],
        description: "蓝色路亚鱼饵的美国站 Listing 中文对照。",
        backendSearchTerms: "蓝色 路亚 鱼饵 鲈鱼",
        keywordBuckets: {
          exact: ["蓝色路亚鱼饵"],
          longTail: ["3.5 英寸鲈鱼鱼饵"],
          traffic: ["淡水鱼饵"],
          descriptive: ["紧凑蓝色鱼饵"],
        },
      },
    })),
  }), { status: 200 });

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: standardSource,
    fetchImpl,
  });

  assert.doesNotMatch(visibleDraftText(draft), /[\u3400-\u9fff]/u);
  assert.match(visibleChineseDisplayText(draft), /蓝色路亚鱼饵/u);
  assert.equal(validateCreationListingDraft(draft, { expectedQuantity: "2 Pack", expectedSize: "3.5 in" }).ok, true);
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

test("listing agent retries when public listing fields contain Chinese", async () => {
  const prompts = [];
  let callCount = 0;
  const fetchImpl = async (_url, init) => {
    callCount += 1;
    prompts.push(JSON.parse(init.body).input);
    const draft = callCount === 1
      ? makeValidDraft({
        title: "2 Pack 3.5 in 路亚硬饵 Product Listing Draft",
        fiveBullets: [
          "2 Pack 3.5 in format keeps quantity and size visible.",
          "路亚硬饵 draft uses saved product and SKU information.",
          "Copy stays conservative when generated images are unavailable.",
          "Keyword structure supports US marketplace review.",
          "Each bullet is kept under the configured character limit.",
        ],
        backendSearchTerms: "路亚硬饵 product listing",
      })
      : makeValidDraft({
        title: "2 Pack 3.5 in Electric Fishing Lure for Bass",
        backendSearchTerms: "electric fishing lure bass bait",
      });
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
  assert.match(prompts[1], /public listing fields must be English/i);
  assert.equal(draft.title, "2 Pack 3.5 in Electric Fishing Lure for Bass");
  assert.doesNotMatch(visibleDraftText(draft), /[\u3400-\u9fff]/u);
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

test("listing agent accepts compound dimensions after quantity", async () => {
  let callCount = 0;
  const fetchImpl = async () => {
    callCount += 1;
    return new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidDraft({
        title: "2 Pack 3.5 x 2 in Desk Organizer Tray for Office Storage",
        fiveBullets: [
          "2 Pack 3.5 x 2 in size keeps quantity and dimensions visible.",
          "Compact tray profile supports office storage and desk organization.",
          "SKU-specific copy is based on provided product information.",
          "Conservative listing language avoids unsupported product claims.",
          "Keyword-focused copy keeps each bullet within the limit.",
        ],
      })),
    }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      productName: "Desk Organizer Tray",
      skuTitle: "Desk Organizer Tray",
      dimensionSpecs: "3.5 x 2 in",
    },
    fetchImpl,
  });

  assert.equal(callCount, 1);
  assert.match(draft.title, /^2 Pack 3\.5 x 2 in/);
});

test("listing agent retries when a metric plus imperial source title omits one unit", async () => {
  const prompts = [];
  let callCount = 0;
  const fetchImpl = async (_url, init) => {
    callCount += 1;
    prompts.push(JSON.parse(init.body).input);
    const draft = callCount === 1
      ? makeValidDraft({
        title: "2 Pack 3.5 in Blue Fishing Lures for Bass",
        fiveBullets: [
          "2 Pack 3.5 in size fits common freshwater tackle storage.",
          "Blue lure profile supports clear SKU identification.",
          "Compact design works for bass fishing presentations.",
          "Product details are based on provided inputs and SKU metadata.",
          "Keyword-focused copy keeps listing language concise.",
        ],
      })
      : makeValidDraft({
        title: "2 Pack 3.5 in (9 cm) Blue Fishing Lures for Bass",
        fiveBullets: [
          "2 Pack 3.5 in (9 cm) size fits common freshwater tackle storage.",
          "Blue lure profile supports clear SKU identification.",
          "Compact design works for bass fishing presentations.",
          "Product details are based on provided inputs and SKU metadata.",
          "Keyword-focused copy keeps listing language concise.",
        ],
      });
    return new Response(JSON.stringify({ output_text: JSON.stringify(draft) }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      dimensionSpecs: "3.5 in (9 cm)",
    },
    fetchImpl,
  });

  assert.equal(callCount, 2);
  assert.match(prompts[1], /title must include all expected size units/);
  assert.match(draft.title, /^2 Pack 3\.5 in \(9 cm\)/);
});

test("generateCreationListingDrafts creates one parent draft for all SKU variants", async () => {
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

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].status, "completed");
  assert.match(drafts[0].title, /^2 Pack 8\.89 cm \(3\.5 in\)/);
  assert.equal(drafts[0].skuSubjectId, "");
  assert.match(drafts[0].fiveBullets.join("\n"), /2 selectable SKU variants/);
  assert.match(visibleChineseDisplayText(drafts[0]), /SKU 变体/u);
  assert.equal(validateCreationListingDraft(drafts[0], { expectedQuantity: "2 Pack", expectedSize: "8.89 cm (3.5 in)" }).ok, true);
});

test("generateCreationListingDrafts includes both metric and imperial units in titles when requested", async () => {
  const drafts = await generateCreationListingDrafts({
    set: {
      setId: "set-dual-units",
      productName: "Electric Fishing Lure",
      productDescription: "Jointed lure with LED light and rechargeable battery",
      dimensionSpecs: "13cm/42g",
      dimensionUnitMode: "both",
      skuBundleCount: 1,
    },
    config: { baseUrl: "https://example.test/v1", apiKey: "test-key", responsesModel: "gpt-5.4" },
    fetchImpl() {
      throw new Error("mock mode should not request the network");
    },
    mock: true,
  });

  assert.match(drafts[0].title, /^1 Pack 13cm \(5\.12 in\)\/42g \(1\.48 oz\) Electric Fishing Lure\b/);
  assert.equal(
    validateCreationListingDraft(drafts[0], {
      expectedQuantity: "1 Pack",
      expectedSize: "13cm (5.12 in)/42g (1.48 oz)",
    }).ok,
    true,
  );
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

test("mock and failed fallback drafts use English Amazon-style titles for Chinese source inputs", async () => {
  const source = {
    setId: "set-cn",
    productName: "路亚硬饵",
    skuTitle: "银蓝鳞纹橙红尾电动仿生鱼饵",
    skuBundleCount: 1,
    dimensionSpecs: "13cm/42g",
    industryTemplatePath: "Sports & Outdoors > Fishing > Lures",
    evidenceMode: "image-backed",
    skuSubjects: [
      { id: "silver-blue", title: "银蓝鳞纹橙红尾电动仿生鱼饵", bundleCount: 1 },
      { id: "black-gold", title: "黑金鳞纹电动仿生鱼饵", bundleCount: 1 },
    ],
  };
  const fetchImpl = async () => new Response(JSON.stringify({
    output_text: JSON.stringify(makeValidDraft({ title: "Bad title without quantity" })),
  }), { status: 200 });

  const mockDraft = makeMockCreationListingDraft(source);
  const failedDraft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source,
    fetchImpl,
  });

  for (const draft of [mockDraft, failedDraft]) {
    assert.match(draft.title, /^1 Pack 13cm\/42g Electric Fishing Lure\b/);
    assert.equal(draft.title.includes("Listing Draft"), false);
    assert.equal(draft.title.length <= 200, true);
    assert.doesNotMatch(visibleDraftText(draft), /[\u3400-\u9fff]/u);
    assert.equal(validateCreationListingDraft(draft, { expectedQuantity: "1 Pack", expectedSize: "13cm/42g" }).ok, true);
  }
});

test("mock listing draft does not infer product keywords from numbered first aid kit contents", () => {
  const source = {
    ...standardSource,
    productName: "急救包",
    skuBundleCount: 1,
    productDescription: [
      "配置清单：",
      "1.创口贴*20片",
      "2.5*450cmPBT绷带*3卷",
      "3.7.5*450cmPBT绷带*3卷",
      "16.TPE止血带*1个",
      "21.急救包*1个",
    ].join("\n\n"),
    dimensionSpecs: "重量：0.35kg (12.35 oz)",
    skuSubjects: [{ id: "red-first-aid-kit", title: "红色手提急救包", bundleCount: 1 }],
  };

  const draft = makeMockCreationListingDraft(source);

  assert.match(draft.title, /^1 Pack 0\.35kg \(12\.35 oz\) First Aid Kit\b/);
  assert.doesNotMatch(visibleDraftText(draft), /\bPBT\b|\bTPE\b|450cm|\*20/);
  assert.equal(validateCreationListingDraft(draft, { expectedQuantity: "1 Pack", expectedSize: "0.35kg (12.35 oz)" }).ok, true);
});

test("mock listing draft does not classify single bandage items as a first aid kit", () => {
  const source = {
    ...standardSource,
    productName: "创口贴",
    skuTitle: "",
    skuBundleCount: 1,
    productDescription: "创口贴*20片，独立包装，适合家庭和旅行备用。",
    dimensionSpecs: "10cm",
    industryTemplatePath: "Health & Household > Bandages",
    skuSubjects: [{ id: "adhesive-bandages", title: "创口贴单品", bundleCount: 1 }],
  };

  const draft = makeMockCreationListingDraft(source);

  assert.match(draft.title, /^1 Pack 10cm Bandages\b/);
  assert.doesNotMatch(draft.title, /\bFirst Aid Kit\b/);
  assert.equal(validateCreationListingDraft(draft, { expectedQuantity: "1 Pack", expectedSize: "10cm" }).ok, true);
});

test("mock and fallback drafts keep long SKU fields under 500 characters", async () => {
  const longSkuName = `Desk Organizer ${"storage ".repeat(90)}`;
  const source = {
    ...standardSource,
    productName: longSkuName,
    skuTitle: longSkuName,
    dimensionSpecs: "3.5 x 2 in",
  };
  const mockDraft = makeMockCreationListingDraft(source);
  const failedDraft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source,
    fetchImpl: async () => new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidDraft({ title: "Bad title without quantity" })),
    }), { status: 200 }),
  });

  for (const draft of [mockDraft, failedDraft]) {
    const fields = [
      draft.title,
      draft.description,
      draft.backendSearchTerms,
      ...draft.sellingPoints,
      ...draft.painPoints,
      ...draft.fiveBullets,
      ...Object.values(draft.keywordBuckets).flat(),
    ];
    assert.equal(fields.every((value) => value.length <= 500), true);
    assert.equal(
      validateCreationListingDraft(draft, { expectedQuantity: "2 Pack", expectedSize: "3.5 x 2 in" }).ok,
      true,
    );
  }
});
