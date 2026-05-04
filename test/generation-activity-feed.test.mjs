import assert from "node:assert/strict";
import test from "node:test";

import { upsertGenerationActivityEntry } from "../lib/generation-activity-feed.mjs";

test("generation activity updates text without changing the original order", () => {
  const initialFeed = [
    {
      key: "job-new:task",
      title: "Running",
      detail: "New job is running",
      status: "active",
      at: "2026-05-04T10:01:00.000Z",
      orderAt: "2026-05-04T10:01:00.000Z",
    },
    {
      key: "job-old:task",
      title: "Running",
      detail: "Old job is running",
      status: "active",
      at: "2026-05-04T10:00:00.000Z",
      orderAt: "2026-05-04T10:00:00.000Z",
    },
  ];

  const updatedFeed = upsertGenerationActivityEntry(initialFeed, {
    key: "job-old:task",
    title: "Completed",
    detail: "Old job is complete",
    status: "done",
    at: "2026-05-04T10:05:00.000Z",
  });

  assert.deepEqual(
    updatedFeed.map((entry) => entry.key),
    ["job-new:task", "job-old:task"],
  );
  assert.equal(updatedFeed[1].detail, "Old job is complete");
  assert.equal(updatedFeed[1].at, "2026-05-04T10:05:00.000Z");
  assert.equal(updatedFeed[1].orderAt, "2026-05-04T10:00:00.000Z");
});
