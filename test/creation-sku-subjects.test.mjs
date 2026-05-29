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

test("creation SKU payload falls back to current product roles when applied analysis collapses multiple subjects", () => {
  const subjects = buildCreationSkuSubjectsForPayload({
    analysis: {
      skuSubjects: [
        {
          id: "jointed-lure",
          title: "分节鱼形发光路亚假饵",
          filenames: ["blue-lure.png", "yellow-lure.png", "green-lure.png", "silver-lure.png", "detail-lure.png"],
          note: "五张商品主体被识别为同一类路亚。",
        },
      ],
    },
    applied: true,
    dirty: false,
    referenceRoles: [
      { filename: "blue-lure.png", role: "product", note: "蓝银色路亚主体。" },
      { filename: "yellow-lure.png", role: "product", note: "黄绿色路亚主体。" },
      { filename: "green-lure.png", role: "product", note: "绿色路亚主体。" },
      { filename: "package-list.png", role: "package", note: "包装清单。" },
      { filename: "silver-lure.png", role: "product", note: "银灰色路亚主体。" },
      { filename: "usage-guide.png", role: "usage", note: "充电说明。" },
      { filename: "size-card.png", role: "dimensions", note: "尺寸规格。" },
      { filename: "detail-lure.png", role: "product", note: "结构细节主体。" },
    ],
  });

  assert.deepEqual(
    subjects.map((subject) => subject.filenames[0]),
    ["blue-lure.png", "yellow-lure.png", "green-lure.png", "silver-lure.png", "detail-lure.png"],
  );
});

test("creation SKU payload uses product roles when collapsed analysis only names the first subject file", () => {
  const subjects = buildCreationSkuSubjectsForPayload({
    analysis: {
      skuSubjects: [
        {
          id: "jointed-lure",
          title: "分节鱼形发光路亚假饵",
          filenames: ["blue-lure.png"],
          note: "多张商品主体被概括成一个 SKU。",
        },
      ],
    },
    applied: true,
    dirty: false,
    referenceRoles: [
      { filename: "blue-lure.png", role: "product", note: "蓝银色路亚主体。" },
      { filename: "yellow-lure.png", role: "product", note: "黄绿色路亚主体。" },
      { filename: "green-lure.png", role: "product", note: "绿色路亚主体。" },
    ],
  });

  assert.deepEqual(
    subjects.map((subject) => subject.filenames[0]),
    ["blue-lure.png", "yellow-lure.png", "green-lure.png"],
  );
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
