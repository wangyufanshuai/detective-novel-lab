"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { DoorOpen, Flame, Footprints, Maximize, Snowflake, X, BookOpen, RotateCcw, ChevronLeft, Eye } from "lucide-react";
import type { ManorMode, ManorQuality } from "./ManorScene";
import type { SampleInteraction } from "../town-play/art-sample/sample-navigation";
import styles from "./manor.module.css";

const Scene = dynamic(() => import("./ManorScene"), { ssr: false });
const notes: Record<string, string> = {
  hearth: "石砌壁炉前摆着一组会客座椅。座钟立在炉台中央，镜面映着室内的暖光。",
  register: "登记簿放在门边的木桌上，台灯照亮了纸页。这里将是抵达山庄时的第一处停留。",
  tea: "茶壶、茶杯和折起的报纸留在桌上。两把扶手椅与沙发围着这里，壁炉的暖光落在桌沿。",
  luggage: "旅行箱停在入口右侧。来客尚未出现，山庄里的故事还没有开始。",
  dining: "这扇门通往西翼餐厅。当前只开放门前和大厅，餐厅将在后续制作。",
  guest: "门后预留了客房廊道。客房与住客活动将在后续制作。",
};

export default function SnowboundManor() {
  const [mode, setMode] = useState<ManorMode>("gate"), [quality, setQuality] = useState<ManorQuality>("high");
  const [ready, setReady] = useState(false), [progress, setProgress] = useState("正在打开山庄…"), [error, setError] = useState("");
  const [weather, setWeather] = useState(true), [room, setRoom] = useState("山庄门前"), [nearby, setNearby] = useState<SampleInteraction | null>(null);
  const [note, setNote] = useState<{ title: string; body: string } | null>(null), [reset, setReset] = useState(0), [reload, setReload] = useState(0);
  const keys = useRef(new Set<string>()), root = useRef<HTMLElement>(null), closeButton = useRef<HTMLButtonElement>(null), dialog = useRef<HTMLElement>(null);
  const latest = useRef({ nearby, note, ready }); latest.current = { nearby, note, ready };
  const choose = (next: ManorMode) => { keys.current.clear(); setNearby(null); setMode(next); };
  const observe = () => { const item = latest.current.nearby; if (item) { keys.current.clear(); setNote({ title: item.label, body: notes[item.id] ?? item.description }); } };
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) setWeather(false);
    const down = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === "Escape") { setNote(null); keys.current.clear(); return; }
      if (latest.current.note || !latest.current.ready) return;
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) { event.preventDefault(); keys.current.add(event.code); }
      if (!event.repeat) {
        if (event.code === "Digit1") choose("gate");
        if (event.code === "Digit2") choose("hall");
        if (event.code === "Digit3") choose("walk");
        if (event.code === "KeyE") observe();
      }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code), clear = () => keys.current.clear();
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", clear); document.addEventListener("visibilitychange", clear);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", clear); document.removeEventListener("visibilitychange", clear); };
  }, []);
  useEffect(() => {
    if (!note) return;
    const before = document.activeElement as HTMLElement | null; closeButton.current?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = dialog.current?.querySelectorAll<HTMLElement>("button,a[href],[tabindex='0']");
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", trap);
    return () => { window.removeEventListener("keydown", trap); before?.focus(); };
  }, [note]);
  const resetView = () => { choose("walk"); setReset(v => v + 1); };
  const help = () => setNote({ title: "暴风雪之夜", body: "这是雪松山庄的三维场景，目前开放门前与壁炉大厅。选择“步行查看”，用 W A S D 移动，按住画面拖动环顾；也可以用方向键前后移动、左右转向。靠近陈设后按 E 查看。人物、案件与客房尚在后续制作中。" });
  return <main ref={root} className={styles.world} lang="zh-CN" data-manor-page="true">
    <Scene key={reload} keys={keys} mode={mode} quality={quality} paused={!!note || !!error} weather={weather} reset={reset}
      onProgress={setProgress} onReady={() => setReady(true)} onError={message => { setError(message); setReady(false); }}
      onChange={(name, item) => { setRoom(name); setNearby(item); }} />
    <div className={styles.shade} />
    <header className={styles.title}>
      <span className={styles.kicker}>CEDAR HOLLOW · WINTER</span>
      <h1>雪松山庄</h1>
      <p><Snowflake size={13} aria-hidden="true" /> 暴风雪之夜 <i /> {room}</p>
    </header>
    <div className={styles.topActions}>
      <button onClick={help} aria-label="查看场景说明"><BookOpen size={17} /><span>场景手记</span></button>
      <a href="/town-play"><ChevronLeft size={15} /> 返回小镇</a>
    </div>
    {ready && <>
      <div className={styles.instructions}>
        <span>{mode === "gate" ? "风雪之外，一盏灯还亮着。" : mode === "hall" ? "先在壁炉旁，停留片刻。" : "慢慢走，看看这座山庄。"}</span>
        {mode === "walk" ? <p><kbd>W A S D</kbd> 移动 <b>·</b> 拖动环顾 <b>·</b> <kbd>← →</kbd> 转向</p> : <p>选择下方视角，或步行进入大厅</p>}
      </div>
      <nav className={styles.toolbar} aria-label="场景视角">
        <button aria-pressed={mode === "gate"} onClick={() => choose("gate")}><small>1</small><DoorOpen /><span>门前全景</span></button>
        <button aria-pressed={mode === "hall"} onClick={() => choose("hall")}><small>2</small><Flame /><span>壁炉大厅</span></button>
        <button aria-pressed={mode === "walk"} onClick={() => choose("walk")}><small>3</small><Footprints /><span>步行查看</span></button>
        <i />
        <button className={styles.reset} onClick={resetView} aria-label="回到入口重新步行"><RotateCcw /><span>回到入口</span></button>
      </nav>
      <div className={styles.settings}>
        <button onClick={() => setWeather(v => !v)} aria-pressed={weather} aria-label="风雪动态"><Snowflake size={16} /><span>风雪</span></button>
        <button onClick={() => { setReady(false); setQuality(v => v === "high" ? "balanced" : "high"); }} aria-label={`画质：${quality === "high" ? "细腻" : "流畅"}，点击切换`}>{quality === "high" ? "细腻" : "流畅"}</button>
        <button onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void root.current?.requestFullscreen().catch(() => {}); }} aria-label="切换全屏"><Maximize size={16} /></button>
      </div>
      {mode === "walk" && nearby && <button className={styles.observe} onClick={observe}><kbd>E</kbd><Eye size={16} /> 查看{nearby.label}</button>}
      {mode === "walk" && <div className={styles.touch} aria-label="触屏移动">
        {[["KeyW", "前进", "↑"], ["KeyA", "左移", "←"], ["KeyS", "后退", "↓"], ["KeyD", "右移", "→"]].map(([code, label, arrow]) => <button key={code} aria-label={label} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); keys.current.add(code); }} onPointerUp={() => keys.current.delete(code)} onPointerCancel={() => keys.current.delete(code)} onLostPointerCapture={() => keys.current.delete(code)}>{arrow}</button>)}
      </div>}
    </>}
    {!ready && <div className={styles.loading} role={error ? "alert" : "status"}>
      <span className={styles.kicker}>CEDAR HOLLOW</span><p>{error || progress}</p>
      {error ? <button onClick={() => { setError(""); setReload(v => v + 1); }}>重新载入</button> : <span className={styles.loadingLine} />}
    </div>}
    {note && <div className={styles.scrim} onClick={event => { if (event.target === event.currentTarget) setNote(null); }}>
      <section ref={dialog} className={styles.note} role="dialog" aria-modal="true" aria-labelledby="manor-note-title">
        <button ref={closeButton} className={styles.close} onClick={() => setNote(null)} aria-label="关闭手记"><X size={20} /></button>
        <span className={styles.kicker}>雪松山庄 · 场景手记</span><h2 id="manor-note-title">{note.title}</h2><p>{note.body}</p><i />
        <button className={styles.continue} onClick={() => setNote(null)}>继续查看</button>
      </section>
    </div>}
  </main>;
}
