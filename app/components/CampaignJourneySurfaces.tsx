import type { CampaignPacingViewModel } from "@/app/campaign/campaign-pacing-model";
import type { CampaignFinaleDebriefSummary, CampaignSessionSummary } from "@/app/campaign/world-campaign-types";

export function CampaignTransitionSurface({ summary }: { summary: CampaignSessionSummary }) {
  return <>
    <div className="worldLeadHeader">
      <div><span>{[summary.campaignLabel || "Campaign Journey", summary.routeLabel].filter(Boolean).join(" / ")}</span><strong>{summary.chapterLabel}</strong></div>
      <b>{summary.status}</b>
    </div>
    {summary.themeLabel && <small>{summary.themeLabel}</small>}
    {summary.routeStrategyLabel && <small>{summary.routeStrategyLabel}</small>}
    <div className="worldLeadMetrics">
      <span><b>{summary.progressLabel}</b>campaign progress</span>
      <span><b>{summary.primaryActionLabel}</b>primary action</span>
    </div>
  </>;
}

export function CampaignObjectiveSurface({ summary }: { summary: CampaignSessionSummary }) {
  return <>
    {summary.chapterObjective && <small>{summary.chapterObjective}</small>}
    {(summary.evidenceThemeLabel || summary.worldSurfaceLabel) && <small>{[summary.evidenceThemeLabel, summary.worldSurfaceLabel].filter(Boolean).join(" / ")}</small>}
  </>;
}

export function CampaignReviewSurface({ summary }: { summary: CampaignSessionSummary }) {
  return <>
    {summary.consequenceLabels.length > 0 && <small>{summary.consequenceLabels.join(" / ")}</small>}
    <small>{summary.replayLabel}</small>
    <em>{summary.nextAction}</em>
  </>;
}

export function CampaignConsequenceSurface({ pacing, debrief }: { pacing?: CampaignPacingViewModel | null; debrief?: CampaignFinaleDebriefSummary | null }) {
  return <>
    {pacing && <div className={`campaignPacing ${pacing.status}`} data-testid="campaign-pacing">
      <div><span>Campaign Pacing</span><b>{pacing.status}</b></div>
      <strong>{pacing.currentObjective.label}</strong>
      <small><b>Why now:</b> {pacing.whyNow}</small>
      <em>{pacing.nextAction}</em>
      <details><summary>What changes / what stays fair</summary>
        <small>{pacing.safeForecast.whatChanges}</small>
        <small>{pacing.safeForecast.visibleSurface}</small>
        <small>{pacing.safeForecast.unchangedAuthority}</small>
        <small>{pacing.value.nextCaseHint}</small>
      </details>
    </div>}
    {debrief?.status === "ready" && <div className="campaignFinaleDebrief" data-testid="campaign-finale-debrief">
      <b>{debrief.title}</b>
      <small>{debrief.approachLabel}</small>
      <ol>{debrief.causalBeats.map((beat) => <li key={beat}>{beat}</li>)}</ol>
      <small>{debrief.replayContrast}</small>
      <em>{debrief.nextAction}</em>
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
