import test from "node:test";
import assert from "node:assert/strict";

import {
  buildResponsesInput,
  consumeResponsesSse,
  createResponsesRequestBody,
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
