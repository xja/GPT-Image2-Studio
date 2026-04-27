import {
  buildParameterText,
  formatImageModelLabel,
  formatRecentOutputMeta,
} from "/lib/studio-formatters.mjs";
import {
  getDefaultGenerationSize,
  getGenerationSizeOptions,
  normalizeGenerationSize,
} from "/lib/generation-size-options.mjs";

const FEATURED_RATIOS = ["4:5", "1:1", "3:4", "16:9", "9:16"];
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
  maxConcurrentTasksPerSession: 5,
  maxReferenceImages: 6,
};

const GALLERY_COLUMN_PRESETS = [6, 9, 12];
const DEFAULT_GALLERY_COLUMN_PRESET = 12;
const DEFAULT_REASONING_EFFORTS = ["low", "medium", "high", "xhigh"];
const DESKTOP_STUDIO_MEDIA = "(max-width: 1260px)";

let studioHeightSyncFrame = 0;
let studioHeightObserver = null;
let galleryScrollSyncFrame = 0;
let galleryScrollObserver = null;
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
  galleryColumnPreset: DEFAULT_GALLERY_COLUMN_PRESET,
  jobs: [],
  lightboxItem: null,
  limits: { ...DEFAULT_LIMITS },
  reasoningEfforts: [...DEFAULT_REASONING_EFFORTS],
  referenceFiles: [],
  selectedPreviewKey: "",
  zoom: 1,
};

const refs = {
  advancedBaseUrl: document.querySelector("#advancedBaseUrl"),
  advancedResponsesModel: document.querySelector("#advancedResponsesModel"),
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
  galleryEmpty: document.querySelector("#galleryEmpty"),
  galleryMasonry: document.querySelector("#galleryMasonry"),
  galleryScrollbar: document.querySelector("#galleryScrollbar"),
  galleryScrollDown: document.querySelector("#galleryScrollDown"),
  galleryScrollRegion: document.querySelector("#galleryScrollRegion"),
  galleryScrollThumb: document.querySelector("#galleryScrollThumb"),
  galleryScrollTrack: document.querySelector("#galleryScrollTrack"),
  galleryScrollUp: document.querySelector("#galleryScrollUp"),
  generateButton: document.querySelector("#generateButton"),
  generateForm: document.querySelector("#generateForm"),
  lightbox: document.querySelector("#lightbox"),
  lightboxAmbient: document.querySelector("#lightboxAmbient"),
  lightboxBackdrop: document.querySelector("#lightboxBackdrop"),
  lightboxClose: document.querySelector("#lightboxClose"),
  lightboxDelete: document.querySelector("#lightboxDelete"),
  lightboxDownload: document.querySelector("#lightboxDownload"),
  lightboxId: document.querySelector("#lightboxId"),
  lightboxImage: document.querySelector("#lightboxImage"),
  lightboxModel: document.querySelector("#lightboxModel"),
  lightboxParams: document.querySelector("#lightboxParams"),
  lightboxPrompt: document.querySelector("#lightboxPrompt"),
  lightboxTime: document.querySelector("#lightboxTime"),
  liveCount: document.querySelector("#liveCount"),
  openConfigButton: document.querySelector("#openConfigButton"),
  openOutputButton: document.querySelector("#openOutputButton"),
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
  promptInput: document.querySelector("#promptInput"),
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
  settingsPanel: document.querySelector(".settings-panel"),
  sideColumn: document.querySelector(".side-column"),
  timelineList: document.querySelector("#timelineList"),
  viewPanels: [...document.querySelectorAll("[data-view-panel]")],
  viewTabs: [...document.querySelectorAll("[data-view-tab]")],
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

function nowIso() {
  return new Date().toISOString();
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

function getRatioOption(value) {
  return state.aspectRatios.find((option) => option.value === value) || state.aspectRatios[0] || null;
}

function getVisibleRatios() {
  const featured = FEATURED_RATIOS.map((value) => getRatioOption(value)).filter(Boolean);
  return featured.length > 0 ? featured : state.aspectRatios.slice(0, 5);
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

function showError(message) {
  refs.errorBanner.textContent = message;
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
  const runningCount = state.jobs.length;
  if (runningCount > 0) {
    setConnectionState("busy", `生成中 ${runningCount}/${state.limits.maxConcurrentTasksPerSession}`);
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

function setActiveView(view) {
  state.activeView = view;
  syncHash(view);

  refs.viewTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.viewTab === view);
  });

  refs.viewPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.viewPanel !== view);
  });

  scheduleStudioHeightSync();
  scheduleGalleryScrollSync();
}

function updatePromptCounter() {
  refs.promptCounter.textContent = String(refs.promptInput.value.length);
}

function getRunningJobCount() {
  return state.jobs.length;
}

function updateGenerateButton() {
  const runningCount = getRunningJobCount();
  const maxCount = state.limits.maxConcurrentTasksPerSession;
  refs.generateButton.disabled = runningCount >= maxCount;
  refs.generateButton.textContent = runningCount > 0 ? `生成中 ${runningCount}/${maxCount}` : "开始生成";
  refs.liveCount.textContent = `${runningCount} / ${maxCount}`;
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
  if (!refs.settingsPanel || !refs.previewPanel || !refs.sideColumn) {
    return;
  }

  if (window.matchMedia(DESKTOP_STUDIO_MEDIA).matches || state.activeView !== "studio") {
    document.documentElement.style.removeProperty("--studio-column-height");
    return;
  }

  const settingsHeight = Math.ceil(refs.settingsPanel.getBoundingClientRect().height);
  if (settingsHeight > 0) {
    document.documentElement.style.setProperty("--studio-column-height", `${settingsHeight}px`);
  }
}

function scheduleStudioHeightSync() {
  if (studioHeightSyncFrame) {
    window.cancelAnimationFrame(studioHeightSyncFrame);
  }

  studioHeightSyncFrame = window.requestAnimationFrame(() => {
    studioHeightSyncFrame = 0;
    syncStudioHeight();
  });
}

function bindStudioHeightSync() {
  const desktopMediaQuery = window.matchMedia(DESKTOP_STUDIO_MEDIA);
  const handleMediaChange = () => scheduleStudioHeightSync();

  if (typeof desktopMediaQuery.addEventListener === "function") {
    desktopMediaQuery.addEventListener("change", handleMediaChange);
  } else if (typeof desktopMediaQuery.addListener === "function") {
    desktopMediaQuery.addListener(handleMediaChange);
  }

  window.addEventListener("resize", handleMediaChange);

  if (typeof ResizeObserver === "function" && refs.settingsPanel) {
    studioHeightObserver = new ResizeObserver(() => {
      scheduleStudioHeightSync();
    });
    studioHeightObserver.observe(refs.settingsPanel);
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
    !refs.galleryMasonry ||
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
    galleryScrollObserver.observe(refs.galleryMasonry);
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
  refs.advancedBaseUrl.textContent = config.baseUrl || "https://api.asxs.top/v1";
  refs.advancedResponsesModel.textContent = config.responsesModel || "gpt-5.4";
  state.aspectRatios = config.aspectRatios || [];
  state.limits = {
    ...DEFAULT_LIMITS,
    ...(config.limits || {}),
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

function sortByCreatedAtDescending(items) {
  return [...items].sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
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

  const latestJob = sortByCreatedAtDescending(state.jobs)[0];
  if (latestJob) {
    state.selectedPreviewKey = makeJobPreviewKey(latestJob.id);
    return;
  }

  const preferredGalleryItem =
    state.gallery.find((item) => item.ratio === "4:5") ||
    state.gallery.find((item) => item.ratio?.includes(":")) ||
    state.gallery[0] ||
    null;
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
  syncLightboxItem();
  setLightboxOpen(true);
}

function closeLightbox() {
  state.lightboxItem = null;
  setLightboxOpen(false);
}

function syncLightboxItem() {
  if (!state.lightboxItem) {
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
  refs.lightboxImage.src = imageUrl;
  refs.lightboxImage.alt = getDisplayPrompt(fresh);
  refs.lightboxAmbient.style.backgroundImage = imageUrl ? `url("${imageUrl}")` : "";
  refs.lightboxDownload.href = imageUrl || "#";
  refs.lightboxDownload.download = fresh.filename || "preview.jpeg";
  refs.lightboxDelete.disabled = !fresh.filename;
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
    detail: message,
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

function renderPreview() {
  const item = getCurrentPreviewItem();
  const imageUrl = getImageUrl(item);

  refs.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;

  if (!item) {
    refs.previewModel.textContent = "GPT Image 2.0";
    refs.previewTime.textContent = "等待生成";
    refs.previewId.textContent = "ID: --";
    refs.previewSize.textContent = "--";
    refs.previewPlaceholder.classList.remove("hidden");
    refs.previewPlaceholder.innerHTML = `
      <p>Output Preview</p>
      <h3>生成结果会在这里实时更新。</h3>
      <span>右侧保留实时动态和最近输出，底部胶片条可快速切换查看。</span>
    `;
    refs.previewImage.removeAttribute("src");
    refs.previewImage.classList.remove("is-visible");
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

  if (!imageUrl) {
    refs.previewPlaceholder.classList.remove("hidden");
    refs.previewPlaceholder.innerHTML = `
      <p>Generation Running</p>
      <h3>${item.statusText || "正在等待上游图像返回。"}</h3>
      <span>${getDisplayPrompt(item)}</span>
    `;
    refs.previewImage.removeAttribute("src");
    refs.previewImage.classList.remove("is-visible");
    refs.previewDownloadButton.removeAttribute("href");
    refs.previewDownloadButton.removeAttribute("download");
    refs.previewDownloadButton.classList.add("disabled");
    refs.previewLightboxButton.disabled = true;
    refs.previewDeleteButton.disabled = true;
    return;
  }

  refs.previewPlaceholder.classList.add("hidden");
  refs.previewImage.classList.remove("is-visible");
  refs.previewImage.onload = () => {
    refs.previewImage.classList.add("is-visible");
  };
  refs.previewImage.style.transform = `scale(${state.zoom})`;
  refs.previewImage.src = imageUrl;
  refs.previewImage.alt = getDisplayPrompt(item);
  refs.previewDownloadButton.href = imageUrl;
  refs.previewDownloadButton.download = item.filename || "preview.jpeg";
  refs.previewDownloadButton.classList.remove("disabled");
  refs.previewLightboxButton.disabled = false;
  refs.previewDeleteButton.disabled = !item.filename;
}

function getFilmstripItems() {
  const activeJobs = sortByCreatedAtDescending(state.jobs).map((job) => ({
    key: makeJobPreviewKey(job.id),
    item: job,
    label: job.statusText || formatClock(job.createdAt),
  }));

  const recentGallery = sortByCreatedAtDescending(state.gallery).slice(0, 8).map((item) => ({
    key: makeGalleryPreviewKey(item.filename),
    item,
    label: formatClock(item.createdAt),
  }));

  return [...activeJobs, ...recentGallery].slice(0, 10);
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

  sortByCreatedAtDescending(state.gallery)
    .slice(0, 5)
    .forEach((item) => {
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

  const overlay = document.createElement("div");
  overlay.className = "gallery-tile-overlay";

  const badge = document.createElement("span");
  badge.className = "model-badge small";
  badge.textContent = formatImageModelLabel(item.imageModel);
  overlay.appendChild(badge);

  const prompt = document.createElement("strong");
  prompt.textContent = getDisplayPrompt(item);
  overlay.appendChild(prompt);

  const meta = document.createElement("span");
  meta.textContent = formatRecentOutputMeta(item);
  overlay.appendChild(meta);

  button.appendChild(overlay);
  return button;
}

function normalizeGalleryColumnPreset(value) {
  const preset = Number(value);
  return GALLERY_COLUMN_PRESETS.includes(preset) ? preset : DEFAULT_GALLERY_COLUMN_PRESET;
}

function renderGalleryColumnPresetButtons() {
  refs.galleryColumnButtons.forEach((button) => {
    const isActive = normalizeGalleryColumnPreset(button.dataset.galleryColumnPreset) === state.galleryColumnPreset;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function renderGalleryView() {
  refs.galleryMasonry.innerHTML = "";
  refs.galleryMasonry.style.setProperty("--gallery-columns", String(state.galleryColumnPreset));
  refs.galleryCount.textContent = `${state.gallery.length} 张`;
  refs.galleryEmpty.classList.toggle("hidden", state.gallery.length > 0);
  renderGalleryColumnPresetButtons();

  sortByCreatedAtDescending(state.gallery).forEach((item) => {
    refs.galleryMasonry.appendChild(createGalleryTile(item));
  });

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
  const next = state.gallery.filter((entry) => entry.filename !== item.filename);
  next.unshift(item);
  state.gallery = sortByCreatedAtDescending(next);
}

function selectRandomPrompt() {
  const prompt = SURPRISE_PROMPTS[Math.floor(Math.random() * SURPRISE_PROMPTS.length)];
  refs.promptInput.value = prompt;
  updatePromptCounter();
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
    format: state.config?.defaults?.format || "jpeg",
    baseUrl: state.config?.baseUrl || refs.baseUrlInput.value.trim(),
    responsesModel: state.config?.responsesModel || refs.responsesModelInput.value.trim() || "gpt-5.4",
    imageModel: "gpt-image-2",
    reasoningEffort: refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh",
    referenceFiles,
    hasReferenceImage: referenceFiles.length > 0,
    referenceImageName: referenceImageNames[0] || "",
    referenceImageNames,
    statusText: "正在连接上游服务",
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
  state.gallery = sortByCreatedAtDescending(Array.isArray(payload) ? payload : []);
  renderAll();
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

async function runGeneration(job) {
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

    await consumeSse(response.body, async (eventName, payload) => {
      if (eventName === "status") {
        updateJob(job.id, {
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
        handleActivityFailure(job.id, payload.message);
        showError(payload.message);
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

  if (getRunningJobCount() >= state.limits.maxConcurrentTasksPerSession) {
    showError(`同一会话最多同时进行 ${state.limits.maxConcurrentTasksPerSession} 个生成任务。`);
    return;
  }

  const job = createJob();
  state.jobs.unshift(job);
  state.selectedPreviewKey = makeJobPreviewKey(job.id);
  recordJobQueued(job);
  renderAll();
  setActiveView("studio");

  void runGeneration(job);
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
  refs.openOutputButton.addEventListener("click", () => {
    openOutputDirectory().catch((error) => showError(error.message));
  });
  refs.configForm.addEventListener("submit", (event) => {
    saveConfig(event).catch((error) => showError(error.message));
  });
  refs.generateForm.addEventListener("submit", startGeneration);
  refs.surprisePromptButton.addEventListener("click", selectRandomPrompt);
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

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!refs.lightbox.classList.contains("hidden")) {
        closeLightbox();
        return;
      }

      if (refs.configDrawer.classList.contains("open")) {
        setDrawerOpen(false);
      }
    }
  });
}

async function bootstrap() {
  state.clientSessionId = getOrCreateClientSessionId();
  bindEvents();
  bindStudioHeightSync();
  bindGalleryScrollSync();
  updatePromptCounter();
  renderRatioGrid();
  renderReasoningOptions();
  renderSizeOptions();
  updateGenerateButton();
  renderReferenceGrid();
  renderTimeline();
  renderStudio();
  renderGalleryView();
  setActiveView(getViewFromHash());
  scheduleGalleryScrollSync();

  try {
    await loadConfig();
    await loadGallery();
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
    setConnectionState("error", "初始化失败");
  }
}

bootstrap();
