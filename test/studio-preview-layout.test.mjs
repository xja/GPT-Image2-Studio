import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const indexPath = new URL("../public/index.html", import.meta.url);
const stylesPath = new URL("../public/styles.css", import.meta.url);
const appPath = new URL("../public/app.js", import.meta.url);
const serverPath = new URL("../server.mjs", import.meta.url);

test("browser-imported lib modules are copied into public for Vercel static serving", async () => {
  const app = await readFile(appPath, "utf8");
  const imports = [...app.matchAll(/from "\/lib\/([^"?]+)\.mjs(?:\?[^"]*)?"/g)].map((match) => match[1]);

  assert.ok(imports.length > 0);
  assert.equal(new Set(imports).size, imports.length);

  for (const moduleName of imports) {
    const moduleSource = await readFile(new URL(`../public/lib/${moduleName}.mjs`, import.meta.url), "utf8");
    const sourceModule = await readFile(new URL(`../lib/${moduleName}.mjs`, import.meta.url), "utf8");
    assert.equal(moduleSource, sourceModule);
    assert.doesNotMatch(moduleSource, /\uFFFD/);
  }

  const sizeOptionsModule = await readFile(new URL("../public/lib/generation-size-options.mjs", import.meta.url), "utf8");
  assert.match(sizeOptionsModule, /export function getGenerationSizeOptions/);
});

test("preview image uses contain sizing to fill the available canvas without clipping", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(
    styles,
    /#previewImage\s*\{[\s\S]*width:\s*auto;[\s\S]*height:\s*auto;[\s\S]*max-width:\s*100%;[\s\S]*max-height:\s*100%;/,
  );
  assert.doesNotMatch(styles, /#previewImage\s*\{[^}]*object-fit:\s*contain;/);
  assert.match(app, /refs\.previewImage\.style\.transform = `scale\(\$\{state\.zoom\}\)`;/);
});

test("lightbox detail image can be clicked to magnify inside the detail view", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(styles, /#lightboxImage\s*\{[\s\S]*object-fit:\s*contain;[\s\S]*cursor:\s*zoom-in;/);
  assert.match(styles, /\.lightbox-media-stage\s*\{[^}]*overflow:\s*hidden;/);
  assert.match(styles, /\.lightbox-media-stage\.is-zoomed\s*\{[^}]*overflow:\s*auto;/);
  assert.match(styles, /#lightboxImage\.is-zoomed\s*\{[\s\S]*cursor:\s*zoom-out;/);
  assert.match(
    styles,
    /html\[data-ui-layout="tablet"\]\s+\.lightbox-fields,\s*[\r\n]+\s*html\[data-ui-layout="mobile"\]\s+\.lightbox-fields\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
  );
  assert.match(app, /refs\.lightboxImage\.addEventListener\("click",[\s\S]*state\.lightboxZoomed = !state\.lightboxZoomed;/);
  assert.match(app, /refs\.lightboxImage\.classList\.toggle\("is-zoomed",\s*state\.lightboxZoomed\)/);
});

test("lightbox prompt field exposes a copy button beside the label", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(
    html,
    /<div class="detail-field-head">[\s\S]*<span[^>]*>提示词<\/span>[\s\S]*<button class="inline-button detail-copy-button" id="copyPromptButton" type="button">复制<\/button>/,
  );
  assert.match(styles, /\.detail-field-head\s*\{[\s\S]*display:\s*flex;[\s\S]*justify-content:\s*space-between;/);
  assert.match(styles, /\.detail-copy-button\[data-copied="true"\]\s*\{[\s\S]*color:\s*var\(--text\);/);
  assert.match(
    app,
    /async function copyLightboxPrompt\(\) \{[\s\S]*navigator\.clipboard\.writeText\(refs\.lightboxPrompt\.value\);[\s\S]*markPromptCopied\(\);[\s\S]*\}/,
  );
  assert.match(app, /refs\.copyPromptButton\.addEventListener\("click",[\s\S]*copyLightboxPrompt\(\)\.catch/);
});

test("filmstrip thumbnails stay square, fill the available rail, and keep labels compact", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(
    styles,
    /\.filmstrip-item img,\s*[\r\n]+\s*\.filmstrip-ghost\s*\{[\s\S]*width:\s*84px;[\s\S]*height:\s*84px;/,
  );
  assert.match(styles, /\.filmstrip-row\s*\{[\s\S]*overflow:\s*hidden;[\s\S]*min-height:\s*118px;/);
  assert.match(styles, /\.filmstrip\s*\{[\s\S]*width:\s*100%;[\s\S]*max-width:\s*100%;/);
  assert.match(styles, /\.filmstrip\s*\{[\s\S]*grid-auto-columns:\s*92px;[\s\S]*justify-content:\s*start;/);
  assert.match(styles, /\.filmstrip-item\s*\{[\s\S]*justify-items:\s*center;/);
  assert.match(styles, /\.filmstrip-item span\s*\{[\s\S]*font-size:\s*var\(--type-subtitle-size\);[\s\S]*line-height:\s*14px;[\s\S]*white-space:\s*nowrap;/);
  assert.match(styles, /\.filmstrip-item img\s*\{[\s\S]*object-fit:\s*cover;/);
  assert.match(app, /function formatFilmstripSizeLabel\(item\) \{[\s\S]*return formatCompactSizeLabel\(item\?\.size\);/);
  assert.match(app, /label: formatFilmstripSizeLabel\(job\) \|\| job\.statusText \|\| formatClock\(job\.createdAt\)/);
  assert.match(app, /label: formatFilmstripSizeLabel\(item\) \|\| formatClock\(item\.createdAt\)/);
});

test("studio right column keeps only live feed and shows timeline ratio before resolution", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.doesNotMatch(html, /<section class="studio-panel recent-panel">/);
  assert.doesNotMatch(html, /id="recentList"|id="recentEmpty"|id="clearHistoryButton"|id="focusGalleryButton"/);
  assert.match(styles, /\.side-column\s*\{[\s\S]*grid-template-rows:\s*minmax\(0,\s*1fr\);/);
  assert.match(styles, /\.live-panel\s*\{[\s\S]*height:\s*100%;/);
  assert.match(styles, /\.timeline-copy\s*\{[\s\S]*display:\s*contents;/);
  assert.match(styles, /\.timeline-copy > span\s*\{[\s\S]*grid-column:\s*2\s*\/\s*-1;[\s\S]*grid-row:\s*2;/);
  assert.match(styles, /\.timeline-ratio\s*\{[\s\S]*grid-column:\s*3;[\s\S]*grid-row:\s*1;/);
  assert.match(styles, /\.timeline-resolution\s*\{[\s\S]*grid-column:\s*4;[\s\S]*grid-row:\s*1;/);
  assert.match(styles, /\.timeline-item time\s*\{[\s\S]*grid-column:\s*5;[\s\S]*grid-row:\s*1;/);
  assert.match(app, /function formatCompactRatioLabel\(ratio\) \{[\s\S]*return \/\^\\d\+:\\d\+\$\/\.test\(normalized\) \? normalized : "";/);
  assert.match(app, /const ratio = document\.createElement\("span"\);[\s\S]*ratio\.className = "timeline-ratio";[\s\S]*ratio\.textContent = formatCompactRatioLabel\(item\.ratio\);[\s\S]*row\.appendChild\(ratio\);[\s\S]*const resolution = document\.createElement\("span"\);[\s\S]*resolution\.className = "timeline-resolution";[\s\S]*resolution\.textContent = formatCompactSizeLabel\(item\.size\);[\s\S]*row\.appendChild\(resolution\);[\s\S]*row\.appendChild\(time\);/);
  assert.match(app, /ratio: formatCompactRatioLabel\(task\?\.ratio\),/);
  assert.match(app, /size: formatCompactSizeLabel\(task\?\.size\),/);
});

test("live feed shows a floating unread indicator without forcing scroll to newest items", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /<button class="timeline-new-indicator hidden" id="timelineNewIndicator" type="button" aria-label="查看新动态">[\s\S]*<span aria-hidden="true">↑<\/span>[\s\S]*<strong id="timelineNewCount">0<\/strong>[\s\S]*<\/button>/);
  assert.match(styles, /\.timeline-new-indicator\s*\{[\s\S]*position:\s*absolute;[\s\S]*top:\s*64px;[\s\S]*left:\s*50%;[\s\S]*transform:\s*translateX\(-50%\);/);
  assert.match(app, /timelineUnreadCount:\s*0/);
  assert.match(app, /timelineSignatures:\s*new Map\(\)/);
  assert.match(app, /function getTimelineScrollAnchor\(\) \{[\s\S]*dataset\.timelineKey/);
  assert.match(app, /function restoreTimelineScrollAnchor\(anchor, fallbackScrollTop\) \{[\s\S]*refs\.timelineList\.scrollTop \+=/);
  assert.match(app, /const scrollAnchor = isAtTop \? null : getTimelineScrollAnchor\(\);[\s\S]*restoreTimelineScrollAnchor\(scrollAnchor, previousScrollTop\);/);
  assert.match(app, /refs\.timelineNewIndicator\.addEventListener\("click", scrollTimelineToNewest\);/);
  assert.match(app, /refs\.timelineList\.addEventListener\("scroll", handleTimelineScroll/);
});

test("live feed keeps existing task order stable while activity text changes", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /\/app\.js\?v=20260508-reference-remove-hover-1/);
  assert.match(app, /upsertGenerationActivityEntry/);
  assert.match(app, /orderAt:\s*String\(entry\?\.orderAt \|\| entry\?\.at \|\| ""\)/);
  assert.match(app, /state\.activityFeed = upsertGenerationActivityEntry\(state\.activityFeed,/);
  assert.doesNotMatch(app, /state\.activityFeed\.sort\(\(left, right\) => String\(right\.at\)/);
});

test("scrollable surfaces use subtle themed scrollbars instead of default browser chrome", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(styles, /--scrollbar-size:\s*10px;/);
  assert.match(
    styles,
    /\.settings-form,\s*[\r\n]+\s*\.timeline-list,\s*[\r\n]+\s*\.recent-list,\s*[\r\n]+\s*\.filmstrip,\s*[\r\n]+\s*\.drawer-panel,\s*[\r\n]+\s*\.lightbox-dialog,\s*[\r\n]+\s*textarea\s*\{[\s\S]*scrollbar-width:\s*thin;[\s\S]*scrollbar-color:\s*var\(--scrollbar-thumb-color,\s*rgba\(132,\s*147,\s*255,\s*0\.42\)\)\s*var\(--scrollbar-track-color,\s*rgba\(255,\s*255,\s*255,\s*0\.06\)\);/,
  );
  assert.match(
    styles,
    /\.settings-form::-webkit-scrollbar,\s*[\r\n]+\s*\.timeline-list::-webkit-scrollbar,\s*[\r\n]+\s*\.recent-list::-webkit-scrollbar,\s*[\r\n]+\s*\.filmstrip::-webkit-scrollbar,\s*[\r\n]+\s*\.drawer-panel::-webkit-scrollbar,\s*[\r\n]+\s*\.lightbox-dialog::-webkit-scrollbar,\s*[\r\n]+\s*textarea::-webkit-scrollbar\s*\{[\s\S]*width:\s*var\(--scrollbar-size,\s*10px\);[\s\S]*height:\s*var\(--scrollbar-size,\s*10px\);/,
  );
  assert.match(styles, /\.settings-form::-webkit-scrollbar-thumb,[\s\S]*background:\s*linear-gradient\(180deg,\s*rgba\(156,\s*170,\s*255,\s*0\.58\),\s*rgba\(111,\s*124,\s*255,\s*0\.34\)\);/);
});

test("config drawer opens with a wider panel for form editing", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(styles, /\.drawer-panel\s*\{[\s\S]*width:\s*min\(468px,\s*100vw\);/);
});

test("reference upload appears above prompt and generate action below prompt", async () => {
  const html = await readFile(indexPath, "utf8");

  assert.match(
    html,
    /<form id="generateForm" class="settings-form">[\s\S]*<div class="field-group reference-field-group">[\s\S]*id="referenceDropzone"[\s\S]*<\/div>[\s\S]*id="promptInput"[\s\S]*<button[\s\S]*class="generate-button"[\s\S]*id="generateButton"[\s\S]*type="submit"/,
  );
  assert.doesNotMatch(html, /class="generate-note"/);
  assert.doesNotMatch(html, /支持最多 20 个任务排队/);
  assert.doesNotMatch(html, /id="generateButton"[\s\S]*id="promptInput"/);
  assert.doesNotMatch(html, /id="promptInput"[\s\S]*id="referenceDropzone"/);
});

test("reference preview cards do not render uploaded filenames", async () => {
  const app = await readFile(appPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.doesNotMatch(app, /name\.textContent\s*=\s*item\.file\.name/);
  assert.doesNotMatch(app, /reference-card-meta/);
  assert.doesNotMatch(styles, /\.reference-card-meta/);
  assert.match(styles, /\.reference-card\s*\{[^}]*padding:\s*0;[^}]*overflow:\s*hidden;/);
  assert.match(styles, /\.reference-preview-button\s*\{[^}]*width:\s*100%;[^}]*aspect-ratio:\s*1\s*\/\s*1;[^}]*height:\s*auto;/);
  assert.match(styles, /\.reference-preview-button img\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*object-fit:\s*cover;/);
  assert.match(styles, /\.reference-add-button\s*\{[^}]*width:\s*100%;[^}]*aspect-ratio:\s*1\s*\/\s*1;/);
});

test("reference thumbnail remove control is a top-right x button", async () => {
  const app = await readFile(appPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.match(app, /remove\.className = "reference-remove";[\s\S]*remove\.textContent = "x";/);
  assert.match(app, /remove\.setAttribute\("aria-label", "移除参考图"\);/);
  assert.match(styles, /\.reference-card\s*\{[\s\S]*position:\s*relative;/);
  assert.match(
    styles,
    /\.reference-remove\s*\{[\s\S]*position:\s*absolute;[\s\S]*top:\s*6px;[\s\S]*right:\s*6px;[\s\S]*width:\s*24px;[\s\S]*height:\s*24px;/,
  );
  assert.doesNotMatch(app, /remove\.textContent = "移除";/);
});

test("reference thumbnail remove control appears only on the active thumbnail", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(
    styles,
    /@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)\s*\{[\s\S]*\.reference-remove\s*\{[\s\S]*opacity:\s*0;[\s\S]*pointer-events:\s*none;/,
  );
  assert.match(
    styles,
    /\.reference-card:hover\s*>\s*\.reference-remove,[\s\S]*\.reference-card:focus-within\s*>\s*\.reference-remove\s*\{[\s\S]*opacity:\s*1;[\s\S]*pointer-events:\s*auto;/,
  );
});

test("style transfer thumbnail remove control anchors to the thumbnail corner", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(
    styles,
    /\.studio-view\[data-studio-mode="style-transfer"\]\s+\.style-transfer-grid\s+\.reference-card\s*\{[\s\S]*width:\s*100%;[\s\S]*justify-self:\s*stretch;/,
  );
  assert.match(
    styles,
    /\.studio-view\[data-studio-mode="style-transfer"\]\s+\.style-transfer-grid\s+\.reference-remove\s*\{[\s\S]*top:\s*2px;[\s\S]*right:\s*2px;/,
  );
});

test("style transfer upload slots accept one image and align preview width to upload button", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.match(html, /id="styleTransferSourceInput"[^>]*type="file"[^>]*accept="image\/\*"[^>]*>/);
  assert.match(html, /id="styleTransferStyleInput"[^>]*type="file"[^>]*accept="image\/\*"[^>]*>/);
  assert.doesNotMatch(html, /id="styleTransferSourceInput"[^>]*\bmultiple\b/);
  assert.doesNotMatch(html, /id="styleTransferStyleInput"[^>]*\bmultiple\b/);
  assert.match(html, /id="styleTransferSourceDropzone"[\s\S]*<strong>[^<]+<\/strong>\s*<\/label>/);
  assert.match(html, /id="styleTransferStyleDropzone"[\s\S]*<strong>[^<]+<\/strong>\s*<\/label>/);
  assert.match(app, /const imageFiles = \[\.\.\.\(fileList \|\| \[\]\)\]\.filter\(\(item\) => item\.type\.startsWith\("image\/"\)\);/);
  assert.match(app, /if \(imageFiles\.length > 1\) \{[\s\S]*showError\("原图和风格参考图每个区域只能上传一张图片。"\);[\s\S]*return;/);
  assert.match(
    styles,
    /\.studio-view\[data-studio-mode="style-transfer"\] \.style-transfer-slot:has\(\.style-transfer-grid:not\(\.hidden\)\) \{[\s\S]*grid-template-rows:\s*minmax\(64px,\s*auto\)\s*minmax\(132px,\s*auto\);/,
  );
  assert.match(
    styles,
    /\.reference-grid\.style-transfer-grid\s*\{[\s\S]*width:\s*100%;[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);[\s\S]*justify-items:\s*stretch;/,
  );
  assert.match(
    styles,
    /\.reference-grid\.style-transfer-grid \.reference-card\s*\{[\s\S]*width:\s*100%;[\s\S]*justify-self:\s*stretch;/,
  );
  assert.match(
    styles,
    /\.studio-view\[data-studio-mode="style-transfer"\] \.style-transfer-grid \.reference-preview-button\s*\{[\s\S]*width:\s*100%;[\s\S]*height:\s*132px;/,
  );
  assert.match(
    styles,
    /\.studio-view\[data-studio-mode="style-transfer"\] \.style-transfer-grid \.reference-preview-button img\s*\{[\s\S]*width:\s*100%;[\s\S]*height:\s*100%;/,
  );
});

test("reference thumbnails render three per row and open a local preview viewer", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="referencePreviewViewer"[\s\S]*id="referencePreviewImage"/);
  assert.match(styles, /\.reference-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(styles, /\.reference-preview-button\s*\{/);
  assert.match(styles, /\.reference-analysis-view \.reference-preview-button\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1;/);
  assert.match(app, /referencePreviewItem:\s*null/);
  assert.match(app, /function openReferencePreview\(referenceId\) \{/);
  assert.match(app, /refs\.referencePreviewImage\.src = item\.previewUrl;/);
  assert.match(app, /refs\.referenceGrid\.addEventListener\("click",[\s\S]*target\.closest\("\[data-reference-preview-id\]"\)/);
});

test("reference images are compressed before generation uploads", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /const GENERATION_REFERENCE_IMAGE_COMPRESS_THRESHOLD_BYTES = 900 \* 1024;/);
  assert.match(app, /const GENERATION_REFERENCE_IMAGE_MAX_EDGE = 1024;/);
  assert.match(app, /async function prepareGenerationReferenceImageFile\(file\) \{/);
  assert.match(app, /new File\(\[blob\], makeGenerationReferenceImageName\(file\.name\)/);
  assert.match(app, /function startReferenceGenerationCompression\(item\) \{/);
  assert.match(app, /item\.generationFilePromise = prepareGenerationReferenceImageFile\(item\.file\)/);
  assert.match(app, /function getGenerationReferenceFile\(item\) \{/);
  assert.match(app, /const referenceFiles = state\.referenceFiles\.map\(getGenerationReferenceFile\);/);
  assert.match(app, /await ensureReferenceGenerationFilesReady\(\);[\s\S]*const job = createJob\(\);/);
  assert.match(app, /job\.referenceFiles\.forEach\(\(file\) => \{[\s\S]*formData\.append\("referenceImages", file\);/);
});

test("style transfer mode exposes independent source and style uploads", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /href="#style-transfer"[\s\S]*data-view-panel="studio"/);
  assert.match(html, /id="styleTransferBlock"/);
  assert.match(html, /id="styleTransferSourceInput"[\s\S]*id="styleTransferSourceGrid"/);
  assert.match(html, /id="styleTransferStyleInput"[\s\S]*id="styleTransferStyleGrid"/);
  assert.match(html, /id="styleTransferInstructionInput"/);
  assert.match(styles, /\.style-transfer-block\s*\{/);
  assert.match(styles, /\.style-transfer-upload-grid\s*\{/);
  assert.match(app, /const CREATE_VIEW_IDS = new Set\(\["studio", "style-transfer", "reference-analysis", "creation", "ppt"\]\);/);
  assert.match(app, /studioMode:\s*"prompt"/);
  assert.match(app, /function setStudioGenerationMode\(mode = "prompt"\)/);
  assert.match(app, /function getViewFromHash\(\) \{[\s\S]*"#style-transfer"[\s\S]*return "style-transfer";/);
  assert.match(app, /function syncHash\(view\) \{[\s\S]*view === "style-transfer"[\s\S]*"#style-transfer"/);
});

test("style transfer mode keeps the shared studio height sync and mode styling hooks", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(app, /studioView:\s*document\.querySelector\("\.studio-view"\),/);
  assert.match(app, /if \(refs\.studioView\) \{[\s\S]*refs\.studioView\.dataset\.studioMode = nextMode;[\s\S]*\}/);
  assert.match(app, /const isStudioLikeView = state\.activeView === "studio" \|\| state\.activeView === "style-transfer";/);
  assert.match(app, /if \(STACKED_STUDIO_LAYOUT_MODES\.has\(getCurrentStudioLayoutMode\(\)\) \|\| !isStudioLikeView\) \{/);
  assert.match(styles, /\.studio-view\[data-studio-mode="style-transfer"\] \.studio-grid \{/);
  assert.match(styles, /\.studio-view\[data-studio-mode="style-transfer"\] \.style-transfer-upload-grid \{/);
});

test("style transfer panel aligns slot rows and clips its own background", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(
    styles,
    /\.studio-view\[data-studio-mode="style-transfer"\] \.style-transfer-block \{[\s\S]*box-sizing:\s*border-box;[\s\S]*overflow:\s*hidden;/,
  );
  assert.match(
    styles,
    /\.studio-view\[data-studio-mode="style-transfer"\] \.style-transfer-slot \{[\s\S]*grid-template-rows:\s*minmax\(64px,\s*auto\)\s*minmax\(132px,\s*auto\);/,
  );
  assert.match(
    styles,
    /\.studio-view\[data-studio-mode="style-transfer"\] \.style-transfer-dropzone \{[\s\S]*min-height:\s*132px;/,
  );
  assert.match(
    styles,
    /\.studio-view\[data-studio-mode="style-transfer"\] \.style-transfer-slot:has\(\.style-transfer-grid:not\(\.hidden\)\) \{[\s\S]*grid-template-rows:\s*minmax\(64px,\s*auto\)\s*minmax\(132px,\s*auto\);/,
  );
  assert.match(
    styles,
    /\.studio-view\[data-studio-mode="style-transfer"\] \.style-transfer-slot \.field-head \{[\s\S]*min-height:\s*64px;/,
  );
  assert.match(
    styles,
    /html\[data-ui-layout="mobile"\] \.nav-item\[data-nav-section="settings"\] \.nav-flyout\.mega-menu \{[\s\S]*left:\s*auto;[\s\S]*right:\s*0;/,
  );
});

test("style transfer generation builds a preservation prompt and submits both images as references", async () => {
  const app = await readFile(appPath, "utf8");
  const server = await readFile(serverPath, "utf8");

  assert.match(app, /function buildStyleTransferPrompt\(\) \{/);
  assert.match(app, /Use the first reference image as the source image/);
  assert.match(app, /preserve every visible subject, object, pose, layout, composition, spatial relationship/);
  assert.match(app, /Use the second reference image only as the style reference/);
  assert.match(app, /The second reference image is the style authority/);
  assert.match(app, /Do not keep anime, cartoon, comic, cel-shaded, line-art, CGI doll, or illustration residue/);
  assert.match(app, /function createStyleTransferJob\(\) \{/);
  assert.match(app, /mode:\s*"style-transfer"/);
  assert.match(app, /referenceFiles:\s*getStyleTransferReferenceFiles\(\)/);
  assert.match(app, /function appendStyleTransferReferencesToFormData\(formData, job\) \{/);
  assert.match(app, /formData\.set\("mode", "style-transfer"\);/);
  assert.match(app, /formData\.set\("styleTransferSourceImageName", job\.styleTransferSourceImageName\);/);
  assert.match(app, /formData\.set\("styleTransferReferenceImageName", job\.styleTransferReferenceImageName\);/);
  assert.match(app, /job\.referenceFiles\.forEach\(\(file\) => \{[\s\S]*formData\.append\("referenceImages", file\);/);
  assert.match(
    app,
    /startGeneration[\s\S]*if \(state\.studioMode === "style-transfer"\) \{[\s\S]*await ensureStyleTransferGenerationFilesReady\(\);[\s\S]*const job = createStyleTransferJob\(\);/,
  );
  assert.match(server, /STYLE_TRANSFER_REFERENCE_IMAGE_LABELS/);
  assert.match(server, /referenceImageLabels:\s*generationMode === "style-transfer"\s*\?\s*STYLE_TRANSFER_REFERENCE_IMAGE_LABELS\s*:\s*\[\]/);
});

test("reference analysis generation uploads prepared reference images", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /function getReferenceAnalysisGenerationFile\(item\) \{/);
  assert.match(app, /function startReferenceAnalysisGenerationCompression\(item\) \{/);
  assert.match(app, /function ensureReferenceAnalysisGenerationFilesReady\(\) \{/);
  assert.match(
    app,
    /function createReferenceAnalysisJob\(\) \{[\s\S]*const referenceFiles = state\.referenceAnalysis\.files\.map\(getReferenceAnalysisGenerationFile\)\.filter\(Boolean\);/,
  );
  assert.match(
    app,
    /startReferenceAnalysisGeneration[\s\S]*await ensureReferenceAnalysisGenerationFilesReady\(\);[\s\S]*const job = createReferenceAnalysisJob\(\);/,
  );
  assert.doesNotMatch(
    app,
    /const referenceFiles = state\.referenceAnalysis\.files\.map\(\(item\) => item\.file\)\.filter\(Boolean\);/,
  );
});

test("prompt field can start generation with Ctrl+Enter", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="generateButton"[\s\S]*aria-keyshortcuts="Control\+Enter"/);
  assert.match(app, /function isStartGenerationShortcut\(event\) \{[\s\S]*event\.ctrlKey[\s\S]*event\.key === "Enter"/);
  assert.match(app, /function handlePromptGenerationShortcut\(event\) \{[\s\S]*isStartGenerationShortcut\(event\)[\s\S]*event\.preventDefault\(\);[\s\S]*refs\.generateButton\.click\(\);/);
  assert.match(app, /refs\.promptInput\.addEventListener\("keydown", handlePromptGenerationShortcut\);/);
});

test("studio rendering preserves the settings form scroll position during generation updates", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /function getSettingsFormScrollTop\(\) \{[\s\S]*refs\.generateForm\.scrollTop/);
  assert.match(app, /function restoreSettingsFormScrollTop\(scrollTop\) \{[\s\S]*refs\.generateForm\.scrollTop = scrollTop;[\s\S]*window\.requestAnimationFrame\(restore\);/);
  assert.match(app, /function renderAll\(\) \{[\s\S]*const settingsScrollTop = getSettingsFormScrollTop\(\);[\s\S]*restoreSettingsFormScrollTop\(settingsScrollTop\);[\s\S]*\}/);
  assert.match(app, /function syncStudioHeight\(\) \{[\s\S]*const settingsScrollTop = getSettingsFormScrollTop\(\);[\s\S]*restoreSettingsFormScrollTop\(settingsScrollTop\);[\s\S]*\}/);
});

test("generation loading shell uses light DOM and transform-only motion", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const loadingStart = styles.indexOf(".preview-loading-shell");
  const loadingStyles = styles.slice(loadingStart, styles.indexOf(".preview-panel", loadingStart));

  assert.match(app, /"preview-loading-progress"/);
  assert.match(app, /"preview-loading-signal"/);
  assert.doesNotMatch(app, /preview-loading-aura|preview-loading-morph|preview-loading-trace|preview-loading-core/);
  assert.match(
    loadingStyles,
    /\.preview-loading-progress\s*\{[\s\S]*transform:\s*scaleX\(var\(--loading-progress,\s*0\.25\)\);[\s\S]*animation:\s*preview-loading-progress-sweep/,
  );
  assert.match(loadingStyles, /\.preview-loading-signal\s*\{[\s\S]*animation:\s*preview-loading-signal/);
  assert.doesNotMatch(loadingStyles, /preview-loading-morph|preview-loading-aura|filter:\s*blur|mix-blend-mode/);
  assert.match(
    loadingStyles,
    /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.preview-loading-progress,[\s\S]*\.preview-loading-signal[\s\S]*animation:\s*none;/,
  );
});

test("studio panels start without redundant title blocks and merge parameters under ratio controls", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const promptParameterSettings = html.match(/<div class="field-group parameter-settings">[\s\S]*?(?=<\/form>)/)?.[0] || "";

  assert.match(html, /<div class="field-group parameter-settings">[\s\S]*<span>参数设置<\/span>[\s\S]*<div class="ratio-grid" id="ratioGrid"><\/div>[\s\S]*<div class="advanced-content">/);
  assert.doesNotMatch(promptParameterSettings, /<small>Parameters<\/small>/);
  assert.match(html, /<div class="field-group parameter-settings">[\s\S]*<label class="compact-field">[\s\S]*<span>推理强度<\/span>[\s\S]*<label class="compact-field">[\s\S]*<span>分辨率<\/span>[\s\S]*<label class="compact-field">[\s\S]*<span>输出格式<\/span>/);
  assert.match(html, /<div class="advanced-controls">[\s\S]*<label class="compact-field">[\s\S]*<span>输出格式<\/span>[\s\S]*<\/label>[\s\S]*<div class="parameter-meta" aria-label="工具模型与质量">[\s\S]*<span>工具模型<\/span>[\s\S]*<strong>gpt-image-2<\/strong>[\s\S]*<span>质量<\/span>[\s\S]*<strong>High<\/strong>[\s\S]*<\/div>[\s\S]*<\/div>/);
  assert.doesNotMatch(html, /<p>工具模型：/);
  assert.doesNotMatch(html, /<p>质量：/);
  assert.doesNotMatch(html, /<details class="advanced-box"/);
  assert.doesNotMatch(html, /<summary>高级选项/);
  assert.doesNotMatch(promptParameterSettings, />\s*比例\s*</);
  assert.doesNotMatch(html, /<h2>生成设置<\/h2>/);
  assert.doesNotMatch(html, /<h2>生成结果<\/h2>/);
  assert.doesNotMatch(html, /外层模型：/);
  assert.doesNotMatch(html, /中转地址：/);
  assert.doesNotMatch(html, /id="advancedResponsesModel"/);
  assert.doesNotMatch(html, /id="advancedBaseUrl"/);
  assert.doesNotMatch(app, /advancedResponsesModel/);
  assert.doesNotMatch(app, /advancedBaseUrl/);
});

test("ratio picker renders every configured aspect ratio instead of a featured subset", async () => {
  const app = await readFile(appPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.match(app, /function getVisibleRatios\(\) \{[\s\S]*return \[\.\.\.state\.aspectRatios\];[\s\S]*\}/);
  assert.doesNotMatch(app, /FEATURED_RATIOS/);
  assert.doesNotMatch(app, /state\.aspectRatios\.slice\(0,\s*5\)/);
  assert.doesNotMatch(app, /subtitle\.textContent = option\.label/);
  assert.doesNotMatch(app, /button\.appendChild\(subtitle\)/);
  assert.doesNotMatch(styles, /\.ratio-chip span\s*\{/);
});

test("studio output format can be selected as png or jpg", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /<span>输出格式<\/span>[\s\S]*<select id="outputFormatInput" name="format"><\/select>/);
  assert.match(app, /getOutputFormatOptions,[\s\S]*normalizeOutputFormat,/);
  assert.match(app, /outputFormatInput: document\.querySelector\("#outputFormatInput"\)/);
  assert.match(app, /function renderOutputFormatOptions\(\) \{[\s\S]*getOutputFormatOptions\(\)\.forEach/);
  assert.match(app, /format: normalizeOutputFormat\(refs\.outputFormatInput\.value/);
  assert.match(app, /formData\.set\("format", job\.format\);/);
});

test("prompt agent opens from global navigation without adding another view tab", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /data-nav-action="prompt-agent"[\s\S]*图片转提示词/);
  assert.match(html, /<div class="topbar-ghost-actions" aria-hidden="true">[\s\S]*id="openPromptAgentButton"/);
  assert.match(styles, /\.topbar-ghost-actions\s*\{[\s\S]*display:\s*none;/);
  assert.match(html, /<aside class="prompt-agent-modal hidden" id="promptAgentModal"/);
  assert.match(html, /id="promptAgentHistoryList"/);
  assert.doesNotMatch(html, /data-view-tab="prompt-agent"/);
  assert.match(styles, /\.prompt-agent-modal\s*\{[\s\S]*position:\s*fixed;/);
  assert.match(app, /fetch\("\/api\/prompt-agent\/analyze"/);
  assert.match(app, /refs\.promptInput\.value = promptText;/);
  assert.match(app, /loadPromptAgentHistory/);
});

test("top navigation groups functions into an Apple-style global mega menu", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const createMenu = html.match(/data-nav-section="create"[\s\S]*?(?=<div class="nav-item" data-nav-section="assets")/)?.[0] || "";
  const assetsMenu = html.match(/data-nav-section="assets"[\s\S]*?(?=<div class="nav-item" data-nav-section="settings")/)?.[0] || "";
  const settingsMenu = html.match(/data-nav-section="settings"[\s\S]*?(?=<\/div>\s*<\/nav>)/)?.[0] || "";

  assert.match(html, /<nav class="primary-nav global-nav" aria-label="全局导航">/);
  assert.doesNotMatch(html, /nav-region-label/);
  assert.doesNotMatch(html, />主区</);
  assert.match(html, /<div class="view-tabs global-nav-list" aria-label="功能菜单导航">/);
  assert.match(html, /data-nav-section="create"[\s\S]*data-nav-menu="create"[\s\S]*aria-haspopup="true"[\s\S]*aria-expanded="false"[\s\S]*<span class="nav-tab-label">创作<\/span>[\s\S]*<span class="nav-tab-note">Studio<\/span>/);
  assert.doesNotMatch(html, /data-nav-section="present"/);
  assert.doesNotMatch(html, /data-view-tab="ppt"/);
  assert.match(html, /data-nav-section="assets"[\s\S]*data-nav-menu="assets"[\s\S]*aria-haspopup="true"[\s\S]*aria-expanded="false"[\s\S]*<span class="nav-tab-label">资产<\/span>[\s\S]*<span class="nav-tab-note">Gallery<\/span>/);
  assert.doesNotMatch(html, /data-nav-section="records"/);
  assert.doesNotMatch(html, /data-view-tab="ppt-record"/);
  assert.match(html, /data-nav-section="settings"[\s\S]*data-nav-menu="settings"[\s\S]*aria-haspopup="true"[\s\S]*aria-expanded="false"[\s\S]*<span class="nav-tab-label">配置<\/span>[\s\S]*<span class="nav-tab-note">Settings<\/span>/);
  assert.doesNotMatch(html, /<button class="view-tab[^>]*(data-view-tab|data-nav-action)=/);
  assert.match(createMenu, /href="#studio"[\s\S]*提示词生图/);
  assert.match(createMenu, /href="#creation"[\s\S]*套图模式/);
  assert.match(createMenu, /href="#ppt"[\s\S]*PPT生成/);
  assert.match(createMenu, /data-nav-action="prompt-agent"[\s\S]*图片转提示词/);
  assert.doesNotMatch(createMenu, /data-nav-action="config"|data-nav-action="theme"|data-nav-action="output"|瀑布画廊|套图记录|PPT记录|参数与队列|比例与分辨率|查看生成结果|继续创作/);
  assert.match(assetsMenu, /data-nav-action="output"[\s\S]*打开输出目录/);
  assert.match(assetsMenu, /href="#gallery"[\s\S]*瀑布画廊/);
  assert.match(assetsMenu, /href="#creation-record"[\s\S]*套图记录/);
  assert.match(assetsMenu, /href="#ppt-record"[\s\S]*PPT记录/);
  assert.doesNotMatch(assetsMenu, /data-nav-action="config"|data-nav-action="theme"|data-nav-action="prompt-agent"|href="#studio"|href="#creation"|href="#ppt"|>画廊<\/a>|按日期浏览|筛选生成历史/);
  assert.match(settingsMenu, /data-nav-action="config"[\s\S]*配置 API/);
  assert.match(settingsMenu, /data-nav-action="theme"[\s\S]*主题颜色/);
  assert.doesNotMatch(settingsMenu, /模型与密钥|浏览器本地配置|切换明暗主题|data-nav-action="output"|data-nav-action="prompt-agent"/);
  assert.doesNotMatch(settingsMenu, /data-view-tab=/);
  assert.doesNotMatch(html, /<div class="topbar-actions" aria-label="状态与工具">/);
  assert.match(html, /<div class="topbar-api-check" aria-label="API 检测">[\s\S]*<button class="header-pill status-ready" id="connectionStatus" data-state="idle" type="button" aria-label="打开 API 配置">[\s\S]*id="connectionLabel"[\s\S]*<\/button>/);
  assert.match(html, /<div class="topbar-ghost-actions" aria-hidden="true">[\s\S]*id="configStatus"[\s\S]*id="themeToggleButton"[\s\S]*id="openOutputButton"[\s\S]*id="openPromptAgentButton"[\s\S]*id="openConfigButton"/);
  assert.doesNotMatch(html, /nav-switch-panel|nav-switch-list|nav-switch-link|小区 · 界面切换/);
  assert.match(styles, /\.topbar\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\);/);
  assert.match(styles, /\.global-nav\s*\{[\s\S]*position:\s*absolute;[\s\S]*left:\s*50%;[\s\S]*transform:\s*translateX\(-50%\);/);
  assert.match(styles, /\.view-tabs\s*\{[\s\S]*border-color:\s*transparent;[\s\S]*background:\s*transparent;[\s\S]*box-shadow:\s*none;/);
  assert.match(styles, /\.topbar-api-check\s*\{[\s\S]*position:\s*absolute;[\s\S]*top:\s*14px;[\s\S]*right:\s*14px;/);
  assert.match(styles, /\.topbar-api-check \.header-pill:hover,\s*[\r\n]+\s*\.topbar-api-check \.header-pill:focus-visible\s*\{[\s\S]*border-color:\s*color-mix\(in srgb,\s*var\(--accent\)\s*48%,\s*var\(--border\)\);/);
  assert.match(styles, /--flyout-bg:\s*rgba\(8,\s*13,\s*26,\s*0\.96\);[\s\S]*--flyout-text:\s*var\(--text\);/);
  assert.match(styles, /html\[data-theme="light"\]\s*\{[\s\S]*--flyout-bg:\s*rgba\(251,\s*251,\s*253,\s*0\.96\);[\s\S]*--flyout-text:\s*var\(--text\);/);
  assert.match(styles, /\.nav-flyout\.mega-menu\s*\{[\s\S]*width:\s*min\(680px,\s*calc\(100vw - 32px\)\);[\s\S]*padding:\s*24px;/);
  assert.match(styles, /\.mega-menu-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(170px,\s*1\.35fr\)\s+repeat\(2,\s*minmax\(120px,\s*1fr\)\);/);
  assert.match(styles, /\.mega-menu-link,\s*[\r\n]+\s*\.mega-menu-action\s*\{[\s\S]*font-size:\s*var\(--type-small-title-size\);[\s\S]*font-weight:\s*600;/);
  assert.doesNotMatch(styles, /\.mega-menu-link\.large,\s*[\r\n]+\s*\.mega-menu-action\.large\s*\{/);
  assert.match(styles, /\.global-nav-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);[\s\S]*overflow:\s*visible;/);
  assert.match(styles, /html\[data-ui-layout="stacked"\] \.global-nav-list,[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.global-nav-list\s*\{[\s\S]*overflow:\s*visible;/);
  assert.doesNotMatch(styles, /\.nav-item:hover \.nav-flyout/);
  assert.doesNotMatch(styles, /\.nav-item:focus-within \.nav-flyout/);
  assert.match(styles, /\.nav-item\.is-nav-open \.nav-flyout\s*\{[\s\S]*opacity:\s*1;[\s\S]*visibility:\s*visible;[\s\S]*pointer-events:\s*auto;/);
  assert.match(app, /function handleGlobalNavAction\(action\) \{/);
  assert.match(app, /const activeNavSection = CREATE_VIEW_IDS\.has\(view\) \? "create" : ASSET_VIEW_IDS\.has\(view\) \? "assets" : "";/);
  assert.match(app, /refs\.connectionStatus\.addEventListener\("click",\s*\(\) => setDrawerOpen\(true\)\);/);
  assert.match(app, /globalNavItems:\s*\[\.\.\.document\.querySelectorAll\("\[data-nav-section\]"\)\]/);
  assert.match(app, /function setActiveGlobalNavItem\(item\) \{[\s\S]*refs\.globalNavItems\.forEach\(\(navItem\) => \{[\s\S]*const isOpen = navItem === item;[\s\S]*navItem\.classList\.toggle\("is-nav-open",\s*isOpen\);/);
  assert.match(app, /button\.addEventListener\("pointerenter",\s*\(\) => setActiveGlobalNavItem\(item\)\);/);
  assert.match(app, /button\.addEventListener\("focus",\s*\(\) => setActiveGlobalNavItem\(item\)\);/);
  assert.match(app, /button\.addEventListener\("click",\s*\(event\) => \{[\s\S]*event\.preventDefault\(\);[\s\S]*setActiveGlobalNavItem\(item\);[\s\S]*\}\);/);
  assert.match(app, /document\.querySelectorAll\("\[data-nav-action\]"\)\.forEach/);
});

test("global navigation closes flyouts after links and actions", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /target\.closest\("a\[href\^='#'\]"\)[\s\S]*setActiveGlobalNavItem\(null\);/);
  assert.match(
    app,
    /button\.addEventListener\("click", \(\) => \{[\s\S]*handleGlobalNavAction\(button\.dataset\.navAction\);[\s\S]*setActiveGlobalNavItem\(null\);[\s\S]*\}\);/,
  );
});

test("PPT record cards open a deck preview detail with slide thumbnails", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="pptRecordList"[\s\S]*id="pptRecordDetail"/);
  assert.match(styles, /\.ppt-record-browser\s*\{/);
  assert.match(styles, /\.ppt-record-detail\s*\{/);
  assert.match(styles, /\.ppt-record-preview-stage\s*\{/);
  assert.match(styles, /\.ppt-record-slide-strip\s*\{/);
  assert.match(app, /recordDetail:\s*\{[\s\S]*deckKey:\s*""[\s\S]*slideNumber:\s*0[\s\S]*\}/);
  assert.match(app, /function getPptDeckRecordKey\(deck\) \{/);
  assert.match(app, /function selectPptRecord\(recordKey\) \{/);
  assert.match(app, /function renderPptRecordDetail\(deck\) \{/);
  assert.match(app, /item\.dataset\.pptRecordKey = getPptDeckRecordKey\(deck\);/);
  assert.match(app, /refs\.pptRecordList\.addEventListener\("click",[\s\S]*target\.closest\("\[data-ppt-record-key\]"\)/);
  assert.match(app, /refs\.pptRecordDetail\.addEventListener\("click",[\s\S]*target\.closest\("\[data-ppt-record-slide\]"\)/);
  assert.match(app, /previewImage\.src = getPptSlideImageUrl\(selectedSlide\);/);
});

test("theme toggle persists dark and white themes", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /image-studio-ui-theme-v1/);
  assert.match(html, /<button class="theme-toggle header-button" id="themeToggleButton" type="button" aria-pressed="false">/);
  assert.match(html, /<span id="themeToggleLabel">白色主题<\/span>/);
  assert.match(styles, /html\[data-theme="light"\]\s*\{[\s\S]*--bg:\s*#f5f5f7;[\s\S]*--text:\s*#1d1d1f;/);
  assert.match(styles, /html\[data-theme="light"\] body\s*\{[\s\S]*background:\s*linear-gradient\(180deg,\s*#f5f5f7 0%,\s*#ffffff 100%\);/);
  assert.match(app, /const THEME_STORAGE_KEY = "image-studio-ui-theme-v1";/);
  assert.match(app, /function setUiTheme\(theme\) \{[\s\S]*document\.documentElement\.dataset\.theme = normalized;[\s\S]*window\.localStorage\.setItem\(THEME_STORAGE_KEY,\s*normalized\);/);
  assert.match(app, /refs\.themeToggleButton\.addEventListener\("click",\s*\(\) => \{/);
});

test("prompt agent preview marks uploaded images as zoomable and animates analysis", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="promptAgentPreviewButton"[\s\S]*aria-label="放大查看待分析图片"/);
  assert.match(html, /class="prompt-agent-zoom-badge"[\s\S]*点击放大/);
  assert.match(html, /id="promptAgentImageViewer"/);
  assert.match(html, /class="prompt-agent-analysis-motion" id="promptAgentAnalysisMotion"/);
  assert.match(styles, /@keyframes prompt-agent-scan/);
  assert.match(styles, /\.prompt-agent-preview\.is-analyzing[\s\S]*prompt-agent-scan-line/);
  assert.match(styles, /\.prompt-agent-image-viewer\.open[\s\S]*display:\s*grid;/);
  assert.match(app, /function openPromptAgentImageViewer\(\)/);
  assert.match(app, /refs\.promptAgentPreviewButton\.addEventListener\("click", openPromptAgentImageViewer\)/);
  assert.match(app, /refs\.promptAgentPreview\.classList\.toggle\("is-analyzing", state\.promptAgent\.running\)/);
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.prompt-agent-preview\.is-analyzing \.prompt-agent-scan-line[\s\S]*animation:\s*none;/,
  );
});

test("prompt agent long-term history keeps prompts collapsed behind title rows", async () => {
  const app = await readFile(appPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.match(app, /className = "prompt-agent-history-title-button"/);
  assert.match(app, /titleButton\.dataset\.promptAgentMapId = item\.id;/);
  assert.match(app, /className = "prompt-agent-history-expand-button"/);
  assert.match(app, /expandButton\.dataset\.promptAgentExpandId = item\.id;/);
  assert.match(app, /className = "prompt-agent-history-detail hidden"/);
  assert.doesNotMatch(app, /mapButton\.textContent = "映射到提示词";/);
  assert.match(styles, /\.prompt-agent-history-title-button\s*\{[\s\S]*white-space:\s*nowrap;/);
  assert.match(styles, /\.prompt-agent-history-expand-button\s*\{[\s\S]*justify-self:\s*end;/);
  assert.match(styles, /\.prompt-agent-history-detail\.hidden\s*\{[\s\S]*display:\s*none;/);
});

test("prompt agent analysis also keeps JSON prompts in prompt templates", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /function getPromptAgentTemplateId\(item\) \{/);
  assert.match(app, /function savePromptAgentResultAsTemplate\(item\) \{[\s\S]*const prompt = getPromptAgentJsonText\(item\);/);
  assert.match(app, /id:\s*getPromptAgentTemplateId\(item\),[\s\S]*name:\s*item\.json\?\.title \|\| item\.filename \|\| "图片 JSON 提示词",[\s\S]*prompt,/);
  assert.match(app, /state\.promptTemplates = \[[\s\S]*template,[\s\S]*\.\.\.state\.promptTemplates\.filter\(\(entry\) => entry\.id !== template\.id\),[\s\S]*\];/);
  assert.match(app, /writePromptTemplates\(\);[\s\S]*renderPromptTemplates\(\);/);
  assert.match(app, /savePromptAgentResultAsTemplate\(payload\.item\);/);
});

test("prompt image analysis compresses large browser uploads before posting to Vercel", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /PROMPT_ANALYSIS_IMAGE_MAX_EDGE = 1024/);
  assert.match(app, /PROMPT_ANALYSIS_IMAGE_COMPRESS_THRESHOLD_BYTES = 900 \* 1024/);
  assert.match(app, /async function preparePromptAnalysisImageFile\(file\) \{/);
  assert.match(app, /createImageBitmap\(file\)/);
  assert.match(app, /canvasToBlob\([\s\S]*"image\/jpeg"[\s\S]*PROMPT_ANALYSIS_IMAGE_JPEG_QUALITY/);
  assert.match(app, /new File\(\[blob\], makePromptAnalysisImageName\(file\.name\)/);
  assert.match(app, /formData\.set\("image", await preparePromptAnalysisImageFile\(state\.promptAgent\.file\)\);/);
  assert.match(app, /body: await buildPromptAgentFormData\(\),/);
});

test("reference orchestration analysis is a separate studio mode outside prompt generation", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const generateForm = html.match(/<form id="generateForm"[\s\S]*?<\/form>/)?.[0] || "";

  assert.doesNotMatch(generateForm, /id="referenceAnalyzeButton"|id="referenceAnalysisPanel"|reference-analysis-actions/);
  assert.match(html, /href="#reference-analysis"[\s\S]*融图分析/);
  assert.match(html, /data-view-panel="reference-analysis"/);
  assert.match(html, /id="referenceAnalysisDropzone"[\s\S]*id="referenceAnalysisGrid"/);
  assert.match(html, /id="referenceAnalysisGrid"[\s\S]*class="reference-analysis-actions"[\s\S]*class="reference-analysis-params"/);
  assert.match(html, /id="referenceAnalysisRatioGrid"[\s\S]*id="referenceAnalysisSizeInput"[\s\S]*id="referenceAnalysisGenerateButton"[\s\S]*id="referenceAnalysisAutoCollapseButton"/);
  assert.match(html, /id="referenceAnalysisAutoCollapseButton"[\s\S]*aria-pressed="true"/);
  assert.match(html, /id="referenceAnalyzeButton"[\s\S]*融图分析/);
  assert.match(html, /id="referenceAnalysisSelectedPromptPanel"[\s\S]*id="referenceAnalysisGenerationCanvas"[\s\S]*id="referenceAnalysisSelectedPrompt"/);
  assert.match(html, /id="referenceAnalysisCopyPromptButton"/);
  assert.match(html, /id="referenceAnalysisGenerationImage"/);
  assert.match(html, /id="referenceAnalysisGenerationDownloadButton"/);
  const selectedPromptBlock =
    html.match(/<div class="reference-analysis-selected hidden"[\s\S]*?<textarea id="referenceAnalysisSelectedPrompt"[\s\S]*?<\/textarea>\s*<\/div>/)?.[0] ||
    "";
  assert.doesNotMatch(selectedPromptBlock, /id="referenceAnalysisGenerateButton"/);
  assert.doesNotMatch(html, /id="referenceAnalyzeButton"[^>]*disabled/);
  assert.match(html, /id="referenceAnalysisPanel"[\s\S]*编排提示词/);
  assert.match(html, /id="referenceAnalysisList"/);
  const referenceAnalysisActionsBlock =
    html.match(/<div class="reference-analysis-actions">[\s\S]*?<div class="reference-analysis-panel/)?.[0] || "";
  const referenceAnalysisPanelHeadBlock =
    html.match(/<div class="reference-analysis-panel[\s\S]*?<div class="reference-analysis-list/)?.[0] || "";
  assert.match(referenceAnalysisActionsBlock, /id="referenceAnalysisToggleButton"/);
  assert.doesNotMatch(referenceAnalysisPanelHeadBlock, /id="referenceAnalysisToggleButton"/);
  assert.match(html, /aria-controls="referenceAnalysisHead referenceAnalysisList"/);
  assert.match(html, /id="referenceAnalysisToggleButton"[\s\S]*class="reference-analysis-toggle hidden"/);
  assert.match(styles, /\.reference-analysis-actions\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto;/);
  assert.match(styles, /\.reference-analysis-button\s*\{[\s\S]*width:\s*100%;/);
  assert.match(styles, /\.reference-analysis-panel\s*\{/);
  assert.match(styles, /\.reference-analysis-card\s*\{/);
  assert.match(styles, /\.reference-analysis-card p\s*\{[\s\S]*font-size:\s*var\(--type-body-size\);/);
  assert.match(styles, /\.reference-analysis-selected\s*\{/);
  assert.match(styles, /\.reference-analysis-generation\s*\{/);
  assert.match(styles, /\.reference-analysis-generation-canvas\s*\{/);
  assert.match(styles, /\.reference-analysis-generation-canvas\.has-image\s*\{[\s\S]*cursor:\s*zoom-in;/);
  assert.match(styles, /\.reference-analysis-generation-canvas\.has-image:focus-visible\s*\{/);
  assert.match(styles, /\.reference-analysis-generation-placeholder\.preview-placeholder-loading\s*\{/);
  assert.match(styles, /\.reference-analysis-auto-collapse\s*\{/);
  assert.match(styles, /\.reference-analysis-auto-collapse\.is-active\s*\{/);
  assert.match(styles, /\.reference-analysis-roles\s*\{/);
  assert.match(styles, /\.reference-analysis-role\s*\{[\s\S]*width:\s*auto;/);
  assert.match(styles, /\.reference-analysis-toggle\s*\{/);
  assert.match(styles, /\.reference-analysis-list\.hidden\s*\{/);
  assert.match(styles, /\.reference-analysis-view\s+\.reference-analysis-workspace\s*\{/);
  assert.match(styles, /\.reference-analysis-upload-panel\s*\{/);
  assert.match(styles, /\.reference-analysis-result-panel\s*\{[\s\S]*overflow-y:\s*auto;/);
  assert.match(styles, /\.reference-analysis-params\s*\{/);
  assert.match(styles, /\.reference-analysis-view\s+\.reference-grid\s*\{/);
  assert.match(app, /const CREATE_VIEW_IDS = new Set\(\["studio", "style-transfer", "reference-analysis", "creation", "ppt"\]\);/);
  assert.match(app, /referenceAnalysis:\s*\{/);
  assert.match(app, /files:\s*\[\]/);
  assert.match(app, /autoCollapseOnApply:\s*true/);
  assert.match(app, /collapsed:\s*false/);
  assert.match(app, /previewKey:\s*""/);
  assert.match(app, /selectedPrompt:\s*""/);
  assert.match(app, /referenceAnalysisDropzone:\s*document\.querySelector\("#referenceAnalysisDropzone"\),/);
  assert.match(app, /referenceAnalysisAutoCollapseButton:\s*document\.querySelector\("#referenceAnalysisAutoCollapseButton"\),/);
  assert.match(app, /referenceAnalysisGrid:\s*document\.querySelector\("#referenceAnalysisGrid"\),/);
  assert.match(app, /referenceAnalysisHead:\s*document\.querySelector\("#referenceAnalysisHead"\),/);
  assert.match(app, /referenceAnalysisRatioGrid:\s*document\.querySelector\("#referenceAnalysisRatioGrid"\),/);
  assert.match(app, /referenceAnalysisSizeInput:\s*document\.querySelector\("#referenceAnalysisSizeInput"\),/);
  assert.match(app, /referenceAnalysisSelectedPrompt:\s*document\.querySelector\("#referenceAnalysisSelectedPrompt"\),/);
  assert.match(app, /referenceAnalysisSelectedPromptPanel:\s*document\.querySelector\("#referenceAnalysisSelectedPromptPanel"\),/);
  assert.match(app, /referenceAnalysisCopyPromptButton:\s*document\.querySelector\("#referenceAnalysisCopyPromptButton"\),/);
  assert.match(app, /referenceAnalysisGenerateButton:\s*document\.querySelector\("#referenceAnalysisGenerateButton"\),/);
  assert.match(app, /referenceAnalysisGenerationCanvas:\s*document\.querySelector\("#referenceAnalysisGenerationCanvas"\),/);
  assert.match(app, /referenceAnalysisGenerationDownloadButton:\s*document\.querySelector\("#referenceAnalysisGenerationDownloadButton"\),/);
  assert.match(app, /referenceAnalysisGenerationImage:\s*document\.querySelector\("#referenceAnalysisGenerationImage"\),/);
  assert.match(app, /referenceAnalysisGenerationMeta:\s*document\.querySelector\("#referenceAnalysisGenerationMeta"\),/);
  assert.match(app, /referenceAnalysisGenerationPlaceholder:\s*document\.querySelector\("#referenceAnalysisGenerationPlaceholder"\),/);
  assert.match(app, /referenceAnalysisToggleButton:\s*document\.querySelector\("#referenceAnalysisToggleButton"\),/);
  assert.match(app, /function applyReferenceAnalysisFiles\(fileList\) \{/);
  assert.match(app, /function renderReferenceAnalysisGrid\(\) \{/);
  assert.match(app, /function createReferenceAnalysisJob\(\) \{/);
  assert.match(app, /function renderReferenceAnalysisGenerationPreview\(\) \{/);
  assert.match(app, /function openReferenceAnalysisGeneratedPreview\(\) \{[\s\S]*const item = getReferenceAnalysisGenerationPreviewItem\(\);[\s\S]*openLightbox\(item\);/);
  assert.match(app, /refs\.referenceAnalysisGenerationCanvas\.setAttribute\("role", "button"\);/);
  assert.match(app, /refs\.referenceAnalysisGenerationCanvas\.setAttribute\("aria-label", "查看融图分析生成图"\);/);
  assert.match(app, /refs\.referenceAnalysisGenerationCanvas\.addEventListener\("click", openReferenceAnalysisGeneratedPreview\);/);
  assert.match(app, /refs\.referenceAnalysisGenerationCanvas\.addEventListener\("keydown", \(event\) => \{[\s\S]*event\.key === "Enter"[\s\S]*event\.key === " "[\s\S]*openReferenceAnalysisGeneratedPreview\(\);/);
  assert.match(app, /function renderReferenceAnalysisGenerationLoading\(item\) \{/);
  assert.match(app, /let referenceAnalysisLoadingShellNodes = null;/);
  assert.match(
    app,
    /renderReferenceAnalysisGenerationLoading\(item\)[\s\S]*createPreviewLoadingShellNodes\(\)[\s\S]*updatePreviewLoadingShell\(referenceAnalysisLoadingShellNodes, placeholderState\)/,
  );
  assert.match(app, /title:\s*"提示词模式生成中"/);
  assert.match(app, /function renderReferenceAnalysisSelectedPrompt\(\) \{/);
  assert.match(app, /function renderReferenceAnalysisRatioGrid\(\) \{/);
  assert.match(app, /function renderReferenceAnalysisSizeOptions\(\) \{/);
  assert.match(app, /function syncGenerationRatio\(value\) \{/);
  assert.match(app, /function syncGenerationSize\(value\) \{/);
  assert.match(app, /function toggleReferenceAnalysisPanel\(\) \{/);
  assert.match(app, /function toggleReferenceAnalysisAutoCollapse\(\) \{/);
  assert.match(app, /refs\.referenceAnalysisList\.classList\.toggle\("hidden", state\.referenceAnalysis\.collapsed\);/);
  assert.match(app, /refs\.referenceAnalysisHead\.classList\.toggle\("hidden", state\.referenceAnalysis\.collapsed\);/);
  assert.match(app, /refs\.referenceAnalysisAutoCollapseButton\.classList\.toggle\("is-active", state\.referenceAnalysis\.autoCollapseOnApply\);/);
  assert.match(app, /refs\.referenceAnalysisAutoCollapseButton\.setAttribute\("aria-pressed", String\(state\.referenceAnalysis\.autoCollapseOnApply\)\);/);
  assert.match(app, /refs\.referenceAnalysisToggleButton\.textContent = state\.referenceAnalysis\.collapsed \? "展开提示词" : "折叠提示词";/);
  assert.match(app, /roleGroup\.className = "reference-analysis-roles";/);
  assert.match(app, /async function buildReferenceAnalysisFormData\(\) \{/);
  assert.match(app, /formData\.set\("mode", "reference-orchestration"\);/);
  assert.match(app, /state\.referenceAnalysis\.files\.map\(\(item\) => preparePromptAnalysisImageFile\(item\.file\)\)/);
  assert.match(app, /formData\.append\("image", file\);/);
  assert.match(app, /appendBrowserConfigToFormData\(formData\);/);
  assert.match(app, /body: await buildReferenceAnalysisFormData\(\),/);
  assert.match(app, /fetch\("\/api\/prompt-agent\/analyze"/);
  assert.match(app, /button\.dataset\.referenceAnalysisPromptIndex = String\(index\);/);
  assert.match(app, /function applyReferenceAnalysisPrompt\(index\) \{/);
  assert.match(app, /async function startReferenceAnalysisGeneration\(\) \{/);
  assert.match(app, /if \(job\.mode === "reference-analysis"\) \{[\s\S]*state\.referenceAnalysis\.previewKey = makeGalleryPreviewKey\(payload\.item\.filename\);/);
  const referenceApplyBody =
    app.match(/function applyReferenceAnalysisPrompt\(index\) \{[\s\S]*?\r?\n\}\r?\n\r?\nfunction mapPromptAgentPrompt/)?.[0] || "";
  assert.match(referenceApplyBody, /state\.referenceAnalysis\.selectedPrompt = promptText;/);
  assert.match(referenceApplyBody, /if \(state\.referenceAnalysis\.autoCollapseOnApply\) \{[\s\S]*state\.referenceAnalysis\.collapsed = true;/);
  assert.match(referenceApplyBody, /renderReferenceAnalysis\(\);/);
  assert.doesNotMatch(referenceApplyBody, /refs\.promptInput\.value|setActiveView\("studio"\)|refs\.promptInput\.focus/);
  assert.match(app, /refs\.referenceAnalyzeButton\.disabled = state\.referenceAnalysis\.running;/);
  assert.match(app, /refs\.referenceAnalyzeButton\.textContent = state\.referenceAnalysis\.running \? "分析中\.\.\." : "融图分析";/);
  assert.match(app, /refs\.referenceAnalysisToggleButton\.addEventListener\("click", toggleReferenceAnalysisPanel\);/);
  assert.match(app, /refs\.referenceAnalysisAutoCollapseButton\.addEventListener\("click", toggleReferenceAnalysisAutoCollapse\);/);
  assert.match(app, /refs\.referenceAnalysisGenerateButton\.addEventListener\("click", \(\) => \{[\s\S]*startReferenceAnalysisGeneration\(\)\.catch/);
  assert.match(app, /setReferenceAnalysisFeedback\("图形分析需要上传参考图。", "error"\);/);
  assert.match(app, /refs\.referenceAnalysisDropzone\.addEventListener\("dragover",[\s\S]*event\.preventDefault\(\);[\s\S]*classList\.add\("dragover"\);/);
  assert.match(app, /refs\.referenceAnalysisDropzone\.addEventListener\("drop",[\s\S]*event\.preventDefault\(\);[\s\S]*applyReferenceAnalysisFiles\(event\.dataTransfer\?\.files\);/);
  assert.match(app, /refs\.referenceAnalysisSizeInput\.addEventListener\("change",[\s\S]*syncGenerationSize\(event\.target\.value\);/);
  assert.match(app, /refs\.referenceAnalysisCopyPromptButton\.addEventListener\("click",[\s\S]*copyReferenceAnalysisSelectedPrompt\(\)\.catch/);
});

test("direct prompt applications keep reference analysis independent", async () => {
  const app = await readFile(appPath, "utf8");
  const referenceApplyBody =
    app.match(/function applyReferenceAnalysisPrompt\(index\) \{[\s\S]*?\r?\n\}\r?\n\r?\nfunction mapPromptAgentPrompt/)?.[0] || "";

  assert.match(app, /function applyPromptTemplate\(templateId = ""\) \{[\s\S]*refs\.promptInput\.value = prompt;[\s\S]*updatePromptCounter\(\);/);
  assert.match(referenceApplyBody, /state\.referenceAnalysis\.selectedPrompt = promptText;[\s\S]*if \(state\.referenceAnalysis\.autoCollapseOnApply\) \{[\s\S]*state\.referenceAnalysis\.collapsed = true;[\s\S]*renderReferenceAnalysis\(\);/);
  assert.doesNotMatch(referenceApplyBody, /refs\.promptInput\.value|updatePromptCounter\(\)|setActiveView\("studio"\)|refs\.promptInput\.focus/);
  assert.doesNotMatch(referenceApplyBody, /currentPrompt|includes\(promptText\)|`\\$\\{currentPrompt\\}\\n\\n\\$\\{promptText\\}`/);
  assert.match(app, /function mapPromptAgentPrompt\(itemId\) \{[\s\S]*refs\.promptInput\.value = promptText;[\s\S]*updatePromptCounter\(\);/);
});

test("studio error surfaces compact long upstream HTTP failures before rendering", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /function compactErrorMessage\(message, fallbackLabel = "请求失败"\)/);
  assert.match(app, /refs\.errorBanner\.textContent = compactErrorMessage\(message\);/);
  assert.match(app, /compactErrorMessage\(message, "生成请求失败"\)/);
  assert.match(app, /compactErrorMessage\(message, "图片分析请求失败"\)/);
  assert.match(app, /"error_code"\\s\*:\\s\*"\?\(\[A-Za-z0-9_\.-\]\+\)"\?/);
});

test("studio layout consumes density variables for wide-screen adaptation without changing structure", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(styles, /\.app-shell\s*\{[\s\S]*min\(var\(--app-shell-max-width,\s*1680px\),\s*calc\(100vw - 20px\)\);[\s\S]*padding:\s*var\(--app-shell-padding-top,\s*8px\)\s*0\s*var\(--app-shell-padding-bottom,\s*10px\);/);
  assert.match(styles, /\.topbar\s*\{[\s\S]*gap:\s*var\(--topbar-gap,\s*18px\);[\s\S]*padding:\s*var\(--topbar-padding,\s*6px 10px 14px\);/);
  assert.match(styles, /\.view-root\s*\{[\s\S]*min-height:\s*calc\(100svh - var\(--view-root-offset,\s*88px\)\);[\s\S]*height:\s*calc\(100svh - var\(--view-root-offset,\s*88px\)\);/);
  assert.match(styles, /\.studio-grid\s*\{[\s\S]*grid-template-columns:\s*var\(--studio-grid-left,\s*392px\)\s*minmax\(0,\s*1fr\)\s*var\(--studio-grid-right,\s*328px\);[\s\S]*gap:\s*var\(--studio-grid-gap,\s*14px\);/);
  assert.match(styles, /\.studio-panel,\s*[\r\n]+\s*\.drawer-panel,\s*[\r\n]+\s*\.lightbox-dialog\s*\{[\s\S]*padding:\s*var\(--panel-padding,\s*12px\);/);
  assert.match(styles, /\.settings-form\s*\{[\s\S]*gap:\s*calc\(var\(--field-gap,\s*6px\) \+ 6px\);/);
  assert.match(styles, /textarea,\s*[\r\n]+\s*input,\s*[\r\n]+\s*select\s*\{[\s\S]*padding:\s*var\(--input-padding-y,\s*10px\)\s*var\(--input-padding-x,\s*12px\);/);
  assert.match(styles, /textarea\s*\{[\s\S]*min-height:\s*var\(--textarea-min-height,\s*96px\);/);
  assert.match(styles, /\.ratio-chip\s*\{[\s\S]*min-height:\s*var\(--ratio-chip-height,\s*48px\);/);
  assert.match(styles, /\.reference-dropzone\s*\{[\s\S]*min-height:\s*var\(--reference-dropzone-min-height,\s*140px\);/);
  assert.match(styles, /\.generate-button\s*\{[\s\S]*min-height:\s*var\(--generate-button-height,\s*42px\);/);
  assert.match(styles, /\.timeline-item\s*\{[\s\S]*padding:\s*var\(--timeline-item-padding-y,\s*8px\)\s*0;/);
  assert.match(styles, /\.recent-item\s*\{[\s\S]*padding:\s*var\(--recent-item-padding,\s*8px\);[\s\S]*grid-template-columns:\s*var\(--recent-thumb-size,\s*60px\)\s*minmax\(0,\s*1fr\)\s*auto;/);
  assert.match(styles, /\.recent-item img\s*\{[\s\S]*width:\s*var\(--recent-thumb-size,\s*60px\);[\s\S]*height:\s*var\(--recent-thumb-size,\s*60px\);/);
  assert.match(app, /document\.documentElement\.dataset\.uiLayout = layoutMode;/);
  assert.match(styles, /html\[data-ui-layout="stacked"\] \.studio-grid,/);
  assert.match(styles, /html\[data-ui-layout="narrow-desktop"\] \.studio-grid\s*\{/);
});

test("image upload zones collapse into compact thumbnail grids after files are present", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(styles, /\.reference-dropzone\.is-compact-hidden\s*\{[\s\S]*position:\s*absolute;[\s\S]*clip-path:\s*inset\(50%\);/);
  assert.match(styles, /\.reference-add-card\s*\{/);
  assert.match(styles, /\.reference-add-button\s*\{/);
  assert.match(styles, /\.studio-view\[data-studio-mode="style-transfer"\] \.style-transfer-slot:has\(\.style-transfer-dropzone\.is-compact-hidden\)\s*\{[\s\S]*grid-template-rows:\s*minmax\(64px,\s*auto\)\s*minmax\(132px,\s*auto\);/);

  assert.match(app, /function syncReferenceDropzoneCompact\(dropzone, hasFiles\) \{/);
  assert.match(app, /function createReferenceAddCard\(\{ input, label, onFiles \}\) \{/);
  assert.match(app, /syncReferenceDropzoneCompact\(refs\.referenceDropzone, state\.referenceFiles\.length > 0\);/);
  assert.match(app, /syncReferenceDropzoneCompact\(refs\.referenceAnalysisDropzone, state\.referenceAnalysis\.files\.length > 0\);/);
  assert.match(app, /syncReferenceDropzoneCompact\(refs\.creationReferenceDropzone, state\.creationReferenceFiles\.length > 0\);/);
  assert.match(app, /syncReferenceDropzoneCompact\(refs\.styleTransferSourceDropzone, Boolean\(getStyleTransferReferenceItem\("source"\)\)\);/);
  assert.match(app, /syncReferenceDropzoneCompact\(refs\.styleTransferStyleDropzone, Boolean\(getStyleTransferReferenceItem\("style"\)\)\);/);

  assert.match(app, /refs\.referenceGrid\.appendChild\(\s*createReferenceAddCard\(\{[\s\S]*input:\s*refs\.referenceInput,[\s\S]*onFiles:\s*applyReferenceFiles/);
  assert.match(app, /refs\.referenceAnalysisGrid\.appendChild\(\s*createReferenceAddCard\(\{[\s\S]*input:\s*refs\.referenceAnalysisInput,[\s\S]*onFiles:\s*applyReferenceAnalysisFiles/);
  assert.match(app, /refs\.creationReferenceGrid\.appendChild\(\s*createReferenceAddCard\(\{[\s\S]*input:\s*refs\.creationReferenceInput,[\s\S]*onFiles:\s*applyCreationReferenceFiles/);
  assert.doesNotMatch(app, /styleTransferSourceGrid\.appendChild\(\s*createReferenceAddCard/);
  assert.doesNotMatch(app, /styleTransferStyleGrid\.appendChild\(\s*createReferenceAddCard/);
});

test("studio entry defaults to square ratio", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /<input id="ratioInput" name="ratio" type="hidden" value="1:1" \/>/);
  assert.match(app, /const DEFAULT_UI_RATIO = "1:1";/);
  assert.doesNotMatch(app, /\|\| "4:5"/);
});

test("mobile and Pad studio layout keeps panels inside the viewport column", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(styles, /html,\s*[\r\n]+body\s*\{[\s\S]*overflow-x:\s*clip;/);
  assert.match(
    styles,
    /html\[data-ui-layout="stacked"\] \.studio-grid,\s*[\r\n]+html\[data-ui-layout="tablet"\] \.studio-grid,\s*[\r\n]+html\[data-ui-layout="mobile"\] \.studio-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
  );
  assert.match(
    styles,
    /html\[data-ui-layout="tablet"\] \.settings-panel,[\s\S]*html\[data-ui-layout="mobile"\] \.settings-form\s*\{[\s\S]*min-width:\s*0;[\s\S]*max-width:\s*100%;/,
  );
  assert.match(styles, /html\[data-ui-layout="tablet"\] \.app-shell,\s*[\r\n]+html\[data-ui-layout="mobile"\] \.app-shell\s*\{[\s\S]*width:\s*min\(calc\(100% - 12px\),\s*1680px\);/);
});

test("studio columns use synchronized desktop height so wide screens do not leave a dead zone under the workspace", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const studioGridBlock = styles.match(/\.studio-view \.studio-grid\s*\{[\s\S]*?\}/)?.[0] || "";

  assert.match(styles, /\.settings-panel\s*\{[\s\S]*height:\s*var\(--studio-column-height,\s*auto\);/);
  assert.match(styles, /\.preview-panel\s*\{[\s\S]*height:\s*var\(--studio-column-height,\s*auto\);/);
  assert.match(styles, /\.side-column\s*\{[\s\S]*height:\s*var\(--studio-column-height,\s*auto\);/);
  assert.match(studioGridBlock, /min-height:\s*0;/);
  assert.match(studioGridBlock, /height:\s*100%;/);
  assert.doesNotMatch(studioGridBlock, /calc\(100% - 48px\)/);
  assert.match(
    app,
    /const viewRootRect = refs\.viewRoot\.getBoundingClientRect\(\);[\s\S]*const availableHeight = Math\.max\(600,\s*Math\.floor\(window\.innerHeight - viewRootRect\.top - 12\)\);[\s\S]*const resolvedHeight = availableHeight;/,
  );
});

test("generation task refresh tolerates older servers without the task endpoint", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /if \(response\.status === 404\) \{[\s\S]*applyGenerationTaskSnapshots\(\[\], \{ render \}\);[\s\S]*return;/);
  assert.match(app, /throw new Error\("读取生成任务失败"\);/);
});

test("studio stores API settings in the browser and sends them with cloud generation requests", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="configFeedback"[\s\S]*API Key 只保存在当前浏览器/);
  assert.match(app, /const BROWSER_CONFIG_STORAGE_KEY = "image-studio-browser-config-v1";/);
  assert.match(app, /function readBrowserPrivateConfig\(\) \{/);
  assert.match(app, /function appendBrowserConfigToFormData\(formData\) \{/);
  assert.match(app, /function getBrowserPrivateConfigRequestPayload\(\) \{/);
  assert.match(app, /window\.localStorage\.setItem\(BROWSER_CONFIG_STORAGE_KEY, JSON\.stringify/);
  assert.match(app, /formData\.set\("baseUrl", browserConfig\.baseUrl\);/);
  assert.match(app, /formData\.set\("apiKey", browserConfig\.apiKey\);/);
  assert.match(app, /formData\.set\("responsesModel", browserConfig\.responsesModel\);/);
  assert.match(app, /function buildPptFormData\(\) \{[\s\S]*appendBrowserConfigToFormData\(formData\);[\s\S]*return formData;/);
  assert.match(app, /function buildPptCompletionRequest\(slideNumbers\) \{[\s\S]*\.\.\.getBrowserPrivateConfigRequestPayload\(\),/);
});

test("studio caches generated browser images for persistent preview and download", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /\/app\.js\?v=20260508-reference-remove-hover-1/);
  assert.match(app, /const BROWSER_IMAGE_CACHE_INDEX_KEY = "image-studio-browser-image-cache-index-v1";/);
  assert.match(app, /function openBrowserImageCacheDB\(\) \{/);
  assert.match(app, /function isServerImageProxyUrl\(url\) \{/);
  assert.match(app, /async function fetchServerImageAsDataUrl\(imageUrl\) \{/);
  assert.match(app, /async function cacheBrowserGalleryItem\(item\) \{/);
  assert.match(app, /await fetchServerImageAsDataUrl\(imageUrl\)/);
  assert.match(app, /if \(eventName === "final_image_chunk"\) \{[\s\S]*await cacheBrowserGalleryItem\(\{\s*filename: payload\.filename,[\s\S]*imageUrl: dataUrl,[\s\S]*thumbnailUrl: dataUrl,[\s\S]*\}\);/);
  assert.match(app, /function attachChunkedImageToSavedItem\(item, finalImageChunks, fallbackDataUrl = ""\) \{/);
  assert.match(app, /const dataUrl = entry\?\.dataUrl \|\| \(isCacheableBrowserImageUrl\(fallbackDataUrl\) \? fallbackDataUrl : ""\);/);
  assert.match(app, /let finalImageDataUrl = "";/);
  assert.match(app, /if \(eventName === "final_image"\) \{[\s\S]*finalImageDataUrl = isCacheableBrowserImageUrl\(payload\.dataUrl\) \? payload\.dataUrl : "";/);
  assert.match(app, /if \(dataUrl\) \{[\s\S]*finalImageDataUrl = dataUrl;[\s\S]*handleActivityFinal\(job\.id\);/);
  assert.match(
    app,
    /payload\.item = attachChunkedImageToSavedItem\(payload\.item, finalImageChunks, finalImageDataUrl \|\| job\.previewUrl\);/,
  );
  assert.match(app, /const cachedImageUrl = isCacheableBrowserImageUrl\(cachedItem\?\.imageUrl\) \? cachedItem\.imageUrl : "";/);
  assert.match(app, /imageUrl: cachedImageUrl \|\| item\.imageUrl \|\| cachedItem\?\.imageUrl \|\| "",/);
  assert.match(
    app,
    /thumbnailUrl: cachedThumbnailUrl \|\| item\.thumbnailUrl \|\| cachedItem\?\.thumbnailUrl \|\| cachedImageUrl \|\| "",/,
  );
  assert.match(app, /function mergeGalleryItemWithExistingBrowserImage\(item\) \{/);
  assert.match(app, /const imageMergedItem = mergeGalleryItemWithExistingBrowserImage\(item\);/);
  assert.match(app, /const hydratedItem = mergeGalleryItemWithCachedMetadata\(imageMergedItem, state\.galleryMetadataCache\[item\?\.filename\]\);/);
  assert.match(app, /async function readBrowserCachedGalleryItems\(\) \{/);
  assert.match(app, /function upsertGalleryItem\(item\) \{[\s\S]*void cacheBrowserGalleryItem\(hydratedItem\);/);
  assert.match(app, /async function loadGallery\(\) \{[\s\S]*const browserCachedItems = await readBrowserCachedGalleryItems\(\);[\s\S]*state\.gallery = sortGalleryItemsByCreatedAtDesc/);
  assert.match(app, /async function deleteGalleryItem\(item\) \{[\s\S]*await deleteBrowserCachedGalleryItem\(item\.filename\);/);
  assert.match(app, /async function clearHistory\(\) \{[\s\S]*await clearBrowserImageCache\(\);/);
  assert.match(app, /function dataUrlToBlob\(dataUrl\) \{/);
  assert.match(app, /function imageElementToBlob\(imageElement\) \{/);
  assert.match(app, /async function resolveDownloadImageBlob\(item, imageElement\) \{/);
  assert.match(app, /const renderedBlob = await imageElementToBlob\(imageElement\);[\s\S]*if \(renderedBlob\) \{[\s\S]*return renderedBlob;/);
  assert.match(app, /function triggerBrowserImageDownload\(blob, filename\) \{/);
  assert.match(app, /window\.setTimeout\(\(\) => URL\.revokeObjectURL\(objectUrl\), 1000\);/);
  assert.match(app, /async function downloadGalleryItem\(item, imageElement\) \{/);
  assert.match(app, /refs\.previewDownloadButton\.addEventListener\("click", \(event\) => \{[\s\S]*downloadGalleryItem\(item, refs\.previewImage\)/);
  assert.match(app, /refs\.lightboxDownload\.addEventListener\("click", \(event\) => \{[\s\S]*downloadGalleryItem\(state\.lightboxItem, refs\.lightboxImage\)/);
  assert.match(app, /download\.addEventListener\("click", \(event\) => \{[\s\S]*downloadGalleryItem\(item, image\)/);
});

test("studio accepts server-stored Cloudflare image URLs before browser caching finishes", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /if \(isServerImageProxyUrl\(imageUrl\)\) \{/);
  assert.match(app, /const serverImageUrl = getServerImageUrl\(item\);/);
  assert.match(app, /writeIndex\(\);[\s\S]*const dataUrl = hasDataUrl \? imageUrl : await fetchServerImageAsDataUrl\(imageUrl\);/);
  assert.match(app, /const fallbackImageUrl = isServerImageProxyUrl\(entry\.imageUrl\) \? entry\.imageUrl : "";/);
  assert.match(
    app,
    /payload\.item = attachChunkedImageToSavedItem\(payload\.item, finalImageChunks, finalImageDataUrl \|\| job\.previewUrl\);/,
  );
  assert.match(app, /function applyServerImageToGalleryItem\(item\) \{/);
  assert.match(app, /const browserImageUrl = isCacheableBrowserImageUrl\(current\.imageUrl\)[\s\S]*\? current\.imageUrl[\s\S]*: isCacheableBrowserImageUrl\(current\.thumbnailUrl\)[\s\S]*\? current\.thumbnailUrl[\s\S]*: "";/);
  assert.match(app, /imageUrl: browserImageUrl \|\| serverImageUrl,/);
  assert.match(app, /if \(eventName === "server_image"\) \{[\s\S]*applyServerImageToGalleryItem\(payload\.item\);[\s\S]*renderAll\(\);[\s\S]*return;/);
  assert.match(app, /upsertGalleryItem\(payload\.item\);/);
});

test("studio keeps queued Cloudflare jobs alive for task polling after the SSE response closes", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /let queuedForPolling = false;/);
  assert.match(app, /if \(eventName === "queued"\) \{/);
  assert.match(app, /scheduleGenerationTaskPolling\(\);/);
  assert.match(app, /currentJob\.isRunning = queuedForPolling;/);
  assert.match(app, /生成连接已中断，未收到完成事件/);
});

test("studio marks persisted active generation records as interrupted on reload", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /function normalizePersistedActivityEntry\(entry\) \{/);
  assert.match(app, /if \(normalized\.status === "active"\) \{/);
  assert.match(app, /title: GENERATION_TASK_STATUS_LABELS\.error,/);
  assert.match(app, /detail: "上次页面关闭前生成未完成，请重新生成",/);
  assert.match(app, /const entries = Array\.isArray\(parsed\) \? parsed\.map\(normalizePersistedActivityEntry\)\.filter\(Boolean\) : \[\];/);
  assert.match(app, /return sortGenerationActivityFeed\(entries\)\.slice\(0, 12\);/);
});

test("studio keeps local port retry exhaustion out of the visible error feed", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /isGenerationRequestRetryMessage,/);
  assert.match(app, /if \(isGenerationRequestRetryMessage\(detail\)\) \{[\s\S]*return null;/);
  assert.match(app, /if \(retryPlan\.retryable && !retryPlan\.shouldSurfaceError\) \{[\s\S]*return null;/);
  assert.match(app, /if \(!response\) \{[\s\S]*removeJob\(job\.id\);[\s\S]*return;/);
  assert.doesNotMatch(app, /throw new Error\(retryPlan\.message\)/);
});

test("prompt template list shows titles only and uses title clicks to apply prompts", async () => {
  const app = await readFile(appPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.match(app, /className = "prompt-template-title-button"/);
  assert.match(app, /applyPromptTemplate\(template\.id\)/);
  assert.match(app, /editPromptTemplate\(template\.id\)/);
  assert.match(app, /deletePromptTemplate\(template\.id\)/);
  assert.doesNotMatch(app, /prompt\.textContent = template\.prompt/);
  assert.match(styles, /\.prompt-template-title-button\s*\{[\s\S]*white-space:\s*nowrap;/);
  assert.match(styles, /\.prompt-template-row-actions\s*\{[\s\S]*display:\s*flex;/);
  assert.match(styles, /\.prompt-template-row-actions \.mini-action\s*\{[\s\S]*width:\s*auto;[\s\S]*height:\s*24px;[\s\S]*white-space:\s*nowrap;/);
});

test("prompt template storage respects an intentionally empty saved list", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /if \(raw === null\) \{[\s\S]*return DEFAULT_PROMPT_TEMPLATES\.map/);
  assert.match(app, /return Array\.isArray\(parsed\) \? parsed\.map\(normalizePromptTemplate\)\.filter\(Boolean\) : \[\];/);
});

test("default prompt templates cover ten daily life scenes", async () => {
  const app = await readFile(appPath, "utf8");
  const block = app.match(/const SURPRISE_PROMPTS = \[[\s\S]*?\];/)?.[0] || "";
  const names = [...block.matchAll(/name: "([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(names, [
    "清晨通勤",
    "家庭早餐",
    "居家阅读",
    "厨房做饭",
    "超市采购",
    "午后办公",
    "健身运动",
    "朋友聚会",
    "亲子手作",
    "夜晚学习",
  ]);
  assert.match(app, /const PROMPT_TEMPLATE_STORAGE_KEY = "image-studio-prompt-templates-v2";/);
  assert.doesNotMatch(block, /直播带货|国风服饰|数码产品/);
});

test("PPT view exposes source options, page count, progress, retry and PPTX download controls", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.doesNotMatch(html, /data-view-tab="ppt"/);
  assert.match(html, /data-nav-section="create"[\s\S]*href="#ppt"[\s\S]*PPT生成/);
  assert.match(html, /data-view-panel="ppt"/);
  assert.match(html, /id="pptSourceModeUpload"[\s\S]*上传文档/);
  assert.match(html, /id="pptSourceModeText"[\s\S]*输入文本/);
  assert.match(html, /id="pptSourceModeTopic"[\s\S]*输入主题/);
  assert.match(html, /id="pptSourceInput"[\s\S]*sourceFiles/);
  assert.match(html, /id="pptSourceTextInput"[\s\S]*sourceText/);
  assert.match(html, /id="pptTopicInput"[\s\S]*topic/);
  assert.match(html, /id="pptPageCountInput"[\s\S]*pageCount/);
  assert.match(html, /id="pptCompletionRatio"/);
  assert.match(html, /id="pptCompleteMissingButton"[\s\S]*补齐缺页/);
  assert.match(html, /id="pptDownloadLink"[\s\S]*下载 PPTX/);

  assert.match(styles, /\.ppt-workspace\s*\{/);
  assert.match(styles, /\.ppt-source-options\s*\{/);
  assert.match(styles, /\.ppt-output-actions\s*\{/);
  assert.match(styles, /\.ppt-slide-retry-button\s*\{/);

  assert.match(app, /ppt:\s*\{/);
  assert.match(app, /fetch\("\/api\/ppt\/generate"/);
  assert.match(app, /fetch\("\/api\/ppt\/complete"/);
  assert.match(app, /function getPptCompletionStats\(\)/);
  assert.match(app, /function getPptMissingSlideNumbers\(\)/);
  assert.match(app, /function retryPptSlide\(slideNumber\)/);
  assert.match(app, /function completeMissingPptSlides\(\)/);
  assert.match(app, /data-ppt-retry-slide/);
  assert.match(app, /refs\.pptCompleteMissingButton\.addEventListener\("click", completeMissingPptSlides\)/);
  assert.match(app, /eventName === "slide_failed"/);
});

test("studio compact panels omit repeated helper copy", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.doesNotMatch(
    html,
    /Reference（可选，最多 6 张）|支持 JPG \/ PNG|Style Transfer|保留主体、元素和构图|只复刻画风和视觉语言|<small>Prompt<\/small>|<small>Parameters<\/small>|Output Preview|Live Feed|Reference Orchestration|Ratio \/ Size|Prompt Candidates|Deck History|电商套图生成记录和 creation 文件夹历史|生成记录和文件夹历史|点击提示词可映射到 Studio 文本框|单商品可生成|只影响套图模式|支持拖入多张图片|上传文档、输入文本或主题|三选一或组合使用|源文档只用于本次解析|渐进披露会|生成后会在这里显示大纲/,
  );
  assert.doesNotMatch(
    app,
    /填写商品信息后会自动生成|填写商品信息后自动生成|生成后会在这里显示大纲|CREATION_SCENARIO_HINTS|CREATION_INDUSTRY_TEMPLATE_HINTS|creation-card-prompt|creation-card-brief/,
  );
});

test("creation mode is a separate studio view with isolated state and routes", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const creationPanel = html.match(/data-view-panel="creation"[\s\S]*?(?=<section class="view-panel ppt-view)/)?.[0] || "";

  assert.doesNotMatch(html, /<nav class="studio-mode-tabs"/);
  assert.doesNotMatch(html, /data-studio-mode-tab/);
  assert.match(html, /data-view-panel="creation"/);
  assert.match(html, /id="creationForm"/);
  assert.match(html, /id="creationTargetLanguageInput"/);
  assert.match(html, /id="creationGenerateButton"/);
  assert.match(html, /id="creationPlanButton"/);
  assert.doesNotMatch(html, /id="creationPlanMeta"/);
  assert.doesNotMatch(creationPanel, /id="creationSetList"|id="creationHistoryCount"|creation-history-block/);

  assert.doesNotMatch(styles, /\.studio-mode-tabs\s*\{/);
  assert.match(styles, /\.creation-workspace\s*\{/);
  assert.match(styles, /\.creation-result-grid\s*\{/);
  assert.match(styles, /\.creation-plan-actions\s*\{/);

  assert.match(app, /creation:\s*\{/);
  assert.match(app, /planning:\s*false/);
  assert.match(app, /if \(window\.location\.hash === "#creation"\)/);
  assert.match(app, /view === "creation" \? "#creation"/);
  assert.match(app, /fetch\("\/api\/creation\/plan"/);
  assert.match(app, /fetch\("\/api\/creation\/generate"/);
  assert.match(app, /fetch\("\/api\/creation\/sets"/);
  assert.match(app, /creationPlanButton: document\.querySelector\("#creationPlanButton"\)/);
  assert.doesNotMatch(app, /creationPlanMeta: document\.querySelector\("#creationPlanMeta"\)/);
  assert.match(app, /creationProductNameInput: document\.querySelector\("#creationProductNameInput"\)/);
  assert.doesNotMatch(app, /creation[\s\S]{0,400}PROMPT_TEMPLATE_STORAGE_KEY/);
});

test("creation mode has independent references count and scenario controls", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="creationReferenceDropzone"/);
  assert.match(html, /id="creationReferenceInput"[\s\S]*name="creationReferenceImages"/);
  assert.match(html, /id="creationReferenceGrid"/);
  assert.match(html, /id="creationReferenceAnalyzeButton"[\s\S]*智能识别/);
  assert.match(html, /id="creationReferenceApplyAnalysisButton"[\s\S]*应用建议/);
  assert.match(html, /id="creationReferenceAnalysisFeedback"/);
  assert.match(html, /id="creationReferenceAnalysisPanel"/);
  assert.match(html, /id="creationReferenceAnalysisList"/);
  assert.match(html, /id="creationImageCountInput"[\s\S]*<option value="8">8/);
  assert.match(html, /id="creationImageCountInput"[\s\S]*<option value="12">12/);
  assert.match(html, /id="creationScenarioInput"[\s\S]*value="social-seeding"/);
  assert.match(html, /id="creationScenarioInput"[\s\S]*value="livestream"/);
  assert.match(html, /id="creationScenarioInput"[\s\S]*value="gift-guide"/);
  assert.match(html, /id="creationIndustryTemplateInput"[\s\S]*value="apparel"/);
  assert.match(html, /id="creationIndustryTemplateInput"[\s\S]*value="beauty"/);
  assert.match(html, /id="creationIndustryTemplateInput"[\s\S]*value="food"/);
  assert.match(html, /id="creationIndustryTemplateInput"[\s\S]*value="electronics"/);
  assert.match(html, /id="creationIndustryTemplateInput"[\s\S]*value="home"/);
  assert.match(html, /<div class="creation-control-row creation-option-grid">[\s\S]*id="creationImageCountInput"[\s\S]*id="creationScenarioInput"[\s\S]*id="creationIndustryTemplateInput"[\s\S]*id="creationTargetLanguageInput"[\s\S]*id="creationOutputFormatInput"[\s\S]*id="creationRatioInput"[\s\S]*id="creationSizeInput"/);
  assert.match(html, /<select id="creationRatioInput" name="ratio">[\s\S]*<option value="1:1">1:1<\/option>[\s\S]*<\/select>/);
  assert.match(html, /<select id="creationSizeInput" name="size">[\s\S]*<option value="auto">自动<\/option>[\s\S]*<\/select>/);
  assert.doesNotMatch(html, /id="creationScenarioHint"/);
  assert.match(html, /id="creationRolePicker"/);
  assert.match(html, /id="creationRoleGrid"/);
  assert.match(html, /id="creationRoleCount"/);
  assert.doesNotMatch(html, /id="creationRoleHint"/);

  assert.match(styles, /\.creation-reference-grid\s*\{/);
  assert.match(styles, /\.creation-reference-role\s*\{/);
  assert.match(styles, /\.creation-reference-analysis-panel\s*\{/);
  assert.match(styles, /\.creation-reference-note\s*\{/);
  assert.match(styles, /\.creation-option-grid\s*\{\s*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.creation-option-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\);/);
  assert.match(styles, /\.creation-role-picker\s*\{/);
  assert.match(styles, /\.creation-role-grid\s*\{/);
  assert.match(styles, /\.creation-role-option\s*\{/);
  assert.doesNotMatch(styles, /\.creation-scenario-hint\s*\{/);
  assert.doesNotMatch(styles, /\.creation-card-brief\s*\{/);

  assert.match(app, /creationReferenceFiles:\s*\[\]/);
  assert.match(app, /creationReferenceAnalysis:\s*\{/);
  assert.match(app, /creationReferenceAnalyzeButton: document\.querySelector\("#creationReferenceAnalyzeButton"\)/);
  assert.match(app, /creationReferenceApplyAnalysisButton: document\.querySelector\("#creationReferenceApplyAnalysisButton"\)/);
  assert.match(app, /creationReferenceAnalysisList: document\.querySelector\("#creationReferenceAnalysisList"\)/);
  assert.match(app, /creationReferenceAnalysisPanel: document\.querySelector\("#creationReferenceAnalysisPanel"\)/);
  assert.match(app, /creationReferenceInput: document\.querySelector\("#creationReferenceInput"\)/);
  assert.match(app, /creationRoleGrid: document\.querySelector\("#creationRoleGrid"\)/);
  assert.match(app, /creationRoleCount: document\.querySelector\("#creationRoleCount"\)/);
  assert.doesNotMatch(app, /creationScenarioHint: document\.querySelector\("#creationScenarioHint"\)/);
  assert.doesNotMatch(app, /creationRoleHint: document\.querySelector\("#creationRoleHint"\)/);
  assert.match(app, /creationSelectedRoles:\s*\[\]/);
  assert.match(app, /const CREATION_REFERENCE_ROLE_OPTIONS = \[/);
  assert.match(app, /const CREATION_SCENARIO_ROLE_PRESETS = \{/);
  assert.match(app, /material-closeup/);
  assert.match(app, /usage-steps/);
  assert.match(app, /review-qa/);
  assert.doesNotMatch(app, /brief\.className = "creation-card-brief";/);
  assert.doesNotMatch(app, /refs\.creationScenarioHint\.textContent =[\s\S]*CREATION_INDUSTRY_TEMPLATE_HINTS/);
  assert.match(app, /function getCreationScenarioRolePreset\(/);
  assert.match(app, /function getCreationSelectedRoles\(\) \{/);
  assert.match(app, /function syncCreationSelectedRolesToCount\(\) \{/);
  assert.match(app, /function syncCreationSelectedRolesToScenario\(\) \{/);
  assert.match(app, /function renderCreationRatioOptions\(\) \{/);
  assert.match(app, /function renderCreationSizeOptions\(\) \{/);
  assert.match(app, /function renderCreationRolePicker\(\) \{/);
  assert.match(app, /function applyCreationReferenceFiles\(fileList\) \{/);
  assert.match(app, /function buildCreationReferenceAnalysisFormData\(\) \{/);
  assert.match(app, /function analyzeCreationReferenceImages\(\) \{/);
  assert.match(app, /function applyCreationReferenceAnalysis\(analysis\) \{/);
  assert.match(app, /function applyCreationReferenceAnalysisRecommendations\(\) \{/);
  assert.match(app, /state\.creationReferenceAnalysis\.applied = false;/);
  assert.match(app, /state\.creationReferenceAnalysis\.applied = true;/);
  assert.match(app, /function renderCreationReferenceAnalysis\(\) \{/);
  assert.match(app, /function updateCreationReferenceRole\(referenceId, role\) \{/);
  assert.match(app, /function buildCreationReferenceRolePayload\(\) \{/);
  assert.match(app, /function buildCreationPlanPreviewFormData\(\) \{/);
  assert.match(app, /creationIndustryTemplateInput: document\.querySelector\("#creationIndustryTemplateInput"\)/);
  assert.doesNotMatch(app, /const CREATION_SCENARIO_HINTS = \{/);
  assert.doesNotMatch(app, /const CREATION_INDUSTRY_TEMPLATE_HINTS = \{/);
  assert.match(app, /const CREATION_INDUSTRY_ROLE_PRESETS = \{/);
  assert.match(app, /function getCreationPlanOverrides\(\) \{/);
  assert.match(app, /function canEditCreationItem\(/);
  assert.match(app, /function previewCreationPlan\(\) \{/);
  assert.match(app, /function resetCreationDraftPreview\(\) \{/);
  assert.match(app, /const file = getCreationReferenceGenerationFile\(item\);[\s\S]*formData\.append\("referenceImages", file\)/);
  assert.match(app, /formData\.set\("referenceImageRoles", JSON\.stringify\(buildCreationReferenceRolePayload\(\)\)\)/);
  assert.match(app, /formData\.set\("planOverrides", JSON\.stringify\(getCreationPlanOverrides\(\)\)\)/);
  assert.match(app, /fetch\("\/api\/creation\/reference\/analyze"/);
  assert.match(app, /fetch\("\/api\/creation\/plan"/);
  assert.match(app, /formData\.set\("selectedRoles", JSON\.stringify\(getCreationSelectedRoles\(\)\)\)/);
  assert.match(app, /roleSelect\.dataset\.creationReferenceRoleId = item\.id;/);
  assert.match(app, /formData\.set\("imageCount", String\(selectedRoles\.length \|\| getCreationSelectedImageCount\(\)\)\)/);
  assert.match(app, /formData\.set\("scenario", refs\.creationScenarioInput\.value\)/);
  assert.match(app, /formData\.set\("industryTemplate", refs\.creationIndustryTemplateInput\.value\)/);
  assert.match(app, /refs\.creationImageCountInput\.addEventListener\("change", syncCreationSelectedRolesToCount\)/);
  assert.match(app, /refs\.creationRoleGrid\.addEventListener\("change"/);
  assert.match(app, /refs\.creationScenarioInput\.addEventListener\("change", syncCreationSelectedRolesToScenario\)/);
  assert.match(app, /refs\.creationIndustryTemplateInput\.addEventListener\("change", syncCreationSelectedRolesToIndustry\)/);
  assert.match(app, /refs\.creationRatioInput\.addEventListener\("change", renderCreationSizeOptions\)/);
  assert.match(app, /refs\.creationPlanButton\.addEventListener\("click"/);
  assert.match(app, /refs\.creationReferenceGrid\.addEventListener\("change",[\s\S]*creationReferenceRoleId/);
  assert.match(app, /refs\.creationReferenceAnalyzeButton\.addEventListener\("click"/);
  assert.match(app, /refs\.creationReferenceApplyAnalysisButton\.addEventListener\("click", applyCreationReferenceAnalysisRecommendations\)/);
  assert.match(html, /app\.js\?v=20260508-reference-remove-hover-1/);
  assert.doesNotMatch(app, /state\.creationReferenceAnalysis = state\.referenceAnalysis/);
  assert.doesNotMatch(app, /state\.creation\.creationReferenceFiles/);
  assert.doesNotMatch(app, /state\.creationReferenceFiles = state\.referenceFiles/);
});

test("creation mode exposes record detail and item repair actions", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="creationRepairFailedButton"[\s\S]*补齐未完成项/);
  assert.match(html, /id="creationRecordDetail"/);

  assert.match(styles, /\.creation-record-detail\s*\{/);
  assert.match(styles, /\.creation-record-detail span\s*\{[\s\S]*overflow-wrap:\s*anywhere;/);
  assert.match(styles, /\.creation-card-actions\s*\{/);
  assert.match(styles, /\.creation-card-path\s*\{/);
  assert.match(styles, /\.creation-card\s*\{[\s\S]*position:\s*relative;[\s\S]*isolation:\s*isolate;/);
  assert.match(styles, /\.creation-card-media\s*\{[\s\S]*aspect-ratio:\s*1\s*\/\s*1;/);
  assert.match(styles, /\.creation-card-editor\s*\{[\s\S]*position:\s*fixed;[\s\S]*right:\s*24px;[\s\S]*bottom:\s*24px;[\s\S]*z-index:\s*75;[\s\S]*width:\s*min\(520px,\s*calc\(100vw - 32px\)\);/);
  assert.match(styles, /\.creation-card-editor-head\s*\{/);
  assert.match(styles, /\.creation-card-editor-close\s*\{/);
  assert.match(styles, /\.creation-card-editor textarea\s*\{/);
  assert.match(styles, /html\[data-ui-layout="tablet"\]\s+\.creation-card-editor\s*\{[\s\S]*width:\s*min\(360px,\s*calc\(100vw - 28px\)\);/);
  assert.match(styles, /html\[data-ui-layout="mobile"\]\s+\.creation-card-editor\s*\{[\s\S]*inset:\s*auto 12px 12px 12px;/);

  assert.match(app, /creationRepairFailedButton: document\.querySelector\("#creationRepairFailedButton"\)/);
  assert.match(app, /creationRecordDetail: document\.querySelector\("#creationRecordDetail"\)/);
  assert.match(app, /function formatCreationReferenceRoleSummary\(referenceImageRoles = \[\]\) \{/);
  assert.match(app, /function getCreationRepairReferenceRolePayload\(set = getCreationCurrentSet\(\)\) \{/);
  assert.match(app, /function renderCreationRecordDetail\(set\) \{/);
  assert.match(app, /renderCreationRecordDetail\(set\)[\s\S]*formatCreationReferenceRoleSummary\(set\.referenceImageRoles\)/);
  assert.match(app, /function repairCreationItems\(/);
  assert.match(app, /formData\.set\("referenceImageRoles", JSON\.stringify\(getCreationRepairReferenceRolePayload\(currentSet\)\)\);/);
  assert.match(app, /referenceImageRoles: buildCreationReferenceRolePayload\(\),/);
  assert.match(app, /function getCreationItemDraftKey\(setId, itemId\) \{/);
  assert.match(app, /function toggleCreationItemEditor\(itemId\) \{/);
  assert.match(app, /state\.creation\.editingItemId = state\.creation\.editingItemId === itemId \? "" : itemId;/);
  assert.match(app, /function closeCreationItemEditor\(itemId = state\.creation\.editingItemId\) \{/);
  assert.match(app, /function saveCreationItemDraft\(itemId, promptOverride\) \{/);
  assert.match(app, /fetch\("\/api\/creation\/repair"/);
  assert.match(app, /formData\.set\("promptOverride", promptOverride\);/);
  assert.match(app, /button\.dataset\.creationRetryItemId = item\.itemId;/);
  assert.match(app, /editButton\.dataset\.creationEditItemId = item\.itemId;/);
  assert.match(app, /closeButton\.dataset\.creationClosePromptEditor = item\.itemId;/);
  assert.match(app, /saveButton\.dataset\.creationSavePromptItemId = item\.itemId;/);
  assert.match(app, /textarea\.dataset\.creationPromptEditor = item\.itemId;/);
  assert.match(app, /path\.className = "creation-card-path";/);
  assert.match(app, /path\.textContent = item\.relativePath \|\| item\.error \|\| "";/);
  assert.match(app, /refs\.creationResultGrid\.addEventListener\("click",[\s\S]*creationRetryItemId/);
  assert.match(app, /refs\.creationResultGrid\.addEventListener\("click",[\s\S]*creationEditItemId/);
  assert.match(app, /refs\.creationResultGrid\.addEventListener\("click",[\s\S]*creationClosePromptEditor/);
  assert.match(app, /refs\.creationResultGrid\.addEventListener\("click",[\s\S]*creationSavePromptItemId/);
  assert.match(app, /refs\.creationRepairFailedButton\.addEventListener\("click"/);
});

test("creation generation cards replace plan details with loading animation", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(app, /generationScope:\s*""/);
  assert.match(app, /function shouldShowCreationCardLoading\(item = \{\}, showRecordActions = false\) \{/);
  assert.match(app, /if \(getImageUrl\(item\)\) \{\s*return false;\s*\}/);
  assert.doesNotMatch(app, /state\.creation\.generationScope === "full"[\s\S]*return status !== "failed";/);
  assert.match(app, /function shouldHideCreationCardDetails\(showRecordActions = false\) \{/);
  assert.match(app, /function createCreationCardLoading\(\) \{/);
  assert.match(app, /card\.classList\.toggle\("is-generating", isLoadingCard\);/);
  assert.match(app, /status\.textContent = isLoadingCard \? "生成中" : getCreationStatusLabel\(item\.status\);/);
  assert.match(app, /media\.classList\.add\("is-loading"\);[\s\S]*media\.appendChild\(createCreationCardLoading\(\)\);/);
  assert.match(app, /if \(!showRecordActions && !hideGenerationDetails\) \{/);
  assert.match(app, /if \(showActions && !hideGenerationDetails\) \{/);
  assert.match(app, /state\.creation\.generationScope = "full";/);
  assert.match(app, /state\.creation\.generationScope = itemId \? "single" : "repair";/);

  assert.match(styles, /\.creation-card\.is-generating\s*\{/);
  assert.match(styles, /\.creation-card-media\.is-loading\s*\{/);
  assert.match(styles, /\.creation-card-media\.is-loading\s*\{[\s\S]*width:\s*calc\(100% - 12px\);/);
  assert.match(styles, /\.creation-card-loading\s*\{[\s\S]*min-height:\s*132px;[\s\S]*padding:\s*12px;/);
  assert.match(styles, /\.creation-card-loading-motion span\s*\{[\s\S]*animation:\s*creation-card-loading-bar/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.creation-card-loading-motion span[\s\S]*animation:\s*none;/);
});

test("creation prompt editor uses a top-level layer so cards do not intercept save clicks", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="creationResultGrid"[\s\S]*id="creationPromptEditorLayer"/);
  assert.match(styles, /\.creation-prompt-editor-layer\s*\{[\s\S]*position:\s*fixed;[\s\S]*pointer-events:\s*none;/);
  assert.match(styles, /\.creation-prompt-editor-layer \.creation-card-editor\s*\{[\s\S]*pointer-events:\s*auto;/);
  assert.match(app, /creationPromptEditorLayer: document\.querySelector\("#creationPromptEditorLayer"\)/);
  assert.match(app, /refs\.creationPromptEditorLayer\?\.replaceChildren\(\);/);
  assert.match(app, /refs\.creationPromptEditorLayer\?\.appendChild\(editor\);/);
  assert.match(app, /refs\.creationPromptEditorLayer\.addEventListener\("click"/);
  assert.doesNotMatch(app, /card\.appendChild\(editor\);/);
});

test("creation record reuse tracks reference images that need reupload", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="creationReferenceRestoreList"/);
  assert.match(styles, /\.creation-reference-restore-list\s*\{/);
  assert.match(styles, /\.creation-reference-restore-item\.is-missing/);
  assert.match(styles, /\.creation-reference-restore-item\.is-uploaded/);
  assert.match(app, /creationReferenceRestoreQueue:\s*\[\]/);
  assert.match(app, /function buildCreationReferenceRestoreQueue\(set = \{\}\) \{/);
  assert.match(app, /function findCreationReferenceRestoreEntryForFile\(file, restoreQueue = state\.creationReferenceRestoreQueue\) \{/);
  assert.match(app, /function renderCreationReferenceRestoreList\(\) \{/);
  assert.match(app, /state\.creationReferenceRestoreQueue = buildCreationReferenceRestoreQueue\(normalized\);/);
  assert.match(app, /restoreEntryId:\s*restoreEntry\?\.id \|\| ""/);
  assert.match(app, /restoredFromRecordFilename:\s*restoreEntry\?\.filename \|\| ""/);
  assert.match(app, /role:\s*restoreEntry\?\.role \|\| "product"/);
  assert.match(app, /note:\s*restoreEntry\?\.note \|\| ""/);
  assert.match(app, /markCreationReferenceRestoreEntryMissing\(target\?\.restoreEntryId\)/);
  assert.match(app, /renderCreationReferenceRestoreList\(\);/);
  assert.match(app, /if \(state\.creationReferenceRestoreQueue\.length > 0\) \{[\s\S]*return \[\];/);
});

test("creation reference reuploads can be manually bound to a saved reference", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(styles, /\.creation-reference-bind\s*\{/);
  assert.match(app, /function bindCreationReferenceToRestoreEntry\(referenceId, restoreEntryId\) \{/);
  assert.match(app, /select\.className = "creation-reference-bind";/);
  assert.match(app, /select\.dataset\.creationReferenceRestoreBindId = item\.id;/);
  assert.match(app, /state\.creationReferenceRestoreQueue = state\.creationReferenceRestoreQueue\.map/);
  assert.match(app, /restoreEntryId: normalizedRestoreId/);
  assert.match(app, /restoredFromRecordFilename: nextRestoreEntry\.filename/);
  assert.match(app, /role: nextRestoreEntry\.role \|\| item\.role \|\| "product"/);
  assert.match(app, /restoreEntryId: "",[\s\S]*restoredFromRecordFilename: "",[\s\S]*note: "",/);
  assert.match(app, /refs\.creationReferenceGrid\.addEventListener\("change",[\s\S]*creationReferenceRestoreBindId/);
});

test("creation mode uploads prepared reference images for generation and repair", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /function getCreationReferenceGenerationFile\(item\) \{/);
  assert.match(app, /async function ensureCreationReferenceGenerationFilesReady\(\) \{/);
  assert.match(app, /startCreationGeneration[\s\S]*await ensureCreationReferenceGenerationFilesReady\(\);[\s\S]*const generationFormData = buildCreationFormData\(\);/);
  assert.match(app, /repairCreationItems[\s\S]*await ensureCreationReferenceGenerationFilesReady\(\);[\s\S]*body: buildCreationRepairFormData/);
  assert.match(
    app,
    /state\.creationReferenceFiles\.forEach\(\(item\) => \{\s*const file = getCreationReferenceGenerationFile\(item\);\s*if \(file\) \{\s*formData\.append\("referenceImages", file\);\s*\}\s*\}\);/,
  );
  assert.doesNotMatch(app, /formData\.append\("referenceImages", item\.file\)/);
});

test("asset record views include PPT records and Creation set records", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /data-nav-section="assets"[\s\S]*href="#gallery"[\s\S]*瀑布画廊[\s\S]*href="#creation-record"[\s\S]*套图记录[\s\S]*href="#ppt-record"[\s\S]*PPT记录/);
  assert.match(html, /data-view-panel="gallery"[\s\S]*data-view-panel="creation-record"[\s\S]*data-view-panel="ppt-record"/);
  assert.match(html, /id="pptRecordCount"/);
  assert.match(html, /id="pptRecordRefreshButton"/);
  assert.match(html, /id="pptRecordList"/);
  assert.match(html, /id="creationRecordCount"/);
  assert.match(html, /id="creationRecordSearchInput"/);
  assert.match(html, /id="creationRecordReuseButton"/);
  assert.match(html, /id="creationRecordOpenFolderButton"/);
  assert.match(html, /id="creationRecordCopyPathsButton"/);
  assert.match(html, /id="creationRecordCopyFullPathsButton"/);
  assert.match(html, /id="creationRecordRefreshButton"/);
  assert.match(html, /id="creationRecordActionFeedback"/);
  assert.match(html, /id="creationRecordSetList"/);
  assert.match(html, /id="creationRecordArchiveDetail"/);
  assert.match(html, /id="creationRecordResultGrid"/);
  assert.doesNotMatch(html, /data-nav-section="records"/);
  assert.match(styles, /\.ppt-record-view\s*\{/);
  assert.match(styles, /\.ppt-record-list\s*\{/);
  assert.match(styles, /\.creation-record-view\s*\{/);
  assert.match(styles, /\.creation-record-search\s*\{/);
  assert.match(styles, /\.creation-record-feedback\s*\{/);
  assert.match(styles, /\.creation-record-browser\s*\{/);
  assert.match(styles, /\.creation-record-result-grid\s*\{/);
  assert.match(app, /if \(window\.location\.hash === "#ppt-record"\)/);
  assert.match(app, /if \(window\.location\.hash === "#creation-record"\)/);
  assert.match(app, /function renderPptRecordView\(\) \{/);
  assert.match(app, /function renderCreationRecordView\(\) \{/);
  assert.match(app, /function renderCreationRecordSetList\(\) \{/);
  assert.match(app, /function filterCreationRecordSets\(\) \{/);
  assert.match(app, /renderCreationRecordArchiveDetail\(set\)[\s\S]*formatCreationReferenceRoleSummary\(set\.referenceImageRoles\)/);
  assert.match(app, /function applyCreationSetToForm\(set\) \{/);
  assert.match(app, /function reuseCreationRecordSet\(\) \{/);
  assert.match(app, /function setCreationRecordFeedback\(message = "", kind = ""\) \{/);
  assert.match(app, /async function writeTextToClipboard\(text, failureMessage = "当前浏览器不支持复制图片路径。"\) \{/);
  assert.match(app, /function getCreationRecordImagePaths\(set\) \{/);
  assert.match(app, /async function fetchCreationRecordPathReport\(set\) \{/);
  assert.match(app, /function buildCreationRecordFullPathText\(payload, set\) \{/);
  assert.match(app, /async function copyCreationRecordPaths\(\) \{/);
  assert.match(app, /async function copyCreationRecordFullPaths\(\) \{/);
  assert.match(app, /async function openCreationRecordFolder\(\) \{/);
  assert.match(app, /navigator\.clipboard\.writeText/);
  assert.match(app, /document\.execCommand\("copy"\)/);
  assert.match(app, /await writeTextToClipboard\(text\)/);
  assert.match(app, /fetch\("\/api\/creation\/sets\/paths"/);
  assert.match(app, /fetch\("\/api\/creation\/sets\/open-folder"/);
  assert.match(app, /refs\.pptRecordRefreshButton\.addEventListener\("click",/);
  assert.match(app, /refs\.creationRecordSearchInput\.addEventListener\("input",/);
  assert.match(app, /refs\.creationRecordReuseButton\.addEventListener\("click",/);
  assert.match(app, /refs\.creationRecordOpenFolderButton\.addEventListener\("click",/);
  assert.match(app, /refs\.creationRecordCopyPathsButton\.addEventListener\("click",/);
  assert.match(app, /refs\.creationRecordCopyFullPathsButton\.addEventListener\("click",/);
  assert.match(app, /refs\.creationRecordRefreshButton\.addEventListener\("click",/);
  assert.match(app, /fetch\("\/api\/creation\/sets", \{\s*cache: "no-store"/);
  assert.match(app, /refs\.creationRecordSetList\.addEventListener\("click",[\s\S]*target\.closest\("\[data-creation-record-set-id\]"\)/);
  assert.match(app, /state\.ppt\.decks = Array\.isArray\(payload\) \? payload : \[\];[\s\S]*renderPptRecordView\(\);/);
  assert.match(app, /state\.creation\.sets = nextSets;[\s\S]*renderCreationRecordView\(\);/);
  assert.match(app, /applyCreationSetToForm\(selectedSet\);[\s\S]*state\.creation\.currentSet = normalizeCreationSetForView\(selectedSet\);[\s\S]*setActiveView\("creation"\);/);
  assert.match(app, /refs\.creationProductNameInput\.value = normalized\.productName \|\| "";/);
  assert.match(app, /refs\.creationProductDescriptionInput\.value = normalized\.productDescription \|\| "";/);
  assert.match(app, /refs\.creationSellingPointsInput\.value = normalized\.sellingPoints\.join\("\\n"\);/);
  assert.match(app, /setCreationSelectValue\(refs\.creationTargetLanguageInput, normalized\.targetLanguage, "zh-CN"\);/);
  assert.match(app, /setCreationSelectValue\(refs\.creationScenarioInput, normalized\.scenario, "standard"\);/);
  assert.match(app, /setCreationSelectValue\(refs\.creationIndustryTemplateInput, normalized\.industryTemplate, "general"\);/);
  assert.match(app, /state\.creationSelectedRoles = normalizedRoles\.length > 0 \? normalizedRoles : getCreationRoleIdsForCount\(normalized\.imageCount\);/);
  assert.match(app, /state\.creationReferenceFiles = \[\];/);
  assert.match(app, /state\.creationReferenceAnalysis = createEmptyCreationReferenceAnalysisState\(\);/);
  assert.doesNotMatch(app, /state\.creation\.currentSet = selectedSet \? normalizeCreationSetForView\(selectedSet\) : null;/);
});

test("creation record cards open gallery-style lightbox details", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="lightboxCopyPathButton"[\s\S]*复制路径/);
  assert.match(html, /id="lightboxCopyFullPathButton"[\s\S]*复制完整路径/);
  assert.match(styles, /\.creation-card\.is-record-card\s+\.creation-card-media\s*\{/);
  assert.match(styles, /\.creation-record-preview-media\s*\{/);
  assert.match(styles, /\.creation-record-card-actions\s*\{/);
  assert.match(styles, /\.creation-record-card-actions \.mini-action\.is-disabled\s*\{/);
  assert.match(app, /const showRecordActions = options\.showRecordActions === true;/);
  assert.match(app, /card\.classList\.toggle\("is-record-card", showRecordActions\);/);
  assert.doesNotMatch(app, /creation-card-prompt/);
  assert.match(app, /if \(!showRecordActions && !hideGenerationDetails\) \{[\s\S]*path\.className = "creation-card-path";[\s\S]*card\.appendChild\(path\);[\s\S]*\}/);
  assert.match(app, /media\.dataset\.creationRecordPreviewItemId = item\.itemId;/);
  assert.match(app, /function getCreationRecordItemById\(itemId, setId = ""\) \{/);
  assert.match(app, /function buildCreationRecordLightboxItem\(item, set\) \{/);
  assert.match(app, /function openCreationRecordItemPreview\(itemId\) \{/);
  assert.match(app, /async function copyCreationRecordItemPath\(itemId, setId = ""\) \{/);
  assert.match(app, /function syncLightboxCreationRecordActions\(fresh = \{\}\) \{/);
  assert.match(app, /async function copyLightboxCreationRecordPath\(\) \{/);
  assert.match(app, /async function copyLightboxCreationRecordFullPath\(\) \{/);
  assert.match(app, /actions\.className = "creation-card-actions creation-record-card-actions";/);
  assert.match(app, /previewButton\.dataset\.creationRecordPreviewItemId = item\.itemId;/);
  assert.match(app, /refs\.lightboxDelete\.hidden = Boolean\(fresh\.isCreationRecordItem\);/);
  assert.match(app, /refs\.lightboxCopyPathButton\.addEventListener\("click",/);
  assert.match(app, /refs\.lightboxCopyFullPathButton\.addEventListener\("click",/);
  assert.match(app, /refs\.creationRecordResultGrid\.addEventListener\("click",[\s\S]*creationRecordPreviewItemId/);
  assert.match(app, /createCreationCard\(item, index, \{ showActions: false, showRecordActions: true \}\)/);
  assert.doesNotMatch(app, /dataset\.creationRecordCopyPromptItemId/);
  assert.doesNotMatch(app, /dataset\.creationRecordCopyPathItemId/);
  assert.doesNotMatch(app, /dataset\.creationRecordCopyFullPathItemId/);
});

test("creation records expose prompt exports and lightbox path actions", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="creationRecordCopyPromptsButton"/);
  assert.match(html, /id="creationRecordExportPromptsButton"/);
  assert.match(html, /id="creationRecordExportManifestButton"/);
  assert.match(styles, /\.creation-record-export-actions\s*\{/);
  assert.match(app, /creationRecordCopyPromptsButton: document\.querySelector\("#creationRecordCopyPromptsButton"\)/);
  assert.match(app, /function buildCreationRecordPromptText\(set\) \{/);
  assert.match(app, /function downloadCreationRecordTextFile\(/);
  assert.match(app, /async function copyCreationRecordPrompts\(\) \{/);
  assert.match(app, /function exportCreationRecordPrompts\(\) \{/);
  assert.match(app, /function exportCreationRecordManifest\(\) \{/);
  assert.match(app, /async function copyCreationRecordItemFullPath\(itemId, setId = ""\) \{/);
  assert.match(app, /lightboxCopyPathButton: document\.querySelector\("#lightboxCopyPathButton"\)/);
  assert.match(app, /lightboxCopyFullPathButton: document\.querySelector\("#lightboxCopyFullPathButton"\)/);
  assert.match(app, /refs\.creationRecordCopyPromptsButton\.addEventListener\("click",/);
  assert.match(app, /refs\.creationRecordExportPromptsButton\.addEventListener\("click",/);
  assert.match(app, /refs\.creationRecordExportManifestButton\.addEventListener\("click",/);
});

test("waterfall gallery paginates history unless keyword search is active", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="galleryPagination"/);
  assert.match(html, /id="galleryPreviousPageButton"[\s\S]*上一页/);
  assert.match(html, /id="galleryNextPageButton"[\s\S]*下一页/);
  assert.match(app, /paginateGallerySections/);
  assert.match(app, /const shouldPaginateHistory = !filters\.query;/);
  assert.match(app, /refs\.galleryPreviousPageButton\.addEventListener\("click"/);
  assert.match(app, /refs\.galleryNextPageButton\.addEventListener\("click"/);
});

test("PPT view supports richer styles and direct slide annotation editing", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /<option value="tech">科技发布<\/option>/);
  assert.match(html, /<option value="finance">金融数据<\/option>/);
  assert.match(html, /<option value="luxury">高端品牌<\/option>/);
  assert.match(html, /id="pptEditModal"/);
  assert.match(html, /id="pptEditCanvas"/);
  assert.match(html, /id="pptEditInstructionInput"/);
  assert.match(html, /id="pptSubmitEditButton"[\s\S]*重新生成本页/);

  assert.match(styles, /\.ppt-edit-modal\s*\{/);
  assert.match(styles, /\.ppt-edit-canvas-wrap\s*\{/);
  assert.match(styles, /\.ppt-edit-toolbar\s*\{/);

  assert.match(app, /function openPptSlideEditor\(slideNumber\)/);
  assert.match(app, /function drawPptEditStroke/);
  assert.match(app, /function submitPptSlideEdit\(\)/);
  assert.match(app, /fetch\("\/api\/ppt\/slide\/edit"/);
  assert.match(app, /data-ppt-edit-slide/);
  assert.match(app, /refs\.pptSubmitEditButton\.addEventListener\("click",/);
});

test("PPT view exposes dynamic components and transition effect controls", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="pptDynamicPresetInput"/);
  assert.match(html, /<option value="storyline">路径叙事<\/option>/);
  assert.match(html, /<option value="data-pulse">数据脉冲<\/option>/);
  assert.match(html, /id="pptTransitionPresetInput"/);
  assert.match(html, /<select id="pptTransitionPresetInput" name="transitionPreset">\s*<option value="smooth">平滑<\/option>/);
  assert.match(html, /<option value="fade">淡入<\/option>/);
  assert.match(html, /<option value="morph-flow">流动切换<\/option>/);
  assert.match(html, /id="pptTransitionSpeedInput"/);

  assert.match(styles, /\.ppt-motion-grid\s*\{/);
  assert.doesNotMatch(styles, /\.ppt-motion-note\s*\{/);
  assert.match(styles, /\.ppt-outline-box:empty\s*\{/);

  assert.match(app, /pptDynamicPresetInput: document\.querySelector\("#pptDynamicPresetInput"\)/);
  assert.match(app, /pptTransitionPresetInput: document\.querySelector\("#pptTransitionPresetInput"\)/);
  assert.match(app, /formData\.set\("dynamicPreset", refs\.pptDynamicPresetInput\.value\)/);
  assert.match(app, /formData\.set\("transitionPreset", refs\.pptTransitionPresetInput\.value\)/);
  assert.match(app, /transitionSpeed: refs\.pptTransitionSpeedInput\.value/);
});
