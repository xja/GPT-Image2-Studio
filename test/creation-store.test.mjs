import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildCreationRelativeDir,
  createCreationSetStore,
  normalizeCreationSetManifest,
} from "../lib/creation-store.mjs";
import { buildCreationItemReferenceImages } from "../lib/creation-reference-labels.mjs";

test("creation store builds dated creation directories beside image and ppt folders", () => {
  assert.equal(
    buildCreationRelativeDir({
      createdAt: new Date(2026, 4, 5, 9, 8, 7),
      productName: "AeroPress Clear",
      setId: "creation-set-abc12345",
    }),
    "2026-05/05-05/2026-05-05-creation/0908-AeroPressClear-abc12345",
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
      visualLanguage: "premium-studio",
      visualLanguageLabel: "高端棚拍",
      industryTemplate: "food",
      industryTemplateLabel: "食品饮料",
      industryTemplatePath: "食品生鲜 > 休闲食品 > 坚果炒货 > 混合坚果",
      dimensionSpecs: "高 14.5 cm\n容量 350 ml",
      dimensionUnitMode: "both",
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
  assert.equal(manifest.visualLanguage, "premium-studio");
  assert.equal(manifest.visualLanguageLabel, "高端棚拍");
  assert.equal(manifest.industryTemplate, "food");
  assert.equal(manifest.industryTemplateLabel, "食品饮料");
  assert.equal(manifest.industryTemplatePath, "食品生鲜 > 休闲食品 > 坚果炒货 > 混合坚果");
  assert.equal(manifest.dimensionSpecs, "高 14.5 cm\n容量 350 ml");
  assert.equal(manifest.dimensionUnitMode, "both");
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

test("creation store falls back legacy set manifests to classic commercial visual language", () => {
  const manifest = normalizeCreationSetManifest(
    {
      setId: "creation-set-legacy",
      productName: "Legacy product",
      createdAt: "2026-05-05T09:00:00.000Z",
      status: "completed",
      items: [],
    },
    { publicBasePath: "/output" },
  );

  assert.equal(manifest.visualLanguage, "classic-commercial");
  assert.equal(manifest.visualLanguageLabel, "经典商业摄影");
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

test("creation store preserves optional logo metadata for creation set detail display", async () => {
  const logo = {
    enabled: true,
    filename: "ALURES.png",
    placement: "top-left",
    placementLabel: "左上",
    promptPosition: "top-left corner",
    background: "transparent",
    backgroundLabel: "透明底，直接放置",
    backgroundInstruction: "Treat the supplied reference as a transparent logo and place the transparent logo directly.",
  };
  const manifest = normalizeCreationSetManifest(
    {
      setId: "creation-set-logo",
      productName: "Fishing lure",
      createdAt: "2026-05-05T09:00:00.000Z",
      status: "generating",
      logo,
      items: [],
    },
    { publicBasePath: "/output" },
  );

  assert.deepEqual(manifest.logo, logo);

  const outputDir = await mkdtemp(join(tmpdir(), "creation-store-logo-"));
  const store = createCreationSetStore({ outputDir, publicBasePath: "/output" });
  const saved = await store.saveManifest(manifest);
  const raw = await readFile(store.manifestPath("creation-set-logo"), "utf8");

  assert.deepEqual(saved.logo, logo);
  assert.deepEqual(JSON.parse(raw).logo, logo);
});

test("creation store preserves listing drafts on manifest updates", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "creation-listing-store-"));
  const store = createCreationSetStore({ outputDir: rootDir });

  const saved = await store.saveManifest({
    setId: "creation-set-listing",
    productName: "Fishing Lure",
    listingDrafts: [
      {
        id: "listing-blue",
        skuSubjectId: "blue",
        evidenceMode: "input-only",
        title: "2 Pack 3.5 in Blue Fishing Lures for Bass",
        sellingPoints: ["Bright color for visibility"],
        painPoints: ["Hard to track bait in stained water"],
        fiveBullets: ["2 Pack 3.5 in profile for compact tackle boxes."],
        description: "Blue fishing lure listing draft.",
        backendSearchTerms: "blue fishing lure bass bait",
      },
    ],
  });

  assert.equal(saved.listingDrafts.length, 1);
  assert.equal(saved.listingDrafts[0].marketplace, "amazon-us");

  const read = await store.readManifest("creation-set-listing");
  assert.equal(read.listingDrafts[0].title, "2 Pack 3.5 in Blue Fishing Lures for Bass");

  await store.saveManifest({
    setId: "creation-set-listing",
    productName: "Updated Fishing Lure",
    status: "completed",
    items: [
      {
        itemId: "1-hero",
        slotIndex: 1,
        role: "hero",
        title: "Hero image",
        relativePath: "2026-05/05-05/2026-05-05-creation/listing/01-hero.png",
      },
    ],
  });

  const updated = await store.readManifest("creation-set-listing");
  assert.equal(updated.productName, "Updated Fishing Lure");
  assert.equal(updated.status, "completed");
  assert.equal(updated.items.length, 1);
  assert.equal(updated.listingDrafts.length, 1);
  assert.equal(updated.listingDrafts[0].id, "listing-blue");

  await store.saveManifest({
    setId: "creation-set-listing",
    productName: "Updated Fishing Lure",
    listingDrafts: [],
  });

  const cleared = await store.readManifest("creation-set-listing");
  assert.equal(cleared.listingDrafts.length, 0);

  await rm(rootDir, { recursive: true, force: true });
});

test("creation store preserves SKU subject metadata for repair reference binding", () => {
  const manifest = normalizeCreationSetManifest(
    {
      setId: "creation-set-sku",
      productName: "Jointed fishing lure",
      referenceImageNames: ["yellow-lure.png", "silver-lure.png", "package.png"],
      referenceImageRoles: [
        { filename: "yellow-lure.png", role: "product", note: "yellow SKU" },
        { filename: "silver-lure.png", role: "product", note: "silver SKU" },
        { filename: "package.png", role: "package", note: "retail package" },
      ],
      skuSubjects: [
        {
          id: "silver",
          title: "Silver lure",
          filenames: ["silver-lure.png"],
          referenceIndexes: [2],
          note: "preserve the silver finish and body segments",
          bundleCount: 3,
        },
      ],
      items: [
        {
          itemId: "13-sku-silver",
          slotIndex: 13,
          role: "sku",
          title: "SKU image 1",
          prompt: "Create one SKU product image for the distinct sellable subject: Silver lure.",
          skuSubject: {
            id: "silver",
            title: "Silver lure",
            filenames: ["silver-lure.png"],
            referenceIndexes: [2],
            note: "preserve the silver finish and body segments",
            bundleCount: 3,
          },
          status: "failed",
        },
      ],
    },
    { publicBasePath: "/output" },
  );

  assert.deepEqual(manifest.items[0].skuSubject, manifest.skuSubjects[0]);
  assert.deepEqual(
    buildCreationItemReferenceImages(
      manifest.items[0],
      [
        { filename: "yellow-lure.png" },
        { filename: "silver-lure.png" },
        { filename: "package.png" },
      ],
      manifest.referenceImageRoles,
    ),
    [{ filename: "silver-lure.png" }],
  );
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
