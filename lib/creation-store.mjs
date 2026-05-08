import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { formatDateFolder, formatDayFolder, formatMonthFolder } from "./gallery-store.mjs";

const MANIFEST_DIRNAME = "creation-sets";
const VALID_SET_STATUSES = new Set(["planning", "queued", "generating", "saving", "completed", "partial_failed", "failed"]);

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

function normalizeDateValue(value, fallback = new Date()) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function sanitizeSegment(value, fallback = "creation") {
  const sanitized = cleanString(value)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "")
    .slice(0, 40);
  return sanitized || fallback;
}

function setIdSuffix(setId) {
  const clean = sanitizeSegment(setId, "set");
  return clean.slice(-8) || "set";
}

function buildOutputUrl(publicBasePath, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  return normalized ? `${publicBasePath.replace(/\/+$/, "")}/${normalized}` : "";
}

export function buildCreationRelativeDir({ createdAt = new Date(), productName = "", setId = "" } = {}) {
  const date = normalizeDateValue(createdAt);
  const monthFolder = formatMonthFolder(date);
  const dayFolder = formatDayFolder(date);
  const dateFolder = formatDateFolder(date);
  const folderName = `${sanitizeSegment(productName, "creation")}-${setIdSuffix(setId)}`;
  return `${monthFolder}/${dayFolder}/${dateFolder}-creation/${folderName}`;
}

function normalizeCreationItem(item = {}, publicBasePath) {
  const relativePath = normalizeRelativePath(item.relativePath);
  const imageUrl = cleanString(item.imageUrl) || buildOutputUrl(publicBasePath, relativePath);
  return {
    itemId: cleanString(item.itemId),
    slotIndex: Number(item.slotIndex) || 0,
    role: cleanString(item.role),
    title: cleanString(item.title),
    prompt: cleanString(item.prompt),
    marketingCopy: cleanString(item.marketingCopy),
    status: cleanString(item.status) || (relativePath ? "completed" : "queued"),
    filename: cleanString(item.filename) || basename(relativePath),
    relativePath,
    imageUrl,
    thumbnailUrl: cleanString(item.thumbnailUrl) || imageUrl,
    error: cleanString(item.error),
    generationStartedAt: cleanString(item.generationStartedAt),
    generationCompletedAt: cleanString(item.generationCompletedAt),
    generationDurationMs: Number(item.generationDurationMs) || 0,
    size: cleanString(item.size),
    format: cleanString(item.format),
  };
}

function normalizeReferenceImageRole(entry = {}) {
  return {
    filename: cleanString(entry.filename || entry.name),
    role: cleanString(entry.role) || "product",
    roleLabel: cleanString(entry.roleLabel),
    note: cleanString(entry.note || entry.analysisNote || entry.description),
  };
}

export function normalizeCreationSetManifest(manifest = {}, { publicBasePath = "/output" } = {}) {
  const createdAt = cleanString(manifest.createdAt) || new Date().toISOString();
  const status = cleanString(manifest.status);
  const items = Array.isArray(manifest.items)
    ? manifest.items.map((item) => normalizeCreationItem(item, publicBasePath)).sort((a, b) => a.slotIndex - b.slotIndex)
    : [];

  return {
    setId: cleanString(manifest.setId || manifest.id),
    productName: cleanString(manifest.productName),
    productDescription: cleanString(manifest.productDescription),
    sellingPoints: Array.isArray(manifest.sellingPoints)
      ? manifest.sellingPoints.map(cleanString).filter(Boolean)
      : [],
    targetLanguage: cleanString(manifest.targetLanguage) || "zh-CN",
    targetLanguageLabel: cleanString(manifest.targetLanguageLabel),
    imageCount: Number(manifest.imageCount) || items.length || 4,
    selectedRoles: Array.isArray(manifest.selectedRoles)
      ? manifest.selectedRoles.map(cleanString).filter(Boolean)
      : items.map((item) => item.role).filter(Boolean),
    scenario: cleanString(manifest.scenario) || "standard",
    scenarioLabel: cleanString(manifest.scenarioLabel),
    industryTemplate: cleanString(manifest.industryTemplate) || "general",
    industryTemplateLabel: cleanString(manifest.industryTemplateLabel),
    referenceImageNames: Array.isArray(manifest.referenceImageNames)
      ? manifest.referenceImageNames.map(cleanString).filter(Boolean)
      : [],
    referenceImageRoles: Array.isArray(manifest.referenceImageRoles)
      ? manifest.referenceImageRoles.map(normalizeReferenceImageRole).filter((entry) => entry.filename)
      : [],
    createdAt,
    updatedAt: cleanString(manifest.updatedAt) || createdAt,
    status: VALID_SET_STATUSES.has(status) ? status : "planning",
    relativeDir: normalizeRelativePath(manifest.relativeDir),
    items,
  };
}

function compareCreationSets(left, right) {
  const byCreatedAt = right.createdAt.localeCompare(left.createdAt);
  return byCreatedAt || left.productName.localeCompare(right.productName) || left.setId.localeCompare(right.setId);
}

export function createCreationSetStore({ outputDir, publicBasePath = "/output" }) {
  const manifestsDir = join(outputDir, "json", MANIFEST_DIRNAME);

  function manifestPath(setId) {
    return join(manifestsDir, `${sanitizeSegment(setId, "creation-set")}.json`);
  }

  async function saveManifest(manifest) {
    const normalized = normalizeCreationSetManifest(manifest, { publicBasePath });
    if (!normalized.setId) {
      throw new Error("setId is required");
    }

    await mkdir(manifestsDir, { recursive: true });
    await writeFile(manifestPath(normalized.setId), `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    return normalized;
  }

  async function readManifest(setId) {
    const raw = await readFile(manifestPath(setId), "utf8");
    return normalizeCreationSetManifest(JSON.parse(raw.replace(/^\uFEFF/, "")), { publicBasePath });
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
      manifests.push(normalizeCreationSetManifest(JSON.parse(raw.replace(/^\uFEFF/, "")), { publicBasePath }));
    }

    return manifests.sort(compareCreationSets);
  }

  return {
    manifestsDir,
    saveManifest,
    readManifest,
    listManifests,
    manifestPath,
  };
}
