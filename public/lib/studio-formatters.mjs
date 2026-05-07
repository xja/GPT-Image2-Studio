const REASONING_LABELS = {
  low: "低",
  medium: "中",
  high: "高",
  xhigh: "超高",
};

export function formatImageModelLabel(imageModel) {
  if (!imageModel || imageModel === "gpt-image-2") {
    return "GPT Image 2.0";
  }

  return imageModel;
}

export function formatGenerationDuration(value) {
  const durationMs = Number(value);
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return "";
  }

  const roundedMs = Math.round(durationMs);
  if (roundedMs < 1000) {
    return `${roundedMs} 毫秒`;
  }

  if (roundedMs < 60000) {
    return `${(roundedMs / 1000).toFixed(roundedMs < 10000 ? 1 : 0).replace(/\.0$/, "")} 秒`;
  }

  const minutes = Math.floor(roundedMs / 60000);
  const seconds = Math.round((roundedMs % 60000) / 1000);
  return seconds > 0 ? `${minutes} 分 ${seconds} 秒` : `${minutes} 分`;
}

export function buildParameterText(item = {}, fallbackConfig = {}) {
  const referenceNames =
    item.referenceImageNames && item.referenceImageNames.length > 0
      ? item.referenceImageNames.join(", ")
      : item.referenceImageName;
  const generationDuration = formatGenerationDuration(item.generationDurationMs);

  const lines = [
    `比例：${item.ratioLabel || item.ratio || "未记录"}`,
    `画布：${item.size || "未记录"}`,
    `格式：${String(item.format || "png").toUpperCase()}`,
    `质量：${item.quality || "high"}`,
    `推理强度：${REASONING_LABELS[item.reasoningEffort] || item.reasoningEffort || "未记录"}`,
    `图像模型：${formatImageModelLabel(item.imageModel)}`,
    `外层模型：${item.responsesModel || fallbackConfig.responsesModel || "gpt-5.4"}`,
    `参考图：${item.hasReferenceImage ? referenceNames || "已使用" : "未使用"}`,
  ];

  if (generationDuration) {
    lines.push(`图片生成耗时：${generationDuration}`);
  }

  if (item.baseUrl || fallbackConfig.baseUrl) {
    lines.push(`中转：${item.baseUrl || fallbackConfig.baseUrl}`);
  }

  if (item.absolutePath) {
    lines.push(`本地文件：${item.absolutePath}`);
  }

  if (item.relativePath) {
    lines.push(`相对路径：${item.relativePath}`);
  }

  return lines.join("\n");
}

export function formatRecentOutputMeta(item = {}) {
  const size = item.size || "未记录";
  return `${size} | ${formatImageModelLabel(item.imageModel)}`;
}
