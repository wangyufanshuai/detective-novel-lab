"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode, useMemo } from "react";
import type { TownDestination, TownPoint } from "@/lib/riverbend-navigation";
import type { TownSceneControls, TownSnapshot } from "./TownScene";
import styles from "./town-play.module.css";
import { TownDayDial, dayPeriod } from "./TownDayDial";
import { clockHours } from "./town-lighting";
import { useTownWorld } from "./useTownWorld";
import { TownCaseBook, TownCasePlace, TownCaseTracker, commissionHint, type CaseBookTab } from "./TownInvestigation";
import { TownSoundSettings } from "./TownSoundSettings";
import { townSound } from "./town-sound";
import { useTownSound } from "./useTownSound";
import type { TownEmote } from "./world-labels";
import { TownCaseFinale } from "./TownCaseFinale";
import { useTownGuide } from "./town-guide";
import { TownGuideCard } from "./TownGuideCard";
import { TownInterior } from "./TownInterior";
import { ROOMS, hasInterior } from "./interior-rooms";
import { TownCaseBoard } from "./TownCaseBoard";
import { TownStreetConversation } from "./TownStreetConversation";
import { interactionKey, type TownContact, type TownInteraction } from "./town-interaction";
import { useTownCaseArchive } from "./useTownCaseArchive";
import { TownArchiveList, TownArchivedCase } from "./TownCaseArchive";
import { archivedCaseMarkdown, townJournalMarkdown, confirmedClosedCases, type ArchivedCase } from "./case-archive";

const TownScene = dynamic(() => import("./TownScene"), { ssr: false });
const SAVE_KEY = "detective-town:riverbend-exploration:v1";
const tools = ["观察", "地图", "手记", "铅笔", "相机", "提灯", "行囊", "设置"];
const placeCopy: Record<string, string> = {
  cafe: "绿白相间的遮阳篷下摆着两张小圆桌。门楣上写着 CAFE，橱窗映着广场。这里适合作为你认识河湾的第一站。",
  books: "红白遮阳篷把书店与隔壁的咖啡馆区分开。顺着旁边的小巷，可以绕到住宅后街。",
  police: "钟楼立在警务所屋顶。站在广场上，它是最容易辨认的地标；从这里能看见河桥与集市。",
  station: "车站的长门廊朝向小镇。檐下停着一辆自行车，通往广场的道路从咖啡馆旁经过。",
  post: "邮局在广场东侧。沿着街边向南走，可以到达集市与河岸；向北则是住宅后街。",
  inn: "旅馆守着河桥西侧。木质阳台朝向步道，过桥后回望，这里是进入河湾时的另一处路标。"
};
type Panel = "journal" | "case" | "archive" | "board" | "notes" | "settings" | "bag" | "place" | "help" | "people" | "person" | null;

function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    观察: <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6M7 10h6M10 7v6" /></>,
    地图: <><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16M15 5v16" /><path d="m5 12 2-2m4 1 2 2m4 1 2-3" /></>,
    手记: <><path d="M5 3h15v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM6 3v18M10 8h6M10 12h6" /><path d="M12 17h3" /></>,
    铅笔: <><path d="m4 16 12-12 4 4L8 20l-5 1Zm10-10 4 4M4 16l4 4" /></>,
    相机: <><path d="M3 7h4l2-3h6l2 3h4v13H3Z" /><circle cx="12" cy="13" r="4" /><path d="M18 10h1" /></>,
    提灯: <><path d="M8 6V4a4 4 0 0 1 8 0v2M7 7h10l2 13H5ZM9 7l-1 13M15 7l1 13M5 22h14" /><path d="m12 10-2 5h4Z" /></>,
    行囊: <><path d="M7 7V5a5 5 0 0 1 10 0v2M5 7h14l2 14H3ZM5 7c0 7 14 7 14 0M10 11h4v4h-4ZM7 17h10" /></>,
    设置: <><path d="m12 2 2 3 4-1 1 4 3 2-2 4 1 4-4 1-3 3-3-2-4 1-1-4-3-3 2-3-1-4 4-1Z" /><circle cx="12" cy="12" r="3" /></>,
    晴: <><circle cx="12" cy="12" r="4" /><path d="M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2" /></>
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function TownPlayClient() {
  const world = useTownWorld();
  const archive = useTownCaseArchive(world.view);
  const [archiveId, setArchiveId] = useState("");
  const keys = useRef(new Set<string>());
  const controller = useRef<TownSceneControls | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const lastSnapshot = useRef<TownSnapshot>({ position: [0, -7], nearby: null, interaction: null, moving: false, areaId: "town-square" });
  const [areaId, setAreaId] = useState("town-square");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [destinations, setDestinations] = useState<TownDestination[]>([]);
  const [interaction, setInteraction] = useState<TownInteraction | null>(null);
  const [conversation, setConversation] = useState<TownContact | null>(null);
  const [place, setPlace] = useState<TownDestination | null>(null);
  const [overview, setOverview] = useState(false);
  const [lantern, setLantern] = useState(false);
  const [quality, setQuality] = useState<"high" | "balanced">("high");
  const [waypoint, setWaypoint] = useState<TownPoint | null>(null);
  const [waypointName, setWaypointName] = useState("");
  const [selected, setSelected] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);
  const [caseTab, setCaseTab] = useState<CaseBookTab | undefined>(undefined);
  const openCase = useCallback((tab?: CaseBookTab) => { setCaseTab(tab); setPanel("case"); }, []);
  const [visited, setVisited] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [loadedSave, setLoadedSave] = useState(false);
  const [saveStatus, setSaveStatus] = useState("手记保存在本机");
  const [toast, setToast] = useState("");
  const knownVisited = world.view?.visitedSceneIds ?? visited;
  const worldPaused = world.status !== "ready" || world.busy || world.pending;
  useTownSound(world.view, panel, overview);
  const [hasMoved, setHasMoved] = useState(false);
  const [wantGuide, setWantGuide] = useState(true);
  const [interior, setInterior] = useState<string | null>(null);
  const guide = useTownGuide({ view: world.view, status: world.status, panel, overview, moved: hasMoved });
  // The verdict moment: only when a case turns solved during this visit, never on reload.
  const [finale, setFinale] = useState<string | null>(null);
  const solvedCase = useRef<{ id: string; solved: boolean } | null>(null);
  useEffect(() => {
    const c = world.view?.investigation;
    if (!c) return;
    const before = solvedCase.current;
    solvedCase.current = { id: c.id, solved: c.solved };
    if (before && before.id === c.id && !before.solved && c.solved) setFinale(c.id);
  }, [world.view?.investigation]);
  // A corrected statement shows a brief "!" over the person who said it.
  const [shocked, setShocked] = useState<string | null>(null);
  const correctedLines = world.view?.investigation?.conversations.filter(line => line.corrected) ?? [];
  const lastCorrected = correctedLines.at(-1)?.id ?? "";
  const seenCorrection = useRef<string | null>(null);
  useEffect(() => {
    if (seenCorrection.current === null) { seenCorrection.current = lastCorrected; return; }
    if (!lastCorrected || lastCorrected === seenCorrection.current) return;
    seenCorrection.current = lastCorrected;
    const who = world.view?.investigation?.conversations.find(line => line.id === lastCorrected)?.characterId ?? null;
    setShocked(who);
    const timer = window.setTimeout(() => setShocked(null), 2600);
    return () => window.clearTimeout(timer);
  }, [lastCorrected, world.view?.investigation?.conversations]);
  const emotes = useMemo(() => {
    const out: Record<string, TownEmote> = {};
    const c = world.view?.investigation;
    for (const person of world.view?.residents ?? []) {
      if (person.visibility !== "observed") continue;
      if (shocked === person.npcId) out[person.actorId] = "shock";
      else if (c && !c.solved && !c.questionedIds.includes(person.npcId)) out[person.actorId] = "ask";
    }
    return out;
  }, [world.view?.investigation, world.view?.residents, shocked]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.version === 1) {
          setVisited(Array.isArray(saved.visited) ? saved.visited.filter((v: unknown) => typeof v === "string" && v in placeCopy) : []);
          setNotes(typeof saved.notes === "string" ? saved.notes.slice(0, 8000) : "");
        }
      }
    } catch { setSaveStatus("本机存储暂不可用，请及时导出手记"); }
    setLoadedSave(true);
  }, []);
  useEffect(() => {
    if (!loadedSave) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, visited, notes })); }
    catch { setSaveStatus("本机存储暂不可用，请及时导出手记"); }
  }, [visited, notes, loadedSave]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    keys.current.clear();
    if (panel && !dialog.current?.open) dialog.current?.showModal();
    if (!panel && dialog.current?.open) dialog.current?.close();
  }, [panel]);

  const inspect = useCallback(() => {
    if (worldPaused) return;
    const target = lastSnapshot.current.interaction;
    if (!target) { setToast("走近居民或店门，再按 E 交谈或观察。"); return; }
    if (target.kind === "resident") {
      if (world.view?.sceneId !== target.person.sceneId) return;
      setConversation(target.person); setPanel("person");
    } else {
      if (world.view?.sceneId !== target.place.id) { setToast("稍候，正在记下这次到访。"); return; }
      if (hasInterior(target.place.id)) { keys.current.clear(); setInterior(target.place.id); return; }
      setPlace(target.place); setPanel("place");
    }
  }, [worldPaused, world.view?.sceneId]);
  const onReady = useCallback((locations: TownDestination[], controls: TownSceneControls) => {
    controller.current = controls; setDestinations(locations); setReady(true);
  }, []);
  const onUpdate = useCallback((snapshot: TownSnapshot) => {
    lastSnapshot.current = snapshot;
    townSound().setWorld({ position: snapshot.position, moving: snapshot.moving });
    if (snapshot.moving) setHasMoved(true);
    setInteraction(old => interactionKey(old) === interactionKey(snapshot.interaction) ? old : snapshot.interaction);
    setAreaId(old => old === snapshot.areaId ? old : snapshot.areaId);
  }, []);
  useEffect(() => {
    if (!ready || worldPaused || areaId === world.view?.sceneId) return;
    const timer = window.setTimeout(() => { void world.command({ kind: "arrive", sceneId: areaId }); }, 550);
    return () => window.clearTimeout(timer);
  }, [ready, worldPaused, areaId, world.view?.sceneId, world.command]);
  const download = (href: string, filename: string) => {
    const link = document.createElement("a"); link.href = href; link.download = filename; link.click();
  };
  const chooseTool = useCallback((index: number) => {
    setSelected(index);
    townSound().play("tick");
    if (index === 0) setToast("用 WASD 或方向键走动，走近居民或店门，按 E 交谈或观察。");
    if (index === 1) { keys.current.clear(); setOverview(v => !v); }
    if (index === 2) setPanel("journal");
    if (index === 3) setPanel("notes");
    if (index === 4) {
      const shot = controller.current?.capture();
      if (shot) { download(shot, "河湾小镇.png"); setToast("这一刻已保存为照片。"); }
    }
    if (index === 5) { setLantern(v => !v); setToast("提灯在身边照亮一小片地方。白天的光效较轻。"); }
    if (index === 6) setPanel("bag");
    if (index === 7) setPanel("settings");
  }, []);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.matches("input, textarea, select") || event.target.isContentEditable)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (panel || finale || interior || !ready || error || world.status !== "ready") return;
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        event.preventDefault(); keys.current.add(key); return;
      }
      if (event.repeat) return;
      if (key === "e" && !overview) { event.preventDefault(); inspect(); }
      if (key === "m") { event.preventDefault(); chooseTool(1); }
      if (key === "j") { event.preventDefault(); chooseTool(2); }
      if (key === "k" && world.view?.investigation) { event.preventDefault(); openCase(); }
      if (key === "b" && world.view?.investigation) { event.preventDefault(); setPanel("board"); }
      if (/^[1-8]$/.test(key)) { event.preventDefault(); chooseTool(Number(key) - 1); }
      if (key === "escape") { if (overview) setOverview(false); else setPanel("settings"); }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    const clear = () => keys.current.clear();
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
    };
  }, [panel, finale, interior, ready, error, overview, inspect, chooseTool, worldPaused, world.status, world.view?.investigation, openCase]);
  const mark = (destination: TownDestination) => {
    setWaypoint(destination.entrance); setWaypointName(destination.label); setPanel(null); setOverview(false);
    setToast(`已在地面标记「${destination.label}」，可以步行前往。`);
  };
  const exportNotes = () => {
    const text = townJournalMarkdown({ view: world.view, places: destinations, visited: knownVisited, notes, archives: archive.entries });
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
    download(url, "河湾手记.md"); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportArchived = (entry: ArchivedCase) => {
    const url = URL.createObjectURL(new Blob([`# 河湾手记 · 本机留存\n\n${archivedCaseMarkdown(entry)}`], { type: "text/markdown;charset=utf-8" }));
    download(url, `${entry.title.replace(/[\\/:*?"<>|]/g, "_")}-河湾手记.md`); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const closedCases = confirmedClosedCases(world.view);
  const archived = closedCases.some(c => c.id === archiveId) ? archive.entries.find(c => c.id === archiveId) : undefined;
  const panelTitle = panel === "place" ? place?.label : ({ journal: "河湾手记", case: "调查与推断", archive: "已结案手记", board: "案件看板", notes: "随手记", settings: "稍作停留", bag: "随身行囊", help: "如何探索河湾", people: "在河湾遇见的人" } as Record<string, string>)[panel ?? ""];
  const nextDestination = destinations.find(d => !knownVisited.includes(d.id));
  const openLeads = new Map((world.view?.investigation?.solved ? [] : world.view?.investigation?.leads ?? []).map(lead => [lead.sceneId, lead.open]));
  const markScene = (sceneId: string) => { const target = destinations.find(d => d.id === sceneId); if (target) mark(target); };
  const placeTags = destinations.map(d => ({ id: d.id, label: d.label, visited: knownVisited.includes(d.id), leads: openLeads.get(d.id) ?? 0, marked: waypointName === d.label }));
  const hours = clockHours(world.view?.time);
  const peopleList = <div className={styles.peopleList}>{world.view?.residents.map(person => <div key={person.npcId}><strong>{person.name}<small>{person.role}</small></strong><span>{person.visibility === "observed" && areaId === person.sceneId ? "本次到访见于" : "上次见于"} {person.locationName}</span><small>第 {person.day} 天 · {person.time}</small></div>)}{!world.view?.residents.length && <p>亲眼见过的人，会记在这里。</p>}</div>;
  const connectionNotice = world.message && world.status !== "new" && <div className={styles.connectionNotice} role="alert"><p>{world.message}</p><button disabled={world.busy} onClick={() => void world.retry()}>重试保存</button><button disabled={world.busy} onClick={() => void world.reload()}>重新连接手记</button></div>;

  return <main id="detective-town-main" tabIndex={-1} className={styles.town} lang="zh-CN" aria-label="河湾小镇探索" data-ready={ready && !error} data-world-state={world.status} data-world-busy={world.busy} data-world-pending={world.pending} data-view={overview ? "overview" : "explore"} data-panel={panel ?? "none"} data-guide={guide.step && ready && world.status === "ready" ? guide.step.id : "none"} data-guide-slot={guide.step && ready && world.status === "ready" ? guide.step.slot ?? "" : ""}>
    <TownScene keys={keys} overview={overview} paused={!!panel || !!error || worldPaused || !!interior} suspended={!!interior} conversationActorId={panel === "person" ? conversation?.actorId ?? null : null} lantern={lantern} quality={quality} waypoint={waypoint} placeTags={placeTags} emotes={emotes} onMarkPlace={markScene} worldView={world.view} restore={world.restore} onReady={onReady} onUpdate={onUpdate} onError={setError} />
    <div className={styles.vignette} aria-hidden="true" />
    <header className={styles.arrival}>
      <div className={styles.arrivalSeal}><Icon name="手记" /></div>
      <div><span className={styles.eyebrow}>RIVERBEND · 河湾手记</span><h1>{world.view?.investigation?.title || "初到河湾"}</h1><p>{world.view?.investigation ? `${world.view.investigation.solved ? "案件已归档" : `已取得 ${world.view.investigation.clues.length} 份物证`} · 按 J 翻开手记。` : knownVisited.length === 6 ? "小镇的六处地点，已经留在手记里。" : knownVisited.length && nextDestination ? `下一站，可以去${nextDestination.label}看看。` : "去咖啡馆门前，认识这座小镇。"}</p>
        <div className={styles.progress}><span>初访地点</span><span className={styles.progressDots} aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <i key={i} data-filled={i < knownVisited.length} />)}</span><b>{knownVisited.length}/6</b></div>
      </div>
    </header>
    <aside className={styles.dayCard} aria-label="小镇时间" data-period={hours >= 6 && hours < 18 ? "day" : "night"}><TownDayDial time={world.view?.time} /><div>{world.view ? <><strong>{world.view.time}</strong><span>第 {world.view.day} 天 · {dayPeriod(hours)}</span></> : <><strong>河湾小镇</strong><span>新的一段手记</span></>}</div><button aria-label="探索帮助" onClick={() => setPanel("help")}>?</button></aside>
    {/* Status chip only when there is something to say; no developer labels in the player view. */}
    {(world.busy || world.view?.investigation?.solved) && <div className={styles.previewLabel} role="status">{world.busy ? "正在保存这一步…" : `${world.view?.investigation?.title} · 已归档`}</div>}
    {ready && !error && world.status === "ready" && <TownCaseTracker investigation={world.view?.investigation ?? null} commission={world.view?.commission} places={destinations} onMark={markScene} onOpenBook={() => openCase()} onOpenBoard={() => setPanel("board")} />}
    {waypointName && !overview && <div className={styles.waypoint}><span>◇</span> 前往 {waypointName}<button aria-label="清除地点标记" onClick={() => { setWaypoint(null); setWaypointName(""); }}>×</button></div>}
    {overview && <section className={styles.overview} aria-label="全镇俯瞰地点"><div><span className={styles.eyebrow}>小镇一览</span><h2>从河桥，到每一扇门</h2><p>选择一处地点，在街道上留下标记。</p></div><div className={styles.destinationList}>{destinations.map(d => <button key={d.id} onClick={() => mark(d)}><span>{knownVisited.includes(d.id) ? "✓" : "◇"}</span>{d.label}{openLeads.get(d.id) ? <b className={styles.leadBadge} aria-label={`${openLeads.get(d.id)} 处待核对`}>{openLeads.get(d.id)}</b> : null}</button>)}</div><button className={styles.textButton} onClick={() => setPanel("people")}>查看人物目击 · {world.view?.residents.length || 0} 人</button><button className={styles.returnButton} onClick={() => setOverview(false)}>返回角色视角 <kbd>M</kbd></button></section>}
    {!ready && !error && <div className={styles.loading} role="status"><span className={styles.loadingMark}>R</span><h2>正在走进河湾</h2><p>石板路、街角与河水，正在眼前展开。</p></div>}
    {error && <div className={styles.loading} role="alert"><h2>小镇暂时没有载入</h2><p>{error}</p><button onClick={() => location.reload()}>重新载入</button></div>}
    {ready && !error && world.status === "new" && <div className={styles.welcome}><span className={styles.eyebrow}>第一天 · 河湾</span><h2>把日子，写成手记</h2><p>沿石板路走近居民。到访会推进小镇时间，你亲眼见到的人和地点会留下记录。</p><ol className={styles.welcomeSteps}><li><b>走访</b>六处店铺与街角</li><li><b>询问</b>先听居民说完</li><li><b>核对</b>拿物证对照说法</li><li><b>结案</b>写下结论</li></ol><label className={styles.welcomeGuide}><input type="checkbox" checked={wantGuide} onChange={e => setWantGuide(e.target.checked)} /> 第一次来，陪我走完第一宗（新手引导）</label><button className={styles.primary} disabled={world.busy} onClick={() => { guide.setEnabled(wantGuide); void world.start(); }}>开始河湾手记</button>{world.message && <p role="alert">{world.message}</p>}</div>}
    {!panel && connectionNotice}
    <div className={styles.notice} role="status" aria-live="polite">{toast && <span>{toast}</span>}</div>
    {ready && !overview && !panel && !worldPaused && interaction && <button className={styles.interact} onClick={inspect}><kbd>E</kbd><span>{interaction.kind === "resident" ? `交谈 · ${interaction.person.name}` : `观察 · ${interaction.place.label}`}</span></button>}
    <div className={styles.walkHint}><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 行走</span><span><kbd>E</kbd> 交谈 / 观察　<kbd>M</kbd> 俯瞰</span></div>
    <div className={styles.touchPad} aria-label="触屏方向控制">{[{ key: "w", label: "向前走", symbol: "↑" }, { key: "a", label: "向左走", symbol: "←" }, { key: "s", label: "向后走", symbol: "↓" }, { key: "d", label: "向右走", symbol: "→" }].map(direction => <button key={direction.key} data-key={direction.key} aria-label={direction.label}
      onPointerDown={event => { event.preventDefault(); if (panel || overview || !ready || error || world.status !== "ready") return; event.currentTarget.setPointerCapture(event.pointerId); keys.current.add(direction.key); }}
      onPointerUp={() => keys.current.delete(direction.key)} onPointerCancel={() => keys.current.delete(direction.key)} onLostPointerCapture={() => keys.current.delete(direction.key)}>{direction.symbol}</button>)}</div>
    <nav className={styles.toolbar} aria-label="随身工具栏"><div className={styles.toolName}>{tools[selected]}{selected === 5 && lantern ? " · 已点亮" : ""}</div><div className={styles.toolSlots}>{tools.map((name, index) => <button key={name} className={styles.toolSlot} aria-label={`${index + 1} ${name}`} aria-pressed={selected === index} disabled={!ready || !!error || world.status !== "ready"} onClick={() => chooseTool(index)}><small>{index + 1}</small><Icon name={name} /><span>{name}</span>{name === "提灯" && lantern && <i />}</button>)}</div></nav>
    <div className={styles.placeName}>RIVERBEND<span>河湾 · 广场与河岸</span></div>
    <dialog ref={dialog} className={`${styles.journal}${panel === "person" ? ` ${styles.streetConversation}` : panel === "board" ? ` ${styles.boardDialog}` : ""}`} onCancel={() => setPanel(null)} onClose={() => setPanel(null)} aria-labelledby="town-dialog-title">
      <div className={styles.dialogTop}>{panel === "person" && conversation ? <div className={styles.streetIdentity}><span className={styles.eyebrow}>街角交谈</span><h2 id="town-dialog-title">{conversation.name}<small>{conversation.role}</small></h2></div> : <span className={styles.eyebrow}>河湾手记 · FIELD NOTES</span>}<button className={styles.close} aria-label="关闭窗口" onClick={() => setPanel(null)}>×</button></div>
      {panel !== "person" && <h2 id="town-dialog-title">{panelTitle}</h2>}
      {panel && connectionNotice}
      {panel === "person" && conversation && <TownStreetConversation key={conversation.actorId} person={conversation} view={world.view} disabled={worldPaused} command={world.command} openBook={() => openCase()} close={() => setPanel(null)} />}
      {panel === "place" && place && <><p className={styles.prose}>{placeCopy[place.id]}</p><div className={styles.entryStamp}>✓ 已记入初访手记 · 第 {world.view?.day} 天 {world.view?.time}</div><div className={styles.metPeople}>{world.view?.residents.filter(person => person.visibility === "observed").map(person => <span key={person.npcId}>遇见 {person.name} · {person.role}</span>)}</div>{world.view?.investigation && !(world.view.investigation.solved && world.view.commission) ? <TownCasePlace investigation={world.view.investigation} residents={world.view.residents} disabled={worldPaused || world.view.sceneId !== place.id} command={world.command} openBook={() => openCase()} /> : <div className={styles.caseInvitation}>{world.view?.commission ? <><span className={styles.eyebrow}>新委托 · {world.view.commission.ordinal}</span><h3>{world.view.commission.hook}</h3><p>{world.view.commission.detail}</p></> : <><h3>暂时没有新的委托</h3><p>已归档的案件可以在手记里回看。</p></>}{world.view?.commission?.openAt.includes(place.id) && <button className={styles.primary} disabled={worldPaused || world.view?.sceneId !== place.id} onClick={() => void world.command({ kind: "case-open" })}>领取调查手记</button>}</div>}<button className={styles.primary} onClick={() => setPanel(null)}>继续走走</button></>}
      {panel === "journal" && <><p className={styles.prose}>每一次到访，都会在这里留下记号。选中地点可以标记方向。</p><div className={styles.journalPlaces}>{destinations.map((d, i) => <button key={d.id} onClick={() => mark(d)}><small>0{i + 1}</small><strong>{d.label}</strong><span>{knownVisited.includes(d.id) ? "已探访 ✓" : "尚未探访"}</span></button>)}</div><button className={styles.textButton} onClick={() => setPanel("people")}>人物目击 · {world.view?.residents.length || 0} 人</button><div className={styles.emptyCase}><Icon name="观察" /><div>{world.view?.investigation && !(world.view.investigation.solved && world.view.commission) ? <><strong>{world.view.investigation.title}</strong><p>{`${world.view.investigation.ordinal} · ${world.view.investigation.clues.length} 份物证 · ${world.view.investigation.solved ? "已经归档" : "继续核对证词与时间"}`}</p><button className={styles.textButton} onClick={() => openCase()}>翻开案件本 →</button> <button className={styles.textButton} onClick={() => setPanel("board")}>案件看板 →</button></> : world.view?.commission ? <><strong>{world.view.commission.hook}</strong><p>{commissionHint(world.view.commission)}</p><button className={styles.textButton} onClick={() => markScene(world.view!.commission!.openAt[0])}>标记{destinations.find(d => d.id === world.view!.commission!.openAt[0])?.label.replace(/^河湾/, "") ?? "地点"} →</button></> : <><strong>暂时没有委托</strong><p>沿着街道走走，认一认河湾的居民。</p></>}</div></div><button className={styles.textButton} onClick={exportNotes}>导出手记 ↓</button></>}
      {panel === "journal" && <TownArchiveList closedCases={closedCases} entries={archive.entries} message={archive.message} loading={!archive.ready} onRead={id => { setArchiveId(id); setPanel("archive"); }} />}
      {panel === "archive" && (archived ? <TownArchivedCase key={archived.id} entry={archived} onBack={() => setPanel("journal")} onExport={() => exportArchived(archived)} /> : <p className={styles.quiet}>本机尚无这宗案件的完整记录。<button className={styles.textButton} onClick={() => setPanel("journal")}>返回手记</button></p>)}
      {panel === "board" && world.view?.investigation && <TownCaseBoard key={world.view.investigation.id} investigation={world.view.investigation} residents={world.view.residents} places={destinations} openBook={openCase} onMark={markScene} />}
      {panel === "case" && world.view?.investigation && <TownCaseBook key={`${world.view.investigation.id}-${caseTab ?? ""}`} initialTab={caseTab} investigation={world.view.investigation} residents={world.view.residents} disabled={worldPaused} command={world.command} places={destinations} onMark={markScene} />}
      {panel === "people" && <><p className={styles.prose}>这里只记下亲眼见到的人。离开后保留上次目击地点与时间。</p>{peopleList}</>}
      {panel === "notes" && <><label htmlFor="riverbend-notes" className={styles.quiet}>记下一个地标、一条路线，或你想回来的理由。</label><textarea id="riverbend-notes" value={notes} onChange={event => setNotes(event.target.value)} maxLength={8000} placeholder="钟楼在广场的北面……" rows={7} /><div className={styles.notesFooter}><span>{saveStatus}</span><button className={styles.textButton} onClick={exportNotes}>导出手记 ↓</button></div></>}
      {panel === "settings" && <><p className={styles.prose}>打开手记时，角色会停下脚步。到访和等待会推进居民的日程。</p><fieldset className={styles.settings}><legend>画面</legend><label><input type="radio" name="quality" checked={quality === "high"} onChange={() => setQuality("high")} /> 清晰 · 较高画质</label><label><input type="radio" name="quality" checked={quality === "balanced"} onChange={() => setQuality("balanced")} /> 轻量 · 降低功耗</label></fieldset><TownSoundSettings /><div className={styles.waitChoices}><span>在这里歇一会儿</span>{([15, 30, 60] as const).map(minutes => <button key={minutes} disabled={worldPaused || areaId !== world.view?.sceneId} onClick={() => void world.command({ kind: "wait", minutes })}>{minutes === 60 ? "一小时" : `${minutes} 分钟`}</button>)}</div><p className={styles.quiet}>居民会按日程改变地点。首案可在旧书店或警务所开启。手记保存到本机项目，随手写的笔记保存在这个浏览器。</p><button className={styles.primary} onClick={() => setPanel(null)}>返回小镇</button></>}
      {panel === "bag" && <><p className={styles.prose}>观察镜、地图、手记本、铅笔、相机与提灯，已经放进你的行囊。</p><div className={styles.bagTools}>{tools.slice(0, 6).map(name => <div key={name}><Icon name={name} /><span>{name}</span></div>)}</div><p className={styles.quiet}>{world.view?.investigation ? `案件本里已收录 ${world.view.investigation.clues.length} 份物证记录。原件留在保管地点。` : "案件物品会在调查后记入手记。底部工具栏可直接使用这些探索工具。"}</p></>}
      {panel === "help" && <><button className={styles.textButton} onClick={() => { guide.restart(); setPanel(null); }}>重新开始新手引导 →</button><div className={styles.helpRow}><kbd>W A S D</kbd><span>或方向键，沿着画面方向走动</span></div><div className={styles.helpRow}><kbd>E</kbd><span>走近居民交谈，靠近店门观察</span></div><div className={styles.helpRow}><kbd>M / J</kbd><span>全镇俯瞰 / 打开手记</span></div><div className={styles.helpRow}><kbd>K / B</kbd><span>领取调查手记后，翻开案件本 / 案件看板</span></div><div className={styles.helpRow}><kbd>1 — 8</kbd><span>切换底部随身工具</span></div><p className={styles.quiet}>触屏可按住左下方方向键行走，点击出现的交谈或地点提示。涉及案件的询问与物证核对会用五分钟，并保存到手记。</p></>}
    </dialog>
    {interior && world.view && <TownInterior key={interior} room={ROOMS[interior]} view={world.view} paused={!!panel || !!finale} busy={worldPaused} message={world.message} command={world.command}
      onTalk={person => { setConversation(person); setPanel("person"); }} onOpenBook={() => openCase()} onExit={() => setInterior(null)} />}
    {ready && !error && world.status === "ready" && !overview && !finale && guide.step && <TownGuideCard step={guide.step} index={guide.index} total={guide.total} finishing={guide.finishing} onSkip={guide.skip} />}
    {finale && world.view?.investigation?.id === finale && <TownCaseFinale investigation={world.view.investigation} commission={world.view.commission}
      onRead={() => { setFinale(null); openCase("ending"); }} onClose={() => { setFinale(null); setPanel(null); }} />}
  </main>;
}
