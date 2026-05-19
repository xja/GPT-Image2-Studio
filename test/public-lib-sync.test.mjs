import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

const syncedModules = [
  "api-contract.mjs",
  "generation-stream-protocol.mjs",
  "studio-formatters.mjs",
  "gallery-organizer.mjs",
  "generation-size-options.mjs",
  "creation-category-templates.mjs",
];

async function sha256(path) {
  const bytes = await readFile(new URL(path, import.meta.url));
  return createHash("sha256").update(bytes).digest("hex");
}

test("public browser modules are synchronized from lib sources", async () => {
  await stat(new URL("../scripts/sync-public-lib.mjs", import.meta.url));

  for (const filename of syncedModules) {
    assert.equal(
      await sha256(`../public/lib/${filename}`),
      await sha256(`../lib/${filename}`),
      `${filename} must be synced from lib/ to public/lib/`,
    );
  }
});
