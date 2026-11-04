import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readWorldPackageDirectory } from "../lib/world-package-catalog.ts";
import { loadEngineForTool } from "./load-engine-for-tools.mjs";

const root = process.cwd();
const worldPackRoot = path.join(root, "world-packs");
const engine = await loadEngineForTool("v11-world-package-validation");
const campaigns = engine.listDetectiveCampaignDefinitions();
const packageIds = campaigns.map((campaign) => campaign.worldPackageIds[0]);
const directories = fs.readdirSync(worldPackRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

assert.equal(campaigns.length, 12, "the Alpha registry contains twelve Campaigns");
assert.equal(new Set(packageIds).size, 12, "each Campaign has a distinct primary WorldPackage");
assert.deepEqual(directories, [...packageIds].sort(), "the checked-in WorldPackage directory set exactly matches the Campaign registry");

const reports = packageIds.map((packageId) => {
  const source = readWorldPackageDirectory(path.join(worldPackRoot, packageId), root);
  assert.ok(source, `${packageId} can be read`);
  assert.equal(source.packageId, packageId, `${packageId} directory and manifest identity agree`);
  assert.equal(source.validation.ok, true, `${packageId} validates: ${source.validation.errors.join("; ")}`);
  assert.deepEqual(source.validation.errors, [], `${packageId} has no validation errors`);
  assert.equal(source.fileReceipts.length, source.fileCount, `${packageId} receipt enumerates every source file`);
  assert.equal(source.fileReceipts.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)), true, `${packageId} receipt binds SHA-256 for every source file`);
  return {
    packageId,
    fileCount: source.fileCount,
    bytes: source.bytes,
    contentHash: source.contentHash,
    fileReceiptCount: source.fileReceipts.length,
    warnings: source.validation.warnings
  };
});

console.log(JSON.stringify({
  ok: true,
  suite: "v11-world-packages",
  campaignCount: campaigns.length,
  packageCount: reports.length,
  warningCount: reports.reduce((sum, report) => sum + report.warnings.length, 0),
  packages: reports
}));
