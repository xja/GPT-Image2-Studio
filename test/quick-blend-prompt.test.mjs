import test from "node:test";
import assert from "node:assert/strict";

import {
  QUICK_BLEND_ASSET_KIND,
  QUICK_BLEND_METADATA_FIELDS,
  QUICK_BLEND_MODE,
  QUICK_BLEND_REFERENCE_LABELS,
  buildQuickBlendFilenameToken,
  buildQuickBlendPrompt,
  normalizeQuickBlendPairIndex,
} from "../lib/quick-blend-prompt.mjs";

test("quick blend helper defines mode, asset kind, labels, and metadata fields", () => {
  assert.equal(QUICK_BLEND_MODE, "quick-blend");
  assert.equal(QUICK_BLEND_ASSET_KIND, "quick-blend");
  assert.deepEqual(QUICK_BLEND_METADATA_FIELDS, [
    "quickBlendPairIndex",
    "quickBlendAImageName",
    "quickBlendBImageName",
  ]);
  assert.equal(QUICK_BLEND_REFERENCE_LABELS.length, 2);
  assert.match(QUICK_BLEND_REFERENCE_LABELS[0], /Reference image 1: A image/i);
  assert.match(QUICK_BLEND_REFERENCE_LABELS[1], /Reference image 2: B image/i);
});

test("quick blend prompt extracts visible subjects and stacks A above B", () => {
  const result = buildQuickBlendPrompt({
    pairIndex: "2",
    aImageName: "A dress.png",
    bImageName: "B shoe.png",
  });

  assert.equal(result.pairIndex, "2");
  assert.equal(result.aImageName, "A dress.png");
  assert.equal(result.bImageName, "B shoe.png");
  assert.match(result.prompt, /first reference image as A/i);
  assert.match(result.prompt, /second reference image as B/i);
  assert.match(result.prompt, /A subject group above the B subject group/i);
  assert.match(result.prompt, /remove or neutralize the original backgrounds/i);
  assert.match(result.prompt, /preserve subject shape, colors, materials, markings, proportions, and identity cues/i);
  assert.match(result.prompt, /Do not add text, labels, watermarks, unrelated objects, invented logos, or decorative scene elements/i);
  assert.doesNotMatch(result.prompt, /grid of all uploaded images/i);
  assert.doesNotMatch(result.prompt, /every possible combination/i);
});

test("quick blend pair index normalization stays positive and string based", () => {
  assert.equal(normalizeQuickBlendPairIndex(1), "1");
  assert.equal(normalizeQuickBlendPairIndex("03"), "3");
  assert.equal(normalizeQuickBlendPairIndex("0"), "1");
  assert.equal(normalizeQuickBlendPairIndex("abc"), "1");
  assert.equal(normalizeQuickBlendPairIndex("2abc"), "1");
  assert.equal(normalizeQuickBlendPairIndex("3.9"), "1");
  assert.equal(normalizeQuickBlendPairIndex("   "), "1");
  assert.equal(normalizeQuickBlendPairIndex(null), "1");
});

test("quick blend prompt sanitizes uploaded filenames in metadata and prompt text", () => {
  const result = buildQuickBlendPrompt({
    aImageName: " A\nname.png ",
    bImageName: "B\tname.png",
  });

  assert.equal(result.aImageName, "A name.png");
  assert.equal(result.bImageName, "B name.png");
  assert.match(result.prompt, /A filename: A name\.png\./);
  assert.match(result.prompt, /B filename: B name\.png\./);
  assert.doesNotMatch(result.prompt, /A\nname\.png/);
  assert.doesNotMatch(result.prompt, /B\tname\.png/);
});

test("quick blend filename token follows source filename stems", () => {
  assert.equal(
    buildQuickBlendFilenameToken({
      aImageName: " A dress.png ",
      bImageName: "B shoe.JPG",
    }),
    "A-dress-B-shoe",
  );
  assert.equal(
    buildQuickBlendFilenameToken({
      aImageName: "../product/front view.png",
      bImageName: "package:bad?.png",
    }),
    "front-view-packagebad",
  );
  assert.equal(buildQuickBlendFilenameToken({}), "");
});
