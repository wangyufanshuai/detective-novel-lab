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
import type { ReactNode } from "react";
import type {
  CaseLogicReport,
  CaseTemplateId,
  CaseCandidate,
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
  PlayerSession,
  PlayerTheory,
  PersistentTownRuntime,
  ProofTourStep,
  ProofViewMode,
  RuntimeMode,
  SuspectBoardRow,
  TownEmergenceQueue,
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

type CaseTemplateOption = { id: CaseTemplateId; title: string; description?: string };
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
  extractCase
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
  interveneAgent: () => void;
  extractCase: (candidate: CaseCandidate) => void;
}) {
  const candidates = queue?.candidates || [];
  return (
    <div className="stackedInspector persistentTownPanel" data-testid="persistent-town-panel">
      <section className="actionPanel">
        <div className="panelHeaderLine">
          <h2><Network size={16} /> Persistent Agent Town</h2>
          <span className={`runtimePill ${runtime?.status || "paused"}`}>{runtime?.status || "not started"}</span>
        </div>
        <p>NPCs observe, update memory, score legal actions, write WorldEvents, then generate case candidates.</p>
        <div className="logicBadges">
          <span>Tick: {runtime?.tick ?? 0}</span>
          <span>Time: {runtime?.currentDay ?? 1} / {runtime?.currentTime || "--:--"}</span>
          <span>Agents: {runtime?.agentStates.length ?? 0}</span>
          <span>Candidates: {candidates.length}</span>
          <span>Valid: {queue?.validCount ?? 0}</span>
        </div>
        <div className="townRuntimeActions">
          <button type="button" className="primaryButton compact" onClick={startRuntime} disabled={runningBusy}>Start</button>
          <button type="button" onClick={pauseRuntime} disabled={runningBusy || !runtime}>Pause</button>
          <button type="button" onClick={stepRuntime} disabled={runningBusy || !runtime}>Step</button>
          <button type="button" onClick={resetRuntime} disabled={runningBusy || !runtime}>Reset</button>
        </div>
        <small>{queue?.nextAction || "Start the runtime to build an emergence queue."}</small>
      </section>

      <section className="actionPanel agentStatePanel" data-testid="agent-state-panel">
        <h2><Users size={16} /> Agent State</h2>
        {selectedAgent ? (
          <article className="worldInspectCard compact">
            <span className="eyebrow">{selectedCharacterName || selectedAgent.npcId}</span>
            <h3>{selectedAgent.currentGoal}</h3>
            <p>{selectedAgent.currentPlan.join(" -> ")}</p>
            <div className="logicBadges">
              <span>Priority: {selectedAgent.goalPriority}</span>
              <span>Pressure: {selectedAgent.relationshipPressure}</span>
              <span>Secret risk: {selectedAgent.secretRisk}</span>
              <span>Alert: {selectedAgent.alertness}</span>
              <span>Location: {selectedAgent.locationId}</span>
            </div>
            <small>Known facts: {selectedAgent.knownFactIds.slice(-4).join(" / ") || "none"}</small>
            <button type="button" className="secondaryButton full" onClick={interveneAgent} disabled={runningBusy}>Apply resource intervention</button>
          </article>
        ) : <p>Select an NPC on the map or suspect board to inspect agent state.</p>}
        <div className="simulationCandidateList" data-testid="agent-action-candidates">
          {selectedAgentCandidates.slice(0, 5).map((candidate) => (
            <article key={candidate.id} className={candidate.legal ? "source" : "gap"}>
              <strong>{candidate.kind}: {candidate.description}</strong>
              <span>Score {candidate.score.total} / target {candidate.targetLocationId}</span>
              <small>{candidate.legal ? candidate.score.reasons.join(" / ") || "legal action" : candidate.blockedReason || "blocked by local rules"}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="actionPanel emergenceQueuePanel" data-testid="emergence-queue">
        <h2><GitBranch size={16} /> Emergence Queue</h2>
        {!candidates.length && <p>No case candidates yet. Step the runtime until pressure chains form.</p>}
        {candidates.slice(0, 5).map((candidate) => (
          <article key={candidate.id} className={`candidateCard ${candidate.validation.valid ? "pass" : "fail"}`}>
            <div className="panelHeaderLine">
              <strong>{candidate.culpritId} {"->"} {candidate.victimId}</strong>
              <span>{candidate.status}</span>
            </div>
            <p>Pressure {candidate.pressureScore}; events {candidate.riskChainEventIds.length}; memories {candidate.memoryIds.length}</p>
            <div className="logicBadges">
              <span>WorldEvent: {candidate.validation.worldBackedEvidence ? "Yes" : "No"}</span>
              <span>Memory: {candidate.validation.memoryScopedTestimony ? "Yes" : "No"}</span>
              <span>Timeline: {candidate.validation.timelineClosed ? "Yes" : "No"}</span>
              <span>Hard logic: {candidate.validation.hardLogicValid ? "Pass" : "Pending"}</span>
            </div>
            {!!candidate.validation.errors.length && <small>{candidate.validation.errors.slice(0, 2).join(" / ")}</small>}
            <button type="button" className="secondaryButton full" onClick={() => extractCase(candidate)} disabled={runningBusy}>
              Extract playable case
            </button>
          </article>
        ))}
      </section>
    </div>
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

export function InvestigationPanel({
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
  busy
}: {
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
  busy: boolean;
}) {
  return (
    <div className="stackedInspector">
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
          <select value={theory.culpritId} onChange={(event) => setTheory((current) => ({ ...current, culpritId: event.target.value }))}>
            <option value="">选择嫌疑人</option>
            {characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
          </select>
        </label>
        <textarea placeholder="动机" value={theory.motive} onChange={(event) => setTheory((current) => ({ ...current, motive: event.target.value }))} />
        <textarea placeholder="手法" value={theory.method} onChange={(event) => setTheory((current) => ({ ...current, method: event.target.value }))} />
        <div className="checkList">
          {discoveredEvidence.map((item) => (
            <label className="checkRow" key={item.id}><input type="checkbox" checked={playerTheoryEvidence.has(item.id)} onChange={() => toggleTheoryEvidence(item.id)} />{item.title}</label>
          ))}
        </div>
        <button className="primaryButton full" onClick={submitTheory} disabled={!session || busy}><ShieldCheck size={16} /> 判定推理</button>
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
