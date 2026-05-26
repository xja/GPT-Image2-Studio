const CREATION_LISTING_BUCKET_LABELS = {
  exact: "精准关键词",
  longTail: "长尾关键词",
  traffic: "流量关键词",
  descriptive: "描述词",
};

const CREATION_LISTING_BUCKET_COPY_LABELS = {
  exact: "Exact keywords",
  longTail: "Long-tail keywords",
  traffic: "Traffic keywords",
  descriptive: "Descriptive keywords",
};

const CJK_TEXT_GLOBAL_PATTERN = /[\u3400-\u9fff]+/gu;
const NON_ASCII_TEXT_PATTERN = /[^\x20-\x7E]+/g;
const listingFieldCopyTimers = new WeakMap();

export function cleanCreationListingText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getCreationListingGeneratingSetIds(state = {}) {
  const creation = state?.creation || {};
  const ids = new Set();
  if (Array.isArray(creation.listingGeneratingSetIds)) {
    creation.listingGeneratingSetIds
      .map(cleanCreationListingText)
      .filter(Boolean)
      .forEach((id) => ids.add(id));
  }
  const legacyId = cleanCreationListingText(creation.listingGeneratingSetId);
  if (legacyId) {
    ids.add(legacyId);
  }
  return ids;
}

function writeCreationListingGeneratingSetIds(context = {}, ids = new Set()) {
  if (!context.state) {
    context.state = {};
  }
  if (!context.state.creation) {
    context.state.creation = {};
  }
  const nextIds = [...ids].map(cleanCreationListingText).filter(Boolean);
  context.state.creation.listingGeneratingSetIds = nextIds;
  context.state.creation.listingGeneratingSetId = nextIds[0] || "";
}

function setCreationListingGenerating(context = {}, setId, isGenerating) {
  const id = cleanCreationListingText(setId);
  if (!id) {
    return;
  }
  const ids = getCreationListingGeneratingSetIds(context.state);
  if (isGenerating) {
    ids.add(id);
  } else {
    ids.delete(id);
  }
  writeCreationListingGeneratingSetIds(context, ids);
}

function isCreationListingGenerating(state = {}, setId) {
  const id = cleanCreationListingText(setId);
  return Boolean(id && getCreationListingGeneratingSetIds(state).has(id));
}

function createInlineBusyMotion() {
  const motion = document.createElement("span");
  motion.className = "inline-busy-motion";
  motion.setAttribute?.("aria-hidden", "true");
  for (let index = 0; index < 3; index += 1) {
    motion.appendChild(document.createElement("span"));
  }
  return motion;
}

function renderCreationListingGenerateButton(button, { disabled = false, isGenerating = false } = {}) {
  button.disabled = disabled;
  button.classList?.toggle("is-loading", isGenerating);
  if (!isGenerating || typeof document === "undefined" || typeof button.replaceChildren !== "function") {
    button.textContent = isGenerating ? "生成中..." : "生成 Listing";
    return;
  }
  const label = document.createElement("span");
  label.className = "creation-listing-generate-label";
  label.textContent = "生成中...";
  button.replaceChildren(createInlineBusyMotion(), label);
}

function isEnglishCreationListingLanguage(language) {
  return /^en(?:-|$)/i.test(cleanCreationListingText(language));
}

function isEnglishCreationListingDraft(draft = {}) {
  return isEnglishCreationListingLanguage(draft.language);
}

function cleanEnglishVisibleListingText(value, fallback = "") {
  const cleaned = cleanCreationListingText(value);
  if (!cleaned) {
    return fallback;
  }
  const ascii = cleanCreationListingText(cleaned
    .replace(CJK_TEXT_GLOBAL_PATTERN, " ")
    .replace(NON_ASCII_TEXT_PATTERN, " ")
    .replace(/:\s*(?:[,;]\s*)+\./g, ".")
    .replace(/:\s*(?:[,;]\s*)+(?=\s|$)/g, "")
    .replace(/,\s*(?=[,.;])/g, "")
    .replace(/\s+([,.;:])/g, "$1"));
  return /[A-Za-z0-9]/.test(ascii) ? ascii : fallback;
}

function formatCreationListingVisibleText(draft = {}, value, fallback = "") {
  return isEnglishCreationListingDraft(draft)
    ? cleanEnglishVisibleListingText(value, fallback)
    : cleanCreationListingText(value) || fallback;
}

function formatCreationListingPublicText(value, language, fallback = "") {
  return isEnglishCreationListingLanguage(language)
    ? cleanEnglishVisibleListingText(value, fallback)
    : cleanCreationListingText(value) || fallback;
}

function cleanCreationListingArray(value, { split = false } = {}) {
  const source = Array.isArray(value)
    ? value
    : split
      ? String(value || "").split(/[,\n;]+/)
      : value
        ? [value]
        : [];
  return source.map(cleanCreationListingText).filter(Boolean);
}

function cleanCreationListingPublicArray(value, { split = false, language = "" } = {}) {
  const source = Array.isArray(value)
    ? value
    : split
      ? String(value || "").split(/[,\n;]+/)
      : value
        ? [value]
        : [];
  return source.map((item) => formatCreationListingPublicText(item, language)).filter(Boolean);
}

function normalizeCreationListingKeywordBuckets(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    exact: cleanCreationListingArray(source.exact || source.precise, { split: true }),
    longTail: cleanCreationListingArray(source.longTail || source.long_tail || source.longtail, { split: true }),
    traffic: cleanCreationListingArray(source.traffic, { split: true }),
    descriptive: cleanCreationListingArray(source.descriptive || source.description || source.descriptors, { split: true }),
  };
}

function normalizeCreationListingPublicKeywordBuckets(value = {}, language = "") {
  const source = value && typeof value === "object" ? value : {};
  return {
    exact: cleanCreationListingPublicArray(source.exact || source.precise, { split: true, language }),
    longTail: cleanCreationListingPublicArray(source.longTail || source.long_tail || source.longtail, { split: true, language }),
    traffic: cleanCreationListingPublicArray(source.traffic, { split: true, language }),
    descriptive: cleanCreationListingPublicArray(source.descriptive || source.description || source.descriptors, { split: true, language }),
  };
}

function normalizeCreationListingDisplayForView(value = {}) {
  if (!value || typeof value !== "object") {
    return null;
  }
  return {
    title: cleanCreationListingText(value.title),
    sellingPoints: cleanCreationListingArray(value.sellingPoints || value.selling_points),
    painPoints: cleanCreationListingArray(value.painPoints || value.pain_points),
    fiveBullets: cleanCreationListingArray(value.fiveBullets || value.five_bullets),
    description: cleanCreationListingText(value.description),
    backendSearchTerms: cleanCreationListingText(value.backendSearchTerms || value.backend_search_terms),
    keywordBuckets: normalizeCreationListingKeywordBuckets(value.keywordBuckets || value.keyword_buckets),
  };
}

export function normalizeCreationListingDraftForView(draft = {}, fallbackIndex = 0) {
  const language = cleanCreationListingText(draft.language) || "en-US";
  const keywordBuckets = normalizeCreationListingPublicKeywordBuckets(draft.keywordBuckets || draft.keyword_buckets, language);
  const zhDisplay = normalizeCreationListingDisplayForView(draft.zhDisplay || draft.zh_display);
  return {
    id: cleanCreationListingText(draft.id) || `listing-${fallbackIndex + 1}`,
    marketplace: cleanCreationListingText(draft.marketplace) || "amazon-us",
    language,
    skuSubjectId: cleanCreationListingText(draft.skuSubjectId || draft.sku_subject_id),
    skuTitle: cleanCreationListingText(draft.skuTitle || draft.sku_title),
    evidenceMode: cleanCreationListingText(draft.evidenceMode || draft.evidence_mode) || "input-only",
    status: cleanCreationListingText(draft.status) || "completed",
    title: formatCreationListingPublicText(draft.title, language, `Listing ${fallbackIndex + 1}`),
    sellingPoints: cleanCreationListingPublicArray(draft.sellingPoints || draft.selling_points, { language }),
    painPoints: cleanCreationListingPublicArray(draft.painPoints || draft.pain_points, { language }),
    fiveBullets: cleanCreationListingPublicArray(draft.fiveBullets || draft.five_bullets, { language }),
    description: formatCreationListingPublicText(draft.description, language),
    backendSearchTerms: formatCreationListingPublicText(draft.backendSearchTerms || draft.backend_search_terms, language),
    keywordBuckets,
    evidence: cleanCreationListingArray(draft.evidence),
    missingInfo: cleanCreationListingArray(draft.missingInfo || draft.missing_info),
    warnings: cleanCreationListingArray(draft.warnings),
    createdAt: cleanCreationListingText(draft.createdAt || draft.created_at),
    updatedAt: cleanCreationListingText(draft.updatedAt || draft.updated_at),
    ...(zhDisplay ? { zhDisplay } : {}),
  };
}

export function getCreationListingDrafts(set) {
  return Array.isArray(set?.listingDrafts) ? set.listingDrafts : [];
}

export function getCreationRecordListingMetaLabel(set) {
  return getCreationListingDrafts(set).length > 0 ? "Listing" : "";
}

export function formatCreationListingDraftHeader(draft = {}, index = 0) {
  const title = formatCreationListingVisibleText(draft, draft.title, `Listing ${index + 1}`);
  const skuMeta = formatCreationListingVisibleText(draft, draft.skuTitle || draft.skuSubjectId, "");
  const meta = [
    skuMeta,
    draft.marketplace,
    draft.language,
    draft.evidenceMode,
    draft.status,
  ]
    .map(cleanCreationListingText)
    .filter(Boolean)
    .join(" · ");
  return { title, meta };
}

export function getCreationListingSearchValues(set = {}) {
  return getCreationListingDrafts(set).flatMap((draft) => [
    draft.title,
    draft.description,
    draft.backendSearchTerms,
    draft.evidenceMode,
    draft.status,
    ...(Array.isArray(draft.sellingPoints) ? draft.sellingPoints : []),
    ...(Array.isArray(draft.painPoints) ? draft.painPoints : []),
    ...(Array.isArray(draft.fiveBullets) ? draft.fiveBullets : []),
    ...Object.values(draft.keywordBuckets || {}).flat(),
  ]);
}

function getCreationListingBucketEntries(keywordBuckets = {}) {
  const normalized = normalizeCreationListingKeywordBuckets(keywordBuckets);
  return Object.entries(CREATION_LISTING_BUCKET_LABELS).map(([key, label]) => ({
    key,
    label,
    values: normalized[key] || [],
  }));
}

function formatCreationListingList(value) {
  const items = cleanCreationListingArray(value);
  return items.length > 0 ? items : ["无"];
}

export function buildCreationListingFieldCopyText(value, { list = false } = {}) {
  return list ? formatCreationListingList(value).join("\n") : cleanCreationListingText(value) || "无";
}

export function buildCreationListingFieldRows(value, localizedValue, { list = false } = {}) {
  const rows = list ? formatCreationListingList(value) : [cleanCreationListingText(value) || "无"];
  const localizedRows = list ? cleanCreationListingArray(localizedValue) : [cleanCreationListingText(localizedValue)].filter(Boolean);
  return rows.map((text, index) => ({
    text,
    localizedText: localizedRows[index] || "",
  }));
}

export function countCreationListingTextCharacters(value, { list = false } = {}) {
  const rows = list ? cleanCreationListingArray(value) : [cleanCreationListingText(value)].filter(Boolean);
  return rows.reduce((total, text) => total + Array.from(text).length, 0);
}

function buildCreationListingFieldCharacterCounts(value, localizedValue, { list = false, countValue, localizedCountValue } = {}) {
  const englishValue = countValue ?? value;
  const chineseValue = localizedCountValue ?? localizedValue;
  const englishList = Array.isArray(englishValue) ? true : list;
  const chineseList = Array.isArray(chineseValue) ? true : list;
  return {
    english: countCreationListingTextCharacters(englishValue, { list: englishList }),
    chinese: countCreationListingTextCharacters(chineseValue, { list: chineseList }),
  };
}

export function buildCreationListingBucketCopyLines(keywordBuckets = {}) {
  return getCreationListingBucketEntries(keywordBuckets).flatMap((entry) => {
    const values = cleanCreationListingArray(entry.values)
      .map((value) => cleanEnglishVisibleListingText(value, ""))
      .filter(Boolean);
    return values.length > 0 ? [`${CREATION_LISTING_BUCKET_COPY_LABELS[entry.key]}: ${values.join(", ")}`] : [];
  });
}

function appendLocalizedText(parent, localizedText) {
  if (!localizedText) {
    return;
  }
  const localized = document.createElement("small");
  localized.className = "creation-listing-localized";
  localized.textContent = localizedText;
  parent.appendChild(localized);
}

function applyCreationListingCopyData(target, label, value, { list = false } = {}) {
  target.dataset.creationListingCopyLabel = label;
  target.dataset.creationListingCopyText = buildCreationListingFieldCopyText(value, { list });
}

function createCreationListingCharacterCountsNode(counts) {
  const stats = document.createElement("span");
  stats.className = "creation-listing-character-counts";
  stats.setAttribute("aria-label", `英文字符 ${counts.english}，中文字符 ${counts.chinese}`);

  const english = document.createElement("span");
  english.className = "creation-listing-character-count english";
  english.textContent = `英文字符 ${counts.english}`;
  const chinese = document.createElement("span");
  chinese.className = "creation-listing-character-count chinese";
  chinese.textContent = `中文字符 ${counts.chinese}`;

  stats.append(english, chinese);
  return stats;
}

function createCreationListingField(label, value, { list = false, localizedValue, copyValue, countValue, localizedCountValue } = {}) {
  const field = document.createElement("div");
  field.className = "creation-listing-field";
  const copySource = copyValue ?? value;
  const copyList = Array.isArray(copySource) ? true : list;
  const fieldHead = document.createElement("div");
  fieldHead.className = "creation-listing-field-head";

  const copyButton = document.createElement("button");
  copyButton.className = "creation-listing-field-copy";
  copyButton.type = "button";
  copyButton.textContent = label;
  copyButton.title = `点击复制${label}`;
  copyButton.setAttribute("aria-label", `复制${label}`);
  applyCreationListingCopyData(copyButton, label, copySource, { list: copyList });

  fieldHead.append(
    copyButton,
    createCreationListingCharacterCountsNode(
      buildCreationListingFieldCharacterCounts(value, localizedValue, { list, countValue, localizedCountValue }),
    ),
  );
  field.appendChild(fieldHead);

  if (list) {
    const listNode = document.createElement("ul");
    buildCreationListingFieldRows(value, localizedValue, { list }).forEach((item) => {
      const row = document.createElement("li");
      row.textContent = item.text;
      appendLocalizedText(row, item.localizedText);
      listNode.appendChild(row);
    });
    field.appendChild(listNode);
    return field;
  }

  const [row] = buildCreationListingFieldRows(value, localizedValue, { list });
  const copy = document.createElement("p");
  copy.textContent = row.text;
  appendLocalizedText(copy, row.localizedText);
  field.appendChild(copy);
  return field;
}

async function copyCreationListingFieldButton(copyButton, context = {}) {
  const label = cleanCreationListingText(copyButton?.dataset?.creationListingCopyLabel) || "字段";
  const text = String(copyButton?.dataset?.creationListingCopyText || "").trim();
  if (!text) {
    context.setFeedback?.(`${label}没有可复制内容。`, "error");
    return;
  }

  await context.writeTextToClipboard?.(text, `当前浏览器不支持复制${label}。`);
  context.setFeedback?.(`已复制${label}。`, "success");
  copyButton.dataset.copied = "true";
  copyButton.setAttribute("aria-label", `已复制${label}`);

  const existingTimer = listingFieldCopyTimers.get(copyButton);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  const timer = setTimeout(() => {
    copyButton.dataset.copied = "false";
    copyButton.setAttribute("aria-label", `复制${label}`);
    listingFieldCopyTimers.delete(copyButton);
  }, 1200);
  listingFieldCopyTimers.set(copyButton, timer);
}

export function buildCreationListingDraftText(draft, index = 0) {
  const {
    title,
    sellingPoints,
    painPoints,
    fiveBullets,
    description,
    backendSearchTerms,
    keywordBuckets,
    evidenceMode,
    status,
    warnings,
    missingInfo,
  } = draft || {};
  const bucketLines = getCreationListingBucketEntries(keywordBuckets).map(
    (entry) => `${entry.label}: ${formatCreationListingList(entry.values).join("；")}`,
  );

  return [
    `Listing ${index + 1}`,
    `标题: ${title || "无"}`,
    `证据模式: ${evidenceMode || "无"}`,
    `状态: ${status || "无"}`,
    `卖点: ${formatCreationListingList(sellingPoints).join("；")}`,
    `痛点: ${formatCreationListingList(painPoints).join("；")}`,
    "五点描述:",
    ...formatCreationListingList(fiveBullets).map((item, bulletIndex) => `${bulletIndex + 1}. ${item}`),
    `描述: ${description || "无"}`,
    `后台搜索词: ${backendSearchTerms || "无"}`,
    ...bucketLines,
    `警告: ${formatCreationListingList(warnings).join("；")}`,
    `缺失信息: ${formatCreationListingList(missingInfo).join("；")}`,
  ].join("\n");
}

export function buildCreationRecordListingText(set) {
  const drafts = getCreationListingDrafts(set).map((draft, index) => normalizeCreationListingDraftForView(draft, index));
  if (!set || drafts.length === 0) {
    return "";
  }

  return [
    `套图: ${set.productName || "未命名商品"}`,
    `记录: ${set.setId || "unknown"}`,
    "",
    ...drafts.flatMap((draft, index) => [buildCreationListingDraftText(draft, index), ""]),
  ]
    .map((line) => String(line || "").trimEnd())
    .join("\n")
    .trim();
}

export function renderCreationListingDrafts({ refs, state, set } = {}) {
  if (!refs?.creationRecordListingDrafts) {
    return;
  }

  const panel = refs.creationRecordListingDrafts.closest(".creation-listing-panel");
  const drafts = getCreationListingDrafts(set).map((draft, index) => normalizeCreationListingDraftForView(draft, index));
  const isGenerating = isCreationListingGenerating(state, set?.setId);
  panel?.classList.toggle("hidden", !set);
  refs.creationRecordListingDrafts.replaceChildren();

  if (refs.creationRecordListingStatus) {
    refs.creationRecordListingStatus.textContent = isGenerating
      ? "生成中"
      : drafts.length > 0
        ? `${drafts.length} 条草稿`
        : "未生成";
  }

  if (!set) {
    return;
  }

  if (drafts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "creation-listing-empty";
    empty.textContent = isGenerating ? "正在生成 Listing 草稿..." : "当前套图还没有 Listing 草稿。";
    refs.creationRecordListingDrafts.appendChild(empty);
    return;
  }

  drafts.forEach((draft, index) => {
    const card = document.createElement("article");
    card.className = "creation-listing-card";

    const header = document.createElement("div");
    header.className = "creation-listing-card-head";
    const headerContent = formatCreationListingDraftHeader(draft, index);
    const title = document.createElement("h4");
    const titleCopy = document.createElement("button");
    titleCopy.className = "creation-listing-title-copy";
    titleCopy.type = "button";
    titleCopy.textContent = headerContent.title;
    titleCopy.title = "点击复制标题";
    titleCopy.setAttribute("aria-label", "复制标题");
    applyCreationListingCopyData(titleCopy, "标题", headerContent.title);
    title.appendChild(titleCopy);
    const meta = document.createElement("p");
    meta.textContent = headerContent.meta;
    header.append(title, meta);
    card.appendChild(header);

    const contentFrame = document.createElement("div");
    contentFrame.className = "creation-listing-content-frame";
    contentFrame.appendChild(createCreationListingField("标题", draft.title, { localizedValue: draft.zhDisplay?.title }));
    contentFrame.appendChild(createCreationListingField("卖点", draft.sellingPoints, { list: true, localizedValue: draft.zhDisplay?.sellingPoints }));
    contentFrame.appendChild(createCreationListingField("痛点", draft.painPoints, { list: true, localizedValue: draft.zhDisplay?.painPoints }));
    contentFrame.appendChild(createCreationListingField("五点描述", draft.fiveBullets, { list: true, localizedValue: draft.zhDisplay?.fiveBullets }));
    contentFrame.appendChild(createCreationListingField("描述", draft.description, { localizedValue: draft.zhDisplay?.description }));
    contentFrame.appendChild(createCreationListingField("后台搜索词", draft.backendSearchTerms, { localizedValue: draft.zhDisplay?.backendSearchTerms }));

    const bucketLines = getCreationListingBucketEntries(draft.keywordBuckets).map(
      (entry) => `${entry.label}: ${formatCreationListingList(entry.values).join("、")}`,
    );
    const localizedBucketLines = draft.zhDisplay?.keywordBuckets
      ? getCreationListingBucketEntries(draft.zhDisplay.keywordBuckets).map(
        (entry) => `${entry.label}: ${formatCreationListingList(entry.values).join("、")}`,
      )
      : [];
    const buckets = createCreationListingField("关键词分组", bucketLines, {
      list: true,
      localizedValue: localizedBucketLines,
      copyValue: buildCreationListingBucketCopyLines(draft.keywordBuckets),
      countValue: Object.values(draft.keywordBuckets || {}).flat(),
      localizedCountValue: Object.values(draft.zhDisplay?.keywordBuckets || {}).flat(),
    });
    buckets.classList.add("creation-listing-buckets");
    contentFrame.appendChild(buckets);

    const warningCopy = cleanCreationListingPublicArray(draft.warnings, { language: draft.language });
    const missingInfoCopy = cleanCreationListingPublicArray(draft.missingInfo, { language: draft.language });
    contentFrame.appendChild(createCreationListingField("警告", draft.warnings, {
      list: true,
      copyValue: warningCopy.length > 0 ? warningCopy : ["None"],
    }));
    contentFrame.appendChild(createCreationListingField("缺失信息", draft.missingInfo, {
      list: true,
      copyValue: missingInfoCopy.length > 0 ? missingInfoCopy : ["None"],
    }));
    card.appendChild(contentFrame);

    refs.creationRecordListingDrafts.appendChild(card);
  });
}

export function createCreationListingController(context = {}) {
  const renderViews = () => {
    context.renderRecordView?.();
    context.renderCurrentView?.();
  };
  const getSelectedSet = (setId = "") => {
    const requestedSetId = cleanCreationListingText(setId);
    if (!requestedSetId) {
      return context.getSelectedSet?.() || null;
    }
    return context.state?.creation?.sets?.find((set) => set.setId === requestedSetId)
      || context.normalizeSet?.({ setId: requestedSetId })
      || { setId: requestedSetId };
  };

  async function generate(setId = "") {
    const selectedSet = getSelectedSet(setId);
    if (!selectedSet?.setId) {
      context.setFeedback?.("请先选择一套记录。", "error");
      return null;
    }

    if (isCreationListingGenerating(context.state, selectedSet.setId)) {
      context.setFeedback?.("当前套图 Listing 正在生成。", "busy");
      return selectedSet;
    }

    setCreationListingGenerating(context, selectedSet.setId, true);
    context.setFeedback?.("正在生成 Listing...", "busy");
    renderViews();

    try {
      const response = await context.fetchImpl("/api/creation/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(context.getRequestConfig?.() || {}),
          setId: selectedSet.setId,
          set: selectedSet,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Listing 生成失败。");
      }

      const nextSetPayload = payload.set || {
        ...selectedSet,
        listingDrafts: Array.isArray(payload.listingDrafts) ? payload.listingDrafts : [],
        updatedAt: context.nowIso?.(),
      };
      const nextSet = context.upsertSet?.(nextSetPayload) || nextSetPayload;
      context.state.creation.recordSetId = nextSet?.setId || selectedSet.setId;
      context.setFeedback?.("Listing 已生成。", "success");
      return nextSet;
    } catch (error) {
      const message = context.compactErrorMessage?.(
        error instanceof Error ? error.message : String(error),
        "Listing 生成失败",
      ) || "Listing 生成失败";
      context.setFeedback?.(message, "error");
      throw new Error(message);
    } finally {
      setCreationListingGenerating(context, selectedSet.setId, false);
      renderViews();
    }
  }

  async function copy() {
    const selectedSet = context.getSelectedSet?.();
    const text = buildCreationRecordListingText(selectedSet);
    if (!text) {
      context.setFeedback?.("当前套图还没有可复制的 Listing。", "error");
      return;
    }

    await context.writeTextToClipboard?.(text, "当前浏览器不支持复制 Listing。");
    context.setFeedback?.("已复制当前套图 Listing。", "success");
  }

  function exportListings() {
    const selectedSet = context.getSelectedSet?.();
    const drafts = getCreationListingDrafts(selectedSet);
    if (!selectedSet || drafts.length === 0) {
      context.setFeedback?.("当前套图还没有可导出的 Listing。", "error");
      return;
    }

    const payload = {
      setId: selectedSet.setId,
      productName: selectedSet.productName,
      listingDrafts: drafts,
    };
    context.downloadTextFile?.(
      `${JSON.stringify(payload, null, 2)}\n`,
      `creation-listings-${selectedSet.setId || "record"}.json`,
      "application/json;charset=utf-8",
    );
    context.setFeedback?.("已导出当前套图 Listing。", "success");
  }

  function syncRecordControls(selectedSet) {
    const drafts = getCreationListingDrafts(selectedSet);
    const isGenerating = isCreationListingGenerating(context.state, selectedSet?.setId);
    if (context.refs.creationRecordGenerateListingsButton) {
      renderCreationListingGenerateButton(context.refs.creationRecordGenerateListingsButton, {
        disabled: !selectedSet || isGenerating,
        isGenerating,
      });
    }
    if (context.refs.creationRecordCopyListingsButton) {
      context.refs.creationRecordCopyListingsButton.disabled = drafts.length === 0 || isGenerating;
    }
    if (context.refs.creationRecordExportListingsButton) {
      context.refs.creationRecordExportListingsButton.disabled = drafts.length === 0 || isGenerating;
    }
    renderCreationListingDrafts({ refs: context.refs, state: context.state, set: selectedSet });
  }

  function bindEvents() {
    const listingDraftContainers = new Set([
      context.refs.creationRecordListingDrafts,
      context.refs.creationInlineListingDrafts,
    ].filter(Boolean));

    context.refs.creationRecordGenerateListingsButton?.addEventListener("click", () => {
      generate().catch((error) => context.setFeedback?.(error.message, "error"));
    });
    context.refs.creationRecordCopyListingsButton?.addEventListener("click", () => {
      copy().catch((error) => context.setFeedback?.(error.message, "error"));
    });
    context.refs.creationRecordExportListingsButton?.addEventListener("click", exportListings);
    listingDraftContainers.forEach((container) => {
      container.addEventListener("click", (event) => {
        const copyButton = event.target?.closest?.("[data-creation-listing-copy-text]");
        if (!copyButton || !container.contains(copyButton)) {
          return;
        }
        copyCreationListingFieldButton(copyButton, context).catch((error) => {
          context.setFeedback?.(error.message, "error");
        });
      });
    });
  }

  return {
    bindEvents,
    copy,
    exportListings,
    generate,
    syncRecordControls,
  };
}
