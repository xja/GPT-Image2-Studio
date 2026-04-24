import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  deleteGeneratedAsset,
  listGalleryItems,
  saveGeneratedAsset,
} from "../lib/gallery-store.mjs";

test("gallery store keeps output directory image-only while preserving indexed metadata", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-gallery-"));
  const outputDir = join(rootDir, "output");
  const indexPath = join(rootDir, ".local", "gallery-index.json");
  await mkdir(outputDir, { recursive: true });

  await saveGeneratedAsset({
    outputDir,
    indexPath,
    filename: "older.jpeg",
    imageBuffer: Buffer.from("older-image"),
    metadata: {
      prompt: "older prompt",
      createdAt: "2026-04-22T10:00:00.000Z",
      baseUrl: "https://api.asxs.top/v1",
      responsesModel: "gpt-5.4",
      imageModel: "gpt-image-2",
      size: "1024x1536",
      quality: "high",
      format: "jpeg",
      hasReferenceImage: false,
      ratio: "4:5",
      ratioLabel: "标准 4:5",
      reasoningEffort: "high",
    },
  });

  const saved = await saveGeneratedAsset({
    outputDir,
    indexPath,
    filename: "newer.png",
    imageBuffer: Buffer.from("newer-image"),
    metadata: {
      prompt: "newer prompt",
      createdAt: "2026-04-22T12:00:00.000Z",
      baseUrl: "https://api.asxs.top/v1",
      responsesModel: "gpt-5.4",
      imageModel: "gpt-image-2",
      size: "1536x1024",
      quality: "medium",
      format: "png",
      hasReferenceImage: true,
      referenceImageNames: ["reference-a.png", "reference-b.png"],
      referenceImageName: "reference-a.png",
      ratio: "16:9",
      ratioLabel: "宽屏 16:9",
      reasoningEffort: "medium",
    },
  });

  const items = await listGalleryItems({
    outputDir,
    indexPath,
    publicBasePath: "/output",
  });
  const outputEntries = await readdir(outputDir, { withFileTypes: true });
  const datedEntries = await readdir(join(outputDir, "2026-04-22"));

  assert.equal(saved.filename, "newer.png");
  assert.deepEqual(outputEntries.map((entry) => entry.name).sort(), ["2026-04-22"]);
  assert.equal(outputEntries[0].isDirectory(), true);
  assert.deepEqual(datedEntries.sort(), ["newer.png", "older.jpeg"]);
  assert.equal(items.length, 2);
  assert.equal(items[0].filename, "newer.png");
  assert.equal(items[0].prompt, "newer prompt");
  assert.match(items[0].thumbnailUrl, /^\/output\/2026-04-22\/newer\.png\?/);
  assert.equal(items[0].hasReferenceImage, true);
  assert.deepEqual(items[0].referenceImageNames, ["reference-a.png", "reference-b.png"]);
  assert.equal(items[0].absolutePath, join(outputDir, "2026-04-22", "newer.png"));
  assert.equal(items[0].imageUrl, items[0].thumbnailUrl);
  assert.equal(items[0].baseUrl, "https://api.asxs.top/v1");
  assert.equal(items[0].responsesModel, "gpt-5.4");
  assert.equal(items[0].imageModel, "gpt-image-2");
  assert.equal(items[0].quality, "medium");
  assert.equal(items[0].ratio, "16:9");
  assert.equal(items[0].ratioLabel, "宽屏 16:9");
  assert.equal(items[0].referenceImageName, "reference-a.png");
  assert.equal(items[0].reasoningEffort, "medium");
  assert.equal(items[1].filename, "older.jpeg");
});

test("gallery store deletes the image file and removes the indexed metadata entry", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-gallery-"));
  const outputDir = join(rootDir, "output");
  const indexPath = join(rootDir, ".local", "gallery-index.json");

  await saveGeneratedAsset({
    outputDir,
    indexPath,
    filename: "deletable.jpeg",
    imageBuffer: Buffer.from("image"),
    metadata: {
      prompt: "delete me",
      createdAt: "2026-04-22T12:30:00.000Z",
      format: "jpeg",
    },
  });

  const deleted = await deleteGeneratedAsset({
    outputDir,
    indexPath,
    filename: "deletable.jpeg",
  });

  const items = await listGalleryItems({
    outputDir,
    indexPath,
  });

  assert.equal(deleted.filename, "deletable.jpeg");
  await assert.rejects(access(join(outputDir, "2026-04-22", "deletable.jpeg")));
  assert.equal(items.length, 0);
});
