import assert from "node:assert/strict";
import test from "node:test";

import {
  CREATION_LISTING_FIELD_MAX_CHARS,
  buildCreationListingSources,
  dedupeCreationListingKeywords,
  normalizeCreationListingDraft,
  validateCreationListingDraft,
} from "../lib/creation-listing-draft.mjs";

const longText = "a".repeat(CREATION_LISTING_FIELD_MAX_CHARS + 1);
const validBullets = [
  "CORE VALUE: 2 Pack 3.5 in size keeps quantity and dimensions clear.",
  "BUILT TO LAST: Compact profile supports clear product selection.",
  "REAL-LIFE USE: Provided product facts keep the listing grounded.",
  "SIZE & FIT: Search-focused wording supports US marketplace discovery.",
  "PACKAGE SNAPSHOT: Concise copy keeps feature and outcome easy to scan.",
];

test("listing sources combine skuSubjects into one parent listing source", () => {
  const sources = buildCreationListingSources({
    setId: "set-1",
    productName: "Fishing Lure",
    productDescription: "Floating lure for bass fishing.",
    dimensionSpecs: "Length 3.5 in",
    industryTemplatePath: "Sports > Fishing > Lures",
    skuSubjects: [
      { id: "blue", title: "Blue Lure", filenames: ["blue.png"], note: "blue body" },
      { id: "green", title: "Green Lure", filenames: ["green.png"], note: "green body" },
    ],
    items: [
      { itemId: "sku-blue", role: "sku", status: "completed", title: "Blue SKU", relativePath: "a/blue.png", skuSubject: { id: "blue" } },
      { itemId: "sku-green", role: "sku", status: "completed", title: "Green SKU", relativePath: "a/green.png", skuSubject: { id: "green" } },
    ],
  });

  assert.equal(sources.length, 1);
  assert.equal(sources[0].skuSubjectId, "");
  assert.equal(sources[0].skuVariantCount, 2);
  assert.deepEqual(sources[0].skuSubjects.map((sku) => sku.id), ["blue", "green"]);
  assert.equal(sources[0].evidenceMode, "image-backed");
  assert.deepEqual(sources[0].imageItems.map((item) => item.relativePath), ["a/blue.png", "a/green.png"]);
});

test("listing sources fall back to one input-only product package when no SKU and no image exists", () => {
  const sources = buildCreationListingSources({
    setId: "set-main",
    productName: "Travel Bottle",
    sellingPoints: ["Leak resistant"],
    items: [{ itemId: "1-hero", role: "hero", status: "failed", error: "upstream timeout" }],
  });

  assert.equal(sources.length, 1);
  assert.equal(sources[0].skuSubjectId, "");
  assert.equal(sources[0].evidenceMode, "input-only");
  assert.match(sources[0].warnings.join("\n"), /Generated images were unavailable/);
});

test("listing sources bound overlong product descriptions before model prompt assembly", () => {
  const longDescription = Array.from({ length: 160 }, (_, index) =>
    `Feature ${index + 1}: realistic fishing lure detail with ABS body treble hooks reflective scales long cast stable swim action shopper pain point visibility and stiff lure replacement.`,
  ).join("\n");
  const sources = buildCreationListingSources({
    setId: "set-long",
    productName: "Bionic Fishing Lure",
    productDescription: longDescription,
    sellingPoints: [],
    items: [],
  });

  assert.ok(sources[0].productDescription.length < 2000);
  assert.match(sources[0].productDescription, /Feature 1/);
  assert.match(sources[0].productDescription, /truncated from a longer product description/);
  assert.doesNotMatch(sources[0].productDescription, /Feature 160/);
});

test("listing sources collapse duplicate skuSubjects before parent listing generation", () => {
  const sources = buildCreationListingSources({
    setId: "set-duplicates",
    productName: "Fishing Lure",
    skuSubjects: [
      { id: "blue", title: "Blue Lure", filenames: ["blue-front.png"] },
      { id: "blue", title: "Blue Lure Duplicate", filenames: ["blue-side.png"] },
      { title: "Green Lure", filenames: ["green.png"] },
      { title: "  Green   Lure  ", filenames: ["green.png"] },
    ],
    items: [
      { itemId: "sku-blue", role: "sku", status: "completed", relativePath: "a/blue-front.png", skuSubjectId: "blue" },
      { itemId: "sku-green", role: "sku", status: "completed", relativePath: "a/green.png" },
    ],
  });

  assert.equal(sources.length, 1);
  assert.equal(sources[0].skuSubjectId, "");
  assert.equal(sources[0].skuVariantCount, 2);
  assert.deepEqual(sources[0].skuSubjects.map((sku) => sku.title), ["Blue Lure", "Green Lure"]);
});

test("listing sources compact generated items before prompt assembly", () => {
  const sources = buildCreationListingSources({
    setId: "set-compact",
    productName: "Fishing Lure",
    skuSubjects: [{ id: "blue", title: "Blue Lure", filenames: ["blue.png"], note: "blue body" }],
    items: [
      {
        itemId: "hero",
        role: "hero",
        status: "completed",
        title: "Hero image",
        prompt: "Very long image prompt that should not be sent to the listing agent.",
        marketingCopy: "Shows the lure profile clearly.",
        filename: "blue.png",
        relativePath: "sets/blue.png",
        imageUrl: "/output/sets/blue.png",
        thumbnailUrl: "/output/sets/blue-thumb.png",
        error: "old transient upstream error",
        generationStartedAt: "2026-05-25T00:00:00.000Z",
        generationCompletedAt: "2026-05-25T00:01:00.000Z",
        generationDurationMs: 60000,
      },
    ],
  });

  assert.equal(sources[0].imageItems[0].title, "Hero image");
  assert.equal(sources[0].imageItems[0].marketingCopy, "Shows the lure profile clearly.");
  assert.equal(sources[0].imageItems[0].relativePath, "sets/blue.png");
  assert.equal(sources[0].imageItems[0].prompt, undefined);
  assert.equal(sources[0].imageItems[0].imageUrl, undefined);
  assert.equal(sources[0].imageItems[0].thumbnailUrl, undefined);
  assert.equal(sources[0].imageItems[0].error, undefined);
  assert.equal(sources[0].imageItems[0].generationStartedAt, undefined);
  assert.equal(sources[0].plannedItems[0].prompt, undefined);
  assert.equal(JSON.stringify(sources[0]).includes("Very long image prompt"), false);
});

test("listing draft validation rejects fields and bullets over 500 characters", () => {
  const draft = normalizeCreationListingDraft({
    id: "listing-1",
    title: longText,
    sellingPoints: ["Compact"],
    painPoints: ["Hard to store"],
    fiveBullets: ["Useful bullet"],
    description: "Short description",
    backendSearchTerms: "travel bottle",
  });

  const validation = validateCreationListingDraft(draft);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /title exceeds 500 characters/);
});

test("listing draft validation rejects combined selling and pain point fields over 500 English characters", () => {
  const longItem = "clear benefit ".repeat(21).trim();
  const draft = normalizeCreationListingDraft({
    id: "listing-combined-benefits",
    title: "2 Pack Blue Fishing Lures 3.5 in",
    sellingPoints: [longItem, longItem],
    painPoints: [longItem, longItem],
    fiveBullets: validBullets,
    description: "A compact lure for freshwater fishing.",
    backendSearchTerms: "blue fishing lure freshwater bait",
  });

  assert.equal(longItem.length <= CREATION_LISTING_FIELD_MAX_CHARS, true);
  assert.equal(draft.sellingPoints.join("\n").length > CREATION_LISTING_FIELD_MAX_CHARS, true);
  assert.equal(draft.painPoints.join("\n").length > CREATION_LISTING_FIELD_MAX_CHARS, true);

  const validation = validateCreationListingDraft(draft, { expectedQuantity: "2 Pack", expectedSize: "3.5 in" });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /sellingPoints exceeds 500 English characters total/);
  assert.match(validation.errors.join("\n"), /painPoints exceeds 500 English characters total/);
});

test("listing draft validation accepts quantity-first titles with size after the product phrase", () => {
  const draft = normalizeCreationListingDraft({
    id: "listing-size-later",
    title: "2 Pack Blue Fishing Lures for Bass 3.5 in",
    sellingPoints: ["Bright blue profile"],
    painPoints: ["Low visibility in stained water"],
    fiveBullets: validBullets,
    description: "A compact lure for freshwater fishing.",
    backendSearchTerms: "blue fishing lure freshwater bait",
  });

  const validation = validateCreationListingDraft(draft, { expectedQuantity: "2 Pack", expectedSize: "3.5 in" });

  assert.equal(validation.ok, true);
});

test("listing draft validation rejects size immediately after quantity", () => {
  const draft = normalizeCreationListingDraft({
    id: "listing-size-too-early",
    title: "1 Pack 5.12 in Articulated Bionic Fishing Lure with LED Light",
    sellingPoints: ["Lifelike action helps the lure stand out during retrieves."],
    painPoints: ["Dead-looking bait can get ignored during slow freshwater presentations."],
    fiveBullets: validBullets,
    description: "A compact lure for freshwater fishing.",
    backendSearchTerms: "articulated bionic fishing lure freshwater bait",
  });

  const validation = validateCreationListingDraft(draft, { expectedQuantity: "1 Pack", expectedSize: "5.12 in" });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /title must place size after the product keyword/);
});

test("listing draft validation requires quantity first and expected size somewhere when dimensions exist", () => {
  const draft = normalizeCreationListingDraft({
    id: "listing-2",
    title: "Blue Fishing Lure 2 Pack 3.5 in",
    sellingPoints: ["Bright blue profile"],
    painPoints: ["Low visibility in stained water"],
    fiveBullets: validBullets,
    description: "A compact lure for freshwater fishing.",
    backendSearchTerms: "blue fishing lure freshwater bait",
  });

  const validation = validateCreationListingDraft(draft, { expectedQuantity: "2 Pack", expectedSize: "3.5 in" });
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /title must start with quantity/);
  assert.doesNotMatch(validation.errors.join("\n"), /title must place size immediately after quantity/);
});

test("listing draft validation reports missing expected size without requiring a second-position size", () => {
  const draft = normalizeCreationListingDraft({
    id: "listing-missing-size",
    title: "2 Pack Blue Fishing Lures for Bass",
    sellingPoints: ["Bright blue profile"],
    painPoints: ["Low visibility in stained water"],
    fiveBullets: validBullets,
    description: "A compact lure for freshwater fishing.",
    backendSearchTerms: "blue fishing lure freshwater bait",
  });

  const validation = validateCreationListingDraft(draft, { expectedQuantity: "2 Pack", expectedSize: "3.5 in" });
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /title must include all expected size units/);
  assert.doesNotMatch(validation.errors.join("\n"), /title must place size immediately after quantity/);
});

test("listing draft validation requires exactly five bullets", () => {
  const draft = normalizeCreationListingDraft({
    id: "listing-five-bullets",
    title: "2 Pack Blue Fishing Lures 3.5 in",
    sellingPoints: ["Bright blue profile"],
    painPoints: ["Low visibility in stained water"],
    fiveBullets: validBullets.slice(0, 4),
    description: "A compact lure for freshwater fishing.",
    backendSearchTerms: "blue fishing lure freshwater bait",
  });

  const validation = validateCreationListingDraft(draft, { expectedQuantity: "2 Pack", expectedSize: "3.5 in" });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /fiveBullets must include exactly 5 items/);
});

test("listing draft validation requires uppercase lead labels in five bullets", () => {
  const draft = normalizeCreationListingDraft({
    id: "listing-bullet-leads",
    title: "2 Pack Blue Fishing Lures 3.5 in",
    sellingPoints: ["Bright blue profile"],
    painPoints: ["Low visibility in stained water"],
    fiveBullets: [
      "2 Pack 3.5 in size keeps quantity visible.",
      "Blue lure profile supports clear SKU identification.",
      "Compact design works for bass fishing presentations.",
      "Clear product details keep color and pack information easy to compare.",
      "Concise wording keeps searchable product terms natural.",
    ],
    description: "A compact lure for freshwater fishing.",
    backendSearchTerms: "blue fishing lure freshwater bait",
  });

  const validation = validateCreationListingDraft(draft, { expectedQuantity: "2 Pack", expectedSize: "3.5 in" });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /fiveBullets\[0\] must start with a short uppercase lead label/);
});

test("listing draft validation rejects gift and after-sales bullet promises", () => {
  const draft = normalizeCreationListingDraft({
    id: "listing-bullet-gift",
    title: "2 Pack Blue Fishing Lures 3.5 in",
    sellingPoints: ["Bright blue profile"],
    painPoints: ["Low visibility in stained water"],
    fiveBullets: [
      "CORE VALUE: Bright blue profile helps the lure stay visible in freshwater presentations.",
      "BUILT TO LAST: Compact lure construction keeps the bait easy to pack in a tackle box.",
      "REAL-LIFE USE: Designed for bass fishing trips, pond sessions, and weekend freshwater outings.",
      "SIZE & FIT: 2 Pack 3.5 in sizing keeps quantity and dimensions easy to confirm.",
      "PERFECT GIFT: Gift-ready presentation makes it easy to surprise anglers on birthdays.",
    ],
    description: "A compact lure for freshwater fishing.",
    backendSearchTerms: "blue fishing lure freshwater bait",
  });

  const validation = validateCreationListingDraft(draft, { expectedQuantity: "2 Pack", expectedSize: "3.5 in" });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /fiveBullets\[4\] must not use gift or after-sales promises/);
});

test("listing draft validation requires metric and imperial units when both are expected", () => {
  const draft = normalizeCreationListingDraft({
    id: "listing-dual-units",
    title: "2 Pack Blue Fishing Lures 3.5 in",
    sellingPoints: ["Bright blue profile"],
    painPoints: ["Low visibility in stained water"],
    fiveBullets: validBullets,
    description: "A compact lure for freshwater fishing.",
    backendSearchTerms: "blue fishing lure freshwater bait",
  });

  const validation = validateCreationListingDraft(draft, { expectedQuantity: "2 Pack", expectedSize: "3.5 in / 9 cm" });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /title must include all expected size units/);
});

test("listing draft validation accepts metric and imperial units from parenthetical dimensions", () => {
  const draft = normalizeCreationListingDraft({
    id: "listing-dual-units-valid",
    title: "2 Pack Blue Fishing Lures 3.5 in / 9 cm",
    sellingPoints: ["Bright blue profile"],
    painPoints: ["Low visibility in stained water"],
    fiveBullets: validBullets,
    description: "A compact lure for freshwater fishing.",
    backendSearchTerms: "blue fishing lure freshwater bait",
  });

  const validation = validateCreationListingDraft(draft, { expectedQuantity: "2 Pack", expectedSize: "3.5 in / 9 cm" });

  assert.equal(validation.ok, true);
});

test("listing draft validation rejects Chinese in public English fields", () => {
  const draft = normalizeCreationListingDraft({
    id: "listing-cn",
    title: "2 Pack 路亚硬饵 Product Listing Draft 3.5 in",
    sellingPoints: ["Built from product inputs."],
    painPoints: ["Helps shoppers compare product variants."],
    fiveBullets: [
      "2 Pack 3.5 in size keeps quantity visible.",
      "路亚硬饵 draft uses saved SKU information.",
      "Copy stays conservative.",
      "Keyword structure supports US marketplace review.",
      "Each bullet is kept under the configured limit.",
    ],
    description: "路亚硬饵 listing draft for US marketplace review.",
    backendSearchTerms: "路亚硬饵 product listing",
    language: "en-US",
  });

  const validation = validateCreationListingDraft(draft, { expectedQuantity: "2 Pack", expectedSize: "3.5 in" });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /public listing fields must be English only/);
});

test("listing draft validation rejects internal template language in public fields", () => {
  const draft = normalizeCreationListingDraft({
    id: "listing-template-language",
    title: "2 Pack Blue Fishing Lures 3.5 in",
    sellingPoints: ["Provided product attributes are converted into searchable copy."],
    painPoints: ["Sellers often struggle; this draft maps specs into shopper-ready language."],
    fiveBullets: [
      "2 Pack 3.5 in size keeps quantity visible.",
      "Blue lure profile supports clear color selection.",
      "Clear size details help shoppers compare options.",
      "Keyword structure combines exact and long-tail terms.",
      "Five-bullet layout stays within the configured character limit.",
    ],
    description: "Blue fishing lure listing copy for review.",
    backendSearchTerms: "blue fishing lure freshwater bait",
    language: "en-US",
  });

  const validation = validateCreationListingDraft(draft, { expectedQuantity: "2 Pack", expectedSize: "3.5 in" });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /internal template language/);
});

test("listing draft validation rejects shopping-uncertainty pain points", () => {
  const draft = normalizeCreationListingDraft({
    id: "listing-shopping-uncertainty-pain",
    title: "1 Pack Bionic Fish Lure 13 cm (5.12 in)",
    sellingPoints: ["Lifelike swim action helps the lure look active in the water."],
    painPoints: [
      "Not sure which color to choose? The parent listing clearly groups blue/silver, yellow/green, and silver/gold options.",
      "Need size details before buying? The listing states 13 cm (5.12 in), 42 g (1.48 oz), and 2# hook size up front.",
    ],
    fiveBullets: validBullets,
    description: "Bionic fish lure for freshwater tackle boxes.",
    backendSearchTerms: "bionic fishing lure freshwater bait",
    language: "en-US",
  });

  const validation = validateCreationListingDraft(draft, { expectedQuantity: "1 Pack", expectedSize: "13 cm (5.12 in)" });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /painPoints\[0\] must describe a usage-scene problem/);
  assert.match(validation.errors.join("\n"), /painPoints\[1\] must describe a usage-scene problem/);
});

test("listing draft validation rejects keyword-structure template language by itself", () => {
  const draft = normalizeCreationListingDraft({
    id: "listing-template-keyword-structure",
    title: "2 Pack Blue Fishing Lures 3.5 in",
    sellingPoints: ["Bright blue profile helps shoppers compare lure colors."],
    painPoints: ["Similar lure choices can slow selection."],
    fiveBullets: [
      "2 Pack 3.5 in size keeps quantity visible.",
      "Blue lure profile supports clear color selection.",
      "Clear size details help shoppers compare options.",
      "Keyword structure combines exact and long-tail terms.",
      "Five-bullet layout keeps feature and buyer outcome clear.",
    ],
    description: "Blue fishing lure option for shoppers comparing compact tackle.",
    backendSearchTerms: "blue fishing lure freshwater bait",
    language: "en-US",
  });

  const validation = validateCreationListingDraft(draft, { expectedQuantity: "2 Pack", expectedSize: "3.5 in" });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /keyword structure|five-bullet layout/i);
});

test("listing draft preserves Chinese display text without treating it as public copy", () => {
  const draft = normalizeCreationListingDraft({
    id: "listing-zh-display",
    title: "2 Pack Blue Fishing Lures 3.5 in",
    sellingPoints: ["Bright blue profile"],
    painPoints: ["Low visibility in stained water"],
    fiveBullets: validBullets,
    description: "A compact lure for freshwater fishing.",
    backendSearchTerms: "blue fishing lure bass bait",
    zhDisplay: {
      title: "2 件 3.5 英寸蓝色路亚鱼饵",
      sellingPoints: ["亮蓝色外观便于区分颜色变体。"],
      fiveBullets: ["2 件 3.5 英寸规格让数量和尺寸更清晰。"],
    },
    language: "en-US",
  });

  assert.equal(draft.zhDisplay.title, "2 件 3.5 英寸蓝色路亚鱼饵");
  assert.deepEqual(draft.zhDisplay.sellingPoints, ["亮蓝色外观便于区分颜色变体。"]);
  assert.equal(validateCreationListingDraft(draft, { expectedQuantity: "2 Pack", expectedSize: "3.5 in" }).ok, true);
});

test("listing draft preserves Chinese warning and missing info display text", () => {
  const draft = normalizeCreationListingDraft({
    id: "listing-zh-warning-missing",
    title: "2 Pack Blue Fishing Lures 3.5 in",
    sellingPoints: ["Bright blue profile"],
    painPoints: ["Low visibility in stained water"],
    fiveBullets: validBullets,
    description: "A compact lure for freshwater fishing.",
    backendSearchTerms: "blue fishing lure bass bait",
    missingInfo: ["Actual bag dimensions were not provided."],
    warnings: ["Do not add waterproofing claims without source data."],
    zhDisplay: {
      title: "2 件装 3.5 英寸蓝色路亚鱼饵",
      sellingPoints: ["明亮蓝色外观便于区分颜色变体。"],
      painPoints: ["减少在浑水中选择颜色的判断成本。"],
      fiveBullets: ["2 件装 3.5 英寸规格便于确认数量和尺寸。"],
      description: "蓝色路亚鱼饵的中文参考说明。",
      backendSearchTerms: "蓝色 路亚 鱼饵",
      keywordBuckets: {
        exact: ["蓝色路亚鱼饵"],
      },
      missingInfo: ["未提供实际包袋尺寸。"],
      warnings: ["没有来源数据前不要加入防水声明。"],
    },
    language: "en-US",
  });

  assert.deepEqual(draft.zhDisplay.missingInfo, ["未提供实际包袋尺寸。"]);
  assert.deepEqual(draft.zhDisplay.warnings, ["没有来源数据前不要加入防水声明。"]);
  assert.equal(validateCreationListingDraft(draft, { expectedQuantity: "2 Pack", expectedSize: "3.5 in" }).ok, true);
});

test("listing draft validation rejects non-US marketplace signals", () => {
  const draft = normalizeCreationListingDraft({
    id: "listing-non-us",
    title: "2 Pack Fishing Lure for Amazon UK 3.5 in",
    sellingPoints: ["Built for UK marketplace review."],
    painPoints: ["Helps shoppers compare product variants."],
    fiveBullets: validBullets,
    description: "Fishing lure listing draft for Amazon UK marketplace review.",
    backendSearchTerms: "fishing lure uk marketplace",
    language: "en-US",
  });

  const validation = validateCreationListingDraft(draft, { expectedQuantity: "2 Pack", expectedSize: "3.5 in" });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /public listing fields must target Amazon US/);
});

test("listing draft validation rejects unsupported claims in customer-facing copy", () => {
  const draft = normalizeCreationListingDraft({
    id: "listing-claims",
    title: "2 Pack FDA Certified Medical Grade Fishing Lures",
    sellingPoints: ["Guaranteed visibility in every fishing condition"],
    painPoints: ["Warranty-backed alternative to replacing lost bait"],
    fiveBullets: ["Best choice for anglers who want certified lure performance."],
    description: "Medical grade tackle with FDA Certified materials and guaranteed results.",
    backendSearchTerms: "fishing lure freshwater bait",
  });

  const validation = validateCreationListingDraft(draft, { expectedQuantity: "2 Pack" });
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /title contains unsupported claim "FDA Certified"/);
  assert.match(validation.errors.join("\n"), /title contains unsupported claim "medical grade"/);
  assert.match(validation.errors.join("\n"), /sellingPoints\[0\] contains unsupported claim "guaranteed"/);
  assert.match(validation.errors.join("\n"), /painPoints\[0\] contains unsupported claim "warranty"/);
  assert.match(validation.errors.join("\n"), /fiveBullets\[0\] contains unsupported claim "best"/);
});

test("keyword helper deduplicates case-insensitively and removes competitor brands", () => {
  assert.deepEqual(
    dedupeCreationListingKeywords(["Bass Lure", "bass lure", "Amazon", "long tail bait", "AMAZON"]),
    ["Bass Lure", "long tail bait"],
  );
});

test("keyword normalization removes unsupported claims from backend terms and buckets", () => {
  const draft = normalizeCreationListingDraft({
    id: "listing-keywords",
    title: "2 Pack Blue Fishing Lures 3.5 in",
    sellingPoints: ["Bright blue profile"],
    painPoints: ["Low visibility in stained water"],
    fiveBullets: validBullets,
    description: "A compact lure for freshwater fishing.",
    backendSearchTerms: "bass lure; FDA Certified; medical grade bait; long tail bait; warranty",
    keywordBuckets: {
      exact: ["Bass Lure", "best bass lure"],
      longTail: ["FDA Certified fishing lure", "long tail bait"],
      traffic: ["guaranteed catch", "freshwater bait"],
      descriptive: ["medical grade blue lure", "compact blue lure"],
    },
  });

  assert.equal(draft.backendSearchTerms, "bass lure long tail bait");
  assert.deepEqual(draft.keywordBuckets, {
    exact: ["Bass Lure"],
    longTail: ["long tail bait"],
    traffic: ["freshwater bait"],
    descriptive: ["compact blue lure"],
  });
  assert.equal(validateCreationListingDraft(draft, { expectedQuantity: "2 Pack" }).ok, true);
});

test("backend search term normalization removes space-separated competitor brand tokens", () => {
  const draft = normalizeCreationListingDraft({
    id: "listing-backend-competitors",
    title: "2 Pack Blue Fishing Lures 3.5 in",
    sellingPoints: ["Bright blue profile"],
    painPoints: ["Low visibility in stained water"],
    fiveBullets: validBullets,
    description: "A compact lure for freshwater fishing.",
    backendSearchTerms: "bass lure Amazon long tail bait",
  });

  assert.equal(draft.backendSearchTerms, "bass lure long tail bait");
  assert.doesNotMatch(draft.backendSearchTerms, /\bAmazon\b/i);
  assert.equal(validateCreationListingDraft(draft, { expectedQuantity: "2 Pack" }).ok, true);
});
