"use client";

import {
  AlertTriangle,
  Bot,
  ChevronDown,
  Clock,
  Database,
  FileSearch,
  Gavel,
  Loader2,
  Map as MapIcon,
  MessageSquare,
  Pause,
  Play,
  Search,
  ShieldCheck,
  Users
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import DeductionGraphView from "@/app/components/DeductionGraphView";
import { useDetectiveTownRuntimeView } from "@/app/hooks/useDetectiveTownRuntime";
import { hasContradictionHit, useInvestigationView } from "@/app/hooks/useInvestigationActions";
import { useInspectorSelection } from "@/app/hooks/useInspectorSelection";
import { useGuidedOnboarding, type GuidedTask, type SelectionHighlight } from "@/app/hooks/useGuidedOnboarding";
import {
  CaseLogicPanel,
  CausalTracePanel,
  ControlRail,
  DeveloperPanel,
  EmergenceProofPanel,
  EventLogPanel,
  InspectorRail,
  InvestigationPanel,
  OnboardingOverlay,
  PlayShell,
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
  buildCaseLogicReport,
  buildDeductionGraph,
  buildEmergenceProofTrace,
  buildWorldMapSnapshot,
  createPremiumAuthoringDraft,
  createStaticDemoRuntime,
  deriveSuspectBoard,
  discoverDemoEvidence,
  exportAuthoringJson,
  exportAuthoringMarkdown,
  interrogateDemoNpc,
  listCaseTemplates,
  markDemoCrimeObserved,
  revealDemoSolution,
  submitDemoTheory,
  validateAuthoringDraft
} from "@/lib/engine";
import type {
  AuthoringDraft,
  AuthoringValidationReport,
  CaseFromLog,
  CaseLogicReport,
  CaseTemplateId,
  DeductionGraphNode,
  DeductionGraph,
  DemoRuntimeState,
  DeepSeekLiveEvalReport,
  EmergenceProofTrace,
  InvestigationProgress,
  MurderArchetype,
  NpcDialogueEvalReport,
  PlayerSession,
  PlayerTheory,
  PromptAuditReport,
  RevealEvalReport,
  RevealFactContract,
  RuntimeMode,
  SuspectBoardRow,
  WorldEvent,
  WorldMapActor,
  WorldMapMarker,
  WorldMapSnapshot,
  WorldMode,
  WorldState
} from "@/lib/engine";

type ApiResult<T> = T & { ok: boolean; error?: string };
type V1Result<T> = { ok: boolean; data?: T; error?: { code: string; message: string } };
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
type AppMode = "play" | "authoring";
type AuthoringTab = "case" | "characters" | "evidence" | "scenes" | "timeline" | "logic";

const storageKey = "detective-town-launch-v1";
const authoringStorageKey = "detective-town-authoring-v1";
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
  blade: "刀具伤害",
  poison: "药物投毒",
  blunt: "钝器误导",
  fall: "坠落机关"
};
const caseTemplates = listCaseTemplates();

function apiUrl(path: string) {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

function loadLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function cloneLocal<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

async function postJson<T>(url: string, body: unknown) {
  const response = await fetch(apiUrl(url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = (await response.json()) as ApiResult<T>;
  if (!data.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function getV1<T>(url: string) {
  const response = await fetch(apiUrl(url));
  const data = (await response.json()) as V1Result<T>;
  if (!data.ok || !data.data) throw new Error(data.error?.message || "Request failed");
  return data.data;
}

function actorInitial(name: string) {
  return Array.from(name)[0] || "?";
}

function resolveRuntimeMode(): RuntimeMode {
  if (typeof window === "undefined") return "server";
  const requested = new URLSearchParams(window.location.search).get("runtime");
  if (requested === "static") return "static-demo";
  if (requested === "server") return "server";
  return process.env.NEXT_PUBLIC_DEMO_MODE === "static" ? "static-demo" : "server";
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
  const { inspectorTab, setInspectorTab, showEvents, showInvestigation, showLogic, showPeople } = useInspectorSelection("events");
  const [selectionHighlight, setSelectionHighlight] = useState<SelectionHighlight>({});
  const [selectedGraphNode, setSelectedGraphNode] = useState<DeductionGraphNode | null>(null);
  const [selectedSuspectId, setSelectedSuspectId] = useState("");
  const [selectedGapType, setSelectedGapType] = useState("");
  const [hoveredLocationId, setHoveredLocationId] = useState("");
  const [toasts, setToasts] = useState<InvestigationToast[]>([]);
  const [appMode, setAppMode] = useState<AppMode>("play");
  const [authoringDraft, setAuthoringDraft] = useState<AuthoringDraft>(() => createPremiumAuthoringDraft());
  const [authoringTab, setAuthoringTab] = useState<AuthoringTab>("case");
  const [authoringCharacterId, setAuthoringCharacterId] = useState("");
  const [authoringEvidenceId, setAuthoringEvidenceId] = useState("");
  const [authoringSceneId, setAuthoringSceneId] = useState("");
  const [authoringTimelineId, setAuthoringTimelineId] = useState("");
  const [authoringImportText, setAuthoringImportText] = useState("");
  const [authoringExportText, setAuthoringExportText] = useState("");
  const [authoringStatus, setAuthoringStatus] = useState("Authoring \u4f7f\u7528\u6d4f\u89c8\u5668\u672c\u5730\u72b6\u6001\uff0c\u4e0d\u8bf7\u6c42 DeepSeek\uff0c\u4e0d\u5199\u5165 SQLite\u3002");

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
  const sceneEvidence = selectedScene ? deductionCase?.evidence.filter((item) => selectedScene.evidenceIds.includes(item.id)) || [] : [];
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
      { id: "observe", label: "观察现场", detail: "查看案发窗口和事件日志。" },
      { id: "search", label: "搜索证据", detail: "点击地点或证据 marker。" },
      { id: "question", label: "询问证人", detail: "选择 NPC 并提出问题。" },
      { id: "challenge", label: "质询矛盾", detail: "出示已发现证据。" },
      { id: "organize", label: "整理推理", detail: "选择关键证据链。" },
      { id: "submit", label: "提交结论", detail: "判定凶手、动机和手法。" },
      { id: "reveal", label: "复盘解答", detail: "查看最终图节点和解答篇。" }
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
      statusLabel: contradiction ? "证词矛盾命中" : excluded ? "已被排除" : questioned ? "已询问" : "未询问",
      questioned,
      contradiction,
      excluded
    };
  }, [contradictedCharacterIds, excludedCharacterIds, questionedCharacterIds, selectedCharacter]);
  const graphExplanation: GraphNodeExplanation | null = useMemo(() => {
    if (!selectedGraphNode || !deductionCase) return null;
    const node = selectedGraphNode;
    const discoveredTitles = node.evidenceIds.filter((id) => discovered.has(id)).map((id) => evidenceTitleById.get(id) || id);
    const hiddenCount = node.evidenceIds.filter((id) => !discovered.has(id)).length;
    const sourceEvents = node.eventIds.map((id) => eventById.get(id)).filter((event): event is WorldEvent => Boolean(event));
    const names = node.characterIds.map((id) => characterById.get(id)?.name || id);
    const source = sourceEvents.length
      ? `来源事件：${sourceEvents.map((event) => `${event.time} ${event.publicSummary}`).join(" / ")}`
      : "来源：当前案件结构与本地规则校验。";
    if (hiddenCount > 0 && node.type !== "conclusion") {
      return {
        node,
        title: "未发现的推理节点",
        status: "LOCKED / 严格不剧透",
        body: "该节点需要玩家先找到对应证据。系统不会提前显示证据标题、真实含义或最终结论。",
        source,
        references: discoveredTitles,
        spoilerSafe: false
      };
    }
    const typeLabel: Record<string, string> = {
      evidence: "证据成立",
      event: "世界事件来源",
      testimony: "证词矛盾",
      elimination: "嫌疑人排除",
      conclusion: "唯一结论"
    };
    return {
      node,
      title: node.label,
      status: typeLabel[node.type] || node.type,
      body: node.detail || "该节点由已发现证据和本地规则链支持。",
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
      const statusLabel = isCulprit ? (solved ? "最终唯一嫌疑人" : "未破案前不显示结论") : row.status === "red_herring" ? "强误导嫌疑人" : "已排除候选";
      const exclusionStatus = isCulprit
        ? (solved ? "动机、手段、机会和关键证据链均未被反证排除。" : "仍需完整证据链。未破案前不显示真凶结论。")
        : visibleEvidence.length
          ? `已由 ${visibleEvidence.join("、")} 排除。`
          : "仍需发现排除证据；当前不泄露证据标题。";
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
      if (label.includes("凶手")) return "suspects";
      if (label.includes("动机")) return "motive";
      if (label.includes("手法")) return "method";
      if (label.includes("证据")) return "evidence";
      if (label.includes("排除")) return "exclusion";
      return "logic";
    };
    return judgementGaps.map((label) => {
      const target = mapTarget(label);
      const detail: Record<GapCard["target"], string> = {
        suspects: "查看嫌疑人矩阵，确认谁仍保留完整动机/手段/机会。",
        motive: "回到推理表单，补充已发现证据能支持的动机说明。",
        method: "回到推理表单，补充作案工具、动作和伪装方式。",
        evidence: "检查已发现证据，选择能连成链条的关键线索。",
        exclusion: "查看 Suspect Board，确认非凶手是否已有排除证据。",
        logic: "查看推理图，补齐从证据到结论的缺口。"
      };
      return { id: `gap:${label}`, label, detail: detail[target], target };
    });
  }, [judgementGaps]);
  const nextStepAdvice = useMemo(() => {
    if (!session?.judgement || session.judgement.accepted) return "";
    if (discoveredEvidence.length > 0 && !progress.challengedTestimony) {
      return `先把已发现证据“${discoveredEvidence[0].title}”出示给相关 NPC，检查证词是否矛盾。`;
    }
    if (discoveredEvidence.length > 0) {
      return `从已发现的 ${discoveredEvidence.length} 条证据里挑选能同时支撑动机、手法和机会的线索。`;
    }
    return selectedScene ? `继续搜索 ${selectedScene.name}，先建立证据链。` : "先点击地图上的可搜索地点，找到第一条证据。";
  }, [discoveredEvidence, progress.challengedTestimony, selectedScene, session?.judgement]);
  const solutionChain = useMemo(() => {
    if (!session?.judgement?.accepted || !deductionCase) return [];
    const selectedTitles = theory.evidenceIds.filter((id) => discovered.has(id)).map((id) => evidenceTitleById.get(id) || id);
    const eliminatedCount = suspectBoard.filter((row) => row.status !== "culprit").length;
    return [
      selectedTitles.length ? `玩家已提交 ${selectedTitles.length} 条已发现证据：${selectedTitles.slice(0, 4).join("、")}${selectedTitles.length > 4 ? " 等" : ""}。` : "玩家已提交的证据链通过本地规则校验。",
      "这些证据分别支撑动机、手法、机会或证词矛盾，形成可复查的推理链。",
      `Suspect Board 中 ${eliminatedCount} 名非凶手通过已发现或已验证的排除链离场。`,
      "唯一仍保留完整动机、手段、机会且没有被反证排除的人，才会在最终结论节点出现。"
    ];
  }, [deductionCase, discovered, evidenceTitleById, session?.judgement?.accepted, suspectBoard, theory.evidenceIds]);
  const inspectorSummary = useMemo(() => {
    if (inspectorTab === "events") {
      return selectedEvent
        ? { title: `${selectedEvent.time} / ${selectedEvent.locationId}`, detail: selectedEvent.publicSummary, tone: "event" }
        : { title: "事件日志", detail: "选择事件可同步高亮地图地点和时间轴。", tone: "event" };
    }
    if (inspectorTab === "investigation") {
      if (selectedEvidence) return { title: `证据：${selectedEvidence.title}`, detail: "查看用途提示，必要时出示给 NPC 质询。", tone: "evidence" };
      if (selectedCharacter) return { title: `NPC：${selectedCharacter.name}`, detail: selectedCharacter.role, tone: "person" };
      return { title: `地点：${selectedScene?.name || "未选择"}`, detail: "搜索地点、询问 NPC、提交推理。", tone: "investigation" };
    }
    if (inspectorTab === "logic") return { title: "案件逻辑", detail: "推理图、因果链和解答篇只在正确推理后完整展开。", tone: "logic" };
    if (inspectorTab === "people") return { title: "嫌疑人矩阵", detail: "查看动机、手段、机会和排除证据。", tone: "people" };
    return { title: "开发者接口", detail: "查看 Agent API、worldId、caseId 和 sessionId。", tone: "developer" };
  }, [inspectorTab, selectedCharacter, selectedEvent, selectedEvidence, selectedScene?.name]);
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
  const authoringReport: AuthoringValidationReport = useMemo(() => validateAuthoringDraft(authoringDraft), [authoringDraft]);
  const authoringCase = authoringDraft.caseFromLog.deductionCase;
  const authoringCharacters = authoringCase.characters.filter((character) => character.role !== "\u6b7b\u8005");
  const authoringCharacter = authoringCase.characters.find((character) => character.id === authoringCharacterId) || authoringCharacters[0] || authoringCase.characters[0];
  const authoringEvidence = authoringCase.evidence.find((item) => item.id === authoringEvidenceId) || authoringCase.evidence[0];
  const authoringScene = authoringCase.scenes.find((item) => item.id === authoringSceneId) || authoringCase.scenes[0];
  const authoringTimelineEvent = authoringCase.truth.trueTimeline.find((item) => item.id === authoringTimelineId) || authoringCase.truth.trueTimeline[0];
  const authoringChecklist = useMemo(
    () => [
      { label: "Schema", ok: authoringReport.schema.valid, tab: "case" as AuthoringTab },
      { label: "World-backed Evidence", ok: Boolean(authoringDraft.caseFromLog.qualityReport.worldBackedEvidence), tab: "evidence" as AuthoringTab },
      { label: "Memory-scoped Testimony", ok: Boolean(authoringDraft.caseFromLog.qualityReport.memoryScopedTestimony), tab: "characters" as AuthoringTab },
      { label: "Hard Logic", ok: authoringReport.hardLogicValid, tab: "logic" as AuthoringTab },
      { label: "Playable Runtime", ok: authoringReport.valid, tab: "logic" as AuthoringTab }
    ],
    [authoringDraft.caseFromLog.qualityReport.memoryScopedTestimony, authoringDraft.caseFromLog.qualityReport.worldBackedEvidence, authoringReport.hardLogicValid, authoringReport.schema.valid, authoringReport.valid]
  );
  const authoringBlocker = authoringReport.issues.find((item) => item.severity === "error");
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
          createTown: { method: "POST", url: "/api/v1/command/town/create", body: { seed: seedInput, mode, caseMode, caseTemplateId, npcCount: mode === "advanced" ? 30 : 8, timelineHours: mode === "advanced" ? 120 : 24, caseArchetype } },
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
    localStorage.setItem(authoringStorageKey, JSON.stringify(authoringDraft));
  }, [authoringDraft]);

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
      .catch(() => undefined);
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
    setStatus("Premium Showcase 已载入。拖动时间轴观察案件发生，再搜索场景和质询证词。");
  }

  function currentStaticState(): DemoRuntimeState | null {
    if (!world || !activeCase || !session) return null;
    return { mode: "static-demo", world, events, activeCase, session, progress, revealText };
  }

  function hydrateCase(data: { world: WorldState; events?: WorldEvent[]; activeCase?: CaseFromLog; sessions?: PlayerSession[] }) {
    setWorld(data.world);
    if (data.events) setEvents(data.events);
    if (data.activeCase) {
      setActiveCase(data.activeCase);
      setSelectedSceneId(data.activeCase.generationProfile.sceneLocationId);
      const firstCharacter = data.activeCase.deductionCase.characters.find((item) => item.role !== "\u6b7b\u8005");
      setSelectedCharacterId(firstCharacter?.id || data.activeCase.generationProfile.culpritId);
      setTheory({ culpritId: "", motive: "", method: "", evidenceIds: [] });
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
      const data = await postJson<{ world: WorldState; events: WorldEvent[]; activeCase: CaseFromLog }>("/api/worlds/create", {
        seed: seedInput.trim() || (caseMode === "premium" ? "premium-showcase" : "showcase-seed"),
        mode,
        caseMode: mode === "showcase" ? caseMode : "generated",
        caseTemplateId,
        npcCount: mode === "advanced" ? 30 : 8,
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
      setStatus("Detective Town 已创建：地图、事件、记忆和证据已从模拟世界生成。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "创建小镇失败");
    } finally {
      setBusy(false);
    }
  }

  async function loadWorld() {
    if (runtimeMode === "static-demo") {
      setStatus("静态 Demo 使用内置确定性世界；切换到 Server Runtime 后可载入 SQLite 世界。");
      return;
    }
    if (!worldIdInput.trim()) return;
    setBusy(true);
    try {
      const state = await fetch(apiUrl(`/api/worlds/${worldIdInput.trim()}/state`)).then((response) => response.json());
      if (!state.ok) throw new Error(state.error || "读取小镇失败");
      const eventResult = await fetch(apiUrl(`/api/worlds/${worldIdInput.trim()}/events`)).then((response) => response.json());
      hydrateCase({ world: state.world, activeCase: state.activeCase, sessions: state.sessions || [], events: eventResult.events || [] });
      persist(state.world.id, session?.id);
      setStatus("已载入现有 Detective Town。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "读取小镇失败");
    } finally {
      setBusy(false);
    }
  }

  async function joinCase() {
    if (!world || !activeCase) return;
    if (runtimeMode === "static-demo" && session) {
      setProgress((current) => ({ ...current, joinedInvestigation: true }));
      setStatus("已加入调查。点击地图地点搜索证据，点击 NPC 选择询问对象。");
      return;
    }
    setBusy(true);
    try {
      const data = await postJson<{ session: PlayerSession }>("/api/players/join", { worldId: world.id, caseId: activeCase.id, displayName: playerName.trim() || "调查员" });
      setSession(data.session);
      setProgress((current) => ({ ...current, joinedInvestigation: true }));
      setSessions((items) => [data.session, ...items.filter((item) => item.id !== data.session.id)]);
      persist(world.id, data.session.id);
      setStatus("已加入调查。点击地图地点搜索证据，点击 NPC 进行询问。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "加入调查失败");
    } finally {
      setBusy(false);
    }
  }

  async function tickWorld() {
    if (!world) return;
    if (runtimeMode === "static-demo") {
      setStatus("静态 Demo 固定为 24 小时 Premium 案件；请使用时间轴回放。");
      return;
    }
    setBusy(true);
    try {
      const data = await postJson<{ world: WorldState; events: WorldEvent[]; activeCase: CaseFromLog }>(`/api/worlds/${world.id}/tick`, {});
      setWorld(data.world);
      setEvents((items) => [...items, ...data.events]);
      setActiveCase(data.activeCase);
      setRevealText("");
      setStatus(`小镇推进到第 ${data.world.day} 日，新事件已写入日志。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "推进小镇失败");
    } finally {
      setBusy(false);
    }
  }

  async function discoverEvidence(evidenceId: string) {
    const evidenceTitle = deductionCase?.evidence.find((item) => item.id === evidenceId)?.title || evidenceId;
    if (!session) {
      setStatus("请先加入调查，再搜索证据。");
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
      pushToast({ tone: "success", title: "发现证据", detail: evidenceTitle });
      setStatus(`发现证据：${deductionCase?.evidence.find((item) => item.id === evidenceId)?.title || evidenceId}`);
      return;
    }
    setBusy(true);
    try {
      const data = await postJson<{ session: PlayerSession }>("/api/investigation/discover", { sessionId: session.id, evidenceId });
      setSession(data.session);
      setProgress((current) => ({ ...current, discoveredEvidence: true }));
      setSelectedEvidenceId(evidenceId);
      const scene = scenes.find((item) => item.evidenceIds.includes(evidenceId));
      highlightSelection({ evidenceId, locationId: scene?.id });
      setInspectorTab("investigation");
      pushToast({ tone: "success", title: "发现证据", detail: evidenceTitle });
      setStatus(`发现证据：${deductionCase?.evidence.find((item) => item.id === evidenceId)?.title || evidenceId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "搜索证据失败");
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

  async function interrogate() {
    if (!session || !selectedCharacterId || !question.trim()) return;
    if (runtimeMode === "static-demo") {
      const state = currentStaticState();
      if (!state) return;
      const next = interrogateDemoNpc(state, {
        characterId: selectedCharacterId,
        question,
        evidenceId: selectedEvidenceId || undefined
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
        title: next.progress.challengedTestimony ? "证词出现矛盾" : "NPC 已回答",
        detail: next.progress.challengedTestimony ? "证据命中记忆范围内的矛盾点。" : "回答已限定在 NPC 记忆和已发现证据内。"
      });
      setStatus(next.progress.challengedTestimony ? "证据命中矛盾，NPC 已修正证词。" : "NPC 已按自身记忆范围回答。");
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
      }>("/api/investigation/interrogate", {
        sessionId: session.id,
        characterId: selectedCharacterId,
        question,
        evidenceId: selectedEvidenceId || undefined
      });
      setSession(data.session);
      setProgress((current) => ({ ...current, challengedTestimony: current.challengedTestimony || data.testimonyUpdated }));
      setLastAiSafety({ mock: data.mock, promptAudit: data.promptAudit, dialogueEval: data.dialogueEval, safetyFlags: data.safetyFlags, memoryCount: data.memoryCount, evidenceCount: data.evidenceCount });
      setInspectorTab("investigation");
      pushToast({
        tone: data.testimonyUpdated ? "warning" : "info",
        title: data.testimonyUpdated ? "证词出现矛盾" : "NPC 已回答",
        detail: data.testimonyUpdated ? "证据命中记忆范围内的矛盾点。" : "回答已限定在 NPC 记忆和已发现证据内。"
      });
      setStatus(data.testimonyUpdated ? "证据击中矛盾，NPC 证词已被修正。" : "NPC 已按自身记忆回答。");
      if (activeCase) {
        const latestCase = await fetch(apiUrl(`/api/cases/${activeCase.id}`)).then((response) => response.json());
        if (latestCase.ok) setActiveCase(latestCase.caseFromLog || latestCase.activeCase || latestCase.case);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "询问失败");
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

  async function submitTheory() {
    if (!session) return;
    if (runtimeMode === "static-demo") {
      const state = currentStaticState();
      if (!state) return;
      const next = submitDemoTheory(state, theory);
      hydrateStatic(next, false);
      onboarding.recordTheoryResult(Boolean(next.session.judgement?.accepted));
      setInspectorTab("investigation");
      pushToast({
        tone: next.session.judgement?.accepted ? "success" : "warning",
        title: next.session.judgement?.accepted ? "推理成立" : "推理仍有缺口",
        detail: next.session.judgement?.accepted ? "解答篇和最终图节点已解锁。" : `缺口类型：${next.session.judgement?.missing?.join("、") || "关键证据链"}`
      });
      setStatus(next.session.judgement?.accepted ? "推理成立。最终结论与解答篇已解锁。" : `推理不成立：${next.session.judgement?.missing?.join("、") || "证据链不足"}`);
      return;
    }
    setBusy(true);
    try {
      const data = await postJson<{ judgement: PlayerSession["judgement"]; session: PlayerSession }>("/api/investigation/submit-theory", { sessionId: session.id, theory });
      setSession(data.session);
      onboarding.recordTheoryResult(Boolean(data.judgement?.accepted));
      setProgress((current) => ({ ...current, submittedTheory: true, solvedCase: Boolean(data.judgement?.accepted) }));
      setInspectorTab("investigation");
      pushToast({
        tone: data.judgement?.accepted ? "success" : "warning",
        title: data.judgement?.accepted ? "推理成立" : "推理仍有缺口",
        detail: data.judgement?.accepted ? "可以生成解答篇。" : `缺口类型：${data.judgement?.missing?.join("、") || "关键证据链"}`
      });
      setStatus(data.judgement?.accepted ? "推理成立。可以生成解答篇。" : `推理不成立：${data.judgement?.missing?.join("、") || "证据链不足"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "提交推理失败");
    } finally {
      setBusy(false);
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
      pushToast({ tone: "success", title: "解答篇已解锁", detail: "现在可以查看证据如何推出最终结论。" });
      setStatus("解答篇已由本地事实锁生成，不调用 DeepSeek。");
      return;
    }
    setBusy(true);
    try {
      const data = await postJson<{ content: string; revealEval: RevealEvalReport; factContract: RevealFactContract; mock: boolean }>("/api/investigation/reveal", { sessionId: session.id });
      setRevealText(data.content);
      setLastAiSafety((current) => ({ ...(current || {}), revealEval: data.revealEval, factContract: data.factContract, mock: data.mock }));
      setInspectorTab("logic");
      pushToast({ tone: "success", title: "解答篇已生成", detail: "事实仍以本地规则和案件结构为准。" });
      setStatus("解答篇已生成，并按本地事实锁校验。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "生成解答失败");
    } finally {
      setBusy(false);
    }
  }

  async function copyAgentApiExample() {
    try {
      await navigator.clipboard.writeText(agentApiExample);
      setStatus("Agent API 示例已复制。");
    } catch {
      setStatus("复制失败：当前浏览器未开放剪贴板权限。");
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
    setQuestion(`${actor.name}，案发窗口你在哪里？你记得哪些异常？`);
    highlightSelection({ characterId: actor.id, locationId: actor.locationId });
    setInspectorTab("investigation");
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
    setStatus("已切换到 Server Runtime。创建小镇后将使用 SQLite，并可调用 DeepSeek 生成 NPC 表层回答。");
  }

  function switchCaseTemplate(next: CaseTemplateId) {
    setCaseTemplateId(next);
    if (runtimeMode === "static-demo" && caseMode === "premium") {
      hydrateStatic(createStaticDemoRuntime(next));
      setReplaying(false);
      setLastAiSafety(null);
      setStatus(`已切换案例模板：${caseTemplates.find((item) => item.id === next)?.title || next}`);
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
    setAuthoringDraft((current) => applyAuthoringPatch(current, { op: "set", path, value }));
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
    setAuthoringStatus("\u5df2\u6062\u590d\u6848\u4f8b\u6a21\u677f\uff0c\u53ef\u7ee7\u7eed\u7f16\u8f91\u6216\u76f4\u63a5 Run Draft\u3002");
  }

  function deleteAuthoringEvidence() {
    if (!authoringEvidence) return;
    const refs = authoringEvidenceReferences(authoringEvidence.id);
    setAuthoringDraft((current) => applyAuthoringPatch(current, { op: "delete-array-item", path: "caseFromLog.deductionCase.evidence", id: authoringEvidence.id }));
    setAuthoringEvidenceId("");
    setAuthoringStatus(refs.length ? `\u8bc1\u636e\u5df2\u5220\u9664\uff0c\u4f46\u4ecd\u88ab\u5f15\u7528\uff1a${refs.join("\uff1b")}\u3002Rule Report \u4f1a\u963b\u65ad Run Draft\u3002` : "\u8bc1\u636e\u5df2\u5220\u9664\uff0c\u672a\u53d1\u73b0\u6b8b\u7559\u5f15\u7528\u3002");
  }

  function importAuthoringJson() {
    try {
      const parsed = JSON.parse(authoringImportText);
      if (parsed?.caseFromLog?.deductionCase && parsed?.world && Array.isArray(parsed?.events)) {
        setAuthoringDraft({ ...parsed, version: 1, source: "imported", updatedAt: new Date().toISOString() });
      } else if (parsed?.id && parsed?.truth && parsed?.logicPuzzle) {
        const next = cloneLocal(authoringDraft);
        next.caseFromLog.deductionCase = parsed;
        next.source = "imported";
        next.updatedAt = new Date().toISOString();
        setAuthoringDraft(next);
      } else {
        throw new Error("JSON 必须是 AuthoringDraft，或单独的 DeductionCase。");
      }
      setAuthoringStatus("导入完成，已运行 schema 与 hard logic 校验。");
    } catch (error) {
      setAuthoringStatus(error instanceof Error ? error.message : "导入失败：JSON 格式无效。");
    }
  }

  function exportAuthoring(kind: "json" | "markdown") {
    const text = kind === "json" ? exportAuthoringJson(authoringDraft) : exportAuthoringMarkdown(authoringDraft);
    setAuthoringExportText(text);
    setAuthoringStatus(kind === "json" ? "已生成可运行案件 JSON。" : "已生成案件 Markdown 说明。");
  }

  function runAuthoringDraft() {
    if (!authoringReport.valid) {
      setAuthoringStatus("当前草稿没有通过 hard logic 校验，不能作为 playable case 运行。");
      return;
    }
    const stamp = new Date().toISOString();
    const runtimeState: DemoRuntimeState = {
      mode: "static-demo",
      world: cloneLocal(authoringDraft.world),
      events: cloneLocal(authoringDraft.events),
      activeCase: cloneLocal(authoringDraft.caseFromLog),
      session: {
        id: `session-authoring-${Date.now()}`,
        worldId: authoringDraft.world.id,
        caseId: authoringDraft.caseFromLog.id,
        playerId: "player-authoring",
        displayName: "作者试玩",
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
    setStatus("已使用当前 Authoring Draft 创建临时 Static Demo Runtime。");
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

    return (
      <main className="authoringShell" data-testid="authoring-workbench">
        <aside className="authoringRail">
          <div className="brandBlock">
            <div className="brandIcon"><MapIcon size={24} /></div>
            <div>
              <p>Detective Town</p>
              <h1>案件创作台</h1>
            </div>
          </div>
          <div className="modeSwitch">
            <button onClick={() => setAppMode("play")}>Play</button>
            <button className="active">Authoring</button>
          </div>
          <div className="authoringTabs">
            {[
              ["case", "Case"],
              ["characters", "Characters"],
              ["evidence", "Evidence"],
              ["scenes", "Scenes"],
              ["timeline", "Timeline"],
              ["logic", "Logic"]
            ].map(([value, label]) => (
              <button key={value} className={authoringTab === value ? "active" : ""} onClick={() => setAuthoringTab(value as AuthoringTab)}>{label}</button>
            ))}
          </div>

          {authoringTab === "case" && (
            <section className="authoringPanel">
              <h2>案件基础</h2>
              <label>案件标题
                <input data-testid="authoring-title" value={authoringCase.title} onChange={(event) => patchAuthoring("caseFromLog.deductionCase.title", event.target.value)} />
              </label>
              <label>公开案情
                <textarea value={authoringCase.publicCaseFile} onChange={(event) => patchAuthoring("caseFromLog.deductionCase.publicCaseFile", event.target.value)} />
              </label>
              <label>主题
                <input value={authoringCase.theme} onChange={(event) => patchAuthoring("caseFromLog.deductionCase.theme", event.target.value)} />
              </label>
              <label>前提
                <textarea value={authoringCase.premise} onChange={(event) => patchAuthoring("caseFromLog.deductionCase.premise", event.target.value)} />
              </label>
            </section>
          )}

          {authoringTab === "characters" && authoringCharacter && (
            <section className="authoringPanel">
              <h2>人物</h2>
              <select value={authoringCharacter.id} onChange={(event) => setAuthoringCharacterId(event.target.value)}>
                {authoringCase.characters.map((character) => <option key={character.id} value={character.id}>{character.name} - {character.role}</option>)}
              </select>
              <label>姓名<input value={authoringCharacter.name} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.characters.${authoringCase.characters.findIndex((item) => item.id === authoringCharacter.id)}.name`, event.target.value)} /></label>
              <label>身份<input value={authoringCharacter.role} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.characters.${authoringCase.characters.findIndex((item) => item.id === authoringCharacter.id)}.role`, event.target.value)} /></label>
              <label>公开履历<textarea value={authoringCharacter.publicBio} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.characters.${authoringCase.characters.findIndex((item) => item.id === authoringCharacter.id)}.publicBio`, event.target.value)} /></label>
              <label>证词<textarea value={authoringCharacter.initialStatement} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.characters.${authoringCase.characters.findIndex((item) => item.id === authoringCharacter.id)}.initialStatement`, event.target.value)} /></label>
              <label>动机表象<textarea value={authoringCharacter.motive} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.characters.${authoringCase.characters.findIndex((item) => item.id === authoringCharacter.id)}.motive`, event.target.value)} /></label>
            </section>
          )}

          {authoringTab === "evidence" && authoringEvidence && (
            <section className="authoringPanel">
              <h2>证据</h2>
              <select value={authoringEvidence.id} onChange={(event) => setAuthoringEvidenceId(event.target.value)}>
                {authoringCase.evidence.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
              <label>标题<input value={authoringEvidence.title} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.evidence.${authoringCase.evidence.findIndex((item) => item.id === authoringEvidence.id)}.title`, event.target.value)} /></label>
              <label>玩家可见描述<textarea data-testid="authoring-evidence-description" value={authoringEvidence.visibleDescription} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.evidence.${authoringCase.evidence.findIndex((item) => item.id === authoringEvidence.id)}.visibleDescription`, event.target.value)} /></label>
              <label>真实含义<textarea value={authoringEvidence.trueMeaning} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.evidence.${authoringCase.evidence.findIndex((item) => item.id === authoringEvidence.id)}.trueMeaning`, event.target.value)} /></label>
              <label className="checkRow"><input type="checkbox" checked={authoringEvidence.discoverable} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.evidence.${authoringCase.evidence.findIndex((item) => item.id === authoringEvidence.id)}.discoverable`, event.target.checked)} /> 可发现</label>
              <button data-testid="delete-authoring-evidence" className="dangerButton" onClick={deleteAuthoringEvidence}>Delete Evidence</button>
            </section>
          )}

          {authoringTab === "scenes" && authoringScene && (
            <section className="authoringPanel">
              <h2>场景</h2>
              <select value={authoringScene.id} onChange={(event) => setAuthoringSceneId(event.target.value)}>
                {authoringCase.scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.name}</option>)}
              </select>
              <label>名称<input value={authoringScene.name} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.scenes.${authoringCase.scenes.findIndex((item) => item.id === authoringScene.id)}.name`, event.target.value)} /></label>
              <label>描述<textarea value={authoringScene.description} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.scenes.${authoringCase.scenes.findIndex((item) => item.id === authoringScene.id)}.description`, event.target.value)} /></label>
              <label>证据 IDs<input value={authoringScene.evidenceIds.join(", ")} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.scenes.${authoringCase.scenes.findIndex((item) => item.id === authoringScene.id)}.evidenceIds`, event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} /></label>
            </section>
          )}

          {authoringTab === "timeline" && authoringTimelineEvent && (
            <section className="authoringPanel">
              <h2>时间线</h2>
              <select value={authoringTimelineEvent.id} onChange={(event) => setAuthoringTimelineId(event.target.value)}>
                {authoringCase.truth.trueTimeline.map((item) => <option key={item.id} value={item.id}>{item.time} - {item.id}</option>)}
              </select>
              <label>时间<input value={authoringTimelineEvent.time} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.truth.trueTimeline.${authoringCase.truth.trueTimeline.findIndex((item) => item.id === authoringTimelineEvent.id)}.time`, event.target.value)} /></label>
              <label>真实事件<textarea value={authoringTimelineEvent.event} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.truth.trueTimeline.${authoringCase.truth.trueTimeline.findIndex((item) => item.id === authoringTimelineEvent.id)}.event`, event.target.value)} /></label>
              <label>公开版本<textarea value={authoringTimelineEvent.publicVersion} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.truth.trueTimeline.${authoringCase.truth.trueTimeline.findIndex((item) => item.id === authoringTimelineEvent.id)}.publicVersion`, event.target.value)} /></label>
              <label>反驳证据 IDs<input value={authoringTimelineEvent.contradictedByEvidenceIds.join(", ")} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.truth.trueTimeline.${authoringCase.truth.trueTimeline.findIndex((item) => item.id === authoringTimelineEvent.id)}.contradictedByEvidenceIds`, event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} /></label>
            </section>
          )}

          {authoringTab === "logic" && (
            <section className="authoringPanel">
              <h2>逻辑链</h2>
              <label>关键线索顺序
                <input value={authoringCase.logicPuzzle.requiredClueOrder.join(", ")} onChange={(event) => patchAuthoring("caseFromLog.deductionCase.logicPuzzle.requiredClueOrder", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} />
              </label>
              <label>误导线索
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
                  阻断原因：{authoringBlocker.message}
                </button>
              )}
            </div>
          </header>
          <section className="pixelMapWrap compactMap" data-testid="authoring-map">
            <div className="pixelMap" style={{ gridTemplateColumns: `repeat(${authoringMapSnapshot.width}, minmax(18px, 1fr))` }}>
              {authoringMapSnapshot.tiles.map((tile) => {
                const actors = authoringActorsByTile.get(`${tile.x}:${tile.y}`) || [];
                const markers = authoringMarkersByTile.get(`${tile.x}:${tile.y}`) || [];
                return (
                  <button key={tile.id} className={`mapTile terrain-${tile.terrain} ${tile.searchable ? "searchable" : ""}`} title={tile.locationName || tile.terrain}>
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
        </section>

        <aside className="authoringInspector">
          <section className={`authoringReport ${authoringReport.valid ? "pass" : "fail"}`} data-testid="authoring-rule-report">
            <h2>Rule Report</h2>
            <div className="validationChecklist" data-testid="authoring-validation-checklist">
              {authoringChecklist.map((item) => (
                <button key={item.label} type="button" className={item.ok ? "pass" : "fail"} onClick={() => setAuthoringTab(item.tab)}>
                  <span>{item.ok ? "✓" : "!"}</span>
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
              <button onClick={() => exportAuthoring("json")}>Export JSON</button>
              <button onClick={() => exportAuthoring("markdown")}>Export Markdown</button>
            </div>
            <textarea data-testid="authoring-import-text" placeholder="Paste AuthoringDraft or DeductionCase JSON" value={authoringImportText} onChange={(event) => setAuthoringImportText(event.target.value)} />
            <button className="secondaryButton full" onClick={importAuthoringJson}>Import JSON</button>
            <textarea data-testid="authoring-export-text" readOnly value={authoringExportText} placeholder="Export output appears here" />
            <div className="statusBox"><AlertTriangle size={16} /><span>{authoringStatus}</span></div>
          </section>
        </aside>
      </main>
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
    <PlayShell
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
          characterState={{
            questionedIds: questionedCharacterIds,
            contradictionIds: contradictedCharacterIds,
            excludedIds: excludedCharacterIds,
            currentCharacterId: selectedCharacterId
          }}
          onTileClick={(locationId) => void discoverFirstSceneEvidence(locationId)}
          onTileHover={setHoveredLocationId}
          onMarkerClick={handleMarker}
          onActorClick={handleActor}
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
                  busy={busy}
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
                    graph={graphView}
                    selectedGraphExplanation={graphExplanation}
                    solutionChain={solutionChain}
                    revealText={revealText}
                  />
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
    />
  );
}
