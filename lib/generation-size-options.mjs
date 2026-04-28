const SIZE_OPTIONS_BY_RATIO = {
  "1:1": [
    { value: "auto", label: "自动适配" },
    { value: "1024x1024", label: "1024 × 1024" },
    { value: "1536x1536", label: "1536 × 1536" },
    { value: "2048x2048", label: "2048 × 2048" },
    { value: "2880x2880", label: "2880 × 2880" },
  ],
  "5:4": [
    { value: "auto", label: "自动适配" },
    { value: "1280x1024", label: "1280 × 1024" },
    { value: "1920x1536", label: "1920 × 1536" },
    { value: "2560x2048", label: "2560 × 2048" },
    { value: "3200x2560", label: "3200 × 2560" },
  ],
  "9:16": [
    { value: "auto", label: "自动适配" },
    { value: "1008x1792", label: "1008 × 1792" },
    { value: "1584x2816", label: "1584 × 2816" },
    { value: "2016x3584", label: "2016 × 3584" },
    { value: "2160x3840", label: "2160 × 3840" },
  ],
  "21:9": [
    { value: "auto", label: "自动适配" },
    { value: "2352x1008", label: "2352 × 1008" },
    { value: "3696x1584", label: "3696 × 1584" },
  ],
  "16:9": [
    { value: "auto", label: "自动适配" },
    { value: "1792x1008", label: "1792 × 1008" },
    { value: "2816x1584", label: "2816 × 1584" },
    { value: "3584x2016", label: "3584 × 2016" },
    { value: "3840x2160", label: "3840 × 2160" },
  ],
  "4:3": [
    { value: "auto", label: "自动适配" },
    { value: "1344x1008", label: "1344 × 1008" },
    { value: "2048x1536", label: "2048 × 1536" },
    { value: "2752x2064", label: "2752 × 2064" },
    { value: "3264x2448", label: "3264 × 2448" },
  ],
  "3:2": [
    { value: "auto", label: "自动适配" },
    { value: "1536x1024", label: "1536 × 1024" },
    { value: "2304x1536", label: "2304 × 1536" },
    { value: "3072x2048", label: "3072 × 2048" },
    { value: "3504x2336", label: "3504 × 2336" },
  ],
  "4:5": [
    { value: "auto", label: "自动适配" },
    { value: "1024x1280", label: "1024 × 1280" },
    { value: "1536x1920", label: "1536 × 1920" },
    { value: "2048x2560", label: "2048 × 2560" },
    { value: "2560x3200", label: "2560 × 3200" },
  ],
  "3:4": [
    { value: "auto", label: "自动适配" },
    { value: "1008x1344", label: "1008 × 1344" },
    { value: "1536x2048", label: "1536 × 2048" },
    { value: "2064x2752", label: "2064 × 2752" },
    { value: "2448x3264", label: "2448 × 3264" },
  ],
  "2:3": [
    { value: "auto", label: "自动适配" },
    { value: "1024x1536", label: "1024 × 1536" },
    { value: "1536x2304", label: "1536 × 2304" },
    { value: "2048x3072", label: "2048 × 3072" },
    { value: "2336x3504", label: "2336 × 3504" },
  ],
};

const DEFAULT_RATIO = "4:5";
const DEFAULT_SIZE_BY_RATIO = {
  "1:1": "1024x1024",
  "5:4": "1280x1024",
  "9:16": "1008x1792",
  "21:9": "2352x1008",
  "16:9": "1792x1008",
  "4:3": "1344x1008",
  "3:2": "1536x1024",
  "4:5": "1024x1280",
  "3:4": "1008x1344",
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
