export const PPT_DYNAMIC_COMPONENT_PRESETS = [
  {
    value: "smart",
    label: "智能动态",
    description: "按页面内容自动加入进度条、焦点高亮、箭头流线、数据卡片等高级动态组件",
  },
  {
    value: "spotlight",
    label: "演讲聚焦",
    description: "用聚光区、层级遮罩、重点标签和主持人节奏线突出核心观点",
  },
  {
    value: "data-pulse",
    label: "数据脉冲",
    description: "加入动态仪表盘、跃迁数字、脉冲折线、增长箭头和指标卡",
  },
  {
    value: "storyline",
    label: "路径叙事",
    description: "加入时间线、路线图、阶段节点、流向箭头和分步推进视觉",
  },
  {
    value: "product-demo",
    label: "产品演示",
    description: "加入设备框、功能热点、扫描光带、交互浮层和产品操作路径",
  },
  {
    value: "cinematic",
    label: "电影动势",
    description: "加入景深层次、视线引导、运动拖影、光束和镜头推进感",
  },
  {
    value: "none",
    label: "静态专业",
    description: "保持简洁静态版式，不额外加入动态组件",
  },
];

export const PPT_TRANSITION_PRESETS = [
  { value: "fade", label: "淡入", description: "通用、稳妥的淡入切换", effects: [{ tag: "fade" }] },
  { value: "push", label: "推入", description: "横向推进，适合流程和叙事", effects: [{ tag: "push", attrs: { dir: "l" } }] },
  { value: "wipe", label: "擦除", description: "横向擦除，适合对比和分段", effects: [{ tag: "wipe", attrs: { dir: "l" } }] },
  {
    value: "split",
    label: "分割",
    description: "从中心展开，适合章节切换",
    effects: [{ tag: "split", attrs: { orient: "horz", dir: "out" } }],
  },
  {
    value: "random-bars",
    label: "条带",
    description: "条带式过渡，适合科技和数据页",
    effects: [{ tag: "randomBar", attrs: { dir: "vert" } }],
  },
  {
    value: "morph-flow",
    label: "流动切换",
    description: "按页序混合淡入、推入、擦除和分割，模拟连续流动感",
    effects: [
      { tag: "fade" },
      { tag: "push", attrs: { dir: "l" } },
      { tag: "wipe", attrs: { dir: "l" } },
      { tag: "split", attrs: { orient: "horz", dir: "out" } },
    ],
  },
  { value: "none", label: "无切换", description: "不写入 PPTX 切换效果", effects: [] },
];

const SPEED_MAP = new Map([
  ["slow", "slow"],
  ["medium", "med"],
  ["med", "med"],
  ["fast", "fast"],
]);

function cleanString(value) {
  return String(value || "").trim();
}

function formatAttrs(attrs = {}) {
  return Object.entries(attrs)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}="${String(value).replaceAll('"', "&quot;")}"`)
    .join(" ");
}

export function normalizePptDynamicComponentPreset(value) {
  const normalized = cleanString(value);
  return PPT_DYNAMIC_COMPONENT_PRESETS.find((preset) => preset.value === normalized) || PPT_DYNAMIC_COMPONENT_PRESETS[0];
}

export function getPptDynamicComponentDescription(value) {
  const preset = normalizePptDynamicComponentPreset(value);
  return preset.value === "none" ? `${preset.label}，${preset.description}` : `${preset.label}，${preset.description}`;
}

export function normalizePptTransitionPreset(value) {
  const normalized = cleanString(value);
  return PPT_TRANSITION_PRESETS.find((preset) => preset.value === normalized) || PPT_TRANSITION_PRESETS[0];
}

export function normalizePptTransitionSpeed(value) {
  return SPEED_MAP.get(cleanString(value)) || "med";
}

export function normalizePptAutoAdvanceSeconds(value) {
  const seconds = Number.parseFloat(String(value ?? "0"));
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }
  return Math.min(60, Math.max(1, seconds));
}

export function normalizePptMotionOptions(options = {}) {
  return {
    dynamicPreset: normalizePptDynamicComponentPreset(options.dynamicPreset).value,
    transitionPreset: normalizePptTransitionPreset(options.transitionPreset).value,
    transitionSpeed: normalizePptTransitionSpeed(options.transitionSpeed),
    autoAdvanceSeconds: normalizePptAutoAdvanceSeconds(options.autoAdvanceSeconds),
  };
}

export function buildPptTransitionXml({ transitionPreset = "fade", transitionSpeed = "medium", autoAdvanceSeconds = 0, slideIndex = 0 } = {}) {
  const preset = normalizePptTransitionPreset(transitionPreset);
  if (preset.value === "none" || preset.effects.length === 0) {
    return "";
  }

  const speed = normalizePptTransitionSpeed(transitionSpeed);
  const seconds = normalizePptAutoAdvanceSeconds(autoAdvanceSeconds);
  const effect = preset.effects[Math.max(0, Number(slideIndex) || 0) % preset.effects.length];
  const effectAttrs = formatAttrs(effect.attrs);
  const effectXml = effectAttrs ? `<p:${effect.tag} ${effectAttrs}/>` : `<p:${effect.tag}/>`;
  const timingAttrs = seconds > 0 ? ` advTm="${Math.round(seconds * 1000)}"` : "";
  return `<p:transition spd="${speed}" advClick="1"${timingAttrs}>${effectXml}</p:transition>`;
}
