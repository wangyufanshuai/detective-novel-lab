import type { RefObject } from "react";
import type { CampaignBeatPresentation } from "@/app/campaign/campaign-transition-model";
import type { CampaignResolutionLedger } from "@/app/campaign/campaign-resolution-ledger-model";
import { CampaignResolutionChain } from "./CampaignResolutionLedger";
import styles from "./CampaignTransitionTheatre.module.css";

export function CampaignTransitionTheatre({ presentation, ledger, headingRef, onSkip, onDismiss }: {
  presentation: CampaignBeatPresentation;
  ledger: CampaignResolutionLedger;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onSkip: () => void;
  onDismiss: () => void;
}) {
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
      aria-label="Campaign result presentation"
    >
      <header className={styles.heading}>
        <div><span>{presentation.eyebrow}</span><small>{presentation.focusLabel}</small></div>
        <b>{presentation.phase.replaceAll("-", " ")}</b>
      </header>
      <ol className={styles.phaseRail} aria-label="Campaign result stages">
        {presentation.phaseLabels.map((label, index) => (
          <li key={label} data-active={index === presentation.phaseIndex ? "true" : undefined} data-complete={index < presentation.phaseIndex ? "true" : undefined}>
            <span aria-hidden="true" />{label}
          </li>
        ))}
      </ol>
      <div className={styles.content}>
        <div className={styles.copy}>
          <h2 ref={headingRef} tabIndex={-1}>{presentation.title}</h2>
          <p>{ledger.latest.actionLabel}</p>
          <strong>{ledger.authorityNote}</strong>
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
        {presentation.phase === "action-resolving" ? <span className={styles.resolving}><i aria-hidden="true" />Existing handler in progress</span> : null}
        {presentation.canSkip ? <button type="button" onClick={onSkip}>Skip to next</button> : null}
        {presentation.canDismiss ? <button type="button" className={styles.primary} onClick={onDismiss}>{presentation.phase === "action-resolving" ? "Hide while resolving" : "Continue"}</button> : null}
      </footer>
    </section>
  );
}
