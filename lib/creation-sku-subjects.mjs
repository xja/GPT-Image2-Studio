function cleanString(value) {
  return String(value || "").trim();
}

const DEFAULT_SKU_BUNDLE_COUNT = 1;
const MAX_SKU_BUNDLE_COUNT = 20;
const SKU_BUNDLE_COUNT_WORDS = new Map([
  ["单", 1],
  ["一", 1],
  ["二", 2],
  ["两", 2],
  ["三", 3],
  ["四", 4],
  ["五", 5],
  ["六", 6],
  ["七", 7],
  ["八", 8],
  ["九", 9],
  ["十", 10],
]);

function clampSkuBundleCount(value) {
  if (!Number.isFinite(value)) {
    return DEFAULT_SKU_BUNDLE_COUNT;
  }
  return Math.min(MAX_SKU_BUNDLE_COUNT, Math.max(DEFAULT_SKU_BUNDLE_COUNT, Math.round(value)));
}

export function normalizeCreationSkuBundleCountForPayload(value, fallback = DEFAULT_SKU_BUNDLE_COUNT) {
  const fallbackCount = clampSkuBundleCount(Number.parseInt(cleanString(fallback), 10));
  const raw = cleanString(value);
  if (!raw) {
    return fallbackCount;
  }
  const digitMatch = raw.match(/\d+/);
  if (digitMatch) {
    return clampSkuBundleCount(Number.parseInt(digitMatch[0], 10));
  }
  if (raw.includes("十")) {
    const [left, right] = raw.split("十");
    const tens = SKU_BUNDLE_COUNT_WORDS.get(left) || 1;
    const ones = SKU_BUNDLE_COUNT_WORDS.get(right) || 0;
    return clampSkuBundleCount(tens * 10 + ones);
  }
  for (const [word, count] of SKU_BUNDLE_COUNT_WORDS) {
    if (raw.includes(word)) {
      return clampSkuBundleCount(count);
    }
  }
  return fallbackCount;
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean) : [];
}

function normalizeIndexArray(value) {
  return Array.isArray(value)
    ? value.map((item) => Number.parseInt(cleanString(item), 10)).filter((item) => Number.isFinite(item) && item > 0)
    : [];
}

export function normalizeCreationSkuSubjectForPayload(entry = {}, index = 0) {
  const filenames = normalizeStringArray(entry.filenames);
  const referenceIndexes = normalizeIndexArray(entry.referenceIndexes || entry.reference_indexes);
  const id = cleanString(entry.id || entry.subjectId || entry.subject_id || filenames[0] || `sku-${index + 1}`);
  const title = cleanString(entry.title || entry.name || id);
  const note = cleanString(entry.note || entry.description);
  const rawBundleCount = entry.bundleCount ?? entry.bundle_count ?? entry.quantity ?? entry.count ?? entry.skuBundleCount;
  const bundleCount = rawBundleCount === undefined || rawBundleCount === null || cleanString(rawBundleCount) === ""
    ? 0
    : normalizeCreationSkuBundleCountForPayload(rawBundleCount);

  return id && filenames.length > 0
    ? {
        id,
        title,
        referenceIndexes,
        filenames,
        note,
        ...(bundleCount ? { bundleCount } : {}),
      }
    : null;
}

export function buildCreationSkuSubjectsForPayload({
  analysis = null,
  applied = false,
  dirty = false,
  referenceRoles = [],
} = {}) {
  const appliedSubjects = analysis && applied && !dirty ? analysis.skuSubjects || [] : [];
  const normalizedSubjects = appliedSubjects
    .map((entry, index) => normalizeCreationSkuSubjectForPayload(entry, index))
    .filter(Boolean);
  if (normalizedSubjects.length > 0) {
    return normalizedSubjects;
  }

  return referenceRoles
    .map((entry, index) => ({ ...entry, referenceIndex: index + 1 }))
    .filter((entry) => entry.role === "product")
    .map((entry, index) => ({
      id: entry.filename || `sku-${index + 1}`,
      title: entry.note || entry.filename || `SKU ${index + 1}`,
      referenceIndexes: [entry.referenceIndex],
      filenames: [entry.filename].filter(Boolean),
      note: entry.note || "",
    }));
}
