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
import { useRef, useState, type PointerEvent, type ReactNode } from "react";
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
  ScenarioReport,
  ScenarioRun,
  SuspectBoardRow,
  TownStateDiff,
  TownStateSnapshot,
  TownRuntimeIntervention,
  TownEmergenceQueue,
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

export function PlayShell({
  control,
  map,
  inspector,
  overlay,
  toasts
}: {
  control: ReactNode;
  map: ReactNode;
  inspector: ReactNode;
  overlay?: ReactNode;
  toasts?: ReactNode;
}) {
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

export function TownMapStage({
  caseFile,
  currentTime,
  stages,
  snapshot,
  actorsByTile,
  markersByTile,
  hoverInfo,
  npcPopover,
  selectedSceneId,
  highlightedEventId,
  selectedCharacterId,
  characterState,
  selectionHighlight,
  interactiveTargets,
  onTileClick,
  onTileHover,
  onMarkerClick,
  onActorClick,
  onLocationAction,
  onNpcAction,
  replaying,
  setReplaying,
  timeMin,
  timeMax,
  timeValue,
  setTimeValue,
  timeToMinutes,
  minutesToTime
}: {
  caseFile: string;
  currentTime: string;
  stages: InvestigationStage[];
  snapshot: WorldMapSnapshot | null;
  actorsByTile: Map<string, WorldMapActor[]>;
  markersByTile: Map<string, WorldMapMarker[]>;
  hoverInfo?: LocationHoverInfo | null;
  npcPopover?: NpcPopoverState | null;
  selectedSceneId: string;
  highlightedEventId: string;
  selectedCharacterId?: string;
  characterState: CharacterState;
  selectionHighlight?: SelectionHighlight;
  interactiveTargets: MapInteractiveTarget[];
  onTileClick: (locationId: string) => void;
  onTileHover: (locationId: string) => void;
  onMarkerClick: (marker: WorldMapMarker) => void;
  onActorClick: (actor: WorldMapActor) => void;
  onLocationAction: (locationId: string) => void;
  onNpcAction: (characterId: string) => void;
  replaying: boolean;
  setReplaying: (value: boolean | ((value: boolean) => boolean)) => void;
  timeMin: number;
  timeMax: number;
  timeValue: number;
  setTimeValue: (value: number) => void;
  timeToMinutes: (time: string) => number;
  minutesToTime: (minutes: number) => string;
}) {
  const interactiveTargetIds = new Set(interactiveTargets.map((target) => `${target.kind}:${target.locationId || target.characterId || target.evidenceId || target.eventId}`));
  return (
    <section className="mapStage">
      <header className="stageHud">
        <div>
          <p>WorldEvent sourced case simulation</p>
          <h2>{caseFile}</h2>
          <div className="valueProposition" data-testid="value-proposition">
            案件从小镇事件中发生，AI 只负责表层对话。<span>WorldEvent evidence / Memory-scoped testimony / Local rule judgement</span>
          </div>
        </div>
        <div className="timeBadge">{currentTime}</div>
      </header>
      <InvestigationStageBar stages={stages} />

      <section className="pixelMapWrap" data-testid="pixel-map">
        <div className="pixelMap" style={{ gridTemplateColumns: `repeat(${snapshot?.width || 28}, minmax(18px, 1fr))` }}>
          {(snapshot?.tiles || []).map((tile: WorldMapTile) => {
            const actors = actorsByTile.get(`${tile.x}:${tile.y}`) || [];
            const markers = markersByTile.get(`${tile.x}:${tile.y}`) || [];
            const selected = tile.locationId && tile.locationId === selectedSceneId;
            const highlighted = tile.locationId && tile.locationId === selectionHighlight?.locationId;
            const interactive = Boolean(tile.locationId || actors.length || markers.length);
            return (
              <button
                key={tile.id}
                className={`mapTile terrain-${tile.terrain} ${tile.searchable ? "searchable" : ""} ${selected ? "selected" : ""} ${highlighted ? "spotlight" : ""}`}
                data-location-id={tile.locationId || undefined}
                title={tile.locationName || tile.terrain}
                aria-label={interactive ? (tile.locationName || tile.terrain) : undefined}
                aria-hidden={!interactive}
                role={interactive ? "button" : "presentation"}
                tabIndex={interactive ? 0 : -1}
                onClick={() => tile.locationId && onTileClick(tile.locationId)}
                onMouseEnter={() => tile.locationId && onTileHover(tile.locationId)}
                onFocus={() => tile.locationId && onTileHover(tile.locationId)}
              >
                <span className="tileIcon" aria-hidden="true">{locationIcon(tile)}</span>
                {tile.locationName && <span className="placeName">{tile.locationName}</span>}
                {tile.searchable && <span className="evidenceDot">{tile.discoveredEvidenceCount}/{tile.evidenceCount}</span>}
                {markers.slice(0, 3).map((marker) => {
                  const state = marker.discovered ? "discovered" : marker.evidenceId ? "searchable" : "public";
                  return (
                    <span
                      key={marker.id}
                      className={`marker marker-${marker.type} marker-${state} ${marker.eventId === highlightedEventId || marker.evidenceId === selectionHighlight?.evidenceId ? "hot" : ""}`}
                      title={marker.label}
                      onClick={(event) => { event.stopPropagation(); onMarkerClick(marker); }}
                    >
                      {markerGlyph[marker.type] || "•"}
                    </span>
                  );
                })}
                <span className="actorStack">
                  {actors.slice(0, 4).map((actor) => {
                    const actorClasses = [
                      "actorPin",
                      `actor-${actor.status}`,
                      selectedCharacterId === actor.id ? "actor-current" : "",
                      selectionHighlight?.characterId === actor.id ? "actor-spotlight" : "",
                      characterState.questionedIds.has(actor.id) ? "actor-questioned" : "",
                      characterState.contradictionIds.has(actor.id) ? "actor-contradiction" : "",
                      characterState.excludedIds.has(actor.id) ? "actor-excluded" : ""
                    ].filter(Boolean).join(" ");
                    return (
                      <span key={actor.id} className={actorClasses} title={`${actor.name} / ${actor.role}`} onClick={(event) => { event.stopPropagation(); onActorClick(actor); }}>
                        {firstGlyph(actor.name)}
                      </span>
                    );
                  })}
                </span>
              </button>
            );
          })}
        </div>
        {hoverInfo && (
          <aside className="locationHoverCard" data-testid="location-hover-card">
            <span className="eyebrow">{hoverInfo.terrain} / {hoverInfo.searchable ? "可搜索" : "公开地点"}</span>
            <strong>{hoverInfo.name}</strong>
            <p>证据进度：{hoverInfo.discovered}/{hoverInfo.total}</p>
            <small>{hoverInfo.recentEvent || "暂无当前时间附近公开事件。"}</small>
            <div className="popoverActions">
              <button type="button" onClick={() => onLocationAction(hoverInfo.locationId)}>{hoverInfo.searchable ? "搜索地点" : "查看地点"}</button>
              <span>{interactiveTargetIds.has(`location:${hoverInfo.locationId}`) ? "可交互" : "仅展示"}</span>
            </div>
          </aside>
        )}
        {npcPopover && (
          <aside className="npcPopoverCard" data-testid="npc-popover-card">
            <span className="eyebrow">{npcPopover.statusLabel}</span>
            <strong>{npcPopover.name}</strong>
            <p>{npcPopover.role}</p>
            <div>
              <span>{npcPopover.questioned ? "已询问" : "未询问"}</span>
              <span>{npcPopover.contradiction ? "矛盾命中" : "暂无矛盾"}</span>
              <span>{npcPopover.excluded ? "已排除" : "待判断"}</span>
            </div>
            <div className="popoverActions">
              <button type="button" onClick={() => onNpcAction(npcPopover.characterId)}>询问 NPC</button>
              <span>{npcPopover.contradiction ? "矛盾命中" : "记忆约束"}</span>
            </div>
          </aside>
        )}
      </section>

      <footer className="timelineScrubber">
        <div className="mapLegend" data-testid="map-legend">
          <span><b>?</b> 可搜索</span>
          <span><b>◆</b> 已发现证据</span>
          <span><b>!</b> 案发/矛盾</span>
          <span><b>✓</b> 已完成线索</span>
          <span><b className="legendNpc">人</b> NPC：白未问 / 绿已问 / 红矛盾 / 灰排除</span>
        </div>
        <div className="scrubLabels"><span>08:00</span><strong>24h 时间轴回放</strong><span>23:00</span></div>
        <button className="replayButton" onClick={() => setReplaying((value) => !value)}>
          {replaying ? <Pause size={14} /> : <Play size={14} />} {replaying ? "Pause Replay" : "Play Replay"}
        </button>
        <input type="range" min={timeMin} max={timeMax} step={10} value={timeValue} onChange={(event) => setTimeValue(Number(event.target.value))} />
        <div className="scrubTicks">
          {["08:00", "12:00", "16:00", "20:00", "21:30", "21:47", "23:00"].map((time) => (
            <button key={time} className={minutesToTime(timeValue) === time ? "active" : ""} onClick={() => setTimeValue(timeToMinutes(time))}>{time}</button>
          ))}
        </div>
      </footer>
    </section>
  );
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

export function AgentControlPanel({
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
  runScenario,
  rollbackSnapshot,
  selectedScenarioRun,
  scenarioReport,
  snapshots,
  selectedSnapshotFromId,
  selectedSnapshotToId,
  setSelectedSnapshotFromId,
  setSelectedSnapshotToId,
  snapshotDiff,
  benchmarkSummary
}: {
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
  runScenario: () => void;
  rollbackSnapshot: (snapshotId: string) => void;
  selectedScenarioRun?: ScenarioRun | null;
  scenarioReport?: ScenarioReport | null;
  snapshots: TownStateSnapshot[];
  selectedSnapshotFromId: string;
  selectedSnapshotToId: string;
  setSelectedSnapshotFromId: (value: string) => void;
  setSelectedSnapshotToId: (value: string) => void;
  snapshotDiff?: TownStateDiff | null;
  benchmarkSummary?: { seedCount: number; passed: number; failed: number; passRate: number; averageQualityScore: number; averageEmergenceScore: number } | null;
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
    "goal-update": "目标",
    "plan-update": "计划",
    "generate-candidates": "候选",
    score: "评分",
    execute: "执行",
    consequence: "后果",
    "candidate-extraction": "成案"
  };
  const runtimePhases = runtime?.simulationPhases?.length ? runtime.simulationPhases : ["observe", "memory-propagation", "goal-update", "generate-candidates", "score", "execute", "consequence", "candidate-extraction"];
  const currentPhase = runtimePhases.length ? runtimePhases[Math.max(0, (runtime?.tick ?? 0) % runtimePhases.length)] : "observe";
  const propagationCount = runtime?.memoryPropagations?.length ?? 0;
  const consequenceCount = runtime?.consequences?.length ?? 0;
  const selectedDecision = selectedAgent?.lastDecisionId ? runtime?.decisionTraces.find((trace) => trace.id === selectedAgent.lastDecisionId) : undefined;
  const selectedConsequences = selectedAgent ? (runtime?.consequences || []).filter((item) => item.npcId === selectedAgent.npcId).slice(-3).reverse() : [];
  const topCandidate = candidates[0];

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
          <button type="button" className="secondaryButton full" onClick={runScenario} disabled={runningBusy}>运行默认场景</button>
          <button type="button" className="secondaryButton full" onClick={copyScenarioReport} disabled={!scenarioReport}>复制报告 JSON</button>
        </div>
        {copyStatus && <small data-testid="scenario-copy-status">{copyStatus}</small>}
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
            <span className={benchmarkSummary.failed === 0 ? "pass" : "fail"}><b>{benchmarkSummary.failed}</b>失败种子</span>
            <span><b>{benchmarkSummary.passed}</b>通过种子</span>
          </div>
        ) : <p>未找到基准报告。运行 <code>npm run benchmark:emergence</code> 会生成 <code>outputs/emergence-benchmark.json</code>，该文件会被 Git 忽略。</p>}
      </section>

      <section className="actionPanel agentStatePanel" id="director-dossier" data-testid="agent-state-panel">
        <h2><Users size={16} /> NPC 档案</h2>
        {selectedAgent ? (
          <article className="worldInspectCard compact">
            <span className="eyebrow">{selectedCharacterName || selectedAgent.npcId}</span>
            <h3>{selectedAgent.currentGoal}</h3>
            <p>{selectedAgent.currentPlan.join(" -> ")}</p>
            <div className="logicBadges">
              <span>优先级: {selectedAgent.goalPriority}</span>
              <span>关系压力: {selectedAgent.relationshipPressure}</span>
              <span>秘密风险: {selectedAgent.secretRisk}</span>
              <span>警觉: {selectedAgent.alertness}</span>
              <span>位置: {selectedAgent.locationId}</span>
              <span>传播记忆: {selectedAgent.propagatedMemoryCount ?? 0}</span>
              <span>最近后果: {selectedAgent.lastConsequence || "无"}</span>
            </div>
            <small>已知事实: {selectedAgent.knownFactIds.slice(-4).join(" / ") || "无"}</small>
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
  runScenario,
  rollbackSnapshot,
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
  benchmarkSummary
}: {
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
  runScenario: () => void;
  rollbackSnapshot: (snapshotId: string) => void;
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
  benchmarkSummary?: { seedCount: number; passed: number; failed: number; passRate: number; averageQualityScore: number; averageEmergenceScore: number } | null;
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
    plan: "计划",
    score: "评分",
    execute: "执行",
    consequence: "后果",
    "candidate-extraction": "成案"
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
  const avatarIndex = Math.abs(Array.from(selectedAgent?.npcId || selectedCharacterId || "0").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 8;
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
        <button type="button" className={`commandPass ${scenarioState}`} onClick={runScenario} disabled={runningBusy}>
          {scenarioReport?.passed ? "基线通过" : "运行基线"} <ShieldCheck size={16} />
        </button>
      </header>

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
            <button type="button" onClick={stepRuntime} disabled={runningBusy || !runtime}>单步</button>
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
            <img src={`/command-center/avatar-${avatarIndex}.webp`} alt="" />
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
              <button type="button" onClick={() => extractCase(candidate)} disabled={runningBusy || !candidate.validation.valid}>抽取可玩案件</button>
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
          <button type="button" onClick={confirmRollback} disabled={!selectedSnapshotFromId || runningBusy}>回滚到起点</button>
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
      </section>
    </main>
  );
}

export function EvidenceNotebookPanel({
  items,
  onAction
}: {
  items: EvidenceNotebookItem[];
  onAction: (item: EvidenceNotebookItem, action: NotebookAction) => void;
}) {
  const discoveredCount = items.filter((item) => item.discovered).length;
  return (
    <section className="actionPanel evidenceNotebookPanel" data-testid="evidence-notebook">
      <div className="panelHeaderLine">
        <h2><FileSearch size={16} /> Evidence Notebook</h2>
        <span>{discoveredCount}/{items.length}</span>
      </div>
      <p>笔记只展示玩家已发现线索的标题、来源和用途；锁定线索不剧透。</p>
      <div className="notebookList">
        {items.map((item) => (
          <article key={item.evidenceId} className={`notebookCard ${item.locked ? "locked" : ""} ${item.isKey && item.discovered ? "keyEvidence" : ""}`}>
            <span className="eyebrow">{item.locked ? "LOCKED" : item.isKey ? "关键线索" : "已发现"}</span>
            <h3>{item.title}</h3>
            <p>{item.useHint}</p>
            {!item.locked && (
              <>
                <div className="notebookMeta">
                  <span>{item.locationName}</span>
                  {item.sourceEventLabel && <span>{item.sourceEventLabel}</span>}
                  {!!item.challengeNpcNames.length && <span>可质询：{item.challengeNpcNames.slice(0, 2).join("、")}</span>}
                </div>
                <div className="notebookTags">
                  {item.supports.slice(0, 3).map((label) => <span key={`s:${item.evidenceId}:${label}`}>支持：{label}</span>)}
                  {item.contradicts.slice(0, 3).map((label) => <span key={`c:${item.evidenceId}:${label}`}>反驳：{label}</span>)}
                </div>
              </>
            )}
            <div className="notebookActions">
              <button type="button" onClick={() => onAction(item, "source")}>{item.locked ? "前往地点" : "查看来源"}</button>
              <button type="button" onClick={() => onAction(item, "challenge")} disabled={item.locked || !item.challengeNpcIds.length}>用于质询</button>
              <button type="button" onClick={() => onAction(item, "chain")} disabled={item.locked}>加入推理链</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CandidatePlayabilityPreview({ candidate }: { candidate: CaseCandidate }) {
  const stages = ["motive", "means", "opportunity", "cover-up", "memory", "exclusion"];
  const complete = stages.filter((stage) => candidate.chainCompleteness?.[stage as CaseChainStage] || candidate.validation.chainCompleteness?.[stage as CaseChainStage] || candidate.chainStageTags?.includes(stage) || candidate.validation.chainStages?.includes(stage));
  return (
    <div className="playabilityPreview" data-testid="playability-preview">
      <strong>Playability Preview</strong>
      <span>{candidate.validation.valid ? "Ready for low-spoiler intake" : "Still forming"}</span>
      <div className="logicBadges">
        <span>{complete.length}/6 chain stages</span>
        <span>{candidate.riskChainEventIds.length} source events</span>
        <span>{candidate.memoryIds.length} memories</span>
        <span>{candidate.validation.failureReasons?.[0] || (candidate.validation.valid ? "extractable" : "validation pending")}</span>
      </div>
    </div>
  );
}

function CaseIntakePanel({
  intake,
  session,
  joinCase,
  onNextAction
}: {
  intake: PlayableCaseIntake;
  session: PlayerSession | null;
  joinCase: () => void;
  onNextAction: (action: PlayableCaseNextAction) => void;
}) {
  const nextAction = intake.nextAction || {
    kind: session ? "review" : "join",
    label: session ? "Review route" : "Join the investigation",
    detail: intake.readiness.summary,
    buttonLabel: session ? "Review route" : "Join investigation"
  } satisfies PlayableCaseNextAction;
  const progress = intake.progress;
  return (
    <section className="actionPanel caseIntakePanel" data-testid="case-intake">
      <div className="panelHeaderLine">
        <div>
          <span className="eyebrow">Emerged from town runtime</span>
          <h2><GitBranch size={16} /> Case Intake</h2>
        </div>
        <span className={`runtimePill ${intake.readiness.status}`}>{intake.readiness.score}%</span>
      </div>
      <p>{intake.readiness.summary}</p>
      <article className="caseIntakeNext" data-testid="case-intake-next-action">
        <span>Next action</span>
        <strong>{nextAction.label}</strong>
        <small>{nextAction.detail}</small>
        <button
          type="button"
          className="primaryButton full"
          data-testid="case-intake-next"
          onClick={() => nextAction.kind === "join" ? joinCase() : onNextAction(nextAction)}
        >
          {nextAction.buttonLabel}
        </button>
      </article>
      {progress && (
        <div className="caseIntakeProgress" data-testid="case-intake-progress">
          <span><b>{progress.currentStage}</b>stage</span>
          <span><b>{progress.discoveredEvidence}/{progress.totalEvidence}</b>evidence</span>
          <span><b>{progress.questionedWitnesses}/{progress.totalWitnesses}</b>witnesses</span>
          <span><b>{progress.challengeReadyCount}</b>challenges ready</span>
          <span><b>{progress.submitReady ? "ready" : "not ready"}</b>submit</span>
        </div>
      )}
      {intake.proofCoverage && (
        <div className="caseIntakeProgress proofCoverage" data-testid="case-intake-proof-coverage">
          <span><b>{intake.proofCoverage.coveredRequired}/{intake.proofCoverage.totalRequired}</b>ledger coverage</span>
          <span><b>{Math.round(intake.proofCoverage.coverageRatio * 100)}%</b>proof</span>
          <span><b>{intake.proofCoverage.gaps.length}</b>proof gaps</span>
        </div>
      )}
      {intake.routeCertificate && (
        <div className="caseIntakeProgress routeCertificate" data-testid="case-intake-route-certificate">
          <span><b>{intake.routeCertificate.routeCertified ? "certified" : "blocked"}</b>route</span>
          <span><b>{intake.routeCertificate.routeStepCount}</b>steps</span>
          <span><b>{intake.routeCertificate.coveredRequiredObligations}/{intake.routeCertificate.totalRequiredObligations}</b>obligations</span>
          <span><b>{intake.routeCertificate.blockers.length}</b>blockers</span>
        </div>
      )}
      {intake.routeIntegrity && (
        <div className={`routeIntegrity ${intake.routeIntegrity.playable ? "pass" : "fail"}`} data-testid="case-route-integrity">
          <span>{intake.routeIntegrity.playable ? "Route complete" : "Route blocked"}</span>
          <small>
            motive {intake.routeIntegrity.criticalCoverage.motive ? "ok" : "gap"} / means {intake.routeIntegrity.criticalCoverage.means ? "ok" : "gap"} / opportunity {intake.routeIntegrity.criticalCoverage.opportunity ? "ok" : "gap"} / exclusion {intake.routeIntegrity.criticalCoverage.exclusion ? "ok" : "gap"}
            {typeof intake.routeIntegrity.proofLedgerValid === "boolean" ? ` / ledger ${intake.routeIntegrity.proofLedgerValid ? "ok" : "gap"}` : ""}
            {typeof intake.routeIntegrity.routeCertified === "boolean" ? ` / certificate ${intake.routeIntegrity.routeCertified ? "ok" : "gap"}` : ""}
          </small>
        </div>
      )}
      <div className="reviewMetricGrid compact">
        <span><b>{intake.sourceCounts.events}</b>source events</span>
        <span><b>{intake.sourceCounts.memories}</b>memories</span>
        <span><b>{intake.sourceCounts.observations}</b>observations</span>
        <span><b>{intake.sourceCounts.discoveredEvidence}/{intake.sourceCounts.totalEvidence}</b>evidence</span>
      </div>
      <div className="questChain intakeChain" data-testid="case-intake-chain">
        {intake.chainStages.map((stage) => <span key={stage.id} className={stage.complete ? "on" : ""}>{stage.label}</span>)}
      </div>
      <div className="caseIntakeGrid">
        <section>
          <strong>Investigation route</strong>
          {(intake.progressStages || intake.starterTasks).slice(0, 5).map((task) => (
            <article key={task.id} className={task.complete ? "complete" : task.locked ? "locked" : ""}>
              <span>{task.complete ? "Done" : task.locked ? "Locked" : "Next"}</span>
              <b>{task.title}</b>
              <small>{task.detail}</small>
            </article>
          ))}
        </section>
        <section>
          <strong>Evidence route</strong>
          {intake.evidenceRoute.slice(0, 5).map((item) => (
            <article key={item.id} className={item.discovered ? "complete" : ""}>
              <span>{item.discovered ? "Found" : item.isKey ? "Key clue" : "Support"}</span>
              <b>{item.locationName}</b>
              <small>{item.hint}</small>
            </article>
          ))}
        </section>
        <section>
          <strong>Witness plan</strong>
          {intake.witnessPlan.slice(0, 4).map((item) => (
            <article key={item.characterId} className={item.challengeReady ? "ready" : item.questioned ? "complete" : ""}>
              <span>{item.challengeReady ? "Challenge ready" : item.questioned ? "Questioned" : "Question"}</span>
              <b>{item.characterName}</b>
              <small>{item.hint}</small>
            </article>
          ))}
        </section>
      </div>
      {!!intake.spoilerSafeGaps.length && (
        <div className="caseIntakeGaps" data-testid="case-intake-gaps">
          {intake.spoilerSafeGaps.slice(0, 4).map((gap, index) => <span key={`${index}:${gap}`}>{gap}</span>)}
        </div>
      )}
      <div className="sourceTrail" data-testid="case-intake-source-trail">
        {intake.sourceTrail.slice(0, 6).map((item) => (
          <article key={item.id} className={item.hidden ? "locked" : ""}>
            <span>{item.kind}</span>
            <b>{item.label}</b>
            <small>{item.detail}</small>
          </article>
        ))}
      </div>
      {!session && <button type="button" className="primaryButton full" data-testid="case-intake-join" onClick={joinCase}>Join investigation</button>}
      {session && <small className="sourceBackedPill" data-testid="source-backed-case">source-backed / emerged from town runtime</small>}
    </section>
  );
}

export function InvestigationPanel({
  playableIntake,
  onIntakeNextAction,
  notebookItems,
  onNotebookAction,
  selectedSceneName,
  sceneEvidence,
  discoveredEvidence,
  discoveredIds,
  evidenceImpacts,
  discoverEvidence,
  session,
  characters,
  selectedCharacterId,
  setSelectedCharacterId,
  selectedEvidenceId,
  setSelectedEvidenceId,
  selectedTestimony,
  question,
  setQuestion,
  interrogate,
  aiSafety,
  memoryCount,
  evidenceCount,
  contradictionHit,
  dialogueLog,
  deductionCase,
  theory,
  setTheory,
  playerTheoryEvidence,
  toggleTheoryEvidence,
  submitTheory,
  revealSolution,
  revealText,
  judgementGaps,
  gapCards,
  onGapSelect,
  nextStepAdvice,
  joinCase,
  busy
}: {
  playableIntake?: PlayableCaseIntake | null;
  onIntakeNextAction: (action: PlayableCaseNextAction) => void;
  notebookItems: EvidenceNotebookItem[];
  onNotebookAction: (item: EvidenceNotebookItem, action: NotebookAction) => void;
  selectedSceneName: string;
  sceneEvidence: Evidence[];
  discoveredEvidence: Evidence[];
  discoveredIds: Set<string>;
  evidenceImpacts: Map<string, EvidenceImpact>;
  discoverEvidence: (evidenceId: string) => void;
  session: PlayerSession | null;
  characters: DeductionCase["characters"];
  selectedCharacterId: string;
  setSelectedCharacterId: (value: string) => void;
  selectedEvidenceId: string;
  setSelectedEvidenceId: (value: string) => void;
  selectedTestimony?: { currentStatement: string };
  question: string;
  setQuestion: (value: string) => void;
  interrogate: () => void;
  aiSafety: AiSafetyView | null;
  memoryCount: number;
  evidenceCount: number;
  contradictionHit: boolean;
  dialogueLog: PlayerSession["interrogationLog"];
  deductionCase: DeductionCase | null;
  theory: PlayerTheory;
  setTheory: (updater: (current: PlayerTheory) => PlayerTheory) => void;
  playerTheoryEvidence: Set<string>;
  toggleTheoryEvidence: (evidenceId: string) => void;
  submitTheory: () => void;
  revealSolution: () => void;
  revealText: string;
  judgementGaps: string[];
  gapCards: GapCard[];
  onGapSelect: (card: GapCard) => void;
  nextStepAdvice?: string;
  joinCase: () => void;
  busy: boolean;
}) {
  return (
    <div className="stackedInspector">
      {playableIntake && <CaseIntakePanel intake={playableIntake} session={session} joinCase={joinCase} onNextAction={onIntakeNextAction} />}
      <EvidenceNotebookPanel items={notebookItems} onAction={onNotebookAction} />
      <section className="actionPanel">
        <h2><FileSearch size={16} /> 地点与证据</h2>
        <p>{selectedSceneName || "选择地图地点"}</p>
        <div className="evidenceList">
          {sceneEvidence.map((item) => {
            const impact = evidenceImpacts.get(item.id);
            return (
              <button key={item.id} className={discoveredIds.has(item.id) ? "found" : ""} onClick={() => discoverEvidence(item.id)} disabled={!session || !item.discoverable || discoveredIds.has(item.id) || busy}>
                <strong>{discoveredIds.has(item.id) ? item.title : item.discoverable ? "未发现线索" : "公开现场记录"}</strong>
                <span>{discoveredIds.has(item.id) ? item.visibleDescription : item.discoverable ? `${selectedSceneName} 中可能存在调查价值。` : item.visibleDescription}</span>
                {discoveredIds.has(item.id) && impact && (
                  <small className={`evidenceImpact impact-${impact.tone}`} data-testid="evidence-use-hint">
                    {impact.label}：{impact.detail}
                  </small>
                )}
              </button>
            );
          })}
          {!sceneEvidence.length && <span className="emptyText">该地点暂无可发现证据。</span>}
        </div>
      </section>

      <section className="actionPanel">
        <h2><MessageSquare size={16} /> NPC 询问</h2>
        <label>角色
          <select value={selectedCharacterId} onChange={(event) => setSelectedCharacterId(event.target.value)}>
            {characters.map((character) => <option key={character.id} value={character.id}>{character.name} - {character.role}</option>)}
          </select>
        </label>
        <label>出示证据
          <select value={selectedEvidenceId} onChange={(event) => setSelectedEvidenceId(event.target.value)}>
            <option value="">不出示证据</option>
            {discoveredEvidence.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
        {selectedTestimony && <div className="testimonyBox"><span>当前证词</span><p>{selectedTestimony.currentStatement}</p></div>}
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} />
        <button className="primaryButton full" onClick={interrogate} disabled={!session || !selectedCharacterId || busy}><Bot size={16} /> 询问 NPC</button>
        <div className={`aiSafetyStrip ${aiSafety?.promptAudit?.safe === false ? "unsafe" : "safe"}`}>
          <span>Prompt Safe: {aiSafety?.promptAudit?.safe === false ? "No" : "Yes"}</span>
          <span>Memory: {aiSafety?.memoryCount ?? memoryCount}</span>
          <span>Evidence: {aiSafety?.evidenceCount ?? evidenceCount}</span>
          <span>Contradiction: {contradictionHit ? "Hit" : "None"}</span>
          {!!aiSafety?.safetyFlags?.length && <span>Flags: {aiSafety.safetyFlags.join(", ")}</span>}
        </div>
        <div className="dialogueLog">
          {dialogueLog.slice(-2).reverse().map((entry) => (
            <article key={entry.id} className={entry.challenge?.hit ? "challengeHit" : ""}>
              <p><strong>{deductionCase?.characters.find((item) => item.id === entry.characterId)?.name || entry.characterId}</strong><span>{entry.evidenceId ? `出示 ${entry.evidenceId}` : "普通询问"}</span></p>
              {entry.challenge?.hit && <small className="challengeBadge">命中证词矛盾：只暴露局部事实，不泄露真相</small>}
              <blockquote>{entry.answer}</blockquote>
            </article>
          ))}
        </div>
      </section>

      <section className="actionPanel">
        <h2><Gavel size={16} /> 提交推理</h2>
        <label>凶手
          <select data-testid="theory-culprit" value={theory.culpritId} onChange={(event) => setTheory((current) => ({ ...current, culpritId: event.target.value }))}>
            <option value="">选择嫌疑人</option>
            {characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
          </select>
        </label>
        <textarea placeholder="动机" value={theory.motive} onChange={(event) => setTheory((current) => ({ ...current, motive: event.target.value }))} />
        <textarea placeholder="手法" value={theory.method} onChange={(event) => setTheory((current) => ({ ...current, method: event.target.value }))} />
        <div className="checkList" data-testid="theory-evidence-list">
          {discoveredEvidence.map((item) => (
            <label className="checkRow" key={item.id}><input type="checkbox" checked={playerTheoryEvidence.has(item.id)} onChange={() => toggleTheoryEvidence(item.id)} />{item.title}</label>
          ))}
        </div>
        <button data-testid="submit-theory" className="primaryButton full" onClick={submitTheory} disabled={!session || busy}><ShieldCheck size={16} /> 判定推理</button>
        {session?.judgement && (
          <div className={`judgement ${session.judgement.accepted ? "pass" : "fail"}`} data-testid="judgement-result">
            <strong>{session.judgement.accepted ? "推理成立" : "推理不成立"}</strong>
            {session.judgement.accepted ? <p>{session.judgement.explanation}</p> : (
              <div className="gapHints" data-testid="theory-gap-cards">
                <span>缺口类型：</span>
                {(gapCards.length ? gapCards : judgementGaps.map((item, index) => ({ id: `${item}-${index}`, label: item, detail: "补齐这部分后再提交推理。", target: "logic" as const }))).map((item) => (
                  <button key={item.id} type="button" className="gapCard" onClick={() => onGapSelect(item)}>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </button>
                ))}
              </div>
            )}
            {!session.judgement.accepted && nextStepAdvice && (
              <article className="nextStepAdvice" data-testid="next-step-advice">
                <strong>下一步建议</strong>
                <span>{nextStepAdvice}</span>
              </article>
            )}
            <button className="secondaryButton" onClick={revealSolution} disabled={!session.judgement.accepted || busy}>生成解答篇</button>
          </div>
        )}
        {revealText && <pre className="revealBox">{revealText}</pre>}
      </section>
    </div>
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
