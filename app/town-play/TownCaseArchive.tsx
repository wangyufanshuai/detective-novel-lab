"use client";
import { useState } from "react";
import type { TownCaseSeriesView, TownClosedCaseView } from "@/lib/town-play-contract";
import type { ArchivedCase } from "./case-archive";
import styles from "./town-play.module.css";

export function TownArchiveList({ closedCases, entries, message, onRead, loading = false }: { closedCases: TownClosedCaseView[]; entries: ArchivedCase[]; message: string; onRead: (id: string) => void; loading?: boolean }) {
  if (!closedCases.length && !message) return null;
  return <section className={styles.archiveShelf} aria-label="已结案手记">
    <h3>已结案手记</h3><p className={styles.quiet}>完整记录仅在当前浏览器留存，可回看或导出。清理浏览器数据或换设备后可能丢失，请导出保留。</p>
    {message && <p role="status" className={styles.quiet}>{message}</p>}
    <ul>{closedCases.map(c => <li key={c.id}><div><small>{c.ordinal}</small><strong>{c.title}</strong><span>已归档 · {c.person}</span></div>{loading ? <span className={styles.quiet}>正在读取本机留存…</span> : entries.some(e => e.id === c.id) ? <button className={styles.textButton} onClick={() => onRead(c.id)} aria-label={`回看${c.title}的本机留存`}>回看本机留存 →</button> : <span className={styles.quiet}>本机尚无完整记录</span>}</li>)}</ul>
  </section>;
}

export function TownArchivedCase({ entry: c, onBack, onExport }: { entry: ArchivedCase; onBack: () => void; onExport: () => void }) {
  const [tab, setTab] = useState("ending");
  return <section className={styles.caseWork} aria-label="已结案手记回看">
    <div className={styles.archiveActions}><button className={styles.textButton} onClick={onBack}>← 返回手记</button><button className={styles.textButton} onClick={onExport}>导出这宗手记 ↓</button></div>
    <div className={styles.caseHeading}><div><span className={styles.eyebrow}>本机留存 · {c.ordinal}</span><h3>{c.title}</h3></div><span className={styles.caseSeal}>已结案</span></div>
    <p className={styles.quiet}>这是结案时留在本浏览器的记录，不会改变当前调查。结案人：{c.person}。</p>
    <div className={styles.caseTabs} aria-label="归档页签">{[{id:"ending",label:"完整经过"},{id:"clues",label:`物证 ${c.clues.length}`},{id:"testimony",label:`证词 ${c.conversations.length}`}].map(t => <button key={t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>
    {tab === "ending" && <div className={styles.caseEnding}><h4>{c.headline}</h4><p>{c.motive}</p><p>{c.method}</p><ol>{c.timeline.map((t,i) => <li key={i}><time>{t.time}</time><span>{t.event}</span></li>)}</ol><h4>后来</h4>{c.ending.map((text,i) => <p key={i}>{text}</p>)}</div>}
    {tab === "clues" && <div className={styles.clueCards}>{c.clues.map(e => <article key={e.id}><h4>{e.title}</h4><p>{e.description}</p></article>)}</div>}
    {tab === "testimony" && <div className={styles.clueCards}>{c.conversations.map((l,i) => <article key={i}><small>{l.corrected ? "说法已更正" : "当面记录"}</small><h4>{l.name}</h4><p className={styles.questionLine}>{l.question}</p><p>{l.answer}</p></article>)}</div>}
  </section>;
}

const STATE_WORD = { closed: "已结案", active: "调查中", next: "下一宗", later: "未开" } as const;

/** Game time left in the notebook, in words. */
export function timeLeftWords(minutes: number) {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h ? (m ? `${h} 小时 ${m} 分` : `${h} 小时`) : `${m} 分钟`;
}

/** A reminder once the notebook's days are nearly spent; null while there is room. */
export function seriesWarning(series: TownCaseSeriesView | null | undefined) {
  if (!series || series.cases.every(c => c.state === "closed")) return null;
  if (series.minutesLeft <= 0) return "河湾手记的日程到此为止。";
  if (series.minutesLeft > 6 * 60) return null;
  return `河湾手记还剩 ${timeLeftWords(series.minutesLeft)}，第 ${series.endsAt.day} 天 ${series.endsAt.time} 合上。`;
}

/** The whole case series grouped by day: what is done, what is open, what waits. */
export function TownCaseSeries({ series, day }: { series: TownCaseSeriesView; day: number }) {
  const closed = series.cases.filter(c => c.state === "closed").length;
  const today = series.cases.filter(c => c.day === day && c.state !== "closed").length;
  const days = [...new Set(series.cases.map(c => c.day))].sort((a, b) => a - b);
  const warning = seriesWarning(series);
  return <section className={styles.caseSeries} aria-label="河湾案件进度">
    <h3>河湾案件 <small>已结 {closed} / {series.cases.length} 宗</small></h3>
    <p className={styles.quiet}>{closed === series.cases.length ? "十宗都已归档。" : `${today ? `今天还有 ${today} 宗。` : "今天的案件已经结完。"}手记在第 ${series.endsAt.day} 天 ${series.endsAt.time} 合上。`}</p>
    {warning && <p className={styles.seriesWarning} role="status">{warning}</p>}
    {days.map(d => <div key={d} className={styles.seriesDay} data-today={d === day}>
      <span className={styles.eyebrow}>第 {d} 天{d === day ? " · 今天" : ""}</span>
      <ol>{series.cases.filter(c => c.day === d).map(c => <li key={c.ordinal} data-state={c.state}><small>{c.ordinal}</small><strong>{c.title ?? (c.state === "next" ? "等待领取" : "尚未开启")}</strong><span>{STATE_WORD[c.state]}</span></li>)}</ol>
    </div>)}
  </section>;
}
