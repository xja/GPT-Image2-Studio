import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import JSZip from "jszip";
import pptxgen from "pptxgenjs";

import { buildPptTransitionXml, normalizePptMotionOptions } from "./ppt-motion-presets.mjs";

const WIDE_WIDTH = 13.333;
const WIDE_HEIGHT = 7.5;

function insertOrReplaceSlideTransition(slideXml, transitionXml) {
  const withoutTransition = String(slideXml || "").replace(/<p:transition\b[\s\S]*?<\/p:transition>/, "");
  if (!transitionXml) {
    return withoutTransition;
  }

  if (withoutTransition.includes("</p:clrMapOvr>")) {
    return withoutTransition.replace("</p:clrMapOvr>", `</p:clrMapOvr>${transitionXml}`);
  }

  if (withoutTransition.includes("</p:cSld>")) {
    return withoutTransition.replace("</p:cSld>", `</p:cSld>${transitionXml}`);
  }

  return withoutTransition.replace("</p:sld>", `${transitionXml}</p:sld>`);
}

async function applyPptxTransitions(outputPath, motion = {}) {
  const options = normalizePptMotionOptions(motion);
  if (options.transitionPreset === "none") {
    return;
  }

  const zip = await JSZip.loadAsync(await readFile(outputPath));
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((left, right) => Number(left.match(/slide(\d+)\.xml/)?.[1] || 0) - Number(right.match(/slide(\d+)\.xml/)?.[1] || 0));

  await Promise.all(
    slideFiles.map(async (slideFile, index) => {
      const current = await zip.file(slideFile).async("string");
      const transitionXml = buildPptTransitionXml({
        transitionPreset: options.transitionPreset,
        transitionSpeed: options.transitionSpeed,
        autoAdvanceSeconds: options.autoAdvanceSeconds,
        slideIndex: index,
      });
      zip.file(slideFile, insertOrReplaceSlideTransition(current, transitionXml));
    }),
  );

  await writeFile(outputPath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

export async function exportPptxDeck({ outputPath, title = "PPT 演示文稿", slides = [], motion = {} }) {
  if (!outputPath) {
    throw new Error("outputPath is required");
  }

  if (!Array.isArray(slides) || slides.length === 0) {
    throw new Error("slides is required");
  }

  await mkdir(dirname(outputPath), { recursive: true });

  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Image Studio";
  pptx.company = "Image Studio";
  pptx.subject = title;
  pptx.title = title;
  pptx.lang = "zh-CN";

  slides.forEach((slide, index) => {
    const pptSlide = pptx.addSlide();
    pptSlide.background = { color: "0B1020" };
    pptSlide.addImage({
      path: slide.imagePath,
      x: 0,
      y: 0,
      w: WIDE_WIDTH,
      h: WIDE_HEIGHT,
      altText: slide.title || `Slide ${index + 1}`,
    });
  });

  await pptx.writeFile({ fileName: outputPath });
  await applyPptxTransitions(outputPath, motion);
  return outputPath;
}
