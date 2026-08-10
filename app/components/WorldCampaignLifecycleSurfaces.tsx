import type {
  ArcConvergenceSummary,
  CampaignRecoverySummary,
  InvestigatorHeadquartersSummary,
  InvestigatorProgressionSummary,
  TownSocialResponseSummary,
  WorldEventOfferSummary
} from "@/app/campaign/world-campaign-types";

export function TownSocialResponsePanel({ summary }: { summary: TownSocialResponseSummary }) {
  return (
    <div className={`townSocialResponse ${summary.status} ${summary.direction}`} data-testid="town-social-response">
      <div className="worldLeadHeader"><div><span>Town Reactions</span><strong>{summary.directionLabel}</strong></div><b>{summary.status}</b></div>
      <div className="worldLeadMetrics"><span><b>{summary.progressLabel}</b>public reactions</span><span><b>{summary.direction}</b>ambient posture</span></div>
      <small>{summary.headline}</small>
      {summary.reactions.length > 0 && <ul className="townSocialResponseList">{summary.reactions.map((reaction, index) => (
        <li key={`${reaction.actorName}-${reaction.locationLabel}-${index}`}><b>{reaction.actorName}</b><span>{reaction.roleLabel} 路 {reaction.locationLabel}</span><small>{reaction.reactionLabel}</small></li>
      ))}</ul>}
      <em>{summary.nextAction}</em>
    </div>
  );
}
export function ArcConvergencePanel({ summary }: { summary: ArcConvergenceSummary }) {
  return (
    <div className={`arcConvergence ${summary.status}`} data-testid="arc-convergence">
      <div className="worldLeadHeader"><div><span>Arc Convergence</span><strong>{summary.finaleLabel}</strong></div><b>{summary.status}</b></div>
      <div className="worldLeadMetrics"><span><b>{summary.caseProgressLabel}</b>case path</span><span><b>{summary.worldProgressLabel}</b>world path</span></div>
      <small>{summary.approachLabel}</small>
      {summary.contextLabels.length > 0 && <small>{summary.contextLabels.join(" / ")}</small>}
      <em>{summary.nextAction}</em>
    </div>
  );
}

export function CampaignRecoveryPanel({ summary, onDecision, busy }: {
  summary: CampaignRecoverySummary;
  onDecision?: (choice: "start" | "defer" | "use-headquarters") => void;
  busy: boolean;
}) {
  return (
    <div className={`campaignRecovery ${summary.status}`} data-testid="campaign-recovery">
      <div className="worldLeadHeader"><div><span>Failure &amp; Recovery</span><strong>{summary.recoveryActionLabel}</strong></div><b>{summary.status}</b></div>
      <div className="worldLeadMetrics"><span><b>{summary.completedCount}</b>recoveries completed</span><span><b>{summary.queuedCount}</b>queued</span></div>
      <small>{summary.failureLabel}</small><small>{summary.costLabel}</small><small>{summary.progressLabel}</small>
      {summary.status === "ready" && onDecision && <div className="worldEventOfferActions">
        <button type="button" className="primaryButton" data-testid="campaign-recovery-start" onClick={() => onDecision("start")} disabled={busy}>Start Recovery</button>
        {summary.headquartersAvailable && <button type="button" data-testid="campaign-recovery-use-headquarters" onClick={() => onDecision("use-headquarters")} disabled={busy}>{summary.headquartersActionLabel || "Use Headquarters Recovery assist"}</button>}
        <button type="button" data-testid="campaign-recovery-defer" onClick={() => onDecision("defer")} disabled={busy}>Defer</button>
      </div>}
      <em>{summary.nextAction}</em>
    </div>
  );
}

export function InvestigatorHeadquartersPanel({ summary, onDecision, busy }: {
  summary: InvestigatorHeadquartersSummary;
  onDecision?: (choice: InvestigatorHeadquartersSummary["availableDirections"][number]["choice"]) => void;
  busy: boolean;
}) {
  const ready = summary.status === "ready";
  return (
    <div className={`investigatorHeadquarters ${summary.status}`} data-testid="investigator-headquarters">
      <div className="worldLeadHeader"><div><span>Investigator Headquarters</span><strong>{summary.activeCaseLabel}</strong></div><b>{summary.status}</b></div>
      <div className="worldLeadMetrics"><span><b>{summary.progressLabel}</b>intermission</span><span><b>{summary.completedCount}/{summary.maximumCount}</b>preparations</span></div>
      <small>{ready ? "Choose one bounded preparation; the next legal extraction remains free to choose." : summary.benefitLabel}</small>
      {summary.availableDirections.length > 0 && <div className="investigatorHeadquartersDirections">{summary.availableDirections.map((direction) => (
        <article key={direction.choice} className={direction.available ? "available" : "locked"} data-testid={`headquarters-direction-${direction.choice}`}>
          <span>{direction.available ? "available" : "locked"} 路 {direction.timingLabel}</span><b>{direction.label}</b><small>{direction.available ? direction.benefitLabel : direction.lockedReason}</small>
          {ready && onDecision && <button type="button" className={direction.available ? "primaryButton" : "secondaryButton"} onClick={() => onDecision(direction.choice)} disabled={busy || !direction.available}>{direction.available ? "Prepare" : "Needs practice"}</button>}
        </article>
      ))}</div>}
      {summary.choiceLabel && <small className="investigatorHeadquartersChoice">Selected: {summary.choiceLabel}</small>}
      {summary.recoveryAvailable && <small>Recovery assist ready for a rejected theory; it remains Manual First and does not fill any answer.</small>}
      <em>{summary.nextAction}</em>
    </div>
  );
}

export function InvestigatorProgressionPanel({ summary }: { summary: InvestigatorProgressionSummary }) {
  return (
    <div className={`investigatorProgression ${summary.status}`} data-testid="investigator-progression">
      <div className="worldLeadHeader"><div><span>Investigator Progression</span><strong>Practice profile</strong></div><b>{summary.status}</b></div>
      <div className="worldLeadMetrics"><span><b>{summary.points}</b>practice marks</span><span><b>{summary.unlockedLabels.length}</b>bounded unlocks</span></div>
      <div className="investigatorProgressionCompetencies">{summary.competencyLabels.map((item) => <span key={item.label}><b>{item.level}</b>{item.label} 路 {item.progressLabel}</span>)}</div>
      {summary.unlockedLabels.map((label) => <small key={label}>Unlocked: {label}</small>)}
      <em>{summary.nextAction}</em>
    </div>
  );
}

export function WorldEventOfferPanel({ summary, onDecision, busy }: {
  summary: WorldEventOfferSummary;
  onDecision?: (choice: "accept" | "decline") => void;
  busy: boolean;
}) {
  return (
    <div className={`worldEventOffer ${summary.status}`} data-testid="world-event-offer">
      <div className="worldLeadHeader"><div><span>World Opportunity</span><strong>{summary.label}</strong></div><b>{summary.status}</b></div>
      <div className="worldLeadMetrics"><span><b>{summary.deadlineBand}</b>deadline</span><span><b>{summary.queuedCount}</b>queued</span></div>
      <b>{summary.actionLabel}</b><small>{summary.benefitLabel}</small><small>{summary.costLabel}</small><small>{summary.progressLabel}</small>
      {(summary.status === "failed" || summary.status === "expired") && <small>{summary.recoveryLabel}</small>}
      {summary.status === "offered" && onDecision && <div className="worldEventOfferActions">
        <button type="button" className="primaryButton" data-testid="world-event-offer-accept" onClick={() => onDecision("accept")} disabled={busy}>Accept</button>
        <button type="button" data-testid="world-event-offer-decline" onClick={() => onDecision("decline")} disabled={busy}>Decline</button>
      </div>}
      {summary.recoveryAvailable && onDecision && <div className="worldEventOfferActions"><button type="button" className="primaryButton" data-testid="world-event-offer-retry" onClick={() => onDecision("accept")} disabled={busy}>Retry Recovery</button></div>}
      <em>{summary.nextAction}</em>
    </div>
  );
}
