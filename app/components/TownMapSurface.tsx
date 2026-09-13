"use client";

import { NoirMapStage } from "./NoirMapStage";

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
import { memo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { BenchmarkSeedTable, CurrentExperimentPanel, DatasetPackagePanel, PublicReviewCatalogPanel, ReplayDatasetCatalogPanel, ReviewExportActions, RunCatalogPanel, ScenarioPackPanel, ScenarioPresetEditor, ScenarioRunHistory, WorldPackageCatalogPanel } from "@/app/components/ReviewModePanels";
import { TownRuleStatePanel } from "@/app/components/TownRuleStatePanel";
import { CommandDeckCollapsible, CommandDeckShell } from "@/app/components/CommandDeckShell";
import { InvestigationStageBar } from "@/app/components/TownControlSurface";
import { CandidatePlayabilityPreview } from "@/app/components/CandidatePlayabilityPreview";
import { CharacterEncounterCard } from "@/app/components/CharacterEncounterCard";
import { useInvestigationActionExecution } from "@/app/components/InvestigationActionExecution";
import type { InvestigationActionResult } from "@/app/campaign/investigation-action-result";
import type { CampaignCommandDeckViewModel } from "@/app/campaign/command-deck-model";
import type { CharacterEncounterViewModel } from "@/app/campaign/character-encounter-model";
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
import { useAppLocale } from "@/app/localization/locale-context";

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

export type TownMapStageProps = {
  caseFile: string;
  currentTime: string;
  stages: InvestigationStage[];
  snapshot: WorldMapSnapshot | null;
  actorsByTile: Map<string, WorldMapActor[]>;
  markersByTile: Map<string, WorldMapMarker[]>;
  hoverInfo?: LocationHoverInfo | null;
  characterEncounter?: CharacterEncounterViewModel | null;
  encountersByActorId: Map<string, CharacterEncounterViewModel>;
  selectedSceneId: string;
  highlightedEventId: string;
  selectedCharacterId?: string;
  selectionHighlight?: SelectionHighlight;
  interactiveTargets: MapInteractiveTarget[];
  mapLenses?: TownMapLensViewModel;
  onTileClick: (locationId: string) => void;
  onTileHover: (locationId: string) => void;
  onMarkerClick: (marker: WorldMapMarker) => void;
  onActorClick: (actor: WorldMapActor) => void;
  onLocationAction: (locationId: string) => void;
  onEncounterAction: (kind: SafeContextActionKind) => InvestigationActionResult | void | Promise<InvestigationActionResult | void>;
  onEncounterDismiss: () => void;
  replaying: boolean;
  setReplaying: (value: boolean | ((value: boolean) => boolean)) => void;
  timeMin: number;
  timeMax: number;
  timeValue: number;
  setTimeValue: (value: number) => void;
  timeToMinutes: (time: string) => number;
  minutesToTime: (minutes: number) => string;
  campaignMapPath?: string;
  campaignMapReady?: boolean;
};

function TownMapStageComponent(props: TownMapStageProps) {
  return <NoirMapStage {...props} />;
}

export const TownMapStage = memo(TownMapStageComponent, (previous, next) => (
  previous.caseFile === next.caseFile
  && previous.currentTime === next.currentTime
  && previous.stages === next.stages
  && previous.snapshot === next.snapshot
  && previous.actorsByTile === next.actorsByTile
  && previous.markersByTile === next.markersByTile
  && previous.hoverInfo === next.hoverInfo
  && previous.characterEncounter === next.characterEncounter
  && previous.encountersByActorId === next.encountersByActorId
  && previous.selectedSceneId === next.selectedSceneId
  && previous.highlightedEventId === next.highlightedEventId
  && previous.selectedCharacterId === next.selectedCharacterId
  && previous.selectionHighlight === next.selectionHighlight
  && previous.interactiveTargets === next.interactiveTargets
  && previous.mapLenses === next.mapLenses
  && previous.replaying === next.replaying
  && previous.timeMin === next.timeMin
  && previous.timeMax === next.timeMax
  && previous.timeValue === next.timeValue
));
