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
import type { StrategicCommandAction, StrategicCommandViewModel } from "@/app/campaign/strategic-command-model";
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
export function PlayShell({
  commandDeck,
  control,
  map,
  inspector,
  overlay,
  toasts,
  blockingOverlayActive,
  toastVisible,
  onContextAction,
  onStrategicAction,
  onStrategicFrontFocus
}: {
  commandDeck?: StrategicCommandViewModel;
  control: ReactNode;
  map: ReactNode;
  inspector: ReactNode;
  overlay?: ReactNode;
  toasts?: ReactNode;
  blockingOverlayActive?: boolean;
  toastVisible?: boolean;
  onContextAction?: (kind: SafeContextActionKind) => void | Promise<void>;
  onStrategicAction?: (action: StrategicCommandAction) => void | Promise<void>;
  onStrategicFrontFocus?: (locationName: string) => void;
}) {
  if (commandDeck) {
    return <CommandDeckShell viewModel={commandDeck} control={control} map={map} inspector={inspector} overlay={overlay} toasts={toasts} blockingOverlayActive={blockingOverlayActive} toastVisible={toastVisible} onContextAction={onContextAction} onStrategicAction={onStrategicAction} onStrategicFrontFocus={onStrategicFrontFocus} />;
  }
  return (
    <main className="townShell">
      {control}
      {map}
      {inspector}
      {overlay}
      {toasts}
    </main>
  );
}

export function ToastStack({ toasts, onDismiss }: { toasts: InvestigationToast[]; onDismiss: (id: string) => void }) {
  if (!toasts.length) return null;
  return (
    <section className="toastStack" data-testid="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <button key={toast.id} type="button" className={`investigationToast ${toast.tone}`} onClick={() => onDismiss(toast.id)}>
          <strong>{toast.title}</strong>
          <span>{toast.detail}</span>
        </button>
      ))}
    </section>
  );
}

export function InvestigationStageBar({ stages }: { stages: InvestigationStage[] }) {
  return (
    <nav className="stageProgressBar" data-testid="investigation-stage-bar" aria-label="调查阶段">
      {stages.map((stage, index) => (
        <span key={stage.id} className={`${stage.complete ? "complete" : ""} ${stage.current ? "current" : ""}`} title={stage.detail}>
          <b>{stage.complete ? "✓" : index + 1}</b>
          {stage.label}
        </span>
      ))}
    </nav>
  );
}

export function ControlRail({
  runtimeMode,
  seedInput,
  setSeedInput,
  caseMode,
  setCaseMode,
  caseTemplateId,
  switchCaseTemplate,
  caseTemplates,
  caseArchetype,
  setCaseArchetype,
  archetypeOptions,
  mode,
  setMode,
  busy,
  createWorld,
  worldIdInput,
  setWorldIdInput,
  loadWorld,
  playerName,
  setPlayerName,
  joinCase,
  tickWorld,
  worldName,
  caseTitle,
  caseSubtitle,
  progress,
  metrics,
  status,
  suggestedAction,
  onSuggestedAction,
  guidedTasks,
  onGuidedTaskSelect,
  reopenOnboarding,
  openCampaignFrontDoor,
  openAuthoring,
  openWorldGraph,
  openPersistentTown,
  switchRuntime
}: {
  runtimeMode: RuntimeMode;
  seedInput: string;
  setSeedInput: (value: string) => void;
  caseMode: CaseMode;
  setCaseMode: (value: CaseMode) => void;
  caseTemplateId: CaseTemplateId;
  switchCaseTemplate: (value: CaseTemplateId) => void;
  caseTemplates: CaseTemplateOption[];
  caseArchetype: MurderArchetype | "auto";
  setCaseArchetype: (value: MurderArchetype | "auto") => void;
  archetypeOptions: { value: MurderArchetype | "auto"; label: string }[];
  mode: WorldMode;
  setMode: (value: WorldMode) => void;
  busy: boolean;
  createWorld: () => void;
  worldIdInput: string;
  setWorldIdInput: (value: string) => void;
  loadWorld: () => void;
  playerName: string;
  setPlayerName: (value: string) => void;
  joinCase: () => void;
  tickWorld: () => void;
  worldName: string;
  caseTitle: string;
  caseSubtitle: string;
  progress: InvestigationProgress;
  metrics: { quality: number; unique: boolean; logic: number; misdirect: number; evidence: string; aiEval: string };
  status: string;
  suggestedAction: SuggestedAction;
  onSuggestedAction: () => void;
  guidedTasks: GuidedTask[];
  onGuidedTaskSelect: (task: GuidedTask) => void;
  reopenOnboarding: () => void;
  openCampaignFrontDoor: () => void;
  openAuthoring: () => void;
  openWorldGraph: () => void;
  openPersistentTown: () => void;
  switchRuntime: (value: RuntimeMode) => void;
}) {
  const steps: [string, boolean][] = [
    ["观察案发", progress.observedCrimeWindow],
    ["加入调查", progress.joinedInvestigation],
    ["发现证据", progress.discoveredEvidence],
    ["质询证词", progress.challengedTestimony],
    ["提交推理", progress.submittedTheory],
    ["破解案件", progress.solvedCase]
  ];
  const activeTemplate = caseTemplates.find((item) => item.id === caseTemplateId);

  return (
    <aside className="controlRail">
      <div className="brandBlock">
        <div className="brandIcon"><MapIcon size={24} /></div>
        <div>
          <p>Detective Town</p>
          <h1>推理小镇</h1>
        </div>
      </div>

      <div className="modeSwitch">
        <button className="active">Play</button>
        <button data-testid="open-campaign-front-door" onClick={openCampaignFrontDoor}><BookOpen size={14} /> Campaigns</button>
        <button data-testid="open-authoring" onClick={openAuthoring}>Authoring</button>
        <button data-testid="open-world-graph" onClick={openWorldGraph}><Network size={14} /> Living World Lab</button>
        <button data-testid="open-persistent-town" onClick={openPersistentTown}><Clock size={14} /> 持续小镇</button>
      </div>

      <section className="hudPanel currentCasePanel">
        <div className="panelHeaderLine">
          <span className="eyebrow">{worldName}</span>
          <BookOpen size={15} />
        </div>
        <h2>{caseTitle}</h2>
        <p>{caseSubtitle}</p>
        <div className="templateChip">{activeTemplate?.title || caseTemplateId}</div>
      </section>

      <section className="hudPanel nextActionPanel" data-testid="suggested-action">
        <span className="eyebrow">当前建议行动 / {suggestedAction.phase}</span>
        <h2>{suggestedAction.title}</h2>
        <p>{suggestedAction.detail}</p>
        <button className="secondaryButton full" onClick={onSuggestedAction}>前往处理</button>
      </section>

      <section className="hudPanel guidedTaskPanel" data-testid="guided-task-list">
        <div className="panelHeaderLine">
          <span className="eyebrow">First Case Guide</span>
          <button className="linkButton" type="button" onClick={reopenOnboarding}><HelpCircle size={14} /> 帮助</button>
        </div>
        <div className="guidedTaskList">
          {guidedTasks.map((task, index) => (
            <button key={task.id} type="button" className={`guidedTask ${task.state}`} onClick={() => onGuidedTaskSelect(task)}>
              <span>{task.state === "complete" ? "✓" : index + 1}</span>
              <strong>{task.title}</strong>
              <small>{task.detail}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="progressPanel" data-testid="investigation-progress">
        {steps.map(([label, done], index) => (
          <div className={done ? "done" : ""} key={label}>
            <span>{done ? "✓" : index + 1}</span><strong>{label}</strong>
          </div>
        ))}
      </section>

      <section className="hudPanel">
        <h2>调查员</h2>
        <label>玩家名<input value={playerName} onChange={(event) => setPlayerName(event.target.value)} /></label>
        <button className="secondaryButton full" onClick={joinCase} disabled={busy}><Users size={16} /> 加入调查</button>
        <button className="secondaryButton full" onClick={tickWorld} disabled={busy || runtimeMode === "static-demo"}><Clock size={16} /> 推进小镇</button>
      </section>

      <section className="metricGrid metricsPanel">
        <div><strong>{metrics.quality}</strong><small>Quality</small></div>
        <div><strong>{metrics.unique ? "Yes" : "No"}</strong><small>Unique</small></div>
        <div><strong>{metrics.logic}</strong><small>Logic</small></div>
        <div><strong>{metrics.misdirect}</strong><small>Misdirect</small></div>
        <div><strong>{metrics.evidence}</strong><small>Evidence</small></div>
        <div><strong>{metrics.aiEval}</strong><small>AI Eval</small></div>
      </section>

      <details className="settingsDrawer hudPanel">
        <summary>世界设置 <ChevronDown size={15} /></summary>
        <label>Runtime
          <select data-testid="runtime-mode" value={runtimeMode} onChange={(event) => switchRuntime(event.target.value as RuntimeMode)}>
            <option value="static-demo">Static Demo</option>
            <option value="server">Server / DeepSeek</option>
          </select>
        </label>
        <label>Seed<input value={seedInput} onChange={(event) => setSeedInput(event.target.value)} /></label>
        <label>Case Mode
          <select value={caseMode} onChange={(event) => setCaseMode(event.target.value as CaseMode)} disabled={mode === "advanced"}>
            <option value="premium">Premium hard case</option>
            <option value="generated">Generated case</option>
          </select>
        </label>
        <label>Case Library
          <select data-testid="case-template-select" value={caseTemplateId} onChange={(event) => switchCaseTemplate(event.target.value as CaseTemplateId)} disabled={mode === "advanced" || caseMode !== "premium"}>
            {caseTemplates.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
        {activeTemplate && (
          <div className="caseLibraryMeta" data-testid="case-library-meta">
            <span>{caseTemplates.length} premium templates</span>
            <span>{activeTemplate.archetype} case</span>
            <small>{activeTemplate.description}</small>
          </div>
        )}
        <label>案件类型
          <select value={caseArchetype} onChange={(event) => setCaseArchetype(event.target.value as MurderArchetype | "auto")}>
            {archetypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label>模式
          <select value={mode} onChange={(event) => setMode(event.target.value as WorldMode)}>
            <option value="showcase">Showcase：8 NPC / 24h</option>
            <option value="advanced">Advanced：30 NPC / 多日</option>
          </select>
        </label>
        <button className="primaryButton full" onClick={createWorld} disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />} Reset / Create Town</button>
        <div className="inputLine" hidden={runtimeMode === "static-demo"}>
          <input value={worldIdInput} onChange={(event) => setWorldIdInput(event.target.value)} placeholder="world id" />
          <button className="iconButton" onClick={loadWorld} disabled={busy}><Search size={16} /></button>
        </div>
      </details>

      <div className="statusBox" data-testid="status-line"><AlertTriangle size={16} /><span>{status}</span></div>
    </aside>
  );
}
