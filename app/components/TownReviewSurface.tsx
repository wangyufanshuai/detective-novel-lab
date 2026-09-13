"use client";

import {
  AlertTriangle,
  BookOpen,
  Bot,
  ChevronDown,
  Clock,
  Database,
  FileSearch,
  Gavel,
  GitBranch,
  HelpCircle,
  ListTree,
  Loader2,
  Map as MapIcon,
  MessageSquare,
  Network,
  Pause,
  Play,
  Search,
  ShieldCheck,
  Users,
  X
} from "lucide-react";
import { memo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { BenchmarkSeedTable, CurrentExperimentPanel, DatasetPackagePanel, PublicReviewCatalogPanel, ReplayDatasetCatalogPanel, ReviewExportActions, RunCatalogPanel, ScenarioPackPanel, ScenarioPresetEditor, ScenarioRunHistory, WorldPackageCatalogPanel } from "@/app/components/ReviewModePanels";
import { TownRuleStatePanel } from "@/app/components/TownRuleStatePanel";
import { CommandDeckCollapsible, CommandDeckShell } from "@/app/components/CommandDeckShell";
import { CandidatePlayabilityPreview } from "@/app/components/CandidatePlayabilityPreview";
import { getNoirPortrait } from "@/app/campaign/noir-player-assets";
import type { CampaignCommandDeckViewModel } from "@/app/campaign/command-deck-model";
import { deriveCampaignPacingViewModel } from "@/app/campaign/campaign-pacing-model";
import type { SafeContextActionKind } from "@/app/campaign/context-action-resolver";
import { getInvestigationActionDefinition, type InvestigationActionKind } from "@/app/campaign/investigation-action-registry";
import type { TownMapLensViewModel } from "@/app/campaign/town-map-lens-model";
import {
  WorldCampaignPanel,
  type WorldArcDirectiveSummary,
  type WorldArcSummary,
  type WorldLeadHandoffSummary,
  type WorldLeadOutcomeSummary,
  type WorldLeadSummary,
  type WorldInfluenceBudgetSummary,
  type WorldPressureCascadeSummary,
  type PlayerResourceCommitmentSummary,
  type FactionRelationshipSummary,
  type WorldEventOfferSummary,
  type InvestigatorProgressionSummary,
  type CampaignRecoverySummary,
  type ArcConvergenceSummary,
  type CampaignSessionSummary,
  type CampaignFinaleDebriefSummary,
  type TownSocialResponseSummary
} from "@/app/components/WorldCampaignPanel";
import type {
  CaseLogicReport,
  CaseTemplateId,
  CaseCandidate,
  CaseChainStage,
  CaseProofCoverage,
  CaseRouteCertificate,
  CaseTruthLedger,
  AgentDecisionTrace,
  DeductionCase,
  DeductionGraphNode,
  EmergenceBenchmarkReport,
  EmergenceProofTrace,
  EvidenceNotebookItem,
  Evidence,
  InvestigationProgress,
  MapInteractiveTarget,
  MurderArchetype,
  NpcActionCandidate,
  NpcAgentState,
  PlayableCaseIntake,
  PlayableCaseNextAction,
  PlayerSession,
  PlayerTheory,
  PersistentTownRuntime,
  ProofTourStep,
  ProofViewMode,
  RuntimeMode,
  RunCatalogEntry,
  RunJob,
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
  TownCaseLifecycleState,
  TownEmergenceQueue,
  TownRuleSnapshotSummary,
  TownSituationBrief,
  WorldEvent,
  WorldMapActor,
  WorldMapMarker,
  WorldMapSnapshot,
  WorldMapTile,
  WorldMode
} from "@/lib/engine";
import type { SuggestedAction } from "@/app/hooks/useDetectiveTownRuntime";
import type { EvidenceImpact } from "@/app/hooks/useInvestigationActions";
import type { GuidedTask, SelectionHighlight } from "@/app/hooks/useGuidedOnboarding";

export type InspectorTabId = "events" | "investigation" | "logic" | "agent" | "people" | "developer";

type CaseTemplateOption = { id: CaseTemplateId; title: string; description?: string; archetype: MurderArchetype };
type CaseMode = "premium" | "generated";
type BenchmarkSummary = EmergenceBenchmarkReport;
type AiSafetyView = {
  promptAudit?: { safe?: boolean };
  memoryCount?: number;
  evidenceCount?: number;
  safetyFlags?: string[];
};
type CharacterState = {
  questionedIds: Set<string>;
  contradictionIds: Set<string>;
  excludedIds: Set<string>;
  currentCharacterId?: string;
};
export type GraphNodeExplanation = {
  node: DeductionGraphNode;
  title: string;
  status: string;
  body: string;
  source: string;
  references: string[];
  spoilerSafe: boolean;
};
export type SuspectExplanation = {
  characterId: string;
  name: string;
  role: string;
  statusLabel: string;
  motive: boolean;
  means: boolean;
  opportunity: boolean;
  surfaceSuspicion: string;
  exclusionStatus: string;
  visibleEvidenceTitles: string[];
  lockedEvidenceCount: number;
  sourceEventLabels: string[];
};
export type GapCard = {
  id: string;
  label: string;
  detail: string;
  target: "suspects" | "motive" | "method" | "evidence" | "exclusion" | "logic";
};
export type LocationHoverInfo = {
  locationId: string;
  name: string;
  terrain: string;
  searchable: boolean;
  discovered: number;
  total: number;
  recentEvent?: string;
};
export type InvestigationStage = {
  id: string;
  label: string;
  detail: string;
  complete: boolean;
  current: boolean;
};
export type InvestigationToast = {
  id: string;
  tone: "info" | "success" | "warning" | "danger";
  title: string;
  detail: string;
};
export type NpcPopoverState = {
  characterId: string;
  name: string;
  role: string;
  statusLabel: string;
  questioned: boolean;
  contradiction: boolean;
  excluded: boolean;
};

type NotebookAction = "source" | "challenge" | "chain";
type PlayableInvestigationPathKind = "join" | "search" | "question" | "challenge" | "select-evidence" | "submit" | "review-source";
type PlayableInvestigationPathStep = {
  kind: PlayableInvestigationPathKind;
  label: string;
  question: string;
  detail: string;
  metric: string;
  status: "done" | "current" | "ready" | "locked";
  action: PlayableCaseNextAction;
};
type CertifiedPlaythroughProofSummary = {
  title: string;
  actionLabel: string;
  acceptedLabel: string;
  readyLabel: string;
  blockedLabel: string;
  boundaryText: string;
  testId: string;
  runTestId: string;
  status: "ready" | "running" | "accepted" | "blocked";
  routeCertified: boolean;
  sourceBackedRoute?: boolean;
  autoRoutePassed: boolean;
  acceptedTheory: boolean;
  searchStepCount: number;
  questionedWitnessCount: number;
  challengeHitCount: number;
  selectedEvidenceCount: number;
  coveredRequiredObligations: number;
  totalRequiredObligations: number;
  blockerCount: number;
};
type GuidedManualRunSummary = {
  currentStep: PlayableInvestigationPathKind;
  currentLabel: string;
  completedSteps: number;
  totalSteps: number;
  lastResult: string;
  blockerSummary: string;
  readyToReview: boolean;
  running: boolean;
};
type GuidedStepJournalEntry = {
  id: string;
  journalKey?: string;
  step: PlayableInvestigationPathKind;
  label: string;
  status: "done" | "blocked" | "info";
  result: string;
  progressDelta: string;
  nextAction: string;
  fallbackUsed?: boolean;
  reviewUnlocked?: boolean;
};
type SourceReviewUnlockSummary = {
  unlocked: boolean;
  statusLabel: string;
  sourceEventCount: number;
  memoryCount: number;
  coveredObligations: number;
  totalObligations: number;
  routeStepCount: number;
  challengeHitCount: number;
  selectedEvidenceCount: number;
  proofGapCount: number;
};
type SolvedCaseDebriefSummary = {
  accepted: boolean;
  manualStepsCompleted: number;
  totalManualSteps: number;
  lastStepResult: string;
  fallbackUsed: boolean;
  selectedEvidenceCount: number;
  challengeHitCount: number;
  coveredObligations: number;
  totalObligations: number;
  proofGapCount: number;
  sourceEventCount: number;
  memoryCount: number;
  routeStepCount: number;
  sourceReviewUnlocked: boolean;
  worldLeadOutcomeStatus: "active" | "settled" | "not-used";
  worldLeadHandoffStatus: "ready" | "consumed" | "not-used";
  worldArcStatus: "active" | "completed" | "not-used";
  worldArcProgress: string;
  worldArcDirectiveStatus: "ready" | "scheduled" | "running" | "completed" | "blocked" | "not-used";
  worldPressureCascadeStatus: "active" | "consumed" | "empty";
  townSocialResponseStatus: "empty" | "ready" | "active" | "settled";
};
type ReplayGoalCoachSummary = {
  visible: boolean;
  activeAttempt: boolean;
  previousGuidedSteps: number;
  previousFallbackUsed: boolean;
  previousFallbackTheoryFieldCount: number;
  previousSelectedEvidenceCount: number;
  previousProofGapCount: number;
  previousSourceReviewUnlocked: boolean;
  currentStep: PlayableInvestigationPathKind;
  lastResult: string;
  completedGoalCount: number;
  totalGoalCount: number;
  goals: Array<{
    id: string;
    label: string;
    status: "done" | "active" | "ready";
    detail: string;
  }>;
};
type ReplayPracticeLoopPhase = "start" | "discover" | "pick-evidence" | "fill-theory" | "submit" | "review-source" | "scorecard";
type ReplayPracticeLoopSummary = {
  visible: boolean;
  activeAttempt: boolean;
  currentPhase: ReplayPracticeLoopPhase;
  currentPhaseLabel: string;
  nextAction: string;
  manualEvidencePickCount: number;
  manualTheoryFieldCount: number;
  fallbackEvidencePickCount: number;
  fallbackTheoryFieldCount: number;
  blockedGapCount: number;
  sourceReviewUnlocked: boolean;
  scorecardStatus: "pending" | "completed" | "waiting";
  worldLeadOutcomeStatus: "active" | "settled" | "not-used";
  worldLeadHandoffStatus: "ready" | "consumed" | "not-used";
  worldArcStatus: "active" | "completed" | "not-used";
  worldArcProgress: string;
  worldArcDirectiveStatus: "ready" | "scheduled" | "running" | "completed" | "blocked" | "not-used";
  worldPressureCascadeStatus: "active" | "consumed" | "empty";
  townSocialResponseStatus: "empty" | "ready" | "active" | "settled";
  stages: Array<{
    id: ReplayPracticeLoopPhase;
    label: string;
    status: "done" | "current" | "ready" | "locked";
  }>;
};
type ReplayAttemptDeltaStatus = "improved" | "unchanged" | "regressed" | "completed" | "pending";
type ReplayAttemptScorecardSummary = {
  visible: boolean;
  status: "pending" | "completed";
  activeAttempt: boolean;
  currentStep: PlayableInvestigationPathKind;
  lastResult: string;
  completedGuidedSteps: number;
  fallbackUsed: boolean;
  selectedEvidenceCount: number;
  manualEvidencePickCount: number;
  fallbackEvidencePickCount: number;
  manualTheoryFieldCount: number;
  fallbackTheoryFieldCount: number;
  blockedTheoryGapCount: number;
  proofGapCount: number;
  sourceReviewUnlocked: boolean;
  worldLeadOutcomeStatus: "active" | "settled" | "not-used";
  worldLeadHandoffStatus: "ready" | "consumed" | "not-used";
  worldArcStatus: "active" | "completed" | "not-used";
  worldArcProgress: string;
  worldArcDirectiveStatus: "ready" | "scheduled" | "running" | "completed" | "blocked" | "not-used";
  worldPressureCascadeStatus: "active" | "consumed" | "empty";
  townSocialResponseStatus: "empty" | "ready" | "active" | "settled";
  completedReplayGoals: number;
  totalReplayGoals: number;
  rows: Array<{
    id: string;
    label: string;
    previous: string;
    current: string;
    status: ReplayAttemptDeltaStatus;
    detail: string;
  }>;
};
type ManualEvidenceDrillCandidate = {
  evidenceId: string;
  title: string;
  locationLabel: string;
  sourceLabel: string;
  supports: string[];
  contradicts: string[];
  selected: boolean;
};
type ManualEvidenceDrillSummary = {
  visible: boolean;
  selectedEvidenceCount: number;
  routeEvidenceTargetCount: number;
  manualPickCount: number;
  remainingProofSlots: number;
  readyForSubmit: boolean;
  candidates: ManualEvidenceDrillCandidate[];
};
type ManualTheoryDrillSummary = {
  visible: boolean;
  manualFieldCount: number;
  remainingFieldCount: number;
  fallbackFieldCount: number;
  blockedGapCount: number;
  evidenceReady: boolean;
  readyForSubmit: boolean;
  fallbackApproved: boolean;
  suspectOptions: Array<{
    id: string;
    label: string;
  }>;
  selectedCulpritId: string;
  motiveText: string;
  methodText: string;
  evidencePrompts: Array<{
    title: string;
    detail: string;
    supportLabels: string[];
  }>;
};
export function AgentControlPanel({
  runtimeMode,
  runtime,
  queue,
  selectedAgent,
  selectedAgentCandidates,
  runningBusy,
  selectedCharacterName,
  startRuntime,
  pauseRuntime,
  stepRuntime,
  resetRuntime,
  interveneAgent,
  extractCase,
  scenarioPresets,
  scenarioPacks,
  scenarioRuns,
  runCatalog,
  runJobs,
  ruleState,
  caseLifecycle,
  selectedScenarioPackId,
  setSelectedScenarioPackId,
  selectedRunCatalogId,
  setSelectedRunCatalogId,
  selectedScenarioPresetId,
  setSelectedScenarioPresetId,
  selectScenarioRun,
  runScenario,
  saveScenarioPreset,
  deleteScenarioPreset,
  exportScenarioPack,
  validateScenarioPack,
  exportReplayBundle,
  startScenarioJob,
  startBenchmarkJob,
  cancelRunJob,
  copyReviewJson,
  exportReviewMarkdown,
  exportReviewBundle,
  rollbackSnapshot,
  markReviewExportTarget,
  selectedScenarioRun,
  scenarioReport,
  snapshots,
  selectedSnapshotFromId,
  selectedSnapshotToId,
  setSelectedSnapshotFromId,
  setSelectedSnapshotToId,
  snapshotDiff,
  benchmarkSummary,
  runBenchmark,
  reviewBusy
}: {
  runtimeMode: RuntimeMode;
  runtime: PersistentTownRuntime | null;
  queue: TownEmergenceQueue | null;
  selectedAgent?: NpcAgentState | null;
  selectedAgentCandidates: NpcActionCandidate[];
  runningBusy: boolean;
  selectedCharacterName?: string;
  startRuntime: () => void;
  pauseRuntime: () => void;
  stepRuntime: () => void;
  resetRuntime: () => void;
  interveneAgent: (kind?: TownRuntimeIntervention["kind"], value?: string | number | boolean) => void;
  extractCase: (candidate: CaseCandidate) => void;
  scenarioPresets: ScenarioPreset[];
  scenarioPacks: Array<ScenarioPack & { builtIn?: boolean; source?: string; experimentId?: string; experimentHash?: string; experimentPathHash?: string; validation?: { ok: boolean } }>;
  scenarioRuns: ScenarioRunSummary[];
  runCatalog: RunCatalogEntry[];
  runJobs: RunJob[];
  ruleState?: TownRuleSnapshotSummary | null;
  caseLifecycle?: TownCaseLifecycleState | null;
  selectedScenarioPackId: string;
  setSelectedScenarioPackId: (packId: string) => void;
  selectedRunCatalogId: string;
  setSelectedRunCatalogId: (runId: string) => void;
  selectedScenarioPresetId: string;
  setSelectedScenarioPresetId: (presetId: string) => void;
  selectScenarioRun: (scenarioId: string) => void;
  runScenario: (config?: ScenarioConfig) => void;
  saveScenarioPreset: (preset: ScenarioPreset, overwrite: boolean) => void;
  deleteScenarioPreset: (presetId: string) => void;
  exportScenarioPack: () => void;
  validateScenarioPack: () => void;
  exportReplayBundle: () => void;
  startScenarioJob: () => void;
  startBenchmarkJob: () => void;
  cancelRunJob: (jobId: string) => void;
  copyReviewJson: () => void;
  exportReviewMarkdown: () => void;
  exportReviewBundle: () => void;
  rollbackSnapshot: (snapshotId: string) => void;
  markReviewExportTarget: () => void;
  selectedScenarioRun?: ScenarioRun | null;
  scenarioReport?: ScenarioReport | null;
  snapshots: TownStateSnapshot[];
  selectedSnapshotFromId: string;
  selectedSnapshotToId: string;
  setSelectedSnapshotFromId: (value: string) => void;
  setSelectedSnapshotToId: (value: string) => void;
  snapshotDiff?: TownStateDiff | null;
  benchmarkSummary?: BenchmarkSummary | null;
  runBenchmark: (seedCount: 10 | 20) => void;
  reviewBusy?: boolean;
}) {
  const [copyStatus, setCopyStatus] = useState("");
  const candidates = queue?.candidates || [];
  const branchCount = scenarioReport?.branches.length || 0;
  const passedChecks = scenarioReport?.checks.filter((check) => check.passed).length ?? 0;
  const totalChecks = scenarioReport?.checks.length ?? 0;
  const snapshotFrom = snapshots.find((item) => item.id === selectedSnapshotFromId);
  const snapshotTo = snapshots.find((item) => item.id === selectedSnapshotToId);
  const sortedSnapshots = [...snapshots].sort((a, b) => a.tick - b.tick || a.label.localeCompare(b.label));
  const reviewStatus = scenarioReport ? (scenarioReport.passed ? "pass" : "fail") : "pending";
  const benchmarkState = benchmarkSummary ? (benchmarkSummary.failed === 0 ? "pass" : "fail") : "pending";
  const baselineStartId = scenarioReport?.baseline.startSnapshotId || "";
  const baselineEndId = scenarioReport?.baseline.endSnapshotId || "";
  const actionLabels: Record<string, string> = {
    investigate: "调查",
    "spread-rumor": "传闻",
    "seek-alibi": "不在场",
    pressure: "施压",
    "cover-up": "掩盖",
    talk: "交谈",
    trade: "交易",
    move: "移动",
    rest: "休整"
  };
  const stageLabels: Record<string, string> = {
    motive: "动机",
    means: "手段",
    opportunity: "机会",
    "cover-up": "掩盖",
    staging: "伪装",
    memory: "记忆",
    exclusion: "排除",
    "non-culprit-exclusion": "排除"
  };
  const phaseLabels: Record<string, string> = {
    observe: "感知",
    propagate: "传播",
    "memory-propagation": "传播",
    "propagate-memory": "传播",
    plan: "计划",
    "update-goals": "目标",
    "goal-update": "目标",
    "plan-update": "计划",
    "generate-candidates": "候选",
    score: "评分",
    "score-actions": "评分",
    execute: "执行",
    "execute-actions": "执行",
    "observe-events": "观察",
    consequence: "后果",
    "apply-consequences": "后果",
    "advance-case-chain": "推进",
    "trigger-case": "触发",
    "candidate-extraction": "成案",
    "extract-candidates": "成案",
    finalize: "快照"
  };
  const runtimePhases = runtime?.simulationPhases?.length ? runtime.simulationPhases : ["observe", "memory-propagation", "goal-update", "generate-candidates", "score", "execute", "consequence", "candidate-extraction"];
  const currentPhase = runtimePhases.length ? runtimePhases[Math.max(0, (runtime?.tick ?? 0) % runtimePhases.length)] : "observe";
  const propagationCount = runtime?.memoryPropagations?.length ?? 0;
  const consequenceCount = runtime?.consequences?.length ?? 0;
  const selectedDecision = selectedAgent?.lastDecisionId ? runtime?.decisionTraces.find((trace) => trace.id === selectedAgent.lastDecisionId) : undefined;
  const selectedConsequences = selectedAgent ? (runtime?.consequences || []).filter((item) => item.npcId === selectedAgent.npcId).slice(-3).reverse() : [];
  const topCandidate = candidates[0];
  const selectedScenarioPack = scenarioPacks.find((pack) => pack.manifest.id === selectedScenarioPackId) || scenarioPacks[0];
  const latestQualityRun = runCatalog.find((run) => typeof run.packMetadata?.qualityScore === "number");
  const worldSystemHintSummary = runtime?.worldSystemHintSummary;

  async function copyScenarioReport() {
    if (!scenarioReport) {
      setCopyStatus("暂无可复制的场景报告。");
      return;
    }
    if (!navigator.clipboard?.writeText) {
      setCopyStatus("剪贴板不可用，报告 JSON 已显示在面板中。");
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(scenarioReport, null, 2));
      setCopyStatus("场景报告 JSON 已复制。");
    } catch {
      setCopyStatus("浏览器阻止了剪贴板，报告 JSON 已显示在面板中。");
    }
  }

  function confirmRollback() {
    if (!selectedSnapshotFromId) return;
    const label = snapshotFrom ? `${snapshotFrom.label} at tick ${snapshotFrom.tick}` : selectedSnapshotFromId;
    if (window.confirm(`是否把 Persistent Agent Town 回滚到 ${label}？这会恢复导演台评审用的运行状态。`)) {
      rollbackSnapshot(selectedSnapshotFromId);
    }
  }

  function selectBaselineDiff() {
    if (!baselineStartId || !baselineEndId) return;
    setSelectedSnapshotFromId(baselineStartId);
    setSelectedSnapshotToId(baselineEndId);
  }

  return (
    <div className="stackedInspector persistentTownPanel agentDirectorPanel" data-testid="persistent-town-panel">
      <section className="actionPanel reviewSummaryPanel" data-testid="review-summary">
        <div className="panelHeaderLine">
          <h2><Network size={16} /> 案件导演台</h2>
          <span className={`runtimePill ${runtime?.status || "paused"}`}>{runtime?.status || "未启动"}</span>
        </div>
        <p>用导演视角扫读小镇运行：NPC 行动、记忆传播、案件链、分支回放和基准验证集中在同一个控制面板。</p>
        <div className="reviewMetricGrid">
          <span><b>{runtime?.tick ?? 0}</b>Tick</span>
          <span><b>{runtime?.currentTime || "--:--"}</b>第 {runtime?.currentDay ?? 1} 天</span>
          <span className={reviewStatus}><b>{scenarioReport ? (scenarioReport.passed ? "通过" : "失败") : "待运行"}</b>场景</span>
          <span><b>{branchCount}</b>分支</span>
          <span><b>{snapshots.length}</b>快照</span>
          <span className={benchmarkState}><b>{benchmarkSummary ? `${benchmarkSummary.passRate}%` : "N/A"}</b>基准</span>
          <span><b>{queue?.validCount ?? 0}</b>可玩案件</span>
          <span data-testid="director-agent-count"><b>{runtime?.agentStates.length ?? 0}</b>NPC</span>
          <span><b>{phaseLabels[currentPhase] || currentPhase}</b>当前阶段</span>
          <span><b>{propagationCount}</b>传播记忆</span>
          <span><b>{consequenceCount}</b>行动后果</span>
          <span><b>{topCandidate?.chainStageTags?.length || topCandidate?.validation.chainStages?.length || 0}</b>链条阶段</span>
        </div>
        {worldSystemHintSummary && (
          <div className="worldSystemRuntimeHints" data-testid="world-system-runtime-hints">
            <div>
              <span className="eyebrow">World-System Influence Audit</span>
              <strong>{worldSystemHintSummary.active ? "active deterministic bias" : "inactive"}</strong>
              <small>Current Server Runtime hint health; run <code>npm run audit:world-system-hints</code> for the local on/off aggregate audit. No ids, proof structure, or public artifacts are changed.</small>
            </div>
            <div className="reviewMetricGrid compact">
              <span><b>{worldSystemHintSummary.resourcePressure}</b>Resource pressure</span>
              <span><b>{worldSystemHintSummary.eventRisk}</b>Event risk</span>
              <span><b>{worldSystemHintSummary.progressionStageCount}</b>Growth stages</span>
              <span><b>{worldSystemHintSummary.actionKinds.length}</b>Action hints</span>
              <span><b>{worldSystemHintSummary.maxActionBias}</b>Max bias</span>
              <span><b>{worldSystemHintSummary.appliedBiasCount}</b>Applied</span>
            </div>
            <div className="logicBadges">
              <span>{worldSystemHintSummary.resourcePressureLabel}</span>
              <span>{worldSystemHintSummary.factionLaneLabel}</span>
              <span>{worldSystemHintSummary.eventArchetypeLabel}</span>
              <span>{worldSystemHintSummary.progressionLineLabel}</span>
            </div>
          </div>
        )}
        <div className="townRuntimeActions">
          <button type="button" className="primaryButton compact" onClick={startRuntime} disabled={runningBusy}>开始</button>
          <button type="button" onClick={pauseRuntime} disabled={runningBusy || !runtime}>暂停</button>
          <button type="button" onClick={stepRuntime} disabled={runningBusy || !runtime}>单步</button>
          <button type="button" onClick={resetRuntime} disabled={runningBusy || !runtime}>重置</button>
        </div>
        <div className="phaseGemRail">
          {runtimePhases.map((phase) => (
            <span key={phase} className={phase === currentPhase ? "active" : ""}>{phaseLabels[phase] || phase}</span>
          ))}
        </div>
        <small>{queue?.nextAction || "启动运行后，导演台会开始生成 NPC 行动和案件队列。"}</small>
      </section>

      <nav className="actionPanel directorMenuPanel" aria-label="案件导演台菜单">
        <span className="eyebrow">案件菜单</span>
        <a href="#director-actions">NPC 行动</a>
        <a href="#director-scenario">场景推演</a>
        <a href="#director-time-machine">时间机器</a>
        <a href="#director-candidates">案件队列</a>
        <a href="#director-dossier">NPC 档案</a>
        <div className="directorMenuStat">
          <strong>{runtime?.agentStates.length ?? 0}</strong>
          <span>当前管理 NPC</span>
        </div>
      </nav>

      <section className="actionPanel scenarioRunnerPanel" id="director-scenario" data-testid="scenario-runner">
        <div className="panelHeaderLine">
          <h2><GitBranch size={16} /> 场景推演</h2>
          <span className={`runtimePill ${selectedScenarioRun?.status || "paused"}`}>{scenarioReport ? (scenarioReport.passed ? "通过" : "失败") : selectedScenarioRun?.status || "未运行"}</span>
        </div>
        <div className="reviewPathCta" data-testid="agent-review-path-cta">
          <strong>Review Mode: 5-minute evaluator path</strong>
          <span>Scenario Presets</span>
          <span>Run History</span>
          <span>Time Machine Diff</span>
          <span>Export Review Bundle</span>
        </div>
        <p>运行确定性基线，再比较反事实分支；源世界不会被分支污染。</p>
        <div className="reviewMetricGrid compact">
          <span className={reviewStatus}><b>{scenarioReport ? (scenarioReport.passed ? "通过" : "失败") : "-"}</b>结果</span>
          <span><b>{scenarioReport?.baseline.eventGrowth ?? 0}</b>基线事件</span>
          <span><b>{scenarioReport?.baseline.memoryGrowth ?? 0}</b>基线记忆</span>
          <span><b>{scenarioReport?.baseline.validCandidateCount ?? 0}</b>有效案件</span>
          <span><b>{branchCount}</b>分支</span>
          <span><b>{passedChecks}/{totalChecks}</b>检查</span>
        </div>
        <div className="townRuntimeActions">
          <button type="button" className="secondaryButton full" onClick={() => runScenario()} disabled={runningBusy}>运行默认场景</button>
          <button type="button" className="secondaryButton full" onClick={copyScenarioReport} disabled={!scenarioReport}>复制报告 JSON</button>
        </div>
        {copyStatus && <small data-testid="scenario-copy-status">{copyStatus}</small>}
        <ScenarioPresetEditor
          presets={scenarioPresets}
          selectedPresetId={selectedScenarioPresetId}
          onSelectPresetId={setSelectedScenarioPresetId}
          onRunScenario={runScenario}
          onSavePreset={saveScenarioPreset}
          onDeletePreset={deleteScenarioPreset}
          busy={runningBusy || reviewBusy}
        />
        <CurrentExperimentPanel
          scenarioPackId={runtime?.currentScenarioPackId}
          mapPackId={runtime?.currentMapPackId}
          ruleCatalogId={runtime?.currentRuleCatalogId}
          selectedScenarioPackId={selectedScenarioPackId}
          experimentId={runtime?.currentExperiment?.experimentId || selectedScenarioPack?.experimentId}
          experimentHash={runtime?.currentExperiment?.experimentHash || selectedScenarioPack?.experimentHash}
          experimentPathHash={runtime?.currentExperiment?.experimentPathHash || selectedScenarioPack?.experimentPathHash}
          validationOk={selectedScenarioPack?.validation?.ok}
          qualityScore={latestQualityRun?.packMetadata?.qualityScore}
          onStartNewRun={startScenarioJob}
          busy={runningBusy || reviewBusy}
        />
        <ScenarioPackPanel
          packs={scenarioPacks}
          selectedPackId={selectedScenarioPackId}
          onSelectPackId={setSelectedScenarioPackId}
          onExportPack={exportScenarioPack}
          onValidatePack={validateScenarioPack}
          busy={runningBusy || reviewBusy}
        />
        {runtimeMode !== "static-demo" && (
          <WorldPackageCatalogPanel
            worldId={runtime?.worldId}
            selectedScenarioPackId={selectedScenarioPackId}
            onSelectPackId={setSelectedScenarioPackId}
            busy={runningBusy || reviewBusy}
          />
        )}
        <RunCatalogPanel
          runs={runCatalog}
          jobs={runJobs}
          selectedRunId={selectedRunCatalogId}
          onSelectRunId={setSelectedRunCatalogId}
          onExportReplayBundle={exportReplayBundle}
          onStartScenarioJob={startScenarioJob}
          onStartBenchmarkJob={startBenchmarkJob}
          onCancelJob={cancelRunJob}
          busy={runningBusy || reviewBusy}
        />
        {runtimeMode !== "static-demo" && (
          <ReplayDatasetCatalogPanel
            selectedRunId={selectedRunCatalogId}
            onSelectRunId={setSelectedRunCatalogId}
            busy={runningBusy || reviewBusy}
          />
        )}
        {runtimeMode === "static-demo" && (
          <PublicReviewCatalogPanel busy={runningBusy || reviewBusy} />
        )}
        <DatasetPackagePanel busy={runningBusy || reviewBusy} runtimeMode={runtimeMode} />
        <TownRuleStatePanel ruleState={ruleState} caseLifecycle={caseLifecycle} />
        <ReviewExportActions
          busy={runningBusy || reviewBusy || !scenarioReport}
          onCopyJson={copyReviewJson}
          onExportMarkdown={exportReviewMarkdown}
          onExportBundle={exportReviewBundle}
        />
        <ScenarioRunHistory runs={scenarioRuns} selectedRunId={selectedScenarioRun?.id} onSelectRunId={selectScenarioRun} />
        {scenarioReport ? (
          <div className="reviewStack">
            <div className="scenarioCheckList" data-testid="scenario-check-list">
              {scenarioReport.checks.map((check) => (
                <div key={check.id} className={check.passed ? "pass" : "fail"}>
                  <strong>{check.passed ? "通过" : "失败"}</strong>
                  <span>{check.label}</span>
                  <small>实际 {String(check.actual)} / 期望 {String(check.expected)}</small>
                </div>
              ))}
            </div>
            <div className="branchComparison" data-testid="branch-comparison">
              {scenarioReport.branches.map((branch) => (
                <article key={branch.id} className={branch.status === "completed" ? "source" : "gap"}>
                  <strong>{branch.name}</strong>
                  <span>{branch.status}</span>
                  <span>{branch.eventGrowth} 事件</span>
                  <span>{branch.memoryGrowth} 记忆</span>
                  <span>{branch.validCandidateCount} 有效</span>
                  <span>{branch.diffFromBaseline.changedAgents.length} NPC 变化</span>
                  <small>{branch.diffFromBaseline.branchOnlyInterventionIds.length} 个分支专属干预</small>
                </article>
              ))}
            </div>
            <pre className="apiExample">{scenarioReport.summary}</pre>
          </div>
        ) : <small>暂无场景报告。</small>}
      </section>

      <section className="actionPanel timeMachinePanel" id="director-time-machine" data-testid="time-machine">
        <div className="panelHeaderLine">
          <h2><Clock size={16} /> 时间机器 / 分支回放</h2>
          <span>{snapshots.length} 快照</span>
        </div>
        <p>对比 tick、NPC 状态、记忆增长、干预和候选案件变化。</p>
        <div className="timeMachineControls">
          <label>
            起点
            <select value={selectedSnapshotFromId} onChange={(event) => setSelectedSnapshotFromId(event.target.value)}>
              <option value="">选择快照</option>
              {snapshots.map((snapshot) => <option key={snapshot.id} value={snapshot.id}>{snapshot.label} / {snapshot.time}</option>)}
            </select>
          </label>
          <label>
            终点
            <select value={selectedSnapshotToId} onChange={(event) => setSelectedSnapshotToId(event.target.value)}>
              <option value="">选择快照</option>
              {snapshots.map((snapshot) => <option key={snapshot.id} value={snapshot.id}>{snapshot.label} / {snapshot.time}</option>)}
            </select>
          </label>
        </div>
        <div className="townRuntimeActions">
          <button type="button" className="secondaryButton full" onClick={selectBaselineDiff} disabled={!baselineStartId || !baselineEndId}>选择基线差异</button>
          <button type="button" onClick={() => baselineStartId && setSelectedSnapshotFromId(baselineStartId)} disabled={!baselineStartId}>起点设为基线</button>
          <button type="button" onClick={() => baselineEndId && setSelectedSnapshotToId(baselineEndId)} disabled={!baselineEndId}>终点设为基线</button>
        </div>
        <div className="logicBadges">
          <span>起点: {snapshotFrom?.tick ?? "-"}</span>
          <span>终点: {snapshotTo?.tick ?? "-"}</span>
          <span>事件 +{snapshotDiff?.addedEventIds.length ?? 0}</span>
          <span>记忆 +{snapshotDiff?.addedMemoryIds.length ?? 0}</span>
        </div>
        <div className="reviewActionRow">
          <button type="button" onClick={selectBaselineDiff} disabled={!baselineStartId || !baselineEndId}>Return to run baseline</button>
          <button
            type="button"
            onClick={() => {
              const branch = scenarioReport?.branches?.[0];
              if (!branch || !baselineEndId) return;
              setSelectedSnapshotFromId(baselineEndId);
              setSelectedSnapshotToId(branch.endSnapshotId);
            }}
            disabled={!scenarioReport?.branches?.[0] || !baselineEndId}
          >
            Branch end vs baseline end
          </button>
          <button type="button" onClick={markReviewExportTarget} disabled={!selectedSnapshotFromId || !selectedSnapshotToId}>
            Use current diff for export
          </button>
        </div>
        {!!sortedSnapshots.length && (
          <div className="snapshotTimeline" data-testid="snapshot-timeline">
            {sortedSnapshots.map((snapshot) => (
              <button key={snapshot.id} type="button" className={snapshot.id === selectedSnapshotFromId || snapshot.id === selectedSnapshotToId ? "selected" : ""} onClick={() => setSelectedSnapshotToId(snapshot.id)}>
                <strong>{snapshot.label}</strong>
                <span>Tick {snapshot.tick} / {snapshot.time}</span>
                <small>{snapshot.eventIds.length} 事件 / {snapshot.memoryIds.length} 记忆 / {snapshot.candidateSummaries.length} 候选</small>
              </button>
            ))}
          </div>
        )}
        {snapshotDiff ? (
          <div className="snapshotDiffDetails" data-testid="snapshot-diff-details">
            <div><strong>新增事件</strong><span>{snapshotDiff.addedEventIds.length}</span><small>{snapshotDiff.addedEventIds.slice(0, 3).join(" / ") || "无"}</small></div>
            <div><strong>新增记忆</strong><span>{snapshotDiff.addedMemoryIds.length}</span><small>{snapshotDiff.addedMemoryIds.slice(0, 3).join(" / ") || "无"}</small></div>
            <div><strong>NPC 变化</strong><span>{snapshotDiff.changedAgents.length}</span><small>{snapshotDiff.changedAgents.slice(0, 3).map((agent) => `${agent.npcId}:${agent.changedFields.join(",")}`).join(" / ") || "无"}</small></div>
            <div><strong>候选状态变化</strong><span>{snapshotDiff.candidateStatusChanges.length}</span><small>{snapshotDiff.candidateStatusChanges.slice(0, 3).map((candidate) => `${candidate.candidateId}:${candidate.beforeStatus || "new"}->${candidate.afterStatus || "removed"}`).join(" / ") || "无"}</small></div>
            <div><strong>分支专属干预</strong><span>{snapshotDiff.branchOnlyInterventionIds.length}</span><small>{snapshotDiff.branchOnlyInterventionIds.slice(0, 3).join(" / ") || "无"}</small></div>
          </div>
        ) : <small>选择两个快照查看差异。</small>}
        <button type="button" className="secondaryButton full" onClick={confirmRollback} disabled={runningBusy || !selectedSnapshotFromId}>
          回滚到起点快照
        </button>
      </section>

      <section className="actionPanel benchmarkDashboardPanel" data-testid="benchmark-dashboard">
        <div className="panelHeaderLine">
          <h2><ShieldCheck size={16} /> 基准仪表盘</h2>
          <span className={`runtimePill ${benchmarkState}`}>{benchmarkSummary ? (benchmarkSummary.failed === 0 ? "通过" : "失败") : "未生成"}</span>
        </div>
        {benchmarkSummary ? (
          <div className="reviewMetricGrid compact">
            <span><b>{benchmarkSummary.passRate}%</b>通过率</span>
            <span><b>{benchmarkSummary.seedCount}</b>种子数</span>
            <span><b>{benchmarkSummary.averageQualityScore}</b>质量分</span>
            <span><b>{benchmarkSummary.averageEmergenceScore}</b>涌现分</span>
            <span><b>{benchmarkSummary.routeCertifiedRate ?? 0}%</b>Route cert</span>
            <span><b>{benchmarkSummary.autoSolvePassRate ?? 0}%</b>Auto-solve</span>
            <span><b>{benchmarkSummary.averageAutoSolveSteps ?? 0}</b>Auto steps</span>
            <span className={benchmarkSummary.failed === 0 ? "pass" : "fail"}><b>{benchmarkSummary.failed}</b>失败种子</span>
            <span><b>{benchmarkSummary.passed}</b>通过种子</span>
          </div>
        ) : <p>未找到基准报告。运行 <code>npm run benchmark:emergence</code> 会生成 <code>outputs/emergence-benchmark.json</code>，该文件会被 Git 忽略。</p>}
        <BenchmarkSeedTable report={benchmarkSummary || null} busy={reviewBusy} onRunBenchmark={runBenchmark} />
      </section>

      <section className="actionPanel agentStatePanel" id="director-dossier" data-testid="agent-state-panel">
        <h2><Users size={16} /> NPC 档案</h2>
        {selectedAgent ? (
          <article className="worldInspectCard compact">
            <span className="eyebrow">{selectedCharacterName || selectedAgent.npcId}</span>
            <h3>{selectedAgent.currentGoal}</h3>
            <p>{(selectedAgent.currentPlan || (selectedAgent.nextActionPreview ? [selectedAgent.nextActionPreview] : [])).join(" -> ") || "等待下一次观察"}</p>
            <div className="logicBadges">
              <span>优先级: {selectedAgent.goalPriority}</span>
              <span>关系压力: {selectedAgent.relationshipPressure}</span>
              <span>秘密风险: {selectedAgent.secretRisk}</span>
              <span>警觉: {selectedAgent.alertness}</span>
              <span>位置: {selectedAgent.locationId}</span>
              <span>传播记忆: {selectedAgent.propagatedMemoryCount ?? 0}</span>
              <span>最近后果: {selectedAgent.lastConsequence || "无"}</span>
            </div>
            <small>已知事实: {(selectedAgent.knownFactIds || []).slice(-4).join(" / ") || "无"}</small>
            {selectedDecision?.consequence && (
              <div className="directorConsequence">
                <strong>行动后果</strong>
                <span>{actionLabels[selectedDecision.consequence.actionKind] || selectedDecision.consequence.actionKind}</span>
                <small>压力 {selectedDecision.consequence.relationshipPressureDelta >= 0 ? "+" : ""}{selectedDecision.consequence.relationshipPressureDelta} / 风险 {selectedDecision.consequence.secretRiskDelta >= 0 ? "+" : ""}{selectedDecision.consequence.secretRiskDelta} / 记忆 +{selectedDecision.consequence.memoryIds.length}</small>
              </div>
            )}
            {!!selectedConsequences.length && (
              <div className="directorMiniList">
                {selectedConsequences.map((item) => (
                  <span key={item.id}>{actionLabels[item.actionKind] || item.actionKind} - {stageLabels[item.chainStage || "memory"] || item.chainStage || "记忆"}</span>
                ))}
              </div>
            )}
            <button type="button" className="secondaryButton full" onClick={() => interveneAgent()} disabled={runningBusy}>施加资源干预</button>
          </article>
        ) : <p>在地图或嫌疑人板选择 NPC，查看角色状态。</p>}
        <div className="simulationCandidateList directorActionList" id="director-actions" data-testid="agent-action-candidates">
          {selectedAgentCandidates.slice(0, 5).map((candidate) => (
            <article key={candidate.id} className={candidate.legal ? "source" : "gap"}>
              <strong>{actionLabels[candidate.kind] || candidate.kind}: {candidate.description}</strong>
              <span>行动评分 {candidate.score.total} / 目标 {candidate.targetLocationId}</span>
              <div className="actionScoreGrid">
                <span>目击 {candidate.score.witnessExposure ?? 0}</span>
                <span>传闻 {candidate.score.rumorValue ?? 0}</span>
                <span>不在场 {candidate.score.alibiPressure ?? 0}</span>
                <span>掩盖 {candidate.score.coverUpUrgency ?? 0}</span>
                <span>World hint {candidate.score.worldSystemBias ?? 0}</span>
              </div>
              <small>{candidate.legal ? candidate.score.reasons.join(" / ") || "可执行行动" : candidate.blockedReason || "被本地规则阻止"}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="actionPanel emergenceQueuePanel" id="director-candidates" data-testid="emergence-queue">
        <h2><GitBranch size={16} /> 案件队列</h2>
        {!candidates.length && <p>暂无候选案件。单步运行，直到压力链形成。</p>}
        {candidates.slice(0, 5).map((candidate) => (
          <article key={candidate.id} className={`candidateCard ${candidate.validation.valid ? "pass" : "fail"}`}>
            <div className="panelHeaderLine">
              <strong>{candidate.culpritId} {"->"} {candidate.victimId}</strong>
              <span>{candidate.status}</span>
            </div>
            <p>压力 {candidate.pressureScore}; 事件 {candidate.riskChainEventIds.length}; 记忆 {candidate.memoryIds.length}</p>
            <div className="logicBadges">
              <span>事件支撑: {candidate.validation.worldBackedEvidence ? "是" : "否"}</span>
              <span>记忆证词: {candidate.validation.memoryScopedTestimony ? "是" : "否"}</span>
              <span>时间闭合: {candidate.validation.timelineClosed ? "是" : "否"}</span>
              <span>硬逻辑: {candidate.validation.hardLogicValid ? "通过" : "待补"}</span>
            </div>
            <div className="questChain">
              {(candidate.chainStageTags || candidate.validation.chainStages || []).length ? (candidate.chainStageTags || candidate.validation.chainStages || []).map((stage) => (
                <span key={`${candidate.id}:${stage}`}>{stageLabels[stage] || stage}</span>
              )) : <span>形成中</span>}
            </div>
            {!!candidate.validation.errors.length && <small>{candidate.validation.errors.slice(0, 2).join(" / ")}</small>}
            {!!candidate.validation.failureReasons?.length && <small>{candidate.validation.failureReasons.slice(0, 2).join(" / ")}</small>}
            <CandidatePlayabilityPreview candidate={candidate} />
            <button type="button" className="secondaryButton full" onClick={() => extractCase(candidate)} disabled={runningBusy}>
              抽取可玩案件
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}

export function PersistentTownCommandCenter({
  runtimeMode,
  worldName,
  caseTitle,
  runtime,
  queue,
  brief,
  snapshot,
  selectedAgent,
  selectedAgentCandidates,
  selectedLocationId,
  selectedCharacterName,
  selectedCharacterId,
  runningBusy,
  startRuntime,
  pauseRuntime,
  stepRuntime,
  stepRuntimeFast,
  resetRuntime,
  interveneAgent,
  extractCase,
  scenarioPresets,
  scenarioPacks,
  scenarioRuns,
  runCatalog,
  runJobs,
  ruleState,
  caseLifecycle,
  selectedScenarioPackId,
  setSelectedScenarioPackId,
  selectedRunCatalogId,
  setSelectedRunCatalogId,
  selectedScenarioPresetId,
  setSelectedScenarioPresetId,
  selectScenarioRun,
  runScenario,
  saveScenarioPreset,
  deleteScenarioPreset,
  exportScenarioPack,
  validateScenarioPack,
  exportReplayBundle,
  startScenarioJob,
  startBenchmarkJob,
  cancelRunJob,
  copyReviewJson,
  exportReviewMarkdown,
  exportReviewBundle,
  rollbackSnapshot,
  markReviewExportTarget,
  backToPlay,
  onActorSelect,
  onLocationSelect,
  selectedScenarioRun,
  scenarioReport,
  snapshots,
  selectedSnapshotFromId,
  selectedSnapshotToId,
  setSelectedSnapshotFromId,
  setSelectedSnapshotToId,
  snapshotDiff,
  benchmarkSummary,
  runBenchmark,
  reviewBusy
}: {
  runtimeMode: RuntimeMode;
  worldName: string;
  caseTitle: string;
  runtime: PersistentTownRuntime | null;
  queue: TownEmergenceQueue | null;
  brief?: TownSituationBrief | null;
  snapshot: WorldMapSnapshot | null;
  selectedAgent?: NpcAgentState | null;
  selectedAgentCandidates: NpcActionCandidate[];
  selectedLocationId?: string;
  selectedCharacterName?: string;
  selectedCharacterId?: string;
  runningBusy: boolean;
  startRuntime: () => void;
  pauseRuntime: () => void;
  stepRuntime: () => void;
  stepRuntimeFast: () => void;
  resetRuntime: () => void;
  interveneAgent: (kind?: TownRuntimeIntervention["kind"], value?: string | number | boolean) => void;
  extractCase: (candidate: CaseCandidate) => void;
  scenarioPresets: ScenarioPreset[];
  scenarioPacks: Array<ScenarioPack & { builtIn?: boolean; source?: string; experimentId?: string; experimentHash?: string; experimentPathHash?: string; validation?: { ok: boolean } }>;
  scenarioRuns: ScenarioRunSummary[];
  runCatalog: RunCatalogEntry[];
  runJobs: RunJob[];
  ruleState?: TownRuleSnapshotSummary | null;
  caseLifecycle?: TownCaseLifecycleState | null;
  selectedScenarioPackId: string;
  setSelectedScenarioPackId: (packId: string) => void;
  selectedRunCatalogId: string;
  setSelectedRunCatalogId: (runId: string) => void;
  selectedScenarioPresetId: string;
  setSelectedScenarioPresetId: (presetId: string) => void;
  selectScenarioRun: (scenarioId: string) => void;
  runScenario: (config?: ScenarioConfig) => void;
  saveScenarioPreset: (preset: ScenarioPreset, overwrite: boolean) => void;
  deleteScenarioPreset: (presetId: string) => void;
  exportScenarioPack: () => void;
  validateScenarioPack: () => void;
  exportReplayBundle: () => void;
  startScenarioJob: () => void;
  startBenchmarkJob: () => void;
  cancelRunJob: (jobId: string) => void;
  copyReviewJson: () => void;
  exportReviewMarkdown: () => void;
  exportReviewBundle: () => void;
  rollbackSnapshot: (snapshotId: string) => void;
  markReviewExportTarget: () => void;
  backToPlay: () => void;
  onActorSelect: (actor: WorldMapActor) => void;
  onLocationSelect: (locationId: string) => void;
  selectedScenarioRun?: ScenarioRun | null;
  scenarioReport?: ScenarioReport | null;
  snapshots: TownStateSnapshot[];
  selectedSnapshotFromId: string;
  selectedSnapshotToId: string;
  setSelectedSnapshotFromId: (value: string) => void;
  setSelectedSnapshotToId: (value: string) => void;
  snapshotDiff?: TownStateDiff | null;
  benchmarkSummary?: BenchmarkSummary | null;
  runBenchmark: (seedCount: 10 | 20) => void;
  reviewBusy?: boolean;
}) {
  const candidates = queue?.candidates || runtime?.candidates || [];
  const actionLabels: Record<string, string> = {
    investigate: "调查",
    "spread-rumor": "传闻",
    "seek-alibi": "不在场",
    pressure: "施压",
    "cover-up": "掩盖",
    talk: "交谈",
    trade: "交易",
    move: "移动",
    rest: "休整"
  };
  const stageLabels: Record<string, string> = {
    motive: "动机",
    means: "手段",
    opportunity: "机会",
    "cover-up": "掩盖",
    staging: "伪装",
    memory: "记忆",
    exclusion: "排除",
    "non-culprit-exclusion": "排除"
  };
  const phaseLabels: Record<string, string> = {
    observe: "感知",
    propagate: "传播",
    "propagate-memory": "传播",
    plan: "计划",
    "update-goals": "目标",
    score: "评分",
    "score-actions": "评分",
    execute: "执行",
    "execute-actions": "执行",
    "observe-events": "观察",
    consequence: "后果",
    "apply-consequences": "后果",
    "advance-case-chain": "推进",
    "trigger-case": "触发",
    "candidate-extraction": "成案",
    "extract-candidates": "成案",
    finalize: "快照"
  };
  const currentPhase = runtime?.simulationPhases?.length ? runtime.simulationPhases[Math.max(0, (runtime.tick || 0) % runtime.simulationPhases.length)] : "execute";
  const recentTraces = [...(runtime?.decisionTraces || [])].slice(-6).reverse();
  const recentConsequences = [...(runtime?.consequences || [])].slice(0, 3);
  const triggeredCases = runtime?.triggeredCases || [];
  const topLongChain = [...(runtime?.longChainLedger || [])].sort((a, b) => (b.maturityScore || 0) - (a.maturityScore || 0))[0];
  const snapshotFrom = snapshots.find((item) => item.id === selectedSnapshotFromId);
  const snapshotTo = snapshots.find((item) => item.id === selectedSnapshotToId);
  const benchmarkState = benchmarkSummary ? (benchmarkSummary.failed === 0 ? "pass" : "fail") : "pending";
  const scenarioState = scenarioReport ? (scenarioReport.passed ? "pass" : "fail") : "pending";
  const selectedActor = snapshot?.actors.find((actor) => actor.id === selectedCharacterId);
  const maxX = Math.max(1, (snapshot?.width || 28) - 1);
  const maxY = Math.max(1, (snapshot?.height || 18) - 1);
  const actorName = selectedCharacterName || selectedActor?.name || selectedAgent?.npcId || "未选择 NPC";
  const actorPortrait = getNoirPortrait(selectedActor?.name || selectedCharacterName || "");
  const [activeSection, setActiveSection] = useState<"map" | "actions" | "memory" | "queue" | "time">("map");
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [mapFilters, setMapFilters] = useState({ npc: true, evidence: true, event: true });
  const [traceKindFilter, setTraceKindFilter] = useState<string>("all");
  const [selectedTraceId, setSelectedTraceId] = useState<string>("");
  const [biasStatus, setBiasStatus] = useState("");
  const [menuExpanded, setMenuExpanded] = useState(true);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, x: 0, y: 0 });
  const activeTrace = recentTraces.find((trace) => trace.id === selectedTraceId) || recentTraces[0];
  const traceKinds = Array.from(new Set(recentTraces.flatMap((trace) => trace.candidates.find((candidate) => candidate.id === trace.selectedCandidateId)?.kind || [])));
  const filteredTraces = traceKindFilter === "all"
    ? recentTraces
    : recentTraces.filter((trace) => trace.candidates.find((candidate) => candidate.id === trace.selectedCandidateId)?.kind === traceKindFilter);
  const visibleMarkers = (snapshot?.markers || []).filter((marker) =>
    marker.type === "evidence" ? mapFilters.evidence :
    marker.type === "event" || marker.type === "crime" || marker.type === "contradiction" ? mapFilters.event :
    true
  );
  const memoryPropagations = [...(runtime?.memoryPropagations || [])].slice(-12).reverse();
  const eventObservations = [...(runtime?.eventObservations || [])];
  const selectedObservationStats = selectedAgent
    ? {
        direct: eventObservations.filter((item) => item.observerNpcId === selectedAgent.npcId && item.kind === "direct").length,
        sameLocation: eventObservations.filter((item) => item.observerNpcId === selectedAgent.npcId && item.kind === "same-location").length,
        rumor: eventObservations.filter((item) => item.observerNpcId === selectedAgent.npcId && item.kind === "rumor").length,
        deduced: eventObservations.filter((item) => item.observerNpcId === selectedAgent.npcId && item.kind === "deduced").length,
        exclusion: eventObservations.filter((item) => item.observerNpcId === selectedAgent.npcId && (item.kind === "alibi" || item.kind === "exclusion")).length
      }
    : { direct: 0, sameLocation: 0, rumor: 0, deduced: 0, exclusion: 0 };
  const socialProfiles = runtime?.socialProfiles || [];
  const relationshipLedger = runtime?.relationshipLedger || [];
  const locationProfiles = runtime?.locationProfiles || [];
  const locationLedger = runtime?.locationLedger || [];
  const selectedSocial = selectedAgent?.socialProfile;
  const activeLocationId = selectedLocationId || selectedAgent?.locationId || selectedActor?.locationId;
  const selectedLocationProfile = locationProfiles.find((profile) => profile.locationId === activeLocationId);
  const selectedLocationName = snapshot?.tiles.find((tile) => tile.locationId === activeLocationId)?.locationName || selectedActor?.locationName || activeLocationId || "市中心";
  const branchSummary = scenarioReport?.branches?.[0];
  const actionPriority = ["investigate", "spread-rumor", "seek-alibi", "pressure", "cover-up", "talk", "observe", "move", "obtain-resource", "confront", "hide-trace"];
  const displayedActionCandidates = [...selectedAgentCandidates].sort((a, b) => actionPriority.indexOf(a.kind) - actionPriority.indexOf(b.kind)).slice(0, 5);
  const canExportCurrentDiff = Boolean(selectedSnapshotFromId && selectedSnapshotToId);
  const selectedScenarioPack = scenarioPacks.find((pack) => pack.manifest.id === selectedScenarioPackId) || scenarioPacks[0];
  const latestQualityRun = runCatalog.find((run) => typeof run.packMetadata?.qualityScore === "number");
  const briefCampaignPacing = brief?.campaignSession ? deriveCampaignPacingViewModel({
    runtimeMode: runtimeMode === "static-demo" ? "static-demo" : "server",
    campaign: brief.campaignSession,
    currentAction: { status: brief.campaignSession.status, label: brief.campaignSession.primaryActionLabel, detail: brief.nextAction, nextAction: brief.campaignSession.nextAction },
    signals: [
      brief.campaignRecovery ? { kind: "recovery" as const, ...brief.campaignRecovery } : undefined,
      brief.investigatorHeadquarters ? { kind: "headquarters" as const, ...brief.investigatorHeadquarters } : undefined,
      brief.worldArcDirective ? { kind: "directive" as const, ...brief.worldArcDirective } : undefined,
      brief.worldEventOffer ? { kind: "offer" as const, ...brief.worldEventOffer } : undefined,
      brief.worldPressureCascade ? { kind: "pressure" as const, ...brief.worldPressureCascade } : undefined,
      brief.townSocialResponse ? { kind: "reaction" as const, ...brief.townSocialResponse } : undefined
    ].filter((signal): signal is NonNullable<typeof signal> => Boolean(signal)),
    hasCase: brief.campaignSession.status === "case-active",
    busy: runningBusy
  }) : null;

  function describeAction(candidate?: NpcActionCandidate) {
    if (!candidate) return "等待行动";
    const descriptions: Record<string, string> = {
      observe: "观察附近公开事件并更新个人记忆",
      move: `前往 ${candidate.targetLocationId} 推进当前计划`,
      talk: `与 ${candidate.targetNpcId || "目标 NPC"} 交谈并交换信息`,
      investigate: "检查现场痕迹，并与已知记忆交叉核对",
      "spread-rumor": `向 ${candidate.targetNpcId || "目标 NPC"} 传播部分事实`,
      "seek-alibi": "前往公共地点寻找不在场证明",
      pressure: `向 ${candidate.targetNpcId || "关系目标"} 施压以改变局势`,
      confront: `与 ${candidate.targetNpcId || "关系目标"} 正面对峙`,
      "obtain-resource": `获取资源 ${candidate.resourceId || "关键物品"}`,
      "cover-up": "混淆来源链并降低秘密暴露风险",
      "hide-trace": "隐藏可能连接因果链的痕迹"
    };
    return descriptions[candidate.kind] || candidate.description;
  }

  function translateRuleText(value?: string) {
    if (!value) return "预期产生新的世界状态变化";
    const rules: Array<[string, string]> = [
      ["required resource is not available", "缺少行动所需资源"],
      ["target location is not reachable", "目标地点当前不可达"],
      ["secret risk is high", "秘密风险正在影响行动选择"],
      ["relationship pressure is high", "关系压力已达到高位"],
      ["local witness exposure can reveal source events", "本地目击暴露可揭示来源事件"],
      ["known facts can propagate as rumor memory", "已知事实可传播为传闻记忆"],
      ["agent tries to create an alibi before pressure rises", "NPC 尝试在压力上升前建立不在场证明"],
      ["secret risk creates cover-up urgency", "秘密风险正在提升掩盖行动的紧迫度"],
      ["director action bias favors", "导演偏置正在提高该行动的下一 Tick 优先级"],
      ["missing motive stage", "缺少动机阶段"],
      ["missing means stage", "缺少手段阶段"],
      ["missing opportunity stage", "缺少机会阶段"],
      ["missing cover-up stage", "缺少掩盖阶段"],
      ["missing memory support", "缺少记忆支撑"],
      ["missing timeline depth", "时间线深度不足"],
      ["non-culprit exclusion seed missing", "缺少非凶手排除种子"],
      ["missing real case trigger", "缺少真实案件触发事件"],
      ["real case trigger missing", "缺少真实案件触发事件"]
    ];
    const matched = rules.find(([source]) => value.includes(source));
    return matched ? matched[1] : value;
  }

  function translatePlan(value: string) {
    return value
      .replace(/^Move through /, "前往 ")
      .replace(/^Stage: /, "因果阶段：")
      .replace(/^Act: /, "行动：")
      .replace(/^Watch: /, "关注地点：")
      .replace("observe public events", "观察公开事件")
      .replace("preserve routine", "维持日常路线")
      .replace("avoid witnesses", "避开目击者")
      .replace("resolve pressure source", "处理压力来源");
  }

  function beginMapDrag(event: PointerEvent<HTMLDivElement>) {
    dragRef.current = { active: true, startX: event.clientX, startY: event.clientY, x: mapPan.x, y: mapPan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveMapDrag(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active) return;
    setMapPan({
      x: dragRef.current.x + event.clientX - dragRef.current.startX,
      y: dragRef.current.y + event.clientY - dragRef.current.startY
    });
  }

  function endMapDrag(event: PointerEvent<HTMLDivElement>) {
    dragRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function focusTrace(trace: AgentDecisionTrace) {
    setSelectedTraceId(trace.id);
    const selected = trace.candidates.find((candidate) => candidate.id === trace.selectedCandidateId);
    const actor = snapshot?.actors.find((item) => item.id === trace.npcId);
    if (actor) onActorSelect(actor);
    if (selected?.targetLocationId) onLocationSelect(selected.targetLocationId);
    setActiveSection("actions");
  }

  function applyActionBias(candidate: NpcActionCandidate) {
    setBiasStatus(`已偏置下一 Tick：${actionLabels[candidate.kind] || candidate.kind}`);
    interveneAgent("action-bias", candidate.kind);
  }

  function confirmRollback() {
    if (!selectedSnapshotFromId) return;
    const label = snapshotFrom ? `${snapshotFrom.label} / Tick ${snapshotFrom.tick}` : selectedSnapshotFromId;
    if (window.confirm(`是否回滚到 ${label}？这会恢复指挥中心中的运行状态。`)) rollbackSnapshot(selectedSnapshotFromId);
  }

  function chooseBaselineDiff() {
    if (!scenarioReport) return;
    setSelectedSnapshotFromId(scenarioReport.baseline.startSnapshotId);
    setSelectedSnapshotToId(scenarioReport.baseline.endSnapshotId);
  }

  return (
    <main className="commandCenterShell" data-testid="persistent-command-center">
      <header className="commandTopHud" data-testid="command-center-hud">
        <button type="button" className="commandBrand" onClick={backToPlay} aria-label="返回 Play">
          <img src="/command-center/command-emblem.webp" alt="" />
          <span><strong>模拟指挥中心</strong><small>DETECTIVE TOWN</small></span>
        </button>
        <div className="commandChapter">
          <span>当前案件</span>
          <strong>{caseTitle}</strong>
          <small>{worldName}</small>
        </div>
        <div className="commandHudMetric"><span>Tick</span><strong>{runtime?.tick ?? 0}</strong><small>/ {runtime?.maxTicks ?? 200}</small></div>
        <div className="commandHudMetric"><span>时间</span><strong>{runtime?.currentTime || snapshot?.time || "--:--"}</strong><small>第 {runtime?.currentDay ?? snapshot?.day ?? 1} 天</small></div>
        <div className="commandHudMetric hot"><span>当前阶段</span><strong>{phaseLabels[currentPhase] || currentPhase}</strong><small>{currentPhase}</small></div>
        <div className="commandHudMetric"><span>活跃 NPC</span><strong>{runtime?.agentStates.length ?? 0}</strong><small>/ 20</small></div>
        <div className="commandHudMetric"><span>传播记忆</span><strong>{runtime?.memoryPropagations?.length ?? 0}</strong><small>+{recentTraces.reduce((sum, trace) => sum + (trace.propagatedMemoryIds?.length || 0), 0)}</small></div>
        <div className="commandHudMetric"><span>观察索引</span><strong>{eventObservations.length}</strong><small>谁知道什么</small></div>
        <div className="commandHudMetric"><span>社会画像</span><strong>{socialProfiles.length}</strong><small>关系 {relationshipLedger.length}</small></div>
        <div className="commandHudMetric"><span>地点压力</span><strong>{locationProfiles.length}</strong><small>热度 {locationLedger.length}</small></div>
        <div className="commandHudMetric"><span>行动后果</span><strong>{runtime?.consequences?.length ?? 0}</strong><small>最近 {recentConsequences.length}</small></div>
        <div className="commandHudMetric"><span>有效候选</span><strong>{queue?.validCount ?? candidates.filter((candidate) => candidate.validation.valid).length}</strong><small>{candidates.length} 总数</small></div>
        <div className="commandHudMetric hot"><span>案件成熟度</span><strong>{topLongChain?.maturityScore ?? 0}%</strong><small>{triggeredCases.length ? "真实案件已触发" : "六阶段链"}</small></div>
        <button type="button" className={`commandPass ${scenarioState}`} onClick={() => runScenario()} disabled={runningBusy}>
          {scenarioReport?.passed ? "基线通过 / Baseline passed" : "运行基线 / Run baseline scenario"} <ShieldCheck size={16} />
        </button>
      </header>

      <section className="commandReviewPath commandPanel" data-testid="command-review-path">
        <div className="panelHeaderLine">
          <h2><GitBranch size={16} /> Review Mode: 5-minute evaluator path</h2>
          <span className={`runtimePill ${scenarioState}`}>{scenarioReport ? (scenarioReport.passed ? "scenario passed" : "scenario failed") : "ready"}</span>
        </div>
        <p className="commandReviewSteps">
          1. Pick Scenario Preset, 2. Run selected preset, 3. Select Scenario Run History, 4. Choose Time Machine Diff, 5. Export Review Bundle.
        </p>
        <div className="reviewMetricGrid compact">
          <span><b>{scenarioPresets.length}</b>Scenario Presets</span>
          <span><b>{scenarioRuns.length}</b>Run History</span>
          <span><b>{snapshots.length}</b>Snapshots</span>
          <span><b>{snapshotDiff ? snapshotDiff.addedEventIds.length : 0}</b>Time Machine Diff events</span>
          <span><b>{benchmarkSummary ? `${benchmarkSummary.passRate}%` : "N/A"}</b>Benchmark latest</span>
        </div>
        <ScenarioPresetEditor
          presets={scenarioPresets}
          selectedPresetId={selectedScenarioPresetId}
          onSelectPresetId={setSelectedScenarioPresetId}
          onRunScenario={runScenario}
          onSavePreset={saveScenarioPreset}
          onDeletePreset={deleteScenarioPreset}
          busy={runningBusy || reviewBusy}
        />
        <CurrentExperimentPanel
          scenarioPackId={runtime?.currentScenarioPackId}
          mapPackId={runtime?.currentMapPackId}
          ruleCatalogId={runtime?.currentRuleCatalogId}
          selectedScenarioPackId={selectedScenarioPackId}
          experimentId={runtime?.currentExperiment?.experimentId || selectedScenarioPack?.experimentId}
          experimentHash={runtime?.currentExperiment?.experimentHash || selectedScenarioPack?.experimentHash}
          experimentPathHash={runtime?.currentExperiment?.experimentPathHash || selectedScenarioPack?.experimentPathHash}
          validationOk={selectedScenarioPack?.validation?.ok}
          qualityScore={latestQualityRun?.packMetadata?.qualityScore}
          onStartNewRun={startScenarioJob}
          busy={runningBusy || reviewBusy}
        />
        <ScenarioPackPanel
          packs={scenarioPacks}
          selectedPackId={selectedScenarioPackId}
          onSelectPackId={setSelectedScenarioPackId}
          onExportPack={exportScenarioPack}
          onValidatePack={validateScenarioPack}
          busy={runningBusy || reviewBusy}
        />
        {runtimeMode !== "static-demo" && (
          <WorldPackageCatalogPanel
            worldId={runtime?.worldId}
            selectedScenarioPackId={selectedScenarioPackId}
            onSelectPackId={setSelectedScenarioPackId}
            busy={runningBusy || reviewBusy}
          />
        )}
        <ScenarioRunHistory runs={scenarioRuns} selectedRunId={selectedScenarioRun?.id} onSelectRunId={selectScenarioRun} />
        <RunCatalogPanel
          runs={runCatalog}
          jobs={runJobs}
          selectedRunId={selectedRunCatalogId}
          onSelectRunId={setSelectedRunCatalogId}
          onExportReplayBundle={exportReplayBundle}
          onStartScenarioJob={startScenarioJob}
          onStartBenchmarkJob={startBenchmarkJob}
          onCancelJob={cancelRunJob}
          busy={runningBusy || reviewBusy}
        />
        {runtimeMode !== "static-demo" && (
          <ReplayDatasetCatalogPanel
            selectedRunId={selectedRunCatalogId}
            onSelectRunId={setSelectedRunCatalogId}
            busy={runningBusy || reviewBusy}
          />
        )}
        {runtimeMode === "static-demo" && (
          <PublicReviewCatalogPanel busy={runningBusy || reviewBusy} />
        )}
        <DatasetPackagePanel busy={runningBusy || reviewBusy} runtimeMode={runtimeMode} />
        <TownRuleStatePanel ruleState={ruleState} caseLifecycle={caseLifecycle} />
        <div className="reviewActionRow">
          <button type="button" onClick={chooseBaselineDiff} disabled={!scenarioReport}>
            Select baseline Time Machine diff
          </button>
          <button type="button" onClick={markReviewExportTarget} disabled={!canExportCurrentDiff}>
            Use current diff for export
          </button>
        </div>
        <ReviewExportActions
          busy={runningBusy || reviewBusy || !scenarioReport}
          onCopyJson={copyReviewJson}
          onExportMarkdown={exportReviewMarkdown}
          onExportBundle={exportReviewBundle}
        />
      </section>

      <aside className="commandLeftRail">
        <section className={`commandPanel commandArchive ${menuExpanded ? "expanded" : "collapsed"}`}>
          <div className="panelHeaderLine"><h2>案件档案</h2><button className="commandMenuToggle" type="button" onClick={() => setMenuExpanded((value) => !value)}>{menuExpanded ? "收起" : "展开"}</button></div>
          <div className="commandArchiveItems">
            <button className={activeSection === "map" ? "active" : ""} type="button" onClick={() => setActiveSection("map")}>小镇地图</button>
            <button className={activeSection === "actions" ? "active" : ""} type="button" onClick={() => setActiveSection("actions")}>NPC 行动</button>
            <button className={activeSection === "memory" ? "active" : ""} type="button" onClick={() => setActiveSection("memory")}>记忆传播 <b>{memoryPropagations.length}</b></button>
            <button className={activeSection === "queue" ? "active" : ""} type="button" onClick={() => setActiveSection("queue")}>案件队列 <b>{candidates.length}</b></button>
            <button className={activeSection === "time" ? "active" : ""} type="button" onClick={() => setActiveSection("time")}>时间机器</button>
          </div>
        </section>
        <section className="commandPanel commandControls">
          <div className="panelHeaderLine"><h2>运行控制</h2><span className={`runtimePill ${runtime?.status || "paused"}`}>{runtime?.status || "未启动"}</span></div>
          <button className="primaryButton full" type="button" onClick={startRuntime} disabled={runningBusy}>开始</button>
          <button type="button" onClick={pauseRuntime} disabled={runningBusy || !runtime}>暂停</button>
          <div className="commandSplit">
            <button data-testid="persistent-town-step" type="button" onClick={stepRuntime} disabled={runningBusy || !runtime}>单步</button>
            <button type="button" onClick={stepRuntimeFast} disabled={runningBusy || !runtime}>快速 x5</button>
          </div>
          <button type="button" onClick={resetRuntime} disabled={runningBusy || !runtime}>重置</button>
        </section>
        <section className={`commandPanel commandSituationBrief urgency-${brief?.urgency || "stable"}`} data-testid="town-situation-brief">
          <div className="panelHeaderLine"><h2>Situation Brief</h2><span>{brief?.urgency || "stable"}</span></div>
          {!brief ? <p>Start the runtime to generate a focused town summary.</p> : <>
            <strong className="situationHeadline">{brief.headline}</strong>
            <small>{brief.nextAction}</small>
            <div className="situationMetrics">
              <span><b>{brief.caseReadiness.highestMaturityScore}%</b>chain</span>
              <span><b>{brief.caseReadiness.validCount}</b>ready</span>
              <span><b>{brief.observationMix.direct + brief.observationMix.deduced}</b>grounded</span>
            </div>
            {brief.townSocialResponse && brief.townSocialResponse.reactions.slice(-1).map((reaction) => (
              <div className={`situationSocialResponse ${brief.townSocialResponse?.status}`} data-testid="situation-town-social-response" key={`${reaction.actorName}-${reaction.locationLabel}`}>
                <span>Latest Town Reaction</span>
                <b>{reaction.actorName} · {reaction.roleLabel}</b>
                <small>{reaction.locationLabel} · {reaction.reactionLabel}</small>
              </div>
            ))}
            {brief.playerResourceCommitment && (
              <div className={`situationInfluenceBudget ${brief.playerResourceCommitment.status}`} data-testid="situation-player-resource">
                <span>Investigation Operations</span>
                <b>{brief.playerResourceCommitment.planStatus} / {brief.playerResourceCommitment.completedOperationCount}/3 resolved</b>
                <small>{brief.playerResourceCommitment.supportCount}/{brief.playerResourceCommitment.supportCapacity} support slots · {brief.playerResourceCommitment.townTimeMinutes} case minutes</small>
              </div>
            )}
            {brief.factionRelationship && (
              <div className={`situationInfluenceBudget ${brief.factionRelationship.status}`} data-testid="situation-faction-relationship">
                <span>Faction Standing</span>
                <b>{brief.factionRelationship.trustedCount} trusted / {brief.factionRelationship.strainedCount} guarded</b>
                <small>{brief.factionRelationship.lastChangeLabel}</small>
              </div>
            )}
            {brief.worldEventOffer && (
              <div className={`situationInfluenceBudget ${brief.worldEventOffer.status}`} data-testid="situation-world-event-offer">
                <span>World Opportunity</span>
                <b>{brief.worldEventOffer.status} / {brief.worldEventOffer.actionLabel}</b>
                <small>{brief.worldEventOffer.progressLabel}</small>
              </div>
            )}
            {brief.investigatorProgression && (
              <div className={`situationInfluenceBudget ${brief.investigatorProgression.status}`} data-testid="situation-investigator-progression">
                <span>Investigator Practice</span>
                <b>{brief.investigatorProgression.status} / {brief.investigatorProgression.points} marks</b>
                <small>{brief.investigatorProgression.unlockedLabels.length} bounded unlock(s)</small>
              </div>
            )}
            {brief.investigatorHeadquarters && (
              <div className={`situationInfluenceBudget ${brief.investigatorHeadquarters.status}`} data-testid="situation-investigator-headquarters">
                <span>Investigator Headquarters</span>
                <b>{brief.investigatorHeadquarters.status} / {brief.investigatorHeadquarters.completedCount}/{brief.investigatorHeadquarters.maximumCount}</b>
                <small>{brief.investigatorHeadquarters.status === "ready" ? "Choose one preparation before the next extraction." : brief.investigatorHeadquarters.progressLabel}</small>
              </div>
            )}
            {brief.campaignRecovery && (
              <div className={`situationInfluenceBudget ${brief.campaignRecovery.status}`} data-testid="situation-campaign-recovery">
                <span>Campaign recovery</span>
                <b>{brief.campaignRecovery.status} / {brief.campaignRecovery.recoveryActionLabel}</b>
                <small>{brief.campaignRecovery.progressLabel}</small>
              </div>
            )}
            {brief.arcConvergence && (
              <div className={`situationInfluenceBudget ${brief.arcConvergence.status}`} data-testid="situation-arc-convergence">
                <span>Arc Convergence</span>
                <b>{brief.arcConvergence.status} / {brief.arcConvergence.finaleLabel}</b>
                <small>{brief.arcConvergence.approachLabel} / {brief.arcConvergence.caseProgressLabel}</small>
              </div>
            )}
            {brief.campaignSession && (
              <div className={`situationInfluenceBudget ${brief.campaignSession.status}`} data-testid="situation-campaign-session">
                <span>{[brief.campaignSession.campaignLabel || "Campaign Journey", brief.campaignSession.routeLabel].filter(Boolean).join(" / ")}</span>
                <b>{brief.campaignSession.chapterLabel} / {brief.campaignSession.progressLabel}</b>
                <small>{brief.campaignSession.primaryActionLabel}</small>
              </div>
            )}
            {briefCampaignPacing && (
              <div className={`situationCampaignPacing ${briefCampaignPacing.status}`} data-testid="situation-campaign-pacing">
                <span>Why now / what changes</span>
                <b>{briefCampaignPacing.currentObjective.label}</b>
                <small>{briefCampaignPacing.whyNow}</small>
                <em>{briefCampaignPacing.safeForecast.whatChanges}</em>
              </div>
            )}
            {brief.worldArcDirective && (
              <div className={`situationDirective ${brief.worldArcDirective.status}`} data-testid="situation-faction-directive">
                <span>Faction Directive</span>
                <b>{brief.worldArcDirective.status} / {brief.worldArcDirective.operationLabel}</b>
                <small>{brief.worldArcDirective.progressLabel}</small>
              </div>
            )}
            {brief.worldPressureCascade && (
              <div className={`situationPressure ${brief.worldPressureCascade.status}`} data-testid="situation-world-pressure">
                <span>World Pressure</span>
                <b>{brief.worldPressureCascade.status} / {brief.worldPressureCascade.directionLabel}</b>
                <small>{brief.worldPressureCascade.focusLabel} · {brief.worldPressureCascade.remainingLayers} layer(s)</small>
              </div>
            )}
            {brief.worldInfluenceBudget && (
              <div className={`situationInfluenceBudget ${brief.worldInfluenceBudget.status}`} data-testid="situation-influence-budget">
                <span>Influence Budget</span>
                <b>{brief.worldInfluenceBudget.strengthLabel} / ±{brief.worldInfluenceBudget.maximumAbsoluteBonus} cap</b>
                <small>{brief.worldInfluenceBudget.sourceCount} source(s) · {brief.worldInfluenceBudget.directionLabel}</small>
              </div>
            )}
            <div className="situationList">
              {brief.hotLocations.slice(0, 2).map((location) => (
                <button key={location.locationId} type="button" onClick={() => { onLocationSelect(location.locationId); setActiveSection("map"); }}>
                  <strong>{location.name}</strong><span>heat {location.heat} / security {location.security}</span>
                </button>
              ))}
              {brief.riskAgents.slice(0, 2).map((agent) => {
                const actor = snapshot?.actors.find((item) => item.id === agent.npcId);
                return <button key={agent.npcId} type="button" onClick={() => { if (actor) onActorSelect(actor); setActiveSection("actions"); }}>
                  <strong>{agent.name}</strong><span>risk {agent.score} / suspicion {agent.suspicion}</span>
                </button>;
              })}
            </div>
          </>}
        </section>
        <section className="commandPanel commandSceneInfo" data-testid="command-scene-info">
          <h2>场景信息</h2>
          <span>地区：{selectedLocationName}</span>
          <span>地点热度：{selectedLocationProfile ? Math.round(selectedLocationProfile.heat) : 0}</span>
          <span>安保/资源：{selectedLocationProfile ? `${Math.round(selectedLocationProfile.security)} / ${Math.round(selectedLocationProfile.resourcePressure)}` : "0 / 0"}</span>
          <span>快照：{snapshots.length}</span>
          <span>可调查点：{snapshot?.markers.length ?? 0}</span>
          <span>Benchmark：{benchmarkSummary ? `${benchmarkSummary.passRate}%` : "未生成"}</span>
        </section>
      </aside>

      <section className={`commandMapPanel ${activeSection === "map" ? "commandFocus" : ""}`} data-testid="command-center-map">
        <div className="commandPanelTitle">
          <h2>小镇地图（黄昏）</h2>
          <div className="commandMapTools">
            <button type="button" className={mapFilters.npc ? "active" : ""} onClick={() => setMapFilters((current) => ({ ...current, npc: !current.npc }))}>NPC</button>
            <button type="button" className={mapFilters.evidence ? "active" : ""} onClick={() => setMapFilters((current) => ({ ...current, evidence: !current.evidence }))}>线索点</button>
            <button type="button" className={mapFilters.event ? "active" : ""} onClick={() => setMapFilters((current) => ({ ...current, event: !current.event }))}>事件</button>
            <button type="button" onClick={() => setMapZoom((value) => Math.max(0.8, Number((value - 0.15).toFixed(2))))}>缩小</button>
            <button type="button" onClick={() => setMapZoom((value) => Math.min(1.8, Number((value + 0.15).toFixed(2))))}>放大</button>
            <button type="button" onClick={() => { setMapZoom(1); setMapPan({ x: 0, y: 0 }); }}>重置视角</button>
          </div>
        </div>
        <div className="commandMapArt" onPointerDown={beginMapDrag} onPointerMove={moveMapDrag} onPointerUp={endMapDrag} onPointerCancel={endMapDrag}>
          <div className="commandMapLayer" style={{ transform: `translate(${mapPan.x}px, ${mapPan.y}px) scale(${mapZoom})` }}>
          <img src="/command-center/town-map.webp" alt="黄昏侦探小镇地图" />
          {(snapshot?.tiles || []).filter((tile) => tile.locationId && tile.locationName).map((tile) => (
            <button
              key={tile.id}
              type="button"
              className="commandLocationTag"
              style={{ left: `${(tile.x / maxX) * 100}%`, top: `${(tile.y / maxY) * 100}%` }}
              onClick={() => tile.locationId && onLocationSelect(tile.locationId)}
            >
              {tile.locationName}
            </button>
          ))}
          {visibleMarkers.slice(0, 18).map((marker) => (
            <button
              key={marker.id}
              type="button"
              className={`commandMarker marker-${marker.type}`}
              title={marker.label}
              style={{ left: `${(marker.x / maxX) * 100}%`, top: `${(marker.y / maxY) * 100}%` }}
              onClick={() => onLocationSelect(marker.locationId)}
            >
              {marker.type === "crime" ? "!" : marker.type === "evidence" ? "?" : "+"}
            </button>
          ))}
          {mapFilters.npc && (snapshot?.actors || []).map((actor) => (
            <button
              key={actor.id}
              type="button"
              className={`commandActorPin ${actor.id === selectedCharacterId ? "selected" : ""} actor-${actor.status}`}
              style={{ left: `${(actor.x / maxX) * 100}%`, top: `${(actor.y / maxY) * 100}%` }}
              onClick={() => onActorSelect(actor)}
              title={`${actor.name} / ${actor.role}`}
            >
              <img src={`/command-center/avatar-${Math.abs(Array.from(actor.id).reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 8}.webp`} alt="" />
            </button>
          ))}
          </div>
        </div>
      </section>

      <section className={`commandSceneFeed commandPanel ${activeSection === "actions" ? "commandFocus" : ""}`} data-testid="command-scene-feed">
        <div className="panelHeaderLine">
          <h2>场景推理（最新 6 条）</h2>
          <select value={traceKindFilter} onChange={(event) => setTraceKindFilter(event.target.value)} aria-label="行动类型筛选">
            <option value="all">全部行动</option>
            {traceKinds.map((kind) => <option key={kind} value={kind}>{actionLabels[kind] || kind}</option>)}
          </select>
        </div>
        {filteredTraces.map((trace) => {
          const selected = trace.candidates.find((candidate) => candidate.id === trace.selectedCandidateId);
          return (
            <button key={trace.id} type="button" className={`commandTraceRow ${trace.id === activeTrace?.id ? "selected" : ""}`} onClick={() => focusTrace(trace)}>
              <time>{trace.time}<small>Tick {trace.tick}</small></time>
              <div>
                <strong>{actionLabels[selected?.kind || ""] || selected?.kind || "行动"}</strong>
                <span>{describeAction(selected)}</span>
                {trace.consequence?.chainStage && <em>{stageLabels[trace.consequence.chainStage] || trace.consequence.chainStage}</em>}
                {trace.consequence?.triggeredCaseId && <em>真实案件已触发</em>}
              </div>
              <small>{trace.npcId}</small>
            </button>
          );
        })}
        {!filteredTraces.length && <p>启动或单步运行后，NPC 行动会写入这里。</p>}
      </section>

      <aside className="commandRightRail">
        <section className="commandPanel commandNpcPanel" data-testid="command-npc-dossier">
          <div className="panelHeaderLine"><h2>选中 NPC：{actorName}</h2><span>★</span></div>
          <div className="commandNpcHero">
            {actorPortrait ? <img src={actorPortrait.src} alt="" /> : <Users size={48} aria-hidden="true" />}
            <div>
              <label>关系压力 <b>{selectedAgent?.relationshipPressure ?? 0}/100</b><meter value={selectedAgent?.relationshipPressure ?? 0} min={0} max={100} /></label>
              <label>秘密风险 <b>{selectedAgent?.secretRisk ?? 0}/100</b><meter value={selectedAgent?.secretRisk ?? 0} min={0} max={100} /></label>
              <label>疲劳 <b>{selectedAgent?.fatigue ?? 0}/100</b><meter value={selectedAgent?.fatigue ?? 0} min={0} max={100} /></label>
              <label>警觉 <b>{selectedAgent?.alertness ?? 0}/100</b><meter value={selectedAgent?.alertness ?? 0} min={0} max={100} /></label>
            </div>
          </div>
          <div className="commandPlanFacts">
            <div><h3>当前计划</h3>{(selectedAgent?.currentPlan || ["选择地图上的 NPC"]).slice(0, 5).map((item, index) => <span key={`${item}:${index}`}>{index + 1}. {translatePlan(item)}</span>)}</div>
            <div><h3>已知事实</h3>{(selectedAgent?.knownFactIds || []).slice(-6).map((item) => <span key={item}>{item}</span>) || <span>暂无</span>}</div>
          </div>
          <div className="commandPlanFacts">
            <div><h3>观察来源</h3><span>直接 {selectedObservationStats.direct}</span><span>同地 {selectedObservationStats.sameLocation}</span><span>推断 {selectedObservationStats.deduced}</span></div>
            <div><h3>传闻 / 排除</h3><span>传闻 {selectedObservationStats.rumor}</span><span>排除 {selectedObservationStats.exclusion}</span><span>支撑 {selectedAgent?.propagatedMemoryCount ?? 0}</span></div>
          </div>
          <div className="commandPlanFacts">
            <div><h3>社会画像</h3><span>主导 {selectedSocial?.dominantTrait || "未知"}</span><span>声誉 {selectedSocial?.reputation ?? 0}</span><span>怀疑 {selectedSocial?.suspicion ?? 0}</span></div>
            <div><h3>信任 / 传闻</h3><span>可信度 {selectedSocial?.rumorCredibility ?? 0}%</span><span>信任对象 {selectedSocial?.trustedNpcIds?.length ?? 0}</span><span>{selectedSocial?.trustedNpcIds?.slice(0, 2).join(", ") || "暂无"}</span></div>
          </div>
          <article className="commandConsequence">
            <strong>最近后果</strong>
            <span>{translateRuleText(selectedAgent?.lastConsequence || recentConsequences[0]?.actionKind || "等待行动")}</span>
          </article>
        </section>

        <section className={`commandPanel commandActions ${activeSection === "actions" ? "commandFocus" : ""}`} data-testid="command-action-choices">
          <div className="panelHeaderLine"><h2>行动选择</h2><span>{biasStatus || "评分依据：目标匹配 / 风险 / 预期后果"}</span></div>
          {displayedActionCandidates.map((candidate) => (
            <article key={candidate.id} className={candidate.legal ? "legal" : "blocked"}>
              <strong>{actionLabels[candidate.kind] || candidate.kind}<small>{candidate.kind}</small></strong>
              <div className="commandScoreGrid">
                <span>评分 <b>{candidate.score.total}</b></span>
                <span>风险 <b>{(candidate.score.risk || 0) > 10 ? "高" : "低"}</b></span>
                <span>偏置 <b>{candidate.score.directorBias || 0}</b></span>
                <span>社会倾向 <b>{candidate.score.socialAffinity ?? 0}</b></span>
                <span>地点热度 <b>{candidate.score.locationHeat ?? 0}</b></span>
                <span>案件影响 <b>{candidate.score.caseImpact}</b></span>
              </div>
              <small>{candidate.score.reasons.slice(0, 3).map(translateRuleText).join(" / ") || translateRuleText(candidate.blockedReason)}</small>
              <button type="button" onClick={() => applyActionBias(candidate)} disabled={runningBusy || !selectedAgent || !candidate.legal}>偏置下一 Tick</button>
            </article>
          ))}
          <button type="button" onClick={() => interveneAgent()} disabled={runningBusy || !selectedAgent}>施加资源干预</button>
        </section>
      </aside>

      <section className={`commandCandidateBoard commandPanel ${activeSection === "queue" ? "commandFocus" : ""}`} data-testid="command-candidate-board">
        <div className="panelHeaderLine"><h2>案件候选板（{candidates.length} 条候选链）</h2><span>{queue?.validCount ?? 0} 可抽取</span></div>
        <div className="commandCandidateGrid">
          {candidates.slice(0, 4).map((candidate, index) => (
            <article key={candidate.id} className={candidate.validation.valid ? "valid" : "blocked"}>
              <strong>{index + 1}. {candidate.culpritId} → {candidate.victimId}</strong>
              <span>压力 {candidate.pressureScore} / 成熟度 {candidate.maturityScore ?? (candidate.validation.valid ? 100 : 61)}%</span>
              {candidate.triggeredEventId && <em>真实案件已触发：{candidate.triggeredEventId}</em>}
              {candidate.validation.valid && candidate.triggeredEventId && (
                <small className="fairCaseStatus">
                  可玩公平案：证据链 {candidate.riskChainEventIds.length} / 记忆 {candidate.memoryIds.length} / 六阶段完整
                </small>
              )}
              <div className="commandStageGems">
                {(["motive", "means", "opportunity", "cover-up", "memory", "exclusion"] as CaseChainStage[]).map((stage) => (
                  <b key={stage} className={(candidate.chainCompleteness?.[stage] || candidate.validation.chainCompleteness?.[stage] || (candidate.chainStageTags || candidate.validation.chainStages || []).includes(stage)) ? "on" : ""}>{stageLabels[stage]}</b>
                ))}
              </div>
              <small>记忆可信度 {candidate.validation.memoryConfidence?.supportScore ?? 0}% / 观察支撑 {candidate.validation.observationSupport?.supportScore ?? 0}% / 触发链 {candidate.riskChainEventIds.length} 事件</small>
              <small>{candidate.validation.failureReasons?.[0] ? translateRuleText(candidate.validation.failureReasons[0]) : (candidate.validation.valid ? "可抽取案件" : "仍阻塞")}</small>
              <CandidatePlayabilityPreview candidate={candidate} />
              <button type="button" onClick={() => extractCase(candidate)}>抽取可玩案件</button>
            </article>
          ))}
        </div>
      </section>

      <section className={`commandMemoryPanel commandPanel ${activeSection === "memory" ? "commandFocus" : ""}`} data-testid="command-memory-propagation">
        <div className="panelHeaderLine"><h2>记忆传播</h2><span>{memoryPropagations.length} 条最近传播</span></div>
        <div className="commandMemoryList">
          {memoryPropagations.map((item) => (
            <button key={item.id} type="button" onClick={() => setActiveSection("memory")}>
              <strong>{item.kind}</strong>
              <span>{item.fromNpcId || "目击"} → {item.toNpcId}</span>
              <small>{item.source} / Tick {item.tick} / 置信度 {Math.round(item.confidence * 100)}% / {item.eventId}</small>
            </button>
          ))}
          {!memoryPropagations.length && <p>运行后，目击与传闻会在这里形成传播路径。</p>}
        </div>
      </section>

      <section className={`commandTimeMachine commandPanel ${activeSection === "time" ? "commandFocus" : ""}`} data-testid="command-time-machine">
        <div className="panelHeaderLine"><h2>时间机器</h2><span>{snapshots.length} 快照</span></div>
        <label>起点<select value={selectedSnapshotFromId} onChange={(event) => setSelectedSnapshotFromId(event.target.value)}>{snapshots.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>终点<select value={selectedSnapshotToId} onChange={(event) => setSelectedSnapshotToId(event.target.value)}>{snapshots.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <div className="commandSplit">
          <button type="button" onClick={chooseBaselineDiff} disabled={!scenarioReport}>选择基线</button>
          <button type="button" onClick={confirmRollback} disabled={!selectedSnapshotFromId}>回滚到起点</button>
        </div>
        <div className="commandDiffStats">
          <span>事件 +{snapshotDiff?.addedEventIds.length ?? 0}</span>
          <span>记忆 +{snapshotDiff?.addedMemoryIds.length ?? 0}</span>
          <span>观察 +{snapshotDiff?.addedObservationIds?.length ?? 0}</span>
          <span>NPC 变化 {snapshotDiff?.changedAgents.length ?? 0}</span>
          <span>地点变化 {snapshotDiff?.changedLocations?.length ?? 0}</span>
        </div>
        {branchSummary && (
          <article className="commandBranchSummary">
            <strong>{branchSummary.name}</strong>
            <span>事件 +{branchSummary.eventGrowth} / 记忆 +{branchSummary.memoryGrowth} / 有效候选 {branchSummary.validCandidateCount}</span>
          </article>
        )}
        <div className="commandSnapshotTimeline">
          {snapshots.slice(0, 8).map((item) => (
            <button key={item.id} type="button" className={item.id === selectedSnapshotFromId || item.id === selectedSnapshotToId ? "active" : ""} onClick={() => setSelectedSnapshotToId(item.id)}>
              <strong>{item.label}</strong>
              <small>Tick {item.tick} / {item.time} / 候选 {item.candidateSummaries.length}</small>
            </button>
          ))}
        </div>
        <div className="commandDiffDetail">
          <span>新增事件：{snapshotDiff?.addedEventIds.slice(0, 3).join(", ") || "无"}</span>
          <span>新增记忆：{snapshotDiff?.addedMemoryIds.slice(0, 3).join(", ") || "无"}</span>
          <span>分支干预：{snapshotDiff?.branchOnlyInterventionIds.slice(0, 3).join(", ") || "无"}</span>
        </div>
      </section>

      <section className="commandBenchmark commandPanel" data-testid="command-benchmark">
        <div className="panelHeaderLine"><h2>基准仪表盘</h2><span className={`runtimePill ${benchmarkState}`}>{benchmarkSummary ? `${benchmarkSummary.passRate}%` : "未生成"}</span></div>
        <span>Seeds {benchmarkSummary?.seedCount ?? 0}</span>
        <span>Quality {benchmarkSummary?.averageQualityScore ?? 0}</span>
        <span>Emergence {benchmarkSummary?.averageEmergenceScore ?? 0}</span>
        <span>Route {benchmarkSummary?.routeCertifiedRate ?? 0}%</span>
        <span>AutoSolve {benchmarkSummary?.autoSolvePassRate ?? 0}%</span>
        <span>Steps {benchmarkSummary?.averageAutoSolveSteps ?? 0}</span>
        <BenchmarkSeedTable report={benchmarkSummary || null} busy={reviewBusy} onRunBenchmark={runBenchmark} />
      </section>
    </main>
  );
}
