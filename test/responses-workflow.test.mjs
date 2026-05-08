import test from "node:test";
import assert from "node:assert/strict";

import {
  buildResponsesInput,
  consumeResponsesSse,
  createResponsesRequestBody,
  requestImageGeneration,
} from "../lib/responses-workflow.mjs";

test("buildResponsesInput returns plain text for prompt-only generation", () => {
  const input = buildResponsesInput({
    prompt: "生成一张图",
  });

  assert.equal(input, "生成一张图");
});

test("buildResponsesInput returns multimodal user message with multiple reference images", () => {
  const input = buildResponsesInput({
    prompt: "给这些图统一换成夜景氛围",
    referenceImages: [
      {
        mimeType: "image/png",
        base64: "ZmFrZQ==",
        filename: "reference-a.png",
      },
      {
        mimeType: "image/jpeg",
        base64: "bW9yZQ==",
        filename: "reference-b.jpeg",
      },
    ],
  });

  assert.deepEqual(input, [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: "给这些图统一换成夜景氛围",
        },
        {
          type: "input_image",
          image_url: "data:image/png;base64,ZmFrZQ==",
        },
        {
          type: "input_image",
          image_url: "data:image/jpeg;base64,bW9yZQ==",
        },
      ],
    },
  ]);
});

test("buildResponsesInput can label reference images before each image", () => {
  const input = buildResponsesInput({
    prompt: "Transfer style from the second image to the first image.",
    referenceImageLabels: [
      "Reference image 1: SOURCE image. Preserve content only.",
      "Reference image 2: STYLE image. This is the style authority.",
    ],
    referenceImages: [
      {
        mimeType: "image/png",
        base64: "c291cmNl",
        filename: "source.png",
      },
      {
        mimeType: "image/jpeg",
        base64: "c3R5bGU=",
        filename: "style.jpeg",
      },
    ],
  });

  assert.deepEqual(input[0].content, [
    {
      type: "input_text",
      text: "Transfer style from the second image to the first image.",
    },
    {
      type: "input_text",
      text: "Reference image 1: SOURCE image. Preserve content only.",
    },
    {
      type: "input_image",
      image_url: "data:image/png;base64,c291cmNl",
    },
    {
      type: "input_text",
      text: "Reference image 2: STYLE image. This is the style authority.",
    },
    {
      type: "input_image",
      image_url: "data:image/jpeg;base64,c3R5bGU=",
    },
  ]);
});

test("createResponsesRequestBody keeps gpt-5.4 on the outer model and passes reasoning effort", () => {
  const requestBody = createResponsesRequestBody({
    prompt: "生成一张图",
    size: "1024x1536",
    quality: "high",
    format: "jpeg",
    responsesModel: "gpt-5.4",
    reasoningEffort: "high",
  });

  assert.equal(requestBody.model, "gpt-5.4");
  assert.equal(requestBody.reasoning.effort, "high");
  assert.equal(requestBody.stream, true);
  assert.deepEqual(requestBody.tool_choice, { type: "image_generation" });
  assert.equal(requestBody.tools[0].type, "image_generation");
  assert.equal(requestBody.tools[0].model, "gpt-image-2");
});

test("createResponsesRequestBody defaults to png output and leaves compression unset", () => {
  const requestBody = createResponsesRequestBody({
    prompt: "生成一张图",
    size: "1024x1536",
    quality: "high",
    responsesModel: "gpt-5.4",
  });

  assert.equal(requestBody.tools[0].output_format, "png");
  assert.equal("output_compression" in requestBody.tools[0], false);
});

test("createResponsesRequestBody can disable streaming for fallback requests", () => {
  const requestBody = createResponsesRequestBody({
    prompt: "生成一张图",
    size: "1024x1536",
    quality: "high",
    responsesModel: "gpt-5.4",
    stream: false,
  });

  assert.equal(requestBody.stream, false);
});

test("consumeResponsesSse emits partial and final events, and tolerates terminated stream after success", async () => {
  const chunks = [
    [
      "event: response.image_generation_call.partial_image",
      'data: {"partial_image_b64":"cGFydGlhbA=="}',
      "",
      "",
      "event: response.output_item.done",
      'data: {"item":{"type":"image_generation_call","result":"ZmluYWw="}}',
      "",
      "",
      "event: response.completed",
      'data: {"response":{"output":[{"type":"image_generation_call","result":"ZmluYWw="}]}}',
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
            throw new TypeError("terminated");
          }

          const chunk = chunks[index];
          index += 1;
          return {
            done: false,
            value: new TextEncoder().encode(chunk),
          };
        },
      };
    },
  };

  const seenEvents = [];
  const result = await consumeResponsesSse(fakeStream, {
    onEvent(event) {
      seenEvents.push(event.type);
    },
  });

  assert.deepEqual(seenEvents, ["partial_image", "final_image", "complete"]);
  assert.equal(result.finalImageBase64, "ZmluYWw=");
  assert.equal(result.partialImages.length, 1);
});

test("consumeResponsesSse extracts image_generation.completed b64_json final images", async () => {
  const chunks = [
    [
      "event: image_generation.completed",
      'data: {"type":"image_generation.completed","b64_json":"ZmluYWwtaW1hZ2U="}',
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

          const chunk = chunks[index];
          index += 1;
          return {
            done: false,
            value: new TextEncoder().encode(chunk),
          };
        },
      };
    },
  };

  const seenEvents = [];
  const result = await consumeResponsesSse(fakeStream, {
    onEvent(event) {
      seenEvents.push(event.type);
    },
  });

  assert.deepEqual(seenEvents, ["final_image", "complete"]);
  assert.equal(result.finalImageBase64, "ZmluYWwtaW1hZ2U=");
});

test("consumeResponsesSse processes final image events left in the EOF buffer", async () => {
  const chunks = [
    [
      "event: response.output_item.done",
      'data: {"item":{"type":"image_generation_call","result":"ZW9mLWZpbmFs"}}',
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

          const chunk = chunks[index];
          index += 1;
          return {
            done: false,
            value: new TextEncoder().encode(chunk),
          };
        },
      };
    },
  };

  const result = await consumeResponsesSse(fakeStream);

  assert.equal(result.finalImageBase64, "ZW9mLWZpbmFs");
});

test("consumeResponsesSse surfaces response.failed messages instead of returning empty images", async () => {
  const chunks = [
    [
      "event: response.failed",
      'data: {"type":"response.failed","response":{"error":{"code":"rate_limit_exceeded","message":"Too many image requests"}}}',
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

          const chunk = chunks[index];
          index += 1;
          return {
            done: false,
            value: new TextEncoder().encode(chunk),
          };
        },
      };
    },
  };

  await assert.rejects(() => consumeResponsesSse(fakeStream), {
    message: "上游生成失败：rate_limit_exceeded Too many image requests",
  });
});

test("requestImageGeneration falls back to non-streaming when SSE completes without final image", async () => {
  const requests = [];
  const chunks = [
    [
      "event: response.image_generation_call.completed",
      'data: {"type":"response.image_generation_call.completed","item_id":"ig_1","output_index":0}',
      "",
      "",
      "event: response.completed",
      'data: {"type":"response.completed","response":{"output":[]}}',
      "",
      "",
      "data: [DONE]",
      "",
      "",
    ].join("\n"),
  ];

  const result = await requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "生成一张图",
    size: "1024x1536",
    quality: "high",
    responsesModel: "gpt-5.4",
    async fetchImpl(_url, init) {
      const body = JSON.parse(init.body);
      requests.push(body);

      if (requests.length === 1) {
        return new Response(chunks.join(""), {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
          },
        });
      }

      return new Response(
        JSON.stringify({
          output: [{ type: "image_generation_call", result: "ZmFsbGJhY2stZmluYWw=" }],
        }),
        { status: 200 },
      );
    },
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].stream, true);
  assert.equal(requests[1].stream, false);
  assert.equal(result.finalImageBase64, "ZmFsbGJhY2stZmluYWw=");
  assert.equal(result.fallbackUsed, true);
});

test("requestImageGeneration falls back to non-streaming when streaming is blocked upstream", async () => {
  const requests = [];

  const result = await requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Create a poster image",
    size: "1024x1536",
    quality: "high",
    responsesModel: "gpt-5.4",
    async fetchImpl(_url, init) {
      const body = JSON.parse(init.body);
      requests.push(body);

      if (requests.length === 1) {
        return new Response(
          JSON.stringify({
            error: {
              code: "stream_forbidden",
              message: "Streaming requests are forbidden from this edge.",
            },
          }),
          { status: 403 },
        );
      }

      return new Response(
        JSON.stringify({
          output: [{ type: "image_generation_call", result: "bm9uc3RyZWFtLWZpbmFs" }],
        }),
        { status: 200 },
      );
    },
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].stream, true);
  assert.equal(requests[1].stream, false);
  assert.equal(result.finalImageBase64, "bm9uc3RyZWFtLWZpbmFs");
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.streamFallbackUsed, true);
});

test("requestImageGeneration emits keepalive status while waiting for upstream headers", async () => {
  const events = [];

  const result = await requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Create a slow image",
    size: "1024x1536",
    quality: "high",
    responsesModel: "gpt-5.4",
    statusHeartbeatMs: 1,
    async fetchImpl() {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return new Response(
        [
          "event: response.output_item.done",
          'data: {"item":{"type":"image_generation_call","result":"a2VlcGFsaXZlLWZpbmFs"}}',
          "",
          "data: [DONE]",
          "",
        ].join("\n"),
        {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        },
      );
    },
    onEvent(event) {
      events.push(event);
    },
  });

  assert.equal(result.finalImageBase64, "a2VlcGFsaXZlLWZpbmFs");
  assert.ok(
    events.some((event) => event.type === "status" && event.stage === "waiting_upstream"),
    "expected a waiting_upstream keepalive status event",
  );
});

test("requestImageGeneration emits keepalive status while waiting for final stream events", async () => {
  const events = [];
  const encoder = new TextEncoder();

  const result = await requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Create a slow streamed image",
    size: "1024x1536",
    quality: "high",
    responsesModel: "gpt-5.4",
    statusHeartbeatMs: 1,
    async fetchImpl() {
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                [
                  "event: response.image_generation_call.partial_image",
                  'data: {"partial_image_b64":"cGFydGlhbC1zdHJlYW0="}',
                  "",
                  "",
                ].join("\n"),
              ),
            );
            setTimeout(() => {
              controller.enqueue(
                encoder.encode(
                  [
                    "event: response.output_item.done",
                    'data: {"item":{"type":"image_generation_call","result":"ZmluYWwtc3RyZWFt"}}',
                    "",
                    "data: [DONE]",
                    "",
                    "",
                  ].join("\n"),
                ),
              );
              controller.close();
            }, 5);
          },
        }),
        {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        },
      );
    },
    onEvent(event) {
      events.push(event);
    },
  });

  assert.equal(result.finalImageBase64, "ZmluYWwtc3RyZWFt");
  assert.ok(
    events.some((event) => event.type === "status" && event.stage === "waiting_final"),
    "expected a waiting_final keepalive status event",
  );
});

test("requestImageGeneration retries without streaming when the stream ends after a partial preview", async () => {
  const events = [];
  const requests = [];
  const encoder = new TextEncoder();

  const result = await requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Create a streamed image that may disconnect",
    size: "1024x1536",
    quality: "high",
    responsesModel: "gpt-5.4",
    async fetchImpl(_url, init) {
      const body = JSON.parse(init.body);
      requests.push(body);

      if (requests.length === 1) {
        return new Response(
          new ReadableStream({
            pull(controller) {
              if (this.sentPartial) {
                controller.error(new Error("socket terminated"));
                return;
              }

              this.sentPartial = true;
              controller.enqueue(
                encoder.encode(
                  [
                    "event: response.image_generation_call.partial_image",
                    'data: {"partial_image_b64":"cGFydGlhbC1iZWZvcmUtZXJyb3I="}',
                    "",
                    "",
                  ].join("\n"),
                ),
              );
            },
          }),
          {
            status: 200,
            headers: { "content-type": "text/event-stream" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          output: [{ type: "image_generation_call", result: "bm9uc3RyZWFtLWFmdGVyLWVycm9y" }],
        }),
        { status: 200 },
      );
    },
    onEvent(event) {
      events.push(event);
    },
  });

  assert.deepEqual(requests.map((request) => request.stream), [true, false]);
  assert.equal(result.finalImageBase64, "bm9uc3RyZWFtLWFmdGVyLWVycm9y");
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.streamFallbackUsed, true);
  assert.ok(events.some((event) => event.type === "partial_image"));
});

test("requestImageGeneration returns compact upstream HTTP errors", async () => {
  await assert.rejects(
    () =>
      requestImageGeneration({
        baseUrl: "https://example.test/v1",
        apiKey: "test-key",
        prompt: "生成一张图",
        size: "1024x1536",
        quality: "high",
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
      message: "生成请求失败：HTTP 524，错误码 524",
    },
  );
});

test("requestImageGeneration retries invalid custom image sizes with a compatible size", async () => {
  const requests = [];

  const result = await requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Create an image of the major event poster",
    size: "1536x864",
    quality: "high",
    responsesModel: "gpt-5.4",
    async fetchImpl(_url, init) {
      const body = JSON.parse(init.body);
      requests.push(body.tools[0].size);

      if (requests.length === 1) {
        return new Response(
          JSON.stringify({
            error: {
              message: "Invalid value: '1536x864'. Supported values are: '1024x1024', '1536x1024', '1024x1536', and 'auto'.",
              code: "invalid_value",
              param: "tools[0].size",
            },
          }),
          { status: 400 },
        );
      }

      return new Response(
        [
          "event: response.output_item.done",
          'data: {"item":{"type":"image_generation_call","result":"ZmFsbGJhY2s="}}',
          "",
          "data: [DONE]",
          "",
        ].join("\n"),
        {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        },
      );
    },
  });

  assert.deepEqual(requests, ["1536x864", "1536x1024"]);
  assert.equal(result.finalImageBase64, "ZmFsbGJhY2s=");
  assert.equal(result.sizeFallbackUsed, true);
  assert.equal(result.effectiveSize, "1536x1024");
});
