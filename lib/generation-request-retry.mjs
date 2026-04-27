export const GENERATION_REQUEST_MAX_RETRIES = 2;

const RETRYABLE_PORT_ERROR_PATTERNS = [
  /failed to fetch/i,
  /fetch failed/i,
  /networkerror/i,
  /network request failed/i,
  /load failed/i,
  /err_connection_refused/i,
  /econnrefused/i,
  /socket hang up/i,
];

export function isRetryablePortRequestError(error) {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : String(error || "");

  return RETRYABLE_PORT_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function getGenerationRequestRetryPlan({
  error,
  retryCount = 0,
  maxRetries = GENERATION_REQUEST_MAX_RETRIES,
} = {}) {
  const retryable = isRetryablePortRequestError(error);
  const normalizedRetryCount = Math.max(0, Number.isInteger(retryCount) ? retryCount : 0);
  const shouldRetry = retryable && normalizedRetryCount < maxRetries;

  if (shouldRetry) {
    const nextRetryCount = normalizedRetryCount + 1;
    return {
      retryable,
      shouldRetry,
      retryCount: normalizedRetryCount,
      nextRetryCount,
      message: `端口请求失败，正在重试 ${nextRetryCount}/${maxRetries}`,
    };
  }

  return {
    retryable,
    shouldRetry: false,
    retryCount: normalizedRetryCount,
    nextRetryCount: normalizedRetryCount,
    message: retryable
      ? `端口请求失败，已重试 ${maxRetries} 次，任务已删除。`
      : error instanceof Error
        ? error.message
        : String(error || "生成请求失败"),
  };
}
