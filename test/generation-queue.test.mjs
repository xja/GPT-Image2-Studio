import assert from "node:assert/strict";
import test from "node:test";

import {
  cancelQueuedGenerationJob,
  isQueuedGenerationJob,
  selectNextQueuedGenerationJobs,
} from "../lib/generation-queue.mjs";

test("generation queue only treats unstarted jobs as cancelable", () => {
  assert.equal(isQueuedGenerationJob({ id: "queued", started: false, isRunning: false }), true);
  assert.equal(isQueuedGenerationJob({ id: "started", started: true, isRunning: false }), false);
  assert.equal(isQueuedGenerationJob({ id: "running", started: true, isRunning: true }), false);
});

test("generation queue cancel removes queued jobs and refuses started jobs", () => {
  const jobs = [
    { id: "newer", started: false, isRunning: false },
    { id: "running", started: true, isRunning: true },
    { id: "older", started: false, isRunning: false },
  ];

  const canceled = cancelQueuedGenerationJob(jobs, "older");
  assert.equal(canceled.canceledJob.id, "older");
  assert.deepEqual(canceled.jobs.map((job) => job.id), ["newer", "running"]);

  const refused = cancelQueuedGenerationJob(jobs, "running");
  assert.equal(refused.canceledJob, null);
  assert.deepEqual(refused.jobs, jobs);
});

test("generation queue starts the oldest queued jobs first", () => {
  const jobs = [
    { id: "newest", started: false, isRunning: false },
    { id: "middle", started: false, isRunning: false },
    { id: "running", started: true, isRunning: true },
    { id: "oldest", started: false, isRunning: false },
  ];

  assert.deepEqual(
    selectNextQueuedGenerationJobs(jobs, 2).map((job) => job.id),
    ["oldest", "middle"],
  );
});
