import fs from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { hashPublicArtifactTree } from "./public-artifact-safety-lib.mjs";
import { stopProcessTree } from "./lib/release-candidate-server.mjs";

const jsonMode = process.argv.includes("--json");
const root = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const protectedPaths = ["public/dataset-reader", "public/review-catalog"];

const coreScripts = [
  "test:rules",
  "test:world",
  "test:persistent-town",
  "test:campaign-study",
  "test:world-invariants",
  "test:command-deck",
  "test:objective-first",
  "test:case-rhythm",
  "test:strategic-command",
  "test:strategic-pacing",
  "test:campaign-command-brief",
  "test:campaign-resolution-ledger",
  "test:final-detective-workspace",
  "test:district-fronts",
  "test:guided-workflow",
  "test:investigation-workspace",
  "test:context-actions",
  "test:command-deck-invariants",
  "test:map-lenses",
  "test:character-encounter",
  "test:investigation-turn",
  "test:world-consequence-ui",
  "test:campaign-content",
  "test:campaign-pacing",
  "test:campaign-transition",
  "test:presentation-ui",
  "test:controller-contracts",
  "test:world-session-boundaries",
  "test:localization",
  "test:save-recovery",
  "test:accessibility",
  "test:campaign-front-door",
  "test:authored-campaign-cases",
  "test:investigation-operations",
  "test:investigator-headquarters",
  "test:replay-audit"
];

const browserScripts = [
  "qa:static-browser",
  "qa:static-boundary",
  "qa:command-deck",
  "qa:strategic-command",
  "qa:strategic-pacing",
  "qa:district-fronts",
  "qa:investigator-headquarters",
  "qa:campaign-front-door",
  "qa:campaign-study",
  "qa:accessibility-bilingual"
];

const stages = [
  { label: "next-typegen", command: npxCommand, args: ["next", "typegen"], timeoutMs: 180_000 },
  { label: "typescript", command: npxCommand, args: ["tsc", "--noEmit"], timeoutMs: 180_000 },
  { label: "release-candidate-contracts", command: process.execPath, args: ["scripts/run-release-candidate-contract-tests.mjs"], timeoutMs: 30_000 },
  { label: "v10-distribution-contracts", command: process.execPath, args: ["scripts/run-v10-distribution-contract-tests.mjs"], timeoutMs: 30_000 },
  { label: "v10-supply-chain", command: process.execPath, args: ["scripts/run-v10-supply-chain-audit.mjs", "--json"], timeoutMs: 60_000 },
  ...coreScripts.map((script) => ({ label: script, command: npmCommand, args: ["run", script, "--", "--json"], timeoutMs: 180_000 })),
  { label: "fairness-invariants-24-seed", command: npmCommand, args: ["run", "test:v75-invariants", "--", "--json"], timeoutMs: 600_000 },
  { label: "content-validation", command: npmCommand, args: ["run", "content:validate", "--", "--json"], timeoutMs: 180_000 },
  { label: "production-build", command: npmCommand, args: ["run", "build"], timeoutMs: 600_000 },
  { label: "campaign-playthrough-24-case", command: npmCommand, args: ["run", "test:twenty-four-case-campaign", "--", "--json"], timeoutMs: 1_200_000 },
  { label: "v10-distribution-smoke", command: process.execPath, args: ["scripts/run-v10-distribution-smoke.mjs"], timeoutMs: 180_000 },
  { label: "persistent-town-api-smoke", command: process.execPath, args: ["scripts/run-persistent-town-api-smoke.mjs"], timeoutMs: 600_000 },
  { label: "performance-budget", command: npmCommand, args: ["run", "quality:performance-budget", "--", "--json"], timeoutMs: 180_000 },
  { label: "repository-safety", command: npmCommand, args: ["run", "quality:repository-safety", "--", "--json"], timeoutMs: 60_000 },
  { label: "release-candidate-safety", command: process.execPath, args: ["scripts/run-release-candidate-safety.mjs"], timeoutMs: 60_000 },
  { label: "static-reader", command: npmCommand, args: ["run", "qa:static-reader", "--", "--json", "--public-only"], timeoutMs: 180_000 },
  ...browserScripts.map((script) => ({ label: script, command: npmCommand, args: ["run", script, "--", "--json"], timeoutMs: 600_000 }))
];

function parseLastJson(stdout) {
  const text = String(stdout || "").trim();
  if (!text) return null;
  for (let index = text.length - 1; index >= 0; index -= 1) {
    if (text[index] !== "{" && text[index] !== "[") continue;
    try { return JSON.parse(text.slice(index)); } catch {}
  }
  return null;
}

function tailLines(value, count = 12) {
  return String(value || "").trim().split(/\r?\n/).filter(Boolean).slice(-count);
}

function runStage(stage) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const windowsCommand = process.platform === "win32" && /\.(?:cmd|bat)$/i.test(stage.command);
    const command = windowsCommand ? "cmd.exe" : stage.command;
    const args = windowsCommand
      ? ["/d", "/s", "/c", [stage.command, ...stage.args].map((item) => {
          const value = String(item).replace(/"/g, "\\\"");
          return /[\s&|<>^]/.test(value) ? `"${value}"` : value;
        }).join(" ")]
      : stage.args;
    const child = spawn(command, args, {
      cwd: root,
      env: {
        ...process.env,
        AI_PROVIDER: "mock",
        DEEPSEEK_API_KEY: "",
        SILICONFLOW_API_KEY: ""
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const timer = setTimeout(() => {
      timedOut = true;
      stopProcessTree(child);
    }, stage.timeoutMs);
    const finish = (exitCode, startError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const parsed = parseLastJson(stdout);
      const result = {
        label: stage.label,
        ok: !timedOut && !startError && exitCode === 0 && parsed?.ok !== false,
        exitCode: startError ? null : exitCode,
        timedOut,
        durationMs: Date.now() - startedAt,
        json: parsed,
        stdoutTail: tailLines(stdout),
        stderrTail: tailLines(startError ? `${stderr}\n${startError}` : stderr)
      };
      resolve(result);
    };
    child.stdout?.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
    child.once("error", (error) => finish(null, error instanceof Error ? error.message : String(error)));
    child.once("close", (code) => finish(code, null));
  });
}

function dataSnapshot() {
  const directory = path.join(root, "data");
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter((name) => /^(?:rc-|campaign-study-runtime)/i.test(name)).sort();
}

function protectedDiff() {
  return execFileSync("git", ["diff", "--name-only", "--", ...protectedPaths], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
}

const startedAt = Date.now();
const beforeTree = hashPublicArtifactTree({ paths: protectedPaths });
const beforeData = dataSnapshot();
const reports = [];

for (const stage of stages) {
  const startedNotice = { type: "stage", phase: "start", label: stage.label };
  if (jsonMode) console.error(JSON.stringify(startedNotice));
  else console.error(`[quality:rc] ${stage.label} ...`);
  const result = await runStage(stage);
  reports.push(result);
  const finishedNotice = { type: "stage", phase: "finish", label: stage.label, ok: result.ok, durationMs: result.durationMs, exitCode: result.exitCode };
  if (jsonMode) console.error(JSON.stringify(finishedNotice));
  else console.error(`[quality:rc] ${stage.label}: ${result.ok ? "ok" : "failed"} (${result.durationMs}ms)`);
  if (!result.ok) break;
}

const afterTree = hashPublicArtifactTree({ paths: protectedPaths });
const afterData = dataSnapshot();
const protectedChanges = protectedDiff();
const residualData = afterData.filter((file) => !beforeData.includes(file));
const treeUnchanged = beforeTree.treeHash === afterTree.treeHash;
const clean = treeUnchanged && protectedChanges.length === 0 && residualData.length === 0;
const report = {
  ok: reports.length === stages.length && reports.every((item) => item.ok) && clean,
  version: "v10.0",
  durationMs: Date.now() - startedAt,
  stageCount: stages.length,
  completedStageCount: reports.length,
  stages: reports.map(({ json, ...item }) => ({ ...item, jsonOk: typeof json?.ok === "boolean" ? json.ok : undefined })),
  protectedPublic: {
    paths: protectedPaths,
    before: { fileCount: beforeTree.fileCount, treeHash: beforeTree.treeHash },
    after: { fileCount: afterTree.fileCount, treeHash: afterTree.treeHash },
    unchanged: treeUnchanged,
    gitDiff: protectedChanges
  },
  temporaryData: { before: beforeData, after: afterData, newFiles: residualData, clean: residualData.length === 0 },
  failures: reports.filter((item) => !item.ok).map((item) => ({ label: item.label, exitCode: item.exitCode, timedOut: item.timedOut, stdoutTail: item.stdoutTail, stderrTail: item.stderrTail }))
};

if (jsonMode) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`Release Candidate gate: ${report.ok ? "passed" : "failed"}`);
  for (const stage of report.stages) console.log(`- ${stage.label}: ${stage.ok ? "ok" : "failed"} (${stage.durationMs}ms)`);
  if (!clean) console.log(`- protected/public cleanup: failed${residualData.length ? ` (${residualData.join(", ")})` : ""}`);
}

if (!report.ok) process.exitCode = 1;
