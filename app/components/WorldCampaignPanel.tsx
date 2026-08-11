"use client";

import type { ReactNode } from "react";
import type { CampaignPacingViewModel } from "@/app/campaign/campaign-pacing-model";
import type { CampaignCommandBrief } from "@/app/campaign/campaign-command-brief-model";
import { deriveCurrentWorldAction } from "@/app/campaign/world-campaign-action-model";
import type {
  ArcConvergenceSummary,
  CampaignFinaleDebriefSummary,
  CampaignRecoverySummary,
  CampaignSessionSummary,
  FactionRelationshipSummary,
  InvestigatorHeadquartersSummary,
  InvestigatorProgressionSummary,
  PlayerResourceCommitmentSummary,
  TownSocialResponseSummary,
  WorldArcDirectiveSummary,
  WorldArcSummary,
  WorldEventOfferSummary,
  WorldInfluenceBudgetSummary,
  WorldLeadHandoffSummary,
  WorldLeadOutcomeSummary,
  WorldLeadSummary,
  WorldPressureCascadeSummary
} from "@/app/campaign/world-campaign-types";
import type { PlayerSession, WorldLeadFocus } from "@/lib/engine";
import { useAppLocale } from "@/app/localization/locale-context";
import { CampaignJourneySurface } from "./CampaignJourneySurfaces";
import { StaticWorldCampaignBoundary } from "./StaticWorldCampaignBoundary";
import {
  ArcConvergencePanel,
  CampaignRecoveryPanel,
  InvestigatorHeadquartersPanel,
  InvestigatorProgressionPanel,
  TownSocialResponsePanel,
  WorldEventOfferPanel
} from "./WorldCampaignLifecycleSurfaces";
import {
  FactionRelationshipPanel,
  InvestigationOperationsPanel,
  WorldArcDirectivePanel,
  WorldArcProgress,
  WorldInfluenceBudgetPanel,
  WorldPressureCascadePanel
} from "./WorldCampaignOperationSurfaces";

export type {
  ArcConvergenceSummary,
  CampaignFinaleDebriefSummary,
  CampaignRecoverySummary,
  CampaignSessionSummary,
  FactionRelationshipSummary,
  InvestigatorHeadquartersSummary,
  InvestigatorProgressionSummary,
  PlayerResourceCommitmentSummary,
  TownSocialResponseSummary,
  WorldArcDirectiveSummary,
  WorldArcSummary,
  WorldEventOfferSummary,
  WorldInfluenceBudgetSummary,
  WorldLeadHandoffSummary,
  WorldLeadOutcomeSummary,
  WorldLeadSummary,
  WorldPressureCascadeSummary
} from "@/app/campaign/world-campaign-types";

type WorldCampaignPanelProps = {
  runtimeMode: "static-demo" | "server";
  session: PlayerSession | null;
  summary?: WorldLeadSummary | null;
  outcome?: WorldLeadOutcomeSummary | null;
  handoff?: WorldLeadHandoffSummary | null;
  arc?: WorldArcSummary | null;
  directive?: WorldArcDirectiveSummary | null;
  pressure?: WorldPressureCascadeSummary | null;
  influenceBudget?: WorldInfluenceBudgetSummary | null;
  playerResourceCommitment?: PlayerResourceCommitmentSummary | null;
  factionRelationship?: FactionRelationshipSummary | null;
  worldEventOffer?: WorldEventOfferSummary | null;
  investigatorProgression?: InvestigatorProgressionSummary | null;
  campaignRecovery?: CampaignRecoverySummary | null;
  investigatorHeadquarters?: InvestigatorHeadquartersSummary | null;
  arcConvergence?: ArcConvergenceSummary | null;
  campaignSession?: CampaignSessionSummary | null;
  campaignFinaleDebrief?: CampaignFinaleDebriefSummary | null;
  townSocialResponse?: TownSocialResponseSummary | null;
  campaignPacing?: CampaignPacingViewModel | null;
  commandBrief?: CampaignCommandBrief | null;
  onDecision?: (action: "follow" | "skip") => void;
  onDirectiveDecision?: (choice: "support" | "contain" | "defer") => void;
  onResourceCommitmentDecision?: (allocations: WorldLeadFocus[]) => void;
  onWorldEventOfferDecision?: (choice: "accept" | "decline") => void;
  onCampaignRecoveryDecision?: (choice: "start" | "defer" | "use-headquarters") => void;
  onInvestigatorHeadquartersDecision?: (choice: InvestigatorHeadquartersSummary["availableDirections"][number]["choice"]) => void;
  busy: boolean;
};

export function WorldCampaignPanel({
  runtimeMode, session, summary, outcome, handoff, arc, directive, pressure, influenceBudget,
  playerResourceCommitment, factionRelationship, worldEventOffer, investigatorProgression,
  campaignRecovery, investigatorHeadquarters, arcConvergence, campaignSession,
  campaignFinaleDebrief, townSocialResponse, campaignPacing, commandBrief, onDecision,
  onDirectiveDecision, onResourceCommitmentDecision, onWorldEventOfferDecision,
  onCampaignRecoveryDecision, onInvestigatorHeadquartersDecision, busy
}: WorldCampaignPanelProps) {
  const { number, t, text } = useAppLocale();
  if (!session && runtimeMode === "static-demo") return null;
  if (!session && runtimeMode === "server" && !(handoff || arc || directive || pressure || worldEventOffer || investigatorProgression || campaignRecovery || investigatorHeadquarters || arcConvergence || campaignSession || townSocialResponse)) return null;
  if (runtimeMode === "static-demo") return <StaticWorldCampaignBoundary />;

  const action = deriveCurrentWorldAction({ session, lead: summary, outcome, handoff, arc, directive, pressure, commitment: playerResourceCommitment, offer: worldEventOffer, recovery: campaignRecovery, headquarters: investigatorHeadquarters, convergence: arcConvergence, campaign: campaignSession });
  const pending = summary?.status === "pending";
  const surfaces: Array<{ key: string; label: string; node: ReactNode }> = [
    {
      key: "campaign",
      label: t("world.campaignJourney"),
      node: campaignSession ? <CampaignJourneySurface summary={campaignSession} debrief={campaignFinaleDebrief} pacing={campaignPacing} /> : null
    },
    { key: "social", label: t("world.townReactions"), node: townSocialResponse ? <TownSocialResponsePanel summary={townSocialResponse} /> : null },
    { key: "influence", label: t("world.influenceBudget"), node: influenceBudget ? <WorldInfluenceBudgetPanel summary={influenceBudget} /> : null },
    { key: "faction", label: t("world.factionRelationship"), node: factionRelationship ? <FactionRelationshipPanel summary={factionRelationship} /> : null },
    { key: "offer", label: t("world.opportunity"), node: worldEventOffer ? <WorldEventOfferPanel summary={worldEventOffer} onDecision={onWorldEventOfferDecision} busy={busy} /> : null },
    { key: "recovery", label: t("world.recovery"), node: campaignRecovery ? <CampaignRecoveryPanel summary={campaignRecovery} onDecision={onCampaignRecoveryDecision} busy={busy} /> : null },
    { key: "headquarters", label: t("world.headquarters"), node: investigatorHeadquarters ? <InvestigatorHeadquartersPanel summary={investigatorHeadquarters} onDecision={onInvestigatorHeadquartersDecision} busy={busy} /> : null },
    { key: "progression", label: t("world.progression"), node: investigatorProgression ? <InvestigatorProgressionPanel summary={investigatorProgression} /> : null },
    { key: "convergence", label: t("world.convergence"), node: arcConvergence ? <ArcConvergencePanel summary={arcConvergence} /> : null },
    { key: "operations", label: t("world.operations"), node: playerResourceCommitment ? <InvestigationOperationsPanel summary={playerResourceCommitment} onDecision={session ? onResourceCommitmentDecision : undefined} busy={busy} /> : null },
    { key: "arc", label: t("world.arc"), node: arc ? <WorldArcProgress summary={arc} /> : null },
    { key: "directive", label: t("world.directive"), node: directive ? <WorldArcDirectivePanel summary={directive} onDecision={onDirectiveDecision} busy={busy} /> : null },
    {
      key: "pressure",
      label: t("world.pressure"),
      node: pressure ? <WorldPressureCascadePanel summary={pressure} /> : null
    },
    {
      key: "outcome",
      label: t("world.outcome"),
      node: outcome ? <div className={`worldLeadOutcome ${outcome.status}`} data-testid="world-lead-outcome">
        <span><b>{text(outcome.status)}</b>{t("world.effect")}</span><small>{text(outcome.benefitLabel)}</small><small>{text(outcome.costLabel)}</small><em>{text(outcome.nextAction)}</em>
      </div> : null
    },
    {
      key: "handoff",
      label: t("world.handoff"),
      node: handoff ? <div className={`worldLeadHandoff ${handoff.status}`} data-testid="world-lead-handoff">
        <span><b>{text(handoff.status)}</b>{text(handoff.label)}</span><small>{text(handoff.nextAction)}</small>
      </div> : null
    },
    {
      key: "lead",
      label: t("world.leadChoice"),
      node: summary ? <>
        <div className="worldLeadMetrics">
          <span><b>{text(summary.focus)}</b>{t("world.preferredStep")}</span>
          <span><b>{text(summary.status === "followed" ? "active" : summary.status === "resolved" ? "complete" : "optional")}</b>{t("world.leadStatus")}</span>
        </div>
        {pending && onDecision && <div className="worldLeadActions">
          <button type="button" className="primaryButton" data-testid="world-lead-follow" onClick={() => onDecision("follow")} disabled={busy}>{t("world.follow")}</button>
          <button type="button" data-testid="world-lead-skip" onClick={() => onDecision("skip")} disabled={busy}>{t("world.keepRoute")}</button>
        </div>}
      </> : null
    }
  ].filter((entry) => Boolean(entry.node));
  const focusedEntry = surfaces.find((entry) => entry.key === action.surface) || surfaces[0];
  const archivedEntries = focusedEntry ? surfaces.filter((entry) => entry !== focusedEntry) : [];
  return (
    <section className={`worldLeadPanel ${summary?.status || "handoffOnly"}`} data-testid="world-lead-panel">
      <div className="worldLeadHeader">
        <div><span>{t("world.lead")}</span><strong>{session ? t("world.caseConsequence") : t("world.nextCaseContext")}</strong></div>
        <b>{text(summary?.status || handoff?.status || arc?.status || action.status)}</b>
      </div>
      <div className={`worldCampaignCurrentAction ${action.status}`} data-testid="world-campaign-current-action" data-command-brief-layer="context">
        <span>{t("world.campaignPriority")}</span><b>{text(commandBrief?.primaryAction?.label || action.label)}</b><small>{text(commandBrief?.whyNow || action.detail)}</small>
      </div>
      <div className="worldCampaignFocus" data-testid="world-campaign-focus" data-focus-surface={focusedEntry?.key || "overview"}>
        <span className="worldCampaignFocusLabel">{t("world.focusedContext")}</span>
        {focusedEntry?.node || <small>{t("world.continueCertified")}</small>}
      </div>
      {archivedEntries.length > 0 && <details className="worldCampaignArchive" data-testid="world-campaign-archive">
        <summary>{t("world.otherContext")} <b>{number(archivedEntries.length)}</b></summary>
        <div className="worldCampaignArchiveList">
          {archivedEntries.map((entry) => <section key={entry.key} data-testid={`world-campaign-archive-${entry.key}`}>
            <h3>{entry.label}</h3>
            {entry.node}
          </section>)}
        </div>
      </details>}
      <em>{session ? t("world.caseBoundary") : t("world.nextCaseBoundary")}</em>
    </section>
  );
}
