export const CREATION_LISTING_FIELD_MAX_CHARS = 500;
export const CREATION_LISTING_MARKETPLACE = "amazon-us";
export const CREATION_LISTING_LANGUAGE = "en-US";

const COMPETITOR_BRAND_TERMS = new Set(["amazon", "walmart", "temu", "ebay", "etsy", "target"]);
const UNSUPPORTED_CLAIM_PATTERNS = [
  { label: "FDA Certified", pattern: /\bfda\s+certified\b/i },
  { label: "medical grade", pattern: /\bmedical\s+grade\b/i },
  { label: "guaranteed", pattern: /\bguaranteed?\b/i },
  { label: "best", pattern: /\bbest\b/i },
  { label: "warranty", pattern: /\bwarranty\b/i },
];

function cleanString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanArray(value) {
  if (Array.isArray(value)) {
    return value.map(cleanString).filter(Boolean);
  }
  return cleanString(value) ? [cleanString(value)] : [];
}

function aliasValue(value, camelKey, snakeKey) {
  return value?.[camelKey] ?? value?.[snakeKey];
}

function makeDraftId(source = {}) {
  const suffix = cleanString(source.skuSubjectId || source.skuTitle || source.setId || "main")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `listing-${suffix || "main"}`;
}

export function dedupeCreationListingKeywords(keywords = []) {
  const seen = new Set();
  const result = [];
  for (const keyword of cleanArray(keywords)) {
    const key = keyword.toLowerCase();
    if (COMPETITOR_BRAND_TERMS.has(key) || hasUnsupportedClaim(keyword) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(keyword);
  }
  return result;
}

function splitBackendTerms(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return cleanString(value).split(/[,\n;]+/);
}

function cleanBackendSearchTerm(value) {
  const tokens = cleanString(value)
    .split(/\s+/)
    .filter((token) => !COMPETITOR_BRAND_TERMS.has(token.toLowerCase()));
  return tokens.join(" ");
}

function normalizeBackendSearchTerms(value) {
  return dedupeCreationListingKeywords(splitBackendTerms(value).map(cleanBackendSearchTerm)).join(" ");
}

function normalizeKeywordBuckets(value = {}) {
  return {
    exact: dedupeCreationListingKeywords(value.exact),
    longTail: dedupeCreationListingKeywords(value.longTail ?? value.long_tail),
    traffic: dedupeCreationListingKeywords(value.traffic),
    descriptive: dedupeCreationListingKeywords(value.descriptive),
  };
}

export function normalizeCreationListingDraft(value = {}, source = {}) {
  const keywordBuckets = normalizeKeywordBuckets(value.keywordBuckets ?? value.keyword_buckets ?? {});
  const createdAt = cleanString(value.createdAt ?? value.created_at) || new Date().toISOString();
  return {
    id: cleanString(value.id) || makeDraftId(source),
    marketplace: cleanString(value.marketplace) || CREATION_LISTING_MARKETPLACE,
    language: cleanString(value.language) || CREATION_LISTING_LANGUAGE,
    skuSubjectId: cleanString(aliasValue(value, "skuSubjectId", "sku_subject_id") ?? source.skuSubjectId),
    skuTitle: cleanString(aliasValue(value, "skuTitle", "sku_title") ?? source.skuTitle),
    evidenceMode: cleanString(aliasValue(value, "evidenceMode", "evidence_mode") ?? source.evidenceMode) || "input-only",
    status: cleanString(value.status) || "completed",
    title: cleanString(value.title),
    sellingPoints: cleanArray(aliasValue(value, "sellingPoints", "selling_points")),
    painPoints: cleanArray(aliasValue(value, "painPoints", "pain_points")),
    fiveBullets: cleanArray(aliasValue(value, "fiveBullets", "five_bullets")),
    description: cleanString(value.description),
    backendSearchTerms: normalizeBackendSearchTerms(aliasValue(value, "backendSearchTerms", "backend_search_terms")),
    keywordBuckets,
    evidence: cleanArray(value.evidence ?? source.evidence),
    missingInfo: cleanArray(aliasValue(value, "missingInfo", "missing_info")),
    warnings: cleanArray(value.warnings ?? source.warnings),
    createdAt,
    updatedAt: cleanString(value.updatedAt ?? value.updated_at) || createdAt,
  };
}

function checkMaxLength(errors, label, value) {
  if (cleanString(value).length > CREATION_LISTING_FIELD_MAX_CHARS) {
    errors.push(`${label} exceeds ${CREATION_LISTING_FIELD_MAX_CHARS} characters`);
  }
}

function hasUnsupportedClaim(value) {
  const text = cleanString(value);
  return UNSUPPORTED_CLAIM_PATTERNS.some(({ pattern }) => pattern.test(text));
}

function checkUnsupportedClaims(errors, label, value) {
  const text = cleanString(value);
  for (const { label: claimLabel, pattern } of UNSUPPORTED_CLAIM_PATTERNS) {
    if (pattern.test(text)) {
      errors.push(`${label} contains unsupported claim "${claimLabel}"`);
    }
  }
}

function titleStartsWithQuantity(title, expectedQuantity) {
  const expected = cleanString(expectedQuantity);
  if (expected) {
    return title.toLowerCase().startsWith(expected.toLowerCase());
  }
  return /^(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:pack|piece|pcs|count|ct|set)\b/i.test(title);
}

export function validateCreationListingDraft(draft = {}, options = {}) {
  const normalized = normalizeCreationListingDraft(draft);
  const errors = [];

  checkMaxLength(errors, "title", normalized.title);
  checkUnsupportedClaims(errors, "title", normalized.title);
  checkMaxLength(errors, "description", normalized.description);
  checkUnsupportedClaims(errors, "description", normalized.description);
  checkMaxLength(errors, "backendSearchTerms", normalized.backendSearchTerms);
  checkUnsupportedClaims(errors, "backendSearchTerms", normalized.backendSearchTerms);
  normalized.sellingPoints.forEach((item, index) => checkMaxLength(errors, `sellingPoints[${index}]`, item));
  normalized.sellingPoints.forEach((item, index) => checkUnsupportedClaims(errors, `sellingPoints[${index}]`, item));
  normalized.painPoints.forEach((item, index) => checkMaxLength(errors, `painPoints[${index}]`, item));
  normalized.painPoints.forEach((item, index) => checkUnsupportedClaims(errors, `painPoints[${index}]`, item));
  normalized.fiveBullets.forEach((item, index) => checkMaxLength(errors, `fiveBullets[${index}]`, item));
  normalized.fiveBullets.forEach((item, index) => checkUnsupportedClaims(errors, `fiveBullets[${index}]`, item));
  for (const [bucket, values] of Object.entries(normalized.keywordBuckets)) {
    values.forEach((item, index) => checkMaxLength(errors, `keywordBuckets.${bucket}[${index}]`, item));
    values.forEach((item, index) => checkUnsupportedClaims(errors, `keywordBuckets.${bucket}[${index}]`, item));
  }

  if (!titleStartsWithQuantity(normalized.title, options.expectedQuantity)) {
    errors.push("title must start with quantity");
  }

  const expectedQuantity = cleanString(options.expectedQuantity);
  const expectedSize = cleanString(options.expectedSize);
  if (expectedQuantity && expectedSize) {
    const expectedPrefix = `${expectedQuantity} ${expectedSize}`.toLowerCase();
    if (!normalized.title.toLowerCase().startsWith(expectedPrefix)) {
      errors.push("title must place size immediately after quantity");
    }
  }

  return { ok: errors.length === 0, errors, draft: normalized };
}

function basename(path) {
  return cleanString(path).split(/[\\/]/).filter(Boolean).at(-1) || "";
}

function itemMatchesSku(item = {}, sku = {}) {
  const skuId = cleanString(sku.id);
  const itemSkuId = cleanString(item.skuSubject?.id ?? item.sku_subject?.id ?? item.skuSubjectId ?? item.sku_subject_id);
  if (skuId && itemSkuId && skuId === itemSkuId) {
    return true;
  }

  const filenames = new Set(cleanArray(sku.filenames).map((filename) => filename.toLowerCase()));
  if (filenames.size === 0) {
    return false;
  }
  const itemNames = [
    cleanString(item.filename),
    basename(item.relativePath),
    basename(item.path),
  ].filter(Boolean).map((name) => name.toLowerCase());
  return itemNames.some((name) => filenames.has(name));
}

function completedImageItems(set = {}, sku = null) {
  const items = Array.isArray(set.items) ? set.items : [];
  return items.filter((item) => {
    if (item.status !== "completed" || !cleanString(item.relativePath)) {
      return false;
    }
    return sku ? itemMatchesSku(item, sku) : true;
  });
}

function skuSubjectIdentity(sku = {}) {
  const id = cleanString(sku.id).toLowerCase();
  if (id) {
    return `id:${id}`;
  }
  const title = cleanString(sku.title).toLowerCase();
  const filenames = cleanArray(sku.filenames).map((filename) => filename.toLowerCase()).sort().join("|");
  return `fallback:${title}:${filenames}`;
}

function uniqueSkuSubjects(skuSubjects = []) {
  const seen = new Set();
  const result = [];
  for (const sku of skuSubjects) {
    const key = skuSubjectIdentity(sku);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(sku);
  }
  return result;
}

export function buildCreationListingSources(set = {}) {
  const skuSubjects = uniqueSkuSubjects(Array.isArray(set.skuSubjects) ? set.skuSubjects : []);
  const subjects = skuSubjects.length > 0 ? skuSubjects : [{ id: "", title: set.productName, filenames: [], note: "" }];
  const allCompletedImages = completedImageItems(set);

  return subjects.map((sku) => {
    const matchingImages = skuSubjects.length > 0 ? completedImageItems(set, sku) : allCompletedImages;
    const sourceImages = matchingImages.length > 0 ? matchingImages : allCompletedImages;
    const evidenceMode = matchingImages.length > 0 ? "image-backed" : sourceImages.length > 0 ? "mixed" : "input-only";
    const warnings = evidenceMode === "input-only"
      ? ["Generated images were unavailable; copy is based on product inputs and saved SKU metadata."]
      : [];

    return {
      setId: cleanString(set.setId),
      productName: cleanString(set.productName),
      productDescription: cleanString(set.productDescription),
      sellingPoints: cleanArray(set.sellingPoints),
      dimensionSpecs: cleanString(set.dimensionSpecs),
      industryTemplatePath: cleanString(set.industryTemplatePath),
      referenceImageRoles: Array.isArray(set.referenceImageRoles) ? set.referenceImageRoles : [],
      skuSubjectId: cleanString(sku.id),
      skuTitle: cleanString(sku.title),
      skuNote: cleanString(sku.note),
      skuFilenames: cleanArray(sku.filenames),
      skuBundleCount: Number(sku.bundleCount || set.skuBundleCount) || 1,
      imageItems: sourceImages,
      plannedItems: Array.isArray(set.items) ? set.items : [],
      evidenceMode,
      warnings,
      evidence: sourceImages.map((item) => cleanString(item.title || item.role || item.itemId)).filter(Boolean),
    };
  });
}
