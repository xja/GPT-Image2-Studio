import { DEFAULT_REASONING_EFFORT } from "./studio-constants.mjs";
import { formatHttpErrorMessage } from "./error-formatting.mjs";
import { normalizeBase64, normalizeBaseUrl, parseSseChunk } from "./responses-workflow.mjs";

const PROMPT_AGENT_INSTRUCTION = `你是一个图片提示词逆向工程 agent。请分析用户上传的图片，反推一份能复刻该图片视觉效果的 AI 图片生成提示词，并返回 JSON。

要求：
1. 只返回 JSON，不要返回 Markdown、代码块或解释。
2. prompt 字段必须是一段完整、可直接复制到图片生成文本框的中文提示词，目标是尽可能复刻原图。
3. 像提示词工程师一样反推主体、场景、构图、光线、色彩、材质、镜头、风格、画幅和关键细节。
4. negative_prompt 写出需要避免的画面问题。
5. 不要编造图片中不存在的品牌、文字、人名或敏感身份。`;

export const PROMPT_AGENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "prompt",
    "negative_prompt",
    "style_tags",
    "subject",
    "scene",
    "composition",
    "lighting",
    "color_palette",
    "camera",
    "aspect_ratio",
    "notes",
  ],
  properties: {
    title: {
      type: "string",
      description: "图片内容的短标题，使用简体中文。",
    },
    prompt: {
      type: "string",
      description: "可直接用于图片生成的完整中文提示词。",
    },
    negative_prompt: {
      type: "string",
      description: "生成时建议避免的瑕疵和错误方向。",
    },
    style_tags: {
      type: "array",
      items: { type: "string" },
      description: "风格关键词，适合用于快速筛选和复用。",
    },
    subject: {
      type: "string",
      description: "主体和关键对象。",
    },
    scene: {
      type: "string",
      description: "环境、背景和氛围。",
    },
    composition: {
      type: "string",
      description: "构图、视角、主体位置和空间关系。",
    },
    lighting: {
      type: "string",
      description: "光线类型、方向、强度和阴影。",
    },
    color_palette: {
      type: "string",
      description: "主要色彩、配色关系和色调。",
    },
    camera: {
      type: "string",
      description: "镜头、景深、焦段或拍摄质感。",
    },
    aspect_ratio: {
      type: "string",
      description: "根据图片构图建议的画幅比例。",
    },
    notes: {
      type: "array",
      items: { type: "string" },
      description: "复刻图片时最需要保留的细节。",
    },
  },
};

function normalizeImage(image) {
  if (!image || typeof image !== "object") {
    throw new Error("请先上传一张图片。");
  }

  const mimeType = String(image.mimeType || "").trim() || "image/png";
  const base64 = normalizeBase64(String(image.base64 || ""));

  if (!base64) {
    throw new Error("图片内容为空。");
  }

  return {
    filename: String(image.filename || "uploaded-image").trim(),
    mimeType,
    base64,
  };
}

export function buildPromptAgentInput({ image }) {
  const normalized = normalizeImage(image);

  return [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: PROMPT_AGENT_INSTRUCTION,
        },
        {
          type: "input_image",
          image_url: `data:${normalized.mimeType};base64,${normalized.base64}`,
        },
      ],
    },
  ];
}

export function createPromptAgentRequestBody({
  image,
  responsesModel,
  reasoningEffort = DEFAULT_REASONING_EFFORT,
  structuredOutput = true,
}) {
  const body = {
    model: responsesModel,
    input: buildPromptAgentInput({ image }),
    reasoning: {
      effort: reasoningEffort,
    },
    stream: true,
  };

  if (structuredOutput) {
    body.text = {
      format: {
        type: "json_schema",
        name: "image_prompt_json",
        strict: true,
        schema: PROMPT_AGENT_JSON_SCHEMA,
      },
    };
  }

  return body;
}

function collectTextParts(value, parts = []) {
  if (!value || typeof value !== "object") {
    return parts;
  }

  if (typeof value.output_text === "string") {
    parts.push(value.output_text);
  }

  if (
    (value.type === "output_text" ||
      value.type === "text" ||
      value.type === "response.output_text.done") &&
    typeof value.text === "string"
  ) {
    parts.push(value.text);
  }

  if (Array.isArray(value.output)) {
    value.output.forEach((item) => collectTextParts(item, parts));
  }

  if (Array.isArray(value.content)) {
    value.content.forEach((item) => collectTextParts(item, parts));
  }

  if (value.response && typeof value.response === "object") {
    collectTextParts(value.response, parts);
  }

  if (value.item && typeof value.item === "object") {
    collectTextParts(value.item, parts);
  }

  return parts;
}

function stripJsonFence(text) {
  return String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseJsonObject(text) {
  const cleaned = stripJsonFence(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("模型返回的内容不是有效 JSON。");
  }
}

function normalizePromptAgentJson(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("模型返回的 JSON 不是对象。");
  }

  const prompt = String(value.prompt || "").trim();
  if (!prompt) {
    throw new Error("模型返回的 JSON 缺少 prompt 字段。");
  }

  return {
    title: String(value.title || "图片提示词").trim(),
    prompt,
    negative_prompt: String(value.negative_prompt || "").trim(),
    style_tags: Array.isArray(value.style_tags)
      ? value.style_tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [],
    subject: String(value.subject || "").trim(),
    scene: String(value.scene || "").trim(),
    composition: String(value.composition || "").trim(),
    lighting: String(value.lighting || "").trim(),
    color_palette: String(value.color_palette || "").trim(),
    camera: String(value.camera || "").trim(),
    aspect_ratio: String(value.aspect_ratio || "").trim(),
    notes: Array.isArray(value.notes)
      ? value.notes.map((note) => String(note).trim()).filter(Boolean)
      : [],
  };
}

export function extractPromptAgentJson(payload) {
  if (typeof payload === "string") {
    return normalizePromptAgentJson(parseJsonObject(payload));
  }

  const text = collectTextParts(payload).join("\n").trim();
  if (!text) {
    throw new Error("模型响应中没有可解析的文本内容。");
  }

  return normalizePromptAgentJson(parseJsonObject(text));
}

function pickStreamText({ completedText, collectedTexts, deltaText }) {
  if (completedText.trim()) {
    return completedText.trim();
  }

  const latestCollectedText = [...collectedTexts].reverse().find((text) => text.trim());
  if (latestCollectedText) {
    return latestCollectedText.trim();
  }

  return deltaText.trim();
}

export async function consumePromptAgentSse(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let deltaText = "";
  let completedText = "";
  const collectedTexts = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const { eventName, data } = parseSseChunk(chunk);
      if (!data) {
        continue;
      }

      if (data === "[DONE]") {
        return extractPromptAgentJson(
          pickStreamText({
            completedText,
            collectedTexts,
            deltaText,
          }),
        );
      }

      const payload = JSON.parse(data);
      const resolvedEventName = eventName || payload?.type || "unknown";

      if (
        resolvedEventName === "response.output_text.delta" &&
        typeof payload.delta === "string"
      ) {
        deltaText += payload.delta;
      }

      if (
        resolvedEventName === "response.output_text.done" &&
        typeof payload.text === "string"
      ) {
        completedText = payload.text;
      }

      const parts = collectTextParts(payload);
      if (parts.length > 0) {
        collectedTexts.push(parts.join("\n"));
      }
    }
  }

  return extractPromptAgentJson(
    pickStreamText({
      completedText,
      collectedTexts,
      deltaText,
    }),
  );
}

function shouldRetryWithoutStructuredOutput(error) {
  const message = error instanceof Error ? error.message : String(error);
  const upstreamBody =
    error && typeof error === "object" && typeof error.upstreamBody === "string"
      ? error.upstreamBody
      : "";
  return /text\.format|json_schema|response_format|structured/i.test(`${message}\n${upstreamBody}`);
}

async function parsePromptAgentResponse(response) {
  if (!response.ok) {
    const body = await response.text();
    const error = new Error(
      formatHttpErrorMessage({
        label: "图片分析请求失败",
        status: response.status,
        body,
      }),
    );
    error.upstreamBody = body;
    throw error;
  }

  const contentType = response.headers?.get("content-type") || "";
  if (response.body && /text\/event-stream/i.test(contentType)) {
    return consumePromptAgentSse(response.body);
  }

  const responseText = await response.text();
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = responseText;
  }

  return extractPromptAgentJson(payload);
}

async function sendPromptAgentRequest({
  baseUrl,
  apiKey,
  image,
  responsesModel,
  reasoningEffort,
  fetchImpl,
  structuredOutput,
}) {
  const response = await fetchImpl(`${normalizeBaseUrl(baseUrl)}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(
      createPromptAgentRequestBody({
        image,
        responsesModel,
        reasoningEffort,
        structuredOutput,
      }),
    ),
  });

  return parsePromptAgentResponse(response);
}

export async function requestPromptAgentAnalysis({
  baseUrl,
  apiKey,
  image,
  responsesModel,
  reasoningEffort = DEFAULT_REASONING_EFFORT,
  fetchImpl = fetch,
}) {
  try {
    return await sendPromptAgentRequest({
      baseUrl,
      apiKey,
      image,
      responsesModel,
      reasoningEffort,
      fetchImpl,
      structuredOutput: true,
    });
  } catch (error) {
    if (!shouldRetryWithoutStructuredOutput(error)) {
      throw error;
    }

    return sendPromptAgentRequest({
      baseUrl,
      apiKey,
      image,
      responsesModel,
      reasoningEffort,
      fetchImpl,
      structuredOutput: false,
    });
  }
}
