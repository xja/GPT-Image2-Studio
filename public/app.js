import {
  buildParameterText,
  formatImageModelLabel,
  formatRecentOutputMeta,
} from "/lib/studio-formatters.mjs";
import { getPreviewPlaceholderState } from "/lib/preview-placeholder-state.mjs";
import {
  buildGalleryReferenceFilterOptions,
  buildGallerySections,
  buildGallerySizeFilterOptions,
  buildGalleryTimeFilterOptions,
  distributeGalleryItemsIntoColumns,
  filterGalleryItems,
  getGalleryLayoutModeForWidth,
  getRecentGalleryItems,
  normalizeGalleryFilters,
  sortGalleryItemsByCreatedAtDesc,
} from "/lib/gallery-organizer.mjs";
import {
  buildGalleryMetadataCacheEntry,
  collectGalleryMetadataRepairPatch,
  mergeGalleryItemWithCachedMetadata,
  pruneGalleryMetadataCache,
} from "/lib/gallery-metadata-recovery.mjs";
import {
  getDefaultGenerationSize,
  getGenerationSizeOptions,
  normalizeGenerationSize,
} from "/lib/generation-size-options.mjs?v=20260428-desc-resolutions-1";
import {
  getPreviewLoadingShellTheme,
  shouldReusePreviewLoadingShell,
} from "/lib/preview-loading-shell.mjs";
import { getGenerationRequestRetryPlan } from "/lib/generation-request-retry.mjs";
import { getStudioDensitySettings, getStudioLayoutMode, ALL_VARIABLE_NAMES } from "/lib/studio-density.mjs?v=20260426-filmstrip-1";

const SURPRISE_PROMPTS = [
  "生成一张美女抖音直播带货主视觉，主播面对镜头展示护肤礼盒，商业摄影质感，暖金色补光，画面干净适合电商封面。",
  "生成一张中国风直播间服饰带货海报，女主播站在布景前介绍新款汉服，柔和边缘光，细节精致，适合社媒首图。",
  "生成一张数码产品直播间宣传图，主播坐在桌前讲解耳机，科技蓝氛围光，产品主体清晰，适合带货直播封面。",
];

const REASONING_LABELS = {
  low: "低",
  medium: "中",
  high: "高",
  xhigh: "超高",
};

const DEFAULT_LIMITS = {
  maxConcurrentTasksPerSession: 12,
  maxParallelTasksPerSession: 4,
  maxReferenceImages: 6,
};
const PROMPT_TEMPLATE_STORAGE_KEY = "image-studio-prompt-templates-v1";
const DEFAULT_PROMPT_TEMPLATES = SURPRISE_PROMPTS.map((prompt, index) => ({
  id: `default-template-${index + 1}`,
  name: ["直播带货", "国风服饰", "数码产品"][index] || `模板 ${index + 1}`,
  prompt,
}));

const DEFAULT_GALLERY_CONTROLS = {
  query: "",
  window: "all",
  date: "",
  size: "all",
  reference: "all",
};

const GALLERY_COLUMN_PRESETS = [6, 9, 12, 15, 18];
const DEFAULT_GALLERY_COLUMN_PRESET = 12;
const DEFAULT_REASONING_EFFORTS = ["low", "medium", "high", "xhigh"];
const GALLERY_METADATA_CACHE_KEY = "image-studio-gallery-metadata-cache-v2";
const GALLERY_WINDOW_LABELS = {
  today: "今天",
  recent: "近 7 天",
  older: "更早",
};
const GALLERY_REFERENCE_LABELS = {
  "with-reference": "带参考图",
  "without-reference": "无参考图",
};
const STACKED_STUDIO_LAYOUT_MODES = new Set(["stacked", "tablet", "mobile"]);

let studioHeightSyncFrame = 0;
let studioHeightObserver = null;
let studioDensitySyncFrame = 0;
let galleryPanelHeightSyncFrame = 0;
let galleryPanelHeightObserver = null;
let galleryScrollSyncFrame = 0;
let galleryScrollObserver = null;
let promptCopyFeedbackTimer = 0;
let previewLoadingShellNodes = null;
const galleryScrollDrag = {
  active: false,
  pointerId: null,
  startOffset: 0,
  startY: 0,
};

const state = {
  activeView: "studio",
  activityFeed: [],
  aspectRatios: [],
  clientSessionId: "",
  config: null,
  gallery: [],
  galleryMetadataCache: {},
  galleryControls: { ...DEFAULT_GALLERY_CONTROLS },
  galleryColumnPreset: DEFAULT_GALLERY_COLUMN_PRESET,
  jobs: [],
  lightboxItem: null,
  lightboxZoomed: false,
  limits: { ...DEFAULT_LIMITS },
  promptAgent: {
    file: null,
    history: [],
    previewUrl: "",
    result: null,
    running: false,
    viewerOpen: false,
  },
  promptTemplates: [],
  reasoningEfforts: [...DEFAULT_REASONING_EFFORTS],
  referenceFiles: [],
  selectedPromptTemplateId: "",
  selectedPreviewKey: "",
  zoom: 1,
};

const refs = {
  apiKeyInput: document.querySelector("#apiKeyInput"),
  baseUrlInput: document.querySelector("#baseUrlInput"),
  clearHistoryButton: document.querySelector("#clearHistoryButton"),
  closeConfigBackdrop: document.querySelector("#closeConfigBackdrop"),
  closeConfigButton: document.querySelector("#closeConfigButton"),
  configDrawer: document.querySelector("#configDrawer"),
  configFeedback: document.querySelector("#configFeedback"),
  configForm: document.querySelector("#configForm"),
  configStatus: document.querySelector("#configStatus"),
  connectionLabel: document.querySelector("#connectionLabel"),
  connectionStatus: document.querySelector("#connectionStatus"),
  errorBanner: document.querySelector("#errorBanner"),
  filmstrip: document.querySelector("#filmstrip"),
  focusGalleryButton: document.querySelector("#focusGalleryButton"),
  galleryCount: document.querySelector("#galleryCount"),
  galleryColumnButtons: [...document.querySelectorAll("[data-gallery-column-preset]")],
  galleryDateInput: document.querySelector("#galleryDateInput"),
  galleryEmpty: document.querySelector("#galleryEmpty"),
  galleryFilters: document.querySelector("#galleryFilters"),
  galleryHelperText: document.querySelector("#galleryHelperText"),
  galleryPanel: document.querySelector(".gallery-panel"),
  galleryReferenceFilterInput: document.querySelector("#galleryReferenceFilterInput"),
  galleryResetFiltersButton: document.querySelector("#galleryResetFiltersButton"),
  gallerySearchInput: document.querySelector("#gallerySearchInput"),
  gallerySections: document.querySelector("#gallerySections"),
  gallerySizeFilterInput: document.querySelector("#gallerySizeFilterInput"),
  galleryScrollbar: document.querySelector("#galleryScrollbar"),
  galleryScrollDown: document.querySelector("#galleryScrollDown"),
  galleryScrollRegion: document.querySelector("#galleryScrollRegion"),
  galleryScrollThumb: document.querySelector("#galleryScrollThumb"),
  galleryScrollTrack: document.querySelector("#galleryScrollTrack"),
  galleryScrollUp: document.querySelector("#galleryScrollUp"),
  galleryView: document.querySelector(".gallery-view"),
  generateButton: document.querySelector("#generateButton"),
  generateForm: document.querySelector("#generateForm"),
  lightbox: document.querySelector("#lightbox"),
  lightboxAmbient: document.querySelector("#lightboxAmbient"),
  lightboxBackdrop: document.querySelector("#lightboxBackdrop"),
  lightboxClose: document.querySelector("#lightboxClose"),
  copyPromptButton: document.querySelector("#copyPromptButton"),
  lightboxDelete: document.querySelector("#lightboxDelete"),
  lightboxDownload: document.querySelector("#lightboxDownload"),
  lightboxId: document.querySelector("#lightboxId"),
  lightboxImage: document.querySelector("#lightboxImage"),
  lightboxImageShell: document.querySelector(".lightbox-image-shell"),
  lightboxMediaStage: document.querySelector(".lightbox-media-stage"),
  lightboxModel: document.querySelector("#lightboxModel"),
  lightboxParams: document.querySelector("#lightboxParams"),
  lightboxPrompt: document.querySelector("#lightboxPrompt"),
  lightboxTime: document.querySelector("#lightboxTime"),
  liveCount: document.querySelector("#liveCount"),
  openConfigButton: document.querySelector("#openConfigButton"),
  openOutputButton: document.querySelector("#openOutputButton"),
  openPromptAgentButton: document.querySelector("#openPromptAgentButton"),
  previewDeleteButton: document.querySelector("#previewDeleteButton"),
  previewDownloadButton: document.querySelector("#previewDownloadButton"),
  previewId: document.querySelector("#previewId"),
  previewImage: document.querySelector("#previewImage"),
  previewLightboxButton: document.querySelector("#previewLightboxButton"),
  previewModel: document.querySelector("#previewModel"),
  previewPlaceholder: document.querySelector("#previewPlaceholder"),
  previewSize: document.querySelector("#previewSize"),
  previewTime: document.querySelector("#previewTime"),
  promptCounter: document.querySelector("#promptCounter"),
  promptAgentAnalyzeButton: document.querySelector("#promptAgentAnalyzeButton"),
  promptAgentBackdrop: document.querySelector("#promptAgentBackdrop"),
  promptAgentCloseButton: document.querySelector("#promptAgentCloseButton"),
  copyPromptAgentJsonButton: document.querySelector("#copyPromptAgentJsonButton"),
  promptAgentDropzone: document.querySelector("#promptAgentDropzone"),
  promptAgentFeedback: document.querySelector("#promptAgentFeedback"),
  promptAgentFilename: document.querySelector("#promptAgentFilename"),
  promptAgentFileMeta: document.querySelector("#promptAgentFileMeta"),
  promptAgentHistoryCount: document.querySelector("#promptAgentHistoryCount"),
  promptAgentHistoryEmpty: document.querySelector("#promptAgentHistoryEmpty"),
  promptAgentHistoryList: document.querySelector("#promptAgentHistoryList"),
  promptAgentImageViewer: document.querySelector("#promptAgentImageViewer"),
  promptAgentImageViewerBackdrop: document.querySelector("#promptAgentImageViewerBackdrop"),
  promptAgentImageViewerClose: document.querySelector("#promptAgentImageViewerClose"),
  promptAgentImageViewerImage: document.querySelector("#promptAgentImageViewerImage"),
  promptAgentImageInput: document.querySelector("#promptAgentImageInput"),
  promptAgentModal: document.querySelector("#promptAgentModal"),
  promptAgentAnalysisMotion: document.querySelector("#promptAgentAnalysisMotion"),
  promptAgentPreview: document.querySelector("#promptAgentPreview"),
  promptAgentPreviewButton: document.querySelector("#promptAgentPreviewButton"),
  promptAgentPreviewImage: document.querySelector("#promptAgentPreviewImage"),
  promptAgentResult: document.querySelector("#promptAgentResult"),
  promptInput: document.querySelector("#promptInput"),
  promptTemplateFeedback: document.querySelector("#promptTemplateFeedback"),
  promptTemplateForm: document.querySelector("#promptTemplateForm"),
  promptTemplateList: document.querySelector("#promptTemplateList"),
  promptTemplateNameInput: document.querySelector("#promptTemplateNameInput"),
  promptTemplatePopover: document.querySelector("#promptTemplatePopover"),
  promptTemplateTextInput: document.querySelector("#promptTemplateTextInput"),
  ratioGrid: document.querySelector("#ratioGrid"),
  ratioInput: document.querySelector("#ratioInput"),
  reasoningEffortInput: document.querySelector("#reasoningEffortInput"),
  recentEmpty: document.querySelector("#recentEmpty"),
  recentList: document.querySelector("#recentList"),
  referenceCount: document.querySelector("#referenceCount"),
  referenceDropzone: document.querySelector("#referenceDropzone"),
  referenceGrid: document.querySelector("#referenceGrid"),
  referenceInput: document.querySelector("#referenceInput"),
  refreshGalleryButton: document.querySelector("#refreshGalleryButton"),
  responsesModelInput: document.querySelector("#responsesModelInput"),
  savedKeyMask: document.querySelector("#savedKeyMask"),
  sizeInput: document.querySelector("#sizeInput"),
  surprisePromptButton: document.querySelector("#surprisePromptButton"),
  applyPromptTemplateButton: document.querySelector("#applyPromptTemplateButton"),
  closePromptTemplateButton: document.querySelector("#closePromptTemplateButton"),
  deletePromptTemplateButton: document.querySelector("#deletePromptTemplateButton"),
  newPromptTemplateButton: document.querySelector("#newPromptTemplateButton"),
  settingsPanel: document.querySelector(".settings-panel"),
  sideColumn: document.querySelector(".side-column"),
  topbar: document.querySelector(".topbar"),
  timelineList: document.querySelector("#timelineList"),
  viewPanels: [...document.querySelectorAll("[data-view-panel]")],
  viewTabs: [...document.querySelectorAll("[data-view-tab]")],
  viewRoot: document.querySelector(".view-root"),
  previewPanel: document.querySelector(".preview-panel"),
  zoomInButton: document.querySelector("#zoomInButton"),
  zoomLabel: document.querySelector("#zoomLabel"),
  zoomOutButton: document.querySelector("#zoomOutButton"),
  zoomResetButton: document.querySelector("#zoomResetButton"),
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatTime(dateLike) {
  if (!dateLike) {
    return "--";
  }

  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatClock(dateLike) {
  if (!dateLike) {
    return "--:--:--";
  }

  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }

  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (value <= 0) {
    return "--";
  }

  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function nowIso() {
  return new Date().toISOString();
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function buildReferenceFingerprint(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function makeJobPreviewKey(jobId) {
  return `job:${jobId}`;
}

function makeGalleryPreviewKey(filename) {
  return `file:${filename}`;
}

function getDisplayPrompt(item) {
  const raw = String(item?.prompt || "").trim();
  if (raw && raw.replace(/\?/g, "").trim().length > 0) {
    return raw;
  }

  if (item?.createdAt) {
    return `本地输出 ${formatClock(item.createdAt)}`;
  }

  return "未命名输出";
}

function getImageUrl(item) {
  return item?.imageUrl || item?.thumbnailUrl || item?.previewUrl || "";
}

function getDisplayId(item) {
  const raw = String(item?.id || "");
  if (!raw) {
    return "--";
  }

  if (raw.length <= 28) {
    return raw;
  }

  return `${raw.slice(0, 24)}...`;
}

function formatCanvasLabel(size) {
  if (!size) {
    return "--";
  }

  return size.replace("x", " × ");
}

function readGalleryMetadataCache() {
  try {
    const raw = window.localStorage.getItem(GALLERY_METADATA_CACHE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function writeGalleryMetadataCache(cache) {
  try {
    window.localStorage.setItem(GALLERY_METADATA_CACHE_KEY, JSON.stringify(cache));
  } catch (_error) {
    // Ignore storage quota or browser privacy restrictions and keep the in-memory copy.
  }
}

function syncGalleryMetadataCache(items) {
  const nextCache = pruneGalleryMetadataCache(state.galleryMetadataCache, items);

  items.forEach((item) => {
    const filename = String(item?.filename || "").trim();
    if (!filename) {
      return;
    }

    const entry = buildGalleryMetadataCacheEntry(item);
    if (Object.keys(entry).length > 0) {
      nextCache[filename] = entry;
    }
  });

  state.galleryMetadataCache = nextCache;
  writeGalleryMetadataCache(nextCache);
}

function forgetGalleryMetadata(filename) {
  const normalizedFilename = String(filename || "").trim();
  if (!normalizedFilename || !state.galleryMetadataCache[normalizedFilename]) {
    return;
  }

  const nextCache = { ...state.galleryMetadataCache };
  delete nextCache[normalizedFilename];
  state.galleryMetadataCache = nextCache;
  writeGalleryMetadataCache(nextCache);
}

function hydrateGalleryItems(serverItems) {
  const repairQueue = [];
  const hydratedItems = serverItems.map((item) => {
    const cachedEntry = state.galleryMetadataCache[item.filename];
    if (!cachedEntry) {
      return item;
    }

    const mergedItem = mergeGalleryItemWithCachedMetadata(item, cachedEntry);
    const metadataPatch = collectGalleryMetadataRepairPatch(item, mergedItem);
    if (Object.keys(metadataPatch).length > 0) {
      repairQueue.push({
        filename: item.filename,
        metadata: metadataPatch,
      });
    }

    return mergedItem;
  });

  syncGalleryMetadataCache(hydratedItems);

  return {
    items: hydratedItems,
    repairQueue,
  };
}

async function repairGalleryMetadataQueue(repairQueue = []) {
  for (const repair of repairQueue) {
    try {
      const response = await fetch("/api/gallery/metadata", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(repair),
      });
      if (!response.ok) {
        throw new Error(`repair failed with status ${response.status}`);
      }
    } catch (error) {
      console.warn("repair gallery metadata failed", repair.filename, error);
    }
  }
}

function getNormalizedGalleryControls() {
  state.galleryControls = normalizeGalleryFilters(state.galleryControls, state.gallery);
  return state.galleryControls;
}

function getGalleryFilterSnapshot(overrides = {}) {
  return normalizeGalleryFilters({ ...getNormalizedGalleryControls(), ...overrides }, state.gallery);
}

function hasActiveGalleryFilters(filters) {
  return Boolean(
    filters.query ||
      filters.window !== "all" ||
      filters.date ||
      filters.size !== "all" ||
      filters.reference !== "all",
  );
}

function formatGalleryQuerySummary(query) {
  const compact = query.length > 18 ? `${query.slice(0, 18)}...` : query;
  return `关键词“${compact}”`;
}

function formatGalleryFilterSummary(filters) {
  const parts = [];

  if (filters.query) {
    parts.push(formatGalleryQuerySummary(filters.query));
  }

  if (filters.date) {
    parts.push(filters.date);
  } else if (filters.window !== "all") {
    parts.push(GALLERY_WINDOW_LABELS[filters.window] || filters.window);
  }

  if (filters.size !== "all") {
    parts.push(formatCanvasLabel(filters.size));
  }

  if (filters.reference !== "all") {
    parts.push(GALLERY_REFERENCE_LABELS[filters.reference] || filters.reference);
  }

  return parts.join(" · ");
}

function renderGallerySelectOptions(select, options, activeValue) {
  if (!select) {
    return;
  }

  select.innerHTML = "";
  options.forEach((option) => {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = `${option.label} · ${option.count}`;
    select.appendChild(element);
  });

  if (options.some((option) => option.value === activeValue)) {
    select.value = activeValue;
    return;
  }

  select.value = options[0]?.value || "all";
}

function getRatioOption(value) {
  return state.aspectRatios.find((option) => option.value === value) || state.aspectRatios[0] || null;
}

function getVisibleRatios() {
  return [...state.aspectRatios];
}

function getViewFromHash() {
  return window.location.hash === "#gallery" ? "gallery" : "studio";
}

function syncHash(view) {
  const nextHash = view === "gallery" ? "#gallery" : "#studio";
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, "", nextHash);
  }
}

function getOrCreateClientSessionId() {
  const storageKey = "image-studio-client-session-id";
  const existing = window.localStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }

  const next = `studio-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(storageKey, next);
  return next;
}

function compactErrorMessage(message, fallbackLabel = "请求失败") {
  const raw = String(message || fallbackLabel).trim();
  const httpStatus = raw.match(/HTTP\s+(\d{3})/i)?.[1] || raw.match(/"status"\s*:\s*(\d{3})/i)?.[1] || "";
  const errorCode =
    raw.match(/错误码\s*([A-Za-z0-9_.-]+)/i)?.[1] ||
    raw.match(/"error_code"\s*:\s*"?([A-Za-z0-9_.-]+)"?/i)?.[1] ||
    raw.match(/"code"\s*:\s*"([^"]+)"/i)?.[1] ||
    httpStatus;

  if (!httpStatus && !errorCode) {
    return raw;
  }

  let label = fallbackLabel;
  if (/图片分析|Prompt Agent/i.test(raw)) {
    label = "图片分析请求失败";
  } else if (/生成|接口请求|image_generation/i.test(raw)) {
    label = "生成请求失败";
  }

  return `${label}：${[httpStatus ? `HTTP ${httpStatus}` : "", errorCode ? `错误码 ${errorCode}` : ""]
    .filter(Boolean)
    .join("，")}`;
}

function showError(message) {
  refs.errorBanner.textContent = compactErrorMessage(message);
  refs.errorBanner.classList.remove("hidden");
}

function clearError() {
  refs.errorBanner.textContent = "";
  refs.errorBanner.classList.add("hidden");
}

function setConnectionState(kind, label) {
  refs.connectionStatus.dataset.state = kind;
  refs.connectionLabel.textContent = label;
}

function syncConnectionState() {
  const queuedCount = getQueuedJobCount();
  if (queuedCount > 0) {
    setConnectionState("busy", `并发 ${getRunningJobCount()}/${getMaxParallelJobCount()} · 队列 ${queuedCount}/${getMaxQueuedJobCount()}`);
    return;
  }

  if (state.config?.apiKeyConfigured) {
    setConnectionState("ready", "本地已就绪");
    return;
  }

  setConnectionState("idle", "请先配置 API");
}

function setDrawerOpen(open) {
  refs.configDrawer.classList.toggle("open", open);
  refs.configDrawer.setAttribute("aria-hidden", String(!open));
}

function setLightboxOpen(open) {
  refs.lightbox.classList.toggle("hidden", !open);
  refs.lightbox.classList.toggle("open", open);
  refs.lightbox.setAttribute("aria-hidden", String(!open));
}

function resetPromptCopyFeedback() {
  if (promptCopyFeedbackTimer) {
    window.clearTimeout(promptCopyFeedbackTimer);
    promptCopyFeedbackTimer = 0;
  }

  if (!refs.copyPromptButton) {
    return;
  }

  refs.copyPromptButton.textContent = "复制";
  refs.copyPromptButton.dataset.copied = "false";
}

function markPromptCopied() {
  if (!refs.copyPromptButton) {
    return;
  }

  resetPromptCopyFeedback();
  refs.copyPromptButton.textContent = "已复制";
  refs.copyPromptButton.dataset.copied = "true";
  promptCopyFeedbackTimer = window.setTimeout(() => {
    promptCopyFeedbackTimer = 0;
    resetPromptCopyFeedback();
  }, 1600);
}

function syncLightboxZoomState() {
  refs.lightboxImage.classList.toggle("is-zoomed", state.lightboxZoomed);
  refs.lightboxImageShell?.classList.toggle("is-zoomed", state.lightboxZoomed);
  refs.lightboxMediaStage?.classList.toggle("is-zoomed", state.lightboxZoomed);
}

function getCurrentStudioLayoutMode() {
  return (
    document.documentElement.dataset.uiLayout ||
    getStudioLayoutMode({
      width: window.innerWidth,
      outerWidth: window.outerWidth,
    })
  );
}

function getGalleryLayoutWidth() {
  return Math.max(
    refs.galleryPanel?.clientWidth || 0,
    refs.galleryView?.clientWidth || 0,
    refs.viewRoot?.clientWidth || 0,
    window.innerWidth || 0,
  );
}

function syncGalleryLayoutMode() {
  if (!refs.galleryView) {
    return;
  }

  refs.galleryView.dataset.galleryLayout = getGalleryLayoutModeForWidth(getGalleryLayoutWidth());
}

function syncStudioDensity() {
  const settings = getStudioDensitySettings({
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    outerWidth: window.outerWidth,
    visualScale: window.visualViewport?.scale || 1,
  });
  const layoutMode = settings.layoutMode || getStudioLayoutMode({
    width: window.innerWidth,
    outerWidth: window.outerWidth,
  });

  document.documentElement.dataset.uiDensity = settings.mode;
  document.documentElement.dataset.uiLayout = layoutMode;

  for (const name of ALL_VARIABLE_NAMES) {
    document.documentElement.style.removeProperty(name);
  }

  for (const [name, value] of Object.entries(settings.variables)) {
    document.documentElement.style.setProperty(name, value);
  }
}

function scheduleStudioDensitySync() {
  if (studioDensitySyncFrame) {
    window.cancelAnimationFrame(studioDensitySyncFrame);
  }

  studioDensitySyncFrame = window.requestAnimationFrame(() => {
    studioDensitySyncFrame = 0;
    syncStudioDensity();
    window.requestAnimationFrame(() => {
      syncGalleryLayoutMode();
      scheduleStudioHeightSync();
      scheduleGalleryPanelHeightSync();
      scheduleGalleryScrollSync();
      renderGalleryView();
    });
  });
}

let densityZoomEndTimer = 0;

function bindStudioDensitySync() {
  window.addEventListener("resize", scheduleStudioDensitySync);
  window.visualViewport?.addEventListener("resize", scheduleStudioDensitySync);

  if (window.visualViewport) {
    window.visualViewport.addEventListener("scroll", () => {
      if (densityZoomEndTimer) {
        window.clearTimeout(densityZoomEndTimer);
      }
      densityZoomEndTimer = window.setTimeout(() => {
        densityZoomEndTimer = 0;
        scheduleStudioDensitySync();
      }, 150);
    });
  }
}

function setActiveView(view) {
  state.activeView = view;
  syncHash(view);

  refs.viewTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.viewTab === view);
  });

  refs.viewPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.viewPanel !== view);
  });

  syncGalleryLayoutMode();
  scheduleStudioHeightSync();
  scheduleGalleryPanelHeightSync();
  scheduleGalleryScrollSync();
}

function updatePromptCounter() {
  refs.promptCounter.textContent = String(refs.promptInput.value.length);
}

function getQueuedJobCount() {
  return state.jobs.length;
}

function getRunningJobCount() {
  return state.jobs.filter((job) => job.isRunning).length;
}

function getMaxQueuedJobCount() {
  return state.limits.maxConcurrentTasksPerSession || DEFAULT_LIMITS.maxConcurrentTasksPerSession;
}

function getMaxParallelJobCount() {
  return state.limits.maxParallelTasksPerSession || DEFAULT_LIMITS.maxParallelTasksPerSession;
}

function updateGenerateButton() {
  const runningCount = getRunningJobCount();
  const queuedCount = getQueuedJobCount();
  const maxQueuedCount = getMaxQueuedJobCount();
  const maxParallelCount = getMaxParallelJobCount();
  refs.generateButton.disabled = queuedCount >= maxQueuedCount;
  refs.generateButton.textContent =
    queuedCount > 0 ? `队列 ${queuedCount}/${maxQueuedCount}` : "开始生成";
  refs.liveCount.textContent = `${runningCount} / ${maxParallelCount}`;
}

function setPromptAgentFeedback(message, kind = "") {
  refs.promptAgentFeedback.textContent =
    kind === "error" ? compactErrorMessage(message, "图片分析请求失败") : message || "";
  refs.promptAgentFeedback.dataset.state = kind;
}

function revokePromptAgentPreview() {
  if (state.promptAgent.previewUrl) {
    URL.revokeObjectURL(state.promptAgent.previewUrl);
  }
}

function setPromptAgentOpen(open) {
  refs.promptAgentModal.classList.toggle("hidden", !open);
  refs.promptAgentModal.setAttribute("aria-hidden", String(!open));
  if (open) {
    renderPromptAgent();
    loadPromptAgentHistory().catch((error) => setPromptAgentFeedback(error.message, "error"));
  }
}

function getPromptAgentItem(itemId) {
  const current = state.promptAgent.result;
  if (current?.id === itemId) {
    return current;
  }

  return state.promptAgent.history.find((item) => item.id === itemId) || null;
}

function getPromptAgentPrompt(item) {
  return String(item?.json?.prompt || "").trim();
}

function getPromptAgentJsonText(item = state.promptAgent.result) {
  if (!item?.json) {
    return "";
  }

  return JSON.stringify(item.json, null, 2);
}

function renderPromptAgentPreview() {
  const file = state.promptAgent.file;
  refs.promptAgentPreview.classList.toggle("hidden", !file);
  refs.promptAgentPreview.classList.toggle("is-analyzing", state.promptAgent.running);
  refs.promptAgentAnalysisMotion.classList.toggle("is-active", state.promptAgent.running);

  if (!file) {
    refs.promptAgentPreviewImage.removeAttribute("src");
    refs.promptAgentFilename.textContent = "--";
    refs.promptAgentFileMeta.textContent = "--";
    return;
  }

  refs.promptAgentPreviewImage.src = state.promptAgent.previewUrl;
  refs.promptAgentFilename.textContent = file.name || "uploaded-image";
  refs.promptAgentFileMeta.textContent = `${file.type || "image"} · ${formatFileSize(file.size)}`;
}

function openPromptAgentImageViewer() {
  if (!state.promptAgent.previewUrl) {
    return;
  }

  state.promptAgent.viewerOpen = true;
  refs.promptAgentImageViewerImage.src = state.promptAgent.previewUrl;
  refs.promptAgentImageViewer.classList.add("open");
  refs.promptAgentImageViewer.setAttribute("aria-hidden", "false");
}

function closePromptAgentImageViewer() {
  state.promptAgent.viewerOpen = false;
  refs.promptAgentImageViewer.classList.remove("open");
  refs.promptAgentImageViewer.setAttribute("aria-hidden", "true");
}

function createPromptAgentHistoryCard(item) {
  const card = document.createElement("article");
  card.className = "prompt-agent-history-card";

  const titleRow = document.createElement("div");
  titleRow.className = "prompt-agent-history-title";

  const title = document.createElement("strong");
  title.textContent = item.json?.title || "图片提示词";

  const time = document.createElement("span");
  time.textContent = formatTime(item.createdAt);

  titleRow.append(title, time);

  const promptButton = document.createElement("button");
  promptButton.className = "prompt-agent-prompt-button";
  promptButton.type = "button";
  promptButton.dataset.promptAgentMapId = item.id;
  promptButton.textContent = getPromptAgentPrompt(item) || "未返回 prompt 字段";

  const meta = document.createElement("div");
  meta.className = "prompt-agent-history-meta";
  const tags = Array.isArray(item.json?.style_tags) ? item.json.style_tags.slice(0, 4).join(" / ") : "";
  meta.textContent = [item.filename, item.json?.aspect_ratio, tags].filter(Boolean).join(" · ");

  const actions = document.createElement("div");
  actions.className = "prompt-agent-history-actions";

  const mapButton = document.createElement("button");
  mapButton.className = "inline-button";
  mapButton.type = "button";
  mapButton.dataset.promptAgentMapId = item.id;
  mapButton.textContent = "映射到提示词";

  const copyButton = document.createElement("button");
  copyButton.className = "inline-button";
  copyButton.type = "button";
  copyButton.dataset.promptAgentCopyId = item.id;
  copyButton.textContent = "复制 JSON";

  actions.append(mapButton, copyButton);
  card.append(titleRow, promptButton, meta, actions);
  return card;
}

function renderPromptAgentHistory() {
  refs.promptAgentHistoryList.replaceChildren();
  refs.promptAgentHistoryCount.textContent = `${state.promptAgent.history.length} 条`;
  refs.promptAgentHistoryEmpty.classList.toggle("hidden", state.promptAgent.history.length > 0);

  state.promptAgent.history.forEach((item) => {
    refs.promptAgentHistoryList.append(createPromptAgentHistoryCard(item));
  });
}

function renderPromptAgent() {
  renderPromptAgentPreview();
  refs.promptAgentAnalyzeButton.disabled = state.promptAgent.running || !state.promptAgent.file;
  refs.promptAgentAnalyzeButton.textContent = state.promptAgent.running ? "分析中..." : "分析图片";
  refs.copyPromptAgentJsonButton.disabled = !state.promptAgent.result?.json;
  refs.promptAgentResult.value = getPromptAgentJsonText();
  renderPromptAgentHistory();
}

function revokeReferencePreview(item) {
  if (item?.previewUrl) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

function resetReferenceFiles() {
  state.referenceFiles.forEach(revokeReferencePreview);
  state.referenceFiles = [];
  refs.referenceInput.value = "";
  renderReferenceGrid();
}

function removeReferenceFile(referenceId) {
  const target = state.referenceFiles.find((item) => item.id === referenceId);
  revokeReferencePreview(target);
  state.referenceFiles = state.referenceFiles.filter((item) => item.id !== referenceId);
  renderReferenceGrid();
}

function applyReferenceFiles(fileList) {
  const incomingFiles = [...(fileList || [])].filter((file) => file.type.startsWith("image/"));
  if (incomingFiles.length === 0) {
    return;
  }

  const next = [...state.referenceFiles];
  const fingerprints = new Set(next.map((item) => item.fingerprint));
  let overflowed = false;

  for (const file of incomingFiles) {
    if (next.length >= state.limits.maxReferenceImages) {
      overflowed = true;
      break;
    }

    const fingerprint = buildReferenceFingerprint(file);
    if (fingerprints.has(fingerprint)) {
      continue;
    }

    next.push({
      id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fingerprint,
      file,
      previewUrl: URL.createObjectURL(file),
    });
    fingerprints.add(fingerprint);
  }

  state.referenceFiles = next;
  refs.referenceInput.value = "";
  renderReferenceGrid();

  if (overflowed) {
    showError(`参考图最多支持 ${state.limits.maxReferenceImages} 张。`);
  }
}

function renderReferenceGrid() {
  refs.referenceGrid.innerHTML = "";
  refs.referenceCount.textContent = `${state.referenceFiles.length} / ${state.limits.maxReferenceImages}`;
  refs.referenceGrid.classList.toggle("hidden", state.referenceFiles.length === 0);

  state.referenceFiles.forEach((item) => {
    const card = document.createElement("div");
    card.className = "reference-card";

    const image = document.createElement("img");
    image.src = item.previewUrl;
    image.alt = item.file.name;
    card.appendChild(image);

    const meta = document.createElement("div");
    meta.className = "reference-card-meta";

    const name = document.createElement("span");
    name.textContent = item.file.name;
    meta.appendChild(name);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "reference-remove";
    remove.textContent = "移除";
    remove.addEventListener("click", () => removeReferenceFile(item.id));
    meta.appendChild(remove);

    card.appendChild(meta);
    refs.referenceGrid.appendChild(card);
  });
}

function renderReasoningOptions() {
  const currentValue = refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh";
  refs.reasoningEffortInput.innerHTML = "";

  state.reasoningEfforts.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = REASONING_LABELS[value] || value;
    refs.reasoningEffortInput.appendChild(option);
  });

  if (state.reasoningEfforts.includes(currentValue)) {
    refs.reasoningEffortInput.value = currentValue;
  } else {
    refs.reasoningEffortInput.value = state.reasoningEfforts[0] || "xhigh";
  }
}

function renderSizeOptions() {
  const ratioValue = refs.ratioInput.value || "4:5";
  const currentValue = normalizeGenerationSize(ratioValue, refs.sizeInput.value || "auto");
  refs.sizeInput.innerHTML = "";

  getGenerationSizeOptions(ratioValue).forEach((option) => {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    refs.sizeInput.appendChild(element);
  });

  refs.sizeInput.value = currentValue;
}

function syncStudioHeight() {
  if (!refs.settingsPanel || !refs.previewPanel || !refs.sideColumn || !refs.viewRoot) {
    return;
  }

  if (STACKED_STUDIO_LAYOUT_MODES.has(getCurrentStudioLayoutMode()) || state.activeView !== "studio") {
    document.documentElement.style.removeProperty("--studio-column-height");
    return;
  }

  document.documentElement.style.removeProperty("--studio-column-height");

  void refs.settingsPanel.offsetHeight;

  const viewRootRect = refs.viewRoot.getBoundingClientRect();
  const availableHeight = Math.max(600, Math.floor(window.innerHeight - viewRootRect.top - 12));
  const resolvedHeight = availableHeight;

  if (resolvedHeight > 0) {
    document.documentElement.style.setProperty("--studio-column-height", `${resolvedHeight}px`);
  }
}

function scheduleStudioHeightSync() {
  if (studioHeightSyncFrame) {
    window.cancelAnimationFrame(studioHeightSyncFrame);
  }

  studioHeightSyncFrame = window.requestAnimationFrame(() => {
    studioHeightSyncFrame = 0;
    syncStudioHeight();
    window.requestAnimationFrame(() => {
      syncStudioHeight();
    });
  });
}

function syncGalleryPanelHeight() {
  if (!refs.galleryPanel || !refs.viewRoot) {
    return;
  }

  syncGalleryLayoutMode();
  document.documentElement.style.removeProperty("--gallery-panel-height");

  void refs.viewRoot.offsetHeight;

  const viewRootRect = refs.viewRoot.getBoundingClientRect();
  const availableHeight = Math.max(320, Math.floor(window.innerHeight - viewRootRect.top - 12));
  document.documentElement.style.setProperty("--gallery-panel-height", `${availableHeight}px`);
}

function scheduleGalleryPanelHeightSync() {
  if (galleryPanelHeightSyncFrame) {
    window.cancelAnimationFrame(galleryPanelHeightSyncFrame);
  }

  galleryPanelHeightSyncFrame = window.requestAnimationFrame(() => {
    galleryPanelHeightSyncFrame = 0;
    syncGalleryPanelHeight();
    syncGalleryScrollUi();
  });
}

function bindStudioHeightSync() {
  window.addEventListener("resize", () => scheduleStudioHeightSync());

  if (typeof ResizeObserver === "function" && refs.settingsPanel) {
    studioHeightObserver = new ResizeObserver(() => {
      scheduleStudioHeightSync();
    });
    studioHeightObserver.observe(refs.settingsPanel);
  }
}

function bindGalleryPanelHeightSync() {
  const handleChange = () => scheduleGalleryPanelHeightSync();
  window.addEventListener("resize", handleChange);

  if (typeof ResizeObserver === "function") {
    galleryPanelHeightObserver = new ResizeObserver(() => {
      scheduleGalleryPanelHeightSync();
    });

    if (refs.topbar) {
      galleryPanelHeightObserver.observe(refs.topbar);
    }

    if (refs.viewRoot) {
      galleryPanelHeightObserver.observe(refs.viewRoot);
    }
  }
}

function getGalleryMaxScroll() {
  if (!refs.galleryScrollRegion) {
    return 0;
  }

  return Math.max(0, refs.galleryScrollRegion.scrollHeight - refs.galleryScrollRegion.clientHeight);
}

function getGalleryScrollMetrics() {
  const trackHeight = refs.galleryScrollTrack?.clientHeight || 0;
  const maxScroll = getGalleryMaxScroll();
  const clientHeight = refs.galleryScrollRegion?.clientHeight || 0;
  const scrollHeight = refs.galleryScrollRegion?.scrollHeight || 0;
  const disabled = maxScroll <= 0 || trackHeight <= 0;
  const thumbHeight = disabled
    ? trackHeight
    : Math.min(trackHeight, Math.max(54, Math.round((clientHeight / scrollHeight) * trackHeight)));
  const maxOffset = Math.max(0, trackHeight - thumbHeight);
  const currentScroll = Math.min(maxScroll, Math.max(0, refs.galleryScrollRegion?.scrollTop || 0));
  const offset = disabled || maxOffset === 0 ? 0 : (currentScroll / maxScroll) * maxOffset;

  return {
    currentScroll,
    disabled,
    maxOffset,
    maxScroll,
    offset,
    thumbHeight,
  };
}

function syncGalleryScrollUi() {
  if (
    !refs.galleryScrollRegion ||
    !refs.galleryScrollbar ||
    !refs.galleryScrollThumb ||
    !refs.galleryScrollTrack ||
    !refs.galleryScrollUp ||
    !refs.galleryScrollDown
  ) {
    return;
  }

  const metrics = getGalleryScrollMetrics();

  refs.galleryScrollbar.dataset.disabled = String(metrics.disabled);
  refs.galleryScrollbar.setAttribute("aria-hidden", String(metrics.disabled));
  refs.galleryScrollThumb.style.height = `${metrics.thumbHeight}px`;
  refs.galleryScrollThumb.style.transform = `translateY(${Math.round(metrics.offset)}px)`;
  refs.galleryScrollUp.disabled = metrics.disabled || metrics.currentScroll <= 0;
  refs.galleryScrollDown.disabled = metrics.disabled || metrics.currentScroll >= metrics.maxScroll - 1;
}

function scheduleGalleryScrollSync() {
  if (galleryScrollSyncFrame) {
    window.cancelAnimationFrame(galleryScrollSyncFrame);
  }

  galleryScrollSyncFrame = window.requestAnimationFrame(() => {
    galleryScrollSyncFrame = 0;
    syncGalleryScrollUi();
  });
}

function getSelectedGenerationSize() {
  return normalizeGenerationSize(refs.ratioInput.value || "4:5", refs.sizeInput.value || "auto");
}

function scrollGalleryBy(direction) {
  if (!refs.galleryScrollRegion) {
    return;
  }

  const distance = Math.max(260, Math.round(refs.galleryScrollRegion.clientHeight * 0.78));
  refs.galleryScrollRegion.scrollBy({
    top: direction * distance,
    behavior: "smooth",
  });
}

function setGalleryDragging(active) {
  refs.galleryScrollbar?.classList.toggle("is-dragging", active);
}

function endGalleryThumbDrag() {
  if (!galleryScrollDrag.active) {
    return;
  }

  galleryScrollDrag.active = false;
  galleryScrollDrag.pointerId = null;
  setGalleryDragging(false);
}

function scrollGalleryTrackTo(clientY, smooth = false) {
  if (!refs.galleryScrollTrack || !refs.galleryScrollRegion) {
    return;
  }

  const metrics = getGalleryScrollMetrics();
  if (metrics.disabled || metrics.maxOffset <= 0) {
    return;
  }

  const rect = refs.galleryScrollTrack.getBoundingClientRect();
  const rawOffset = clientY - rect.top - metrics.thumbHeight / 2;
  const nextOffset = Math.min(metrics.maxOffset, Math.max(0, rawOffset));
  const nextScroll = (nextOffset / metrics.maxOffset) * metrics.maxScroll;

  if (smooth) {
    refs.galleryScrollRegion.scrollTo({
      top: nextScroll,
      behavior: "smooth",
    });
  } else {
    refs.galleryScrollRegion.scrollTop = nextScroll;
  }
}

function handleGalleryThumbPointerMove(event) {
  if (!galleryScrollDrag.active || !refs.galleryScrollRegion) {
    return;
  }

  const metrics = getGalleryScrollMetrics();
  if (metrics.maxOffset <= 0) {
    return;
  }

  const nextOffset = Math.min(
    metrics.maxOffset,
    Math.max(0, galleryScrollDrag.startOffset + (event.clientY - galleryScrollDrag.startY)),
  );
  refs.galleryScrollRegion.scrollTop = (nextOffset / metrics.maxOffset) * metrics.maxScroll;
}

function bindGalleryScrollSync() {
  if (
    !refs.galleryScrollRegion ||
    !refs.gallerySections ||
    !refs.galleryScrollThumb ||
    !refs.galleryScrollTrack ||
    !refs.galleryScrollUp ||
    !refs.galleryScrollDown
  ) {
    return;
  }

  refs.galleryScrollRegion.addEventListener(
    "scroll",
    () => {
      syncGalleryScrollUi();
    },
    { passive: true },
  );

  refs.galleryScrollTrack.addEventListener("pointerdown", (event) => {
    if (event.target === refs.galleryScrollThumb) {
      return;
    }

    scrollGalleryTrackTo(event.clientY, true);
  });

  refs.galleryScrollThumb.addEventListener("pointerdown", (event) => {
    const metrics = getGalleryScrollMetrics();
    if (metrics.disabled) {
      return;
    }

    event.preventDefault();
    galleryScrollDrag.active = true;
    galleryScrollDrag.pointerId = event.pointerId;
    galleryScrollDrag.startY = event.clientY;
    galleryScrollDrag.startOffset = metrics.offset;
    refs.galleryScrollThumb.setPointerCapture?.(event.pointerId);
    setGalleryDragging(true);
  });

  refs.galleryScrollUp.addEventListener("click", () => {
    scrollGalleryBy(-1);
  });

  refs.galleryScrollDown.addEventListener("click", () => {
    scrollGalleryBy(1);
  });

  window.addEventListener("pointermove", handleGalleryThumbPointerMove);
  window.addEventListener("pointerup", endGalleryThumbDrag);
  window.addEventListener("pointercancel", endGalleryThumbDrag);

  window.addEventListener("resize", () => {
    scheduleGalleryScrollSync();
  });

  if (typeof ResizeObserver === "function") {
    galleryScrollObserver = new ResizeObserver(() => {
      scheduleGalleryScrollSync();
    });
    galleryScrollObserver.observe(refs.galleryScrollRegion);
    galleryScrollObserver.observe(refs.gallerySections);
  }
}

function renderRatioGrid() {
  refs.ratioGrid.innerHTML = "";

  getVisibleRatios().forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ratio-chip";
    if (refs.ratioInput.value === option.value) {
      button.classList.add("active");
    }

    const title = document.createElement("strong");
    title.textContent = option.value;
    button.appendChild(title);

    const subtitle = document.createElement("span");
    subtitle.textContent = option.label.replace(/\s*\d+:\d+/, "").trim();
    button.appendChild(subtitle);

    button.addEventListener("click", () => {
      refs.ratioInput.value = option.value;
      renderRatioGrid();
      renderSizeOptions();
    });

    refs.ratioGrid.appendChild(button);
  });
}

function syncConfigUi(config) {
  refs.baseUrlInput.value = config.baseUrl || "";
  refs.responsesModelInput.value = config.responsesModel || "gpt-5.4";
  refs.savedKeyMask.textContent = config.apiKeyConfigured ? `已保存 ${config.apiKeyMask || ""}` : "未保存";
  refs.configStatus.textContent = config.apiKeyConfigured ? "配置已保存" : "配置未保存";
  state.aspectRatios = config.aspectRatios || [];
  const configLimits = config.limits || {};
  state.limits = {
    ...DEFAULT_LIMITS,
    ...configLimits,
    maxConcurrentTasksPerSession:
      "maxParallelTasksPerSession" in configLimits
        ? configLimits.maxConcurrentTasksPerSession || DEFAULT_LIMITS.maxConcurrentTasksPerSession
        : DEFAULT_LIMITS.maxConcurrentTasksPerSession,
  };
  state.reasoningEfforts = [...(config.reasoningEfforts || DEFAULT_REASONING_EFFORTS)];

  if (!refs.ratioInput.value || !getRatioOption(refs.ratioInput.value)) {
    refs.ratioInput.value = "4:5";
  }

  renderRatioGrid();
  renderReasoningOptions();
  renderSizeOptions();
  syncConnectionState();
  updateGenerateButton();
  renderReferenceGrid();
}

function ensureSelectedPreview() {
  if (state.selectedPreviewKey.startsWith("job:")) {
    const selectedJobId = state.selectedPreviewKey.slice(4);
    if (state.jobs.some((job) => job.id === selectedJobId)) {
      return;
    }
  }

  if (state.selectedPreviewKey.startsWith("file:")) {
    const selectedFilename = state.selectedPreviewKey.slice(5);
    if (state.gallery.some((item) => item.filename === selectedFilename)) {
      return;
    }
  }

  const latestJob = sortGalleryItemsByCreatedAtDesc(state.jobs)[0];
  if (latestJob) {
    state.selectedPreviewKey = makeJobPreviewKey(latestJob.id);
    return;
  }

  const sortedGallery = sortGalleryItemsByCreatedAtDesc(state.gallery);
  const preferredGalleryItem = sortedGallery[0] || null;
  state.selectedPreviewKey = preferredGalleryItem ? makeGalleryPreviewKey(preferredGalleryItem.filename) : "";
}

function setSelectedPreviewKey(key) {
  state.selectedPreviewKey = key || "";
  state.zoom = 1;
  renderStudio();
}

function getSelectedJob() {
  if (!state.selectedPreviewKey.startsWith("job:")) {
    return null;
  }

  return state.jobs.find((job) => job.id === state.selectedPreviewKey.slice(4)) || null;
}

function getSelectedGalleryItem() {
  if (!state.selectedPreviewKey.startsWith("file:")) {
    return null;
  }

  return state.gallery.find((item) => item.filename === state.selectedPreviewKey.slice(5)) || null;
}

function getCurrentPreviewItem() {
  return getSelectedJob() || getSelectedGalleryItem() || null;
}

function openLightbox(item) {
  if (!item || !getImageUrl(item)) {
    return;
  }

  state.lightboxItem = item;
  state.lightboxZoomed = false;
  syncLightboxItem();
  syncLightboxZoomState();
  setLightboxOpen(true);
}

function closeLightbox() {
  state.lightboxItem = null;
  state.lightboxZoomed = false;
  resetPromptCopyFeedback();
  syncLightboxZoomState();
  setLightboxOpen(false);
}

function syncLightboxItem() {
  if (!state.lightboxItem) {
    refs.copyPromptButton.disabled = true;
    resetPromptCopyFeedback();
    return;
  }

  const fresh =
    (state.lightboxItem.filename && state.gallery.find((item) => item.filename === state.lightboxItem.filename)) ||
    (state.lightboxItem.id && state.jobs.find((job) => job.id === state.lightboxItem.id)) ||
    state.lightboxItem;

  const imageUrl = getImageUrl(fresh);
  state.lightboxItem = fresh;
  refs.lightboxModel.textContent = formatImageModelLabel(fresh.imageModel);
  refs.lightboxTime.textContent = formatTime(fresh.createdAt);
  refs.lightboxId.textContent = `ID: ${getDisplayId(fresh)}`;
  refs.lightboxPrompt.value = getDisplayPrompt(fresh);
  refs.lightboxParams.value = buildParameterText(fresh, state.config || {});
  refs.copyPromptButton.disabled = refs.lightboxPrompt.value.trim().length === 0;
  resetPromptCopyFeedback();
  refs.lightboxImage.src = imageUrl;
  refs.lightboxImage.alt = getDisplayPrompt(fresh);
  refs.lightboxAmbient.style.backgroundImage = imageUrl ? `url("${imageUrl}")` : "";
  refs.lightboxDownload.href = imageUrl || "#";
  refs.lightboxDownload.download = fresh.filename || "preview.png";
  refs.lightboxDelete.disabled = !fresh.filename;
  syncLightboxZoomState();
}

function recordActivity({ key, title, detail, status, at }) {
  const nextAt = at || nowIso();
  const existing = state.activityFeed.find((item) => item.key === key);

  if (existing) {
    existing.title = title;
    existing.detail = detail;
    existing.status = status;
    existing.at = nextAt;
  } else {
    state.activityFeed.unshift({
      key,
      title,
      detail,
      status,
      at: nextAt,
    });
  }

  state.activityFeed.sort((left, right) => String(right.at).localeCompare(String(left.at)));
  state.activityFeed = state.activityFeed.slice(0, 12);
}

async function copyLightboxPrompt() {
  const promptText = refs.lightboxPrompt.value;
  if (!promptText.trim()) {
    return;
  }

  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
    throw new Error("当前浏览器不支持复制提示词。");
  }

  await navigator.clipboard.writeText(refs.lightboxPrompt.value);
  markPromptCopied();
}

function recordJobQueued(job) {
  recordActivity({
    key: `${job.id}:queue`,
    title: "排队中",
    detail: "等待资源分配",
    status: "active",
    at: job.createdAt,
  });
}

function handleActivityStatus(jobId, stage, message) {
  const stamp = nowIso();

  if (stage === "uploading" || stage === "connecting") {
    recordActivity({
      key: `${jobId}:queue`,
      title: "排队中",
      detail: message,
      status: "active",
      at: stamp,
    });
    return;
  }

  if (stage === "generating") {
    recordActivity({
      key: `${jobId}:queue`,
      title: "排队中",
      detail: "等待资源分配",
      status: "done",
      at: stamp,
    });
    recordActivity({
      key: `${jobId}:render`,
      title: "图像生成中",
      detail: message,
      status: "active",
      at: stamp,
    });
    return;
  }

  if (stage === "saving") {
    recordActivity({
      key: `${jobId}:render`,
      title: "图像生成中",
      detail: "图像渲染完成",
      status: "done",
      at: stamp,
    });
    recordActivity({
      key: `${jobId}:model`,
      title: "模型处理中",
      detail: "最终图片已返回",
      status: "done",
      at: stamp,
    });
    recordActivity({
      key: `${jobId}:complete`,
      title: "生成完成",
      detail: message,
      status: "active",
      at: stamp,
    });
  }
}

function handleActivityPartial(jobId) {
  const stamp = nowIso();
  recordActivity({
    key: `${jobId}:render`,
    title: "图像生成中",
    detail: "已收到中途预览",
    status: "done",
    at: stamp,
  });
  recordActivity({
    key: `${jobId}:model`,
    title: "模型处理中",
    detail: "GPT Image 2.0 正在返回最终图像",
    status: "active",
    at: stamp,
  });
}

function handleActivityFinal(jobId) {
  const stamp = nowIso();
  recordActivity({
    key: `${jobId}:model`,
    title: "模型处理中",
    detail: "最终图片已返回",
    status: "done",
    at: stamp,
  });
  recordActivity({
    key: `${jobId}:complete`,
    title: "生成完成",
    detail: "正在写入本地 output",
    status: "active",
    at: stamp,
  });
}

function handleActivitySuccess(jobId) {
  recordActivity({
    key: `${jobId}:complete`,
    title: "生成完成",
    detail: "图像已成功生成",
    status: "done",
    at: nowIso(),
  });
}

function handleActivityFailure(jobId, message) {
  recordActivity({
    key: `${jobId}:error`,
    title: "生成失败",
    detail: compactErrorMessage(message, "生成请求失败"),
    status: "error",
    at: nowIso(),
  });
}

function getTimelineItems() {
  if (state.activityFeed.length > 0) {
    return state.activityFeed;
  }

  const current = getCurrentPreviewItem();
  if (current?.createdAt) {
    return [
      {
        key: "complete:fallback",
        title: "生成完成",
        detail: "图像已成功生成",
        status: "done",
        at: current.createdAt,
      },
      {
        key: "model:fallback",
        title: "模型处理中",
        detail: "最终图片已返回",
        status: "done",
        at: current.createdAt,
      },
      {
        key: "render:fallback",
        title: "图像生成中",
        detail: "图像渲染完成",
        status: "done",
        at: current.createdAt,
      },
      {
        key: "queue:fallback",
        title: "排队中",
        detail: "等待资源分配",
        status: "done",
        at: current.createdAt,
      },
    ];
  }

  return [
    {
      key: "complete:idle",
      title: "生成完成",
      detail: "等待任务完成",
      status: "pending",
      at: "",
    },
    {
      key: "model:idle",
      title: "模型处理中",
      detail: "GPT Image 2.0",
      status: "pending",
      at: "",
    },
    {
      key: "render:idle",
      title: "图像生成中",
      detail: "等待渲染启动",
      status: "pending",
      at: "",
    },
    {
      key: "queue:idle",
      title: "排队中",
      detail: "等待资源分配",
      status: "pending",
      at: "",
    },
  ];
}

function renderTimeline() {
  refs.timelineList.innerHTML = "";

  getTimelineItems().forEach((item) => {
    const row = document.createElement("li");
    row.className = `timeline-item ${item.status}`;

    const dot = document.createElement("span");
    dot.className = "timeline-dot";
    row.appendChild(dot);

    const copy = document.createElement("div");
    copy.className = "timeline-copy";

    const title = document.createElement("strong");
    title.textContent = item.title;
    copy.appendChild(title);

    const detail = document.createElement("span");
    detail.textContent = item.detail;
    copy.appendChild(detail);

    row.appendChild(copy);

    const time = document.createElement("time");
    time.textContent = formatClock(item.at);
    row.appendChild(time);

    refs.timelineList.appendChild(row);
  });
}

function createPreviewMotionNode() {
  const motion = document.createElement("div");
  motion.className = "preview-loading-motion";
  motion.setAttribute("aria-hidden", "true");

  [
    "preview-loading-aura",
    "preview-loading-morph preview-loading-morph-a",
    "preview-loading-morph preview-loading-morph-b",
    "preview-loading-trace",
    "preview-loading-core-shell",
    "preview-loading-core",
  ].forEach((className) => {
    const node = document.createElement("span");
    node.className = className;
    motion.appendChild(node);
  });

  return motion;
}

function createPreviewLoadingShellNodes() {
  const eyebrow = document.createElement("p");
  const shell = document.createElement("div");
  shell.className = "preview-loading-shell";
  shell.appendChild(createPreviewMotionNode());

  const copy = document.createElement("div");
  copy.className = "preview-loading-copy";

  const title = document.createElement("h3");
  copy.appendChild(title);

  const metrics = document.createElement("div");
  metrics.className = "preview-loading-metrics";

  const jobMetric = document.createElement("span");
  jobMetric.className = "preview-loading-metric";
  metrics.appendChild(jobMetric);

  const progressMetric = document.createElement("span");
  progressMetric.className = "preview-loading-metric";
  metrics.appendChild(progressMetric);

  copy.appendChild(metrics);

  const status = document.createElement("strong");
  status.className = "preview-loading-status";
  copy.appendChild(status);

  const detail = document.createElement("span");
  detail.className = "preview-loading-detail";
  copy.appendChild(detail);

  shell.appendChild(copy);

  const steps = document.createElement("div");
  steps.className = "preview-loading-steps";
  steps.setAttribute("aria-hidden", "true");
  shell.appendChild(steps);

  return {
    eyebrow,
    shell,
    title,
    jobMetric,
    progressMetric,
    status,
    detail,
    steps,
    state: null,
  };
}

function syncPreviewLoadingSteps(container, steps) {
  container.replaceChildren();
  steps.forEach((step) => {
    const chip = document.createElement("span");
    chip.className = `preview-loading-step is-${step.state}`;
    chip.textContent = step.label;
    container.appendChild(chip);
  });
}

function updatePreviewLoadingShell(nodes, placeholderState) {
  const theme = getPreviewLoadingShellTheme(placeholderState);
  nodes.eyebrow.textContent = placeholderState.eyebrow;
  nodes.shell.dataset.stage = theme.stage;
  nodes.shell.dataset.jobs = String(placeholderState.activeJobCount);
  nodes.shell.style.setProperty("--loading-morph-duration-a", theme.morphDurationA);
  nodes.shell.style.setProperty("--loading-morph-duration-b", theme.morphDurationB);
  nodes.shell.style.setProperty("--loading-pulse-duration", theme.pulseDuration);
  nodes.shell.style.setProperty("--loading-drift-duration", theme.driftDuration);
  nodes.shell.style.setProperty("--loading-motion-tilt", theme.motionTilt);
  nodes.shell.style.setProperty("--loading-motion-scale", theme.motionScale);
  nodes.title.textContent = placeholderState.title;
  nodes.jobMetric.textContent = placeholderState.jobCountLabel;
  nodes.progressMetric.textContent = placeholderState.progressLabel;
  nodes.status.textContent = placeholderState.statusText;
  nodes.detail.textContent = placeholderState.detail;
  syncPreviewLoadingSteps(nodes.steps, placeholderState.steps);
  nodes.state = {
    mode: placeholderState.mode,
    stage: placeholderState.stage,
  };
}

function renderPreviewPlaceholder(placeholderState) {
  refs.previewPlaceholder.className = "preview-placeholder";
  if (placeholderState.mode === "loading") {
    refs.previewPlaceholder.classList.add("preview-placeholder-loading");

    if (
      !previewLoadingShellNodes ||
      !shouldReusePreviewLoadingShell(previewLoadingShellNodes.state || {}, placeholderState)
    ) {
      previewLoadingShellNodes = createPreviewLoadingShellNodes();
    }

    updatePreviewLoadingShell(previewLoadingShellNodes, placeholderState);

    if (
      refs.previewPlaceholder.firstChild !== previewLoadingShellNodes.eyebrow ||
      refs.previewPlaceholder.lastChild !== previewLoadingShellNodes.shell
    ) {
      refs.previewPlaceholder.replaceChildren(previewLoadingShellNodes.eyebrow, previewLoadingShellNodes.shell);
    }

    return;
  }

  previewLoadingShellNodes = null;
  refs.previewPlaceholder.replaceChildren();

  const eyebrow = document.createElement("p");
  eyebrow.textContent = placeholderState.eyebrow;
  refs.previewPlaceholder.appendChild(eyebrow);

  const title = document.createElement("h3");
  title.textContent = placeholderState.title;
  refs.previewPlaceholder.appendChild(title);

  const detail = document.createElement("span");
  detail.textContent = placeholderState.detail;
  refs.previewPlaceholder.appendChild(detail);
}

function renderPreview() {
  const item = getCurrentPreviewItem();
  const imageUrl = getImageUrl(item);
  const placeholderState = getPreviewPlaceholderState({
    item,
    imageUrl,
    prompt: item ? getDisplayPrompt(item) : "",
    runningCount: state.jobs.length,
    maxConcurrentTasks: state.limits.maxConcurrentTasksPerSession,
  });

  refs.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;

  if (placeholderState.mode === "idle") {
    refs.previewModel.textContent = "GPT Image 2.0";
    refs.previewTime.textContent = "等待生成";
    refs.previewId.textContent = "ID: --";
    refs.previewSize.textContent = "--";
    refs.previewPlaceholder.classList.remove("hidden");
    renderPreviewPlaceholder(placeholderState);
    refs.previewImage.removeAttribute("src");
    refs.previewImage.classList.remove("is-mounted", "is-visible");
    refs.previewDownloadButton.removeAttribute("href");
    refs.previewDownloadButton.removeAttribute("download");
    refs.previewDownloadButton.classList.add("disabled");
    refs.previewLightboxButton.disabled = true;
    refs.previewDeleteButton.disabled = true;
    return;
  }

  refs.previewModel.textContent = formatImageModelLabel(item.imageModel);
  refs.previewTime.textContent = formatTime(item.createdAt);
  refs.previewId.textContent = `ID: ${getDisplayId(item)}`;
  refs.previewSize.textContent = formatCanvasLabel(item.size);

  if (placeholderState.mode === "loading") {
    refs.previewPlaceholder.classList.remove("hidden");
    renderPreviewPlaceholder(placeholderState);
    refs.previewImage.removeAttribute("src");
    refs.previewImage.classList.remove("is-mounted", "is-visible");
    refs.previewDownloadButton.removeAttribute("href");
    refs.previewDownloadButton.removeAttribute("download");
    refs.previewDownloadButton.classList.add("disabled");
    refs.previewLightboxButton.disabled = true;
    refs.previewDeleteButton.disabled = true;
    return;
  }

  refs.previewPlaceholder.classList.add("hidden");
  refs.previewImage.classList.remove("is-visible");
  refs.previewImage.classList.add("is-mounted");
  refs.previewImage.onload = () => {
    refs.previewImage.classList.add("is-visible");
  };
  refs.previewImage.style.transform = `scale(${state.zoom})`;
  refs.previewImage.src = imageUrl;
  refs.previewImage.alt = getDisplayPrompt(item);
  refs.previewDownloadButton.href = imageUrl;
  refs.previewDownloadButton.download = item.filename || "preview.png";
  refs.previewDownloadButton.classList.remove("disabled");
  refs.previewLightboxButton.disabled = false;
  refs.previewDeleteButton.disabled = !item.filename;
}

function getFilmstripItems() {
  const activeJobs = sortGalleryItemsByCreatedAtDesc(state.jobs).map((job) => ({
    key: makeJobPreviewKey(job.id),
    item: job,
    label: job.statusText || formatClock(job.createdAt),
  }));

  const recentGallery = sortGalleryItemsByCreatedAtDesc(state.gallery).slice(0, 12).map((item) => ({
    key: makeGalleryPreviewKey(item.filename),
    item,
    label: formatClock(item.createdAt),
  }));

  return [...activeJobs, ...recentGallery].slice(0, 14);
}

function renderFilmstrip() {
  refs.filmstrip.innerHTML = "";

  getFilmstripItems().forEach(({ key, item, label }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filmstrip-item";
    if (key === state.selectedPreviewKey) {
      button.classList.add("active");
    }

    const imageUrl = getImageUrl(item);
    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = getDisplayPrompt(item);
      image.loading = "lazy";
      button.appendChild(image);
    } else {
      const ghost = document.createElement("div");
      ghost.className = "filmstrip-ghost";
      ghost.textContent = "处理中";
      button.appendChild(ghost);
    }

    const caption = document.createElement("span");
    caption.textContent = label;
    button.appendChild(caption);

    button.addEventListener("click", () => {
      setSelectedPreviewKey(key);
    });

    refs.filmstrip.appendChild(button);
  });
}

function createRecentOutputItem(item) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "recent-item";
  if (makeGalleryPreviewKey(item.filename) === state.selectedPreviewKey) {
    button.classList.add("active");
  }

  button.addEventListener("click", () => {
    setSelectedPreviewKey(makeGalleryPreviewKey(item.filename));
  });

  const image = document.createElement("img");
  image.src = getImageUrl(item);
  image.alt = getDisplayPrompt(item);
  image.loading = "lazy";
  button.appendChild(image);

  const copy = document.createElement("div");
  copy.className = "recent-copy";
  copy.innerHTML = `
    <strong>${getDisplayPrompt(item)}</strong>
    <span>${formatRecentOutputMeta(item)}</span>
    <time>${formatClock(item.createdAt)}</time>
  `;
  button.appendChild(copy);

  const actions = document.createElement("div");
  actions.className = "recent-actions";

  const download = document.createElement("a");
  download.className = "mini-action";
  download.href = getImageUrl(item);
  download.download = item.filename;
  download.textContent = "↓";
  download.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  actions.appendChild(download);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "mini-action";
  remove.textContent = "⋯";
  remove.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteGalleryItem(item).catch((error) => {
      showError(error.message);
    });
  });
  actions.appendChild(remove);

  button.appendChild(actions);
  return button;
}

function renderRecentOutputs() {
  refs.recentList.innerHTML = "";
  refs.recentEmpty.classList.toggle("hidden", state.gallery.length > 0);

  getRecentGalleryItems(state.gallery).forEach((item) => {
    refs.recentList.appendChild(createRecentOutputItem(item));
  });
}

function createGalleryTile(item) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "gallery-tile";
  button.addEventListener("click", () => {
    openLightbox(item);
  });

  const image = document.createElement("img");
  image.src = getImageUrl(item);
  image.alt = getDisplayPrompt(item);
  image.loading = "lazy";
  button.appendChild(image);
  return button;
}

function normalizeGalleryColumnPreset(value) {
  const preset = Number(value);
  return GALLERY_COLUMN_PRESETS.includes(preset) ? preset : DEFAULT_GALLERY_COLUMN_PRESET;
}

function getGalleryColumnCount() {
  return normalizeGalleryColumnPreset(state.galleryColumnPreset);
}

function renderGalleryColumnPresetButtons() {
  refs.galleryColumnButtons.forEach((button) => {
    const isActive = normalizeGalleryColumnPreset(button.dataset.galleryColumnPreset) === state.galleryColumnPreset;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function getVisibleGalleryItems(overrides = {}) {
  return filterGalleryItems(state.gallery, getGalleryFilterSnapshot(overrides));
}

function renderGalleryFilters(visibleItems, sections) {
  const filters = getGalleryFilterSnapshot();
  const timeOptions = buildGalleryTimeFilterOptions(getVisibleGalleryItems({ window: "all" }));
  const sizeOptions = buildGallerySizeFilterOptions(getVisibleGalleryItems({ size: "all" }));
  const referenceOptions = buildGalleryReferenceFilterOptions(getVisibleGalleryItems({ reference: "all" }));
  const resolvedSizeOptions =
    filters.size === "all" || sizeOptions.some((option) => option.value === filters.size)
      ? sizeOptions
      : [...sizeOptions, { value: filters.size, label: formatCanvasLabel(filters.size), count: 0 }];

  refs.gallerySearchInput.value = filters.query;
  refs.galleryDateInput.value = filters.date;
  renderGallerySelectOptions(refs.gallerySizeFilterInput, resolvedSizeOptions, filters.size);
  renderGallerySelectOptions(refs.galleryReferenceFilterInput, referenceOptions, filters.reference);
  refs.galleryResetFiltersButton.disabled = !hasActiveGalleryFilters(filters);

  refs.galleryFilters.innerHTML = "";
  timeOptions.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-filter-chip";

    if (option.value === filters.window) {
      button.classList.add("active");
    }

    button.textContent = `${option.label} · ${option.count}`;
    button.addEventListener("click", () => {
      state.galleryControls.window = option.value;
      if (option.value !== "all") {
        state.galleryControls.date = "";
      }
      renderGalleryView();
    });
    refs.galleryFilters.appendChild(button);
  });

  const summary = formatGalleryFilterSummary(filters);
  if (visibleItems.length === 0) {
    refs.galleryHelperText.textContent = summary
      ? `没有匹配 ${summary} 的结果。`
      : "按日期分组显示，可按关键词、日期、尺寸和参考图快速筛选。";
    return;
  }

  const prefix = summary ? `已按 ${summary} 筛选，` : "";
  refs.galleryHelperText.textContent = `${prefix}按日期分组显示，当前共 ${sections.length} 组，显示 ${visibleItems.length} / ${state.gallery.length} 张。`;
}

function createGallerySection(section) {
  const wrapper = document.createElement("section");
  wrapper.className = "gallery-section";

  const header = document.createElement("div");
  header.className = "gallery-section-head";

  const copy = document.createElement("div");
  copy.className = "gallery-section-copy";

  const dateText = document.createElement("strong");
  dateText.textContent = section.dateText || section.label;
  copy.appendChild(dateText);

  header.appendChild(copy);

  const count = document.createElement("span");
  count.className = "count-pill small";
  count.textContent = `${section.count} 张`;
  header.appendChild(count);

  wrapper.appendChild(header);

  const masonry = document.createElement("div");
  masonry.className = "gallery-masonry";
  const columnCount = Math.min(section.items.length || 1, getGalleryColumnCount());
  masonry.style.setProperty("--gallery-columns", String(columnCount));
  distributeGalleryItemsIntoColumns(section.items, columnCount).forEach((columnItems) => {
    const column = document.createElement("div");
    column.className = "gallery-masonry-column";
    columnItems.forEach((item) => {
      column.appendChild(createGalleryTile(item));
    });
    masonry.appendChild(column);
  });
  wrapper.appendChild(masonry);

  return wrapper;
}

function renderGalleryView() {
  const filters = getGalleryFilterSnapshot();
  const visibleItems = getVisibleGalleryItems();
  const sections = buildGallerySections(visibleItems);

  refs.gallerySections.innerHTML = "";
  refs.galleryCount.textContent =
    visibleItems.length === state.gallery.length
      ? `${state.gallery.length} 张`
      : `${visibleItems.length} / ${state.gallery.length} 张`;
  refs.galleryEmpty.textContent =
    state.gallery.length === 0
      ? "还没有本地输出，先回到 Studio 生成一张图。"
      : hasActiveGalleryFilters(filters)
        ? "当前筛选没有命中结果，试试清空部分筛选。"
        : "当前还没有可展示的本地输出。";
  refs.galleryEmpty.classList.toggle("hidden", visibleItems.length > 0);
  renderGalleryFilters(visibleItems, sections);
  renderGalleryColumnPresetButtons();

  sections.forEach((section) => {
    refs.gallerySections.appendChild(createGallerySection(section));
  });

  scheduleGalleryPanelHeightSync();
  scheduleGalleryScrollSync();
}

function renderStudio() {
  ensureSelectedPreview();
  renderPreview();
  renderFilmstrip();
  renderRecentOutputs();
  scheduleStudioHeightSync();
}

function renderAll() {
  ensureSelectedPreview();
  syncConnectionState();
  updateGenerateButton();
  renderTimeline();
  renderStudio();
  renderGalleryView();
  syncLightboxItem();
}

function upsertGalleryItem(item) {
  const hydratedItem = mergeGalleryItemWithCachedMetadata(item, state.galleryMetadataCache[item?.filename]);
  const next = state.gallery.filter((entry) => entry.filename !== hydratedItem.filename);
  next.unshift(hydratedItem);
  state.gallery = sortGalleryItemsByCreatedAtDesc(next);
  syncGalleryMetadataCache(state.gallery);
}

function createPromptTemplateId() {
  return `template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePromptTemplate(template, index = 0) {
  const prompt = String(template?.prompt || "").trim();
  if (!prompt) {
    return null;
  }

  return {
    id: String(template?.id || createPromptTemplateId()),
    name: String(template?.name || `模板 ${index + 1}`).trim() || `模板 ${index + 1}`,
    prompt,
  };
}

function readPromptTemplates() {
  try {
    const raw = window.localStorage.getItem(PROMPT_TEMPLATE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const templates = Array.isArray(parsed)
      ? parsed.map(normalizePromptTemplate).filter(Boolean)
      : [];
    return templates.length > 0 ? templates : DEFAULT_PROMPT_TEMPLATES.map((template) => ({ ...template }));
  } catch {
    return DEFAULT_PROMPT_TEMPLATES.map((template) => ({ ...template }));
  }
}

function writePromptTemplates() {
  window.localStorage.setItem(PROMPT_TEMPLATE_STORAGE_KEY, JSON.stringify(state.promptTemplates));
}

function getSelectedPromptTemplate() {
  return state.promptTemplates.find((template) => template.id === state.selectedPromptTemplateId) || null;
}

function setPromptTemplateFeedback(message = "") {
  refs.promptTemplateFeedback.textContent = message;
}

function selectPromptTemplate(templateId) {
  const template = state.promptTemplates.find((entry) => entry.id === templateId) || state.promptTemplates[0] || null;
  state.selectedPromptTemplateId = template?.id || "";
  refs.promptTemplateNameInput.value = template?.name || "";
  refs.promptTemplateTextInput.value = template?.prompt || "";
  renderPromptTemplates();
}

function renderPromptTemplates() {
  refs.promptTemplateList.innerHTML = "";

  if (state.promptTemplates.length === 0) {
    const empty = document.createElement("div");
    empty.className = "prompt-template-empty";
    empty.textContent = "暂无模板";
    refs.promptTemplateList.appendChild(empty);
    return;
  }

  state.promptTemplates.forEach((template) => {
    const button = document.createElement("button");
    button.className = "prompt-template-item";
    button.type = "button";
    button.classList.toggle("active", template.id === state.selectedPromptTemplateId);
    button.addEventListener("click", () => {
      selectPromptTemplate(template.id);
      setPromptTemplateFeedback("");
    });

    const name = document.createElement("strong");
    name.textContent = template.name;
    button.appendChild(name);

    const prompt = document.createElement("span");
    prompt.textContent = template.prompt;
    button.appendChild(prompt);

    refs.promptTemplateList.appendChild(button);
  });
}

function resetPromptTemplateForm() {
  state.selectedPromptTemplateId = "";
  refs.promptTemplateNameInput.value = "";
  refs.promptTemplateTextInput.value = "";
  refs.promptTemplateNameInput.focus();
  setPromptTemplateFeedback("");
  renderPromptTemplates();
}

function savePromptTemplate(event) {
  event.preventDefault();
  const prompt = refs.promptTemplateTextInput.value.trim();
  if (!prompt) {
    setPromptTemplateFeedback("模板内容不能为空。");
    refs.promptTemplateTextInput.focus();
    return;
  }

  const existing = getSelectedPromptTemplate();
  const name = refs.promptTemplateNameInput.value.trim() || existing?.name || `模板 ${state.promptTemplates.length + 1}`;
  if (existing) {
    existing.name = name;
    existing.prompt = prompt;
  } else {
    const template = {
      id: createPromptTemplateId(),
      name,
      prompt,
    };
    state.promptTemplates.unshift(template);
    state.selectedPromptTemplateId = template.id;
  }

  writePromptTemplates();
  selectPromptTemplate(state.selectedPromptTemplateId);
  setPromptTemplateFeedback("模板已保存。");
}

function applyPromptTemplate() {
  const prompt = refs.promptTemplateTextInput.value.trim();
  if (!prompt) {
    setPromptTemplateFeedback("先选择或填写一个模板。");
    refs.promptTemplateTextInput.focus();
    return;
  }

  refs.promptInput.value = prompt;
  updatePromptCounter();
  setPromptTemplatePopoverOpen(false);
  refs.promptInput.focus();
}

function deletePromptTemplate() {
  const selected = getSelectedPromptTemplate();
  if (!selected) {
    setPromptTemplateFeedback("先选择一个模板。");
    return;
  }

  state.promptTemplates = state.promptTemplates.filter((template) => template.id !== selected.id);
  writePromptTemplates();
  const next = state.promptTemplates[0] || null;
  state.selectedPromptTemplateId = next?.id || "";
  selectPromptTemplate(state.selectedPromptTemplateId);
  setPromptTemplateFeedback("模板已删除。");
}

function setPromptTemplatePopoverOpen(open) {
  refs.promptTemplatePopover.classList.toggle("hidden", !open);
  refs.promptTemplatePopover.setAttribute("aria-hidden", open ? "false" : "true");
  refs.surprisePromptButton.setAttribute("aria-expanded", open ? "true" : "false");

  if (open) {
    if (!state.selectedPromptTemplateId && state.promptTemplates.length > 0) {
      state.selectedPromptTemplateId = state.promptTemplates[0].id;
    }
    selectPromptTemplate(state.selectedPromptTemplateId);
    refs.promptTemplateTextInput.focus();
  }
}

function selectRandomPrompt() {
  setPromptTemplatePopoverOpen(true);
}

function resetZoom() {
  state.zoom = 1;
  renderPreview();
}

function stepZoom(delta) {
  const next = Math.min(1.8, Math.max(0.6, state.zoom + delta));
  state.zoom = Number(next.toFixed(2));
  renderPreview();
}

function parseSseChunk(chunk) {
  const lines = chunk
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  let eventName = "";
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }

  return {
    eventName,
    data: dataLines.join("\n"),
  };
}

async function consumeSse(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const parsed = parseSseChunk(chunk);
      if (!parsed.data || parsed.data === "[DONE]") {
        continue;
      }

      await onEvent(parsed.eventName, JSON.parse(parsed.data));
    }
  }
}

function createJob() {
  const ratioOption = getRatioOption(refs.ratioInput.value || "4:5");
  const referenceFiles = state.referenceFiles.map((item) => item.file);
  const referenceImageNames = referenceFiles.map((file) => file.name);
  const sizeSetting = getSelectedGenerationSize();
  const size = sizeSetting === "auto" ? ratioOption?.baseSize || getDefaultGenerationSize(ratioOption?.value) : sizeSetting;

  return {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: nowIso(),
    prompt: refs.promptInput.value.trim(),
    ratio: ratioOption?.value || "4:5",
    ratioLabel: ratioOption?.label || "标准 4:5",
    sizeSetting,
    size,
    quality: state.config?.defaults?.quality || "high",
    format: state.config?.defaults?.format || "png",
    baseUrl: state.config?.baseUrl || refs.baseUrlInput.value.trim(),
    responsesModel: state.config?.responsesModel || refs.responsesModelInput.value.trim() || "gpt-5.4",
    imageModel: "gpt-image-2",
    reasoningEffort: refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh",
    requestRetryCount: 0,
    referenceFiles,
    hasReferenceImage: referenceFiles.length > 0,
    referenceImageName: referenceImageNames[0] || "",
    referenceImageNames,
    isRunning: false,
    started: false,
    statusStage: "queued",
    statusText: "等待并发槽位",
    previewUrl: "",
  };
}

function updateJob(jobId, patch) {
  const job = state.jobs.find((entry) => entry.id === jobId);
  if (!job) {
    return null;
  }

  Object.assign(job, patch);
  renderAll();
  return job;
}

function removeJob(jobId) {
  state.jobs = state.jobs.filter((job) => job.id !== jobId);
}

async function requestGenerationStream(job) {
  while (true) {
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "x-client-session-id": state.clientSessionId,
        },
        body: buildGenerationFormData(job),
      });

      if (!response.ok || !response.body) {
        throw new Error("生成请求失败");
      }

      return response;
    } catch (error) {
      const retryPlan = getGenerationRequestRetryPlan({
        error,
        retryCount: job.requestRetryCount || 0,
      });
      if (!retryPlan.shouldRetry) {
        if (retryPlan.retryable) {
          throw new Error(retryPlan.message);
        }
        throw error;
      }

      job.requestRetryCount = retryPlan.nextRetryCount;
      updateJob(job.id, {
        requestRetryCount: retryPlan.nextRetryCount,
        statusStage: "connecting",
        statusText: retryPlan.message,
      });
      handleActivityStatus(job.id, "connecting", retryPlan.message);
      await wait(900);
    }
  }
}

async function loadConfig() {
  const response = await fetch("/api/config");
  if (!response.ok) {
    throw new Error("读取配置失败");
  }

  state.config = await response.json();
  syncConfigUi(state.config);
}

async function loadGallery() {
  const response = await fetch("/api/gallery");
  if (!response.ok) {
    throw new Error("读取本地画廊失败");
  }

  const payload = await response.json();
  const sortedItems = sortGalleryItemsByCreatedAtDesc(Array.isArray(payload) ? payload : []);
  const hydratedGallery = hydrateGalleryItems(sortedItems);
  state.gallery = sortGalleryItemsByCreatedAtDesc(hydratedGallery.items);
  renderAll();
  void repairGalleryMetadataQueue(hydratedGallery.repairQueue);
}

async function loadPromptAgentHistory() {
  const response = await fetch("/api/prompt-agent/history");
  if (!response.ok) {
    throw new Error("读取图片提示词历史失败");
  }

  const payload = await response.json();
  state.promptAgent.history = Array.isArray(payload) ? payload : [];
  renderPromptAgent();
}

async function saveConfig(event) {
  event.preventDefault();
  clearError();

  const payload = {
    baseUrl: refs.baseUrlInput.value.trim(),
    apiKey: refs.apiKeyInput.value.trim(),
    responsesModel: refs.responsesModelInput.value.trim() || "gpt-5.4",
  };

  const response = await fetch("/api/config", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("保存配置失败");
  }

  state.config = await response.json();
  refs.apiKeyInput.value = "";
  refs.configFeedback.textContent = "配置已保存到本机 .local/config.json。";
  syncConfigUi(state.config);
}

async function openOutputDirectory() {
  const response = await fetch("/api/output/open", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("打开输出目录失败");
  }
}

async function deleteGalleryItem(item) {
  if (!item?.filename) {
    return;
  }

  const confirmed = window.confirm(`确认删除 ${item.filename} 吗？`);
  if (!confirmed) {
    return;
  }

  const response = await fetch("/api/output/delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename: item.filename,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "删除失败");
  }

  state.gallery = state.gallery.filter((entry) => entry.filename !== item.filename);
  forgetGalleryMetadata(item.filename);

  if (state.selectedPreviewKey === makeGalleryPreviewKey(item.filename)) {
    state.selectedPreviewKey = "";
  }

  if (state.lightboxItem?.filename === item.filename) {
    closeLightbox();
  }

  renderAll();
}

async function clearHistory() {
  if (state.gallery.length === 0) {
    return;
  }

  const confirmed = window.confirm("确认清空所有历史输出吗？");
  if (!confirmed) {
    return;
  }

  for (const item of [...state.gallery]) {
    const response = await fetch("/api/output/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename: item.filename,
      }),
    });

    if (!response.ok) {
      throw new Error(`删除失败：${item.filename}`);
    }
  }

  state.gallery = [];
  state.galleryMetadataCache = {};
  writeGalleryMetadataCache(state.galleryMetadataCache);
  state.selectedPreviewKey = "";
  closeLightbox();
  renderAll();
}

function buildGenerationFormData(job) {
  const formData = new FormData();
  formData.set("prompt", job.prompt);
  formData.set("ratio", job.ratio);
  formData.set("size", job.size);
  formData.set("reasoningEffort", job.reasoningEffort);
  formData.set("clientSessionId", state.clientSessionId);

  job.referenceFiles.forEach((file) => {
    formData.append("referenceImages", file);
  });

  return formData;
}

function applyPromptAgentFile(fileList) {
  const file = [...(fileList || [])].find((item) => item.type.startsWith("image/"));
  if (!file) {
    setPromptAgentFeedback("请选择一张图片。", "error");
    return;
  }

  revokePromptAgentPreview();
  state.promptAgent.file = file;
  state.promptAgent.previewUrl = URL.createObjectURL(file);
  state.promptAgent.result = null;
  refs.promptAgentImageInput.value = "";
  setPromptAgentFeedback("", "");
  renderPromptAgent();
}

function buildPromptAgentFormData() {
  const formData = new FormData();
  formData.set("image", state.promptAgent.file);
  formData.set(
    "reasoningEffort",
    refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh",
  );
  return formData;
}

async function analyzePromptAgentImage() {
  clearError();
  if (!state.promptAgent.file) {
    setPromptAgentFeedback("请先上传一张图片。", "error");
    return;
  }

  state.promptAgent.running = true;
  setPromptAgentFeedback("正在分析图片...", "busy");
  renderPromptAgent();

  try {
    const response = await fetch("/api/prompt-agent/analyze", {
      method: "POST",
      body: buildPromptAgentFormData(),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || "图片分析失败。");
    }

    state.promptAgent.result = payload.item;
    state.promptAgent.history = [
      payload.item,
      ...state.promptAgent.history.filter((item) => item.id !== payload.item.id),
    ];
    setPromptAgentFeedback("已生成 JSON 提示词。", "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setPromptAgentFeedback(message, "error");
    showError(message);
  } finally {
    state.promptAgent.running = false;
    renderPromptAgent();
  }
}

function mapPromptAgentPrompt(itemId) {
  const item = getPromptAgentItem(itemId);
  const promptText = getPromptAgentPrompt(item);
  if (!promptText) {
    setPromptAgentFeedback("这条记录没有可映射的 prompt 字段。", "error");
    return;
  }

  refs.promptInput.value = promptText;
  updatePromptCounter();
  setPromptAgentFeedback("已映射到 Studio 提示词。", "success");
  setPromptAgentOpen(false);
  refs.promptInput.focus();
}

async function copyPromptAgentJson(itemId) {
  const item = itemId ? getPromptAgentItem(itemId) : state.promptAgent.result;
  const jsonText = getPromptAgentJsonText(item);
  if (!jsonText) {
    setPromptAgentFeedback("没有可复制的 JSON。", "error");
    return;
  }

  await navigator.clipboard.writeText(jsonText);
  setPromptAgentFeedback("JSON 已复制。", "success");
}

function scheduleGenerationQueue() {
  const availableSlots = Math.max(0, getMaxParallelJobCount() - getRunningJobCount());
  if (availableSlots === 0) {
    return;
  }

  const queuedJobs = state.jobs.filter((job) => !job.started);
  const nextJobs = queuedJobs.slice(Math.max(0, queuedJobs.length - availableSlots)).reverse();
  nextJobs.forEach((job) => {
    job.started = true;
    job.isRunning = true;
    job.statusStage = "uploading";
    job.statusText = "正在准备生成请求";
    void runGeneration(job);
  });

  if (nextJobs.length > 0) {
    renderAll();
  }
}

async function runGeneration(job) {
  job.started = true;
  job.isRunning = true;
  try {
    const response = await requestGenerationStream(job);

    await consumeSse(response.body, async (eventName, payload) => {
      if (eventName === "status") {
        updateJob(job.id, {
          statusStage: payload.stage,
          statusText: payload.message,
        });
        handleActivityStatus(job.id, payload.stage, payload.message);
        renderAll();
        return;
      }

      if (eventName === "partial_image") {
        updateJob(job.id, {
          previewUrl: payload.dataUrl,
          statusText: "已收到中途预览",
        });
        handleActivityPartial(job.id);
        renderAll();
        return;
      }

      if (eventName === "final_image") {
        updateJob(job.id, {
          previewUrl: payload.dataUrl,
          statusText: "已拿到最终图像，正在写入本地",
        });
        handleActivityFinal(job.id);
        renderAll();
        return;
      }

      if (eventName === "saved") {
        if (payload.item) {
          upsertGalleryItem(payload.item);
          state.selectedPreviewKey = makeGalleryPreviewKey(payload.item.filename);
        }
        handleActivitySuccess(job.id);
        removeJob(job.id);
        renderAll();
        return;
      }

      if (eventName === "error") {
        const message = compactErrorMessage(payload.message, "生成请求失败");
        handleActivityFailure(job.id, message);
        showError(message);
        removeJob(job.id);
        renderAll();
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    handleActivityFailure(job.id, message);
    showError(message);
    removeJob(job.id);
    renderAll();
  } finally {
    const currentJob = state.jobs.find((entry) => entry.id === job.id);
    if (currentJob) {
      currentJob.isRunning = false;
    }
    updateGenerateButton();
    scheduleGenerationQueue();
  }
}

function startGeneration(event) {
  event.preventDefault();
  clearError();

  const prompt = refs.promptInput.value.trim();
  if (!prompt) {
    showError("提示词不能为空。");
    refs.promptInput.focus();
    return;
  }

  if (getQueuedJobCount() >= getMaxQueuedJobCount()) {
    showError(`同一会话最多排队 ${getMaxQueuedJobCount()} 个生成任务。`);
    return;
  }

  const job = createJob();
  state.jobs.unshift(job);
  state.selectedPreviewKey = makeJobPreviewKey(job.id);
  recordJobQueued(job);
  renderAll();
  setActiveView("studio");

  scheduleGenerationQueue();
}

function bindEvents() {
  refs.viewTabs.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveView(button.dataset.viewTab);
    });
  });

  window.addEventListener("hashchange", () => {
    setActiveView(getViewFromHash());
  });

  refs.openConfigButton.addEventListener("click", () => setDrawerOpen(true));
  refs.closeConfigButton.addEventListener("click", () => setDrawerOpen(false));
  refs.closeConfigBackdrop.addEventListener("click", () => setDrawerOpen(false));
  refs.openPromptAgentButton.addEventListener("click", () => setPromptAgentOpen(true));
  refs.promptAgentCloseButton.addEventListener("click", () => setPromptAgentOpen(false));
  refs.promptAgentBackdrop.addEventListener("click", () => setPromptAgentOpen(false));
  refs.promptAgentPreviewButton.addEventListener("click", openPromptAgentImageViewer);
  refs.promptAgentImageViewerBackdrop.addEventListener("click", closePromptAgentImageViewer);
  refs.promptAgentImageViewerClose.addEventListener("click", closePromptAgentImageViewer);
  refs.openOutputButton.addEventListener("click", () => {
    openOutputDirectory().catch((error) => showError(error.message));
  });
  refs.configForm.addEventListener("submit", (event) => {
    saveConfig(event).catch((error) => showError(error.message));
  });
  refs.generateForm.addEventListener("submit", startGeneration);
  refs.surprisePromptButton.addEventListener("click", selectRandomPrompt);
  refs.closePromptTemplateButton.addEventListener("click", () => setPromptTemplatePopoverOpen(false));
  refs.promptTemplateForm.addEventListener("submit", savePromptTemplate);
  refs.newPromptTemplateButton.addEventListener("click", resetPromptTemplateForm);
  refs.applyPromptTemplateButton.addEventListener("click", applyPromptTemplate);
  refs.deletePromptTemplateButton.addEventListener("click", deletePromptTemplate);
  refs.promptInput.addEventListener("input", updatePromptCounter);
  refs.referenceInput.addEventListener("change", (event) => {
    applyReferenceFiles(event.target.files);
  });
  refs.referenceDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.referenceDropzone.classList.add("dragover");
  });
  refs.referenceDropzone.addEventListener("dragleave", () => {
    refs.referenceDropzone.classList.remove("dragover");
  });
  refs.referenceDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    refs.referenceDropzone.classList.remove("dragover");
    applyReferenceFiles(event.dataTransfer?.files);
  });
  refs.promptAgentImageInput.addEventListener("change", (event) => {
    applyPromptAgentFile(event.target.files);
  });
  refs.promptAgentDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.promptAgentDropzone.classList.add("dragover");
  });
  refs.promptAgentDropzone.addEventListener("dragleave", () => {
    refs.promptAgentDropzone.classList.remove("dragover");
  });
  refs.promptAgentDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    refs.promptAgentDropzone.classList.remove("dragover");
    applyPromptAgentFile(event.dataTransfer?.files);
  });
  refs.promptAgentAnalyzeButton.addEventListener("click", () => {
    analyzePromptAgentImage().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      setPromptAgentFeedback(message, "error");
      showError(message);
    });
  });
  refs.copyPromptAgentJsonButton.addEventListener("click", () => {
    copyPromptAgentJson().catch((error) => setPromptAgentFeedback(error.message, "error"));
  });
  refs.promptAgentHistoryList.addEventListener("click", (event) => {
    const mapTarget = event.target.closest("[data-prompt-agent-map-id]");
    if (mapTarget) {
      mapPromptAgentPrompt(mapTarget.dataset.promptAgentMapId);
      return;
    }

    const copyTarget = event.target.closest("[data-prompt-agent-copy-id]");
    if (copyTarget) {
      copyPromptAgentJson(copyTarget.dataset.promptAgentCopyId).catch((error) => {
        setPromptAgentFeedback(error.message, "error");
      });
    }
  });
  refs.refreshGalleryButton.addEventListener("click", () => {
    loadGallery().catch((error) => showError(error.message));
  });
  refs.galleryColumnButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const preset = normalizeGalleryColumnPreset(button.dataset.galleryColumnPreset);
      if (preset === state.galleryColumnPreset) {
        return;
      }

      state.galleryColumnPreset = preset;
      renderGalleryView();
    });
  });
  refs.gallerySearchInput.addEventListener("input", (event) => {
    state.galleryControls.query = event.target.value;
    renderGalleryView();
  });
  refs.galleryDateInput.addEventListener("input", (event) => {
    state.galleryControls.date = event.target.value;
    if (event.target.value) {
      state.galleryControls.window = "all";
    }
    renderGalleryView();
  });
  refs.gallerySizeFilterInput.addEventListener("change", (event) => {
    state.galleryControls.size = event.target.value;
    renderGalleryView();
  });
  refs.galleryReferenceFilterInput.addEventListener("change", (event) => {
    state.galleryControls.reference = event.target.value;
    renderGalleryView();
  });
  refs.galleryResetFiltersButton.addEventListener("click", () => {
    state.galleryControls = { ...DEFAULT_GALLERY_CONTROLS };
    renderGalleryView();
    refs.gallerySearchInput.focus();
  });
  refs.focusGalleryButton.addEventListener("click", () => {
    setActiveView("gallery");
  });
  refs.clearHistoryButton.addEventListener("click", () => {
    clearHistory().catch((error) => showError(error.message));
  });
  refs.previewLightboxButton.addEventListener("click", () => {
    const item = getCurrentPreviewItem();
    if (item && getImageUrl(item)) {
      openLightbox(item);
    }
  });
  refs.previewDeleteButton.addEventListener("click", () => {
    const item = getCurrentPreviewItem();
    if (!item?.filename) {
      return;
    }

    deleteGalleryItem(item).catch((error) => showError(error.message));
  });
  refs.previewImage.addEventListener("click", () => {
    const item = getCurrentPreviewItem();
    if (item && getImageUrl(item)) {
      openLightbox(item);
    }
  });
  refs.zoomOutButton.addEventListener("click", () => stepZoom(-0.1));
  refs.zoomInButton.addEventListener("click", () => stepZoom(0.1));
  refs.zoomResetButton.addEventListener("click", resetZoom);
  refs.lightboxBackdrop.addEventListener("click", closeLightbox);
  refs.lightboxClose.addEventListener("click", closeLightbox);
  refs.lightboxDelete.addEventListener("click", () => {
    if (!state.lightboxItem?.filename) {
      return;
    }

    deleteGalleryItem(state.lightboxItem).catch((error) => showError(error.message));
  });
  refs.copyPromptButton.addEventListener("click", () => {
    copyLightboxPrompt().catch((error) => {
      showError(error.message);
    });
  });
  refs.lightboxImage.addEventListener("click", () => {
    if (!state.lightboxItem || !getImageUrl(state.lightboxItem)) {
      return;
    }

    state.lightboxZoomed = !state.lightboxZoomed;
    syncLightboxZoomState();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!refs.promptTemplatePopover.classList.contains("hidden")) {
        setPromptTemplatePopoverOpen(false);
        return;
      }

      if (!refs.lightbox.classList.contains("hidden")) {
        closeLightbox();
        return;
      }

      if (refs.promptAgentImageViewer.classList.contains("open")) {
        closePromptAgentImageViewer();
        return;
      }

      if (refs.configDrawer.classList.contains("open")) {
        setDrawerOpen(false);
        return;
      }

      if (!refs.promptAgentModal.classList.contains("hidden")) {
        setPromptAgentOpen(false);
      }
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (refs.promptTemplatePopover.classList.contains("hidden")) {
      return;
    }

    if (
      refs.promptTemplatePopover.contains(event.target) ||
      refs.surprisePromptButton.contains(event.target)
    ) {
      return;
    }

    setPromptTemplatePopoverOpen(false);
  });
}

async function bootstrap() {
  state.clientSessionId = getOrCreateClientSessionId();
  state.galleryMetadataCache = readGalleryMetadataCache();
  state.promptTemplates = readPromptTemplates();
  state.selectedPromptTemplateId = state.promptTemplates[0]?.id || "";
  bindEvents();
  bindStudioDensitySync();
  bindStudioHeightSync();
  bindGalleryPanelHeightSync();
  bindGalleryScrollSync();
  scheduleStudioDensitySync();
  syncGalleryLayoutMode();
  updatePromptCounter();
  renderRatioGrid();
  renderReasoningOptions();
  renderSizeOptions();
  updateGenerateButton();
  renderReferenceGrid();
  renderPromptTemplates();
  renderTimeline();
  renderStudio();
  renderGalleryView();
  setActiveView(getViewFromHash());
  scheduleGalleryPanelHeightSync();
  scheduleGalleryScrollSync();

  try {
    await loadConfig();
    await loadGallery();
    await loadPromptAgentHistory();
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
    setConnectionState("error", "初始化失败");
  }
}

bootstrap();
