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
assert.equal(worldRepository.schemaVersion, 2, "repository reports schema v2");
assert.equal(worldRepository.storageHealth().counts.novelProjects, 1, "storage health counts novel projects");
assert.throws(
  () => worldRepository.saveNovelProject(workspace, "stale-version"),
  (error) => error instanceof NovelProjectConflictError,
  "stale saves are rejected"
);
closeDatabase();
const restored = worldRepository.getNovelProject("novel-storage-smoke");
assert.equal(restored.chapters[0].rawText, "Persistent chapter text", "workspace survives database reopen");
assert.equal(restored.simulationRuns[0].id, "run-1", "simulation state survives database reopen");
assert.equal(restored.project.identityRegistry.decisions[0].status, "auto-merged", "identity registry survives database reopen");
assert.equal(restored.simulationRuns[0].branchComparison.materialDivergence, true, "branch comparison survives database reopen");
assert.equal(restored.updatedAt, saved.updatedAt, "repository keeps the saved revision timestamp");
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
