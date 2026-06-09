export const CREATION_AUTO_REPAIR_MAX_ATTEMPTS = 1;

function hasCompletedCreationAsset(item = {}) {
  return Boolean(item.relativePath || item.imageUrl || item.thumbnailUrl || item.storageKey);
}

export function getCreationIncompleteItems(set = {}) {
  const items = Array.isArray(set?.items) ? set.items : [];
  return items.filter((item) => item.missingAsset || item.missing_asset || item.status !== "completed" || !item.filename || !hasCompletedCreationAsset(item));
}

export function shouldAutoRepairCreationSet({
  set,
  generationScope = "",
  autoRepairAttemptCount = 0,
  canRepair = false,
  maxAttempts = CREATION_AUTO_REPAIR_MAX_ATTEMPTS,
} = {}) {
  return (
    generationScope === "full" &&
    canRepair &&
    autoRepairAttemptCount < maxAttempts &&
    getCreationIncompleteItems(set).length > 0
  );
}

export function getCreationAutoRepairNotice({
  incompleteCount = 0,
  attemptCount = 1,
  maxAttempts = CREATION_AUTO_REPAIR_MAX_ATTEMPTS,
} = {}) {
  return `有 ${Math.max(1, incompleteCount)} 个套图项未完成，正在自动补图 ${attemptCount}/${maxAttempts}。`;
}

export function getCreationCompletionFeedback(set = {}) {
  const incompleteCount = getCreationIncompleteItems(set).length;
  return incompleteCount > 0
    ? { message: `套图生成结束，仍有 ${incompleteCount} 个项目未完成，可手动补齐。`, tone: "error" }
    : { message: "套图生成完成。", tone: "success" };
}
