import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const runtimeDir = path.join(process.cwd(), "outputs", "storage-test-runtime");
const backupDir = path.join(process.cwd(), "outputs", "backups", "storage-test");
fs.rmSync(runtimeDir, { recursive: true, force: true });
fs.rmSync(backupDir, { recursive: true, force: true });
fs.mkdirSync(runtimeDir, { recursive: true });

const sourcePath = path.join(runtimeDir, "source.db");
process.env.DATABASE_URL = sourcePath;
const { closeDatabase, NovelProjectConflictError, worldRepository } = await import("../lib/world/repository.ts");
const now = "2026-06-22T00:00:00.000Z";
const workspace = {
  version: 1,
  project: {
    version: 2,
    id: "novel-storage-smoke",
    title: "Storage Smoke Novel",
    genreTone: "test",
    chapters: [{ input: { id: "chapter-1" } }],
    identityRegistry: { version: 1, decisions: [{ id: "identity-1", sourceChapterId: "chapter-1", sourceEntityId: "lin-alias", sourceName: "Lin Alias", canonicalEntityId: "lin", canonicalName: "Lin", confidence: 84, status: "auto-merged", reasons: ["name-containment"], evidence: [], createdAt: now, updatedAt: now }], updatedAt: now },
    mergedGraph: {},
    mergeReport: {},
    createdAt: now,
    updatedAt: now
  },
  chapters: [{ chapterId: "chapter-1", rawText: "Persistent chapter text" }],
  evidenceIndexes: { "chapter-1": { chapterId: "chapter-1", paragraphCount: 1, snippets: [], warnings: [] } },
  simulationRuns: [{ id: "run-1", projectId: "novel-storage-smoke", projectRevision: "novel-revision-storage", parentRunId: "baseline-1", branchFromStepIndex: 1, branchComparison: { baselineRunId: "baseline-1", branchRunId: "run-1", branchFromStepIndex: 1, materialDivergence: true, actorDiffs: [], causalClaimsAdded: [], causalClaimsRemoved: [], summary: "storage branch" } }],
  correctionSet: { version: 1, projectId: "novel-storage-smoke", patches: [], createdAt: now, updatedAt: now },
  batchQueue: { batchSize: 3, paused: false, running: false, chapterStatuses: { "chapter-1": "ready" }, lastBatchChapterIds: ["chapter-1"], updatedAt: now },
  updatedAt: now
};
const saved = worldRepository.saveNovelProject(workspace);
assert.equal(worldRepository.schemaVersion, 6, "repository reports schema v6");
assert.equal(worldRepository.storageHealth().counts.novelProjects, 1, "storage health counts novel projects");
assert.throws(
  () => worldRepository.saveNovelProject(workspace, "stale-version"),
  (error) => error instanceof NovelProjectConflictError,
  "stale saves are rejected"
);
const receiptKey = "storage-pending-receipt";
assert.equal(worldRepository.claimIdempotencyReceipt({ key: receiptKey, fingerprint: "storage-fingerprint" }).kind, "claimed", "receipt can be atomically claimed");
assert.equal(worldRepository.claimIdempotencyReceipt({ key: receiptKey, fingerprint: "storage-fingerprint" }).kind, "pending", "duplicate pending claim is blocked");
assert.equal(worldRepository.claimIdempotencyReceipt({ key: receiptKey, fingerprint: "different-fingerprint" }).kind, "conflict", "fingerprint conflict is rejected");
closeDatabase();
const pendingReceipt = worldRepository.getIdempotencyReceipt(receiptKey);
assert.equal(pendingReceipt?.state, "pending", "pending receipt survives database reopen");
worldRepository.saveIdempotencyReceipt({ key: receiptKey, fingerprint: "storage-fingerprint", response: { ok: true, data: { committed: true } }, status: 200 });
closeDatabase();
const committedReceipt = worldRepository.getIdempotencyReceipt(receiptKey);
assert.equal(committedReceipt?.state, "committed", "committed receipt survives database reopen");
assert.equal(committedReceipt?.response?.data?.committed, true, "committed response survives database reopen");
const auditEvent = worldRepository.recordAdminAuditEvent({ route: "/api/v1/command/town/create", method: "POST", outcome: "missing", status: 401, requestId: "storage-audit-request", credentialSource: "none" });
assert.equal(auditEvent.status, 401, "admin audit event records authorization status");
assert.equal(worldRepository.listAdminAuditEvents(5)[0].requestId, "storage-audit-request", "admin audit event survives repository access");
const restored = worldRepository.getNovelProject("novel-storage-smoke");
assert.equal(restored.chapters[0].rawText, "Persistent chapter text", "workspace survives database reopen");
assert.equal(restored.simulationRuns[0].id, "run-1", "simulation state survives database reopen");
assert.equal(restored.project.identityRegistry.decisions[0].status, "auto-merged", "identity registry survives database reopen");
assert.equal(restored.simulationRuns[0].branchComparison.materialDivergence, true, "branch comparison survives database reopen");
assert.equal(restored.updatedAt, saved.updatedAt, "repository keeps the saved revision timestamp");

const replayIndex = {
  schemaVersion: 1,
  generatedAt: "2026-07-03T00:00:00.000Z",
  storeRoot: "data/replay-store",
  runs: [{
    runId: "storage-replay-run",
    kind: "campaign",
    status: "completed",
    startedAt: "2026-07-03T00:00:00.000Z",
    finishedAt: "2026-07-03T00:00:05.000Z",
    experimentId: "storage-experiment",
    seed: "storage-seed",
    tickCount: 100,
    qualityScore: 92,
    deterministicRunHash: "fnv1a-storage",
    files: [
      { name: "manifest.json", path: "manifest.json", bytes: 33, sha256: "a".repeat(64), declared: true },
      { name: "campaign-report.json", path: "campaign-report.json", bytes: 44, sha256: "b".repeat(64), declared: true }
    ],
    metrics: { caseCount: 8, uniqueCaseCount: 8 },
    warnings: []
  }],
  summary: {
    runCount: 1,
    byKind: { campaign: 1 },
    completedRunCount: 1,
    failedRunCount: 0,
    indexedFileCount: 2
  },
  audit: {
    ok: true,
    checkedRunCount: 1,
    errorCount: 0,
    warningCount: 1,
    findings: [{ severity: "warning", code: "manifest.missing-summary", runId: "storage-replay-run", file: "manifest.json", message: "fixture warning" }],
    secretLeakCount: 0,
    hiddenTruthLeakCount: 0
  }
};
const syncResult = worldRepository.syncReplayDatasetIndex(replayIndex);
assert.equal(syncResult.syncedRunCount, 1, "replay sync writes one run");
assert.equal(worldRepository.storageHealth().counts.replayRuns, 1, "storage health counts replay runs");
assert.equal(worldRepository.storageHealth().counts.replayFiles, 2, "storage health counts replay files");
const replayList = worldRepository.listReplayCatalogRuns({ kind: "campaign" });
assert.equal(replayList.total, 1, "replay catalog list supports kind filter");
assert.equal(replayList.runs[0].files.length, 0, "list rows do not include file payload");
assert.equal(replayList.summary.auditWarningCount, 1, "replay catalog summary counts warnings");
const replayDetail = worldRepository.getReplayCatalogRun("storage-replay-run");
assert.equal(replayDetail.run.files.length, 2, "replay catalog detail includes files");
assert.equal(replayDetail.findings[0].code, "manifest.missing-summary", "replay catalog detail includes findings");
worldRepository.syncReplayDatasetIndex(replayIndex);
assert.equal(worldRepository.storageHealth().counts.replayRuns, 1, "replay sync is idempotent for runs");
assert.equal(worldRepository.storageHealth().counts.replayFiles, 2, "replay sync is idempotent for files");
assert.throws(
  () => worldRepository.syncReplayDatasetIndex({
    ...replayIndex,
    runs: [{ ...replayIndex.runs[0], files: [{ name: "escape", path: "../escape.json", bytes: 1, sha256: "c".repeat(64) }] }]
  }),
  /relative/,
  "replay sync rejects unsafe relative paths"
);

const packageIndex = {
  schemaVersion: 1,
  generatedAt: "2026-07-03T00:00:00.000Z",
  root: "local-workspace",
  packages: [{
    packageId: "storage-world-package",
    kind: "world-package",
    source: "world-packs",
    name: "Storage World Package",
    version: "1.0.0",
    status: "valid",
    directoryName: "storage-world-package",
    relativePath: "world-packs/storage-world-package",
    contentHash: "c".repeat(64),
    pathHash: "d".repeat(64),
    license: "project-local",
    scenarioPackId: "storage-scenario",
    mapPackId: "storage-map",
    ruleCatalogId: "storage-rules",
    agentPackId: "storage-agents",
    ecosystemCatalogId: "storage-ecosystem",
    validation: { ok: true, errors: [], warnings: [] },
    metrics: { fileCount: 8, bytes: 2048, agentCount: 4, factionCount: 2, resourceCount: 3, taskTemplateCount: 5 }
  }],
  summary: {
    packageCount: 1,
    validPackageCount: 1,
    invalidPackageCount: 0,
    byKind: { "world-package": 1 },
    bySource: { "world-packs": 1 }
  }
};
const packageSync = worldRepository.syncPackageCatalogIndex(packageIndex);
assert.equal(packageSync.syncedPackageCount, 1, "package sync writes one package");
assert.equal(worldRepository.storageHealth().counts.packages, 1, "storage health counts package catalog rows");
const packageList = worldRepository.listPackageCatalog({ kind: "world-package" });
assert.equal(packageList.total, 1, "package catalog list supports kind filter");
assert.equal(packageList.packages[0].packageId, "storage-world-package", "package catalog list returns metadata");
const packageDetail = worldRepository.getPackageCatalogEntry("storage-world-package");
assert.equal(packageDetail.package.scenarioPackId, "storage-scenario", "package catalog detail includes bound pack ids");
worldRepository.syncPackageCatalogIndex(packageIndex);
assert.equal(worldRepository.storageHealth().counts.packages, 1, "package sync is idempotent");
const packageDb = new Database(sourcePath, { readonly: true, fileMustExist: true });
const packageRows = packageDb.prepare("select * from package_catalog").all();
packageDb.close();
assert.equal(JSON.stringify(packageRows).includes("world-packs/storage-world-package"), true, "package catalog stores relative package paths");
assert.equal(/[A-Za-z]:[\\/]/.test(JSON.stringify(packageRows)), false, "package catalog rows do not store absolute paths");
assert.equal(JSON.stringify(packageRows).includes(".env.local"), false, "package catalog rows do not store env file references");
assert.equal(JSON.stringify(packageRows).includes("apiKey"), false, "package catalog rows do not store API-key-like fields");
assert.equal(JSON.stringify(packageRows).includes("truth"), false, "package catalog rows do not store hidden truth fields");
assert.equal(JSON.stringify(packageRows).includes("scenario-pack.json"), false, "package catalog rows do not store package body text or file names");
assert.throws(
  () => worldRepository.syncPackageCatalogIndex({
    ...packageIndex,
    packages: [{ ...packageIndex.packages[0], relativePath: "../escape" }]
  }),
  /relativePath/,
  "package sync rejects unsafe relative paths"
);
closeDatabase();

const output = execFileSync("node", [
  "scripts/backup-sqlite.mjs",
  "--database",
  sourcePath,
  "--out",
  backupDir,
  "--label",
  "storage-smoke"
], { encoding: "utf8" });

const summary = JSON.parse(output);
assert.equal(summary.ok, true, "backup script reports success");
assert.equal(fs.existsSync(summary.backupPath), true, "backup file exists");
assert.equal(summary.backupPath.startsWith(backupDir), true, "backup is written under requested directory");

const backup = new Database(summary.backupPath, { readonly: true, fileMustExist: true });
const row = backup.prepare("select id, data from novel_projects where id = ?").get("novel-storage-smoke");
backup.close();
assert.equal(row.id, "novel-storage-smoke", "backup preserves novel project rows");
assert.equal(JSON.parse(row.data).chapters[0].rawText, "Persistent chapter text", "backup preserves novel workspace JSON");

console.log("Storage repository and backup tests passed.");
