import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const candidateRoot = path.join(root, "docs", "3d-rooms", "candidates", "procedural-v1");
const candidate = JSON.parse(await fs.readFile(path.join(candidateRoot, "procedural-candidate.json"), "utf8"));
const manifest = JSON.parse(await fs.readFile(path.join(candidateRoot, "asset-manifest.json"), "utf8"));
const runtimeSource = await fs.readFile(path.join(root, "app", "components", "ProceduralRoomRuntime.tsx"), "utf8");
const publicPath = path.join(root, "public", "3d-rooms", "fog-lamp-evidence-room", "procedural-room-candidate.glb");
const bytes = await fs.readFile(publicPath);
const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
const roomAsset = manifest.assets.find((asset) => asset.id === "procedural-room");

assert.equal(candidate.schema, "game-room.procedural-candidate.v1");
assert.equal(candidate.roomId, "fog-lamp-evidence-room");
assert.equal(candidate.status, "candidate-only");
assert.equal(candidate.humanApproval, false);
assert.equal(roomAsset?.status, "candidate-only");
assert.equal(roomAsset?.humanApproval, false);
assert.equal(roomAsset?.runtimeVerified, false);
assert.equal(roomAsset?.bytes, bytes.byteLength);
assert.equal(roomAsset?.sha256, sha256);
assert.equal(candidate.room?.sha256, sha256);
assert.equal(candidate.room?.stats?.triangleCount, 1800);
assert.deepEqual(candidate.room?.stats?.boundsMeters, [12, 8, 4.2]);

for (const token of [
  'data-testid="procedural-room-runtime"',
  'data-asset-status="candidate-only"',
  "webglcontextlost",
  "prefers-reduced-motion",
  "RuntimeErrorBoundary",
  "data-p95-frame-ms",
  "候选 GLB"
]) {
  assert.equal(runtimeSource.includes(token), true, `runtime source includes ${token}`);
}
assert.equal(runtimeSource.includes('data-asset-status="accepted"'), false);
assert.match(candidate.gateBoundary?.runtime || "", /browser-capture-and-performance-receipt/);

const receipt = {
  schema: "game-room.runtime-candidate.v1",
  evidenceClass: "local-glb-runtime-contract",
  status: "candidate",
  roomId: candidate.roomId,
  asset: {
    id: roomAsset.id,
    path: roomAsset.path,
    bytes: bytes.byteLength,
    sha256,
    status: roomAsset.status,
    humanApproval: roomAsset.humanApproval,
    runtimeVerified: roomAsset.runtimeVerified
  },
  runtime: {
    loader: "@react-three/drei/useGLTF",
    fallback: "css-projection",
    contextLossFallback: true,
    reducedMotion: true,
    browserCapture: "pending"
  },
  boundaries: {
    candidateOnly: true,
    acceptedAssetClaim: false,
    functionGate: "pending-human-review",
    formGate: "blocked-until-approved-glb-and-review-renders",
    runtimeGate: "pending-browser-capture-and-performance-receipt"
  }
};
await fs.mkdir(path.join(root, "outputs"), { recursive: true });
await fs.writeFile(path.join(root, "outputs", "procedural-room-runtime-contract.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, suite: "procedural-room-runtime-contract", schema: receipt.schema, roomId: receipt.roomId, bytes: bytes.byteLength, sha256, status: receipt.status }));
