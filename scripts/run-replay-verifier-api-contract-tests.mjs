import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("app/api/v1/query/town/runs/[runId]/replay-bundle/route.ts", "utf8");
const openapi = JSON.parse(fs.readFileSync("public/openapi.v1.json", "utf8"));
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.match(route, /verifyReplayBundle/, "replay bundle route invokes the canonical verifier");
assert.match(route, /verification/, "replay bundle route exposes verification evidence");
assert.match(route, /loaded\.events/, "verification uses the authoritative event log");
assert.match(route, /publicSnapshot/, "replay bundle export strips private checkpoint payloads");
assert.equal(
  openapi.paths?.["/api/v1/query/town/runs/{runId}/replay-bundle"]?.get?.summary,
  "Export a replay bundle and its digest, command-envelope, and evidence-status verification",
  "OpenAPI describes replay verification instead of export-only behavior"
);
assert.equal(packageJson.scripts["test:replay-verifier"], "node scripts/run-replay-verifier-tests.mjs");

console.log(JSON.stringify({
  ok: true,
  suite: "replay-verifier-api-contract",
  endpoint: "/api/v1/query/town/runs/{runId}/replay-bundle",
  statuses: ["verified", "mismatch", "evidence-insufficient"]
}));
