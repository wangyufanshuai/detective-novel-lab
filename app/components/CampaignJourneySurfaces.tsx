"use client";

import type { CampaignPacingViewModel } from "@/app/campaign/campaign-pacing-model";
import type { CampaignFinaleDebriefSummary, CampaignSessionSummary } from "@/app/campaign/world-campaign-types";
import { useAppLocale } from "@/app/localization/locale-context";

export function CampaignTransitionSurface({ summary }: { summary: CampaignSessionSummary }) {
  const { t, text } = useAppLocale();
  return <>
    <div className="worldLeadHeader">
      <div><span>{[text(summary.campaignLabel || t("journey.default")), summary.routeLabel ? text(summary.routeLabel) : ""].filter(Boolean).join(" / ")}</span><strong>{text(summary.chapterLabel)}</strong></div>
      <b>{text(summary.status)}</b>
    </div>
    {summary.themeLabel && <small>{text(summary.themeLabel)}</small>}
    {summary.routeStrategyLabel && <small>{text(summary.routeStrategyLabel)}</small>}
    <div className="worldLeadMetrics">
      <span><b>{text(summary.progressLabel)}</b>{t("journey.progress")}</span>
      <span><b>{text(summary.primaryActionLabel)}</b>{t("journey.primary")}</span>
    </div>
  </>;
}

export function CampaignObjectiveSurface({ summary }: { summary: CampaignSessionSummary }) {
  const { text } = useAppLocale();
  return <>
    {summary.chapterObjective && <small>{text(summary.chapterObjective)}</small>}
    {(summary.evidenceThemeLabel || summary.worldSurfaceLabel) && <small>{[summary.evidenceThemeLabel, summary.worldSurfaceLabel].filter(Boolean).map((item) => text(item || "")).join(" / ")}</small>}
  </>;
}

export function CampaignReviewSurface({ summary }: { summary: CampaignSessionSummary }) {
  const { text } = useAppLocale();
  return <>
    {summary.consequenceLabels.length > 0 && <small>{summary.consequenceLabels.map(text).join(" / ")}</small>}
    <small>{text(summary.replayLabel)}</small>
    <em>{text(summary.nextAction)}</em>
  </>;
}

export function CampaignConsequenceSurface({ pacing, debrief }: { pacing?: CampaignPacingViewModel | null; debrief?: CampaignFinaleDebriefSummary | null }) {
  const { t, text } = useAppLocale();
  return <>
    {pacing && <div className={`campaignPacing ${pacing.status}`} data-testid="campaign-pacing">
      <div><span>{t("journey.pacing")}</span><b>{text(pacing.status)}</b></div>
      <strong>{text(pacing.currentObjective.label)}</strong>
      <small><b>{t("journey.whyNow")}</b> {text(pacing.whyNow)}</small>
      <em>{text(pacing.nextAction)}</em>
      <details><summary>{t("journey.forecast")}</summary>
        <small>{text(pacing.safeForecast.whatChanges)}</small>
        <small>{text(pacing.safeForecast.visibleSurface)}</small>
        <small>{text(pacing.safeForecast.unchangedAuthority)}</small>
        <small>{text(pacing.value.nextCaseHint)}</small>
      </details>
    </div>}
    {debrief?.status === "ready" && <div className="campaignFinaleDebrief" data-testid="campaign-finale-debrief">
      <b>{text(debrief.title)}</b>
      <small>{text(debrief.approachLabel)}</small>
      <ol>{debrief.causalBeats.map((beat) => <li key={beat}>{text(beat)}</li>)}</ol>
      <small>{text(debrief.replayContrast)}</small>
      <em>{text(debrief.nextAction)}</em>
    </div>}
  </>;
}

export function CampaignJourneySurface({ summary, debrief, pacing }: { summary: CampaignSessionSummary; debrief?: CampaignFinaleDebriefSummary | null; pacing?: CampaignPacingViewModel | null }) {
  return (
    <div className={`campaignSession ${summary.status}`} data-testid="campaign-session">
      <CampaignTransitionSurface summary={summary} />
      <CampaignObjectiveSurface summary={summary} />
      <CampaignReviewSurface summary={summary} />
      <CampaignConsequenceSurface pacing={pacing} debrief={debrief} />
    </div>
  );
}
