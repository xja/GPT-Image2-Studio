import test from "node:test";
import assert from "node:assert/strict";

import {
  appendRatioHintToPrompt,
  getAspectRatioOptions,
  resolveAspectRatioOption,
} from "../lib/aspect-ratios.mjs";

test("getAspectRatioOptions exposes the supported compact ratio set", () => {
  const options = getAspectRatioOptions();

  assert.deepEqual(
    options.map((option) => option.value),
    ["1:1", "4:3", "3:4", "16:9", "9:16", "5:4", "21:9", "3:2", "4:5", "2:3"],
  );
});

test("resolveAspectRatioOption maps ratios to one megapixel base canvases", () => {
  const expectedBaseSizeByRatio = {
    "1:1": "1024x1024",
    "5:4": "1120x896",
    "9:16": "768x1365",
    "21:9": "1568x672",
    "16:9": "1365x768",
    "4:3": "1152x864",
    "3:2": "1248x832",
    "4:5": "896x1120",
    "3:4": "864x1152",
    "2:3": "832x1248",
  };

  for (const [ratio, baseSize] of Object.entries(expectedBaseSizeByRatio)) {
    assert.equal(resolveAspectRatioOption(ratio).baseSize, baseSize);
  }

  assert.equal(resolveAspectRatioOption("16:9").orientation, "landscape");
  assert.equal(resolveAspectRatioOption("2:3").orientation, "portrait");
});

test("appendRatioHintToPrompt injects a ratio composition hint without losing the original prompt", () => {
  const prompt = appendRatioHintToPrompt("生成一张直播宣传图", resolveAspectRatioOption("4:5"));

  assert.match(prompt, /生成一张直播宣传图/);
  assert.match(prompt, /构图比例要求：标准 4:5/);
});
