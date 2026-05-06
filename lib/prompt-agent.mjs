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

export const REFERENCE_ORCHESTRATION_MODE = "reference-orchestration";
export const CREATION_REFERENCE_ANALYSIS_MODE = "creation-reference-analysis";

const REFERENCE_ORCHESTRATION_INSTRUCTION = `你是一个参考图编排 agent。请分析用户上传的 1 到 6 张参考图，判断图片之间最合理的创作关系，并生成 1 到 3 条可直接用于图片生成的中文场景提示词。

要求：
1. 只返回 JSON，不要返回 Markdown、代码块或解释。
2. 先判断每张参考图的角色，例如人物主体、服装、裤子、配饰、背景、姿态、商品、风格参考或构图参考。
3. 多图时必须优先判断关系，例如人物 + 服装、主体 + 背景、商品 + 场景、风格图 + 内容图、多主体 + 场景。
4. 你会收到按顺序标注的参考图 1、参考图 2 等内容标签；必须逐张分析并覆盖所有参考图，不要只分析第一张。
5. prompts 必须包含 1 到 3 条结果；关系明确时给 1 条，存在明显不同场景或动作时给 2 到 3 条。
6. 每条 prompt 都要包含主体、参考图关系、场景、动作或姿态、镜头、光线、画面融合要求和必要限制。
7. 如果关系不明确，请在 risks 中说明待确认点，并让 prompt 保持保守，不要强行指定归属。
8. 不要识别或编造真人身份、姓名、年龄、品牌、地点或图片中不存在的敏感信息。`;

const CREATION_REFERENCE_ANALYSIS_INSTRUCTION = `你是一个套图参考图识别 agent。请分析用户上传的 1 到 6 张电商套图参考图，为每张图判断最适合影响套图生成的用途，并返回 JSON。

要求：
1. 只返回 JSON，不要返回 Markdown、代码块或解释。
2. 必须逐张分析并覆盖所有套图参考图，不要只分析第一张。
3. reference_roles 必须按输入顺序返回，每张图只能选择一个 role。
4. role 只能是 product、package、material、scene、style、other：
   - product = 商品主体，用于锁定外观、比例、颜色、结构和标识。
   - package = 包装清单，用于锁定包装、配件、套装和用户实际收到的物品。
   - material = 材质细节，用于锁定质感、纹理、表面、边缘和工艺。
   - scene = 使用场景，用于锁定环境、尺度、使用方式和生活化摆放。
   - style = 风格参考，用于锁定光线、构图、背景风格和商业摄影调性。
   - other = 仅在无法归类时使用。
5. note 用一句简体中文说明这张图最应该影响什么，便于后续生成提示词引用。
6. risks 写出不确定点，例如产品身份不清、包装缺失、参考图互相冲突或文字不可辨认。
7. 不要识别或编造真人身份、姓名、品牌、地点或图片中不存在的敏感信息。`;

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

export const REFERENCE_ORCHESTRATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "image_roles", "relationship", "prompts", "risks"],
  properties: {
    title: {
      type: "string",
      description: "本次参考图编排的短标题，使用简体中文。",
    },
    summary: {
      type: "string",
      description: "一句话说明识别出的组合关系和创作方向。",
    },
    image_roles: {
      type: "array",
      items: { type: "string" },
      description: "逐张说明参考图角色，例如图 1：女性主体、图 2：裤装。",
    },
    relationship: {
      type: "string",
      description: "参考图之间的关系判断，例如人物穿搭、主体融入背景、商品场景化。",
    },
    prompts: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "intent", "prompt"],
        properties: {
          title: {
            type: "string",
            description: "单条提示词标题。",
          },
          intent: {
            type: "string",
            description: "这条提示词的使用意图。",
          },
          prompt: {
            type: "string",
            description: "可直接用于图片生成的完整中文提示词。",
          },
        },
      },
      description: "1 到 3 条可应用到主提示词框的编排提示词。",
    },
    risks: {
      type: "array",
      items: { type: "string" },
      description: "不确定点、需要用户确认的关系或生成时需要规避的问题。",
    },
  },
};

export const CREATION_REFERENCE_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "reference_roles", "risks"],
  properties: {
    summary: {
      type: "string",
      description: "一句话概括本组套图参考图的商品信息、可用素材和主要限制。",
    },
    reference_roles: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "filename", "role", "note"],
        properties: {
          index: {
            type: "integer",
            minimum: 1,
            maximum: 6,
            description: "参考图输入序号，从 1 开始。",
          },
          filename: {
            type: "string",
            description: "对应参考图文件名。",
          },
          role: {
            type: "string",
            enum: ["product", "package", "material", "scene", "style", "other"],
            description: "推荐的套图参考用途。",
          },
          note: {
            type: "string",
            description: "这张参考图应该影响生成结果的重点说明，使用简体中文。",
          },
        },
      },
      description: "逐张参考图的用途建议，必须按输入顺序返回。",
    },
    risks: {
      type: "array",
      items: { type: "string" },
      description: "不确定点、需要用户确认的关系或生成时需要规避的问题。",
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

function normalizeImages({ image, images } = {}) {
  const list = Array.isArray(images) && images.length > 0 ? images : image ? [image] : [];
  if (list.length === 0) {
    throw new Error("请先上传一张图片。");
  }

  return list.map(normalizeImage);
}

function buildPromptAgentImageLabel({ filename, index, mode }) {
  const label =
    mode === CREATION_REFERENCE_ANALYSIS_MODE
      ? "套图参考图"
      : mode === REFERENCE_ORCHESTRATION_MODE
        ? "参考图"
        : "待分析图片";
  return `${label} ${index + 1}：${filename}。请按此序号分析这张图片的角色、内容和可融合元素。`;
}

function buildPromptAgentImageContent({ normalizedImages, mode }) {
  return normalizedImages.flatMap((normalized, index) => [
    {
      type: "input_text",
      text: buildPromptAgentImageLabel({
        filename: normalized.filename,
        index,
        mode,
      }),
    },
    {
      type: "input_image",
      image_url: `data:${normalized.mimeType};base64,${normalized.base64}`,
    },
  ]);
}

function getPromptAgentInstruction(mode) {
  if (mode === CREATION_REFERENCE_ANALYSIS_MODE) {
    return CREATION_REFERENCE_ANALYSIS_INSTRUCTION;
  }

  return mode === REFERENCE_ORCHESTRATION_MODE ? REFERENCE_ORCHESTRATION_INSTRUCTION : PROMPT_AGENT_INSTRUCTION;
}

function getPromptAgentSchema(mode) {
  if (mode === CREATION_REFERENCE_ANALYSIS_MODE) {
    return {
      name: "creation_reference_analysis_json",
      schema: CREATION_REFERENCE_ANALYSIS_JSON_SCHEMA,
    };
  }

  return mode === REFERENCE_ORCHESTRATION_MODE
    ? {
        name: "reference_orchestration_prompt_json",
        schema: REFERENCE_ORCHESTRATION_JSON_SCHEMA,
      }
    : {
        name: "image_prompt_json",
        schema: PROMPT_AGENT_JSON_SCHEMA,
      };
}

export function buildPromptAgentInput({ image, images, mode } = {}) {
  const normalizedImages = normalizeImages({ image, images });

  return [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: getPromptAgentInstruction(mode),
        },
        ...buildPromptAgentImageContent({ normalizedImages, mode }),
      ],
    },
  ];
}

export function createPromptAgentRequestBody({
  image,
  images,
  mode,
  responsesModel,
  reasoningEffort = DEFAULT_REASONING_EFFORT,
  structuredOutput = true,
}) {
  const body = {
    model: responsesModel,
    input: buildPromptAgentInput({ image, images, mode }),
    reasoning: {
      effort: reasoningEffort,
    },
    stream: true,
  };

  if (structuredOutput) {
    const format = getPromptAgentSchema(mode);
    body.text = {
      format: {
        type: "json_schema",
        name: format.name,
        strict: true,
        schema: format.schema,
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

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function normalizePromptOptions(value) {
  const prompts = Array.isArray(value.prompts)
    ? value.prompts
        .map((item, index) => {
          if (typeof item === "string") {
            const prompt = item.trim();
            return prompt
              ? {
                  title: `提示词 ${index + 1}`,
                  intent: "",
                  prompt,
                }
              : null;
          }

          if (!item || typeof item !== "object") {
            return null;
          }

          const prompt = String(item.prompt || "").trim();
          if (!prompt) {
            return null;
          }

          return {
            title: String(item.title || `提示词 ${index + 1}`).trim(),
            intent: String(item.intent || "").trim(),
            prompt,
          };
        })
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const singlePrompt = String(value.prompt || "").trim();
  if (prompts.length > 0) {
    return prompts;
  }

  return singlePrompt
    ? [
        {
          title: String(value.title || "图片提示词").trim(),
          intent: "",
          prompt: singlePrompt,
        },
      ]
    : [];
}

function normalizePromptAgentJson(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("模型返回的 JSON 不是对象。");
  }

  const prompts = normalizePromptOptions(value);
  const prompt = String(value.prompt || prompts[0]?.prompt || "").trim();
  const referenceRoles = Array.isArray(value.reference_roles) ? value.reference_roles : [];
  if (!prompt && referenceRoles.length === 0) {
    throw new Error("模型返回的 JSON 缺少 prompt 字段。");
  }

  return {
    title: String(value.title || "图片提示词").trim(),
    prompt,
    negative_prompt: String(value.negative_prompt || "").trim(),
    style_tags: normalizeStringArray(value.style_tags),
    subject: String(value.subject || "").trim(),
    scene: String(value.scene || "").trim(),
    composition: String(value.composition || "").trim(),
    lighting: String(value.lighting || "").trim(),
    color_palette: String(value.color_palette || "").trim(),
    camera: String(value.camera || "").trim(),
    aspect_ratio: String(value.aspect_ratio || "").trim(),
    notes: normalizeStringArray(value.notes),
    summary: String(value.summary || "").trim(),
    image_roles: normalizeStringArray(value.image_roles),
    reference_roles: referenceRoles,
    relationship: String(value.relationship || "").trim(),
    prompts,
    risks: normalizeStringArray(value.risks),
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
  images,
  mode,
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
        images,
        mode,
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
  images,
  mode,
  responsesModel,
  reasoningEffort = DEFAULT_REASONING_EFFORT,
  fetchImpl = fetch,
}) {
  try {
    return await sendPromptAgentRequest({
      baseUrl,
      apiKey,
      image,
      images,
      mode,
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
      images,
      mode,
      responsesModel,
      reasoningEffort,
      fetchImpl,
      structuredOutput: false,
    });
  }
}
