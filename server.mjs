import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { homedir, tmpdir } from "node:os";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import { createConfigStore } from "./lib/config-store.mjs";
import {
  appendRatioHintToPrompt,
  getAspectRatioOptions,
  resolveAspectRatioOption,
} from "./lib/aspect-ratios.mjs";
import {
  getDefaultGenerationSize,
  normalizeGenerationSize,
} from "./lib/generation-size-options.mjs";
import {
  normalizeOutputFormat,
  toApiOutputFormat,
  toOutputFormatMimeType,
} from "./lib/output-format-options.mjs";
import {
  createTimestampedFilename,
  buildPublicAssetUrl,
  deleteGeneratedAsset,
  formatDateFolder,
  formatDayFolder,
  formatMonthFolder,
  listGalleryItems,
  repairGeneratedAssetMetadata,
  saveGeneratedAsset,
} from "./lib/gallery-store.mjs";
import { normalizeBase64, requestImageGeneration } from "./lib/responses-workflow.mjs";
import { mergeRequestPrivateConfig } from "./lib/request-private-config.mjs";
import { createGenerationTaskStore } from "./lib/generation-task-store.mjs";
import {
  DEFAULT_REASONING_EFFORT,
  MAX_CONCURRENT_TASKS_PER_SESSION,
  MAX_PARALLEL_TASKS_PER_SESSION,
  MAX_REFERENCE_IMAGES,
  REASONING_EFFORT_OPTIONS,
} from "./lib/studio-constants.mjs";
import { CREATION_REFERENCE_ANALYSIS_MODE, requestPromptAgentAnalysis } from "./lib/prompt-agent.mjs";
import { createPromptAgentStore } from "./lib/prompt-agent-store.mjs";
import { generatePptDeckOutline } from "./lib/ppt-deck-workflow.mjs";
import { buildSlideEditPrompt, buildSlideImagePrompts } from "./lib/ppt-slide-prompts.mjs";
import { createPptDeckStore } from "./lib/ppt-deck-store.mjs";
import { exportPptxDeck } from "./lib/ppt-export.mjs";
import {
  getMissingPptSlideNumbers,
  mergePptSlides,
  normalizePptCompletionRequest,
} from "./lib/ppt-completion.mjs";
import { normalizePptMotionOptions } from "./lib/ppt-motion-presets.mjs";
import { migrateOutputDirectoryMonths } from "./lib/output-directory-migration.mjs";
import {
  applyCreationPlanOverrides,
  buildCreationPlan,
  normalizeCreationReferenceAnalysis,
  normalizeCreationReferenceRoles,
} from "./lib/creation-planner.mjs";
import { applyCreationRepairOverrides, selectCreationRepairItems } from "./lib/creation-repair.mjs";
import { buildCreationRelativeDir, createCreationSetStore } from "./lib/creation-store.mjs";

const rootDir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(rootDir, "public");
const libDir = join(rootDir, "lib");
const outputDir =
  process.env.IMAGE_STUDIO_OUTPUT_DIR ||
  (process.env.VERCEL ? join(tmpdir(), "gpt-image2-studio-output") : join(homedir(), "Pictures"));
const localDataRootDir =
  process.env.IMAGE_STUDIO_LOCAL_DATA_DIR ||
  (process.env.VERCEL ? join(tmpdir(), "gpt-image2-studio-local") : rootDir);
const configStore = createConfigStore({ rootDir: localDataRootDir });
const promptAgentStore = createPromptAgentStore({ rootDir: localDataRootDir });
const generationTaskStore = createGenerationTaskStore();
const pptDeckStore = createPptDeckStore({ outputDir, publicBasePath: "/output" });
const creationSetStore = createCreationSetStore({ outputDir, publicBasePath: "/output" });
const port = Number(process.env.PORT || 3600);
const activeTasksBySession = new Map();
const PPT_SOURCE_EXTENSIONS = new Set([".pdf", ".docx", ".pptx", ".txt", ".md", ".csv"]);
const PPT_SLIDE_SIZE = "2048x1152";
const PPT_SLIDE_FORMAT = "png";
const MOCK_IMAGE_GENERATION_ENABLED = process.env.IMAGE_STUDIO_MOCK_IMAGE_GENERATION === "1";
const MOCK_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==";
const STYLE_TRANSFER_REFERENCE_IMAGE_LABELS = [
  "Reference image 1: SOURCE image. Preserve content, identity, pose, composition, and layout only. Do not preserve its visual style.",
  "Reference image 2: STYLE reference. This image is the style authority for final rendering, realism level, lighting, texture, color, and material finish.",
];

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function getMimeType(filePath) {
  return MIME_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream";
}

function getStaticCacheControl(filePath) {
  const relativePublicPath = relative(publicDir, filePath);
  const relativeLibPath = relative(libDir, filePath);
  const isPublicAsset = relativePublicPath && !relativePublicPath.startsWith("..") && !isAbsolute(relativePublicPath);
  const isLibraryAsset = relativeLibPath && !relativeLibPath.startsWith("..") && !isAbsolute(relativeLibPath);

  return isPublicAsset || isLibraryAsset ? "no-store" : null;
}

function sendJson(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(message);
}

async function requestStudioImageGeneration(options) {
  if (!MOCK_IMAGE_GENERATION_ENABLED) {
    return requestImageGeneration(options);
  }

  await options.onEvent?.({
    type: "status",
    stage: "mock",
    message: "Using local mock image generation.",
  });
  await options.onEvent?.({
    type: "final_image",
    base64: MOCK_IMAGE_BASE64,
  });

  return {
    finalImageBase64: MOCK_IMAGE_BASE64,
    responseCompleted: true,
    fallbackUsed: false,
    streamFallbackUsed: false,
    sizeFallbackUsed: false,
    requestedSize: options.size,
    effectiveSize: options.size,
    format: options.format,
  };
}

function writeSseEvent(response, type, payload) {
  if (response.destroyed || response.writableEnded) {
    return false;
  }

  try {
    response.write(`event: ${type}\n`);
    response.write(`data: ${JSON.stringify(payload)}\n\n`);
    return true;
  } catch (_error) {
    return false;
  }
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function readFormDataBody(request) {
  const wrapped = new Request(`http://localhost${request.url || "/"}`, {
    method: request.method,
    headers: request.headers,
    body: Readable.toWeb(request),
    duplex: "half",
  });

  return wrapped.formData();
}

async function serveFile(response, filePath) {
  await stat(filePath);
  const cacheControl = getStaticCacheControl(filePath);
  const headers = {
    "Content-Type": getMimeType(filePath),
  };

  if (cacheControl) {
    headers["Cache-Control"] = cacheControl;
  }

  response.writeHead(200, headers);

  await new Promise((resolvePromise, rejectPromise) => {
    const stream = createReadStream(filePath);
    stream.on("error", rejectPromise);
    stream.on("end", resolvePromise);
    stream.pipe(response);
  });
}

function resolveSafeFile(baseDir, requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const target = resolve(baseDir, `.${decoded}`);
  const normalizedBase = resolve(baseDir);
  const backToBase = relative(normalizedBase, target);

  if (backToBase.startsWith("..") || isAbsolute(backToBase)) {
    return null;
  }

  return target;
}

function resolveSafeOutputSubdirectory(relativeDirValue) {
  const relativeDir = String(relativeDirValue || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .join("/");
  if (!relativeDir) {
    return null;
  }

  const normalizedBase = resolve(outputDir);
  const target = resolve(normalizedBase, relativeDir);
  const backToBase = relative(normalizedBase, target);
  if (backToBase.startsWith("..") || isAbsolute(backToBase)) {
    return null;
  }

  return target;
}

function resolveSafeOutputPath(relativePathValue) {
  const relativePathValueNormalized = String(relativePathValue || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .join("/");
  if (!relativePathValueNormalized) {
    return null;
  }

  const normalizedBase = resolve(outputDir);
  const target = resolve(normalizedBase, relativePathValueNormalized);
  const backToBase = relative(normalizedBase, target);
  if (backToBase.startsWith("..") || isAbsolute(backToBase)) {
    return null;
  }

  return target;
}

function isSafeOutputFilename(filename) {
  return Boolean(filename) && basename(filename) === filename;
}

function openDirectory(targetDir) {
  const commands = {
    win32: ["explorer.exe", [targetDir]],
    darwin: ["open", [targetDir]],
    linux: ["xdg-open", [targetDir]],
  };

  const command = commands[process.platform];
  if (!command) {
    throw new Error(`当前平台不支持自动打开目录: ${process.platform}`);
  }

  const [bin, args] = command;
  const child = spawn(bin, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

function getClientSessionId(request, formData) {
  const headerValue = request.headers["x-client-session-id"];
  const formValue = formData.get("clientSessionId");
  const resolved = String(headerValue || formValue || "").trim();
  return resolved || "global-default-session";
}

function getClientSessionIdFromRequest(request, url) {
  const headerValue = request.headers["x-client-session-id"];
  const queryValue = url.searchParams.get("clientSessionId");
  const resolved = String(headerValue || queryValue || "").trim();
  return resolved || "global-default-session";
}

function claimSessionTaskSlot(sessionId, taskId) {
  const activeTasks = activeTasksBySession.get(sessionId) || new Set();
  if (activeTasks.size >= MAX_PARALLEL_TASKS_PER_SESSION) {
    return false;
  }

  activeTasks.add(taskId);
  activeTasksBySession.set(sessionId, activeTasks);
  return true;
}

function releaseSessionTaskSlot(sessionId, taskId) {
  const activeTasks = activeTasksBySession.get(sessionId);
  if (!activeTasks) {
    return;
  }

  activeTasks.delete(taskId);
  if (activeTasks.size === 0) {
    activeTasksBySession.delete(sessionId);
  }
}

function normalizeReasoningEffort(value, fallback = DEFAULT_REASONING_EFFORT) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (!REASONING_EFFORT_OPTIONS.includes(normalized)) {
    throw new Error(`不支持的推理强度: ${normalized}`);
  }

  return normalized;
}

async function handleConfigGet(response) {
  sendJson(response, 200, {
    ...(await configStore.readPublicConfig()),
    aspectRatios: getAspectRatioOptions(),
  });
}

async function handleConfigPost(request, response) {
  const payload = await readJsonBody(request);
  await configStore.saveConfig({
    baseUrl: payload.baseUrl,
    apiKey: payload.apiKey,
    responsesModel: payload.responsesModel,
    defaults: payload.defaults,
  });

  sendJson(response, 200, {
    ...(await configStore.readPublicConfig()),
    aspectRatios: getAspectRatioOptions(),
  });
}

async function handleGalleryGet(response) {
  const items = await listGalleryItems({
    outputDir,
    publicBasePath: "/output",
  });

  sendJson(response, 200, items);
}

async function handleGenerationTasksGet(request, response, url) {
  sendJson(response, 200, generationTaskStore.listTasks(getClientSessionIdFromRequest(request, url)));
}

async function handlePromptAgentHistoryGet(response) {
  sendJson(response, 200, await promptAgentStore.list());
}

async function handleOpenOutput(response) {
  const now = new Date();
  const todayMonthFolder = formatMonthFolder(now);
  const todayDayFolder = formatDayFolder(now);
  const todayDateFolder = formatDateFolder(now);
  const todayOutputDir = join(outputDir, todayMonthFolder, todayDayFolder);
  await Promise.all([
    mkdir(todayOutputDir, { recursive: true }),
    mkdir(join(todayOutputDir, `${todayDateFolder}-image`), { recursive: true }),
    mkdir(join(todayOutputDir, `${todayDateFolder}-ppt`), { recursive: true }),
    mkdir(join(todayOutputDir, `${todayDateFolder}-creation`), { recursive: true }),
  ]);
  openDirectory(todayOutputDir);
  sendJson(response, 200, {
    ok: true,
    outputDir: todayOutputDir,
  });
}

async function handleDeleteOutput(request, response) {
  const payload = await readJsonBody(request);
  const filename = String(payload.filename || "").trim();

  if (!isSafeOutputFilename(filename)) {
    return sendJson(response, 400, {
      message: "Invalid filename",
    });
  }

  try {
    const deleted = await deleteGeneratedAsset({
      outputDir,
      filename,
    });

    return sendJson(response, 200, {
      ok: true,
      filename: deleted.filename,
      absolutePath: deleted.absolutePath,
    });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return sendJson(response, 404, {
        message: "Not found",
      });
    }

    throw error;
  }
}

async function handleGalleryMetadataRepair(request, response) {
  const payload = await readJsonBody(request);
  const filename = String(payload.filename || "").trim();

  if (!isSafeOutputFilename(filename)) {
    return sendJson(response, 400, {
      message: "Invalid filename",
    });
  }

  try {
    await repairGeneratedAssetMetadata({
      outputDir,
      filename,
      metadata: payload.metadata || {},
    });

    const items = await listGalleryItems({
      outputDir,
      publicBasePath: "/output",
    });
    const item = items.find((entry) => entry.filename === filename) || null;

    return sendJson(response, 200, {
      ok: true,
      item,
    });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return sendJson(response, 404, {
        message: "Not found",
      });
    }

    throw error;
  }
}

async function toReferenceImages(files) {
  const validFiles = files.filter(
    (file) =>
      file &&
      typeof file === "object" &&
      typeof file.arrayBuffer === "function" &&
      file.size > 0,
  );

  return Promise.all(
    validFiles.map(async (file, index) => {
      const buffer = Buffer.from(await file.arrayBuffer());
      return {
        filename: file.name || `reference-image-${index + 1}`,
        mimeType: file.type || "application/octet-stream",
        buffer,
        base64: buffer.toString("base64"),
      };
    }),
  );
}

function normalizePptRelativePath(relativePath) {
  return String(relativePath || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .join("/");
}

function buildPptPublicUrl(relativePath) {
  return `/output/${normalizePptRelativePath(relativePath)}`;
}

function resolveOutputAssetPath(relativePath) {
  const normalized = normalizePptRelativePath(relativePath);
  const target = resolve(outputDir, normalized);
  const base = resolve(outputDir);
  const pathFromBase = relative(base, target);
  if (!normalized || pathFromBase.startsWith("..") || isAbsolute(pathFromBase)) {
    throw new Error("PPT 页面图片路径无效。");
  }
  return target;
}

async function hydrateExistingPptSlide(slide) {
  const relativePath = normalizePptRelativePath(slide.relativePath);
  const absolutePath = resolveOutputAssetPath(relativePath);
  await stat(absolutePath);
  return {
    ...slide,
    relativePath,
    absolutePath,
    imageUrl: slide.imageUrl || buildPptPublicUrl(relativePath),
    thumbnailUrl: slide.thumbnailUrl || buildPptPublicUrl(relativePath),
  };
}

function normalizePptFilenamePart(value) {
  return String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .slice(0, 32);
}

function buildPptDeckFolderName({ outline, deckId }) {
  const titlePart = normalizePptFilenamePart(outline.title) || "PPT演示";
  return `${titlePart}-${deckId.slice(-8)}`;
}

function buildPptDeckRelativeDir({ outline, deckId, createdAt }) {
  const monthFolder = formatMonthFolder(createdAt);
  const dayFolder = formatDayFolder(createdAt);
  const dateFolder = formatDateFolder(createdAt);
  const deckFolderName = buildPptDeckFolderName({ outline, deckId });
  return normalizePptRelativePath(`${monthFolder}/${dayFolder}/${dateFolder}-ppt/${deckFolderName}`);
}

function extractPptDeckRelativeDirFromSlides(slides = []) {
  for (const slide of slides) {
    const segments = normalizePptRelativePath(slide?.relativePath).split("/").filter(Boolean);
    const pptSegmentIndex = segments.findIndex((segment) => /^\d{4}-\d{2}-\d{2}-ppt$/.test(segment));
    if (pptSegmentIndex >= 1 && pptSegmentIndex + 1 < segments.length) {
      return segments.slice(0, pptSegmentIndex + 2).join("/");
    }
  }
  return "";
}

function resolvePptDeckRelativeDir({ outline, deckId, createdAt, slides = [] }) {
  return extractPptDeckRelativeDirFromSlides(slides) || buildPptDeckRelativeDir({ outline, deckId, createdAt });
}

async function toPptSourceDocuments(files) {
  const validFiles = files.filter(
    (file) => file && typeof file === "object" && typeof file.arrayBuffer === "function" && file.size > 0,
  );

  return Promise.all(
    validFiles.map(async (file, index) => {
      const filename = String(file.name || `source-${index + 1}`).trim();
      const extension = extname(filename).toLowerCase();
      if (!PPT_SOURCE_EXTENSIONS.has(extension)) {
        throw new Error("PPT 文档仅支持 PDF / DOCX / PPTX / TXT / MD / CSV。");
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      return {
        filename,
        mimeType: file.type || "application/octet-stream",
        buffer,
        base64: buffer.toString("base64"),
      };
    }),
  );
}

async function generateAndSavePptSlide({
  response,
  slidePrompt,
  outline,
  deckId,
  createdAt,
  config,
  reasoningEffort,
  pptDeckRelativeDir,
  referenceImages = [],
}) {
  writeSseEvent(response, "slide_started", {
    slideNumber: slidePrompt.slideNumber,
    title: slidePrompt.title,
  });

  let finalBase64 = "";
  const generationResult = await requestStudioImageGeneration({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    prompt: slidePrompt.prompt,
    referenceImages,
    size: PPT_SLIDE_SIZE,
    quality: config.defaults?.quality || "high",
    format: toApiOutputFormat(PPT_SLIDE_FORMAT),
    responsesModel: config.responsesModel,
    reasoningEffort,
    async onEvent(event) {
      if (event.type === "partial_image") {
        writeSseEvent(response, "partial_image", {
          slideNumber: slidePrompt.slideNumber,
          dataUrl: event.dataUrl,
        });
        return;
      }

      if (event.type === "final_image") {
        finalBase64 = event.base64;
      }
    },
  });
  const savedSize = generationResult.effectiveSize || PPT_SLIDE_SIZE;

  if (!finalBase64) {
    const error = new Error("上游响应结束，但没有拿到最终 PPT 页面图片。");
    error.slideNumber = slidePrompt.slideNumber;
    throw error;
  }

  const filename = createTimestampedFilename({
    format: PPT_SLIDE_FORMAT,
    prompt: `${outline.title}-${slidePrompt.title}`,
    createdAt,
    idSource: `${deckId}-${slidePrompt.slideNumber}`,
  });
  const saved = await saveGeneratedAsset({
    outputDir,
    relativeDir: pptDeckRelativeDir,
    filename,
    imageBuffer: Buffer.from(normalizeBase64(finalBase64), "base64"),
    metadata: {
      prompt: slidePrompt.prompt,
      createdAt,
      baseUrl: config.baseUrl,
      responsesModel: config.responsesModel,
      imageModel: "gpt-image-2",
      ratio: "16:9",
      ratioLabel: "PPT 16:9",
      size: savedSize,
      quality: config.defaults?.quality || "high",
      format: PPT_SLIDE_FORMAT,
      reasoningEffort,
      assetKind: "ppt-slide",
      deckId,
      slideNumber: String(slidePrompt.slideNumber),
      galleryVisible: false,
    },
  });

  return {
    slideNumber: slidePrompt.slideNumber,
    title: slidePrompt.title,
    filename,
    relativePath: saved.relativePath,
    absolutePath: saved.absolutePath,
    imageUrl: buildPptPublicUrl(saved.relativePath),
    thumbnailUrl: buildPptPublicUrl(saved.relativePath),
    prompt: slidePrompt.promptSummary || slidePrompt.prompt,
  };
}

async function saveCompletedPptDeck({
  deckId,
  outline,
  slides,
  createdAt,
  sources = {},
  config,
  reasoningEffort,
  motion = {},
  pptDeckRelativeDir = buildPptDeckRelativeDir({ outline, deckId, createdAt }),
}) {
  const sortedSlides = [...slides].sort((left, right) => left.slideNumber - right.slideNumber);
  const pptxFilename = `${buildPptDeckFolderName({ outline, deckId })}.pptx`;
  const pptxRelativePath = normalizePptRelativePath(`${pptDeckRelativeDir}/${pptxFilename}`);
  const pptxAbsolutePath = resolveOutputAssetPath(pptxRelativePath);

  await exportPptxDeck({
    outputPath: pptxAbsolutePath,
    title: outline.title,
    motion: motion,
    slides: sortedSlides.map((slide) => ({
      title: slide.title,
      imagePath: slide.absolutePath,
    })),
  });

  return pptDeckStore.saveManifest({
    deckId,
    title: outline.title,
    pageCount: outline.slides.length,
    createdAt,
    sources,
    outline,
    slides: sortedSlides.map(({ absolutePath: _absolutePath, ...slide }) => slide),
    pptxRelativePath,
    pptxFilename,
    responsesModel: config.responsesModel,
    imageModel: "gpt-image-2",
    reasoningEffort,
    motion,
  });
}

async function handlePptDecksGet(response) {
  sendJson(response, 200, await pptDeckStore.listManifests());
}

function writePptGenerationError(response, error) {
  const message = error instanceof Error ? error.message : String(error);
  const slideNumber = Number(error?.slideNumber) || 0;
  if (slideNumber) {
    writeSseEvent(response, "slide_failed", {
      slideNumber,
      message,
    });
  }
  writeSseEvent(response, "error", {
    message,
    slideNumber,
  });
}

async function handlePptGenerate(request, response) {
  response.writeHead(200, {
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream; charset=utf-8",
  });

  try {
    writeSseEvent(response, "status", { stage: "uploading", message: "正在读取 PPT 输入" });

    const formData = await readFormDataBody(request);
    const sourceDocuments = await toPptSourceDocuments([
      ...formData.getAll("sourceFiles"),
      ...formData.getAll("sourceFiles[]"),
    ]);
    const sourceText = String(formData.get("sourceText") || "").trim();
    const topic = String(formData.get("topic") || "").trim();
    const pageCount = Number.parseInt(String(formData.get("pageCount") || "0"), 10);
    const stylePreset = String(formData.get("stylePreset") || "").trim();
    const motion = normalizePptMotionOptions({
      dynamicPreset: formData.get("dynamicPreset"),
      transitionPreset: formData.get("transitionPreset"),
      transitionSpeed: formData.get("transitionSpeed"),
      autoAdvanceSeconds: formData.get("autoAdvanceSeconds"),
    });
    const config = mergeRequestPrivateConfig(formData, await configStore.readPrivateConfig());
    const reasoningEffort = normalizeReasoningEffort(
      formData.get("reasoningEffort") || config.defaults?.reasoningEffort || DEFAULT_REASONING_EFFORT,
    );

    if (!config.apiKey) {
      throw new Error("当前未保存 API Key，请先在配置中保存。");
    }

    const deckId = `ppt-deck-${randomUUID()}`;
    const createdAt = new Date().toISOString();
    writeSseEvent(response, "status", { stage: "outline", message: "正在生成 PPT 大纲" });
    const outline = await generatePptDeckOutline({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      responsesModel: config.responsesModel,
      reasoningEffort,
      sourceDocuments,
      sourceText,
      topic,
      pageCount,
      stylePreset,
    });

    writeSseEvent(response, "outline", { deckId, outline });

    const pptDeckRelativeDir = buildPptDeckRelativeDir({ deckId, outline, createdAt });
    const slidePrompts = buildSlideImagePrompts({ outline, theme: stylePreset, dynamicPreset: motion.dynamicPreset });
    const slides = [];
    for (const slidePrompt of slidePrompts) {
      try {
        const slide = await generateAndSavePptSlide({
          response,
          slidePrompt,
          outline,
          deckId,
          createdAt,
          config,
          reasoningEffort,
          pptDeckRelativeDir,
        });
        slides.push(slide);
        writeSseEvent(response, "slide_saved", { slide });
      } catch (error) {
        error.slideNumber ||= slidePrompt.slideNumber;
        throw error;
      }
    }

    const deck = await saveCompletedPptDeck({
      deckId,
      outline,
      slides,
      createdAt,
      sources: {
        filenames: sourceDocuments.map((file) => file.filename),
        hasSourceText: Boolean(sourceText),
        topic,
        stylePreset,
        ...motion,
      },
      config,
      reasoningEffort,
      motion,
      pptDeckRelativeDir,
    });

    writeSseEvent(response, "deck_saved", { deck });
    writeSseEvent(response, "complete", { deck, missingSlideNumbers: [] });
  } catch (error) {
    writePptGenerationError(response, error);
  } finally {
    if (!response.destroyed && !response.writableEnded) {
      response.end();
    }
  }
}

async function handlePptComplete(request, response) {
  response.writeHead(200, {
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream; charset=utf-8",
  });

  try {
    const payload = await readJsonBody(request);
    const motion = normalizePptMotionOptions({
      dynamicPreset: payload.dynamicPreset,
      transitionPreset: payload.transitionPreset,
      transitionSpeed: payload.transitionSpeed,
      autoAdvanceSeconds: payload.autoAdvanceSeconds,
    });
    const completion = normalizePptCompletionRequest({
      deckId: payload.deckId,
      outline: payload.outline,
      existingSlides: payload.existingSlides,
      slideNumbers: payload.slideNumbers,
      theme: payload.stylePreset || payload.theme,
    });
    const config = mergeRequestPrivateConfig(payload, await configStore.readPrivateConfig());
    const reasoningEffort = normalizeReasoningEffort(
      payload.reasoningEffort || config.defaults?.reasoningEffort || DEFAULT_REASONING_EFFORT,
    );

    if (!config.apiKey) {
      throw new Error("当前未保存 API Key，请先在配置中保存。");
    }

    const deckId = completion.deckId || `ppt-deck-${randomUUID()}`;
    const createdAt = new Date().toISOString();
    const existingSlides = await Promise.all(completion.existingSlides.map(hydrateExistingPptSlide));
    const pptDeckRelativeDir = resolvePptDeckRelativeDir({
      deckId,
      outline: completion.outline,
      createdAt,
      slides: existingSlides,
    });
    const slidePrompts = buildSlideImagePrompts({
      outline: completion.outline,
      theme: completion.theme,
      dynamicPreset: motion.dynamicPreset,
    }).filter((slidePrompt) => completion.slideNumbers.includes(slidePrompt.slideNumber));
    const generatedSlides = [];

    writeSseEvent(response, "outline", { deckId, outline: completion.outline });

    for (const slidePrompt of slidePrompts) {
      try {
        const slide = await generateAndSavePptSlide({
          response,
          slidePrompt,
          outline: completion.outline,
          deckId,
          createdAt,
          config,
          reasoningEffort,
          pptDeckRelativeDir,
        });
        generatedSlides.push(slide);
        writeSseEvent(response, "slide_saved", { slide });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        writeSseEvent(response, "slide_failed", {
          slideNumber: slidePrompt.slideNumber,
          message,
        });
      }
    }

    const mergedSlides = mergePptSlides(existingSlides, generatedSlides);
    const missingSlideNumbers = getMissingPptSlideNumbers({
      outline: completion.outline,
      slides: mergedSlides,
    });
    let deck = null;

    if (missingSlideNumbers.length === 0) {
      deck = await saveCompletedPptDeck({
        deckId,
        outline: completion.outline,
        slides: mergedSlides,
        createdAt,
        sources: payload.sources || {},
        config,
        reasoningEffort,
        motion,
        pptDeckRelativeDir,
      });
      writeSseEvent(response, "deck_saved", { deck });
    }

    writeSseEvent(response, "complete", { deck, missingSlideNumbers });
  } catch (error) {
    writePptGenerationError(response, error);
  } finally {
    if (!response.destroyed && !response.writableEnded) {
      response.end();
    }
  }
}

async function handlePptSlideEdit(request, response) {
  response.writeHead(200, {
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream; charset=utf-8",
  });

  try {
    const formData = await readFormDataBody(request);
    const sourceSlideImage = formData.get("sourceSlideImage");
    const annotatedSlideImage = formData.get("annotatedSlideImage");
    const referenceImages = await toReferenceImages([sourceSlideImage, annotatedSlideImage]);
    if (referenceImages.length < 2) {
      throw new Error("请先在页面上完成标注后再重新生成。");
    }

    const outline = JSON.parse(String(formData.get("outline") || "{}"));
    const existingSlides = JSON.parse(String(formData.get("existingSlides") || "[]"));
    const slideNumber = Number.parseInt(String(formData.get("slideNumber") || "0"), 10);
    const stylePreset = String(formData.get("stylePreset") || "").trim();
    const motion = normalizePptMotionOptions({
      dynamicPreset: formData.get("dynamicPreset"),
      transitionPreset: formData.get("transitionPreset"),
      transitionSpeed: formData.get("transitionSpeed"),
      autoAdvanceSeconds: formData.get("autoAdvanceSeconds"),
    });
    const editInstruction = String(formData.get("editInstruction") || "").trim();
    const completion = normalizePptCompletionRequest({
      deckId: formData.get("deckId"),
      outline,
      existingSlides,
      slideNumbers: [slideNumber],
      theme: stylePreset,
    });
    const config = mergeRequestPrivateConfig(formData, await configStore.readPrivateConfig());
    const reasoningEffort = normalizeReasoningEffort(
      formData.get("reasoningEffort") || config.defaults?.reasoningEffort || DEFAULT_REASONING_EFFORT,
    );

    if (!config.apiKey) {
      throw new Error("当前未保存 API Key，请先在配置中保存。");
    }

    const deckId = completion.deckId || `ppt-deck-${randomUUID()}`;
    const createdAt = new Date().toISOString();
    const existingHydratedSlides = await Promise.all(completion.existingSlides.map(hydrateExistingPptSlide));
    const pptDeckRelativeDir = resolvePptDeckRelativeDir({
      deckId,
      outline: completion.outline,
      createdAt,
      slides: existingHydratedSlides,
    });
    const slide = completion.outline.slides.find((entry) => Number(entry.slideNumber) === slideNumber);
    if (!slide) {
      throw new Error("未找到要编辑的 PPT 页面。");
    }

    writeSseEvent(response, "outline", { deckId, outline: completion.outline });
    const generatedSlide = await generateAndSavePptSlide({
      response,
      slidePrompt: {
        slideNumber,
        title: slide.title,
        prompt: buildSlideEditPrompt({
          outline: completion.outline,
          slideNumber,
          theme: stylePreset,
          editInstruction,
          dynamicPreset: motion.dynamicPreset,
        }),
        promptSummary: `${slide.title}：${editInstruction || "按标注重新生成"}`,
      },
      outline: completion.outline,
      deckId,
      createdAt,
      config,
      reasoningEffort,
      pptDeckRelativeDir,
      referenceImages,
    });

    writeSseEvent(response, "slide_saved", { slide: generatedSlide });

    const mergedSlides = mergePptSlides(existingHydratedSlides, [generatedSlide]);
    const missingSlideNumbers = getMissingPptSlideNumbers({
      outline: completion.outline,
      slides: mergedSlides,
    });
    let deck = null;

    if (missingSlideNumbers.length === 0) {
      deck = await saveCompletedPptDeck({
        deckId,
        outline: completion.outline,
        slides: mergedSlides,
        createdAt,
        sources: { editedSlideNumber: slideNumber, stylePreset, ...motion },
        config,
        reasoningEffort,
        motion,
        pptDeckRelativeDir,
      });
      writeSseEvent(response, "deck_saved", { deck });
    }

    writeSseEvent(response, "complete", { deck, missingSlideNumbers });
  } catch (error) {
    writePptGenerationError(response, error);
  } finally {
    if (!response.destroyed && !response.writableEnded) {
      response.end();
    }
  }
}

async function handlePromptAgentAnalyze(request, response) {
  const formData = await readFormDataBody(request);
  const rawImages = [
    ...formData.getAll("image"),
    ...formData.getAll("promptAgentImage"),
    ...formData.getAll("referenceImages"),
    ...formData.getAll("referenceImage"),
  ];
  const images = await toReferenceImages(rawImages);

  if (images.length === 0) {
    return sendJson(response, 400, {
      message: "请先上传一张图片。",
    });
  }

  if (images.some((image) => !image.mimeType.startsWith("image/"))) {
    return sendJson(response, 400, {
      message: "仅支持图片文件。",
    });
  }

  if (images.length > MAX_REFERENCE_IMAGES) {
    return sendJson(response, 400, {
      message: `参考图最多支持 ${MAX_REFERENCE_IMAGES} 张。`,
    });
  }

  const config = mergeRequestPrivateConfig(formData, await configStore.readPrivateConfig());
  if (!config.apiKey) {
    return sendJson(response, 400, {
      message: "当前未保存 API Key，请先在配置中保存。",
    });
  }

  const reasoningEffort = normalizeReasoningEffort(
    formData.get("reasoningEffort") || config.defaults?.reasoningEffort || DEFAULT_REASONING_EFFORT,
  );
  const mode = String(formData.get("mode") || "").trim();
  const createdAt = new Date().toISOString();
  const json = await requestPromptAgentAnalysis({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    image: images[0],
    images,
    mode,
    responsesModel: config.responsesModel,
    reasoningEffort,
  });
  const filenames = images.map((image) => image.filename).filter(Boolean);
  const item = await promptAgentStore.append({
    id: `prompt-json-${randomUUID()}`,
    createdAt,
    filename: filenames.join(" + "),
    imageMimeType: images.map((image) => image.mimeType).filter(Boolean).join(", "),
    imageSize: images.reduce((total, image) => total + image.buffer.length, 0),
    responsesModel: config.responsesModel,
    reasoningEffort,
    json,
  });

  return sendJson(response, 200, {
    ok: true,
    item,
  });
}

function buildSavedItem({
  filename,
  absolutePath,
  relativePath,
  createdAt,
  prompt,
  baseUrl,
  responsesModel,
  ratioOption,
  size,
  quality,
  format,
  referenceImages,
  reasoningEffort,
  generationMode = "",
  styleTransferSourceImageName = "",
  styleTransferReferenceImageName = "",
  generationStartedAt,
  generationCompletedAt,
  generationDurationMs,
}) {
  const imageUrl = buildPublicAssetUrl("/output", relativePath || filename, createdAt);

  return {
    id: `${filename.replace(/\.[^.]+$/, "")}-${createdAt}`,
    filename,
    absolutePath,
    relativePath: relativePath || filename,
    imageUrl,
    thumbnailUrl: imageUrl,
    createdAt,
    prompt,
    baseUrl,
    responsesModel,
    imageModel: "gpt-image-2",
    hasReferenceImage: referenceImages.length > 0,
    referenceImageNames: referenceImages.map((image) => image.filename),
    referenceImageName: referenceImages[0]?.filename || "",
    generationMode,
    styleTransferSourceImageName,
    styleTransferReferenceImageName,
    ratio: ratioOption.value,
    ratioLabel: ratioOption.label,
    size,
    quality,
    format,
    reasoningEffort,
    generationStartedAt,
    generationCompletedAt,
    generationDurationMs,
  };
}

function updateCreationItems(items, itemId, patch = {}) {
  return items.map((item) => (item.itemId === itemId ? { ...item, ...patch } : item));
}

function getCreationSetStatus(items) {
  const completedCount = items.filter((item) => item.status === "completed").length;
  const failedCount = items.filter((item) => item.status === "failed").length;

  if (completedCount === items.length) {
    return "completed";
  }

  if (failedCount === items.length) {
    return "failed";
  }

  if (failedCount > 0) {
    return "partial_failed";
  }

  return "generating";
}

function buildCreationSetManifest({
  setId,
  plan,
  createdAt,
  updatedAt,
  status,
  relativeDir,
  items,
  referenceImageNames = [],
  referenceImageRoles = [],
}) {
  return {
    setId,
    productName: plan.productName,
    productDescription: plan.productDescription,
    sellingPoints: plan.sellingPoints,
    dimensionSpecs: plan.dimensionSpecs,
    targetLanguage: plan.targetLanguage,
    targetLanguageLabel: plan.targetLanguageLabel,
    imageCount: plan.imageCount,
    scenario: plan.scenario,
    scenarioLabel: plan.scenarioLabel,
    industryTemplate: plan.industryTemplate,
    industryTemplateLabel: plan.industryTemplateLabel,
    industryTemplatePath: plan.industryTemplatePath,
    selectedRoles: plan.selectedRoles || items.map((item) => item.role).filter(Boolean),
    referenceImageNames,
    referenceImageRoles: plan.referenceImageRoles || referenceImageRoles,
    createdAt,
    updatedAt: updatedAt || createdAt,
    status,
    relativeDir,
    items,
  };
}

function buildCreationImageFilename({ item, createdAt, setId, format }) {
  const filenameToken = item.filenameToken || item.role || item.itemId || "creation";
  const baseName = createTimestampedFilename({
    format,
    prompt: `${item.title} ${item.prompt}`,
    createdAt,
    idSource: `${setId}-${item.itemId}`,
  });
  return `${String(item.slotIndex).padStart(2, "0")}-${filenameToken}-${baseName}`;
}

async function handleCreationSetsGet(response) {
  sendJson(response, 200, await creationSetStore.listManifests(), {
    "Cache-Control": "no-store",
  });
}

async function handleCreationSetFolderOpen(request, response) {
  const payload = await readJsonBody(request);
  const setId = String(payload.setId || "").trim();
  if (!setId) {
    return sendJson(response, 400, {
      message: "缺少套图记录 ID。",
    });
  }

  try {
    const set = await creationSetStore.readManifest(setId);
    if (!set.relativeDir) {
      return sendJson(response, 404, {
        message: "这套记录没有 creation 文件夹路径。",
      });
    }

    const targetDir = resolveSafeOutputSubdirectory(set.relativeDir);
    if (!targetDir) {
      return sendJson(response, 400, {
        message: "套图文件夹路径无效。",
      });
    }

    const targetStat = await stat(targetDir);
    if (!targetStat.isDirectory()) {
      return sendJson(response, 404, {
        message: "套图文件夹不存在。",
      });
    }

    openDirectory(targetDir);
    return sendJson(response, 200, {
      ok: true,
      setId,
      directory: targetDir,
    });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return sendJson(response, 404, {
        message: "套图文件夹不存在。",
      });
    }

    throw error;
  }
}

function buildCreationSetPathReport(set) {
  const items = (Array.isArray(set.items) ? set.items : [])
    .map((item) => {
      const relativePath = String(item.relativePath || "").trim();
      const absolutePath = resolveSafeOutputPath(item.relativePath);
      if (!relativePath || !absolutePath) {
        return null;
      }

      return {
        itemId: String(item.itemId || ""),
        title: String(item.title || ""),
        filename: String(item.filename || ""),
        relativePath,
        absolutePath,
        imageUrl: String(item.imageUrl || item.thumbnailUrl || ""),
      };
    })
    .filter(Boolean);

  return {
    setId: String(set.setId || ""),
    productName: String(set.productName || ""),
    relativeDir: String(set.relativeDir || ""),
    absoluteDir: set.relativeDir ? resolveSafeOutputSubdirectory(set.relativeDir) : null,
    items,
  };
}

async function handleCreationSetPathsGet(request, response) {
  const payload = await readJsonBody(request);
  const setId = String(payload.setId || "").trim();
  if (!setId) {
    return sendJson(response, 400, {
      message: "缺少套图记录 ID。",
    });
  }

  const set = await creationSetStore.readManifest(setId);
  return sendJson(response, 200, buildCreationSetPathReport(set));
}

async function handleCreationReferenceAnalyze(request, response) {
  const formData = await readFormDataBody(request);
  const referenceImages = await toReferenceImages([
    ...formData.getAll("referenceImages"),
    ...formData.getAll("referenceImage"),
  ]);

  if (referenceImages.length === 0) {
    return sendJson(response, 400, {
      message: "请先上传套图参考图。",
    });
  }

  if (referenceImages.length > MAX_REFERENCE_IMAGES) {
    return sendJson(response, 400, {
      message: `参考图最多支持 ${MAX_REFERENCE_IMAGES} 张。`,
    });
  }

  if (referenceImages.some((image) => !String(image.mimeType || "").startsWith("image/"))) {
    return sendJson(response, 400, {
      message: "仅支持图片参考文件。",
    });
  }

  const config = mergeRequestPrivateConfig(formData, await configStore.readPrivateConfig());
  if (!config.apiKey) {
    return sendJson(response, 400, {
      message: "当前未保存 API Key，请先在配置中保存。",
    });
  }

  const reasoningEffort = normalizeReasoningEffort(
    formData.get("reasoningEffort") || config.defaults?.reasoningEffort || DEFAULT_REASONING_EFFORT,
  );
  const json = await requestPromptAgentAnalysis({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    image: referenceImages[0],
    images: referenceImages,
    mode: CREATION_REFERENCE_ANALYSIS_MODE,
    responsesModel: config.responsesModel,
    reasoningEffort,
  });
  const analysis = normalizeCreationReferenceAnalysis(
    json,
    referenceImages.map((image) => image.filename).filter(Boolean),
  );

  return sendJson(response, 200, {
    ok: true,
    analysis,
  });
}

async function handleCreationPlan(request, response) {
  try {
    const formData = await readFormDataBody(request);
    const referenceImageRoles = normalizeCreationReferenceRoles(formData.get("referenceImageRoles"));
    let plan = buildCreationPlan({
      productName: formData.get("productName"),
      productDescription: formData.get("productDescription"),
      sellingPoints: formData.get("sellingPoints"),
      dimensionSpecs: formData.get("dimensionSpecs"),
      targetLanguage: formData.get("targetLanguage"),
      imageCount: formData.get("imageCount"),
      scenario: formData.get("scenario"),
      industryTemplate: formData.get("industryTemplate"),
      selectedRoles: formData.get("selectedRoles"),
      referenceImageRoles,
    });
    plan = applyCreationPlanOverrides(plan, formData.get("planOverrides"));

    return sendJson(response, 200, {
      ok: true,
      plan,
    });
  } catch (error) {
    return sendJson(response, 400, {
      message: compactErrorMessage(error instanceof Error ? error.message : String(error), "套图计划生成失败"),
    });
  }
}

async function handleCreationGenerate(request, response) {
  response.writeHead(200, {
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream; charset=utf-8",
  });

  let setId = "";
  let items = [];
  let plan = null;
  let creationRelativeDir = "";
  let createdAt = new Date().toISOString();
  let referenceImages = [];
  let referenceImageNames = [];
  let referenceImageRoles = [];

  try {
    const formData = await readFormDataBody(request);
    setId = `creation-set-${randomUUID()}`;
    createdAt = new Date().toISOString();
    referenceImages = await toReferenceImages([
      ...formData.getAll("referenceImages"),
      ...formData.getAll("referenceImage"),
    ]);
    if (referenceImages.length > MAX_REFERENCE_IMAGES) {
      throw new Error(`参考图最多支持 ${MAX_REFERENCE_IMAGES} 张。`);
    }
    if (referenceImages.some((image) => !String(image.mimeType || "").startsWith("image/"))) {
      throw new Error("仅支持图片参考文件。");
    }
    referenceImageNames = referenceImages.map((image) => image.filename).filter(Boolean);
    referenceImageRoles = normalizeCreationReferenceRoles(formData.get("referenceImageRoles"));
    plan = buildCreationPlan({
      productName: formData.get("productName"),
      productDescription: formData.get("productDescription"),
      sellingPoints: formData.get("sellingPoints"),
      dimensionSpecs: formData.get("dimensionSpecs"),
      targetLanguage: formData.get("targetLanguage"),
      imageCount: formData.get("imageCount"),
      scenario: formData.get("scenario"),
      industryTemplate: formData.get("industryTemplate"),
      selectedRoles: formData.get("selectedRoles"),
      referenceImageRoles,
    });
    plan = applyCreationPlanOverrides(plan, formData.get("planOverrides"));

    const config = mergeRequestPrivateConfig(formData, await configStore.readPrivateConfig());
    if (!config.apiKey) {
      writeSseEvent(response, "error", {
        message: "当前未保存 API Key，请先在配置中保存。",
      });
      return;
    }

    const clientSessionId = getClientSessionId(request, formData);
    const ratioOption = resolveAspectRatioOption(String(formData.get("ratio") || "1:1"));
    const requestedSizeInput = String(formData.get("size") || "auto").trim().toLowerCase();
    const requestedSize = normalizeGenerationSize(ratioOption.value, requestedSizeInput);
    if (requestedSize !== requestedSizeInput && requestedSizeInput !== "") {
      throw new Error(`当前比例 ${ratioOption.value} 不支持分辨率 ${requestedSizeInput}`);
    }

    const finalSize = requestedSize === "auto" ? getDefaultGenerationSize(ratioOption.value) : requestedSize;
    const finalQuality = config.defaults?.quality || "high";
    const finalFormat = normalizeOutputFormat(String(formData.get("format") || config.defaults?.format || "png"));
    const reasoningEffort = normalizeReasoningEffort(
      formData.get("reasoningEffort") || config.defaults?.reasoningEffort || DEFAULT_REASONING_EFFORT,
    );

    creationRelativeDir = buildCreationRelativeDir({
      createdAt,
      productName: plan.productName || plan.productDescription,
      setId,
    });
    items = plan.items.map((item) => ({
      ...item,
      status: "queued",
      filename: "",
      relativePath: "",
      imageUrl: "",
      thumbnailUrl: "",
      error: "",
    }));

    let setManifest = await creationSetStore.saveManifest(
      buildCreationSetManifest({
        setId,
        plan,
        createdAt,
        status: "generating",
        relativeDir: creationRelativeDir,
        items,
        referenceImageNames,
      }),
    );

    writeSseEvent(response, "set_started", { set: setManifest });
    writeSseEvent(response, "plan", { setId, items });

    for (const item of plan.items) {
      const taskId = `${setId}-${item.itemId}`;
      const generationStartedAt = new Date().toISOString();
      const generationStartedAtMs = Date.now();
      let finalBase64 = "";
      let slotClaimed = false;

      try {
        if (!claimSessionTaskSlot(clientSessionId, taskId)) {
          throw new Error(`同一会话最多同时并发 ${MAX_PARALLEL_TASKS_PER_SESSION} 个生成任务。`);
        }
        slotClaimed = true;
        items = updateCreationItems(items, item.itemId, {
          status: "generating",
          generationStartedAt,
        });
        writeSseEvent(response, "item_started", { setId, itemId: item.itemId, role: item.role });

        const finalPrompt = appendRatioHintToPrompt(item.prompt, ratioOption);
        const generationResult = await requestStudioImageGeneration({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          prompt: finalPrompt,
          referenceImages,
          size: finalSize,
          quality: finalQuality,
          format: toApiOutputFormat(finalFormat),
          responsesModel: config.responsesModel,
          reasoningEffort,
          async onEvent(event) {
            if (event.type === "status") {
              writeSseEvent(response, "item_status", {
                setId,
                itemId: item.itemId,
                stage: event.stage,
                message: event.message,
              });
            }

            if (event.type === "partial_image") {
              writeSseEvent(response, "item_partial_image", {
                setId,
                itemId: item.itemId,
                dataUrl: event.dataUrl,
              });
            }

            if (event.type === "final_image") {
              finalBase64 = event.base64;
              writeSseEvent(response, "item_final_image", {
                setId,
                itemId: item.itemId,
                dataUrl: `data:${toOutputFormatMimeType(finalFormat)};base64,${normalizeBase64(event.base64)}`,
              });
            }
          },
        });

        finalBase64 = finalBase64 || generationResult.finalImageBase64;
        if (!finalBase64) {
          throw new Error("上游响应结束，但没有拿到最终图片。");
        }

        const generationCompletedAt = new Date().toISOString();
        const generationDurationMs = Math.max(0, Date.now() - generationStartedAtMs);
        const savedSize = generationResult.effectiveSize || finalSize;
        const filename = buildCreationImageFilename({
          item,
          createdAt,
          setId,
          format: finalFormat,
        });
        const saved = await saveGeneratedAsset({
          outputDir,
          relativeDir: creationRelativeDir,
          filename,
          imageBuffer: Buffer.from(normalizeBase64(finalBase64), "base64"),
          metadata: {
            prompt: item.prompt,
            createdAt,
            baseUrl: config.baseUrl,
            responsesModel: config.responsesModel,
            imageModel: "gpt-image-2",
            ratio: ratioOption.value,
            ratioLabel: ratioOption.label,
            size: savedSize,
            quality: finalQuality,
            format: finalFormat,
            reasoningEffort,
            generationStartedAt,
            generationCompletedAt,
            generationDurationMs,
            assetKind: "creation-image",
            creationSetId: setId,
            creationItemId: item.itemId,
            creationRole: item.role,
            targetLanguage: plan.targetLanguage,
            creationScenario: plan.scenario,
            creationIndustryTemplate: plan.industryTemplate,
            creationImageCount: plan.imageCount,
            hasReferenceImage: referenceImages.length > 0,
            referenceImageNames,
            referenceImageName: referenceImageNames[0] || "",
            referenceImageRoles,
            galleryVisible: false,
          },
        });
        const imageUrl = buildPublicAssetUrl("/output", saved.relativePath, saved.createdAt);

        items = updateCreationItems(items, item.itemId, {
          status: "completed",
          filename,
          relativePath: saved.relativePath,
          imageUrl,
          thumbnailUrl: imageUrl,
          generationStartedAt,
          generationCompletedAt,
          generationDurationMs,
        });
        setManifest = await creationSetStore.saveManifest(
          buildCreationSetManifest({
            setId,
            plan,
            createdAt,
            updatedAt: generationCompletedAt,
            status: getCreationSetStatus(items),
            relativeDir: creationRelativeDir,
            items,
            referenceImageNames,
          }),
        );

        writeSseEvent(response, "item_saved", {
          setId,
          item: setManifest.items.find((entry) => entry.itemId === item.itemId),
          set: setManifest,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        items = updateCreationItems(items, item.itemId, {
          status: "failed",
          error: message,
        });
        setManifest = await creationSetStore.saveManifest(
          buildCreationSetManifest({
            setId,
            plan,
            createdAt,
            updatedAt: new Date().toISOString(),
            status: getCreationSetStatus(items),
            relativeDir: creationRelativeDir,
            items,
            referenceImageNames,
          }),
        );
        writeSseEvent(response, "item_failed", {
          setId,
          itemId: item.itemId,
          message,
          set: setManifest,
        });
      } finally {
        if (slotClaimed) {
          releaseSessionTaskSlot(clientSessionId, taskId);
        }
      }
    }

    const finalSet = await creationSetStore.saveManifest(
      buildCreationSetManifest({
        setId,
        plan,
        createdAt,
        updatedAt: new Date().toISOString(),
        status: getCreationSetStatus(items),
        relativeDir: creationRelativeDir,
        items,
        referenceImageNames,
      }),
    );

    writeSseEvent(response, "complete", { set: finalSet });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (setId && plan) {
      await creationSetStore.saveManifest(
        buildCreationSetManifest({
          setId,
          plan,
          createdAt,
          updatedAt: new Date().toISOString(),
          status: getCreationSetStatus(items),
          relativeDir: creationRelativeDir,
          items,
          referenceImageNames,
        }),
      );
    }
    writeSseEvent(response, "error", { message });
  } finally {
    if (!response.destroyed && !response.writableEnded) {
      response.end();
    }
  }
}

async function handleCreationRepair(request, response) {
  response.writeHead(200, {
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream; charset=utf-8",
  });

  let setId = "";
  let existingSet = null;
  let items = [];
  let repairPlan = null;
  let referenceImageNames = [];
  let referenceImageRoles = [];

  try {
    const formData = await readFormDataBody(request);
    setId = String(formData.get("setId") || "").trim();
    if (!setId) {
      throw new Error("缺少套图记录 ID。");
    }

    existingSet = await creationSetStore.readManifest(setId);
    items = Array.isArray(existingSet.items) ? existingSet.items : [];
    const referenceImages = await toReferenceImages([
      ...formData.getAll("referenceImages"),
      ...formData.getAll("referenceImage"),
    ]);
    if (referenceImages.length > MAX_REFERENCE_IMAGES) {
      throw new Error(`参考图最多支持 ${MAX_REFERENCE_IMAGES} 张。`);
    }
    if (referenceImages.some((image) => !String(image.mimeType || "").startsWith("image/"))) {
      throw new Error("仅支持图片参考文件。");
    }
    referenceImageNames =
      referenceImages.length > 0
        ? referenceImages.map((image) => image.filename).filter(Boolean)
        : existingSet.referenceImageNames || [];
    {
      const submittedReferenceImageRoles = normalizeCreationReferenceRoles(formData.get("referenceImageRoles"));
      referenceImageRoles =
        submittedReferenceImageRoles.length > 0 ? submittedReferenceImageRoles : existingSet.referenceImageRoles || [];
    }

    const config = mergeRequestPrivateConfig(formData, await configStore.readPrivateConfig());
    if (!config.apiKey) {
      writeSseEvent(response, "error", {
        message: "当前未保存 API Key，请先在配置中保存。",
      });
      return;
    }

    const repairItemId = formData.get("itemId");
    const promptOverride = formData.get("promptOverride");
    const marketingCopyOverride = formData.get("marketingCopyOverride");
    const repairItems = selectCreationRepairItems(existingSet, {
      itemId: repairItemId,
      scope: formData.get("scope"),
    }).map((item) =>
      repairItemId
        ? applyCreationRepairOverrides(item, {
            promptOverride,
            marketingCopyOverride,
          })
        : item,
    );
    if (repairItems.length === 0) {
      writeSseEvent(response, "error", {
        message: "没有需要补图或重生成的套图项。",
      });
      return;
    }

    repairPlan = {
      productName: existingSet.productName,
      productDescription: existingSet.productDescription,
      sellingPoints: existingSet.sellingPoints,
      dimensionSpecs: existingSet.dimensionSpecs,
      targetLanguage: existingSet.targetLanguage,
      targetLanguageLabel: existingSet.targetLanguageLabel,
      imageCount: existingSet.imageCount,
      scenario: existingSet.scenario,
      scenarioLabel: existingSet.scenarioLabel,
      industryTemplate: existingSet.industryTemplate || "general",
      industryTemplateLabel: existingSet.industryTemplateLabel || "",
      industryTemplatePath: existingSet.industryTemplatePath || "",
      referenceImageRoles,
    };

    const clientSessionId = getClientSessionId(request, formData);
    const ratioOption = resolveAspectRatioOption(String(formData.get("ratio") || "1:1"));
    const requestedSizeInput = String(formData.get("size") || "auto").trim().toLowerCase();
    const requestedSize = normalizeGenerationSize(ratioOption.value, requestedSizeInput);
    if (requestedSize !== requestedSizeInput && requestedSizeInput !== "") {
      throw new Error(`当前比例 ${ratioOption.value} 不支持分辨率 ${requestedSizeInput}`);
    }

    const finalSize = requestedSize === "auto" ? getDefaultGenerationSize(ratioOption.value) : requestedSize;
    const finalQuality = config.defaults?.quality || "high";
    const finalFormat = normalizeOutputFormat(String(formData.get("format") || config.defaults?.format || "png"));
    const reasoningEffort = normalizeReasoningEffort(
      formData.get("reasoningEffort") || config.defaults?.reasoningEffort || DEFAULT_REASONING_EFFORT,
    );
    const relativeDir =
      existingSet.relativeDir ||
      buildCreationRelativeDir({
        createdAt: existingSet.createdAt,
        productName: existingSet.productName || existingSet.productDescription,
        setId,
      });

    items = repairItems.reduce(
      (nextItems, item) =>
        updateCreationItems(nextItems, item.itemId, {
          prompt: item.prompt,
          marketingCopy: item.marketingCopy,
          status: "queued",
          error: "",
        }),
      items,
    );
    let setManifest = await creationSetStore.saveManifest(
      buildCreationSetManifest({
        setId,
        plan: repairPlan,
        createdAt: existingSet.createdAt,
        updatedAt: new Date().toISOString(),
        status: getCreationSetStatus(items),
        relativeDir,
        items,
        referenceImageNames,
      }),
    );

    writeSseEvent(response, "repair_started", {
      set: setManifest,
      itemIds: repairItems.map((item) => item.itemId),
    });

    for (const item of repairItems) {
      const repairItem = item;
      const taskId = `${setId}-repair-${item.itemId}`;
      const generationStartedAt = new Date().toISOString();
      const generationStartedAtMs = Date.now();
      let finalBase64 = "";
      let slotClaimed = false;

      try {
        if (!claimSessionTaskSlot(clientSessionId, taskId)) {
          throw new Error(`同一会话最多同时并发 ${MAX_PARALLEL_TASKS_PER_SESSION} 个生成任务。`);
        }
        slotClaimed = true;
        items = updateCreationItems(items, item.itemId, {
          prompt: repairItem.prompt,
          marketingCopy: repairItem.marketingCopy,
          status: "generating",
          generationStartedAt,
          error: "",
        });
        writeSseEvent(response, "item_started", { setId, itemId: item.itemId, role: repairItem.role });

        const finalPrompt = appendRatioHintToPrompt(repairItem.prompt, ratioOption);
        const generationResult = await requestStudioImageGeneration({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          prompt: finalPrompt,
          referenceImages,
          size: finalSize,
          quality: finalQuality,
          format: toApiOutputFormat(finalFormat),
          responsesModel: config.responsesModel,
          reasoningEffort,
          async onEvent(event) {
            if (event.type === "status") {
              writeSseEvent(response, "item_status", {
                setId,
                itemId: item.itemId,
                stage: event.stage,
                message: event.message,
              });
            }

            if (event.type === "partial_image") {
              writeSseEvent(response, "item_partial_image", {
                setId,
                itemId: item.itemId,
                dataUrl: event.dataUrl,
              });
            }

            if (event.type === "final_image") {
              finalBase64 = event.base64;
              writeSseEvent(response, "item_final_image", {
                setId,
                itemId: item.itemId,
                dataUrl: `data:${toOutputFormatMimeType(finalFormat)};base64,${normalizeBase64(event.base64)}`,
              });
            }
          },
        });

        finalBase64 = finalBase64 || generationResult.finalImageBase64;
        if (!finalBase64) {
          throw new Error("上游响应结束，但没有拿到最终图片。");
        }

        const generationCompletedAt = new Date().toISOString();
        const generationDurationMs = Math.max(0, Date.now() - generationStartedAtMs);
        const savedSize = generationResult.effectiveSize || finalSize;
        const filenameOptions = {
          filename: item.filename || buildCreationImageFilename({
            item,
            createdAt: generationCompletedAt,
            setId,
            format: finalFormat,
          }),
        };
        const filename = filenameOptions.filename;
        const saved = await saveGeneratedAsset({
          outputDir,
          relativeDir,
          filename,
          imageBuffer: Buffer.from(normalizeBase64(finalBase64), "base64"),
          metadata: {
            prompt: repairItem.prompt,
            createdAt: generationCompletedAt,
            baseUrl: config.baseUrl,
            responsesModel: config.responsesModel,
            imageModel: "gpt-image-2",
            ratio: ratioOption.value,
            ratioLabel: ratioOption.label,
            size: savedSize,
            quality: finalQuality,
            format: finalFormat,
            reasoningEffort,
            generationStartedAt,
            generationCompletedAt,
            generationDurationMs,
            assetKind: "creation-image",
            creationSetId: setId,
            creationItemId: item.itemId,
            creationRole: repairItem.role,
            creationRepairOf: item.itemId,
            targetLanguage: existingSet.targetLanguage,
            creationScenario: existingSet.scenario,
            creationIndustryTemplate: existingSet.industryTemplate || "general",
            creationImageCount: existingSet.imageCount,
            hasReferenceImage: referenceImages.length > 0,
            referenceImageNames,
            referenceImageName: referenceImageNames[0] || "",
            referenceImageRoles,
            galleryVisible: false,
          },
        });
        const imageUrl = buildPublicAssetUrl("/output", saved.relativePath, saved.createdAt);

        items = updateCreationItems(items, item.itemId, {
          prompt: repairItem.prompt,
          marketingCopy: repairItem.marketingCopy,
          status: "completed",
          filename,
          relativePath: saved.relativePath,
          imageUrl,
          thumbnailUrl: imageUrl,
          generationStartedAt,
          generationCompletedAt,
          generationDurationMs,
          error: "",
        });
        setManifest = await creationSetStore.saveManifest(
          buildCreationSetManifest({
            setId,
            plan: repairPlan,
            createdAt: existingSet.createdAt,
            updatedAt: generationCompletedAt,
            status: getCreationSetStatus(items),
            relativeDir,
            items,
            referenceImageNames,
          }),
        );

        writeSseEvent(response, "item_saved", {
          setId,
          item: setManifest.items.find((entry) => entry.itemId === item.itemId),
          set: setManifest,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        items = updateCreationItems(items, item.itemId, {
          status: "failed",
          error: message,
        });
        setManifest = await creationSetStore.saveManifest(
          buildCreationSetManifest({
            setId,
            plan: repairPlan,
            createdAt: existingSet.createdAt,
            updatedAt: new Date().toISOString(),
            status: getCreationSetStatus(items),
            relativeDir,
            items,
            referenceImageNames,
          }),
        );
        writeSseEvent(response, "item_failed", {
          setId,
          itemId: item.itemId,
          message,
          set: setManifest,
        });
      } finally {
        if (slotClaimed) {
          releaseSessionTaskSlot(clientSessionId, taskId);
        }
      }
    }

    const finalSet = await creationSetStore.saveManifest(
      buildCreationSetManifest({
        setId,
        plan: repairPlan,
        createdAt: existingSet.createdAt,
        updatedAt: new Date().toISOString(),
        status: getCreationSetStatus(items),
        relativeDir,
        items,
        referenceImageNames,
      }),
    );

    writeSseEvent(response, "complete", { set: finalSet });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (setId && existingSet && repairPlan) {
      await creationSetStore.saveManifest(
        buildCreationSetManifest({
          setId,
          plan: repairPlan,
          createdAt: existingSet.createdAt,
          updatedAt: new Date().toISOString(),
          status: getCreationSetStatus(items),
          relativeDir: existingSet.relativeDir,
          items,
          referenceImageNames,
        }),
      );
    }
    writeSseEvent(response, "error", { message });
  } finally {
    if (!response.destroyed && !response.writableEnded) {
      response.end();
    }
  }
}

async function handleGenerate(request, response) {
  const fallbackTaskId = randomUUID();
  let taskId = fallbackTaskId;
  let clientSessionId = "";
  let slotClaimed = false;
  let taskRegistered = false;

  response.writeHead(200, {
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream; charset=utf-8",
  });

  try {
    writeSseEvent(response, "status", {
      stage: "uploading",
      message: "正在读取提交内容",
    });

    const formData = await readFormDataBody(request);
    taskId = String(formData.get("jobId") || fallbackTaskId).trim() || fallbackTaskId;
    const prompt = String(formData.get("prompt") || "").trim();
    const ratio = String(formData.get("ratio") || "4:5");
    const requestedSizeInput = String(formData.get("size") || "auto").trim().toLowerCase();
    const requestedFormatInput = String(formData.get("format") || "").trim().toLowerCase();
    const generationModeInput = String(formData.get("mode") || "").trim();
    const generationMode = ["style-transfer", "reference-analysis"].includes(generationModeInput) ? generationModeInput : "";
    const styleTransferSourceImageName = String(formData.get("styleTransferSourceImageName") || "").trim();
    const styleTransferReferenceImageName = String(formData.get("styleTransferReferenceImageName") || "").trim();
    clientSessionId = getClientSessionId(request, formData);
    const createdAt = new Date().toISOString();

    function recordRunningTask(patch = {}) {
      taskRegistered = true;
      generationTaskStore.upsertTask(clientSessionId, {
        id: taskId,
        prompt,
        ratio,
        size: requestedSizeInput,
        mode: generationMode,
        generationMode,
        status: "running",
        statusStage: "uploading",
        statusText: "正在读取提交内容",
        createdAt,
        ...patch,
      });
    }

    recordRunningTask();

    if (!prompt) {
      generationTaskStore.failTask(clientSessionId, taskId, {
        errorMessage: "提示词不能为空。",
      });
      writeSseEvent(response, "error", {
        message: "提示词不能为空。",
      });
      return;
    }

    const rawReferenceImages = [
      ...formData.getAll("referenceImages"),
      ...formData.getAll("referenceImage"),
    ];
    const referenceImages = await toReferenceImages(rawReferenceImages);
    if (referenceImages.length > MAX_REFERENCE_IMAGES) {
      generationTaskStore.failTask(clientSessionId, taskId, {
        errorMessage: `参考图最多支持 ${MAX_REFERENCE_IMAGES} 张。`,
      });
      writeSseEvent(response, "error", {
        message: `参考图最多支持 ${MAX_REFERENCE_IMAGES} 张。`,
      });
      return;
    }
    if (generationMode === "style-transfer" && referenceImages.length < 2) {
      generationTaskStore.failTask(clientSessionId, taskId, {
        errorMessage: "风格迁移需要上传原图和风格参考图。",
      });
      writeSseEvent(response, "error", {
        message: "风格迁移需要上传原图和风格参考图。",
      });
      return;
    }

    const config = mergeRequestPrivateConfig(formData, await configStore.readPrivateConfig());
    if (!config.apiKey) {
      generationTaskStore.failTask(clientSessionId, taskId, {
        errorMessage: "当前未保存 API Key，请先在配置中保存。",
      });
      writeSseEvent(response, "error", {
        message: "当前未保存 API Key，请先在配置中保存。",
      });
      return;
    }

    const reasoningEffort = normalizeReasoningEffort(
      formData.get("reasoningEffort") || config.defaults?.reasoningEffort || DEFAULT_REASONING_EFFORT,
    );

    if (!claimSessionTaskSlot(clientSessionId, taskId)) {
      generationTaskStore.failTask(clientSessionId, taskId, {
        errorMessage: `同一会话最多同时并发 ${MAX_PARALLEL_TASKS_PER_SESSION} 个生成任务。`,
      });
      writeSseEvent(response, "error", {
        message: `同一会话最多同时并发 ${MAX_PARALLEL_TASKS_PER_SESSION} 个生成任务。`,
      });
      return;
    }
    slotClaimed = true;

    const ratioOption = resolveAspectRatioOption(ratio);
    const requestedSize = normalizeGenerationSize(ratioOption.value, requestedSizeInput);
    if (requestedSize !== requestedSizeInput && requestedSizeInput !== "") {
      throw new Error(`当前比例 ${ratioOption.value} 不支持分辨率 ${requestedSizeInput}`);
    }

    const finalPrompt = appendRatioHintToPrompt(prompt, ratioOption);
    const finalSize = requestedSize === "auto" ? getDefaultGenerationSize(ratioOption.value) : requestedSize;
    const finalQuality = config.defaults?.quality || "high";
    const finalFormat = normalizeOutputFormat(requestedFormatInput || config.defaults?.format || "png");
    let finalBase64 = "";
    const generationStartedAt = new Date().toISOString();
    const generationStartedAtMs = Date.now();

    generationTaskStore.updateTask(clientSessionId, taskId, {
      ratio: ratioOption.value,
      ratioLabel: ratioOption.label,
      size: finalSize,
      quality: finalQuality,
      format: finalFormat,
      responsesModel: config.responsesModel,
      imageModel: "gpt-image-2",
      hasReferenceImage: referenceImages.length > 0,
      referenceImageNames: referenceImages.map((image) => image.filename),
      referenceImageName: referenceImages[0]?.filename || "",
      mode: generationMode,
      generationMode,
      styleTransferSourceImageName,
      styleTransferReferenceImageName,
      reasoningEffort,
    });

    const generationResult = await requestStudioImageGeneration({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      prompt: finalPrompt,
      referenceImages,
      referenceImageLabels: generationMode === "style-transfer" ? STYLE_TRANSFER_REFERENCE_IMAGE_LABELS : [],
      size: finalSize,
      quality: finalQuality,
      format: toApiOutputFormat(finalFormat),
      responsesModel: config.responsesModel,
      reasoningEffort,
      async onEvent(event) {
        if (event.type === "status") {
          generationTaskStore.updateTask(clientSessionId, taskId, {
            status: "running",
            statusStage: event.stage,
            statusText: event.message,
          });
          writeSseEvent(response, "status", {
            stage: event.stage,
            message: event.message,
          });
          return;
        }

        if (event.type === "partial_image") {
          generationTaskStore.updateTask(clientSessionId, taskId, {
            status: "running",
            statusStage: "generating",
            statusText: "已收到中途预览",
          });
          writeSseEvent(response, "partial_image", {
            dataUrl: event.dataUrl,
          });
          return;
        }

        if (event.type === "final_image") {
          finalBase64 = event.base64;
          generationTaskStore.updateTask(clientSessionId, taskId, {
            status: "running",
            statusStage: "saving",
            statusText: "已拿到最终图像，正在写入本地",
          });
          writeSseEvent(response, "final_image", {
            dataUrl: `data:${toOutputFormatMimeType(finalFormat)};base64,${normalizeBase64(event.base64)}`,
          });
        }
      },
    });
    const generationCompletedAt = new Date().toISOString();
    const generationDurationMs = Math.max(0, Date.now() - generationStartedAtMs);
    const savedSize = generationResult.effectiveSize || finalSize;

    if (!finalBase64) {
      throw new Error("上游响应结束，但没有拿到最终图片。");
    }

    generationTaskStore.updateTask(clientSessionId, taskId, {
      status: "running",
      statusStage: "saving",
      statusText: "正在保存到本地图片目录",
    });
    writeSseEvent(response, "status", {
      stage: "saving",
      message: "正在保存到本地图片目录",
    });

    const filename = createTimestampedFilename({
      format: finalFormat,
      prompt,
      createdAt,
      idSource: taskId,
    });
    const imageBuffer = Buffer.from(normalizeBase64(finalBase64), "base64");
    const saved = await saveGeneratedAsset({
      outputDir,
      filename,
      imageBuffer,
      metadata: {
        prompt,
        createdAt,
        baseUrl: config.baseUrl,
        responsesModel: config.responsesModel,
        imageModel: "gpt-image-2",
        ratio: ratioOption.value,
        ratioLabel: ratioOption.label,
        size: savedSize,
        quality: finalQuality,
        format: finalFormat,
        hasReferenceImage: referenceImages.length > 0,
        referenceImageNames: referenceImages.map((image) => image.filename),
        referenceImageName: referenceImages[0]?.filename || "",
        generationMode,
        styleTransferSourceImageName,
        styleTransferReferenceImageName,
        reasoningEffort,
        generationStartedAt,
        generationCompletedAt,
        generationDurationMs,
      },
    });

    const item = buildSavedItem({
      filename,
      absolutePath: saved.absolutePath,
      relativePath: saved.relativePath,
      createdAt: saved.createdAt,
      prompt,
      baseUrl: config.baseUrl,
      responsesModel: config.responsesModel,
      ratioOption,
      size: savedSize,
      quality: finalQuality,
      format: finalFormat,
      referenceImages,
      reasoningEffort,
      generationMode,
      styleTransferSourceImageName,
      styleTransferReferenceImageName,
      generationStartedAt,
      generationCompletedAt,
      generationDurationMs,
    });

    generationTaskStore.completeTask(clientSessionId, taskId, {
      filename,
      absolutePath: saved.absolutePath,
      relativePath: saved.relativePath,
      size: savedSize,
      generationStartedAt,
      generationCompletedAt,
      generationDurationMs,
      item,
    });

    writeSseEvent(response, "saved", {
      filename,
      absolutePath: saved.absolutePath,
      ratio: ratioOption.value,
      ratioLabel: ratioOption.label,
      size: savedSize,
      item,
    });

    writeSseEvent(response, "complete", {
      filename,
      absolutePath: saved.absolutePath,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (clientSessionId && taskRegistered) {
      generationTaskStore.failTask(clientSessionId, taskId, {
        errorMessage: message,
      });
    }
    writeSseEvent(response, "error", {
      message,
    });
  } finally {
    if (clientSessionId && slotClaimed) {
      releaseSessionTaskSlot(clientSessionId, taskId);
    }
    if (!response.destroyed && !response.writableEnded) {
      response.end();
    }
  }
}

async function routeRequest(request, response) {
  const url = new URL(request.url || "/", "http://localhost");

  if (request.method === "GET" && url.pathname === "/api/config") {
    return handleConfigGet(response);
  }

  if (request.method === "POST" && url.pathname === "/api/config") {
    return handleConfigPost(request, response);
  }

  if (request.method === "GET" && url.pathname === "/api/gallery") {
    return handleGalleryGet(response);
  }

  if (request.method === "GET" && url.pathname === "/api/ppt/decks") {
    return handlePptDecksGet(response);
  }

  if (request.method === "GET" && url.pathname === "/api/creation/sets") {
    return handleCreationSetsGet(response);
  }

  if (request.method === "POST" && url.pathname === "/api/creation/sets/open-folder") {
    return handleCreationSetFolderOpen(request, response);
  }

  if (request.method === "POST" && url.pathname === "/api/creation/sets/paths") {
    return handleCreationSetPathsGet(request, response);
  }

  if (request.method === "POST" && url.pathname === "/api/creation/reference/analyze") {
    return handleCreationReferenceAnalyze(request, response);
  }

  if (request.method === "POST" && url.pathname === "/api/creation/plan") {
    return handleCreationPlan(request, response);
  }

  if (request.method === "GET" && url.pathname === "/api/generation/tasks") {
    return handleGenerationTasksGet(request, response, url);
  }

  if (request.method === "GET" && url.pathname === "/api/prompt-agent/history") {
    return handlePromptAgentHistoryGet(response);
  }

  if (request.method === "POST" && url.pathname === "/api/prompt-agent/analyze") {
    return handlePromptAgentAnalyze(request, response);
  }

  if (request.method === "POST" && url.pathname === "/api/output/open") {
    return handleOpenOutput(response);
  }

  if (request.method === "POST" && url.pathname === "/api/output/delete") {
    return handleDeleteOutput(request, response);
  }

  if (request.method === "POST" && url.pathname === "/api/gallery/metadata") {
    return handleGalleryMetadataRepair(request, response);
  }

  if (request.method === "POST" && url.pathname === "/api/generate") {
    return handleGenerate(request, response);
  }

  if (request.method === "POST" && url.pathname === "/api/creation/generate") {
    return handleCreationGenerate(request, response);
  }

  if (request.method === "POST" && url.pathname === "/api/creation/repair") {
    return handleCreationRepair(request, response);
  }

  if (request.method === "POST" && url.pathname === "/api/ppt/generate") {
    return handlePptGenerate(request, response);
  }

  if (request.method === "POST" && url.pathname === "/api/ppt/complete") {
    return handlePptComplete(request, response);
  }

  if (request.method === "POST" && url.pathname === "/api/ppt/slide/edit") {
    return handlePptSlideEdit(request, response);
  }

  if (request.method === "GET" && url.pathname.startsWith("/output/")) {
    const target = resolveSafeFile(outputDir, url.pathname.slice("/output".length));
    if (!target) {
      return sendText(response, 403, "Forbidden");
    }

    try {
      return await serveFile(response, target);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") {
        return sendText(response, 404, "Not found");
      }

      throw error;
    }
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    return serveFile(response, join(publicDir, "index.html"));
  }

  if (request.method === "GET") {
    const target = resolveSafeFile(publicDir, url.pathname);
    if (!target) {
      return sendText(response, 403, "Forbidden");
    }

    try {
      return await serveFile(response, target);
    } catch (error) {
      if (!(error && typeof error === "object" && error.code === "ENOENT")) {
        throw error;
      }
    }
  }

  if (request.method === "GET" && url.pathname.startsWith("/lib/")) {
    const target = resolveSafeFile(libDir, url.pathname.slice("/lib".length));
    if (!target) {
      return sendText(response, 403, "Forbidden");
    }

    try {
      return await serveFile(response, target);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") {
        return sendText(response, 404, "Not found");
      }

      throw error;
    }
  }

  return sendText(response, 404, "Not found");
}

await mkdir(outputDir, { recursive: true });
await migrateOutputDirectoryMonths({ outputDir });

const server = createServer(async (request, response) => {
  try {
    await routeRequest(request, response);
  } catch (error) {
    if (!response.headersSent) {
      sendJson(response, 500, {
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    response.end();
  }
});

server.listen(port, () => {
  const now = new Date();
  console.log(`Responses Image Studio 正在运行: http://localhost:${port}`);
  console.log(`输出根目录: ${outputDir}`);
  console.log(`当前输出目录: ${join(outputDir, formatMonthFolder(now), formatDayFolder(now))}`);
  console.log(`配置文件: ${configStore.configPath}`);
});
