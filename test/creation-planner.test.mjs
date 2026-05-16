import test from "node:test";
import assert from "node:assert/strict";

import {
  applyCreationPlanOverrides,
  buildCreationPlan,
  getCreationIndustryRolePreset,
  getCreationScenarioRoleInstruction,
  getCreationScenarioRolePreset,
  normalizeCreationLogoOptions,
  normalizeCreationDimensionUnitMode,
  normalizeCreationReferenceAnalysis,
  normalizeCreationImageCount,
  normalizeCreationIndustryTemplate,
  normalizeCreationReferenceRoles,
  normalizeCreationScenario,
  normalizeCreationSelectedRoles,
  normalizeCreationTargetLanguage,
} from "../lib/creation-planner.mjs";

test("creation planner applies preview plan prompt overrides without changing set shape", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    selectedRoles: ["hero", "benefit", "scene"],
  });

  const updated = applyCreationPlanOverrides(plan, [
    { itemId: "1-hero", prompt: "Custom hero prompt for the preview plan." },
    { role: "benefit", prompt: "Custom benefit prompt from role override.", marketingCopy: "Clear taste, fast cleanup" },
    { slotIndex: 99, prompt: "Ignored because the slot does not exist." },
  ]);

  assert.notEqual(updated, plan);
  assert.equal(updated.items.length, 3);
  assert.deepEqual(
    updated.items.map((item) => item.itemId),
    ["1-hero", "2-benefit", "3-scene"],
  );
  assert.equal(updated.items[0].prompt, "Custom hero prompt for the preview plan.");
  assert.equal(updated.items[1].prompt, "Custom benefit prompt from role override.");
  assert.equal(updated.items[1].marketingCopy, "Clear taste, fast cleanup");
  assert.equal(updated.items[2].prompt, plan.items[2].prompt);
  assert.equal(plan.items[0].prompt.includes("Custom hero prompt"), false);
});

test("creation planner builds the fixed four-image ecommerce set", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "透明便携咖啡冲煮器，适合办公室和旅行",
    sellingPoints: "轻便, 易清洁, 口感稳定",
    targetLanguage: "en",
  });

  assert.equal(plan.targetLanguage, "en");
  assert.equal(plan.targetLanguageLabel, "English");
  assert.deepEqual(
    plan.items.map((item) => item.role),
    ["hero", "benefit", "scene", "detail-trust"],
  );
  assert.deepEqual(
    plan.items.map((item) => item.title),
    ["主图", "卖点图", "场景图", "详情信任图"],
  );
  assert.ok(plan.items.every((item) => item.prompt.includes("Use concise English marketing copy")));
  assert.ok(plan.items.every((item) => item.prompt.includes("AeroPress Clear")));
  assert.match(plan.items[0].prompt, /clean ecommerce hero image/i);
  assert.match(plan.items[1].prompt, /benefit/i);
  assert.match(plan.items[2].prompt, /lifestyle/i);
  assert.match(plan.items[3].prompt, /trust/i);
});

test("creation planner avoids duplicated punctuation in composed prompt fields", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear.",
    productDescription: "Transparent portable coffee brewer.",
    sellingPoints: ["Brew anywhere.", "Leakproof!"],
    targetLanguage: "en",
  });

  const prompt = plan.items[0].prompt;
  assert.match(prompt, /Product: AeroPress Clear\./);
  assert.match(prompt, /Description: Transparent portable coffee brewer\./);
  assert.match(prompt, /Selling points: Brew anywhere \/ Leakproof\./);
  assert.doesNotMatch(prompt, /\.\./);
  assert.doesNotMatch(prompt, /!\./);
});

test("creation planner gives concrete ecommerce role intent to scene, seeding, material, usage, and benefit images", () => {
  const plan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented lifelike lure with scale texture, steel treble hooks, and flexible tail action",
    sellingPoints: "fish ignore basic lures\nsharp hooks\ndurable material",
    targetLanguage: "en",
    selectedRoles: ["benefit", "scene", "social-proof", "usage-steps", "material-closeup"],
  });

  const promptByRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));

  assert.match(promptByRole.benefit, /pain-point-driven benefit image/);
  assert.match(promptByRole.benefit, /shopper pain points/);
  assert.match(promptByRole.benefit, /resolved benefit visually/);
  assert.match(promptByRole.scene, /photorealistic product-in-use scene/);
  assert.match(promptByRole.scene, /being pursued or struck by a fish/);
  assert.match(promptByRole["social-proof"], /social-feed product recommendation image/);
  assert.match(promptByRole["social-proof"], /real adult person or angler/);
  assert.match(promptByRole["social-proof"], /preserve the exact reference product as the unchanged sellable subject/);
  assert.match(promptByRole["social-proof"], /same lure silhouette, segment count, head direction, tail shape, paint pattern, eye placement, fin shapes, hook hangers, split rings, tow eye, belly treble hooks, and tail hook hardware/);
  assert.match(promptByRole["social-proof"], /People, fish, hands, rods, line, water, logos, and text may appear as supporting marketing context/);
  assert.match(promptByRole["social-proof"], /Show a real hooked fish only when its mouth, lip, or jaw is visibly biting an existing belly or tail treble hook from the reference lure/);
  assert.match(promptByRole["social-proof"], /Clearly show one visible point of that original treble hook embedded in the fish mouth, lip, or jaw/);
  assert.match(promptByRole["social-proof"], /Do not replace the treble hook with a separate single hook/);
  assert.match(promptByRole["social-proof"], /Keep the lure body outside or beside the fish mouth/);
  assert.match(promptByRole["social-proof"], /Do not invent a new hook, top hook, back hook, mouth ring, extra split ring, or new attachment point/);
  assert.match(promptByRole["social-proof"], /must not replace, redesign, duplicate, hide, cover, recolor, resize, or move any visible part of the reference lure/);
  assert.match(promptByRole["social-proof"], /Do not turn the lure into a real fish or a different lure SKU/);
  assert.match(promptByRole["social-proof"], /one short selling-point headline from the provided selling points/);
  assert.doesNotMatch(promptByRole["social-proof"], /caught fish merely posed beside the lure/);
  assert.match(promptByRole["usage-steps"], /Preserve the supplied reference product as the unchanged subject/);
  assert.match(promptByRole["usage-steps"], /do not redesign the lure body, paint pattern, segments, tail, hooks, lip, blade, or hardware/);
  assert.match(promptByRole["usage-steps"], /keep belly and tail treble hooks hanging from their original underside and tail hangers/);
  assert.match(promptByRole["usage-steps"], /never relocate hooks or hangers onto the top, back, side, fish mouth, or hand/);
  assert.match(promptByRole["usage-steps"], /attach the fishing line through the exact visible line-tie, tow eye, or split ring already present on the reference lure/);
  assert.match(promptByRole["usage-steps"], /if the reference lure uses a front\/nose tow eye ahead of the diving lip, use that front\/nose tow eye/);
  assert.match(promptByRole["usage-steps"], /do not assume or add a top\/back ring unless it is already visible in the reference/);
  assert.match(promptByRole["usage-steps"], /do not tie the line to the body, eye, hook hanger, belly, tail, mouth, propeller, diving lip, blade, or an invented ring/);
  assert.match(promptByRole["usage-steps"], /do not add a hook, loose connector, or extra ring at the lure mouth or back/);
  assert.match(promptByRole["material-closeup"], /multi-window material detail image/);
  assert.match(promptByRole["material-closeup"], /several small inset detail panes/);
  assert.match(promptByRole["material-closeup"], /texture, finish, joints, edges/);
});

test("creation planner injects Simplified Chinese target-language guidance", () => {
  const plan = buildCreationPlan({
    productName: "云感防晒衣",
    productDescription: "夏季户外轻薄防晒外套",
    sellingPoints: ["UPF50+", "冰感面料"],
    targetLanguage: "zh-CN",
  });

  assert.equal(plan.targetLanguage, "zh-CN");
  assert.equal(plan.targetLanguageLabel, "简体中文");
  assert.ok(plan.items.every((item) => item.prompt.includes("使用简体中文短营销文案")));
  assert.ok(plan.items.every((item) => item.marketingCopyLanguage === "zh-CN"));
});

test("creation planner normalizes supported target languages", () => {
  assert.equal(normalizeCreationTargetLanguage("en").value, "en");
  assert.equal(normalizeCreationTargetLanguage("ja").value, "ja");
  assert.equal(normalizeCreationTargetLanguage("unknown").value, "en");
});

test("creation planner defaults to English copy and metric-plus-imperial specs", () => {
  const plan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented swim bait",
    sellingPoints: "realistic finish",
    selectedRoles: ["dimensions"],
    dimensionSpecs: "13cm/35g",
  });

  assert.equal(normalizeCreationTargetLanguage("").value, "en");
  assert.equal(normalizeCreationDimensionUnitMode("").value, "both");
  assert.equal(plan.targetLanguage, "en");
  assert.equal(plan.targetLanguageLabel, "English");
  assert.equal(plan.dimensionUnitMode, "both");
  assert.match(plan.items[0].prompt, /13cm \(5\.12 in\)\/35g \(1\.23 oz\)/);
  assert.match(plan.items[0].prompt, /Use concise English marketing copy/);
});

test("creation planner normalizes optional logo placement and background handling", () => {
  const logo = normalizeCreationLogoOptions({
    enabled: true,
    filename: "brand-mark.png",
    placement: "top-right",
    background: "remove-background",
  });

  assert.equal(logo.enabled, true);
  assert.equal(logo.filename, "brand-mark.png");
  assert.equal(logo.placement, "top-right");
  assert.equal(logo.background, "remove-background");
  assert.equal(logo.placementLabel, "右上");
  assert.equal(logo.backgroundLabel, "非透明底，先抠图");

  const defaultLogo = normalizeCreationLogoOptions({
    enabled: true,
    filename: "brand-mark.png",
  });
  assert.equal(defaultLogo.placement, "top-left");
  assert.equal(defaultLogo.placementLabel, "左上");
});

test("creation planner injects optional logo guidance into every generated item", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    logoOptions: {
      enabled: true,
      filename: "brand-mark.png",
      placement: "bottom-left",
      background: "transparent",
    },
  });

  assert.equal(plan.logo?.filename, "brand-mark.png");
  assert.equal(plan.logo?.placement, "bottom-left");
  assert.equal(plan.logo?.background, "transparent");
  assert.ok(plan.items.every((item) => item.prompt.includes("brand-mark.png")));
  assert.ok(plan.items.every((item) => item.prompt.includes("bottom-left")));
  assert.ok(plan.items.every((item) => item.prompt.includes("transparent logo")));
});

test("creation planner expands ecommerce scenario sets to eight images", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    scenario: "detail-page",
    imageCount: "8",
  });

  assert.equal(plan.imageCount, 8);
  assert.equal(plan.scenario, "detail-page");
  assert.equal(plan.scenarioLabel, "详情页转化");
  assert.deepEqual(
    plan.items.map((item) => item.role),
    ["hero", "benefit", "scene", "detail-trust", "comparison", "social-proof", "package", "promotion"],
  );
  assert.ok(plan.items.every((item) => item.prompt.includes("Detail-page conversion scenario")));
  assert.ok(plan.items.every((item) => item.prompt.includes("Use concise English marketing copy")));
});

test("creation planner expands ecommerce scenario sets to twelve images", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    scenario: "livestream",
    imageCount: "12",
  });

  assert.equal(plan.imageCount, 12);
  assert.equal(plan.scenario, "livestream");
  assert.equal(plan.scenarioLabel, "直播电商");
  assert.deepEqual(
    plan.items.map((item) => item.role),
    [
      "hero",
      "benefit",
      "scene",
      "detail-trust",
      "comparison",
      "social-proof",
      "package",
      "promotion",
      "material-closeup",
      "usage-steps",
      "dimensions",
      "review-qa",
    ],
  );
  assert.ok(plan.items.every((item) => item.prompt.includes("Live commerce scenario")));
  assert.ok(plan.items.some((item) => item.prompt.includes("multi-window material detail")));
  assert.ok(plan.items.some((item) => item.prompt.includes("how to use")));
  assert.ok(plan.items.some((item) => item.prompt.includes("dimensions")));
});

test("creation planner uses selected ecommerce role set when provided", () => {
  const selectedRoles = normalizeCreationSelectedRoles(["usage-steps", "hero", "unknown", "dimensions", "hero"]);
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    scenario: "marketplace-search",
    imageCount: "12",
    selectedRoles,
  });

  assert.deepEqual(
    selectedRoles.map((role) => role.role),
    ["usage-steps", "hero", "dimensions"],
  );
  assert.equal(plan.imageCount, 3);
  assert.deepEqual(plan.selectedRoles, ["usage-steps", "hero", "dimensions"]);
  assert.deepEqual(
    plan.items.map((item) => item.role),
    ["usage-steps", "hero", "dimensions"],
  );
  assert.deepEqual(
    plan.items.map((item) => item.slotIndex),
    [1, 2, 3],
  );
  assert.ok(plan.items.every((item) => item.prompt.includes("Marketplace search scenario")));
});

test("creation planner only injects size specifications into the dimensions role", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean",
    targetLanguage: "en",
    selectedRoles: ["hero", "comparison", "dimensions"],
    dimensionSpecs: "Height 145mm\nDiameter 110mm\nCapacity 350ml",
    dimensionUnitMode: "metric",
  });

  const heroPrompt = plan.items.find((item) => item.role === "hero").prompt;
  const comparisonPrompt = plan.items.find((item) => item.role === "comparison").prompt;
  const dimensionsPrompt = plan.items.find((item) => item.role === "dimensions").prompt;

  assert.equal(plan.dimensionSpecs, "Height 145mm\nDiameter 110mm\nCapacity 350ml");
  assert.match(dimensionsPrompt, /Dimension specifications for this size chart only: Height 145mm \/ Diameter 110mm \/ Capacity 350ml\./);
  assert.match(dimensionsPrompt, /Use these exact specifications only in the dimensions\/specification image/);
  assert.doesNotMatch(heroPrompt, /145mm|110mm|350ml/);
  assert.doesNotMatch(comparisonPrompt, /145mm|110mm|350ml/);
});

test("creation planner converts dimension specs to the selected unit mode", () => {
  const metricPlan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean",
    targetLanguage: "en",
    selectedRoles: ["dimensions"],
    dimensionSpecs: "Height 5.7 in\nDiameter 4.3 in\nCapacity 12 fl oz",
    dimensionUnitMode: "metric",
  });
  const bothPlan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean",
    targetLanguage: "en",
    selectedRoles: ["dimensions"],
    dimensionSpecs: "Height 14.5 cm\nCapacity 350 ml",
    dimensionUnitMode: "both",
  });

  assert.equal(metricPlan.dimensionUnitMode, "metric");
  assert.match(metricPlan.items[0].prompt, /Height 14\.48 cm \/ Diameter 10\.92 cm \/ Capacity 354\.88 ml/);
  assert.doesNotMatch(metricPlan.items[0].prompt, /5\.7 in|4\.3 in|12 fl oz/);
  assert.equal(bothPlan.dimensionUnitMode, "both");
  assert.match(bothPlan.items[0].prompt, /Height 14\.5 cm \(5\.71 in\) \/ Capacity 350 ml \(11\.83 fl oz\)/);
});

test("creation planner converts compact metric weight specs in selected unit mode", () => {
  const plan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented swim bait",
    sellingPoints: "realistic finish",
    targetLanguage: "en",
    selectedRoles: ["dimensions"],
    dimensionSpecs: "13cm/35g",
    dimensionUnitMode: "both",
  });

  assert.match(plan.items[0].prompt, /13cm \(5\.12 in\)\/35g \(1\.23 oz\)/);
});

test("creation planner exposes scenario-specific role presets", () => {
  assert.deepEqual(
    getCreationScenarioRolePreset("livestream").map((role) => role.role),
    [
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
  );
  assert.deepEqual(
    getCreationScenarioRolePreset("marketplace-search").map((role) => role.role),
    ["hero", "benefit", "comparison", "dimensions", "material-closeup", "review-qa"],
  );
  assert.deepEqual(
    getCreationScenarioRolePreset("unknown").map((role) => role.role),
    ["hero", "benefit", "scene", "detail-trust"],
  );
});

test("creation planner applies industry templates to default role sets and prompt strategy", () => {
  const plan = buildCreationPlan({
    productName: "Glow Serum",
    productDescription: "Lightweight facial serum for daily skincare routines",
    sellingPoints: "hydrating, travel friendly, smooth texture",
    targetLanguage: "en",
    scenario: "detail-page",
    imageCount: "8",
    industryTemplate: "beauty",
  });

  assert.equal(plan.industryTemplate, "beauty");
  assert.equal(plan.industryTemplateLabel, "美妆个护");
  assert.deepEqual(
    plan.selectedRoles,
    ["hero", "benefit", "material-closeup", "usage-steps", "detail-trust", "social-proof", "package", "review-qa"],
  );
  assert.ok(plan.items.every((item) => item.prompt.includes("Beauty and personal care industry template")));
  assert.ok(plan.items.every((item) => item.prompt.includes("texture, swatches, skincare use, packaging, and benefit hierarchy")));
});

test("creation planner applies fourth-level category templates to role presets and prompts", () => {
  const plan = buildCreationPlan({
    productName: "Pocket X1",
    productDescription: "Compact phone with bright screen and long battery life",
    sellingPoints: "OLED display, slim body, reliable camera",
    targetLanguage: "zh-CN",
    imageCount: 6,
    industryTemplate: "category:C06-001-001-001",
  });

  assert.equal(plan.industryTemplate, "category:C06-001-001-001");
  assert.equal(plan.industryTemplateLabel, "智能手机");
  assert.equal(plan.industryTemplatePath, "数码电子 > 手机通讯 > 手机 > 智能手机");
  assert.deepEqual(plan.selectedRoles.slice(0, 4), ["hero", "benefit", "dimensions", "usage-steps"]);
  assert.ok(
    plan.items.every((item) =>
      item.prompt.includes("Ecommerce category path: 数码电子 > 手机通讯 > 手机 > 智能手机"),
    ),
  );
  assert.ok(plan.items.every((item) => item.prompt.includes("Category template: 智能手机")));
});

test("creation planner applies category role prompt instructions to matching set images", () => {
  const selectedRoles = ["hero", "scene", "detail-trust", "dimensions", "usage-steps"];
  const plan = buildCreationPlan({
    productName: "Pocket X1",
    productDescription: "智能手机，OLED 屏幕，长续航",
    sellingPoints: "轻薄机身, 摄像头清晰, 快充",
    targetLanguage: "zh-CN",
    imageCount: 5,
    industryTemplate: "category:C06-001-001-001",
    selectedRoles,
  });

  const promptByRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));
  const categoryStrategy = [
    "Category template: 智能手机",
    "Ecommerce category path: 数码电子 > 手机通讯 > 手机 > 智能手机",
    "Consumer electronics focus: show ports, screen or device details, dimensions, specifications, comparison proof",
  ];

  assert.deepEqual(plan.selectedRoles, selectedRoles);
  assert.ok(selectedRoles.every((role) => promptByRole[role]));
  assert.ok(
    selectedRoles.every((role) => categoryStrategy.every((strategy) => promptByRole[role].includes(strategy))),
  );
  assert.match(promptByRole.scene, /通勤手持|桌面办公/);
  assert.match(promptByRole["detail-trust"], /摄像头模组/);
  assert.match(promptByRole["detail-trust"], /屏幕边框/);
  assert.match(promptByRole.dimensions, /机身厚度/);
  assert.match(promptByRole.dimensions, /握持尺度/);
  assert.match(promptByRole["usage-steps"], /拍摄/);
  assert.match(promptByRole["usage-steps"], /游戏/);
  assert.match(promptByRole["usage-steps"], /充电/);
  assert.match(promptByRole["usage-steps"], /连接/);
  assert.deepEqual(
    plan.items.filter((item) => /通勤手持|桌面办公/.test(item.prompt)).map((item) => item.role),
    ["scene"],
  );
});

test("creation planner normalizes supported industry templates", () => {
  assert.equal(normalizeCreationIndustryTemplate("apparel").value, "apparel");
  assert.equal(normalizeCreationIndustryTemplate("beauty").value, "beauty");
  assert.equal(normalizeCreationIndustryTemplate("food").value, "food");
  assert.equal(normalizeCreationIndustryTemplate("electronics").value, "electronics");
  assert.equal(normalizeCreationIndustryTemplate("home").value, "home");
  assert.equal(normalizeCreationIndustryTemplate("unknown").value, "general");
  assert.deepEqual(
    getCreationIndustryRolePreset("electronics").map((role) => role.role),
    ["hero", "benefit", "dimensions", "usage-steps", "detail-trust", "comparison", "package", "review-qa"],
  );
  assert.deepEqual(getCreationIndustryRolePreset("general"), []);
});

test("creation planner fills larger industry template sets with remaining ecommerce roles", () => {
  const plan = buildCreationPlan({
    productName: "Pocket Camera",
    productDescription: "Compact 3C device with screen and accessory kit",
    sellingPoints: "portable, clear display, easy setup",
    targetLanguage: "en",
    imageCount: "12",
    industryTemplate: "electronics",
  });

  assert.equal(plan.imageCount, 12);
  assert.equal(plan.industryTemplate, "electronics");
  assert.deepEqual(
    plan.selectedRoles.slice(0, 8),
    ["hero", "benefit", "dimensions", "usage-steps", "detail-trust", "comparison", "package", "review-qa"],
  );
  assert.equal(new Set(plan.selectedRoles).size, 12);
});

test("creation planner adds role-specific guidance inside each marketing scenario", () => {
  const livestreamPlan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    scenario: "livestream",
    selectedRoles: ["usage-steps", "promotion"],
  });
  const marketplacePlan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    scenario: "marketplace-search",
    selectedRoles: ["hero", "comparison"],
  });
  const socialSeedingPlan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented lifelike lure with scale texture and steel treble hooks",
    sellingPoints: "lifelike finish, sharp hooks, durable material",
    targetLanguage: "en",
    scenario: "social-seeding",
    selectedRoles: ["social-proof"],
  });

  assert.match(
    livestreamPlan.items.find((item) => item.role === "usage-steps").prompt,
    /host-ready demonstration sequence/,
  );
  assert.match(
    livestreamPlan.items.find((item) => item.role === "promotion").prompt,
    /limited-time offer callout/,
  );
  assert.match(
    marketplacePlan.items.find((item) => item.role === "hero").prompt,
    /thumbnail-first listing image/,
  );
  assert.match(
    marketplacePlan.items.find((item) => item.role === "comparison").prompt,
    /crowded search result pages/,
  );
  assert.match(
    socialSeedingPlan.items.find((item) => item.role === "social-proof").prompt,
    /product-centered feed recommendation/,
  );
  assert.match(
    socialSeedingPlan.items.find((item) => item.role === "social-proof").prompt,
    /real adult person or angler/,
  );
  assert.doesNotMatch(
    socialSeedingPlan.items.find((item) => item.role === "social-proof").prompt,
    /believable user recommendation/,
  );
  assert.match(
    socialSeedingPlan.items.find((item) => item.role === "social-proof").prompt,
    /supporting marketing context/,
  );
  assert.match(
    socialSeedingPlan.items.find((item) => item.role === "social-proof").prompt,
    /real hooked fish/,
  );
  assert.match(getCreationScenarioRoleInstruction("unknown", "hero"), /selected ecommerce scenario/);
});

test("creation planner normalizes supported scenario and image count options", () => {
  assert.equal(normalizeCreationImageCount("6"), 6);
  assert.equal(normalizeCreationImageCount("8"), 8);
  assert.equal(normalizeCreationImageCount("10"), 10);
  assert.equal(normalizeCreationImageCount("12"), 12);
  assert.equal(normalizeCreationImageCount("99"), 4);
  assert.equal(normalizeCreationScenario("social-seeding").value, "social-seeding");
  assert.equal(normalizeCreationScenario("livestream").value, "livestream");
  assert.equal(normalizeCreationScenario("gift-guide").value, "gift-guide");
  assert.equal(normalizeCreationScenario("unknown").value, "standard");
});

test("creation planner injects reference image role guidance", () => {
  const roles = normalizeCreationReferenceRoles([
    { filename: "front.png", role: "product" },
    { filename: "box.png", role: "package" },
    { filename: "texture.png", role: "material" },
    { filename: "unknown.png", role: "not-supported" },
  ]);
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean",
    targetLanguage: "en",
    referenceImageRoles: roles,
  });

  assert.deepEqual(
    roles.map((entry) => [entry.filename, entry.role]),
    [
      ["front.png", "product"],
      ["box.png", "package"],
      ["texture.png", "material"],
      ["unknown.png", "product"],
    ],
  );
  assert.equal(plan.referenceImageRoles.length, 4);
  assert.ok(plan.items.every((item) => item.prompt.includes("Reference image roles:")));
  assert.ok(plan.items.every((item) => item.prompt.includes("front.png = product subject")));
  assert.ok(plan.items.every((item) => item.prompt.includes("box.png = package and included items")));
  assert.ok(plan.items.every((item) => item.prompt.includes("texture.png = material and close-up detail")));
});

test("creation reference analysis normalizes role suggestions and prompt notes", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到产品正面、纹理细节和厨房使用场景。",
      reference_roles: [
        { index: 1, filename: "front.png", role: "product", note: "正面主体，保留透明结构" },
        { index: 2, filename: "texture.png", role: "material", note: "磨砂纹理和边缘细节" },
        { index: 3, filename: "kitchen.png", role: "scene", note: "厨房台面使用环境" },
      ],
      risks: ["包装信息不足"],
    },
    ["front.png", "texture.png", "kitchen.png"],
  );
  const roles = normalizeCreationReferenceRoles(analysis.recommendations);
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean",
    targetLanguage: "en",
    referenceImageRoles: roles,
  });

  assert.equal(analysis.summary, "识别到产品正面、纹理细节和厨房使用场景。");
  assert.equal(analysis.categoryHint, "");
  assert.equal(analysis.categoryPath, "");
  assert.deepEqual(
    analysis.recommendations.map((entry) => [entry.filename, entry.role, entry.roleLabel, entry.note]),
    [
      ["front.png", "product", "商品主体", "正面主体，保留透明结构"],
      ["texture.png", "material", "材质细节", "磨砂纹理和边缘细节"],
      ["kitchen.png", "scene", "使用场景", "厨房台面使用环境"],
    ],
  );
  assert.deepEqual(analysis.risks, ["包装信息不足"]);
  assert.ok(plan.items.every((item) => item.prompt.includes("texture.png = material and close-up detail")));
  assert.ok(plan.items.every((item) => item.prompt.includes("Analyst note: 磨砂纹理和边缘细节")));
});

test("creation reference analysis keeps category hints for template auto switching", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到手机正面和屏幕细节。",
      category_hint: "智能手机",
      category_path: "数码电子 > 手机通讯 > 手机 > 智能手机",
      reference_roles: [{ index: 1, filename: "phone.png", role: "product", note: "手机主体和屏幕比例。" }],
      risks: [],
    },
    ["phone.png"],
  );

  assert.equal(analysis.categoryHint, "智能手机");
  assert.equal(analysis.categoryPath, "数码电子 > 手机通讯 > 手机 > 智能手机");
});

test("creation planner rejects missing product information", () => {
  assert.throws(
    () =>
      buildCreationPlan({
        productName: "",
        productDescription: "",
        sellingPoints: "",
        targetLanguage: "en",
      }),
    /商品信息不能为空/,
  );
});
