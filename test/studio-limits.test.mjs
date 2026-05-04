import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  MAX_CONCURRENT_TASKS_PER_SESSION,
  MAX_PARALLEL_TASKS_PER_SESSION,
} from "../lib/studio-constants.mjs";

const appPath = new URL("../public/app.js", import.meta.url);

test("studio task limits keep 20 queued tasks and allow four parallel tasks", async () => {
  assert.equal(MAX_CONCURRENT_TASKS_PER_SESSION, 20);
  assert.equal(MAX_PARALLEL_TASKS_PER_SESSION, 4);

  const app = await readFile(appPath, "utf8");

  assert.match(app, /maxConcurrentTasksPerSession:\s*20/);
  assert.match(app, /maxParallelTasksPerSession:\s*4/);
});
