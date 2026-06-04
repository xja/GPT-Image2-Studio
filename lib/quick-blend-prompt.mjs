export const QUICK_BLEND_MODE = "quick-blend";
export const QUICK_BLEND_ASSET_KIND = "quick-blend";
export const QUICK_BLEND_METADATA_FIELDS = Object.freeze([
  "quickBlendPairIndex",
  "quickBlendAImageName",
  "quickBlendBImageName",
]);

export const QUICK_BLEND_REFERENCE_LABELS = Object.freeze([
  "Reference image 1: A image. Use only the visible A subject or subjects. Preserve identity cues, shape, color, material, markings, and proportions. Do not render this label.",
  "Reference image 2: B image. Use only the visible B subject or subjects. Preserve identity cues, shape, color, material, markings, and proportions. Do not render this label.",
]);

function sanitizeQuickBlendFilename(value = "") {
  return String(value || "").replace(/[\s\p{C}]+/gu, " ").trim();
}

function getQuickBlendFilenameStem(value = "") {
  const rawFilename = String(value || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .pop()
    ?.trim() || "";
  return rawFilename
    .replace(/\.[a-z0-9]{1,10}$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .trim();
}

export function buildQuickBlendFilenameToken({ aImageName = "", bImageName = "" } = {}) {
  return [getQuickBlendFilenameStem(aImageName), getQuickBlendFilenameStem(bImageName)]
    .filter(Boolean)
    .join("-")
    .slice(0, 100)
    .replace(/-+$/g, "");
}

export function normalizeQuickBlendPairIndex(value = 1) {
  const parsed = Number(String(value || "1").trim());
  return String(Number.isInteger(parsed) && parsed > 0 ? parsed : 1);
}

export function buildQuickBlendPrompt({ pairIndex = 1, aImageName = "", bImageName = "" } = {}) {
  const normalizedPairIndex = normalizeQuickBlendPairIndex(pairIndex);
  const normalizedAImageName = sanitizeQuickBlendFilename(aImageName);
  const normalizedBImageName = sanitizeQuickBlendFilename(bImageName);
  const sourceLine = [
    `Quick Blend pair ${normalizedPairIndex}.`,
    normalizedAImageName ? `A filename: ${normalizedAImageName}.` : "",
    normalizedBImageName ? `B filename: ${normalizedBImageName}.` : "",
  ].filter(Boolean).join(" ");

  return {
    prompt: [
      sourceLine,
      "Use the first reference image as A and the second reference image as B.",
      "Extract the visible main subject or subjects from A and B. Remove or neutralize the original backgrounds so the final image reads like clean cutout composition work.",
      "Arrange the A subject group above the B subject group in one vertical image. Keep both groups centered, separated by clean spacing, and scaled so both are easy to inspect.",
      "Preserve subject shape, colors, materials, markings, proportions, and identity cues from each source image. Do not redesign, recolor, relabel, or merge the two subjects into one object.",
      "Use a clean neutral studio background or transparent-looking neutral surface. Keep the composition product-like and uncluttered.",
      "Do not add text, labels, watermarks, unrelated objects, invented logos, or decorative scene elements.",
      "Do not create a gallery grid or exhaustive combination set. Generate only this matched A/B pair.",
    ].join(" "),
    pairIndex: normalizedPairIndex,
    aImageName: normalizedAImageName,
    bImageName: normalizedBImageName,
  };
}
