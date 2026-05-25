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
  {
    value: "fr",
    label: "Français",
    promptInstruction: "Use concise French marketing copy, keep image text short, and preserve brand names, model names, numbers, and units exactly.",
  },
  {
    value: "de",
    label: "Deutsch",
    promptInstruction: "Use concise German marketing copy, keep image text short, and preserve brand names, model names, numbers, and units exactly.",
  },
  {
    value: "es",
    label: "Español",
    promptInstruction: "Use concise Spanish marketing copy, keep image text short, and preserve brand names, model names, numbers, and units exactly.",
  },
];

export const CREATION_IMAGE_COUNT_OPTIONS = [4, 6, 8, 10, 12];
const DEFAULT_CREATION_TARGET_LANGUAGE = "en";
const DEFAULT_CREATION_DIMENSION_UNIT_MODE = "both";
const DEFAULT_CREATION_VISUAL_LANGUAGE = "classic-commercial";
const DEFAULT_CREATION_LOGO_PLACEMENT = "top-left";
const DEFAULT_CREATION_SKU_BUNDLE_COUNT = 1;
const MAX_CREATION_SKU_BUNDLE_COUNT = 20;

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

export const CREATION_LOGO_PLACEMENT_OPTIONS = [
  { value: "top-left", label: "左上", promptPosition: "top-left corner" },
  { value: "top-center", label: "上中", promptPosition: "top-center edge" },
  { value: "top-right", label: "右上", promptPosition: "top-right corner" },
  { value: "center-left", label: "左中", promptPosition: "center-left edge" },
  { value: "center", label: "居中", promptPosition: "center of the image" },
  { value: "center-right", label: "右中", promptPosition: "center-right edge" },
  { value: "bottom-left", label: "左下", promptPosition: "bottom-left corner" },
  { value: "bottom-center", label: "下中", promptPosition: "bottom-center edge" },
  { value: "bottom-right", label: "右下", promptPosition: "bottom-right corner" },
];

export const CREATION_LOGO_BACKGROUND_OPTIONS = [
  {
    value: "transparent",
    label: "透明底，直接放置",
    promptInstruction: "Treat the supplied reference as a transparent logo and place the transparent logo directly.",
  },
  {
    value: "remove-background",
    label: "非透明底，先抠图",
    promptInstruction: "First remove the logo reference background and isolate only the logo mark, then place it.",
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

export const CREATION_VISUAL_LANGUAGE_OPTIONS = [
  {
    value: "classic-commercial",
    label: "经典商业摄影",
    promptInstruction: "",
  },
  {
    value: "premium-studio",
    label: "高端棚拍",
    promptInstruction:
      "Use a deep controlled studio set with visible softbox shaping, sculpted rim highlights, precise reflection control, premium plinths or seamless sweep surfaces, and a luxury catalog mood.",
  },
  {
    value: "reference-style",
    label: "参考模式",
    promptInstruction:
      "Use the uploaded style reference images as the style authority: match their lighting, color grading, surface mood, camera language, background atmosphere, realism level, and composition rhythm while preserving the product subject from the product references or product brief. Do not copy the style reference subject, product identity, logo, text, packaging, or exact layout.",
  },
  {
    value: "clean-marketplace",
    label: "平台清爽白底",
    promptInstruction:
      "Use a pure white or near-white marketplace system with crisp cutout-like subject separation, very soft contact shadows, no lifestyle props, high readability, and thumbnail-safe marketplace composition.",
  },
  {
    value: "lifestyle-editorial",
    label: "生活方式杂志",
    promptInstruction:
      "Use a lifestyle magazine editorial look with a magazine-like lived-in environment, natural window or location light, human-scale context, curated editorial props, subtle depth of field, and polished but believable lifestyle restraint.",
  },
  {
    value: "social-ugc",
    label: "社媒实拍",
    promptInstruction:
      "Use phone-camera creator realism: casual handheld framing, everyday room or tabletop context, slightly imperfect natural light, authentic social-feed immediacy, and product-first clarity without studio polish.",
  },
  {
    value: "detail-infographic",
    label: "详情页信息图",
    promptInstruction:
      "Use a modular ecommerce information layout with panel blocks, callout lines, clear label zones, icon-like detail elements, structured hierarchy, and product-detail page readability.",
  },
  {
    value: "macro-material",
    label: "微距材质",
    promptInstruction:
      "Use a texture-led macro crop with close-range surface detail, raking side light, tactile material emphasis, shallow depth of field, and frame-filling craft or finish cues.",
  },
  {
    value: "outdoor-context",
    label: "户外场景",
    promptInstruction:
      "Use real outdoor environmental light with natural shadows, terrain or weather-aware surfaces, practical usage placement, credible activity context, and clear scale cues from the environment.",
  },
  {
    value: "minimal-luxury",
    label: "极简奢华",
    promptInstruction:
      "Use quiet luxury negative space with restrained neutral palettes, precise asymmetrical composition, refined stone/acrylic/metal surfaces, soft premium shadows, and minimal high-value presentation.",
  },
  {
    value: "bold-campaign",
    label: "活动海报",
    promptInstruction:
      "Use a poster-grade campaign composition with bolder graphic hierarchy, saturated accent fields, dynamic product angles, decisive silhouettes, energetic rim light, and campaign-ready copy zones.",
  },
  {
    value: "warm-handcrafted",
    label: "手作温度",
    promptInstruction:
      "Use a warm tactile handcrafted setting with wood, linen, paper, clay, or handmade surfaces, amber window light, gentle imperfections, human craft cues, and small-brand ecommerce warmth.",
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
    brief: "pain-point-driven benefit image that shows one or two selling points solving concrete shopper problems",
  },
  {
    role: "scene",
    title: "场景图",
    filenameToken: "scene",
    brief: "photorealistic product-in-use scene that shows the product's true environment, scale, and context-specific action",
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
    brief: "photorealistic real-person social-feed recommendation image that uses a real adult person or angler as supporting lifestyle context while the original product stays dominant",
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
    brief: "multi-window material detail image that analyzes texture, finish, joints, edges, surface detail, and quality cues",
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
      "Role focus: frame social proof as a product-centered feed recommendation with a real adult reviewer or angler as supporting marketing context without overpowering or changing the product.",
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

const CREATION_ROLE_INTENT_INSTRUCTIONS = {
  benefit:
    "Role intent: connect selling points to shopper pain points. Show the pain cue and resolved benefit visually, and avoid a feature-only label layout.",
  scene:
    "Role intent: show the product inside a believable use scene with real environment, true scale, and category-specific action. For fishing lures or bait, show it in river or lake water being pursued or struck by a fish; for ladders, show it realistically placed on solid open ground or beside the task area.",
  "social-proof":
    "Role intent: make this a photoreal real-person social-feed product recommendation image. Include a real adult person or angler as supporting marketing context, such as holding, presenting, or using the product near water, while you preserve the exact reference product as the unchanged sellable subject. For fishing lures or bait, create a real hooked fish scene. Show a real hooked fish only when its mouth, lip, or jaw is visibly biting an existing belly or tail treble hook from the reference lure. Clearly show one visible point of that original treble hook embedded in the fish mouth, lip, or jaw. Do not replace the treble hook with a separate single hook. Keep the lure body outside or beside the fish mouth, so the viewer can see the original lure and the real hook-up relationship clearly. Preserve the same lure silhouette, segment count, head direction, tail shape, paint pattern, eye placement, fin shapes, hook hangers, split rings, tow eye, belly treble hooks, and tail hook hardware. People, fish, hands, rods, line, water, logos, and text may appear as supporting marketing context, but they must not replace, redesign, duplicate, hide, cover, recolor, resize, or move any visible part of the reference lure. Do not invent a new hook, top hook, back hook, mouth ring, extra split ring, or new attachment point. Do not turn the lure into a real fish or a different lure SKU.",
  "usage-steps":
    "Role intent: teach the practical setup or operation with a clean step sequence while preserving the real product. Preserve the supplied reference product as the unchanged subject; use callout arrows, labels, hands, line, water, or small step panels around it, but do not redesign the lure body, paint pattern, segments, tail, hooks, lip, blade, or hardware. For fishing lures or bait, keep belly and tail treble hooks hanging from their original underside and tail hangers; never relocate hooks or hangers onto the top, back, side, fish mouth, or hand; attach the fishing line through the exact visible line-tie, tow eye, or split ring already present on the reference lure, using the same physical attachment point consistently in the main image and step panels; if the reference lure uses a front/nose tow eye ahead of the diving lip, use that front/nose tow eye; do not assume or add a top/back ring unless it is already visible in the reference; do not tie the line to the body, eye, hook hanger, belly, tail, mouth, propeller, diving lip, blade, or an invented ring, and do not add a hook, loose connector, or extra ring at the lure mouth or back.",
  "material-closeup":
    "Role intent: analyze stated or visible materials from the product description, selling points, category, and reference notes. Use several small inset detail panes to show texture, finish, joints, edges, coating, hardware, stitching, or surface response.",
};

const CREATION_ROLE_RENDERING_CONSTRAINTS = {
  "social-proof":
    "For this social-proof image, you may render one short selling-point headline from the provided selling points, plus at most two small callout phrases if they help the product sell.",
};

const CREATION_CONTENT_ALLOCATION_STRATEGY = "deterministic-rules";

const CREATION_CONTENT_FACT_SPLIT_RE = /[\n,;\uFF0C\uFF1B\u3002\u3001.!?]+/u;

const CREATION_CONTENT_CATEGORY_PATTERNS = {
  identity: [/product|subject|sku|\u5546\u54c1|\u4ea7\u54c1|\u4e3b\u4f53|sku/i],
  "visible-copy": [/visible\s*text|headline|slogan|caption|copy|font|typography|\u753b\u9762\u6587\u5b57|\u6587\u5b57|\u6807\u9898|\u6587\u6848|\u5b57\u4f53/i],
  benefit: [/benefit|selling|power|noise|portable|easy|\bled\b|light|flash|\u5356\u70b9|\u5438\u529b|\u4f4e\u566a|\u5f3a\u52b2|\u8f7b\u4fbf|\u591a\u573a\u666f|\u9002\u7528|\u7701\u529b|\u9ad8\u6548|\u706f|\u53d1\u5149|\u95ea\u5149/i],
  material: [/material|texture|surface|structure|detail|filter|nozzle|fabric|finish|steel|rattle|bead|abs|body|propeller|hook|hardware|\u6750\u8d28|\u7eb9\u7406|\u8d28\u611f|\u8868\u9762|\u7ed3\u6784|\u7ec6\u8282|\u6ee4\u82af|\u5438\u5634|\u505a\u5de5|\u94a2\u73e0|\u54cd\u73e0|\u94a2\u7403|\u73e0|\u672c\u4f53|\u6868\u53f6|\u9c7c\u94a9|\u4e94\u91d1/i],
  scene: [/scene|usage|context|environment|lifestyle|car interior|outdoor|indoor|\u4f7f\u7528\u573a\u666f|\u573a\u666f|\u8f66\u5185|\u6237\u5916|\u529e\u516c\u5ba4|\u65c5\u884c|\u53a8\u623f|\u751f\u6d3b/i],
  usage: [/step|setup|install|operation|how to|recharge|charging|usb|cable|\u4f7f\u7528\u6b65\u9aa4|\u6b65\u9aa4|\u5b89\u88c5|\u64cd\u4f5c|\u6e05\u6d01|\u7ec4\u88c5|\u5145\u7535|\u7535\u7ebf|\u6570\u636e\u7ebf/i],
  dimensions: [/dimension|size|spec|capacity|height|width|\bcm\b|\bmm\b|\bg\b|\boz\b|\u5c3a\u5bf8|\u89c4\u683c|\u5bb9\u91cf|\u9ad8\u5ea6|\u5bbd\u5ea6|\u91cd\u91cf/i],
  package: [/package|bundle|included|accessor|storage bag|usb|cable|\u5305\u88c5|\u6e05\u5355|\u5957\u88c5|\u6536\u7eb3\u888b|\u914d\u4ef6|\u7535\u7ebf|\u6570\u636e\u7ebf/i],
  trust: [/trust|quality|proof|safe|cert|warranty|durable|review|reliable|steel|rattle|bead|\u4fe1\u4efb|\u8d28\u91cf|\u5b89\u5168|\u8ba4\u8bc1|\u8d28\u4fdd|\u8010\u7528|\u8bc4\u4ef7|\u53e3\u7891|\u9632\u6c34|\u94a2\u73e0|\u54cd\u73e0/i],
};

const CREATION_ROLE_CONTENT_CATEGORIES = {
  hero: ["identity", "visible-copy", "benefit", "trust"],
  benefit: ["benefit", "visible-copy", "trust"],
  scene: ["scene", "usage", "benefit"],
  "detail-trust": ["trust", "material", "package"],
  comparison: ["benefit", "trust", "dimensions"],
  "social-proof": ["scene", "trust", "benefit"],
  package: ["package"],
  promotion: ["visible-copy", "benefit"],
  "material-closeup": ["material", "trust"],
  "usage-steps": ["usage", "scene"],
  dimensions: ["dimensions"],
  "review-qa": ["trust", "benefit"],
};

function cleanString(value) {
  return String(value || "").trim();
}

const CREATION_SKU_BUNDLE_COUNT_WORDS = new Map([
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

function clampCreationSkuBundleCount(value) {
  if (!Number.isFinite(value)) {
    return DEFAULT_CREATION_SKU_BUNDLE_COUNT;
  }
  return Math.min(MAX_CREATION_SKU_BUNDLE_COUNT, Math.max(DEFAULT_CREATION_SKU_BUNDLE_COUNT, Math.round(value)));
}

export function normalizeCreationSkuBundleCount(value, fallback = DEFAULT_CREATION_SKU_BUNDLE_COUNT) {
  const fallbackCount = clampCreationSkuBundleCount(Number.parseInt(cleanString(fallback), 10));
  const raw = cleanString(value);
  if (!raw) {
    return fallbackCount;
  }

  const digitMatch = raw.match(/\d+/);
  if (digitMatch) {
    return clampCreationSkuBundleCount(Number.parseInt(digitMatch[0], 10));
  }

  if (raw.includes("十")) {
    const [left, right] = raw.split("十");
    const tens = CREATION_SKU_BUNDLE_COUNT_WORDS.get(left) || 1;
    const ones = CREATION_SKU_BUNDLE_COUNT_WORDS.get(right) || 0;
    return clampCreationSkuBundleCount(tens * 10 + ones);
  }

  for (const [word, count] of CREATION_SKU_BUNDLE_COUNT_WORDS) {
    if (raw.includes(word)) {
      return clampCreationSkuBundleCount(count);
    }
  }

  return fallbackCount;
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

function uniqueCleanStrings(values = []) {
  const seen = new Set();
  return values
    .map(cleanString)
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function splitCreationContentFacts(value) {
  return uniqueCleanStrings(String(value || "").split(CREATION_CONTENT_FACT_SPLIT_RE));
}

function categorizeCreationContentFact(text, fallbackCategory) {
  const categories = Object.entries(CREATION_CONTENT_CATEGORY_PATTERNS)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(text)))
    .map(([category]) => category);
  if (categories.includes("visible-copy")) {
    return ["visible-copy"];
  }
  return categories.length > 0 ? categories : [fallbackCategory];
}

function buildCategorizedCreationContentFacts(facts, fallbackCategory) {
  return uniqueCleanStrings(facts).map((text) => ({
    text,
    categories: categorizeCreationContentFact(text, fallbackCategory),
  }));
}

export function buildCreationContentAllocation({ productDescription = "", sellingPoints = [] } = {}) {
  return {
    strategy: CREATION_CONTENT_ALLOCATION_STRATEGY,
    agentRequired: false,
    descriptionFacts: buildCategorizedCreationContentFacts(splitCreationContentFacts(productDescription), "identity"),
    sellingPointFacts: buildCategorizedCreationContentFacts(sellingPoints, "benefit"),
  };
}

function getCreationRoleContentCategories(role) {
  return CREATION_ROLE_CONTENT_CATEGORIES[role] || CREATION_ROLE_CONTENT_CATEGORIES.hero;
}

function selectCreationContentFacts(facts, categories, maxCount = 3) {
  const categorySet = new Set(categories);
  return facts
    .filter((fact) => fact.categories.some((category) => categorySet.has(category)))
    .map((fact) => fact.text)
    .slice(0, maxCount);
}

function formatCreationContentFacts(facts) {
  return uniqueCleanStrings(facts).map(trimTerminalSentencePunctuation).filter(Boolean).join(" / ");
}

function buildCreationRoleSourceFocus({
  role,
  allocation,
  descriptionLine,
  sellingPointLine,
  sellingPoints,
}) {
  const categories = getCreationRoleContentCategories(role);
  const descriptionFacts = selectCreationContentFacts(allocation.descriptionFacts, categories);
  const sellingPointFacts = selectCreationContentFacts(allocation.sellingPointFacts, categories);
  const selectedSellingPoints = formatCreationContentFacts(sellingPointFacts);
  const fallbackSellingPoints = sellingPoints.length <= 2 ? sellingPointLine : trimTerminalSentencePunctuation(sellingPoints[0]);
  const description = formatCreationContentFacts(descriptionFacts);
  const selling = sellingPoints.length <= 2 ? sellingPointLine : selectedSellingPoints || fallbackSellingPoints || sellingPointLine;

  return {
    strategy: allocation.strategy,
    categories,
    description,
    selling,
  };
}

export function normalizeCreationDimensionUnitMode(value) {
  const normalized = cleanString(value);
  return (
    CREATION_DIMENSION_UNIT_MODE_OPTIONS.find((option) => option.value === normalized) ||
    CREATION_DIMENSION_UNIT_MODE_OPTIONS.find((option) => option.value === DEFAULT_CREATION_DIMENSION_UNIT_MODE) ||
    CREATION_DIMENSION_UNIT_MODE_OPTIONS[0]
  );
}

export function normalizeCreationLogoPlacement(value) {
  const normalized = cleanString(value);
  return (
    CREATION_LOGO_PLACEMENT_OPTIONS.find((option) => option.value === normalized) ||
    CREATION_LOGO_PLACEMENT_OPTIONS.find((option) => option.value === DEFAULT_CREATION_LOGO_PLACEMENT) ||
    CREATION_LOGO_PLACEMENT_OPTIONS[0]
  );
}

export function normalizeCreationLogoBackground(value) {
  const normalized = cleanString(value);
  return (
    CREATION_LOGO_BACKGROUND_OPTIONS.find((option) => option.value === normalized) ||
    CREATION_LOGO_BACKGROUND_OPTIONS[0]
  );
}

export function normalizeCreationLogoOptions(value = {}) {
  let source = value;
  if (typeof value === "string") {
    try {
      source = JSON.parse(value);
    } catch (_error) {
      source = {};
    }
  }

  if (!source || typeof source !== "object") {
    source = {};
  }

  const filename = cleanString(source.filename || source.name || source.logoFilename);
  const placement = normalizeCreationLogoPlacement(source.placement || source.logoPlacement);
  const background = normalizeCreationLogoBackground(source.background || source.backgroundMode || source.logoBackground);
  const enabledValue = source.enabled ?? source.logoEnabled ?? Boolean(filename);
  const enabled =
    filename &&
    (enabledValue === true ||
      enabledValue === "true" ||
      enabledValue === "1" ||
      enabledValue === "on" ||
      enabledValue === 1);

  return {
    enabled: Boolean(enabled),
    filename: enabled ? filename : "",
    placement: placement.value,
    placementLabel: placement.label,
    promptPosition: placement.promptPosition,
    background: background.value,
    backgroundLabel: background.label,
    backgroundInstruction: background.promptInstruction,
  };
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
    CREATION_TARGET_LANGUAGE_OPTIONS.find((option) => option.value === DEFAULT_CREATION_TARGET_LANGUAGE) ||
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

export function normalizeCreationVisualLanguage(value) {
  const normalized = cleanString(value);
  return (
    CREATION_VISUAL_LANGUAGE_OPTIONS.find((option) => option.value === normalized) ||
    CREATION_VISUAL_LANGUAGE_OPTIONS.find((option) => option.value === DEFAULT_CREATION_VISUAL_LANGUAGE) ||
    CREATION_VISUAL_LANGUAGE_OPTIONS[0]
  );
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

function getCreationRoleIntentInstruction(roleValue) {
  return CREATION_ROLE_INTENT_INSTRUCTIONS[cleanString(roleValue)] || "";
}

function getCreationRoleRenderingConstraint(roleValue) {
  return CREATION_ROLE_RENDERING_CONSTRAINTS[cleanString(roleValue)] || "";
}

function getCreationIndustryTemplateRoleInstruction(industryTemplate, roleValue) {
  const role = cleanString(roleValue);
  const roleInstructions = industryTemplate?.rolePromptInstructions || {};
  return cleanString(roleInstructions[role] || roleInstructions.default || "");
}

function buildCreationVisualLanguageGuidance(visualLanguage) {
  const option = normalizeCreationVisualLanguage(visualLanguage?.value || visualLanguage);
  if (option.value === DEFAULT_CREATION_VISUAL_LANGUAGE) {
    return "";
  }

  return [
    `VISUAL LANGUAGE LOCK: Shared visual language: ${option.label}. This selected look must override the generic ecommerce baseline for the whole set.`,
    option.promptInstruction,
    "Keep the whole set visually consistent in lighting, color grading, background family, material treatment, brand atmosphere, layout density, and realism level; vary only the role-specific camera angle, framing, scene density, props, and information layout.",
    "Do not drift back to neutral classic commercial studio photography unless the selected visual language explicitly asks for it.",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildCreationVisualLanguageQualityLine(visualLanguage) {
  const option = normalizeCreationVisualLanguage(visualLanguage?.value || visualLanguage);
  if (option.value === DEFAULT_CREATION_VISUAL_LANGUAGE) {
    return "Ecommerce marketing quality, clear composition, realistic product details, polished commercial lighting.";
  }

  return "Ecommerce marketing quality and realistic product details; the final lighting, palette, background system, material mood, and layout density must follow the selected visual language instead of default polished commercial treatment.";
}

function buildCreationSkuBackgroundInstruction(visualLanguage) {
  const option = normalizeCreationVisualLanguage(visualLanguage?.value || visualLanguage);
  if (option.value === DEFAULT_CREATION_VISUAL_LANGUAGE) {
    return "Change the background from the uploaded white or plain product photo into a clean premium ecommerce background with polished commercial lighting.";
  }

  return "Change the background from the uploaded white or plain product photo into a new ecommerce setting that follows the selected visual language lock; preserve the SKU subject exactly while changing only the surrounding scene, surface, light, and layout mood.";
}

function buildCreationSkuQualityLine(visualLanguage) {
  const option = normalizeCreationVisualLanguage(visualLanguage?.value || visualLanguage);
  if (option.value === DEFAULT_CREATION_VISUAL_LANGUAGE) {
    return "Ecommerce SKU image quality, clear centered subject, clean background separation, realistic product details.";
  }

  return "Ecommerce SKU image quality, clear subject recognition, realistic product details, and a background, light, surface, and composition that visibly match the selected visual language.";
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

function parseArrayInput(value) {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  return Array.isArray(value) ? value : [];
}

function normalizeNumberArray(value) {
  const entries = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set();
  return entries
    .map((entry) => Number.parseInt(cleanString(entry), 10))
    .filter((entry) => Number.isFinite(entry) && entry > 0)
    .filter((entry) => {
      if (seen.has(entry)) {
        return false;
      }
      seen.add(entry);
      return true;
    });
}

function getSkuSubjectReferenceIndexes(source = {}) {
  return normalizeNumberArray(
    source.referenceIndexes ||
      source.reference_indices ||
      source.reference_indexes ||
      source.indexes ||
      source.indices ||
      source.index ||
      source.referenceIndex,
  );
}

function getSkuSubjectFilenames(source = {}, referenceImageRoles = []) {
  const explicitFilenames = uniqueCleanStrings([
    ...(Array.isArray(source.filenames) ? source.filenames : []),
    ...(Array.isArray(source.referenceFilenames) ? source.referenceFilenames : []),
    ...(Array.isArray(source.reference_filenames) ? source.reference_filenames : []),
    source.filename,
    source.name,
  ]);
  const indexFilenames = getSkuSubjectReferenceIndexes(source)
    .map((index) => referenceImageRoles[index - 1]?.filename)
    .filter(Boolean);

  return uniqueCleanStrings([...explicitFilenames, ...indexFilenames]);
}

function isSkuSubjectAccessoryLike(source = {}, filenames = [], referenceImageRoles = []) {
  const text = [
    source.kind,
    source.type,
    source.role,
    source.title,
    source.name,
    source.note,
    source.description,
  ]
    .map(cleanString)
    .join(" ")
    .toLowerCase();
  if (/\b(accessory|accessories|package|packaging|included|material|scene|style|support)\b/.test(text)) {
    return true;
  }

  const filenameSet = new Set(filenames.map((filename) => filename.toLowerCase()));
  const matchingRoles = referenceImageRoles.filter((entry) => filenameSet.has(cleanString(entry.filename).toLowerCase()));
  return matchingRoles.length > 0 && matchingRoles.every((entry) => cleanString(entry.role) !== "product");
}

function normalizeCreationSkuSubjectEntry(entry = {}, index = 0, referenceImageRoles = []) {
  const source = entry && typeof entry === "object" ? entry : {};
  const referenceIndexes = getSkuSubjectReferenceIndexes(source);
  const filenames = getSkuSubjectFilenames(source, referenceImageRoles);
  const title = cleanString(source.title || source.name || source.label || `SKU ${index + 1}`);
  const id = cleanString(source.id || source.subjectId || source.subject_id || source.groupId || source.group_id || title || `sku-${index + 1}`);
  const note = cleanString(source.note || source.description || source.summary || source.reason);
  const rawBundleCount = source.bundleCount ?? source.bundle_count ?? source.quantity ?? source.count ?? source.skuBundleCount;
  const bundleCount = rawBundleCount === undefined || rawBundleCount === null || cleanString(rawBundleCount) === ""
    ? 0
    : normalizeCreationSkuBundleCount(rawBundleCount);

  if (!id || filenames.length === 0 || isSkuSubjectAccessoryLike(source, filenames, referenceImageRoles)) {
    return null;
  }

  return {
    id,
    title,
    referenceIndexes,
    filenames,
    note,
    ...(bundleCount ? { bundleCount } : {}),
  };
}

function buildFallbackSkuSubjects(referenceImageRoles = []) {
  return referenceImageRoles
    .filter((entry) => cleanString(entry.role) === "product" && cleanString(entry.filename))
    .map((entry, index) => ({
      id: cleanString(entry.filename || `sku-${index + 1}`),
      title: cleanString(entry.note || entry.filename || `SKU ${index + 1}`),
      referenceIndexes: [index + 1],
      filenames: [cleanString(entry.filename)],
      note: cleanString(entry.note),
    }));
}

export function normalizeCreationSkuSubjects(value, referenceImageRoles = []) {
  const normalizedReferenceImageRoles = normalizeCreationReferenceRoles(referenceImageRoles);
  const entries = parseArrayInput(value);
  const subjects = (entries.length > 0 ? entries : buildFallbackSkuSubjects(normalizedReferenceImageRoles))
    .map((entry, index) => normalizeCreationSkuSubjectEntry(entry, index, normalizedReferenceImageRoles))
    .filter(Boolean);
  const seen = new Set();

  return subjects.filter((subject) => {
    const key = (subject.id || subject.filenames.join("|")).toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
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
  const recommendations = referenceRoles
    .map((entry, index) => normalizeCreationReferenceAnalysisEntry(entry, index, normalizedFilenames))
    .filter(Boolean)
    .slice(0, 9);

  return {
    summary: cleanString(source.summary || source.relationship || source.title),
    categoryHint: cleanString(source.categoryHint || source.category_hint || source.category || source.categoryName),
    categoryPath: cleanString(source.categoryPath || source.category_path),
    recommendations,
    skuSubjects: normalizeCreationSkuSubjects(source.skuSubjects || source.sku_subjects, recommendations),
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

function buildCreationLogoGuidance(logoOptions = {}) {
  const logo = normalizeCreationLogoOptions(logoOptions);
  if (!logo.enabled) {
    return "";
  }

  return [
    `Logo reference image: ${logo.filename}.`,
    `Place this supplied logo at the ${logo.promptPosition} (${logo.placement}) with clean safe margins.`,
    logo.backgroundInstruction,
    "Keep the logo legible and proportional; do not invent extra brand logos or unrelated watermarks.",
  ].join(" ");
}

function buildCreationSkuPrompt({
  skuSubject,
  productLine,
  targetLanguage,
  visualLanguage,
  logoOptions,
}) {
  const subjectTitle = cleanString(skuSubject.title || skuSubject.id || "SKU subject");
  const referenceList = skuSubject.filenames.join(", ");
  const bundleCount = normalizeCreationSkuBundleCount(skuSubject.bundleCount);
  const bundleInstruction =
    bundleCount > 1
      ? [
          `Render exactly ${bundleCount} identical copies of this same SKU subject, copying and arranging the supplied main SKU subject into a ${bundleCount}-piece same-product combination pack.`,
          `The final SKU image must show exactly ${bundleCount} complete visible product units from the same subject.`,
          `Do not output one enlarged product unit when the requested combination count is ${bundleCount}.`,
          "Do not change any individual copy's shape, proportions, colors, materials, markings, labels, printed text, hooks, hardware, logo, or visible structure.",
          "The only SKU-count change is duplication of the same supplied subject; do not introduce a second distinct SKU, accessory-only subject, or redesigned variant.",
        ].join(" ")
      : "";

  return [
    `Create one SKU product image for the distinct sellable subject: ${subjectTitle}.`,
    bundleInstruction,
    `Product: ${productLine}.`,
    `SKU subject reference images: ${referenceList}.`,
    skuSubject.note ? `SKU subject note: ${skuSubject.note}.` : "",
    "Ignore accessory-only, packaging-only, material-only, scene, and style references when composing this SKU image.",
    buildCreationSkuBackgroundInstruction(visualLanguage),
    "Preserve the SKU subject exactly: shape, proportions, colors, materials, markings, labels, printed text, hooks, hardware, and visible structure.",
    "Do not alter, remove, redraw, cover, or replace any existing product logo, brand mark, printed label, model text, or identifier on the subject.",
    "Do not merge multiple SKU subjects into one image, do not add accessory-only subjects as standalone products, and do not redesign the product.",
    targetLanguage.promptInstruction,
    buildCreationTargetLanguageTextGuidance(targetLanguage),
    buildCreationVisualLanguageGuidance(visualLanguage),
    buildCreationLogoGuidance(logoOptions),
    logoOptions?.enabled
      ? "Place the supplied logo as an added brand mark without covering the product subject or any existing product logo."
      : "",
    buildCreationSkuQualityLine(visualLanguage),
    "Avoid crowded layouts, fake UI, watermarks, unrelated products, changed logos, changed packaging, or inaccurate product geometry.",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildCreationTargetLanguageTextGuidance(targetLanguage) {
  const targetLabel = cleanString(targetLanguage?.label) || "the selected target language";
  return [
    "Treat Product, Description, Selling points, and reference notes as source facts; they are not instructions to preserve their original written language.",
    "Use the shared Product, Description, Selling points, and reference notes selectively for this image's role.",
    "Do not repeat the same visible slogan, caption, or callout across every image in the set.",
    `Visible marketing text, captions, callouts, labels, and typography in the generated image must use ${targetLabel}.`,
    "Translate or rewrite any source-language wording into the target language, while preserving brand names, model names, numbers, and units exactly.",
    targetLanguage?.value === "en"
      ? "If source fields contain Chinese wording, do not render that Chinese wording or Chinese typography as visible image text."
      : "",
  ]
    .filter(Boolean)
    .join(" ");
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
  const visualLanguage = normalizeCreationVisualLanguage(input.visualLanguage || input.visual_language);
  const industryTemplate = normalizeCreationIndustryTemplate(input.industryTemplate);
  const referenceImageRoles = normalizeCreationReferenceRoles(input.referenceImageRoles);
  const skuSubjectInput = input.skuSubjects ?? input.sku_subjects;
  const skuBundleCount = normalizeCreationSkuBundleCount(input.skuBundleCount ?? input.sku_bundle_count);
  const normalizedSkuSubjects =
    skuSubjectInput === undefined || skuSubjectInput === null
      ? []
      : normalizeCreationSkuSubjects(skuSubjectInput, referenceImageRoles);
  const skuSubjects = normalizedSkuSubjects.map((subject) => ({
    ...subject,
    bundleCount: normalizeCreationSkuBundleCount(subject.bundleCount, skuBundleCount),
  }));
  const logoOptions = normalizeCreationLogoOptions(input.logoOptions || input.logo);
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
  const contentAllocation = buildCreationContentAllocation({
    productDescription,
    sellingPoints,
  });

  const carouselItems = plannedRoles.map((role, index) => {
    const sourceFocus = buildCreationRoleSourceFocus({
      role: role.role,
      allocation: contentAllocation,
      descriptionLine,
      sellingPointLine,
      sellingPoints,
    });

    return {
      itemId: `${index + 1}-${role.role}`,
      slotIndex: index + 1,
      role: role.role,
      title: role.title,
      filenameToken: role.filenameToken,
      marketingCopyLanguage: targetLanguage.value,
      sourceFocus,
      prompt: [
        `Create ${role.brief}.`,
        `Product: ${productLine}.`,
        sourceFocus.description ? `Description: ${sourceFocus.description}.` : "",
        sourceFocus.selling ? `Selling points: ${sourceFocus.selling}.` : "",
        role.role === "dimensions" && dimensionSpecSummary
          ? `Dimension specifications for this size chart only: ${dimensionSpecSummary}. ${dimensionUnitMode.promptInstruction} Use these exact specifications only in the dimensions/specification image; other images may show broad size comparison, but do not print or reveal these exact values.`
          : "",
        getCreationRoleIntentInstruction(role.role),
        `Scenario: ${scenario.label}. ${scenario.promptInstruction}`,
        `Industry template: ${industryTemplate.label}. ${industryTemplate.promptInstruction}`,
        getCreationIndustryTemplateRoleInstruction(industryTemplate, role.role),
        getCreationScenarioRoleInstruction(scenario.value, role.role),
        targetLanguage.promptInstruction,
        buildCreationTargetLanguageTextGuidance(targetLanguage),
        buildCreationVisualLanguageGuidance(visualLanguage),
        getCreationRoleRenderingConstraint(role.role),
        buildCreationReferenceGuidance(referenceImageRoles),
        buildCreationLogoGuidance(logoOptions),
        buildCreationVisualLanguageQualityLine(visualLanguage),
        "Avoid crowded layouts, illegible text, fake UI, watermarks, brand logos not supplied by the user, and unrelated products.",
      ]
        .filter(Boolean)
        .join(" "),
    };
  });
  const skuItems = skuSubjects.map((skuSubject, index) => {
    const slotIndex = effectiveImageCount + index + 1;
    return {
      itemId: `${slotIndex}-sku-${skuSubject.id}`,
      slotIndex,
      role: "sku",
      title: `SKU image ${index + 1}`,
      filenameToken: `sku-${index + 1}`,
      marketingCopyLanguage: targetLanguage.value,
      skuSubject,
      prompt: buildCreationSkuPrompt({
        skuSubject,
        productLine,
        targetLanguage,
        visualLanguage,
        logoOptions,
      }),
    };
  });

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
    visualLanguage: visualLanguage.value,
    visualLanguageLabel: visualLanguage.label,
    industryTemplate: industryTemplate.value,
    industryTemplateLabel: industryTemplate.label,
    industryTemplatePath: industryTemplate.categoryPath || "",
    selectedRoles: plannedRoles.map((role) => role.role),
    referenceImageRoles,
    skuSubjects,
    skuBundleCount,
    skuImageCount: skuSubjects.length,
    contentAllocation: {
      strategy: contentAllocation.strategy,
      agentRequired: contentAllocation.agentRequired,
    },
    logo: logoOptions.enabled ? logoOptions : null,
    items: [...carouselItems, ...skuItems],
  };
}
