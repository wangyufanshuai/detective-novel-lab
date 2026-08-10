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
import { deriveTownMapLensViewModel } from "@/app/campaign/town-map-lens-model";
import { deriveWorldConsequenceTimeline } from "@/app/campaign/world-consequence-timeline";
import { countManualTheoryFields, guidedManualActionLabel, unresolvedManualTheoryFields, type GuidedManualStepKind, type GuidedManualStepTarget, type GuidedStepJournalEntry, type ManualTheoryFieldKind, type ReplayGoalAttemptState } from "@/app/campaign/replay-practice-model";
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
import { useGuidedOnboarding, type GuidedTask, type SelectionHighlight } from "@/app/hooks/useGuidedOnboarding";
import { useCampaignComprehensionStudy } from "@/app/hooks/useCampaignComprehensionStudy";
import { useCampaignController } from "@/app/controllers/useCampaignController";
import { useInvestigationController } from "@/app/controllers/useInvestigationController";
import { useReplayController } from "@/app/controllers/useReplayController";
import { useReviewController } from "@/app/controllers/useReviewController";
import { useTownRuntimeController } from "@/app/controllers/useTownRuntimeController";
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

export function WorldGraphWorkbench({ onBack, runtimeMode }: { onBack: () => void; runtimeMode: RuntimeMode }) {
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
