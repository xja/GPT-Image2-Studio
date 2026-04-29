import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const indexPath = new URL("../public/index.html", import.meta.url);
const stylesPath = new URL("../public/styles.css", import.meta.url);
const appPath = new URL("../public/app.js", import.meta.url);

test("preview image uses contain sizing to fill the available canvas without clipping", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(
    styles,
    /#previewImage\s*\{[\s\S]*width:\s*auto;[\s\S]*height:\s*auto;[\s\S]*max-width:\s*100%;[\s\S]*max-height:\s*100%;/,
  );
  assert.doesNotMatch(styles, /#previewImage\s*\{[\s\S]*object-fit:\s*contain;/);
  assert.match(app, /refs\.previewImage\.style\.transform = `scale\(\$\{state\.zoom\}\)`;/);
});

test("lightbox detail image can be clicked to magnify inside the detail view", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(styles, /#lightboxImage\s*\{[\s\S]*cursor:\s*zoom-in;/);
  assert.match(styles, /#lightboxImage\.is-zoomed\s*\{[\s\S]*cursor:\s*zoom-out;/);
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
  assert.match(styles, /\.filmstrip-item span\s*\{[\s\S]*font-size:\s*12px;[\s\S]*line-height:\s*14px;[\s\S]*white-space:\s*nowrap;/);
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

test("generate action appears above the prompt field", async () => {
  const html = await readFile(indexPath, "utf8");

  assert.match(
    html,
    /<form id="generateForm" class="settings-form">[\s\S]*<button[\s\S]*class="generate-button"[\s\S]*id="generateButton"[\s\S]*type="submit"[\s\S]*>[\s\S]*开始生成[\s\S]*<\/button>[\s\S]*<span>提示词<\/span>/,
  );
  assert.doesNotMatch(html, /class="generate-note"/);
  assert.doesNotMatch(html, /支持最多 20 个任务排队/);
  assert.doesNotMatch(html, /<div class="reference-grid hidden" id="referenceGrid"><\/div>[\s\S]*<button class="generate-button" id="generateButton"/);
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

test("studio panels start without redundant title blocks and merge parameters under ratio controls", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /<div class="field-group parameter-settings">[\s\S]*<span>参数设置<\/span>[\s\S]*<small>Parameters<\/small>[\s\S]*<div class="ratio-grid" id="ratioGrid"><\/div>[\s\S]*<div class="advanced-content">/);
  assert.match(html, /<div class="field-group parameter-settings">[\s\S]*<label class="compact-field">[\s\S]*<span>推理强度<\/span>[\s\S]*<label class="compact-field">[\s\S]*<span>分辨率<\/span>[\s\S]*<label class="compact-field">[\s\S]*<span>输出格式<\/span>/);
  assert.match(html, /<div class="advanced-controls">[\s\S]*<label class="compact-field">[\s\S]*<span>输出格式<\/span>[\s\S]*<\/label>[\s\S]*<div class="parameter-meta" aria-label="工具模型与质量">[\s\S]*<span>工具模型<\/span>[\s\S]*<strong>gpt-image-2<\/strong>[\s\S]*<span>质量<\/span>[\s\S]*<strong>High<\/strong>[\s\S]*<\/div>[\s\S]*<\/div>/);
  assert.doesNotMatch(html, /<p>工具模型：/);
  assert.doesNotMatch(html, /<p>质量：/);
  assert.doesNotMatch(html, /<details class="advanced-box"/);
  assert.doesNotMatch(html, /<summary>高级选项/);
  assert.doesNotMatch(html, />\s*比例\s*</);
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

test("prompt agent opens from the header without adding another view tab", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /<button class="header-button" id="openPromptAgentButton" type="button">图片转提示词<\/button>/);
  assert.match(html, /<aside class="prompt-agent-modal hidden" id="promptAgentModal"/);
  assert.match(html, /id="promptAgentHistoryList"/);
  assert.doesNotMatch(html, /data-view-tab="prompt-agent"/);
  assert.match(styles, /\.prompt-agent-modal\s*\{[\s\S]*position:\s*fixed;/);
  assert.match(app, /fetch\("\/api\/prompt-agent\/analyze"/);
  assert.match(app, /refs\.promptInput\.value = promptText;/);
  assert.match(app, /loadPromptAgentHistory/);
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

test("studio columns use synchronized desktop height so wide screens do not leave a dead zone under the workspace", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(styles, /\.settings-panel\s*\{[\s\S]*height:\s*var\(--studio-column-height,\s*auto\);/);
  assert.match(styles, /\.preview-panel\s*\{[\s\S]*height:\s*var\(--studio-column-height,\s*auto\);/);
  assert.match(styles, /\.side-column\s*\{[\s\S]*height:\s*var\(--studio-column-height,\s*auto\);/);
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
});

test("prompt template storage respects an intentionally empty saved list", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /if \(raw === null\) \{[\s\S]*return DEFAULT_PROMPT_TEMPLATES\.map/);
  assert.match(app, /return Array\.isArray\(parsed\) \? parsed\.map\(normalizePromptTemplate\)\.filter\(Boolean\) : \[\];/);
});
