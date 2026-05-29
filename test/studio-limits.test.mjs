import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  MAX_CREATION_REFERENCE_IMAGES,
  MAX_CREATION_STYLE_REFERENCE_IMAGES,
  MAX_CONCURRENT_TASKS_PER_SESSION,
  MAX_PARALLEL_TASKS_PER_SESSION,
  MAX_PORTRAIT_ACCESSORY_REFERENCE_IMAGES,
  MAX_PORTRAIT_PERSON_REFERENCE_IMAGES,
  MAX_REFERENCE_IMAGES,
} from "../lib/studio-constants.mjs";

const appPath = new URL("../public/app.js", import.meta.url);
const indexPath = new URL("../public/index.html", import.meta.url);
const serverPath = new URL("../server.mjs", import.meta.url);

test("studio task limits keep 25 queued tasks and allow ten parallel tasks", async () => {
  assert.equal(MAX_CONCURRENT_TASKS_PER_SESSION, 25);
  assert.equal(MAX_PARALLEL_TASKS_PER_SESSION, 10);

  const app = await readFile(appPath, "utf8");

  assert.match(app, /maxConcurrentTasksPerSession:\s*25/);
  assert.match(app, /maxParallelTasksPerSession:\s*10/);
});

test("studio reference limits keep standard references at six and creation references at twelve", async () => {
  assert.equal(MAX_REFERENCE_IMAGES, 6);
  assert.equal(MAX_CREATION_REFERENCE_IMAGES, 12);
  assert.equal(MAX_CREATION_STYLE_REFERENCE_IMAGES, 3);
  assert.equal(MAX_PORTRAIT_PERSON_REFERENCE_IMAGES, 3);
  assert.equal(MAX_PORTRAIT_ACCESSORY_REFERENCE_IMAGES, 9);

  const app = await readFile(appPath, "utf8");
  const index = await readFile(indexPath, "utf8");

  assert.match(app, /maxReferenceImages:\s*6/);
  assert.match(app, /maxCreationReferenceImages:\s*12/);
  assert.match(app, /maxCreationStyleReferenceImages:\s*3/);
  assert.match(app, /maxPortraitPersonReferenceImages:\s*3/);
  assert.match(app, /maxPortraitAccessoryReferenceImages:\s*9/);
  assert.match(index, /id="creationReferenceCount">0 \/ 12<\/small>/);
});

test("local server counts active generation slots per request mode", async () => {
  const server = await readFile(serverPath, "utf8");
  const generateHandler =
    server.match(/async function handleGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function routeRequest/)?.[0] || "";
  const creationGenerateHandler =
    server.match(/async function handleCreationGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationRepair/)?.[0] || "";
  const creationRepairHandler =
    server.match(/async function handleCreationRepair[\s\S]*?\r?\n}\r?\n\r?\nasync function handleGenerate/)?.[0] || "";
  const articleGenerateHandler =
    server.match(/async function handleArticleIllustrationGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationSetsGet/)?.[0] || "";

  assert.match(server, /function getStudioGenerationRequestScope\(generationMode\) \{/);
  assert.match(server, /function getGenerationTaskSlotScopeKey\(sessionId, requestScope\) \{/);
  assert.match(server, /function claimSessionTaskSlot\(sessionId, taskId, requestScope\) \{/);
  assert.match(server, /const sessionTaskSlotLimiter = createSessionTaskSlotLimiter\(/);
  assert.match(server, /function isResponseWritable\(response\) \{/);
  assert.match(server, /async function waitForSessionTaskSlot\(sessionId, taskId, requestScope, options = \{\}\) \{/);
  assert.match(server, /async function waitForResponseSessionTaskSlot\(sessionId, taskId, requestScope, response\) \{/);
  assert.match(server, /function releaseSessionTaskSlot\(sessionId, taskId, requestScope\) \{/);
  assert.match(server, /isActive: \(\) => isResponseWritable\(response\)/);
  assert.doesNotMatch(server, /const activeTasksBySessionScope = new Map\(\);/);
  assert.doesNotMatch(server, /activeTasksBySession = new Map\(\)/);

  assert.match(generateHandler, /generationRequestScope = getStudioGenerationRequestScope\(generationMode\);/);
  assert.match(generateHandler, /waitForResponseSessionTaskSlot\(clientSessionId, taskId, generationRequestScope, response\)/);
  assert.match(generateHandler, /releaseSessionTaskSlot\(clientSessionId, taskId, generationRequestScope\)/);

  assert.match(creationGenerateHandler, /const generationRequestScope = "creation";/);
  assert.match(creationGenerateHandler, /waitForResponseSessionTaskSlot\(clientSessionId, taskId, generationRequestScope, response\)/);
  assert.match(creationGenerateHandler, /releaseSessionTaskSlot\(clientSessionId, taskId, generationRequestScope\)/);

  assert.match(creationRepairHandler, /const generationRequestScope = "creation";/);
  assert.match(creationRepairHandler, /waitForResponseSessionTaskSlot\(clientSessionId, taskId, generationRequestScope, response\)/);
  assert.match(creationRepairHandler, /releaseSessionTaskSlot\(clientSessionId, taskId, generationRequestScope\)/);

  assert.match(articleGenerateHandler, /const generationRequestScope = "article-illustration";/);
  assert.match(articleGenerateHandler, /waitForResponseSessionTaskSlot\(clientSessionId, taskId, generationRequestScope, response\)/);
  assert.match(articleGenerateHandler, /releaseSessionTaskSlot\(clientSessionId, taskId, generationRequestScope\)/);
});
