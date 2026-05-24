import { normalizeBaseUrl } from "./responses-workflow.mjs";
import {
  CREATION_LISTING_FIELD_MAX_CHARS,
  buildCreationListingSources,
  normalizeCreationListingDraft,
  validateCreationListingDraft,
} from "./creation-listing-draft.mjs";

const COMPETITOR_BRAND_PATTERN = /\b(?:amazon|walmart|temu|ebay|etsy|target)\b/gi;
const UNSUPPORTED_CLAIM_PATTERNS = [
  /\bfda\s+certified\b/gi,
  /\bmedical\s+grade\b/gi,
  /\bguaranteed?\b/gi,
  /\bbest\b/gi,
  /\bwarranty\b/gi,
];
const DEFAULT_RESPONSES_MODEL = "gpt-5.4";
const SIZE_UNIT_PATTERN = "(?:in|inch|inches|cm|mm|ft|oz|lb|ml|l)";

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

function expectedSize(source = {}) {
  const text = cleanString(source.dimensionSpecs);
  const compound = text.match(new RegExp(`\\b\\d+(?:\\.\\d+)?(?:\\s*${SIZE_UNIT_PATTERN}?\\s*(?:x|×|by)\\s*\\d+(?:\\.\\d+)?){1,2}\\s*${SIZE_UNIT_PATTERN}\\b`, "i"));
  if (compound) {
    return cleanString(compound[0]);
  }
  return text.match(new RegExp(`\\b\\d+(?:\\.\\d+)?\\s*${SIZE_UNIT_PATTERN}\\b`, "i"))?.[0] || "";
}

function buildListingPrompt(source = {}, validationErrors = []) {
  return [
    "You are an Amazon US English listing writer for ecommerce products.",
    `Every field and every bullet must be ${CREATION_LISTING_FIELD_MAX_CHARS} characters or fewer.`,
    `Title rule: start with ${expectedQuantity(source)}. If size is known, place it immediately after quantity.`,
    "After quantity and size, use core search terms, long-tail terms, traffic terms, and descriptive terms without keyword stuffing.",
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
  const skuName = sanitizeListingTerm(source.skuTitle || source.productName, "Product");
  const quantitySize = [quantity, size].filter(Boolean).join(" ");
  const title = joinTruncated([quantity, size, skuName, "Product Listing Draft"]);
  const secondBullet = joinTruncated([skuName, "draft uses SKU-specific product information."]);
  const description = joinTruncated([skuName, "listing draft for US marketplace review."]);
  const backendSearchTerms = joinTruncated([skuName, "product listing"]);
  return normalizeCreationListingDraft({
    id: `listing-${sanitizeListingTerm(source.skuSubjectId || "main", "main").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    skuSubjectId: source.skuSubjectId,
    skuTitle: skuName,
    evidenceMode: source.evidenceMode,
    status: "completed",
    title,
    sellingPoints: ["Built from product inputs, SKU metadata, and available creation evidence."],
    painPoints: ["Helps shoppers compare product variants with concise details."],
    fiveBullets: [
      truncateField(`${quantitySize} format keeps quantity and size visible.`),
      secondBullet,
      "Copy stays conservative when generated images are unavailable.",
      "Keyword structure supports US marketplace review.",
      "Each bullet is kept under the configured character limit.",
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
