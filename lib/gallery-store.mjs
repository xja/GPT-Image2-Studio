import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const indexLocks = new Map();

function pad(value) {
  return String(value).padStart(2, "0");
}

function normalizeDateValue(dateLike, fallback = new Date()) {
  const date = new Date(dateLike);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

export function formatDateFolder(dateLike) {
  const date = normalizeDateValue(dateLike);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function normalizeRelativePath(relativePath) {
  return String(relativePath || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .join("/");
}

function imagePathFor(filename, outputDir, createdAt) {
  return join(outputDir, formatDateFolder(createdAt), filename);
}

function legacyMetadataPathFor(filename, outputDir) {
  return join(outputDir, `${filename}.json`);
}

function relativeImagePathFor(filename, createdAt) {
  return `${formatDateFolder(createdAt)}/${filename}`;
}

function resolveImagePath(outputDir, filename, metadata = {}) {
  const relativePath = normalizeRelativePath(metadata.relativePath);
  if (relativePath) {
    return join(outputDir, ...relativePath.split("/"));
  }

  if (metadata.createdAt) {
    return imagePathFor(filename, outputDir, metadata.createdAt);
  }

  return join(outputDir, filename);
}

function encodePublicPath(relativePath) {
  return normalizeRelativePath(relativePath)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

export function buildPublicAssetUrl(publicBasePath, relativePath, createdAt) {
  return `${publicBasePath}/${encodePublicPath(relativePath)}?v=${encodeURIComponent(createdAt)}`;
}

function resolveIndexPath(outputDir, explicitIndexPath) {
  return explicitIndexPath || join(dirname(outputDir), ".local", "gallery-index.json");
}

async function readGalleryIndex(indexPath) {
  try {
    const raw = await readFile(indexPath, "utf8");
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function readLegacyMetadata(filename, outputDir) {
  try {
    const raw = await readFile(legacyMetadataPathFor(filename, outputDir), "utf8");
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function writeGalleryIndex(indexPath, nextIndex) {
  await mkdir(dirname(indexPath), { recursive: true });
  await writeFile(indexPath, `${JSON.stringify(nextIndex, null, 2)}\n`, "utf8");
}

async function withIndexLock(indexPath, operation) {
  const previous = indexLocks.get(indexPath) || Promise.resolve();
  const next = previous.catch(() => {}).then(operation);
  indexLocks.set(indexPath, next);

  try {
    return await next;
  } finally {
    if (indexLocks.get(indexPath) === next) {
      indexLocks.delete(indexPath);
    }
  }
}

export function createTimestampedFilename(format) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `generated-${timestamp}-${randomUUID().slice(0, 8)}.${format}`;
}

async function collectImageEntries(dir, relativeDir = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    const absolutePath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectImageEntries(absolutePath, relativePath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = extname(entry.name).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(extension)) {
      continue;
    }

    files.push({
      absolutePath,
      filename: entry.name,
      relativePath,
      extension,
    });
  }

  return files;
}

export async function saveGeneratedAsset({
  outputDir,
  indexPath,
  filename,
  imageBuffer,
  metadata = {},
}) {
  const resolvedIndexPath = resolveIndexPath(outputDir, indexPath);
  const createdAt = normalizeDateValue(metadata.createdAt).toISOString();
  const relativePath = relativeImagePathFor(filename, createdAt);
  const imagePath = imagePathFor(filename, outputDir, createdAt);

  await mkdir(dirname(imagePath), { recursive: true });

  await writeFile(imagePath, imageBuffer);

  await withIndexLock(resolvedIndexPath, async () => {
    const currentIndex = await readGalleryIndex(resolvedIndexPath);
    currentIndex[filename] = {
      ...(currentIndex[filename] || {}),
      ...metadata,
      createdAt,
      relativePath,
      format: metadata.format || extname(filename).replace(/^\./, ""),
    };
    await writeGalleryIndex(resolvedIndexPath, currentIndex);
  });

  return {
    filename,
    absolutePath: imagePath,
    relativePath,
    createdAt,
  };
}

export async function deleteGeneratedAsset({ outputDir, indexPath, filename }) {
  const resolvedIndexPath = resolveIndexPath(outputDir, indexPath);
  let imagePath = join(outputDir, filename);

  await withIndexLock(resolvedIndexPath, async () => {
    const currentIndex = await readGalleryIndex(resolvedIndexPath);
    const metadata = currentIndex[filename] || {};
    const candidates = [
      resolveImagePath(outputDir, filename, metadata),
      join(outputDir, filename),
    ];

    for (const candidate of candidates) {
      try {
        await unlink(candidate);
        imagePath = candidate;
        break;
      } catch (error) {
        if (!(error && typeof error === "object" && error.code === "ENOENT")) {
          throw error;
        }
      }
    }

    try {
      await unlink(legacyMetadataPathFor(filename, outputDir));
    } catch (error) {
      if (!(error && typeof error === "object" && error.code === "ENOENT")) {
        throw error;
      }
    }

    if (filename in currentIndex) {
      delete currentIndex[filename];
      await writeGalleryIndex(resolvedIndexPath, currentIndex);
    }
  });

  return {
    filename,
    absolutePath: imagePath,
  };
}

export async function listGalleryItems({
  outputDir,
  publicBasePath = "/output",
  indexPath,
}) {
  await mkdir(outputDir, { recursive: true });
  const metadataIndex = await readGalleryIndex(resolveIndexPath(outputDir, indexPath));
  const items = [];

  for (const [filename, metadata] of Object.entries(metadataIndex)) {
    const relativePath = normalizeRelativePath(metadata.relativePath || "");
    if (!relativePath) {
      continue;
    }

    const imagePath = join(outputDir, ...relativePath.split("/"));

    try {
      const imageStat = await stat(imagePath);
      const extension = extname(filename).toLowerCase();
      const createdAt = metadata.createdAt || imageStat.mtime.toISOString();

      items.push({
        id: `${basename(filename, extension)}-${createdAt}`,
        filename,
        absolutePath: imagePath,
        relativePath,
        imageUrl: buildPublicAssetUrl(publicBasePath, relativePath, createdAt),
        thumbnailUrl: buildPublicAssetUrl(publicBasePath, relativePath, createdAt),
        createdAt,
        prompt: metadata.prompt || "",
        baseUrl: metadata.baseUrl || "",
        responsesModel: metadata.responsesModel || "",
        imageModel: metadata.imageModel || "",
        hasReferenceImage: Boolean(metadata.hasReferenceImage),
        referenceImageNames: Array.isArray(metadata.referenceImageNames) ? metadata.referenceImageNames : [],
        referenceImageName: metadata.referenceImageName || "",
        ratio: metadata.ratio || "",
        ratioLabel: metadata.ratioLabel || "",
        size: metadata.size || "",
        quality: metadata.quality || "",
        format: metadata.format || extension.replace(/^\./, ""),
        reasoningEffort: metadata.reasoningEffort || "",
      });
    } catch (error) {
      if (!(error && typeof error === "object" && error.code === "ENOENT")) {
        throw error;
      }
    }
  }

  items.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return items;
}
