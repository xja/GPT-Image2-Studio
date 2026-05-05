import { mkdir, readdir, readFile, rename, rmdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";

const DATE_FOLDER_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_DATE_PATH_PATTERN = /^\d{2}\/\d{4}-\d{2}-\d{2}(?:\/|$)/;
const OUTPUT_URL_PATTERN = /^\/output\/(.+)$/;

function normalizeRelativePath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .join("/");
}

function isDateFolderName(value) {
  return DATE_FOLDER_PATTERN.test(String(value || ""));
}

function monthFromDateFolder(dateFolder) {
  return String(dateFolder).slice(5, 7);
}

async function pathStat(filePath) {
  try {
    return await stat(filePath);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function assertWithinBase(baseDir, targetPath) {
  const base = resolve(baseDir);
  const target = resolve(targetPath);
  const pathFromBase = relative(base, target);
  if (pathFromBase.startsWith("..") || isAbsolute(pathFromBase)) {
    throw new Error("输出目录迁移路径无效。");
  }
}

async function uniqueTargetPath(targetPath) {
  if (!(await pathStat(targetPath))) {
    return targetPath;
  }

  const extension = extname(targetPath);
  const stem = extension ? targetPath.slice(0, -extension.length) : targetPath;
  for (let index = 1; index < 1000; index += 1) {
    const nextPath = `${stem}-${index}${extension}`;
    if (!(await pathStat(nextPath))) {
      return nextPath;
    }
  }

  throw new Error(`无法为迁移文件创建唯一名称: ${basename(targetPath)}`);
}

async function moveDirectoryContents({ baseDir, sourcePath, targetPath }) {
  assertWithinBase(baseDir, sourcePath);
  assertWithinBase(baseDir, targetPath);

  const sourceStat = await pathStat(sourcePath);
  if (!sourceStat?.isDirectory()) {
    return false;
  }

  await mkdir(targetPath, { recursive: true });
  const entries = await readdir(sourcePath, { withFileTypes: true });
  for (const entry of entries) {
    const sourceChild = join(sourcePath, entry.name);
    const targetChild = join(targetPath, entry.name);
    const targetStat = await pathStat(targetChild);

    if (entry.isDirectory() && targetStat?.isDirectory()) {
      await moveDirectoryContents({ baseDir, sourcePath: sourceChild, targetPath: targetChild });
      continue;
    }

    await mkdir(dirname(targetChild), { recursive: true });
    await rename(sourceChild, await uniqueTargetPath(targetChild));
  }

  await rmdir(sourcePath);
  return true;
}

async function moveDateFoldersIntoMonth({ baseDir, relativeRoot = "" }) {
  const rootPath = relativeRoot ? join(baseDir, ...normalizeRelativePath(relativeRoot).split("/")) : baseDir;
  const rootStat = await pathStat(rootPath);
  if (!rootStat?.isDirectory()) {
    return 0;
  }

  let movedCount = 0;
  const entries = await readdir(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !isDateFolderName(entry.name)) {
      continue;
    }

    const monthFolder = monthFromDateFolder(entry.name);
    const sourcePath = join(rootPath, entry.name);
    const targetPath = join(rootPath, monthFolder, entry.name);
    if (resolve(sourcePath) === resolve(targetPath)) {
      continue;
    }

    if (await moveDirectoryContents({ baseDir, sourcePath, targetPath })) {
      movedCount += 1;
    }
  }

  return movedCount;
}

function addMonthPrefixToRelativePath(value) {
  const normalized = normalizeRelativePath(value);
  if (!normalized || MONTH_DATE_PATH_PATTERN.test(normalized)) {
    return normalized;
  }

  const dateFolder = normalized.match(/^(\d{4}-(\d{2})-\d{2})(?:\/|$)/);
  if (!dateFolder) {
    return normalized;
  }

  return `${dateFolder[2]}/${normalized}`;
}

function buildOutputUrl(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  return normalized ? `/output/${normalized}` : "";
}

function migrateOutputUrl(value) {
  const text = String(value || "").trim();
  const match = text.match(OUTPUT_URL_PATTERN);
  if (!match) {
    return text;
  }

  return buildOutputUrl(addMonthPrefixToRelativePath(match[1]));
}

function migratePptManifestPayload(payload) {
  let changed = false;
  const next = { ...payload };
  const nextPptxRelativePath = addMonthPrefixToRelativePath(
    next.pptxRelativePath || String(next.pptxUrl || "").replace(/^\/?output\/?/, ""),
  );

  if (nextPptxRelativePath && nextPptxRelativePath !== normalizeRelativePath(next.pptxRelativePath)) {
    next.pptxRelativePath = nextPptxRelativePath;
    next.pptxUrl = buildOutputUrl(nextPptxRelativePath);
    changed = true;
  } else if (next.pptxUrl && migrateOutputUrl(next.pptxUrl) !== next.pptxUrl) {
    next.pptxUrl = migrateOutputUrl(next.pptxUrl);
    changed = true;
  }

  if (Array.isArray(next.slides)) {
    next.slides = next.slides.map((slide) => {
      const migratedSlide = { ...slide };
      const nextRelativePath = addMonthPrefixToRelativePath(
        migratedSlide.relativePath || String(migratedSlide.imageUrl || "").replace(/^\/?output\/?/, ""),
      );

      if (nextRelativePath && nextRelativePath !== normalizeRelativePath(migratedSlide.relativePath)) {
        migratedSlide.relativePath = nextRelativePath;
        migratedSlide.imageUrl = buildOutputUrl(nextRelativePath);
        migratedSlide.thumbnailUrl = buildOutputUrl(nextRelativePath);
        changed = true;
        return migratedSlide;
      }

      for (const field of ["imageUrl", "thumbnailUrl"]) {
        const migratedUrl = migrateOutputUrl(migratedSlide[field]);
        if (migratedUrl && migratedUrl !== migratedSlide[field]) {
          migratedSlide[field] = migratedUrl;
          changed = true;
        }
      }

      return migratedSlide;
    });
  }

  return { changed, payload: next };
}

async function migratePptManifests({ outputDir }) {
  const manifestsDir = join(outputDir, "json", "ppt-decks");
  const manifestsStat = await pathStat(manifestsDir);
  if (!manifestsStat?.isDirectory()) {
    return 0;
  }

  let updatedCount = 0;
  const entries = await readdir(manifestsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const filePath = join(manifestsDir, entry.name);
    const raw = await readFile(filePath, "utf8");
    const { changed, payload } = migratePptManifestPayload(JSON.parse(raw.replace(/^\uFEFF/, "")));
    if (!changed) {
      continue;
    }

    await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    updatedCount += 1;
  }

  return updatedCount;
}

export async function migrateOutputDirectoryMonths({ outputDir }) {
  await mkdir(outputDir, { recursive: true });
  const movedDateFolders = await moveDateFoldersIntoMonth({ baseDir: outputDir });
  const movedMetadataDateFolders = await moveDateFoldersIntoMonth({ baseDir: outputDir, relativeRoot: "json" });
  const updatedPptManifests = await migratePptManifests({ outputDir });

  return {
    movedDateFolders,
    movedMetadataDateFolders,
    updatedPptManifests,
  };
}
