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

test("listing sources follow skuSubjects and use image-backed evidence when images exist", () => {
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

  assert.equal(sources.length, 2);
  assert.equal(sources[0].skuSubjectId, "blue");
  assert.equal(sources[0].evidenceMode, "image-backed");
  assert.deepEqual(sources[0].imageItems.map((item) => item.relativePath), ["a/blue.png"]);
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

test("listing sources collapse duplicate skuSubjects by id and fallback identity", () => {
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

  assert.equal(sources.length, 2);
  assert.deepEqual(sources.map((source) => source.skuSubjectId), ["blue", ""]);
  assert.deepEqual(sources.map((source) => source.skuTitle), ["Blue Lure", "Green Lure"]);
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

test("listing draft validation requires quantity first and size second when dimensions exist", () => {
  const draft = normalizeCreationListingDraft({
    id: "listing-2",
    title: "Blue Fishing Lure 2 Pack 3.5 in",
    sellingPoints: ["Bright blue profile"],
    painPoints: ["Low visibility in stained water"],
    fiveBullets: ["Designed for visible lure presentation."],
    description: "A compact lure for freshwater fishing.",
    backendSearchTerms: "blue fishing lure freshwater bait",
  });

  const validation = validateCreationListingDraft(draft, { expectedQuantity: "2 Pack", expectedSize: "3.5 in" });
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /title must start with quantity/);
  assert.match(validation.errors.join("\n"), /title must place size immediately after quantity/);
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
    title: "2 Pack 3.5 in Blue Fishing Lures",
    sellingPoints: ["Bright blue profile"],
    painPoints: ["Low visibility in stained water"],
    fiveBullets: ["Designed for visible lure presentation."],
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
