import fs from "node:fs";
import path from "node:path";
import type { RunArtifactFile, RunArtifactManifest, RunCatalogEntry, RunReplayBundle, ScenarioPack, TownMapPack, TownRuleCatalog } from "@/lib/engine";

const STORE_DIR = path.join(process.cwd(), "data", "replay-store");

type ArtifactInput = {
  manifest: Omit<RunArtifactManifest, "files">;
  scenarioPack?: ScenarioPack | null;
  mapPack?: TownMapPack | null;
  ruleCatalog?: TownRuleCatalog | null;
  runSummary?: unknown;
  snapshots?: unknown;
  diffs?: unknown;
  commands?: unknown;
  benchmarkSummary?: unknown;
  experimentManifest?: unknown;
  experimentSteps?: unknown;
  qualityReport?: unknown;
  catalogValidation?: unknown;
  caseGraph?: unknown;
  evidenceGraph?: unknown;
  replayBundle?: RunReplayBundle | null;
  reviewBundle?: unknown;
};

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function runDir(runId: string) {
  return path.join(STORE_DIR, runId.replace(/[^a-z0-9._-]/gi, "-"));
}

function stripRuntimeOnly(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripRuntimeOnly);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (["checkpoint", "hiddenDebugLog", "agent_state_snapshot", "apiKey", "api_key", "secretKey", "token"].includes(key)) continue;
      out[key] = stripRuntimeOnly(nested);
    }
    return out;
  }
  return value;
}

function writeJson(dir: string, name: string, value: unknown, files: RunArtifactFile[]) {
  if (value === undefined || value === null) return;
  const safeValue = stripRuntimeOnly(value);
  const target = path.join(dir, name);
  fs.writeFileSync(target, `${JSON.stringify(safeValue, null, 2)}\n`, "utf8");
  files.push({ name, path: name, bytes: fs.statSync(target).size });
}

export function saveRunArtifacts(input: ArtifactInput) {
  ensureDir(STORE_DIR);
  const dir = runDir(input.manifest.runId);
  ensureDir(dir);
  const files: RunArtifactFile[] = [];
  writeJson(dir, "scenario-pack.json", input.scenarioPack, files);
  writeJson(dir, "map-pack.json", input.mapPack, files);
  writeJson(dir, "rule-catalog.json", input.ruleCatalog, files);
  writeJson(dir, "run-summary.json", input.runSummary, files);
  writeJson(dir, "snapshots.json", input.snapshots || [], files);
  writeJson(dir, "diffs.json", input.diffs || [], files);
  writeJson(dir, "commands.json", input.commands || [], files);
  writeJson(dir, "benchmark-summary.json", input.benchmarkSummary, files);
  writeJson(dir, "experiment-manifest.json", input.experimentManifest, files);
  writeJson(dir, "steps.json", input.experimentSteps, files);
  writeJson(dir, "quality-report.json", input.qualityReport, files);
  writeJson(dir, "catalog-validation.json", input.catalogValidation, files);
  writeJson(dir, "case-graph.json", input.caseGraph || input.replayBundle?.caseGraphSummary, files);
  writeJson(dir, "evidence-graph.json", input.evidenceGraph || input.replayBundle?.evidenceGraphSummary, files);
  writeJson(dir, "replay-bundle.json", input.replayBundle, files);
  writeJson(dir, "review-bundle.json", input.reviewBundle, files);
  const manifest: RunArtifactManifest = { ...input.manifest, files };
  writeJson(dir, "manifest.json", manifest, files);
  return manifest;
}

export function loadRunArtifactManifest(runId: string) {
  const manifestPath = path.join(runDir(runId), "manifest.json");
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as RunArtifactManifest;
}

export function listRunArtifactManifests(limit = 20) {
  if (!fs.existsSync(STORE_DIR)) return [];
  const sortKey = (manifest: RunArtifactManifest) => manifest.finishedAt || manifest.startedAt || manifest.runId || "";
  return fs.readdirSync(STORE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => loadRunArtifactManifest(entry.name))
    .filter((manifest): manifest is RunArtifactManifest => Boolean(manifest))
    .sort((left, right) => sortKey(right).localeCompare(sortKey(left)))
    .slice(0, limit);
}

export function loadRunArtifactFile<T = unknown>(runId: string, fileName: string): T | null {
  const safeFile = path.basename(fileName);
  const filePath = path.join(runDir(runId), safeFile);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function buildReplayBundleFromArtifacts(runId: string) {
  const bundle = loadRunArtifactFile<RunReplayBundle>(runId, "replay-bundle.json");
  if (!bundle) return null;
  const manifest = loadRunArtifactManifest(runId);
  if (!manifest) return bundle;
  return {
    ...bundle,
    replayDigestSource: bundle.replayDigest ? "artifact" : bundle.replayDigestSource,
    artifactFiles: manifest.files,
    experimentMetadata: {
      experimentId: manifest.experimentId,
      experimentHash: manifest.experimentHash,
      catalogHash: manifest.ruleCatalogHash,
      qualityScore: manifest.qualityScore,
      catalogValidationOk: manifest.catalogValidationOk
    }
  };
}

export function artifactManifestToRunCatalogEntry(manifest: RunArtifactManifest): RunCatalogEntry {
  return {
    runId: manifest.runId,
    kind: manifest.kind,
    artifactAvailable: true,
    branchWorldId: manifest.branchWorldId,
    sourceWorldId: manifest.sourceWorldId,
    packId: manifest.scenarioPackId,
    mapPackId: manifest.mapPackId,
    ruleCatalogId: manifest.ruleCatalogId,
    scenarioId: manifest.scenarioId,
    startedAt: manifest.startedAt,
    finishedAt: manifest.finishedAt,
    status: manifest.status,
    engineVersion: manifest.engineVersion,
    summary: manifest.summary,
    packMetadata: {
      scenarioPackId: manifest.scenarioPackId,
      mapPackId: manifest.mapPackId,
      ruleCatalogId: manifest.ruleCatalogId,
      packHash: manifest.scenarioPackHash,
      experimentId: manifest.experimentId,
      experimentHash: manifest.experimentHash,
      catalogHash: manifest.ruleCatalogHash,
      qualityScore: manifest.qualityScore,
      catalogValidationOk: manifest.catalogValidationOk
    }
  };
}
