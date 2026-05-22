function cleanString(value) {
  return String(value || "").trim();
}

function normalizeName(value) {
  return cleanString(value).toLowerCase();
}

function isIncompleteCreationItem(item = {}) {
  return cleanString(item.status) !== "completed" || !cleanString(item.filename) || !cleanString(item.relativePath);
}

function isFailedCreationItem(item = {}) {
  return cleanString(item.status) === "failed";
}

export function applyCreationRepairOverrides(
  item = {},
  { promptOverride = "", marketingCopyOverride = "" } = {},
) {
  const prompt = cleanString(promptOverride);
  const marketingCopy = cleanString(marketingCopyOverride);

  return {
    ...item,
    ...(prompt ? { prompt } : {}),
    ...(marketingCopy ? { marketingCopy } : {}),
  };
}

export function selectCreationRepairItems(creationSet = {}, { itemId = "", scope = "" } = {}) {
  const items = Array.isArray(creationSet.items) ? creationSet.items : [];
  const requestedItemId = cleanString(itemId);

  if (requestedItemId) {
    return items.filter((item) => cleanString(item.itemId) === requestedItemId);
  }

  if (cleanString(scope).toLowerCase() === "incomplete") {
    return items.filter(isIncompleteCreationItem);
  }

  return items.filter(isFailedCreationItem);
}

function normalizeRepairSkuSubject(entry = {}) {
  const filenames = Array.isArray(entry.filenames) ? entry.filenames.map(cleanString).filter(Boolean) : [];
  const referenceIndexes = Array.isArray(entry.referenceIndexes)
    ? entry.referenceIndexes.map((item) => Number.parseInt(cleanString(item), 10)).filter((item) => Number.isFinite(item) && item > 0)
    : Array.isArray(entry.reference_indexes)
      ? entry.reference_indexes.map((item) => Number.parseInt(cleanString(item), 10)).filter((item) => Number.isFinite(item) && item > 0)
      : [];
  const id = cleanString(entry.id || entry.subjectId || entry.subject_id || filenames[0]);

  return {
    id,
    title: cleanString(entry.title || entry.name || id),
    referenceIndexes,
    filenames,
    note: cleanString(entry.note || entry.description || entry.summary),
    bundleCount: Number.parseInt(cleanString(entry.bundleCount || entry.bundle_count || entry.quantity || entry.count), 10) || 1,
  };
}

function getSkuSubjectIndexFromTitle(item = {}) {
  const match = cleanString(item.title).match(/\bSKU\s+image\s+(\d+)\b/i);
  if (!match) {
    return -1;
  }
  const index = Number.parseInt(match[1], 10) - 1;
  return Number.isFinite(index) ? index : -1;
}

function findRepairSkuSubject(item = {}, creationSet = {}) {
  const subjects = Array.isArray(creationSet.skuSubjects)
    ? creationSet.skuSubjects.map(normalizeRepairSkuSubject).filter((subject) => subject.id || subject.filenames.length)
    : [];
  if (subjects.length === 0) {
    return null;
  }

  const itemId = normalizeName(item.itemId);
  const matchByItemId = subjects.find((subject) => {
    const subjectId = normalizeName(subject.id);
    return subjectId && (itemId.endsWith(`-sku-${subjectId}`) || itemId.includes(`sku-${subjectId}`));
  });
  if (matchByItemId) {
    return matchByItemId;
  }

  const titleIndex = getSkuSubjectIndexFromTitle(item);
  if (titleIndex >= 0 && subjects[titleIndex]) {
    return subjects[titleIndex];
  }

  const slotIndex = Number.parseInt(cleanString(item.slotIndex), 10);
  const carouselCount = Number.parseInt(cleanString(creationSet.imageCount), 10);
  const slotSubjectIndex = slotIndex - carouselCount - 1;
  if (Number.isFinite(slotSubjectIndex) && slotSubjectIndex >= 0 && subjects[slotSubjectIndex]) {
    return subjects[slotSubjectIndex];
  }

  return subjects.length === 1 ? subjects[0] : null;
}

export function hydrateCreationRepairSkuSubject(item = {}, creationSet = {}) {
  const existingSubject = normalizeRepairSkuSubject(item.skuSubject || item.sku_subject || {});
  if (existingSubject.id || existingSubject.filenames.length || cleanString(item.role) !== "sku") {
    return existingSubject.id || existingSubject.filenames.length ? { ...item, skuSubject: existingSubject } : item;
  }

  const matchedSubject = findRepairSkuSubject(item, creationSet);
  return matchedSubject ? { ...item, skuSubject: matchedSubject } : item;
}

export function hydrateCreationRepairSkuSubjects(items = [], creationSet = {}) {
  return Array.isArray(items) ? items.map((item) => hydrateCreationRepairSkuSubject(item, creationSet)) : [];
}
