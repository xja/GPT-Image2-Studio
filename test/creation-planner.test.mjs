import test from "node:test";
import assert from "node:assert/strict";

import {
  applyCreationPlanOverrides,
  buildCreationPlan,
  getCreationScenarioRoleInstruction,
  getCreationScenarioRolePreset,
  normalizeCreationReferenceAnalysis,
  normalizeCreationImageCount,
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
  assert.equal(normalizeCreationTargetLanguage("unknown").value, "zh-CN");
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
  assert.ok(plan.items.some((item) => item.prompt.includes("material texture")));
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
