import type { RefObject } from "react";
import type { CampaignBeatPresentation } from "@/app/campaign/campaign-transition-model";
import styles from "./CampaignTransitionTheatre.module.css";

export function CampaignTransitionTheatre({ presentation, headingRef, onSkip, onDismiss }: {
  presentation: CampaignBeatPresentation;
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
          <p>{presentation.detail}</p>
          <strong>{presentation.supportingDetail}</strong>
        </div>
        {presentation.phase === "immediate-result" && <dl className={styles.forecast}>
          <div><dt>Visible benefit</dt><dd>{presentation.benefitLabel}</dd></div>
          <div><dt>Recorded cost</dt><dd>{presentation.costLabel}</dd></div>
        </dl>}
        {presentation.phase === "world-consequence" && <dl className={styles.forecast}>
          <div><dt>World surface</dt><dd>{presentation.costLabel}</dd></div>
          <div><dt>Still fair</dt><dd>{presentation.fairnessLabel}</dd></div>
        </dl>}
        {presentation.phase === "next-objective" && <dl className={styles.forecast}>
          <div><dt>Next objective</dt><dd>{presentation.nextObjective}</dd></div>
          <div><dt>Authority boundary</dt><dd>{presentation.fairnessLabel}</dd></div>
        </dl>}
      </div>
      <footer className={styles.actions}>
        {presentation.phase === "action-resolving" ? <span className={styles.resolving}><i aria-hidden="true" />Existing handler in progress</span> : null}
        {presentation.canSkip ? <button type="button" onClick={onSkip}>Skip to next</button> : null}
        {presentation.canDismiss ? <button type="button" className={styles.primary} onClick={onDismiss}>{presentation.phase === "action-resolving" ? "Hide while resolving" : "Continue"}</button> : null}
      </footer>
    </section>
  );
}
