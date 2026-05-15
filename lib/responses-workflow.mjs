import { DEFAULT_REASONING_EFFORT } from "./studio-constants.mjs";
import { formatHttpErrorMessage } from "./error-formatting.mjs";

const textEncoder = new TextEncoder();
const OPENAI_IMAGE_SIZE_VALUES = new Set(["auto", "1024x1024", "1536x1024", "1024x1536"]);
const STREAMING_FALLBACK_HTTP_STATUSES = new Set([400, 403, 405, 406, 501]);
const TRANSIENT_UPSTREAM_HTTP_STATUSES = new Set([408, 500, 502, 503, 504, 520, 522, 523, 524]);
const DEFAULT_TRANSIENT_HTTP_MAX_RETRIES = 2;
const DEFAULT_TRANSIENT_HTTP_RETRY_DELAY_MS = 1200;

function getCompatibleImageSizeFallback(size = "auto") {
  const normalized = String(size || "auto").trim().toLowerCase();
  if (OPENAI_IMAGE_SIZE_VALUES.has(normalized)) {
    return normalized;
  }

  const match = normalized.match(/^(\d+)x(\d+)$/);
  if (!match) {
    return "auto";
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width > height) {
    return "1536x1024";
  }
  if (height > width) {
    return "1024x1536";
  }
  return "1024x1024";
}

function shouldRetryInvalidImageSize({ status, body, size } = {}) {
  const normalizedSize = String(size || "auto").trim().toLowerCase();
  const fallbackSize = getCompatibleImageSizeFallback(normalizedSize);
  if (fallbackSize === normalizedSize || Number(status) !== 400) {
    return "";
  }

  const bodyText = String(body || "").toLowerCase();
  if (!bodyText.includes("invalid_value")) {
    return "";
  }

  if (bodyText.includes(normalizedSize) || bodyText.includes("size")) {
    return fallbackSize;
  }

  return "";
}

function shouldRetryWithoutStreaming({ status, body } = {}) {
  const numericStatus = Number(status);
  if (!STREAMING_FALLBACK_HTTP_STATUSES.has(numericStatus)) {
    return false;
  }

  if (numericStatus === 400) {
    return /stream|sse|event-stream|unsupported/i.test(String(body || ""));
  }

  return true;
}

function shouldRetryTransientHttpStatus(status) {
  return TRANSIENT_UPSTREAM_HTTP_STATUSES.has(Number(status));
}

function isRetryableStreamReadError(error) {
  return error instanceof Error && /terminated|socket|aborted|network|connection|reset/i.test(error.message);
}

export function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

export function normalizeBase64(value) {
  return value.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "").trim();
}

export function buildResponsesInput({ prompt, referenceImages = [], referenceImageLabels = [] }) {
  const images = Array.isArray(referenceImages)
    ? referenceImages.filter(Boolean)
    : referenceImages
      ? [referenceImages]
      : [];
  const labels = Array.isArray(referenceImageLabels) ? referenceImageLabels : [];

  if (images.length === 0) {
    return prompt;
  }

  const content = [
    {
      type: "input_text",
      text: prompt,
    },
  ];

  images.forEach((referenceImage, index) => {
    const label = String(labels[index] || "").trim();
    if (label) {
      content.push({
        type: "input_text",
        text: label,
      });
    }

    content.push({
      type: "input_image",
      image_url: `data:${referenceImage.mimeType};base64,${referenceImage.base64}`,
    });
  });

  return [
    {
      role: "user",
      content,
    },
  ];
}

export function createResponsesRequestBody({
  prompt,
  referenceImages,
  referenceImageLabels,
  size,
  quality,
  format = "png",
  responsesModel,
  reasoningEffort = DEFAULT_REASONING_EFFORT,
  stream = true,
}) {
  return {
    model: responsesModel,
    input: buildResponsesInput({ prompt, referenceImages, referenceImageLabels }),
    reasoning: {
      effort: reasoningEffort,
    },
    stream,
    tool_choice: {
      type: "image_generation",
    },
    tools: [
      {
        type: "image_generation",
        model: "gpt-image-2",
        size,
        quality,
        output_format: format,
        background: "opaque",
      },
    ],
  };
}

export function parseSseChunk(chunk) {
  const lines = chunk
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  let eventName = "";
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }

  return {
    eventName,
    data: dataLines.join("\n"),
  };
}

export function extractImageBase64(eventName, payload) {
  const eventLooksLikeImage =
    /image_generation/i.test(eventName || "") || /image_generation/i.test(String(payload?.type || ""));

  if (
    eventName === "response.output_item.done" &&
    payload?.item?.type === "image_generation_call" &&
    typeof payload.item.result === "string" &&
    payload.item.result.length > 0
  ) {
    return payload.item.result;
  }

  if (eventLooksLikeImage) {
    const directCandidates = [
      payload?.result,
      payload?.b64_json,
      payload?.image?.b64_json,
      payload?.data?.[0]?.b64_json,
    ];
    const directImage = directCandidates.find((value) => typeof value === "string" && value.length > 0);
    if (directImage) {
      return directImage;
    }
  }

  if (
    payload?.type === "image_generation_call" &&
    typeof payload.result === "string" &&
    payload.result.length > 0
  ) {
    return payload.result;
  }

  if (eventName === "response.completed" && Array.isArray(payload?.response?.output)) {
    const imageItem = payload.response.output.find(
      (item) => item?.type === "image_generation_call" && typeof item.result === "string",
    );

    if (imageItem?.result) {
      return imageItem.result;
    }
  }

  if (Array.isArray(payload?.output)) {
    const imageItem = payload.output.find(
      (item) => item?.type === "image_generation_call" && typeof item.result === "string",
    );

    if (imageItem?.result) {
      return imageItem.result;
    }
  }

  return null;
}

function formatUpstreamError(error) {
  if (!error) {
    return "";
  }

  if (typeof error === "string") {
    return error.trim();
  }

  const code = String(error.code || error.type || "").trim();
  const message = String(error.message || error.detail || error.reason || "").trim();
  return [code, message].filter(Boolean).join(" ");
}

function getUpstreamTerminalErrorMessage(eventName, payload) {
  if (/response\.failed$/i.test(eventName)) {
    const detail =
      formatUpstreamError(payload?.response?.error) ||
      formatUpstreamError(payload?.error) ||
      "response.failed";
    return `上游生成失败：${detail}`;
  }

  if (/response\.incomplete$/i.test(eventName) || payload?.response?.status === "incomplete") {
    const detail =
      formatUpstreamError(payload?.response?.incomplete_details) ||
      formatUpstreamError(payload?.incomplete_details) ||
      "response.incomplete";
    return `上游生成未完成：${detail}`;
  }

  return "";
}

function makeDataUrl(base64, mimeType) {
  return `data:${mimeType};base64,${normalizeBase64(base64)}`;
}

async function emitEvent(onEvent, event) {
  if (typeof onEvent === "function") {
    await onEvent(event);
  }
}

async function waitWithStatusHeartbeat(promise, { onEvent, intervalMs, message }) {
  const normalizedInterval = Number(intervalMs || 0);
  if (!Number.isFinite(normalizedInterval) || normalizedInterval <= 0) {
    return promise;
  }

  const timer = setInterval(() => {
    void emitEvent(onEvent, {
      type: "status",
      stage: "waiting_upstream",
      message,
    }).catch(() => {});
  }, normalizedInterval);

  try {
    return await promise;
  } finally {
    clearInterval(timer);
  }
}

function wait(ms) {
  const normalizedMs = Math.max(0, Number(ms) || 0);
  if (normalizedMs === 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, normalizedMs);
  });
}

function getTransientRetryDelayMs(baseDelayMs, attempt) {
  const normalizedBaseDelay = Math.max(0, Number(baseDelayMs) || 0);
  const normalizedAttempt = Math.max(1, Number(attempt) || 1);
  return normalizedBaseDelay * normalizedAttempt;
}

export async function consumeResponsesSse(stream, { onEvent, statusHeartbeatMs = 0 } = {}) {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let responseCompleted = false;
  let finalImageBase64 = "";
  const partialImages = [];
  const events = [];
  const heartbeatInterval = Number(statusHeartbeatMs || 0);
  const heartbeatTimer =
    Number.isFinite(heartbeatInterval) && heartbeatInterval > 0
      ? setInterval(() => {
          void emitEvent(onEvent, {
            type: "status",
            stage: "waiting_final",
            message: "Still waiting for the final image. Keep this page open.",
          }).catch(() => {});
        }, heartbeatInterval)
      : 0;

  async function processChunk(chunk) {
    const { eventName, data } = parseSseChunk(chunk);
    if (!data) {
      return false;
    }

    if (data === "[DONE]") {
      return true;
    }

    const payload = JSON.parse(data);
    const resolvedEventName = eventName || payload?.type || "unknown";
    events.push(resolvedEventName);

    const terminalErrorMessage = getUpstreamTerminalErrorMessage(resolvedEventName, payload);
    if (terminalErrorMessage) {
      throw new Error(terminalErrorMessage);
    }

    const partialImageBase64 =
      typeof payload.partial_image_b64 === "string"
        ? payload.partial_image_b64
        : /partial/i.test(resolvedEventName) && typeof payload.b64_json === "string"
          ? payload.b64_json
          : "";

    if (partialImageBase64) {
      partialImages.push(partialImageBase64);
      await emitEvent(onEvent, {
        type: "partial_image",
        base64: partialImageBase64,
        dataUrl: makeDataUrl(partialImageBase64, "image/png"),
      });
    }

    const maybeFinal = extractImageBase64(resolvedEventName, payload);
    if (maybeFinal && maybeFinal !== finalImageBase64) {
      finalImageBase64 = maybeFinal;
      await emitEvent(onEvent, {
        type: "final_image",
        base64: maybeFinal,
      });
    }

    if (/^(response\.)?image_generation.*completed$/i.test(resolvedEventName) || resolvedEventName === "response.completed") {
      responseCompleted = true;
      await emitEvent(onEvent, {
        type: "complete",
      });
    }

    return false;
  }

  try {
    while (true) {
      let readResult;
      try {
        readResult = await reader.read();
      } catch (error) {
        const retryableReadError = isRetryableStreamReadError(error);
        const canUseBufferedResult = (finalImageBase64 || responseCompleted) && retryableReadError;

        if (canUseBufferedResult) {
          return {
            finalImageBase64,
            partialImages,
            responseCompleted,
            events,
          };
        }

        if (retryableReadError) {
          return {
            finalImageBase64,
            partialImages,
            responseCompleted,
            events,
            streamInterrupted: true,
            streamErrorMessage: error.message,
          };
        }

        throw error;
      }

      const { done, value } = readResult;
      if (done) {
        if (buffer.trim()) {
          const shouldStop = await processChunk(buffer);
          if (shouldStop) {
            return {
              finalImageBase64,
              partialImages,
              responseCompleted,
              events,
            };
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split(/\r?\n\r?\n/);
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const shouldStop = await processChunk(chunk);
        if (shouldStop) {
          return {
            finalImageBase64,
            partialImages,
            responseCompleted,
            events,
          };
        }
      }
    }
  } finally {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
  }

  return {
    finalImageBase64,
    partialImages,
    responseCompleted,
    events,
  };
}

function summarizeEvents(events = []) {
  const uniqueEvents = [...new Set(events.filter(Boolean))];
  return uniqueEvents.length > 0 ? uniqueEvents.join(", ") : "无";
}

function buildNoFinalImageMessage(result) {
  return `上游响应结束，但没有拿到最终图片。已收到事件：${summarizeEvents(result?.events)}。请降低分辨率或并发后重试；如果仍失败，请检查兼容端点是否返回 image_generation_call.result。`;
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text.trim()) {
    return {};
  }

  return JSON.parse(text);
}

async function readFinalImageFromJsonResponse(response) {
  const payload = await readJsonResponse(response);
  return (
    extractImageBase64("response.completed", { response: payload?.response || payload }) ||
    extractImageBase64(String(payload?.type || ""), payload)
  );
}

export async function requestImageGeneration({
  baseUrl,
  apiKey,
  prompt,
  referenceImages,
  referenceImageLabels,
  size,
  quality,
  format = "png",
  responsesModel,
  reasoningEffort = DEFAULT_REASONING_EFFORT,
  fetchImpl = fetch,
  statusHeartbeatMs = 0,
  transientHttpMaxRetries = DEFAULT_TRANSIENT_HTTP_MAX_RETRIES,
  transientHttpRetryDelayMs = DEFAULT_TRANSIENT_HTTP_RETRY_DELAY_MS,
  onEvent,
}) {
  await emitEvent(onEvent, {
    type: "status",
    stage: "connecting",
    message: "正在连接上游服务",
  });

  const endpoint = `${normalizeBaseUrl(baseUrl)}/responses`;
  let effectiveSize = size;
  let sizeFallbackUsed = false;
  const buildRequestInit = (stream, requestSize = effectiveSize) => ({
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: stream ? "text/event-stream" : "application/json",
    },
    body: JSON.stringify(
      createResponsesRequestBody({
        prompt,
        referenceImages,
        referenceImageLabels,
        size: requestSize,
        quality,
        format,
        responsesModel,
        reasoningEffort,
        stream,
      }),
    ),
  });

  const fetchWithHeartbeat = (
    stream,
    requestSize = effectiveSize,
    message = "Still waiting for the upstream image service. Keep this page open.",
  ) =>
    waitWithStatusHeartbeat(fetchImpl(endpoint, buildRequestInit(stream, requestSize)), {
      onEvent,
      intervalMs: statusHeartbeatMs,
      message,
    });

  const maxTransientHttpRetries = Math.max(0, Math.floor(Number(transientHttpMaxRetries) || 0));
  const fetchStreamingResponseWithTransientRetries = async (requestSize = effectiveSize) => {
    let retryCount = 0;

    while (true) {
      const currentResponse = await fetchWithHeartbeat(true, requestSize);
      if (currentResponse.ok || !shouldRetryTransientHttpStatus(currentResponse.status)) {
        return {
          response: currentResponse,
          body: "",
        };
      }

      const body = await currentResponse.text();
      if (retryCount >= maxTransientHttpRetries) {
        return {
          response: currentResponse,
          body,
        };
      }

      retryCount += 1;
      await emitEvent(onEvent, {
        type: "status",
        stage: "retrying_upstream",
        message: `上游服务短暂异常（HTTP ${currentResponse.status}），正在重试 ${retryCount}/${maxTransientHttpRetries}`,
      });
      await wait(getTransientRetryDelayMs(transientHttpRetryDelayMs, retryCount));
    }
  };

  const requestNonStreamingFinalImage = async ({ streamFallbackUsed = false } = {}) => {
    const fallbackResponse = await fetchWithHeartbeat(
      false,
      effectiveSize,
      "Still waiting for non-streaming image generation. Keep this page open.",
    );
    if (!fallbackResponse.ok) {
      throw new Error(
        formatHttpErrorMessage({
          label: "生成请求失败",
          status: fallbackResponse.status,
          body: await fallbackResponse.text(),
        }),
      );
    }

    const fallbackBase64 = await readFinalImageFromJsonResponse(fallbackResponse);
    if (!fallbackBase64) {
      return "";
    }

    await emitEvent(onEvent, {
      type: "final_image",
      base64: fallbackBase64,
    });

    return {
      finalImageBase64: fallbackBase64,
      responseCompleted: true,
      fallbackUsed: true,
      streamFallbackUsed,
      sizeFallbackUsed,
      requestedSize: size,
      effectiveSize,
      format,
    };
  };

  let response;
  let responseBody = "";
  try {
    const streamResult = await fetchStreamingResponseWithTransientRetries();
    response = streamResult.response;
    responseBody = streamResult.body;
  } catch (error) {
    await emitEvent(onEvent, {
      type: "status",
      stage: "connecting",
      message: "Streaming connection failed. Retrying without streaming.",
    });
    const fallbackResult = await requestNonStreamingFinalImage({ streamFallbackUsed: true });
    if (fallbackResult) {
      return fallbackResult;
    }
    throw error;
  }

  if (!response.ok) {
    let body = responseBody || (await response.text());
    const fallbackSize = shouldRetryInvalidImageSize({
      status: response.status,
      body,
      size: effectiveSize,
    });

    if (fallbackSize) {
      effectiveSize = fallbackSize;
      sizeFallbackUsed = true;
      await emitEvent(onEvent, {
        type: "status",
        stage: "connecting",
        message: `上游拒绝该分辨率，正在使用兼容尺寸 ${fallbackSize} 重试`,
      });
      const streamResult = await fetchStreamingResponseWithTransientRetries(effectiveSize);
      response = streamResult.response;
      body = response.ok ? "" : streamResult.body || (await response.text());
    }

    if (response.ok) {
      // Continue with the successful retry response below.
    } else if (shouldRetryWithoutStreaming({ status: response.status, body })) {
      await emitEvent(onEvent, {
        type: "status",
        stage: "connecting",
        message: "Streaming was rejected upstream. Retrying without streaming.",
      });
      const fallbackResult = await requestNonStreamingFinalImage({ streamFallbackUsed: true });
      if (fallbackResult) {
        return fallbackResult;
      }
    } else {
      throw new Error(
        formatHttpErrorMessage({
          label: "生成请求失败",
          status: response.status,
          body,
        }),
      );
    }
  }

  if (!response.body) {
    throw new Error("接口没有返回可读取的流。");
  }

  await emitEvent(onEvent, {
    type: "status",
    stage: "generating",
    message: "正在生成图片",
  });

  const result = await consumeResponsesSse(response.body, {
    onEvent,
    statusHeartbeatMs,
  });

  if (!result.finalImageBase64) {
    const fallbackStatusMessage = result.streamInterrupted
      ? "Streaming was interrupted after preview. Retrying without streaming."
      : "流式响应未返回最终图，正在兜底获取结果";
    await emitEvent(onEvent, {
      type: "status",
      stage: "generating",
      message: fallbackStatusMessage,
    });

    const fallbackResult = await requestNonStreamingFinalImage({
      streamFallbackUsed: Boolean(result.streamInterrupted),
    });
    if (!fallbackResult) {
      throw new Error(buildNoFinalImageMessage(result));
    }

    return {
      ...result,
      ...fallbackResult,
    };
  }

  return {
    ...result,
    sizeFallbackUsed,
    requestedSize: size,
    effectiveSize,
    format,
  };
}

export function encodeChunk(value) {
  return textEncoder.encode(value);
}
