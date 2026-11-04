"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, BookOpen, Clock3, Compass, Footprints, Landmark, RotateCcw, Search, X } from "lucide-react";
import { useTownWorld } from "../useTownWorld";
import { CLASSIC_LIVING_ENDPOINT, classicWorldScene } from "@/lib/classic-living-contract";
import type { SampleInteraction, SampleMode, SampleRoom } from "../art-sample/sample-navigation";
import styles from "../art-sample/classic-art.module.css";
import living from "./living.module.css";

const Scene = dynamic(() => import("../art-sample/ClassicScene"), { ssr: false });
export default function LivingTown() {
  const world = useTownWorld({ endpoint: CLASSIC_LIVING_ENDPOINT, pendingKey: "detective-town:classic-living-pending:v1", presentMotion: true });
  const keys = useRef(new Set<string>());
  const [mode, setMode] = useState<SampleMode>("overview"), [ready, setReady] = useState(false), [sceneError, setSceneError] = useState("");
  const [room, setRoom] = useState<SampleRoom | null>(null), [nearby, setNearby] = useState<SampleInteraction | null>(null);
  const [note, setNote] = useState<SampleInteraction | "journal" | null>(null), [reset, setReset] = useState(0);
  const [restoredKey, setRestoredKey] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null), previousFocus = useRef<HTMLElement | null>(null);
  const sceneId = classicWorldScene(room?.id);
  const synchronized = ready && world.status === "ready" && !!world.view && world.restore?.key === restoredKey && world.view.sceneId === sceneId;
  const explorable = synchronized && !world.busy && !world.pending && !sceneError;
  const interactive = explorable && !world.motion;
  const activePerson = typeof note === "object" && note?.actorId ? world.view?.residents.find(person => person.actorId === note.actorId && person.visibility === "observed" && person.sceneId === sceneId) : null;
  const live = useRef({ nearby, note, interactive, explorable });
  live.current = { nearby, note, interactive, explorable };
  function observe(item: SampleInteraction) { if (!interactive) return; keys.current.clear(); setNote(item); }
  useEffect(() => {
    if (!ready || world.status !== "ready" || world.busy || world.pending || world.motion || !world.view || world.restore?.key !== restoredKey || sceneError) return;
    // Pause movement while the arrival commits, but retain physically held
    // movement keys. Clearing them here loses the keydown at fast door crossings.
    if (world.view.sceneId !== sceneId) void world.command({ kind: "arrive", sceneId });
  }, [ready, world.status, world.busy, world.pending, world.motion, world.view, world.restore?.key, world.command, restoredKey, sceneId, sceneError]);
  useEffect(() => {
    if (note) { previousFocus.current = document.activeElement as HTMLElement; keys.current.clear(); closeRef.current?.focus(); }
    else previousFocus.current?.focus();
  }, [note]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || (event.target instanceof HTMLElement && event.target.matches("input,textarea,select,[contenteditable=true]"))) return;
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) { event.preventDefault(); if (!live.current.note && live.current.explorable) keys.current.add(key); }
      if (event.repeat) return;
      if (key === "escape") setNote(null);
      if (!live.current.note && live.current.explorable) {
        if (key === "1") setMode("explore");
        if (key === "2") setMode("detail");
        if (key === "3") setMode("overview");
        if (key === "4" && live.current.interactive) setNote("journal");
        if (key === "5" && live.current.interactive) setReset(value => value + 1);
        if (key === "e" && live.current.interactive && live.current.nearby) { keys.current.clear(); setNote(live.current.nearby); }
      }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    const clear = () => keys.current.clear();
    addEventListener("keydown", down); addEventListener("keyup", up); addEventListener("blur", clear); document.addEventListener("visibilitychange", clear);
    return () => { removeEventListener("keydown", down); removeEventListener("keyup", up); removeEventListener("blur", clear); document.removeEventListener("visibilitychange", clear); };
  }, []);
  const title = room?.id === "bookshop" ? "格雷福德旧书店" : room?.id === "station" ? "河湾车站" : room?.id === "inn" ? "铁路旅馆" : "河湾铁路街区";
  const modes = [{ id: "explore" as const, label: "步行探索", icon: Footprints }, { id: "detail" as const, label: "近景观察", icon: Search }, { id: "overview" as const, label: "街区全景", icon: Landmark }];
  const wait = () => { keys.current.clear(); void world.command({ kind: "work-step" }); };
  return <main id="detective-town-main" className={styles.world} data-living-town data-world-scene={world.view?.sceneId ?? ""} data-world-time={world.view?.time ?? ""}>
    <Scene keys={keys} mode={mode} paused={!!note || !explorable} reset={reset} living={{ view: world.view, restore: world.restore, motion: world.motion }} onMotionComplete={world.finishMotion} focusActorId={activePerson?.actorId} onPositionRestored={(key, place) => { setRestoredKey(key); setRoom(place); }} onWorkChange={() => {}} onReady={() => setReady(true)} onError={setSceneError} onChange={(place, item) => { setRoom(place); setNearby(item); }} />
    <div className={styles.edgeShade} />
    <header className={styles.title}><div className={styles.crest}><Compass aria-hidden="true" /></div><div><span className={styles.kicker}>居民日常 · 古典街区试演</span><h1>{title}</h1><p>旧书、车次与旅人的姓名</p></div></header>
    <div className={styles.weather} aria-live="polite"><Clock3 size={18} aria-hidden="true" /><span>{world.view ? `第 ${world.view.day} 天 · ${world.view.time}` : "一个新的上午"}</span><i /><span>{world.busy ? "日程推进中…" : "柔光阴天"}</span></div>
    <a className={styles.back} href="/town-play/art-sample"><ArrowLeft size={14} aria-hidden="true" />美术样板</a>
    {(!ready || world.status === "loading") && !sceneError && <div className={styles.loading} role="status"><Compass size={30} /><p>正在打开河湾的街角…</p></div>}
    {ready && world.status === "new" && !sceneError && <section className={`${styles.loading} ${living.intro}`}><span className={styles.kicker}>河湾的一个上午</span><h2>每个人都有手头的事。</h2><p>走进旧书店、车站与旅馆。<br />等候片刻，或请忙碌的人停一停。</p><button disabled={world.busy} onClick={() => void world.start()}>开始这段日常</button><small>这段日常单独保存，再次打开可继续。</small></section>}
    {(sceneError || world.status === "error") && <div className={styles.loading} role="alert"><p>{sceneError || world.message}</p><button onClick={() => sceneError ? location.reload() : void world.reload()}>重新连接</button></div>}
    {world.status === "ready" && world.message && <div className={living.notice} role="alert"><span>{world.message}</span><button disabled={world.busy} onClick={() => void world.retry()}>重试这一步</button></div>}
    {world.motion && <div className={living.notice} role="status"><span>有人经过。可以侧身让路，等他走过门口。</span><button onClick={() => world.finishMotion(world.motion!.id)}>略过行走</button></div>}
    {ready && world.view && <>
      <aside className={styles.instructions}><span>给生活一点时间。</span><p><kbd>W A S D</kbd> / 方向键移动</p><p>到访、等候与打招呼会推进日程</p></aside>
      {nearby && !note && interactive && <button className={styles.interact} onClick={() => observe(nearby)}><kbd>E</kbd>{nearby.label}<span>↗</span></button>}
      <nav className={styles.toolbar} aria-label="居民日常工具栏">
        {modes.map(({ id, label, icon: Icon }, index) => <button key={id} aria-label={label} aria-pressed={mode === id} disabled={!explorable} onClick={() => setMode(id)}><small>{index + 1}</small><Icon aria-hidden="true" /><span>{label}</span></button>)}
        <span className={styles.divider} />
        <button aria-label="查看日常手记" disabled={!interactive} onClick={() => setNote("journal")}><small>4</small><BookOpen aria-hidden="true" /><span>手记</span></button>
        <button aria-label="回到街角" disabled={!interactive} onClick={() => setReset(value => value + 1)}><small>5</small><RotateCcw aria-hidden="true" /><span>归位</span></button>
        <button aria-label="等候五分钟" disabled={!interactive} onClick={wait}><Clock3 aria-hidden="true" /><span>等候 5 分</span></button>
      </nav>
      <div className={styles.touch} aria-label="触控移动">{[["w", "↑"], ["a", "←"], ["s", "↓"], ["d", "→"]].map(([key, glyph]) => <button key={key} disabled={!explorable || !!note} aria-label={{ w: "向前", a: "向左", s: "向后", d: "向右" }[key]} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); keys.current.add(key); }} onPointerUp={() => keys.current.delete(key)} onPointerCancel={() => keys.current.delete(key)} onLostPointerCapture={() => keys.current.delete(key)}>{glyph}</button>)}</div>
    </>}
    {note && <div className={`${styles.scrim} ${typeof note === "object" && note.actorId ? styles.portraitScrim : ""}`} onClick={() => setNote(null)}><section className={styles.note} role="dialog" aria-modal="true" aria-labelledby="living-note-title" onClick={event => event.stopPropagation()} onKeyDown={event => {
      if (event.key !== "Tab") return;
      const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault(); items[(index + (event.shiftKey ? -1 : 1) + items.length) % items.length]?.focus();
    }}>
      <button className={styles.close} ref={closeRef} aria-label="合上日常手记" onClick={() => setNote(null)}><X size={21} /></button>
      <span className={styles.kicker}>铁路街角 · 日常手记</span>
      <h2 id="living-note-title">{note === "journal" ? "眼前的人与事" : note.label}</h2>
      <p>{note === "journal" ? "居民会工作、休息，也会按日程离开。只有走到同一处地点，你才知道他们此刻在做什么。" : note.description}</p>
      {activePerson && <div className={living.workState} role="status"><span>{world.motion ? "有人正从这里经过" : activePerson.work?.label ?? "正在这里停留"}</span>{!world.motion && activePerson.work?.status === "working" && <><strong>{activePerson.work.progress}%</strong><progress max={100} value={activePerson.work.progress} aria-label="当前工作进度" /></>}</div>}
      {typeof note === "object" && note.actorId && !activePerson && <p role="status">此刻已经看不到这位居民。上次见面的地点仍记在手记里。</p>}
      {activePerson?.work?.status === "working" && <button className={styles.workAction} disabled={!interactive} onClick={() => void world.command({ kind: "work-interrupt", npcId: activePerson.npcId })}>打个招呼 · 5 分钟</button>}
      <button className={styles.workAction} disabled={!interactive} onClick={wait}><Clock3 size={17} aria-hidden="true" />等候五分钟，看看变化</button>
      {note === "journal" && <>
        <dl>{world.view?.residents.map(person => <div key={person.npcId}><dt>{person.name}</dt><dd>{person.visibility === "observed" ? `${person.locationName} · ${person.work?.label ?? "正在这里"}` : `上次见于${person.locationName}，${person.time}`}</dd></div>)}</dl>
        {!world.view?.residents.length && <p>尚未遇见居民。先去旧书店看看。</p>}
        <p className={styles.boundary}>三人日常试演。许知微查看旧书、顾远山核对时刻表、林阿梨填写住客登记，动作会随工作状态变化。这里尚未接入正式案件，也尚未完成真实模型验收。</p>
      </>}
      <span className={styles.rule} />
    </section></div>}
  </main>;
}
