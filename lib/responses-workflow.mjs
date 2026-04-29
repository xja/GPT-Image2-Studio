import { DEFAULT_REASONING_EFFORT } from "./studio-constants.mjs";
import { formatHttpErrorMessage } from "./error-formatting.mjs";

const textEncoder = new TextEncoder();

export function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

export function normalizeBase64(value) {
  return value.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "").trim();
}

export function buildResponsesInput({ prompt, referenceImages = [] }) {
  const images = Array.isArray(referenceImages)
    ? referenceImages.filter(Boolean)
    : referenceImages
      ? [referenceImages]
      : [];

  if (images.length === 0) {
    return prompt;
  }

  return [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: prompt,
        },
        ...images.map((referenceImage) => ({
          type: "input_image",
          image_url: `data:${referenceImage.mimeType};base64,${referenceImage.base64}`,
        })),
      ],
    },
  ];
}

export function createResponsesRequestBody({
  prompt,
  referenceImages,
  size,
  quality,
  format = "png",
  responsesModel,
  reasoningEffort = DEFAULT_REASONING_EFFORT,
  stream = true,
}) {
  return {
    model: responsesModel,
    input: buildResponsesInput({ prompt, referenceImages }),
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

export async function consumeResponsesSse(stream, { onEvent } = {}) {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let responseCompleted = false;
  let finalImageBase64 = "";
  const partialImages = [];
  const events = [];

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

  while (true) {
    let readResult;
    try {
      readResult = await reader.read();
    } catch (error) {
      const canUseBufferedResult =
        (finalImageBase64 || responseCompleted) &&
        error instanceof Error &&
        /terminated|socket|aborted/i.test(error.message);

      if (canUseBufferedResult) {
        return {
          finalImageBase64,
          partialImages,
          responseCompleted,
          events,
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

export async function requestImageGeneration({
  baseUrl,
  apiKey,
  prompt,
  referenceImages,
  size,
  quality,
  format = "png",
  responsesModel,
  reasoningEffort = DEFAULT_REASONING_EFFORT,
  fetchImpl = fetch,
  onEvent,
}) {
  await emitEvent(onEvent, {
    type: "status",
    stage: "connecting",
    message: "正在连接上游服务",
  });

  const endpoint = `${normalizeBaseUrl(baseUrl)}/responses`;
  const buildRequestInit = (stream) => ({
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
        size,
        quality,
        format,
        responsesModel,
        reasoningEffort,
        stream,
      }),
    ),
  });

  const response = await fetchImpl(endpoint, buildRequestInit(true));

  if (!response.ok) {
    throw new Error(
      formatHttpErrorMessage({
        label: "生成请求失败",
        status: response.status,
        body: await response.text(),
      }),
    );
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
  });

  if (!result.finalImageBase64) {
    await emitEvent(onEvent, {
      type: "status",
      stage: "generating",
      message: "流式响应未返回最终图，正在兜底获取结果",
    });

    const fallbackResponse = await fetchImpl(endpoint, buildRequestInit(false));
    if (!fallbackResponse.ok) {
      throw new Error(
        formatHttpErrorMessage({
          label: "生成请求失败",
          status: fallbackResponse.status,
          body: await fallbackResponse.text(),
        }),
      );
    }

    const fallbackPayload = await readJsonResponse(fallbackResponse);
    const fallbackBase64 =
      extractImageBase64("response.completed", { response: fallbackPayload?.response || fallbackPayload }) ||
      extractImageBase64(String(fallbackPayload?.type || ""), fallbackPayload);

    if (!fallbackBase64) {
      throw new Error(buildNoFinalImageMessage(result));
    }

    await emitEvent(onEvent, {
      type: "final_image",
      base64: fallbackBase64,
    });

    return {
      ...result,
      finalImageBase64: fallbackBase64,
      responseCompleted: true,
      fallbackUsed: true,
      format,
    };
  }

  return {
    ...result,
    format,
  };
}

export function encodeChunk(value) {
  return textEncoder.encode(value);
}
