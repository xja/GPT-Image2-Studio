import test from "node:test";
import assert from "node:assert/strict";

import {
  API_RUNTIME_CAPABILITIES,
  getApiRouteCapability,
  isApiRouteSupported,
} from "../lib/api-contract.mjs";

test("API capability matrix documents local and Cloudflare runtime differences", () => {
  assert.equal(isApiRouteSupported("local", "POST", "/api/output/open"), true);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/output/open"), false);

  assert.deepEqual(getApiRouteCapability("cloudflare", "POST", "/api/output/open"), {
    method: "POST",
    path: "/api/output/open",
    local: "supported",
    cloudflare: "unsupported",
    reason: "Cloudflare cannot open a local filesystem directory.",
  });

  assert.equal(API_RUNTIME_CAPABILITIES.some((route) => route.path === "/api/generate"), true);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/generate"), true);
  assert.equal(isApiRouteSupported("local", "POST", "/api/creation/logo-batch"), true);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/creation/logo-batch"), true);
});

test("Cloudflare unsupported API routes use the shared capability contract", async () => {
  const worker = await import("../cloudflare-pages-worker.mjs");
  const response = await worker.handleApiRequest(
    new Request("https://studio.example/api/output/open", { method: "POST" }),
  );
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "unsupported_runtime_capability");
  assert.equal(payload.runtime, "cloudflare");
  assert.equal(payload.path, "/api/output/open");
});
