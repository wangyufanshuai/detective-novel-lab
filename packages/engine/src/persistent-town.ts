import { extractCaseFromWorld, validateWorldCase } from "./world-case";
import { computeSocialPressures, simulateDailyLife, simulateWorldTick } from "./world-simulator";
import type { CaseFromLog, MemoryKind, MemoryRecord, MurderArchetype, NPCProfile, SocialPressure, WorldEvent, WorldMode, WorldState } from "./world-types";

export type PersistentTownRuntimeStatus = "paused" | "running" | "completed" | "blocked";

export type NpcActionKind =
  | "move"
  | "observe"
  | "talk"
  | "confront"
  | "obtain-resource"
  | "hide-trace"
  | "investigate"
  | "spread-rumor"
  | "seek-alibi"
  | "pressure"
  | "cover-up";

export type CaseChainStage = "motive" | "means" | "opportunity" | "cover-up" | "memory" | "exclusion";
export type TownTickPhaseName =
  | "observe"
  | "update-goals"
  | "score-actions"
  | "execute-actions"
  | "observe-events"
  | "propagate-memory"
  | "apply-consequences"
  | "advance-case-chain"
  | "trigger-case"
  | "extract-candidates"
  | "finalize";

export type TownObservationKind = "direct" | "same-location" | "rumor" | "deduced" | "alibi" | "exclusion";

export type NpcActionScore = {
  goalPriority: number;
  knownInformation: number;
  relationshipPressure: number;
  resourceAvailability: number;
  locationReachability: number;
  risk: number;
  evidenceConsistency: number;
  caseImpact: number;
  witnessExposure?: number;
  rumorValue?: number;
  alibiPressure?: number;
  coverUpUrgency?: number;
  socialAffinity?: number;
  locationHeat?: number;
  institutionalPressure?: number;
  resourceFlow?: number;
  directorBias?: number;
  total: number;
  reasons: string[];
};

export type NpcActionCandidate = {
  id: string;
  npcId: string;
  kind: NpcActionKind;
  targetLocationId: string;
  targetNpcId?: string;
  resourceId?: string;
  description: string;
  legal: boolean;
  blockedReason?: string;
  score: NpcActionScore;
};

export type TownActionDefinition = {
  kind: NpcActionKind;
  chainStage?: AgentConsequenceSummary["chainStage"];
  expectedObservationKind: TownObservationKind;
  buildCandidate: (input: TownActionBuildInput) => Omit<NpcActionCandidate, "score">;
  canStart: (input: TownActionLegalityInput) => { legal: boolean; reason?: string };
  score: typeof scoreCandidate;
  execute: (input: TownActionExecuteInput) => WorldEvent;
};

export type NpcAgentState = {
  npcId: string;
  currentGoal: string;
  goalPriority: number;
  currentPlan: string[];
  knownFactIds: string[];
  relationshipPressure: number;
  secretRisk: number;
  resources: string[];
  locationId: string;
  fatigue: number;
  alertness: number;
  lastDecisionId?: string;
  nextActionPreview?: string;
  propagatedMemoryCount?: number;
  lastConsequence?: string;
  socialProfile?: {
    reputation: number;
    suspicion: number;
    rumorCredibility: number;
    dominantTrait: keyof TownSocialTraits;
    trustedNpcIds: string[];
  };
};

export type AgentDecisionTrace = {
  id: string;
  tick: number;
  day: number;
  time: string;
  npcId: string;
  observedEventIds: string[];
  memoryIds: string[];
  candidates: NpcActionCandidate[];
  selectedCandidateId: string;
  createdEventId?: string;
  interventionId?: string;
  phases?: string[];
  propagatedMemoryIds?: string[];
  consequence?: AgentConsequenceSummary;
  observationIds?: string[];
};

export type CaseCandidateValidation = {
  valid: boolean;
  hardLogicValid: boolean;
  uniqueCulprit: boolean;
  worldBackedEvidence: boolean;
  memoryScopedTestimony: boolean;
  nonCulpritExcluded: boolean;
  timelineClosed: boolean;
  chainStages?: string[];
  chainCompleteness?: Record<CaseChainStage, boolean>;
  memoryConfidence?: {
    direct: number;
    deduced: number;
    rumor: number;
    supportScore: number;
  };
  observationSupport?: {
    direct: number;
    deduced: number;
    rumor: number;
    sameLocation: number;
    supportScore: number;
    observationIds: string[];
  };
  failureReasons?: string[];
  errors: string[];
  warnings: string[];
};

export type CaseCandidate = {
  id: string;
  worldId: string;
  tick: number;
  status: "forming" | "valid" | "invalid" | "extracted";
  culpritId: string;
  victimId: string;
  pressureScore: number;
  riskChainEventIds: string[];
  memoryIds: string[];
  goalIds: string[];
  chainStageTags?: string[];
  maturityScore?: number;
  triggeredEventId?: string;
  chainCompleteness?: Record<CaseChainStage, boolean>;
  motiveGap?: string;
  meansGap?: string;
  exclusionGap?: string;
  timelineGap?: string;
  validation: CaseCandidateValidation;
  caseId?: string;
};

export type PersistentCaseExtractionView = {
  world: WorldState;
  events: WorldEvent[];
  sourceMap: {
    triggeredEventId: string;
    sourceCandidateId: string;
    sourceEventIds: string[];
    evidenceSourceEventIds: Record<string, string[]>;
    extractionEventSourceIds: Record<string, string[]>;
    chainStageSourceEventIds: Record<CaseChainStage, string[]>;
    memorySourceIds: string[];
    observationSourceIds: string[];
  };
};

export type TownEventObservation = {
  id: string;
  tick: number;
  eventId: string;
  observerNpcId: string;
  subjectNpcId?: string;
  sourceNpcId?: string;
  kind: TownObservationKind;
  confidence: number;
  visibleToPlayer: boolean;
  memoryId?: string;
  chainStage?: CaseChainStage | "context";
};

export type TownSocialTraits = {
  caution: number;
  curiosity: number;
  aggression: number;
  empathy: number;
  ambition: number;
  loyalty: number;
};

export type TownSocialProfile = {
  npcId: string;
  traits: TownSocialTraits;
  reputation: number;
  suspicion: number;
  rumorCredibility: number;
  trust: Record<string, number>;
  preferredActionKinds: NpcActionKind[];
  updatedAtTick: number;
};

export type TownRelationshipLedgerEntry = {
  tick: number;
  actorId: string;
  targetNpcId?: string;
  eventId: string;
  actionKind: NpcActionKind;
  trustDelta: number;
  reputationDelta: number;
  suspicionDelta: number;
  reason: string;
};

export type TownLocationProfile = {
  locationId: string;
  heat: number;
  security: number;
  footTraffic: number;
  resourcePressure: number;
  factionInfluence: "civic" | "commerce" | "medical" | "culture" | "underground" | "neutral";
  updatedAtTick: number;
};

export type TownLocationLedgerEntry = {
  tick: number;
  locationId: string;
  eventId: string;
  actionKind: NpcActionKind;
  heatDelta: number;
  securityDelta: number;
  resourcePressureDelta: number;
  reason: string;
};

type TownActionBuildInput = {
  world: WorldState;
  npc: NPCProfile;
  state: NpcAgentState;
  runtime?: PersistentTownRuntime | null;
  events: WorldEvent[];
  locations: Array<{ id: string }>;
  targetNpcId?: string;
  targetNpc?: NPCProfile;
  targetLocationId: string;
};

type TownActionLegalityInput = TownActionBuildInput & {
  candidate: Omit<NpcActionCandidate, "score">;
};

type TownActionExecuteInput = {
  world: RuntimeWorld;
  runtime: PersistentTownRuntime;
  npc: NPCProfile;
  candidate: NpcActionCandidate;
  intervention?: TownRuntimeIntervention;
  allEvents: WorldEvent[];
};

type TownTickContext = {
  world: RuntimeWorld;
  baseEvents: WorldEvent[];
  runtime: PersistentTownRuntime;
  allEvents: WorldEvent[];
  createdEvents: WorldEvent[];
  createdMemories: MemoryRecord[];
  createdObservations: TownEventObservation[];
  createdConsequences: AgentConsequenceSummary[];
  decisionIds: string[];
  phases: TownTickPhaseName[];
};

export type TownRuntimeIntervention = {
  id: string;
  tick: number;
  actorId: string;
  kind: "goal" | "location" | "resource" | "relationship-pressure" | "knowledge" | "action-bias";
  value: string | number | boolean;
  createdAt: string;
  branch: "counterfactual";
  impact: string;
};

export type TownPressureLedgerEntry = {
  tick: number;
  npcId: string;
  targetNpcId: string;
  score: number;
  sourceEventIds: string[];
  reason: string;
};

export type TownMemoryPropagation = {
  id: string;
  tick: number;
  eventId: string;
  observationId?: string;
  fromNpcId?: string;
  toNpcId: string;
  kind: "witness" | "rumor" | "deduced";
  source: "same-location" | "conversation" | "action";
  confidence: number;
};

export type AgentConsequenceSummary = {
  id: string;
  tick: number;
  npcId: string;
  actionKind: NpcActionKind;
  eventId: string;
  memoryIds: string[];
  relationshipPressureDelta: number;
  secretRiskDelta: number;
  fatigueDelta: number;
  alertnessDelta: number;
  knownFactDelta: number;
  resourceDelta?: string;
  chainStage?: "motive" | "means" | "opportunity" | "cover-up" | "alibi" | "memory";
  relationshipShift?: {
    targetNpcId?: string;
    before: number;
    after: number;
  };
  socialShift?: {
    reputationDelta: number;
    suspicionDelta: number;
    trustDelta: number;
    targetNpcId?: string;
  };
  rumorConfidenceDelta?: number;
  triggeredCaseId?: string;
};

export type TownLongChainLedgerEntry = {
  id: string;
  tick: number;
  culpritId: string;
  victimId: string;
  pressureScore: number;
  stageEventIds: Record<CaseChainStage, string[]>;
  memoryConfidence: CaseCandidateValidation["memoryConfidence"];
  maturityScore: number;
  complete: boolean;
  triggeredEventId?: string;
};

export type TownTriggeredCaseRecord = {
  id: string;
  tick: number;
  culpritId: string;
  victimId: string;
  eventId: string;
  causedByEventIds: string[];
  maturityScore: number;
  chainCompleteness: Record<CaseChainStage, boolean>;
};

export type PersistentTownRuntimeReport = {
  tick: number;
  status: PersistentTownRuntimeStatus;
  eventIds: string[];
  decisionIds: string[];
  candidateIds: string[];
  blockedReason?: string;
};

export type PersistentTownRuntime = {
  id: string;
  worldId: string;
  status: PersistentTownRuntimeStatus;
  currentDay: number;
  currentTime: string;
  tickIntervalMinutes: number;
  maxTicks: number;
  tick: number;
  agentStates: NpcAgentState[];
  decisionTraces: AgentDecisionTrace[];
  candidates: CaseCandidate[];
  interventions: TownRuntimeIntervention[];
  reports: PersistentTownRuntimeReport[];
  pressureLedger?: TownPressureLedgerEntry[];
  eventObservations?: TownEventObservation[];
  socialProfiles?: TownSocialProfile[];
  relationshipLedger?: TownRelationshipLedgerEntry[];
  locationProfiles?: TownLocationProfile[];
  locationLedger?: TownLocationLedgerEntry[];
  memoryPropagations?: TownMemoryPropagation[];
  consequences?: AgentConsequenceSummary[];
  longChainLedger?: TownLongChainLedgerEntry[];
  triggeredCases?: TownTriggeredCaseRecord[];
  simulationPhases?: TownTickPhaseName[];
  scenarioRuns?: ScenarioRun[];
  snapshots?: TownStateSnapshot[];
  createdAt: string;
  updatedAt: string;
};

export type TownEmergenceQueue = {
  runtimeId: string;
  worldId: string;
  status: PersistentTownRuntimeStatus;
  candidates: CaseCandidate[];
  validCount: number;
  blockedCount: number;
  nextAction: string;
};

export type TownSituationBrief = {
  worldId: string;
  runtimeId: string;
  tick: number;
  status: PersistentTownRuntimeStatus;
  currentPhase: TownTickPhaseName;
  urgency: "stable" | "elevated" | "critical";
  headline: string;
  nextAction: string;
  hotLocations: Array<{
    locationId: string;
    name: string;
    score: number;
    heat: number;
    security: number;
    footTraffic: number;
    resourcePressure: number;
    factionInfluence: TownLocationProfile["factionInfluence"];
  }>;
  riskAgents: Array<{
    npcId: string;
    name: string;
    score: number;
    relationshipPressure: number;
    secretRisk: number;
    alertness: number;
    suspicion: number;
    locationId: string;
  }>;
  actionMix: Array<{ kind: NpcActionKind; count: number }>;
  observationMix: Record<TownObservationKind, number>;
  caseReadiness: {
    candidateCount: number;
    validCount: number;
    triggeredCaseCount: number;
    highestMaturityScore: number;
    strongestCandidateId?: string;
  };
  recentSignals: Array<{
    kind: "case" | "location" | "agent" | "observation";
    label: string;
    detail: string;
  }>;
};

export type ScenarioWorldOptions = {
  mode?: WorldMode;
  npcCount?: number;
  timelineHours?: number;
  preSimDays?: number;
  caseArchetype?: MurderArchetype | "auto";
};

export type ScenarioPassCriteria = {
  minValidCandidates?: number;
  requireHardLogic?: boolean;
  maxBlockedCandidates?: number;
  minEventGrowth?: number;
  minMemoryGrowth?: number;
};

export type ScenarioScheduledIntervention = {
  atTickOffset: number;
  intervention: Omit<TownRuntimeIntervention, "id" | "tick" | "createdAt" | "branch" | "impact">;
};

export type ScenarioBranchConfig = {
  id: string;
  name: string;
  steps?: number;
  interventions: ScenarioScheduledIntervention[];
};

export type ScenarioConfig = {
  id?: string;
  name?: string;
  seed?: string;
  worldOptions?: ScenarioWorldOptions;
  baselineSteps?: number;
  branches?: ScenarioBranchConfig[];
  passCriteria?: ScenarioPassCriteria;
};

export type TownStateSnapshotAgent = Pick<NpcAgentState, "npcId" | "currentGoal" | "knownFactIds" | "resources" | "locationId" | "relationshipPressure" | "secretRisk" | "fatigue" | "alertness" | "socialProfile">;

export type TownStateSnapshotCandidate = Pick<CaseCandidate, "id" | "status" | "culpritId" | "victimId" | "pressureScore"> & {
  valid: boolean;
  errorCount: number;
  maturityScore?: number;
  triggeredEventId?: string;
  chainCompleteness?: Record<CaseChainStage, boolean>;
};

export type TownStateSnapshotLocation = Pick<TownLocationProfile, "locationId" | "heat" | "security" | "footTraffic" | "resourcePressure" | "factionInfluence">;

export type TownStateSnapshot = {
  id: string;
  worldId: string;
  runtimeId: string;
  scenarioId?: string;
  branchId?: string;
  label: string;
  tick: number;
  day: number;
  time: string;
  agentStates: TownStateSnapshotAgent[];
  locationProfiles?: TownStateSnapshotLocation[];
  decisionCount: number;
  candidateSummaries: TownStateSnapshotCandidate[];
  eventIds: string[];
  memoryIds: string[];
  observationIds: string[];
  interventionIds: string[];
  createdAt: string;
  checkpoint?: {
    world: WorldState;
    runtime: Omit<PersistentTownRuntime, "snapshots" | "scenarioRuns">;
  };
};

export type TownStateAgentDiff = {
  npcId: string;
  before?: TownStateSnapshotAgent;
  after?: TownStateSnapshotAgent;
  changedFields: Array<"locationId" | "resources" | "relationshipPressure" | "knownFactIds" | "currentGoal" | "secretRisk" | "fatigue" | "alertness" | "socialProfile">;
};

export type TownStateLocationDiff = {
  locationId: string;
  before?: TownStateSnapshotLocation;
  after?: TownStateSnapshotLocation;
  changedFields: Array<"heat" | "security" | "footTraffic" | "resourcePressure" | "factionInfluence">;
};

export type TownStateCandidateDiff = {
  candidateId: string;
  beforeStatus?: CaseCandidate["status"];
  afterStatus?: CaseCandidate["status"];
  beforeValid?: boolean;
  afterValid?: boolean;
};

export type TownStateDiff = {
  id: string;
  worldId: string;
  fromSnapshotId: string;
  toSnapshotId: string;
  tickDelta: number;
  timeDeltaMinutes: number;
  addedEventIds: string[];
  addedMemoryIds: string[];
  addedObservationIds: string[];
  changedAgents: TownStateAgentDiff[];
  changedLocations?: TownStateLocationDiff[];
  candidateStatusChanges: TownStateCandidateDiff[];
  branchOnlyInterventionIds: string[];
};

export type ScenarioBranchRun = {
  id: string;
  name: string;
  status: "completed" | "blocked";
  steps: number;
  interventionIds: string[];
  eventGrowth: number;
  memoryGrowth: number;
  validCandidateCount: number;
  blockedCandidateCount: number;
  startSnapshotId: string;
  endSnapshotId: string;
  diffFromBaseline: TownStateDiff;
};

export type ScenarioReportCheck = {
  id: keyof Required<ScenarioPassCriteria>;
  label: string;
  passed: boolean;
  actual: number | boolean;
  expected: number | boolean;
};

export type ScenarioReport = {
  scenarioId: string;
  name: string;
  passed: boolean;
  checks: ScenarioReportCheck[];
  baseline: {
    steps: number;
    eventGrowth: number;
    memoryGrowth: number;
    validCandidateCount: number;
    blockedCandidateCount: number;
    hardLogicPassCount: number;
    startSnapshotId: string;
    endSnapshotId: string;
  };
  branches: ScenarioBranchRun[];
  summary: string;
};

export type ScenarioRun = {
  id: string;
  name: string;
  config: ScenarioConfig;
  status: "passed" | "failed";
  baselineSnapshotId: string;
  finalSnapshotId: string;
  report: ScenarioReport;
  startedAt: string;
  completedAt: string;
};

type RuntimeWorld = WorldState & { persistentRuntime?: PersistentTownRuntime };

function hashSeed(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeRandom(seed: string) {
  let state = hashSeed(seed) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function minutesToTime(minutes: number) {
  const wrapped = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${pad(Math.floor(wrapped / 60))}:${pad(wrapped % 60)}`;
}

function clamp(value: number, min = 0, max = 10) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function dominantTrait(traits: TownSocialTraits): keyof TownSocialTraits {
  return (Object.entries(traits) as Array<[keyof TownSocialTraits, number]>)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || "curiosity";
}

function relationshipTrustValue(relation?: NPCProfile["relationships"][string]) {
  if (relation === "friend" || relation === "family") return 8;
  if (relation === "debt") return 5;
  if (relation === "secret") return 3;
  if (relation === "rival") return 2;
  return 5;
}

function preferredActionsForTraits(traits: TownSocialTraits): NpcActionKind[] {
  const ranked: Array<[NpcActionKind, number]> = [
    ["investigate", traits.curiosity + traits.caution * 0.35],
    ["spread-rumor", traits.ambition + (10 - traits.empathy) * 0.45],
    ["seek-alibi", traits.caution + traits.loyalty * 0.25],
    ["pressure", traits.aggression + traits.ambition * 0.5],
    ["cover-up", traits.caution + traits.ambition * 0.4],
    ["talk", traits.empathy + traits.loyalty * 0.45],
    ["obtain-resource", traits.ambition + traits.curiosity * 0.35],
    ["observe", traits.curiosity + traits.empathy * 0.2]
  ];
  return ranked.sort((a, b) => b[1] - a[1]).slice(0, 4).map(([kind]) => kind);
}

function createTownSocialProfile(world: WorldState, npc: NPCProfile, tick = 0): TownSocialProfile {
  const random = makeRandom(`${world.seed}:social:${npc.id}`);
  const trait = () => 2 + Math.floor(random() * 8);
  const traits: TownSocialTraits = {
    caution: trait(),
    curiosity: trait(),
    aggression: trait(),
    empathy: trait(),
    ambition: trait(),
    loyalty: trait()
  };
  const trust = Object.fromEntries(Object.entries(npc.relationships).map(([npcId, relation]) => [npcId, relationshipTrustValue(relation)]));
  const reputation = clamp(4 + traits.empathy * 0.35 + traits.loyalty * 0.25 - traits.aggression * 0.15);
  const suspicion = clamp(2 + traits.ambition * 0.35 + traits.aggression * 0.25 - traits.empathy * 0.2);
  return {
    npcId: npc.id,
    traits,
    reputation,
    suspicion,
    rumorCredibility: clamp01(0.35 + traits.empathy * 0.035 + reputation * 0.025 - suspicion * 0.015),
    trust,
    preferredActionKinds: preferredActionsForTraits(traits),
    updatedAtTick: tick
  };
}

function ensureSocialProfiles(world: WorldState, runtime: PersistentTownRuntime) {
  runtime.socialProfiles ||= [];
  const existing = new Map(runtime.socialProfiles.map((profile) => [profile.npcId, profile]));
  runtime.socialProfiles = world.npcs.map((npc) => existing.get(npc.id) || createTownSocialProfile(world, npc, runtime.tick));
  return runtime.socialProfiles;
}

function socialProfileFor(world: WorldState, npcId: string, runtime?: PersistentTownRuntime | null) {
  if (!runtime) return null;
  return runtime.socialProfiles?.find((profile) => profile.npcId === npcId) ||
    createTownSocialProfile(world, world.npcs.find((npc) => npc.id === npcId) || world.npcs[0], runtime.tick);
}

function socialAffinityForAction(world: WorldState, npc: NPCProfile, candidate: Omit<NpcActionCandidate, "score">, runtime?: PersistentTownRuntime | null) {
  const profile = socialProfileFor(world, npc.id, runtime);
  if (!profile) return 5;
  const trust = candidate.targetNpcId ? profile.trust[candidate.targetNpcId] ?? relationshipTrustValue(npc.relationships[candidate.targetNpcId]) : 5;
  const traits = profile.traits;
  const value =
    candidate.kind === "investigate" ? traits.curiosity + profile.suspicion * 0.25 :
    candidate.kind === "observe" ? traits.curiosity + traits.caution * 0.25 :
    candidate.kind === "talk" ? traits.empathy + traits.loyalty * 0.35 + trust * 0.2 :
    candidate.kind === "spread-rumor" ? profile.rumorCredibility * 10 + traits.ambition * 0.3 - traits.empathy * 0.15 :
    candidate.kind === "seek-alibi" ? traits.caution + profile.suspicion * 0.25 :
    candidate.kind === "pressure" || candidate.kind === "confront" ? traits.aggression + traits.ambition * 0.35 + (10 - trust) * 0.2 :
    candidate.kind === "cover-up" || candidate.kind === "hide-trace" ? traits.caution + traits.ambition * 0.25 + profile.suspicion * 0.2 :
    candidate.kind === "obtain-resource" ? traits.ambition + traits.curiosity * 0.3 :
    5;
  return clamp(Math.round(value));
}

function rumorConfidenceFromSocial(world: WorldState, runtime: PersistentTownRuntime, sourceNpcId: string, targetNpcId: string) {
  const source = socialProfileFor(world, sourceNpcId, runtime);
  const target = socialProfileFor(world, targetNpcId, runtime);
  const trust = target?.trust[sourceNpcId] ?? 5;
  const sourceCredibility = source?.rumorCredibility ?? 0.56;
  return clamp01(0.28 + sourceCredibility * 0.38 + trust * 0.025);
}

function updateSocialAfterAction(world: RuntimeWorld, runtime: PersistentTownRuntime, actorId: string, candidate: NpcActionCandidate, event: WorldEvent) {
  ensureSocialProfiles(world, runtime);
  const profile = runtime.socialProfiles?.find((item) => item.npcId === actorId);
  if (!profile) return;
  const targetNpcId = candidate.targetNpcId;
  const suspicionDelta =
    candidate.kind === "cover-up" || candidate.kind === "hide-trace" ? 1.4 :
    candidate.kind === "pressure" || candidate.kind === "confront" ? 1.1 :
    candidate.kind === "spread-rumor" ? 0.7 :
    candidate.kind === "investigate" ? -0.4 :
    candidate.kind === "talk" ? -0.2 :
    0;
  const reputationDelta =
    candidate.kind === "talk" || candidate.kind === "seek-alibi" ? 0.4 :
    candidate.kind === "pressure" || candidate.kind === "confront" ? -0.8 :
    candidate.kind === "cover-up" || candidate.kind === "hide-trace" ? -0.5 :
    candidate.kind === "investigate" ? 0.2 :
    0;
  const trustDelta =
    candidate.kind === "talk" || candidate.kind === "seek-alibi" ? 1 :
    candidate.kind === "pressure" || candidate.kind === "confront" ? -2 :
    candidate.kind === "spread-rumor" || candidate.kind === "cover-up" ? -1 :
    0;
  const nextProfile: TownSocialProfile = {
    ...profile,
    reputation: clamp(profile.reputation + reputationDelta),
    suspicion: clamp(profile.suspicion + suspicionDelta),
    rumorCredibility: clamp01(profile.rumorCredibility + reputationDelta * 0.015 - suspicionDelta * 0.01),
    trust: targetNpcId ? { ...profile.trust, [targetNpcId]: clamp((profile.trust[targetNpcId] ?? relationshipTrustValue(world.npcs.find((npc) => npc.id === actorId)?.relationships[targetNpcId])) + trustDelta) } : profile.trust,
    updatedAtTick: runtime.tick
  };
  runtime.socialProfiles = (runtime.socialProfiles || []).map((item) => item.npcId === actorId ? nextProfile : item);
  runtime.relationshipLedger ||= [];
  runtime.relationshipLedger.push({
    tick: runtime.tick,
    actorId,
    targetNpcId,
    eventId: event.id,
    actionKind: candidate.kind,
    trustDelta,
    reputationDelta,
    suspicionDelta,
    reason: `${candidate.kind} changed trust ${trustDelta}, reputation ${reputationDelta}, suspicion ${suspicionDelta}`
  });
  runtime.relationshipLedger = runtime.relationshipLedger.slice(-240);
}

function factionForLocation(locationId: string, kind: WorldState["locations"][number]["kind"]): TownLocationProfile["factionInfluence"] {
  if (locationId.includes("clinic")) return "medical";
  if (locationId.includes("market") || locationId.includes("inn")) return "commerce";
  if (locationId.includes("theater") || locationId.includes("archive")) return "culture";
  if (kind === "restricted" || locationId.includes("clocktower")) return "civic";
  if (kind === "crime" || locationId.includes("lake")) return "underground";
  return "neutral";
}

function createTownLocationProfile(location: WorldState["locations"][number], tick = 0): TownLocationProfile {
  const publicBase = location.kind === "public" ? 6 : location.kind === "work" ? 5 : location.kind === "restricted" ? 3 : location.kind === "crime" ? 2 : 1;
  const securityBase = location.kind === "restricted" ? 7 : location.kind === "work" ? 5 : location.kind === "crime" ? 3 : 2;
  const resourceBase = location.kind === "restricted" || location.kind === "work" ? 5 : location.kind === "public" ? 3 : 2;
  return {
    locationId: location.id,
    heat: location.kind === "crime" ? 5 : 2,
    security: securityBase,
    footTraffic: publicBase,
    resourcePressure: resourceBase,
    factionInfluence: factionForLocation(location.id, location.kind),
    updatedAtTick: tick
  };
}

function ensureLocationProfiles(world: WorldState, runtime: PersistentTownRuntime) {
  runtime.locationProfiles ||= [];
  const existing = new Map(runtime.locationProfiles.map((profile) => [profile.locationId, profile]));
  runtime.locationProfiles = world.locations.map((location) => existing.get(location.id) || createTownLocationProfile(location, runtime.tick));
  return runtime.locationProfiles;
}

function locationProfileFor(world: WorldState, locationId: string, runtime?: PersistentTownRuntime | null) {
  const location = world.locations.find((item) => item.id === locationId) || world.locations[0];
  if (!location) return null;
  return runtime?.locationProfiles?.find((profile) => profile.locationId === locationId) || createTownLocationProfile(location, runtime?.tick || 0);
}

function locationPressureForAction(world: WorldState, candidate: Omit<NpcActionCandidate, "score">, runtime?: PersistentTownRuntime | null) {
  const profile = locationProfileFor(world, candidate.targetLocationId, runtime);
  if (!profile) return { locationHeat: 0, institutionalPressure: 0, resourceFlow: 0 };
  const locationHeat =
    candidate.kind === "investigate" || candidate.kind === "observe" ? Math.ceil(profile.heat + profile.footTraffic / 2) :
    candidate.kind === "spread-rumor" || candidate.kind === "talk" ? Math.ceil(profile.footTraffic + profile.heat / 3) :
    candidate.kind === "cover-up" || candidate.kind === "hide-trace" ? Math.ceil(profile.heat + profile.security / 2) :
    candidate.kind === "seek-alibi" ? Math.ceil(profile.footTraffic + profile.security / 3) :
    profile.heat;
  const institutionalPressure =
    candidate.kind === "pressure" || candidate.kind === "confront" ? Math.ceil(profile.heat + profile.security / 2) :
    candidate.kind === "cover-up" || candidate.kind === "hide-trace" ? profile.security :
    candidate.kind === "investigate" ? Math.ceil(profile.security / 2) :
    0;
  const resourceFlow = candidate.kind === "obtain-resource" ? Math.ceil(profile.resourcePressure + profile.security / 3) : profile.resourcePressure;
  return {
    locationHeat: clamp(locationHeat),
    institutionalPressure: clamp(institutionalPressure),
    resourceFlow: clamp(resourceFlow)
  };
}

function decayLocationProfiles(world: WorldState, runtime: PersistentTownRuntime) {
  ensureLocationProfiles(world, runtime);
  runtime.locationProfiles = (runtime.locationProfiles || []).map((profile) => ({
    ...profile,
    heat: clamp(profile.heat - 0.1),
    security: clamp(profile.security - 0.05),
    resourcePressure: clamp(profile.resourcePressure - 0.05),
    updatedAtTick: runtime.tick
  }));
}

function updateLocationAfterAction(world: RuntimeWorld, runtime: PersistentTownRuntime, candidate: NpcActionCandidate, event: WorldEvent) {
  ensureLocationProfiles(world, runtime);
  const profile = locationProfileFor(world, event.locationId, runtime);
  if (!profile) return;
  const heatDelta =
    candidate.kind === "pressure" || candidate.kind === "confront" ? 1.3 :
    candidate.kind === "spread-rumor" ? 1 :
    candidate.kind === "investigate" || candidate.kind === "observe" ? 0.6 :
    candidate.kind === "cover-up" || candidate.kind === "hide-trace" ? 0.8 :
    candidate.kind === "seek-alibi" ? 0.3 :
    0.1;
  const securityDelta =
    candidate.kind === "cover-up" || candidate.kind === "hide-trace" ? 0.8 :
    candidate.kind === "pressure" || candidate.kind === "confront" ? 0.5 :
    candidate.kind === "investigate" ? 0.3 :
    0;
  const resourcePressureDelta = candidate.kind === "obtain-resource" ? 1.2 : candidate.kind === "cover-up" ? 0.2 : 0;
  const nextProfile: TownLocationProfile = {
    ...profile,
    heat: clamp(profile.heat + heatDelta),
    security: clamp(profile.security + securityDelta),
    footTraffic: clamp(profile.footTraffic + (candidate.kind === "spread-rumor" || candidate.kind === "seek-alibi" ? 0.3 : 0)),
    resourcePressure: clamp(profile.resourcePressure + resourcePressureDelta),
    updatedAtTick: runtime.tick
  };
  runtime.locationProfiles = (runtime.locationProfiles || []).map((item) => item.locationId === profile.locationId ? nextProfile : item);
  runtime.locationLedger ||= [];
  runtime.locationLedger.push({
    tick: runtime.tick,
    locationId: profile.locationId,
    eventId: event.id,
    actionKind: candidate.kind,
    heatDelta,
    securityDelta,
    resourcePressureDelta,
    reason: `${candidate.kind} changed heat ${heatDelta}, security ${securityDelta}, resources ${resourcePressureDelta}`
  });
  runtime.locationLedger = runtime.locationLedger.slice(-240);
}

const TOWN_TICK_PHASES: TownTickPhaseName[] = [
  "observe",
  "update-goals",
  "score-actions",
  "execute-actions",
  "observe-events",
  "propagate-memory",
  "apply-consequences",
  "advance-case-chain",
  "trigger-case",
  "extract-candidates",
  "finalize"
];

function getRuntime(world: RuntimeWorld) {
  return world.persistentRuntime || null;
}

function cloneWorld(world: WorldState): RuntimeWorld {
  return JSON.parse(JSON.stringify(world)) as RuntimeWorld;
}

function locationReachable(world: WorldState, from: string, to: string) {
  if (from === to) return true;
  const source = world.locations.find((location) => location.id === from);
  return Boolean(source?.connectedLocationIds.includes(to));
}

function locationForNpc(npc: NPCProfile, time: string) {
  const exact = npc.schedule[time];
  if (exact) return exact;
  const timeValue = timeToMinutes(time);
  const sorted = Object.entries(npc.schedule)
    .map(([scheduleTime, locationId]) => ({ time: scheduleTime, value: timeToMinutes(scheduleTime), locationId }))
    .sort((a, b) => a.value - b.value);
  return [...sorted].reverse().find((item) => item.value <= timeValue)?.locationId || sorted[0]?.locationId || npc.homeLocationId;
}

function runtimeLocationForNpc(world: WorldState, npc: NPCProfile, runtime?: PersistentTownRuntime | null) {
  return runtime?.agentStates.find((state) => state.npcId === npc.id)?.locationId || locationForNpc(npc, runtime?.currentTime || world.currentTime || "08:00");
}

function relationshipRisk(npc: NPCProfile) {
  return Object.values(npc.relationships).reduce((sum, relation) => sum + (relation === "debt" ? 3 : relation === "rival" ? 2 : relation === "secret" ? 3 : 0), 0);
}

function pressureForNpc(pressures: SocialPressure[], npcId: string) {
  return pressures.filter((pressure) => pressure.npcId === npcId).reduce((sum, pressure) => sum + pressure.score, 0);
}

export function deriveNpcAgentState(world: WorldState, npc: NPCProfile, events: WorldEvent[] = [], runtime?: PersistentTownRuntime | null): NpcAgentState {
  const pressures = computeSocialPressures(world, events);
  const remembered = (world.memories || []).filter((memory) => memory.npcId === npc.id);
  const currentTime = runtime?.currentTime || world.currentTime || "08:00";
  const existing = runtime?.agentStates.find((state) => state.npcId === npc.id);
  const pressure = pressureForNpc(pressures, npc.id) || relationshipRisk(npc);
  const secretRisk = remembered.filter((memory) => memory.kind === "secret" || memory.kind === "rumor").length + Math.min(8, pressure);
  const locationId = existing?.locationId || locationForNpc(npc, currentTime);
  const resources = existing?.resources?.length ? existing.resources : npc.skills.map((skill) => `skill:${skill}`);
  const recentConsequence = runtime?.consequences?.find((item) => item.npcId === npc.id);
  const currentGoal = existing?.currentGoal || (secretRisk >= 8 ? "Protect secret before it becomes public" : pressure >= 6 ? "Reduce relationship pressure" : "Follow daily schedule");
  const social = socialProfileFor(world, npc.id, runtime);
  return {
    npcId: npc.id,
    currentGoal,
    goalPriority: Math.min(10, 3 + Math.ceil(secretRisk / 2) + Math.ceil(pressure / 4)),
    currentPlan: existing?.currentPlan?.length
      ? existing.currentPlan
      : [
          `Move through ${locationId}`,
          secretRisk >= 8 ? "avoid witnesses" : "observe public events",
          pressure >= 6 ? "resolve pressure source" : "preserve routine"
        ],
    knownFactIds: Array.from(new Set([...remembered.map((memory) => memory.eventId), ...(existing?.knownFactIds || [])])).slice(-20),
    relationshipPressure: pressure,
    secretRisk,
    resources,
    locationId,
    fatigue: Math.min(10, existing?.fatigue ?? Math.floor(events.filter((event) => event.actorIds.includes(npc.id)).length / 3)),
    alertness: Math.max(1, Math.min(10, existing?.alertness ?? 5 + Math.ceil(secretRisk / 3))),
    lastDecisionId: existing?.lastDecisionId,
    nextActionPreview: existing?.nextActionPreview,
    propagatedMemoryCount: runtime?.memoryPropagations?.filter((item) => item.toNpcId === npc.id).length || existing?.propagatedMemoryCount || 0,
    lastConsequence: recentConsequence ? `${recentConsequence.actionKind}:${recentConsequence.chainStage || "state"}` : existing?.lastConsequence,
    socialProfile: social ? {
      reputation: Math.round(social.reputation),
      suspicion: Math.round(social.suspicion),
      rumorCredibility: Math.round(social.rumorCredibility * 100),
      dominantTrait: dominantTrait(social.traits),
      trustedNpcIds: Object.entries(social.trust).filter(([, trust]) => trust >= 7).map(([npcId]) => npcId).slice(0, 4)
    } : existing?.socialProfile
  };
}

function knownPublicEventCount(state: NpcAgentState, events: WorldEvent[]) {
  return events.filter((event) => !event.hidden && state.knownFactIds.includes(event.id)).length;
}

function scoreCandidate(input: {
  world: WorldState;
  npc: NPCProfile;
  state: NpcAgentState;
  candidate: Omit<NpcActionCandidate, "score">;
  events: WorldEvent[];
  runtime?: PersistentTownRuntime | null;
}) {
  const { world, npc, state, candidate, events, runtime } = input;
  const visibleKnown = state.knownFactIds.length;
  const resourceOk = !candidate.resourceId || state.resources.includes(candidate.resourceId) || npc.skills.some((skill) => candidate.resourceId?.includes(skill));
  const reachable = locationReachable(world, state.locationId, candidate.targetLocationId);
  const risk = candidate.kind === "confront" || candidate.kind === "hide-trace" ? state.secretRisk : Math.max(1, Math.floor(state.fatigue / 2));
  const evidenceConsistency = events.some((event) => state.knownFactIds.includes(event.id)) ? 8 : 5;
  const witnessExposure = candidate.kind === "investigate" || candidate.kind === "observe"
    ? Math.min(10, events.filter((event) => !event.hidden && event.locationId === candidate.targetLocationId).length + state.alertness)
    : 0;
  const rumorValue = candidate.kind === "spread-rumor" || candidate.kind === "talk" ? Math.min(10, knownPublicEventCount(state, events) + Math.ceil(state.relationshipPressure / 2)) : 0;
  const alibiPressure = candidate.kind === "seek-alibi" ? Math.min(10, state.relationshipPressure + Math.floor(state.fatigue / 2)) : 0;
  const coverUpUrgency = candidate.kind === "cover-up" || candidate.kind === "hide-trace" ? Math.min(10, state.secretRisk + events.filter((event) => event.hidden && event.actorIds.includes(npc.id)).length) : 0;
  const socialAffinity = socialAffinityForAction(world, npc, candidate, runtime);
  const locationPressure = locationPressureForAction(world, candidate, runtime);
  const caseImpact =
    candidate.kind === "pressure" ? 10 :
    candidate.kind === "confront" ? 9 :
    candidate.kind === "cover-up" || candidate.kind === "hide-trace" ? 8 :
    candidate.kind === "investigate" || candidate.kind === "obtain-resource" ? 7 :
    candidate.kind === "spread-rumor" || candidate.kind === "seek-alibi" ? 6 :
    4;
  const score: NpcActionScore = {
    goalPriority: state.goalPriority,
    knownInformation: Math.min(10, visibleKnown),
    relationshipPressure: Math.min(10, state.relationshipPressure),
    resourceAvailability: resourceOk ? 8 : 0,
    locationReachability: reachable ? 8 : 0,
    risk,
    evidenceConsistency,
    caseImpact,
    witnessExposure,
    rumorValue,
    alibiPressure,
    coverUpUrgency,
    socialAffinity,
    locationHeat: locationPressure.locationHeat,
    institutionalPressure: locationPressure.institutionalPressure,
    resourceFlow: locationPressure.resourceFlow,
    total: 0,
    reasons: []
  };
  score.total =
    score.goalPriority +
    score.knownInformation +
    score.relationshipPressure +
    score.resourceAvailability +
    score.locationReachability +
    score.evidenceConsistency +
    score.caseImpact +
    Math.ceil(socialAffinity / 2) +
    Math.ceil((locationPressure.locationHeat + locationPressure.institutionalPressure + locationPressure.resourceFlow) / 4) +
    Math.ceil((witnessExposure + rumorValue + alibiPressure + coverUpUrgency) / 3) -
    Math.floor(score.risk / 2);
  if (!resourceOk) score.reasons.push("required resource is not available");
  if (!reachable) score.reasons.push("target location is not reachable from current location");
  if (state.secretRisk >= 8) score.reasons.push("secret risk is high enough to influence action");
  if (state.relationshipPressure >= 8) score.reasons.push("relationship pressure is high");
  if (candidate.kind === "confront") score.reasons.push("candidate can create a case-forming conflict chain");
  if (candidate.kind === "investigate") score.reasons.push("local witness exposure can reveal source events");
  if (candidate.kind === "spread-rumor") score.reasons.push("known facts can propagate as rumor memory");
  if (candidate.kind === "seek-alibi") score.reasons.push("agent tries to create an alibi before pressure rises");
  if (candidate.kind === "cover-up") score.reasons.push("secret risk creates cover-up urgency");
  if (candidate.kind === "pressure") score.reasons.push("pressure action can deepen motive and opportunity chain");
  if (socialAffinity >= 7) score.reasons.push(`social profile favors ${candidate.kind}`);
  if (locationPressure.locationHeat >= 7) score.reasons.push("location heat makes this action more visible");
  if (locationPressure.institutionalPressure >= 7) score.reasons.push("institutional pressure is high at target location");
  return score;
}

function createEventForAction(input: TownActionExecuteInput): WorldEvent {
  const { world, runtime, npc, candidate, intervention } = input;
  return {
    id: `agent-${world.seed.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}-${runtime.tick}-${npc.id}-${candidate.kind}`,
    worldId: world.id,
    day: runtime.currentDay,
    time: runtime.currentTime,
    type: eventTypeForAction(candidate.kind),
    actorIds: [npc.id, ...(candidate.targetNpcId ? [candidate.targetNpcId] : [])],
    locationId: candidate.targetLocationId,
    summary: `${npc.name}: ${candidate.description}`,
    publicSummary:
      candidate.kind === "confront" || candidate.kind === "pressure" ? `${npc.name} was seen in a tense exchange.` :
      candidate.kind === "spread-rumor" ? `${npc.name} repeated a partial account of recent events.` :
      candidate.kind === "seek-alibi" ? `${npc.name} made sure someone saw them in public.` :
      candidate.kind === "investigate" ? `${npc.name} checked a location for traces.` :
      `${npc.name} followed a visible town action.`,
    hidden: candidate.kind === "hide-trace" || candidate.kind === "cover-up" || candidate.kind === "obtain-resource",
    relatedCharacterIds: [npc.id, ...(candidate.targetNpcId ? [candidate.targetNpcId] : [])],
    tags: [...eventTagsForAction(candidate), intervention ? "counterfactual" : "source_backed"],
    intentId: candidate.id,
    goalId: `goal-${npc.id}-${runtime.tick}`,
    causedByEventIds: deriveNpcAgentState(world, npc, input.allEvents, runtime).knownFactIds.slice(-2),
    explanation: candidate.score.reasons.join(" / ") || "Local agent rules selected the highest scoring legal action."
  };
}

const townActionDefinitions: TownActionDefinition[] = [
  {
    kind: "observe",
    chainStage: "memory",
    expectedObservationKind: "direct",
    buildCandidate: ({ npc, state, runtime }) => ({
      id: `candidate:${npc.id}:${runtime?.tick || 0}:observe`,
      npcId: npc.id,
      kind: "observe",
      targetLocationId: state.locationId,
      description: `${npc.name} reviews nearby events and updates memory.`,
      legal: true
    }),
    canStart: () => ({ legal: true }),
    score: scoreCandidate,
    execute: createEventForAction
  },
  {
    kind: "move",
    chainStage: "opportunity",
    expectedObservationKind: "same-location",
    buildCandidate: ({ npc, runtime, targetLocationId }) => ({
      id: `candidate:${npc.id}:${runtime?.tick || 0}:move`,
      npcId: npc.id,
      kind: "move",
      targetLocationId,
      description: `${npc.name} moves toward ${targetLocationId} to follow the current plan.`,
      legal: true
    }),
    canStart: ({ world, state, candidate }) => ({
      legal: locationReachable(world, state.locationId, candidate.targetLocationId),
      reason: "target location is not reachable from current location"
    }),
    score: scoreCandidate,
    execute: createEventForAction
  },
  {
    kind: "talk",
    chainStage: "memory",
    expectedObservationKind: "direct",
    buildCandidate: ({ npc, runtime, targetLocationId, targetNpcId, targetNpc }) => ({
      id: `candidate:${npc.id}:${runtime?.tick || 0}:talk`,
      npcId: npc.id,
      kind: "talk",
      targetLocationId,
      targetNpcId,
      description: `${npc.name} talks with ${targetNpc?.name || targetNpcId || "a witness"} about recent pressure.`,
      legal: true
    }),
    canStart: ({ candidate }) => ({ legal: Boolean(candidate.targetNpcId), reason: "target NPC is missing" }),
    score: scoreCandidate,
    execute: createEventForAction
  },
  {
    kind: "investigate",
    chainStage: "opportunity",
    expectedObservationKind: "deduced",
    buildCandidate: ({ npc, state, runtime }) => ({
      id: `candidate:${npc.id}:${runtime?.tick || 0}:investigate`,
      npcId: npc.id,
      kind: "investigate",
      targetLocationId: state.locationId,
      description: `${npc.name} checks nearby traces and compares them with remembered events.`,
      legal: true
    }),
    canStart: () => ({ legal: true }),
    score: scoreCandidate,
    execute: createEventForAction
  },
  {
    kind: "spread-rumor",
    chainStage: "memory",
    expectedObservationKind: "rumor",
    buildCandidate: ({ npc, runtime, targetLocationId, targetNpcId, targetNpc }) => ({
      id: `candidate:${npc.id}:${runtime?.tick || 0}:rumor`,
      npcId: npc.id,
      kind: "spread-rumor",
      targetLocationId,
      targetNpcId,
      description: `${npc.name} passes a partial account to ${targetNpc?.name || targetNpcId || "another resident"}.`,
      legal: true
    }),
    canStart: ({ state, candidate }) => ({
      legal: Boolean(candidate.targetNpcId) && state.knownFactIds.length > 0,
      reason: !candidate.targetNpcId ? "target NPC is missing" : "known facts are not available for rumor propagation"
    }),
    score: scoreCandidate,
    execute: createEventForAction
  },
  {
    kind: "seek-alibi",
    chainStage: "alibi",
    expectedObservationKind: "alibi",
    buildCandidate: ({ world, npc, state, runtime, targetNpcId }) => ({
      id: `candidate:${npc.id}:${runtime?.tick || 0}:alibi`,
      npcId: npc.id,
      kind: "seek-alibi",
      targetLocationId: world.locations.find((location) => location.kind === "public")?.id || state.locationId,
      targetNpcId,
      description: `${npc.name} looks for a public alibi before pressure attaches to them.`,
      legal: true
    }),
    canStart: ({ state }) => ({
      legal: state.relationshipPressure >= 3 || state.secretRisk >= 3,
      reason: "relationship pressure or secret risk is too low to seek an alibi"
    }),
    score: scoreCandidate,
    execute: createEventForAction
  },
  {
    kind: "pressure",
    chainStage: "motive",
    expectedObservationKind: "direct",
    buildCandidate: ({ npc, runtime, targetLocationId, targetNpcId, targetNpc }) => ({
      id: `candidate:${npc.id}:${runtime?.tick || 0}:pressure`,
      npcId: npc.id,
      kind: "pressure",
      targetLocationId,
      targetNpcId,
      description: `${npc.name} applies pressure to ${targetNpc?.name || targetNpcId || "a rival"} over a risky secret.`,
      legal: true
    }),
    canStart: ({ state, candidate }) => ({
      legal: Boolean(candidate.targetNpcId) && state.relationshipPressure >= 3,
      reason: !candidate.targetNpcId ? "target NPC is missing" : "relationship pressure is too low"
    }),
    score: scoreCandidate,
    execute: createEventForAction
  },
  {
    kind: "confront",
    chainStage: "motive",
    expectedObservationKind: "direct",
    buildCandidate: ({ npc, runtime, targetLocationId, targetNpcId, targetNpc }) => ({
      id: `candidate:${npc.id}:${runtime?.tick || 0}:confront`,
      npcId: npc.id,
      kind: "confront",
      targetLocationId,
      targetNpcId,
      description: `${npc.name} confronts ${targetNpc?.name || targetNpcId || "a rival"} as secret risk rises.`,
      legal: true
    }),
    canStart: ({ state, candidate }) => ({
      legal: Boolean(candidate.targetNpcId) && state.relationshipPressure >= 4,
      reason: !candidate.targetNpcId ? "target NPC is missing" : "relationship pressure is too low"
    }),
    score: scoreCandidate,
    execute: createEventForAction
  },
  {
    kind: "obtain-resource",
    chainStage: "means",
    expectedObservationKind: "direct",
    buildCandidate: ({ world, npc, state, runtime }) => ({
      id: `candidate:${npc.id}:${runtime?.tick || 0}:resource`,
      npcId: npc.id,
      kind: "obtain-resource",
      targetLocationId: world.locations.find((location) => location.kind === "restricted" || location.kind === "work")?.id || state.locationId,
      resourceId: npc.skills.includes("medicine") ? "resource:medicine" : npc.skills.includes("mechanical") ? "resource:tool" : "resource:local-access",
      description: `${npc.name} tries to obtain a resource relevant to their skills.`,
      legal: true
    }),
    canStart: () => ({ legal: true }),
    score: scoreCandidate,
    execute: createEventForAction
  },
  {
    kind: "cover-up",
    chainStage: "cover-up",
    expectedObservationKind: "deduced",
    buildCandidate: ({ npc, state, runtime }) => ({
      id: `candidate:${npc.id}:${runtime?.tick || 0}:cover-up`,
      npcId: npc.id,
      kind: "cover-up",
      targetLocationId: state.locationId,
      description: `${npc.name} tries to muddy the source trail before witnesses connect it.`,
      legal: true
    }),
    canStart: ({ state, events, npc }) => ({
      legal: state.secretRisk >= 3 || events.some((event) => event.hidden && event.actorIds.includes(npc.id)),
      reason: "secret risk is too low and there is no hidden source trail"
    }),
    score: scoreCandidate,
    execute: createEventForAction
  },
  {
    kind: "hide-trace",
    chainStage: "cover-up",
    expectedObservationKind: "deduced",
    buildCandidate: ({ npc, state, runtime }) => ({
      id: `candidate:${npc.id}:${runtime?.tick || 0}:hide-trace`,
      npcId: npc.id,
      kind: "hide-trace",
      targetLocationId: state.locationId,
      description: `${npc.name} hides a trace that could expose the source chain.`,
      legal: true
    }),
    canStart: ({ state, events, npc }) => ({
      legal: state.secretRisk >= 5 || events.some((event) => event.hidden && event.actorIds.includes(npc.id)),
      reason: "secret risk is too low and there is no trace to hide"
    }),
    score: scoreCandidate,
    execute: createEventForAction
  }
];

export function getTownActionDefinitions() {
  return [...townActionDefinitions];
}

function getTownActionDefinition(kind: NpcActionKind) {
  return townActionDefinitions.find((definition) => definition.kind === kind) || townActionDefinitions[0];
}

export function scoreNpcActionCandidates(world: WorldState, npc: NPCProfile, events: WorldEvent[] = [], runtime?: PersistentTownRuntime | null): NpcActionCandidate[] {
  const state = deriveNpcAgentState(world, npc, events, runtime);
  const random = makeRandom(`${world.seed}:agent:${npc.id}:${runtime?.tick || 0}`);
  const locations = world.locations.length ? world.locations : [{ id: state.locationId }] as { id: string }[];
  const pressureTarget = computeSocialPressures(world, events).find((pressure) => pressure.npcId === npc.id)?.targetId;
  const targetNpcId = pressureTarget || Object.keys(npc.relationships)[0];
  const targetNpc = world.npcs.find((item) => item.id === targetNpcId);
  const targetLocationId = targetNpc ? locationForNpc(targetNpc, runtime?.currentTime || world.currentTime || "08:00") : locations[Math.floor(random() * locations.length)]?.id || state.locationId;
  const buildInput: TownActionBuildInput = { world, npc, state, runtime, events, locations, targetNpcId, targetNpc, targetLocationId };
  return townActionDefinitions.map((definition) => {
    const candidate = definition.buildCandidate(buildInput);
    const legality = definition.canStart({ ...buildInput, candidate });
    const score = definition.score({ world, npc, state, candidate, events, runtime });
    const directorBias = runtime?.interventions.find((intervention) =>
      intervention.actorId === npc.id &&
      intervention.kind === "action-bias" &&
      intervention.value === candidate.kind &&
      (intervention.tick === (runtime.tick || 0) || intervention.tick === (runtime.tick || 0) - 1)
    );
    if (directorBias) {
      score.directorBias = 18;
      score.total += score.directorBias;
      score.reasons.push(`director action bias favors ${candidate.kind}`);
    }
    const legal = candidate.legal && legality.legal && score.locationReachability > 0 && score.resourceAvailability > 0;
    return { ...candidate, legal, blockedReason: !legality.legal ? legality.reason : score.reasons.find((reason) => reason.includes("not")), score };
  });
}

function memoryKindForObservation(kind: TownObservationKind, event: WorldEvent): MemoryKind {
  if (kind === "rumor") return "rumor";
  if (kind === "deduced") return "deduced";
  if (event.hidden && kind === "direct") return "secret";
  return "direct";
}

function addRuntimeObservation(
  runtime: PersistentTownRuntime,
  event: WorldEvent,
  observerNpcId: string,
  kind: TownObservationKind,
  options: Partial<TownEventObservation> & { suffix?: string } = {}
): TownEventObservation {
  runtime.eventObservations ||= [];
  const observation: TownEventObservation = {
    id: `obs-${event.id}-${observerNpcId}-${kind}-${options.suffix || "0"}`,
    tick: runtime.tick,
    eventId: event.id,
    observerNpcId,
    subjectNpcId: options.subjectNpcId,
    sourceNpcId: options.sourceNpcId,
    kind,
    confidence: options.confidence ?? (kind === "rumor" ? 0.56 : kind === "deduced" ? 0.68 : kind === "same-location" ? 0.74 : 0.86),
    visibleToPlayer: options.visibleToPlayer ?? (!event.hidden || kind === "rumor" || kind === "same-location" || kind === "alibi" || kind === "exclusion"),
    memoryId: options.memoryId,
    chainStage: options.chainStage || chainStageForEvent(event)
  };
  const existing = runtime.eventObservations.find((item) => item.id === observation.id);
  if (existing) return existing;
  runtime.eventObservations.push(observation);
  runtime.eventObservations = runtime.eventObservations.slice(-500);
  return observation;
}

function addRuntimeMemory(
  world: RuntimeWorld,
  event: WorldEvent,
  npcId: string,
  summary: string,
  options: Partial<MemoryRecord> & { kind?: MemoryKind; suffix?: string } = {}
): MemoryRecord {
  const kind = options.kind || (event.hidden ? "secret" : "direct");
  const memory: MemoryRecord = {
    id: `mem-${event.id}-${npcId}-${options.suffix || "agent"}`,
    worldId: world.id,
    npcId,
    kind,
    eventId: event.id,
    day: event.day,
    summary,
    sourceNpcId: options.sourceNpcId,
    sourceObservationId: options.sourceObservationId,
    confidence: options.confidence ?? (kind === "rumor" ? 0.58 : kind === "deduced" ? 0.66 : event.hidden ? 0.72 : 0.88),
    visibleToPlayer: options.visibleToPlayer ?? (!event.hidden && kind !== "secret"),
    challengeableEvidenceIds: options.challengeableEvidenceIds || (event.evidenceId ? [event.evidenceId] : [])
  };
  world.memories ||= [];
  if (!world.memories.some((item) => item.id === memory.id)) world.memories.push(memory);
  const npc = world.npcs.find((item) => item.id === npcId);
  if (npc && !npc.memoryEventIds.includes(event.id)) npc.memoryEventIds.push(event.id);
  return memory;
}

function addMemoryForObservation(
  world: RuntimeWorld,
  runtime: PersistentTownRuntime,
  event: WorldEvent,
  observation: TownEventObservation,
  summary: string,
  options: Partial<MemoryRecord> & { suffix?: string } = {}
) {
  const memory = addRuntimeMemory(world, event, observation.observerNpcId, summary, {
    ...options,
    kind: options.kind || memoryKindForObservation(observation.kind, event),
    suffix: options.suffix || `${observation.kind}-${runtime.tick}`,
    sourceNpcId: observation.sourceNpcId,
    sourceObservationId: observation.id,
    confidence: options.confidence ?? observation.confidence,
    visibleToPlayer: options.visibleToPlayer ?? observation.visibleToPlayer
  });
  observation.memoryId = memory.id;
  runtime.eventObservations = (runtime.eventObservations || []).map((item) => item.id === observation.id ? observation : item);
  return memory;
}

function eventTypeForAction(kind: NpcActionKind): WorldEvent["type"] {
  if (kind === "move") return "move";
  if (kind === "confront" || kind === "pressure") return "conflict";
  if (kind === "obtain-resource") return "obtain_item";
  if (kind === "hide-trace" || kind === "cover-up") return "destroy_evidence";
  if (kind === "seek-alibi") return "alibi";
  if (kind === "investigate") return "witness";
  return "conversation";
}

function eventTagsForAction(candidate: NpcActionCandidate) {
  const tags = ["agent_tick", candidate.kind];
  if (candidate.kind === "confront" || candidate.kind === "pressure") tags.push("tension", "secret_leak", "opportunity_window");
  if (candidate.kind === "obtain-resource") tags.push("means_access");
  if (candidate.kind === "investigate") tags.push("witness_probe", "opportunity_window");
  if (candidate.kind === "spread-rumor") tags.push("rumor_spread", "memory_propagation");
  if (candidate.kind === "seek-alibi") tags.push("alibi_seed", "opportunity_window");
  if (candidate.kind === "hide-trace" || candidate.kind === "cover-up") tags.push("staging", "cover_up");
  return tags;
}

function chainStageForAction(kind: NpcActionKind): AgentConsequenceSummary["chainStage"] {
  if (kind === "confront" || kind === "pressure") return "motive";
  if (kind === "obtain-resource") return "means";
  if (kind === "move" || kind === "investigate") return "opportunity";
  if (kind === "hide-trace" || kind === "cover-up") return "cover-up";
  if (kind === "seek-alibi") return "alibi";
  if (kind === "talk" || kind === "spread-rumor" || kind === "observe") return "memory";
  return undefined;
}

function observeEventParticipants(world: RuntimeWorld, runtime: PersistentTownRuntime, event: WorldEvent, actorId: string, targetNpcId?: string) {
  const created: MemoryRecord[] = [];
  const actorObservation = addRuntimeObservation(runtime, event, actorId, event.type === "alibi" ? "alibi" : "direct", {
    subjectNpcId: targetNpcId || actorId,
    confidence: event.hidden ? 0.76 : 0.9,
    visibleToPlayer: !event.hidden,
    suffix: "actor"
  });
  created.push(addMemoryForObservation(world, runtime, event, actorObservation, event.summary, {
    suffix: "agent",
    kind: event.hidden ? "secret" : "direct"
  }));
  if (targetNpcId) {
    const targetObservation = addRuntimeObservation(runtime, event, targetNpcId, event.type === "alibi" ? "alibi" : "direct", {
      subjectNpcId: actorId,
      sourceNpcId: actorId,
      confidence: event.hidden ? 0.66 : 0.82,
      visibleToPlayer: !event.hidden,
      suffix: "target"
    });
    created.push(addMemoryForObservation(world, runtime, event, targetObservation, event.publicSummary, {
      suffix: "target",
      kind: event.hidden ? "secret" : "direct"
    }));
  }
  return created;
}

function propagateEventMemories(world: RuntimeWorld, runtime: PersistentTownRuntime, event: WorldEvent, actorId: string, targetNpcId?: string) {
  runtime.memoryPropagations ||= [];
  const created: MemoryRecord[] = [];
  const participantIds = new Set([actorId, ...(targetNpcId ? [targetNpcId] : [])]);
  if (targetNpcId && (event.tags.includes("rumor_spread") || event.type === "conversation")) {
    const rumorConfidence = rumorConfidenceFromSocial(world, runtime, actorId, targetNpcId);
    const observation = addRuntimeObservation(runtime, event, targetNpcId, "rumor", {
      subjectNpcId: event.relatedCharacterIds.find((id) => id !== targetNpcId) || actorId,
      sourceNpcId: actorId,
      confidence: rumorConfidence,
      visibleToPlayer: true,
      suffix: `rumor-${runtime.tick}`
    });
    const rumor = addMemoryForObservation(world, runtime, event, observation, `Rumor from ${actorId}: ${event.publicSummary}`, {
      suffix: `rumor-${runtime.tick}`
    });
    created.push(rumor);
    runtime.memoryPropagations.push({
      id: `prop-${event.id}-${targetNpcId}-rumor`,
      tick: runtime.tick,
      eventId: event.id,
      observationId: observation.id,
      fromNpcId: actorId,
      toNpcId: targetNpcId,
      kind: "rumor",
      source: "conversation",
      confidence: rumor.confidence
    });
  }
  if (!event.hidden) {
    const profile = locationProfileFor(world, event.locationId, runtime);
    for (const npc of world.npcs.filter((item) => item.alive && !participantIds.has(item.id))) {
      if (runtimeLocationForNpc(world, npc, runtime) !== event.locationId) continue;
      const baseConfidence = event.type === "alibi" ? 0.74 : 0.7;
      const locationBoost = ((profile?.footTraffic || 0) * 0.015) + ((profile?.security || 0) * (event.type === "alibi" ? 0.02 : 0.01));
      const observation = addRuntimeObservation(runtime, event, npc.id, event.type === "alibi" ? "exclusion" : "same-location", {
        subjectNpcId: event.actorIds[0],
        confidence: clamp01(baseConfidence + locationBoost),
        visibleToPlayer: true,
        suffix: `witness-${runtime.tick}`
      });
      const witness = addMemoryForObservation(world, runtime, event, observation, `Witnessed at ${event.locationId}: ${event.publicSummary}`, {
        suffix: `witness-${runtime.tick}`
      });
      created.push(witness);
      runtime.memoryPropagations.push({
        id: `prop-${event.id}-${npc.id}-witness`,
        tick: runtime.tick,
        eventId: event.id,
        observationId: observation.id,
        toNpcId: npc.id,
        kind: "witness",
        source: "same-location",
        confidence: witness.confidence
      });
    }
  }
  if (event.tags.includes("witness_probe")) {
    const observation = addRuntimeObservation(runtime, event, actorId, "deduced", {
      subjectNpcId: targetNpcId,
      confidence: 0.68,
      visibleToPlayer: false,
      suffix: `deduced-${runtime.tick}`
    });
    const deduced = addMemoryForObservation(world, runtime, event, observation, `Deduced a local link from ${event.locationId}: ${event.summary}`, {
      suffix: `deduced-${runtime.tick}`
    });
    created.push(deduced);
    runtime.memoryPropagations.push({
      id: `prop-${event.id}-${actorId}-deduced`,
      tick: runtime.tick,
      eventId: event.id,
      observationId: observation.id,
      toNpcId: actorId,
      kind: "deduced",
      source: "action",
      confidence: deduced.confidence
    });
  }
  runtime.memoryPropagations = runtime.memoryPropagations.slice(-200);
  return created;
}

function buildActionConsequence(runtime: PersistentTownRuntime, npcId: string, candidate: NpcActionCandidate, event: WorldEvent, memoryIds: string[]): AgentConsequenceSummary {
  const stage = chainStageForAction(candidate.kind);
  const socialShift = {
    reputationDelta: candidate.kind === "talk" || candidate.kind === "seek-alibi" ? 0.4 : candidate.kind === "pressure" || candidate.kind === "confront" ? -0.8 : candidate.kind === "cover-up" || candidate.kind === "hide-trace" ? -0.5 : candidate.kind === "investigate" ? 0.2 : 0,
    suspicionDelta: candidate.kind === "cover-up" || candidate.kind === "hide-trace" ? 1.4 : candidate.kind === "pressure" || candidate.kind === "confront" ? 1.1 : candidate.kind === "spread-rumor" ? 0.7 : candidate.kind === "investigate" ? -0.4 : candidate.kind === "talk" ? -0.2 : 0,
    trustDelta: candidate.kind === "talk" || candidate.kind === "seek-alibi" ? 1 : candidate.kind === "pressure" || candidate.kind === "confront" ? -2 : candidate.kind === "spread-rumor" || candidate.kind === "cover-up" ? -1 : 0,
    targetNpcId: candidate.targetNpcId
  };
  return {
    id: `consequence-${event.id}`,
    tick: runtime.tick,
    npcId,
    actionKind: candidate.kind,
    eventId: event.id,
    memoryIds,
    relationshipPressureDelta: candidate.kind === "pressure" || candidate.kind === "confront" ? 2 : candidate.kind === "seek-alibi" ? -1 : candidate.kind === "talk" ? -1 : 0,
    secretRiskDelta: candidate.kind === "cover-up" ? -1 : candidate.kind === "obtain-resource" || candidate.kind === "spread-rumor" ? 1 : candidate.kind === "investigate" ? -1 : 0,
    fatigueDelta: candidate.kind === "observe" || candidate.kind === "talk" ? 0 : 1,
    alertnessDelta: candidate.kind === "investigate" || candidate.kind === "cover-up" ? 1 : candidate.kind === "seek-alibi" ? -1 : 0,
    knownFactDelta: memoryIds.length,
    resourceDelta: candidate.kind === "obtain-resource" ? candidate.resourceId : undefined,
    chainStage: stage,
    socialShift
  };
}

function applyConsequenceToAgent(agent: NpcAgentState, consequence: AgentConsequenceSummary, event: WorldEvent, candidate: NpcActionCandidate, memoryIds: string[]) {
  agent.relationshipPressure = clamp(agent.relationshipPressure + consequence.relationshipPressureDelta);
  agent.secretRisk = clamp(agent.secretRisk + consequence.secretRiskDelta);
  agent.fatigue = clamp(agent.fatigue + consequence.fatigueDelta);
  agent.alertness = clamp(agent.alertness + consequence.alertnessDelta, 1, 10);
  agent.knownFactIds = Array.from(new Set([...agent.knownFactIds, event.id, ...memoryIds])).slice(-24);
  if (consequence.resourceDelta) agent.resources = Array.from(new Set([...agent.resources, consequence.resourceDelta]));
  agent.currentGoal =
    consequence.chainStage === "cover-up" ? "Reduce exposure from recent source trail" :
    consequence.chainStage === "alibi" ? "Secure public alibi before pressure rises" :
    consequence.chainStage === "motive" ? "Resolve escalating relationship pressure" :
    consequence.chainStage === "means" ? "Control useful resources before rivals notice" :
    consequence.chainStage === "memory" ? "Track what the town believes" :
    agent.currentGoal;
  agent.currentPlan = [
    `Stage: ${consequence.chainStage || "routine"}`,
    `Act: ${candidate.kind}`,
    `Watch: ${candidate.targetLocationId}`
  ];
  agent.lastConsequence = `${candidate.kind}:${consequence.chainStage || "state"}`;
}

function evolveRelationship(world: RuntimeWorld, actorId: string, candidate: NpcActionCandidate) {
  if (!candidate.targetNpcId) return;
  world.npcs = world.npcs.map((npc) => {
    if (npc.id !== actorId) return npc;
    const relationships = { ...npc.relationships };
    if (candidate.kind === "pressure" || candidate.kind === "confront") relationships[candidate.targetNpcId!] = "rival";
    if (candidate.kind === "spread-rumor" || candidate.kind === "cover-up") relationships[candidate.targetNpcId!] = "secret";
    if (candidate.kind === "talk" || candidate.kind === "seek-alibi") relationships[candidate.targetNpcId!] = relationships[candidate.targetNpcId!] === "rival" ? "debt" : "friend";
    return { ...npc, relationships };
  });
}

export function createPersistentTownRuntime(world: WorldState, events: WorldEvent[] = [], options: Partial<Pick<PersistentTownRuntime, "tickIntervalMinutes" | "maxTicks">> = {}): PersistentTownRuntime {
  const now = new Date().toISOString();
  const runtime: PersistentTownRuntime = {
    id: `runtime-${world.id}`,
    worldId: world.id,
    status: "paused",
    currentDay: world.day || 1,
    currentTime: world.currentTime || "08:00",
    tickIntervalMinutes: options.tickIntervalMinutes || 30,
    maxTicks: options.maxTicks || Math.max(48, Math.ceil((world.timelineHours || 24) * 2)),
    tick: 0,
    agentStates: [],
    decisionTraces: [],
    candidates: [],
    interventions: [],
    reports: [],
    pressureLedger: [],
    eventObservations: [],
    socialProfiles: [],
    relationshipLedger: [],
    locationProfiles: [],
    locationLedger: [],
    memoryPropagations: [],
    consequences: [],
    longChainLedger: [],
    triggeredCases: [],
    simulationPhases: [...TOWN_TICK_PHASES],
    scenarioRuns: [],
    snapshots: [],
    createdAt: now,
    updatedAt: now
  };
  ensureSocialProfiles(world, runtime);
  ensureLocationProfiles(world, runtime);
  runtime.agentStates = world.npcs.map((npc) => deriveNpcAgentState(world, npc, events, runtime));
  return runtime;
}

function chainStageForEvent(event: WorldEvent) {
  if (event.tags.includes("case_trigger") || event.type === "death") return "opportunity";
  if (event.tags.includes("means_access") || event.type === "obtain_item") return "means";
  if (event.tags.includes("tension") || event.tags.includes("secret_leak") || event.type === "conflict") return "motive";
  if (event.tags.includes("opportunity_window") || event.type === "move" || event.type === "witness") return "opportunity";
  if (event.tags.includes("cover_up") || event.tags.includes("staging") || event.type === "destroy_evidence") return "cover-up";
  if (event.tags.includes("alibi_seed") || event.type === "alibi") return "exclusion";
  if (event.tags.includes("memory_propagation") || event.type === "conversation") return "memory";
  return "context";
}

function emptyChainCompleteness(): Record<CaseChainStage, boolean> {
  return { motive: false, means: false, opportunity: false, "cover-up": false, memory: false, exclusion: false };
}

function emptyStageEventIds(): Record<CaseChainStage, string[]> {
  return { motive: [], means: [], opportunity: [], "cover-up": [], memory: [], exclusion: [] };
}

function observationSupportSummary(runtime: PersistentTownRuntime | null | undefined, eventIds: string[], npcIds: string[] = []): CaseCandidateValidation["observationSupport"] {
  const relevant = (runtime?.eventObservations || []).filter((observation) =>
    eventIds.includes(observation.eventId) &&
    (!npcIds.length || npcIds.includes(observation.observerNpcId) || (observation.subjectNpcId && npcIds.includes(observation.subjectNpcId)))
  );
  const strongest = (kinds: TownObservationKind[]) => relevant
    .filter((observation) => kinds.includes(observation.kind))
    .reduce((max, observation) => Math.max(max, observation.confidence || 0), 0);
  const direct = strongest(["direct", "alibi", "exclusion"]);
  const deduced = strongest(["deduced"]);
  const sameLocation = strongest(["same-location"]);
  const rumor = strongest(["rumor"]);
  return {
    direct,
    deduced,
    rumor,
    sameLocation,
    supportScore: Math.round(Math.min(1, direct * 0.9 + deduced * 0.7 + sameLocation * 0.6 + rumor * 0.2) * 100),
    observationIds: relevant.map((observation) => observation.id)
  };
}

function memoryConfidenceSummary(world: WorldState, eventIds: string[], npcIds: string[] = [], runtime?: PersistentTownRuntime | null): CaseCandidateValidation["memoryConfidence"] {
  const relevant = (world.memories || []).filter((memory) =>
    eventIds.includes(memory.eventId) &&
    (!npcIds.length || npcIds.includes(memory.npcId))
  );
  const strongest = (kind: MemoryKind) => relevant
    .filter((memory) => memory.kind === kind)
    .reduce((max, memory) => Math.max(max, memory.confidence || 0), 0);
  const direct = strongest("direct") || strongest("secret");
  const deduced = strongest("deduced");
  const rumor = strongest("rumor");
  const observation = observationSupportSummary(runtime, eventIds, npcIds);
  return {
    direct: Math.max(direct, observation?.direct || 0, observation?.sameLocation || 0),
    deduced: Math.max(deduced, observation?.deduced || 0),
    rumor: Math.max(rumor, observation?.rumor || 0),
    supportScore: Math.round(Math.min(1, Math.max(direct, observation?.direct || 0, observation?.sameLocation || 0) * 0.9 + Math.max(deduced, observation?.deduced || 0) * 0.65 + Math.max(rumor, observation?.rumor || 0) * 0.25) * 100)
  };
}

function buildStageEventIdsForPressure(world: WorldState, events: WorldEvent[], pressure: SocialPressure, runtime?: PersistentTownRuntime | null) {
  const selected = selectRiskChainEvents(events, pressure);
  const stageEventIds = emptyStageEventIds();
  for (const event of selected) {
    const stage = chainStageForEvent(event);
    if (stage in stageEventIds && !stageEventIds[stage as CaseChainStage].includes(event.id)) {
      stageEventIds[stage as CaseChainStage].push(event.id);
    }
  }
  const pairIds = [pressure.npcId, pressure.targetId];
  for (const memory of world.memories || []) {
    if (!pairIds.includes(memory.npcId)) continue;
    if (!selected.some((event) => event.id === memory.eventId)) continue;
    if (!stageEventIds.memory.includes(memory.eventId)) stageEventIds.memory.push(memory.eventId);
  }
  for (const observation of runtime?.eventObservations || []) {
    if (!pairIds.includes(observation.observerNpcId) && !(observation.subjectNpcId && pairIds.includes(observation.subjectNpcId))) continue;
    if (!events.some((event) => event.id === observation.eventId)) continue;
    if (observation.kind === "direct" || observation.kind === "deduced" || observation.kind === "same-location") {
      if (!stageEventIds.memory.includes(observation.eventId)) stageEventIds.memory.push(observation.eventId);
    }
    if (observation.kind === "alibi" || observation.kind === "exclusion") {
      if (!stageEventIds.exclusion.includes(observation.eventId)) stageEventIds.exclusion.push(observation.eventId);
    }
  }
  for (const event of events) {
    if (event.type !== "alibi" && !event.tags.includes("alibi_seed")) continue;
    if (event.actorIds.includes(pressure.npcId)) continue;
    if (!stageEventIds.exclusion.includes(event.id)) stageEventIds.exclusion.push(event.id);
  }
  return stageEventIds;
}

function summarizeLongChain(world: WorldState, events: WorldEvent[], runtime: PersistentTownRuntime, pressure: SocialPressure): TownLongChainLedgerEntry {
  const stageEventIds = buildStageEventIdsForPressure(world, events, pressure, runtime);
  const memoryConfidence = memoryConfidenceSummary(world, Object.values(stageEventIds).flat(), [pressure.npcId, pressure.targetId], runtime);
  const chainCompleteness = emptyChainCompleteness();
  for (const stage of Object.keys(chainCompleteness) as CaseChainStage[]) {
    chainCompleteness[stage] = stage === "memory" ? (memoryConfidence?.supportScore || 0) >= 55 : stageEventIds[stage].length > 0;
  }
  const completedCount = Object.values(chainCompleteness).filter(Boolean).length;
  const maturityScore = Math.min(100, completedCount * 15 + Math.min(10, Math.floor(pressure.score / 2)));
  const existingTrigger = runtime.triggeredCases?.find((item) => item.culpritId === pressure.npcId && item.victimId === pressure.targetId);
  return {
    id: `chain-${pressure.npcId}-${pressure.targetId}`,
    tick: runtime.tick,
    culpritId: pressure.npcId,
    victimId: pressure.targetId,
    pressureScore: pressure.score,
    stageEventIds,
    memoryConfidence,
    maturityScore,
    complete: Object.values(chainCompleteness).every(Boolean),
    triggeredEventId: existingTrigger?.eventId
  };
}

function refreshLongChainLedger(world: WorldState, events: WorldEvent[], runtime: PersistentTownRuntime) {
  const pressures = computeSocialPressures(world, events).filter((pressure) => pressure.score >= 5).slice(0, 8);
  runtime.longChainLedger = pressures.map((pressure) => summarizeLongChain(world, events, runtime, pressure));
  return runtime.longChainLedger;
}

function triggerLongChainCaseIfReady(world: RuntimeWorld, runtime: PersistentTownRuntime, events: WorldEvent[], createdEvents: WorldEvent[]) {
  runtime.triggeredCases ||= [];
  const ledger = refreshLongChainLedger(world, events, runtime);
  const ready = ledger
    .filter((entry) =>
      entry.complete &&
      entry.maturityScore >= 90 &&
      world.npcs.some((npc) => npc.id === entry.victimId && npc.alive) &&
      !runtime.triggeredCases?.some((trigger) => trigger.culpritId === entry.culpritId && trigger.victimId === entry.victimId)
    )
    .sort((a, b) => b.maturityScore - a.maturityScore)[0];
  if (!ready || runtime.tick < Math.min(30, runtime.maxTicks)) return null;
  const culprit = world.npcs.find((npc) => npc.id === ready.culpritId);
  const victim = world.npcs.find((npc) => npc.id === ready.victimId);
  if (!culprit || !victim || !victim.alive) return null;
  const causedByEventIds = Object.values(ready.stageEventIds).flat().filter(Boolean).slice(0, 12);
  const locationId = events.find((event) => event.id === ready.stageEventIds.opportunity[0])?.locationId || runtime.agentStates.find((agent) => agent.npcId === victim.id)?.locationId || victim.homeLocationId;
  const event: WorldEvent = {
    id: `agent-case-${world.seed.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}-${runtime.tick}-${culprit.id}-${victim.id}`,
    worldId: world.id,
    day: runtime.currentDay,
    time: runtime.currentTime,
    type: "death",
    actorIds: [culprit.id, victim.id],
    locationId,
    summary: `${victim.name} dies after a complete simulated pressure chain involving ${culprit.name}.`,
    publicSummary: `${victim.name} was found dead after a series of visible town tensions.`,
    hidden: true,
    relatedCharacterIds: [culprit.id, victim.id],
    tags: ["agent_tick", "case_trigger", "death", "long_chain", "source_backed"],
    intentId: ready.id,
    goalId: `goal-${culprit.id}-case-trigger-${runtime.tick}`,
    causedByEventIds,
    explanation: `Six-stage long chain matured: motive, means, opportunity, cover-up, memory, and exclusion all have local support.`
  };
  createdEvents.push(event);
  world.npcs = world.npcs.map((npc) => npc.id === victim.id ? { ...npc, alive: false } : npc);
  const culpritObservation = addRuntimeObservation(runtime, event, culprit.id, "direct", {
    subjectNpcId: victim.id,
    confidence: 0.84,
    visibleToPlayer: false,
    suffix: `trigger-${runtime.tick}`
  });
  const victimObservation = addRuntimeObservation(runtime, event, victim.id, "direct", {
    subjectNpcId: culprit.id,
    confidence: 0.9,
    visibleToPlayer: true,
    suffix: `trigger-${runtime.tick}`
  });
  const culpritMemory = addMemoryForObservation(world, runtime, event, culpritObservation, event.summary, { kind: "secret", suffix: `trigger-${runtime.tick}` });
  const witnessMemory = addMemoryForObservation(world, runtime, event, victimObservation, event.publicSummary, { kind: "direct", suffix: `trigger-${runtime.tick}` });
  const triggerRecord: TownTriggeredCaseRecord = {
    id: `trigger-${event.id}`,
    tick: runtime.tick,
    culpritId: culprit.id,
    victimId: victim.id,
    eventId: event.id,
    causedByEventIds,
    maturityScore: ready.maturityScore,
    chainCompleteness: Object.fromEntries((Object.keys(emptyChainCompleteness()) as CaseChainStage[]).map((stage) => [stage, true])) as Record<CaseChainStage, boolean>
  };
  runtime.triggeredCases = [triggerRecord, ...runtime.triggeredCases].slice(0, 20);
  ready.triggeredEventId = event.id;
  const consequence: AgentConsequenceSummary = {
    id: `consequence-${event.id}`,
    tick: runtime.tick,
    npcId: culprit.id,
    actionKind: "pressure",
    eventId: event.id,
    memoryIds: [culpritMemory.id, witnessMemory.id],
    relationshipPressureDelta: 4,
    secretRiskDelta: 4,
    fatigueDelta: 1,
    alertnessDelta: 2,
    knownFactDelta: 2,
    chainStage: "opportunity",
    triggeredCaseId: triggerRecord.id
  };
  runtime.consequences = [consequence, ...(runtime.consequences || [])].slice(0, 160);
  const agent = runtime.agentStates.find((state) => state.npcId === culprit.id);
  if (agent) {
    applyConsequenceToAgent(agent, consequence, event, { id: `trigger:${event.id}`, npcId: culprit.id, kind: "pressure", targetLocationId: locationId, targetNpcId: victim.id, description: event.summary, legal: true, score: { goalPriority: 10, knownInformation: 10, relationshipPressure: 10, resourceAvailability: 10, locationReachability: 10, risk: 10, evidenceConsistency: 10, caseImpact: 10, total: 70, reasons: ["six-stage long chain triggered a real case event"] } }, [culpritMemory.id, witnessMemory.id]);
  }
  return { event, triggerRecord };
}

function eventMinuteValue(event: WorldEvent) {
  return event.day * 24 * 60 + timeToMinutes(event.time);
}

function selectRiskChainEvents(events: WorldEvent[], pressure: SocialPressure) {
  const related = events
    .filter((event) =>
      pressure.sourceEventIds.includes(event.id) ||
      event.actorIds.includes(pressure.npcId) ||
      event.actorIds.includes(pressure.targetId) ||
      event.relatedCharacterIds.includes(pressure.npcId) ||
      event.relatedCharacterIds.includes(pressure.targetId)
    )
    .sort((a, b) => eventMinuteValue(a) - eventMinuteValue(b));
  const stageOrder = ["motive", "means", "opportunity", "cover-up", "memory", "exclusion", "context"];
  const selected: WorldEvent[] = [];
  for (const stage of stageOrder) {
    const event = related.find((item) => chainStageForEvent(item) === stage && !selected.some((existing) => existing.id === item.id));
    if (event) selected.push(event);
  }
  for (const eventId of pressure.sourceEventIds) {
    const event = events.find((item) => item.id === eventId);
    if (event && !selected.some((item) => item.id === event.id)) selected.push(event);
  }
  return selected.slice(0, 8);
}

export function buildCaseCandidatesFromRuntime(world: WorldState, events: WorldEvent[] = [], runtime?: PersistentTownRuntime | null): CaseCandidate[] {
  const activeRuntime = runtime || getRuntime(world as RuntimeWorld) || createPersistentTownRuntime(world, events);
  const pressures = computeSocialPressures(world, events);
  const sortedPressures = pressures.filter((pressure) => pressure.score >= 5).slice(0, 5);
  const candidates = sortedPressures.map((pressure, index): CaseCandidate => {
    const riskChainEvents = selectRiskChainEvents(events, pressure);
    const riskChainEventIds = riskChainEvents.map((event) => event.id);
    const ledgerEntry = activeRuntime.longChainLedger?.find((entry) => entry.culpritId === pressure.npcId && entry.victimId === pressure.targetId);
    const triggeredCase = activeRuntime.triggeredCases?.find((item) => item.culpritId === pressure.npcId && item.victimId === pressure.targetId);
    const chainCompleteness = ledgerEntry
      ? Object.fromEntries((Object.keys(emptyChainCompleteness()) as CaseChainStage[]).map((stage) => [stage, ledgerEntry.stageEventIds[stage].length > 0 || (stage === "memory" && (ledgerEntry.memoryConfidence?.supportScore || 0) >= 55)])) as Record<CaseChainStage, boolean>
      : undefined;
    const chainStageTags = Array.from(new Set([
      ...riskChainEvents.map(chainStageForEvent),
      ...Object.entries(chainCompleteness || {}).filter(([, complete]) => complete).map(([stage]) => stage)
    ]));
    const memoryIds = (world.memories || [])
      .filter((memory) => riskChainEventIds.includes(memory.eventId) && [pressure.npcId, pressure.targetId].includes(memory.npcId))
      .map((memory) => memory.id);
    const observationSupport = observationSupportSummary(activeRuntime, riskChainEventIds, [pressure.npcId, pressure.targetId]);
    const goalIds = activeRuntime.agentStates
      .filter((state) => [pressure.npcId, pressure.targetId].includes(state.npcId))
      .map((state) => `goal:${state.npcId}:${state.currentGoal.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
    const candidate: CaseCandidate = {
      id: `candidate-${world.seed.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}-${activeRuntime.tick}-${index}`,
      worldId: world.id,
      tick: activeRuntime.tick,
      status: "forming",
      culpritId: pressure.npcId,
      victimId: pressure.targetId,
      pressureScore: pressure.score,
      riskChainEventIds,
      memoryIds,
      goalIds,
      chainStageTags,
      maturityScore: ledgerEntry?.maturityScore,
      triggeredEventId: triggeredCase?.eventId || ledgerEntry?.triggeredEventId,
      chainCompleteness,
      validation: {
        valid: false,
        hardLogicValid: false,
        uniqueCulprit: false,
        worldBackedEvidence: false,
        memoryScopedTestimony: memoryIds.length > 0,
        nonCulpritExcluded: false,
        timelineClosed: riskChainEventIds.length >= 2,
        chainStages: chainStageTags,
        chainCompleteness,
        memoryConfidence: ledgerEntry?.memoryConfidence,
        observationSupport,
        failureReasons: [],
        errors: [],
        warnings: []
      }
    };
    candidate.validation = validateCaseCandidate(world, events, candidate);
    candidate.status = candidate.validation.valid ? "valid" : "invalid";
    candidate.motiveGap = candidate.validation.failureReasons?.find((reason) => reason.includes("motive"));
    candidate.meansGap = candidate.validation.failureReasons?.find((reason) => reason.includes("means"));
    candidate.exclusionGap = candidate.validation.failureReasons?.find((reason) => reason.includes("exclusion"));
    candidate.timelineGap = candidate.validation.failureReasons?.find((reason) => reason.includes("timeline"));
    return candidate;
  });
  return candidates.length ? candidates : activeRuntime.candidates;
}

export function validateCaseCandidate(world: WorldState, events: WorldEvent[] = [], candidate: CaseCandidate): CaseCandidateValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const runtime = getRuntime(world as RuntimeWorld);
  const culprit = world.npcs.find((npc) => npc.id === candidate.culpritId);
  const victim = world.npcs.find((npc) => npc.id === candidate.victimId);
  const sourceEvents = events.filter((event) => candidate.riskChainEventIds.includes(event.id));
  const chainStages = Array.from(new Set(sourceEvents.map(chainStageForEvent)));
  const completeness = candidate.chainCompleteness || emptyChainCompleteness();
  const observationSupport = candidate.validation.observationSupport || observationSupportSummary(runtime, candidate.riskChainEventIds, [candidate.culpritId, candidate.victimId]) || {
    direct: 0,
    deduced: 0,
    rumor: 0,
    sameLocation: 0,
    supportScore: 0,
    observationIds: []
  };
  const confidence = candidate.validation.memoryConfidence || memoryConfidenceSummary(world, candidate.riskChainEventIds, [candidate.culpritId, candidate.victimId], runtime) || { direct: 0, deduced: 0, rumor: 0, supportScore: 0 };
  const hasMotive = completeness.motive || candidate.pressureScore >= 7 || sourceEvents.some((event) => event.tags.includes("secret_leak") || event.tags.includes("tension"));
  const hasMeans = completeness.means || events.some((event) => event.actorIds.includes(candidate.culpritId) && (event.tags.includes("means_access") || event.type === "obtain_item"));
  const hasOpportunity = completeness.opportunity || sourceEvents.some((event) => event.tags.includes("opportunity_window") || event.locationId);
  const hasCoverUp = completeness["cover-up"] || sourceEvents.some((event) => event.tags.includes("cover_up") || event.tags.includes("staging") || event.type === "destroy_evidence");
  const observationBackedMemory = (observationSupport.direct + observationSupport.deduced + observationSupport.sameLocation) > 0 && observationSupport.supportScore >= 55;
  const memoryScopedTestimony = (completeness.memory || candidate.memoryIds.length > 0 || observationBackedMemory) && confidence.supportScore >= 55 && candidate.memoryIds.every((id) => (world.memories || []).some((memory) => memory.id === id));
  const hasObservationExclusion = (runtime?.eventObservations || []).some((observation) =>
    candidate.riskChainEventIds.includes(observation.eventId) &&
    (observation.kind === "alibi" || observation.kind === "exclusion") &&
    observation.observerNpcId !== candidate.culpritId
  );
  const hasExclusionSeed = completeness.exclusion || hasObservationExclusion || sourceEvents.some((event) => event.tags.includes("alibi_seed") || event.type === "alibi") || events.some((event) => event.type === "alibi" && !event.actorIds.includes(candidate.culpritId));
  const hasTriggeredCase = Boolean(candidate.triggeredEventId);
  if (!culprit) errors.push("culprit candidate is missing from world");
  if (!victim) errors.push("victim candidate is missing from world");
  if (candidate.culpritId === candidate.victimId) errors.push("culprit and victim cannot be the same NPC");
  if (!hasMotive) errors.push("motive insufficient: pressure chain is too weak");
  if (!hasMeans) errors.push("means insufficient: no resource or means-access event");
  if (!hasOpportunity) errors.push("opportunity insufficient: no reachable opportunity event");
  if (!hasCoverUp) errors.push("cover-up insufficient: no cover-up or staging event");
  if (!memoryScopedTestimony) errors.push("memory support insufficient: no scoped memory links candidate events to testimony");
  if (!hasTriggeredCase) errors.push("real case trigger missing: six-stage chain has not produced a death or crime event");
  if (candidate.riskChainEventIds.length < 2) warnings.push("timeline is shallow: fewer than two risk-chain events");
  if (!hasExclusionSeed) warnings.push("non-culprit exclusion seed missing: no alibi or exclusion-stage event yet");
  const failureReasons = [
    !hasMotive ? "missing motive stage: pressure chain is too weak" : "",
    !hasMeans ? "missing means stage: no resource or means-access event" : "",
    !hasOpportunity ? "missing opportunity stage: no reachable opportunity event" : "",
    !hasCoverUp ? "missing cover-up stage: no staging or cover-up event" : "",
    !memoryScopedTestimony ? "missing memory support: candidate has no scoped testimony memory" : "",
    !hasTriggeredCase ? "missing real case trigger: no death or crime event has been written yet" : "",
    candidate.riskChainEventIds.length < 2 ? "missing timeline depth: fewer than two risk-chain events" : "",
    !hasExclusionSeed ? "missing non-culprit exclusion seed: no alibi or exclusion event" : ""
  ].filter(Boolean);
  const valid = errors.length === 0 && hasMotive && hasMeans && hasOpportunity && hasCoverUp && memoryScopedTestimony && hasExclusionSeed && hasTriggeredCase;
  return {
    valid,
    hardLogicValid: false,
    uniqueCulprit: valid,
    worldBackedEvidence: sourceEvents.length === candidate.riskChainEventIds.length && candidate.riskChainEventIds.length > 0,
    memoryScopedTestimony,
    nonCulpritExcluded: hasExclusionSeed,
    timelineClosed: candidate.riskChainEventIds.length >= 2,
    chainStages,
    chainCompleteness: {
      motive: hasMotive,
      means: hasMeans,
      opportunity: hasOpportunity,
      "cover-up": hasCoverUp,
      memory: memoryScopedTestimony,
      exclusion: hasExclusionSeed
    },
    memoryConfidence: confidence,
    observationSupport,
    failureReasons,
    errors,
    warnings
  };
}

function uniqueIds(ids: Array<string | undefined>) {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

export function buildPersistentCaseExtractionView(world: WorldState, events: WorldEvent[] = [], candidate: CaseCandidate): PersistentCaseExtractionView | null {
  const runtime = getRuntime(world as RuntimeWorld);
  const ledger = runtime?.longChainLedger?.find((entry) => entry.culpritId === candidate.culpritId && entry.victimId === candidate.victimId);
  const trigger = runtime?.triggeredCases?.find((entry) => entry.eventId === candidate.triggeredEventId || (entry.culpritId === candidate.culpritId && entry.victimId === candidate.victimId));
  if (!runtime || !ledger || !trigger) return null;

  const byId = new Map(events.map((event) => [event.id, event]));
  const triggerEvent = byId.get(trigger.eventId);
  if (!triggerEvent) return null;

  const chainStageSourceEventIds = {
    motive: uniqueIds(ledger.stageEventIds.motive),
    means: uniqueIds(ledger.stageEventIds.means),
    opportunity: uniqueIds(ledger.stageEventIds.opportunity),
    "cover-up": uniqueIds(ledger.stageEventIds["cover-up"]),
    memory: uniqueIds(ledger.stageEventIds.memory),
    exclusion: uniqueIds(ledger.stageEventIds.exclusion)
  } satisfies Record<CaseChainStage, string[]>;

  const fallbackSource = events.find((event) => event.actorIds.includes(candidate.culpritId) && event.relatedCharacterIds.includes(candidate.victimId)) || events[0] || triggerEvent;
  const evidenceSourceEventIds: Record<string, string[]> = {
    "ev-motive": chainStageSourceEventIds.motive,
    "ev-means": chainStageSourceEventIds.means,
    "ev-opportunity": chainStageSourceEventIds.opportunity,
    "ev-staging": chainStageSourceEventIds["cover-up"],
    "ev-trace": chainStageSourceEventIds.memory,
    "ev-death-scene": [trigger.eventId],
    "ev-town-rollcall": chainStageSourceEventIds.exclusion
  };
  const extractionEventSourceIds: Record<string, string[]> = {};
  const memorySourceIds = uniqueIds(
    (world.memories || [])
      .filter((memory) => candidate.memoryIds.includes(memory.id) || Object.values(chainStageSourceEventIds).flat().includes(memory.eventId))
      .map((memory) => memory.id)
  );
  const observationSourceIds = uniqueIds([
    ...(runtime.eventObservations || [])
      .filter((observation) =>
        Object.values(chainStageSourceEventIds).flat().includes(observation.eventId) ||
        observation.eventId === trigger.eventId ||
        memorySourceIds.some((memoryId) => (world.memories || []).some((memory) => memory.id === memoryId && memory.sourceObservationId === observation.id))
      )
      .map((observation) => observation.id),
    ...(world.memories || [])
      .filter((memory) => memorySourceIds.includes(memory.id))
      .map((memory) => memory.sourceObservationId)
  ]);

  const cloneStageEvent = (stage: CaseChainStage, evidenceId: string, fallbackType?: WorldEvent["type"]): WorldEvent => {
    const sourceId = chainStageSourceEventIds[stage][0];
    const source = (sourceId && byId.get(sourceId)) || fallbackSource;
    const id = `caseview-${evidenceId}-${source?.id || trigger.eventId}`;
    extractionEventSourceIds[id] = uniqueIds([source?.id, ...evidenceSourceEventIds[evidenceId]]);
    return {
      ...source,
      id,
      type: fallbackType || source?.type || "witness",
      evidenceId,
      actorIds: source?.actorIds?.length ? source.actorIds : [candidate.culpritId],
      relatedCharacterIds: Array.from(new Set([candidate.culpritId, candidate.victimId, ...(source?.relatedCharacterIds || [])])),
      tags: Array.from(new Set([...(source?.tags || []), stage, stage === "cover-up" ? "staging" : "", evidenceId.replace("ev-", ""), "persistent-source-backed"].filter(Boolean))),
      hidden: stage === "means" || stage === "cover-up" ? true : source?.hidden || false,
      causedByEventIds: uniqueIds([...(source?.causedByEventIds || []), ...evidenceSourceEventIds[evidenceId]])
    };
  };

  const deathId = `caseview-ev-death-scene-${trigger.eventId}`;
  extractionEventSourceIds[deathId] = uniqueIds([trigger.eventId, ...(trigger.causedByEventIds || [])]);
  const death: WorldEvent = {
    ...triggerEvent,
    id: deathId,
    evidenceId: "ev-death-scene",
    tags: Array.from(new Set([...(triggerEvent.tags || []), "blade", "case_trigger", "death", "persistent-source-backed"])),
    causedByEventIds: uniqueIds([...(triggerEvent.causedByEventIds || []), ...trigger.causedByEventIds])
  };

  const rollcallSourceIds = chainStageSourceEventIds.exclusion.length ? chainStageSourceEventIds.exclusion : [trigger.eventId];
  const rollcallId = `caseview-ev-town-rollcall-${trigger.eventId}`;
  extractionEventSourceIds[rollcallId] = uniqueIds(rollcallSourceIds);
  const nonCulpritIds = world.npcs.filter((npc) => npc.id !== candidate.culpritId && npc.id !== candidate.victimId).map((npc) => npc.id);
  const rollcall: WorldEvent = {
    id: rollcallId,
    worldId: world.id,
    day: triggerEvent.day || runtime.currentDay,
    time: triggerEvent.time || runtime.currentTime,
    type: "alibi",
    actorIds: nonCulpritIds,
    locationId: world.locations.find((location) => location.kind === "public")?.id || triggerEvent.locationId || world.locations[0]?.id || "town-square",
    summary: "Non-culprit residents have a public rollcall record during the case window.",
    publicSummary: "A public rollcall excludes residents who were away from the scene.",
    hidden: false,
    evidenceId: "ev-town-rollcall",
    relatedCharacterIds: nonCulpritIds,
    tags: ["alibi_seed", "exclusion", "source_backed", "persistent-source-backed"],
    causedByEventIds: uniqueIds(rollcallSourceIds)
  };

  const extractionEvents = [
    cloneStageEvent("means", "ev-means", "obtain_item"),
    cloneStageEvent("motive", "ev-motive", "conflict"),
    cloneStageEvent("opportunity", "ev-opportunity", "witness"),
    cloneStageEvent("cover-up", "ev-staging", "destroy_evidence"),
    cloneStageEvent("memory", "ev-trace", "forensic_clue"),
    death,
    rollcall
  ];
  const extractionEventIds = extractionEvents.map((event) => event.id);

  return {
    world,
    events: extractionEvents,
    sourceMap: {
      triggeredEventId: trigger.eventId,
      sourceCandidateId: candidate.id,
      sourceEventIds: extractionEventIds,
      evidenceSourceEventIds,
      extractionEventSourceIds,
      chainStageSourceEventIds,
      memorySourceIds,
      observationSourceIds
    }
  };
}

export function extractPlayableCaseFromCandidate(world: WorldState, events: WorldEvent[] = [], candidate: CaseCandidate): { world: WorldState; events: WorldEvent[]; activeCase: CaseFromLog; candidate: CaseCandidate } {
  let tick = { world, events: [] as WorldEvent[] };
  let allEvents = events;
  const extractionView = buildPersistentCaseExtractionView(world, events, candidate);
  if (extractionView) {
    allEvents = extractionView.events;
  } else {
    tick = simulateWorldTick(world, events);
    allEvents = [...events, ...tick.events];
  }
  const caseWorld = tick.world;
  const activeCase = extractCaseFromWorld(caseWorld, allEvents);
  if (extractionView) {
    activeCase.triggeredEventId = extractionView.sourceMap.triggeredEventId;
    activeCase.sourceCandidateId = extractionView.sourceMap.sourceCandidateId;
    activeCase.sourceEventIds = extractionView.sourceMap.sourceEventIds;
    activeCase.sourceMap = {
      ...activeCase.sourceMap,
      triggeredEventId: extractionView.sourceMap.triggeredEventId,
      sourceCandidateId: extractionView.sourceMap.sourceCandidateId,
      sourceEventIds: extractionView.sourceMap.sourceEventIds,
      evidenceSourceEventIds: extractionView.sourceMap.evidenceSourceEventIds,
      extractionEventSourceIds: extractionView.sourceMap.extractionEventSourceIds,
      chainStageSourceEventIds: extractionView.sourceMap.chainStageSourceEventIds,
      memorySourceIds: extractionView.sourceMap.memorySourceIds,
      observationSourceIds: extractionView.sourceMap.observationSourceIds
    };
  }
  const validation = validateWorldCase(caseWorld, allEvents, activeCase.deductionCase);
  const nextCandidate: CaseCandidate = {
    ...candidate,
    status: validation.valid ? "extracted" : "invalid",
    caseId: activeCase.id,
    validation: {
      ...candidate.validation,
      valid: validation.valid,
      hardLogicValid: validation.valid,
      uniqueCulprit: activeCase.qualityReport.uniqueCulprit,
      worldBackedEvidence: activeCase.qualityReport.worldBackedEvidence,
      memoryScopedTestimony: activeCase.qualityReport.memoryScopedTestimony,
      nonCulpritExcluded: activeCase.qualityReport.nonCulpritExcluded,
      timelineClosed: activeCase.qualityReport.timeline24hComplete,
      errors: validation.errors,
      warnings: validation.warnings
    }
  };
  return { world: { ...tick.world, activeCaseId: activeCase.id }, events: allEvents, activeCase, candidate: nextCandidate };
}

export function buildAgentDecisionTrace(runtime: PersistentTownRuntime, decisionId: string) {
  return runtime.decisionTraces.find((trace) => trace.id === decisionId) || null;
}

export function buildTownEmergenceQueue(world: WorldState, events: WorldEvent[] = [], runtime?: PersistentTownRuntime | null): TownEmergenceQueue {
  const activeRuntime = runtime || getRuntime(world as RuntimeWorld) || createPersistentTownRuntime(world, events);
  const candidates = buildCaseCandidatesFromRuntime(world, events, activeRuntime);
  const validCount = candidates.filter((candidate) => candidate.validation.valid).length;
  const blockedCount = candidates.filter((candidate) => !candidate.validation.valid).length;
  return {
    runtimeId: activeRuntime.id,
    worldId: world.id,
    status: activeRuntime.status,
    candidates,
    validCount,
    blockedCount,
    nextAction: validCount ? "Extract a playable case from the strongest valid candidate." : "Continue stepping the town until motive, means, opportunity, and memory support converge."
  };
}

export function buildTownSituationBrief(
  world: WorldState,
  events: WorldEvent[] = [],
  runtime?: PersistentTownRuntime | null,
  queue?: TownEmergenceQueue | null
): TownSituationBrief {
  const activeRuntime = runtime || getRuntime(world as RuntimeWorld) || createPersistentTownRuntime(world, events);
  const activeQueue = queue || buildTownEmergenceQueue(world, events, activeRuntime);
  const npcById = new Map(world.npcs.map((npc) => [npc.id, npc]));
  const locationById = new Map(world.locations.map((location) => [location.id, location]));
  const socialByNpcId = new Map((activeRuntime.socialProfiles || []).map((profile) => [profile.npcId, profile]));
  const hotLocations = [...(activeRuntime.locationProfiles || [])]
    .map((profile) => ({
      locationId: profile.locationId,
      name: locationById.get(profile.locationId)?.name || profile.locationId,
      score: Math.round(profile.heat * 5 + profile.security * 2 + profile.footTraffic * 2 + profile.resourcePressure * 3),
      heat: Math.round(profile.heat),
      security: Math.round(profile.security),
      footTraffic: Math.round(profile.footTraffic),
      resourcePressure: Math.round(profile.resourcePressure),
      factionInfluence: profile.factionInfluence
    }))
    .sort((a, b) => b.score - a.score || a.locationId.localeCompare(b.locationId))
    .slice(0, 3);
  const riskAgents = activeRuntime.agentStates
    .map((agent) => {
      const social = socialByNpcId.get(agent.npcId);
      const suspicion = social?.suspicion || agent.socialProfile?.suspicion || 0;
      return {
        npcId: agent.npcId,
        name: npcById.get(agent.npcId)?.name || agent.npcId,
        score: Math.round(agent.relationshipPressure * 0.9 + agent.secretRisk * 1.2 + agent.alertness * 0.35 + suspicion * 0.55),
        relationshipPressure: Math.round(agent.relationshipPressure),
        secretRisk: Math.round(agent.secretRisk),
        alertness: Math.round(agent.alertness),
        suspicion: Math.round(suspicion),
        locationId: agent.locationId
      };
    })
    .sort((a, b) => b.score - a.score || a.npcId.localeCompare(b.npcId))
    .slice(0, 3);
  const actionCounts = new Map<NpcActionKind, number>();
  for (const trace of activeRuntime.decisionTraces.slice(-40)) {
    const action = trace.candidates.find((candidate) => candidate.id === trace.selectedCandidateId)?.kind;
    if (action) actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
  }
  const actionMix = [...actionCounts.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind))
    .slice(0, 4);
  const observationMix: Record<TownObservationKind, number> = {
    direct: 0,
    "same-location": 0,
    rumor: 0,
    deduced: 0,
    alibi: 0,
    exclusion: 0
  };
  for (const observation of activeRuntime.eventObservations || []) observationMix[observation.kind] += 1;
  const candidates = [...activeQueue.candidates].sort((a, b) => {
    const validDelta = Number(b.validation.valid) - Number(a.validation.valid);
    if (validDelta) return validDelta;
    const maturityDelta = (b.maturityScore || 0) - (a.maturityScore || 0);
    if (maturityDelta) return maturityDelta;
    return b.pressureScore - a.pressureScore;
  });
  const strongestCandidate = candidates[0];
  const highestMaturityScore = strongestCandidate?.maturityScore || 0;
  const triggeredCaseCount = activeRuntime.triggeredCases?.length || 0;
  const currentPhase = activeRuntime.simulationPhases?.length
    ? activeRuntime.simulationPhases[Math.max(0, activeRuntime.tick % activeRuntime.simulationPhases.length)]
    : "finalize";
  const urgency = triggeredCaseCount || activeQueue.validCount ? "critical" : highestMaturityScore >= 70 || (riskAgents[0]?.score || 0) >= 120 ? "elevated" : "stable";
  const triggeredCase = activeRuntime.triggeredCases?.[0];
  const headline = triggeredCase
    ? `Triggered case: ${(npcById.get(triggeredCase.culpritId)?.name || triggeredCase.culpritId)} -> ${(npcById.get(triggeredCase.victimId)?.name || triggeredCase.victimId)}`
    : strongestCandidate?.validation.valid
      ? `Playable case ready: ${(npcById.get(strongestCandidate.culpritId)?.name || strongestCandidate.culpritId)} -> ${(npcById.get(strongestCandidate.victimId)?.name || strongestCandidate.victimId)}`
      : hotLocations[0]
        ? `Pressure is concentrating at ${hotLocations[0].name}`
        : "Town state is collecting its first observable signals";
  const recentSignals: TownSituationBrief["recentSignals"] = [];
  if (strongestCandidate) {
    recentSignals.push({
      kind: "case",
      label: strongestCandidate.validation.valid ? "Case ready" : "Case chain forming",
      detail: `${strongestCandidate.culpritId} -> ${strongestCandidate.victimId}; maturity ${strongestCandidate.maturityScore || 0}%`
    });
  }
  if (hotLocations[0]) {
    recentSignals.push({
      kind: "location",
      label: `Hot location: ${hotLocations[0].name}`,
      detail: `heat ${hotLocations[0].heat}, security ${hotLocations[0].security}, resource pressure ${hotLocations[0].resourcePressure}`
    });
  }
  if (riskAgents[0]) {
    recentSignals.push({
      kind: "agent",
      label: `High-risk NPC: ${riskAgents[0].name}`,
      detail: `secret risk ${riskAgents[0].secretRisk}, relationship pressure ${riskAgents[0].relationshipPressure}, suspicion ${riskAgents[0].suspicion}`
    });
  }
  if (observationMix.rumor || observationMix.deduced || observationMix.exclusion) {
    recentSignals.push({
      kind: "observation",
      label: "Observation network is active",
      detail: `direct ${observationMix.direct}, rumor ${observationMix.rumor}, deduced ${observationMix.deduced}, exclusion ${observationMix.exclusion}`
    });
  }
  return {
    worldId: world.id,
    runtimeId: activeRuntime.id,
    tick: activeRuntime.tick,
    status: activeRuntime.status,
    currentPhase,
    urgency,
    headline,
    nextAction: activeQueue.nextAction,
    hotLocations,
    riskAgents,
    actionMix,
    observationMix,
    caseReadiness: {
      candidateCount: activeQueue.candidates.length,
      validCount: activeQueue.validCount,
      triggeredCaseCount,
      highestMaturityScore,
      strongestCandidateId: strongestCandidate?.id
    },
    recentSignals
  };
}

function snapshotRuntime(runtime: PersistentTownRuntime): Omit<PersistentTownRuntime, "snapshots" | "scenarioRuns"> {
  const copy = cloneWorld(runtime as unknown as WorldState) as unknown as PersistentTownRuntime;
  delete copy.snapshots;
  delete copy.scenarioRuns;
  return copy;
}

function snapshotWorld(world: WorldState) {
  const copy = cloneWorld(world);
  delete copy.persistentRuntime;
  return copy as WorldState;
}

function uniqueAdded(after: string[], before: string[]) {
  const existing = new Set(before);
  return after.filter((id) => !existing.has(id));
}

function arrayChanged(before: string[], after: string[]) {
  return before.length !== after.length || before.some((value, index) => value !== after[index]);
}

export function createTownStateSnapshot(
  world: WorldState,
  events: WorldEvent[] = [],
  options: { label?: string; scenarioId?: string; branchId?: string; id?: string } = {}
): TownStateSnapshot {
  const runtimeWorld = world as RuntimeWorld;
  const runtime = runtimeWorld.persistentRuntime || createPersistentTownRuntime(world, events);
  const createdAt = new Date().toISOString();
  const suffix = options.branchId || "main";
  return {
    id: options.id || `snapshot-${world.id}-${runtime.tick}-${suffix}-${runtime.snapshots?.length || 0}`,
    worldId: world.id,
    runtimeId: runtime.id,
    scenarioId: options.scenarioId,
    branchId: options.branchId,
    label: options.label || `Tick ${runtime.tick}`,
    tick: runtime.tick,
    day: runtime.currentDay,
    time: runtime.currentTime,
    agentStates: runtime.agentStates.map((agent) => ({
      npcId: agent.npcId,
      currentGoal: agent.currentGoal,
      knownFactIds: [...agent.knownFactIds],
      resources: [...agent.resources],
      locationId: agent.locationId,
      relationshipPressure: agent.relationshipPressure,
      secretRisk: agent.secretRisk,
      fatigue: agent.fatigue,
      alertness: agent.alertness,
      socialProfile: agent.socialProfile
    })),
    locationProfiles: (runtime.locationProfiles || []).map((profile) => ({
      locationId: profile.locationId,
      heat: profile.heat,
      security: profile.security,
      footTraffic: profile.footTraffic,
      resourcePressure: profile.resourcePressure,
      factionInfluence: profile.factionInfluence
    })),
    decisionCount: runtime.decisionTraces.length,
    candidateSummaries: runtime.candidates.map((candidate) => ({
      id: candidate.id,
      status: candidate.status,
      culpritId: candidate.culpritId,
      victimId: candidate.victimId,
      pressureScore: candidate.pressureScore,
      valid: candidate.validation.valid,
      errorCount: candidate.validation.errors.length,
      maturityScore: candidate.maturityScore,
      triggeredEventId: candidate.triggeredEventId,
      chainCompleteness: candidate.chainCompleteness || candidate.validation.chainCompleteness
    })),
    eventIds: events.map((event) => event.id),
    memoryIds: (world.memories || []).map((memory) => memory.id),
    observationIds: (runtime.eventObservations || []).map((observation) => observation.id),
    interventionIds: runtime.interventions.map((intervention) => intervention.id),
    createdAt,
    checkpoint: {
      world: snapshotWorld(world),
      runtime: snapshotRuntime(runtime)
    }
  };
}

export function diffTownStateSnapshots(from: TownStateSnapshot, to: TownStateSnapshot): TownStateDiff {
  if (from.worldId !== to.worldId) throw new Error("Snapshots must belong to the same world.");
  const beforeAgents = new Map(from.agentStates.map((agent) => [agent.npcId, agent]));
  const afterAgents = new Map(to.agentStates.map((agent) => [agent.npcId, agent]));
  const changedAgents: TownStateAgentDiff[] = [];
  for (const npcId of new Set([...beforeAgents.keys(), ...afterAgents.keys()])) {
    const before = beforeAgents.get(npcId);
    const after = afterAgents.get(npcId);
    const changedFields: TownStateAgentDiff["changedFields"] = [];
    if (!before || !after || before.locationId !== after.locationId) changedFields.push("locationId");
    if (!before || !after || arrayChanged(before.resources, after.resources)) changedFields.push("resources");
    if (!before || !after || before.relationshipPressure !== after.relationshipPressure) changedFields.push("relationshipPressure");
    if (!before || !after || arrayChanged(before.knownFactIds, after.knownFactIds)) changedFields.push("knownFactIds");
    if (!before || !after || before.currentGoal !== after.currentGoal) changedFields.push("currentGoal");
    if (!before || !after || before.secretRisk !== after.secretRisk) changedFields.push("secretRisk");
    if (!before || !after || before.fatigue !== after.fatigue) changedFields.push("fatigue");
    if (!before || !after || before.alertness !== after.alertness) changedFields.push("alertness");
    if (!before || !after || JSON.stringify(before.socialProfile || null) !== JSON.stringify(after.socialProfile || null)) changedFields.push("socialProfile");
    if (changedFields.length) changedAgents.push({ npcId, before, after, changedFields });
  }
  const beforeLocations = new Map((from.locationProfiles || []).map((location) => [location.locationId, location]));
  const afterLocations = new Map((to.locationProfiles || []).map((location) => [location.locationId, location]));
  const changedLocations: TownStateLocationDiff[] = [];
  for (const locationId of new Set([...beforeLocations.keys(), ...afterLocations.keys()])) {
    const before = beforeLocations.get(locationId);
    const after = afterLocations.get(locationId);
    const changedFields: TownStateLocationDiff["changedFields"] = [];
    if (!before || !after || before.heat !== after.heat) changedFields.push("heat");
    if (!before || !after || before.security !== after.security) changedFields.push("security");
    if (!before || !after || before.footTraffic !== after.footTraffic) changedFields.push("footTraffic");
    if (!before || !after || before.resourcePressure !== after.resourcePressure) changedFields.push("resourcePressure");
    if (!before || !after || before.factionInfluence !== after.factionInfluence) changedFields.push("factionInfluence");
    if (changedFields.length) changedLocations.push({ locationId, before, after, changedFields });
  }
  const beforeCandidates = new Map(from.candidateSummaries.map((candidate) => [candidate.id, candidate]));
  const afterCandidates = new Map(to.candidateSummaries.map((candidate) => [candidate.id, candidate]));
  const candidateStatusChanges: TownStateCandidateDiff[] = [];
  for (const candidateId of new Set([...beforeCandidates.keys(), ...afterCandidates.keys()])) {
    const before = beforeCandidates.get(candidateId);
    const after = afterCandidates.get(candidateId);
    if (!before || !after || before.status !== after.status || before.valid !== after.valid) {
      candidateStatusChanges.push({
        candidateId,
        beforeStatus: before?.status,
        afterStatus: after?.status,
        beforeValid: before?.valid,
        afterValid: after?.valid
      });
    }
  }
  return {
    id: `diff-${from.id}-${to.id}`,
    worldId: from.worldId,
    fromSnapshotId: from.id,
    toSnapshotId: to.id,
    tickDelta: to.tick - from.tick,
    timeDeltaMinutes: (to.day - from.day) * 24 * 60 + timeToMinutes(to.time) - timeToMinutes(from.time),
    addedEventIds: uniqueAdded(to.eventIds, from.eventIds),
    addedMemoryIds: uniqueAdded(to.memoryIds, from.memoryIds),
    addedObservationIds: uniqueAdded(to.observationIds || [], from.observationIds || []),
    changedAgents,
    changedLocations,
    candidateStatusChanges,
    branchOnlyInterventionIds: uniqueAdded(to.interventionIds, from.interventionIds)
  };
}

export function rollbackTownRuntimeToSnapshot(world: WorldState, snapshot: TownStateSnapshot): { world: WorldState; runtime: PersistentTownRuntime } {
  if (snapshot.worldId !== world.id) throw new Error("Snapshot does not belong to this world.");
  if (!snapshot.checkpoint) throw new Error("Snapshot does not contain a rollback checkpoint.");
  const currentRuntime = (world as RuntimeWorld).persistentRuntime;
  const restoredWorld = cloneWorld(snapshot.checkpoint.world);
  const runtime: PersistentTownRuntime = {
    ...snapshotRuntime(snapshot.checkpoint.runtime as PersistentTownRuntime),
    status: "paused",
    scenarioRuns: currentRuntime?.scenarioRuns || [],
    snapshots: currentRuntime?.snapshots || [],
    updatedAt: new Date().toISOString()
  };
  restoredWorld.currentTime = runtime.currentTime;
  restoredWorld.day = runtime.currentDay;
  restoredWorld.updatedAt = runtime.updatedAt;
  restoredWorld.persistentRuntime = runtime;
  return { world: restoredWorld, runtime };
}

function normalizeScenarioConfig(world: WorldState, config: ScenarioConfig): Required<Pick<ScenarioConfig, "name" | "seed" | "baselineSteps">> & ScenarioConfig {
  return {
    ...config,
    name: config.name || "Town Counterfactual Scenario",
    seed: config.seed || `${world.seed}-scenario`,
    baselineSteps: Math.max(1, Math.min(48, config.baselineSteps || 6))
  };
}

function prepareScenarioStart(world: WorldState, events: WorldEvent[], config: ScenarioConfig) {
  let nextWorld = cloneWorld(world);
  nextWorld.seed = config.seed || world.seed;
  if (config.worldOptions?.mode) nextWorld.mode = config.worldOptions.mode;
  if (config.worldOptions?.timelineHours) nextWorld.timelineHours = config.worldOptions.timelineHours;
  if (config.worldOptions?.caseArchetype && config.worldOptions.caseArchetype !== "auto") nextWorld.plannedArchetype = config.worldOptions.caseArchetype;
  if (config.worldOptions?.npcCount && config.worldOptions.npcCount < nextWorld.npcs.length) {
    nextWorld.npcs = nextWorld.npcs.slice(0, Math.max(2, config.worldOptions.npcCount));
  }
  let nextEvents = [...events];
  const preSimDays = Math.max(0, Math.min(7, config.worldOptions?.preSimDays || 0));
  if (preSimDays) {
    const preSim = simulateDailyLife(nextWorld, preSimDays, nextEvents);
    nextWorld = preSim.world as RuntimeWorld;
    nextEvents = [...nextEvents, ...preSim.events];
  }
  nextWorld.persistentRuntime = createPersistentTownRuntime(nextWorld, nextEvents);
  return { world: nextWorld, events: nextEvents };
}

function runScenarioBranch(
  startWorld: RuntimeWorld,
  startEvents: WorldEvent[],
  scenarioId: string,
  branch: ScenarioBranchConfig
) {
  let branchWorld = cloneWorld(startWorld);
  branchWorld.persistentRuntime = createPersistentTownRuntime(branchWorld, startEvents);
  let branchEvents = [...startEvents];
  const startSnapshot = createTownStateSnapshot(branchWorld, branchEvents, {
    id: `snapshot-${scenarioId}-${branch.id}-start`,
    label: `${branch.name} start`,
    scenarioId,
    branchId: branch.id
  });
  const steps = Math.max(1, Math.min(48, branch.steps || 6));
  for (let offset = 0; offset < steps; offset += 1) {
    for (const scheduled of branch.interventions.filter((item) => item.atTickOffset === offset)) {
      const applied = applyTownRuntimeIntervention(branchWorld, scheduled.intervention);
      branchWorld = applied.world as RuntimeWorld;
    }
    const advanced = advancePersistentTownTick(branchWorld, branchEvents, { steps: 1, status: "running" });
    branchWorld = advanced.world as RuntimeWorld;
    branchEvents = [...branchEvents, ...advanced.events];
  }
  const endSnapshot = createTownStateSnapshot(branchWorld, branchEvents, {
    id: `snapshot-${scenarioId}-${branch.id}-end`,
    label: `${branch.name} end`,
    scenarioId,
    branchId: branch.id
  });
  return { world: branchWorld, events: branchEvents, startSnapshot, endSnapshot, steps };
}

export function runTownScenario(world: WorldState, events: WorldEvent[] = [], input: ScenarioConfig = {}) {
  const config = normalizeScenarioConfig(world, input);
  const scenarioId = input.id || `scenario-${config.seed.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`;
  const startedAt = new Date().toISOString();
  const prepared = prepareScenarioStart(world, events, config);
  if (!config.branches?.length) {
    const actorId = prepared.world.persistentRuntime?.agentStates[0]?.npcId || prepared.world.npcs[0]?.id;
    config.branches = actorId
      ? [{
          id: "resource-intervention",
          name: "Resource intervention",
          steps: config.baselineSteps,
          interventions: [{
            atTickOffset: Math.min(1, config.baselineSteps - 1),
            intervention: { actorId, kind: "resource", value: "resource:scenario-counterfactual" }
          }]
        }]
      : [];
  }
  const baselineStart = createTownStateSnapshot(prepared.world, prepared.events, {
    id: `snapshot-${scenarioId}-baseline-start`,
    label: "Baseline start",
    scenarioId,
    branchId: "baseline"
  });
  const baselineResult = advancePersistentTownTick(prepared.world, prepared.events, { steps: config.baselineSteps, status: "running" });
  const baselineWorld = baselineResult.world as RuntimeWorld;
  const baselineEvents = [...prepared.events, ...baselineResult.events];
  const baselineEnd = createTownStateSnapshot(baselineWorld, baselineEvents, {
    id: `snapshot-${scenarioId}-baseline-end`,
    label: "Baseline end",
    scenarioId,
    branchId: "baseline"
  });
  const branchRuns: ScenarioBranchRun[] = [];
  const branchSnapshots: TownStateSnapshot[] = [];
  for (const branch of config.branches || []) {
    const branchResult = runScenarioBranch(prepared.world, prepared.events, scenarioId, branch);
    const branchRuntime = branchResult.world.persistentRuntime as PersistentTownRuntime;
    branchSnapshots.push(branchResult.startSnapshot, branchResult.endSnapshot);
    branchRuns.push({
      id: branch.id,
      name: branch.name,
      status: branchRuntime.status === "blocked" ? "blocked" : "completed",
      steps: branchResult.steps,
      interventionIds: branchRuntime.interventions.map((intervention) => intervention.id),
      eventGrowth: branchResult.endSnapshot.eventIds.length - branchResult.startSnapshot.eventIds.length,
      memoryGrowth: branchResult.endSnapshot.memoryIds.length - branchResult.startSnapshot.memoryIds.length,
      validCandidateCount: branchRuntime.candidates.filter((candidate) => candidate.validation.valid).length,
      blockedCandidateCount: branchRuntime.candidates.filter((candidate) => !candidate.validation.valid).length,
      startSnapshotId: branchResult.startSnapshot.id,
      endSnapshotId: branchResult.endSnapshot.id,
      diffFromBaseline: diffTownStateSnapshots(baselineEnd, branchResult.endSnapshot)
    });
  }
  const runtime = baselineWorld.persistentRuntime as PersistentTownRuntime;
  const criteria: Required<ScenarioPassCriteria> = {
    minValidCandidates: config.passCriteria?.minValidCandidates ?? 0,
    requireHardLogic: config.passCriteria?.requireHardLogic ?? false,
    maxBlockedCandidates: config.passCriteria?.maxBlockedCandidates ?? Number.MAX_SAFE_INTEGER,
    minEventGrowth: config.passCriteria?.minEventGrowth ?? 1,
    minMemoryGrowth: config.passCriteria?.minMemoryGrowth ?? 1
  };
  const validCandidateCount = runtime.candidates.filter((candidate) => candidate.validation.valid).length;
  const blockedCandidateCount = runtime.candidates.filter((candidate) => !candidate.validation.valid).length;
  const hardLogicPassCount = runtime.candidates.filter((candidate) => candidate.validation.hardLogicValid).length;
  const eventGrowth = baselineEnd.eventIds.length - baselineStart.eventIds.length;
  const memoryGrowth = baselineEnd.memoryIds.length - baselineStart.memoryIds.length;
  const checks: ScenarioReportCheck[] = [
    { id: "minValidCandidates", label: "Valid candidates", passed: validCandidateCount >= criteria.minValidCandidates, actual: validCandidateCount, expected: criteria.minValidCandidates },
    { id: "requireHardLogic", label: "Hard logic", passed: !criteria.requireHardLogic || hardLogicPassCount > 0, actual: hardLogicPassCount > 0, expected: criteria.requireHardLogic },
    { id: "maxBlockedCandidates", label: "Blocked candidates", passed: blockedCandidateCount <= criteria.maxBlockedCandidates, actual: blockedCandidateCount, expected: criteria.maxBlockedCandidates },
    { id: "minEventGrowth", label: "Event growth", passed: eventGrowth >= criteria.minEventGrowth, actual: eventGrowth, expected: criteria.minEventGrowth },
    { id: "minMemoryGrowth", label: "Memory growth", passed: memoryGrowth >= criteria.minMemoryGrowth, actual: memoryGrowth, expected: criteria.minMemoryGrowth }
  ];
  const passed = checks.every((check) => check.passed);
  const report: ScenarioReport = {
    scenarioId,
    name: config.name,
    passed,
    checks,
    baseline: {
      steps: config.baselineSteps,
      eventGrowth,
      memoryGrowth,
      validCandidateCount,
      blockedCandidateCount,
      hardLogicPassCount,
      startSnapshotId: baselineStart.id,
      endSnapshotId: baselineEnd.id
    },
    branches: branchRuns,
    summary: `${passed ? "Passed" : "Failed"}: baseline produced ${eventGrowth} events and ${memoryGrowth} memories; ${branchRuns.length} counterfactual branches compared.`
  };
  const completedAt = new Date().toISOString();
  const run: ScenarioRun = {
    id: scenarioId,
    name: config.name,
    config,
    status: passed ? "passed" : "failed",
    baselineSnapshotId: baselineStart.id,
    finalSnapshotId: baselineEnd.id,
    report,
    startedAt,
    completedAt
  };
  runtime.status = "paused";
  runtime.scenarioRuns = [run, ...(runtime.scenarioRuns || []).filter((item) => item.id !== run.id)].slice(0, 20);
  runtime.snapshots = [baselineStart, baselineEnd, ...branchSnapshots, ...(runtime.snapshots || []).filter((item) => item.scenarioId !== scenarioId)].slice(0, 100);
  runtime.updatedAt = completedAt;
  baselineWorld.persistentRuntime = runtime;
  baselineWorld.updatedAt = completedAt;
  return { world: baselineWorld as WorldState, runtime, events: baselineResult.events, run, report, snapshots: runtime.snapshots };
}

export function applyTownRuntimeIntervention(world: WorldState, intervention: Omit<TownRuntimeIntervention, "id" | "tick" | "createdAt" | "branch" | "impact">): { world: WorldState; runtime: PersistentTownRuntime; intervention: TownRuntimeIntervention } {
  const nextWorld = cloneWorld(world);
  const runtime = nextWorld.persistentRuntime || createPersistentTownRuntime(nextWorld, []);
  const created: TownRuntimeIntervention = {
    id: `intervention-${runtime.tick}-${intervention.actorId}-${runtime.interventions.length}`,
    tick: runtime.tick,
    createdAt: new Date().toISOString(),
    branch: "counterfactual",
    ...intervention,
    impact: intervention.kind === "action-bias"
      ? `Director bias favors ${intervention.value} for ${intervention.actorId} on the next tick without forcing illegal actions.`
      : `${intervention.kind} changed for ${intervention.actorId}; next tick will mark affected decisions as counterfactual.`
  };
  const agent = runtime.agentStates.find((state) => state.npcId === intervention.actorId);
  if (agent) {
    if (intervention.kind === "goal") agent.currentGoal = String(intervention.value);
    if (intervention.kind === "location") agent.locationId = String(intervention.value);
    if (intervention.kind === "resource") agent.resources = Array.from(new Set([...agent.resources, String(intervention.value)]));
    if (intervention.kind === "relationship-pressure") agent.relationshipPressure = Number(intervention.value);
    if (intervention.kind === "knowledge") agent.knownFactIds = Array.from(new Set([...agent.knownFactIds, String(intervention.value)]));
    agent.nextActionPreview = intervention.kind === "action-bias"
      ? `Director bias pending: ${intervention.value}`
      : "Counterfactual intervention will be considered on the next tick.";
  }
  runtime.interventions.push(created);
  runtime.updatedAt = new Date().toISOString();
  nextWorld.persistentRuntime = runtime;
  nextWorld.updatedAt = runtime.updatedAt;
  return { world: nextWorld, runtime, intervention: created };
}

function createTownTickContext(world: RuntimeWorld, baseEvents: WorldEvent[], runtime: PersistentTownRuntime, createdEvents: WorldEvent[]): TownTickContext {
  runtime.simulationPhases = [...TOWN_TICK_PHASES];
  runtime.pressureLedger ||= [];
  runtime.eventObservations ||= [];
  runtime.memoryPropagations ||= [];
  runtime.consequences ||= [];
  return {
    world,
    baseEvents,
    runtime,
    allEvents: [...baseEvents, ...createdEvents],
    createdEvents,
    createdMemories: [],
    createdObservations: [],
    createdConsequences: [],
    decisionIds: [],
    phases: [...TOWN_TICK_PHASES]
  };
}

function advanceTownClock(ctx: TownTickContext) {
  ctx.runtime.tick += 1;
  const currentMinutes = timeToMinutes(ctx.runtime.currentTime) + ctx.runtime.tickIntervalMinutes;
  if (currentMinutes >= 24 * 60) ctx.runtime.currentDay += 1;
  ctx.runtime.currentTime = minutesToTime(currentMinutes);
  ctx.world.day = ctx.runtime.currentDay;
  ctx.world.currentTime = ctx.runtime.currentTime;
}

function phaseObserveTown(ctx: TownTickContext) {
  decayLocationProfiles(ctx.world, ctx.runtime);
  for (const pressure of computeSocialPressures(ctx.world, ctx.allEvents).filter((item) => item.score >= 3).slice(0, 6)) {
    ctx.runtime.pressureLedger!.push({
      tick: ctx.runtime.tick,
      npcId: pressure.npcId,
      targetNpcId: pressure.targetId,
      score: pressure.score,
      sourceEventIds: [...pressure.sourceEventIds],
      reason: `secret ${pressure.secretRisk} / tension ${pressure.relationshipTension} / means ${pressure.meansAccess} / opportunity ${pressure.opportunityWindow}`
    });
  }
  ctx.runtime.pressureLedger = ctx.runtime.pressureLedger!.slice(-120);
}

function phaseUpdateGoals(ctx: TownTickContext) {
  ensureSocialProfiles(ctx.world, ctx.runtime);
  ctx.runtime.agentStates = ctx.world.npcs
    .map((npc) => deriveNpcAgentState(ctx.world, npc, ctx.allEvents, ctx.runtime));
}

function selectTickActors(ctx: TownTickContext) {
  const living = ctx.world.npcs.filter((npc) => npc.alive);
  const random = makeRandom(`${ctx.world.seed}:persistent:${ctx.runtime.tick}`);
  const actorCount = Math.min(3, living.length);
  return [...living].sort((a, b) => {
    const aState = deriveNpcAgentState(ctx.world, a, ctx.allEvents, ctx.runtime);
    const bState = deriveNpcAgentState(ctx.world, b, ctx.allEvents, ctx.runtime);
    return bState.goalPriority + random() - (aState.goalPriority + random());
  }).slice(0, actorCount);
}

function selectActionCandidate(runtime: PersistentTownRuntime, npc: NPCProfile, candidates: NpcActionCandidate[], actorIndex: number) {
  const legalCandidates = candidates.filter((candidate) => candidate.legal).sort((a, b) => b.score.total - a.score.total);
  const topCandidate = legalCandidates[0] || candidates[0];
  const phaseKinds: NpcActionKind[] = ["pressure", "obtain-resource", "investigate", "cover-up", "spread-rumor", "seek-alibi"];
  const phasePreferred = legalCandidates.find((candidate) => candidate.kind === phaseKinds[(runtime.tick + actorIndex) % phaseKinds.length]);
  const biasedCandidate = legalCandidates.find((candidate) => (candidate.score.directorBias || 0) > 0);
  return biasedCandidate || (phasePreferred && phasePreferred.score.total >= topCandidate.score.total - 12 ? phasePreferred : topCandidate);
}

function phaseExecuteAgentAction(ctx: TownTickContext, npc: NPCProfile, selectedActors: NPCProfile[], actorIndex: number) {
  const candidates = scoreNpcActionCandidates(ctx.world, npc, ctx.allEvents, ctx.runtime);
  const selected = selectActionCandidate(ctx.runtime, npc, candidates, actorIndex);
  const traceId = `decision-${ctx.world.id}-${ctx.runtime.tick}-${npc.id}`;
  const intervention = ctx.runtime.interventions.find((item) =>
    item.actorId === npc.id &&
    item.tick === ctx.runtime.tick - 1 &&
    (item.kind !== "action-bias" || item.value === selected.kind)
  );
  const definition = getTownActionDefinition(selected.kind);
  const beforeObservationIds = new Set((ctx.runtime.eventObservations || []).map((observation) => observation.id));
  const event = definition.execute({ world: ctx.world, runtime: ctx.runtime, npc, candidate: selected, intervention, allEvents: ctx.allEvents });
  ctx.createdEvents.push(event);
  ctx.allEvents = [...ctx.baseEvents, ...ctx.createdEvents];
  const participantMemories = observeEventParticipants(ctx.world, ctx.runtime, event, npc.id, selected.targetNpcId);
  const propagatedMemories = propagateEventMemories(ctx.world, ctx.runtime, event, npc.id, selected.targetNpcId);
  const memoryIds = [...participantMemories, ...propagatedMemories].map((item) => item.id);
  ctx.createdMemories.push(...participantMemories, ...propagatedMemories);
  const observationIds = (ctx.runtime.eventObservations || [])
    .filter((observation) => !beforeObservationIds.has(observation.id))
    .map((observation) => observation.id);
  ctx.createdObservations.push(...(ctx.runtime.eventObservations || []).filter((observation) => observationIds.includes(observation.id)));
  const consequence = buildActionConsequence(ctx.runtime, npc.id, selected, event, memoryIds);
  ctx.runtime.consequences = [consequence, ...(ctx.runtime.consequences || [])].slice(0, 160);
  ctx.createdConsequences.push(consequence);
  const trace: AgentDecisionTrace = {
    id: traceId,
    tick: ctx.runtime.tick,
    day: ctx.runtime.currentDay,
    time: ctx.runtime.currentTime,
    npcId: npc.id,
    observedEventIds: deriveNpcAgentState(ctx.world, npc, ctx.allEvents, ctx.runtime).knownFactIds.slice(-5),
    memoryIds,
    candidates,
    selectedCandidateId: selected.id,
    createdEventId: event.id,
    interventionId: intervention?.id,
    phases: [...ctx.phases],
    propagatedMemoryIds: propagatedMemories.map((item) => item.id),
    observationIds,
    consequence
  };
  ctx.runtime.decisionTraces.push(trace);
  ctx.decisionIds.push(trace.id);
  const agent = deriveNpcAgentState(ctx.world, npc, ctx.allEvents, ctx.runtime);
  agent.locationId = selected.targetLocationId;
  agent.lastDecisionId = trace.id;
  agent.nextActionPreview = selected.description;
  applyConsequenceToAgent(agent, consequence, event, selected, memoryIds);
  evolveRelationship(ctx.world, npc.id, selected);
  updateSocialAfterAction(ctx.world, ctx.runtime, npc.id, selected, event);
  updateLocationAfterAction(ctx.world, ctx.runtime, selected, event);
  agent.socialProfile = deriveNpcAgentState(ctx.world, npc, ctx.allEvents, ctx.runtime).socialProfile;
  ctx.runtime.agentStates = [agent, ...ctx.runtime.agentStates.filter((state) => state.npcId !== npc.id)];
}

function phaseExecuteActions(ctx: TownTickContext) {
  const selectedActors = selectTickActors(ctx);
  selectedActors.forEach((npc, index) => phaseExecuteAgentAction(ctx, npc, selectedActors, index));
}

function phaseAdvanceCaseChain(ctx: TownTickContext) {
  triggerLongChainCaseIfReady(ctx.world, ctx.runtime, ctx.allEvents, ctx.createdEvents);
  ctx.allEvents = [...ctx.baseEvents, ...ctx.createdEvents];
  refreshLongChainLedger(ctx.world, ctx.allEvents, ctx.runtime);
}

function phaseExtractCandidates(ctx: TownTickContext) {
  ctx.runtime.candidates = buildCaseCandidatesFromRuntime(ctx.world, ctx.allEvents, ctx.runtime).slice(0, 8);
}

function finalizeTownTick(ctx: TownTickContext) {
  const report: PersistentTownRuntimeReport = {
    tick: ctx.runtime.tick,
    status: ctx.runtime.status,
    eventIds: ctx.createdEvents.slice(-ctx.decisionIds.length).map((event) => event.id),
    decisionIds: ctx.decisionIds,
    candidateIds: ctx.runtime.candidates.map((candidate) => candidate.id)
  };
  if (!ctx.runtime.candidates.some((candidate) => candidate.validation.valid) && ctx.runtime.tick >= ctx.runtime.maxTicks) {
    report.blockedReason = "No valid case candidate reached motive + means + opportunity + memory support before max ticks.";
    ctx.runtime.status = "blocked";
  }
  ctx.runtime.reports.push(report);
  ctx.world.persistentRuntime = ctx.runtime;
  const tickSnapshot = createTownStateSnapshot(ctx.world, ctx.allEvents, {
    id: `snapshot-${ctx.world.id}-tick-${ctx.runtime.tick}`,
    label: `Tick ${ctx.runtime.tick}`
  });
  ctx.runtime.snapshots = [tickSnapshot, ...(ctx.runtime.snapshots || []).filter((snapshot) => snapshot.id !== tickSnapshot.id)].slice(0, 30);
}

function runTownTickPhases(ctx: TownTickContext) {
  advanceTownClock(ctx);
  phaseObserveTown(ctx);
  phaseUpdateGoals(ctx);
  phaseExecuteActions(ctx);
  phaseAdvanceCaseChain(ctx);
  phaseExtractCandidates(ctx);
  finalizeTownTick(ctx);
}

export function advancePersistentTownTick(world: WorldState, events: WorldEvent[] = [], options: { steps?: number; status?: PersistentTownRuntimeStatus } = {}) {
  let nextWorld = cloneWorld(world);
  let runtime = nextWorld.persistentRuntime || createPersistentTownRuntime(nextWorld, events);
  runtime.status = options.status || runtime.status || "running";
  const createdEvents: WorldEvent[] = [];
  const steps = Math.max(1, Math.min(60, options.steps || 1));
  for (let step = 0; step < steps; step += 1) {
    if (runtime.tick >= runtime.maxTicks) {
      runtime.status = "completed";
      break;
    }
    runTownTickPhases(createTownTickContext(nextWorld, events, runtime, createdEvents));
  }
  runtime.updatedAt = new Date().toISOString();
  nextWorld.updatedAt = runtime.updatedAt;
  nextWorld.persistentRuntime = runtime;
  return { world: nextWorld as WorldState, runtime, events: createdEvents, queue: buildTownEmergenceQueue(nextWorld, [...events, ...createdEvents], runtime) };
}
