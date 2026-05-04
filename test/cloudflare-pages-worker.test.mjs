import test from "node:test";
import assert from "node:assert/strict";

import { handleApiRequest, handleGenerationQueue } from "../cloudflare-pages-worker.mjs";

function makeSseResponse(base64 = "ZmluYWw=") {
  return new Response(
    [
      "event: response.output_item.done",
      `data: {"item":{"type":"image_generation_call","result":"${base64}"}}`,
      "",
      "data: [DONE]",
      "",
    ].join("\n"),
    {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    },
  );
}

function parseSseEvents(text) {
  return text
    .split(/\r?\n\r?\n/)
    .map((chunk) => {
      const eventName = chunk.match(/^event:\s*(.+)$/m)?.[1] || "";
      const data = chunk.match(/^data:\s*(.+)$/m)?.[1] || "";
      return eventName && data ? { eventName, payload: JSON.parse(data) } : null;
    })
    .filter(Boolean);
}

function makeImageBucket() {
  const objects = new Map();
  return {
    objects,
    async put(key, value, options = {}) {
      objects.set(key, {
        body: value,
        httpMetadata: options.httpMetadata || {},
        customMetadata: options.customMetadata || {},
      });
    },
    async get(key) {
      const object = objects.get(key);
      if (!object) {
        return null;
      }
      return {
        body: object.body,
        httpMetadata: object.httpMetadata,
        customMetadata: object.customMetadata,
        async text() {
          if (typeof object.body === "string") {
            return object.body;
          }
          return new TextDecoder().decode(object.body);
        },
        writeHttpMetadata(headers) {
          if (object.httpMetadata.contentType) {
            headers.set("Content-Type", object.httpMetadata.contentType);
          }
        },
      };
    },
    async delete(key) {
      objects.delete(key);
    },
    async list({ prefix = "", limit = 1000 } = {}) {
      return {
        objects: [...objects.keys()]
          .filter((key) => key.startsWith(prefix))
          .slice(0, limit)
          .map((key) => ({ key })),
      };
    },
  };
}

function makeGenerationQueue() {
  const messages = [];
  return {
    messages,
    async send(message) {
      messages.push(message);
    },
  };
}

test("Cloudflare generation uses browser-provided API settings without echoing the key", async () => {
  const seenRequests = [];
  const imageBucket = makeImageBucket();
  const formData = new FormData();
  formData.set("jobId", "job-cloudflare");
  formData.set("prompt", "Create a simple product poster");
  formData.set("ratio", "4:5");
  formData.set("size", "1024x1280");
  formData.set("format", "png");
  formData.set("reasoningEffort", "high");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");

  const response = await handleApiRequest(new Request("https://studio.example/api/generate", {
    method: "POST",
    body: formData,
  }), {
    imageBucket,
    async fetchImpl(url, init) {
      seenRequests.push({
        url,
        auth: init.headers.Authorization,
        body: JSON.parse(init.body),
      });
      return makeSseResponse();
    },
  });

  const text = await response.text();
  const events = parseSseEvents(text);
  const chunkEvents = events.filter((event) => event.eventName === "final_image_chunk");
  const savedEvent = events.find((event) => event.eventName === "saved");
  const imageUrl = savedEvent.payload.item.imageUrl;

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 1);
  assert.equal(seenRequests[0].url, "https://example.test/v1/responses");
  assert.equal(seenRequests[0].auth, "Bearer test-browser-key");
  assert.equal(seenRequests[0].body.model, "gpt-5.5");
  assert.match(text, /event: saved/);
  assert.doesNotMatch(text, /^event: final_image$/m);
  assert.equal(chunkEvents.length, 0);
  assert.match(imageUrl, /^\/api\/images\/images%2F\d{4}-\d{2}-\d{2}%2Fcloudflare-/);
  assert.equal(savedEvent.payload.item.thumbnailUrl, imageUrl);
  assert.equal(Number.isFinite(Number(savedEvent.payload.item.generationDurationMs)), true);
  assert.match(savedEvent.payload.item.generationStartedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(savedEvent.payload.item.generationCompletedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(imageBucket.objects.size, 1);
  assert.doesNotMatch(text, /data:image\/png;base64,ZmluYWw=/);
  assert.doesNotMatch(text, /test-browser-key/);

  const imageResponse = await handleApiRequest(new Request(`https://studio.example${imageUrl}`), {
    imageBucket,
  });
  assert.equal(imageResponse.status, 200);
  assert.equal(imageResponse.headers.get("Content-Type"), "image/png");
  assert.equal(new TextDecoder().decode(await imageResponse.arrayBuffer()), "final");
});

test("Cloudflare generation fails clearly when the R2 image bucket is not bound", async () => {
  const seenRequests = [];
  const formData = new FormData();
  formData.set("jobId", "job-cloudflare");
  formData.set("prompt", "Create a simple product poster");
  formData.set("ratio", "4:5");
  formData.set("size", "1024x1280");
  formData.set("format", "png");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");

  const response = await handleApiRequest(new Request("https://studio.example/api/generate", {
    method: "POST",
    body: formData,
  }), {
    async fetchImpl() {
      seenRequests.push(true);
      return makeSseResponse();
    },
  });

  const text = await response.text();

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 0);
  assert.match(text, /event: error/);
  assert.match(text, /IMAGE_BUCKET/);
});

test("Cloudflare async generation queues long jobs and exposes completed task snapshots", async () => {
  const seenRequests = [];
  const imageBucket = makeImageBucket();
  const generationQueue = makeGenerationQueue();
  const formData = new FormData();
  formData.set("jobId", "job-async");
  formData.set("clientSessionId", "session-async");
  formData.set("prompt", "Create a simple product poster");
  formData.set("ratio", "1:1");
  formData.set("size", "2048x2048");
  formData.set("format", "png");
  formData.set("reasoningEffort", "low");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");

  const response = await handleApiRequest(new Request("https://studio.example/api/generate", {
    method: "POST",
    body: formData,
  }), {
    imageBucket,
    generationQueue,
    async fetchImpl() {
      throw new Error("fetch should run in the queue consumer");
    },
  });
  const text = await response.text();
  const events = parseSseEvents(text);

  assert.equal(response.status, 200);
  assert.equal(generationQueue.messages.length, 1);
  assert.equal(events.at(-1).eventName, "queued");
  assert.doesNotMatch(text, /test-browser-key/);

  await handleGenerationQueue({
    messages: [
      {
        body: generationQueue.messages[0],
        acked: false,
        ack() {
          this.acked = true;
        },
      },
    ],
  }, {
    IMAGE_BUCKET: imageBucket,
  }, {
    async fetchImpl(url, init) {
      seenRequests.push({
        url,
        auth: init.headers.Authorization,
        body: JSON.parse(init.body),
      });
      return makeSseResponse("YXN5bmMtZmluYWw=");
    },
  });

  const tasksResponse = await handleApiRequest(new Request("https://studio.example/api/generation/tasks", {
    headers: {
      "x-client-session-id": "session-async",
    },
  }), {
    imageBucket,
  });
  const tasks = await tasksResponse.json();

  assert.equal(seenRequests.length, 1);
  assert.equal(seenRequests[0].auth, "Bearer test-browser-key");
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].status, "completed");
  assert.match(tasks[0].item.imageUrl, /^\/api\/images\//);
  assert.equal([...imageBucket.objects.keys()].some((key) => key.startsWith("generation-requests/")), false);
});

test("Cloudflare image proxy rejects invalid keys", async () => {
  const imageBucket = makeImageBucket();
  const response = await handleApiRequest(new Request("https://studio.example/api/images/..%2Fsecret.png"), {
    imageBucket,
  });

  assert.equal(response.status, 400);
});

test("Cloudflare config endpoint never returns a saved API key", async () => {
  const response = await handleApiRequest(new Request("https://studio.example/api/config"));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.apiKeyConfigured, false);
  assert.equal("apiKey" in payload, false);
  assert.equal(payload.responsesModel, "gpt-5.5");
  assert.equal(payload.defaults.size, "1024x1280");
});

test("Cloudflare PPT generation uses browser-provided API settings and returns a downloadable deck", async () => {
  const seenRequests = [];
  const formData = new FormData();
  formData.set("topic", "Quarterly launch recap");
  formData.set("pageCount", "1");
  formData.set("stylePreset", "business");
  formData.set("dynamicPreset", "none");
  formData.set("transitionPreset", "none");
  formData.set("transitionSpeed", "medium");
  formData.set("autoAdvanceSeconds", "0");
  formData.set("reasoningEffort", "high");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");

  const response = await handleApiRequest(new Request("https://studio.example/api/ppt/generate", {
    method: "POST",
    body: formData,
  }), {
    async fetchImpl(url, init) {
      const body = JSON.parse(init.body);
      seenRequests.push({
        url,
        auth: init.headers.Authorization,
        body,
      });

      if (body?.text?.format?.name === "ppt_deck_outline") {
        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              title: "Quarterly launch recap",
              summary: "One-slide recap",
              slides: [
                {
                  slideNumber: 1,
                  title: "Launch recap",
                  keyMessage: "Growth is on track",
                  visualBrief: "Clean business slide",
                  speakerNotes: "Discuss launch metrics",
                },
              ],
            }),
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      return makeSseResponse("aW1hZ2UtYnl0ZXM=");
    },
  });

  const text = await response.text();

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 2);
  assert.deepEqual(seenRequests.map((entry) => entry.url), [
    "https://example.test/v1/responses",
    "https://example.test/v1/responses",
  ]);
  assert.deepEqual(seenRequests.map((entry) => entry.auth), [
    "Bearer test-browser-key",
    "Bearer test-browser-key",
  ]);
  assert.deepEqual(seenRequests.map((entry) => entry.body.model), ["gpt-5.5", "gpt-5.5"]);
  assert.match(text, /event: outline/);
  assert.match(text, /event: slide_saved/);
  assert.match(text, /event: deck_saved/);
  assert.match(text, /data:application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation;base64,/);
  assert.doesNotMatch(text, /test-browser-key/);
});
