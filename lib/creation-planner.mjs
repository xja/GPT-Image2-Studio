import {
  CREATION_INDUSTRY_TEMPLATE_OPTIONS,
  getCreationIndustryTemplateRolePreset,
  normalizeCreationIndustryTemplate as normalizeCreationIndustryTemplateOption,
} from "./creation-category-templates.mjs";

export { CREATION_INDUSTRY_TEMPLATE_OPTIONS };

export const CREATION_TARGET_LANGUAGE_OPTIONS = [
  {
    value: "zh-CN",
    label: "简体中文",
    promptInstruction: "使用简体中文短营销文案，图中文字控制在 2 到 8 个汉字，品牌名、型号、数字和单位保持原样。",
  },
  {
    value: "en",
    label: "English",
    promptInstruction: "Use concise English marketing copy, keep image text to 2-6 words, and preserve brand names, model names, numbers, and units exactly.",
  },
  {
    value: "ja",
    label: "日本語",
    promptInstruction: "Use concise Japanese marketing copy, keep image text short, and preserve brand names, model names, numbers, and units exactly.",
  },
  {
    value: "ko",
    label: "한국어",
    promptInstruction: "Use concise Korean marketing copy, keep image text short, and preserve brand names, model names, numbers, and units exactly.",
  },
];

export const CREATION_IMAGE_COUNT_OPTIONS = [4, 6, 8, 10, 12];

export const CREATION_DIMENSION_UNIT_MODE_OPTIONS = [
  {
    value: "metric",
    label: "公制",
    promptInstruction: "Render all recognized dimension values in metric units only.",
  },
  {
    value: "imperial",
    label: "英制",
    promptInstruction: "Render all recognized dimension values in imperial units only.",
  },
  {
    value: "both",
    label: "公制和英制",
    promptInstruction: "Render each recognized dimension value with metric first and imperial in parentheses.",
  },
];

export const CREATION_SCENARIO_OPTIONS = [
  {
    value: "standard",
    label: "标准电商",
    promptInstruction: "Balanced ecommerce scenario: cover hero, benefits, lifestyle, and trust-building product proof for a marketplace listing.",
  },
  {
    value: "detail-page",
    label: "详情页转化",
    promptInstruction: "Detail-page conversion scenario: build modular images for product-detail pages, with clear feature hierarchy and purchase confidence.",
  },
  {
    value: "social-seeding",
    label: "社媒种草",
    promptInstruction: "Social seeding scenario: make the set feel native to lifestyle feeds while keeping the product accurate and commercially useful.",
  },
  {
    value: "launch",
    label: "新品发布",
    promptInstruction: "New product launch scenario: create a launch-ready visual story with discovery, key promise, usage context, and credibility.",
  },
  {
    value: "promotion",
    label: "活动促销",
    promptInstruction: "Promotion campaign scenario: create campaign assets with offer clarity, urgency, product value, and clean conversion-focused layouts.",
  },
  {
    value: "livestream",
    label: "直播电商",
    promptInstruction: "Live commerce scenario: prioritize clear selling points, demo-ready composition, host callouts, urgency, and product proof without clutter.",
  },
  {
    value: "gift-guide",
    label: "礼品推荐",
    promptInstruction: "Gift guide scenario: frame the product as a thoughtful gift with occasion, recipient fit, package appeal, and purchase confidence.",
  },
  {
    value: "marketplace-search",
    label: "平台搜索",
    promptInstruction: "Marketplace search scenario: make the product instantly understandable in crowded listings, with strong subject separation and quick benefit recognition.",
  },
  {
    value: "brand-story",
    label: "品牌故事",
    promptInstruction: "Brand story scenario: connect product craft, material, origin, values, and everyday usage into a coherent ecommerce visual narrative.",
  },
];

export const CREATION_REFERENCE_ROLE_OPTIONS = [
  {
    value: "product",
    label: "商品主体",
    promptLabel: "product subject",
    promptInstruction: "Preserve the product shape, proportions, color, markings, and visible structure.",
  },
  {
    value: "package",
    label: "包装清单",
    promptLabel: "package and included items",
    promptInstruction: "Use it to understand packaging, bundles, included accessories, and what the shopper receives.",
  },
  {
    value: "material",
    label: "材质细节",
    promptLabel: "material and close-up detail",
    promptInstruction: "Use it to preserve material texture, finish, seams, surface detail, and close-up accuracy.",
  },
  {
    value: "scene",
    label: "使用场景",
    promptLabel: "usage scene",
    promptInstruction: "Use it as context for realistic placement, scale, environment, and usage behavior.",
  },
  {
    value: "style",
    label: "风格参考",
    promptLabel: "visual style reference",
    promptInstruction: "Use it for lighting, framing, mood, background style, and composition rhythm without copying unrelated objects.",
  },
  {
    value: "other",
    label: "其他",
    promptLabel: "supporting reference",
    promptInstruction: "Use it only where it helps product accuracy or ecommerce composition.",
  },
];

export const CREATION_ITEM_ROLES = [
  {
    role: "hero",
    title: "主图",
    filenameToken: "hero",
    brief: "clean ecommerce hero image with the product as the clear visual subject",
  },
  {
    role: "benefit",
    title: "卖点图",
    filenameToken: "benefit",
    brief: "benefit-focused product image that highlights one or two key selling points",
  },
  {
    role: "scene",
    title: "场景图",
    filenameToken: "scene",
    brief: "lifestyle usage scene that shows the product in a realistic ecommerce marketing context",
  },
  {
    role: "detail-trust",
    title: "详情信任图",
    filenameToken: "trust",
    brief: "detail and trust image that emphasizes material, structure, package, comparison, or quality proof",
  },
  {
    role: "comparison",
    title: "对比图",
    filenameToken: "compare",
    brief: "comparison image that makes the product advantage easy to understand without clutter",
  },
  {
    role: "social-proof",
    title: "种草图",
    filenameToken: "social",
    brief: "social-proof image with authentic lifestyle framing and persuasive but restrained copy",
  },
  {
    role: "package",
    title: "包装清单图",
    filenameToken: "package",
    brief: "package and included-items image that clarifies what the shopper receives",
  },
  {
    role: "promotion",
    title: "活动图",
    filenameToken: "promo",
    brief: "promotion image for campaign traffic with clear offer space and strong product visibility",
  },
  {
    role: "material-closeup",
    title: "材质细节图",
    filenameToken: "material",
    brief: "material texture close-up image that shows finish, touch, seams, surface detail, and quality cues",
  },
  {
    role: "usage-steps",
    title: "使用步骤图",
    filenameToken: "steps",
    brief: "how to use image with simple step-by-step product operation, setup, cleaning, or assembly guidance",
  },
  {
    role: "dimensions",
    title: "尺寸规格图",
    filenameToken: "size",
    brief: "dimensions and specification image that makes scale, capacity, size, compatibility, and key numbers easy to compare",
  },
  {
    role: "review-qa",
    title: "口碑问答图",
    filenameToken: "qa",
    brief: "review and shopper Q&A image that answers common purchase concerns with credible proof and concise ecommerce copy",
  },
];

export const CREATION_SCENARIO_ROLE_PRESETS = {
  standard: ["hero", "benefit", "scene", "detail-trust"],
  "detail-page": [
    "hero",
    "benefit",
    "detail-trust",
    "material-closeup",
    "dimensions",
    "usage-steps",
    "comparison",
    "package",
  ],
  "social-seeding": ["hero", "scene", "social-proof", "benefit", "review-qa", "promotion"],
  launch: ["hero", "benefit", "scene", "material-closeup", "package", "social-proof", "dimensions", "promotion"],
  promotion: ["hero", "benefit", "comparison", "promotion", "package", "review-qa"],
  livestream: [
    "hero",
    "benefit",
    "scene",
    "usage-steps",
    "detail-trust",
    "comparison",
    "promotion",
    "social-proof",
    "review-qa",
    "dimensions",
  ],
  "gift-guide": ["hero", "package", "scene", "benefit", "social-proof", "review-qa"],
  "marketplace-search": ["hero", "benefit", "comparison", "dimensions", "material-closeup", "review-qa"],
  "brand-story": [
    "hero",
    "scene",
    "material-closeup",
    "package",
    "detail-trust",
    "social-proof",
    "usage-steps",
    "review-qa",
  ],
};

export const CREATION_INDUSTRY_ROLE_PRESETS = {
  general: [],
  apparel: ["hero", "scene", "material-closeup", "dimensions", "benefit", "social-proof", "review-qa", "promotion"],
  beauty: ["hero", "benefit", "material-closeup", "usage-steps", "detail-trust", "social-proof", "package", "review-qa"],
  food: ["hero", "benefit", "scene", "package", "material-closeup", "social-proof", "promotion", "review-qa"],
  electronics: ["hero", "benefit", "dimensions", "usage-steps", "detail-trust", "comparison", "package", "review-qa"],
  home: ["hero", "scene", "dimensions", "material-closeup", "usage-steps", "benefit", "comparison", "review-qa"],
};

export const CREATION_SCENARIO_ROLE_INSTRUCTIONS = {
  standard: {
    default:
      "Role focus: keep this image tightly aligned with the selected ecommerce scenario and this role's conversion job.",
  },
  "detail-page": {
    default:
      "Role focus: make this feel like a modular detail-page section with clear hierarchy, shopper reassurance, and a clean conversion path.",
    "detail-trust":
      "Role focus: build a detail-page proof section that answers quality, structure, package, and trust concerns before purchase.",
    "material-closeup":
      "Role focus: build a modular detail-page proof section with texture, material, finish, and quality cues.",
    dimensions:
      "Role focus: make specifications, scale, capacity, and compatibility easy to compare inside a product-detail page module.",
    "usage-steps":
      "Role focus: turn operation, setup, cleaning, or assembly into a short detail-page teaching sequence.",
  },
  "social-seeding": {
    default:
      "Role focus: make this image feel native to a lifestyle feed while keeping the product accurate and purchase intent clear.",
    scene:
      "Role focus: stage an authentic everyday moment that feels shareable, lightly editorial, and not like a hard-sell ad.",
    "social-proof":
      "Role focus: frame social proof as a believable user recommendation with restrained copy and natural lifestyle context.",
    promotion:
      "Role focus: keep any offer soft and content-native so it supports seeding instead of breaking feed authenticity.",
  },
  launch: {
    default:
      "Role focus: create launch-ready energy with discovery, novelty, product promise, and a clear reason to pay attention now.",
    hero:
      "Role focus: make the product feel newly released, memorable, and immediately recognizable as the launch anchor.",
    benefit:
      "Role focus: express the launch promise as one strong shopper-facing reason to try the product.",
    package:
      "Role focus: show launch unboxing, bundle appeal, or included items as a premium first-touch moment.",
  },
  promotion: {
    default:
      "Role focus: emphasize offer clarity, urgency, product value, and a conversion-focused campaign layout.",
    promotion:
      "Role focus: reserve clean space for campaign price, deadline, or bundle callout while keeping the product dominant.",
    comparison:
      "Role focus: make the deal logic easy to understand through before-after, value stack, or advantage comparison.",
    "review-qa":
      "Role focus: answer the last objections that block campaign conversion, such as value, durability, or fit.",
  },
  livestream: {
    default:
      "Role focus: make the image host-ready for live commerce with clear talking points, demo rhythm, and fast shopper understanding.",
    benefit:
      "Role focus: make selling points easy to explain aloud in a live stream, with demo-friendly visual anchors.",
    "usage-steps":
      "Role focus: show a host-ready demonstration sequence with step cues, demo handoff, and a clear talk track for live commerce.",
    promotion:
      "Role focus: reserve clean space for a limited-time offer callout and live-room urgency without overcrowding the product.",
    "review-qa":
      "Role focus: answer common live-room questions quickly, as if the host is resolving purchase hesitation in real time.",
    dimensions:
      "Role focus: make size, capacity, and compatibility instantly explainable during a live demonstration.",
  },
  "gift-guide": {
    default:
      "Role focus: position the product as a thoughtful gift with occasion, recipient fit, packaging appeal, and confidence to buy.",
    package:
      "Role focus: make the package, included items, and gift-ready presentation feel complete and desirable.",
    scene:
      "Role focus: show the product in a gifting occasion or recipient lifestyle context without losing product clarity.",
    "review-qa":
      "Role focus: answer gifting concerns such as who it suits, whether it feels premium, and why it is easy to choose.",
  },
  "marketplace-search": {
    default:
      "Role focus: optimize for fast scanning in crowded marketplace search results with strong subject separation and minimal clutter.",
    hero:
      "Role focus: make the product readable as a thumbnail-first listing image with instant category recognition.",
    benefit:
      "Role focus: make one key shopper benefit readable at search-card speed without relying on dense text.",
    comparison:
      "Role focus: show a fast scan comparison for crowded search result pages, using simple visual hierarchy.",
    dimensions:
      "Role focus: make scale, size, and key specs readable at listing-card size.",
    "material-closeup":
      "Role focus: show one high-confidence material or quality cue that can stand out in marketplace search thumbnails.",
  },
  "brand-story": {
    default:
      "Role focus: connect product craft, material, origin, values, and everyday usage into a coherent brand narrative.",
    scene:
      "Role focus: place the product in a lived-in scene that supports brand values and everyday relevance.",
    "material-closeup":
      "Role focus: make material, craft, surface finish, or origin detail carry the brand story visually.",
    package:
      "Role focus: use packaging or included items to communicate brand care, ritual, and perceived value.",
    "social-proof":
      "Role focus: present credibility as brand trust and customer belonging rather than a generic review card.",
  },
};

function cleanString(value) {
  return String(value || "").trim();
}

function trimTerminalSentencePunctuation(value) {
  return cleanString(value).replace(/[.!?。！？]+$/u, "").trim();
}

function normalizeSellingPoints(value) {
  if (Array.isArray(value)) {
    return value.map(cleanString).filter(Boolean);
  }

  return String(value || "")
    .split(/[\n,，；、]+/)
    .map(cleanString)
    .filter(Boolean);
}

function normalizeDimensionSpecs(value) {
  if (Array.isArray(value)) {
    return value.map(cleanString).filter(Boolean);
  }

  return String(value || "")
    .split(/[\n,，；、]+/)
    .map(cleanString)
    .filter(Boolean);
}

export function normalizeCreationDimensionUnitMode(value) {
  const normalized = cleanString(value);
  return (
    CREATION_DIMENSION_UNIT_MODE_OPTIONS.find((option) => option.value === normalized) ||
    CREATION_DIMENSION_UNIT_MODE_OPTIONS[0]
  );
}

const DIMENSION_UNIT_LOOKUP = new Map([
  ["mm", { kind: "length", system: "metric", unit: "mm", toBase: (value) => value }],
  ["毫米", { kind: "length", system: "metric", unit: "mm", toBase: (value) => value }],
  ["cm", { kind: "length", system: "metric", unit: "cm", toBase: (value) => value * 10 }],
  ["厘米", { kind: "length", system: "metric", unit: "cm", toBase: (value) => value * 10 }],
  ["m", { kind: "length", system: "metric", unit: "m", toBase: (value) => value * 1000 }],
  ["米", { kind: "length", system: "metric", unit: "m", toBase: (value) => value * 1000 }],
  ["in", { kind: "length", system: "imperial", unit: "in", toBase: (value) => value * 25.4 }],
  ["inch", { kind: "length", system: "imperial", unit: "in", toBase: (value) => value * 25.4 }],
  ["inches", { kind: "length", system: "imperial", unit: "in", toBase: (value) => value * 25.4 }],
  ["英寸", { kind: "length", system: "imperial", unit: "in", toBase: (value) => value * 25.4 }],
  ["ft", { kind: "length", system: "imperial", unit: "ft", toBase: (value) => value * 304.8 }],
  ["foot", { kind: "length", system: "imperial", unit: "ft", toBase: (value) => value * 304.8 }],
  ["feet", { kind: "length", system: "imperial", unit: "ft", toBase: (value) => value * 304.8 }],
  ["英尺", { kind: "length", system: "imperial", unit: "ft", toBase: (value) => value * 304.8 }],
  ["yd", { kind: "length", system: "imperial", unit: "yd", toBase: (value) => value * 914.4 }],
  ["yard", { kind: "length", system: "imperial", unit: "yd", toBase: (value) => value * 914.4 }],
  ["yards", { kind: "length", system: "imperial", unit: "yd", toBase: (value) => value * 914.4 }],
  ["ml", { kind: "volume", system: "metric", unit: "ml", toBase: (value) => value }],
  ["毫升", { kind: "volume", system: "metric", unit: "ml", toBase: (value) => value }],
  ["l", { kind: "volume", system: "metric", unit: "L", toBase: (value) => value * 1000 }],
  ["liter", { kind: "volume", system: "metric", unit: "L", toBase: (value) => value * 1000 }],
  ["liters", { kind: "volume", system: "metric", unit: "L", toBase: (value) => value * 1000 }],
  ["litre", { kind: "volume", system: "metric", unit: "L", toBase: (value) => value * 1000 }],
  ["litres", { kind: "volume", system: "metric", unit: "L", toBase: (value) => value * 1000 }],
  ["升", { kind: "volume", system: "metric", unit: "L", toBase: (value) => value * 1000 }],
  ["fl oz", { kind: "volume", system: "imperial", unit: "fl oz", toBase: (value) => value * 29.5735295625 }],
  ["fluid ounce", { kind: "volume", system: "imperial", unit: "fl oz", toBase: (value) => value * 29.5735295625 }],
  ["fluid ounces", { kind: "volume", system: "imperial", unit: "fl oz", toBase: (value) => value * 29.5735295625 }],
  ["液量盎司", { kind: "volume", system: "imperial", unit: "fl oz", toBase: (value) => value * 29.5735295625 }],
  ["g", { kind: "weight", system: "metric", unit: "g", toBase: (value) => value }],
  ["克", { kind: "weight", system: "metric", unit: "g", toBase: (value) => value }],
  ["kg", { kind: "weight", system: "metric", unit: "kg", toBase: (value) => value * 1000 }],
  ["千克", { kind: "weight", system: "metric", unit: "kg", toBase: (value) => value * 1000 }],
  ["lb", { kind: "weight", system: "imperial", unit: "lb", toBase: (value) => value * 453.59237 }],
  ["lbs", { kind: "weight", system: "imperial", unit: "lb", toBase: (value) => value * 453.59237 }],
  ["pound", { kind: "weight", system: "imperial", unit: "lb", toBase: (value) => value * 453.59237 }],
  ["pounds", { kind: "weight", system: "imperial", unit: "lb", toBase: (value) => value * 453.59237 }],
  ["磅", { kind: "weight", system: "imperial", unit: "lb", toBase: (value) => value * 453.59237 }],
  ["oz", { kind: "weight", system: "imperial", unit: "oz", toBase: (value) => value * 28.349523125 }],
  ["ounce", { kind: "weight", system: "imperial", unit: "oz", toBase: (value) => value * 28.349523125 }],
  ["ounces", { kind: "weight", system: "imperial", unit: "oz", toBase: (value) => value * 28.349523125 }],
  ["盎司", { kind: "weight", system: "imperial", unit: "oz", toBase: (value) => value * 28.349523125 }],
]);

const DIMENSION_MEASUREMENT_RE =
  /(^|[^\p{L}\p{N}_])([+-]?(?:\d+(?:\.\d+)?|\.\d+))(\s*)(fl\.?\s*oz|fluid\s*ounces?|inches?|inch|in\.?|ft\.?|feet|foot|yards?|yard|yd\.?|毫米|厘米|英寸|英尺|毫升|液量盎司|千克|克|磅|盎司|升|mm|cm|kg|g|ml|lb|lbs|oz|m|l)(?=$|[^\p{L}\p{N}_])/giu;

function normalizeDimensionUnitToken(value) {
  return cleanString(value).toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
}

function formatDimensionNumber(value) {
  if (!Number.isFinite(value)) {
    return "";
  }

  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded.toFixed(2).replace(/\.00$/u, "").replace(/(\.\d)0$/u, "$1");
}

function formatMetricDimensionValue(kind, baseValue) {
  if (kind === "length") {
    return `${formatDimensionNumber(baseValue / 10)} cm`;
  }
  if (kind === "volume") {
    return `${formatDimensionNumber(baseValue)} ml`;
  }
  if (kind === "weight") {
    return baseValue >= 1000
      ? `${formatDimensionNumber(baseValue / 1000)} kg`
      : `${formatDimensionNumber(baseValue)} g`;
  }
  return "";
}

function formatImperialDimensionValue(kind, baseValue) {
  if (kind === "length") {
    return `${formatDimensionNumber(baseValue / 25.4)} in`;
  }
  if (kind === "volume") {
    return `${formatDimensionNumber(baseValue / 29.5735295625)} fl oz`;
  }
  if (kind === "weight") {
    return baseValue >= 453.59237
      ? `${formatDimensionNumber(baseValue / 453.59237)} lb`
      : `${formatDimensionNumber(baseValue / 28.349523125)} oz`;
  }
  return "";
}

function convertDimensionMeasurement(value, spacing, rawUnit, mode) {
  const parsedValue = Number.parseFloat(value);
  const unit = DIMENSION_UNIT_LOOKUP.get(normalizeDimensionUnitToken(rawUnit));
  const original = `${value}${spacing}${rawUnit}`;

  if (!unit || !Number.isFinite(parsedValue)) {
    return original;
  }

  const baseValue = unit.toBase(parsedValue);
  const metricValue = unit.system === "metric" ? original : formatMetricDimensionValue(unit.kind, baseValue);
  const imperialValue = unit.system === "imperial" ? original : formatImperialDimensionValue(unit.kind, baseValue);

  if (mode === "both") {
    return metricValue && imperialValue ? `${metricValue} (${imperialValue})` : original;
  }

  if (mode === "imperial") {
    return unit.system === "imperial" ? original : imperialValue || original;
  }

  return unit.system === "metric" ? original : metricValue || original;
}

function convertDimensionSpecLine(line, mode) {
  return cleanString(line).replace(DIMENSION_MEASUREMENT_RE, (match, prefix, value, spacing, unit) => {
    return `${prefix}${convertDimensionMeasurement(value, spacing, unit, mode)}`;
  });
}

export function normalizeCreationTargetLanguage(value) {
  const normalized = cleanString(value);
  return (
    CREATION_TARGET_LANGUAGE_OPTIONS.find((option) => option.value === normalized) ||
    CREATION_TARGET_LANGUAGE_OPTIONS[0]
  );
}

export function normalizeCreationImageCount(value) {
  const normalized = Number.parseInt(cleanString(value), 10);
  return CREATION_IMAGE_COUNT_OPTIONS.includes(normalized) ? normalized : CREATION_IMAGE_COUNT_OPTIONS[0];
}

export function normalizeCreationSelectedRoles(value) {
  let entries = value;
  if (typeof value === "string") {
    try {
      entries = JSON.parse(value);
    } catch (_error) {
      entries = value.split(/[\n,，；;]+/);
    }
  }

  if (!Array.isArray(entries)) {
    return [];
  }

  const seen = new Set();
  return entries
    .map((entry) => cleanString(typeof entry === "string" ? entry : entry?.role || entry?.value))
    .map((roleValue) => CREATION_ITEM_ROLES.find((role) => role.role === roleValue))
    .filter(Boolean)
    .filter((role) => {
      if (seen.has(role.role)) {
        return false;
      }

      seen.add(role.role);
      return true;
    });
}

export function normalizeCreationScenario(value) {
  const normalized = cleanString(value);
  return CREATION_SCENARIO_OPTIONS.find((option) => option.value === normalized) || CREATION_SCENARIO_OPTIONS[0];
}

export function normalizeCreationIndustryTemplate(value) {
  return normalizeCreationIndustryTemplateOption(value);
}

export function getCreationScenarioRolePreset(value) {
  const normalized = cleanString(value);
  return normalizeCreationSelectedRoles(CREATION_SCENARIO_ROLE_PRESETS[normalized] || CREATION_SCENARIO_ROLE_PRESETS.standard);
}

export function getCreationIndustryRolePreset(value) {
  return normalizeCreationSelectedRoles(getCreationIndustryTemplateRolePreset(value));
}

export function getCreationScenarioRoleInstruction(scenarioValue, roleValue) {
  const scenario = normalizeCreationScenario(scenarioValue);
  const role = cleanString(roleValue);
  const scenarioInstructions = CREATION_SCENARIO_ROLE_INSTRUCTIONS[scenario.value] || CREATION_SCENARIO_ROLE_INSTRUCTIONS.standard;
  return scenarioInstructions[role] || scenarioInstructions.default || CREATION_SCENARIO_ROLE_INSTRUCTIONS.standard.default;
}

function getCreationIndustryTemplateRoleInstruction(industryTemplate, roleValue) {
  const role = cleanString(roleValue);
  const roleInstructions = industryTemplate?.rolePromptInstructions || {};
  return cleanString(roleInstructions[role] || roleInstructions.default || "");
}

export function normalizeCreationReferenceRole(value) {
  const normalized = cleanString(value);
  return CREATION_REFERENCE_ROLE_OPTIONS.find((option) => option.value === normalized) || CREATION_REFERENCE_ROLE_OPTIONS[0];
}

export function normalizeCreationReferenceRoles(value) {
  let entries = value;
  if (typeof value === "string") {
    try {
      entries = JSON.parse(value);
    } catch (_error) {
      entries = [];
    }
  }

  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry, index) => {
      const role = normalizeCreationReferenceRole(entry?.role);
      const filename = cleanString(entry?.filename || entry?.name || `reference-image-${index + 1}`);
      const note = cleanString(entry?.note || entry?.analysisNote || entry?.description);
      return {
        filename,
        role: role.value,
        roleLabel: role.label,
        rolePromptLabel: role.promptLabel,
        promptInstruction: role.promptInstruction,
        note,
      };
    })
    .filter((entry) => entry.filename);
}

function inferCreationReferenceRole(value) {
  const raw = cleanString(value).toLowerCase();

  if (/package|packaging|box|bundle|included|accessory|包装|清单|套装|配件|盒/.test(raw)) {
    return "package";
  }
  if (/material|texture|surface|fabric|finish|detail|close.?up|材质|纹理|质感|表面|细节|工艺/.test(raw)) {
    return "material";
  }
  if (/scene|usage|context|environment|lifestyle|使用|场景|环境|生活|摆放/.test(raw)) {
    return "scene";
  }
  if (/style|lighting|composition|mood|background|风格|光线|构图|背景|调性/.test(raw)) {
    return "style";
  }
  if (/other|support|其它|其他|辅助/.test(raw)) {
    return "other";
  }

  return "product";
}

function normalizeCreationReferenceAnalysisEntry(entry, index, filenames) {
  const source = typeof entry === "string" ? { note: entry, role: inferCreationReferenceRole(entry) } : entry || {};
  const resolvedIndex = Math.max(1, Number(source.index) || index + 1);
  const filename = cleanString(source.filename || source.name || filenames[resolvedIndex - 1] || filenames[index] || `reference-image-${resolvedIndex}`);
  const inferredRole = inferCreationReferenceRole([source.role, source.roleLabel, source.note, source.description].filter(Boolean).join(" "));
  const role = normalizeCreationReferenceRole(source.role || inferredRole);
  const note = cleanString(source.note || source.description || source.reason || source.summary);

  if (!filename) {
    return null;
  }

  return {
    index: resolvedIndex,
    filename,
    role: role.value,
    roleLabel: role.label,
    rolePromptLabel: role.promptLabel,
    promptInstruction: role.promptInstruction,
    note,
  };
}

export function normalizeCreationReferenceAnalysis(value = {}, filenames = []) {
  const source = value && typeof value === "object" ? value : {};
  const referenceRoles = Array.isArray(source.reference_roles)
    ? source.reference_roles
    : Array.isArray(source.recommendations)
      ? source.recommendations
      : Array.isArray(source.image_roles)
        ? source.image_roles
        : [];
  const normalizedFilenames = Array.isArray(filenames) ? filenames.map(cleanString).filter(Boolean) : [];

  return {
    summary: cleanString(source.summary || source.relationship || source.title),
    categoryHint: cleanString(source.categoryHint || source.category_hint || source.category || source.categoryName),
    categoryPath: cleanString(source.categoryPath || source.category_path),
    recommendations: referenceRoles
      .map((entry, index) => normalizeCreationReferenceAnalysisEntry(entry, index, normalizedFilenames))
      .filter(Boolean)
      .slice(0, 6),
    risks: Array.isArray(source.risks) ? source.risks.map(cleanString).filter(Boolean) : [],
  };
}

function buildCreationReferenceGuidance(referenceImageRoles = []) {
  if (referenceImageRoles.length === 0) {
    return "Use any supplied reference images only for product identity, material, proportions, packaging, and visual constraints.";
  }

  const roleLines = referenceImageRoles
    .map(
      (entry, index) =>
        `${index + 1}. ${entry.filename} = ${entry.rolePromptLabel}: ${entry.promptInstruction}${entry.note ? ` Analyst note: ${entry.note}.` : ""}`,
    )
    .join(" ");

  return `Reference image roles: ${roleLines} Use these roles to decide what each supplied reference image should influence; do not copy unrelated objects or layouts from references.`;
}

function normalizeCreationPlanOverrideEntry(entry = {}) {
  const slotIndex = Number.parseInt(cleanString(entry?.slotIndex), 10);
  const itemId = cleanString(entry?.itemId || entry?.id);
  const role = cleanString(entry?.role || entry?.value);
  const prompt = cleanString(entry?.prompt || entry?.promptOverride);
  const marketingCopy = cleanString(entry?.marketingCopy || entry?.copy || entry?.marketingCopyOverride);
  const title = cleanString(entry?.title);

  if (!itemId && !role && !Number.isFinite(slotIndex)) {
    return null;
  }

  if (!prompt && !marketingCopy && !title) {
    return null;
  }

  return {
    itemId,
    role,
    slotIndex: Number.isFinite(slotIndex) ? slotIndex : 0,
    prompt,
    marketingCopy,
    title,
  };
}

export function normalizeCreationPlanOverrides(value) {
  let entries = value;
  if (typeof value === "string") {
    try {
      entries = JSON.parse(value);
    } catch (_error) {
      entries = [];
    }
  }

  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.map(normalizeCreationPlanOverrideEntry).filter(Boolean);
}

function findCreationPlanOverride(item = {}, overrides = []) {
  return overrides.find(
    (entry) =>
      (entry.itemId && entry.itemId === item.itemId) ||
      (entry.role && entry.role === item.role) ||
      (entry.slotIndex && Number(entry.slotIndex) === Number(item.slotIndex)),
  );
}

export function applyCreationPlanOverrides(plan = {}, value = []) {
  const overrides = normalizeCreationPlanOverrides(value);
  if (overrides.length === 0 || !Array.isArray(plan.items)) {
    return plan;
  }

  return {
    ...plan,
    items: plan.items.map((item) => {
      const override = findCreationPlanOverride(item, overrides);
      if (!override) {
        return item;
      }

      return {
        ...item,
        ...(override.title ? { title: override.title } : {}),
        ...(override.prompt ? { prompt: override.prompt } : {}),
        ...(override.marketingCopy ? { marketingCopy: override.marketingCopy } : {}),
      };
    }),
  };
}

export function buildCreationPlan(input = {}) {
  const productName = cleanString(input.productName);
  const productDescription = cleanString(input.productDescription);
  const sellingPoints = normalizeSellingPoints(input.sellingPoints);
  const dimensionSpecs = cleanString(input.dimensionSpecs);
  const dimensionUnitMode = normalizeCreationDimensionUnitMode(input.dimensionUnitMode);
  const dimensionSpecLines = normalizeDimensionSpecs(dimensionSpecs).map((line) => convertDimensionSpecLine(line, dimensionUnitMode.value));
  const dimensionSpecSummary = dimensionSpecLines.length > 0 ? dimensionSpecLines.map(trimTerminalSentencePunctuation).join(" / ") : "";
  const targetLanguage = normalizeCreationTargetLanguage(input.targetLanguage);
  const imageCount = normalizeCreationImageCount(input.imageCount);
  const scenario = normalizeCreationScenario(input.scenario);
  const industryTemplate = normalizeCreationIndustryTemplate(input.industryTemplate);
  const referenceImageRoles = normalizeCreationReferenceRoles(input.referenceImageRoles);
  const selectedRoles = normalizeCreationSelectedRoles(input.selectedRoles);
  const industryPresetRoles = getCreationIndustryRolePreset(industryTemplate.value);
  const industryPresetRoleSet = new Set(industryPresetRoles.map((role) => role.role));
  const defaultRoles =
    industryPresetRoles.length > 0
      ? [...industryPresetRoles, ...CREATION_ITEM_ROLES.filter((role) => !industryPresetRoleSet.has(role.role))]
      : CREATION_ITEM_ROLES;
  const plannedRoles = selectedRoles.length > 0 ? selectedRoles : defaultRoles.slice(0, imageCount);
  const effectiveImageCount = plannedRoles.length;

  if (!productName && !productDescription && sellingPoints.length === 0) {
    throw new Error("商品信息不能为空。");
  }

  const productLine = trimTerminalSentencePunctuation(productName || productDescription || sellingPoints[0]);
  const descriptionLine = trimTerminalSentencePunctuation(productDescription || "用户未提供详细描述");
  const sellingPointLine =
    sellingPoints.length > 0
      ? sellingPoints.map(trimTerminalSentencePunctuation).filter(Boolean).join(" / ")
      : "围绕商品核心价值提炼短卖点";

  return {
    productName,
    productDescription,
    sellingPoints,
    dimensionSpecs,
    dimensionUnitMode: dimensionUnitMode.value,
    dimensionUnitModeLabel: dimensionUnitMode.label,
    targetLanguage: targetLanguage.value,
    targetLanguageLabel: targetLanguage.label,
    imageCount: effectiveImageCount,
    scenario: scenario.value,
    scenarioLabel: scenario.label,
    industryTemplate: industryTemplate.value,
    industryTemplateLabel: industryTemplate.label,
    industryTemplatePath: industryTemplate.categoryPath || "",
    selectedRoles: plannedRoles.map((role) => role.role),
    referenceImageRoles,
    items: plannedRoles.map((role, index) => ({
      itemId: `${index + 1}-${role.role}`,
      slotIndex: index + 1,
      role: role.role,
      title: role.title,
      filenameToken: role.filenameToken,
      marketingCopyLanguage: targetLanguage.value,
      prompt: [
        `Create ${role.brief}.`,
        `Product: ${productLine}.`,
        `Description: ${descriptionLine}.`,
        `Selling points: ${sellingPointLine}.`,
        role.role === "dimensions" && dimensionSpecSummary
          ? `Dimension specifications for this size chart only: ${dimensionSpecSummary}. ${dimensionUnitMode.promptInstruction} Use these exact specifications only in the dimensions/specification image; other images may show broad size comparison, but do not print or reveal these exact values.`
          : "",
        `Scenario: ${scenario.label}. ${scenario.promptInstruction}`,
        `Industry template: ${industryTemplate.label}. ${industryTemplate.promptInstruction}`,
        getCreationIndustryTemplateRoleInstruction(industryTemplate, role.role),
        getCreationScenarioRoleInstruction(scenario.value, role.role),
        targetLanguage.promptInstruction,
        buildCreationReferenceGuidance(referenceImageRoles),
        "Ecommerce marketing quality, clear composition, realistic product details, polished commercial lighting.",
        "Avoid crowded layouts, illegible text, fake UI, watermarks, brand logos not supplied by the user, and unrelated products.",
      ]
        .filter(Boolean)
        .join(" "),
    })),
  };
}
