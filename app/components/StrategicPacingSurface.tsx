import { memo } from "react";
import type { StrategicCommandViewModel } from "@/app/campaign/strategic-command-model";
import type { StrategicPacingPhase, StrategicPacingViewModel } from "@/app/campaign/strategic-pacing-model";
import styles from "./StrategicPacingSurface.module.css";

const PHASES: ReadonlyArray<{ phase: StrategicPacingPhase; label: string }> = [
  { phase: "brief", label: "Brief" },
  { phase: "inspect", label: "Inspect" },
  { phase: "choose", label: "Choose" },
  { phase: "execute", label: "Execute" },
  { phase: "resolve", label: "Resolve" },
  { phase: "advance", label: "Advance" }
];

export const StrategicPacingSurface = memo(function StrategicPacingSurface({ command, pacing }: {
  command: StrategicCommandViewModel;
  pacing: StrategicPacingViewModel;
}) {
  const objective = pacing.currentObjective;
  const publicChange = command.notifications[0]?.detail || command.worldConsequenceTimeline.summary;
  const latestOutcome = pacing.recentSafeOutcomes[0];
  const caseRhythm = command.primaryAction?.kind === "certified-investigation" ? command.caseRhythm : undefined;
  return (
    <section
      className={styles.surface}
      data-testid="strategic-pacing"
      data-pacing-phase={pacing.phase}
      data-focus-target={pacing.focusTarget}
    >
      <header className={styles.heading}>
        <span>Current Objective</span>
        <b>{pacing.phase.toUpperCase()}</b>
      </header>
      <h1>{objective.title}</h1>
      <p className={styles.objectiveDetail}>{objective.detail}</p>
      {caseRhythm ? <div className={styles.caseRhythm} data-testid="strategic-case-rhythm" data-rhythm-step={caseRhythm.currentStep.kind}>
        <ol aria-label="Current certified case rhythm">{caseRhythm.beats.map((beat) => <li key={beat.kind} data-status={beat.status}><span /> <b>{beat.label}</b></li>)}</ol>
        <small>{caseRhythm.currentStep.metric} · {caseRhythm.progressLabel}</small>
      </div> : <>
        <div className={styles.whyNow} data-testid="strategic-why-now"><small>WHY NOW</small><strong>{pacing.whyNow}</strong></div>
        <ol className={styles.phaseRail} aria-label="Strategic campaign pacing">
          {PHASES.map((item) => <li key={item.phase} data-active={item.phase === pacing.phase ? "true" : undefined}><span aria-hidden="true" />{item.label}</li>)}
        </ol>
      </>}
      <details className={styles.forecast} data-testid="strategic-safe-forecast">
        <summary>Safe forecast and boundary</summary>
        <div className={styles.forecastContext}>
          {caseRhythm ? <section className={styles.whyNow} data-testid="strategic-why-now"><small>WHY NOW</small><strong>{pacing.whyNow}</strong></section> : null}
          <section className={styles.publicChange}>
            <small>PUBLIC CHANGE</small>
            <span>{publicChange}</span>
          </section>
          {pacing.phase === "resolve" && latestOutcome ? (
            <section className={styles.latestOutcome} data-testid="strategic-recent-outcome" data-outcome-state={latestOutcome.state}>
              <small>LATEST SAFE OUTCOME</small>
              <strong>{latestOutcome.immediateResult}</strong>
              <span>{latestOutcome.nextObjective}</span>
            </section>
          ) : null}
        </div>
        <dl>
          <div><dt>Benefit</dt><dd>{pacing.safeForecast.immediateBenefit}</dd></div>
          <div><dt>Visible cost</dt><dd>{pacing.safeForecast.visibleCost}</dd></div>
          <div><dt>Affected surface</dt><dd>{pacing.safeForecast.affectedSurface}</dd></div>
          <div><dt>Unchanged authority</dt><dd>{pacing.safeForecast.unchangedAuthority}</dd></div>
        </dl>
      </details>
    </section>
  );
});
