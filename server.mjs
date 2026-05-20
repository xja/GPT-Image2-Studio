import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat } from "node:fs/promises";
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
  IMAGE_DECOMPOSITION_ASSET_KIND,
  IMAGE_DECOMPOSITION_MODE,
  IMAGE_DECOMPOSITION_REFERENCE_LABEL,
  buildImageDecompositionPrompt,
  normalizeImageDecompositionFeatureCards,
} from "./lib/image-decomposition-prompt.mjs";
import {
  normalizeOutputFormat,
  toApiOutputFormat,
  toOutputFormatMimeType,
} from "./lib/output-format-options.mjs";
import { GENERATION_STREAM_EVENTS } from "./lib/generation-stream-protocol.mjs";
import { writeNodeSseEvent } from "./lib/sse-writer.mjs";
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
import { runWithConcurrency } from "./lib/limited-concurrency.mjs";
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
  normalizeCreationLogoOptions,
  normalizeCreationReferenceAnalysis,
  normalizeCreationReferenceRoles,
} from "./lib/creation-planner.mjs";
import {
  CREATION_LOGO_BATCH_REFERENCE_LABELS,
  buildCreationLogoBatchPlan,
} from "./lib/creation-logo-batch.mjs";
import { applyCreationRepairOverrides, selectCreationRepairItems } from "./lib/creation-repair.mjs";
import { buildCreationRelativeDir, createCreationSetStore } from "./lib/creation-store.mjs";
import {
  buildArticleBundle,
  buildArticleImagePrompt,
  DEFAULT_ARTICLE_ILLUSTRATION_STYLE_PRESET,
  generateArticleIllustrationPlan,
} from "./lib/article-illustration-planner.mjs";
import { buildArticleRelativeDir, createArticleIllustrationSetStore } from "./lib/article-illustration-store.mjs";

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
const articleIllustrationSetStore = createArticleIllustrationSetStore({ outputDir, publicBasePath: "/output" });
const port = Number(process.env.PORT || 3600);
const activeTasksBySessionScope = new Map();
const PPT_SOURCE_EXTENSIONS = new Set([".pdf", ".docx", ".pptx", ".txt", ".md", ".csv"]);
const ARTICLE_SOURCE_EXTENSIONS = new Set([".txt", ".md", ".csv", ".json"]);
const PPT_SLIDE_SIZE = "2048x1152";
const PPT_SLIDE_FORMAT = "png";
const ARTICLE_ILLUSTRATION_FORMAT = "png";
const MOCK_IMAGE_GENERATION_ENABLED = process.env.IMAGE_STUDIO_MOCK_IMAGE_GENERATION === "1";
const MOCK_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==";
const STYLE_TRANSFER_REFERENCE_IMAGE_LABELS = [
  "Reference image 1: SOURCE image. Preserve content, identity, pose, composition, and layout only. Do not preserve its visual style.",
  "Reference image 2: STYLE reference. This image is the style authority for final rendering, realism level, lighting, texture, color, and material finish.",
];
const STYLE_TRANSFER_SOURCE_IMAGE_LABELS = [STYLE_TRANSFER_REFERENCE_IMAGE_LABELS[0]];
const GENERATION_MODES = new Set(["style-transfer", "reference-analysis", IMAGE_DECOMPOSITION_MODE]);

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

function getStyleTransferReferenceImageLabels(generationMode, styleTransferStylePreset) {
  if (generationMode === IMAGE_DECOMPOSITION_MODE) {
    return [IMAGE_DECOMPOSITION_REFERENCE_LABEL];
  }
  if (generationMode !== "style-transfer") {
    return [];
  }
  const hasStyleTransferPreset = Boolean(styleTransferStylePreset);
  return hasStyleTransferPreset ? STYLE_TRANSFER_SOURCE_IMAGE_LABELS : STYLE_TRANSFER_REFERENCE_IMAGE_LABELS;
}

function normalizeGenerationMode(value) {
  const mode = String(value || "").trim();
  return GENERATION_MODES.has(mode) ? mode : "";
}

function getStudioGenerationRequestScope(generationMode) {
  return generationMode || "prompt";
}

function getGenerationTaskSlotScopeKey(sessionId, requestScope) {
  const scope = String(requestScope || "prompt").trim() || "prompt";
  return `${sessionId}\n${scope}`;
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
  return writeNodeSseEvent(response, type, payload);
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

function claimSessionTaskSlot(sessionId, taskId, requestScope) {
  const scopeKey = getGenerationTaskSlotScopeKey(sessionId, requestScope);
  const activeTasks = activeTasksBySessionScope.get(scopeKey) || new Set();
  if (activeTasks.size >= MAX_PARALLEL_TASKS_PER_SESSION) {
    return false;
  }

  activeTasks.add(taskId);
  activeTasksBySessionScope.set(scopeKey, activeTasks);
  return true;
}

function releaseSessionTaskSlot(sessionId, taskId, requestScope) {
  const scopeKey = getGenerationTaskSlotScopeKey(sessionId, requestScope);
  const activeTasks = activeTasksBySessionScope.get(scopeKey);
  if (!activeTasks) {
    return;
  }

  activeTasks.delete(taskId);
  if (activeTasks.size === 0) {
    activeTasksBySessionScope.delete(scopeKey);
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
    mkdir(join(todayOutputDir, `${todayDateFolder}-prompt`), { recursive: true }),
    mkdir(join(todayOutputDir, `${todayDateFolder}-style-transfer`), { recursive: true }),
    mkdir(join(todayOutputDir, `${todayDateFolder}-reference-analysis`), { recursive: true }),
    mkdir(join(todayOutputDir, `${todayDateFolder}-image-decomposition`), { recursive: true }),
    mkdir(join(todayOutputDir, `${todayDateFolder}-ppt`), { recursive: true }),
    mkdir(join(todayOutputDir, `${todayDateFolder}-creation`), { recursive: true }),
    mkdir(join(todayOutputDir, `${todayDateFolder}-article`), { recursive: true }),
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

async function readCreationLogoImage(formData) {
  const logoImages = await toReferenceImages([
    ...formData.getAll("logoImage"),
    ...formData.getAll("creationLogoImage"),
  ]);
  if (logoImages.length > 1) {
    throw new Error("Logo 最多只能上传 1 张。");
  }
  if (logoImages.some((image) => !String(image.mimeType || "").startsWith("image/"))) {
    throw new Error("Logo 仅支持图片文件。");
  }
  return logoImages[0] || null;
}

function buildCreationLogoOptionsFromFormData(formData, logoImage = null) {
  const submittedLogo = normalizeCreationLogoOptions(formData.get("logoOptions"));
  return normalizeCreationLogoOptions({
    ...submittedLogo,
    filename: logoImage?.filename || submittedLogo.filename,
    enabled: Boolean(logoImage) || submittedLogo.enabled,
    placement: formData.get("logoPlacement") || submittedLogo.placement,
    background: formData.get("logoBackground") || submittedLogo.background,
  });
}

function appendCreationLogoReference(referenceImages = [], logoImage = null) {
  return logoImage ? [...referenceImages, logoImage] : referenceImages;
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

async function toArticleTextSources(files) {
  const validFiles = files.filter(
    (file) => file && typeof file === "object" && typeof file.arrayBuffer === "function" && file.size > 0,
  );

  return Promise.all(
    validFiles.map(async (file, index) => {
      const filename = String(file.name || `article-source-${index + 1}.txt`).trim();
      const extension = extname(filename).toLowerCase();
      if (!ARTICLE_SOURCE_EXTENSIONS.has(extension)) {
        throw new Error("文章插图第一版仅支持 TXT / MD / CSV / JSON 文本文件。");
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      return {
        filename,
        mimeType: file.type || "text/plain",
        text: buffer.toString("utf8").replace(/^\uFEFF/, ""),
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
  styleTransferStylePreset = "",
  assetKind = "",
  targetLanguage = "",
  sourceImageName = "",
  featureCardsEnabled = false,
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
    styleTransferStylePreset,
    assetKind,
    targetLanguage,
    sourceImageName,
    featureCardsEnabled,
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
  if (!items.length) {
    return "failed";
  }

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
    dimensionUnitMode: plan.dimensionUnitMode,
    dimensionUnitModeLabel: plan.dimensionUnitModeLabel,
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
    logo: plan.logo || null,
    createdAt,
    updatedAt: updatedAt || createdAt,
    status,
    relativeDir,
    items,
  };
}

function sanitizeCreationFilenameToken(value, fallback = "creation") {
  const token = String(value || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "")
    .trim();
  return token || fallback;
}

function buildCreationImageFilename({ item, createdAt, setId, format }) {
  const filenameToken = sanitizeCreationFilenameToken(item.title || item.filenameToken || item.role || item.itemId, "creation");
  const baseName = createTimestampedFilename({
    format,
    prompt: item.title || item.filenameToken || item.role || item.prompt,
    createdAt,
    idSource: `${setId}-${item.slotIndex || item.itemId}`,
  });
  return `${String(item.slotIndex).padStart(2, "0")}-${filenameToken}-${baseName}`;
}

function parseStringArrayJson(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item || "").trim()).filter(Boolean) : [];
  } catch {
    return raw
      .split(/[,\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function updateArticleItems(items, itemId, patch = {}) {
  return items.map((item) => (item.itemId === itemId ? { ...item, ...patch } : item));
}

function getArticleSetStatus(items) {
  if (!items.length) {
    return "planned";
  }

  const generatingCount = items.filter((item) => item.status === "generating").length;
  const completedCount = items.filter((item) => item.status === "completed").length;
  const failedCount = items.filter((item) => item.status === "failed").length;

  if (generatingCount > 0) {
    return "generating";
  }

  if (completedCount === items.length) {
    return "completed";
  }

  if (failedCount === items.length) {
    return "failed";
  }

  if (failedCount > 0) {
    return "partial_failed";
  }

  if (completedCount > 0) {
    return "in_progress";
  }

  return "planned";
}

function syncArticleReferenceCardsFromItems(referenceCards = [], items = []) {
  return referenceCards.map((card) => {
    const cardItem = items.find((item) => item.itemKind === "reference-card" && item.cardId === card.cardId);
    if (!cardItem) {
      return card;
    }

    return {
      ...card,
      itemId: cardItem.itemId,
      relativePath: cardItem.relativePath || card.relativePath || "",
      imageUrl: cardItem.imageUrl || card.imageUrl || "",
    };
  });
}

function buildArticleSetManifest({
  setId,
  plan,
  articleBundle,
  createdAt,
  updatedAt,
  status,
  relativeDir,
  items,
}) {
  return {
    setId,
    title: plan.title,
    sourceSummary: plan.sourceSummary || articleBundle?.sourceSummary || "",
    contentType: plan.contentType,
    stylePreset: plan.stylePreset,
    styleBible: plan.styleBible,
    recommendedImageCount: plan.recommendedImageCount || items.length,
    articleBundle: articleBundle || null,
    characters: plan.characters || [],
    scenes: plan.scenes || [],
    referenceCards: syncArticleReferenceCardsFromItems(plan.referenceCards || [], items),
    createdAt,
    updatedAt: updatedAt || createdAt,
    status,
    relativeDir,
    items,
  };
}

function normalizeArticleFilenameToken(value, fallback = "article") {
  const sanitized = String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 34);
  return sanitized || fallback;
}

function buildArticleImageFilename({ item, createdAt, setId, format }) {
  const filenameToken = normalizeArticleFilenameToken(
    item.itemKind === "reference-card" ? `ref-${item.cardId || item.itemId}` : item.title || item.itemId,
    item.itemKind === "reference-card" ? "reference" : "illustration",
  );
  const baseName = createTimestampedFilename({
    format,
    prompt: `${item.title} ${item.prompt}`,
    createdAt,
    idSource: `${setId}-${item.itemId}`,
  });
  return `${String(item.slotIndex).padStart(2, "0")}-${filenameToken}-${baseName}`;
}

async function getArticleReferenceImagesForItem(items = [], item = {}) {
  if (item.itemKind === "reference-card") {
    return [];
  }

  const referencedCardIds = new Set(Array.isArray(item.referencedCardIds) ? item.referencedCardIds : []);
  const completedReferenceItems = items.filter(
    (entry) =>
      entry.itemKind === "reference-card" &&
      entry.status === "completed" &&
      entry.relativePath &&
      (!referencedCardIds.size || referencedCardIds.has(entry.cardId)),
  );
  const selectedReferenceItems = completedReferenceItems.slice(0, MAX_REFERENCE_IMAGES);

  const referenceImages = [];
  for (const referenceItem of selectedReferenceItems) {
    const absolutePath = resolveSafeOutputPath(referenceItem.relativePath);
    if (!absolutePath) {
      continue;
    }
    const buffer = await readFile(absolutePath);
    referenceImages.push({
      filename: referenceItem.filename || basename(absolutePath),
      mimeType: getMimeType(absolutePath),
      buffer,
      base64: buffer.toString("base64"),
    });
  }

  return referenceImages;
}

function buildArticleReferenceImageLabels(referenceImages = []) {
  return referenceImages.map(
    (image, index) =>
      `Reference card ${index + 1}: ${image.filename}. Preserve only character identity, recurring scene geography, lighting, palette, and visual continuity from this reference.`,
  );
}

async function handleArticleIllustrationSetsGet(response) {
  sendJson(response, 200, await articleIllustrationSetStore.listManifests(), {
    "Cache-Control": "no-store",
  });
}

async function handleArticleIllustrationPlan(request, response) {
  try {
    const formData = await readFormDataBody(request);
    const sourceFiles = await toArticleTextSources([
      ...formData.getAll("sourceFiles"),
      ...formData.getAll("sourceFile"),
    ]);
    const articleBundle = buildArticleBundle({
      title: formData.get("title"),
      sourceText: formData.get("sourceText"),
      sourceFiles,
      supplementalPrompt: formData.get("supplementalPrompt"),
    });
    const config = mergeRequestPrivateConfig(formData, await configStore.readPrivateConfig());
    if (!config.apiKey) {
      return sendJson(response, 400, {
        message: "当前未保存 API Key，请先在配置中保存。",
      });
    }

    const reasoningEffort = normalizeReasoningEffort(
      formData.get("reasoningEffort") || config.defaults?.reasoningEffort || DEFAULT_REASONING_EFFORT,
    );
    const plan = await generateArticleIllustrationPlan({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      responsesModel: config.responsesModel,
      reasoningEffort,
      bundle: articleBundle,
      contentType: formData.get("contentType") || "auto",
      stylePreset: formData.get("stylePreset") || DEFAULT_ARTICLE_ILLUSTRATION_STYLE_PRESET,
    });
    const setId = `article-set-${randomUUID()}`;
    const createdAt = new Date().toISOString();
    const articleRelativeDir = buildArticleRelativeDir({
      createdAt,
      title: plan.title || articleBundle.title,
      setId,
    });
    const items = plan.items.map((item) => ({
      ...item,
      status: "planned",
      filename: "",
      relativePath: "",
      imageUrl: "",
      thumbnailUrl: "",
      error: "",
    }));
    const setManifest = await articleIllustrationSetStore.saveManifest(
      buildArticleSetManifest({
        setId,
        plan,
        articleBundle,
        createdAt,
        status: "planned",
        relativeDir: articleRelativeDir,
        items,
      }),
    );

    return sendJson(response, 200, {
      ok: true,
      plan,
      set: setManifest,
    });
  } catch (error) {
    return sendJson(response, 400, {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function handleArticleIllustrationGenerate(request, response, { referenceOnly = false } = {}) {
  response.writeHead(200, {
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream; charset=utf-8",
  });

  let setId = "";
  let setManifest = null;
  let items = [];
  let plan = null;
  let createdAt = new Date().toISOString();
  let articleRelativeDir = "";

  try {
    const formData = await readFormDataBody(request);
    setId = String(formData.get("setId") || "").trim();
    if (!setId) {
      throw new Error("缺少文章插图记录 ID。");
    }

    setManifest = await articleIllustrationSetStore.readManifest(setId);
    createdAt = setManifest.createdAt || new Date().toISOString();
    articleRelativeDir =
      setManifest.relativeDir ||
      buildArticleRelativeDir({
        createdAt,
        title: setManifest.title,
        setId,
      });
    items = Array.isArray(setManifest.items) ? setManifest.items : [];
    const styleBibleOverride = String(formData.get("styleBible") || "").trim();
    if (styleBibleOverride) {
      setManifest = {
        ...setManifest,
        styleBible: styleBibleOverride,
        updatedAt: new Date().toISOString(),
      };
    }
    const itemOverrides = (() => {
      const raw = String(formData.get("items") || "").trim();
      if (!raw) {
        return [];
      }
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();
    if (itemOverrides.length > 0) {
      const overridesById = new Map(
        itemOverrides
          .map((override) => [String(override?.itemId || "").trim(), override])
          .filter(([itemId]) => itemId),
      );
      items = items.map((item) => {
        const override = overridesById.get(item.itemId);
        if (!override) {
          return item;
        }
        return {
          ...item,
          title: String(override.title || item.title || "").trim(),
          paragraphIndex: Number(override.paragraphIndex) || Number(item.paragraphIndex) || 0,
          timelineIndex: Number(override.timelineIndex) || Number(item.timelineIndex) || 0,
          narrativeBeat: String(override.narrativeBeat || item.narrativeBeat || "").trim(),
          prompt: String(override.prompt || item.prompt || "").trim(),
          captionText: String(override.captionText || item.captionText || "").trim(),
          modelTextHint: String(override.modelTextHint || item.modelTextHint || "").trim(),
        };
      });
    }
    plan = {
      title: setManifest.title,
      sourceSummary: setManifest.sourceSummary,
      contentType: setManifest.contentType,
      stylePreset: setManifest.stylePreset,
      styleBible: setManifest.styleBible,
      recommendedImageCount: setManifest.recommendedImageCount || items.length,
      characters: setManifest.characters || [],
      scenes: setManifest.scenes || [],
      referenceCards: setManifest.referenceCards || [],
      items,
    };

    const requestedItemIds = new Set(parseStringArrayJson(formData.get("itemIds")));
    const regenerate = String(formData.get("regenerate") || "") === "1";
    const targetItems = items.filter((item) => {
      if (referenceOnly && item.itemKind !== "reference-card") {
        return false;
      }
      if (requestedItemIds.size && !requestedItemIds.has(item.itemId)) {
        return false;
      }
      return regenerate || item.status !== "completed" || !item.relativePath;
    });

    const config = mergeRequestPrivateConfig(formData, await configStore.readPrivateConfig());
    if (!config.apiKey) {
      writeSseEvent(response, "error", {
        message: "当前未保存 API Key，请先在配置中保存。",
      });
      return;
    }

    const clientSessionId = getClientSessionId(request, formData);
    const generationRequestScope = "article-illustration";
    const ratioOption = resolveAspectRatioOption(String(formData.get("ratio") || "3:2"));
    const requestedSizeInput = String(formData.get("size") || "auto").trim().toLowerCase();
    const requestedSize = normalizeGenerationSize(ratioOption.value, requestedSizeInput);
    if (requestedSize !== requestedSizeInput && requestedSizeInput !== "") {
      throw new Error(`当前比例 ${ratioOption.value} 不支持分辨率 ${requestedSizeInput}`);
    }

    const finalSize = requestedSize === "auto" ? getDefaultGenerationSize(ratioOption.value) : requestedSize;
    const finalQuality = config.defaults?.quality || "high";
    const finalFormat = normalizeOutputFormat(String(formData.get("format") || config.defaults?.format || ARTICLE_ILLUSTRATION_FORMAT));
    const reasoningEffort = normalizeReasoningEffort(
      formData.get("reasoningEffort") || config.defaults?.reasoningEffort || DEFAULT_REASONING_EFFORT,
    );

    setManifest = await articleIllustrationSetStore.saveManifest(
      buildArticleSetManifest({
        setId,
        plan,
        articleBundle: setManifest.articleBundle,
        createdAt,
        updatedAt: new Date().toISOString(),
        status: referenceOnly ? "reference_generating" : "generating",
        relativeDir: articleRelativeDir,
        items,
      }),
    );

    writeSseEvent(response, referenceOnly ? "references_started" : "set_started", {
      set: setManifest,
      targetCount: targetItems.length,
    });

    if (targetItems.length === 0) {
      const finalSet = await articleIllustrationSetStore.saveManifest(
        buildArticleSetManifest({
          setId,
          plan,
          articleBundle: setManifest.articleBundle,
          createdAt,
          updatedAt: new Date().toISOString(),
          status: getArticleSetStatus(items),
          relativeDir: articleRelativeDir,
          items,
        }),
      );
      writeSseEvent(response, "complete", { set: finalSet });
      return;
    }

    for (const item of targetItems) {
      const taskId = `${setId}-${item.itemId}`;
      const generationStartedAt = new Date().toISOString();
      const generationStartedAtMs = Date.now();
      let finalBase64 = "";
      let slotClaimed = false;

      try {
        if (!claimSessionTaskSlot(clientSessionId, taskId, generationRequestScope)) {
          throw new Error(`同一会话最多同时并发 ${MAX_PARALLEL_TASKS_PER_SESSION} 个生成任务。`);
        }
        slotClaimed = true;
        items = updateArticleItems(items, item.itemId, {
          status: "generating",
          error: "",
          generationStartedAt,
        });
        writeSseEvent(response, "item_started", {
          setId,
          itemId: item.itemId,
          itemKind: item.itemKind,
          title: item.title,
        });

        const referenceImages = await getArticleReferenceImagesForItem(items, item);
        const referenceCards = (plan.referenceCards || []).filter((card) => {
          if (item.itemKind === "reference-card") {
            return card.cardId === item.cardId;
          }
          return !item.referencedCardIds?.length || item.referencedCardIds.includes(card.cardId);
        });
        const prompt = appendRatioHintToPrompt(
          buildArticleImagePrompt({ plan, item, referenceCards }),
          ratioOption,
        );
        const generationResult = await requestStudioImageGeneration({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          prompt,
          referenceImages,
          referenceImageLabels: buildArticleReferenceImageLabels(referenceImages),
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
          throw new Error("上游响应结束，但没有拿到最终文章插图。");
        }

        const generationCompletedAt = new Date().toISOString();
        const generationDurationMs = Math.max(0, Date.now() - generationStartedAtMs);
        const savedSize = generationResult.effectiveSize || finalSize;
        const filename = buildArticleImageFilename({
          item,
          createdAt,
          setId,
          format: finalFormat,
        });
        const saved = await saveGeneratedAsset({
          outputDir,
          relativeDir: articleRelativeDir,
          filename,
          imageBuffer: Buffer.from(normalizeBase64(finalBase64), "base64"),
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
            reasoningEffort,
            generationStartedAt,
            generationCompletedAt,
            generationDurationMs,
            assetKind: "article-illustration-image",
            articleSetId: setId,
            articleItemId: item.itemId,
            articleItemKind: item.itemKind,
            articleTitle: setManifest.title,
            articleContentType: setManifest.contentType,
            articleStylePreset: setManifest.stylePreset,
            articleCaptionText: item.captionText || "",
            articleModelTextHint: item.modelTextHint || "",
            hasReferenceImage: referenceImages.length > 0,
            referenceImageNames: referenceImages.map((image) => image.filename),
            galleryVisible: false,
          },
        });
        const imageUrl = buildPublicAssetUrl("/output", saved.relativePath, saved.createdAt);

        items = updateArticleItems(items, item.itemId, {
          status: "completed",
          filename,
          relativePath: saved.relativePath,
          imageUrl,
          thumbnailUrl: imageUrl,
          generationStartedAt,
          generationCompletedAt,
          generationDurationMs,
          size: savedSize,
          format: finalFormat,
        });
        plan = {
          ...plan,
          referenceCards: syncArticleReferenceCardsFromItems(plan.referenceCards || [], items),
          items,
        };
        setManifest = await articleIllustrationSetStore.saveManifest(
          buildArticleSetManifest({
            setId,
            plan,
            articleBundle: setManifest.articleBundle,
            createdAt,
            updatedAt: generationCompletedAt,
            status: getArticleSetStatus(items),
            relativeDir: articleRelativeDir,
            items,
          }),
        );

        writeSseEvent(response, "item_saved", {
          setId,
          item: setManifest.items.find((entry) => entry.itemId === item.itemId),
          set: setManifest,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        items = updateArticleItems(items, item.itemId, {
          status: "failed",
          error: message,
        });
        plan = {
          ...plan,
          referenceCards: syncArticleReferenceCardsFromItems(plan.referenceCards || [], items),
          items,
        };
        setManifest = await articleIllustrationSetStore.saveManifest(
          buildArticleSetManifest({
            setId,
            plan,
            articleBundle: setManifest.articleBundle,
            createdAt,
            updatedAt: new Date().toISOString(),
            status: getArticleSetStatus(items),
            relativeDir: articleRelativeDir,
            items,
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
          releaseSessionTaskSlot(clientSessionId, taskId, generationRequestScope);
        }
      }
    }

    plan = {
      ...plan,
      referenceCards: syncArticleReferenceCardsFromItems(plan.referenceCards || [], items),
      items,
    };
    const finalSet = await articleIllustrationSetStore.saveManifest(
      buildArticleSetManifest({
        setId,
        plan,
        articleBundle: setManifest.articleBundle,
        createdAt,
        updatedAt: new Date().toISOString(),
        status: getArticleSetStatus(items),
        relativeDir: articleRelativeDir,
        items,
      }),
    );
    writeSseEvent(response, "complete", { set: finalSet });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (setId && setManifest && plan) {
      await articleIllustrationSetStore.saveManifest(
        buildArticleSetManifest({
          setId,
          plan,
          articleBundle: setManifest.articleBundle,
          createdAt,
          updatedAt: new Date().toISOString(),
          status: getArticleSetStatus(items),
          relativeDir: articleRelativeDir,
          items,
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
      dimensionUnitMode: formData.get("dimensionUnitMode"),
      targetLanguage: formData.get("targetLanguage"),
      imageCount: formData.get("imageCount"),
      scenario: formData.get("scenario"),
      industryTemplate: formData.get("industryTemplate"),
      selectedRoles: formData.get("selectedRoles"),
      referenceImageRoles,
      logoOptions: buildCreationLogoOptionsFromFormData(formData),
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
  let generationReferenceImages = [];
  let logoImage = null;
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
    logoImage = await readCreationLogoImage(formData);
    if (referenceImages.length > MAX_REFERENCE_IMAGES) {
      throw new Error(`参考图最多支持 ${MAX_REFERENCE_IMAGES} 张。`);
    }
    if (referenceImages.some((image) => !String(image.mimeType || "").startsWith("image/"))) {
      throw new Error("仅支持图片参考文件。");
    }
    generationReferenceImages = appendCreationLogoReference(referenceImages, logoImage);
    referenceImageNames = referenceImages.map((image) => image.filename).filter(Boolean);
    referenceImageRoles = normalizeCreationReferenceRoles(formData.get("referenceImageRoles"));
    plan = buildCreationPlan({
      productName: formData.get("productName"),
      productDescription: formData.get("productDescription"),
      sellingPoints: formData.get("sellingPoints"),
      dimensionSpecs: formData.get("dimensionSpecs"),
      dimensionUnitMode: formData.get("dimensionUnitMode"),
      targetLanguage: formData.get("targetLanguage"),
      imageCount: formData.get("imageCount"),
      scenario: formData.get("scenario"),
      industryTemplate: formData.get("industryTemplate"),
      selectedRoles: formData.get("selectedRoles"),
      referenceImageRoles,
      logoOptions: buildCreationLogoOptionsFromFormData(formData, logoImage),
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
    const generationRequestScope = "creation";
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

    await runWithConcurrency(plan.items, MAX_PARALLEL_TASKS_PER_SESSION, async (item) => {
      const taskId = `${setId}-${item.itemId}`;
      const generationStartedAt = new Date().toISOString();
      const generationStartedAtMs = Date.now();
      let finalBase64 = "";
      let slotClaimed = false;

      try {
        if (!claimSessionTaskSlot(clientSessionId, taskId, generationRequestScope)) {
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
          referenceImages: generationReferenceImages,
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
            hasReferenceImage: generationReferenceImages.length > 0,
            referenceImageNames,
            referenceImageName: referenceImageNames[0] || "",
            referenceImageRoles,
            hasCreationLogo: Boolean(plan.logo),
            creationLogo: plan.logo,
            creationLogoImageName: plan.logo?.filename || "",
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
          releaseSessionTaskSlot(clientSessionId, taskId, generationRequestScope);
        }
      }
    });

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

async function handleCreationLogoBatchGenerate(request, response) {
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
  let sourceImages = [];
  let logoImage = null;
  let referenceImageNames = [];

  try {
    const formData = await readFormDataBody(request);
    setId = `creation-set-${randomUUID()}`;
    createdAt = new Date().toISOString();
    sourceImages = await toReferenceImages([
      ...formData.getAll("sourceImages"),
      ...formData.getAll("logoBatchSourceImages"),
    ]);
    logoImage = await readCreationLogoImage(formData);
    if (sourceImages.length === 0) {
      throw new Error("请先上传需要添加 Logo 的图片。");
    }
    if (sourceImages.length > MAX_REFERENCE_IMAGES) {
      throw new Error(`上传图加 Logo 最多支持 ${MAX_REFERENCE_IMAGES} 张。`);
    }
    if (sourceImages.some((image) => !String(image.mimeType || "").startsWith("image/"))) {
      throw new Error("上传图加 Logo 仅支持图片文件。");
    }
    if (!logoImage) {
      throw new Error("请先上传 Logo。");
    }

    plan = buildCreationLogoBatchPlan({
      title: formData.get("title") || formData.get("productName"),
      sourceImages,
      logoOptions: buildCreationLogoOptionsFromFormData(formData, logoImage),
    });
    referenceImageNames = plan.referenceImageNames || sourceImages.map((image) => image.filename).filter(Boolean);

    const config = mergeRequestPrivateConfig(formData, await configStore.readPrivateConfig());
    if (!config.apiKey) {
      writeSseEvent(response, "error", {
        message: "当前未保存 API Key，请先在配置中保存。",
      });
      return;
    }

    const clientSessionId = getClientSessionId(request, formData);
    const generationRequestScope = "creation";
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
      productName: plan.productName,
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

    await runWithConcurrency(plan.items, MAX_PARALLEL_TASKS_PER_SESSION, async (item) => {
      const sourceImage = sourceImages[item.sourceImageIndex] || sourceImages[(item.slotIndex || 1) - 1];
      const taskId = `${setId}-${item.itemId}`;
      const generationStartedAt = new Date().toISOString();
      const generationStartedAtMs = Date.now();
      let finalBase64 = "";
      let slotClaimed = false;

      try {
        if (!sourceImage) {
          throw new Error("找不到对应的上传源图。");
        }
        if (!claimSessionTaskSlot(clientSessionId, taskId, generationRequestScope)) {
          throw new Error(`同一会话最大同时并发 ${MAX_PARALLEL_TASKS_PER_SESSION} 个生成任务。`);
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
          referenceImages: [sourceImage, logoImage],
          referenceImageLabels: CREATION_LOGO_BATCH_REFERENCE_LABELS,
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
            assetKind: "creation-logo-batch-image",
            creationSetId: setId,
            creationItemId: item.itemId,
            creationRole: item.role,
            targetLanguage: plan.targetLanguage,
            creationScenario: plan.scenario,
            creationIndustryTemplate: plan.industryTemplate,
            creationImageCount: plan.imageCount,
            hasReferenceImage: true,
            referenceImageNames,
            referenceImageName: sourceImage.filename,
            referenceImageRoles: [plan.referenceImageRoles[item.sourceImageIndex]].filter(Boolean),
            sourceImageName: sourceImage.filename,
            hasCreationLogo: Boolean(plan.logo),
            creationLogo: plan.logo,
            creationLogoImageName: plan.logo?.filename || "",
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
          releaseSessionTaskSlot(clientSessionId, taskId, generationRequestScope);
        }
      }
    });

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
    if (setId && plan && items.length > 0) {
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
    const logoImage = await readCreationLogoImage(formData);
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
    const logoOptions = logoImage
      ? buildCreationLogoOptionsFromFormData(formData, logoImage)
      : existingSet.logo || buildCreationLogoOptionsFromFormData(formData);
    const normalizedLogoOptions = normalizeCreationLogoOptions(logoOptions);
    const generationReferenceImages = appendCreationLogoReference(referenceImages, logoImage);

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
      dimensionUnitMode: existingSet.dimensionUnitMode,
      dimensionUnitModeLabel: existingSet.dimensionUnitModeLabel,
      targetLanguage: existingSet.targetLanguage,
      targetLanguageLabel: existingSet.targetLanguageLabel,
      imageCount: existingSet.imageCount,
      scenario: existingSet.scenario,
      scenarioLabel: existingSet.scenarioLabel,
      industryTemplate: existingSet.industryTemplate || "general",
      industryTemplateLabel: existingSet.industryTemplateLabel || "",
      industryTemplatePath: existingSet.industryTemplatePath || "",
      referenceImageRoles,
      logo: normalizedLogoOptions.enabled ? normalizedLogoOptions : existingSet.logo || null,
    };

    const clientSessionId = getClientSessionId(request, formData);
    const generationRequestScope = "creation";
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

    await runWithConcurrency(repairItems, MAX_PARALLEL_TASKS_PER_SESSION, async (item) => {
      const repairItem = item;
      const taskId = `${setId}-repair-${item.itemId}`;
      const generationStartedAt = new Date().toISOString();
      const generationStartedAtMs = Date.now();
      let finalBase64 = "";
      let slotClaimed = false;

      try {
        if (!claimSessionTaskSlot(clientSessionId, taskId, generationRequestScope)) {
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
          referenceImages: generationReferenceImages,
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
            hasReferenceImage: generationReferenceImages.length > 0,
            referenceImageNames,
            referenceImageName: referenceImageNames[0] || "",
            referenceImageRoles,
            hasCreationLogo: Boolean(repairPlan.logo),
            creationLogo: repairPlan.logo,
            creationLogoImageName: repairPlan.logo?.filename || "",
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
          releaseSessionTaskSlot(clientSessionId, taskId, generationRequestScope);
        }
      }
    });

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
  let generationRequestScope = "prompt";
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
    let prompt = String(formData.get("prompt") || "").trim();
    const ratio = String(formData.get("ratio") || "4:5");
    const requestedSizeInput = String(formData.get("size") || "auto").trim().toLowerCase();
    const requestedFormatInput = String(formData.get("format") || "").trim().toLowerCase();
    const generationModeInput = String(formData.get("mode") || "").trim();
    const generationMode = normalizeGenerationMode(generationModeInput);
    generationRequestScope = getStudioGenerationRequestScope(generationMode);
    const isImageDecomposition = generationMode === IMAGE_DECOMPOSITION_MODE;
    const targetLanguageInput = String(formData.get("targetLanguage") || "").trim();
    const customTargetLanguageInput = String(formData.get("customTargetLanguage") || "").trim();
    const featureCardsEnabled = normalizeImageDecompositionFeatureCards(formData.get("featureCardsEnabled"));
    const styleTransferSourceImageName = String(formData.get("styleTransferSourceImageName") || "").trim();
    const styleTransferReferenceImageName = String(formData.get("styleTransferReferenceImageName") || "").trim();
    const styleTransferStylePreset = String(formData.get("styleTransferStylePreset") || "").trim();
    let targetLanguage = "";
    let sourceImageName = "";
    let assetKind = "";
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

    if (!prompt && !isImageDecomposition) {
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
    if (isImageDecomposition && referenceImages.length !== 1) {
      generationTaskStore.failTask(clientSessionId, taskId, {
        errorMessage: "图片拆解模式需要且只支持上传一张源图。",
      });
      writeSseEvent(response, "error", {
        message: "图片拆解模式需要且只支持上传一张源图。",
      });
      return;
    }

    if (isImageDecomposition) {
      const decompositionPrompt = buildImageDecompositionPrompt({
        targetLanguage: targetLanguageInput,
        customLanguage: customTargetLanguageInput,
        featureCardsEnabled,
      });
      prompt = decompositionPrompt.prompt;
      targetLanguage = decompositionPrompt.targetLanguage;
      sourceImageName = referenceImages[0]?.filename || "";
      assetKind = IMAGE_DECOMPOSITION_ASSET_KIND;
      generationTaskStore.updateTask(clientSessionId, taskId, {
        prompt,
        targetLanguage,
        sourceImageName,
        assetKind,
        featureCardsEnabled,
      });
    }

    const hasStyleTransferPreset = Boolean(styleTransferStylePreset);
    if (generationMode === "style-transfer" && referenceImages.length < (hasStyleTransferPreset ? 1 : 2)) {
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

    if (!claimSessionTaskSlot(clientSessionId, taskId, generationRequestScope)) {
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
      styleTransferStylePreset,
      assetKind,
      targetLanguage,
      sourceImageName,
      featureCardsEnabled,
      reasoningEffort,
    });

    const generationResult = await requestStudioImageGeneration({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      prompt: finalPrompt,
      referenceImages,
      referenceImageLabels: getStyleTransferReferenceImageLabels(generationMode, styleTransferStylePreset),
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
        styleTransferStylePreset,
        assetKind,
        targetLanguage,
        sourceImageName,
        featureCardsEnabled,
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
      styleTransferStylePreset,
      assetKind,
      targetLanguage,
      sourceImageName,
      featureCardsEnabled,
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

    writeSseEvent(response, GENERATION_STREAM_EVENTS.SAVED, {
      filename,
      absolutePath: saved.absolutePath,
      ratio: ratioOption.value,
      ratioLabel: ratioOption.label,
      size: savedSize,
      item,
    });

    writeSseEvent(response, GENERATION_STREAM_EVENTS.COMPLETE, {
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
      releaseSessionTaskSlot(clientSessionId, taskId, generationRequestScope);
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

  if (request.method === "GET" && url.pathname === "/api/article-illustration/sets") {
    return handleArticleIllustrationSetsGet(response);
  }

  if (request.method === "POST" && url.pathname === "/api/article-illustration/plan") {
    return handleArticleIllustrationPlan(request, response);
  }

  if (request.method === "POST" && url.pathname === "/api/article-illustration/generate-references") {
    return handleArticleIllustrationGenerate(request, response, { referenceOnly: true });
  }

  if (request.method === "POST" && url.pathname === "/api/article-illustration/generate") {
    return handleArticleIllustrationGenerate(request, response);
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

  if (request.method === "POST" && url.pathname === "/api/creation/logo-batch") {
    return handleCreationLogoBatchGenerate(request, response);
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
