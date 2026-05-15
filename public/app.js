import {
  buildParameterText,
  formatImageModelLabel,
  formatRecentOutputMeta,
} from "/lib/studio-formatters.mjs";
import { getPreviewPlaceholderState } from "/lib/preview-placeholder-state.mjs?v=20260510-activity-log-1";
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
  paginateGallerySections,
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
} from "/lib/generation-size-options.mjs?v=20260512-one-megapixel-sizes-4";
import {
  getOutputFormatOptions,
  normalizeOutputFormat,
} from "/lib/output-format-options.mjs?v=20260504-vercel-static-lib-1";
import {
  getPreviewLoadingShellTheme,
  shouldReusePreviewLoadingShell,
} from "/lib/preview-loading-shell.mjs";
import {
  getGenerationRequestRetryPlan,
  isGenerationRequestRetryMessage,
} from "/lib/generation-request-retry.mjs";
import {
  cancelQueuedGenerationJob,
  isQueuedGenerationJob,
  selectNextQueuedGenerationJobs,
} from "/lib/generation-queue.mjs?v=20260504-vercel-static-lib-1";
import {
  sortGenerationActivityFeed,
  upsertGenerationActivityEntry,
} from "/lib/generation-activity-feed.mjs?v=20260504-vercel-static-lib-1";
import { getStudioDensitySettings, getStudioLayoutMode, ALL_VARIABLE_NAMES } from "/lib/studio-density.mjs?v=20260511-device-layout-config-1";
const SURPRISE_PROMPTS = [
  {
    name: "清晨通勤",
    prompt: "生成一张清晨城市通勤生活照，年轻上班族手拿咖啡走出地铁站，晨光穿过街边树影，画面自然真实，轻微运动模糊，适合生活方式摄影。",
  },
  {
    name: "家庭早餐",
    prompt: "生成一张温暖家庭早餐场景，木质餐桌上有吐司、煎蛋、牛奶和水果，家人围坐聊天，窗外柔和日光洒入，构图干净，有真实居家氛围。",
  },
  {
    name: "居家阅读",
    prompt: "生成一张安静居家阅读画面，人物坐在窗边单人椅上看书，旁边有茶杯和落地灯，浅色窗帘、柔和阴影，画面舒适松弛，细节清晰。",
  },
  {
    name: "厨房做饭",
    prompt: "生成一张周末厨房做饭场景，人物在明亮厨房里切菜备餐，台面摆放新鲜蔬菜和锅具，暖白色顶光，生活化抓拍视角，干净有烟火气。",
  },
  {
    name: "超市采购",
    prompt: "生成一张日常超市采购场景，人物推着购物车经过蔬果区，货架陈列丰富但不杂乱，室内灯光明亮，色彩自然，像真实生活纪录照片。",
  },
  {
    name: "午后办公",
    prompt: "生成一张午后居家办公场景，人物坐在整洁书桌前使用笔记本电脑，桌上有记事本、耳机和半杯咖啡，窗边自然光，画面专注而安静。",
  },
  {
    name: "健身运动",
    prompt: "生成一张清爽健身运动场景，人物在公园步道上做拉伸，穿着简洁运动服，背景有晨间草地和远处城市轮廓，光线清透，健康积极。",
  },
  {
    name: "朋友聚会",
    prompt: "生成一张朋友小聚生活场景，几位朋友围坐在餐桌边分享披萨和饮料，表情自然放松，暖色室内灯光，桌面细节丰富，氛围亲密真实。",
  },
  {
    name: "亲子手作",
    prompt: "生成一张亲子手作场景，家长和孩子在桌前一起制作彩色纸艺，桌上有剪刀、彩纸和胶水，画面明亮安全，表情专注，充满家庭陪伴感。",
  },
  {
    name: "夜晚学习",
    prompt: "生成一张夜晚学习场景，人物坐在书桌前整理笔记，台灯形成温暖光区，窗外是安静夜色，桌面有书本和便签，整体专注、平静、有秩序。",
  },
];

const REASONING_LABELS = {
  low: "低",
  medium: "中",
  high: "高",
  xhigh: "超高",
};

const DEFAULT_LIMITS = {
  maxConcurrentTasksPerSession: 20,
  maxParallelTasksPerSession: 4,
  maxReferenceImages: 6,
};
const PROMPT_TEMPLATE_STORAGE_KEY = "image-studio-prompt-templates-v2";
const DEFAULT_PROMPT_TEMPLATES = SURPRISE_PROMPTS.map((template, index) => ({
  id: `default-template-${index + 1}`,
  name: template.name,
  prompt: template.prompt,
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
const ARTICLE_RECORD_COLUMN_PRESETS = [2, 4, 6, 8];
const DEFAULT_ARTICLE_RECORD_COLUMN_PRESET = 4;
const DEFAULT_ARTICLE_ILLUSTRATION_STYLE_PRESET = "realist-magazine";
const DEFAULT_REASONING_EFFORTS = ["low", "medium", "high", "xhigh"];
const DEFAULT_UI_RATIO = "1:1";
const DEFAULT_UI_RATIO_LABEL = "方形 1:1";
const CREATION_LOGO_PLACEMENTS = new Set([
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);
const CREATION_LOGO_PLACEMENT_LABELS = {
  "top-left": "左上",
  "top-center": "上中",
  "top-right": "右上",
  "center-left": "左中",
  center: "居中",
  "center-right": "右中",
  "bottom-left": "左下",
  "bottom-center": "下中",
  "bottom-right": "右下",
};
const CREATION_LOGO_BACKGROUNDS = new Set(["transparent", "remove-background"]);
const CREATION_LOGO_BACKGROUND_LABELS = {
  transparent: "透明底，直接放置",
  "remove-background": "非透明底，先抠图",
};
const STYLE_TRANSFER_CUSTOM_PRESET = "custom";
const STYLE_TRANSFER_DEFAULT_PRESET = "clay-toy";
const STYLE_TRANSFER_PRESET_BEFORE_IMAGE = "./assets/style-presets/style-before.svg";
const STYLE_TRANSFER_PRESET_REFERENCE_SIZE = 1024;
const STYLE_TRANSFER_PRESETS = [
  {
    value: STYLE_TRANSFER_CUSTOM_PRESET,
    label: "上传风格图",
    description: "上传自己的风格参考图；下方示意为自定义风格迁移入口。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/custom-style-reference.svg",
    prompt: "",
  },
  {
    value: "cinematic-photo",
    label: "电影写实",
    description: "真实镜头、胶片色调、自然光影和电影级景深。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/cinematic-photo.svg",
    prompt: "Use a cinematic photoreal look with natural lens behavior, realistic lighting, filmic color grading, and believable texture.",
  },
  {
    value: "anime-cel",
    label: "日系赛璐璐",
    description: "干净线条、块面阴影、高饱和角色动画质感。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/anime-cel.svg",
    prompt: "Use Japanese cel animation styling with clean outlines, controlled flat shadows, vivid colors, and crisp character-focused rendering.",
  },
  {
    value: "hand-drawn",
    label: "手绘插画",
    description: "松弛笔触、温和配色和纸面手作感。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/hand-drawn.svg",
    prompt: "Use an expressive hand-drawn illustration look with visible sketch texture, warm imperfect strokes, and soft handmade color.",
  },
  {
    value: "pencil-sketch",
    label: "铅笔素描",
    description: "石墨线稿、排线明暗和纸张颗粒。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/pencil-sketch.svg",
    prompt: "Use a graphite pencil sketch style with visible hatching, tonal shading, paper grain, and monochrome drawing texture.",
  },
  {
    value: "cyberpunk-neon",
    label: "赛博霓虹",
    description: "高反差夜景、霓虹边光和湿润反射。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/cyberpunk-neon.svg",
    prompt: "Use a cyberpunk neon night style with high contrast, saturated colored rim lights, reflective surfaces, and dense urban mood.",
  },
  {
    value: "pixel-game",
    label: "像素游戏",
    description: "低分辨率像素块、限定调色和复古游戏画面。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/pixel-game.svg",
    prompt: "Use a retro pixel game style with blocky pixel forms, limited palette, crisp grid edges, and readable sprite-like shapes.",
  },
  {
    value: "low-poly-3d",
    label: "低多边形3D",
    description: "几何切面、硬边体块和轻量 3D 玩具感。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/low-poly-3d.svg",
    prompt: "Use a low-poly 3D style with faceted geometry, clean hard edges, simplified volumes, and soft studio lighting.",
  },
  {
    value: "editorial-watercolor",
    label: "编辑水彩",
    description: "透明水色、留白边缘和杂志插画气质。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/editorial-watercolor.svg",
    prompt: "Use an editorial watercolor style with translucent pigment washes, soft blooms, paper texture, and elegant magazine illustration restraint.",
  },
  {
    value: "paper-cut-collage",
    label: "纸雕拼贴",
    description: "层叠纸片、投影厚度和剪贴画装饰感。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/paper-cut-collage.svg",
    prompt: "Use a paper cut collage style with layered paper shapes, tactile edges, shallow shadows, and handcrafted poster composition.",
  },
  {
    value: "risograph-poster",
    label: "Riso海报",
    description: "套色错位、网点颗粒和独立出版物质感。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/risograph-poster.svg",
    prompt: "Use a risograph poster style with limited spot colors, offset registration, halftone grain, and bold printmaking texture.",
  },
  {
    value: "vintage-film",
    label: "复古胶片",
    description: "过期胶片、暖色偏移、暗角和颗粒噪点。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/vintage-film.svg",
    prompt: "Use a vintage film style with warm color shift, soft contrast, visible grain, subtle vignetting, and aged photographic mood.",
  },
  {
    value: "comic-ink",
    label: "漫画墨线",
    description: "粗黑轮廓、速度线、网点阴影和分镜张力。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/comic-ink.svg",
    prompt: "Use a bold comic ink style with heavy linework, graphic contrast, screentone shadows, and energetic panel-like clarity.",
  },
  {
    value: "clay-toy",
    label: "黏土手作",
    description: "柔软手工材质、圆润体块、玩具灯箱和微缩场景。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/clay-toy.svg",
    prompt: "Use a handmade clay toy diorama style with rounded forms, soft material texture, playful miniature lighting, and tactile surface detail.",
  },
  {
    value: "ink-gongbi",
    label: "国风工笔",
    description: "细线勾勒、淡彩晕染、宣纸纹理和东方留白。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/ink-gongbi.svg",
    prompt: "Use a Chinese gongbi painting style with precise fine lines, restrained ink-and-color washes, rice paper texture, and elegant negative space.",
  },
];
const GALLERY_METADATA_CACHE_KEY = "image-studio-gallery-metadata-cache-v2";
const GENERATION_ACTIVITY_STORAGE_KEY = "image-studio-generation-activity-v1";
const BROWSER_CONFIG_STORAGE_KEY = "image-studio-browser-config-v1";
const THEME_STORAGE_KEY = "image-studio-ui-theme-v1";
const BROWSER_IMAGE_CACHE_INDEX_KEY = "image-studio-browser-image-cache-index-v1";
const BROWSER_IMAGE_CACHE_DB_NAME = "image-studio-browser-image-cache-v1";
const CONNECTION_STATUS_ENTRY_LABEL = "API、LOG";
const CONNECTION_STATUS_EMPTY_LABEL = "待填写API、LOG";
const BROWSER_IMAGE_CACHE_STORE_NAME = "generated-images";
const PROMPT_ANALYSIS_IMAGE_MAX_EDGE = 1024;
const PROMPT_ANALYSIS_IMAGE_COMPRESS_THRESHOLD_BYTES = 900 * 1024;
const PROMPT_ANALYSIS_IMAGE_JPEG_QUALITY = 0.82;
const GENERATION_REFERENCE_IMAGE_MAX_EDGE = 1024;
const GENERATION_REFERENCE_IMAGE_COMPRESS_THRESHOLD_BYTES = 900 * 1024;
const GENERATION_REFERENCE_IMAGE_JPEG_QUALITY = 0.82;
const GENERATION_TASK_POLL_INTERVAL_MS = 2500;
const GENERATION_TASK_STATUS_LABELS = {
  running: "生成中",
  completed: "生成完成",
  error: "错误",
};
const GENERATION_TASK_TIMELINE_STATUS = {
  running: "active",
  completed: "done",
  error: "error",
};
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
const ADAPTIVE_COLLAPSIBLE_LAYOUTS = new Set(["tablet", "mobile"]);
const PPT_SOURCE_MODES = new Set(["upload", "text", "topic"]);
const CREATE_VIEW_IDS = new Set([
  "studio",
  "style-transfer",
  "reference-analysis",
  "image-decomposition",
  "creation",
  "article-illustration",
  "ppt",
]);
const ASSET_VIEW_IDS = new Set(["gallery", "article-record", "ppt-record", "creation-record"]);

let studioHeightSyncFrame = 0;
let studioHeightObserver = null;
let studioDensitySyncFrame = 0;
let adaptiveSectionSyncing = false;
let adaptiveSectionLayoutMode = "";
let galleryPanelHeightSyncFrame = 0;
let galleryPanelHeightObserver = null;
let galleryScrollSyncFrame = 0;
let galleryScrollObserver = null;
let generationTaskPollTimer = 0;
let creationRecordRefreshPromise = null;
let promptCopyFeedbackTimer = 0;
let previewLoadingShellNodes = null;
let referenceAnalysisLoadingShellNodes = null;
let imageDecompositionLoadingShellNodes = null;
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
  articleIllustration: {
    currentSet: null,
    feedback: "",
    files: [],
    generating: false,
    planning: false,
    recordQuery: "",
    recordColumnPreset: DEFAULT_ARTICLE_RECORD_COLUMN_PRESET,
    recordSetId: "",
    referenceGenerating: false,
    sets: [],
  },
  creationCategoryTemplatesModule: null,
  creation: {
    currentSet: null,
    editingItemId: "",
    feedback: "",
    generationScope: "",
    generating: false,
    itemDrafts: {},
    planning: false,
    recordQuery: "",
    recordSetId: "",
    sets: [],
  },
  creationReferenceFiles: [],
  creationLogo: {
    background: "transparent",
    file: null,
    generationCompressed: false,
    generationFile: null,
    generationFilePromise: null,
    placement: "top-left",
    previewUrl: "",
  },
  creationReferenceRestoreQueue: [],
  creationReferenceAnalysis: {
    applied: false,
    dirty: false,
    result: null,
    running: false,
  },
  creationIndustryTemplateBrowser: {
    level1: "",
    level2: "",
    level3: "",
  },
  creationReferencePreviewItem: null,
  creationSelectedRoles: [],
  gallery: [],
  galleryMetadataCache: {},
  galleryControls: { ...DEFAULT_GALLERY_CONTROLS },
  galleryHistoryPage: 0,
  galleryColumnPreset: DEFAULT_GALLERY_COLUMN_PRESET,
  generationTasks: [],
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
  ppt: {
    deckId: "",
    decks: [],
    edit: {
      active: false,
      drawing: false,
      erasing: false,
      slideNumber: 0,
      hasMarks: false,
      imageUrl: "",
    },
    files: [],
    generating: false,
    outline: null,
    pptxUrl: "",
    slides: [],
    sourceMode: "upload",
    statusText: "等待生成",
    currentSlideNumber: 0,
    recordDetail: {
      deckKey: "",
      slideNumber: 0,
    },
  },
  promptTemplates: [],
  reasoningEfforts: [...DEFAULT_REASONING_EFFORTS],
  referenceAnalysis: {
    files: [],
    autoCollapseOnApply: true,
    collapsed: false,
    dirty: false,
    generationKeys: [],
    generationItems: {},
    previewKey: "",
    result: null,
    running: false,
    selectedPrompt: "",
  },
  imageDecomposition: {
    file: null,
    feedback: "",
    language: "zh-CN",
    customLanguage: "",
    featureCardsEnabled: false,
    generationKeys: [],
    generationItems: {},
    previewKey: "",
  },
  referenceCompressionRunning: false,
  referenceFiles: [],
  imageDecompositionPreviewItem: null,
  referenceAnalysisPreviewItem: null,
  referencePreviewItem: null,
  selectedPromptTemplateId: "",
  selectedPreviewKey: "",
  studioMode: "prompt",
  styleTransfer: {
    source: null,
    style: null,
    selectedPreset: STYLE_TRANSFER_DEFAULT_PRESET,
    presetReferenceFile: null,
    presetReferenceFileKey: "",
  },
  styleTransferPreviewItem: null,
  timelineHasRendered: false,
  timelineSignatures: new Map(),
  timelineUnreadCount: 0,
  uiTheme: "dark",
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
  configGenerationLogPanel: document.querySelector("#configGenerationLogPanel"),
  configStatus: document.querySelector("#configStatus"),
  connectionLabel: document.querySelector("#connectionLabel"),
  connectionStatus: document.querySelector("#connectionStatus"),
  articleIllustrationContentTypeInput: document.querySelector("#articleIllustrationContentTypeInput"),
  articleIllustrationCount: document.querySelector("#articleIllustrationCount"),
  articleIllustrationDropzone: document.querySelector("#articleIllustrationDropzone"),
  articleIllustrationFeedback: document.querySelector("#articleIllustrationFeedback"),
  articleIllustrationFileCount: document.querySelector("#articleIllustrationFileCount"),
  articleIllustrationFileList: document.querySelector("#articleIllustrationFileList"),
  articleIllustrationForm: document.querySelector("#articleIllustrationForm"),
  articleIllustrationGenerateButton: document.querySelector("#articleIllustrationGenerateButton"),
  articleIllustrationPlanButton: document.querySelector("#articleIllustrationPlanButton"),
  articleIllustrationReferenceButton: document.querySelector("#articleIllustrationReferenceButton"),
  articleIllustrationReferenceList: document.querySelector("#articleIllustrationReferenceList"),
  articleIllustrationSetMeta: document.querySelector("#articleIllustrationSetMeta"),
  articleIllustrationSourceFilesInput: document.querySelector("#articleIllustrationSourceFilesInput"),
  articleIllustrationSourceLength: document.querySelector("#articleIllustrationSourceLength"),
  articleIllustrationSourceTextInput: document.querySelector("#articleIllustrationSourceTextInput"),
  articleIllustrationStoryboardList: document.querySelector("#articleIllustrationStoryboardList"),
  articleIllustrationStyleBibleInput: document.querySelector("#articleIllustrationStyleBibleInput"),
  articleIllustrationStylePresetInput: document.querySelector("#articleIllustrationStylePresetInput"),
  articleIllustrationSupplementInput: document.querySelector("#articleIllustrationSupplementInput"),
  articleIllustrationTitleInput: document.querySelector("#articleIllustrationTitleInput"),
  articleReferenceSectionCount: document.querySelector("#articleReferenceSectionCount"),
  articleRecordContinueButton: document.querySelector("#articleRecordContinueButton"),
  articleRecordCopyCaptionsButton: document.querySelector("#articleRecordCopyCaptionsButton"),
  articleRecordCopyPromptsButton: document.querySelector("#articleRecordCopyPromptsButton"),
  articleRecordCount: document.querySelector("#articleRecordCount"),
  articleRecordColumnButtons: [...document.querySelectorAll("[data-article-record-column-preset]")],
  articleRecordDetail: document.querySelector("#articleRecordDetail"),
  articleRecordFeedback: document.querySelector("#articleRecordFeedback"),
  articleRecordList: document.querySelector("#articleRecordList"),
  articleRecordRefreshButton: document.querySelector("#articleRecordRefreshButton"),
  articleRecordSearchInput: document.querySelector("#articleRecordSearchInput"),
  articleStoryboardSectionCount: document.querySelector("#articleStoryboardSectionCount"),
  creationFeedback: document.querySelector("#creationFeedback"),
  creationForm: document.querySelector("#creationForm"),
  creationGenerateButton: document.querySelector("#creationGenerateButton"),
  creationDimensionSpecsInput: document.querySelector("#creationDimensionSpecsInput"),
  creationDimensionUnitModeInput: document.querySelector("#creationDimensionUnitModeInput"),
  creationImageCountInput: document.querySelector("#creationImageCountInput"),
  creationIndustryTemplateBrowser: document.querySelector("#creationIndustryTemplateBrowser"),
  creationIndustryTemplateBackButton: document.querySelector("#creationIndustryTemplateBackButton"),
  creationIndustryTemplateCurrent: document.querySelector("#creationIndustryTemplateCurrent"),
  creationIndustryTemplateInput: document.querySelector("#creationIndustryTemplateInput"),
  creationIndustryTemplateLevels: document.querySelector("#creationIndustryTemplateLevels"),
  creationIndustryTemplatePopover: document.querySelector("#creationIndustryTemplatePopover"),
  creationIndustryTemplateSearchInput: document.querySelector("#creationIndustryTemplateSearchInput"),
  creationIndustryTemplateStepLabel: document.querySelector("#creationIndustryTemplateStepLabel"),
  creationIndustryTemplateTrigger: document.querySelector("#creationIndustryTemplateTrigger"),
  creationLogoBackgroundInput: document.querySelector("#creationLogoBackgroundInput"),
  creationLogoDropzone: document.querySelector("#creationLogoDropzone"),
  creationLogoFilename: document.querySelector("#creationLogoFilename"),
  creationLogoInput: document.querySelector("#creationLogoInput"),
  creationLogoPlacementInput: document.querySelector("#creationLogoPlacementInput"),
  creationLogoPreview: document.querySelector("#creationLogoPreview"),
  creationLogoPreviewImage: document.querySelector("#creationLogoPreviewImage"),
  creationLogoRemoveButton: document.querySelector("#creationLogoRemoveButton"),
  creationOutputFormatInput: document.querySelector("#creationOutputFormatInput"),
  creationPlanButton: document.querySelector("#creationPlanButton"),
  creationPromptEditorLayer: document.querySelector("#creationPromptEditorLayer"),
  creationProductDescriptionInput: document.querySelector("#creationProductDescriptionInput"),
  creationProductNameInput: document.querySelector("#creationProductNameInput"),
  creationProgressText: document.querySelector("#creationProgressText"),
  creationReferenceAnalysisFeedback: document.querySelector("#creationReferenceAnalysisFeedback"),
  creationReferenceAnalysisList: document.querySelector("#creationReferenceAnalysisList"),
  creationReferenceAnalysisMeta: document.querySelector("#creationReferenceAnalysisMeta"),
  creationReferenceAnalysisPanel: document.querySelector("#creationReferenceAnalysisPanel"),
  creationReferenceAnalysisSummary: document.querySelector("#creationReferenceAnalysisSummary"),
  creationReferenceAnalyzeButton: document.querySelector("#creationReferenceAnalyzeButton"),
  creationReferenceApplyAnalysisButton: document.querySelector("#creationReferenceApplyAnalysisButton"),
  creationReferenceCount: document.querySelector("#creationReferenceCount"),
  creationReferenceDropzone: document.querySelector("#creationReferenceDropzone"),
  creationReferenceGrid: document.querySelector("#creationReferenceGrid"),
  creationReferenceInput: document.querySelector("#creationReferenceInput"),
  creationReferenceRestoreList: document.querySelector("#creationReferenceRestoreList"),
  creationRecordActionFeedback: document.querySelector("#creationRecordActionFeedback"),
  creationRecordArchiveDetail: document.querySelector("#creationRecordArchiveDetail"),
  creationRecordCopyFullPathsButton: document.querySelector("#creationRecordCopyFullPathsButton"),
  creationRecordCopyPathsButton: document.querySelector("#creationRecordCopyPathsButton"),
  creationRecordCopyPromptsButton: document.querySelector("#creationRecordCopyPromptsButton"),
  creationRecordCount: document.querySelector("#creationRecordCount"),
  creationRecordDetail: document.querySelector("#creationRecordDetail"),
  creationRecordExportManifestButton: document.querySelector("#creationRecordExportManifestButton"),
  creationRecordExportPromptsButton: document.querySelector("#creationRecordExportPromptsButton"),
  creationRecordOpenFolderButton: document.querySelector("#creationRecordOpenFolderButton"),
  creationRecordRefreshButton: document.querySelector("#creationRecordRefreshButton"),
  creationRecordReuseButton: document.querySelector("#creationRecordReuseButton"),
  creationRecordResultGrid: document.querySelector("#creationRecordResultGrid"),
  creationRecordSearchInput: document.querySelector("#creationRecordSearchInput"),
  creationRecordSetList: document.querySelector("#creationRecordSetList"),
  creationRepairFailedButton: document.querySelector("#creationRepairFailedButton"),
  creationResultGrid: document.querySelector("#creationResultGrid"),
  creationRoleCount: document.querySelector("#creationRoleCount"),
  creationRoleGrid: document.querySelector("#creationRoleGrid"),
  creationScenarioInput: document.querySelector("#creationScenarioInput"),
  creationSellingPointsInput: document.querySelector("#creationSellingPointsInput"),
  creationSetMeta: document.querySelector("#creationSetMeta"),
  creationSizeInput: document.querySelector("#creationSizeInput"),
  creationRatioInput: document.querySelector("#creationRatioInput"),
  creationTargetLanguageInput: document.querySelector("#creationTargetLanguageInput"),
  errorBanner: document.querySelector("#errorBanner"),
  filmstrip: document.querySelector("#filmstrip"),
  focusGalleryButton: document.querySelector("#focusGalleryButton"),
  galleryCount: document.querySelector("#galleryCount"),
  galleryColumnButtons: [...document.querySelectorAll("[data-gallery-column-preset]")],
  galleryDateInput: document.querySelector("#galleryDateInput"),
  galleryEmpty: document.querySelector("#galleryEmpty"),
  galleryFilters: document.querySelector("#galleryFilters"),
  galleryHelperText: document.querySelector("#galleryHelperText"),
  galleryNextPageButton: document.querySelector("#galleryNextPageButton"),
  galleryPageStatus: document.querySelector("#galleryPageStatus"),
  galleryPagination: document.querySelector("#galleryPagination"),
  galleryPanel: document.querySelector(".gallery-panel"),
  galleryPreviousPageButton: document.querySelector("#galleryPreviousPageButton"),
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
  globalNav: document.querySelector(".global-nav"),
  globalNavItems: [...document.querySelectorAll("[data-nav-section]")],
  lightbox: document.querySelector("#lightbox"),
  lightboxAmbient: document.querySelector("#lightboxAmbient"),
  lightboxBackdrop: document.querySelector("#lightboxBackdrop"),
  lightboxClose: document.querySelector("#lightboxClose"),
  copyPromptButton: document.querySelector("#copyPromptButton"),
  lightboxCopyFullPathButton: document.querySelector("#lightboxCopyFullPathButton"),
  lightboxCopyPathButton: document.querySelector("#lightboxCopyPathButton"),
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
  outputFormatInput: document.querySelector("#outputFormatInput"),
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
  pptCompleteMissingButton: document.querySelector("#pptCompleteMissingButton"),
  pptCompletionRatio: document.querySelector("#pptCompletionRatio"),
  pptDeckCount: document.querySelector("#pptDeckCount"),
  pptDownloadLink: document.querySelector("#pptDownloadLink"),
  pptDropzone: document.querySelector("#pptDropzone"),
  pptAutoAdvanceInput: document.querySelector("#pptAutoAdvanceInput"),
  pptDynamicPresetInput: document.querySelector("#pptDynamicPresetInput"),
  pptEditBackdrop: document.querySelector("#pptEditBackdrop"),
  pptEditCanvas: document.querySelector("#pptEditCanvas"),
  pptEditClearButton: document.querySelector("#pptEditClearButton"),
  pptEditCloseButton: document.querySelector("#pptEditCloseButton"),
  pptEditDrawButton: document.querySelector("#pptEditDrawButton"),
  pptEditEraseButton: document.querySelector("#pptEditEraseButton"),
  pptEditFeedback: document.querySelector("#pptEditFeedback"),
  pptEditImage: document.querySelector("#pptEditImage"),
  pptEditInstructionInput: document.querySelector("#pptEditInstructionInput"),
  pptEditModal: document.querySelector("#pptEditModal"),
  pptEditTitle: document.querySelector("#pptEditTitle"),
  pptFeedback: document.querySelector("#pptFeedback"),
  pptFileCount: document.querySelector("#pptFileCount"),
  pptFileList: document.querySelector("#pptFileList"),
  pptForm: document.querySelector("#pptForm"),
  pptGenerateButton: document.querySelector("#pptGenerateButton"),
  pptHistoryEmpty: document.querySelector("#pptHistoryEmpty"),
  pptHistoryList: document.querySelector("#pptHistoryList"),
  pptOutlineBox: document.querySelector("#pptOutlineBox"),
  pptPageCountInput: document.querySelector("#pptPageCountInput"),
  pptProgressBar: document.querySelector("#pptProgressBar"),
  pptRecordCount: document.querySelector("#pptRecordCount"),
  pptRecordDetail: document.querySelector("#pptRecordDetail"),
  pptRecordEmpty: document.querySelector("#pptRecordEmpty"),
  pptRecordList: document.querySelector("#pptRecordList"),
  pptRecordRefreshButton: document.querySelector("#pptRecordRefreshButton"),
  pptRefreshHistoryButton: document.querySelector("#pptRefreshHistoryButton"),
  pptSlideList: document.querySelector("#pptSlideList"),
  pptSourceInput: document.querySelector("#pptSourceInput"),
  pptSourceModeInputs: [...document.querySelectorAll("input[name=\"pptSourceMode\"]")],
  pptSourcePanels: [...document.querySelectorAll("[data-ppt-source-panel]")],
  pptSourceTextInput: document.querySelector("#pptSourceTextInput"),
  pptStatusText: document.querySelector("#pptStatusText"),
  pptStylePresetInput: document.querySelector("#pptStylePresetInput"),
  pptSubmitEditButton: document.querySelector("#pptSubmitEditButton"),
  pptTopicInput: document.querySelector("#pptTopicInput"),
  pptTransitionPresetInput: document.querySelector("#pptTransitionPresetInput"),
  pptTransitionSpeedInput: document.querySelector("#pptTransitionSpeedInput"),
  promptInput: document.querySelector("#promptInput"),
  promptModeBlocks: [document.querySelector(".reference-field-group"), ...document.querySelectorAll("[data-prompt-mode-block]")].filter(Boolean),
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
  referenceAnalysisAutoCollapseButton: document.querySelector("#referenceAnalysisAutoCollapseButton"),
  referenceAnalysisCount: document.querySelector("#referenceAnalysisCount"),
  referenceAnalysisDropzone: document.querySelector("#referenceAnalysisDropzone"),
  referenceAnalysisEmpty: document.querySelector("#referenceAnalysisEmpty"),
  referenceAnalysisFeedback: document.querySelector("#referenceAnalysisFeedback"),
  referenceAnalysisGrid: document.querySelector("#referenceAnalysisGrid"),
  referenceAnalysisHead: document.querySelector("#referenceAnalysisHead"),
  referenceAnalysisInput: document.querySelector("#referenceAnalysisInput"),
  referenceAnalysisList: document.querySelector("#referenceAnalysisList"),
  referenceAnalysisMeta: document.querySelector("#referenceAnalysisMeta"),
  referenceAnalysisPanel: document.querySelector("#referenceAnalysisPanel"),
  referenceAnalysisRatioGrid: document.querySelector("#referenceAnalysisRatioGrid"),
  referenceAnalysisRatioInput: document.querySelector("#referenceAnalysisRatioInput"),
  referenceAnalysisSizeInput: document.querySelector("#referenceAnalysisSizeInput"),
  referenceAnalysisSelectedPrompt: document.querySelector("#referenceAnalysisSelectedPrompt"),
  referenceAnalysisSelectedPromptPanel: document.querySelector("#referenceAnalysisSelectedPromptPanel"),
  referenceAnalysisCopyPromptButton: document.querySelector("#referenceAnalysisCopyPromptButton"),
  referenceAnalysisGenerateButton: document.querySelector("#referenceAnalysisGenerateButton"),
  referenceAnalysisGenerationCanvas: document.querySelector("#referenceAnalysisGenerationCanvas"),
  referenceAnalysisGenerationDownloadButton: document.querySelector("#referenceAnalysisGenerationDownloadButton"),
  referenceAnalysisGenerationImage: document.querySelector("#referenceAnalysisGenerationImage"),
  referenceAnalysisGenerationMeta: document.querySelector("#referenceAnalysisGenerationMeta"),
  referenceAnalysisGenerationPlaceholder: document.querySelector("#referenceAnalysisGenerationPlaceholder"),
  referenceAnalysisGenerationStrip: document.querySelector("#referenceAnalysisGenerationStrip"),
  referenceAnalysisThumbnailEmpty: document.querySelector("#referenceAnalysisThumbnailEmpty"),
  referenceAnalysisSummary: document.querySelector("#referenceAnalysisSummary"),
  referenceAnalysisToggleButton: document.querySelector("#referenceAnalysisToggleButton"),
  imageDecompositionCount: document.querySelector("#imageDecompositionCount"),
  imageDecompositionCustomLanguageField: document.querySelector("#imageDecompositionCustomLanguageField"),
  imageDecompositionCustomLanguageInput: document.querySelector("#imageDecompositionCustomLanguageInput"),
  imageDecompositionDropzone: document.querySelector("#imageDecompositionDropzone"),
  imageDecompositionFeedback: document.querySelector("#imageDecompositionFeedback"),
  imageDecompositionFeatureCardsInput: document.querySelector("#imageDecompositionFeatureCardsInput"),
  imageDecompositionGenerateButton: document.querySelector("#imageDecompositionGenerateButton"),
  imageDecompositionGenerationCanvas: document.querySelector("#imageDecompositionGenerationCanvas"),
  imageDecompositionGenerationDownloadButton: document.querySelector("#imageDecompositionGenerationDownloadButton"),
  imageDecompositionGenerationImage: document.querySelector("#imageDecompositionGenerationImage"),
  imageDecompositionGenerationLightboxButton: document.querySelector("#imageDecompositionGenerationLightboxButton"),
  imageDecompositionGenerationMeta: document.querySelector("#imageDecompositionGenerationMeta"),
  imageDecompositionGenerationPlaceholder: document.querySelector("#imageDecompositionGenerationPlaceholder"),
  imageDecompositionGenerationStrip: document.querySelector("#imageDecompositionGenerationStrip"),
  imageDecompositionGrid: document.querySelector("#imageDecompositionGrid"),
  imageDecompositionInput: document.querySelector("#imageDecompositionInput"),
  imageDecompositionLanguageInput: document.querySelector("#imageDecompositionLanguageInput"),
  imageDecompositionRatioGrid: document.querySelector("#imageDecompositionRatioGrid"),
  imageDecompositionRatioInput: document.querySelector("#imageDecompositionRatioInput"),
  imageDecompositionSizeInput: document.querySelector("#imageDecompositionSizeInput"),
  imageDecompositionThumbnailEmpty: document.querySelector("#imageDecompositionThumbnailEmpty"),
  referenceAnalyzeButton: document.querySelector("#referenceAnalyzeButton"),
  referenceDropzone: document.querySelector("#referenceDropzone"),
  referenceGrid: document.querySelector("#referenceGrid"),
  referenceInput: document.querySelector("#referenceInput"),
  referencePreviewBackdrop: document.querySelector("#referencePreviewBackdrop"),
  referencePreviewClose: document.querySelector("#referencePreviewClose"),
  referencePreviewImage: document.querySelector("#referencePreviewImage"),
  referencePreviewViewer: document.querySelector("#referencePreviewViewer"),
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
  studioView: document.querySelector(".studio-view"),
  styleTransferBlock: document.querySelector("#styleTransferBlock"),
  styleTransferInstructionInput: document.querySelector("#styleTransferInstructionInput"),
  styleTransferPresetComparison: document.querySelector("#styleTransferPresetComparison"),
  styleTransferPresetDescription: document.querySelector("#styleTransferPresetDescription"),
  styleTransferPresetInput: document.querySelector("#styleTransferPresetInput"),
  styleTransferPresetLabel: document.querySelector("#styleTransferPresetLabel"),
  styleTransferPresetPreview: document.querySelector("#styleTransferPresetPreview"),
  styleTransferSourceDropzone: document.querySelector("#styleTransferSourceDropzone"),
  styleTransferSourceGrid: document.querySelector("#styleTransferSourceGrid"),
  styleTransferSourceInput: document.querySelector("#styleTransferSourceInput"),
  styleTransferStyleDropzone: document.querySelector("#styleTransferStyleDropzone"),
  styleTransferStyleGrid: document.querySelector("#styleTransferStyleGrid"),
  styleTransferStyleInput: document.querySelector("#styleTransferStyleInput"),
  styleTransferUploadGrid: document.querySelector("#styleTransferUploadGrid"),
  themeToggleButton: document.querySelector("#themeToggleButton"),
  themeToggleLabel: document.querySelector("#themeToggleLabel"),
  topbar: document.querySelector(".topbar"),
  timelineList: document.querySelector("#timelineList"),
  timelineNewCount: document.querySelector("#timelineNewCount"),
  timelineNewIndicator: document.querySelector("#timelineNewIndicator"),
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

function makePromptAnalysisImageName(filename) {
  const raw = String(filename || "reference-image").trim();
  const base = raw.replace(/\.[^.]+$/, "") || "reference-image";
  return `${base}-analysis.jpg`;
}

function makeGenerationReferenceImageName(filename) {
  const raw = String(filename || "reference-image").trim();
  const base = raw.replace(/\.[^.]+$/, "") || "reference-image";
  return `${base}-reference.jpg`;
}

async function preparePromptAnalysisImageFile(file) {
  if (
    !file ||
    typeof file !== "object" ||
    !String(file.type || "").startsWith("image/") ||
    Number(file.size || 0) <= PROMPT_ANALYSIS_IMAGE_COMPRESS_THRESHOLD_BYTES
  ) {
    return file;
  }

  let bitmap = null;
  try {
    bitmap = await createImageBitmap(file);
    const maxEdge = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, PROMPT_ANALYSIS_IMAGE_MAX_EDGE / maxEdge);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await canvasToBlob(
      canvas,
      "image/jpeg",
      PROMPT_ANALYSIS_IMAGE_JPEG_QUALITY,
    );
    if (!blob || blob.size <= 0 || blob.size >= file.size) {
      return file;
    }

    return new File([blob], makePromptAnalysisImageName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified || Date.now(),
    });
  } catch {
    return file;
  } finally {
    if (bitmap && typeof bitmap.close === "function") {
      bitmap.close();
    }
  }
}

async function prepareGenerationReferenceImageFile(file) {
  if (
    !file ||
    typeof file !== "object" ||
    !String(file.type || "").startsWith("image/") ||
    Number(file.size || 0) <= GENERATION_REFERENCE_IMAGE_COMPRESS_THRESHOLD_BYTES ||
    typeof createImageBitmap !== "function"
  ) {
    return file;
  }

  let bitmap = null;
  try {
    bitmap = await createImageBitmap(file);
    const maxEdge = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, GENERATION_REFERENCE_IMAGE_MAX_EDGE / maxEdge);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await canvasToBlob(
      canvas,
      "image/jpeg",
      GENERATION_REFERENCE_IMAGE_JPEG_QUALITY,
    );
    if (!blob || blob.size <= 0 || blob.size >= file.size) {
      return file;
    }

    return new File([blob], makeGenerationReferenceImageName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified || Date.now(),
    });
  } catch {
    return file;
  } finally {
    if (bitmap && typeof bitmap.close === "function") {
      bitmap.close();
    }
  }
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

function getServerImageUrl(item = {}) {
  const imageUrl = String(item.serverImageUrl || item.imageUrl || "");
  const thumbnailUrl = String(item.serverThumbnailUrl || item.thumbnailUrl || "");
  if (isServerImageProxyUrl(imageUrl)) {
    return imageUrl;
  }
  if (isServerImageProxyUrl(thumbnailUrl)) {
    return thumbnailUrl;
  }
  return "";
}

function getServerThumbnailUrl(item = {}) {
  const thumbnailUrl = String(item.serverThumbnailUrl || item.thumbnailUrl || "");
  if (isServerImageProxyUrl(thumbnailUrl)) {
    return thumbnailUrl;
  }
  return getServerImageUrl(item);
}

function getImageUrl(item) {
  return item?.imageUrl || item?.thumbnailUrl || item?.previewUrl || item?.serverImageUrl || item?.serverThumbnailUrl || "";
}

function isCacheableBrowserImageUrl(url) {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(String(url || ""));
}

function isServerImageProxyUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) {
    return false;
  }

  if (raw.startsWith("/api/images/")) {
    return true;
  }

  try {
    const parsed = new URL(raw, window.location.origin);
    return parsed.origin === window.location.origin && parsed.pathname.startsWith("/api/images/");
  } catch (_error) {
    return false;
  }
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

async function fetchServerImageAsDataUrl(imageUrl) {
  const response = await fetch(imageUrl, {
    credentials: "same-origin",
    cache: "force-cache",
  });
  if (!response.ok) {
    throw new Error(`server image fetch failed with status ${response.status}`);
  }

  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error("server image response is not an image");
  }
  return readBlobAsDataUrl(blob);
}

function dataUrlToBlob(dataUrl) {
  const [header, base64 = ""] = String(dataUrl || "").split(",", 2);
  const mimeType = header.match(/^data:([^;]+);base64$/i)?.[1] || "application/octet-stream";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function imageElementToBlob(imageElement) {
  if (!imageElement?.complete || !imageElement.naturalWidth || !imageElement.naturalHeight) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = imageElement.naturalWidth;
      canvas.height = imageElement.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(null);
        return;
      }

      context.drawImage(imageElement, 0, 0);
      canvas.toBlob((blob) => resolve(blob?.type?.startsWith("image/") ? blob : null), "image/png");
    } catch (_error) {
      resolve(null);
    }
  });
}

async function resolveDownloadImageBlob(item, imageElement) {
  const elementUrl = imageElement?.currentSrc || imageElement?.src || "";
  const imageUrl = getImageUrl(item) || elementUrl;
  if (isCacheableBrowserImageUrl(imageUrl)) {
    return dataUrlToBlob(imageUrl);
  }
  if (isCacheableBrowserImageUrl(elementUrl)) {
    return dataUrlToBlob(elementUrl);
  }

  if (item?.filename) {
    try {
      const cachedDataUrl = await getBrowserCachedImageData(item.filename);
      if (isCacheableBrowserImageUrl(cachedDataUrl)) {
        return dataUrlToBlob(cachedDataUrl);
      }
    } catch (_error) {
      // Keep download available through the rendered image or server URL when IndexedDB is unavailable.
    }
  }

  if (imageUrl) {
    try {
      const response = await fetch(imageUrl, {
        credentials: "same-origin",
        cache: "force-cache",
      });
      if (response.ok) {
        const blob = await response.blob();
        if (blob.type.startsWith("image/")) {
          return blob;
        }
      }
    } catch (_error) {
      // Fall through to the rendered image fallback.
    }
  }

  const renderedBlob = await imageElementToBlob(imageElement);
  if (renderedBlob) {
    return renderedBlob;
  }

  throw new Error("无法读取当前图片，请刷新页面后重试。");
}

function triggerBrowserImageDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename || "preview.png";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function downloadGalleryItem(item, imageElement) {
  if (!item && !imageElement) {
    return;
  }
  const blob = await resolveDownloadImageBlob(item, imageElement);
  triggerBrowserImageDownload(blob, item.filename || "preview.png");
}

function normalizeBrowserCachedGalleryItem(item = {}) {
  const filename = String(item.filename || "").trim();
  if (!filename) {
    return null;
  }

  const serverImageUrl = getServerImageUrl(item);
  const serverThumbnailUrl = getServerThumbnailUrl(item);
  const normalized = {
    id: String(item.id || ""),
    filename,
    createdAt: String(item.createdAt || nowIso()),
    prompt: String(item.prompt || ""),
    baseUrl: String(item.baseUrl || ""),
    responsesModel: String(item.responsesModel || ""),
    imageModel: String(item.imageModel || "gpt-image-2"),
    hasReferenceImage: Boolean(item.hasReferenceImage),
    referenceImageNames: Array.isArray(item.referenceImageNames) ? item.referenceImageNames.map(String).filter(Boolean) : [],
    referenceImageName: String(item.referenceImageName || ""),
    ratio: String(item.ratio || ""),
    ratioLabel: String(item.ratioLabel || ""),
    size: String(item.size || ""),
    quality: String(item.quality || ""),
    format: String(item.format || ""),
    reasoningEffort: String(item.reasoningEffort || ""),
    generationStartedAt: String(item.generationStartedAt || ""),
    generationCompletedAt: String(item.generationCompletedAt || ""),
    generationDurationMs: String(item.generationDurationMs || ""),
  };

  if (serverImageUrl) {
    normalized.imageUrl = serverImageUrl;
  }
  if (serverThumbnailUrl) {
    normalized.thumbnailUrl = serverThumbnailUrl;
  } else if (normalized.imageUrl) {
    normalized.thumbnailUrl = normalized.imageUrl;
  }

  return normalized;
}

function readBrowserImageCacheIndex() {
  try {
    const raw = window.localStorage.getItem(BROWSER_IMAGE_CACHE_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.map(normalizeBrowserCachedGalleryItem).filter(Boolean)
      : [];
  } catch (_error) {
    return [];
  }
}

function writeBrowserImageCacheIndex(items) {
  try {
    window.localStorage.setItem(
      BROWSER_IMAGE_CACHE_INDEX_KEY,
      JSON.stringify(items.map(normalizeBrowserCachedGalleryItem).filter(Boolean)),
    );
  } catch (_error) {
    // Ignore storage quota or privacy-mode failures; IndexedDB still keeps images for this session.
  }
}

function openBrowserImageCacheDB() {
  if (!window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(BROWSER_IMAGE_CACHE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(BROWSER_IMAGE_CACHE_STORE_NAME, { keyPath: "filename" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
  });
}

async function withBrowserImageCacheStore(mode, operation) {
  const db = await openBrowserImageCacheDB();
  if (!db) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BROWSER_IMAGE_CACHE_STORE_NAME, mode);
    const store = transaction.objectStore(BROWSER_IMAGE_CACHE_STORE_NAME);
    let operationResult = null;
    transaction.oncomplete = () => {
      db.close();
      resolve(operationResult);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("IndexedDB transaction failed"));
    };
    operationResult = operation(store);
  });
}

async function putBrowserCachedImageData(filename, dataUrl) {
  await withBrowserImageCacheStore("readwrite", (store) => {
    store.put({ filename, dataUrl, updatedAt: nowIso() });
  });
}

async function getBrowserCachedImageData(filename) {
  return withBrowserImageCacheStore("readonly", (store) => {
    const request = store.get(filename);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result?.dataUrl || "");
      request.onerror = () => reject(request.error || new Error("IndexedDB read failed"));
    });
  });
}

async function deleteBrowserCachedImageData(filename) {
  await withBrowserImageCacheStore("readwrite", (store) => {
    store.delete(filename);
  });
}

async function cacheBrowserGalleryItem(item) {
  const cachedItem = normalizeBrowserCachedGalleryItem(item);
  const serverImageUrl = getServerImageUrl(item);
  let imageUrl = getImageUrl(item);
  if (!isCacheableBrowserImageUrl(imageUrl) && serverImageUrl) {
    imageUrl = serverImageUrl;
  }
  const hasServerImageUrl = isServerImageProxyUrl(imageUrl);
  const hasDataUrl = isCacheableBrowserImageUrl(imageUrl);
  if (!cachedItem || (!hasDataUrl && !hasServerImageUrl)) {
    return;
  }

  const writeIndex = () => {
    const nextIndex = [
      cachedItem,
      ...readBrowserImageCacheIndex().filter((entry) => entry.filename !== cachedItem.filename),
    ];
    writeBrowserImageCacheIndex(nextIndex);
  };

  try {
    if (hasServerImageUrl) {
      writeIndex();
    }
    const dataUrl = hasDataUrl ? imageUrl : await fetchServerImageAsDataUrl(imageUrl);
    await putBrowserCachedImageData(cachedItem.filename, dataUrl);
    writeIndex();
    await navigator.storage?.persist?.();
  } catch (error) {
    console.warn("cache generated image in browser failed", cachedItem.filename, error);
  }
}

async function readBrowserCachedGalleryItems() {
  const entries = readBrowserImageCacheIndex();
  const restoredItems = [];
  const missingFilenames = new Set();

  for (const entry of entries) {
    try {
      const dataUrl = await getBrowserCachedImageData(entry.filename);
      const fallbackImageUrl = isServerImageProxyUrl(entry.imageUrl) ? entry.imageUrl : "";
      const fallbackThumbnailUrl = isServerImageProxyUrl(entry.thumbnailUrl) ? entry.thumbnailUrl : fallbackImageUrl;
      if (!isCacheableBrowserImageUrl(dataUrl)) {
        if (fallbackImageUrl) {
          restoredItems.push({
            ...entry,
            imageUrl: fallbackImageUrl,
            thumbnailUrl: fallbackThumbnailUrl,
          });
        } else {
          missingFilenames.add(entry.filename);
        }
        continue;
      }

      restoredItems.push({
        ...entry,
        imageUrl: dataUrl,
        thumbnailUrl: dataUrl,
      });
    } catch (_error) {
      missingFilenames.add(entry.filename);
    }
  }

  if (missingFilenames.size > 0) {
    writeBrowserImageCacheIndex(entries.filter((entry) => !missingFilenames.has(entry.filename)));
  }

  return restoredItems;
}

async function deleteBrowserCachedGalleryItem(filename) {
  const normalizedFilename = String(filename || "").trim();
  if (!normalizedFilename) {
    return;
  }

  writeBrowserImageCacheIndex(readBrowserImageCacheIndex().filter((entry) => entry.filename !== normalizedFilename));
  try {
    await deleteBrowserCachedImageData(normalizedFilename);
  } catch (_error) {
    // The in-page gallery has already been updated; stale browser data can be ignored.
  }
}

async function clearBrowserImageCache() {
  window.localStorage.removeItem(BROWSER_IMAGE_CACHE_INDEX_KEY);
  try {
    await withBrowserImageCacheStore("readwrite", (store) => {
      store.clear();
    });
  } catch (_error) {
    // Ignore unavailable IndexedDB or privacy-mode failures.
  }
}

function mergeServerAndBrowserGalleryItems(serverItems, browserItems) {
  const mergedByFilename = new Map();

  for (const item of browserItems) {
    if (item?.filename) {
      mergedByFilename.set(item.filename, item);
    }
  }

  for (const item of serverItems) {
    if (!item?.filename) {
      continue;
    }
    const cachedItem = mergedByFilename.get(item.filename);
    const cachedImageUrl = isCacheableBrowserImageUrl(cachedItem?.imageUrl) ? cachedItem.imageUrl : "";
    const cachedThumbnailUrl = isCacheableBrowserImageUrl(cachedItem?.thumbnailUrl)
      ? cachedItem.thumbnailUrl
      : cachedImageUrl;
    mergedByFilename.set(item.filename, {
      ...cachedItem,
      ...item,
      imageUrl: cachedImageUrl || item.imageUrl || cachedItem?.imageUrl || "",
      thumbnailUrl: cachedThumbnailUrl || item.thumbnailUrl || cachedItem?.thumbnailUrl || cachedImageUrl || "",
    });
  }

  return [...mergedByFilename.values()];
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

function formatCompactSizeLabel(size) {
  const normalized = String(size || "")
    .trim()
    .replace(/\s*[x×]\s*/i, "x");

  return /^\d+x\d+$/.test(normalized) ? normalized : "";
}

function formatCompactRatioLabel(ratio) {
  const normalized = String(ratio || "")
    .trim()
    .replace(/\s*[：:]\s*/g, ":");

  return /^\d+:\d+$/.test(normalized) ? normalized : "";
}

function formatFilmstripSizeLabel(item) {
  return formatCompactSizeLabel(item?.size);
}

function compactTimelineText(value, fallback = "未命名任务") {
  const raw = String(value || "").trim();
  if (!raw) {
    return fallback;
  }

  return raw.length > 34 ? `${raw.slice(0, 34)}...` : raw;
}

function normalizeGenerationTaskStatus(status) {
  return status === "completed" || status === "error" ? status : "running";
}

function normalizeActivityEntry(entry) {
  const key = String(entry?.key || "").trim();
  const title = String(entry?.title || "").trim();
  const detail = String(entry?.detail || "");
  if (!key || !title) {
    return null;
  }

  if (isGenerationRequestRetryMessage(detail)) {
    return null;
  }

  return {
    key,
    title,
    detail,
    ratio: formatCompactRatioLabel(entry?.ratio),
    size: formatCompactSizeLabel(entry?.size),
    status: ["active", "done", "error", "pending"].includes(entry?.status) ? entry.status : "active",
    at: String(entry?.at || ""),
    orderAt: String(entry?.orderAt || entry?.at || ""),
  };
}

function normalizePersistedActivityEntry(entry) {
  const normalized = normalizeActivityEntry(entry);
  if (!normalized) {
    return null;
  }

  if (normalized.status === "active") {
    return {
      ...normalized,
      title: GENERATION_TASK_STATUS_LABELS.error,
      detail: "上次页面关闭前生成未完成，请重新生成",
      status: "error",
    };
  }

  return normalized;
}

function readGenerationActivityFeed() {
  try {
    const raw = window.localStorage.getItem(GENERATION_ACTIVITY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const entries = Array.isArray(parsed) ? parsed.map(normalizePersistedActivityEntry).filter(Boolean) : [];
    return sortGenerationActivityFeed(entries).slice(0, 12);
  } catch (_error) {
    return [];
  }
}

function writeGenerationActivityFeed() {
  try {
    window.localStorage.setItem(GENERATION_ACTIVITY_STORAGE_KEY, JSON.stringify(state.activityFeed.slice(0, 12)));
  } catch (_error) {
    // Ignore storage quota or privacy-mode failures; the in-memory feed still works.
  }
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

function normalizeUiTheme(theme) {
  return theme === "light" ? "light" : "dark";
}

function readUiTheme() {
  try {
    return normalizeUiTheme(window.localStorage.getItem(THEME_STORAGE_KEY) || document.documentElement.dataset.theme);
  } catch {
    return normalizeUiTheme(document.documentElement.dataset.theme);
  }
}

function syncThemeToggle() {
  if (!refs.themeToggleButton || !refs.themeToggleLabel) {
    return;
  }

  const isLight = state.uiTheme === "light";
  refs.themeToggleButton.setAttribute("aria-pressed", String(isLight));
  refs.themeToggleButton.title = isLight ? "切换到深色主题" : "切换到白色主题";
  refs.themeToggleLabel.textContent = isLight ? "深色主题" : "白色主题";
}

function setUiTheme(theme) {
  const normalized = normalizeUiTheme(theme);
  state.uiTheme = normalized;
  document.documentElement.dataset.theme = normalized;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, normalized);
  } catch {
    // Ignore storage restrictions; the current page can still switch theme.
  }
  syncThemeToggle();
}

function toggleUiTheme() {
  setUiTheme(state.uiTheme === "light" ? "dark" : "light");
}

function getViewFromHash() {
  if (window.location.hash === "#style-transfer") {
    return "style-transfer";
  }
  if (window.location.hash === "#reference-analysis") {
    return "reference-analysis";
  }
  if (window.location.hash === "#image-decomposition") {
    return "image-decomposition";
  }
  if (window.location.hash === "#creation") {
    return "creation";
  }
  if (window.location.hash === "#article-illustration") {
    return "article-illustration";
  }
  if (window.location.hash === "#gallery") {
    return "gallery";
  }
  if (window.location.hash === "#article-record") {
    return "article-record";
  }
  if (window.location.hash === "#creation-record") {
    return "creation-record";
  }
  if (window.location.hash === "#ppt-record") {
    return "ppt-record";
  }
  if (window.location.hash === "#ppt") {
    return "ppt";
  }
  return "studio";
}

function syncHash(view) {
  const nextHash =
    view === "creation" ? "#creation" : view === "style-transfer"
        ? "#style-transfer"
        : view === "reference-analysis"
          ? "#reference-analysis"
          : view === "image-decomposition"
            ? "#image-decomposition"
          : view === "article-illustration"
            ? "#article-illustration"
          : view === "gallery"
            ? "#gallery"
            : view === "article-record"
              ? "#article-record"
            : view === "creation-record"
              ? "#creation-record"
              : view === "ppt-record"
                ? "#ppt-record"
                : view === "ppt"
                  ? "#ppt"
                  : "#studio";
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, "", nextHash);
  }
}

function setStudioGenerationMode(mode = "prompt") {
  const nextMode = mode === "style-transfer" ? "style-transfer" : "prompt";
  state.studioMode = nextMode;
  if (refs.studioView) {
    refs.studioView.dataset.studioMode = nextMode;
  }

  refs.promptModeBlocks.forEach((block) => {
    block.classList.toggle("hidden", nextMode === "style-transfer");
  });
  refs.styleTransferBlock?.classList.toggle("hidden", nextMode !== "style-transfer");
  updateGenerateButton();
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

function maskBrowserApiKey(apiKey) {
  if (!apiKey) {
    return "";
  }

  if (apiKey.length <= 8) {
    return `${apiKey.slice(0, 2)}***`;
  }

  return `${apiKey.slice(0, 4)}***${apiKey.slice(-4)}`;
}

function normalizeBrowserPrivateConfig(source = {}) {
  const baseUrl = String(source.baseUrl || "https://api.openai.com/v1").trim();
  const apiKey = String(source.apiKey || "").trim();
  const responsesModel = String(source.responsesModel || "gpt-5.5").trim();

  return {
    baseUrl: baseUrl || "https://api.openai.com/v1",
    apiKey,
    responsesModel: responsesModel || "gpt-5.5",
  };
}

function readBrowserPrivateConfig() {
  try {
    const raw = window.localStorage.getItem(BROWSER_CONFIG_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return normalizeBrowserPrivateConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

function toPublicBrowserConfig(privateConfig, baseConfig = {}) {
  const normalized = normalizeBrowserPrivateConfig(privateConfig);
  return {
    ...baseConfig,
    baseUrl: normalized.baseUrl,
    apiKeyConfigured: Boolean(normalized.apiKey),
    apiKeyMask: maskBrowserApiKey(normalized.apiKey),
    responsesModel: normalized.responsesModel,
  };
}

function saveBrowserPrivateConfig(payload) {
  const current = readBrowserPrivateConfig() || normalizeBrowserPrivateConfig();
  const next = normalizeBrowserPrivateConfig({
    ...current,
    baseUrl: payload.baseUrl,
    apiKey: payload.apiKey ? payload.apiKey : current.apiKey,
    responsesModel: payload.responsesModel,
  });

  window.localStorage.setItem(BROWSER_CONFIG_STORAGE_KEY, JSON.stringify(next));
  return next;
}

function appendBrowserConfigToFormData(formData) {
  const browserConfig = readBrowserPrivateConfig();
  if (!browserConfig) {
    return formData;
  }

  formData.set("baseUrl", browserConfig.baseUrl);
  formData.set("apiKey", browserConfig.apiKey);
  formData.set("responsesModel", browserConfig.responsesModel);
  return formData;
}

function getBrowserPrivateConfigRequestPayload() {
  const browserConfig = readBrowserPrivateConfig();
  return browserConfig
    ? {
        baseUrl: browserConfig.baseUrl,
        apiKey: browserConfig.apiKey,
        responsesModel: browserConfig.responsesModel,
      }
    : {};
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

function setConnectionState(kind, label, entryLabel = CONNECTION_STATUS_ENTRY_LABEL) {
  refs.connectionStatus.dataset.state = kind;
  refs.connectionStatus.title = label;
  refs.connectionStatus.setAttribute("aria-label", `${entryLabel}，打开 API、LOG`);
  refs.connectionLabel.textContent = entryLabel;
}

function syncConnectionState() {
  const queuedCount = getQueuedJobCount();
  if (queuedCount > 0) {
    setConnectionState("busy", `并发 ${getRunningJobCount()}/${getMaxParallelJobCount()} · 队列 ${queuedCount}/${getMaxQueuedJobCount()}`);
    return;
  }

  if (state.config?.apiKeyConfigured) {
    setConnectionState("ready", "API 已就绪");
    return;
  }

  setConnectionState("idle", "请先配置 API", CONNECTION_STATUS_EMPTY_LABEL);
}

function setDrawerOpen(open) {
  refs.configDrawer.classList.toggle("open", open);
  refs.configDrawer.setAttribute("aria-hidden", String(!open));
}

function openConfigGenerationLog() {
  setDrawerOpen(true);
  window.requestAnimationFrame(() => {
    refs.configGenerationLogPanel?.scrollIntoView({ block: "start", behavior: "smooth" });
  });
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

function syncLightboxCreationRecordActions(fresh = {}) {
  const isCreationRecordItem = Boolean(fresh.isCreationRecordItem);
  const isArticleRecordItem = Boolean(fresh.isArticleRecordItem);
  const isRecordItem = isCreationRecordItem || isArticleRecordItem;
  const hasRelativePath = Boolean(String(fresh.relativePath || "").trim());

  refs.lightboxCopyPathButton?.classList.toggle("hidden", !isCreationRecordItem);
  refs.lightboxCopyFullPathButton?.classList.toggle("hidden", !isCreationRecordItem);
  if (refs.lightboxCopyPathButton) {
    refs.lightboxCopyPathButton.disabled = !isCreationRecordItem || !hasRelativePath;
  }
  if (refs.lightboxCopyFullPathButton) {
    refs.lightboxCopyFullPathButton.disabled = !isCreationRecordItem || !hasRelativePath;
  }
  if (refs.lightboxDelete) {
    refs.lightboxDelete.hidden = Boolean(isRecordItem);
    refs.lightboxDelete.disabled = isRecordItem || !fresh.filename;
  }
}

function getStudioViewportMetrics() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    outerWidth: window.outerWidth,
    visualScale: window.visualViewport?.scale || 1,
    coarsePointer: window.matchMedia?.("(pointer: coarse)")?.matches || false,
  };
}

function getCurrentStudioLayoutMode() {
  return (
    document.documentElement.dataset.uiLayout ||
    getStudioLayoutMode(getStudioViewportMetrics())
  );
}

function isAdaptiveCompactLayout(layoutMode = getCurrentStudioLayoutMode()) {
  return ADAPTIVE_COLLAPSIBLE_LAYOUTS.has(layoutMode);
}

function getAdaptiveWorkbenchSections() {
  return [...document.querySelectorAll("[data-adaptive-section]")].filter((section) => section.tagName === "DETAILS");
}

function syncAdaptiveWorkbenchSections(layoutMode = getCurrentStudioLayoutMode()) {
  const isCompactLayout = isAdaptiveCompactLayout(layoutMode);
  const layoutChanged = adaptiveSectionLayoutMode !== layoutMode;
  const sections = getAdaptiveWorkbenchSections();

  adaptiveSectionSyncing = true;
  sections.forEach((section) => {
    if (!isCompactLayout) {
      section.open = true;
      section.dataset.adaptiveUserToggled = "false";
      return;
    }

    if (layoutChanged && section.dataset.adaptiveUserToggled !== "true") {
      section.open = section.dataset.compactOpen === "true";
    }
  });
  adaptiveSectionLayoutMode = layoutMode;

  window.setTimeout(() => {
    adaptiveSectionSyncing = false;
  }, 0);
}

function bindAdaptiveWorkbenchSections() {
  getAdaptiveWorkbenchSections().forEach((section) => {
    const summary = section.querySelector("summary");
    summary?.addEventListener("click", (event) => {
      if (!isAdaptiveCompactLayout()) {
        event.preventDefault();
        section.open = true;
      }
    });

    section.addEventListener("toggle", () => {
      if (adaptiveSectionSyncing || !isAdaptiveCompactLayout()) {
        return;
      }
      section.dataset.adaptiveUserToggled = "true";
    });
  });
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
  const viewportMetrics = getStudioViewportMetrics();
  const settings = getStudioDensitySettings(viewportMetrics);
  const layoutMode = settings.layoutMode || getStudioLayoutMode(viewportMetrics);

  document.documentElement.dataset.uiDensity = settings.mode;
  document.documentElement.dataset.uiLayout = layoutMode;
  syncAdaptiveWorkbenchSections(layoutMode);

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
  const activeNavSection = CREATE_VIEW_IDS.has(view) ? "create" : ASSET_VIEW_IDS.has(view) ? "assets" : "";
  const activeTabView = CREATE_VIEW_IDS.has(view) ? "studio" : ASSET_VIEW_IDS.has(view) ? "gallery" : view;
  const activePanelView = view === "style-transfer" ? "studio" : view === "reference-analysis" ? "reference-analysis" : view;

  refs.globalNavItems.forEach((item) => {
    const button = item.querySelector("[data-nav-menu]");
    button?.classList.toggle("active", item.dataset.navSection === activeNavSection);
  });

  refs.viewTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.viewTab === activeTabView);
  });

  refs.viewPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.viewPanel !== activePanelView);
  });

  if (view === "studio" || view === "style-transfer") {
    setStudioGenerationMode(view === "style-transfer" ? "style-transfer" : "prompt");
  }
  if (view === "creation") {
    ensureCreationCategoryTemplatesReady({ render: true });
  }
  if (view === "creation-record") {
    refreshCreationRecordSets();
  }
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
  const preparingReference =
    state.referenceCompressionRunning ||
    hasPendingReferenceGenerationFiles() ||
    hasPendingStyleTransferGenerationFiles();
  refs.generateButton.disabled = preparingReference || queuedCount >= maxQueuedCount;
  const idleLabel = state.studioMode === "style-transfer" ? "风格迁移" : "开始生成";
  refs.generateButton.textContent =
    preparingReference ? "处理参考图..." : queuedCount > 0 ? `队列 ${queuedCount}/${maxQueuedCount}` : idleLabel;
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
  return String(item?.json?.prompt || item?.json?.prompts?.[0]?.prompt || "").trim();
}

function getPromptAgentJsonText(item = state.promptAgent.result) {
  if (!item?.json) {
    return "";
  }

  return JSON.stringify(item.json, null, 2);
}

function getPromptAgentTemplateId(item) {
  const rawId = String(item?.id || item?.createdAt || item?.filename || "latest").trim();
  const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, "-") || "latest";
  return `prompt-agent-${safeId}`;
}

function savePromptAgentResultAsTemplate(item) {
  const prompt = getPromptAgentJsonText(item);
  if (!prompt) {
    return;
  }

  const template = {
    id: getPromptAgentTemplateId(item),
    name: item.json?.title || item.filename || "图片 JSON 提示词",
    prompt,
  };
  state.promptTemplates = [
    template,
    ...state.promptTemplates.filter((entry) => entry.id !== template.id),
  ];
  state.selectedPromptTemplateId = template.id;
  writePromptTemplates();
  renderPromptTemplates();
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
  card.dataset.expanded = "false";

  const titleRow = document.createElement("div");
  titleRow.className = "prompt-agent-history-title";

  const titleButton = document.createElement("button");
  titleButton.className = "prompt-agent-history-title-button";
  titleButton.type = "button";
  titleButton.dataset.promptAgentMapId = item.id;
  titleButton.textContent = item.json?.title || "图片提示词";
  titleButton.title = titleButton.textContent;

  const time = document.createElement("span");
  time.className = "prompt-agent-history-time";
  time.textContent = formatTime(item.createdAt);

  const expandButton = document.createElement("button");
  expandButton.className = "prompt-agent-history-expand-button";
  expandButton.type = "button";
  expandButton.dataset.promptAgentExpandId = item.id;
  expandButton.setAttribute("aria-expanded", "false");
  expandButton.textContent = "展开";

  const detail = document.createElement("div");
  detail.className = "prompt-agent-history-detail hidden";
  detail.id = `prompt-agent-history-detail-${String(item.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  expandButton.setAttribute("aria-controls", detail.id);
  expandButton.setAttribute("aria-label", `展开 ${titleButton.textContent}`);

  titleRow.append(titleButton, time, expandButton);

  const promptText = document.createElement("p");
  promptText.className = "prompt-agent-history-prompt";
  promptText.textContent = getPromptAgentPrompt(item) || "未返回 prompt 字段";

  const meta = document.createElement("div");
  meta.className = "prompt-agent-history-meta";
  const tags = Array.isArray(item.json?.style_tags) ? item.json.style_tags.slice(0, 4).join(" / ") : "";
  meta.textContent = [item.filename, item.json?.aspect_ratio, tags].filter(Boolean).join(" · ");

  const actions = document.createElement("div");
  actions.className = "prompt-agent-history-actions";

  const copyButton = document.createElement("button");
  copyButton.className = "inline-button";
  copyButton.type = "button";
  copyButton.dataset.promptAgentCopyId = item.id;
  copyButton.textContent = "复制 JSON";

  actions.append(copyButton);
  detail.append(promptText, meta, actions);
  card.append(titleRow, detail);
  return card;
}

function setPromptAgentHistoryCardExpanded(card, expanded) {
  const detail = card.querySelector(".prompt-agent-history-detail");
  const expandButton = card.querySelector(".prompt-agent-history-expand-button");
  card.dataset.expanded = expanded ? "true" : "false";
  detail?.classList.toggle("hidden", !expanded);
  if (expandButton) {
    expandButton.setAttribute("aria-expanded", String(expanded));
    expandButton.textContent = expanded ? "收起" : "展开";
  }
}

function togglePromptAgentHistoryCard(button) {
  const card = button.closest(".prompt-agent-history-card");
  if (!card) {
    return;
  }
  setPromptAgentHistoryCardExpanded(card, card.dataset.expanded !== "true");
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

function getGenerationReferenceFile(item) {
  return item?.generationFile || item?.file;
}

function getCreationReferenceGenerationFile(item) {
  return item?.generationFile || item?.file;
}

function normalizeCreationLogoPlacement(value) {
  return CREATION_LOGO_PLACEMENTS.has(String(value || "")) ? String(value) : "top-left";
}

function normalizeCreationLogoBackground(value) {
  return CREATION_LOGO_BACKGROUNDS.has(String(value || "")) ? String(value) : "transparent";
}

function normalizeCreationLogoPayload(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const filename = String(source.filename || source.name || source.logoFilename || "").trim();
  if (!filename) {
    return null;
  }

  const placement = normalizeCreationLogoPlacement(source.placement || source.logoPlacement);
  const background = normalizeCreationLogoBackground(source.background || source.backgroundMode || source.logoBackground);
  return {
    enabled: true,
    filename,
    placement,
    placementLabel: CREATION_LOGO_PLACEMENT_LABELS[placement] || placement,
    background,
    backgroundLabel: CREATION_LOGO_BACKGROUND_LABELS[background] || background,
  };
}

function getCreationLogoGenerationFile() {
  return state.creationLogo?.generationFile || state.creationLogo?.file || null;
}

function getReferenceAnalysisGenerationFile(item) {
  return item?.generationFile || item?.file;
}

function getImageDecompositionGenerationFile(item = state.imageDecomposition.file) {
  return item?.generationFile || item?.file;
}

function hasPendingReferenceGenerationFiles() {
  return state.referenceFiles.some((item) => item.generationFilePromise);
}

function hasPendingCreationReferenceGenerationFiles() {
  return state.creationReferenceFiles.some((item) => item.generationFilePromise);
}

function hasPendingCreationLogoGenerationFile() {
  return Boolean(state.creationLogo?.generationFilePromise);
}

function hasPendingReferenceAnalysisGenerationFiles() {
  return state.referenceAnalysis.files.some((item) => item.generationFilePromise);
}

function hasPendingImageDecompositionGenerationFiles() {
  return Boolean(state.imageDecomposition.file?.generationFilePromise);
}

function startReferenceGenerationCompression(item) {
  if (!item?.file) {
    return null;
  }

  item.generationFile = item.file;
  item.generationCompressed = false;
  item.generationFilePromise = prepareGenerationReferenceImageFile(item.file)
    .then((preparedFile) => {
      item.generationFile = preparedFile || item.file;
      item.generationCompressed = Boolean(preparedFile && preparedFile !== item.file);
      return item.generationFile;
    })
    .catch(() => {
      item.generationFile = item.file;
      item.generationCompressed = false;
      return item.file;
    })
    .finally(() => {
      item.generationFilePromise = null;
      updateGenerateButton();
    });

  updateGenerateButton();
  return item.generationFilePromise;
}

function startReferenceAnalysisGenerationCompression(item) {
  if (!item?.file) {
    return null;
  }

  item.generationFile = item.file;
  item.generationCompressed = false;
  item.generationFilePromise = prepareGenerationReferenceImageFile(item.file)
    .then((preparedFile) => {
      item.generationFile = preparedFile || item.file;
      item.generationCompressed = Boolean(preparedFile && preparedFile !== item.file);
      return item.generationFile;
    })
    .catch(() => {
      item.generationFile = item.file;
      item.generationCompressed = false;
      return item.file;
    })
    .finally(() => {
      item.generationFilePromise = null;
      renderReferenceAnalysisGrid();
      renderReferenceAnalysis();
    });

  renderReferenceAnalysisGrid();
  renderReferenceAnalysis();
  return item.generationFilePromise;
}

function startImageDecompositionGenerationCompression(item) {
  if (!item?.file) {
    return null;
  }

  item.generationFile = item.file;
  item.generationCompressed = false;
  item.generationFilePromise = prepareGenerationReferenceImageFile(item.file)
    .then((preparedFile) => {
      item.generationFile = preparedFile || item.file;
      item.generationCompressed = Boolean(preparedFile && preparedFile !== item.file);
      return item.generationFile;
    })
    .catch(() => {
      item.generationFile = item.file;
      item.generationCompressed = false;
      return item.file;
    })
    .finally(() => {
      item.generationFilePromise = null;
      renderImageDecompositionView();
    });

  renderImageDecompositionView();
  return item.generationFilePromise;
}

function getStyleTransferReferenceItem(slot) {
  return slot === "style" ? state.styleTransfer.style : state.styleTransfer.source;
}

function getStyleTransferGenerationFile(slot) {
  return getGenerationReferenceFile(getStyleTransferReferenceItem(slot));
}

function hasPendingStyleTransferGenerationFiles() {
  return Boolean(state.styleTransfer.source?.generationFilePromise || state.styleTransfer.style?.generationFilePromise);
}

function startStyleTransferGenerationCompression(item) {
  if (!item?.file) {
    return null;
  }

  item.generationFile = item.file;
  item.generationCompressed = false;
  item.generationFilePromise = prepareGenerationReferenceImageFile(item.file)
    .then((preparedFile) => {
      item.generationFile = preparedFile || item.file;
      item.generationCompressed = Boolean(preparedFile && preparedFile !== item.file);
      return item.generationFile;
    })
    .catch(() => {
      item.generationFile = item.file;
      item.generationCompressed = false;
      return item.file;
    })
    .finally(() => {
      item.generationFilePromise = null;
      renderStyleTransferReferences();
      updateGenerateButton();
    });

  renderStyleTransferReferences();
  updateGenerateButton();
  return item.generationFilePromise;
}

function startCreationReferenceGenerationCompression(item) {
  if (!item?.file) {
    return null;
  }

  item.generationFile = item.file;
  item.generationCompressed = false;
  item.generationFilePromise = prepareGenerationReferenceImageFile(item.file)
    .then((preparedFile) => {
      item.generationFile = preparedFile || item.file;
      item.generationCompressed = Boolean(preparedFile && preparedFile !== item.file);
      return item.generationFile;
    })
    .catch(() => {
      item.generationFile = item.file;
      item.generationCompressed = false;
      return item.file;
    })
    .finally(() => {
      item.generationFilePromise = null;
      renderCreationView();
    });

  renderCreationView();
  return item.generationFilePromise;
}

function startCreationLogoGenerationCompression(item = state.creationLogo) {
  if (!item?.file) {
    return null;
  }

  item.generationFile = item.file;
  item.generationCompressed = false;
  item.generationFilePromise = prepareGenerationReferenceImageFile(item.file)
    .then((preparedFile) => {
      item.generationFile = preparedFile || item.file;
      item.generationCompressed = Boolean(preparedFile && preparedFile !== item.file);
      return item.generationFile;
    })
    .catch(() => {
      item.generationFile = item.file;
      item.generationCompressed = false;
      return item.file;
    })
    .finally(() => {
      item.generationFilePromise = null;
      renderCreationView();
    });

  renderCreationView();
  return item.generationFilePromise;
}

async function ensureStyleTransferGenerationFilesReady() {
  const pending = [state.styleTransfer.source?.generationFilePromise, state.styleTransfer.style?.generationFilePromise].filter(
    Boolean,
  );
  if (pending.length === 0) {
    return;
  }

  try {
    await Promise.allSettled(pending);
  } finally {
    renderStyleTransferReferences();
  }
}

async function ensureReferenceGenerationFilesReady() {
  const pending = state.referenceFiles.map((item) => item.generationFilePromise).filter(Boolean);
  if (pending.length === 0) {
    return;
  }

  state.referenceCompressionRunning = true;
  updateGenerateButton();
  try {
    await Promise.allSettled(pending);
  } finally {
    state.referenceCompressionRunning = false;
    updateGenerateButton();
  }
}

async function ensureCreationReferenceGenerationFilesReady() {
  const pending = [
    ...state.creationReferenceFiles.map((item) => item.generationFilePromise),
    state.creationLogo?.generationFilePromise,
  ].filter(Boolean);
  if (pending.length === 0) {
    return;
  }

  try {
    await Promise.allSettled(pending);
  } finally {
    renderCreationView();
  }
}

async function ensureReferenceAnalysisGenerationFilesReady() {
  const pending = state.referenceAnalysis.files.map((item) => item.generationFilePromise).filter(Boolean);
  if (pending.length === 0) {
    return;
  }

  try {
    await Promise.allSettled(pending);
  } finally {
    renderReferenceAnalysisGrid();
    renderReferenceAnalysis();
  }
}

async function ensureImageDecompositionGenerationFilesReady() {
  const pending = [state.imageDecomposition.file?.generationFilePromise].filter(Boolean);
  if (pending.length === 0) {
    return;
  }

  try {
    await Promise.allSettled(pending);
  } finally {
    renderImageDecompositionView();
  }
}

function resetReferenceFiles() {
  closeReferencePreview();
  state.referenceFiles.forEach(revokeReferencePreview);
  state.referenceFiles = [];
  refs.referenceInput.value = "";
  renderReferenceGrid();
  updateGenerateButton();
}

function openReferencePreview(referenceId) {
  const item = state.referenceFiles.find((entry) => entry.id === referenceId);
  if (!item?.previewUrl) {
    return;
  }

  state.referencePreviewItem = item;
  refs.referencePreviewImage.src = item.previewUrl;
  refs.referencePreviewViewer.classList.add("open");
  refs.referencePreviewViewer.setAttribute("aria-hidden", "false");
}

function closeReferencePreview() {
  state.referencePreviewItem = null;
  state.creationReferencePreviewItem = null;
  state.referenceAnalysisPreviewItem = null;
  state.imageDecompositionPreviewItem = null;
  state.styleTransferPreviewItem = null;
  refs.referencePreviewViewer.classList.remove("open");
  refs.referencePreviewViewer.setAttribute("aria-hidden", "true");
  refs.referencePreviewImage.removeAttribute("src");
}

function removeReferenceFile(referenceId) {
  const target = state.referenceFiles.find((item) => item.id === referenceId);
  if (state.referencePreviewItem?.id === referenceId) {
    closeReferencePreview();
  }
  revokeReferencePreview(target);
  state.referenceFiles = state.referenceFiles.filter((item) => item.id !== referenceId);
  renderReferenceGrid();
  updateGenerateButton();
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

    const referenceItem = {
      id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fingerprint,
      file,
      generationFile: file,
      generationFilePromise: null,
      generationCompressed: false,
      previewUrl: URL.createObjectURL(file),
    };
    startReferenceGenerationCompression(referenceItem);
    next.push(referenceItem);
    fingerprints.add(fingerprint);
  }

  state.referenceFiles = next;
  refs.referenceInput.value = "";
  renderReferenceGrid();
  updateGenerateButton();

  if (overflowed) {
    showError(`参考图最多支持 ${state.limits.maxReferenceImages} 张。`);
  }
}

function createReferenceAnalysisItem(file) {
  return {
    id: `reference-analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fingerprint: buildReferenceFingerprint(file),
    file,
    generationFile: file,
    generationFilePromise: null,
    generationCompressed: false,
    previewUrl: URL.createObjectURL(file),
  };
}

function applyReferenceAnalysisFiles(fileList) {
  const incomingFiles = [...(fileList || [])].filter((file) => file.type.startsWith("image/"));
  if (incomingFiles.length === 0) {
    return;
  }

  const next = [...state.referenceAnalysis.files];
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

    const referenceItem = createReferenceAnalysisItem(file);
    startReferenceAnalysisGenerationCompression(referenceItem);
    next.push(referenceItem);
    fingerprints.add(fingerprint);
  }

  state.referenceAnalysis.files = next;
  refs.referenceAnalysisInput.value = "";
  markReferenceAnalysisDirty();
  renderReferenceAnalysisGrid();
  renderReferenceAnalysis();

  if (overflowed) {
    setReferenceAnalysisFeedback(`融图分析最多支持 ${state.limits.maxReferenceImages} 张图片。`, "error");
  }
}

function removeReferenceAnalysisFile(referenceId) {
  const target = state.referenceAnalysis.files.find((item) => item.id === referenceId);
  if (state.referenceAnalysisPreviewItem?.id === referenceId) {
    closeReferencePreview();
  }
  revokeReferencePreview(target);
  state.referenceAnalysis.files = state.referenceAnalysis.files.filter((item) => item.id !== referenceId);
  markReferenceAnalysisDirty();
  renderReferenceAnalysisGrid();
  renderReferenceAnalysis();
}

function createImageDecompositionItem(file) {
  return {
    id: `image-decomposition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fingerprint: buildReferenceFingerprint(file),
    file,
    generationFile: file,
    generationFilePromise: null,
    generationCompressed: false,
    previewUrl: URL.createObjectURL(file),
  };
}

function setImageDecompositionFeedback(message = "", kind = "") {
  refs.imageDecompositionFeedback.textContent = message ? compactErrorMessage(message, "图片拆解失败") : "";
  refs.imageDecompositionFeedback.dataset.state = kind;
}

function getImageDecompositionGenerationItemByKey(key) {
  if (String(key || "").startsWith("job:")) {
    return state.jobs.find((job) => job.id === String(key).slice(4) && job.mode === "image-decomposition") || null;
  }

  if (String(key || "").startsWith("file:")) {
    return state.imageDecomposition.generationItems[key] || state.gallery.find((item) => item.filename === String(key).slice(5)) || null;
  }

  return null;
}

function storeImageDecompositionGenerationItem(item) {
  const filename = String(item?.filename || "").trim();
  if (!filename) {
    return "";
  }

  const key = makeGalleryPreviewKey(filename);
  const current = state.imageDecomposition.generationItems[key] || {};
  state.imageDecomposition.generationItems[key] = {
    ...current,
    ...item,
    mode: "image-decomposition",
  };
  return key;
}

function registerImageDecompositionGenerationKey(key) {
  const nextKey = String(key || "").trim();
  if (!nextKey) {
    return;
  }

  state.imageDecomposition.generationKeys = [
    nextKey,
    ...state.imageDecomposition.generationKeys.filter((entry) => entry !== nextKey),
  ];
}

function replaceImageDecompositionGenerationKey(oldKey, newKey) {
  const currentKey = String(oldKey || "").trim();
  const nextKey = String(newKey || "").trim();
  if (!nextKey) {
    return;
  }

  const keys = state.imageDecomposition.generationKeys.filter((entry) => entry !== nextKey && entry !== currentKey);
  state.imageDecomposition.generationKeys = [nextKey, ...keys];
}

function removeImageDecompositionGenerationKey(key) {
  const targetKey = String(key || "").trim();
  if (!targetKey) {
    return;
  }

  state.imageDecomposition.generationKeys = state.imageDecomposition.generationKeys.filter((entry) => entry !== targetKey);
  if (state.imageDecomposition.previewKey === targetKey) {
    state.imageDecomposition.previewKey = "";
  }
}

function getImageDecompositionGenerationPreviewEntries() {
  const entries = [];
  const seen = new Set();
  const addKey = (key) => {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey || seen.has(normalizedKey)) {
      return;
    }

    const item = getImageDecompositionGenerationItemByKey(normalizedKey);
    if (!item) {
      return;
    }

    seen.add(normalizedKey);
    entries.push({ key: normalizedKey, item });
  };

  state.imageDecomposition.generationKeys.forEach(addKey);
  sortGalleryItemsByCreatedAtDesc(state.jobs)
    .filter((job) => job.mode === "image-decomposition")
    .forEach((job) => addKey(makeJobPreviewKey(job.id)));
  sortGalleryItemsByCreatedAtDesc(state.gallery)
    .filter(
      (item) =>
        item.mode === "image-decomposition" ||
        item.generationMode === "image-decomposition" ||
        item.assetKind === "image-decomposition",
    )
    .forEach((item) => addKey(makeGalleryPreviewKey(item.filename)));

  return entries;
}

function syncImageDecompositionGenerationPreviewKey() {
  if (getImageDecompositionGenerationItemByKey(state.imageDecomposition.previewKey || "")) {
    return;
  }

  const fallback = getImageDecompositionGenerationPreviewEntries()[0];
  state.imageDecomposition.previewKey = fallback?.key || "";
}

function getImageDecompositionGenerationPreviewItem() {
  syncImageDecompositionGenerationPreviewKey();
  return getImageDecompositionGenerationItemByKey(state.imageDecomposition.previewKey || "");
}

function setImageDecompositionGenerationPreviewKey(key) {
  const nextKey = String(key || "").trim();
  if (!getImageDecompositionGenerationItemByKey(nextKey)) {
    return;
  }

  state.imageDecomposition.previewKey = nextKey;
  renderImageDecompositionGenerationPreview();
}

function setImageDecompositionGenerationPlaceholderText(message, hidden = false) {
  imageDecompositionLoadingShellNodes = null;
  refs.imageDecompositionGenerationPlaceholder.className = "image-decomposition-generation-placeholder preview-placeholder";
  refs.imageDecompositionGenerationPlaceholder.classList.toggle("hidden", hidden);
  refs.imageDecompositionGenerationPlaceholder.replaceChildren();
  if (!message) {
    return;
  }

  const title = document.createElement("h3");
  title.textContent = message;
  refs.imageDecompositionGenerationPlaceholder.appendChild(title);

  const detail = document.createElement("span");
  detail.textContent = "上传一张源图后开始生成，底部胶片条可快速切换结果。";
  refs.imageDecompositionGenerationPlaceholder.appendChild(detail);
}

function renderImageDecompositionGenerationLoading(item) {
  const placeholderState = {
    ...getPreviewPlaceholderState({
      item,
      imageUrl: "",
      prompt: item ? getDisplayPrompt(item) : "",
      runningCount: state.jobs.length,
      maxConcurrentTasks: state.limits.maxConcurrentTasksPerSession,
    }),
    eyebrow: "Image Decomposition",
    title: "拆解信息图生成中",
    detail: item?.statusText || "正在生成图片",
  };

  if (
    !imageDecompositionLoadingShellNodes ||
    !shouldReusePreviewLoadingShell(imageDecompositionLoadingShellNodes.state || {}, placeholderState)
  ) {
    imageDecompositionLoadingShellNodes = createPreviewLoadingShellNodes();
  }

  updatePreviewLoadingShell(imageDecompositionLoadingShellNodes, placeholderState);
  refs.imageDecompositionGenerationPlaceholder.className =
    "image-decomposition-generation-placeholder preview-placeholder preview-placeholder-loading";
  refs.imageDecompositionGenerationPlaceholder.classList.remove("hidden");

  if (
    refs.imageDecompositionGenerationPlaceholder.firstChild !== imageDecompositionLoadingShellNodes.eyebrow ||
    refs.imageDecompositionGenerationPlaceholder.lastChild !== imageDecompositionLoadingShellNodes.shell
  ) {
    refs.imageDecompositionGenerationPlaceholder.replaceChildren(
      imageDecompositionLoadingShellNodes.eyebrow,
      imageDecompositionLoadingShellNodes.shell,
    );
  }
}

function openImageDecompositionGeneratedPreview() {
  const item = getImageDecompositionGenerationPreviewItem();
  if (item && getImageUrl(item)) {
    openLightbox(item);
  }
}

function renderImageDecompositionGenerationPreview() {
  const item = getImageDecompositionGenerationPreviewItem();
  const imageUrl = item ? getImageUrl(item) : "";
  const isRunning = Boolean(item?.isRunning || (item?.started && !item?.filename));

  refs.imageDecompositionGenerationCanvas.classList.toggle("has-image", Boolean(imageUrl));
  refs.imageDecompositionGenerationCanvas.classList.toggle("is-running", isRunning && !imageUrl);
  if (imageUrl) {
    refs.imageDecompositionGenerationCanvas.setAttribute("role", "button");
    refs.imageDecompositionGenerationCanvas.setAttribute("aria-label", "查看图片拆解生成图");
    refs.imageDecompositionGenerationCanvas.tabIndex = 0;
  } else {
    refs.imageDecompositionGenerationCanvas.removeAttribute("role");
    refs.imageDecompositionGenerationCanvas.removeAttribute("aria-label");
    refs.imageDecompositionGenerationCanvas.tabIndex = -1;
  }

  if (imageUrl) {
    setImageDecompositionGenerationPlaceholderText("", true);
  } else if (isRunning) {
    renderImageDecompositionGenerationLoading(item);
  } else {
    setImageDecompositionGenerationPlaceholderText("拆解信息图会显示在这里");
  }

  if (imageUrl) {
    refs.imageDecompositionGenerationImage.src = imageUrl;
    refs.imageDecompositionGenerationImage.alt = getDisplayPrompt(item) || "图片拆解生成结果";
    refs.imageDecompositionGenerationImage.classList.add("is-mounted", "is-visible");
    refs.imageDecompositionGenerationDownloadButton.href = imageUrl;
    refs.imageDecompositionGenerationDownloadButton.download = item.filename || "image-decomposition.png";
    refs.imageDecompositionGenerationDownloadButton.classList.remove("disabled");
    refs.imageDecompositionGenerationDownloadButton.setAttribute("aria-disabled", "false");
    refs.imageDecompositionGenerationLightboxButton.disabled = false;
  } else {
    refs.imageDecompositionGenerationImage.removeAttribute("src");
    refs.imageDecompositionGenerationImage.classList.remove("is-mounted", "is-visible");
    refs.imageDecompositionGenerationDownloadButton.href = "#";
    refs.imageDecompositionGenerationDownloadButton.removeAttribute("download");
    refs.imageDecompositionGenerationDownloadButton.classList.add("disabled");
    refs.imageDecompositionGenerationDownloadButton.setAttribute("aria-disabled", "true");
    refs.imageDecompositionGenerationLightboxButton.disabled = true;
  }

  refs.imageDecompositionGenerationMeta.textContent = item
    ? [formatTime(item.createdAt), formatCanvasLabel(item.size), item.statusText || ""].filter(Boolean).join(" · ")
    : "等待生成";
  renderImageDecompositionGenerationStrip();
}

function renderImageDecompositionGenerationStrip() {
  const entries = getImageDecompositionGenerationPreviewEntries();
  refs.imageDecompositionGenerationStrip.replaceChildren();
  refs.imageDecompositionGenerationStrip.classList.toggle("hidden", entries.length === 0);
  refs.imageDecompositionThumbnailEmpty.classList.toggle("hidden", entries.length > 0);

  entries.forEach(({ key, item }, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filmstrip-item image-decomposition-generation-thumb";
    button.dataset.imageDecompositionGenerationKey = key;
    button.setAttribute("aria-pressed", String(key === state.imageDecomposition.previewKey));
    button.title = `切换到第 ${index + 1} 张图片拆解结果`;
    button.classList.toggle("active", key === state.imageDecomposition.previewKey);
    button.classList.toggle("is-running", Boolean(item?.isRunning || (item?.started && !item?.filename)));

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
      ghost.textContent = item?.isRunning || item?.started ? "生成中" : "等待";
      button.appendChild(ghost);
    }

    const caption = document.createElement("span");
    caption.textContent = formatFilmstripSizeLabel(item) || item?.statusText || formatClock(item?.createdAt);
    button.appendChild(caption);

    const shell = document.createElement("div");
    shell.className = "filmstrip-entry";
    shell.appendChild(button);
    refs.imageDecompositionGenerationStrip.appendChild(shell);
  });
}

async function preserveImageDecompositionGenerationItemForDelete(item) {
  if (!item?.filename) {
    return;
  }

  const key = makeGalleryPreviewKey(item.filename);
  const isTrackedImageDecompositionItem =
    item.mode === "image-decomposition" ||
    item.assetKind === "image-decomposition" ||
    state.imageDecomposition.generationKeys.includes(key) ||
    Boolean(state.imageDecomposition.generationItems[key]);
  if (!isTrackedImageDecompositionItem) {
    return;
  }

  const imageUrl = getImageUrl(item);
  if (!imageUrl || String(imageUrl).startsWith("data:image/")) {
    storeImageDecompositionGenerationItem(item);
    return;
  }

  try {
    const dataUrl = await fetchServerImageAsDataUrl(imageUrl);
    if (dataUrl) {
      storeImageDecompositionGenerationItem({
        ...item,
        imageUrl: dataUrl,
        thumbnailUrl: dataUrl,
      });
      return;
    }
  } catch (_error) {
    // Keep existing metadata if the image cannot be copied before deletion.
  }

  storeImageDecompositionGenerationItem(item);
}

function createImageDecompositionGenerationFile(item) {
  return item?.generationFile || item?.file;
}

function syncImageDecompositionLanguageUI() {
  const isCustom = refs.imageDecompositionLanguageInput.value === "custom";
  refs.imageDecompositionCustomLanguageField.classList.toggle("hidden", !isCustom);
  refs.imageDecompositionCustomLanguageInput.disabled = !isCustom;
}

function renderImageDecompositionSource() {
  const item = state.imageDecomposition.file;
  refs.imageDecompositionCount.textContent = item ? "1 / 1" : "0 / 1";
  syncReferenceDropzoneCompact(refs.imageDecompositionDropzone, Boolean(item));
  refs.imageDecompositionGrid.classList.toggle("hidden", !item);
  refs.imageDecompositionGrid.replaceChildren();

  if (!item) {
    return;
  }

  const card = document.createElement("div");
  card.className = "reference-card";

  const previewButton = document.createElement("button");
  previewButton.type = "button";
  previewButton.className = "reference-preview-button";
  previewButton.dataset.imageDecompositionPreviewId = item.id;
  previewButton.setAttribute("aria-label", "放大查看源图");

  const image = document.createElement("img");
  image.src = item.previewUrl;
  image.alt = "源图预览";
  previewButton.appendChild(image);
  card.appendChild(previewButton);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "reference-remove";
  remove.textContent = "x";
  remove.setAttribute("aria-label", "移除源图");
  remove.addEventListener("click", () => removeImageDecompositionFile());
  card.appendChild(remove);

  refs.imageDecompositionGrid.appendChild(card);
}

function createImageDecompositionGenerationItem(file) {
  return createImageDecompositionItem(file);
}

function applyImageDecompositionFile(fileList) {
  const incomingFiles = [...(fileList || [])].filter((file) => file.type.startsWith("image/"));
  if (incomingFiles.length === 0) {
    return;
  }

  if (incomingFiles.length !== 1) {
    setImageDecompositionFeedback("图片拆解模式一次只能上传一张源图。", "error");
    return;
  }

  const file = incomingFiles[0];
  if (state.imageDecomposition.file?.fingerprint === buildReferenceFingerprint(file)) {
    return;
  }

  const nextItem = createImageDecompositionGenerationItem(file);
  startImageDecompositionGenerationCompression(nextItem);
  if (state.imageDecomposition.file) {
    revokeReferencePreview(state.imageDecomposition.file);
  }
  state.imageDecomposition.file = nextItem;
  refs.imageDecompositionInput.value = "";
  setImageDecompositionFeedback("", "");
  renderImageDecompositionView();
}

function removeImageDecompositionFile() {
  const target = state.imageDecomposition.file;
  if (!target) {
    return;
  }

  if (state.imageDecompositionPreviewItem?.id === target.id) {
    closeReferencePreview();
  }

  revokeReferencePreview(target);
  state.imageDecomposition.file = null;
  refs.imageDecompositionInput.value = "";
  renderImageDecompositionView();
}

function openImageDecompositionPreview(referenceId) {
  const item = state.imageDecomposition.file;
  if (item?.id !== referenceId || !item.previewUrl) {
    return;
  }

  state.imageDecompositionPreviewItem = item;
  refs.referencePreviewImage.src = item.previewUrl;
  refs.referencePreviewViewer.classList.add("open");
  refs.referencePreviewViewer.setAttribute("aria-hidden", "false");
}

function syncImageDecompositionRatio(value) {
  const nextValue = getRatioOption(value)?.value || DEFAULT_UI_RATIO;
  refs.imageDecompositionRatioInput.value = nextValue;
  renderImageDecompositionRatioGrid();
  renderImageDecompositionSizeOptions();
}

function renderImageDecompositionRatioGrid() {
  renderRatioGrid(refs.imageDecompositionRatioGrid, refs.imageDecompositionRatioInput, syncImageDecompositionRatio);
}

function renderImageDecompositionSizeOptions() {
  renderSizeOptions(refs.imageDecompositionSizeInput, refs.imageDecompositionRatioInput);
}

function syncImageDecompositionSize(value) {
  const ratioValue = refs.imageDecompositionRatioInput.value || DEFAULT_UI_RATIO;
  refs.imageDecompositionSizeInput.value = normalizeGenerationSize(ratioValue, value || "auto");
}

function createImageDecompositionJob() {
  const ratioOption = getRatioOption(refs.imageDecompositionRatioInput.value || DEFAULT_UI_RATIO);
  const sourceItem = state.imageDecomposition.file;
  const sizeSetting = normalizeGenerationSize(ratioOption.value, refs.imageDecompositionSizeInput.value || "auto");
  const size = sizeSetting === "auto" ? ratioOption?.baseSize || getDefaultGenerationSize(ratioOption?.value) : sizeSetting;

  return {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: nowIso(),
    mode: "image-decomposition",
    prompt: "图片拆解信息图",
    targetLanguage: refs.imageDecompositionLanguageInput.value,
    customTargetLanguage: refs.imageDecompositionCustomLanguageInput.value.trim(),
    featureCardsEnabled: refs.imageDecompositionFeatureCardsInput.value === "on",
    ratio: ratioOption?.value || DEFAULT_UI_RATIO,
    ratioLabel: ratioOption?.label || DEFAULT_UI_RATIO_LABEL,
    sizeSetting,
    size,
    quality: state.config?.defaults?.quality || "high",
    format: normalizeOutputFormat(refs.outputFormatInput.value || state.config?.defaults?.format || "png"),
    baseUrl: state.config?.baseUrl || refs.baseUrlInput.value.trim(),
    responsesModel: state.config?.responsesModel || refs.responsesModelInput.value.trim() || "gpt-5.4",
    imageModel: "gpt-image-2",
    reasoningEffort: refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh",
    requestRetryCount: 0,
    referenceFiles: sourceItem ? [createImageDecompositionGenerationFile(sourceItem)] : [],
    hasReferenceImage: Boolean(sourceItem),
    referenceImageName: sourceItem?.file?.name || "",
    referenceImageNames: sourceItem?.file?.name ? [sourceItem.file.name] : [],
    isRunning: false,
    started: false,
    statusStage: "queued",
    statusText: "等待排队",
    previewUrl: "",
  };
}

async function startImageDecompositionGeneration() {
  clearError();

  if (!state.imageDecomposition.file?.file) {
    setImageDecompositionFeedback("请先上传一张源图。", "error");
    return;
  }

  const targetLanguage = String(refs.imageDecompositionLanguageInput.value || "").trim();
  const customLanguage = String(refs.imageDecompositionCustomLanguageInput.value || "").trim();
  if (targetLanguage === "custom" && !customLanguage) {
    setImageDecompositionFeedback("请填写自定义语言。", "error");
    return;
  }

  if (getQueuedJobCount() >= getMaxQueuedJobCount()) {
    setImageDecompositionFeedback(`同一会话最多排队 ${getMaxQueuedJobCount()} 个生成任务。`, "error");
    return;
  }

  await ensureImageDecompositionGenerationFilesReady();
  const job = createImageDecompositionJob();
  registerImageDecompositionGenerationKey(makeJobPreviewKey(job.id));
  state.jobs.unshift(job);
  state.imageDecomposition.previewKey = makeJobPreviewKey(job.id);
  state.selectedPreviewKey = makeJobPreviewKey(job.id);
  recordJobQueued(job);
  setImageDecompositionFeedback("图片拆解任务已提交，正在生成...", "busy");
  renderAll();
  setActiveView("image-decomposition");
  scheduleGenerationQueue();
}

function renderImageDecompositionView() {
  syncImageDecompositionLanguageUI();
  renderImageDecompositionSource();
  renderImageDecompositionGenerationPreview();
  refs.imageDecompositionGenerateButton.disabled =
    !state.imageDecomposition.file || hasPendingImageDecompositionGenerationFiles() || getQueuedJobCount() >= getMaxQueuedJobCount();
  refs.imageDecompositionGenerateButton.textContent = hasPendingImageDecompositionGenerationFiles()
    ? "处理中..."
    : getQueuedJobCount() > 0
      ? "继续生成"
      : "开始拆解";
}

function openReferenceAnalysisPreview(referenceId) {
  const item = state.referenceAnalysis.files.find((entry) => entry.id === referenceId);
  if (!item?.previewUrl) {
    return;
  }

  state.referenceAnalysisPreviewItem = item;
  refs.referencePreviewImage.src = item.previewUrl;
  refs.referencePreviewViewer.classList.add("open");
  refs.referencePreviewViewer.setAttribute("aria-hidden", "false");
}

function syncReferenceDropzoneCompact(dropzone, hasFiles) {
  if (!dropzone) {
    return;
  }

  dropzone.classList.toggle("is-compact-hidden", Boolean(hasFiles));
}

function createReferenceAddCard({ input, label, onFiles }) {
  const card = document.createElement("div");
  card.className = "reference-card reference-add-card";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "reference-add-button";
  button.textContent = "+";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", () => input?.click());

  card.addEventListener("dragover", (event) => {
    event.preventDefault();
    card.classList.add("dragover");
  });
  card.addEventListener("dragleave", () => {
    card.classList.remove("dragover");
  });
  card.addEventListener("drop", (event) => {
    event.preventDefault();
    card.classList.remove("dragover");
    onFiles?.(event.dataTransfer?.files);
  });

  card.appendChild(button);
  return card;
}

function normalizeStyleTransferPresetValue(value) {
  const candidate = String(value || "").trim();
  return STYLE_TRANSFER_PRESETS.some((preset) => preset.value === candidate) ? candidate : STYLE_TRANSFER_DEFAULT_PRESET;
}

function getStyleTransferPreset(value = state.styleTransfer.selectedPreset) {
  const normalizedValue = normalizeStyleTransferPresetValue(value);
  return STYLE_TRANSFER_PRESETS.find((preset) => preset.value === normalizedValue) || STYLE_TRANSFER_PRESETS[0];
}

function hasSelectedStyleTransferPreset() {
  return getStyleTransferPreset()?.value !== STYLE_TRANSFER_CUSTOM_PRESET;
}

function getStyleTransferPresetFileName(preset) {
  const raw = String(preset?.value || "style-preset").replace(/[^a-z0-9-]+/gi, "-") || "style-preset";
  return `${raw}-style-reference.png`;
}

function loadStyleTransferPresetImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("预设风格图加载失败。"));
    image.decoding = "async";
    image.src = src;
  });
}

async function createStyleTransferPresetReferenceFile(preset) {
  if (!preset?.image) {
    return null;
  }

  const image = await loadStyleTransferPresetImage(preset.image);
  const sourceWidth = image.naturalWidth || STYLE_TRANSFER_PRESET_REFERENCE_SIZE;
  const sourceHeight = image.naturalHeight || Math.round((STYLE_TRANSFER_PRESET_REFERENCE_SIZE * 3) / 4);
  const width = STYLE_TRANSFER_PRESET_REFERENCE_SIZE;
  const height = Math.max(1, Math.round((width * sourceHeight) / sourceWidth));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("预设风格图准备失败。");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, "image/png");
  return new File([blob], getStyleTransferPresetFileName(preset), {
    type: "image/png",
    lastModified: Date.now(),
  });
}

async function ensureStyleTransferPresetReferenceFileReady() {
  const preset = getStyleTransferPreset();
  if (!preset || preset.value === STYLE_TRANSFER_CUSTOM_PRESET) {
    state.styleTransfer.presetReferenceFile = null;
    state.styleTransfer.presetReferenceFileKey = "";
    return null;
  }

  if (state.styleTransfer.presetReferenceFile && state.styleTransfer.presetReferenceFileKey === preset.value) {
    return state.styleTransfer.presetReferenceFile;
  }

  const file = await createStyleTransferPresetReferenceFile(preset);
  state.styleTransfer.presetReferenceFile = file;
  state.styleTransfer.presetReferenceFileKey = preset.value;
  return file;
}

function getStyleTransferPresetReferenceFile() {
  return hasSelectedStyleTransferPreset() ? state.styleTransfer.presetReferenceFile : null;
}

function createStyleTransferComparisonCard({ label, src, alt }) {
  const card = document.createElement("div");
  card.className = "style-transfer-comparison-card";

  const caption = document.createElement("span");
  caption.className = "style-transfer-comparison-label";
  caption.textContent = label;
  card.appendChild(caption);

  const frame = document.createElement("div");
  frame.className = "style-transfer-comparison-frame";
  const image = document.createElement("img");
  image.loading = "lazy";
  image.decoding = "async";
  image.src = src;
  image.alt = alt;
  frame.appendChild(image);
  card.appendChild(frame);
  return card;
}

function renderStyleTransferPresetOptions() {
  if (!refs.styleTransferPresetInput) {
    return;
  }

  const selectedValue = normalizeStyleTransferPresetValue(state.styleTransfer.selectedPreset);
  if (refs.styleTransferPresetInput.options.length !== STYLE_TRANSFER_PRESETS.length) {
    refs.styleTransferPresetInput.replaceChildren(
      ...STYLE_TRANSFER_PRESETS.map((preset) => {
        const option = document.createElement("option");
        option.value = preset.value;
        option.textContent = preset.label;
        return option;
      }),
    );
  }
  refs.styleTransferPresetInput.value = selectedValue;
}

function renderStyleTransferPresetPreview() {
  renderStyleTransferPresetOptions();
  const preset = getStyleTransferPreset();
  const showPreview = Boolean(preset.beforeImage && preset.image);
  refs.styleTransferPresetPreview?.classList.toggle("hidden", !preset);
  refs.styleTransferPresetComparison?.classList.toggle("hidden", !showPreview);
  if (refs.styleTransferPresetLabel) {
    refs.styleTransferPresetLabel.textContent = preset?.label || "";
  }
  if (refs.styleTransferPresetDescription) {
    refs.styleTransferPresetDescription.textContent = preset?.description || "";
  }
  if (refs.styleTransferPresetComparison) {
    refs.styleTransferPresetComparison.replaceChildren();
    if (showPreview) {
      refs.styleTransferPresetComparison.append(
        createStyleTransferComparisonCard({
          label: "风格前",
          src: preset.beforeImage,
          alt: `${preset.label} 风格前示意图`,
        }),
        createStyleTransferComparisonCard({
          label: "风格后",
          src: preset.image,
          alt: `${preset.label} 风格后示意图`,
        }),
      );
    }
  }
  refs.styleTransferUploadGrid?.classList.toggle("uses-preset-style", hasSelectedStyleTransferPreset());
}

function handleStyleTransferPresetChange(event) {
  state.styleTransfer.selectedPreset = normalizeStyleTransferPresetValue(event.target.value);
  state.styleTransfer.presetReferenceFile = null;
  state.styleTransfer.presetReferenceFileKey = "";
  renderStyleTransferReferences();
  updateGenerateButton();
}

function renderReferenceAnalysisGrid() {
  refs.referenceAnalysisGrid.replaceChildren();
  refs.referenceAnalysisCount.textContent = `${state.referenceAnalysis.files.length} / ${state.limits.maxReferenceImages}`;
  syncReferenceDropzoneCompact(refs.referenceAnalysisDropzone, state.referenceAnalysis.files.length > 0);
  refs.referenceAnalysisGrid.classList.toggle("hidden", state.referenceAnalysis.files.length === 0);

  state.referenceAnalysis.files.forEach((item) => {
    const card = document.createElement("div");
    card.className = "reference-card";

    const previewButton = document.createElement("button");
    previewButton.type = "button";
    previewButton.className = "reference-preview-button";
    previewButton.dataset.referenceAnalysisPreviewId = item.id;
    previewButton.setAttribute("aria-label", "放大查看待分析图片");

    const image = document.createElement("img");
    image.src = item.previewUrl;
    image.alt = "待分析图片预览";
    previewButton.appendChild(image);
    card.appendChild(previewButton);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "reference-remove";
    remove.textContent = "x";
    remove.setAttribute("aria-label", "移除待分析图片");
    remove.addEventListener("click", () => removeReferenceAnalysisFile(item.id));
    card.appendChild(remove);

    refs.referenceAnalysisGrid.appendChild(card);
  });

  if (state.referenceAnalysis.files.length > 0 && state.referenceAnalysis.files.length < state.limits.maxReferenceImages) {
    refs.referenceAnalysisGrid.appendChild(
      createReferenceAddCard({
        input: refs.referenceAnalysisInput,
        label: "继续上传待分析图片",
        onFiles: applyReferenceAnalysisFiles,
      }),
    );
  }
}

function createStyleTransferReferenceItem(slot, file) {
  return {
    id: `style-transfer-${slot}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    slot,
    fingerprint: buildReferenceFingerprint(file),
    file,
    generationFile: file,
    generationFilePromise: null,
    generationCompressed: false,
    previewUrl: URL.createObjectURL(file),
  };
}

function applyStyleTransferReferenceFile(slot, fileList) {
  const imageFiles = [...(fileList || [])].filter((item) => item.type.startsWith("image/"));
  if (imageFiles.length === 0) {
    showError("请选择一张图片。");
    return;
  }
  if (imageFiles.length > 1) {
    showError("原图和风格参考图每个区域只能上传一张图片。");
    return;
  }

  const file = imageFiles[0];

  const current = getStyleTransferReferenceItem(slot);
  const nextFingerprint = buildReferenceFingerprint(file);
  if (current?.fingerprint === nextFingerprint) {
    refs[slot === "style" ? "styleTransferStyleInput" : "styleTransferSourceInput"].value = "";
    return;
  }

  if (state.styleTransferPreviewItem?.id === current?.id) {
    closeReferencePreview();
  }
  revokeReferencePreview(current);
  const nextItem = createStyleTransferReferenceItem(slot, file);
  state.styleTransfer[slot === "style" ? "style" : "source"] = nextItem;
  refs[slot === "style" ? "styleTransferStyleInput" : "styleTransferSourceInput"].value = "";
  startStyleTransferGenerationCompression(nextItem);
  renderStyleTransferReferences();
  updateGenerateButton();
}

function removeStyleTransferReference(slot) {
  const key = slot === "style" ? "style" : "source";
  const target = state.styleTransfer[key];
  if (state.styleTransferPreviewItem?.id === target?.id) {
    closeReferencePreview();
  }
  revokeReferencePreview(target);
  state.styleTransfer[key] = null;
  renderStyleTransferReferences();
  updateGenerateButton();
}

function openStyleTransferPreview(slot) {
  const item = getStyleTransferReferenceItem(slot);
  if (!item?.previewUrl) {
    return;
  }

  closeReferencePreview();
  state.styleTransferPreviewItem = item;
  refs.referencePreviewImage.src = item.previewUrl;
  refs.referencePreviewViewer.classList.add("open");
  refs.referencePreviewViewer.setAttribute("aria-hidden", "false");
}

function renderStyleTransferReferenceSlot(slot, grid) {
  if (!grid) {
    return;
  }

  const item = getStyleTransferReferenceItem(slot);
  grid.replaceChildren();
  grid.classList.toggle("hidden", !item);
  if (!item) {
    return;
  }

  const card = document.createElement("div");
  card.className = "reference-card";

  const previewButton = document.createElement("button");
  previewButton.type = "button";
  previewButton.className = "reference-preview-button";
  previewButton.dataset.styleTransferPreviewRole = slot;
  previewButton.setAttribute("aria-label", slot === "style" ? "放大查看风格参考图" : "放大查看原图");
  previewButton.addEventListener("click", () => openStyleTransferPreview(slot));

  const image = document.createElement("img");
  image.src = item.previewUrl;
  image.alt = slot === "style" ? "风格参考图预览" : "原图预览";
  previewButton.appendChild(image);
  card.appendChild(previewButton);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "reference-remove";
  remove.textContent = "x";
  remove.setAttribute("aria-label", slot === "style" ? "移除风格参考图" : "移除原图");
  remove.addEventListener("click", () => removeStyleTransferReference(slot));
  card.appendChild(remove);

  grid.appendChild(card);
}

function renderStyleTransferReferences() {
  renderStyleTransferPresetPreview();
  syncReferenceDropzoneCompact(refs.styleTransferSourceDropzone, Boolean(getStyleTransferReferenceItem("source")));
  syncReferenceDropzoneCompact(refs.styleTransferStyleDropzone, Boolean(getStyleTransferReferenceItem("style")));
  renderStyleTransferReferenceSlot("source", refs.styleTransferSourceGrid);
  renderStyleTransferReferenceSlot("style", refs.styleTransferStyleGrid);
}

function renderReferenceGrid() {
  refs.referenceGrid.innerHTML = "";
  refs.referenceCount.textContent = `${state.referenceFiles.length} / ${state.limits.maxReferenceImages}`;
  syncReferenceDropzoneCompact(refs.referenceDropzone, state.referenceFiles.length > 0);
  refs.referenceGrid.classList.toggle("hidden", state.referenceFiles.length === 0);

  state.referenceFiles.forEach((item) => {
    const card = document.createElement("div");
    card.className = "reference-card";

    const previewButton = document.createElement("button");
    previewButton.type = "button";
    previewButton.className = "reference-preview-button";
    previewButton.dataset.referencePreviewId = item.id;
    previewButton.setAttribute("aria-label", "放大查看参考图");

    const image = document.createElement("img");
    image.src = item.previewUrl;
    image.alt = "参考图预览";
    previewButton.appendChild(image);
    card.appendChild(previewButton);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "reference-remove";
    remove.textContent = "x";
    remove.setAttribute("aria-label", "移除参考图");
    remove.addEventListener("click", () => removeReferenceFile(item.id));
    card.appendChild(remove);
    refs.referenceGrid.appendChild(card);
  });

  if (state.referenceFiles.length > 0 && state.referenceFiles.length < state.limits.maxReferenceImages) {
    refs.referenceGrid.appendChild(
      createReferenceAddCard({
        input: refs.referenceInput,
        label: "继续上传参考图",
        onFiles: applyReferenceFiles,
      }),
    );
  }
}

function getReferenceAnalysisPrompts(item = state.referenceAnalysis.result) {
  const prompts = Array.isArray(item?.json?.prompts)
    ? item.json.prompts
        .map((entry) => ({
          title: String(entry?.title || "编排提示词").trim(),
          intent: String(entry?.intent || "").trim(),
          prompt: String(entry?.prompt || "").trim(),
        }))
        .filter((entry) => entry.prompt)
        .slice(0, 3)
    : [];
  const fallbackPrompt = getPromptAgentPrompt(item);

  return prompts.length > 0
    ? prompts
    : fallbackPrompt
      ? [
          {
            title: item?.json?.title || "编排提示词",
            intent: "",
            prompt: fallbackPrompt,
          },
        ]
      : [];
}

function setReferenceAnalysisFeedback(message, kind = "") {
  refs.referenceAnalysisFeedback.textContent = message ? compactErrorMessage(message, "参考图分析失败") : "";
  refs.referenceAnalysisFeedback.dataset.state = kind;
}

function markReferenceAnalysisDirty() {
  if (state.referenceAnalysis.result) {
    state.referenceAnalysis.dirty = true;
    state.referenceAnalysis.previewKey = "";
    state.referenceAnalysis.selectedPrompt = "";
    setReferenceAnalysisFeedback("参考图已变化，请重新分析。", "busy");
  } else {
    setReferenceAnalysisFeedback("", "");
  }
  renderReferenceAnalysisSelectedPrompt();
}

function toggleReferenceAnalysisPanel() {
  if (!state.referenceAnalysis.result?.json) {
    return;
  }

  state.referenceAnalysis.collapsed = !state.referenceAnalysis.collapsed;
  renderReferenceAnalysis();
}

function toggleReferenceAnalysisAutoCollapse() {
  state.referenceAnalysis.autoCollapseOnApply = !state.referenceAnalysis.autoCollapseOnApply;
  renderReferenceAnalysisSelectedPrompt();
}

function createReferenceAnalysisCard(option, index) {
  const card = document.createElement("article");
  card.className = "reference-analysis-card";

  const title = document.createElement("strong");
  title.textContent = option.title || `编排提示词 ${index + 1}`;

  const intent = document.createElement("span");
  intent.textContent = option.intent || "可直接应用到主提示词";

  const prompt = document.createElement("p");
  prompt.textContent = option.prompt;

  const button = document.createElement("button");
  button.className = "inline-button";
  button.type = "button";
  button.dataset.referenceAnalysisPromptIndex = String(index);
  button.textContent = "选用";

  card.append(title, intent, prompt, button);
  return card;
}

function getReferenceAnalysisGenerationItemByKey(key) {
  if (key.startsWith("job:")) {
    return state.jobs.find((job) => job.id === key.slice(4) && job.mode === "reference-analysis") || null;
  }

  if (key.startsWith("file:")) {
    return state.referenceAnalysis.generationItems[key] || state.gallery.find((item) => item.filename === key.slice(5)) || null;
  }

  return null;
}

function storeReferenceAnalysisGenerationItem(item) {
  const filename = String(item?.filename || "").trim();
  if (!filename) {
    return "";
  }

  const key = makeGalleryPreviewKey(filename);
  const current = state.referenceAnalysis.generationItems[key] || {};
  state.referenceAnalysis.generationItems[key] = {
    ...current,
    ...item,
    mode: "reference-analysis",
  };
  return key;
}

function registerReferenceAnalysisGenerationKey(key) {
  const nextKey = String(key || "").trim();
  if (!nextKey) {
    return;
  }

  state.referenceAnalysis.generationKeys = [
    nextKey,
    ...state.referenceAnalysis.generationKeys.filter((entry) => entry !== nextKey),
  ];
}

function replaceReferenceAnalysisGenerationKey(oldKey, newKey) {
  const currentKey = String(oldKey || "").trim();
  const nextKey = String(newKey || "").trim();
  if (!nextKey) {
    return;
  }

  const keys = state.referenceAnalysis.generationKeys.filter((entry) => entry !== nextKey);
  const index = keys.indexOf(currentKey);
  if (index >= 0) {
    keys[index] = nextKey;
    state.referenceAnalysis.generationKeys = keys;
    return;
  }

  state.referenceAnalysis.generationKeys = [nextKey, ...keys];
}

function removeReferenceAnalysisGenerationKey(key) {
  const targetKey = String(key || "").trim();
  if (!targetKey) {
    return;
  }

  state.referenceAnalysis.generationKeys = state.referenceAnalysis.generationKeys.filter((entry) => entry !== targetKey);
  if (state.referenceAnalysis.previewKey === targetKey) {
    state.referenceAnalysis.previewKey = "";
  }
}

function getReferenceAnalysisGenerationPreviewEntries() {
  const entries = [];
  const seen = new Set();
  const addKey = (key) => {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey || seen.has(normalizedKey)) {
      return;
    }

    const item = getReferenceAnalysisGenerationItemByKey(normalizedKey);
    if (!item) {
      return;
    }

    seen.add(normalizedKey);
    entries.push({ key: normalizedKey, item });
  };

  state.referenceAnalysis.generationKeys.forEach(addKey);
  sortGalleryItemsByCreatedAtDesc(state.jobs)
    .filter((job) => job.mode === "reference-analysis")
    .forEach((job) => addKey(makeJobPreviewKey(job.id)));

  return entries;
}

function syncReferenceAnalysisGenerationPreviewKey() {
  if (getReferenceAnalysisGenerationItemByKey(state.referenceAnalysis.previewKey || "")) {
    return;
  }

  const fallback = getReferenceAnalysisGenerationPreviewEntries()[0];
  state.referenceAnalysis.previewKey = fallback?.key || "";
}

function getReferenceAnalysisGenerationPreviewItem() {
  syncReferenceAnalysisGenerationPreviewKey();
  return getReferenceAnalysisGenerationItemByKey(state.referenceAnalysis.previewKey || "");
}

function setReferenceAnalysisGenerationPreviewKey(key) {
  const nextKey = String(key || "").trim();
  if (!getReferenceAnalysisGenerationItemByKey(nextKey)) {
    return;
  }

  state.referenceAnalysis.previewKey = nextKey;
  renderReferenceAnalysisSelectedPrompt();
}

function renderReferenceAnalysisGenerationStrip() {
  const entries = getReferenceAnalysisGenerationPreviewEntries();
  refs.referenceAnalysisGenerationStrip.replaceChildren();
  refs.referenceAnalysisGenerationStrip.classList.toggle("hidden", entries.length === 0);
  refs.referenceAnalysisThumbnailEmpty.classList.toggle("hidden", entries.length > 0);

  entries.forEach(({ key, item }, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reference-analysis-generation-thumb";
    button.dataset.referenceAnalysisGenerationKey = key;
    button.setAttribute("aria-pressed", String(key === state.referenceAnalysis.previewKey));
    button.title = `切换到第 ${index + 1} 张融图结果`;
    button.classList.toggle("active", key === state.referenceAnalysis.previewKey);
    button.classList.toggle("is-running", Boolean(item?.isRunning || (item?.started && !item?.filename)));

    const imageUrl = getImageUrl(item);
    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = getDisplayPrompt(item);
      image.loading = "lazy";
      button.appendChild(image);
    } else {
      const ghost = document.createElement("span");
      ghost.textContent = item?.isRunning || item?.started ? "生成中" : "等待";
      button.appendChild(ghost);
    }

    refs.referenceAnalysisGenerationStrip.appendChild(button);
  });
}

async function preserveReferenceAnalysisGenerationItemForDelete(item) {
  if (!item?.filename) {
    return;
  }

  const key = makeGalleryPreviewKey(item.filename);
  const isTrackedReferenceAnalysisItem =
    item.mode === "reference-analysis" ||
    state.referenceAnalysis.generationKeys.includes(key) ||
    Boolean(state.referenceAnalysis.generationItems[key]);
  if (!isTrackedReferenceAnalysisItem) {
    return;
  }

  const imageUrl = getImageUrl(item);
  if (!imageUrl || String(imageUrl).startsWith("data:image/")) {
    storeReferenceAnalysisGenerationItem(item);
    return;
  }

  try {
    const dataUrl = await fetchServerImageAsDataUrl(imageUrl);
    if (dataUrl) {
      storeReferenceAnalysisGenerationItem({
        ...item,
        imageUrl: dataUrl,
        thumbnailUrl: dataUrl,
      });
      return;
    }
  } catch (_error) {
    // Keep the existing item metadata if the image cannot be copied before deletion.
  }

  storeReferenceAnalysisGenerationItem(item);
}

function setReferenceAnalysisGenerationPlaceholderText(message, hidden = false) {
  referenceAnalysisLoadingShellNodes = null;
  refs.referenceAnalysisGenerationPlaceholder.className = "reference-analysis-generation-placeholder";
  refs.referenceAnalysisGenerationPlaceholder.classList.toggle("hidden", hidden);
  refs.referenceAnalysisGenerationPlaceholder.textContent = message;
}

function renderReferenceAnalysisGenerationLoading(item) {
  const placeholderState = {
    ...getPreviewPlaceholderState({
      item,
      imageUrl: "",
      prompt: item ? getDisplayPrompt(item) : "",
      runningCount: state.jobs.length,
      maxConcurrentTasks: state.limits.maxConcurrentTasksPerSession,
    }),
    eyebrow: "Reference Analysis",
    title: "提示词模式生成中",
    detail: item ? getDisplayPrompt(item) : "正在生成融图分析图片。",
  };

  if (
    !referenceAnalysisLoadingShellNodes ||
    !shouldReusePreviewLoadingShell(referenceAnalysisLoadingShellNodes.state || {}, placeholderState)
  ) {
    referenceAnalysisLoadingShellNodes = createPreviewLoadingShellNodes();
  }

  updatePreviewLoadingShell(referenceAnalysisLoadingShellNodes, placeholderState);
  refs.referenceAnalysisGenerationPlaceholder.className =
    "reference-analysis-generation-placeholder preview-placeholder preview-placeholder-loading";
  refs.referenceAnalysisGenerationPlaceholder.classList.remove("hidden");

  if (
    refs.referenceAnalysisGenerationPlaceholder.firstChild !== referenceAnalysisLoadingShellNodes.eyebrow ||
    refs.referenceAnalysisGenerationPlaceholder.lastChild !== referenceAnalysisLoadingShellNodes.shell
  ) {
    refs.referenceAnalysisGenerationPlaceholder.replaceChildren(
      referenceAnalysisLoadingShellNodes.eyebrow,
      referenceAnalysisLoadingShellNodes.shell,
    );
  }
}

function openReferenceAnalysisGeneratedPreview() {
  const item = getReferenceAnalysisGenerationPreviewItem();
  if (item && getImageUrl(item)) {
    openLightbox(item);
  }
}

function renderReferenceAnalysisGenerationPreview() {
  const item = getReferenceAnalysisGenerationPreviewItem();
  const imageUrl = item ? getImageUrl(item) : "";
  const isRunning = Boolean(item?.isRunning || (item?.started && !item?.filename));

  refs.referenceAnalysisGenerationCanvas.classList.toggle("has-image", Boolean(imageUrl));
  refs.referenceAnalysisGenerationCanvas.classList.toggle("is-running", isRunning && !imageUrl);
  if (imageUrl) {
    refs.referenceAnalysisGenerationCanvas.setAttribute("role", "button");
    refs.referenceAnalysisGenerationCanvas.setAttribute("aria-label", "查看融图分析生成图");
    refs.referenceAnalysisGenerationCanvas.tabIndex = 0;
  } else {
    refs.referenceAnalysisGenerationCanvas.removeAttribute("role");
    refs.referenceAnalysisGenerationCanvas.removeAttribute("aria-label");
    refs.referenceAnalysisGenerationCanvas.tabIndex = -1;
  }

  if (imageUrl) {
    setReferenceAnalysisGenerationPlaceholderText("", true);
  } else if (isRunning) {
    renderReferenceAnalysisGenerationLoading(item);
  } else {
    setReferenceAnalysisGenerationPlaceholderText("生成图展示框");
  }

  if (imageUrl) {
    refs.referenceAnalysisGenerationImage.src = imageUrl;
    refs.referenceAnalysisGenerationImage.alt = getDisplayPrompt(item) || "融图分析生成结果";
    refs.referenceAnalysisGenerationDownloadButton.href = imageUrl;
    refs.referenceAnalysisGenerationDownloadButton.download = item.filename || "reference-analysis.png";
    refs.referenceAnalysisGenerationDownloadButton.classList.remove("disabled");
    refs.referenceAnalysisGenerationDownloadButton.setAttribute("aria-disabled", "false");
  } else {
    refs.referenceAnalysisGenerationImage.removeAttribute("src");
    refs.referenceAnalysisGenerationDownloadButton.href = "#";
    refs.referenceAnalysisGenerationDownloadButton.removeAttribute("download");
    refs.referenceAnalysisGenerationDownloadButton.classList.add("disabled");
    refs.referenceAnalysisGenerationDownloadButton.setAttribute("aria-disabled", "true");
  }

  refs.referenceAnalysisGenerationMeta.textContent = item
    ? [formatTime(item.createdAt), formatCanvasLabel(item.size), item.statusText || ""].filter(Boolean).join(" · ")
    : "等待生成";
  renderReferenceAnalysisGenerationStrip();
}

function renderReferenceAnalysisSelectedPrompt() {
  const promptText = String(state.referenceAnalysis.selectedPrompt || "").trim();
  refs.referenceAnalysisSelectedPromptPanel.classList.toggle("hidden", !promptText);
  refs.referenceAnalysisSelectedPrompt.value = promptText;
  refs.referenceAnalysisCopyPromptButton.disabled = !promptText;
  const preparingReference = hasPendingReferenceAnalysisGenerationFiles();
  refs.referenceAnalysisGenerateButton.disabled =
    !promptText || preparingReference || getQueuedJobCount() >= getMaxQueuedJobCount();
  refs.referenceAnalysisGenerateButton.textContent = preparingReference
    ? "处理参考图..."
    : getQueuedJobCount() > 0
      ? "继续生成"
      : "开始生成";
  refs.referenceAnalysisAutoCollapseButton.classList.toggle("is-active", state.referenceAnalysis.autoCollapseOnApply);
  refs.referenceAnalysisAutoCollapseButton.setAttribute("aria-checked", String(state.referenceAnalysis.autoCollapseOnApply));
  renderReferenceAnalysisGenerationPreview();
}

function renderReferenceAnalysis() {
  refs.referenceAnalyzeButton.disabled = state.referenceAnalysis.running;
  refs.referenceAnalyzeButton.textContent = state.referenceAnalysis.running ? "分析中..." : "融图分析";
  renderReferenceAnalysisSelectedPrompt();

  const item = state.referenceAnalysis.result;
  refs.referenceAnalysisPanel.classList.toggle("hidden", !item?.json);
  refs.referenceAnalysisEmpty?.classList.toggle("hidden", Boolean(item?.json));
  refs.referenceAnalysisList.replaceChildren();

  if (!item?.json) {
    state.referenceAnalysis.collapsed = false;
    refs.referenceAnalysisSummary.textContent = "--";
    refs.referenceAnalysisMeta.textContent = "--";
    refs.referenceAnalysisToggleButton.classList.add("hidden");
    refs.referenceAnalysisToggleButton.disabled = true;
    refs.referenceAnalysisToggleButton.setAttribute("aria-expanded", "false");
    refs.referenceAnalysisToggleButton.textContent = "折叠提示词";
    refs.referenceAnalysisHead.classList.remove("hidden");
    refs.referenceAnalysisList.classList.remove("hidden");
    return;
  }

  const json = item.json;
  const prompts = getReferenceAnalysisPrompts(item);
  const roles = Array.isArray(json.image_roles) ? json.image_roles.filter(Boolean) : [];
  const risks = Array.isArray(json.risks) ? json.risks.filter(Boolean) : [];

  refs.referenceAnalysisSummary.textContent = json.summary || json.relationship || json.title || "已生成编排提示词";
  refs.referenceAnalysisMeta.textContent = [
    json.relationship,
    roles.length ? `${roles.length} 个参考角色` : "",
    state.referenceAnalysis.dirty ? "参考图已变化" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  refs.referenceAnalysisToggleButton.classList.remove("hidden");
  refs.referenceAnalysisToggleButton.disabled = false;
  refs.referenceAnalysisToggleButton.setAttribute("aria-expanded", String(!state.referenceAnalysis.collapsed));
  refs.referenceAnalysisToggleButton.textContent = state.referenceAnalysis.collapsed ? "展开提示词" : "折叠提示词";
  refs.referenceAnalysisHead.classList.toggle("hidden", state.referenceAnalysis.collapsed);
  refs.referenceAnalysisList.classList.toggle("hidden", state.referenceAnalysis.collapsed);

  if (roles.length > 0) {
    const roleGroup = document.createElement("div");
    roleGroup.className = "reference-analysis-roles";

    roles.slice(0, 6).forEach((role) => {
      const rolePill = document.createElement("span");
      rolePill.className = "reference-analysis-role";
      rolePill.textContent = role;
      roleGroup.append(rolePill);
    });

    refs.referenceAnalysisList.append(roleGroup);
  }

  prompts.forEach((option, index) => {
    refs.referenceAnalysisList.append(createReferenceAnalysisCard(option, index));
  });

  if (risks.length > 0) {
    const risk = document.createElement("p");
    risk.className = "reference-analysis-risk";
    risk.textContent = risks.join("；");
    refs.referenceAnalysisList.append(risk);
  }
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

function renderOutputFormatOptions() {
  const currentValue = normalizeOutputFormat(refs.outputFormatInput.value || state.config?.defaults?.format || "png");
  refs.outputFormatInput.innerHTML = "";

  getOutputFormatOptions().forEach((option) => {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    refs.outputFormatInput.appendChild(element);
  });

  refs.outputFormatInput.value = currentValue;
}

function syncGenerationSize(value) {
  const ratioValue = refs.ratioInput.value || DEFAULT_UI_RATIO;
  const nextValue = normalizeGenerationSize(ratioValue, value || "auto");
  refs.sizeInput.value = nextValue;
  if (refs.referenceAnalysisSizeInput) {
    refs.referenceAnalysisSizeInput.value = nextValue;
  }
}

function renderSizeOptions(sizeInput = refs.sizeInput, ratioInput = refs.ratioInput) {
  if (!sizeInput || !ratioInput) {
    return;
  }

  const ratioValue = ratioInput.value || DEFAULT_UI_RATIO;
  const currentValue = normalizeGenerationSize(ratioValue, sizeInput.value || "auto");
  sizeInput.innerHTML = "";

  getGenerationSizeOptions(ratioValue).forEach((option) => {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    sizeInput.appendChild(element);
  });

  sizeInput.value = currentValue;
}

function renderReferenceAnalysisSizeOptions() {
  renderSizeOptions(refs.referenceAnalysisSizeInput, refs.referenceAnalysisRatioInput);
}

function syncGenerationRatio(value) {
  const nextValue = getRatioOption(value)?.value || DEFAULT_UI_RATIO;
  refs.ratioInput.value = nextValue;
  if (refs.referenceAnalysisRatioInput) {
    refs.referenceAnalysisRatioInput.value = nextValue;
  }
  renderRatioGrid();
  renderReferenceAnalysisRatioGrid();
  renderSizeOptions();
  renderReferenceAnalysisSizeOptions();
  syncGenerationSize(refs.sizeInput.value);
}

function renderCreationRatioOptions() {
  const currentValue = refs.creationRatioInput.value || DEFAULT_UI_RATIO;
  const options = getVisibleRatios();
  refs.creationRatioInput.innerHTML = "";

  options.forEach((option) => {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.value;
    refs.creationRatioInput.appendChild(element);
  });

  refs.creationRatioInput.value = options.some((option) => option.value === currentValue)
    ? currentValue
    : DEFAULT_UI_RATIO;
  renderCreationSizeOptions();
}

function renderCreationSizeOptions() {
  const ratioValue = refs.creationRatioInput.value || DEFAULT_UI_RATIO;
  const currentValue = normalizeGenerationSize(ratioValue, refs.creationSizeInput.value || "auto");
  refs.creationSizeInput.innerHTML = "";

  getGenerationSizeOptions(ratioValue).forEach((option) => {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    refs.creationSizeInput.appendChild(element);
  });

  refs.creationSizeInput.value = currentValue;
}

function getSettingsFormScrollTop() {
  return refs.generateForm?.scrollTop || 0;
}

function restoreSettingsFormScrollTop(scrollTop) {
  if (!refs.generateForm || !Number.isFinite(scrollTop)) {
    return;
  }

  const restore = () => {
    refs.generateForm.scrollTop = scrollTop;
  };

  restore();
  window.requestAnimationFrame(restore);
}

function syncStudioHeight() {
  if (!refs.settingsPanel || !refs.previewPanel || !refs.viewRoot) {
    return;
  }

  const settingsScrollTop = getSettingsFormScrollTop();

  const isStudioLikeView =
    state.activeView === "studio" || state.activeView === "style-transfer" || state.activeView === "image-decomposition";
  if (STACKED_STUDIO_LAYOUT_MODES.has(getCurrentStudioLayoutMode()) || !isStudioLikeView) {
    document.documentElement.style.removeProperty("--studio-column-height");
    restoreSettingsFormScrollTop(settingsScrollTop);
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

  restoreSettingsFormScrollTop(settingsScrollTop);
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
  return normalizeGenerationSize(refs.ratioInput.value || DEFAULT_UI_RATIO, refs.sizeInput.value || "auto");
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

function renderRatioGrid(ratioGrid = refs.ratioGrid, ratioInput = refs.ratioInput, onSelect = syncGenerationRatio) {
  if (!ratioGrid || !ratioInput) {
    return;
  }

  ratioGrid.innerHTML = "";

  getVisibleRatios().forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ratio-chip";
    if (ratioInput.value === option.value) {
      button.classList.add("active");
    }

    const title = document.createElement("strong");
    title.textContent = option.value;
    button.appendChild(title);

    button.addEventListener("click", () => {
      onSelect(option.value);
    });

    ratioGrid.appendChild(button);
  });
}

function renderReferenceAnalysisRatioGrid() {
  renderRatioGrid(refs.referenceAnalysisRatioGrid, refs.referenceAnalysisRatioInput);
}

function syncConfigUi(config) {
  refs.baseUrlInput.value = config.baseUrl || "";
  refs.responsesModelInput.value = config.responsesModel || "gpt-5.5";
  refs.savedKeyMask.textContent = config.apiKeyConfigured ? `已保存 ${config.apiKeyMask || ""}` : "未保存";
  refs.configStatus.textContent = config.apiKeyConfigured ? "配置已保存" : "配置未保存";
  state.aspectRatios = config.aspectRatios || [];
  const configLimits = config.limits || {};
  state.limits = {
    ...DEFAULT_LIMITS,
    ...configLimits,
    maxConcurrentTasksPerSession:
      "maxConcurrentTasksPerSession" in configLimits
        ? configLimits.maxConcurrentTasksPerSession || DEFAULT_LIMITS.maxConcurrentTasksPerSession
        : DEFAULT_LIMITS.maxConcurrentTasksPerSession,
  };
  state.reasoningEfforts = [...(config.reasoningEfforts || DEFAULT_REASONING_EFFORTS)];

  if (!refs.ratioInput.value || !getRatioOption(refs.ratioInput.value)) {
    refs.ratioInput.value = DEFAULT_UI_RATIO;
  }
  if (refs.referenceAnalysisRatioInput) {
    refs.referenceAnalysisRatioInput.value = refs.ratioInput.value || DEFAULT_UI_RATIO;
  }
  if (refs.referenceAnalysisSizeInput) {
    refs.referenceAnalysisSizeInput.value = refs.sizeInput.value || "auto";
  }
  if (refs.imageDecompositionRatioInput && !refs.imageDecompositionRatioInput.value) {
    refs.imageDecompositionRatioInput.value = DEFAULT_UI_RATIO;
  }
  if (refs.imageDecompositionSizeInput && !refs.imageDecompositionSizeInput.value) {
    refs.imageDecompositionSizeInput.value = "auto";
  }

  renderRatioGrid();
  renderReferenceAnalysisRatioGrid();
  renderImageDecompositionRatioGrid();
  renderReasoningOptions();
  renderOutputFormatOptions();
  refs.creationOutputFormatInput.value = normalizeOutputFormat(
    refs.creationOutputFormatInput.value || config.defaults?.format || "png",
  );
  renderSizeOptions();
  renderReferenceAnalysisSizeOptions();
  renderImageDecompositionSizeOptions();
  renderCreationRatioOptions();
  syncConnectionState();
  updateGenerateButton();
  renderReferenceGrid();
  renderImageDecompositionView();
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
    syncLightboxCreationRecordActions();
    return;
  }

  const shouldResolveLightboxItem = !state.lightboxItem.isCreationRecordItem;
  const fresh =
    (shouldResolveLightboxItem && state.lightboxItem.filename && state.gallery.find((item) => item.filename === state.lightboxItem.filename)) ||
    (shouldResolveLightboxItem && state.lightboxItem.id && state.jobs.find((job) => job.id === state.lightboxItem.id)) ||
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
  syncLightboxCreationRecordActions(fresh);
  syncLightboxZoomState();
}

function getJobActivitySize(jobId) {
  return state.jobs.find((job) => job.id === jobId)?.size || "";
}

function getJobActivityRatio(jobId) {
  return state.jobs.find((job) => job.id === jobId)?.ratio || "";
}

function recordActivity({ key, title, detail, ratio, size, status, at }) {
  const nextAt = at || nowIso();
  const nextRatio = formatCompactRatioLabel(ratio);
  const nextSize = formatCompactSizeLabel(size);
  const existing = state.activityFeed.find((item) => item.key === key);
  state.activityFeed = upsertGenerationActivityEntry(state.activityFeed, {
    key,
    title,
    detail,
    ratio: nextRatio || existing?.ratio || "",
    size: nextSize || existing?.size || "",
    status,
    at: nextAt,
  });
  writeGenerationActivityFeed();
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
    key: `${job.id}:task`,
    title: GENERATION_TASK_STATUS_LABELS.running,
    detail: "等待资源分配",
    ratio: job.ratio,
    size: job.size,
    status: "active",
    at: job.createdAt,
  });
}

function handleActivityStatus(jobId, stage, message) {
  recordActivity({
    key: `${jobId}:task`,
    title: GENERATION_TASK_STATUS_LABELS.running,
    detail: message || (stage === "saving" ? "正在保存到本地图片目录" : "正在生成图片"),
    ratio: getJobActivityRatio(jobId),
    size: getJobActivitySize(jobId),
    status: "active",
    at: nowIso(),
  });
}

function handleActivityPartial(jobId) {
  recordActivity({
    key: `${jobId}:task`,
    title: GENERATION_TASK_STATUS_LABELS.running,
    detail: "已收到中途预览",
    ratio: getJobActivityRatio(jobId),
    size: getJobActivitySize(jobId),
    status: "active",
    at: nowIso(),
  });
}

function handleActivityFinal(jobId) {
  recordActivity({
    key: `${jobId}:task`,
    title: GENERATION_TASK_STATUS_LABELS.running,
    detail: "正在写入本地 output",
    ratio: getJobActivityRatio(jobId),
    size: getJobActivitySize(jobId),
    status: "active",
    at: nowIso(),
  });
}

function handleActivitySuccess(jobId) {
  recordActivity({
    key: `${jobId}:task`,
    title: GENERATION_TASK_STATUS_LABELS.completed,
    detail: "图像已成功生成",
    ratio: getJobActivityRatio(jobId),
    size: getJobActivitySize(jobId),
    status: "done",
    at: nowIso(),
  });
}

function handleActivityFailure(jobId, message) {
  recordActivity({
    key: `${jobId}:task`,
    title: GENERATION_TASK_STATUS_LABELS.error,
    detail: compactErrorMessage(message, "生成请求失败"),
    ratio: getJobActivityRatio(jobId),
    size: getJobActivitySize(jobId),
    status: "error",
    at: nowIso(),
  });
}

function handleActivityCanceled(job) {
  recordActivity({
    key: `${job.id}:task`,
    title: "已取消",
    detail: `已取消排队任务 · ${compactTimelineText(job.prompt)}`,
    ratio: job.ratio,
    size: job.size,
    status: "pending",
    at: nowIso(),
  });
}

function recordGenerationTaskActivity(task) {
  const status = normalizeGenerationTaskStatus(task?.status);
  const statusText =
    status === "error"
      ? compactErrorMessage(task?.errorMessage || task?.statusText, "生成请求失败")
      : String(task?.statusText || "").trim();
  const promptText = compactTimelineText(task?.prompt);
  const detail = statusText ? `${statusText} · ${promptText}` : promptText;

  recordActivity({
    key: `${task.id}:task`,
    title: GENERATION_TASK_STATUS_LABELS[status],
    detail,
    ratio: formatCompactRatioLabel(task?.ratio),
    size: formatCompactSizeLabel(task?.size),
    status: GENERATION_TASK_TIMELINE_STATUS[status],
    at: task.updatedAt || task.createdAt,
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
        title: GENERATION_TASK_STATUS_LABELS.completed,
        detail: "图像已成功生成",
        ratio: current.ratio || current.json?.aspect_ratio,
        size: current.size,
        status: "done",
        at: current.createdAt,
      },
    ];
  }

  return [
    {
      key: "running:idle",
      title: GENERATION_TASK_STATUS_LABELS.running,
      detail: "等待任务开始",
      status: "pending",
      at: "",
    },
    {
      key: "completed:idle",
      title: GENERATION_TASK_STATUS_LABELS.completed,
      detail: "等待生成结果",
      status: "pending",
      at: "",
    },
    {
      key: "error:idle",
      title: GENERATION_TASK_STATUS_LABELS.error,
      detail: "暂无错误",
      status: "pending",
      at: "",
    },
  ];
}

function isTimelineAtTop() {
  return refs.timelineList.scrollTop <= 4;
}

function getTimelineItemSignature(item) {
  return [item.key, item.title, item.detail, item.ratio || "", item.size || "", item.status, item.at || ""].join("\u001f");
}

function countTimelineChanges(items) {
  if (!state.timelineHasRendered) {
    return 0;
  }

  return items.reduce((count, item) => {
    return state.timelineSignatures.get(item.key) === getTimelineItemSignature(item) ? count : count + 1;
  }, 0);
}

function getTimelineScrollAnchor() {
  const listRect = refs.timelineList.getBoundingClientRect();
  return [...refs.timelineList.children].reduce((anchor, row) => {
    if (anchor) {
      return anchor;
    }

    const rowRect = row.getBoundingClientRect();
    return rowRect.bottom >= listRect.top + 1
      ? { key: row.dataset.timelineKey, offset: rowRect.top - listRect.top }
      : null;
  }, null);
}

function restoreTimelineScrollAnchor(anchor, fallbackScrollTop) {
  if (!anchor?.key) {
    refs.timelineList.scrollTop = fallbackScrollTop;
    return;
  }

  const row = [...refs.timelineList.children].find((candidate) => candidate.dataset.timelineKey === anchor.key);
  if (!row) {
    refs.timelineList.scrollTop = fallbackScrollTop;
    return;
  }

  const rowRect = row.getBoundingClientRect();
  const listRect = refs.timelineList.getBoundingClientRect();
  refs.timelineList.scrollTop += rowRect.top - listRect.top - anchor.offset;
}

function setTimelineSignatures(items) {
  state.timelineSignatures = new Map(items.map((item) => [item.key, getTimelineItemSignature(item)]));
  state.timelineHasRendered = true;
}

function renderTimelineNewIndicator() {
  refs.timelineNewCount.textContent = String(state.timelineUnreadCount);
  refs.timelineNewIndicator.classList.toggle("hidden", state.timelineUnreadCount <= 0);
}

function handleTimelineScroll() {
  if (!isTimelineAtTop()) {
    return;
  }

  state.timelineUnreadCount = 0;
  renderTimelineNewIndicator();
}

function scrollTimelineToNewest() {
  refs.timelineList.scrollTo({ top: 0, behavior: "smooth" });
  state.timelineUnreadCount = 0;
  renderTimelineNewIndicator();
}

function renderTimeline() {
  const items = getTimelineItems();
  const isAtTop = isTimelineAtTop();
  const previousScrollTop = refs.timelineList.scrollTop;
  const scrollAnchor = isAtTop ? null : getTimelineScrollAnchor();
  const changedCount = countTimelineChanges(items);

  refs.timelineList.innerHTML = "";

  items.forEach((item) => {
    const row = document.createElement("li");
    row.className = `timeline-item ${item.status}`;
    row.dataset.timelineKey = item.key;

    const dot = document.createElement("span");
    dot.className = "timeline-dot";
    row.appendChild(dot);

    const copy = document.createElement("div");
    copy.className = "timeline-copy";

    const detail = document.createElement("span");
    detail.textContent = item.detail;
    copy.appendChild(detail);

    row.appendChild(copy);

    const ratio = document.createElement("span");
    ratio.className = "timeline-ratio";
    ratio.textContent = formatCompactRatioLabel(item.ratio);
    row.appendChild(ratio);

    const resolution = document.createElement("span");
    resolution.className = "timeline-resolution";
    resolution.textContent = formatCompactSizeLabel(item.size);
    row.appendChild(resolution);

    const time = document.createElement("time");
    time.textContent = formatClock(item.at);
    row.appendChild(time);

    refs.timelineList.appendChild(row);
  });

  if (isAtTop) {
    state.timelineUnreadCount = 0;
    refs.timelineList.scrollTop = 0;
  } else {
    restoreTimelineScrollAnchor(scrollAnchor, previousScrollTop);
    state.timelineUnreadCount += changedCount;
  }

  setTimelineSignatures(items);
  renderTimelineNewIndicator();
}

function createPreviewMotionNode() {
  const motion = document.createElement("div");
  motion.className = "preview-loading-motion";
  motion.setAttribute("aria-hidden", "true");

  const track = document.createElement("span");
  track.className = "preview-loading-track";

  const progress = document.createElement("span");
  progress.className = "preview-loading-progress";
  track.appendChild(progress);

  const signal = document.createElement("span");
  signal.className = "preview-loading-signal";

  motion.append(track, signal);

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
  const signature = steps.map((step) => `${step.key}:${step.state}:${step.label}`).join("|");
  if (container.dataset.stepsSignature === signature) {
    return;
  }

  container.replaceChildren();
  steps.forEach((step) => {
    const chip = document.createElement("span");
    chip.className = `preview-loading-step is-${step.state}`;
    chip.textContent = step.label;
    container.appendChild(chip);
  });
  container.dataset.stepsSignature = signature;
}

function updatePreviewLoadingShell(nodes, placeholderState) {
  const theme = getPreviewLoadingShellTheme(placeholderState);
  nodes.eyebrow.textContent = placeholderState.eyebrow;
  nodes.shell.dataset.stage = theme.stage;
  nodes.shell.dataset.jobs = String(placeholderState.activeJobCount);
  nodes.shell.style.setProperty("--loading-progress", theme.progress);
  nodes.shell.style.setProperty("--loading-progress-position", theme.progressPosition);
  nodes.shell.style.setProperty("--loading-sweep-duration", theme.sweepDuration);
  nodes.shell.style.setProperty("--loading-signal-duration", theme.signalDuration);
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
    label: formatFilmstripSizeLabel(job) || job.statusText || formatClock(job.createdAt),
  }));

  const recentGallery = sortGalleryItemsByCreatedAtDesc(state.gallery).slice(0, 12).map((item) => ({
    key: makeGalleryPreviewKey(item.filename),
    item,
    label: formatFilmstripSizeLabel(item) || formatClock(item.createdAt),
  }));

  return [...activeJobs, ...recentGallery].slice(0, 14);
}

function renderFilmstrip() {
  refs.filmstrip.innerHTML = "";

  getFilmstripItems().forEach(({ key, item, label }) => {
    const shell = document.createElement("div");
    shell.className = "filmstrip-entry";

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

    shell.appendChild(button);

    if (key.startsWith("job:") && isQueuedGenerationJob(item)) {
      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "filmstrip-cancel";
      cancelButton.textContent = "×";
      cancelButton.title = "取消排队任务";
      cancelButton.setAttribute("aria-label", "取消排队任务");
      cancelButton.addEventListener("click", (event) => {
        event.stopPropagation();
        cancelQueuedJob(item.id);
      });
      shell.appendChild(cancelButton);
    }

    refs.filmstrip.appendChild(shell);
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
    event.preventDefault();
    event.stopPropagation();
    downloadGalleryItem(item, image).catch((error) => {
      showError(error.message);
    });
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
  if (!refs.recentList || !refs.recentEmpty) {
    return;
  }

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

function normalizeArticleRecordColumnPreset(value) {
  const preset = Number(value);
  return ARTICLE_RECORD_COLUMN_PRESETS.includes(preset) ? preset : DEFAULT_ARTICLE_RECORD_COLUMN_PRESET;
}

function getArticleRecordColumnCount() {
  return normalizeArticleRecordColumnPreset(state.articleIllustration.recordColumnPreset);
}

function renderArticleRecordColumnPresetButtons() {
  const columnPreset = getArticleRecordColumnCount();
  state.articleIllustration.recordColumnPreset = columnPreset;
  refs.articleRecordColumnButtons.forEach((button) => {
    const isActive = normalizeArticleRecordColumnPreset(button.dataset.articleRecordColumnPreset) === columnPreset;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function getVisibleGalleryItems(overrides = {}) {
  return filterGalleryItems(state.gallery, getGalleryFilterSnapshot(overrides));
}

function getGallerySectionItemCount(sections) {
  return sections.reduce((total, section) => total + section.items.length, 0);
}

function getSearchGalleryPagination(sections) {
  return {
    page: 0,
    pageSize: sections.length || 1,
    totalPages: 1,
    totalSections: sections.length,
    startSection: sections.length === 0 ? 0 : 1,
    endSection: sections.length,
    hasPrevious: false,
    hasNext: false,
    sections,
  };
}

function renderGalleryPagination(pagination, shouldPaginateHistory) {
  if (
    !refs.galleryPagination ||
    !refs.galleryPreviousPageButton ||
    !refs.galleryNextPageButton ||
    !refs.galleryPageStatus
  ) {
    return;
  }

  const isHidden = !shouldPaginateHistory || pagination.totalPages <= 1;
  refs.galleryPagination.classList.toggle("hidden", isHidden);
  refs.galleryPreviousPageButton.disabled = !pagination.hasPrevious;
  refs.galleryNextPageButton.disabled = !pagination.hasNext;
  refs.galleryPageStatus.textContent = `第 ${pagination.page + 1} / ${pagination.totalPages} 页`;
}

function resetGalleryHistoryPage() {
  state.galleryHistoryPage = 0;
}

function setGalleryHistoryPage(page) {
  state.galleryHistoryPage = Math.max(0, Number(page) || 0);
  renderGalleryView();
  refs.galleryScrollRegion?.scrollTo({ top: 0, behavior: "smooth" });
}

function renderGalleryFilters(visibleItems, sections, pagination, shouldPaginateHistory) {
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
      resetGalleryHistoryPage();
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
  const displayedCount = getGallerySectionItemCount(sections);
  if (!shouldPaginateHistory) {
    refs.galleryHelperText.textContent = `${prefix}搜索模式仅显示命中的 ${visibleItems.length} / ${state.gallery.length} 张。`;
    return;
  }

  if (pagination.totalPages > 1) {
    refs.galleryHelperText.textContent = `${prefix}每页显示 5 天历史，第 ${pagination.page + 1} / ${pagination.totalPages} 页，当前 ${sections.length} 组、${displayedCount} / ${visibleItems.length} 张。`;
    return;
  }

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
  const allSections = buildGallerySections(visibleItems);
  const shouldPaginateHistory = !filters.query;
  const pagination = shouldPaginateHistory
    ? paginateGallerySections(allSections, state.galleryHistoryPage)
    : getSearchGalleryPagination(allSections);
  if (shouldPaginateHistory && pagination.page !== state.galleryHistoryPage) {
    state.galleryHistoryPage = pagination.page;
  }
  const sections = pagination.sections;
  const displayedCount = getGallerySectionItemCount(sections);

  refs.gallerySections.innerHTML = "";
  refs.galleryCount.textContent =
    displayedCount === state.gallery.length
      ? `${state.gallery.length} 张`
      : `${displayedCount} / ${state.gallery.length} 张`;
  refs.galleryEmpty.textContent =
    state.gallery.length === 0
      ? "还没有本地输出，先回到 Studio 生成一张图。"
      : hasActiveGalleryFilters(filters)
        ? "当前筛选没有命中结果，试试清空部分筛选。"
        : "当前还没有可展示的本地输出。";
  refs.galleryEmpty.classList.toggle("hidden", displayedCount > 0);
  renderGalleryPagination(pagination, shouldPaginateHistory);
  renderGalleryFilters(visibleItems, sections, pagination, shouldPaginateHistory);
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
  const settingsScrollTop = getSettingsFormScrollTop();

  ensureSelectedPreview();
  syncConnectionState();
  updateGenerateButton();
  renderTimeline();
  renderStudio();
  renderReferenceAnalysisGrid();
  renderReferenceAnalysis();
  renderImageDecompositionView();
  renderArticleIllustrationView();
  renderArticleRecordView();
  renderCreationView();
  renderCreationRecordView();
  renderPptView();
  renderGalleryView();
  syncLightboxItem();

  restoreSettingsFormScrollTop(settingsScrollTop);
}

function mergeGalleryItemWithExistingBrowserImage(item) {
  const filename = String(item?.filename || "").trim();
  if (!filename) {
    return item;
  }

  const current = state.gallery.find((entry) => entry.filename === filename);
  const browserImageUrl = isCacheableBrowserImageUrl(current?.imageUrl)
    ? current.imageUrl
    : isCacheableBrowserImageUrl(current?.thumbnailUrl)
      ? current.thumbnailUrl
      : "";
  if (!browserImageUrl) {
    return item;
  }

  const browserThumbnailUrl = isCacheableBrowserImageUrl(current?.thumbnailUrl) ? current.thumbnailUrl : browserImageUrl;
  const serverImageUrl = getServerImageUrl(item) || getServerImageUrl(current);
  const serverThumbnailUrl = getServerThumbnailUrl(item) || getServerThumbnailUrl(current) || serverImageUrl;
  return {
    ...item,
    serverImageUrl,
    serverThumbnailUrl,
    imageUrl: browserImageUrl,
    thumbnailUrl: browserThumbnailUrl,
  };
}

function upsertGalleryItem(item) {
  const imageMergedItem = mergeGalleryItemWithExistingBrowserImage(item);
  const hydratedItem = mergeGalleryItemWithCachedMetadata(imageMergedItem, state.galleryMetadataCache[item?.filename]);
  const next = state.gallery.filter((entry) => entry.filename !== hydratedItem.filename);
  next.unshift(hydratedItem);
  state.gallery = sortGalleryItemsByCreatedAtDesc(next);
  if (hydratedItem.mode === "reference-analysis") {
    storeReferenceAnalysisGenerationItem(hydratedItem);
  }
  if (hydratedItem.mode === "image-decomposition" || hydratedItem.assetKind === "image-decomposition") {
    storeImageDecompositionGenerationItem(hydratedItem);
  }
  resetGalleryHistoryPage();
  syncGalleryMetadataCache(state.gallery);
  void cacheBrowserGalleryItem(hydratedItem);
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
    if (raw === null) {
      return DEFAULT_PROMPT_TEMPLATES.map((template) => ({ ...template }));
    }

    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(normalizePromptTemplate).filter(Boolean) : [];
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
    const row = document.createElement("div");
    row.className = "prompt-template-item";
    row.classList.toggle("active", template.id === state.selectedPromptTemplateId);

    const titleButton = document.createElement("button");
    titleButton.className = "prompt-template-title-button";
    titleButton.type = "button";
    titleButton.textContent = template.name;
    titleButton.title = template.name;
    titleButton.addEventListener("click", () => {
      applyPromptTemplate(template.id);
      setPromptTemplateFeedback("");
    });
    row.appendChild(titleButton);

    const actions = document.createElement("div");
    actions.className = "prompt-template-row-actions";

    const editButton = document.createElement("button");
    editButton.className = "mini-action";
    editButton.type = "button";
    editButton.textContent = "编辑";
    editButton.addEventListener("click", () => {
      editPromptTemplate(template.id);
    });
    actions.appendChild(editButton);

    const deleteButton = document.createElement("button");
    deleteButton.className = "mini-action danger";
    deleteButton.type = "button";
    deleteButton.textContent = "删除";
    deleteButton.addEventListener("click", () => {
      deletePromptTemplate(template.id);
    });
    actions.appendChild(deleteButton);

    row.appendChild(actions);
    refs.promptTemplateList.appendChild(row);
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

function applyPromptTemplate(templateId = "") {
  const template = templateId ? state.promptTemplates.find((entry) => entry.id === templateId) : getSelectedPromptTemplate();
  const prompt = (template?.prompt || refs.promptTemplateTextInput.value).trim();
  if (!prompt) {
    setPromptTemplateFeedback("先选择或填写一个模板。");
    refs.promptTemplateTextInput.focus();
    return;
  }

  if (template) {
    state.selectedPromptTemplateId = template.id;
  }
  refs.promptInput.value = prompt;
  updatePromptCounter();
  setPromptTemplatePopoverOpen(false);
  refs.promptInput.focus();
}

function editPromptTemplate(templateId) {
  selectPromptTemplate(templateId);
  setPromptTemplateFeedback("");
  refs.promptTemplateNameInput.focus();
}

function deletePromptTemplate(templateId = "") {
  const selected = templateId
    ? state.promptTemplates.find((template) => template.id === templateId)
    : getSelectedPromptTemplate();
  if (!selected) {
    setPromptTemplateFeedback("先选择一个模板。");
    return;
  }

  if (!window.confirm(`删除提示词模板「${selected.name}」？`)) {
    return;
  }

  state.promptTemplates = state.promptTemplates.filter((template) => template.id !== selected.id);
  writePromptTemplates();
  const next =
    state.selectedPromptTemplateId === selected.id
      ? state.promptTemplates[0] || null
      : getSelectedPromptTemplate() || state.promptTemplates[0] || null;
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

function recordFinalImageChunk(finalImageChunks, payload = {}) {
  const filename = String(payload.filename || "").trim();
  const index = Number(payload.index);
  const total = Number(payload.total);
  const chunk = String(payload.chunk || "");
  const mimeType = String(payload.mimeType || "image/png");
  if (!filename || !Number.isInteger(index) || !Number.isInteger(total) || total <= 0 || index < 0 || index >= total || !chunk) {
    return "";
  }

  const existing = finalImageChunks.get(filename) || {
    chunks: new Array(total).fill(""),
    received: 0,
    total,
    mimeType,
    dataUrl: "",
  };

  if (!existing.chunks[index]) {
    existing.chunks[index] = chunk;
    existing.received += 1;
  }

  if (existing.received === existing.total && !existing.dataUrl) {
    existing.dataUrl = `data:${existing.mimeType};base64,${existing.chunks.join("")}`;
  }

  finalImageChunks.set(filename, existing);
  return existing.dataUrl;
}

function attachChunkedImageToSavedItem(item, finalImageChunks, fallbackDataUrl = "") {
  if (!item) {
    return item;
  }

  const entry =
    finalImageChunks.get(String(item.filename || "")) ||
    [...finalImageChunks.values()].find((candidate) => candidate.dataUrl);

  const dataUrl = entry?.dataUrl || (isCacheableBrowserImageUrl(fallbackDataUrl) ? fallbackDataUrl : "");
  if (!dataUrl) {
    return item;
  }

  const serverImageUrl = getServerImageUrl(item);
  const serverThumbnailUrl = getServerThumbnailUrl(item) || serverImageUrl;

  return {
    ...item,
    serverImageUrl,
    serverThumbnailUrl,
    imageUrl: dataUrl,
    thumbnailUrl: dataUrl,
  };
}

function applyServerImageToGalleryItem(item) {
  const filename = String(item?.filename || "").trim();
  const serverImageUrl = getServerImageUrl(item);
  if (!filename || !serverImageUrl) {
    return;
  }

  const serverThumbnailUrl = getServerThumbnailUrl(item) || serverImageUrl;
  const current = state.gallery.find((entry) => entry.filename === filename) || {};
  const browserImageUrl = isCacheableBrowserImageUrl(current.imageUrl)
    ? current.imageUrl
    : isCacheableBrowserImageUrl(current.thumbnailUrl)
      ? current.thumbnailUrl
      : "";
  const browserThumbnailUrl = isCacheableBrowserImageUrl(current.thumbnailUrl) ? current.thumbnailUrl : browserImageUrl;
  const mergedItem = mergeGalleryItemWithCachedMetadata(
    {
      ...current,
      ...item,
      imageUrl: browserImageUrl || serverImageUrl,
      thumbnailUrl: browserThumbnailUrl || serverThumbnailUrl,
      serverImageUrl,
      serverThumbnailUrl,
    },
    state.galleryMetadataCache[filename],
  );
  const next = state.gallery.filter((entry) => entry.filename !== filename);
  next.unshift(mergedItem);
  state.gallery = sortGalleryItemsByCreatedAtDesc(next);
  syncGalleryMetadataCache(state.gallery);
  void cacheBrowserGalleryItem(mergedItem);
}

function setPptFeedback(message = "", kind = "") {
  refs.pptFeedback.textContent = message ? compactErrorMessage(message, "PPT 请求失败") : "";
  refs.pptFeedback.dataset.state = kind;
}

function setPptEditFeedback(message = "", kind = "") {
  refs.pptEditFeedback.textContent = message ? compactErrorMessage(message, "PPT 页面编辑失败") : "";
  refs.pptEditFeedback.dataset.state = kind;
}

function setPptSourceMode(mode) {
  state.ppt.sourceMode = PPT_SOURCE_MODES.has(mode) ? mode : "upload";
  refs.pptSourceModeInputs.forEach((input) => {
    input.checked = input.value === state.ppt.sourceMode;
  });
  refs.pptSourcePanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.pptSourcePanel !== state.ppt.sourceMode);
  });
}

function applyPptFiles(files) {
  state.ppt.files = [...(files || [])];
  renderPptView();
}

function renderPptFiles() {
  refs.pptFileList.innerHTML = "";
  refs.pptFileCount.textContent = `${state.ppt.files.length} 个文件`;

  state.ppt.files.forEach((file) => {
    const item = document.createElement("div");
    item.className = "ppt-file-item";

    const name = document.createElement("strong");
    name.textContent = file.name || "未命名文档";
    item.appendChild(name);

    const meta = document.createElement("span");
    meta.textContent = `${file.type || "application/octet-stream"} · ${formatFileSize(file.size)}`;
    item.appendChild(meta);

    refs.pptFileList.appendChild(item);
  });
}

function resetPptGenerationState() {
  state.ppt.deckId = "";
  state.ppt.outline = null;
  state.ppt.pptxUrl = "";
  state.ppt.slides = [];
  state.ppt.statusText = "正在生成 PPT 大纲";
  state.ppt.currentSlideNumber = 0;
}

function isPptSlideComplete(slide) {
  return Boolean(slide?.slideNumber && slide?.relativePath && (slide?.imageUrl || slide?.thumbnailUrl));
}

function getPptTotalSlideCount() {
  return Array.isArray(state.ppt.outline?.slides) ? state.ppt.outline.slides.length : 0;
}

function getPptCompletionStats() {
  const total = getPptTotalSlideCount();
  const completed = new Set(
    state.ppt.slides
      .filter(isPptSlideComplete)
      .map((slide) => Number(slide.slideNumber))
      .filter((slideNumber) => slideNumber >= 1 && slideNumber <= total),
  ).size;

  return { completed, total };
}

function getPptMissingSlideNumbers() {
  const { total } = getPptCompletionStats();
  const completed = new Set(
    state.ppt.slides
      .filter(isPptSlideComplete)
      .map((slide) => Number(slide.slideNumber)),
  );
  const missing = [];

  for (let slideNumber = 1; slideNumber <= total; slideNumber += 1) {
    if (!completed.has(slideNumber)) {
      missing.push(slideNumber);
    }
  }

  return missing;
}

function getCompletedPptSlides() {
  return state.ppt.slides.filter(isPptSlideComplete).map((slide) => ({
    slideNumber: slide.slideNumber,
    title: slide.title,
    filename: slide.filename,
    relativePath: slide.relativePath,
    imageUrl: slide.imageUrl,
    thumbnailUrl: slide.thumbnailUrl,
    prompt: slide.prompt,
  }));
}

function upsertPptSlide(slide) {
  const slideNumber = Number(slide?.slideNumber);
  if (!slideNumber) {
    return;
  }

  const next = state.ppt.slides.filter((entry) => Number(entry.slideNumber) !== slideNumber);
  next.push({ ...slide, slideNumber });
  state.ppt.slides = next.sort((left, right) => Number(left.slideNumber) - Number(right.slideNumber));
}

function markPptSlideFailed(slideNumber, message) {
  const number = Number(slideNumber);
  if (!number) {
    return;
  }

  const outlineSlide = state.ppt.outline?.slides?.find((slide) => Number(slide.slideNumber) === number);
  upsertPptSlide({
    slideNumber: number,
    title: outlineSlide?.title || `第 ${number} 页`,
    statusText: "生成失败",
    errorMessage: compactErrorMessage(message, "PPT 页面生成失败"),
  });
}

function getPptRenderableSlides() {
  if (!state.ppt.outline?.slides?.length) {
    return state.ppt.slides;
  }

  const slidesByNumber = new Map(state.ppt.slides.map((slide) => [Number(slide.slideNumber), slide]));
  return state.ppt.outline.slides.map((outlineSlide) => ({
    ...outlineSlide,
    ...(slidesByNumber.get(Number(outlineSlide.slideNumber)) || {}),
  }));
}

function getPptSlideByNumber(slideNumber) {
  return state.ppt.slides.find((slide) => Number(slide.slideNumber) === Number(slideNumber)) || null;
}

function resizePptEditCanvas() {
  const canvas = refs.pptEditCanvas;
  canvas.width = 2048;
  canvas.height = 1152;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  state.ppt.edit.hasMarks = false;
}

function openPptSlideEditor(slideNumber) {
  const slide = getPptSlideByNumber(slideNumber);
  const imageUrl = slide?.imageUrl || slide?.thumbnailUrl || "";
  if (!slide || !imageUrl) {
    setPptFeedback("这一页还没有生成图片，无法编辑。", "error");
    return;
  }

  state.ppt.edit = {
    active: true,
    drawing: false,
    erasing: false,
    slideNumber: Number(slideNumber),
    hasMarks: false,
    imageUrl,
  };
  refs.pptEditTitle.textContent = `编辑第 ${slideNumber} 页`;
  refs.pptEditInstructionInput.value = "";
  refs.pptEditImage.src = imageUrl;
  refs.pptEditModal.classList.remove("hidden");
  refs.pptEditModal.setAttribute("aria-hidden", "false");
  setPptEditFeedback("");
  resizePptEditCanvas();
}

function closePptSlideEditor() {
  state.ppt.edit.active = false;
  state.ppt.edit.drawing = false;
  refs.pptEditModal.classList.add("hidden");
  refs.pptEditModal.setAttribute("aria-hidden", "true");
}

function setPptEditTool(tool) {
  state.ppt.edit.erasing = tool === "erase";
  refs.pptEditDrawButton.classList.toggle("active", !state.ppt.edit.erasing);
  refs.pptEditEraseButton.classList.toggle("active", state.ppt.edit.erasing);
}

function getPptEditCanvasPoint(event) {
  const rect = refs.pptEditCanvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * refs.pptEditCanvas.width,
    y: ((event.clientY - rect.top) / rect.height) * refs.pptEditCanvas.height,
  };
}

function drawPptEditStroke(from, to) {
  const context = refs.pptEditCanvas.getContext("2d");
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = state.ppt.edit.erasing ? 70 : 18;
  context.strokeStyle = state.ppt.edit.erasing ? "rgba(0,0,0,1)" : "rgba(255,72,72,0.92)";
  context.globalCompositeOperation = state.ppt.edit.erasing ? "destination-out" : "source-over";
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();
  context.restore();
  state.ppt.edit.hasMarks = true;
}

function beginPptEditStroke(event) {
  event.preventDefault();
  refs.pptEditCanvas.setPointerCapture(event.pointerId);
  state.ppt.edit.drawing = true;
  state.ppt.edit.lastPoint = getPptEditCanvasPoint(event);
}

function continuePptEditStroke(event) {
  if (!state.ppt.edit.drawing) {
    return;
  }
  const point = getPptEditCanvasPoint(event);
  drawPptEditStroke(state.ppt.edit.lastPoint, point);
  state.ppt.edit.lastPoint = point;
}

function endPptEditStroke(event) {
  state.ppt.edit.drawing = false;
  try {
    refs.pptEditCanvas.releasePointerCapture(event.pointerId);
  } catch {
    // Pointer capture may already be released by the browser.
  }
}

function clearPptEditCanvas() {
  resizePptEditCanvas();
  setPptEditFeedback("");
}

async function canvasToBlob(canvas, type = "image/png", quality) {
  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("无法导出标注图片。"));
      }
    }, type, quality);
  });
}

async function buildAnnotatedPptSlideBlob() {
  if (!refs.pptEditImage.complete) {
    await refs.pptEditImage.decode().catch(() => {});
  }
  const canvas = document.createElement("canvas");
  canvas.width = refs.pptEditCanvas.width;
  canvas.height = refs.pptEditCanvas.height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#0b1020";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(refs.pptEditImage, 0, 0, canvas.width, canvas.height);
  context.drawImage(refs.pptEditCanvas, 0, 0, canvas.width, canvas.height);
  return canvasToBlob(canvas);
}

async function requestPptSlideEditStream() {
  const slideNumber = state.ppt.edit.slideNumber;
  const instruction = refs.pptEditInstructionInput.value.trim();
  if (!state.ppt.edit.hasMarks && !instruction) {
    throw new Error("请先在页面上涂抹/标注，或填写修改说明。");
  }

  const sourceResponse = await fetch(state.ppt.edit.imageUrl);
  if (!sourceResponse.ok) {
    throw new Error("读取当前 PPT 页面图片失败。");
  }

  const formData = new FormData();
  formData.set("deckId", state.ppt.deckId);
  formData.set("outline", JSON.stringify(state.ppt.outline));
  formData.set("existingSlides", JSON.stringify(getCompletedPptSlides()));
  formData.set("slideNumber", String(slideNumber));
  formData.set("stylePreset", refs.pptStylePresetInput.value);
  formData.set("dynamicPreset", refs.pptDynamicPresetInput.value);
  formData.set("transitionPreset", refs.pptTransitionPresetInput.value);
  formData.set("transitionSpeed", refs.pptTransitionSpeedInput.value);
  formData.set("autoAdvanceSeconds", refs.pptAutoAdvanceInput.value);
  formData.set("editInstruction", instruction);
  formData.set("reasoningEffort", refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh");
  formData.set("sourceSlideImage", await sourceResponse.blob(), `slide-${slideNumber}-source.png`);
  formData.set("annotatedSlideImage", await buildAnnotatedPptSlideBlob(), `slide-${slideNumber}-annotated.png`);
  appendBrowserConfigToFormData(formData);

  const response = await fetch("/api/ppt/slide/edit", {
    method: "POST",
    body: formData,
  });
  if (!response.ok || !response.body) {
    throw new Error("PPT 页面编辑请求失败");
  }
  return response;
}

async function submitPptSlideEdit() {
  if (state.ppt.generating) {
    return;
  }

  state.ppt.generating = true;
  state.ppt.statusText = `正在重新生成第 ${state.ppt.edit.slideNumber} 页`;
  setPptEditFeedback("正在提交标注并重新生成...", "");
  renderPptView();

  try {
    await runPptStream(await requestPptSlideEditStream());
    closePptSlideEditor();
    await loadPptDecks();
  } catch (error) {
    const message = compactErrorMessage(error instanceof Error ? error.message : String(error), "PPT 页面编辑失败");
    setPptEditFeedback(message, "error");
    setPptFeedback(message, "error");
  } finally {
    state.ppt.generating = false;
    renderPptView();
  }
}

function buildPptFormData() {
  const formData = new FormData();
  state.ppt.files.forEach((file) => formData.append("sourceFiles", file));
  formData.set("sourceText", refs.pptSourceTextInput.value.trim());
  formData.set("topic", refs.pptTopicInput.value.trim());
  formData.set("pageCount", refs.pptPageCountInput.value);
  formData.set("stylePreset", refs.pptStylePresetInput.value);
  formData.set("dynamicPreset", refs.pptDynamicPresetInput.value);
  formData.set("transitionPreset", refs.pptTransitionPresetInput.value);
  formData.set("transitionSpeed", refs.pptTransitionSpeedInput.value);
  formData.set("autoAdvanceSeconds", refs.pptAutoAdvanceInput.value);
  formData.set("reasoningEffort", refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh");
  appendBrowserConfigToFormData(formData);
  return formData;
}

function buildPptCompletionRequest(slideNumbers) {
  return {
    ...getBrowserPrivateConfigRequestPayload(),
    deckId: state.ppt.deckId,
    outline: state.ppt.outline,
    existingSlides: getCompletedPptSlides(),
    slideNumbers,
    stylePreset: refs.pptStylePresetInput.value,
    dynamicPreset: refs.pptDynamicPresetInput.value,
    transitionPreset: refs.pptTransitionPresetInput.value,
    transitionSpeed: refs.pptTransitionSpeedInput.value,
    autoAdvanceSeconds: refs.pptAutoAdvanceInput.value,
    reasoningEffort: refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh",
  };
}

async function requestPptGenerationStream() {
  const response = await fetch("/api/ppt/generate", {
    method: "POST",
    body: buildPptFormData(),
  });
  if (!response.ok || !response.body) {
    throw new Error("PPT 生成请求失败");
  }
  return response;
}

async function requestPptCompletionStream(slideNumbers) {
  const response = await fetch("/api/ppt/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildPptCompletionRequest(slideNumbers)),
  });
  if (!response.ok || !response.body) {
    throw new Error("PPT 补页请求失败");
  }
  return response;
}

function handlePptStreamEvent(eventName, payload) {
  if (eventName === "status") {
    state.ppt.statusText = payload.message || state.ppt.statusText;
    renderPptView();
    return;
  }

  if (eventName === "outline") {
    state.ppt.deckId = payload.deckId || state.ppt.deckId;
    state.ppt.outline = payload.outline || state.ppt.outline;
    state.ppt.statusText = "正在逐页生成图片";
    renderPptView();
    return;
  }

  if (eventName === "slide_started") {
    state.ppt.currentSlideNumber = Number(payload.slideNumber) || 0;
    state.ppt.statusText = `正在生成第 ${payload.slideNumber} 页`;
    upsertPptSlide({
      slideNumber: Number(payload.slideNumber),
      title: payload.title || `第 ${payload.slideNumber} 页`,
      statusText: "生成中",
    });
    renderPptView();
    return;
  }

  if (eventName === "partial_image") {
    upsertPptSlide({
      slideNumber: Number(payload.slideNumber || state.ppt.currentSlideNumber),
      previewUrl: payload.dataUrl,
      statusText: "已收到预览",
    });
    renderPptView();
    return;
  }

  if (eventName === "slide_saved") {
    upsertPptSlide(payload.slide);
    state.ppt.statusText = "页面已保存";
    renderPptView();
    return;
  }

  if (eventName === "slide_failed") {
    markPptSlideFailed(payload.slideNumber || state.ppt.currentSlideNumber, payload.message);
    state.ppt.statusText = "部分页面生成失败";
    renderPptView();
    return;
  }

  if (eventName === "deck_saved") {
    const deck = payload.deck;
    state.ppt.pptxUrl = deck?.pptxUrl || "";
    state.ppt.statusText = "PPTX 已生成";
    if (deck) {
      state.ppt.decks = [deck, ...state.ppt.decks.filter((entry) => entry.deckId !== deck.deckId)];
    }
    renderPptView();
    return;
  }

  if (eventName === "complete") {
    const missing = Array.isArray(payload.missingSlideNumbers) ? payload.missingSlideNumbers : getPptMissingSlideNumbers();
    state.ppt.statusText = missing.length > 0 ? `仍有 ${missing.length} 页未完成` : "生成完成";
    if (payload.deck?.pptxUrl) {
      state.ppt.pptxUrl = payload.deck.pptxUrl;
    }
    renderPptView();
    return;
  }

  if (eventName === "error") {
    const message = compactErrorMessage(payload.message, "PPT 请求失败");
    if (payload.slideNumber || state.ppt.currentSlideNumber) {
      markPptSlideFailed(payload.slideNumber || state.ppt.currentSlideNumber, message);
    }
    setPptFeedback(message, "error");
    state.ppt.statusText = message;
    renderPptView();
  }
}

async function runPptStream(response) {
  await consumeSse(response.body, async (eventName, payload) => {
    handlePptStreamEvent(eventName, payload);
  });
}

async function startPptGeneration(event) {
  event.preventDefault();
  clearError();
  setPptFeedback("");

  const hasInput =
    state.ppt.files.length > 0 ||
    refs.pptSourceTextInput.value.trim().length > 0 ||
    refs.pptTopicInput.value.trim().length > 0;
  if (!hasInput) {
    setPptFeedback("请先上传文档、输入文本或输入主题。", "error");
    return;
  }

  state.ppt.generating = true;
  resetPptGenerationState();
  renderPptView();

  try {
    await runPptStream(await requestPptGenerationStream());
    await loadPptDecks();
  } catch (error) {
    const message = compactErrorMessage(error instanceof Error ? error.message : String(error), "PPT 请求失败");
    setPptFeedback(message, "error");
    state.ppt.statusText = message;
    showError(message);
  } finally {
    state.ppt.generating = false;
    renderPptView();
  }
}

async function runPptCompletion(slideNumbers) {
  if (!state.ppt.outline || state.ppt.generating) {
    return;
  }

  const numbers = [...new Set(slideNumbers.map((value) => Number(value)).filter(Boolean))];
  if (numbers.length === 0) {
    return;
  }

  state.ppt.generating = true;
  state.ppt.statusText = numbers.length === 1 ? `正在重试第 ${numbers[0]} 页` : `正在补齐 ${numbers.length} 页`;
  setPptFeedback("");
  renderPptView();

  try {
    await runPptStream(await requestPptCompletionStream(numbers));
    await loadPptDecks();
  } catch (error) {
    const message = compactErrorMessage(error instanceof Error ? error.message : String(error), "PPT 补页请求失败");
    setPptFeedback(message, "error");
    showError(message);
  } finally {
    state.ppt.generating = false;
    renderPptView();
  }
}

function retryPptSlide(slideNumber) {
  runPptCompletion([slideNumber]).catch((error) => setPptFeedback(error.message, "error"));
}

function completeMissingPptSlides() {
  runPptCompletion(getPptMissingSlideNumbers()).catch((error) => setPptFeedback(error.message, "error"));
}

const CREATION_ITEM_STATUS_LABELS = {
  idle: "等待开始",
  queued: "排队中",
  generating: "生成中",
  completed: "已完成",
  failed: "生成失败",
  partial_failed: "部分失败",
  planning: "待开始",
};

const CREATION_PREVIEW_SLOTS = [
  { itemId: "1-hero", role: "hero", title: "主图", brief: "商品清晰居中，适合作为首图" },
  { itemId: "2-benefit", role: "benefit", title: "卖点图", brief: "突出 1-2 个核心卖点" },
  { itemId: "3-scene", role: "scene", title: "场景图", brief: "展示真实使用环境、比例和使用方式" },
  { itemId: "4-detail-trust", role: "detail-trust", title: "详情信任图", brief: "强调材质、结构、包装或品质证明" },
  { itemId: "5-comparison", role: "comparison", title: "对比图", brief: "让商品优势一眼可比" },
  { itemId: "6-social-proof", role: "social-proof", title: "种草图", brief: "适合社媒与口碑分享语境" },
  { itemId: "7-package", role: "package", title: "包装清单图", brief: "说明包装、配件和到手内容" },
  { itemId: "8-promotion", role: "promotion", title: "活动图", brief: "突出优惠、限时和购买理由" },
  { itemId: "9-material-closeup", role: "material-closeup", title: "材质细节图", brief: "放大纹理、工艺和品质细节" },
  { itemId: "10-usage-steps", role: "usage-steps", title: "使用步骤图", brief: "用步骤降低理解和使用门槛" },
  { itemId: "11-dimensions", role: "dimensions", title: "尺寸规格图", brief: "呈现尺寸、容量和兼容信息" },
  { itemId: "12-review-qa", role: "review-qa", title: "口碑问答图", brief: "回答购买前常见疑虑" },
];

const CREATION_SCENARIO_LABELS = {
  standard: "标准电商",
  "detail-page": "详情页转化",
  "social-seeding": "社媒种草",
  launch: "新品发布",
  promotion: "活动促销",
  livestream: "直播电商",
  "gift-guide": "礼品推荐",
  "marketplace-search": "平台搜索",
  "brand-story": "品牌故事",
};

const CREATION_DIMENSION_UNIT_MODE_LABELS = {
  metric: "公制",
  imperial: "英制",
  both: "公制和英制",
};

const CREATION_CATEGORY_TEMPLATE_MODULE_URL = "/lib/creation-category-templates.mjs?v=20260509-category-search-2";
const CREATION_BASE_INDUSTRY_TEMPLATE_OPTIONS = [
  { value: "general", label: "通用电商", categoryPath: "", rolePreset: [] },
  { value: "apparel", label: "服饰鞋包", categoryPath: "", rolePreset: ["hero", "scene", "material-closeup", "dimensions", "benefit", "social-proof", "review-qa", "promotion"] },
  { value: "beauty", label: "美妆个护", categoryPath: "", rolePreset: ["hero", "benefit", "material-closeup", "usage-steps", "detail-trust", "social-proof", "package", "review-qa"] },
  { value: "food", label: "食品饮料", categoryPath: "", rolePreset: ["hero", "benefit", "scene", "package", "material-closeup", "social-proof", "promotion", "review-qa"] },
  { value: "electronics", label: "3C 数码", categoryPath: "", rolePreset: ["hero", "benefit", "dimensions", "usage-steps", "detail-trust", "comparison", "package", "review-qa"] },
  { value: "home", label: "家居生活", categoryPath: "", rolePreset: ["hero", "scene", "dimensions", "material-closeup", "usage-steps", "benefit", "comparison", "review-qa"] },
];
const CREATION_INDUSTRY_TEMPLATE_LABELS = Object.fromEntries(
  CREATION_BASE_INDUSTRY_TEMPLATE_OPTIONS.map((template) => [template.value, template.label]),
);
const CREATION_INDUSTRY_TEMPLATE_LEVEL_LABELS = ["一级类目", "二级类目", "三级类目", "四级类目"];
const CREATION_INDUSTRY_TEMPLATE_EMPTY_LABEL = "未选择四级类目";

const CREATION_SCENARIO_ROLE_PRESETS = {
  standard: ["hero", "benefit", "scene", "detail-trust"],
  "detail-page": [
    "hero",
    "benefit",
    "detail-trust",
    "material-closeup",
    "dimensions",
    "usage-steps",
    "comparison",
    "package",
  ],
  "social-seeding": ["hero", "scene", "social-proof", "benefit", "review-qa", "promotion"],
  launch: ["hero", "benefit", "scene", "material-closeup", "package", "social-proof", "dimensions", "promotion"],
  promotion: ["hero", "benefit", "comparison", "promotion", "package", "review-qa"],
  livestream: [
    "hero",
    "benefit",
    "scene",
    "usage-steps",
    "detail-trust",
    "comparison",
    "promotion",
    "social-proof",
    "review-qa",
    "dimensions",
  ],
  "gift-guide": ["hero", "package", "scene", "benefit", "social-proof", "review-qa"],
  "marketplace-search": ["hero", "benefit", "comparison", "dimensions", "material-closeup", "review-qa"],
  "brand-story": [
    "hero",
    "scene",
    "material-closeup",
    "package",
    "detail-trust",
    "social-proof",
    "usage-steps",
    "review-qa",
  ],
};

const CREATION_INDUSTRY_ROLE_PRESETS = {
  general: [],
  apparel: ["hero", "scene", "material-closeup", "dimensions", "benefit", "social-proof", "review-qa", "promotion"],
  beauty: ["hero", "benefit", "material-closeup", "usage-steps", "detail-trust", "social-proof", "package", "review-qa"],
  food: ["hero", "benefit", "scene", "package", "material-closeup", "social-proof", "promotion", "review-qa"],
  electronics: ["hero", "benefit", "dimensions", "usage-steps", "detail-trust", "comparison", "package", "review-qa"],
  home: ["hero", "scene", "dimensions", "material-closeup", "usage-steps", "benefit", "comparison", "review-qa"],
};

const CREATION_REFERENCE_ROLE_OPTIONS = [
  { value: "product", label: "商品主体" },
  { value: "package", label: "包装清单" },
  { value: "material", label: "材质细节" },
  { value: "scene", label: "使用场景" },
  { value: "style", label: "风格参考" },
  { value: "other", label: "其他" },
];

function getCreationReferenceRoleLabel(role) {
  return CREATION_REFERENCE_ROLE_OPTIONS.find((option) => option.value === role)?.label || CREATION_REFERENCE_ROLE_OPTIONS[0].label;
}

function getCreationSelectedImageCount() {
  const value = Number.parseInt(refs.creationImageCountInput?.value || "4", 10);
  return [4, 6, 8, 10, 12].includes(value) ? value : 4;
}

function createEmptyCreationReferenceAnalysisState() {
  return {
    applied: false,
    dirty: false,
    result: null,
    running: false,
  };
}

function setCreationSelectValue(select, value, fallback = "") {
  if (!select) {
    return;
  }

  const normalizedValue = String(value || fallback || "");
  const fallbackValue = String(fallback || "");
  const hasOption = Array.from(select.options).some((option) => option.value === normalizedValue);
  select.value = hasOption ? normalizedValue : fallbackValue;
}

let creationCategoryTemplatesModulePromise = null;

function getFallbackCreationIndustryTemplate(value) {
  const normalizedValue = String(value || "").trim();
  const fallback =
    CREATION_BASE_INDUSTRY_TEMPLATE_OPTIONS.find((template) => template.value === normalizedValue) ||
    CREATION_BASE_INDUSTRY_TEMPLATE_OPTIONS[0];

  return {
    ...fallback,
    rolePreset: Array.isArray(fallback.rolePreset) ? [...fallback.rolePreset] : [],
  };
}

function normalizeCreationIndustryTemplate(value) {
  const module = state.creationCategoryTemplatesModule;
  if (module?.normalizeCreationIndustryTemplate) {
    return module.normalizeCreationIndustryTemplate(value);
  }

  const normalizedValue = String(value || "").trim();
  if (normalizedValue.startsWith("category:")) {
    return {
      value: normalizedValue,
      label: normalizedValue.replace(/^category:/, ""),
      categoryPath: "",
      rolePreset: [],
    };
  }

  return getFallbackCreationIndustryTemplate(normalizedValue);
}

function getCreationCategoryTemplateOptions() {
  return state.creationCategoryTemplatesModule?.CREATION_CATEGORY_TEMPLATE_OPTIONS || [];
}

function getCreationIndustryTemplateRolePreset(value) {
  const module = state.creationCategoryTemplatesModule;
  if (module?.getCreationIndustryTemplateRolePreset) {
    return module.getCreationIndustryTemplateRolePreset(value);
  }

  return normalizeCreationIndustryTemplate(value).rolePreset || [];
}

function searchCreationIndustryTemplates(query, options) {
  return state.creationCategoryTemplatesModule?.searchCreationIndustryTemplates?.(query, options) || [];
}

function findCreationIndustryTemplateMatch(text) {
  return state.creationCategoryTemplatesModule?.findCreationIndustryTemplateMatch?.(text) || null;
}

async function loadCreationCategoryTemplatesModule() {
  if (state.creationCategoryTemplatesModule) {
    return state.creationCategoryTemplatesModule;
  }

  if (!creationCategoryTemplatesModulePromise) {
    creationCategoryTemplatesModulePromise = import(CREATION_CATEGORY_TEMPLATE_MODULE_URL)
      .then((module) => {
        state.creationCategoryTemplatesModule = module;
        return module;
      })
      .catch((error) => {
        creationCategoryTemplatesModulePromise = null;
        throw error;
      });
  }

  return creationCategoryTemplatesModulePromise;
}

async function ensureCreationCategoryTemplatesReady({ render = false } = {}) {
  try {
    const module = await loadCreationCategoryTemplatesModule();
    if (render) {
      renderCreationIndustryTemplateBrowser();
      renderCreationRolePicker();
    }
    return module;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setCreationFeedback(`类目模板加载失败：${message}`, "error");
    return null;
  }
}

function setCreationIndustryTemplateBrowserPath(source = {}) {
  state.creationIndustryTemplateBrowser = {
    level1: String(source.level1Name || source.level1 || "").trim(),
    level2: String(source.level2Name || source.level2 || "").trim(),
    level3: String(source.level3Name || source.level3 || "").trim(),
  };
}

function sortCreationIndustryTemplateRows(left, right) {
  return (
    (Number(left.level1Order) || 0) - (Number(right.level1Order) || 0) ||
    (Number(left.level2Order) || 0) - (Number(right.level2Order) || 0) ||
    (Number(left.level3Order) || 0) - (Number(right.level3Order) || 0) ||
    (Number(left.level4Order) || 0) - (Number(right.level4Order) || 0) ||
    String(left.categoryPath || left.label || "").localeCompare(String(right.categoryPath || right.label || ""), "zh-Hans-CN")
  );
}

function filterCreationIndustryTemplateRowsForLevel(level, browserPath = state.creationIndustryTemplateBrowser) {
  return getCreationCategoryTemplateOptions().filter((template) => {
    if (level > 1 && template.level1Name !== browserPath.level1) {
      return false;
    }
    if (level > 2 && template.level2Name !== browserPath.level2) {
      return false;
    }
    if (level > 3 && template.level3Name !== browserPath.level3) {
      return false;
    }
    return true;
  }).sort(sortCreationIndustryTemplateRows);
}

function getCreationIndustryTemplateLevelOptions(level, browserPath = state.creationIndustryTemplateBrowser) {
  if (level === 2 && !browserPath.level1) {
    return [];
  }
  if (level === 3 && (!browserPath.level1 || !browserPath.level2)) {
    return [];
  }
  if (level === 4 && (!browserPath.level1 || !browserPath.level2 || !browserPath.level3)) {
    return [];
  }

  const rows = filterCreationIndustryTemplateRowsForLevel(level, browserPath);
  if (level === 4) {
    return rows.map((template) => ({
      count: 1,
      name: template.label,
      order: Number(template.level4Order) || 0,
      template,
    }));
  }

  const nameKey = `level${level}Name`;
  const orderKey = `level${level}Order`;
  const map = new Map();
  rows.forEach((template) => {
    const name = String(template[nameKey] || "").trim();
    if (!name) {
      return;
    }

    const entry = map.get(name) || {
      categoryPath: getCreationIndustryTemplateLevelPath(level, name, browserPath),
      count: 0,
      name,
      order: Number(template[orderKey]) || 0,
    };
    entry.count += 1;
    map.set(name, entry);
  });

  return [...map.values()].sort((left, right) => {
    return left.order - right.order || left.name.localeCompare(right.name, "zh-Hans-CN");
  });
}

function updateCreationIndustryTemplateBrowserLevel(level, name) {
  const key = `level${level}`;
  const nextPath = { ...state.creationIndustryTemplateBrowser, [key]: String(name || "").trim() };
  if (level <= 1) {
    nextPath.level2 = "";
  }
  if (level <= 2) {
    nextPath.level3 = "";
  }
  if (refs.creationIndustryTemplateInput) {
    refs.creationIndustryTemplateInput.value = "general";
  }
  setCreationIndustryTemplateBrowserPath(nextPath);
  if (refs.creationIndustryTemplateSearchInput) {
    refs.creationIndustryTemplateSearchInput.value = "";
  }
  renderCreationIndustryTemplateBrowser();
  setCreationIndustryTemplateBrowserOpen(true);
}

function getCreationIndustryTemplateLevelPath(level, name, browserPath = state.creationIndustryTemplateBrowser) {
  if (level === 2) {
    return [browserPath.level1, name].filter(Boolean).join(" > ");
  }
  if (level === 3) {
    return [browserPath.level1, browserPath.level2, name].filter(Boolean).join(" > ");
  }
  return "";
}

function createCreationIndustryTemplateButton({
  categoryPath = "",
  level = 1,
  name = "",
  selected = false,
  template = null,
} = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "creation-industry-option";
  button.classList.toggle("is-selected", selected);
  const title = document.createElement("strong");
  const meta = document.createElement("small");
  let metaText = categoryPath;

  if (template) {
    button.dataset.creationIndustryTemplateValue = template.value;
    title.textContent = template.label;
    metaText = template.categoryPath || template.code || "";
    meta.textContent = metaText;
    button.title = [template.label, metaText].filter(Boolean).join(" · ");
    button.append(title, meta);
    return button;
  }

  button.dataset.creationIndustryLevel = String(level);
  button.dataset.creationIndustryName = name;
  button.setAttribute("aria-expanded", selected ? "true" : "false");
  title.textContent = name;
  meta.textContent = metaText;
  button.title = [name, metaText].filter(Boolean).join(" · ");
  button.appendChild(title);
  if (metaText) {
    button.appendChild(meta);
  }
  return button;
}

function getCreationIndustryTemplateActiveLevel() {
  const browserPath = state.creationIndustryTemplateBrowser;
  if (!browserPath.level1) {
    return 1;
  }
  if (!browserPath.level2) {
    return 2;
  }
  if (!browserPath.level3) {
    return 3;
  }
  return 4;
}

function focusCreationIndustryTemplateBrowserOnSelectedTemplate() {
  const currentTemplate = getCreationSelectedIndustryTemplate();
  if (!currentTemplate.categoryPath) {
    return;
  }

  setCreationIndustryTemplateBrowserPath(currentTemplate);
  if (refs.creationIndustryTemplateSearchInput) {
    refs.creationIndustryTemplateSearchInput.value = "";
  }
}

function goBackCreationIndustryTemplateLevel() {
  const activeLevel = getCreationIndustryTemplateActiveLevel();
  if (activeLevel <= 1) {
    return;
  }

  const nextPath = { ...state.creationIndustryTemplateBrowser };
  if (activeLevel === 2) {
    nextPath.level1 = "";
    nextPath.level2 = "";
    nextPath.level3 = "";
  } else if (activeLevel === 3) {
    nextPath.level2 = "";
    nextPath.level3 = "";
  } else {
    nextPath.level3 = "";
  }

  if (refs.creationIndustryTemplateInput) {
    refs.creationIndustryTemplateInput.value = "general";
  }
  if (refs.creationIndustryTemplateSearchInput) {
    refs.creationIndustryTemplateSearchInput.value = "";
  }
  setCreationIndustryTemplateBrowserPath(nextPath);
  renderCreationIndustryTemplateBrowser();
  setCreationIndustryTemplateBrowserOpen(true);
}

function getCreationIndustryTemplateDisplayName(currentTemplate = getCreationSelectedIndustryTemplate()) {
  if (currentTemplate.categoryPath) {
    return currentTemplate.label || CREATION_INDUSTRY_TEMPLATE_EMPTY_LABEL;
  }
  if (currentTemplate.value && currentTemplate.value !== "general") {
    return currentTemplate.label || currentTemplate.value;
  }
  return (
    state.creationIndustryTemplateBrowser.level3 ||
    state.creationIndustryTemplateBrowser.level2 ||
    state.creationIndustryTemplateBrowser.level1 ||
    CREATION_INDUSTRY_TEMPLATE_EMPTY_LABEL
  );
}

function setCreationIndustryTemplateBrowserOpen(open) {
  const nextOpen = Boolean(open);
  if (refs.creationIndustryTemplatePopover) {
    refs.creationIndustryTemplatePopover.hidden = !nextOpen;
  }
  refs.creationIndustryTemplateTrigger?.setAttribute("aria-expanded", nextOpen ? "true" : "false");
  refs.creationIndustryTemplateBrowser?.classList.toggle("is-open", nextOpen);
}

function renderCreationIndustryTemplateCurrentLevel(level) {
  const options = getCreationIndustryTemplateLevelOptions(level);
  const currentTemplate = getCreationSelectedIndustryTemplate();
  const selectedName = state.creationIndustryTemplateBrowser[`level${level}`] || "";
  const list = document.createElement("div");
  list.className = "creation-industry-option-list";

  if (!state.creationCategoryTemplatesModule) {
    const loading = document.createElement("p");
    loading.className = "creation-industry-empty";
    loading.textContent = "正在载入类目模板...";
    list.appendChild(loading);
  } else if (options.length === 0) {
    const empty = document.createElement("p");
    empty.className = "creation-industry-empty";
    empty.textContent = "暂无下一级类目。";
    list.appendChild(empty);
  } else {
    options.forEach((option) => {
      const selected = option.template
        ? currentTemplate.value === option.template.value
        : selectedName === option.name;
      list.appendChild(createCreationIndustryTemplateButton({ ...option, level, selected }));
    });
  }

  return {
    count: options.length,
    label: CREATION_INDUSTRY_TEMPLATE_LEVEL_LABELS[level - 1],
    node: list,
  };
}

function renderCreationIndustryTemplateSearchResults(query) {
  const results = searchCreationIndustryTemplates(query, { limit: 48, includeBase: false }).filter(
    (template) => template.categoryPath,
  );
  const list = document.createElement("div");
  list.className = "creation-industry-option-list";
  if (!state.creationCategoryTemplatesModule) {
    const loading = document.createElement("p");
    loading.className = "creation-industry-empty";
    loading.textContent = "正在载入类目模板...";
    list.appendChild(loading);
  } else if (results.length === 0) {
    const empty = document.createElement("p");
    empty.className = "creation-industry-empty";
    empty.textContent = "没有匹配的四级类目。";
    list.appendChild(empty);
  } else {
    results.forEach((template) => {
      list.appendChild(
        createCreationIndustryTemplateButton({
          selected: getCreationSelectedIndustryTemplate().value === template.value,
          template,
        }),
      );
    });
  }

  return {
    count: results.length,
    label: "搜索结果",
    node: list,
  };
}

function renderCreationIndustryTemplateBrowser() {
  if (!refs.creationIndustryTemplateLevels) {
    return;
  }

  const currentTemplate = getCreationSelectedIndustryTemplate();
  if (refs.creationIndustryTemplateCurrent) {
    refs.creationIndustryTemplateCurrent.textContent = getCreationIndustryTemplateDisplayName(currentTemplate);
  }

  const query = String(refs.creationIndustryTemplateSearchInput?.value || "").trim();
  const activeLevel = getCreationIndustryTemplateActiveLevel();
  const viewModel = query
    ? renderCreationIndustryTemplateSearchResults(query)
    : renderCreationIndustryTemplateCurrentLevel(activeLevel);

  refs.creationIndustryTemplateBrowser?.classList.toggle("is-searching", Boolean(query));
  if (refs.creationIndustryTemplateStepLabel) {
    refs.creationIndustryTemplateStepLabel.textContent = viewModel.label;
  }
  if (refs.creationIndustryTemplateBackButton) {
    const canGoBack = !query && activeLevel > 1;
    refs.creationIndustryTemplateBackButton.classList.toggle("hidden", !canGoBack);
    refs.creationIndustryTemplateBackButton.disabled = !canGoBack;
  }
  refs.creationIndustryTemplateLevels.replaceChildren(viewModel.node);
  if (query) {
    setCreationIndustryTemplateBrowserOpen(true);
  }
}

function setCreationIndustryTemplateValue(value, { searchText = "" } = {}) {
  const normalizedTemplate = normalizeCreationIndustryTemplate(value);
  const nextValue = normalizedTemplate.value || "general";
  if (refs.creationIndustryTemplateInput) {
    refs.creationIndustryTemplateInput.value = nextValue;
  }
  if (normalizedTemplate.categoryPath) {
    setCreationIndustryTemplateBrowserPath(normalizedTemplate);
  } else {
    setCreationIndustryTemplateBrowserPath();
  }
  if (refs.creationIndustryTemplateSearchInput) {
    refs.creationIndustryTemplateSearchInput.value = searchText;
  }
  renderCreationIndustryTemplateBrowser();
}

function setCreationImageCountValue(count) {
  if (!refs.creationImageCountInput) {
    return;
  }

  const normalizedCount = Number(count) || 4;
  refs.creationImageCountInput.value = [4, 6, 8, 10, 12].includes(normalizedCount) ? String(normalizedCount) : "4";
}

function getCreationSelectedScenario() {
  const value = refs.creationScenarioInput?.value || "standard";
  return {
    value,
    label: CREATION_SCENARIO_LABELS[value] || value,
  };
}

function getCreationSelectedIndustryTemplate() {
  return normalizeCreationIndustryTemplate(refs.creationIndustryTemplateInput?.value || "general");
}

function getDefaultCreationRoleIds(count = getCreationSelectedImageCount()) {
  return getCreationRoleIdsForCount(count);
}

function normalizeCreationRoleIds(roles) {
  if (!Array.isArray(roles)) {
    return [];
  }

  const supportedRoles = new Set(CREATION_PREVIEW_SLOTS.map((slot) => slot.role));
  const seen = new Set();
  return roles
    .map((role) => String(role || "").trim())
    .filter((role) => supportedRoles.has(role))
    .filter((role) => {
      if (seen.has(role)) {
        return false;
      }

      seen.add(role);
      return true;
    });
}

function getCreationScenarioRolePreset(scenarioValue = getCreationSelectedScenario().value) {
  return normalizeCreationRoleIds(
    CREATION_SCENARIO_ROLE_PRESETS[scenarioValue] || CREATION_SCENARIO_ROLE_PRESETS.standard,
  );
}

function getCreationIndustryRolePreset(industryValue = getCreationSelectedIndustryTemplate().value) {
  return normalizeCreationRoleIds(getCreationIndustryTemplateRolePreset(industryValue));
}

function getCreationRecommendedRolePreset({
  scenarioValue = getCreationSelectedScenario().value,
  industryValue = getCreationSelectedIndustryTemplate().value,
} = {}) {
  const industryRoles = getCreationIndustryRolePreset(industryValue);
  return industryRoles.length > 0 ? industryRoles : getCreationScenarioRolePreset(scenarioValue);
}

function getCreationRoleIdsForCount(
  count = getCreationSelectedImageCount(),
  scenarioValue = getCreationSelectedScenario().value,
  industryValue = getCreationSelectedIndustryTemplate().value,
) {
  const presetRoles = getCreationRecommendedRolePreset({ scenarioValue, industryValue });
  const presetRoleSet = new Set(presetRoles);
  const fallbackRoles = CREATION_PREVIEW_SLOTS.map((slot) => slot.role).filter((role) => !presetRoleSet.has(role));
  return [...presetRoles, ...fallbackRoles].slice(0, count);
}

function getCreationSelectedRoles() {
  const selectedRoles = normalizeCreationRoleIds(state.creationSelectedRoles);
  return selectedRoles.length > 0 ? selectedRoles : getDefaultCreationRoleIds();
}

function syncCreationSelectedRolesToCount() {
  state.creationSelectedRoles = getDefaultCreationRoleIds();
  resetCreationDraftPreview();
}

function syncCreationSelectedRolesToScenario() {
  const selectedRoles = getCreationRecommendedRolePreset();
  state.creationSelectedRoles = selectedRoles;
  if (refs.creationImageCountInput && [4, 6, 8, 10, 12].includes(selectedRoles.length)) {
    refs.creationImageCountInput.value = String(selectedRoles.length);
  }
  resetCreationDraftPreview();
}

function syncCreationSelectedRolesToIndustry() {
  const selectedRoles = getCreationRecommendedRolePreset();
  state.creationSelectedRoles = selectedRoles;
  if (refs.creationImageCountInput && [4, 6, 8, 10, 12].includes(selectedRoles.length)) {
    refs.creationImageCountInput.value = String(selectedRoles.length);
  }
  resetCreationDraftPreview();
}

function toggleCreationSelectedRole(role) {
  const currentRoles = new Set(getCreationSelectedRoles());
  if (currentRoles.has(role)) {
    if (currentRoles.size <= 1) {
      renderCreationRolePicker();
      return;
    }
    currentRoles.delete(role);
  } else {
    currentRoles.add(role);
  }

  state.creationSelectedRoles = CREATION_PREVIEW_SLOTS.filter((slot) => currentRoles.has(slot.role)).map((slot) => slot.role);
  resetCreationDraftPreview();
}

function getCreationPreviewSlots(count = getCreationSelectedImageCount()) {
  const selectedRoles = normalizeCreationRoleIds(state.creationSelectedRoles);
  const roleIds = selectedRoles.length > 0 ? selectedRoles : getDefaultCreationRoleIds(count);
  return roleIds.map((role) => CREATION_PREVIEW_SLOTS.find((slot) => slot.role === role)).filter(Boolean);
}

function resetCreationDraftPreview() {
  if (!state.creation.generating && !state.creation.planning) {
    state.creation.currentSet = null;
  }
  renderCreationView();
}

function getCreationStatusLabel(status) {
  return CREATION_ITEM_STATUS_LABELS[String(status || "")] || "处理中";
}

function getCreationSellingPoints(value) {
  return String(value || "")
    .split(/[\n,，;；、]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getCreationSelectedLanguage() {
  const select = refs.creationTargetLanguageInput;
  const option = select?.selectedOptions?.[0];
  return {
    value: select?.value || "en",
    label: option?.textContent || select?.value || "English",
  };
}

function normalizeCreationDimensionUnitMode(value) {
  const normalized = String(value || "").trim();
  return CREATION_DIMENSION_UNIT_MODE_LABELS[normalized] ? normalized : "both";
}

function formatCreationDimensionUnitModeLabel(value) {
  return CREATION_DIMENSION_UNIT_MODE_LABELS[normalizeCreationDimensionUnitMode(value)];
}

function getCreationSelectedDimensionUnitMode() {
  return normalizeCreationDimensionUnitMode(refs.creationDimensionUnitModeInput?.value || "both");
}

function setCreationFeedback(message = "", kind = "") {
  if (!refs.creationFeedback) {
    return;
  }

  refs.creationFeedback.textContent = message || "";
  refs.creationFeedback.dataset.state = kind || "";
  state.creation.feedback = message || "";
}

function setCreationRecordFeedback(message = "", kind = "") {
  if (!refs.creationRecordActionFeedback) {
    return;
  }

  refs.creationRecordActionFeedback.textContent = message || "";
  refs.creationRecordActionFeedback.dataset.state = kind || "";
}

function refreshCreationRecordSets() {
  if (state.creation.generating || state.creation.planning || creationRecordRefreshPromise) {
    return;
  }

  creationRecordRefreshPromise = loadCreationSets()
    .catch((error) => {
      setCreationRecordFeedback(error instanceof Error ? error.message : String(error), "error");
    })
    .finally(() => {
      creationRecordRefreshPromise = null;
    });
}

async function writeTextToClipboard(text, failureMessage = "当前浏览器不支持复制图片路径。") {
  const value = String(text || "");
  if (!value) {
    return;
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch (_error) {
      // Fall through to the legacy copy path used by stricter embedded browsers.
    }
  }

  const activeElement = document.activeElement;
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("copy command failed");
    }
  } catch (_error) {
    throw new Error(failureMessage);
  } finally {
    textarea.remove();
    activeElement?.focus?.();
  }
}

function setArticleIllustrationFeedback(message = "", kind = "") {
  if (!refs.articleIllustrationFeedback) {
    return;
  }

  refs.articleIllustrationFeedback.textContent = message || "";
  refs.articleIllustrationFeedback.dataset.state = kind || "";
  state.articleIllustration.feedback = message || "";
}

function setArticleRecordFeedback(message = "", kind = "") {
  if (!refs.articleRecordFeedback) {
    return;
  }

  refs.articleRecordFeedback.textContent = message || "";
  refs.articleRecordFeedback.dataset.state = kind || "";
}

function getArticleItemStatusLabel(status) {
  const labels = {
    planned: "待生成",
    queued: "排队中",
    generating: "生成中",
    reference_generating: "参考图生成中",
    in_progress: "部分完成",
    partial_failed: "部分失败",
    completed: "已完成",
    failed: "失败",
  };
  return labels[String(status || "")] || "待生成";
}

function parsePositiveInteger(value, fallback = 0) {
  const number = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function formatChineseNumber(value) {
  const number = parsePositiveInteger(value, 0);
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (number <= 0) {
    return "";
  }
  if (number < 10) {
    return digits[number];
  }
  if (number === 10) {
    return "十";
  }
  if (number < 20) {
    return `十${digits[number % 10]}`;
  }
  if (number < 100) {
    const tens = Math.floor(number / 10);
    const ones = number % 10;
    return `${digits[tens]}十${ones ? digits[ones] : ""}`;
  }
  return String(number);
}

function normalizeArticleItemForView(item = {}, fallbackIndex = 0) {
  const imageUrl = String(item.imageUrl || item.thumbnailUrl || "");
  return {
    itemId: String(item.itemId || `article-item-${fallbackIndex + 1}`),
    slotIndex: Number(item.slotIndex) || fallbackIndex + 1,
    itemKind: String(item.itemKind || "storyboard"),
    cardId: String(item.cardId || ""),
    title: String(item.title || `插图 ${fallbackIndex + 1}`),
    paragraphIndex: parsePositiveInteger(item.paragraphIndex, 0),
    timelineIndex: parsePositiveInteger(item.timelineIndex, 0),
    narrativeBeat: String(item.narrativeBeat || ""),
    prompt: String(item.prompt || ""),
    originalText: String(item.originalText || ""),
    captionText: String(item.captionText || ""),
    modelTextHint: String(item.modelTextHint || ""),
    referencedCardIds: Array.isArray(item.referencedCardIds) ? item.referencedCardIds.map(String).filter(Boolean) : [],
    emotion: String(item.emotion || ""),
    rhythm: String(item.rhythm || ""),
    status: String(item.status || (imageUrl ? "completed" : "planned")),
    filename: String(item.filename || ""),
    relativePath: String(item.relativePath || ""),
    imageUrl,
    thumbnailUrl: String(item.thumbnailUrl || imageUrl),
    error: String(item.error || ""),
  };
}

function getArticleItemKindSortValue(item) {
  return item?.itemKind === "reference-card" ? 0 : 1;
}

function orderArticleItemsForView(items = []) {
  let storyboardOrdinal = 0;
  return [...items]
    .sort((left, right) => {
      const leftKind = getArticleItemKindSortValue(left);
      const rightKind = getArticleItemKindSortValue(right);
      const leftTimeline = leftKind === 0 ? 0 : left.timelineIndex || left.slotIndex;
      const rightTimeline = rightKind === 0 ? 0 : right.timelineIndex || right.slotIndex;
      const leftParagraph = leftKind === 0 ? 0 : left.paragraphIndex || leftTimeline;
      const rightParagraph = rightKind === 0 ? 0 : right.paragraphIndex || rightTimeline;
      return (
        leftKind - rightKind ||
        leftTimeline - rightTimeline ||
        leftParagraph - rightParagraph ||
        left.slotIndex - right.slotIndex ||
        left.title.localeCompare(right.title) ||
        left.itemId.localeCompare(right.itemId)
      );
    })
    .map((item, index) => {
      if (item.itemKind === "reference-card") {
        return {
          ...item,
          paragraphIndex: 0,
          timelineIndex: 0,
          slotIndex: index + 1,
        };
      }
      storyboardOrdinal += 1;
      return {
        ...item,
        paragraphIndex: item.paragraphIndex || storyboardOrdinal,
        timelineIndex: item.timelineIndex || storyboardOrdinal,
        slotIndex: index + 1,
      };
    });
}

function normalizeArticleSetForView(set = {}) {
  const items = orderArticleItemsForView(
    (Array.isArray(set.items) ? set.items : []).map((item, index) => normalizeArticleItemForView(item, index)),
  );
  return {
    setId: String(set.setId || ""),
    title: String(set.title || "未命名文章"),
    sourceSummary: String(set.sourceSummary || ""),
    contentType: String(set.contentType || "mixed"),
    stylePreset: String(set.stylePreset || DEFAULT_ARTICLE_ILLUSTRATION_STYLE_PRESET),
    styleBible: String(set.styleBible || ""),
    recommendedImageCount: Number(set.recommendedImageCount) || items.length,
    articleBundle: set.articleBundle || null,
    characters: Array.isArray(set.characters) ? set.characters : [],
    scenes: Array.isArray(set.scenes) ? set.scenes : [],
    referenceCards: Array.isArray(set.referenceCards) ? set.referenceCards : [],
    createdAt: String(set.createdAt || nowIso()),
    updatedAt: String(set.updatedAt || set.createdAt || nowIso()),
    status: String(set.status || "planned"),
    relativeDir: String(set.relativeDir || ""),
    items,
  };
}

function createArticleImageOrderBadge(item) {
  const badge = document.createElement("span");
  badge.className = `article-image-order-badge ${item.itemKind === "reference-card" ? "reference" : "storyboard"}`;
  badge.textContent = String(item.slotIndex || 0).padStart(2, "0");
  badge.title = item.itemKind === "reference-card" ? "参考图排序" : "正文插图排序";
  return badge;
}

function getArticleParagraphLabel(item) {
  if (item.itemKind === "reference-card") {
    return "参考图";
  }
  const paragraphIndex = parsePositiveInteger(item.paragraphIndex || item.timelineIndex || item.slotIndex, 0);
  return paragraphIndex ? `第${formatChineseNumber(paragraphIndex)}段` : "正文段落";
}

function getArticleTimelineLabel(item) {
  if (item.itemKind === "reference-card") {
    return "";
  }
  const timelineIndex = parsePositiveInteger(item.timelineIndex || item.paragraphIndex || item.slotIndex, 0);
  return timelineIndex ? `时间线 ${String(timelineIndex).padStart(2, "0")}` : "";
}

function getArticleCardHeadingLabel(item) {
  if (item.itemKind === "reference-card") {
    return `${String(item.slotIndex).padStart(2, "0")} · 参考图`;
  }
  return `${String(item.slotIndex).padStart(2, "0")} · ${getArticleParagraphLabel(item)}`;
}

function appendArticleRecordMetaPill(container, text, variant = "") {
  if (!text) {
    return;
  }
  const pill = document.createElement("span");
  pill.className = `article-record-card-kind ${variant}`.trim();
  pill.textContent = text;
  container.appendChild(pill);
}

function getArticleCurrentSet() {
  return state.articleIllustration.currentSet ? normalizeArticleSetForView(state.articleIllustration.currentSet) : null;
}

function upsertArticleSet(set) {
  const normalized = normalizeArticleSetForView(set);
  if (!normalized.setId) {
    return;
  }

  state.articleIllustration.currentSet = normalized;
  const nextSets = state.articleIllustration.sets.filter((entry) => entry.setId !== normalized.setId);
  nextSets.unshift(normalized);
  state.articleIllustration.sets = nextSets.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  renderArticleIllustrationView();
  renderArticleRecordView();
}

function updateArticleCurrentItem(itemId, patch = {}) {
  const currentSet = getArticleCurrentSet();
  if (!currentSet) {
    return;
  }

  state.articleIllustration.currentSet = normalizeArticleSetForView({
    ...currentSet,
    updatedAt: nowIso(),
    items: currentSet.items.map((item) => (item.itemId === itemId ? { ...item, ...patch } : item)),
  });
}

function getArticleProgressSummary(set = getArticleCurrentSet()) {
  const items = Array.isArray(set?.items) ? set.items : [];
  const total = items.length || Number(set?.recommendedImageCount) || 0;
  const completed = items.filter((item) => item.status === "completed").length;
  const failed = items.filter((item) => item.status === "failed").length;
  const references = items.filter((item) => item.itemKind === "reference-card");
  const referenceCompleted = references.filter((item) => item.status === "completed").length;
  return { total, completed, failed, references: references.length, referenceCompleted };
}

function formatArticleDisplayText(value, fallback = "未命名文章") {
  const text = String(value || "").trim();
  return text && !/^[?？\s]+$/.test(text) ? text : fallback;
}

function syncArticlePlanEditsFromDom() {
  const currentSet = getArticleCurrentSet();
  if (!currentSet) {
    return null;
  }

  const styleBible = refs.articleIllustrationStyleBibleInput?.value || currentSet.styleBible;
  const nextItems = currentSet.items.map((item) => {
    const selector = `[data-article-item-id="${CSS.escape(item.itemId)}"]`;
    const root = [
      refs.articleIllustrationReferenceList,
      refs.articleIllustrationStoryboardList,
      refs.articleRecordDetail,
    ]
      .filter(Boolean)
      .map((container) => container.querySelector(selector))
      .find(Boolean);
    if (!root) {
      return item;
    }

    return {
      ...item,
      title: root.querySelector("[data-article-item-title]")?.value || item.title,
      prompt: root.querySelector("[data-article-item-prompt]")?.value || item.prompt,
      captionText: root.querySelector("[data-article-item-caption]")?.value || item.captionText,
      modelTextHint: root.querySelector("[data-article-item-text-hint]")?.value || item.modelTextHint,
    };
  });

  state.articleIllustration.currentSet = normalizeArticleSetForView({
    ...currentSet,
    styleBible,
    items: nextItems,
    updatedAt: nowIso(),
  });
  return getArticleCurrentSet();
}

function applyArticleIllustrationFiles(fileList) {
  const files = [...(fileList || [])];
  state.articleIllustration.files.forEach((file) => {
    if (file.previewUrl) {
      URL.revokeObjectURL(file.previewUrl);
    }
  });
  state.articleIllustration.files = files.map((file, index) => ({
    id: `article-source-${Date.now()}-${index}`,
    file,
  }));
  renderArticleIllustrationFiles();
}

function renderArticleIllustrationFiles() {
  if (!refs.articleIllustrationFileList) {
    return;
  }

  refs.articleIllustrationFileList.replaceChildren();
  refs.articleIllustrationFileCount.textContent = `${state.articleIllustration.files.length} 个文件`;
  state.articleIllustration.files.forEach((item) => {
    const row = document.createElement("div");
    row.className = "article-file-item";
    const name = document.createElement("span");
    name.textContent = item.file?.name || "未命名文件";
    const meta = document.createElement("small");
    meta.textContent = formatFileSize(item.file?.size || 0);
    row.append(name, meta);
    refs.articleIllustrationFileList.appendChild(row);
  });
}

function updateArticleSourceLength() {
  if (!refs.articleIllustrationSourceLength || !refs.articleIllustrationSourceTextInput) {
    return;
  }

  const length = Array.from(refs.articleIllustrationSourceTextInput.value || "").length;
  refs.articleIllustrationSourceLength.textContent = `${length} 字`;
}

function createArticleStoryboardCard(item) {
  const card = document.createElement("article");
  card.className = "article-story-card";
  card.dataset.status = item.status || "planned";
  card.dataset.articleItemId = item.itemId;
  card.dataset.itemKind = item.itemKind;

  const head = document.createElement("div");
  head.className = "article-card-head";
  const title = document.createElement("strong");
  title.textContent = getArticleCardHeadingLabel(item);
  const status = document.createElement("span");
  status.textContent = getArticleItemStatusLabel(item.status);
  head.append(title, status);
  card.appendChild(head);

  const imageUrl = item.imageUrl || item.thumbnailUrl;
  const media = document.createElement(imageUrl ? "button" : "div");
  media.className = "article-card-image";
  if (imageUrl) {
    media.type = "button";
    media.classList.add("article-card-image-button");
    media.dataset.articlePreviewItemId = item.itemId;
    media.setAttribute("aria-label", `${item.title || "文章插图"} 查看大图`);
  }
  media.appendChild(createArticleImageOrderBadge(item));
  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = item.title || "文章插图";
    media.appendChild(img);
  } else {
    const placeholder = document.createElement("span");
    placeholder.className = "article-card-image-placeholder";
    placeholder.textContent = item.error || (item.itemKind === "reference-card" ? "参考图会用于后续一致性" : "确认后生成");
    media.appendChild(placeholder);
  }
  card.appendChild(media);

  const titleField = document.createElement("textarea");
  titleField.rows = 1;
  titleField.className = "article-caption-field";
  titleField.dataset.articleItemTitle = "true";
  titleField.value = item.title || "";
  titleField.placeholder = "标题";
  card.appendChild(titleField);

  const promptField = document.createElement("textarea");
  promptField.dataset.articleItemPrompt = "true";
  promptField.value = item.prompt || "";
  promptField.placeholder = "标准生图提示词";
  card.appendChild(promptField);

  const captionField = document.createElement("textarea");
  captionField.rows = 2;
  captionField.className = "article-caption-field";
  captionField.dataset.articleItemCaption = "true";
  captionField.value = item.captionText || "";
  captionField.placeholder = "准确题注 / 原文句子";
  card.appendChild(captionField);

  const hintField = document.createElement("textarea");
  hintField.rows = 2;
  hintField.className = "article-caption-field";
  hintField.dataset.articleItemTextHint = "true";
  hintField.value = item.modelTextHint || "";
  hintField.placeholder = "对话用漫画对话框/旁白框呈现，不要直接印在画面物体上";
  card.appendChild(hintField);

  const actions = document.createElement("div");
  actions.className = "article-card-actions";
  const copyPromptButton = document.createElement("button");
  copyPromptButton.className = "mini-action";
  copyPromptButton.type = "button";
  copyPromptButton.dataset.articleCopyPromptItemId = item.itemId;
  copyPromptButton.textContent = "复制提示词";
  const copyCaptionButton = document.createElement("button");
  copyCaptionButton.className = "mini-action";
  copyCaptionButton.type = "button";
  copyCaptionButton.dataset.articleCopyCaptionItemId = item.itemId;
  copyCaptionButton.textContent = "复制题注";
  const retryButton = document.createElement("button");
  retryButton.className = "mini-action";
  retryButton.type = "button";
  retryButton.dataset.articleRetryItemId = item.itemId;
  retryButton.textContent = item.status === "completed" ? "重生成" : "补图";
  actions.append(copyPromptButton, copyCaptionButton, retryButton);
  card.appendChild(actions);

  return card;
}

function createArticleRecordCard(item, setId = "") {
  const card = document.createElement("article");
  card.className = "article-record-image-card article-story-card";
  card.dataset.status = item.status || "planned";
  card.dataset.articleItemId = item.itemId;
  card.dataset.itemKind = item.itemKind;

  const head = document.createElement("div");
  head.className = "article-card-head";
  const title = document.createElement("strong");
  title.textContent = getArticleCardHeadingLabel(item);
  const status = document.createElement("span");
  status.textContent = getArticleItemStatusLabel(item.status);
  head.append(title, status);
  card.appendChild(head);

  const imageUrl = item.imageUrl || item.thumbnailUrl;
  const media = document.createElement(imageUrl ? "button" : "div");
  media.className = "article-card-image";
  if (imageUrl) {
    media.type = "button";
    media.classList.add("article-card-image-button");
    media.dataset.articleRecordPreviewItemId = item.itemId;
    media.dataset.articleRecordPreviewSetId = setId;
    media.setAttribute("aria-label", `${item.title || "文章插图"} 查看大图`);
  }
  media.appendChild(createArticleImageOrderBadge(item));
  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = item.title || "文章插图";
    media.appendChild(img);
  } else {
    const placeholder = document.createElement("span");
    placeholder.className = "article-card-image-placeholder";
    placeholder.textContent = item.error || (item.itemKind === "reference-card" ? "参考图会用于后续一致性" : "确认后生成");
    media.appendChild(placeholder);
  }
  card.appendChild(media);

  const body = document.createElement("div");
  body.className = "article-record-card-body";
  const meta = document.createElement("div");
  meta.className = "article-record-card-meta";
  appendArticleRecordMetaPill(meta, getArticleParagraphLabel(item));
  appendArticleRecordMetaPill(meta, getArticleTimelineLabel(item), "timeline");
  const titleText = document.createElement("div");
  titleText.className = "article-record-card-title";
  titleText.textContent = item.title || "";
  const caption = document.createElement("p");
  caption.className = "article-record-card-caption";
  caption.textContent = item.captionText || item.originalText || item.prompt || "暂无题注";
  body.append(meta, titleText, caption);
  card.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "article-card-actions";
  const copyPromptButton = document.createElement("button");
  copyPromptButton.className = "mini-action";
  copyPromptButton.type = "button";
  copyPromptButton.dataset.articleCopyPromptItemId = item.itemId;
  copyPromptButton.textContent = "复制提示词";
  const copyCaptionButton = document.createElement("button");
  copyCaptionButton.className = "mini-action";
  copyCaptionButton.type = "button";
  copyCaptionButton.dataset.articleCopyCaptionItemId = item.itemId;
  copyCaptionButton.textContent = "复制题注";
  const retryButton = document.createElement("button");
  retryButton.className = "mini-action";
  retryButton.type = "button";
  retryButton.dataset.articleRetryItemId = item.itemId;
  retryButton.textContent = item.status === "completed" ? "重生成" : "补图";
  actions.append(copyPromptButton, copyCaptionButton, retryButton);
  card.appendChild(actions);

  return card;
}

function renderArticleIllustrationView() {
  if (!refs.articleIllustrationStoryboardList) {
    return;
  }

  renderArticleIllustrationFiles();
  updateArticleSourceLength();
  const currentSet = getArticleCurrentSet();
  const progress = getArticleProgressSummary(currentSet);
  const busy = state.articleIllustration.planning || state.articleIllustration.generating || state.articleIllustration.referenceGenerating;
  const referenceItems = currentSet?.items?.filter((item) => item.itemKind === "reference-card") || [];
  const storyboardItems = currentSet?.items?.filter((item) => item.itemKind !== "reference-card") || [];

  refs.articleIllustrationPlanButton.textContent = state.articleIllustration.planning ? "解析中..." : "解析文章";
  refs.articleIllustrationPlanButton.disabled = busy;
  refs.articleIllustrationReferenceButton.disabled =
    busy || !currentSet || progress.references === 0 || progress.referenceCompleted === progress.references;
  refs.articleIllustrationReferenceButton.textContent = state.articleIllustration.referenceGenerating ? "参考图生成中..." : "生成参考图";
  refs.articleIllustrationGenerateButton.disabled = busy || !currentSet;
  refs.articleIllustrationGenerateButton.textContent = state.articleIllustration.generating ? "生成中..." : "确认并生成插图";
  refs.articleIllustrationCount.textContent = `${progress.completed} / ${progress.total || 0} 张`;
  refs.articleReferenceSectionCount.textContent = `${referenceItems.length} 张`;
  refs.articleStoryboardSectionCount.textContent = `${storyboardItems.length} 张`;
  refs.articleIllustrationSetMeta.textContent = currentSet
    ? `${formatArticleDisplayText(currentSet.title)} · ${currentSet.contentType} · ${currentSet.stylePreset} · ${getArticleItemStatusLabel(currentSet.status)}`
    : "等待解析";
  if (currentSet && document.activeElement !== refs.articleIllustrationStyleBibleInput) {
    refs.articleIllustrationStyleBibleInput.value = currentSet.styleBible || "";
  }

  refs.articleIllustrationReferenceList.replaceChildren();
  referenceItems.forEach((item) => {
    refs.articleIllustrationReferenceList.appendChild(createArticleStoryboardCard(item));
  });
  if (referenceItems.length === 0) {
    const empty = document.createElement("div");
    empty.className = "article-reference-card";
    empty.textContent = currentSet ? "本次计划没有单独参考图。" : "解析后会显示人物和高频场景参考图。";
    refs.articleIllustrationReferenceList.appendChild(empty);
  }

  refs.articleIllustrationStoryboardList.replaceChildren();
  if (storyboardItems.length === 0) {
    const empty = document.createElement("article");
    empty.className = "article-story-card";
    empty.textContent = currentSet ? "正文插图会显示在参考图之后。" : "先输入文章并解析，模型会生成可编辑的分镜表。";
    refs.articleIllustrationStoryboardList.appendChild(empty);
    return;
  }
  storyboardItems.forEach((item) => {
    refs.articleIllustrationStoryboardList.appendChild(createArticleStoryboardCard(item));
  });
}

function buildArticleIllustrationPlanFormData() {
  const formData = new FormData();
  formData.set("title", refs.articleIllustrationTitleInput.value.trim());
  formData.set("sourceText", refs.articleIllustrationSourceTextInput.value.trim());
  formData.set("supplementalPrompt", refs.articleIllustrationSupplementInput.value.trim());
  formData.set("contentType", refs.articleIllustrationContentTypeInput.value || "auto");
  formData.set("stylePreset", refs.articleIllustrationStylePresetInput.value || DEFAULT_ARTICLE_ILLUSTRATION_STYLE_PRESET);
  formData.set("reasoningEffort", refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh");
  state.articleIllustration.files.forEach((item) => {
    if (item.file) {
      formData.append("sourceFiles", item.file);
    }
  });
  appendBrowserConfigToFormData(formData);
  return formData;
}

function buildArticleIllustrationGenerateFormData({ itemIds = [], regenerate = false } = {}) {
  const currentSet = syncArticlePlanEditsFromDom();
  const formData = new FormData();
  formData.set("setId", currentSet?.setId || "");
  formData.set("styleBible", currentSet?.styleBible || "");
  formData.set("items", JSON.stringify(currentSet?.items || []));
  formData.set("ratio", "3:2");
  formData.set("size", "auto");
  formData.set("format", "png");
  formData.set("reasoningEffort", refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh");
  formData.set("clientSessionId", state.clientSessionId);
  if (itemIds.length > 0) {
    formData.set("itemIds", JSON.stringify(itemIds));
  }
  if (regenerate) {
    formData.set("regenerate", "1");
  }
  appendBrowserConfigToFormData(formData);
  return formData;
}

function handleArticleIllustrationStreamEvent(eventName, payload = {}) {
  if (eventName === "references_started" || eventName === "set_started") {
    if (payload.set) {
      upsertArticleSet(payload.set);
    }
    setArticleIllustrationFeedback(eventName === "references_started" ? "正在生成重点参考图..." : "正在生成文章插图...", "busy");
    return;
  }

  if (eventName === "item_started") {
    updateArticleCurrentItem(payload.itemId, { status: "generating", error: "" });
    setArticleIllustrationFeedback(`正在生成：${payload.title || payload.itemId}`, "busy");
    renderArticleIllustrationView();
    return;
  }

  if (eventName === "item_partial_image" || eventName === "item_final_image") {
    updateArticleCurrentItem(payload.itemId, {
      status: "generating",
      imageUrl: payload.dataUrl,
      thumbnailUrl: payload.dataUrl,
    });
    renderArticleIllustrationView();
    return;
  }

  if (eventName === "item_saved") {
    if (payload.set) {
      upsertArticleSet(payload.set);
    } else if (payload.item) {
      updateArticleCurrentItem(payload.item.itemId, payload.item);
    }
    setArticleIllustrationFeedback("已保存一张文章插图。", "success");
    renderArticleIllustrationView();
    return;
  }

  if (eventName === "item_failed") {
    if (payload.set) {
      upsertArticleSet(payload.set);
    } else if (payload.itemId) {
      updateArticleCurrentItem(payload.itemId, { status: "failed", error: payload.message || "" });
    }
    setArticleIllustrationFeedback(payload.message || "文章插图生成失败。", "error");
    renderArticleIllustrationView();
    return;
  }

  if (eventName === "complete") {
    if (payload.set) {
      upsertArticleSet(payload.set);
    }
    setArticleIllustrationFeedback("文章插图任务已完成。", "success");
    renderArticleIllustrationView();
    return;
  }

  if (eventName === "error") {
    const message = compactErrorMessage(payload.message, "文章插图请求失败");
    setArticleIllustrationFeedback(message, "error");
    showError(message);
  }
}

async function runArticleIllustrationStream(response) {
  await consumeSse(response.body, async (eventName, payload) => {
    handleArticleIllustrationStreamEvent(eventName, payload);
  });
}

async function previewArticleIllustrationPlan() {
  if (state.articleIllustration.planning || state.articleIllustration.generating) {
    return;
  }

  clearError();
  setArticleIllustrationFeedback("");
  if (!refs.articleIllustrationSourceTextInput.value.trim() && state.articleIllustration.files.length === 0 && !refs.articleIllustrationSupplementInput.value.trim()) {
    const message = "请先粘贴文章正文、上传文本文件，或填写补充说明。";
    setArticleIllustrationFeedback(message, "error");
    showError(message);
    return;
  }

  state.articleIllustration.planning = true;
  setArticleIllustrationFeedback("正在解析整篇文章...", "busy");
  renderArticleIllustrationView();

  try {
    const response = await fetch("/api/article-illustration/plan", {
      method: "POST",
      body: buildArticleIllustrationPlanFormData(),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || "文章插图解析失败");
    }

    state.articleIllustration.currentSet = normalizeArticleSetForView(payload.set || payload.plan || {});
    if (refs.articleIllustrationStyleBibleInput) {
      refs.articleIllustrationStyleBibleInput.value = state.articleIllustration.currentSet.styleBible || "";
    }
    upsertArticleSet(state.articleIllustration.currentSet);
    setArticleIllustrationFeedback("已生成分镜、风格圣经和参考图计划，可编辑后继续。", "success");
  } catch (error) {
    const message = compactErrorMessage(error instanceof Error ? error.message : String(error), "文章插图解析失败");
    setArticleIllustrationFeedback(message, "error");
    showError(message);
  } finally {
    state.articleIllustration.planning = false;
    renderArticleIllustrationView();
  }
}

async function generateArticleIllustrations({ referenceOnly = false, itemIds = [], regenerate = false } = {}) {
  if (state.articleIllustration.generating || state.articleIllustration.referenceGenerating) {
    return;
  }

  const currentSet = getArticleCurrentSet();
  if (!currentSet?.setId) {
    const message = "请先解析文章，确认分镜后再生成。";
    setArticleIllustrationFeedback(message, "error");
    showError(message);
    return;
  }

  clearError();
  state.articleIllustration.generating = !referenceOnly;
  state.articleIllustration.referenceGenerating = referenceOnly;
  setArticleIllustrationFeedback(referenceOnly ? "正在生成重点参考图..." : "正在生成正式插图...", "busy");
  renderArticleIllustrationView();

  try {
    const requestOptions = {
      method: "POST",
      body: buildArticleIllustrationGenerateFormData({ itemIds, regenerate }),
    };
    const response = referenceOnly
      ? await fetch("/api/article-illustration/generate-references", requestOptions)
      : await fetch("/api/article-illustration/generate", requestOptions);
    if (!response.ok || !response.body) {
      throw new Error(referenceOnly ? "参考图生成请求失败" : "文章插图生成请求失败");
    }

    await runArticleIllustrationStream(response);
    await loadArticleIllustrationSets();
  } catch (error) {
    const message = compactErrorMessage(error instanceof Error ? error.message : String(error), "文章插图生成请求失败");
    setArticleIllustrationFeedback(message, "error");
    showError(message);
  } finally {
    state.articleIllustration.generating = false;
    state.articleIllustration.referenceGenerating = false;
    renderArticleIllustrationView();
  }
}

async function loadArticleIllustrationSets() {
  const response = await fetch("/api/article-illustration/sets", {
    cache: "no-store",
  });
  if (response.status === 404) {
    state.articleIllustration.sets = [];
    state.articleIllustration.recordSetId = "";
    renderArticleRecordView();
    return;
  }
  if (!response.ok) {
    throw new Error("读取文章插图记录失败");
  }

  const payload = await response.json();
  const nextSets = Array.isArray(payload) ? payload.map(normalizeArticleSetForView).filter(Boolean) : [];
  const currentSetId = state.articleIllustration.currentSet?.setId || "";
  state.articleIllustration.sets = nextSets;
  if (currentSetId) {
    const matched = nextSets.find((set) => set.setId === currentSetId);
    if (matched) {
      state.articleIllustration.currentSet = matched;
    }
  }
  if (state.articleIllustration.recordSetId && !nextSets.some((set) => set.setId === state.articleIllustration.recordSetId)) {
    state.articleIllustration.recordSetId = "";
  }
  renderArticleIllustrationView();
  renderArticleRecordView();
}

function getArticleRecordSearchText(set = {}) {
  return [
    set.title,
    set.sourceSummary,
    set.contentType,
    set.stylePreset,
    set.styleBible,
    ...(Array.isArray(set.characters) ? set.characters.map((item) => item.name) : []),
    ...(Array.isArray(set.scenes) ? set.scenes.map((item) => item.name) : []),
  ]
    .join(" ")
    .toLowerCase();
}

function filterArticleRecordSets() {
  const query = String(state.articleIllustration.recordQuery || "").trim().toLowerCase();
  if (!query) {
    return state.articleIllustration.sets;
  }
  return state.articleIllustration.sets.filter((set) => getArticleRecordSearchText(set).includes(query));
}

function getArticleRecordSelectedSet() {
  const filtered = filterArticleRecordSets();
  return (
    filtered.find((set) => set.setId === state.articleIllustration.recordSetId) ||
    filtered[0] ||
    null
  );
}

function getArticleRecordItemById(itemId, setId = "") {
  const selectedSet = setId
    ? state.articleIllustration.sets.find((set) => set.setId === setId) ||
      (state.articleIllustration.currentSet?.setId === setId ? state.articleIllustration.currentSet : null)
    : getArticleRecordSelectedSet() || getArticleCurrentSet();
  if (!selectedSet || !itemId) {
    return null;
  }

  const item = selectedSet.items.find((entry) => entry.itemId === itemId) || null;
  return item ? { item, set: selectedSet } : null;
}

function buildArticleRecordLightboxItem(item, set) {
  const relativeFilename = String(item.relativePath || "").split(/[\\/]/).filter(Boolean).pop() || "";
  return {
    ...item,
    id: `article-record:${set.setId}:${item.itemId || item.filename || relativeFilename}`,
    articleItemId: item.itemId || "",
    articleSetId: set.setId || "",
    filename: item.filename || relativeFilename || "article-illustration.png",
    createdAt: item.generationCompletedAt || set.updatedAt || set.createdAt || nowIso(),
    prompt: item.prompt || item.captionText || item.title || "",
    imageModel: item.imageModel || "gpt-image-2",
    isArticleRecordItem: true,
  };
}

function openArticleRecordItemPreview(itemId, setId = "") {
  const record = getArticleRecordItemById(itemId, setId);
  if (!record?.item || !getImageUrl(record.item)) {
    setArticleRecordFeedback("当前单张还没有可查看的大图。", "error");
    return;
  }

  openLightbox(buildArticleRecordLightboxItem(record.item, record.set));
}

function openArticleIllustrationItemPreview(itemId) {
  const currentSet = syncArticlePlanEditsFromDom() || getArticleCurrentSet();
  const item = currentSet?.items?.find((entry) => entry.itemId === itemId);
  if (!currentSet || !item || !getImageUrl(item)) {
    setArticleIllustrationFeedback("当前单张还没有可查看的大图。", "error");
    return;
  }

  openLightbox(buildArticleRecordLightboxItem(item, currentSet));
}

function buildArticlePromptText(set = getArticleRecordSelectedSet()) {
  if (!set) {
    return "";
  }
  return set.items
    .map((item) => [`# ${getArticleCardHeadingLabel(item)} ${getArticleTimelineLabel(item)} ${item.title}`.trim(), item.prompt].filter(Boolean).join("\n"))
    .join("\n\n");
}

function buildArticleCaptionText(set = getArticleRecordSelectedSet()) {
  if (!set) {
    return "";
  }
  return set.items
    .map((item) => [`# ${getArticleCardHeadingLabel(item)} ${getArticleTimelineLabel(item)} ${item.title}`.trim(), item.captionText || item.originalText].filter(Boolean).join("\n"))
    .join("\n\n");
}

function renderArticleRecordList() {
  if (!refs.articleRecordList) {
    return;
  }
  const filteredSets = filterArticleRecordSets();
  const selectedSet = getArticleRecordSelectedSet();
  refs.articleRecordList.replaceChildren();
  filteredSets.forEach((set) => {
    const button = document.createElement("button");
    button.className = `article-record-card ${selectedSet?.setId === set.setId ? "active" : ""}`;
    button.type = "button";
    button.dataset.articleRecordSetId = set.setId;
    const title = document.createElement("strong");
    title.textContent = formatArticleDisplayText(set.title);
    const meta = document.createElement("small");
    const progress = getArticleProgressSummary(set);
    meta.textContent = `${progress.completed}/${progress.total} · ${set.stylePreset} · ${formatClock(set.createdAt)}`;
    button.append(title, meta);
    refs.articleRecordList.appendChild(button);
  });
}

function renderArticleRecordDetail(set) {
  if (!refs.articleRecordDetail) {
    return;
  }
  const columnCount = getArticleRecordColumnCount();
  refs.articleRecordDetail.dataset.recordColumns = String(columnCount);
  refs.articleRecordDetail.replaceChildren();
  if (!set) {
    const empty = document.createElement("div");
    empty.className = "article-record-summary";
    empty.textContent = "还没有文章插图记录。";
    refs.articleRecordDetail.appendChild(empty);
    return;
  }

  const progress = getArticleProgressSummary(set);
  const summary = document.createElement("div");
  summary.className = "article-record-summary";
  [
    ["标题", formatArticleDisplayText(set.title)],
    ["类型", set.contentType],
    ["风格", set.stylePreset],
    ["进度", `${progress.completed}/${progress.total}`],
  ].forEach(([label, value]) => {
    const item = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    item.append(strong, document.createTextNode(value || "--"));
    summary.appendChild(item);
  });
  refs.articleRecordDetail.appendChild(summary);

  const referenceItems = (Array.isArray(set.items) ? set.items : []).filter((item) => item.itemKind === "reference-card");
  const storyboardItems = (Array.isArray(set.items) ? set.items : []).filter((item) => item.itemKind !== "reference-card");
  const sections = document.createElement("div");
  sections.className = "article-record-sections";

  const appendRecordSection = (items, titleText, descriptionText, emptyText) => {
    const section = document.createElement("section");
    section.className = "article-record-section";
    const head = document.createElement("div");
    head.className = "article-record-section-head";
    const copy = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = titleText;
    const description = document.createElement("p");
    description.textContent = descriptionText;
    copy.append(title, description);
    const count = document.createElement("span");
    count.className = "count-pill small";
    count.textContent = `${items.length} 张`;
    head.append(copy, count);

    const grid = document.createElement("div");
    grid.className = "article-record-image-grid";
    grid.style.setProperty("--article-record-columns", String(columnCount));
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "article-record-empty";
      empty.textContent = emptyText;
      grid.appendChild(empty);
    } else {
      items.forEach((item) => {
        grid.appendChild(createArticleRecordCard(item, set.setId));
      });
    }

    section.append(head, grid);
    sections.appendChild(section);
  };

  appendRecordSection(referenceItems, "参考图", "人物和高频场景集中在这里，后续插图用它们保持一致性。", "本组记录没有单独参考图。");
  appendRecordSection(storyboardItems, "正文插图", "按正文阅读顺序排列，和参考图分开查看。", "本组记录没有正文插图。");
  refs.articleRecordDetail.appendChild(sections);
}

function renderArticleRecordView() {
  if (!refs.articleRecordList) {
    return;
  }

  const filteredSets = filterArticleRecordSets();
  const selectedSet = getArticleRecordSelectedSet();
  if (refs.articleRecordSearchInput && refs.articleRecordSearchInput.value !== state.articleIllustration.recordQuery) {
    refs.articleRecordSearchInput.value = state.articleIllustration.recordQuery;
  }
  refs.articleRecordCount.textContent = state.articleIllustration.recordQuery
    ? `${filteredSets.length} / ${state.articleIllustration.sets.length} 套`
    : `${state.articleIllustration.sets.length} 套`;
  refs.articleRecordCopyPromptsButton.disabled = !buildArticlePromptText(selectedSet);
  refs.articleRecordCopyCaptionsButton.disabled = !buildArticleCaptionText(selectedSet);
  refs.articleRecordContinueButton.disabled = !selectedSet?.items?.some((item) => item.status === "failed");

  renderArticleRecordColumnPresetButtons();
  renderArticleRecordList();
  state.articleIllustration.recordSetId = selectedSet?.setId || "";
  renderArticleRecordDetail(selectedSet);
}

function normalizeCreationItemForView(item = {}, fallbackIndex = 0) {
  const imageUrl = String(item.imageUrl || item.thumbnailUrl || item.previewUrl || "");
  const status = String(item.status || (imageUrl ? "completed" : "queued"));
  return {
    itemId: String(item.itemId || `slot-${fallbackIndex + 1}`),
    slotIndex: Number(item.slotIndex) || fallbackIndex + 1,
    role: String(item.role || CREATION_PREVIEW_SLOTS[fallbackIndex]?.role || ""),
    title: String(item.title || CREATION_PREVIEW_SLOTS[fallbackIndex]?.title || ""),
    brief: String(item.brief || CREATION_PREVIEW_SLOTS[fallbackIndex]?.brief || ""),
    filename: String(item.filename || ""),
    relativePath: String(item.relativePath || ""),
    prompt: String(item.prompt || ""),
    marketingCopy: String(item.marketingCopy || ""),
    status,
    imageUrl,
    thumbnailUrl: String(item.thumbnailUrl || imageUrl),
    error: String(item.error || ""),
    generationStartedAt: String(item.generationStartedAt || ""),
    generationCompletedAt: String(item.generationCompletedAt || ""),
    generationDurationMs: String(item.generationDurationMs || ""),
  };
}

function normalizeCreationSetForView(set = {}) {
  const items = (Array.isArray(set.items) ? set.items : [])
    .map((item, index) => normalizeCreationItemForView(item, index))
    .sort((left, right) => left.slotIndex - right.slotIndex);
  const status = String(set.status || "");
  const resolvedStatus =
    status || (items.every((item) => item.status === "completed") && items.length > 0
      ? "completed"
      : items.some((item) => item.status === "failed")
        ? "partial_failed"
        : items.some((item) => item.status === "generating" || item.status === "queued")
          ? "generating"
          : "planning");
  const industryTemplate = normalizeCreationIndustryTemplate(set.industryTemplate || "general");

  return {
    setId: String(set.setId || ""),
    productName: String(set.productName || ""),
    productDescription: String(set.productDescription || ""),
    sellingPoints: Array.isArray(set.sellingPoints) ? set.sellingPoints.map((item) => String(item)).filter(Boolean) : [],
    dimensionSpecs: String(set.dimensionSpecs || ""),
    dimensionUnitMode: normalizeCreationDimensionUnitMode(set.dimensionUnitMode),
    dimensionUnitModeLabel: String(set.dimensionUnitModeLabel || formatCreationDimensionUnitModeLabel(set.dimensionUnitMode)),
    targetLanguage: String(set.targetLanguage || "en"),
    targetLanguageLabel: String(set.targetLanguageLabel || ""),
    imageCount: Number(set.imageCount) || items.length || 4,
    selectedRoles: normalizeCreationRoleIds(set.selectedRoles || items.map((item) => item.role)),
    scenario: String(set.scenario || "standard"),
    scenarioLabel: String(set.scenarioLabel || CREATION_SCENARIO_LABELS[set.scenario] || ""),
    industryTemplate: String(set.industryTemplate || industryTemplate.value || "general"),
    industryTemplateLabel: String(set.industryTemplateLabel || industryTemplate.label || ""),
    industryTemplatePath: String(set.industryTemplatePath || industryTemplate.categoryPath || ""),
    referenceImageNames: Array.isArray(set.referenceImageNames)
      ? set.referenceImageNames.map((item) => String(item)).filter(Boolean)
      : [],
    referenceImageRoles: Array.isArray(set.referenceImageRoles)
      ? set.referenceImageRoles
          .map((item) => ({
            filename: String(item?.filename || ""),
            role: String(item?.role || "product"),
            roleLabel: String(item?.roleLabel || getCreationReferenceRoleLabel(item?.role || "product")),
            note: String(item?.note || item?.analysisNote || item?.description || ""),
          }))
          .filter((item) => item.filename)
      : [],
    logo: normalizeCreationLogoPayload(set.logo || set.creationLogo || null),
    createdAt: String(set.createdAt || nowIso()),
    updatedAt: String(set.updatedAt || set.createdAt || nowIso()),
    status: resolvedStatus,
    relativeDir: String(set.relativeDir || ""),
    items,
  };
}

function buildCreationReferenceRestoreQueue(set = {}) {
  const normalized = normalizeCreationSetForView(set);
  const roles = Array.isArray(normalized.referenceImageRoles) ? normalized.referenceImageRoles : [];
  const names = Array.isArray(normalized.referenceImageNames) ? normalized.referenceImageNames : [];
  const usedRoleIndexes = new Set();
  const queue = [];

  const createEntry = (roleEntry = {}, filename = "", index = 0) => {
    const resolvedFilename = String(filename || roleEntry?.filename || `reference-image-${index + 1}`).trim();
    if (!resolvedFilename) {
      return null;
    }

    const role = String(roleEntry?.role || "product").trim();
    return {
      id: `creation-reference-restore-${index}-${resolvedFilename.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      filename: resolvedFilename,
      role,
      roleLabel: String(roleEntry?.roleLabel || getCreationReferenceRoleLabel(role)).trim(),
      note: String(roleEntry?.note || "").trim(),
      status: "missing",
      referenceId: "",
      uploadedFilename: "",
    };
  };

  names.forEach((filename, index) => {
    const normalizedName = filename.toLowerCase();
    let roleIndex = roles.findIndex(
      (entry, entryIndex) => !usedRoleIndexes.has(entryIndex) && String(entry.filename || "").toLowerCase() === normalizedName,
    );
    if (roleIndex < 0 && roles[index] && !usedRoleIndexes.has(index)) {
      roleIndex = index;
    }
    if (roleIndex >= 0) {
      usedRoleIndexes.add(roleIndex);
    }

    const entry = createEntry(roleIndex >= 0 ? roles[roleIndex] : {}, filename, queue.length);
    if (entry) {
      queue.push(entry);
    }
  });

  roles.forEach((entry, index) => {
    if (usedRoleIndexes.has(index)) {
      return;
    }
    const restoreEntry = createEntry(entry, entry.filename, queue.length);
    if (restoreEntry) {
      queue.push(restoreEntry);
    }
  });

  return queue;
}

function findCreationReferenceRestoreEntryForFile(file, restoreQueue = state.creationReferenceRestoreQueue) {
  const missingEntries = (Array.isArray(restoreQueue) ? restoreQueue : []).filter((entry) => entry.status !== "uploaded");
  if (missingEntries.length === 0) {
    return null;
  }

  const filename = String(file?.name || "").trim().toLowerCase();
  return missingEntries.find((entry) => entry.filename.toLowerCase() === filename) || missingEntries[0] || null;
}

function markCreationReferenceRestoreEntryMissing(restoreEntryId) {
  if (!restoreEntryId) {
    return;
  }

  state.creationReferenceRestoreQueue = state.creationReferenceRestoreQueue.map((entry) =>
    entry.id === restoreEntryId
      ? {
          ...entry,
          status: "missing",
          referenceId: "",
          uploadedFilename: "",
        }
      : entry,
  );
}

function syncCreationReferenceRestoreQueueBindings(referenceFiles = state.creationReferenceFiles) {
  state.creationReferenceRestoreQueue = state.creationReferenceRestoreQueue.map((entry) => {
    const boundFile = referenceFiles.find((item) => item.restoreEntryId === entry.id);
    if (!boundFile) {
      return {
        ...entry,
        status: "missing",
        referenceId: "",
        uploadedFilename: "",
      };
    }

    return {
      ...entry,
      status: "uploaded",
      referenceId: boundFile.id,
      uploadedFilename: boundFile.file?.name || boundFile.uploadedFilename || "",
    };
  });
}

function bindCreationReferenceToRestoreEntry(referenceId, restoreEntryId) {
  const normalizedReferenceId = String(referenceId || "").trim();
  const normalizedRestoreId = String(restoreEntryId || "").trim();
  const target = state.creationReferenceFiles.find((item) => item.id === normalizedReferenceId);
  if (!target) {
    return;
  }

  const nextRestoreEntry = state.creationReferenceRestoreQueue.find((entry) => entry.id === normalizedRestoreId);
  state.creationReferenceFiles = state.creationReferenceFiles.map((item) => {
    if (item.id !== normalizedReferenceId) {
      if (normalizedRestoreId && item.restoreEntryId === normalizedRestoreId) {
        return {
          ...item,
          restoreEntryId: "",
          restoredFromRecordFilename: "",
          note: "",
        };
      }

      return item;
    }

    if (!nextRestoreEntry) {
      return {
        ...item,
        restoreEntryId: "",
        restoredFromRecordFilename: "",
        note: "",
      };
    }

    return {
      ...item,
      restoreEntryId: normalizedRestoreId,
      restoredFromRecordFilename: nextRestoreEntry.filename,
      role: nextRestoreEntry.role || item.role || "product",
      note: nextRestoreEntry.note || "",
    };
  });
  syncCreationReferenceRestoreQueueBindings();
  markCreationReferenceAnalysisDirty();
  renderCreationReferenceGrid();
}

function renderCreationReferenceRestoreList() {
  if (!refs.creationReferenceRestoreList) {
    return;
  }

  const restoreQueue = state.creationReferenceRestoreQueue;
  refs.creationReferenceRestoreList.replaceChildren();
  refs.creationReferenceRestoreList.classList.toggle("hidden", restoreQueue.length === 0);
  if (restoreQueue.length === 0) {
    return;
  }

  const missingCount = restoreQueue.filter((entry) => entry.status !== "uploaded").length;
  const summary = document.createElement("div");
  summary.className = "creation-reference-restore-summary";
  summary.textContent =
    missingCount > 0
      ? `历史参考图需重传：${missingCount}/${restoreQueue.length} 张待补齐，重传后才会参与预览、生成和补图。`
      : `历史参考图已重传：${restoreQueue.length}/${restoreQueue.length} 张会参与预览、生成和补图。`;
  refs.creationReferenceRestoreList.appendChild(summary);

  restoreQueue.forEach((entry) => {
    const item = document.createElement("div");
    item.className = `creation-reference-restore-item ${entry.status === "uploaded" ? "is-uploaded" : "is-missing"}`;

    const copy = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = entry.filename;
    const meta = document.createElement("small");
    meta.textContent = [entry.roleLabel || getCreationReferenceRoleLabel(entry.role), entry.note].filter(Boolean).join(" · ");
    copy.append(title, meta);

    const status = document.createElement("em");
    status.className = "creation-reference-restore-status";
    status.textContent = entry.status === "uploaded" ? `已重传${entry.uploadedFilename ? ` · ${entry.uploadedFilename}` : ""}` : "待重传";

    item.append(copy, status);
    refs.creationReferenceRestoreList.appendChild(item);
  });
}

function resetCreationReferenceFilesForRecordReuse(normalized = null) {
  state.creationReferenceFiles.forEach((item) => {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
  });
  state.creationReferenceFiles = [];
  state.creationReferenceRestoreQueue = buildCreationReferenceRestoreQueue(normalized);
  state.creationReferenceAnalysis = createEmptyCreationReferenceAnalysisState();
  if (refs.creationReferenceInput) {
    refs.creationReferenceInput.value = "";
  }
  setCreationReferenceAnalysisFeedback("", "");
  renderCreationReferenceRestoreList();
  renderCreationReferenceAnalysis();
}

function resetCreationLogoForRecordReuse(normalized = null) {
  const logo = normalizeCreationLogoPayload(normalized?.logo || null);
  revokeReferencePreview(state.creationLogo);
  state.creationLogo = {
    background: logo?.background || "transparent",
    file: null,
    generationCompressed: false,
    generationFile: null,
    generationFilePromise: null,
    placement: logo?.placement || "top-left",
    previewUrl: "",
  };
  if (refs.creationLogoInput) {
    refs.creationLogoInput.value = "";
  }
  renderCreationLogo();
}

function applyCreationSetToForm(set) {
  const normalized = normalizeCreationSetForView(set);
  refs.creationProductNameInput.value = normalized.productName || "";
  refs.creationProductDescriptionInput.value = normalized.productDescription || "";
  refs.creationSellingPointsInput.value = normalized.sellingPoints.join("\n");
  refs.creationDimensionSpecsInput.value = normalized.dimensionSpecs || "";
  setCreationSelectValue(refs.creationDimensionUnitModeInput, normalized.dimensionUnitMode, "both");
  setCreationSelectValue(refs.creationTargetLanguageInput, normalized.targetLanguage, "en");
  setCreationSelectValue(refs.creationScenarioInput, normalized.scenario, "standard");
  setCreationIndustryTemplateValue(normalized.industryTemplate, {
    searchText: normalized.industryTemplatePath || "",
  });

  const normalizedRoles = normalizeCreationRoleIds(
    normalized.selectedRoles.length > 0 ? normalized.selectedRoles : normalized.items.map((item) => item.role),
  );
  state.creationSelectedRoles = normalizedRoles.length > 0 ? normalizedRoles : getCreationRoleIdsForCount(normalized.imageCount);
  setCreationImageCountValue(state.creationSelectedRoles.length || normalized.imageCount);
  resetCreationReferenceFilesForRecordReuse(normalized);
  resetCreationLogoForRecordReuse(normalized);
  renderCreationRolePicker();
  renderCreationReferenceGrid();
}

function getCreationCurrentSet() {
  return state.creation.currentSet ? normalizeCreationSetForView(state.creation.currentSet) : null;
}

function isCreationDraftSet(set = getCreationCurrentSet()) {
  const setId = String(set?.setId || "");
  return setId.startsWith("creation-local-") || setId.startsWith("creation-draft-");
}

function canEditCreationItem(set = getCreationCurrentSet()) {
  return Boolean(set?.setId) && !state.creation.generating && !state.creation.planning && (canRepairCreationSet(set) || isCreationDraftSet(set));
}

function getCreationItemDraftKey(setId, itemId) {
  return `${setId || "draft"}:${itemId || ""}`;
}

function getCreationItemDraft(itemId, set = getCreationCurrentSet()) {
  const key = getCreationItemDraftKey(set?.setId, itemId);
  return String(state.creation.itemDrafts[key] || "");
}

function toggleCreationItemEditor(itemId) {
  state.creation.editingItemId = state.creation.editingItemId === itemId ? "" : itemId;
  renderCreationView();
}

function closeCreationItemEditor(itemId = state.creation.editingItemId) {
  if (!itemId || state.creation.editingItemId !== itemId) {
    return;
  }

  state.creation.editingItemId = "";
  renderCreationView();
}

function saveCreationItemDraft(itemId, promptOverride) {
  const currentSet = getCreationCurrentSet();
  if (!currentSet || !itemId) {
    return;
  }

  const existingItem = currentSet.items.find((item) => item.itemId === itemId);
  const nextPrompt = String(promptOverride || "").trim();
  const key = getCreationItemDraftKey(currentSet.setId, itemId);
  if (nextPrompt) {
    state.creation.itemDrafts[key] = nextPrompt;
  } else {
    delete state.creation.itemDrafts[key];
  }

  updateCreationCurrentItem(itemId, {
    prompt: nextPrompt || existingItem?.prompt || "",
    updatedAt: nowIso(),
  });
  state.creation.editingItemId = "";
  setCreationFeedback("已保存单张微调，重生成时会使用新的提示词。", "success");
  renderCreationView();
}

function getCreationProgressSummary(set = getCreationCurrentSet()) {
  const items = Array.isArray(set?.items) ? set.items : [];
  const total = items.length || Number(set?.imageCount) || getCreationSelectedImageCount();
  const completed = items.filter((item) => item.status === "completed").length;
  const failed = items.filter((item) => item.status === "failed").length;
  return { total, completed, failed };
}

function getCreationIncompleteItems(set = getCreationCurrentSet()) {
  const items = Array.isArray(set?.items) ? set.items : [];
  return items.filter((item) => item.status !== "completed" || !item.filename || !item.relativePath);
}

function canRepairCreationSet(set = getCreationCurrentSet()) {
  return Boolean(set?.setId && !isCreationDraftSet(set));
}

function renderCreationRecordDetail(set) {
  if (!refs.creationRecordDetail) {
    return;
  }

  refs.creationRecordDetail.innerHTML = "";
  const hasRepairableSet = canRepairCreationSet(set);
  const incompleteItems = getCreationIncompleteItems(set);
  if (refs.creationRepairFailedButton) {
    refs.creationRepairFailedButton.disabled = state.creation.generating || !hasRepairableSet || incompleteItems.length === 0;
    refs.creationRepairFailedButton.textContent = incompleteItems.length > 0 ? `补齐未完成项 ${incompleteItems.length}` : "补齐未完成项";
  }

  if (!set) {
    const empty = document.createElement("span");
    empty.textContent = "还没有选中套图记录。";
    refs.creationRecordDetail.appendChild(empty);
    return;
  }

  const progress = getCreationProgressSummary(set);
  const detailItems = [
    ["商品", set.productName || "未命名商品"],
    ["场景", set.scenarioLabel || CREATION_SCENARIO_LABELS[set.scenario] || "标准电商"],
    ["行业", set.industryTemplateLabel || CREATION_INDUSTRY_TEMPLATE_LABELS[set.industryTemplate] || "通用电商"],
    ["类目路径", set.industryTemplatePath || ""],
    ["尺寸规格", set.dimensionSpecs || ""],
    ["规格单位", set.dimensionUnitModeLabel || formatCreationDimensionUnitModeLabel(set.dimensionUnitMode)],
    ["语言", set.targetLanguageLabel || set.targetLanguage || "English"],
    ["进度", `${progress.completed}/${progress.total}`],
    ["参考图", set.referenceImageNames.length > 0 ? set.referenceImageNames.join("、") : "未使用"],
    ["参考用途", formatCreationReferenceRoleSummary(set.referenceImageRoles)],
    ["Logo", formatCreationLogoSummary(set.logo)],
  ];

  detailItems.filter(([, value]) => value).forEach(([label, value]) => {
    const item = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    item.appendChild(strong);
    item.append(document.createTextNode(value));
    refs.creationRecordDetail.appendChild(item);
  });
}

function upsertCreationSet(set) {
  const normalized = normalizeCreationSetForView(set);
  if (!normalized.setId) {
    return null;
  }

  state.creation.sets = [normalized, ...state.creation.sets.filter((entry) => entry.setId !== normalized.setId)];
  const currentSetId = state.creation.currentSet?.setId || "";
  if (!currentSetId || currentSetId === normalized.setId || currentSetId.startsWith("creation-local-") || state.creation.generating) {
    state.creation.currentSet = normalized;
  }
  renderCreationRecordView();

  return normalized;
}

function updateCreationCurrentItem(itemId, patch = {}) {
  const currentSet = getCreationCurrentSet();
  if (!currentSet || !itemId) {
    return null;
  }

  const nextItems = [...currentSet.items];
  const index = nextItems.findIndex((item) => item.itemId === itemId);
  const existing = index >= 0 ? nextItems[index] : { itemId };
  const nextItem = normalizeCreationItemForView({ ...existing, ...patch, itemId }, index >= 0 ? index : nextItems.length);

  if (index >= 0) {
    nextItems[index] = nextItem;
  } else {
    nextItems.push(nextItem);
  }

  const nextSet = normalizeCreationSetForView({
    ...currentSet,
    ...patch.set,
    items: nextItems,
    updatedAt: patch.updatedAt || nowIso(),
    status: patch.setStatus || currentSet.status,
  });
  state.creation.currentSet = nextSet;
  if (!isCreationDraftSet(nextSet)) {
    state.creation.sets = [nextSet, ...state.creation.sets.filter((entry) => entry.setId !== nextSet.setId)];
  }
  return nextSet;
}

function shouldShowCreationCardLoading(item = {}, showRecordActions = false) {
  if (showRecordActions || !state.creation.generating) {
    return false;
  }

  if (getImageUrl(item)) {
    return false;
  }

  const status = String(item.status || "queued");
  return !["completed", "failed"].includes(status);
}

function shouldHideCreationCardDetails(showRecordActions = false) {
  return !showRecordActions && state.creation.generating;
}

function createCreationCardLoading() {
  const loading = document.createElement("div");
  loading.className = "creation-card-loading";

  const motion = document.createElement("div");
  motion.className = "creation-card-loading-motion";
  motion.setAttribute("aria-hidden", "true");
  for (let index = 0; index < 3; index += 1) {
    motion.appendChild(document.createElement("span"));
  }

  const label = document.createElement("strong");
  label.textContent = "生成中";

  const detail = document.createElement("span");
  detail.className = "creation-card-loading-detail";
  detail.textContent = "正在生成套图图片";

  loading.append(motion, label, detail);
  return loading;
}

function createCreationCard(item = {}, fallbackIndex = 0, options = {}) {
  const showActions = options.showActions !== false;
  const showRecordActions = options.showRecordActions === true;
  const isLoadingCard = shouldShowCreationCardLoading(item, showRecordActions);
  const hideGenerationDetails = shouldHideCreationCardDetails(showRecordActions);
  const card = document.createElement("article");
  card.className = "creation-card";
  card.classList.toggle("is-record-card", showRecordActions);
  card.classList.toggle("is-generating", isLoadingCard);

  const head = document.createElement("div");
  head.className = "creation-card-head";

  const title = document.createElement("strong");
  title.textContent = item.title || CREATION_PREVIEW_SLOTS[fallbackIndex]?.title || `第 ${fallbackIndex + 1} 张`;
  head.appendChild(title);

  const status = document.createElement("span");
  status.className = "creation-card-status";
  status.textContent = isLoadingCard ? "生成中" : getCreationStatusLabel(item.status);
  head.appendChild(status);

  card.appendChild(head);

  const imageUrl = getImageUrl(item);
  const media = document.createElement(showRecordActions && imageUrl ? "button" : "div");
  media.className = "creation-card-media";
  if (showRecordActions && imageUrl) {
    media.type = "button";
    media.classList.add("creation-record-preview-media");
    media.dataset.creationRecordPreviewItemId = item.itemId;
    media.setAttribute("aria-label", `${item.title || "套图项"}查看大图`);
  }

  if (isLoadingCard) {
    media.classList.add("is-loading");
    media.setAttribute("aria-busy", "true");
    media.appendChild(createCreationCardLoading());
  } else if (imageUrl) {
    const image = document.createElement("img");
    image.loading = "lazy";
    image.decoding = "async";
    image.alt = item.title || `套图 ${fallbackIndex + 1}`;
    image.src = imageUrl;
    media.appendChild(image);
  } else {
    const placeholder = document.createElement("span");
    placeholder.textContent = item.status === "failed" ? item.error || "生成失败" : "等待生成";
    media.appendChild(placeholder);
  }
  card.appendChild(media);

  const shouldRenderPath = !imageUrl && !showRecordActions && !hideGenerationDetails;
  if (shouldRenderPath) {
    const path = document.createElement("span");
    path.className = "creation-card-path";
    path.textContent = item.error || "";
    path.title = path.textContent;
    path.hidden = !path.textContent;
    card.appendChild(path);
  }

  if (showActions && !hideGenerationDetails && state.creation.editingItemId === item.itemId) {
    const editor = document.createElement("div");
    editor.className = "creation-card-editor";
    editor.setAttribute("role", "dialog");
    editor.setAttribute("aria-label", "微调提示词");

    const editorHead = document.createElement("div");
    editorHead.className = "creation-card-editor-head";

    const editorTitle = document.createElement("strong");
    editorTitle.textContent = "微调提示词";
    editorHead.appendChild(editorTitle);

    const closeButton = document.createElement("button");
    closeButton.className = "creation-card-editor-close";
    closeButton.type = "button";
    closeButton.dataset.creationClosePromptEditor = item.itemId;
    closeButton.textContent = "x";
    closeButton.setAttribute("aria-label", "关闭微调浮窗");
    editorHead.appendChild(closeButton);
    editor.appendChild(editorHead);

    const textarea = document.createElement("textarea");
    textarea.dataset.creationPromptEditor = item.itemId;
    textarea.rows = 4;
    textarea.value = getCreationItemDraft(item.itemId) || item.prompt || "";
    textarea.placeholder = "调整这张图的生成提示词";
    editor.appendChild(textarea);

    const editorActions = document.createElement("div");
    editorActions.className = "creation-card-editor-actions";

    const saveButton = document.createElement("button");
    saveButton.className = "mini-action";
    saveButton.type = "button";
    saveButton.dataset.creationSavePromptItemId = item.itemId;
    saveButton.textContent = "保存微调";
    saveButton.disabled = state.creation.generating || state.creation.planning;
    editorActions.appendChild(saveButton);

    editor.appendChild(editorActions);
    refs.creationPromptEditorLayer?.appendChild(editor);
  }

  if (showActions && !hideGenerationDetails) {
    const actions = document.createElement("div");
    actions.className = "creation-card-actions";
    const editButton = document.createElement("button");
    editButton.className = "mini-action";
    editButton.type = "button";
    editButton.dataset.creationEditItemId = item.itemId;
    editButton.textContent = state.creation.editingItemId === item.itemId ? "收起" : "微调";
    editButton.disabled = !canEditCreationItem();
    editButton.setAttribute("aria-label", `${item.title || "套图项"}微调提示词`);
    actions.appendChild(editButton);

    const button = document.createElement("button");
    button.className = "mini-action";
    button.type = "button";
    button.dataset.creationRetryItemId = item.itemId;
    button.textContent = item.status === "completed" ? "重生成" : item.status === "failed" ? "重试" : "补图";
    button.disabled = state.creation.generating || !canRepairCreationSet();
    button.setAttribute("aria-label", `${item.title || "套图项"}${button.textContent}`);
    actions.appendChild(button);
    card.appendChild(actions);
  }

  if (showRecordActions) {
    const actions = document.createElement("div");
    actions.className = "creation-card-actions creation-record-card-actions";
    const itemTitle = item.title || "套图单张";

    const previewButton = document.createElement("button");
    previewButton.className = "mini-action";
    previewButton.type = "button";
    previewButton.dataset.creationRecordPreviewItemId = item.itemId;
    previewButton.textContent = "查看";
    previewButton.disabled = !imageUrl;
    previewButton.setAttribute("aria-label", `${itemTitle}查看大图`);
    actions.appendChild(previewButton);

    card.appendChild(actions);
  }

  return card;
}

function getCreationRecordSearchText(set = {}) {
  return [
    set.productName,
    set.productDescription,
    set.scenario,
    set.scenarioLabel,
    set.industryTemplate,
    set.industryTemplateLabel,
    set.industryTemplatePath,
    set.targetLanguage,
    set.targetLanguageLabel,
    ...(Array.isArray(set.sellingPoints) ? set.sellingPoints : []),
    ...(Array.isArray(set.referenceImageNames) ? set.referenceImageNames : []),
    ...(Array.isArray(set.items)
      ? set.items.flatMap((item) => [item.title, item.role, item.prompt, item.marketingCopy, item.filename, item.relativePath])
      : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function filterCreationRecordSets() {
  const query = String(state.creation.recordQuery || "").trim().toLowerCase();
  if (!query) {
    return state.creation.sets;
  }

  return state.creation.sets.filter((set) => getCreationRecordSearchText(set).includes(query));
}

function getCreationRecordSelectedSet() {
  const sets = filterCreationRecordSets();
  return sets.find((set) => set.setId === state.creation.recordSetId) || sets[0] || null;
}

function getCreationRecordImagePaths(set) {
  return Array.isArray(set?.items) ? set.items.map((item) => item.relativePath).filter(Boolean) : [];
}

function buildCreationRecordPathText(set) {
  const paths = getCreationRecordImagePaths(set);
  if (!set || paths.length === 0) {
    return "";
  }

  return [
    `套图: ${set.productName || "未命名商品"}`,
    `目录: ${set.relativeDir || "未记录目录"}`,
    "图片:",
    ...paths.map((path, index) => `${index + 1}. ${path}`),
  ].join("\n");
}

function buildCreationRecordPromptText(set) {
  const items = Array.isArray(set?.items) ? set.items : [];
  if (!set || items.length === 0) {
    return "";
  }

  return [
    `套图: ${set.productName || "未命名商品"}`,
    `记录: ${set.setId || "unknown"}`,
    `场景: ${set.scenarioLabel || set.scenario || "standard"}`,
    `行业: ${set.industryTemplateLabel || set.industryTemplate || "general"}`,
    "",
    ...items.flatMap((item, index) => [
      `${index + 1}. ${item.title || item.role || item.itemId || "套图单张"}`,
      item.prompt ? item.prompt : "",
      item.marketingCopy ? `文案: ${item.marketingCopy}` : "",
      "",
    ]),
  ]
    .map((line) => String(line || "").trimEnd())
    .join("\n")
    .trim();
}

function triggerBrowserTextDownload(text, filename, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename || "creation-record.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function downloadCreationRecordTextFile(text, filename, mimeType = "text/plain;charset=utf-8") {
  const value = String(text || "").trim();
  if (!value) {
    return;
  }

  triggerBrowserTextDownload(value, filename, mimeType);
}

async function fetchCreationRecordPathReport(set) {
  if (!set?.setId) {
    throw new Error("请先选择一套记录。");
  }

  const response = await fetch("/api/creation/sets/paths", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      setId: set.setId,
    }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "读取套图完整路径失败。");
  }

  return payload;
}

function buildCreationRecordFullPathText(payload, set) {
  const items = Array.isArray(payload?.items) ? payload.items.filter((item) => item.absolutePath) : [];
  if (!set || items.length === 0) {
    return "";
  }

  return [
    `套图: ${set.productName || payload.productName || "未命名商品"}`,
    `目录: ${payload.absoluteDir || set.relativeDir || "未记录目录"}`,
    "图片:",
    ...items.map((item, index) => `${index + 1}. ${item.absolutePath}`),
  ].join("\n");
}

async function copyCreationRecordPrompts() {
  const selectedSet = getCreationRecordSelectedSet();
  const text = buildCreationRecordPromptText(selectedSet);
  if (!text) {
    setCreationRecordFeedback("当前套图还没有可复制的提示词。", "error");
    return;
  }

  await writeTextToClipboard(text);
  setCreationRecordFeedback("已复制当前套图提示词。", "success");
}

function exportCreationRecordPrompts() {
  const selectedSet = getCreationRecordSelectedSet();
  const text = buildCreationRecordPromptText(selectedSet);
  if (!text) {
    setCreationRecordFeedback("当前套图还没有可导出的提示词。", "error");
    return;
  }

  downloadCreationRecordTextFile(text, `creation-prompts-${selectedSet.setId || "record"}.txt`);
  setCreationRecordFeedback("已导出当前套图提示词。", "success");
}

function exportCreationRecordManifest() {
  const selectedSet = getCreationRecordSelectedSet();
  if (!selectedSet) {
    setCreationRecordFeedback("请先选择一套记录。", "error");
    return;
  }

  downloadCreationRecordTextFile(
    `${JSON.stringify(selectedSet, null, 2)}\n`,
    `creation-record-${selectedSet.setId || "record"}.json`,
    "application/json;charset=utf-8",
  );
  setCreationRecordFeedback("已导出当前套图清单。", "success");
}

function getCreationRecordItemById(itemId, setId = "") {
  const selectedSet = setId
    ? state.creation.sets.find((set) => set.setId === setId) || null
    : getCreationRecordSelectedSet();
  if (!selectedSet || !itemId) {
    return null;
  }

  const item = selectedSet.items.find((entry) => entry.itemId === itemId) || null;
  return item ? { item, set: selectedSet } : null;
}

function buildCreationRecordLightboxItem(item, set) {
  const relativeFilename = String(item.relativePath || "").split(/[\\/]/).filter(Boolean).pop() || "";
  return {
    ...item,
    id: `creation-record:${set.setId}:${item.itemId || item.filename || relativeFilename}`,
    creationItemId: item.itemId || "",
    creationSetId: set.setId || "",
    filename: item.filename || relativeFilename || "creation-item.png",
    createdAt: item.generationCompletedAt || set.updatedAt || set.createdAt || nowIso(),
    prompt: item.prompt || "",
    imageModel: item.imageModel || "gpt-image-2",
    isCreationRecordItem: true,
  };
}

function openCreationRecordItemPreview(itemId) {
  const record = getCreationRecordItemById(itemId);
  if (!record?.item || !getImageUrl(record.item)) {
    setCreationRecordFeedback("当前单张还没有可查看的大图。", "error");
    return;
  }

  openLightbox(buildCreationRecordLightboxItem(record.item, record.set));
}

async function copyCreationRecordItemPath(itemId, setId = "") {
  const record = getCreationRecordItemById(itemId, setId);
  const pathText = String(record?.item?.relativePath || "").trim();
  if (!pathText) {
    setCreationRecordFeedback("当前单张没有可复制的图片路径。", "error");
    return;
  }

  await writeTextToClipboard(pathText);
  setCreationRecordFeedback("已复制单张图片路径。", "success");
}

async function copyCreationRecordItemFullPath(itemId, setId = "") {
  const record = getCreationRecordItemById(itemId, setId);
  if (!record?.item) {
    setCreationRecordFeedback("请先选择一个套图单张。", "error");
    return;
  }

  const payload = await fetchCreationRecordPathReport(record.set);
  const item = Array.isArray(payload?.items) ? payload.items.find((entry) => entry.itemId === itemId) : null;
  const pathText = String(item?.absolutePath || "").trim();
  if (!pathText) {
    setCreationRecordFeedback("当前单张没有可复制的完整路径。", "error");
    return;
  }

  await writeTextToClipboard(pathText);
  setCreationRecordFeedback("已复制单张完整路径。", "success");
}

async function copyLightboxCreationRecordPath() {
  const itemId = state.lightboxItem?.creationItemId || state.lightboxItem?.itemId || "";
  const setId = state.lightboxItem?.creationSetId || "";
  await copyCreationRecordItemPath(itemId, setId);
}

async function copyLightboxCreationRecordFullPath() {
  const itemId = state.lightboxItem?.creationItemId || state.lightboxItem?.itemId || "";
  const setId = state.lightboxItem?.creationSetId || "";
  await copyCreationRecordItemFullPath(itemId, setId);
}

function renderCreationRecordSetList() {
  if (!refs.creationRecordSetList) {
    return;
  }

  refs.creationRecordSetList.innerHTML = "";
  const selectedSet = getCreationRecordSelectedSet();
  const selectedSetId = selectedSet?.setId || "";
  const sets = filterCreationRecordSets().slice(0, 60);

  if (sets.length === 0) {
    const empty = document.createElement("div");
    empty.className = "creation-record";
    empty.textContent = state.creation.recordQuery ? "没有匹配的套图记录" : "暂无套图记录";
    refs.creationRecordSetList.appendChild(empty);
    return;
  }

  sets.forEach((set) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "creation-record";
    button.dataset.creationRecordSetId = set.setId;
    button.classList.toggle("active", set.setId === selectedSetId);

    const title = document.createElement("strong");
    title.className = "creation-record-title";
    title.textContent = set.productName || "未命名商品";
    button.appendChild(title);

    const meta = document.createElement("span");
    meta.className = "creation-record-meta";
    const progress = getCreationProgressSummary(set);
    const languageLabel = set.targetLanguageLabel || set.targetLanguage || "English";
    meta.textContent = `${languageLabel} · ${progress.completed}/${progress.total} · ${formatClock(set.createdAt)}`;
    button.appendChild(meta);

    refs.creationRecordSetList.appendChild(button);
  });
}

function selectCreationRecord(setId) {
  const set = filterCreationRecordSets().find((entry) => entry.setId === setId);
  if (!set) {
    return;
  }

  state.creation.recordSetId = set.setId;
  setCreationRecordFeedback();
  renderCreationRecordView();
}

async function openCreationRecordFolder() {
  const selectedSet = getCreationRecordSelectedSet();
  if (!selectedSet?.setId) {
    setCreationRecordFeedback("请先选择一套记录。", "error");
    return;
  }

  const response = await fetch("/api/creation/sets/open-folder", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      setId: selectedSet.setId,
    }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "打开套图文件夹失败。");
  }

  setCreationRecordFeedback("已打开套图文件夹。", "success");
}

async function copyCreationRecordPaths() {
  const selectedSet = getCreationRecordSelectedSet();
  const text = buildCreationRecordPathText(selectedSet);
  if (!text) {
    setCreationRecordFeedback("当前套图还没有可复制的图片路径。", "error");
    return;
  }

  await writeTextToClipboard(text);
  setCreationRecordFeedback("已复制当前套图图片路径。", "success");
}

async function copyCreationRecordFullPaths() {
  const selectedSet = getCreationRecordSelectedSet();
  if (getCreationRecordImagePaths(selectedSet).length === 0) {
    setCreationRecordFeedback("当前套图还没有可复制的完整图片路径。", "error");
    return;
  }

  const payload = await fetchCreationRecordPathReport(selectedSet);
  const text = buildCreationRecordFullPathText(payload, selectedSet);
  if (!text) {
    setCreationRecordFeedback("当前套图还没有可复制的完整图片路径。", "error");
    return;
  }

  await writeTextToClipboard(text);
  setCreationRecordFeedback("已复制当前套图完整图片路径。", "success");
}

function reuseCreationRecordSet() {
  const selectedSet = getCreationRecordSelectedSet();
  if (!selectedSet) {
    return;
  }

  applyCreationSetToForm(selectedSet);
  state.creation.currentSet = normalizeCreationSetForView(selectedSet);
  state.creation.editingItemId = "";
  setCreationFeedback("已载入历史套图，商品信息与角色已同步；如需沿用参考图，请重新上传原图。", "success");
  setActiveView("creation");
  renderCreationView();
}

function renderCreationRecordArchiveDetail(set) {
  if (!refs.creationRecordArchiveDetail) {
    return;
  }

  refs.creationRecordArchiveDetail.innerHTML = "";
  const archive = refs.creationRecordArchiveDetail.closest(".creation-record-archive");
  archive?.classList.toggle("is-empty", !set);

  if (!set) {
    const empty = document.createElement("span");
    empty.textContent = "还没有套图记录。";
    refs.creationRecordArchiveDetail.appendChild(empty);
    return;
  }

  const progress = getCreationProgressSummary(set);
  const detailItems = [
    ["商品", set.productName || "未命名商品"],
    ["场景", set.scenarioLabel || CREATION_SCENARIO_LABELS[set.scenario] || "标准电商"],
    ["行业", set.industryTemplateLabel || CREATION_INDUSTRY_TEMPLATE_LABELS[set.industryTemplate] || "通用电商"],
    ["类目路径", set.industryTemplatePath || ""],
    ["尺寸规格", set.dimensionSpecs || ""],
    ["规格单位", set.dimensionUnitModeLabel || formatCreationDimensionUnitModeLabel(set.dimensionUnitMode)],
    ["语言", set.targetLanguageLabel || set.targetLanguage || "English"],
    ["进度", `${progress.completed}/${progress.total}`],
    ["创建时间", formatClock(set.createdAt)],
    ["参考图", set.referenceImageNames.length > 0 ? set.referenceImageNames.join("、") : "未使用"],
    ["参考用途", formatCreationReferenceRoleSummary(set.referenceImageRoles)],
  ];

  detailItems.filter(([, value]) => value).forEach(([label, value]) => {
    const item = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    item.appendChild(strong);
    item.append(document.createTextNode(value));
    refs.creationRecordArchiveDetail.appendChild(item);
  });
}

function renderCreationRecordView() {
  const filteredSets = filterCreationRecordSets();
  const selectedSet = getCreationRecordSelectedSet();
  if (refs.creationRecordSearchInput && refs.creationRecordSearchInput.value !== state.creation.recordQuery) {
    refs.creationRecordSearchInput.value = state.creation.recordQuery;
  }
  if (refs.creationRecordCount) {
    refs.creationRecordCount.textContent = state.creation.recordQuery
      ? `${filteredSets.length} / ${state.creation.sets.length} 套`
      : `${state.creation.sets.length} 套`;
  }
  if (refs.creationRecordReuseButton) {
    refs.creationRecordReuseButton.disabled = !selectedSet;
  }
  if (refs.creationRecordOpenFolderButton) {
    refs.creationRecordOpenFolderButton.disabled = !selectedSet?.relativeDir;
  }
  if (refs.creationRecordCopyPathsButton) {
    refs.creationRecordCopyPathsButton.disabled = getCreationRecordImagePaths(selectedSet).length === 0;
  }
  if (refs.creationRecordCopyFullPathsButton) {
    refs.creationRecordCopyFullPathsButton.disabled = getCreationRecordImagePaths(selectedSet).length === 0;
  }
  if (refs.creationRecordCopyPromptsButton) {
    refs.creationRecordCopyPromptsButton.disabled = !buildCreationRecordPromptText(selectedSet);
  }
  if (refs.creationRecordExportPromptsButton) {
    refs.creationRecordExportPromptsButton.disabled = !buildCreationRecordPromptText(selectedSet);
  }
  if (refs.creationRecordExportManifestButton) {
    refs.creationRecordExportManifestButton.disabled = !selectedSet;
  }

  renderCreationRecordSetList();
  state.creation.recordSetId = selectedSet?.setId || "";
  renderCreationRecordArchiveDetail(selectedSet);

  if (!refs.creationRecordResultGrid) {
    return;
  }

  refs.creationRecordResultGrid.innerHTML = "";
  refs.creationRecordResultGrid.classList.toggle("hidden", !selectedSet);
  if (!selectedSet) {
    return;
  }

  selectedSet.items.forEach((item, index) => {
    refs.creationRecordResultGrid.appendChild(createCreationCard(item, index, { showActions: false, showRecordActions: true }));
  });
}

function openCreationReferencePreview(referenceId) {
  const item = state.creationReferenceFiles.find((entry) => entry.id === referenceId);
  if (!item?.previewUrl) {
    return;
  }

  state.creationReferencePreviewItem = item;
  refs.referencePreviewImage.src = item.previewUrl;
  refs.referencePreviewViewer.classList.add("open");
  refs.referencePreviewViewer.setAttribute("aria-hidden", "false");
}

function removeCreationReferenceFile(referenceId) {
  const target = state.creationReferenceFiles.find((item) => item.id === referenceId);
  if (state.creationReferencePreviewItem?.id === referenceId) {
    closeReferencePreview();
  }
  revokeReferencePreview(target);
  state.creationReferenceFiles = state.creationReferenceFiles.filter((item) => item.id !== referenceId);
  markCreationReferenceRestoreEntryMissing(target?.restoreEntryId);
  markCreationReferenceAnalysisDirty();
  renderCreationReferenceGrid();
}

function updateCreationReferenceRole(referenceId, role) {
  state.creationReferenceFiles = state.creationReferenceFiles.map((item) =>
    item.id === referenceId ? { ...item, role: role || "product" } : item,
  );
  renderCreationReferenceGrid();
}

function removeCreationLogoFile() {
  revokeReferencePreview(state.creationLogo);
  state.creationLogo = {
    ...state.creationLogo,
    file: null,
    generationCompressed: false,
    generationFile: null,
    generationFilePromise: null,
    previewUrl: "",
  };
  if (refs.creationLogoInput) {
    refs.creationLogoInput.value = "";
  }
  renderCreationLogo();
  renderCreationView();
}

function applyCreationLogoFile(fileList) {
  const file = [...(fileList || [])].find((item) => item.type.startsWith("image/"));
  if (!file) {
    return;
  }

  revokeReferencePreview(state.creationLogo);
  state.creationLogo = {
    background: normalizeCreationLogoBackground(refs.creationLogoBackgroundInput?.value || state.creationLogo.background),
    file,
    generationCompressed: false,
    generationFile: file,
    generationFilePromise: null,
    placement: normalizeCreationLogoPlacement(refs.creationLogoPlacementInput?.value || state.creationLogo.placement),
    previewUrl: URL.createObjectURL(file),
  };
  if (refs.creationLogoInput) {
    refs.creationLogoInput.value = "";
  }
  startCreationLogoGenerationCompression(state.creationLogo);
  renderCreationLogo();
  renderCreationView();
}

function applyCreationReferenceFiles(fileList) {
  const incomingFiles = [...(fileList || [])].filter((file) => file.type.startsWith("image/"));
  if (incomingFiles.length === 0) {
    return;
  }

  const next = [...state.creationReferenceFiles];
  let restoreQueue = [...state.creationReferenceRestoreQueue];
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

    const restoreEntry = findCreationReferenceRestoreEntryForFile(file, restoreQueue);
    const referenceItem = {
      id: `creation-ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fingerprint,
      file,
      generationFile: file,
      generationFilePromise: null,
      generationCompressed: false,
      previewUrl: URL.createObjectURL(file),
      role: restoreEntry?.role || "product",
      note: restoreEntry?.note || "",
      restoreEntryId: restoreEntry?.id || "",
      restoredFromRecordFilename: restoreEntry?.filename || "",
    };
    startCreationReferenceGenerationCompression(referenceItem);
    next.push(referenceItem);
    if (restoreEntry) {
      restoreQueue = restoreQueue.map((entry) =>
        entry.id === restoreEntry.id
          ? {
              ...entry,
              status: "uploaded",
              referenceId: referenceItem.id,
              uploadedFilename: file.name,
            }
          : entry,
      );
    }
    fingerprints.add(fingerprint);
  }

  state.creationReferenceFiles = next;
  state.creationReferenceRestoreQueue = restoreQueue;
  markCreationReferenceAnalysisDirty();
  if (refs.creationReferenceInput) {
    refs.creationReferenceInput.value = "";
  }
  renderCreationReferenceGrid();
  renderCreationView();

  if (overflowed) {
    showError(`套图参考图最多支持 ${state.limits.maxReferenceImages} 张。`);
  }
}

function renderCreationLogo() {
  if (!refs.creationLogoPreview) {
    return;
  }

  const logo = state.creationLogo || {};
  const hasLogo = Boolean(logo.file && logo.previewUrl);
  state.creationLogo.placement = normalizeCreationLogoPlacement(refs.creationLogoPlacementInput?.value || logo.placement);
  state.creationLogo.background = normalizeCreationLogoBackground(refs.creationLogoBackgroundInput?.value || logo.background);

  if (refs.creationLogoPlacementInput) {
    refs.creationLogoPlacementInput.value = state.creationLogo.placement;
  }
  if (refs.creationLogoBackgroundInput) {
    refs.creationLogoBackgroundInput.value = state.creationLogo.background;
  }

  refs.creationLogoPreview.classList.toggle("hidden", !hasLogo);
  if (refs.creationLogoPreviewImage) {
    if (hasLogo) {
      refs.creationLogoPreviewImage.src = logo.previewUrl;
    } else {
      refs.creationLogoPreviewImage.removeAttribute("src");
    }
  }
  if (refs.creationLogoFilename) {
    refs.creationLogoFilename.textContent = hasLogo ? logo.file.name || "Logo" : "未上传";
  }
  syncReferenceDropzoneCompact(refs.creationLogoDropzone, hasLogo);
}

function renderCreationReferenceGrid() {
  if (!refs.creationReferenceGrid) {
    return;
  }

  refs.creationReferenceGrid.innerHTML = "";
  refs.creationReferenceCount.textContent = `${state.creationReferenceFiles.length} / ${state.limits.maxReferenceImages}`;
  syncReferenceDropzoneCompact(refs.creationReferenceDropzone, state.creationReferenceFiles.length > 0);
  refs.creationReferenceGrid.classList.toggle("hidden", state.creationReferenceFiles.length === 0);

  state.creationReferenceFiles.forEach((item) => {
    const card = document.createElement("div");
    card.className = "reference-card";

    const previewButton = document.createElement("button");
    previewButton.type = "button";
    previewButton.className = "reference-preview-button";
    previewButton.dataset.creationReferencePreviewId = item.id;
    previewButton.setAttribute("aria-label", "放大查看套图参考图");

    const image = document.createElement("img");
    image.src = item.previewUrl;
    image.alt = "套图参考图预览";
    previewButton.appendChild(image);
    card.appendChild(previewButton);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "reference-remove";
    remove.textContent = "x";
    remove.setAttribute("aria-label", "移除套图参考图");
    remove.addEventListener("click", () => removeCreationReferenceFile(item.id));
    card.appendChild(remove);

    const roleSelect = document.createElement("select");
    roleSelect.className = "creation-reference-role";
    roleSelect.dataset.creationReferenceRoleId = item.id;
    roleSelect.setAttribute("aria-label", "选择套图参考图用途");
    CREATION_REFERENCE_ROLE_OPTIONS.forEach((option) => {
      const choice = document.createElement("option");
      choice.value = option.value;
      choice.textContent = option.label;
      choice.selected = (item.role || "product") === option.value;
      roleSelect.appendChild(choice);
    });
    card.appendChild(roleSelect);

    if (state.creationReferenceRestoreQueue.length > 0) {
      const select = document.createElement("select");
      select.className = "creation-reference-bind";
      select.dataset.creationReferenceRestoreBindId = item.id;
      select.setAttribute("aria-label", "绑定历史参考图");

      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "不绑定历史参考图";
      blank.selected = !item.restoreEntryId;
      select.appendChild(blank);

      state.creationReferenceRestoreQueue.forEach((entry) => {
        const option = document.createElement("option");
        option.value = entry.id;
        option.textContent = `${entry.filename}${entry.referenceId && entry.referenceId !== item.id ? "（已绑定）" : ""}`;
        option.selected = item.restoreEntryId === entry.id;
        select.appendChild(option);
      });

      card.appendChild(select);
    }

    if (item.note) {
      const note = document.createElement("span");
      note.className = "creation-reference-note";
      note.textContent = item.note;
      card.appendChild(note);
    }

    refs.creationReferenceGrid.appendChild(card);
  });
  if (state.creationReferenceFiles.length > 0 && state.creationReferenceFiles.length < state.limits.maxReferenceImages) {
    refs.creationReferenceGrid.appendChild(
      createReferenceAddCard({
        input: refs.creationReferenceInput,
        label: "继续上传套图参考图",
        onFiles: applyCreationReferenceFiles,
      }),
    );
  }
  renderCreationReferenceRestoreList();
  renderCreationReferenceAnalysis();
}

function buildCreationReferenceRolePayload() {
  return state.creationReferenceFiles.map((item, index) => ({
    filename: item.file?.name || `reference-image-${index + 1}`,
    role: item.role || "product",
    note: item.note || "",
  }));
}

function getCreationLogoPayload() {
  const logoFile = getCreationLogoGenerationFile();
  const placement = normalizeCreationLogoPlacement(refs.creationLogoPlacementInput?.value || state.creationLogo.placement);
  const background = normalizeCreationLogoBackground(refs.creationLogoBackgroundInput?.value || state.creationLogo.background);

  state.creationLogo.placement = placement;
  state.creationLogo.background = background;

  return {
    enabled: Boolean(logoFile),
    filename: logoFile?.name || "",
    placement,
    background,
  };
}

function formatCreationReferenceRoleSummary(referenceImageRoles = []) {
  const roles = Array.isArray(referenceImageRoles) ? referenceImageRoles : [];
  if (roles.length === 0) {
    return "未标注";
  }

  return roles
    .map((item) => {
      const filename = String(item?.filename || "").trim();
      const role = String(item?.role || "product").trim();
      const roleLabel = String(item?.roleLabel || getCreationReferenceRoleLabel(role)).trim();
      const note = String(item?.note || "").trim();
      return `${filename || "参考图"}: ${roleLabel}${note ? ` (${note})` : ""}`;
    })
    .join("、");
}

function formatCreationLogoSummary(logo = null) {
  const normalized = normalizeCreationLogoPayload(logo);
  if (!normalized) {
    return "未使用";
  }

  return `${normalized.filename} · ${normalized.placementLabel} · ${normalized.backgroundLabel}`;
}

function getCreationRepairReferenceRolePayload(set = getCreationCurrentSet()) {
  const uploadedRoles = buildCreationReferenceRolePayload();
  if (uploadedRoles.length > 0) {
    return uploadedRoles;
  }
  if (state.creationReferenceRestoreQueue.length > 0) {
    return [];
  }
  return Array.isArray(set?.referenceImageRoles) ? set.referenceImageRoles : [];
}

function setCreationReferenceAnalysisFeedback(message, kind = "") {
  if (!refs.creationReferenceAnalysisFeedback) {
    return;
  }

  refs.creationReferenceAnalysisFeedback.textContent = message ? compactErrorMessage(message, "套图参考图识别失败") : "";
  refs.creationReferenceAnalysisFeedback.dataset.state = kind;
}

function markCreationReferenceAnalysisDirty() {
  if (state.creationReferenceAnalysis.result) {
    state.creationReferenceAnalysis.applied = false;
    state.creationReferenceAnalysis.dirty = true;
    setCreationReferenceAnalysisFeedback("参考图已变化，请重新识别。", "busy");
  } else {
    setCreationReferenceAnalysisFeedback("", "");
  }
}

function normalizeCreationReferenceAnalysisRecommendation(entry = {}, index = 0) {
  const filename = String(state.creationReferenceFiles[index]?.file?.name || entry.filename || `reference-image-${index + 1}`).trim();
  if (!filename) {
    return null;
  }

  return {
    index: Number(entry.index) || index + 1,
    filename,
    role: CREATION_REFERENCE_ROLE_OPTIONS.some((option) => option.value === entry.role) ? entry.role : "product",
    roleLabel: String(entry.roleLabel || getCreationReferenceRoleLabel(entry.role || "product")),
    note: String(entry.note || "").trim(),
  };
}

function normalizeCreationReferenceAnalysisPayload(payload = {}) {
  const analysis = payload.analysis || payload;
  const recommendations = Array.isArray(analysis?.recommendations)
    ? analysis.recommendations
        .map((entry, index) => normalizeCreationReferenceAnalysisRecommendation(entry, index))
        .filter(Boolean)
    : [];

  return {
    summary: String(analysis?.summary || "已识别套图参考图用途").trim(),
    categoryHint: String(analysis?.categoryHint || analysis?.category_hint || analysis?.category || "").trim(),
    categoryPath: String(analysis?.categoryPath || analysis?.category_path || "").trim(),
    recommendations,
    risks: Array.isArray(analysis?.risks) ? analysis.risks.map((item) => String(item).trim()).filter(Boolean) : [],
  };
}

function getCreationReferenceAnalysisCategoryText(analysis = {}) {
  const recommendationText = Array.isArray(analysis.recommendations)
    ? analysis.recommendations.flatMap((entry) => [entry.filename, entry.roleLabel, entry.note])
    : [];

  return [
    analysis.categoryHint,
    analysis.categoryPath,
    analysis.summary,
    refs.creationProductNameInput?.value,
    refs.creationProductDescriptionInput?.value,
    refs.creationSellingPointsInput?.value,
    ...recommendationText,
  ]
    .filter(Boolean)
    .join(" ");
}

async function applyCreationReferenceAnalysisCategoryMatch(analysis) {
  await loadCreationCategoryTemplatesModule();
  const match = findCreationIndustryTemplateMatch(getCreationReferenceAnalysisCategoryText(analysis));
  if (!match?.template) {
    return null;
  }

  const template = match.template;
  const previousValue = refs.creationIndustryTemplateInput?.value || "general";
  analysis.categoryTemplateValue = template.value;
  analysis.categoryTemplateLabel = template.label;
  analysis.categoryTemplatePath = template.categoryPath || "";
  setCreationIndustryTemplateValue(template.value, {
    searchText: template.categoryPath || template.label,
  });
  if (previousValue !== template.value) {
    syncCreationSelectedRolesToIndustry();
  }
  return template;
}

async function applyCreationReferenceAnalysis(analysis) {
  const normalized = normalizeCreationReferenceAnalysisPayload(analysis);
  state.creationReferenceAnalysis.result = normalized;
  state.creationReferenceAnalysis.applied = false;
  state.creationReferenceAnalysis.dirty = false;
  const matchedTemplate = await applyCreationReferenceAnalysisCategoryMatch(normalized);
  renderCreationReferenceAnalysis();
  return matchedTemplate;
}

function getCreationReferenceAnalysisProductNameSuggestion(analysis = {}) {
  const templateLabel = String(analysis.categoryTemplateLabel || "").trim();
  if (templateLabel) {
    return templateLabel;
  }

  return (
    String(analysis.categoryTemplatePath || analysis.categoryPath || "")
      .split(">")
      .map((part) => part.trim())
      .filter(Boolean)
      .at(-1) || ""
  );
}

function applyCreationReferenceAnalysisProductNameSuggestion(analysis = {}) {
  const suggestion = getCreationReferenceAnalysisProductNameSuggestion(analysis);
  if (!suggestion || !refs.creationProductNameInput) {
    return false;
  }

  refs.creationProductNameInput.value = suggestion;
  refs.creationProductNameInput.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

function applyCreationReferenceAnalysisRecommendations() {
  const analysis = state.creationReferenceAnalysis.result;
  if (!analysis || state.creationReferenceAnalysis.dirty) {
    return;
  }

  const recommendationsByFilename = new Map(analysis.recommendations.map((entry) => [entry.filename, entry]));
  state.creationReferenceFiles = state.creationReferenceFiles.map((item, index) => {
    const filename = item.file?.name || `reference-image-${index + 1}`;
    const recommendation = recommendationsByFilename.get(filename) || analysis.recommendations[index];
    return recommendation
      ? {
          ...item,
          role: recommendation.role || item.role || "product",
          note: recommendation.note || "",
        }
      : item;
  });
  const productNameApplied = applyCreationReferenceAnalysisProductNameSuggestion(analysis);
  state.creationReferenceAnalysis.applied = true;
  setCreationReferenceAnalysisFeedback(
    productNameApplied
      ? `已应用 ${analysis.recommendations.length} 张参考图用途建议，商品名称已填入四级类目。`
      : `已应用 ${analysis.recommendations.length} 张参考图用途建议。`,
    "success",
  );
  renderCreationReferenceGrid();
}

function renderCreationReferenceAnalysis() {
  if (!refs.creationReferenceAnalysisPanel) {
    return;
  }

  refs.creationReferenceAnalyzeButton.disabled =
    state.creationReferenceAnalysis.running || state.creation.generating || state.creationReferenceFiles.length === 0;
  refs.creationReferenceAnalyzeButton.textContent = state.creationReferenceAnalysis.running ? "识别中..." : "智能识别";

  const analysis = state.creationReferenceAnalysis.result;
  if (refs.creationReferenceApplyAnalysisButton) {
    const canApply =
      Boolean(analysis) &&
      !state.creationReferenceAnalysis.dirty &&
      !state.creationReferenceAnalysis.applied &&
      !state.creationReferenceAnalysis.running &&
      !state.creation.generating;
    refs.creationReferenceApplyAnalysisButton.classList.toggle("hidden", !analysis);
    refs.creationReferenceApplyAnalysisButton.disabled = !canApply;
    refs.creationReferenceApplyAnalysisButton.textContent = state.creationReferenceAnalysis.applied ? "已应用" : "应用建议";
  }
  refs.creationReferenceAnalysisPanel.classList.toggle("hidden", !analysis);
  refs.creationReferenceAnalysisList.replaceChildren();

  if (!analysis) {
    refs.creationReferenceAnalysisSummary.textContent = "--";
    refs.creationReferenceAnalysisMeta.textContent = "--";
    return;
  }

  refs.creationReferenceAnalysisSummary.textContent = analysis.summary || "已识别套图参考图用途";
  refs.creationReferenceAnalysisMeta.textContent = [
    `${analysis.recommendations.length} 张建议`,
    analysis.categoryTemplatePath || analysis.categoryPath || analysis.categoryHint
      ? `类目: ${analysis.categoryTemplatePath || analysis.categoryPath || analysis.categoryHint}`
      : "",
    state.creationReferenceAnalysis.applied ? "已应用" : "待应用",
    state.creationReferenceAnalysis.dirty ? "参考图已变化" : "",
  ]
    .filter(Boolean)
    .join(" · ");

  analysis.recommendations.forEach((entry) => {
    const item = document.createElement("article");
    item.className = "reference-analysis-card creation-reference-analysis-card";

    const title = document.createElement("strong");
    title.textContent = `${entry.filename} · ${entry.roleLabel || getCreationReferenceRoleLabel(entry.role)}`;
    item.appendChild(title);

    const note = document.createElement("p");
    note.textContent = entry.note || "可应用到参考图用途。";
    item.appendChild(note);

    refs.creationReferenceAnalysisList.appendChild(item);
  });

  analysis.risks.forEach((riskText) => {
    const risk = document.createElement("p");
    risk.className = "reference-analysis-risk";
    risk.textContent = riskText;
    refs.creationReferenceAnalysisList.appendChild(risk);
  });
}

async function buildCreationReferenceAnalysisFormData() {
  const formData = new FormData();
  formData.set(
    "reasoningEffort",
    refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh",
  );
  const analysisFiles = await Promise.all(
    state.creationReferenceFiles.map((item) => preparePromptAnalysisImageFile(item.file)),
  );
  analysisFiles.forEach((file) => {
    formData.append("referenceImages", file);
  });
  appendBrowserConfigToFormData(formData);
  return formData;
}

async function analyzeCreationReferenceImages() {
  clearError();
  if (state.creationReferenceFiles.length === 0) {
    setCreationReferenceAnalysisFeedback("请先上传套图参考图。", "error");
    return;
  }

  state.creationReferenceAnalysis.running = true;
  setCreationReferenceAnalysisFeedback("正在识别参考图用途...", "busy");
  renderCreationReferenceAnalysis();

  try {
    const response = await fetch("/api/creation/reference/analyze", {
      method: "POST",
      body: await buildCreationReferenceAnalysisFormData(),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || "套图参考图识别失败。");
    }

    const matchedTemplate = await applyCreationReferenceAnalysis(payload);
    const count = state.creationReferenceAnalysis.result?.recommendations?.length || 0;
    const categoryMessage = matchedTemplate
      ? `，已切换到 ${matchedTemplate.categoryPath || matchedTemplate.label}`
      : "";
    setCreationReferenceAnalysisFeedback(`已识别 ${count} 张参考图用途建议${categoryMessage}，可点击应用建议。`, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setCreationReferenceAnalysisFeedback(message, "error");
    showError(message);
  } finally {
    state.creationReferenceAnalysis.running = false;
    renderCreationReferenceAnalysis();
  }
}

function renderCreationRolePicker() {
  if (!refs.creationRoleGrid) {
    return;
  }

  const selectedRoles = getCreationSelectedRoles();
  const selectedRoleSet = new Set(selectedRoles);
  if (refs.creationRoleCount) {
    refs.creationRoleCount.textContent = `${selectedRoles.length} / ${CREATION_PREVIEW_SLOTS.length}`;
  }

  refs.creationRoleGrid.innerHTML = "";
  CREATION_PREVIEW_SLOTS.forEach((slot) => {
    const label = document.createElement("label");
    label.className = "creation-role-option";
    label.classList.toggle("is-selected", selectedRoleSet.has(slot.role));

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = slot.role;
    input.checked = selectedRoleSet.has(slot.role);
    input.disabled = state.creation.generating;
    input.dataset.creationRole = slot.role;

    const text = document.createElement("span");
    text.textContent = slot.title;

    label.append(input, text);
    refs.creationRoleGrid.appendChild(label);
  });
}

function renderCreationView() {
  if (!refs.creationResultGrid) {
    return;
  }

  const currentSet = getCreationCurrentSet();
  const previewSlots = getCreationPreviewSlots(currentSet?.imageCount || getCreationSelectedImageCount());
  const items = currentSet?.items.length ? currentSet.items : previewSlots.map((slot, index) => ({
    ...slot,
    itemId: slot.itemId,
    slotIndex: index + 1,
    status: state.creation.generating ? "queued" : "idle",
  }));
  const progress = getCreationProgressSummary(currentSet);
  const preparingReferences = hasPendingCreationReferenceGenerationFiles() || hasPendingCreationLogoGenerationFile();
  const targetLanguageLabel =
    currentSet?.targetLanguageLabel ||
    getCreationSelectedLanguage().label ||
    refs.creationTargetLanguageInput?.value ||
    "English";

  refs.creationGenerateButton.textContent = state.creation.generating ? "生成中..." : "生成套图";
  refs.creationGenerateButton.disabled = state.creation.generating || state.creation.planning || preparingReferences;
  if (refs.creationPlanButton) {
    refs.creationPlanButton.textContent = state.creation.planning ? "预览中..." : "预览计划";
    refs.creationPlanButton.disabled = state.creation.generating || state.creation.planning;
  }
  refs.creationProgressText.textContent = `${progress.completed} / ${progress.total}`;
  renderCreationRolePicker();
  renderCreationReferenceGrid();
  renderCreationLogo();
  const currentIndustryLabel = currentSet?.industryTemplateLabel || CREATION_INDUSTRY_TEMPLATE_LABELS[currentSet?.industryTemplate] || "通用电商";
  refs.creationSetMeta.textContent = currentSet
    ? `${currentSet.productName || "未命名商品"} · ${currentSet.scenarioLabel || CREATION_SCENARIO_LABELS[currentSet.scenario] || "标准电商"} · ${currentIndustryLabel} · ${targetLanguageLabel} · ${CREATION_ITEM_STATUS_LABELS[currentSet.status] || currentSet.status} · ${formatClock(currentSet.createdAt)}`
    : "等待生成";

  renderCreationRecordDetail(currentSet);

  refs.creationResultGrid.innerHTML = "";
  refs.creationPromptEditorLayer?.replaceChildren();
  items.forEach((item, index) => {
    refs.creationResultGrid.appendChild(createCreationCard(item, index));
  });

}

function getCreationPlanOverrides() {
  const currentSet = getCreationCurrentSet();
  if (!currentSet?.items?.length) {
    return [];
  }

  return currentSet.items
    .map((item) => {
      const prompt = getCreationItemDraft(item.itemId, currentSet);
      if (!prompt) {
        return null;
      }

      return {
        itemId: item.itemId,
        role: item.role,
        slotIndex: item.slotIndex,
        prompt,
      };
    })
    .filter(Boolean);
}

function buildCreationPlanPreviewFormData() {
  const formData = new FormData();
  const targetLanguage = getCreationSelectedLanguage();
  const selectedRoles = getCreationSelectedRoles();

  formData.set("productName", refs.creationProductNameInput.value.trim());
  formData.set("productDescription", refs.creationProductDescriptionInput.value.trim());
  formData.set("sellingPoints", refs.creationSellingPointsInput.value.trim());
  formData.set("dimensionSpecs", refs.creationDimensionSpecsInput.value.trim());
  formData.set("dimensionUnitMode", refs.creationDimensionUnitModeInput.value || "both");
  formData.set("targetLanguage", targetLanguage.value);
  formData.set("imageCount", String(selectedRoles.length || getCreationSelectedImageCount()));
  formData.set("scenario", refs.creationScenarioInput.value);
  formData.set("industryTemplate", refs.creationIndustryTemplateInput.value);
  formData.set("selectedRoles", JSON.stringify(getCreationSelectedRoles()));
  formData.set("referenceImageRoles", JSON.stringify(buildCreationReferenceRolePayload()));
  formData.set("logoOptions", JSON.stringify(getCreationLogoPayload()));
  formData.set("planOverrides", JSON.stringify(getCreationPlanOverrides()));

  return formData;
}

function buildCreationFormData() {
  const formData = buildCreationPlanPreviewFormData();

  formData.set("format", normalizeOutputFormat(refs.creationOutputFormatInput.value || state.config?.defaults?.format || "png"));
  formData.set("ratio", refs.creationRatioInput.value || DEFAULT_UI_RATIO);
  formData.set("size", refs.creationSizeInput.value || "auto");
  formData.set("reasoningEffort", refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh");
  formData.set("clientSessionId", state.clientSessionId);
  state.creationReferenceFiles.forEach((item) => {
    const file = getCreationReferenceGenerationFile(item);
    if (file) {
      formData.append("referenceImages", file);
    }
  });
  const logoFile = getCreationLogoGenerationFile();
  if (logoFile) {
    formData.append("logoImage", logoFile);
  }
  appendBrowserConfigToFormData(formData);

  return formData;
}

function buildCreationRepairFormData({ itemId = "", scope = "incomplete" } = {}) {
  const formData = new FormData();
  const currentSet = getCreationCurrentSet();

  formData.set("setId", currentSet?.setId || "");
  if (itemId) {
    formData.set("itemId", itemId);
    const promptOverride = getCreationItemDraft(itemId, currentSet);
    if (promptOverride) {
      formData.set("promptOverride", promptOverride);
    }
  } else {
    formData.set("scope", scope);
  }
  formData.set("format", normalizeOutputFormat(refs.creationOutputFormatInput.value || state.config?.defaults?.format || "png"));
  formData.set("ratio", refs.creationRatioInput.value || DEFAULT_UI_RATIO);
  formData.set("size", refs.creationSizeInput.value || "auto");
  formData.set("reasoningEffort", refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh");
  formData.set("clientSessionId", state.clientSessionId);
  formData.set("referenceImageRoles", JSON.stringify(getCreationRepairReferenceRolePayload(currentSet)));
  state.creationReferenceFiles.forEach((item) => {
    const file = getCreationReferenceGenerationFile(item);
    if (file) {
      formData.append("referenceImages", file);
    }
  });
  formData.set("logoOptions", JSON.stringify(getCreationLogoPayload()));
  const logoFile = getCreationLogoGenerationFile();
  if (logoFile) {
    formData.append("logoImage", logoFile);
  }
  appendBrowserConfigToFormData(formData);

  return formData;
}

function handleCreationStreamEvent(eventName, payload = {}) {
  if (eventName === "repair_started") {
    upsertCreationSet(payload.set);
    setCreationFeedback("正在补齐套图项...", "busy");
    renderCreationView();
    return;
  }

  if (eventName === "set_started") {
    upsertCreationSet(payload.set);
    setCreationFeedback(`套图任务已创建，正在生成 ${payload.set?.imageCount || getCreationSelectedImageCount()} 张营销图。`, "busy");
    renderCreationView();
    return;
  }

  if (eventName === "plan") {
    if (payload.setId && state.creation.currentSet?.setId !== payload.setId && Array.isArray(payload.items)) {
      upsertCreationSet({
        ...state.creation.currentSet,
        setId: payload.setId,
        items: payload.items,
      });
    }
    renderCreationView();
    return;
  }

  if (eventName === "item_started") {
    updateCreationCurrentItem(payload.itemId, {
      status: "generating",
      updatedAt: nowIso(),
    });
    setCreationFeedback(`正在生成 ${payload.role || payload.itemId}。`, "busy");
    renderCreationView();
    return;
  }

  if (eventName === "item_status") {
    updateCreationCurrentItem(payload.itemId, {
      status: "generating",
      updatedAt: nowIso(),
    });
    if (payload.message) {
      setCreationFeedback(payload.message, "busy");
    }
    renderCreationView();
    return;
  }

  if (eventName === "item_partial_image") {
    updateCreationCurrentItem(payload.itemId, {
      status: "generating",
      imageUrl: payload.dataUrl,
      thumbnailUrl: payload.dataUrl,
      updatedAt: nowIso(),
    });
    renderCreationView();
    return;
  }

  if (eventName === "item_final_image") {
    updateCreationCurrentItem(payload.itemId, {
      status: "generating",
      imageUrl: payload.dataUrl,
      thumbnailUrl: payload.dataUrl,
      updatedAt: nowIso(),
    });
    renderCreationView();
    return;
  }

  if (eventName === "item_saved") {
    if (payload.set) {
      upsertCreationSet(payload.set);
    } else if (payload.item) {
      updateCreationCurrentItem(payload.item.itemId, {
        ...payload.item,
        status: "completed",
        updatedAt: nowIso(),
      });
    }
    setCreationFeedback("已生成一张套图。", "success");
    renderCreationView();
    return;
  }

  if (eventName === "item_failed") {
    if (payload.set) {
      upsertCreationSet(payload.set);
    } else if (payload.itemId) {
      updateCreationCurrentItem(payload.itemId, {
        status: "failed",
        error: payload.message || "",
        updatedAt: nowIso(),
      });
    }
    setCreationFeedback(payload.message || "套图生成失败。", "error");
    renderCreationView();
    return;
  }

  if (eventName === "complete") {
    if (payload.set) {
      upsertCreationSet(payload.set);
    }
    setCreationFeedback("套图生成完成。", "success");
    renderCreationView();
    return;
  }

  if (eventName === "error") {
    const message = compactErrorMessage(payload.message, "套图生成请求失败");
    const currentSet = getCreationCurrentSet();
    if (currentSet) {
      state.creation.currentSet = normalizeCreationSetForView({
        ...currentSet,
        status: "failed",
        updatedAt: nowIso(),
        items: currentSet.items.map((item) =>
          item.status === "completed"
            ? item
            : {
                ...item,
                status: "failed",
                error: message,
              },
        ),
      });
    }
    setCreationFeedback(message, "error");
    showError(message);
    renderCreationView();
  }
}

async function runCreationStream(response) {
  await consumeSse(response.body, async (eventName, payload) => {
    handleCreationStreamEvent(eventName, payload);
  });
}

async function loadCreationSets() {
  const response = await fetch("/api/creation/sets", {
    cache: "no-store",
  });
  if (response.status === 404) {
    state.creation.sets = [];
    state.creation.recordSetId = "";
    renderCreationView();
    renderCreationRecordView();
    return;
  }

  if (!response.ok) {
    throw new Error("读取套图记录失败");
  }

  const payload = await response.json();
  const nextSets = Array.isArray(payload) ? payload.map(normalizeCreationSetForView).filter(Boolean) : [];
  const currentSetId = state.creation.currentSet?.setId || "";
  state.creation.sets = nextSets;
  if (currentSetId) {
    const matchedCurrentSet = nextSets.find((set) => set.setId === currentSetId);
    if (matchedCurrentSet) {
      state.creation.currentSet = normalizeCreationSetForView(matchedCurrentSet);
    }
  }
  if (state.creation.recordSetId && !nextSets.some((set) => set.setId === state.creation.recordSetId)) {
    state.creation.recordSetId = "";
  }
  renderCreationView();
  renderCreationRecordView();
}

async function previewCreationPlan() {
  if (state.creation.generating || state.creation.planning) {
    return;
  }

  clearError();
  setCreationFeedback("");

  const productName = refs.creationProductNameInput.value.trim();
  const productDescription = refs.creationProductDescriptionInput.value.trim();
  const sellingPoints = getCreationSellingPoints(refs.creationSellingPointsInput.value);
  if (!productName && !productDescription && sellingPoints.length === 0) {
    const message = "请至少填写商品名称、商品描述或核心卖点。";
    setCreationFeedback(message, "error");
    showError(message);
    return;
  }

  state.creation.planning = true;
  setCreationFeedback("正在生成套图计划...", "busy");
  renderCreationView();

  try {
    const response = await fetch("/api/creation/plan", {
      method: "POST",
      body: buildCreationPlanPreviewFormData(),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || "套图计划生成失败");
    }

    const plan = payload.plan || {};
    const createdAt = nowIso();
    const previousDraft = isCreationDraftSet() ? getCreationCurrentSet() : null;
    const items = Array.isArray(plan.items)
      ? plan.items.map((item, index) => ({
          ...item,
          slotIndex: item.slotIndex || index + 1,
          status: "idle",
        }))
      : [];

    state.creation.currentSet = normalizeCreationSetForView({
      setId: previousDraft?.setId || `creation-draft-${Date.now()}`,
      productName: plan.productName || productName,
      productDescription: plan.productDescription || productDescription,
      sellingPoints: plan.sellingPoints || sellingPoints,
      dimensionSpecs: plan.dimensionSpecs || refs.creationDimensionSpecsInput.value.trim(),
      dimensionUnitMode: plan.dimensionUnitMode || getCreationSelectedDimensionUnitMode(),
      dimensionUnitModeLabel: plan.dimensionUnitModeLabel || formatCreationDimensionUnitModeLabel(getCreationSelectedDimensionUnitMode()),
      targetLanguage: plan.targetLanguage || getCreationSelectedLanguage().value,
      targetLanguageLabel: plan.targetLanguageLabel || getCreationSelectedLanguage().label,
      imageCount: plan.imageCount || items.length || getCreationSelectedRoles().length,
      scenario: plan.scenario || getCreationSelectedScenario().value,
      scenarioLabel: plan.scenarioLabel || getCreationSelectedScenario().label,
      industryTemplate: plan.industryTemplate || getCreationSelectedIndustryTemplate().value,
      industryTemplateLabel: plan.industryTemplateLabel || getCreationSelectedIndustryTemplate().label,
      industryTemplatePath: plan.industryTemplatePath || getCreationSelectedIndustryTemplate().categoryPath,
      selectedRoles: plan.selectedRoles || getCreationSelectedRoles(),
      referenceImageNames: state.creationReferenceFiles.map((item) => item.file?.name || "").filter(Boolean),
      referenceImageRoles: plan.referenceImageRoles || buildCreationReferenceRolePayload(),
      createdAt: previousDraft?.createdAt || createdAt,
      updatedAt: createdAt,
      status: "planning",
      items,
    });
    state.creation.editingItemId = "";
    setCreationFeedback(`已生成 ${items.length} 张套图计划，可以先微调再正式生成。`, "success");
  } catch (error) {
    const message = compactErrorMessage(error instanceof Error ? error.message : String(error), "套图计划生成失败");
    setCreationFeedback(message, "error");
    showError(message);
  } finally {
    state.creation.planning = false;
    renderCreationView();
  }
}

async function startCreationGeneration(event) {
  event.preventDefault();
  if (state.creation.generating || state.creation.planning) {
    return;
  }

  clearError();
  setCreationFeedback("");

  const productName = refs.creationProductNameInput.value.trim();
  const productDescription = refs.creationProductDescriptionInput.value.trim();
  const sellingPoints = getCreationSellingPoints(refs.creationSellingPointsInput.value);
  if (!productName && !productDescription && sellingPoints.length === 0) {
    const message = "请至少填写商品名称、商品描述或核心卖点。";
    setCreationFeedback(message, "error");
    showError(message);
    return;
  }

  state.creation.generating = true;
  state.creation.generationScope = "full";
  state.creation.editingItemId = "";
  renderCreationView();

  try {
    await ensureCreationReferenceGenerationFilesReady();
    const generationFormData = buildCreationFormData();
    const draftSet = isCreationDraftSet() ? getCreationCurrentSet() : null;
    const draftItems = draftSet?.items?.length ? draftSet.items : null;
    const createdAt = nowIso();
    const scenario = getCreationSelectedScenario();
    const industryTemplate = getCreationSelectedIndustryTemplate();
    const previewSlots = getCreationPreviewSlots();
    const selectedRoles = getCreationSelectedRoles();
    const imageCount = draftItems?.length || selectedRoles.length || previewSlots.length || getCreationSelectedImageCount();
    state.creation.currentSet = normalizeCreationSetForView({
      setId: `creation-local-${Date.now()}`,
      productName,
      productDescription,
      sellingPoints,
      dimensionSpecs: refs.creationDimensionSpecsInput.value.trim(),
      dimensionUnitMode: getCreationSelectedDimensionUnitMode(),
      dimensionUnitModeLabel: formatCreationDimensionUnitModeLabel(getCreationSelectedDimensionUnitMode()),
      targetLanguage: getCreationSelectedLanguage().value,
      targetLanguageLabel: getCreationSelectedLanguage().label,
      imageCount,
      scenario: scenario.value,
      scenarioLabel: scenario.label,
      industryTemplate: industryTemplate.value,
      industryTemplateLabel: industryTemplate.label,
      industryTemplatePath: industryTemplate.categoryPath || "",
      selectedRoles,
      referenceImageNames: state.creationReferenceFiles.map((item) => item.file?.name || "").filter(Boolean),
      referenceImageRoles: buildCreationReferenceRolePayload(),
      createdAt,
      updatedAt: createdAt,
      status: "generating",
      items: (draftItems || previewSlots).map((slot, index) => ({
        ...slot,
        slotIndex: index + 1,
        status: "queued",
      })),
    });
    renderCreationView();

    const response = await fetch("/api/creation/generate", {
      method: "POST",
      body: generationFormData,
    });
    if (!response.ok || !response.body) {
      throw new Error("套图生成请求失败");
    }

    await runCreationStream(response);
    await loadCreationSets();
  } catch (error) {
    const message = compactErrorMessage(error instanceof Error ? error.message : String(error), "套图生成请求失败");
    setCreationFeedback(message, "error");
    showError(message);
  } finally {
    state.creation.generating = false;
    state.creation.generationScope = "";
    renderCreationView();
  }
}

async function repairCreationItems({ itemId = "", scope = "incomplete" } = {}) {
  if (state.creation.generating) {
    return;
  }

  const currentSet = getCreationCurrentSet();
  if (!canRepairCreationSet(currentSet)) {
    const message = "请先选择一个已保存的套图记录。";
    setCreationFeedback(message, "error");
    showError(message);
    return;
  }

  const targetItems = itemId
    ? currentSet.items.filter((item) => item.itemId === itemId)
    : getCreationIncompleteItems(currentSet);
  if (targetItems.length === 0) {
    setCreationFeedback("没有需要补齐的套图项。", "success");
    renderCreationView();
    return;
  }

  clearError();
  state.creation.generating = true;
  state.creation.generationScope = itemId ? "single" : "repair";
  state.creation.editingItemId = "";
  targetItems.forEach((item) => {
    updateCreationCurrentItem(item.itemId, {
      status: "generating",
      error: "",
      updatedAt: nowIso(),
    });
  });
  setCreationFeedback(itemId ? "正在重生成单张套图..." : "正在补齐未完成项...", "busy");
  renderCreationView();

  try {
    await ensureCreationReferenceGenerationFilesReady();
    const response = await fetch("/api/creation/repair", {
      method: "POST",
      body: buildCreationRepairFormData({ itemId, scope }),
    });
    if (response.status === 404) {
      throw new Error("当前部署不支持套图补图。");
    }
    if (!response.ok || !response.body) {
      throw new Error("套图补图请求失败");
    }

    await runCreationStream(response);
    await loadCreationSets();
  } catch (error) {
    const message = compactErrorMessage(error instanceof Error ? error.message : String(error), "套图补图请求失败");
    setCreationFeedback(message, "error");
    showError(message);
  } finally {
    state.creation.generating = false;
    state.creation.generationScope = "";
    renderCreationView();
  }
}

async function loadPptDecks() {
  const response = await fetch("/api/ppt/decks");
  if (!response.ok) {
    throw new Error("读取 PPT 历史失败");
  }
  const payload = await response.json();
  state.ppt.decks = Array.isArray(payload) ? payload : [];
  renderPptView();
  renderPptRecordView();
}

function createPptSlideCard(slide) {
  const card = document.createElement("article");
  card.className = "ppt-slide-card";
  const complete = isPptSlideComplete(slide);
  card.dataset.status = complete ? "saved" : slide.errorMessage ? "failed" : "pending";

  const thumb = document.createElement("div");
  thumb.className = "ppt-slide-thumb";
  const imageUrl = slide.imageUrl || slide.thumbnailUrl || slide.previewUrl || "";
  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = slide.title || `第 ${slide.slideNumber} 页`;
    thumb.appendChild(image);
  } else {
    thumb.textContent = slide.errorMessage || slide.statusText || "等待生成";
  }
  card.appendChild(thumb);

  const copy = document.createElement("div");
  copy.className = "ppt-slide-copy";

  const title = document.createElement("strong");
  title.textContent = `${slide.slideNumber}. ${slide.title || "未命名页面"}`;
  copy.appendChild(title);

  const message = document.createElement("p");
  message.textContent = slide.keyMessage || slide.prompt || slide.statusText || "";
  copy.appendChild(message);

  const status = document.createElement("span");
  status.textContent = complete ? "已生成" : slide.errorMessage || slide.statusText || "待生成";
  copy.appendChild(status);

  if (state.ppt.outline && !complete) {
    const retryButton = document.createElement("button");
    retryButton.className = "inline-button ppt-slide-retry-button";
    retryButton.type = "button";
    retryButton.dataset.pptRetrySlide = String(slide.slideNumber);
    retryButton.setAttribute("data-ppt-retry-slide", String(slide.slideNumber));
    retryButton.textContent = slide.errorMessage ? "重试本页" : "生成本页";
    retryButton.disabled = state.ppt.generating;
    copy.appendChild(retryButton);
  }

  if (complete) {
    const editButton = document.createElement("button");
    editButton.className = "inline-button ppt-slide-edit-button";
    editButton.type = "button";
    editButton.dataset.pptEditSlide = String(slide.slideNumber);
    editButton.setAttribute("data-ppt-edit-slide", String(slide.slideNumber));
    editButton.textContent = "编辑本页";
    editButton.disabled = state.ppt.generating;
    copy.appendChild(editButton);
  }

  card.appendChild(copy);
  return card;
}

function renderPptSlides() {
  refs.pptSlideList.innerHTML = "";
  getPptRenderableSlides().forEach((slide) => {
    refs.pptSlideList.appendChild(createPptSlideCard(slide));
  });
}

function getPptDeckPageCount(deck) {
  return Number(deck?.pageCount) || Number(deck?.slides?.length) || 0;
}

function getPptDeckRecordKey(deck) {
  return String(deck?.deckId || deck?.pptxRelativePath || deck?.pptxUrl || deck?.pptxFilename || "");
}

function getPptRecordByKey(recordKey) {
  return state.ppt.decks.find((deck) => getPptDeckRecordKey(deck) === recordKey) || null;
}

function getPptSlideImageUrl(slide) {
  return slide?.imageUrl || slide?.thumbnailUrl || slide?.previewUrl || "";
}

function getPptDeckPreviewSlides(deck) {
  return Array.isArray(deck?.slides) ? deck.slides.filter((slide) => getPptSlideImageUrl(slide)) : [];
}

function selectPptRecord(recordKey) {
  const deck = getPptRecordByKey(recordKey);
  if (!deck) {
    return;
  }

  const slides = getPptDeckPreviewSlides(deck);
  state.ppt.recordDetail.deckKey = recordKey;
  state.ppt.recordDetail.slideNumber = Number(slides[0]?.slideNumber) || 0;
  renderPptRecordView();
  refs.pptRecordDetail.focus({ preventScroll: true });
}

function selectPptRecordSlide(slideNumber) {
  state.ppt.recordDetail.slideNumber = Number(slideNumber) || 0;
  renderPptRecordView();
}

function clearPptRecordSelection() {
  state.ppt.recordDetail.deckKey = "";
  state.ppt.recordDetail.slideNumber = 0;
  renderPptRecordView();
}

function getPptDeckSourceLabel(deck) {
  return deck?.recordSource === "folder" ? "文件夹历史" : "生成记录";
}

function formatPptDeckMeta(deck) {
  const pageCount = getPptDeckPageCount(deck);
  const parts = [pageCount > 0 ? `${pageCount} 页` : "PPTX", formatTime(deck?.createdAt), getPptDeckSourceLabel(deck)];
  if (deck?.fileSize) {
    parts.push(formatFileSize(deck.fileSize));
  }
  return parts.filter(Boolean).join(" · ");
}

function createPptDeckRecordItem(deck, variant = "history") {
  const item = document.createElement("article");
  item.className = variant === "record" ? "ppt-record-card" : "ppt-history-item";
  const recordKey = getPptDeckRecordKey(deck);

  if (variant === "record") {
    item.dataset.pptRecordKey = getPptDeckRecordKey(deck);
    item.tabIndex = 0;
    item.setAttribute("aria-label", `查看 ${deck.title || "PPT 记录"} 预览`);
    item.classList.toggle("is-selected", state.ppt.recordDetail.deckKey === recordKey);
  }

  const title = document.createElement("strong");
  title.textContent = deck.title || "未命名演示";
  item.appendChild(title);

  const meta = document.createElement("span");
  meta.textContent = formatPptDeckMeta(deck);
  item.appendChild(meta);

  if (variant === "record") {
    const path = document.createElement("p");
    path.textContent = deck.pptxFilename || deck.pptxRelativePath || "PPTX 文件";
    item.appendChild(path);

    const source = document.createElement("span");
    source.className = "ppt-record-source";
    source.textContent = getPptDeckSourceLabel(deck);
    item.appendChild(source);
  }

  const actions = document.createElement("div");
  actions.className = variant === "record" ? "ppt-record-card-actions" : "ppt-history-actions";
  if (variant === "record") {
    const previewButton = document.createElement("button");
    previewButton.type = "button";
    previewButton.className = "toolbar-button";
    previewButton.textContent = "预览";
    actions.appendChild(previewButton);
  }

  const link = document.createElement("a");
  link.className = "toolbar-button";
  link.href = deck.pptxUrl || "#";
  link.download = deck.pptxFilename || "";
  link.textContent = "下载 PPTX";
  if (!deck.pptxUrl) {
    link.classList.add("disabled");
    link.setAttribute("aria-disabled", "true");
  }
  actions.appendChild(link);
  item.appendChild(actions);

  return item;
}

function renderPptHistory() {
  refs.pptDeckCount.textContent = `${state.ppt.decks.length} 套`;
  refs.pptHistoryEmpty.classList.toggle("hidden", state.ppt.decks.length > 0);
  refs.pptHistoryList.innerHTML = "";

  state.ppt.decks.forEach((deck) => {
    refs.pptHistoryList.appendChild(createPptDeckRecordItem(deck));
  });
}

function renderPptRecordDetail(deck) {
  refs.pptRecordDetail.innerHTML = "";

  if (!deck) {
    refs.pptRecordDetail.classList.add("is-empty");
    const empty = document.createElement("div");
    empty.className = "ppt-record-detail-empty";

    const title = document.createElement("strong");
    title.textContent = "选择一条 PPT 记录";
    empty.appendChild(title);

    const copy = document.createElement("p");
    copy.textContent = "点击左侧记录后，这里会显示该 PPT 的页面图片和下载信息。";
    empty.appendChild(copy);

    refs.pptRecordDetail.appendChild(empty);
    return;
  }

  refs.pptRecordDetail.classList.remove("is-empty");

  const slides = getPptDeckPreviewSlides(deck);
  const selectedSlide =
    slides.find((slide) => Number(slide.slideNumber) === Number(state.ppt.recordDetail.slideNumber)) || slides[0] || null;
  if (selectedSlide) {
    state.ppt.recordDetail.slideNumber = Number(selectedSlide.slideNumber) || 0;
  }

  const header = document.createElement("div");
  header.className = "ppt-record-detail-head";

  const summary = document.createElement("div");
  summary.className = "ppt-record-detail-summary";

  const title = document.createElement("strong");
  title.textContent = deck.title || "未命名演示";
  summary.appendChild(title);

  const meta = document.createElement("span");
  meta.textContent = formatPptDeckMeta(deck);
  summary.appendChild(meta);
  header.appendChild(summary);

  const actions = document.createElement("div");
  actions.className = "ppt-record-detail-actions";

  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "toolbar-button";
  backButton.dataset.pptRecordBack = "true";
  backButton.textContent = "返回记录";
  actions.appendChild(backButton);

  const link = document.createElement("a");
  link.className = "toolbar-button";
  link.href = deck.pptxUrl || "#";
  link.download = deck.pptxFilename || "";
  link.textContent = "下载 PPTX";
  if (!deck.pptxUrl) {
    link.classList.add("disabled");
    link.setAttribute("aria-disabled", "true");
  }
  actions.appendChild(link);
  header.appendChild(actions);
  refs.pptRecordDetail.appendChild(header);

  const previewStage = document.createElement("div");
  previewStage.className = "ppt-record-preview-stage";

  if (selectedSlide) {
    const previewImage = document.createElement("img");
    previewImage.src = getPptSlideImageUrl(selectedSlide);
    previewImage.alt = selectedSlide.title || `${deck.title || "PPT"} 第 ${selectedSlide.slideNumber} 页`;
    previewStage.appendChild(previewImage);
  } else {
    const empty = document.createElement("div");
    empty.className = "ppt-record-detail-empty";
    const emptyTitle = document.createElement("strong");
    emptyTitle.textContent = "没有可预览的页面图片";
    empty.appendChild(emptyTitle);
    const emptyCopy = document.createElement("p");
    emptyCopy.textContent = "这条历史记录只包含 PPTX 文件，仍可直接下载查看。";
    empty.appendChild(emptyCopy);
    previewStage.appendChild(empty);
  }

  refs.pptRecordDetail.appendChild(previewStage);

  const strip = document.createElement("div");
  strip.className = "ppt-record-slide-strip";
  slides.forEach((slide) => {
    const slideButton = document.createElement("button");
    slideButton.type = "button";
    slideButton.className = "ppt-record-slide-button";
    slideButton.dataset.pptRecordSlide = String(slide.slideNumber);
    slideButton.classList.toggle("is-selected", Number(slide.slideNumber) === Number(state.ppt.recordDetail.slideNumber));
    slideButton.setAttribute("aria-label", `预览第 ${slide.slideNumber} 页`);

    const thumb = document.createElement("img");
    thumb.src = getPptSlideImageUrl(slide);
    thumb.alt = slide.title || `第 ${slide.slideNumber} 页`;
    slideButton.appendChild(thumb);

    const label = document.createElement("span");
    label.textContent = `${slide.slideNumber}. ${slide.title || "页面"}`;
    slideButton.appendChild(label);

    strip.appendChild(slideButton);
  });
  refs.pptRecordDetail.appendChild(strip);
}

function renderPptRecordView() {
  refs.pptRecordCount.textContent = `${state.ppt.decks.length} 个`;
  refs.pptRecordEmpty.classList.toggle("hidden", state.ppt.decks.length > 0);
  refs.pptRecordList.innerHTML = "";

  let selectedDeck = getPptRecordByKey(state.ppt.recordDetail.deckKey);
  if (!selectedDeck) {
    state.ppt.recordDetail.deckKey = "";
    state.ppt.recordDetail.slideNumber = 0;
    selectedDeck = null;
  }

  state.ppt.decks.forEach((deck) => {
    refs.pptRecordList.appendChild(createPptDeckRecordItem(deck, "record"));
  });

  renderPptRecordDetail(selectedDeck);
}

function renderPptView() {
  setPptSourceMode(state.ppt.sourceMode);
  renderPptFiles();

  const stats = getPptCompletionStats();
  const missing = getPptMissingSlideNumbers();
  refs.pptStatusText.textContent = state.ppt.statusText;
  refs.pptCompletionRatio.textContent = `${stats.completed} / ${stats.total} 页成功`;
  refs.pptProgressBar.style.width = stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}%` : "0%";
  refs.pptCompleteMissingButton.classList.toggle("hidden", missing.length === 0 || !state.ppt.outline);
  refs.pptCompleteMissingButton.disabled = state.ppt.generating || missing.length === 0;
  refs.pptCompleteMissingButton.textContent = missing.length > 0 ? `补齐缺页 (${missing.length})` : "补齐缺页";
  refs.pptGenerateButton.disabled = state.ppt.generating;
  refs.pptGenerateButton.textContent = state.ppt.generating ? "正在生成..." : "生成 PPT 演示文稿";

  refs.pptDownloadLink.href = state.ppt.pptxUrl || "#";
  refs.pptDownloadLink.classList.toggle("disabled", !state.ppt.pptxUrl);
  refs.pptDownloadLink.setAttribute("aria-disabled", String(!state.ppt.pptxUrl));

  if (state.ppt.outline) {
    refs.pptOutlineBox.textContent = `${state.ppt.outline.title} · ${state.ppt.outline.slides.length} 页`;
  } else {
    refs.pptOutlineBox.textContent = "";
  }

  renderPptSlides();
  renderPptHistory();
  renderPptRecordView();
}

function getStyleTransferReferenceFiles() {
  const stylePresetFile = getStyleTransferPresetReferenceFile();
  const styleReferenceFile = stylePresetFile || getStyleTransferGenerationFile("style");
  return [getStyleTransferGenerationFile("source"), styleReferenceFile].filter(Boolean);
}

function buildStyleTransferPrompt() {
  const userNote = String(refs.styleTransferInstructionInput?.value || "").trim();
  const preset = getStyleTransferPreset();
  const presetNote = hasSelectedStyleTransferPreset()
    ? `Use the second reference image, the built-in "${preset.label}" preset image, only as the style reference. ${preset.prompt}`
    : "Use the second reference image only as the style reference.";
  const parts = [
    "Use the first reference image as the source image.",
    "preserve every visible subject, object, pose, layout, composition, spatial relationship, and identity signal from the source image.",
    presetNote,
    "The second reference image is the style authority; if the source image's visual style conflicts with it, follow the second reference image.",
    "The final image should visibly match the style reference image's surface treatment, palette, line behavior, texture, and rendering medium.",
    "Transfer the style reference's realism level, camera/lens look, color grade, lighting, shading, texture, edge treatment, material finish, rendering style, and mood.",
    "If the style reference is a real photograph, the final image must be photorealistic with natural skin texture, realistic anatomy, optical lens behavior, real lighting, and natural material response.",
    "Do not keep anime, cartoon, comic, cel-shaded, line-art, CGI doll, or illustration residue from the source image unless those traits also exist in the style reference.",
    "Do not copy subjects, objects, logos, text, or layout from the style reference image unless they also exist in the source image.",
    "Return one polished final image with the source image's content faithfully migrated into the style reference's visual style.",
  ];

  if (userNote) {
    parts.push(`Additional user note: ${userNote}`);
  }

  return parts.join(" ");
}

function createJob() {
  const ratioOption = getRatioOption(refs.ratioInput.value || DEFAULT_UI_RATIO);
  const referenceFiles = state.referenceFiles.map(getGenerationReferenceFile);
  const referenceImageNames = state.referenceFiles.map((item) => item.file.name);
  const sizeSetting = getSelectedGenerationSize();
  const size = sizeSetting === "auto" ? ratioOption?.baseSize || getDefaultGenerationSize(ratioOption?.value) : sizeSetting;

  return {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: nowIso(),
    prompt: refs.promptInput.value.trim(),
    ratio: ratioOption?.value || DEFAULT_UI_RATIO,
    ratioLabel: ratioOption?.label || DEFAULT_UI_RATIO_LABEL,
    sizeSetting,
    size,
    quality: state.config?.defaults?.quality || "high",
    format: normalizeOutputFormat(refs.outputFormatInput.value || state.config?.defaults?.format || "png"),
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

function createStyleTransferJob() {
  const ratioOption = getRatioOption(refs.ratioInput.value || DEFAULT_UI_RATIO);
  const referenceFiles = getStyleTransferReferenceFiles();
  const sourceItem = state.styleTransfer.source;
  const styleItem = state.styleTransfer.style;
  const stylePreset = getStyleTransferPreset();
  const stylePresetFile = getStyleTransferPresetReferenceFile();
  const sizeSetting = getSelectedGenerationSize();
  const size = sizeSetting === "auto" ? ratioOption?.baseSize || getDefaultGenerationSize(ratioOption?.value) : sizeSetting;

  return {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: nowIso(),
    mode: "style-transfer",
    prompt: buildStyleTransferPrompt(),
    ratio: ratioOption?.value || DEFAULT_UI_RATIO,
    ratioLabel: ratioOption?.label || DEFAULT_UI_RATIO_LABEL,
    sizeSetting,
    size,
    quality: state.config?.defaults?.quality || "high",
    format: normalizeOutputFormat(refs.outputFormatInput.value || state.config?.defaults?.format || "png"),
    baseUrl: state.config?.baseUrl || refs.baseUrlInput.value.trim(),
    responsesModel: state.config?.responsesModel || refs.responsesModelInput.value.trim() || "gpt-5.4",
    imageModel: "gpt-image-2",
    reasoningEffort: refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh",
    requestRetryCount: 0,
    referenceFiles: getStyleTransferReferenceFiles(),
    hasReferenceImage: referenceFiles.length > 0,
    referenceImageName: sourceItem?.file?.name || "",
    referenceImageNames: [sourceItem?.file?.name || "", stylePresetFile?.name || styleItem?.file?.name || ""].filter(Boolean),
    styleTransferSourceImageName: sourceItem?.file?.name || "",
    styleTransferReferenceImageName: stylePresetFile?.name || styleItem?.file?.name || "",
    styleTransferPreset: stylePreset?.value || STYLE_TRANSFER_CUSTOM_PRESET,
    isRunning: false,
    started: false,
    statusStage: "queued",
    statusText: "等待并发槽位",
    previewUrl: "",
  };
}

function getSelectedReferenceAnalysisGenerationSize() {
  return normalizeGenerationSize(refs.referenceAnalysisRatioInput.value || DEFAULT_UI_RATIO, refs.referenceAnalysisSizeInput.value || "auto");
}

function createReferenceAnalysisJob() {
  const ratioOption = getRatioOption(refs.referenceAnalysisRatioInput.value || DEFAULT_UI_RATIO);
  const referenceFiles = state.referenceAnalysis.files.map(getReferenceAnalysisGenerationFile).filter(Boolean);
  const referenceImageNames = state.referenceAnalysis.files.map((item) => item.file.name).filter(Boolean);
  const sizeSetting = getSelectedReferenceAnalysisGenerationSize();
  const size = sizeSetting === "auto" ? ratioOption?.baseSize || getDefaultGenerationSize(ratioOption?.value) : sizeSetting;

  return {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: nowIso(),
    mode: "reference-analysis",
    prompt: String(state.referenceAnalysis.selectedPrompt || "").trim(),
    ratio: ratioOption?.value || DEFAULT_UI_RATIO,
    ratioLabel: ratioOption?.label || DEFAULT_UI_RATIO_LABEL,
    sizeSetting,
    size,
    quality: state.config?.defaults?.quality || "high",
    format: normalizeOutputFormat(state.config?.defaults?.format || "png"),
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

function cancelQueuedJob(jobId) {
  const { jobs, canceledJob } = cancelQueuedGenerationJob(state.jobs, jobId);
  if (!canceledJob) {
    return false;
  }

  state.jobs = jobs;
  if (state.selectedPreviewKey === makeJobPreviewKey(canceledJob.id)) {
    state.selectedPreviewKey = "";
  }
  if (canceledJob.mode === "reference-analysis") {
    removeReferenceAnalysisGenerationKey(makeJobPreviewKey(canceledJob.id));
  }
  if (canceledJob.mode === "image-decomposition") {
    removeImageDecompositionGenerationKey(makeJobPreviewKey(canceledJob.id));
  }
  handleActivityCanceled(canceledJob);
  scheduleGenerationQueue();
  renderAll();
  return true;
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
        if (retryPlan.retryable && !retryPlan.shouldSurfaceError) {
          return null;
        }
        throw error;
      }

      job.requestRetryCount = retryPlan.nextRetryCount;
      updateJob(job.id, {
        requestRetryCount: retryPlan.nextRetryCount,
        statusStage: "connecting",
        statusText: retryPlan.message,
      });
      await wait(900);
    }
  }
}

async function loadConfig() {
  let serverConfig = null;
  try {
    const response = await fetch("/api/config");
    if (response.ok) {
      serverConfig = await response.json();
    }
  } catch (_error) {
    serverConfig = null;
  }

  const browserConfig = readBrowserPrivateConfig();
  if (!serverConfig && !browserConfig) {
    throw new Error("读取配置失败");
  }

  state.config = browserConfig ? toPublicBrowserConfig(browserConfig, serverConfig || {}) : serverConfig;
  syncConfigUi(state.config);
}

async function loadGallery() {
  const response = await fetch("/api/gallery");
  if (!response.ok) {
    throw new Error("读取本地画廊失败");
  }

  const payload = await response.json();
  const browserCachedItems = await readBrowserCachedGalleryItems();
  const sortedItems = sortGalleryItemsByCreatedAtDesc(
    mergeServerAndBrowserGalleryItems(Array.isArray(payload) ? payload : [], browserCachedItems),
  );
  const hydratedGallery = hydrateGalleryItems(sortedItems);
  state.gallery = sortGalleryItemsByCreatedAtDesc(hydratedGallery.items);
  renderAll();
  void repairGalleryMetadataQueue(hydratedGallery.repairQueue);
}

function normalizeGenerationTaskSnapshot(task) {
  const id = String(task?.id || "").trim();
  if (!id) {
    return null;
  }

  const status = normalizeGenerationTaskStatus(task.status);
  const mode = String(task.mode || task.generationMode || "").trim();
  return {
    ...task,
    id,
    mode,
    generationMode: String(task.generationMode || mode || ""),
    status,
    createdAt: String(task.createdAt || nowIso()),
    updatedAt: String(task.updatedAt || task.createdAt || nowIso()),
    prompt: String(task.prompt || ""),
    statusText: String(task.statusText || ""),
    errorMessage: String(task.errorMessage || ""),
    referenceFiles: [],
    started: status === "running",
    isRunning: status === "running",
    statusStage: String(task.statusStage || status),
  };
}

function applyGenerationTaskSnapshots(tasks, { render = true } = {}) {
  const existingJobs = new Map(state.jobs.map((job) => [job.id, job]));
  const snapshots = (Array.isArray(tasks) ? tasks : [])
    .map(normalizeGenerationTaskSnapshot)
    .filter(Boolean)
    .map((snapshot) => {
      const existing = existingJobs.get(snapshot.id);
      return {
        ...snapshot,
        mode: snapshot.mode || existing?.mode || "",
        generationMode: snapshot.generationMode || snapshot.mode || existing?.generationMode || existing?.mode || "",
      };
    });
  const snapshotIds = new Set(snapshots.map((task) => task.id));

  snapshots.forEach((task) => {
    if (task.status === "completed" && task.item) {
      if (task.mode === "reference-analysis") {
        task.item.mode = "reference-analysis";
        storeReferenceAnalysisGenerationItem(task.item);
        replaceReferenceAnalysisGenerationKey(makeJobPreviewKey(task.id), makeGalleryPreviewKey(task.item.filename));
        if (state.referenceAnalysis.previewKey === makeJobPreviewKey(task.id)) {
          state.referenceAnalysis.previewKey = makeGalleryPreviewKey(task.item.filename);
        }
      }
      if (task.mode === "image-decomposition") {
        task.item.mode = "image-decomposition";
        storeImageDecompositionGenerationItem(task.item);
        replaceImageDecompositionGenerationKey(makeJobPreviewKey(task.id), makeGalleryPreviewKey(task.item.filename));
        if (state.imageDecomposition.previewKey === makeJobPreviewKey(task.id)) {
          state.imageDecomposition.previewKey = makeGalleryPreviewKey(task.item.filename);
        }
      }
      upsertGalleryItem(task.item);
      if (state.selectedPreviewKey === makeJobPreviewKey(task.id) && task.item.filename) {
        state.selectedPreviewKey = makeGalleryPreviewKey(task.item.filename);
      }
    }

    if (task.status === "error" && state.selectedPreviewKey === makeJobPreviewKey(task.id)) {
      state.selectedPreviewKey = "";
    }

    if (task.status === "error" && task.mode === "reference-analysis") {
      removeReferenceAnalysisGenerationKey(makeJobPreviewKey(task.id));
    }
    if (task.status === "error" && task.mode === "image-decomposition") {
      removeImageDecompositionGenerationKey(makeJobPreviewKey(task.id));
    }

    recordGenerationTaskActivity(task);
  });

  const remoteRunningJobs = snapshots
    .filter((task) => task.status === "running")
    .map((task) => {
      const existing = existingJobs.get(task.id);
      return {
        ...task,
        referenceFiles: existing?.referenceFiles || [],
        previewUrl: existing?.previewUrl || task.previewUrl || "",
        requestRetryCount: existing?.requestRetryCount || 0,
      };
    });
  const localTransientJobs = state.jobs.filter((job) => !snapshotIds.has(job.id) && (job.isRunning || !job.started));

  state.generationTasks = snapshots;
  state.jobs = sortGalleryItemsByCreatedAtDesc([...remoteRunningJobs, ...localTransientJobs]);

  if (!state.selectedPreviewKey && state.jobs.length > 0) {
    state.selectedPreviewKey = makeJobPreviewKey(state.jobs[0].id);
  }

  if (render) {
    renderAll();
  }

  scheduleGenerationTaskPolling();
}

async function loadGenerationTasks({ render = true } = {}) {
  const response = await fetch("/api/generation/tasks", {
    headers: {
      "x-client-session-id": state.clientSessionId,
    },
  });
  if (response.status === 404) {
    applyGenerationTaskSnapshots([], { render });
    return;
  }
  if (!response.ok) {
    throw new Error("读取生成任务失败");
  }

  applyGenerationTaskSnapshots(await response.json(), { render });
}

function hasRunningGenerationTasks() {
  return state.jobs.some((job) => normalizeGenerationTaskStatus(job.status) === "running" || job.isRunning);
}

function scheduleGenerationTaskPolling() {
  if (generationTaskPollTimer || !hasRunningGenerationTasks()) {
    return;
  }

  generationTaskPollTimer = window.setTimeout(async () => {
    generationTaskPollTimer = 0;
    try {
      await loadGenerationTasks();
    } catch (error) {
      console.warn("load generation tasks failed", error);
    }
    scheduleGenerationTaskPolling();
  }, GENERATION_TASK_POLL_INTERVAL_MS);
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
    responsesModel: refs.responsesModelInput.value.trim() || "gpt-5.5",
  };

  const browserConfig = saveBrowserPrivateConfig(payload);
  state.config = toPublicBrowserConfig(browserConfig, state.config || {});
  refs.apiKeyInput.value = "";
  refs.configFeedback.textContent = "配置已保存到当前浏览器，本项目不会把 API Key 写入源码或 Cloudflare 环境变量。";
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

  await Promise.all([
    preserveReferenceAnalysisGenerationItemForDelete(item),
    preserveImageDecompositionGenerationItemForDelete(item),
  ]);
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
  await deleteBrowserCachedGalleryItem(item.filename);

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

  await Promise.all(
    state.gallery.flatMap((item) => [
      preserveReferenceAnalysisGenerationItemForDelete(item),
      preserveImageDecompositionGenerationItemForDelete(item),
    ]),
  );
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
  await clearBrowserImageCache();
  state.selectedPreviewKey = "";
  closeLightbox();
  renderAll();
}

function buildGenerationFormData(job) {
  const formData = new FormData();
  formData.set("jobId", job.id);
  formData.set("prompt", job.prompt);
  formData.set("ratio", job.ratio);
  formData.set("size", job.size);
  formData.set("format", job.format);
  formData.set("reasoningEffort", job.reasoningEffort);
  formData.set("clientSessionId", state.clientSessionId);
  if (job.mode) {
    formData.set("mode", job.mode);
  }
  appendBrowserConfigToFormData(formData);

  if (job.mode === "style-transfer") {
    appendStyleTransferReferencesToFormData(formData, job);
  } else if (job.mode === "image-decomposition") {
    appendImageDecompositionReferencesToFormData(formData, job);
  } else {
    job.referenceFiles.forEach((file) => {
      formData.append("referenceImages", file);
    });
  }

  return formData;
}

function appendImageDecompositionReferencesToFormData(formData, job) {
  formData.set("mode", "image-decomposition");
  formData.set("targetLanguage", job.targetLanguage || "zh-CN");
  formData.set("customTargetLanguage", job.customTargetLanguage || "");
  formData.set("featureCardsEnabled", job.featureCardsEnabled ? "1" : "0");
  job.referenceFiles.forEach((file) => {
    formData.append("referenceImages", file);
  });
}

function appendStyleTransferReferencesToFormData(formData, job) {
  formData.set("mode", "style-transfer");
  formData.set("styleTransferSourceImageName", job.styleTransferSourceImageName);
  formData.set("styleTransferReferenceImageName", job.styleTransferReferenceImageName);
  job.referenceFiles.forEach((file) => {
    formData.append("referenceImages", file);
  });
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

async function buildPromptAgentFormData() {
  const formData = new FormData();
  formData.set("image", await preparePromptAnalysisImageFile(state.promptAgent.file));
  formData.set(
    "reasoningEffort",
    refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh",
  );
  appendBrowserConfigToFormData(formData);
  return formData;
}

async function buildReferenceAnalysisFormData() {
  const formData = new FormData();
  formData.set("mode", "reference-orchestration");
  formData.set(
    "reasoningEffort",
    refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh",
  );
  const analysisFiles = await Promise.all(
    state.referenceAnalysis.files.map((item) => preparePromptAnalysisImageFile(item.file)),
  );
  analysisFiles.forEach((file) => {
    formData.append("image", file);
  });
  appendBrowserConfigToFormData(formData);
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
      body: await buildPromptAgentFormData(),
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
    savePromptAgentResultAsTemplate(payload.item);
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

async function analyzeReferenceImages() {
  clearError();
  if (state.referenceAnalysis.files.length === 0) {
    setReferenceAnalysisFeedback("图形分析需要上传参考图。", "error");
    return;
  }

  state.referenceAnalysis.running = true;
  setReferenceAnalysisFeedback("正在分析参考图关系...", "busy");
  renderReferenceAnalysis();

  try {
    const response = await fetch("/api/prompt-agent/analyze", {
      method: "POST",
      body: await buildReferenceAnalysisFormData(),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || "参考图分析失败。");
    }

    state.referenceAnalysis.result = payload.item;
    state.referenceAnalysis.collapsed = false;
    state.referenceAnalysis.dirty = false;
    state.referenceAnalysis.previewKey = "";
    state.referenceAnalysis.selectedPrompt = "";
    state.promptAgent.history = [
      payload.item,
      ...state.promptAgent.history.filter((item) => item.id !== payload.item.id),
    ];
    const promptCount = getReferenceAnalysisPrompts(payload.item).length;
    setReferenceAnalysisFeedback(`已生成 ${promptCount || 1} 条编排提示词。`, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setReferenceAnalysisFeedback(message, "error");
    showError(message);
  } finally {
    state.referenceAnalysis.running = false;
    renderReferenceAnalysis();
  }
}

function applyReferenceAnalysisPrompt(index) {
  const option = getReferenceAnalysisPrompts()[Number(index)];
  const promptText = String(option?.prompt || "").trim();
  if (!promptText) {
    setReferenceAnalysisFeedback("这条结果没有可应用的提示词。", "error");
    return;
  }

  state.referenceAnalysis.selectedPrompt = promptText;
  if (state.referenceAnalysis.autoCollapseOnApply) {
    state.referenceAnalysis.collapsed = true;
  }
  renderReferenceAnalysis();
  setReferenceAnalysisFeedback("已在融图分析中选用这条提示词。", "success");
  refs.referenceAnalysisSelectedPromptPanel.scrollIntoView({ block: "nearest" });
  refs.referenceAnalysisSelectedPrompt.focus();
}

async function startReferenceAnalysisGeneration() {
  clearError();
  const promptText = String(state.referenceAnalysis.selectedPrompt || "").trim();
  if (!promptText) {
    setReferenceAnalysisFeedback("请先选用一条融图分析提示词。", "error");
    return;
  }

  if (state.referenceAnalysis.files.length === 0) {
    setReferenceAnalysisFeedback("融图分析生成需要上传参考图。", "error");
    return;
  }

  if (getQueuedJobCount() >= getMaxQueuedJobCount()) {
    setReferenceAnalysisFeedback(`同一会话最多排队 ${getMaxQueuedJobCount()} 个生成任务。`, "error");
    return;
  }

  await ensureReferenceAnalysisGenerationFilesReady();
  const job = createReferenceAnalysisJob();
  registerReferenceAnalysisGenerationKey(makeJobPreviewKey(job.id));
  state.jobs.unshift(job);
  state.referenceAnalysis.previewKey = makeJobPreviewKey(job.id);
  state.selectedPreviewKey = makeJobPreviewKey(job.id);
  recordJobQueued(job);
  setReferenceAnalysisFeedback("已提交融图分析生成任务。", "success");
  renderAll();
  scheduleGenerationQueue();
}

async function copyReferenceAnalysisSelectedPrompt() {
  const promptText = String(state.referenceAnalysis.selectedPrompt || "").trim();
  if (!promptText) {
    setReferenceAnalysisFeedback("没有可复制的已选提示词。", "error");
    return;
  }

  await writeTextToClipboard(promptText, "当前浏览器不支持复制提示词。");
  setReferenceAnalysisFeedback("已复制融图分析提示词。", "success");
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

  const nextJobs = selectNextQueuedGenerationJobs(state.jobs, availableSlots);
  nextJobs.forEach((job) => {
    job.started = true;
    job.isRunning = true;
    job.statusStage = "uploading";
    job.statusText = "正在准备生成请求";
    void runGeneration(job);
  });

  if (nextJobs.length > 0) {
    renderAll();
    scheduleGenerationTaskPolling();
  }
}

async function runGeneration(job) {
  job.started = true;
  job.isRunning = true;
  const finalImageChunks = new Map();
  let finalImageDataUrl = "";
  let terminalEventReceived = false;
  let queuedForPolling = false;
  try {
    const response = await requestGenerationStream(job);
    if (!response) {
      removeJob(job.id);
      renderAll();
      return;
    }

    await consumeSse(response.body, async (eventName, payload) => {
      if (eventName === "status") {
        updateJob(job.id, {
          statusStage: payload.stage,
          statusText: payload.message,
        });
        handleActivityStatus(job.id, payload.stage, payload.message);
        if (job.mode === "image-decomposition") {
          setImageDecompositionFeedback(payload.message || "图片拆解生成中...", "busy");
        }
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
        finalImageDataUrl = isCacheableBrowserImageUrl(payload.dataUrl) ? payload.dataUrl : "";
        updateJob(job.id, {
          previewUrl: payload.dataUrl,
          statusText: "已拿到最终图像，正在写入本地",
        });
        handleActivityFinal(job.id);
        renderAll();
        return;
      }

      if (eventName === "final_image_chunk") {
        const dataUrl = recordFinalImageChunk(finalImageChunks, payload);
        if (dataUrl) {
          finalImageDataUrl = dataUrl;
        }
        updateJob(job.id, {
          previewUrl: dataUrl || job.previewUrl,
          statusText: dataUrl ? "最终图已接收，正在写入浏览器缓存" : "正在接收最终图数据",
        });
        if (dataUrl) {
          handleActivityFinal(job.id);
          await cacheBrowserGalleryItem({
            filename: payload.filename,
            imageUrl: dataUrl,
            thumbnailUrl: dataUrl,
          });
        }
        renderAll();
        return;
      }

      if (eventName === "saved") {
        terminalEventReceived = true;
        payload.item = attachChunkedImageToSavedItem(payload.item, finalImageChunks, finalImageDataUrl || job.previewUrl);
        if (payload.item) {
          if (job.mode === "reference-analysis") {
            payload.item.mode = "reference-analysis";
            storeReferenceAnalysisGenerationItem(payload.item);
            replaceReferenceAnalysisGenerationKey(makeJobPreviewKey(job.id), makeGalleryPreviewKey(payload.item.filename));
            state.referenceAnalysis.previewKey = makeGalleryPreviewKey(payload.item.filename);
            setReferenceAnalysisFeedback("融图分析图片已生成。", "success");
          }
          if (job.mode === "image-decomposition") {
            payload.item.mode = "image-decomposition";
            storeImageDecompositionGenerationItem(payload.item);
            replaceImageDecompositionGenerationKey(makeJobPreviewKey(job.id), makeGalleryPreviewKey(payload.item.filename));
            state.imageDecomposition.previewKey = makeGalleryPreviewKey(payload.item.filename);
            setImageDecompositionFeedback("图片拆解信息图已生成。", "success");
          }
          upsertGalleryItem(payload.item);
          state.selectedPreviewKey = makeGalleryPreviewKey(payload.item.filename);
        }
        handleActivitySuccess(job.id);
        removeJob(job.id);
        renderAll();
        return;
      }

      if (eventName === "server_image") {
        applyServerImageToGalleryItem(payload.item);
        renderAll();
        return;
      }

      if (eventName === "queued") {
        queuedForPolling = true;
        const task = payload.task || {};
        updateJob(job.id, {
          status: "running",
          statusStage: task.statusStage || "queued",
          statusText: task.statusText || "已提交到服务器队列，等待后台生成",
        });
        handleActivityStatus(job.id, "queued", task.statusText || "已提交到服务器队列，等待后台生成");
        scheduleGenerationTaskPolling();
        renderAll();
        return;
      }

      if (eventName === "error") {
        terminalEventReceived = true;
        const message = compactErrorMessage(payload.message, "生成请求失败");
        handleActivityFailure(job.id, message);
        showError(message);
        if (job.mode === "reference-analysis") {
          removeReferenceAnalysisGenerationKey(makeJobPreviewKey(job.id));
        }
        if (job.mode === "image-decomposition") {
          removeImageDecompositionGenerationKey(makeJobPreviewKey(job.id));
          setImageDecompositionFeedback(message, "error");
        }
        removeJob(job.id);
        renderAll();
      }
    });
    if (!terminalEventReceived && !queuedForPolling) {
      const message = "生成连接已中断，未收到完成事件。请稍后重试，或降低分辨率。";
      handleActivityFailure(job.id, message);
      showError(message);
      if (job.mode === "reference-analysis") {
        removeReferenceAnalysisGenerationKey(makeJobPreviewKey(job.id));
      }
      if (job.mode === "image-decomposition") {
        removeImageDecompositionGenerationKey(makeJobPreviewKey(job.id));
        setImageDecompositionFeedback(message, "error");
      }
      removeJob(job.id);
      renderAll();
    }
  } catch (error) {
    if (terminalEventReceived) {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    handleActivityFailure(job.id, message);
    showError(message);
    if (job.mode === "reference-analysis") {
      removeReferenceAnalysisGenerationKey(makeJobPreviewKey(job.id));
    }
    if (job.mode === "image-decomposition") {
      removeImageDecompositionGenerationKey(makeJobPreviewKey(job.id));
      setImageDecompositionFeedback(message, "error");
    }
    removeJob(job.id);
    renderAll();
  } finally {
    const currentJob = state.jobs.find((entry) => entry.id === job.id);
    if (currentJob) {
      currentJob.isRunning = queuedForPolling;
      if (queuedForPolling) {
        currentJob.status = "running";
      }
    }
    updateGenerateButton();
    scheduleGenerationQueue();
  }
}

async function startGeneration(event) {
  event.preventDefault();
  clearError();

  if (state.studioMode === "style-transfer") {
    const hasPresetStyle = hasSelectedStyleTransferPreset();
    if (!state.styleTransfer.source?.file || (!hasPresetStyle && !state.styleTransfer.style?.file)) {
      showError(hasPresetStyle ? "请先上传原图。" : "请先上传原图和风格参考图。");
      return;
    }

    if (getQueuedJobCount() >= getMaxQueuedJobCount()) {
      showError(`同一会话最多排队 ${getMaxQueuedJobCount()} 个生成任务。`);
      return;
    }

    try {
      await ensureStyleTransferGenerationFilesReady();
      await ensureStyleTransferPresetReferenceFileReady();
    } catch (error) {
      showError(compactErrorMessage(error instanceof Error ? error.message : String(error), "预设风格图准备失败"));
      return;
    }
    const job = createStyleTransferJob();
    state.jobs.unshift(job);
    state.selectedPreviewKey = makeJobPreviewKey(job.id);
    recordJobQueued(job);
    renderAll();
    setActiveView("style-transfer");

    scheduleGenerationQueue();
    return;
  }

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

  await ensureReferenceGenerationFilesReady();

  const job = createJob();
  state.jobs.unshift(job);
  state.selectedPreviewKey = makeJobPreviewKey(job.id);
  recordJobQueued(job);
  renderAll();
  setActiveView("studio");

  scheduleGenerationQueue();
}

function isStartGenerationShortcut(event) {
  return event.ctrlKey && !event.altKey && !event.metaKey && event.key === "Enter";
}

function handlePromptGenerationShortcut(event) {
  if (!isStartGenerationShortcut(event) || event.isComposing) {
    return;
  }

  event.preventDefault();
  refs.generateButton.click();
}

function setActiveGlobalNavItem(item) {
  refs.globalNavItems.forEach((navItem) => {
    const isOpen = navItem === item;
    navItem.classList.toggle("is-nav-open", isOpen);

    const button = navItem.querySelector("[data-nav-menu]");
    if (button) {
      button.setAttribute("aria-expanded", String(isOpen));
    }

    const flyout = navItem.querySelector(".nav-flyout");
    if (flyout) {
      flyout.setAttribute("aria-hidden", String(!isOpen));
    }
  });
}

function bindGlobalNavEvents() {
  refs.globalNavItems.forEach((item) => {
    const button = item.querySelector("[data-nav-menu]");
    if (!button) {
      return;
    }

    button.addEventListener("pointerenter", () => setActiveGlobalNavItem(item));
    button.addEventListener("mouseenter", () => setActiveGlobalNavItem(item));
    button.addEventListener("focus", () => setActiveGlobalNavItem(item));
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setActiveGlobalNavItem(item);
    });
  });

  refs.globalNav?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target && target.closest("a[href^='#']")) {
      setActiveGlobalNavItem(null);
      return;
    }
    event.stopPropagation();
  });

  document.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest(".global-nav")) {
      return;
    }

    setActiveGlobalNavItem(null);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setActiveGlobalNavItem(null);
    }
  });
}

function handleGlobalNavAction(action) {
  if (action === "prompt-agent") {
    setPromptAgentOpen(true);
    return;
  }

  if (action === "config") {
    setDrawerOpen(true);
    return;
  }

  if (action === "activity-log") {
    openConfigGenerationLog();
    return;
  }

  if (action === "theme") {
    toggleUiTheme();
    return;
  }

  if (action === "output") {
    openOutputDirectory().catch((error) => showError(error.message));
  }
}

function bindStyleTransferDropzone(dropzone, slot) {
  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("dragover");
  });
  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });
  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragover");
    applyStyleTransferReferenceFile(slot, event.dataTransfer?.files);
  });
}

function bindEvents() {
  bindGlobalNavEvents();
  bindAdaptiveWorkbenchSections();

  refs.viewTabs.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveView(button.dataset.viewTab);
    });
  });

  document.querySelectorAll("[data-nav-action]").forEach((button) => {
    button.addEventListener("click", () => {
      handleGlobalNavAction(button.dataset.navAction);
      setActiveGlobalNavItem(null);
    });
  });

  window.addEventListener("hashchange", () => {
    setActiveView(getViewFromHash());
  });

  refs.themeToggleButton.addEventListener("click", () => {
    toggleUiTheme();
  });
  refs.connectionStatus.addEventListener("click", () => setDrawerOpen(true));
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
  refs.articleIllustrationPlanButton.addEventListener("click", () => {
    previewArticleIllustrationPlan().catch((error) => setArticleIllustrationFeedback(error.message, "error"));
  });
  refs.articleIllustrationReferenceButton.addEventListener("click", () => {
    generateArticleIllustrations({ referenceOnly: true }).catch((error) =>
      setArticleIllustrationFeedback(error.message, "error"),
    );
  });
  refs.articleIllustrationGenerateButton.addEventListener("click", () => {
    generateArticleIllustrations().catch((error) => setArticleIllustrationFeedback(error.message, "error"));
  });
  refs.articleIllustrationSourceFilesInput.addEventListener("change", (event) => {
    applyArticleIllustrationFiles(event.target.files);
  });
  refs.articleIllustrationDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.articleIllustrationDropzone.classList.add("dragover");
  });
  refs.articleIllustrationDropzone.addEventListener("dragleave", () => {
    refs.articleIllustrationDropzone.classList.remove("dragover");
  });
  refs.articleIllustrationDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    refs.articleIllustrationDropzone.classList.remove("dragover");
    applyArticleIllustrationFiles(event.dataTransfer?.files);
  });
  function handleArticleIllustrationCardClick(event) {
    const previewButton = event.target.closest("[data-article-preview-item-id]");
    if (previewButton) {
      openArticleIllustrationItemPreview(previewButton.dataset.articlePreviewItemId);
      return;
    }

    const retryButton = event.target.closest("[data-article-retry-item-id]");
    if (retryButton) {
      generateArticleIllustrations({
        itemIds: [retryButton.dataset.articleRetryItemId],
        regenerate: true,
      }).catch((error) => setArticleIllustrationFeedback(error.message, "error"));
      return;
    }

    const copyPromptButton = event.target.closest("[data-article-copy-prompt-item-id]");
    if (copyPromptButton) {
      const currentSet = syncArticlePlanEditsFromDom();
      const item = currentSet?.items?.find((entry) => entry.itemId === copyPromptButton.dataset.articleCopyPromptItemId);
      writeTextToClipboard(item?.prompt || "", "当前浏览器不支持复制文章插图提示词。").catch((error) =>
        setArticleIllustrationFeedback(error.message, "error"),
      );
      return;
    }

    const copyCaptionButton = event.target.closest("[data-article-copy-caption-item-id]");
    if (copyCaptionButton) {
      const currentSet = syncArticlePlanEditsFromDom();
      const item = currentSet?.items?.find((entry) => entry.itemId === copyCaptionButton.dataset.articleCopyCaptionItemId);
      writeTextToClipboard(item?.captionText || item?.originalText || "", "当前浏览器不支持复制文章题注。").catch((error) =>
        setArticleIllustrationFeedback(error.message, "error"),
      );
    }
  }
  refs.articleIllustrationReferenceList.addEventListener("click", handleArticleIllustrationCardClick);
  refs.articleIllustrationStoryboardList.addEventListener("click", handleArticleIllustrationCardClick);
  refs.articleRecordRefreshButton.addEventListener("click", () => {
    loadArticleIllustrationSets().catch((error) => setArticleRecordFeedback(error.message, "error"));
  });
  refs.articleRecordSearchInput.addEventListener("input", (event) => {
    state.articleIllustration.recordQuery = event.target.value;
    renderArticleRecordView();
  });
  refs.articleRecordColumnButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const columnPreset = normalizeArticleRecordColumnPreset(button.dataset.articleRecordColumnPreset);
      if (columnPreset === state.articleIllustration.recordColumnPreset) {
        return;
      }
      state.articleIllustration.recordColumnPreset = columnPreset;
      renderArticleRecordView();
    });
  });
  refs.articleIllustrationSourceTextInput.addEventListener("input", updateArticleSourceLength);
  refs.articleRecordList.addEventListener("click", (event) => {
    const target = event.target.closest("[data-article-record-set-id]");
    if (!target) {
      return;
    }
    state.articleIllustration.recordSetId = target.dataset.articleRecordSetId;
    renderArticleRecordView();
  });
  refs.articleRecordDetail.addEventListener("click", (event) => {
    const previewButton = event.target.closest("[data-article-record-preview-item-id]");
    if (previewButton) {
      openArticleRecordItemPreview(
        previewButton.dataset.articleRecordPreviewItemId,
        previewButton.dataset.articleRecordPreviewSetId,
      );
      return;
    }

    const retryButton = event.target.closest("[data-article-retry-item-id]");
    if (retryButton) {
      const selectedSet = getArticleRecordSelectedSet();
      if (selectedSet) {
        state.articleIllustration.currentSet = normalizeArticleSetForView(selectedSet);
        setActiveView("article-illustration");
        generateArticleIllustrations({
          itemIds: [retryButton.dataset.articleRetryItemId],
          regenerate: true,
        }).catch((error) => setArticleIllustrationFeedback(error.message, "error"));
      }
      return;
    }

    const copyPromptButton = event.target.closest("[data-article-copy-prompt-item-id]");
    if (copyPromptButton) {
      const selectedSet = getArticleRecordSelectedSet();
      const item = selectedSet?.items?.find((entry) => entry.itemId === copyPromptButton.dataset.articleCopyPromptItemId);
      writeTextToClipboard(item?.prompt || "", "当前浏览器不支持复制文章插图提示词。").catch((error) =>
        setArticleRecordFeedback(error.message, "error"),
      );
      return;
    }

    const copyCaptionButton = event.target.closest("[data-article-copy-caption-item-id]");
    if (copyCaptionButton) {
      const selectedSet = getArticleRecordSelectedSet();
      const item = selectedSet?.items?.find((entry) => entry.itemId === copyCaptionButton.dataset.articleCopyCaptionItemId);
      writeTextToClipboard(item?.captionText || item?.originalText || "", "当前浏览器不支持复制文章题注。").catch((error) =>
        setArticleRecordFeedback(error.message, "error"),
      );
    }
  });
  refs.articleRecordCopyPromptsButton.addEventListener("click", () => {
    writeTextToClipboard(buildArticlePromptText(), "当前浏览器不支持复制文章插图提示词。").catch((error) =>
      setArticleRecordFeedback(error.message, "error"),
    );
  });
  refs.articleRecordCopyCaptionsButton.addEventListener("click", () => {
    writeTextToClipboard(buildArticleCaptionText(), "当前浏览器不支持复制文章题注。").catch((error) =>
      setArticleRecordFeedback(error.message, "error"),
    );
  });
  refs.articleRecordContinueButton.addEventListener("click", () => {
    const selectedSet = getArticleRecordSelectedSet();
    const failedIds = selectedSet?.items?.filter((item) => item.status === "failed").map((item) => item.itemId) || [];
    if (selectedSet && failedIds.length > 0) {
      state.articleIllustration.currentSet = normalizeArticleSetForView(selectedSet);
      setActiveView("article-illustration");
      generateArticleIllustrations({ itemIds: failedIds }).catch((error) =>
        setArticleIllustrationFeedback(error.message, "error"),
      );
    }
  });
  refs.creationForm.addEventListener("submit", startCreationGeneration);
  refs.creationPlanButton.addEventListener("click", () => {
    previewCreationPlan().catch((error) => setCreationFeedback(error.message, "error"));
  });
  refs.creationRepairFailedButton.addEventListener("click", () => {
    repairCreationItems({ scope: "incomplete" }).catch((error) => setCreationFeedback(error.message, "error"));
  });
  refs.creationRecordRefreshButton.addEventListener("click", () => {
    loadCreationSets().catch((error) => setCreationRecordFeedback(error.message, "error"));
  });
  refs.creationRecordReuseButton.addEventListener("click", reuseCreationRecordSet);
  refs.creationRecordOpenFolderButton.addEventListener("click", () => {
    openCreationRecordFolder().catch((error) => setCreationRecordFeedback(error.message, "error"));
  });
  refs.creationRecordCopyPathsButton.addEventListener("click", () => {
    copyCreationRecordPaths().catch((error) => setCreationRecordFeedback(error.message, "error"));
  });
  refs.creationRecordCopyFullPathsButton.addEventListener("click", () => {
    copyCreationRecordFullPaths().catch((error) => setCreationRecordFeedback(error.message, "error"));
  });
  refs.creationRecordCopyPromptsButton.addEventListener("click", () => {
    copyCreationRecordPrompts().catch((error) => setCreationRecordFeedback(error.message, "error"));
  });
  refs.creationRecordExportPromptsButton.addEventListener("click", exportCreationRecordPrompts);
  refs.creationRecordExportManifestButton.addEventListener("click", exportCreationRecordManifest);
  refs.creationRecordSearchInput.addEventListener("input", (event) => {
    state.creation.recordQuery = event.target.value;
    renderCreationRecordView();
  });
  refs.creationRecordSetList.addEventListener("click", (event) => {
    const target = event.target.closest("[data-creation-record-set-id]");
    if (!target) {
      return;
    }

    selectCreationRecord(target.dataset.creationRecordSetId);
  });
  refs.creationRecordResultGrid.addEventListener("click", (event) => {
    const previewButton = event.target.closest("[data-creation-record-preview-item-id]");
    if (previewButton) {
      openCreationRecordItemPreview(previewButton.dataset.creationRecordPreviewItemId);
      return;
    }
  });
  refs.creationPromptEditorLayer.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-creation-close-prompt-editor]");
    if (closeButton) {
      closeCreationItemEditor(closeButton.dataset.creationClosePromptEditor);
      return;
    }

    const saveButton = event.target.closest("[data-creation-save-prompt-item-id]");
    if (!saveButton) {
      return;
    }

    const itemId = saveButton.dataset.creationSavePromptItemId;
    const textarea = refs.creationPromptEditorLayer.querySelector(
      `[data-creation-prompt-editor="${CSS.escape(itemId)}"]`,
    );
    saveCreationItemDraft(itemId, textarea?.value || "");
  });
  refs.creationResultGrid.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-creation-edit-item-id]");
    if (editButton) {
      toggleCreationItemEditor(editButton.dataset.creationEditItemId);
      return;
    }

    const closeButton = event.target.closest("[data-creation-close-prompt-editor]");
    if (closeButton) {
      closeCreationItemEditor(closeButton.dataset.creationClosePromptEditor);
      return;
    }

    const saveButton = event.target.closest("[data-creation-save-prompt-item-id]");
    if (saveButton) {
      const itemId = saveButton.dataset.creationSavePromptItemId;
      const textarea = [...refs.creationResultGrid.querySelectorAll("[data-creation-prompt-editor]")].find(
        (node) => node.dataset.creationPromptEditor === itemId,
      );
      saveCreationItemDraft(itemId, textarea?.value || "");
      return;
    }

    const button = event.target.closest("[data-creation-retry-item-id]");
    if (!button) {
      return;
    }

    repairCreationItems({ itemId: button.dataset.creationRetryItemId }).catch((error) =>
      setCreationFeedback(error.message, "error"),
    );
  });
  refs.creationImageCountInput.addEventListener("change", syncCreationSelectedRolesToCount);
  refs.creationScenarioInput.addEventListener("change", syncCreationSelectedRolesToScenario);
  refs.creationIndustryTemplateTrigger.addEventListener("click", async () => {
    const shouldOpenCreationIndustryTemplateBrowser = refs.creationIndustryTemplatePopover?.hidden !== false;
    if (shouldOpenCreationIndustryTemplateBrowser) {
      await ensureCreationCategoryTemplatesReady();
      focusCreationIndustryTemplateBrowserOnSelectedTemplate();
    }
    renderCreationIndustryTemplateBrowser();
    setCreationIndustryTemplateBrowserOpen(shouldOpenCreationIndustryTemplateBrowser);
  });
  refs.creationIndustryTemplateBackButton.addEventListener("click", goBackCreationIndustryTemplateLevel);
  refs.creationIndustryTemplateBrowser.addEventListener("click", (event) => {
    const target = event.target.closest("[data-creation-industry-template-value], [data-creation-industry-level]");
    if (!target) {
      return;
    }

    const templateValue = target.dataset.creationIndustryTemplateValue;
    if (templateValue) {
      const previousValue = refs.creationIndustryTemplateInput.value || "general";
      setCreationIndustryTemplateValue(templateValue, { searchText: "" });
      setCreationIndustryTemplateBrowserOpen(false);
      if (previousValue !== refs.creationIndustryTemplateInput.value) {
        syncCreationSelectedRolesToIndustry();
      }
      return;
    }

    updateCreationIndustryTemplateBrowserLevel(
      Number.parseInt(target.dataset.creationIndustryLevel || "0", 10),
      target.dataset.creationIndustryName,
    );
  });
  refs.creationIndustryTemplateSearchInput.addEventListener("input", () => {
    setCreationIndustryTemplateBrowserOpen(true);
    ensureCreationCategoryTemplatesReady({ render: true });
    renderCreationIndustryTemplateBrowser();
  });
  refs.creationRatioInput.addEventListener("change", renderCreationSizeOptions);
  refs.creationRoleGrid.addEventListener("change", (event) => {
    const target = event.target.closest("[data-creation-role]");
    if (!target) {
      return;
    }

    toggleCreationSelectedRole(target.dataset.creationRole);
  });
  refs.creationReferenceInput.addEventListener("change", (event) => {
    applyCreationReferenceFiles(event.target.files);
  });
  refs.creationLogoInput.addEventListener("change", (event) => {
    applyCreationLogoFile(event.target.files);
  });
  refs.creationLogoPlacementInput.addEventListener("change", () => {
    state.creationLogo.placement = normalizeCreationLogoPlacement(refs.creationLogoPlacementInput.value);
    renderCreationLogo();
  });
  refs.creationLogoBackgroundInput.addEventListener("change", () => {
    state.creationLogo.background = normalizeCreationLogoBackground(refs.creationLogoBackgroundInput.value);
    renderCreationLogo();
  });
  refs.creationLogoRemoveButton.addEventListener("click", removeCreationLogoFile);
  refs.creationReferenceAnalyzeButton.addEventListener("click", () => {
    analyzeCreationReferenceImages().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      setCreationReferenceAnalysisFeedback(message, "error");
      showError(message);
    });
  });
  refs.creationReferenceApplyAnalysisButton.addEventListener("click", applyCreationReferenceAnalysisRecommendations);
  refs.creationReferenceGrid.addEventListener("click", (event) => {
    const target = event.target.closest("[data-creation-reference-preview-id]");
    if (!target) {
      return;
    }

    openCreationReferencePreview(target.dataset.creationReferencePreviewId);
  });
  refs.creationReferenceGrid.addEventListener("change", (event) => {
    const bindTarget = event.target.closest("[data-creation-reference-restore-bind-id]");
    if (bindTarget) {
      bindCreationReferenceToRestoreEntry(bindTarget.dataset.creationReferenceRestoreBindId, bindTarget.value);
      return;
    }

    const target = event.target.closest("[data-creation-reference-role-id]");
    if (!target) {
      return;
    }

    updateCreationReferenceRole(target.dataset.creationReferenceRoleId, target.value);
  });
  refs.creationReferenceDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.creationReferenceDropzone.classList.add("dragover");
  });
  refs.creationReferenceDropzone.addEventListener("dragleave", () => {
    refs.creationReferenceDropzone.classList.remove("dragover");
  });
  refs.creationReferenceDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    refs.creationReferenceDropzone.classList.remove("dragover");
    applyCreationReferenceFiles(event.dataTransfer?.files);
  });
  refs.creationLogoDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.creationLogoDropzone.classList.add("dragover");
  });
  refs.creationLogoDropzone.addEventListener("dragleave", () => {
    refs.creationLogoDropzone.classList.remove("dragover");
  });
  refs.creationLogoDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    refs.creationLogoDropzone.classList.remove("dragover");
    applyCreationLogoFile(event.dataTransfer?.files);
  });
  refs.pptForm.addEventListener("submit", startPptGeneration);
  refs.pptCompleteMissingButton.addEventListener("click", completeMissingPptSlides);
  refs.pptRefreshHistoryButton.addEventListener("click", () => {
    loadPptDecks().catch((error) => setPptFeedback(error.message, "error"));
  });
  refs.pptRecordRefreshButton.addEventListener("click", () => {
    loadPptDecks().catch((error) => showError(error.message));
  });
  refs.pptRecordList.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      return;
    }

    const target = event.target.closest("[data-ppt-record-key]");
    if (!target) {
      return;
    }

    selectPptRecord(target.dataset.pptRecordKey);
  });
  refs.pptRecordList.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    if (event.target.closest("a,button")) {
      return;
    }

    const target = event.target.closest("[data-ppt-record-key]");
    if (!target) {
      return;
    }

    event.preventDefault();
    selectPptRecord(target.dataset.pptRecordKey);
  });
  refs.pptRecordDetail.addEventListener("click", (event) => {
    const target = event.target.closest("[data-ppt-record-slide]");
    if (target) {
      selectPptRecordSlide(target.dataset.pptRecordSlide);
      return;
    }

    if (event.target.closest("[data-ppt-record-back]")) {
      clearPptRecordSelection();
    }
  });
  refs.pptSourceModeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      setPptSourceMode(input.value);
    });
  });
  refs.pptSourceInput.addEventListener("change", (event) => {
    applyPptFiles(event.target.files);
  });
  refs.pptDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.pptDropzone.classList.add("dragover");
  });
  refs.pptDropzone.addEventListener("dragleave", () => {
    refs.pptDropzone.classList.remove("dragover");
  });
  refs.pptDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    refs.pptDropzone.classList.remove("dragover");
    applyPptFiles(event.dataTransfer?.files);
  });
  refs.pptSlideList.addEventListener("click", (event) => {
    const target = event.target.closest("[data-ppt-retry-slide]");
    if (target) {
      retryPptSlide(Number(target.dataset.pptRetrySlide));
      return;
    }

    const editTarget = event.target.closest("[data-ppt-edit-slide]");
    if (editTarget) {
      openPptSlideEditor(Number(editTarget.dataset.pptEditSlide));
    }
  });
  refs.pptEditBackdrop.addEventListener("click", closePptSlideEditor);
  refs.pptEditCloseButton.addEventListener("click", closePptSlideEditor);
  refs.pptEditDrawButton.addEventListener("click", () => setPptEditTool("draw"));
  refs.pptEditEraseButton.addEventListener("click", () => setPptEditTool("erase"));
  refs.pptEditClearButton.addEventListener("click", clearPptEditCanvas);
  refs.pptSubmitEditButton.addEventListener("click", () => {
    submitPptSlideEdit().catch((error) => setPptEditFeedback(error.message, "error"));
  });
  refs.pptEditCanvas.addEventListener("pointerdown", beginPptEditStroke);
  refs.pptEditCanvas.addEventListener("pointermove", continuePptEditStroke);
  refs.pptEditCanvas.addEventListener("pointerup", endPptEditStroke);
  refs.pptEditCanvas.addEventListener("pointercancel", endPptEditStroke);
  refs.timelineNewIndicator.addEventListener("click", scrollTimelineToNewest);
  refs.timelineList.addEventListener("scroll", handleTimelineScroll, { passive: true });
  refs.surprisePromptButton.addEventListener("click", selectRandomPrompt);
  refs.closePromptTemplateButton.addEventListener("click", () => setPromptTemplatePopoverOpen(false));
  refs.promptTemplateForm.addEventListener("submit", savePromptTemplate);
  refs.newPromptTemplateButton.addEventListener("click", resetPromptTemplateForm);
  refs.applyPromptTemplateButton.addEventListener("click", applyPromptTemplate);
  refs.deletePromptTemplateButton.addEventListener("click", deletePromptTemplate);
  refs.promptInput.addEventListener("input", updatePromptCounter);
  refs.promptInput.addEventListener("keydown", handlePromptGenerationShortcut);
  refs.styleTransferInstructionInput.addEventListener("keydown", handlePromptGenerationShortcut);
  refs.styleTransferPresetInput.addEventListener("change", handleStyleTransferPresetChange);
  refs.sizeInput.addEventListener("change", (event) => {
    syncGenerationSize(event.target.value);
  });
  refs.referenceAnalysisSizeInput.addEventListener("change", (event) => {
    syncGenerationSize(event.target.value);
  });
  refs.imageDecompositionSizeInput.addEventListener("change", (event) => {
    syncImageDecompositionSize(event.target.value);
  });
  refs.styleTransferSourceInput.addEventListener("change", (event) => {
    applyStyleTransferReferenceFile("source", event.target.files);
  });
  refs.styleTransferStyleInput.addEventListener("change", (event) => {
    applyStyleTransferReferenceFile("style", event.target.files);
  });
  bindStyleTransferDropzone(refs.styleTransferSourceDropzone, "source");
  bindStyleTransferDropzone(refs.styleTransferStyleDropzone, "style");
  refs.referenceInput.addEventListener("change", (event) => {
    applyReferenceFiles(event.target.files);
  });
  refs.referenceGrid.addEventListener("click", (event) => {
    const target = event.target.closest("[data-reference-preview-id]");
    if (!target) {
      return;
    }

    openReferencePreview(target.dataset.referencePreviewId);
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
  refs.referencePreviewBackdrop.addEventListener("click", closeReferencePreview);
  refs.referencePreviewClose.addEventListener("click", closeReferencePreview);
  refs.referenceAnalysisInput.addEventListener("change", (event) => {
    applyReferenceAnalysisFiles(event.target.files);
  });
  refs.referenceAnalysisGrid.addEventListener("click", (event) => {
    const target = event.target.closest("[data-reference-analysis-preview-id]");
    if (!target) {
      return;
    }

    openReferenceAnalysisPreview(target.dataset.referenceAnalysisPreviewId);
  });
  refs.referenceAnalysisDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.referenceAnalysisDropzone.classList.add("dragover");
  });
  refs.referenceAnalysisDropzone.addEventListener("dragleave", () => {
    refs.referenceAnalysisDropzone.classList.remove("dragover");
  });
  refs.referenceAnalysisDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    refs.referenceAnalysisDropzone.classList.remove("dragover");
    applyReferenceAnalysisFiles(event.dataTransfer?.files);
  });
  refs.imageDecompositionInput.addEventListener("change", (event) => {
    applyImageDecompositionFile(event.target.files);
  });
  refs.imageDecompositionDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.imageDecompositionDropzone.classList.add("dragover");
  });
  refs.imageDecompositionDropzone.addEventListener("dragleave", () => {
    refs.imageDecompositionDropzone.classList.remove("dragover");
  });
  refs.imageDecompositionDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    refs.imageDecompositionDropzone.classList.remove("dragover");
    applyImageDecompositionFile(event.dataTransfer?.files);
  });
  refs.imageDecompositionGrid.addEventListener("click", (event) => {
    const target = event.target.closest("[data-image-decomposition-preview-id]");
    if (!target) {
      return;
    }

    openImageDecompositionPreview(target.dataset.imageDecompositionPreviewId);
  });
  refs.imageDecompositionLanguageInput.addEventListener("change", (event) => {
    state.imageDecomposition.language = event.target.value;
    syncImageDecompositionLanguageUI();
    renderImageDecompositionView();
  });
  refs.imageDecompositionCustomLanguageInput.addEventListener("input", (event) => {
    state.imageDecomposition.customLanguage = event.target.value;
    renderImageDecompositionView();
  });
  refs.imageDecompositionFeatureCardsInput.addEventListener("change", (event) => {
    state.imageDecomposition.featureCardsEnabled = event.target.value === "on";
  });
  refs.imageDecompositionGenerateButton.addEventListener("click", () => {
    startImageDecompositionGeneration().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      setImageDecompositionFeedback(message, "error");
      showError(message);
    });
  });
  refs.imageDecompositionGenerationLightboxButton.addEventListener("click", openImageDecompositionGeneratedPreview);
  refs.referenceAnalyzeButton.addEventListener("click", () => {
    analyzeReferenceImages().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      setReferenceAnalysisFeedback(message, "error");
      showError(message);
    });
  });
  refs.referenceAnalysisToggleButton.addEventListener("click", toggleReferenceAnalysisPanel);
  refs.referenceAnalysisAutoCollapseButton.addEventListener("click", toggleReferenceAnalysisAutoCollapse);
  refs.referenceAnalysisCopyPromptButton.addEventListener("click", () => {
    copyReferenceAnalysisSelectedPrompt().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      setReferenceAnalysisFeedback(message, "error");
    });
  });
  refs.referenceAnalysisGenerateButton.addEventListener("click", () => {
    startReferenceAnalysisGeneration().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      setReferenceAnalysisFeedback(message, "error");
      showError(message);
    });
  });
  refs.referenceAnalysisList.addEventListener("click", (event) => {
    const target = event.target.closest("[data-reference-analysis-prompt-index]");
    if (target) {
      applyReferenceAnalysisPrompt(target.dataset.referenceAnalysisPromptIndex);
    }
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
    const expandTarget = event.target.closest("[data-prompt-agent-expand-id]");
    if (expandTarget) {
      togglePromptAgentHistoryCard(expandTarget);
      return;
    }

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
    resetGalleryHistoryPage();
    renderGalleryView();
  });
  refs.galleryDateInput.addEventListener("input", (event) => {
    state.galleryControls.date = event.target.value;
    if (event.target.value) {
      state.galleryControls.window = "all";
    }
    resetGalleryHistoryPage();
    renderGalleryView();
  });
  refs.gallerySizeFilterInput.addEventListener("change", (event) => {
    state.galleryControls.size = event.target.value;
    resetGalleryHistoryPage();
    renderGalleryView();
  });
  refs.galleryReferenceFilterInput.addEventListener("change", (event) => {
    state.galleryControls.reference = event.target.value;
    resetGalleryHistoryPage();
    renderGalleryView();
  });
  refs.galleryResetFiltersButton.addEventListener("click", () => {
    state.galleryControls = { ...DEFAULT_GALLERY_CONTROLS };
    resetGalleryHistoryPage();
    renderGalleryView();
    refs.gallerySearchInput.focus();
  });
  refs.galleryPreviousPageButton.addEventListener("click", () => {
    setGalleryHistoryPage(state.galleryHistoryPage - 1);
  });
  refs.galleryNextPageButton.addEventListener("click", () => {
    setGalleryHistoryPage(state.galleryHistoryPage + 1);
  });
  refs.focusGalleryButton?.addEventListener("click", () => {
    setActiveView("gallery");
  });
  refs.clearHistoryButton?.addEventListener("click", () => {
    clearHistory().catch((error) => showError(error.message));
  });
  refs.previewLightboxButton.addEventListener("click", () => {
    const item = getCurrentPreviewItem();
    if (item && getImageUrl(item)) {
      openLightbox(item);
    }
  });
  refs.previewDownloadButton.addEventListener("click", (event) => {
    event.preventDefault();
    const item = getCurrentPreviewItem();
    downloadGalleryItem(item, refs.previewImage).catch((error) => {
      showError(error.message);
    });
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
  refs.referenceAnalysisGenerationCanvas.addEventListener("click", openReferenceAnalysisGeneratedPreview);
  refs.referenceAnalysisGenerationCanvas.addEventListener("keydown", (event) => {
    const shouldOpenPreview = event.key === "Enter" || event.key === " ";
    if (!shouldOpenPreview) {
      return;
    }

    const item = getReferenceAnalysisGenerationPreviewItem();
    if (!item || !getImageUrl(item)) {
      return;
    }

    event.preventDefault();
    openReferenceAnalysisGeneratedPreview();
  });
  refs.referenceAnalysisGenerationStrip.addEventListener("click", (event) => {
    const target = event.target.closest("[data-reference-analysis-generation-key]");
    if (!target) {
      return;
    }

    setReferenceAnalysisGenerationPreviewKey(target.dataset.referenceAnalysisGenerationKey);
  });
  refs.imageDecompositionGenerationCanvas.addEventListener("click", openImageDecompositionGeneratedPreview);
  refs.imageDecompositionGenerationCanvas.addEventListener("keydown", (event) => {
    const shouldOpenPreview = event.key === "Enter" || event.key === " ";
    if (!shouldOpenPreview) {
      return;
    }

    const item = getImageDecompositionGenerationPreviewItem();
    if (!item || !getImageUrl(item)) {
      return;
    }

    event.preventDefault();
    openImageDecompositionGeneratedPreview();
  });
  refs.imageDecompositionGenerationStrip.addEventListener("click", (event) => {
    const target = event.target.closest("[data-image-decomposition-generation-key]");
    if (!target) {
      return;
    }

    setImageDecompositionGenerationPreviewKey(target.dataset.imageDecompositionGenerationKey);
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
  refs.lightboxDownload.addEventListener("click", (event) => {
    event.preventDefault();
    downloadGalleryItem(state.lightboxItem, refs.lightboxImage).catch((error) => {
      showError(error.message);
    });
  });
  refs.copyPromptButton.addEventListener("click", () => {
    copyLightboxPrompt().catch((error) => {
      showError(error.message);
    });
  });
  refs.lightboxCopyPathButton.addEventListener("click", () => {
    copyLightboxCreationRecordPath().catch((error) => {
      showError(error.message);
    });
  });
  refs.lightboxCopyFullPathButton.addEventListener("click", () => {
    copyLightboxCreationRecordFullPath().catch((error) => {
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

      if (refs.referencePreviewViewer.classList.contains("open")) {
        closeReferencePreview();
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
    if (refs.creationIndustryTemplatePopover && !refs.creationIndustryTemplatePopover.hidden) {
      if (!refs.creationIndustryTemplateBrowser.contains(event.target)) {
        setCreationIndustryTemplateBrowserOpen(false);
      }
    }

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

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && refs.creationIndustryTemplatePopover && !refs.creationIndustryTemplatePopover.hidden) {
      setCreationIndustryTemplateBrowserOpen(false);
    }
  });
}

async function bootstrap() {
  state.clientSessionId = getOrCreateClientSessionId();
  state.uiTheme = readUiTheme();
  setUiTheme(state.uiTheme);
  state.activityFeed = readGenerationActivityFeed();
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
  renderReferenceAnalysisRatioGrid();
  renderReferenceAnalysisSizeOptions();
  renderCreationIndustryTemplateBrowser();
  updateGenerateButton();
  renderReferenceGrid();
  renderReferenceAnalysisGrid();
  renderReferenceAnalysis();
  renderStyleTransferReferences();
  renderPromptTemplates();
  renderTimeline();
  renderStudio();
  renderArticleIllustrationView();
  renderArticleRecordView();
  renderCreationView();
  renderPptView();
  renderGalleryView();
  setActiveView(getViewFromHash());
  scheduleGalleryPanelHeightSync();
  scheduleGalleryScrollSync();

  try {
    await loadConfig();
    await loadGallery();
    await loadArticleIllustrationSets();
    await loadCreationSets();
    await loadGenerationTasks();
    await loadPromptAgentHistory();
    await loadPptDecks();
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
    setConnectionState("error", "初始化失败");
  }
}

bootstrap();
