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
    ["1:1", "5:4", "9:16", "21:9", "16:9", "4:3", "3:2", "4:5", "3:4", "2:3"],
  );
});

test("resolveAspectRatioOption maps portrait and landscape ratios to supported base canvases", () => {
  assert.equal(resolveAspectRatioOption("21:9").baseSize, "1680x720");
  assert.equal(resolveAspectRatioOption("16:9").orientation, "landscape");
  assert.equal(resolveAspectRatioOption("4:5").baseSize, "1280x1600");
  assert.equal(resolveAspectRatioOption("2:3").orientation, "portrait");
  assert.equal(resolveAspectRatioOption("1:1").baseSize, "1536x1536");
});

test("appendRatioHintToPrompt injects a ratio composition hint without losing the original prompt", () => {
  const prompt = appendRatioHintToPrompt("生成一张直播宣传图", resolveAspectRatioOption("4:5"));

  assert.match(prompt, /生成一张直播宣传图/);
  assert.match(prompt, /构图比例要求：标准 4:5/);
});
