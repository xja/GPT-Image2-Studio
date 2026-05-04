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
  assert.ok(chunkEvents.length > 0);
  assert.equal(chunkEvents.map((event) => event.payload.chunk).join(""), "ZmluYWw=");
  assert.equal(imageUrl, "");
  assert.equal(savedEvent.payload.item.thumbnailUrl, "");
  assert.equal(Number.isFinite(Number(savedEvent.payload.item.generationDurationMs)), true);
  assert.match(savedEvent.payload.item.generationStartedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(savedEvent.payload.item.generationCompletedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(imageBucket.objects.size, 1);
  assert.doesNotMatch(text, /data:image\/png;base64,ZmluYWw=/);
  assert.doesNotMatch(text, /test-browser-key/);
});

test("Cloudflare generation reports the server image URL after best-effort R2 storage", async () => {
  const imageBucket = makeImageBucket();
  const formData = new FormData();
  formData.set("jobId", "job-cloudflare");
  formData.set("prompt", "Create a large kitchen scene");
  formData.set("ratio", "1:1");
  formData.set("size", "2048x2048");
  formData.set("format", "png");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");

  const response = await handleApiRequest(new Request("https://studio.example/api/generate", {
    method: "POST",
    body: formData,
  }), {
    imageBucket,
    async fetchImpl() {
      return makeSseResponse();
    },
  });

  const events = parseSseEvents(await response.text());
  const savedIndex = events.findIndex((event) => event.eventName === "saved");
  const serverImageIndex = events.findIndex((event) => event.eventName === "server_image");
  const serverImageEvent = events[serverImageIndex];

  assert.equal(response.status, 200);
  assert.ok(savedIndex >= 0);
  assert.ok(serverImageIndex > savedIndex);
  assert.match(serverImageEvent.payload.item.imageUrl, /^\/api\/images\/images%2F/);
  assert.equal(serverImageEvent.payload.item.thumbnailUrl, serverImageEvent.payload.item.imageUrl);
  assert.equal(imageBucket.objects.size, 1);
});

test("Cloudflare generation still returns chunked browser image when R2 image storage fails", async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  const imageBucket = makeImageBucket();
  const originalPut = imageBucket.put;
  imageBucket.put = async function put(key, value, options = {}) {
    if (String(key).startsWith("images/")) {
      throw new Error("R2 write failed");
    }
    return originalPut.call(this, key, value, options);
  };
  const formData = new FormData();
  formData.set("jobId", "job-cloudflare");
  formData.set("prompt", "Create a simple product poster");
  formData.set("ratio", "4:5");
  formData.set("size", "1024x1280");
  formData.set("format", "png");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");

  let response;
  let text = "";
  try {
    response = await handleApiRequest(new Request("https://studio.example/api/generate", {
      method: "POST",
      body: formData,
    }), {
      imageBucket,
      async fetchImpl() {
        return makeSseResponse();
      },
    });
    text = await response.text();
  } finally {
    console.warn = originalWarn;
  }

  const events = parseSseEvents(text);
  const chunkEvents = events.filter((event) => event.eventName === "final_image_chunk");
  const savedEvent = events.find((event) => event.eventName === "saved");

  assert.equal(response.status, 200);
  assert.ok(chunkEvents.length > 0);
  assert.equal(chunkEvents.map((event) => event.payload.chunk).join(""), "ZmluYWw=");
  assert.ok(savedEvent);
  assert.equal(savedEvent.payload.item.imageUrl, "");
  assert.equal(savedEvent.payload.item.thumbnailUrl, "");
  assert.equal(savedEvent.payload.item.storageError, undefined);
  assert.doesNotMatch(text, /^event: error$/m);
  assert.match(text, /event: complete/);
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

test("Cloudflare interactive generation streams chunks even when a queue binding exists", async () => {
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
    async fetchImpl(url, init) {
      seenRequests.push({
        url,
        auth: init.headers.Authorization,
        body: JSON.parse(init.body),
      });
      return makeSseResponse("aW50ZXJhY3RpdmUtZmluYWw=");
    },
  });
  const text = await response.text();
  const events = parseSseEvents(text);

  assert.equal(response.status, 200);
  assert.equal(generationQueue.messages.length, 0);
  assert.equal(seenRequests.length, 1);
  assert.equal(seenRequests[0].auth, "Bearer test-browser-key");
  assert.ok(events.some((event) => event.eventName === "final_image_chunk"));
  assert.ok(events.some((event) => event.eventName === "saved"));
  assert.ok(events.some((event) => event.eventName === "complete"));
  assert.equal(events.some((event) => event.eventName === "queued"), false);
  assert.doesNotMatch(text, /test-browser-key/);
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
