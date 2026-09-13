import {
  advancePersistentTownTick,
  buildTownEmergenceQueue,
  createPersistentTownRuntime,
  extractPlayableCaseFromCandidate,
  resolveCaseInWorld,
  type CaseCandidate,
  type CampaignCaseTimelineEntry,
  type PersistentTownRuntime,
  type TownCaseLifecycleState,
  type TownCaseType,
  type TownPerformanceSummary
} from "./persistent-town";
import { createScenarioPackFromWorld, createWorldFromScenarioPack, type ScenarioPack } from "./scenario-pack";
import { createTownMapPackFromWorld, type TownMapPack } from "./town-map-pack";
import {
  catalogToTownRuleRuntimeState,
  createDefaultTownRuleCatalog,
  ensureTownRuleRuntimeState,
  type TownRuleCatalog,
  type TownRuleRuntimeState
} from "./town-rules";
import { createInitialWorld, simulateDailyLife } from "./world-simulator";
import type { CaseFromLog, WorldEvent, WorldState } from "./world-types";
import {
  buildCampaignTimelineGraph,
  buildEvidenceGraph,
  summarizeCampaignGraph,
  summarizeEvidenceGraph,
  type CampaignTimelineGraph,
  type EvidenceGraph
} from "./campaign-graphs";

export type RuleAblationVariant = "baseline" | "no-media" | "no-institution-pressure" | "no-contamination";

export type LongRunValidationConfig = {
  seed?: string;
  tickCount?: number;
  minimumCaseCount?: number;
  npcCount?: number;
  timelineHours?: number;
  scenarioPack?: ScenarioPack;
  mapPack?: TownMapPack;
  ruleCatalog?: TownRuleCatalog;
  variant?: RuleAblationVariant;
  chunkSize?: number;
  snapshotEveryTicks?: number;
  checkpointEveryTicks?: number;
  candidateEveryTicks?: number;
  actionEveryTicks?: number;
  indexEventLimit?: number;
  maxExtractionsPerChunk?: number;
  requireCompleteEvidenceCandidates?: boolean;
  requireNewCandidatePair?: boolean;
  cloneInput?: boolean;
};

export type CaseContinuityMetric = {
  caseId: string;
  triggeredEventId?: string;
  tick: number;
  culpritId: string;
  victimId: string;
  locationId?: string;
  outcome: "solved" | "failed" | "extracted" | "forming";
  caseType?: TownCaseType;
  repeatedNpcIds: string[];
  institutionIds: string[];
  longActionIds: string[];
  institutionDecisionIds: string[];
  evidenceChainItemIds: string[];
  contaminatedEvidenceIds: string[];
  aftermathIds: string[];
  resourceDeltas: Record<string, number>;
  publicOpinionDelta: Record<string, number | undefined>;
  evidenceContaminationDelta: number;
};

export type CampaignDiversitySummary = {
  caseTypeDistribution: Partial<Record<TownCaseType, number>>;
  distinctCaseTypeCount: number;
  repeatedNpcPairCount: number;
  repeatedLocationCount: number;
  crossCaseInfluenceCount: number;
  laterCaseInfluenceRate: number;
  strongestCausalChains: string[];
};

export type WorldStabilityTrendPoint = {
  tick: number;
  candidateCount: number;
  validCandidateCount: number;
};

export type CandidateLifecycleDiagnostic = {
  tick: number;
  aliveNpcCount: number;
  pressureCount: number;
  ledgerCount: number;
  completeChainCount: number;
  triggerReadyChainCount: number;
  candidateCount: number;
  validCandidateCount: number;
  triggerBackedCandidateCount: number;
};

export type WorldStabilityMetrics = {
  selectedActionKindCount: number;
  selectedActionKindDistribution: Partial<Record<string, number>>;
  largestSelectedActionShare: number;
  activeActorCount: number;
  actorDecisionDistribution: Partial<Record<string, number>>;
  largestActorShare: number;
  validCandidateCountTrend: WorldStabilityTrendPoint[];
  institutionDecisionCount: number;
  evidenceCompleteCaseCount: number;
  candidateRepeatRate: number;
  deterministicRunHash: string;
};

export type CausalMetricSummary = {
  tickCount: number;
  caseCount: number;
  solvedCaseCount: number;
  failedCaseCount: number;
  crossCaseNpcReuseRate: number;
  institutionAftermathPropagationCount: number;
  institutionPressureMagnitude: number;
  resourceDeltaByKind: Record<string, number>;
  candidateDiversityScore: number;
  candidateRepeatRate: number;
  causalLinkCount: number;
  uniqueCaseCount: number;
  caseGraph: CampaignTimelineGraph;
  evidenceGraph: EvidenceGraph;
  diversity: CampaignDiversitySummary;
  worldStability: WorldStabilityMetrics;
  deterministicRunHash: string;
  continuity: CaseContinuityMetric[];
  causalClaims: string[];
};

export type MultiCaseRunSummary = {
  runId: string;
  variant: RuleAblationVariant;
  seed: string;
  worldId: string;
  tickCount: number;
  caseCount: number;
  solvedCaseCount: number;
  failedCaseCount: number;
  finalCandidateCount: number;
  validCandidateCount: number;
  finalStatus: PersistentTownRuntime["status"];
};

export type LongRunValidationReport = {
  generatedAt: string;
  ok: boolean;
  config: Required<Pick<LongRunValidationConfig, "seed" | "tickCount" | "minimumCaseCount" | "npcCount" | "timelineHours" | "variant">>;
  summary: MultiCaseRunSummary;
  metrics: CausalMetricSummary;
  cases: CaseContinuityMetric[];
  performance: TownPerformanceSummary;
  recentCandidateReasons: string[];
  candidateRejectionReasonCounts: Record<string, number>;
  candidateLifecycleDiagnostics: CandidateLifecycleDiagnostic[];
  errors: string[];
  warnings: string[];
};

export type RuleAblationDelta = {
  variant: Exclude<RuleAblationVariant, "baseline">;
  changed: boolean;
  strongestMetric: string;
  relativeChange: number;
  metricDeltas: Record<string, number>;
};

export type RuleAblationReport = {
  generatedAt: string;
  ok: boolean;
  threshold: number;
  baseline: LongRunValidationReport;
  variants: Record<Exclude<RuleAblationVariant, "baseline">, LongRunValidationReport>;
  ablationDeltas: RuleAblationDelta[];
  errors: string[];
};

export type SimulationQualityGate = {
  tickCount: number;
  minimumCaseCount: number;
  minCandidateDiversityScore: number;
  maxCandidateRepeatRate: number;
  minCausalLinkCount: number;
  minCrossCaseInfluenceCount: number;
  maxRuntimeMs?: number;
  minDistinctCaseTypeCount?: number;
  minLaterCaseInfluenceRate?: number;
  maxEvidenceGraphWarnings?: number;
  minSelectedActionKindCount?: number;
  maxLargestSelectedActionShare?: number;
  minInstitutionDecisionCount?: number;
  minEvidenceCompleteCaseCount?: number;
};

export type StableWorldSeedGateSummary = {
  seed: string;
  ok: boolean;
  caseCount: number;
  uniqueCaseCount: number;
  distinctCaseTypeCount: number;
  candidateRepeatRate: number;
  laterCaseInfluenceRate: number;
  evidenceGraphWarnings: number;
  selectedActionKindCount: number;
  largestSelectedActionShare: number;
  activeActorCount: number;
  largestActorShare: number;
  institutionDecisionCount: number;
  evidenceCompleteCaseCount: number;
  runtimeMs: number;
  deterministicRunHash: string;
  errors: string[];
};

export type MultiSeedWorldStabilitySummary = {
  passedSeedCount: number;
  failedSeedCount: number;
  worstCandidateRepeatRate: number;
  lowestDistinctCaseTypeCount: number;
  lowestSelectedActionKindCount: number;
  highestLargestSelectedActionShare: number;
  lowestInstitutionDecisionCount: number;
  deterministicRunHashes: Record<string, string>;
  perSeed: StableWorldSeedGateSummary[];
};

export type StableWorldDiagnosticSeverity = "ok" | "watch" | "risk" | "blocker";

export type StableWorldDiagnosticDimension =
  | "action-mix"
  | "actor-spread"
  | "candidate-maturity"
  | "case-diversity"
  | "institution-influence"
  | "evidence-closure"
  | "cross-case-influence"
  | "performance"
  | "determinism";

export type StableWorldDiagnosticFinding = {
  seed: string;
  severity: StableWorldDiagnosticSeverity;
  dimension: StableWorldDiagnosticDimension;
  metric: string;
  actual: string | number;
  target: string | number;
  message: string;
  recommendedNextInspection: string;
};

export type StableWorldSeedDiagnostics = {
  seed: string;
  status: StableWorldDiagnosticSeverity;
  deterministicRunHash: string;
  findingCounts: Record<StableWorldDiagnosticSeverity, number>;
  actionMix: {
    selectedActionKindCount: number;
    largestSelectedActionShare: number;
    topActionKind: string;
    topActionKindShare: number;
  };
  actorSpread: {
    activeActorCount: number;
    largestActorShare: number;
    topActorShares: number[];
  };
  candidateMaturity: {
    firstValidCandidateCount: number;
    lastValidCandidateCount: number;
    lowestValidCandidateCount: number;
    highestValidCandidateCount: number;
    trendDeclined: boolean;
    trendFlat: boolean;
  };
  performance: {
    runtimeMs: number;
    maxRuntimeMs: number;
    topPhases: Array<{ phase: string; share: number; totalMs: number }>;
  };
  findings: StableWorldDiagnosticFinding[];
};

export type StableWorldDiagnosticsReport = {
  generatedAt: string;
  ok: boolean;
  overallStatus: StableWorldDiagnosticSeverity;
  findingCounts: Record<StableWorldDiagnosticSeverity, number>;
  topRisks: StableWorldDiagnosticFinding[];
  slowestSeed: string;
  largestActionShareSeed: string;
  lowestCaseTypeSeed: string;
  lowestInstitutionSeed: string;
  seeds: StableWorldSeedDiagnostics[];
};

export type StableWorldRegressionStatus = "improved" | "unchanged" | "watch" | "regressed" | "blocked";

export type StableWorldMetricDelta = {
  seed: string;
  status: StableWorldRegressionStatus;
  metric: string;
  previous: string | number;
  current: string | number;
  delta: string | number;
  message: string;
  recommendedNextInspection: string;
};

export type StableWorldSeedRegression = {
  seed: string;
  status: StableWorldRegressionStatus;
  deltaCounts: Record<StableWorldRegressionStatus, number>;
  deterministicRunHash: string;
  runtimeDeltaMs: number;
  deltas: StableWorldMetricDelta[];
};

export type StableWorldRegressionReport = {
  generatedAt: string;
  baselineAvailable: boolean;
  ok: boolean;
  overallStatus: StableWorldRegressionStatus;
  deltaCounts: Record<StableWorldRegressionStatus, number>;
  topRegressions: StableWorldMetricDelta[];
  perSeedStatus: Record<string, StableWorldRegressionStatus>;
  runtimeDeltaBySeed: Record<string, number>;
  seeds: StableWorldSeedRegression[];
};

export type StableWorldRegressionInput = {
  quality?: SimulationQualityReport;
  diagnostics?: StableWorldDiagnosticsReport;
} | null | undefined;

export type StableWorldCaseQualityDimension =
  | "fair-play-evidence"
  | "evidence-provenance"
  | "case-diversity"
  | "cross-case-continuity"
  | "institution-relevance"
  | "repeat-control"
  | "solution-readiness";

export type StableWorldCaseQualityStatus = "ok" | "watch" | "risk";

export type StableWorldCaseQualityDimensionScore = {
  dimension: StableWorldCaseQualityDimension;
  score: number;
  actual: string | number;
  target: string | number;
  message: string;
};

export type StableWorldCaseQualitySeed = {
  seed: string;
  status: StableWorldCaseQualityStatus;
  score: number;
  deterministicRunHash: string;
  caseCount: number;
  solvedCaseCount: number;
  distinctCaseTypeCount: number;
  evidenceCompleteCaseCount: number;
  evidenceWarningCount: number;
  laterCaseInfluenceRate: number;
  institutionDecisionCount: number;
  repeatRate: number;
  dimensions: StableWorldCaseQualityDimensionScore[];
};

export type StableWorldCaseQualityReport = {
  generatedAt: string;
  ok: boolean;
  nonBlocking: true;
  overallStatus: StableWorldCaseQualityStatus;
  minScore: number;
  averageScore: number;
  statusCounts: Record<StableWorldCaseQualityStatus, number>;
  dimensionAverages: Record<StableWorldCaseQualityDimension, number>;
  dimensionMinimums: Record<StableWorldCaseQualityDimension, number>;
  seeds: StableWorldCaseQualitySeed[];
};

export type SimulationQualityReport = {
  generatedAt: string;
  ok: boolean;
  seeds: string[];
  gate: SimulationQualityGate;
  reports: LongRunValidationReport[];
  summary: {
    runCount: number;
    passed: number;
    failed: number;
    averageRuntimeMs: number;
    averageCandidateDiversityScore: number;
    averageCandidateRepeatRate: number;
    averageCausalLinkCount: number;
    totalCrossCaseInfluenceCount: number;
    stability: MultiSeedWorldStabilitySummary;
  };
  errors: string[];
};

export type CampaignRunReport = {
  generatedAt: string;
  ok: boolean;
  seed: string;
  tickCount: number;
  report: LongRunValidationReport;
  quality: SimulationQualityReport;
  errors: string[];
};

export type CampaignPerformanceGate = {
  maxRuntimeMs: number;
  maxCaseChainRatio: number;
  maxSnapshotRatio: number;
  maxActionScoringRatio: number;
};

type RunState = {
  world: WorldState;
  events: WorldEvent[];
  runtime: PersistentTownRuntime;
};

type RuntimeWorldState = WorldState & { persistentRuntime?: PersistentTownRuntime };

type ExtractedCase = {
  caseId: string;
  tick: number;
  locationId?: string;
  candidate: CaseCandidate;
  activeCase: CaseFromLog;
};

const DEFAULT_SEED = "long-run-validation";
const DEFAULT_TICKS = 100;
const DEFAULT_MIN_CASES = 3;
const ENGINE_VERSION = "persistent-town.long-run.v1";

function emptyPerformanceSummary(): TownPerformanceSummary {
  return {
    totalMs: 0,
    tickCount: 0,
    averageTickMs: 0,
    phases: [],
    counters: {
      snapshotCount: 0,
      checkpointCount: 0,
      candidateRebuildCount: 0,
      socialPressureRebuildCount: 0
    },
    growth: { events: 0, memories: 0, observations: 0 }
  };
}

function mergePerformanceSummary(target: TownPerformanceSummary, source?: TownPerformanceSummary) {
  if (!source) return;
  target.tickCount += source.tickCount;
  for (const phase of source.phases) {
    const existing = target.phases.find((item) => item.phase === phase.phase);
    if (existing) {
      existing.calls += phase.calls;
      existing.totalMs += phase.totalMs;
      existing.maxMs = Math.max(existing.maxMs, phase.maxMs);
    } else {
      target.phases.push({ ...phase });
    }
  }
  for (const key of Object.keys(target.counters) as Array<keyof TownPerformanceSummary["counters"]>) {
    target.counters[key] += source.counters[key];
  }
  for (const key of Object.keys(target.growth) as Array<keyof TownPerformanceSummary["growth"]>) {
    target.growth[key] += source.growth[key];
  }
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => typeof item !== "undefined")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function deterministicHash(value: unknown) {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function cloneRuleCatalog(catalog: TownRuleCatalog): TownRuleCatalog {
  return JSON.parse(JSON.stringify(catalog)) as TownRuleCatalog;
}

function resourceSnapshot(state?: TownRuleRuntimeState): Record<string, number> {
  if (!state) return {};
  return Object.fromEntries(state.institutions.map((institution) => [institution.id, institution.resources]));
}

function publicOpinionSnapshot(state?: TownRuleRuntimeState) {
  return {
    heat: state?.publicOpinion.heat || 0,
    mediaPressure: state?.publicOpinion.mediaPressure || 0,
    rumorVelocity: state?.publicOpinion.rumorVelocity || 0,
    witnessFear: state?.publicOpinion.witnessFear || 0,
    trustInPolice: state?.publicOpinion.trustInPolice || 0
  };
}

function lifecycle(runtime: PersistentTownRuntime): TownCaseLifecycleState {
  runtime.caseLifecycle ||= {
    activeCaseIds: [],
    solvedCaseIds: [],
    failedCaseIds: [],
    caseCooldownByNpcId: {},
    casePressureByInstitutionId: {},
    nextCaseWeights: {},
    caseAftermathLog: []
  };
  return runtime.caseLifecycle;
}

function prepareRun(config: LongRunValidationConfig): RunState {
  const seed = config.seed || DEFAULT_SEED;
  const npcCount = config.npcCount || 24;
  const timelineHours = config.timelineHours || 96;
  if (config.scenarioPack) {
    const mapPack = config.mapPack || createTownMapPackFromWorld(createInitialWorld(seed, { mode: "advanced", npcCount, timelineHours }));
    const ruleCatalog = config.ruleCatalog || createDefaultTownRuleCatalog(createInitialWorld(seed, { mode: "advanced", npcCount, timelineHours }));
    const scenarioPack = JSON.parse(JSON.stringify(config.scenarioPack)) as ScenarioPack;
    scenarioPack.world.seed = seed;
    scenarioPack.scenario.seed = seed;
    const created = createWorldFromScenarioPack(scenarioPack, mapPack, ruleCatalog, {
      runId: `long-run-${seed}`,
      sourceWorldId: `long-run-source-${seed}`
    });
    const daily = simulateDailyLife(created.world, Math.max(1, Math.ceil(timelineHours / 24)), []);
    const runtime = createPersistentTownRuntime(daily.world, daily.events, {
      maxTicks: Math.max(config.tickCount || DEFAULT_TICKS, DEFAULT_TICKS) + 20
    });
    runtime.currentScenarioPackId = created.runtime.currentScenarioPackId;
    runtime.currentMapPackId = created.runtime.currentMapPackId;
    runtime.currentRuleCatalogId = created.runtime.currentRuleCatalogId;
    runtime.currentExperiment = created.runtime.currentExperiment;
    runtime.ruleState = catalogToTownRuleRuntimeState(ruleCatalog, runtime.tick);
    const runtimeWorld: RuntimeWorldState = { ...daily.world, persistentRuntime: runtime };
    return { world: runtimeWorld, events: daily.events, runtime };
  }
  const world = createInitialWorld(seed, { mode: "advanced", npcCount, timelineHours });
  const daily = simulateDailyLife(world, Math.max(1, Math.ceil(timelineHours / 24)), []);
  const runtime = createPersistentTownRuntime(daily.world, daily.events, { maxTicks: Math.max(config.tickCount || DEFAULT_TICKS, DEFAULT_TICKS) + 20 });
  runtime.currentScenarioPackId = "long-run-validation";
  runtime.currentMapPackId = "fog-lamp-town";
  runtime.currentRuleCatalogId = "detective-default";
  runtime.currentExperiment = {
    scenarioPackId: "long-run-validation",
    mapPackId: "fog-lamp-town",
    ruleCatalogId: "detective-default",
    selectedAt: new Date(0).toISOString(),
    scenarioPackHash: deterministicHash(createScenarioPackFromWorld(daily.world, { seed })),
    mapPackHash: deterministicHash(createTownMapPackFromWorld(daily.world)),
    ruleCatalogHash: deterministicHash(createDefaultTownRuleCatalog(daily.world)),
    engineVersion: ENGINE_VERSION
  };
  const runtimeWorld: RuntimeWorldState = { ...daily.world, persistentRuntime: runtime };
  return { world: runtimeWorld, events: daily.events, runtime };
}

function installAblationCatalog(state: RunState, variant: RuleAblationVariant) {
  if (variant === "baseline") return;
  const baseCatalog = createDefaultTownRuleCatalog(state.world, state.runtime.tick);
  const catalog = cloneRuleCatalog(baseCatalog);
  if (variant === "no-media") {
    catalog.resources = catalog.resources.map((resource) => resource.kind === "media_attention" ? { ...resource, value: 0, pressure: 0 } : resource);
    catalog.institutions = catalog.institutions.map((institution) => institution.kind === "media" ? { ...institution, resources: 0, reputation: 50, pressure: 0, policyPressure: 0 } : institution);
    catalog.longActionDefinitions = catalog.longActionDefinitions.map((action) => action.kind === "publish-rumor" || action.kind === "suppress-story"
      ? { ...action, institutionDeltas: {}, publicOpinionDelta: {}, evidenceContaminationDelta: 0 }
      : action);
  }
  if (variant === "no-institution-pressure") {
    catalog.institutions = catalog.institutions.map((institution) => ({ ...institution, pressure: 0, policyPressure: 0 }));
    catalog.resources = catalog.resources.map((resource) => ({ ...resource, pressure: 0 }));
    catalog.longActionDefinitions = catalog.longActionDefinitions.map((action) => ({
      ...action,
      institutionDeltas: Object.fromEntries(Object.entries(action.institutionDeltas).map(([id, delta]) => [id, { ...delta, pressure: 0 }]))
    }));
  }
  if (variant === "no-contamination") {
    catalog.resources = catalog.resources.map((resource) => resource.kind === "evidence_integrity" ? { ...resource, value: 100, pressure: 0 } : resource);
    catalog.longActionDefinitions = catalog.longActionDefinitions.map((action) => ({ ...action, evidenceContaminationDelta: 0 }));
  }
  state.runtime.ruleState = catalogToTownRuleRuntimeState(catalog, state.runtime.tick);
  constrainAblationState(state.runtime, variant);
}

function constrainAblationState(runtime: PersistentTownRuntime, variant: RuleAblationVariant) {
  const state = runtime.ruleState;
  if (!state || variant === "baseline") return;
  const life = lifecycle(runtime);
  if (variant === "no-media") {
    state.institutions = state.institutions.map((institution) => institution.kind === "media" ? { ...institution, resources: 0, pressure: 0, policyPressure: 0 } : institution);
    state.publicOpinion = {
      ...state.publicOpinion,
      heat: clamp(Math.min(state.publicOpinion.heat, 8)),
      mediaPressure: 0,
      rumorVelocity: 0,
      witnessFear: clamp(Math.min(state.publicOpinion.witnessFear, 8))
    };
    state.longActions = state.longActions.filter((action) => action.kind !== "publish-rumor" && action.kind !== "suppress-story");
    life.nextCaseWeights.rumorAndFear = 1;
    life.casePressureByInstitutionId["inst-media"] = 0;
  }
  if (variant === "no-institution-pressure") {
    state.institutions = state.institutions.map((institution) => ({ ...institution, pressure: 0, policyPressure: 0 }));
    life.casePressureByInstitutionId = {};
    life.nextCaseWeights = {};
  }
  if (variant === "no-contamination") {
    state.evidenceContamination = {
      contamination: 0,
      pollutedEvidenceIds: [],
      sourceEventIds: [],
      riskByLocation: {},
      updatedAtTick: runtime.tick
    };
    life.nextCaseWeights.evidencePollution = 1;
  }
}

function caseKey(candidate: CaseCandidate) {
  return `${candidate.id}:${candidate.triggeredEventId || "forming"}:${candidate.culpritId}:${candidate.victimId}`;
}

function createCampaignCaseId(seed: string, tick: number, ordinal: number, candidate: CaseCandidate) {
  const identity = deterministicHash({
    seed,
    tick,
    ordinal,
    caseType: candidate.caseType || "murder",
    triggeredEventId: candidate.triggeredEventId,
    culpritId: candidate.culpritId,
    victimId: candidate.victimId
  }).replace("fnv1a-", "");
  return `case-${tick}-${String(ordinal).padStart(3, "0")}-${identity}`;
}

function pairKeyForCandidate(candidate: CaseCandidate) {
  return `${candidate.culpritId}->${candidate.victimId}:${candidate.caseType || "murder"}`;
}

function selectNextCase(
  candidates: CaseCandidate[],
  seen: Set<string>,
  selectedTypes: Map<string, number> = new Map(),
  selectedPairs: Set<string> = new Set(),
  requireCompleteEvidence = false,
  requireNewPair = false
) {
  const eligible = candidates
    .filter((candidate) =>
      candidate.validation.valid &&
      candidate.triggeredEventId &&
      !seen.has(caseKey(candidate)) &&
      (!requireCompleteEvidence || (candidate.validation.evidenceChain?.relatedEvidenceIds.length || 0) >= 3)
    );
  const nonRepeatedPairCandidates = eligible.filter((candidate) => !selectedPairs.has(pairKeyForCandidate(candidate)));
  if (requireNewPair && selectedPairs.size > 0 && nonRepeatedPairCandidates.length === 0) return null;
  return (nonRepeatedPairCandidates.length ? nonRepeatedPairCandidates : eligible)
    .sort((left, right) => {
      const score = (candidate: CaseCandidate) => {
        const typePenalty = (selectedTypes.get(candidate.caseType || "murder") || 0) * 12;
        const pairPenalty = selectedPairs.has(pairKeyForCandidate(candidate)) ? 120 : 0;
        const completeness = Object.values(candidate.validation.chainCompleteness || candidate.chainCompleteness || {}).filter(Boolean).length;
        const evidenceCount = candidate.validation.evidenceChain?.relatedEvidenceIds.length || 0;
        const evidenceWarningPenalty = (candidate.validation.evidenceChain?.warningReasons.length || 0) * 3;
        const evidenceBonus = Math.min(24, evidenceCount * 4) +
          (candidate.validation.evidenceChain?.minimumEvidenceCountMet ? 12 : 0) +
          (candidate.validation.evidenceChain?.strongProvenanceIds.length ? 8 : 0) -
          evidenceWarningPenalty;
        const routeBonus =
          (candidate.triggeredEventId ? 14 : 0) +
          (candidate.validation.memoryScopedTestimony ? 10 : 0) +
          (candidate.validation.nonCulpritExcluded ? 10 : 0) +
          completeness * 6;
        const influenceBonus = (candidate.influenceTrace?.aftermathIds.length || 0) * 3 +
          (candidate.influenceTrace?.institutionDecisionIds.length || 0) +
          (candidate.influenceTrace?.evidenceChainItemIds.length || 0);
        return (candidate.maturityScore || 0) + candidate.pressureScore + routeBonus + evidenceBonus + influenceBonus - typePenalty - pairPenalty;
      };
      return score(right) - score(left);
    })[0] || null;
}

function collectRecentCandidateReasons(candidates: CaseCandidate[]) {
  return candidates
    .slice(0, 5)
    .flatMap((candidate) => (candidate.validation.failureReasons || candidate.validation.errors || []).map((reason) => `${candidate.id}: ${reason}`))
    .slice(0, 12);
}

function collectCandidateRejectionReasonCounts(
  candidates: CaseCandidate[],
  counts: Record<string, number>
) {
  for (const candidate of candidates) {
    if (candidate.validation.valid) continue;
    for (const reason of candidate.validation.failureReasons || candidate.validation.errors || []) {
      counts[reason] = (counts[reason] || 0) + 1;
    }
  }
}

function countTriggerReadyChains(
  world: WorldState,
  runtime: PersistentTownRuntime
) {
  const lifecycle = runtime.caseLifecycle;
  const maturityThreshold = (runtime.campaignCaseTarget || 3) > 3 ? 82 : 90;
  return (runtime.longChainLedger || []).filter((entry) => {
    const victimAlive = world.npcs.some((npc) => npc.id === entry.victimId && npc.alive);
    const culpritCooldown = lifecycle?.caseCooldownByNpcId?.[entry.culpritId] || 0;
    const victimCooldown = lifecycle?.caseCooldownByNpcId?.[entry.victimId] || 0;
    const pairCooldown = lifecycle?.casePairCooldown?.[`${entry.culpritId}->${entry.victimId}`] || 0;
    const alreadyTriggered = (runtime.triggeredCases || []).some((trigger) =>
      trigger.culpritId === entry.culpritId && trigger.victimId === entry.victimId
    );
    return entry.complete &&
      entry.maturityScore >= maturityThreshold &&
      victimAlive &&
      culpritCooldown <= runtime.tick &&
      victimCooldown <= runtime.tick &&
      pairCooldown <= runtime.tick &&
      !alreadyTriggered;
  }).length;
}

function percentShare(part: number, total: number) {
  return total <= 0 ? 0 : Math.round((part / total) * 100);
}

function incrementDistribution<T extends string>(distribution: Partial<Record<T, number>>, key: T) {
  distribution[key] = (distribution[key] || 0) + 1;
}

function buildWorldStabilityMetrics(input: {
  runtime: PersistentTownRuntime;
  evidenceGraph: EvidenceGraph;
  candidateRepeatRate: number;
  deterministicRunHash: string;
  validCandidateCountTrend: WorldStabilityTrendPoint[];
}): WorldStabilityMetrics {
  const selectedActionKindDistribution: Partial<Record<string, number>> = {};
  const actorDecisionDistribution: Partial<Record<string, number>> = {};
  for (const trace of input.runtime.decisionTraces || []) {
    incrementDistribution(actorDecisionDistribution, trace.npcId);
    const selected = trace.candidates.find((candidate) => candidate.id === trace.selectedCandidateId);
    if (selected?.kind) incrementDistribution(selectedActionKindDistribution, selected.kind);
  }
  const actionCounts = Object.values(selectedActionKindDistribution).filter((count): count is number => typeof count === "number");
  const actorCounts = Object.values(actorDecisionDistribution).filter((count): count is number => typeof count === "number");
  const actionTotal = actionCounts.reduce((sum, count) => sum + count, 0);
  const actorTotal = actorCounts.reduce((sum, count) => sum + count, 0);
  return {
    selectedActionKindCount: Object.keys(selectedActionKindDistribution).length,
    selectedActionKindDistribution,
    largestSelectedActionShare: percentShare(Math.max(0, ...actionCounts), actionTotal),
    activeActorCount: Object.keys(actorDecisionDistribution).length,
    actorDecisionDistribution,
    largestActorShare: percentShare(Math.max(0, ...actorCounts), actorTotal),
    validCandidateCountTrend: input.validCandidateCountTrend.slice(-12),
    institutionDecisionCount: input.runtime.ruleState?.institutionDecisions?.length || 0,
    evidenceCompleteCaseCount: input.evidenceGraph.caseUses.filter((item) => item.complete).length,
    candidateRepeatRate: input.candidateRepeatRate,
    deterministicRunHash: input.deterministicRunHash
  };
}

export function computeCausalMetrics(input: {
  runtime: PersistentTownRuntime;
  cases: ExtractedCase[];
  tickCount: number;
  initialResources: Record<string, number>;
  finalCandidates: CaseCandidate[];
  validCandidateCountTrend?: WorldStabilityTrendPoint[];
}): CausalMetricSummary {
  const state = input.runtime.ruleState;
  const finalResources = resourceSnapshot(state);
  const resourceDeltaByKind = Object.fromEntries(
    Array.from(new Set([...Object.keys(input.initialResources), ...Object.keys(finalResources)]))
      .map((key) => [key, (finalResources[key] || 0) - (input.initialResources[key] || 0)])
  );
  const seenNpcIds = new Set<string>();
  const seenPairKeys = new Set<string>();
  const repeatedPairs = new Set<string>();
  const caseTypeDistribution: Partial<Record<TownCaseType, number>> = {};
  const continuity = input.cases.map((item) => {
    const repeatedNpcIds = [item.candidate.culpritId, item.candidate.victimId].filter((id) => seenNpcIds.has(id));
    seenNpcIds.add(item.candidate.culpritId);
    seenNpcIds.add(item.candidate.victimId);
    const campaignWindow = Math.floor(item.tick / 240);
    const pairKey = `${campaignWindow}:${item.candidate.culpritId}->${item.candidate.victimId}:${item.locationId || "unknown"}:${item.candidate.caseType || "murder"}`;
    if (seenPairKeys.has(pairKey)) repeatedPairs.add(pairKey);
    seenPairKeys.add(pairKey);
    const caseType = item.candidate.caseType || "murder";
    caseTypeDistribution[caseType] = (caseTypeDistribution[caseType] || 0) + 1;
    return {
      caseId: item.caseId,
      triggeredEventId: item.candidate.triggeredEventId,
      tick: item.tick,
      culpritId: item.candidate.culpritId,
      victimId: item.candidate.victimId,
      locationId: item.locationId,
      outcome: item.candidate.validation.valid ? "extracted" as const : "failed" as const,
      caseType,
      repeatedNpcIds,
      institutionIds: item.candidate.influenceTrace?.institutionIds || [],
      longActionIds: item.candidate.influenceTrace?.longActionIds || [],
      institutionDecisionIds: item.candidate.influenceTrace?.institutionDecisionIds || [],
      evidenceChainItemIds: item.candidate.influenceTrace?.evidenceChainItemIds || [],
      contaminatedEvidenceIds: item.candidate.influenceTrace?.contaminatedEvidenceIds || [],
      aftermathIds: item.candidate.influenceTrace?.aftermathIds || [],
      resourceDeltas: item.candidate.influenceTrace?.resourceDeltas || {},
      publicOpinionDelta: item.candidate.influenceTrace?.publicOpinionDelta || {},
      evidenceContaminationDelta: item.candidate.influenceTrace?.evidenceContaminationDelta || 0
    };
  });
  const caseGraph = buildCampaignTimelineGraph(continuity.map((item) => ({
    caseId: item.caseId,
    tick: item.tick,
    caseType: item.caseType,
    outcome: item.outcome,
    culpritId: item.culpritId,
    victimId: item.victimId,
    locationId: item.locationId,
    institutionIds: item.institutionIds,
    evidenceIds: item.evidenceChainItemIds,
    contaminatedEvidenceIds: item.contaminatedEvidenceIds,
    aftermathIds: item.aftermathIds,
    resourceDeltas: item.resourceDeltas,
    publicOpinionDelta: item.publicOpinionDelta
  })));
  const evidenceGraph = buildEvidenceGraph({
    evidenceItems: state?.evidenceChain.items || [],
    resolvedCaseIds: continuity.map((item) => item.caseId),
    longActions: state?.longActions || []
  });
  const uniquePairs = seenPairKeys.size || 1;
  const totalPairs = Math.max(input.cases.length, 1);
  const publicOpinion = publicOpinionSnapshot(state);
  const institutionAftermathPropagationCount = continuity.filter((item) =>
    item.institutionIds.length ||
    item.institutionDecisionIds.length ||
    item.aftermathIds.length
  ).length;
  const institutionPressureMagnitude = (state?.institutions || []).reduce((sum, institution) => sum + Math.abs(institution.pressure) + Math.abs(institution.policyPressure), 0)
    + Object.values(input.runtime.caseLifecycle?.casePressureByInstitutionId || {}).reduce((sum, pressure) => sum + Math.abs(pressure), 0);
  const solvedCaseCount = input.cases.filter((item) => item.candidate.validation.valid).length;
  const failedCaseCount = input.cases.length - solvedCaseCount;
  const crossCaseInfluenceCount = caseGraph.edges.length;
  const strongestCausalChains = continuity
    .filter((item) => item.aftermathIds.length || item.institutionDecisionIds.length || item.evidenceChainItemIds.length || item.repeatedNpcIds.length)
    .slice(0, 8)
    .map((item) => `${item.caseId}:${item.caseType}:${[
      item.aftermathIds.length ? "aftermath" : "",
      item.institutionDecisionIds.length ? "institution" : "",
      item.evidenceChainItemIds.length ? "evidence" : "",
      item.repeatedNpcIds.length ? "npc-reuse" : ""
    ].filter(Boolean).join("+")}`);
  const causalClaims = [
    publicOpinion.mediaPressure > 0 ? `Media pressure reached ${publicOpinion.mediaPressure} and witness fear reached ${publicOpinion.witnessFear}.` : "",
    institutionAftermathPropagationCount ? `${institutionAftermathPropagationCount} cases carried institution strategy or aftermath influence into later candidate traces.` : "",
    continuity.some((item) => item.evidenceChainItemIds.length) ? "Evidence-chain items were attached to case influence traces." : "",
    Object.values(resourceDeltaByKind).some((delta) => delta !== 0) ? `Institution resources shifted by ${stableStringify(resourceDeltaByKind)}.` : "",
    continuity.some((item) => item.repeatedNpcIds.length) ? "At least one later case reused an NPC from an earlier case." : ""
  ].filter(Boolean);
  const hashInput = {
    tickCount: input.tickCount,
    cases: continuity.map((item, index) => [index, item.tick, item.culpritId, item.victimId, item.outcome]),
    resources: resourceDeltaByKind,
    opinion: publicOpinion,
    lifecycle: {
      solvedCount: input.runtime.caseLifecycle?.solvedCaseIds.length || 0,
      failedCount: input.runtime.caseLifecycle?.failedCaseIds.length || 0,
      caseTypes: continuity.map((item) => item.caseType),
      aftermath: input.runtime.caseLifecycle?.caseAftermathLog?.map((item) => [item.outcome, item.tick]) || []
    }
  };
  const deterministicRunHash = deterministicHash(hashInput);
  const candidateRepeatRate = Math.round(((totalPairs - uniquePairs) / totalPairs) * 100);
  const worldStability = buildWorldStabilityMetrics({
    runtime: input.runtime,
    evidenceGraph,
    candidateRepeatRate,
    deterministicRunHash,
    validCandidateCountTrend: input.validCandidateCountTrend || []
  });
  return {
    tickCount: input.tickCount,
    caseCount: input.cases.length,
    solvedCaseCount,
    failedCaseCount,
    crossCaseNpcReuseRate: input.cases.length <= 1 ? 0 : Math.round((continuity.filter((item) => item.repeatedNpcIds.length).length / (input.cases.length - 1)) * 100),
    institutionAftermathPropagationCount,
    institutionPressureMagnitude,
    resourceDeltaByKind,
    candidateDiversityScore: Math.round((uniquePairs / totalPairs) * 100),
    candidateRepeatRate,
    causalLinkCount: continuity.reduce((sum, item) =>
      sum +
      item.institutionIds.length +
      item.longActionIds.length +
      item.institutionDecisionIds.length +
      item.evidenceChainItemIds.length +
      item.contaminatedEvidenceIds.length +
      item.aftermathIds.length +
      item.repeatedNpcIds.length,
      0
    ),
    diversity: {
      caseTypeDistribution,
      distinctCaseTypeCount: Object.keys(caseTypeDistribution).length,
      repeatedNpcPairCount: repeatedPairs.size,
      repeatedLocationCount: 0,
      crossCaseInfluenceCount,
      laterCaseInfluenceRate: caseGraph.laterCaseInfluenceRate,
      strongestCausalChains
    },
    uniqueCaseCount: caseGraph.uniqueCaseCount,
    caseGraph,
    evidenceGraph,
    worldStability,
    deterministicRunHash,
    continuity,
    causalClaims
  };
}

export function runMultiCaseSimulation(config: LongRunValidationConfig = {}): LongRunValidationReport {
  const runStartedAt = performance.now();
  const seed = config.seed || DEFAULT_SEED;
  const tickCount = Math.max(1, config.tickCount || DEFAULT_TICKS);
  const minimumCaseCount = Math.max(1, config.minimumCaseCount || DEFAULT_MIN_CASES);
  const npcCount = config.npcCount || 24;
  const timelineHours = config.timelineHours || 96;
  const variant = config.variant || "baseline";
  const chunkSize = Math.max(1, Math.min(20, config.chunkSize || 20));
  const state = prepareRun({ ...config, seed, tickCount, npcCount, timelineHours, variant });
  installAblationCatalog(state, variant);
  const initialResources = resourceSnapshot(ensureTownRuleRuntimeState(state.world, state.runtime));
  state.runtime.campaignCaseTarget = minimumCaseCount;
  const extractedCases: ExtractedCase[] = [];
  const seenCases = new Set<string>();
  const selectedTypes = new Map<string, number>();
  const selectedPairs = new Set<string>();
  const maxExtractionsPerChunk = Math.max(1, config.maxExtractionsPerChunk || minimumCaseCount);
  const warnings: string[] = [];
  const performanceSummary = emptyPerformanceSummary();
  let recentCandidateReasons: string[] = [];
  const candidateRejectionReasonCounts: Record<string, number> = {};
  const candidateLifecycleDiagnostics: CandidateLifecycleDiagnostic[] = [];
  const validCandidateCountTrend: WorldStabilityTrendPoint[] = [];

  for (let advanced = 0; advanced < tickCount; advanced += chunkSize) {
    const steps = Math.min(chunkSize, tickCount - advanced);
    const result = advancePersistentTownTick(state.world, state.events, {
      steps,
      status: "running",
      profile: true,
      snapshotEveryTicks: Math.max(1, config.snapshotEveryTicks || 1),
      checkpointEveryTicks: Math.max(1, config.checkpointEveryTicks || 5),
      candidateEveryTicks: Math.max(1, config.candidateEveryTicks || 1),
      actionEveryTicks: Math.max(1, config.actionEveryTicks || 1),
      indexEventLimit: config.indexEventLimit,
      cloneInput: config.cloneInput === false ? false : undefined
    });
    state.world = result.world;
    state.runtime = result.runtime;
    state.events = [...state.events, ...result.events];
    constrainAblationState(state.runtime, variant);
    (state.world as RuntimeWorldState).persistentRuntime = state.runtime;
    const queue = buildTownEmergenceQueue(state.world, state.events, state.runtime);
    recentCandidateReasons = collectRecentCandidateReasons(queue.candidates);
    collectCandidateRejectionReasonCounts(queue.candidates, candidateRejectionReasonCounts);
    candidateLifecycleDiagnostics.push({
      tick: state.runtime.tick,
      aliveNpcCount: state.world.npcs.filter((npc) => npc.alive).length,
      pressureCount: state.runtime.longChainLedger?.length || 0,
      ledgerCount: state.runtime.longChainLedger?.length || 0,
      completeChainCount: (state.runtime.longChainLedger || []).filter((entry) => entry.complete).length,
      triggerReadyChainCount: countTriggerReadyChains(state.world, state.runtime),
      candidateCount: queue.candidates.length,
      validCandidateCount: queue.validCount,
      triggerBackedCandidateCount: queue.candidates.filter((candidate) => Boolean(candidate.triggeredEventId)).length
    });
    validCandidateCountTrend.push({
      tick: state.runtime.tick,
      candidateCount: queue.candidates.length,
      validCandidateCount: queue.validCount
    });
    let candidate = selectNextCase(
      queue.candidates,
      seenCases,
      selectedTypes,
      selectedPairs,
      Boolean(config.requireCompleteEvidenceCandidates),
      Boolean(config.requireNewCandidatePair)
    );
    let extractedThisChunk = 0;
    while (candidate && extractedCases.length < minimumCaseCount && extractedThisChunk < maxExtractionsPerChunk) {
      const extracted = extractPlayableCaseFromCandidate(state.world, state.events, candidate);
      state.world = { ...extracted.world, persistentRuntime: state.runtime } as RuntimeWorldState;
      state.runtime = (state.world as RuntimeWorldState).persistentRuntime || state.runtime;
      const locationId = state.events.find((event) => event.id === extracted.candidate.triggeredEventId)?.locationId;
      const caseId = createCampaignCaseId(seed, state.runtime.tick, extractedCases.length + 1, extracted.candidate);
      const resolution = resolveCaseInWorld(state.world, state.runtime, {
        caseId,
        outcome: extracted.candidate.validation.valid ? "extracted" : "failed",
        culpritId: extracted.candidate.culpritId,
        victimId: extracted.candidate.victimId,
        caseType: extracted.candidate.caseType,
        locationId,
        evidenceItemIds: extracted.candidate.validation.evidenceChain?.relatedEvidenceIds,
        valid: extracted.candidate.validation.valid
      });
      constrainAblationState(state.runtime, variant);
      const extractedCandidate = { ...extracted.candidate, influenceTrace: resolution.influenceTrace };
      extractedCases.push({ caseId, tick: state.runtime.tick, locationId, candidate: extractedCandidate, activeCase: extracted.activeCase });
      seenCases.add(caseKey(extractedCandidate));
      selectedPairs.add(pairKeyForCandidate(extractedCandidate));
      selectedTypes.set(extractedCandidate.caseType || "murder", (selectedTypes.get(extractedCandidate.caseType || "murder") || 0) + 1);
      extractedThisChunk += 1;
      candidate = selectNextCase(
        buildTownEmergenceQueue(state.world, state.events, state.runtime).candidates,
        seenCases,
        selectedTypes,
        selectedPairs,
        Boolean(config.requireCompleteEvidenceCandidates),
        Boolean(config.requireNewCandidatePair)
      );
    }
    mergePerformanceSummary(performanceSummary, state.runtime.performance);
  }

  const finalQueue = buildTownEmergenceQueue(state.world, state.events, state.runtime);
  const metrics = computeCausalMetrics({
    runtime: state.runtime,
    cases: extractedCases,
    tickCount,
    initialResources,
    finalCandidates: finalQueue.candidates,
    validCandidateCountTrend
  });
  if (metrics.candidateDiversityScore < 35) warnings.push(`Candidate diversity is low: ${metrics.candidateDiversityScore}.`);
  if (metrics.candidateRepeatRate > 70) warnings.push(`Candidate repeat rate is high: ${metrics.candidateRepeatRate}.`);
  const errors = [
    extractedCases.length < minimumCaseCount ? `Only ${extractedCases.length}/${minimumCaseCount} cases were extracted by tick ${tickCount}.` : "",
    metrics.causalClaims.length < 3 ? `Only ${metrics.causalClaims.length}/3 causal claims were produced.` : "",
    metrics.candidateDiversityScore < 25 ? `Candidate diversity below minimum: ${metrics.candidateDiversityScore}.` : ""
    ,
    metrics.uniqueCaseCount !== metrics.caseCount ? `Only ${metrics.uniqueCaseCount}/${metrics.caseCount} case ids are unique.` : "",
    metrics.evidenceGraph.caseUses.some((item) => !item.complete) ? `Evidence graph has incomplete resolved cases: ${metrics.evidenceGraph.warnings.join("; ")}` : ""
  ].filter(Boolean);
  performanceSummary.totalMs = performance.now() - runStartedAt;
  performanceSummary.averageTickMs = performanceSummary.tickCount ? performanceSummary.totalMs / performanceSummary.tickCount : 0;
  return {
    generatedAt: new Date().toISOString(),
    ok: errors.length === 0,
    config: { seed, tickCount, minimumCaseCount, npcCount, timelineHours, variant },
    summary: {
      runId: `long-run-${variant}-${seed}-${tickCount}`,
      variant,
      seed,
      worldId: state.world.id,
      tickCount,
      caseCount: metrics.caseCount,
      solvedCaseCount: metrics.solvedCaseCount,
      failedCaseCount: metrics.failedCaseCount,
      finalCandidateCount: finalQueue.candidates.length,
      validCandidateCount: finalQueue.validCount,
      finalStatus: state.runtime.status
    },
    metrics,
    cases: metrics.continuity,
    performance: performanceSummary,
    recentCandidateReasons,
    candidateRejectionReasonCounts,
    candidateLifecycleDiagnostics,
    errors,
    warnings
  };
}

function relativeChange(baseline: number, variant: number) {
  const denominator = Math.max(Math.abs(baseline), 1);
  return Math.round((Math.abs(variant - baseline) / denominator) * 100);
}

function metricVector(report: LongRunValidationReport) {
  const metrics = report.metrics;
  return {
    caseCount: metrics.caseCount,
    crossCaseNpcReuseRate: metrics.crossCaseNpcReuseRate,
    institutionAftermathPropagationCount: metrics.institutionAftermathPropagationCount,
    institutionPressureMagnitude: metrics.institutionPressureMagnitude,
    candidateDiversityScore: metrics.candidateDiversityScore,
    candidateRepeatRate: metrics.candidateRepeatRate,
    causalLinkCount: metrics.causalLinkCount,
    mediaHeat: Number(report.metrics.causalClaims.some((claim) => claim.includes("Media pressure"))),
    evidenceDelta: Math.abs(report.cases.reduce((sum, item) => sum + item.evidenceContaminationDelta, 0)),
    resourceDeltaMagnitude: Object.values(metrics.resourceDeltaByKind).reduce((sum, value) => sum + Math.abs(value), 0)
  };
}

export function runRuleAblationSuite(config: Omit<LongRunValidationConfig, "variant"> & { threshold?: number } = {}): RuleAblationReport {
  const threshold = config.threshold ?? 20;
  const baseline = runMultiCaseSimulation({ ...config, variant: "baseline" });
  const variants = {
    "no-media": runMultiCaseSimulation({ ...config, variant: "no-media" }),
    "no-institution-pressure": runMultiCaseSimulation({ ...config, variant: "no-institution-pressure" }),
    "no-contamination": runMultiCaseSimulation({ ...config, variant: "no-contamination" })
  };
  const baselineVector = metricVector(baseline);
  const ablationDeltas = (Object.entries(variants) as Array<[Exclude<RuleAblationVariant, "baseline">, LongRunValidationReport]>).map(([variant, report]) => {
    const vector = metricVector(report);
    const metricDeltas = Object.fromEntries(
      Object.entries(vector).map(([key, value]) => [key, relativeChange(baselineVector[key as keyof typeof baselineVector], value)])
    );
    const strongest = Object.entries(metricDeltas).sort(([, left], [, right]) => right - left)[0] || ["none", 0];
    return {
      variant,
      changed: strongest[1] >= threshold,
      strongestMetric: strongest[0],
      relativeChange: strongest[1],
      metricDeltas
    };
  });
  const errors = [
    !baseline.ok ? `baseline failed: ${baseline.errors.join("; ")}` : "",
    ...ablationDeltas.filter((delta) => !delta.changed).map((delta) => `${delta.variant} did not reach ${threshold}% metric change; strongest ${delta.strongestMetric}=${delta.relativeChange}%`)
  ].filter(Boolean);
  return {
    generatedAt: new Date().toISOString(),
    ok: errors.length === 0,
    threshold,
    baseline,
    variants,
    ablationDeltas,
    errors
  };
}

function crossCaseInfluenceCount(report: LongRunValidationReport) {
  return report.metrics.caseGraph.edges.length;
}

function buildStableWorldSeedGateSummary(report: LongRunValidationReport, gate: SimulationQualityGate): StableWorldSeedGateSummary {
  const stability = report.metrics.worldStability;
  const errors = [
    !report.ok ? report.errors.join("; ") || "long-run report failed" : "",
    report.summary.caseCount < gate.minimumCaseCount ? `only ${report.summary.caseCount}/${gate.minimumCaseCount} cases` : "",
    report.metrics.candidateDiversityScore < gate.minCandidateDiversityScore ? `diversity ${report.metrics.candidateDiversityScore} < ${gate.minCandidateDiversityScore}` : "",
    report.metrics.candidateRepeatRate > gate.maxCandidateRepeatRate ? `repeat ${report.metrics.candidateRepeatRate} > ${gate.maxCandidateRepeatRate}` : "",
    report.metrics.causalLinkCount < gate.minCausalLinkCount ? `causal links ${report.metrics.causalLinkCount} < ${gate.minCausalLinkCount}` : "",
    crossCaseInfluenceCount(report) < gate.minCrossCaseInfluenceCount ? `cross-case influence ${crossCaseInfluenceCount(report)} < ${gate.minCrossCaseInfluenceCount}` : "",
    gate.maxRuntimeMs && report.performance.totalMs > gate.maxRuntimeMs ? `runtime ${Math.round(report.performance.totalMs)}ms > ${gate.maxRuntimeMs}ms` : "",
    gate.minDistinctCaseTypeCount && report.metrics.diversity.distinctCaseTypeCount < gate.minDistinctCaseTypeCount ? `case types ${report.metrics.diversity.distinctCaseTypeCount} < ${gate.minDistinctCaseTypeCount}` : "",
    gate.minLaterCaseInfluenceRate && report.metrics.diversity.laterCaseInfluenceRate < gate.minLaterCaseInfluenceRate ? `later influence ${report.metrics.diversity.laterCaseInfluenceRate}% < ${gate.minLaterCaseInfluenceRate}%` : "",
    gate.maxEvidenceGraphWarnings !== undefined && report.metrics.evidenceGraph.warnings.length > gate.maxEvidenceGraphWarnings ? `evidence warnings ${report.metrics.evidenceGraph.warnings.length} > ${gate.maxEvidenceGraphWarnings}` : "",
    gate.minSelectedActionKindCount && stability.selectedActionKindCount < gate.minSelectedActionKindCount ? `selected action kinds ${stability.selectedActionKindCount} < ${gate.minSelectedActionKindCount}` : "",
    gate.maxLargestSelectedActionShare && stability.largestSelectedActionShare > gate.maxLargestSelectedActionShare ? `largest action share ${stability.largestSelectedActionShare}% > ${gate.maxLargestSelectedActionShare}%` : "",
    gate.minInstitutionDecisionCount && stability.institutionDecisionCount < gate.minInstitutionDecisionCount ? `institution decisions ${stability.institutionDecisionCount} < ${gate.minInstitutionDecisionCount}` : "",
    gate.minEvidenceCompleteCaseCount && stability.evidenceCompleteCaseCount < gate.minEvidenceCompleteCaseCount ? `evidence complete cases ${stability.evidenceCompleteCaseCount} < ${gate.minEvidenceCompleteCaseCount}` : ""
  ].filter(Boolean);
  return {
    seed: report.summary.seed,
    ok: errors.length === 0,
    caseCount: report.summary.caseCount,
    uniqueCaseCount: report.metrics.uniqueCaseCount,
    distinctCaseTypeCount: report.metrics.diversity.distinctCaseTypeCount,
    candidateRepeatRate: report.metrics.candidateRepeatRate,
    laterCaseInfluenceRate: report.metrics.diversity.laterCaseInfluenceRate,
    evidenceGraphWarnings: report.metrics.evidenceGraph.warnings.length,
    selectedActionKindCount: stability.selectedActionKindCount,
    largestSelectedActionShare: stability.largestSelectedActionShare,
    activeActorCount: stability.activeActorCount,
    largestActorShare: stability.largestActorShare,
    institutionDecisionCount: stability.institutionDecisionCount,
    evidenceCompleteCaseCount: stability.evidenceCompleteCaseCount,
    runtimeMs: Math.round(report.performance.totalMs),
    deterministicRunHash: report.metrics.deterministicRunHash,
    errors
  };
}

function buildMultiSeedWorldStabilitySummary(perSeed: StableWorldSeedGateSummary[]): MultiSeedWorldStabilitySummary {
  const min = (values: number[]) => values.length ? Math.min(...values) : 0;
  const max = (values: number[]) => values.length ? Math.max(...values) : 0;
  return {
    passedSeedCount: perSeed.filter((seed) => seed.ok).length,
    failedSeedCount: perSeed.filter((seed) => !seed.ok).length,
    worstCandidateRepeatRate: max(perSeed.map((seed) => seed.candidateRepeatRate)),
    lowestDistinctCaseTypeCount: min(perSeed.map((seed) => seed.distinctCaseTypeCount)),
    lowestSelectedActionKindCount: min(perSeed.map((seed) => seed.selectedActionKindCount)),
    highestLargestSelectedActionShare: max(perSeed.map((seed) => seed.largestSelectedActionShare)),
    lowestInstitutionDecisionCount: min(perSeed.map((seed) => seed.institutionDecisionCount)),
    deterministicRunHashes: Object.fromEntries(perSeed.map((seed) => [seed.seed, seed.deterministicRunHash])),
    perSeed
  };
}

const DIAGNOSTIC_SEVERITY_RANK: Record<StableWorldDiagnosticSeverity, number> = {
  ok: 0,
  watch: 1,
  risk: 2,
  blocker: 3
};

function emptyDiagnosticCounts(): Record<StableWorldDiagnosticSeverity, number> {
  return { ok: 0, watch: 0, risk: 0, blocker: 0 };
}

function diagnosticStatus(findings: StableWorldDiagnosticFinding[]): StableWorldDiagnosticSeverity {
  return findings.reduce<StableWorldDiagnosticSeverity>(
    (status, finding) => DIAGNOSTIC_SEVERITY_RANK[finding.severity] > DIAGNOSTIC_SEVERITY_RANK[status] ? finding.severity : status,
    "ok"
  );
}

function countDiagnosticFindings(findings: StableWorldDiagnosticFinding[]) {
  const counts = emptyDiagnosticCounts();
  for (const finding of findings) counts[finding.severity] += 1;
  return counts;
}

function formatThreshold(value: number | undefined, fallback = "not configured") {
  return typeof value === "number" ? value : fallback;
}

function topDistributionEntry(distribution: Partial<Record<string, number>>) {
  const entries = Object.entries(distribution)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const [kind, count] = entries[0] ?? ["none", 0];
  return {
    kind,
    count,
    share: total ? Math.round((count / total) * 100) : 0
  };
}

function topShares(distribution: Partial<Record<string, number>>, count = 3) {
  const values = Object.values(distribution).filter((value): value is number => typeof value === "number");
  const total = values.reduce((sum, value) => sum + value, 0);
  return values
    .sort((left, right) => right - left)
    .slice(0, count)
    .map((value) => total ? Math.round((value / total) * 100) : 0);
}

function topPerformancePhases(report: LongRunValidationReport) {
  const totalMs = Math.max(report.performance.totalMs, 1);
  return report.performance.phases
    .map((phase) => ({
      phase: phase.phase,
      share: Math.round((phase.totalMs / totalMs) * 100),
      totalMs: Math.round(phase.totalMs)
    }))
    .sort((left, right) => right.share - left.share || left.phase.localeCompare(right.phase))
    .slice(0, 3);
}

function candidateTrendSummary(trend: WorldStabilityTrendPoint[]) {
  const first = trend[0];
  const last = trend[trend.length - 1];
  const tail = trend.slice(-6);
  return {
    firstValidCandidateCount: first?.validCandidateCount ?? 0,
    lastValidCandidateCount: last?.validCandidateCount ?? 0,
    lowestValidCandidateCount: trend.length ? Math.min(...trend.map((point) => point.validCandidateCount)) : 0,
    highestValidCandidateCount: trend.length ? Math.max(...trend.map((point) => point.validCandidateCount)) : 0,
    trendDeclined: Boolean(first && last && last.validCandidateCount < first.validCandidateCount),
    trendFlat: tail.length >= 6 && tail.every((point) =>
      point.candidateCount === tail[0].candidateCount &&
      point.validCandidateCount === tail[0].validCandidateCount
    )
  };
}

function buildStableWorldSeedDiagnostics(
  report: LongRunValidationReport,
  gate: SimulationQualityGate,
  gateSummary: StableWorldSeedGateSummary
): StableWorldSeedDiagnostics {
  const seed = report.summary.seed;
  const stability = report.metrics.worldStability;
  const topAction = topDistributionEntry(stability.selectedActionKindDistribution);
  const candidateTrend = candidateTrendSummary(stability.validCandidateCountTrend);
  const performancePhases = topPerformancePhases(report);
  const findings: StableWorldDiagnosticFinding[] = [];
  const minSelectedActionKindCount = gate.minSelectedActionKindCount ?? 0;
  const add = (
    severity: StableWorldDiagnosticSeverity,
    dimension: StableWorldDiagnosticDimension,
    metric: string,
    actual: string | number,
    target: string | number,
    message: string,
    recommendedNextInspection: string
  ) => findings.push({ seed, severity, dimension, metric, actual, target, message, recommendedNextInspection });

  if (stability.selectedActionKindCount < minSelectedActionKindCount) {
    add("blocker", "action-mix", "selectedActionKindCount", stability.selectedActionKindCount, formatThreshold(gate.minSelectedActionKindCount), "Selected action coverage is below the stable-world gate.", "Inspect action scoring pressure and legal action availability.");
  } else if (gate.maxLargestSelectedActionShare !== undefined && stability.largestSelectedActionShare > gate.maxLargestSelectedActionShare) {
    add("blocker", "action-mix", "largestSelectedActionShare", `${stability.largestSelectedActionShare}%`, `<= ${gate.maxLargestSelectedActionShare}%`, "One action kind dominates the run beyond the gate.", "Inspect action-mix tie-breaks and lifecycle pressure.");
  } else if (gate.maxLargestSelectedActionShare !== undefined && gate.maxLargestSelectedActionShare - stability.largestSelectedActionShare <= 5) {
    add("risk", "action-mix", "largestSelectedActionShare", `${stability.largestSelectedActionShare}%`, `<= ${gate.maxLargestSelectedActionShare}%`, "Action mix passes but is close to the concentration limit.", "Inspect top action kind share before changing rule weights.");
  } else {
    add("ok", "action-mix", "selectedActionKindCount", stability.selectedActionKindCount, formatThreshold(gate.minSelectedActionKindCount), "Action coverage has healthy margin.", "No action-mix follow-up required.");
  }

  if (stability.largestActorShare >= 35) {
    add("watch", "actor-spread", "largestActorShare", `${stability.largestActorShare}%`, "< 35%", "One actor rank is taking a large share of selected actions.", "Inspect actor selection pressure by rank; do not expose NPC ids in reports.");
  } else {
    add("ok", "actor-spread", "largestActorShare", `${stability.largestActorShare}%`, "< 35%", "Actor spread is balanced enough for the stable-world gate.", "No actor-spread follow-up required.");
  }

  if (candidateTrend.trendDeclined) {
    add("watch", "candidate-maturity", "validCandidateCountTrend", `${candidateTrend.firstValidCandidateCount}->${candidateTrend.lastValidCandidateCount}`, "non-declining", "Valid candidate count declined in the sampled trend.", "Inspect candidate maturity and fair-play validation trend.");
  } else if (candidateTrend.trendFlat) {
    add("watch", "candidate-maturity", "validCandidateCountTrend", candidateTrend.lastValidCandidateCount, "movement over tail samples", "Candidate maturity is stable but flat across recent samples.", "Inspect whether candidate generation has plateaued before extending seed count.");
  } else {
    add("ok", "candidate-maturity", "validCandidateCountTrend", `${candidateTrend.firstValidCandidateCount}->${candidateTrend.lastValidCandidateCount}`, "stable or improving", "Candidate maturity trend is stable.", "No candidate-maturity follow-up required.");
  }

  if (gateSummary.caseCount < gate.minimumCaseCount || gateSummary.uniqueCaseCount < gate.minimumCaseCount) {
    add("blocker", "case-diversity", "uniqueCaseCount", gateSummary.uniqueCaseCount, `>= ${gate.minimumCaseCount}`, "Run did not produce enough unique cases.", "Inspect case extraction cadence and candidate ordering.");
  } else if (gate.minDistinctCaseTypeCount !== undefined && gateSummary.distinctCaseTypeCount < gate.minDistinctCaseTypeCount) {
    add("blocker", "case-diversity", "distinctCaseTypeCount", gateSummary.distinctCaseTypeCount, `>= ${gate.minDistinctCaseTypeCount}`, "Case type coverage is below the stable-world gate.", "Inspect case type cooldown and maturity scoring.");
  } else if (gate.minDistinctCaseTypeCount !== undefined && gateSummary.distinctCaseTypeCount - gate.minDistinctCaseTypeCount <= 1) {
    add("risk", "case-diversity", "distinctCaseTypeCount", gateSummary.distinctCaseTypeCount, `>= ${gate.minDistinctCaseTypeCount}`, "Case type coverage passes but has little margin.", "Inspect repeat/cooldown pressure before adding seeds.");
  } else {
    add("ok", "case-diversity", "distinctCaseTypeCount", gateSummary.distinctCaseTypeCount, formatThreshold(gate.minDistinctCaseTypeCount), "Case diversity has healthy margin.", "No case-diversity follow-up required.");
  }

  if (gate.minInstitutionDecisionCount !== undefined && gateSummary.institutionDecisionCount < gate.minInstitutionDecisionCount) {
    add("blocker", "institution-influence", "institutionDecisionCount", gateSummary.institutionDecisionCount, `>= ${gate.minInstitutionDecisionCount}`, "Institution decisions are below the stable-world gate.", "Inspect police/court/media/medical/dock/informant pressure loops.");
  } else if (gate.minInstitutionDecisionCount !== undefined && gateSummary.institutionDecisionCount - gate.minInstitutionDecisionCount <= 2) {
    add("risk", "institution-influence", "institutionDecisionCount", gateSummary.institutionDecisionCount, `>= ${gate.minInstitutionDecisionCount}`, "Institution influence passes but has little margin.", "Inspect institution decision cadence and pressure deltas.");
  } else {
    add("ok", "institution-influence", "institutionDecisionCount", gateSummary.institutionDecisionCount, formatThreshold(gate.minInstitutionDecisionCount), "Institution influence has healthy margin.", "No institution-influence follow-up required.");
  }

  if (gate.maxEvidenceGraphWarnings !== undefined && gateSummary.evidenceGraphWarnings > gate.maxEvidenceGraphWarnings) {
    add("blocker", "evidence-closure", "evidenceGraphWarnings", gateSummary.evidenceGraphWarnings, `<= ${gate.maxEvidenceGraphWarnings}`, "Evidence graph warnings violate the stable-world gate.", "Inspect evidence graph completeness before tuning action rules.");
  } else if (gate.minEvidenceCompleteCaseCount !== undefined && gateSummary.evidenceCompleteCaseCount < gate.minEvidenceCompleteCaseCount) {
    add("blocker", "evidence-closure", "evidenceCompleteCaseCount", gateSummary.evidenceCompleteCaseCount, `>= ${gate.minEvidenceCompleteCaseCount}`, "Not every required case has complete evidence closure.", "Inspect evidence chain provenance and validation.");
  } else {
    add("ok", "evidence-closure", "evidenceGraphWarnings", gateSummary.evidenceGraphWarnings, formatThreshold(gate.maxEvidenceGraphWarnings), "Evidence closure is clean.", "No evidence-closure follow-up required.");
  }

  if (gate.minLaterCaseInfluenceRate !== undefined && gateSummary.laterCaseInfluenceRate < gate.minLaterCaseInfluenceRate) {
    add("blocker", "cross-case-influence", "laterCaseInfluenceRate", `${gateSummary.laterCaseInfluenceRate}%`, `>= ${gate.minLaterCaseInfluenceRate}%`, "Later cases are not sufficiently influenced by prior cases.", "Inspect aftermath propagation and case graph edges.");
  } else if (crossCaseInfluenceCount(report) < gate.minCrossCaseInfluenceCount) {
    add("blocker", "cross-case-influence", "crossCaseInfluenceCount", crossCaseInfluenceCount(report), `>= ${gate.minCrossCaseInfluenceCount}`, "Cross-case influence count is below the quality gate.", "Inspect campaign graph edge generation.");
  } else if (gate.minLaterCaseInfluenceRate !== undefined && gateSummary.laterCaseInfluenceRate - gate.minLaterCaseInfluenceRate <= 10) {
    add("risk", "cross-case-influence", "laterCaseInfluenceRate", `${gateSummary.laterCaseInfluenceRate}%`, `>= ${gate.minLaterCaseInfluenceRate}%`, "Cross-case influence passes but has little margin.", "Inspect aftermath links before expanding seed count.");
  } else {
    add("ok", "cross-case-influence", "laterCaseInfluenceRate", `${gateSummary.laterCaseInfluenceRate}%`, formatThreshold(gate.minLaterCaseInfluenceRate), "Cross-case influence has healthy margin.", "No cross-case follow-up required.");
  }

  if (gate.maxRuntimeMs !== undefined && gateSummary.runtimeMs > gate.maxRuntimeMs) {
    add("blocker", "performance", "runtimeMs", gateSummary.runtimeMs, `<= ${gate.maxRuntimeMs}`, "Runtime exceeds the stable-world budget.", "Inspect top performance phases before adding seeds.");
  } else if (gate.maxRuntimeMs !== undefined && gateSummary.runtimeMs / gate.maxRuntimeMs >= 0.85) {
    add("risk", "performance", "runtimeMs", gateSummary.runtimeMs, `<= ${gate.maxRuntimeMs}`, "Runtime is close to the stable-world budget.", "Inspect snapshot, action-scoring, and case-chain phase shares.");
  } else {
    add("ok", "performance", "runtimeMs", gateSummary.runtimeMs, formatThreshold(gate.maxRuntimeMs), "Runtime has healthy margin.", "No performance follow-up required.");
  }
  for (const phase of performancePhases.filter((item) => ["snapshot", "action-scoring", "case-chain"].includes(item.phase) && item.share > 35)) {
    add("watch", "performance", `${phase.phase}Share`, `${phase.share}%`, "<= 35%", `${phase.phase} dominates runtime profile.`, "Inspect phase-specific costs before broadening validation.");
  }

  if (!gateSummary.deterministicRunHash) {
    add("blocker", "determinism", "deterministicRunHash", "missing", "present", "Deterministic run hash is missing.", "Inspect deterministic hashing inputs and report serialization.");
  } else {
    add("ok", "determinism", "deterministicRunHash", gateSummary.deterministicRunHash, "present", "Deterministic hash is present for same-seed comparison.", "Repeat the same seed if hash drift is suspected.");
  }

  return {
    seed,
    status: diagnosticStatus(findings),
    deterministicRunHash: gateSummary.deterministicRunHash,
    findingCounts: countDiagnosticFindings(findings),
    actionMix: {
      selectedActionKindCount: stability.selectedActionKindCount,
      largestSelectedActionShare: stability.largestSelectedActionShare,
      topActionKind: topAction.kind,
      topActionKindShare: topAction.share
    },
    actorSpread: {
      activeActorCount: stability.activeActorCount,
      largestActorShare: stability.largestActorShare,
      topActorShares: topShares(stability.actorDecisionDistribution)
    },
    candidateMaturity: candidateTrend,
    performance: {
      runtimeMs: gateSummary.runtimeMs,
      maxRuntimeMs: gate.maxRuntimeMs ?? 0,
      topPhases: performancePhases
    },
    findings
  };
}

export function buildStableWorldDiagnostics(report: SimulationQualityReport): StableWorldDiagnosticsReport {
  const perSeedBySeed = new Map(report.summary.stability.perSeed.map((item) => [item.seed, item]));
  const seeds = report.reports.map((seedReport) => {
    const gateSummary = perSeedBySeed.get(seedReport.summary.seed) || buildStableWorldSeedGateSummary(seedReport, report.gate);
    return buildStableWorldSeedDiagnostics(seedReport, report.gate, gateSummary);
  });
  const findings = seeds.flatMap((seed) => seed.findings);
  const findingCounts = countDiagnosticFindings(findings);
  const worstFindings = findings
    .filter((finding) => finding.severity === "blocker" || finding.severity === "risk")
    .sort((left, right) =>
      DIAGNOSTIC_SEVERITY_RANK[right.severity] - DIAGNOSTIC_SEVERITY_RANK[left.severity] ||
      left.seed.localeCompare(right.seed) ||
      left.dimension.localeCompare(right.dimension)
    )
    .slice(0, 8);
  const slowest = [...report.summary.stability.perSeed].sort((left, right) => right.runtimeMs - left.runtimeMs || left.seed.localeCompare(right.seed))[0];
  const largestAction = [...report.summary.stability.perSeed].sort((left, right) => right.largestSelectedActionShare - left.largestSelectedActionShare || left.seed.localeCompare(right.seed))[0];
  const lowestCaseType = [...report.summary.stability.perSeed].sort((left, right) => left.distinctCaseTypeCount - right.distinctCaseTypeCount || left.seed.localeCompare(right.seed))[0];
  const lowestInstitution = [...report.summary.stability.perSeed].sort((left, right) => left.institutionDecisionCount - right.institutionDecisionCount || left.seed.localeCompare(right.seed))[0];
  const overallStatus = diagnosticStatus(findings);
  return {
    generatedAt: report.generatedAt,
    ok: findingCounts.blocker === 0,
    overallStatus,
    findingCounts,
    topRisks: worstFindings,
    slowestSeed: slowest?.seed || "",
    largestActionShareSeed: largestAction?.seed || "",
    lowestCaseTypeSeed: lowestCaseType?.seed || "",
    lowestInstitutionSeed: lowestInstitution?.seed || "",
    seeds
  };
}

const CASE_QUALITY_DIMENSIONS: StableWorldCaseQualityDimension[] = [
  "fair-play-evidence",
  "evidence-provenance",
  "case-diversity",
  "cross-case-continuity",
  "institution-relevance",
  "repeat-control",
  "solution-readiness"
];

function averageNumber(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function caseQualityStatus(score: number): StableWorldCaseQualityStatus {
  if (score >= 82) return "ok";
  if (score >= 68) return "watch";
  return "risk";
}

function countCaseQualityStatuses(seeds: StableWorldCaseQualitySeed[]) {
  return seeds.reduce<Record<StableWorldCaseQualityStatus, number>>((counts, seed) => {
    counts[seed.status] += 1;
    return counts;
  }, { ok: 0, watch: 0, risk: 0 });
}

function dimensionScore(
  dimension: StableWorldCaseQualityDimension,
  score: number,
  actual: string | number,
  target: string | number,
  message: string
): StableWorldCaseQualityDimensionScore {
  return { dimension, score: clamp(score), actual, target, message };
}

function buildStableWorldCaseQualitySeed(report: LongRunValidationReport, gateSummary: StableWorldSeedGateSummary): StableWorldCaseQualitySeed {
  const caseCount = Math.max(1, report.summary.caseCount);
  const evidenceCompleteRate = Math.round((gateSummary.evidenceCompleteCaseCount / caseCount) * 100);
  const evidenceWarningCount = report.metrics.evidenceGraph.warnings.length;
  const solvedRate = Math.round((report.summary.solvedCaseCount / caseCount) * 100);
  const diversityTarget = Math.max(4, report.metrics.diversity.distinctCaseTypeCount);
  const diversityScore = clamp((gateSummary.distinctCaseTypeCount / diversityTarget) * 100);
  const continuityScore = clamp(gateSummary.laterCaseInfluenceRate);
  const institutionTarget = 80;
  const institutionScore = clamp((gateSummary.institutionDecisionCount / institutionTarget) * 100);
  const repeatScore = clamp(100 - gateSummary.candidateRepeatRate * 3);
  const evidenceProvenanceScore = clamp(100 - evidenceWarningCount * 20);
  const solutionReadinessScore = clamp((solvedRate * 0.55) + (evidenceCompleteRate * 0.45));
  const dimensions = [
    dimensionScore("fair-play-evidence", evidenceCompleteRate, `${evidenceCompleteRate}%`, "100% evidence-complete cases", "Evidence closure is readable without exposing evidence ids."),
    dimensionScore("evidence-provenance", evidenceProvenanceScore, evidenceWarningCount, "0 evidence graph warnings", "Evidence provenance is summarized by warning count only."),
    dimensionScore("case-diversity", diversityScore, gateSummary.distinctCaseTypeCount, `>= ${diversityTarget} case types`, "Case types remain broad enough for public review."),
    dimensionScore("cross-case-continuity", continuityScore, `${gateSummary.laterCaseInfluenceRate}%`, ">= 80% later influence", "Later cases retain visible aggregate influence."),
    dimensionScore("institution-relevance", institutionScore, gateSummary.institutionDecisionCount, `>= ${institutionTarget} institution decisions`, "Institution pressure contributes to the case stream."),
    dimensionScore("repeat-control", repeatScore, `${gateSummary.candidateRepeatRate}%`, "<= 10% repeat preferred", "Candidate repeat remains controlled."),
    dimensionScore("solution-readiness", solutionReadinessScore, `${solvedRate}% solved / ${evidenceCompleteRate}% evidence complete`, "solved and evidence-complete", "Solved cases have enough aggregate closure for reviewer trust.")
  ];
  const score = clamp(averageNumber(dimensions.map((item) => item.score)));
  return {
    seed: report.summary.seed,
    status: caseQualityStatus(score),
    score,
    deterministicRunHash: gateSummary.deterministicRunHash,
    caseCount: report.summary.caseCount,
    solvedCaseCount: report.summary.solvedCaseCount,
    distinctCaseTypeCount: gateSummary.distinctCaseTypeCount,
    evidenceCompleteCaseCount: gateSummary.evidenceCompleteCaseCount,
    evidenceWarningCount,
    laterCaseInfluenceRate: gateSummary.laterCaseInfluenceRate,
    institutionDecisionCount: gateSummary.institutionDecisionCount,
    repeatRate: gateSummary.candidateRepeatRate,
    dimensions
  };
}

export function buildStableWorldCaseQualityReport(report: SimulationQualityReport): StableWorldCaseQualityReport {
  const perSeedBySeed = new Map(report.summary.stability.perSeed.map((item) => [item.seed, item]));
  const seeds = report.reports.map((seedReport) => {
    const gateSummary = perSeedBySeed.get(seedReport.summary.seed) || buildStableWorldSeedGateSummary(seedReport, report.gate);
    return buildStableWorldCaseQualitySeed(seedReport, gateSummary);
  });
  const averageScore = clamp(averageNumber(seeds.map((seed) => seed.score)));
  const minScore = seeds.length ? Math.min(...seeds.map((seed) => seed.score)) : 0;
  const dimensionAverages = Object.fromEntries(CASE_QUALITY_DIMENSIONS.map((dimension) => {
    const values = seeds.map((seed) => seed.dimensions.find((item) => item.dimension === dimension)?.score ?? 0);
    return [dimension, clamp(averageNumber(values))];
  })) as Record<StableWorldCaseQualityDimension, number>;
  const dimensionMinimums = Object.fromEntries(CASE_QUALITY_DIMENSIONS.map((dimension) => {
    const values = seeds.map((seed) => seed.dimensions.find((item) => item.dimension === dimension)?.score ?? 0);
    return [dimension, values.length ? Math.min(...values) : 0];
  })) as Record<StableWorldCaseQualityDimension, number>;
  return {
    generatedAt: report.generatedAt,
    ok: true,
    nonBlocking: true,
    overallStatus: caseQualityStatus(minScore || averageScore),
    minScore,
    averageScore,
    statusCounts: countCaseQualityStatuses(seeds),
    dimensionAverages,
    dimensionMinimums,
    seeds
  };
}

const REGRESSION_STATUS_RANK: Record<StableWorldRegressionStatus, number> = {
  improved: 0,
  unchanged: 1,
  watch: 2,
  regressed: 3,
  blocked: 4
};

function emptyRegressionCounts(): Record<StableWorldRegressionStatus, number> {
  return { improved: 0, unchanged: 0, watch: 0, regressed: 0, blocked: 0 };
}

function regressionStatus(deltas: StableWorldMetricDelta[]): StableWorldRegressionStatus {
  return deltas.reduce<StableWorldRegressionStatus>(
    (status, delta) => REGRESSION_STATUS_RANK[delta.status] > REGRESSION_STATUS_RANK[status] ? delta.status : status,
    "unchanged"
  );
}

function countRegressionDeltas(deltas: StableWorldMetricDelta[]) {
  const counts = emptyRegressionCounts();
  for (const delta of deltas) counts[delta.status] += 1;
  return counts;
}

function percentDelta(previous: number, current: number) {
  const denominator = Math.max(Math.abs(previous), 1);
  return Math.round(((current - previous) / denominator) * 100);
}

function topPhaseShare(seed?: StableWorldSeedDiagnostics) {
  return seed?.performance.topPhases[0]?.share ?? 0;
}

function regressionDiagnostics(input: StableWorldRegressionInput): StableWorldDiagnosticsReport | undefined {
  if (!input) return undefined;
  if (input.diagnostics) return input.diagnostics;
  return input.quality ? buildStableWorldDiagnostics(input.quality) : undefined;
}

function addRegressionDelta(
  deltas: StableWorldMetricDelta[],
  seed: string,
  status: StableWorldRegressionStatus,
  metric: string,
  previous: string | number,
  current: string | number,
  delta: string | number,
  message: string,
  recommendedNextInspection: string
) {
  deltas.push({ seed, status, metric, previous, current, delta, message, recommendedNextInspection });
}

function compareHigherBetter(
  deltas: StableWorldMetricDelta[],
  seed: string,
  metric: string,
  previous: number,
  current: number,
  minimum: number,
  nearThresholdMargin: number,
  label: string
) {
  const delta = current - previous;
  if (delta > 0) {
    addRegressionDelta(deltas, seed, "improved", metric, previous, current, delta, `${label} improved.`, "No follow-up required unless this changed other metrics.");
  } else if (delta < 0 && current - minimum <= nearThresholdMargin) {
    addRegressionDelta(deltas, seed, "regressed", metric, previous, current, delta, `${label} dropped near its gate threshold.`, "Inspect candidate maturity and selection pressure before tuning rules.");
  } else if (delta < 0) {
    addRegressionDelta(deltas, seed, "watch", metric, previous, current, delta, `${label} decreased but still has margin.`, "Watch this metric in the next stable-world run.");
  } else {
    addRegressionDelta(deltas, seed, "unchanged", metric, previous, current, delta, `${label} is unchanged.`, "No follow-up required.");
  }
}

function compareStableWorldSeedRegression(
  previousSummary: StableWorldSeedGateSummary,
  currentSummary: StableWorldSeedGateSummary,
  previousDiagnostics: StableWorldSeedDiagnostics | undefined,
  currentDiagnostics: StableWorldSeedDiagnostics | undefined,
  gate: SimulationQualityGate
): StableWorldSeedRegression {
  const seed = currentSummary.seed;
  const deltas: StableWorldMetricDelta[] = [];
  if (!currentSummary.ok || currentSummary.errors.length) {
    addRegressionDelta(deltas, seed, "blocked", "gateStatus", previousSummary.ok ? "ok" : "failed", currentSummary.ok ? "ok" : "failed", currentSummary.errors.length, "Current stable-world gate failed.", "Inspect current per-seed gate errors before comparing softer metrics.");
  }
  if ((currentDiagnostics?.findingCounts.blocker ?? 0) > 0) {
    addRegressionDelta(deltas, seed, "blocked", "diagnosticBlockers", previousDiagnostics?.findingCounts.blocker ?? 0, currentDiagnostics?.findingCounts.blocker ?? 0, (currentDiagnostics?.findingCounts.blocker ?? 0) - (previousDiagnostics?.findingCounts.blocker ?? 0), "Current diagnostics contain blocker findings.", "Inspect diagnostics-report blocker rows first.");
  }
  if (!currentSummary.deterministicRunHash) {
    addRegressionDelta(deltas, seed, "blocked", "deterministicRunHash", previousSummary.deterministicRunHash || "missing", "missing", "missing", "Current deterministic hash is missing.", "Inspect deterministic hash inputs and report serialization.");
  }

  compareHigherBetter(deltas, seed, "caseCount", previousSummary.caseCount, currentSummary.caseCount, gate.minimumCaseCount, 1, "Case count");
  compareHigherBetter(deltas, seed, "distinctCaseTypeCount", previousSummary.distinctCaseTypeCount, currentSummary.distinctCaseTypeCount, gate.minDistinctCaseTypeCount ?? 0, 1, "Case type count");
  compareHigherBetter(deltas, seed, "selectedActionKindCount", previousSummary.selectedActionKindCount, currentSummary.selectedActionKindCount, gate.minSelectedActionKindCount ?? 0, 1, "Action kind count");
  compareHigherBetter(deltas, seed, "institutionDecisionCount", previousSummary.institutionDecisionCount, currentSummary.institutionDecisionCount, gate.minInstitutionDecisionCount ?? 0, 2, "Institution decision count");

  const repeatDelta = currentSummary.candidateRepeatRate - previousSummary.candidateRepeatRate;
  if (repeatDelta > 0) {
    addRegressionDelta(deltas, seed, "regressed", "candidateRepeatRate", `${previousSummary.candidateRepeatRate}%`, `${currentSummary.candidateRepeatRate}%`, `${repeatDelta}%`, "Candidate repeat rate increased.", "Inspect repeat/cooldown pressure and selected case signatures.");
  } else if (repeatDelta < 0) {
    addRegressionDelta(deltas, seed, "improved", "candidateRepeatRate", `${previousSummary.candidateRepeatRate}%`, `${currentSummary.candidateRepeatRate}%`, `${repeatDelta}%`, "Candidate repeat rate improved.", "No follow-up required.");
  } else {
    addRegressionDelta(deltas, seed, "unchanged", "candidateRepeatRate", `${previousSummary.candidateRepeatRate}%`, `${currentSummary.candidateRepeatRate}%`, "0%", "Candidate repeat rate is unchanged.", "No follow-up required.");
  }

  const influenceDelta = currentSummary.laterCaseInfluenceRate - previousSummary.laterCaseInfluenceRate;
  if (influenceDelta > 0) {
    addRegressionDelta(deltas, seed, "improved", "laterCaseInfluenceRate", `${previousSummary.laterCaseInfluenceRate}%`, `${currentSummary.laterCaseInfluenceRate}%`, `${influenceDelta}%`, "Later-case influence improved.", "No follow-up required.");
  } else if (influenceDelta < 0 && currentSummary.laterCaseInfluenceRate - (gate.minLaterCaseInfluenceRate ?? 0) <= 10) {
    addRegressionDelta(deltas, seed, "regressed", "laterCaseInfluenceRate", `${previousSummary.laterCaseInfluenceRate}%`, `${currentSummary.laterCaseInfluenceRate}%`, `${influenceDelta}%`, "Later-case influence dropped near its gate threshold.", "Inspect aftermath propagation and case graph edges.");
  } else if (influenceDelta < 0) {
    addRegressionDelta(deltas, seed, "watch", "laterCaseInfluenceRate", `${previousSummary.laterCaseInfluenceRate}%`, `${currentSummary.laterCaseInfluenceRate}%`, `${influenceDelta}%`, "Later-case influence decreased but still has margin.", "Watch cross-case edges in the next run.");
  } else {
    addRegressionDelta(deltas, seed, "unchanged", "laterCaseInfluenceRate", `${previousSummary.laterCaseInfluenceRate}%`, `${currentSummary.laterCaseInfluenceRate}%`, "0%", "Later-case influence is unchanged.", "No follow-up required.");
  }

  const evidenceWarningDelta = currentSummary.evidenceGraphWarnings - previousSummary.evidenceGraphWarnings;
  if (previousSummary.evidenceGraphWarnings === 0 && currentSummary.evidenceGraphWarnings > 0) {
    addRegressionDelta(deltas, seed, "blocked", "evidenceGraphWarnings", previousSummary.evidenceGraphWarnings, currentSummary.evidenceGraphWarnings, evidenceWarningDelta, "Evidence warnings appeared after a clean baseline.", "Inspect evidence graph completeness before changing any other rule.");
  } else if (evidenceWarningDelta > 0) {
    addRegressionDelta(deltas, seed, "regressed", "evidenceGraphWarnings", previousSummary.evidenceGraphWarnings, currentSummary.evidenceGraphWarnings, evidenceWarningDelta, "Evidence warnings increased.", "Inspect evidence graph warning rows.");
  } else if (evidenceWarningDelta < 0) {
    addRegressionDelta(deltas, seed, "improved", "evidenceGraphWarnings", previousSummary.evidenceGraphWarnings, currentSummary.evidenceGraphWarnings, evidenceWarningDelta, "Evidence warnings decreased.", "No follow-up required.");
  } else {
    addRegressionDelta(deltas, seed, "unchanged", "evidenceGraphWarnings", previousSummary.evidenceGraphWarnings, currentSummary.evidenceGraphWarnings, evidenceWarningDelta, "Evidence warning count is unchanged.", "No follow-up required.");
  }

  const actionShareDelta = currentSummary.largestSelectedActionShare - previousSummary.largestSelectedActionShare;
  if (actionShareDelta >= 5) {
    addRegressionDelta(deltas, seed, "regressed", "largestSelectedActionShare", `${previousSummary.largestSelectedActionShare}%`, `${currentSummary.largestSelectedActionShare}%`, `${actionShareDelta}%`, "Largest action share increased materially.", "Inspect action-mix tie-breaks and lifecycle pressure.");
  } else if (actionShareDelta <= -3) {
    addRegressionDelta(deltas, seed, "improved", "largestSelectedActionShare", `${previousSummary.largestSelectedActionShare}%`, `${currentSummary.largestSelectedActionShare}%`, `${actionShareDelta}%`, "Largest action share decreased.", "No follow-up required.");
  } else {
    addRegressionDelta(deltas, seed, actionShareDelta > 0 ? "watch" : "unchanged", "largestSelectedActionShare", `${previousSummary.largestSelectedActionShare}%`, `${currentSummary.largestSelectedActionShare}%`, `${actionShareDelta}%`, actionShareDelta > 0 ? "Largest action share rose slightly." : "Largest action share is stable.", actionShareDelta > 0 ? "Watch action concentration in the next run." : "No follow-up required.");
  }

  const actorShareDelta = currentSummary.largestActorShare - previousSummary.largestActorShare;
  if (actorShareDelta >= 3) {
    addRegressionDelta(deltas, seed, "watch", "largestActorShare", `${previousSummary.largestActorShare}%`, `${currentSummary.largestActorShare}%`, `${actorShareDelta}%`, "Largest actor rank share increased.", "Inspect actor selection pressure by rank; do not expose NPC ids.");
  } else if (actorShareDelta <= -3) {
    addRegressionDelta(deltas, seed, "improved", "largestActorShare", `${previousSummary.largestActorShare}%`, `${currentSummary.largestActorShare}%`, `${actorShareDelta}%`, "Largest actor rank share decreased.", "No follow-up required.");
  } else {
    addRegressionDelta(deltas, seed, "unchanged", "largestActorShare", `${previousSummary.largestActorShare}%`, `${currentSummary.largestActorShare}%`, `${actorShareDelta}%`, "Largest actor rank share is stable.", "No follow-up required.");
  }

  const runtimePercentDelta = percentDelta(previousSummary.runtimeMs, currentSummary.runtimeMs);
  if (runtimePercentDelta >= 20) {
    addRegressionDelta(deltas, seed, "regressed", "runtimeMs", previousSummary.runtimeMs, currentSummary.runtimeMs, `${runtimePercentDelta}%`, "Runtime increased by at least 20%.", "Inspect snapshot, action-scoring, and case-chain phase shares.");
  } else if (runtimePercentDelta >= 10) {
    addRegressionDelta(deltas, seed, "watch", "runtimeMs", previousSummary.runtimeMs, currentSummary.runtimeMs, `${runtimePercentDelta}%`, "Runtime increased by 10-19%.", "Watch runtime on the next stable-world run before expanding seeds.");
  } else if (runtimePercentDelta <= -10) {
    addRegressionDelta(deltas, seed, "improved", "runtimeMs", previousSummary.runtimeMs, currentSummary.runtimeMs, `${runtimePercentDelta}%`, "Runtime decreased by at least 10%.", "No follow-up required.");
  } else {
    addRegressionDelta(deltas, seed, "unchanged", "runtimeMs", previousSummary.runtimeMs, currentSummary.runtimeMs, `${runtimePercentDelta}%`, "Runtime is within expected variance.", "No follow-up required.");
  }

  const previousFindingRisk = (previousDiagnostics?.findingCounts.risk ?? 0) + (previousDiagnostics?.findingCounts.blocker ?? 0);
  const currentFindingRisk = (currentDiagnostics?.findingCounts.risk ?? 0) + (currentDiagnostics?.findingCounts.blocker ?? 0);
  const riskFindingDelta = currentFindingRisk - previousFindingRisk;
  if (riskFindingDelta > 0) {
    addRegressionDelta(deltas, seed, "regressed", "riskOrBlockerFindings", previousFindingRisk, currentFindingRisk, riskFindingDelta, "Risk/blocker diagnostic findings increased.", "Inspect diagnostics-report top risks.");
  } else if (riskFindingDelta < 0) {
    addRegressionDelta(deltas, seed, "improved", "riskOrBlockerFindings", previousFindingRisk, currentFindingRisk, riskFindingDelta, "Risk/blocker diagnostic findings decreased.", "No follow-up required.");
  } else {
    addRegressionDelta(deltas, seed, "unchanged", "riskOrBlockerFindings", previousFindingRisk, currentFindingRisk, riskFindingDelta, "Risk/blocker diagnostic findings are unchanged.", "No follow-up required.");
  }

  const watchFindingDelta = (currentDiagnostics?.findingCounts.watch ?? 0) - (previousDiagnostics?.findingCounts.watch ?? 0);
  if (watchFindingDelta > 0) {
    addRegressionDelta(deltas, seed, "watch", "watchFindings", previousDiagnostics?.findingCounts.watch ?? 0, currentDiagnostics?.findingCounts.watch ?? 0, watchFindingDelta, "Watch diagnostic findings increased.", "Inspect diagnostics-report watch rows.");
  } else if (watchFindingDelta < 0) {
    addRegressionDelta(deltas, seed, "improved", "watchFindings", previousDiagnostics?.findingCounts.watch ?? 0, currentDiagnostics?.findingCounts.watch ?? 0, watchFindingDelta, "Watch diagnostic findings decreased.", "No follow-up required.");
  } else {
    addRegressionDelta(deltas, seed, "unchanged", "watchFindings", previousDiagnostics?.findingCounts.watch ?? 0, currentDiagnostics?.findingCounts.watch ?? 0, watchFindingDelta, "Watch diagnostic findings are unchanged.", "No follow-up required.");
  }

  const phaseShareDelta = topPhaseShare(currentDiagnostics) - topPhaseShare(previousDiagnostics);
  if (phaseShareDelta >= 5) {
    addRegressionDelta(deltas, seed, "watch", "topPerformancePhaseShare", `${topPhaseShare(previousDiagnostics)}%`, `${topPhaseShare(currentDiagnostics)}%`, `${phaseShareDelta}%`, "Top performance phase share increased.", "Inspect top phase costs before broadening validation.");
  } else if (phaseShareDelta <= -5) {
    addRegressionDelta(deltas, seed, "improved", "topPerformancePhaseShare", `${topPhaseShare(previousDiagnostics)}%`, `${topPhaseShare(currentDiagnostics)}%`, `${phaseShareDelta}%`, "Top performance phase share decreased.", "No follow-up required.");
  } else {
    addRegressionDelta(deltas, seed, "unchanged", "topPerformancePhaseShare", `${topPhaseShare(previousDiagnostics)}%`, `${topPhaseShare(currentDiagnostics)}%`, `${phaseShareDelta}%`, "Top performance phase share is stable.", "No follow-up required.");
  }

  return {
    seed,
    status: regressionStatus(deltas),
    deltaCounts: countRegressionDeltas(deltas),
    deterministicRunHash: currentSummary.deterministicRunHash,
    runtimeDeltaMs: currentSummary.runtimeMs - previousSummary.runtimeMs,
    deltas
  };
}

export function buildStableWorldRegressionReport(
  previous: StableWorldRegressionInput,
  current: { quality: SimulationQualityReport; diagnostics?: StableWorldDiagnosticsReport }
): StableWorldRegressionReport {
  const currentDiagnostics = current.diagnostics || buildStableWorldDiagnostics(current.quality);
  const previousQuality = previous?.quality;
  const previousDiagnostics = regressionDiagnostics(previous);
  const previousBySeed = new Map(previousQuality?.summary.stability.perSeed.map((item) => [item.seed, item]) || []);
  const previousDiagnosticsBySeed = new Map(previousDiagnostics?.seeds.map((item) => [item.seed, item]) || []);
  const currentDiagnosticsBySeed = new Map(currentDiagnostics.seeds.map((item) => [item.seed, item]));
  if (!previousQuality || previousBySeed.size === 0) {
    const perSeedStatus = Object.fromEntries(current.quality.summary.stability.perSeed.map((seed) => [seed.seed, "unchanged" as StableWorldRegressionStatus]));
    const runtimeDeltaBySeed = Object.fromEntries(current.quality.summary.stability.perSeed.map((seed) => [seed.seed, 0]));
    return {
      generatedAt: current.quality.generatedAt,
      baselineAvailable: false,
      ok: true,
      overallStatus: "unchanged",
      deltaCounts: emptyRegressionCounts(),
      topRegressions: [],
      perSeedStatus,
      runtimeDeltaBySeed,
      seeds: current.quality.summary.stability.perSeed.map((seed) => ({
        seed: seed.seed,
        status: "unchanged",
        deltaCounts: emptyRegressionCounts(),
        deterministicRunHash: seed.deterministicRunHash,
        runtimeDeltaMs: 0,
        deltas: []
      }))
    };
  }
  const seeds = current.quality.summary.stability.perSeed.map((currentSummary) => {
    const previousSummary = previousBySeed.get(currentSummary.seed);
    if (!previousSummary) {
      const delta: StableWorldMetricDelta = {
        seed: currentSummary.seed,
        status: "watch",
        metric: "baselineSeed",
        previous: "missing",
        current: "present",
        delta: "new seed",
        message: "Seed was not present in the previous stable-world artifact.",
        recommendedNextInspection: "Run stable-world again to establish a comparable baseline."
      };
      return {
        seed: currentSummary.seed,
        status: "watch" as StableWorldRegressionStatus,
        deltaCounts: { ...emptyRegressionCounts(), watch: 1 },
        deterministicRunHash: currentSummary.deterministicRunHash,
        runtimeDeltaMs: 0,
        deltas: [delta]
      };
    }
    return compareStableWorldSeedRegression(
      previousSummary,
      currentSummary,
      previousDiagnosticsBySeed.get(currentSummary.seed),
      currentDiagnosticsBySeed.get(currentSummary.seed),
      current.quality.gate
    );
  });
  const deltas = seeds.flatMap((seed) => seed.deltas);
  const deltaCounts = countRegressionDeltas(deltas);
  const topRegressions = deltas
    .filter((delta) => delta.status === "blocked" || delta.status === "regressed")
    .sort((left, right) =>
      REGRESSION_STATUS_RANK[right.status] - REGRESSION_STATUS_RANK[left.status] ||
      left.seed.localeCompare(right.seed) ||
      left.metric.localeCompare(right.metric)
    )
    .slice(0, 8);
  return {
    generatedAt: current.quality.generatedAt,
    baselineAvailable: true,
    ok: deltaCounts.blocked === 0,
    overallStatus: regressionStatus(deltas),
    deltaCounts,
    topRegressions,
    perSeedStatus: Object.fromEntries(seeds.map((seed) => [seed.seed, seed.status])),
    runtimeDeltaBySeed: Object.fromEntries(seeds.map((seed) => [seed.seed, seed.runtimeDeltaMs])),
    seeds
  };
}

export function runSimulationQualitySuite(config: {
  seeds?: string[];
  gate?: Partial<SimulationQualityGate>;
  npcCount?: number;
  timelineHours?: number;
} = {}): SimulationQualityReport {
  const seeds = config.seeds?.length ? config.seeds : ["quality-a", "quality-b", "quality-c"];
  const gate: SimulationQualityGate = {
    tickCount: config.gate?.tickCount ?? 100,
    minimumCaseCount: config.gate?.minimumCaseCount ?? 3,
    minCandidateDiversityScore: config.gate?.minCandidateDiversityScore ?? 25,
    maxCandidateRepeatRate: config.gate?.maxCandidateRepeatRate ?? 70,
    minCausalLinkCount: config.gate?.minCausalLinkCount ?? 12,
    minCrossCaseInfluenceCount: config.gate?.minCrossCaseInfluenceCount ?? 2,
    maxRuntimeMs: config.gate?.maxRuntimeMs,
    minDistinctCaseTypeCount: config.gate?.minDistinctCaseTypeCount,
    minLaterCaseInfluenceRate: config.gate?.minLaterCaseInfluenceRate,
    maxEvidenceGraphWarnings: config.gate?.maxEvidenceGraphWarnings,
    minSelectedActionKindCount: config.gate?.minSelectedActionKindCount,
    maxLargestSelectedActionShare: config.gate?.maxLargestSelectedActionShare,
    minInstitutionDecisionCount: config.gate?.minInstitutionDecisionCount,
    minEvidenceCompleteCaseCount: config.gate?.minEvidenceCompleteCaseCount
  };
  const reports = seeds.map((seed) => runMultiCaseSimulation({
    seed,
    tickCount: gate.tickCount,
    minimumCaseCount: gate.minimumCaseCount,
    npcCount: config.npcCount,
    timelineHours: config.timelineHours
  }));
  return buildSimulationQualityReport(seeds, gate, reports);
}

function buildSimulationQualityReport(seeds: string[], gate: SimulationQualityGate, reports: LongRunValidationReport[]): SimulationQualityReport {
  const perSeed = reports.map((report) => buildStableWorldSeedGateSummary(report, gate));
  const errors = perSeed.flatMap((summary) => summary.errors.map((error) => `${summary.seed}: ${error}`));
  const stability = buildMultiSeedWorldStabilitySummary(perSeed);
  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  return {
    generatedAt: new Date().toISOString(),
    ok: errors.length === 0,
    seeds,
    gate,
    reports,
    summary: {
      runCount: reports.length,
      passed: stability.passedSeedCount,
      failed: stability.failedSeedCount,
      averageRuntimeMs: Math.round(average(reports.map((report) => report.performance.totalMs))),
      averageCandidateDiversityScore: Math.round(average(reports.map((report) => report.metrics.candidateDiversityScore))),
      averageCandidateRepeatRate: Math.round(average(reports.map((report) => report.metrics.candidateRepeatRate))),
      averageCausalLinkCount: Math.round(average(reports.map((report) => report.metrics.causalLinkCount))),
      totalCrossCaseInfluenceCount: reports.reduce((sum, report) => sum + crossCaseInfluenceCount(report), 0),
      stability
    },
    errors
  };
}

export function runCampaignBenchmark(config: {
  seed?: string;
  tickCount?: number;
  minimumCaseCount?: number;
  maxRuntimeMs?: number;
  performanceGate?: Partial<CampaignPerformanceGate>;
} = {}): CampaignRunReport {
  const seed = config.seed || "campaign-validation";
  const tickCount = config.tickCount || 500;
  const isFiveThousandGate = tickCount >= 5000;
  const minimumCaseCount = config.minimumCaseCount || (isFiveThousandGate ? 30 : tickCount >= 1000 ? 8 : tickCount >= 500 ? 5 : 3);
  const report = runMultiCaseSimulation({
    seed,
    tickCount,
    minimumCaseCount,
    // Long-run gates need only periodic rollback evidence. Keeping a snapshot
    // every 100 ticks preserves checkpoint coverage while avoiding repeated
    // serialization of the growing event/memory history.
    snapshotEveryTicks: isFiveThousandGate ? 100 : 5,
    checkpointEveryTicks: isFiveThousandGate ? 500 : 25,
    candidateEveryTicks: isFiveThousandGate ? 10 : 1,
    actionEveryTicks: isFiveThousandGate ? 3 : 1,
    indexEventLimit: isFiveThousandGate ? 200 : undefined,
    maxExtractionsPerChunk: isFiveThousandGate ? 1 : undefined,
    requireCompleteEvidenceCandidates: isFiveThousandGate,
    requireNewCandidatePair: false,
    cloneInput: isFiveThousandGate ? false : undefined
  });
  const quality = buildSimulationQualityReport([seed], {
    tickCount,
    minimumCaseCount,
    maxRuntimeMs: config.maxRuntimeMs,
    minCandidateDiversityScore: tickCount >= 500 ? 70 : 25,
    maxCandidateRepeatRate: isFiveThousandGate ? 15 : tickCount >= 500 ? 20 : 70,
    minCausalLinkCount: isFiveThousandGate ? 240 : tickCount >= 1000 ? 120 : tickCount >= 500 ? 70 : 12,
    minCrossCaseInfluenceCount: isFiveThousandGate ? 21 : tickCount >= 1000 ? 8 : tickCount >= 500 ? 5 : 2
  }, [report]);
  const totalMs = Math.max(report.performance.totalMs, 1);
  const phaseMs = (phaseName: string) => report.performance.phases.find((phase) => phase.phase === phaseName)?.totalMs || 0;
  const gate: CampaignPerformanceGate = {
    maxRuntimeMs: config.performanceGate?.maxRuntimeMs ?? config.maxRuntimeMs ?? (isFiveThousandGate ? 300_000 : tickCount >= 1000 ? 90_000 : tickCount >= 500 ? 30_000 : 10_000),
    maxCaseChainRatio: config.performanceGate?.maxCaseChainRatio ?? 0.42,
    maxSnapshotRatio: config.performanceGate?.maxSnapshotRatio ?? 0.18,
    maxActionScoringRatio: config.performanceGate?.maxActionScoringRatio ?? 0.25
  };
  const minCaseTypeDiversity = isFiveThousandGate ? 10 : tickCount >= 1000 ? 4 : 0;
  const minLaterCaseInfluenceRate = isFiveThousandGate ? 70 : tickCount >= 1000 ? 60 : 0;
  const stableWorldGate = tickCount >= 1000 && !isFiveThousandGate;
  const worldStability = report.metrics.worldStability;
  const errors = [
    ...report.errors,
    ...quality.errors,
    minCaseTypeDiversity && report.metrics.diversity.distinctCaseTypeCount < minCaseTypeDiversity ? `campaign case type diversity ${report.metrics.diversity.distinctCaseTypeCount} < ${minCaseTypeDiversity}` : "",
    minLaterCaseInfluenceRate && report.metrics.diversity.laterCaseInfluenceRate < minLaterCaseInfluenceRate ? `later case influence rate ${report.metrics.diversity.laterCaseInfluenceRate}% < ${minLaterCaseInfluenceRate}%` : "",
    isFiveThousandGate && report.metrics.candidateRepeatRate > 15 ? `candidate repeat rate ${report.metrics.candidateRepeatRate}% > 15%` : "",
    stableWorldGate && worldStability.selectedActionKindCount < 6 ? `selected action kinds ${worldStability.selectedActionKindCount} < 6` : "",
    stableWorldGate && worldStability.largestSelectedActionShare > 55 ? `largest selected action share ${worldStability.largestSelectedActionShare}% > 55%` : "",
    stableWorldGate && worldStability.institutionDecisionCount < 4 ? `institution decision count ${worldStability.institutionDecisionCount} < 4` : "",
    stableWorldGate && worldStability.evidenceCompleteCaseCount < minimumCaseCount ? `evidence complete cases ${worldStability.evidenceCompleteCaseCount} < ${minimumCaseCount}` : "",
    report.metrics.evidenceGraph.warnings.length > 0 ? `evidence graph warnings ${report.metrics.evidenceGraph.warnings.length} > 0` : "",
    report.metrics.uniqueCaseCount !== report.metrics.caseCount ? `unique case count ${report.metrics.uniqueCaseCount} != ${report.metrics.caseCount}` : "",
    report.metrics.caseGraph.nodes.length !== report.metrics.caseCount ? `case graph nodes ${report.metrics.caseGraph.nodes.length} != cases ${report.metrics.caseCount}` : "",
    report.performance.totalMs > gate.maxRuntimeMs ? `campaign runtime ${Math.round(report.performance.totalMs)}ms exceeds ${gate.maxRuntimeMs}ms` : "",
    phaseMs("case-chain") / totalMs > gate.maxCaseChainRatio ? `case-chain ratio ${Math.round((phaseMs("case-chain") / totalMs) * 100)}% exceeds ${Math.round(gate.maxCaseChainRatio * 100)}%` : "",
    phaseMs("snapshot") / totalMs > gate.maxSnapshotRatio ? `snapshot ratio ${Math.round((phaseMs("snapshot") / totalMs) * 100)}% exceeds ${Math.round(gate.maxSnapshotRatio * 100)}%` : "",
    phaseMs("action-scoring") / totalMs > gate.maxActionScoringRatio ? `action-scoring ratio ${Math.round((phaseMs("action-scoring") / totalMs) * 100)}% exceeds ${Math.round(gate.maxActionScoringRatio * 100)}%` : ""
  ].filter(Boolean);
  return {
    generatedAt: new Date().toISOString(),
    ok: report.ok && quality.ok && errors.length === 0,
    seed,
    tickCount,
    report,
    quality,
    errors
  };
}

export function renderLongRunValidationMarkdown(report: LongRunValidationReport) {
  const lines = [
    "# Long Run Validation Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Variant: ${report.summary.variant}`,
    `Seed: ${report.summary.seed}`,
    `Ticks: ${report.summary.tickCount}`,
    `Cases: ${report.summary.caseCount}`,
    `Solved: ${report.summary.solvedCaseCount}`,
    `Failed: ${report.summary.failedCaseCount}`,
    `Deterministic hash: ${report.metrics.deterministicRunHash}`,
    `Runtime: ${Math.round(report.performance.totalMs)} ms (${report.performance.averageTickMs.toFixed(2)} ms/tick)`,
    "",
    "## Causal Metrics",
    "",
    `- Cross-case NPC reuse: ${report.metrics.crossCaseNpcReuseRate}%`,
    `- Institution aftermath propagation: ${report.metrics.institutionAftermathPropagationCount}`,
    `- Institution pressure magnitude: ${report.metrics.institutionPressureMagnitude}`,
    `- Candidate diversity: ${report.metrics.candidateDiversityScore}`,
    `- Candidate repeat rate: ${report.metrics.candidateRepeatRate}%`,
    `- Causal links: ${report.metrics.causalLinkCount}`,
    `- Resource deltas: ${stableStringify(report.metrics.resourceDeltaByKind)}`,
    `- Snapshots/checkpoints: ${report.performance.counters.snapshotCount}/${report.performance.counters.checkpointCount}`,
    `- Candidate rebuilds: ${report.performance.counters.candidateRebuildCount}`,
    `- Social pressure rebuilds: ${report.performance.counters.socialPressureRebuildCount}`,
    "",
    "## World Stability",
    "",
    `- Selected action kinds: ${report.metrics.worldStability.selectedActionKindCount}`,
    `- Largest selected action share: ${report.metrics.worldStability.largestSelectedActionShare}%`,
    `- Active actors: ${report.metrics.worldStability.activeActorCount}`,
    `- Largest actor share: ${report.metrics.worldStability.largestActorShare}%`,
    `- Institution decisions: ${report.metrics.worldStability.institutionDecisionCount}`,
    `- Evidence complete cases: ${report.metrics.worldStability.evidenceCompleteCaseCount}`,
    `- Valid candidate trend: ${stableStringify(report.metrics.worldStability.validCandidateCountTrend)}`,
    `- Candidate rejection histogram: ${stableStringify(report.candidateRejectionReasonCounts)}`,
    `- Candidate lifecycle diagnostics: ${stableStringify(report.candidateLifecycleDiagnostics.slice(-12))}`,
    "",
    "## Causal Claims",
    "",
    ...(report.metrics.causalClaims.length ? report.metrics.causalClaims.map((claim) => `- ${claim}`) : ["- None"]),
    "",
    "## Cases",
    "",
    "| Case | Tick | Culprit | Victim | Reused NPCs | Institutions | Long Actions | Aftermath |",
    "| --- | ---: | --- | --- | --- | --- | --- | --- |",
    ...report.cases.map((item) => `| ${item.caseId} | ${item.tick} | ${item.culpritId} | ${item.victimId} | ${item.repeatedNpcIds.join(",") || "-"} | ${item.institutionIds.join(",") || "-"} | ${item.longActionIds.join(",") || "-"} | ${item.aftermathIds.join(",") || "-"} |`)
  ];
  if (report.errors.length) lines.push("", "## Errors", "", ...report.errors.map((error) => `- ${error}`));
  if (report.warnings.length) lines.push("", "## Warnings", "", ...report.warnings.map((warning) => `- ${warning}`));
  return `${lines.join("\n")}\n`;
}

export function renderRuleAblationMarkdown(report: RuleAblationReport) {
  const lines = [
    "# Rule Ablation Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Threshold: ${report.threshold}%`,
    `Passed: ${report.ok ? "yes" : "no"}`,
    "",
    "| Variant | Changed | Strongest metric | Relative change | Cases | Diversity | Repeat | Causal links |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |"
  ];
  for (const delta of report.ablationDeltas) {
    const variantReport = report.variants[delta.variant];
    lines.push(`| ${delta.variant} | ${delta.changed ? "yes" : "no"} | ${delta.strongestMetric} | ${delta.relativeChange}% | ${variantReport.metrics.caseCount} | ${variantReport.metrics.candidateDiversityScore} | ${variantReport.metrics.candidateRepeatRate}% | ${variantReport.metrics.causalLinkCount} |`);
  }
  if (report.errors.length) lines.push("", "## Errors", "", ...report.errors.map((error) => `- ${error}`));
  return `${lines.join("\n")}\n`;
}

export function renderSimulationQualityMarkdown(report: SimulationQualityReport) {
  const lines = [
    "# Simulation Quality Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Passed: ${report.ok ? "yes" : "no"}`,
    `Seeds: ${report.seeds.join(", ")}`,
    `Gate: ${report.gate.tickCount} ticks, ${report.gate.minimumCaseCount} cases minimum`,
    "",
    "| Seed | Cases | Diversity | Repeat | Causal Links | Cross-case Influence | Runtime ms | Hash |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...report.reports.map((item) => `| ${item.summary.seed} | ${item.summary.caseCount} | ${item.metrics.candidateDiversityScore} | ${item.metrics.candidateRepeatRate}% | ${item.metrics.causalLinkCount} | ${crossCaseInfluenceCount(item)} | ${Math.round(item.performance.totalMs)} | ${item.metrics.deterministicRunHash} |`),
    "",
    "## Summary",
    "",
    `- Average runtime: ${report.summary.averageRuntimeMs} ms`,
    `- Average diversity: ${report.summary.averageCandidateDiversityScore}`,
    `- Average repeat rate: ${report.summary.averageCandidateRepeatRate}%`,
    `- Average causal links: ${report.summary.averageCausalLinkCount}`,
    `- Total cross-case influence: ${report.summary.totalCrossCaseInfluenceCount}`,
    "",
    "## Multi-Seed Stability",
    "",
    `- Passed seeds: ${report.summary.stability.passedSeedCount}`,
    `- Failed seeds: ${report.summary.stability.failedSeedCount}`,
    `- Worst repeat rate: ${report.summary.stability.worstCandidateRepeatRate}%`,
    `- Lowest case type count: ${report.summary.stability.lowestDistinctCaseTypeCount}`,
    `- Lowest selected action kind count: ${report.summary.stability.lowestSelectedActionKindCount}`,
    `- Highest largest action share: ${report.summary.stability.highestLargestSelectedActionShare}%`,
    `- Lowest institution decision count: ${report.summary.stability.lowestInstitutionDecisionCount}`,
    "",
    "| Seed | OK | Cases | Case Types | Repeat | Later Influence | Evidence Warnings | Action Kinds | Largest Action | Institutions | Runtime ms | Hash |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...report.summary.stability.perSeed.map((item) => `| ${item.seed} | ${item.ok ? "yes" : "no"} | ${item.caseCount} | ${item.distinctCaseTypeCount} | ${item.candidateRepeatRate}% | ${item.laterCaseInfluenceRate}% | ${item.evidenceGraphWarnings} | ${item.selectedActionKindCount} | ${item.largestSelectedActionShare}% | ${item.institutionDecisionCount} | ${item.runtimeMs} | ${item.deterministicRunHash} |`)
  ];
  if (report.errors.length) lines.push("", "## Errors", "", ...report.errors.map((error) => `- ${error}`));
  return `${lines.join("\n")}\n`;
}

export function renderStableWorldDiagnosticsMarkdown(report: StableWorldDiagnosticsReport) {
  const lines = [
    "# Stable World Diagnostics Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Passed: ${report.ok ? "yes" : "no"}`,
    `Overall status: ${report.overallStatus}`,
    "",
    "## Summary",
    "",
    `- Findings: ok ${report.findingCounts.ok}, watch ${report.findingCounts.watch}, risk ${report.findingCounts.risk}, blocker ${report.findingCounts.blocker}`,
    `- Slowest seed: ${report.slowestSeed || "n/a"}`,
    `- Largest action share seed: ${report.largestActionShareSeed || "n/a"}`,
    `- Lowest case type seed: ${report.lowestCaseTypeSeed || "n/a"}`,
    `- Lowest institution seed: ${report.lowestInstitutionSeed || "n/a"}`,
    "",
    "## Per-Seed Diagnostics",
    "",
    "| Seed | Status | OK | Watch | Risk | Blocker | Top action | Actor shares | Runtime ms | Top phases | Hash |",
    "| --- | --- | ---: | ---: | ---: | ---: | --- | --- | ---: | --- | --- |",
    ...report.seeds.map((seed) => `| ${seed.seed} | ${seed.status} | ${seed.findingCounts.ok} | ${seed.findingCounts.watch} | ${seed.findingCounts.risk} | ${seed.findingCounts.blocker} | ${seed.actionMix.topActionKind} ${seed.actionMix.topActionKindShare}% | ${seed.actorSpread.topActorShares.join("/") || "-"}% | ${seed.performance.runtimeMs} | ${seed.performance.topPhases.map((phase) => `${phase.phase} ${phase.share}%`).join(", ") || "-"} | ${seed.deterministicRunHash} |`),
    "",
    "## Top Risks",
    "",
    ...(report.topRisks.length
      ? report.topRisks.map((finding) => `- [${finding.severity}] ${finding.seed} / ${finding.dimension} / ${finding.metric}: ${finding.message} (${finding.actual} vs ${finding.target}). Next: ${finding.recommendedNextInspection}`)
      : ["- No blocker or risk findings."]),
    "",
    "## Findings",
    "",
    "| Seed | Severity | Dimension | Metric | Actual | Target | Message | Next inspection |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.seeds.flatMap((seed) => seed.findings.map((finding) =>
      `| ${finding.seed} | ${finding.severity} | ${finding.dimension} | ${finding.metric} | ${finding.actual} | ${finding.target} | ${finding.message} | ${finding.recommendedNextInspection} |`
    ))
  ];
  return `${lines.join("\n")}\n`;
}

export function renderStableWorldRegressionMarkdown(report: StableWorldRegressionReport) {
  const lines = [
    "# Stable World Regression Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Baseline available: ${report.baselineAvailable ? "yes" : "no"}`,
    `Passed: ${report.ok ? "yes" : "no"}`,
    `Overall status: ${report.overallStatus}`,
    "",
    "## Summary",
    "",
    `- Deltas: improved ${report.deltaCounts.improved}, unchanged ${report.deltaCounts.unchanged}, watch ${report.deltaCounts.watch}, regressed ${report.deltaCounts.regressed}, blocked ${report.deltaCounts.blocked}`,
    `- Per-seed status: ${Object.entries(report.perSeedStatus).map(([seed, status]) => `${seed}=${status}`).join(", ") || "n/a"}`,
    `- Runtime delta by seed: ${Object.entries(report.runtimeDeltaBySeed).map(([seed, delta]) => `${seed}=${delta}ms`).join(", ") || "n/a"}`,
    "",
    "## Top Regressions",
    "",
    ...(report.topRegressions.length
      ? report.topRegressions.map((delta) => `- [${delta.status}] ${delta.seed} / ${delta.metric}: ${delta.message} (${delta.previous} -> ${delta.current}, delta ${delta.delta}). Next: ${delta.recommendedNextInspection}`)
      : ["- No blocked or regressed deltas."]),
    "",
    "## Per-Seed Regression",
    "",
    "| Seed | Status | Improved | Unchanged | Watch | Regressed | Blocked | Runtime delta | Hash |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...report.seeds.map((seed) => `| ${seed.seed} | ${seed.status} | ${seed.deltaCounts.improved} | ${seed.deltaCounts.unchanged} | ${seed.deltaCounts.watch} | ${seed.deltaCounts.regressed} | ${seed.deltaCounts.blocked} | ${seed.runtimeDeltaMs} | ${seed.deterministicRunHash} |`),
    "",
    "## Deltas",
    "",
    "| Seed | Status | Metric | Previous | Current | Delta | Message | Next inspection |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.seeds.flatMap((seed) => seed.deltas.map((delta) =>
      `| ${delta.seed} | ${delta.status} | ${delta.metric} | ${delta.previous} | ${delta.current} | ${delta.delta} | ${delta.message} | ${delta.recommendedNextInspection} |`
    ))
  ];
  return `${lines.join("\n")}\n`;
}

export function renderStableWorldCaseQualityMarkdown(report: StableWorldCaseQualityReport) {
  const lines = [
    "# Stable World Case Quality Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Non-blocking: ${report.nonBlocking ? "yes" : "no"}`,
    `Overall status: ${report.overallStatus}`,
    `Average score: ${report.averageScore}`,
    `Lowest seed score: ${report.minScore}`,
    "",
    "## Dimension Averages",
    "",
    ...CASE_QUALITY_DIMENSIONS.map((dimension) => `- ${dimension}: avg ${report.dimensionAverages[dimension]}, min ${report.dimensionMinimums[dimension]}`),
    "",
    "## Per-Seed Quality",
    "",
    "| Seed | Status | Score | Cases | Solved | Case Types | Evidence Complete | Evidence Warnings | Later Influence | Institutions | Repeat | Hash |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...report.seeds.map((seed) => `| ${seed.seed} | ${seed.status} | ${seed.score} | ${seed.caseCount} | ${seed.solvedCaseCount} | ${seed.distinctCaseTypeCount} | ${seed.evidenceCompleteCaseCount} | ${seed.evidenceWarningCount} | ${seed.laterCaseInfluenceRate}% | ${seed.institutionDecisionCount} | ${seed.repeatRate}% | ${seed.deterministicRunHash} |`),
    "",
    "## Dimension Scores",
    "",
    "| Seed | Dimension | Score | Actual | Target | Message |",
    "| --- | --- | ---: | --- | --- | --- |",
    ...report.seeds.flatMap((seed) => seed.dimensions.map((dimension) =>
      `| ${seed.seed} | ${dimension.dimension} | ${dimension.score} | ${dimension.actual} | ${dimension.target} | ${dimension.message} |`
    ))
  ];
  return `${lines.join("\n")}\n`;
}

export function renderCampaignRunMarkdown(report: CampaignRunReport) {
  const lines = [
    "# Campaign Run Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Passed: ${report.ok ? "yes" : "no"}`,
    `Seed: ${report.seed}`,
    `Ticks: ${report.tickCount}`,
    `Cases: ${report.report.summary.caseCount}`,
    `Runtime: ${Math.round(report.report.performance.totalMs)} ms`,
    `Deterministic hash: ${report.report.metrics.deterministicRunHash}`,
    "",
    "## Quality",
    "",
    `- Diversity: ${report.report.metrics.candidateDiversityScore}`,
    `- Repeat rate: ${report.report.metrics.candidateRepeatRate}%`,
    `- Causal links: ${report.report.metrics.causalLinkCount}`,
    `- Cross-case influence: ${crossCaseInfluenceCount(report.report)}`,
    "",
    "## Stable Detective World Gate",
    "",
    `- Selected action kinds: ${report.report.metrics.worldStability.selectedActionKindCount}`,
    `- Largest selected action share: ${report.report.metrics.worldStability.largestSelectedActionShare}%`,
    `- Active actors: ${report.report.metrics.worldStability.activeActorCount}`,
    `- Largest actor share: ${report.report.metrics.worldStability.largestActorShare}%`,
    `- Institution decisions: ${report.report.metrics.worldStability.institutionDecisionCount}`,
    `- Evidence complete cases: ${report.report.metrics.worldStability.evidenceCompleteCaseCount}`
  ];
  if (report.errors.length) lines.push("", "## Errors", "", ...report.errors.map((error) => `- ${error}`));
  return `${lines.join("\n")}\n`;
}
