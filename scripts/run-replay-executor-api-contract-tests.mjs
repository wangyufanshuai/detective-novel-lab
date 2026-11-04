import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("app/api/v1/command/town/replay/execute/route.ts", "utf8");
const openapi = JSON.parse(fs.readFileSync("public/openapi.v1.json", "utf8"));
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.match(route, /adminGuard\(request\)/, "replay execution is admin guarded");
assert.match(route, /commandsForRun\(/, "replay execution uses the persisted command stream");
assert.match(route, /snapshotsForRun\(/, "replay execution resolves private runtime snapshots");
assert.match(route, /executeReplayFromCheckpoint\(/, "route delegates to the deterministic engine executor");
assert.match(route, /targetSnapshot\?\.replayDigest/, "target checkpoint receipt can be used as the expected digest");
assert.ok(openapi.paths?.["/api/v1/command/town/replay/execute"]?.post, "OpenAPI advertises replay execution");
assert.equal(packageJson.scripts["test:replay-executor"], "node scripts/run-replay-executor-tests.mjs");

console.log(JSON.stringify({
  ok: true,
  suite: "replay-executor-api-contract",
  endpoint: "/api/v1/command/town/replay/execute",
  guard: "admin",
  source: "persisted-command-stream"
}));
