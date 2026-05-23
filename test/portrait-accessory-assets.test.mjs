import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_PORTRAIT_ACCESSORY_ASSETS,
  getPortraitAccessoryAssetFileDescriptor,
} from "../lib/portrait-accessory-assets.mjs";

const CLASSIC_CATEGORY_ASSETS = {
  upper: ["upper-minimal-tee", "upper-white-shirt", "upper-tube-top", "upper-knit-shrug"],
  bottom: ["bottom-straight-trousers", "bottom-blue-jeans", "bottom-tailored-trousers", "bottom-capri-pants"],
  shoes: ["shoes-white-sneakers", "shoes-skate-sneakers", "shoes-black-loafers", "shoes-high-heels"],
};

function publicAssetUrl(src) {
  return new URL(`../public/${src.replace(/^\.\//, "")}`, import.meta.url);
}

test("portrait classic upper bottom and shoe assets each expose four color image variants", () => {
  for (const [category, ids] of Object.entries(CLASSIC_CATEGORY_ASSETS)) {
    const assets = DEFAULT_PORTRAIT_ACCESSORY_ASSETS.filter((asset) => asset.category === category);
    assert.deepEqual(assets.map((asset) => asset.id), ids);
    for (const asset of assets) {
      assert.equal(asset.colors.length, 4, `${asset.id} should expose four colors`);
      assert.ok(asset.colors.some((color) => color.label === "纯白"), `${asset.id} should include pure white`);
      assert.ok(asset.colors.some((color) => color.label.startsWith("纯") && color.label !== "纯白"), `${asset.id} should include another pure color`);
      for (const color of asset.colors) {
        assert.match(color.id, /^[a-z0-9-]+$/);
        assert.match(color.src, new RegExp(`^\\.\\/assets\\/portrait-accessories\\/${asset.id}-[a-z0-9-]+\\.png$`));
        assert.match(color.filename, new RegExp(`^portrait-accessory-${asset.id}-[a-z0-9-]+\\.png$`));
        assert.ok(color.swatch);
      }
    }
  }
});

test("portrait classic color variant files are local PNG image assets", async () => {
  const classicIds = new Set(Object.values(CLASSIC_CATEGORY_ASSETS).flat());
  for (const asset of DEFAULT_PORTRAIT_ACCESSORY_ASSETS.filter((entry) => classicIds.has(entry.id))) {
    for (const color of asset.colors) {
      const bytes = await readFile(publicAssetUrl(color.src));
      assert.equal(bytes[0], 0x89, color.src);
      assert.equal(bytes[1], 0x50, color.src);
      assert.equal(bytes[2], 0x4e, color.src);
      assert.equal(bytes[3], 0x47, color.src);
    }
  }
});

test("portrait accessory file descriptor uses the selected color variant", () => {
  const shirt = DEFAULT_PORTRAIT_ACCESSORY_ASSETS.find((asset) => asset.id === "upper-white-shirt");
  const descriptor = getPortraitAccessoryAssetFileDescriptor(shirt, "sky-blue");

  assert.equal(descriptor.label, "白衬衫 · 天蓝");
  assert.equal(descriptor.src, "./assets/portrait-accessories/upper-white-shirt-sky-blue.png");
  assert.equal(descriptor.filename, "portrait-accessory-upper-white-shirt-sky-blue.png");
});
