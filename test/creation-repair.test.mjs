import test from "node:test";
import assert from "node:assert/strict";

import { applyCreationRepairOverrides, selectCreationRepairItems } from "../lib/creation-repair.mjs";

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
