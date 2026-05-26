import test from "node:test";
import assert from "node:assert/strict";

import { buildCreationSkuSubjectsForPayload } from "../lib/creation-sku-subjects.mjs";

test("creation SKU payload excludes applied analysis subjects backed only by dimension references", () => {
  const subjects = buildCreationSkuSubjectsForPayload({
    analysis: {
      skuSubjects: [
        {
          id: "lure-size-card",
          title: "尺寸规格图",
          filenames: ["lure-size-card.png"],
          note: "长度 130mm、重量 35g。",
        },
      ],
    },
    applied: true,
    dirty: false,
    referenceRoles: [
      {
        filename: "lure-size-card.png",
        role: "dimensions",
        note: "尺寸规格信息。",
      },
    ],
  });

  assert.deepEqual(subjects, []);
});

test("creation SKU payload keeps product subjects that include size facts", () => {
  const subjects = buildCreationSkuSubjectsForPayload({
    analysis: {
      skuSubjects: [
        {
          id: "hero-product",
          title: "红色路亚主体",
          filenames: ["hero-product.png"],
          note: "红色外观，长度 130mm、重量 35g。",
        },
      ],
    },
    applied: true,
    dirty: false,
    referenceRoles: [
      {
        filename: "hero-product.png",
        role: "product",
        note: "商品正面主体，保留红色外观和结构，同时参考长度 130mm、重量 35g。",
      },
    ],
  });

  assert.deepEqual(subjects.map((subject) => subject.id), ["hero-product"]);
});

test("creation SKU payload fallback keeps original reference filenames as subject titles", () => {
  const subjects = buildCreationSkuSubjectsForPayload({
    referenceRoles: [
      {
        filename: "blue-silver-lure.png",
        role: "product",
        note: "Blue silver lure SKU subject.",
      },
    ],
  });

  assert.deepEqual(subjects, [
    {
      id: "blue-silver-lure.png",
      title: "blue-silver-lure.png",
      referenceIndexes: [1],
      filenames: ["blue-silver-lure.png"],
      note: "Blue silver lure SKU subject.",
    },
  ]);
});
