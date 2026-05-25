import { normalizeBaseUrl } from "./responses-workflow.mjs";
import {
  CREATION_LISTING_FIELD_MAX_CHARS,
  buildCreationListingSources,
  normalizeCreationListingDraft,
  validateCreationListingDraft,
} from "./creation-listing-draft.mjs";

const COMPETITOR_BRAND_PATTERN = /\b(?:amazon|walmart|temu|ebay|etsy|target)\b/gi;
const CJK_TEXT_PATTERN = /[\u3400-\u9fff]/u;
const CJK_TEXT_GLOBAL_PATTERN = /[\u3400-\u9fff]+/gu;
const NON_ASCII_TEXT_PATTERN = /[^\x20-\x7E]+/g;
const UNSUPPORTED_CLAIM_PATTERNS = [
  /\bfda\s+certified\b/gi,
  /\bmedical\s+grade\b/gi,
  /\bguaranteed?\b/gi,
  /\bbest\b/gi,
  /\bwarranty\b/gi,
];
const DEFAULT_RESPONSES_MODEL = "gpt-5.4";
const SIZE_UNIT_PATTERN = "(?:in|inch|inches|cm|mm|ft|oz|lb|lbs|g|kg|ml|l)";
const LISTING_TITLE_MAX_CHARS = 200;
const LISTING_SEO_AGENT_GUIDELINES = [
  "1. high-search Amazon SEO: lead with the exact product keyword, then use long-tail, traffic, and descriptive terms naturally without keyword stuffing.",
  "2. Title unit rule: start with pack quantity, then size; if source dimensions include both metric and imperial units, include both in the title, and do not invent conversions when only one system is provided.",
  "3. Selling point rule: every sellingPoints item and every relevant bullet must pair one concrete product feature + buyer outcome or effect.",
  "4. Pain point rule: every painPoints item must name a real seller/customer use pain point + solution explaining how the product or listing copy resolves it.",
  "5. Structure rule: write exactly five bullets, keep fields concise and schema-valid, and separate title, selling points, pain points, bullets, description, backend terms, and keyword buckets.",
];
const CHINESE_PRODUCT_KEYWORD_RULES = [
  {
    pattern: /(?=.*(?:电动|充电|电子))(?=.*(?:路亚|鱼饵|仿生|拟饵|硬饵))/u,
    term: "Electric Fishing Lure",
  },
  {
    pattern: /(?:路亚|鱼饵|仿生鱼饵|拟饵|硬饵)/u,
    term: "Fishing Lure",
  },
];

export const CREATION_LISTING_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "sellingPoints",
    "painPoints",
    "fiveBullets",
    "description",
    "backendSearchTerms",
    "keywordBuckets",
    "missingInfo",
    "warnings",
    "zhDisplay",
  ],
  properties: {
    title: { type: "string" },
    sellingPoints: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    painPoints: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    fiveBullets: {
      type: "array",
      items: { type: "string" },
      minItems: 5,
      maxItems: 5,
    },
    description: { type: "string" },
    backendSearchTerms: { type: "string" },
    keywordBuckets: {
      type: "object",
      additionalProperties: false,
      required: ["exact", "longTail", "traffic", "descriptive"],
      properties: {
        exact: {
          type: "array",
          items: { type: "string" },
        },
        longTail: {
          type: "array",
          items: { type: "string" },
        },
        traffic: {
          type: "array",
          items: { type: "string" },
        },
        descriptive: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    missingInfo: {
      type: "array",
      items: { type: "string" },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
    zhDisplay: {
      type: "object",
      additionalProperties: false,
      required: [
        "title",
        "sellingPoints",
        "painPoints",
        "fiveBullets",
        "description",
        "backendSearchTerms",
        "keywordBuckets",
      ],
      properties: {
        title: { type: "string" },
        sellingPoints: {
          type: "array",
          items: { type: "string" },
        },
        painPoints: {
          type: "array",
          items: { type: "string" },
        },
        fiveBullets: {
          type: "array",
          items: { type: "string" },
        },
        description: { type: "string" },
        backendSearchTerms: { type: "string" },
        keywordBuckets: {
          type: "object",
          additionalProperties: false,
          required: ["exact", "longTail", "traffic", "descriptive"],
          properties: {
            exact: {
              type: "array",
              items: { type: "string" },
            },
            longTail: {
              type: "array",
              items: { type: "string" },
            },
            traffic: {
              type: "array",
              items: { type: "string" },
            },
            descriptive: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
    },
  },
};

function cleanString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function truncateField(value) {
  return cleanString(value).slice(0, CREATION_LISTING_FIELD_MAX_CHARS);
}

function joinTruncated(parts) {
  return truncateField(parts.filter(Boolean).join(" "));
}

function sanitizeListingTerm(value, fallback = "Product") {
  let text = cleanString(value);
  for (const pattern of UNSUPPORTED_CLAIM_PATTERNS) {
    text = text.replace(pattern, " ");
  }
  text = text.replace(COMPETITOR_BRAND_PATTERN, " ");
  text = cleanString(text.replace(/\s+[-|,]\s+|\s{2,}/g, " "));
  return truncateField(text || fallback);
}

function toAsciiListingText(value) {
  return cleanString(String(value ?? "")
    .replace(CJK_TEXT_GLOBAL_PATTERN, " ")
    .replace(NON_ASCII_TEXT_PATTERN, " "));
}

function titleCaseIfSlugLike(value) {
  const text = cleanString(String(value || "").replace(/[-_]+/g, " "));
  if (!text) {
    return "";
  }
  const words = text.split(/\s+/);
  const slugLike = words.every((word) => /^[a-z0-9/&().]+$/.test(word));
  if (!slugLike) {
    return text;
  }
  return words.map((word) => {
    if (/^\d/.test(word) || word.length <= 2 && word === word.toUpperCase()) {
      return word;
    }
    return word.slice(0, 1).toUpperCase() + word.slice(1);
  }).join(" ");
}

function sanitizeEnglishListingTerm(value, fallback = "Product") {
  const sanitized = sanitizeListingTerm(value, "");
  const ascii = titleCaseIfSlugLike(toAsciiListingText(sanitized));
  return /[A-Za-z]/.test(ascii) ? truncateField(ascii) : fallback;
}

function sourceTextValues(source = {}) {
  return [
    source.productName,
    source.skuTitle,
    source.productDescription,
    source.skuNote,
    ...(Array.isArray(source.sellingPoints) ? source.sellingPoints : []),
    ...(Array.isArray(source.skuSubjects)
      ? source.skuSubjects.flatMap((sku) => [sku.title, sku.note])
      : []),
  ].map(cleanString).filter(Boolean);
}

function inferEnglishProductKeyword(source = {}) {
  const productValues = sourceTextValues(source);
  const combinedProductText = productValues.join(" ");
  if (CJK_TEXT_PATTERN.test(combinedProductText)) {
    for (const { pattern, term } of CHINESE_PRODUCT_KEYWORD_RULES) {
      if (pattern.test(combinedProductText)) {
        return term;
      }
    }
  }

  for (const value of productValues) {
    const term = sanitizeEnglishListingTerm(value, "");
    if (term && !/^(?:product|sample product)$/i.test(term)) {
      return term;
    }
  }

  const categoryTail = cleanString(source.industryTemplatePath).split(/[>|/]+/).at(-1);
  const categoryTerm = sanitizeEnglishListingTerm(categoryTail, "");
  if (categoryTerm) {
    return categoryTerm;
  }

  return "Product";
}

function normalizeListingTitle(value, fallback = "Product") {
  let text = sanitizeEnglishListingTerm(value, "");
  text = cleanString(text
    .replace(/\blisting\s+draft\b/gi, " ")
    .replace(/[^A-Za-z0-9,\-&/().\s]/g, " "));
  const counts = new Map();
  const tokens = [];
  for (const token of text.split(/\s+/)) {
    const key = token.replace(/[^A-Za-z0-9]+/g, "").toLowerCase();
    if (key) {
      const count = counts.get(key) || 0;
      if (count >= 2) {
        continue;
      }
      counts.set(key, count + 1);
    }
    tokens.push(token);
  }
  const normalized = cleanString(tokens.join(" "))
    .slice(0, LISTING_TITLE_MAX_CHARS)
    .replace(/[,\-/\s]+$/g, "");
  return normalized || fallback;
}

function stripJsonFence(text) {
  return cleanString(text)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseJsonText(text) {
  const cleaned = stripJsonFence(text);
  if (!cleaned) {
    throw new Error("Listing response did not include JSON text.");
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Listing response was not valid JSON.");
  }
}

function collectResponseText(value, parts = []) {
  if (!value || typeof value !== "object") {
    return parts;
  }

  if (typeof value.output_text === "string") {
    parts.push(value.output_text);
  }

  if (typeof value.text === "string") {
    parts.push(value.text);
  }

  if (value.json && typeof value.json === "object") {
    parts.push(JSON.stringify(value.json));
  }

  if (Array.isArray(value.output)) {
    value.output.forEach((item) => collectResponseText(item, parts));
  }

  if (Array.isArray(value.content)) {
    value.content.forEach((item) => collectResponseText(item, parts));
  }

  return parts;
}

function extractResponseText(payload = {}) {
  return collectResponseText(payload).join("\n").trim();
}

function expectedQuantity(source = {}) {
  const count = Number(source.skuBundleCount) || 1;
  return `${count} Pack`;
}

function sizeValueUnitTokens(value = "") {
  return [...cleanString(value).matchAll(new RegExp(`\\b\\d+(?:\\.\\d+)?\\s*${SIZE_UNIT_PATTERN}\\b`, "gi"))]
    .map((match) => cleanString(match[0].replace(/\s+/g, " ")));
}

function hasMetricAndImperialUnits(tokens = []) {
  const combined = tokens.join(" ");
  return /\b(?:cm|mm|g|kg|ml|l)\b/i.test(combined)
    && /\b(?:in|inch|inches|ft|oz|lb|lbs)\b/i.test(combined);
}

function expectedSize(source = {}) {
  const text = cleanString(source.dimensionSpecs);
  const slashCompound = text.match(new RegExp(`\\b\\d+(?:\\.\\d+)?\\s*${SIZE_UNIT_PATTERN}\\s*/\\s*\\d+(?:\\.\\d+)?\\s*${SIZE_UNIT_PATTERN}\\b`, "i"));
  if (slashCompound) {
    const tokens = sizeValueUnitTokens(slashCompound[0]);
    if (hasMetricAndImperialUnits(tokens)) {
      return tokens.join(" / ");
    }
    return cleanString(slashCompound[0].replace(/\s+/g, ""));
  }
  const unitTokens = sizeValueUnitTokens(text);
  if (unitTokens.length > 1 && hasMetricAndImperialUnits(unitTokens)) {
    return unitTokens.join(" / ");
  }
  const compound = text.match(new RegExp(`\\b\\d+(?:\\.\\d+)?(?:\\s*${SIZE_UNIT_PATTERN}?\\s*(?:x|×|by)\\s*\\d+(?:\\.\\d+)?){1,2}\\s*${SIZE_UNIT_PATTERN}\\b`, "i"));
  if (compound) {
    return cleanString(compound[0]);
  }
  return text.match(new RegExp(`\\b\\d+(?:\\.\\d+)?\\s*${SIZE_UNIT_PATTERN}\\b`, "i"))?.[0] || "";
}

function buildListingPrompt(source = {}, validationErrors = []) {
  return [
    "You are Listing SEO Agent, a dedicated Amazon US English listing writer and optimization agent for ecommerce products.",
    "Create exactly one parent listing draft for the whole saved creation set.",
    Array.isArray(source.skuSubjects) && source.skuSubjects.length > 0
      ? "Treat SKU subjects as variants/options within this single listing. Do not create separate listings per SKU."
      : "",
    "Five-point listing quality constraints:",
    ...LISTING_SEO_AGENT_GUIDELINES,
    `Every field and every bullet must be ${CREATION_LISTING_FIELD_MAX_CHARS} characters or fewer.`,
    `Title rule: start with ${expectedQuantity(source)}. If size is known, place it immediately after quantity.`,
    "After quantity and size, use core search terms, long-tail terms, traffic terms, and descriptive terms without keyword stuffing.",
    "Public listing fields must be English only: title, sellingPoints, painPoints, fiveBullets, description, backendSearchTerms, and keywordBuckets.",
    "Return zhDisplay as a Chinese UI-only reference translation; zhDisplay must not replace the English public listing fields.",
    'Do not use the phrase "Listing Draft" in public listing fields.',
    "Use a Rufus-friendly structure around product type, concrete attributes, use cases, buyer pain points, and searchable terms.",
    "Use generated images only as visual evidence. Do not invent material, warranty, certification, compatibility, medical, safety, or performance claims.",
    source.evidenceMode === "input-only"
      ? "Generated images are unavailable. Use only product inputs and saved SKU metadata. Mark missing visual facts in missingInfo."
      : "Generated images or saved image metadata are available. Use them for visible selling points and pain points.",
    validationErrors.length ? `Fix these validation errors: ${validationErrors.join("; ")}` : "",
    `Source JSON:\n${JSON.stringify(source, null, 2)}`,
  ].filter(Boolean).join("\n\n");
}

function buildValidationOptions(source = {}) {
  return {
    expectedQuantity: expectedQuantity(source),
    expectedSize: expectedSize(source),
  };
}

function makeRequestBody({ responsesModel, reasoningEffort, source, validationErrors }) {
  return {
    model: responsesModel || DEFAULT_RESPONSES_MODEL,
    reasoning: { effort: reasoningEffort || "medium" },
    input: buildListingPrompt(source, validationErrors),
    text: {
      format: {
        type: "json_schema",
        name: "creation_listing_draft_json",
        strict: true,
        schema: CREATION_LISTING_JSON_SCHEMA,
      },
    },
    stream: false,
  };
}

async function readResponsePayload(response) {
  const text = await response.text();
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { output_text: text };
  }
}

function upstreamErrorMessage(payload = {}, status) {
  return payload.error?.message || payload.message || `Listing request failed with HTTP ${status}`;
}

function normalizeAndValidateDraft(parsed, source) {
  const draft = normalizeCreationListingDraft(parsed, source);
  return validateCreationListingDraft(draft, buildValidationOptions(source));
}

function withFailedStatus(draft, validationErrors) {
  const warnings = [...(Array.isArray(draft.warnings) ? draft.warnings : []), ...validationErrors]
    .map(truncateField)
    .filter(Boolean);
  return { ...draft, status: "failed", warnings };
}

export function makeMockCreationListingDraft(source = {}) {
  const quantity = expectedQuantity(source);
  const size = expectedSize(source);
  const skuName = inferEnglishProductKeyword(source);
  const variants = Array.isArray(source.skuSubjects)
    ? source.skuSubjects
      .map((sku) => sanitizeEnglishListingTerm(sku.title, "") || sanitizeEnglishListingTerm(sku.id, ""))
      .filter(Boolean)
    : [];
  const variantText = variants.length > 0 ? `Includes ${variants.length} selectable SKU variants: ${variants.slice(0, 4).join(", ")}.` : "";
  const zhVariantText = variants.length > 0 ? `包含 ${variants.length} 个可选 SKU 变体。` : "";
  const variantTitleText = variants.length > 1 ? `${variants.length} Variant Options` : "";
  const quantitySize = [quantity, size].filter(Boolean).join(" ");
  const title = normalizeListingTitle(joinTruncated([quantity, size, skuName, variantTitleText]), skuName);
  const secondBullet = joinTruncated([variantText || skuName, "copy keeps SKU details searchable for faster shopper comparison."]);
  const description = joinTruncated([skuName, "listing copy built from provided product facts for US marketplace review."]);
  const backendSearchTerms = joinTruncated([skuName, "product listing searchable variant comparison"]);
  return normalizeCreationListingDraft({
    id: `listing-${sanitizeListingTerm(source.setId || "main", "main").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    skuSubjectId: source.skuSubjectId,
    skuTitle: skuName,
    evidenceMode: source.evidenceMode,
    status: "completed",
    title,
    sellingPoints: [
      "Provided product attributes are converted into searchable copy so shoppers can identify the offer quickly.",
      "SKU metadata and available image evidence are organized into feature-led claims with clear buyer outcomes.",
    ],
    painPoints: [
      "Sellers often struggle to turn specs into searchable listing copy; this draft maps pack count, size, and variants into shopper-ready language.",
      "Shoppers may compare similar variants slowly; concise SKU and size details reduce selection friction.",
    ],
    fiveBullets: [
      truncateField(`${quantitySize} format keeps quantity and size visible so shoppers confirm the offer at a glance.`),
      secondBullet,
      "Conservative copy uses only supplied product facts to avoid unsupported material, certification, or performance claims.",
      "Keyword structure combines exact, long-tail, traffic, and descriptive terms for US marketplace search relevance.",
      "Five-bullet layout keeps feature, use case, and buyer outcome clear within the configured character limit.",
    ],
    description,
    backendSearchTerms,
    keywordBuckets: {
      exact: [skuName],
      longTail: [backendSearchTerms],
      traffic: ["product listing"],
      descriptive: ["sku specific"],
    },
    missingInfo: source.evidenceMode === "input-only" ? ["Generated image evidence was unavailable."] : [],
    warnings: source.warnings || [],
    zhDisplay: {
      title: `${quantitySize} ${skuName} Listing 中文参考`,
      sellingPoints: [
        "基于商品输入、SKU 元数据和可用图片证据整理卖点。",
        "把产品特征转成更容易检索和理解的 Listing 文案。",
      ],
      painPoints: [
        "卖家常难把规格转成搜索友好的文案；草稿会突出数量、尺寸和变体。",
        "买家比较相似变体时容易犹豫；清晰 SKU 信息能减少选择成本。",
      ],
      fiveBullets: [
        `${quantitySize} 规格让数量和尺寸更醒目。`,
        zhVariantText || "SKU 信息会被整理为可读的商品说明。",
        "文案仅基于已提供事实，避免无依据承诺。",
        "关键词结构覆盖精准词、长尾词、流量词和描述词。",
        "五点描述兼顾特征、场景和效果。",
      ],
      description: `${skuName} 的美国站 Listing 中文参考。`,
      backendSearchTerms: `${skuName} 商品 listing 关键词`,
      keywordBuckets: {
        exact: [skuName],
        longTail: [`${skuName} 长尾词`],
        traffic: ["商品流量词"],
        descriptive: ["SKU 变体"],
      },
    },
  }, source);
}

export async function requestCreationListingDraft({
  baseUrl,
  apiKey,
  responsesModel,
  reasoningEffort = "medium",
  source,
  fetchImpl = fetch,
  mock = false,
}) {
  if (mock) {
    return makeMockCreationListingDraft(source);
  }

  let validationErrors = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchImpl(`${normalizeBaseUrl(baseUrl)}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(makeRequestBody({
        responsesModel,
        reasoningEffort,
        source,
        validationErrors,
      })),
    });
    const payload = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(upstreamErrorMessage(payload, response.status));
    }

    try {
      const parsed = parseJsonText(extractResponseText(payload));
      const validation = normalizeAndValidateDraft(parsed, source);
      if (validation.ok) {
        return validation.draft;
      }
      validationErrors = validation.errors;
    } catch (error) {
      validationErrors = [error instanceof Error ? error.message : String(error)];
    }
  }

  return withFailedStatus(makeMockCreationListingDraft(source), validationErrors);
}

export async function generateCreationListingDrafts({ set, config = {}, fetchImpl = fetch, mock = false }) {
  const sources = buildCreationListingSources(set);
  const drafts = [];
  for (const source of sources) {
    drafts.push(await requestCreationListingDraft({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      responsesModel: config.responsesModel,
      reasoningEffort: config.reasoningEffort,
      source,
      fetchImpl,
      mock,
    }));
  }
  return drafts;
}
