const SIZE_OPTIONS_BY_RATIO = {
  "1:1": [
    { value: "auto", label: "自动适配" },
    { value: "1024x1024", label: "1024 × 1024" },
    { value: "1536x1536", label: "1536 × 1536" },
    { value: "2048x2048", label: "2048 × 2048" },
  ],
  "5:4": [
    { value: "auto", label: "自动适配" },
    { value: "1280x1024", label: "1280 × 1024" },
    { value: "1600x1280", label: "1600 × 1280" },
    { value: "2000x1600", label: "2000 × 1600" },
  ],
  "9:16": [
    { value: "auto", label: "自动适配" },
    { value: "720x1280", label: "720 × 1280" },
    { value: "864x1536", label: "864 × 1536" },
    { value: "1152x2048", label: "1152 × 2048" },
  ],
  "21:9": [
    { value: "auto", label: "自动适配" },
    { value: "1344x576", label: "1344 × 576" },
    { value: "1680x720", label: "1680 × 720" },
    { value: "2016x864", label: "2016 × 864" },
  ],
  "16:9": [
    { value: "auto", label: "自动适配" },
    { value: "1280x720", label: "1280 × 720" },
    { value: "1536x864", label: "1536 × 864" },
    { value: "2048x1152", label: "2048 × 1152" },
  ],
  "4:3": [
    { value: "auto", label: "自动适配" },
    { value: "1024x768", label: "1024 × 768" },
    { value: "1536x1152", label: "1536 × 1152" },
    { value: "2048x1536", label: "2048 × 1536" },
  ],
  "3:2": [
    { value: "auto", label: "自动适配" },
    { value: "1152x768", label: "1152 × 768" },
    { value: "1536x1024", label: "1536 × 1024" },
    { value: "2016x1344", label: "2016 × 1344" },
  ],
  "4:5": [
    { value: "auto", label: "自动适配" },
    { value: "1024x1280", label: "1024 × 1280" },
    { value: "1280x1600", label: "1280 × 1600" },
    { value: "1600x2000", label: "1600 × 2000" },
  ],
  "3:4": [
    { value: "auto", label: "自动适配" },
    { value: "768x1024", label: "768 × 1024" },
    { value: "1152x1536", label: "1152 × 1536" },
    { value: "1536x2048", label: "1536 × 2048" },
  ],
  "2:3": [
    { value: "auto", label: "自动适配" },
    { value: "768x1152", label: "768 × 1152" },
    { value: "1024x1536", label: "1024 × 1536" },
    { value: "1344x2016", label: "1344 × 2016" },
  ],
};

const DEFAULT_RATIO = "4:5";
const DEFAULT_SIZE_BY_RATIO = {
  "1:1": "1536x1536",
  "5:4": "1600x1280",
  "9:16": "864x1536",
  "21:9": "1680x720",
  "16:9": "1536x864",
  "4:3": "1536x1152",
  "3:2": "1536x1024",
  "4:5": "1280x1600",
  "3:4": "1152x1536",
  "2:3": "1024x1536",
};

export function getGenerationSizeOptions(ratio = DEFAULT_RATIO) {
  return (SIZE_OPTIONS_BY_RATIO[ratio] || SIZE_OPTIONS_BY_RATIO[DEFAULT_RATIO]).map((option) => ({ ...option }));
}

export function getDefaultGenerationSize(ratio = DEFAULT_RATIO) {
  return DEFAULT_SIZE_BY_RATIO[ratio] || DEFAULT_SIZE_BY_RATIO[DEFAULT_RATIO];
}

export function isGenerationSizeCompatible(ratio = DEFAULT_RATIO, size = "auto") {
  const normalized = String(size || "auto").trim().toLowerCase();
  return getGenerationSizeOptions(ratio).some((option) => option.value === normalized);
}

export function normalizeGenerationSize(ratio = DEFAULT_RATIO, size = "auto") {
  const normalized = String(size || "auto").trim().toLowerCase();
  return isGenerationSizeCompatible(ratio, normalized) ? normalized : "auto";
}
