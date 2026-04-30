import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import JSZip from "jszip";

import { normalizePptOutline, validatePptSourceInput } from "../lib/ppt-deck-workflow.mjs";
import { buildSlideEditPrompt, buildSlideImagePrompts } from "../lib/ppt-slide-prompts.mjs";
import { PPT_STYLE_PRESETS, normalizePptStylePreset } from "../lib/ppt-style-presets.mjs";
import {
  PPT_DYNAMIC_COMPONENT_PRESETS,
  PPT_TRANSITION_PRESETS,
  normalizePptDynamicComponentPreset,
  normalizePptTransitionPreset,
} from "../lib/ppt-motion-presets.mjs";
import { createPptDeckStore } from "../lib/ppt-deck-store.mjs";
import { exportPptxDeck } from "../lib/ppt-export.mjs";

const png1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

test("PPT outline validation requires input and exact requested page count", () => {
  assert.throws(() => validatePptSourceInput({ sourceFiles: [], sourceText: "", topic: "" }), /至少选择/);

  const normalized = normalizePptOutline(
    {
      title: "年度复盘",
      slides: [
        { title: "开场", keyMessage: "目标", visualBrief: "深色封面", speakerNotes: "介绍目标" },
        { slideNumber: 8, title: "数据", keyMessage: "增长", visualBrief: "图表", speakerNotes: "" },
      ],
    },
    2,
  );

  assert.equal(normalized.title, "年度复盘");
  assert.deepEqual(normalized.slides.map((slide) => slide.slideNumber), [1, 2]);
  assert.throws(() => normalizePptOutline({ title: "错页", slides: [{ title: "一页" }] }, 2), /页数不匹配/);
});

test("PPT slide prompts include outline content, visual guidance, 16:9 and readable Chinese text constraints", () => {
  const prompts = buildSlideImagePrompts({
    outline: {
      title: "课程发布",
      slides: [{ slideNumber: 1, title: "课程亮点", keyMessage: "让学习更高效", visualBrief: "教育培训风格" }],
    },
    theme: "教育培训",
  });

  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].slideNumber, 1);
  assert.match(prompts[0].prompt, /16:9/);
  assert.match(prompts[0].prompt, /课程亮点/);
  assert.match(prompts[0].prompt, /中文文字必须清晰可读/);
  assert.match(prompts[0].prompt, /教育培训/);
});

test("PPT slide prompts can include advanced dynamic visual component guidance", () => {
  const prompts = buildSlideImagePrompts({
    outline: {
      title: "增长发布",
      slides: [{ slideNumber: 1, title: "增长路径", keyMessage: "从线索到复购", visualBrief: "路径图" }],
    },
    theme: "tech",
    dynamicPreset: "storyline",
  });

  assert.equal(prompts.length, 1);
  assert.match(prompts[0].prompt, /高级动态组件/);
  assert.match(prompts[0].prompt, /路径叙事/);
  assert.match(prompts[0].prompt, /16:9/);
});

test("PPT style presets expose a broad set of selectable visual styles", () => {
  assert.ok(PPT_STYLE_PRESETS.length >= 10);
  assert.ok(PPT_STYLE_PRESETS.some((preset) => preset.value === "tech"));
  assert.ok(PPT_STYLE_PRESETS.some((preset) => preset.value === "finance"));
  assert.equal(normalizePptStylePreset("unknown").value, "business");
  assert.equal(normalizePptStylePreset("luxury").label, "高端品牌");
});

test("PPT motion presets expose dynamic component and transition choices", () => {
  assert.ok(PPT_DYNAMIC_COMPONENT_PRESETS.length >= 6);
  assert.ok(PPT_DYNAMIC_COMPONENT_PRESETS.some((preset) => preset.value === "data-pulse"));
  assert.equal(normalizePptDynamicComponentPreset("unknown").value, "smart");

  assert.ok(PPT_TRANSITION_PRESETS.length >= 6);
  assert.ok(PPT_TRANSITION_PRESETS.some((preset) => preset.value === "morph-flow"));
  assert.equal(normalizePptTransitionPreset("unknown").value, "fade");
});

test("PPT slide edit prompts use the original slide, annotation and user instruction", () => {
  const prompt = buildSlideEditPrompt({
    outline: {
      title: "课程发布",
      slides: [{ slideNumber: 2, title: "课程亮点", keyMessage: "让学习更高效", visualBrief: "教育培训风格" }],
    },
    slideNumber: 2,
    theme: "tech",
    editInstruction: "把左侧标题改得更醒目，删除红圈里的图标。",
    dynamicPreset: "spotlight",
  });

  assert.match(prompt, /重新生成第 2 页/);
  assert.match(prompt, /课程亮点/);
  assert.match(prompt, /标注图/);
  assert.match(prompt, /把左侧标题改得更醒目/);
  assert.match(prompt, /演讲聚焦/);
  assert.match(prompt, /16:9/);
});

test("PPTX export writes a non-empty file with full-slide images", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ppt-export-"));
  const imagePath = join(dir, "slide.png");
  const outputPath = join(dir, "deck.pptx");
  await writeFile(imagePath, png1x1);

  await exportPptxDeck({
    outputPath,
    title: "测试演示",
    slides: [
      { title: "第一页", imagePath },
      { title: "第二页", imagePath },
    ],
  });

  const fileStat = await stat(outputPath);
  assert.ok(fileStat.size > 1000);
});

test("PPTX export can embed slide transition timing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ppt-transition-"));
  const imagePath = join(dir, "slide.png");
  const outputPath = join(dir, "deck.pptx");
  await writeFile(imagePath, png1x1);

  await exportPptxDeck({
    outputPath,
    title: "转场测试",
    motion: {
      transitionPreset: "fade",
      transitionSpeed: "fast",
      autoAdvanceSeconds: 3.5,
    },
    slides: [
      { title: "第一页", imagePath },
      { title: "第二页", imagePath },
    ],
  });

  const zip = await JSZip.loadAsync(await readFile(outputPath));
  const slideXml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert.match(slideXml, /<p:transition[^>]*spd="fast"[^>]*advClick="1"[^>]*advTm="3500"/);
  assert.match(slideXml, /<p:fade\/>/);
});

test("PPT deck store writes manifests, reads newest first, and keeps output download URLs", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "ppt-store-"));
  const store = createPptDeckStore({ outputDir, publicBasePath: "/output" });

  await store.saveManifest({
    deckId: "deck-old",
    title: "旧演示",
    pageCount: 1,
    createdAt: "2026-04-28T00:00:00.000Z",
    slides: [],
    pptxRelativePath: "2026-04-28/old.pptx",
    pptxFilename: "old.pptx",
  });
  await store.saveManifest({
    deckId: "deck-new",
    title: "新演示",
    pageCount: 1,
    createdAt: "2026-04-30T00:00:00.000Z",
    slides: [],
    pptxRelativePath: "2026-04-30/new.pptx",
    pptxFilename: "new.pptx",
  });

  const decks = await store.listManifests();
  assert.deepEqual(decks.map((deck) => deck.deckId), ["deck-new", "deck-old"]);
  assert.equal(decks[0].pptxUrl, "/output/2026-04-30/new.pptx");

  const raw = await readFile(join(outputDir, "json", "ppt-decks", "deck-new.json"), "utf8");
  assert.match(raw, /新演示/);
});
