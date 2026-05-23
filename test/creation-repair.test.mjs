import test from "node:test";
import assert from "node:assert/strict";

import {
  applyCreationRepairOverrides,
  buildCreationRepairPlan,
  hasCreationRepairPlanningOverride,
  hydrateCreationRepairSkuSubjects,
  refreshCreationRepairItemsFromPlan,
  selectCreationRepairItems,
} from "../lib/creation-repair.mjs";

const demoSet = {
  setId: "creation-set-demo",
  items: [
    {
      itemId: "1-hero",
      status: "completed",
      filename: "01-hero.png",
      relativePath: "2026-05/05-06/2026-05-06-creation/demo/01-hero.png",
    },
    {
      itemId: "2-benefit",
      status: "failed",
      filename: "",
      relativePath: "",
    },
    {
      itemId: "3-scene",
      status: "queued",
      filename: "",
      relativePath: "",
    },
    {
      itemId: "4-detail-trust",
      status: "completed",
      filename: "04-trust.png",
      relativePath: "2026-05/05-06/2026-05-06-creation/demo/04-trust.png",
    },
  ],
};

test("creation repair selects one requested item even if it already completed", () => {
  const items = selectCreationRepairItems(demoSet, { itemId: "1-hero" });

  assert.deepEqual(
    items.map((item) => item.itemId),
    ["1-hero"],
  );
});

test("creation repair selects failed items by default", () => {
  const items = selectCreationRepairItems(demoSet, {});

  assert.deepEqual(
    items.map((item) => item.itemId),
    ["2-benefit"],
  );
});

test("creation repair can select all incomplete or missing items", () => {
  const items = selectCreationRepairItems(demoSet, { scope: "incomplete" });

  assert.deepEqual(
    items.map((item) => item.itemId),
    ["2-benefit", "3-scene"],
  );
});

test("creation repair treats completed items without filenames as incomplete", () => {
  const items = selectCreationRepairItems(
    {
      items: [
        {
          itemId: "1-hero",
          status: "completed",
          filename: "",
          relativePath: "2026-05/05-06/2026-05-06-creation/demo/01-hero.png",
        },
      ],
    },
    { scope: "incomplete" },
  );

  assert.deepEqual(
    items.map((item) => item.itemId),
    ["1-hero"],
  );
});

test("creation repair applies non-empty prompt and copy overrides", () => {
  const item = applyCreationRepairOverrides(
    {
      itemId: "1-hero",
      prompt: "Original prompt",
      marketingCopy: "Original copy",
    },
    {
      promptOverride: "  Make the product larger and add clear usage steps.  ",
      marketingCopyOverride: "  三步冲煮  ",
    },
  );

  assert.equal(item.prompt, "Make the product larger and add clear usage steps.");
  assert.equal(item.marketingCopy, "三步冲煮");
});

test("creation repair keeps existing prompt when overrides are blank", () => {
  const item = applyCreationRepairOverrides(
    {
      itemId: "1-hero",
      prompt: "Original prompt",
      marketingCopy: "Original copy",
    },
    {
      promptOverride: "   ",
      marketingCopyOverride: "",
    },
  );

  assert.equal(item.prompt, "Original prompt");
  assert.equal(item.marketingCopy, "Original copy");
});

test("creation repair rebuilds targeted prompts when current visual language differs from stored set", () => {
  const set = {
    productName: "Jointed fishing lure",
    productDescription: "Segmented lifelike lure for bass fishing",
    sellingPoints: ["realistic swim action"],
    targetLanguage: "en",
    imageCount: 2,
    scenario: "standard",
    visualLanguage: "classic-commercial",
    industryTemplate: "general",
    selectedRoles: ["hero", "scene"],
    items: [
      {
        itemId: "2-scene",
        slotIndex: 2,
        role: "scene",
        title: "Scene image",
        prompt: "Old scene prompt with polished commercial lighting.",
        status: "failed",
      },
    ],
  };

  assert.equal(hasCreationRepairPlanningOverride(set, { visualLanguage: "warm-handcrafted" }), true);
  assert.equal(hasCreationRepairPlanningOverride(set, { visualLanguage: "classic-commercial" }), false);

  const plan = buildCreationRepairPlan(set, { visualLanguage: "warm-handcrafted" });
  const [item] = refreshCreationRepairItemsFromPlan(set.items, plan);

  assert.equal(plan.visualLanguage, "warm-handcrafted");
  assert.equal(plan.visualLanguageLabel, "手作温度");
  assert.match(item.prompt, /VISUAL LANGUAGE LOCK/);
  assert.match(item.prompt, /warm tactile handcrafted setting/);
  assert.doesNotMatch(item.prompt, /Old scene prompt/);
  assert.doesNotMatch(item.prompt, /polished commercial lighting/);
});

test("creation repair rehydrates SKU subject metadata from legacy set manifests", () => {
  const items = hydrateCreationRepairSkuSubjects(
    [
      {
        itemId: "13-sku-silver",
        slotIndex: 13,
        role: "sku",
        title: "SKU image 1",
        prompt: "Create one SKU product image for Silver lure.",
      },
      {
        itemId: "14-sku-gold",
        slotIndex: 14,
        role: "sku",
        title: "SKU image 2",
        prompt: "Create one SKU product image for Gold lure.",
      },
    ],
    {
      imageCount: 12,
      skuSubjects: [
        {
          id: "silver",
          title: "Silver lure",
          filenames: ["silver-lure.png"],
          referenceIndexes: [1],
          note: "silver body",
          bundleCount: 3,
        },
        {
          id: "gold",
          title: "Gold lure",
          filenames: ["gold-lure.png"],
          referenceIndexes: [2],
          note: "gold body",
          bundleCount: 3,
        },
      ],
    },
  );

  assert.deepEqual(
    items.map((item) => item.skuSubject?.filenames),
    [["silver-lure.png"], ["gold-lure.png"]],
  );
  assert.deepEqual(
    items.map((item) => item.skuSubject?.referenceIndexes),
    [[1], [2]],
  );
});
