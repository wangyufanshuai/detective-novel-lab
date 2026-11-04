import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { validateWorldAssetManifest } from "../packages/engine/src/world-asset-manifest.ts";

const root = process.cwd();
const candidateRoot = path.join(root, "docs", "3d-rooms", "candidates", "authored-v2");
const readJson = async (relativePath) => JSON.parse(await fs.readFile(path.join(candidateRoot, relativePath), "utf8"));
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

const candidate = await readJson("authored-candidate.json");
const manifest = await readJson("asset-manifest.json");
const ledger = await readJson("license-ledger.json");
const props = await readJson("input/props.json");
const layout = await readJson("input/room-layout.json");
const rubric = await fs.readFile(path.join(candidateRoot, "art-acceptance-rubric.md"), "utf8");

assert.equal(candidate.schema, "game-room.authored-candidate.v2");
assert.equal(candidate.variant, "authored-local-v2");
assert.equal(candidate.status, "candidate-only");
assert.equal(candidate.humanApproval, false);
assert.equal(candidate.externalAssets, false);
assert.equal(candidate.source.artAcceptanceRubric, "art-acceptance-rubric.md");
assert.match(rubric, /## A\. Asset authorization/);
assert.match(rubric, /## B\. Function review/);
assert.match(rubric, /## C\. Form review/);
assert.match(rubric, /## D\. Runtime gate/);
assert.match(rubric, /Promote only when A, B, C, and D are signed/);
assert.equal(manifest.schema, "world-asset-manifest.v1");
const manifestValidation = validateWorldAssetManifest(manifest, "fog-lamp-evidence-room");
assert.equal(manifestValidation.ok, true, manifestValidation.errors.join("; "));
assert.equal(manifest.policy.licenseRequired, true);
assert.equal(manifest.policy.humanReviewRequired, true);
assert.equal(manifest.policy.runtimeVerificationRequired, true);
assert.equal(ledger.externalDownloads, false);
assert.equal(ledger.assets.length, manifest.assets.length);
for (const asset of manifest.assets) {
  const ledgerAsset = ledger.assets.find((entry) => entry.id === asset.id);
  assert.ok(ledgerAsset, `${asset.id} license ledger row`);
  assert.equal(ledgerAsset.path, asset.path, `${asset.id} ledger path`);
  assert.equal(ledgerAsset.bytes, asset.bytes, `${asset.id} ledger bytes`);
  assert.equal(ledgerAsset.sha256, asset.sha256, `${asset.id} ledger sha256`);
  assert.deepEqual(ledgerAsset.dimensionsMeters, asset.dimensionsMeters, `${asset.id} ledger dimensions`);
  assert.equal(ledgerAsset.license, asset.license, `${asset.id} ledger license`);
}

const propById = new Map(props.assets.map((asset) => [asset.id, asset]));
for (const asset of manifest.assets) {
  const bytes = await fs.readFile(path.join(candidateRoot, asset.path));
  assert.equal(bytes.length, asset.bytes, `${asset.id} byte count`);
  assert.equal(hash(bytes), asset.sha256, `${asset.id} sha256`);
  assert.equal(asset.status, "candidate-only");
  assert.equal(asset.humanApproval, false);
  assert.equal(asset.runtimeVerified, false);
  if (propById.has(asset.id)) {
    assert.deepEqual(asset.dimensionsMeters, candidate.assets[asset.id].dimensionsMeters, `${asset.id} dimensions`);
    assert.ok(candidate.assets[asset.id].stats.triangleCount <= propById.get(asset.id).targetPolycount, `${asset.id} triangle budget`);
  }
}

assert.equal(propById.get("caseboard").semanticFront, "positive-y");
assert.equal(layout.instances.find((instance) => instance.id === "caseboard-east").rotationDegrees[2], 90);
assert.equal(layout.instances.find((instance) => instance.id === "caseboard-west").rotationDegrees[2], -90);
assert.equal(candidate.artReviewPreview.runtimeEligible, false);
assert.ok(candidate.room.stats.triangleCount <= 120000);
assert.deepEqual(candidate.room.stats.boundsMeters, [12, 8, 4.2]);
const publicRuntime = await fs.readFile(path.join(root, "public", "3d-rooms", "fog-lamp-evidence-room", "authored-room-candidate-v2.glb"));
assert.equal(hash(publicRuntime), candidate.room.sha256, "public v2 room bytes");
assert.equal(candidate.gateBoundary.function, "pending-human-review");
assert.equal(candidate.gateBoundary.runtime, "blocked-until-browser-capture-and-performance-receipt");

console.log(JSON.stringify({
  ok: true,
  suite: "authored-room-candidate",
  schema: candidate.schema,
  roomId: candidate.roomId,
  triangleCount: candidate.room.stats.triangleCount,
  meshCount: candidate.room.stats.meshCount,
  assets: manifest.assets.map((asset) => ({ id: asset.id, bytes: asset.bytes, sha256: asset.sha256 })),
  license: "project-local-original",
  gates: candidate.gateBoundary,
}));
