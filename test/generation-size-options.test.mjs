import test from "node:test";
import assert from "node:assert/strict";

import {
  getDefaultGenerationSize,
  getGenerationSizeOptions,
  isGenerationSizeCompatible,
  normalizeGenerationSize,
} from "../lib/generation-size-options.mjs";

test("size options are filtered by ratio and capped at 2048 on the long side", () => {
  const square = getGenerationSizeOptions("1:1").map((option) => option.value);
  const portrait = getGenerationSizeOptions("4:5").map((option) => option.value);
  const widescreen = getGenerationSizeOptions("16:9").map((option) => option.value);

  assert.deepEqual(square, ["auto", "1024x1024", "1536x1536", "2048x2048"]);
  assert.deepEqual(portrait, ["auto", "1024x1280", "1280x1600", "1600x2000"]);
  assert.deepEqual(widescreen, ["auto", "1280x720", "1536x864", "2048x1152"]);
});

test("size compatibility rejects mismatched ratios", () => {
  assert.equal(isGenerationSizeCompatible("1:1", "2048x2048"), true);
  assert.equal(isGenerationSizeCompatible("1:1", "2048x1152"), false);
  assert.equal(isGenerationSizeCompatible("9:16", "1152x2048"), true);
  assert.equal(isGenerationSizeCompatible("9:16", "2048x1152"), false);
});

test("normalizeGenerationSize falls back to auto for invalid resolutions", () => {
  assert.equal(normalizeGenerationSize("4:5", "1600x2000"), "1600x2000");
  assert.equal(normalizeGenerationSize("4:5", "2048x2048"), "auto");
  assert.equal(getDefaultGenerationSize("3:4"), "1152x1536");
});
