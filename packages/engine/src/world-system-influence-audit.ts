import type { DetectiveContentPack, WorldSystemRuntimeHints } from "./detective-content";
import { deriveWorldSystemRuntimeHints } from "./detective-content";
import {
  advancePersistentTownTick,
  createPersistentTownRuntime,
  type NpcActionKind,
  type PersistentTownRuntime,
  type TownEmergenceQueue
} from "./persistent-town";
import { createInitialWorld, simulateDailyLife } from "./world-simulator";
import type { WorldEvent, WorldState } from "./world-types";

export type WorldSystemInfluenceAuditDelta = {
  actionKindDelta: Record<string, number>;
  validCandidateTrendDelta: number;
  appliedBiasDelta: number;
  hintedActionShareDelta: number;
};

export type WorldSystemInfluenceAuditSeedResult = {
  seed: string;
  tickCount: number;
  baseline: WorldSystemInfluenceAuditRunSummary;
  hinted: WorldSystemInfluenceAuditRunSummary;
  delta: WorldSystemInfluenceAuditDelta;
  deterministicHash: string;
};

export type WorldSystemInfluenceAuditRunSummary = {
  selectedActionKindDistribution: Partial<Record<NpcActionKind, number>>;
  selectedActionCount: number;
  hintedActionCount: number;
  hintedActionShare: number;
  decisionCount: number;
  decisionsWithoutLegalCandidates: number;
  appliedBiasCount: number;
  maxBias: number;
  legalCandidateCount: number;
  validCandidateTrend: number;
  institutionDecisionCount: number;
  institutionLabelCoverage: number;
  runtimeMs: number;
};

export type WorldSystemInfluenceAuditReport = {
  schemaVersion: "world-system-influence-audit.v1";
  generatedAt: string;
  seedCount: number;
  tickCount: number;
  ok: boolean;
  safety: {
    maxBiasOk: boolean;
    noLegalCandidateLoss: boolean;
    deterministicHashOk: boolean;
    publicSafe: boolean;
  };
  aggregate: {
    appliedBiasCount: number;
    maxBias: number;
    hintedActionShare: number;
    institutionLabelCoverage: number;
    validCandidateTrendDelta: number;
    runtimeMs: number;
    actionKindDelta: Record<string, number>;
  };
  seeds: WorldSystemInfluenceAuditSeedResult[];
};

type RuntimeWorld = WorldState & { persistentRuntime?: PersistentTownRuntime };

export type WorldSystemInfluenceAuditConfig = {
  seeds?: string[];
  tickCount?: number;
  npcCount?: number;
  timelineHours?: number;
  contentPack: DetectiveContentPack;
};

const DEFAULT_SEEDS = ["hint-audit-a", "hint-audit-b", "hint-audit-c"];

function stableHash(value: unknown) {
  const canonical = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(canonical);
    if (input && typeof input === "object") {
      return Object.fromEntries(Object.entries(input as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonical(nested)]));
    }
    return input;
  };
  const text = JSON.stringify(canonical(value));
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function percent(part: number, total: number) {
  return total <= 0 ? 0 : Math.round((part / total) * 100);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function actionDistribution(runtime: PersistentTownRuntime) {
  const distribution: Partial<Record<NpcActionKind, number>> = {};
  for (const trace of runtime.decisionTraces || []) {
    const selected = trace.candidates.find((candidate) => candidate.id === trace.selectedCandidateId);
    if (selected?.kind) distribution[selected.kind] = (distribution[selected.kind] || 0) + 1;
  }
  return distribution;
}

function countHintedActions(runtime: PersistentTownRuntime) {
  return (runtime.decisionTraces || []).reduce((count, trace) => {
    const selected = trace.candidates.find((candidate) => candidate.id === trace.selectedCandidateId);
    return count + ((selected?.score.worldSystemBias || 0) > 0 ? 1 : 0);
  }, 0);
}

function maxSelectedBias(runtime: PersistentTownRuntime) {
  return Math.max(0, ...(runtime.decisionTraces || []).map((trace) => {
    const selected = trace.candidates.find((candidate) => candidate.id === trace.selectedCandidateId);
    return selected?.score.worldSystemBias || 0;
  }));
}

function institutionLabelCoverage(runtime: PersistentTownRuntime) {
  const decisions = runtime.ruleState?.institutionDecisions || [];
  return percent(decisions.filter((decision) => (decision.worldSystemLabels || []).length > 0).length, decisions.length);
}

function summarizeRun(runtime: PersistentTownRuntime, queue: TownEmergenceQueue, runtimeMs: number): WorldSystemInfluenceAuditRunSummary {
  const selectedActionKindDistribution = actionDistribution(runtime);
  const selectedActionCount = sum(Object.values(selectedActionKindDistribution).map((value) => value || 0));
  const hintedActionCount = countHintedActions(runtime);
  const decisionCount = (runtime.decisionTraces || []).length;
  return {
    selectedActionKindDistribution,
    selectedActionCount,
    hintedActionCount,
    hintedActionShare: percent(hintedActionCount, selectedActionCount),
    decisionCount,
    decisionsWithoutLegalCandidates: (runtime.decisionTraces || []).filter((trace) => !trace.candidates.some((candidate) => candidate.legal)).length,
    appliedBiasCount: runtime.worldSystemHintSummary?.appliedBiasCount || 0,
    maxBias: Math.max(runtime.worldSystemHintSummary?.maxActionBias || 0, maxSelectedBias(runtime)),
    legalCandidateCount: (runtime.decisionTraces || []).reduce((count, trace) => count + trace.candidates.filter((candidate) => candidate.legal).length, 0),
    validCandidateTrend: queue.validCount,
    institutionDecisionCount: runtime.ruleState?.institutionDecisions?.length || 0,
    institutionLabelCoverage: institutionLabelCoverage(runtime),
    runtimeMs: Math.round(runtimeMs)
  };
}

function actionKindDelta(left: Partial<Record<NpcActionKind, number>>, right: Partial<Record<NpcActionKind, number>>) {
  const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();
  return Object.fromEntries(keys.map((key) => [key, (right[key as NpcActionKind] || 0) - (left[key as NpcActionKind] || 0)]));
}

function prepareWorld(seed: string, tickCount: number, hints?: WorldSystemRuntimeHints): { world: RuntimeWorld; events: WorldEvent[] } {
  const world = createInitialWorld(seed, { mode: "advanced", npcCount: 24, timelineHours: 96 });
  const daily = simulateDailyLife(world, 4, []);
  const runtime = createPersistentTownRuntime(daily.world, daily.events, {
    maxTicks: tickCount + 20,
    worldSystemHints: hints
  });
  return {
    world: { ...daily.world, persistentRuntime: runtime },
    events: daily.events
  };
}

function runVariant(seed: string, tickCount: number, hints?: WorldSystemRuntimeHints) {
  const prepared = prepareWorld(seed, tickCount, hints);
  const started = performance.now();
  let currentWorld = prepared.world;
  let currentEvents = prepared.events;
  let result = advancePersistentTownTick(currentWorld, currentEvents, { steps: Math.min(60, tickCount), status: "running" });
  currentWorld = result.world as RuntimeWorld;
  currentEvents = [...currentEvents, ...result.events];
  const remaining = Math.max(0, tickCount - Math.min(60, tickCount));
  if (remaining > 0) {
    result = advancePersistentTownTick(currentWorld, currentEvents, { steps: remaining, status: "running" });
  }
  return {
    runtime: result.runtime,
    queue: result.queue,
    runtimeMs: performance.now() - started
  };
}

function publicSafeReport(value: unknown) {
  return !/(npc-|evidence-|event-|source-|culpritId|victimId|checkpoint|agent_state_snapshot|[A-Za-z]:[\\/]|\.env\.local|sk-[A-Za-z0-9])/i.test(JSON.stringify(value));
}

export function runWorldSystemInfluenceAudit(config: WorldSystemInfluenceAuditConfig): WorldSystemInfluenceAuditReport {
  const seeds = (config.seeds?.length ? config.seeds : DEFAULT_SEEDS).slice(0, 12);
  const tickCount = Math.max(1, Math.min(1000, config.tickCount || 120));
  const results = seeds.map((seed): WorldSystemInfluenceAuditSeedResult => {
    const hints = deriveWorldSystemRuntimeHints(config.contentPack);
    const baselineRun = runVariant(seed, tickCount);
    const hintedRun = runVariant(seed, tickCount, hints);
    const baseline = summarizeRun(baselineRun.runtime, baselineRun.queue, baselineRun.runtimeMs);
    const hinted = summarizeRun(hintedRun.runtime, hintedRun.queue, hintedRun.runtimeMs);
    const delta = {
      actionKindDelta: actionKindDelta(baseline.selectedActionKindDistribution, hinted.selectedActionKindDistribution),
      validCandidateTrendDelta: hinted.validCandidateTrend - baseline.validCandidateTrend,
      appliedBiasDelta: hinted.appliedBiasCount - baseline.appliedBiasCount,
      hintedActionShareDelta: hinted.hintedActionShare - baseline.hintedActionShare
    };
    const hashInput = {
      seed,
      tickCount,
      baseline: { ...baseline, runtimeMs: 0 },
      hinted: { ...hinted, runtimeMs: 0 },
      delta
    };
    return {
      seed,
      tickCount,
      baseline,
      hinted,
      delta,
      deterministicHash: stableHash(hashInput)
    };
  });
  const aggregateActionKeys = Array.from(new Set(results.flatMap((result) => Object.keys(result.delta.actionKindDelta)))).sort();
  const aggregate = {
    appliedBiasCount: sum(results.map((result) => result.hinted.appliedBiasCount)),
    maxBias: Math.max(0, ...results.map((result) => result.hinted.maxBias)),
    hintedActionShare: percent(sum(results.map((result) => result.hinted.hintedActionCount)), sum(results.map((result) => result.hinted.selectedActionCount))),
    institutionLabelCoverage: percent(sum(results.map((result) => result.hinted.institutionLabelCoverage)), results.length * 100),
    validCandidateTrendDelta: sum(results.map((result) => result.delta.validCandidateTrendDelta)),
    runtimeMs: sum(results.map((result) => result.baseline.runtimeMs + result.hinted.runtimeMs)),
    actionKindDelta: Object.fromEntries(aggregateActionKeys.map((key) => [key, sum(results.map((result) => result.delta.actionKindDelta[key] || 0))]))
  };
  const safety = {
    maxBiasOk: aggregate.maxBias <= 4,
    noLegalCandidateLoss: results.every((result) => result.hinted.decisionsWithoutLegalCandidates <= result.baseline.decisionsWithoutLegalCandidates),
    deterministicHashOk: new Set(results.map((result) => result.deterministicHash)).size === results.length,
    publicSafe: false
  };
  const report: WorldSystemInfluenceAuditReport = {
    schemaVersion: "world-system-influence-audit.v1",
    generatedAt: new Date().toISOString(),
    seedCount: results.length,
    tickCount,
    ok: false,
    safety,
    aggregate,
    seeds: results
  };
  report.safety.publicSafe = publicSafeReport(report);
  report.ok = Object.values(report.safety).every(Boolean);
  return report;
}
