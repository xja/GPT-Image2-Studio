import test from "node:test";
import assert from "node:assert/strict";

import {
  buildParameterText,
  formatImageModelLabel,
  formatRecentOutputMeta,
} from "../lib/studio-formatters.mjs";

test("formatImageModelLabel normalizes gpt-image-2 into a UI label", () => {
  assert.equal(formatImageModelLabel("gpt-image-2"), "GPT Image 2.0");
  assert.equal(formatImageModelLabel("custom-model"), "custom-model");
  assert.equal(formatImageModelLabel(""), "GPT Image 2.0");
});

test("buildParameterText includes reasoning effort and multiple reference image names", () => {
  const result = buildParameterText(
    {
      ratioLabel: "标准 4:5",
      size: "1024x1280",
      format: "jpeg",
      quality: "high",
      imageModel: "gpt-image-2",
      responsesModel: "gpt-5.4",
      reasoningEffort: "xhigh",
      hasReferenceImage: true,
      referenceImageNames: ["girl-a.jpeg", "girl-b.jpeg"],
      baseUrl: "https://api.openai.com/v1",
      absolutePath: "C:/output/demo.jpeg",
      generationDurationMs: 1234,
    },
    {},
  );

  assert.match(result, /比例：标准 4:5/);
  assert.match(result, /画布：1024x1280/);
  assert.match(result, /图像模型：GPT Image 2.0/);
  assert.match(result, /推理强度：超高/);
  assert.match(result, /图片生成耗时：1\.2 秒/);
  assert.match(result, /参考图：girl-a\.jpeg, girl-b\.jpeg/);
  assert.match(result, /中转：https:\/\/api\.openai\.com\/v1/);
  assert.match(result, /本地文件：C:\/output\/demo\.jpeg/);
});

test("formatRecentOutputMeta composes canvas and model summary", () => {
  const result = formatRecentOutputMeta({
    size: "1024 x 1280",
    imageModel: "gpt-image-2",
  });

  assert.equal(result, "1024 x 1280 | GPT Image 2.0");
});
