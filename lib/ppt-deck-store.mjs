import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

function cleanString(value) {
  return String(value || "").trim();
}

function normalizeRelativePath(value) {
  return cleanString(value)
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .join("/");
}

function buildOutputUrl(publicBasePath, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  return normalized ? `${publicBasePath.replace(/\/+$/, "")}/${normalized}` : "";
}

function normalizeSlide(slide, publicBasePath) {
  const relativePath = normalizeRelativePath(slide?.relativePath);
  return {
    slideNumber: Number(slide?.slideNumber) || 0,
    title: cleanString(slide?.title),
    filename: cleanString(slide?.filename) || basename(relativePath),
    relativePath,
    imageUrl: cleanString(slide?.imageUrl) || buildOutputUrl(publicBasePath, relativePath),
    thumbnailUrl: cleanString(slide?.thumbnailUrl) || buildOutputUrl(publicBasePath, relativePath),
    prompt: cleanString(slide?.prompt),
  };
}

export function normalizePptDeckManifest(manifest = {}, { publicBasePath = "/output" } = {}) {
  const pptxRelativePath = normalizeRelativePath(manifest.pptxRelativePath || manifest.pptxUrl?.replace(/^\/?output\/?/, ""));
  const slides = Array.isArray(manifest.slides)
    ? manifest.slides.map((slide) => normalizeSlide(slide, publicBasePath)).sort((a, b) => a.slideNumber - b.slideNumber)
    : [];

  return {
    deckId: cleanString(manifest.deckId || manifest.id),
    title: cleanString(manifest.title) || "未命名演示文稿",
    pageCount: Number(manifest.pageCount) || slides.length,
    createdAt: cleanString(manifest.createdAt) || new Date().toISOString(),
    sources: manifest.sources && typeof manifest.sources === "object" ? manifest.sources : {},
    outline: manifest.outline && typeof manifest.outline === "object" ? manifest.outline : null,
    slides,
    pptxRelativePath,
    pptxUrl: cleanString(manifest.pptxUrl) || buildOutputUrl(publicBasePath, pptxRelativePath),
    pptxFilename: cleanString(manifest.pptxFilename) || basename(pptxRelativePath),
    responsesModel: cleanString(manifest.responsesModel),
    imageModel: cleanString(manifest.imageModel || "gpt-image-2"),
    reasoningEffort: cleanString(manifest.reasoningEffort),
  };
}

export function createPptDeckStore({ outputDir, publicBasePath = "/output" }) {
  const manifestsDir = join(outputDir, "json", "ppt-decks");

  async function saveManifest(manifest) {
    const normalized = normalizePptDeckManifest(manifest, { publicBasePath });
    if (!normalized.deckId) {
      throw new Error("deckId is required");
    }

    await mkdir(manifestsDir, { recursive: true });
    const filePath = join(manifestsDir, `${normalized.deckId}.json`);
    await writeFile(filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    return normalized;
  }

  async function listManifests() {
    await mkdir(manifestsDir, { recursive: true });
    const entries = await readdir(manifestsDir, { withFileTypes: true });
    const manifests = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      const raw = await readFile(join(manifestsDir, entry.name), "utf8");
      manifests.push(normalizePptDeckManifest(JSON.parse(raw), { publicBasePath }));
    }

    return manifests.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  return {
    manifestsDir,
    saveManifest,
    listManifests,
    manifestPath(deckId) {
      return join(manifestsDir, `${cleanString(deckId)}.json`);
    },
  };
}
