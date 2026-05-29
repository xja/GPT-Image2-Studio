export function getCreationReferenceAnalysisVisualLanguageSource(analysis = {}) {
  const direct =
    analysis?.visualLanguage ||
    analysis?.visual_language ||
    analysis?.visualLanguageRecommendation ||
    analysis?.visual_language_recommendation ||
    analysis?.visualLanguageSuggestion ||
    analysis?.visual_language_suggestion;
  return direct && typeof direct === "object"
    ? direct.value || direct.visualLanguage || direct.visual_language || direct.id || direct.mode
    : direct;
}

export function getCreationReferenceAnalysisVisualLanguageReason(analysis = {}) {
  const direct = analysis?.visualLanguageSuggestion || analysis?.visual_language_suggestion;
  return String(
    analysis?.visualLanguageReason ||
      analysis?.visual_language_reason ||
      analysis?.visualLanguageNote ||
      analysis?.visual_language_note ||
      (direct && typeof direct === "object" ? direct.reason || direct.note || direct.description : "") ||
      "",
  ).trim();
}

export function syncCreationReferenceVisualLanguageButton({
  button,
  analysis,
  currentValue = "classic-commercial",
  dirty = false,
  running = false,
  normalizeVisualLanguage = (value) => String(value || "classic-commercial"),
} = {}) {
  if (!button) return null;

  const currentVisualLanguage = normalizeVisualLanguage(currentValue);
  const suggestedVisualLanguage = normalizeVisualLanguage(analysis?.visualLanguage || "classic-commercial");
  const alreadyUsingSuggestion = currentVisualLanguage === suggestedVisualLanguage;
  button.classList.toggle("hidden", !analysis);
  button.disabled = !analysis || alreadyUsingSuggestion || dirty || running;
  button.textContent = alreadyUsingSuggestion ? "已是建议视觉语言" : "应用视觉语言";
  return { alreadyUsingSuggestion, currentVisualLanguage, suggestedVisualLanguage };
}

export function appendCreationVisualLanguageSuggestionCard(
  container,
  analysis = {},
  { formatVisualLanguageLabel = (value) => String(value || "") } = {},
) {
  if (!container || !analysis.visualLanguage) return null;

  const doc = container.ownerDocument || globalThis.document;
  const visualLanguageLabel = analysis.visualLanguageLabel || formatVisualLanguageLabel(analysis.visualLanguage);
  const visualItem = doc.createElement("article");
  const title = doc.createElement("strong");
  const note = doc.createElement("p");

  visualItem.className = "reference-analysis-card creation-reference-analysis-card creation-visual-language-card";
  title.textContent = `视觉语言建议 · ${visualLanguageLabel}`;
  note.textContent =
    analysis.visualLanguageReason ||
    (analysis.visualLanguage === "reference-style"
      ? "建议由单独按钮应用，避免一键建议自动改变整套视觉方向。"
      : "建议保持经典商业拍摄，确保 SKU 系列画面统一。");

  visualItem.append(title, note);
  container.appendChild(visualItem);
  return visualItem;
}
