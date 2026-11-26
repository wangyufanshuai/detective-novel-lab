"use client";
import { useEffect, useRef, useState } from "react";
import type { TownCaseSeriesView, TownClosedCaseView } from "@/lib/town-play-contract";
import styles from "./town-play.module.css";

/** The notebook closes when its days are spent or every case is filed. */
export function notebookClosed(series: TownCaseSeriesView | null | undefined) {
  return !!series && (series.minutesLeft <= 0 || series.cases.every(c => c.state === "closed"));
}

type Props = {
  series: TownCaseSeriesView; closedCases: TownClosedCaseView[]; busy: boolean;
  onJournal: () => void; onExport: () => void; onFresh: () => Promise<void>; onClose?: () => void;
};

export function TownNotebookEnd({ series, closedCases, busy, onJournal, onExport, onFresh, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
    primary.current?.focus();
  }, []);
  const byOrdinal = new Map(closedCases.map(c => [c.ordinal, c]));
  const filed = series.cases.filter(c => c.state === "closed").length;
  const all = filed === series.cases.length;
  const sum = (pick: (c: TownClosedCaseView) => number) => closedCases.reduce((n, c) => n + pick(c), 0);
  const days = [...new Set(series.cases.map(c => c.day))].sort((a, b) => a - b);
  return <dialog ref={dialog} className={`${styles.finale} ${styles.notebookEnd}`} aria-labelledby="town-end-title" data-notebook-end={all ? "filed" : "spent"}
    onCancel={e => { e.preventDefault(); onClose?.(); }}>
    <div className={styles.finalePaper}>
      <span className={styles.finaleStamp} aria-hidden="true">{all ? "全卷" : "合上"}</span>
      <span className={styles.eyebrow}>河湾手记 · 第 {series.endsAt.day} 天 {series.endsAt.time}</span>
      <h2 id="town-end-title">{all ? "十宗案件，都已归档。" : "这本手记合上了。"}</h2>
      <p className={styles.quiet}>{all ? "河湾的每一宗委托都有了交代。你可以继续在镇上走走，或者翻开新的一本。" : `三天的日程到此为止。已结 ${filed} 宗，余下 ${series.cases.length - filed} 宗留在了河湾。`}</p>
      <dl className={styles.endTotals}>
        <div><dt>已结</dt><dd>{filed}<small> / {series.cases.length}</small></dd></div>
        <div><dt>物证</dt><dd>{sum(c => c.clues)}<small> / {sum(c => c.totalClues)}</small></dd></div>
        <div><dt>证词</dt><dd>{sum(c => c.testimony)}</dd></div>
        <div><dt>识破</dt><dd>{sum(c => c.corrections)}</dd></div>
      </dl>
      <div className={styles.endDays}>{days.map(d => <section key={d} aria-label={`第 ${d} 天`}>
        <span className={styles.eyebrow}>第 {d} 天</span>
        <ol>{series.cases.filter(c => c.day === d).map(c => {
          const done = byOrdinal.get(c.ordinal);
          return <li key={c.ordinal} data-state={c.state}>
            <small>{c.ordinal}</small>
            <strong>{done?.title ?? c.title ?? "未曾开启"}</strong>
            {done ? <span>{`${done.person} · 物证 ${done.clues}/${done.totalClues}${done.corrections ? ` · 识破 ${done.corrections}` : ""}`}</span> : c.title && <span>{c.state === "active" ? "未结" : "未开启"}</span>}
          </li>;
        })}</ol>
      </section>)}</div>
      {confirming
        ? <div className={styles.endConfirm} role="group" aria-label="确认另起一本">
            <p>新的手记会从第 1 天清晨重新开始。这一本仍留在本机，可先导出保存。</p>
            <div className={styles.finaleActions}>
              <button className={styles.primary} disabled={busy} onClick={() => void onFresh()}>{busy ? "正在翻开…" : "翻开新的一本"}</button>
              <button className={styles.textButton} disabled={busy} onClick={() => setConfirming(false)}>再想想</button>
            </div>
          </div>
        : <div className={styles.finaleActions}>
            <button ref={primary} className={styles.primary} onClick={onJournal}>回看手记 →</button>
            <button className={styles.textButton} onClick={onExport}>导出手记 ↓</button>
            <button className={styles.textButton} onClick={() => setConfirming(true)}>开始新的河湾手记</button>
            {onClose && <button className={styles.textButton} onClick={onClose}>继续在镇上走走</button>}
          </div>}
    </div>
  </dialog>;
}

/** A small way back to the summary once it has been set aside. */
export function TownNotebookEndPill({ onOpen }: { onOpen: () => void }) {
  return <button className={styles.endPill} onClick={onOpen}>手记已合上 · 查看总结</button>;
}
