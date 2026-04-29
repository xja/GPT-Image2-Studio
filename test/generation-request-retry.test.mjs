import test from "node:test";
import assert from "node:assert/strict";

import {
  GENERATION_REQUEST_MAX_RETRIES,
  getGenerationRequestRetryPlan,
  isGenerationRequestRetryMessage,
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
    shouldSurfaceError: false,
    retryCount: 0,
    nextRetryCount: 1,
    message: "端口请求失败，正在重试 1/2",
  });
});

test("generation request retry stops after two retries without surfacing a user-facing error", () => {
  const plan = getGenerationRequestRetryPlan({
    error: new TypeError("Failed to fetch"),
    retryCount: 2,
  });

  assert.deepEqual(plan, {
    retryable: true,
    shouldRetry: false,
    shouldSurfaceError: false,
    retryCount: 2,
    nextRetryCount: 2,
    message: "",
  });
});

test("generation request retry identifies stale retry messages stored in activity history", () => {
  assert.equal(isGenerationRequestRetryMessage("端口请求失败，正在重试 1/2"), true);
  assert.equal(isGenerationRequestRetryMessage("端口请求失败，已重试 2 次，任务已删除。"), true);
  assert.equal(isGenerationRequestRetryMessage("生成请求失败：HTTP 429，错误码 rate_limit_exceeded"), false);
});
