import test from "node:test";
import assert from "node:assert/strict";

import {
  getCreationReferenceAnalysisRoleCorrectionReason,
  summarizeCreationReferenceAnalysisRoleCorrections,
} from "../lib/creation-reference-analysis-view.mjs";

test("creation reference analysis explains subject-unit downgrade from reference-product to product", () => {
  const reason = getCreationReferenceAnalysisRoleCorrectionReason(
    {
      filename: "orange-silver-pair.png",
      role: "reference-product",
      note: "One source image contains two complete visible lure bodies.",
    },
    2,
  );

  assert.match(reason, /reference-product/);
  assert.match(reason, /product/);
  assert.match(reason, /2 个完整产品单位/);
  assert.match(reason, /单一全套主主体锚点/);
});

test("creation reference analysis does not downgrade an explicitly selected subject anchor", () => {
  const reason = getCreationReferenceAnalysisRoleCorrectionReason(
    {
      filename: "selected-anchor.png",
      role: "reference-product",
      note: "User-selected set-wide primary subject anchor with two product views.",
    },
    2,
  );

  assert.equal(reason, "");
});

test("creation reference analysis correction summary reuses card reasons for apply copy", () => {
  const summary = summarizeCreationReferenceAnalysisRoleCorrections([
    {
      filename: "orange-silver-pair.png",
      role: "product",
      roleCorrectionReason:
        "已从 reference-product 调整为 product：识别到 2 个完整产品单位。只有用户明确指定的单一全套主主体锚点才保留 reference-product。",
    },
  ]);

  assert.match(summary, /角色纠正/);
  assert.match(summary, /reference-product 调整为 product/);
  assert.match(summary, /2 个完整产品单位/);
});
