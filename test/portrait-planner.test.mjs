import test from "node:test";
import assert from "node:assert/strict";

import {
  PORTRAIT_ACTION_PRESETS,
  PORTRAIT_STYLE_PRESETS,
  applyPortraitPlanOverrides,
  buildPortraitPlan,
  normalizePortraitActions,
  normalizePortraitImageCount,
  normalizePortraitStyles,
} from "../lib/portrait-planner.mjs";

test("portrait planner exposes the v1 photography style presets", () => {
  assert.deepEqual(
    PORTRAIT_STYLE_PRESETS.map((style) => style.value),
    [
      "business-profile",
      "fashion-magazine",
      "cinematic-street",
      "studio-texture",
      "natural-light-lifestyle",
      "retro-film",
      "black-white-portrait",
      "outdoor-travel",
      "social-avatar",
    ],
  );
});

test("portrait planner exposes action presets with real preview images", () => {
  assert.deepEqual(
    PORTRAIT_ACTION_PRESETS.map((action) => action.value),
    [
      "standing-relaxed",
      "walking-step",
      "seated-pose",
      "leaning-wall",
      "looking-back",
      "adjusting-sleeve",
      "holding-prop",
      "turning-motion",
    ],
  );
  PORTRAIT_ACTION_PRESETS.forEach((action) => {
    assert.match(action.previewSrc, /^\.\/assets\/portrait-actions\/action-[a-z-]+\.png$/);
    assert.match(action.promptInstruction, /pose|gesture|motion|posture/i);
  });
});

test("portrait planner clamps image count from 1 to 100", () => {
  assert.equal(normalizePortraitImageCount("0"), 1);
  assert.equal(normalizePortraitImageCount("1"), 1);
  assert.equal(normalizePortraitImageCount("12"), 12);
  assert.equal(normalizePortraitImageCount("100"), 100);
  assert.equal(normalizePortraitImageCount("101"), 100);
});

test("portrait planner builds a 12 image shot matrix with professional photography terms", () => {
  const plan = buildPortraitPlan({
    subjectSummary: "adult subject, short dark hair, navy blazer",
    visibleProfile: {
      visiblePresentation: "feminine-presenting",
      heightImpression: "average",
      bodyBuild: "slim",
      clothing: "navy blazer",
      hair: "short dark hair",
    },
    imageCount: 12,
    selectedStyles: ["business-profile", "cinematic-street"],
    selectedActions: ["standing-relaxed", "walking-step"],
    customStyle: "warm gallery portrait",
    notes: "keep the expression calm and confident",
    ratio: "4:5",
    size: "1024x1280",
    format: "jpg",
  });

  assert.equal(plan.mode, "portrait");
  assert.equal(plan.imageCount, 12);
  assert.equal(plan.items.length, 12);
  assert.deepEqual(
    plan.items.slice(0, 3).map((item) => item.style),
    ["business-profile", "cinematic-street", "custom"],
  );
  assert.deepEqual(
    plan.items.slice(0, 5).map((item) => item.shotType),
    ["long-shot", "full-body", "medium-shot", "close-up", "extreme-close-up"],
  );
  assert.deepEqual(
    plan.items.slice(0, 4).map((item) => item.action),
    ["standing-relaxed", "walking-step", "standing-relaxed", "walking-step"],
  );
  assert.match(plan.items.map((item) => item.prompt).join("\n"), /portrait photography/i);
  assert.match(plan.items[0].prompt, /Action: .*relaxed standing pose/i);
  assert.match(plan.items[1].prompt, /Action: .*natural walking step/i);
  assert.match(plan.items.map((item) => item.prompt).join("\n"), /f\/1\.8|f\/2\.8|f\/4|f\/5\.6|f\/8/);
  assert.match(plan.items.map((item) => item.prompt).join("\n"), /depth of field|bokeh/i);
  assert.match(plan.items[0].prompt, /visible presentation: feminine-presenting/i);
  assert.match(plan.items[0].prompt, /Adult status unknown defaults to ordinary portrait or lifestyle styling/i);
  assert.equal(plan.ratio, "4:5");
  assert.equal(plan.size, "1024x1280");
  assert.equal(plan.format, "jpg");
  assert.deepEqual(plan.selectedActions, ["standing-relaxed", "walking-step"]);
});

test("portrait planner supports manual summary without image analysis", () => {
  const plan = buildPortraitPlan({
    subjectSummary: "person in a linen shirt, neutral expression",
    imageCount: 1,
    selectedStyles: [],
  });

  assert.equal(plan.analysisRequired, false);
  assert.equal(plan.items.length, 1);
  assert.match(plan.items[0].prompt, /person in a linen shirt/);
});

test("portrait planner rejects an empty confirmed subject summary", () => {
  assert.throws(
    () => buildPortraitPlan({ subjectSummary: "", visibleProfile: {}, imageCount: 1 }),
    /人物描述不能为空/,
  );
});

test("portrait planner applies single item prompt overrides without changing set shape", () => {
  const plan = buildPortraitPlan({
    subjectSummary: "adult subject in black coat",
    imageCount: 3,
    selectedStyles: ["retro-film"],
  });
  const overridden = applyPortraitPlanOverrides(plan, [
    { itemId: "002-full-body", prompt: "Custom full body portrait prompt" },
  ]);

  assert.equal(overridden.items.length, 3);
  assert.equal(overridden.items[1].prompt, "Custom full body portrait prompt");
  assert.notEqual(overridden.items[0].prompt, "Custom full body portrait prompt");
});

test("portrait style normalization keeps selected presets and custom style", () => {
  assert.deepEqual(
    normalizePortraitStyles({
      selectedStyles: ["business-profile", "missing", "retro-film", "business-profile"],
      customStyle: "quiet editorial window light",
    }).map((style) => style.value),
    ["business-profile", "retro-film", "custom"],
  );
});

test("portrait action normalization keeps selected presets and defaults to the full action set", () => {
  assert.deepEqual(
    normalizePortraitActions(["walking-step", "missing", "seated-pose", "walking-step"]).map((action) => action.value),
    ["walking-step", "seated-pose"],
  );
  assert.deepEqual(
    normalizePortraitActions("[]").map((action) => action.value),
    PORTRAIT_ACTION_PRESETS.map((action) => action.value),
  );
});

test("portrait planner uses only selected shot types when provided", () => {
  const plan = buildPortraitPlan({
    subjectSummary: "adult subject in a white shirt",
    imageCount: 5,
    selectedStyles: ["business-profile"],
    selectedShotTypes: ["close-up", "extreme-close-up"],
  });

  assert.deepEqual(
    plan.items.map((item) => item.shotType),
    ["close-up", "extreme-close-up", "close-up", "extreme-close-up", "close-up"],
  );
  assert.deepEqual(plan.selectedShotTypes, ["close-up", "extreme-close-up"]);
});
