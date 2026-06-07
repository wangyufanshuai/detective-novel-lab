import type { DeductionCase, EvidenceChallenge, Judgement, PlayerTheory, RuleReport } from "./types";

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
  worldBackedEvidence: boolean;
  memoryScopedTestimony: boolean;
  timeline24hComplete: boolean;
  nonCulpritExcluded: boolean;
  reasoningTraceComplete: boolean;
  uniqueCulprit: boolean;
  reachabilityValid: boolean;
  candidateAnalysis: CulpritCandidateAnalysis[];
  reasoningTrace: ReasoningTrace[];
  warnings: string[];
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
  generationProfile: CaseGenerationProfile;
  sourceMap: WorldCaseSourceMap;
  testimonies: TestimonyRecord[];
  qualityReport: CaseQualityReport;
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
