import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const indexPath = new URL("../public/index.html", import.meta.url);
const stylesPath = new URL("../public/styles.css", import.meta.url);
const appPath = new URL("../public/app.js", import.meta.url);

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

test("live feed keeps existing task order stable while activity text changes", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /\/app\.js\?v=20260505-reference-orchestration-1/);
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

test("reference preview cards do not render uploaded filenames", async () => {
  const app = await readFile(appPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.doesNotMatch(app, /name\.textContent\s*=\s*item\.file\.name/);
  assert.doesNotMatch(app, /reference-card-meta/);
  assert.doesNotMatch(styles, /\.reference-card-meta/);
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
  const createMenu = html.match(/data-nav-section="create"[\s\S]*?(?=<div class="nav-item" data-nav-section="present")/)?.[0] || "";
  const presentMenu = html.match(/data-nav-section="present"[\s\S]*?(?=<div class="nav-item" data-nav-section="assets")/)?.[0] || "";
  const assetsMenu = html.match(/data-nav-section="assets"[\s\S]*?(?=<div class="nav-item" data-nav-section="records")/)?.[0] || "";
  const recordsMenu = html.match(/data-nav-section="records"[\s\S]*?(?=<div class="nav-item" data-nav-section="settings")/)?.[0] || "";
  const settingsMenu = html.match(/data-nav-section="settings"[\s\S]*?(?=<\/div>\s*<\/nav>)/)?.[0] || "";

  assert.match(html, /<nav class="primary-nav global-nav" aria-label="全局导航">/);
  assert.doesNotMatch(html, /nav-region-label/);
  assert.doesNotMatch(html, />主区</);
  assert.match(html, /<div class="view-tabs global-nav-list" role="tablist" aria-label="功能区导航">/);
  assert.match(html, /data-nav-section="create"[\s\S]*data-view-tab="studio"[\s\S]*<span class="nav-tab-label">创作<\/span>[\s\S]*<span class="nav-tab-note">Studio<\/span>/);
  assert.match(html, /data-nav-section="present"[\s\S]*data-view-tab="ppt"[\s\S]*<span class="nav-tab-label">演示<\/span>[\s\S]*<span class="nav-tab-note">PPT<\/span>/);
  assert.match(html, /data-nav-section="assets"[\s\S]*data-view-tab="gallery"[\s\S]*<span class="nav-tab-label">资产<\/span>[\s\S]*<span class="nav-tab-note">Gallery<\/span>/);
  assert.match(html, /data-nav-section="records"[\s\S]*data-view-tab="ppt-record"[\s\S]*<span class="nav-tab-label">记录<\/span>[\s\S]*<span class="nav-tab-note">Decks<\/span>/);
  assert.match(html, /data-nav-section="settings"[\s\S]*data-nav-action="config"[\s\S]*<span class="nav-tab-label">配置<\/span>[\s\S]*<span class="nav-tab-note">Settings<\/span>/);
  assert.match(html, /<div class="nav-flyout mega-menu" data-nav-subzone="studio">[\s\S]*<span class="mega-menu-kicker">创作区<\/span>[\s\S]*<a class="mega-menu-link large" href="#studio">Studio 生成台<\/a>/);
  assert.match(createMenu, /提示词生成图片/);
  assert.doesNotMatch(createMenu, /data-nav-action="config"|data-nav-action="theme"|data-nav-action="output"|data-nav-action="prompt-agent"/);
  assert.match(presentMenu, /PPT 演示工作台/);
  assert.doesNotMatch(presentMenu, /data-nav-action="config"|data-nav-action="theme"|data-nav-action="output"|data-nav-action="prompt-agent"|瀑布画廊/);
  assert.match(assetsMenu, /data-nav-action="prompt-agent"[\s\S]*图片转提示词/);
  assert.match(assetsMenu, /data-nav-action="output"[\s\S]*打开输出目录/);
  assert.doesNotMatch(assetsMenu, /data-nav-action="config"|data-nav-action="theme"|PPT 演示|PPT 记录/);
  assert.match(recordsMenu, /PPT 记录/);
  assert.doesNotMatch(recordsMenu, /data-nav-action="config"|data-nav-action="theme"|data-nav-action="output"|data-nav-action="prompt-agent"|瀑布画廊/);
  assert.match(settingsMenu, /data-nav-action="config"[\s\S]*配置 API/);
  assert.match(settingsMenu, /data-nav-action="theme"[\s\S]*主题颜色/);
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
  assert.match(styles, /\.mega-menu-link\.large,\s*[\r\n]+\s*\.mega-menu-action\.large\s*\{[\s\S]*font-size:\s*1\.45rem;[\s\S]*font-weight:\s*700;/);
  assert.match(styles, /\.global-nav-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\);[\s\S]*overflow:\s*visible;/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.global-nav-list\s*\{[\s\S]*overflow:\s*visible;/);
  assert.doesNotMatch(styles, /\.nav-item:hover \.nav-flyout/);
  assert.doesNotMatch(styles, /\.nav-item:focus-within \.nav-flyout/);
  assert.match(styles, /\.nav-item\.is-nav-open \.nav-flyout\s*\{[\s\S]*opacity:\s*1;[\s\S]*visibility:\s*visible;[\s\S]*pointer-events:\s*auto;/);
  assert.match(app, /function handleGlobalNavAction\(action\) \{/);
  assert.match(app, /refs\.connectionStatus\.addEventListener\("click",\s*\(\) => setDrawerOpen\(true\)\);/);
  assert.match(app, /globalNavItems:\s*\[\.\.\.document\.querySelectorAll\("\[data-nav-section\]"\)\]/);
  assert.match(app, /function setActiveGlobalNavItem\(item\) \{[\s\S]*refs\.globalNavItems\.forEach\(\(navItem\) => \{[\s\S]*const isOpen = navItem === item;[\s\S]*navItem\.classList\.toggle\("is-nav-open",\s*isOpen\);/);
  assert.match(app, /button\.addEventListener\("pointerenter",\s*\(\) => setActiveGlobalNavItem\(item\)\);/);
  assert.match(app, /button\.addEventListener\("focus",\s*\(\) => setActiveGlobalNavItem\(item\)\);/);
  assert.match(app, /document\.querySelectorAll\("\[data-nav-action\]"\)\.forEach/);
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

test("studio reference images can be manually analyzed into orchestration prompts", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="referenceAnalyzeButton"[\s\S]*分析参考图/);
  assert.match(html, /id="referenceAnalysisPanel"[\s\S]*编排提示词/);
  assert.match(html, /id="referenceAnalysisList"/);
  assert.match(styles, /\.reference-analysis-panel\s*\{/);
  assert.match(styles, /\.reference-analysis-card\s*\{/);
  assert.match(app, /referenceAnalysis:\s*\{/);
  assert.match(app, /function buildReferenceAnalysisFormData\(\) \{/);
  assert.match(app, /formData\.set\("mode", "reference-orchestration"\);/);
  assert.match(app, /formData\.append\("referenceImages", item\.file\);/);
  assert.match(app, /appendBrowserConfigToFormData\(formData\);/);
  assert.match(app, /fetch\("\/api\/prompt-agent\/analyze"/);
  assert.match(app, /button\.dataset\.referenceAnalysisPromptIndex = String\(index\);/);
  assert.match(app, /function applyReferenceAnalysisPrompt\(index\) \{/);
  const applyReferenceFilesBody = app.match(/function applyReferenceFiles\(fileList\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.doesNotMatch(applyReferenceFilesBody, /analyzeReferenceImages\(\)/);
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

  assert.match(html, /\/app\.js\?v=20260505-reference-orchestration-1/);
  assert.match(app, /const BROWSER_IMAGE_CACHE_INDEX_KEY = "image-studio-browser-image-cache-index-v1";/);
  assert.match(app, /function openBrowserImageCacheDB\(\) \{/);
  assert.match(app, /function isServerImageProxyUrl\(url\) \{/);
  assert.match(app, /async function fetchServerImageAsDataUrl\(imageUrl\) \{/);
  assert.match(app, /async function cacheBrowserGalleryItem\(item\) \{/);
  assert.match(app, /await fetchServerImageAsDataUrl\(imageUrl\)/);
  assert.match(app, /if \(eventName === "final_image_chunk"\) \{[\s\S]*await cacheBrowserGalleryItem\(\{\s*filename: payload\.filename,[\s\S]*imageUrl: dataUrl,[\s\S]*thumbnailUrl: dataUrl,[\s\S]*\}\);/);
  assert.match(app, /async function readBrowserCachedGalleryItems\(\) \{/);
  assert.match(app, /function upsertGalleryItem\(item\) \{[\s\S]*void cacheBrowserGalleryItem\(hydratedItem\);/);
  assert.match(app, /async function loadGallery\(\) \{[\s\S]*const browserCachedItems = await readBrowserCachedGalleryItems\(\);[\s\S]*state\.gallery = sortGalleryItemsByCreatedAtDesc/);
  assert.match(app, /async function deleteGalleryItem\(item\) \{[\s\S]*await deleteBrowserCachedGalleryItem\(item\.filename\);/);
  assert.match(app, /async function clearHistory\(\) \{[\s\S]*await clearBrowserImageCache\(\);/);
});

test("studio accepts server-stored Cloudflare image URLs before browser caching finishes", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /if \(isServerImageProxyUrl\(imageUrl\)\) \{/);
  assert.match(app, /const serverImageUrl = getServerImageUrl\(item\);/);
  assert.match(app, /writeIndex\(\);[\s\S]*const dataUrl = hasDataUrl \? imageUrl : await fetchServerImageAsDataUrl\(imageUrl\);/);
  assert.match(app, /const fallbackImageUrl = isServerImageProxyUrl\(entry\.imageUrl\) \? entry\.imageUrl : "";/);
  assert.match(app, /payload\.item = attachChunkedImageToSavedItem\(payload\.item, finalImageChunks\);/);
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

  assert.match(html, /data-view-tab="ppt"[\s\S]*PPT 演示/);
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

test("PPT record view sits after the waterfall gallery and renders all deck records", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /data-view-tab="gallery"[\s\S]*瀑布画廊[\s\S]*data-view-tab="ppt-record"[\s\S]*PPT记录/);
  assert.match(html, /data-view-panel="gallery"[\s\S]*data-view-panel="ppt-record"/);
  assert.match(html, /id="pptRecordCount"/);
  assert.match(html, /id="pptRecordRefreshButton"/);
  assert.match(html, /id="pptRecordList"/);
  assert.match(styles, /\.ppt-record-view\s*\{/);
  assert.match(styles, /\.ppt-record-list\s*\{/);
  assert.match(app, /if \(window\.location\.hash === "#ppt-record"\)/);
  assert.match(app, /function renderPptRecordView\(\) \{/);
  assert.match(app, /refs\.pptRecordRefreshButton\.addEventListener\("click",/);
  assert.match(app, /state\.ppt\.decks = Array\.isArray\(payload\) \? payload : \[\];[\s\S]*renderPptRecordView\(\);/);
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
  assert.match(styles, /\.ppt-motion-note\s*\{/);

  assert.match(app, /pptDynamicPresetInput: document\.querySelector\("#pptDynamicPresetInput"\)/);
  assert.match(app, /pptTransitionPresetInput: document\.querySelector\("#pptTransitionPresetInput"\)/);
  assert.match(app, /formData\.set\("dynamicPreset", refs\.pptDynamicPresetInput\.value\)/);
  assert.match(app, /formData\.set\("transitionPreset", refs\.pptTransitionPresetInput\.value\)/);
  assert.match(app, /transitionSpeed: refs\.pptTransitionSpeedInput\.value/);
});
