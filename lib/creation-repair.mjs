function cleanString(value) {
  return String(value || "").trim();
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
