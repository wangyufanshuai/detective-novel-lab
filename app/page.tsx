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
import { useEffect, useMemo, useState } from "react";
import type {
  CaseFromLog,
  CaseLogicReport,
  DeductionGraph,
  DeepSeekLiveEvalReport,
  MurderArchetype,
  NpcDialogueEvalReport,
  PlayerSession,
  PlayerTheory,
  PromptAuditReport,
  RevealEvalReport,
  RevealFactContract,
  SuspectBoardRow,
  WorldEvent,
  WorldMapActor,
  WorldMapMarker,
  WorldMapSnapshot,
  WorldMapTile,
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

const storageKey = "detective-town-showcase-v2";
const timeMin = 8 * 60;
const timeMax = 23 * 60;
const archetypeOptions: { value: MurderArchetype | "auto"; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "blade", label: "Blade" },
  { value: "poison", label: "Poison" },
  { value: "blunt", label: "Blunt" },
  { value: "fall", label: "Fall" }
];
const archetypeLabels: Record<string, string> = {
  blade: "刀具伪装",
  poison: "药物投毒",
  blunt: "钝器误导",
  fall: "坠落机关"
};

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

export default function Home() {
  const [world, setWorld] = useState<WorldState | null>(null);
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [activeCase, setActiveCase] = useState<CaseFromLog | null>(null);
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [sessions, setSessions] = useState<PlayerSession[]>([]);
  const [snapshot, setSnapshot] = useState<WorldMapSnapshot | null>(null);
  const [worldIdInput, setWorldIdInput] = useState("");
  const [seedInput, setSeedInput] = useState("showcase-seed");
  const [caseMode, setCaseMode] = useState<CaseMode>("premium");
  const [caseArchetype, setCaseArchetype] = useState<MurderArchetype | "auto">("auto");
  const [mode, setMode] = useState<WorldMode>("showcase");
  const [playerName, setPlayerName] = useState("调查员");
  const [timeValue, setTimeValue] = useState(21 * 60 + 30);
  const [selectedSceneId, setSelectedSceneId] = useState("");
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState("");
  const [highlightedEventId, setHighlightedEventId] = useState("");
  const [question, setQuestion] = useState("案发窗口你在哪里？你记得哪些异常？");
  const [theory, setTheory] = useState<PlayerTheory>({ culpritId: "", motive: "", method: "", evidenceIds: [] });
  const [status, setStatus] = useState("创建一个 8 NPC / 24h Detective Town，小镇会先运行，再从事件日志中抽取案件。");
  const [revealText, setRevealText] = useState("");
  const [lastAiSafety, setLastAiSafety] = useState<AiSafetyState | null>(null);
  const [latestLiveEval, setLatestLiveEval] = useState<DeepSeekLiveEvalReport | null>(null);
  const [deductionGraph, setDeductionGraph] = useState<DeductionGraph | null>(null);
  const [suspectBoard, setSuspectBoard] = useState<SuspectBoardRow[]>([]);
  const [logicReport, setLogicReport] = useState<CaseLogicReport | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [developerOpen, setDeveloperOpen] = useState(false);

  const deductionCase = activeCase?.deductionCase || null;
  const scenes = deductionCase?.scenes || [];
  const characters = deductionCase?.characters.filter((character) => character.role !== "死者") || [];
  const discovered = new Set(session?.discoveredEvidenceIds || []);
  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) || scenes[0];
  const selectedCharacter = characters.find((character) => character.id === selectedCharacterId);
  const sceneEvidence = selectedScene ? deductionCase?.evidence.filter((item) => selectedScene.evidenceIds.includes(item.id)) || [] : [];
  const discoveredEvidence = deductionCase?.evidence.filter((item) => discovered.has(item.id)) || [];
  const playerTheoryEvidence = useMemo(() => new Set(theory.evidenceIds), [theory.evidenceIds]);
  const selectedTestimony = activeCase?.testimonies?.find((item) => item.characterId === selectedCharacterId);
  const quality = activeCase?.qualityReport;
  const selectedNpcMemories = useMemo(() => (world?.memories || []).filter((memory) => memory.npcId === selectedCharacterId), [world?.memories, selectedCharacterId]);
  const visibleEvents = snapshot?.visibleEvents || events.slice(-30).reverse();
  const selectedEvent = events.find((event) => event.id === highlightedEventId);
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
          createTown: { method: "POST", url: "/api/v1/command/town/create", body: { seed: seedInput, mode, caseMode, npcCount: mode === "advanced" ? 30 : 8, timelineHours: mode === "advanced" ? 120 : 24, caseArchetype } },
          mapSnapshot: world ? { method: "GET", url: `/api/v1/query/world/map?worldId=${world.id}&caseId=${activeCase?.id || ""}&sessionId=${session?.id || ""}&day=1&time=${minutesToTime(timeValue)}` } : null,
          deductionGraph: activeCase ? { method: "GET", url: `/api/v1/query/case/deduction-graph?caseId=${activeCase.id}` } : null,
          interrogate: session ? { method: "POST", url: "/api/v1/command/investigation/interrogate", body: { sessionId: session.id, characterId: selectedCharacterId, question, evidenceId: selectedEvidenceId || undefined } } : null
        },
        null,
        2
      ),
    [activeCase?.id, caseArchetype, caseMode, mode, question, seedInput, selectedCharacterId, selectedEvidenceId, session?.id, timeValue, world]
  );

  useEffect(() => {
    const saved = loadLocal<{ worldId?: string; sessionId?: string }>(storageKey, {});
    if (saved.worldId) setWorldIdInput(saved.worldId);
    fetch(apiUrl("/api/ai/live-eval/latest"))
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.ok) setLatestLiveEval(data.report);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!world) {
      setSnapshot(null);
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
  }, [activeCase?.id, session?.id, timeValue, world]);

  useEffect(() => {
    if (!activeCase?.id) {
      setDeductionGraph(null);
      setSuspectBoard([]);
      setLogicReport(null);
      return;
    }
    getV1<{ graph: DeductionGraph; suspectBoard: SuspectBoardRow[]; logicReport: CaseLogicReport }>(`/api/v1/query/case/deduction-graph?caseId=${activeCase.id}`)
      .then((data) => {
        setDeductionGraph(data.graph);
        setSuspectBoard(data.suspectBoard);
        setLogicReport(data.logicReport);
      })
      .catch(() => undefined);
  }, [activeCase?.id]);

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

  function persist(nextWorldId?: string, nextSessionId?: string) {
    localStorage.setItem(storageKey, JSON.stringify({ worldId: nextWorldId || world?.id, sessionId: nextSessionId || session?.id }));
  }

  function hydrateCase(data: { world: WorldState; events?: WorldEvent[]; activeCase?: CaseFromLog; sessions?: PlayerSession[] }) {
    setWorld(data.world);
    if (data.events) setEvents(data.events);
    if (data.activeCase) {
      setActiveCase(data.activeCase);
      setSelectedSceneId(data.activeCase.generationProfile.sceneLocationId);
      const firstCharacter = data.activeCase.deductionCase.characters.find((item) => item.role !== "死者");
      setSelectedCharacterId(firstCharacter?.id || data.activeCase.generationProfile.culpritId);
      setTheory({ culpritId: "", motive: "", method: "", evidenceIds: [] });
      setTimeValue(timeToMinutes("21:30"));
    }
    if (data.sessions) setSessions(data.sessions);
  }

  async function createWorld() {
    setBusy(true);
    try {
      const data = await postJson<{ world: WorldState; events: WorldEvent[]; activeCase: CaseFromLog }>("/api/worlds/create", {
        seed: seedInput.trim() || (caseMode === "premium" ? "premium-showcase" : "showcase-seed"),
        mode,
        caseMode: mode === "showcase" ? caseMode : "generated",
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
    setBusy(true);
    try {
      const data = await postJson<{ session: PlayerSession }>("/api/players/join", { worldId: world.id, caseId: activeCase.id, displayName: playerName.trim() || "调查员" });
      setSession(data.session);
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
    if (!session) {
      setStatus("请先加入调查，再搜索证据。");
      return;
    }
    setBusy(true);
    try {
      const data = await postJson<{ session: PlayerSession }>("/api/investigation/discover", { sessionId: session.id, evidenceId });
      setSession(data.session);
      setSelectedEvidenceId(evidenceId);
      setStatus(`发现证据：${deductionCase?.evidence.find((item) => item.id === evidenceId)?.title || evidenceId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "搜索证据失败");
    } finally {
      setBusy(false);
    }
  }

  async function discoverFirstSceneEvidence(sceneId: string) {
    setSelectedSceneId(sceneId);
    const scene = scenes.find((item) => item.id === sceneId);
    const target = scene?.evidenceIds.find((id) => !discovered.has(id)) || scene?.evidenceIds[0];
    if (target) await discoverEvidence(target);
  }

  async function interrogate() {
    if (!session || !selectedCharacterId || !question.trim()) return;
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
      setLastAiSafety({ mock: data.mock, promptAudit: data.promptAudit, dialogueEval: data.dialogueEval, safetyFlags: data.safetyFlags, memoryCount: data.memoryCount, evidenceCount: data.evidenceCount });
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
    setBusy(true);
    try {
      const data = await postJson<{ judgement: PlayerSession["judgement"]; session: PlayerSession }>("/api/investigation/submit-theory", { sessionId: session.id, theory });
      setSession(data.session);
      setStatus(data.judgement?.accepted ? "推理成立。可以生成解答篇。" : `推理不成立：${data.judgement?.missing?.join("、") || "证据链不足"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "提交推理失败");
    } finally {
      setBusy(false);
    }
  }

  async function revealSolution() {
    if (!session?.judgement?.accepted) return;
    setBusy(true);
    try {
      const data = await postJson<{ content: string; revealEval: RevealEvalReport; factContract: RevealFactContract; mock: boolean }>("/api/investigation/reveal", { sessionId: session.id });
      setRevealText(data.content);
      setLastAiSafety((current) => ({ ...(current || {}), revealEval: data.revealEval, factContract: data.factContract, mock: data.mock }));
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
    if (marker.eventId) setHighlightedEventId(marker.eventId);
    if (marker.evidenceId) {
      setSelectedEvidenceId(marker.evidenceId);
      if (!marker.discovered) void discoverEvidence(marker.evidenceId);
    }
    setSelectedSceneId(marker.locationId);
  }

  function handleActor(actor: WorldMapActor) {
    setSelectedCharacterId(actor.id);
    setSelectedSceneId(actor.locationId);
    setQuestion(`${actor.name}，案发窗口你在哪里？你记得哪些异常？`);
  }

  return (
    <main className="pixelShell">
      <aside className="controlRail">
        <div className="brandBlock">
          <div className="brandIcon"><MapIcon size={24} /></div>
          <div>
            <p>Detective Town</p>
            <h1>推理小镇</h1>
          </div>
        </div>

        <section className="railPanel">
          <h2>创建 / 载入</h2>
          <label>Seed<input value={seedInput} onChange={(event) => setSeedInput(event.target.value)} /></label>
          <label>Case Mode
            <select value={caseMode} onChange={(event) => setCaseMode(event.target.value as CaseMode)} disabled={mode === "advanced"}>
              <option value="premium">Premium hard case</option>
              <option value="generated">Generated case</option>
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
          <button className="primaryButton full" onClick={createWorld} disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />} Create Detective Town</button>
          <div className="inputLine">
            <input value={worldIdInput} onChange={(event) => setWorldIdInput(event.target.value)} placeholder="world id" />
            <button className="iconButton" onClick={loadWorld} disabled={busy}><Search size={16} /></button>
          </div>
        </section>

        <section className="railPanel">
          <h2>调查员</h2>
          <label>玩家名<input value={playerName} onChange={(event) => setPlayerName(event.target.value)} /></label>
          <button className="secondaryButton full" onClick={joinCase} disabled={busy || !world || !activeCase}><Users size={16} /> 加入调查</button>
          <button className="secondaryButton full" onClick={tickWorld} disabled={busy || !world}><Clock size={16} /> 推进小镇</button>
        </section>

        <section className="caseCard">
          <p>{world?.name || "未创建小镇"}</p>
          <h2>{activeCase?.deductionCase.title || "Detective Town Showcase"}</h2>
          <span>{activeCase ? archetypeLabels[activeCase.generationProfile.archetype] : "等待生成案件"}</span>
          <div className="metricGrid">
            <div><strong>{quality?.qualityScore ?? quality?.score ?? 0}</strong><small>Quality</small></div>
            <div><strong>{quality?.uniqueCulprit ? "Yes" : "No"}</strong><small>Unique</small></div>
            <div><strong>{quality?.logicStrength ?? logicReport?.logicStrength ?? 0}</strong><small>Logic</small></div>
            <div><strong>{quality?.misdirectionQuality ?? logicReport?.misdirectionQuality ?? 0}</strong><small>Misdirect</small></div>
            <div><strong>{session?.discoveredEvidenceIds.length || 0}/{deductionCase?.evidence.length || 0}</strong><small>Evidence</small></div>
            <div><strong>{latestLiveEval?.passed === false ? "Fail" : latestLiveEval ? "Pass" : "Local"}</strong><small>AI Eval</small></div>
          </div>
        </section>

        <div className="statusBox"><AlertTriangle size={16} /><span>{status}</span></div>
      </aside>

      <section className="mapStage">
        <header className="stageTopbar">
          <div>
            <p>WorldEvent sourced case simulation</p>
            <h2>{activeCase?.deductionCase.publicCaseFile || "创建小镇后，案件会从 NPC 日程、记忆、冲突和事件日志中涌现。"}</h2>
          </div>
          <div className="timeBadge">{snapshot?.time || minutesToTime(timeValue)}</div>
        </header>

        <section className="pixelMapWrap">
          <div className="pixelMap" style={{ gridTemplateColumns: `repeat(${snapshot?.width || 28}, minmax(18px, 1fr))` }}>
            {(snapshot?.tiles || []).map((tile: WorldMapTile) => {
              const actors = mapActorsByTile.get(`${tile.x}:${tile.y}`) || [];
              const markers = mapMarkersByTile.get(`${tile.x}:${tile.y}`) || [];
              const selected = tile.locationId && tile.locationId === selectedSceneId;
              return (
                <button
                  key={tile.id}
                  className={`mapTile terrain-${tile.terrain} ${tile.searchable ? "searchable" : ""} ${selected ? "selected" : ""}`}
                  title={tile.locationName || tile.terrain}
                  onClick={() => tile.locationId && void discoverFirstSceneEvidence(tile.locationId)}
                >
                  {tile.locationName && <span className="placeName">{tile.locationName}</span>}
                  {tile.searchable && <span className="evidenceDot">{tile.discoveredEvidenceCount}/{tile.evidenceCount}</span>}
                  {markers.slice(0, 3).map((marker) => (
                    <span key={marker.id} className={`marker marker-${marker.type} ${marker.eventId === highlightedEventId ? "hot" : ""}`} onClick={(event) => { event.stopPropagation(); handleMarker(marker); }}>◆</span>
                  ))}
                  <span className="actorStack">
                    {actors.slice(0, 4).map((actor) => (
                      <span key={actor.id} className={`actorPin actor-${actor.status}`} onClick={(event) => { event.stopPropagation(); handleActor(actor); }}>{actorInitial(actor.name)}</span>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <footer className="timelineScrubber">
          <div className="scrubLabels"><span>08:00</span><strong>24h 时间轴回放</strong><span>23:00</span></div>
          <button className="replayButton" onClick={() => setReplaying((value) => !value)} disabled={!world}>
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

      <aside className="eventRail">
        <section className="eventPanel">
          <h2><Clock size={16} /> WorldEvent Log</h2>
          <div className="eventList">
            {visibleEvents.map((event) => (
              <button key={event.id} className={`eventRow ${event.id === highlightedEventId ? "selected" : ""}`} onClick={() => { setHighlightedEventId(event.id); setSelectedSceneId(event.locationId); setTimeValue(timeToMinutes(event.time)); }}>
                <time>第{event.day}日 {event.time}</time>
                <strong>{event.publicSummary}</strong>
                <span>{event.type} / {event.locationId}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="actionPanel logicPanel">
          <h2><ShieldCheck size={16} /> Case Logic Report</h2>
          <p>{logicReport?.summary || "Create a case to inspect hard logic."}</p>
          <div className="logicBadges">
            <span>Graph: {logicReport?.deductionGraphComplete ? "Pass" : "Pending"}</span>
            <span>Unique: {logicReport?.uniqueCulprit ? "Yes" : "No"}</span>
            <span>Fair: {logicReport?.fairPlay ? "Yes" : "No"}</span>
            <span>Excluded: {logicReport?.allNonCulpritsExplainablyExcluded ? "Yes" : "No"}</span>
          </div>
        </section>

        <section className="actionPanel deductionGraphPanel">
          <h2><Database size={16} /> Deduction Graph</h2>
          <div className="graphRail">
            {(deductionGraph?.nodes || []).filter((node) => node.type !== "event").slice(0, 14).map((node) => (
              <button key={node.id} className={`graphNode graph-${node.type}`} onClick={() => node.eventIds[0] && setHighlightedEventId(node.eventIds[0])}>
                <strong>{node.label}</strong>
                <span>{node.type} · {node.evidenceIds.join(", ") || node.characterIds.map((id) => deductionCase?.characters.find((character) => character.id === id)?.name || id).join(", ")}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="actionPanel suspectBoardPanel">
          <h2><Users size={16} /> Suspect Board</h2>
          <div className="suspectBoard">
            {suspectBoard.map((row) => (
              <button key={row.characterId} className={`suspectRow ${row.status}`} onClick={() => setSelectedCharacterId(row.characterId)}>
                <strong>{row.name}</strong>
                <span>M {row.motive ? "Y" : "N"} / W {row.means ? "Y" : "N"} / O {row.opportunity ? "Y" : "N"}</span>
                <small>{row.status === "culprit" ? "Only complete chain" : row.exclusionEvidenceIds.join(", ") || "excluded"}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="actionPanel">
          <h2><FileSearch size={16} /> 地点与证据</h2>
          <p>{selectedScene?.name || "选择地图地点"}</p>
          <div className="evidenceList">
            {sceneEvidence.map((item) => (
              <button key={item.id} className={discovered.has(item.id) ? "found" : ""} onClick={() => discoverEvidence(item.id)} disabled={!session || discovered.has(item.id) || busy}>
                <strong>{discovered.has(item.id) ? item.title : "未发现线索"}</strong>
                <span>{discovered.has(item.id) ? item.visibleDescription : `${selectedScene?.name} 中可能存在调查价值。`}</span>
              </button>
            ))}
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
          <div className={`aiSafetyStrip ${lastAiSafety?.promptAudit?.safe === false ? "unsafe" : "safe"}`}>
            <span>Prompt Safe: {lastAiSafety?.promptAudit?.safe === false ? "No" : "Yes"}</span>
            <span>Memory: {lastAiSafety?.memoryCount ?? selectedNpcMemories.length}</span>
            <span>Evidence: {lastAiSafety?.evidenceCount ?? discoveredEvidence.length}</span>
            {!!lastAiSafety?.safetyFlags?.length && <span>Flags: {lastAiSafety.safetyFlags.join(", ")}</span>}
          </div>
          <div className="dialogueLog">
            {(session?.interrogationLog || []).slice(-2).reverse().map((entry) => (
              <article key={entry.id}>
                <p><strong>{deductionCase?.characters.find((item) => item.id === entry.characterId)?.name || entry.characterId}</strong><span>{entry.evidenceId ? `出示 ${entry.evidenceId}` : "普通询问"}</span></p>
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
          {session?.judgement && <div className={`judgement ${session.judgement.accepted ? "pass" : "fail"}`}><strong>{session.judgement.accepted ? "推理成立" : "推理不成立"}</strong><p>{session.judgement.explanation}</p><button className="secondaryButton" onClick={revealSolution} disabled={!session.judgement.accepted || busy}>生成解答篇</button></div>}
          {revealText && <pre className="revealBox">{revealText}</pre>}
        </section>

        <details className="developerDrawer" open={developerOpen} onToggle={(event) => setDeveloperOpen(event.currentTarget.open)}>
          <summary><Database size={16} /> Developer / Agent API <ChevronDown size={15} /></summary>
          <div className="caseMeta">
            <span>worldId: {world?.id || "N/A"}</span>
            <span>caseId: {activeCase?.id || "N/A"}</span>
            <span>sessionId: {session?.id || "N/A"}</span>
            <span>NPC memories: {selectedNpcMemories.length}</span>
            <span>Prompt Safe: {lastAiSafety?.promptAudit?.safe === false ? "No" : "Yes"}</span>
            <span>Selected: {selectedCharacter?.name || "N/A"}</span>
          </div>
          <button className="secondaryButton full" onClick={copyAgentApiExample}>Copy Agent API Example</button>
          <pre className="apiExample">{agentApiExample}</pre>
        </details>
      </aside>
    </main>
  );
}
