import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCreationItemReferenceImages,
  buildCreationReferenceImageLabels,
  buildCreationStyleReferenceImageLabels,
} from "../lib/creation-reference-labels.mjs";

test("creation reference labels state uploaded count, file list, image order, and roles", () => {
  const labels = buildCreationReferenceImageLabels(
    [
      { filename: "F2J32257.png" },
      { filename: "F2J32258.png" },
      { filename: "F2J32259.png" },
      { filename: "F2J32260.png" },
    ],
    [
      {
        filename: "F2J32258.png",
        rolePromptLabel: "style reference",
        promptInstruction: "Use this for color and lighting.",
      },
      {
        filename: "F2J32257.png",
        rolePromptLabel: "product subject",
        promptInstruction: "Preserve shape and hardware.",
      },
    ],
  );

  assert.equal(labels.length, 4);
  assert.match(labels[0], /Creation reference image 1 of 4: F2J32257\.png\./);
  assert.match(labels[0], /Uploaded reference count: 4\./);
  assert.match(
    labels[0],
    /Uploaded reference files: 1\. F2J32257\.png; 2\. F2J32258\.png; 3\. F2J32259\.png; 4\. F2J32260\.png\./,
  );
  assert.match(labels[0], /Role: product subject\. Preserve shape and hardware\./);
  assert.match(labels[1], /Creation reference image 2 of 4: F2J32258\.png\./);
  assert.match(labels[1], /Role: style reference\. Use this for color and lighting\./);
});

test("creation reference labels are empty when no images are attached", () => {
  assert.deepEqual(buildCreationReferenceImageLabels([], []), []);
});

test("creation style reference labels mark uploaded images as style-only", () => {
  const labels = buildCreationStyleReferenceImageLabels([
    { filename: "warm-lighting.png" },
    { filename: "paper-texture.png" },
  ]);

  assert.equal(labels.length, 2);
  assert.match(labels[0], /Creation style reference image 1 of 2: warm-lighting\.png\./);
  assert.match(labels[0], /Style reference files: 1\. warm-lighting\.png; 2\. paper-texture\.png\./);
  assert.match(labels[0], /Use this image only for style, lighting, color grading, background mood, material treatment, composition language, and overall atmosphere\./);
  assert.match(labels[0], /Do not copy the style reference subject, product identity, logo, text, packaging, or exact layout\./);
});

test("creation style reference labels are empty when no style references are attached", () => {
  assert.deepEqual(buildCreationStyleReferenceImageLabels([]), []);
});

test("creation SKU item reference images only include the matching subject files", () => {
  const item = {
    role: "sku",
    skuSubject: {
      filenames: ["silver-lure.png"],
    },
  };
  const images = [
    { filename: "blue-lure.png" },
    { filename: "silver-lure.png" },
    { filename: "package.png" },
  ];

  assert.deepEqual(buildCreationItemReferenceImages(item, images), [
    { filename: "silver-lure.png" },
  ]);
});

test("creation non-SKU item reference images keep the full uploaded set", () => {
  const item = {
    role: "hero",
  };
  const images = [
    { filename: "blue-lure.png" },
    { filename: "silver-lure.png" },
  ];

  assert.deepEqual(buildCreationItemReferenceImages(item, images), images);
});

test("creation hero item reference images keep the primary product instead of every product variant", () => {
  const item = {
    role: "hero",
  };
  const images = [
    { filename: "blue-lure.png" },
    { filename: "silver-lure.png" },
    { filename: "package.png" },
    { filename: "lighting-style.png" },
  ];
  const roles = [
    { filename: "blue-lure.png", role: "product" },
    { filename: "silver-lure.png", role: "product" },
    { filename: "package.png", role: "package" },
    { filename: "lighting-style.png", role: "style" },
  ];

  assert.deepEqual(buildCreationItemReferenceImages(item, images, roles), [
    { filename: "blue-lure.png" },
    { filename: "lighting-style.png" },
  ]);
});

test("creation material item reference images keep primary product plus material details", () => {
  const item = {
    role: "material-closeup",
  };
  const images = [
    { filename: "blue-lure.png" },
    { filename: "silver-lure.png" },
    { filename: "scale-detail.png" },
    { filename: "package.png" },
  ];
  const roles = [
    { filename: "blue-lure.png", role: "product" },
    { filename: "silver-lure.png", role: "product" },
    { filename: "scale-detail.png", role: "material" },
    { filename: "package.png", role: "package" },
  ];

  assert.deepEqual(buildCreationItemReferenceImages(item, images, roles), [
    { filename: "blue-lure.png" },
    { filename: "scale-detail.png" },
  ]);
});

test("creation package references stay scoped to the package image role", () => {
  const images = [
    { filename: "lure-main.png" },
    { filename: "lure-alt.png" },
    { filename: "package-info.png" },
    { filename: "joint-detail.png" },
    { filename: "lake-scene.png" },
    { filename: "campaign-style.png" },
  ];
  const roles = [
    { filename: "lure-main.png", role: "product" },
    { filename: "lure-alt.png", role: "product" },
    { filename: "package-info.png", role: "package" },
    { filename: "joint-detail.png", role: "material" },
    { filename: "lake-scene.png", role: "scene" },
    { filename: "campaign-style.png", role: "style" },
  ];

  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "detail-trust" }, images, roles).map((image) => image.filename),
    ["lure-main.png", "joint-detail.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "comparison" }, images, roles).map((image) => image.filename),
    ["lure-main.png", "lure-alt.png", "joint-detail.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "promotion" }, images, roles).map((image) => image.filename),
    ["lure-main.png", "campaign-style.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "review-qa" }, images, roles).map((image) => image.filename),
    ["lure-main.png", "joint-detail.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "package" }, images, roles).map((image) => image.filename),
    ["lure-main.png", "package-info.png"],
  );
});
