import fs from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { stopProcessTree } from "./lib/release-candidate-server.mjs";
import { buildLongRunGateEvidence } from "./v11-alpha-evidence-lib.mjs";

const jsonMode = process.argv.includes("--json");
const root = process.cwd();
const outputDir = path.join(root, "outputs", "v11-alpha");
const evidencePath = path.join(outputDir, "long-run-gate.json");
const tickCounts = [5000, 10000];
const minimumCaseCount = 30;
const maxRuntimeMsPerRun = 300_000;
const processTimeoutMs = 360_000;

function parseLastJson(stdout) {
  const text = String(stdout || "").trim();
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "{" && text[index] !== "[") continue;
    try {
      const parsed = JSON.parse(text.slice(index));
      if (parsed && typeof parsed === "object") return parsed;
    } catch {}
  }
  return null;
}

function runBenchmark(tickCount) {
  const seed = "campaign-validation";
  const args = [
    "scripts/run-campaign-benchmark.mjs",
    `--ticks=${tickCount}`,
    `--seed=${seed}`,
    `--min-cases=${minimumCaseCount}`,
    `--max-ms=${maxRuntimeMsPerRun}`
  ];
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
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
    }, processTimeoutMs);
    const finish = (exitCode, startError, signal = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const result = parseLastJson(stdout);
      const passingProcess = !timedOut && !startError && exitCode === 0 && result?.ok === true;
      resolve(passingProcess ? {
        status: "automated-pass",
        tickCount,
        seed,
        minimumCaseCount,
        runtimeMs: result.runtimeMs,
        cases: result.cases,
        uniqueCases: result.uniqueCases,
        candidateDiversityScore: result.candidateDiversityScore,
        candidateRepeatRate: result.candidateRepeatRate,
        laterCaseInfluenceRate: result.laterCaseInfluenceRate,
        caseGraphInfluencedLaterCases: result.caseGraphInfluencedLaterCases,
        completeEvidenceCaseCount: result.completeEvidenceCaseCount,
        resolvedEvidenceCaseCount: result.resolvedEvidenceCaseCount,
        crossCaseInfluenceCount: result.crossCaseInfluenceCount,
        causalLinkCount: result.causalLinkCount,
        caseGraphEdges: result.caseGraphEdges,
        evidenceGraphWarnings: result.evidenceGraphWarnings,
        selectedActionKindCount: result.selectedActionKindCount,
        largestSelectedActionShare: result.largestSelectedActionShare,
        activeActorCount: result.activeActorCount,
        largestActorShare: result.largestActorShare,
        institutionDecisionCount: result.institutionDecisionCount,
        candidateRejectionReasonCounts: result.candidateRejectionReasonCounts || {},
        candidateLifecycleTail: result.candidateLifecycleTail || [],
        deterministicRunHash: result.deterministicRunHash,
        artifactRunId: result.artifactRunId,
        processDurationMs: Date.now() - startedAt
      } : {
        status: "failed",
        tickCount,
        seed,
        minimumCaseCount,
        runtimeMs: result?.runtimeMs ?? null,
        cases: result?.cases ?? 0,
        uniqueCases: result?.uniqueCases ?? 0,
        completeEvidenceCaseCount: result?.completeEvidenceCaseCount ?? 0,
        resolvedEvidenceCaseCount: result?.resolvedEvidenceCaseCount ?? 0,
        evidenceGraphWarnings: result?.evidenceGraphWarnings ?? null,
        candidateRejectionReasonCounts: result?.candidateRejectionReasonCounts || {},
        candidateLifecycleTail: result?.candidateLifecycleTail || [],
        deterministicRunHash: result?.deterministicRunHash ?? null,
        artifactRunId: result?.artifactRunId ?? null,
        processDurationMs: Date.now() - startedAt,
        exitCode,
        signal,
        failure: timedOut ? "timeout" : startError ? "start-error" : result ? "benchmark-failed" : stderr.trim() ? "no-json-result" : exitCode ? "process-exit" : "empty-result"
      });
    };
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.once("error", (error) => finish(null, error instanceof Error ? error.message : String(error)));
    child.once("close", (code, signal) => finish(code, null, signal));
  });
}

const runs = [];
for (const tickCount of tickCounts) {
  if (!jsonMode) console.error(`[v11-long-run] ${tickCount} ticks ...`);
  const run = await runBenchmark(tickCount);
  runs.push(run);
  if (!jsonMode) console.error(`[v11-long-run] ${tickCount} ticks: ${run.status}`);
}

const evidence = buildLongRunGateEvidence({
  command: "npm run gate:v11-long-run -- --json",
  minimumCaseCount,
  maxRuntimeMsPerRun,
  runs
});
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

const result = {
  ok: evidence.summary.status === "automated-pass",
  status: evidence.summary.status,
  passCount: evidence.summary.passCount,
  failCount: evidence.summary.failCount,
  evidenceHash: evidence.evidenceHash,
  output: path.relative(root, evidencePath).replaceAll("\\", "/"),
  runs: evidence.runs.map((run) => ({
    tickCount: run.tickCount,
    status: run.status,
    runtimeMs: run.runtimeMs,
    cases: run.cases,
    deterministicRunHash: run.deterministicRunHash
  }))
};
console.log(jsonMode ? JSON.stringify(result) : `v11 long-run gate: ${result.status}`);
if (!result.ok) process.exitCode = 1;
