import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const serverPath = new URL("../server.mjs", import.meta.url);
const galleryStorePath = new URL("../lib/gallery-store.mjs", import.meta.url);
const creationStorePath = new URL("../lib/creation-store.mjs", import.meta.url);
const cloudflareWorkerPath = new URL("../cloudflare-pages-worker.mjs", import.meta.url);

test("server exposes independent creation generation and record endpoints", async () => {
  const server = await readFile(serverPath, "utf8");

  assert.match(server, /createCreationSetStore/);
  assert.match(server, /async function handleCreationGenerate/);
  assert.match(server, /async function handleCreationLogoBatchGenerate/);
  assert.match(server, /async function handleCreationSetsGet/);
  assert.match(server, /url\.pathname === "\/api\/creation\/generate"/);
  assert.match(server, /url\.pathname === "\/api\/creation\/logo-batch"/);
  assert.match(server, /url\.pathname === "\/api\/creation\/sets"/);
  assert.doesNotMatch(server, /mode=creation/);
});

test("creation record list responses are not cacheable", async () => {
  const server = await readFile(serverPath, "utf8");

  assert.match(server, /async function handleCreationSetsGet\(response\) \{/);
  assert.match(server, /function sendJson\(response, statusCode, payload, headers = \{\}\) \{/);
  assert.match(server, /sendJson\(response, 200, await creationSetStore\.listManifests\(\), \{\s*"Cache-Control": "no-store"/);
});

test("server saves creation assets into a dated creation folder and hides them from gallery", async () => {
  const server = await readFile(serverPath, "utf8");
  const galleryStore = await readFile(galleryStorePath, "utf8");
  const creationStore = await readFile(creationStorePath, "utf8");

  assert.match(server, /buildCreationRelativeDir/);
  assert.match(creationStore, /\$\{dateFolder\}-creation/);
  assert.match(server, /relativeDir:\s*creationRelativeDir/);
  assert.match(server, /assetKind:\s*"creation-image"/);
  assert.match(server, /galleryVisible:\s*false/);
  assert.match(galleryStore, /creationSetId/);
  assert.match(galleryStore, /creationItemId/);
  assert.match(galleryStore, /targetLanguage/);
});

test("daily output opener prepares separated mode folders", async () => {
  const server = await readFile(serverPath, "utf8");

  assert.match(server, /`\$\{todayDateFolder\}-prompt`/);
  assert.match(server, /`\$\{todayDateFolder\}-style-transfer`/);
  assert.match(server, /`\$\{todayDateFolder\}-reference-analysis`/);
  assert.match(server, /`\$\{todayDateFolder\}-image-decomposition`/);
  assert.match(server, /`\$\{todayDateFolder\}-ppt`/);
  assert.match(server, /`\$\{todayDateFolder\}-creation`/);
  assert.match(server, /`\$\{todayDateFolder\}-article`/);
});

test("server opens a selected creation set folder by manifest id", async () => {
  const server = await readFile(serverPath, "utf8");

  assert.match(server, /async function handleCreationSetFolderOpen/);
  assert.match(server, /url\.pathname === "\/api\/creation\/sets\/open-folder"/);
  assert.match(server, /creationSetStore\.readManifest\(setId\)/);
  assert.match(server, /set\.relativeDir/);
  assert.match(server, /resolveSafeOutputSubdirectory\(set\.relativeDir\)/);
  assert.match(server, /openDirectory\(targetDir\)/);
});

test("server returns safe full image paths for a selected creation set", async () => {
  const server = await readFile(serverPath, "utf8");

  assert.match(server, /function resolveSafeOutputPath\(relativePathValue\) \{/);
  assert.match(server, /async function handleCreationSetPathsGet/);
  assert.match(server, /url\.pathname === "\/api\/creation\/sets\/paths"/);
  assert.match(server, /creationSetStore\.readManifest\(setId\)/);
  assert.match(server, /resolveSafeOutputPath\(item\.relativePath\)/);
  assert.match(server, /absolutePath/);
  assert.match(server, /relativePath/);
});

test("local server has an isolated mock image path for creation regression tests", async () => {
  const server = await readFile(serverPath, "utf8");

  assert.match(server, /process\.env\.IMAGE_STUDIO_OUTPUT_DIR/);
  assert.match(server, /process\.env\.IMAGE_STUDIO_LOCAL_DATA_DIR/);
  assert.match(server, /process\.env\.IMAGE_STUDIO_MOCK_IMAGE_GENERATION === "1"/);
  assert.match(server, /async function requestStudioImageGeneration/);
  assert.match(server, /type:\s*"final_image"/);
  assert.match(server, /finalImageBase64:\s*MOCK_IMAGE_BASE64/);
});

test("cloudflare worker exposes creation record and generation routes", async () => {
  const worker = await readFile(cloudflareWorkerPath, "utf8");

  assert.match(worker, /buildCreationPlan/);
  assert.match(worker, /buildCreationLogoBatchPlan/);
  assert.match(worker, /async function runCreationGenerate/);
  assert.match(worker, /async function runCreationLogoBatchGenerate/);
  assert.match(worker, /url\.pathname === "\/api\/creation\/sets"/);
  assert.match(worker, /url\.pathname === "\/api\/creation\/generate"/);
  assert.match(worker, /url\.pathname === "\/api\/creation\/logo-batch"/);
});

test("creation logo batch uses each uploaded image with the shared logo reference", async () => {
  const server = await readFile(serverPath, "utf8");
  const worker = await readFile(cloudflareWorkerPath, "utf8");
  const localHandler =
    server.match(/async function handleCreationLogoBatchGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationRepair/)?.[0] || "";
  const workerHandler =
    worker.match(/async function runCreationLogoBatchGenerate[\s\S]*?\r?\n}\r?\n\r?\nfunction streamCreationLogoBatchGenerate/)?.[0] || "";

  assert.match(server, /CREATION_LOGO_BATCH_REFERENCE_LABELS/);
  assert.match(worker, /CREATION_LOGO_BATCH_REFERENCE_LABELS/);
  assert.match(localHandler, /formData\.getAll\("sourceImages"\)/);
  assert.match(localHandler, /readCreationLogoImage\(formData\)/);
  assert.match(localHandler, /buildCreationLogoBatchPlan/);
  assert.match(localHandler, /referenceImages:\s*\[sourceImage,\s*logoImage\]/);
  assert.match(localHandler, /referenceImageLabels:\s*CREATION_LOGO_BATCH_REFERENCE_LABELS/);
  assert.match(localHandler, /assetKind:\s*"creation-logo-batch-image"/);
  assert.match(workerHandler, /formData\.getAll\("sourceImages"\)/);
  assert.match(workerHandler, /readCreationLogoImage\(formData\)/);
  assert.match(workerHandler, /buildCreationLogoBatchPlan/);
  assert.match(workerHandler, /referenceImages:\s*\[sourceImage,\s*logoImage\]/);
  assert.match(workerHandler, /referenceImageLabels:\s*CREATION_LOGO_BATCH_REFERENCE_LABELS/);
});

test("creation generation accepts references image count marketing scenario and industry template", async () => {
  const server = await readFile(serverPath, "utf8");
  const worker = await readFile(cloudflareWorkerPath, "utf8");

  assert.match(server, /formData\.get\("imageCount"\)/);
  assert.match(server, /formData\.get\("scenario"\)/);
  assert.match(server, /formData\.get\("industryTemplate"\)/);
  assert.match(server, /dimensionSpecs:\s*formData\.get\("dimensionSpecs"\)/);
  assert.match(server, /dimensionUnitMode:\s*formData\.get\("dimensionUnitMode"\)/);
  assert.match(server, /dimensionSpecs:\s*plan\.dimensionSpecs/);
  assert.match(server, /dimensionUnitMode:\s*plan\.dimensionUnitMode/);
  assert.match(server, /industryTemplatePath:\s*plan\.industryTemplatePath/);
  assert.match(server, /industryTemplate:\s*plan\.industryTemplate/);
  assert.match(server, /creationIndustryTemplate:\s*plan\.industryTemplate/);
  assert.match(server, /const referenceImages = await toReferenceImages/);
  assert.match(server, /referenceImageNames:\s*referenceImages\.map/);
  assert.match(server, /referenceImages,/);
  assert.match(server, /formData\.getAll\("logoImage"\)/);
  assert.match(server, /logoOptions:/);
  assert.doesNotMatch(server, /handleCreationGenerate[\s\S]*referenceImages:\s*\[\]/);

  assert.match(worker, /formData\.get\("imageCount"\)/);
  assert.match(worker, /formData\.get\("scenario"\)/);
  assert.match(worker, /formData\.get\("industryTemplate"\)/);
  assert.match(worker, /dimensionSpecs:\s*formData\.get\("dimensionSpecs"\)/);
  assert.match(worker, /dimensionUnitMode:\s*formData\.get\("dimensionUnitMode"\)/);
  assert.match(worker, /dimensionSpecs:\s*plan\.dimensionSpecs/);
  assert.match(worker, /dimensionUnitMode:\s*plan\.dimensionUnitMode/);
  assert.match(worker, /industryTemplatePath:\s*plan\.industryTemplatePath/);
  assert.match(worker, /industryTemplate:\s*plan\.industryTemplate/);
  assert.match(worker, /const referenceImages = await toReferenceImages/);
  assert.match(worker, /referenceImageNames:\s*referenceImages\.map/);
  assert.match(worker, /referenceImages,/);
  assert.match(worker, /formData\.getAll\("logoImage"\)/);
  assert.match(worker, /logoOptions:/);
  assert.doesNotMatch(worker, /runCreationGenerate[\s\S]*referenceImages:\s*\[\]/);
});

test("creation generation labels uploaded reference image count and file order", async () => {
  const server = await readFile(serverPath, "utf8");
  const worker = await readFile(cloudflareWorkerPath, "utf8");

  assert.match(server, /buildCreationItemReferenceImages/);
  assert.match(worker, /buildCreationItemReferenceImages/);
  assert.match(server, /buildCreationReferenceImageLabels/);
  assert.match(worker, /buildCreationReferenceImageLabels/);
  assert.match(
    server,
    /const itemReferenceImages = buildCreationItemReferenceImages\(item,\s*referenceImages,\s*referenceImageRoles\);[\s\S]*referenceImageLabels:\s*buildCreationReferenceImageLabels\(itemReferenceImages,\s*referenceImageRoles\)/,
  );
  assert.match(
    worker,
    /const itemReferenceImages = buildCreationItemReferenceImages\(item,\s*referenceImages,\s*plan\.referenceImageRoles\);[\s\S]*referenceImageLabels:\s*buildCreationReferenceImageLabels\(itemReferenceImages,\s*plan\.referenceImageRoles\)/,
  );
  assert.match(worker, /normalizeCreationReferenceRoles\(formData\.get\("referenceImageRoles"\)\)/);
  assert.match(worker, /referenceImageRoles,\s*\n\s*skuSubjects:\s*formData\.get\("skuSubjects"\),\s*\n\s*skuBundleCount:\s*formData\.get\("skuBundleCount"\),\s*\n\s*logoOptions:/);
});

test("creation generation passes SKU subjects through local and worker planning", async () => {
  const server = await readFile(serverPath, "utf8");
  const worker = await readFile(cloudflareWorkerPath, "utf8");

  assert.match(server, /formData\.get\("skuSubjects"\)/);
  assert.match(worker, /formData\.get\("skuSubjects"\)/);
  assert.match(server, /formData\.get\("skuBundleCount"\)/);
  assert.match(worker, /formData\.get\("skuBundleCount"\)/);
  assert.match(
    server,
    /buildCreationPlan\(\{[\s\S]*skuSubjects:\s*formData\.get\("skuSubjects"\),\s*\n\s*skuBundleCount:\s*formData\.get\("skuBundleCount"\)[\s\S]*logoOptions:/,
  );
  assert.match(
    worker,
    /buildCreationPlan\(\{[\s\S]*skuSubjects:\s*formData\.get\("skuSubjects"\),\s*\n\s*skuBundleCount:\s*formData\.get\("skuBundleCount"\)[\s\S]*logoOptions:/,
  );
  assert.match(server, /skuSubjects:\s*plan\.skuSubjects/);
  assert.match(worker, /skuSubjects:\s*plan\.skuSubjects/);
  assert.match(server, /skuBundleCount:\s*plan\.skuBundleCount/);
  assert.match(worker, /skuBundleCount:\s*plan\.skuBundleCount/);
});

test("creation reference uploads use the dedicated nine-image limit", async () => {
  const server = await readFile(serverPath, "utf8");
  const worker = await readFile(cloudflareWorkerPath, "utf8");
  const analyzeHandler =
    server.match(/async function handleCreationReferenceAnalyze[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationPlan/)?.[0] || "";
  const generateHandler =
    server.match(/async function handleCreationGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationRepair/)?.[0] || "";
  const repairHandler =
    server.match(/async function handleCreationRepair[\s\S]*?\r?\n}\r?\n\r?\nasync function handleGenerate/)?.[0] || "";
  const workerGenerateHandler =
    worker.match(/async function runCreationGenerate[\s\S]*?\r?\n}\r?\n\r?\nfunction streamCreationGenerate/)?.[0] || "";

  assert.match(server, /MAX_CREATION_REFERENCE_IMAGES/);
  assert.match(worker, /MAX_CREATION_REFERENCE_IMAGES/);
  assert.match(analyzeHandler, /referenceImages\.length > MAX_CREATION_REFERENCE_IMAGES/);
  assert.match(generateHandler, /referenceImages\.length > MAX_CREATION_REFERENCE_IMAGES/);
  assert.match(repairHandler, /referenceImages\.length > MAX_CREATION_REFERENCE_IMAGES/);
  assert.match(workerGenerateHandler, /referenceImages\.length > MAX_CREATION_REFERENCE_IMAGES/);
  assert.match(server, /sourceImages\.length > MAX_REFERENCE_IMAGES/);
  assert.match(worker, /sourceImages\.length > MAX_REFERENCE_IMAGES/);
});

test("creation batch generation runs items with the configured parallel limit", async () => {
  const server = await readFile(serverPath, "utf8");
  const worker = await readFile(cloudflareWorkerPath, "utf8");
  const generateHandler =
    server.match(/async function handleCreationGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationRepair/)?.[0] || "";
  const repairHandler =
    server.match(/async function handleCreationRepair[\s\S]*?\r?\n}\r?\n\r?\nasync function handleGenerate/)?.[0] || "";
  const workerGenerateHandler =
    worker.match(/async function runCreationGenerate[\s\S]*?\r?\n}\r?\n\r?\nfunction streamCreationGenerate/)?.[0] || "";

  assert.match(server, /runWithConcurrency/);
  assert.match(worker, /runWithConcurrency/);
  assert.match(generateHandler, /await runWithConcurrency\(\s*plan\.items,\s*MAX_PARALLEL_TASKS_PER_SESSION,/);
  assert.match(repairHandler, /await runWithConcurrency\(\s*repairItems,\s*MAX_PARALLEL_TASKS_PER_SESSION,/);
  assert.match(workerGenerateHandler, /await runWithConcurrency\(\s*plan\.items,\s*MAX_PARALLEL_TASKS_PER_SESSION,/);
});

test("local creation generation accepts reference role metadata", async () => {
  const server = await readFile(serverPath, "utf8");

  assert.match(server, /normalizeCreationReferenceRoles/);
  assert.match(server, /formData\.get\("referenceImageRoles"\)/);
  assert.match(server, /referenceImageRoles:\s*plan\.referenceImageRoles/);
  assert.match(server, /referenceImageRoles,/);
  assert.match(server, /metadata:\s*\{[\s\S]*referenceImageRoles,/);
});

test("local creation reference analysis has an independent route and does not write prompt history", async () => {
  const server = await readFile(serverPath, "utf8");
  const handler =
    server.match(/async function handleCreationReferenceAnalyze[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationGenerate/)?.[0] || "";

  assert.match(server, /CREATION_REFERENCE_ANALYSIS_MODE/);
  assert.match(server, /async function handleCreationReferenceAnalyze/);
  assert.match(server, /url\.pathname === "\/api\/creation\/reference\/analyze"/);
  assert.match(handler, /requestPromptAgentAnalysis/);
  assert.match(handler, /normalizeCreationReferenceAnalysis/);
  assert.doesNotMatch(handler, /promptAgentStore\.append/);
});

test("local creation generation accepts selected creation roles", async () => {
  const server = await readFile(serverPath, "utf8");

  assert.match(server, /formData\.get\("selectedRoles"\)/);
  assert.match(server, /selectedRoles:\s*formData\.get\("selectedRoles"\)/);
});

test("local creation plan preview exposes an independent route and shared overrides", async () => {
  const server = await readFile(serverPath, "utf8");
  const previewHandler =
    server.match(/async function handleCreationPlan[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationGenerate/)?.[0] || "";
  const generateHandler =
    server.match(/async function handleCreationGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationRepair/)?.[0] || "";

  assert.match(server, /applyCreationPlanOverrides/);
  assert.match(server, /async function handleCreationPlan/);
  assert.match(server, /url\.pathname === "\/api\/creation\/plan"/);
  assert.match(server, /dimensionSpecs:\s*plan\.dimensionSpecs/);
  assert.match(server, /dimensionUnitMode:\s*plan\.dimensionUnitMode/);
  assert.match(previewHandler, /buildCreationPlan/);
  assert.match(previewHandler, /dimensionSpecs:\s*formData\.get\("dimensionSpecs"\)/);
  assert.match(previewHandler, /dimensionUnitMode:\s*formData\.get\("dimensionUnitMode"\)/);
  assert.match(previewHandler, /formData\.get\("planOverrides"\)/);
  assert.match(previewHandler, /sendJson\(response,\s*200,\s*\{\s*ok:\s*true,\s*plan/);
  assert.doesNotMatch(previewHandler, /mergeRequestPrivateConfig/);
  assert.match(generateHandler, /dimensionSpecs:\s*formData\.get\("dimensionSpecs"\)/);
  assert.match(generateHandler, /dimensionUnitMode:\s*formData\.get\("dimensionUnitMode"\)/);
  assert.match(generateHandler, /formData\.get\("planOverrides"\)/);
  assert.match(generateHandler, /applyCreationPlanOverrides\(plan,/);
});

test("creation repair route regenerates selected set items", async () => {
  const server = await readFile(serverPath, "utf8");

  assert.match(server, /selectCreationRepairItems/);
  assert.match(server, /async function handleCreationRepair/);
  assert.match(server, /url\.pathname === "\/api\/creation\/repair"/);
  assert.match(server, /creationSetStore\.readManifest\(setId\)/);
  assert.match(server, /formData\.get\("itemId"\)/);
  assert.match(server, /formData\.get\("scope"\)/);
  assert.match(server, /formData\.get\("promptOverride"\)/);
  assert.match(server, /formData\.get\("marketingCopyOverride"\)/);
  assert.match(server, /const repairItems = selectCreationRepairItems/);
  assert.match(server, /dimensionSpecs:\s*existingSet\.dimensionSpecs/);
  assert.match(server, /industryTemplatePath:\s*existingSet\.industryTemplatePath/);
  assert.match(server, /applyCreationRepairOverrides/);
  assert.match(server, /filename:\s*item\.filename \|\| buildCreationImageFilename/);
  assert.match(server, /prompt:\s*repairItem\.prompt/);
  assert.match(server, /buildCreationItemReferenceImages\(repairItem,\s*referenceImages,\s*referenceImageRoles\)/);
  assert.match(server, /buildCreationReferenceImageLabels\(itemReferenceImages,\s*referenceImageRoles\)/);
  assert.match(server, /writeSseEvent\(response, "repair_started"/);
});
