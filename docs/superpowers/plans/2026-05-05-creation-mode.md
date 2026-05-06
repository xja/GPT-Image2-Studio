# Creation Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an independent Creation Mode under the studio workspace that generates configurable ecommerce marketing sets and stores output under dated `creation` folders.

**Architecture:** Keep Creation Mode separate from prompt-mode state and routes. Reuse low-level image generation and asset saving, but add dedicated creation planning, set manifest storage, `/api/creation/*` routes, and frontend state/rendering.

**Tech Stack:** Node.js ES modules, native HTTP server, browser HTML/CSS/JS, Node test runner.

---

### Task 1: Creation Planning Helpers

**Files:**
- Create: `lib/creation-planner.mjs`
- Test: `test/creation-planner.test.mjs`

- [ ] **Step 1: Write failing planning tests**

Create tests that import `buildCreationPlan` and assert that a valid product input returns exactly four roles: `hero`, `benefit`, `scene`, and `detail-trust`; each prompt includes the selected target language instruction.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test test/creation-planner.test.mjs`
Expected: FAIL because `lib/creation-planner.mjs` does not exist.

- [ ] **Step 3: Implement planner**

Add a focused planner that normalizes product name, description, selling points, target language, and creates the four item prompts without calling external APIs.

- [ ] **Step 4: Run planner tests and verify GREEN**

Run: `node --test test/creation-planner.test.mjs`
Expected: PASS.

### Task 2: Creation Storage Helpers

**Files:**
- Create: `lib/creation-store.mjs`
- Test: `test/creation-store.test.mjs`

- [ ] **Step 1: Write failing storage tests**

Create tests for `buildCreationRelativeDir`, `createCreationSetStore`, and manifest list behavior. Assert the May 5, 2026 path begins `05/2026-05-05/2026-05-05-creation/`.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test test/creation-store.test.mjs`
Expected: FAIL because `lib/creation-store.mjs` does not exist.

- [ ] **Step 3: Implement storage helpers**

Use JSON manifests under `outputDir/json/creation-sets/`, safe filename segments, and `/output/<relativePath>` URLs.

- [ ] **Step 4: Run storage tests and verify GREEN**

Run: `node --test test/creation-store.test.mjs`
Expected: PASS.

### Task 3: Local Creation API

**Files:**
- Modify: `server.mjs`
- Test: `test/creation-api.test.mjs`

- [ ] **Step 1: Write failing API tests**

Add tests for `GET /api/creation/sets` and `POST /api/creation/generate` using injected fake generation behavior where possible. Assert SSE includes set/item events and saved metadata has `assetKind: "creation-image"` and `galleryVisible: false`.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test test/creation-api.test.mjs`
Expected: FAIL because `/api/creation/*` routes do not exist.

- [ ] **Step 3: Implement routes**

Add dedicated creation route handlers. Reuse config reading, `requestImageGeneration`, `saveGeneratedAsset`, and existing SSE helpers while keeping payloads independent from `/api/generate`.

- [ ] **Step 4: Run API tests and verify GREEN**

Run: `node --test test/creation-api.test.mjs`
Expected: PASS.

### Task 4: Frontend Creation Tab

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Test: `test/studio-preview-layout.test.mjs`

- [ ] **Step 1: Write failing layout tests**

Extend structure tests to require a `creation` tab/hash route, `data-view-panel="creation"`, independent `state.creation`, and no reliance on `PROMPT_TEMPLATE_STORAGE_KEY`.

- [ ] **Step 2: Run layout test and verify RED**

Run: `node --test test/studio-preview-layout.test.mjs`
Expected: FAIL on missing Creation Mode structure.

- [ ] **Step 3: Implement frontend**

Add Creation Mode form fields for product information, selling points, target language, and result cards. Implement dedicated submit/SSE handling and scoped CSS.

- [ ] **Step 4: Run layout test and verify GREEN**

Run: `node --test test/studio-preview-layout.test.mjs`
Expected: PASS.

### Task 5: Verification And Documentation

**Files:**
- Modify: `README.md`
- Modify: `openspec/changes/add-creation-mode/tasks.md`

- [x] **Step 1: Update docs**

Document the Creation Mode output path and the first-version scope.

- [x] **Step 2: Run full checks**

Run:

```powershell
node --check server.mjs
node --check public/app.js
npm test
npm run build:pages
openspec validate add-creation-mode
```

Expected: all commands exit 0.

- [x] **Step 3: Browser verify**

Start the app, open the studio in the in-app browser, verify the Creation Mode tab renders, target language can be selected, and layout does not overflow on desktop.

### Task 6: Creation Mode V2 Controls

**Files:**
- Modify: `lib/creation-planner.mjs`
- Modify: `lib/creation-store.mjs`
- Modify: `server.mjs`
- Modify: `cloudflare-pages-worker.mjs`
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Modify: `test/creation-planner.test.mjs`
- Modify: `test/creation-store.test.mjs`
- Modify: `test/creation-server-static.test.mjs`
- Modify: `test/studio-preview-layout.test.mjs`

- [x] **Step 1: Write failing tests**

Add tests for 4/6/8 image counts, marketing scenarios, creation-only reference images, and set manifest metadata.

- [x] **Step 2: Implement planner and storage**

Extend creation planning to support scenario guidance and up to eight ecommerce roles. Persist scenario, image count, and reference image names in creation manifests.

- [x] **Step 3: Implement API and UI**

Pass Creation Mode reference images through local and Cloudflare generation paths. Add scoped UI controls for reference images, image count, and scenario without sharing prompt-mode reference state.
