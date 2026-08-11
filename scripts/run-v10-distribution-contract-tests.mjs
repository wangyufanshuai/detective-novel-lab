import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { V10_EXPECTED_API_ROUTES, V10_PROTECTED_PUBLIC_HASH } from "./lib/v10-release.mjs";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const packageJson = JSON.parse(read("package.json"));
for (const script of [
  "test:v10-distribution",
  "quality:v10-supply-chain",
  "qa:v10-distribution",
  "qa:v10-docker",
  "quality:v10-clean-worktree"
]) assert.equal(typeof packageJson.scripts[script], "string", `package exposes ${script}`);

const gate = read("scripts/run-release-candidate-gate.mjs");
assert.match(gate, /v10\.0/);
assert.match(gate, /next-typegen/);
assert.match(gate, /run-v10-supply-chain-audit\.mjs/);
assert.match(gate, /run-v10-distribution-smoke\.mjs/);
assert.match(gate, /qa:static-reader[\s\S]{0,160}--public-only/, "RC validates the byte-locked public reader without exporting it");
assert.ok(gate.indexOf('label: "production-build"') < gate.indexOf('label: "campaign-playthrough-24-case"'), "production build precedes production Campaign playthrough");
for (const forbidden of ["qa:" + "release-local", "public-catalog:" + "build", "dataset:" + "export", "5000", "10000"]) {
  assert.equal(gate.includes(forbidden), false, `v10 gate excludes ${forbidden}`);
}

const clean = read("scripts/run-v10-clean-environment.mjs");
assert.match(clean, /quality:rc/);
assert.match(clean, /quality-rc-1/);
assert.match(clean, /quality-rc-2/);
assert.match(clean, /resetDerivedState/);
assert.match(clean, /npm-ci/);
assert.match(clean, /next-typegen/);
const worktree = read("scripts/run-v10-clean-worktree.mjs");
assert.match(worktree, /worktree[",\s]+"add"/);
assert.match(worktree, /V10_PROTECTED_PUBLIC_HASH/);
assert.match(worktree, /fs\.cpSync/);
assert.doesNotMatch(worktree, /git["',\s]+add|git["',\s]+commit/);

const evidence = read("scripts/run-v10-release-evidence.mjs");
assert.match(evidence, /source-files\.sha256/);
assert.match(evidence, /dependency-summary\.json/);
assert.match(evidence, /release-manifest\.json/);
assert.doesNotMatch(evidence, /process\.env\.(?:DEEPSEEK|SILICONFLOW)_API_KEY/);
assert.match(read("scripts/run-static-reader-qa.mjs"), /publicOnly[\s\S]*readDatasetPackageReader/, "Static reader owns a read-only public mode");
assert.equal(read("scripts/lib/v10-release.mjs").includes(V10_PROTECTED_PUBLIC_HASH), true);

const dockerfile = read("Dockerfile");
assert.match(dockerfile, /RUN npm ci/);
assert.match(dockerfile, /npm prune --omit=dev/);
assert.match(dockerfile, /HEALTHCHECK/);
const dockerIgnore = read(".dockerignore");
const dockerIgnoreLines = new Set(dockerIgnore.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
for (const entry of [".env", ".env.local", "data", "outputs", ".git", "node_modules", ".next"]) assert.equal(dockerIgnoreLines.has(entry), true, `.dockerignore excludes ${entry}`);

const fixture = JSON.parse(read("tests/fixtures/save-compatibility-v10.json"));
assert.deepEqual(Object.keys(fixture.pointers).sort(), ["corrupt", "current", "legacy", "stale"]);
assert.deepEqual(Object.keys(fixture.runtimes).sort(), ["corrupt", "current", "legacy", "stale"]);

for (const documentPath of [
  "docs/v10.0-distribution-runbook.md",
  "docs/v10.0-migration-policy.md",
  "docs/v10.0-validation-report.md"
]) assert.equal(fs.existsSync(path.join(root, documentPath)), true, `${documentPath} is present`);

const routeCount = execFileSync("rg", ["--files", "app/api", "-g", "route.ts"], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean).length;
assert.equal(routeCount, V10_EXPECTED_API_ROUTES, "v10 keeps the frozen API route inventory");

console.log(JSON.stringify({ ok: true, suite: "v10-distribution-contracts", apiRoutes: routeCount, checks: ["clean-worktree", "two-rc-runs", "distribution-smoke", "docker-boundary", "save-fixtures", "release-evidence", "protected-public"] }));
