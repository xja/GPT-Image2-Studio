import assert from "node:assert/strict";
import test from "node:test";

import { runWithConcurrency } from "../lib/limited-concurrency.mjs";

test("limited concurrency starts up to the configured limit before waiting", async () => {
  const started = [];
  const releaseByItem = new Map();

  const runPromise = runWithConcurrency(["a", "b", "c"], 2, async (item) => {
    started.push(item);
    await new Promise((resolve) => {
      releaseByItem.set(item, resolve);
    });
    return item.toUpperCase();
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(started, ["a", "b"]);

  releaseByItem.get("a")();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(started, ["a", "b", "c"]);

  releaseByItem.get("b")();
  releaseByItem.get("c")();
  assert.deepEqual(await runPromise, ["A", "B", "C"]);
});
