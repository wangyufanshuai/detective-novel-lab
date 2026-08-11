import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { hashPublicArtifactTree } from "./public-artifact-safety-lib.mjs";
import {
  V10_PROTECTED_PUBLIC_HASH,
  V10_PROTECTED_PUBLIC_PATHS,
  gitOutput,
  npmExecutable,
  npxExecutable,
  parseLastJson,
  recreateDirectory,
  runCommand,
  summarizeCommand,
  writeJson
} from "./lib/v10-release.mjs";

const root = process.cwd();
const reports = [];
const npm = npmExecutable();
const npx = npxExecutable();
const allowedInitialUntracked = V10_PROTECTED_PUBLIC_PATHS.map((item) => item.replace(/\\/g, "/"));
const trackedOutputs = new Set(execFileSync("git", ["ls-files", "-z", "--", "outputs"], { cwd: root })
  .toString("utf8")
  .split("\0")
  .filter(Boolean)
  .map((item) => item.replace(/\\/g, "/")));

function notice(label, phase, extra = {}) {
  process.stderr.write(`${JSON.stringify({ type: "v10-clean-stage", label, phase, ...extra })}\n`);
}

function assertCleanSource() {
  const status = gitOutput(root, ["status", "--porcelain", "--untracked-files=all"])
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => !allowedInitialUntracked.some((prefix) => line.slice(3).replace(/\\/g, "/").startsWith(`${prefix}/`)));
  if (status.length) throw new Error("Clean environment contains source changes outside the byte-locked public snapshot.");
  for (const name of ["node_modules", ".next", "data"]) {
    if (fs.existsSync(path.join(root, name))) throw new Error(`Clean environment preflight found derived directory ${name}.`);
  }
  const outputRoot = path.join(root, "outputs");
  if (fs.existsSync(outputRoot)) {
    const walk = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(target);
        else if (!trackedOutputs.has(path.relative(root, target).replace(/\\/g, "/"))) throw new Error("Clean environment preflight found an untracked derived output.");
      }
    };
    walk(outputRoot);
  }
  const protectedTree = hashPublicArtifactTree({ root, paths: V10_PROTECTED_PUBLIC_PATHS });
  if (protectedTree.treeHash !== V10_PROTECTED_PUBLIC_HASH) throw new Error("Clean environment has the wrong protected public snapshot.");
  return protectedTree;
}

function resetDerivedState() {
  for (const name of [".next", "data", "test-results", "playwright-report", "blob-report"]) {
    const target = path.resolve(root, name);
    if (!target.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error("Derived-state cleanup escaped the clean worktree.");
    fs.rmSync(target, { recursive: true, force: true });
  }
  const outputRoot = path.join(root, "outputs");
  const cleanOutputs = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        cleanOutputs(target);
        if (fs.readdirSync(target).length === 0) fs.rmdirSync(target);
      } else if (!trackedOutputs.has(path.relative(root, target).replace(/\\/g, "/"))) {
        fs.rmSync(target, { force: true });
      }
    }
  };
  cleanOutputs(outputRoot);
}

async function stage(label, command, args, options = {}) {
  notice(label, "start");
  const result = await runCommand(command, args, {
    cwd: root,
    timeoutMs: options.timeoutMs,
    forwardStderr: options.forwardStderr,
    env: {
      ...process.env,
      AI_PROVIDER: "mock",
      DEEPSEEK_API_KEY: "",
      SILICONFLOW_API_KEY: ""
    }
  });
  const report = summarizeCommand(label, result, [root]);
  reports.push(report);
  notice(label, "finish", { ok: result.ok, durationMs: result.durationMs });
  if (!result.ok) throw new Error(`${label} failed: ${report.diagnostic || "no diagnostic"}`);
  return { result, parsed: parseLastJson(result.stdout) };
}

let protectedTree;
try {
  protectedTree = assertCleanSource();
  await stage("npm-ci", npm, ["ci", "--no-audit", "--no-fund"], { timeoutMs: 900_000 });
  await stage("playwright-chromium", npx, ["playwright", "install", "chromium"], { timeoutMs: 600_000 });
  await stage("next-typegen", npx, ["next", "typegen"], { timeoutMs: 180_000 });
  await stage("typescript", npx, ["tsc", "--noEmit"], { timeoutMs: 240_000 });
  await stage("production-build", npm, ["run", "build"], { timeoutMs: 900_000 });
  await stage("online-production-advisory", npm, ["audit", "--omit=dev", "--registry=https://registry.npmjs.org", "--json"], { timeoutMs: 180_000 });

  resetDerivedState();
  const first = await stage("quality-rc-1", npm, ["run", "quality:rc", "--", "--json"], { timeoutMs: 2_400_000, forwardStderr: true });
  if (!first.parsed?.ok) throw new Error("First quality:rc run did not return a passing report.");

  resetDerivedState();
  const second = await stage("quality-rc-2", npm, ["run", "quality:rc", "--", "--json"], { timeoutMs: 2_400_000, forwardStderr: true });
  if (!second.parsed?.ok) throw new Error("Second quality:rc run did not return a passing report.");

  const docker = await stage("linux-docker-smoke", process.execPath, ["scripts/run-v10-docker-smoke.mjs", "--optional"], { timeoutMs: 1_800_000 });
  if (!docker.parsed?.ok) throw new Error("Docker smoke did not return a passing or explicitly skipped result.");

  const generated = await stage("release-evidence", process.execPath, ["scripts/run-v10-release-evidence.mjs", "--json"], { timeoutMs: 120_000 });
  if (!generated.parsed?.ok) throw new Error("Release evidence generation did not return a passing report.");

  const cleanReport = {
    formatVersion: 1,
    releaseLine: "v10.0",
    ok: true,
    sourceTree: gitOutput(root, ["rev-parse", "HEAD^{tree}"]),
    environment: { node: process.version, platform: process.platform, architecture: process.arch },
    protectedPublic: { fileCount: protectedTree.fileCount, treeHash: protectedTree.treeHash },
    reproducibility: {
      startedWithout: ["node_modules", ".next", "untracked outputs", "data"],
      qualityRcRuns: [
        { ok: true, stageCount: first.parsed.stageCount, durationMs: first.parsed.durationMs },
        { ok: true, stageCount: second.parsed.stageCount, durationMs: second.parsed.durationMs }
      ]
    },
    docker: docker.parsed,
    stages: reports
  };
  writeJson(path.join(root, "outputs", "v10-distribution", "clean-environment-report.json"), cleanReport);
  const safety = await stage("release-evidence-safety", process.execPath, ["scripts/run-v10-release-evidence-safety.mjs"], { timeoutMs: 180_000 });
  if (!safety.parsed?.ok) throw new Error("Release evidence safety did not return a passing report.");
  console.log(JSON.stringify({ ...cleanReport, stages: reports }));
} catch (error) {
  const failure = { ok: false, releaseLine: "v10.0", stages: reports, error: error instanceof Error ? error.message : String(error) };
  console.log(JSON.stringify(failure));
  process.exitCode = 1;
}
