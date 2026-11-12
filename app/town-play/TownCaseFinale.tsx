"use client";

import { useEffect, useRef } from "react";
import type { TownCaseView, TownCommissionView } from "@/lib/town-play-contract";
import styles from "./town-play.module.css";

type Props = {
  investigation: TownCaseView;
  commission?: TownCommissionView | null;
  onRead: () => void;
  onClose: () => void;
};

/**
 * The moment a case closes: a stamped dossier over whatever is open. It is its
 * own modal so the case book underneath keeps its state; Escape or either
 * button dismisses it. Shown once, when the verdict is accepted in this visit.
 */
export function TownCaseFinale({ investigation: c, commission, onRead, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
    primary.current?.focus();
  }, []);
  if (!c.resolution) return null;
  const r = c.resolution;
  return <dialog ref={dialog} className={styles.finale} aria-labelledby="town-finale-title" onCancel={e => { e.preventDefault(); onClose(); }}>
    <div className={styles.finalePaper}>
      <span className={styles.finaleStamp} aria-hidden="true">结案</span>
      <span className={styles.eyebrow}>河湾 · {c.ordinal} · {c.title}</span>
      <h2 id="town-finale-title">{r.headline}</h2>
      <dl className={styles.finaleFacts}>
        <dt>动机</dt><dd>{r.motive}</dd>
        <dt>手法</dt><dd>{r.method}</dd>
      </dl>
      {r.ending[0] && <p className={styles.finaleEnding}>{r.ending[0]}</p>}
      {commission && <p className={styles.finaleNext}><small>新委托 · {commission.ordinal}</small>{commission.hook}</p>}
      <div className={styles.finaleActions}>
        <button ref={primary} className={styles.primary} onClick={onRead}>读完整的经过 →</button>
        <button className={styles.textButton} onClick={onClose}>回到小镇</button>
      </div>
    </div>
  </dialog>;
}
