"use client";

import { memo } from "react";
import type { StrategicCommandViewModel } from "@/app/campaign/strategic-command-model";
import type { StrategicPacingPhase, StrategicPacingViewModel } from "@/app/campaign/strategic-pacing-model";
import type { CampaignCommandBrief } from "@/app/campaign/campaign-command-brief-model";
import { useAppLocale } from "@/app/localization/locale-context";
import type { LocaleMessageKey } from "@/app/localization/locale-catalog";
import styles from "./StrategicPacingSurface.module.css";

const PHASES: ReadonlyArray<{ phase: StrategicPacingPhase; messageKey: LocaleMessageKey }> = [
  { phase: "brief", messageKey: "command.phase.brief" },
  { phase: "inspect", messageKey: "command.phase.inspect" },
  { phase: "choose", messageKey: "command.phase.choose" },
  { phase: "execute", messageKey: "command.phase.execute" },
  { phase: "resolve", messageKey: "command.phase.resolve" },
  { phase: "advance", messageKey: "command.phase.advance" }
];

export const StrategicPacingSurface = memo(function StrategicPacingSurface({ command, pacing, brief }: {
  command: StrategicCommandViewModel;
  pacing: StrategicPacingViewModel;
  brief: CampaignCommandBrief;
}) {
  const { number, t, text } = useAppLocale();
  const publicChange = command.notifications[0]?.detail || brief.whatChanges;
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
        <span>01 / {t("command.currentObjective")}</span>
        <b>{t(`command.phase.${pacing.phase}` as LocaleMessageKey)}</b>
      </header>
      <h1>{text(brief.objective.title)}</h1>
      <p className={styles.objectiveDetail}>{text(brief.objective.detail)}</p>
      {caseRhythm ? <div className={styles.caseRhythm} data-testid="strategic-case-rhythm" data-rhythm-step={caseRhythm.currentStep.kind}>
        <ol aria-label={t("command.currentCertifiedRhythm")}>{caseRhythm.beats.map((beat) => <li key={beat.kind} data-status={beat.status}><span aria-hidden="true" /> <b>{text(beat.label)}</b></li>)}</ol>
        <small>{text(caseRhythm.currentStep.metric)} · {text(caseRhythm.progressLabel)}</small>
      </div> : <>
        <ol className={styles.phaseRail} aria-label={t("command.strategicPacing")}>
          {PHASES.map((item) => <li key={item.phase} data-active={item.phase === pacing.phase ? "true" : undefined}><span aria-hidden="true" />{t(item.messageKey)}</li>)}
        </ol>
      </>}
      <div className={styles.briefSignals}>
        <section className={styles.whyNow} data-testid="strategic-why-now"><small>{t("command.whyNow")}</small><strong>{text(brief.whyNow)}</strong></section>
        <section className={styles.whatChanges} data-testid="strategic-what-changes"><small>{t("command.whatChanges")}</small><strong>{text(brief.whatChanges)}</strong></section>
      </div>
      <div className={styles.briefFocus} data-testid="campaign-command-brief">
        <span><small>{t("command.mapFocus")}</small><b>{text(brief.focus.label)}</b></span>
        <span><small>{t("command.worldSignals")}</small><b>{number(brief.world.signalCount)}</b></span>
      </div>
      <details className={styles.forecast} data-testid="strategic-safe-forecast">
        <summary>{t("command.forecast")}</summary>
        <div className={styles.forecastContext}>
          <section className={styles.publicChange}>
            <small>{t("command.publicChange")}</small>
            <span>{text(publicChange)}</span>
          </section>
        </div>
        <dl>
          <div><dt>{t("command.benefit")}</dt><dd>{text(pacing.safeForecast.immediateBenefit)}</dd></div>
          <div><dt>{t("command.cost")}</dt><dd>{text(pacing.safeForecast.visibleCost)}</dd></div>
          <div><dt>{t("command.surface")}</dt><dd>{text(pacing.safeForecast.affectedSurface)}</dd></div>
          <div><dt>{t("command.authority")}</dt><dd>{text(pacing.safeForecast.unchangedAuthority)}</dd></div>
        </dl>
      </details>
    </section>
  );
});
