import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const file = path.join(root, "outputs", "worldpackage-browser-qa-dock-court-market-town.json");
const receipt = JSON.parse(await fs.readFile(file, "utf8"));

assert.equal(receipt.schema, "worldpackage-browser-qa.v1");
assert.equal(receipt.evidenceClass, "local-world-package-browser-campaign");
assert.equal(receipt.status, "candidate");
assert.equal(receipt.humanGate, "pending-human-comprehension-and-ui-review");
assert.equal(receipt.package.id, "dock-court-market-town");
assert.equal(receipt.package.selectionReceiptSchema, "world-package-receipt.v1");
assert.ok(receipt.world.id);
assert.ok(receipt.world.caseId);
assert.ok(receipt.world.caseTitle);
assert.equal(receipt.browser.reducedMotion, "reduce");
assert.deepEqual(receipt.browser.errors, []);
assert.ok(receipt.browser.setupRequests.includes("/api/v1/command/town/create"));
assert.ok(receipt.browser.setupRequests.includes("/api/v1/command/player/world-pack/select"));
assert.ok(receipt.browser.setupRequests.includes("/api/v1/command/town/case/extract"));
assert.ok(receipt.browser.requests.some((item) => item.endsWith("/state")));
assert.ok(receipt.browser.requests.includes("/api/v1/query/case/room-projection"));
assert.ok(receipt.browser.assetRequests.some((item) => item.endsWith("/procedural-room-candidate.glb")));
assert.equal(receipt.observations.length, 2);
const worldConsole = receipt.observations.find((item) => item.surface === "world-console");
const room = receipt.observations.find((item) => item.surface === "investigation-room");
assert.ok(worldConsole);
assert.equal(worldConsole.runtimeMode, "server");
assert.equal(worldConsole.caseId, receipt.world.caseId);
assert.ok(room);
assert.equal(room.runtime.runtimeStatus, "ready");
assert.equal(room.runtime.assetStatus, "candidate-only");
assert.equal(room.runtime.contextLost, false);
assert.equal(room.runtime.frameCount >= 10, true);
assert.equal(room.runtime.roomId, room.projection.roomId);
assert.equal(room.runtime.caseId, receipt.world.caseId);
assert.equal(room.axeSevereViolations, 0);
assert.equal(room.mobileAxeSevereViolations, 0);
assert.equal(room.projection.caseId, receipt.world.caseId);
assert.ok(room.projection.roomId);
assert.equal(room.mobileOverflow <= 1, true);
assert.equal(room.narrowOverflow <= 1, true);
assert.equal(receipt.boundaries.realWorldPackageInput, true);
assert.equal(receipt.boundaries.syntheticSourceFixture, false);
assert.equal(receipt.boundaries.productionUiClaim, false);
assert.equal(receipt.boundaries.humanComprehensionReview, "pending");
assert.deepEqual(receipt.failures, []);

console.log(JSON.stringify({
  ok: true,
  suite: "real-worldpackage-browser-qa-receipts",
  schema: receipt.schema,
  packageId: receipt.package.id,
  caseId: receipt.world.caseId,
  roomId: room.projection.roomId,
  desktopRuntime: worldConsole.runtimeMode,
  runtimeStatus: room.runtime.runtimeStatus,
  frameCount: room.runtime.frameCount,
  mobileOverflow: room.mobileOverflow,
  narrowOverflow: room.narrowOverflow,
  errors: receipt.browser.errors.length
}));
