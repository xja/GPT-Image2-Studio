import test from "node:test";
import assert from "node:assert/strict";

import {
  getDefaultGenerationSize,
  getGenerationSizeOptions,
  isGenerationSizeCompatible,
  normalizeGenerationSize,
} from "../lib/generation-size-options.mjs";

const EXPECTED_SIZE_OPTIONS = {
  "1:1": ["1024x1024", "1536x1536", "2048x2048", "2880x2880"],
  "5:4": ["1280x1024", "1920x1536", "2560x2048", "3200x2560"],
  "9:16": ["1008x1792", "1584x2816", "2016x3584", "2160x3840"],
  "21:9": ["2352x1008", "3696x1584"],
  "16:9": ["1792x1008", "2816x1584", "3584x2016", "3840x2160"],
  "4:3": ["1344x1008", "2048x1536", "2752x2064", "3264x2448"],
  "3:2": ["1536x1024", "2304x1536", "3072x2048", "3504x2336"],
  "4:5": ["1024x1280", "1536x1920", "2048x2560", "2560x3200"],
  "3:4": ["1008x1344", "1536x2048", "2064x2752", "2448x3264"],
  "2:3": ["1024x1536", "1536x2304", "2048x3072", "2336x3504"],
};

test("size options match the configured ratio table", () => {
  for (const [ratio, sizes] of Object.entries(EXPECTED_SIZE_OPTIONS)) {
    assert.deepEqual(getGenerationSizeOptions(ratio).map((option) => option.value), ["auto", ...sizes]);
  }
});

test("size compatibility rejects mismatched ratios", () => {
  assert.equal(isGenerationSizeCompatible("1:1", "2048x2048"), true);
  assert.equal(isGenerationSizeCompatible("1:1", "2880x2880"), true);
  assert.equal(isGenerationSizeCompatible("1:1", "2048x1152"), false);
  assert.equal(isGenerationSizeCompatible("9:16", "2016x3584"), true);
  assert.equal(isGenerationSizeCompatible("9:16", "2160x3840"), true);
  assert.equal(isGenerationSizeCompatible("9:16", "2048x1152"), false);
});

test("size options only include resolutions from the configured table", () => {
  for (const [ratio, sizes] of Object.entries(EXPECTED_SIZE_OPTIONS)) {
    for (const option of getGenerationSizeOptions(ratio)) {
      if (option.value === "auto") continue;

      const [width, height] = option.value.split("x").map(Number);
      assert.ok(Math.max(width, height) <= 3840, `${ratio} ${option.value} should not exceed 3840`);
      assert.ok(sizes.includes(option.value), `${ratio} should not include stale size ${option.value}`);
    }
  }

  assert.equal(isGenerationSizeCompatible("21:9", "4368x1872"), false);
  assert.equal(isGenerationSizeCompatible("4:5", "1280x1600"), false);
  assert.equal(isGenerationSizeCompatible("3:4", "1152x1536"), false);
});

test("default sizes use the first configured size for each ratio", () => {
  for (const [ratio, sizes] of Object.entries(EXPECTED_SIZE_OPTIONS)) {
    assert.equal(getDefaultGenerationSize(ratio), sizes[0], `${ratio} should default to the first configured size`);
  }
});

test("normalizeGenerationSize falls back to auto for invalid resolutions", () => {
  assert.equal(normalizeGenerationSize("4:5", "2048x2560"), "2048x2560");
  assert.equal(normalizeGenerationSize("4:5", "2048x2048"), "auto");
  assert.equal(getDefaultGenerationSize("3:4"), "1008x1344");
});
