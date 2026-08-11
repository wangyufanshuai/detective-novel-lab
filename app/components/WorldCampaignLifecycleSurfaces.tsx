"use client";

import type {
  ArcConvergenceSummary,
  CampaignRecoverySummary,
  InvestigatorHeadquartersSummary,
  InvestigatorProgressionSummary,
  TownSocialResponseSummary,
  WorldEventOfferSummary
} from "@/app/campaign/world-campaign-types";
import { useAppLocale } from "@/app/localization/locale-context";

export function TownSocialResponsePanel({ summary }: { summary: TownSocialResponseSummary }) {
  const { t, text } = useAppLocale();
  return (
    <div className={`townSocialResponse ${summary.status} ${summary.direction}`} data-testid="town-social-response">
      <div className="worldLeadHeader"><div><span>{t("world.townReactions")}</span><strong>{text(summary.directionLabel)}</strong></div><b>{text(summary.status)}</b></div>
      <div className="worldLeadMetrics"><span><b>{text(summary.progressLabel)}</b>{t("world.publicReactions")}</span><span><b>{text(summary.direction)}</b>{t("world.ambientPosture")}</span></div>
      <small>{text(summary.headline)}</small>
      {summary.reactions.length > 0 && <ul className="townSocialResponseList">{summary.reactions.map((reaction, index) => (
        <li key={`${reaction.actorName}-${reaction.locationLabel}-${index}`}><b>{text(reaction.actorName)}</b><span>{text(reaction.roleLabel)} · {text(reaction.locationLabel)}</span><small>{text(reaction.reactionLabel)}</small></li>
      ))}</ul>}
      <em>{text(summary.nextAction)}</em>
    </div>
  );
}
export function ArcConvergencePanel({ summary }: { summary: ArcConvergenceSummary }) {
  const { t, text } = useAppLocale();
  return (
    <div className={`arcConvergence ${summary.status}`} data-testid="arc-convergence">
      <div className="worldLeadHeader"><div><span>{t("world.convergence")}</span><strong>{text(summary.finaleLabel)}</strong></div><b>{text(summary.status)}</b></div>
      <div className="worldLeadMetrics"><span><b>{text(summary.caseProgressLabel)}</b>{t("world.casePath")}</span><span><b>{text(summary.worldProgressLabel)}</b>{t("world.worldPath")}</span></div>
      <small>{text(summary.approachLabel)}</small>
      {summary.contextLabels.length > 0 && <small>{summary.contextLabels.map(text).join(" / ")}</small>}
      <em>{text(summary.nextAction)}</em>
    </div>
  );
}

export function CampaignRecoveryPanel({ summary, onDecision, busy }: {
  summary: CampaignRecoverySummary;
  onDecision?: (choice: "start" | "defer" | "use-headquarters") => void;
  busy: boolean;
}) {
  const { number, t, text } = useAppLocale();
  return (
    <div className={`campaignRecovery ${summary.status}`} data-testid="campaign-recovery">
      <div className="worldLeadHeader"><div><span>{t("world.failureRecovery")}</span><strong>{text(summary.recoveryActionLabel)}</strong></div><b>{text(summary.status)}</b></div>
      <div className="worldLeadMetrics"><span><b>{number(summary.completedCount)}</b>{t("world.recoveries")}</span><span><b>{number(summary.queuedCount)}</b>{t("world.queued")}</span></div>
      <small>{text(summary.failureLabel)}</small><small>{text(summary.costLabel)}</small><small>{text(summary.progressLabel)}</small>
      {summary.status === "ready" && onDecision && <div className="worldEventOfferActions">
        <button type="button" className="primaryButton" data-testid="campaign-recovery-start" onClick={() => onDecision("start")} disabled={busy}>{t("world.startRecovery")}</button>
        {summary.headquartersAvailable && <button type="button" data-testid="campaign-recovery-use-headquarters" onClick={() => onDecision("use-headquarters")} disabled={busy}>{summary.headquartersActionLabel ? text(summary.headquartersActionLabel) : t("world.useHeadquarters")}</button>}
        <button type="button" data-testid="campaign-recovery-defer" onClick={() => onDecision("defer")} disabled={busy}>{t("world.defer")}</button>
      </div>}
      <em>{text(summary.nextAction)}</em>
    </div>
  );
}

export function InvestigatorHeadquartersPanel({ summary, onDecision, busy }: {
  summary: InvestigatorHeadquartersSummary;
  onDecision?: (choice: InvestigatorHeadquartersSummary["availableDirections"][number]["choice"]) => void;
  busy: boolean;
}) {
  const { number, t, text } = useAppLocale();
  const ready = summary.status === "ready";
  return (
    <div className={`investigatorHeadquarters ${summary.status}`} data-testid="investigator-headquarters">
      <div className="worldLeadHeader"><div><span>{t("world.headquarters")}</span><strong>{text(summary.activeCaseLabel)}</strong></div><b>{text(summary.status)}</b></div>
      <div className="worldLeadMetrics"><span><b>{text(summary.progressLabel)}</b>{t("world.intermission")}</span><span><b>{number(summary.completedCount)}/{number(summary.maximumCount)}</b>{t("world.preparations")}</span></div>
      <small>{ready ? "Choose one bounded preparation; the next legal extraction remains free to choose." : summary.benefitLabel}</small>
      {summary.availableDirections.length > 0 && <div className="investigatorHeadquartersDirections">{summary.availableDirections.map((direction) => (
        <article key={direction.choice} className={direction.available ? "available" : "locked"} data-testid={`headquarters-direction-${direction.choice}`}>
          <span>{t(direction.available ? "common.unlocked" : "common.locked")} · {text(direction.timingLabel)}</span><b>{text(direction.label)}</b><small>{text(direction.available ? direction.benefitLabel : direction.lockedReason || t("common.unavailable"))}</small>
          {ready && onDecision && <button type="button" className={direction.available ? "primaryButton" : "secondaryButton"} onClick={() => onDecision(direction.choice)} disabled={busy || !direction.available}>{direction.available ? t("world.prepare") : t("world.needsPractice")}</button>}
        </article>
      ))}</div>}
      {summary.choiceLabel && <small className="investigatorHeadquartersChoice">{t("world.selected")}: {text(summary.choiceLabel)}</small>}
      {summary.recoveryAvailable && <small>{t("world.recoveryAssist")}</small>}
      <em>{text(summary.nextAction)}</em>
    </div>
  );
}

export function InvestigatorProgressionPanel({ summary }: { summary: InvestigatorProgressionSummary }) {
  const { number, t, text } = useAppLocale();
  return (
    <div className={`investigatorProgression ${summary.status}`} data-testid="investigator-progression">
      <div className="worldLeadHeader"><div><span>{t("world.progression")}</span><strong>{t("world.practiceProfile")}</strong></div><b>{text(summary.status)}</b></div>
      <div className="worldLeadMetrics"><span><b>{number(summary.points)}</b>{t("world.practiceMarks")}</span><span><b>{number(summary.unlockedLabels.length)}</b>{t("world.unlocks")}</span></div>
      <div className="investigatorProgressionCompetencies">{summary.competencyLabels.map((item) => <span key={item.label}><b>{number(item.level)}</b>{text(item.label)} · {text(item.progressLabel)}</span>)}</div>
      {summary.unlockedLabels.map((label) => <small key={label}>{t("world.unlocked")}: {text(label)}</small>)}
      <em>{text(summary.nextAction)}</em>
    </div>
  );
}

export function WorldEventOfferPanel({ summary, onDecision, busy }: {
  summary: WorldEventOfferSummary;
  onDecision?: (choice: "accept" | "decline") => void;
  busy: boolean;
}) {
  const { number, t, text } = useAppLocale();
  return (
    <div className={`worldEventOffer ${summary.status}`} data-testid="world-event-offer">
      <div className="worldLeadHeader"><div><span>{t("world.opportunity")}</span><strong>{text(summary.label)}</strong></div><b>{text(summary.status)}</b></div>
      <div className="worldLeadMetrics"><span><b>{text(summary.deadlineBand)}</b>{t("world.deadline")}</span><span><b>{number(summary.queuedCount)}</b>{t("world.queued")}</span></div>
      <b>{text(summary.actionLabel)}</b><small>{text(summary.benefitLabel)}</small><small>{text(summary.costLabel)}</small><small>{text(summary.progressLabel)}</small>
      {(summary.status === "failed" || summary.status === "expired") && <small>{text(summary.recoveryLabel)}</small>}
      {summary.status === "offered" && onDecision && <div className="worldEventOfferActions">
        <button type="button" className="primaryButton" data-testid="world-event-offer-accept" onClick={() => onDecision("accept")} disabled={busy}>{t("world.accept")}</button>
        <button type="button" data-testid="world-event-offer-decline" onClick={() => onDecision("decline")} disabled={busy}>{t("world.decline")}</button>
      </div>}
      {summary.recoveryAvailable && onDecision && <div className="worldEventOfferActions"><button type="button" className="primaryButton" data-testid="world-event-offer-retry" onClick={() => onDecision("accept")} disabled={busy}>{t("world.retryRecovery")}</button></div>}
      <em>{text(summary.nextAction)}</em>
    </div>
  );
}
