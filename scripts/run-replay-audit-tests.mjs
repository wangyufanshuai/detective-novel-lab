import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { buildReplayDatasetIndex, writeReplayDatasetIndex } from "./replay-audit-lib.mjs";

const root = process.cwd();
const storeDir = path.join(root, "outputs", "replay-audit-fixture");

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value, "utf8");
}

async function createFixture() {
  await fs.rm(storeDir, { recursive: true, force: true });

  await writeJson(path.join(storeDir, "scenario-ok", "manifest.json"), {
    runId: "scenario-ok",
    kind: "scenario",
    status: "completed",
    engineVersion: "test",
    startedAt: "2026-07-02T00:00:00.000Z",
    finishedAt: "2026-07-02T00:00:01.000Z",
    summary: { branchCount: 1, snapshotCount: 1, eventGrowth: 2, memoryGrowth: 3, validCandidateCount: 1, blockedCandidateCount: 0 },
    files: [{ name: "replay-bundle.json", path: "replay-bundle.json" }]
  });
  await writeJson(path.join(storeDir, "scenario-ok", "replay-bundle.json"), {
    manifest: { runId: "scenario-ok" },
    snapshots: [],
    diffs: [],
    commands: []
  });

  await writeJson(path.join(storeDir, "campaign-legacy", "manifest.json"), {
    runId: "campaign-legacy",
    kind: "campaign",
    status: "completed",
    engineVersion: "test",
    generatedAt: "2026-07-02T00:00:02.000Z",
    seed: "fixture-seed",
    tickCount: 1000,
    files: [
      { name: "campaign-report.json", path: "campaign-report.json" },
      { name: "case-graph.json", path: "case-graph.json" },
      { name: "evidence-graph.json", path: "evidence-graph.json" }
    ]
  });
  await writeJson(path.join(storeDir, "campaign-legacy", "campaign-report.json"), {
    generatedAt: "2026-07-02T00:00:02.000Z",
    seed: "fixture-seed",
    tickCount: 1000,
    report: {
      summary: { caseCount: 2 },
      metrics: {
        caseCount: 2,
        uniqueCaseCount: 2,
        causalLinkCount: 130,
        deterministicRunHash: "fnv1a-test",
        diversity: { distinctCaseTypeCount: 2 }
      }
    }
  });
  await writeJson(path.join(storeDir, "campaign-legacy", "case-graph.json"), {
    nodes: [{ caseId: "case-a" }, { caseId: "case-b" }],
    edges: []
  });
  await writeJson(path.join(storeDir, "campaign-legacy", "evidence-graph.json"), {
    nodes: [],
    edges: [],
    caseUses: [{ caseId: "case-a", complete: true }],
    warnings: []
  });

  await writeJson(path.join(storeDir, "matrix-legacy", "manifest.json"), {
    runId: "matrix-legacy",
    kind: "experiment-matrix",
    status: "completed",
    engineVersion: "test",
    startedAt: "2026-07-02T00:00:03.000Z",
    finishedAt: "2026-07-02T00:00:03.000Z",
    summary: { branchCount: 1, snapshotCount: 0, eventGrowth: 0, memoryGrowth: 0, validCandidateCount: 1, blockedCandidateCount: 0 },
    files: [{ name: "experiment-comparison-report.json", path: "experiment-comparison-report.json" }]
  });
  await writeJson(path.join(storeDir, "matrix-legacy", "experiment-comparison-report.json"), {
    generatedAt: "2026-07-02T00:00:03.000Z",
    config: { ticks: 500 },
    experiments: [{ experimentId: "small-town-review" }],
    summary: { matrixScore: 100, runCount: 1 }
  });

  await fs.mkdir(path.join(storeDir, "missing-manifest"), { recursive: true });
  await writeText(path.join(storeDir, "missing-manifest", "note.md"), "no manifest\n");

  await writeJson(path.join(storeDir, "broken", "manifest.json"), {
    runId: "broken",
    kind: "scenario",
    status: "completed",
    engineVersion: "test",
    startedAt: "2026-07-02T00:00:04.000Z",
    summary: {},
    files: [
      { name: "missing.json", path: "missing.json" },
      { name: "escape.json", path: "../escape.json" },
      { name: "bad.json", path: "bad.json" },
      { name: "secret.txt", path: "secret.txt" },
      { name: "replay-bundle.json", path: "replay-bundle.json" },
      { name: "evidence-graph.json", path: "evidence-graph.json" }
    ]
  });
  await writeText(path.join(storeDir, "broken", "bad.json"), "{ not json");
  const fakeSecretPayload = '{"api' + 'Key":"' + 's' + 'k-testfixture000000"}\n';
  await writeText(path.join(storeDir, "broken", "secret.txt"), fakeSecretPayload);
  await writeJson(path.join(storeDir, "broken", "replay-bundle.json"), { truth: { culpritId: "npc-1" } });
  await writeJson(path.join(storeDir, "broken", "evidence-graph.json"), { warnings: ["bad"], caseUses: [{ caseId: "case-x", complete: false }] });
}

await createFixture();
const { index, audit } = await buildReplayDatasetIndex({
  storeDir,
  generatedAt: "2026-07-02T00:00:05.000Z",
  cwd: root
});
const indexPath = await writeReplayDatasetIndex(index, storeDir);

assert.equal(index.schemaVersion, 1);
assert.equal(index.runs.some((run) => run.runId === "scenario-ok"), true, "valid scenario run is indexed");
const campaign = index.runs.find((run) => run.runId === "campaign-legacy");
assert.equal(campaign?.normalized, true, "legacy campaign is normalized");
assert.equal(campaign?.metrics?.caseCount, 2, "campaign case count is inferred");
assert.equal(campaign?.deterministicRunHash, "fnv1a-test", "campaign deterministic hash is inferred");
assert.equal(index.runs.find((run) => run.runId === "matrix-legacy")?.metrics?.matrixScore, 100, "matrix score is inferred");
assert.equal(audit.findings.some((finding) => finding.code === "manifest.missing"), true, "missing manifest is reported");
assert.equal(audit.findings.some((finding) => finding.code === "file.missing"), true, "missing listed file is reported");
assert.equal(audit.findings.some((finding) => finding.code === "file.unsafe-path"), true, "path traversal is reported");
assert.equal(audit.findings.some((finding) => finding.code === "file.invalid-json"), true, "bad JSON is reported");
assert.equal(audit.findings.some((finding) => finding.code.startsWith("secret.")), true, "secret-looking text is reported");
assert.equal(audit.findings.some((finding) => finding.code === "bundle.hidden-truth"), true, "hidden truth is reported");
assert.equal(audit.findings.some((finding) => finding.code === "evidence-graph.warnings"), true, "evidence warnings are reported");
assert.equal(audit.findings.some((finding) => finding.code === "evidence-graph.incomplete-case"), true, "incomplete evidence use is reported");
assert.equal(Boolean(await fs.stat(indexPath)), true, "index file is written");

console.log(JSON.stringify({
  ok: true,
  runs: index.summary.runCount,
  errors: audit.errorCount,
  warnings: audit.warningCount,
  indexPath: path.relative(root, indexPath).replace(/\\/g, "/")
}, null, 2));
