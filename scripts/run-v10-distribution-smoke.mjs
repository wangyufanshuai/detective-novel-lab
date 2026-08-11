import assert from "node:assert/strict";
import { withReleaseCandidateServer } from "./lib/release-candidate-server.mjs";

async function checkedFetch(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20_000) });
  assert.equal(response.ok, true, `distribution request failed with status ${response.status}`);
  return response;
}

const result = await withReleaseCandidateServer({
  prefix: "v10-distribution",
  mode: "start",
  healthPath: "/api/v1/query/runtime/status"
}, async ({ baseUrl }) => {
  const runtime = await checkedFetch(`${baseUrl}/api/v1/query/runtime/status`).then((response) => response.json());
  assert.equal(runtime.ok, true);
  assert.equal(runtime.data?.service, "detective-town");
  assert.equal(runtime.data?.storage?.health, "ok");
  assert.equal(runtime.data?.storage?.schemaVersion, 4);

  const serverHtml = await checkedFetch(`${baseUrl}/?runtime=server&lang=en-US`).then((response) => response.text());
  const staticHtml = await checkedFetch(`${baseUrl}/?runtime=static&lang=en-US`).then((response) => response.text());
  assert.match(serverHtml, /<!DOCTYPE html|<html/i);
  assert.match(staticHtml, /<!DOCTYPE html|<html/i);
  const catalog = await checkedFetch(`${baseUrl}/review-catalog/index.json`).then((response) => response.json());
  const reader = await checkedFetch(`${baseUrl}/dataset-reader/detective-town-v3-5000-campaign/manifest-lite.json`).then((response) => response.json());
  assert.equal(typeof catalog, "object");
  assert.equal(typeof reader, "object");

  return {
    ok: true,
    target: process.platform === "win32" ? "windows-production" : "native-production",
    server: { pageStatus: 200, service: "detective-town", storageHealth: "ok", schemaVersion: 4 },
    static: { pageStatus: 200, catalogStatus: 200, readerStatus: 200 }
  };
});

console.log(JSON.stringify(result));
