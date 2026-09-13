"use client";

import { BookOpenCheck, FileText, LockKeyhole } from "lucide-react";
import { buildFirstCaseSolutionReview } from "@/app/campaign/first-case-solution-review-model";
import { useAppLocale } from "@/app/localization/locale-context";
import { getNoirEvidenceArt, getNoirPortrait } from "@/app/campaign/noir-player-assets";
import styles from "./FirstCaseSolutionReview.module.css";

export function FirstCaseSolutionReview({ accepted, revealText }: { accepted: boolean; revealText?: string }) {
  const { locale, text } = useAppLocale();
  const cn = locale === "zh-CN";
  const model = buildFirstCaseSolutionReview({ accepted, revealText, localize: text });
  const portrait = model.state === "structured" ? getNoirPortrait(model.culprit) : null;
  return (
    <section className={styles.review} data-testid="first-case-solution-review" data-unlocked={model.state !== "locked"}>
      <header className={styles.reviewHeader}><span>{cn ? "雾灯镇 · 结案档案" : "FOGLAMP TOWN · CASE RECORD"}</span><h2>{cn ? "复核解答" : "Answer review"}</h2><div className={styles.stamp}>{model.state === "locked" ? cn ? "尚未解封" : "SEALED" : cn ? "解答已公开" : "ANSWER REVEALED"}</div></header>
      {model.state === "locked" ? (
        <div className={styles.locked}><LockKeyhole size={60} strokeWidth={1} /><h3>{cn ? "真相，需要证据支持。" : "The truth needs evidence."}</h3><p>{cn ? "结论通过后，执行“复核解答”即可查看本案返回的解答。" : "After your conclusion is accepted, use Answer review to read this case's returned answer."}</p></div>
      ) : model.state === "structured" ? (
        <>
          <p className={styles.intro}>{cn ? "以下内容来自本案已返回的解答。" : "The following details come from this case's returned answer."}</p>
          <div className={styles.answerGrid}>
            <article className={styles.culprit}>{portrait ? <img src={portrait.src} alt={portrait.alt} /> : <div className={styles.portraitPlaceholder}><BookOpenCheck size={68} strokeWidth={.75} /></div>}<span>{cn ? "凶手" : "Culprit"}</span><b>{model.culprit}</b></article>
            <div className={styles.reasoning}><article><span>01 / {cn ? "动机" : "MOTIVE"}</span><h3>{cn ? "为什么发生" : "The motive"}</h3><p>{model.motive}</p></article><article><span>02 / {cn ? "手法" : "METHOD"}</span><h3>{cn ? "案件如何发生" : "How it happened"}</h3><p>{model.method}</p></article></div>
          </div>
          <section className={styles.evidenceRecord} data-testid="first-case-returned-evidence">
            <header><span>03 / {cn ? "关键证据" : "KEY EVIDENCE"}</span><h3>{cn ? "留下来的事实" : "The facts that remain"}</h3></header>
            <div className={styles.evidenceGrid}>{model.evidenceTitles.map((title, index) => { const art = getNoirEvidenceArt(title); return <article key={`${index}-${title}`}><div>{art ? <img src={art.src} alt={art.alt} /> : <FileText size={45} strokeWidth={1} />}</div><span>{String(index + 1).padStart(2, "0")}</span><p>{title}</p></article>; })}</div>
            <p className={styles.sourceNote}>{cn ? "本案解答列出了这些关键证据，尚未逐条说明它们如何支持动机或手法。" : "The returned answer lists these key clues but does not explain each clue's link to motive or method."}</p>
          </section>
        </>
      ) : (
        <>
          <p>{cn ? "解答采用了其他格式，以下保留返回的正文。" : "This answer uses another format. Its returned text is preserved below."}</p>
          <div className={styles.returnedText}>{model.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
        </>
      )}
    </section>
  );
}
