"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { BookOpen, Compass, Footprints, Landmark, Search, RotateCcw, X, ArrowLeft, Cloud } from "lucide-react";
import type { SampleInteraction, SampleMode, SampleRoom } from "./sample-navigation";
import styles from "./classic-art.module.css";

const Scene = dynamic(() => import("./ClassicScene"), { ssr: false });

export default function ClassicArtSample({ motionPreview = false }: { motionPreview?: boolean } = {}) {
  const keys = useRef(new Set<string>());
  const [mode, setMode] = useState<SampleMode>("overview"), [ready, setReady] = useState(false), [error, setError] = useState("");
  const [room, setRoom] = useState<SampleRoom | null>(null), [nearby, setNearby] = useState<SampleInteraction | null>(null);
  const [note, setNote] = useState<SampleInteraction | "journal" | null>(null), [reset, setReset] = useState(0);
  const [visited, setVisited] = useState<string[]>([]);
  const [workRequest, setWorkRequest] = useState<{ actorId: string; serial: number }>();
  const [workingActor, setWorkingActor] = useState<string | null>(null);
  const [cast, setCast] = useState<SampleInteraction[]>([]);
  const [previewRequest, setPreviewRequest] = useState<{ actorId: string; serial: number }>();
  const [previewActor, setPreviewActor] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null), previousFocus = useRef<HTMLElement | null>(null);
  const live = useRef({ nearby, note });
  useEffect(() => { live.current = { nearby, note }; }, [nearby, note]);
  function observe(item: SampleInteraction) { keys.current.clear(); setVisited(old => old.includes(item.id) ? old : [...old, item.id]); setNote(item); }
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target instanceof HTMLElement && e.target.matches("input,textarea,select,[contenteditable=true]"))) return;
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { e.preventDefault(); if (!live.current.note) keys.current.add(k); }
      if (e.repeat) return;
      if (k === "escape") setNote(null);
      if (!live.current.note) {
        if (k === "1") setMode("explore");
        if (k === "2") setMode("detail");
        if (k === "3") setMode("overview");
        if (k === "4") setNote("journal");
        if (k === "5") setReset(n => n + 1);
        if (k === "e" && live.current.nearby) observe(live.current.nearby);
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const clear = () => keys.current.clear();
    addEventListener("keydown", down); addEventListener("keyup", up); addEventListener("blur", clear); document.addEventListener("visibilitychange", clear);
    return () => { removeEventListener("keydown", down); removeEventListener("keyup", up); removeEventListener("blur", clear); document.removeEventListener("visibilitychange", clear); };
  }, []);
  useEffect(() => {
    if (note) { previousFocus.current = document.activeElement as HTMLElement; keys.current.clear(); closeRef.current?.focus(); }
    else previousFocus.current?.focus();
  }, [note]);
  const modes = [
    { id: "explore" as const, name: "步行探索", icon: Footprints },
    { id: "detail" as const, name: "近景观察", icon: Search },
    { id: "overview" as const, name: "街区全景", icon: Landmark },
  ];
  const roomHeading = room?.id === "station" ? "河湾车站" : room?.id === "bookshop" ? "格雷福德旧书店" : room ? "铁路旅馆" : "河湾铁路街区";
  const roomDescription = room?.id === "station" ? "候车长椅、黄铜票窗与旅人的行李" : room?.id === "bookshop" ? "旧藏、地图册与订书簿" : room ? "会客室 · 木饰、茶具与未寄出的信" : "从车站出发，走进书店与旅馆";
  return <main id="detective-town-main" className={styles.world}>
    <Scene keys={keys} mode={mode} paused={!!note} reset={reset} motionPreview={motionPreview} previewRequest={previewRequest} onPreviewChange={setPreviewActor} onCastReady={setCast} focusActorId={typeof note === "object" && note ? note.actorId : undefined} workRequest={workRequest} onWorkChange={setWorkingActor} onReady={() => setReady(true)} onError={setError} onChange={(nextRoom, item) => { setRoom(nextRoom); setNearby(item); }} />
    <div className={styles.edgeShade} />
    <header className={styles.title}>
      <div className={styles.crest}><Compass aria-hidden="true" /></div>
      <div><span className={styles.kicker}>古典侦探世界 · 铁路街角</span><h1>{roomHeading}</h1><p>{roomDescription}</p></div>
    </header>
    <div className={styles.weather}><Cloud size={19} aria-hidden="true" /><span>柔光阴天</span><i /><span>{room?.label ?? "铁路街角"}</span></div>
    <a className={styles.back} href="/town-play"><ArrowLeft size={14} aria-hidden="true" />返回原小镇</a>
    {!ready && !error && <div className={styles.loading} role="status"><Compass size={30} /><p>正在打开铁路街角…</p></div>}
    {error && <div className={styles.loading} role="alert"><p>{error}</p><button onClick={() => location.reload()}>重新载入</button></div>}
    {ready && <>
      {motionPreview && !note && <nav className={styles.residentChoices} aria-label="居民观察"><span>人物与动线样板</span>{cast.map(item => <button key={item.id} onClick={() => observe(item)}>{item.label}</button>)}</nav>}
      <aside className={styles.instructions}><span>走近，才看得更清楚。</span><p><kbd>W A S D</kbd> / 方向键移动</p><p>{room ? "走近人物或陈设，按 E 观察" : "车站、书店与旅馆均可步行进入"}</p></aside>
      {nearby && !note && <button className={styles.interact} onClick={() => observe(nearby)}><kbd>E</kbd>{nearby.label}<span>↗</span></button>}
      <nav className={styles.toolbar} aria-label="探索工具栏">
        {modes.map(({ id, name, icon: Icon }, i) => <button key={id} aria-label={name} aria-pressed={mode === id} onClick={() => setMode(id)}><small>{i + 1}</small><Icon aria-hidden="true" /><span>{name}</span></button>)}
        <span className={styles.divider} />
        <button aria-label="查看手记" onClick={() => setNote("journal")}><small>4</small><BookOpen aria-hidden="true" /><span>手记</span></button>
        <button aria-label="回到街角起点" onClick={() => setReset(n => n + 1)}><small>5</small><RotateCcw aria-hidden="true" /><span>归位</span></button>
      </nav>
      <div className={styles.touch} aria-label="触控移动">
        {[["w", "↑"], ["a", "←"], ["s", "↓"], ["d", "→"]].map(([key, glyph]) => <button key={key} aria-label={{ w: "向前", a: "向左", s: "向后", d: "向右" }[key]} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); keys.current.add(key); }} onPointerUp={() => keys.current.delete(key)} onPointerCancel={() => keys.current.delete(key)} onLostPointerCapture={() => keys.current.delete(key)}>{glyph}</button>)}
      </div>
    </>}
    {note && <div className={`${styles.scrim} ${typeof note === "object" && note.actorId ? styles.portraitScrim : ""}`} onClick={() => setNote(null)}><section className={styles.note} role="dialog" aria-modal="true" aria-labelledby="note-title" onClick={e => e.stopPropagation()} onKeyDown={e => {
      if (e.key !== "Tab") return;
      const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      e.preventDefault(); items[(index + (e.shiftKey ? -1 : 1) + items.length) % items.length]?.focus();
    }}>
      <button className={styles.close} ref={closeRef} aria-label="合上手记" onClick={() => setNote(null)}><X size={21} /></button>
      <span className={styles.kicker}>铁路街角 · 观察手记</span>
      <h2 id="note-title">{note === "journal" ? "一处可信的侦探空间" : note.label}</h2>
      <p>{note === "journal" ? "本样板用于检验你选定的古典侦探美术方向。街角、房间与人物均有实际制作的三维模型，可以步行进入，并在不同镜头下观察。" : note.description}</p>
      {typeof note === "object" && note.actorId && note.workLabel && <>
        <button className={styles.workAction} disabled={workingActor === note.actorId} onClick={() => setWorkRequest(old => ({ actorId: note.actorId!, serial: (old?.serial ?? 0) + 1 }))}>
          <BookOpen size={17} aria-hidden="true" />{workingActor === note.actorId ? "正在观察工作动作…" : note.workLabel}
        </button>
        <p className={styles.boundary} role="status">{workingActor === note.actorId ? "留意手、目光与道具的配合。" : "工作动作样板 · 可重复查看"}</p>
        {motionPreview && <><button className={styles.workAction} disabled={previewActor === note.actorId} onClick={() => setPreviewRequest(old => ({ actorId: note.actorId!, serial: (old?.serial ?? 0) + 1 }))}><Footprints size={17} aria-hidden="true" />{previewActor === note.actorId ? "正在往返工作台…" : "观察往返工作台"}</button><p className={styles.boundary}>后退、转身、走向门口，再回到工作台。这是动作排练。</p>{previewActor && <button className={styles.workAction} onClick={() => setReset(n => n + 1)}><RotateCcw size={17} aria-hidden="true" />停止并归位</button>}</>}
      </>}
      {note === "journal" && <><dl><div><dt>建筑</dt><dd>砖石、深色店面与有厚度的门窗</dd></div><div><dt>室内</dt><dd>车站候车、书店翻书、旅馆围炉</dd></div><div><dt>已观察</dt><dd>{visited.length} 处</dd></div></dl><p className={styles.boundary}>这是一处美术与步行样板，尚未接入居民的自主行为或正式案件；现有小镇存档保持原样。</p></>}
      <span className={styles.rule} />
    </section></div>}
  </main>;
}
