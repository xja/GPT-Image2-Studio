import test from "node:test";
import assert from "node:assert/strict";

import {
  GENERATION_REQUEST_MAX_RETRIES,
  getGenerationRequestRetryPlan,
  isRetryablePortRequestError,
} from "../lib/generation-request-retry.mjs";

test("generation request retry recognizes local port fetch failures", () => {
  assert.equal(isRetryablePortRequestError(new TypeError("Failed to fetch")), true);
  assert.equal(isRetryablePortRequestError(new Error("connect ECONNREFUSED 127.0.0.1:3600")), true);
  assert.equal(isRetryablePortRequestError(new Error("提示词不能为空")), false);
});

test("generation request retry schedules up to two automatic retries for port failures", () => {
  const plan = getGenerationRequestRetryPlan({
    error: new TypeError("Failed to fetch"),
    retryCount: 0,
  });

  assert.equal(GENERATION_REQUEST_MAX_RETRIES, 2);
  assert.deepEqual(plan, {
    retryable: true,
    shouldRetry: true,
    retryCount: 0,
    nextRetryCount: 1,
    message: "端口请求失败，正在重试 1/2",
  });
});

test("generation request retry stops after two retries and returns deletion copy", () => {
  const plan = getGenerationRequestRetryPlan({
    error: new TypeError("Failed to fetch"),
    retryCount: 2,
  });

  assert.deepEqual(plan, {
    retryable: true,
    shouldRetry: false,
    retryCount: 2,
    nextRetryCount: 2,
    message: "端口请求失败，已重试 2 次，任务已删除。",
  });
});
