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
    title: "2 Pack Blue Fishing Lures for Bass 3.5 in",
    sellingPoints: ["Bright blue profile helps organize color variants."],
    painPoints: ["Flat lure movement can be ignored in stained water; the bright profile helps the bait stay noticeable."],
    fiveBullets: [
      "CORE VALUE: 2 Pack 3.5 in size fits common freshwater tackle storage.",
      "BUILT TO LAST: Blue lure profile supports clear SKU identification.",
      "REAL-LIFE USE: Compact design works for bass fishing presentations.",
      "SIZE & FIT: Clear product details keep color, size, and pack information easy to compare.",
      "PACKAGE SNAPSHOT: Concise wording keeps searchable product terms natural.",
    ],
    description: "Blue fishing lure option for US marketplace shoppers.",
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
    return new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidDraft({
        title: "2 Pack Electric Fishing Lure for Bass 3.5 in / 9 cm",
      })),
    }), { status: 200 });
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
  assert.match(prompt, /Title formula/i);
  assert.match(prompt, /quantity first/i);
  assert.match(prompt, /core product keyword/i);
  assert.match(prompt, /size.*later/i);
  assert.match(prompt, /Do not put.*size.*directly after quantity/i);
  assert.doesNotMatch(prompt, /place it immediately after quantity/);
  assert.match(prompt, /metric and imperial units/);
  assert.match(prompt, /feature \+ buyer outcome/);
  assert.match(prompt, /fear \+ scene resonance/);
  assert.match(prompt, /not shopping uncertainty/i);
  assert.match(prompt, /exactly five bullets/);
  assert.match(prompt, /uppercase lead label/i);
  assert.match(prompt, /BP1.*biggest pain/i);
  assert.match(prompt, /BP5.*package/i);
  assert.match(prompt, /Do not write gift/i);
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

  assert.equal(draft.title, "2 Pack Blue Fishing Lures for Bass 3.5 in");
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
  assert.match(calls[0].body.input, /Title formula: start with 2 Pack/i);
  assert.match(calls[0].body.input, /core product keyword/i);
  assert.match(calls[0].body.input, /size.*later/i);
  assert.match(calls[0].body.input, /Do not put.*size.*directly after quantity/i);
  assert.doesNotMatch(calls[0].body.input, /place it immediately after quantity/);
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

  assert.equal(draft.title, "2 Pack Blue Fishing Lures for Bass 3.5 in");
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
  assert.match(draft.title, /^2 Pack Blue Fishing Lures\b/);
  assert.match(draft.title, /3\.5 in$/);
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
        title: "2 Pack Electric Fishing Lure for Bass 3.5 in",
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
  assert.equal(draft.title, "2 Pack Electric Fishing Lure for Bass 3.5 in");
  assert.doesNotMatch(visibleDraftText(draft), /[\u3400-\u9fff]/u);
});

test("listing agent retries when pain points are shopping uncertainty instead of usage problems", async () => {
  const prompts = [];
  let callCount = 0;
  const fetchImpl = async (_url, init) => {
    callCount += 1;
    prompts.push(JSON.parse(init.body).input);
    const draft = callCount === 1
      ? makeValidDraft({
        title: "2 Pack 3.5 in Blue Fishing Lures for Bass",
        painPoints: [
          "Not sure which color to choose? The parent listing clearly groups blue/silver, yellow/green, and silver/gold options.",
          "Need size details before buying? The listing states 3.5 in size up front.",
        ],
      })
      : makeValidDraft({
        painPoints: [
          "Dead-looking bait can get ignored during slow retrieves; lifelike motion helps create a more natural presentation.",
        ],
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
  assert.match(prompts[1], /usage-scene problem/);
  assert.match(draft.painPoints.join("\n"), /Dead-looking bait/);
});

test("listing agent rejects after two invalid listing responses", async () => {
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

  await assert.rejects(
    requestCreationListingDraft({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      responsesModel: "gpt-5.4",
      reasoningEffort: "medium",
      source: standardSource,
      fetchImpl,
    }),
    (error) => {
      assert.match(error.message, /Listing generation failed validation after 2 attempts/);
      assert.match(error.message, /title must start with quantity/);
      assert.match(error.message, /sellingPoints\[0\] contains unsupported claim "FDA Certified"/);
      return true;
    },
  );

  assert.equal(callCount, 2);
});

test("listing agent accepts compound dimensions after quantity", async () => {
  let callCount = 0;
  const fetchImpl = async () => {
    callCount += 1;
    return new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidDraft({
        title: "2 Pack Desk Organizer Tray for Office Storage 3.5 x 2 in",
        fiveBullets: [
          "CORE VALUE: 2 Pack 3.5 x 2 in size keeps quantity and dimensions visible.",
          "BUILT TO LAST: Compact tray profile supports office storage and desk organization.",
          "REAL-LIFE USE: Desk-friendly shape fits workstations, shelves, and home office setups.",
          "SIZE & FIT: Clear dimensions help shoppers check the tray against available space.",
          "PACKAGE SNAPSHOT: Concise product details keep each bullet focused on the offer.",
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
  assert.match(draft.title, /^2 Pack Desk Organizer Tray\b/);
  assert.match(draft.title, /3\.5 x 2 in$/);
});

test("listing agent retries when a metric plus imperial source title omits one unit", async () => {
  const prompts = [];
  let callCount = 0;
  const fetchImpl = async (_url, init) => {
    callCount += 1;
    prompts.push(JSON.parse(init.body).input);
    const draft = callCount === 1
      ? makeValidDraft({
        title: "2 Pack Blue Fishing Lures for Bass 3.5 in",
      })
      : makeValidDraft({
        title: "2 Pack Blue Fishing Lures for Bass 3.5 in (9 cm)",
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
  assert.match(draft.title, /^2 Pack Blue Fishing Lures\b/);
  assert.match(draft.title, /3\.5 in \(9 cm\)$/);
});

test("listing agent retries when source title places size immediately after quantity", async () => {
  const prompts = [];
  let callCount = 0;
  const fetchImpl = async (_url, init) => {
    callCount += 1;
    prompts.push(JSON.parse(init.body).input);
    const draft = callCount === 1
      ? makeValidDraft({
        title: "2 Pack 3.5 in Blue Fishing Lures for Bass",
      })
      : makeValidDraft({
        title: "2 Pack Blue Fishing Lures for Bass 3.5 in",
      });
    return new Response(JSON.stringify({ output_text: JSON.stringify(draft) }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: standardSource,
    fetchImpl,
  });

  assert.equal(callCount, 2);
  assert.match(prompts[1], /title must place size after the product keyword/);
  assert.equal(draft.title, "2 Pack Blue Fishing Lures for Bass 3.5 in");
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
  assert.match(drafts[0].title, /^2 Pack Fishing Lure\b/);
  assert.match(drafts[0].title, /8\.89 cm \(3\.5 in\)$/);
  assert.doesNotMatch(drafts[0].title, /^2 Pack 8\.89 cm/);
  assert.equal(drafts[0].skuSubjectId, "");
  assert.match(drafts[0].fiveBullets.join("\n"), /2 selectable variant options/);
  assert.match(visibleChineseDisplayText(drafts[0]), /可选变体/u);
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

  assert.match(drafts[0].title, /^1 Pack Electric Fishing Lure\b/);
  assert.match(drafts[0].title, /13cm \(5\.12 in\)\/42g \(1\.48 oz\)$/);
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

test("mock mode uses English Amazon-style titles for Chinese source inputs", async () => {
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

  const mockDraft = makeMockCreationListingDraft(source);

  assert.match(mockDraft.title, /^1 Pack Electric Fishing Lure\b/);
  assert.match(mockDraft.title, /13cm\/42g$/);
  assert.equal(mockDraft.title.includes("Listing Draft"), false);
  assert.equal(mockDraft.title.length <= 200, true);
  assert.doesNotMatch(visibleDraftText(mockDraft), /[\u3400-\u9fff]/u);
  assert.equal(validateCreationListingDraft(mockDraft, { expectedQuantity: "1 Pack", expectedSize: "13cm/42g" }).ok, true);
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

  assert.match(draft.title, /^1 Pack First Aid Kit\b/);
  assert.match(draft.title, /0\.35kg \(12\.35 oz\)$/);
  assert.doesNotMatch(visibleDraftText(draft), /\bPBT\b|\bTPE\b|450cm|\*20/);
  assert.equal(validateCreationListingDraft(draft, { expectedQuantity: "1 Pack", expectedSize: "0.35kg (12.35 oz)" }).ok, true);
});

test("mock listing draft uses product-facing copy instead of internal template commentary", () => {
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
    dimensionSpecs: "8cm (3.15 in)",
    skuSubjects: [{ id: "red-first-aid-kit", title: "红色手提急救包", bundleCount: 1 }],
  };

  const draft = makeMockCreationListingDraft(source);
  const publicText = visibleDraftText(draft);

  assert.match(draft.title, /^1 Pack First Aid Kit\b/);
  assert.match(draft.title, /8cm \(3\.15 in\)$/);
  assert.match(publicText, /\bFirst Aid Kit\b/);
  assert.match(publicText, /\b(?:home|travel|emergency|compact|portable|quick access)\b/i);
  assert.doesNotMatch(
    publicText,
    /\b(?:Provided product attributes|searchable copy|shopper-ready language|Sellers often struggle|Product details are based on provided inputs|Keyword structure combines|product listing searchable variant comparison|sku specific)\b/i,
  );
  assert.equal(validateCreationListingDraft(draft, { expectedQuantity: "1 Pack", expectedSize: "8cm (3.15 in)" }).ok, true);
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

  assert.match(draft.title, /^1 Pack Bandages\b/);
  assert.match(draft.title, /10cm$/);
  assert.doesNotMatch(draft.title, /\bFirst Aid Kit\b/);
  assert.equal(validateCreationListingDraft(draft, { expectedQuantity: "1 Pack", expectedSize: "10cm" }).ok, true);
});

test("mock drafts keep long SKU fields under 500 characters", () => {
  const longSkuName = `Desk Organizer ${"storage ".repeat(90)}`;
  const source = {
    ...standardSource,
    productName: longSkuName,
    skuTitle: longSkuName,
    dimensionSpecs: "3.5 x 2 in",
  };
  const mockDraft = makeMockCreationListingDraft(source);

  const fields = [
    mockDraft.title,
    mockDraft.description,
    mockDraft.backendSearchTerms,
    ...mockDraft.sellingPoints,
    ...mockDraft.painPoints,
    ...mockDraft.fiveBullets,
    ...Object.values(mockDraft.keywordBuckets).flat(),
  ];
  assert.equal(fields.every((value) => value.length <= 500), true);
  assert.equal(
    validateCreationListingDraft(mockDraft, { expectedQuantity: "2 Pack", expectedSize: "3.5 x 2 in" }).ok,
    true,
  );
});
