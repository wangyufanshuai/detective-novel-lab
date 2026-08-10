import type { CertifiedCaseRhythmViewModel } from "@/app/campaign/certified-case-rhythm-model";
import type { PlayableInvestigationPathStep } from "@/app/campaign/investigation-workspace-model";
import styles from "./CertifiedCaseRhythmSurface.module.css";

export function CertifiedCaseRhythmSurface({ rhythm, steps }: {
  rhythm: CertifiedCaseRhythmViewModel;
  steps: PlayableInvestigationPathStep[];
}) {
  return (
    <section className={styles.surface} data-testid="certified-case-rhythm" data-rhythm-state={rhythm.status} data-rhythm-step={rhythm.currentStep.kind}>
      <header className={styles.header}>
        <div><span>Certified Case Rhythm</span><strong>{rhythm.currentStep.label}</strong></div>
        <b>{rhythm.progressLabel}</b>
      </header>
      <ol className={styles.beats} aria-label="Certified case rhythm">
        {rhythm.beats.map((beat) => <li key={beat.kind} data-status={beat.status}><span>{beat.label}</span><b>{beat.metric}</b></li>)}
      </ol>
      <article className={styles.current} data-recovery={rhythm.status === "recovery" ? "true" : undefined}>
        <span>{rhythm.status === "recovery" ? "Minimum Recovery" : `Next ${rhythm.currentStep.beat} step`}</span>
        <strong>{rhythm.currentStep.label}</strong>
        <small>{rhythm.currentStep.detail}</small>
      </article>
      <details className={styles.route}>
        <summary>Full certified route</summary>
        <div className={styles.routeSteps}>
          {steps.map((step) => <article key={step.kind} className={styles[step.status]} data-testid="playable-investigation-step"><span>{step.label}</span><b>{step.metric}</b><small>{step.detail}</small></article>)}
        </div>
      </details>
      <small className={styles.boundary}>Manual First: this rhythm focuses existing legal actions and never fills a theory, reveals truth, or changes route authority.</small>
    </section>
  );
}
