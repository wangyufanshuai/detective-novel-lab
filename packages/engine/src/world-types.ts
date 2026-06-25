import type { CaseProofCoverage, CaseRouteCertificate, DeductionCase, EvidenceChallenge, Judgement, PlayerTheory, RuleReport } from "./types";

export type WorldLocation = {
  id: string;
  name: string;
  kind: "home" | "work" | "public" | "restricted" | "crime";
  description: string;
  connectedLocationIds: string[];
  x?: number;
  y?: number;
};

export type TravelEdge = {
  from: string;
  to: string;
  minutes: number;
};

export type TravelConstraint = {
  edges: TravelEdge[];
  defaultMinutes: number;
};

export type ReachabilityResult = {
  characterId: string;
  fromLocationId: string;
  toLocationId: string;
  availableMinutes: number;
  requiredMinutes: number;
  reachable: boolean;
  sourceEventId?: string;
};

export type NPCProfile = {
  id: string;
  name: string;
  role: string;
  homeLocationId: string;
  schedule: Record<string, string>;
  relationships: Record<string, "friend" | "rival" | "family" | "debt" | "secret">;
  secret: string;
  motiveSeed: string;
  skills: string[];
  memoryEventIds: string[];
  liePolicy: string;
  alive: boolean;
};

export type WorldMode = "showcase" | "advanced";

export type MurderArchetype = "blade" | "poison" | "blunt" | "fall";

export type SuspectRole = "culprit" | "victim" | "witness" | "focus_suspect" | "bystander";

export type CaseGenerationProfile = {
  seed: string;
  archetype: MurderArchetype;
  victimId: string;
  culpritId: string;
  witnessId: string;
  focusSuspectIds: string[];
  sceneLocationId: string;
  prepLocationId: string;
  motiveEventId: string;
  meansEventId: string;
  opportunityEventId: string;
  deathEventId: string;
  stagingEventId: string;
  traceEventId: string;
  groupAlibiEventId: string;
  decisiveEvidenceIds: string[];
};

export type WorldCaseSourceMap = {
  motiveEvidenceId: string;
  meansEvidenceId: string;
  opportunityEvidenceId: string;
  stagingEvidenceId: string;
  traceEvidenceId: string;
  groupAlibiEvidenceId: string;
  sourceEventIds: string[];
  triggeredEventId?: string;
  sourceCandidateId?: string;
  evidenceSourceEventIds?: Record<string, string[]>;
  extractionEventSourceIds?: Record<string, string[]>;
  chainStageSourceEventIds?: Record<string, string[]>;
  memorySourceIds?: string[];
  observationSourceIds?: string[];
};

export type WorldEventType =
  | "move"
  | "witness"
  | "conversation"
  | "conflict"
  | "obtain_item"
  | "destroy_evidence"
  | "death"
  | "forensic_clue"
  | "alibi";

export type WorldEvent = {
  id: string;
  worldId: string;
  day: number;
  time: string;
  type: WorldEventType;
  actorIds: string[];
  locationId: string;
  summary: string;
  publicSummary: string;
  hidden: boolean;
  evidenceId?: string;
  relatedCharacterIds: string[];
  tags: string[];
  intentId?: string;
  causedByEventIds?: string[];
  goalId?: string;
  explanation?: string;
};

export type CaseTemplateId = "archive-blunt" | "clocktower-locked-room" | "clinic-poison" | "greenhouse-blade";

export type NpcGoal = {
  id: string;
  npcId: string;
  label: string;
  priority: number;
  targetLocationId: string;
  relatedSecret: string;
  activeFrom: string;
  activeUntil: string;
};

export type NpcIntent = {
  id: string;
  npcId: string;
  goalId: string;
  time: string;
  locationId: string;
  reason: string;
  riskFactors: string[];
  intendedAction: "routine" | "avoid" | "threaten" | "obtain_means" | "follow" | "attack" | "stage_scene" | "hide_trace" | "testify";
  visibleToPlayer: boolean;
};

export type CausalEventLink = {
  fromEventId: string;
  toEventId: string;
  relation:
    | "schedule-enables"
    | "secret-risk-raises"
    | "conflict-triggers"
    | "means-enables"
    | "opportunity-enables"
    | "crime-causes"
    | "staging-creates"
    | "trace-reveals"
    | "alibi-excludes";
  explanation: string;
};

export type WorldCausalTrace = {
  caseId: string;
  goals: NpcGoal[];
  intents: NpcIntent[];
  links: CausalEventLink[];
  orderedEventIds: string[];
  publicEventIds: string[];
  hiddenEventIds: string[];
  complete: boolean;
  emergenceScore: number;
};

export type CausalTraceReport = {
  valid: boolean;
  complete: boolean;
  emergenceScore: number;
  intentBackedEvents: number;
  totalKeyEvents: number;
  errors: string[];
  warnings: string[];
};

export type MemoryKind = "direct" | "rumor" | "secret" | "false" | "deduced";

export type MemoryRecord = {
  id: string;
  worldId: string;
  npcId: string;
  kind: MemoryKind;
  eventId: string;
  day: number;
  summary: string;
  sourceNpcId?: string;
  sourceObservationId?: string;
  confidence: number;
  visibleToPlayer: boolean;
  challengeableEvidenceIds: string[];
};

export type SocialPressure = {
  npcId: string;
  targetId: string;
  secretRisk: number;
  relationshipTension: number;
  opportunityWindow: number;
  meansAccess: number;
  score: number;
  sourceEventIds: string[];
};

export type DailySimulationReport = {
  day: number;
  eventIds: string[];
  memoryIds: string[];
  topPressures: SocialPressure[];
};

export type ContradictionHit = {
  hit: boolean;
  testimonyId?: string;
  evidenceId?: string;
  characterId: string;
  contradiction: string;
  revisedStatement?: string;
};

export type TestimonyRecord = {
  id: string;
  caseId: string;
  characterId: string;
  initialStatement: string;
  currentStatement: string;
  contradictionEvidenceIds: string[];
  exposedContradictions: string[];
  revised: boolean;
  memoryIds: string[];
};

export type CulpritCandidateAnalysis = {
  characterId: string;
  name: string;
  motive: boolean;
  means: boolean;
  opportunity: boolean;
  contradicted: boolean;
  excluded: boolean;
  exclusionEvidenceIds: string[];
  reachability?: ReachabilityResult;
  possibleCulprit: boolean;
  reasons: string[];
};

export type ReasoningTrace = {
  reasoningStepId: string;
  conclusion: string;
  evidenceIds: string[];
  eventIds: string[];
  complete: boolean;
};

export type CaseQualityReport = {
  score: number;
  qualityScore: number;
  fairPlay: number;
  uniqueness: number;
  evidenceCoverage: number;
  redHerringQuality: number;
  testimonyContradictions: number;
  timelineReadability: number;
  memorySupport: number;
  logicStrength?: number;
  misdirectionQuality?: number;
  emergenceScore?: number;
  causalTraceComplete?: boolean;
  intentBackedEvents?: number;
  worldBackedEvidence: boolean;
  memoryScopedTestimony: boolean;
  timeline24hComplete: boolean;
  nonCulpritExcluded: boolean;
  reasoningTraceComplete: boolean;
  deductionGraphComplete?: boolean;
  allNonCulpritsExplainablyExcluded?: boolean;
  uniqueCulprit: boolean;
  reachabilityValid: boolean;
  candidateAnalysis: CulpritCandidateAnalysis[];
  reasoningTrace: ReasoningTrace[];
  warnings: string[];
};

export type MisdirectionProfile = {
  characterId: string;
  apparentMotive: string;
  apparentMeans: string;
  apparentOpportunity: string;
  refutedByEvidenceIds: string[];
  sourceEventIds: string[];
};

export type SuspectEliminationStep = {
  characterId: string;
  suspectName: string;
  surfaceSuspicion: string;
  eliminatedByEvidenceIds: string[];
  sourceEventIds: string[];
  explanation: string;
  isCulprit: boolean;
};

export type DeductionGraphNodeType = "evidence" | "event" | "testimony" | "elimination" | "conclusion";

export type DeductionGraphNode = {
  id: string;
  type: DeductionGraphNodeType;
  label: string;
  detail: string;
  characterIds: string[];
  evidenceIds: string[];
  eventIds: string[];
};

export type DeductionGraphEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
};

export type DeductionGraph = {
  caseId: string;
  nodes: DeductionGraphNode[];
  edges: DeductionGraphEdge[];
  culpritConclusionNodeId: string;
  complete: boolean;
};

export type SuspectBoardRow = {
  characterId: string;
  name: string;
  role: string;
  motive: boolean;
  means: boolean;
  opportunity: boolean;
  surfaceSuspicion: string;
  exclusionEvidenceIds: string[];
  sourceEventIds: string[];
  status: "culprit" | "eliminated" | "red_herring" | "victim";
};

export type CaseLogicReport = {
  caseId: string;
  summary: string;
  fairPlay: boolean;
  uniqueCulprit: boolean;
  logicStrength: number;
  misdirectionQuality: number;
  deductionGraphComplete: boolean;
  allNonCulpritsExplainablyExcluded: boolean;
  strongMisdirections: MisdirectionProfile[];
  eliminationSteps: SuspectEliminationStep[];
  warnings: string[];
};

export type EmergenceProofStage =
  | "npc-goals"
  | "npc-intents"
  | "world-events"
  | "memories"
  | "conflict"
  | "crime"
  | "evidence"
  | "case-extraction"
  | "validation";

export type EmergenceProofNode = {
  id: string;
  stage: EmergenceProofStage;
  label: string;
  detail: string;
  time?: string;
  locationId?: string;
  npcIds: string[];
  eventIds: string[];
  memoryIds: string[];
  evidenceIds: string[];
  visible: boolean;
  locked: boolean;
};

export type EmergenceProofLink = {
  id: string;
  from: string;
  to: string;
  label: string;
};

export type EmergenceEvaluation = {
  caseId: string;
  generatedCase: boolean;
  uniqueCulprit: boolean;
  worldBackedEvidence: boolean;
  memoryScopedTestimony: boolean;
  nonCulpritExcluded: boolean;
  timelineConsistent: boolean;
  hardLogicValid: boolean;
  causalTraceComplete: boolean;
  reasoningTraceComplete: boolean;
  qualityScore: number;
  emergenceScore: number;
  proofComplete: boolean;
  errors: string[];
  warnings: string[];
};

export type EmergenceProofTrace = {
  caseId: string;
  solved: boolean;
  complete: boolean;
  evaluation: EmergenceEvaluation;
  nodes: EmergenceProofNode[];
  links: EmergenceProofLink[];
};

export type ProofViewMode = "player" | "developer";

export type EvidenceNotebookItem = {
  evidenceId: string;
  title: string;
  locked: boolean;
  discovered: boolean;
  isKey: boolean;
  locationId: string;
  locationName: string;
  sourceEventId?: string;
  sourceEventLabel?: string;
  challengeNpcIds: string[];
  challengeNpcNames: string[];
  supports: string[];
  contradicts: string[];
  useHint: string;
};

export type ProofTourStep = {
  id: string;
  stage: "event" | "memory" | "evidence" | "contradiction" | "elimination" | "conclusion" | "validation";
  title: string;
  detail: string;
  locked: boolean;
  complete: boolean;
  time?: string;
  locationId?: string;
  characterIds: string[];
  evidenceIds: string[];
  eventIds: string[];
  memoryIds: string[];
};

export type PlayableCaseTask = {
  id: string;
  kind: "observe" | "search" | "question" | "challenge" | "organize" | "submit" | "review";
  title: string;
  detail: string;
  complete: boolean;
  targetLocationId?: string;
  targetCharacterId?: string;
  targetEvidenceId?: string;
  locked?: boolean;
};

export type PlayableCaseSourceTrail = {
  id: string;
  kind: "event" | "memory" | "observation" | "candidate";
  label: string;
  detail: string;
  hidden: boolean;
  eventId?: string;
  memoryId?: string;
  time?: string;
  locationId?: string;
  characterIds: string[];
};

export type PlayableCaseNextAction = {
  kind: "join" | PlayableCaseTask["kind"];
  label: string;
  detail: string;
  buttonLabel: string;
  targetLocationId?: string;
  targetCharacterId?: string;
  targetEvidenceId?: string;
};

export type PlayableCaseProgress = {
  currentStage: "join" | "search" | "question" | "challenge" | "submit" | "review" | "solved";
  discoveredEvidence: number;
  totalEvidence: number;
  questionedWitnesses: number;
  totalWitnesses: number;
  challengeReadyCount: number;
  challengeHitCount: number;
  selectedTheoryEvidence: number;
  submitReady: boolean;
  wrongTheorySubmitted: boolean;
  solved: boolean;
};

export type PlayableCaseRouteIntegrity = {
  playable: boolean;
  searchableEvidence: boolean;
  witnessAvailable: boolean;
  contradictionAvailable: boolean;
  proofLedgerValid?: boolean;
  routeCertified?: boolean;
  criticalCoverage: {
    motive: boolean;
    means: boolean;
    opportunity: boolean;
    exclusion: boolean;
  };
  blockers: string[];
};

export type PlayableCaseIntake = {
  caseId: string;
  sourceCandidateId?: string;
  readiness: {
    status: "ready" | "investigating" | "solved";
    score: number;
    summary: string;
  };
  chainStages: Array<{
    id: string;
    label: string;
    complete: boolean;
    sourceEventCount: number;
  }>;
  starterTasks: PlayableCaseTask[];
  evidenceRoute: Array<{
    id: string;
    locationId: string;
    locationName: string;
    discovered: boolean;
    isKey: boolean;
    hint: string;
  }>;
  witnessPlan: Array<{
    characterId: string;
    characterName: string;
    questioned: boolean;
    challengeReady: boolean;
    suggestedEvidenceIds: string[];
    hint: string;
  }>;
  spoilerSafeGaps: string[];
  sourceCounts: {
    events: number;
    memories: number;
    observations: number;
    discoveredEvidence: number;
    totalEvidence: number;
  };
  sourceTrail: PlayableCaseSourceTrail[];
  nextAction?: PlayableCaseNextAction;
  routeIntegrity?: PlayableCaseRouteIntegrity;
  proofCoverage?: CaseProofCoverage;
  routeCertificate?: CaseRouteCertificate;
  progress?: PlayableCaseProgress;
  progressStages?: PlayableCaseTask[];
  blockedReasons?: string[];
};

export type MapInteractiveTarget = {
  id: string;
  kind: "location" | "npc" | "evidence" | "event";
  label: string;
  locationId?: string;
  characterId?: string;
  evidenceId?: string;
  eventId?: string;
  time?: string;
  enabled: boolean;
};

export type EmergenceSeedResult = {
  seed: string;
  worldId?: string;
  caseId?: string;
  generatedCase: boolean;
  passed: boolean;
  uniqueCulprit: boolean;
  worldBackedEvidence: boolean;
  memoryScopedTestimony: boolean;
  nonCulpritExcluded: boolean;
  timelineConsistent: boolean;
  hardLogicValid: boolean;
  qualityScore: number;
  emergenceScore: number;
  sixStageComplete?: boolean;
  realCaseTriggered?: boolean;
  matureTick?: number;
  proofNodeCount: number;
  errors: string[];
  warnings: string[];
};

export type EmergenceBenchmarkReport = {
  generatedAt: string;
  seedCount: number;
  passed: number;
  failed: number;
  averageQualityScore: number;
  averageEmergenceScore: number;
  sixStageCompleteRate?: number;
  realCaseTriggerRate?: number;
  averageMatureTick?: number;
  passRate: number;
  results: EmergenceSeedResult[];
};

export type DialogueSafetyFlag =
  | "prompt_contains_forbidden_truth"
  | "answer_mentions_culprit_before_reveal"
  | "answer_mentions_hidden_method"
  | "answer_ignores_memory_scope"
  | "answer_misses_evidence_challenge"
  | "answer_unavailable_model";

export type PromptAuditReport = {
  memoryCount: number;
  evidenceCount: number;
  forbiddenFieldHits: string[];
  containsForbiddenTruth: boolean;
  hiddenEventLeakCount: number;
  safe: boolean;
};

export type NpcDialogueEvalReport = {
  score: number;
  safetyFlags: DialogueSafetyFlag[];
  mentionsCulprit: boolean;
  mentionsHiddenMethod: boolean;
  referencesVisibleMemory: boolean;
  acknowledgesChallenge: boolean;
  answerLength: number;
};

export type RevealEvalReport = {
  sourceLocked: true;
  score: number;
  factContractScore: number;
  culpritPreserved: boolean;
  motivePreserved: boolean;
  methodPreserved: boolean;
  evidencePreserved: boolean;
  sourceEventsPreserved: boolean;
  contractHits: RevealContractHit[];
  contractMisses: RevealContractMiss[];
  warnings: string[];
};

export type RevealFactContract = {
  sourceLocked: true;
  culprit: {
    id: string;
    name: string;
  };
  motive: {
    text: string;
    keywords: string[];
  };
  method: {
    text: string;
    keywords: string[];
  };
  decisiveEvidence: Array<{
    id: string;
    title: string;
  }>;
  sourceEventIds: string[];
};

export type RevealContractHit = {
  field: "culprit" | "motive" | "method" | "evidence" | "sourceEvent";
  value: string;
};

export type RevealContractMiss = {
  field: "culprit" | "motive" | "method" | "evidence" | "sourceEvent";
  expected: string;
};

export type DeepSeekSeedEvalResult = {
  seed: string;
  worldId: string;
  caseId: string;
  passed: boolean;
  hardNpcFailureCount: number;
  revealScore: number;
  revealFactContractScore: number;
  npcChecks: Array<{
    characterId: string;
    role: "culprit" | "witness" | "focus_suspect";
    evidenceId?: string;
    mock: boolean;
    promptAudit: PromptAuditReport;
    dialogueEval: NpcDialogueEvalReport;
    answerPreview: string;
  }>;
  revealCheck: {
    mock: boolean;
    sourceLocked: true;
    revealEval: RevealEvalReport;
    contentPreview: string;
  };
  summary: string[];
};

export type DeepSeekLiveEvalReport = {
  generatedAt: string;
  seed: string;
  model: string;
  worldId: string;
  caseId: string;
  passed: boolean;
  aggregate?: {
    seedCount: number;
    passedSeeds: number;
    failedSeeds: string[];
    averageRevealScore: number;
    averageFactContractScore: number;
    hardNpcFailureCount: number;
  };
  seedResults?: DeepSeekSeedEvalResult[];
  npcChecks: Array<{
    characterId: string;
    role: "culprit" | "witness" | "focus_suspect";
    evidenceId?: string;
    mock: boolean;
    promptAudit: PromptAuditReport;
    dialogueEval: NpcDialogueEvalReport;
    answerPreview: string;
  }>;
  revealCheck: {
    mock: boolean;
    sourceLocked: true;
    revealEval: RevealEvalReport;
    contentPreview: string;
  };
  summary: string[];
};

export type WorldState = {
  id: string;
  seed: string;
  name: string;
  mode?: WorldMode;
  timelineHours?: number;
  day: number;
  currentTime: string;
  plannedArchetype?: MurderArchetype;
  locations: WorldLocation[];
  npcs: NPCProfile[];
  memories: MemoryRecord[];
  simulationReports: DailySimulationReport[];
  activeCaseId?: string;
  createdAt: string;
  updatedAt: string;
};

export type CaseFromLog = {
  id: string;
  worldId: string;
  sourceEventIds: string[];
  deathEventId: string;
  triggeredEventId?: string;
  sourceCandidateId?: string;
  generationProfile: CaseGenerationProfile;
  sourceMap: WorldCaseSourceMap;
  testimonies: TestimonyRecord[];
  qualityReport: CaseQualityReport;
  causalTrace?: WorldCausalTrace;
  deductionCase: DeductionCase;
  validation: WorldCaseValidation;
  createdAt: string;
};

export type PlayerSession = {
  id: string;
  worldId: string;
  caseId: string;
  playerId: string;
  displayName: string;
  discoveredEvidenceIds: string[];
  interrogationLog: InterrogationLogEntry[];
  submittedTheory?: PlayerTheory;
  judgement?: Judgement;
  createdAt: string;
  updatedAt: string;
};

export type InterrogationLogEntry = {
  id: string;
  sessionId: string;
  characterId: string;
  question: string;
  evidenceId?: string;
  answer: string;
  memoryEventIds: string[];
  challenge?: EvidenceChallenge;
  createdAt: string;
};

export type WorldCaseValidation = RuleReport & {
  worldValid: boolean;
  worldErrors: string[];
  worldWarnings: string[];
  sourceEventIds: string[];
};

export type TownSnapshot = {
  world: WorldState;
  events: WorldEvent[];
  activeCase?: CaseFromLog;
  sessions: PlayerSession[];
};

export type WorldMapTerrain = "grass" | "water" | "road" | "hill" | "forest" | "district" | "building";

export type WorldMapTile = {
  id: string;
  x: number;
  y: number;
  terrain: WorldMapTerrain;
  locationId?: string;
  locationName?: string;
  searchable: boolean;
  evidenceCount: number;
  discoveredEvidenceCount: number;
};

export type WorldMapActorStatus = "alive" | "victim" | "culprit" | "suspect" | "witness" | "questioned";

export type WorldMapActor = {
  id: string;
  name: string;
  role: string;
  locationId: string;
  locationName: string;
  x: number;
  y: number;
  status: WorldMapActorStatus;
  isVictim: boolean;
  isCulprit: boolean;
  isQuestioned: boolean;
};

export type WorldMapMarkerType = "event" | "evidence" | "crime" | "contradiction" | "highlight";

export type WorldMapMarker = {
  id: string;
  type: WorldMapMarkerType;
  label: string;
  locationId: string;
  locationName: string;
  x: number;
  y: number;
  time?: string;
  eventId?: string;
  evidenceId?: string;
  discovered?: boolean;
  relatedCharacterIds: string[];
};

export type WorldMapSnapshot = {
  worldId: string;
  caseId?: string;
  sessionId?: string;
  day: number;
  time: string;
  width: number;
  height: number;
  tiles: WorldMapTile[];
  actors: WorldMapActor[];
  markers: WorldMapMarker[];
  visibleEvents: WorldEvent[];
  selectedEventIds: string[];
  discoveredEvidenceIds: string[];
};

export type RuntimeMode = "static-demo" | "server";

export type InvestigationProgress = {
  observedCrimeWindow: boolean;
  joinedInvestigation: boolean;
  discoveredEvidence: boolean;
  challengedTestimony: boolean;
  submittedTheory: boolean;
  solvedCase: boolean;
};

export type DeductionGraphVisibility = {
  discoveredEvidenceIds: string[];
  revealedEventIds: string[];
  revealedCharacterIds: string[];
  solutionRevealed: boolean;
};

export type DemoRuntimeState = {
  mode: "static-demo";
  world: WorldState;
  events: WorldEvent[];
  activeCase: CaseFromLog;
  session: PlayerSession;
  progress: InvestigationProgress;
  revealText: string;
};
