import { memo } from "react";
import type { StrategicCommandViewModel } from "@/app/campaign/strategic-command-model";
import type { StrategicPacingPhase, StrategicPacingViewModel } from "@/app/campaign/strategic-pacing-model";
import type { CampaignCommandBrief } from "@/app/campaign/campaign-command-brief-model";
import styles from "./StrategicPacingSurface.module.css";

const PHASES: ReadonlyArray<{ phase: StrategicPacingPhase; label: string }> = [
  { phase: "brief", label: "Brief" },
  { phase: "inspect", label: "Inspect" },
  { phase: "choose", label: "Choose" },
  { phase: "execute", label: "Execute" },
  { phase: "resolve", label: "Resolve" },
  { phase: "advance", label: "Advance" }
];

export const StrategicPacingSurface = memo(function StrategicPacingSurface({ command, pacing, brief }: {
  command: StrategicCommandViewModel;
  pacing: StrategicPacingViewModel;
  brief: CampaignCommandBrief;
}) {
  const publicChange = command.notifications[0]?.detail || brief.whatChanges;
  const latestOutcome = pacing.recentSafeOutcomes[0];
  const caseRhythm = command.primaryAction?.kind === "certified-investigation" ? command.caseRhythm : undefined;
  return (
    <section
      className={styles.surface}
      data-testid="strategic-pacing"
      data-pacing-phase={pacing.phase}
      data-focus-target={pacing.focusTarget}
      data-command-brief-layer="objective"
      data-command-brief-status={brief.status}
    >
      <header className={styles.heading}>
        <span>01 / Current Objective</span>
        <b>{pacing.phase.toUpperCase()}</b>
      </header>
      <h1>{brief.objective.title}</h1>
      <p className={styles.objectiveDetail}>{brief.objective.detail}</p>
      {caseRhythm ? <div className={styles.caseRhythm} data-testid="strategic-case-rhythm" data-rhythm-step={caseRhythm.currentStep.kind}>
        <ol aria-label="Current certified case rhythm">{caseRhythm.beats.map((beat) => <li key={beat.kind} data-status={beat.status}><span /> <b>{beat.label}</b></li>)}</ol>
        <small>{caseRhythm.currentStep.metric} · {caseRhythm.progressLabel}</small>
      </div> : <>
        <ol className={styles.phaseRail} aria-label="Strategic campaign pacing">
          {PHASES.map((item) => <li key={item.phase} data-active={item.phase === pacing.phase ? "true" : undefined}><span aria-hidden="true" />{item.label}</li>)}
        </ol>
      </>}
      <div className={styles.briefSignals}>
        <section className={styles.whyNow} data-testid="strategic-why-now"><small>WHY NOW</small><strong>{brief.whyNow}</strong></section>
        <section className={styles.whatChanges} data-testid="strategic-what-changes"><small>WHAT CHANGES</small><strong>{brief.whatChanges}</strong></section>
      </div>
      <div className={styles.briefFocus} data-testid="campaign-command-brief">
        <span><small>MAP FOCUS</small><b>{brief.focus.label}</b></span>
        <span><small>WORLD SIGNALS</small><b>{brief.world.signalCount}</b></span>
      </div>
      <details className={styles.forecast} data-testid="strategic-safe-forecast">
        <summary>Safe forecast and boundary</summary>
        <div className={styles.forecastContext}>
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
