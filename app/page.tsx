"use client";

import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Database,
  Eye,
  FileSearch,
  Gavel,
  Loader2,
  Map,
  MessageSquare,
  Network,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  CaseFromLog,
  DeepSeekLiveEvalReport,
  MurderArchetype,
  NpcDialogueEvalReport,
  PlayerSession,
  PlayerTheory,
  PromptAuditReport,
  RevealEvalReport,
  RevealFactContract,
  WorldEvent,
  WorldMode,
  WorldState
} from "@/lib/engine";

type ApiResult<T> = T & { ok: boolean; error?: string };
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

const storageKey = "detective-town-showcase-v1";
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

function loadLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function postJson<T>(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = (await response.json()) as ApiResult<T>;
  if (!data.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function Home() {
  const [world, setWorld] = useState<WorldState | null>(null);
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [activeCase, setActiveCase] = useState<CaseFromLog | null>(null);
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [sessions, setSessions] = useState<PlayerSession[]>([]);
  const [worldIdInput, setWorldIdInput] = useState("");
  const [seedInput, setSeedInput] = useState("showcase-seed");
  const [caseArchetype, setCaseArchetype] = useState<MurderArchetype | "auto">("auto");
  const [mode, setMode] = useState<WorldMode>("showcase");
  const [playerName, setPlayerName] = useState("调查员");
  const [selectedSceneId, setSelectedSceneId] = useState("");
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState("");
  const [question, setQuestion] = useState("案发窗口你在哪里？你记得哪些异常？");
  const [theory, setTheory] = useState<PlayerTheory>({ culpritId: "", motive: "", method: "", evidenceIds: [] });
  const [status, setStatus] = useState("创建一个 8 NPC / 24h Detective Town，小镇会先运行，再从事件日志中抽取案件。");
  const [revealText, setRevealText] = useState("");
  const [lastAiSafety, setLastAiSafety] = useState<AiSafetyState | null>(null);
  const [latestLiveEval, setLatestLiveEval] = useState<DeepSeekLiveEvalReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);

  const deductionCase = activeCase?.deductionCase || null;
  const scenes = deductionCase?.scenes || [];
  const characters = deductionCase?.characters.filter((character) => character.role !== "死者") || [];
  const discovered = new Set(session?.discoveredEvidenceIds || []);
  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) || scenes[0];
  const sceneEvidence = selectedScene ? deductionCase?.evidence.filter((item) => selectedScene.evidenceIds.includes(item.id)) || [] : [];
  const discoveredEvidence = deductionCase?.evidence.filter((item) => discovered.has(item.id)) || [];
  const recentEvents = useMemo(() => events.slice(-14).reverse(), [events]);
  const playerTheoryEvidence = useMemo(() => new Set(theory.evidenceIds), [theory.evidenceIds]);
  const selectedTestimony = activeCase?.testimonies?.find((item) => item.characterId === selectedCharacterId);
  const quality = activeCase?.qualityReport;
  const factLockScore = lastAiSafety?.revealEval?.factContractScore ?? lastAiSafety?.revealEval?.score;
  const exposedContradictions = activeCase?.testimonies?.reduce((sum, item) => sum + item.exposedContradictions.length, 0) || 0;

  useEffect(() => {
    const saved = loadLocal<{ worldId?: string; sessionId?: string }>(storageKey, {});
    if (saved.worldId) setWorldIdInput(saved.worldId);
    fetch("/api/ai/live-eval/latest")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.ok) setLatestLiveEval(data.report);
      })
      .catch(() => undefined);
  }, []);

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
    }
    if (data.sessions) setSessions(data.sessions);
  }

  async function createWorld() {
    setBusy(true);
    try {
      const data = await postJson<{ world: WorldState; events: WorldEvent[]; activeCase: CaseFromLog }>("/api/worlds/create", {
        seed: seedInput.trim() || "showcase-seed",
        mode,
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
      persist(data.world.id, "");
      setStatus("Detective Town 已创建：案件来自 NPC 日程、记忆、事件和证据日志。");
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
      const state = await fetch(`/api/worlds/${worldIdInput.trim()}/state`).then((response) => response.json());
      if (!state.ok) throw new Error(state.error || "读取小镇失败");
      const eventResult = await fetch(`/api/worlds/${worldIdInput.trim()}/events`).then((response) => response.json());
      hydrateCase({ world: state.world, activeCase: state.activeCase, sessions: state.sessions || [], events: eventResult.events || [] });
      persist(state.world.id, session?.id);
      setStatus("已载入现有 Detective Town。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "读取小镇失败");
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

  async function joinCase() {
    if (!world || !activeCase) return;
    setBusy(true);
    try {
      const data = await postJson<{ session: PlayerSession }>("/api/players/join", { worldId: world.id, caseId: activeCase.id, displayName: playerName.trim() || "调查员" });
      setSession(data.session);
      setSessions((items) => [data.session, ...items.filter((item) => item.id !== data.session.id)]);
      persist(world.id, data.session.id);
      setStatus("已加入调查。现在可以搜索场景、询问 NPC、提交推理。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "加入调查失败");
    } finally {
      setBusy(false);
    }
  }

  async function discoverEvidence(evidenceId: string) {
    if (!session) return;
    setBusy(true);
    try {
      const data = await postJson<{ session: PlayerSession }>("/api/investigation/discover", { sessionId: session.id, evidenceId });
      setSession(data.session);
      setStatus(`发现证据：${deductionCase?.evidence.find((item) => item.id === evidenceId)?.title || evidenceId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "搜索证据失败");
    } finally {
      setBusy(false);
    }
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
        const latestCase = await fetch(`/api/cases/${activeCase.id}`).then((response) => response.json());
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

  return (
    <main className="mmoShell">
      <aside className="mmoSidebar">
        <div className="brandBlock">
          <div className="brandIcon"><Map size={26} /></div>
          <div>
            <p>Detective Town</p>
            <h1>AI 推理小镇</h1>
          </div>
        </div>

        <div className="sidePanel">
          <div className="panelTitle"><Plus size={16} /> Create Detective Town</div>
          <label className="compactLabel">Seed<input value={seedInput} onChange={(event) => setSeedInput(event.target.value)} /></label>
          <label className="compactLabel">案件类型
            <select value={caseArchetype} onChange={(event) => setCaseArchetype(event.target.value as MurderArchetype | "auto")}>
              {archetypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="compactLabel">模式
            <select value={mode} onChange={(event) => setMode(event.target.value as WorldMode)}>
              <option value="showcase">Showcase：8 NPC / 24h</option>
              <option value="advanced">Advanced：30 NPC / 多日</option>
            </select>
          </label>
          <button className="primaryButton full" onClick={createWorld} disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />} Create Detective Town</button>
        </div>

        <div className="sidePanel">
          <div className="panelTitle"><Database size={16} /> Load / Join</div>
          <div className="inputLine">
            <input value={worldIdInput} onChange={(event) => setWorldIdInput(event.target.value)} placeholder="world id" />
            <button className="iconButton" onClick={loadWorld} disabled={busy}><Search size={16} /></button>
          </div>
          <label className="compactLabel">玩家名<input value={playerName} onChange={(event) => setPlayerName(event.target.value)} /></label>
          <button className="secondaryButton full" onClick={joinCase} disabled={busy || !world || !activeCase}><Users size={16} /> 加入调查</button>
          <button className="secondaryButton full" onClick={tickWorld} disabled={busy || !world}><Clock size={16} /> 推进小镇</button>
        </div>

        <div className="miniList">
          <div className="miniRow"><span>NPC</span><strong>{world?.npcs.length || 0}</strong></div>
          <div className="miniRow"><span>事件</span><strong>{events.length}</strong></div>
          <div className="miniRow"><span>证据</span><strong>{session?.discoveredEvidenceIds.length || 0}/{deductionCase?.evidence.length || 0}</strong></div>
          <div className="miniRow"><span>AI Eval</span><strong>{latestLiveEval?.passed === false ? "Fail" : latestLiveEval ? "Pass" : "Local"}</strong></div>
        </div>

        <div className="statusBox">
          <AlertTriangle size={16} />
          <span>{status}</span>
        </div>
      </aside>

      <section className="mmoWorkspace">
        <header className="mmoHeader">
          <div>
            <p className="eyebrow">Simulated lives {"->"} world events {"->"} evidence {"->"} fair-play case</p>
            <h2>{activeCase?.deductionCase.title || "Detective Town Showcase"}</h2>
          </div>
          <div className="metricStrip">
            <div><span>Quality</span><strong>{quality?.qualityScore ?? quality?.score ?? 0}</strong></div>
            <div><span>Unique</span><strong>{quality?.uniqueCulprit ? "Yes" : "No"}</strong></div>
            <div><span>24h</span><strong>{quality?.timeline24hComplete ? "Yes" : "No"}</strong></div>
          </div>
        </header>

        <section className="caseBand">
          <div>
            <h3>{deductionCase ? "案件来自世界行为，而不是 AI 直接编故事。" : "创建小镇后开始调查。"}</h3>
            <p>{deductionCase?.publicCaseFile || "小镇会先生成 NPC 日程、秘密、关系、记忆与事件，再从事件日志中抽取一件可验证的案件。"}</p>
            {activeCase && (
              <div className="caseMeta">
                <span>{world?.mode || "showcase"}</span>
                <span>{archetypeLabels[activeCase.generationProfile.archetype]}</span>
                <span>凶手唯一：{quality?.uniqueCulprit ? "是" : "否"}</span>
                <span>证据来自事件：{quality?.worldBackedEvidence ? "是" : "否"}</span>
                <span>记忆约束：{quality?.memoryScopedTestimony ? "是" : "否"}</span>
              </div>
            )}
          </div>
          <button className="secondaryButton" onClick={() => setDebugOpen((value) => !value)}><Eye size={16} /> Debug</button>
        </section>

        <div className="investigationGrid">
          <section className="workPanel">
            <h4><Map size={16} /> 小镇地图与搜索</h4>
            <div className="locationGrid">
              {scenes.map((scene) => (
                <button key={scene.id} className={`locationCard ${scene.id === selectedScene?.id ? "selected" : ""}`} onClick={() => setSelectedSceneId(scene.id)}>
                  <strong>{scene.name}</strong>
                  <span>{scene.evidenceIds.length} 条可搜索线索</span>
                </button>
              ))}
            </div>
            <div className="evidenceSearch">
              {sceneEvidence.map((item) => (
                <div className="evidenceRow" key={item.id}>
                  <div>
                    <strong>{discovered.has(item.id) ? item.title : "未发现线索"}</strong>
                    <span>{discovered.has(item.id) ? item.visibleDescription : `${selectedScene?.name} 中可能存在调查价值。`}</span>
                  </div>
                  <button className="secondaryButton" onClick={() => discoverEvidence(item.id)} disabled={!session || discovered.has(item.id) || busy}><FileSearch size={16} /> 搜索</button>
                </div>
              ))}
              {!sceneEvidence.length && <p>该地点暂无可发现证据。</p>}
            </div>
          </section>

          <section className="workPanel">
            <h4><MessageSquare size={16} /> NPC 询问与证据质询</h4>
            <div className="formGrid">
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
            </div>
            {selectedTestimony && (
              <div className="testimonyBox">
                <span>当前证词 / 可挑战证据：{selectedTestimony.contradictionEvidenceIds.join("、") || "无"}</span>
                <p>{selectedTestimony.currentStatement}</p>
                <span>{selectedTestimony.revised ? "已被证据修正" : "尚未修正"}</span>
              </div>
            )}
            <textarea value={question} onChange={(event) => setQuestion(event.target.value)} />
            <button className="primaryButton full" onClick={interrogate} disabled={!session || !selectedCharacterId || busy}><Bot size={16} /> 询问 NPC</button>
            <div className="dialogueLog">
              {(session?.interrogationLog || []).slice(-4).reverse().map((entry) => (
                <article key={entry.id}>
                  <p><strong>{deductionCase?.characters.find((item) => item.id === entry.characterId)?.name || entry.characterId}</strong><span>{entry.evidenceId ? `出示 ${entry.evidenceId}` : "普通询问"}</span></p>
                  <blockquote>{entry.answer}</blockquote>
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="lowerGrid">
          <section className="workPanel">
            <h4><Network size={16} /> 24h 时间线与证据图谱</h4>
            <div className="timelineList">
              {deductionCase?.truth.trueTimeline.map((item) => (
                <div className="timelineItem" key={item.id}>
                  <time>{item.time}</time>
                  <strong>{item.contradictedByEvidenceIds.some((id) => discovered.has(id)) ? item.event : item.publicVersion}</strong>
                  <span>证据：{item.contradictedByEvidenceIds.join("、") || "无"}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="workPanel">
            <h4><Gavel size={16} /> 提交推理</h4>
            <label>凶手
              <select value={theory.culpritId} onChange={(event) => setTheory((current) => ({ ...current, culpritId: event.target.value }))}>
                <option value="">选择嫌疑人</option>
                {characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
              </select>
            </label>
            <label>动机<textarea value={theory.motive} onChange={(event) => setTheory((current) => ({ ...current, motive: event.target.value }))} /></label>
            <label>手法<textarea value={theory.method} onChange={(event) => setTheory((current) => ({ ...current, method: event.target.value }))} /></label>
            <div className="checkList">
              {discoveredEvidence.map((item) => (
                <label className="checkRow" key={item.id}>
                  <input type="checkbox" checked={playerTheoryEvidence.has(item.id)} onChange={() => toggleTheoryEvidence(item.id)} />
                  {item.title}
                </label>
              ))}
            </div>
            <button className="primaryButton full" onClick={submitTheory} disabled={!session || busy}><ShieldCheck size={16} /> 判定推理</button>
            {session?.judgement && (
              <div className={`judgement ${session.judgement.accepted ? "pass" : "fail"}`}>
                <strong>{session.judgement.accepted ? "推理成立" : "推理不成立"}</strong>
                <p>{session.judgement.explanation}</p>
                <button className="secondaryButton" onClick={revealSolution} disabled={!session.judgement.accepted || busy}>生成解答篇</button>
              </div>
            )}
            {revealText && <pre className="revealBox">{revealText}</pre>}
          </section>
        </div>

        <div className="lowerGrid">
          <section className="workPanel">
            <h4><CheckCircle2 size={16} /> 质量报告</h4>
            <div className="boardGrid">
              {[
                ["World-backed evidence", quality?.worldBackedEvidence],
                ["Memory-scoped testimony", quality?.memoryScopedTestimony],
                ["24h timeline", quality?.timeline24hComplete],
                ["Non-culprits excluded", quality?.nonCulpritExcluded],
                ["Reasoning trace", quality?.reasoningTraceComplete],
                ["Rule validation", activeCase?.validation.valid]
              ].map(([label, ok]) => (
                <div className={`boardCard ${ok ? "found" : ""}`} key={String(label)}>
                  <strong>{ok ? "PASS" : "WAIT"}</strong>
                  <p>{label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="workPanel">
            <h4><Clock size={16} /> 世界事件流</h4>
            <div className="eventFeed">
              {recentEvents.map((event) => (
                <div key={event.id}>
                  <time>第{event.day}日 {event.time}</time>
                  <strong>{event.publicSummary}</strong>
                  <span>{event.type} / {event.locationId}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="workPanel" style={{ marginTop: 18 }}>
          <h4><ShieldCheck size={16} /> AI 安全状态</h4>
          <div className="caseMeta">
            <span>Prompt Safe: {lastAiSafety?.promptAudit?.safe === false ? "No" : "Yes"}</span>
            <span>Dialogue Score: {lastAiSafety?.dialogueEval?.score ?? "Local"}</span>
            <span>Memory Count: {lastAiSafety?.memoryCount ?? 0}</span>
            <span>Evidence Count: {lastAiSafety?.evidenceCount ?? 0}</span>
            <span>Fact Lock: {factLockScore ?? "N/A"}</span>
            <span>Exposed Contradictions: {exposedContradictions}</span>
          </div>
        </section>

        {debugOpen && (
          <section className="debugPanel">
            <pre>{JSON.stringify({ world, events, activeCase, session, sessions, lastAiSafety }, null, 2)}</pre>
          </section>
        )}
      </section>
    </main>
  );
}
