import { extractCaseFromWorld, validateWorldCase } from "./world-case";
import { computeSocialPressures, simulateDailyLife, simulateWorldTick } from "./world-simulator";
import type { CaseFromLog, MemoryRecord, MurderArchetype, NPCProfile, SocialPressure, WorldEvent, WorldMode, WorldState } from "./world-types";

export type PersistentTownRuntimeStatus = "paused" | "running" | "completed" | "blocked";

export type NpcActionKind = "move" | "observe" | "talk" | "confront" | "obtain-resource" | "hide-trace";

export type NpcActionScore = {
  goalPriority: number;
  knownInformation: number;
  relationshipPressure: number;
  resourceAvailability: number;
  locationReachability: number;
  risk: number;
  evidenceConsistency: number;
  caseImpact: number;
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
};

export type CaseCandidateValidation = {
  valid: boolean;
  hardLogicValid: boolean;
  uniqueCulprit: boolean;
  worldBackedEvidence: boolean;
  memoryScopedTestimony: boolean;
  nonCulpritExcluded: boolean;
  timelineClosed: boolean;
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
  motiveGap?: string;
  meansGap?: string;
  exclusionGap?: string;
  timelineGap?: string;
  validation: CaseCandidateValidation;
  caseId?: string;
};

export type TownRuntimeIntervention = {
  id: string;
  tick: number;
  actorId: string;
  kind: "goal" | "location" | "resource" | "relationship-pressure" | "knowledge";
  value: string | number | boolean;
  createdAt: string;
  branch: "counterfactual";
  impact: string;
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

export type TownStateSnapshotAgent = Pick<NpcAgentState, "npcId" | "currentGoal" | "knownFactIds" | "resources" | "locationId" | "relationshipPressure" | "secretRisk" | "fatigue" | "alertness">;

export type TownStateSnapshotCandidate = Pick<CaseCandidate, "id" | "status" | "culpritId" | "victimId" | "pressureScore"> & {
  valid: boolean;
  errorCount: number;
};

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
  decisionCount: number;
  candidateSummaries: TownStateSnapshotCandidate[];
  eventIds: string[];
  memoryIds: string[];
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
  changedFields: Array<"locationId" | "resources" | "relationshipPressure" | "knownFactIds" | "currentGoal" | "secretRisk" | "fatigue" | "alertness">;
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
  changedAgents: TownStateAgentDiff[];
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
  const currentGoal = existing?.currentGoal || (secretRisk >= 8 ? "Protect secret before it becomes public" : pressure >= 6 ? "Reduce relationship pressure" : "Follow daily schedule");
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
    nextActionPreview: existing?.nextActionPreview
  };
}

function scoreCandidate(input: {
  world: WorldState;
  npc: NPCProfile;
  state: NpcAgentState;
  candidate: Omit<NpcActionCandidate, "score">;
  events: WorldEvent[];
}) {
  const { world, npc, state, candidate, events } = input;
  const visibleKnown = state.knownFactIds.length;
  const resourceOk = !candidate.resourceId || state.resources.includes(candidate.resourceId) || npc.skills.some((skill) => candidate.resourceId?.includes(skill));
  const reachable = locationReachable(world, state.locationId, candidate.targetLocationId);
  const risk = candidate.kind === "confront" || candidate.kind === "hide-trace" ? state.secretRisk : Math.max(1, Math.floor(state.fatigue / 2));
  const evidenceConsistency = events.some((event) => state.knownFactIds.includes(event.id)) ? 8 : 5;
  const caseImpact = candidate.kind === "confront" ? 9 : candidate.kind === "obtain-resource" ? 7 : candidate.kind === "hide-trace" ? 8 : 4;
  const score: NpcActionScore = {
    goalPriority: state.goalPriority,
    knownInformation: Math.min(10, visibleKnown),
    relationshipPressure: Math.min(10, state.relationshipPressure),
    resourceAvailability: resourceOk ? 8 : 0,
    locationReachability: reachable ? 8 : 0,
    risk,
    evidenceConsistency,
    caseImpact,
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
    score.caseImpact -
    Math.floor(score.risk / 2);
  if (!resourceOk) score.reasons.push("required resource is not available");
  if (!reachable) score.reasons.push("target location is not reachable from current location");
  if (state.secretRisk >= 8) score.reasons.push("secret risk is high enough to influence action");
  if (state.relationshipPressure >= 8) score.reasons.push("relationship pressure is high");
  if (candidate.kind === "confront") score.reasons.push("candidate can create a case-forming conflict chain");
  return score;
}

export function scoreNpcActionCandidates(world: WorldState, npc: NPCProfile, events: WorldEvent[] = [], runtime?: PersistentTownRuntime | null): NpcActionCandidate[] {
  const state = deriveNpcAgentState(world, npc, events, runtime);
  const random = makeRandom(`${world.seed}:agent:${npc.id}:${runtime?.tick || 0}`);
  const locations = world.locations.length ? world.locations : [{ id: state.locationId }] as { id: string }[];
  const pressureTarget = computeSocialPressures(world, events).find((pressure) => pressure.npcId === npc.id)?.targetId;
  const targetNpcId = pressureTarget || Object.keys(npc.relationships)[0];
  const targetNpc = world.npcs.find((item) => item.id === targetNpcId);
  const targetLocationId = targetNpc ? locationForNpc(targetNpc, runtime?.currentTime || world.currentTime || "08:00") : locations[Math.floor(random() * locations.length)]?.id || state.locationId;
  const base: Array<Omit<NpcActionCandidate, "score">> = [
    {
      id: `candidate:${npc.id}:${runtime?.tick || 0}:observe`,
      npcId: npc.id,
      kind: "observe",
      targetLocationId: state.locationId,
      description: `${npc.name} reviews nearby events and updates memory.`,
      legal: true
    },
    {
      id: `candidate:${npc.id}:${runtime?.tick || 0}:move`,
      npcId: npc.id,
      kind: "move",
      targetLocationId,
      description: `${npc.name} moves toward ${targetLocationId} to follow the current plan.`,
      legal: locationReachable(world, state.locationId, targetLocationId)
    },
    {
      id: `candidate:${npc.id}:${runtime?.tick || 0}:talk`,
      npcId: npc.id,
      kind: "talk",
      targetLocationId,
      targetNpcId,
      description: `${npc.name} talks with ${targetNpc?.name || targetNpcId || "a witness"} about recent pressure.`,
      legal: Boolean(targetNpcId)
    },
    {
      id: `candidate:${npc.id}:${runtime?.tick || 0}:confront`,
      npcId: npc.id,
      kind: "confront",
      targetLocationId,
      targetNpcId,
      description: `${npc.name} confronts ${targetNpc?.name || targetNpcId || "a rival"} as secret risk rises.`,
      legal: Boolean(targetNpcId) && state.relationshipPressure >= 4
    },
    {
      id: `candidate:${npc.id}:${runtime?.tick || 0}:resource`,
      npcId: npc.id,
      kind: "obtain-resource",
      targetLocationId: world.locations.find((location) => location.kind === "restricted" || location.kind === "work")?.id || state.locationId,
      resourceId: npc.skills.includes("medicine") ? "resource:medicine" : npc.skills.includes("mechanical") ? "resource:tool" : "resource:local-access",
      description: `${npc.name} tries to obtain a resource relevant to their skills.`,
      legal: true
    }
  ];
  return base.map((candidate) => {
    const score = scoreCandidate({ world, npc, state, candidate, events });
    return { ...candidate, legal: candidate.legal && score.locationReachability > 0 && score.resourceAvailability > 0, blockedReason: score.reasons.find((reason) => reason.includes("not")), score };
  });
}

function addRuntimeMemory(world: RuntimeWorld, event: WorldEvent, npcId: string, summary: string): MemoryRecord {
  const memory: MemoryRecord = {
    id: `mem-${event.id}-${npcId}-agent`,
    worldId: world.id,
    npcId,
    kind: event.hidden ? "secret" : "direct",
    eventId: event.id,
    day: event.day,
    summary,
    confidence: event.hidden ? 0.72 : 0.88,
    visibleToPlayer: !event.hidden,
    challengeableEvidenceIds: event.evidenceId ? [event.evidenceId] : []
  };
  world.memories ||= [];
  if (!world.memories.some((item) => item.id === memory.id)) world.memories.push(memory);
  const npc = world.npcs.find((item) => item.id === npcId);
  if (npc && !npc.memoryEventIds.includes(event.id)) npc.memoryEventIds.push(event.id);
  return memory;
}

function eventTypeForAction(kind: NpcActionKind): WorldEvent["type"] {
  if (kind === "move") return "move";
  if (kind === "confront") return "conflict";
  if (kind === "obtain-resource") return "obtain_item";
  if (kind === "hide-trace") return "destroy_evidence";
  return "conversation";
}

function eventTagsForAction(candidate: NpcActionCandidate) {
  const tags = ["agent_tick", candidate.kind];
  if (candidate.kind === "confront") tags.push("tension", "secret_leak", "opportunity_window");
  if (candidate.kind === "obtain-resource") tags.push("means_access");
  if (candidate.kind === "hide-trace") tags.push("staging");
  return tags;
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
    scenarioRuns: [],
    snapshots: [],
    createdAt: now,
    updatedAt: now
  };
  runtime.agentStates = world.npcs.filter((npc) => npc.alive).map((npc) => deriveNpcAgentState(world, npc, events, runtime));
  return runtime;
}

export function buildCaseCandidatesFromRuntime(world: WorldState, events: WorldEvent[] = [], runtime?: PersistentTownRuntime | null): CaseCandidate[] {
  const activeRuntime = runtime || getRuntime(world as RuntimeWorld) || createPersistentTownRuntime(world, events);
  const pressures = computeSocialPressures(world, events);
  const sortedPressures = pressures.filter((pressure) => pressure.score >= 5).slice(0, 5);
  const candidates = sortedPressures.map((pressure, index): CaseCandidate => {
    const memoryIds = (world.memories || [])
      .filter((memory) => pressure.sourceEventIds.includes(memory.eventId) && [pressure.npcId, pressure.targetId].includes(memory.npcId))
      .map((memory) => memory.id);
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
      riskChainEventIds: pressure.sourceEventIds,
      memoryIds,
      goalIds,
      validation: {
        valid: false,
        hardLogicValid: false,
        uniqueCulprit: false,
        worldBackedEvidence: false,
        memoryScopedTestimony: memoryIds.length > 0,
        nonCulpritExcluded: false,
        timelineClosed: pressure.sourceEventIds.length >= 2,
        errors: [],
        warnings: []
      }
    };
    candidate.validation = validateCaseCandidate(world, events, candidate);
    candidate.status = candidate.validation.valid ? "valid" : "invalid";
    return candidate;
  });
  return candidates.length ? candidates : activeRuntime.candidates;
}

export function validateCaseCandidate(world: WorldState, events: WorldEvent[] = [], candidate: CaseCandidate): CaseCandidateValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const culprit = world.npcs.find((npc) => npc.id === candidate.culpritId);
  const victim = world.npcs.find((npc) => npc.id === candidate.victimId);
  const sourceEvents = events.filter((event) => candidate.riskChainEventIds.includes(event.id));
  const hasMotive = candidate.pressureScore >= 7 || sourceEvents.some((event) => event.tags.includes("secret_leak") || event.tags.includes("tension"));
  const hasMeans = events.some((event) => event.actorIds.includes(candidate.culpritId) && (event.tags.includes("means_access") || event.type === "obtain_item"));
  const hasOpportunity = sourceEvents.some((event) => event.tags.includes("opportunity_window") || event.locationId);
  const memoryScopedTestimony = candidate.memoryIds.every((id) => (world.memories || []).some((memory) => memory.id === id));
  if (!culprit) errors.push("culprit candidate is missing from world");
  if (!victim) errors.push("victim candidate is missing from world");
  if (candidate.culpritId === candidate.victimId) errors.push("culprit and victim cannot be the same NPC");
  if (!hasMotive) errors.push("motive insufficient: pressure chain is too weak");
  if (!hasMeans) errors.push("means insufficient: no resource or means-access event");
  if (!hasOpportunity) errors.push("opportunity insufficient: no reachable opportunity event");
  if (!memoryScopedTestimony) errors.push("memory scope broken: candidate references unknown memories");
  if (candidate.riskChainEventIds.length < 2) warnings.push("timeline is shallow: fewer than two risk-chain events");
  const valid = errors.length === 0 && hasMotive && hasMeans && hasOpportunity && memoryScopedTestimony;
  return {
    valid,
    hardLogicValid: false,
    uniqueCulprit: valid,
    worldBackedEvidence: sourceEvents.length === candidate.riskChainEventIds.length && candidate.riskChainEventIds.length > 0,
    memoryScopedTestimony,
    nonCulpritExcluded: false,
    timelineClosed: candidate.riskChainEventIds.length >= 2,
    errors,
    warnings
  };
}

export function extractPlayableCaseFromCandidate(world: WorldState, events: WorldEvent[] = [], candidate: CaseCandidate): { world: WorldState; events: WorldEvent[]; activeCase: CaseFromLog; candidate: CaseCandidate } {
  const tick = simulateWorldTick(world, events);
  const allEvents = [...events, ...tick.events];
  const activeCase = extractCaseFromWorld(tick.world, allEvents);
  const validation = validateWorldCase(tick.world, allEvents, activeCase.deductionCase);
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
      alertness: agent.alertness
    })),
    decisionCount: runtime.decisionTraces.length,
    candidateSummaries: runtime.candidates.map((candidate) => ({
      id: candidate.id,
      status: candidate.status,
      culpritId: candidate.culpritId,
      victimId: candidate.victimId,
      pressureScore: candidate.pressureScore,
      valid: candidate.validation.valid,
      errorCount: candidate.validation.errors.length
    })),
    eventIds: events.map((event) => event.id),
    memoryIds: (world.memories || []).map((memory) => memory.id),
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
    if (changedFields.length) changedAgents.push({ npcId, before, after, changedFields });
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
    changedAgents,
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
    impact: `${intervention.kind} changed for ${intervention.actorId}; next tick will mark affected decisions as counterfactual.`
  };
  const agent = runtime.agentStates.find((state) => state.npcId === intervention.actorId);
  if (agent) {
    if (intervention.kind === "goal") agent.currentGoal = String(intervention.value);
    if (intervention.kind === "location") agent.locationId = String(intervention.value);
    if (intervention.kind === "resource") agent.resources = Array.from(new Set([...agent.resources, String(intervention.value)]));
    if (intervention.kind === "relationship-pressure") agent.relationshipPressure = Number(intervention.value);
    if (intervention.kind === "knowledge") agent.knownFactIds = Array.from(new Set([...agent.knownFactIds, String(intervention.value)]));
    agent.nextActionPreview = "Counterfactual intervention will be considered on the next tick.";
  }
  runtime.interventions.push(created);
  runtime.updatedAt = new Date().toISOString();
  nextWorld.persistentRuntime = runtime;
  nextWorld.updatedAt = runtime.updatedAt;
  return { world: nextWorld, runtime, intervention: created };
}

export function advancePersistentTownTick(world: WorldState, events: WorldEvent[] = [], options: { steps?: number; status?: PersistentTownRuntimeStatus } = {}) {
  let nextWorld = cloneWorld(world);
  let runtime = nextWorld.persistentRuntime || createPersistentTownRuntime(nextWorld, events);
  runtime.status = options.status || runtime.status || "running";
  const createdEvents: WorldEvent[] = [];
  const steps = Math.max(1, Math.min(12, options.steps || 1));
  for (let step = 0; step < steps; step += 1) {
    if (runtime.tick >= runtime.maxTicks) {
      runtime.status = "completed";
      break;
    }
    runtime.tick += 1;
    const currentMinutes = timeToMinutes(runtime.currentTime) + runtime.tickIntervalMinutes;
    if (currentMinutes >= 24 * 60) runtime.currentDay += 1;
    runtime.currentTime = minutesToTime(currentMinutes);
    nextWorld.day = runtime.currentDay;
    nextWorld.currentTime = runtime.currentTime;
    const allEvents = [...events, ...createdEvents];
    const living = nextWorld.npcs.filter((npc) => npc.alive);
    const random = makeRandom(`${nextWorld.seed}:persistent:${runtime.tick}`);
    const actorCount = Math.min(3, living.length);
    const selectedActors = [...living].sort((a, b) => {
      const aState = deriveNpcAgentState(nextWorld, a, allEvents, runtime);
      const bState = deriveNpcAgentState(nextWorld, b, allEvents, runtime);
      return bState.goalPriority + random() - (aState.goalPriority + random());
    }).slice(0, actorCount);
    const decisionIds: string[] = [];
    for (const npc of selectedActors) {
      const candidates = scoreNpcActionCandidates(nextWorld, npc, allEvents, runtime);
      const selected = candidates.filter((candidate) => candidate.legal).sort((a, b) => b.score.total - a.score.total)[0] || candidates[0];
      const traceId = `decision-${nextWorld.id}-${runtime.tick}-${npc.id}`;
      const intervention = runtime.interventions.find((item) => item.actorId === npc.id && item.tick === runtime.tick - 1);
      const event: WorldEvent = {
        id: `agent-${nextWorld.seed.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}-${runtime.tick}-${npc.id}-${selected.kind}`,
        worldId: nextWorld.id,
        day: runtime.currentDay,
        time: runtime.currentTime,
        type: eventTypeForAction(selected.kind),
        actorIds: [npc.id, ...(selected.targetNpcId ? [selected.targetNpcId] : [])],
        locationId: selected.targetLocationId,
        summary: `${npc.name}: ${selected.description}`,
        publicSummary: selected.kind === "confront" ? `${npc.name} was seen in a tense exchange.` : `${npc.name} followed a visible town action.`,
        hidden: selected.kind === "hide-trace" || selected.kind === "obtain-resource",
        relatedCharacterIds: [npc.id, ...(selected.targetNpcId ? [selected.targetNpcId] : [])],
        tags: [...eventTagsForAction(selected), intervention ? "counterfactual" : "source_backed"],
        intentId: selected.id,
        goalId: `goal-${npc.id}-${runtime.tick}`,
        causedByEventIds: deriveNpcAgentState(nextWorld, npc, allEvents, runtime).knownFactIds.slice(-2),
        explanation: selected.score.reasons.join(" / ") || "Local agent rules selected the highest scoring legal action."
      };
      createdEvents.push(event);
      const memory = addRuntimeMemory(nextWorld, event, npc.id, event.summary);
      if (selected.targetNpcId) addRuntimeMemory(nextWorld, event, selected.targetNpcId, event.publicSummary);
      const trace: AgentDecisionTrace = {
        id: traceId,
        tick: runtime.tick,
        day: runtime.currentDay,
        time: runtime.currentTime,
        npcId: npc.id,
        observedEventIds: deriveNpcAgentState(nextWorld, npc, allEvents, runtime).knownFactIds.slice(-5),
        memoryIds: [memory.id],
        candidates,
        selectedCandidateId: selected.id,
        createdEventId: event.id,
        interventionId: intervention?.id
      };
      runtime.decisionTraces.push(trace);
      decisionIds.push(trace.id);
      const agent = deriveNpcAgentState(nextWorld, npc, [...allEvents, event], runtime);
      agent.locationId = selected.targetLocationId;
      agent.lastDecisionId = trace.id;
      agent.nextActionPreview = selected.description;
      runtime.agentStates = [agent, ...runtime.agentStates.filter((state) => state.npcId !== npc.id)];
    }
    const candidates = buildCaseCandidatesFromRuntime(nextWorld, [...events, ...createdEvents], runtime);
    runtime.candidates = candidates.slice(0, 8);
    const report: PersistentTownRuntimeReport = {
      tick: runtime.tick,
      status: runtime.status,
      eventIds: createdEvents.slice(-decisionIds.length).map((event) => event.id),
      decisionIds,
      candidateIds: runtime.candidates.map((candidate) => candidate.id)
    };
    if (!runtime.candidates.some((candidate) => candidate.validation.valid) && runtime.tick >= runtime.maxTicks) {
      report.blockedReason = "No valid case candidate reached motive + means + opportunity + memory support before max ticks.";
      runtime.status = "blocked";
    }
    runtime.reports.push(report);
    nextWorld.persistentRuntime = runtime;
    const tickSnapshot = createTownStateSnapshot(nextWorld, [...events, ...createdEvents], {
      id: `snapshot-${nextWorld.id}-tick-${runtime.tick}`,
      label: `Tick ${runtime.tick}`
    });
    runtime.snapshots = [tickSnapshot, ...(runtime.snapshots || []).filter((snapshot) => snapshot.id !== tickSnapshot.id)].slice(0, 30);
  }
  runtime.updatedAt = new Date().toISOString();
  nextWorld.updatedAt = runtime.updatedAt;
  nextWorld.persistentRuntime = runtime;
  return { world: nextWorld as WorldState, runtime, events: createdEvents, queue: buildTownEmergenceQueue(nextWorld, [...events, ...createdEvents], runtime) };
}
