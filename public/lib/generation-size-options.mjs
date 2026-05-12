const SIZE_OPTIONS_BY_RATIO = {
  "1:1": [
    { value: "auto", label: "自动适配" },
    { value: "1024x1024", label: "1024 × 1024" },
    { value: "1536x1536", label: "1536 × 1536" },
    { value: "2048x2048", label: "2048 × 2048" },
    { value: "2816x2816", label: "2816 × 2816" },
  ],
  "5:4": [
    { value: "auto", label: "自动适配" },
    { value: "1280x1024", label: "1280 × 1024" },
    { value: "1120x896", label: "1120 × 896" },
    { value: "1920x1536", label: "1920 × 1536" },
    { value: "2560x2048", label: "2560 × 2048" },
    { value: "3120x2496", label: "3120 × 2496" },
  ],
  "9:16": [
    { value: "auto", label: "自动适配" },
    { value: "720x1280", label: "720 × 1280" },
    { value: "768x1365", label: "768 × 1365" },
    { value: "864x1536", label: "864 × 1536" },
    { value: "1152x2048", label: "1152 × 2048" },
    { value: "2016x3584", label: "2016 × 3584" },
    { value: "2151x3824", label: "2151 × 3824" },
    { value: "2160x3840", label: "2160 × 3840" },
  ],
  "21:9": [
    { value: "auto", label: "自动适配" },
    { value: "1680x720", label: "1680 × 720" },
    { value: "1568x672", label: "1568 × 672" },
    { value: "1916x821", label: "1916 × 821" },
    { value: "2688x1152", label: "2688 × 1152" },
    { value: "3360x1440", label: "3360 × 1440" },
    { value: "3584x1536", label: "3584 × 1536" },
    { value: "3824x1639", label: "3824 × 1639" },
    { value: "3832x1642", label: "3832 × 1642" },
    { value: "3840x1646", label: "3840 × 1646" },
  ],
  "16:9": [
    { value: "auto", label: "自动适配" },
    { value: "1280x720", label: "1280 × 720" },
    { value: "1365x768", label: "1365 × 768" },
    { value: "1536x864", label: "1536 × 864" },
    { value: "2048x1152", label: "2048 × 1152" },
    { value: "3584x2016", label: "3584 × 2016" },
    { value: "3824x2151", label: "3824 × 2151" },
    { value: "3840x2160", label: "3840 × 2160" },
  ],
  "4:3": [
    { value: "auto", label: "自动适配" },
    { value: "1024x768", label: "1024 × 768" },
    { value: "1152x864", label: "1152 × 864" },
    { value: "1536x1152", label: "1536 × 1152" },
    { value: "2048x1536", label: "2048 × 1536" },
    { value: "3072x2304", label: "3072 × 2304" },
  ],
  "3:2": [
    { value: "auto", label: "自动适配" },
    { value: "1536x1024", label: "1536 × 1024" },
    { value: "1248x832", label: "1248 × 832" },
    { value: "2304x1536", label: "2304 × 1536" },
    { value: "3072x2048", label: "3072 × 2048" },
    { value: "3456x2304", label: "3456 × 2304" },
  ],
  "4:5": [
    { value: "auto", label: "自动适配" },
    { value: "1024x1280", label: "1024 × 1280" },
    { value: "896x1120", label: "896 × 1120" },
    { value: "1536x1920", label: "1536 × 1920" },
    { value: "2048x2560", label: "2048 × 2560" },
    { value: "2496x3120", label: "2496 × 3120" },
  ],
  "3:4": [
    { value: "auto", label: "自动适配" },
    { value: "768x1024", label: "768 × 1024" },
    { value: "864x1152", label: "864 × 1152" },
    { value: "1536x2048", label: "1536 × 2048" },
    { value: "1920x2560", label: "1920 × 2560" },
    { value: "2304x3072", label: "2304 × 3072" },
    { value: "2448x3264", label: "2448 × 3264" },
  ],
  "2:3": [
    { value: "auto", label: "自动适配" },
    { value: "1024x1536", label: "1024 × 1536" },
    { value: "832x1248", label: "832 × 1248" },
    { value: "1536x2304", label: "1536 × 2304" },
    { value: "2048x3072", label: "2048 × 3072" },
    { value: "2304x3456", label: "2304 × 3456" },
  ],
};

const DEFAULT_RATIO = "4:5";
const DEFAULT_SIZE_BY_RATIO = {
  "1:1": "1024x1024",
  "5:4": "1120x896",
  "9:16": "768x1365",
  "21:9": "1568x672",
  "16:9": "1365x768",
  "4:3": "1152x864",
  "3:2": "1248x832",
  "4:5": "896x1120",
  "3:4": "864x1152",
  "2:3": "832x1248",
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
