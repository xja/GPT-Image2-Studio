const ASPECT_RATIO_OPTIONS = [
  {
    value: "1:1",
    label: "方形 1:1",
    orientation: "square",
    baseSize: "1024x1024",
  },
  {
    value: "4:3",
    label: "横屏 4:3",
    orientation: "landscape",
    baseSize: "1152x864",
  },
  {
    value: "3:4",
    label: "竖版 3:4",
    orientation: "portrait",
    baseSize: "864x1152",
  },
  {
    value: "16:9",
    label: "宽屏 16:9",
    orientation: "landscape",
    baseSize: "1365x768",
  },
  {
    value: "9:16",
    label: "故事 9:16",
    orientation: "portrait",
    baseSize: "768x1365",
  },
  {
    value: "5:4",
    label: "横屏 5:4",
    orientation: "landscape",
    baseSize: "1120x896",
  },
  {
    value: "21:9",
    label: "超宽屏 21:9",
    orientation: "landscape",
    baseSize: "1568x672",
  },
  {
    value: "3:2",
    label: "宽幅 3:2",
    orientation: "landscape",
    baseSize: "1248x832",
  },
  {
    value: "4:5",
    label: "标准 4:5",
    orientation: "portrait",
    baseSize: "896x1120",
  },
  {
    value: "2:3",
    label: "竖版 2:3",
    orientation: "portrait",
    baseSize: "832x1248",
  },
];

const DEFAULT_RATIO = "4:5";

export function getAspectRatioOptions() {
  return ASPECT_RATIO_OPTIONS.map((option) => ({ ...option }));
}

export function resolveAspectRatioOption(value = DEFAULT_RATIO) {
  return (
    ASPECT_RATIO_OPTIONS.find((option) => option.value === value) ||
    ASPECT_RATIO_OPTIONS.find((option) => option.value === DEFAULT_RATIO)
  );
}

export function appendRatioHintToPrompt(prompt, ratioOption) {
  return `${prompt}\n\n构图比例要求：${ratioOption.label}。请按该比例组织主体、商品、留白和背景空间。`;
}
