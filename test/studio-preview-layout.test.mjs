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

test("studio panels start without redundant title blocks and keep advanced options expanded", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /<details class="advanced-box" open>/);
  assert.doesNotMatch(html, /<h2>生成设置<\/h2>/);
  assert.doesNotMatch(html, /<h2>生成结果<\/h2>/);
  assert.doesNotMatch(html, /外层模型：/);
  assert.doesNotMatch(html, /中转地址：/);
  assert.doesNotMatch(html, /id="advancedResponsesModel"/);
  assert.doesNotMatch(html, /id="advancedBaseUrl"/);
  assert.doesNotMatch(app, /advancedResponsesModel/);
  assert.doesNotMatch(app, /advancedBaseUrl/);
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
