import test from "node:test";
import assert from "node:assert/strict";

import {
  getDefaultGenerationSize,
  getGenerationSizeOptions,
  isGenerationSizeCompatible,
  normalizeGenerationSize,
} from "../lib/generation-size-options.mjs";

const EXPECTED_SIZE_OPTIONS = {
  "1:1": ["1024x1024", "1536x1536", "2048x2048", "2816x2816"],
  "5:4": ["1280x1024", "1920x1536", "2560x2048", "3120x2496"],
  "9:16": ["720x1280", "864x1536", "1152x2048", "2016x3584", "2151x3824", "2160x3840"],
  "21:9": ["1680x720", "1916x821", "2688x1152", "3360x1440", "3584x1536", "3824x1639", "3832x1642", "3840x1646"],
  "16:9": ["1280x720", "1536x864", "2048x1152", "3584x2016", "3824x2151", "3840x2160"],
  "4:3": ["1024x768", "1536x1152", "2048x1536", "3072x2304"],
  "3:2": ["1536x1024", "2304x1536", "3072x2048", "3456x2304"],
  "4:5": ["1024x1280", "1536x1920", "2048x2560", "2496x3120"],
  "3:4": ["768x1024", "1536x2048", "1920x2560", "2304x3072", "2448x3264"],
  "2:3": ["1024x1536", "1536x2304", "2048x3072", "2304x3456"],
};

const KNOWN_ROUNDED_SIZE_OPTIONS = new Set([
  "9:16 2151x3824",
  "21:9 1916x821",
  "21:9 3824x1639",
  "21:9 3832x1642",
  "21:9 3840x1646",
  "16:9 3824x2151",
]);
const MAX_IMAGE_PIXELS = 8_294_400;

test("size options match the configured ratio table", () => {
  for (const [ratio, sizes] of Object.entries(EXPECTED_SIZE_OPTIONS)) {
    assert.deepEqual(getGenerationSizeOptions(ratio).map((option) => option.value), ["auto", ...sizes]);
  }
});

test("each configured ratio includes a resolution with one 1536px edge", () => {
  for (const ratio of Object.keys(EXPECTED_SIZE_OPTIONS)) {
    const sizes = getGenerationSizeOptions(ratio)
      .map((option) => option.value)
      .filter((value) => value !== "auto");

    assert.ok(
      sizes.some((size) => size.split("x").map(Number).includes(1536)),
      `${ratio} should include a resolution with one 1536px edge`,
    );
  }
});

test("size compatibility rejects mismatched ratios", () => {
  assert.equal(isGenerationSizeCompatible("1:1", "2048x2048"), true);
  assert.equal(isGenerationSizeCompatible("1:1", "2816x2816"), true);
  assert.equal(isGenerationSizeCompatible("1:1", "2048x1152"), false);
  assert.equal(isGenerationSizeCompatible("9:16", "1152x2048"), true);
  assert.equal(isGenerationSizeCompatible("9:16", "2016x3584"), true);
  assert.equal(isGenerationSizeCompatible("9:16", "2151x3824"), true);
  assert.equal(isGenerationSizeCompatible("9:16", "2160x3840"), true);
  assert.equal(isGenerationSizeCompatible("9:16", "2048x1152"), false);
});

test("size compatibility excludes gpt-image-2 resolutions whose edges are not multiples of 16", () => {
  assert.equal(isGenerationSizeCompatible("9:16", "1080x1920"), false);
  assert.equal(isGenerationSizeCompatible("21:9", "2520x1080"), false);
  assert.equal(isGenerationSizeCompatible("16:9", "1920x1080"), false);
});

test("size compatibility keeps reported high-resolution ratio matches available", () => {
  assert.equal(isGenerationSizeCompatible("5:4", "3120x2496"), true);
  assert.equal(isGenerationSizeCompatible("5:4", "2560x2048"), true);
  assert.equal(isGenerationSizeCompatible("5:4", "1920x1536"), true);
  assert.equal(isGenerationSizeCompatible("21:9", "1916x821"), true);
  assert.equal(isGenerationSizeCompatible("21:9", "3360x1440"), true);
  assert.equal(isGenerationSizeCompatible("21:9", "3824x1639"), true);
  assert.equal(isGenerationSizeCompatible("21:9", "3832x1642"), true);
  assert.equal(isGenerationSizeCompatible("21:9", "3840x1646"), true);
  assert.equal(isGenerationSizeCompatible("16:9", "3824x2151"), true);
  assert.equal(isGenerationSizeCompatible("16:9", "3840x2160"), true);
  assert.equal(isGenerationSizeCompatible("4:3", "3072x2304"), true);
  assert.equal(isGenerationSizeCompatible("3:2", "3456x2304"), true);
});

test("requested 3:2 and 2:3 resolutions stay available", () => {
  assert.equal(isGenerationSizeCompatible("3:2", "1536x1024"), true);
  assert.equal(isGenerationSizeCompatible("3:2", "3072x2048"), true);
  assert.equal(isGenerationSizeCompatible("2:3", "1024x1536"), true);
  assert.equal(isGenerationSizeCompatible("2:3", "2048x3072"), true);
});

test("3:4 keeps the 3072 longest-edge resolution available", () => {
  assert.equal(isGenerationSizeCompatible("3:4", "2304x3072"), true);
});

test("size options only include resolutions from the configured table", () => {
  for (const [ratio, sizes] of Object.entries(EXPECTED_SIZE_OPTIONS)) {
    for (const option of getGenerationSizeOptions(ratio)) {
      if (option.value === "auto") continue;

      const [width, height] = option.value.split("x").map(Number);
      assert.ok(Math.max(width, height) <= 3840, `${ratio} ${option.value} should not exceed 3840`);
      assert.ok(width * height <= MAX_IMAGE_PIXELS, `${ratio} ${option.value} should not exceed ${MAX_IMAGE_PIXELS} pixels`);
      assert.ok(sizes.includes(option.value), `${ratio} should not include stale size ${option.value}`);
    }
  }

  assert.equal(isGenerationSizeCompatible("9:16", "1008x1792"), false);
  assert.equal(isGenerationSizeCompatible("21:9", "2352x1008"), false);
  assert.equal(isGenerationSizeCompatible("4:5", "1280x1600"), false);
  assert.equal(isGenerationSizeCompatible("3:4", "1008x1344"), false);
});

test("size options include only maximum-edge additions that stay within the pixel cap", () => {
  for (const [ratio, sizes] of Object.entries(EXPECTED_SIZE_OPTIONS)) {
    for (const size of sizes) {
      const [width, height] = size.split("x").map(Number);
      assert.ok(width * height <= MAX_IMAGE_PIXELS, `${ratio} ${size} should not exceed ${MAX_IMAGE_PIXELS} pixels`);
    }
  }

  assert.equal(isGenerationSizeCompatible("9:16", "2151x3824"), true);
  assert.equal(isGenerationSizeCompatible("9:16", "2160x3840"), true);
  assert.equal(isGenerationSizeCompatible("21:9", "3824x1639"), true);
  assert.equal(isGenerationSizeCompatible("21:9", "3840x1646"), true);
  assert.equal(isGenerationSizeCompatible("16:9", "3824x2151"), true);
  assert.equal(isGenerationSizeCompatible("16:9", "3840x2160"), true);
  assert.equal(isGenerationSizeCompatible("1:1", "2880x2880"), false);
  assert.equal(isGenerationSizeCompatible("5:4", "3200x2560"), false);
  assert.equal(isGenerationSizeCompatible("4:5", "2560x3200"), false);
});

test("size options preserve ratio and stay within the configured edge cap", () => {
  const ratioParts = {
    "1:1": [1, 1],
    "5:4": [5, 4],
    "9:16": [9, 16],
    "21:9": [7, 3],
    "16:9": [16, 9],
    "4:3": [4, 3],
    "3:2": [3, 2],
    "4:5": [4, 5],
    "3:4": [3, 4],
    "2:3": [2, 3],
  };

  for (const [ratio, sizes] of Object.entries(EXPECTED_SIZE_OPTIONS)) {
    const [ratioWidth, ratioHeight] = ratioParts[ratio];

    for (const size of sizes) {
      const [width, height] = size.split("x").map(Number);
      const sizeKey = `${ratio} ${size}`;
      const ratioDelta = Math.abs(width * ratioHeight - height * ratioWidth);
      const maxRatioDelta = KNOWN_ROUNDED_SIZE_OPTIONS.has(sizeKey) ? ratioWidth : 0;
      assert.ok(ratioDelta <= maxRatioDelta, `${sizeKey} should keep the ratio within configured rounding`);
      if (!KNOWN_ROUNDED_SIZE_OPTIONS.has(sizeKey)) {
        assert.equal(width % 16, 0, `${sizeKey} width should be divisible by 16`);
        assert.equal(height % 16, 0, `${sizeKey} height should be divisible by 16`);
      }
      assert.ok(Math.max(width, height) <= 3840, `${ratio} ${size} longest edge should not exceed 3840`);
      assert.ok(width * height <= MAX_IMAGE_PIXELS, `${ratio} ${size} should not exceed ${MAX_IMAGE_PIXELS} pixels`);
    }
  }
});

test("default sizes use the first configured size for each ratio", () => {
  for (const [ratio, sizes] of Object.entries(EXPECTED_SIZE_OPTIONS)) {
    assert.equal(getDefaultGenerationSize(ratio), sizes[0], `${ratio} should default to the first configured size`);
  }
});

test("normalizeGenerationSize falls back to auto for invalid resolutions", () => {
  assert.equal(normalizeGenerationSize("4:5", "2048x2560"), "2048x2560");
  assert.equal(normalizeGenerationSize("4:5", "2048x2048"), "auto");
  assert.equal(getDefaultGenerationSize("3:4"), "768x1024");
});
