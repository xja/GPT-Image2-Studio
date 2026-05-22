import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  REFERENCE_ORCHESTRATION_JSON_SCHEMA,
  buildPromptAgentInput,
  consumePromptAgentSse,
  createPromptAgentRequestBody,
  extractPromptAgentJson,
  requestPromptAgentAnalysis,
} from "../lib/prompt-agent.mjs";
import { createPromptAgentStore } from "../lib/prompt-agent-store.mjs";

test("prompt agent request analyzes an uploaded image without invoking image generation", () => {
  const image = {
    filename: "sample.png",
    mimeType: "image/png",
    base64: "ZmFrZQ==",
  };

  const input = buildPromptAgentInput({ image });
  const requestBody = createPromptAgentRequestBody({
    image,
    responsesModel: "gpt-5.4",
    reasoningEffort: "high",
  });

  assert.equal(input[0].role, "user");
  assert.equal(input[0].content[0].type, "input_text");
  assert.match(input[0].content[0].text, /JSON/);
  assert.match(input[0].content[0].text, /反推|逆向|复刻/);
  assert.deepEqual(input[0].content[1], {
    type: "input_text",
    text: "待分析图片 1：sample.png。请按此序号分析这张图片的角色、内容和可融合元素。",
  });
  assert.deepEqual(input[0].content[2], {
    type: "input_image",
    image_url: "data:image/png;base64,ZmFrZQ==",
  });
  assert.equal(requestBody.model, "gpt-5.4");
  assert.equal(requestBody.reasoning.effort, "high");
  assert.equal(requestBody.stream, true);
  assert.equal("tools" in requestBody, false);
  assert.equal("tool_choice" in requestBody, false);
  assert.equal(requestBody.text.format.type, "json_schema");
  assert.equal(requestBody.text.format.name, "image_prompt_json");
  assert.equal(requestBody.text.format.strict, true);
  assert.ok(requestBody.text.format.schema.required.includes("prompt"));
});

test("prompt agent request can orchestrate multiple reference images into scene prompts", () => {
  const images = [
    {
      filename: "person.png",
      mimeType: "image/png",
      base64: "cGVyc29u",
    },
    {
      filename: "pants.png",
      mimeType: "image/png",
      base64: "cGFudHM=",
    },
  ];

  const input = buildPromptAgentInput({
    images,
    mode: "reference-orchestration",
  });
  const requestBody = createPromptAgentRequestBody({
    images,
    mode: "reference-orchestration",
    responsesModel: "gpt-5.4",
    reasoningEffort: "high",
  });

  assert.match(input[0].content[0].text, /参考图编排/);
  assert.match(input[0].content[0].text, /1\s*到\s*3|1-3/);
  assert.match(input[0].content[0].text, /人物.*服装|主体.*背景|关系/);
  assert.deepEqual(input[0].content.slice(1), [
    {
      type: "input_text",
      text: "参考图 1：person.png。请按此序号分析这张图片的角色、内容和可融合元素。",
    },
    {
      type: "input_image",
      image_url: "data:image/png;base64,cGVyc29u",
    },
    {
      type: "input_text",
      text: "参考图 2：pants.png。请按此序号分析这张图片的角色、内容和可融合元素。",
    },
    {
      type: "input_image",
      image_url: "data:image/png;base64,cGFudHM=",
    },
  ]);
  assert.equal(requestBody.text.format.name, "reference_orchestration_prompt_json");
  assert.equal("tools" in requestBody, false);
  assert.ok(requestBody.text.format.schema.required.includes("prompts"));
});

test("reference orchestration analysis can request English output prompts", () => {
  const images = [
    {
      filename: "product.png",
      mimeType: "image/png",
      base64: "cHJvZHVjdA==",
    },
  ];

  const input = buildPromptAgentInput({
    images,
    mode: "reference-orchestration",
    targetLanguage: "en",
    targetLanguageLabel: "English",
  });
  const requestBody = createPromptAgentRequestBody({
    images,
    mode: "reference-orchestration",
    targetLanguage: "en",
    targetLanguageLabel: "English",
    responsesModel: "gpt-5.4",
  });

  assert.match(input[0].content[0].text, /Target output language: English/);
  assert.match(input[0].content[0].text, /All generated scene prompts must be written in English/);
  assert.match(requestBody.input[0].content[0].text, /All visible text, headings, labels, callouts, annotations, and short copy must use English/);
});

test("reference orchestration schema does not hard-code Chinese output language", () => {
  const titleDescription = REFERENCE_ORCHESTRATION_JSON_SCHEMA.properties.title.description;
  const promptDescription = REFERENCE_ORCHESTRATION_JSON_SCHEMA.properties.prompts.items.properties.prompt.description;
  const schemaText = JSON.stringify(REFERENCE_ORCHESTRATION_JSON_SCHEMA);

  assert.match(titleDescription, /目标语言/);
  assert.match(promptDescription, /目标语言/);
  assert.doesNotMatch(schemaText, /完整中文提示词|使用简体中文/);
});

test("prompt agent request can identify ecommerce creation reference roles", () => {
  const images = [
    {
      filename: "front.png",
      mimeType: "image/png",
      base64: "ZnJvbnQ=",
    },
    {
      filename: "texture.png",
      mimeType: "image/png",
      base64: "dGV4dHVyZQ==",
    },
  ];

  const input = buildPromptAgentInput({
    images,
    mode: "creation-reference-analysis",
  });
  const requestBody = createPromptAgentRequestBody({
    images,
    mode: "creation-reference-analysis",
    responsesModel: "gpt-5.4",
    reasoningEffort: "high",
  });

  assert.match(input[0].content[0].text, /套图参考图识别/);
  assert.match(input[0].content[0].text, /1 到 9 张电商套图参考图/);
  assert.match(input[0].content[0].text, /商品主体|包装清单|材质细节/);
  assert.match(input[0].content[0].text, /四级类目/);
  assert.deepEqual(input[0].content.slice(1), [
    {
      type: "input_text",
      text: "套图参考图 1：front.png。请按此序号分析这张图片的角色、内容和可融合元素。",
    },
    {
      type: "input_image",
      image_url: "data:image/png;base64,ZnJvbnQ=",
    },
    {
      type: "input_text",
      text: "套图参考图 2：texture.png。请按此序号分析这张图片的角色、内容和可融合元素。",
    },
    {
      type: "input_image",
      image_url: "data:image/png;base64,dGV4dHVyZQ==",
    },
  ]);
  assert.equal(requestBody.text.format.name, "creation_reference_analysis_json");
  assert.ok(requestBody.text.format.schema.required.includes("reference_roles"));
  assert.ok(requestBody.text.format.schema.required.includes("sku_subjects"));
  assert.ok(requestBody.text.format.schema.required.includes("category_hint"));
  assert.equal(requestBody.text.format.schema.properties.sku_subjects.maxItems, 9);
  assert.match(input[0].content[0].text, /SKU/);
});

test("prompt agent normalizes creation reference category hints", () => {
  const result = extractPromptAgentJson({
    output: [
      {
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              summary: "识别到手机正面和屏幕细节。",
              category_hint: "智能手机",
              category_path: "数码电子 > 手机通讯 > 手机 > 智能手机",
              reference_roles: [{ index: 1, filename: "phone.png", role: "product", note: "手机主体。" }],
              risks: [],
            }),
          },
        ],
      },
    ],
  });

  assert.equal(result.category_hint, "智能手机");
  assert.equal(result.category_path, "数码电子 > 手机通讯 > 手机 > 智能手机");
});

test("prompt agent normalizes creation SKU subject groups", () => {
  const result = extractPromptAgentJson({
    output: [
      {
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              summary: "Three white-background product references and one accessory reference.",
              category_hint: "Fishing lure",
              category_path: "Sports > Fishing > Lures > Hard bait",
              reference_roles: [
                { index: 1, filename: "blue.png", role: "product", note: "Blue SKU." },
                { index: 2, filename: "green.png", role: "product", note: "Green SKU." },
                { index: 3, filename: "red.png", role: "product", note: "Red SKU." },
                { index: 4, filename: "hooks.png", role: "package", note: "Accessory pack." },
              ],
              sku_subjects: [
                { id: "blue", title: "Blue lure", reference_indexes: [1], filenames: ["blue.png"], note: "Blue sellable subject." },
                { id: "green", title: "Green lure", reference_indexes: [2], filenames: ["green.png"], note: "Green sellable subject." },
                { id: "red", title: "Red lure", reference_indexes: [3], filenames: ["red.png"], note: "Red sellable subject." },
              ],
              risks: ["Accessory image is not a distinct SKU subject."],
            }),
          },
        ],
      },
    ],
  });

  assert.deepEqual(
    result.sku_subjects.map((subject) => [subject.id, subject.filenames, subject.reference_indexes]),
    [
      ["blue", ["blue.png"], [1]],
      ["green", ["green.png"], [2]],
      ["red", ["red.png"], [3]],
    ],
  );
});

test("prompt agent labels every reference image so the model can compare all images", () => {
  const images = [
    {
      filename: "kitchen-scene.png",
      mimeType: "image/png",
      base64: "a2l0Y2hlbg==",
    },
    {
      filename: "zip-hoodie.jpg",
      mimeType: "image/jpeg",
      base64: "aG9vZGll",
    },
  ];

  const input = buildPromptAgentInput({
    images,
    mode: "reference-orchestration",
  });

  assert.match(input[0].content[0].text, /覆盖所有参考图/);
  assert.match(input[0].content[0].text, /不要只分析第一张/);
  assert.deepEqual(input[0].content.slice(1), [
    {
      type: "input_text",
      text: "参考图 1：kitchen-scene.png。请按此序号分析这张图片的角色、内容和可融合元素。",
    },
    {
      type: "input_image",
      image_url: "data:image/png;base64,a2l0Y2hlbg==",
    },
    {
      type: "input_text",
      text: "参考图 2：zip-hoodie.jpg。请按此序号分析这张图片的角色、内容和可融合元素。",
    },
    {
      type: "input_image",
      image_url: "data:image/jpeg;base64,aG9vZGll",
    },
  ]);
});

test("prompt agent normalizes reference orchestration output to one to three prompts", () => {
  const result = extractPromptAgentJson({
    output: [
      {
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              title: "穿搭街拍编排",
              summary: "识别为女性主体与裤装参考图的穿搭关系。",
              image_roles: ["图 1：女性主体", "图 2：裤装"],
              relationship: "人物穿搭",
              prompts: [
                {
                  title: "通勤街拍",
                  intent: "让女性主体穿上参考裤装并置于城市街头。",
                  prompt: "让参考女性主体穿上参考裤装，站在城市街头，自然侧身回望，柔和日光，时尚街拍质感。",
                },
                {
                  title: "室内 Lookbook",
                  intent: "强调裤装版型与人物姿态。",
                  prompt: "让参考女性主体穿上参考裤装，在简洁摄影棚中站姿展示，干净背景，柔和棚拍光。",
                },
                {
                  title: "咖啡店场景",
                  intent: "将穿搭放入生活化环境。",
                  prompt: "让参考女性主体穿上参考裤装，坐在咖啡店窗边，轻松自然姿态，午后暖光。",
                },
                {
                  title: "多余结果",
                  intent: "不应保留第四条。",
                  prompt: "这条不应该被保留。",
                },
              ],
              risks: ["服装尺码需要生成模型自行适配"],
            }),
          },
        ],
      },
    ],
  });

  assert.equal(result.prompt, "让参考女性主体穿上参考裤装，站在城市街头，自然侧身回望，柔和日光，时尚街拍质感。");
  assert.equal(result.prompts.length, 3);
  assert.deepEqual(result.image_roles, ["图 1：女性主体", "图 2：裤装"]);
  assert.equal(result.relationship, "人物穿搭");
});

test("prompt agent can parse streamed Responses text into JSON prompt data", async () => {
  const chunks = [
    [
      "event: response.output_text.delta",
      'data: {"type":"response.output_text.delta","delta":"{\\"title\\":\\"街头快照\\",\\"prompt\\":\\""}',
      "",
      "",
      "event: response.output_text.delta",
      'data: {"type":"response.output_text.delta","delta":"复古 CCD 街头快照\\",\\"negative_prompt\\":\\"低清晰度\\",\\"style_tags\\":[\\"ccd\\"],\\"subject\\":\\"人物\\",\\"scene\\":\\"街头\\",\\"composition\\":\\"半身构图\\",\\"lighting\\":\\"直闪\\",\\"color_palette\\":\\"低饱和\\",\\"camera\\":\\"CCD\\",\\"aspect_ratio\\":\\"4:5\\",\\"notes\\":[\\"保留抓拍感\\"]}"}',
      "",
      "",
      "event: response.completed",
      'data: {"type":"response.completed"}',
      "",
      "",
      "data: [DONE]",
      "",
      "",
    ].join("\n"),
  ];
  let index = 0;
  const fakeStream = {
    getReader() {
      return {
        async read() {
          if (index >= chunks.length) {
            return { done: true };
          }

          const value = new TextEncoder().encode(chunks[index]);
          index += 1;
          return { done: false, value };
        },
      };
    },
  };

  const result = await consumePromptAgentSse(fakeStream);

  assert.equal(result.title, "街头快照");
  assert.equal(result.prompt, "复古 CCD 街头快照");
  assert.deepEqual(result.notes, ["保留抓拍感"]);
});

test("prompt agent retries without structured output when provider rejects strict JSON schema", async () => {
  const calls = [];
  const sseBody = [
    "event: response.output_text.done",
    `data: {"type":"response.output_text.done","text":${JSON.stringify(
      JSON.stringify({
        title: "产品图",
        prompt: "白底产品摄影，柔光棚拍，高级商业质感",
        negative_prompt: "模糊，畸变",
        style_tags: ["product"],
        subject: "产品",
        scene: "白底影棚",
        composition: "居中构图",
        lighting: "柔和棚拍光",
        color_palette: "白色与浅灰",
        camera: "微距商业摄影",
        aspect_ratio: "1:1",
        notes: ["保留干净背景"],
      }),
    )}}`,
    "",
    "",
    "data: [DONE]",
    "",
    "",
  ].join("\n");

  const result = await requestPromptAgentAnalysis({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    image: {
      filename: "product.png",
      mimeType: "image/png",
      base64: "ZmFrZQ==",
    },
    responsesModel: "gpt-5.4",
    async fetchImpl(url, options) {
      calls.push({
        url,
        body: JSON.parse(options.body),
      });

      if (calls.length === 1) {
        return new Response("Unknown parameter: text.format", { status: 400 });
      }

      return new Response(sseBody, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
        },
      });
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.stream, true);
  assert.equal(calls[0].body.text.format.type, "json_schema");
  assert.equal(calls[1].body.stream, true);
  assert.equal("text" in calls[1].body, false);
  assert.equal(result.prompt, "白底产品摄影，柔光棚拍，高级商业质感");
});

test("prompt agent returns compact upstream HTTP errors", async () => {
  await assert.rejects(
    () =>
      requestPromptAgentAnalysis({
        baseUrl: "https://example.test/v1",
        apiKey: "test-key",
        image: {
          filename: "timeout.png",
          mimeType: "image/png",
          base64: "ZmFrZQ==",
        },
        responsesModel: "gpt-5.4",
        async fetchImpl() {
          return new Response(
            JSON.stringify({
              type: "https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/",
              detail: "The origin web server did not respond within the timeout window.",
              error_code: 524,
            }),
            { status: 524 },
          );
        },
      }),
    {
      message: "图片分析请求失败：HTTP 524，错误码 524",
    },
  );
});

test("prompt agent extracts JSON prompt data from Responses output text", () => {
  const payload = {
    output: [
      {
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              title: "霓虹街景",
              prompt: "赛博朋克街道，雨夜霓虹，电影感构图",
              negative_prompt: "低清晰度，畸变",
              style_tags: ["cinematic", "neon"],
              subject: "街道行人",
              scene: "雨夜城市",
              composition: "低机位广角",
              lighting: "霓虹反射光",
              color_palette: "蓝紫与品红",
              camera: "35mm wide angle",
              aspect_ratio: "16:9",
              notes: ["保留湿润路面反光"],
            }),
          },
        ],
      },
    ],
  };

  const result = extractPromptAgentJson(payload);

  assert.equal(result.title, "霓虹街景");
  assert.equal(result.prompt, "赛博朋克街道，雨夜霓虹，电影感构图");
  assert.deepEqual(result.style_tags, ["cinematic", "neon"]);
});

test("prompt agent store keeps JSON analysis history across reads", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "prompt-agent-store-"));

  try {
    const store = createPromptAgentStore({ rootDir });
    const first = await store.append({
      id: "prompt-json-1",
      createdAt: "2026-04-28T08:00:00.000Z",
      filename: "sample.png",
      json: {
        title: "产品图",
        prompt: "白底商业产品摄影，柔和棚拍光",
      },
      responsesModel: "gpt-5.4",
      reasoningEffort: "high",
    });

    const reloaded = createPromptAgentStore({ rootDir });
    const history = await reloaded.list();

    assert.equal(first.id, "prompt-json-1");
    assert.equal(history.length, 1);
    assert.equal(history[0].json.prompt, "白底商业产品摄影，柔和棚拍光");
    assert.equal(history[0].filename, "sample.png");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
