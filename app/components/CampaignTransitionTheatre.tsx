"use client";

import type { RefObject } from "react";
import type { CampaignBeatPresentation } from "@/app/campaign/campaign-transition-model";
import type { CampaignResolutionLedger } from "@/app/campaign/campaign-resolution-ledger-model";
import { CampaignResolutionChain } from "./CampaignResolutionLedger";
import { useAppLocale } from "@/app/localization/locale-context";
import styles from "./CampaignTransitionTheatre.module.css";

export function CampaignTransitionTheatre({ presentation, ledger, headingRef, onSkip, onDismiss }: {
  presentation: CampaignBeatPresentation;
  ledger: CampaignResolutionLedger;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onSkip: () => void;
  onDismiss: () => void;
}) {
  const { t, text } = useAppLocale();
  if (!presentation.visible) return null;
  return (
    <section
      className={`${styles.theatre} ${styles[presentation.tone]}`}
      data-testid="campaign-transition-theatre"
      data-transition-phase={presentation.phase}
      data-transition-kind={presentation.kind}
      data-transition-tone={presentation.tone}
      data-resolution-ledger-status={ledger.status}
      aria-live={presentation.phase === "action-resolving" ? "polite" : "assertive"}
      aria-label={t("theatre.aria")}
    >
      <header className={styles.heading}>
        <div><span>{text(presentation.eyebrow)}</span><small>{text(presentation.focusLabel)}</small></div>
        <b>{text(presentation.phase.replaceAll("-", " "))}</b>
      </header>
      <ol className={styles.phaseRail} aria-label={t("theatre.stages")}>
        {presentation.phaseLabels.map((label, index) => (
          <li key={label} data-active={index === presentation.phaseIndex ? "true" : undefined} data-complete={index < presentation.phaseIndex ? "true" : undefined}>
            <span aria-hidden="true" />{text(label)}
          </li>
        ))}
      </ol>
      <div className={styles.content}>
        <div className={styles.copy}>
          <h2 ref={headingRef} tabIndex={-1}>{text(presentation.title)}</h2>
          <p>{text(ledger.latest.actionLabel)}</p>
          <strong>{text(ledger.authorityNote)}</strong>
        </div>
        <CampaignResolutionChain
          entry={ledger.latest}
          testId="campaign-transition-resolution"
          mode="theatre"
          activeField={presentation.phase === "world-consequence"
            ? "worldChange"
            : presentation.phase === "next-objective"
              ? "nextAction"
              : "result"}
        />
      </div>
      <footer className={styles.actions}>
        {presentation.phase === "action-resolving" ? <span className={styles.resolving}><i aria-hidden="true" />{t("theatre.progress")}</span> : null}
        {presentation.canSkip ? <button type="button" onClick={onSkip}>{t("theatre.skip")}</button> : null}
        {presentation.canDismiss ? <button type="button" className={styles.primary} onClick={onDismiss}>{presentation.phase === "action-resolving" ? t("theatre.hide") : t("common.continue")}</button> : null}
      </footer>
    </section>
  );
}
