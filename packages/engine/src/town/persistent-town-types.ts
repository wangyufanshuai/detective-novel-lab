/**
 * Type declarations for persistent-town.ts, split out so the runtime module
 * stays focused on behaviour. Type-only: erased at runtime, so no import cycle.
 */
import type { diffTownRuleSnapshots, LongActionKind, TownLongActionReservation, TownResourceKind, TownRuleRuntimeState, TownRuleSnapshotSummary } from "./rules";
import type { TownTickPhaseName } from "./runtime";
import type { TownDailyRoutine } from "./daily-routine";
import type { TownResidentWork } from "./resident-work";
import type { TownResidentLife } from "./resident-life";
import type { PopulationFlowPolicy } from "./population-flow";
import type { WorldReplayDigest } from "./replay-contract";
import type { WorldInfluenceBudgetPublicSummary } from "./candidate-influence";
import type { PlayerResourceCommitmentPublicSummary, PlayerResourceCommitmentRuntimeState } from "./player-resource-commitment";
import type { FactionRelationshipPublicSummary, FactionRelationshipRuntimeState } from "./faction-relationship";
import type { WorldEventOfferPublicSummary, WorldEventOfferRuntimeState } from "./world-event-offer";
import type { InvestigatorProgressionPublicSummary, InvestigatorProgressionRuntimeState } from "./investigator-progression";
import type { CampaignRecoveryPublicSummary, CampaignRecoveryRuntimeState } from "./campaign-recovery";
import type { InvestigatorHeadquartersPublicSummary, InvestigatorHeadquartersRuntimeState } from "./investigator-headquarters";
import type { ArcConvergencePublicSummary, ArcConvergenceRuntimeState } from "./arc-convergence";
import type { CampaignFinaleDebriefPublicSummary, CampaignSessionPublicSummary, CampaignSessionRuntimeState } from "./campaign-session";
import type { TownSocialResponsePublicSummary, TownSocialResponseRuntimeState } from "./social-response";
import type { TownExecutionPolicy, TownPerformanceSummary, TownSnapshotMode, TownTickIndex } from "./execution";
import type { CurrentExperimentRef, PackRegistryEntry, ScenarioPack } from "../scenario-pack";
import type { BenchmarkRunSummary, RunJob } from "../run-catalog";
import type { CampaignGraphSummary, EvidenceGraphSummary } from "../campaign-graphs";
import type { TownMapPack } from "../town-map-pack";
import type { DetectiveDirectiveResponseConfig, WorldSystemRuntimeHints, WorldSystemRuntimeHintSummary } from "../detective-content";
import type { CaseTriggerKind, EmergenceBenchmarkReport, MemoryRecord, MurderArchetype, NPCProfile, PopulationFlowRecord, WorldEvent, WorldMode, WorldState } from "../world-types";
import type { scoreCandidate } from "../persistent-town";


export type PersistentTownRuntimeStatus = "paused" | "running" | "completed" | "blocked";

/**
 * Controls how an agent pressure chain becomes a case event.
 *
 * `legacy-fatal` keeps the original town contract for existing saves and
 * short smoke tests. `source-signaled` requires the source chain itself to
 * contain an explicit fatal signal; otherwise the chain becomes a nonfatal
 * incident and leaves both actors alive.
 */
export type CaseTriggerPolicy = "legacy-fatal" | "source-signaled";

export type WorldLeadFocus = "search" | "question" | "challenge";
export type WorldLeadStatus = "pending" | "followed" | "skipped" | "resolved";

export type WorldLeadPublicSummary = {
  status: WorldLeadStatus;
  focus: WorldLeadFocus;
  label: string;
  nextAction: string;
};

export type WorldLeadOutcomeStatus = "active" | "settled";
export type WorldLeadCaseHandoffStatus = "ready" | "consumed";

export type WorldLeadOutcomePublicSummary = {
  status: WorldLeadOutcomeStatus;
  focus: WorldLeadFocus;
  benefitLabel: string;
  costLabel: string;
  nextAction: string;
};

export type WorldLeadCaseHandoffPublicSummary = {
  status: WorldLeadCaseHandoffStatus;
  focus: WorldLeadFocus;
  label: string;
  nextAction: string;
};

export type WorldArcStatus = "active" | "completed";

export type WorldArcPublicSummary = {
  status: WorldArcStatus;
  label: string;
  completedStages: number;
  stageCount: number;
  progressLabel: string;
  pulseLabel: string;
  nextAction: string;
};

export type WorldArcProgress = WorldArcPublicSummary & {
  progressionLineId: string;
  compatibleCaseTypeIds: string[];
  activeCaseId: string;
  startedAtTick: number;
  updatedAtTick: number;
  lastAdvancedCaseId?: string;
  lastFocus?: WorldLeadFocus;
  completedAtTick?: number;
};

export type WorldArcRuntimeState = {
  currentLineId?: string;
  lines: Record<string, WorldArcProgress>;
};

export type WorldArcDirectiveStatus = "ready" | "scheduled" | "running" | "completed" | "blocked";
export type WorldArcDirectiveChoice = "support" | "contain" | "defer";

export type WorldArcDirectivePublicOption = Pick<DetectiveDirectiveResponseConfig, "label" | "benefitLabel" | "costLabel">;

export type WorldArcDirectivePublicSummary = {
  status: WorldArcDirectiveStatus;
  choice?: WorldArcDirectiveChoice;
  lineLabel: string;
  factionLabel: string;
  operationLabel: string;
  benefitLabel: string;
  costLabel: string;
  progressLabel: string;
  queuedCount: number;
  nextAction: string;
  blockedCategory?: "institution unavailable" | "staff unavailable" | "resource unavailable" | "operation unavailable";
  options: {
    support: WorldArcDirectivePublicOption;
    contain: WorldArcDirectivePublicOption;
  };
};

export type WorldArcDirective = {
  id: string;
  status: WorldArcDirectiveStatus;
  choice?: WorldArcDirectiveChoice;
  progressionLineId: string;
  completedStage: number;
  sourceCaseId: string;
  eventArchetypeId: string;
  lineLabel: string;
  factionLabel: string;
  sourceFactionKind?: string;
  focusCaseTypeIds?: string[];
  focusCaseLabel?: string;
  responses: {
    support: DetectiveDirectiveResponseConfig;
    contain: DetectiveDirectiveResponseConfig;
  };
  createdAtTick: number;
  scheduledAtTick?: number;
  startedAtTick?: number;
  completedAtTick?: number;
  blockedAtTick?: number;
  institutionId?: string;
  actorId?: string;
  longActionId?: string;
  startEventId?: string;
  completionEventId?: string;
  attemptCount: number;
  reservedResources?: TownLongActionReservation;
  reservationReleasedAtTick?: number;
  blockedCategory?: WorldArcDirectivePublicSummary["blockedCategory"];
};

export type WorldArcDirectiveRuntimeState = {
  activeId?: string;
  items: WorldArcDirective[];
};

export type WorldArcDirectiveDecisionInput = {
  choice: WorldArcDirectiveChoice;
};

export type WorldPressureDirection = "rising" | "relief";

export type WorldPressurePulse = {
  id: string;
  focusKey: string;
  focusLabel: string;
  affectedCaseLabel: string;
  caseTypeIds: string[];
  direction: WorldPressureDirection;
  sourceDirectiveId?: string;
  sourceCaseId?: string;
  eventArchetypeId?: string;
  resourceKind?: TownResourceKind;
  institutionId?: string;
  longActionKind: LongActionKind;
  createdAtTick: number;
  updatedAtTick: number;
  layers: number;
  consumedLayers: number;
};

export type WorldPressurePulseRuntimeState = {
  items: WorldPressurePulse[];
  lastConsumedAtTick?: number;
  lastConsumedCaseId?: string;
  lastConsumedFocusLabel?: string;
};

export type WorldPressureCascadePublicSummary = {
  status: "active" | "consumed" | "empty";
  activePulseCount: number;
  directionLabel: string;
  focusLabel: string;
  affectedCaseLabel: string;
  remainingLayers: number;
  nextAction: string;
};

export type WorldPressurePulseDerivationInput = {
  runtime: TownRuleRuntimeState;
  action: {
    id: string;
    kind: LongActionKind;
    appliedResult?: {
      institutionDeltas: Record<string, { resources: number; reputation: number; pressure: number }>;
      publicOpinionDelta: Partial<Record<string, number>>;
      evidenceContaminationDelta: number;
    };
  };
  directive?: Pick<WorldArcDirective, "id" | "sourceCaseId" | "eventArchetypeId" | "focusCaseTypeIds" | "focusCaseLabel" | "institutionId" | "reservedResources">;
  tick: number;
};

export type WorldLeadDecision = WorldLeadPublicSummary & {
  sessionId: string;
  caseId?: string;
  selectedAtTick: number;
  resolvedAtTick?: number;
};

export type WorldLeadOutcome = WorldLeadOutcomePublicSummary & {
  caseId: string;
  locationId: string;
  institutionId: string;
  resourceKind: TownResourceKind;
  activatedAtTick: number;
  applied: {
    location: Pick<TownLocationProfile, "heat" | "security" | "footTraffic" | "resourcePressure">;
    institution: { resources: number; reputation: number; pressure: number };
    resource: { available: number; pressure: number };
  };
};

export type WorldLeadCaseHandoff = WorldLeadCaseHandoffPublicSummary & {
  settledCaseId: string;
  preparedAtTick: number;
  consumedByCaseId?: string;
  consumedAtTick?: number;
};

export type WorldLeadDecisionAction = "follow" | "skip" | "resolve";

export type WorldLeadDecisionInput = {
  sessionId: string;
  action: WorldLeadDecisionAction;
  caseId?: string;
  caseSceneLocationId?: string;
};

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
  worldSystemBias?: number;
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
  interventionActionId?: string;
  interventionReason?: string;
  interventionSourceRefs?: string[];
  phases?: string[];
  propagatedMemoryIds?: string[];
  consequence?: AgentConsequenceSummary;
  observationIds?: string[];
};

/** Compact, deterministic receipt retained when a full decision trace is evicted. */
export type AgentDecisionTraceArchiveEntry = {
  traceId: string;
  tick: number;
  npcId: string;
  interventionId: string;
  traceDigest: string;
};

/** Durable receipt for a case extraction issued through an Agent command. */
export type AgentCaseExtractionReceipt = {
  schema: "agent-case-extraction-receipt.v1";
  actionId: string;
  candidateId: string;
  reason: string;
  sourceRefs: string[];
  caseId: string;
  triggeredEventId?: string;
  triggerKind?: CaseTriggerKind;
  createdAtTick: number;
  receiptHash: string;
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
  evidenceChain?: EvidenceChainValidationSummary;
  failureReasons?: string[];
  errors: string[];
  warnings: string[];
};

export type TownCaseType =
  | "murder"
  | "missing-person"
  | "ledger-fraud"
  | "false-testimony"
  | "medical-coverup"
  | "family-scandal"
  | "merchant-extortion"
  | "police-misjudgment"
  | "media-rumor"
  | "evidence-tampering"
  | "dock-smuggling"
  | "forged-will"
  | "court-intimidation"
  | "blackmail"
  | "witness-disappearance"
  | "archive-vanishing"
  | "clinic-inventory-gap"
  | "dock-witness-swap"
  | "editorial-coercion"
  | "household-escrow"
  | "permit-forgery"
  | "signal-tampering"
  | "safety-inspection-fraud"
  | "industrial-sabotage"
  | "water-rights-fraud"
  | "floodgate-tampering"
  | "academic-record-forgery"
  | "patronage-coercion"
  | "identity-register-fraud"
  | "utility-sabotage"
  | "burial-record-forgery"
  | "signal-interception";

export type EvidenceChainValidationSummary = {
  relatedEvidenceIds: string[];
  contaminatedEvidenceIds: string[];
  strongProvenanceIds: string[];
  weakProvenanceIds: string[];
  warningReasons: string[];
  minimumEvidenceCountMet: boolean;
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
  triggerKind?: CaseTriggerKind;
  caseType?: TownCaseType;
  chainCompleteness?: Record<CaseChainStage, boolean>;
  motiveGap?: string;
  meansGap?: string;
  exclusionGap?: string;
  timelineGap?: string;
  validation: CaseCandidateValidation;
  caseId?: string;
  influenceTrace?: CaseInfluenceTrace;
};

export type PersistentCaseExtractionView = {
  world: WorldState;
  events: WorldEvent[];
  sourceMap: {
    triggeredEventId: string;
    triggerKind: CaseTriggerKind;
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

export type TownActionBuildInput = {
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

export type TownActionLegalityInput = TownActionBuildInput & {
  candidate: Omit<NpcActionCandidate, "score">;
};

export type TownActionExecuteInput = {
  world: RuntimeWorld;
  runtime: PersistentTownRuntime;
  npc: NPCProfile;
  candidate: NpcActionCandidate;
  intervention?: TownRuntimeIntervention;
  allEvents: WorldEvent[];
};

export type TownTickActionPlan = {
  npc: NPCProfile;
  actorIndex: number;
  candidates: NpcActionCandidate[];
  selected: NpcActionCandidate;
};

export type TownTickContext = {
  world: RuntimeWorld;
  baseEvents: WorldEvent[];
  runtime: PersistentTownRuntime;
  allEvents: WorldEvent[];
  createdEvents: WorldEvent[];
  tickEventStartIndex: number;
  createdMemories: MemoryRecord[];
  createdObservations: TownEventObservation[];
  createdConsequences: AgentConsequenceSummary[];
  actionPlans: TownTickActionPlan[];
  decisionIds: string[];
  phases: TownTickPhaseName[];
  index: TownTickIndex;
  executionPolicy: TownExecutionPolicy;
};

export type TownRuntimeIntervention = {
  id: string;
  tick: number;
  actorId: string;
  kind: "goal" | "location" | "resource" | "relationship-pressure" | "knowledge" | "action-bias";
  value: string | number | boolean;
  /** Stable external-agent action id used for idempotent commits and replay receipts. */
  actionId?: string;
  /** Human-readable reason supplied by an external agent or reviewer. */
  reason?: string;
  /** Source references that justify the intervention. */
  sourceRefs?: string[];
  /** Bidirectional audit link populated when a later tick consumes this intervention. */
  decisionTraceId?: string;
  /** Digest binding the intervention receipt to the full or archived decision trace. */
  decisionTraceDigest?: string;
  decisionStatus?: "pending" | "applied" | "expired";
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
  kind: CaseTriggerKind;
  causedByEventIds: string[];
  maturityScore: number;
  chainCompleteness: Record<CaseChainStage, boolean>;
};

export type TownCaseLifecycleState = {
  activeCaseIds: string[];
  solvedCaseIds: string[];
  failedCaseIds: string[];
  caseCooldownByNpcId: Record<string, number>;
  casePairCooldown?: Record<string, number>;
  caseTypeHistory?: TownCaseType[];
  caseTypeCooldown?: Partial<Record<TownCaseType, number>>;
  locationCooldown?: Record<string, number>;
  casePressureByInstitutionId: Record<string, number>;
  nextCaseWeights: Record<string, number>;
  caseTimeline?: CampaignCaseTimelineEntry[];
  caseAftermathLog: Array<{ id: string; caseId: string; outcome: "solved" | "failed" | "extracted" | "forming"; tick: number; influence: string[] }>;
};

export type CaseTypeWeightState = Partial<Record<TownCaseType, number>>;

export type CampaignCaseTimelineEntry = {
  caseId: string;
  tick: number;
  caseType: TownCaseType;
  culpritId?: string;
  victimId?: string;
  locationId?: string;
  outcome: "solved" | "failed" | "extracted" | "forming";
  influence: string[];
};

export type CaseInfluenceTrace = {
  institutionIds: string[];
  professionIds: string[];
  longActionIds: string[];
  institutionDecisionIds: string[];
  evidenceChainItemIds: string[];
  relatedEvidenceIds?: string[];
  contaminatedEvidenceIds?: string[];
  provenanceSources?: string[];
  evidenceWarnings?: string[];
  resourceDeltas: Record<string, number>;
  aftermathIds: string[];
  publicOpinionDelta: Record<string, number>;
  evidenceContaminationDelta: number;
};

export type CaseResolutionInput = {
  caseId: string;
  outcome: "solved" | "failed" | "extracted";
  culpritId?: string;
  victimId?: string;
  caseType?: TownCaseType;
  locationId?: string;
  evidenceItemIds?: string[];
  valid: boolean;
};

export type CaseResolutionResult = {
  lifecycle: TownCaseLifecycleState;
  influenceTrace: CaseInfluenceTrace;
};

export type PersistentTownRuntimeReport = {
  tick: number;
  status: PersistentTownRuntimeStatus;
  eventIds: string[];
  decisionIds: string[];
  candidateIds: string[];
  candidateSummaries?: Array<{
    id: string;
    valid: boolean;
    triggeredEventId?: string;
    evidenceCovered: boolean;
  }>;
  blockedReason?: string;
};

export type PersistentTownRuntime = {
  id: string;
  worldId: string;
  /** Presentation/CAS token returned by player runtime routes. */
  revision?: string;
  /** Monotonic persistence revision for command CAS; absent on legacy saves. */
  commandRevision?: number;
  /** New owned worlds namespace globally persisted events by world identity.
   * Absent on legacy replay capsules, whose historical IDs remain unchanged. */
  eventIdentityPolicy?: "world-scoped";
  status: PersistentTownRuntimeStatus;
  currentDay: number;
  currentTime: string;
  tickIntervalMinutes: number;
  maxTicks: number;
  tick: number;
  agentStates: NpcAgentState[];
  /** Opt-in authored commuting; absent on all legacy worlds. */
  dailyRoutine?: TownDailyRoutine;
  /** Explicit three-resident ordinary-work pilot; absent on legacy saves. */
  residentWork?: TownResidentWork;
  /** Explicit three-day needs/planning policy; legacy worlds retain old rules. */
  residentLife?: TownResidentLife;
  decisionTraces: AgentDecisionTrace[];
  /** Compact receipts for intervention-linked traces evicted by trace retention. */
  decisionTraceArchive?: AgentDecisionTraceArchiveEntry[];
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
  longChainComputedAtTick?: number;
  triggeredCases?: TownTriggeredCaseRecord[];
  /** Source-backed newcomers created by the explicit population-flow adapter. */
  populationFlowLedger?: PopulationFlowRecord[];
  /** Durable action receipts for Agent-driven case extraction. */
  agentCaseExtractionReceipts?: AgentCaseExtractionReceipt[];
  /** Opt-in, source-backed population cadence. Disabled in the default runtime. */
  populationFlowPolicy?: PopulationFlowPolicy;
  campaignCaseTarget?: number;
  caseTriggerPolicy?: CaseTriggerPolicy;
  caseLifecycle?: TownCaseLifecycleState;
  simulationPhases?: TownTickPhaseName[];
  scenarioPresets?: ScenarioPreset[];
  scenarioPacks?: ScenarioPack[];
  mapPacks?: TownMapPack[];
  packRegistry?: PackRegistryEntry[];
  currentScenarioPackId?: string;
  currentMapPackId?: string;
  currentRuleCatalogId?: string;
  currentExperiment?: CurrentExperimentRef;
  scenarioRuns?: ScenarioRun[];
  runJobs?: RunJob[];
  benchmarkRuns?: BenchmarkRunSummary[];
  snapshots?: TownStateSnapshot[];
  ruleState?: TownRuleRuntimeState;
  candidateComputedAtTick?: number;
  performance?: TownPerformanceSummary;
  worldSystemHints?: WorldSystemRuntimeHints;
  worldSystemHintSummary?: WorldSystemRuntimeHintSummary;
  worldLeadPreview?: WorldLeadPublicSummary;
  worldLeadDecisions?: Record<string, WorldLeadDecision>;
  worldLeadOutcome?: WorldLeadOutcome;
  worldLeadOutcomeSummary?: WorldLeadOutcomePublicSummary;
  worldLeadCaseHandoff?: WorldLeadCaseHandoff;
  worldLeadCaseHandoffSummary?: WorldLeadCaseHandoffPublicSummary;
  worldArcProgress?: WorldArcRuntimeState;
  worldArcSummary?: WorldArcPublicSummary;
  worldArcDirectives?: WorldArcDirectiveRuntimeState;
  worldArcDirectiveSummary?: WorldArcDirectivePublicSummary;
  worldPressurePulses?: WorldPressurePulseRuntimeState;
  worldPressureCascadeSummary?: WorldPressureCascadePublicSummary;
  worldInfluenceBudgetSummary?: WorldInfluenceBudgetPublicSummary;
  playerResourceCommitments?: PlayerResourceCommitmentRuntimeState;
  playerResourceCommitmentSummary?: PlayerResourceCommitmentPublicSummary;
  factionRelationships?: FactionRelationshipRuntimeState;
  factionRelationshipSummary?: FactionRelationshipPublicSummary;
  worldEventOffers?: WorldEventOfferRuntimeState;
  worldEventOfferSummary?: WorldEventOfferPublicSummary;
  investigatorProgression?: InvestigatorProgressionRuntimeState;
  investigatorProgressionSummary?: InvestigatorProgressionPublicSummary;
  investigatorHeadquarters?: InvestigatorHeadquartersRuntimeState;
  investigatorHeadquartersSummary?: InvestigatorHeadquartersPublicSummary;
  campaignRecoveries?: CampaignRecoveryRuntimeState;
  campaignRecoverySummary?: CampaignRecoveryPublicSummary;
  arcConvergence?: ArcConvergenceRuntimeState;
  arcConvergenceSummary?: ArcConvergencePublicSummary;
  campaignSession?: CampaignSessionRuntimeState;
  campaignSessionSummary?: CampaignSessionPublicSummary;
  campaignFinaleDebrief?: CampaignFinaleDebriefPublicSummary;
  townSocialResponses?: TownSocialResponseRuntimeState;
  townSocialResponseSummary?: TownSocialResponsePublicSummary;
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
  /** Stable presentation revision for public clients. */
  revision: string;
  tick: number;
  status: PersistentTownRuntimeStatus;
  currentPhase: TownTickPhaseName;
  urgency: "stable" | "elevated" | "critical";
  headline: string;
  nextAction: string;
  worldArcDirective?: WorldArcDirectivePublicSummary;
  worldPressureCascade?: WorldPressureCascadePublicSummary;
  worldInfluenceBudget?: WorldInfluenceBudgetPublicSummary;
  playerResourceCommitment?: PlayerResourceCommitmentPublicSummary;
  factionRelationship?: FactionRelationshipPublicSummary;
  worldEventOffer?: WorldEventOfferPublicSummary;
  investigatorProgression?: InvestigatorProgressionPublicSummary;
  investigatorHeadquarters?: InvestigatorHeadquartersPublicSummary;
  campaignRecovery?: CampaignRecoveryPublicSummary;
  arcConvergence?: ArcConvergencePublicSummary;
  campaignSession?: CampaignSessionPublicSummary;
  campaignFinaleDebrief?: CampaignFinaleDebriefPublicSummary;
  townSocialResponse?: TownSocialResponsePublicSummary;
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
    latestTriggerKind?: CaseTriggerKind;
    highestMaturityScore: number;
    strongestCandidateId?: string;
  };
  recentSignals: Array<{
    kind: "case" | "location" | "agent" | "observation";
    label: string;
    detail: string;
  }>;
};

/** Stable spoiler-safe projection consumed by the City Pulse presentation. */
export type CityPulseWorldProjection = {
  schemaVersion: "city-pulse.world-projection.v1";
  revision: string;
  worldId: string;
  runtimeId: string;
  tick: number;
  status: PersistentTownRuntimeStatus;
  phase: TownTickPhaseName;
  objective: { headline: string; nextAction: string };
  pressure: {
    urgency: TownSituationBrief["urgency"];
    highestMaturityScore: number;
    topLocation?: Omit<TownSituationBrief["hotLocations"][number], "locationId">;
    topAgent?: Omit<TownSituationBrief["riskAgents"][number], "npcId" | "locationId">;
  };
  metrics: {
    candidateCount: number;
    validCandidateCount: number;
    triggeredCaseCount: number;
    latestTriggerKind?: CaseTriggerKind;
    activeNpcCount: number;
    observationCount: number;
  };
  signals: TownSituationBrief["recentSignals"];
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
  intervention: Omit<TownRuntimeIntervention, "id" | "tick" | "createdAt" | "branch" | "impact" | "decisionTraceId" | "decisionTraceDigest" | "decisionStatus">;
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

export type ScenarioPreset = {
  id: string;
  name: string;
  description?: string;
  builtIn?: boolean;
  updatedAt?: string;
  config: ScenarioConfig;
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
  ruleSummary?: TownRuleSnapshotSummary;
  mode?: TownSnapshotMode;
  rollbackEligible?: boolean;
  createdAt: string;
  /** Persisted receipt for checkpoint truth; the private checkpoint payload remains server-side. */
  replayDigest?: WorldReplayDigest;
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
  ruleChanges?: ReturnType<typeof diffTownRuleSnapshots>;
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

export type ScenarioRunSummary = {
  id: string;
  name: string;
  status: ScenarioRun["status"];
  startedAt: string;
  completedAt: string;
  branchCount: number;
  baselineEventGrowth: number;
  baselineMemoryGrowth: number;
  validCandidateCount: number;
};

export type ReviewExportBundle = {
  exportedAt: string;
  worldId: string;
  runtimeId: string;
  scenario: ScenarioRun;
  report: ScenarioReport;
  selectedSnapshots: {
    from: TownStateSnapshot | null;
    to: TownStateSnapshot | null;
  };
  selectedDiff: TownStateDiff | null;
  selectedBranchComparison: ScenarioBranchRun | null;
  benchmark?: EmergenceBenchmarkReport | null;
  caseGraphSummary?: CampaignGraphSummary;
  evidenceGraphSummary?: EvidenceGraphSummary;
};

export type RuntimeWorld = WorldState & { persistentRuntime?: PersistentTownRuntime };

export type WorldLeadOutcomePlan = {
  resourceKind: TownResourceKind;
  location: Pick<TownLocationProfile, "heat" | "security" | "footTraffic" | "resourcePressure">;
  institution: { resources: number; reputation: number; pressure: number };
  resource: { available: number; pressure: number };
  benefitLabel: string;
  costLabel: string;
};

export type CaseResolutionMode = "preview" | "resolve";

export type AgentDecisionTraceLinkSummary = {
  schema: "agent-decision-trace-links.v1";
  interventionCount: number;
  decisionTraceCount: number;
  archivedDecisionCount: number;
  appliedInterventionCount: number;
  pendingInterventionCount: number;
  expiredInterventionCount: number;
  linkedDecisionCount: number;
  archivedLinkedDecisionCount: number;
  brokenInterventionLinks: string[];
  brokenTraceLinks: string[];
  brokenArchiveLinks: string[];
  complete: boolean;
};
