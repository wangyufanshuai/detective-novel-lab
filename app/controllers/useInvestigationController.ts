"use client";

import { useEffect, useState } from "react";
import { useInspectorSelection } from "@/app/hooks/useInspectorSelection";
import type { SelectionHighlight } from "@/app/hooks/useGuidedOnboarding";
import type { InvestigationToast } from "@/app/components/DetectiveTownUI";
import { useAppLocale } from "@/app/localization/locale-context";
import type {
  CaseFromLog,
  CaseLogicReport,
  CaseTemplateId,
  DeductionGraph,
  DeductionGraphNode,
  DeepSeekLiveEvalReport,
  InvestigationProgress,
  MurderArchetype,
  NpcDialogueEvalReport,
  PlayerSession,
  PlayerTheory,
  PromptAuditReport,
  ProofViewMode,
  RevealEvalReport,
  RevealFactContract,
  RuntimeMode,
  InvestigationRoomProjection,
  SuspectBoardRow,
  WorldEvent,
  WorldMapSnapshot,
  WorldMode,
  WorldState
} from "@/lib/engine";

export type AiSafetyState = {
  mock?: boolean;
  promptAudit?: PromptAuditReport;
  dialogueEval?: NpcDialogueEvalReport;
  revealEval?: RevealEvalReport;
  factContract?: RevealFactContract;
  safetyFlags?: string[];
  memoryCount?: number;
  evidenceCount?: number;
};

export type CaseMode = "premium" | "generated";

/** Owns player-facing case/session/selection state while certified actions stay unchanged. */
export function useInvestigationController(initialProgress: InvestigationProgress) {
  const { locale, t } = useAppLocale();
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
  const [playerName, setPlayerName] = useState("Investigator");
  const [timeValue, setTimeValue] = useState(21 * 60 + 30);
  const [selectedSceneId, setSelectedSceneId] = useState("");
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState("");
  const [highlightedEventId, setHighlightedEventId] = useState("");
  const [question, setQuestion] = useState("Where were you during the incident window, and what did you notice?");
  const [theory, setTheory] = useState<PlayerTheory>({ culpritId: "", motive: "", method: "", evidenceIds: [] });
  const [status, setStatus] = useState("Loaded the deterministic Detective Town. Observe the timeline, then search locations and question NPCs.");
  const [revealText, setRevealText] = useState("");
  const [lastAiSafety, setLastAiSafety] = useState<AiSafetyState | null>(null);
  const [latestLiveEval, setLatestLiveEval] = useState<DeepSeekLiveEvalReport | null>(null);
  const [deductionGraph, setDeductionGraph] = useState<DeductionGraph | null>(null);
  const [suspectBoard, setSuspectBoard] = useState<SuspectBoardRow[]>([]);
  const [logicReport, setLogicReport] = useState<CaseLogicReport | null>(null);
  const [roomProjection, setRoomProjection] = useState<InvestigationRoomProjection | null>(null);
  const [busy, setBusy] = useState(false);
  const [developerOpen, setDeveloperOpen] = useState(false);
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>("server");
  const [progress, setProgress] = useState<InvestigationProgress>(initialProgress);
  const [selectionHighlight, setSelectionHighlight] = useState<SelectionHighlight>({});
  const [selectedGraphNode, setSelectedGraphNode] = useState<DeductionGraphNode | null>(null);
  const [selectedSuspectId, setSelectedSuspectId] = useState("");
  const [proofViewMode, setProofViewMode] = useState<ProofViewMode>("player");
  const [selectedGapType, setSelectedGapType] = useState("");
  const [hoveredLocationId, setHoveredLocationId] = useState("");
  const [toasts, setToasts] = useState<InvestigationToast[]>([]);
  const inspector = useInspectorSelection("investigation");

  useEffect(() => {
    setPlayerName((current) => current === "Investigator" || current === "调查员" ? t("control.defaultPlayerName") : current);
    setQuestion((current) => current === "Where were you during the incident window, and what did you notice?" || current === "案发时段你在哪里？你注意到了哪些异常？" ? t("workspace.defaultQuestion") : current);
    setStatus((current) => current === "Loaded the deterministic Detective Town. Observe the timeline, then search locations and question NPCs." || current === "已载入确定性侦探小镇。请先观察时间线，再搜索地点并询问 NPC。" ? t("status.ready") : current);
  }, [locale, t]);

  function pushToast(toast: Omit<InvestigationToast, "id">) {
    const id = `toast:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [{ id, ...toast }, ...current].slice(0, 4));
  }

  function dismissToast(id: string) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  return {
    world, setWorld, events, setEvents, activeCase, setActiveCase, session, setSession, sessions, setSessions,
    snapshot, setSnapshot, worldIdInput, setWorldIdInput, seedInput, setSeedInput, caseMode, setCaseMode,
    caseTemplateId, setCaseTemplateId, caseArchetype, setCaseArchetype, mode, setMode, playerName, setPlayerName,
    timeValue, setTimeValue, selectedSceneId, setSelectedSceneId, selectedCharacterId, setSelectedCharacterId,
    selectedEvidenceId, setSelectedEvidenceId, highlightedEventId, setHighlightedEventId, question, setQuestion,
    theory, setTheory, status, setStatus, revealText, setRevealText, lastAiSafety, setLastAiSafety,
    latestLiveEval, setLatestLiveEval, deductionGraph, setDeductionGraph, suspectBoard, setSuspectBoard,
    logicReport, setLogicReport, busy, setBusy, developerOpen, setDeveloperOpen, runtimeMode, setRuntimeMode,
    roomProjection, setRoomProjection,
    progress, setProgress, selectionHighlight, setSelectionHighlight, selectedGraphNode, setSelectedGraphNode,
    selectedSuspectId, setSelectedSuspectId, proofViewMode, setProofViewMode, selectedGapType, setSelectedGapType,
    hoveredLocationId, setHoveredLocationId, toasts, setToasts, pushToast, dismissToast, ...inspector
  };
}
