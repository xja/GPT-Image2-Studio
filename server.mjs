import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { basename, dirname, extname, join, resolve } from "node:path";
import { homedir } from "node:os";
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
  createTimestampedFilename,
  buildPublicAssetUrl,
  deleteGeneratedAsset,
  formatDateFolder,
  listGalleryItems,
  repairGeneratedAssetMetadata,
  saveGeneratedAsset,
} from "./lib/gallery-store.mjs";
import { normalizeBase64, requestImageGeneration } from "./lib/responses-workflow.mjs";
import {
  DEFAULT_REASONING_EFFORT,
  MAX_CONCURRENT_TASKS_PER_SESSION,
  MAX_REFERENCE_IMAGES,
  REASONING_EFFORT_OPTIONS,
} from "./lib/studio-constants.mjs";
import { requestPromptAgentAnalysis } from "./lib/prompt-agent.mjs";
import { createPromptAgentStore } from "./lib/prompt-agent-store.mjs";

const rootDir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(rootDir, "public");
const libDir = join(rootDir, "lib");
const outputDir = join(homedir(), "Pictures");
const configStore = createConfigStore({ rootDir });
const promptAgentStore = createPromptAgentStore({ rootDir });
const port = Number(process.env.PORT || 3600);
const activeTasksBySession = new Map();

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function getMimeType(filePath) {
  return MIME_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream";
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(message);
}

function writeSseEvent(response, type, payload) {
  response.write(`event: ${type}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
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
  response.writeHead(200, {
    "Content-Type": getMimeType(filePath),
  });

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

  if (!target.startsWith(normalizedBase)) {
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

function claimSessionTaskSlot(sessionId, taskId) {
  const activeTasks = activeTasksBySession.get(sessionId) || new Set();
  if (activeTasks.size >= MAX_CONCURRENT_TASKS_PER_SESSION) {
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

async function handlePromptAgentHistoryGet(response) {
  sendJson(response, 200, await promptAgentStore.list());
}

async function handleOpenOutput(response) {
  const todayOutputDir = join(outputDir, formatDateFolder(new Date()));
  await mkdir(todayOutputDir, { recursive: true });
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

async function handlePromptAgentAnalyze(request, response) {
  const formData = await readFormDataBody(request);
  const rawImages = [
    ...formData.getAll("image"),
    ...formData.getAll("promptAgentImage"),
  ];
  const images = await toReferenceImages(rawImages);

  if (images.length === 0) {
    return sendJson(response, 400, {
      message: "请先上传一张图片。",
    });
  }

  const image = images[0];
  if (!image.mimeType.startsWith("image/")) {
    return sendJson(response, 400, {
      message: "仅支持图片文件。",
    });
  }

  const config = await configStore.readPrivateConfig();
  if (!config.apiKey) {
    return sendJson(response, 400, {
      message: "当前未保存 API Key，请先在配置中保存。",
    });
  }

  const reasoningEffort = normalizeReasoningEffort(
    formData.get("reasoningEffort") || config.defaults?.reasoningEffort || DEFAULT_REASONING_EFFORT,
  );
  const createdAt = new Date().toISOString();
  const json = await requestPromptAgentAnalysis({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    image,
    responsesModel: config.responsesModel,
    reasoningEffort,
  });
  const item = await promptAgentStore.append({
    id: `prompt-json-${randomUUID()}`,
    createdAt,
    filename: image.filename,
    imageMimeType: image.mimeType,
    imageSize: image.buffer.length,
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
    ratio: ratioOption.value,
    ratioLabel: ratioOption.label,
    size,
    quality,
    format,
    reasoningEffort,
  };
}

async function handleGenerate(request, response) {
  const taskId = randomUUID();
  let clientSessionId = "";

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
    const prompt = String(formData.get("prompt") || "").trim();
    const ratio = String(formData.get("ratio") || "4:5");
    const requestedSizeInput = String(formData.get("size") || "auto").trim().toLowerCase();
    clientSessionId = getClientSessionId(request, formData);

    if (!prompt) {
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
      writeSseEvent(response, "error", {
        message: `参考图最多支持 ${MAX_REFERENCE_IMAGES} 张。`,
      });
      return;
    }

    const config = await configStore.readPrivateConfig();
    if (!config.apiKey) {
      writeSseEvent(response, "error", {
        message: "当前未保存 API Key，请先在配置中保存。",
      });
      return;
    }

    const reasoningEffort = normalizeReasoningEffort(
      formData.get("reasoningEffort") || config.defaults?.reasoningEffort || DEFAULT_REASONING_EFFORT,
    );

    if (!claimSessionTaskSlot(clientSessionId, taskId)) {
      writeSseEvent(response, "error", {
        message: `同一会话最多同时进行 ${MAX_CONCURRENT_TASKS_PER_SESSION} 个生成任务。`,
      });
      return;
    }

    const ratioOption = resolveAspectRatioOption(ratio);
    const requestedSize = normalizeGenerationSize(ratioOption.value, requestedSizeInput);
    if (requestedSize !== requestedSizeInput && requestedSizeInput !== "") {
      throw new Error(`当前比例 ${ratioOption.value} 不支持分辨率 ${requestedSizeInput}`);
    }

    const finalPrompt = appendRatioHintToPrompt(prompt, ratioOption);
    const finalSize = requestedSize === "auto" ? getDefaultGenerationSize(ratioOption.value) : requestedSize;
    const finalQuality = config.defaults?.quality || "high";
    const finalFormat = config.defaults?.format || "png";
    const createdAt = new Date().toISOString();
    let finalBase64 = "";

    await requestImageGeneration({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      prompt: finalPrompt,
      referenceImages,
      size: finalSize,
      quality: finalQuality,
      format: finalFormat,
      responsesModel: config.responsesModel,
      reasoningEffort,
      async onEvent(event) {
        if (event.type === "status") {
          writeSseEvent(response, "status", {
            stage: event.stage,
            message: event.message,
          });
          return;
        }

        if (event.type === "partial_image") {
          writeSseEvent(response, "partial_image", {
            dataUrl: event.dataUrl,
          });
          return;
        }

        if (event.type === "final_image") {
          finalBase64 = event.base64;
          writeSseEvent(response, "final_image", {
            dataUrl: `data:image/${finalFormat};base64,${normalizeBase64(event.base64)}`,
          });
        }
      },
    });

    if (!finalBase64) {
      throw new Error("上游响应结束，但没有拿到最终图片。");
    }

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
        size: finalSize,
        quality: finalQuality,
        format: finalFormat,
        hasReferenceImage: referenceImages.length > 0,
        referenceImageNames: referenceImages.map((image) => image.filename),
        referenceImageName: referenceImages[0]?.filename || "",
        reasoningEffort,
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
      size: finalSize,
      quality: finalQuality,
      format: finalFormat,
      referenceImages,
      reasoningEffort,
    });

    writeSseEvent(response, "saved", {
      filename,
      absolutePath: saved.absolutePath,
      ratio: ratioOption.value,
      ratioLabel: ratioOption.label,
      item,
    });

    writeSseEvent(response, "complete", {
      filename,
      absolutePath: saved.absolutePath,
    });
  } catch (error) {
    writeSseEvent(response, "error", {
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (clientSessionId) {
      releaseSessionTaskSlot(clientSessionId, taskId);
    }
    response.end();
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

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    return serveFile(response, join(publicDir, "index.html"));
  }

  if (request.method === "GET") {
    const target = resolveSafeFile(publicDir, url.pathname);
    if (target) {
      try {
        return await serveFile(response, target);
      } catch (error) {
        if (error && typeof error === "object" && error.code === "ENOENT") {
          return sendText(response, 404, "Not found");
        }

        throw error;
      }
    }
  }

  return sendText(response, 404, "Not found");
}

await mkdir(outputDir, { recursive: true });

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
  console.log(`Responses Image Studio 正在运行: http://localhost:${port}`);
  console.log(`输出根目录: ${outputDir}`);
  console.log(`当前输出目录: ${join(outputDir, formatDateFolder(new Date()))}`);
  console.log(`配置文件: ${configStore.configPath}`);
});
