import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCreationListingBucketCopyLines,
  buildCreationRecordListingText,
  buildCreationListingFieldCopyText,
  buildCreationListingFieldRows,
  normalizeCreationListingDraftForView,
  renderCreationListingDrafts,
} from "../lib/creation-listing-view.mjs";

function makeFakeElement(tagName) {
  const element = {
    tagName,
    children: [],
    dataset: {},
    attributes: {},
    className: "",
    textContent: "",
    type: "",
    title: "",
    parentNode: null,
    classList: {
      add(...names) {
        const current = new Set(String(element.className || "").split(/\s+/).filter(Boolean));
        names.forEach((name) => current.add(name));
        element.className = [...current].join(" ");
      },
      toggle(name, force) {
        const current = new Set(String(element.className || "").split(/\s+/).filter(Boolean));
        const shouldAdd = force ?? !current.has(name);
        if (shouldAdd) {
          current.add(name);
        } else {
          current.delete(name);
        }
        element.className = [...current].join(" ");
      },
    },
    appendChild(child) {
      child.parentNode = element;
      element.children.push(child);
      return child;
    },
    append(...children) {
      children.forEach((child) => element.appendChild(child));
    },
    replaceChildren(...children) {
      element.children = [];
      element.append(...children);
    },
    setAttribute(name, value) {
      element.attributes[name] = String(value);
    },
    closest() {
      return null;
    },
    querySelectorAll(selector) {
      const matches = [];
      const visit = (node) => {
        if (selector === "[data-creation-listing-copy-text]" && node.dataset?.creationListingCopyText !== undefined) {
          matches.push(node);
        }
        node.children?.forEach(visit);
      };
      visit(element);
      return matches;
    },
  };
  return element;
}

function collectFakeElements(root, predicate) {
  const matches = [];
  const visit = (node) => {
    if (predicate(node)) {
      matches.push(node);
    }
    node.children?.forEach(visit);
  };
  visit(root);
  return matches;
}

function getFakeTextContent(node) {
  return [
    node.textContent || "",
    ...(node.children || []).map((child) => getFakeTextContent(child)),
  ].join("");
}

test("listing field copy text returns only the selected section content", () => {
  assert.equal(buildCreationListingFieldCopyText("  Product title  "), "Product title");
  assert.equal(buildCreationListingFieldCopyText(["First point", "Second point"], { list: true }), "First point\nSecond point");
  assert.equal(buildCreationListingFieldCopyText("", { list: true }), "无");
});

test("listing field rows keep Chinese display text separate from copy text", () => {
  assert.deepEqual(
    buildCreationListingFieldRows(["English point"], ["中文对照"], { list: true }),
    [{ text: "English point", localizedText: "中文对照" }],
  );
  assert.equal(buildCreationListingFieldCopyText(["English point"], { list: true }), "English point");
});

test("keyword bucket copy lines use English labels and skip empty buckets", () => {
  const lines = buildCreationListingBucketCopyLines({
    exact: ["路亚硬饵"],
    longTail: ["fishing lure"],
    traffic: ["product listing"],
    descriptive: ["sku specific"],
  });

  assert.deepEqual(lines, [
    "Long-tail keywords: fishing lure",
    "Traffic keywords: product listing",
    "Descriptive keywords: sku specific",
  ]);
  assert.doesNotMatch(lines.join("\n"), /[\u3400-\u9fff]|精准|长尾|流量|描述|无/u);
});

test("listing draft view preserves UI-only Chinese display fields", () => {
  const draft = normalizeCreationListingDraftForView({
    title: "1 Pack Fishing Lure",
    zhDisplay: {
      title: "1 件路亚鱼饵",
      sellingPoints: ["中文卖点"],
      fiveBullets: ["中文五点"],
    },
  });

  assert.equal(draft.zhDisplay.title, "1 件路亚鱼饵");
  assert.deepEqual(draft.zhDisplay.sellingPoints, ["中文卖点"]);
  assert.deepEqual(draft.zhDisplay.fiveBullets, ["中文五点"]);
});

test("listing draft view preserves Chinese warning and missing info display fields", () => {
  const draft = normalizeCreationListingDraftForView({
    language: "en-US",
    title: "1 Pack First Aid Kit",
    warnings: ["Do not add waterproofing claims without source data."],
    missingInfo: ["Actual bag dimensions were not provided."],
    zhDisplay: {
      title: "1 件装急救包",
      warnings: ["没有来源数据前不要加入防水声明。"],
      missingInfo: ["未提供实际包袋尺寸。"],
    },
  });

  assert.deepEqual(draft.zhDisplay.warnings, ["没有来源数据前不要加入防水声明。"]);
  assert.deepEqual(draft.zhDisplay.missingInfo, ["未提供实际包袋尺寸。"]);
});

test("English listing view strips legacy Chinese from public copy fields", () => {
  const draft = normalizeCreationListingDraftForView({
    language: "en-US",
    title: "1 Pack 13cm 路亚硬饵 Product Listing Draft",
    sellingPoints: ["路亚硬饵 listing draft for US marketplace review."],
    painPoints: ["Helps shoppers compare product variants."],
    fiveBullets: [
      "1 Pack 13cm format keeps quantity visible.",
      "Includes 3 selectable SKU variants: 银蓝鳞纹橙红尾电动仿生鱼饵, 黄绿黑斑电动仿生鱼饵.",
      "Copy stays conservative.",
      "Keyword structure supports US marketplace review.",
      "Each bullet stays concise.",
    ],
    description: "路亚硬饵 listing draft for US marketplace review.",
    backendSearchTerms: "路亚硬饵 product listing",
    keywordBuckets: {
      exact: ["路亚硬饵"],
      longTail: ["路亚硬饵 product listing"],
      traffic: ["product listing"],
      descriptive: ["sku specific"],
    },
    zhDisplay: {
      title: "路亚硬饵",
    },
  });

  const publicText = [
    draft.title,
    ...draft.sellingPoints,
    ...draft.painPoints,
    ...draft.fiveBullets,
    draft.description,
    draft.backendSearchTerms,
    ...Object.values(draft.keywordBuckets).flat(),
  ].join("\n");

  assert.doesNotMatch(publicText, /[\u3400-\u9fff]/u);
  assert.doesNotMatch(draft.fiveBullets.join("\n"), /:\s*[,，]/u);
  assert.equal(buildCreationListingFieldCopyText(draft.title), "1 Pack 13cm Product Listing Draft");
  assert.equal(draft.zhDisplay.title, "路亚硬饵");
  assert.doesNotMatch(buildCreationRecordListingText({ listingDrafts: [draft] }), /路亚|银蓝|黄绿|硬饵/u);
});

test("rendered listing header title is a direct copy target", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  globalThis.document = {
    createElement: makeFakeElement,
  };

  try {
    renderCreationListingDrafts({
      refs: { creationRecordListingDrafts: root },
      state: {},
      set: {
        setId: "set-listing-title-copy",
        listingDrafts: [{
          language: "en-US",
          title: "1 Pack Travel Bottle",
        }],
      },
    });
  } finally {
    globalThis.document = previousDocument;
  }

  const titleCopyTargets = collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-title-copy")
  ));

  assert.equal(titleCopyTargets.length, 1);
  assert.equal(titleCopyTargets[0].tagName, "button");
  assert.equal(titleCopyTargets[0].type, "button");
  assert.equal(titleCopyTargets[0].textContent, "1 Pack Travel Bottle");
  assert.equal(titleCopyTargets[0].dataset.creationListingCopyText, "1 Pack Travel Bottle");
});

test("rendered listing panel recognizes concurrent generating set ids", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  const status = makeFakeElement("span");
  globalThis.document = {
    createElement: makeFakeElement,
  };

  try {
    renderCreationListingDrafts({
      refs: {
        creationRecordListingDrafts: root,
        creationRecordListingStatus: status,
      },
      state: {
        creation: {
          listingGeneratingSetId: "set-a",
          listingGeneratingSetIds: ["set-a", "set-b"],
        },
      },
      set: {
        setId: "set-b",
        listingDrafts: [],
      },
    });
  } finally {
    globalThis.document = previousDocument;
  }

  assert.equal(status.textContent, "生成中");
  assert.equal(root.children[0].textContent, "正在生成 Listing 草稿...");
});

test("rendered listing fields show separate English and Chinese character counts", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  globalThis.document = {
    createElement: makeFakeElement,
  };

  try {
    renderCreationListingDrafts({
      refs: { creationRecordListingDrafts: root },
      state: {},
      set: {
        setId: "set-listing-counts",
        listingDrafts: [{
          language: "en-US",
          title: "Mini Rod",
          sellingPoints: ["Casts far"],
          zhDisplay: {
            title: "迷你鱼竿",
            sellingPoints: ["抛投更远"],
          },
        }],
      },
    });
  } finally {
    globalThis.document = previousDocument;
  }

  const countNodes = collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-character-counts")
  ));
  const countTexts = countNodes.map((node) => getFakeTextContent(node));

  assert.ok(countTexts.includes("英文字符 8中文字符 4"));
  assert.ok(countTexts.includes("英文字符 9中文字符 4"));
  assert.ok(countNodes.some((node) => node.children?.[0]?.className === "creation-listing-character-count english"));
  assert.ok(countNodes.some((node) => node.children?.[1]?.className === "creation-listing-character-count chinese"));

  const [bucketField] = collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-buckets")
  ));
  const [bucketCounts] = collectFakeElements(bucketField, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-character-counts")
  ));

  assert.equal(getFakeTextContent(bucketCounts), "英文字符 0中文字符 0");
});

test("rendered listing warning and missing info fields show Chinese references", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  globalThis.document = {
    createElement: makeFakeElement,
  };

  try {
    renderCreationListingDrafts({
      refs: { creationRecordListingDrafts: root },
      state: {},
      set: {
        setId: "set-listing-warning-zh",
        listingDrafts: [{
          language: "en-US",
          title: "1 Pack First Aid Kit",
          warnings: ["Do not add waterproofing claims without source data."],
          missingInfo: ["Actual bag dimensions were not provided."],
          zhDisplay: {
            warnings: ["没有来源数据前不要加入防水声明。"],
            missingInfo: ["未提供实际包袋尺寸。"],
          },
        }],
      },
    });
  } finally {
    globalThis.document = previousDocument;
  }

  const fields = collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-field")
  ));
  const warningField = fields.find((field) => field.children?.[0]?.children?.[0]?.textContent === "警告");
  const missingInfoField = fields.find((field) => field.children?.[0]?.children?.[0]?.textContent === "缺失信息");

  assert.match(getFakeTextContent(warningField), /没有来源数据前不要加入防水声明。/u);
  assert.match(getFakeTextContent(missingInfoField), /未提供实际包袋尺寸。/u);
  assert.doesNotMatch(
    root.querySelectorAll("[data-creation-listing-copy-text]").map((button) => button.dataset.creationListingCopyText).join("\n"),
    /没有来源数据|未提供实际包袋/u,
  );
});

test("rendered listing warning and missing info fields use Chinese review fallback for older drafts", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  globalThis.document = {
    createElement: makeFakeElement,
  };

  try {
    renderCreationListingDrafts({
      refs: { creationRecordListingDrafts: root },
      state: {},
      set: {
        setId: "set-listing-warning-fallback",
        listingDrafts: [{
          language: "en-US",
          title: "1 Pack First Aid Kit",
          warnings: ["Do not add waterproofing claims without source data."],
          missingInfo: ["Actual bag dimensions were not provided."],
        }],
      },
    });
  } finally {
    globalThis.document = previousDocument;
  }

  const fields = collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-field")
  ));
  const warningField = fields.find((field) => field.children?.[0]?.children?.[0]?.textContent === "警告");
  const missingInfoField = fields.find((field) => field.children?.[0]?.children?.[0]?.textContent === "缺失信息");

  assert.match(getFakeTextContent(warningField), /发布前请按该警告复核来源证据/u);
  assert.match(getFakeTextContent(missingInfoField), /源数据未提供该信息/u);
  assert.match(getFakeTextContent(warningField), /中文字符\s*[1-9]\d*/u);
  assert.match(getFakeTextContent(missingInfoField), /中文字符\s*[1-9]\d*/u);
});

test("rendered listing field copy data excludes zhDisplay and Chinese labels", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  globalThis.document = {
    createElement: makeFakeElement,
  };

  try {
    renderCreationListingDrafts({
      refs: { creationRecordListingDrafts: root },
      state: {},
      set: {
        setId: "set-listing-copy",
        listingDrafts: [{
          language: "en-US",
          title: "1 Pack 13cm 路亚硬饵 Product Listing Draft",
          sellingPoints: ["路亚硬饵 listing draft for US marketplace review."],
          painPoints: ["Helps shoppers compare product variants."],
          fiveBullets: [
            "1 Pack 13cm format keeps quantity visible.",
            "Includes 3 selectable SKU variants: 银蓝鳞纹橙红尾电动仿生鱼饵, 黄绿黑斑电动仿生鱼饵.",
            "Copy stays conservative.",
            "Keyword structure supports US marketplace review.",
            "Each bullet stays concise.",
          ],
          description: "路亚硬饵 listing draft for US marketplace review.",
          backendSearchTerms: "路亚硬饵 product listing",
          keywordBuckets: {
            exact: ["路亚硬饵"],
            longTail: ["fishing lure"],
            traffic: ["product listing"],
            descriptive: ["sku specific"],
          },
          zhDisplay: {
            title: "路亚硬饵",
            sellingPoints: ["中文卖点对照"],
            keywordBuckets: {
              exact: ["中文精准词"],
            },
          },
        }],
      },
    });
  } finally {
    globalThis.document = previousDocument;
  }

  const copyButtons = root.querySelectorAll("[data-creation-listing-copy-text]");
  const copyByLabel = Object.fromEntries(copyButtons.map((button) => [
    button.dataset.creationListingCopyLabel,
    button.dataset.creationListingCopyText,
  ]));

  assert.equal(copyByLabel["标题"], "1 Pack 13cm Product Listing Draft");
  assert.equal(
    copyByLabel["关键词分组"],
    "Long-tail keywords: fishing lure\nTraffic keywords: product listing\nDescriptive keywords: sku specific",
  );
  assert.doesNotMatch(Object.values(copyByLabel).join("\n"), /[\u3400-\u9fff]|精准|长尾|流量|描述|无/u);
  assert.doesNotMatch(Object.values(copyByLabel).join("\n"), /中文卖点对照|中文精准词|路亚|银蓝|黄绿|硬饵/u);
});
