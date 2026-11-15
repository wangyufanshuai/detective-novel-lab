"use client";
import { useState } from "react";
import type { TownClosedCaseView } from "@/lib/town-play-contract";
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
