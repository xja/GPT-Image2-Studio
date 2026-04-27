import test from "node:test";
import assert from "node:assert/strict";

import {
  getDefaultGenerationSize,
  getGenerationSizeOptions,
  isGenerationSizeCompatible,
  normalizeGenerationSize,
} from "../lib/generation-size-options.mjs";

test("size options are filtered by ratio and keep previously supported sizes intact", () => {
  const square = getGenerationSizeOptions("1:1").map((option) => option.value);
  const portrait = getGenerationSizeOptions("4:5").map((option) => option.value);
  const poster = getGenerationSizeOptions("3:4").map((option) => option.value);
  const widescreen = getGenerationSizeOptions("16:9").map((option) => option.value);
  const story = getGenerationSizeOptions("9:16").map((option) => option.value);

  assert.deepEqual(square, ["auto", "1024x1024", "1536x1536", "2048x2048", "2880x2880"]);
  assert.deepEqual(portrait, ["auto", "1024x1280", "1280x1600", "1600x2000", "1536x1920", "2048x2560", "2560x3200"]);
  assert.deepEqual(poster, ["auto", "768x1024", "1152x1536", "1536x2048", "1008x1344", "2064x2752", "2448x3264"]);
  assert.deepEqual(widescreen, ["auto", "1280x720", "1536x864", "2048x1152", "1792x1008", "2816x1584", "3584x2016", "3840x2160"]);
  assert.deepEqual(story, ["auto", "720x1280", "864x1536", "1152x2048", "1008x1792", "1584x2816", "2016x3584", "2160x3840"]);
});

test("size compatibility rejects mismatched ratios", () => {
  assert.equal(isGenerationSizeCompatible("1:1", "2048x2048"), true);
  assert.equal(isGenerationSizeCompatible("1:1", "2880x2880"), true);
  assert.equal(isGenerationSizeCompatible("1:1", "2048x1152"), false);
  assert.equal(isGenerationSizeCompatible("9:16", "2016x3584"), true);
  assert.equal(isGenerationSizeCompatible("9:16", "2160x3840"), true);
  assert.equal(isGenerationSizeCompatible("9:16", "2048x1152"), false);
});

test("normalizeGenerationSize falls back to auto for invalid resolutions", () => {
  assert.equal(normalizeGenerationSize("4:5", "2048x2560"), "2048x2560");
  assert.equal(normalizeGenerationSize("4:5", "2048x2048"), "auto");
  assert.equal(getDefaultGenerationSize("3:4"), "1152x1536");
});
