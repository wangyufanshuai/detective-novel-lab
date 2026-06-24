export type Provider = "deepseek" | "siliconflow";

export type Character = {
  id: string;
  name: string;
  role: string;
  publicBio: string;
  secret: string;
  motive: string;
  means: string;
  opportunity: string;
  isCulprit: boolean;
  alibi: string;
  initialStatement: string;
  knowledgeScope: string[];
  liePolicy: string;
  contradictionTriggers: string[];
};

export type Evidence = {
  id: string;
  title: string;
  location: string;
  visibleDescription: string;
  trueMeaning: string;
  relatedCharacterIds: string[];
  relatedTime?: string;
  discoverable: boolean;
  isKey: boolean;
  unlocks: string[];
  contradicts: string[];
  supportsConclusion: string[];
  discoveryDifficulty: "easy" | "medium" | "hard";
};

export type Scene = {
  id: string;
  name: string;
  description: string;
  evidenceIds: string[];
};

export type TimelineEvent = {
  id: string;
  time: string;
  event: string;
  characterIds: string[];
  isPublic: boolean;
  source: string;
  publicVersion: string;
  contradictedByEvidenceIds: string[];
};

export type Relationship = {
  from: string;
  to: string;
  label: string;
};

export type CaseTruth = {
  culpritId: string;
  motive: string;
  method: string;
  opportunity: string;
  decisiveEvidenceIds: string[];
  trueTimeline: TimelineEvent[];
};

export type SuspectMatrixRow = {
  characterId: string;
  name: string;
  motive: boolean;
  means: boolean;
  opportunity: boolean;
  excludedByEvidenceIds: string[];
  completeAndUnexcluded: boolean;
  isCulprit: boolean;
};

export type ExclusionChain = {
  characterId: string;
  reason: string;
  evidenceIds: string[];
};

export type ReasoningStep = {
  id: string;
  conclusion: string;
  evidenceIds: string[];
};

export type LogicPuzzle = {
  suspectMatrix: SuspectMatrixRow[];
  exclusionChains: ExclusionChain[];
  criticalReasoningChain: ReasoningStep[];
  redHerrings: string[];
  requiredClueOrder: string[];
};

export type DeductionCase = {
  id: string;
  title: string;
  theme: string;
  premise: string;
  publicCaseFile: string;
  truth: CaseTruth;
  characters: Character[];
  evidence: Evidence[];
  scenes: Scene[];
  relationships: Relationship[];
  logicPuzzle: LogicPuzzle;
};

export type PlayerTheory = {
  culpritId: string;
  motive: string;
  method: string;
  evidenceIds: string[];
};

export type TimelineContradiction = {
  eventId: string;
  time: string;
  publicVersion: string;
  trueEvent: string;
  evidenceIds: string[];
  revealed: boolean;
};

export type ReasoningCoverage = {
  requiredEvidenceIds: string[];
  coveredEvidenceIds: string[];
  missingEvidenceIds: string[];
  coverageRatio: number;
};

export type CaseProofObligationKind =
  | "motive"
  | "means"
  | "opportunity"
  | "timeline"
  | "contradiction"
  | "exclusion"
  | "source"
  | "conclusion";

export type CaseProofObligation = {
  id: string;
  kind: CaseProofObligationKind;
  label: string;
  detail: string;
  lowSpoilerLabel: string;
  lowSpoilerDetail: string;
  required: boolean;
  characterIds: string[];
  evidenceIds: string[];
  eventIds: string[];
  memoryIds: string[];
  source: "truth" | "reasoning" | "testimony" | "exclusion" | "sourceMap";
};

export type CaseProofGap = {
  obligationId: string;
  kind: CaseProofObligationKind;
  label: string;
  detail: string;
  missingEvidenceIds: string[];
  missingEventIds: string[];
  missingMemoryIds: string[];
  target: "evidence" | "suspects" | "motive" | "method" | "logic" | "exclusion";
};

export type CaseProofCoverage = {
  caseId: string;
  totalRequired: number;
  coveredRequired: number;
  coverageRatio: number;
  complete: boolean;
  coveredObligationIds: string[];
  missingObligationIds: string[];
  gaps: CaseProofGap[];
};

export type CaseTruthLedger = {
  caseId: string;
  valid: boolean;
  obligations: CaseProofObligation[];
  gaps: CaseProofGap[];
  sourceEventCount: number;
  discoverableEvidenceCount: number;
  requiredEvidenceIds: string[];
};

export type RuleReport = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  issues: string[];
  suspectMatrix: SuspectMatrixRow[];
  timelineContradictions: TimelineContradiction[];
  reasoningCoverage: ReasoningCoverage;
  fixSuggestions: string[];
};

export type CaseValidation = RuleReport;

export type SchemaIssue = {
  path: string;
  message: string;
  severity: "error" | "warning";
};

export type SchemaReport = {
  valid: boolean;
  errors: SchemaIssue[];
  warnings: SchemaIssue[];
  normalizedHints: string[];
};

export type EvalCaseKind = "valid" | "invalid" | "drift";

export type EvalCase = {
  id: string;
  name: string;
  kind: EvalCaseKind;
  expectValid: boolean;
  case: DeductionCase;
};

export type EvalCaseResult = {
  id: string;
  name: string;
  kind: EvalCaseKind;
  expectValid: boolean;
  schemaValid: boolean;
  ruleValid: boolean;
  passed: boolean;
  coverage: number;
  errorCount: number;
  warningCount: number;
  driftCompatible: boolean;
  errors: string[];
};

export type EvalReport = {
  generatedAt: string;
  total: number;
  passed: number;
  failed: number;
  averageCoverage: number;
  results: EvalCaseResult[];
};

export type Judgement = {
  accepted: boolean;
  score: number;
  missing: string[];
  contradictions: string[];
  explanation: string;
  proofCoverage?: CaseProofCoverage;
};

export type EvidenceChallenge = {
  hit: boolean;
  characterId: string;
  evidenceId: string;
  exposedContradictions: string[];
  guidance: string;
};
