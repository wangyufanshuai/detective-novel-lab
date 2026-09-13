import type { CertifiedCaseRhythmViewModel } from "@/app/campaign/certified-case-rhythm-model";
import type { PlayableInvestigationPathStep } from "@/app/campaign/investigation-workspace-model";
import { useAppLocale } from "@/app/localization/locale-context";
import styles from "./CertifiedCaseRhythmSurface.module.css";

export function CertifiedCaseRhythmSurface({ rhythm, steps }: {
  rhythm: CertifiedCaseRhythmViewModel;
  steps: PlayableInvestigationPathStep[];
}) {
  const { text, locale } = useAppLocale();
  return (
    <section className={styles.surface} data-testid="certified-case-rhythm" data-rhythm-state={rhythm.status} data-rhythm-step={rhythm.currentStep.kind}>
      <header className={styles.header}>
        <div><span>{text("Certified Case Rhythm")}</span><strong>{text(rhythm.currentStep.label)}</strong></div>
        <b>{text(rhythm.progressLabel)}</b>
      </header>
      <ol className={styles.beats} aria-label={locale === "zh-CN" ? "调查进度" : "Investigation progress"}>
        {rhythm.beats.map((beat) => <li key={beat.kind} data-status={beat.status}><span>{text(beat.label)}</span><b>{text(beat.metric)}</b></li>)}
      </ol>
      <article className={styles.current} data-recovery={rhythm.status === "recovery" ? "true" : undefined}>
        <span>{rhythm.status === "recovery" ? text("Minimum Recovery") : `${text("Next")} ${text(rhythm.currentStep.beat)} ${text("step")}`}</span>
        <strong>{text(rhythm.currentStep.label)}</strong>
        <small>{text(rhythm.currentStep.detail)}</small>
      </article>
      <details className={styles.route}>
        <summary>{locale === "zh-CN" ? "完整调查步骤" : "Full investigation route"}</summary>
        <div className={styles.routeSteps}>
          {steps.map((step) => <article key={step.kind} className={styles[step.status]} data-testid="playable-investigation-step"><span>{text(step.label)}</span><b>{text(step.metric)}</b><small>{text(step.detail)}</small></article>)}
        </div>
      </details>
      <small className={styles.boundary}>{text("Manual First: this rhythm focuses existing legal actions and never fills a theory, reveals truth, or changes route authority.")}</small>
    </section>
  );
}
