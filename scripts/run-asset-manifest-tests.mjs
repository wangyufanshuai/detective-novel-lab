import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateWorldAssetManifest } from "../packages/engine/src/world-asset-manifest.ts";
import { auditWorldAssetManifestFiles, exportWorldPackage, readWorldPackageDirectory, readWorldPackageSource, validateWorldPackageFiles } from "../lib/world-package-catalog.ts";

const validManifest = {
  schema: "world-asset-manifest.v1",
  packageId: "dock-court-market-town",
  version: "1.0.0",
  generatedAt: "2026-10-03T00:00:00.000Z",
  policy: {
    licenseRequired: true,
    humanReviewRequired: true,
    runtimeVerificationRequired: true
  },
  assets: [{
    id: "procedural-room",
    kind: "room",
    path: "assets/procedural-room.glb",
    sha256: "a".repeat(64),
    bytes: 1024,
    license: "project-local-original",
    source: "procedural-generator",
    status: "candidate-only",
    humanApproval: false,
    runtimeVerified: false,
    dimensionsMeters: [12, 8, 4.2]
  }]
};

const valid = validateWorldAssetManifest(validManifest, "dock-court-market-town");
assert.equal(valid.ok, true, valid.errors.join("; "));
assert.equal(valid.manifest.assets[0].status, "candidate-only");

const acceptedBeforeGates = validateWorldAssetManifest({
  ...validManifest,
  assets: [{ ...validManifest.assets[0], status: "accepted" }]
}, "dock-court-market-town");
assert.equal(acceptedBeforeGates.ok, false);
assert.ok(acceptedBeforeGates.errors.some((error) => error.includes("cannot be accepted")));

const source = readWorldPackageSource("dock-court-market-town");
assert.ok(source, "fixture WorldPackage is available");
const manifest = JSON.parse(String(source.files["manifest.json"]));
const packageReport = validateWorldPackageFiles({
  ...source.files,
  "manifest.json": JSON.stringify({ ...manifest, assetManifestPath: "asset-manifest.json" }),
  "asset-manifest.json": JSON.stringify(validManifest)
});
assert.equal(packageReport.ok, true, packageReport.errors.join("; "));
assert.equal(packageReport.package.assetManifest.assets.length, 1);
assert.equal(packageReport.summary.assetCount, 1);

const mismatchedPackage = validateWorldPackageFiles({
  ...source.files,
  "manifest.json": JSON.stringify({ ...manifest, assetManifestPath: "asset-manifest.json" }),
  "asset-manifest.json": JSON.stringify({ ...validManifest, packageId: "other-package" })
});
assert.equal(mismatchedPackage.ok, false);
assert.ok(mismatchedPackage.errors.some((error) => error.includes("packageId must be dock-court-market-town")));

const candidateRoot = path.join(process.cwd(), "docs", "3d-rooms", "candidates", "procedural-v1");
const candidateManifest = JSON.parse(await (await import("node:fs/promises")).readFile(path.join(candidateRoot, "asset-manifest.json"), "utf8"));
const candidateAudit = auditWorldAssetManifestFiles({ manifest: candidateManifest, rootDir: candidateRoot });
assert.equal(candidateAudit.ok, true, candidateAudit.errors.join("; "));
assert.equal(candidateAudit.fileReceipts.length, 4);
assert.equal(candidateAudit.bytes, 73076);
const tamperedAudit = auditWorldAssetManifestFiles({
  manifest: { ...candidateManifest, assets: candidateManifest.assets.map((asset, index) => index === 0 ? { ...asset, sha256: "b".repeat(64) } : asset) },
  rootDir: candidateRoot
});
assert.equal(tamperedAudit.ok, false);
assert.ok(tamperedAudit.errors.some((error) => error.includes("sha256")));

const workspaceRoot = process.cwd();
const tempPackageRoot = path.join(workspaceRoot, "world-packs");
const fixtureDir = fs.mkdtempSync(path.join(tempPackageRoot, "asset-manifest-test-"));
const fixturePackageId = path.basename(fixtureDir);
const fixtureOutputDir = path.join(workspaceRoot, "outputs", "world-package-exports", fixturePackageId);
try {
  fs.cpSync(source.dir, fixtureDir, { recursive: true });
  const fixtureBytes = Buffer.from("asset-binding-fixture", "utf8");
  const fixtureSha256 = (await import("node:crypto")).createHash("sha256").update(fixtureBytes).digest("hex");
  fs.mkdirSync(path.join(fixtureDir, "assets"), { recursive: true });
  fs.writeFileSync(path.join(fixtureDir, "assets", "fixture.bin"), fixtureBytes);
  const fixtureManifest = JSON.parse(fs.readFileSync(path.join(fixtureDir, "manifest.json"), "utf8"));
  fixtureManifest.id = fixturePackageId;
  fixtureManifest.assetManifestPath = "asset-manifest.json";
  fs.writeFileSync(path.join(fixtureDir, "manifest.json"), `${JSON.stringify(fixtureManifest, null, 2)}\n`);
  fs.writeFileSync(path.join(fixtureDir, "asset-manifest.json"), `${JSON.stringify({
    ...validManifest,
    packageId: fixturePackageId,
    assets: [{ ...validManifest.assets[0], id: "fixture", path: "assets/fixture.bin", sha256: fixtureSha256, bytes: fixtureBytes.byteLength }]
  }, null, 2)}\n`);
  const bound = readWorldPackageSource(fixturePackageId, workspaceRoot);
  assert.ok(bound?.validation.ok, bound?.validation.errors.join("; "));
  assert.ok(bound.fileReceipts.some((file) => file.name === "assets/fixture.bin"));
  assert.equal(bound.fileCount, 10);
  const exported = exportWorldPackage({ packageId: fixturePackageId, root: workspaceRoot, format: "folder" });
  assert.ok(exported.files.some((file) => file.path === "assets/fixture.bin"));
  assert.equal(fs.existsSync(path.join(fixtureOutputDir, "assets", "fixture.bin")), true);
  fs.writeFileSync(path.join(fixtureDir, "assets", "fixture.bin"), Buffer.from("tampered", "utf8"));
  const tamperedPackage = readWorldPackageDirectory(fixtureDir, workspaceRoot);
  assert.equal(tamperedPackage.validation.ok, false);
  assert.ok(tamperedPackage.validation.errors.some((error) => error.includes("sha256")));
} finally {
  fs.rmSync(fixtureOutputDir, { recursive: true, force: true });
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  suite: "asset-manifest",
  schema: "world-asset-manifest.v1",
  candidateCount: validManifest.assets.length,
  packageAssetCount: packageReport.summary.assetCount,
  acceptedGate: "blocked-until-human-and-runtime",
  candidateFileAudit: { files: candidateAudit.fileReceipts.length, bytes: candidateAudit.bytes, tamperDetected: true },
  packageFileBinding: { files: 10, exportIncludesAsset: true, tamperDetected: true }
}));
