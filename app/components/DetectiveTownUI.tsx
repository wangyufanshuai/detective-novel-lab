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
import type { CampaignCommandDeckViewModel } from "@/app/campaign/command-deck-model";
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

const markerGlyph: Record<string, string> = {
  crime: "!",
  evidence: "◆",
  contradiction: "!",
  event: "•",
  highlight: "?"
};

function firstGlyph(name: string) {
  return Array.from(name)[0] || "?";
}

function locationIcon(tile: WorldMapTile) {
  const name = tile.locationName || "";
  if (tile.terrain === "water") return "≈";
  if (tile.terrain === "road") return "·";
  if (name.includes("档案")) return "档";
  if (name.includes("钟")) return "钟";
  if (name.includes("诊")) return "医";
  if (name.includes("旅店")) return "宿";
  if (name.includes("剧院")) return "剧";
  if (name.includes("市场")) return "市";
  if (name.includes("广场")) return "场";
  if (name.includes("码头")) return "港";
  if (tile.locationId) return "屋";
  return "";
}

export function InspectorRail({
  activeTab,
  setActiveTab,
  tabs,
  summary
}: {
  activeTab: InspectorTabId;
  setActiveTab: (value: InspectorTabId) => void;
  tabs: { id: InspectorTabId; label: string; content: ReactNode }[];
  summary: { title: string; detail: string; tone?: string };
}) {
  const current = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  return (
    <aside className="inspectorRail" data-testid="inspector-rail">
      <nav className="inspectorTabs" aria-label="Inspector">
        {tabs.map((tab) => (
          <button key={tab.id} className={tab.id === current.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
        ))}
      </nav>
      <section className={`inspectorSummary ${summary.tone || ""}`} data-testid="inspector-summary">
        <strong>{summary.title}</strong>
        <span>{summary.detail}</span>
      </section>
      <div className="inspectorContent">{current.content}</div>
    </aside>
  );
}

export function EventLogPanel({ events, highlightedEventId, onSelect }: { events: WorldEvent[]; highlightedEventId: string; onSelect: (event: WorldEvent) => void }) {
  const primaryEvents = events.slice(0, 5);
  const moreEvents = events.slice(5);
  return (
    <section className="eventPanel">
      <h2><Clock size={16} /> WorldEvent Log</h2>
      <div className="eventList">
        {primaryEvents.map((event) => (
          <button key={event.id} className={`eventRow ${event.id === highlightedEventId ? "selected" : ""}`} onClick={() => onSelect(event)}>
            <time>第{event.day}日 {event.time}</time>
            <strong>{event.publicSummary}</strong>
            <span>{event.type} / {event.locationId}</span>
          </button>
        ))}
        {!!moreEvents.length && (
          <details className="eventMore">
            <summary>查看其余 {moreEvents.length} 条事件</summary>
            {moreEvents.map((event) => (
              <button key={event.id} className={`eventRow ${event.id === highlightedEventId ? "selected" : ""}`} onClick={() => onSelect(event)}>
                <time>第{event.day}日 {event.time}</time>
                <strong>{event.publicSummary}</strong>
                <span>{event.type} / {event.locationId}</span>
              </button>
            ))}
          </details>
        )}
      </div>
    </section>
  );
}

export function CaseLogicPanel({
  accepted,
  summary,
  logicReport,
  emergenceScore,
  causalComplete,
  proofLedger,
  proofCoverage,
  routeCertificate,
  graph,
  selectedGraphExplanation,
  solutionChain,
  revealText
}: {
  accepted: boolean;
  summary?: string;
  logicReport: CaseLogicReport | null;
  emergenceScore: number;
  causalComplete: boolean;
  proofLedger?: CaseTruthLedger | null;
  proofCoverage?: CaseProofCoverage | null;
  routeCertificate?: CaseRouteCertificate | null;
  graph: ReactNode;
  selectedGraphExplanation?: GraphNodeExplanation | null;
  solutionChain: string[];
  revealText?: string;
}) {
  return (
    <div className="stackedInspector">
      <section className="actionPanel logicPanel">
        <h2><ShieldCheck size={16} /> Case Logic Report</h2>
        <p>{accepted ? summary : "本案已通过本地公平推理校验。最终结论只会在玩家提交正确证据链后展示。"}</p>
        <div className="logicBadges">
          <span>Graph: {logicReport?.deductionGraphComplete ? "Pass" : "Pending"}</span>
          <span>Unique: {logicReport?.uniqueCulprit ? "Yes" : "No"}</span>
          <span>Fair: {logicReport?.fairPlay ? "Yes" : "No"}</span>
          <span>Excluded: {logicReport?.allNonCulpritsExplainablyExcluded ? "Yes" : "No"}</span>
          <span>Emergence: {emergenceScore}</span>
          <span>Causal: {causalComplete ? "Pass" : "Pending"}</span>
        </div>
      </section>
      {proofLedger && proofCoverage && (
        <section className="actionPanel proofLedgerPanel" data-testid="proof-ledger">
          <div className="panelHeaderLine">
            <h2><ListTree size={16} /> Proof Ledger</h2>
            <span className={`runtimePill ${proofCoverage.complete ? "ready" : "investigating"}`}>
              {proofCoverage.coveredRequired}/{proofCoverage.totalRequired}
            </span>
          </div>
          <p>
            {accepted
              ? "Solved: full evidence, source events, and proof obligations are unlocked."
              : "Low-spoiler proof obligations are visible. Evidence names, source events, and conclusion links unlock after a correct theory."}
          </p>
          <div className="logicBadges">
            <span>Ledger: {proofLedger.valid ? "Pass" : "Gap"}</span>
            <span>Coverage: {Math.round(proofCoverage.coverageRatio * 100)}%</span>
            <span>Gaps: {proofCoverage.gaps.length}</span>
            <span>Required clues: {proofLedger.requiredEvidenceIds.length}</span>
            {routeCertificate && <span>Route: {routeCertificate.routeCertified ? "Certified" : "Blocked"}</span>}
          </div>
          {routeCertificate && (
            <div className="routeCertificateSummary" data-testid="route-certificate-summary">
              <span>{routeCertificate.routeCertified ? "Route certified" : "Route blocked"}</span>
              <small>
                {routeCertificate.routeStepCount} steps / {routeCertificate.coveredRequiredObligations}/{routeCertificate.totalRequiredObligations} obligations / {routeCertificate.blockers.length} blockers
              </small>
            </div>
          )}
          <div className="proofLedgerGrid">
            {proofLedger.obligations.slice(0, accepted ? 24 : 12).map((item) => {
              const covered = proofCoverage.coveredObligationIds.includes(item.id);
              const blocked = proofCoverage.missingObligationIds.includes(item.id) || proofLedger.gaps.some((gap) => gap.obligationId === item.id);
              return (
                <article key={item.id} className={`${covered ? "complete" : ""} ${blocked ? "locked" : ""}`}>
                  <span>{covered ? "Covered" : blocked ? "Gap" : "Open"} / {item.kind}</span>
                  <b>{accepted ? item.label : item.lowSpoilerLabel}</b>
                  <small>{accepted ? item.detail : item.lowSpoilerDetail}</small>
                  {accepted && (
                    <em>{[...item.evidenceIds.slice(0, 3), ...item.eventIds.slice(0, 2), ...item.memoryIds.slice(0, 1)].join(" / ") || "structure-only"}</em>
                  )}
                </article>
              );
            })}
          </div>
          {accepted && routeCertificate && (
            <div className="proofLedgerGrid routeCertificateSteps" data-testid="route-certificate-steps">
              {routeCertificate.steps.slice(0, 16).map((step) => (
                <article key={step.id} className={step.complete ? "complete" : "locked"}>
                  <span>{step.complete ? "Complete" : "Blocked"} / {step.kind}</span>
                  <b>{step.label}</b>
                  <small>{step.detail}</small>
                  <em>{[...step.evidenceIds.slice(0, 2), ...step.characterIds.slice(0, 1), ...step.eventIds.slice(0, 1)].join(" / ") || "route step"}</em>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      <section className="actionPanel deductionGraphPanel">
        <h2><Database size={16} /> Deduction Graph</h2>
        {graph}
        {selectedGraphExplanation && (
          <article className={`explainCard ${selectedGraphExplanation.spoilerSafe ? "" : "locked"}`} data-testid="graph-explanation-card">
            <span className="eyebrow">{selectedGraphExplanation.status}</span>
            <h3>{selectedGraphExplanation.title}</h3>
            <p>{selectedGraphExplanation.body}</p>
            <small>{selectedGraphExplanation.source}</small>
            {!!selectedGraphExplanation.references.length && (
              <div className="evidenceRefs">
                {selectedGraphExplanation.references.map((item) => <span key={item}>{item}</span>)}
              </div>
            )}
          </article>
        )}
        {accepted && !!solutionChain.length && (
          <section className="solutionChain" data-testid="solution-chain">
            <h3>已发现证据如何推出结论</h3>
            {solutionChain.map((item, index) => (
              <article key={`${item}-${index}`}>
                <span>{index + 1}</span>
                <p>{item}</p>
              </article>
            ))}
          </section>
        )}
        {revealText && <pre className="revealBox">{revealText}</pre>}
      </section>
    </div>
  );
}

export function EmergenceProofPanel({ trace }: { trace: EmergenceProofTrace | null }) {
  if (!trace) return null;
  const proofNodes = trace.nodes.filter((node) => node.visible || node.locked);
  const requiredNodes = proofNodes.filter((node) => node.stage === "case-extraction" || node.stage === "validation");
  const visibleNodes = [...proofNodes.slice(0, trace.solved ? 22 : 16), ...requiredNodes].filter(
    (node, index, all) => all.findIndex((item) => item.id === node.id) === index
  );
  const metrics = [
    ["Event-backed", trace.evaluation.worldBackedEvidence],
    ["Memory-scoped", trace.evaluation.memoryScopedTestimony],
    ["Unique culprit", trace.evaluation.uniqueCulprit],
    ["Excluded", trace.evaluation.nonCulpritExcluded],
    ["Hard logic", trace.evaluation.hardLogicValid]
  ];
  return (
    <section className="actionPanel emergenceProofPanel" data-testid="emergence-proof">
      <h2><ShieldCheck size={16} /> Emergence Proof</h2>
      <p>World simulation proof: NPC goals, intents, events, memories, evidence, case extraction, and local validation.</p>
      <div className="proofMetricGrid" data-testid="emergence-proof-metrics">
        {metrics.map(([label, ok]) => (
          <span key={label as string} className={ok ? "pass" : "fail"}>
            <strong>{ok ? "Pass" : "Fail"}</strong>
            <small>{label}</small>
          </span>
        ))}
        <span className={trace.evaluation.proofComplete ? "pass" : "fail"}>
          <strong>{trace.evaluation.emergenceScore}</strong>
          <small>Emergence</small>
        </span>
      </div>
      <div className="proofTimeline">
        {visibleNodes.map((node) => (
          <article key={node.id} className={`${node.locked ? "locked" : ""} proofStage-${node.stage}`}>
            <span>{node.stage}</span>
            <strong>{node.label}</strong>
            <p>{node.detail}</p>
            <small>
              {[node.time, node.locationId, node.eventIds[0], node.memoryIds[0], node.evidenceIds[0]].filter(Boolean).join(" / ")}
            </small>
          </article>
        ))}
      </div>
      {!trace.solved && <div className="proofSpoilerNote">Hidden causal and culprit-specific nodes stay locked until the theory is accepted.</div>}
      {!!trace.evaluation.errors.length && (
        <details className="proofIssues">
          <summary>Validation issues</summary>
          {trace.evaluation.errors.slice(0, 6).map((error) => <p key={error}>{error}</p>)}
        </details>
      )}
    </section>
  );
}

export function CausalTracePanel({
  events,
  solved,
  discoveredEvidenceIds,
  onSelect,
  timeToMinutes
}: {
  events: WorldEvent[];
  solved: boolean;
  discoveredEvidenceIds: string[];
  onSelect: (event: WorldEvent, timeValue: number) => void;
  timeToMinutes: (time: string) => number;
}) {
  return (
    <section className="actionPanel causalTracePanel" data-testid="causal-trace">
      <h2><Clock size={16} /> Causal Trace</h2>
      <p>案件因果链：日程、秘密风险、手段准备、案发、伪装和反证。</p>
      <details className="causalDetails">
        <summary>展开因果链细节</summary>
        <div className="causalTraceRail">
          {events.map((event, index) => {
            const locked = event.hidden && !solved && !discoveredEvidenceIds.includes(event.evidenceId || "");
            return (
              <button key={event.id} className={locked ? "locked" : ""} onClick={() => onSelect(event, timeToMinutes(event.time))}>
                <time>{event.time}</time>
                <strong>{locked ? "未揭示的因果节点" : event.publicSummary}</strong>
                <span>{index + 1}. {event.explanation || event.tags.join(", ")}</span>
              </button>
            );
          })}
        </div>
      </details>
    </section>
  );
}

export function ProofTourPanel({
  steps,
  viewMode,
  setViewMode,
  onSelectStep
}: {
  steps: ProofTourStep[];
  viewMode: ProofViewMode;
  setViewMode: (value: ProofViewMode) => void;
  onSelectStep: (step: ProofTourStep) => void;
}) {
  const visibleSteps = viewMode === "developer" ? steps : steps.filter((step) => !step.locked || step.stage === "conclusion" || step.stage === "validation");
  return (
    <section className="actionPanel proofTourPanel" data-testid="proof-tour">
      <div className="panelHeaderLine">
        <h2><ShieldCheck size={16} /> Proof Tour</h2>
        <div className="segmentedControl">
          <button type="button" className={viewMode === "player" ? "active" : ""} onClick={() => setViewMode("player")}>玩家证明</button>
          <button type="button" className={viewMode === "developer" ? "active" : ""} onClick={() => setViewMode("developer")}>开发者证明</button>
        </div>
      </div>
      <p>按调查顺序查看：事件、记忆、证据、矛盾、排除链和最终结论。</p>
      <div className="proofTourRail">
        {visibleSteps.map((step, index) => (
          <button key={step.id} type="button" className={`proofTourStep ${step.stage} ${step.locked ? "locked" : ""} ${step.complete ? "complete" : ""}`} onClick={() => onSelectStep(step)}>
            <span>{step.locked ? "锁定" : `${index + 1}`}</span>
            <strong>{step.title}</strong>
            <small>{step.detail}</small>
            {!![step.time, step.locationId, step.evidenceIds[0], step.eventIds[0]].filter(Boolean).length && (
              <em>{[step.time, step.locationId, step.evidenceIds[0], step.eventIds[0]].filter(Boolean).join(" / ")}</em>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

export function SuspectBoardPanel({
  rows,
  solved,
  selectedSuspectId,
  explanations,
  onSelect
}: {
  rows: SuspectBoardRow[];
  solved: boolean;
  selectedSuspectId?: string;
  explanations: Map<string, SuspectExplanation>;
  onSelect: (characterId: string) => void;
}) {
  return (
    <section className="actionPanel suspectBoardPanel">
      <h2><Users size={16} /> Suspect Board</h2>
      <div className="suspectBoard">
        {rows.map((row) => {
          const explanation = explanations.get(row.characterId);
          return (
            <button
              key={row.characterId}
              className={`suspectRow ${row.status === "culprit" && !solved ? "unresolved" : row.status} ${selectedSuspectId === row.characterId ? "selected" : ""}`}
              onClick={() => onSelect(row.characterId)}
            >
              <strong>{row.name}</strong>
              <div className="mmoBars" aria-label="motive means opportunity">
                <span className={row.motive ? "on" : ""}>动机</span>
                <span className={row.means ? "on" : ""}>手段</span>
                <span className={row.opportunity ? "on" : ""}>机会</span>
              </div>
              <small>{explanation?.exclusionStatus || (row.status === "culprit" ? (solved ? "唯一完整链条" : "尚未排除") : "仍需排除证据")}</small>
            </button>
          );
        })}
      </div>
      {selectedSuspectId && explanations.get(selectedSuspectId) && (
        <article className="suspectExplainCard" data-testid="suspect-explanation-card">
          {(() => {
            const item = explanations.get(selectedSuspectId)!;
            return (
              <>
                <span className="eyebrow">{item.statusLabel}</span>
                <h3>{item.name} / {item.role}</h3>
                <p>{item.surfaceSuspicion}</p>
                <div className="mmoBars wide">
                  <span className={item.motive ? "on" : ""}>动机</span>
                  <span className={item.means ? "on" : ""}>手段</span>
                  <span className={item.opportunity ? "on" : ""}>机会</span>
                </div>
                <strong>{item.exclusionStatus}</strong>
                <div className="evidenceRefs">
                  {item.visibleEvidenceTitles.map((title) => <span key={title}>{title}</span>)}
                  {item.lockedEvidenceCount > 0 && <span className="lockedRef">{item.lockedEvidenceCount} 条排除证据仍未发现</span>}
                </div>
                {!!item.sourceEventLabels.length && <small>来源事件：{item.sourceEventLabels.join(" / ")}</small>}
              </>
            );
          })()}
        </article>
      )}
    </section>
  );
}

export function DeveloperPanel({
  worldId,
  caseId,
  sessionId,
  memoryCount,
  promptSafe,
  selectedName,
  copyAgentApiExample,
  agentApiExample
}: {
  worldId?: string;
  caseId?: string;
  sessionId?: string;
  memoryCount: number;
  promptSafe: boolean;
  selectedName?: string;
  copyAgentApiExample: () => void;
  agentApiExample: string;
}) {
  return (
    <section className="actionPanel developerPanel">
      <h2><Database size={16} /> Developer / Agent API</h2>
      <div className="caseMeta">
        <span>worldId: {worldId || "N/A"}</span>
        <span>caseId: {caseId || "N/A"}</span>
        <span>sessionId: {sessionId || "N/A"}</span>
        <span>NPC memories: {memoryCount}</span>
        <span>Prompt Safe: {promptSafe ? "Yes" : "No"}</span>
        <span>Selected: {selectedName || "N/A"}</span>
      </div>
      <button className="secondaryButton full" onClick={copyAgentApiExample}>Copy Agent API Example</button>
      <pre className="apiExample">{agentApiExample}</pre>
    </section>
  );
}

export function OnboardingOverlay({
  open,
  tasks,
  onSelectTask,
  onDismiss
}: {
  open: boolean;
  tasks: GuidedTask[];
  onSelectTask: (task: GuidedTask) => void;
  onDismiss: () => void;
}) {
  if (!open) return null;
  const current = tasks.find((task) => task.state === "current") || tasks[tasks.length - 1];
  return (
    <section className="onboardingOverlay" data-testid="onboarding-overlay" aria-label="First case onboarding">
      <div className="onboardingCard">
        <button className="iconButton closeButton" type="button" onClick={onDismiss} aria-label="关闭引导"><X size={16} /></button>
        <span className="eyebrow">任务提示</span>
        <h2>当前目标：{current.title}</h2>
        <p>{current.detail}</p>
        <div className="onboardingCurrent">
          <strong>{current.title}</strong>
          <span>点击任务会高亮地图或右侧面板中的目标区域。</span>
        </div>
        <div className="onboardingActions">
          <button className="primaryButton" type="button" onClick={() => onSelectTask(current)}>开始当前步骤</button>
          <button className="secondaryButton" type="button" onClick={onDismiss}>先自己探索</button>
        </div>
      </div>
    </section>
  );
}
