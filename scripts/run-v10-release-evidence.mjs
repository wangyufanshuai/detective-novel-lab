import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { hashPublicArtifactTree } from "./public-artifact-safety-lib.mjs";
import {
  V10_PROTECTED_PUBLIC_HASH,
  V10_PROTECTED_PUBLIC_PATHS,
  gitOutput,
  recreateDirectory,
  sha256,
  toPosix,
  trackedFiles,
  writeJson
} from "./lib/v10-release.mjs";

const root = process.cwd();
const jsonMode = process.argv.includes("--json");
const outputRoot = recreateDirectory(path.join(root, "outputs"), path.join(root, "outputs", "v10-distribution"), "v10 release evidence");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const sourceTree = gitOutput(root, ["write-tree"]);
const files = trackedFiles(root);
const protectedTree = hashPublicArtifactTree({ root, paths: V10_PROTECTED_PUBLIC_PATHS });
if (protectedTree.treeHash !== V10_PROTECTED_PUBLIC_HASH) throw new Error("Protected public snapshot does not match the frozen v10 hash.");

const sourceEntries = files.map((relativePath) => {
  const bytes = execFileSync("git", ["show", `:${relativePath}`], { cwd: root, encoding: null, maxBuffer: 20_000_000 });
  return { path: toPosix(relativePath), bytes: bytes.length, sha256: sha256(bytes) };
});
const allEntries = [...sourceEntries, ...protectedTree.entries]
  .sort((left, right) => left.path.localeCompare(right.path));
const checksumBody = `${allEntries.map((entry) => `${entry.sha256}  ${entry.path}`).join("\n")}\n`;
fs.writeFileSync(path.join(outputRoot, "source-files.sha256"), checksumBody, "utf8");

const supplyChainModule = path.join(root, "scripts", "run-v10-supply-chain-audit.mjs");
const supply = spawnSync(process.execPath, [supplyChainModule, "--json", "--output=outputs/v10-distribution/dependency-summary.json"], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, DEEPSEEK_API_KEY: "", SILICONFLOW_API_KEY: "" }
});
if (supply.status !== 0) throw new Error("Supply-chain summary generation failed.");
const dependencySummary = JSON.parse(fs.readFileSync(path.join(outputRoot, "dependency-summary.json"), "utf8"));

const manifest = {
  formatVersion: 1,
  releaseLine: "v10.0",
  productVersion: packageJson.version,
  source: {
    gitTree: sourceTree,
    byteBasis: "git-index-blob",
    trackedFileCount: sourceEntries.length,
    checksumFile: "source-files.sha256",
    checksumFileSha256: sha256(checksumBody)
  },
  protectedPublic: {
    provisioning: "external-byte-locked",
    paths: V10_PROTECTED_PUBLIC_PATHS,
    fileCount: protectedTree.fileCount,
    treeHash: protectedTree.treeHash
  },
  dependencies: {
    summaryFile: "dependency-summary.json",
    summarySha256: sha256(fs.readFileSync(path.join(outputRoot, "dependency-summary.json"))),
    lockfileSha256: dependencySummary.lockfile.sha256
  },
  distributionTargets: ["windows-production", "linux-container", "static-runtime", "server-runtime"],
  authorityFreeze: {
    campaigns: 4,
    routes: 8,
    treatments: 24,
    apiRoutes: 125,
    schemaChanges: 0,
    newEndpoints: 0
  },
  credentialPolicy: "runtime environment or local environment file only; no credential values are packaged",
  exclusions: ["local databases", "environment files", "build caches", "test results", "study exports", "developer outputs"]
};
writeJson(path.join(outputRoot, "release-manifest.json"), manifest);

const evidenceNames = ["dependency-summary.json", "release-manifest.json", "source-files.sha256"];
const evidenceChecksums = evidenceNames.map((name) => `${sha256(fs.readFileSync(path.join(outputRoot, name)))}  ${name}`).join("\n");
fs.writeFileSync(path.join(outputRoot, "SHA256SUMS"), `${evidenceChecksums}\n`, "utf8");

const result = {
  ok: true,
  releaseLine: manifest.releaseLine,
  sourceTree,
  trackedFileCount: sourceEntries.length,
  protectedPublicTreeHash: protectedTree.treeHash,
  evidenceFiles: ["SHA256SUMS", ...evidenceNames].sort()
};
console.log(jsonMode ? JSON.stringify(result) : JSON.stringify(result, null, 2));
