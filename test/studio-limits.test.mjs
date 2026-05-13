import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  MAX_CONCURRENT_TASKS_PER_SESSION,
  MAX_PARALLEL_TASKS_PER_SESSION,
} from "../lib/studio-constants.mjs";

const appPath = new URL("../public/app.js", import.meta.url);
const serverPath = new URL("../server.mjs", import.meta.url);

test("studio task limits keep 20 queued tasks and allow four parallel tasks", async () => {
  assert.equal(MAX_CONCURRENT_TASKS_PER_SESSION, 20);
  assert.equal(MAX_PARALLEL_TASKS_PER_SESSION, 4);

  const app = await readFile(appPath, "utf8");

  assert.match(app, /maxConcurrentTasksPerSession:\s*20/);
  assert.match(app, /maxParallelTasksPerSession:\s*4/);
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
  assert.match(server, /function releaseSessionTaskSlot\(sessionId, taskId, requestScope\) \{/);
  assert.match(server, /const activeTasksBySessionScope = new Map\(\);/);
  assert.doesNotMatch(server, /activeTasksBySession = new Map\(\)/);

  assert.match(generateHandler, /generationRequestScope = getStudioGenerationRequestScope\(generationMode\);/);
  assert.match(generateHandler, /claimSessionTaskSlot\(clientSessionId, taskId, generationRequestScope\)/);
  assert.match(generateHandler, /releaseSessionTaskSlot\(clientSessionId, taskId, generationRequestScope\)/);

  assert.match(creationGenerateHandler, /const generationRequestScope = "creation";/);
  assert.match(creationGenerateHandler, /claimSessionTaskSlot\(clientSessionId, taskId, generationRequestScope\)/);
  assert.match(creationGenerateHandler, /releaseSessionTaskSlot\(clientSessionId, taskId, generationRequestScope\)/);

  assert.match(creationRepairHandler, /const generationRequestScope = "creation";/);
  assert.match(creationRepairHandler, /claimSessionTaskSlot\(clientSessionId, taskId, generationRequestScope\)/);
  assert.match(creationRepairHandler, /releaseSessionTaskSlot\(clientSessionId, taskId, generationRequestScope\)/);

  assert.match(articleGenerateHandler, /const generationRequestScope = "article-illustration";/);
  assert.match(articleGenerateHandler, /claimSessionTaskSlot\(clientSessionId, taskId, generationRequestScope\)/);
  assert.match(articleGenerateHandler, /releaseSessionTaskSlot\(clientSessionId, taskId, generationRequestScope\)/);
});
