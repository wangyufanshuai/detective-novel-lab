export type NovelEntityKind = "character" | "faction" | "location" | "item" | "concept";

export type NovelEntity = {
  id: string;
  kind: NovelEntityKind;
  name: string;
  role: string;
  summary: string;
  traits: string[];
  x?: number;
  y?: number;
  tension?: number;
  sourceChapterIds?: string[];
  firstSeenChapterId?: string;
  lastUpdatedChapterId?: string;
  evidence?: NovelEvidenceSnippet[];
};

export type NovelRelationship = {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  label: string;
  polarity: "ally" | "rival" | "family" | "debt" | "secret" | "neutral";
  evidence: string;
  strength: number;
  sourceChapterIds?: string[];
  firstSeenChapterId?: string;
  lastUpdatedChapterId?: string;
  evidenceSnippets?: NovelEvidenceSnippet[];
};

export type NovelEvent = {
  id: string;
  order: number;
  timeLabel: string;
  title: string;
  summary: string;
  locationEntityId?: string;
  participantEntityIds: string[];
  causes: string[];
  consequences: string[];
  publicKnowledge: boolean;
  sourceChapterId?: string;
  evidence?: NovelEvidenceSnippet[];
};

export type NovelWorldDevelopmentStep = {
  id: string;
  title: string;
  trigger: string;
  likelyOutcome: string;
  involvedEntityIds: string[];
  tension: number;
  unresolvedQuestion: string;
  sourceChapterIds?: string[];
  evidence?: NovelEvidenceSnippet[];
};

export type NovelWorldGraph = {
  id: string;
  title: string;
  genreTone: string;
  premise: string;
  observerBrief: string;
  entities: NovelEntity[];
  relationships: NovelRelationship[];
  events: NovelEvent[];
  development: NovelWorldDevelopmentStep[];
  warnings: string[];
};

export type NovelWorldValidationReport = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type NovelChapterInput = {
  id: string;
  order: number;
  title: string;
  fragment: string;
  genreTone?: string;
};

export type NovelChapterAnalysisStatus = "draft" | "analyzing" | "ready" | "error";

export type NovelChapterAnalysis = {
  input: NovelChapterInput;
  status: NovelChapterAnalysisStatus;
  graph?: NovelWorldGraph;
  characterStates?: NovelCharacterStatePoint[];
  themeSignals?: NovelThemeSignal[];
  themeCandidates?: NovelThemeDefinition[];
  validation?: NovelWorldValidationReport;
  error?: string;
  analyzedAt?: string;
};

export type NovelParagraph = {
  id: string;
  chapterId: string;
  order: number;
  text: string;
  charStart: number;
  charEnd: number;
};

export type NovelLongChapterText = {
  chapterId: string;
  order: number;
  title: string;
  rawText: string;
  paragraphs: NovelParagraph[];
  updatedAt: string;
};

export type NovelSourceSpan = {
  chapterId: string;
  paragraphId: string;
  startOffset?: number;
  endOffset?: number;
  quote: string;
  summary: string;
  confidence: number;
};

export type NovelEvidenceSnippet = {
  id: string;
  source: NovelSourceSpan;
  keywords: string[];
};

export type NovelEvidenceIndex = {
  chapterId: string;
  paragraphCount: number;
  snippets: NovelEvidenceSnippet[];
  warnings: string[];
};

export type NovelCharacterDimension = "goal" | "belief" | "relationships" | "bodyCapability" | "socialPosition";

export type NovelCharacterDimensionState = {
  summary: string;
  direction: "up" | "down" | "changed" | "stable" | "unknown";
  intensity: number;
};

export type NovelCharacterStatePoint = {
  id: string;
  characterEntityId: string;
  chapterId: string;
  chapterOrder: number;
  summary: string;
  dimensions: Record<NovelCharacterDimension, NovelCharacterDimensionState>;
  evidence: NovelEvidenceSnippet[];
  uncertainty: number;
};

export type NovelCharacterTurningPoint = {
  id: string;
  characterEntityId: string;
  chapterId: string;
  title: string;
  summary: string;
  changedDimensions: NovelCharacterDimension[];
  intensity: number;
  evidence: NovelEvidenceSnippet[];
};

export type NovelCharacterArc = {
  characterEntityId: string;
  characterName: string;
  points: NovelCharacterStatePoint[];
  turningPoints: NovelCharacterTurningPoint[];
  evidenceGapChapterIds: string[];
  score: number;
};

export type NovelThemeCategory = "personalWill" | "valueBelief" | "relationshipEmotion" | "institutionOrganization" | "materialSurvival" | "bodyCapability";

export type NovelThemeStatus = "pending" | "confirmed" | "hidden";

export type NovelThemePressureDirection = "intensify" | "relieve" | "transform" | "contested" | "unclear";

export type NovelThemeDefinition = {
  id: string;
  name: string;
  category: NovelThemeCategory;
  aliases: string[];
  status: NovelThemeStatus;
  description: string;
};

export type NovelThemeSignal = {
  id: string;
  themeId: string;
  chapterId: string;
  chapterOrder: number;
  direction: NovelThemePressureDirection;
  intensity: number;
  summary: string;
  uncertainty: number;
  relatedCharacterIds: string[];
  relatedEventIds: string[];
  relatedFactionIds: string[];
  competingInterpretations: string[];
  evidence: NovelEvidenceSnippet[];
};

export type NovelThemeArc = {
  themeId: string;
  themeName: string;
  category: NovelThemeCategory;
  status: NovelThemeStatus;
  signals: NovelThemeSignal[];
  evidenceGapChapterIds: string[];
  peakSignalIds: string[];
  relatedCharacterIds: string[];
  relatedEventIds: string[];
  relatedFactionIds: string[];
  contestedSignalIds: string[];
  score: number;
};

export type NovelCausalRefKind = "event" | "character-state" | "theme-signal" | "relationship" | "development";

export type NovelCausalRef = {
  kind: NovelCausalRefKind;
  id: string;
  chapterId?: string;
  label: string;
};

export type NovelCausalClaim = {
  id: string;
  cause: NovelCausalRef;
  effect: NovelCausalRef;
  summary: string;
  confidence: number;
  chapterIds: string[];
  evidence: NovelEvidenceSnippet[];
  contestedInterpretations: string[];
};

export type NovelCausalEdge = {
  id: string;
  from: NovelCausalRef;
  to: NovelCausalRef;
  claimId: string;
  relation: "drives" | "pressures" | "reveals" | "escalates" | "contested" | "gap";
  chapterIds: string[];
  evidence: NovelEvidenceSnippet[];
};

export type NovelCausalChain = {
  id: string;
  title: string;
  summary: string;
  claimIds: string[];
  edgeIds: string[];
  chapterIds: string[];
  evidenceGapChapterIds: string[];
  contestedClaimIds: string[];
  score: number;
};

export type NovelCausalityReport = {
  id: string;
  projectId: string;
  throughChapterId?: string;
  claims: NovelCausalClaim[];
  edges: NovelCausalEdge[];
  chains: NovelCausalChain[];
  gaps: string[];
  warnings: string[];
};

export type NovelAskQuestionKind = "character" | "event" | "theme" | "causality" | "evidence" | "world-state" | "unsupported";

export type NovelAskSourceType =
  | "paragraph"
  | "entity"
  | "relationship"
  | "event"
  | "development"
  | "character-state"
  | "theme-signal"
  | "causal-claim"
  | "causal-edge";

export type NovelAskQuestion = {
  id: string;
  text: string;
  askedAt: string;
  throughChapterId?: string;
};

export type NovelAskQueryPlan = {
  id: string;
  question: string;
  kind: NovelAskQuestionKind;
  normalizedTerms: string[];
  entityIds: string[];
  eventIds: string[];
  themeIds: string[];
  causalClaimIds: string[];
  throughChapterId?: string;
  refusedReason?: string;
};

export type NovelAskEvidenceHit = {
  id: string;
  sourceType: NovelAskSourceType;
  sourceId: string;
  label: string;
  chapterId: string;
  paragraphId: string;
  quote: string;
  summary: string;
  confidence: number;
  score: number;
  relatedObjectIds: string[];
};

export type NovelAskAnswer = {
  id: string;
  question: string;
  status: "answered" | "insufficient-evidence" | "refused";
  answer: string;
  summaryBullets: string[];
  evidenceHitIds: string[];
  relatedObjectIds: string[];
  warnings: string[];
};

export type NovelAskValidationReport = NovelWorldValidationReport;

export type NovelWorldMergeChange = {
  chapterId: string;
  kind: "entity" | "relationship" | "event" | "development";
  id: string;
  action: "added" | "merged" | "changed" | "conflict";
  label: string;
  detail: string;
};

export type NovelWorldMergeConflict = {
  id: string;
  chapterId: string;
  kind: "entity" | "relationship" | "event" | "development";
  targetId: string;
  message: string;
};

export type NovelWorldMergeReport = {
  valid: boolean;
  chapterCount: number;
  analyzedChapterCount: number;
  addedEntityIds: string[];
  mergedEntityIds: string[];
  changedEntityIds: string[];
  changes: NovelWorldMergeChange[];
  conflicts: NovelWorldMergeConflict[];
};

export type NovelEntityIdentityDecision = {
  id: string;
  sourceChapterId: string;
  sourceEntityId: string;
  sourceName: string;
  canonicalEntityId: string;
  canonicalName: string;
  confidence: number;
  status: "auto-merged" | "pending" | "confirmed" | "rejected";
  reasons: string[];
  evidence: NovelEvidenceSnippet[];
  createdAt: string;
  updatedAt: string;
};

export type NovelEntityIdentityRegistry = {
  version: 1;
  decisions: NovelEntityIdentityDecision[];
  updatedAt: string;
};

export type NovelWorldProject = {
  version: 2;
  id: string;
  title: string;
  genreTone: string;
  chapters: NovelChapterAnalysis[];
  themeRegistry?: NovelThemeDefinition[];
  identityRegistry?: NovelEntityIdentityRegistry;
  mergedGraph: NovelWorldGraph;
  mergeReport: NovelWorldMergeReport;
  createdAt: string;
  updatedAt: string;
};

export type NovelCorrectionObjectKind = "entity" | "relationship" | "event" | "development" | "character-state" | "theme-signal" | "causal-claim";

export type NovelCorrectionTarget =
  | { kind: "entity"; id: string }
  | { kind: "relationship"; id: string }
  | { kind: "event"; id: string }
  | { kind: "development"; id: string }
  | { kind: "character-state"; id: string }
  | { kind: "theme-signal"; id: string }
  | { kind: "causal-claim"; id: string }
  | { kind: "evidence"; id: string; ownerKind: NovelCorrectionObjectKind; ownerId: string };

export type NovelCorrectionOperation =
  | { type: "rename-entity"; name: string }
  | { type: "merge-entities"; sourceEntityId: string; targetEntityId: string }
  | { type: "change-entity-kind"; kind: NovelEntityKind }
  | { type: "edit-entity-fields"; role?: string; summary?: string; traits?: string[] }
  | { type: "replace-evidence"; evidence: NovelEvidenceSnippet[] }
  | { type: "add-evidence"; evidence: NovelEvidenceSnippet[] }
  | { type: "remove-evidence"; evidenceIds: string[] }
  | { type: "hide-object"; reason: string }
  | { type: "restore-object" };

export type NovelCorrectionAuditTrail = {
  at: string;
  action: "created" | "applied" | "reverted" | "dismissed";
  note: string;
};

export type NovelCorrectionPatch = {
  id: string;
  target: NovelCorrectionTarget;
  operation: NovelCorrectionOperation;
  status: "suggested" | "applied" | "dismissed" | "reverted";
  reason: string;
  createdAt: string;
  updatedAt: string;
  auditTrail: NovelCorrectionAuditTrail[];
};

export type NovelCorrectionSet = {
  version: 1;
  projectId: string;
  patches: NovelCorrectionPatch[];
  createdAt: string;
  updatedAt: string;
};

export type NovelQualityIssue = {
  id: string;
  severity: "blocking" | "high" | "medium" | "info";
  category: "evidence" | "entity" | "relationship" | "event" | "character" | "theme" | "causality" | "replay-readiness" | "conflict";
  target?: NovelCorrectionTarget;
  title: string;
  detail: string;
  suggestedPatchId?: string;
};

export type NovelQualityMetric = {
  id: "evidenceCoverage" | "referenceIntegrity" | "unresolvedConflicts" | "confidence" | "correctionCompletion";
  label: string;
  score: number;
  weight: number;
  detail: string;
};

export type NovelQualityScoreBreakdown = {
  total: number;
  evidenceCoverage: number;
  referenceIntegrity: number;
  unresolvedConflicts: number;
  confidence: number;
  correctionCompletion: number;
};

export type NovelQualityAuditReport = {
  id: string;
  projectId: string;
  score: number;
  metrics: NovelQualityMetric[];
  breakdown: NovelQualityScoreBreakdown;
  issues: NovelQualityIssue[];
  suggestedPatches: NovelCorrectionPatch[];
  generatedAt: string;
};

export type NovelBlueprintOptions = {
  wordCountRange: string;
  narrativePerspective: string;
  pacing: "quiet" | "balanced" | "high-tension";
  emphasizePayoffs: boolean;
};

export type NovelSceneBeat = {
  id: string;
  order: number;
  title: string;
  purpose: string;
  locationEntityId?: string;
  involvedEntityIds: string[];
  sourceEventIds: string[];
  tension: number;
  outcome: string;
  evidence?: NovelEvidenceSnippet[];
};

export type NovelForeshadowingPayoff = {
  id: string;
  setup: string;
  payoff: string;
  relatedEntityIds: string[];
  relatedEventIds: string[];
  urgency: "low" | "medium" | "high";
  evidence?: NovelEvidenceSnippet[];
};

export type NovelWritingRisk = {
  id: string;
  severity: "low" | "medium" | "high";
  message: string;
  mitigation: string;
  relatedEntityIds: string[];
  evidence?: NovelEvidenceSnippet[];
};

export type NovelChapterBlueprint = {
  id: string;
  afterChapterId?: string;
  targetChapterTitle: string;
  wordCountRange: string;
  narrativePerspective: string;
  pacing: NovelBlueprintOptions["pacing"];
  chapterGoal: string;
  sceneBeats: NovelSceneBeat[];
  characterMotivations: string[];
  conflictEscalation: string[];
  foreshadowingPayoffs: NovelForeshadowingPayoff[];
  writingRisks: NovelWritingRisk[];
  summary: string;
  warnings: string[];
};

export type NovelStateSimulationItem = {
  id: string;
  kind: "character" | "faction" | "location" | "event-chain" | "tension";
  label: string;
  before: string;
  after: string;
  driver: string;
  evidence: NovelEvidenceSnippet[];
};

export type NovelStateSimulation = {
  id: string;
  throughChapterId?: string;
  summary: string;
  items: NovelStateSimulationItem[];
  warnings: string[];
};

export type NovelSimulationMode = "grounded-replay" | "short-branch";
export type NovelSimulationProvenance = "source" | "inferred" | "counterfactual" | "gap";
export type NovelSimulationInterventionKind = "location" | "knowledge" | "relationship-pressure" | "resource" | "body-capability";

export type NovelSimulationKnowledgeFact = {
  id: string;
  actorEntityId: string;
  label: string;
  sourceEventId?: string;
  chapterId?: string;
  confidence: number;
  evidence: NovelEvidenceSnippet[];
};

export type NovelSimulationActorState = {
  actorEntityId: string;
  name: string;
  locationEntityId?: string;
  goal: string;
  belief: string;
  relationshipPressure: number;
  resources: string[];
  bodyCapability: number;
  socialPosition: number;
  knowledgeFactIds: string[];
};

export type NovelSimulationSnapshot = {
  id: string;
  stepIndex: number;
  chapterId?: string;
  actorStates: NovelSimulationActorState[];
  knowledgeFacts: NovelSimulationKnowledgeFact[];
  activeThemeSignalIds: string[];
  activeCausalClaimIds: string[];
};

export type NovelSimulationActionCandidate = {
  id: string;
  actorEntityId: string;
  action: "observe" | "move" | "communicate" | "confront" | "protect" | "withdraw" | "investigate" | "checkpoint";
  label: string;
  targetEntityIds: string[];
  targetLocationEntityId?: string;
  sourceEventId?: string;
  chapterId?: string;
  legal: boolean;
  score: number;
  scoreBreakdown?: Record<string, number>;
  ruleReasons: string[];
  blockedReasons: string[];
  stateEffects?: string[];
  evidence: NovelEvidenceSnippet[];
};

export type NovelSimulationStep = {
  id: string;
  index: number;
  chapterId?: string;
  sourceEventId?: string;
  title: string;
  summary: string;
  provenance: NovelSimulationProvenance;
  beforeSnapshot: NovelSimulationSnapshot;
  afterSnapshot: NovelSimulationSnapshot;
  candidates: NovelSimulationActionCandidate[];
  selectedCandidateId?: string;
  triggeredRuleIds: string[];
  relatedEntityIds: string[];
  relatedThemeSignalIds: string[];
  relatedCausalClaimIds: string[];
  evidence: NovelEvidenceSnippet[];
  gapReason?: string;
};

export type NovelSimulationIntervention = {
  id: string;
  kind: NovelSimulationInterventionKind;
  actorEntityId: string;
  value: string | number | boolean;
  appliedAtStepIndex: number;
  summary: string;
};

export type NovelReplayComparisonReport = {
  checkpointCount: number;
  completedCheckpointCount: number;
  eventMatchRate: number;
  orderConsistencyRate: number;
  participantMatchRate: number;
  locationMatchRate: number;
  causalCoverageRate: number;
  fidelityScore: number;
  missingPrerequisites: string[];
  lowEvidenceStepIds: string[];
  divergenceReasons: string[];
};

export type NovelSimulationStateDiff = {
  actorEntityId: string;
  actorName: string;
  location?: { baseline?: string; branch?: string };
  knowledgeAdded: string[];
  knowledgeRemoved: string[];
  resourcesAdded: string[];
  resourcesRemoved: string[];
  relationshipPressureDelta: number;
  bodyCapabilityDelta: number;
};

export type NovelSimulationBranchComparison = {
  baselineRunId: string;
  branchRunId: string;
  branchFromStepIndex: number;
  materialDivergence: boolean;
  baselineAction?: string;
  branchAction?: string;
  actorDiffs: NovelSimulationStateDiff[];
  causalClaimsAdded: string[];
  causalClaimsRemoved: string[];
  summary: string;
};

export type NovelSimulationRun = {
  version: 1;
  id: string;
  projectId: string;
  seed: string;
  mode: NovelSimulationMode;
  status: "ready" | "running" | "paused" | "complete" | "blocked";
  parentRunId?: string;
  branchFromStepIndex?: number;
  projectRevision?: string;
  stale?: boolean;
  staleReason?: string;
  throughChapterId?: string;
  checkpointEventIds: string[];
  currentStepIndex: number;
  initialSnapshot: NovelSimulationSnapshot;
  currentSnapshot: NovelSimulationSnapshot;
  steps: NovelSimulationStep[];
  interventions: NovelSimulationIntervention[];
  branchStepLimit: number;
  comparison: NovelReplayComparisonReport;
  branchComparison?: NovelSimulationBranchComparison;
  warnings: string[];
  createdAt: string;
  updatedAt: string;
};

export type NovelSimulationExplanation = {
  id: string;
  stepId: string;
  explanation: string;
  uncertainty: number;
  evidenceIds: string[];
  warnings: string[];
};

export type NovelGameLocationNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: "location" | "fallback";
  tension: number;
  active: boolean;
};

export type NovelGameActorSprite = {
  id: string;
  label: string;
  locationId: string;
  x: number;
  y: number;
  bodyCapability: number;
  relationshipPressure: number;
  selected: boolean;
};

export type NovelGameEventMarker = {
  id: string;
  stepId: string;
  eventId?: string;
  label: string;
  summary: string;
  locationId: string;
  x: number;
  y: number;
  provenance: NovelSimulationProvenance;
  evidenceCount: number;
  active: boolean;
};

export type NovelGameSceneState = {
  id: string;
  runId?: string;
  stepIndex: number;
  mode: NovelSimulationMode | "empty";
  status: NovelSimulationRun["status"] | "empty";
  locations: NovelGameLocationNode[];
  actors: NovelGameActorSprite[];
  events: NovelGameEventMarker[];
  paths: Array<{ id: string; fromLocationId: string; toLocationId: string; weight: number; active: boolean }>;
  selected?: { type: "actor" | "location" | "event"; id: string };
  warnings: string[];
};

export type NovelGameVisualEffect = {
  id: string;
  targetType: "actor" | "location" | "event" | "path";
  targetId: string;
  kind: "source-pulse" | "branch-glitch" | "evidence-gap" | "evidence-heat" | "motion-trail" | "selection";
  color: string;
  intensity: number;
};

export type NovelGameSpriteDefinition = {
  id: string;
  actorId: string;
  textureKey: string;
  palette: {
    primary: string;
    secondary: string;
    outline: string;
    accent: string;
  };
  bodyCapabilityBand: "low" | "steady" | "strong";
  pressureBand: "calm" | "strained" | "critical";
  evidenceCount: number;
  seed: number;
};

export type NovelGameLocationTile = {
  id: string;
  locationId: string;
  textureKey: string;
  palette: {
    ground: string;
    wall: string;
    accent: string;
    heat: string;
  };
  tensionBand: "low" | "medium" | "high";
  evidenceCount: number;
  eventCount: number;
  seed: number;
};

export type NovelGameVisualPreferences = {
  labels: "all" | "focus" | "off";
  evidenceHeat: boolean;
  motionTrails: boolean;
  pixelScale: 1 | 2;
};

export type NovelGameVisualProfile = {
  id: string;
  sceneId: string;
  sprites: NovelGameSpriteDefinition[];
  locations: NovelGameLocationTile[];
  effects: NovelGameVisualEffect[];
  preferences: NovelGameVisualPreferences;
  warnings: string[];
};

export type NovelChapterImportCandidate = {
  id: string;
  order: number;
  title: string;
  rawText: string;
  sourceStart: number;
  sourceEnd: number;
  warning?: string;
};

export type NovelWholeBookImportDraft = {
  id: string;
  title: string;
  sourceNote: string;
  rawTextLength: number;
  candidates: NovelChapterImportCandidate[];
  warnings: string[];
  createdAt: string;
  updatedAt: string;
};

export type NovelImportValidationReport = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type NovelBatchChapterStatus = "queued" | "indexing" | "analyzing" | "ready" | "error" | "skipped";

export type NovelBatchQueueState = {
  batchSize: 3 | 5 | 10;
  paused: boolean;
  running: boolean;
  chapterStatuses: Record<string, NovelBatchChapterStatus>;
  lastBatchChapterIds: string[];
  updatedAt: string;
};

export type NovelProjectSummary = {
  id: string;
  title: string;
  genreTone: string;
  chapterCount: number;
  updatedAt: string;
};

export type NovelPersistentWorkspace = {
  version: 1;
  project: NovelWorldProject;
  chapters: NovelLongChapterText[];
  evidenceIndexes: Record<string, NovelEvidenceIndex>;
  simulationRuns: NovelSimulationRun[];
  correctionSet: NovelCorrectionSet;
  batchQueue: NovelBatchQueueState;
  updatedAt: string;
};

const entityKinds = new Set<NovelEntityKind>(["character", "faction", "location", "item", "concept"]);
const polarities = new Set<NovelRelationship["polarity"]>(["ally", "rival", "family", "debt", "secret", "neutral"]);
const blueprintPacing = new Set<NovelBlueprintOptions["pacing"]>(["quiet", "balanced", "high-tension"]);
const blueprintSeverity = new Set<NovelWritingRisk["severity"]>(["low", "medium", "high"]);
const characterDimensions: NovelCharacterDimension[] = ["goal", "belief", "relationships", "bodyCapability", "socialPosition"];
const characterDirections = new Set<NovelCharacterDimensionState["direction"]>(["up", "down", "changed", "stable", "unknown"]);
const themeCategories = new Set<NovelThemeCategory>(["personalWill", "valueBelief", "relationshipEmotion", "institutionOrganization", "materialSurvival", "bodyCapability"]);
const themeStatuses = new Set<NovelThemeStatus>(["pending", "confirmed", "hidden"]);
const themeDirections = new Set<NovelThemePressureDirection>(["intensify", "relieve", "transform", "contested", "unclear"]);
export const novelEvidenceQuoteLimit = 120;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function numberInRange(value: unknown, fallback: number, min: number, max: number) {
  const next = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, next));
}

function stableSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
}

function stableId(prefix: string, value: string, index: number) {
  return `${prefix}-${stableSlug(value) || index + 1}`;
}

function toChineseNumber(value: number) {
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (value <= 10) return value === 10 ? "十" : digits[value];
  if (value < 20) return `十${digits[value - 10]}`;
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return `${digits[tens]}十${ones ? digits[ones] : ""}`;
}

function fallbackChapterSlices(rawText: string, targetSize = 4200): NovelChapterImportCandidate[] {
  const cleaned = rawText.trim();
  if (!cleaned) return [];
  const candidates: NovelChapterImportCandidate[] = [];
  for (let start = 0, order = 1; start < cleaned.length; start += targetSize, order += 1) {
    const end = Math.min(cleaned.length, start + targetSize);
    const raw = cleaned.slice(start, end).trim();
    if (!raw) continue;
    candidates.push({
      id: stableId("import-chapter", `slice-${order}-${raw.slice(0, 24)}`, order - 1),
      order,
      title: `Chapter ${order}`,
      rawText: raw,
      sourceStart: start,
      sourceEnd: end,
      warning: "No reliable chapter heading was detected; this candidate was created by length."
    });
  }
  return candidates;
}

function normalizeImportCandidate(input: unknown, index = 0): NovelChapterImportCandidate {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const order = Math.max(1, Math.floor(typeof raw.order === "number" ? raw.order : index + 1));
  const rawText = text(raw.rawText);
  return {
    id: text(raw.id) || stableId("import-chapter", `${order}-${text(raw.title)}-${rawText.slice(0, 24)}`, index),
    order,
    title: text(raw.title) || `Chapter ${order}`,
    rawText,
    sourceStart: Math.max(0, Math.floor(typeof raw.sourceStart === "number" ? raw.sourceStart : 0)),
    sourceEnd: Math.max(0, Math.floor(typeof raw.sourceEnd === "number" ? raw.sourceEnd : rawText.length)),
    warning: text(raw.warning) || undefined
  };
}

function clampQuote(value: string) {
  const cleaned = text(value).replace(/\s+/g, " ");
  return cleaned.length > novelEvidenceQuoteLimit ? `${cleaned.slice(0, novelEvidenceQuoteLimit - 1)}...` : cleaned;
}

function evidenceArray(value: unknown): NovelEvidenceSnippet[] {
  return Array.isArray(value) ? value.map((item, index) => normalizeEvidenceSnippet(item, index)).filter((item) => item.source.chapterId && item.source.paragraphId) : [];
}

function normalizeEvidenceSnippet(input: unknown, index = 0): NovelEvidenceSnippet {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const sourceRaw = (raw.source && typeof raw.source === "object" ? raw.source : raw) as Record<string, unknown>;
  const chapterId = text(sourceRaw.chapterId);
  const paragraphId = text(sourceRaw.paragraphId);
  const quote = clampQuote(text(sourceRaw.quote));
  return {
    id: text(raw.id) || stableId("evidence", `${chapterId}-${paragraphId}-${quote}`, index),
    source: {
      chapterId,
      paragraphId,
      startOffset: typeof sourceRaw.startOffset === "number" ? Math.max(0, sourceRaw.startOffset) : undefined,
      endOffset: typeof sourceRaw.endOffset === "number" ? Math.max(0, sourceRaw.endOffset) : undefined,
      quote,
      summary: text(sourceRaw.summary) || "Evidence from the source paragraph.",
      confidence: numberInRange(sourceRaw.confidence, 0.75, 0, 1)
    },
    keywords: stringArray(raw.keywords).slice(0, 8)
  };
}

function normalizeCharacterDimension(input: unknown): NovelCharacterDimensionState {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const direction = characterDirections.has(raw.direction as NovelCharacterDimensionState["direction"])
    ? (raw.direction as NovelCharacterDimensionState["direction"])
    : "unknown";
  return {
    summary: text(raw.summary) || "No evidence-backed change was extracted.",
    direction,
    intensity: numberInRange(raw.intensity, direction === "unknown" ? 0 : 35, 0, 100)
  };
}

export function normalizeNovelCharacterStatePoints(input: unknown): NovelCharacterStatePoint[] {
  return (Array.isArray(input) ? input : []).map((item, index) => {
    const raw = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const dimensionsRaw = (raw.dimensions && typeof raw.dimensions === "object" ? raw.dimensions : {}) as Record<string, unknown>;
    const chapterId = text(raw.chapterId);
    const characterEntityId = text(raw.characterEntityId);
    return {
      id: text(raw.id) || stableId("character-state", `${characterEntityId}-${chapterId}`, index),
      characterEntityId,
      chapterId,
      chapterOrder: Math.max(1, Math.floor(numberInRange(raw.chapterOrder, index + 1, 1, 100000))),
      summary: text(raw.summary) || "Character state changed within the analyzed chapter.",
      dimensions: {
        goal: normalizeCharacterDimension(dimensionsRaw.goal),
        belief: normalizeCharacterDimension(dimensionsRaw.belief),
        relationships: normalizeCharacterDimension(dimensionsRaw.relationships),
        bodyCapability: normalizeCharacterDimension(dimensionsRaw.bodyCapability),
        socialPosition: normalizeCharacterDimension(dimensionsRaw.socialPosition)
      },
      evidence: evidenceArray(raw.evidence),
      uncertainty: numberInRange(raw.uncertainty, 0.35, 0, 1)
    };
  });
}

function normalizeNovelThemeDefinition(input: unknown, index = 0): NovelThemeDefinition {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const name = text(raw.name) || `Theme ${index + 1}`;
  return {
    id: text(raw.id) || stableId("theme", name, index),
    name,
    category: themeCategories.has(raw.category as NovelThemeCategory) ? (raw.category as NovelThemeCategory) : "valueBelief",
    aliases: unique(stringArray(raw.aliases)).slice(0, 8),
    status: themeStatuses.has(raw.status as NovelThemeStatus) ? (raw.status as NovelThemeStatus) : "pending",
    description: text(raw.description) || "Evidence-backed recurring pressure in the analyzed text."
  };
}

export function createDefaultNovelThemeDefinitions(): NovelThemeDefinition[] {
  return [
    { id: "theme-personal-will", name: "Personal will", category: "personalWill", aliases: ["choice", "resolve"], status: "confirmed", description: "Pressure on an individual's goal, resolve, and capacity to choose." },
    { id: "theme-value-belief", name: "Values and belief", category: "valueBelief", aliases: ["faith", "principle"], status: "confirmed", description: "Pressure on what characters believe, justify, or reject." },
    { id: "theme-relationship-emotion", name: "Relationships and emotion", category: "relationshipEmotion", aliases: ["friendship", "love", "family"], status: "confirmed", description: "Pressure created by loyalty, intimacy, affection, debt, or betrayal." },
    { id: "theme-institution-organization", name: "Institution and organization", category: "institutionOrganization", aliases: ["order", "discipline", "faction"], status: "confirmed", description: "Pressure from groups, rules, institutions, organizations, and collective demands." },
    { id: "theme-material-survival", name: "Material survival", category: "materialSurvival", aliases: ["poverty", "work", "food", "danger"], status: "confirmed", description: "Pressure from labor, poverty, resources, violence, or survival conditions." },
    { id: "theme-body-capability", name: "Body and capability", category: "bodyCapability", aliases: ["illness", "injury", "skill"], status: "confirmed", description: "Pressure from health, injury, fatigue, skill, training, and physical limits." }
  ];
}

export function normalizeNovelThemeRegistry(input: unknown): NovelThemeDefinition[] {
  const defaults = createDefaultNovelThemeDefinitions();
  const byId = new Map(defaults.map((theme) => [theme.id, theme]));
  for (const theme of (Array.isArray(input) ? input : []).map(normalizeNovelThemeDefinition)) {
    const existing = byId.get(theme.id);
    byId.set(theme.id, existing ? { ...existing, ...theme, aliases: unique([...existing.aliases, ...theme.aliases]) } : theme);
  }
  return Array.from(byId.values());
}

export function normalizeNovelThemeSignals(input: unknown, registry: NovelThemeDefinition[] = createDefaultNovelThemeDefinitions()): NovelThemeSignal[] {
  const themesByName = new Map(registry.flatMap((theme) => [theme.name, ...theme.aliases].map((label) => [stableSlug(label), theme.id] as const)));
  return (Array.isArray(input) ? input : []).map((item, index) => {
    const raw = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const rawThemeId = text(raw.themeId);
    const themeId = rawThemeId || themesByName.get(stableSlug(text(raw.themeName) || text(raw.name))) || registry[index % Math.max(registry.length, 1)]?.id || "theme-value-belief";
    const chapterId = text(raw.chapterId);
    return {
      id: text(raw.id) || stableId("theme-signal", `${themeId}-${chapterId}`, index),
      themeId,
      chapterId,
      chapterOrder: Math.max(1, Math.floor(numberInRange(raw.chapterOrder, index + 1, 1, 100000))),
      direction: themeDirections.has(raw.direction as NovelThemePressureDirection) ? (raw.direction as NovelThemePressureDirection) : "unclear",
      intensity: numberInRange(raw.intensity, 35, 0, 100),
      summary: text(raw.summary) || "A chapter-local theme pressure signal was extracted from paragraph evidence.",
      uncertainty: numberInRange(raw.uncertainty, 0.35, 0, 1),
      relatedCharacterIds: unique(stringArray(raw.relatedCharacterIds)),
      relatedEventIds: unique(stringArray(raw.relatedEventIds)),
      relatedFactionIds: unique(stringArray(raw.relatedFactionIds)),
      competingInterpretations: stringArray(raw.competingInterpretations).slice(0, 4),
      evidence: evidenceArray(raw.evidence)
    };
  });
}

function nowIso() {
  return new Date().toISOString();
}

function emptyMergeReport(): NovelWorldMergeReport {
  return {
    valid: true,
    chapterCount: 0,
    analyzedChapterCount: 0,
    addedEntityIds: [],
    mergedEntityIds: [],
    changedEntityIds: [],
    changes: [],
    conflicts: []
  };
}

export function normalizeNovelWorldGraph(input: unknown): NovelWorldGraph {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const rawEntities = Array.isArray(raw.entities) ? raw.entities : [];
  const entities: NovelEntity[] = rawEntities.map((item, index) => {
    const source = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const name = text(source.name) || `Unnamed entity ${index + 1}`;
    const kind = entityKinds.has(source.kind as NovelEntityKind) ? (source.kind as NovelEntityKind) : "concept";
    return {
      id: text(source.id) || stableId(kind, name, index),
      kind,
      name,
      role: text(source.role) || kind,
      summary: text(source.summary) || "No clear description extracted yet.",
      traits: stringArray(source.traits).slice(0, 8),
      x: typeof source.x === "number" ? numberInRange(source.x, 0, 0, 100) : undefined,
      y: typeof source.y === "number" ? numberInRange(source.y, 0, 0, 100) : undefined,
      tension: typeof source.tension === "number" ? numberInRange(source.tension, 0, 0, 100) : undefined,
      sourceChapterIds: stringArray(source.sourceChapterIds),
      firstSeenChapterId: text(source.firstSeenChapterId) || undefined,
      lastUpdatedChapterId: text(source.lastUpdatedChapterId) || undefined,
      evidence: evidenceArray(source.evidence)
    };
  });

  const relationships: NovelRelationship[] = (Array.isArray(raw.relationships) ? raw.relationships : []).map((item, index) => {
    const source = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    return {
      id: text(source.id) || `rel-${index + 1}`,
      fromEntityId: text(source.fromEntityId),
      toEntityId: text(source.toEntityId),
      label: text(source.label) || "Unclear relationship",
      polarity: polarities.has(source.polarity as NovelRelationship["polarity"]) ? (source.polarity as NovelRelationship["polarity"]) : "neutral",
      evidence: text(source.evidence) || "Inferred from local textual context.",
      strength: numberInRange(source.strength, 50, 0, 100),
      sourceChapterIds: stringArray(source.sourceChapterIds),
      firstSeenChapterId: text(source.firstSeenChapterId) || undefined,
      lastUpdatedChapterId: text(source.lastUpdatedChapterId) || undefined,
      evidenceSnippets: evidenceArray(source.evidenceSnippets || source.evidence)
    };
  });

  const events: NovelEvent[] = (Array.isArray(raw.events) ? raw.events : []).map((item, index) => {
    const source = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    return {
      id: text(source.id) || `event-${index + 1}`,
      order: typeof source.order === "number" ? source.order : index + 1,
      timeLabel: text(source.timeLabel) || `Fragment ${index + 1}`,
      title: text(source.title) || `Event ${index + 1}`,
      summary: text(source.summary) || "A key event from the text.",
      locationEntityId: text(source.locationEntityId) || undefined,
      participantEntityIds: stringArray(source.participantEntityIds),
      causes: stringArray(source.causes).slice(0, 5),
      consequences: stringArray(source.consequences).slice(0, 5),
      publicKnowledge: typeof source.publicKnowledge === "boolean" ? source.publicKnowledge : true,
      sourceChapterId: text(source.sourceChapterId) || undefined,
      evidence: evidenceArray(source.evidence)
    };
  }).sort((a, b) => a.order - b.order);

  const development: NovelWorldDevelopmentStep[] = (Array.isArray(raw.development) ? raw.development : []).map((item, index) => {
    const source = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    return {
      id: text(source.id) || `development-${index + 1}`,
      title: text(source.title) || `Development ${index + 1}`,
      trigger: text(source.trigger) || "Current tension continues to escalate.",
      likelyOutcome: text(source.likelyOutcome) || "The world line moves into a new conflict phase.",
      involvedEntityIds: stringArray(source.involvedEntityIds),
      tension: numberInRange(source.tension, 50, 0, 100),
      unresolvedQuestion: text(source.unresolvedQuestion) || "The later text has not answered this yet.",
      sourceChapterIds: stringArray(source.sourceChapterIds),
      evidence: evidenceArray(source.evidence)
    };
  });

  return {
    id: text(raw.id) || "novel-world-graph",
    title: text(raw.title) || "Untitled novel world",
    genreTone: text(raw.genreTone) || "Unspecified",
    premise: text(raw.premise) || "A world graph extracted from the input text.",
    observerBrief: text(raw.observerBrief) || "Observe how people, places, relationships, and events move the world forward.",
    entities,
    relationships,
    events,
    development,
    warnings: stringArray(raw.warnings)
  };
}

export function validateNovelWorldGraph(graph: NovelWorldGraph): NovelWorldValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [...graph.warnings];
  const entityIds = new Set<string>();
  const relationshipIds = new Set<string>();
  const eventIds = new Set<string>();

  if (!graph.title.trim()) errors.push("title is required.");
  if (graph.entities.length < 2) errors.push("at least two entities are required.");
  if (!graph.entities.some((entity) => entity.kind === "character")) errors.push("at least one character entity is required.");
  if (!graph.entities.some((entity) => entity.kind === "location")) warnings.push("no location entity was extracted.");
  if (!graph.events.length) errors.push("at least one event is required.");

  for (const entity of graph.entities) {
    if (!entity.id.trim()) errors.push("entity id is required.");
    if (entityIds.has(entity.id)) errors.push(`duplicate entity id: ${entity.id}`);
    entityIds.add(entity.id);
    if (!entity.name.trim()) errors.push(`entity ${entity.id} is missing a name.`);
  }

  for (const relationship of graph.relationships) {
    if (relationshipIds.has(relationship.id)) errors.push(`duplicate relationship id: ${relationship.id}`);
    relationshipIds.add(relationship.id);
    if (!entityIds.has(relationship.fromEntityId)) errors.push(`relationship ${relationship.id} has unknown fromEntityId: ${relationship.fromEntityId}`);
    if (!entityIds.has(relationship.toEntityId)) errors.push(`relationship ${relationship.id} has unknown toEntityId: ${relationship.toEntityId}`);
    if (relationship.fromEntityId === relationship.toEntityId) warnings.push(`relationship ${relationship.id} points to the same entity.`);
  }

  for (const event of graph.events) {
    if (eventIds.has(event.id)) errors.push(`duplicate event id: ${event.id}`);
    eventIds.add(event.id);
    if (event.locationEntityId && !entityIds.has(event.locationEntityId)) errors.push(`event ${event.id} has unknown locationEntityId: ${event.locationEntityId}`);
    for (const participantId of event.participantEntityIds) {
      if (!entityIds.has(participantId)) errors.push(`event ${event.id} has unknown participantEntityId: ${participantId}`);
    }
  }

  for (const step of graph.development) {
    for (const entityId of step.involvedEntityIds) {
      if (!entityIds.has(entityId)) errors.push(`development ${step.id} has unknown involvedEntityId: ${entityId}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function splitNovelChapterParagraphs(chapterId: string, rawText: string): NovelParagraph[] {
  const paragraphs: NovelParagraph[] = [];
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const pattern = /[^\n]+(?:\n(?!\s*\n)[^\n]+)*/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(normalized))) {
    const value = match[0].trim();
    if (!value) continue;
    paragraphs.push({
      id: `${chapterId}-p-${paragraphs.length + 1}`,
      chapterId,
      order: paragraphs.length + 1,
      text: value,
      charStart: match.index,
      charEnd: match.index + match[0].length
    });
  }
  if (!paragraphs.length && normalized.trim()) {
    paragraphs.push({ id: `${chapterId}-p-1`, chapterId, order: 1, text: normalized.trim(), charStart: 0, charEnd: normalized.length });
  }
  return paragraphs;
}

export function createNovelLongChapterText(input: { chapterId: string; order: number; title: string; rawText: string; updatedAt?: string }): NovelLongChapterText {
  return {
    chapterId: input.chapterId,
    order: input.order,
    title: input.title,
    rawText: input.rawText,
    paragraphs: splitNovelChapterParagraphs(input.chapterId, input.rawText),
    updatedAt: input.updatedAt || nowIso()
  };
}

export function splitWholeNovelIntoChapterCandidates(input: { title?: string; sourceNote?: string; rawText: string }): NovelWholeBookImportDraft {
  const rawText = text(input.rawText);
  const warnings: string[] = [];
  const headingPattern = /(^|\n)\s*((?:第\s*[一二三四五六七八九十百千万零〇两\d]+\s*[章节回部卷][^\n]{0,36})|(?:[一二三四五六七八九十百千万零〇两\d]{1,4}\s*[、.．]\s*[^\n]{0,36})|(?:chapter\s+\d+[^\n]{0,36}))\s*(?=\n|$)/gi;
  const matches = Array.from(rawText.matchAll(headingPattern))
    .map((match) => ({ index: match.index ?? 0, title: text(match[2]).replace(/\s+/g, " ") }))
    .filter((match) => match.title);
  const candidates: NovelChapterImportCandidate[] = [];
  if (matches.length >= 2) {
    for (const [index, match] of matches.entries()) {
      const sourceStart = match.index;
      const sourceEnd = matches[index + 1]?.index ?? rawText.length;
      const body = rawText.slice(sourceStart, sourceEnd).trim();
      if (!body) continue;
      candidates.push({
        id: stableId("import-chapter", `${match.title}-${body.slice(0, 24)}`, index),
        order: candidates.length + 1,
        title: match.title || `Chapter ${candidates.length + 1}`,
        rawText: body,
        sourceStart,
        sourceEnd
      });
    }
  } else {
    warnings.push("Fewer than two reliable chapter headings were detected; candidates were generated by length.");
    candidates.push(...fallbackChapterSlices(rawText));
  }
  if (candidates.length < 2 && rawText) warnings.push("Only one import candidate was produced; review the preview before importing.");
  const createdAt = nowIso();
  return {
    id: `import-draft-${createdAt}`,
    title: text(input.title) || "Untitled whole book",
    sourceNote: text(input.sourceNote) || "User-pasted local text. Show only short excerpts in analysis.",
    rawTextLength: rawText.length,
    candidates,
    warnings,
    createdAt,
    updatedAt: createdAt
  };
}

export function normalizeNovelImportDraft(input: unknown): NovelWholeBookImportDraft {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const candidates = Array.isArray(raw.candidates)
    ? raw.candidates.map((item, index) => normalizeImportCandidate(item, index)).sort((a, b) => a.order - b.order)
    : [];
  const createdAt = text(raw.createdAt) || nowIso();
  return {
    id: text(raw.id) || `import-draft-${createdAt}`,
    title: text(raw.title) || "Untitled whole book",
    sourceNote: text(raw.sourceNote) || "User-pasted local text. Show only short excerpts in analysis.",
    rawTextLength: Math.max(0, Math.floor(typeof raw.rawTextLength === "number" ? raw.rawTextLength : candidates.reduce((sum, item) => sum + item.rawText.length, 0))),
    candidates,
    warnings: stringArray(raw.warnings),
    createdAt,
    updatedAt: text(raw.updatedAt) || createdAt
  };
}

export function validateNovelImportDraft(draft: NovelWholeBookImportDraft): NovelImportValidationReport {
  const errors: string[] = [];
  const warnings = [...draft.warnings];
  if (!draft.title.trim()) errors.push("book title is required.");
  if (!draft.candidates.length) errors.push("at least one chapter candidate is required.");
  const ids = new Set<string>();
  const orders = new Set<number>();
  for (const candidate of draft.candidates) {
    if (ids.has(candidate.id)) errors.push(`duplicate candidate id ${candidate.id}.`);
    ids.add(candidate.id);
    if (orders.has(candidate.order)) warnings.push(`duplicate candidate order ${candidate.order}; commit will re-order sequentially.`);
    orders.add(candidate.order);
    if (!candidate.title.trim()) errors.push(`candidate ${candidate.id} is missing a title.`);
    if (!candidate.rawText.trim()) errors.push(`candidate ${candidate.id} is missing text.`);
    if (candidate.rawText.trim().length < 80) warnings.push(`candidate ${candidate.title} is very short and may need merging.`);
    if (candidate.warning) warnings.push(candidate.warning);
  }
  return { valid: errors.length === 0, errors, warnings: unique(warnings) };
}

export function commitNovelImportDraftToProject(
  draftInput: NovelWholeBookImportDraft,
  input: { genreTone?: string; projectId?: string } = {}
): { project: NovelWorldProject; chapters: NovelLongChapterText[]; queue: NovelBatchQueueState; validation: NovelImportValidationReport } {
  const draft = normalizeNovelImportDraft(draftInput);
  const validation = validateNovelImportDraft(draft);
  const project = createNovelWorldProject({ id: input.projectId, title: draft.title, genreTone: input.genreTone || "Imported long novel" });
  let nextProject = project;
  const chapters: NovelLongChapterText[] = [];
  for (const [index, candidate] of draft.candidates.slice().sort((a, b) => a.order - b.order).entries()) {
    const order = index + 1;
    const chapterId = stableId("chapter", `${draft.title}-${candidate.title}-${order}`, index);
    const title = candidate.title || `Chapter ${order}`;
    const chapterText = createNovelLongChapterText({ chapterId, order, title, rawText: candidate.rawText });
    chapters.push(chapterText);
    nextProject = addNovelChapterAnalysis(nextProject, {
      input: { id: chapterId, order, title, fragment: candidate.rawText, genreTone: input.genreTone || nextProject.genreTone },
      status: "draft"
    });
  }
  return { project: nextProject, chapters, queue: createNovelBatchQueue(nextProject, 3), validation };
}

export function createNovelBatchQueue(project: NovelWorldProject, batchSize: 3 | 5 | 10 = 3): NovelBatchQueueState {
  const chapterStatuses: Record<string, NovelBatchChapterStatus> = {};
  for (const chapter of project.chapters) {
    if (chapter.status === "ready") chapterStatuses[chapter.input.id] = "ready";
    else if (chapter.status === "error") chapterStatuses[chapter.input.id] = "error";
    else chapterStatuses[chapter.input.id] = "queued";
  }
  return { batchSize, paused: false, running: false, chapterStatuses, lastBatchChapterIds: [], updatedAt: nowIso() };
}

export function normalizeNovelBatchQueue(project: NovelWorldProject, input?: Partial<NovelBatchQueueState> | null): NovelBatchQueueState {
  const batchSize = input?.batchSize === 5 || input?.batchSize === 10 ? input.batchSize : 3;
  const base = createNovelBatchQueue(project, batchSize);
  return {
    batchSize,
    paused: Boolean(input?.paused),
    running: Boolean(input?.running),
    chapterStatuses: { ...base.chapterStatuses, ...(input?.chapterStatuses || {}) },
    lastBatchChapterIds: Array.isArray(input?.lastBatchChapterIds) ? input.lastBatchChapterIds.filter((id) => project.chapters.some((chapter) => chapter.input.id === id)) : [],
    updatedAt: text(input?.updatedAt) || nowIso()
  };
}

export function updateNovelBatchChapterStatus(queue: NovelBatchQueueState, chapterId: string, status: NovelBatchChapterStatus): NovelBatchQueueState {
  return { ...queue, chapterStatuses: { ...queue.chapterStatuses, [chapterId]: status }, updatedAt: nowIso() };
}

export function getNextNovelBatchChapterIds(project: NovelWorldProject, queue: NovelBatchQueueState): string[] {
  if (queue.paused || queue.running) return [];
  return project.chapters
    .slice()
    .sort((a, b) => a.input.order - b.input.order)
    .filter((chapter) => {
      const status = queue.chapterStatuses[chapter.input.id] || (chapter.status === "ready" ? "ready" : "queued");
      return status === "queued" || status === "error";
    })
    .slice(0, queue.batchSize)
    .map((chapter) => chapter.input.id);
}

export function createFallbackEvidenceIndex(chapter: NovelLongChapterText): NovelEvidenceIndex {
  const snippets = chapter.paragraphs.slice(0, 24).map((paragraph, index) => {
    const quote = clampQuote(paragraph.text);
    return normalizeEvidenceSnippet({
      id: `evidence-${paragraph.id}`,
      source: {
        chapterId: chapter.chapterId,
        paragraphId: paragraph.id,
        startOffset: 0,
        endOffset: Math.min(paragraph.text.length, quote.length),
        quote,
        summary: paragraph.text.length > quote.length ? "Long paragraph summarized as a local evidence candidate." : "Paragraph-level source evidence.",
        confidence: 0.72
      },
      keywords: paragraph.text
        .replace(/[^\p{L}\p{N}\u4e00-\u9fa5]+/gu, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 2)
        .slice(0, 6)
    }, index);
  });
  return {
    chapterId: chapter.chapterId,
    paragraphCount: chapter.paragraphs.length,
    snippets,
    warnings: chapter.paragraphs.length > snippets.length ? ["Only the first 24 paragraphs are indexed in fallback mode."] : []
  };
}

export function validateEvidenceSnippets(snippets: NovelEvidenceSnippet[], chapters: NovelLongChapterText[]): NovelWorldValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const paragraphs = new Map<string, NovelParagraph>();
  for (const chapter of chapters) {
    for (const paragraph of chapter.paragraphs) paragraphs.set(`${chapter.chapterId}:${paragraph.id}`, paragraph);
  }
  for (const snippet of snippets) {
    if (!snippet.source.chapterId) errors.push(`evidence ${snippet.id} is missing chapterId.`);
    if (!snippet.source.paragraphId) errors.push(`evidence ${snippet.id} is missing paragraphId.`);
    const paragraph = paragraphs.get(`${snippet.source.chapterId}:${snippet.source.paragraphId}`);
    if (!paragraph) {
      errors.push(`evidence ${snippet.id} references unknown paragraph ${snippet.source.chapterId}/${snippet.source.paragraphId}.`);
      continue;
    }
    if (!snippet.source.quote.trim()) errors.push(`evidence ${snippet.id} is missing a quote.`);
    if (snippet.source.quote.length > novelEvidenceQuoteLimit) errors.push(`evidence ${snippet.id} quote exceeds ${novelEvidenceQuoteLimit} characters.`);
    if (snippet.source.quote && !paragraph.text.includes(snippet.source.quote.replace(/\.\.\.$/, ""))) {
      warnings.push(`evidence ${snippet.id} quote is not an exact paragraph substring.`);
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function collectGraphEvidence(graph: NovelWorldGraph): NovelEvidenceSnippet[] {
  return [
    ...graph.entities.flatMap((entity) => entity.evidence || []),
    ...graph.relationships.flatMap((relationship) => relationship.evidenceSnippets || []),
    ...graph.events.flatMap((event) => event.evidence || []),
    ...graph.development.flatMap((step) => step.evidence || [])
  ];
}

function cloneProject(project: NovelWorldProject): NovelWorldProject {
  return JSON.parse(JSON.stringify(project)) as NovelWorldProject;
}

function normalizeCorrectionTarget(input: unknown): NovelCorrectionTarget {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const kind = text(raw.kind);
  const id = text(raw.id);
  if (kind === "evidence") {
    const ownerKind = text(raw.ownerKind);
    return {
      kind,
      id,
      ownerKind: ["entity", "relationship", "event", "development", "character-state", "theme-signal", "causal-claim"].includes(ownerKind) ? ownerKind as NovelCorrectionObjectKind : "entity",
      ownerId: text(raw.ownerId)
    };
  }
  if (["entity", "relationship", "event", "development", "character-state", "theme-signal", "causal-claim"].includes(kind)) {
    return { kind: kind as NovelCorrectionObjectKind, id } as NovelCorrectionTarget;
  }
  return { kind: "entity", id };
}

function normalizeCorrectionOperation(input: unknown): NovelCorrectionOperation {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const type = text(raw.type);
  if (type === "rename-entity") return { type, name: text(raw.name) };
  if (type === "merge-entities") return { type, sourceEntityId: text(raw.sourceEntityId), targetEntityId: text(raw.targetEntityId) };
  if (type === "change-entity-kind") return { type, kind: entityKinds.has(raw.kind as NovelEntityKind) ? raw.kind as NovelEntityKind : "concept" };
  if (type === "edit-entity-fields") return { type, role: text(raw.role) || undefined, summary: text(raw.summary) || undefined, traits: raw.traits === undefined ? undefined : stringArray(raw.traits) };
  if (type === "replace-evidence") return { type, evidence: evidenceArray(raw.evidence) };
  if (type === "add-evidence") return { type, evidence: evidenceArray(raw.evidence) };
  if (type === "remove-evidence") return { type, evidenceIds: stringArray(raw.evidenceIds) };
  if (type === "restore-object") return { type };
  return { type: "hide-object", reason: text(raw.reason) || "Rejected by manual correction." };
}

export function createNovelCorrectionSet(project: Pick<NovelWorldProject, "id">): NovelCorrectionSet {
  const at = nowIso();
  return { version: 1, projectId: project.id, patches: [], createdAt: at, updatedAt: at };
}

export function normalizeNovelCorrectionPatch(input: unknown, index = 0): NovelCorrectionPatch {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const at = text(raw.createdAt) || nowIso();
  const status = ["suggested", "applied", "dismissed", "reverted"].includes(text(raw.status)) ? text(raw.status) as NovelCorrectionPatch["status"] : "suggested";
  return {
    id: text(raw.id) || stableId("correction", `${JSON.stringify(raw.target || {})}-${JSON.stringify(raw.operation || {})}`, index),
    target: normalizeCorrectionTarget(raw.target),
    operation: normalizeCorrectionOperation(raw.operation),
    status,
    reason: text(raw.reason) || "Quality audit suggestion.",
    createdAt: at,
    updatedAt: text(raw.updatedAt) || at,
    auditTrail: Array.isArray(raw.auditTrail)
      ? raw.auditTrail.map((item) => {
          const entry = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
          const action = ["created", "applied", "reverted", "dismissed"].includes(text(entry.action)) ? text(entry.action) as NovelCorrectionAuditTrail["action"] : "created";
          return { at: text(entry.at) || at, action, note: text(entry.note) || action };
        })
      : [{ at, action: "created", note: "Patch created." }]
  };
}

export function normalizeNovelCorrectionSet(input: unknown, project: Pick<NovelWorldProject, "id">): NovelCorrectionSet {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const at = text(raw.createdAt) || nowIso();
  return {
    version: 1,
    projectId: text(raw.projectId) || project.id,
    patches: Array.isArray(raw.patches) ? raw.patches.map((patch, index) => normalizeNovelCorrectionPatch(patch, index)) : [],
    createdAt: at,
    updatedAt: text(raw.updatedAt) || at
  };
}

function evidenceForTarget(project: NovelWorldProject, target: NovelCorrectionTarget): NovelEvidenceSnippet[] | undefined {
  if (target.kind === "entity") return project.mergedGraph.entities.find((item) => item.id === target.id)?.evidence;
  if (target.kind === "relationship") return project.mergedGraph.relationships.find((item) => item.id === target.id)?.evidenceSnippets;
  if (target.kind === "event") return project.mergedGraph.events.find((item) => item.id === target.id)?.evidence;
  if (target.kind === "development") return project.mergedGraph.development.find((item) => item.id === target.id)?.evidence;
  if (target.kind === "character-state") return project.chapters.flatMap((chapter) => chapter.characterStates || []).find((item) => item.id === target.id)?.evidence;
  if (target.kind === "theme-signal") return project.chapters.flatMap((chapter) => chapter.themeSignals || []).find((item) => item.id === target.id)?.evidence;
  return undefined;
}

function setEvidenceForTarget(project: NovelWorldProject, target: NovelCorrectionTarget, updater: (evidence: NovelEvidenceSnippet[]) => NovelEvidenceSnippet[]) {
  const update = (current?: NovelEvidenceSnippet[]) => updater(current || []);
  if (target.kind === "entity") project.mergedGraph.entities = project.mergedGraph.entities.map((item) => item.id === target.id ? { ...item, evidence: update(item.evidence) } : item);
  if (target.kind === "relationship") project.mergedGraph.relationships = project.mergedGraph.relationships.map((item) => item.id === target.id ? { ...item, evidenceSnippets: update(item.evidenceSnippets) } : item);
  if (target.kind === "event") project.mergedGraph.events = project.mergedGraph.events.map((item) => item.id === target.id ? { ...item, evidence: update(item.evidence) } : item);
  if (target.kind === "development") project.mergedGraph.development = project.mergedGraph.development.map((item) => item.id === target.id ? { ...item, evidence: update(item.evidence) } : item);
  project.chapters = project.chapters.map((chapter) => ({
    ...chapter,
    characterStates: (chapter.characterStates || []).map((item) => target.kind === "character-state" && item.id === target.id ? { ...item, evidence: update(item.evidence) } : item),
    themeSignals: (chapter.themeSignals || []).map((item) => target.kind === "theme-signal" && item.id === target.id ? { ...item, evidence: update(item.evidence) } : item)
  }));
}

function remapEntityRefs(project: NovelWorldProject, sourceId: string, targetId: string) {
  const mapId = (id: string) => id === sourceId ? targetId : id;
  project.mergedGraph.relationships = project.mergedGraph.relationships
    .map((relationship) => ({ ...relationship, fromEntityId: mapId(relationship.fromEntityId), toEntityId: mapId(relationship.toEntityId) }))
    .filter((relationship) => relationship.fromEntityId !== relationship.toEntityId);
  project.mergedGraph.events = project.mergedGraph.events.map((event) => ({
    ...event,
    locationEntityId: event.locationEntityId ? mapId(event.locationEntityId) : undefined,
    participantEntityIds: unique(event.participantEntityIds.map(mapId))
  }));
  project.mergedGraph.development = project.mergedGraph.development.map((step) => ({ ...step, involvedEntityIds: unique(step.involvedEntityIds.map(mapId)) }));
  project.chapters = project.chapters.map((chapter) => ({
    ...chapter,
    characterStates: (chapter.characterStates || []).map((point) => ({ ...point, characterEntityId: mapId(point.characterEntityId) })),
    themeSignals: (chapter.themeSignals || []).map((signal) => ({
      ...signal,
      relatedCharacterIds: unique(signal.relatedCharacterIds.map(mapId)),
      relatedFactionIds: unique(signal.relatedFactionIds.map(mapId))
    }))
  }));
}

export function applyNovelCorrectionOverlay(project: NovelWorldProject, correctionSet?: NovelCorrectionSet | null): NovelWorldProject {
  const corrected = cloneProject(project);
  const applied = (correctionSet?.patches || []).filter((patch) => patch.status === "applied");
  const hidden = new Map<string, Set<string>>();
  const hide = (kind: string, id: string) => hidden.set(kind, new Set([...(hidden.get(kind) || []), id]));
  const isHidden = (kind: string, id: string) => hidden.get(kind)?.has(id);

  for (const patch of applied) {
    const op = patch.operation;
    if (op.type === "hide-object") hide(patch.target.kind, patch.target.id);
    if (op.type === "restore-object") hidden.get(patch.target.kind)?.delete(patch.target.id);
    if (patch.target.kind === "entity") {
      if (op.type === "rename-entity") corrected.mergedGraph.entities = corrected.mergedGraph.entities.map((entity) => entity.id === patch.target.id ? { ...entity, name: op.name || entity.name } : entity);
      if (op.type === "change-entity-kind") corrected.mergedGraph.entities = corrected.mergedGraph.entities.map((entity) => entity.id === patch.target.id ? { ...entity, kind: op.kind } : entity);
      if (op.type === "edit-entity-fields") corrected.mergedGraph.entities = corrected.mergedGraph.entities.map((entity) => entity.id === patch.target.id ? { ...entity, role: op.role ?? entity.role, summary: op.summary ?? entity.summary, traits: op.traits ?? entity.traits } : entity);
    }
    if (op.type === "merge-entities" && op.sourceEntityId && op.targetEntityId && op.sourceEntityId !== op.targetEntityId) {
      const source = corrected.mergedGraph.entities.find((entity) => entity.id === op.sourceEntityId);
      corrected.mergedGraph.entities = corrected.mergedGraph.entities
        .map((entity) => entity.id === op.targetEntityId && source ? { ...entity, traits: unique([...entity.traits, ...source.traits]), evidence: [...(entity.evidence || []), ...(source.evidence || [])] } : entity)
        .filter((entity) => entity.id !== op.sourceEntityId);
      remapEntityRefs(corrected, op.sourceEntityId, op.targetEntityId);
      hide("entity", op.sourceEntityId);
    }
    if (op.type === "replace-evidence") setEvidenceForTarget(corrected, patch.target, () => op.evidence);
    if (op.type === "add-evidence") setEvidenceForTarget(corrected, patch.target, (evidence) => [...evidence, ...op.evidence]);
    if (op.type === "remove-evidence") setEvidenceForTarget(corrected, patch.target, (evidence) => evidence.filter((item) => !op.evidenceIds.includes(item.id)));
  }

  corrected.mergedGraph.entities = corrected.mergedGraph.entities.filter((item) => !isHidden("entity", item.id));
  corrected.mergedGraph.relationships = corrected.mergedGraph.relationships.filter((item) => !isHidden("relationship", item.id));
  corrected.mergedGraph.events = corrected.mergedGraph.events.filter((item) => !isHidden("event", item.id));
  corrected.mergedGraph.development = corrected.mergedGraph.development.filter((item) => !isHidden("development", item.id));
  corrected.chapters = corrected.chapters.map((chapter) => ({
    ...chapter,
    characterStates: (chapter.characterStates || []).filter((item) => !isHidden("character-state", item.id)),
    themeSignals: (chapter.themeSignals || []).filter((item) => !isHidden("theme-signal", item.id))
  }));
  return corrected;
}

export function revertNovelCorrectionPatch(correctionSet: NovelCorrectionSet, patchId: string): NovelCorrectionSet {
  const at = nowIso();
  return {
    ...correctionSet,
    patches: correctionSet.patches.map((patch) => patch.id === patchId ? { ...patch, status: "reverted", updatedAt: at, auditTrail: [...patch.auditTrail, { at, action: "reverted", note: "Patch reverted." }] } : patch),
    updatedAt: at
  };
}

function targetExists(project: NovelWorldProject, target: NovelCorrectionTarget) {
  if (target.kind === "entity") return project.mergedGraph.entities.some((item) => item.id === target.id);
  if (target.kind === "relationship") return project.mergedGraph.relationships.some((item) => item.id === target.id);
  if (target.kind === "event") return project.mergedGraph.events.some((item) => item.id === target.id);
  if (target.kind === "development") return project.mergedGraph.development.some((item) => item.id === target.id);
  if (target.kind === "character-state") return project.chapters.some((chapter) => (chapter.characterStates || []).some((item) => item.id === target.id));
  if (target.kind === "theme-signal") return project.chapters.some((chapter) => (chapter.themeSignals || []).some((item) => item.id === target.id));
  if (target.kind === "causal-claim") return true;
  if (target.kind === "evidence") return Boolean(evidenceForTarget(project, { kind: target.ownerKind, id: target.ownerId } as NovelCorrectionTarget)?.some((item) => item.id === target.id));
  return false;
}

export function validateNovelCorrectionSet(correctionSet: NovelCorrectionSet, project: NovelWorldProject, chapters: NovelLongChapterText[] = []): NovelWorldValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (correctionSet.version !== 1) errors.push("correction set version must be 1.");
  if (correctionSet.projectId !== project.id) errors.push("correction set projectId does not match project.");
  const ids = new Set<string>();
  for (const patch of correctionSet.patches) {
    if (ids.has(patch.id)) errors.push(`duplicate correction patch id: ${patch.id}`);
    ids.add(patch.id);
    if (!targetExists(project, patch.target) && patch.operation.type !== "merge-entities") warnings.push(`correction ${patch.id} targets a missing object ${patch.target.kind}/${patch.target.id}.`);
    if (patch.operation.type === "rename-entity" && !patch.operation.name.trim()) errors.push(`correction ${patch.id} has an empty entity name.`);
    if (patch.operation.type === "merge-entities") {
      const operation = patch.operation;
      if (!project.mergedGraph.entities.some((entity) => entity.id === operation.sourceEntityId)) errors.push(`correction ${patch.id} merge source is missing.`);
      if (!project.mergedGraph.entities.some((entity) => entity.id === operation.targetEntityId)) errors.push(`correction ${patch.id} merge target is missing.`);
    }
    const evidence = patch.operation.type === "replace-evidence" || patch.operation.type === "add-evidence" ? patch.operation.evidence : [];
    if (chapters.length && evidence.length) {
      const report = validateEvidenceSnippets(evidence, chapters);
      errors.push(...report.errors.map((error) => `correction ${patch.id}: ${error}`));
      warnings.push(...report.warnings.map((warning) => `correction ${patch.id}: ${warning}`));
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function rankNovelQualityIssues(issues: NovelQualityIssue[]): NovelQualityIssue[] {
  const order = { blocking: 0, high: 1, medium: 2, info: 3 };
  return issues.slice().sort((a, b) => order[a.severity] - order[b.severity] || a.category.localeCompare(b.category));
}

export function createSuggestedNovelCorrectionPatches(project: NovelWorldProject, issues: NovelQualityIssue[]): NovelCorrectionPatch[] {
  const at = nowIso();
  return issues.filter((issue) => issue.target).slice(0, 12).map((issue, index) => {
    const operation: NovelCorrectionOperation = issue.category === "entity" && issue.target?.kind === "entity"
      ? { type: "edit-entity-fields", summary: `Needs manual review: ${issue.detail}` }
      : { type: "hide-object", reason: issue.detail };
    return {
      id: `suggested-${stableSlug(issue.id)}-${index + 1}`,
      target: issue.target!,
      operation,
      status: "suggested",
      reason: issue.title,
      createdAt: at,
      updatedAt: at,
      auditTrail: [{ at, action: "created", note: `Suggested by quality audit for ${project.title}.` }]
    };
  });
}

export function buildNovelQualityAuditReport(project: NovelWorldProject, correctionSet?: NovelCorrectionSet | null, chapters: NovelLongChapterText[] = []): NovelQualityAuditReport {
  const issues: NovelQualityIssue[] = [];
  const graph = project.mergedGraph;
  const entityIds = new Set(graph.entities.map((entity) => entity.id));
  const eventIds = new Set(graph.events.map((event) => event.id));
  const evidenceItems = [
    ...graph.entities.map((item) => ({ kind: "entity" as const, id: item.id, label: item.name, evidence: item.evidence || [] })),
    ...graph.relationships.map((item) => ({ kind: "relationship" as const, id: item.id, label: item.label, evidence: item.evidenceSnippets || [] })),
    ...graph.events.map((item) => ({ kind: "event" as const, id: item.id, label: item.title, evidence: item.evidence || [] })),
    ...graph.development.map((item) => ({ kind: "development" as const, id: item.id, label: item.title, evidence: item.evidence || [] })),
    ...project.chapters.flatMap((chapter) => (chapter.characterStates || []).map((item) => ({ kind: "character-state" as const, id: item.id, label: item.summary, evidence: item.evidence }))),
    ...project.chapters.flatMap((chapter) => (chapter.themeSignals || []).map((item) => ({ kind: "theme-signal" as const, id: item.id, label: item.summary, evidence: item.evidence })))
  ];
  for (const item of evidenceItems) {
    if (!item.evidence.length) issues.push({ id: `missing-evidence-${item.kind}-${item.id}`, severity: item.kind === "entity" ? "medium" : "high", category: "evidence", target: { kind: item.kind, id: item.id } as NovelCorrectionTarget, title: "Missing evidence", detail: `${item.label} has no paragraph evidence.` });
  }
  for (const relationship of graph.relationships) {
    if (!entityIds.has(relationship.fromEntityId) || !entityIds.has(relationship.toEntityId)) issues.push({ id: `dangling-relationship-${relationship.id}`, severity: "blocking", category: "relationship", target: { kind: "relationship", id: relationship.id }, title: "Dangling relationship reference", detail: `${relationship.label} references a missing entity.` });
  }
  for (const event of graph.events) {
    const missing = [event.locationEntityId, ...event.participantEntityIds].filter((id): id is string => typeof id === "string" && id.length > 0 && !entityIds.has(id));
    if (missing.length) issues.push({ id: `dangling-event-${event.id}`, severity: "blocking", category: "event", target: { kind: "event", id: event.id }, title: "Dangling event reference", detail: `${event.title} references missing object(s): ${missing.join(", ")}.` });
  }
  const entitiesByName = new Map<string, NovelEntity[]>();
  for (const entity of graph.entities) {
    const key = `${entity.kind}:${entity.name.toLowerCase()}`;
    entitiesByName.set(key, [...(entitiesByName.get(key) || []), entity]);
  }
  for (const [name, entities] of entitiesByName) {
    if (entities.length > 1) {
      const [first, second] = entities;
      if (first && second) issues.push({ id: `duplicate-entity-${stableSlug(name)}`, severity: "medium", category: "entity", target: { kind: "entity", id: second.id }, title: "Possible duplicate entity", detail: `${first.name} appears more than once as ${first.kind}.` });
    }
  }
  for (const conflict of project.mergeReport.conflicts) {
    issues.push({ id: `merge-conflict-${conflict.id}`, severity: "high", category: "conflict", target: { kind: conflict.kind, id: conflict.targetId } as NovelCorrectionTarget, title: "Unresolved merge conflict", detail: conflict.message });
  }
  const uncertaintyItems = [
    ...project.chapters.flatMap((chapter) => (chapter.characterStates || []).map((item) => ({ kind: "character-state" as const, id: item.id, value: item.uncertainty, label: item.summary }))),
    ...project.chapters.flatMap((chapter) => (chapter.themeSignals || []).map((item) => ({ kind: "theme-signal" as const, id: item.id, value: item.uncertainty, label: item.summary })))
  ];
  for (const item of uncertaintyItems.filter((item) => item.value >= 0.45)) {
    issues.push({ id: `low-confidence-${item.kind}-${item.id}`, severity: "medium", category: item.kind === "theme-signal" ? "theme" : "character", target: { kind: item.kind, id: item.id }, title: "Low confidence extraction", detail: `${item.label} has high uncertainty (${Math.round(item.value * 100)}%).` });
  }
  const evidenceReport = chapters.length ? validateEvidenceSnippets(evidenceItems.flatMap((item) => item.evidence), chapters) : { valid: true, errors: [], warnings: [] };
  for (const [index, error] of evidenceReport.errors.entries()) issues.push({ id: `evidence-ref-${index + 1}`, severity: "blocking", category: "evidence", title: "Invalid evidence reference", detail: error });
  const applied = correctionSet?.patches.filter((patch) => patch.status === "applied").length || 0;
  const pending = correctionSet?.patches.filter((patch) => patch.status === "suggested").length || 0;
  const evidenceCoverage = evidenceItems.length ? Math.round((evidenceItems.filter((item) => item.evidence.length).length / evidenceItems.length) * 100) : 100;
  const referenceIntegrity = Math.max(0, 100 - issues.filter((issue) => issue.severity === "blocking").length * 18);
  const unresolvedConflicts = Math.max(0, 100 - project.mergeReport.conflicts.length * 18);
  const confidence = uncertaintyItems.length ? Math.round((1 - uncertaintyItems.reduce((sum, item) => sum + item.value, 0) / uncertaintyItems.length) * 100) : 100;
  const correctionCompletion = applied + pending ? Math.round((applied / (applied + pending)) * 100) : 100;
  const breakdown: NovelQualityScoreBreakdown = {
    evidenceCoverage,
    referenceIntegrity,
    unresolvedConflicts,
    confidence,
    correctionCompletion,
    total: Math.round(evidenceCoverage * 0.3 + referenceIntegrity * 0.25 + unresolvedConflicts * 0.15 + confidence * 0.15 + correctionCompletion * 0.15)
  };
  const metrics: NovelQualityMetric[] = [
    { id: "evidenceCoverage", label: "Evidence coverage", score: evidenceCoverage, weight: 30, detail: `${evidenceItems.filter((item) => item.evidence.length).length}/${evidenceItems.length} objects have evidence.` },
    { id: "referenceIntegrity", label: "Reference integrity", score: referenceIntegrity, weight: 25, detail: `${issues.filter((issue) => issue.severity === "blocking").length} blocking reference issue(s).` },
    { id: "unresolvedConflicts", label: "Unresolved conflicts", score: unresolvedConflicts, weight: 15, detail: `${project.mergeReport.conflicts.length} merge conflict(s).` },
    { id: "confidence", label: "Confidence", score: confidence, weight: 15, detail: `${uncertaintyItems.filter((item) => item.value >= 0.45).length} low-confidence extraction(s).` },
    { id: "correctionCompletion", label: "Correction completion", score: correctionCompletion, weight: 15, detail: `${applied} applied / ${pending} suggested.` }
  ];
  const ranked = rankNovelQualityIssues(issues);
  const suggestedPatches = createSuggestedNovelCorrectionPatches(project, ranked);
  return { id: `quality-${project.id}`, projectId: project.id, score: breakdown.total, metrics, breakdown, issues: ranked, suggestedPatches, generatedAt: nowIso() };
}

export function validateEvidenceAwareNovelWorldGraph(graph: NovelWorldGraph, chapters: NovelLongChapterText[]): NovelWorldValidationReport {
  const graphReport = validateNovelWorldGraph(graph);
  const evidenceReport = validateEvidenceSnippets(collectGraphEvidence(graph), chapters);
  return {
    valid: graphReport.valid && evidenceReport.valid,
    errors: [...graphReport.errors, ...evidenceReport.errors],
    warnings: [...graphReport.warnings, ...evidenceReport.warnings]
  };
}

export function validateNovelCharacterStatePoints(
  points: NovelCharacterStatePoint[],
  graph: NovelWorldGraph,
  chapters: NovelLongChapterText[] = []
): NovelWorldValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const characterIds = new Set(graph.entities.filter((entity) => entity.kind === "character").map((entity) => entity.id));
  const chapterIds = new Set(chapters.map((chapter) => chapter.chapterId));
  const pointIds = new Set<string>();

  for (const point of points) {
    if (pointIds.has(point.id)) errors.push(`duplicate character state id: ${point.id}`);
    pointIds.add(point.id);
    if (!characterIds.has(point.characterEntityId)) errors.push(`character state ${point.id} references unknown character ${point.characterEntityId}.`);
    if (chapters.length && !chapterIds.has(point.chapterId)) errors.push(`character state ${point.id} references unknown chapter ${point.chapterId}.`);
    if (!point.evidence.length) {
      if (chapters.length) errors.push(`character state ${point.id} has no paragraph evidence.`);
      else warnings.push(`character state ${point.id} has no paragraph evidence.`);
    }
    for (const dimension of characterDimensions) {
      if (!point.dimensions[dimension]?.summary.trim()) errors.push(`character state ${point.id} is missing ${dimension} summary.`);
    }
  }

  if (chapters.length) {
    const evidenceReport = validateEvidenceSnippets(points.flatMap((point) => point.evidence), chapters);
    errors.push(...evidenceReport.errors);
    warnings.push(...evidenceReport.warnings);
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function createFallbackNovelCharacterStates(
  graph: NovelWorldGraph,
  chapter?: NovelLongChapterText,
  index?: NovelEvidenceIndex
): NovelCharacterStatePoint[] {
  if (!chapter) return [];
  const fallbackIndex = index || createFallbackEvidenceIndex(chapter);
  const fallbackEvidence = fallbackIndex.snippets;
  return graph.entities
    .filter((entity) => entity.kind === "character")
    .map((entity, entityIndex) => {
      const eventCount = graph.events.filter((event) => event.participantEntityIds.includes(entity.id)).length;
      const evidence = (entity.evidence || []).filter((snippet) => snippet.source.chapterId === chapter.chapterId);
      const selectedEvidence = evidence.length ? evidence : fallbackEvidence.length ? [fallbackEvidence[entityIndex % fallbackEvidence.length]] : [];
      const changeIntensity = eventCount ? Math.min(70, 35 + eventCount * 10) : 20;
      const unknown = (summary: string): NovelCharacterDimensionState => ({ summary, direction: "unknown", intensity: 0 });
      return {
        id: `character-state-${chapter.chapterId}-${entity.id}`,
        characterEntityId: entity.id,
        chapterId: chapter.chapterId,
        chapterOrder: chapter.order,
        summary: eventCount
          ? `${entity.name} participates in ${eventCount} evidenced event${eventCount === 1 ? "" : "s"}; only chapter-local movement is recorded.`
          : `${entity.name} appears in the chapter, but the text provides limited evidence of a definite change.`,
        dimensions: {
          goal: {
            summary: eventCount ? `The chapter places ${entity.name}'s immediate objective under observable pressure.` : "No definite goal change is supported.",
            direction: eventCount ? "changed" : "unknown",
            intensity: eventCount ? changeIntensity : 0
          },
          belief: unknown("No definite belief change is supported."),
          relationships: {
            summary: graph.relationships.some((relationship) => relationship.fromEntityId === entity.id || relationship.toEntityId === entity.id)
              ? "An evidenced relationship affects the character's chapter position."
              : "No definite relationship change is supported.",
            direction: graph.relationships.some((relationship) => relationship.fromEntityId === entity.id || relationship.toEntityId === entity.id) ? "changed" : "unknown",
            intensity: graph.relationships.some((relationship) => relationship.fromEntityId === entity.id || relationship.toEntityId === entity.id) ? Math.min(60, changeIntensity) : 0
          },
          bodyCapability: unknown("No definite physical or capability change is supported."),
          socialPosition: unknown("No definite social-position change is supported.")
        },
        evidence: selectedEvidence,
        uncertainty: eventCount ? 0.38 : 0.62
      };
    });
}

export function validateNovelThemeSignals(
  signals: NovelThemeSignal[],
  registry: NovelThemeDefinition[],
  graph: NovelWorldGraph,
  chapters: NovelLongChapterText[] = []
): NovelWorldValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const themeIds = new Set(registry.map((theme) => theme.id));
  const chapterIds = new Set(chapters.map((chapter) => chapter.chapterId));
  const characterIds = new Set(graph.entities.filter((entity) => entity.kind === "character").map((entity) => entity.id));
  const factionIds = new Set(graph.entities.filter((entity) => entity.kind === "faction").map((entity) => entity.id));
  const eventIds = new Set(graph.events.map((event) => event.id));
  const signalIds = new Set<string>();

  for (const signal of signals) {
    if (signalIds.has(signal.id)) errors.push(`duplicate theme signal id: ${signal.id}`);
    signalIds.add(signal.id);
    if (!themeIds.has(signal.themeId)) errors.push(`theme signal ${signal.id} references unknown theme ${signal.themeId}.`);
    if (chapters.length && !chapterIds.has(signal.chapterId)) errors.push(`theme signal ${signal.id} references unknown chapter ${signal.chapterId}.`);
    if (!signal.evidence.length) {
      if (chapters.length) errors.push(`theme signal ${signal.id} has no paragraph evidence.`);
      else warnings.push(`theme signal ${signal.id} has no paragraph evidence.`);
    }
    for (const id of signal.relatedCharacterIds) {
      if (!characterIds.has(id)) errors.push(`theme signal ${signal.id} references unknown character ${id}.`);
    }
    for (const id of signal.relatedEventIds) {
      if (!eventIds.has(id)) errors.push(`theme signal ${signal.id} references unknown event ${id}.`);
    }
    for (const id of signal.relatedFactionIds) {
      if (!factionIds.has(id)) errors.push(`theme signal ${signal.id} references unknown faction ${id}.`);
    }
    if (signal.direction === "contested" && signal.competingInterpretations.length < 2) {
      warnings.push(`theme signal ${signal.id} is contested but has fewer than two interpretations.`);
    }
  }

  if (chapters.length) {
    const evidenceReport = validateEvidenceSnippets(signals.flatMap((signal) => signal.evidence), chapters);
    errors.push(...evidenceReport.errors);
    warnings.push(...evidenceReport.warnings);
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function createFallbackNovelThemeSignals(
  graph: NovelWorldGraph,
  characterStates: NovelCharacterStatePoint[] = [],
  chapter?: NovelLongChapterText,
  index?: NovelEvidenceIndex,
  registry: NovelThemeDefinition[] = createDefaultNovelThemeDefinitions()
): NovelThemeSignal[] {
  if (!chapter) return [];
  const evidenceIndex = index || createFallbackEvidenceIndex(chapter);
  const snippets = evidenceIndex.snippets;
  const pickEvidence = (offset: number) => snippets.length ? [snippets[offset % snippets.length]] : [];
  const signals: NovelThemeSignal[] = [];
  const characters = graph.entities.filter((entity) => entity.kind === "character");
  const factions = graph.entities.filter((entity) => entity.kind === "faction");
  const events = graph.events.filter((event) => event.sourceChapterId === chapter.chapterId || !event.sourceChapterId).slice(0, 4);
  const themeById = new Map(registry.map((theme) => [theme.id, theme]));

  const push = (themeId: string, summary: string, intensity: number, relatedCharacterIds: string[], relatedEventIds: string[], relatedFactionIds: string[], offset: number, direction: NovelThemePressureDirection = "intensify") => {
    if (!themeById.has(themeId) || !pickEvidence(offset).length) return;
    signals.push({
      id: `theme-signal-${chapter.chapterId}-${themeId}`,
      themeId,
      chapterId: chapter.chapterId,
      chapterOrder: chapter.order,
      direction,
      intensity,
      summary,
      uncertainty: 0.42,
      relatedCharacterIds: unique(relatedCharacterIds),
      relatedEventIds: unique(relatedEventIds),
      relatedFactionIds: unique(relatedFactionIds),
      competingInterpretations: direction === "contested" ? ["The pressure may expose a value conflict.", "The pressure may be a temporary event consequence."] : [],
      evidence: pickEvidence(offset)
    });
  };

  const goalPressure = characterStates.filter((point) => point.dimensions.goal.direction !== "unknown").length;
  if (goalPressure || events.length) push("theme-personal-will", "Chapter evidence puts individual goals or resolve under visible pressure.", Math.min(82, 40 + goalPressure * 12 + events.length * 4), characters.slice(0, 3).map((entity) => entity.id), events.map((event) => event.id), [], 0);
  const beliefPressure = characterStates.filter((point) => point.dimensions.belief.direction !== "unknown").length;
  if (beliefPressure) push("theme-value-belief", "A character belief or value position shifts under chapter-local evidence.", Math.min(80, 42 + beliefPressure * 14), characters.slice(0, 3).map((entity) => entity.id), events.map((event) => event.id), [], 1, beliefPressure > 1 ? "contested" : "transform");
  const relationshipPressure = characterStates.filter((point) => point.dimensions.relationships.direction !== "unknown").length || graph.relationships.length;
  if (relationshipPressure) push("theme-relationship-emotion", "Relationship evidence shapes the emotional or loyalty pressure in this chapter.", Math.min(76, 38 + relationshipPressure * 10), characters.slice(0, 4).map((entity) => entity.id), events.map((event) => event.id), [], 2);
  if (factions.length || graph.development.some((step) => step.involvedEntityIds.some((id) => factions.some((faction) => faction.id === id)))) push("theme-institution-organization", "Organization or faction pressure becomes visible in the chapter evidence.", 68, characters.slice(0, 3).map((entity) => entity.id), events.map((event) => event.id), factions.slice(0, 3).map((entity) => entity.id), 3);
  if (graph.events.some((event) => /work|food|poverty|danger|labor|survival|market|winter/i.test(`${event.title} ${event.summary}`))) push("theme-material-survival", "Material conditions or survival pressure are visible but remain chapter-bounded.", 58, characters.slice(0, 3).map((entity) => entity.id), events.map((event) => event.id), factions.slice(0, 2).map((entity) => entity.id), 4);
  const bodyPressure = characterStates.filter((point) => point.dimensions.bodyCapability.direction !== "unknown").length;
  if (bodyPressure) push("theme-body-capability", "Physical ability or bodily limits are evidenced in this chapter.", Math.min(74, 40 + bodyPressure * 14), characters.slice(0, 3).map((entity) => entity.id), events.map((event) => event.id), [], 5);

  return signals;
}

function canonicalCharacterId(project: NovelWorldProject, chapter: NovelChapterAnalysis, characterEntityId: string) {
  const sourceEntity = chapter.graph?.entities.find((entity) => entity.id === characterEntityId && entity.kind === "character");
  if (!sourceEntity) return characterEntityId;
  return project.mergedGraph.entities.find((entity) => entity.kind === "character" && entity.id === characterEntityId)?.id
    || project.mergedGraph.entities.find((entity) => entity.kind === "character" && stableSlug(entity.name) === stableSlug(sourceEntity.name))?.id
    || characterEntityId;
}

export function mergeNovelCharacterArcs(project: NovelWorldProject): NovelCharacterArc[] {
  const arcs = new Map<string, NovelCharacterArc>();
  const readyChapters = project.chapters.filter((chapter) => chapter.status === "ready" && chapter.graph).sort((a, b) => a.input.order - b.input.order);

  for (const chapter of readyChapters) {
    for (const point of chapter.characterStates || []) {
      const characterEntityId = canonicalCharacterId(project, chapter, point.characterEntityId);
      const characterName = project.mergedGraph.entities.find((entity) => entity.id === characterEntityId)?.name
        || chapter.graph?.entities.find((entity) => entity.id === point.characterEntityId)?.name
        || characterEntityId;
      const arc = arcs.get(characterEntityId) || {
        characterEntityId,
        characterName,
        points: [],
        turningPoints: [],
        evidenceGapChapterIds: [],
        score: 0
      };
      arc.points.push({ ...point, characterEntityId, chapterId: chapter.input.id, chapterOrder: chapter.input.order });
      arcs.set(characterEntityId, arc);
    }
  }

  for (const entity of project.mergedGraph.entities.filter((item) => item.kind === "character")) {
    const arc = arcs.get(entity.id) || {
      characterEntityId: entity.id,
      characterName: entity.name,
      points: [],
      turningPoints: [],
      evidenceGapChapterIds: [],
      score: 0
    };
    const pointChapterIds = new Set(arc.points.map((point) => point.chapterId));
    arc.evidenceGapChapterIds = readyChapters
      .filter((chapter) => chapter.graph?.entities.some((item) => item.kind === "character" && stableSlug(item.name) === stableSlug(entity.name)))
      .map((chapter) => chapter.input.id)
      .filter((chapterId) => !pointChapterIds.has(chapterId));
    arc.points.sort((a, b) => a.chapterOrder - b.chapterOrder);
    arc.turningPoints = arc.points.flatMap((point) => {
      const changedDimensions = characterDimensions.filter((dimension) => {
        const state = point.dimensions[dimension];
        return state.intensity >= 65 && state.direction !== "stable" && state.direction !== "unknown";
      });
      if (!changedDimensions.length) return [];
      return [{
        id: `turning-${point.id}`,
        characterEntityId: entity.id,
        chapterId: point.chapterId,
        title: `${entity.name} turning point`,
        summary: point.summary,
        changedDimensions,
        intensity: Math.max(...changedDimensions.map((dimension) => point.dimensions[dimension].intensity)),
        evidence: point.evidence
      }];
    });
    const eventCount = project.mergedGraph.events.filter((event) => event.participantEntityIds.includes(entity.id)).length;
    const evidenceCount = arc.points.reduce((sum, point) => sum + point.evidence.length, 0);
    arc.score = arc.points.length * 10 + eventCount * 4 + evidenceCount * 2 + arc.turningPoints.length * 5;
    arcs.set(entity.id, arc);
  }

  return Array.from(arcs.values()).sort((a, b) => b.score - a.score || a.characterName.localeCompare(b.characterName));
}

export function rankNovelCharacterArcs(arcs: NovelCharacterArc[]) {
  return arcs.slice().sort((a, b) => b.score - a.score || b.points.length - a.points.length || a.characterName.localeCompare(b.characterName));
}

export function normalizePinnedNovelCharacterIds(ids: string[], arcs: NovelCharacterArc[]) {
  const available = new Set(arcs.map((arc) => arc.characterEntityId));
  return unique(ids).filter((id) => available.has(id)).slice(0, 3);
}

export function mergeNovelThemeDefinitions(registry: NovelThemeDefinition[], sourceThemeId: string, targetThemeId: string): NovelThemeDefinition[] {
  if (sourceThemeId === targetThemeId) return normalizeNovelThemeRegistry(registry);
  const themes = normalizeNovelThemeRegistry(registry);
  const source = themes.find((theme) => theme.id === sourceThemeId);
  const target = themes.find((theme) => theme.id === targetThemeId);
  if (!source || !target) return themes;
  return themes
    .filter((theme) => theme.id !== sourceThemeId)
    .map((theme) => theme.id === targetThemeId ? { ...theme, aliases: unique([...theme.aliases, source.name, ...source.aliases]), status: theme.status === "hidden" ? source.status : theme.status } : theme);
}

function canonicalThemeId(registry: NovelThemeDefinition[], themeId: string) {
  if (registry.some((theme) => theme.id === themeId)) return themeId;
  const label = stableSlug(themeId);
  return registry.find((theme) => stableSlug(theme.name) === label || theme.aliases.some((alias) => stableSlug(alias) === label))?.id || themeId;
}

export function remapNovelThemeSignals(signals: NovelThemeSignal[], fromThemeId: string, toThemeId: string): NovelThemeSignal[] {
  return signals.map((signal) => signal.themeId === fromThemeId ? { ...signal, themeId: toThemeId, id: signal.id.replace(fromThemeId, toThemeId) } : signal);
}

export function mergeNovelThemeArcs(project: NovelWorldProject): NovelThemeArc[] {
  const registry = normalizeNovelThemeRegistry(project.themeRegistry);
  const registryById = new Map(registry.map((theme) => [theme.id, theme]));
  const readyChapters = project.chapters.filter((chapter) => chapter.status === "ready" && chapter.graph).sort((a, b) => a.input.order - b.input.order);
  const arcs = new Map<string, NovelThemeArc>();

  for (const theme of registry) {
    if (theme.status === "hidden") continue;
    arcs.set(theme.id, {
      themeId: theme.id,
      themeName: theme.name,
      category: theme.category,
      status: theme.status,
      signals: [],
      evidenceGapChapterIds: [],
      peakSignalIds: [],
      relatedCharacterIds: [],
      relatedEventIds: [],
      relatedFactionIds: [],
      contestedSignalIds: [],
      score: 0
    });
  }

  for (const chapter of readyChapters) {
    for (const signal of chapter.themeSignals || []) {
      const themeId = canonicalThemeId(registry, signal.themeId);
      const theme = registryById.get(themeId);
      if (!theme || theme.status === "hidden") continue;
      const arc = arcs.get(themeId);
      if (!arc) continue;
      arc.signals.push({ ...signal, themeId, chapterId: chapter.input.id, chapterOrder: chapter.input.order });
    }
  }

  for (const arc of arcs.values()) {
    arc.signals.sort((a, b) => a.chapterOrder - b.chapterOrder);
    const signalChapterIds = new Set(arc.signals.map((signal) => signal.chapterId));
    arc.evidenceGapChapterIds = readyChapters
      .filter((chapter) => chapter.themeSignals?.some((signal) => canonicalThemeId(registry, signal.themeId) === arc.themeId) || arc.signals.length > 0)
      .map((chapter) => chapter.input.id)
      .filter((chapterId) => !signalChapterIds.has(chapterId));
    const maxIntensity = Math.max(0, ...arc.signals.map((signal) => signal.intensity));
    arc.peakSignalIds = arc.signals.filter((signal) => signal.intensity === maxIntensity && maxIntensity >= 60).map((signal) => signal.id);
    arc.relatedCharacterIds = unique(arc.signals.flatMap((signal) => signal.relatedCharacterIds));
    arc.relatedEventIds = unique(arc.signals.flatMap((signal) => signal.relatedEventIds));
    arc.relatedFactionIds = unique(arc.signals.flatMap((signal) => signal.relatedFactionIds));
    arc.contestedSignalIds = arc.signals.filter((signal) => signal.direction === "contested").map((signal) => signal.id);
    const evidenceCount = arc.signals.reduce((sum, signal) => sum + signal.evidence.length, 0);
    arc.score = arc.signals.length * 10 + evidenceCount * 2 + arc.peakSignalIds.length * 4 + arc.contestedSignalIds.length * 3 + (arc.status === "confirmed" ? 8 : 0);
  }

  return Array.from(arcs.values()).sort((a, b) => b.score - a.score || a.themeName.localeCompare(b.themeName));
}

export function rankNovelThemeArcs(arcs: NovelThemeArc[]) {
  return arcs.slice().sort((a, b) => b.score - a.score || b.signals.length - a.signals.length || a.themeName.localeCompare(b.themeName));
}

export function normalizePinnedNovelThemeIds(ids: string[], arcs: NovelThemeArc[]) {
  const available = new Set(arcs.map((arc) => arc.themeId));
  return unique(ids).filter((id) => available.has(id)).slice(0, 4);
}

function causalRef(kind: NovelCausalRefKind, id: string, label: string, chapterId?: string): NovelCausalRef {
  return { kind, id, label: label || id, chapterId };
}

function claimEvidence(...groups: NovelEvidenceSnippet[][]) {
  const byId = new Map<string, NovelEvidenceSnippet>();
  for (const snippet of groups.flat()) {
    if (snippet?.source?.chapterId && snippet.source.quote) byId.set(snippet.id, snippet);
  }
  return Array.from(byId.values()).slice(0, 4);
}

function eventForChapterEvent(project: NovelWorldProject, chapterId: string, event: NovelEvent) {
  return project.mergedGraph.events.find((item) => item.sourceChapterId === chapterId && (item.id === event.id || item.id.endsWith(`-${event.id}`) || item.title === event.title)) || event;
}

function causalChapterOrder(project: NovelWorldProject, chapterId?: string) {
  return project.chapters.find((chapter) => chapter.input.id === chapterId)?.input.order || 0;
}

function pushCausalClaim(
  project: NovelWorldProject,
  claims: NovelCausalClaim[],
  edges: NovelCausalEdge[],
  gaps: string[],
  input: {
    id: string;
    cause: NovelCausalRef;
    effect: NovelCausalRef;
    summary: string;
    relation: NovelCausalEdge["relation"];
    confidence: number;
    chapterIds: string[];
    evidence: NovelEvidenceSnippet[];
    contestedInterpretations?: string[];
  }
) {
  const chapterIds = unique(input.chapterIds).sort((a, b) => causalChapterOrder(project, a) - causalChapterOrder(project, b));
  const evidence = claimEvidence(input.evidence);
  if (!evidence.length) {
    gaps.push(`${input.id}: missing paragraph evidence for ${input.cause.label} -> ${input.effect.label}`);
    return;
  }
  const claim: NovelCausalClaim = {
    id: input.id,
    cause: input.cause,
    effect: input.effect,
    summary: input.summary,
    confidence: numberInRange(input.confidence, 0.62, 0, 1),
    chapterIds,
    evidence,
    contestedInterpretations: unique(input.contestedInterpretations || [])
  };
  claims.push(claim);
  edges.push({
    id: `edge-${claim.id}`,
    from: claim.cause,
    to: claim.effect,
    claimId: claim.id,
    relation: claim.contestedInterpretations.length ? "contested" : input.relation,
    chapterIds,
    evidence
  });
}

export function buildNovelCausalityReport(project: NovelWorldProject, throughChapterId?: string): NovelCausalityReport {
  const throughOrder = throughChapterId ? causalChapterOrder(project, throughChapterId) : Number.POSITIVE_INFINITY;
  const readyChapters = project.chapters
    .filter((chapter) => chapter.status === "ready" && chapter.graph && chapter.input.order <= throughOrder)
    .sort((a, b) => a.input.order - b.input.order);
  const claims: NovelCausalClaim[] = [];
  const edges: NovelCausalEdge[] = [];
  const gaps: string[] = [];
  const warnings: string[] = [];
  const themeRegistry = normalizeNovelThemeRegistry(project.themeRegistry);
  const themeNames = new Map(themeRegistry.map((theme) => [theme.id, theme.name]));
  const entityNames = new Map(project.mergedGraph.entities.map((entity) => [entity.id, entity.name]));

  for (const chapter of readyChapters) {
    const chapterId = chapter.input.id;
    const graph = normalizeNovelWorldGraph(chapter.graph);
    const localEvents = graph.events.slice().sort((a, b) => a.order - b.order);
    const states = normalizeNovelCharacterStatePoints(chapter.characterStates || []);
    const signals = normalizeNovelThemeSignals(chapter.themeSignals || [], themeRegistry);
    const localRelationships = graph.relationships;
    const localDevelopment = graph.development;

    for (const event of localEvents) {
      const mergedEvent = eventForChapterEvent(project, chapterId, event);
      const eventRef = causalRef("event", mergedEvent.id, event.title, chapterId);
      const eventEvidence = event.evidence || mergedEvent.evidence || [];
      for (const signal of signals) {
        const relatedToEvent = signal.relatedEventIds.includes(event.id) || signal.relatedEventIds.includes(mergedEvent.id);
        const relatedToParticipant = event.participantEntityIds.some((id) => signal.relatedCharacterIds.includes(id) || signal.relatedFactionIds.includes(id));
        if (!relatedToEvent && !relatedToParticipant) continue;
        pushCausalClaim(project, claims, edges, gaps, {
          id: `claim-${chapterId}-${stableSlug(event.id)}-${stableSlug(signal.id)}`,
          cause: eventRef,
          effect: causalRef("theme-signal", signal.id, themeNames.get(signal.themeId) || signal.themeId, chapterId),
          summary: `${event.title} makes the "${themeNames.get(signal.themeId) || signal.themeId}" pressure visible: ${signal.summary}`,
          relation: signal.direction === "contested" ? "contested" : "pressures",
          confidence: Math.max(0.3, 1 - signal.uncertainty),
          chapterIds: [chapterId],
          evidence: claimEvidence(eventEvidence, signal.evidence),
          contestedInterpretations: signal.competingInterpretations
        });
      }

      for (const state of states) {
        const characterAppears = event.participantEntityIds.includes(state.characterEntityId) || event.participantEntityIds.some((id) => {
          const localEntity = graph.entities.find((entity) => entity.id === id);
          const stateEntity = graph.entities.find((entity) => entity.id === state.characterEntityId);
          return localEntity && stateEntity && localEntity.kind === "character" && localEntity.name === stateEntity.name;
        });
        if (!characterAppears) continue;
        const changed = Object.values(state.dimensions).filter((dimension) => dimension.direction !== "unknown" && dimension.direction !== "stable");
        if (!changed.length) continue;
        pushCausalClaim(project, claims, edges, gaps, {
          id: `claim-${chapterId}-${stableSlug(event.id)}-${stableSlug(state.id)}`,
          cause: eventRef,
          effect: causalRef("character-state", state.id, entityNames.get(state.characterEntityId) || graph.entities.find((entity) => entity.id === state.characterEntityId)?.name || state.characterEntityId, chapterId),
          summary: `${event.title} helps explain this character-state change: ${state.summary}`,
          relation: "drives",
          confidence: Math.max(0.34, 1 - state.uncertainty),
          chapterIds: [chapterId],
          evidence: claimEvidence(eventEvidence, state.evidence)
        });
      }

      for (const step of localDevelopment) {
        const overlaps = step.involvedEntityIds.some((id) => event.participantEntityIds.includes(id) || event.locationEntityId === id);
        if (!overlaps && !event.consequences.some((item) => step.trigger.includes(item) || step.likelyOutcome.includes(item))) continue;
        const mergedStep = project.mergedGraph.development.find((item) => item.sourceChapterIds?.includes(chapterId) && item.title === step.title) || step;
        pushCausalClaim(project, claims, edges, gaps, {
          id: `claim-${chapterId}-${stableSlug(event.id)}-${stableSlug(step.id)}`,
          cause: eventRef,
          effect: causalRef("development", mergedStep.id, step.title, chapterId),
          summary: `${event.title} escalates the unresolved thread "${step.title}".`,
          relation: "escalates",
          confidence: 0.74,
          chapterIds: [chapterId],
          evidence: claimEvidence(eventEvidence, step.evidence || [])
        });
      }
    }

    for (const signal of signals) {
      for (const state of states) {
        const sameCharacter = signal.relatedCharacterIds.includes(state.characterEntityId) || signal.relatedCharacterIds.some((id) => {
          const related = graph.entities.find((entity) => entity.id === id);
          const character = graph.entities.find((entity) => entity.id === state.characterEntityId);
          return related && character && related.kind === "character" && related.name === character.name;
        });
        if (!sameCharacter) continue;
        pushCausalClaim(project, claims, edges, gaps, {
          id: `claim-${chapterId}-${stableSlug(signal.id)}-${stableSlug(state.id)}`,
          cause: causalRef("theme-signal", signal.id, themeNames.get(signal.themeId) || signal.themeId, chapterId),
          effect: causalRef("character-state", state.id, entityNames.get(state.characterEntityId) || graph.entities.find((entity) => entity.id === state.characterEntityId)?.name || state.characterEntityId, chapterId),
          summary: `Theme pressure helps explain the character movement: ${state.summary}`,
          relation: signal.direction === "contested" ? "contested" : "drives",
          confidence: Math.max(0.28, 1 - Math.max(signal.uncertainty, state.uncertainty)),
          chapterIds: [chapterId],
          evidence: claimEvidence(signal.evidence, state.evidence),
          contestedInterpretations: signal.competingInterpretations
        });
      }
    }

    for (const relationship of localRelationships) {
      if (relationship.polarity !== "rival" && relationship.polarity !== "secret" && relationship.polarity !== "debt" && relationship.strength < 70) continue;
      const mergedRelationship = project.mergedGraph.relationships.find((item) => item.sourceChapterIds?.includes(chapterId) && item.label === relationship.label) || relationship;
      for (const signal of signals) {
        const touches = [relationship.fromEntityId, relationship.toEntityId].some((id) => signal.relatedCharacterIds.includes(id) || signal.relatedFactionIds.includes(id));
        if (!touches) continue;
        pushCausalClaim(project, claims, edges, gaps, {
          id: `claim-${chapterId}-${stableSlug(relationship.id)}-${stableSlug(signal.id)}`,
          cause: causalRef("relationship", mergedRelationship.id, relationship.label, chapterId),
          effect: causalRef("theme-signal", signal.id, themeNames.get(signal.themeId) || signal.themeId, chapterId),
          summary: `The relationship "${relationship.label}" adds pressure to ${themeNames.get(signal.themeId) || signal.themeId}.`,
          relation: relationship.polarity === "secret" ? "reveals" : "pressures",
          confidence: Math.min(0.88, 0.45 + relationship.strength / 200),
          chapterIds: [chapterId],
          evidence: claimEvidence(relationship.evidenceSnippets || [], signal.evidence),
          contestedInterpretations: signal.competingInterpretations
        });
      }
    }
  }

  const signalThemeIds = new Map(project.chapters.flatMap((chapter) => (chapter.themeSignals || []).map((signal) => [signal.id, signal.themeId] as const)));
  const stateCharacterIds = new Map(project.chapters.flatMap((chapter) => (chapter.characterStates || []).map((point) => [point.id, point.characterEntityId] as const)));
  const claimsByTheme = new Map<string, { label: string; claims: NovelCausalClaim[] }>();
  const claimsByCharacter = new Map<string, { label: string; claims: NovelCausalClaim[] }>();
  const allClaims = claims.slice().sort((a, b) => causalChapterOrder(project, a.chapterIds[0]) - causalChapterOrder(project, b.chapterIds[0]));
  for (const claim of allClaims) {
    const themeRef = [claim.cause, claim.effect].find((ref) => ref.kind === "theme-signal");
    const characterRef = [claim.cause, claim.effect].find((ref) => ref.kind === "character-state");
    if (themeRef) {
      const themeId = signalThemeIds.get(themeRef.id) || stableSlug(themeRef.label);
      const key = `theme-${themeId}`;
      const existing = claimsByTheme.get(key);
      claimsByTheme.set(key, { label: themeNames.get(themeId) || themeRef.label, claims: [...(existing?.claims || []), claim] });
    }
    if (characterRef) {
      const characterId = stateCharacterIds.get(characterRef.id) || stableSlug(characterRef.label);
      const key = `character-${characterId}`;
      const existing = claimsByCharacter.get(key);
      claimsByCharacter.set(key, { label: characterRef.label, claims: [...(existing?.claims || []), claim] });
    }
  }

  const chains: NovelCausalChain[] = [];
  const makeChain = (key: string, label: string, sourceClaims: NovelCausalClaim[]) => {
    const claimIds = unique(sourceClaims.map((claim) => claim.id));
    const chainEdges = edges.filter((edge) => claimIds.includes(edge.claimId));
    const chapterIds = unique(sourceClaims.flatMap((claim) => claim.chapterIds)).sort((a, b) => causalChapterOrder(project, a) - causalChapterOrder(project, b));
    const evidenceCount = sourceClaims.reduce((sum, claim) => sum + claim.evidence.length, 0);
    const contestedClaimIds = sourceClaims.filter((claim) => claim.contestedInterpretations.length).map((claim) => claim.id);
    const gapIds = readyChapters
      .filter((chapter) => chapterIds.length && !chapterIds.includes(chapter.input.id))
      .filter((chapter) => sourceClaims.some((claim) => causalChapterOrder(project, claim.chapterIds[0]) < chapter.input.order))
      .map((chapter) => chapter.input.id);
    chains.push({
      id: `chain-${key}`,
      title: label,
      summary: `${sourceClaims.length} evidenced causal claim(s) explain movement through ${chapterIds.length} chapter(s).`,
      claimIds,
      edgeIds: chainEdges.map((edge) => edge.id),
      chapterIds,
      evidenceGapChapterIds: unique(gapIds).slice(0, 6),
      contestedClaimIds,
      score: sourceClaims.length * 12 + evidenceCount * 3 + contestedClaimIds.length * 4 - gapIds.length
    });
  };
  for (const [key, item] of claimsByTheme) makeChain(key, item.label, item.claims);
  for (const [key, item] of claimsByCharacter) makeChain(key, item.label, item.claims);
  if (!chains.length && allClaims.length) makeChain(`project-${project.id}`, project.title, allClaims);

  if (!readyChapters.length) warnings.push("No analyzed chapters are available for causality.");
  if (gaps.length) warnings.push(`${gaps.length} potential causal link(s) were withheld because paragraph evidence was missing.`);

  return {
    id: `causality-${project.id}`,
    projectId: project.id,
    throughChapterId,
    claims: allClaims,
    edges,
    chains: rankNovelCausalChains(chains),
    gaps: unique(gaps),
    warnings
  };
}

export function createFallbackNovelCausalityReport(project: NovelWorldProject, throughChapterId?: string): NovelCausalityReport {
  return buildNovelCausalityReport(project, throughChapterId);
}

export function rankNovelCausalChains(chains: NovelCausalChain[]) {
  return chains.slice().sort((a, b) => b.score - a.score || b.claimIds.length - a.claimIds.length || a.title.localeCompare(b.title));
}

export function normalizePinnedNovelCausalChainIds(ids: string[], chains: NovelCausalChain[]) {
  const available = new Set(chains.map((chain) => chain.id));
  return unique(ids).filter((id) => available.has(id)).slice(0, 3);
}

export function validateNovelCausalityReport(report: NovelCausalityReport, project: NovelWorldProject, chapters: NovelLongChapterText[] = []): NovelWorldValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const chapterIds = new Set(project.chapters.map((chapter) => chapter.input.id));
  const eventIds = new Set(project.mergedGraph.events.map((event) => event.id));
  const relationshipIds = new Set(project.mergedGraph.relationships.map((relationship) => relationship.id));
  const developmentIds = new Set(project.mergedGraph.development.map((step) => step.id));
  const stateIds = new Set(project.chapters.flatMap((chapter) => chapter.characterStates || []).map((point) => point.id));
  const signalIds = new Set(project.chapters.flatMap((chapter) => chapter.themeSignals || []).map((signal) => signal.id));
  const claimIds = new Set<string>();
  const edgeIds = new Set<string>();

  const refKnown = (ref: NovelCausalRef) => {
    if (ref.kind === "event") return eventIds.has(ref.id) || project.chapters.some((chapter) => chapter.graph?.events.some((event) => event.id === ref.id));
    if (ref.kind === "character-state") return stateIds.has(ref.id);
    if (ref.kind === "theme-signal") return signalIds.has(ref.id);
    if (ref.kind === "relationship") return relationshipIds.has(ref.id) || project.chapters.some((chapter) => chapter.graph?.relationships.some((relationship) => relationship.id === ref.id));
    if (ref.kind === "development") return developmentIds.has(ref.id) || project.chapters.some((chapter) => chapter.graph?.development.some((step) => step.id === ref.id));
    return false;
  };

  for (const claim of report.claims) {
    if (claimIds.has(claim.id)) errors.push(`duplicate causal claim id: ${claim.id}`);
    claimIds.add(claim.id);
    if (!refKnown(claim.cause)) errors.push(`causal claim ${claim.id} references unknown cause ${claim.cause.kind}/${claim.cause.id}.`);
    if (!refKnown(claim.effect)) errors.push(`causal claim ${claim.id} references unknown effect ${claim.effect.kind}/${claim.effect.id}.`);
    if (!claim.evidence.length) errors.push(`causal claim ${claim.id} has no paragraph evidence.`);
    for (const chapterId of claim.chapterIds) {
      if (!chapterIds.has(chapterId)) errors.push(`causal claim ${claim.id} references unknown chapter ${chapterId}.`);
    }
    const orders = claim.chapterIds.map((chapterId) => causalChapterOrder(project, chapterId));
    if (orders.some((order, index) => index > 0 && order < orders[index - 1])) errors.push(`causal claim ${claim.id} has reverse chapter order.`);
  }

  for (const edge of report.edges) {
    if (edgeIds.has(edge.id)) errors.push(`duplicate causal edge id: ${edge.id}`);
    edgeIds.add(edge.id);
    if (!claimIds.has(edge.claimId)) errors.push(`causal edge ${edge.id} references unknown claim ${edge.claimId}.`);
    if (!refKnown(edge.from)) errors.push(`causal edge ${edge.id} references unknown from ref ${edge.from.kind}/${edge.from.id}.`);
    if (!refKnown(edge.to)) errors.push(`causal edge ${edge.id} references unknown to ref ${edge.to.kind}/${edge.to.id}.`);
  }

  for (const chain of report.chains) {
    for (const id of chain.claimIds) if (!claimIds.has(id)) errors.push(`causal chain ${chain.id} references unknown claim ${id}.`);
    for (const id of chain.edgeIds) if (!edgeIds.has(id)) errors.push(`causal chain ${chain.id} references unknown edge ${id}.`);
    for (const chapterId of chain.chapterIds) if (!chapterIds.has(chapterId)) errors.push(`causal chain ${chain.id} references unknown chapter ${chapterId}.`);
  }

  if (chapters.length) {
    const evidenceReport = validateEvidenceSnippets(report.claims.flatMap((claim) => claim.evidence), chapters);
    errors.push(...evidenceReport.errors);
    warnings.push(...evidenceReport.warnings);
  }
  warnings.push(...report.warnings);
  return { valid: errors.length === 0, errors, warnings };
}

function askTerms(question: string) {
  const normalized = question.toLowerCase();
  const asciiTerms = normalized.match(/[a-z0-9][a-z0-9-]{1,}/g) || [];
  const chineseTerms = question.match(/[\u4e00-\u9fff]{2,}/g) || [];
  return unique([...asciiTerms, ...chineseTerms].map((term) => term.trim()).filter((term) => term.length > 1)).slice(0, 16);
}

function textMatchesTerms(value: string, terms: string[]) {
  const lower = value.toLowerCase();
  return terms.filter((term) => lower.includes(term.toLowerCase())).length;
}

function sourceObjectText(hit: { label: string; summary: string; quote?: string }) {
  return `${hit.label} ${hit.summary} ${hit.quote || ""}`;
}

function isUnsupportedAsk(question: string) {
  return /后文|后面|结局|未来|预测|续写|会怎样|作者真实|作者意图|历史事实|现实|书外|outside|future|predict|ending|sequel|author intent/i.test(question);
}

function trimAskQuote(value: string) {
  const clean = text(value).replace(/\s+/g, " ").trim();
  return clean.length > novelEvidenceQuoteLimit ? clean.slice(0, novelEvidenceQuoteLimit) : clean;
}

export function buildNovelAskQueryPlan(project: NovelWorldProject, question: string, throughChapterId?: string): NovelAskQueryPlan {
  const cleanQuestion = text(question);
  const terms = askTerms(cleanQuestion);
  const entityIds = project.mergedGraph.entities
    .filter((entity) => textMatchesTerms(`${entity.name} ${entity.role} ${entity.summary} ${entity.traits.join(" ")}`, terms))
    .map((entity) => entity.id);
  const eventIds = project.mergedGraph.events
    .filter((event) => textMatchesTerms(`${event.title} ${event.summary} ${event.causes.join(" ")} ${event.consequences.join(" ")}`, terms))
    .map((event) => event.id);
  const themeRegistry = normalizeNovelThemeRegistry(project.themeRegistry);
  const themeIds = themeRegistry
    .filter((theme) => textMatchesTerms(`${theme.name} ${theme.category} ${theme.aliases.join(" ")} ${theme.description}`, terms))
    .map((theme) => theme.id);
  const causalReport = buildNovelCausalityReport(project, throughChapterId);
  const causalClaimIds = causalReport.claims
    .filter((claim) => textMatchesTerms(`${claim.cause.label} ${claim.effect.label} ${claim.summary} ${claim.contestedInterpretations.join(" ")}`, terms))
    .map((claim) => claim.id);
  const lower = cleanQuestion.toLowerCase();
  let kind: NovelAskQuestionKind = "world-state";
  if (isUnsupportedAsk(cleanQuestion) || /what happens after|after the final|after final|later chapters?|author'?s? (real )?(intent|intention)|outside knowledge/i.test(cleanQuestion)) kind = "unsupported";
  else if (/why|为什么|为何|原因|因果|导致|because|cause/i.test(lower)) kind = "causality";
  else if (/theme|主题|压力|信念|价值|制度|组织|生存|身体/i.test(lower)) kind = "theme";
  else if (/evidence|证据|哪里|段落|出处|原文|quote|source/i.test(lower)) kind = "evidence";
  else if (/event|事件|发生|timeline|时间线/i.test(lower)) kind = "event";
  else if (/character|人物|角色|谁|状态|成长|变化/i.test(lower) || entityIds.some((id) => project.mergedGraph.entities.find((entity) => entity.id === id)?.kind === "character")) kind = "character";

  return {
    id: stableId("ask-plan", cleanQuestion || "empty", 0),
    question: cleanQuestion,
    kind,
    normalizedTerms: terms,
    entityIds: unique(entityIds),
    eventIds: unique(eventIds),
    themeIds: unique(themeIds),
    causalClaimIds: unique(causalClaimIds),
    throughChapterId,
    refusedReason: kind === "unsupported" ? "Question asks for future, author intent, or outside-book information beyond analyzed evidence." : undefined
  };
}

function askHitFromEvidence(input: {
  sourceType: NovelAskSourceType;
  sourceId: string;
  label: string;
  summary: string;
  evidence: NovelEvidenceSnippet;
  relatedObjectIds?: string[];
  baseScore?: number;
  terms: string[];
}): NovelAskEvidenceHit {
  const termScore = textMatchesTerms(sourceObjectText({ label: input.label, summary: input.summary, quote: input.evidence.source.quote }), input.terms);
  return {
    id: stableId("ask-hit", `${input.sourceType}-${input.sourceId}-${input.evidence.id}`, 0),
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    label: input.label,
    chapterId: input.evidence.source.chapterId,
    paragraphId: input.evidence.source.paragraphId,
    quote: trimAskQuote(input.evidence.source.quote),
    summary: input.summary || input.evidence.source.summary,
    confidence: numberInRange(input.evidence.source.confidence, 0.5, 0, 1),
    score: (input.baseScore || 0) + termScore * 10 + numberInRange(input.evidence.source.confidence, 0.5, 0, 1) * 4,
    relatedObjectIds: unique([input.sourceId, ...(input.relatedObjectIds || [])])
  };
}

export function searchNovelAskEvidence(
  project: NovelWorldProject,
  chapters: NovelLongChapterText[] = [],
  questionOrPlan: string | NovelAskQueryPlan,
  throughChapterId?: string
): { queryPlan: NovelAskQueryPlan; evidenceHits: NovelAskEvidenceHit[] } {
  const plan = typeof questionOrPlan === "string" ? buildNovelAskQueryPlan(project, questionOrPlan, throughChapterId) : questionOrPlan;
  const throughOrder = plan.throughChapterId ? causalChapterOrder(project, plan.throughChapterId) : Number.POSITIVE_INFINITY;
  const allowedChapterIds = new Set(project.chapters.filter((chapter) => chapter.input.order <= throughOrder).map((chapter) => chapter.input.id));
  const hits: NovelAskEvidenceHit[] = [];
  const terms = plan.normalizedTerms;
  const pushSnippet = (hit: Omit<Parameters<typeof askHitFromEvidence>[0], "terms">) => {
    if (!hit.evidence.source.chapterId || !hit.evidence.source.paragraphId || !hit.evidence.source.quote) return;
    if (allowedChapterIds.size && !allowedChapterIds.has(hit.evidence.source.chapterId)) return;
    hits.push(askHitFromEvidence({ ...hit, terms }));
  };

  for (const chapter of chapters) {
    if (allowedChapterIds.size && !allowedChapterIds.has(chapter.chapterId)) continue;
    for (const paragraph of chapter.paragraphs) {
      const matchCount = textMatchesTerms(paragraph.text, terms);
      if (!matchCount && terms.length) continue;
      const evidence: NovelEvidenceSnippet = {
        id: `ask-paragraph-${paragraph.id}`,
        source: {
          chapterId: paragraph.chapterId,
          paragraphId: paragraph.id,
          quote: trimAskQuote(paragraph.text),
          summary: `Paragraph ${paragraph.order} in ${chapter.title}.`,
          confidence: 0.72
        },
        keywords: terms.slice(0, 6)
      };
      pushSnippet({ sourceType: "paragraph", sourceId: paragraph.id, label: chapter.title, summary: evidence.source.summary, evidence, baseScore: matchCount * 8 });
    }
  }

  for (const entity of project.mergedGraph.entities) {
    const objectMatch = plan.entityIds.includes(entity.id) || textMatchesTerms(`${entity.name} ${entity.role} ${entity.summary} ${entity.traits.join(" ")}`, terms) > 0;
    if (!objectMatch) continue;
    for (const evidence of entity.evidence || []) pushSnippet({ sourceType: "entity", sourceId: entity.id, label: entity.name, summary: entity.summary, evidence, relatedObjectIds: entity.sourceChapterIds, baseScore: 18 });
  }

  for (const relationship of project.mergedGraph.relationships) {
    const from = project.mergedGraph.entities.find((entity) => entity.id === relationship.fromEntityId)?.name || relationship.fromEntityId;
    const to = project.mergedGraph.entities.find((entity) => entity.id === relationship.toEntityId)?.name || relationship.toEntityId;
    const label = `${from} / ${to}`;
    const objectMatch = textMatchesTerms(`${label} ${relationship.label} ${relationship.evidence} ${relationship.polarity}`, terms) > 0 || plan.entityIds.includes(relationship.fromEntityId) || plan.entityIds.includes(relationship.toEntityId);
    if (!objectMatch) continue;
    for (const evidence of relationship.evidenceSnippets || []) pushSnippet({ sourceType: "relationship", sourceId: relationship.id, label, summary: relationship.label, evidence, relatedObjectIds: [relationship.fromEntityId, relationship.toEntityId], baseScore: 16 });
  }

  for (const event of project.mergedGraph.events) {
    const objectMatch = plan.eventIds.includes(event.id) || textMatchesTerms(`${event.title} ${event.summary} ${event.causes.join(" ")} ${event.consequences.join(" ")}`, terms) > 0 || event.participantEntityIds.some((id) => plan.entityIds.includes(id));
    if (!objectMatch) continue;
    for (const evidence of event.evidence || []) pushSnippet({ sourceType: "event", sourceId: event.id, label: event.title, summary: event.summary, evidence, relatedObjectIds: event.participantEntityIds, baseScore: 20 });
  }

  for (const step of project.mergedGraph.development) {
    const objectMatch = textMatchesTerms(`${step.title} ${step.trigger} ${step.likelyOutcome} ${step.unresolvedQuestion}`, terms) > 0 || step.involvedEntityIds.some((id) => plan.entityIds.includes(id));
    if (!objectMatch) continue;
    for (const evidence of step.evidence || []) pushSnippet({ sourceType: "development", sourceId: step.id, label: step.title, summary: step.likelyOutcome, evidence, relatedObjectIds: step.involvedEntityIds, baseScore: 14 });
  }

  const themeRegistry = normalizeNovelThemeRegistry(project.themeRegistry);
  const themeNameById = new Map(themeRegistry.map((theme) => [theme.id, theme.name]));
  for (const chapter of project.chapters) {
    if (allowedChapterIds.size && !allowedChapterIds.has(chapter.input.id)) continue;
    for (const state of chapter.characterStates || []) {
      const entity = project.mergedGraph.entities.find((item) => item.id === state.characterEntityId);
      const objectMatch = plan.entityIds.includes(state.characterEntityId) || textMatchesTerms(`${entity?.name || ""} ${state.summary} ${Object.values(state.dimensions).map((dimension) => dimension.summary).join(" ")}`, terms) > 0;
      if (!objectMatch) continue;
      for (const evidence of state.evidence) pushSnippet({ sourceType: "character-state", sourceId: state.id, label: entity?.name || state.characterEntityId, summary: state.summary, evidence, relatedObjectIds: [state.characterEntityId], baseScore: 22 });
    }
    for (const signal of chapter.themeSignals || []) {
      const themeName = themeNameById.get(signal.themeId) || signal.themeId;
      const objectMatch = plan.themeIds.includes(signal.themeId) || textMatchesTerms(`${themeName} ${signal.summary} ${signal.direction} ${signal.competingInterpretations.join(" ")}`, terms) > 0 || signal.relatedCharacterIds.some((id) => plan.entityIds.includes(id)) || signal.relatedEventIds.some((id) => plan.eventIds.includes(id));
      if (!objectMatch) continue;
      for (const evidence of signal.evidence) pushSnippet({ sourceType: "theme-signal", sourceId: signal.id, label: themeName, summary: signal.summary, evidence, relatedObjectIds: [...signal.relatedCharacterIds, ...signal.relatedEventIds, ...signal.relatedFactionIds], baseScore: 21 });
    }
  }

  const causalityReport = buildNovelCausalityReport(project, plan.throughChapterId);
  for (const claim of causalityReport.claims) {
    const objectMatch = plan.causalClaimIds.includes(claim.id) || plan.kind === "causality" || textMatchesTerms(`${claim.cause.label} ${claim.effect.label} ${claim.summary} ${claim.contestedInterpretations.join(" ")}`, terms) > 0;
    if (!objectMatch) continue;
    for (const evidence of claim.evidence) pushSnippet({ sourceType: "causal-claim", sourceId: claim.id, label: `${claim.cause.label} -> ${claim.effect.label}`, summary: claim.summary, evidence, relatedObjectIds: [claim.cause.id, claim.effect.id], baseScore: plan.kind === "causality" ? 26 : 18 });
  }
  for (const edge of causalityReport.edges) {
    const objectMatch = plan.kind === "causality" || textMatchesTerms(`${edge.from.label} ${edge.to.label} ${edge.relation}`, terms) > 0;
    if (!objectMatch) continue;
    for (const evidence of edge.evidence) pushSnippet({ sourceType: "causal-edge", sourceId: edge.id, label: `${edge.from.label} -> ${edge.to.label}`, summary: edge.relation, evidence, relatedObjectIds: [edge.from.id, edge.to.id], baseScore: 15 });
  }

  const byId = new Map<string, NovelAskEvidenceHit>();
  for (const hit of hits.sort((a, b) => b.score - a.score || b.confidence - a.confidence)) {
    const existing = byId.get(hit.id);
    if (!existing || hit.score > existing.score) byId.set(hit.id, hit);
  }
  return { queryPlan: plan, evidenceHits: Array.from(byId.values()).slice(0, 12) };
}

export function createFallbackNovelAskAnswer(project: NovelWorldProject, question: string, evidenceHits: NovelAskEvidenceHit[] = [], queryPlan?: NovelAskQueryPlan): NovelAskAnswer {
  const plan = queryPlan || buildNovelAskQueryPlan(project, question);
  const id = stableId("ask-answer", `${question}-${evidenceHits.map((hit) => hit.id).join("-")}`, 0);
  if (plan.kind === "unsupported") {
    return {
      id,
      question: plan.question,
      status: "refused",
      answer: "这个问题超出已分析章节的书内证据范围。我只能回答到当前章节为止、由段落证据支持的事实和解释。",
      summaryBullets: ["拒答原因：问题涉及后文预测、作者真实意图或书外信息。", "可以改问：到当前章节为止，某人物为什么变化，或某事件由哪些证据支持。"],
      evidenceHitIds: [],
      relatedObjectIds: [],
      warnings: [plan.refusedReason || "Unsupported question scope."]
    };
  }
  if (evidenceHits.length < 1) {
    return {
      id,
      question: plan.question,
      status: "insufficient-evidence",
      answer: "目前已分析章节里没有足够段落证据回答这个问题。系统不会补编缺失因果或预测后文。",
      summaryBullets: ["证据不足：没有找到可引用的章节/段落。", "建议先分析更多章节，或把问题改得更具体。"],
      evidenceHitIds: [],
      relatedObjectIds: [],
      warnings: ["Insufficient paragraph-grounded evidence."]
    };
  }
  const top = evidenceHits.slice(0, 5);
  const sourceSummary = top.map((hit) => `${hit.label}: ${hit.summary}`).join(" / ");
  return {
    id,
    question: plan.question,
    status: "answered",
    answer: `基于已读章节证据，答案集中在这些线索：${sourceSummary}`,
    summaryBullets: top.slice(0, 4).map((hit) => `${hit.label} - ${hit.summary}`),
    evidenceHitIds: top.map((hit) => hit.id),
    relatedObjectIds: unique(top.flatMap((hit) => hit.relatedObjectIds)).slice(0, 10),
    warnings: []
  };
}

export function validateNovelAskAnswer(answer: NovelAskAnswer, evidenceHits: NovelAskEvidenceHit[], chapters: NovelLongChapterText[] = []): NovelAskValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!answer.question.trim()) errors.push("ask answer question is required.");
  if (!answer.answer.trim()) errors.push("ask answer text is required.");
  if (!["answered", "insufficient-evidence", "refused"].includes(answer.status)) errors.push("ask answer status is invalid.");
  const hitIds = new Set(evidenceHits.map((hit) => hit.id));
  if (answer.status === "answered" && !answer.evidenceHitIds.length) errors.push("answered ask response must cite evidence hits.");
  for (const id of answer.evidenceHitIds) {
    if (!hitIds.has(id)) errors.push(`ask answer references unknown evidence hit ${id}.`);
  }
  const chapterIds = new Set(chapters.map((chapter) => chapter.chapterId));
  const paragraphIds = new Set(chapters.flatMap((chapter) => chapter.paragraphs.map((paragraph) => `${chapter.chapterId}/${paragraph.id}`)));
  for (const hit of evidenceHits) {
    if (!hit.chapterId) errors.push(`ask evidence hit ${hit.id} is missing chapterId.`);
    if (!hit.paragraphId) errors.push(`ask evidence hit ${hit.id} is missing paragraphId.`);
    if (chapters.length && (!chapterIds.has(hit.chapterId) || !paragraphIds.has(`${hit.chapterId}/${hit.paragraphId}`))) {
      errors.push(`ask evidence hit ${hit.id} references unknown paragraph ${hit.chapterId}/${hit.paragraphId}.`);
    }
    if (!hit.quote.trim()) errors.push(`ask evidence hit ${hit.id} is missing quote.`);
    if (hit.quote.length > novelEvidenceQuoteLimit) errors.push(`ask evidence hit ${hit.id} quote exceeds ${novelEvidenceQuoteLimit} characters.`);
  }
  if (answer.status !== "answered" && answer.evidenceHitIds.length) warnings.push("non-answered ask response includes evidence refs.");
  return { valid: errors.length === 0, errors, warnings };
}

export function attachFallbackEvidenceToGraph(graph: NovelWorldGraph, chapter: NovelLongChapterText, index: NovelEvidenceIndex = createFallbackEvidenceIndex(chapter)): NovelWorldGraph {
  const snippets = index.snippets.length ? index.snippets : createFallbackEvidenceIndex(chapter).snippets;
  const pick = (offset: number) => snippets[offset % Math.max(snippets.length, 1)];
  if (!snippets.length) return graph;
  return normalizeNovelWorldGraph({
    ...graph,
    entities: graph.entities.map((entity, offset) => ({ ...entity, evidence: [pick(offset)] })),
    relationships: graph.relationships.map((relationship, offset) => ({ ...relationship, evidenceSnippets: [pick(offset + graph.entities.length)] })),
    events: graph.events.map((event, offset) => ({ ...event, sourceChapterId: event.sourceChapterId || chapter.chapterId, evidence: [pick(offset + 1)] })),
    development: graph.development.map((step, offset) => ({ ...step, sourceChapterIds: unique([...(step.sourceChapterIds || []), chapter.chapterId]), evidence: [pick(offset + 2)] }))
  });
}

export function createNovelStateSimulation(project: NovelWorldProject, chapters: NovelLongChapterText[] = [], throughChapterId?: string): NovelStateSimulation {
  const readyChapters = project.chapters.filter((chapter) => chapter.status === "ready" && (!throughChapterId || chapter.input.order <= (project.chapters.find((item) => item.input.id === throughChapterId)?.input.order || chapter.input.order)));
  const allowedChapterIds = new Set(readyChapters.map((chapter) => chapter.input.id));
  const graph = project.mergedGraph;
  const themeArcs = mergeNovelThemeArcs(project)
    .filter((arc) => arc.signals.some((signal) => allowedChapterIds.has(signal.chapterId)))
    .slice(0, 6);
  const causalityReport = buildNovelCausalityReport(project, throughChapterId);
  const chapterEvidence = chapters.flatMap((chapter) => createFallbackEvidenceIndex(chapter).snippets).filter((snippet) => allowedChapterIds.size ? allowedChapterIds.has(snippet.source.chapterId) : true);
  const fallbackEvidence = (offset: number) => chapterEvidence[offset % Math.max(chapterEvidence.length, 1)] ? [chapterEvidence[offset % chapterEvidence.length]] : [];
  const items: NovelStateSimulationItem[] = [];

  for (const entity of graph.entities.slice(0, 8)) {
    const entityEvidence = (entity.evidence || []).filter((snippet) => !allowedChapterIds.size || allowedChapterIds.has(snippet.source.chapterId));
    items.push({
      id: `sim-entity-${entity.id}`,
      kind: entity.kind === "faction" || entity.kind === "location" || entity.kind === "character" ? entity.kind : "tension",
      label: entity.name,
      before: entity.firstSeenChapterId ? `Introduced around ${entity.firstSeenChapterId}.` : "Initial state is inferred from analyzed text.",
      after: entity.summary,
      driver: entity.traits.join(" / ") || entity.role,
      evidence: entityEvidence.length ? entityEvidence : fallbackEvidence(items.length)
    });
  }

  for (const step of graph.development.slice(0, 6)) {
    const stepEvidence = (step.evidence || []).filter((snippet) => !allowedChapterIds.size || allowedChapterIds.has(snippet.source.chapterId));
    items.push({
      id: `sim-tension-${step.id}`,
      kind: "tension",
      label: step.title,
      before: step.trigger,
      after: step.likelyOutcome,
      driver: step.unresolvedQuestion,
      evidence: stepEvidence.length ? stepEvidence : fallbackEvidence(items.length)
    });
  }

  if (graph.events.length) {
    const scopedEvents = graph.events.filter((event) => !throughChapterId || !event.sourceChapterId || allowedChapterIds.has(event.sourceChapterId));
    items.push({
      id: "sim-event-chain",
      kind: "event-chain",
      label: "Analyzed event chain",
      before: scopedEvents[0]?.title || "No analyzed events yet.",
      after: scopedEvents[scopedEvents.length - 1]?.title || "No analyzed events yet.",
      driver: scopedEvents.map((event) => event.consequences[0]).filter(Boolean).slice(0, 4).join(" / ") || "Events remain loosely connected.",
      evidence: fallbackEvidence(items.length)
    });
  }

  for (const arc of themeArcs) {
    const scopedSignals = arc.signals.filter((signal) => allowedChapterIds.has(signal.chapterId));
    const peak = scopedSignals.slice().sort((a, b) => b.intensity - a.intensity)[0];
    if (!peak) continue;
    items.push({
      id: `sim-theme-${arc.themeId}`,
      kind: "tension",
      label: `Theme pressure: ${arc.themeName}`,
      before: scopedSignals[0]?.summary || "No earlier theme signal.",
      after: peak.summary,
      driver: `${peak.direction} / intensity ${peak.intensity}${arc.contestedSignalIds.length ? " / contested" : ""}`,
      evidence: peak.evidence.length ? peak.evidence : fallbackEvidence(items.length)
    });
  }

  for (const chain of causalityReport.chains.slice(0, 4)) {
    const firstClaim = causalityReport.claims.find((claim) => claim.id === chain.claimIds[0]);
    const lastClaim = causalityReport.claims.find((claim) => claim.id === chain.claimIds[chain.claimIds.length - 1]) || firstClaim;
    if (!firstClaim || !lastClaim) continue;
    items.push({
      id: `sim-causal-${chain.id}`,
      kind: "event-chain",
      label: `Causal chain: ${chain.title}`,
      before: `${firstClaim.cause.label} -> ${firstClaim.effect.label}`,
      after: lastClaim.summary,
      driver: chain.contestedClaimIds.length ? "Contains contested interpretation; no single conclusion is forced." : "Evidence-backed local causal explanation.",
      evidence: claimEvidence(firstClaim.evidence, lastClaim.evidence).length ? claimEvidence(firstClaim.evidence, lastClaim.evidence) : fallbackEvidence(items.length)
    });
  }

  return {
    id: `simulation-${project.id}`,
    throughChapterId,
    summary: readyChapters.length
      ? `State simulation uses ${readyChapters.length} analyzed chapter(s), includes ${causalityReport.chains.length} local causal chain(s), and does not project beyond the read text.`
      : "Analyze chapters before running a grounded state simulation.",
    items,
    warnings: readyChapters.length ? causalityReport.warnings : ["No analyzed chapters are available."]
  };
}

export function createFallbackNovelWorldGraph(title = "Rain Gate", genreTone = "Eastern fantasy / mystery", fragment = ""): NovelWorldGraph {
  const seedHint = fragment.trim().slice(0, 42) || "A young outsider enters a sealed city with a cracked jade slip.";
  return {
    id: "novel-world-demo",
    title: title.trim() || "Rain Gate",
    genreTone: genreTone.trim() || "Eastern fantasy / mystery",
    premise: `Fragment core: ${seedHint}`,
    observerBrief: "You are the world observer: secrets, debts, places, and unresolved tensions keep the plot moving.",
    entities: [
      { id: "char-lin-yao", kind: "character", name: "Lin Yao", role: "Outsider", summary: "Carries a cracked jade slip into the sealed city.", traits: ["careful", "unusual root", "tracked"], x: 32, y: 62, tension: 68 },
      { id: "char-shen-qiu", kind: "character", name: "Shen Qiu", role: "City warden", summary: "Investigates a missing senior and quietly doubts the sect order.", traits: ["law keeper", "skeptical", "evidence-led"], x: 52, y: 48, tension: 74 },
      { id: "faction-qingyun", kind: "faction", name: "Qingyun Sect", role: "Local sect", summary: "Maintains public order while hiding a succession conflict.", traits: ["powerful", "divided", "secretive"], x: 70, y: 30, tension: 81 },
      { id: "loc-rain-gate", kind: "location", name: "Rain Gate City", role: "Border city", summary: "An old city where rain reveals buried formation lines.", traits: ["sealed", "formation", "old case"], x: 42, y: 54, tension: 64 },
      { id: "item-jade-slip", kind: "item", name: "Cracked Jade Slip", role: "Key clue", summary: "A partial record of an old sect oath.", traits: ["broken", "resonant", "evidence"], x: 28, y: 64, tension: 88 }
    ],
    relationships: [
      { id: "rel-lin-shen", fromEntityId: "char-lin-yao", toEntityId: "char-shen-qiu", label: "mutual testing", polarity: "neutral", evidence: "Shen Qiu detains Lin Yao but does not hand him over.", strength: 58 },
      { id: "rel-shen-qingyun", fromEntityId: "char-shen-qiu", toEntityId: "faction-qingyun", label: "public obedience, private doubt", polarity: "secret", evidence: "She questions the origin of the sealing order.", strength: 76 },
      { id: "rel-qingyun-jade", fromEntityId: "faction-qingyun", toEntityId: "item-jade-slip", label: "pursues old oath", polarity: "debt", evidence: "The slip could destabilize succession claims.", strength: 86 },
      { id: "rel-city-qingyun", fromEntityId: "loc-rain-gate", toEntityId: "faction-qingyun", label: "order dependency", polarity: "neutral", evidence: "The sect drives the city lockdown.", strength: 69 }
    ],
    events: [
      { id: "event-1", order: 1, timeLabel: "Rain night", title: "Lin Yao enters the city", summary: "The jade slip resonates with the city gate formation.", locationEntityId: "loc-rain-gate", participantEntityIds: ["char-lin-yao", "item-jade-slip"], causes: ["jade slip resonance"], consequences: ["city lockdown begins"], publicKnowledge: true },
      { id: "event-2", order: 2, timeLabel: "After lockdown", title: "Shen Qiu intercepts him", summary: "She recognizes the slip pattern from an old missing-person case.", locationEntityId: "loc-rain-gate", participantEntityIds: ["char-shen-qiu", "char-lin-yao", "item-jade-slip"], causes: ["formation anomaly"], consequences: ["Lin Yao's identity is temporarily hidden"], publicKnowledge: false },
      { id: "event-3", order: 3, timeLabel: "Before midnight", title: "Qingyun Sect sends an order", summary: "The sect orders all outsiders surrendered and old case records destroyed.", locationEntityId: "loc-rain-gate", participantEntityIds: ["faction-qingyun", "char-shen-qiu"], causes: ["news of the slip leaks"], consequences: ["hidden conflict escalates"], publicKnowledge: false }
    ],
    development: [
      { id: "dev-1", title: "Lockdown conflict escalates", trigger: "The sect demands Lin Yao while Shen Qiu sees the old-case link.", likelyOutcome: "Shen Qiu may cooperate with Lin Yao in a limited way.", involvedEntityIds: ["char-lin-yao", "char-shen-qiu", "faction-qingyun"], tension: 82, unresolvedQuestion: "Was the missing senior tied to the jade slip oath?" },
      { id: "dev-2", title: "Jade slip opens the underground formation", trigger: "The city formation resonates with the cracked jade slip.", likelyOutcome: "Ordinary city places become explorable inheritance nodes.", involvedEntityIds: ["loc-rain-gate", "item-jade-slip"], tension: 73, unresolvedQuestion: "Will the formation expose a sect crime or attract stronger forces?" }
    ],
    warnings: []
  };
}

export function createNovelWorldProject(input: { title?: string; genreTone?: string; id?: string } = {}): NovelWorldProject {
  const createdAt = nowIso();
  const graph = normalizeNovelWorldGraph({
    id: input.id || "novel-world-project-graph",
    title: input.title || "Untitled novel project",
    genreTone: input.genreTone || "Unspecified",
    premise: "Analyze chapters to build the world graph.",
    observerBrief: "Paste chapters, analyze each one, then inspect the merged world state.",
    entities: [],
    relationships: [],
    events: [],
    development: [],
    warnings: []
  });
  return {
    version: 2,
    id: input.id || `novel-project-${createdAt}`,
    title: input.title || "Untitled novel project",
    genreTone: input.genreTone || "Unspecified",
    chapters: [],
    themeRegistry: createDefaultNovelThemeDefinitions(),
    identityRegistry: { version: 1, decisions: [], updatedAt: createdAt },
    mergedGraph: graph,
    mergeReport: emptyMergeReport(),
    createdAt,
    updatedAt: createdAt
  };
}

function entityKey(entity: NovelEntity) {
  return `${entity.kind}:${stableSlug(entity.name)}`;
}

function identityWords(value: string) {
  return new Set(stableSlug(value).split("-").filter((word) => word.length > 1));
}

function identityOverlap(left: string, right: string) {
  const leftWords = identityWords(left);
  const rightWords = identityWords(right);
  if (!leftWords.size || !rightWords.size) return 0;
  const matches = Array.from(leftWords).filter((word) => rightWords.has(word)).length;
  return matches / Math.max(leftWords.size, rightWords.size);
}

function entityNeighborNames(graph: NovelWorldGraph, entityId: string) {
  const entityNames = new Map(graph.entities.map((entity) => [entity.id, entity.name]));
  return unique(graph.relationships.flatMap((relationship) => {
    if (relationship.fromEntityId === entityId) return [entityNames.get(relationship.toEntityId) || ""];
    if (relationship.toEntityId === entityId) return [entityNames.get(relationship.fromEntityId) || ""];
    return [];
  }).filter(Boolean).map(stableSlug));
}

function scoreIdentityCandidate(
  source: NovelEntity,
  canonical: NovelEntity,
  sourceNeighbors: string[],
  canonicalNeighbors: string[]
) {
  if (source.kind !== canonical.kind) return { confidence: 0, reasons: ["entity-kind-conflict"] };
  const sourceName = stableSlug(source.name);
  const canonicalName = stableSlug(canonical.name);
  const reasons: string[] = ["entity-kind-match"];
  let score = 12;
  if (sourceName === canonicalName) {
    score += 70;
    reasons.push("exact-name-match");
  } else if (sourceName.includes(canonicalName) || canonicalName.includes(sourceName)) {
    score += 42;
    reasons.push("name-containment");
  } else {
    const overlap = identityOverlap(source.name, canonical.name);
    score += Math.round(overlap * 35);
    if (overlap > 0) reasons.push("name-token-overlap");
  }
  const roleOverlap = identityOverlap(source.role, canonical.role);
  if (roleOverlap > 0) {
    score += Math.round(roleOverlap * 14);
    reasons.push("role-overlap");
  } else if (source.role && canonical.role && sourceName === canonicalName) {
    score -= 26;
    reasons.push("same-name-role-conflict");
  }
  const traitOverlap = source.traits.filter((trait) => canonical.traits.some((candidate) => stableSlug(candidate) === stableSlug(trait))).length;
  if (traitOverlap) {
    score += Math.min(10, traitOverlap * 5);
    reasons.push("trait-overlap");
  }
  const neighborOverlap = sourceNeighbors.filter((name) => canonicalNeighbors.includes(name)).length;
  if (neighborOverlap) {
    score += Math.min(14, neighborOverlap * 7);
    reasons.push("relationship-neighborhood-overlap");
  }
  const sourceEvidence = (source.evidence || []).map((item) => stableSlug(item.source.quote));
  const canonicalEvidence = (canonical.evidence || []).map((item) => stableSlug(item.source.quote));
  if (sourceEvidence.some((quote) => canonicalEvidence.includes(quote))) {
    score += 8;
    reasons.push("paragraph-evidence-overlap");
  }
  return { confidence: Math.min(100, score), reasons };
}

export function normalizeNovelEntityIdentityRegistry(input?: NovelEntityIdentityRegistry | null): NovelEntityIdentityRegistry {
  const now = nowIso();
  return {
    version: 1,
    decisions: Array.isArray(input?.decisions) ? input.decisions.map((decision, index) => ({
      id: text(decision.id) || `identity-decision-${index + 1}`,
      sourceChapterId: text(decision.sourceChapterId),
      sourceEntityId: text(decision.sourceEntityId),
      sourceName: text(decision.sourceName),
      canonicalEntityId: text(decision.canonicalEntityId),
      canonicalName: text(decision.canonicalName),
      confidence: numberInRange(decision.confidence, 0, 0, 100),
      status: ["auto-merged", "pending", "confirmed", "rejected"].includes(decision.status) ? decision.status : "pending",
      reasons: stringArray(decision.reasons),
      evidence: Array.isArray(decision.evidence) ? decision.evidence.map((item) => normalizeEvidenceSnippet(item)) : [],
      createdAt: text(decision.createdAt) || now,
      updatedAt: text(decision.updatedAt) || now
    })) : [],
    updatedAt: text(input?.updatedAt) || now
  };
}

export function canonicalNovelEntityId(project: NovelWorldProject, sourceEntityId: string, chapterId?: string) {
  const decision = normalizeNovelEntityIdentityRegistry(project.identityRegistry).decisions.find((item) =>
    item.sourceEntityId === sourceEntityId
    && (!chapterId || item.sourceChapterId === chapterId)
    && (item.status === "auto-merged" || item.status === "confirmed")
  );
  return decision?.canonicalEntityId || sourceEntityId;
}

export function resolveNovelEntityIdentity(
  project: NovelWorldProject,
  decisionId: string,
  status: "confirmed" | "rejected"
): NovelWorldProject {
  const registry = normalizeNovelEntityIdentityRegistry(project.identityRegistry);
  const now = nowIso();
  const decisions = registry.decisions.map((decision) => decision.id === decisionId ? { ...decision, status, updatedAt: now } : decision);
  if (!decisions.some((decision) => decision.id === decisionId)) return project;
  const identityRegistry = { version: 1 as const, decisions, updatedAt: now };
  const { graph, report, registry: nextRegistry } = mergeNovelWorldGraphs(project.chapters, {
    id: `${project.id}-graph`,
    title: project.title,
    genreTone: project.genreTone,
    identityRegistry
  });
  return { ...project, identityRegistry: nextRegistry, mergedGraph: graph, mergeReport: report, updatedAt: now };
}

function relationshipKey(relationship: NovelRelationship) {
  return `${relationship.fromEntityId}->${relationship.toEntityId}:${stableSlug(relationship.label)}`;
}

function mergeSummary(current: string, next: string) {
  if (!next || current.includes(next)) return current;
  if (!current || next.includes(current)) return next;
  return `${current} / ${next}`;
}

export function mergeNovelWorldGraphs(
  chapters: NovelChapterAnalysis[],
  input: { title?: string; genreTone?: string; id?: string; identityRegistry?: NovelEntityIdentityRegistry } = {}
): { graph: NovelWorldGraph; report: NovelWorldMergeReport; registry: NovelEntityIdentityRegistry } {
  const analyzed = chapters.filter((chapter) => chapter.status === "ready" && chapter.graph);
  const report: NovelWorldMergeReport = {
    ...emptyMergeReport(),
    chapterCount: chapters.length,
    analyzedChapterCount: analyzed.length
  };
  const graph: NovelWorldGraph = normalizeNovelWorldGraph({
    id: input.id || "merged-novel-world",
    title: input.title || analyzed[0]?.graph?.title || "Merged novel world",
    genreTone: input.genreTone || analyzed[0]?.graph?.genreTone || "Unspecified",
    premise: analyzed.map((chapter) => chapter.graph?.premise).filter(Boolean).join(" / ") || "Merged chapter world graph.",
    observerBrief: "Merged observer view across analyzed chapters.",
    entities: [],
    relationships: [],
    events: [],
    development: [],
    warnings: []
  });

  const entitiesById = new Map<string, NovelEntity>();
  const idsByKey = new Map<string, string>();
  const remapByChapter = new Map<string, Map<string, string>>();
  const relationshipsByKey = new Map<string, NovelRelationship>();
  const events: NovelEvent[] = [];
  const developmentByKey = new Map<string, NovelWorldDevelopmentStep>();
  const canonicalNeighbors = new Map<string, string[]>();
  const existingRegistry = normalizeNovelEntityIdentityRegistry(input.identityRegistry);
  const identityDecisions = new Map(existingRegistry.decisions.map((decision) => [
    `${decision.sourceChapterId}:${decision.sourceEntityId}:${decision.canonicalEntityId}`,
    decision
  ]));

  for (const chapter of analyzed) {
    const chapterId = chapter.input.id;
    const sourceGraph = normalizeNovelWorldGraph(chapter.graph);
    const chapterRemap = new Map<string, string>();
    remapByChapter.set(chapterId, chapterRemap);

    for (const entity of sourceGraph.entities) {
      const key = entityKey(entity);
      const sourceNeighbors = entityNeighborNames(sourceGraph, entity.id);
      const forcedDecision = existingRegistry.decisions.find((decision) =>
        decision.sourceChapterId === chapterId
        && decision.sourceEntityId === entity.id
        && (decision.status === "confirmed" || decision.status === "auto-merged")
        && entitiesById.has(decision.canonicalEntityId)
      );
      const scoredCandidates = Array.from(entitiesById.values())
        .map((candidate) => ({ candidate, ...scoreIdentityCandidate(entity, candidate, sourceNeighbors, canonicalNeighbors.get(candidate.id) || []) }))
        .filter((candidate) => candidate.confidence >= 52)
        .sort((a, b) => b.confidence - a.confidence || a.candidate.id.localeCompare(b.candidate.id));
      const bestCandidate = scoredCandidates[0];
      const rejected = bestCandidate ? identityDecisions.get(`${chapterId}:${entity.id}:${bestCandidate.candidate.id}`)?.status === "rejected" : false;
      const autoCandidate = bestCandidate && bestCandidate.confidence >= 78 && !rejected ? bestCandidate : undefined;
      const existingId = forcedDecision?.canonicalEntityId || (!rejected
        ? (entitiesById.has(entity.id) ? entity.id : idsByKey.get(key) || autoCandidate?.candidate.id)
        : undefined);
      if (bestCandidate && !forcedDecision) {
        const decisionKey = `${chapterId}:${entity.id}:${bestCandidate.candidate.id}`;
        const previous = identityDecisions.get(decisionKey);
        const status = previous?.status || (bestCandidate.confidence >= 78 ? "auto-merged" : "pending");
        const timestamp = previous?.createdAt || nowIso();
        identityDecisions.set(decisionKey, {
          id: previous?.id || `identity-${stableSlug(chapterId)}-${stableSlug(entity.id)}-${stableSlug(bestCandidate.candidate.id)}`,
          sourceChapterId: chapterId,
          sourceEntityId: entity.id,
          sourceName: entity.name,
          canonicalEntityId: bestCandidate.candidate.id,
          canonicalName: bestCandidate.candidate.name,
          confidence: bestCandidate.confidence,
          status,
          reasons: bestCandidate.reasons,
          evidence: entity.evidence || [],
          createdAt: timestamp,
          updatedAt: nowIso()
        });
      }
      if (!existingId) {
        const next: NovelEntity = {
          ...entity,
          sourceChapterIds: unique([...(entity.sourceChapterIds || []), chapterId]),
          firstSeenChapterId: entity.firstSeenChapterId || chapterId,
          lastUpdatedChapterId: chapterId
        };
        entitiesById.set(next.id, next);
        idsByKey.set(key, next.id);
        chapterRemap.set(entity.id, next.id);
        report.addedEntityIds.push(next.id);
        report.changes.push({ chapterId, kind: "entity", id: next.id, action: "added", label: next.name, detail: "New entity introduced." });
        canonicalNeighbors.set(next.id, sourceNeighbors);
        continue;
      }

      const existing = entitiesById.get(existingId)!;
      chapterRemap.set(entity.id, existingId);
      if (existing.kind !== entity.kind) {
        report.conflicts.push({
          id: `conflict-${chapterId}-${entity.id}-kind`,
          chapterId,
          kind: "entity",
          targetId: existingId,
          message: `${entity.name} was extracted as ${entity.kind}, but existing entity is ${existing.kind}.`
        });
        report.changes.push({ chapterId, kind: "entity", id: existingId, action: "conflict", label: existing.name, detail: "Entity kind conflict." });
        continue;
      }

      const changed = existing.role !== entity.role || existing.summary !== entity.summary || entity.traits.some((trait) => !existing.traits.includes(trait));
      existing.role = existing.role === entity.role ? existing.role : mergeSummary(existing.role, entity.role);
      existing.summary = mergeSummary(existing.summary, entity.summary);
      existing.traits = unique([...existing.traits, ...entity.traits]).slice(0, 12);
      existing.tension = Math.max(existing.tension || 0, entity.tension || 0) || undefined;
      existing.x = typeof existing.x === "number" && typeof entity.x === "number" ? Math.round((existing.x + entity.x) / 2) : existing.x ?? entity.x;
      existing.y = typeof existing.y === "number" && typeof entity.y === "number" ? Math.round((existing.y + entity.y) / 2) : existing.y ?? entity.y;
      existing.sourceChapterIds = unique([...(existing.sourceChapterIds || []), chapterId]);
      existing.lastUpdatedChapterId = chapterId;
      existing.evidence = [...(existing.evidence || []), ...(entity.evidence || [])];
      canonicalNeighbors.set(existingId, unique([...(canonicalNeighbors.get(existingId) || []), ...sourceNeighbors]));
      report.mergedEntityIds.push(existingId);
      report.changes.push({
        chapterId,
        kind: "entity",
        id: existingId,
        action: changed ? "changed" : "merged",
        label: existing.name,
        detail: changed ? "Entity details were expanded or revised." : "Entity matched an existing world node."
      });
      if (changed) report.changedEntityIds.push(existingId);
    }
  }

  for (const chapter of analyzed) {
    const chapterId = chapter.input.id;
    const sourceGraph = normalizeNovelWorldGraph(chapter.graph);
    const chapterRemap = remapByChapter.get(chapterId) || new Map<string, string>();

    for (const relationship of sourceGraph.relationships) {
      const fromEntityId = chapterRemap.get(relationship.fromEntityId) || relationship.fromEntityId;
      const toEntityId = chapterRemap.get(relationship.toEntityId) || relationship.toEntityId;
      const mapped: NovelRelationship = { ...relationship, fromEntityId, toEntityId };
      const key = relationshipKey(mapped);
      const existing = relationshipsByKey.get(key);
      if (!entitiesById.has(fromEntityId) || !entitiesById.has(toEntityId)) {
        report.conflicts.push({
          id: `conflict-${chapterId}-${relationship.id}-dangling`,
          chapterId,
          kind: "relationship",
          targetId: relationship.id,
          message: `Relationship ${relationship.id} references an unknown entity after merge.`
        });
        continue;
      }
      if (!existing) {
        relationshipsByKey.set(key, {
          ...mapped,
          id: `${chapterId}-${mapped.id}`,
          sourceChapterIds: unique([...(mapped.sourceChapterIds || []), chapterId]),
          firstSeenChapterId: mapped.firstSeenChapterId || chapterId,
          lastUpdatedChapterId: chapterId
        });
        report.changes.push({ chapterId, kind: "relationship", id: `${chapterId}-${mapped.id}`, action: "added", label: mapped.label, detail: "New relationship introduced." });
        continue;
      }
      if (existing.polarity !== mapped.polarity) {
        report.conflicts.push({
          id: `conflict-${chapterId}-${relationship.id}-polarity`,
          chapterId,
          kind: "relationship",
          targetId: existing.id,
          message: `${existing.label} changed polarity from ${existing.polarity} to ${mapped.polarity}.`
        });
      }
      existing.evidence = mergeSummary(existing.evidence, mapped.evidence);
      existing.strength = Math.max(existing.strength, mapped.strength);
      existing.sourceChapterIds = unique([...(existing.sourceChapterIds || []), chapterId]);
      existing.lastUpdatedChapterId = chapterId;
      report.changes.push({ chapterId, kind: "relationship", id: existing.id, action: "merged", label: existing.label, detail: "Relationship evidence was merged." });
    }

    for (const event of sourceGraph.events) {
      const nextEvent: NovelEvent = {
        ...event,
        id: `${chapterId}-${event.id}`,
        sourceChapterId: chapterId,
        order: events.length + 1,
        locationEntityId: event.locationEntityId ? chapterRemap.get(event.locationEntityId) || event.locationEntityId : undefined,
        participantEntityIds: event.participantEntityIds.map((id) => chapterRemap.get(id) || id)
      };
      events.push(nextEvent);
      report.changes.push({ chapterId, kind: "event", id: nextEvent.id, action: "added", label: nextEvent.title, detail: "Event appended to unified timeline." });
    }

    for (const step of sourceGraph.development) {
      const involvedEntityIds = step.involvedEntityIds.map((id) => chapterRemap.get(id) || id);
      const key = `${stableSlug(step.title)}:${involvedEntityIds.sort().join(",")}`;
      const existing = developmentByKey.get(key);
      if (!existing) {
        developmentByKey.set(key, {
          ...step,
          id: `${chapterId}-${step.id}`,
          involvedEntityIds,
          sourceChapterIds: unique([...(step.sourceChapterIds || []), chapterId])
        });
        report.changes.push({ chapterId, kind: "development", id: `${chapterId}-${step.id}`, action: "added", label: step.title, detail: "New unresolved development thread." });
      } else {
        existing.trigger = mergeSummary(existing.trigger, step.trigger);
        existing.likelyOutcome = mergeSummary(existing.likelyOutcome, step.likelyOutcome);
        existing.tension = Math.max(existing.tension, step.tension);
        existing.unresolvedQuestion = mergeSummary(existing.unresolvedQuestion, step.unresolvedQuestion);
        existing.sourceChapterIds = unique([...(existing.sourceChapterIds || []), chapterId]);
        report.changes.push({ chapterId, kind: "development", id: existing.id, action: "merged", label: existing.title, detail: "Development thread was extended." });
      }
    }
  }

  graph.entities = Array.from(entitiesById.values());
  graph.relationships = Array.from(relationshipsByKey.values());
  graph.events = events;
  graph.development = Array.from(developmentByKey.values());
  graph.warnings = report.conflicts.map((conflict) => conflict.message);
  report.addedEntityIds = unique(report.addedEntityIds);
  report.mergedEntityIds = unique(report.mergedEntityIds);
  report.changedEntityIds = unique(report.changedEntityIds);
  const validation = validateNovelWorldGraph(graph);
  report.valid = validation.valid && report.conflicts.length === 0;
  graph.warnings = unique([...graph.warnings, ...validation.warnings]);
  return {
    graph,
    report,
    registry: {
      version: 1,
      decisions: Array.from(identityDecisions.values()).sort((a, b) => a.sourceChapterId.localeCompare(b.sourceChapterId) || b.confidence - a.confidence),
      updatedAt: nowIso()
    }
  };
}

export function addNovelChapterAnalysis(project: NovelWorldProject, analysis: NovelChapterAnalysis): NovelWorldProject {
  const chapters = [...project.chapters.filter((chapter) => chapter.input.id !== analysis.input.id), analysis].sort((a, b) => a.input.order - b.input.order);
  const { graph, report, registry } = mergeNovelWorldGraphs(chapters, {
    id: `${project.id}-graph`,
    title: project.title,
    genreTone: project.genreTone,
    identityRegistry: project.identityRegistry
  });
  return {
    ...project,
    chapters,
    themeRegistry: normalizeNovelThemeRegistry(project.themeRegistry),
    identityRegistry: registry,
    mergedGraph: graph,
    mergeReport: report,
    updatedAt: nowIso()
  };
}

export function validateNovelWorldProject(project: NovelWorldProject): NovelWorldValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (project.version !== 2) errors.push("project version must be 2.");
  if (!project.title.trim()) errors.push("project title is required.");
  const chapterIds = new Set<string>();
  const registry = normalizeNovelThemeRegistry(project.themeRegistry);
  const identityRegistry = normalizeNovelEntityIdentityRegistry(project.identityRegistry);
  const canonicalEntityIds = new Set(project.mergedGraph.entities.map((entity) => entity.id));
  const identityDecisionIds = new Set<string>();
  for (const decision of identityRegistry.decisions) {
    if (identityDecisionIds.has(decision.id)) errors.push(`duplicate identity decision id: ${decision.id}`);
    identityDecisionIds.add(decision.id);
    if (!decision.sourceChapterId || !decision.sourceEntityId) errors.push(`identity decision ${decision.id} has no source reference.`);
    if (!canonicalEntityIds.has(decision.canonicalEntityId) && decision.status !== "rejected") warnings.push(`identity decision ${decision.id} references a non-current canonical entity.`);
  }
  for (const chapter of project.chapters) {
    if (chapterIds.has(chapter.input.id)) errors.push(`duplicate chapter id: ${chapter.input.id}`);
    chapterIds.add(chapter.input.id);
    if (!chapter.input.title.trim()) warnings.push(`chapter ${chapter.input.id} has no title.`);
    if (chapter.status === "ready" && !chapter.graph) errors.push(`chapter ${chapter.input.id} is ready but has no graph.`);
    if (chapter.graph && chapter.characterStates?.length) {
      const stateReport = validateNovelCharacterStatePoints(chapter.characterStates, chapter.graph);
      errors.push(...stateReport.errors);
      warnings.push(...stateReport.warnings);
    }
    if (chapter.graph && chapter.themeSignals?.length) {
      const themeReport = validateNovelThemeSignals(chapter.themeSignals, registry, chapter.graph);
      errors.push(...themeReport.errors);
      warnings.push(...themeReport.warnings);
    }
  }
  const graphReport = validateNovelWorldGraph(project.mergedGraph);
  if (project.chapters.some((chapter) => chapter.status === "ready")) {
    errors.push(...graphReport.errors);
  }
  warnings.push(...graphReport.warnings, ...project.mergeReport.conflicts.map((conflict) => conflict.message));
  return { valid: errors.length === 0, errors, warnings };
}

export function normalizeNovelChapterBlueprint(input: unknown): NovelChapterBlueprint {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const sceneBeats: NovelSceneBeat[] = (Array.isArray(raw.sceneBeats) ? raw.sceneBeats : []).map((item, index) => {
    const source = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const title = text(source.title) || `Scene beat ${index + 1}`;
    return {
      id: text(source.id) || stableId("beat", title, index),
      order: typeof source.order === "number" ? source.order : index + 1,
      title,
      purpose: text(source.purpose) || "Move the chapter toward the next conflict point.",
      locationEntityId: text(source.locationEntityId) || undefined,
      involvedEntityIds: stringArray(source.involvedEntityIds),
      sourceEventIds: stringArray(source.sourceEventIds),
      tension: numberInRange(source.tension, 50, 0, 100),
      outcome: text(source.outcome) || "The world state changes in a visible way.",
      evidence: evidenceArray(source.evidence)
    };
  }).sort((a, b) => a.order - b.order);

  const foreshadowingPayoffs: NovelForeshadowingPayoff[] = (Array.isArray(raw.foreshadowingPayoffs) ? raw.foreshadowingPayoffs : []).map((item, index) => {
    const source = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const setup = text(source.setup) || `Unresolved setup ${index + 1}`;
    const urgency = blueprintSeverity.has(source.urgency as NovelForeshadowingPayoff["urgency"]) ? (source.urgency as NovelForeshadowingPayoff["urgency"]) : "medium";
    return {
      id: text(source.id) || stableId("payoff", setup, index),
      setup,
      payoff: text(source.payoff) || "Pay this setup off through a concrete choice or discovery.",
      relatedEntityIds: stringArray(source.relatedEntityIds),
      relatedEventIds: stringArray(source.relatedEventIds),
      urgency,
      evidence: evidenceArray(source.evidence)
    };
  });

  const writingRisks: NovelWritingRisk[] = (Array.isArray(raw.writingRisks) ? raw.writingRisks : []).map((item, index) => {
    const source = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const message = text(source.message) || `Writing risk ${index + 1}`;
    return {
      id: text(source.id) || stableId("risk", message, index),
      severity: blueprintSeverity.has(source.severity as NovelWritingRisk["severity"]) ? (source.severity as NovelWritingRisk["severity"]) : "medium",
      message,
      mitigation: text(source.mitigation) || "Make the causal link explicit in a scene beat.",
      relatedEntityIds: stringArray(source.relatedEntityIds),
      evidence: evidenceArray(source.evidence)
    };
  });

  return {
    id: text(raw.id) || "novel-chapter-blueprint",
    afterChapterId: text(raw.afterChapterId) || undefined,
    targetChapterTitle: text(raw.targetChapterTitle) || "Next Chapter",
    wordCountRange: text(raw.wordCountRange) || "2500-4000 words",
    narrativePerspective: text(raw.narrativePerspective) || "close third person",
    pacing: blueprintPacing.has(raw.pacing as NovelBlueprintOptions["pacing"]) ? (raw.pacing as NovelBlueprintOptions["pacing"]) : "balanced",
    chapterGoal: text(raw.chapterGoal) || "Turn the merged world tension into a concrete next chapter plan.",
    sceneBeats,
    characterMotivations: stringArray(raw.characterMotivations),
    conflictEscalation: stringArray(raw.conflictEscalation),
    foreshadowingPayoffs,
    writingRisks,
    summary: text(raw.summary) || "A read-only writing blueprint generated from the current world graph.",
    warnings: stringArray(raw.warnings)
  };
}

export function validateNovelChapterBlueprint(blueprint: NovelChapterBlueprint, project?: NovelWorldProject): NovelWorldValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [...blueprint.warnings];
  if (!blueprint.targetChapterTitle.trim()) errors.push("targetChapterTitle is required.");
  if (!blueprint.chapterGoal.trim()) errors.push("chapterGoal is required.");
  if (!blueprint.sceneBeats.length) errors.push("at least one scene beat is required.");

  const entityIds = new Set(project?.mergedGraph.entities.map((entity) => entity.id) || []);
  const eventIds = new Set(project?.mergedGraph.events.map((event) => event.id) || []);
  const beatIds = new Set<string>();
  const payoffIds = new Set<string>();
  const riskIds = new Set<string>();

  for (const beat of blueprint.sceneBeats) {
    if (beatIds.has(beat.id)) errors.push(`duplicate scene beat id: ${beat.id}`);
    beatIds.add(beat.id);
    if (!beat.title.trim()) errors.push(`scene beat ${beat.id} is missing a title.`);
    if (project && beat.locationEntityId && !entityIds.has(beat.locationEntityId)) errors.push(`scene beat ${beat.id} has unknown locationEntityId: ${beat.locationEntityId}`);
    if (project) {
      for (const entityId of beat.involvedEntityIds) {
        if (!entityIds.has(entityId)) errors.push(`scene beat ${beat.id} has unknown involvedEntityId: ${entityId}`);
      }
      for (const eventId of beat.sourceEventIds) {
        if (!eventIds.has(eventId)) errors.push(`scene beat ${beat.id} has unknown sourceEventId: ${eventId}`);
      }
    }
  }

  for (const payoff of blueprint.foreshadowingPayoffs) {
    if (payoffIds.has(payoff.id)) errors.push(`duplicate payoff id: ${payoff.id}`);
    payoffIds.add(payoff.id);
    if (project) {
      for (const entityId of payoff.relatedEntityIds) {
        if (!entityIds.has(entityId)) errors.push(`payoff ${payoff.id} has unknown relatedEntityId: ${entityId}`);
      }
      for (const eventId of payoff.relatedEventIds) {
        if (!eventIds.has(eventId)) errors.push(`payoff ${payoff.id} has unknown relatedEventId: ${eventId}`);
      }
    }
  }

  for (const risk of blueprint.writingRisks) {
    if (riskIds.has(risk.id)) errors.push(`duplicate writing risk id: ${risk.id}`);
    riskIds.add(risk.id);
    if (project) {
      for (const entityId of risk.relatedEntityIds) {
        if (!entityIds.has(entityId)) errors.push(`risk ${risk.id} has unknown relatedEntityId: ${entityId}`);
      }
    }
  }

  if (!blueprint.characterMotivations.length) warnings.push("no character motivation notes were generated.");
  if (!blueprint.conflictEscalation.length) warnings.push("no conflict escalation notes were generated.");
  return { valid: errors.length === 0, errors, warnings };
}

export function collectBlueprintEvidence(blueprint: NovelChapterBlueprint): NovelEvidenceSnippet[] {
  return [
    ...blueprint.sceneBeats.flatMap((beat) => beat.evidence || []),
    ...blueprint.foreshadowingPayoffs.flatMap((payoff) => payoff.evidence || []),
    ...blueprint.writingRisks.flatMap((risk) => risk.evidence || [])
  ];
}

export function validateEvidenceAwareNovelChapterBlueprint(blueprint: NovelChapterBlueprint, project: NovelWorldProject, chapters: NovelLongChapterText[]): NovelWorldValidationReport {
  const blueprintReport = validateNovelChapterBlueprint(blueprint, project);
  const evidenceReport = validateEvidenceSnippets(collectBlueprintEvidence(blueprint), chapters);
  return {
    valid: blueprintReport.valid && evidenceReport.valid,
    errors: [...blueprintReport.errors, ...evidenceReport.errors],
    warnings: [...blueprintReport.warnings, ...evidenceReport.warnings]
  };
}

export function createFallbackNovelChapterBlueprint(
  project: NovelWorldProject,
  afterChapterId?: string,
  options: Partial<NovelBlueprintOptions> = {}
): NovelChapterBlueprint {
  const hasProjectGraph = project.mergedGraph.entities.length > 0;
  const graph = hasProjectGraph ? project.mergedGraph : createFallbackNovelWorldGraph(project.title, project.genreTone);
  const characters = graph.entities.filter((entity) => entity.kind === "character");
  const locations = graph.entities.filter((entity) => entity.kind === "location");
  const tensions = [...graph.development].sort((a, b) => b.tension - a.tension);
  const latestEvent = graph.events[graph.events.length - 1];
  const lead = characters[0] || graph.entities[0];
  const partner = characters[1] || graph.entities[1] || lead;
  const location = locations[0] || graph.entities.find((entity) => entity.kind !== "character");
  const topTension = tensions[0];
  const graphEvidence = collectGraphEvidence(graph);
  const pickEvidence = (offset: number) => graphEvidence[offset % Math.max(graphEvidence.length, 1)] ? [graphEvidence[offset % graphEvidence.length]] : [];
  const wordCountRange = options.wordCountRange || "2500-4000 words";
  const narrativePerspective = options.narrativePerspective || "close third person";
  const pacing = options.pacing && blueprintPacing.has(options.pacing) ? options.pacing : "balanced";
  const emphasizePayoffs = options.emphasizePayoffs ?? true;

  return normalizeNovelChapterBlueprint({
    id: `blueprint-${stableSlug(project.id)}-${Date.now()}`,
    afterChapterId,
    targetChapterTitle: `Next Chapter after ${project.chapters.find((chapter) => chapter.input.id === afterChapterId)?.input.title || "latest chapter"}`,
    wordCountRange,
    narrativePerspective,
    pacing,
    chapterGoal: topTension
      ? `Turn "${topTension.title}" from unresolved pressure into an irreversible choice.`
      : "Convert the current world graph into one concrete conflict and one visible consequence.",
    sceneBeats: [
      {
        id: "beat-reentry",
        order: 1,
        title: "Re-enter the pressure point",
        purpose: latestEvent ? `Open from the consequence of "${latestEvent.title}".` : "Open on the strongest current tension.",
        locationEntityId: hasProjectGraph ? location?.id : undefined,
        involvedEntityIds: hasProjectGraph ? unique([lead?.id, partner?.id].filter(Boolean) as string[]) : [],
        sourceEventIds: hasProjectGraph && latestEvent ? [latestEvent.id] : [],
        tension: 58,
        outcome: "The reader sees what changed since the previous chapter.",
        evidence: pickEvidence(0)
      },
      {
        id: "beat-choice",
        order: 2,
        title: "Force a private choice",
        purpose: `${lead?.name || "The lead character"} must choose between safety and the unresolved plot force.`,
        locationEntityId: hasProjectGraph ? location?.id : undefined,
        involvedEntityIds: hasProjectGraph ? unique([lead?.id, partner?.id].filter(Boolean) as string[]) : [],
        sourceEventIds: hasProjectGraph && latestEvent ? [latestEvent.id] : [],
        tension: 76,
        outcome: "A relationship or faction pressure visibly shifts.",
        evidence: pickEvidence(1)
      },
      {
        id: "beat-turn",
        order: 3,
        title: "End with a world-state turn",
        purpose: topTension ? `Answer part of "${topTension.unresolvedQuestion}" without resolving the full mystery.` : "Reveal a consequence that widens the world.",
        locationEntityId: hasProjectGraph ? location?.id : undefined,
        involvedEntityIds: hasProjectGraph ? graph.entities.slice(0, 3).map((entity) => entity.id) : [],
        sourceEventIds: hasProjectGraph ? graph.events.slice(-2).map((event) => event.id) : [],
        tension: pacing === "high-tension" ? 90 : 82,
        outcome: "The next chapter has a sharper conflict hook.",
        evidence: pickEvidence(2)
      }
    ],
    characterMotivations: characters.slice(0, 4).map((entity) => `${entity.name}: push their ${entity.role} role through ${entity.traits[0] || "a concrete desire"}.`),
    conflictEscalation: [
      topTension ? `Escalate ${topTension.title}: ${topTension.trigger}` : "Escalate the highest-tension relationship in the graph.",
      latestEvent ? `Make the consequence of "${latestEvent.title}" visible in a new scene.` : "Add one public consequence and one private consequence.",
      "End the chapter with a changed constraint, not only new information."
    ],
    foreshadowingPayoffs: [
      {
        id: "payoff-primary",
        setup: topTension?.unresolvedQuestion || graph.development[0]?.unresolvedQuestion || "The current unresolved world force",
        payoff: emphasizePayoffs ? "Reveal one usable clue while preserving the larger answer." : "Echo the setup through action rather than explanation.",
        relatedEntityIds: hasProjectGraph ? topTension?.involvedEntityIds || graph.entities.slice(0, 2).map((entity) => entity.id) : [],
        relatedEventIds: hasProjectGraph ? graph.events.slice(-2).map((event) => event.id) : [],
        urgency: emphasizePayoffs ? "high" : "medium",
        evidence: pickEvidence(3)
      }
    ],
    writingRisks: [
      {
        id: "risk-summary",
        severity: "medium",
        message: "The chapter could become summary-heavy if the world graph is explained instead of dramatized.",
        mitigation: "Turn every explanation into a choice, obstacle, or scene consequence.",
        relatedEntityIds: hasProjectGraph && lead ? [lead.id] : [],
        evidence: pickEvidence(4)
      },
      {
        id: "risk-thread",
        severity: topTension ? "high" : "medium",
        message: "Unresolved tensions may stack without visible payoff.",
        mitigation: "Pay off one small setup and create one larger question for the next chapter.",
        relatedEntityIds: hasProjectGraph ? topTension?.involvedEntityIds || [] : [],
        evidence: pickEvidence(5)
      }
    ],
    summary: "Use this as a read-only blueprint: copy useful beats into prose, but keep the world project unchanged.",
    warnings: []
  });
}
