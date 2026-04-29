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

test("resolveAspectRatioOption maps portrait and landscape ratios to supported base canvases", () => {
  assert.equal(resolveAspectRatioOption("21:9").baseSize, "1680x720");
  assert.equal(resolveAspectRatioOption("16:9").orientation, "landscape");
  assert.equal(resolveAspectRatioOption("4:5").baseSize, "1024x1280");
  assert.equal(resolveAspectRatioOption("2:3").orientation, "portrait");
  assert.equal(resolveAspectRatioOption("1:1").baseSize, "1024x1024");
});

test("appendRatioHintToPrompt injects a ratio composition hint without losing the original prompt", () => {
  const prompt = appendRatioHintToPrompt("生成一张直播宣传图", resolveAspectRatioOption("4:5"));

  assert.match(prompt, /生成一张直播宣传图/);
  assert.match(prompt, /构图比例要求：标准 4:5/);
});
