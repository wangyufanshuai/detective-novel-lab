import {
  createTownStateSnapshot,
  diffTownStateSnapshots,
  type PersistentTownRuntime,
  type ScenarioRun,
  type TownStateDiff,
  type TownStateSnapshot
} from "./persistent-town";
import type { EmergenceBenchmarkReport, WorldEvent, WorldState } from "./world-types";
import { buildRuntimeGraphSummaries, type CampaignGraphSummary, type EvidenceGraphSummary } from "./campaign-graphs";

export type RunCatalogEntry = {
  runId: string;
  kind?: "live" | "scenario" | "benchmark" | "long-run" | "simulation-quality" | "campaign" | "experiment-matrix";
  packId?: string;
  mapPackId?: string;
  ruleCatalogId?: string;
  artifactAvailable?: boolean;
  branchWorldId?: string;
  sourceWorldId?: string;
  scenarioId?: string;
  seed?: string;
  startedAt: string;
  finishedAt?: string;
  status: "queued" | "running" | "paused" | "cancelled" | "failed" | "completed" | "passed" | "blocked";
  engineVersion: string;
  summary: {
    branchCount: number;
    snapshotCount: number;
    eventGrowth: number;
    memoryGrowth: number;
    validCandidateCount: number;
    blockedCandidateCount: number;
  };
  packMetadata?: {
    scenarioPackId?: string;
    mapPackId?: string;
    ruleCatalogId?: string;
    packHash?: string;
    experimentId?: string;
    experimentHash?: string;
    catalogHash?: string;
    qualityScore?: number;
    catalogValidationOk?: boolean;
  };
};

export type RunArtifactFile = {
  name: string;
  path: string;
  bytes?: number;
};

export type RunArtifactManifest = {
  runId: string;
  kind: NonNullable<RunCatalogEntry["kind"]>;
  status: RunCatalogEntry["status"];
  sourceWorldId?: string;
  branchWorldId?: string;
  scenarioId?: string;
  scenarioPackId?: string;
  scenarioPackHash?: string;
  mapPackId?: string;
  mapPackHash?: string;
  ruleCatalogId?: string;
  ruleCatalogHash?: string;
  experimentId?: string;
  experimentHash?: string;
  qualityScore?: number;
  catalogValidationOk?: boolean;
  engineVersion: string;
  startedAt: string;
  finishedAt?: string;
  summary: RunCatalogEntry["summary"];
  files: RunArtifactFile[];
};

export type RunSnapshot = TownStateSnapshot;

export type RunDiff = TownStateDiff & {
  runId: string;
  phase?: string;
};

export type RunCommand = {
  id: string;
  runId: string;
  type: "scenario-intervention" | "reviewer-action" | "benchmark-rerun" | "export-action";
  createdAt: string;
  summary: string;
  payload?: unknown;
};

export type BenchmarkRunSummary = {
  runId: string;
  startedAt?: string;
  finishedAt?: string;
  packId?: string;
  mapPackId?: string;
  ruleCatalogId?: string;
  packHash?: string;
  seedCount: number;
  passed: number;
  failed: number;
  passRate: number;
  averageQualityScore: number;
  averageEmergenceScore: number;
  routeCertifiedRate?: number;
  autoSolvePassRate?: number;
};

export type RunComparison = {
  left: RunCatalogEntry;
  right: RunCatalogEntry;
  deltas: {
    eventGrowth: number;
    memoryGrowth: number;
    validCandidateCount: number;
    blockedCandidateCount: number;
    branchCount: number;
  };
  snapshotDiff?: TownStateDiff | null;
};

export type RunReplayBundle = {
  manifest: RunCatalogEntry;
  snapshots: RunSnapshot[];
  diffs: RunDiff[];
  commands: RunCommand[];
  benchmark?: BenchmarkRunSummary | null;
  packMetadata?: RunCatalogEntry["packMetadata"];
  artifactFiles?: RunArtifactFile[];
  experimentMetadata?: {
    experimentId?: string;
    experimentHash?: string;
    catalogHash?: string;
    qualityScore?: number;
    catalogValidationOk?: boolean;
  };
  caseGraphSummary?: CampaignGraphSummary;
  evidenceGraphSummary?: EvidenceGraphSummary;
  matrixMetadata?: {
    matrixId: string;
    score: number;
    experimentCount: number;
    variantCount: number;
  };
};

export type RunJobStatus = "queued" | "running" | "paused" | "cancelled" | "failed" | "completed";

export type RunJob = {
  id: string;
  kind: "scenario" | "benchmark";
  status: RunJobStatus;
  worldId: string;
  scenarioId?: string;
  runId?: string;
  resultRunId?: string;
  seedCount?: number;
  progress: {
    tick: number;
    phase: string;
    currentAction?: string;
    elapsedMs: number;
    percent: number;
  };
  createdAt: string;
  updatedAt: string;
  result?: unknown;
  error?: string;
};

export function scenarioRunToCatalogEntry(runtime: PersistentTownRuntime, run: ScenarioRun, packId?: string): RunCatalogEntry {
  const scenarioPackId = packId || runtime.currentScenarioPackId || run.config.id;
  return {
    runId: run.id,
    kind: "scenario",
    packId: scenarioPackId,
    mapPackId: runtime.currentMapPackId,
    ruleCatalogId: runtime.currentRuleCatalogId,
    branchWorldId: runtime.currentExperiment?.branchWorldId,
    sourceWorldId: runtime.currentExperiment?.sourceWorldId,
    scenarioId: run.id,
    seed: run.config.seed,
    startedAt: run.startedAt,
    finishedAt: run.completedAt,
    status: run.status === "passed" ? "passed" : "failed",
    engineVersion: "persistent-town.v1",
    summary: {
      branchCount: run.report.branches.length,
      snapshotCount: (runtime.snapshots || []).filter((snapshot) => snapshot.scenarioId === run.id).length,
      eventGrowth: run.report.baseline.eventGrowth,
      memoryGrowth: run.report.baseline.memoryGrowth,
      validCandidateCount: run.report.baseline.validCandidateCount,
      blockedCandidateCount: run.report.baseline.blockedCandidateCount
    },
    packMetadata: {
      scenarioPackId,
      mapPackId: runtime.currentMapPackId,
      ruleCatalogId: runtime.currentRuleCatalogId,
      packHash: runtime.currentExperiment?.scenarioPackHash,
      experimentId: runtime.currentExperiment?.experimentId,
      experimentHash: runtime.currentExperiment?.experimentHash,
      catalogHash: runtime.currentExperiment?.ruleCatalogHash
    }
  };
}

export function benchmarkSummaryToCatalogEntry(runtime: PersistentTownRuntime, summary: BenchmarkRunSummary): RunCatalogEntry {
  return {
    runId: summary.runId,
    kind: "benchmark",
    packId: summary.packId || runtime.currentScenarioPackId,
    mapPackId: summary.mapPackId || runtime.currentMapPackId,
    ruleCatalogId: summary.ruleCatalogId || runtime.currentRuleCatalogId,
    branchWorldId: runtime.currentExperiment?.branchWorldId,
    sourceWorldId: runtime.currentExperiment?.sourceWorldId,
    startedAt: summary.startedAt || summary.finishedAt || runtime.updatedAt,
    finishedAt: summary.finishedAt || summary.startedAt || runtime.updatedAt,
    status: summary.failed > 0 ? "failed" : "passed",
    engineVersion: "persistent-town.v1",
    summary: {
      branchCount: 0,
      snapshotCount: 0,
      eventGrowth: 0,
      memoryGrowth: 0,
      validCandidateCount: summary.passed,
      blockedCandidateCount: summary.failed
    },
    packMetadata: {
      scenarioPackId: summary.packId || runtime.currentScenarioPackId,
      mapPackId: summary.mapPackId || runtime.currentMapPackId,
      ruleCatalogId: summary.ruleCatalogId || runtime.currentRuleCatalogId,
      packHash: summary.packHash,
      experimentId: runtime.currentExperiment?.experimentId,
      experimentHash: runtime.currentExperiment?.experimentHash,
      catalogHash: runtime.currentExperiment?.ruleCatalogHash
    }
  };
}

export function listRunCatalog(runtime: PersistentTownRuntime): RunCatalogEntry[] {
  const scenarioEntries = [...(runtime.scenarioRuns || [])].map((run) => scenarioRunToCatalogEntry(runtime, run));
  const benchmarkEntries = [...(runtime.benchmarkRuns || [])].map((summary) => benchmarkSummaryToCatalogEntry(runtime, summary));
  const latestRuntimeEntry: RunCatalogEntry = {
    runId: `${runtime.id}-live`,
    kind: "live",
    packId: runtime.currentScenarioPackId,
    mapPackId: runtime.currentMapPackId,
    ruleCatalogId: runtime.currentRuleCatalogId,
    branchWorldId: runtime.currentExperiment?.branchWorldId,
    sourceWorldId: runtime.currentExperiment?.sourceWorldId,
    startedAt: runtime.createdAt,
    finishedAt: runtime.status === "running" ? undefined : runtime.updatedAt,
    status: runtime.status === "completed" ? "completed" : runtime.status,
    engineVersion: "persistent-town.v1",
    summary: {
      branchCount: 0,
      snapshotCount: runtime.snapshots?.length || 0,
      eventGrowth: runtime.reports.flatMap((report) => report.eventIds).length,
      memoryGrowth: runtime.memoryPropagations?.length || 0,
      validCandidateCount: runtime.candidates.filter((candidate) => candidate.validation.valid).length,
      blockedCandidateCount: runtime.candidates.filter((candidate) => !candidate.validation.valid).length
    },
    packMetadata: {
      scenarioPackId: runtime.currentScenarioPackId,
      mapPackId: runtime.currentMapPackId,
      ruleCatalogId: runtime.currentRuleCatalogId,
      experimentId: runtime.currentExperiment?.experimentId,
      experimentHash: runtime.currentExperiment?.experimentHash,
      catalogHash: runtime.currentExperiment?.ruleCatalogHash
    }
  };
  const sortKey = (entry: RunCatalogEntry) => entry.finishedAt || entry.startedAt || entry.runId || "";
  return [latestRuntimeEntry, ...benchmarkEntries, ...scenarioEntries]
    .sort((left, right) => sortKey(right).localeCompare(sortKey(left)))
    .slice(0, 20);
}

export function findRunCatalogEntry(runtime: PersistentTownRuntime, runId: string) {
  return listRunCatalog(runtime).find((entry) => entry.runId === runId) || null;
}

export function snapshotsForRun(runtime: PersistentTownRuntime, runId: string): RunSnapshot[] {
  if (runId === `${runtime.id}-live`) return [...(runtime.snapshots || [])];
  return [...(runtime.snapshots || [])].filter((snapshot) => snapshot.scenarioId === runId);
}

export function diffsForRun(runtime: PersistentTownRuntime, runId: string): RunDiff[] {
  const snapshots = snapshotsForRun(runtime, runId).sort((left, right) => left.tick - right.tick || left.createdAt.localeCompare(right.createdAt));
  const diffs: RunDiff[] = [];
  for (let index = 1; index < snapshots.length; index += 1) {
    diffs.push({ ...diffTownStateSnapshots(snapshots[index - 1], snapshots[index]), runId, phase: snapshots[index].branchId || "main" });
  }
  return diffs;
}

export function commandsForRun(runtime: PersistentTownRuntime, runId: string): RunCommand[] {
  const scenario = runtime.scenarioRuns?.find((run) => run.id === runId);
  const commands: RunCommand[] = [];
  if (scenario) {
    for (const branch of scenario.config.branches || []) {
      for (const scheduled of branch.interventions) {
        commands.push({
          id: `command-${runId}-${branch.id}-${scheduled.atTickOffset}`,
          runId,
          type: "scenario-intervention",
          createdAt: scenario.startedAt,
          summary: `${scheduled.intervention.kind} for ${scheduled.intervention.actorId} at +${scheduled.atTickOffset}`,
          payload: scheduled
        });
      }
    }
  }
  return commands;
}

export function benchmarkToRunSummary(report?: EmergenceBenchmarkReport | null): BenchmarkRunSummary | null {
  if (!report) return null;
  return {
    runId: `benchmark-${report.generatedAt}`,
    startedAt: report.generatedAt,
    finishedAt: report.generatedAt,
    seedCount: report.seedCount,
    passed: report.passed,
    failed: report.failed,
    passRate: report.passRate,
    averageQualityScore: report.averageQualityScore,
    averageEmergenceScore: report.averageEmergenceScore,
    routeCertifiedRate: report.routeCertifiedRate,
    autoSolvePassRate: report.autoSolvePassRate
  };
}

export function compareRuns(runtime: PersistentTownRuntime, leftRunId: string, rightRunId: string): RunComparison | null {
  const left = findRunCatalogEntry(runtime, leftRunId);
  const right = findRunCatalogEntry(runtime, rightRunId);
  if (!left || !right) return null;
  const leftSnapshots = snapshotsForRun(runtime, leftRunId);
  const rightSnapshots = snapshotsForRun(runtime, rightRunId);
  const snapshotDiff = leftSnapshots.length && rightSnapshots.length
    ? diffTownStateSnapshots(leftSnapshots[leftSnapshots.length - 1], rightSnapshots[rightSnapshots.length - 1])
    : null;
  return {
    left,
    right,
    deltas: {
      eventGrowth: right.summary.eventGrowth - left.summary.eventGrowth,
      memoryGrowth: right.summary.memoryGrowth - left.summary.memoryGrowth,
      validCandidateCount: right.summary.validCandidateCount - left.summary.validCandidateCount,
      blockedCandidateCount: right.summary.blockedCandidateCount - left.summary.blockedCandidateCount,
      branchCount: right.summary.branchCount - left.summary.branchCount
    },
    snapshotDiff
  };
}

export function buildRunReplayBundle(runtime: PersistentTownRuntime, runId: string, benchmark?: EmergenceBenchmarkReport | null): RunReplayBundle | null {
  const manifest = findRunCatalogEntry(runtime, runId);
  if (!manifest) return null;
  const storedBenchmark = runtime.benchmarkRuns?.find((summary) => summary.runId === runId) || null;
  const graphSummaries = buildRuntimeGraphSummaries({
    caseTimeline: runtime.caseLifecycle?.caseTimeline,
    evidenceItems: runtime.ruleState?.evidenceChain.items,
    longActions: runtime.ruleState?.longActions
  });
  return {
    manifest,
    snapshots: snapshotsForRun(runtime, runId),
    diffs: diffsForRun(runtime, runId),
    commands: commandsForRun(runtime, runId),
    benchmark: storedBenchmark || benchmarkToRunSummary(benchmark),
    packMetadata: manifest.packMetadata,
    experimentMetadata: {
      experimentId: manifest.packMetadata?.experimentId,
      experimentHash: manifest.packMetadata?.experimentHash,
      catalogHash: manifest.packMetadata?.catalogHash,
      qualityScore: manifest.packMetadata?.qualityScore,
      catalogValidationOk: manifest.packMetadata?.catalogValidationOk
    },
    ...graphSummaries
  };
}

export function createLiveRunSnapshot(world: WorldState, events: WorldEvent[], runtime: PersistentTownRuntime) {
  return createTownStateSnapshot({ ...world, persistentRuntime: runtime } as WorldState, events, {
    id: `snapshot-${runtime.id}-live-${runtime.tick}`,
    label: `Live tick ${runtime.tick}`
  });
}

export function createRunJob(input: { worldId: string; kind: "scenario" | "benchmark"; scenarioId?: string; seedCount?: number }): RunJob {
  const now = new Date().toISOString();
  return {
    id: `job-${input.kind}-${input.worldId}-${Date.now()}`,
    kind: input.kind,
    status: "queued",
    worldId: input.worldId,
    scenarioId: input.scenarioId,
    seedCount: input.seedCount,
    progress: { tick: 0, phase: "queued", elapsedMs: 0, percent: 0 },
    createdAt: now,
    updatedAt: now
  };
}
