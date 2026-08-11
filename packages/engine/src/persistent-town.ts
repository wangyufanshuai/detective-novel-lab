import { extractCaseFromWorld, validateWorldCase } from "./world-case";
import {
  advanceTownInstitutionStrategies,
  advanceTownLongActions,
  applyCaseAftermath,
  buildTownRuleSnapshotSummary,
  diffTownRuleSnapshots,
  ensureTownRuleRuntimeState,
  maybeStartLongActionFromCandidate,
  releaseTownLongActionReservation,
  startTownLongAction,
  updateTownRulePressureFromEvent,
  type InstitutionDecision,
  type InstitutionStrategy,
  type LongActionKind,
  type TownInstitutionKind,
  type TownLongActionReservation,
  type EvidenceChainItem,
  type TownResourceKind,
  type TownRuleRuntimeState,
  type TownRuleSnapshotSummary
} from "./town/rules";
import { createTownActionDefinitions, strongestLegalAction } from "./town/actions";
import { invalidateTownCandidateCache, reusableTownCandidates, storeTownCandidates } from "./town/cases";
import { cacheNpcAgentState, eventsForNpc, memoriesForNpc } from "./town/memory";
import { PERSISTENT_TOWN_TICK_PHASES, type TownTickPhaseName } from "./town/runtime";
import { cloneTownSnapshotRuntime, cloneTownSnapshotWorld, cloneTownWorldForAdvance } from "./town/snapshots";
import {
  deriveCandidateInfluenceBudget,
  deriveWorldArcCandidateInfluence,
  deriveWorldLeadHandoffInfluence,
  toWorldInfluenceBudgetPublicSummary,
  type WorldInfluenceBudgetPublicSummary
} from "./town/candidate-influence";
import {
  toPlayerResourceCommitmentPublicSummary,
  type PlayerResourceCommitment,
  type PlayerResourceCommitmentPublicSummary,
  type PlayerResourceCommitmentRuntimeState
} from "./town/player-resource-commitment";
import {
  ensureFactionRelationshipState,
  recordCompletedDirectiveFactionRelationships,
  toFactionRelationshipPublicSummary,
  type FactionRelationshipPublicSummary,
  type FactionRelationshipRuntimeState
} from "./town/faction-relationship";
export {
  PLAYER_RESOURCE_COMMITMENT_COST,
  activeInvestigationOperationsAuthority,
  applyPlayerResourceCommitmentDecision,
  bindInvestigationOperationsAuthority,
  consumePlayerResourceCommitment,
  investigationOperationsAuthorityForSession,
  isInvestigationOperationsAuthoritativeSession,
  preparePlayerResourceCommitment,
  releaseUnusedPlayerResourceCommitments,
  settleInvestigationOperationsAuthority,
  toPlayerResourceCommitmentPublicSummary
} from "./town/player-resource-commitment";
export type {
  InvestigationOperationScope,
  InvestigationOperationsAuthority,
  PlayerResourceCommitment,
  PlayerResourceCommitmentChoice,
  PlayerResourceCommitmentDecisionInput,
  PlayerResourceCommitmentPublicOption,
  PlayerResourceCommitmentPublicSummary,
  PlayerResourceCommitmentRuntimeState,
  PlayerResourceCommitmentStatus
} from "./town/player-resource-commitment";
export {
  applyInvestigationOperationsDecision,
  recordInvestigationOperationStep,
  settleInvestigationOperations
} from "./town/investigation-operations";
export type { InvestigationOperationsDecisionInput } from "./town/investigation-operations";
export {
  applyFactionRelationshipDelta,
  ensureFactionRelationshipState,
  factionRelationshipBand,
  factionStandingForInstitution,
  factionResourceCommitmentTerms,
  mapContentFactionKindToInstitutionKind,
  recordAcceptedCaseFactionRelationship,
  recordCompletedDirectiveFactionRelationships,
  recordResourceCommitmentFactionRelationship,
  toFactionRelationshipPublicSummary
} from "./town/faction-relationship";
export type {
  FactionRelationshipBand,
  FactionRelationshipLedgerEntry,
  FactionRelationshipPublicEntry,
  FactionRelationshipPublicSummary,
  FactionRelationshipReason,
  FactionRelationshipRuntimeState,
  FactionResourceCommitmentTerms,
  InvestigatorFactionStanding
} from "./town/faction-relationship";
import {
  enqueueWorldEventOfferFromCompletedDirective,
  reconcileWorldEventOfferLongAction,
  startAcceptedWorldEventOffer,
  toWorldEventOfferPublicSummary,
  type WorldEventOfferPublicSummary,
  type WorldEventOfferRuntimeState
} from "./town/world-event-offer";
import {
  ensureInvestigatorProgression,
  recordInvestigatorProgression,
  toInvestigatorProgressionPublicSummary,
  type InvestigatorProgressionPublicSummary,
  type InvestigatorProgressionRuntimeState
} from "./town/investigator-progression";
import {
  reconcileCampaignRecovery,
  syncCampaignRecoveryFromRuntime,
  toCampaignRecoveryPublicSummary,
  type CampaignRecoveryPublicSummary,
  type CampaignRecoveryRuntimeState
} from "./town/campaign-recovery";
import {
  activateInvestigatorHeadquarters,
  completeInvestigatorHeadquarters,
  ensureInvestigatorHeadquarters,
  prepareInvestigatorHeadquarters,
  toInvestigatorHeadquartersPublicSummary,
  type InvestigatorHeadquartersPublicSummary,
  type InvestigatorHeadquartersRuntimeState
} from "./town/investigator-headquarters";
import {
  deriveArcConvergenceCandidateBonus,
  refreshArcConvergence,
  selectArcConvergenceCaseType,
  toArcConvergencePublicSummary,
  type ArcConvergencePublicSummary,
  type ArcConvergenceRuntimeState
} from "./town/arc-convergence";
import {
  ensureCampaignSession,
  refreshCampaignSession,
  toCampaignFinaleDebriefPublicSummary,
  toCampaignSessionPublicSummary,
  type CampaignFinaleDebriefPublicSummary,
  type CampaignSessionPublicSummary,
  type CampaignSessionRuntimeState
} from "./town/campaign-session";
import {
  deriveDetectiveCampaignCaseTypeBonus,
  selectedDetectiveCampaignForRuntime
} from "./town/campaign-catalog";
export {
  deriveDetectiveCampaignCaseTypeBonus,
  detectiveCampaignChapter,
  detectiveCampaignForRuntime,
  detectiveCampaignRouteForRuntime,
  getDetectiveCampaignDefinition,
  getDetectiveCampaignRoute,
  isDetectiveCampaignRouteId,
  listDetectiveCampaignDefinitions,
  selectDetectiveCampaignDefinition,
  selectedDetectiveCampaignForRuntime,
  toDetectiveCampaignPublicPreview
} from "./town/campaign-catalog";
export type {
  DetectiveCampaignChapter,
  DetectiveCampaignDefinition,
  DetectiveCampaignId,
  DetectiveCampaignRouteDefinition,
  DetectiveCampaignRouteId
} from "./town/campaign-catalog";
import {
  applyAuthoredCampaignCaseTreatment,
  authoredCampaignCaseForRuntime,
  withAuthoredCampaignLeadFocus,
  type AuthoredCampaignCaseDefinition
} from "./town/authored-campaign-cases";
export {
  applyAuthoredCampaignCaseTreatment,
  authoredCampaignCaseForRuntime,
  getAuthoredCampaignCaseDefinition,
  listAuthoredCampaignCaseDefinitions,
  withAuthoredCampaignLeadFocus
} from "./town/authored-campaign-cases";
export type {
  AuthoredCampaignCaseDefinition,
  AuthoredCampaignLeadFocus
} from "./town/authored-campaign-cases";
export {
  ensureInvestigatorProgression,
  investigatorProgressionCanRecoverOffer,
  investigatorProgressionReserveDiscount,
  recordInvestigatorProgression,
  toInvestigatorProgressionPublicSummary
} from "./town/investigator-progression";
export type {
  InvestigatorCompetency,
  InvestigatorCompetencyPublicSummary,
  InvestigatorProgressionEntry,
  InvestigatorProgressionKind,
  InvestigatorProgressionPublicSummary,
  InvestigatorProgressionRuntimeState
} from "./town/investigator-progression";
export {
  applyCampaignRecoveryDecision,
  prepareCampaignRecovery,
  reconcileCampaignRecovery,
  syncCampaignRecoveryFromRuntime,
  toCampaignRecoveryPublicSummary
} from "./town/campaign-recovery";
export {
  activateInvestigatorHeadquarters,
  applyInvestigatorHeadquartersDecision,
  completeInvestigatorHeadquarters,
  consumeInvestigatorHeadquartersRecovery,
  consumeInvestigatorHeadquartersReserveBenefit,
  ensureInvestigatorHeadquarters,
  investigatorHeadquartersCanRecover,
  investigatorHeadquartersDecisionAvailable,
  investigatorHeadquartersExtractionRequired,
  investigatorHeadquartersReserveDiscount,
  prepareInvestigatorHeadquarters,
  toInvestigatorHeadquartersPublicSummary
} from "./town/investigator-headquarters";
export type {
  InvestigatorHeadquartersChoice,
  InvestigatorHeadquartersDecisionInput,
  InvestigatorHeadquartersPreparation,
  InvestigatorHeadquartersPublicDirection,
  InvestigatorHeadquartersPublicSummary,
  InvestigatorHeadquartersRuntimeState,
  InvestigatorHeadquartersStatus
} from "./town/investigator-headquarters";
export {
  activateArcConvergence,
  completeArcConvergence,
  deriveArcConvergenceCandidateBonus,
  refreshArcConvergence,
  selectArcConvergenceCaseType,
  toArcConvergencePublicSummary
} from "./town/arc-convergence";
export {
  activateCampaignCase,
  bindCampaignRoute,
  completeCampaignCase,
  ensureCampaignSession,
  refreshCampaignSession,
  toCampaignFinaleDebriefPublicSummary,
  toCampaignSessionPublicSummary
} from "./town/campaign-session";
export type {
  CampaignFinaleDebriefPublicSummary,
  CampaignSessionHistoryEntry,
  CampaignSessionPublicSummary,
  CampaignSessionRuntimeState,
  CampaignSessionStatus
} from "./town/campaign-session";
export type {
  ArcConvergenceApproach,
  ArcConvergencePublicSummary,
  ArcConvergenceRuntimeState,
  ArcConvergenceStatus
} from "./town/arc-convergence";
export type {
  CampaignRecovery,
  CampaignRecoveryActionKind,
  CampaignRecoveryDecisionChoice,
  CampaignRecoveryDecisionInput,
  CampaignRecoveryFailureKind,
  CampaignRecoveryPublicSummary,
  CampaignRecoveryRuntimeState,
  CampaignRecoveryStatus
} from "./town/campaign-recovery";
export {
  applyWorldEventOfferDecision,
  enqueueWorldEventOffer,
  enqueueWorldEventOfferFromCompletedDirective,
  reconcileWorldEventOfferLongAction,
  reopenWorldEventOfferAfterCampaignRecovery,
  startAcceptedWorldEventOffer,
  toWorldEventOfferPublicSummary
} from "./town/world-event-offer";
export type {
  WorldEventOffer,
  WorldEventOfferDecisionChoice,
  WorldEventOfferDecisionInput,
  WorldEventOfferPublicSummary,
  WorldEventOfferRuntimeState,
  WorldEventOfferStatus
} from "./town/world-event-offer";
export {
  MAX_CANDIDATE_INFLUENCE_BONUS,
  deriveCandidateInfluenceBudget,
  deriveCandidateInfluenceLedger,
  deriveWorldArcCandidateInfluence,
  deriveWorldLeadHandoffCandidateInfluence,
  deriveWorldLeadHandoffInfluence,
  deriveWorldPressureCandidateInfluence,
  toWorldInfluenceBudgetPublicSummary
} from "./town/candidate-influence";
export type {
  CandidateInfluenceEntry,
  CandidateInfluenceLedger,
  CandidateInfluenceSource,
  WorldInfluenceBudgetPublicSummary
} from "./town/candidate-influence";
import {
  deriveWorldPressurePulseFromCompletedAction,
  mergeWorldPressurePulse,
  toWorldPressureCascadePublicSummary
} from "./town/world-pressure";
export {
  consumeWorldPressurePulseOnExtraction,
  deriveCompletedActionWorldPressureDirection,
  deriveWorldPressureDirectionFromActualDeltas,
  deriveWorldPressureCasePriorityBonus,
  deriveWorldPressurePulseFromCompletedAction,
  mergeWorldPressurePulse,
  toWorldPressureCascadePublicSummary
} from "./town/world-pressure";
import {
  advanceTownSocialResponse,
  deriveTownSocialResponseDirectionFromCompletedAction,
  deriveTownSocialResponseDirectionFromDeltas,
  enqueueTownSocialResponse,
  refreshTownSocialResponseSummary,
  toTownSocialResponsePublicSummary,
  townSocialResponseActualDelta,
  type TownSocialResponsePublicSummary,
  type TownSocialResponseRuntimeState
} from "./town/social-response";
export {
  advanceTownSocialResponse,
  deriveTownSocialResponseDirectionFromCompletedAction,
  deriveTownSocialResponseDirectionFromDeltas,
  enqueueTownSocialResponse,
  refreshTownSocialResponseSummary,
  toTownSocialResponsePublicSummary,
  townSocialResponseActualDelta
} from "./town/social-response";
export type {
  EnqueueTownSocialResponseInput,
  TownSocialResponseCycle,
  TownSocialResponseDirection,
  TownSocialResponsePublicReaction,
  TownSocialResponsePublicSummary,
  TownSocialResponseReaction,
  TownSocialResponseReactionKind,
  TownSocialResponseRuntimeState,
  TownSocialResponseSourceKind,
  TownSocialResponseStatus
} from "./town/social-response";
import {
  addEventToTownTickIndex,
  createTownPerformanceSummary,
  createTownTickIndex,
  normalizeTownExecutionPolicy,
  recordTownPhaseTiming,
  type TownExecutionPolicy,
  type TownPerformanceSummary,
  type TownSnapshotMode,
  type TownTickIndex
} from "./town/execution";
export { PERSISTENT_TOWN_PHASE_BOUNDARIES, PERSISTENT_TOWN_TICK_PHASES } from "./town/runtime";
export type { TownTickPhaseName } from "./town/runtime";
export type { TownExecutionPolicy, TownPerformanceSummary, TownPhaseTiming, TownSnapshotMode, TownTickIndex } from "./town/execution";
import type { CurrentExperimentRef, PackRegistryEntry, ScenarioPack } from "./scenario-pack";
import type { BenchmarkRunSummary, RunJob } from "./run-catalog";
import type { CampaignGraphSummary, EvidenceGraphSummary } from "./campaign-graphs";
import type { TownMapPack } from "./town-map-pack";
import type { DetectiveDirectiveResponseConfig, WorldSystemRuntimeActionKind, WorldSystemRuntimeHints, WorldSystemRuntimeHintSummary } from "./detective-content";
import { computeSocialPressures, simulateDailyLife, simulateWorldTick } from "./world-simulator";
import type { CaseFromLog, EmergenceBenchmarkReport, MemoryKind, MemoryRecord, MurderArchetype, NPCProfile, SocialPressure, WorldEvent, WorldMode, WorldState } from "./world-types";

export type PersistentTownRuntimeStatus = "paused" | "running" | "completed" | "blocked";

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
  | "permit-forgery";

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

type TownTickActionPlan = {
  npc: NPCProfile;
  actorIndex: number;
  candidates: NpcActionCandidate[];
  selected: NpcActionCandidate;
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

export const TOWN_CASE_TYPES: TownCaseType[] = [
  "murder",
  "missing-person",
  "ledger-fraud",
  "false-testimony",
  "medical-coverup",
  "family-scandal",
  "merchant-extortion",
  "police-misjudgment",
  "media-rumor",
  "evidence-tampering",
  "dock-smuggling",
  "forged-will",
  "court-intimidation",
  "blackmail",
  "witness-disappearance",
  "archive-vanishing",
  "clinic-inventory-gap",
  "dock-witness-swap",
  "editorial-coercion",
  "household-escrow",
  "permit-forgery"
];

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
  longChainComputedAtTick?: number;
  triggeredCases?: TownTriggeredCaseRecord[];
  campaignCaseTarget?: number;
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

const DEFAULT_SCENARIO_PASS_CRITERIA: Required<ScenarioPassCriteria> = {
  minValidCandidates: 1,
  requireHardLogic: true,
  maxBlockedCandidates: 8,
  minEventGrowth: 1,
  minMemoryGrowth: 1
};

function scenarioDefaultActorId(world: WorldState, runtime?: PersistentTownRuntime | null) {
  return runtime?.agentStates[0]?.npcId || world.npcs[0]?.id || "npc-1";
}

function scenarioDefaultConfig(actorId: string, intervention: ScenarioScheduledIntervention["intervention"], overrides: Partial<ScenarioConfig> = {}): ScenarioConfig {
  const baseName = overrides.name || "Town Counterfactual Scenario";
  const branchName = overrides.branches?.[0]?.name || `${baseName} branch`;
  const branchId = overrides.branches?.[0]?.id || `${String(baseName).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-branch`;
  return {
    name: baseName,
    seed: overrides.seed || "persistent-town-scenario",
    baselineSteps: overrides.baselineSteps ?? 45,
    worldOptions: overrides.worldOptions,
    branches: [{
      id: branchId,
      name: branchName,
      steps: overrides.branches?.[0]?.steps ?? 12,
      interventions: [{
        atTickOffset: overrides.branches?.[0]?.interventions?.[0]?.atTickOffset ?? 1,
        intervention: {
          ...intervention,
          ...(overrides.branches?.[0]?.interventions?.[0]?.intervention || {}),
          actorId: overrides.branches?.[0]?.interventions?.[0]?.intervention.actorId || intervention.actorId || actorId
        }
      }]
    }],
    passCriteria: {
      ...DEFAULT_SCENARIO_PASS_CRITERIA,
      ...(overrides.passCriteria || {})
    }
  };
}

export function createBuiltInScenarioPresets(world: WorldState, runtime?: PersistentTownRuntime | null): ScenarioPreset[] {
  const actorId = scenarioDefaultActorId(world, runtime);
  return [
    {
      id: "resource-counterfactual",
      name: "Resource counterfactual",
      description: "Give one actor a bounded resource change and compare the downstream candidate chain.",
      builtIn: true,
      config: scenarioDefaultConfig(actorId, { actorId, kind: "resource", value: "resource:review-mode" }, {
        name: "Resource counterfactual",
        seed: `${world.seed}-resource-counterfactual`,
        branches: [{ id: "resource-counterfactual-branch", name: "Resource branch", interventions: [] }]
      })
    },
    {
      id: "knowledge-counterfactual",
      name: "Knowledge counterfactual",
      description: "Inject one known fact and compare memory growth, candidate validity, and branch divergence.",
      builtIn: true,
      config: scenarioDefaultConfig(actorId, { actorId, kind: "knowledge", value: "fact:review-mode" }, {
        name: "Knowledge counterfactual",
        seed: `${world.seed}-knowledge-counterfactual`,
        branches: [{ id: "knowledge-counterfactual-branch", name: "Knowledge branch", interventions: [] }]
      })
    },
    {
      id: "relationship-pressure-counterfactual",
      name: "Relationship pressure counterfactual",
      description: "Raise relationship pressure for one actor and compare conflict escalation against baseline.",
      builtIn: true,
      config: scenarioDefaultConfig(actorId, { actorId, kind: "relationship-pressure", value: 78 }, {
        name: "Relationship pressure counterfactual",
        seed: `${world.seed}-relationship-pressure-counterfactual`,
        branches: [{ id: "relationship-pressure-counterfactual-branch", name: "Pressure branch", interventions: [] }]
      })
    }
  ];
}

function normalizeScenarioPreset(world: WorldState, preset: ScenarioPreset): ScenarioPreset {
  const builtIn = Boolean(preset.builtIn);
  const fallback = createBuiltInScenarioPresets(world).find((item) => item.id === preset.id);
  const config = normalizeScenarioConfig(world, {
    ...(fallback?.config || {}),
    ...(preset.config || {}),
    id: preset.config?.id || preset.id,
    name: preset.config?.name || preset.name
  });
  const firstBranch = config.branches?.[0];
  return {
    id: preset.id,
    name: preset.name || config.name || preset.id,
    description: preset.description || fallback?.description,
    builtIn,
    updatedAt: preset.updatedAt,
    config: {
      ...config,
      id: config.id || preset.id,
      branches: firstBranch ? [{
        ...firstBranch,
        interventions: firstBranch.interventions.slice(0, 1).map((scheduled) => ({
          ...scheduled,
          atTickOffset: Math.max(0, scheduled.atTickOffset),
          intervention: {
            ...scheduled.intervention,
            actorId: scheduled.intervention.actorId || scenarioDefaultActorId(world)
          }
        }))
      }] : []
    }
  };
}

export function listScenarioPresets(world: WorldState, runtime?: PersistentTownRuntime | null): ScenarioPreset[] {
  const builtIns = createBuiltInScenarioPresets(world, runtime);
  const builtInIds = new Set(builtIns.map((preset) => preset.id));
  const custom = (runtime?.scenarioPresets || [])
    .filter((preset) => !builtInIds.has(preset.id))
    .map((preset) => normalizeScenarioPreset(world, { ...preset, builtIn: false }));
  return [...builtIns, ...custom];
}

export function createScenarioRunSummary(run: ScenarioRun): ScenarioRunSummary {
  return {
    id: run.id,
    name: run.name,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    branchCount: run.report.branches.length,
    baselineEventGrowth: run.report.baseline.eventGrowth,
    baselineMemoryGrowth: run.report.baseline.memoryGrowth,
    validCandidateCount: run.report.baseline.validCandidateCount
  };
}

export function listScenarioRunSummaries(runtime?: PersistentTownRuntime | null): ScenarioRunSummary[] {
  return [...(runtime?.scenarioRuns || [])]
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .map(createScenarioRunSummary);
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

const TOWN_TICK_PHASES: readonly TownTickPhaseName[] = PERSISTENT_TOWN_TICK_PHASES;

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

function deriveNpcAgentStateIndexed(
  world: WorldState,
  npc: NPCProfile,
  events: WorldEvent[],
  runtime: PersistentTownRuntime | null | undefined,
  index?: TownTickIndex
): NpcAgentState {
  const pressures = index?.socialPressures || computeSocialPressures(world, events);
  const remembered = memoriesForNpc(world.memories || [], npc.id, index);
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
    fatigue: Math.min(10, existing?.fatigue ?? Math.floor(eventsForNpc(events, npc.id, index).length / 3)),
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

export function deriveNpcAgentState(world: WorldState, npc: NPCProfile, events: WorldEvent[] = [], runtime?: PersistentTownRuntime | null): NpcAgentState {
  return deriveNpcAgentStateIndexed(world, npc, events, runtime);
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
  const ruleState = runtime ? ensureTownRuleRuntimeState(world, runtime) : undefined;
  const profession = ruleState?.professions.find((item) => item.npcId === npc.id);
  const institution = profession?.institutionId ? ruleState?.institutions.find((item) => item.id === profession.institutionId) : undefined;
  const institutionActionPressure =
    !ruleState || !institution ? 0 :
    institution.kind === "police" && (candidate.kind === "investigate" || candidate.kind === "seek-alibi") ? Math.ceil(institution.pressure / 10) :
    institution.kind === "media" && candidate.kind === "spread-rumor" ? Math.ceil((institution.pressure + ruleState.publicOpinion.mediaPressure) / 16) :
    institution.kind === "family" && (candidate.kind === "pressure" || candidate.kind === "confront" || candidate.kind === "cover-up") ? Math.ceil(institution.pressure / 9) :
    institution.kind === "commerce" && candidate.kind === "obtain-resource" ? Math.ceil(institution.resources / 14) :
    institution.kind === "medical" && candidate.kind === "investigate" ? Math.ceil((institution.resources + institution.reputation) / 24) :
    Math.ceil(institution.policyPressure / 18);
  const publicOpinionPressure = ruleState ? Math.ceil((ruleState.publicOpinion.heat + ruleState.publicOpinion.witnessFear + ruleState.publicOpinion.rumorVelocity) / 36) : 0;
  const evidencePressure = ruleState ? Math.ceil((ruleState.evidenceContamination.contamination + (ruleState.evidenceContamination.riskByLocation[candidate.targetLocationId] || 0)) / 28) : 0;
  const ruleActionPressure = Math.min(10, institutionActionPressure + publicOpinionPressure + evidencePressure);
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
    institutionalPressure: Math.min(10, locationPressure.institutionalPressure + ruleActionPressure),
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
    Math.ceil((locationPressure.locationHeat + (score.institutionalPressure || 0) + locationPressure.resourceFlow) / 4) +
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
  if ((score.institutionalPressure || 0) >= 7) score.reasons.push(`${institution?.kind || "institution"} pressure and public opinion affect this action`);
  if (ruleState && candidate.kind === "investigate" && ruleState.evidenceContamination.contamination >= 40) score.reasons.push("evidence contamination makes investigation more urgent");
  if (ruleState && candidate.kind === "spread-rumor" && ruleState.publicOpinion.mediaPressure >= 40) score.reasons.push("media pressure makes rumor spread more likely");
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

const activeTownActionDefinitions: TownActionDefinition[] = createTownActionDefinitions({
  locationReachable,
  scoreCandidate,
  createEventForAction
});

const legacyTownActionDefinitions: TownActionDefinition[] = [
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
  return [...activeTownActionDefinitions];
}

function getTownActionDefinition(kind: NpcActionKind) {
  return activeTownActionDefinitions.find((definition) => definition.kind === kind) || activeTownActionDefinitions[0];
}

function worldSystemBiasForAction(runtime: PersistentTownRuntime | null | undefined, candidate: Omit<NpcActionCandidate, "score">) {
  const hints = runtime?.worldSystemHints;
  if (!hints?.summary.active) return 0;
  const value = hints.actionBias[candidate.kind as keyof typeof hints.actionBias] || 0;
  const arcBonus = deriveWorldArcActionPriorityBonus(runtime, candidate.kind);
  return Math.max(0, Math.min(4, value + arcBonus));
}

function recordSelectedWorldSystemBias(runtime: PersistentTownRuntime, selected: NpcActionCandidate) {
  const bias = selected.score.worldSystemBias || 0;
  if (!bias || !runtime.worldSystemHintSummary) return;
  runtime.worldSystemHintSummary = {
    ...runtime.worldSystemHintSummary,
    appliedBiasCount: runtime.worldSystemHintSummary.appliedBiasCount + 1,
    maxActionBias: Math.max(runtime.worldSystemHintSummary.maxActionBias, bias)
  };
}

function scoreNpcActionCandidatesIndexed(
  world: WorldState,
  npc: NPCProfile,
  events: WorldEvent[],
  runtime: PersistentTownRuntime | null | undefined,
  index?: TownTickIndex
): NpcActionCandidate[] {
  const state = index?.agentStateByNpcId.get(npc.id) || deriveNpcAgentStateIndexed(world, npc, events, runtime, index);
  const random = makeRandom(`${world.seed}:agent:${npc.id}:${runtime?.tick || 0}`);
  const locations = world.locations.length ? world.locations : [{ id: state.locationId }] as { id: string }[];
  const pressureTarget = (index?.pressureByNpcId.get(npc.id) || computeSocialPressures(world, events).filter((pressure) => pressure.npcId === npc.id))[0]?.targetId;
  const targetNpcId = pressureTarget || Object.keys(npc.relationships)[0];
  const targetNpc = world.npcs.find((item) => item.id === targetNpcId);
  const targetLocationId = targetNpc ? locationForNpc(targetNpc, runtime?.currentTime || world.currentTime || "08:00") : locations[Math.floor(random() * locations.length)]?.id || state.locationId;
  const buildInput: TownActionBuildInput = { world, npc, state, runtime, events, locations, targetNpcId, targetNpc, targetLocationId };
  return activeTownActionDefinitions.map((definition) => {
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
    const worldSystemBias = worldSystemBiasForAction(runtime, candidate);
    if (worldSystemBias) {
      score.worldSystemBias = worldSystemBias;
      score.reasons.push(`world-system hint favors ${candidate.kind} +${worldSystemBias}`);
    }
    const legal = candidate.legal && legality.legal && score.locationReachability > 0 && score.resourceAvailability > 0;
    return { ...candidate, legal, blockedReason: !legality.legal ? legality.reason : score.reasons.find((reason) => reason.includes("not")), score };
  });
}

export function scoreNpcActionCandidates(world: WorldState, npc: NPCProfile, events: WorldEvent[] = [], runtime?: PersistentTownRuntime | null): NpcActionCandidate[] {
  return scoreNpcActionCandidatesIndexed(world, npc, events, runtime);
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

const WORLD_LEAD_FOCUS_BY_ACTION: Record<WorldSystemRuntimeActionKind, WorldLeadFocus> = {
  "obtain-resource": "search",
  investigate: "search",
  "seek-alibi": "question",
  pressure: "question",
  "spread-rumor": "question",
  "cover-up": "challenge"
};

function worldLeadCopy(hints: WorldSystemRuntimeHints, focus: WorldLeadFocus) {
  if (focus === "search") {
    return {
      label: `${hints.resource.label} lead`,
      nextAction: "Prioritize the next legal certified search."
    };
  }
  if (focus === "question") {
    return {
      label: `${hints.faction.label} lead`,
      nextAction: "Prioritize the next legal certified witness question."
    };
  }
  return {
    label: `${hints.eventArchetype.label} lead`,
    nextAction: "Prioritize the next legal certified testimony challenge."
  };
}

export function deriveWorldLeadPreview(hints?: WorldSystemRuntimeHints | null): WorldLeadPublicSummary | undefined {
  if (!hints?.summary.active) return undefined;
  const ranked = (Object.entries(hints.actionBias) as Array<[WorldSystemRuntimeActionKind, number]>)
    .filter(([, bias]) => typeof bias === "number" && bias > 0)
    .sort(([leftKind, leftBias], [rightKind, rightBias]) => rightBias - leftBias || leftKind.localeCompare(rightKind));
  const [actionKind] = ranked[0] || ["investigate" as const, 0];
  const focus = WORLD_LEAD_FOCUS_BY_ACTION[actionKind] || "search";
  return {
    status: "pending",
    focus,
    ...worldLeadCopy(hints, focus)
  };
}

export function applyAuthoredCampaignLeadFocus(
  runtime: PersistentTownRuntime,
  definition: AuthoredCampaignCaseDefinition | null = authoredCampaignCaseForRuntime(runtime)
) {
  if (!definition || !runtime.worldSystemHints?.summary.active) return undefined;
  const hints = withAuthoredCampaignLeadFocus(runtime.worldSystemHints, definition.leadFocus);
  runtime.worldSystemHints = hints;
  runtime.worldSystemHintSummary = { ...hints.summary };
  runtime.worldLeadPreview = deriveWorldLeadPreview(hints);
  runtime.updatedAt = new Date().toISOString();
  return runtime.worldLeadPreview;
}

export function applyWorldLeadDecision(runtime: PersistentTownRuntime, input: WorldLeadDecisionInput) {
  const preview = deriveWorldLeadPreview(runtime.worldSystemHints);
  if (!preview) throw new Error("WORLD_LEAD_UNAVAILABLE");
  const existing = runtime.worldLeadDecisions?.[input.sessionId];
  const status: WorldLeadStatus = input.action === "follow"
    ? "followed"
    : input.action === "skip"
      ? "skipped"
      : existing?.status === "followed"
        ? "resolved"
        : existing?.status || "pending";
  const decision: WorldLeadDecision = {
    ...preview,
    status,
    nextAction: status === "skipped" || status === "resolved"
      ? "Continue the next eligible certified route step."
      : preview.nextAction,
    sessionId: input.sessionId,
    caseId: input.caseId || existing?.caseId,
    selectedAtTick: existing?.selectedAtTick ?? runtime.tick,
    ...(status === "resolved" ? { resolvedAtTick: runtime.tick } : {})
  };
  runtime.worldLeadDecisions = { ...(runtime.worldLeadDecisions || {}), [input.sessionId]: decision };
  runtime.worldLeadPreview = preview;
  runtime.updatedAt = new Date().toISOString();
  return toWorldLeadPublicSummary(decision);
}

export function toWorldLeadPublicSummary(decision?: WorldLeadDecision | WorldLeadPublicSummary | null): WorldLeadPublicSummary | undefined {
  if (!decision) return undefined;
  return {
    status: decision.status,
    focus: decision.focus,
    label: decision.label,
    nextAction: decision.nextAction
  };
}

type WorldLeadOutcomePlan = {
  resourceKind: TownResourceKind;
  location: Pick<TownLocationProfile, "heat" | "security" | "footTraffic" | "resourcePressure">;
  institution: { resources: number; reputation: number; pressure: number };
  resource: { available: number; pressure: number };
  benefitLabel: string;
  costLabel: string;
};

const WORLD_LEAD_OUTCOME_PLAN: Record<WorldLeadFocus, WorldLeadOutcomePlan> = {
  search: {
    resourceKind: "police_time",
    location: { heat: 2, security: 0, footTraffic: 0, resourcePressure: -3 },
    institution: { resources: -2, reputation: 0, pressure: 2 },
    resource: { available: 2, pressure: 2 },
    benefitLabel: "Search support reduces pressure around the investigation.",
    costLabel: "The support also draws limited capacity and added attention."
  },
  question: {
    resourceKind: "informant_trust",
    location: { heat: -3, security: 0, footTraffic: 2, resourcePressure: 0 },
    institution: { resources: 0, reputation: 2, pressure: 2 },
    resource: { available: 2, pressure: 2 },
    benefitLabel: "Witness contact lowers local heat and strengthens safe outreach.",
    costLabel: "The extra traffic and coordination create a bounded burden."
  },
  challenge: {
    resourceKind: "evidence_integrity",
    location: { heat: 0, security: 3, footTraffic: 0, resourcePressure: 2 },
    institution: { resources: 0, reputation: 2, pressure: 3 },
    resource: { available: 2, pressure: 2 },
    benefitLabel: "A verified challenge improves local safeguards and evidence readiness.",
    costLabel: "The review requires scarce support and raises short-term pressure."
  }
};

const WORLD_LEAD_INSTITUTION_BY_FACTION: Record<TownLocationProfile["factionInfluence"], string> = {
  civic: "inst-civic",
  commerce: "inst-commerce",
  medical: "inst-medical",
  culture: "inst-media",
  underground: "inst-dock-union",
  neutral: "inst-police"
};

export function deriveWorldLeadOutcomePlan(focus: WorldLeadFocus, faction: TownLocationProfile["factionInfluence"]) {
  const plan = WORLD_LEAD_OUTCOME_PLAN[focus];
  return {
    ...plan,
    location: { ...plan.location },
    institution: { ...plan.institution },
    resource: { ...plan.resource },
    institutionId: WORLD_LEAD_INSTITUTION_BY_FACTION[faction] || "inst-police"
  };
}

function worldLeadOutcomeSummary(outcome: WorldLeadOutcome, status: WorldLeadOutcomeStatus): WorldLeadOutcomePublicSummary {
  return {
    status,
    focus: outcome.focus,
    benefitLabel: outcome.benefitLabel,
    costLabel: outcome.costLabel,
    nextAction: status === "active"
      ? "Continue the certified route. This bounded world effect settles when the case closes."
      : "This case's bounded world effect has settled; continue with the next eligible route."
  };
}

function worldLeadOutcomeLocationId(world: WorldState, input: WorldLeadDecisionInput) {
  const requested = input.caseSceneLocationId;
  if (requested && world.locations.some((location) => location.id === requested)) return requested;
  return world.locations[0]?.id;
}

export function applyWorldLeadOutcome(world: WorldState, runtime: PersistentTownRuntime, input: WorldLeadDecisionInput): WorldLeadOutcomePublicSummary | undefined {
  if (!input.caseId) return undefined;
  const existing = runtime.worldLeadOutcome;
  if (existing?.caseId === input.caseId) return worldLeadOutcomeSummary(existing, "active");
  if (existing) settleWorldLeadOutcome(world, runtime, existing.caseId);
  const decision = runtime.worldLeadDecisions?.[input.sessionId];
  if (!decision || decision.status !== "resolved") return undefined;
  ensureLocationProfiles(world, runtime);
  const locationId = worldLeadOutcomeLocationId(world, input);
  const location = locationId ? locationProfileFor(world, locationId, runtime) : null;
  if (!location || !locationId) return undefined;
  const plan = deriveWorldLeadOutcomePlan(decision.focus, location.factionInfluence);
  const ruleState = ensureTownRuleRuntimeState(world, runtime);
  const institution = ruleState.institutions.find((item) => item.id === plan.institutionId);
  const resource = ruleState.resourceLedger[plan.resourceKind];
  if (!institution || !resource) return undefined;

  const nextLocation: TownLocationProfile = {
    ...location,
    heat: clamp(location.heat + plan.location.heat),
    security: clamp(location.security + plan.location.security),
    footTraffic: clamp(location.footTraffic + plan.location.footTraffic),
    resourcePressure: clamp(location.resourcePressure + plan.location.resourcePressure),
    updatedAtTick: runtime.tick
  };
  runtime.locationProfiles = (runtime.locationProfiles || []).map((item) => item.locationId === locationId ? nextLocation : item);
  const nextInstitution = {
    ...institution,
    resources: clamp(institution.resources + plan.institution.resources, 0, 100),
    reputation: clamp(institution.reputation + plan.institution.reputation, 0, 100),
    pressure: clamp(institution.pressure + plan.institution.pressure, 0, 100)
  };
  ruleState.institutions = ruleState.institutions.map((item) => item.id === institution.id ? nextInstitution : item);
  const nextResource = {
    ...resource,
    available: clamp(resource.available + plan.resource.available, 0, 100),
    pressure: clamp(resource.pressure + plan.resource.pressure, 0, 100)
  };
  ruleState.resourceLedger = { ...ruleState.resourceLedger, [plan.resourceKind]: nextResource };
  const outcome: WorldLeadOutcome = {
    status: "active",
    focus: decision.focus,
    benefitLabel: plan.benefitLabel,
    costLabel: plan.costLabel,
    nextAction: "Continue the certified route. This bounded world effect settles when the case closes.",
    caseId: input.caseId,
    locationId,
    institutionId: institution.id,
    resourceKind: plan.resourceKind,
    activatedAtTick: runtime.tick,
    applied: {
      location: {
        heat: nextLocation.heat - location.heat,
        security: nextLocation.security - location.security,
        footTraffic: nextLocation.footTraffic - location.footTraffic,
        resourcePressure: nextLocation.resourcePressure - location.resourcePressure
      },
      institution: {
        resources: nextInstitution.resources - institution.resources,
        reputation: nextInstitution.reputation - institution.reputation,
        pressure: nextInstitution.pressure - institution.pressure
      },
      resource: {
        available: nextResource.available - resource.available,
        pressure: nextResource.pressure - resource.pressure
      }
    }
  };
  const summary = worldLeadOutcomeSummary(outcome, "active");
  runtime.worldLeadOutcome = outcome;
  runtime.worldLeadOutcomeSummary = summary;
  runtime.updatedAt = new Date().toISOString();
  return summary;
}

export function settleWorldLeadOutcome(world: WorldState, runtime: PersistentTownRuntime, caseId?: string): WorldLeadOutcomePublicSummary | undefined {
  const outcome = runtime.worldLeadOutcome;
  if (!outcome || (caseId && outcome.caseId !== caseId)) return undefined;
  ensureLocationProfiles(world, runtime);
  const location = locationProfileFor(world, outcome.locationId, runtime);
  if (location) {
    const nextLocation: TownLocationProfile = {
      ...location,
      heat: clamp(location.heat - outcome.applied.location.heat),
      security: clamp(location.security - outcome.applied.location.security),
      footTraffic: clamp(location.footTraffic - outcome.applied.location.footTraffic),
      resourcePressure: clamp(location.resourcePressure - outcome.applied.location.resourcePressure),
      updatedAtTick: runtime.tick
    };
    runtime.locationProfiles = (runtime.locationProfiles || []).map((item) => item.locationId === outcome.locationId ? nextLocation : item);
  }
  const ruleState = ensureTownRuleRuntimeState(world, runtime);
  ruleState.institutions = ruleState.institutions.map((institution) => institution.id !== outcome.institutionId
    ? institution
    : {
        ...institution,
        resources: clamp(institution.resources - outcome.applied.institution.resources, 0, 100),
        reputation: clamp(institution.reputation - outcome.applied.institution.reputation, 0, 100),
        pressure: clamp(institution.pressure - outcome.applied.institution.pressure, 0, 100)
      });
  const resource = ruleState.resourceLedger[outcome.resourceKind];
  if (resource) {
    ruleState.resourceLedger = {
      ...ruleState.resourceLedger,
      [outcome.resourceKind]: {
        ...resource,
        available: clamp(resource.available - outcome.applied.resource.available, 0, 100),
        pressure: clamp(resource.pressure - outcome.applied.resource.pressure, 0, 100)
      }
    };
  }
  const summary = worldLeadOutcomeSummary(outcome, "settled");
  runtime.worldLeadOutcome = undefined;
  runtime.worldLeadOutcomeSummary = summary;
  runtime.updatedAt = new Date().toISOString();
  return summary;
}

function worldLeadCaseHandoffCopy(focus: WorldLeadFocus, status: WorldLeadCaseHandoffStatus) {
  const label = focus === "search"
    ? "Evidence follow-up"
    : focus === "question"
      ? "Witness follow-up"
      : "Review follow-up";
  return {
    status,
    focus,
    label,
    nextAction: status === "ready"
      ? "The next case queue carries a bounded follow-up preference; choose any legal candidate."
      : "The follow-up was carried into the next extracted case; continue the normal investigation path."
  } satisfies WorldLeadCaseHandoffPublicSummary;
}

export function prepareWorldLeadCaseHandoff(runtime: PersistentTownRuntime, input: { settledCaseId: string; focus: WorldLeadFocus }) {
  const existing = runtime.worldLeadCaseHandoff;
  if (existing?.status === "ready" && existing.settledCaseId === input.settledCaseId) {
    return toWorldLeadCaseHandoffPublicSummary(existing);
  }
  const handoff: WorldLeadCaseHandoff = {
    ...worldLeadCaseHandoffCopy(input.focus, "ready"),
    settledCaseId: input.settledCaseId,
    preparedAtTick: runtime.tick
  };
  const summary = toWorldLeadCaseHandoffPublicSummary(handoff)!;
  runtime.worldLeadCaseHandoff = handoff;
  runtime.worldLeadCaseHandoffSummary = summary;
  invalidateTownCandidateCache(runtime);
  runtime.updatedAt = new Date().toISOString();
  return summary;
}

export function consumeWorldLeadCaseHandoff(runtime: PersistentTownRuntime, consumedByCaseId: string) {
  const handoff = runtime.worldLeadCaseHandoff;
  if (!handoff || handoff.status !== "ready") return undefined;
  const consumed: WorldLeadCaseHandoff = {
    ...handoff,
    ...worldLeadCaseHandoffCopy(handoff.focus, "consumed"),
    consumedByCaseId,
    consumedAtTick: runtime.tick
  };
  const summary = toWorldLeadCaseHandoffPublicSummary(consumed)!;
  runtime.worldLeadCaseHandoff = consumed;
  runtime.worldLeadCaseHandoffSummary = summary;
  invalidateTownCandidateCache(runtime);
  runtime.updatedAt = new Date().toISOString();
  return summary;
}

export function deriveWorldLeadCaseHandoffPriorityBonus(handoff: WorldLeadCaseHandoff | null | undefined, caseType: TownCaseType | undefined) {
  return deriveWorldLeadHandoffInfluence(handoff, caseType)?.weight || 0;
}

export function toWorldLeadCaseHandoffPublicSummary(handoff?: WorldLeadCaseHandoff | WorldLeadCaseHandoffPublicSummary | null): WorldLeadCaseHandoffPublicSummary | undefined {
  if (!handoff) return undefined;
  return {
    status: handoff.status,
    focus: handoff.focus,
    label: handoff.label,
    nextAction: handoff.nextAction
  };
}

function worldArcSummary(progress: WorldArcProgress): WorldArcPublicSummary {
  const completedStages = Math.max(0, Math.min(progress.stageCount, progress.completedStages));
  const status: WorldArcStatus = completedStages >= progress.stageCount ? "completed" : "active";
  return {
    status,
    label: progress.label,
    completedStages,
    stageCount: progress.stageCount,
    progressLabel: `${completedStages}/${progress.stageCount} stages`,
    pulseLabel: progress.pulseLabel,
    nextAction: status === "completed"
      ? "This world line is complete. Choose any legal next case to continue the town story."
      : completedStages > 0
        ? "Follow the case-scoped lead and close the certified route to advance this world line."
        : "Follow the case-scoped lead to begin this world line without changing the certified route."
  };
}

export function toWorldArcPublicSummary(progress?: WorldArcProgress | WorldArcPublicSummary | null): WorldArcPublicSummary | undefined {
  if (!progress) return undefined;
  return {
    status: progress.status,
    label: progress.label,
    completedStages: progress.completedStages,
    stageCount: progress.stageCount,
    progressLabel: progress.progressLabel,
    pulseLabel: progress.pulseLabel,
    nextAction: progress.nextAction
  };
}

export function activateWorldArcForHints(runtime: PersistentTownRuntime, hints: WorldSystemRuntimeHints, caseId: string) {
  const progressionLineId = hints.source?.progressionLineId;
  if (!progressionLineId || !hints.progressionLine.stageCount) return undefined;
  const state = runtime.worldArcProgress || { lines: {} };
  const existing = state.lines[progressionLineId];
  if (existing?.activeCaseId === caseId && state.currentLineId === progressionLineId) {
    const summary = worldArcSummary(existing);
    runtime.worldArcSummary = summary;
    return summary;
  }
  const progress: WorldArcProgress = existing
    ? {
        ...existing,
        activeCaseId: caseId,
        updatedAtTick: runtime.tick
      }
    : {
        status: "active",
        label: hints.progressionLine.label,
        completedStages: 0,
        stageCount: hints.progressionLine.stageCount,
        progressLabel: `0/${hints.progressionLine.stageCount} stages`,
        pulseLabel: `${hints.resource.label} / ${hints.faction.label} / ${hints.eventArchetype.label}`,
        nextAction: "Follow the case-scoped lead to begin this world line without changing the certified route.",
        progressionLineId,
        compatibleCaseTypeIds: [...(hints.source?.progressionCaseTypeIds || [])],
        activeCaseId: caseId,
        startedAtTick: runtime.tick,
        updatedAtTick: runtime.tick
      };
  const summary = worldArcSummary(progress);
  const nextProgress = { ...progress, ...summary };
  runtime.worldArcProgress = {
    currentLineId: progressionLineId,
    lines: { ...state.lines, [progressionLineId]: nextProgress }
  };
  runtime.worldArcSummary = summary;
  invalidateTownCandidateCache(runtime);
  runtime.updatedAt = new Date().toISOString();
  return summary;
}

export function advanceWorldArc(runtime: PersistentTownRuntime, input: { caseId: string; focus: WorldLeadFocus }) {
  const state = runtime.worldArcProgress;
  const progressionLineId = state?.currentLineId;
  const current = progressionLineId ? state?.lines[progressionLineId] : undefined;
  if (!state || !progressionLineId || !current || current.status === "completed") return undefined;
  if (current.activeCaseId !== input.caseId || current.lastAdvancedCaseId === input.caseId) return undefined;
  const completedStages = Math.min(current.stageCount, current.completedStages + 1);
  const next: WorldArcProgress = {
    ...current,
    completedStages,
    lastAdvancedCaseId: input.caseId,
    lastFocus: input.focus,
    updatedAtTick: runtime.tick,
    ...(completedStages >= current.stageCount ? { completedAtTick: runtime.tick } : {})
  };
  const summary = worldArcSummary(next);
  const nextProgress = { ...next, ...summary };
  runtime.worldArcProgress = {
    currentLineId: progressionLineId,
    lines: { ...state.lines, [progressionLineId]: nextProgress }
  };
  runtime.worldArcSummary = summary;
  invalidateTownCandidateCache(runtime);
  runtime.updatedAt = new Date().toISOString();
  return summary;
}

function currentWorldArcDirective(runtime: PersistentTownRuntime) {
  const state = runtime.worldArcDirectives;
  if (!state?.items.length) return undefined;
  return state.items.find((item) => item.id === state.activeId)
    || state.items.find((item) => item.status !== "completed")
    || state.items[state.items.length - 1];
}

function directiveProgressLabel(runtime: PersistentTownRuntime, directive: WorldArcDirective) {
  if (directive.status === "ready") return directive.choice === "defer" ? "Deferred / response still open" : "Awaiting player response";
  if (directive.status === "scheduled") return "Scheduled for the next institution cycle";
  if (directive.status === "blocked") return `Blocked / ${directive.blockedCategory || "operation unavailable"}`;
  if (directive.status === "completed") return "World operation completed";
  const action = runtime.ruleState?.longActions.find((item) => item.id === directive.longActionId);
  return action ? `Operation ${Math.max(0, Math.min(100, action.progress))}% complete` : "World operation in progress";
}

function directiveNextAction(directive: WorldArcDirective) {
  if (directive.status === "ready") return directive.choice === "defer"
    ? "The response remains open. Support or contain it when you are ready."
    : "Choose Support, Contain, or Defer without advancing the town clock.";
  if (directive.status === "scheduled") return "Advance Persistent Town; the operation starts on the next legal institution cycle.";
  if (directive.status === "running") return "Advance Persistent Town to let the existing multi-step operation resolve.";
  if (directive.status === "blocked") return "Choose the alternate response or retry after the world state changes.";
  return "The result now persists as town history and may shape future, unextracted cases.";
}

export function toWorldArcDirectivePublicSummary(runtime: PersistentTownRuntime): WorldArcDirectivePublicSummary | undefined {
  const directive = currentWorldArcDirective(runtime);
  if (!directive) return undefined;
  const selected = directive.choice === "support" || directive.choice === "contain" ? directive.responses[directive.choice] : undefined;
  const queuedCount = (runtime.worldArcDirectives?.items || []).filter((item) => item.status !== "completed" && item.id !== directive.id).length;
  return {
    status: directive.status,
    choice: directive.choice,
    lineLabel: directive.lineLabel,
    factionLabel: directive.factionLabel,
    operationLabel: selected?.label || "Faction response pending",
    benefitLabel: selected?.benefitLabel || "Support and Contain produce different bounded world results.",
    costLabel: selected?.costLabel || "Each response commits existing institution resources across several normal steps.",
    progressLabel: directiveProgressLabel(runtime, directive),
    queuedCount,
    nextAction: directiveNextAction(directive),
    blockedCategory: directive.blockedCategory,
    options: {
      support: {
        label: directive.responses.support.label,
        benefitLabel: directive.responses.support.benefitLabel,
        costLabel: directive.responses.support.costLabel
      },
      contain: {
        label: directive.responses.contain.label,
        benefitLabel: directive.responses.contain.benefitLabel,
        costLabel: directive.responses.contain.costLabel
      }
    }
  };
}

function refreshWorldArcDirectiveSummary(runtime: PersistentTownRuntime) {
  runtime.worldArcDirectiveSummary = toWorldArcDirectivePublicSummary(runtime);
  runtime.updatedAt = new Date().toISOString();
  return runtime.worldArcDirectiveSummary;
}

function retainWorldArcDirectives(items: WorldArcDirective[]) {
  if (items.length <= 32) return items;
  const unresolved = items.filter((item) => item.status !== "completed");
  const completed = items.filter((item) => item.status === "completed");
  return [...completed.slice(Math.max(0, completed.length - Math.max(0, 32 - unresolved.length))), ...unresolved].slice(-32);
}

export function enqueueWorldArcDirective(runtime: PersistentTownRuntime, input: {
  sourceCaseId: string;
  eventArchetypeId: string;
  sourceFactionKind?: string;
  focusCaseTypeIds?: string[];
  focusCaseLabel?: string;
  responses?: {
    support: DetectiveDirectiveResponseConfig;
    contain: DetectiveDirectiveResponseConfig;
  };
}) {
  const arcState = runtime.worldArcProgress;
  const progressionLineId = arcState?.currentLineId;
  const arc = progressionLineId ? arcState?.lines[progressionLineId] : undefined;
  if (!progressionLineId || !arc || !input.responses || arc.completedStages < 1) return undefined;
  const id = `world-arc-directive-${progressionLineId}-${arc.completedStages}`;
  const state = runtime.worldArcDirectives || { items: [] };
  if (state.items.some((item) => item.id === id)) {
    runtime.worldArcDirectives = state;
    return refreshWorldArcDirectiveSummary(runtime);
  }
  if (state.items.length >= 32) {
    runtime.worldArcDirectives = state;
    return refreshWorldArcDirectiveSummary(runtime);
  }
  const directive: WorldArcDirective = {
    id,
    status: "ready",
    progressionLineId,
    completedStage: arc.completedStages,
    sourceCaseId: input.sourceCaseId,
    eventArchetypeId: input.eventArchetypeId,
    lineLabel: arc.label,
    factionLabel: runtime.worldSystemHints?.faction.label || "Town faction",
    sourceFactionKind: input.sourceFactionKind,
    focusCaseTypeIds: Array.from(new Set(input.focusCaseTypeIds || [])).slice(0, 8),
    focusCaseLabel: input.focusCaseLabel,
    responses: {
      support: { ...input.responses.support },
      contain: { ...input.responses.contain }
    },
    createdAtTick: runtime.tick,
    attemptCount: 0
  };
  const active = state.items.find((item) => item.id === state.activeId);
  runtime.worldArcDirectives = {
    activeId: !active || active.status === "completed" ? directive.id : state.activeId,
    items: retainWorldArcDirectives([...state.items, directive])
  };
  return refreshWorldArcDirectiveSummary(runtime);
}

export function applyWorldArcDirectiveDecision(runtime: PersistentTownRuntime, input: WorldArcDirectiveDecisionInput) {
  const directive = currentWorldArcDirective(runtime);
  if (!directive || (directive.status !== "ready" && directive.status !== "blocked")) return undefined;
  const state = runtime.worldArcDirectives!;
  const next: WorldArcDirective = input.choice === "defer"
    ? {
        ...directive,
        status: "ready",
        choice: "defer",
        blockedCategory: undefined,
        blockedAtTick: undefined
      }
    : {
        ...directive,
        status: "scheduled",
        choice: input.choice,
        scheduledAtTick: runtime.tick,
        startedAtTick: undefined,
        completedAtTick: undefined,
        blockedAtTick: undefined,
        institutionId: undefined,
        actorId: undefined,
        longActionId: undefined,
        startEventId: undefined,
        completionEventId: undefined,
        reservedResources: undefined,
        reservationReleasedAtTick: undefined,
        blockedCategory: undefined
      };
  runtime.worldArcDirectives = {
    activeId: next.id,
    items: state.items.map((item) => item.id === next.id ? next : item)
  };
  if (input.choice !== "defer") {
    runtime.maxTicks = Math.max(runtime.maxTicks, runtime.tick + 12);
    if (runtime.status === "completed") runtime.status = "paused";
  }
  return refreshWorldArcDirectiveSummary(runtime);
}

function directiveBlockedCategory(reason: string | undefined): NonNullable<WorldArcDirectivePublicSummary["blockedCategory"]> {
  if (/institution/i.test(reason || "")) return "institution unavailable";
  if (/actor|staff|running/i.test(reason || "")) return "staff unavailable";
  if (/insufficient|resource|capacity|credit|trust|docket|time/i.test(reason || "")) return "resource unavailable";
  return "operation unavailable";
}

function updateDirective(runtime: PersistentTownRuntime, next: WorldArcDirective) {
  const state = runtime.worldArcDirectives || { items: [] };
  runtime.worldArcDirectives = {
    activeId: next.id,
    items: state.items.map((item) => item.id === next.id ? next : item)
  };
  refreshWorldArcDirectiveSummary(runtime);
}

function promoteNextWorldArcDirective(runtime: PersistentTownRuntime, completed: WorldArcDirective) {
  const state = runtime.worldArcDirectives || { items: [] };
  const items = state.items.map((item) => item.id === completed.id ? completed : item);
  const next = items.find((item) => item.status !== "completed" && item.id !== completed.id);
  runtime.worldArcDirectives = { activeId: next?.id || completed.id, items };
  refreshWorldArcDirectiveSummary(runtime);
}

function reconcileWorldArcDirectiveLongAction(world: WorldState, runtime: PersistentTownRuntime): WorldEvent[] {
  const directive = currentWorldArcDirective(runtime);
  if (!directive || directive.status !== "running") return [];
  const ruleState = ensureTownRuleRuntimeState(world, runtime);
  const action = ruleState.longActions.find((item) => item.id === directive.longActionId);
  if (action?.status === "completed") {
    if (directive.completionEventId) return [];
    const completionEventId = `world-arc-directive-complete-${directive.id}-${directive.attemptCount}`;
    const event: WorldEvent = {
      id: completionEventId,
      worldId: world.id,
      day: runtime.currentDay,
      time: runtime.currentTime,
      type: "forensic_clue",
      actorIds: [],
      locationId: action.targetLocationId || world.locations[0]?.id || "town-square",
      summary: "A faction directive operation reaches its durable result.",
      publicSummary: "A bounded faction operation becomes part of the town's ongoing history.",
      hidden: false,
      relatedCharacterIds: [],
      tags: ["world_arc_directive", "directive_complete"],
      causedByEventIds: directive.startEventId ? [directive.startEventId] : [],
      explanation: "The existing long-action lifecycle completed the selected faction response."
    };
    mergeWorldPressurePulse(runtime, deriveWorldPressurePulseFromCompletedAction({
      runtime: ruleState,
      action,
      directive,
      tick: runtime.tick
    }));
    if (directive.choice === "support" || directive.choice === "contain") {
      enqueueTownSocialResponse(world, runtime, {
        sourceKey: directive.id,
        sourceKind: "faction-directive",
        direction: deriveTownSocialResponseDirectionFromCompletedAction(ruleState, action),
        institutionId: directive.institutionId,
        institutionKind: directive.responses[directive.choice].institutionKind,
        anchorNpcId: directive.actorId,
        locationId: action.targetLocationId
      });
    }
    if (directive.choice === "support" || directive.choice === "contain") {
      recordCompletedDirectiveFactionRelationships(runtime, {
        directiveId: directive.id,
        choice: directive.choice,
        responseInstitutionKind: directive.responses[directive.choice].institutionKind,
        sourceFactionKind: directive.sourceFactionKind
      });
    }
    const completedDirective: WorldArcDirective = {
      ...directive,
      status: "completed",
      completedAtTick: runtime.tick,
      completionEventId,
      blockedCategory: undefined
    };
    enqueueWorldEventOfferFromCompletedDirective(runtime, completedDirective);
    promoteNextWorldArcDirective(runtime, completedDirective);
    return [event];
  }
  if (!action || action.status === "blocked" || action.status === "cancelled") {
    if (!directive.reservationReleasedAtTick && directive.reservedResources) {
      releaseTownLongActionReservation(ruleState, directive.reservedResources);
    }
    updateDirective(runtime, {
      ...directive,
      status: "blocked",
      blockedAtTick: runtime.tick,
      reservationReleasedAtTick: directive.reservationReleasedAtTick || runtime.tick,
      blockedCategory: directiveBlockedCategory(action?.blockedReason || "operation unavailable")
    });
  }
  return [];
}

function startScheduledWorldArcDirective(world: WorldState, events: WorldEvent[], runtime: PersistentTownRuntime) {
  const directive = currentWorldArcDirective(runtime);
  if (!directive || directive.status !== "scheduled" || runtime.tick % 5 !== 0 || (directive.choice !== "support" && directive.choice !== "contain")) {
    return { events: [] as WorldEvent[], excludedInstitutionIds: [] as string[] };
  }
  const response = directive.responses[directive.choice];
  const ruleState = ensureTownRuleRuntimeState(world, runtime);
  const institution = [...ruleState.institutions]
    .filter((item) => item.kind === response.institutionKind)
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  if (!institution) {
    updateDirective(runtime, { ...directive, status: "blocked", blockedAtTick: runtime.tick, blockedCategory: "institution unavailable" });
    return { events: [] as WorldEvent[], excludedInstitutionIds: [] as string[] };
  }
  const living = new Set(world.npcs.filter((npc) => npc.alive).map((npc) => npc.id));
  const profession = [...ruleState.professions]
    .filter((item) => item.institutionId === institution.id && living.has(item.npcId))
    .sort((left, right) => right.rank - left.rank || left.workload - right.workload || left.npcId.localeCompare(right.npcId))[0];
  const actor = profession ? world.npcs.find((npc) => npc.id === profession.npcId && npc.alive) : undefined;
  if (!profession || !actor) {
    updateDirective(runtime, { ...directive, status: "blocked", blockedAtTick: runtime.tick, institutionId: institution.id, blockedCategory: "staff unavailable" });
    return { events: [] as WorldEvent[], excludedInstitutionIds: [] as string[] };
  }
  const targetLocationId = Object.entries(institution.influenceByLocation)
    .sort(([leftId, left], [rightId, right]) => right - left || leftId.localeCompare(rightId))[0]?.[0]
    || world.locations[0]?.id
    || "town-square";
  const attemptCount = directive.attemptCount + 1;
  const started = startTownLongAction({
    world,
    state: ruleState,
    actor,
    kind: response.longActionKind,
    events,
    tick: runtime.tick,
    targetLocationId,
    institutionId: institution.id
  });
  if (!started.action) {
    updateDirective(runtime, {
      ...directive,
      status: "blocked",
      blockedAtTick: runtime.tick,
      institutionId: institution.id,
      actorId: actor.id,
      attemptCount,
      blockedCategory: directiveBlockedCategory(started.blockedReason)
    });
    return { events: [] as WorldEvent[], excludedInstitutionIds: [] as string[] };
  }
  const eventId = `world-arc-directive-start-${directive.id}-${directive.choice}-${attemptCount}`;
  started.action.eventIds = [eventId];
  const decision: InstitutionDecision = {
    id: `world-arc-directive-decision-${directive.id}-${directive.choice}-${attemptCount}`,
    tick: runtime.tick,
    institutionId: institution.id,
    strategy: response.strategy,
    reason: "A player-selected faction response enters the existing institution and long-action cycle.",
    targetNpcId: actor.id,
    targetLocationId,
    eventId,
    worldSystemLabels: [directive.lineLabel, directive.factionLabel]
  };
  ruleState.institutionDecisions = [decision, ...(ruleState.institutionDecisions || [])].slice(0, 80);
  const event: WorldEvent = {
    id: eventId,
    worldId: world.id,
    day: runtime.currentDay,
    time: runtime.currentTime,
    type: response.strategy === "chase-headline" || response.strategy === "cultivate-informant" ? "witness" : "obtain_item",
    actorIds: [],
    locationId: targetLocationId,
    summary: "A faction directive operation begins through an existing town institution.",
    publicSummary: "A bounded faction operation has started and will take several normal town steps.",
    hidden: false,
    relatedCharacterIds: [],
    tags: ["world_arc_directive", "directive_start", response.strategy],
    causedByEventIds: [],
    explanation: "The selected response passed institution, actor, and resource checks."
  };
  updateDirective(runtime, {
    ...directive,
    status: "running",
    institutionId: institution.id,
    actorId: actor.id,
    longActionId: started.action.id,
    startEventId: eventId,
    startedAtTick: runtime.tick,
    attemptCount,
    reservedResources: started.reservedResources,
    reservationReleasedAtTick: undefined,
    blockedCategory: undefined
  });
  return { events: [event], excludedInstitutionIds: [institution.id] };
}

function currentWorldArc(runtime: PersistentTownRuntime | null | undefined) {
  const lineId = runtime?.worldArcProgress?.currentLineId;
  return lineId ? runtime?.worldArcProgress?.lines[lineId] : undefined;
}

export function deriveWorldArcActionPriorityBonus(runtime: PersistentTownRuntime | null | undefined, actionKind: NpcActionKind) {
  const arc = currentWorldArc(runtime);
  const hints = runtime?.worldSystemHints;
  if (!arc || arc.status !== "active" || arc.completedStages < 1 || !hints?.summary.active) return 0;
  const topKind = (Object.entries(hints.actionBias) as Array<[WorldSystemRuntimeActionKind, number]>)
    .filter(([, value]) => typeof value === "number" && value > 0)
    .sort(([leftKind, leftValue], [rightKind, rightValue]) => rightValue - leftValue || leftKind.localeCompare(rightKind))[0]?.[0];
  return topKind === actionKind ? 1 : 0;
}

export function deriveWorldArcCasePriorityBonus(runtime: PersistentTownRuntime | null | undefined, caseType: TownCaseType | undefined) {
  return deriveWorldArcCandidateInfluence(runtime, caseType)?.weight || 0;
}

export function createPersistentTownRuntime(
  world: WorldState,
  events: WorldEvent[] = [],
  options: Partial<Pick<PersistentTownRuntime, "tickIntervalMinutes" | "maxTicks" | "worldSystemHints">> & { now?: string } = {}
): PersistentTownRuntime {
  const now = options.now || new Date().toISOString();
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
    caseLifecycle: {
      activeCaseIds: [],
      solvedCaseIds: [],
      failedCaseIds: [],
      caseCooldownByNpcId: {},
      casePairCooldown: {},
      caseTypeHistory: [],
      caseTypeCooldown: {},
      locationCooldown: {},
      casePressureByInstitutionId: {},
      nextCaseWeights: {},
      caseTimeline: [],
      caseAftermathLog: []
    },
    simulationPhases: [...TOWN_TICK_PHASES],
    scenarioPresets: [],
    scenarioPacks: [],
    mapPacks: [],
    packRegistry: [],
    currentScenarioPackId: "small-town-review",
    currentMapPackId: "fog-lamp-town",
    currentRuleCatalogId: "detective-default",
    currentExperiment: {
      scenarioPackId: "small-town-review",
      mapPackId: "fog-lamp-town",
      ruleCatalogId: "detective-default",
      selectedAt: now
    },
    scenarioRuns: [],
    runJobs: [],
    benchmarkRuns: [],
    snapshots: [],
    ruleState: undefined,
    worldSystemHints: options.worldSystemHints,
    worldSystemHintSummary: options.worldSystemHints?.summary ? { ...options.worldSystemHints.summary } : undefined,
    worldLeadPreview: deriveWorldLeadPreview(options.worldSystemHints),
    worldLeadDecisions: {},
    playerResourceCommitments: { items: [] },
    factionRelationships: { standings: {}, ledger: [] },
    worldEventOffers: { items: [] },
    campaignRecoveries: { items: [] },
    investigatorHeadquarters: { items: [] },
    townSocialResponses: { items: [] },
    createdAt: now,
    updatedAt: now
  };
  ensureTownRuleRuntimeState(world, runtime);
  ensureSocialProfiles(world, runtime);
  ensureLocationProfiles(world, runtime);
  runtime.agentStates = world.npcs.map((npc) => deriveNpcAgentState(world, npc, events, runtime));
  runtime.playerResourceCommitmentSummary = toPlayerResourceCommitmentPublicSummary(runtime);
  ensureFactionRelationshipState(runtime);
  runtime.factionRelationshipSummary = toFactionRelationshipPublicSummary(runtime);
  runtime.worldEventOfferSummary = toWorldEventOfferPublicSummary(runtime);
  ensureInvestigatorProgression(runtime);
  runtime.investigatorProgressionSummary = toInvestigatorProgressionPublicSummary(runtime);
  ensureInvestigatorHeadquarters(runtime);
  runtime.investigatorHeadquartersSummary = toInvestigatorHeadquartersPublicSummary(runtime);
  runtime.campaignRecoverySummary = toCampaignRecoveryPublicSummary(runtime);
  refreshArcConvergence(runtime);
  ensureCampaignSession(runtime);
  refreshCampaignSession(runtime);
  refreshTownSocialResponseSummary(world, runtime);
  return runtime;
}

const PERSISTENT_RUNTIME_STATUSES = new Set<PersistentTownRuntimeStatus>(["paused", "running", "completed", "blocked"]);

function runtimeRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function runtimeArray<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? value as T[] : fallback;
}

function runtimeNumber(value: unknown, fallback: number, minimum = 0) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(minimum, Math.floor(value)) : fallback;
}

function runtimeText(value: unknown, fallback: string, maximum = 240) {
  return typeof value === "string" && value.length > 0 && value.length <= maximum ? value : fallback;
}

/**
 * Repairs legacy/missing Persistent Town JSON at the repository boundary without
 * advancing time, generating events, or discarding unknown forward-compatible fields.
 */
export function normalizePersistentTownRuntime(
  world: WorldState,
  events: WorldEvent[] = [],
  value: unknown
): PersistentTownRuntime {
  const source = runtimeRecord(value) || {};
  const stableNow = runtimeText(source.updatedAt, world.updatedAt || world.createdAt || "1970-01-01T00:00:00.000Z");
  const baseline = createPersistentTownRuntime(world, events, {
    tickIntervalMinutes: runtimeNumber(source.tickIntervalMinutes, 30, 1),
    maxTicks: runtimeNumber(source.maxTicks, Math.max(48, Math.ceil((world.timelineHours || 24) * 2)), 1),
    worldSystemHints: runtimeRecord(source.worldSystemHints) ? source.worldSystemHints as WorldSystemRuntimeHints : undefined,
    now: stableNow
  });
  const runtime = { ...baseline, ...source } as PersistentTownRuntime & Record<string, unknown>;
  runtime.id = runtimeText(source.id, baseline.id);
  runtime.worldId = world.id;
  runtime.status = PERSISTENT_RUNTIME_STATUSES.has(source.status as PersistentTownRuntimeStatus)
    ? source.status as PersistentTownRuntimeStatus
    : baseline.status;
  runtime.currentDay = runtimeNumber(source.currentDay, world.day || baseline.currentDay, 1);
  runtime.currentTime = typeof source.currentTime === "string" && /^\d{2}:\d{2}$/.test(source.currentTime)
    ? source.currentTime
    : world.currentTime || baseline.currentTime;
  runtime.tickIntervalMinutes = runtimeNumber(source.tickIntervalMinutes, baseline.tickIntervalMinutes, 1);
  runtime.maxTicks = runtimeNumber(source.maxTicks, baseline.maxTicks, 1);
  runtime.tick = Math.min(runtime.maxTicks, runtimeNumber(source.tick, baseline.tick));
  runtime.createdAt = runtimeText(source.createdAt, world.createdAt || stableNow);
  runtime.updatedAt = stableNow;

  runtime.agentStates = runtimeArray(source.agentStates, baseline.agentStates);
  runtime.decisionTraces = runtimeArray(source.decisionTraces, baseline.decisionTraces);
  runtime.candidates = runtimeArray(source.candidates, baseline.candidates);
  runtime.interventions = runtimeArray(source.interventions, baseline.interventions);
  runtime.reports = runtimeArray(source.reports, baseline.reports);
  runtime.pressureLedger = runtimeArray(source.pressureLedger, baseline.pressureLedger || []);
  runtime.eventObservations = runtimeArray(source.eventObservations, baseline.eventObservations || []);
  runtime.socialProfiles = runtimeArray(source.socialProfiles, baseline.socialProfiles || []);
  runtime.relationshipLedger = runtimeArray(source.relationshipLedger, baseline.relationshipLedger || []);
  runtime.locationProfiles = runtimeArray(source.locationProfiles, baseline.locationProfiles || []);
  runtime.locationLedger = runtimeArray(source.locationLedger, baseline.locationLedger || []);
  runtime.memoryPropagations = runtimeArray(source.memoryPropagations, baseline.memoryPropagations || []);
  runtime.consequences = runtimeArray(source.consequences, baseline.consequences || []);
  runtime.longChainLedger = runtimeArray(source.longChainLedger, baseline.longChainLedger || []);
  runtime.triggeredCases = runtimeArray(source.triggeredCases, baseline.triggeredCases || []);
  runtime.simulationPhases = runtimeArray(source.simulationPhases, baseline.simulationPhases || [...TOWN_TICK_PHASES]);
  runtime.scenarioPresets = runtimeArray(source.scenarioPresets, baseline.scenarioPresets || []);
  runtime.scenarioPacks = runtimeArray(source.scenarioPacks, baseline.scenarioPacks || []);
  runtime.mapPacks = runtimeArray(source.mapPacks, baseline.mapPacks || []);
  runtime.packRegistry = runtimeArray(source.packRegistry, baseline.packRegistry || []);
  runtime.scenarioRuns = runtimeArray(source.scenarioRuns, baseline.scenarioRuns || []);
  runtime.runJobs = runtimeArray(source.runJobs, baseline.runJobs || []);
  runtime.benchmarkRuns = runtimeArray(source.benchmarkRuns, baseline.benchmarkRuns || []);
  runtime.snapshots = runtimeArray(source.snapshots, baseline.snapshots || []);

  const lifecycle = runtimeRecord(source.caseLifecycle) || {};
  const baseLifecycle = baseline.caseLifecycle!;
  runtime.caseLifecycle = {
    ...baseLifecycle,
    ...lifecycle,
    activeCaseIds: runtimeArray(lifecycle.activeCaseIds, baseLifecycle.activeCaseIds),
    solvedCaseIds: runtimeArray(lifecycle.solvedCaseIds, baseLifecycle.solvedCaseIds),
    failedCaseIds: runtimeArray(lifecycle.failedCaseIds, baseLifecycle.failedCaseIds),
    caseCooldownByNpcId: runtimeRecord(lifecycle.caseCooldownByNpcId) as Record<string, number> || baseLifecycle.caseCooldownByNpcId,
    casePairCooldown: runtimeRecord(lifecycle.casePairCooldown) as Record<string, number> || baseLifecycle.casePairCooldown,
    caseTypeHistory: runtimeArray(lifecycle.caseTypeHistory, baseLifecycle.caseTypeHistory || []),
    caseTypeCooldown: runtimeRecord(lifecycle.caseTypeCooldown) as Partial<Record<TownCaseType, number>> || baseLifecycle.caseTypeCooldown,
    locationCooldown: runtimeRecord(lifecycle.locationCooldown) as Record<string, number> || baseLifecycle.locationCooldown,
    casePressureByInstitutionId: runtimeRecord(lifecycle.casePressureByInstitutionId) as Record<string, number> || baseLifecycle.casePressureByInstitutionId,
    nextCaseWeights: runtimeRecord(lifecycle.nextCaseWeights) as Record<string, number> || baseLifecycle.nextCaseWeights,
    caseTimeline: runtimeArray(lifecycle.caseTimeline, baseLifecycle.caseTimeline || []),
    caseAftermathLog: runtimeArray(lifecycle.caseAftermathLog, baseLifecycle.caseAftermathLog)
  };

  runtime.worldLeadDecisions = runtimeRecord(source.worldLeadDecisions) as Record<string, WorldLeadDecision> || baseline.worldLeadDecisions;
  runtime.playerResourceCommitments = runtimeRecord(source.playerResourceCommitments) as PlayerResourceCommitmentRuntimeState || baseline.playerResourceCommitments;
  runtime.factionRelationships = runtimeRecord(source.factionRelationships) as FactionRelationshipRuntimeState || baseline.factionRelationships;
  runtime.worldEventOffers = runtimeRecord(source.worldEventOffers) as WorldEventOfferRuntimeState || baseline.worldEventOffers;
  runtime.campaignRecoveries = runtimeRecord(source.campaignRecoveries) as CampaignRecoveryRuntimeState || baseline.campaignRecoveries;
  runtime.investigatorHeadquarters = runtimeRecord(source.investigatorHeadquarters) as InvestigatorHeadquartersRuntimeState || baseline.investigatorHeadquarters;
  runtime.townSocialResponses = runtimeRecord(source.townSocialResponses) as TownSocialResponseRuntimeState || baseline.townSocialResponses;

  ensureTownRuleRuntimeState(world, runtime);
  ensureSocialProfiles(world, runtime);
  ensureLocationProfiles(world, runtime);
  ensureFactionRelationshipState(runtime);
  ensureInvestigatorProgression(runtime);
  ensureInvestigatorHeadquarters(runtime);
  ensureCampaignSession(runtime);
  refreshArcConvergence(runtime);
  refreshCampaignSession(runtime);
  refreshTownSocialResponseSummary(world, runtime);
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

function buildStageEventIdsForPressure(world: WorldState, events: WorldEvent[], pressure: SocialPressure, runtime?: PersistentTownRuntime | null, index?: TownTickIndex) {
  const selected = selectRiskChainEvents(events, pressure, index);
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
    if (index ? !index.eventById.has(observation.eventId) : !events.some((event) => event.id === observation.eventId)) continue;
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

function summarizeLongChain(world: WorldState, events: WorldEvent[], runtime: PersistentTownRuntime, pressure: SocialPressure, index?: TownTickIndex): TownLongChainLedgerEntry {
  const stageEventIds = buildStageEventIdsForPressure(world, events, pressure, runtime, index);
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

function refreshLongChainLedger(world: WorldState, events: WorldEvent[], runtime: PersistentTownRuntime, index?: TownTickIndex) {
  if (runtime.longChainComputedAtTick === runtime.tick && runtime.longChainLedger?.length) return runtime.longChainLedger;
  const pressures = (index?.socialPressures || computeSocialPressures(world, events)).filter((pressure) => pressure.score >= 5).slice(0, (runtime.campaignCaseTarget || 3) > 3 ? 16 : 8);
  runtime.longChainLedger = pressures.map((pressure) => summarizeLongChain(world, events, runtime, pressure, index));
  runtime.longChainComputedAtTick = runtime.tick;
  return runtime.longChainLedger;
}

function triggerLongChainCaseIfReady(world: RuntimeWorld, runtime: PersistentTownRuntime, events: WorldEvent[], createdEvents: WorldEvent[], index?: TownTickIndex) {
  runtime.triggeredCases ||= [];
  const ledger = refreshLongChainLedger(world, events, runtime, index);
  const maturityThreshold = (runtime.campaignCaseTarget || 3) > 3 ? 82 : 90;
  const lifecycle = ensureCaseLifecycle(runtime);
  const ready = ledger
    .filter((entry) =>
      entry.complete &&
      entry.maturityScore >= maturityThreshold &&
      world.npcs.some((npc) => npc.id === entry.victimId && npc.alive) &&
      ((lifecycle.caseCooldownByNpcId[entry.culpritId] || 0) <= runtime.tick) &&
      ((lifecycle.caseCooldownByNpcId[entry.victimId] || 0) <= runtime.tick) &&
      ((lifecycle.casePairCooldown?.[`${entry.culpritId}->${entry.victimId}`] || 0) <= runtime.tick) &&
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

function selectRiskChainEvents(events: WorldEvent[], pressure: SocialPressure, index?: TownTickIndex) {
  const relatedSource = index
    ? Array.from(new Map([
        ...(index.eventsByActorId.get(pressure.npcId) || []),
        ...(index.eventsByActorId.get(pressure.targetId) || []),
        ...pressure.sourceEventIds.map((eventId) => index.eventById.get(eventId)).filter((event): event is WorldEvent => Boolean(event))
      ].map((event) => [event.id, event])).values())
    : events.filter((event) =>
        pressure.sourceEventIds.includes(event.id) ||
        event.actorIds.includes(pressure.npcId) ||
        event.actorIds.includes(pressure.targetId) ||
        event.relatedCharacterIds.includes(pressure.npcId) ||
        event.relatedCharacterIds.includes(pressure.targetId)
      );
  const related = relatedSource
    .sort((a, b) => eventMinuteValue(a) - eventMinuteValue(b));
  const stageOrder = ["motive", "means", "opportunity", "cover-up", "memory", "exclusion", "context"];
  const selected: WorldEvent[] = [];
  for (const stage of stageOrder) {
    const event = related.find((item) => chainStageForEvent(item) === stage && !selected.some((existing) => existing.id === item.id));
    if (event) selected.push(event);
  }
  for (const eventId of pressure.sourceEventIds) {
    const event = index?.eventById.get(eventId) || events.find((item) => item.id === eventId);
    if (event && !selected.some((item) => item.id === event.id)) selected.push(event);
  }
  return selected.slice(0, 8);
}

function ensureCaseLifecycle(runtime: PersistentTownRuntime): TownCaseLifecycleState {
  runtime.caseLifecycle ||= {
    activeCaseIds: [],
    solvedCaseIds: [],
    failedCaseIds: [],
    caseCooldownByNpcId: {},
    casePairCooldown: {},
    caseTypeHistory: [],
    caseTypeCooldown: {},
    locationCooldown: {},
    casePressureByInstitutionId: {},
    nextCaseWeights: {},
    caseTimeline: [],
    caseAftermathLog: []
  };
  runtime.caseLifecycle.caseTypeHistory ||= [];
  runtime.caseLifecycle.casePairCooldown ||= {};
  runtime.caseLifecycle.caseTypeCooldown ||= {};
  runtime.caseLifecycle.locationCooldown ||= {};
  runtime.caseLifecycle.caseTimeline ||= [];
  return runtime.caseLifecycle;
}

function inferCaseTypeFromSignals(input: {
  events?: WorldEvent[];
  evidenceItems?: EvidenceChainItem[];
  ruleState?: TownRuleRuntimeState;
  culpritId?: string;
  victimId?: string;
}): TownCaseType {
  const events = input.events || [];
  const tags = new Set(events.flatMap((event) => event.tags || []));
  const evidenceKinds = new Set((input.evidenceItems || []).map((item) => item.kind));
  const opinion = input.ruleState?.publicOpinion;
  const institutions = input.ruleState?.institutions || [];
  const courtPressure = institutions.find((institution) => institution.kind === "court")?.pressure || 0;
  const dockPressure = institutions.find((institution) => institution.kind === "dock_union")?.pressure || 0;
  const dockResources = institutions.find((institution) => institution.kind === "dock_union")?.resources || 50;
  const informantSignals = (input.evidenceItems || []).filter((item) => item.kind === "anonymous-tip").length;
  if (evidenceKinds.has("court-record") && evidenceKinds.has("receipt") && (tags.has("commerce") || tags.has("market"))) return "permit-forgery";
  if (evidenceKinds.has("court-record") && (evidenceKinds.has("document") || evidenceKinds.has("trace"))) return "archive-vanishing";
  if ((evidenceKinds.has("medical") || evidenceKinds.has("autopsy-note")) && evidenceKinds.has("ledger")) return "clinic-inventory-gap";
  if (informantSignals >= 1 && (evidenceKinds.has("footprint") || tags.has("dock"))) return "dock-witness-swap";
  if (evidenceKinds.has("newspaper-proof") && evidenceKinds.has("testimony")) return "editorial-coercion";
  if (evidenceKinds.has("family-letter") && (evidenceKinds.has("receipt") || evidenceKinds.has("key-impression"))) return "household-escrow";
  if (evidenceKinds.has("cargo-log") || tags.has("dock") || tags.has("cargo") || dockPressure >= 62 || dockResources <= 42) return "dock-smuggling";
  if (evidenceKinds.has("court-record") && (courtPressure >= 58 || tags.has("court"))) return "court-intimidation";
  if (evidenceKinds.has("family-letter") || tags.has("will")) return "forged-will";
  if (evidenceKinds.has("telegram") || (evidenceKinds.has("newspaper-proof") && (opinion?.mediaPressure || 0) >= 55)) return "blackmail";
  if (informantSignals >= 1 && (opinion?.witnessFear || 0) >= 45) return "witness-disappearance";
  if (evidenceKinds.has("ledger") || tags.has("ledger") || tags.has("commerce")) return "ledger-fraud";
  if (evidenceKinds.has("medical") || evidenceKinds.has("autopsy-note") || tags.has("medical") || tags.has("autopsy")) return "medical-coverup";
  if (evidenceKinds.has("rumor") || (opinion && opinion.mediaPressure + opinion.rumorVelocity >= 95)) return "media-rumor";
  if ((evidenceKinds.has("testimony") || evidenceKinds.has("alibi-note")) && (opinion?.witnessFear || 0) >= 55) return "false-testimony";
  if (institutions.some((institution) => institution.kind === "family" && institution.pressure >= 60)) return "family-scandal";
  if (institutions.some((institution) => institution.kind === "commerce" && institution.resources <= 45)) return "merchant-extortion";
  if (institutions.some((institution) => institution.kind === "police" && institution.pressure >= 70)) return "police-misjudgment";
  if ((input.evidenceItems || []).some((item) => (item.tamperHistory || []).length || item.contamination >= 55)) return "evidence-tampering";
  if (events.some((event) => event.type === "death")) return "murder";
  return tags.has("missing") ? "missing-person" : "murder";
}

function chooseCampaignCaseType(baseType: TownCaseType, lifecycle: TownCaseLifecycleState, runtime: PersistentTownRuntime, candidateIndex: number): TownCaseType {
  const history = lifecycle.caseTypeHistory || [];
  const historyCount = history.length;
  const selectedCampaign = selectedDetectiveCampaignForRuntime(runtime);
  const hasAuthoredCampaignSelection = selectedCampaign.id !== "town-reckoning" || Boolean(runtime.currentExperiment?.worldPackageId);
  if (historyCount < 1 && !hasAuthoredCampaignSelection) return baseType;
  const counts = new Map<TownCaseType, number>();
  for (const type of history) counts.set(type, (counts.get(type) || 0) + 1);
  const targetDistinct = historyCount >= 4 ? 4 : historyCount >= 2 ? 3 : 2;
  const distinct = counts.size;
  const tick = runtime.tick;
  const typeScores = TOWN_CASE_TYPES.map((type, index) => {
    const cooldownActive = ((lifecycle.caseTypeCooldown || {})[type] || 0) > tick;
    const weight = lifecycle.nextCaseWeights[type] || 1;
    const novelty = counts.has(type) ? 0 : distinct < targetDistinct ? 40 : 5;
    const repeatPenalty = (counts.get(type) || 0) * 12 + (cooldownActive ? 16 : 0);
    const baseBonus = type === baseType ? 4 : 0;
    const campaignBonus = deriveDetectiveCampaignCaseTypeBonus(runtime, type) * 6;
    const rotation = ((candidateIndex + historyCount + index) % TOWN_CASE_TYPES.length) / 10;
    return { type, score: weight * 10 + novelty + baseBonus + campaignBonus + rotation - repeatPenalty };
  }).sort((left, right) => right.score - left.score);
  if (distinct < targetDistinct) {
    const unseen = typeScores.find((item) => !counts.has(item.type) && (((lifecycle.caseTypeCooldown || {})[item.type] || 0) <= tick));
    if (unseen) return unseen.type;
  }
  return typeScores[0]?.type || baseType;
}

function buildCaseInfluenceTrace(runtime: PersistentTownRuntime, culpritId: string, victimId: string, evidenceItems?: EvidenceChainItem[]): CaseInfluenceTrace {
  const ruleState = runtime.ruleState;
  const professions = ruleState?.professions.filter((profession) => [culpritId, victimId].includes(profession.npcId)) || [];
  const institutionIds = Array.from(new Set([
    ...professions.map((profession) => profession.institutionId).filter((id): id is string => Boolean(id)),
    ...(ruleState?.institutions || []).filter((institution) => institution.pressure >= 55 || institution.resources <= 35).map((institution) => institution.id)
  ]));
  const longActions = (ruleState?.longActions || []).filter((action) =>
    [culpritId, victimId].includes(action.actorId) ||
    (action.targetNpcId ? [culpritId, victimId].includes(action.targetNpcId) : false)
  );
  const aftermaths = ruleState?.aftermaths || [];
  const relatedEvidence = evidenceItems?.length ? evidenceItems : (ruleState?.evidenceChain.items || []).slice(0, 5);
  return {
    institutionIds,
    professionIds: professions.map((profession) => `${profession.npcId}:${profession.kind}`),
    longActionIds: longActions.map((action) => action.id),
    institutionDecisionIds: (ruleState?.institutionDecisions || []).slice(0, 5).map((decision) => decision.id),
    evidenceChainItemIds: relatedEvidence.slice(0, 8).map((item) => item.id),
    relatedEvidenceIds: relatedEvidence.slice(0, 8).map((item) => item.id),
    contaminatedEvidenceIds: relatedEvidence.filter((item) => item.contamination >= 45 || (item.tamperHistory || []).length).map((item) => item.id).slice(0, 8),
    provenanceSources: Array.from(new Set(relatedEvidence.flatMap((item) => item.sourceEventIds))).slice(0, 12),
    evidenceWarnings: relatedEvidence
      .filter((item) => item.contamination >= 55 || item.integrity <= 45 || item.provenance === "weak")
      .map((item) => `${item.id}:${item.provenance}:${item.integrity}/${item.contamination}`)
      .slice(0, 8),
    resourceDeltas: Object.fromEntries((ruleState?.institutions || []).map((institution) => [institution.id, institution.resources - 50])),
    aftermathIds: aftermaths.slice(0, 5).map((aftermath) => aftermath.id),
    publicOpinionDelta: {
      heat: ruleState ? ruleState.publicOpinion.heat - 20 : 0,
      trustInPolice: ruleState ? ruleState.publicOpinion.trustInPolice - 58 : 0,
      witnessFear: ruleState ? ruleState.publicOpinion.witnessFear - 20 : 0,
      mediaPressure: ruleState ? ruleState.publicOpinion.mediaPressure - 30 : 0
    },
    evidenceContaminationDelta: ruleState ? ruleState.evidenceContamination.contamination - 10 : 0
  };
}

export function applyCaseResolutionToWorld(world: WorldState, runtime: PersistentTownRuntime, input: CaseResolutionInput): CaseResolutionResult {
  const lifecycle = ensureCaseLifecycle(runtime);
  const alreadyResolved = lifecycle.solvedCaseIds.includes(input.caseId) || lifecycle.failedCaseIds.includes(input.caseId);
  if (alreadyResolved) {
    return { lifecycle, influenceTrace: buildCaseInfluenceTrace(runtime, input.culpritId || "", input.victimId || "") };
  }
  const ruleState = ensureTownRuleRuntimeState(world, runtime);
  const aftermath = applyCaseAftermath(ruleState, {
    tick: runtime.tick,
    caseId: input.caseId,
    outcome: input.outcome,
    culpritId: input.culpritId,
    victimId: input.victimId,
    valid: input.valid
  });
  lifecycle.activeCaseIds = lifecycle.activeCaseIds.filter((id) => id !== input.caseId);
  if (input.valid || input.outcome === "solved" || input.outcome === "extracted") {
    lifecycle.solvedCaseIds = Array.from(new Set([input.caseId, ...lifecycle.solvedCaseIds])).slice(0, 40);
  } else {
    lifecycle.failedCaseIds = Array.from(new Set([input.caseId, ...lifecycle.failedCaseIds])).slice(0, 40);
  }
  const campaignCooldownTicks = (runtime.campaignCaseTarget || 3) >= 30 ? 160 : (runtime.campaignCaseTarget || 3) > 3 ? 24 : 8;
  for (const npcId of [input.culpritId, input.victimId].filter((id): id is string => Boolean(id))) {
    lifecycle.caseCooldownByNpcId[npcId] = runtime.tick + (input.valid ? campaignCooldownTicks : Math.max(4, Math.floor(campaignCooldownTicks / 2)));
  }
  if (input.culpritId && input.victimId) {
    const pairCooldownTicks = (runtime.campaignCaseTarget || 3) >= 30 ? 0 : campaignCooldownTicks * 2;
    lifecycle.casePairCooldown = {
      ...(lifecycle.casePairCooldown || {}),
      [`${input.culpritId}->${input.victimId}`]: runtime.tick + pairCooldownTicks
    };
  }
  const primaryEvidenceItems = input.evidenceItemIds?.length
    ? ruleState.evidenceChain.items.filter((item) => input.evidenceItemIds?.includes(item.id))
    : [];
  const primaryEvidenceIds = new Set(primaryEvidenceItems.map((item) => item.id));
  const fallbackEvidenceItems = ruleState.evidenceChain.items
    .filter((item) => !primaryEvidenceIds.has(item.id))
    .slice(0, Math.max(0, 3 - primaryEvidenceItems.length));
  const evidenceItems = (primaryEvidenceItems.length ? [...primaryEvidenceItems, ...fallbackEvidenceItems] : ruleState.evidenceChain.items.slice(0, 6)).slice(0, 6);
  const caseType = input.caseType || inferCaseTypeFromSignals({ evidenceItems, ruleState, culpritId: input.culpritId, victimId: input.victimId });
  lifecycle.caseTypeHistory = [caseType, ...(lifecycle.caseTypeHistory || [])].slice(0, 80);
  lifecycle.caseTypeCooldown = {
    ...(lifecycle.caseTypeCooldown || {}),
    [caseType]: runtime.tick + (input.valid ? Math.max(12, Math.min(campaignCooldownTicks, 36)) : 6)
  };
  if (input.locationId) {
    lifecycle.locationCooldown = {
      ...(lifecycle.locationCooldown || {}),
      [input.locationId]: runtime.tick + (input.valid ? Math.max(10, Math.min(campaignCooldownTicks, 30)) : 5)
    };
  }
  if (evidenceItems.length) {
    const evidenceIds = new Set(evidenceItems.map((item) => item.id));
    ruleState.evidenceChain = {
      ...ruleState.evidenceChain,
      updatedAtTick: runtime.tick,
      items: ruleState.evidenceChain.items.map((item) => evidenceIds.has(item.id)
        ? {
          ...item,
          caseId: input.caseId,
          caseIds: Array.from(new Set([...(item.caseIds || (item.caseId ? [item.caseId] : [])), input.caseId])).slice(-12),
          usedInResolution: true
        }
        : item)
    };
  }
  const policePressure = ruleState.institutions.find((institution) => institution.id === "inst-police")?.pressure || 0;
  const mediaPressure = ruleState.institutions.find((institution) => institution.id === "inst-media")?.pressure || 0;
  const familyPressure = ruleState.institutions.find((institution) => institution.id === "inst-family")?.pressure || 0;
  const commerceResources = ruleState.institutions.find((institution) => institution.id === "inst-commerce")?.resources || 50;
  const medicalResources = ruleState.institutions.find((institution) => institution.id === "inst-medical")?.resources || 50;
  const courtPressure = ruleState.institutions.find((institution) => institution.id === "inst-court")?.pressure || 0;
  const courtResources = ruleState.institutions.find((institution) => institution.id === "inst-court")?.resources || 50;
  const dockPressure = ruleState.institutions.find((institution) => institution.id === "inst-dock-union")?.pressure || 0;
  const dockResources = ruleState.institutions.find((institution) => institution.id === "inst-dock-union")?.resources || 50;
  const informantLedger = ruleState.resourceLedger.informant_trust;
  const informantPressure = informantLedger ? 100 - informantLedger.available + informantLedger.pressure : 0;
  const recentStrategies = new Set((ruleState.institutionDecisions || []).slice(0, 8).map((decision) => decision.strategy));
  const weakEvidenceCount = (ruleState.evidenceChain.items || []).filter((item) => item.provenance === "weak" || item.integrity <= 35).length;
  lifecycle.casePressureByInstitutionId = {
    "inst-police": policePressure,
    "inst-media": mediaPressure,
    "inst-family": familyPressure,
    "inst-commerce": 100 - commerceResources,
    "inst-medical": 100 - medicalResources,
    "inst-court": Math.max(courtPressure, 100 - courtResources),
    "inst-dock-union": Math.max(dockPressure, 100 - dockResources)
  };
  lifecycle.nextCaseWeights = {
    suppressOrMisjudge: policePressure >= 60 ? 1.35 : 1,
    rumorAndFear: mediaPressure >= 60 ? 1.45 : 1,
    briberyOrScapegoat: familyPressure >= 60 ? 1.4 : 1,
    ledgerMotive: commerceResources <= 45 ? 1.35 : 1,
    autopsyDelay: medicalResources <= 45 ? 1.3 : 1,
    courtDocketPressure: courtPressure >= 58 || courtResources <= 45 ? 1.45 : 1,
    dockCargoPressure: dockPressure >= 58 || dockResources <= 45 ? 1.45 : 1,
    informantNetwork: informantPressure >= 45 ? 1.35 : 1,
    evidencePollution: ruleState.evidenceContamination.contamination >= 55 || weakEvidenceCount >= 2 ? 1.35 : 1,
    headlineChase: recentStrategies.has("chase-headline") ? 1.25 : 1,
    policeInvestigation: recentStrategies.has("allocate-investigation") ? 0.9 : 1,
    courtReview: recentStrategies.has("review-court-record") ? 1.3 : 1,
    cargoTrace: recentStrategies.has("trace-cargo") ? 1.3 : 1,
    informantCultivation: recentStrategies.has("cultivate-informant") ? 1.2 : 1,
    murder: 1 + (ruleState.evidenceChain.items.some((item) => item.kind === "physical" || item.kind === "blood-pattern" || item.kind === "weapon-mark") ? 0.1 : 0),
    "missing-person": 1 + (ruleState.publicOpinion.witnessFear >= 55 ? 0.2 : 0),
    "ledger-fraud": commerceResources <= 45 ? 1.45 : 1,
    "false-testimony": ruleState.publicOpinion.witnessFear >= 55 ? 1.45 : 1,
    "medical-coverup": medicalResources <= 45 ? 1.4 : 1,
    "family-scandal": familyPressure >= 60 ? 1.45 : 1,
    "merchant-extortion": commerceResources <= 45 ? 1.35 : 1,
    "police-misjudgment": policePressure >= 65 ? 1.4 : 1,
    "media-rumor": mediaPressure >= 60 ? 1.5 : 1,
    "evidence-tampering": ruleState.evidenceContamination.contamination >= 55 || weakEvidenceCount >= 2 ? 1.5 : 1,
    "dock-smuggling": dockPressure >= 58 || dockResources <= 45 || ruleState.evidenceChain.items.some((item) => item.kind === "cargo-log") ? 1.6 : 1,
    "forged-will": familyPressure >= 58 || courtPressure >= 58 || ruleState.evidenceChain.items.some((item) => item.kind === "family-letter") ? 1.5 : 1,
    "court-intimidation": courtPressure >= 58 || ruleState.evidenceChain.items.some((item) => item.kind === "court-record") ? 1.55 : 1,
    "blackmail": mediaPressure >= 58 || ruleState.evidenceChain.items.some((item) => item.kind === "telegram" || item.kind === "newspaper-proof") ? 1.45 : 1,
    "witness-disappearance": ruleState.publicOpinion.witnessFear >= 55 || informantPressure >= 45 || ruleState.evidenceChain.items.some((item) => item.kind === "anonymous-tip") ? 1.5 : 1,
    "archive-vanishing": courtPressure >= 55 || ruleState.evidenceChain.items.some((item) => item.kind === "court-record" || item.kind === "document") ? 1.45 : 1,
    "clinic-inventory-gap": medicalResources <= 48 || ruleState.evidenceChain.items.some((item) => item.kind === "medical" || item.kind === "ledger") ? 1.4 : 1,
    "dock-witness-swap": dockPressure >= 55 || informantPressure >= 42 || ruleState.evidenceChain.items.some((item) => item.kind === "anonymous-tip" || item.kind === "footprint") ? 1.45 : 1,
    "editorial-coercion": mediaPressure >= 55 || ruleState.evidenceChain.items.some((item) => item.kind === "newspaper-proof" || item.kind === "testimony") ? 1.45 : 1,
    "household-escrow": familyPressure >= 55 || commerceResources <= 48 || ruleState.evidenceChain.items.some((item) => item.kind === "family-letter" || item.kind === "receipt") ? 1.4 : 1,
    "permit-forgery": courtPressure >= 52 || commerceResources <= 48 || ruleState.evidenceChain.items.some((item) => item.kind === "court-record" || item.kind === "document") ? 1.4 : 1
  };
  const influenceTrace = buildCaseInfluenceTrace(runtime, input.culpritId || "", input.victimId || "", evidenceItems);
  const timelineEntry: CampaignCaseTimelineEntry = {
    caseId: input.caseId,
    tick: runtime.tick,
    caseType,
    culpritId: input.culpritId,
    victimId: input.victimId,
    locationId: input.locationId,
    outcome: aftermath.outcome,
    influence: [
      ...influenceTrace.institutionIds.slice(0, 3),
      ...influenceTrace.aftermathIds.slice(0, 3),
      ...influenceTrace.evidenceChainItemIds.slice(0, 3)
    ]
  };
  lifecycle.caseTimeline = [timelineEntry, ...(lifecycle.caseTimeline || [])].slice(0, 120);
  lifecycle.caseAftermathLog = [{
    id: aftermath.id,
    caseId: input.caseId,
    outcome: aftermath.outcome,
    tick: runtime.tick,
    influence: [
      `police pressure ${policePressure}`,
      `media pressure ${mediaPressure}`,
      `evidence contamination ${ruleState.evidenceContamination.contamination}`
    ]
  }, ...lifecycle.caseAftermathLog].slice(0, 40);
  invalidateTownCandidateCache(runtime);
  runtime.longChainComputedAtTick = undefined;
  runtime.updatedAt = new Date().toISOString();
  return { lifecycle, influenceTrace };
}

export function resolveCaseInWorld(world: WorldState, runtime: PersistentTownRuntime, input: CaseResolutionInput): CaseResolutionResult {
  return applyCaseResolutionToWorld(world, runtime, input);
}

function buildCaseCandidatesFromRuntimeIndexed(
  world: WorldState,
  events: WorldEvent[],
  runtime: PersistentTownRuntime | null | undefined,
  index?: TownTickIndex
): CaseCandidate[] {
  const activeRuntime = runtime || getRuntime(world as RuntimeWorld) || createPersistentTownRuntime(world, events);
  const lifecycle = ensureCaseLifecycle(activeRuntime);
  const pressures = index?.socialPressures || computeSocialPressures(world, events);
  const sortedPressures = pressures
    .filter((pressure) =>
      pressure.score >= 5 &&
      ((activeRuntime.campaignCaseTarget || 3) < 30 || ((lifecycle.casePairCooldown?.[`${pressure.npcId}->${pressure.targetId}`] || 0) <= activeRuntime.tick))
    )
    .slice(0, 16);
  const candidates = sortedPressures.map((pressure, candidateIndex): CaseCandidate => {
    const riskChainEvents = selectRiskChainEvents(events, pressure, index);
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
    const memorySource = index
      ? riskChainEventIds.flatMap((eventId) => index.memoryByEventId.get(eventId) || [])
      : (world.memories || []).filter((memory) => riskChainEventIds.includes(memory.eventId));
    const memoryIds = memorySource
      .filter((memory) => [pressure.npcId, pressure.targetId].includes(memory.npcId))
      .map((memory) => memory.id);
    const observationSupport = observationSupportSummary(activeRuntime, riskChainEventIds, [pressure.npcId, pressure.targetId]);
    const goalIds = activeRuntime.agentStates
      .filter((state) => [pressure.npcId, pressure.targetId].includes(state.npcId))
      .map((state) => `goal:${state.npcId}:${state.currentGoal.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
    const relatedEvidence = (activeRuntime.ruleState?.evidenceChain.items || []).filter((item) =>
      item.sourceEventIds.some((eventId) => riskChainEventIds.includes(eventId)) ||
      riskChainEvents.some((event) => event.locationId === item.locationId)
    ).slice(0, 8);
    const baseCaseType = inferCaseTypeFromSignals({ events: riskChainEvents, evidenceItems: relatedEvidence, ruleState: activeRuntime.ruleState, culpritId: pressure.npcId, victimId: pressure.targetId });
    const caseType = chooseCampaignCaseType(baseCaseType, lifecycle, activeRuntime, candidateIndex);
    const locationId = riskChainEvents[0]?.locationId;
    const caseTypeCooldownPenalty = ((lifecycle.caseTypeCooldown || {})[caseType] || 0) > activeRuntime.tick ? 1.5 : 0;
    const locationCooldownPenalty = locationId && (lifecycle.locationCooldown || {})[locationId] > activeRuntime.tick ? 1.25 : 0;
    const caseTypeWeight = lifecycle.nextCaseWeights[caseType] || 1;
    const lifecycleWeight = Math.max(
      lifecycle.nextCaseWeights.rumorAndFear || 1,
      lifecycle.nextCaseWeights.briberyOrScapegoat || 1,
      lifecycle.nextCaseWeights.ledgerMotive || 1,
      lifecycle.nextCaseWeights.evidencePollution || 1,
      lifecycle.nextCaseWeights.courtDocketPressure || 1,
      lifecycle.nextCaseWeights.dockCargoPressure || 1,
      lifecycle.nextCaseWeights.informantNetwork || 1,
      caseTypeWeight
    );
    const npcCooldownPenalty = [pressure.npcId, pressure.targetId].some((npcId) => (lifecycle.caseCooldownByNpcId[npcId] || 0) > activeRuntime.tick)
      ? (activeRuntime.campaignCaseTarget || 3) >= 30 ? 40 : 2
      : 0;
    const cooldownPenalty = npcCooldownPenalty + caseTypeCooldownPenalty + locationCooldownPenalty;
    const pressureScore = Math.max(0, Math.round(pressure.score * lifecycleWeight - cooldownPenalty));
    const influenceTrace = buildCaseInfluenceTrace(activeRuntime, pressure.npcId, pressure.targetId, relatedEvidence);
    const candidate: CaseCandidate = {
      id: `candidate-${world.seed.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}-${activeRuntime.tick}-${candidateIndex}`,
      worldId: world.id,
      tick: activeRuntime.tick,
      status: "forming",
      culpritId: pressure.npcId,
      victimId: pressure.targetId,
      pressureScore,
      riskChainEventIds,
      memoryIds,
      goalIds,
      chainStageTags,
      maturityScore: ledgerEntry?.maturityScore,
      triggeredEventId: triggeredCase?.eventId || ledgerEntry?.triggeredEventId,
      caseType,
      chainCompleteness,
      influenceTrace,
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
    candidate.validation = validateCaseCandidateIndexed(world, events, candidate, index);
    candidate.status = candidate.validation.valid ? "valid" : "invalid";
    candidate.motiveGap = candidate.validation.failureReasons?.find((reason) => reason.includes("motive"));
    candidate.meansGap = candidate.validation.failureReasons?.find((reason) => reason.includes("means"));
    candidate.exclusionGap = candidate.validation.failureReasons?.find((reason) => reason.includes("exclusion"));
    candidate.timelineGap = candidate.validation.failureReasons?.find((reason) => reason.includes("timeline"));
    return candidate;
  });
  // Arc convergence may only bind to a candidate that has already survived the
  // ordinary fairness checks. Re-run the unchanged validator after replacing
  // that candidate's family so an invalid leading pressure pair cannot hide the
  // finale and the finale never bypasses route integrity.
  const convergenceCarrier = activeRuntime.arcConvergence?.status === "ready"
    ? candidates.find((candidate) => candidate.validation.valid)
    : undefined;
  if (convergenceCarrier) {
    convergenceCarrier.caseType = selectArcConvergenceCaseType(activeRuntime, convergenceCarrier.caseType || "murder", 0);
    convergenceCarrier.validation = validateCaseCandidateIndexed(world, events, convergenceCarrier, index);
    convergenceCarrier.status = convergenceCarrier.validation.valid ? "valid" : "invalid";
    convergenceCarrier.motiveGap = convergenceCarrier.validation.failureReasons?.find((reason) => reason.includes("motive"));
    convergenceCarrier.meansGap = convergenceCarrier.validation.failureReasons?.find((reason) => reason.includes("means"));
    convergenceCarrier.exclusionGap = convergenceCarrier.validation.failureReasons?.find((reason) => reason.includes("exclusion"));
    convergenceCarrier.timelineGap = convergenceCarrier.validation.failureReasons?.find((reason) => reason.includes("timeline"));
  }

  const rankedCandidates = [...candidates].sort((left, right) => {
    const chainScore = (candidate: CaseCandidate) => {
      const completeStages = Object.values(candidate.validation.chainCompleteness || candidate.chainCompleteness || {}).filter(Boolean).length;
      const evidenceCount = candidate.validation.evidenceChain?.relatedEvidenceIds.length || 0;
      const warningPenalty = (candidate.validation.evidenceChain?.warningReasons.length || 0) + candidate.validation.warnings.length;
      const typeCooldownPenalty = ((lifecycle.caseTypeCooldown || {})[candidate.caseType || "murder"] || 0) > activeRuntime.tick ? 4 : 0;
      const pairCooldownPenalty = ((lifecycle.casePairCooldown || {})[`${candidate.culpritId}->${candidate.victimId}`] || 0) > activeRuntime.tick ? 8 : 0;
      const locationPenalty = candidate.riskChainEventIds.some((eventId) => {
        const event = index?.eventById.get(eventId) || events.find((item) => item.id === eventId);
        return event && ((lifecycle.locationCooldown || {})[event.locationId] || 0) > activeRuntime.tick;
      }) ? 3 : 0;
      const influenceBonus = deriveCandidateInfluenceBudget(activeRuntime, candidate.caseType);
      const convergenceBonus = deriveArcConvergenceCandidateBonus(activeRuntime, candidate.caseType);
      const campaignBonus = deriveDetectiveCampaignCaseTypeBonus(activeRuntime, candidate.caseType);
      return (candidate.validation.valid ? 100 : 0) +
        (candidate.triggeredEventId ? 18 : 0) +
        completeStages * 8 +
        Math.min(24, evidenceCount * 4) +
        Math.min(18, candidate.validation.observationSupport?.supportScore || 0) / 3 +
        Math.min(18, candidate.validation.memoryConfidence?.supportScore || 0) / 3 +
        (candidate.maturityScore || 0) +
        candidate.pressureScore -
        warningPenalty * 2 -
        typeCooldownPenalty -
        pairCooldownPenalty -
        locationPenalty +
        influenceBonus +
        convergenceBonus +
        campaignBonus;
    };
    return chainScore(right) - chainScore(left) || right.pressureScore - left.pressureScore || left.id.localeCompare(right.id);
  });
  return rankedCandidates.length ? rankedCandidates : activeRuntime.candidates;
}

export function buildCaseCandidatesFromRuntime(world: WorldState, events: WorldEvent[] = [], runtime?: PersistentTownRuntime | null): CaseCandidate[] {
  return buildCaseCandidatesFromRuntimeIndexed(world, events, runtime);
}

function validateCaseCandidateIndexed(
  world: WorldState,
  events: WorldEvent[],
  candidate: CaseCandidate,
  index?: TownTickIndex
): CaseCandidateValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const runtime = getRuntime(world as RuntimeWorld);
  const culprit = world.npcs.find((npc) => npc.id === candidate.culpritId);
  const victim = world.npcs.find((npc) => npc.id === candidate.victimId);
  const sourceEvents = index
    ? candidate.riskChainEventIds.map((eventId) => index.eventById.get(eventId)).filter((event): event is WorldEvent => Boolean(event))
    : events.filter((event) => candidate.riskChainEventIds.includes(event.id));
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
  const ruleState = runtime ? ensureTownRuleRuntimeState(world, runtime) : undefined;
  const contamination = ruleState?.evidenceContamination.contamination || 0;
  const evidenceIntegrity = 100 - contamination;
  const candidateLocationContamination = sourceEvents.reduce(
    (max, event) => Math.max(max, ruleState?.evidenceContamination.riskByLocation[event.locationId] || 0),
    0
  );
  const evidenceChainItems = index
    ? Array.from(new Map([
        ...candidate.riskChainEventIds.flatMap((eventId) => index.evidenceByEventId.get(eventId) || []),
        ...sourceEvents.flatMap((event) => index.evidenceByLocationId.get(event.locationId) || [])
      ].map((item) => [item.id, item])).values())
    : ruleState?.evidenceChain.items.filter((item) =>
        item.sourceEventIds.some((eventId) => candidate.riskChainEventIds.includes(eventId)) ||
        sourceEvents.some((event) => item.locationId === event.locationId)
      ) || [];
  const evidenceRules = ruleState?.evidenceRules || [];
  const evidenceRuleFor = (item: EvidenceChainItem) => evidenceRules.find((rule) => rule.kind === item.kind);
  const strongEvidenceChain = evidenceChainItems.some((item) => item.provenance === "strong" && item.integrity >= (evidenceRuleFor(item)?.strongProvenanceIntegrityFloor ?? 55));
  const weakEvidenceChain = evidenceChainItems.length > 0 && evidenceChainItems.every((item) =>
    item.provenance === "weak" ||
    item.integrity <= 30 ||
    item.contamination >= (evidenceRuleFor(item)?.weakContaminationThreshold ?? 72)
  );
  const contaminatedEvidenceIds = evidenceChainItems
    .filter((item) => item.contamination >= (evidenceRuleFor(item)?.weakContaminationThreshold ?? 72) || (item.tamperHistory || []).length)
    .map((item) => item.id);
  const evidenceChainSummary: EvidenceChainValidationSummary = {
    relatedEvidenceIds: evidenceChainItems.map((item) => item.id).slice(0, 12),
    contaminatedEvidenceIds: contaminatedEvidenceIds.slice(0, 12),
    strongProvenanceIds: evidenceChainItems.filter((item) => item.provenance === "strong").map((item) => item.id).slice(0, 12),
    weakProvenanceIds: evidenceChainItems.filter((item) => item.provenance === "weak").map((item) => item.id).slice(0, 12),
    warningReasons: [],
    minimumEvidenceCountMet: evidenceChainItems.length >= 3
  };
  const lifecycle = runtime ? ensureCaseLifecycle(runtime) : undefined;
  const institutionPressure = Math.max(0, ...Object.values(lifecycle?.casePressureByInstitutionId || {}));
  const hasStrongProvenance = (observationSupport.supportScore >= 75 && confidence.supportScore >= 75 && Boolean(candidate.triggeredEventId)) || strongEvidenceChain;
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
  if (!evidenceChainSummary.minimumEvidenceCountMet) errors.push("evidence chain insufficient: fewer than three related evidence items");
  if ((contamination >= 82 || candidateLocationContamination >= 82 || evidenceIntegrity <= 18 || weakEvidenceChain) && !hasStrongProvenance) errors.push("evidence contamination too high: source chain is no longer fair-play reliable");
  if (candidate.riskChainEventIds.length < 2) warnings.push("timeline is shallow: fewer than two risk-chain events");
  if (!hasExclusionSeed) warnings.push("non-culprit exclusion seed missing: no alibi or exclusion-stage event yet");
  if (contamination >= 55 || candidateLocationContamination >= 55) warnings.push("evidence contamination is high: evidence chain needs explicit provenance");
  if (institutionPressure >= 70) warnings.push("institution pressure is high: next-case weighting may bias witness behavior and evidence reliability");
  if (evidenceIntegrity <= 45 && hasStrongProvenance) warnings.push("evidence integrity is low but provenance is strong enough to remain reviewable");
  if (strongEvidenceChain) warnings.push("evidence chain provenance is strong enough to preserve fair-play reviewability");
  if (contaminatedEvidenceIds.length && strongEvidenceChain) warnings.push("contaminated evidence remains playable because provenance is strong");
  evidenceChainSummary.warningReasons = warnings.filter((warning) => warning.includes("evidence") || warning.includes("provenance") || warning.includes("contaminated"));
  const failureReasons = [
    !hasMotive ? "missing motive stage: pressure chain is too weak" : "",
    !hasMeans ? "missing means stage: no resource or means-access event" : "",
    !hasOpportunity ? "missing opportunity stage: no reachable opportunity event" : "",
    !hasCoverUp ? "missing cover-up stage: no staging or cover-up event" : "",
    !memoryScopedTestimony ? "missing memory support: candidate has no scoped testimony memory" : "",
    !hasTriggeredCase ? "missing real case trigger: no death or crime event has been written yet" : "",
    !evidenceChainSummary.minimumEvidenceCountMet ? "missing evidence chain depth: fewer than three related evidence items" : "",
    (contamination >= 82 || candidateLocationContamination >= 82 || evidenceIntegrity <= 18 || weakEvidenceChain) && !hasStrongProvenance ? "evidence contamination too high: source chain is no longer fair-play reliable" : "",
    candidate.riskChainEventIds.length < 2 ? "missing timeline depth: fewer than two risk-chain events" : "",
    !hasExclusionSeed ? "missing non-culprit exclusion seed: no alibi or exclusion event" : ""
  ].filter(Boolean);
  const valid = errors.length === 0 && hasMotive && hasMeans && hasOpportunity && hasCoverUp && memoryScopedTestimony && hasExclusionSeed && hasTriggeredCase && evidenceChainSummary.minimumEvidenceCountMet;
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
    evidenceChain: evidenceChainSummary,
    failureReasons,
    errors,
    warnings
  };
}

export function validateCaseCandidate(world: WorldState, events: WorldEvent[] = [], candidate: CaseCandidate): CaseCandidateValidation {
  return validateCaseCandidateIndexed(world, events, candidate);
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

export type CaseResolutionMode = "preview" | "resolve";

export function extractPlayableCaseFromCandidate(
  world: WorldState,
  events: WorldEvent[] = [],
  candidate: CaseCandidate,
  options: { resolutionMode?: CaseResolutionMode } = {}
): { world: WorldState; events: WorldEvent[]; activeCase: CaseFromLog; candidate: CaseCandidate } {
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
  const runtime = (caseWorld as RuntimeWorld).persistentRuntime || (world as RuntimeWorld).persistentRuntime;
  const authoredCampaignCase = runtime ? authoredCampaignCaseForRuntime(runtime) : null;
  if (authoredCampaignCase) applyAuthoredCampaignCaseTreatment(activeCase, authoredCampaignCase);
  const validation = validateWorldCase(caseWorld, allEvents, activeCase.deductionCase);
  activeCase.validation = validation;
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
  if (runtime?.worldLeadOutcome && runtime.worldLeadOutcome.caseId !== activeCase.id) {
    settleWorldLeadOutcome(caseWorld, runtime, runtime.worldLeadOutcome.caseId);
  }
  if (runtime && options.resolutionMode === "resolve") {
    const resolution = resolveCaseInWorld(caseWorld, runtime, {
      caseId: activeCase.id,
      outcome: validation.valid ? "extracted" : "failed",
      culpritId: candidate.culpritId,
      victimId: candidate.victimId,
      caseType: candidate.caseType,
      locationId: events.find((event) => event.id === candidate.triggeredEventId)?.locationId,
      evidenceItemIds: candidate.validation.evidenceChain?.relatedEvidenceIds,
      valid: validation.valid
    });
    nextCandidate.influenceTrace = resolution.influenceTrace;
    runtime.updatedAt = new Date().toISOString();
  } else if (runtime) {
    nextCandidate.influenceTrace = buildCaseInfluenceTrace(runtime, candidate.culpritId, candidate.victimId);
  }
  return { world: { ...tick.world, activeCaseId: activeCase.id }, events: allEvents, activeCase, candidate: nextCandidate };
}

export function buildAgentDecisionTrace(runtime: PersistentTownRuntime, decisionId: string) {
  return runtime.decisionTraces.find((trace) => trace.id === decisionId) || null;
}

export function buildTownEmergenceQueue(world: WorldState, events: WorldEvent[] = [], runtime?: PersistentTownRuntime | null): TownEmergenceQueue {
  const activeRuntime = runtime || getRuntime(world as RuntimeWorld) || createPersistentTownRuntime(world, events);
  const reusable = reusableTownCandidates(activeRuntime);
  const candidates = reusable || buildCaseCandidatesFromRuntime(world, events, activeRuntime);
  if (!reusable) {
    storeTownCandidates(activeRuntime, candidates);
    if (activeRuntime.performance) activeRuntime.performance.counters.candidateRebuildCount += 1;
  }
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
    worldArcDirective: toWorldArcDirectivePublicSummary(activeRuntime),
    worldPressureCascade: toWorldPressureCascadePublicSummary(activeRuntime),
    playerResourceCommitment: activeRuntime.playerResourceCommitmentSummary || toPlayerResourceCommitmentPublicSummary(activeRuntime),
    factionRelationship: activeRuntime.factionRelationshipSummary || toFactionRelationshipPublicSummary(activeRuntime),
    worldEventOffer: activeRuntime.worldEventOfferSummary || toWorldEventOfferPublicSummary(activeRuntime),
    investigatorProgression: activeRuntime.investigatorProgressionSummary || toInvestigatorProgressionPublicSummary(activeRuntime),
    investigatorHeadquarters: activeRuntime.investigatorHeadquartersSummary || toInvestigatorHeadquartersPublicSummary(activeRuntime),
    campaignRecovery: activeRuntime.campaignRecoverySummary || toCampaignRecoveryPublicSummary(activeRuntime),
    arcConvergence: activeRuntime.arcConvergenceSummary || toArcConvergencePublicSummary(activeRuntime),
    campaignSession: activeRuntime.campaignSessionSummary || toCampaignSessionPublicSummary(activeRuntime),
    campaignFinaleDebrief: activeRuntime.campaignFinaleDebrief || toCampaignFinaleDebriefPublicSummary(activeRuntime),
    townSocialResponse: activeRuntime.townSocialResponseSummary || toTownSocialResponsePublicSummary(world, activeRuntime),
    worldInfluenceBudget: toWorldInfluenceBudgetPublicSummary(activeRuntime),
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
  return cloneTownSnapshotRuntime(runtime);
}

function snapshotWorld(world: WorldState) {
  return cloneTownSnapshotWorld(world);
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
  options: { label?: string; scenarioId?: string; branchId?: string; id?: string; mode?: TownSnapshotMode } = {}
): TownStateSnapshot {
  const runtimeWorld = world as RuntimeWorld;
  const runtime = runtimeWorld.persistentRuntime || createPersistentTownRuntime(world, events);
  const createdAt = new Date().toISOString();
  const suffix = options.branchId || "main";
  const mode = options.mode || "checkpoint";
  const eventSource = mode === "summary" ? events.slice(-200) : events;
  const memorySource = mode === "summary" ? (world.memories || []).slice(-200) : (world.memories || []);
  const observationSource = mode === "summary" ? (runtime.eventObservations || []).slice(-200) : (runtime.eventObservations || []);
  const snapshot: TownStateSnapshot = {
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
    eventIds: eventSource.map((event) => event.id),
    memoryIds: memorySource.map((memory) => memory.id),
    observationIds: observationSource.map((observation) => observation.id),
    interventionIds: runtime.interventions.map((intervention) => intervention.id),
    ruleSummary: buildTownRuleSnapshotSummary(ensureTownRuleRuntimeState(world, runtime)),
    mode,
    rollbackEligible: mode === "checkpoint",
    createdAt,
  };
  if (mode === "checkpoint") {
    snapshot.checkpoint = {
      world: snapshotWorld(world),
      runtime: snapshotRuntime(runtime)
    };
  }
  return snapshot;
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
    branchOnlyInterventionIds: uniqueAdded(to.interventionIds, from.interventionIds),
    ruleChanges: diffTownRuleSnapshots(from.ruleSummary, to.ruleSummary)
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
    scenarioPresets: currentRuntime?.scenarioPresets || (snapshot.checkpoint.runtime as PersistentTownRuntime).scenarioPresets || [],
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

function inheritScenarioRuntimeContext(source: PersistentTownRuntime | null, target: PersistentTownRuntime) {
  if (!source) return target;
  target.scenarioPresets = source.scenarioPresets;
  target.scenarioPacks = source.scenarioPacks;
  target.mapPacks = source.mapPacks;
  target.packRegistry = source.packRegistry;
  target.currentScenarioPackId = source.currentScenarioPackId;
  target.currentMapPackId = source.currentMapPackId;
  target.currentRuleCatalogId = source.currentRuleCatalogId;
  target.currentExperiment = source.currentExperiment;
  target.scenarioRuns = source.scenarioRuns;
  target.runJobs = source.runJobs;
  target.benchmarkRuns = source.benchmarkRuns;
  target.ruleState = source.ruleState;
  return target;
}

function prepareScenarioStart(world: WorldState, events: WorldEvent[], config: ScenarioConfig) {
  let nextWorld = cloneWorld(world);
  const sourceRuntime = getRuntime(nextWorld);
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
  nextWorld.persistentRuntime = inheritScenarioRuntimeContext(
    sourceRuntime,
    createPersistentTownRuntime(nextWorld, nextEvents)
  );
  return { world: nextWorld, events: nextEvents };
}

function runScenarioBranch(
  startWorld: RuntimeWorld,
  startEvents: WorldEvent[],
  scenarioId: string,
  branch: ScenarioBranchConfig
) {
  let branchWorld = cloneWorld(startWorld);
  branchWorld.persistentRuntime = inheritScenarioRuntimeContext(
    getRuntime(branchWorld),
    createPersistentTownRuntime(branchWorld, startEvents)
  );
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

function createTownTickContext(
  world: RuntimeWorld,
  baseEvents: WorldEvent[],
  runtime: PersistentTownRuntime,
  createdEvents: WorldEvent[],
  executionPolicy: TownExecutionPolicy
): TownTickContext {
  runtime.simulationPhases = [...TOWN_TICK_PHASES];
  runtime.pressureLedger ||= [];
  runtime.eventObservations ||= [];
  runtime.memoryPropagations ||= [];
  runtime.consequences ||= [];
  ensureTownRuleRuntimeState(world, runtime);
  const allEvents = [...baseEvents, ...createdEvents];
  const indexEvents = executionPolicy.indexEventLimit ? allEvents.slice(-executionPolicy.indexEventLimit) : allEvents;
  const index = createTownTickIndex(world, indexEvents, runtime);
  if (runtime.performance) runtime.performance.counters.socialPressureRebuildCount += 1;
  return {
    world,
    baseEvents,
    runtime,
    allEvents,
    createdEvents,
    createdMemories: [],
    createdObservations: [],
    createdConsequences: [],
    actionPlans: [],
    decisionIds: [],
    phases: [...TOWN_TICK_PHASES],
    index,
    executionPolicy
  };
}

function tickEventWindow(ctx: TownTickContext) {
  return ctx.executionPolicy.indexEventLimit ? ctx.allEvents.slice(-ctx.executionPolicy.indexEventLimit) : ctx.allEvents;
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
  for (const pressure of ctx.index.socialPressures.filter((item) => item.score >= 3).slice(0, 6)) {
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

function phasePropagateExistingMemory(ctx: TownTickContext) {
  ctx.runtime.memoryPropagations ||= [];
}

function phaseUpdateGoals(ctx: TownTickContext) {
  ensureSocialProfiles(ctx.world, ctx.runtime);
  const events = tickEventWindow(ctx);
  ctx.runtime.agentStates = ctx.world.npcs
    .map((npc) => deriveNpcAgentStateIndexed(ctx.world, npc, events, ctx.runtime, ctx.index));
  ctx.index.agentStateByNpcId = new Map(ctx.runtime.agentStates.map((state) => [state.npcId, state]));
}

function selectTickActors(ctx: TownTickContext) {
  const living = ctx.world.npcs.filter((npc) => npc.alive);
  const random = makeRandom(`${ctx.world.seed}:persistent:${ctx.runtime.tick}`);
  const actorCount = Math.min(3, living.length);
  const events = tickEventWindow(ctx);
  const recentActorCounts = new Map<string, number>();
  for (const trace of ctx.runtime.decisionTraces.slice(-12)) {
    recentActorCounts.set(trace.npcId, (recentActorCounts.get(trace.npcId) || 0) + 1);
  }
  return [...living].sort((a, b) => {
    const aState = ctx.index.agentStateByNpcId.get(a.id) || deriveNpcAgentStateIndexed(ctx.world, a, events, ctx.runtime, ctx.index);
    const bState = ctx.index.agentStateByNpcId.get(b.id) || deriveNpcAgentStateIndexed(ctx.world, b, events, ctx.runtime, ctx.index);
    const actorScore = (npc: NPCProfile, state: NpcAgentState) => {
      const recentPenalty = (recentActorCounts.get(npc.id) || 0) * 1.8;
      const unresolvedPressure = (ctx.index.pressureByNpcId.get(npc.id)?.[0]?.score || 0) / 2;
      const chainNeed = chainStageNeedForActor(ctx.runtime, npc.id) * 1.35;
      const rhythm = ((ctx.runtime.tick + npc.id.length + state.currentPlan.length) % 7) / 10;
      return state.goalPriority + unresolvedPressure + chainNeed + rhythm - recentPenalty + random() / 4;
    };
    return actorScore(b, bState) - actorScore(a, aState);
  }).slice(0, actorCount);
}

function recentSelectedActionKinds(runtime: PersistentTownRuntime, window = 12) {
  return runtime.decisionTraces.slice(-window)
    .map((trace) => trace.candidates.find((candidate) => candidate.id === trace.selectedCandidateId)?.kind)
    .filter((kind): kind is NpcActionKind => Boolean(kind));
}

function chainStageNeedForActor(runtime: PersistentTownRuntime, npcId: string) {
  const related = (runtime.longChainLedger || [])
    .filter((entry) => entry.culpritId === npcId || entry.victimId === npcId)
    .sort((left, right) => right.maturityScore - left.maturityScore)
    .slice(0, 3);
  if (!related.length) return 0;
  const missing = related.reduce((sum, entry) => sum + (Object.keys(emptyChainCompleteness()) as CaseChainStage[])
    .filter((stage) => stage === "memory"
      ? (entry.memoryConfidence?.supportScore || 0) < 55
      : entry.stageEventIds[stage].length === 0)
    .length, 0);
  return Math.min(5, missing);
}

function actionStageNeed(runtime: PersistentTownRuntime, kind: NpcActionKind) {
  const stage = chainStageForAction(kind);
  if (!stage) return 0;
  const ledger = (runtime.longChainLedger || [])
    .filter((entry) => !entry.complete)
    .sort((left, right) => right.maturityScore - left.maturityScore)
    .slice(0, 5);
  if (!ledger.length) return 0;
  const caseStage: CaseChainStage | null =
    stage === "alibi" ? "exclusion" :
    stage === "motive" || stage === "means" || stage === "opportunity" || stage === "cover-up" || stage === "memory" ? stage :
    null;
  if (!caseStage) return 0;
  return ledger.reduce((sum, entry) => {
    const complete = caseStage === "memory"
      ? (entry.memoryConfidence?.supportScore || 0) >= 55
      : entry.stageEventIds[caseStage].length > 0;
    return sum + (complete ? 0 : 1);
  }, 0);
}

function rulePressureActionNeed(runtime: PersistentTownRuntime, kind: NpcActionKind) {
  const ruleState = runtime.ruleState;
  if (!ruleState) return 0;
  const institutionNeed =
    kind === "investigate" || kind === "seek-alibi"
      ? Math.ceil(((ruleState.institutions.find((item) => item.kind === "police")?.pressure || 0) + ruleState.evidenceContamination.contamination) / 38)
      : kind === "spread-rumor"
        ? Math.ceil((ruleState.publicOpinion.mediaPressure + ruleState.publicOpinion.rumorVelocity) / 42)
        : kind === "obtain-resource"
          ? Math.ceil(Math.max(0, 55 - Math.min(...ruleState.institutions.map((item) => item.resources))) / 10)
          : kind === "cover-up" || kind === "hide-trace"
            ? Math.ceil((ruleState.evidenceContamination.contamination + ruleState.publicOpinion.witnessFear) / 44)
            : kind === "pressure" || kind === "confront"
              ? Math.ceil((ruleState.publicOpinion.heat + ruleState.publicOpinion.witnessFear) / 48)
              : 0;
  return Math.min(4, Math.max(0, institutionNeed));
}

function selectActionCandidate(runtime: PersistentTownRuntime, npc: NPCProfile, candidates: NpcActionCandidate[], actorIndex: number) {
  const legalCandidates = candidates.filter((candidate) => candidate.legal).sort((a, b) => b.score.total - a.score.total);
  const topCandidate = strongestLegalAction(candidates);
  const biasedCandidate = legalCandidates.find((candidate) => (candidate.score.directorBias || 0) > 0);
  if (biasedCandidate) return biasedCandidate;
  if (!legalCandidates.length) return topCandidate;
  const recentActionCounts = new Map<NpcActionKind, number>();
  for (const kind of recentSelectedActionKinds(runtime)) {
    recentActionCounts.set(kind, (recentActionCounts.get(kind) || 0) + 1);
  }
  const stageTieBreak = (candidate: NpcActionCandidate) => {
    const recentPenalty = (recentActionCounts.get(candidate.kind) || 0) * 2.8;
    const stageNeed = actionStageNeed(runtime, candidate.kind) * 4;
    const ruleNeed = rulePressureActionNeed(runtime, candidate.kind) * 1.5;
    const worldSystemNeed = candidate.score.worldSystemBias || 0;
    const actorRhythm = ((runtime.tick + actorIndex + candidate.kind.length + npc.id.length) % 5) / 10;
    return candidate.score.total + stageNeed + ruleNeed + worldSystemNeed + actorRhythm - recentPenalty;
  };
  const eligibleBand = legalCandidates.filter((candidate) => candidate.score.total >= topCandidate.score.total - 12);
  const selected = [...eligibleBand].sort((left, right) => stageTieBreak(right) - stageTieBreak(left) || right.score.total - left.score.total || left.id.localeCompare(right.id))[0] || topCandidate;
  recordSelectedWorldSystemBias(runtime, selected);
  return selected;
}

function phaseScoreActions(ctx: TownTickContext) {
  const events = tickEventWindow(ctx);
  ctx.actionPlans = selectTickActors(ctx).map((npc, actorIndex) => {
    const candidates = scoreNpcActionCandidatesIndexed(ctx.world, npc, events, ctx.runtime, ctx.index);
    return {
      npc,
      actorIndex,
      candidates,
      selected: selectActionCandidate(ctx.runtime, npc, candidates, actorIndex)
    };
  });
}

function enqueueCompletedCampaignRecoverySocialResponses(world: WorldState, runtime: PersistentTownRuntime) {
  for (const recovery of runtime.campaignRecoveries?.items || []) {
    if (recovery.status !== "completed") continue;
    const deltas = {
      resourceAvailableDelta: recovery.appliedResourceDelta || 0,
      resourcePressureDelta: recovery.appliedPressureDelta || 0,
      relationshipDelta: recovery.appliedStandingDelta || 0,
      opportunityDelta: recovery.appliedOpportunityDelta || 0
    };
    if (!townSocialResponseActualDelta(deltas)) continue;
    const institution = [...(runtime.ruleState?.institutions || [])]
      .filter((item) => item.kind === recovery.factionKind)
      .sort((left, right) => left.id.localeCompare(right.id))[0];
    enqueueTownSocialResponse(world, runtime, {
      sourceKey: recovery.id,
      sourceKind: "campaign-recovery",
      direction: deriveTownSocialResponseDirectionFromDeltas(deltas),
      institutionId: institution?.id,
      institutionKind: recovery.factionKind
    });
  }
}

function enqueueCompletedWorldEventOfferSocialResponses(world: WorldState, runtime: PersistentTownRuntime) {
  const ruleState = ensureTownRuleRuntimeState(world, runtime);
  for (const offer of runtime.worldEventOffers?.items || []) {
    if (offer.status !== "completed" || !offer.longActionId) continue;
    const action = ruleState.longActions.find((item) => item.id === offer.longActionId);
    if (!action || action.status !== "completed") continue;
    enqueueTownSocialResponse(world, runtime, {
      sourceKey: offer.id,
      sourceKind: "world-event-offer",
      direction: deriveTownSocialResponseDirectionFromCompletedAction(ruleState, action),
      institutionId: offer.institutionId,
      institutionKind: offer.response.institutionKind,
      anchorNpcId: offer.actorId,
      locationId: action.targetLocationId
    });
  }
}

function phaseAdvanceLongActions(ctx: TownTickContext) {
  reconcileCampaignRecovery(ctx.runtime);
  advanceTownLongActions(ctx.world, ensureTownRuleRuntimeState(ctx.world, ctx.runtime), ctx.allEvents, ctx.runtime.tick);
  const directiveEvents = reconcileWorldArcDirectiveLongAction(ctx.world, ctx.runtime);
  const offerEvents = reconcileWorldEventOfferLongAction(ctx.world, ctx.runtime);
  enqueueCompletedCampaignRecoverySocialResponses(ctx.world, ctx.runtime);
  enqueueCompletedWorldEventOfferSocialResponses(ctx.world, ctx.runtime);
  advanceTownSocialResponse(ctx.world, ctx.runtime);
  for (const event of [...directiveEvents, ...offerEvents]) {
    ctx.createdEvents.push(event);
    addEventToTownTickIndex(ctx.index, event);
  }
  if (directiveEvents.length || offerEvents.length) ctx.allEvents = [...ctx.baseEvents, ...ctx.createdEvents];
}

function phaseInstitutionStrategy(ctx: TownTickContext) {
  const ruleState = ensureTownRuleRuntimeState(ctx.world, ctx.runtime);
  const directiveStart = startScheduledWorldArcDirective(ctx.world, ctx.allEvents, ctx.runtime);
  const offerStart = startAcceptedWorldEventOffer(ctx.world, [...ctx.allEvents, ...directiveStart.events], ctx.runtime);
  for (const event of [...directiveStart.events, ...offerStart.events]) {
    ctx.createdEvents.push(event);
    addEventToTownTickIndex(ctx.index, event);
  }
  const decisions = advanceTownInstitutionStrategies(ctx.world, ruleState, ctx.runtime.tick, ctx.runtime.worldSystemHints, {
    excludeInstitutionIds: Array.from(new Set([...directiveStart.excludedInstitutionIds, ...offerStart.excludedInstitutionIds]))
  });
  for (const decision of decisions.filter((item) => item.strategy !== "hold-position")) {
    const institution = ruleState.institutions.find((item) => item.id === decision.institutionId);
    const strategyTags =
      decision.strategy === "review-court-record" ? ["court", "record", "testimony"] :
      decision.strategy === "trace-cargo" ? ["dock", "cargo", "receipt"] :
      decision.strategy === "cultivate-informant" ? ["informant", "tip", "witness"] :
      [];
    const event: WorldEvent = {
      id: `institution-event-${decision.id}`,
      worldId: ctx.world.id,
      day: ctx.runtime.currentDay,
      time: ctx.runtime.currentTime,
      type: decision.strategy === "chase-headline" || decision.strategy === "cultivate-informant" ? "witness" :
        decision.strategy === "audit-ledger" || decision.strategy === "trace-cargo" || decision.strategy === "review-court-record" ? "obtain_item" :
        "forensic_clue",
      actorIds: decision.targetNpcId ? [decision.targetNpcId] : [],
      locationId: decision.targetLocationId || ctx.world.locations[0]?.id || "town-square",
      summary: `${institution?.name || decision.institutionId} chooses ${decision.strategy}.`,
      publicSummary: `${institution?.name || "A town institution"} shifts its case posture.`,
      hidden: false,
      relatedCharacterIds: decision.targetNpcId ? [decision.targetNpcId] : [],
      tags: ["institution_strategy", decision.strategy, institution?.kind || "institution", ...strategyTags],
      causedByEventIds: [],
      explanation: decision.reason
    };
    decision.eventId = event.id;
    ctx.createdEvents.push(event);
  }
  ctx.allEvents = [...ctx.baseEvents, ...ctx.createdEvents];
}

function phaseApplyActionEvolution(ctx: TownTickContext, npc: NPCProfile, selected: NpcActionCandidate, event: WorldEvent, agent: NpcAgentState, consequence: AgentConsequenceSummary, memoryIds: string[]) {
  applyConsequenceToAgent(agent, consequence, event, selected, memoryIds);
  evolveRelationship(ctx.world, npc.id, selected);
  updateSocialAfterAction(ctx.world, ctx.runtime, npc.id, selected, event);
  updateLocationAfterAction(ctx.world, ctx.runtime, selected, event);
  agent.socialProfile = deriveNpcAgentStateIndexed(ctx.world, npc, tickEventWindow(ctx), ctx.runtime, ctx.index).socialProfile;
}

function phaseExecuteAgentAction(ctx: TownTickContext, plan: TownTickActionPlan) {
  const { npc, candidates, selected } = plan;
  const traceId = `decision-${ctx.world.id}-${ctx.runtime.tick}-${npc.id}`;
  const intervention = ctx.runtime.interventions.find((item) =>
    item.actorId === npc.id &&
    item.tick === ctx.runtime.tick - 1 &&
    (item.kind !== "action-bias" || item.value === selected.kind)
  );
  const definition = getTownActionDefinition(selected.kind);
  const beforeObservationIds = new Set((ctx.runtime.eventObservations || []).map((observation) => observation.id));
  const event = definition.execute({ world: ctx.world, runtime: ctx.runtime, npc, candidate: selected, intervention, allEvents: tickEventWindow(ctx) });
  ctx.createdEvents.push(event);
  addEventToTownTickIndex(ctx.index, event);
  ctx.allEvents = [...ctx.baseEvents, ...ctx.createdEvents];
  const ruleState = ensureTownRuleRuntimeState(ctx.world, ctx.runtime);
  updateTownRulePressureFromEvent(ruleState, event, ctx.runtime.tick);
  const longAction = maybeStartLongActionFromCandidate(ctx.world, ruleState, npc, selected, ctx.allEvents, ctx.runtime.tick);
  if (longAction) selected.score.reasons.push(`started long action ${longAction.kind}`);
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
    observedEventIds: deriveNpcAgentStateIndexed(ctx.world, npc, tickEventWindow(ctx), ctx.runtime, ctx.index).knownFactIds.slice(-5),
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
  const agent = deriveNpcAgentStateIndexed(ctx.world, npc, tickEventWindow(ctx), ctx.runtime, ctx.index);
  agent.locationId = selected.targetLocationId;
  agent.lastDecisionId = trace.id;
  agent.nextActionPreview = selected.description;
  phaseApplyActionEvolution(ctx, npc, selected, event, agent, consequence, memoryIds);
  ctx.runtime.agentStates = [agent, ...ctx.runtime.agentStates.filter((state) => state.npcId !== npc.id)];
  cacheNpcAgentState(ctx.index, agent);
}

function phaseExecuteActions(ctx: TownTickContext) {
  if (!ctx.actionPlans.length) phaseScoreActions(ctx);
  ctx.actionPlans.forEach((plan) => phaseExecuteAgentAction(ctx, plan));
}

function phaseAdvanceCaseChain(ctx: TownTickContext) {
  const lifecycleCaseCount = (ctx.runtime.caseLifecycle?.solvedCaseIds.length || 0) + (ctx.runtime.caseLifecycle?.failedCaseIds.length || 0);
  const triggeredCaseCount = ctx.runtime.triggeredCases?.length || 0;
  const target = Math.max(3, ctx.runtime.campaignCaseTarget || 3);
  if (Math.max(lifecycleCaseCount, triggeredCaseCount) >= target && ctx.runtime.tick % 20 !== 0 && ctx.runtime.longChainComputedAtTick !== undefined) {
    return;
  }
  const triggered = triggerLongChainCaseIfReady(ctx.world, ctx.runtime, ctx.allEvents, ctx.createdEvents, ctx.index);
  ctx.allEvents = [...ctx.baseEvents, ...ctx.createdEvents];
  if (triggered) {
    ctx.runtime.longChainComputedAtTick = undefined;
    refreshLongChainLedger(ctx.world, ctx.allEvents, ctx.runtime);
  }
}

function phaseExtractCandidates(ctx: TownTickContext) {
  if (
    ctx.executionPolicy.candidateEveryTicks > 1 &&
    ctx.runtime.candidates.length > 0 &&
    ctx.runtime.tick % ctx.executionPolicy.candidateEveryTicks !== 0
  ) {
    return;
  }
  storeTownCandidates(ctx.runtime, buildCaseCandidatesFromRuntimeIndexed(ctx.world, tickEventWindow(ctx), ctx.runtime, ctx.index).slice(0, 16));
  if (ctx.runtime.performance) ctx.runtime.performance.counters.candidateRebuildCount += 1;
}

function phaseValidateCandidates(ctx: TownTickContext) {
  // Candidate construction already performs full validation. Keep the phase as
  // an explicit boundary without scanning the accumulated event history twice.
  ctx.runtime.candidates = ctx.runtime.candidates.slice(0, 16);
}

function finalizeTownTick(ctx: TownTickContext) {
  syncCampaignRecoveryFromRuntime(ctx.runtime);
  refreshArcConvergence(ctx.runtime);
  refreshCampaignSession(ctx.runtime);
  refreshTownSocialResponseSummary(ctx.world, ctx.runtime);
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
  if (ctx.runtime.tick % ctx.executionPolicy.snapshotEveryTicks === 0) {
    const mode: TownSnapshotMode = ctx.runtime.tick % ctx.executionPolicy.checkpointEveryTicks === 0 ? "checkpoint" : "summary";
    const tickSnapshot = createTownStateSnapshot(ctx.world, ctx.allEvents, {
      id: `snapshot-${ctx.world.id}-tick-${ctx.runtime.tick}`,
      label: `Tick ${ctx.runtime.tick}`,
      mode
    });
    ctx.runtime.snapshots = [tickSnapshot, ...(ctx.runtime.snapshots || []).filter((snapshot) => snapshot.id !== tickSnapshot.id)].slice(0, 30);
    if (ctx.runtime.performance) {
      ctx.runtime.performance.counters.snapshotCount += 1;
      if (mode === "checkpoint") ctx.runtime.performance.counters.checkpointCount += 1;
    }
  }
}

function runTownTickPhases(ctx: TownTickContext) {
  const phases: Array<[string, () => void]> = [
    ["clock", () => advanceTownClock(ctx)],
    ["observe", () => phaseObserveTown(ctx)],
    ["memory", () => phasePropagateExistingMemory(ctx)],
    ["goals", () => phaseUpdateGoals(ctx)],
    ["action-scoring", () => phaseScoreActions(ctx)],
    ["long-actions", () => phaseAdvanceLongActions(ctx)],
    ["institutions", () => phaseInstitutionStrategy(ctx)],
    ["action-execution", () => phaseExecuteActions(ctx)],
    ["case-chain", () => phaseAdvanceCaseChain(ctx)],
    ["candidates", () => phaseExtractCandidates(ctx)],
    ["validation", () => phaseValidateCandidates(ctx)],
    ["snapshot", () => finalizeTownTick(ctx)]
  ];
  for (const [name, execute] of phases) {
    if (
      ctx.executionPolicy.actionEveryTicks > 1 &&
      (name === "action-scoring" || name === "action-execution") &&
      ctx.runtime.tick % ctx.executionPolicy.actionEveryTicks !== 0
    ) {
      continue;
    }
    if (!ctx.executionPolicy.profile || !ctx.runtime.performance) {
      execute();
      continue;
    }
    const startedAt = performance.now();
    execute();
    recordTownPhaseTiming(ctx.runtime.performance, name, performance.now() - startedAt);
  }
}

export function advancePersistentTownTick(
  world: WorldState,
  events: WorldEvent[] = [],
  options: {
    steps?: number;
    status?: PersistentTownRuntimeStatus;
    profile?: boolean;
    snapshotEveryTicks?: number;
    checkpointEveryTicks?: number;
    candidateEveryTicks?: number;
    actionEveryTicks?: number;
    indexEventLimit?: number;
  } = {}
) {
  const executionPolicy = normalizeTownExecutionPolicy(options);
  const startedAt = performance.now();
  let nextWorld = cloneTownWorldForAdvance(world);
  let runtime = nextWorld.persistentRuntime || createPersistentTownRuntime(nextWorld, events);
  runtime.status = options.status || runtime.status || "running";
  if (executionPolicy.profile) runtime.performance = createTownPerformanceSummary();
  const initialEventCount = events.length;
  const initialMemoryCount = nextWorld.memories?.length || 0;
  const initialObservationCount = runtime.eventObservations?.length || 0;
  const createdEvents: WorldEvent[] = [];
  const steps = Math.max(1, Math.min(60, options.steps || 1));
  let completedSteps = 0;
  for (let step = 0; step < steps; step += 1) {
    if (runtime.tick >= runtime.maxTicks) {
      runtime.status = "completed";
      break;
    }
    runTownTickPhases(createTownTickContext(nextWorld, events, runtime, createdEvents, executionPolicy));
    completedSteps += 1;
  }
  runtime.updatedAt = new Date().toISOString();
  nextWorld.updatedAt = runtime.updatedAt;
  nextWorld.persistentRuntime = runtime;
  if (runtime.performance) {
    runtime.performance.totalMs = performance.now() - startedAt;
    runtime.performance.tickCount = completedSteps;
    runtime.performance.averageTickMs = completedSteps ? runtime.performance.totalMs / completedSteps : 0;
    runtime.performance.growth = {
      events: events.length + createdEvents.length - initialEventCount,
      memories: (nextWorld.memories?.length || 0) - initialMemoryCount,
      observations: (runtime.eventObservations?.length || 0) - initialObservationCount
    };
  }
  return { world: nextWorld as WorldState, runtime, events: createdEvents, queue: buildTownEmergenceQueue(nextWorld, [...events, ...createdEvents], runtime) };
}
