import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGalleryMetadataCacheEntry,
  collectGalleryMetadataRepairPatch,
  mergeGalleryItemWithCachedMetadata,
  pruneGalleryMetadataCache,
} from "../lib/gallery-metadata-recovery.mjs";

test("gallery metadata recovery stores only meaningful metadata fields in cache entries", () => {
  const entry = buildGalleryMetadataCacheEntry({
    filename: "sample.jpeg",
    prompt: "直播带货主视觉",
    responsesModel: "gpt-5.4",
    imageModel: "gpt-image-2",
    ratio: "4:5",
    ratioLabel: "标准 4:5",
    size: "1024x1536",
    quality: "high",
    format: "jpeg",
    reasoningEffort: "xhigh",
    referenceImageNames: [],
    referenceImageName: "",
    hasReferenceImage: false,
    baseUrl: "",
  });

  assert.deepEqual(entry, {
    prompt: "直播带货主视觉",
    responsesModel: "gpt-5.4",
    imageModel: "gpt-image-2",
    ratio: "4:5",
    ratioLabel: "标准 4:5",
    size: "1024x1536",
    quality: "high",
    format: "jpeg",
    reasoningEffort: "xhigh",
  });
});

test("gallery metadata recovery fills missing server fields from local cache without overriding non-empty values", () => {
  const serverItem = {
    filename: "sample.jpeg",
    prompt: "",
    responsesModel: "",
    imageModel: "",
    ratio: "",
    ratioLabel: "",
    size: "1024x1536",
    quality: "",
    format: "jpeg",
    reasoningEffort: "",
    referenceImageNames: [],
    referenceImageName: "",
    hasReferenceImage: false,
    baseUrl: "",
  };
  const cachedEntry = {
    prompt: "直播带货主视觉",
    responsesModel: "gpt-5.4",
    imageModel: "gpt-image-2",
    ratio: "4:5",
    ratioLabel: "标准 4:5",
    size: "1536x1024",
    quality: "high",
    reasoningEffort: "xhigh",
    referenceImageNames: ["reference-a.png"],
    referenceImageName: "reference-a.png",
    hasReferenceImage: true,
    baseUrl: "https://api.openai.com/v1",
  };

  const merged = mergeGalleryItemWithCachedMetadata(serverItem, cachedEntry);

  assert.equal(merged.prompt, "直播带货主视觉");
  assert.equal(merged.responsesModel, "gpt-5.4");
  assert.equal(merged.imageModel, "gpt-image-2");
  assert.equal(merged.ratio, "4:5");
  assert.equal(merged.ratioLabel, "标准 4:5");
  assert.equal(merged.size, "1024x1536");
  assert.equal(merged.quality, "high");
  assert.equal(merged.reasoningEffort, "xhigh");
  assert.equal(merged.referenceImageName, "reference-a.png");
  assert.deepEqual(merged.referenceImageNames, ["reference-a.png"]);
  assert.equal(merged.hasReferenceImage, true);
  assert.equal(merged.baseUrl, "https://api.openai.com/v1");
});

test("gallery metadata recovery only requests repair fields that are missing on the server item", () => {
  const serverItem = {
    filename: "sample.jpeg",
    prompt: "",
    responsesModel: "",
    imageModel: "",
    ratio: "",
    ratioLabel: "",
    size: "1024x1536",
    quality: "",
    format: "jpeg",
    reasoningEffort: "",
    referenceImageNames: [],
    referenceImageName: "",
    hasReferenceImage: false,
    baseUrl: "",
  };
  const mergedItem = {
    ...serverItem,
    prompt: "直播带货主视觉",
    responsesModel: "gpt-5.4",
    imageModel: "gpt-image-2",
    ratio: "4:5",
    ratioLabel: "标准 4:5",
    quality: "high",
    reasoningEffort: "xhigh",
    referenceImageNames: ["reference-a.png"],
    referenceImageName: "reference-a.png",
    hasReferenceImage: true,
    baseUrl: "https://api.openai.com/v1",
  };

  const patch = collectGalleryMetadataRepairPatch(serverItem, mergedItem);

  assert.deepEqual(patch, {
    prompt: "直播带货主视觉",
    baseUrl: "https://api.openai.com/v1",
    responsesModel: "gpt-5.4",
    imageModel: "gpt-image-2",
    hasReferenceImage: true,
    referenceImageNames: ["reference-a.png"],
    referenceImageName: "reference-a.png",
    ratio: "4:5",
    ratioLabel: "标准 4:5",
    quality: "high",
    reasoningEffort: "xhigh",
  });
});

test("gallery metadata recovery prunes cache entries that no longer exist in the gallery", () => {
  const pruned = pruneGalleryMetadataCache(
    {
      "keep-a.jpeg": { prompt: "A" },
      "drop-b.jpeg": { prompt: "B" },
      "keep-c.jpeg": { prompt: "C" },
    },
    [{ filename: "keep-a.jpeg" }, { filename: "keep-c.jpeg" }],
  );

  assert.deepEqual(pruned, {
    "keep-a.jpeg": { prompt: "A" },
    "keep-c.jpeg": { prompt: "C" },
  });
});
