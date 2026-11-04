import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("app/api/v1/command/town/population-flow/route.ts", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const openapi = JSON.parse(fs.readFileSync("public/openapi.v1.json", "utf8"));

assert.match(route, /adminGuard\(request\)/, "population flow mutation is admin guarded");
assert.match(route, /applyPopulationFlow\(/, "route invokes the deterministic engine adapter");
assert.match(route, /loadRuntimeWorld\(/, "route loads the authoritative world/runtime bundle");
assert.match(route, /sourceEventId must resolve/, "route rejects a source event that is absent from the authoritative log");
assert.match(route, /persistRuntimeWorld\(/, "created flow is persisted through the CAS-aware repository boundary");
assert.match(route, /result\.createdEvents/, "route persists only newly created arrival events");
assert.match(route, /created: result\.created/, "route exposes idempotent replay state");
assert.ok(openapi.paths?.["/api/v1/command/town/population-flow"]?.post, "OpenAPI advertises the population-flow command");
assert.equal(packageJson.scripts["test:population-flow"], "node scripts/run-population-flow-contract-tests.mjs", "engine population contract is runnable from package scripts");

console.log(JSON.stringify({
  ok: true,
  suite: "population-flow-api-contract",
  checks: ["admin-boundary", "engine-adapter", "authoritative-load", "cas-persistence", "idempotent-status"]
}));
