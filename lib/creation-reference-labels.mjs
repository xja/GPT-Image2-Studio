function cleanString(value) {
  return String(value || "").trim();
}

function normalizeImages(referenceImages = []) {
  if (!Array.isArray(referenceImages)) {
    return referenceImages ? [referenceImages] : [];
  }
  return referenceImages.filter(Boolean);
}

function getReferenceImageName(image = {}, index = 0) {
  return cleanString(image.filename || image.name || `reference-image-${index + 1}`);
}

function normalizeReferenceName(value) {
  return cleanString(value).toLowerCase();
}

function getSkuSubjectReferenceNames(item = {}) {
  const subject = item?.skuSubject || item?.sku_subject || {};
  return [
    ...(Array.isArray(subject.filenames) ? subject.filenames : []),
    ...(Array.isArray(subject.referenceFilenames) ? subject.referenceFilenames : []),
    ...(Array.isArray(subject.reference_filenames) ? subject.reference_filenames : []),
    subject.filename,
    subject.name,
  ]
    .map(normalizeReferenceName)
    .filter(Boolean);
}

function getSkuSubjectReferenceIndexes(item = {}) {
  const subject = item?.skuSubject || item?.sku_subject || {};
  const values = [
    ...(Array.isArray(subject.referenceIndexes) ? subject.referenceIndexes : []),
    ...(Array.isArray(subject.reference_indexes) ? subject.reference_indexes : []),
    subject.referenceIndex,
    subject.reference_index,
    subject.index,
  ];
  return values
    .map((value) => Number.parseInt(cleanString(value), 10))
    .filter((value) => Number.isFinite(value) && value > 0);
}

const SINGLE_PRODUCT_REFERENCE_ITEM_ROLES = new Set([
  "hero",
  "benefit",
  "scene",
  "detail-trust",
  "social-proof",
  "promotion",
  "material-closeup",
  "usage-steps",
  "dimensions",
  "review-qa",
]);

const ITEM_SUPPORTING_REFERENCE_ROLES = {
  hero: ["style"],
  benefit: ["material", "style"],
  scene: ["scene", "style"],
  "detail-trust": ["material", "package"],
  comparison: ["product", "material", "package"],
  "social-proof": ["scene", "style"],
  package: ["product", "package"],
  promotion: ["style", "package"],
  "material-closeup": ["material"],
  "usage-steps": ["scene", "material"],
  dimensions: ["material"],
  "review-qa": ["material", "package"],
};

function getReferenceRoleForImage(referenceImageRoles = [], index = 0, filename = "") {
  const roles = Array.isArray(referenceImageRoles) ? referenceImageRoles : [];
  const normalizedFilename = cleanString(filename).toLowerCase();
  return (
    roles.find((entry) => cleanString(entry?.filename || entry?.name).toLowerCase() === normalizedFilename) ||
    roles[index] ||
    null
  );
}

function buildRoleText(role = null) {
  if (!role) {
    return "";
  }

  const label = cleanString(role.rolePromptLabel || role.promptLabel || role.roleLabel || role.role);
  const instruction = cleanString(role.promptInstruction || role.instruction);
  const note = cleanString(role.note || role.analysisNote || role.description);
  const parts = [];

  if (label || instruction) {
    parts.push(`Role: ${label || "supporting reference"}.${instruction ? ` ${instruction}` : ""}`);
  }
  if (note) {
    parts.push(`Note: ${note}.`);
  }

  return parts.join(" ");
}

function getReferenceRoleValue(referenceImageRoles = [], image = {}, index = 0) {
  return cleanString(getReferenceRoleForImage(referenceImageRoles, index, getReferenceImageName(image, index))?.role);
}

function pushUniqueImage(target, seen, image) {
  const key = normalizeReferenceName(getReferenceImageName(image, target.length));
  if (!key || seen.has(key)) {
    return;
  }
  seen.add(key);
  target.push(image);
}

function getPrimaryProductReferenceImage(images = [], referenceImageRoles = []) {
  return (
    images.find((image, index) => getReferenceRoleValue(referenceImageRoles, image, index) === "product") ||
    images[0] ||
    null
  );
}

function filterImagesByReferenceRoles(images = [], referenceImageRoles = [], allowedRoles = []) {
  const allowed = new Set(allowedRoles.map(cleanString).filter(Boolean));
  if (allowed.size === 0) {
    return [];
  }
  return images.filter((image, index) => allowed.has(getReferenceRoleValue(referenceImageRoles, image, index)));
}

export function buildCreationItemReferenceImages(item = {}, referenceImages = [], referenceImageRoles = []) {
  const images = normalizeImages(referenceImages);
  if (cleanString(item?.role) !== "sku") {
    const role = cleanString(item?.role);
    const roleFilters = ITEM_SUPPORTING_REFERENCE_ROLES[role];
    if (!Array.isArray(referenceImageRoles) || referenceImageRoles.length === 0 || !roleFilters) {
      return images;
    }
    if (SINGLE_PRODUCT_REFERENCE_ITEM_ROLES.has(role)) {
      const selected = [];
      const seen = new Set();
      const primaryProductImage = getPrimaryProductReferenceImage(images, referenceImageRoles);
      if (primaryProductImage) {
        pushUniqueImage(selected, seen, primaryProductImage);
      }
      filterImagesByReferenceRoles(images, referenceImageRoles, roleFilters).forEach((image) =>
        pushUniqueImage(selected, seen, image),
      );
      return selected.length > 0 ? selected : images;
    }

    const selected = filterImagesByReferenceRoles(images, referenceImageRoles, roleFilters);
    return selected.length > 0 ? selected : images;
  }

  const subjectNames = new Set(getSkuSubjectReferenceNames(item));
  const subjectIndexes = new Set(getSkuSubjectReferenceIndexes(item));
  if (subjectNames.size === 0 && subjectIndexes.size === 0) {
    return [];
  }

  return images.filter((image, index) => {
    const name = normalizeReferenceName(getReferenceImageName(image, index));
    return subjectNames.has(name) || subjectIndexes.has(index + 1);
  });
}

export function buildCreationReferenceImageLabels(referenceImages = [], referenceImageRoles = []) {
  const images = normalizeImages(referenceImages);
  if (images.length === 0) {
    return [];
  }

  const names = images.map((image, index) => getReferenceImageName(image, index));
  const uploadedFileList = names.map((name, index) => `${index + 1}. ${name}`).join("; ");

  return names.map((name, index) => {
    const roleText = buildRoleText(getReferenceRoleForImage(referenceImageRoles, index, name));
    return [
      `Creation reference image ${index + 1} of ${names.length}: ${name}.`,
      `Uploaded reference count: ${names.length}.`,
      `Uploaded reference files: ${uploadedFileList}.`,
      roleText,
      "Use the attached references by this numbered order; do not assume missing reference images.",
    ]
      .filter(Boolean)
      .join(" ");
  });
}
