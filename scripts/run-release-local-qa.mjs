import { spawn } from "node:child_process";
import { hashPublicArtifactTree } from "./public-artifact-safety-lib.mjs";

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function parseLastJson(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  for (let index = trimmed.length - 1; index >= 0; index -= 1) {
    const char = trimmed[index];
    if (char !== "{" && char !== "[") continue;
    try {
      return JSON.parse(trimmed.slice(index));
    } catch {
      // Keep scanning in case npm or tool output preceded the JSON report.
    }
  }
  return null;
}

function runCommand(label, command, args) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const childCommand = process.platform === "win32" ? "cmd.exe" : command;
    const childArgs = process.platform === "win32" ? ["/d", "/s", "/c", [command, ...args].join(" ")] : args;
    const child = spawn(childCommand, childArgs, { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => {
      resolve({
        label,
        ok: false,
        exitCode: null,
        durationMs: Date.now() - startedAt,
        json: null,
        stdoutTail: stdout.trim().split(/\r?\n/).filter(Boolean).slice(-8),
        stderrTail: [error instanceof Error ? error.message : "Failed to start command."]
      });
    });
    child.on("close", (code) => {
      const parsed = parseLastJson(stdout);
      resolve({
        label,
        ok: code === 0,
        exitCode: code,
        durationMs: Date.now() - startedAt,
        json: parsed,
        stdoutTail: stdout.trim().split(/\r?\n/).slice(-8),
        stderrTail: stderr.trim().split(/\r?\n/).filter(Boolean).slice(-8)
      });
    });
  });
}

async function runPublicArtifactStabilityCheck(command) {
  const startedAt = Date.now();
  const paths = ["public/dataset-reader", "public/review-catalog"];
  const before = hashPublicArtifactTree({ paths });
  const nested = [];
  nested.push(await runCommand("stability:qa:static-reader", command, ["run", "qa:static-reader", "--", "--json"]));
  if (nested.at(-1)?.ok) nested.push(await runCommand("stability:public-catalog:build", command, ["run", "public-catalog:build", "--", "--json"]));
  const after = hashPublicArtifactTree({ paths });
  const changed = before.treeHash !== after.treeHash;
  const nestedFailed = nested.find((step) => !step.ok);
  const ok = !nestedFailed && !changed;
  return {
    label: "public-artifacts:stability",
    ok,
    exitCode: ok ? 0 : 1,
    durationMs: Date.now() - startedAt,
    json: {
      ok,
      before: { fileCount: before.fileCount, treeHash: before.treeHash },
      after: { fileCount: after.fileCount, treeHash: after.treeHash },
      changed,
      steps: nested.map(({ label, ok: stepOk, exitCode, durationMs, json: parsed }) => ({
        label,
        ok: stepOk,
        exitCode,
        durationMs,
        jsonOk: typeof parsed?.ok === "boolean" ? parsed.ok : undefined
      }))
    },
    stdoutTail: [
      `before ${before.treeHash}`,
      `after ${after.treeHash}`,
      changed ? "public artifact tree changed after repeat generation" : "public artifact tree stable"
    ],
    stderrTail: nestedFailed ? [`${nestedFailed.label} failed during public artifact stability check.`] : []
  };
}

const json = hasFlag("json");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const steps = [
  ["qa:static-reader", ["run", "qa:static-reader", "--", "--json"]],
  ["content:validate", ["run", "content:validate", "--", "--json"]],
  ["audit:world-system-hints", ["run", "audit:world-system-hints", "--", "--json"]],
  ["public-catalog:build", ["run", "public-catalog:build", "--", "--json"]],
  ["public-catalog:validate", ["run", "public-catalog:validate", "--", "--json"]],
  ["public-artifacts:stability", "stability"],
  ["dataset:reader:public", ["run", "dataset:reader", "--", "--path=public/dataset-reader/detective-town-v3-5000-campaign", "--json"]],
  ["qa:static-browser", ["run", "qa:static-browser", "--", "--json"]],
  ["build", ["run", "build"]],
  ["replay:audit", ["run", "replay:audit", "--", "--json"]]
];

const startedAt = Date.now();
const reports = [];
for (const [label, args] of steps) {
  const report = args === "stability"
    ? await runPublicArtifactStabilityCheck(npmCommand)
    : await runCommand(label, npmCommand, args);
  reports.push(report);
  if (!report.ok) break;
}

const staticReader = reports.find((item) => item.label === "qa:static-reader")?.json;
const content = reports.find((item) => item.label === "content:validate")?.json;
const publicCatalog = reports.find((item) => item.label === "public-catalog:validate")?.json?.catalog;
const browser = reports.find((item) => item.label === "qa:static-browser")?.json;
const influenceAudit = reports.find((item) => item.label === "audit:world-system-hints")?.json;
const replayAudit = reports.find((item) => item.label === "replay:audit")?.json;
const stability = reports.find((item) => item.label === "public-artifacts:stability")?.json;
const publicSteps = reports.map(({ json: parsed, ...step }) => ({
  ...step,
  jsonOk: typeof parsed?.ok === "boolean" ? parsed.ok : undefined
}));
const report = {
  ok: reports.every((item) => item.ok),
  durationMs: Date.now() - startedAt,
  steps: publicSteps,
  summary: {
    datasetId: staticReader?.datasetId || publicCatalog?.datasets?.[0]?.datasetId,
    readerIndexHash: staticReader?.readerIndexHash || publicCatalog?.datasets?.[0]?.readerIndexHash,
    datasetCount: publicCatalog?.summary?.datasetCount,
    gate: staticReader?.gate || publicCatalog?.datasets?.[0]?.gate,
    audit: staticReader?.audit || publicCatalog?.datasets?.[0]?.audit,
    content: content?.summary || publicCatalog?.contentSummary,
    publicArtifactsStable: stability?.ok,
    publicArtifactTreeHash: stability?.after?.treeHash,
    worldSystemInfluenceAudit: influenceAudit?.summary,
    staticBrowserOk: browser?.ok,
    replayAuditOk: replayAudit?.ok
  }
};

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Release local QA: ${report.ok ? "ok" : "failed"}`);
  console.log(`Duration: ${report.durationMs}ms`);
  console.log(`Dataset: ${report.summary.datasetId || "n/a"}`);
  console.log(`Reader hash: ${report.summary.readerIndexHash || "n/a"}`);
  for (const step of reports) console.log(`- ${step.label}: ${step.ok ? "ok" : "failed"} (${step.durationMs}ms)`);
}

if (!report.ok) process.exit(1);
