import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildCreationRelativeDir,
  createCreationSetStore,
  normalizeCreationSetManifest,
} from "../lib/creation-store.mjs";

test("creation store builds dated creation directories beside image and ppt folders", () => {
  assert.equal(
    buildCreationRelativeDir({
      createdAt: "2026-05-05T09:08:07.000Z",
      productName: "AeroPress Clear",
      setId: "creation-set-abc12345",
    }),
    "2026-05/05-05/2026-05-05-creation/AeroPressClear-abc12345",
  );
});

test("creation store normalizes set manifests with output URLs and item ordering", () => {
  const manifest = normalizeCreationSetManifest(
    {
      setId: "creation-set-demo",
      productName: "云感防晒衣",
      targetLanguage: "zh-CN",
      createdAt: "2026-05-05T09:00:00.000Z",
      status: "completed",
      items: [
        {
          itemId: "2-benefit",
          slotIndex: 2,
          role: "benefit",
          title: "卖点图",
          relativePath: "2026-05/05-05/2026-05-05-creation/demo/02-benefit.png",
        },
        {
          itemId: "1-hero",
          slotIndex: 1,
          role: "hero",
          title: "主图",
          relativePath: "2026-05/05-05/2026-05-05-creation/demo/01-hero.png",
        },
      ],
    },
    { publicBasePath: "/output" },
  );

  assert.deepEqual(
    manifest.items.map((item) => item.itemId),
    ["1-hero", "2-benefit"],
  );
  assert.equal(
    manifest.items[0].imageUrl,
    "/output/2026-05/05-05/2026-05-05-creation/demo/01-hero.png",
  );
});

test("creation store preserves scenario image count and reference image metadata", () => {
  const manifest = normalizeCreationSetManifest(
    {
      setId: "creation-set-demo",
      productName: "AeroPress Clear",
      scenario: "social-seeding",
      scenarioLabel: "社媒种草",
      industryTemplate: "food",
      industryTemplateLabel: "食品饮料",
      imageCount: 6,
      selectedRoles: ["hero", "benefit", "comparison"],
      referenceImageNames: ["product-front.png", "package.png"],
      referenceImageRoles: [
        { filename: "product-front.png", role: "product", roleLabel: "商品主体" },
        { filename: "package.png", role: "package", roleLabel: "包装清单" },
      ],
      createdAt: "2026-05-05T09:00:00.000Z",
      status: "generating",
      items: [],
    },
    { publicBasePath: "/output" },
  );

  assert.equal(manifest.scenario, "social-seeding");
  assert.equal(manifest.scenarioLabel, "社媒种草");
  assert.equal(manifest.industryTemplate, "food");
  assert.equal(manifest.industryTemplateLabel, "食品饮料");
  assert.equal(manifest.imageCount, 6);
  assert.deepEqual(manifest.selectedRoles, ["hero", "benefit", "comparison"]);
  assert.deepEqual(manifest.referenceImageNames, ["product-front.png", "package.png"]);
  assert.deepEqual(
    manifest.referenceImageRoles.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [
      ["product-front.png", "product", "商品主体"],
      ["package.png", "package", "包装清单"],
    ],
  );
});

test("creation store preserves item generation telemetry", () => {
  const manifest = normalizeCreationSetManifest(
    {
      setId: "creation-set-demo",
      createdAt: "2026-05-05T09:00:00.000Z",
      status: "completed",
      items: [
        {
          itemId: "1-hero",
          slotIndex: 1,
          status: "completed",
          filename: "01-hero.jpg",
          relativePath: "2026-05/05-05/2026-05-05-creation/demo/01-hero.jpg",
          generationStartedAt: "2026-05-05T09:00:01.000Z",
          generationCompletedAt: "2026-05-05T09:00:31.000Z",
          generationDurationMs: 30000,
          size: "1024x1024",
          format: "jpg",
        },
      ],
    },
    { publicBasePath: "/output" },
  );

  assert.equal(manifest.items[0].generationStartedAt, "2026-05-05T09:00:01.000Z");
  assert.equal(manifest.items[0].generationCompletedAt, "2026-05-05T09:00:31.000Z");
  assert.equal(manifest.items[0].generationDurationMs, 30000);
  assert.equal(manifest.items[0].size, "1024x1024");
  assert.equal(manifest.items[0].format, "jpg");
});

test("creation set store writes and lists manifests newest first", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "creation-store-"));
  const store = createCreationSetStore({ outputDir, publicBasePath: "/output" });

  await store.saveManifest({
    setId: "creation-set-old",
    productName: "旧商品",
    targetLanguage: "zh-CN",
    createdAt: "2026-05-04T10:00:00.000Z",
    status: "completed",
    items: [],
  });
  await store.saveManifest({
    setId: "creation-set-new",
    productName: "新商品",
    targetLanguage: "en",
    createdAt: "2026-05-05T10:00:00.000Z",
    status: "partial_failed",
    items: [
      {
        itemId: "1-hero",
        slotIndex: 1,
        role: "hero",
        title: "主图",
        relativePath: "2026-05/05-05/2026-05-05-creation/new/01-hero.png",
      },
    ],
  });

  const manifests = await store.listManifests();
  const raw = await readFile(store.manifestPath("creation-set-new"), "utf8");

  assert.deepEqual(
    manifests.map((manifest) => manifest.setId),
    ["creation-set-new", "creation-set-old"],
  );
  assert.equal(manifests[0].status, "partial_failed");
  assert.equal(manifests[0].items[0].thumbnailUrl, manifests[0].items[0].imageUrl);
  assert.match(raw, /"setId": "creation-set-new"/);
});
