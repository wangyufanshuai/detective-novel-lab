"use client";

import { Fragment, useEffect, useState } from "react";
import type { GuideStep } from "./town-guide";
import styles from "./town-play.module.css";

type Props = { step: GuideStep; index: number; total: number; finishing: boolean; onSkip: () => void };

/** 「W」 becomes a key cap; other 「…」 stay as quoted emphasis. */
function rich(text: string) {
  return text.split(/(「[^」]+」)/).map((part, i) => {
    const inner = /^「([^」]+)」$/.exec(part)?.[1];
    if (!inner) return <Fragment key={i}>{part}</Fragment>;
    return /^[A-Z]$/.test(inner) ? <kbd key={i}>{inner}</kbd> : <b key={i}>「{inner}」</b>;
  });
}

/** The current guide step. It finishes when the player does it; there is no "next". */
export function TownGuideCard({ step, index, total, finishing, onSkip }: Props) {
  const [touch, setTouch] = useState(false);
  useEffect(() => { setTouch(window.matchMedia("(pointer: coarse)").matches); }, []);
  return <aside className={styles.guide} aria-label="新手引导" data-finishing={finishing}>
    <div className={styles.guideHead}>
      <span className={styles.eyebrow}>新手引导 · {index + 1}/{total}</span>
      <button className={styles.textButton} onClick={onSkip}>跳过引导</button>
    </div>
    <strong aria-live="polite">{finishing ? <span className={styles.guideTick} aria-label="完成">✓</span> : null}{step.title}</strong>
    <p>{rich(touch ? step.touch : step.text)}</p>
    <ol className={styles.guideDots} aria-hidden="true">{Array.from({ length: total }, (_, i) => <li key={i} data-state={i < index || (i === index && finishing) ? "done" : i === index ? "now" : "todo"} />)}</ol>
  </aside>;
}
