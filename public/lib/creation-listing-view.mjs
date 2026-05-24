const CREATION_LISTING_BUCKET_LABELS = {
  exact: "精准关键词",
  longTail: "长尾关键词",
  traffic: "流量关键词",
  descriptive: "描述词",
};

export function cleanCreationListingText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
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

function normalizeCreationListingKeywordBuckets(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    exact: cleanCreationListingArray(source.exact || source.precise, { split: true }),
    longTail: cleanCreationListingArray(source.longTail || source.long_tail || source.longtail, { split: true }),
    traffic: cleanCreationListingArray(source.traffic, { split: true }),
    descriptive: cleanCreationListingArray(source.descriptive || source.description || source.descriptors, { split: true }),
  };
}

export function normalizeCreationListingDraftForView(draft = {}, fallbackIndex = 0) {
  const keywordBuckets = normalizeCreationListingKeywordBuckets(draft.keywordBuckets || draft.keyword_buckets);
  return {
    id: cleanCreationListingText(draft.id) || `listing-${fallbackIndex + 1}`,
    marketplace: cleanCreationListingText(draft.marketplace) || "amazon-us",
    language: cleanCreationListingText(draft.language) || "en-US",
    skuSubjectId: cleanCreationListingText(draft.skuSubjectId || draft.sku_subject_id),
    skuTitle: cleanCreationListingText(draft.skuTitle || draft.sku_title),
    evidenceMode: cleanCreationListingText(draft.evidenceMode || draft.evidence_mode) || "input-only",
    status: cleanCreationListingText(draft.status) || "completed",
    title: cleanCreationListingText(draft.title),
    sellingPoints: cleanCreationListingArray(draft.sellingPoints || draft.selling_points),
    painPoints: cleanCreationListingArray(draft.painPoints || draft.pain_points),
    fiveBullets: cleanCreationListingArray(draft.fiveBullets || draft.five_bullets),
    description: cleanCreationListingText(draft.description),
    backendSearchTerms: cleanCreationListingText(draft.backendSearchTerms || draft.backend_search_terms),
    keywordBuckets,
    evidence: cleanCreationListingArray(draft.evidence),
    missingInfo: cleanCreationListingArray(draft.missingInfo || draft.missing_info),
    warnings: cleanCreationListingArray(draft.warnings),
    createdAt: cleanCreationListingText(draft.createdAt || draft.created_at),
    updatedAt: cleanCreationListingText(draft.updatedAt || draft.updated_at),
  };
}

export function getCreationListingDrafts(set) {
  return Array.isArray(set?.listingDrafts) ? set.listingDrafts : [];
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

function createCreationListingField(label, value, { list = false } = {}) {
  const field = document.createElement("div");
  field.className = "creation-listing-field";

  const title = document.createElement("strong");
  title.textContent = label;
  field.appendChild(title);

  if (list) {
    const listNode = document.createElement("ul");
    formatCreationListingList(value).forEach((item) => {
      const row = document.createElement("li");
      row.textContent = item;
      listNode.appendChild(row);
    });
    field.appendChild(listNode);
    return field;
  }

  const copy = document.createElement("p");
  copy.textContent = cleanCreationListingText(value) || "无";
  field.appendChild(copy);
  return field;
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
  const drafts = getCreationListingDrafts(set);
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
  const drafts = getCreationListingDrafts(set);
  const isGenerating = Boolean(set?.setId && state?.creation?.listingGeneratingSetId === set.setId);
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
    const title = document.createElement("h4");
    title.textContent = draft.title || `Listing ${index + 1}`;
    const meta = document.createElement("p");
    meta.textContent = [draft.skuTitle || draft.skuSubjectId, draft.marketplace, draft.language, draft.evidenceMode, draft.status]
      .filter(Boolean)
      .join(" · ");
    header.append(title, meta);
    card.appendChild(header);

    card.appendChild(createCreationListingField("卖点", draft.sellingPoints, { list: true }));
    card.appendChild(createCreationListingField("痛点", draft.painPoints, { list: true }));
    card.appendChild(createCreationListingField("五点描述", draft.fiveBullets, { list: true }));
    card.appendChild(createCreationListingField("描述", draft.description));
    card.appendChild(createCreationListingField("后台搜索词", draft.backendSearchTerms));

    const buckets = document.createElement("div");
    buckets.className = "creation-listing-field creation-listing-buckets";
    const bucketTitle = document.createElement("strong");
    bucketTitle.textContent = "关键词分组";
    buckets.appendChild(bucketTitle);
    getCreationListingBucketEntries(draft.keywordBuckets).forEach((entry) => {
      const row = document.createElement("p");
      row.textContent = `${entry.label}: ${formatCreationListingList(entry.values).join("、")}`;
      buckets.appendChild(row);
    });
    card.appendChild(buckets);

    card.appendChild(createCreationListingField("警告", draft.warnings, { list: true }));
    card.appendChild(createCreationListingField("缺失信息", draft.missingInfo, { list: true }));

    refs.creationRecordListingDrafts.appendChild(card);
  });
}

export function createCreationListingController(context = {}) {
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

    context.state.creation.listingGeneratingSetId = selectedSet.setId;
    context.setFeedback?.("正在生成 Listing...", "busy");
    context.renderRecordView?.();

    try {
      const response = await context.fetchImpl("/api/creation/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId: selectedSet.setId }),
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
      context.state.creation.listingGeneratingSetId = "";
      context.renderRecordView?.();
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
    const isGenerating = Boolean(selectedSet?.setId && context.state?.creation?.listingGeneratingSetId === selectedSet.setId);
    if (context.refs.creationRecordGenerateListingsButton) {
      context.refs.creationRecordGenerateListingsButton.disabled = !selectedSet || Boolean(context.state.creation.listingGeneratingSetId);
      context.refs.creationRecordGenerateListingsButton.textContent = isGenerating ? "生成中..." : "生成 Listing";
    }
    if (context.refs.creationRecordCopyListingsButton) {
      context.refs.creationRecordCopyListingsButton.disabled = drafts.length === 0 || Boolean(context.state.creation.listingGeneratingSetId);
    }
    if (context.refs.creationRecordExportListingsButton) {
      context.refs.creationRecordExportListingsButton.disabled = drafts.length === 0 || Boolean(context.state.creation.listingGeneratingSetId);
    }
    renderCreationListingDrafts({ refs: context.refs, state: context.state, set: selectedSet });
  }

  function bindEvents() {
    context.refs.creationRecordGenerateListingsButton?.addEventListener("click", () => {
      generate().catch((error) => context.setFeedback?.(error.message, "error"));
    });
    context.refs.creationRecordCopyListingsButton?.addEventListener("click", () => {
      copy().catch((error) => context.setFeedback?.(error.message, "error"));
    });
    context.refs.creationRecordExportListingsButton?.addEventListener("click", exportListings);
  }

  return {
    bindEvents,
    copy,
    exportListings,
    generate,
    syncRecordControls,
  };
}
