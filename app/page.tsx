"use client";

import {
  AlertTriangle,
  BookOpen,
  Bot,
  ChevronDown,
  Clock,
  Copy,
  Database,
  FileSearch,
  Gavel,
  GitBranch,
  Loader2,
  Map as MapIcon,
  MessageSquare,
  Network,
  Pause,
  Pin,
  Play,
  RotateCcw,
  Save,
  Search,
  SkipBack,
  SkipForward,
  ShieldCheck,
  ListTree,
  Users
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import DeductionGraphView from "@/app/components/DeductionGraphView";
import { CampaignStudyRecorder } from "@/app/components/CampaignStudyRecorder";
import { deriveCampaignCommandDeckViewModel } from "@/app/campaign/command-deck-model";
import { deriveCommandDeckInstitutionName, useCommandDeckContext } from "@/app/hooks/useCommandDeckContext";
import NovelGameCanvas from "@/app/components/NovelGameCanvas";
import detectiveCaseTypes from "@/content/detective-v1/case-types.json";
import detectiveEscalationRules from "@/content/detective-v1/escalation-rules.json";
import detectiveEventArchetypes from "@/content/detective-v1/event-archetypes.json";
import detectiveEvidenceTypes from "@/content/detective-v1/evidence-types.json";
import detectiveFactions from "@/content/detective-v1/factions.json";
import detectiveLocations from "@/content/detective-v1/locations.json";
import detectiveManifest from "@/content/detective-v1/manifest.json";
import detectiveMotives from "@/content/detective-v1/motives.json";
import detectiveProgressionLines from "@/content/detective-v1/progression-lines.json";
import detectiveRedHerringPatterns from "@/content/detective-v1/red-herring-patterns.json";
import detectiveResources from "@/content/detective-v1/resources.json";
import detectiveRoles from "@/content/detective-v1/roles.json";
import { useDetectiveTownRuntimeView } from "@/app/hooks/useDetectiveTownRuntime";
import { hasContradictionHit, useInvestigationView } from "@/app/hooks/useInvestigationActions";
import { useInspectorSelection } from "@/app/hooks/useInspectorSelection";
import { useGuidedOnboarding, type GuidedTask, type SelectionHighlight } from "@/app/hooks/useGuidedOnboarding";
import { useCampaignComprehensionStudy } from "@/app/hooks/useCampaignComprehensionStudy";
import {
  V1RequestError,
  actorInitial,
  apiUrl,
  cloneLocal,
  downloadTextFile,
  getV1,
  loadLocal,
  postJson,
  postV1,
  resolveRuntimeMode,
  slugifyLabel,
  type V1Result
} from "@/app/lib/client-runtime";
import {
  CAMPAIGN_STUDY_EXPORT_FILE,
  type CampaignStudyStage,
  type CampaignStudyWorldChoice
} from "@/lib/campaign-comprehension-study";
import {
  CaseLogicPanel,
  CausalTracePanel,
  ControlRail,
  DeveloperPanel,
  EmergenceProofPanel,
  EventLogPanel,
  InspectorRail,
  InvestigationPanel,
  AgentControlPanel,
  OnboardingOverlay,
  PersistentTownCommandCenter,
  PlayShell,
  ProofTourPanel,
  SuspectBoardPanel,
  ToastStack,
  TownMapStage,
  type GapCard,
  type GraphNodeExplanation,
  type InvestigationStage,
  type InvestigationToast,
  type InspectorTabId,
  type NpcPopoverState,
  type SuspectExplanation
} from "@/app/components/DetectiveTownUI";
import {
  applyAuthoringPatch,
  advanceNovelSimulation,
  autoSolvePlayableCase,
  buildDetectiveContentAuthoringGuide,
  buildDetectiveContentSummary,
  buildNovelAskQueryPlan,
  buildCaseLogicReport,
  buildNovelCausalityReport,
  buildDeductionGraph,
  buildEvidenceNotebook,
  buildEmergenceProofTrace,
  buildCaseTruthLedger,
  buildPlayableCaseIntake,
  buildPlayerProofTour,
  buildWorldMapSnapshot,
  certifyPlayableCase,
  createCaseGalleryEntry,
  createContentSeedBackupEntry,
  createPremiumAuthoringDraft,
  createStaticDemoRuntime,
  deriveMapInteractiveTargets,
  deriveSuspectBoard,
  discoverDemoEvidence,
  exportAuthoringJson,
  exportAuthoringMarkdown,
  exportCaseGalleryBundle,
  importCaseGalleryEntries,
  interrogateDemoNpc,
  evaluateCaseProofCoverage,
  listCaseTemplates,
  markDemoCrimeObserved,
  addNovelChapterAnalysis,
  attachFallbackEvidenceToGraph,
  applyNovelCorrectionOverlay,
  buildNovelQualityAuditReport,
  collectBlueprintEvidence,
  collectGraphEvidence,
  commitNovelImportDraftToProject,
  createNovelBatchQueue,
  createNovelCorrectionSet,
  createFallbackNovelAskAnswer,
  createFallbackNovelCharacterStates,
  createFallbackEvidenceIndex,
  createFallbackNovelThemeSignals,
  createFallbackNovelChapterBlueprint,
  createFallbackNovelWorldGraph,
  createNovelGameSceneState,
  createNovelGameVisualProfile,
  createSuggestedNovelCorrectionPatches,
  createNovelLongChapterText,
  createNovelSimulationRun,
  createNovelSimulationBranch,
  createNovelProjectRevision,
  createNovelWorldProject,
  createNovelStateSimulation,
  getNextNovelBatchChapterIds,
  mergeNovelThemeDefinitions,
  mergeNovelCharacterArcs,
  mergeNovelThemeArcs,
  normalizeNovelCharacterStatePoints,
  normalizePinnedNovelCharacterIds,
  normalizePinnedNovelCausalChainIds,
  normalizePinnedNovelThemeIds,
  normalizeNovelBatchQueue,
  normalizeNovelImportDraft,
  normalizeNovelChapterBlueprint,
  normalizeNovelCorrectionPatch,
  normalizeNovelCorrectionSet,
  normalizeNovelEntityIdentityRegistry,
  normalizeNovelThemeRegistry,
  normalizeNovelThemeSignals,
  normalizeNovelWorldGraph,
  rankNovelThemeArcs,
  rankNovelCausalChains,
  revealDemoSolution,
  rankNovelCharacterArcs,
  remapNovelThemeSignals,
  revertNovelCorrectionPatch,
  searchNovelAskEvidence,
  rewindNovelSimulation,
  resolveNovelEntityIdentity,
  compareNovelSimulationBranch,
  splitNovelChapterParagraphs,
  splitWholeNovelIntoChapterCandidates,
  submitDemoTheory,
  updateNovelBatchChapterStatus,
  validateEvidenceAwareNovelChapterBlueprint,
  validateEvidenceAwareNovelWorldGraph,
  validateNovelAskAnswer,
  validateNovelCorrectionSet,
  validateNovelGameSceneState,
  validateNovelGameVisualProfile,
  validateNovelSimulationRun,
  validateNovelCausalityReport,
  validateNovelCharacterStatePoints,
  validateNovelThemeSignals,
  validateNovelImportDraft,
  validateNovelChapterBlueprint,
  validateAuthoringDraft,
  selectDefaultDetectiveContentAuthoringSelection,
  validateNovelWorldProject,
  validateNovelWorldGraph
} from "@/lib/engine";
import type {
  AuthoringDraft,
  AuthoringValidationReport,
  CaseGalleryEntry,
  CaseFromLog,
  CaseAutoSolveSummary,
  CaseLogicReport,
  CaseTemplateId,
  DeductionGraphNode,
  DeductionGraph,
  DemoRuntimeState,
  DetectiveContentAuthoringSelection,
  DetectiveContentPack,
  DeepSeekLiveEvalReport,
  EmergenceBenchmarkReport,
  EmergenceProofTrace,
  EvidenceNotebookItem,
  InvestigationProgress,
  MapInteractiveTarget,
  MurderArchetype,
  CaseCandidate,
  NpcActionCandidate,
  NpcAgentState,
  PersistentTownRuntime,
  NovelBatchQueueState,
  NovelAskAnswer,
  NovelAskEvidenceHit,
  NovelAskQueryPlan,
  NovelBlueprintOptions,
  NovelCausalChain,
  NovelCausalClaim,
  NovelCausalEdge,
  NovelChapterBlueprint,
  NovelCharacterArc,
  NovelCharacterStatePoint,
  NovelCorrectionPatch,
  NovelCorrectionSet,
  NovelThemeArc,
  NovelThemeDefinition,
  NovelThemeSignal,
  NovelChapterImportCandidate,
  NovelEvidenceIndex,
  NovelEvidenceSnippet,
  NovelEntityIdentityDecision,
  NovelEntityIdentityRegistry,
  NovelEntity,
  NovelEvent,
  NovelForeshadowingPayoff,
  NovelGameSceneState,
  NovelGameVisualPreferences,
  NovelGameVisualProfile,
  NovelLongChapterText,
  NovelPersistentWorkspace,
  NovelProjectSummary,
  NovelRelationship,
  NovelSceneBeat,
  NovelSimulationExplanation,
  NovelSimulationInterventionKind,
  NovelSimulationRun,
  NovelSimulationBranchComparison,
  NovelSimulationStep,
  NovelStateSimulation,
  NovelChapterAnalysis,
  NovelChapterInput,
  NovelWholeBookImportDraft,
  NovelWorldMergeChange,
  NovelWorldProject,
  NovelWorldDevelopmentStep,
  NovelWorldGraph,
  NovelWorldValidationReport,
  NovelQualityIssue,
  NovelWritingRisk,
  NpcDialogueEvalReport,
  PlayableCaseIntake,
  PlayableCaseNextAction,
  PlayerSession,
  PlayerResourceCommitmentPublicSummary,
  FactionRelationshipPublicSummary,
  WorldEventOfferPublicSummary,
  InvestigatorProgressionPublicSummary,
  CampaignRecoveryPublicSummary,
  ArcConvergencePublicSummary,
  CampaignSessionPublicSummary,
  CampaignFinaleDebriefPublicSummary,
  TownSocialResponsePublicSummary,
  PlayerTheory,
  ProofTourStep,
  ProofViewMode,
  PromptAuditReport,
  RevealEvalReport,
  RevealFactContract,
  RuntimeMode,
  RunCatalogEntry,
  RunJob,
  ReviewExportBundle,
  ScenarioConfig,
  ScenarioPack,
  ScenarioPreset,
  ScenarioReport,
  ScenarioRun,
  ScenarioRunSummary,
  SuspectBoardRow,
  TownStateDiff,
  TownStateSnapshot,
  TownRuntimeIntervention,
  WorldLeadPublicSummary,
  WorldLeadOutcomePublicSummary,
  WorldLeadCaseHandoffPublicSummary,
  WorldArcPublicSummary,
  WorldArcDirectivePublicSummary,
  WorldPressureCascadePublicSummary,
  WorldInfluenceBudgetPublicSummary,
  TownEmergenceQueue,
  TownCaseLifecycleState,
  TownRuleSnapshotSummary,
  TownSituationBrief,
  WorldEvent,
  WorldMapActor,
  WorldMapMarker,
  WorldMapSnapshot,
  WorldMode,
  WorldState
} from "@/lib/engine";

type BenchmarkSummary = EmergenceBenchmarkReport;
type AiSafetyState = {
  mock?: boolean;
  promptAudit?: PromptAuditReport;
  dialogueEval?: NpcDialogueEvalReport;
  revealEval?: RevealEvalReport;
  factContract?: RevealFactContract;
  safetyFlags?: string[];
  memoryCount?: number;
  evidenceCount?: number;
};
type CaseMode = "premium" | "generated";
type AppMode = "play" | "authoring" | "world-graph" | "persistent-town";
type GuidedManualStepKind = "join" | "search" | "question" | "challenge" | "select-evidence" | "submit" | "review-source";
type GuidedManualStepTarget = {
  kind: GuidedManualStepKind;
  label: string;
  evidenceId?: string;
  characterId?: string;
  locationId?: string;
};
type GuidedStepJournalEntry = {
  id: string;
  journalKey?: string;
  step: GuidedManualStepKind;
  label: string;
  status: "done" | "blocked" | "info";
  result: string;
  progressDelta: string;
  nextAction: string;
  fallbackUsed?: boolean;
  reviewUnlocked?: boolean;
};
type ReplayGoalAttemptState = {
  active: boolean;
  previousGuidedSteps: number;
  previousFallbackUsed: boolean;
  previousFallbackTheoryFieldCount: number;
  previousSelectedEvidenceCount: number;
  previousProofGapCount: number;
  previousSourceReviewUnlocked: boolean;
  manualEvidencePickCount: number;
  fallbackEvidencePickCount: number;
  manualTheoryFieldCount: number;
  fallbackTheoryFieldCount: number;
  blockedTheoryGapCount: number;
  theoryFallbackApproved: boolean;
  startedAt: string;
  lastResult: string;
};
type ManualTheoryFieldKind = "culpritId" | "motive" | "method";

function countManualTheoryFields(theory: PlayerTheory) {
  return [theory.culpritId, theory.motive.trim(), theory.method.trim()].filter(Boolean).length;
}

function unresolvedManualTheoryFields(judgement?: PlayerSession["judgement"]): Set<ManualTheoryFieldKind> {
  const unresolved = new Set<ManualTheoryFieldKind>();
  if (!judgement || judgement.accepted) return unresolved;
  if (judgement.contradictions.some((item) => /culprit/i.test(item))) unresolved.add("culpritId");
  if (judgement.missing.some((item) => /motive/i.test(item))) unresolved.add("motive");
  if (judgement.missing.some((item) => /method/i.test(item))) unresolved.add("method");
  return unresolved;
}
type AuthoringTab = "case" | "content" | "characters" | "evidence" | "scenes" | "timeline" | "logic" | "gallery";
type ContentSeedHistoryEntry = {
  id: string;
  createdAt: string;
  beforeTitle: string;
  afterTitle: string;
  caseTypeLabel: string;
  patchCount: number;
  backupTitle: string;
  draft: AuthoringDraft;
  validation: {
    valid: boolean;
    errorCount: number;
  };
};
type SafeDiffGroup = "case" | "characters" | "evidence" | "logic";
type SafeDiffItem = {
  group: SafeDiffGroup;
  label: string;
  field: string;
  before: string;
  after: string;
};
type WorkflowCoachStageId = "draft" | "content-seed" | "safe-diff" | "validation" | "run-draft" | "gallery-backup";
type WorkflowCoachStatus = "ready" | "active" | "blocked" | "done";
type WorkflowCoachStage = {
  id: WorkflowCoachStageId;
  label: string;
  status: WorkflowCoachStatus;
  detail: string;
};
type WorkflowCoachNextAction = {
  label: string;
  detail: string;
  tone: WorkflowCoachStatus;
};

const safeDiffGroups: Array<{ id: SafeDiffGroup; label: string }> = [
  { id: "case", label: "Case" },
  { id: "characters", label: "Characters" },
  { id: "evidence", label: "Evidence" },
  { id: "logic", label: "Logic" }
];
const workflowCoachStages: Array<{ id: WorkflowCoachStageId; label: string }> = [
  { id: "draft", label: "Draft" },
  { id: "content-seed", label: "Content Seed" },
  { id: "safe-diff", label: "Safe Diff" },
  { id: "validation", label: "Validation" },
  { id: "run-draft", label: "Run Draft" },
  { id: "gallery-backup", label: "Gallery Backup" }
];

const storageKey = "detective-town-launch-v1";
const authoringStorageKey = "detective-town-authoring-v1";
const caseGalleryStorageKey = "detective-town-case-gallery-v1";
const timeMin = 8 * 60;
const timeMax = 23 * 60;
const initialProgress: InvestigationProgress = {
  observedCrimeWindow: false,
  joinedInvestigation: false,
  discoveredEvidence: false,
  challengedTestimony: false,
  submittedTheory: false,
  solvedCase: false
};
const archetypeOptions: { value: MurderArchetype | "auto"; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "blade", label: "Blade" },
  { value: "poison", label: "Poison" },
  { value: "blunt", label: "Blunt" },
  { value: "fall", label: "Fall" }
];
const archetypeLabels: Record<string, string> = {
  blade: "Blade injury",
  poison: "Poisoning",
  blunt: "Blunt-force misdirection",
  fall: "Fall mechanism"
};
const caseTemplates = listCaseTemplates();
const detectiveContentPack: DetectiveContentPack = {
  manifest: detectiveManifest as DetectiveContentPack["manifest"],
  caseTypes: detectiveCaseTypes,
  locations: detectiveLocations,
  roles: detectiveRoles,
  motives: detectiveMotives,
  evidenceTypes: detectiveEvidenceTypes,
  redHerringPatterns: detectiveRedHerringPatterns,
  escalationRules: detectiveEscalationRules,
  resources: detectiveResources,
  factions: detectiveFactions,
  eventArchetypes: detectiveEventArchetypes as DetectiveContentPack["eventArchetypes"],
  progressionLines: detectiveProgressionLines
};
const detectiveContentSummary = buildDetectiveContentSummary(detectiveContentPack);

function safeDiffText(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return "";
  return "";
}

function safeDiffGroupForPath(path: string): SafeDiffGroup | null {
  if (/^caseFromLog\.deductionCase\.(title|theme|premise|publicCaseFile)$/.test(path)) return "case";
  if (/^caseFromLog\.deductionCase\.characters\.\d+\.(role|publicBio|motive)$/.test(path)) return "characters";
  if (/^caseFromLog\.deductionCase\.evidence\.\d+\.(title|visibleDescription)$/.test(path)) return "evidence";
  if (path === "caseFromLog.deductionCase.logicPuzzle.redHerrings") return "logic";
  return null;
}

function safeDiffFieldLabel(path: string): string {
  const character = path.match(/^caseFromLog\.deductionCase\.characters\.(\d+)\.(role|publicBio|motive)$/);
  if (character) {
    const field = character[2] === "publicBio" ? "public bio" : character[2] === "motive" ? "motive surface" : "role";
    return `Character ${Number(character[1]) + 1} ${field}`;
  }
  const evidence = path.match(/^caseFromLog\.deductionCase\.evidence\.(\d+)\.(title|visibleDescription)$/);
  if (evidence) {
    const field = evidence[2] === "visibleDescription" ? "visible description" : "title";
    return `Evidence ${Number(evidence[1]) + 1} ${field}`;
  }
  const labels: Record<string, string> = {
    "caseFromLog.deductionCase.title": "Case title",
    "caseFromLog.deductionCase.theme": "Theme",
    "caseFromLog.deductionCase.premise": "Premise",
    "caseFromLog.deductionCase.publicCaseFile": "Public case file",
    "caseFromLog.deductionCase.logicPuzzle.redHerrings": "Red herring labels"
  };
  return labels[path] || "Safe field";
}

function safeDiffFieldName(path: string): string {
  const parts = path.split(".");
  return parts.slice(-2).join(".");
}

function safeDiffItem(path: string, before: unknown, after: unknown, label = safeDiffFieldLabel(path)): SafeDiffItem | null {
  const group = safeDiffGroupForPath(path);
  if (!group) return null;
  const beforeText = safeDiffText(before);
  const afterText = safeDiffText(after);
  if (beforeText === afterText) return null;
  return { group, label, field: safeDiffFieldName(path), before: beforeText, after: afterText };
}

function safeCoachMessage(value: string) {
  return value
    .replace(/\b(case|npc|agent|event|evidence|character|scene|timeline|world|session)-[A-Za-z0-9_-]+\b/g, "[private id]")
    .replace(/\b(culprit|truth|trueMeaning|checkpoint|sourceEventIds?|replay|package body)\b/gi, "[private field]")
    .slice(0, 160);
}

function buildAppliedSafeDiff(before: AuthoringDraft, after: AuthoringDraft): SafeDiffItem[] {
  const beforeCase = before.caseFromLog.deductionCase;
  const afterCase = after.caseFromLog.deductionCase;
  const items: SafeDiffItem[] = [];
  const push = (path: string, beforeValue: unknown, afterValue: unknown, label?: string) => {
    const item = safeDiffItem(path, beforeValue, afterValue, label);
    if (item) items.push(item);
  };

  push("caseFromLog.deductionCase.title", beforeCase.title, afterCase.title);
  push("caseFromLog.deductionCase.theme", beforeCase.theme, afterCase.theme);
  push("caseFromLog.deductionCase.premise", beforeCase.premise, afterCase.premise);
  push("caseFromLog.deductionCase.publicCaseFile", beforeCase.publicCaseFile, afterCase.publicCaseFile);

  const characterCount = Math.max(beforeCase.characters.length, afterCase.characters.length);
  for (let index = 0; index < characterCount; index += 1) {
    const beforeCharacter = beforeCase.characters[index];
    const afterCharacter = afterCase.characters[index];
    push(`caseFromLog.deductionCase.characters.${index}.role`, beforeCharacter?.role, afterCharacter?.role);
    push(`caseFromLog.deductionCase.characters.${index}.publicBio`, beforeCharacter?.publicBio, afterCharacter?.publicBio);
    push(`caseFromLog.deductionCase.characters.${index}.motive`, beforeCharacter?.motive, afterCharacter?.motive);
  }

  const evidenceCount = Math.max(beforeCase.evidence.length, afterCase.evidence.length);
  for (let index = 0; index < evidenceCount; index += 1) {
    const beforeEvidence = beforeCase.evidence[index];
    const afterEvidence = afterCase.evidence[index];
    push(`caseFromLog.deductionCase.evidence.${index}.title`, beforeEvidence?.title, afterEvidence?.title);
    push(`caseFromLog.deductionCase.evidence.${index}.visibleDescription`, beforeEvidence?.visibleDescription, afterEvidence?.visibleDescription);
  }

  push("caseFromLog.deductionCase.logicPuzzle.redHerrings", beforeCase.logicPuzzle.redHerrings, afterCase.logicPuzzle.redHerrings);
  return items;
}

function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

type NovelSelection =
  | { type: "game-location"; id: string }
  | { type: "game-actor"; id: string }
  | { type: "simulation-step"; id: string }
  | { type: "ask-evidence"; id: string }
  | { type: "entity"; id: string }
  | { type: "character-state"; id: string }
  | { type: "theme-signal"; id: string }
  | { type: "causal-claim"; id: string }
  | { type: "causal-edge"; id: string }
  | { type: "causal-gap"; id: string }
  | { type: "quality-issue"; id: string }
  | { type: "correction"; id: string }
  | { type: "relationship"; id: string }
  | { type: "event"; id: string }
  | { type: "development"; id: string }
  | { type: "change"; id: string };

type WriterSelection =
  | { type: "beat"; id: string }
  | { type: "payoff"; id: string }
  | { type: "risk"; id: string };

const novelProjectStorageKey = "detective-town-novel-world-project-v2";
const novelWorkbenchDbName = "detective-town-novel-workbench-v4";
const novelWorkbenchStore = "state";
const novelIndexedProjectKey = "project";
const novelIndexedChaptersKey = "chapter-texts";
const novelIndexedEvidenceKey = "evidence-indexes";
const novelIndexedBatchQueueKey = "batch-queue";
const novelIndexedArcPreferencesKey = "character-arc-preferences";
const novelIndexedAskHistoryKey = "ask-history";
const novelIndexedSimulationRunsKey = "simulation-runs";
const novelIndexedCorrectionSetKey = "correction-set";

type NovelWorldView = "audit" | "game" | "replay" | "ask" | "causality" | "theme" | "arc" | "map" | "events";
type NovelInspectorTab = "inspector" | "simulation" | "writer" | "correction";
type NovelAuditFilter = "all" | "evidence" | "entity" | "relationship" | "event" | "character" | "theme" | "causality" | "replay-readiness";
const defaultNovelGameVisualPreferences: NovelGameVisualPreferences = {
  labels: "all",
  evidenceHeat: true,
  motionTrails: true,
  pixelScale: 1
};
type NovelArcPreferences = {
  pinnedCharacterIds: string[];
  pinnedCausalChainIds?: string[];
  pinnedThemeIds?: string[];
  worldView: NovelWorldView;
  inspectorTab: NovelInspectorTab;
  gameVisualPreferences?: NovelGameVisualPreferences;
};

type NovelAskHistoryItem = {
  id: string;
  question: string;
  askedAt: string;
  throughChapterId?: string;
  answer: NovelAskAnswer;
  queryPlan: NovelAskQueryPlan;
  evidenceHits: NovelAskEvidenceHit[];
};

type NovelSimulationRunRecord = {
  run: NovelSimulationRun;
  explanationByStepId: Record<string, NovelSimulationExplanation>;
};

function novelWorkspaceFingerprint(workspace: Omit<NovelPersistentWorkspace, "updatedAt"> | NovelPersistentWorkspace) {
  return JSON.stringify({
    project: workspace.project,
    chapters: workspace.chapters,
    evidenceIndexes: workspace.evidenceIndexes,
    simulationRuns: workspace.simulationRuns,
    correctionSet: workspace.correctionSet,
    batchQueue: workspace.batchQueue
  });
}

function openNovelWorkbenchDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available."));
      return;
    }
    const request = indexedDB.open(novelWorkbenchDbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(novelWorkbenchStore)) db.createObjectStore(novelWorkbenchStore);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed."));
  });
}
async function readNovelIndexedValue<T>(key: string): Promise<T | null> {
  const db = await openNovelWorkbenchDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(novelWorkbenchStore, "readonly");
    const request = tx.objectStore(novelWorkbenchStore).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) || null);
    request.onerror = () => reject(request.error || new Error("IndexedDB read failed."));
    tx.oncomplete = () => db.close();
  });
}

async function writeNovelIndexedValue<T>(key: string, value: T): Promise<void> {
  const db = await openNovelWorkbenchDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(novelWorkbenchStore, "readwrite");
    tx.objectStore(novelWorkbenchStore).put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error || new Error("IndexedDB write failed."));
  });
}

async function clearNovelIndexedState(): Promise<void> {
  const db = await openNovelWorkbenchDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(novelWorkbenchStore, "readwrite");
    tx.objectStore(novelWorkbenchStore).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error || new Error("IndexedDB clear failed."));
  });
}

function compactNovelProjectForLocalBackup(project: NovelWorldProject): NovelWorldProject {
  const totalTextLength = project.chapters.reduce((sum, chapter) => sum + chapter.input.fragment.length, 0);
  if (totalTextLength < 120_000) return project;
  return {
    ...project,
    chapters: project.chapters.map((chapter) => ({
      ...chapter,
      input: {
        ...chapter.input,
        fragment: chapter.input.fragment.slice(0, 800)
      }
    }))
  };
}

function entityIcon(kind: NovelEntity["kind"]) {
  if (kind === "character") return "C";
  if (kind === "faction") return "F";
  if (kind === "location") return "L";
  if (kind === "item") return "I";
  return "K";
}

function polarityLabel(value: NovelRelationship["polarity"]) {
  const labels: Record<NovelRelationship["polarity"], string> = {
    ally: "Ally",
    rival: "Rival",
    family: "Family",
    debt: "Debt",
    secret: "Secret",
    neutral: "Neutral"
  };
  return labels[value];
}

function blueprintTargetChapter(project: NovelWorldProject, activeChapterId: string, mode: "latest" | "selected") {
  if (mode === "selected") return activeChapterId;
  const ready = project.chapters.filter((chapter) => chapter.status === "ready").sort((a, b) => b.input.order - a.input.order);
  return ready[0]?.input.id || activeChapterId || project.chapters[project.chapters.length - 1]?.input.id;
}

function createDefaultNovelProject() {
  let project = createNovelWorldProject({ title: "Rain Gate Chronicle", genreTone: "Eastern fantasy / mystery" });
  const chapters: Array<Pick<NovelChapterInput, "title" | "fragment">> = [
    {
      title: "Chapter 1 - Rain Gate",
      fragment: "Rain falls as Lin Yao enters Rain Gate City with a cracked jade slip. Shen Qiu stops him at the gate and notices the same pattern from an old missing-person case."
    },
    {
      title: "Chapter 2 - Sect Order",
      fragment: "Qingyun Sect orders the city sealed and demands all outsiders be surrendered. Shen Qiu hides the jade slip record and starts doubting the official order."
    },
    {
      title: "Chapter 3 - Underground Lines",
      fragment: "The jade slip resonates below the market. Old formation lines light up, and rumors spread that the sect succession oath was broken years ago."
    }
  ];
  for (const [index, chapter] of chapters.entries()) {
    project = addNovelChapterAnalysis(project, {
      input: {
        id: `chapter-${index + 1}`,
        order: index + 1,
        title: chapter.title,
        fragment: chapter.fragment,
        genreTone: project.genreTone
      },
      status: "draft"
    });
  }
  return project;
}

const sampleNovelChapters: Array<Pick<NovelChapterInput, "title" | "fragment">> = [
  {
    title: "Chapter 1 - Rain Gate",
    fragment: "Lin Yao enters Rain Gate City with a cracked jade slip while old formation lines glow under the rain. Shen Qiu stops him at the sealed gate and recognizes the same pattern from a cold missing-person file."
  },
  {
    title: "Chapter 2 - Sect Order",
    fragment: "Qingyun Sect orders the city sealed before midnight and demands that all outsiders be surrendered. Shen Qiu hides the jade slip registry because the official order contradicts the old file."
  },
  {
    title: "Chapter 3 - Underground Lines",
    fragment: "The jade slip resonates below the market. Old formation lines wake under the stalls, panic spreads, and witnesses argue whether the sect protects the city or controls it."
  },
  {
    title: "Chapter 4 - Market Oath",
    fragment: "A public oath scene forces Lin Yao and Shen Qiu to choose whether to expose the registry. The city warden delays an arrest after seeing that the jade slip points to a buried succession dispute."
  },
  {
    title: "Chapter 5 - Warden Choice",
    fragment: "Shen Qiu refuses to destroy the registry and moves Lin Yao to the archive tunnels. The choice splits the city guard, raises relationship pressure, and leaves a clear evidence trail for replay."
  }
];

function createSampleNovelRuntime() {
  let project = createNovelWorldProject({ id: "living-world-lab-sample-rain-gate", title: "Rain Gate Sample", genreTone: "Eastern fantasy / mystery" });
  const chapters = sampleNovelChapters.map((chapter, index) => createNovelLongChapterText({
    chapterId: `sample-chapter-${index + 1}`,
    order: index + 1,
    title: chapter.title,
    rawText: chapter.fragment
  }));
  const evidenceIndexes: Record<string, NovelEvidenceIndex> = {};
  for (const chapter of chapters) {
    const evidenceIndex = createFallbackEvidenceIndex(chapter);
    evidenceIndexes[chapter.chapterId] = evidenceIndex;
    const graph = attachFallbackEvidenceToGraph(createFallbackNovelWorldGraph(chapter.title, project.genreTone, chapter.rawText), chapter, evidenceIndex);
    const characterStates = createFallbackNovelCharacterStates(graph, chapter, evidenceIndex);
    const themeSignals = createFallbackNovelThemeSignals(graph, characterStates, chapter, evidenceIndex, project.themeRegistry);
    project = addNovelChapterAnalysis(project, {
      input: { id: chapter.chapterId, order: chapter.order, title: chapter.title, fragment: chapter.rawText, genreTone: project.genreTone },
      status: "ready",
      graph,
      characterStates,
      themeSignals,
      validation: validateEvidenceAwareNovelWorldGraph(graph, [chapter]),
      analyzedAt: new Date().toISOString()
    });
  }
  let batchQueue = createNovelBatchQueue(project, 3);
  for (const chapter of chapters) {
    batchQueue = updateNovelBatchChapterStatus(batchQueue, chapter.chapterId, "ready");
  }
  const correctionSet = createNovelCorrectionSet(project);
  const run = createNovelSimulationRun(project, {
    seed: "living-world-lab-sample-rain-gate",
    mode: "grounded-replay",
    branchStepLimit: 1
  });
  return { project, chapters, evidenceIndexes, batchQueue, correctionSet, run };
}

function loadInitialNovelProject() {
  const saved = loadLocal<NovelWorldProject | null>(novelProjectStorageKey, null);
  return saved?.version === 2 ? saved : createDefaultNovelProject();
}

function WorldGraphWorkbench({ onBack, runtimeMode }: { onBack: () => void; runtimeMode: RuntimeMode }) {
  const [project, setProject] = useState<NovelWorldProject>(() => loadInitialNovelProject());
  const [activeChapterId, setActiveChapterId] = useState(() => loadInitialNovelProject().chapters[0]?.input.id || "chapter-1");
  const [selected, setSelected] = useState<NovelSelection>(() => {
    const initial = loadInitialNovelProject();
    return { type: "entity", id: initial.mergedGraph.entities[0]?.id || "char-lin-yao" };
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Import chapters, analyze them, then observe the Living World Lab replay.");
  const [exportText, setExportText] = useState("");
  const [chapterFilter, setChapterFilter] = useState("all");
  const [blueprint, setBlueprint] = useState<NovelChapterBlueprint | null>(null);
  const [blueprintExportText, setBlueprintExportText] = useState("");
  const [blueprintBusy, setBlueprintBusy] = useState(false);
  const [blueprintStatus, setBlueprintStatus] = useState("Generate a read-only next-chapter blueprint from the merged world.");
  const [blueprintTargetMode, setBlueprintTargetMode] = useState<"latest" | "selected">("latest");
  const [askQuestion, setAskQuestion] = useState("Lin Yao 为什么被关注？");
  const [askThroughChapterId, setAskThroughChapterId] = useState("all");
  const [askBusy, setAskBusy] = useState(false);
  const [askStatus, setAskStatus] = useState("Ask about analyzed chapters. Answers must cite paragraph evidence.");
  const [askHistory, setAskHistory] = useState<NovelAskHistoryItem[]>([]);
  const [activeAskId, setActiveAskId] = useState<string | null>(null);
  const [currentAsk, setCurrentAsk] = useState<NovelAskHistoryItem | null>(null);
  const [simulationRuns, setSimulationRuns] = useState<NovelSimulationRunRecord[]>([]);
  const [activeSimulationRunId, setActiveSimulationRunId] = useState("");
  const [simulationPlaying, setSimulationPlaying] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState<1 | 2 | 4>(1);
  const [simulationStatus, setSimulationStatus] = useState("Create a grounded replay after analyzing chapters.");
  const [simulationInterventionActorId, setSimulationInterventionActorId] = useState("");
  const [simulationInterventionKind, setSimulationInterventionKind] = useState<NovelSimulationInterventionKind>("knowledge");
  const [simulationInterventionValue, setSimulationInterventionValue] = useState("false");
  const [simulationExplainBusy, setSimulationExplainBusy] = useState(false);
  const [blueprintOptions, setBlueprintOptions] = useState<NovelBlueprintOptions>({
    wordCountRange: "2500-4000 words",
    narrativePerspective: "close third person",
    pacing: "balanced",
    emphasizePayoffs: true
  });
  const [writerSelection, setWriterSelection] = useState<WriterSelection | null>(null);
  const [chapterTexts, setChapterTexts] = useState<NovelLongChapterText[]>([]);
  const [evidenceIndexes, setEvidenceIndexes] = useState<Record<string, NovelEvidenceIndex>>({});
  const [stateSimulation, setStateSimulation] = useState<NovelStateSimulation | null>(null);
  const [wholeBookTitle, setWholeBookTitle] = useState("How the Steel Was Tempered");
  const [wholeBookSourceNote, setWholeBookSourceNote] = useState("User-pasted local text; display only short excerpts.");
  const [wholeBookText, setWholeBookText] = useState("");
  const [importDraft, setImportDraft] = useState<NovelWholeBookImportDraft | null>(null);
  const [batchQueue, setBatchQueue] = useState<NovelBatchQueueState>(() => createNovelBatchQueue(loadInitialNovelProject(), 3));
  const [worldView, setWorldView] = useState<NovelWorldView>("audit");
  const [inspectorTab, setInspectorTab] = useState<NovelInspectorTab>("inspector");
  const [correctionSet, setCorrectionSet] = useState<NovelCorrectionSet>(() => createNovelCorrectionSet(loadInitialNovelProject()));
  const [auditFilter, setAuditFilter] = useState<NovelAuditFilter>("all");
  const [pinnedCharacterIds, setPinnedCharacterIds] = useState<string[]>([]);
  const [pinnedCausalChainIds, setPinnedCausalChainIds] = useState<string[]>([]);
  const [pinnedThemeIds, setPinnedThemeIds] = useState<string[]>([]);
  const [gameVisualPreferences, setGameVisualPreferences] = useState<NovelGameVisualPreferences>(defaultNovelGameVisualPreferences);
  const [storageReady, setStorageReady] = useState(false);
  const [evidenceStatus, setEvidenceStatus] = useState("IndexedDB not loaded yet.");
  const [serverProjects, setServerProjects] = useState<NovelProjectSummary[]>([]);
  const [serverProjectId, setServerProjectId] = useState("");
  const [serverUpdatedAt, setServerUpdatedAt] = useState("");
  const [serverSavedFingerprint, setServerSavedFingerprint] = useState("");
  const [serverBusy, setServerBusy] = useState(false);
  const [serverOffline, setServerOffline] = useState(false);
  const [serverConflict, setServerConflict] = useState(false);
  const [serverStatus, setServerStatus] = useState("Local draft is saved automatically.");
  const projectRef = useRef(project);
  const batchQueueRef = useRef(batchQueue);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    batchQueueRef.current = batchQueue;
  }, [batchQueue]);

  useEffect(() => {
    let cancelled = false;
    async function loadIndexedState() {
      if (typeof window === "undefined") return;
      try {
        const indexedProject = await readNovelIndexedValue<NovelWorldProject>(novelIndexedProjectKey);
        const indexedChapters = await readNovelIndexedValue<NovelLongChapterText[]>(novelIndexedChaptersKey);
        const indexedEvidence = await readNovelIndexedValue<Record<string, NovelEvidenceIndex>>(novelIndexedEvidenceKey);
        const indexedQueue = await readNovelIndexedValue<NovelBatchQueueState>(novelIndexedBatchQueueKey);
        const indexedArcPreferences = await readNovelIndexedValue<NovelArcPreferences>(novelIndexedArcPreferencesKey);
        const indexedAskHistory = await readNovelIndexedValue<NovelAskHistoryItem[]>(novelIndexedAskHistoryKey);
        const indexedSimulationRuns = await readNovelIndexedValue<NovelSimulationRunRecord[]>(novelIndexedSimulationRunsKey);
        const indexedCorrectionSet = await readNovelIndexedValue<NovelCorrectionSet>(novelIndexedCorrectionSetKey);
        if (cancelled) return;
        let loadedProject = projectRef.current;
        if (indexedProject?.version === 2) {
          setProject(indexedProject);
          loadedProject = indexedProject;
          setActiveChapterId(indexedProject.chapters[0]?.input.id || "chapter-1");
          setSelected({ type: "entity", id: indexedProject.mergedGraph.entities[0]?.id || "char-lin-yao" });
          setBatchQueue(normalizeNovelBatchQueue(indexedProject, indexedQueue));
          setEvidenceStatus("IndexedDB project restored.");
        } else {
          const localProject = loadLocal<NovelWorldProject | null>(novelProjectStorageKey, null);
          if (localProject?.version === 2) {
            setProject(localProject);
            loadedProject = localProject;
            await writeNovelIndexedValue(novelIndexedProjectKey, localProject);
            setBatchQueue(createNovelBatchQueue(localProject, 3));
            setEvidenceStatus("Migrated localStorage project into IndexedDB.");
          } else {
            setEvidenceStatus("IndexedDB ready.");
          }
        }
        setChapterTexts(indexedChapters || []);
        setEvidenceIndexes(indexedEvidence || {});
        setAskHistory(Array.isArray(indexedAskHistory) ? indexedAskHistory.slice(0, 20) : []);
        setCurrentAsk(Array.isArray(indexedAskHistory) && indexedAskHistory[0] ? indexedAskHistory[0] : null);
        setActiveAskId(Array.isArray(indexedAskHistory) && indexedAskHistory[0] ? indexedAskHistory[0].id : "");
        setSimulationRuns(Array.isArray(indexedSimulationRuns) ? indexedSimulationRuns.slice(0, 10) : []);
        setActiveSimulationRunId(Array.isArray(indexedSimulationRuns) && indexedSimulationRuns[0] ? indexedSimulationRuns[0].run.id : "");
        setCorrectionSet(normalizeNovelCorrectionSet(indexedCorrectionSet, loadedProject));
        if (indexedArcPreferences) {
          setPinnedCharacterIds(Array.isArray(indexedArcPreferences.pinnedCharacterIds) ? indexedArcPreferences.pinnedCharacterIds.slice(0, 3) : []);
          setPinnedCausalChainIds(Array.isArray(indexedArcPreferences.pinnedCausalChainIds) ? indexedArcPreferences.pinnedCausalChainIds.slice(0, 3) : []);
          setPinnedThemeIds(Array.isArray(indexedArcPreferences.pinnedThemeIds) ? indexedArcPreferences.pinnedThemeIds.slice(0, 4) : []);
          setWorldView(indexedArcPreferences.worldView || "audit");
          setInspectorTab(indexedArcPreferences.inspectorTab || "inspector");
          setGameVisualPreferences({
            labels: indexedArcPreferences.gameVisualPreferences?.labels === "focus" || indexedArcPreferences.gameVisualPreferences?.labels === "off" ? indexedArcPreferences.gameVisualPreferences.labels : "all",
            evidenceHeat: typeof indexedArcPreferences.gameVisualPreferences?.evidenceHeat === "boolean" ? indexedArcPreferences.gameVisualPreferences.evidenceHeat : true,
            motionTrails: typeof indexedArcPreferences.gameVisualPreferences?.motionTrails === "boolean" ? indexedArcPreferences.gameVisualPreferences.motionTrails : true,
            pixelScale: indexedArcPreferences.gameVisualPreferences?.pixelScale === 2 ? 2 : 1
          });
        }
      } catch (error) {
        setEvidenceStatus(`IndexedDB unavailable; using in-memory project. ${error instanceof Error ? error.message : ""}`);
      } finally {
        if (!cancelled) setStorageReady(true);
      }
    }
    void loadIndexedState();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storageReady || typeof window === "undefined") return;
    localStorage.setItem(novelProjectStorageKey, JSON.stringify(compactNovelProjectForLocalBackup(project)));
    void writeNovelIndexedValue(novelIndexedProjectKey, project).catch((error) => setEvidenceStatus(`IndexedDB project save failed: ${error instanceof Error ? error.message : "unknown error"}`));
  }, [project, storageReady]);

  useEffect(() => {
    if (!storageReady || typeof window === "undefined") return;
    void writeNovelIndexedValue(novelIndexedChaptersKey, chapterTexts).catch((error) => setEvidenceStatus(`IndexedDB chapter save failed: ${error instanceof Error ? error.message : "unknown error"}`));
  }, [chapterTexts, storageReady]);

  useEffect(() => {
    if (!storageReady || typeof window === "undefined") return;
    void writeNovelIndexedValue(novelIndexedEvidenceKey, evidenceIndexes).catch((error) => setEvidenceStatus(`IndexedDB evidence save failed: ${error instanceof Error ? error.message : "unknown error"}`));
  }, [evidenceIndexes, storageReady]);

  useEffect(() => {
    if (!storageReady || typeof window === "undefined") return;
    void writeNovelIndexedValue(novelIndexedBatchQueueKey, batchQueue).catch((error) => setEvidenceStatus(`IndexedDB batch queue save failed: ${error instanceof Error ? error.message : "unknown error"}`));
  }, [batchQueue, storageReady]);

  useEffect(() => {
    if (!storageReady || typeof window === "undefined") return;
    void writeNovelIndexedValue<NovelArcPreferences>(novelIndexedArcPreferencesKey, {
      pinnedCharacterIds,
      pinnedCausalChainIds,
      pinnedThemeIds,
      worldView,
      inspectorTab,
      gameVisualPreferences
    }).catch((error) => setEvidenceStatus(`IndexedDB arc preference save failed: ${error instanceof Error ? error.message : "unknown error"}`));
  }, [gameVisualPreferences, inspectorTab, pinnedCausalChainIds, pinnedCharacterIds, pinnedThemeIds, storageReady, worldView]);

  useEffect(() => {
    if (!storageReady || typeof window === "undefined") return;
    void writeNovelIndexedValue(novelIndexedAskHistoryKey, askHistory.slice(0, 20)).catch((error) => setEvidenceStatus(`IndexedDB ask history save failed: ${error instanceof Error ? error.message : "unknown error"}`));
  }, [askHistory, storageReady]);

  useEffect(() => {
    if (!storageReady || typeof window === "undefined") return;
    void writeNovelIndexedValue(novelIndexedSimulationRunsKey, simulationRuns.slice(0, 10)).catch((error) => setEvidenceStatus(`IndexedDB simulation save failed: ${error instanceof Error ? error.message : "unknown error"}`));
  }, [simulationRuns, storageReady]);

  useEffect(() => {
    if (!storageReady || typeof window === "undefined") return;
    void writeNovelIndexedValue(novelIndexedCorrectionSetKey, correctionSet).catch((error) => setEvidenceStatus(`IndexedDB correction save failed: ${error instanceof Error ? error.message : "unknown error"}`));
  }, [correctionSet, storageReady]);

  const serverWorkspace = useMemo<NovelPersistentWorkspace>(() => ({
    version: 1,
    project,
    chapters: chapterTexts,
    evidenceIndexes,
    simulationRuns: simulationRuns.map((record) => record.run),
    correctionSet,
    batchQueue,
    updatedAt: serverUpdatedAt || project.updatedAt
  }), [batchQueue, chapterTexts, correctionSet, evidenceIndexes, project, serverUpdatedAt, simulationRuns]);
  const serverWorkspaceFingerprint = useMemo(() => novelWorkspaceFingerprint(serverWorkspace), [serverWorkspace]);
  const serverSyncState = runtimeMode === "static-demo"
    ? "local"
    : serverConflict
      ? "conflict"
      : serverOffline
        ? "offline"
        : serverSavedFingerprint && serverSavedFingerprint === serverWorkspaceFingerprint
          ? "saved"
          : "unsaved";

  useEffect(() => {
    if (!storageReady || runtimeMode === "static-demo") {
      setServerProjects([]);
      setServerOffline(false);
      return;
    }
    let cancelled = false;
    void getV1<{ projects: NovelProjectSummary[] }>("/api/v1/query/novel/projects")
      .then((data) => {
        if (cancelled) return;
        setServerProjects(data.projects);
        setServerOffline(false);
        setServerStatus("Server project library ready.");
      })
      .catch((error) => {
        if (cancelled) return;
        setServerOffline(true);
        setServerStatus(`Server unavailable; local draft remains safe. ${error instanceof Error ? error.message : ""}`);
      });
    return () => {
      cancelled = true;
    };
  }, [runtimeMode, storageReady]);

  function applyServerWorkspace(workspace: NovelPersistentWorkspace) {
    setProject(workspace.project);
    setChapterTexts(workspace.chapters);
    setEvidenceIndexes(workspace.evidenceIndexes);
    setBatchQueue(normalizeNovelBatchQueue(workspace.project, workspace.batchQueue));
    setCorrectionSet(normalizeNovelCorrectionSet(workspace.correctionSet, workspace.project));
    const runs = workspace.simulationRuns.slice(0, 10).map((run) => ({ run, explanationByStepId: {} }));
    setSimulationRuns(runs);
    setActiveSimulationRunId(runs[0]?.run.id || "");
    setActiveChapterId(workspace.project.chapters[0]?.input.id || "chapter-1");
    setSelected({ type: "entity", id: workspace.project.mergedGraph.entities[0]?.id || "char-lin-yao" });
    setServerProjectId(workspace.project.id);
    setServerUpdatedAt(workspace.updatedAt);
    setServerSavedFingerprint(novelWorkspaceFingerprint(workspace));
    setServerConflict(false);
    setServerOffline(false);
  }

  async function refreshServerProjects() {
    const data = await getV1<{ projects: NovelProjectSummary[] }>("/api/v1/query/novel/projects");
    setServerProjects(data.projects);
    setServerOffline(false);
  }

  async function openServerProject(projectId: string, skipConfirmation = false) {
    if (!skipConfirmation && serverWorkspaceFingerprint !== serverSavedFingerprint && !window.confirm("打开服务器项目会替换当前本地草稿视图。IndexedDB 草稿仍会保留，是否继续？")) return;
    setServerBusy(true);
    try {
      const data = await getV1<{ workspace: NovelPersistentWorkspace }>(`/api/v1/query/novel/project?projectId=${encodeURIComponent(projectId)}`);
      applyServerWorkspace(data.workspace);
      setServerStatus(`Opened ${data.workspace.project.title} from SQLite.`);
    } catch (error) {
      setServerOffline(true);
      setServerStatus(error instanceof Error ? error.message : "Failed to open server project.");
    } finally {
      setServerBusy(false);
    }
  }

  async function saveServerProject() {
    if (runtimeMode === "static-demo") return;
    setServerBusy(true);
    setServerConflict(false);
    try {
      const data = await postV1<{ workspace: NovelPersistentWorkspace }>("/api/v1/command/novel/project/save", {
        workspace: serverWorkspace,
        expectedUpdatedAt: serverProjectId === project.id ? serverUpdatedAt || undefined : undefined
      });
      applyServerWorkspace(data.workspace);
      await refreshServerProjects();
      setServerStatus(`Saved ${data.workspace.project.title} to SQLite.`);
    } catch (error) {
      if (error instanceof V1RequestError && error.code === "NOVEL_PROJECT_CONFLICT") {
        setServerConflict(true);
        setServerStatus("Server copy changed. Reload it or save this draft as a copy.");
      } else {
        setServerOffline(true);
        setServerStatus(error instanceof Error ? error.message : "Failed to save server project.");
      }
    } finally {
      setServerBusy(false);
    }
  }

  async function saveServerProjectCopy() {
    if (runtimeMode === "static-demo") return;
    const now = new Date().toISOString();
    const copyId = `${project.id.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "novel-project"}-copy-${Date.now().toString(36)}`;
    const copyProject: NovelWorldProject = { ...project, id: copyId, title: `${project.title} Copy`, createdAt: now, updatedAt: now };
    const copyWorkspace: NovelPersistentWorkspace = {
      ...serverWorkspace,
      project: copyProject,
      correctionSet: { ...correctionSet, projectId: copyId, createdAt: now, updatedAt: now },
      simulationRuns: serverWorkspace.simulationRuns.map((run) => ({ ...run, projectId: copyId })),
      updatedAt: now
    };
    setServerBusy(true);
    try {
      const data = await postV1<{ workspace: NovelPersistentWorkspace }>("/api/v1/command/novel/project/save", { workspace: copyWorkspace });
      applyServerWorkspace(data.workspace);
      await refreshServerProjects();
      setServerStatus(`Saved a new SQLite copy: ${data.workspace.project.title}.`);
    } catch (error) {
      setServerOffline(true);
      setServerStatus(error instanceof Error ? error.message : "Failed to save project copy.");
    } finally {
      setServerBusy(false);
    }
  }

  const correctionValidation = useMemo(() => validateNovelCorrectionSet(correctionSet, project, chapterTexts), [chapterTexts, correctionSet, project]);
  const correctedProject = useMemo(() => applyNovelCorrectionOverlay(project, correctionSet), [correctionSet, project]);
  const identityRegistry = useMemo(() => normalizeNovelEntityIdentityRegistry(project.identityRegistry), [project.identityRegistry]);
  const pendingIdentityDecisions = useMemo(() => identityRegistry.decisions.filter((decision) => decision.status === "pending"), [identityRegistry.decisions]);
  const autoIdentityDecisions = useMemo(() => identityRegistry.decisions.filter((decision) => decision.status === "auto-merged" || decision.status === "confirmed"), [identityRegistry.decisions]);
  const rejectedIdentityDecisions = useMemo(() => identityRegistry.decisions.filter((decision) => decision.status === "rejected"), [identityRegistry.decisions]);
  const effectiveProjectRevision = useMemo(() => createNovelProjectRevision(correctedProject), [correctedProject]);
  const auditReport = useMemo(() => buildNovelQualityAuditReport(correctedProject, correctionSet, chapterTexts), [chapterTexts, correctedProject, correctionSet]);
  const suggestedCorrectionPatches = useMemo(() => {
    const appliedOrDismissed = new Set(correctionSet.patches.map((patch) => patch.id));
    return createSuggestedNovelCorrectionPatches(correctedProject, auditReport.issues).filter((patch) => !appliedOrDismissed.has(patch.id));
  }, [auditReport.issues, correctedProject, correctionSet.patches]);
  const filteredAuditIssues = useMemo(() => auditReport.issues.filter((issue) => auditFilter === "all" || issue.category === auditFilter), [auditFilter, auditReport.issues]);
  const appliedCorrections = useMemo(() => correctionSet.patches.filter((patch) => patch.status === "applied"), [correctionSet.patches]);
  const correctionModeLabel = appliedCorrections.length ? "Corrected View" : "Original Extracted Graph";
  const graph = correctedProject.mergedGraph.entities.length ? correctedProject.mergedGraph : createFallbackNovelWorldGraph(correctedProject.title, correctedProject.genreTone);
  const validation = useMemo(() => validateNovelWorldProject(correctedProject), [correctedProject]);
  const activeSimulationRecord = simulationRuns.find((record) => record.run.id === activeSimulationRunId) || simulationRuns[0] || null;
  const activeSimulationRun = activeSimulationRecord?.run || null;
  const activeBaselineRun = activeSimulationRun?.parentRunId
    ? simulationRuns.find((record) => record.run.id === activeSimulationRun.parentRunId)?.run || null
    : activeSimulationRun;
  const gameSelection = selected.type === "game-actor"
    ? { type: "actor" as const, id: selected.id }
    : selected.type === "game-location"
      ? { type: "location" as const, id: selected.id }
      : selected.type === "simulation-step"
        ? { type: "event" as const, id: selected.id }
        : undefined;
  const gameSceneState: NovelGameSceneState = useMemo(() => createNovelGameSceneState(activeSimulationRun, graph, gameSelection), [activeSimulationRun, gameSelection, graph]);
  const gameSceneValidation = useMemo(() => validateNovelGameSceneState(gameSceneState), [gameSceneState]);
  const gameVisualProfile: NovelGameVisualProfile = useMemo(() => createNovelGameVisualProfile(gameSceneState, graph, gameVisualPreferences), [gameSceneState, gameVisualPreferences, graph]);
  const gameVisualValidation = useMemo(() => validateNovelGameVisualProfile(gameVisualProfile, gameSceneState), [gameSceneState, gameVisualProfile]);
  const activeChapter = correctedProject.chapters.find((chapter) => chapter.input.id === activeChapterId) || correctedProject.chapters[0];
  const activeChapterText = chapterTexts.find((chapter) => chapter.chapterId === activeChapter?.input.id);
  const visibleEvents = chapterFilter === "all" ? graph.events : graph.events.filter((event) => event.sourceChapterId === chapterFilter);
  const visibleChanges = chapterFilter === "all" ? correctedProject.mergeReport.changes : correctedProject.mergeReport.changes.filter((change) => change.chapterId === chapterFilter);
  const characterArcs = useMemo(() => mergeNovelCharacterArcs(correctedProject), [correctedProject]);
  const rankedCharacterArcs = useMemo(() => rankNovelCharacterArcs(characterArcs), [characterArcs]);
  const validPinnedCharacterIds = useMemo(() => normalizePinnedNovelCharacterIds(pinnedCharacterIds, characterArcs), [characterArcs, pinnedCharacterIds]);
  const themeRegistry = useMemo(() => normalizeNovelThemeRegistry(correctedProject.themeRegistry), [correctedProject.themeRegistry]);
  const themeArcs = useMemo(() => mergeNovelThemeArcs({ ...correctedProject, themeRegistry }), [correctedProject, themeRegistry]);
  const rankedThemeArcs = useMemo(() => rankNovelThemeArcs(themeArcs), [themeArcs]);
  const validPinnedThemeIds = useMemo(() => normalizePinnedNovelThemeIds(pinnedThemeIds, themeArcs), [pinnedThemeIds, themeArcs]);
  const hiddenCausalClaimIds = useMemo(() => new Set(correctionSet.patches
    .filter((patch) => patch.status === "applied" && patch.target.kind === "causal-claim" && patch.operation.type === "hide-object")
    .map((patch) => patch.target.id)), [correctionSet.patches]);
  const causalityReport = useMemo(() => {
    const report = buildNovelCausalityReport(correctedProject);
    if (!hiddenCausalClaimIds.size) return report;
    const claims = report.claims.filter((claim) => !hiddenCausalClaimIds.has(claim.id));
    const claimIds = new Set(claims.map((claim) => claim.id));
    const edges = report.edges.filter((edge) => claimIds.has(edge.claimId));
    const edgeIds = new Set(edges.map((edge) => edge.id));
    const chains = report.chains
      .map((chain) => ({
        ...chain,
        claimIds: chain.claimIds.filter((id) => claimIds.has(id)),
        edgeIds: chain.edgeIds.filter((id) => edgeIds.has(id)),
        contestedClaimIds: chain.contestedClaimIds.filter((id) => claimIds.has(id))
      }))
      .filter((chain) => chain.claimIds.length || chain.edgeIds.length);
    return { ...report, claims, edges, chains, warnings: [...report.warnings, `${hiddenCausalClaimIds.size} causal claim correction(s) hidden in corrected view.`] };
  }, [correctedProject, hiddenCausalClaimIds]);
  const causalityValidation = useMemo(() => validateNovelCausalityReport(causalityReport, correctedProject, chapterTexts), [causalityReport, chapterTexts, correctedProject]);
  const rankedCausalChains = useMemo(() => rankNovelCausalChains(causalityReport.chains), [causalityReport.chains]);
  const validPinnedCausalChainIds = useMemo(() => normalizePinnedNovelCausalChainIds(pinnedCausalChainIds, causalityReport.chains), [causalityReport.chains, pinnedCausalChainIds]);
  const displayedCausalChains = useMemo(() => {
    const ids = validPinnedCausalChainIds.length ? validPinnedCausalChainIds : rankedCausalChains.slice(0, 3).map((chain) => chain.id);
    return ids.map((id) => causalityReport.chains.find((chain) => chain.id === id)).filter((chain): chain is NovelCausalChain => Boolean(chain));
  }, [causalityReport.chains, rankedCausalChains, validPinnedCausalChainIds]);
  const displayedThemeArcs = useMemo(() => {
    const ids = validPinnedThemeIds.length ? validPinnedThemeIds : rankedThemeArcs.filter((arc) => arc.signals.length || arc.status === "confirmed").slice(0, 4).map((arc) => arc.themeId);
    return ids.map((id) => themeArcs.find((arc) => arc.themeId === id)).filter((arc): arc is NovelThemeArc => Boolean(arc));
  }, [rankedThemeArcs, themeArcs, validPinnedThemeIds]);
  const displayedCharacterArcs = useMemo(() => {
    const ids = validPinnedCharacterIds.length ? validPinnedCharacterIds : rankedCharacterArcs.slice(0, 1).map((arc) => arc.characterEntityId);
    return ids.map((id) => characterArcs.find((arc) => arc.characterEntityId === id)).filter((arc): arc is NovelCharacterArc => Boolean(arc));
  }, [characterArcs, rankedCharacterArcs, validPinnedCharacterIds]);
  const entityById = useMemo(() => new Map(graph.entities.map((entity) => [entity.id, entity])), [graph.entities]);
  const selectedEntity = selected.type === "entity" ? entityById.get(selected.id) : null;
  const selectedCharacterState = selected.type === "character-state"
    ? characterArcs.flatMap((arc) => arc.points).find((point) => point.id === selected.id)
    : null;
  const selectedThemeSignal = selected.type === "theme-signal"
    ? themeArcs.flatMap((arc) => arc.signals).find((signal) => signal.id === selected.id)
    : null;
  const selectedThemeArc = selectedThemeSignal
    ? themeArcs.find((arc) => arc.themeId === selectedThemeSignal.themeId)
    : null;
  const selectedCausalClaim = selected.type === "causal-claim"
    ? causalityReport.claims.find((claim) => claim.id === selected.id)
    : null;
  const selectedCausalEdge = selected.type === "causal-edge"
    ? causalityReport.edges.find((edge) => edge.id === selected.id)
    : null;
  const selectedCausalGap = selected.type === "causal-gap"
    ? causalityReport.gaps.find((gap) => gap === selected.id) || selected.id
    : null;
  const selectedCausalChain = selectedCausalClaim
    ? causalityReport.chains.find((chain) => chain.claimIds.includes(selectedCausalClaim.id))
    : selectedCausalEdge
      ? causalityReport.chains.find((chain) => chain.edgeIds.includes(selectedCausalEdge.id))
      : null;
  const selectedSimulationStep = selected.type === "simulation-step"
    ? activeSimulationRun?.steps.find((step) => step.id === selected.id) || null
    : activeSimulationRun?.steps[activeSimulationRun.steps.length - 1] || null;
  const selectedSimulationExplanation = selectedSimulationStep ? activeSimulationRecord?.explanationByStepId[selectedSimulationStep.id] : undefined;
  const selectedGameActor = selected.type === "game-actor"
    ? activeSimulationRun?.currentSnapshot.actorStates.find((actor) => actor.actorEntityId === selected.id) || null
    : null;
  const selectedGameLocation = selected.type === "game-location"
    ? gameSceneState.locations.find((location) => location.id === selected.id) || null
    : null;
  const selectedGameSprite = selectedGameActor ? gameVisualProfile.sprites.find((sprite) => sprite.actorId === selectedGameActor.actorEntityId) || null : null;
  const selectedGameTile = selectedGameLocation ? gameVisualProfile.locations.find((tile) => tile.locationId === selectedGameLocation.id) || null : null;
  const selectedGameEventEffect = selectedSimulationStep ? gameVisualProfile.effects.find((effect) => effect.targetType === "event" && effect.targetId === `game-event-${selectedSimulationStep.id}`) || null : null;
  const selectedAskEvidence = selected.type === "ask-evidence"
    ? (currentAsk?.evidenceHits.find((hit) => hit.id === selected.id) || askHistory.flatMap((item) => item.evidenceHits).find((hit) => hit.id === selected.id) || null)
    : null;
  const selectedCharacterArc = selectedCharacterState
    ? characterArcs.find((arc) => arc.characterEntityId === selectedCharacterState.characterEntityId)
    : null;
  const selectedRelationship = selected.type === "relationship" ? graph.relationships.find((item) => item.id === selected.id) : null;
  const selectedEvent = selected.type === "event" ? graph.events.find((item) => item.id === selected.id) : null;
  const selectedDevelopment = selected.type === "development" ? graph.development.find((item) => item.id === selected.id) : null;
  const selectedChange = selected.type === "change" ? correctedProject.mergeReport.changes.find((item) => item.id === selected.id) : null;
  const selectedQualityIssue = selected.type === "quality-issue" ? auditReport.issues.find((item) => item.id === selected.id) || null : null;
  const selectedCorrectionPatch = selected.type === "correction" ? correctionSet.patches.find((item) => item.id === selected.id) || suggestedCorrectionPatches.find((item) => item.id === selected.id) || null : null;
  const selectedBeat = writerSelection?.type === "beat" ? blueprint?.sceneBeats.find((item) => item.id === writerSelection.id) : null;
  const selectedPayoff = writerSelection?.type === "payoff" ? blueprint?.foreshadowingPayoffs.find((item) => item.id === writerSelection.id) : null;
  const selectedRisk = writerSelection?.type === "risk" ? blueprint?.writingRisks.find((item) => item.id === writerSelection.id) : null;
  const graphEvidence = useMemo(() => collectGraphEvidence(graph), [graph]);
  const blueprintEvidence = useMemo(() => blueprint ? collectBlueprintEvidence(blueprint) : [], [blueprint]);
  const activeEvidenceIndex = activeChapter ? evidenceIndexes[activeChapter.input.id] : undefined;
  const evidenceCoverage = chapterTexts.length ? Math.round((Object.keys(evidenceIndexes).length / chapterTexts.length) * 100) : 0;
  const importValidation = importDraft ? validateNovelImportDraft(importDraft) : null;
  const analyzedCount = correctedProject.chapters.filter((chapter) => chapter.status === "ready").length;
  const indexedCount = correctedProject.chapters.filter((chapter) => evidenceIndexes[chapter.input.id]).length;
  const failedCount = correctedProject.chapters.filter((chapter) => chapter.status === "error" || batchQueue.chapterStatuses[chapter.input.id] === "error").length;
  const skippedCount = correctedProject.chapters.filter((chapter) => batchQueue.chapterStatuses[chapter.input.id] === "skipped").length;
  const nextBatchIds = getNextNovelBatchChapterIds(project, batchQueue);
  const progressGrowth = {
    entities: graph.entities.length,
    events: graph.events.length,
    relationships: graph.relationships.length,
    development: graph.development.length
  };
  const characterStateCount = characterArcs.reduce((sum, arc) => sum + arc.points.length, 0);
  const characterTurningPointCount = characterArcs.reduce((sum, arc) => sum + arc.turningPoints.length, 0);
  const characterEvidenceCount = characterArcs.reduce((sum, arc) => sum + arc.points.reduce((pointSum, point) => pointSum + point.evidence.length, 0), 0);
  const themeSignalCount = themeArcs.reduce((sum, arc) => sum + arc.signals.length, 0);
  const contestedThemeSignalCount = themeArcs.reduce((sum, arc) => sum + arc.contestedSignalIds.length, 0);
  const themeEvidenceCount = themeArcs.reduce((sum, arc) => sum + arc.signals.reduce((signalSum, signal) => signalSum + signal.evidence.length, 0), 0);
  const causalClaimCount = causalityReport.claims.length;
  const causalGapCount = causalityReport.gaps.length;
  const contestedCausalClaimCount = causalityReport.claims.filter((claim) => claim.contestedInterpretations.length).length;
  const pendingThemes = themeRegistry.filter((theme) => theme.status === "pending");
  const readyCount = correctedProject.chapters.filter((chapter) => chapter.status === "ready").length;
  const queuedCount = correctedProject.chapters.filter((chapter) => (batchQueue.chapterStatuses[chapter.input.id] || chapter.status) === "queued").length;
  const lastBatchLabels = batchQueue.lastBatchChapterIds.map((id) => chapterTitle(id)).filter(Boolean);
  const replayProvenanceCounts = activeSimulationRun?.steps.reduce<Record<string, number>>((counts, step) => {
    counts[step.provenance] = (counts[step.provenance] || 0) + 1;
    return counts;
  }, {}) || {};
  const replayGapCount = activeSimulationRun
    ? activeSimulationRun.comparison.missingPrerequisites.length + activeSimulationRun.comparison.lowEvidenceStepIds.length + activeSimulationRun.comparison.divergenceReasons.length
    : 0;
  const replayMatchedCount = activeSimulationRun?.comparison.completedCheckpointCount || 0;

  useEffect(() => {
    setSimulationRuns((records) => {
      let changed = false;
      const next = records.map((record) => {
        if (!record.run.projectRevision || record.run.projectRevision === effectiveProjectRevision || record.run.stale) return record;
        changed = true;
        return {
          ...record,
          run: {
            ...record.run,
            status: "blocked" as const,
            stale: true,
            staleReason: "The effective world graph changed. Rebuild this replay before advancing.",
            warnings: Array.from(new Set([...record.run.warnings, "Replay is stale because the effective project revision changed."]))
          }
        };
      });
      return changed ? next : records;
    });
  }, [effectiveProjectRevision]);

  useEffect(() => {
    if (!simulationPlaying || !activeSimulationRun || activeSimulationRun.status === "complete" || activeSimulationRun.status === "blocked") return;
    const timer = window.setTimeout(() => {
      let next = advanceNovelSimulation(applyNovelCorrectionOverlay(projectRef.current, correctionSet), activeSimulationRun);
      const baseline = next.parentRunId ? activeBaselineRun || undefined : undefined;
      if (baseline) next = { ...next, branchComparison: compareNovelSimulationBranch(baseline, next) };
      setSimulationRuns((records) => [
        {
          run: next,
          explanationByStepId: records.find((record) => record.run.id === next.id)?.explanationByStepId || {}
        },
        ...records.filter((record) => record.run.id !== next.id)
      ].slice(0, 10));
      const latest = next.steps[next.steps.length - 1];
      if (latest) {
        setSelected({ type: "simulation-step", id: latest.id });
        setInspectorTab("simulation");
      }
      if (next.status === "complete" || next.status === "blocked") setSimulationPlaying(false);
    }, Math.round(1200 / simulationSpeed));
    return () => window.clearTimeout(timer);
  }, [activeBaselineRun, activeSimulationRun, correctionSet, simulationPlaying, simulationSpeed]);

  function chapterTitle(chapterId?: string) {
    return correctedProject.chapters.find((chapter) => chapter.input.id === chapterId)?.input.title || chapterId || "n/a";
  }

  function updateActiveChapter(patch: Partial<NovelChapterInput>) {
    if (!activeChapter) return;
    setProject((current) => addNovelChapterAnalysis(current, { ...activeChapter, input: { ...activeChapter.input, ...patch }, status: "draft" }));
    if (typeof patch.fragment === "string" || typeof patch.title === "string") {
      const nextTitle = patch.title || activeChapter.input.title;
      const nextText = typeof patch.fragment === "string" ? patch.fragment : activeChapter.input.fragment;
      const chapterText = createNovelLongChapterText({ chapterId: activeChapter.input.id, order: activeChapter.input.order, title: nextTitle, rawText: nextText });
      setChapterTexts((items) => [...items.filter((item) => item.chapterId !== chapterText.chapterId), chapterText].sort((a, b) => a.order - b.order));
    }
  }

  function togglePinnedCharacter(characterEntityId: string) {
    setPinnedCharacterIds((current) => {
      if (current.includes(characterEntityId)) return current.filter((id) => id !== characterEntityId);
      return [...normalizePinnedNovelCharacterIds(current, characterArcs), characterEntityId].slice(-3);
    });
  }

  function togglePinnedTheme(themeId: string) {
    setPinnedThemeIds((current) => {
      if (current.includes(themeId)) return current.filter((id) => id !== themeId);
      return [...normalizePinnedNovelThemeIds(current, themeArcs), themeId].slice(-4);
    });
  }

  function togglePinnedCausalChain(chainId: string) {
    setPinnedCausalChainIds((current) => {
      if (current.includes(chainId)) return current.filter((id) => id !== chainId);
      return [...normalizePinnedNovelCausalChainIds(current, causalityReport.chains), chainId].slice(-3);
    });
  }

  function updateThemeRegistry(updater: (themes: NovelThemeDefinition[]) => NovelThemeDefinition[]) {
    setProject((current) => ({ ...current, themeRegistry: normalizeNovelThemeRegistry(updater(normalizeNovelThemeRegistry(current.themeRegistry))), updatedAt: new Date().toISOString() }));
  }

  function setThemeStatus(themeId: string, status: NovelThemeDefinition["status"]) {
    updateThemeRegistry((themes) => themes.map((theme) => theme.id === themeId ? { ...theme, status } : theme));
    if (status === "hidden") setPinnedThemeIds((current) => current.filter((id) => id !== themeId));
  }

  function renameTheme(themeId: string, name: string) {
    updateThemeRegistry((themes) => themes.map((theme) => theme.id === themeId ? { ...theme, name: name.trim() || theme.name } : theme));
  }

  function mergeThemeIntoTarget(sourceThemeId: string) {
    const targetThemeId = validPinnedThemeIds[0] || rankedThemeArcs.find((arc) => arc.themeId !== sourceThemeId && arc.status !== "hidden")?.themeId;
    if (!targetThemeId || targetThemeId === sourceThemeId) {
      setStatus("Choose another confirmed or pinned theme before merging.");
      return;
    }
    setProject((current) => {
      const nextRegistry = mergeNovelThemeDefinitions(normalizeNovelThemeRegistry(current.themeRegistry), sourceThemeId, targetThemeId);
      const chapters = current.chapters.map((chapter) => ({
        ...chapter,
        themeSignals: chapter.themeSignals ? remapNovelThemeSignals(chapter.themeSignals, sourceThemeId, targetThemeId) : chapter.themeSignals
      }));
      return { ...current, chapters, themeRegistry: nextRegistry, updatedAt: new Date().toISOString() };
    });
    setPinnedThemeIds((current) => current.filter((id) => id !== sourceThemeId));
    setStatus("Theme merged into the selected canonical theme.");
  }

  function selectWorldItem(next: NovelSelection) {
    setSelected(next);
    setInspectorTab(next.type === "simulation-step" ? "simulation" : "inspector");
  }

  function selectAskRelatedObject(id: string) {
    if (entityById.has(id)) {
      setWorldView("map");
      selectWorldItem({ type: "entity", id });
      return;
    }
    if (graph.events.some((event) => event.id === id)) {
      setWorldView("events");
      selectWorldItem({ type: "event", id });
      return;
    }
    if (graph.relationships.some((relationship) => relationship.id === id)) {
      setWorldView("map");
      selectWorldItem({ type: "relationship", id });
      return;
    }
    if (characterArcs.some((arc) => arc.points.some((point) => point.id === id))) {
      setWorldView("arc");
      selectWorldItem({ type: "character-state", id });
      return;
    }
    if (themeArcs.some((arc) => arc.signals.some((signal) => signal.id === id))) {
      setWorldView("theme");
      selectWorldItem({ type: "theme-signal", id });
      return;
    }
    if (causalityReport.claims.some((claim) => claim.id === id)) {
      setWorldView("causality");
      selectWorldItem({ type: "causal-claim", id });
      return;
    }
    if (causalityReport.edges.some((edge) => edge.id === id)) {
      setWorldView("causality");
      selectWorldItem({ type: "causal-edge", id });
    }
  }

  function ensureChapterText(chapter = activeChapter) {
    if (!chapter) return null;
    const existing = chapterTexts.find((item) => item.chapterId === chapter.input.id);
    if (existing && existing.rawText === chapter.input.fragment && existing.title === chapter.input.title) return existing;
    return createNovelLongChapterText({ chapterId: chapter.input.id, order: chapter.input.order, title: chapter.input.title, rawText: chapter.input.fragment });
  }

  function renderEvidenceList(snippets: NovelEvidenceSnippet[] | undefined, label = "Source evidence") {
    if (!snippets?.length) return <small>{label}: no paragraph evidence yet.</small>;
    return (
      <div className="evidenceSnippetList">
        <strong>{label}</strong>
        {snippets.slice(0, 3).map((snippet) => (
          <article key={snippet.id}>
            <strong>{chapterTitle(snippet.source.chapterId)} / {snippet.source.paragraphId}</strong>
            <p>{snippet.source.quote}</p>
            <small>{snippet.source.summary} / confidence {Math.round(snippet.source.confidence * 100)}%</small>
          </article>
        ))}
      </div>
    );
  }

  async function buildEvidenceIndex(chapterId = activeChapterId): Promise<NovelEvidenceIndex | null> {
    const currentProject = projectRef.current;
    const chapter = currentProject.chapters.find((item) => item.input.id === chapterId);
    const chapterText = ensureChapterText(chapter);
    if (!chapter || !chapterText) return null;
    setEvidenceStatus(`Building evidence index for ${chapter.input.title}...`);
    setChapterTexts((items) => [...items.filter((item) => item.chapterId !== chapterText.chapterId), chapterText].sort((a, b) => a.order - b.order));
    try {
      const response = await fetch(apiUrl("/api/v1/command/novel/evidence-index"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapter: { id: chapterText.chapterId, order: chapterText.order, title: chapterText.title, rawText: chapterText.rawText } })
      });
      const payload = (await response.json()) as V1Result<{
        mock: boolean;
        chapter: NovelLongChapterText;
        index: NovelEvidenceIndex;
        validation: NovelWorldValidationReport;
      }>;
      if (!payload.ok || !payload.data) throw new Error(payload.error?.message || "Evidence index failed");
      setChapterTexts((items) => [...items.filter((item) => item.chapterId !== payload.data!.chapter.chapterId), payload.data!.chapter].sort((a, b) => a.order - b.order));
      setEvidenceIndexes((current) => ({ ...current, [chapterText.chapterId]: payload.data!.index }));
      setEvidenceStatus(payload.data.mock ? "Evidence index built with local fallback." : "Evidence index built.");
      return payload.data.index;
    } catch (error) {
      const fallback = createFallbackEvidenceIndex(chapterText);
      setEvidenceIndexes((current) => ({ ...current, [chapterText.chapterId]: fallback }));
      setEvidenceStatus(`Evidence API unavailable; local fallback indexed ${fallback.snippets.length} paragraph(s). ${error instanceof Error ? error.message : ""}`);
      return fallback;
    }
  }

  function addChapter() {
    const order = project.chapters.length + 1;
    const id = `chapter-${Date.now()}`;
    setProject((current) => addNovelChapterAnalysis(current, {
      input: { id, order, title: `Chapter ${order}`, fragment: "", genreTone: current.genreTone },
      status: "draft"
    }));
    setActiveChapterId(id);
    setStatus(`Chapter ${order} added.`);
  }

  function createWholeBookPreview() {
    const draft = splitWholeNovelIntoChapterCandidates({ title: wholeBookTitle, sourceNote: wholeBookSourceNote, rawText: wholeBookText });
    setImportDraft(draft);
    setStatus(`Import preview created with ${draft.candidates.length} chapter candidate(s).`);
  }

  function updateImportCandidate(candidateId: string, patch: Partial<Pick<NovelChapterImportCandidate, "title" | "rawText">>) {
    if (!importDraft) return;
    const candidates = importDraft.candidates.map((candidate) => candidate.id === candidateId ? normalizeNovelImportDraft({
      ...importDraft,
      candidates: [{ ...candidate, ...patch }]
    }).candidates[0] : candidate);
    setImportDraft({ ...importDraft, candidates, updatedAt: new Date().toISOString() });
  }

  function removeImportCandidate(candidateId: string) {
    if (!importDraft) return;
    const candidates = importDraft.candidates
      .filter((candidate) => candidate.id !== candidateId)
      .map((candidate, index) => ({ ...candidate, order: index + 1 }));
    setImportDraft({ ...importDraft, candidates, updatedAt: new Date().toISOString() });
    setStatus("Chapter candidate removed from import preview.");
  }

  function mergeImportCandidateWithNext(candidateId: string) {
    if (!importDraft) return;
    const candidates = importDraft.candidates.slice().sort((a, b) => a.order - b.order);
    const index = candidates.findIndex((candidate) => candidate.id === candidateId);
    if (index === -1 || index >= candidates.length - 1) {
      setStatus("Select a candidate before another chapter to merge.");
      return;
    }
    const current = candidates[index];
    const next = candidates[index + 1];
    const merged: NovelChapterImportCandidate = {
      ...current,
      title: `${current.title} + ${next.title}`,
      rawText: `${current.rawText}\n\n${next.rawText}`,
      sourceEnd: next.sourceEnd,
      warning: "Merged manually in import preview."
    };
    const updated = [...candidates.slice(0, index), merged, ...candidates.slice(index + 2)]
      .map((candidate, orderIndex) => ({ ...candidate, order: orderIndex + 1 }));
    setImportDraft({ ...importDraft, candidates: updated, updatedAt: new Date().toISOString() });
    setStatus("Merged chapter candidate with the next candidate.");
  }

  function confirmWholeBookImport() {
    if (!importDraft) {
      setStatus("Create an import preview first.");
      return;
    }
    const normalized = normalizeNovelImportDraft(importDraft);
    const validationReport = validateNovelImportDraft(normalized);
    if (!validationReport.valid) {
      setStatus(`Import blocked: ${validationReport.errors.join("; ")}`);
      return;
    }
    const committed = commitNovelImportDraftToProject(normalized, { genreTone: project.genreTone || "Imported long novel" });
    setProject(committed.project);
    projectRef.current = committed.project;
    setChapterTexts(committed.chapters);
    setEvidenceIndexes({});
    setBatchQueue(committed.queue);
    setActiveChapterId(committed.project.chapters[0]?.input.id || "");
    setSelected({ type: "entity", id: committed.project.mergedGraph.entities[0]?.id || "" });
    setChapterFilter("all");
    setBlueprint(null);
    setStateSimulation(null);
    setCurrentAsk(null);
    setActiveAskId("");
    setAskHistory([]);
    setSimulationRuns([]);
    setActiveSimulationRunId("");
    setSimulationPlaying(false);
    setCorrectionSet(createNovelCorrectionSet(committed.project));
    setWorldView("audit");
    setInspectorTab("correction");
    setStatus(`Imported ${committed.chapters.length} chapter(s). Run batches to build evidence and graph analysis.`);
    setEvidenceStatus("Whole-book chapters saved to IndexedDB; localStorage keeps only a compact backup.");
  }

  async function analyzeChapter(chapterId = activeChapterId) {
    const currentProject = projectRef.current;
    const chapter = currentProject.chapters.find((item) => item.input.id === chapterId);
    if (!chapter) return;
    const chapterText = ensureChapterText(chapter);
    const evidenceIndex: NovelEvidenceIndex | undefined = chapterText ? evidenceIndexes[chapterText.chapterId] || createFallbackEvidenceIndex(chapterText) : undefined;
    setBusy(true);
    setStatus(`Analyzing ${chapter.input.title}...`);
    setProject((current) => addNovelChapterAnalysis(current, { ...chapter, status: "analyzing", error: undefined }));
    try {
      const response = await fetch(apiUrl("/api/v1/command/novel/analyze"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chapterText
          ? {
              title: chapter.input.title,
              genreTone: chapter.input.genreTone || currentProject.genreTone,
              fragment: chapter.input.fragment,
              chapter: { id: chapterText.chapterId, order: chapterText.order, title: chapterText.title, rawText: chapterText.rawText, genreTone: chapter.input.genreTone || currentProject.genreTone },
              paragraphs: chapterText.paragraphs,
              projectContext: { entities: currentProject.mergedGraph.entities.slice(0, 20), relationships: currentProject.mergedGraph.relationships.slice(0, 20) },
              themeContext: normalizeNovelThemeRegistry(currentProject.themeRegistry)
            }
          : { title: chapter.input.title, genreTone: chapter.input.genreTone || currentProject.genreTone, fragment: chapter.input.fragment })
      });
      const payload = (await response.json()) as V1Result<{
        mock: boolean;
        graph: NovelWorldGraph;
        characterStates?: NovelCharacterStatePoint[];
        themeSignals?: NovelThemeSignal[];
        themeCandidates?: NovelThemeDefinition[];
        validation: NovelWorldValidationReport;
        repaired: boolean;
      }>;
      if (!payload.ok || !payload.data) throw new Error(payload.error?.message || "Analyze failed");
      let nextGraph = normalizeNovelWorldGraph(payload.data.graph);
      if (chapterText && !collectGraphEvidence(nextGraph).length) nextGraph = attachFallbackEvidenceToGraph(nextGraph, chapterText, evidenceIndex);
      let characterStates = normalizeNovelCharacterStatePoints(payload.data.characterStates);
      if (chapterText && !characterStates.length) characterStates = createFallbackNovelCharacterStates(nextGraph, chapterText, evidenceIndex);
      const nextThemeRegistry = normalizeNovelThemeRegistry([...(currentProject.themeRegistry || []), ...(payload.data.themeCandidates || [])]);
      let themeSignals = normalizeNovelThemeSignals(payload.data.themeSignals, nextThemeRegistry);
      if (chapterText && !themeSignals.length) themeSignals = createFallbackNovelThemeSignals(nextGraph, characterStates, chapterText, evidenceIndex, nextThemeRegistry);
      const graphValidation = chapterText ? validateEvidenceAwareNovelWorldGraph(nextGraph, [chapterText]) : validateNovelWorldGraph(nextGraph);
      const characterValidation = validateNovelCharacterStatePoints(characterStates, nextGraph, chapterText ? [chapterText] : []);
      const themeValidation = validateNovelThemeSignals(themeSignals, nextThemeRegistry, nextGraph, chapterText ? [chapterText] : []);
      const nextValidation: NovelWorldValidationReport = {
        valid: graphValidation.valid && characterValidation.valid && themeValidation.valid,
        errors: [...graphValidation.errors, ...characterValidation.errors, ...themeValidation.errors],
        warnings: [...graphValidation.warnings, ...characterValidation.warnings, ...themeValidation.warnings]
      };
      setProject((current) => {
        const currentWithThemes = { ...current, themeRegistry: normalizeNovelThemeRegistry([...(current.themeRegistry || []), ...(payload.data?.themeCandidates || [])]) };
        const nextProject = addNovelChapterAnalysis(currentWithThemes, {
          input: chapter.input,
          status: nextValidation.valid ? "ready" : "error",
          graph: nextGraph,
          characterStates,
          themeSignals,
          validation: nextValidation,
          error: nextValidation.valid ? undefined : nextValidation.errors.join("; "),
          analyzedAt: new Date().toISOString()
        });
        const firstEntityId = nextProject.mergedGraph.entities[0]?.id;
        if (themeSignals[0]) setSelected({ type: "theme-signal", id: themeSignals[0].id });
        else if (characterStates[0]) setSelected({ type: "character-state", id: characterStates[0].id });
        else if (firstEntityId) setSelected({ type: "entity", id: firstEntityId });
        projectRef.current = nextProject;
        return nextProject;
      });
      if (chapterText && evidenceIndex) {
        setChapterTexts((items) => [...items.filter((item) => item.chapterId !== chapterText.chapterId), chapterText].sort((a, b) => a.order - b.order));
        setEvidenceIndexes((current) => ({ ...current, [chapterText.chapterId]: evidenceIndex }));
      }
      setBatchQueue((queue) => updateNovelBatchChapterStatus(queue, chapter.input.id, nextValidation.valid ? "ready" : "error"));
      setStatus(payload.data.mock ? "Chapter analyzed with local fallback data." : payload.data.repaired ? "Chapter analyzed after model repair." : "Chapter analyzed and merged.");
    } catch (error) {
      let fallback = createFallbackNovelWorldGraph(chapter.input.title, chapter.input.genreTone || currentProject.genreTone, chapter.input.fragment);
      if (chapterText) fallback = attachFallbackEvidenceToGraph(fallback, chapterText, evidenceIndex);
      const fallbackCharacterStates = createFallbackNovelCharacterStates(fallback, chapterText || undefined, evidenceIndex);
      const fallbackThemeSignals = createFallbackNovelThemeSignals(fallback, fallbackCharacterStates, chapterText || undefined, evidenceIndex, normalizeNovelThemeRegistry(currentProject.themeRegistry));
      setProject((current) => {
        const nextProject = addNovelChapterAnalysis(current, {
          input: chapter.input,
          status: "ready",
          graph: fallback,
          characterStates: fallbackCharacterStates,
          themeSignals: fallbackThemeSignals,
          validation: chapterText ? validateEvidenceAwareNovelWorldGraph(fallback, [chapterText]) : validateNovelWorldGraph(fallback),
          analyzedAt: new Date().toISOString()
        });
        projectRef.current = nextProject;
        return nextProject;
      });
      if (chapterText && evidenceIndex) {
        setChapterTexts((items) => [...items.filter((item) => item.chapterId !== chapterText.chapterId), chapterText].sort((a, b) => a.order - b.order));
        setEvidenceIndexes((current) => ({ ...current, [chapterText.chapterId]: evidenceIndex }));
      }
      setBatchQueue((queue) => updateNovelBatchChapterStatus(queue, chapter.input.id, "ready"));
      setSelected(fallbackThemeSignals[0] ? { type: "theme-signal", id: fallbackThemeSignals[0].id } : fallbackCharacterStates[0] ? { type: "character-state", id: fallbackCharacterStates[0].id } : { type: "entity", id: fallback.entities[0].id });
      setStatus(`API unavailable; merged local fallback for ${chapter.input.title}. ${error instanceof Error ? error.message : ""}`);
    } finally {
      setBusy(false);
    }
  }

  function resetProject() {
    const next = createDefaultNovelProject();
    setProject(next);
    setActiveChapterId(next.chapters[0]?.input.id || "chapter-1");
    setSelected({ type: "entity", id: "char-lin-yao" });
    setExportText("");
    setChapterTexts([]);
    setEvidenceIndexes({});
    setStateSimulation(null);
    setCurrentAsk(null);
    setActiveAskId("");
    setAskHistory([]);
    setAskThroughChapterId("all");
    setSimulationRuns([]);
    setActiveSimulationRunId("");
    setSimulationPlaying(false);
    setPinnedCharacterIds([]);
    setPinnedCausalChainIds([]);
    setPinnedThemeIds([]);
    setCorrectionSet(createNovelCorrectionSet(next));
    setWorldView("audit");
    setInspectorTab("inspector");
    setImportDraft(null);
    setBatchQueue(createNovelBatchQueue(next, 3));
    void clearNovelIndexedState().catch(() => undefined);
    setStatus("Project reset.");
    setEvidenceStatus("IndexedDB state reset.");
  }

  function loadSampleProject() {
    const sample = createSampleNovelRuntime();
    setProject(sample.project);
    projectRef.current = sample.project;
    setActiveChapterId(sample.project.chapters[0]?.input.id || "sample-chapter-1");
    setSelected({ type: "entity", id: sample.project.mergedGraph.entities[0]?.id || "" });
    setExportText("");
    setChapterTexts(sample.chapters);
    setEvidenceIndexes(sample.evidenceIndexes);
    setStateSimulation(createNovelStateSimulation(sample.project, sample.chapters));
    setCurrentAsk(null);
    setActiveAskId("");
    setAskHistory([]);
    setAskThroughChapterId("all");
    setSimulationRuns([{ run: sample.run, explanationByStepId: {} }]);
    setActiveSimulationRunId(sample.run.id);
    setSimulationPlaying(false);
    setSimulationInterventionActorId(sample.run.currentSnapshot.actorStates[0]?.actorEntityId || "");
    setPinnedCharacterIds([]);
    setPinnedCausalChainIds([]);
    setPinnedThemeIds([]);
    setCorrectionSet(sample.correctionSet);
    setWorldView("audit");
    setInspectorTab("correction");
    setImportDraft(null);
    setBatchQueue(sample.batchQueue);
    batchQueueRef.current = sample.batchQueue;
    setChapterFilter("all");
    setBlueprint(null);
    setBlueprintExportText("");
    setSimulationStatus(`Sample replay ready with ${sample.run.checkpointEventIds.length} source checkpoint(s).`);
    setStatus("Loaded the 5-chapter Rain Gate sample with evidence, audit, graph, replay, and game view ready.");
    setEvidenceStatus("Sample project saved locally with IndexedDB-backed chapters and evidence indexes.");
  }

  function exportProject() {
    setExportText(JSON.stringify({ project, correctionSet }, null, 2));
    setStatus("Project JSON exported.");
  }

  function importProject() {
    try {
      const payload = JSON.parse(exportText) as NovelWorldProject | { project?: NovelWorldProject; correctionSet?: NovelCorrectionSet };
      const parsed = "project" in payload && payload.project ? payload.project : payload as NovelWorldProject;
      if (parsed.version !== 2) throw new Error("Project JSON must be version 2.");
      const report = validateNovelWorldProject(parsed);
      if (!report.valid) throw new Error(report.errors.join("; "));
      const importedCorrectionSet = "correctionSet" in payload && payload.correctionSet
        ? normalizeNovelCorrectionSet(payload.correctionSet, parsed)
        : createNovelCorrectionSet(parsed);
      const correctionReport = validateNovelCorrectionSet(importedCorrectionSet, parsed, chapterTexts);
      if (!correctionReport.valid) throw new Error(correctionReport.errors.join("; "));
      setProject(parsed);
      setCorrectionSet(importedCorrectionSet);
      setActiveChapterId(parsed.chapters[0]?.input.id || "");
      setSelected({ type: "entity", id: parsed.mergedGraph.entities[0]?.id || "" });
      setBatchQueue(createNovelBatchQueue(parsed, batchQueue.batchSize));
      setStatus("Project JSON imported.");
    } catch (error) {
      setStatus(`Import failed: ${error instanceof Error ? error.message : "invalid JSON"}`);
    }
  }

  async function runNextBatch() {
    const ids = getNextNovelBatchChapterIds(projectRef.current, batchQueue);
    if (!ids.length) {
      setStatus("No queued or retryable chapters remain for the current batch.");
      return;
    }
    setBatchQueue((queue) => ({ ...queue, running: true, paused: false, lastBatchChapterIds: ids, updatedAt: new Date().toISOString() }));
    setStatus(`Running batch: ${ids.map((id) => chapterTitle(id)).join(" / ")}`);
    for (const chapterId of ids) {
      if (batchQueueRef.current.paused) {
        setStatus("Batch paused before the next chapter.");
        break;
      }
      if (projectRef.current.chapters.find((chapter) => chapter.input.id === chapterId)?.status === "ready") {
        setBatchQueue((queue) => updateNovelBatchChapterStatus(queue, chapterId, "ready"));
        continue;
      }
      try {
        setBatchQueue((queue) => updateNovelBatchChapterStatus(queue, chapterId, "indexing"));
        await buildEvidenceIndex(chapterId);
        setBatchQueue((queue) => updateNovelBatchChapterStatus(queue, chapterId, "analyzing"));
        await analyzeChapter(chapterId);
        setBatchQueue((queue) => updateNovelBatchChapterStatus(queue, chapterId, "ready"));
      } catch (error) {
        setBatchQueue((queue) => updateNovelBatchChapterStatus(queue, chapterId, "error"));
        setStatus(`Batch chapter failed: ${chapterTitle(chapterId)}. ${error instanceof Error ? error.message : ""}`);
      }
    }
    setBatchQueue((queue) => ({ ...queue, running: false, updatedAt: new Date().toISOString() }));
    setStatus("Batch finished. Continue with the next batch when ready.");
  }

  function setBatchSize(value: 3 | 5 | 10) {
    setBatchQueue((queue) => ({ ...normalizeNovelBatchQueue(project, queue), batchSize: value, updatedAt: new Date().toISOString() }));
  }

  function pauseBatchQueue() {
    const next = { ...batchQueueRef.current, paused: true, running: false, updatedAt: new Date().toISOString() };
    batchQueueRef.current = next;
    setBatchQueue(next);
    setStatus("Batch queue paused.");
  }

  function resumeBatchQueue() {
    setBatchQueue((queue) => ({ ...queue, paused: false, updatedAt: new Date().toISOString() }));
    setStatus("Batch queue resumed.");
  }

  function skipBatchChapter(chapterId: string) {
    setBatchQueue((queue) => updateNovelBatchChapterStatus(queue, chapterId, "skipped"));
    setStatus(`${chapterTitle(chapterId)} skipped in batch queue.`);
  }

  function retryBatchChapter(chapterId: string) {
    setBatchQueue((queue) => updateNovelBatchChapterStatus(queue, chapterId, "queued"));
    setStatus(`${chapterTitle(chapterId)} queued for retry.`);
  }

  function replaceSimulationRun(run: NovelSimulationRun, explanations?: Record<string, NovelSimulationExplanation>) {
    setSimulationRuns((records) => [
      { run, explanationByStepId: explanations || records.find((record) => record.run.id === run.id)?.explanationByStepId || {} },
      ...records.filter((record) => record.run.id !== run.id)
    ].slice(0, 10));
    setActiveSimulationRunId(run.id);
  }

  function createSimulationReplay() {
    const throughChapterId = chapterFilter === "all" ? undefined : chapterFilter;
    const run = createNovelSimulationRun(correctedProject, {
      seed: `${correctedProject.id}:${throughChapterId || "all"}:grounded-replay:${correctionSet.updatedAt}`,
      mode: "grounded-replay",
      throughChapterId,
      branchStepLimit: 1
    });
    replaceSimulationRun(run, {});
    setSimulationPlaying(false);
    setWorldView("game");
    setInspectorTab("simulation");
    setSimulationInterventionActorId(run.currentSnapshot.actorStates[0]?.actorEntityId || "");
    setSimulationStatus(run.status === "blocked" ? run.warnings[0] || "Replay is blocked." : `Grounded replay created with ${run.checkpointEventIds.length} source checkpoint(s).`);
  }

  function advanceSimulationReplay() {
    if (!activeSimulationRun) {
      createSimulationReplay();
      return;
    }
    let next = advanceNovelSimulation(correctedProject, activeSimulationRun);
    if (next.parentRunId && activeBaselineRun) next = { ...next, branchComparison: compareNovelSimulationBranch(activeBaselineRun, next) };
    replaceSimulationRun(next);
    const latest = next.steps[next.steps.length - 1];
    if (latest) selectWorldItem({ type: "simulation-step", id: latest.id });
    setSimulationStatus(next.status === "complete" ? `Replay complete. Fidelity ${next.comparison.fidelityScore}%.` : next.status === "blocked" ? latest?.gapReason || "Replay blocked by an evidence gap." : `Advanced to step ${next.currentStepIndex}/${next.checkpointEventIds.length}.`);
    if (next.status === "complete" || next.status === "blocked") setSimulationPlaying(false);
  }

  function rewindSimulationReplay() {
    if (!activeSimulationRun) return;
    let next = rewindNovelSimulation(correctedProject, activeSimulationRun);
    if (next.parentRunId && activeBaselineRun) next = { ...next, branchComparison: compareNovelSimulationBranch(activeBaselineRun, next) };
    replaceSimulationRun(next);
    const latest = next.steps[next.steps.length - 1];
    if (latest) selectWorldItem({ type: "simulation-step", id: latest.id });
    setSimulationPlaying(false);
    setSimulationStatus(`Rewound to step ${next.currentStepIndex}.`);
  }

  function resetSimulationReplay() {
    if (!activeSimulationRun) {
      createSimulationReplay();
      return;
    }
    let next: NovelSimulationRun;
    if (activeSimulationRun.parentRunId && activeBaselineRun) {
      const intervention = activeSimulationRun.interventions[0];
      next = createNovelSimulationBranch(correctedProject, activeBaselineRun, {
        stepIndex: activeSimulationRun.branchFromStepIndex,
        seed: activeSimulationRun.seed,
        branchStepLimit: activeSimulationRun.branchStepLimit,
        intervention: intervention ? { kind: intervention.kind, actorEntityId: intervention.actorEntityId, value: intervention.value } : undefined
      });
    } else {
      next = createNovelSimulationRun(correctedProject, {
        seed: activeSimulationRun.seed,
        mode: "grounded-replay",
        throughChapterId: activeSimulationRun.throughChapterId,
        branchStepLimit: activeSimulationRun.branchStepLimit
      });
    }
    replaceSimulationRun(next, {});
    setSimulationPlaying(false);
    setSimulationStatus("Replay reset to its initial grounded state.");
  }

  function applySimulationIntervention() {
    if (!activeSimulationRun || !activeBaselineRun || !simulationInterventionActorId) {
      setSimulationStatus("Create a replay and select an actor before applying an intervention.");
      return;
    }
    let value: string | number | boolean = simulationInterventionValue;
    if (simulationInterventionKind === "relationship-pressure" || simulationInterventionKind === "body-capability") value = Number(simulationInterventionValue);
    if (simulationInterventionKind === "knowledge") value = simulationInterventionValue !== "false";
    const branchFromStepIndex = selectedSimulationStep
      ? Math.min(selectedSimulationStep.index, activeBaselineRun.steps.length)
      : activeBaselineRun.currentStepIndex;
    const next = createNovelSimulationBranch(correctedProject, activeBaselineRun, {
      stepIndex: branchFromStepIndex,
      seed: `${activeBaselineRun.seed}:branch:${branchFromStepIndex}:${Date.now()}`,
      branchStepLimit: 1,
      intervention: {
        kind: simulationInterventionKind,
        actorEntityId: simulationInterventionActorId,
        value
      }
    });
    replaceSimulationRun(next);
    setSimulationPlaying(false);
    setSimulationStatus(next.interventions.length ? `Branch created from checkpoint ${branchFromStepIndex}. The baseline remains unchanged.` : next.warnings[next.warnings.length - 1] || "Intervention was not applied.");
  }

  function resolveIdentityDecision(decision: NovelEntityIdentityDecision, status: "confirmed" | "rejected") {
    const nextProject = resolveNovelEntityIdentity(project, decision.id, status);
    setProject(nextProject);
    projectRef.current = nextProject;
    setSimulationPlaying(false);
    setStatus(status === "confirmed"
      ? `${decision.sourceName} confirmed as ${decision.canonicalName}. Existing replays are now stale.`
      : `${decision.sourceName} kept separate from ${decision.canonicalName}. Existing replays are now stale.`);
  }

  async function explainSimulationStep(step = selectedSimulationStep) {
    if (!step || !activeSimulationRecord) return;
    setSimulationExplainBusy(true);
    try {
      const response = await fetch(apiUrl("/api/v1/command/novel/simulation/explain"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step })
      });
      const payload = (await response.json()) as V1Result<{ explanation: NovelSimulationExplanation; validation: NovelWorldValidationReport }>;
      if (!payload.ok || !payload.data) throw new Error(payload.error?.message || "Explanation failed");
      setSimulationRuns((records) => records.map((record) => record.run.id === activeSimulationRecord.run.id
        ? { ...record, explanationByStepId: { ...record.explanationByStepId, [step.id]: payload.data!.explanation } }
        : record));
      setSimulationStatus("Decision explanation generated without changing simulation state.");
    } catch (error) {
      setSimulationStatus(`Explanation unavailable. ${error instanceof Error ? error.message : ""}`);
    } finally {
      setSimulationExplainBusy(false);
    }
  }

  async function askBook() {
    const question = askQuestion.trim();
    if (!question) {
      setAskStatus("Enter a question about analyzed chapters first.");
      return;
    }
    const throughChapterId = askThroughChapterId === "all" ? undefined : askThroughChapterId;
    setAskBusy(true);
    setAskStatus("Searching local evidence and preparing a constrained answer...");
    try {
      const response = await fetch(apiUrl("/api/v1/command/novel/ask"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: correctedProject, chapters: chapterTexts, question, throughChapterId })
      });
      const payload = (await response.json()) as V1Result<{
        mock: boolean;
        answer: NovelAskAnswer;
        queryPlan: NovelAskQueryPlan;
        evidenceHits: NovelAskEvidenceHit[];
        validation: NovelWorldValidationReport;
        repaired: boolean;
      }>;
      if (!payload.ok || !payload.data) throw new Error(payload.error?.message || "Ask failed");
      const validationReport = validateNovelAskAnswer(payload.data.answer, payload.data.evidenceHits, chapterTexts);
      if (!validationReport.valid) throw new Error(validationReport.errors.join("; "));
      const item: NovelAskHistoryItem = {
        id: `ask:${Date.now()}`,
        question,
        askedAt: new Date().toISOString(),
        throughChapterId,
        answer: payload.data.answer,
        queryPlan: payload.data.queryPlan,
        evidenceHits: payload.data.evidenceHits
      };
      setCurrentAsk(item);
      setActiveAskId(item.id);
      setAskHistory((items) => [item, ...items.filter((entry) => entry.id !== item.id)].slice(0, 20));
      setWorldView("ask");
      setAskStatus(payload.data.mock ? "Answered with local evidence fallback." : payload.data.repaired ? "Answered after model repair." : "Answered from constrained evidence.");
    } catch (error) {
      const queryPlan = buildNovelAskQueryPlan(correctedProject, question, throughChapterId);
      const { evidenceHits } = searchNovelAskEvidence(correctedProject, chapterTexts, queryPlan, throughChapterId);
      const answer = createFallbackNovelAskAnswer(correctedProject, question, evidenceHits, queryPlan);
      const item: NovelAskHistoryItem = {
        id: `ask:${Date.now()}`,
        question,
        askedAt: new Date().toISOString(),
        throughChapterId,
        answer,
        queryPlan,
        evidenceHits
      };
      setCurrentAsk(item);
      setActiveAskId(item.id);
      setAskHistory((items) => [item, ...items].slice(0, 20));
      setWorldView("ask");
      setAskStatus(`API unavailable; using local evidence answer. ${error instanceof Error ? error.message : ""}`);
    } finally {
      setAskBusy(false);
    }
  }

  function selectAskHistory(item: NovelAskHistoryItem) {
    setCurrentAsk(item);
    setActiveAskId(item.id);
    setAskQuestion(item.question);
    setAskThroughChapterId(item.throughChapterId || "all");
    setWorldView("ask");
  }

  async function generateBlueprint() {
    const afterChapterId = blueprintTargetChapter(correctedProject, activeChapterId, blueprintTargetMode);
    setBlueprintBusy(true);
    setBlueprintStatus("Generating read-only chapter blueprint...");
    try {
      const response = await fetch(apiUrl("/api/v1/command/novel/blueprint"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: correctedProject, chapters: chapterTexts, afterChapterId, options: blueprintOptions })
      });
      const payload = (await response.json()) as V1Result<{
        mock: boolean;
        blueprint: NovelChapterBlueprint;
        validation: NovelWorldValidationReport;
        repaired: boolean;
      }>;
      if (!payload.ok || !payload.data) throw new Error(payload.error?.message || "Blueprint generation failed");
      const nextBlueprint = normalizeNovelChapterBlueprint(payload.data.blueprint);
      const nextValidation = chapterTexts.length
        ? validateEvidenceAwareNovelChapterBlueprint(nextBlueprint, correctedProject, chapterTexts)
        : validateNovelChapterBlueprint(nextBlueprint, correctedProject);
      if (!nextValidation.valid) throw new Error(nextValidation.errors.join("; "));
      setBlueprint(nextBlueprint);
      setBlueprintExportText("");
      setWriterSelection(nextBlueprint.sceneBeats[0] ? { type: "beat", id: nextBlueprint.sceneBeats[0].id } : null);
      setBlueprintStatus(payload.data.mock ? "Blueprint generated with local fallback." : payload.data.repaired ? "Blueprint generated after model repair." : "Blueprint generated.");
    } catch (error) {
      const fallback = createFallbackNovelChapterBlueprint(correctedProject, afterChapterId, blueprintOptions);
      setBlueprint(fallback);
      setBlueprintExportText("");
      setWriterSelection(fallback.sceneBeats[0] ? { type: "beat", id: fallback.sceneBeats[0].id } : null);
      setBlueprintStatus(`API unavailable; using local fallback. ${error instanceof Error ? error.message : ""}`);
    } finally {
      setBlueprintBusy(false);
    }
  }

  function runStateSimulation() {
    const throughChapterId = blueprintTargetChapter(correctedProject, activeChapterId, "latest");
    const simulation = createNovelStateSimulation(correctedProject, chapterTexts, throughChapterId);
    setStateSimulation(simulation);
    setEvidenceStatus(simulation.summary);
  }

  function upsertCorrectionPatch(patch: NovelCorrectionPatch, status: NovelCorrectionPatch["status"] = "applied") {
    const at = new Date().toISOString();
    const nextPatch: NovelCorrectionPatch = {
      ...patch,
      status,
      updatedAt: at,
      auditTrail: [...patch.auditTrail, { at, action: status === "applied" ? "applied" : status === "dismissed" ? "dismissed" : "created", note: `Patch ${status}.` }]
    };
    setCorrectionSet((current) => ({
      ...current,
      patches: [nextPatch, ...current.patches.filter((item) => item.id !== patch.id)].slice(0, 80),
      updatedAt: at
    }));
    setInspectorTab("correction");
    setSelected({ type: "correction", id: patch.id });
    setEvidenceStatus(`Correction ${status}: ${patch.reason}`);
  }

  function applySuggestedCorrection(patch: NovelCorrectionPatch) {
    upsertCorrectionPatch(patch, "applied");
  }

  function dismissSuggestedCorrection(patch: NovelCorrectionPatch) {
    upsertCorrectionPatch(patch, "dismissed");
  }

  function revertCorrection(patchId: string) {
    setCorrectionSet((current) => revertNovelCorrectionPatch(current, patchId));
    setInspectorTab("correction");
    setSelected({ type: "correction", id: patchId });
    setEvidenceStatus("Correction reverted.");
  }

  function createManualCorrectionPatch(input: Omit<NovelCorrectionPatch, "createdAt" | "updatedAt" | "auditTrail" | "status">) {
    const at = new Date().toISOString();
    return normalizeNovelCorrectionPatch({
      ...input,
      status: "applied",
      createdAt: at,
      updatedAt: at,
      auditTrail: [{ at, action: "created", note: "Manual correction created." }]
    });
  }

  function quickRenameFirstEntity() {
    const entity = graph.entities.find((item) => item.kind === "character") || graph.entities[0];
    if (!entity) return;
    const baseName = entity.name.replace(/\s*\(Corrected\)\s*$/i, "");
    applySuggestedCorrection(createManualCorrectionPatch({
      id: `manual-rename-${entity.id}`,
      target: { kind: "entity", id: entity.id },
      operation: { type: "rename-entity", name: `${baseName} (Corrected)` },
      reason: `Rename ${baseName} for review.`
    }));
  }

  function quickMergeDuplicateEntity() {
    const duplicateKey = (value: string) => value.replace(/\s*\(Corrected\)\s*$/i, "").trim().toLowerCase();
    const pair = graph.entities.flatMap((source, sourceIndex) => graph.entities.slice(sourceIndex + 1)
      .filter((target) => duplicateKey(source.name) === duplicateKey(target.name))
      .map((target) => [source, target] as const))[0];
    if (!pair) {
      setEvidenceStatus("No same-name duplicate candidate is available for quick merge.");
      return;
    }
    const [first, second] = pair[0].kind === "character" ? pair : [pair[1], pair[0]];
    applySuggestedCorrection(createManualCorrectionPatch({
      id: `manual-merge-${second.id}-into-${first.id}`,
      target: { kind: "entity", id: second.id },
      operation: { type: "merge-entities", sourceEntityId: second.id, targetEntityId: first.id },
      reason: `Merge possible duplicate ${second.name} into ${first.name}.`
    }));
  }

  function quickReplaceEvidence() {
    const entity = graph.entities.find((item) => item.evidence?.length) || graph.entities[0];
    const snippet = Object.values(evidenceIndexes).flatMap((index) => index.snippets)[0] || entity?.evidence?.[0];
    if (!entity || !snippet) return;
    applySuggestedCorrection(createManualCorrectionPatch({
      id: `manual-evidence-${entity.id}`,
      target: { kind: "entity", id: entity.id },
      operation: { type: "replace-evidence", evidence: [snippet] },
      reason: `Replace evidence for ${entity.name}.`
    }));
  }

  function quickHideCausalClaim() {
    const claim = causalityReport.claims[0];
    if (!claim) return;
    applySuggestedCorrection(createManualCorrectionPatch({
      id: `manual-hide-${claim.id}`,
      target: { kind: "causal-claim", id: claim.id },
      operation: { type: "hide-object", reason: "Rejected by manual audit." },
      reason: `Hide causal claim ${claim.id}.`
    }));
  }

  function correctionTargetLabel(target?: NovelCorrectionPatch["target"] | NovelQualityIssue["target"]) {
    if (!target) return "Project-level audit";
    if (target.kind === "entity") return `Entity: ${entityById.get(target.id)?.name || target.id}`;
    if (target.kind === "relationship") {
      const relationship = graph.relationships.find((item) => item.id === target.id);
      return relationship ? `Relationship: ${entityById.get(relationship.fromEntityId)?.name || relationship.fromEntityId} / ${entityById.get(relationship.toEntityId)?.name || relationship.toEntityId}` : `Relationship: ${target.id}`;
    }
    if (target.kind === "event") return `Event: ${graph.events.find((item) => item.id === target.id)?.title || target.id}`;
    if (target.kind === "development") return `Development: ${graph.development.find((item) => item.id === target.id)?.title || target.id}`;
    if (target.kind === "character-state") return `Character state: ${characterArcs.flatMap((arc) => arc.points).find((item) => item.id === target.id)?.summary || target.id}`;
    if (target.kind === "theme-signal") return `Theme signal: ${themeArcs.flatMap((arc) => arc.signals).find((item) => item.id === target.id)?.summary || target.id}`;
    if (target.kind === "causal-claim") return `Causal claim: ${causalityReport.claims.find((item) => item.id === target.id)?.summary || target.id}`;
    return `Evidence: ${target.ownerKind}/${target.ownerId}`;
  }

  function exportBlueprint() {
    if (!blueprint) {
      setBlueprintStatus("Generate a blueprint before exporting.");
      return;
    }
    setBlueprintExportText(JSON.stringify(blueprint, null, 2));
    setBlueprintStatus("Blueprint JSON exported.");
  }

  async function copyBlueprint() {
    if (!blueprint) {
      setBlueprintStatus("Generate a blueprint before copying.");
      return;
    }
    const text = JSON.stringify(blueprint, null, 2);
    setBlueprintExportText(text);
    try {
      await navigator.clipboard.writeText(text);
      setBlueprintStatus("Blueprint copied to clipboard.");
    } catch {
      setBlueprintStatus("Clipboard unavailable; blueprint JSON is in the export box.");
    }
  }

  return (
    <main className="worldGraphShell" data-testid="world-graph-workbench">
      <aside className="worldGraphInput">
        <div className="brandBlock">
          <div className="brandIcon"><Network size={24} /></div>
          <div>
            <p>Living World Lab</p>
            <h1>Observable World</h1>
          </div>
        </div>
        <div className="modeSwitch">
          <button onClick={onBack}>Play</button>
          <button className="active">Living World Lab</button>
        </div>
        <section className="hudPanel projectLibraryPanel" data-testid="novel-project-library">
          <div className="panelHeaderLine">
            <div>
              <span className="eyebrow">Project Library</span>
              <h2><Database size={16} /> {runtimeMode === "static-demo" ? "Local Draft" : "SQLite Server"}</h2>
            </div>
            <span className={`projectSyncBadge ${serverSyncState}`} data-testid="novel-project-sync-state">{serverSyncState}</span>
          </div>
          {runtimeMode === "static-demo" ? (
            <p>Static Runtime keeps this project in IndexedDB. Switch to Server Runtime to create a durable SQLite copy.</p>
          ) : (
            <>
              <div className="projectLibraryActions">
                <button data-testid="save-server-project" type="button" className="primaryButton compact" onClick={() => void saveServerProject()} disabled={serverBusy || serverOffline} title="Save current project to SQLite">
                  {serverBusy ? <Loader2 className="spin" size={14} /> : <Save size={14} />} Save
                </button>
                <button data-testid="save-server-project-copy" type="button" onClick={() => void saveServerProjectCopy()} disabled={serverBusy || serverOffline} title="Save as a new SQLite project">
                  <Copy size={14} /> Save copy
                </button>
                {serverConflict && serverProjectId && (
                  <button data-testid="reload-server-project" type="button" onClick={() => void openServerProject(serverProjectId, true)} disabled={serverBusy} title="Discard this view and reload the server copy">
                    <RotateCcw size={14} /> Reload
                  </button>
                )}
              </div>
              <div className="serverProjectList" data-testid="server-project-list">
                {serverProjects.length === 0 && (
                  <p className="serverProjectEmpty">No SQLite projects yet. Save this sample to create the first server copy.</p>
                )}
                {serverProjects.map((item) => (
                  <button
                    key={item.id}
                    data-testid={`open-server-project-${item.id}`}
                    type="button"
                    className={item.id === serverProjectId ? "active" : ""}
                    onClick={() => void openServerProject(item.id)}
                    disabled={serverBusy}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.chapterCount} chapters / {item.genreTone}</span>
                    <small>{new Date(item.updatedAt).toLocaleString()}</small>
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="projectServerStatus" data-testid="novel-project-server-status">{serverStatus}</p>
        </section>
        <section className="hudPanel sampleProjectPanel" data-testid="sample-project-panel">
          <div className="panelHeaderLine">
            <span className="eyebrow">Demo-ready sample</span>
            <button data-testid="load-sample-novel" className="primaryButton compact" type="button" onClick={loadSampleProject}>Load sample</button>
          </div>
          <h2>Rain Gate Sample</h2>
          <p>Five analyzed chapters with paragraph evidence, audit issues, corrected-view workflow, grounded replay, and Phaser observer data.</p>
          <div className="sampleFlow">
            <span>Import</span>
            <span>Audit</span>
            <span>Replay</span>
            <span>Game</span>
          </div>
        </section>
        <details className="hudPanel workbenchToolPanel wholeBookImportPanel" data-testid="whole-book-import-panel">
          <summary><span><FileSearch size={16} /> Whole Book Import</span><ChevronDown size={15} /></summary>
          <div className="toolPanelBody">
          <div className="panelHeaderLine"><small>Editable preview before IndexedDB import</small><button data-testid="create-import-preview" className="linkButton" type="button" onClick={createWholeBookPreview}>Preview</button></div>
          <label>Book title<input data-testid="whole-book-title" value={wholeBookTitle} onChange={(event) => setWholeBookTitle(event.target.value)} /></label>
          <label>Source note<input data-testid="whole-book-source-note" value={wholeBookSourceNote} onChange={(event) => setWholeBookSourceNote(event.target.value)} /></label>
          <label>Whole book text<textarea data-testid="whole-book-text" value={wholeBookText} onChange={(event) => setWholeBookText(event.target.value)} placeholder="Paste the whole novel text here. The app will create editable chapter candidates before import." /></label>
          {importDraft && (
            <div className="importPreview" data-testid="whole-book-import-preview">
              <div className="panelHeaderLine">
                <strong>{importDraft.candidates.length} candidates</strong>
                <button data-testid="confirm-import-preview" type="button" className="primaryButton compact" onClick={confirmWholeBookImport} disabled={!importValidation?.valid}>Import</button>
              </div>
              {importValidation?.warnings[0] && <p className="evidenceNote">{importValidation.warnings[0]}</p>}
              {importDraft.candidates.slice(0, 12).map((candidate) => (
                <article key={candidate.id} className="importCandidate">
                  <span>{candidate.order}</span>
                  <input data-testid={`import-candidate-title-${candidate.order}`} value={candidate.title} onChange={(event) => updateImportCandidate(candidate.id, { title: event.target.value })} />
                  <small>{candidate.rawText.length} chars / {candidate.warning || "heading detected"}</small>
                  <div className="authoringActions">
                    <button type="button" onClick={() => mergeImportCandidateWithNext(candidate.id)}>Merge next</button>
                    <button data-testid={`remove-import-candidate-${candidate.order}`} type="button" onClick={() => removeImportCandidate(candidate.id)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          )}
          </div>
        </details>
        <section className="hudPanel chapterQueuePanel" data-testid="chapter-queue">
          <div className="panelHeaderLine">
            <h2><BookOpen size={16} /> Chapters</h2>
            <button className="linkButton" type="button" onClick={addChapter}>Add</button>
          </div>
          <div className="queueSummary" data-testid="chapter-queue-summary">
            <span><strong>{project.chapters.length}</strong><small>total</small></span>
            <span><strong>{readyCount}</strong><small>ready</small></span>
            <span><strong>{queuedCount}</strong><small>queued</small></span>
            <span><strong>{failedCount}</strong><small>error</small></span>
            <span><strong>{skippedCount}</strong><small>skipped</small></span>
          </div>
          <div className="chapterQueue">
            {project.chapters.map((chapter) => (
              <button key={chapter.input.id} type="button" className={chapter.input.id === activeChapterId ? "selected" : ""} onClick={() => setActiveChapterId(chapter.input.id)}>
                <span>{chapter.input.order}</span>
                <strong>{chapter.input.title}</strong>
                <small>{chapter.status}</small>
              </button>
            ))}
          </div>
        </section>
        <section className="hudPanel simulationRunPanel" data-testid="simulation-run-panel">
          <div className="panelHeaderLine">
            <h2><Play size={16} /> Replay Runs</h2>
            <button className="linkButton" type="button" onClick={createSimulationReplay}>New</button>
          </div>
          <div className="replayStateSummary" data-testid="replay-state-summary">
            <span><strong>{activeSimulationRun?.comparison.fidelityScore ?? 0}%</strong><small>fidelity</small></span>
            <span><strong>{replayMatchedCount}</strong><small>matched</small></span>
            <span><strong>{replayGapCount}</strong><small>gaps</small></span>
            <span><strong>{activeSimulationRun?.interventions.length ?? 0}</strong><small>interventions</small></span>
          </div>
          <div className="simulationRunList">
            {simulationRuns.length === 0 && <p className="evidenceNote">Analyze chapters, then create an evidence-grounded replay.</p>}
            {simulationRuns.map((record) => (
              <button
                key={record.run.id}
                type="button"
                className={record.run.id === activeSimulationRun?.id ? "active" : ""}
                onClick={() => {
                  setActiveSimulationRunId(record.run.id);
                  setWorldView("game");
                  setInspectorTab("simulation");
                }}
              >
                <strong>{record.run.mode === "grounded-replay" ? "Grounded Replay" : "Short Branch"}</strong>
                <span>{record.run.currentStepIndex}/{record.run.checkpointEventIds.length} steps / fidelity {record.run.comparison.fidelityScore}%</span>
              </button>
            ))}
          </div>
        </section>
        <section className="hudPanel askHistoryPanel" data-testid="ask-history-panel">
          <div className="panelHeaderLine">
            <h2><MessageSquare size={16} /> Ask History</h2>
            <small>{askHistory.length}/20</small>
          </div>
          <div className="askHistoryList">
            {askHistory.length === 0 && <p className="evidenceNote">Ask questions after chapter analysis; answers stay local to this browser.</p>}
            {askHistory.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === activeAskId ? "active" : ""}
                onClick={() => selectAskHistory(item)}
              >
                <strong>{item.question}</strong>
                <span>{item.answer.status} / {item.evidenceHits.length} evidence</span>
              </button>
            ))}
          </div>
        </section>
        <section className="hudPanel causalFocusPanel" data-testid="causal-focus-panel">
          <div className="panelHeaderLine">
            <h2><Network size={16} /> Causal Focus</h2>
            <small>{validPinnedCausalChainIds.length}/3 pinned</small>
          </div>
          <div className="causalFocusList">
            {rankedCausalChains.slice(0, 10).map((chain, index) => {
              const pinned = validPinnedCausalChainIds.includes(chain.id);
              const active = displayedCausalChains.some((item) => item.id === chain.id);
              return (
                <article key={chain.id} className={active ? "active" : ""}>
                  <button type="button" onClick={() => {
                    setWorldView("causality");
                    const firstClaimId = chain.claimIds[0];
                    if (firstClaimId) selectWorldItem({ type: "causal-claim", id: firstClaimId });
                  }}>
                    <strong>{chain.title}</strong>
                    <small>{index === 0 ? "Top chain" : `${chain.claimIds.length} claims`} / {chain.contestedClaimIds.length} contested / {chain.evidenceGapChapterIds.length} gaps</small>
                  </button>
                  <button
                    type="button"
                    className={pinned ? "pinned" : ""}
                    data-testid={`pin-causal-chain-${chain.id}`}
                    title={pinned ? "Unpin causal chain" : "Pin causal chain"}
                    onClick={() => { togglePinnedCausalChain(chain.id); setWorldView("causality"); }}
                  >
                    <Pin size={14} />
                  </button>
                </article>
              );
            })}
          </div>
          {causalityReport.gaps[0] && <button data-testid="causal-gap-focus" className="causalGapButton" type="button" onClick={() => { setWorldView("causality"); selectWorldItem({ type: "causal-gap", id: causalityReport.gaps[0] }); }}>Low evidence gap: {causalityReport.gaps.length}</button>}
        </section>
        <section className="hudPanel themeFocusPanel" data-testid="theme-focus-panel">
          <div className="panelHeaderLine">
            <h2><GitBranch size={16} /> Theme Focus</h2>
            <small>{validPinnedThemeIds.length}/4 pinned</small>
          </div>
          <div className="themeFocusList">
            {rankedThemeArcs.slice(0, 12).map((arc) => {
              const theme = themeRegistry.find((item) => item.id === arc.themeId);
              const pinned = validPinnedThemeIds.includes(arc.themeId);
              const active = displayedThemeArcs.some((item) => item.themeId === arc.themeId);
              if (!theme || theme.status === "hidden") return null;
              return (
                <article key={arc.themeId} className={active ? "active" : ""}>
                  <div>
                    <input
                      data-testid={`theme-name-${arc.themeId}`}
                      value={theme.name}
                      onChange={(event) => renameTheme(arc.themeId, event.target.value)}
                    />
                    <small>{theme.status} / {arc.signals.length} signals / {arc.contestedSignalIds.length} contested</small>
                  </div>
                  <div className="themeFocusActions">
                    {theme.status === "pending" && <button data-testid={`confirm-theme-${arc.themeId}`} type="button" onClick={() => setThemeStatus(arc.themeId, "confirmed")}>Confirm</button>}
                    {theme.status === "pending" && <button data-testid={`merge-theme-${arc.themeId}`} type="button" onClick={() => mergeThemeIntoTarget(arc.themeId)}>Merge</button>}
                    <button data-testid={`hide-theme-${arc.themeId}`} type="button" onClick={() => setThemeStatus(arc.themeId, "hidden")}>Hide</button>
                    <button data-testid={`pin-theme-${arc.themeId}`} type="button" className={pinned ? "pinned" : ""} onClick={() => { togglePinnedTheme(arc.themeId); setWorldView("theme"); }}><Pin size={13} /></button>
                  </div>
                </article>
              );
            })}
          </div>
          {pendingThemes.length > 0 && <p className="evidenceNote">{pendingThemes.length} pending theme candidate(s) need review.</p>}
        </section>
        <section className="hudPanel characterFocusPanel" data-testid="character-focus-panel">
          <div className="panelHeaderLine">
            <h2><Users size={16} /> Character Focus</h2>
            <small>{validPinnedCharacterIds.length}/3 pinned</small>
          </div>
          <div className="characterFocusList">
            {rankedCharacterArcs.slice(0, 10).map((arc, index) => {
              const pinned = validPinnedCharacterIds.includes(arc.characterEntityId);
              const active = displayedCharacterArcs.some((item) => item.characterEntityId === arc.characterEntityId);
              return (
                <div key={arc.characterEntityId} className={active ? "active" : ""}>
                  <button type="button" onClick={() => {
                    if (!pinned) togglePinnedCharacter(arc.characterEntityId);
                    setWorldView("arc");
                  }}>
                    <strong>{arc.characterName}</strong>
                    <small>{index === 0 ? "Auto lead" : `${arc.points.length} chapters`} / score {arc.score}</small>
                  </button>
                  <button
                    type="button"
                    className={pinned ? "pinned" : ""}
                    data-testid={`pin-character-${arc.characterEntityId}`}
                    title={pinned ? "Unpin character" : "Pin character"}
                    onClick={() => togglePinnedCharacter(arc.characterEntityId)}
                  >
                    <Pin size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
        <section className="hudPanel wholeBookProgressPanel" data-testid="whole-book-progress">
          <div className="panelHeaderLine">
            <h2><Database size={16} /> Whole Book Progress</h2>
            <button data-testid="run-next-batch" className="primaryButton compact" type="button" onClick={() => void runNextBatch()} disabled={batchQueue.running || !nextBatchIds.length}>
              {batchQueue.running ? <Loader2 className="spin" size={14} /> : <Network size={14} />} Next {nextBatchIds.length || batchQueue.batchSize}
            </button>
          </div>
          <div className="metricGrid compactMetrics">
            <div><strong>{project.chapters.length}</strong><small>Chapters</small></div>
            <div><strong>{indexedCount}</strong><small>Indexed</small></div>
            <div><strong>{analyzedCount}</strong><small>Analyzed</small></div>
            <div><strong>{failedCount}</strong><small>Failed</small></div>
            <div><strong>{skippedCount}</strong><small>Skipped</small></div>
            <div><strong>{evidenceCoverage}%</strong><small>Coverage</small></div>
            <div><strong>{progressGrowth.entities}</strong><small>Entities</small></div>
            <div><strong>{progressGrowth.events}</strong><small>Events</small></div>
            <div><strong>{characterStateCount}</strong><small>State points</small></div>
            <div><strong>{characterTurningPointCount}</strong><small>Turning</small></div>
            <div><strong>{characterEvidenceCount}</strong><small>Arc evidence</small></div>
            <div><strong>{themeRegistry.filter((theme) => theme.status !== "hidden").length}</strong><small>Themes</small></div>
            <div><strong>{themeSignalCount}</strong><small>Theme signals</small></div>
            <div><strong>{contestedThemeSignalCount}</strong><small>Contested</small></div>
            <div><strong>{themeEvidenceCount}</strong><small>Theme evidence</small></div>
            <div><strong>{causalClaimCount}</strong><small>Causal claims</small></div>
            <div><strong>{causalGapCount}</strong><small>Causal gaps</small></div>
            <div><strong>{contestedCausalClaimCount}</strong><small>Causal contested</small></div>
          </div>
          <div className="workbenchSummary" data-testid="workbench-summary">
            <article>
              <strong>Next batch</strong>
              <span>{nextBatchIds.length ? nextBatchIds.map((id) => chapterTitle(id)).join(" / ") : "No queued chapters"}</span>
            </article>
            <article>
              <strong>Last batch</strong>
              <span>{lastBatchLabels.length ? lastBatchLabels.join(" / ") : "Not run yet"}</span>
            </article>
            <article>
              <strong>Merged graph</strong>
              <span>{progressGrowth.entities} entities / {progressGrowth.relationships} relationships / {progressGrowth.events} events / {progressGrowth.development} developments</span>
            </article>
          </div>
          <div className="batchControls">
            <label>Batch
              <select data-testid="batch-size-select" value={batchQueue.batchSize} onChange={(event) => setBatchSize(Number(event.target.value) as 3 | 5 | 10)}>
                <option value={3}>3 chapters</option>
                <option value={5}>5 chapters</option>
                <option value={10}>10 chapters</option>
              </select>
            </label>
            <button type="button" onClick={pauseBatchQueue}>Pause</button>
            <button type="button" onClick={resumeBatchQueue}>Resume</button>
          </div>
          <div className="batchChapterList" data-testid="batch-chapter-list">
            {project.chapters.slice(0, 24).map((chapter) => {
              const queueStatus = batchQueue.chapterStatuses[chapter.input.id] || chapter.status;
              return (
                <article key={chapter.input.id}>
                  <span>{chapter.input.order}</span>
                  <strong>{chapter.input.title}</strong>
                  <small>{queueStatus}</small>
                  <button type="button" onClick={() => retryBatchChapter(chapter.input.id)}>Retry</button>
                  <button type="button" onClick={() => skipBatchChapter(chapter.input.id)}>Skip</button>
                </article>
              );
            })}
          </div>
        </section>
        <details className="hudPanel workbenchToolPanel">
          <summary><span><BookOpen size={16} /> Active Chapter</span><ChevronDown size={15} /></summary>
          <div className="toolPanelBody">
          <label>Chapter title<input value={activeChapter?.input.title || ""} onChange={(event) => updateActiveChapter({ title: event.target.value })} /></label>
          <label>Fragment<textarea data-testid="novel-fragment-input" value={activeChapter?.input.fragment || ""} onChange={(event) => updateActiveChapter({ fragment: event.target.value })} /></label>
          <button data-testid="analyze-novel" className="primaryButton full" onClick={() => void analyzeChapter()} disabled={busy || !activeChapter}>
            {busy ? <Loader2 className="spin" size={16} /> : <Network size={16} />} Analyze Chapter
          </button>
          </div>
        </details>
        <details className="hudPanel workbenchToolPanel evidencePanel" data-testid="long-text-evidence-panel">
          <summary><span><FileSearch size={16} /> Long Text / Evidence</span><ChevronDown size={15} /></summary>
          <div className="toolPanelBody">
          <div className="panelHeaderLine">
            <small>Paragraph indexing and coverage</small>
            <button data-testid="build-evidence-index" className="linkButton" type="button" onClick={() => void buildEvidenceIndex()} disabled={!activeChapter}>Index</button>
          </div>
          <div className="metricGrid compactMetrics">
            <div><strong>{activeChapterText?.paragraphs.length || splitNovelChapterParagraphs(activeChapter?.input.id || "draft", activeChapter?.input.fragment || "").length}</strong><small>Paragraphs</small></div>
            <div><strong>{activeEvidenceIndex?.snippets.length || 0}</strong><small>Snippets</small></div>
            <div><strong>{evidenceCoverage}%</strong><small>Coverage</small></div>
            <div><strong>{storageReady ? "IDB" : "..."}</strong><small>Storage</small></div>
            <div><strong>{graphEvidence.length}</strong><small>Graph refs</small></div>
            <div><strong>{blueprintEvidence.length}</strong><small>Blueprint refs</small></div>
          </div>
          <p className="evidenceNote" data-testid="evidence-status">{evidenceStatus}</p>
          {activeEvidenceIndex?.snippets[0] && (
            <div className="evidenceMini">
              <strong>{activeEvidenceIndex.snippets[0].source.paragraphId}</strong>
              <span>{activeEvidenceIndex.snippets[0].source.quote}</span>
            </div>
          )}
          </div>
        </details>
        <section className="metricGrid metricsPanel">
          <div><strong>{graph.entities.length}</strong><small>Entities</small></div>
          <div><strong>{graph.relationships.length}</strong><small>Relations</small></div>
          <div><strong>{graph.events.length}</strong><small>Events</small></div>
          <div><strong>{graph.development.length}</strong><small>Develop</small></div>
          <div><strong>{project.mergeReport.conflicts.length}</strong><small>Conflicts</small></div>
          <div><strong>{project.mergeReport.analyzedChapterCount}/{project.chapters.length}</strong><small>Analyzed</small></div>
        </section>
        <details className="hudPanel workbenchToolPanel projectIoPanel">
          <summary><span><Database size={16} /> Project JSON</span><ChevronDown size={15} /></summary>
          <div className="toolPanelBody">
          <div className="authoringActions">
            <button onClick={exportProject}>Export</button>
            <button onClick={importProject}>Import</button>
            <button onClick={resetProject}>Reset</button>
          </div>
          <textarea data-testid="novel-project-json" value={exportText} onChange={(event) => setExportText(event.target.value)} placeholder="Exported project JSON appears here. Paste project JSON here to import." />
          </div>
        </details>
        <div className="statusBox"><AlertTriangle size={16} /><span>{status}</span></div>
      </aside>

      <section className="worldGraphStage">
        <header className="stageHud">
          <div>
            <p>Evidence-grounded reading / chapter state tracks</p>
            <h2>{graph.title}</h2>
            <div className="valueProposition">{graph.premise}<span>{graph.observerBrief}</span></div>
          </div>
          <div className="worldStageControls">
            <div className={`correctionModePill ${appliedCorrections.length ? "corrected" : "original"}`} data-testid="correction-mode-pill">
              <strong>{correctionModeLabel}</strong>
              <span>{appliedCorrections.length ? `${appliedCorrections.length} overlay patch(es) active` : "Raw extraction is preserved"}</span>
            </div>
            <select data-testid="chapter-filter" value={chapterFilter} onChange={(event) => setChapterFilter(event.target.value)}>
              <option value="all">All chapters</option>
              {project.chapters.map((chapter) => <option key={chapter.input.id} value={chapter.input.id}>{chapter.input.title}</option>)}
            </select>
            <button className="secondaryButton" onClick={onBack}>Back</button>
          </div>
        </header>
        <nav className="worldViewTabs" data-testid="world-view-tabs">
          <button type="button" className={worldView === "audit" ? "active" : ""} onClick={() => setWorldView("audit")}><ShieldCheck size={15} /> Audit</button>
          <button type="button" className={worldView === "game" ? "active" : ""} onClick={() => setWorldView("game")}><Play size={15} /> Game</button>
          <button type="button" className={worldView === "replay" ? "active" : ""} onClick={() => setWorldView("replay")}><Play size={15} /> Replay</button>
          <button type="button" className={worldView === "ask" ? "active" : ""} onClick={() => setWorldView("ask")}><MessageSquare size={15} /> Ask</button>
          <button type="button" className={worldView === "causality" ? "active" : ""} onClick={() => setWorldView("causality")}><Network size={15} /> Causality</button>
          <button type="button" className={worldView === "theme" ? "active" : ""} onClick={() => setWorldView("theme")}><GitBranch size={15} /> Theme Pressure</button>
          <button type="button" className={worldView === "arc" ? "active" : ""} onClick={() => setWorldView("arc")}><Users size={15} /> Character Arc</button>
          <button type="button" className={worldView === "map" ? "active" : ""} onClick={() => setWorldView("map")}><MapIcon size={15} /> Map</button>
          <button type="button" className={worldView === "events" ? "active" : ""} onClick={() => setWorldView("events")}><ListTree size={15} /> Events</button>
        </nav>
        <div className="worldCanvasWrap">
          {worldView === "audit" && (
            <section className="auditWorkbench" data-testid="audit-view">
              <div className="auditHero">
                <div>
                  <span className="eyebrow">Evidence Correction & Quality Audit</span>
                  <h3>Trust Score {auditReport.score}</h3>
                  <small>{auditReport.issues.length} issue(s), {appliedCorrections.length} applied correction(s), {correctionModeLabel}</small>
                </div>
                <div className="auditQuickActions">
                  <button data-testid="quick-rename-entity" type="button" onClick={quickRenameFirstEntity}>Rename entity</button>
                  <button data-testid="quick-merge-entity" type="button" onClick={quickMergeDuplicateEntity}>Merge duplicate</button>
                  <button data-testid="quick-replace-evidence" type="button" onClick={quickReplaceEvidence}>Replace evidence</button>
                  <button data-testid="quick-hide-causal" type="button" onClick={quickHideCausalClaim}>Hide causal claim</button>
                </div>
              </div>
              <div className="auditFlow" data-testid="audit-flow">
                <article>
                  <strong>1. Issue Queue</strong>
                  <span>{filteredAuditIssues.length} visible issue(s)</span>
                </article>
                <article>
                  <strong>2. Suggested Fixes</strong>
                  <span>{suggestedCorrectionPatches.length} local patch candidate(s)</span>
                </article>
                <article>
                  <strong>3. Applied Corrections</strong>
                  <span>{appliedCorrections.length} active overlay patch(es)</span>
                </article>
                <article className={appliedCorrections.length ? "corrected" : ""}>
                  <strong>4. View Mode</strong>
                  <span>{correctionModeLabel}</span>
                </article>
              </div>
              <div className="auditMetricGrid" data-testid="audit-metrics">
                {auditReport.metrics.map((metric) => (
                  <article key={metric.id}>
                    <strong>{metric.score}</strong>
                    <span>{metric.label}</span>
                    <small>{metric.weight}% / {metric.detail}</small>
                  </article>
                ))}
              </div>
              <section className="identityReview" data-testid="identity-review">
                <div className="panelHeaderLine">
                  <div><span className="eyebrow">Canonical entity registry</span><h3>Identity Review</h3></div>
                  <small>{autoIdentityDecisions.length} auto / {pendingIdentityDecisions.length} pending / {rejectedIdentityDecisions.length} rejected</small>
                </div>
                {pendingIdentityDecisions.length === 0 && <p className="evidenceNote">No medium-confidence entity matches need review. High-confidence identity matches were merged automatically.</p>}
                <div className="identityDecisionList">
                  {pendingIdentityDecisions.slice(0, 12).map((decision) => (
                    <article key={decision.id}>
                      <div><strong>{decision.sourceName}</strong><span>candidate: {decision.canonicalName} / {decision.confidence}%</span><small>{decision.reasons.join(" / ")}</small></div>
                      <div><button data-testid={`confirm-identity-${decision.id}`} type="button" onClick={() => resolveIdentityDecision(decision, "confirmed")}>Confirm</button><button data-testid={`reject-identity-${decision.id}`} type="button" onClick={() => resolveIdentityDecision(decision, "rejected")}>Keep separate</button></div>
                    </article>
                  ))}
                  {autoIdentityDecisions.slice(0, 6).map((decision) => <small key={decision.id} className="identityAutoMerge">Auto merged: {decision.sourceName} to {decision.canonicalName} ({decision.confidence}%)</small>)}
                </div>
              </section>
              <div className="auditFilterBar" data-testid="audit-filter-bar">
                {(["all", "evidence", "entity", "relationship", "event", "character", "theme", "causality", "replay-readiness"] as NovelAuditFilter[]).map((filter) => (
                  <button key={filter} type="button" className={auditFilter === filter ? "active" : ""} onClick={() => setAuditFilter(filter)}>{filter}</button>
                ))}
              </div>
              <div className="auditColumns">
                <section className="auditIssueQueue" data-testid="audit-issue-queue">
                  <div className="panelHeaderLine"><h3>Issue Queue</h3><small>{filteredAuditIssues.length}</small></div>
                  {filteredAuditIssues.length === 0 && <p className="evidenceNote">No issues for this filter.</p>}
                  {filteredAuditIssues.slice(0, 30).map((issue) => (
                    <button key={issue.id} type="button" className={`auditIssue ${issue.severity} ${selected.type === "quality-issue" && selected.id === issue.id ? "selected" : ""}`} onClick={() => {
                      setSelected({ type: "quality-issue", id: issue.id });
                      setInspectorTab("correction");
                    }}>
                      <span>{issue.severity} / {issue.category}</span>
                      <strong>{issue.title}</strong>
                      <small>{issue.detail}</small>
                    </button>
                  ))}
                </section>
                <section className="auditSuggestedFixes" data-testid="audit-suggested-fixes">
                  <div className="panelHeaderLine"><h3>Suggested Fixes</h3><small>{suggestedCorrectionPatches.length}</small></div>
                  {suggestedCorrectionPatches.slice(0, 12).map((patch) => (
                    <article key={patch.id}>
                      <button type="button" data-testid={`suggested-correction-${patch.id}`} onClick={() => {
                        setSelected({ type: "correction", id: patch.id });
                        setInspectorTab("correction");
                      }}>
                        <strong>{patch.reason}</strong>
                        <span>{patch.target.kind} / {patch.operation.type}</span>
                      </button>
                      <div>
                        <button type="button" data-testid={`apply-correction-${patch.id}`} onClick={() => applySuggestedCorrection(patch)}>Apply</button>
                        <button type="button" onClick={() => dismissSuggestedCorrection(patch)}>Dismiss</button>
                      </div>
                    </article>
                  ))}
                </section>
                <section className="auditAppliedCorrections" data-testid="audit-applied-corrections">
                  <div className="panelHeaderLine"><h3>Applied Corrections</h3><small>{appliedCorrections.length}</small></div>
                  {!appliedCorrections.length && <p className="evidenceNote">No overlay patch is active. Apply a suggested fix or quick correction to switch into Corrected View.</p>}
                  {appliedCorrections.map((patch) => (
                    <article key={patch.id}>
                      <button type="button" data-testid={`applied-correction-${patch.id}`} onClick={() => {
                        setSelected({ type: "correction", id: patch.id });
                        setInspectorTab("correction");
                      }}>
                        <strong>{patch.reason}</strong>
                        <span>{patch.target.kind} / {patch.operation.type}</span>
                      </button>
                      <button type="button" data-testid={`revert-correction-${patch.id}`} onClick={() => revertCorrection(patch.id)}>Revert</button>
                    </article>
                  ))}
                </section>
              </div>
              {!correctionValidation.valid && <p className="evidenceNote">Correction validation: {correctionValidation.errors[0]}</p>}
            </section>
          )}
          {worldView === "game" && (
            <section className="novelGameView" data-testid="novel-game-view">
              <div className="gameHudBar">
                <div>
                  <span className="eyebrow">Phaser Observer</span>
                  <h3>Novel world game view</h3>
                  <small>{activeSimulationRun ? `${activeSimulationRun.mode} / step ${activeSimulationRun.currentStepIndex} / fidelity ${activeSimulationRun.comparison.fidelityScore}%` : "Create a replay to animate the extracted world."}</small>
                </div>
                <div className="replayTransport">
                  <button data-testid="game-reset" type="button" title="Reset replay" onClick={resetSimulationReplay}><RotateCcw size={15} /></button>
                  <button data-testid="game-back" type="button" title="Rewind one step" onClick={rewindSimulationReplay} disabled={!activeSimulationRun?.steps.length}><SkipBack size={15} /></button>
                  <button data-testid="game-play" type="button" title={simulationPlaying ? "Pause game" : "Play game"} onClick={() => {
                    if (!activeSimulationRun) createSimulationReplay();
                    setSimulationPlaying((value) => !value);
                  }}>{simulationPlaying ? <Pause size={15} /> : <Play size={15} />}</button>
                  <button data-testid="game-step" type="button" title="Advance one event" onClick={advanceSimulationReplay}><SkipForward size={15} /></button>
                  <div className="replaySpeed" data-testid="game-speed">
                    {([1, 2, 4] as const).map((speed) => <button key={speed} type="button" className={simulationSpeed === speed ? "active" : ""} onClick={() => setSimulationSpeed(speed)}>{speed}x</button>)}
                  </div>
                </div>
              </div>
              <div className="gameVisualControls" data-testid="game-visual-controls">
                <label>Labels
                  <select data-testid="game-label-mode" value={gameVisualPreferences.labels} onChange={(event) => setGameVisualPreferences((current) => ({ ...current, labels: event.target.value as NovelGameVisualPreferences["labels"] }))}>
                    <option value="all">All</option>
                    <option value="focus">Focus</option>
                    <option value="off">Off</option>
                  </select>
                </label>
                <button type="button" data-testid="game-evidence-heat" className={gameVisualPreferences.evidenceHeat ? "active" : ""} onClick={() => setGameVisualPreferences((current) => ({ ...current, evidenceHeat: !current.evidenceHeat }))}>Evidence Heat {gameVisualPreferences.evidenceHeat ? "On" : "Off"}</button>
                <button type="button" data-testid="game-motion-trails" className={gameVisualPreferences.motionTrails ? "active" : ""} onClick={() => setGameVisualPreferences((current) => ({ ...current, motionTrails: !current.motionTrails }))}>Motion Trails {gameVisualPreferences.motionTrails ? "On" : "Off"}</button>
                <div className="replaySpeed" data-testid="game-pixel-scale">
                  {([1, 2] as const).map((scale) => <button key={scale} type="button" className={gameVisualPreferences.pixelScale === scale ? "active" : ""} onClick={() => setGameVisualPreferences((current) => ({ ...current, pixelScale: scale }))}>{scale}x pixels</button>)}
                </div>
              </div>
              {!activeSimulationRun && <button type="button" className="gameCreatePrompt" onClick={createSimulationReplay}>Create Grounded Replay</button>}
              <div className="gameCanvasFrame">
                <NovelGameCanvas
                  state={gameSceneState}
                  visualProfile={gameVisualProfile}
                  onSelect={(item) => {
                    setInspectorTab("simulation");
                    if (item.type === "actor") setSelected({ type: "game-actor", id: item.id });
                    if (item.type === "location") setSelected({ type: "game-location", id: item.id });
                    if (item.type === "event") setSelected({ type: "simulation-step", id: item.stepId });
                  }}
                />
              </div>
              <div className="gameLegend" data-testid="novel-game-legend">
                <span>Source</span>
                <span>Counterfactual</span>
                <span>Evidence gap</span>
                <span>{gameSceneState.locations.length} locations</span>
                <span>{gameSceneState.actors.length} actors</span>
                <span>{gameSceneState.events.length} event markers</span>
                <span>{gameVisualProfile.effects.length} visual effects</span>
              </div>
              {(!gameSceneValidation.valid || !gameVisualValidation.valid || gameSceneValidation.warnings.length > 0 || gameVisualValidation.warnings.length > 0) && (
                <div className="replayWarningStrip" data-testid="novel-game-warnings">
                  {[...gameSceneValidation.errors, ...gameVisualValidation.errors, ...gameSceneValidation.warnings, ...gameVisualValidation.warnings].slice(0, 4).map((warning) => <span key={warning}>{warning}</span>)}
                </div>
              )}
            </section>
          )}
          {worldView === "replay" && (
            <section className="novelReplayView" data-testid="novel-replay-view">
              <div className="replayControlBar">
                <div>
                  <span className="eyebrow">{activeSimulationRun?.mode || "Grounded Replay"}</span>
                  <h3>Evidence-grounded event replay</h3>
                  <small>{simulationStatus}</small>
                </div>
                <div className="replayTransport">
                  <button data-testid="replay-reset" type="button" title="Reset replay" onClick={resetSimulationReplay}><RotateCcw size={15} /></button>
                  <button data-testid="replay-back" type="button" title="Rewind one step" onClick={rewindSimulationReplay} disabled={!activeSimulationRun?.steps.length}><SkipBack size={15} /></button>
                  <button data-testid="replay-play" type="button" title={simulationPlaying ? "Pause replay" : "Play replay"} onClick={() => {
                    if (!activeSimulationRun) createSimulationReplay();
                    setSimulationPlaying((value) => !value);
                  }}>{simulationPlaying ? <Pause size={15} /> : <Play size={15} />}</button>
                  <button data-testid="replay-step" type="button" title="Advance one event" onClick={advanceSimulationReplay}><SkipForward size={15} /></button>
                  <div className="replaySpeed" data-testid="replay-speed">
                    {([1, 2, 4] as const).map((speed) => <button key={speed} type="button" className={simulationSpeed === speed ? "active" : ""} onClick={() => setSimulationSpeed(speed)}>{speed}x</button>)}
                  </div>
                </div>
              </div>
              {!activeSimulationRun ? (
                <button type="button" className="arcEmpty replayEmpty" onClick={createSimulationReplay}>Create a replay from analyzed chapter events</button>
              ) : (
                <>
                  <div className="replayMetrics" data-testid="replay-comparison">
                    <div><strong>{activeSimulationRun.comparison.fidelityScore}%</strong><small>Fidelity</small></div>
                    <div><strong>{Math.round(activeSimulationRun.comparison.eventMatchRate * 100)}%</strong><small>Events</small></div>
                    <div><strong>{Math.round(activeSimulationRun.comparison.orderConsistencyRate * 100)}%</strong><small>Order</small></div>
                    <div><strong>{Math.round(activeSimulationRun.comparison.participantMatchRate * 100)}%</strong><small>Actors</small></div>
                    <div><strong>{Math.round(activeSimulationRun.comparison.locationMatchRate * 100)}%</strong><small>Locations</small></div>
                    <div><strong>{Math.round(activeSimulationRun.comparison.causalCoverageRate * 100)}%</strong><small>Causality</small></div>
                  </div>
                  <div className="replayProvenanceSummary" data-testid="replay-provenance-summary">
                    {(["source", "inferred", "counterfactual", "gap"] as const).map((kind) => (
                      <span key={kind} className={kind}>
                        <strong>{replayProvenanceCounts[kind] || 0}</strong>
                        <small>{kind}</small>
                      </span>
                    ))}
                    <span>
                      <strong>{activeSimulationRun.comparison.completedCheckpointCount}</strong>
                      <small>matched source events</small>
                    </span>
                    <span>
                      <strong>{replayGapCount}</strong>
                      <small>replay gaps</small>
                    </span>
                  </div>
                  {activeSimulationRun.stale && <div className="replayWarningStrip" data-testid="replay-stale-warning"><span>{activeSimulationRun.staleReason || "Replay is stale. Rebuild it before advancing."}</span></div>}
                  {activeSimulationRun.branchComparison && (
                    <section className="branchComparisonPanel" data-testid="branch-state-diff">
                      <div className="panelHeaderLine"><h3>Baseline / Branch State Diff</h3><small>{activeSimulationRun.branchComparison.materialDivergence ? "material divergence" : "no material divergence"}</small></div>
                      <p>{activeSimulationRun.branchComparison.summary}</p>
                      <div className="branchComparisonMetrics"><span>baseline: {activeSimulationRun.branchComparison.baselineAction || "pending"}</span><span>branch: {activeSimulationRun.branchComparison.branchAction || "pending"}</span><span>{activeSimulationRun.branchComparison.causalClaimsAdded.length} causal added</span></div>
                      {activeSimulationRun.branchComparison.actorDiffs.map((diff) => <article key={diff.actorEntityId}><strong>{diff.actorName}</strong><span>{diff.location ? `${entityById.get(diff.location.baseline || "")?.name || "unknown"} -> ${entityById.get(diff.location.branch || "")?.name || "unknown"}` : "location unchanged"}</span><small>knowledge +{diff.knowledgeAdded.length} / -{diff.knowledgeRemoved.length}; resources +{diff.resourcesAdded.length} / -{diff.resourcesRemoved.length}; pressure {diff.relationshipPressureDelta}; body {diff.bodyCapabilityDelta}</small></article>)}
                    </section>
                  )}
                  <section className="replayCheckpointLane" data-testid="replay-checkpoints">
                    <div className="panelHeaderLine">
                      <h3>Source checkpoints</h3>
                      <small>{activeSimulationRun.currentStepIndex}/{activeSimulationRun.checkpointEventIds.length}</small>
                    </div>
                    <div className="replayCheckpointTrack">
                      {activeSimulationRun.checkpointEventIds.map((eventId, index) => {
                        const event = graph.events.find((item) => item.id === eventId);
                        const step = activeSimulationRun.steps[index];
                        return (
                          <button
                            key={eventId}
                            type="button"
                            className={`${step ? step.provenance : index === activeSimulationRun.currentStepIndex ? "current" : "pending"} ${selectedSimulationStep?.id === step?.id ? "selected" : ""}`}
                            onClick={() => step ? selectWorldItem({ type: "simulation-step", id: step.id }) : undefined}
                          >
                            <span>Ch. {project.chapters.find((chapter) => chapter.input.id === event?.sourceChapterId)?.input.order || "?"}</span>
                            <strong>{event?.title || eventId}</strong>
                            <small>{step ? step.provenance : index === activeSimulationRun.currentStepIndex ? "next checkpoint" : "pending"}</small>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                  <div className="replayWorkspace">
                    <section className="replayWorldState" data-testid="replay-world-state">
                      <div className="panelHeaderLine"><h3>Actor state</h3><small>{activeSimulationRun.currentSnapshot.actorStates.length} actors</small></div>
                      <div className="replayActorGrid">
                        {activeSimulationRun.currentSnapshot.actorStates.map((actor) => (
                          <article key={actor.actorEntityId}>
                            <span>{actor.name.slice(0, 1)}</span>
                            <div>
                              <strong>{actor.name}</strong>
                              <small>{entityById.get(actor.locationEntityId || "")?.name || "Location unknown"}</small>
                            </div>
                            <em>body {actor.bodyCapability} / pressure {actor.relationshipPressure}</em>
                          </article>
                        ))}
                      </div>
                    </section>
                    <section className="replayEventStream" data-testid="replay-event-stream">
                      <div className="panelHeaderLine"><h3>Event stream</h3><small>{activeSimulationRun.status}</small></div>
                      {activeSimulationRun.steps.length === 0 && <p className="evidenceNote">Advance one event to start the evidence-guided reconstruction.</p>}
                      {activeSimulationRun.steps.slice().reverse().map((step) => (
                        <button key={step.id} type="button" className={`${step.provenance} ${selectedSimulationStep?.id === step.id ? "selected" : ""}`} onClick={() => selectWorldItem({ type: "simulation-step", id: step.id })}>
                          <span>Step {step.index} / {step.provenance}</span>
                          <strong>{step.title}</strong>
                          <small>{step.summary}</small>
                        </button>
                      ))}
                    </section>
                  </div>
                  {(activeSimulationRun.comparison.missingPrerequisites.length > 0 || activeSimulationRun.comparison.divergenceReasons.length > 0) && (
                    <div className="replayWarningStrip">
                      {[...activeSimulationRun.comparison.missingPrerequisites, ...activeSimulationRun.comparison.divergenceReasons].map((warning) => <span key={warning}>{warning}</span>)}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
          {worldView === "ask" && (
            <section className="askBookView" data-testid="ask-view">
              <div className="askQuestionPanel">
                <div>
                  <span className="eyebrow">Ask the Book</span>
                  <h3>Evidence-constrained in-book Q&A</h3>
                </div>
                <div className="askQuestionBar">
                  <textarea
                    data-testid="ask-question-input"
                    value={askQuestion}
                    onChange={(event) => setAskQuestion(event.target.value)}
                    placeholder="Ask about a character, event, theme, causal chain, or evidence location in analyzed chapters."
                  />
                  <div className="askControls">
                    <label>Through chapter
                      <select data-testid="ask-through-chapter" value={askThroughChapterId} onChange={(event) => setAskThroughChapterId(event.target.value)}>
                        <option value="all">All analyzed</option>
                        {project.chapters.map((chapter) => <option key={chapter.input.id} value={chapter.input.id}>Ch. {chapter.input.order} {chapter.input.title}</option>)}
                      </select>
                    </label>
                    <button data-testid="ask-book-submit" type="button" className="primaryButton compact" onClick={() => void askBook()} disabled={askBusy}>
                      {askBusy ? <Loader2 className="spin" size={14} /> : <Search size={14} />} Ask
                    </button>
                  </div>
                </div>
                <p className="evidenceNote">{askStatus}</p>
              </div>
              {currentAsk ? (
                <div className="askResultGrid">
                  <article className={`askAnswerPanel ${currentAsk.answer.status}`} data-testid="ask-answer-panel">
                    <span className="eyebrow">{currentAsk.queryPlan.kind} / {currentAsk.answer.status}</span>
                    <h3>{currentAsk.question}</h3>
                    <p>{currentAsk.answer.answer}</p>
                    {currentAsk.answer.summaryBullets.length > 0 && (
                      <ul>
                        {currentAsk.answer.summaryBullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                      </ul>
                    )}
                    {currentAsk.answer.warnings.length > 0 && <small>{currentAsk.answer.warnings.join(" / ")}</small>}
                  </article>
                  <section className="askEvidencePanel" data-testid="ask-evidence-list">
                    <div className="panelHeaderLine">
                      <h3>Evidence hits</h3>
                      <small>{currentAsk.evidenceHits.length}</small>
                    </div>
                    {currentAsk.evidenceHits.length === 0 && <p className="evidenceNote">No paragraph-backed evidence found in analyzed chapters.</p>}
                    {currentAsk.evidenceHits.map((hit) => (
                      <button
                        key={hit.id}
                        type="button"
                        data-testid={`ask-evidence-${hit.id}`}
                        className={selected.type === "ask-evidence" && selected.id === hit.id ? "selected" : ""}
                        onClick={() => selectWorldItem({ type: "ask-evidence", id: hit.id })}
                      >
                        <strong>{hit.label}</strong>
                        <span>{chapterTitle(hit.chapterId)} / {hit.paragraphId} / {hit.sourceType}</span>
                        <p>{hit.quote}</p>
                        <small>{hit.summary} / confidence {Math.round(hit.confidence * 100)}%</small>
                      </button>
                    ))}
                  </section>
                  <section className="askRelatedPanel" data-testid="ask-related-objects">
                    <div className="panelHeaderLine">
                      <h3>Related objects</h3>
                      <small>{currentAsk.answer.relatedObjectIds.length}</small>
                    </div>
                    {currentAsk.answer.relatedObjectIds.length === 0 && <p className="evidenceNote">No related graph object was cited.</p>}
                    {currentAsk.answer.relatedObjectIds.map((id) => (
                      <button key={id} type="button" onClick={() => selectAskRelatedObject(id)}>
                        <strong>{entityById.get(id)?.name || graph.events.find((event) => event.id === id)?.title || themeArcs.flatMap((arc) => arc.signals).find((signal) => signal.id === id)?.summary || id}</strong>
                        <span>{id}</span>
                      </button>
                    ))}
                  </section>
                </div>
              ) : (
                <div className="arcEmpty">Ask questions after importing and analyzing chapters. Future prediction and outside-book questions are refused.</div>
              )}
            </section>
          )}
          {worldView === "causality" && (
            <div className="causalityView" data-testid="causality-view">
              {!displayedCausalChains.length && <div className="arcEmpty">Analyze chapters to build evidence-backed causal chains.</div>}
              {displayedCausalChains.map((chain) => {
                const chainClaims = chain.claimIds.map((id) => causalityReport.claims.find((claim) => claim.id === id)).filter((claim): claim is NovelCausalClaim => Boolean(claim));
                const chainEdges = chain.edgeIds.map((id) => causalityReport.edges.find((edge) => edge.id === id)).filter((edge): edge is NovelCausalEdge => Boolean(edge));
                return (
                  <section className="causalChainLane" key={chain.id}>
                    <header>
                      <div>
                        <strong>{chain.title}</strong>
                        <small>{chain.claimIds.length} claims / {chain.contestedClaimIds.length} contested / score {chain.score}</small>
                      </div>
                      <span>{chain.evidenceGapChapterIds.length ? `${chain.evidenceGapChapterIds.length} evidence gaps` : "Evidence linked"}</span>
                    </header>
                    <div className="causalChapterTrack" style={{ gridTemplateColumns: `repeat(${Math.max(project.chapters.length, 1)}, minmax(170px, 1fr))` }}>
                      {project.chapters.map((chapter) => {
                        const claims = chainClaims.filter((claim) => claim.chapterIds.includes(chapter.input.id));
                        const edgesForChapter = chainEdges.filter((edge) => edge.chapterIds.includes(chapter.input.id));
                        if (!claims.length) {
                          const gap = chain.evidenceGapChapterIds.includes(chapter.input.id);
                          return (
                            <button
                              key={chapter.input.id}
                              type="button"
                              className={`arcGap causalGap ${gap ? "missing" : ""}`}
                              onClick={() => gap ? selectWorldItem({ type: "causal-gap", id: `Chain "${chain.title}" has no evidenced causal claim in ${chapter.input.title}.` }) : undefined}
                            >
                              <small>Ch. {chapter.input.order}</small>
                              <span>{gap ? "Evidence gap" : "No causal claim"}</span>
                            </button>
                          );
                        }
                        return (
                          <article key={chapter.input.id} className="causalClaimStack">
                            <small>Ch. {chapter.input.order}</small>
                            {claims.slice(0, 3).map((claim) => (
                              <button
                                key={claim.id}
                                type="button"
                                data-testid={`causal-claim-${claim.id}`}
                                className={`causalClaimNode ${selected.type === "causal-claim" && selected.id === claim.id ? "selected" : ""} ${claim.contestedInterpretations.length ? "contested" : ""}`}
                                onClick={() => selectWorldItem({ type: "causal-claim", id: claim.id })}
                              >
                                <span>{claim.cause.label}</span>
                                <strong>{claim.effect.label}</strong>
                                <em>{claim.evidence.length} evidence / {Math.round(claim.confidence * 100)}%</em>
                              </button>
                            ))}
                            {edgesForChapter[0] && (
                              <button
                                type="button"
                                data-testid={`causal-edge-${edgesForChapter[0].id}`}
                                className={`causalEdgeButton ${selected.type === "causal-edge" && selected.id === edgesForChapter[0].id ? "selected" : ""}`}
                                onClick={() => selectWorldItem({ type: "causal-edge", id: edgesForChapter[0].id })}
                              >
                                {edgesForChapter[0].relation} edge
                              </button>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
              {causalityReport.warnings[0] && <p className="evidenceNote">{causalityReport.warnings[0]}</p>}
              {!causalityValidation.valid && <p className="evidenceNote">Causality validation: {causalityValidation.errors[0]}</p>}
            </div>
          )}
          {worldView === "theme" && (
            <div className="themePressureView" data-testid="theme-pressure-view">
              {!displayedThemeArcs.length && <div className="arcEmpty">Analyze chapters to build evidence-backed theme pressure tracks.</div>}
              {displayedThemeArcs.map((arc) => (
                <section className="characterArcLane themeArcLane" key={arc.themeId}>
                  <header>
                    <div><strong>{arc.themeName}</strong><small>{arc.category} / {arc.signals.length} signals / {arc.contestedSignalIds.length} contested</small></div>
                    <span>{arc.evidenceGapChapterIds.length ? `${arc.evidenceGapChapterIds.length} evidence gaps` : "Evidence complete"}</span>
                  </header>
                  <div className="arcChapterTrack themeChapterTrack" style={{ gridTemplateColumns: `repeat(${Math.max(project.chapters.length, 1)}, minmax(150px, 1fr))` }}>
                    {project.chapters.map((chapter) => {
                      const signal = arc.signals.find((item) => item.chapterId === chapter.input.id);
                      if (!signal) {
                        return (
                          <div key={chapter.input.id} className={`arcGap ${arc.evidenceGapChapterIds.includes(chapter.input.id) ? "missing" : ""}`}>
                            <small>Ch. {chapter.input.order}</small>
                            <span>{arc.evidenceGapChapterIds.includes(chapter.input.id) ? "Evidence gap" : "No signal"}</span>
                          </div>
                        );
                      }
                      const relatedCount = signal.relatedCharacterIds.length + signal.relatedEventIds.length + signal.relatedFactionIds.length;
                      return (
                        <button
                          key={signal.id}
                          type="button"
                          data-testid={`theme-signal-${signal.id}`}
                          className={`arcStateNode themeSignalNode ${selected.type === "theme-signal" && selected.id === signal.id ? "selected" : ""} ${signal.direction === "contested" ? "contested" : ""}`}
                          onClick={() => selectWorldItem({ type: "theme-signal", id: signal.id })}
                        >
                          <span>Ch. {chapter.input.order} / {signal.direction}</span>
                          <strong>{signal.summary}</strong>
                          <small>Intensity {signal.intensity} / {relatedCount} linked objects</small>
                          <em>{signal.evidence.length} evidence / {Math.round((1 - signal.uncertainty) * 100)}% confidence</em>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
          {worldView === "arc" && (
            <div className="characterArcView" data-testid="character-arc-view">
              {!displayedCharacterArcs.length && <div className="arcEmpty">Analyze chapters to build evidence-backed character tracks.</div>}
              {displayedCharacterArcs.map((arc) => (
                <section className="characterArcLane" key={arc.characterEntityId}>
                  <header>
                    <div><strong>{arc.characterName}</strong><small>{arc.points.length} states / {arc.turningPoints.length} turning points</small></div>
                    <span>{arc.evidenceGapChapterIds.length ? `${arc.evidenceGapChapterIds.length} evidence gaps` : "Evidence complete"}</span>
                  </header>
                  <div className="arcChapterTrack" style={{ gridTemplateColumns: `repeat(${Math.max(project.chapters.length, 1)}, minmax(142px, 1fr))` }}>
                    {project.chapters.map((chapter) => {
                      const point = arc.points.find((item) => item.chapterId === chapter.input.id);
                      const characterAppears = chapter.graph?.entities.some((entity) => entity.kind === "character" && entity.name === arc.characterName);
                      if (!point) {
                        return (
                          <div key={chapter.input.id} className={`arcGap ${characterAppears ? "missing" : ""}`}>
                            <small>Ch. {chapter.input.order}</small>
                            <span>{characterAppears ? "Evidence gap" : "No appearance"}</span>
                          </div>
                        );
                      }
                      const turning = arc.turningPoints.some((item) => item.chapterId === point.chapterId);
                      const changed = Object.values(point.dimensions).filter((dimension) => dimension.direction !== "unknown" && dimension.direction !== "stable");
                      return (
                        <button
                          key={point.id}
                          type="button"
                          data-testid={`character-state-${point.id}`}
                          className={`arcStateNode ${selected.type === "character-state" && selected.id === point.id ? "selected" : ""} ${turning ? "turning" : ""}`}
                          onClick={() => selectWorldItem({ type: "character-state", id: point.id })}
                        >
                          <span>Ch. {chapter.input.order}{turning ? " / Turning" : ""}</span>
                          <strong>{point.summary}</strong>
                          <small>{changed.length ? changed.map((dimension) => dimension.summary).slice(0, 2).join(" / ") : "No supported directional change"}</small>
                          <em>{point.evidence.length} evidence / {Math.round((1 - point.uncertainty) * 100)}% confidence</em>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
          {worldView === "map" && (
            <div className="mapWorkspace">
              <div className="worldMapCanvas responsiveWorldMap" data-testid="novel-world-canvas">
                {graph.entities.map((entity) => (
                  <button key={entity.id} type="button" className={`worldNode node-${entity.kind} ${selected.type === "entity" && selected.id === entity.id ? "selected" : ""}`} onClick={() => selectWorldItem({ type: "entity", id: entity.id })}>
                    <span>{entityIcon(entity.kind)}</span><strong>{entity.name}</strong><small>{entity.role}</small>
                  </button>
                ))}
              </div>
              <div className="mapRelationshipStrip" data-testid="novel-relationship-list">
                {graph.relationships.map((relationship) => (
                  <button key={relationship.id} type="button" className={selected.type === "relationship" && selected.id === relationship.id ? "selected" : ""} onClick={() => selectWorldItem({ type: "relationship", id: relationship.id })}>
                    <strong>{entityById.get(relationship.fromEntityId)?.name} / {entityById.get(relationship.toEntityId)?.name}</strong>
                    <span>{relationship.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {worldView === "events" && (
            <section className="worldTimeline eventMainView" data-testid="novel-event-timeline">
              {visibleEvents.map((event) => (
                <button key={event.id} type="button" className={selected.type === "event" && selected.id === event.id ? "selected" : ""} onClick={() => selectWorldItem({ type: "event", id: event.id })}>
                  <time>{event.timeLabel}</time><strong>{event.title}</strong><span>{chapterTitle(event.sourceChapterId)} / {event.summary}</span>
                </button>
              ))}
            </section>
          )}
        </div>
      </section>

      <aside className="worldGraphInspector" data-testid="novel-world-inspector">
        <nav className="inspectorModeTabs" data-testid="world-inspector-tabs">
          <button type="button" className={inspectorTab === "inspector" ? "active" : ""} onClick={() => setInspectorTab("inspector")}>Inspector</button>
          <button type="button" className={inspectorTab === "simulation" ? "active" : ""} onClick={() => setInspectorTab("simulation")}>Simulation</button>
          <button type="button" className={inspectorTab === "writer" ? "active" : ""} onClick={() => setInspectorTab("writer")}>Writer</button>
          <button type="button" className={inspectorTab === "correction" ? "active" : ""} onClick={() => setInspectorTab("correction")}>Correction</button>
        </nav>

        {inspectorTab === "inspector" && (
          <div className="inspectorTabContent">
            <section className="actionPanel">
              <h2><Database size={16} /> Inspector</h2>
              {selectedAskEvidence && (
                <article className="worldInspectCard" data-testid="ask-evidence-inspector">
                  <span className="eyebrow">{selectedAskEvidence.sourceType} / confidence {Math.round(selectedAskEvidence.confidence * 100)}%</span>
                  <h3>{selectedAskEvidence.label}</h3>
                  <p>{selectedAskEvidence.summary}</p>
                  <div className="themeSignalMeta">
                    <span>Chapter: {chapterTitle(selectedAskEvidence.chapterId)}</span>
                    <span>Paragraph: {selectedAskEvidence.paragraphId}</span>
                    <span>Source object: {selectedAskEvidence.sourceId}</span>
                  </div>
                  <div className="evidenceSnippetList">
                    <strong>Ask evidence</strong>
                    <article>
                      <strong>{chapterTitle(selectedAskEvidence.chapterId)} / {selectedAskEvidence.paragraphId}</strong>
                      <p>{selectedAskEvidence.quote}</p>
                      <small>{selectedAskEvidence.summary}</small>
                    </article>
                  </div>
                  {selectedAskEvidence.relatedObjectIds.length > 0 && (
                    <div className="askRelatedInline">
                      {selectedAskEvidence.relatedObjectIds.map((id) => <button key={id} type="button" onClick={() => selectAskRelatedObject(id)}>{entityById.get(id)?.name || id}</button>)}
                    </div>
                  )}
                </article>
              )}
              {selectedCausalClaim && (
                <article className="worldInspectCard" data-testid="causal-claim-inspector">
                  <span className="eyebrow">{selectedCausalChain?.title || "Causal claim"} / confidence {Math.round(selectedCausalClaim.confidence * 100)}%</span>
                  <h3>{selectedCausalClaim.cause.label} {"->"} {selectedCausalClaim.effect.label}</h3>
                  <p>{selectedCausalClaim.summary}</p>
                  <div className="themeSignalMeta">
                    <span>Cause: {selectedCausalClaim.cause.kind} / {selectedCausalClaim.cause.label}</span>
                    <span>Effect: {selectedCausalClaim.effect.kind} / {selectedCausalClaim.effect.label}</span>
                    <span>Chapters: {selectedCausalClaim.chapterIds.map((id) => chapterTitle(id)).join(" / ") || "n/a"}</span>
                  </div>
                  {selectedCausalClaim.contestedInterpretations.length > 0 && (
                    <div className="themeContestList">
                      <strong>Competing causal explanations</strong>
                      {selectedCausalClaim.contestedInterpretations.map((item) => <span key={item}>{item}</span>)}
                    </div>
                  )}
                  {renderEvidenceList(selectedCausalClaim.evidence, "Causal claim evidence")}
                </article>
              )}
              {selectedCausalEdge && (
                <article className="worldInspectCard" data-testid="causal-edge-inspector">
                  <span className="eyebrow">{selectedCausalEdge.relation}</span>
                  <h3>{selectedCausalEdge.from.label} {"->"} {selectedCausalEdge.to.label}</h3>
                  <p>{causalityReport.claims.find((claim) => claim.id === selectedCausalEdge.claimId)?.summary || "Evidence-backed local causal edge."}</p>
                  <div className="themeSignalMeta">
                    <span>From: {selectedCausalEdge.from.kind}</span>
                    <span>To: {selectedCausalEdge.to.kind}</span>
                    <span>Chapters: {selectedCausalEdge.chapterIds.map((id) => chapterTitle(id)).join(" / ") || "n/a"}</span>
                  </div>
                  {renderEvidenceList(selectedCausalEdge.evidence, "Causal edge evidence")}
                </article>
              )}
              {selectedCausalGap && (
                <article className="worldInspectCard" data-testid="causal-gap-inspector">
                  <span className="eyebrow">Evidence gap</span>
                  <h3>Withheld causal link</h3>
                  <p>{selectedCausalGap}</p>
                  <small>The workbench does not create a causal claim without paragraph evidence.</small>
                </article>
              )}
              {selectedThemeSignal && selectedThemeArc && (
                <article className="worldInspectCard" data-testid="theme-signal-inspector">
                  <span className="eyebrow">{chapterTitle(selectedThemeSignal.chapterId)} / {selectedThemeArc.category} / confidence {Math.round((1 - selectedThemeSignal.uncertainty) * 100)}%</span>
                  <h3>{selectedThemeArc.themeName}</h3>
                  <p>{selectedThemeSignal.summary}</p>
                  <div className="themeSignalMeta">
                    <span>Direction: {selectedThemeSignal.direction}</span>
                    <span>Intensity: {selectedThemeSignal.intensity}</span>
                    <span>Characters: {selectedThemeSignal.relatedCharacterIds.map((id) => entityById.get(id)?.name || id).join(" / ") || "none"}</span>
                    <span>Events: {selectedThemeSignal.relatedEventIds.map((id) => graph.events.find((event) => event.id === id)?.title || id).join(" / ") || "none"}</span>
                    <span>Factions: {selectedThemeSignal.relatedFactionIds.map((id) => entityById.get(id)?.name || id).join(" / ") || "none"}</span>
                  </div>
                  {selectedThemeSignal.competingInterpretations.length > 0 && (
                    <div className="themeContestList">
                      <strong>Competing interpretations</strong>
                      {selectedThemeSignal.competingInterpretations.map((item) => <span key={item}>{item}</span>)}
                    </div>
                  )}
                  {renderEvidenceList(selectedThemeSignal.evidence, "Theme pressure evidence")}
                </article>
              )}
              {selectedCharacterState && selectedCharacterArc && (
                <article className="worldInspectCard" data-testid="character-state-inspector">
                  <span className="eyebrow">{chapterTitle(selectedCharacterState.chapterId)} / confidence {Math.round((1 - selectedCharacterState.uncertainty) * 100)}%</span>
                  <h3>{selectedCharacterArc.characterName}</h3>
                  <p>{selectedCharacterState.summary}</p>
                  <div className="characterDimensionList">
                    {([
                      ["Goal", selectedCharacterState.dimensions.goal],
                      ["Belief", selectedCharacterState.dimensions.belief],
                      ["Relationships", selectedCharacterState.dimensions.relationships],
                      ["Body / capability", selectedCharacterState.dimensions.bodyCapability],
                      ["Social position", selectedCharacterState.dimensions.socialPosition]
                    ] as const).map(([label, dimension]) => (
                      <div key={label}><strong>{label}</strong><span>{dimension.direction} / {dimension.intensity}</span><p>{dimension.summary}</p></div>
                    ))}
                  </div>
                  {renderEvidenceList(selectedCharacterState.evidence, "Character state evidence")}
                </article>
              )}
              {selectedEntity && <article className="worldInspectCard"><span className="eyebrow">{selectedEntity.kind}</span><h3>{selectedEntity.name}</h3><p>{selectedEntity.summary}</p><small>First: {chapterTitle(selectedEntity.firstSeenChapterId)} / Updated: {chapterTitle(selectedEntity.lastUpdatedChapterId)}</small>{renderEvidenceList(selectedEntity.evidence)}</article>}
              {selectedRelationship && <article className="worldInspectCard"><span className="eyebrow">{polarityLabel(selectedRelationship.polarity)} / {selectedRelationship.strength}</span><h3>{entityById.get(selectedRelationship.fromEntityId)?.name} / {entityById.get(selectedRelationship.toEntityId)?.name}</h3><p>{selectedRelationship.label}</p>{renderEvidenceList(selectedRelationship.evidenceSnippets)}</article>}
              {selectedEvent && <article className="worldInspectCard"><span className="eyebrow">{selectedEvent.timeLabel}</span><h3>{selectedEvent.title}</h3><p>{selectedEvent.summary}</p>{renderEvidenceList(selectedEvent.evidence)}</article>}
              {selectedDevelopment && <article className="worldInspectCard"><span className="eyebrow">Tension {selectedDevelopment.tension}</span><h3>{selectedDevelopment.title}</h3><p>{selectedDevelopment.likelyOutcome}</p>{renderEvidenceList(selectedDevelopment.evidence)}</article>}
              {selectedChange && <article className="worldInspectCard"><span className="eyebrow">{selectedChange.kind} / {selectedChange.action}</span><h3>{selectedChange.label}</h3><p>{selectedChange.detail}</p></article>}
            </section>
            <section className="actionPanel"><h2><Clock size={16} /> Changes & Development</h2><div className="developmentList" data-testid="novel-change-list">
              {visibleChanges.slice(-10).reverse().map((change) => <button key={`${change.chapterId}:${change.kind}:${change.id}:${change.action}`} type="button" onClick={() => selectWorldItem({ type: "change", id: change.id })}><strong>{change.label}</strong><span>{change.action} / {change.kind}</span></button>)}
              {graph.development.map((step) => <button key={step.id} type="button" data-testid="novel-development-list" onClick={() => selectWorldItem({ type: "development", id: step.id })}><strong>{step.title}</strong><span>{step.unresolvedQuestion}</span></button>)}
            </div></section>
            {!validation.valid && <section className="actionPanel validationPanel"><h2><AlertTriangle size={16} /> Validation</h2>{validation.errors.map((error) => <p key={error}>{error}</p>)}</section>}
          </div>
        )}

        {inspectorTab === "simulation" && (
          <section className="actionPanel simulationDecisionPanel" data-testid="simulation-decision-panel">
            <div className="panelHeaderLine">
              <h2><Network size={16} /> Decision Inspector</h2>
              <button data-testid="simulation-explain" type="button" className="primaryButton compact" disabled={!selectedSimulationStep || simulationExplainBusy} onClick={() => void explainSimulationStep()}>
                {simulationExplainBusy ? <Loader2 className="spin" size={14} /> : <Bot size={14} />} Explain
              </button>
            </div>
            <p className="evidenceNote">Rules choose actions. AI may explain the result but cannot change state or select the next event.</p>
            {!activeSimulationRun && <button type="button" className="primaryButton" onClick={createSimulationReplay}>Create Grounded Replay</button>}
            {activeSimulationRun && (
              <>
                <article className="worldInspectCard compact simulationRunSummary">
                  <span className="eyebrow">{activeSimulationRun.mode} / {activeSimulationRun.status}</span>
                  <h3>Step {activeSimulationRun.currentStepIndex} of {activeSimulationRun.checkpointEventIds.length}</h3>
                  <p>Fidelity {activeSimulationRun.comparison.fidelityScore}% / {activeSimulationRun.interventions.length ? "counterfactual branch active" : "source checkpoints active"}</p>
                </article>
                {(selectedGameActor || selectedGameLocation) && (
                  <article className="worldInspectCard compact gameSelectionCard" data-testid="game-selection-inspector">
                    <span className="eyebrow">Game Selection</span>
                    {selectedGameActor && (
                      <>
                        <h3>{selectedGameActor.name}</h3>
                        <p>{selectedGameActor.goal}</p>
                        <div className="themeSignalMeta">
                          <span>Location: {entityById.get(selectedGameActor.locationEntityId || "")?.name || "unknown"}</span>
                          <span>Knowledge: {selectedGameActor.knowledgeFactIds.length} fact(s)</span>
                          <span>Body: {selectedGameActor.bodyCapability}</span>
                          <span>Relationship pressure: {selectedGameActor.relationshipPressure}</span>
                          <span>Sprite: {selectedGameSprite?.pressureBand || "unknown"} / {selectedGameSprite?.bodyCapabilityBand || "unknown"}</span>
                          <span>Evidence refs: {selectedGameSprite?.evidenceCount ?? 0}</span>
                        </div>
                        {selectedGameSprite && <p className="evidenceNote">Palette {selectedGameSprite.palette.primary} / {selectedGameSprite.palette.secondary}; deterministic seed {selectedGameSprite.seed}.</p>}
                      </>
                    )}
                    {selectedGameLocation && (
                      <>
                        <h3>{selectedGameLocation.label}</h3>
                        <p>{selectedGameLocation.kind === "fallback" ? "Fallback staging area for scenes without extracted locations." : "Extracted novel location rendered as a Phaser node."}</p>
                        <div className="themeSignalMeta">
                          <span>Tension: {selectedGameLocation.tension}</span>
                          <span>Active: {selectedGameLocation.active ? "yes" : "no"}</span>
                          <span>Coordinates: {Math.round(selectedGameLocation.x)}, {Math.round(selectedGameLocation.y)}</span>
                          <span>Tile: {selectedGameTile?.tensionBand || "unknown"}</span>
                          <span>Events: {selectedGameTile?.eventCount ?? 0}</span>
                          <span>Evidence refs: {selectedGameTile?.evidenceCount ?? 0}</span>
                        </div>
                        {selectedGameTile && <p className="evidenceNote">Tile heat {selectedGameTile.palette.heat}; deterministic seed {selectedGameTile.seed}.</p>}
                      </>
                    )}
                  </article>
                )}
                {selectedSimulationStep && (
                  <article className="worldInspectCard simulationStepInspector" data-testid="simulation-step-inspector">
                    <span className="eyebrow">{selectedSimulationStep.provenance} / {chapterTitle(selectedSimulationStep.chapterId)}</span>
                    <h3>{selectedSimulationStep.title}</h3>
                    <p>{selectedSimulationStep.summary}</p>
                    <div className="themeSignalMeta">
                      <span>Rules: {selectedSimulationStep.triggeredRuleIds.join(" / ") || "none"}</span>
                      <span>Entities: {selectedSimulationStep.relatedEntityIds.map((id) => entityById.get(id)?.name || id).join(" / ")}</span>
                      <span>Themes: {selectedSimulationStep.relatedThemeSignalIds.length}</span>
                      <span>Causal claims: {selectedSimulationStep.relatedCausalClaimIds.length}</span>
                      <span>Visual: {selectedGameEventEffect?.kind || selectedSimulationStep.provenance}</span>
                      <span>Evidence refs: {selectedSimulationStep.evidence.length}</span>
                    </div>
                    <div className="simulationCandidateList" data-testid="simulation-candidates">
                      <strong>Action candidates</strong>
                      {selectedSimulationStep.candidates.map((candidate) => (
                        <article key={candidate.id} className={candidate.id === selectedSimulationStep.selectedCandidateId ? "selected" : candidate.legal ? "" : "blocked"}>
                          <div><strong>{candidate.label}</strong><span>{candidate.action} / score {candidate.score}</span></div>
                          <small>{candidate.legal ? candidate.ruleReasons.join(" / ") : candidate.blockedReasons.join(" / ")}</small>
                          {candidate.scoreBreakdown && <small>score: {Object.entries(candidate.scoreBreakdown).filter(([, value]) => value).map(([key, value]) => `${key} ${value}`).join(" / ")}</small>}
                          {candidate.stateEffects?.length && <small>effects: {candidate.stateEffects.join(" / ")}</small>}
                        </article>
                      ))}
                    </div>
                    {selectedSimulationExplanation && (
                      <div className="simulationExplanation" data-testid="simulation-explanation">
                        <strong>Decision explanation</strong>
                        <p>{selectedSimulationExplanation.explanation}</p>
                        <small>Uncertainty {Math.round(selectedSimulationExplanation.uncertainty * 100)}% / {selectedSimulationExplanation.evidenceIds.length} evidence refs</small>
                      </div>
                    )}
                    {renderEvidenceList(selectedSimulationStep.evidence, "Replay evidence")}
                  </article>
                )}
                <section className="simulationInterventionEditor" data-testid="simulation-intervention-editor">
                  <div className="panelHeaderLine"><h3>Short Branch</h3><small>One condition / one scene</small></div>
                  <label>Actor
                    <select data-testid="simulation-intervention-actor" value={simulationInterventionActorId} onChange={(event) => setSimulationInterventionActorId(event.target.value)}>
                      <option value="">Select actor</option>
                      {activeSimulationRun.currentSnapshot.actorStates.map((actor) => <option key={actor.actorEntityId} value={actor.actorEntityId}>{actor.name}</option>)}
                    </select>
                  </label>
                  <label>Condition
                    <select data-testid="simulation-intervention-kind" value={simulationInterventionKind} onChange={(event) => setSimulationInterventionKind(event.target.value as NovelSimulationInterventionKind)}>
                      <option value="knowledge">Known information</option>
                      <option value="location">Location</option>
                      <option value="relationship-pressure">Relationship pressure</option>
                      <option value="resource">Resource</option>
                      <option value="body-capability">Body capability</option>
                    </select>
                  </label>
                  <label>Value
                    {simulationInterventionKind === "location" ? (
                      <select data-testid="simulation-intervention-value" value={simulationInterventionValue} onChange={(event) => setSimulationInterventionValue(event.target.value)}>
                        <option value="">Select location</option>
                        {graph.entities.filter((entity) => entity.kind === "location").map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
                      </select>
                    ) : simulationInterventionKind === "knowledge" ? (
                      <select data-testid="simulation-intervention-value" value={simulationInterventionValue} onChange={(event) => setSimulationInterventionValue(event.target.value)}>
                        <option value="false">Remove current knowledge</option>
                        <option value="true">Keep current knowledge</option>
                      </select>
                    ) : (
                      <input data-testid="simulation-intervention-value" value={simulationInterventionValue} onChange={(event) => setSimulationInterventionValue(event.target.value)} />
                    )}
                  </label>
                  <button data-testid="apply-simulation-intervention" type="button" onClick={applySimulationIntervention} disabled={Boolean(activeSimulationRun.parentRunId && activeSimulationRun.interventions.length)}>Create branch</button>
                  {activeSimulationRun.interventions[0] && <p className="evidenceNote">{activeSimulationRun.interventions[0].summary}</p>}
                </section>
              </>
            )}
          </section>
        )}

        {inspectorTab === "writer" && (
          <section className="actionPanel writerPanel" data-testid="novel-writer-panel">
            <div className="panelHeaderLine"><h2><FileSearch size={16} /> Writer</h2><button data-testid="generate-blueprint" className="primaryButton compact" type="button" onClick={() => void generateBlueprint()} disabled={blueprintBusy}>{blueprintBusy ? <Loader2 className="spin" size={14} /> : <BookOpen size={14} />} Blueprint</button></div>
            <div className="writerControls">
              <label>Target<select data-testid="blueprint-target-mode" value={blueprintTargetMode} onChange={(event) => setBlueprintTargetMode(event.target.value as "latest" | "selected")}><option value="latest">After latest analyzed</option><option value="selected">After selected chapter</option></select></label>
              <label>Word count<input data-testid="blueprint-word-count" value={blueprintOptions.wordCountRange} onChange={(event) => setBlueprintOptions((current) => ({ ...current, wordCountRange: event.target.value }))} /></label>
              <label>Perspective<input data-testid="blueprint-perspective" value={blueprintOptions.narrativePerspective} onChange={(event) => setBlueprintOptions((current) => ({ ...current, narrativePerspective: event.target.value }))} /></label>
              <label>Pacing<select data-testid="blueprint-pacing" value={blueprintOptions.pacing} onChange={(event) => setBlueprintOptions((current) => ({ ...current, pacing: event.target.value as NovelBlueprintOptions["pacing"] }))}><option value="quiet">Quiet</option><option value="balanced">Balanced</option><option value="high-tension">High tension</option></select></label>
            </div>
            <div className="writerStatus" data-testid="blueprint-status">{blueprintStatus}</div>
            {blueprint && <div className="blueprintResult" data-testid="blueprint-result">
              <article className="worldInspectCard compact"><h3>{blueprint.targetChapterTitle}</h3><p>{blueprint.chapterGoal}</p></article>
              <div className="blueprintColumn" data-testid="blueprint-scene-beats"><strong>Scene beats</strong>{blueprint.sceneBeats.map((beat) => <button key={beat.id} type="button" onClick={() => setWriterSelection({ type: "beat", id: beat.id })}><span>{beat.order}. {beat.title}</span><small>{beat.purpose}</small></button>)}</div>
              <div className="blueprintColumn" data-testid="blueprint-payoff-list"><strong>Payoffs</strong>{blueprint.foreshadowingPayoffs.map((payoff) => <button key={payoff.id} type="button" onClick={() => setWriterSelection({ type: "payoff", id: payoff.id })}><span>{payoff.setup}</span><small>{payoff.urgency}</small></button>)}</div>
              <div className="blueprintColumn" data-testid="blueprint-risk-list"><strong>Risks</strong>{blueprint.writingRisks.map((risk) => <button key={risk.id} type="button" onClick={() => setWriterSelection({ type: "risk", id: risk.id })}><span>{risk.message}</span><small>{risk.mitigation}</small></button>)}</div>
              <article className="worldInspectCard compact" data-testid="blueprint-detail">{selectedBeat && <><h3>{selectedBeat.title}</h3><p>{selectedBeat.outcome}</p>{renderEvidenceList(selectedBeat.evidence, "Blueprint evidence")}</>}{selectedPayoff && <><h3>{selectedPayoff.setup}</h3><p>{selectedPayoff.payoff}</p>{renderEvidenceList(selectedPayoff.evidence, "Blueprint evidence")}</>}{selectedRisk && <><h3>{selectedRisk.message}</h3><p>{selectedRisk.mitigation}</p>{renderEvidenceList(selectedRisk.evidence, "Blueprint evidence")}</>}</article>
              <div className="authoringActions"><button type="button" onClick={() => void copyBlueprint()}>Copy</button><button type="button" onClick={exportBlueprint}>Export</button></div>
              <textarea data-testid="blueprint-export" value={blueprintExportText} onChange={(event) => setBlueprintExportText(event.target.value)} />
            </div>}
          </section>
        )}

        {inspectorTab === "correction" && (
          <section className="actionPanel correctionInspectorPanel" data-testid="correction-inspector">
            <div className="panelHeaderLine">
              <h2><ShieldCheck size={16} /> Correction</h2>
              <small>{auditReport.score}% trust</small>
            </div>
            <p className="evidenceNote">Corrections are a local overlay. Original extracted chapters, evidence indexes, and merged graph stay unchanged.</p>
            {selectedQualityIssue && (
              <article className={`worldInspectCard compact auditIssueDetail ${selectedQualityIssue.severity}`} data-testid="quality-issue-inspector">
                <span className="eyebrow">{selectedQualityIssue.severity} / {selectedQualityIssue.category}</span>
                <h3>{selectedQualityIssue.title}</h3>
                <p>{selectedQualityIssue.detail}</p>
                <div className="themeSignalMeta">
                  <span>Target: {correctionTargetLabel(selectedQualityIssue.target)}</span>
                  <span>Issue id: {selectedQualityIssue.id}</span>
                </div>
              </article>
            )}
            {selectedCorrectionPatch ? (
              <article className="worldInspectCard compact correctionPatchDetail" data-testid="correction-patch-inspector">
                <span className="eyebrow">{selectedCorrectionPatch.status} / {selectedCorrectionPatch.operation.type}</span>
                <h3>{correctionTargetLabel(selectedCorrectionPatch.target)}</h3>
                <p>{selectedCorrectionPatch.reason}</p>
                <div className="themeSignalMeta">
                  <span>Patch: {selectedCorrectionPatch.id}</span>
                  <span>Operation: {selectedCorrectionPatch.operation.type}</span>
                  <span>Target id: {selectedCorrectionPatch.target.id}</span>
                  <span>Audit trail: {selectedCorrectionPatch.auditTrail.length}</span>
                </div>
                <pre className="compactJson">{JSON.stringify(selectedCorrectionPatch.operation, null, 2)}</pre>
                {selectedCorrectionPatch.operation.type === "replace-evidence" && renderEvidenceList(selectedCorrectionPatch.operation.evidence, "Replacement evidence")}
                {selectedCorrectionPatch.operation.type === "add-evidence" && renderEvidenceList(selectedCorrectionPatch.operation.evidence, "Added evidence")}
                <div className="authoringActions">
                  {selectedCorrectionPatch.status === "suggested" && (
                    <>
                      <button data-testid="correction-apply-selected" type="button" onClick={() => applySuggestedCorrection(selectedCorrectionPatch)}>Apply</button>
                      <button type="button" onClick={() => dismissSuggestedCorrection(selectedCorrectionPatch)}>Dismiss</button>
                    </>
                  )}
                  {selectedCorrectionPatch.status === "applied" && <button data-testid="correction-revert-selected" type="button" onClick={() => revertCorrection(selectedCorrectionPatch.id)}>Revert</button>}
                  {selectedCorrectionPatch.status === "reverted" && <span>Reverted. Corrected view no longer uses this patch.</span>}
                  {selectedCorrectionPatch.status === "dismissed" && <span>Dismissed. It remains out of the corrected view.</span>}
                </div>
              </article>
            ) : (
              <article className="worldInspectCard compact">
                <span className="eyebrow">No patch selected</span>
                <h3>Audit queue ready</h3>
                <p>Select an issue, suggested fix, or applied correction to inspect the overlay impact.</p>
              </article>
            )}
            <section className="correctionScopeList">
              <div className="panelHeaderLine"><h3>Overlay Scope</h3><small>{appliedCorrections.length} active</small></div>
              {!appliedCorrections.length && <p className="evidenceNote">Original graph mode. Corrections remain local until a patch is applied.</p>}
              {appliedCorrections.slice(0, 8).map((patch) => (
                <button key={patch.id} type="button" className={selectedCorrectionPatch?.id === patch.id ? "selected" : ""} onClick={() => selectWorldItem({ type: "correction", id: patch.id })}>
                  <strong>{patch.operation.type}</strong>
                  <span>{correctionTargetLabel(patch.target)}</span>
                </button>
              ))}
            </section>
          </section>
        )}
      </aside>
    </main>
  );
}
export default function Home() {
  const initialized = useRef(false);
  const [world, setWorld] = useState<WorldState | null>(null);
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [activeCase, setActiveCase] = useState<CaseFromLog | null>(null);
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [sessions, setSessions] = useState<PlayerSession[]>([]);
  const [snapshot, setSnapshot] = useState<WorldMapSnapshot | null>(null);
  const [worldIdInput, setWorldIdInput] = useState("");
  const [seedInput, setSeedInput] = useState("showcase-seed");
  const [caseMode, setCaseMode] = useState<CaseMode>("premium");
  const [caseTemplateId, setCaseTemplateId] = useState<CaseTemplateId>("archive-blunt");
  const [caseArchetype, setCaseArchetype] = useState<MurderArchetype | "auto">("auto");
  const [mode, setMode] = useState<WorldMode>("showcase");
  const [playerName, setPlayerName] = useState("\u8c03\u67e5\u5458");
  const [timeValue, setTimeValue] = useState(21 * 60 + 30);
  const [selectedSceneId, setSelectedSceneId] = useState("");
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState("");
  const [highlightedEventId, setHighlightedEventId] = useState("");
  const [question, setQuestion] = useState("\u6848\u53d1\u7a97\u53e3\u4f60\u5728\u54ea\u91cc\uff1f\u4f60\u8bb0\u5f97\u54ea\u4e9b\u5f02\u5e38\uff1f");
  const [theory, setTheory] = useState<PlayerTheory>({ culpritId: "", motive: "", method: "", evidenceIds: [] });
  const [status, setStatus] = useState("\u5df2\u8f7d\u5165 8 NPC / 24h Detective Town\u3002\u5148\u89c2\u5bdf\u65f6\u95f4\u7ebf\uff0c\u518d\u641c\u7d22\u5730\u70b9\u548c\u8be2\u95ee NPC\u3002");
  const [revealText, setRevealText] = useState("");
  const [lastAiSafety, setLastAiSafety] = useState<AiSafetyState | null>(null);
  const [latestLiveEval, setLatestLiveEval] = useState<DeepSeekLiveEvalReport | null>(null);
  const [deductionGraph, setDeductionGraph] = useState<DeductionGraph | null>(null);
  const [suspectBoard, setSuspectBoard] = useState<SuspectBoardRow[]>([]);
  const [logicReport, setLogicReport] = useState<CaseLogicReport | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [developerOpen, setDeveloperOpen] = useState(false);
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>("server");
  const [progress, setProgress] = useState<InvestigationProgress>(initialProgress);
  const [serverPlaythroughSummary, setServerPlaythroughSummary] = useState<CaseAutoSolveSummary | null>(null);
  const [guidedManualLastResult, setGuidedManualLastResult] = useState("ready");
  const [guidedManualRunning, setGuidedManualRunning] = useState(false);
  const [guidedStepJournal, setGuidedStepJournal] = useState<GuidedStepJournalEntry[]>([]);
  const [worldLead, setWorldLead] = useState<WorldLeadPublicSummary | null>(null);
  const [worldLeadOutcome, setWorldLeadOutcome] = useState<WorldLeadOutcomePublicSummary | null>(null);
  const [worldLeadCaseHandoff, setWorldLeadCaseHandoff] = useState<WorldLeadCaseHandoffPublicSummary | null>(null);
  const [worldArc, setWorldArc] = useState<WorldArcPublicSummary | null>(null);
  const [worldArcDirective, setWorldArcDirective] = useState<WorldArcDirectivePublicSummary | null>(null);
  const [worldPressureCascade, setWorldPressureCascade] = useState<WorldPressureCascadePublicSummary | null>(null);
  const [worldInfluenceBudget, setWorldInfluenceBudget] = useState<WorldInfluenceBudgetPublicSummary | null>(null);
  const [playerResourceCommitment, setPlayerResourceCommitment] = useState<PlayerResourceCommitmentPublicSummary | null>(null);
  const [factionRelationship, setFactionRelationship] = useState<FactionRelationshipPublicSummary | null>(null);
  const [worldEventOffer, setWorldEventOffer] = useState<WorldEventOfferPublicSummary | null>(null);
  const [investigatorProgression, setInvestigatorProgression] = useState<InvestigatorProgressionPublicSummary | null>(null);
  const [campaignRecovery, setCampaignRecovery] = useState<CampaignRecoveryPublicSummary | null>(null);
  const [arcConvergence, setArcConvergence] = useState<ArcConvergencePublicSummary | null>(null);
  const [campaignSession, setCampaignSession] = useState<CampaignSessionPublicSummary | null>(null);
  const [campaignFinaleDebrief, setCampaignFinaleDebrief] = useState<CampaignFinaleDebriefPublicSummary | null>(null);
  const [townSocialResponse, setTownSocialResponse] = useState<TownSocialResponsePublicSummary | null>(null);
  const [replayGoalAttempt, setReplayGoalAttempt] = useState<ReplayGoalAttemptState | null>(null);
  const guidedStepJournalSeq = useRef(0);
  const { inspectorTab, setInspectorTab, showEvents, showInvestigation, showLogic, showPeople } = useInspectorSelection("investigation");
  const [selectionHighlight, setSelectionHighlight] = useState<SelectionHighlight>({});
  const [selectedGraphNode, setSelectedGraphNode] = useState<DeductionGraphNode | null>(null);
  const [selectedSuspectId, setSelectedSuspectId] = useState("");
  const [proofViewMode, setProofViewMode] = useState<ProofViewMode>("player");
  const [selectedGapType, setSelectedGapType] = useState("");
  const [hoveredLocationId, setHoveredLocationId] = useState("");
  const [toasts, setToasts] = useState<InvestigationToast[]>([]);
  const [appMode, setAppMode] = useState<AppMode>("play");
  const [authoringDraft, setAuthoringDraft] = useState<AuthoringDraft>(() => createPremiumAuthoringDraft());
  const [authoringTab, setAuthoringTab] = useState<AuthoringTab>("case");
  const [contentSelection, setContentSelection] = useState<DetectiveContentAuthoringSelection>(() => selectDefaultDetectiveContentAuthoringSelection(detectiveContentPack));
  const [authoringCharacterId, setAuthoringCharacterId] = useState("");
  const [authoringEvidenceId, setAuthoringEvidenceId] = useState("");
  const [authoringSceneId, setAuthoringSceneId] = useState("");
  const [authoringTimelineId, setAuthoringTimelineId] = useState("");
  const [authoringImportText, setAuthoringImportText] = useState("");
  const [authoringExportText, setAuthoringExportText] = useState("");
  const [authoringStatus, setAuthoringStatus] = useState("Authoring \u4f7f\u7528\u6d4f\u89c8\u5668\u672c\u5730\u72b6\u6001\uff0c\u4e0d\u8bf7\u6c42 DeepSeek\uff0c\u4e0d\u5199\u5165 SQLite\u3002");
  const [caseGalleryEntries, setCaseGalleryEntries] = useState<CaseGalleryEntry[]>([]);
  const [caseGalleryLoaded, setCaseGalleryLoaded] = useState(false);
  const [contentSeedHistory, setContentSeedHistory] = useState<ContentSeedHistoryEntry[]>([]);
  const [contentSeedPreviewed, setContentSeedPreviewed] = useState(false);
  const [townRuntime, setTownRuntime] = useState<PersistentTownRuntime | null>(null);
  const [townQueue, setTownQueue] = useState<TownEmergenceQueue | null>(null);
  const [townBrief, setTownBrief] = useState<TownSituationBrief | null>(null);
  const [selectedAgentCandidates, setSelectedAgentCandidates] = useState<NpcActionCandidate[]>([]);
  const [townRuntimeBusy, setTownRuntimeBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [scenarioPresets, setScenarioPresets] = useState<ScenarioPreset[]>([]);
  const [scenarioPacks, setScenarioPacks] = useState<Array<ScenarioPack & { builtIn?: boolean; source?: string; experimentId?: string; experimentHash?: string; experimentPathHash?: string; validation?: { ok: boolean } }>>([]);
  const [scenarioRuns, setScenarioRuns] = useState<ScenarioRunSummary[]>([]);
  const [runCatalog, setRunCatalog] = useState<RunCatalogEntry[]>([]);
  const [runJobs, setRunJobs] = useState<RunJob[]>([]);
  const [selectedScenarioPackId, setSelectedScenarioPackId] = useState("");
  const [selectedRunCatalogId, setSelectedRunCatalogId] = useState("");
  const [selectedScenarioPresetId, setSelectedScenarioPresetId] = useState("");
  const [scenarioRun, setScenarioRun] = useState<ScenarioRun | null>(null);
  const [scenarioReport, setScenarioReport] = useState<ScenarioReport | null>(null);
  const [townSnapshots, setTownSnapshots] = useState<TownStateSnapshot[]>([]);
  const [selectedSnapshotFromId, setSelectedSnapshotFromId] = useState("");
  const [selectedSnapshotToId, setSelectedSnapshotToId] = useState("");
  const [reviewExportTarget, setReviewExportTarget] = useState<{ fromId: string; toId: string }>({ fromId: "", toId: "" });
  const [snapshotDiff, setSnapshotDiff] = useState<TownStateDiff | null>(null);
  const [benchmarkSummary, setBenchmarkSummary] = useState<BenchmarkSummary | null>(null);
  const [townRuleState, setTownRuleState] = useState<TownRuleSnapshotSummary | null>(null);
  const [townCaseLifecycle, setTownCaseLifecycle] = useState<TownCaseLifecycleState | null>(null);

  function pushToast(toast: Omit<InvestigationToast, "id">) {
    const id = `toast:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [{ id, ...toast }, ...current].slice(0, 4));
  }

  function dismissToast(id: string) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  const deductionCase = activeCase?.deductionCase || null;
  const scenes = deductionCase?.scenes || [];
  const characters = deductionCase?.characters.filter((character) => character.role !== "\u6b7b\u8005") || [];
  const discovered = new Set(session?.discoveredEvidenceIds || []);
  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) || scenes[0];
  const selectedCharacter = characters.find((character) => character.id === selectedCharacterId);
  const allCaseEvidence = deductionCase?.evidence || [];
  const sceneEvidenceRaw = selectedScene ? allCaseEvidence.filter((item) => selectedScene.evidenceIds.includes(item.id)) : [];
  const sceneEvidence = sceneEvidenceRaw.some((item) => item.discoverable && !discovered.has(item.id))
    ? sceneEvidenceRaw
    : [
      ...sceneEvidenceRaw,
      ...allCaseEvidence.filter((item) => item.discoverable && !discovered.has(item.id) && !sceneEvidenceRaw.some((sceneItem) => sceneItem.id === item.id)).slice(0, 1)
    ];
  const discoveredEvidence = deductionCase?.evidence.filter((item) => discovered.has(item.id)) || [];
  const playerTheoryEvidence = useMemo(() => new Set(theory.evidenceIds), [theory.evidenceIds]);
  const selectedTestimony = activeCase?.testimonies?.find((item) => item.characterId === selectedCharacterId);
  const quality = activeCase?.qualityReport;
  const selectedNpcMemories = useMemo(() => (world?.memories || []).filter((memory) => memory.npcId === selectedCharacterId), [world?.memories, selectedCharacterId]);
  const { suggestedAction } = useDetectiveTownRuntimeView({
    progress,
    session,
    selectedSceneName: selectedScene?.name,
    discoveredEvidenceCount: discoveredEvidence.length,
    revealText
  });
  const { evidenceImpacts, judgementGaps } = useInvestigationView({
    deductionCase,
    discoveredEvidence,
    session
  });
  const questionedCharacterIds = useMemo(() => new Set(session?.interrogationLog.map((entry) => entry.characterId) || []), [session?.interrogationLog]);
  const contradictedCharacterIds = useMemo(
    () => new Set(session?.interrogationLog.filter((entry) => entry.challenge?.hit).map((entry) => entry.characterId) || []),
    [session?.interrogationLog]
  );
  const excludedCharacterIds = useMemo(() => new Set(suspectBoard.filter((row) => row.status === "eliminated").map((row) => row.characterId)), [suspectBoard]);
  const selectedNpcContradictionHit = hasContradictionHit(session, selectedCharacterId);
  const investigationStages: InvestigationStage[] = useMemo(() => {
    const interrogationCount = session?.interrogationLog.length || 0;
    const accepted = Boolean(session?.judgement?.accepted);
    const wrongSubmitted = Boolean(session?.judgement && !accepted);
    const completeMap = {
      observe: progress.observedCrimeWindow,
      search: progress.discoveredEvidence && discoveredEvidence.length > 0,
      question: interrogationCount > 0,
      challenge: progress.challengedTestimony,
      organize: discoveredEvidence.length >= 3 || wrongSubmitted || accepted,
      submit: Boolean(session?.judgement),
      reveal: Boolean(revealText)
    };
    const defs = [
      { id: "observe", label: "Observe scene", detail: "Review the crime window and event log." },
      { id: "search", label: "Search evidence", detail: "Click locations or evidence markers." },
      { id: "question", label: "Question witness", detail: "Choose an NPC and ask a focused question." },
      { id: "challenge", label: "Challenge contradiction", detail: "Use discovered evidence to test testimony." },
      { id: "organize", label: "Organize theory", detail: "Pick the key evidence chain." },
      { id: "submit", label: "Submit conclusion", detail: "Name the culprit, motive, and method." },
      { id: "reveal", label: "Review solution", detail: "Inspect the final plot nodes and answer." }
    ];
    const firstPending = defs.find((item) => !completeMap[item.id as keyof typeof completeMap])?.id;
    return defs.map((item) => ({
      ...item,
      complete: completeMap[item.id as keyof typeof completeMap],
      current: item.id === firstPending || (!firstPending && item.id === "reveal")
    }));
  }, [discoveredEvidence.length, progress, revealText, session?.interrogationLog.length, session?.judgement]);
  const onboarding = useGuidedOnboarding({ runtimeMode, progress, session, revealText });
  const visibleEvents = snapshot?.visibleEvents || events.slice(-30).reverse();
  const selectedEvent = events.find((event) => event.id === highlightedEventId);
  const selectedEvidence = deductionCase?.evidence.find((item) => item.id === selectedEvidenceId);
  const evidenceTitleById = useMemo(() => new Map((deductionCase?.evidence || []).map((item) => [item.id, item.title])), [deductionCase?.evidence]);
  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const characterById = useMemo(() => new Map((deductionCase?.characters || []).map((character) => [character.id, character])), [deductionCase?.characters]);
  const hoveredLocationInfo = useMemo(() => {
    const locationId = hoveredLocationId || selectedSceneId;
    const tile = snapshot?.tiles.find((item) => item.locationId === locationId);
    if (!locationId || !tile) return null;
    const recent = visibleEvents.find((event) => event.locationId === locationId);
    return {
      locationId,
      name: tile.locationName || locationId,
      terrain: tile.terrain,
      searchable: Boolean(tile.searchable),
      discovered: tile.discoveredEvidenceCount || 0,
      total: tile.evidenceCount || 0,
      recentEvent: recent ? `${recent.time} ${recent.publicSummary}` : undefined
    };
  }, [hoveredLocationId, selectedSceneId, snapshot?.tiles, visibleEvents]);
  const selectedNpcPopover: NpcPopoverState | null = useMemo(() => {
    if (!selectedCharacter) return null;
    const questioned = questionedCharacterIds.has(selectedCharacter.id);
    const contradiction = contradictedCharacterIds.has(selectedCharacter.id);
    const excluded = excludedCharacterIds.has(selectedCharacter.id);
    return {
      characterId: selectedCharacter.id,
      name: selectedCharacter.name,
      role: selectedCharacter.role,
      statusLabel: contradiction ? "Contradiction found" : excluded ? "Excluded" : questioned ? "Questioned" : "Not questioned",
      questioned,
      contradiction,
      excluded
    };
  }, [contradictedCharacterIds, excludedCharacterIds, questionedCharacterIds, selectedCharacter]);
  const selectedAgent = useMemo(
    () => townRuntime?.agentStates.find((agent) => agent.npcId === selectedCharacterId) || null,
    [selectedCharacterId, townRuntime?.agentStates]
  );
  const graphExplanation: GraphNodeExplanation | null = useMemo(() => {
    if (!selectedGraphNode || !deductionCase) return null;
    const node = selectedGraphNode;
    const discoveredTitles = node.evidenceIds.filter((id) => discovered.has(id)).map((id) => evidenceTitleById.get(id) || id);
    const hiddenCount = node.evidenceIds.filter((id) => !discovered.has(id)).length;
    const sourceEvents = node.eventIds.map((id) => eventById.get(id)).filter((event): event is WorldEvent => Boolean(event));
    const names = node.characterIds.map((id) => characterById.get(id)?.name || id);
    const source = sourceEvents.length
      ? `Source events: ${sourceEvents.map((event) => `${event.time} ${event.publicSummary}`).join(" / ")}`
      : "Source: current case structure and local rule validation.";
    if (hiddenCount > 0 && node.type !== "conclusion") {
      return {
        node,
        title: "Undiscovered deduction node",
        status: "LOCKED / strict no-spoiler",
        body: "This node requires the player to find the matching evidence first. The system will not reveal evidence titles, meanings, or final conclusions early.",
        source,
        references: discoveredTitles,
        spoilerSafe: false
      };
    }
    const typeLabel: Record<string, string> = {
      evidence: "Evidence established",
      event: "World event source",
      testimony: "Testimony contradiction",
      elimination: "Suspect excluded",
      conclusion: "Unique conclusion"
    };
    return {
      node,
      title: node.label,
      status: typeLabel[node.type] || node.type,
      body: node.detail || "This node is supported by discovered evidence and local rule chains.",
      source,
      references: [...discoveredTitles, ...names].slice(0, 6),
      spoilerSafe: true
    };
  }, [characterById, deductionCase, discovered, eventById, evidenceTitleById, selectedGraphNode]);
  const suspectExplanations = useMemo(() => {
    const result = new Map<string, SuspectExplanation>();
    for (const row of suspectBoard) {
      const visibleEvidence = row.exclusionEvidenceIds.filter((id) => discovered.has(id)).map((id) => evidenceTitleById.get(id) || id);
      const lockedEvidenceCount = row.exclusionEvidenceIds.filter((id) => !discovered.has(id)).length;
      const sourceEventLabels = row.sourceEventIds
        .map((id) => eventById.get(id))
        .filter((event): event is WorldEvent => Boolean(event))
        .filter((event) => row.exclusionEvidenceIds.some((evidenceId) => discovered.has(evidenceId)) || session?.judgement?.accepted)
        .map((event) => `${event.time} ${event.publicSummary}`);
      const solved = Boolean(session?.judgement?.accepted);
      const isCulprit = row.status === "culprit";
      const statusLabel = isCulprit ? (solved ? "Final culprit" : "Hidden until solved") : row.status === "red_herring" ? "Strong red herring" : "Excluded candidate";
      const exclusionStatus = isCulprit
        ? (solved ? "Motive, means, opportunity, and key evidence chain remain intact." : "Requires the full evidence chain. The true culprit stays hidden until the case is solved.")
        : visibleEvidence.length
          ? `Excluded by ${visibleEvidence.join(", ")}.`
          : "Still needs exclusion evidence; hidden evidence titles are not leaked.";
      result.set(row.characterId, {
        characterId: row.characterId,
        name: row.name,
        role: row.role,
        statusLabel,
        motive: row.motive,
        means: row.means,
        opportunity: row.opportunity,
        surfaceSuspicion: row.surfaceSuspicion,
        exclusionStatus,
        visibleEvidenceTitles: visibleEvidence,
        lockedEvidenceCount: isCulprit ? 0 : lockedEvidenceCount,
        sourceEventLabels
      });
    }
    return result;
  }, [discovered, eventById, evidenceTitleById, session?.judgement?.accepted, suspectBoard]);
  const gapCards: GapCard[] = useMemo(() => {
    const mapTarget = (label: string): GapCard["target"] => {
      if (/culprit|suspect/i.test(label)) return "suspects";
      if (/motive/i.test(label)) return "motive";
      if (/method|means|opportunity/i.test(label)) return "method";
      if (/evidence/i.test(label)) return "evidence";
      if (/exclude/i.test(label)) return "exclusion";
      return "logic";
    };
    const proofCards = session?.judgement?.proofCoverage?.gaps.map((gap) => ({
      id: `proof-gap:${gap.obligationId}`,
      label: `${gap.kind}: ${gap.label}`,
      detail: gap.detail,
      target: gap.target === "suspects" ? "suspects" : gap.target
    } satisfies GapCard)) || [];
    if (proofCards.length) return proofCards;
    return judgementGaps.map((label) => {
      const target = mapTarget(label);
      const detail: Record<GapCard["target"], string> = {
        suspects: "Review the suspect matrix and confirm who still has motive, means, and opportunity.",
        motive: "Return to the theory form and add a motive supported by discovered evidence.",
        method: "Return to the theory form and describe the tool, action, and disguise.",
        evidence: "Review discovered evidence and pick the key clues that form a chain.",
        exclusion: "Check the Suspect Board and confirm excluded suspects have exclusion evidence.",
        logic: "Open the deduction graph and close the gap from evidence to conclusion."
      };
      return { id: `gap:${label}`, label, detail: detail[target], target };
    });
  }, [judgementGaps, session?.judgement?.proofCoverage?.gaps]);
  const nextStepAdvice = useMemo(() => {
    if (!session?.judgement || session.judgement.accepted) return "";
    if (discoveredEvidence.length > 0 && !progress.challengedTestimony) {
      return `First present "${discoveredEvidence[0].title}" to a relevant NPC and check whether testimony conflicts.`;
    }
    if (discoveredEvidence.length > 0) {
      return `Choose from the ${discoveredEvidence.length} discovered clues and connect motive, method, and opportunity.`;
    }
    return selectedScene ? `Keep searching ${selectedScene.name} and build the first evidence chain.` : "Click a searchable map location and find the first clue.";
  }, [discoveredEvidence, progress.challengedTestimony, selectedScene, session?.judgement]);
  const solutionChain = useMemo(() => {
    if (!session?.judgement?.accepted || !deductionCase) return [];
    const selectedTitles = theory.evidenceIds.filter((id) => discovered.has(id)).map((id) => evidenceTitleById.get(id) || id);
    const eliminatedCount = suspectBoard.filter((row) => row.status !== "culprit").length;
    return [
      selectedTitles.length ? `Player submitted ${selectedTitles.length} discovered clues: ${selectedTitles.slice(0, 4).join(", ")}${selectedTitles.length > 4 ? " etc." : ""}.` : "The submitted evidence chain passed local rule validation.",
      "The evidence supports motive, method, opportunity, or a testimony contradiction and forms a reviewable reasoning chain.",
      `Suspect Board excludes ${eliminatedCount} non-culprit candidates through discovered or validated exclusion chains.`,
      "Only the remaining candidate with intact motive, means, opportunity, and no counter-evidence appears in the final conclusion node."
    ];
  }, [deductionCase, discovered, evidenceTitleById, session?.judgement?.accepted, suspectBoard, theory.evidenceIds]);
  const inspectorSummary = useMemo(() => {
    if (inspectorTab === "events") {
      return selectedEvent
        ? { title: `${selectedEvent.time} / ${selectedEvent.locationId}`, detail: selectedEvent.publicSummary, tone: "event" }
        : { title: "Event log", detail: "Select an event to highlight map location and time.", tone: "event" };
    }
    if (inspectorTab === "investigation") {
      if (selectedEvidence) return { title: `Evidence: ${selectedEvidence.title}`, detail: "Review use hints and present it to NPCs when needed.", tone: "evidence" };
      if (selectedCharacter) return { title: `NPC: ${selectedCharacter.name}`, detail: selectedCharacter.role, tone: "person" };
      return { title: `Location: ${selectedScene?.name || "None selected"}`, detail: "Search locations, question NPCs, and submit theory.", tone: "investigation" };
    }
    if (inspectorTab === "logic") return { title: "Case logic", detail: "Deduction graph, causal chain, and answer review unlock after correct reasoning.", tone: "logic" };
    if (inspectorTab === "agent") return { title: "Persistent Agent Town", detail: selectedAgent ? `${selectedAgent.currentGoal} / ${selectedAgent.locationId}` : "Inspect NPC goals, action scores, and case candidates.", tone: "logic" };
    if (inspectorTab === "people") return { title: "Suspect matrix", detail: "Review motive, means, opportunity, and exclusion evidence.", tone: "people" };
    return { title: "Developer API", detail: "Inspect Agent API, worldId, caseId, and sessionId.", tone: "developer" };
  }, [inspectorTab, selectedAgent, selectedCharacter, selectedEvent, selectedEvidence, selectedScene?.name]);
  const causalTrace = activeCase?.causalTrace;
  const causalTraceEvents = useMemo(
    () => (causalTrace?.orderedEventIds || []).map((id) => events.find((event) => event.id === id)).filter((event): event is WorldEvent => Boolean(event)),
    [causalTrace?.orderedEventIds, events]
  );
  const emergenceProofTrace: EmergenceProofTrace | null = useMemo(() => {
    if (!world || !activeCase) return null;
    return buildEmergenceProofTrace(world, events, activeCase, {
      solved: Boolean(session?.judgement?.accepted),
      discoveredEvidenceIds: session?.discoveredEvidenceIds || []
    });
  }, [activeCase, events, session?.discoveredEvidenceIds, session?.judgement?.accepted, world]);
  const evidenceNotebook: EvidenceNotebookItem[] = useMemo(
    () => (activeCase ? buildEvidenceNotebook(activeCase, events, session) : []),
    [activeCase, events, session]
  );
  const proofTourSteps: ProofTourStep[] = useMemo(
    () => (activeCase ? buildPlayerProofTour(activeCase, events, emergenceProofTrace, session) : []),
    [activeCase, emergenceProofTrace, events, session]
  );
  const playableIntake: PlayableCaseIntake | null = useMemo(
    () => (activeCase && ((activeCase.sourceEventIds || []).length > 0 || Boolean(activeCase.sourceCandidateId) || Boolean(activeCase.triggeredEventId))
      ? buildPlayableCaseIntake(activeCase, events, world, session)
      : null),
    [activeCase, events, session, world]
  );
  const caseTruthLedger = useMemo(
    () => (activeCase ? buildCaseTruthLedger(activeCase, events) : null),
    [activeCase, events]
  );
  const caseProofCoverage = useMemo(
    () => caseTruthLedger ? evaluateCaseProofCoverage(caseTruthLedger, {
      discoveredEvidenceIds: session?.discoveredEvidenceIds || [],
      selectedEvidenceIds: session?.submittedTheory?.evidenceIds,
      challengedCharacterIds: session?.interrogationLog.filter((entry) => entry.challenge?.hit).map((entry) => entry.characterId) || [],
      solved: Boolean(session?.judgement?.accepted)
    }) : null,
    [caseTruthLedger, session]
  );
  const caseRouteCertificate = useMemo(
    () => (activeCase ? certifyPlayableCase(activeCase, events, session) : null),
    [activeCase, events, session]
  );
  const staticPlaythroughProof = useMemo(() => {
    if (runtimeMode !== "static-demo" || !activeCase) return null;
    const autoSolve = autoSolvePlayableCase(activeCase, events, { dryRun: true });
    const acceptedTheory = Boolean(session?.judgement?.accepted);
    const questionedWitnessCount = acceptedTheory
      ? new Set((session?.interrogationLog || []).map((entry) => entry.characterId)).size
      : autoSolve.summary.questionedWitnessCount;
    const challengeHitCount = acceptedTheory
      ? (session?.interrogationLog || []).filter((entry) => entry.challenge?.hit).length
      : autoSolve.summary.challengeHitCount;
    const selectedEvidenceCount = acceptedTheory
      ? session?.submittedTheory?.evidenceIds.length || 0
      : autoSolve.summary.selectedEvidenceCount;
    return {
      title: "Static Playthrough Proof",
      actionLabel: "Run Certified Playthrough",
      acceptedLabel: "completed / accepted theory",
      readyLabel: "ready / certified route",
      blockedLabel: "blocked / inspect route",
      boundaryText: "Browser-local aggregate proof only: no hidden truth, raw bodies, internal ids, source ids, SQLite writes, or public artifact changes.",
      testId: "static-playthrough-proof",
      runTestId: "run-certified-playthrough",
      status: acceptedTheory ? "accepted" as const : autoSolve.passed ? "ready" as const : "blocked" as const,
      routeCertified: Boolean(caseRouteCertificate?.routeCertified || autoSolve.summary.routeCertified),
      autoRoutePassed: autoSolve.passed,
      acceptedTheory: Boolean(acceptedTheory || autoSolve.summary.autoTheoryAccepted),
      searchStepCount: autoSolve.steps.filter((step) => step.kind === "search").length,
      questionedWitnessCount,
      challengeHitCount,
      selectedEvidenceCount,
      coveredRequiredObligations: acceptedTheory
        ? caseProofCoverage?.coveredRequired || autoSolve.summary.coveredRequiredObligations
        : autoSolve.summary.coveredRequiredObligations,
      totalRequiredObligations: acceptedTheory
        ? caseProofCoverage?.totalRequired || autoSolve.summary.totalRequiredObligations
        : autoSolve.summary.totalRequiredObligations,
      blockerCount: autoSolve.failures.length
    };
  }, [activeCase, caseProofCoverage, caseRouteCertificate, events, runtimeMode, session]);
  const serverPlaythroughProof = useMemo(() => {
    if (runtimeMode === "static-demo" || !activeCase || !playableIntake) return null;
    const sourceBackedRoute = Boolean(
      (activeCase.sourceEventIds || []).length > 0
        || activeCase.sourceCandidateId
        || activeCase.sourceMap?.sourceCandidateId
        || activeCase.triggeredEventId
    );
    const acceptedTheory = Boolean(session?.judgement?.accepted);
    const summary = serverPlaythroughSummary?.caseId === activeCase.id ? serverPlaythroughSummary : null;
    const coverage = playableIntake.coach?.coverage;
    const routeCertified = Boolean(caseRouteCertificate?.routeCertified || coverage?.routeCertified || summary?.routeCertified);
    const autoRoutePassed = Boolean(summary?.passed || coverage?.autoSolvePassed);
    const questionedWitnessCount = acceptedTheory
      ? new Set((session?.interrogationLog || []).map((entry) => entry.characterId)).size
      : summary?.questionedWitnessCount ?? coverage?.questionedWitnesses ?? 0;
    const challengeHitCount = acceptedTheory
      ? (session?.interrogationLog || []).filter((entry) => entry.challenge?.hit).length
      : summary?.challengeHitCount ?? coverage?.challengeHitCount ?? 0;
    const selectedEvidenceCount = acceptedTheory
      ? session?.submittedTheory?.evidenceIds.length || 0
      : summary?.selectedEvidenceCount ?? coverage?.selectedTheoryEvidence ?? 0;
    return {
      title: "Server Playthrough Proof",
      actionLabel: "Run Server Certified Playthrough",
      acceptedLabel: "completed / accepted theory",
      readyLabel: "ready / source-backed route",
      blockedLabel: "blocked / inspect emerged route",
      boundaryText: "Server Runtime aggregate proof: persists only an explicit auto-player session; no public catalog, dataset reader, raw bodies, or SQLite schema changes.",
      testId: "server-playthrough-proof",
      runTestId: "run-server-certified-playthrough",
      status: acceptedTheory ? "accepted" as const : autoRoutePassed && routeCertified ? "ready" as const : "blocked" as const,
      routeCertified,
      sourceBackedRoute,
      autoRoutePassed,
      acceptedTheory: Boolean(acceptedTheory || summary?.autoTheoryAccepted),
      searchStepCount: (playableIntake.routeCertificate?.steps || caseRouteCertificate?.steps || []).filter((step) => step.kind === "search").length,
      questionedWitnessCount,
      challengeHitCount,
      selectedEvidenceCount,
      coveredRequiredObligations: acceptedTheory
        ? caseProofCoverage?.coveredRequired || summary?.coveredRequiredObligations || coverage?.coveredRequired || 0
        : summary?.coveredRequiredObligations ?? coverage?.coveredRequired ?? 0,
      totalRequiredObligations: acceptedTheory
        ? caseProofCoverage?.totalRequired || summary?.totalRequiredObligations || coverage?.totalRequired || 0
        : summary?.totalRequiredObligations ?? coverage?.totalRequired ?? 0,
      blockerCount: summary?.failureKinds.length || playableIntake.coach?.blockers.length || 0
    };
  }, [activeCase, caseProofCoverage, caseRouteCertificate, playableIntake, runtimeMode, serverPlaythroughSummary, session]);
  const sourceReviewUnlock = useMemo(() => {
    if (!activeCase) return null;
    const unlocked = Boolean(session?.judgement?.accepted);
    const memoryCount = playableIntake?.sourceCounts.memories
      ?? activeCase.sourceMap?.memorySourceIds?.length
      ?? activeCase.testimonies.reduce((sum, testimony) => sum + (testimony.memoryIds?.length || 0), 0)
      ?? 0;
    return {
      unlocked,
      statusLabel: unlocked ? "unlocked / source-backed audit ready" : "locked / accepted theory required",
      sourceEventCount: playableIntake?.sourceCounts.events ?? activeCase.sourceEventIds.length,
      memoryCount,
      coveredObligations: caseProofCoverage?.coveredRequired || 0,
      totalObligations: caseProofCoverage?.totalRequired || caseRouteCertificate?.totalRequiredObligations || 0,
      routeStepCount: caseRouteCertificate?.routeStepCount || caseRouteCertificate?.steps.length || 0,
      challengeHitCount: (session?.interrogationLog || []).filter((entry) => entry.challenge?.hit).length,
      selectedEvidenceCount: session?.submittedTheory?.evidenceIds.length || 0,
      proofGapCount: caseProofCoverage?.gaps.length || 0
    };
  }, [activeCase, caseProofCoverage, caseRouteCertificate, playableIntake, session]);
  function getGuidedManualTarget(): GuidedManualStepTarget {
    const routeSteps = caseRouteCertificate?.steps || playableIntake?.routeCertificate?.steps || [];
    if (!session) return { kind: "join", label: "Join investigation" };
    const discoveredSet = new Set(session.discoveredEvidenceIds);
    const questionedSet = new Set(session.interrogationLog.map((entry) => entry.characterId));
    const challengedSet = new Set(session.interrogationLog.filter((entry) => entry.challenge?.hit).map((entry) => entry.characterId));
    const selectedSet = new Set(theory.evidenceIds);
    const searchStep = routeSteps.find((step) => step.kind === "search" && step.evidenceIds.some((id) => !discoveredSet.has(id)));
    const searchTarget = searchStep ? (() => {
      const evidenceId = searchStep.evidenceIds.find((id) => !discoveredSet.has(id)) || searchStep.evidenceIds[0];
      const scene = scenes.find((item) => item.evidenceIds.includes(evidenceId));
      return { kind: "search" as const, label: "Search certified clue", evidenceId, locationId: scene?.id || searchStep.locationId };
    })() : undefined;
    const questionStep = routeSteps.find((step) => step.kind === "question" && step.characterIds.some((id) => !questionedSet.has(id)));
    const questionTarget = questionStep
      ? { kind: "question" as const, label: "Question certified witness", characterId: questionStep.characterIds.find((id) => !questionedSet.has(id)) || questionStep.characterIds[0] }
      : undefined;
    const challengeStep = routeSteps.find((step) => step.kind === "challenge" && step.characterIds.some((id) => !challengedSet.has(id)));
    const challengeTarget = challengeStep ? (() => {
      const missingEvidenceId = challengeStep.evidenceIds.find((id) => !discoveredSet.has(id));
      if (missingEvidenceId) {
        return undefined;
      }
      return {
        kind: "challenge" as const,
        label: "Challenge certified testimony",
        characterId: challengeStep.characterIds.find((id) => !challengedSet.has(id)) || challengeStep.characterIds[0],
        evidenceId: challengeStep.evidenceIds.find((id) => discoveredSet.has(id)) || challengeStep.evidenceIds[0]
      };
    })() : undefined;
    const defaultTarget = searchTarget || questionTarget || challengeTarget;
    if (worldLead?.status === "followed") {
      const prioritizedTarget = worldLead.focus === "search"
        ? searchTarget
        : worldLead.focus === "question"
          ? questionTarget
          : challengeTarget;
      if (prioritizedTarget) return { ...prioritizedTarget, label: `${prioritizedTarget.label} / world lead` };
    }
    if (defaultTarget) return defaultTarget;
    if (challengeStep) {
      const missingEvidenceId = challengeStep.evidenceIds.find((id) => !discoveredSet.has(id));
      if (missingEvidenceId) {
        const scene = scenes.find((item) => item.evidenceIds.includes(missingEvidenceId));
        return { kind: "search", label: "Search challenge clue", evidenceId: missingEvidenceId, locationId: scene?.id || challengeStep.locationId };
      }
    }
    const certifiedEvidenceIds = caseRouteCertificate?.theoryEvidenceIds?.length
      ? caseRouteCertificate.theoryEvidenceIds
      : routeSteps.find((step) => step.kind === "select-evidence")?.evidenceIds || [];
    const missingTheoryEvidence = certifiedEvidenceIds.find((id) => discoveredSet.has(id) && !selectedSet.has(id));
    if (missingTheoryEvidence || (certifiedEvidenceIds.length > 0 && certifiedEvidenceIds.some((id) => !selectedSet.has(id)))) {
      return { kind: "select-evidence", label: "Select certified evidence", evidenceId: missingTheoryEvidence || certifiedEvidenceIds[0] };
    }
    if (!session.judgement?.accepted) return { kind: "submit", label: "Submit certified theory" };
    return { kind: "review-source", label: "Review source audit" };
  }
  const guidedManualRun = useMemo(() => {
    const target = getGuidedManualTarget();
    const questioned = Boolean(session?.interrogationLog.length);
    const challengeHit = Boolean(session?.interrogationLog.some((entry) => entry.challenge?.hit));
    const certifiedEvidenceIds = caseRouteCertificate?.theoryEvidenceIds || playableIntake?.routeCertificate?.theoryEvidenceIds || [];
    const selectedSet = new Set(theory.evidenceIds);
    const selectedCertified = certifiedEvidenceIds.length > 0 && certifiedEvidenceIds.every((id) => selectedSet.has(id));
    const completed = [
      Boolean(session),
      Boolean(session?.discoveredEvidenceIds.length),
      questioned,
      challengeHit,
      selectedCertified || Boolean(session?.submittedTheory?.evidenceIds.length),
      Boolean(session?.judgement?.accepted),
      Boolean(session?.judgement?.accepted)
    ].filter(Boolean).length;
    const blockerSummary = caseRouteCertificate?.blockers.length
      ? `${caseRouteCertificate.blockers.length} route blocker(s) need authoring review before manual completion.`
      : target.kind === "review-source"
        ? "Accepted theory is complete; review the source-backed audit workbench."
        : "Runs one low-spoiler player step using the current certified route.";
    return {
      currentStep: target.kind,
      currentLabel: target.label,
      completedSteps: completed,
      totalSteps: 7,
      lastResult: guidedManualLastResult,
      blockerSummary,
      readyToReview: Boolean(session?.judgement?.accepted),
      running: guidedManualRunning || busy
    };
  }, [busy, caseRouteCertificate, guidedManualLastResult, guidedManualRunning, playableIntake, session, theory.evidenceIds, worldLead]);
  const campaignStudyWorldChoices = useMemo<Partial<Record<CampaignStudyWorldChoice, boolean>>>(() => ({
    "world-lead": worldLead?.status === "pending",
    "resource-commitment": playerResourceCommitment?.status === "ready" || playerResourceCommitment?.status === "blocked",
    "faction-directive": worldArcDirective?.status === "ready" || worldArcDirective?.status === "blocked",
    "world-event-offer": worldEventOffer?.status === "offered",
    "campaign-recovery": campaignRecovery?.status === "ready",
    "finale-case": arcConvergence?.status === "ready"
  }), [arcConvergence?.status, campaignRecovery?.status, playerResourceCommitment?.status, worldArcDirective?.status, worldEventOffer?.status, worldLead?.status]);
  const campaignStudyStage = useMemo<CampaignStudyStage>(() => {
    const campaignStatus = campaignSession?.status || townRuntime?.campaignSessionSummary?.status;
    if (campaignStatus === "completed") return "debrief";
    if (campaignRecovery?.status === "ready" || campaignRecovery?.status === "scheduled") return "recovery";
    if (arcConvergence?.status === "ready" || arcConvergence?.status === "active" || campaignStatus === "finale-ready" || campaignStatus === "finale-active") return "finale";
    if (Object.values(campaignStudyWorldChoices).some(Boolean)) return "world-choice";
    if (!session) return activeCase ? "join" : campaignStatus === "opening" ? "opening" : "case-extraction";
    if (session.judgement?.accepted) return "review-source";
    if (guidedManualRun.currentStep === "join") return "join";
    if (guidedManualRun.currentStep === "search") return "search";
    if (guidedManualRun.currentStep === "question") return "question";
    if (guidedManualRun.currentStep === "challenge") return "challenge";
    if (guidedManualRun.currentStep === "select-evidence") return "pick-evidence";
    if (guidedManualRun.currentStep === "review-source") return "review-source";
    return countManualTheoryFields(theory) < 3 ? "fill-theory" : "submit";
  }, [activeCase, arcConvergence?.status, campaignRecovery?.status, campaignSession?.status, campaignStudyWorldChoices, guidedManualRun.currentStep, session, theory, townRuntime?.campaignSessionSummary?.status]);
  const campaignStudyCampaignStatus = campaignSession?.status || townRuntime?.campaignSessionSummary?.status;
  const campaignStudy = useCampaignComprehensionStudy({
    runtimeMode,
    canStart: campaignStudyCampaignStatus === "opening" && !session,
    startBlockedReason: campaignStudyCampaignStatus !== "opening"
      ? "Use the existing Reset/Create Town flow to return to Campaign opening. The recorder will not reset the world."
      : session
        ? "Finish or reset the active investigation session before starting a study run."
        : undefined,
    currentStage: campaignStudyStage,
    campaignCompleted: campaignStudyCampaignStatus === "completed",
    recoveryReady: campaignRecovery?.status === "ready",
    readyWorldChoices: campaignStudyWorldChoices
  });
  const solvedCaseDebrief = useMemo(() => {
    if (!session?.judgement?.accepted || !sourceReviewUnlock) return null;
    const lastDoneEntry = [...guidedStepJournal].reverse().find((entry) => entry.status === "done");
    const manualStepCount = new Set(guidedStepJournal.filter((entry) => entry.status === "done").map((entry) => entry.step)).size;
    return {
      accepted: true,
      manualStepsCompleted: Math.max(guidedManualRun.completedSteps, manualStepCount),
      totalManualSteps: guidedManualRun.totalSteps,
      lastStepResult: lastDoneEntry?.result || guidedManualRun.lastResult,
      fallbackUsed: guidedStepJournal.some((entry) => entry.fallbackUsed),
      selectedEvidenceCount: sourceReviewUnlock.selectedEvidenceCount,
      challengeHitCount: sourceReviewUnlock.challengeHitCount,
      coveredObligations: sourceReviewUnlock.coveredObligations,
      totalObligations: sourceReviewUnlock.totalObligations,
      proofGapCount: sourceReviewUnlock.proofGapCount,
      sourceEventCount: sourceReviewUnlock.sourceEventCount,
      memoryCount: sourceReviewUnlock.memoryCount,
      routeStepCount: sourceReviewUnlock.routeStepCount,
      sourceReviewUnlocked: sourceReviewUnlock.unlocked,
      worldLeadOutcomeStatus: worldLeadOutcome?.status || "not-used" as const,
      worldLeadHandoffStatus: worldLeadCaseHandoff?.status || "not-used" as const,
      worldArcStatus: worldArc?.status || "not-used" as const,
      worldArcProgress: worldArc?.progressLabel || "not-used",
      worldArcDirectiveStatus: worldArcDirective?.status || "not-used" as const,
      worldPressureCascadeStatus: worldPressureCascade?.status || "empty" as const,
      townSocialResponseStatus: townSocialResponse?.status || "empty" as const
    };
  }, [guidedManualRun, guidedStepJournal, session, sourceReviewUnlock, townSocialResponse, worldArc, worldArcDirective, worldLeadCaseHandoff, worldLeadOutcome, worldPressureCascade]);
  const replayGoalCoach = useMemo(() => {
    const visible = Boolean(solvedCaseDebrief || replayGoalAttempt?.active);
    if (!visible) return null;
    const activeAttempt = Boolean(replayGoalAttempt?.active);
    const previousGuidedSteps = replayGoalAttempt?.previousGuidedSteps ?? solvedCaseDebrief?.manualStepsCompleted ?? 0;
    const previousFallbackUsed = replayGoalAttempt?.previousFallbackUsed ?? Boolean(solvedCaseDebrief?.fallbackUsed);
    const previousFallbackTheoryFieldCount = replayGoalAttempt?.previousFallbackTheoryFieldCount ?? (previousFallbackUsed ? 3 : 0);
    const previousSelectedEvidenceCount = replayGoalAttempt?.previousSelectedEvidenceCount ?? solvedCaseDebrief?.selectedEvidenceCount ?? 0;
    const previousProofGapCount = replayGoalAttempt?.previousProofGapCount ?? solvedCaseDebrief?.proofGapCount ?? 0;
    const previousSourceReviewUnlocked = replayGoalAttempt?.previousSourceReviewUnlocked ?? Boolean(solvedCaseDebrief?.sourceReviewUnlocked);
    const currentDoneSteps = new Set(guidedStepJournal.filter((entry) => entry.status === "done").map((entry) => entry.step)).size;
    const currentFallbackUsed = guidedStepJournal.some((entry) => entry.fallbackUsed);
    const currentFallbackTheoryFieldCount = replayGoalAttempt?.fallbackTheoryFieldCount ?? 0;
    const currentReviewUnlocked = Boolean(session?.judgement?.accepted && (sourceReviewUnlock?.unlocked || guidedStepJournal.some((entry) => entry.reviewUnlocked)));
    const currentEvidenceSelected = theory.evidenceIds.length || session?.submittedTheory?.evidenceIds.length || 0;
    const accepted = Boolean(session?.judgement?.accepted);
    const goals = [
      {
        id: "reduce-fallback",
        label: "Reduce fallback",
        status: accepted && currentFallbackTheoryFieldCount < previousFallbackTheoryFieldCount ? "done" as const : activeAttempt ? "active" as const : "ready" as const,
        detail: previousFallbackUsed ? `Previous run used ${previousFallbackTheoryFieldCount} explicit fallback theory field(s); fill more fields manually before submit.` : "Keep the replay clean by avoiding explicit fallback."
      },
      {
        id: "manual-evidence-selection",
        label: "Manual evidence selection",
        status: currentEvidenceSelected > 0 ? "done" as const : activeAttempt ? "active" as const : "ready" as const,
        detail: "Select proof clues yourself before submit instead of relying only on the certified route."
      },
      {
        id: "fewer-guided-clicks",
        label: "Fewer guided clicks",
        status: accepted && currentDoneSteps > 0 && currentDoneSteps < previousGuidedSteps ? "done" as const : activeAttempt ? "active" as const : "ready" as const,
        detail: `Previous run used ${previousGuidedSteps} guided step(s); replay with fewer guided actions.`
      },
      {
        id: "review-source-after-submit",
        label: "Review source after submit",
        status: currentReviewUnlocked ? "done" as const : activeAttempt ? "active" as const : "ready" as const,
        detail: "After submit, open the source-backed workbench and compare the route confidence."
      }
    ];
    return {
      visible,
      activeAttempt,
      previousGuidedSteps,
      previousFallbackUsed,
      previousFallbackTheoryFieldCount,
      previousSelectedEvidenceCount,
      previousProofGapCount,
      previousSourceReviewUnlocked,
      currentStep: guidedManualRun.currentStep,
      lastResult: accepted ? guidedManualRun.lastResult : replayGoalAttempt?.lastResult || guidedManualRun.lastResult,
      completedGoalCount: goals.filter((goal) => goal.status === "done").length,
      totalGoalCount: goals.length,
      goals
    };
  }, [guidedManualRun, guidedStepJournal, replayGoalAttempt, session, solvedCaseDebrief, sourceReviewUnlock, theory.evidenceIds]);
  const manualEvidenceDrill = useMemo(() => {
    if (!replayGoalAttempt?.active || !session || session.judgement?.accepted) return null;
    const routeEvidenceIds = caseRouteCertificate?.theoryEvidenceIds?.length
      ? caseRouteCertificate.theoryEvidenceIds
      : playableIntake?.routeCertificate?.theoryEvidenceIds || [];
    const discoveredSet = new Set(session.discoveredEvidenceIds);
    const selectedSet = new Set(theory.evidenceIds);
    const routeDiscoveredIds = routeEvidenceIds.filter((id) => discoveredSet.has(id));
    const candidateItems = evidenceNotebook
      .filter((item) => !item.locked && discoveredSet.has(item.evidenceId))
      .filter((item) => !routeEvidenceIds.length || routeEvidenceIds.includes(item.evidenceId));
    if (!candidateItems.length) return null;
    const targetCount = Math.max(1, routeEvidenceIds.length || routeDiscoveredIds.length || candidateItems.length);
    const manualPickCount = candidateItems.filter((item) => selectedSet.has(item.evidenceId)).length;
    const remainingProofSlots = Math.max(0, targetCount - manualPickCount);
    return {
      visible: true,
      selectedEvidenceCount: theory.evidenceIds.length,
      routeEvidenceTargetCount: targetCount,
      manualPickCount: replayGoalAttempt.manualEvidencePickCount || manualPickCount,
      remainingProofSlots,
      readyForSubmit: routeDiscoveredIds.length > 0 && routeDiscoveredIds.every((id) => selectedSet.has(id)),
      candidates: candidateItems.map((item) => ({
        evidenceId: item.evidenceId,
        title: item.title,
        locationLabel: item.locationName || "Known location",
        sourceLabel: item.sourceEventLabel || "source-facing clue",
        supports: item.supports,
        contradicts: item.contradicts,
        selected: selectedSet.has(item.evidenceId)
      }))
    };
  }, [caseRouteCertificate, evidenceNotebook, playableIntake, replayGoalAttempt, session, theory.evidenceIds]);
  const manualTheoryDrill = useMemo(() => {
    if (!replayGoalAttempt?.active || !session || session.judgement?.accepted) return null;
    const routeEvidenceIds = caseRouteCertificate?.theoryEvidenceIds?.length
      ? caseRouteCertificate.theoryEvidenceIds
      : playableIntake?.routeCertificate?.theoryEvidenceIds || [];
    const selectedSet = new Set(theory.evidenceIds);
    const evidenceReady = routeEvidenceIds.length > 0 && routeEvidenceIds.every((id) => selectedSet.has(id));
    if (!evidenceReady) return null;
    const manualFieldCount = countManualTheoryFields(theory);
    const unresolvedFields = unresolvedManualTheoryFields(session.judgement);
    const evidencePrompts = discoveredEvidence
      .filter((item) => selectedSet.has(item.id))
      .slice(0, 4)
      .map((item, index) => {
        const notebookItem = evidenceNotebook.find((candidate) => candidate.evidenceId === item.id);
        const supportLabels = (notebookItem?.supports || [])
          .slice(0, 2)
          .map((label, labelIndex) => (
            /\b(?:npc|evidence|event|source|ev)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(label)
              ? `proof lane ${labelIndex + 1}`
              : label
          ));
        return {
          title: item.title,
          detail: item.visibleDescription,
          supportLabels: supportLabels.length ? supportLabels : [`discovered proof clue ${index + 1}`]
        };
      });
    return {
      visible: true,
      manualFieldCount,
      remainingFieldCount: Math.max(0, 3 - manualFieldCount),
      fallbackFieldCount: replayGoalAttempt.fallbackTheoryFieldCount,
      blockedGapCount: unresolvedFields.size,
      evidenceReady,
      readyForSubmit: evidenceReady && manualFieldCount === 3 && unresolvedFields.size === 0,
      fallbackApproved: replayGoalAttempt.theoryFallbackApproved,
      suspectOptions: characters.map((character) => ({
        id: character.id,
        label: `${character.name} / ${character.role}`
      })),
      selectedCulpritId: theory.culpritId,
      motiveText: theory.motive,
      methodText: theory.method,
      evidencePrompts
    };
  }, [caseRouteCertificate, characters, discoveredEvidence, evidenceNotebook, playableIntake, replayGoalAttempt, session, theory]);
  const replayAttemptScorecard = useMemo(() => {
    if (!replayGoalCoach) return null;
    const activeAttempt = Boolean(replayGoalAttempt?.active);
    const accepted = Boolean(session?.judgement?.accepted);
    const completed = activeAttempt && accepted;
    const currentDoneSteps = activeAttempt
      ? new Set(guidedStepJournal.filter((entry) => entry.status === "done").map((entry) => entry.step)).size
      : solvedCaseDebrief?.manualStepsCompleted ?? guidedManualRun.completedSteps;
    const currentFallbackUsed = activeAttempt
      ? guidedStepJournal.some((entry) => entry.fallbackUsed)
      : Boolean(solvedCaseDebrief?.fallbackUsed);
    const currentSelectedEvidenceCount = activeAttempt
      ? theory.evidenceIds.length || session?.submittedTheory?.evidenceIds.length || 0
      : (solvedCaseDebrief?.selectedEvidenceCount ?? theory.evidenceIds.length) || 0;
    const currentProofGapCount = sourceReviewUnlock?.proofGapCount ?? solvedCaseDebrief?.proofGapCount ?? replayGoalCoach.previousProofGapCount;
    const currentSourceReviewUnlocked = Boolean(session?.judgement?.accepted && (sourceReviewUnlock?.unlocked || guidedStepJournal.some((entry) => entry.reviewUnlocked)));
    const manualEvidencePickCount = replayGoalAttempt?.manualEvidencePickCount ?? 0;
    const fallbackEvidencePickCount = replayGoalAttempt?.fallbackEvidencePickCount ?? 0;
    const manualTheoryFieldCount = replayGoalAttempt?.manualTheoryFieldCount ?? countManualTheoryFields(theory);
    const fallbackTheoryFieldCount = replayGoalAttempt?.fallbackTheoryFieldCount ?? 0;
    const blockedTheoryGapCount = replayGoalAttempt?.blockedTheoryGapCount ?? 0;
    const pendingStatus = "pending" as const;
    const deltaNumber = (current: number, previous: number, lowerIsBetter = false) => {
      if (!completed) return pendingStatus;
      if (current === previous) return "unchanged" as const;
      return lowerIsBetter
        ? current < previous ? "improved" as const : "regressed" as const
        : current > previous ? "improved" as const : "regressed" as const;
    };
    const deltaFallback = () => {
      if (!completed) return pendingStatus;
      if (currentFallbackUsed === replayGoalCoach.previousFallbackUsed) return "unchanged" as const;
      return !currentFallbackUsed && replayGoalCoach.previousFallbackUsed ? "improved" as const : "regressed" as const;
    };
    return {
      visible: true,
      status: completed ? "completed" as const : "pending" as const,
      activeAttempt,
      currentStep: guidedManualRun.currentStep,
      lastResult: replayGoalCoach.lastResult,
      completedGuidedSteps: currentDoneSteps,
      fallbackUsed: currentFallbackUsed,
      selectedEvidenceCount: currentSelectedEvidenceCount,
      manualEvidencePickCount,
      fallbackEvidencePickCount,
      manualTheoryFieldCount,
      fallbackTheoryFieldCount,
      blockedTheoryGapCount,
      proofGapCount: currentProofGapCount,
      sourceReviewUnlocked: currentSourceReviewUnlocked,
      worldLeadOutcomeStatus: worldLeadOutcome?.status || "not-used" as const,
      worldLeadHandoffStatus: worldLeadCaseHandoff?.status || "not-used" as const,
      worldArcStatus: worldArc?.status || "not-used" as const,
      worldArcProgress: worldArc?.progressLabel || "not-used",
      worldArcDirectiveStatus: worldArcDirective?.status || "not-used" as const,
      worldPressureCascadeStatus: worldPressureCascade?.status || "empty" as const,
      townSocialResponseStatus: townSocialResponse?.status || "empty" as const,
      completedReplayGoals: replayGoalCoach.completedGoalCount,
      totalReplayGoals: replayGoalCoach.totalGoalCount,
      rows: [
        {
          id: "guided-clicks",
          label: "Guided clicks",
          previous: `${replayGoalCoach.previousGuidedSteps}`,
          current: `${currentDoneSteps}`,
          status: deltaNumber(currentDoneSteps, replayGoalCoach.previousGuidedSteps, true),
          detail: completed ? "Lower guided-step count means the replay was more manual." : "Complete the replay attempt to compare guided-step count."
        },
        {
          id: "certified-fallback",
          label: "Explicit fallback",
          previous: replayGoalCoach.previousFallbackUsed ? "used" : "not used",
          current: `${currentFallbackUsed ? "used" : "not used"} / ${fallbackTheoryFieldCount} theory field(s) / ${fallbackEvidencePickCount} evidence pick(s)`,
          status: deltaFallback(),
          detail: completed ? "Field-level attribution separates manual theory work from explicit certified completion." : "Fallback remains pending until the player explicitly approves it and submits."
        },
        {
          id: "manual-evidence-selection",
          label: "Manual evidence selection",
          previous: `${replayGoalCoach.previousSelectedEvidenceCount}`,
          current: `${currentSelectedEvidenceCount} selected / ${manualEvidencePickCount} manual picks / ${fallbackEvidencePickCount} fallback picks`,
          status: deltaNumber(manualEvidencePickCount || currentSelectedEvidenceCount, replayGoalCoach.previousSelectedEvidenceCount),
          detail: completed ? "Manual picks are counted separately from any certified fallback evidence added at submit." : "Use Manual Evidence Drill before submit to improve this delta."
        },
        {
          id: "manual-theory-fields",
          label: "Manual theory fields",
          previous: `${Math.max(0, 3 - replayGoalCoach.previousFallbackTheoryFieldCount)} manual / ${replayGoalCoach.previousFallbackTheoryFieldCount} fallback`,
          current: `${manualTheoryFieldCount} manual / ${fallbackTheoryFieldCount} fallback / ${blockedTheoryGapCount} blocked gaps`,
          status: deltaNumber(manualTheoryFieldCount, Math.max(0, 3 - replayGoalCoach.previousFallbackTheoryFieldCount)),
          detail: completed ? "Suspect, motive, and method are attributed without displaying submitted text or certified values." : "Complete Manual Theory Drill or explicitly approve fallback for unresolved fields."
        },
        {
          id: "proof-gaps",
          label: "Proof gaps",
          previous: `${replayGoalCoach.previousProofGapCount}`,
          current: `${currentProofGapCount}`,
          status: deltaNumber(currentProofGapCount, replayGoalCoach.previousProofGapCount, true),
          detail: completed ? "Fewer proof gaps means the replay ended with a cleaner closure." : "Proof gaps are compared after judgement."
        },
        {
          id: "source-review",
          label: "Source review unlocked",
          previous: replayGoalCoach.previousSourceReviewUnlocked ? "unlocked" : "locked",
          current: currentSourceReviewUnlocked ? "unlocked" : "locked",
          status: currentSourceReviewUnlocked ? "completed" as const : pendingStatus,
          detail: currentSourceReviewUnlocked ? "Review Source is available for the replay attempt." : "Submit an accepted theory to unlock source review."
        },
        {
          id: "replay-goals",
          label: "Completed replay goals",
          previous: "baseline",
          current: `${replayGoalCoach.completedGoalCount}/${replayGoalCoach.totalGoalCount}`,
          status: completed ? "completed" as const : pendingStatus,
          detail: completed ? "Replay goals are summarized descriptively; no gate or score is enforced." : "Goals update as the replay attempt progresses."
        },
        {
          id: "world-lead-outcome",
          label: "World lead outcome",
          previous: "not used",
          current: worldLeadOutcome?.status || "not used",
          status: worldLeadOutcome?.status === "settled" ? "completed" as const : pendingStatus,
          detail: worldLeadOutcome?.status === "settled"
            ? "The bounded world effect settled with the accepted case without changing route coverage."
            : worldLeadOutcome?.status === "active"
              ? "The bounded world effect remains active until the current case closes."
              : "Following a world lead is optional and never changes the certified route."
        },
        {
          id: "world-lead-handoff",
          label: "Next-case handoff",
          previous: "not used",
          current: worldLeadCaseHandoff?.status || "not used",
          status: worldLeadCaseHandoff?.status === "consumed" ? "completed" as const : pendingStatus,
          detail: worldLeadCaseHandoff?.status === "ready"
            ? "One bounded queue preference is ready for the next extracted case."
            : worldLeadCaseHandoff?.status === "consumed"
              ? "The follow-up was carried into the next case without changing its certified route."
              : "No next-case handoff was prepared for this replay."
        },
        {
          id: "world-arc-directive",
          label: "Faction directive",
          previous: "not used",
          current: worldArcDirective?.status || "not used",
          status: worldArcDirective?.status === "completed" ? "completed" as const : pendingStatus,
          detail: worldArcDirective?.status === "completed"
            ? "The selected response completed through the existing multi-tick town simulation."
            : worldArcDirective?.status === "blocked"
              ? "The operation is safely blocked and can use its alternate response."
              : "The directive remains a low-spoiler strategy layer outside certified case proof."
        },
        {
          id: "world-pressure-cascade",
          label: "World pressure",
          previous: "empty",
          current: worldPressureCascade?.status || "empty",
          status: worldPressureCascade?.status === "active" || worldPressureCascade?.status === "consumed" ? "completed" as const : pendingStatus,
          detail: worldPressureCascade?.status === "active"
            ? `${worldPressureCascade.remainingLayers} bounded layer(s) may reorder future, unextracted cases.`
            : worldPressureCascade?.status === "consumed"
              ? "A successful extraction consumed one bounded pressure layer."
              : "No cross-case pressure layer is active."
        },
        {
          id: "town-social-response",
          label: "Town reactions",
          previous: "empty",
          current: townSocialResponse?.status || "empty",
          status: townSocialResponse?.status === "settled" ? "completed" as const : pendingStatus,
          detail: townSocialResponse?.status === "ready"
            ? "A bounded public response is ready for the next normal town advance."
            : townSocialResponse?.status === "active"
              ? `${townSocialResponse.progressLabel} public reactions have surfaced without entering case authority.`
              : townSocialResponse?.status === "settled"
                ? "The latest ambient response settled outside evidence, memory testimony, and legal actions."
                : "No player-driven town response is currently recorded."
        }
      ]
    };
  }, [guidedManualRun, guidedStepJournal, replayGoalAttempt, replayGoalCoach, session, solvedCaseDebrief, sourceReviewUnlock, theory, townSocialResponse, worldArcDirective, worldLeadCaseHandoff, worldLeadOutcome, worldPressureCascade]);
  const replayPracticeLoop = useMemo(() => {
    if (!replayGoalCoach) return null;
    const labels = {
      start: "Start",
      discover: "Discover",
      "pick-evidence": "Pick Evidence",
      "fill-theory": "Fill Theory",
      submit: "Submit",
      "review-source": "Review Source",
      scorecard: "Scorecard"
    } as const;
    const orderedStages = Object.keys(labels) as Array<keyof typeof labels>;
    const activeAttempt = replayGoalCoach.activeAttempt;
    const sourceReviewUnlocked = Boolean(session?.judgement?.accepted && (sourceReviewUnlock?.unlocked || guidedStepJournal.some((entry) => entry.reviewUnlocked)));
    const scorecardStatus = replayAttemptScorecard?.status || (replayGoalCoach ? "pending" : "waiting");
    let currentPhase: keyof typeof labels = "start";
    if (!activeAttempt) currentPhase = "start";
    else if (scorecardStatus === "completed") currentPhase = "scorecard";
    else if (sourceReviewUnlocked) currentPhase = "review-source";
    else if (manualTheoryDrill) currentPhase = manualTheoryDrill.readyForSubmit || manualTheoryDrill.fallbackApproved ? "submit" : "fill-theory";
    else if (manualEvidenceDrill) currentPhase = "pick-evidence";
    else if (["search", "question", "challenge", "select-evidence"].includes(guidedManualRun.currentStep)) currentPhase = "discover";
    else currentPhase = "start";

    const manualEvidencePickCount = replayAttemptScorecard?.manualEvidencePickCount ?? replayGoalAttempt?.manualEvidencePickCount ?? manualEvidenceDrill?.manualPickCount ?? 0;
    const manualTheoryFieldCount = replayAttemptScorecard?.manualTheoryFieldCount ?? replayGoalAttempt?.manualTheoryFieldCount ?? manualTheoryDrill?.manualFieldCount ?? 0;
    const fallbackEvidencePickCount = replayAttemptScorecard?.fallbackEvidencePickCount ?? replayGoalAttempt?.fallbackEvidencePickCount ?? 0;
    const fallbackTheoryFieldCount = replayAttemptScorecard?.fallbackTheoryFieldCount ?? replayGoalAttempt?.fallbackTheoryFieldCount ?? manualTheoryDrill?.fallbackFieldCount ?? 0;
    const blockedGapCount = replayAttemptScorecard?.blockedTheoryGapCount ?? replayGoalAttempt?.blockedTheoryGapCount ?? manualTheoryDrill?.blockedGapCount ?? 0;

    const nextAction = !activeAttempt
      ? "Start replay attempt"
      : manualEvidenceDrill && !manualEvidenceDrill.readyForSubmit
        ? "Use Manual Evidence Drill"
        : manualTheoryDrill && !manualTheoryDrill.readyForSubmit && !manualTheoryDrill.fallbackApproved && manualTheoryDrill.blockedGapCount > 0
          ? "Revise fields or approve explicit fallback"
          : manualTheoryDrill && !manualTheoryDrill.readyForSubmit && !manualTheoryDrill.fallbackApproved
            ? "Use Manual Theory Drill"
            : manualTheoryDrill?.fallbackApproved
              ? "Run guided submit with explicit fallback"
              : sourceReviewUnlocked && scorecardStatus === "completed"
                ? "Read completed scorecard"
                : sourceReviewUnlocked
                  ? "Review source and read scorecard"
                  : "Run Next Guided Step";

    const currentIndex = orderedStages.indexOf(currentPhase);
    const stages = orderedStages.map((id, index) => ({
      id,
      label: labels[id],
      status: index < currentIndex
        ? "done" as const
        : index === currentIndex
          ? "current" as const
          : activeAttempt || id === "start"
            ? "ready" as const
            : "locked" as const
    }));

    return {
      visible: true,
      activeAttempt,
      currentPhase,
      currentPhaseLabel: labels[currentPhase],
      nextAction,
      manualEvidencePickCount,
      manualTheoryFieldCount,
      fallbackEvidencePickCount,
      fallbackTheoryFieldCount,
      blockedGapCount,
      sourceReviewUnlocked,
      scorecardStatus: scorecardStatus === "completed" ? "completed" as const : replayAttemptScorecard ? "pending" as const : "waiting" as const,
      worldLeadOutcomeStatus: worldLeadOutcome?.status || "not-used" as const,
      worldLeadHandoffStatus: worldLeadCaseHandoff?.status || "not-used" as const,
      worldArcStatus: worldArc?.status || "not-used" as const,
      worldArcProgress: worldArc?.progressLabel || "not-used",
      worldArcDirectiveStatus: worldArcDirective?.status || "not-used" as const,
      worldPressureCascadeStatus: worldPressureCascade?.status || "empty" as const,
      townSocialResponseStatus: townSocialResponse?.status || "empty" as const,
      stages
    };
  }, [guidedManualRun.currentStep, guidedStepJournal, manualEvidenceDrill, manualTheoryDrill, replayAttemptScorecard, replayGoalAttempt, replayGoalCoach, session, sourceReviewUnlock, townSocialResponse, worldArc, worldArcDirective, worldLeadCaseHandoff, worldLeadOutcome, worldPressureCascade]);
  function appendGuidedStepJournal(entry: Omit<GuidedStepJournalEntry, "id">) {
    guidedStepJournalSeq.current += 1;
    const id = `guided-step-${guidedStepJournalSeq.current}`;
    setGuidedStepJournal((current) => {
      const withImplicitJoin = entry.step !== "join" && !current.some((item) => item.step === "join")
        ? [
            {
              id: `${id}-join`,
              step: "join" as const,
              label: "Join investigation",
              status: "done" as const,
              result: "Investigation session opened.",
              progressDelta: "Player can now search scenes and question witnesses.",
              nextAction: "Search the first certified route clue."
            },
            ...current
          ]
        : current;
      const entryKey = entry.journalKey || entry.step;
      const existingIndex = withImplicitJoin.findIndex((item) => (item.journalKey || item.step) === entryKey);
      if (existingIndex >= 0) {
        const next = [...withImplicitJoin];
        next[existingIndex] = { ...entry, id: withImplicitJoin[existingIndex].id };
        return next;
      }
      return [
        ...withImplicitJoin,
        {
          ...entry,
          id
        }
      ];
    });
  }
  async function updateWorldLeadDecision(action: "follow" | "skip" | "resolve", journal = true) {
    if (runtimeMode === "static-demo" || !world || !session) return;
    setBusy(true);
    try {
      const data = await postV1<{
        runtime: PersistentTownRuntime;
        queue: TownEmergenceQueue;
        world: WorldState;
        worldLead: WorldLeadPublicSummary;
        worldLeadOutcome?: WorldLeadOutcomePublicSummary;
        worldArc?: WorldArcPublicSummary;
        worldInfluenceBudget?: WorldInfluenceBudgetPublicSummary;
        arcConvergence?: ArcConvergencePublicSummary;
      }>("/api/v1/command/town/runtime/step", {
        worldId: world.id,
        steps: 0,
        worldLeadDecision: { sessionId: session.id, action }
      });
      setTownRuntime(data.runtime);
      setTownQueue(data.queue);
      setWorld(data.world);
      setWorldLead(data.worldLead);
      if (data.worldLeadOutcome) setWorldLeadOutcome(data.worldLeadOutcome);
      if (data.worldArc) setWorldArc(data.worldArc);
      if (data.worldInfluenceBudget) setWorldInfluenceBudget(data.worldInfluenceBudget);
      if (data.arcConvergence) {
        setArcConvergence(data.arcConvergence);
        if (data.arcConvergence.status === "active") {
          appendGuidedStepJournal({
            journalKey: "arc-convergence-active",
            step: "join",
            label: "Campaign finale activated",
            status: "done",
            result: `${data.arcConvergence.finaleLabel} entered the normal certified case path.`,
            progressDelta: data.arcConvergence.approachLabel,
            nextAction: data.arcConvergence.nextAction
          });
        }
      }
      if (journal) {
        const label = action === "follow"
          ? "World lead followed"
          : action === "skip"
            ? "World lead skipped"
            : data.worldLeadOutcome
              ? "World lead outcome active"
              : "World lead resolved";
        appendGuidedStepJournal({
          journalKey: "world-lead",
          step: "join",
          label,
          status: action === "resolve" ? "done" : "info",
          result: action === "follow"
            ? "A server-backed world lead now prioritizes an eligible certified investigation step."
            : action === "skip"
              ? "The certified investigation route remains unchanged."
              : data.worldLeadOutcome
                ? `${data.worldLeadOutcome.benefitLabel} ${data.worldLeadOutcome.costLabel}`
                : "The selected world lead reached its eligible certified investigation step.",
          progressDelta: action === "follow"
            ? `Priority set to ${data.worldLead.focus}.`
            : action === "skip"
              ? "No route priority was changed."
              : data.worldLeadOutcome
                ? "One bounded world effect is active for this case."
                : "World lead marked complete without changing route coverage.",
          nextAction: data.worldLeadOutcome?.nextAction || data.worldLead.nextAction
        });
      }
      setStatus(action === "follow"
        ? "World lead followed. The next eligible certified step is prioritized."
        : action === "skip"
          ? "World lead skipped. The certified route remains the next action."
          : data.worldLeadOutcome
            ? "World lead resolved. A bounded world effect is active for this case."
            : "World lead resolved after its eligible certified step.");
      if (action !== "resolve") campaignStudy.recordWorldChoice("world-lead");
      return data.worldLead;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update world lead.");
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  async function updateWorldArcDirectiveDecision(choice: "support" | "contain" | "defer") {
    if (runtimeMode === "static-demo" || !world) return;
    setBusy(true);
    try {
      const data = await postV1<{
        runtime: PersistentTownRuntime;
        queue: TownEmergenceQueue;
        world: WorldState;
        worldArcDirective: WorldArcDirectivePublicSummary;
        worldPressureCascade?: WorldPressureCascadePublicSummary;
        factionRelationship?: FactionRelationshipPublicSummary;
        worldInfluenceBudget?: WorldInfluenceBudgetPublicSummary;
        investigatorProgression?: InvestigatorProgressionPublicSummary;
      }>("/api/v1/command/town/runtime/step", {
        worldId: world.id,
        steps: 0,
        worldArcDirectiveDecision: { choice }
      });
      setTownRuntime(data.runtime);
      setTownQueue(data.queue);
      setWorld(data.world);
      setWorldArcDirective(data.worldArcDirective);
      if (data.worldPressureCascade) setWorldPressureCascade(data.worldPressureCascade);
      if (data.factionRelationship) setFactionRelationship(data.factionRelationship);
      if (data.worldInfluenceBudget) setWorldInfluenceBudget(data.worldInfluenceBudget);
      appendGuidedStepJournal({
        journalKey: choice === "defer" ? "world-arc-directive-deferred" : `world-arc-directive-chosen-${choice}`,
        step: "submit",
        label: choice === "defer" ? "Faction directive deferred" : `Faction directive ${choice} selected`,
        status: "info",
        result: choice === "defer"
          ? "The response remains open without advancing the town clock."
          : `${data.worldArcDirective.operationLabel} is scheduled through the existing town simulation.`,
        progressDelta: data.worldArcDirective.progressLabel,
        nextAction: data.worldArcDirective.nextAction
      });
      setStatus(choice === "defer"
        ? "Faction directive deferred. The response remains open."
        : `Faction directive ${choice} scheduled for the next legal institution cycle.`);
      campaignStudy.recordWorldChoice("faction-directive");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update faction directive.");
    } finally {
      setBusy(false);
    }
  }
  async function updatePlayerResourceCommitmentDecision(choice: "police-time" | "informant-trust" | "evidence-integrity" | "none") {
    if (runtimeMode === "static-demo" || !world || !session) return;
    setBusy(true);
    try {
      const data = await postV1<{
        runtime: PersistentTownRuntime;
        queue: TownEmergenceQueue;
        world: WorldState;
        playerResourceCommitment: PlayerResourceCommitmentPublicSummary;
        factionRelationship?: FactionRelationshipPublicSummary;
        worldInfluenceBudget?: WorldInfluenceBudgetPublicSummary;
      }>("/api/v1/command/town/runtime/step", {
        worldId: world.id,
        steps: 0,
        playerResourceCommitmentDecision: { sessionId: session.id, choice }
      });
      setTownRuntime(data.runtime);
      setTownQueue(data.queue);
      setWorld(data.world);
      setPlayerResourceCommitment(data.playerResourceCommitment);
      if (data.factionRelationship) setFactionRelationship(data.factionRelationship);
      if (data.worldInfluenceBudget) setWorldInfluenceBudget(data.worldInfluenceBudget);
      appendGuidedStepJournal({
        journalKey: "player-resource-commitment",
        step: "join",
        label: choice === "none" ? "Case resource declined" : "Case resource reserved",
        status: "info",
        result: data.playerResourceCommitment.progressLabel,
        progressDelta: choice === "none" ? "No world resource changed." : `${data.playerResourceCommitment.reserveCost || 2} unit(s) moved from available to reserved without advancing the town clock.`,
        nextAction: data.playerResourceCommitment.nextAction
      });
      setStatus(choice === "none"
        ? "Continuing without a case resource reserve. The certified route is unchanged."
        : `${data.playerResourceCommitment.label} reserved for the matching certified step.`);
      campaignStudy.recordWorldChoice("resource-commitment");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update case resource commitment.");
    } finally {
      setBusy(false);
    }
  }
  async function updateWorldEventOfferDecision(choice: "accept" | "decline") {
    if (runtimeMode === "static-demo" || !world) return;
    setBusy(true);
    try {
      const data = await postV1<{
        runtime: PersistentTownRuntime;
        queue: TownEmergenceQueue;
        world: WorldState;
        worldEventOffer: WorldEventOfferPublicSummary;
        factionRelationship?: FactionRelationshipPublicSummary;
      }>("/api/v1/command/town/runtime/step", {
        worldId: world.id,
        steps: 0,
        worldEventOfferDecision: { choice }
      });
      setTownRuntime(data.runtime);
      setTownQueue(data.queue);
      setWorld(data.world);
      setWorldEventOffer(data.worldEventOffer);
      if (data.factionRelationship) setFactionRelationship(data.factionRelationship);
      appendGuidedStepJournal({
        journalKey: `world-event-offer-${choice}`,
        step: "submit",
        label: choice === "accept" ? "World opportunity accepted" : "World opportunity declined",
        status: choice === "accept" ? "info" : "done",
        result: data.worldEventOffer.progressLabel,
        progressDelta: choice === "accept" ? data.worldEventOffer.benefitLabel : "No resource, relationship, event, or tick changed.",
        nextAction: data.worldEventOffer.nextAction
      });
      setStatus(choice === "accept" ? "World opportunity accepted for the next legal institution cycle." : "World opportunity declined without a hidden penalty.");
      campaignStudy.recordWorldChoice("world-event-offer");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update world opportunity.");
    } finally {
      setBusy(false);
    }
  }
  async function updateCampaignRecoveryDecision(choice: "start" | "defer") {
    if (runtimeMode === "static-demo" || !world) return;
    setBusy(true);
    try {
      const data = await postV1<{
        runtime: PersistentTownRuntime;
        queue: TownEmergenceQueue;
        world: WorldState;
        campaignRecovery: CampaignRecoveryPublicSummary;
        factionRelationship?: FactionRelationshipPublicSummary;
        worldEventOffer?: WorldEventOfferPublicSummary;
      }>("/api/v1/command/town/runtime/step", {
        worldId: world.id,
        steps: 0,
        campaignRecoveryDecision: { choice }
      });
      setTownRuntime(data.runtime);
      setTownQueue(data.queue);
      setWorld(data.world);
      setCampaignRecovery(data.campaignRecovery);
      if (data.factionRelationship) setFactionRelationship(data.factionRelationship);
      if (data.worldEventOffer) setWorldEventOffer(data.worldEventOffer);
      appendGuidedStepJournal({
        journalKey: `campaign-recovery-${choice}`,
        step: "submit",
        label: choice === "start" ? "Campaign recovery started" : "Campaign recovery deferred",
        status: choice === "start" && data.campaignRecovery.status === "completed" ? "done" : "info",
        result: data.campaignRecovery.progressLabel,
        progressDelta: data.campaignRecovery.costLabel,
        nextAction: data.campaignRecovery.nextAction
      });
      setStatus(choice === "start" ? data.campaignRecovery.progressLabel : "Recovery deferred; the certified case path remains available.");
      if (choice === "start") campaignStudy.recordRecoveryStarted();
      else campaignStudy.recordWorldChoice("campaign-recovery");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update campaign recovery.");
    } finally {
      setBusy(false);
    }
  }
  async function resolveWorldLeadAfterStep(kind: GuidedManualStepKind) {
    if (worldLead?.status !== "followed" || worldLead.focus !== kind) return;
    await updateWorldLeadDecision("resolve");
  }
  async function startReplayGoalAttempt() {
    if (!world || !activeCase) return;
    const stamp = new Date().toISOString();
    const previousJournalStepCount = new Set(guidedStepJournal.filter((entry) => entry.status === "done").map((entry) => entry.step)).size;
    const previousFallbackUsed = replayGoalCoach?.previousFallbackUsed
      ?? Boolean(solvedCaseDebrief?.fallbackUsed || guidedStepJournal.some((entry) => entry.fallbackUsed));
    setReplayGoalAttempt({
      active: true,
      previousGuidedSteps: replayGoalCoach?.previousGuidedSteps ?? solvedCaseDebrief?.manualStepsCompleted ?? previousJournalStepCount,
      previousFallbackUsed,
      previousFallbackTheoryFieldCount: replayGoalCoach?.previousFallbackTheoryFieldCount ?? (previousFallbackUsed ? 3 : 0),
      previousSelectedEvidenceCount: replayGoalCoach?.previousSelectedEvidenceCount ?? solvedCaseDebrief?.selectedEvidenceCount ?? session?.submittedTheory?.evidenceIds.length ?? 0,
      previousProofGapCount: replayGoalCoach?.previousProofGapCount ?? solvedCaseDebrief?.proofGapCount ?? sourceReviewUnlock?.proofGapCount ?? 0,
      previousSourceReviewUnlocked: replayGoalCoach?.previousSourceReviewUnlocked ?? Boolean(solvedCaseDebrief?.sourceReviewUnlocked || sourceReviewUnlock?.unlocked),
      manualEvidencePickCount: 0,
      fallbackEvidencePickCount: 0,
      manualTheoryFieldCount: 0,
      fallbackTheoryFieldCount: 0,
      blockedTheoryGapCount: 0,
      theoryFallbackApproved: false,
      startedAt: stamp,
      lastResult: "replay attempt started"
    });
    setGuidedStepJournal([]);
    setWorldLead(null);
    setGuidedManualLastResult("replay attempt started");
    setTheory({ culpritId: "", motive: "", method: "", evidenceIds: [] });
    setRevealText("");
    setSelectedEvidenceId("");
    setServerPlaythroughSummary(null);
    setInspectorTab("investigation");
    if (runtimeMode === "static-demo") {
      const replaySession: PlayerSession = {
        id: `static-replay-session-${Date.now()}`,
        worldId: world.id,
        caseId: activeCase.id,
        playerId: "static-player",
        displayName: playerName.trim() || "Investigator",
        discoveredEvidenceIds: [],
        interrogationLog: [],
        createdAt: stamp,
        updatedAt: stamp
      };
      setSession(replaySession);
      setSessions([replaySession]);
      setProgress({
        observedCrimeWindow: true,
        joinedInvestigation: true,
        discoveredEvidence: false,
        challengedTestimony: false,
        submittedTheory: false,
        solvedCase: false
      });
      persist(world.id, replaySession.id);
      setSelectedSceneId(activeCase.generationProfile.sceneLocationId);
      pushToast({ tone: "info", title: "Replay attempt started", detail: "Try fewer guided clicks and choose evidence manually before submit." });
      setStatus("Replay attempt started in Static Runtime. No /api/* calls were made.");
      return;
    }
    const optimisticSession: PlayerSession = {
      id: `session-replay-pending-${Date.now()}`,
      worldId: world.id,
      caseId: activeCase.id,
      playerId: "player-replay-pending",
      displayName: playerName.trim() || "Investigator",
      discoveredEvidenceIds: [],
      interrogationLog: [],
      createdAt: stamp,
      updatedAt: stamp
    };
    setSession(optimisticSession);
    setProgress({
      observedCrimeWindow: true,
      joinedInvestigation: true,
      discoveredEvidence: false,
      challengedTestimony: false,
      submittedTheory: false,
      solvedCase: false
    });
    persist(world.id, optimisticSession.id);
    setBusy(true);
    try {
      const data = await postJson<{ session: PlayerSession }>("/api/players/join", {
        worldId: world.id,
        caseId: activeCase.id,
        displayName: playerName.trim() || "Investigator"
      });
      setSession(data.session);
      setSessions((items) => [data.session, ...items.filter((item) => item.id !== data.session.id)]);
      persist(world.id, data.session.id);
      setReplayGoalAttempt((current) => current ? { ...current, lastResult: "server replay session joined" } : current);
      pushToast({ tone: "info", title: "Server replay attempt started", detail: "A fresh local investigation session is ready." });
      setStatus("Server replay attempt started using the existing local join flow.");
    } catch (error) {
      setReplayGoalAttempt((current) => current ? { ...current, lastResult: "replay attempt blocked" } : current);
      setStatus(error instanceof Error ? error.message : "Failed to start replay attempt");
    } finally {
      setBusy(false);
    }
  }
  const mapInteractiveTargets: MapInteractiveTarget[] = useMemo(
    () => (world ? deriveMapInteractiveTargets(world, activeCase || undefined, events, session) : []),
    [activeCase, events, session, world]
  );
  const authoringReport: AuthoringValidationReport = useMemo(() => validateAuthoringDraft(authoringDraft), [authoringDraft]);
  const builtInGalleryEntries = useMemo(
    () => caseTemplates.map((template) => createCaseGalleryEntry(createPremiumAuthoringDraft(template.id), { source: "built-in", templateId: template.id })),
    []
  );
  const authoringCase = authoringDraft.caseFromLog.deductionCase;
  const authoringCharacters = authoringCase.characters.filter((character) => character.role !== "\u6b7b\u8005");
  const authoringCharacter = authoringCase.characters.find((character) => character.id === authoringCharacterId) || authoringCharacters[0] || authoringCase.characters[0];
  const authoringEvidence = authoringCase.evidence.find((item) => item.id === authoringEvidenceId) || authoringCase.evidence[0];
  const authoringScene = authoringCase.scenes.find((item) => item.id === authoringSceneId) || authoringCase.scenes[0];
  const authoringTimelineEvent = authoringCase.truth.trueTimeline.find((item) => item.id === authoringTimelineId) || authoringCase.truth.trueTimeline[0];
  const contentAuthoringGuide = useMemo(
    () => buildDetectiveContentAuthoringGuide(detectiveContentPack, authoringDraft, contentSelection),
    [authoringDraft, contentSelection]
  );
  const pendingSafeDiff = useMemo(
    () => contentAuthoringGuide.patches
      .map((patch) => safeDiffItem(patch.path, patch.before, patch.after, patch.label))
      .filter((item): item is SafeDiffItem => Boolean(item)),
    [contentAuthoringGuide.patches]
  );
  const appliedSafeDiff = useMemo(
    () => contentSeedHistory[0] ? buildAppliedSafeDiff(contentSeedHistory[0].draft, authoringDraft) : [],
    [authoringDraft, contentSeedHistory]
  );
  const authoringChecklist = useMemo(
    () => [
      { label: "Schema", ok: authoringReport.schema.valid, tab: "case" as AuthoringTab },
      { label: "Content Guide", ok: contentAuthoringGuide.coverage.compatibleEvidenceTypeCount > 0 && contentAuthoringGuide.coverage.compatibleRoleCount > 0, tab: "content" as AuthoringTab },
      { label: "World-backed Evidence", ok: Boolean(authoringDraft.caseFromLog.qualityReport.worldBackedEvidence), tab: "evidence" as AuthoringTab },
      { label: "Memory-scoped Testimony", ok: Boolean(authoringDraft.caseFromLog.qualityReport.memoryScopedTestimony), tab: "characters" as AuthoringTab },
      { label: "Hard Logic", ok: authoringReport.hardLogicValid, tab: "logic" as AuthoringTab },
      { label: "Playable Runtime", ok: authoringReport.valid, tab: "logic" as AuthoringTab }
    ],
    [authoringDraft.caseFromLog.qualityReport.memoryScopedTestimony, authoringDraft.caseFromLog.qualityReport.worldBackedEvidence, authoringReport.hardLogicValid, authoringReport.schema.valid, authoringReport.valid, contentAuthoringGuide.coverage.compatibleEvidenceTypeCount, contentAuthoringGuide.coverage.compatibleRoleCount]
  );
  const authoringProofAudit = useMemo(() => {
    const trace = buildEmergenceProofTrace(authoringDraft.world, authoringDraft.events, authoringDraft.caseFromLog, {
      solved: true,
      discoveredEvidenceIds: authoringDraft.caseFromLog.deductionCase.evidence.map((item) => item.id)
    });
    const tour = buildPlayerProofTour(authoringDraft.caseFromLog, authoringDraft.events, trace, {
      id: "authoring-proof-audit",
      worldId: authoringDraft.world.id,
      caseId: authoringDraft.caseFromLog.id,
      playerId: "author",
      displayName: "Author",
      discoveredEvidenceIds: authoringDraft.caseFromLog.deductionCase.evidence.map((item) => item.id),
      interrogationLog: [],
      judgement: { accepted: true, score: 100, missing: [], contradictions: [], explanation: "Authoring proof audit" },
      createdAt: authoringDraft.updatedAt,
      updatedAt: authoringDraft.updatedAt
    });
    return {
      valid: trace.complete && trace.evaluation.proofComplete && tour.some((step) => step.stage === "conclusion" && step.complete),
      trace,
      tour
    };
  }, [authoringDraft]);
  const authoringBlocker = authoringReport.issues.find((item) => item.severity === "error");
  const authoringWorkflowCoach = useMemo(() => {
    const latestSeed = contentSeedHistory[0];
    const pendingPatchCount = contentAuthoringGuide.patches.length;
    const backupAvailable = Boolean(latestSeed && caseGalleryEntries.some((entry) => entry.title === latestSeed.backupTitle));
    const safeDiffActive = Boolean(latestSeed) || (contentSeedPreviewed && pendingSafeDiff.length > 0);
    const stages: WorkflowCoachStage[] = workflowCoachStages.map((stage) => {
      if (stage.id === "draft") {
        return { ...stage, status: "done", detail: `${authoringCase.title || "Untitled draft"} is loaded in browser state.` };
      }
      if (stage.id === "content-seed") {
        if (latestSeed) return { ...stage, status: "done", detail: `${latestSeed.patchCount} safe text patches applied from ${latestSeed.caseTypeLabel}.` };
        if (pendingPatchCount > 0) return { ...stage, status: contentSeedPreviewed ? "active" : "ready", detail: `${pendingPatchCount} safe text patches are available for preview.` };
        return { ...stage, status: "ready", detail: "No content seed changes are pending for this selection." };
      }
      if (stage.id === "safe-diff") {
        if (latestSeed) return { ...stage, status: "done", detail: `${appliedSafeDiff.length} applied public-text fields are visible for review.` };
        if (contentSeedPreviewed && pendingSafeDiff.length > 0) return { ...stage, status: "active", detail: `${pendingSafeDiff.length} pending public-text fields are visible before apply.` };
        if (pendingSafeDiff.length > 0) return { ...stage, status: "ready", detail: "Preview the content seed to inspect the safe diff before applying." };
        return { ...stage, status: "ready", detail: "No safe diff is currently active." };
      }
      if (stage.id === "validation") {
        if (authoringReport.errors.length > 0) return { ...stage, status: "blocked", detail: `${authoringReport.errors.length} blocker(s), ${authoringReport.warnings.length} warning(s).` };
        return { ...stage, status: "done", detail: `Validation pass with ${authoringReport.warnings.length} warning(s).` };
      }
      if (stage.id === "run-draft") {
        if (authoringReport.valid) return { ...stage, status: "ready", detail: "Run Draft is available for the current browser-local case." };
        return { ...stage, status: "blocked", detail: "Run Draft is disabled until validation blockers are fixed." };
      }
      if (stage.id === "gallery-backup") {
        if (backupAvailable && latestSeed) return { ...stage, status: "done", detail: `Backup available: ${latestSeed.backupTitle}.` };
        if (latestSeed) return { ...stage, status: "active", detail: "Seed history is active; Gallery backup is expected in local browser storage." };
        return { ...stage, status: "ready", detail: "A Gallery backup will be created before any non-empty seed apply." };
      }
      return { ...stage, status: "ready", detail: "" };
    });

    let nextAction: WorkflowCoachNextAction;
    if (authoringBlocker) {
      nextAction = {
        label: "Fix validation blocker",
        detail: safeCoachMessage(authoringBlocker.message),
        tone: "blocked"
      };
    } else if (latestSeed) {
      nextAction = {
        label: "Review applied safe diff",
        detail: latestSeed.validation.valid
          ? "Applied diff is clean. You can Undo Content Seed, load the Gallery backup, Run Draft, or save the current draft."
          : `${latestSeed.validation.errorCount} blocker(s) remain after apply.`,
        tone: latestSeed.validation.valid ? "done" : "blocked"
      };
    } else if (pendingPatchCount > 0 && !contentSeedPreviewed) {
      nextAction = {
        label: "Preview Content Seed",
        detail: `${pendingPatchCount} browser-local safe text patches can be reviewed before apply.`,
        tone: "active"
      };
    } else if (pendingPatchCount > 0) {
      nextAction = {
        label: "Review pending safe diff",
        detail: `${pendingSafeDiff.length} public-text fields are ready for apply or selection changes.`,
        tone: "active"
      };
    } else if (authoringReport.valid) {
      nextAction = {
        label: "Run Draft or Save to Gallery",
        detail: "The current draft passes validation and can move to runtime or browser-local reuse.",
        tone: "ready"
      };
    } else {
      nextAction = {
        label: "Review Rule Report",
        detail: "Check validation issues before running the draft.",
        tone: "blocked"
      };
    }

    return { stages, nextAction, backupAvailable, safeDiffActive };
  }, [
    appliedSafeDiff.length,
    authoringBlocker,
    authoringCase.title,
    authoringReport.errors.length,
    authoringReport.valid,
    authoringReport.warnings.length,
    caseGalleryEntries,
    contentAuthoringGuide.patches.length,
    contentSeedHistory,
    contentSeedPreviewed,
    pendingSafeDiff.length
  ]);
  const authoringMapSnapshot = useMemo(
    () => buildWorldMapSnapshot(authoringDraft.world, authoringDraft.events, authoringDraft.caseFromLog, undefined, { day: 1, time: minutesToTime(timeValue) }),
    [authoringDraft, timeValue]
  );
  const mapActorsByTile = useMemo(() => {
    const result = new Map<string, WorldMapActor[]>();
    for (const actor of snapshot?.actors || []) {
      const key = `${actor.x}:${actor.y}`;
      result.set(key, [...(result.get(key) || []), actor]);
    }
    return result;
  }, [snapshot]);
  const mapMarkersByTile = useMemo(() => {
    const result = new Map<string, WorldMapMarker[]>();
    for (const marker of snapshot?.markers || []) {
      const key = `${marker.x}:${marker.y}`;
      result.set(key, [...(result.get(key) || []), marker]);
    }
    return result;
  }, [snapshot]);
  const agentApiExample = useMemo(
    () =>
      JSON.stringify(
        {
          createTown: { method: "POST", url: "/api/v1/command/town/create", body: { seed: seedInput, mode, caseMode, caseTemplateId, npcCount: mode === "advanced" ? 30 : caseMode === "generated" ? 20 : 8, timelineHours: mode === "advanced" ? 120 : 24, caseArchetype } },
          mapSnapshot: world ? { method: "GET", url: `/api/v1/query/world/map?worldId=${world.id}&caseId=${activeCase?.id || ""}&sessionId=${session?.id || ""}&day=1&time=${minutesToTime(timeValue)}` } : null,
          deductionGraph: activeCase ? { method: "GET", url: `/api/v1/query/case/deduction-graph?caseId=${activeCase.id}` } : null,
          interrogate: session ? { method: "POST", url: "/api/v1/command/investigation/interrogate", body: { sessionId: session.id, characterId: selectedCharacterId, question, evidenceId: selectedEvidenceId || undefined } } : null
        },
        null,
        2
      ),
    [activeCase?.id, caseArchetype, caseMode, caseTemplateId, mode, question, seedInput, selectedCharacterId, selectedEvidenceId, session?.id, timeValue, world]
  );

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const savedDraft = loadLocal<AuthoringDraft | null>(authoringStorageKey, null);
    if (savedDraft?.caseFromLog?.deductionCase) setAuthoringDraft(savedDraft);
    setCaseGalleryEntries(loadLocal<CaseGalleryEntry[]>(caseGalleryStorageKey, []));
    setCaseGalleryLoaded(true);
    const selectedRuntime = resolveRuntimeMode();
    setRuntimeMode(selectedRuntime);
    const saved = loadLocal<{ worldId?: string; sessionId?: string; runtimeState?: DemoRuntimeState }>(storageKey, {});
    if (selectedRuntime === "static-demo") {
      hydrateStatic(saved.runtimeState?.mode === "static-demo" ? saved.runtimeState : createStaticDemoRuntime(caseTemplateId));
      return;
    }
    if (saved.worldId) setWorldIdInput(saved.worldId);
    fetch(apiUrl("/api/ai/live-eval/latest"))
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.ok) setLatestLiveEval(data.report);
      })
      .catch(() => undefined);
    void createWorld("server");
  }, []);

  useEffect(() => {
    if (!authoringCharacterId && authoringCharacters[0]) setAuthoringCharacterId(authoringCharacters[0].id);
    if (!authoringEvidenceId && authoringCase.evidence[0]) setAuthoringEvidenceId(authoringCase.evidence[0].id);
    if (!authoringSceneId && authoringCase.scenes[0]) setAuthoringSceneId(authoringCase.scenes[0].id);
    if (!authoringTimelineId && authoringCase.truth.trueTimeline[0]) setAuthoringTimelineId(authoringCase.truth.trueTimeline[0].id);
  }, [authoringCase, authoringCharacterId, authoringCharacters, authoringEvidenceId, authoringSceneId, authoringTimelineId]);

  useEffect(() => {
    setGuidedStepJournal([]);
    setGuidedManualLastResult("ready");
    setWorldLead(null);
    setWorldLeadOutcome(null);
    setReplayGoalAttempt(null);
  }, [activeCase?.id, runtimeMode]);

  useEffect(() => {
    localStorage.setItem(authoringStorageKey, JSON.stringify(authoringDraft));
  }, [authoringDraft]);

  useEffect(() => {
    if (!caseGalleryLoaded) return;
    localStorage.setItem(caseGalleryStorageKey, JSON.stringify(caseGalleryEntries));
  }, [caseGalleryEntries, caseGalleryLoaded]);

  useEffect(() => {
    if (!world) {
      setSnapshot(null);
      return;
    }
    if (runtimeMode === "static-demo" && activeCase) {
      setSnapshot(buildWorldMapSnapshot(world, events, activeCase, session || undefined, { day: 1, time: minutesToTime(timeValue) }));
      return;
    }
    const query = new URLSearchParams({
      worldId: world.id,
      day: "1",
      time: minutesToTime(timeValue)
    });
    if (activeCase?.id) query.set("caseId", activeCase.id);
    if (session?.id) query.set("sessionId", session.id);
    getV1<{ snapshot: WorldMapSnapshot }>(`/api/v1/query/world/map?${query.toString()}`)
      .then((data) => setSnapshot(data.snapshot))
      .catch(() => {
        setSnapshot(buildWorldMapSnapshot(world, events, activeCase || undefined, session || undefined, { day: 1, time: minutesToTime(timeValue) }));
      });
  }, [activeCase, events, runtimeMode, session, timeValue, world]);

  useEffect(() => {
    if (!activeCase?.id) {
      setDeductionGraph(null);
      setSuspectBoard([]);
      setLogicReport(null);
      return;
    }
    if (runtimeMode === "static-demo" && world) {
      setDeductionGraph(buildDeductionGraph(activeCase, events));
      setSuspectBoard(deriveSuspectBoard(activeCase, events));
      setLogicReport(buildCaseLogicReport(world, events, activeCase));
      return;
    }
    getV1<{ graph: DeductionGraph; suspectBoard: SuspectBoardRow[]; logicReport: CaseLogicReport }>(`/api/v1/query/case/deduction-graph?caseId=${activeCase.id}`)
      .then((data) => {
        setDeductionGraph(data.graph);
        setSuspectBoard(data.suspectBoard);
        setLogicReport(data.logicReport);
      })
      .catch(() => undefined);
  }, [activeCase, events, runtimeMode, world]);

  useEffect(() => {
    if (appMode !== "persistent-town" || runtimeMode === "static-demo" || !world?.id) return;
    void refreshTownRuntime(world.id, selectedCharacterId).catch((error) => setStatus(error instanceof Error ? error.message : "Failed to refresh persistent town"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appMode, runtimeMode, selectedCharacterId, world?.id]);

  useEffect(() => {
    if (runtimeMode !== "static-demo" || !world || !activeCase || !session) return;
    const runtimeState: DemoRuntimeState = { mode: "static-demo", world, events, activeCase, session, progress, revealText };
    localStorage.setItem(storageKey, JSON.stringify({ worldId: world.id, sessionId: session.id, runtimeState }));
  }, [activeCase, events, progress, revealText, runtimeMode, session, world]);

  useEffect(() => {
    if (runtimeMode !== "static-demo" || !world || !activeCase || !session || timeValue < timeToMinutes("21:47") || progress.observedCrimeWindow) return;
    hydrateStatic(markDemoCrimeObserved({ mode: "static-demo", world, events, activeCase, session, progress, revealText }), false);
  }, [activeCase, events, progress, revealText, runtimeMode, session, timeValue, world]);

  useEffect(() => {
    if (!replaying || !world) return;
    const timer = window.setInterval(() => {
      setTimeValue((value) => {
        const next = value + 10;
        if (next >= timeMax) {
          setReplaying(false);
          return timeMax;
        }
        return next;
      });
    }, 700);
    return () => window.clearInterval(timer);
  }, [replaying, world]);

  useEffect(() => {
    if (!selectionHighlight.locationId && !selectionHighlight.characterId && !selectionHighlight.evidenceId && !selectionHighlight.eventId) return;
    const timer = window.setTimeout(() => setSelectionHighlight({}), 1800);
    return () => window.clearTimeout(timer);
  }, [selectionHighlight]);

  useEffect(() => {
    if (!toasts.length) return;
    const timer = window.setTimeout(() => {
      setToasts((current) => current.slice(0, -1));
    }, 3800);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  function highlightSelection(next: SelectionHighlight) {
    setSelectionHighlight(next);
  }

  function persist(nextWorldId?: string, nextSessionId?: string) {
    localStorage.setItem(storageKey, JSON.stringify({ worldId: nextWorldId || world?.id, sessionId: nextSessionId || session?.id }));
  }

  function hydrateStatic(state: DemoRuntimeState, resetTime = true) {
    setWorld(state.world);
    setEvents(state.events);
    setActiveCase(state.activeCase);
    setSession(state.session);
    setSessions([state.session]);
    setProgress(state.progress);
    setRevealText(state.revealText);
    setWorldIdInput(state.world.id);
    setSelectedSceneId(state.activeCase.generationProfile.sceneLocationId);
    const firstCharacter = state.activeCase.deductionCase.characters.find((item) => item.role !== "\u6b7b\u8005");
    setSelectedCharacterId((current) => current || firstCharacter?.id || "");
    if (resetTime) setTimeValue(timeToMinutes("08:00"));
    setStatus("Premium Showcase loaded. Drag the time rail to observe the case, then search scenes and question witnesses.");
  }

  function currentStaticState(): DemoRuntimeState | null {
    if (!world || !activeCase || !session) return null;
    return { mode: "static-demo", world, events, activeCase, session, progress, revealText };
  }

  function hydrateCase(data: { world: WorldState; events?: WorldEvent[]; activeCase?: CaseFromLog; sessions?: PlayerSession[] }) {
    setWorld(data.world);
    setTownRuntime((data.world as WorldState & { persistentRuntime?: PersistentTownRuntime }).persistentRuntime || null);
    if (data.events) setEvents(data.events);
    if (data.activeCase) {
      setActiveCase(data.activeCase);
      setSelectedSceneId(data.activeCase.generationProfile.sceneLocationId);
      const firstCharacter = data.activeCase.deductionCase.characters.find((item) => item.role !== "\u6b7b\u8005");
      setSelectedCharacterId(firstCharacter?.id || data.activeCase.generationProfile.culpritId);
      setTheory({ culpritId: "", motive: "", method: "", evidenceIds: [] });
      setServerPlaythroughSummary(null);
      setTimeValue(timeToMinutes("08:00"));
    }
    if (data.sessions) setSessions(data.sessions);
  }

  async function createWorld(forcedRuntime?: RuntimeMode) {
    const targetRuntime = forcedRuntime || runtimeMode;
    if (targetRuntime === "static-demo") {
      hydrateStatic(createStaticDemoRuntime(caseTemplateId));
      setLastAiSafety(null);
      setReplaying(false);
      return;
    }
    setBusy(true);
    try {
      const generatedNpcCount = mode === "advanced" ? 30 : caseMode === "generated" ? 20 : 8;
      const data = await postJson<{ world: WorldState; events: WorldEvent[]; activeCase: CaseFromLog }>("/api/worlds/create", {
        seed: seedInput.trim() || (caseMode === "premium" ? "premium-showcase" : "showcase-seed"),
        mode,
        caseMode: mode === "showcase" ? caseMode : "generated",
        caseTemplateId,
        npcCount: generatedNpcCount,
        timelineHours: mode === "advanced" ? 120 : 24,
        preSimDays: mode === "advanced" ? 5 : 1,
        caseArchetype
      });
      hydrateCase(data);
      setWorldIdInput(data.world.id);
      setSession(null);
      setSessions([]);
      setRevealText("");
      setLastAiSafety(null);
      setProgress(initialProgress);
      setReplaying(false);
      persist(data.world.id, "");
      setStatus("Detective Town created: map, events, memories, and evidence were generated from the simulated world.");
      setTownRuntime(null);
      setTownQueue(null);
      setSelectedAgentCandidates([]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create town");
    } finally {
      setBusy(false);
    }
  }

  async function loadWorld() {
    if (runtimeMode === "static-demo") {
      setStatus("Static demo uses a built-in deterministic world. Switch to Server Runtime to load a SQLite world.");
      return;
    }
    if (!worldIdInput.trim()) return;
    setBusy(true);
    try {
      const state = await fetch(apiUrl(`/api/worlds/${worldIdInput.trim()}/state`)).then((response) => response.json());
      if (!state.ok) throw new Error(state.error || "Failed to read town");
      const eventResult = await fetch(apiUrl(`/api/worlds/${worldIdInput.trim()}/events`)).then((response) => response.json());
      hydrateCase({ world: state.world, activeCase: state.activeCase, sessions: state.sessions || [], events: eventResult.events || [] });
      persist(state.world.id, session?.id);
      setStatus("Existing Detective Town loaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to read town");
    } finally {
      setBusy(false);
    }
  }

  async function joinCase() {
    if (!world || !activeCase) return;
    if (runtimeMode === "static-demo") {
      if (!session) {
        const stamp = new Date().toISOString();
        const staticSession: PlayerSession = {
          id: `static-session-${Date.now()}`,
          worldId: world.id,
          caseId: activeCase.id,
          playerId: "static-player",
          displayName: playerName.trim() || "Investigator",
          discoveredEvidenceIds: [],
          interrogationLog: [],
          createdAt: stamp,
          updatedAt: stamp
        };
        setSession(staticSession);
        persist(world.id, staticSession.id);
      }
      setProgress((current) => ({ ...current, joinedInvestigation: true }));
      setStatus("Joined investigation. Click map locations for evidence and select NPCs to question.");
      return;
    }
    const stamp = new Date().toISOString();
    const optimisticSession: PlayerSession = {
      id: `session-pending-${Date.now()}`,
      worldId: world.id,
      caseId: activeCase.id,
      playerId: "player-pending",
      displayName: playerName.trim() || "Investigator",
      discoveredEvidenceIds: [],
      interrogationLog: [],
      createdAt: stamp,
      updatedAt: stamp
    };
    setSession(optimisticSession);
    setProgress((current) => ({ ...current, joinedInvestigation: true }));
    persist(world.id, optimisticSession.id);
    setStatus("Joined investigation. Click map locations for evidence and NPCs for questioning.");
    setBusy(true);
    try {
      const data = await postJson<{ session: PlayerSession; playerResourceCommitment?: PlayerResourceCommitmentPublicSummary; factionRelationship?: FactionRelationshipPublicSummary; investigatorProgression?: InvestigatorProgressionPublicSummary }>("/api/players/join", { worldId: world.id, caseId: activeCase.id, displayName: playerName.trim() || "Investigator" });
      setSession(data.session);
      if (data.playerResourceCommitment) setPlayerResourceCommitment(data.playerResourceCommitment);
      if (data.factionRelationship) setFactionRelationship(data.factionRelationship);
      if (data.investigatorProgression) setInvestigatorProgression(data.investigatorProgression);
      setProgress((current) => ({ ...current, joinedInvestigation: true }));
      setSessions((items) => [data.session, ...items.filter((item) => item.id !== data.session.id)]);
      persist(world.id, data.session.id);
      setStatus("Joined investigation. Click map locations for evidence and NPCs for questioning.");
      campaignStudy.recordMeaningfulAction();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to join investigation");
    } finally {
      setBusy(false);
    }
  }

  async function tickWorld() {
    if (!world) return;
    if (runtimeMode === "static-demo") {
      setStatus("Static demo is fixed to the 24-hour Premium case. Use the time rail for playback.");
      return;
    }
    setBusy(true);
    try {
      const data = await postJson<{ world: WorldState; events: WorldEvent[]; activeCase: CaseFromLog }>(`/api/worlds/${world.id}/tick`, {});
      setWorld(data.world);
      setEvents((items) => [...items, ...data.events]);
      setActiveCase(data.activeCase);
      setRevealText("");
      setStatus(`Town advanced to day ${data.world.day}; new events were written to the log.`);
      campaignStudy.recordMeaningfulAction();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to advance town");
    } finally {
      setBusy(false);
    }
  }

  function selectScenarioRunFromRuntime(runtime: PersistentTownRuntime | null | undefined, scenarioId?: string | null, forceSnapshots = false) {
    const runs = runtime?.scenarioRuns || [];
    const nextRun = (scenarioId ? runs.find((item) => item.id === scenarioId) : null) || runs[0] || null;
    setScenarioRun(nextRun);
    setScenarioReport(nextRun?.report || null);
    if (!nextRun) return;
    const availableSnapshotIds = new Set((runtime?.snapshots || []).map((snapshot) => snapshot.id));
    const nextFromId = nextRun.report.baseline.startSnapshotId;
    const nextToId = nextRun.report.baseline.endSnapshotId;
    if (forceSnapshots || !availableSnapshotIds.has(selectedSnapshotFromId) || !availableSnapshotIds.has(selectedSnapshotToId)) {
      setSelectedSnapshotFromId(nextFromId);
      setSelectedSnapshotToId(nextToId);
      setReviewExportTarget({ fromId: nextFromId, toId: nextToId });
    }
  }

  async function loadScenarioArtifacts(targetWorldId: string) {
    const data = await getV1<{ presets: ScenarioPreset[]; runs: ScenarioRunSummary[] }>(`/api/v1/query/town/scenarios?worldId=${encodeURIComponent(targetWorldId)}`);
    setScenarioPresets(data.presets);
    setScenarioRuns(data.runs);
    setSelectedScenarioPresetId((current) => {
      if (current && data.presets.some((preset) => preset.id === current)) return current;
      return data.presets[0]?.id || "";
    });
    return data;
  }

  async function loadScenarioPacks(targetWorldId: string) {
    const data = await getV1<{ packs: Array<ScenarioPack & { builtIn?: boolean; source?: string; experimentId?: string; experimentHash?: string; experimentPathHash?: string; validation?: { ok: boolean } }> }>(`/api/v1/query/town/scenario-packs?worldId=${encodeURIComponent(targetWorldId)}`);
    setScenarioPacks(data.packs);
    setSelectedScenarioPackId((current) => {
      if (current && data.packs.some((pack) => pack.manifest.id === current)) return current;
      return data.packs[0]?.manifest.id || "";
    });
    return data;
  }

  async function loadRunCatalog(targetWorldId: string, runtime?: PersistentTownRuntime | null) {
    const data = await getV1<{ runs: RunCatalogEntry[] }>(`/api/v1/query/town/runs?worldId=${encodeURIComponent(targetWorldId)}`);
    setRunCatalog(data.runs);
    setRunJobs(runtime?.runJobs || []);
    setSelectedRunCatalogId((current) => {
      if (current && data.runs.some((run) => run.runId === current)) return current;
      return data.runs[0]?.runId || "";
    });
    return data;
  }

  async function loadRuleState(targetWorldId: string) {
    const [ruleData, lifecycleData] = await Promise.all([
      getV1<{ ruleState: TownRuleSnapshotSummary }>(`/api/v1/query/town/rule-state?worldId=${encodeURIComponent(targetWorldId)}`),
      getV1<{ lifecycle: TownCaseLifecycleState }>(`/api/v1/query/town/case-lifecycle?worldId=${encodeURIComponent(targetWorldId)}`)
    ]);
    setTownRuleState(ruleData.ruleState);
    setTownCaseLifecycle(lifecycleData.lifecycle);
  }

  async function refreshTownRuntime(targetWorldId = world?.id, targetNpcId = selectedCharacterId, preferredScenarioId?: string | null, forceScenarioSnapshots = false) {
    if (!targetWorldId || runtimeMode === "static-demo") return;
    const runtimeData = await getV1<{ runtime: PersistentTownRuntime; queue: TownEmergenceQueue }>(`/api/v1/query/town/runtime?worldId=${encodeURIComponent(targetWorldId)}`);
    setTownRuntime(runtimeData.runtime);
    setTownQueue(runtimeData.queue);
    setWorldArc(runtimeData.runtime.worldArcSummary || null);
    setWorldArcDirective(runtimeData.runtime.worldArcDirectiveSummary || null);
    setWorldPressureCascade(runtimeData.runtime.worldPressureCascadeSummary || null);
    setWorldInfluenceBudget(runtimeData.runtime.worldInfluenceBudgetSummary || null);
    setPlayerResourceCommitment(runtimeData.runtime.playerResourceCommitmentSummary || null);
    setFactionRelationship(runtimeData.runtime.factionRelationshipSummary || null);
    setWorldEventOffer(runtimeData.runtime.worldEventOfferSummary || null);
    setInvestigatorProgression(runtimeData.runtime.investigatorProgressionSummary || null);
    setCampaignRecovery(runtimeData.runtime.campaignRecoverySummary || null);
    setArcConvergence(runtimeData.runtime.arcConvergenceSummary || null);
    setCampaignSession(runtimeData.runtime.campaignSessionSummary || null);
    setCampaignFinaleDebrief(runtimeData.runtime.campaignFinaleDebrief || null);
    setTownSocialResponse(runtimeData.runtime.townSocialResponseSummary || null);
    setTownSnapshots(runtimeData.runtime.snapshots || []);
    selectScenarioRunFromRuntime(runtimeData.runtime, preferredScenarioId || scenarioRun?.id, forceScenarioSnapshots);
    await loadScenarioArtifacts(targetWorldId).catch(() => {
      setScenarioPresets([]);
      setScenarioRuns([]);
    });
    await loadScenarioPacks(targetWorldId).catch(() => setScenarioPacks([]));
    await loadRunCatalog(targetWorldId, runtimeData.runtime).catch(() => {
      setRunCatalog([]);
      setRunJobs(runtimeData.runtime.runJobs || []);
    });
    await loadRuleState(targetWorldId).catch(() => {
      setTownRuleState(null);
      setTownCaseLifecycle(null);
    });
    try {
      const briefData = await getV1<{ brief: TownSituationBrief }>(`/api/v1/query/town/brief?worldId=${encodeURIComponent(targetWorldId)}`);
      setTownBrief(briefData.brief);
    } catch {
      setTownBrief(null);
    }
    const latestSnapshots = runtimeData.runtime.snapshots || [];
    if (!runtimeData.runtime.scenarioRuns?.length) {
      if (!selectedSnapshotFromId && latestSnapshots.length >= 2) setSelectedSnapshotFromId(latestSnapshots[1].id);
      if (!selectedSnapshotToId && latestSnapshots.length >= 1) setSelectedSnapshotToId(latestSnapshots[0].id);
    }
    if (targetNpcId) {
      const agentData = await getV1<{ agent?: NpcAgentState; candidates: NpcActionCandidate[]; trace?: unknown }>(`/api/v1/query/town/agent?worldId=${encodeURIComponent(targetWorldId)}&npcId=${encodeURIComponent(targetNpcId)}`);
      setSelectedAgentCandidates(agentData.candidates || []);
    }
  }

  useEffect(() => {
    if (!world?.id || runtimeMode === "static-demo" || !selectedSnapshotFromId || !selectedSnapshotToId || selectedSnapshotFromId === selectedSnapshotToId) {
      setSnapshotDiff(null);
      return;
    }
    getV1<{ diff: TownStateDiff }>(`/api/v1/query/town/snapshot/diff?worldId=${encodeURIComponent(world.id)}&from=${encodeURIComponent(selectedSnapshotFromId)}&to=${encodeURIComponent(selectedSnapshotToId)}`)
      .then((data) => setSnapshotDiff(data.diff))
      .catch(() => setSnapshotDiff(null));
  }, [runtimeMode, selectedSnapshotFromId, selectedSnapshotToId, world?.id]);

  useEffect(() => {
    if (runtimeMode === "static-demo" || appMode !== "persistent-town" || !world?.id) {
      setBenchmarkSummary(null);
      return;
    }
    getV1<{ available: boolean; report: BenchmarkSummary | null }>("/api/v1/query/benchmark/emergence")
      .then((data) => {
        if (!data.available || !data.report) {
          setBenchmarkSummary(null);
          return;
        }
        setBenchmarkSummary(data.report);
      })
      .catch(() => setBenchmarkSummary(null));
  }, [appMode, runtimeMode, townRuntime?.id, world?.id]);

  async function startPersistentTown() {
    if (!world) return;
    if (runtimeMode === "static-demo") {
      setStatus("Persistent Agent Town uses SQLite server runtime. Switch to Server Runtime first.");
      return;
    }
    setTownRuntimeBusy(true);
    try {
      const data = await postV1<{ runtime: PersistentTownRuntime; events: WorldEvent[]; queue: TownEmergenceQueue; world: WorldState }>("/api/v1/command/town/runtime/start", { worldId: world.id, steps: 1 });
      setTownRuntime(data.runtime);
      setTownQueue(data.queue);
      setWorld(data.world);
      setEvents((items) => [...items, ...data.events]);
      setInspectorTab("agent");
      setAppMode("persistent-town");
      setStatus("Persistent Agent Town started. NPC decisions are now writing WorldEvents.");
      campaignStudy.recordMeaningfulAction();
      await refreshTownRuntime(data.world.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to start Persistent Agent Town");
    } finally {
      setTownRuntimeBusy(false);
    }
  }

  async function pausePersistentTown() {
    if (!world) return;
    setTownRuntimeBusy(true);
    try {
      const data = await postV1<{ runtime: PersistentTownRuntime }>("/api/v1/command/town/runtime/pause", { worldId: world.id });
      setTownRuntime(data.runtime);
      setStatus("Persistent Agent Town paused.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to pause runtime");
    } finally {
      setTownRuntimeBusy(false);
    }
  }

  async function stepPersistentTown(steps = 1) {
    if (!world) return;
    if (runtimeMode === "static-demo") {
      setStatus("Persistent Agent Town uses SQLite server runtime. Switch to Server Runtime first.");
      return;
    }
    setTownRuntimeBusy(true);
    try {
      const data = await postV1<{ runtime: PersistentTownRuntime; events: WorldEvent[]; queue: TownEmergenceQueue; world: WorldState; worldArcDirective?: WorldArcDirectivePublicSummary; worldPressureCascade?: WorldPressureCascadePublicSummary; playerResourceCommitment?: PlayerResourceCommitmentPublicSummary; factionRelationship?: FactionRelationshipPublicSummary; worldEventOffer?: WorldEventOfferPublicSummary; worldInfluenceBudget?: WorldInfluenceBudgetPublicSummary; investigatorProgression?: InvestigatorProgressionPublicSummary; campaignRecovery?: CampaignRecoveryPublicSummary; arcConvergence?: ArcConvergencePublicSummary; campaignSession?: CampaignSessionPublicSummary; campaignFinaleDebrief?: CampaignFinaleDebriefPublicSummary; townSocialResponse?: TownSocialResponsePublicSummary }>("/api/v1/command/town/runtime/step", { worldId: world.id, steps });
      setTownRuntime(data.runtime);
      setTownQueue(data.queue);
      setWorld(data.world);
      if (data.worldArcDirective) {
        const previousDirectiveStatus = worldArcDirective?.status;
        setWorldArcDirective(data.worldArcDirective);
        if (previousDirectiveStatus !== data.worldArcDirective.status && ["running", "blocked", "completed"].includes(data.worldArcDirective.status)) {
          appendGuidedStepJournal({
            journalKey: `world-arc-directive-${data.worldArcDirective.status}`,
            step: "submit",
            label: data.worldArcDirective.status === "running"
              ? "Faction directive started"
              : data.worldArcDirective.status === "completed"
                ? "Faction directive completed"
                : "Faction directive blocked",
            status: data.worldArcDirective.status === "blocked" ? "blocked" : "done",
            result: data.worldArcDirective.status === "completed"
              ? "The selected response is now durable town history."
              : data.worldArcDirective.progressLabel,
            progressDelta: data.worldArcDirective.operationLabel,
            nextAction: data.worldArcDirective.nextAction
          });
        }
      }
      if (data.worldPressureCascade) {
        const previousPressureStatus = worldPressureCascade?.status;
        setWorldPressureCascade(data.worldPressureCascade);
        if (data.worldPressureCascade.status === "active" && previousPressureStatus !== "active") {
          appendGuidedStepJournal({
            journalKey: "world-pressure-active",
            step: "submit",
            label: "World pressure activated",
            status: "done",
            result: `${data.worldPressureCascade.directionLabel} now carries into future, unextracted cases.`,
            progressDelta: `${data.worldPressureCascade.remainingLayers} bounded layer(s) remain.`,
            nextAction: data.worldPressureCascade.nextAction
          });
        }
      }
      if (data.worldInfluenceBudget) setWorldInfluenceBudget(data.worldInfluenceBudget);
      if (data.playerResourceCommitment) setPlayerResourceCommitment(data.playerResourceCommitment);
      if (data.factionRelationship) {
        const previousChange = factionRelationship?.lastChangeLabel;
        setFactionRelationship(data.factionRelationship);
        if (previousChange !== data.factionRelationship.lastChangeLabel && data.factionRelationship.status === "changed") {
          appendGuidedStepJournal({
            journalKey: `faction-standing-${data.factionRelationship.lastChangeLabel}`,
            step: "submit",
            label: "Faction standing changed",
            status: "done",
            result: data.factionRelationship.lastChangeLabel,
            progressDelta: data.factionRelationship.resourceEffectLabel,
            nextAction: data.factionRelationship.nextAction
          });
        }
      }
      if (data.worldEventOffer) {
        const previousOfferStatus = worldEventOffer?.status;
        setWorldEventOffer(data.worldEventOffer);
        if (previousOfferStatus !== data.worldEventOffer.status && ["offered", "running", "completed", "failed", "expired"].includes(data.worldEventOffer.status)) {
          appendGuidedStepJournal({
            journalKey: `world-event-offer-${data.worldEventOffer.status}`,
            step: "submit",
            label: data.worldEventOffer.status === "offered" ? "World opportunity offered" : `World opportunity ${data.worldEventOffer.status}`,
            status: data.worldEventOffer.status === "failed" || data.worldEventOffer.status === "expired" ? "blocked" : "done",
            result: data.worldEventOffer.progressLabel,
            progressDelta: data.worldEventOffer.status === "completed" ? data.worldEventOffer.recoveryLabel : data.worldEventOffer.benefitLabel,
            nextAction: data.worldEventOffer.nextAction
          });
        }
      }
      if (data.investigatorProgression) setInvestigatorProgression(data.investigatorProgression);
      if (data.campaignRecovery) {
        const previousRecoveryStatus = campaignRecovery?.status;
        setCampaignRecovery(data.campaignRecovery);
        if (previousRecoveryStatus !== data.campaignRecovery.status && ["ready", "completed"].includes(data.campaignRecovery.status)) {
          appendGuidedStepJournal({
            journalKey: `campaign-recovery-${data.campaignRecovery.status}-${data.campaignRecovery.completedCount}`,
            step: "submit",
            label: data.campaignRecovery.status === "ready" ? "Recovery path prepared" : "Campaign recovery completed",
            status: data.campaignRecovery.status === "ready" ? "blocked" : "done",
            result: data.campaignRecovery.failureLabel,
            progressDelta: data.campaignRecovery.progressLabel,
            nextAction: data.campaignRecovery.nextAction
          });
        }
      }
      if (data.arcConvergence) {
        const previousConvergenceStatus = arcConvergence?.status;
        setArcConvergence(data.arcConvergence);
        if (previousConvergenceStatus !== data.arcConvergence.status && ["ready", "active", "completed"].includes(data.arcConvergence.status)) {
          appendGuidedStepJournal({
            journalKey: `arc-convergence-${data.arcConvergence.status}`,
            step: data.arcConvergence.status === "completed" ? "submit" : "search",
            label: data.arcConvergence.status === "ready" ? "Campaign finale formed" : data.arcConvergence.status === "active" ? "Campaign finale activated" : "Campaign convergence completed",
            status: "done",
            result: `${data.arcConvergence.finaleLabel} / ${data.arcConvergence.approachLabel}`,
            progressDelta: `${data.arcConvergence.caseProgressLabel} / ${data.arcConvergence.worldProgressLabel}`,
            nextAction: data.arcConvergence.nextAction
          });
        }
      }
      if (data.campaignSession) setCampaignSession(data.campaignSession);
      if (data.campaignFinaleDebrief) setCampaignFinaleDebrief(data.campaignFinaleDebrief);
      if (data.townSocialResponse) {
        const previousSocialStatus = townSocialResponse?.status;
        const previousProgress = townSocialResponse?.progressLabel;
        setTownSocialResponse(data.townSocialResponse);
        if (data.townSocialResponse.status !== "empty" && (previousSocialStatus !== data.townSocialResponse.status || previousProgress !== data.townSocialResponse.progressLabel)) {
          appendGuidedStepJournal({
            journalKey: `town-social-response-${data.townSocialResponse.status}-${data.townSocialResponse.progressLabel}`,
            step: "submit",
            label: data.townSocialResponse.status === "ready"
              ? "Town response prepared"
              : data.townSocialResponse.status === "settled"
                ? "Town response settled"
                : "Town response surfaced",
            status: "done",
            result: data.townSocialResponse.headline,
            progressDelta: `${data.townSocialResponse.progressLabel} public reactions`,
            nextAction: data.townSocialResponse.nextAction
          });
        }
      }
      setEvents((items) => [...items, ...data.events]);
      setTimeValue(timeToMinutes(data.runtime.currentTime));
      setInspectorTab("agent");
      setAppMode("persistent-town");
      setStatus(`Persistent tick ${data.runtime.tick}: ${data.events.length} WorldEvents added, ${data.queue.candidates.length} candidates in queue.`);
      campaignStudy.recordMeaningfulAction();
      await refreshTownRuntime(data.world.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to step runtime");
    } finally {
      setTownRuntimeBusy(false);
    }
  }

  async function resetPersistentTown() {
    if (!world) return;
    setTownRuntimeBusy(true);
    try {
      const data = await postV1<{ runtime: PersistentTownRuntime }>("/api/v1/command/town/runtime/reset", { worldId: world.id });
      setTownRuntime(data.runtime);
      setTownQueue(null);
      setTownBrief(null);
      setWorldArcDirective(null);
      setWorldPressureCascade(null);
      setTownSocialResponse(data.runtime.townSocialResponseSummary || null);
      setPlayerResourceCommitment(null);
      setSelectedAgentCandidates([]);
      setStatus("Persistent Agent Town runtime reset.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to reset runtime");
    } finally {
      setTownRuntimeBusy(false);
    }
  }

  async function intervenePersistentAgent(kind: TownRuntimeIntervention["kind"] = "resource", value: string | number | boolean = "resource:player-intervention") {
    if (!world || !selectedCharacterId) return;
    setTownRuntimeBusy(true);
    try {
      const data = await postV1<{ runtime: PersistentTownRuntime; intervention: unknown; world: WorldState }>("/api/v1/command/town/agent/intervene", {
        worldId: world.id,
        intervention: { actorId: selectedCharacterId, kind, value }
      });
      setTownRuntime(data.runtime);
      setWorld(data.world);
      setStatus(kind === "action-bias"
        ? `Director action bias applied: ${String(value)} will influence the selected NPC next tick.`
        : "Counterfactual resource intervention applied to selected NPC.");
      await refreshTownRuntime(data.world.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to apply intervention");
    } finally {
      setTownRuntimeBusy(false);
    }
  }

  async function extractPersistentCandidate(candidate: CaseCandidate) {
    if (!world) return;
    const finaleStudyChoiceReady = arcConvergence?.status === "ready";
    setTownRuntimeBusy(true);
    setInspectorTab("investigation");
    setAppMode("play");
    setStatus(`Playable case extracted from candidate ${candidate.id}. Review the Case Intake, then join the investigation.`);
    try {
      const data = await postV1<{
        world: WorldState;
        events: WorldEvent[];
        activeCase: CaseFromLog;
        candidate: CaseCandidate;
        queue: TownEmergenceQueue;
        playableIntake?: PlayableCaseIntake;
        worldLeadCaseHandoff?: WorldLeadCaseHandoffPublicSummary;
        worldArc?: WorldArcPublicSummary;
        worldPressureCascade?: WorldPressureCascadePublicSummary;
        playerResourceCommitment?: PlayerResourceCommitmentPublicSummary;
        worldInfluenceBudget?: WorldInfluenceBudgetPublicSummary;
        arcConvergence?: ArcConvergencePublicSummary;
        campaignSession?: CampaignSessionPublicSummary;
        campaignFinaleDebrief?: CampaignFinaleDebriefPublicSummary;
        townSocialResponse?: TownSocialResponsePublicSummary;
      }>("/api/v1/command/town/case/extract", {
        worldId: world.id,
        candidateId: candidate.id
      });
      hydrateCase({ world: data.world, activeCase: data.activeCase, events: data.events });
      setTownQueue(data.queue);
      if (data.playerResourceCommitment) setPlayerResourceCommitment(data.playerResourceCommitment);
      if (data.worldArc) {
        setWorldArc(data.worldArc);
        appendGuidedStepJournal({
          journalKey: "world-arc",
          step: "join",
          label: data.worldArc.completedStages > 0 ? "World arc resumed" : "World arc activated",
          status: "info",
          result: `${data.worldArc.label} is aligned to the extracted case context.`,
          progressDelta: data.worldArc.progressLabel,
          nextAction: data.worldArc.nextAction
        });
      }
      if (data.worldLeadCaseHandoff) {
        setWorldLeadCaseHandoff(data.worldLeadCaseHandoff);
        appendGuidedStepJournal({
          journalKey: "world-lead-handoff",
          step: "join",
          label: "World lead handoff carried",
          status: "done",
          result: "The settled world lead follow-up was carried into this extracted case without changing its certified route.",
          progressDelta: "The next-case queue preference was consumed after the successful extraction.",
          nextAction: data.worldLeadCaseHandoff.nextAction
        });
      }
      if (data.worldPressureCascade) {
        setWorldPressureCascade(data.worldPressureCascade);
        appendGuidedStepJournal({
          journalKey: "world-pressure-consumed",
          step: "join",
          label: "World pressure carried into next case",
          status: "done",
          result: data.worldPressureCascade.status === "consumed"
            ? "The successful extraction consumed the final bounded pressure layer."
            : "The successful extraction consumed one bounded pressure layer; the current case remains frozen.",
          progressDelta: `${data.worldPressureCascade.remainingLayers} bounded layer(s) remain.`,
          nextAction: data.worldPressureCascade.nextAction
        });
      }
      if (data.worldInfluenceBudget) setWorldInfluenceBudget(data.worldInfluenceBudget);
      if (data.arcConvergence) {
        setArcConvergence(data.arcConvergence);
        if (data.arcConvergence.status === "active") {
          appendGuidedStepJournal({
            journalKey: "arc-convergence-active",
            step: "join",
            label: "Campaign finale activated",
            status: "done",
            result: `${data.arcConvergence.finaleLabel} entered the normal certified case path.`,
            progressDelta: data.arcConvergence.approachLabel,
            nextAction: data.arcConvergence.nextAction
          });
        }
      }
      if (data.campaignSession) {
        setCampaignSession(data.campaignSession);
        appendGuidedStepJournal({
          journalKey: `campaign-session-${data.campaignSession.status}-${data.campaignSession.progressLabel}`,
          step: "submit",
          label: data.campaignSession.status === "completed" ? "Campaign completed" : data.campaignSession.status === "finale-ready" ? "Campaign finale ready" : "Campaign chapter closed",
          status: "done",
          result: data.campaignSession.progressLabel,
          progressDelta: data.campaignSession.primaryActionLabel,
          nextAction: data.campaignSession.nextAction
        });
      }
      if (data.campaignFinaleDebrief) setCampaignFinaleDebrief(data.campaignFinaleDebrief);
      setSession(null);
      setRevealText("");
      setInspectorTab("investigation");
      setAppMode("play");
      setStatus(`Playable case extracted from candidate ${data.candidate.id}. Review the Case Intake, then join the investigation.`);
      campaignStudy.recordMeaningfulAction();
      if (finaleStudyChoiceReady) campaignStudy.recordWorldChoice("finale-case");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to extract playable case");
    } finally {
      setTownRuntimeBusy(false);
    }
  }

  function defaultTownScenarioConfig() {
    const actorId = selectedCharacterId || townRuntime?.agentStates[0]?.npcId || world?.npcs[0]?.id;
    return {
      name: "Default counterfactual scenario",
      seed: `${world?.seed || "town"}-scenario`,
      baselineSteps: 45,
      branches: actorId ? [{
        id: "selected-agent-resource",
        name: "Selected agent resource branch",
        steps: 12,
        interventions: [{ atTickOffset: 1, intervention: { actorId, kind: "resource" as const, value: "resource:scenario-ui" } }]
      }] : [],
      passCriteria: { minValidCandidates: 1, requireHardLogic: true, minEventGrowth: 1, minMemoryGrowth: 1, maxBlockedCandidates: 8 }
    } satisfies ScenarioConfig;
  }

  async function selectScenarioHistoryRun(runId: string) {
    if (!townRuntime) return;
    selectScenarioRunFromRuntime(townRuntime, runId, true);
    const run = townRuntime.scenarioRuns?.find((item) => item.id === runId);
    if (run) {
      setStatus(`Loaded review run ${run.name}. Snapshot diff is now aligned to that run baseline.`);
    }
  }

  async function saveScenarioPresetFromUi(preset: ScenarioPreset, overwrite: boolean) {
    if (!world) return;
    setReviewBusy(true);
    try {
      const data = await postV1<{ preset: ScenarioPreset; presets: ScenarioPreset[]; runs: ScenarioRunSummary[] }>("/api/v1/command/town/scenario/preset/save", {
        worldId: world.id,
        preset,
        overwrite
      });
      setScenarioPresets(data.presets);
      setScenarioRuns(data.runs);
      setSelectedScenarioPresetId(data.preset.id);
      setStatus(`Scenario preset ${data.preset.name} saved.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save scenario preset");
    } finally {
      setReviewBusy(false);
    }
  }

  async function deleteScenarioPresetFromUi(presetId: string) {
    if (!world) return;
    setReviewBusy(true);
    try {
      const data = await postV1<{ presets: ScenarioPreset[]; runs: ScenarioRunSummary[] }>("/api/v1/command/town/scenario/preset/delete", {
        worldId: world.id,
        presetId
      });
      setScenarioPresets(data.presets);
      setScenarioRuns(data.runs);
      setSelectedScenarioPresetId(data.presets[0]?.id || "");
      setStatus(`Scenario preset ${presetId} deleted.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete scenario preset");
    } finally {
      setReviewBusy(false);
    }
  }

  async function exportScenarioPackFromUi() {
    if (!world) return;
    setReviewBusy(true);
    try {
      const data = await postV1<{ pack: ScenarioPack; fileName: string }>("/api/v1/command/town/scenario-pack/export", {
        worldId: world.id,
        packId: selectedScenarioPackId || undefined,
        scenarioId: scenarioRun?.id
      });
      downloadTextFile(data.fileName, JSON.stringify(data.pack, null, 2), "application/json;charset=utf-8");
      setStatus(`ScenarioPack exported: ${data.pack.manifest.name}.`);
      await loadScenarioPacks(world.id).catch(() => undefined);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to export ScenarioPack");
    } finally {
      setReviewBusy(false);
    }
  }

  async function validateScenarioPackFromUi() {
    const pack = scenarioPacks.find((item) => item.manifest.id === selectedScenarioPackId) || scenarioPacks[0];
    if (!pack) return;
    setReviewBusy(true);
    try {
      const data = await postV1<{ validation: { ok: boolean; errors: string[]; warnings: string[] } }>("/api/v1/command/town/scenario-pack/validate", { pack });
      setStatus(data.validation.ok
        ? `ScenarioPack ${pack.manifest.id} is valid.`
        : `ScenarioPack ${pack.manifest.id} failed validation: ${data.validation.errors.join("; ")}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to validate ScenarioPack");
    } finally {
      setReviewBusy(false);
    }
  }

  async function exportReplayBundleFromUi() {
    if (!world) return;
    const runId = selectedRunCatalogId || runCatalog[0]?.runId;
    if (!runId) return;
    setReviewBusy(true);
    try {
      const data = await getV1<{ bundle: unknown; fileName: string }>(`/api/v1/query/town/runs/${encodeURIComponent(runId)}/replay-bundle?worldId=${encodeURIComponent(world.id)}`);
      downloadTextFile(data.fileName, JSON.stringify(data.bundle, null, 2), "application/json;charset=utf-8");
      setStatus(`Replay bundle exported for ${runId}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to export replay bundle");
    } finally {
      setReviewBusy(false);
    }
  }

  async function startRunJobFromUi(kind: "scenario" | "benchmark", seedCount?: 10 | 20) {
    if (!world) return;
    setReviewBusy(true);
    try {
      const data = kind === "scenario"
        ? await postV1<{ sourceWorldId: string; worldId: string; currentExperiment: unknown; job: RunJob }>("/api/v1/command/town/experiment/new-run", {
            worldId: world.id,
            scenarioPackId: selectedScenarioPackId || undefined,
            mapPackId: townRuntime?.currentMapPackId || undefined,
            ruleCatalogId: townRuntime?.currentRuleCatalogId || undefined
          })
        : await postV1<{ job: RunJob }>("/api/v1/command/town/run-job/start", {
            worldId: world.id,
            kind,
            scenarioId: scenarioRun?.id,
            seedCount
          });
      setRunJobs((current) => [data.job, ...current.filter((job) => job.id !== data.job.id)].slice(0, 20));
      setStatus(`${kind === "scenario" ? "experiment" : kind} job started: ${data.job.id}.`);
      const branchWorldId = kind === "scenario" ? (data as { worldId?: string }).worldId : undefined;
      if (branchWorldId && branchWorldId !== world.id) {
        const branchState = await getV1<{ world: WorldState; activeCase?: CaseFromLog | null; sessions?: PlayerSession[] }>(`/api/v1/query/world/state?worldId=${encodeURIComponent(branchWorldId)}`);
        setWorld(branchState.world);
        setWorldIdInput(branchState.world.id);
        setEvents([]);
        await refreshTownRuntime(branchState.world.id).catch(() => undefined);
      } else {
        await refreshTownRuntime(world.id).catch(() => undefined);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `Failed to start ${kind} job`);
    } finally {
      setReviewBusy(false);
    }
  }

  async function cancelRunJobFromUi(jobId: string) {
    if (!world) return;
    setReviewBusy(true);
    try {
      const targetJob = runJobs.find((job) => job.id === jobId);
      const data = await postV1<{ job: RunJob }>("/api/v1/command/town/run-job/cancel", { worldId: targetJob?.worldId || world.id, jobId });
      setRunJobs((current) => current.map((job) => job.id === data.job.id ? data.job : job));
      setStatus(`Run job cancelled: ${jobId}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to cancel run job");
    } finally {
      setReviewBusy(false);
    }
  }

  useEffect(() => {
    if (!world || runtimeMode === "static-demo") return;
    const activeJob = runJobs.find((job) => job.status === "queued" || job.status === "running");
    if (!activeJob) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const jobWorldId = activeJob.worldId || world.id;
          const data = await postV1<{ job: RunJob }>("/api/v1/command/town/run-job/tick", { worldId: jobWorldId, jobId: activeJob.id });
          if (cancelled) return;
          setRunJobs((current) => [data.job, ...current.filter((job) => job.id !== data.job.id)].slice(0, 20));
          const result = data.job.result as { report?: BenchmarkSummary } | undefined;
          if (data.job.kind === "benchmark" && result?.report) {
            setBenchmarkSummary(result.report);
          }
          if (data.job.status === "completed") {
            setStatus(`${data.job.kind} job completed: ${data.job.runId || data.job.id}.`);
            await refreshTownRuntime(jobWorldId, selectedCharacterId, data.job.runId || data.job.resultRunId || scenarioRun?.id, true).catch(() => undefined);
          }
        } catch (error) {
          if (!cancelled) setStatus(error instanceof Error ? error.message : "Failed to advance run job");
        }
      })();
    }, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [world, runtimeMode, runJobs, selectedCharacterId, scenarioRun?.id]);

  async function runEmergenceBenchmarkFromUi(seedCount: 10 | 20) {
    await startRunJobFromUi("benchmark", seedCount);
  }

  async function fetchReviewExport(format: "json" | "markdown") {
    if (!world || !scenarioRun) return null;
    const fromId = reviewExportTarget.fromId || selectedSnapshotFromId;
    const toId = reviewExportTarget.toId || selectedSnapshotToId;
    return getV1<{ format: "json" | "markdown"; fileName: string; content: string; bundle: ReviewExportBundle }>(
      `/api/v1/query/town/review/export?worldId=${encodeURIComponent(world.id)}&scenarioId=${encodeURIComponent(scenarioRun.id)}&from=${encodeURIComponent(fromId)}&to=${encodeURIComponent(toId)}&format=${format}&includeBenchmark=true`
    );
  }

  async function copyReviewBundleJson() {
    setReviewBusy(true);
    try {
      const data = await fetchReviewExport("json");
      if (!data) return;
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard is not available in this browser.");
      await navigator.clipboard.writeText(data.content);
      setStatus(`Review bundle JSON copied for ${scenarioRun?.name || "scenario"}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to copy review JSON");
    } finally {
      setReviewBusy(false);
    }
  }

  async function exportReviewBundleFile(format: "json" | "markdown") {
    setReviewBusy(true);
    try {
      const data = await fetchReviewExport(format);
      if (!data) return;
      downloadTextFile(data.fileName, data.content, format === "markdown" ? "text/markdown;charset=utf-8" : "application/json;charset=utf-8");
      setStatus(`${format === "markdown" ? "Markdown" : "Review bundle"} exported for ${scenarioRun?.name || "scenario"}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `Failed to export ${format}`);
    } finally {
      setReviewBusy(false);
    }
  }

  function markCurrentDiffAsReviewExportTarget() {
    if (!selectedSnapshotFromId || !selectedSnapshotToId) return;
    setReviewExportTarget({ fromId: selectedSnapshotFromId, toId: selectedSnapshotToId });
    setStatus(`Review export target set to ${selectedSnapshotFromId} -> ${selectedSnapshotToId}.`);
  }

  async function runDefaultTownScenario(config?: ScenarioConfig) {
    if (!world) return;
    if (runtimeMode === "static-demo") {
      setStatus("Scenario Runner uses SQLite server runtime. Switch to Server Runtime first.");
      return;
    }
    const normalizedConfig = config && typeof config === "object" && "nativeEvent" in config ? undefined : config;
    setTownRuntimeBusy(true);
    try {
      const presetConfig = normalizedConfig
        || scenarioPresets.find((preset) => preset.id === selectedScenarioPresetId)?.config
        || defaultTownScenarioConfig();
      const scenarioName = presetConfig.name || "Town counterfactual scenario";
      const scenarioId = `scenario-${slugifyLabel(scenarioName)}-${Date.now()}`;
      const data = await postV1<{ world: WorldState; runtime: PersistentTownRuntime; events: WorldEvent[]; run: ScenarioRun; report: ScenarioReport; snapshots: TownStateSnapshot[] }>("/api/v1/command/town/scenario/run", {
        worldId: world.id,
        config: {
          ...presetConfig,
          id: scenarioId,
          seed: presetConfig.seed || `${world.seed}-${slugifyLabel(scenarioName)}`,
          name: scenarioName
        }
      });
      setWorld(data.world);
      setTownRuntime(data.runtime);
      setTownQueue(null);
      setScenarioRun(data.run);
      setScenarioReport(data.report);
      setTownSnapshots(data.snapshots);
      setSelectedSnapshotFromId(data.report.baseline.startSnapshotId);
      setSelectedSnapshotToId(data.report.baseline.endSnapshotId);
      setReviewExportTarget({ fromId: data.report.baseline.startSnapshotId, toId: data.report.baseline.endSnapshotId });
      setEvents((items) => [...items, ...data.events.filter((event) => !items.some((existing) => existing.id === event.id))]);
      setStatus(`Scenario ${data.run.status}: ${data.report.summary}`);
      await refreshTownRuntime(data.world.id, selectedCharacterId, data.run.id, true);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to run scenario");
    } finally {
      setTownRuntimeBusy(false);
    }
  }

  async function rollbackTownSnapshot(snapshotId: string) {
    if (!world || !snapshotId) return;
    setTownRuntimeBusy(true);
    try {
      const data = await postV1<{ world: WorldState; runtime: PersistentTownRuntime; snapshot: TownStateSnapshot }>("/api/v1/command/town/snapshot/rollback", {
        worldId: world.id,
        snapshotId
      });
      setWorld(data.world);
      setTownRuntime(data.runtime);
      setTownSnapshots(data.runtime.snapshots || []);
      setTimeValue(timeToMinutes(data.runtime.currentTime));
      setStatus(`Rolled back runtime to ${data.snapshot.label} at tick ${data.snapshot.tick}.`);
      await refreshTownRuntime(data.world.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to roll back snapshot");
    } finally {
      setTownRuntimeBusy(false);
    }
  }

  async function discoverEvidence(evidenceId: string) {
    const evidenceTitle = deductionCase?.evidence.find((item) => item.id === evidenceId)?.title || evidenceId;
    if (!session) {
      setStatus("Join the investigation before searching for evidence.");
      return;
    }
    if (runtimeMode === "static-demo") {
      const state = currentStaticState();
      if (!state) return;
      hydrateStatic(discoverDemoEvidence(state, evidenceId), false);
      setSelectedEvidenceId(evidenceId);
      const scene = scenes.find((item) => item.evidenceIds.includes(evidenceId));
      highlightSelection({ evidenceId, locationId: scene?.id });
      setInspectorTab("investigation");
      pushToast({ tone: "success", title: "Evidence found", detail: evidenceTitle });
      setStatus(`Evidence found: ${deductionCase?.evidence.find((item) => item.id === evidenceId)?.title || evidenceId}`);
      campaignStudy.recordMeaningfulAction();
      return;
    }
    setBusy(true);
    try {
      const data = await postJson<{ session: PlayerSession; playerResourceCommitment?: PlayerResourceCommitmentPublicSummary; factionRelationship?: FactionRelationshipPublicSummary; investigatorProgression?: InvestigatorProgressionPublicSummary }>("/api/investigation/discover", { sessionId: session.id, evidenceId });
      setSession(data.session);
      if (data.playerResourceCommitment) {
        setPlayerResourceCommitment(data.playerResourceCommitment);
        appendGuidedStepJournal({
          journalKey: "player-resource-commitment-used",
          step: "search",
          label: "Case resource used",
          status: "done",
          result: data.playerResourceCommitment.progressLabel,
          progressDelta: data.playerResourceCommitment.benefitLabel,
          nextAction: data.playerResourceCommitment.nextAction
        });
      }
      if (data.factionRelationship) setFactionRelationship(data.factionRelationship);
      if (data.investigatorProgression) setInvestigatorProgression(data.investigatorProgression);
      setProgress((current) => ({ ...current, discoveredEvidence: true }));
      setSelectedEvidenceId(evidenceId);
      const scene = scenes.find((item) => item.evidenceIds.includes(evidenceId));
      highlightSelection({ evidenceId, locationId: scene?.id });
      setInspectorTab("investigation");
      pushToast({ tone: "success", title: "Evidence found", detail: evidenceTitle });
      setStatus(`Evidence found: ${deductionCase?.evidence.find((item) => item.id === evidenceId)?.title || evidenceId}`);
      campaignStudy.recordMeaningfulAction();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to search evidence");
    } finally {
      setBusy(false);
    }
  }

  async function discoverFirstSceneEvidence(sceneId: string) {
    setSelectedSceneId(sceneId);
    setInspectorTab("investigation");
    const scene = scenes.find((item) => item.id === sceneId);
    const target =
      scene?.evidenceIds.find((id) => !discovered.has(id) && deductionCase?.evidence.find((item) => item.id === id)?.discoverable) ||
      scene?.evidenceIds.find((id) => deductionCase?.evidence.find((item) => item.id === id)?.discoverable);
    if (target) await discoverEvidence(target);
  }

  async function runInterrogationTarget(characterId: string, evidenceId: string | undefined, questionText: string) {
    if (!session || !characterId || !questionText.trim()) return;
    if (runtimeMode === "static-demo") {
      const state = currentStaticState();
      if (!state) return;
      const next = interrogateDemoNpc(state, {
        characterId,
        question: questionText,
        evidenceId
      });
      hydrateStatic(next, false);
      setLastAiSafety({
        mock: true,
        promptAudit: {
          memoryCount: selectedNpcMemories.length,
          evidenceCount: discoveredEvidence.length,
          forbiddenFieldHits: [],
          containsForbiddenTruth: false,
          hiddenEventLeakCount: 0,
          safe: true
        },
        memoryCount: selectedNpcMemories.length,
        evidenceCount: discoveredEvidence.length,
        safetyFlags: []
      });
      setInspectorTab("investigation");
      pushToast({
        tone: next.progress.challengedTestimony ? "warning" : "info",
        title: next.progress.challengedTestimony ? "Testimony contradiction" : "NPC answered",
        detail: next.progress.challengedTestimony ? "Evidence exposed a contradiction inside known memories." : "The answer stayed within NPC memory and discovered evidence."
      });
      setStatus(next.progress.challengedTestimony ? "Evidence exposed a contradiction; NPC testimony was corrected." : "NPC answered from their own memory scope.");
      return;
    }
    setBusy(true);
    try {
      const data = await postJson<{
        entry: PlayerSession["interrogationLog"][number];
        session: PlayerSession;
        mock: boolean;
        promptAudit: PromptAuditReport;
        dialogueEval: NpcDialogueEvalReport;
        safetyFlags: string[];
        memoryCount: number;
        evidenceCount: number;
        testimonyUpdated: boolean;
        playerResourceCommitment?: PlayerResourceCommitmentPublicSummary;
        factionRelationship?: FactionRelationshipPublicSummary;
        investigatorProgression?: InvestigatorProgressionPublicSummary;
      }>("/api/investigation/interrogate", {
        sessionId: session.id,
        characterId,
        question: questionText,
        evidenceId
      });
      setSession(data.session);
      if (data.playerResourceCommitment) {
        setPlayerResourceCommitment(data.playerResourceCommitment);
        appendGuidedStepJournal({
          journalKey: "player-resource-commitment-used",
          step: data.playerResourceCommitment.lane === "challenge" ? "challenge" : "question",
          label: "Case resource used",
          status: "done",
          result: data.playerResourceCommitment.progressLabel,
          progressDelta: data.playerResourceCommitment.benefitLabel,
          nextAction: data.playerResourceCommitment.nextAction
        });
      }
      if (data.factionRelationship) setFactionRelationship(data.factionRelationship);
      if (data.investigatorProgression) setInvestigatorProgression(data.investigatorProgression);
      setProgress((current) => ({ ...current, challengedTestimony: current.challengedTestimony || data.testimonyUpdated }));
      setLastAiSafety({ mock: data.mock, promptAudit: data.promptAudit, dialogueEval: data.dialogueEval, safetyFlags: data.safetyFlags, memoryCount: data.memoryCount, evidenceCount: data.evidenceCount });
      setInspectorTab("investigation");
      pushToast({
        tone: data.testimonyUpdated ? "warning" : "info",
        title: data.testimonyUpdated ? "Testimony contradiction" : "NPC answered",
        detail: data.testimonyUpdated ? "Evidence exposed a contradiction inside known memories." : "The answer stayed within NPC memory and discovered evidence."
      });
      setStatus(data.testimonyUpdated ? "Evidence exposed a contradiction; NPC testimony was corrected." : "NPC answered from their own memory.");
      if (activeCase) {
        const latestCase = await fetch(apiUrl(`/api/cases/${activeCase.id}`)).then((response) => response.json());
        if (latestCase.ok) setActiveCase(latestCase.caseFromLog || latestCase.activeCase || latestCase.case);
      }
      campaignStudy.recordMeaningfulAction();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Questioning failed");
    } finally {
      setBusy(false);
    }
  }

  function toggleTheoryEvidence(evidenceId: string) {
    setTheory((current) => {
      const ids = new Set(current.evidenceIds);
      if (ids.has(evidenceId)) ids.delete(evidenceId);
      else ids.add(evidenceId);
      return { ...current, evidenceIds: Array.from(ids) };
    });
  }

  function toggleManualEvidenceDrillEvidence(evidenceId: string) {
    const currentIds = theory.evidenceIds;
    const nextIds = currentIds.includes(evidenceId)
      ? currentIds.filter((id) => id !== evidenceId)
      : Array.from(new Set([...currentIds, evidenceId]));
    const drillCandidates = manualEvidenceDrill?.candidates || [];
    const candidateIds = drillCandidates.map((item) => item.evidenceId);
    const manualPickCount = nextIds.filter((id) => candidateIds.includes(id)).length;
    const targetCount = manualEvidenceDrill?.routeEvidenceTargetCount || Math.max(1, candidateIds.length);
    const remainingProofSlots = Math.max(0, targetCount - manualPickCount);
    const readyForSubmit = remainingProofSlots === 0;
    setTheory((current) => ({ ...current, evidenceIds: nextIds }));
    setReplayGoalAttempt((current) => current
      ? {
          ...current,
          manualEvidencePickCount: manualPickCount,
          lastResult: readyForSubmit ? "manual evidence ready" : "manual evidence selected"
        }
      : current);
    setSelectedEvidenceId(evidenceId);
    const scene = scenes.find((item) => item.evidenceIds.includes(evidenceId));
    if (scene) setSelectedSceneId(scene.id);
    highlightSelection({ evidenceId, locationId: scene?.id });
    setInspectorTab("investigation");
    appendGuidedStepJournal({
      journalKey: "manual-evidence-drill",
      step: "select-evidence",
      label: "Manual evidence drill",
      status: readyForSubmit ? "done" : "info",
      result: `${manualPickCount}/${targetCount} manually selected.`,
      progressDelta: `${remainingProofSlots} proof slot(s) remain before submit.`,
      nextAction: readyForSubmit ? "Run Next Guided Step to submit the replay attempt." : "Use Add to Theory on discovered proof clues before submit."
    });
    pushToast({
      tone: readyForSubmit ? "success" : "info",
      title: readyForSubmit ? "Manual evidence ready" : "Manual evidence updated",
      detail: `${manualPickCount}/${targetCount} route proof clue(s) selected without certified fallback.`
    });
    setStatus(readyForSubmit
      ? "Manual Evidence Drill has enough selected proof clues for replay submit."
      : "Manual Evidence Drill updated the session-local theory evidence chain.");
  }

  function updateManualTheoryDrillField(field: ManualTheoryFieldKind, value: string) {
    const nextTheory = { ...theory, [field]: value };
    const manualFieldCount = countManualTheoryFields(nextTheory);
    const remainingFieldCount = Math.max(0, 3 - manualFieldCount);
    setTheory(nextTheory);
    setReplayGoalAttempt((current) => current
      ? {
          ...current,
          manualTheoryFieldCount: manualFieldCount,
          blockedTheoryGapCount: 0,
          theoryFallbackApproved: false,
          lastResult: remainingFieldCount ? "manual theory updated" : "manual theory ready"
        }
      : current);
    appendGuidedStepJournal({
      journalKey: "manual-theory-drill",
      step: "submit",
      label: "Manual theory drill",
      status: manualFieldCount === 3 ? "done" : "info",
      result: `${manualFieldCount}/3 theory field(s) completed manually.`,
      progressDelta: `${remainingFieldCount} theory field(s) remain before manual submit.`,
      nextAction: remainingFieldCount
        ? "Complete the remaining theory fields or explicitly approve certified fallback."
        : "Run Next Guided Step to submit the manual theory."
    });
    setGuidedManualLastResult(remainingFieldCount ? "manual theory updated" : "manual theory ready");
    setStatus(remainingFieldCount
      ? "Manual Theory Drill updated without exposing the entered text."
      : "Manual Theory Drill is ready for player-authored submit.");
  }

  function approveManualTheoryFallback() {
    const unresolvedFields = unresolvedManualTheoryFields(session?.judgement);
    const remainingFieldCount = Math.max(0, 3 - countManualTheoryFields(theory));
    const approvedFieldCount = unresolvedFields.size || remainingFieldCount;
    if (!replayGoalAttempt?.active || approvedFieldCount === 0) return;
    setReplayGoalAttempt((current) => current
      ? {
          ...current,
          theoryFallbackApproved: true,
          lastResult: "certified theory fallback approved"
        }
      : current);
    appendGuidedStepJournal({
      journalKey: "manual-theory-drill",
      step: "submit",
      label: "Manual theory drill",
      status: "info",
      result: `Explicit fallback approved for ${approvedFieldCount} unresolved theory field(s).`,
      progressDelta: "No certified value was copied into a visible input.",
      nextAction: "Run Next Guided Step to submit with explicit field-level fallback."
    });
    setGuidedManualLastResult("explicit theory fallback approved");
    setStatus("Explicit fallback is armed for unresolved theory fields only.");
    campaignStudy.recordExplicitFallback();
  }

  async function submitCurrentTheory(theoryOverride?: PlayerTheory, options?: { syncVisibleTheory?: boolean }) {
    if (!session) return null;
    const nextTheory = theoryOverride || theory;
    if (theoryOverride && options?.syncVisibleTheory !== false) setTheory(theoryOverride);
    if (runtimeMode === "static-demo") {
      const state = currentStaticState();
      if (!state) return null;
      const next = submitDemoTheory(state, nextTheory);
      hydrateStatic(next, false);
      onboarding.recordTheoryResult(Boolean(next.session.judgement?.accepted));
      setInspectorTab("investigation");
      pushToast({
        tone: next.session.judgement?.accepted ? "success" : "warning",
        title: next.session.judgement?.accepted ? "Theory accepted" : "Theory has gaps",
        detail: next.session.judgement?.accepted ? "Answer review and final graph nodes are unlocked." : `Missing: ${next.session.judgement?.missing?.join(", ") || "key evidence chain"}`
      });
      setStatus(next.session.judgement?.accepted ? "Theory accepted. Final conclusion and answer review unlocked." : `Theory rejected: ${next.session.judgement?.missing?.join(", ") || "evidence chain incomplete"}`);
      return next.session.judgement || null;
    }
    setBusy(true);
    try {
      const data = await postJson<{
        judgement: PlayerSession["judgement"];
        session: PlayerSession;
        worldLeadOutcome?: WorldLeadOutcomePublicSummary;
        worldLeadCaseHandoff?: WorldLeadCaseHandoffPublicSummary;
        worldArc?: WorldArcPublicSummary;
        worldArcDirective?: WorldArcDirectivePublicSummary;
        playerResourceCommitment?: PlayerResourceCommitmentPublicSummary;
        factionRelationship?: FactionRelationshipPublicSummary;
        worldInfluenceBudget?: WorldInfluenceBudgetPublicSummary;
        investigatorProgression?: InvestigatorProgressionPublicSummary;
        campaignRecovery?: CampaignRecoveryPublicSummary;
        arcConvergence?: ArcConvergencePublicSummary;
        campaignSession?: CampaignSessionPublicSummary;
        campaignFinaleDebrief?: CampaignFinaleDebriefPublicSummary;
        townSocialResponse?: TownSocialResponsePublicSummary;
      }>("/api/investigation/submit-theory", { sessionId: session.id, theory: nextTheory });
      setSession(data.session);
      if (data.playerResourceCommitment) {
        setPlayerResourceCommitment(data.playerResourceCommitment);
        appendGuidedStepJournal({
          journalKey: "player-resource-commitment-settled",
          step: "submit",
          label: data.playerResourceCommitment.status === "released" ? "Unused case resource returned" : "Case resource cycle complete",
          status: "done",
          result: data.playerResourceCommitment.progressLabel,
          progressDelta: data.playerResourceCommitment.status === "released" ? "Reserved capacity returned exactly once." : "The spent resource and bounded world benefit remain recorded.",
          nextAction: data.playerResourceCommitment.nextAction
        });
      }
      if (data.factionRelationship) {
        setFactionRelationship(data.factionRelationship);
        appendGuidedStepJournal({
          journalKey: `faction-standing-case-${data.factionRelationship.lastChangeLabel}`,
          step: "submit",
          label: "Case standing recorded",
          status: "done",
          result: data.factionRelationship.lastChangeLabel,
          progressDelta: data.factionRelationship.resourceEffectLabel,
          nextAction: data.factionRelationship.nextAction
        });
      }
      if (data.worldLeadOutcome) {
        setWorldLeadOutcome(data.worldLeadOutcome);
        appendGuidedStepJournal({
          journalKey: "world-lead-outcome",
          step: "submit",
          label: "World lead outcome settled",
          status: "done",
          result: "The bounded world effect settled after the accepted theory without changing the certified route.",
          progressDelta: "World state balance returned to the normal case flow.",
          nextAction: data.worldLeadOutcome.nextAction
        });
      }
      if (data.townSocialResponse) {
        setTownSocialResponse(data.townSocialResponse);
        if (data.townSocialResponse.status === "ready") {
          appendGuidedStepJournal({
            journalKey: "town-social-response-prepared",
            step: "submit",
            label: "Town response prepared",
            status: "info",
            result: data.townSocialResponse.headline,
            progressDelta: "A public reaction cycle is ready without changing case authority.",
            nextAction: data.townSocialResponse.nextAction
          });
        }
      }
      if (data.worldLeadCaseHandoff) {
        setWorldLeadCaseHandoff(data.worldLeadCaseHandoff);
        appendGuidedStepJournal({
          journalKey: "world-lead-handoff",
          step: "submit",
          label: "World lead handoff prepared",
          status: "done",
          result: "A bounded next-case follow-up is ready after the accepted theory.",
          progressDelta: "The next case queue will carry one safe preference without changing route coverage.",
          nextAction: data.worldLeadCaseHandoff.nextAction
        });
        await refreshTownRuntime(world?.id).catch(() => undefined);
      }
      if (data.worldArc) {
        setWorldArc(data.worldArc);
        appendGuidedStepJournal({
          journalKey: "world-arc",
          step: "submit",
          label: data.worldArc.status === "completed" ? "World arc completed" : "World arc advanced",
          status: "done",
          result: `${data.worldArc.label} advanced after the followed lead and accepted theory.`,
          progressDelta: data.worldArc.progressLabel,
          nextAction: data.worldArc.nextAction
        });
      }
      if (data.worldArcDirective) {
        setWorldArcDirective(data.worldArcDirective);
        appendGuidedStepJournal({
          journalKey: "world-arc-directive-prepared",
          step: "submit",
          label: "Faction directive prepared",
          status: "info",
          result: "A low-spoiler Support or Contain response is ready after the accepted theory.",
          progressDelta: data.worldArcDirective.progressLabel,
          nextAction: data.worldArcDirective.nextAction
        });
      }
      if (data.worldInfluenceBudget) setWorldInfluenceBudget(data.worldInfluenceBudget);
      if (data.investigatorProgression) {
        setInvestigatorProgression(data.investigatorProgression);
        appendGuidedStepJournal({
          journalKey: "investigator-progression",
          step: data.judgement?.accepted ? "submit" : "select-evidence",
          label: data.judgement?.accepted ? "Investigator practice recorded" : "Evidence practice recorded",
          status: "done",
          result: `${data.investigatorProgression.points} practice mark(s) · ${data.investigatorProgression.status}`,
          progressDelta: data.investigatorProgression.unlockedLabels.join(" / ") || "No bounded unlock yet.",
          nextAction: data.investigatorProgression.nextAction
        });
      }
      if (data.campaignRecovery) {
        setCampaignRecovery(data.campaignRecovery);
        appendGuidedStepJournal({
          journalKey: "campaign-recovery-theory",
          step: "submit",
          label: "Theory recovery path prepared",
          status: "blocked",
          result: data.campaignRecovery.failureLabel,
          progressDelta: data.campaignRecovery.recoveryActionLabel,
          nextAction: data.campaignRecovery.nextAction
        });
      }
      if (data.arcConvergence) {
        setArcConvergence(data.arcConvergence);
        appendGuidedStepJournal({
          journalKey: `arc-convergence-theory-${data.arcConvergence.status}`,
          step: "submit",
          label: data.arcConvergence.status === "completed" ? "Campaign convergence completed" : data.arcConvergence.status === "ready" ? "Campaign finale formed" : "Campaign convergence updated",
          status: "done",
          result: `${data.arcConvergence.finaleLabel} / ${data.arcConvergence.approachLabel}`,
          progressDelta: `${data.arcConvergence.caseProgressLabel} / ${data.arcConvergence.worldProgressLabel}`,
          nextAction: data.arcConvergence.nextAction
        });
      }
      if (data.campaignSession) setCampaignSession(data.campaignSession);
      if (data.campaignFinaleDebrief) setCampaignFinaleDebrief(data.campaignFinaleDebrief);
      onboarding.recordTheoryResult(Boolean(data.judgement?.accepted));
      setProgress((current) => ({ ...current, submittedTheory: true, solvedCase: Boolean(data.judgement?.accepted) }));
      setInspectorTab("investigation");
      pushToast({
        tone: data.judgement?.accepted ? "success" : "warning",
        title: data.judgement?.accepted ? "Theory accepted" : "Theory has gaps",
        detail: data.judgement?.accepted ? "Answer review can be generated." : `Missing: ${data.judgement?.missing?.join(", ") || "key evidence chain"}`
      });
      setStatus(data.judgement?.accepted ? "Theory accepted. Answer review can be generated." : `Theory rejected: ${data.judgement?.missing?.join(", ") || "evidence chain incomplete"}`);
      campaignStudy.recordMeaningfulAction();
      return data.judgement || null;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to submit theory");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function submitTheory() {
    await submitCurrentTheory();
  }

  function runStaticCertifiedPlaythrough() {
    if (runtimeMode !== "static-demo" || !world || !activeCase) return;
    const report = autoSolvePlayableCase(activeCase, events, {
      sessionId: `static-certified-${Date.now()}`,
      playerId: "static-player",
      displayName: playerName.trim() || "Investigator",
      dryRun: true
    });
    if (!report.passed || !report.session.judgement?.accepted) {
      pushToast({
        tone: "warning",
        title: "Certified playthrough blocked",
        detail: report.summary.failureKinds.join(", ") || "Route proof did not pass."
      });
      setStatus(`Static playthrough blocked: ${report.summary.failureKinds.join(", ") || "route proof did not pass"}`);
      return;
    }
    const nextState: DemoRuntimeState = {
      mode: "static-demo",
      world,
      events,
      activeCase,
      session: report.session,
      progress: {
        observedCrimeWindow: true,
        joinedInvestigation: true,
        discoveredEvidence: report.session.discoveredEvidenceIds.length > 0,
        challengedTestimony: report.session.interrogationLog.some((entry) => entry.challenge?.hit),
        submittedTheory: Boolean(report.session.submittedTheory),
        solvedCase: Boolean(report.session.judgement?.accepted)
      },
      revealText
    };
    hydrateStatic(nextState, false);
    if (report.theory) setTheory(report.theory);
    const firstEvidenceId = report.theory?.evidenceIds[0] || report.session.discoveredEvidenceIds[0] || "";
    if (firstEvidenceId) {
      setSelectedEvidenceId(firstEvidenceId);
      const scene = scenes.find((item) => item.evidenceIds.includes(firstEvidenceId));
      if (scene) setSelectedSceneId(scene.id);
      highlightSelection({ evidenceId: firstEvidenceId, locationId: scene?.id });
    }
    const firstWitnessId = report.session.interrogationLog.find((entry) => entry.challenge?.hit)?.characterId || report.session.interrogationLog[0]?.characterId;
    if (firstWitnessId) {
      setSelectedCharacterId(firstWitnessId);
      setSelectedSuspectId(firstWitnessId);
    }
    onboarding.recordTheoryResult(true);
    setInspectorTab("investigation");
    pushToast({
      tone: "success",
      title: "Certified playthrough completed",
      detail: `${report.summary.stepCount} steps / ${report.summary.challengeHitCount} challenge hit(s) / ${report.summary.selectedEvidenceCount} selected evidence.`
    });
    setStatus("Static certified playthrough completed. Theory accepted and Review Source is unlocked.");
  }

  async function runServerCertifiedPlaythrough() {
    if (runtimeMode === "static-demo" || !world || !activeCase) return;
    setBusy(true);
    try {
      const data = await postV1<{ summary: CaseAutoSolveSummary; session?: PlayerSession; sessionId?: string }>("/api/v1/command/investigation/autosolve", {
        caseId: activeCase.id,
        persist: true,
        includeSession: true
      });
      setServerPlaythroughSummary(data.summary);
      if (!data.summary.passed || !data.session?.judgement?.accepted) {
        pushToast({
          tone: "warning",
          title: "Server playthrough blocked",
          detail: data.summary.failureKinds.join(", ") || "Route proof did not pass."
        });
        setStatus(`Server playthrough blocked: ${data.summary.failureKinds.join(", ") || "route proof did not pass"}`);
        return;
      }
      setSession(data.session);
      setSessions((items) => [data.session as PlayerSession, ...items.filter((item) => item.id !== data.session?.id)]);
      setProgress({
        observedCrimeWindow: true,
        joinedInvestigation: true,
        discoveredEvidence: data.summary.discoveredEvidenceCount > 0,
        challengedTestimony: data.summary.challengeHitCount > 0,
        submittedTheory: Boolean(data.session.submittedTheory),
        solvedCase: Boolean(data.session.judgement?.accepted)
      });
      persist(world.id, data.session.id);
      if (data.session.submittedTheory) setTheory(data.session.submittedTheory);
      const firstEvidenceId = data.session.submittedTheory?.evidenceIds[0] || data.session.discoveredEvidenceIds[0] || "";
      if (firstEvidenceId) {
        setSelectedEvidenceId(firstEvidenceId);
        const scene = scenes.find((item) => item.evidenceIds.includes(firstEvidenceId));
        if (scene) setSelectedSceneId(scene.id);
        highlightSelection({ evidenceId: firstEvidenceId, locationId: scene?.id });
      }
      const firstWitnessId = data.session.interrogationLog.find((entry) => entry.challenge?.hit)?.characterId || data.session.interrogationLog[0]?.characterId;
      if (firstWitnessId) {
        setSelectedCharacterId(firstWitnessId);
        setSelectedSuspectId(firstWitnessId);
      }
      onboarding.recordTheoryResult(true);
      setInspectorTab("investigation");
      pushToast({
        tone: "success",
        title: "Server certified playthrough completed",
        detail: `${data.summary.stepCount} steps / ${data.summary.challengeHitCount} challenge hit(s) / ${data.summary.selectedEvidenceCount} selected evidence.`
      });
      setStatus("Server certified playthrough completed. Auto-player session was persisted and Review Source is unlocked.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to run server certified playthrough");
    } finally {
      setBusy(false);
    }
  }

  async function interrogate() {
    await runInterrogationTarget(selectedCharacterId, selectedEvidenceId || undefined, question);
  }

  async function runGuidedManualStep() {
    if (guidedManualRunning) return;
    const target = getGuidedManualTarget();
    setGuidedManualRunning(true);
    campaignStudy.recordGuidedStep();
    try {
      if (target.kind === "join") {
        await joinCase();
        setGuidedManualLastResult("joined");
        appendGuidedStepJournal({
          step: "join",
          label: "Join investigation",
          status: "done",
          result: "Investigation session opened.",
          progressDelta: "Player can now search scenes and question witnesses.",
          nextAction: "Search the first certified route clue."
        });
        return;
      }
      if (!session) {
        setGuidedManualLastResult("join required");
        setStatus("Join the investigation before running guided steps.");
        appendGuidedStepJournal({
          step: target.kind,
          label: target.label,
          status: "blocked",
          result: "No active investigation session.",
          progressDelta: "0 steps advanced.",
          nextAction: "Join the investigation first."
        });
        return;
      }
      if (target.kind === "search") {
        if (!target.evidenceId) {
          setGuidedManualLastResult("search blocked");
          setStatus("Guided search is blocked because the route has no discoverable clue.");
          appendGuidedStepJournal({
            step: "search",
            label: "Search certified clue",
            status: "blocked",
            result: "No discoverable route clue is available.",
            progressDelta: "Clue discovered count unchanged.",
            nextAction: "Review the Route Certificate blockers."
          });
          return;
        }
        if (target.locationId) setSelectedSceneId(target.locationId);
        await discoverEvidence(target.evidenceId);
        setGuidedManualLastResult("search complete");
        appendGuidedStepJournal({
          step: "search",
          label: "Search certified clue",
          status: "done",
          result: "One route clue was discovered.",
          progressDelta: `${Math.min((session.discoveredEvidenceIds.length || 0) + 1, caseRouteCertificate?.theoryEvidenceIds.length || playableIntake?.routeCertificate?.theoryEvidenceIds.length || (session.discoveredEvidenceIds.length || 0) + 1)} clue(s) now count toward the certified route.`,
          nextAction: "Continue search until the route asks for witness questioning."
        });
        await resolveWorldLeadAfterStep("search");
        return;
      }
      if (target.kind === "question") {
        if (!target.characterId) {
          setGuidedManualLastResult("question blocked");
          setStatus("Guided question is blocked because the route has no witness.");
          appendGuidedStepJournal({
            step: "question",
            label: "Question certified witness",
            status: "blocked",
            result: "No certified witness is available.",
            progressDelta: "Witness question count unchanged.",
            nextAction: "Review route witness blockers."
          });
          return;
        }
        const questionText = "Where were you during the incident window, and what did you observe?";
        setSelectedCharacterId(target.characterId);
        setSelectedSuspectId(target.characterId);
        setQuestion(questionText);
        highlightSelection({ characterId: target.characterId });
        await runInterrogationTarget(target.characterId, undefined, questionText);
        setGuidedManualLastResult("question complete");
        appendGuidedStepJournal({
          step: "question",
          label: "Question certified witness",
          status: "done",
          result: "A route witness was questioned.",
          progressDelta: `${new Set([...session.interrogationLog.map((entry) => entry.characterId), target.characterId]).size} witness question(s) now support the route.`,
          nextAction: "Present a discovered clue for a testimony challenge."
        });
        await resolveWorldLeadAfterStep("question");
        return;
      }
      if (target.kind === "challenge") {
        if (!target.characterId || !target.evidenceId) {
          setGuidedManualLastResult("challenge blocked");
          setStatus("Guided challenge is blocked because the certified route is missing a witness or clue.");
          appendGuidedStepJournal({
            step: "challenge",
            label: "Challenge certified testimony",
            status: "blocked",
            result: "Challenge needs both a witness and a discovered route clue.",
            progressDelta: "Contradiction hit count unchanged.",
            nextAction: "Search the missing route clue or review witness blockers."
          });
          return;
        }
        const questionText = "Please explain this evidence and whether it changes your earlier statement.";
        setSelectedCharacterId(target.characterId);
        setSelectedSuspectId(target.characterId);
        setSelectedEvidenceId(target.evidenceId);
        setQuestion(questionText);
        const scene = scenes.find((item) => item.evidenceIds.includes(target.evidenceId as string));
        if (scene) setSelectedSceneId(scene.id);
        highlightSelection({ characterId: target.characterId, evidenceId: target.evidenceId, locationId: scene?.id });
        await runInterrogationTarget(target.characterId, target.evidenceId, questionText);
        setGuidedManualLastResult("challenge complete");
        appendGuidedStepJournal({
          step: "challenge",
          label: "Challenge certified testimony",
          status: "done",
          result: "A testimony contradiction was tested with a discovered clue.",
          progressDelta: `${(session.interrogationLog || []).filter((entry) => entry.challenge?.hit).length + 1} challenge hit(s) now support the route.`,
          nextAction: "Select the discovered proof clues for the theory chain."
        });
        await resolveWorldLeadAfterStep("challenge");
        return;
      }
      if (target.kind === "select-evidence") {
        const certifiedEvidenceIds = caseRouteCertificate?.theoryEvidenceIds || playableIntake?.routeCertificate?.theoryEvidenceIds || [];
        const discoveredSet = new Set(session.discoveredEvidenceIds);
        const selectableIds = certifiedEvidenceIds.filter((id) => discoveredSet.has(id));
        if (!selectableIds.length && target.evidenceId) selectableIds.push(target.evidenceId);
        const selectedSet = new Set(theory.evidenceIds);
        const manualSelectedCount = selectableIds.filter((id) => selectedSet.has(id)).length;
        if (replayGoalAttempt?.active && selectableIds.length && manualSelectedCount < selectableIds.length) {
          const firstMissingId = selectableIds.find((id) => !selectedSet.has(id)) || selectableIds[0];
          if (firstMissingId) {
            setSelectedEvidenceId(firstMissingId);
            const scene = scenes.find((item) => item.evidenceIds.includes(firstMissingId));
            if (scene) setSelectedSceneId(scene.id);
            highlightSelection({ evidenceId: firstMissingId, locationId: scene?.id });
          }
          const remainingProofSlots = Math.max(0, selectableIds.length - manualSelectedCount);
          setReplayGoalAttempt((current) => current
            ? { ...current, manualEvidencePickCount: manualSelectedCount, lastResult: "manual evidence drill ready" }
            : current);
          setInspectorTab("investigation");
          pushToast({ tone: "info", title: "Manual Evidence Drill ready", detail: "Pick discovered proof clues manually before replay submit." });
          setStatus("Guided select-evidence is waiting on Manual Evidence Drill instead of auto-selecting certified evidence.");
          setGuidedManualLastResult("manual evidence drill ready");
          appendGuidedStepJournal({
            journalKey: "manual-evidence-drill",
            step: "select-evidence",
            label: "Manual evidence drill",
            status: "info",
            result: `${manualSelectedCount}/${selectableIds.length} manually selected.`,
            progressDelta: `${remainingProofSlots} proof slot(s) remain before submit.`,
            nextAction: "Use Add to Theory in Manual Evidence Drill, then run the next guided step."
          });
          return;
        }
        if (replayGoalAttempt?.active && selectableIds.length) {
          setReplayGoalAttempt((current) => current
            ? { ...current, manualEvidencePickCount: manualSelectedCount, lastResult: "manual evidence selected" }
            : current);
          setGuidedManualLastResult("manual evidence selected");
          appendGuidedStepJournal({
            step: "select-evidence",
            label: "Select manual evidence",
            status: "done",
            result: `${manualSelectedCount} manually selected proof clue(s) are ready.`,
            progressDelta: "Replay attempt will submit without adding certified evidence at this step.",
            nextAction: "Submit the replay theory for local judgement."
          });
          return;
        }
        setTheory((current) => ({
          ...current,
          evidenceIds: Array.from(new Set([...current.evidenceIds, ...selectableIds]))
        }));
        const firstEvidenceId = selectableIds[0];
        if (firstEvidenceId) {
          setSelectedEvidenceId(firstEvidenceId);
          const scene = scenes.find((item) => item.evidenceIds.includes(firstEvidenceId));
          if (scene) setSelectedSceneId(scene.id);
          highlightSelection({ evidenceId: firstEvidenceId, locationId: scene?.id });
        }
        setInspectorTab("investigation");
        pushToast({ tone: "success", title: "Certified evidence selected", detail: `${selectableIds.length} discovered proof clue(s) added to the theory chain.` });
        setStatus("Guided manual run selected the certified proof clues.");
        setGuidedManualLastResult("evidence selected");
        appendGuidedStepJournal({
          step: "select-evidence",
          label: "Select certified evidence",
          status: "done",
          result: `${selectableIds.length} discovered proof clue(s) were added to the theory chain.`,
          progressDelta: `${new Set([...theory.evidenceIds, ...selectableIds]).size} selected proof clue(s) are ready for submit.`,
          nextAction: "Submit the certified theory for local judgement."
        });
        return;
      }
      if (target.kind === "submit") {
        if (!activeCase) {
          setGuidedManualLastResult("submit blocked");
          setStatus("Guided submit is blocked because no case is active.");
          appendGuidedStepJournal({
            step: "submit",
            label: "Submit certified theory",
            status: "blocked",
            result: "No active case is available for judgement.",
            progressDelta: "Theory judgement not run.",
            nextAction: "Load or extract a playable case."
          });
          return;
        }
        const manualTheoryFieldCount = countManualTheoryFields(theory);
        const previouslyUnresolvedFields = unresolvedManualTheoryFields(session.judgement);
        const remainingTheoryFieldCount = Math.max(0, 3 - manualTheoryFieldCount);
        if (
          replayGoalAttempt?.active
          && (remainingTheoryFieldCount > 0 || previouslyUnresolvedFields.size > 0)
          && !replayGoalAttempt.theoryFallbackApproved
        ) {
          const blockedGapCount = previouslyUnresolvedFields.size;
          setReplayGoalAttempt((current) => current
            ? {
                ...current,
                manualTheoryFieldCount,
                blockedTheoryGapCount: blockedGapCount,
                lastResult: blockedGapCount ? "manual theory has unresolved gaps" : "manual theory drill ready"
              }
            : current);
          appendGuidedStepJournal({
            journalKey: "manual-theory-drill",
            step: "submit",
            label: "Manual theory drill",
            status: blockedGapCount ? "blocked" : "info",
            result: `${manualTheoryFieldCount}/3 theory field(s) completed manually.`,
            progressDelta: blockedGapCount
              ? `${blockedGapCount} theory field gap(s) need revision or explicit fallback.`
              : `${remainingTheoryFieldCount} theory field(s) remain before submit.`,
            nextAction: blockedGapCount
              ? "Revise the theory fields or explicitly approve certified fallback for unresolved fields."
              : "Complete Manual Theory Drill or explicitly approve fallback for remaining fields."
          });
          setInspectorTab("investigation");
          setGuidedManualLastResult(blockedGapCount ? "manual theory blocked" : "manual theory drill ready");
          pushToast({
            tone: blockedGapCount ? "warning" : "info",
            title: blockedGapCount ? "Manual theory has gaps" : "Manual Theory Drill ready",
            detail: blockedGapCount
              ? `${blockedGapCount} field-level gap(s) remain; no hidden answer was revealed.`
              : "Fill suspect, motive, and method before replay submit."
          });
          setStatus("Guided submit is waiting on Manual Theory Drill instead of automatic certified fallback.");
          return;
        }
        const certifiedEvidenceIds = caseRouteCertificate?.theoryEvidenceIds || playableIntake?.routeCertificate?.theoryEvidenceIds || theory.evidenceIds;
        const discoveredSet = new Set(session.discoveredEvidenceIds);
        const discoveredCertifiedEvidenceIds = certifiedEvidenceIds.filter((id) => discoveredSet.has(id));
        const fallbackEvidenceIds = discoveredCertifiedEvidenceIds.filter((id) => !theory.evidenceIds.includes(id));
        const selectedEvidenceIds = Array.from(new Set([...theory.evidenceIds, ...discoveredCertifiedEvidenceIds]));
        const fallbackTheoryFields = new Set<ManualTheoryFieldKind>();
        if (!replayGoalAttempt?.active) {
          if (!theory.culpritId) fallbackTheoryFields.add("culpritId");
          if (!theory.motive.trim()) fallbackTheoryFields.add("motive");
          if (!theory.method.trim()) fallbackTheoryFields.add("method");
        } else if (replayGoalAttempt.theoryFallbackApproved) {
          if (!theory.culpritId || previouslyUnresolvedFields.has("culpritId")) fallbackTheoryFields.add("culpritId");
          if (!theory.motive.trim() || previouslyUnresolvedFields.has("motive")) fallbackTheoryFields.add("motive");
          if (!theory.method.trim() || previouslyUnresolvedFields.has("method")) fallbackTheoryFields.add("method");
        }
        const fallbackUsed = fallbackTheoryFields.size > 0 || fallbackEvidenceIds.length > 0;
        setReplayGoalAttempt((current) => current
          ? {
              ...current,
              manualTheoryFieldCount,
              fallbackTheoryFieldCount: fallbackTheoryFields.size,
              fallbackEvidencePickCount: fallbackEvidenceIds.length,
              theoryFallbackApproved: false,
              lastResult: fallbackUsed ? "submitting with explicit certified fallback" : "submitting manual theory"
            }
          : current);
        const certifiedTheory: PlayerTheory = {
          culpritId: fallbackTheoryFields.has("culpritId") ? activeCase.deductionCase.truth.culpritId : theory.culpritId,
          motive: fallbackTheoryFields.has("motive") ? activeCase.deductionCase.truth.motive : theory.motive,
          method: fallbackTheoryFields.has("method") ? activeCase.deductionCase.truth.method : theory.method,
          evidenceIds: selectedEvidenceIds
        };
        const judgement = await submitCurrentTheory(certifiedTheory, { syncVisibleTheory: false });
        const accepted = Boolean(judgement?.accepted);
        const blockedTheoryGapCount = unresolvedManualTheoryFields(judgement || undefined).size;
        const submitJournalLabel = accepted
          ? replayGoalAttempt?.active ? "Submit replay theory" : "Submit certified theory"
          : "Review theory gaps";
        setReplayGoalAttempt((current) => current
          ? {
              ...current,
              manualTheoryFieldCount,
              fallbackTheoryFieldCount: fallbackTheoryFields.size,
              fallbackEvidencePickCount: fallbackEvidenceIds.length,
              blockedTheoryGapCount,
              theoryFallbackApproved: false,
              lastResult: accepted
                ? fallbackUsed ? "accepted with explicit certified fallback" : "accepted manual theory"
                : "manual theory judgement blocked"
            }
          : current);
        setGuidedManualLastResult(accepted ? "accepted" : "manual theory blocked");
        appendGuidedStepJournal({
          step: "submit",
          label: submitJournalLabel,
          status: accepted ? "done" : "blocked",
          result: accepted ? "Theory accepted by local judgement." : `Theory judgement returned ${blockedTheoryGapCount} field-level gap(s).`,
          progressDelta: accepted
            ? `${manualTheoryFieldCount} manual theory field(s), ${fallbackTheoryFields.size} fallback theory field(s), and ${fallbackEvidenceIds.length} fallback evidence pick(s) closed the route.`
            : "Entered text remains private; only aggregate gap counts are recorded.",
          nextAction: accepted
            ? "Review the source-backed audit workbench."
            : "Revise the theory or explicitly approve fallback for unresolved fields.",
          fallbackUsed
        });
        if (accepted) {
          appendGuidedStepJournal({
            step: "review-source",
            label: "Review source audit",
            status: "done",
            result: "Source Review Workbench unlocked.",
            progressDelta: "Source Trail, Proof Obligations, Certified Route, and Conclusion Review are available.",
            nextAction: "Inspect the solved-case audit without raw replay or hidden ids.",
            reviewUnlocked: true
          });
        }
        return;
      }
      setInspectorTab("investigation");
      setGuidedManualLastResult("source review ready");
      setStatus("Source Review Workbench is ready.");
      appendGuidedStepJournal({
        step: "review-source",
        label: "Review source audit",
        status: session.judgement?.accepted ? "done" : "blocked",
        result: session.judgement?.accepted ? "Source Review Workbench is ready." : "Accepted theory is required before source review unlocks.",
        progressDelta: session.judgement?.accepted ? "Review source is unlocked." : "Review source remains locked.",
        nextAction: session.judgement?.accepted ? "Inspect the source-backed audit." : "Complete the certified route and submit theory.",
        reviewUnlocked: Boolean(session.judgement?.accepted)
      });
    } finally {
      setGuidedManualRunning(false);
    }
  }

  async function revealSolution() {
    if (!session?.judgement?.accepted) return;
    if (runtimeMode === "static-demo") {
      const state = currentStaticState();
      if (!state) return;
      const next = revealDemoSolution(state);
      hydrateStatic(next, false);
      setInspectorTab("logic");
      pushToast({ tone: "success", title: "Answer review unlocked", detail: "You can now inspect how evidence leads to the final conclusion." });
      setStatus("Answer review generated from local fact locks without calling DeepSeek.");
      return;
    }
    setBusy(true);
    try {
      const data = await postJson<{ content: string; revealEval: RevealEvalReport; factContract: RevealFactContract; mock: boolean }>("/api/investigation/reveal", { sessionId: session.id });
      setRevealText(data.content);
      setLastAiSafety((current) => ({ ...(current || {}), revealEval: data.revealEval, factContract: data.factContract, mock: data.mock }));
      setInspectorTab("logic");
      pushToast({ tone: "success", title: "Answer review generated", detail: "Facts are still constrained by local rules and case structure." });
      setStatus("Answer review generated and validated against local fact locks.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to generate answer review");
    } finally {
      setBusy(false);
    }
  }

  async function copyAgentApiExample() {
    try {
      await navigator.clipboard.writeText(agentApiExample);
      setStatus("Agent API example copied.");
    } catch {
      setStatus("Copy failed: the browser has not granted clipboard permission.");
    }
  }

  function handleMarker(marker: WorldMapMarker) {
    setInspectorTab(marker.type === "event" ? "events" : "investigation");
    if (marker.eventId) setHighlightedEventId(marker.eventId);
    if (marker.evidenceId) {
      setSelectedEvidenceId(marker.evidenceId);
      if (!marker.discovered) void discoverEvidence(marker.evidenceId);
    }
    setSelectedSceneId(marker.locationId);
    highlightSelection({ locationId: marker.locationId, eventId: marker.eventId, evidenceId: marker.evidenceId });
  }

  function handleActor(actor: WorldMapActor) {
    setSelectedCharacterId(actor.id);
    setSelectedSuspectId(actor.id);
    setSelectedSceneId(actor.locationId);
    setQuestion(`${actor.name}, where were you during the crime window, and what unusual details do you remember?`);
    highlightSelection({ characterId: actor.id, locationId: actor.locationId });
    setInspectorTab(appMode === "persistent-town" ? "agent" : "investigation");
  }

  function handleGapCard(card: GapCard) {
    setSelectedGapType(card.label);
    if (card.target === "suspects" || card.target === "exclusion") {
      const target = suspectBoard.find((row) => row.status !== "culprit") || suspectBoard[0];
      if (target) {
        setSelectedSuspectId(target.characterId);
        setSelectedCharacterId(target.characterId);
        highlightSelection({ characterId: target.characterId });
      }
      setInspectorTab("people");
      return;
    }
    if (card.target === "evidence") {
      const first = discoveredEvidence[0];
      if (first) {
        setSelectedEvidenceId(first.id);
        const scene = scenes.find((item) => item.evidenceIds.includes(first.id));
        if (scene) setSelectedSceneId(scene.id);
        highlightSelection({ evidenceId: first.id, locationId: scene?.id });
      }
      setInspectorTab("investigation");
      return;
    }
    if (card.target === "logic") {
      setInspectorTab("logic");
      return;
    }
    setInspectorTab("investigation");
  }

  function handleIntakeNextAction(action: PlayableCaseNextAction) {
    if (action.targetLocationId) {
      setSelectedSceneId(action.targetLocationId);
      highlightSelection({ locationId: action.targetLocationId, evidenceId: action.targetEvidenceId });
    }
    if (action.targetEvidenceId) {
      setSelectedEvidenceId(action.targetEvidenceId);
      setTheory((current) => current.evidenceIds.includes(action.targetEvidenceId as string) ? current : { ...current, evidenceIds: [...current.evidenceIds, action.targetEvidenceId as string] });
    }
    if (action.targetCharacterId) {
      setSelectedCharacterId(action.targetCharacterId);
      setSelectedSuspectId(action.targetCharacterId);
      setQuestion(action.kind === "challenge" && action.targetEvidenceId
        ? "Please explain this evidence and whether it changes your earlier statement."
        : "Where were you during the incident window, and what did you observe?");
      highlightSelection({ locationId: action.targetLocationId, evidenceId: action.targetEvidenceId, characterId: action.targetCharacterId });
    }
    if (action.kind === "review" || action.kind === "review-source") {
      setInspectorTab("investigation");
    } else {
      setInspectorTab("investigation");
    }
    pushToast({ tone: "info", title: action.label, detail: action.detail });
    setStatus(action.detail);
  }

  function handleNotebookAction(item: EvidenceNotebookItem, action: "source" | "challenge" | "chain") {
    setSelectedEvidenceId(item.evidenceId);
    setSelectedSceneId(item.locationId);
    if (item.sourceEventId) setHighlightedEventId(item.sourceEventId);
    if (item.sourceEventLabel) {
      const source = events.find((event) => event.id === item.sourceEventId);
      if (source) setTimeValue(timeToMinutes(source.time));
    }
    if (action === "challenge" && item.challengeNpcIds[0]) {
      setSelectedCharacterId(item.challengeNpcIds[0]);
      setQuestion(`Please explain this evidence: ${item.title}`);
    }
    if (action === "chain" && item.discovered) {
      setTheory((current) => current.evidenceIds.includes(item.evidenceId) ? current : { ...current, evidenceIds: [...current.evidenceIds, item.evidenceId] });
    }
    highlightSelection({ evidenceId: item.evidenceId, locationId: item.locationId, eventId: item.sourceEventId, characterId: item.challengeNpcIds[0] });
    setInspectorTab("investigation");
    pushToast({
      tone: item.locked ? "info" : action === "chain" ? "success" : "info",
      title: action === "chain" ? "Added to theory chain" : item.locked ? "Go to clue location" : "Evidence note selected",
      detail: item.locked ? `Search ${item.locationName} first.` : item.useHint
    });
  }

  function handleProofTourStep(step: ProofTourStep) {
    if (step.locationId) setSelectedSceneId(step.locationId);
    if (step.time) setTimeValue(timeToMinutes(step.time));
    if (step.eventIds[0]) setHighlightedEventId(step.eventIds[0]);
    if (step.evidenceIds[0]) setSelectedEvidenceId(step.evidenceIds[0]);
    if (step.characterIds[0]) {
      setSelectedCharacterId(step.characterIds[0]);
      setSelectedSuspectId(step.characterIds[0]);
    }
    highlightSelection({ locationId: step.locationId, eventId: step.eventIds[0], evidenceId: step.evidenceIds[0], characterId: step.characterIds[0] });
    if (step.stage === "elimination") setInspectorTab("people");
    else if (step.stage === "evidence" || step.stage === "memory" || step.stage === "contradiction") setInspectorTab("investigation");
    else setInspectorTab("logic");
  }

  function handleGuidedTask(task: GuidedTask) {
    setInspectorTab(task.targetTab);
    if (task.id === "observe") {
      const deathEvent = events.find((event) => event.type === "death") || events.find((event) => event.id === activeCase?.deathEventId);
      if (deathEvent) {
        setHighlightedEventId(deathEvent.id);
        setSelectedSceneId(deathEvent.locationId);
        setTimeValue(timeToMinutes(deathEvent.time));
        highlightSelection({ eventId: deathEvent.id, locationId: deathEvent.locationId });
      } else {
        setTimeValue(timeToMinutes("21:47"));
      }
      return;
    }
    if (task.id === "search") {
      const scene = selectedScene || scenes.find((item) => item.evidenceIds.length > 0) || scenes[0];
      if (scene) {
        setSelectedSceneId(scene.id);
        highlightSelection({ locationId: scene.id });
      }
      return;
    }
    if (task.id === "question") {
      const character = selectedCharacter || characters[0];
      if (character) {
        setSelectedCharacterId(character.id);
        highlightSelection({ characterId: character.id });
      }
      return;
    }
    if (task.id === "challenge") {
      const evidence = discoveredEvidence[0];
      const character =
        characters.find((item) => evidence?.relatedCharacterIds.includes(item.id)) ||
        selectedCharacter ||
        characters[0];
      if (evidence) setSelectedEvidenceId(evidence.id);
      if (character) setSelectedCharacterId(character.id);
      highlightSelection({ evidenceId: evidence?.id, characterId: character?.id });
      return;
    }
    if (task.id === "reveal") {
      showLogic();
    }
  }

  function switchRuntime(next: RuntimeMode) {
    if (next === runtimeMode) return;
    setRuntimeMode(next);
    setReplaying(false);
    if (next === "static-demo") {
      const saved = loadLocal<{ runtimeState?: DemoRuntimeState }>(storageKey, {});
      hydrateStatic(saved.runtimeState?.mode === "static-demo" ? saved.runtimeState : createStaticDemoRuntime(caseTemplateId));
      return;
    }
    setWorld(null);
    setEvents([]);
    setActiveCase(null);
    setSession(null);
    setSnapshot(null);
    setProgress(initialProgress);
    setStatus("Switched to Server Runtime. New towns will use SQLite and can call DeepSeek for NPC surface replies.");
  }

  function switchCaseTemplate(next: CaseTemplateId) {
    setCaseTemplateId(next);
    if (runtimeMode === "static-demo" && caseMode === "premium") {
      hydrateStatic(createStaticDemoRuntime(next));
      setReplaying(false);
      setLastAiSafety(null);
      setStatus(`Case template switched: ${caseTemplates.find((item) => item.id === next)?.title || next}`);
    }
  }

  function selectGraphEvidence(evidenceId: string) {
    setSelectedEvidenceId(evidenceId);
    const scene = scenes.find((item) => item.evidenceIds.includes(evidenceId));
    if (scene) setSelectedSceneId(scene.id);
    highlightSelection({ evidenceId, locationId: scene?.id });
    setInspectorTab("investigation");
  }

  function selectGraphEvent(eventId: string) {
    const event = events.find((item) => item.id === eventId);
    setHighlightedEventId(eventId);
    if (event) {
      setSelectedSceneId(event.locationId);
      setTimeValue(timeToMinutes(event.time));
      highlightSelection({ eventId, locationId: event.locationId });
    }
    setInspectorTab("events");
  }

  function patchAuthoring(path: string, value: unknown) {
    setContentSeedPreviewed(false);
    setAuthoringDraft((current) => applyAuthoringPatch(current, { op: "set", path, value }));
  }

  function updateContentSelection(next: Partial<DetectiveContentAuthoringSelection>) {
    setContentSeedPreviewed(false);
    setContentSelection((current) => selectDefaultDetectiveContentAuthoringSelection(detectiveContentPack, { ...current, ...next }));
  }

  function toggleContentRole(roleId: string) {
    const current = new Set(contentAuthoringGuide.selection.roleIds);
    if (current.has(roleId)) current.delete(roleId);
    else current.add(roleId);
    updateContentSelection({ roleIds: Array.from(current) });
  }

  function toggleContentEvidenceType(evidenceTypeId: string) {
    const current = new Set(contentAuthoringGuide.selection.evidenceTypeIds);
    if (current.has(evidenceTypeId)) current.delete(evidenceTypeId);
    else current.add(evidenceTypeId);
    updateContentSelection({ evidenceTypeIds: Array.from(current) });
  }

  function previewContentSeed() {
    setContentSeedPreviewed(true);
    setAuthoringTab("content");
    setAuthoringStatus(`Preview Content Seed: ${contentAuthoringGuide.patches.length} safe text fields would change for ${contentAuthoringGuide.caseType?.label || "selected case type"}. No ids, clue order, suspect matrix, or proof structure will be changed.`);
  }

  function applyContentSeed() {
    if (!contentAuthoringGuide.patches.length) {
      setAuthoringStatus("No changes pending. The current draft already matches this content seed, so no Gallery backup was created.");
      return;
    }
    const backup = createContentSeedBackupEntry(authoringDraft);
    mergeGalleryEntries([backup]);
    let next = authoringDraft;
    for (const patch of contentAuthoringGuide.patches) {
      next = applyAuthoringPatch(next, { op: "set", path: patch.path, value: patch.after });
    }
    const report = validateAuthoringDraft(next);
    const createdAt = new Date().toISOString();
    const historyEntry: ContentSeedHistoryEntry = {
      id: `content-seed:${createdAt}`,
      createdAt,
      beforeTitle: authoringDraft.caseFromLog.deductionCase.title,
      afterTitle: next.caseFromLog.deductionCase.title,
      caseTypeLabel: contentAuthoringGuide.caseType?.label || contentAuthoringGuide.selection.caseTypeId,
      patchCount: contentAuthoringGuide.patches.length,
      backupTitle: backup.title,
      draft: cloneLocal(authoringDraft),
      validation: {
        valid: report.valid,
        errorCount: report.errors.length
      }
    };
    setContentSeedHistory((current) => [historyEntry, ...current].slice(0, 5));
    setAuthoringDraft(next);
    setContentSeedPreviewed(true);
    setAuthoringStatus(report.valid
      ? `Apply Content Seed complete: ${contentAuthoringGuide.patches.length} browser-local text fields updated. Undo Content Seed or Gallery backup "${backup.title}" can restore the prior draft.`
      : `Apply Content Seed complete, but validation now has ${report.errors.length} blockers. The draft is kept; use Undo Content Seed or load Gallery backup "${backup.title}" to revert.`);
  }

  function undoLatestContentSeed() {
    const latest = contentSeedHistory[0];
    if (!latest) {
      setAuthoringStatus("No Content Seed undo entry is available in this browser session.");
      return;
    }
    setAuthoringDraft({ ...cloneLocal(latest.draft), updatedAt: new Date().toISOString() });
    resetAuthoringSelection();
    setContentSeedHistory((current) => current.slice(1));
    setContentSeedPreviewed(false);
    setAuthoringTab("content");
    setAuthoringStatus(`Undo Content Seed restored "${latest.beforeTitle}" from the session audit trail. Gallery backup "${latest.backupTitle}" remains available.`);
  }

  function focusAuthoringIssue(issue: AuthoringValidationReport["issues"][number]) {
    const text = `${issue.path} ${issue.message}`;
    if (text.includes("characters") || text.includes("characterId")) {
      setAuthoringTab("characters");
      const hit = authoringCase.characters.find((item) => text.includes(item.id) || text.includes(item.name));
      if (hit) setAuthoringCharacterId(hit.id);
      return;
    }
    if (text.includes("evidence")) {
      setAuthoringTab("evidence");
      const hit = authoringCase.evidence.find((item) => text.includes(item.id) || text.includes(item.title));
      if (hit) setAuthoringEvidenceId(hit.id);
      return;
    }
    if (text.includes("scenes") || text.includes("scene")) {
      setAuthoringTab("scenes");
      const hit = authoringCase.scenes.find((item) => text.includes(item.id) || text.includes(item.name));
      if (hit) setAuthoringSceneId(hit.id);
      return;
    }
    if (text.includes("timeline") || text.includes("trueTimeline") || text.includes("event")) {
      setAuthoringTab("timeline");
      const hit = authoringCase.truth.trueTimeline.find((item) => text.includes(item.id));
      if (hit) setAuthoringTimelineId(hit.id);
      return;
    }
    setAuthoringTab("logic");
  }

  function runAuthoringCoachNextAction() {
    if (authoringBlocker) {
      focusAuthoringIssue(authoringBlocker);
      setAuthoringStatus(`Authoring Workflow Coach: fix validation blocker - ${safeCoachMessage(authoringBlocker.message)}`);
      return;
    }
    if (contentSeedHistory[0]) {
      setAuthoringTab("content");
      setAuthoringStatus("Authoring Workflow Coach: review Applied safe diff, then use Undo Content Seed, Gallery backup, Run Draft, or Save to Gallery.");
      return;
    }
    if (contentAuthoringGuide.patches.length > 0 && !contentSeedPreviewed) {
      previewContentSeed();
      setAuthoringStatus(`Authoring Workflow Coach: Preview Content Seed opened ${contentAuthoringGuide.patches.length} safe text patches for Safe Diff Review.`);
      return;
    }
    if (contentAuthoringGuide.patches.length > 0) {
      setAuthoringTab("content");
      setAuthoringStatus("Authoring Workflow Coach: review Pending safe diff, then apply the content seed or adjust the selection.");
      return;
    }
    if (authoringReport.valid) {
      setAuthoringStatus("Authoring Workflow Coach: draft is runnable. Use Run Draft for playtest or Save to Gallery for browser-local reuse.");
      return;
    }
    setAuthoringTab("logic");
    setAuthoringStatus("Authoring Workflow Coach: review Rule Report before running this draft.");
  }

  function authoringEvidenceReferences(evidenceId: string) {
    const refs: string[] = [];
    for (const scene of authoringCase.scenes) {
      if (scene.evidenceIds.includes(evidenceId)) refs.push(`\u573a\u666f\uff1a${scene.name}`);
    }
    for (const event of authoringCase.truth.trueTimeline) {
      if (event.contradictedByEvidenceIds.includes(evidenceId)) refs.push(`\u65f6\u95f4\u7ebf\uff1a${event.time}`);
    }
    for (const row of authoringCase.logicPuzzle.suspectMatrix) {
      if (row.excludedByEvidenceIds.includes(evidenceId)) refs.push(`\u6392\u9664\u77e9\u9635\uff1a${row.name}`);
    }
    for (const step of authoringCase.logicPuzzle.criticalReasoningChain) {
      if (step.evidenceIds.includes(evidenceId)) refs.push(`\u63a8\u7406\u94fe\uff1a${step.id}`);
    }
    if (authoringCase.logicPuzzle.requiredClueOrder.includes(evidenceId)) refs.push("\u5fc5\u8981\u7ebf\u7d22\u987a\u5e8f");
    return refs;
  }

  function loadPremiumTemplate(templateId: CaseTemplateId = caseTemplateId) {
    const draft = createPremiumAuthoringDraft(templateId);
    setAuthoringDraft(draft);
    setAuthoringCharacterId("");
    setAuthoringEvidenceId("");
    setAuthoringSceneId("");
    setAuthoringTimelineId("");
    setAuthoringExportText("");
    setAuthoringImportText("");
    setCaseTemplateId(templateId);
    setContentSeedHistory([]);
    setContentSeedPreviewed(false);
    setAuthoringStatus("\u5df2\u6062\u590d\u6848\u4f8b\u6a21\u677f\uff0c\u53ef\u7ee7\u7eed\u7f16\u8f91\u6216\u76f4\u63a5 Run Draft\u3002");
  }

  function resetAuthoringSelection() {
    setAuthoringCharacterId("");
    setAuthoringEvidenceId("");
    setAuthoringSceneId("");
    setAuthoringTimelineId("");
  }

  function mergeGalleryEntries(entries: CaseGalleryEntry[]) {
    setCaseGalleryEntries((current) => {
      const byId = new Map(current.map((entry) => [entry.id, entry]));
      for (const entry of entries) byId.set(entry.id, entry);
      return Array.from(byId.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
  }

  function saveAuthoringToGallery() {
    const entry = createCaseGalleryEntry(authoringDraft, { source: "local" });
    mergeGalleryEntries([entry]);
    setAuthoringStatus(`Saved "${entry.title}" to the browser-local Case Gallery.`);
    setAuthoringTab("gallery");
  }

  function loadGalleryEntry(entry: CaseGalleryEntry) {
    setAuthoringDraft({ ...cloneLocal(entry.draft), source: entry.source === "built-in" ? "premium-template" : entry.draft.source, updatedAt: new Date().toISOString() });
    resetAuthoringSelection();
    if (entry.templateId) setCaseTemplateId(entry.templateId);
    setAuthoringExportText("");
    setContentSeedHistory([]);
    setContentSeedPreviewed(false);
    setAuthoringTab("case");
    setAuthoringStatus(`Loaded "${entry.title}" from Case Gallery.`);
  }

  function runGalleryEntry(entry: CaseGalleryEntry) {
    if (!entry.validation.valid) {
      setAuthoringStatus(`"${entry.title}" is not runnable. Fix validation errors before running.`);
      return;
    }
    setAuthoringDraft(cloneLocal(entry.draft));
    resetAuthoringSelection();
    setContentSeedHistory([]);
    setContentSeedPreviewed(false);
    runDraftFrom(entry.draft, `Created a temporary Static Demo Runtime from gallery case "${entry.title}".`);
  }

  function deleteGalleryEntry(entryId: string) {
    setCaseGalleryEntries((current) => current.filter((entry) => entry.id !== entryId));
    setAuthoringStatus("Local gallery draft deleted. Built-in templates remain available.");
  }

  function exportGalleryEntry(entry: CaseGalleryEntry) {
    setAuthoringExportText(exportAuthoringJson(entry.draft));
    setAuthoringStatus(`Exported "${entry.title}" as AuthoringDraft JSON.`);
  }

  function deleteAuthoringEvidence() {
    if (!authoringEvidence) return;
    const refs = authoringEvidenceReferences(authoringEvidence.id);
    setContentSeedPreviewed(false);
    setAuthoringDraft((current) => applyAuthoringPatch(current, { op: "delete-array-item", path: "caseFromLog.deductionCase.evidence", id: authoringEvidence.id }));
    setAuthoringEvidenceId("");
    setAuthoringStatus(refs.length ? `\u8bc1\u636e\u5df2\u5220\u9664\uff0c\u4f46\u4ecd\u88ab\u5f15\u7528\uff1a${refs.join("\uff1b")}\u3002Rule Report \u4f1a\u963b\u65ad Run Draft\u3002` : "\u8bc1\u636e\u5df2\u5220\u9664\uff0c\u672a\u53d1\u73b0\u6b8b\u7559\u5f15\u7528\u3002");
  }

  function importAuthoringJson() {
    try {
      const parsed = JSON.parse(authoringImportText);
      const importedEntries = importCaseGalleryEntries(parsed, authoringDraft);
      if (parsed?.version === 1 && Array.isArray(parsed?.entries)) {
        if (!importedEntries.length) throw new Error("Gallery bundle did not contain valid AuthoringDraft entries.");
        mergeGalleryEntries(importedEntries.map((entry) => ({ ...entry, source: "imported" })));
        setAuthoringTab("gallery");
        setAuthoringStatus(`Imported ${importedEntries.length} gallery entries into browser-local Case Gallery.`);
        return;
      }
      if (importedEntries.length) {
        const entry = { ...importedEntries[0], source: "imported" as const };
        setAuthoringDraft(entry.draft);
        mergeGalleryEntries([entry]);
        resetAuthoringSelection();
        setContentSeedHistory([]);
        setContentSeedPreviewed(false);
      } else if (parsed?.id && parsed?.truth && parsed?.logicPuzzle) {
        const next = cloneLocal(authoringDraft);
        next.caseFromLog.deductionCase = parsed;
        next.source = "imported";
        next.updatedAt = new Date().toISOString();
        setAuthoringDraft(next);
        setContentSeedHistory([]);
        setContentSeedPreviewed(false);
      } else {
        throw new Error("JSON must be an AuthoringDraft or a standalone DeductionCase.");
      }
      setAuthoringStatus("Import complete. Draft was loaded and saved to the browser-local Case Gallery.");
    } catch (error) {
      setAuthoringStatus(error instanceof Error ? error.message : "Import failed: invalid JSON.");
    }
  }

  function exportAuthoring(kind: "json" | "markdown") {
    const text = kind === "json" ? exportAuthoringJson(authoringDraft) : exportAuthoringMarkdown(authoringDraft);
    setAuthoringExportText(text);
    setAuthoringStatus(kind === "json" ? "Runnable case JSON generated." : "Case Markdown notes generated.");
  }

  function exportGalleryBundle() {
    setAuthoringExportText(exportCaseGalleryBundle(caseGalleryEntries));
    setAuthoringStatus(`Exported ${caseGalleryEntries.length} local gallery drafts as a CaseGalleryBundle.`);
  }

  function runDraftFrom(draft: AuthoringDraft, message: string) {
    const report = validateAuthoringDraft(draft);
    if (!report.valid) {
      setAuthoringStatus("The current draft failed hard logic validation and cannot run as a playable case.");
      return;
    }
    const stamp = new Date().toISOString();
    const runtimeState: DemoRuntimeState = {
      mode: "static-demo",
      world: cloneLocal(draft.world),
      events: cloneLocal(draft.events),
      activeCase: cloneLocal(draft.caseFromLog),
      session: {
        id: `session-authoring-${Date.now()}`,
        worldId: draft.world.id,
        caseId: draft.caseFromLog.id,
        playerId: "player-authoring",
        displayName: "Author Test",
        discoveredEvidenceIds: [],
        interrogationLog: [],
        createdAt: stamp,
        updatedAt: stamp
      },
      progress: { ...initialProgress, joinedInvestigation: true },
      revealText: ""
    };
    setRuntimeMode("static-demo");
    hydrateStatic(runtimeState);
    setAppMode("play");
    setStatus(message);
  }

  function runAuthoringDraft() {
    runDraftFrom(authoringDraft, "Created a temporary Static Demo Runtime from the current Authoring Draft.");
  }

  const campaignStudyRecorder = campaignStudy.visible ? (
    <CampaignStudyRecorder
      runs={campaignStudy.collection.runs}
      currentRun={campaignStudy.currentRun}
      operations={campaignStudy.operations}
      elapsedSeconds={campaignStudy.elapsedSeconds}
      canStart={campaignStudy.canStart}
      startBlockedReason={campaignStudy.startBlockedReason}
      start={campaignStudy.start}
      abandon={campaignStudy.abandon}
      finalize={campaignStudy.finalize}
      exportStudy={() => downloadTextFile(CAMPAIGN_STUDY_EXPORT_FILE, JSON.stringify(campaignStudy.exportData(), null, 2), "application/json;charset=utf-8")}
      reset={campaignStudy.reset}
      incrementMisunderstanding={campaignStudy.incrementMisunderstanding}
      toggleConfusion={campaignStudy.toggleConfusion}
      updateAssessment={campaignStudy.updateAssessment}
    />
  ) : null;
  const selectedInstitutionName = deriveCommandDeckInstitutionName(world, townRuntime, selectedCharacterId);
  const commandDeckContext = useCommandDeckContext({
    inspectorTab, selectedInstitutionName, selectedCharacter, selectedSceneName: selectedScene?.name,
    selectedSceneId, hasCase: Boolean(activeCase), hasSession: Boolean(session), progress,
    searchableEvidenceIds: sceneEvidence.filter((item) => item.discoverable && !session?.discoveredEvidenceIds.includes(item.id)).map((item) => item.id),
    discoveredEvidenceIds: discoveredEvidence.map((item) => item.id), judgementAccepted: Boolean(session?.judgement?.accepted),
    revealAvailable: Boolean(revealText), onSearch: (sceneId) => void discoverFirstSceneEvidence(sceneId),
    onPrepareQuestion: setQuestion, onSelectEvidence: setSelectedEvidenceId, onShowInspector: setInspectorTab, onJoin: () => void joinCase()
  });
  const commandDeck = deriveCampaignCommandDeckViewModel({
    runtimeMode,
    caseLabel: activeCase?.deductionCase.title || world?.name || "Detective Town",
    currentTime: snapshot?.time || minutesToTime(timeValue), suggestedAction,
    institutionLabel: selectedInstitutionName,
    urgency: townBrief?.urgency, tickLabel: townBrief ? `T${townBrief.tick} / ${townBrief.currentPhase}` : undefined,
    heat: townRuntime?.ruleState?.publicOpinion.heat ?? townBrief?.hotLocations[0]?.heat, publicTrust: townRuntime?.ruleState?.publicOpinion.trustInPolice,
    resourcePressure: townBrief?.hotLocations.length ? townBrief.hotLocations.reduce((sum, item) => sum + item.resourcePressure, 0) / townBrief.hotLocations.length : undefined,
    campaign: campaignSession || townRuntime?.campaignSessionSummary, worldLead: worldLead || townRuntime?.worldLeadPreview,
    worldArc: worldArc || townRuntime?.worldArcSummary, directive: worldArcDirective || townRuntime?.worldArcDirectiveSummary,
    pressure: worldPressureCascade || townRuntime?.worldPressureCascadeSummary, socialResponse: townSocialResponse || townRuntime?.townSocialResponseSummary,
    recovery: campaignRecovery || townRuntime?.campaignRecoverySummary,
    guidedJournal: guidedStepJournal[0] ? { status: guidedStepJournal[0].status, label: guidedStepJournal[0].label, headline: guidedStepJournal[0].result || guidedStepJournal[0].nextAction } : undefined,
    worldEvent: visibleEvents[0] ? { status: "visible", label: "World Event", headline: visibleEvents[0].publicSummary } : undefined,
    selectedContext: commandDeckContext.selectedContext, contextActions: commandDeckContext.actions
  });
  if (appMode === "world-graph") {
    return <>{campaignStudyRecorder}<WorldGraphWorkbench runtimeMode={runtimeMode} onBack={() => setAppMode("play")} /></>;
  }

  if (appMode === "authoring") {
    const authoringActorsByTile = new Map<string, WorldMapActor[]>();
    for (const actor of authoringMapSnapshot.actors) {
      const key = `${actor.x}:${actor.y}`;
      authoringActorsByTile.set(key, [...(authoringActorsByTile.get(key) || []), actor]);
    }
    const authoringMarkersByTile = new Map<string, WorldMapMarker[]>();
    for (const marker of authoringMapSnapshot.markers) {
      const key = `${marker.x}:${marker.y}`;
      authoringMarkersByTile.set(key, [...(authoringMarkersByTile.get(key) || []), marker]);
    }
    const allGalleryEntries = [...builtInGalleryEntries, ...caseGalleryEntries];
    const formatGalleryTime = (value: string) => {
      const time = new Date(value);
      return Number.isNaN(time.getTime()) ? value : time.toLocaleString();
    };
    const renderGalleryCard = (entry: CaseGalleryEntry, readonly: boolean) => (
      <article key={entry.id} className={`caseGalleryCard ${entry.validation.valid ? "pass" : "fail"}`} data-testid="case-gallery-card">
        <div className="caseGalleryCardTop">
          <div>
            <p>{entry.source === "built-in" ? "Built-in template" : entry.source === "imported" ? "Imported draft" : "Local draft"}</p>
            <h3>{entry.title}</h3>
          </div>
          <span className={entry.validation.valid ? "runtimePill pass" : "runtimePill fail"}>{entry.validation.valid ? "Runnable" : "Blocked"}</span>
        </div>
        <div className="caseGalleryMeta">
          <span><strong>{entry.validation.evidenceCount}</strong><small>Evidence</small></span>
          <span><strong>{entry.validation.characterCount}</strong><small>Characters</small></span>
          <span><strong>{entry.validation.hardLogicValid ? "Pass" : "Fail"}</strong><small>Hard logic</small></span>
          <span><strong>{formatGalleryTime(entry.updatedAt)}</strong><small>Updated</small></span>
        </div>
        {!entry.validation.valid && entry.validation.errorCount > 0 && (
          <p className="caseGalleryIssue">{entry.validation.errorCount} validation errors must be fixed before this draft can run.</p>
        )}
        <div className="caseGalleryActions">
          <button type="button" onClick={() => loadGalleryEntry(entry)}>Load into Authoring</button>
          <button type="button" onClick={() => runGalleryEntry(entry)} disabled={!entry.validation.valid}>Run Draft</button>
          <button type="button" onClick={() => exportGalleryEntry(entry)}>Export JSON</button>
          {!readonly && <button type="button" className="dangerButton" data-testid="delete-gallery-entry" onClick={() => deleteGalleryEntry(entry.id)}>Delete</button>}
        </div>
      </article>
    );

    return (
      <main className="authoringShell" data-testid="authoring-workbench">
        <aside className="authoringRail">
          <div className="brandBlock">
            <div className="brandIcon"><MapIcon size={24} /></div>
            <div>
              <p>Detective Town</p>
              <h1>Case Authoring</h1>
            </div>
          </div>
          <div className="modeSwitch">
            <button onClick={() => setAppMode("play")}>Play</button>
            <button className="active">Authoring</button>
            <button onClick={() => setAppMode("world-graph")}>Living World Lab</button>
          </div>
          <div className="authoringTabs">
            {[
              ["case", "Case"],
              ["content", "Content"],
              ["characters", "Characters"],
              ["evidence", "Evidence"],
              ["scenes", "Scenes"],
              ["timeline", "Timeline"],
              ["logic", "Logic"],
              ["gallery", "Gallery"]
            ].map(([value, label]) => (
              <button key={value} className={authoringTab === value ? "active" : ""} onClick={() => setAuthoringTab(value as AuthoringTab)}>{label}</button>
            ))}
          </div>

          {authoringTab === "case" && (
            <section className="authoringPanel">
              <h2>Case Basics</h2>
              <label>Case title
                <input data-testid="authoring-title" value={authoringCase.title} onChange={(event) => patchAuthoring("caseFromLog.deductionCase.title", event.target.value)} />
              </label>
              <label>Public case file
                <textarea value={authoringCase.publicCaseFile} onChange={(event) => patchAuthoring("caseFromLog.deductionCase.publicCaseFile", event.target.value)} />
              </label>
              <label>Theme
                <input value={authoringCase.theme} onChange={(event) => patchAuthoring("caseFromLog.deductionCase.theme", event.target.value)} />
              </label>
              <label>Premise
                <textarea value={authoringCase.premise} onChange={(event) => patchAuthoring("caseFromLog.deductionCase.premise", event.target.value)} />
              </label>
            </section>
          )}

          {authoringTab === "content" && (
            <section className="authoringPanel contentGuidePanel" data-testid="content-authoring-guide">
              <div className="contentGuideHeader">
                <div>
                  <p>Browser-local template guide</p>
                  <h2>Content-Guided Case Authoring</h2>
                </div>
                <span className="runtimePill">localStorage only</span>
              </div>
              <p className="caseGalleryNote">Uses read-only <code>content/detective-v1</code> tables to seed safe public-facing draft text. It does not write repo JSON, call `/api/*`, change ids, or edit playable proof structure.</p>
              <div className="contentGuideMetricGrid" data-testid="authored-content-expansion">
                <span><strong>{detectiveContentSummary.caseTypeCount}</strong><small>Case types</small></span>
                <span><strong>{detectiveContentSummary.eventArchetypeCount}</strong><small>Events</small></span>
                <span><strong>{detectiveContentSummary.progressionLineCount}</strong><small>Growth lines</small></span>
                <span><strong>{detectiveContentSummary.authored.clusterCount}</strong><small>Authored clusters</small></span>
              </div>
              <label>Case type
                <select aria-label="Content case type" value={contentAuthoringGuide.selection.caseTypeId} onChange={(event) => updateContentSelection({ caseTypeId: event.target.value })}>
                  {[...detectiveContentPack.caseTypes].sort((left, right) => (right.weight - left.weight) || left.id.localeCompare(right.id)).map((row) => (
                    <option key={row.id} value={row.id}>{row.label} / weight {row.weight}</option>
                  ))}
                </select>
              </label>
              <label>Location
                <select aria-label="Content location" value={contentAuthoringGuide.selection.locationId} onChange={(event) => updateContentSelection({ locationId: event.target.value })}>
                  {contentAuthoringGuide.compatible.locations.map((row) => (
                    <option key={row.id} value={row.id}>{row.label} / {row.kind}</option>
                  ))}
                </select>
              </label>
              <label>Motive
                <select aria-label="Content motive" value={contentAuthoringGuide.selection.motiveId} onChange={(event) => updateContentSelection({ motiveId: event.target.value })}>
                  {contentAuthoringGuide.compatible.motives.map((row) => (
                    <option key={row.id} value={row.id}>{row.label} / {row.category}</option>
                  ))}
                </select>
              </label>
              <label>Red herring pattern
                <select aria-label="Content red herring pattern" value={contentAuthoringGuide.selection.redHerringPatternId} onChange={(event) => updateContentSelection({ redHerringPatternId: event.target.value })}>
                  {contentAuthoringGuide.compatible.redHerringPatterns.map((row) => (
                    <option key={row.id} value={row.id}>{row.label} / risk {row.risk}</option>
                  ))}
                </select>
              </label>
              <label>Resource
                <select aria-label="Content resource" value={contentAuthoringGuide.selection.resourceId} onChange={(event) => updateContentSelection({ resourceId: event.target.value })}>
                  {contentAuthoringGuide.compatible.resources.map((row) => (
                    <option key={row.id} value={row.id}>{row.label} / pressure {row.pressure}</option>
                  ))}
                </select>
              </label>
              <label>Faction
                <select aria-label="Content faction" value={contentAuthoringGuide.selection.factionId} onChange={(event) => updateContentSelection({ factionId: event.target.value })}>
                  {contentAuthoringGuide.compatible.factions.map((row) => (
                    <option key={row.id} value={row.id}>{row.label} / {row.kind}</option>
                  ))}
                </select>
              </label>
              <label>Event archetype
                <select aria-label="Content event archetype" value={contentAuthoringGuide.selection.eventArchetypeId} onChange={(event) => updateContentSelection({ eventArchetypeId: event.target.value })}>
                  {contentAuthoringGuide.compatible.eventArchetypes.map((row) => (
                    <option key={row.id} value={row.id}>{row.label} / risk {row.risk}</option>
                  ))}
                </select>
              </label>
              <label>Growth line
                <select aria-label="Content growth line" value={contentAuthoringGuide.selection.progressionLineId} onChange={(event) => updateContentSelection({ progressionLineId: event.target.value })}>
                  {contentAuthoringGuide.compatible.progressionLines.map((row) => (
                    <option key={row.id} value={row.id}>{row.label} / {row.stageCount} stages</option>
                  ))}
                </select>
              </label>
              <div className="contentGuideMetricGrid">
                <span><strong>{contentAuthoringGuide.coverage.compatibleEvidenceTypeCount}</strong><small>Compatible evidence</small></span>
                <span><strong>{contentAuthoringGuide.coverage.compatibleRoleCount}</strong><small>Compatible roles</small></span>
                <span><strong>{contentAuthoringGuide.coverage.compatibleMotiveCount}</strong><small>Compatible motives</small></span>
                <span><strong>{contentAuthoringGuide.coverage.compatibleLocationCount}</strong><small>Locations</small></span>
                <span><strong>{contentAuthoringGuide.coverage.compatibleResourceCount}</strong><small>Resources</small></span>
                <span><strong>{contentAuthoringGuide.coverage.compatibleFactionCount}</strong><small>Factions</small></span>
                <span><strong>{contentAuthoringGuide.coverage.compatibleEventArchetypeCount}</strong><small>Events</small></span>
                <span><strong>{contentAuthoringGuide.coverage.compatibleProgressionLineCount}</strong><small>Growth lines</small></span>
                <span><strong>{contentAuthoringGuide.riskSummary.averageEvidenceContaminationRisk}</strong><small>Avg risk</small></span>
                <span><strong>{contentAuthoringGuide.riskSummary.redHerringRisk}</strong><small>Red herring risk</small></span>
                <span><strong>{contentAuthoringGuide.riskSummary.resourcePressure}</strong><small>Resource pressure</small></span>
                <span><strong>{contentAuthoringGuide.riskSummary.eventRisk}</strong><small>Event risk</small></span>
                <span><strong>{contentAuthoringGuide.riskSummary.progressionStageCount}</strong><small>Growth stages</small></span>
              </div>
              <div className="contentGuidePicker">
                <h3>Roles</h3>
                {contentAuthoringGuide.compatible.roles.map((row) => (
                  <label key={row.id} className="checkRow">
                    <input type="checkbox" checked={contentAuthoringGuide.selection.roleIds.includes(row.id)} onChange={() => toggleContentRole(row.id)} />
                    <span>{row.label} - {row.publicDescription}</span>
                  </label>
                ))}
              </div>
              <div className="contentGuidePicker">
                <h3>Evidence types</h3>
                {contentAuthoringGuide.compatible.evidenceTypes.map((row) => (
                  <label key={row.id} className="checkRow">
                    <input type="checkbox" checked={contentAuthoringGuide.selection.evidenceTypeIds.includes(row.id)} onChange={() => toggleContentEvidenceType(row.id)} />
                    <span>{row.label} - risk {row.contaminationRisk}: {row.publicDescription}</span>
                  </label>
                ))}
              </div>
              <div className="contentSeedPreview" data-testid="content-seed-preview">
                <h3>Preview Content Seed</h3>
                <div className="contentSeedSummary">
                  <span><strong>{contentAuthoringGuide.preview.title}</strong><small>Case title</small></span>
                  <span><strong>{contentAuthoringGuide.preview.theme}</strong><small>Theme</small></span>
                  <span><strong>{contentAuthoringGuide.preview.evidenceLabels.join(", ") || "None"}</strong><small>Evidence labels</small></span>
                  <span><strong>{contentAuthoringGuide.preview.roleLabels.join(", ") || "None"}</strong><small>Role labels</small></span>
                  <span><strong>{contentAuthoringGuide.preview.worldSystemLabels.join(" / ") || "None"}</strong><small>World-system labels</small></span>
                  <span><strong>{contentAuthoringGuide.preview.progressionLineLabel}</strong><small>Growth line</small></span>
                </div>
                <p>{contentAuthoringGuide.preview.publicCaseFile}</p>
                <div className="contentPatchList">
                  {(["case", "characters", "evidence", "logic"] as const).map((group) => {
                    const patches = contentAuthoringGuide.patches.filter((patch) => patch.group === group);
                    if (!patches.length) return null;
                    return (
                      <section key={group} className="contentPatchGroup" data-testid={`content-patch-group-${group}`}>
                        <h4>{group === "case" ? "Case" : group === "characters" ? "Characters" : group === "evidence" ? "Evidence" : "Logic"}</h4>
                        {patches.slice(0, 12).map((patch) => (
                          <span key={patch.path}><strong>{patch.label}</strong><small>{patch.path}</small></span>
                        ))}
                      </section>
                    );
                  })}
                  {!contentAuthoringGuide.patches.length && <span><strong>No changes pending</strong><small>The current draft already matches this content seed.</small></span>}
                </div>
                <p className="caseGalleryNote">Apply saves the current draft to Local Case Gallery first. IDs, suspect matrix, clue order, timeline, and proof structure remain unchanged.</p>
              </div>
              <div className="safeDiffPanel" data-testid="safe-diff-review">
                <div className="contentSeedTrailHeader">
                  <div>
                    <p>Browser-local review</p>
                    <h3>Safe Diff Review</h3>
                  </div>
                  <span className="runtimePill">{contentSeedHistory[0] ? "applied" : "pending"}</span>
                </div>
                <section className="safeDiffSection" data-testid="pending-safe-diff">
                  <div className="safeDiffSectionHeader">
                    <strong>Pending safe diff</strong>
                    <span>{pendingSafeDiff.length} fields</span>
                  </div>
                  <p className="caseGalleryNote">Preview-only changes from the selected content seed. Only public-facing text fields are listed.</p>
                  <div className="safeDiffGroups">
                    {safeDiffGroups.map((group) => {
                      const items = pendingSafeDiff.filter((item) => item.group === group.id);
                      if (!items.length) return null;
                      return (
                        <section key={group.id} className="safeDiffGroup" data-testid={`pending-safe-diff-${group.id}`}>
                          <h4>{group.label}</h4>
                          {items.slice(0, 12).map((item) => (
                            <article key={`${item.field}:${item.label}`} className="safeDiffCard">
                              <div className="safeDiffCardTop">
                                <strong>{item.label}</strong>
                                <small>{item.field}</small>
                              </div>
                              <div className="safeDiffValues">
                                <div>
                                  <small>Before</small>
                                  <span className="safeDiffValuePreview">{item.before || "(empty)"}</span>
                                  <p>{item.before || "(empty)"}</p>
                                </div>
                                <div>
                                  <small>After</small>
                                  <span className="safeDiffValuePreview">{item.after || "(empty)"}</span>
                                  <p>{item.after || "(empty)"}</p>
                                </div>
                              </div>
                            </article>
                          ))}
                        </section>
                      );
                    })}
                    {!pendingSafeDiff.length && <p className="caseGalleryNote">No pending safe diff. The current draft already matches this content seed.</p>}
                  </div>
                </section>
                {contentSeedHistory[0] && (
                  <section className="safeDiffSection" data-testid="applied-safe-diff">
                    <div className="safeDiffSectionHeader">
                      <strong>Applied safe diff</strong>
                      <span>{appliedSafeDiff.length} fields / {contentSeedHistory[0].validation.valid ? "validation pass" : `${contentSeedHistory[0].validation.errorCount} blockers`}</span>
                    </div>
                    <p className="caseGalleryNote">Compared from the session before snapshot to the current draft. Gallery backup: <strong>{contentSeedHistory[0].backupTitle}</strong>.</p>
                    <div className="safeDiffGroups">
                      {safeDiffGroups.map((group) => {
                        const items = appliedSafeDiff.filter((item) => item.group === group.id);
                        if (!items.length) return null;
                        return (
                          <section key={group.id} className="safeDiffGroup" data-testid={`applied-safe-diff-${group.id}`}>
                            <h4>{group.label}</h4>
                            {items.slice(0, 12).map((item) => (
                              <article key={`${item.field}:${item.label}`} className="safeDiffCard">
                                <div className="safeDiffCardTop">
                                  <strong>{item.label}</strong>
                                  <small>{item.field}</small>
                                </div>
                                <div className="safeDiffValues">
                                  <div>
                                    <small>Before</small>
                                    <span className="safeDiffValuePreview">{item.before || "(empty)"}</span>
                                    <p>{item.before || "(empty)"}</p>
                                  </div>
                                  <div>
                                    <small>After</small>
                                    <span className="safeDiffValuePreview">{item.after || "(empty)"}</span>
                                    <p>{item.after || "(empty)"}</p>
                                  </div>
                                </div>
                              </article>
                            ))}
                          </section>
                        );
                      })}
                      {!appliedSafeDiff.length && <p className="caseGalleryNote">No applied safe diff is active. Undo has restored the pre-apply draft or no seed has been applied.</p>}
                    </div>
                  </section>
                )}
              </div>
              <div className="contentSeedTrail" data-testid="content-seed-trail">
                <div className="contentSeedTrailHeader">
                  <div>
                    <p>Session-only audit trail</p>
                    <h3>Content Seed Undo</h3>
                  </div>
                  <span className="runtimePill">{contentSeedHistory.length} recent</span>
                </div>
                {contentSeedHistory[0] ? (
                  <div className="contentSeedUndoCard">
                    <span><strong>{contentSeedHistory[0].beforeTitle}</strong><small>Before</small></span>
                    <span><strong>{contentSeedHistory[0].afterTitle}</strong><small>After</small></span>
                    <span><strong>{contentSeedHistory[0].patchCount}</strong><small>Safe text patches</small></span>
                    <span><strong>{contentSeedHistory[0].validation.valid ? "Pass" : `${contentSeedHistory[0].validation.errorCount} blockers`}</strong><small>Post-apply validation</small></span>
                    <p>Latest seed: {contentSeedHistory[0].caseTypeLabel}. The Gallery snapshot remains available as <strong>{contentSeedHistory[0].backupTitle}</strong>.</p>
                    <button data-testid="undo-content-seed" type="button" onClick={undoLatestContentSeed}>Undo Content Seed</button>
                  </div>
                ) : (
                  <p className="caseGalleryNote">No Content Seed changes in this browser session. Apply a non-empty seed to create one undo entry and a Gallery backup.</p>
                )}
              </div>
              <div className="authoringActions">
                <button data-testid="preview-content-seed" type="button" onClick={previewContentSeed}>Preview Content Seed</button>
                <button data-testid="apply-content-seed" type="button" className="primaryButton" onClick={applyContentSeed} disabled={!contentAuthoringGuide.patches.length}>Apply Content Seed</button>
              </div>
            </section>
          )}

          {authoringTab === "characters" && authoringCharacter && (
            <section className="authoringPanel">
              <h2>Characters</h2>
              <select value={authoringCharacter.id} onChange={(event) => setAuthoringCharacterId(event.target.value)}>
                {authoringCase.characters.map((character) => <option key={character.id} value={character.id}>{character.name} - {character.role}</option>)}
              </select>
              <label>Name<input value={authoringCharacter.name} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.characters.${authoringCase.characters.findIndex((item) => item.id === authoringCharacter.id)}.name`, event.target.value)} /></label>
              <label>Role<input value={authoringCharacter.role} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.characters.${authoringCase.characters.findIndex((item) => item.id === authoringCharacter.id)}.role`, event.target.value)} /></label>
              <label>Public bio<textarea value={authoringCharacter.publicBio} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.characters.${authoringCase.characters.findIndex((item) => item.id === authoringCharacter.id)}.publicBio`, event.target.value)} /></label>
              <label>Testimony<textarea value={authoringCharacter.initialStatement} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.characters.${authoringCase.characters.findIndex((item) => item.id === authoringCharacter.id)}.initialStatement`, event.target.value)} /></label>
              <label>Motive surface<textarea value={authoringCharacter.motive} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.characters.${authoringCase.characters.findIndex((item) => item.id === authoringCharacter.id)}.motive`, event.target.value)} /></label>
            </section>
          )}

          {authoringTab === "evidence" && authoringEvidence && (
            <section className="authoringPanel">
              <h2>Evidence</h2>
              <select value={authoringEvidence.id} onChange={(event) => setAuthoringEvidenceId(event.target.value)}>
                {authoringCase.evidence.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
              <label>Title<input value={authoringEvidence.title} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.evidence.${authoringCase.evidence.findIndex((item) => item.id === authoringEvidence.id)}.title`, event.target.value)} /></label>
              <label>Player-visible description<textarea data-testid="authoring-evidence-description" value={authoringEvidence.visibleDescription} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.evidence.${authoringCase.evidence.findIndex((item) => item.id === authoringEvidence.id)}.visibleDescription`, event.target.value)} /></label>
              <label>True meaning<textarea value={authoringEvidence.trueMeaning} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.evidence.${authoringCase.evidence.findIndex((item) => item.id === authoringEvidence.id)}.trueMeaning`, event.target.value)} /></label>
              <label className="checkRow"><input type="checkbox" checked={authoringEvidence.discoverable} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.evidence.${authoringCase.evidence.findIndex((item) => item.id === authoringEvidence.id)}.discoverable`, event.target.checked)} /> Discoverable</label>
              <button data-testid="delete-authoring-evidence" className="dangerButton" onClick={deleteAuthoringEvidence}>Delete Evidence</button>
            </section>
          )}

          {authoringTab === "scenes" && authoringScene && (
            <section className="authoringPanel">
              <h2>Scenes</h2>
              <select value={authoringScene.id} onChange={(event) => setAuthoringSceneId(event.target.value)}>
                {authoringCase.scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.name}</option>)}
              </select>
              <label>Name<input value={authoringScene.name} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.scenes.${authoringCase.scenes.findIndex((item) => item.id === authoringScene.id)}.name`, event.target.value)} /></label>
              <label>Description<textarea value={authoringScene.description} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.scenes.${authoringCase.scenes.findIndex((item) => item.id === authoringScene.id)}.description`, event.target.value)} /></label>
              <label>Evidence IDs<input value={authoringScene.evidenceIds.join(", ")} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.scenes.${authoringCase.scenes.findIndex((item) => item.id === authoringScene.id)}.evidenceIds`, event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} /></label>
            </section>
          )}

          {authoringTab === "timeline" && authoringTimelineEvent && (
            <section className="authoringPanel">
              <h2>Timeline</h2>
              <select value={authoringTimelineEvent.id} onChange={(event) => setAuthoringTimelineId(event.target.value)}>
                {authoringCase.truth.trueTimeline.map((item) => <option key={item.id} value={item.id}>{item.time} - {item.id}</option>)}
              </select>
              <label>Time<input value={authoringTimelineEvent.time} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.truth.trueTimeline.${authoringCase.truth.trueTimeline.findIndex((item) => item.id === authoringTimelineEvent.id)}.time`, event.target.value)} /></label>
              <label>True event<textarea value={authoringTimelineEvent.event} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.truth.trueTimeline.${authoringCase.truth.trueTimeline.findIndex((item) => item.id === authoringTimelineEvent.id)}.event`, event.target.value)} /></label>
              <label>Public version<textarea value={authoringTimelineEvent.publicVersion} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.truth.trueTimeline.${authoringCase.truth.trueTimeline.findIndex((item) => item.id === authoringTimelineEvent.id)}.publicVersion`, event.target.value)} /></label>
              <label>Contradicting evidence IDs<input value={authoringTimelineEvent.contradictedByEvidenceIds.join(", ")} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.truth.trueTimeline.${authoringCase.truth.trueTimeline.findIndex((item) => item.id === authoringTimelineEvent.id)}.contradictedByEvidenceIds`, event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} /></label>
            </section>
          )}

          {authoringTab === "logic" && (
            <section className="authoringPanel">
              <h2>Logic Chain</h2>
              <label>Required clue order
                <input value={authoringCase.logicPuzzle.requiredClueOrder.join(", ")} onChange={(event) => patchAuthoring("caseFromLog.deductionCase.logicPuzzle.requiredClueOrder", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} />
              </label>
              <label>Red herrings
                <textarea value={authoringCase.logicPuzzle.redHerrings.join("\n")} onChange={(event) => patchAuthoring("caseFromLog.deductionCase.logicPuzzle.redHerrings", event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))} />
              </label>
              <div className="matrixEditor">
                {authoringCase.logicPuzzle.suspectMatrix.map((row, index) => (
                  <div key={row.characterId} className="matrixEditorRow">
                    <strong>{row.name}</strong>
                    <label><input type="checkbox" checked={row.motive} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.logicPuzzle.suspectMatrix.${index}.motive`, event.target.checked)} /> Motive</label>
                    <label><input type="checkbox" checked={row.means} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.logicPuzzle.suspectMatrix.${index}.means`, event.target.checked)} /> Means</label>
                    <label><input type="checkbox" checked={row.opportunity} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.logicPuzzle.suspectMatrix.${index}.opportunity`, event.target.checked)} /> Opportunity</label>
                    <input value={row.excludedByEvidenceIds.join(", ")} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.logicPuzzle.suspectMatrix.${index}.excludedByEvidenceIds`, event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>

        <section className="authoringStage">
          <header className="stageTopbar">
            <div>
              <p>Visual preview</p>
              <h2>{authoringCase.title}</h2>
            </div>
            <div className="runDraftControl">
              <button data-testid="run-authoring-draft" className="primaryButton" onClick={runAuthoringDraft} disabled={!authoringReport.valid}><Play size={15} /> Run Draft</button>
              {!authoringReport.valid && authoringBlocker && (
                <button className="runDraftBlocker" type="button" onClick={() => focusAuthoringIssue(authoringBlocker)}>
                  Blocked: {authoringBlocker.message}
                </button>
              )}
            </div>
          </header>
          {authoringTab === "gallery" ? (
            <section className="actionPanel caseGalleryPanel" data-testid="case-gallery-panel">
              <div className="caseGalleryHeader">
                <div>
                  <p>Browser-local case library</p>
                  <h2><Database size={16} /> Local Case Gallery</h2>
                </div>
                <span className="runtimePill">{caseGalleryEntries.length} local / {builtInGalleryEntries.length} built-in</span>
              </div>
              <div className="caseGallerySummary">
                <span><strong>{allGalleryEntries.filter((entry) => entry.validation.valid).length}</strong><small>Runnable</small></span>
                <span><strong>{allGalleryEntries.filter((entry) => !entry.validation.valid).length}</strong><small>Blocked</small></span>
                <span><strong>{allGalleryEntries.reduce((sum, entry) => sum + entry.validation.evidenceCount, 0)}</strong><small>Total evidence</small></span>
              </div>
              <p className="caseGalleryNote">Gallery data stays in this browser under <code>{caseGalleryStorageKey}</code>. It is safe for Static Demo deployments and never calls `/api/*`.</p>
              <div className="caseGallerySectionHeader">
                <h3>Built-in Premium Templates</h3>
                <span>Read-only</span>
              </div>
              <div className="caseGalleryGrid">
                {builtInGalleryEntries.map((entry) => renderGalleryCard(entry, true))}
              </div>
              <div className="caseGallerySectionHeader">
                <h3>Local Drafts</h3>
                <span>{caseGalleryEntries.length} saved</span>
              </div>
              {caseGalleryEntries.length === 0 ? (
                <div className="galleryEmptyState" data-testid="case-gallery-empty">
                  <strong>No local drafts saved yet.</strong>
                  <span>Use Save to Gallery after editing a template. Imports and exports stay browser-local unless you copy the JSON out.</span>
                </div>
              ) : (
                <div className="caseGalleryGrid">
                  {caseGalleryEntries.map((entry) => renderGalleryCard(entry, false))}
                </div>
              )}
            </section>
          ) : (
            <>
              <section className="pixelMapWrap compactMap" data-testid="authoring-map">
                <div className="pixelMap" style={{ gridTemplateColumns: `repeat(${authoringMapSnapshot.width}, minmax(18px, 1fr))` }}>
                  {authoringMapSnapshot.tiles.map((tile) => {
                    const actors = authoringActorsByTile.get(`${tile.x}:${tile.y}`) || [];
                    const markers = authoringMarkersByTile.get(`${tile.x}:${tile.y}`) || [];
                    return (
                      <button key={tile.id} className={`mapTile terrain-${tile.terrain} ${tile.searchable ? "searchable" : ""}`} data-location-id={tile.locationId || undefined} title={tile.locationName || tile.terrain}>
                        {tile.locationName && <span className="placeName">{tile.locationName}</span>}
                        {markers.slice(0, 2).map((marker) => <span key={marker.id} className={`marker marker-${marker.type}`}>?</span>)}
                        <span className="actorStack">{actors.slice(0, 3).map((actor) => <span key={actor.id} className={`actorPin actor-${actor.status}`}>{actorInitial(actor.name)}</span>)}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
              <section className="actionPanel">
                <h2><Database size={16} /> Deduction Graph Preview</h2>
                <DeductionGraphView
                  graph={authoringReport.deductionGraph}
                  discoveredEvidenceIds={authoringCase.evidence.map((item) => item.id)}
                  solutionRevealed
                  onSelectEvidence={setAuthoringEvidenceId}
                  onSelectEvent={setAuthoringTimelineId}
                  onSelectCharacter={setAuthoringCharacterId}
                />
              </section>
            </>
          )}
        </section>

        <aside className="authoringInspector">
          <section className={`authoringWorkflowCoach ${authoringWorkflowCoach.nextAction.tone}`} data-testid="authoring-workflow-coach">
            <div className="workflowCoachHeader">
              <div>
                <p>Browser-local guidance</p>
                <h2>Authoring Workflow Coach</h2>
              </div>
              <span className={`runtimePill ${authoringWorkflowCoach.nextAction.tone}`}>{authoringWorkflowCoach.nextAction.tone}</span>
            </div>
            <div className="workflowCoachStages" data-testid="authoring-workflow-stages">
              {authoringWorkflowCoach.stages.map((stage) => (
                <button
                  key={stage.id}
                  type="button"
                  className={`workflowCoachStage ${stage.status}`}
                  data-testid={`authoring-workflow-stage-${stage.id}`}
                  onClick={() => {
                    if (stage.id === "content-seed" || stage.id === "safe-diff") setAuthoringTab("content");
                    else if (stage.id === "gallery-backup") setAuthoringTab("gallery");
                    else if (stage.id === "run-draft" || stage.id === "validation") setAuthoringTab("logic");
                    else setAuthoringTab("case");
                  }}
                >
                  <span>{stage.status}</span>
                  <strong>{stage.label}</strong>
                  <small>{stage.detail}</small>
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`workflowNextAction ${authoringWorkflowCoach.nextAction.tone}`}
              data-testid="authoring-next-action"
              onClick={runAuthoringCoachNextAction}
            >
              <span>Next Action</span>
              <strong>{authoringWorkflowCoach.nextAction.label}</strong>
              <small>{authoringWorkflowCoach.nextAction.detail}</small>
            </button>
            <p className="caseGalleryNote">Coach reads only current browser draft status, safe diff counts, validation result, and Gallery backup availability. It does not expose spoiler fields or call `/api/*`.</p>
          </section>

          <section className={`authoringReport ${authoringReport.valid ? "pass" : "fail"}`} data-testid="authoring-rule-report">
            <h2>Rule Report</h2>
            <div className="validationChecklist" data-testid="authoring-validation-checklist">
              {authoringChecklist.map((item) => (
                <button key={item.label} type="button" className={item.ok ? "pass" : "fail"} onClick={() => setAuthoringTab(item.tab)}>
                  <span>{item.ok ? "OK" : "!"}</span>
                  <strong>{item.label}</strong>
                </button>
              ))}
            </div>
            <div className="metricGrid">
              <div><strong>{authoringReport.valid ? "Pass" : "Fail"}</strong><small>Status</small></div>
              <div><strong>{authoringReport.qualityScore}</strong><small>Quality</small></div>
              <div><strong>{authoringReport.logicStrength}</strong><small>Logic</small></div>
              <div><strong>{authoringReport.misdirectionQuality}</strong><small>Misdirect</small></div>
              <div><strong>{Math.round(authoringReport.reasoningCoverage.coverageRatio * 100)}%</strong><small>Coverage</small></div>
              <div><strong>{authoringReport.errors.length}</strong><small>Errors</small></div>
            </div>
            <article className={`proofAuditCard ${authoringProofAudit.valid ? "pass" : "fail"}`} data-testid="authoring-proof-audit">
              <strong>Proof Audit: {authoringProofAudit.valid ? "Pass" : "Fail"}</strong>
              <span>{authoringProofAudit.tour.length} proof tour steps / emergence {authoringProofAudit.trace.evaluation.emergenceScore}</span>
              <small>{authoringProofAudit.valid ? "The current draft can generate a player proof tour." : "The current draft is missing a complete emergence proof or final conclusion step."}</small>
            </article>
            <div className="issueList">
              {(authoringReport.issues.length ? authoringReport.issues : [{ id: "ok", severity: "warning" as const, source: "authoring" as const, path: "$", message: "\u5f53\u524d\u8349\u7a3f\u901a\u8fc7 schema\u3001\u4e16\u754c\u6765\u6e90\u3001hard logic \u548c\u63a8\u7406\u8986\u76d6\u6821\u9a8c\u3002" }]).slice(0, 12).map((item) => (
                <button key={item.id} type="button" className={`issueItem ${item.severity}`} onClick={() => focusAuthoringIssue(item)}>
                  <strong>{item.source} / {item.path}</strong>
                  <span>{item.message}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="authoringPanel">
            <h2>Suspect Matrix</h2>
            <div className="suspectBoard">
              {authoringReport.suspectBoard.map((row) => (
                <button key={row.characterId} className={`suspectRow ${row.status}`}>
                  <strong>{row.name}</strong>
                  <span>M {row.motive ? "Y" : "N"} / W {row.means ? "Y" : "N"} / O {row.opportunity ? "Y" : "N"}</span>
                  <small>{row.exclusionEvidenceIds.join(", ") || "no exclusion"}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="authoringPanel">
            <h2>Import / Export</h2>
            <label>\u6a21\u677f
              <select value={caseTemplateId} onChange={(event) => loadPremiumTemplate(event.target.value as CaseTemplateId)}>
                {caseTemplates.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
            <div className="authoringActions">
              <button onClick={() => loadPremiumTemplate()}>Load Premium Template</button>
              <button data-testid="save-to-gallery" onClick={saveAuthoringToGallery}>Save to Gallery</button>
              <button onClick={() => exportAuthoring("json")}>Export JSON</button>
              <button onClick={() => exportAuthoring("markdown")}>Export Markdown</button>
              <button data-testid="export-gallery-json" onClick={exportGalleryBundle} disabled={!caseGalleryEntries.length}>Export Gallery JSON</button>
            </div>
            <textarea data-testid="authoring-import-text" placeholder="Paste AuthoringDraft, DeductionCase, or CaseGalleryBundle JSON" value={authoringImportText} onChange={(event) => setAuthoringImportText(event.target.value)} />
            <button className="secondaryButton full" onClick={importAuthoringJson}>Import JSON</button>
            <textarea data-testid="authoring-export-text" readOnly value={authoringExportText} placeholder="Export output appears here" />
            <div className="statusBox"><AlertTriangle size={16} /><span>{authoringStatus}</span></div>
          </section>
        </aside>
      </main>
    );
  }

  if (appMode === "persistent-town") {
    return (
      <>
      {campaignStudyRecorder}
      <PersistentTownCommandCenter
        runtimeMode={runtimeMode}
        worldName={world?.name || "未创建小镇"}
        caseTitle={activeCase?.deductionCase.title || "Generated Agent Town"}
        runtime={townRuntime}
        queue={townQueue}
        brief={townBrief}
        snapshot={snapshot}
        selectedAgent={selectedAgent}
        selectedAgentCandidates={selectedAgentCandidates}
        selectedLocationId={selectedSceneId}
        selectedCharacterName={selectedCharacter?.name}
        selectedCharacterId={selectedCharacterId}
        runningBusy={townRuntimeBusy}
        startRuntime={() => void startPersistentTown()}
        pauseRuntime={() => void pausePersistentTown()}
        stepRuntime={() => void stepPersistentTown()}
        stepRuntimeFast={() => void stepPersistentTown(5)}
        resetRuntime={() => void resetPersistentTown()}
        interveneAgent={(kind, value) => void intervenePersistentAgent(kind, value)}
        extractCase={(candidate) => void extractPersistentCandidate(candidate)}
        scenarioPresets={scenarioPresets}
        scenarioPacks={scenarioPacks}
        scenarioRuns={scenarioRuns}
        runCatalog={runCatalog}
        runJobs={runJobs}
        ruleState={townRuleState}
        caseLifecycle={townCaseLifecycle}
        selectedScenarioPackId={selectedScenarioPackId}
        setSelectedScenarioPackId={setSelectedScenarioPackId}
        selectedRunCatalogId={selectedRunCatalogId}
        setSelectedRunCatalogId={setSelectedRunCatalogId}
        selectedScenarioPresetId={selectedScenarioPresetId}
        setSelectedScenarioPresetId={setSelectedScenarioPresetId}
        selectScenarioRun={(runId) => void selectScenarioHistoryRun(runId)}
        runScenario={(config) => void runDefaultTownScenario(config)}
        saveScenarioPreset={(preset, overwrite) => void saveScenarioPresetFromUi(preset, overwrite)}
        deleteScenarioPreset={(presetId) => void deleteScenarioPresetFromUi(presetId)}
        exportScenarioPack={() => void exportScenarioPackFromUi()}
        validateScenarioPack={() => void validateScenarioPackFromUi()}
        exportReplayBundle={() => void exportReplayBundleFromUi()}
        startScenarioJob={() => void startRunJobFromUi("scenario")}
        startBenchmarkJob={() => void startRunJobFromUi("benchmark")}
        cancelRunJob={(jobId) => void cancelRunJobFromUi(jobId)}
        copyReviewJson={() => void copyReviewBundleJson()}
        exportReviewMarkdown={() => void exportReviewBundleFile("markdown")}
        exportReviewBundle={() => void exportReviewBundleFile("json")}
        rollbackSnapshot={(snapshotId) => void rollbackTownSnapshot(snapshotId)}
        markReviewExportTarget={markCurrentDiffAsReviewExportTarget}
        backToPlay={() => {
          setAppMode("play");
          setInspectorTab("investigation");
        }}
        onActorSelect={(actor) => {
          setSelectedCharacterId(actor.id);
          setSelectedSuspectId(actor.id);
          highlightSelection({ characterId: actor.id });
          void refreshTownRuntime(world?.id, actor.id);
        }}
        onLocationSelect={(locationId) => {
          setSelectedSceneId(locationId);
          setHoveredLocationId(locationId);
          highlightSelection({ locationId });
        }}
        selectedScenarioRun={scenarioRun}
        scenarioReport={scenarioReport}
        snapshots={townSnapshots}
        selectedSnapshotFromId={selectedSnapshotFromId}
        selectedSnapshotToId={selectedSnapshotToId}
        setSelectedSnapshotFromId={setSelectedSnapshotFromId}
        setSelectedSnapshotToId={setSelectedSnapshotToId}
        snapshotDiff={snapshotDiff}
        benchmarkSummary={benchmarkSummary}
        runBenchmark={(seedCount) => void runEmergenceBenchmarkFromUi(seedCount)}
        reviewBusy={reviewBusy}
      />
      </>
    );
  }

  const graphView = (
    <DeductionGraphView
      graph={deductionGraph}
      discoveredEvidenceIds={session?.discoveredEvidenceIds || []}
      solutionRevealed={Boolean(session?.judgement?.accepted && revealText)}
      selectedNodeId={selectedGraphNode?.id}
      onSelectNode={setSelectedGraphNode}
      onSelectEvidence={(evidenceId) => {
        setSelectedEvidenceId(evidenceId);
        const scene = scenes.find((item) => item.evidenceIds.includes(evidenceId));
        if (scene) setSelectedSceneId(scene.id);
        highlightSelection({ evidenceId, locationId: scene?.id });
      }}
      onSelectEvent={(eventId) => {
        const event = events.find((item) => item.id === eventId);
        setHighlightedEventId(eventId);
        if (event) {
          setSelectedSceneId(event.locationId);
          setTimeValue(timeToMinutes(event.time));
          highlightSelection({ eventId, locationId: event.locationId });
        }
      }}
      onSelectCharacter={(characterId) => {
        setSelectedCharacterId(characterId);
        setSelectedSuspectId(characterId);
        setInspectorTab("people");
      }}
    />
  );

  return (
    <>
    {campaignStudyRecorder}
    <PlayShell
      commandDeck={commandDeck}
      control={(
        <ControlRail
          runtimeMode={runtimeMode}
          seedInput={seedInput}
          setSeedInput={setSeedInput}
          caseMode={caseMode}
          setCaseMode={setCaseMode}
          caseTemplateId={caseTemplateId}
          switchCaseTemplate={switchCaseTemplate}
          caseTemplates={caseTemplates}
          caseArchetype={caseArchetype}
          setCaseArchetype={setCaseArchetype}
          archetypeOptions={archetypeOptions}
          mode={mode}
          setMode={setMode}
          busy={busy}
          createWorld={() => void createWorld()}
          worldIdInput={worldIdInput}
          setWorldIdInput={setWorldIdInput}
          loadWorld={() => void loadWorld()}
          playerName={playerName}
          setPlayerName={setPlayerName}
          joinCase={() => void joinCase()}
          tickWorld={() => void tickWorld()}
          worldName={world?.name || "\u672a\u521b\u5efa\u5c0f\u9547"}
          caseTitle={activeCase?.deductionCase.title || "Detective Town Showcase"}
          caseSubtitle={activeCase ? archetypeLabels[activeCase.generationProfile.archetype] : "\u7b49\u5f85\u751f\u6210\u6848\u4ef6"}
          progress={progress}
          metrics={{
            quality: quality?.qualityScore ?? quality?.score ?? 0,
            unique: Boolean(quality?.uniqueCulprit),
            logic: quality?.logicStrength ?? logicReport?.logicStrength ?? 0,
            misdirect: quality?.misdirectionQuality ?? logicReport?.misdirectionQuality ?? 0,
            evidence: `${session?.discoveredEvidenceIds.length || 0}/${deductionCase?.evidence.length || 0}`,
            aiEval: latestLiveEval?.passed === false ? "Fail" : latestLiveEval ? "Pass" : "Local"
          }}
          status={status}
          suggestedAction={suggestedAction}
          onSuggestedAction={() => setInspectorTab(suggestedAction.targetTab)}
          guidedTasks={onboarding.tasks}
          onGuidedTaskSelect={handleGuidedTask}
          reopenOnboarding={onboarding.reopen}
          openAuthoring={() => setAppMode("authoring")}
          openWorldGraph={() => setAppMode("world-graph")}
          openPersistentTown={() => {
            setAppMode("persistent-town");
            setInspectorTab("agent");
            void refreshTownRuntime();
          }}
          switchRuntime={switchRuntime}
        />
      )}
      toasts={<ToastStack toasts={toasts} onDismiss={dismissToast} />}
      map={(
        <TownMapStage
          caseFile={activeCase?.deductionCase.publicCaseFile || "\u521b\u5efa\u5c0f\u9547\u540e\uff0c\u6848\u4ef6\u4f1a\u4ece NPC \u65e5\u7a0b\u3001\u8bb0\u5fc6\u3001\u51b2\u7a81\u548c\u4e8b\u4ef6\u65e5\u5fd7\u4e2d\u6d8c\u73b0\u3002"}
          currentTime={snapshot?.time || minutesToTime(timeValue)}
          stages={investigationStages}
          snapshot={snapshot}
          actorsByTile={mapActorsByTile}
          markersByTile={mapMarkersByTile}
          hoverInfo={hoveredLocationInfo}
          npcPopover={selectedNpcPopover}
          selectedSceneId={selectedSceneId}
          highlightedEventId={highlightedEventId}
          selectedCharacterId={selectedCharacterId}
          selectionHighlight={selectionHighlight}
          interactiveTargets={mapInteractiveTargets}
          characterState={{
            questionedIds: questionedCharacterIds,
            contradictionIds: contradictedCharacterIds,
            excludedIds: excludedCharacterIds,
            currentCharacterId: selectedCharacterId
          }}
          onTileClick={(locationId) => { setSelectedCharacterId(""); void discoverFirstSceneEvidence(locationId); }}
          onTileHover={setHoveredLocationId}
          onMarkerClick={handleMarker}
          onActorClick={handleActor}
          onLocationAction={(locationId) => { setSelectedCharacterId(""); void discoverFirstSceneEvidence(locationId); }}
          onNpcAction={(characterId) => {
            setSelectedCharacterId(characterId);
            setQuestion("Where were you during the crime window, and what unusual details do you remember?");
            setInspectorTab("investigation");
            highlightSelection({ characterId });
          }}
          replaying={replaying}
          setReplaying={setReplaying}
          timeMin={timeMin}
          timeMax={timeMax}
          timeValue={timeValue}
          setTimeValue={setTimeValue}
          timeToMinutes={timeToMinutes}
          minutesToTime={minutesToTime}
        />
      )}
      inspector={(
        <InspectorRail
          activeTab={inspectorTab}
          setActiveTab={setInspectorTab}
          summary={inspectorSummary}
          tabs={[
            {
              id: "events",
              label: "\u4e8b\u4ef6",
              content: (
                <EventLogPanel
                  events={visibleEvents}
                  highlightedEventId={highlightedEventId}
                  onSelect={(event) => {
                    setHighlightedEventId(event.id);
                    setSelectedSceneId(event.locationId);
                    setTimeValue(timeToMinutes(event.time));
                    setInspectorTab("events");
                  }}
                />
              )
            },
            {
              id: "investigation",
              label: "\u8c03\u67e5",
              content: (
                <InvestigationPanel
                  playableIntake={playableIntake}
                  onIntakeNextAction={handleIntakeNextAction}
                  notebookItems={evidenceNotebook}
                  onNotebookAction={handleNotebookAction}
                  selectedSceneName={selectedScene?.name || "\u9009\u62e9\u5730\u56fe\u5730\u70b9"}
                  sceneEvidence={sceneEvidence}
                  discoveredEvidence={discoveredEvidence}
                  discoveredIds={discovered}
                  evidenceImpacts={evidenceImpacts}
                  discoverEvidence={(evidenceId) => void discoverEvidence(evidenceId)}
                  session={session}
                  characters={characters}
                  selectedCharacterId={selectedCharacterId}
                  setSelectedCharacterId={setSelectedCharacterId}
                  selectedEvidenceId={selectedEvidenceId}
                  setSelectedEvidenceId={setSelectedEvidenceId}
                  selectedTestimony={selectedTestimony}
                  question={question}
                  setQuestion={setQuestion}
                  interrogate={() => void interrogate()}
                  aiSafety={lastAiSafety}
                  memoryCount={selectedNpcMemories.length}
                  evidenceCount={discoveredEvidence.length}
                  contradictionHit={selectedNpcContradictionHit}
                  dialogueLog={session?.interrogationLog || []}
                  deductionCase={deductionCase}
                  theory={theory}
                  setTheory={setTheory}
                  playerTheoryEvidence={playerTheoryEvidence}
                  toggleTheoryEvidence={toggleTheoryEvidence}
                  submitTheory={() => void submitTheory()}
                  revealSolution={() => void revealSolution()}
                  revealText={revealText}
                  judgementGaps={judgementGaps}
                  gapCards={gapCards}
                  onGapSelect={handleGapCard}
                  nextStepAdvice={nextStepAdvice}
                  joinCase={() => void joinCase()}
                  staticPlaythroughProof={staticPlaythroughProof}
                  runStaticPlaythroughProof={runStaticCertifiedPlaythrough}
                  serverPlaythroughProof={serverPlaythroughProof}
                  runServerPlaythroughProof={() => void runServerCertifiedPlaythrough()}
                  runtimeMode={runtimeMode}
                  worldLead={worldLead || townRuntime?.worldLeadPreview}
                  worldLeadOutcome={worldLeadOutcome}
                  worldLeadCaseHandoff={worldLeadCaseHandoff || townRuntime?.worldLeadCaseHandoffSummary}
                  worldArc={runtimeMode === "static-demo" ? null : worldArc || townRuntime?.worldArcSummary}
                  worldArcDirective={runtimeMode === "static-demo" ? null : worldArcDirective || townRuntime?.worldArcDirectiveSummary}
                  worldPressureCascade={runtimeMode === "static-demo" ? null : worldPressureCascade || townRuntime?.worldPressureCascadeSummary}
                  worldInfluenceBudget={runtimeMode === "static-demo" ? null : worldInfluenceBudget || townRuntime?.worldInfluenceBudgetSummary}
                  playerResourceCommitment={runtimeMode === "static-demo" ? null : playerResourceCommitment || townRuntime?.playerResourceCommitmentSummary}
                  factionRelationship={runtimeMode === "static-demo" ? null : factionRelationship || townRuntime?.factionRelationshipSummary}
                  worldEventOffer={runtimeMode === "static-demo" ? null : worldEventOffer || townRuntime?.worldEventOfferSummary}
                  investigatorProgression={runtimeMode === "static-demo" ? null : investigatorProgression || townRuntime?.investigatorProgressionSummary}
                  campaignRecovery={runtimeMode === "static-demo" ? null : campaignRecovery || townRuntime?.campaignRecoverySummary}
                  arcConvergence={runtimeMode === "static-demo" ? null : arcConvergence || townRuntime?.arcConvergenceSummary}
                  campaignSession={runtimeMode === "static-demo" ? null : campaignSession || townRuntime?.campaignSessionSummary}
                  campaignFinaleDebrief={runtimeMode === "static-demo" ? null : campaignFinaleDebrief || townRuntime?.campaignFinaleDebrief}
                  townSocialResponse={runtimeMode === "static-demo" ? null : townSocialResponse || townRuntime?.townSocialResponseSummary}
                  updateWorldLead={(action) => void updateWorldLeadDecision(action)}
                  updateWorldArcDirective={(choice) => void updateWorldArcDirectiveDecision(choice)}
                  updatePlayerResourceCommitment={(choice) => void updatePlayerResourceCommitmentDecision(choice)}
                  updateWorldEventOffer={(choice) => void updateWorldEventOfferDecision(choice)}
                  updateCampaignRecovery={(choice) => void updateCampaignRecoveryDecision(choice)}
                  guidedManualRun={guidedManualRun}
                  runGuidedManualStep={() => void runGuidedManualStep()}
                  guidedStepJournal={guidedStepJournal}
                  sourceReviewUnlock={sourceReviewUnlock}
                  solvedCaseDebrief={solvedCaseDebrief}
                  replayPracticeLoop={replayPracticeLoop}
                  replayGoalCoach={replayGoalCoach}
                  manualEvidenceDrill={manualEvidenceDrill}
                  toggleManualEvidenceDrillEvidence={toggleManualEvidenceDrillEvidence}
                  manualTheoryDrill={manualTheoryDrill}
                  updateManualTheoryDrillField={updateManualTheoryDrillField}
                  approveManualTheoryFallback={approveManualTheoryFallback}
                  replayAttemptScorecard={replayAttemptScorecard}
                  startReplayGoalAttempt={() => void startReplayGoalAttempt()}
                  proofLedger={caseTruthLedger}
                  proofCoverage={caseProofCoverage}
                  routeCertificate={caseRouteCertificate}
                  proofTourSteps={proofTourSteps}
                  busy={busy}
                  commandDeckMode={Boolean(commandDeck)}
                />
              )
            },
            {
              id: "logic",
              label: "\u903b\u8f91",
              content: (
                <div className="stackedInspector">
                  <CaseLogicPanel
                    accepted={Boolean(session?.judgement?.accepted)}
                    summary={logicReport?.summary}
                    logicReport={logicReport}
                    emergenceScore={quality?.emergenceScore ?? causalTrace?.emergenceScore ?? 0}
                    causalComplete={Boolean(quality?.causalTraceComplete || causalTrace?.complete)}
                    proofLedger={caseTruthLedger}
                    proofCoverage={caseProofCoverage}
                    routeCertificate={caseRouteCertificate}
                    graph={graphView}
                    selectedGraphExplanation={graphExplanation}
                    solutionChain={solutionChain}
                    revealText={revealText}
                  />
                  <ProofTourPanel steps={proofTourSteps} viewMode={proofViewMode} setViewMode={setProofViewMode} onSelectStep={handleProofTourStep} />
                  <EmergenceProofPanel trace={emergenceProofTrace} />
                  <CausalTracePanel
                    events={causalTraceEvents}
                    solved={Boolean(session?.judgement?.accepted)}
                    discoveredEvidenceIds={session?.discoveredEvidenceIds || []}
                    timeToMinutes={timeToMinutes}
                    onSelect={(event, nextTime) => {
                      setHighlightedEventId(event.id);
                      setSelectedSceneId(event.locationId);
                      setTimeValue(nextTime);
                      setInspectorTab("events");
                    }}
                  />
                </div>
              )
            },
            {
              id: "agent",
              label: "Agent",
              content: (
                <AgentControlPanel
                  runtimeMode={runtimeMode}
                  runtime={townRuntime}
                  queue={townQueue}
                  selectedAgent={selectedAgent}
                  selectedAgentCandidates={selectedAgentCandidates}
                  runningBusy={townRuntimeBusy}
                  selectedCharacterName={selectedCharacter?.name}
                  startRuntime={() => void startPersistentTown()}
                  pauseRuntime={() => void pausePersistentTown()}
                  stepRuntime={() => void stepPersistentTown()}
                  resetRuntime={() => void resetPersistentTown()}
                  interveneAgent={() => void intervenePersistentAgent()}
                  extractCase={(candidate) => void extractPersistentCandidate(candidate)}
                  scenarioPresets={scenarioPresets}
                  scenarioPacks={scenarioPacks}
                  scenarioRuns={scenarioRuns}
                  runCatalog={runCatalog}
                  runJobs={runJobs}
                  ruleState={townRuleState}
                  caseLifecycle={townCaseLifecycle}
                  selectedScenarioPackId={selectedScenarioPackId}
                  setSelectedScenarioPackId={setSelectedScenarioPackId}
                  selectedRunCatalogId={selectedRunCatalogId}
                  setSelectedRunCatalogId={setSelectedRunCatalogId}
                  selectedScenarioPresetId={selectedScenarioPresetId}
                  setSelectedScenarioPresetId={setSelectedScenarioPresetId}
                  selectScenarioRun={(runId) => void selectScenarioHistoryRun(runId)}
                  runScenario={(config) => void runDefaultTownScenario(config)}
                  saveScenarioPreset={(preset, overwrite) => void saveScenarioPresetFromUi(preset, overwrite)}
                  deleteScenarioPreset={(presetId) => void deleteScenarioPresetFromUi(presetId)}
                  exportScenarioPack={() => void exportScenarioPackFromUi()}
                  validateScenarioPack={() => void validateScenarioPackFromUi()}
                  exportReplayBundle={() => void exportReplayBundleFromUi()}
                  startScenarioJob={() => void startRunJobFromUi("scenario")}
                  startBenchmarkJob={() => void startRunJobFromUi("benchmark")}
                  cancelRunJob={(jobId) => void cancelRunJobFromUi(jobId)}
                  copyReviewJson={() => void copyReviewBundleJson()}
                  exportReviewMarkdown={() => void exportReviewBundleFile("markdown")}
                  exportReviewBundle={() => void exportReviewBundleFile("json")}
                  rollbackSnapshot={(snapshotId) => void rollbackTownSnapshot(snapshotId)}
                  markReviewExportTarget={markCurrentDiffAsReviewExportTarget}
                  selectedScenarioRun={scenarioRun}
                  scenarioReport={scenarioReport}
                  snapshots={townSnapshots}
                  selectedSnapshotFromId={selectedSnapshotFromId}
                  selectedSnapshotToId={selectedSnapshotToId}
                  setSelectedSnapshotFromId={setSelectedSnapshotFromId}
                  setSelectedSnapshotToId={setSelectedSnapshotToId}
                  snapshotDiff={snapshotDiff}
                  benchmarkSummary={benchmarkSummary}
                  runBenchmark={(seedCount) => void runEmergenceBenchmarkFromUi(seedCount)}
                  reviewBusy={reviewBusy}
                />
              )
            },
            {
              id: "people",
              label: "\u4eba\u7269",
              content: (
                <SuspectBoardPanel
                  rows={suspectBoard}
                  solved={Boolean(session?.judgement?.accepted)}
                  selectedSuspectId={selectedSuspectId}
                  explanations={suspectExplanations}
                  onSelect={(characterId) => {
                    setSelectedSuspectId(characterId);
                    setSelectedCharacterId(characterId);
                    highlightSelection({ characterId });
                  }}
                />
              )
            },
            {
              id: "developer",
              label: "\u5f00\u53d1\u8005",
              content: (
                <DeveloperPanel
                  worldId={world?.id}
                  caseId={activeCase?.id}
                  sessionId={session?.id}
                  memoryCount={selectedNpcMemories.length}
                  promptSafe={lastAiSafety?.promptAudit?.safe !== false}
                  selectedName={selectedCharacter?.name}
                  copyAgentApiExample={copyAgentApiExample}
                  agentApiExample={agentApiExample}
                />
              )
            }
          ]}
        />
      )}
      overlay={(
        <OnboardingOverlay
          open={onboarding.overlayOpen}
          tasks={onboarding.tasks}
          onSelectTask={handleGuidedTask}
          onDismiss={onboarding.dismiss}
        />
      )}
      onContextAction={commandDeckContext.onAction}
    />
    </>
  );
}
