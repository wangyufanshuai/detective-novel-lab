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
  if (!session && runtimeMode === "static-demo") return null;
  if (!session && runtimeMode === "server" && !(handoff || arc || directive || pressure || worldEventOffer || investigatorProgression || campaignRecovery || investigatorHeadquarters || arcConvergence || campaignSession || townSocialResponse)) return null;
  if (runtimeMode === "static-demo") return <StaticWorldCampaignBoundary />;

  const action = deriveCurrentWorldAction({ session, lead: summary, outcome, handoff, arc, directive, pressure, commitment: playerResourceCommitment, offer: worldEventOffer, recovery: campaignRecovery, headquarters: investigatorHeadquarters, convergence: arcConvergence, campaign: campaignSession });
  const pending = summary?.status === "pending";
  const surfaces: Array<{ key: string; label: string; node: ReactNode }> = [
    {
      key: "campaign",
      label: "Campaign journey",
      node: campaignSession ? <CampaignJourneySurface summary={campaignSession} debrief={campaignFinaleDebrief} pacing={campaignPacing} /> : null
    },
    { key: "social", label: "Town reactions", node: townSocialResponse ? <TownSocialResponsePanel summary={townSocialResponse} /> : null },
    { key: "influence", label: "Influence budget", node: influenceBudget ? <WorldInfluenceBudgetPanel summary={influenceBudget} /> : null },
    { key: "faction", label: "Faction relationship", node: factionRelationship ? <FactionRelationshipPanel summary={factionRelationship} /> : null },
    { key: "offer", label: "World opportunity", node: worldEventOffer ? <WorldEventOfferPanel summary={worldEventOffer} onDecision={onWorldEventOfferDecision} busy={busy} /> : null },
    { key: "recovery", label: "Campaign recovery", node: campaignRecovery ? <CampaignRecoveryPanel summary={campaignRecovery} onDecision={onCampaignRecoveryDecision} busy={busy} /> : null },
    { key: "headquarters", label: "Investigator Headquarters", node: investigatorHeadquarters ? <InvestigatorHeadquartersPanel summary={investigatorHeadquarters} onDecision={onInvestigatorHeadquartersDecision} busy={busy} /> : null },
    { key: "progression", label: "Investigator progression", node: investigatorProgression ? <InvestigatorProgressionPanel summary={investigatorProgression} /> : null },
    { key: "convergence", label: "Arc convergence", node: arcConvergence ? <ArcConvergencePanel summary={arcConvergence} /> : null },
    { key: "operations", label: "Investigation operations", node: playerResourceCommitment ? <InvestigationOperationsPanel summary={playerResourceCommitment} onDecision={session ? onResourceCommitmentDecision : undefined} busy={busy} /> : null },
    { key: "arc", label: "World arc", node: arc ? <WorldArcProgress summary={arc} /> : null },
    { key: "directive", label: "Faction directive", node: directive ? <WorldArcDirectivePanel summary={directive} onDecision={onDirectiveDecision} busy={busy} /> : null },
    {
      key: "pressure",
      label: "World pressure",
      node: pressure ? <WorldPressureCascadePanel summary={pressure} /> : null
    },
    {
      key: "outcome",
      label: "World lead outcome",
      node: outcome ? <div className={`worldLeadOutcome ${outcome.status}`} data-testid="world-lead-outcome">
        <span><b>{outcome.status}</b>world effect</span><small>{outcome.benefitLabel}</small><small>{outcome.costLabel}</small><em>{outcome.nextAction}</em>
      </div> : null
    },
    {
      key: "handoff",
      label: "Next-case handoff",
      node: handoff ? <div className={`worldLeadHandoff ${handoff.status}`} data-testid="world-lead-handoff">
        <span><b>{handoff.status}</b>{handoff.label}</span><small>{handoff.nextAction}</small>
      </div> : null
    },
    {
      key: "lead",
      label: "World lead choice",
      node: summary ? <>
        <div className="worldLeadMetrics">
          <span><b>{summary.focus}</b>preferred route step</span>
          <span><b>{summary.status === "followed" ? "active" : summary.status === "resolved" ? "complete" : "optional"}</b>lead status</span>
        </div>
        {pending && onDecision && <div className="worldLeadActions">
          <button type="button" className="primaryButton" data-testid="world-lead-follow" onClick={() => onDecision("follow")} disabled={busy}>Follow World Lead</button>
          <button type="button" data-testid="world-lead-skip" onClick={() => onDecision("skip")} disabled={busy}>Keep Certified Route</button>
        </div>}
      </> : null
    }
  ].filter((entry) => Boolean(entry.node));
  const focusedEntry = surfaces.find((entry) => entry.key === action.surface) || surfaces[0];
  const archivedEntries = focusedEntry ? surfaces.filter((entry) => entry !== focusedEntry) : [];
  return (
    <section className={`worldLeadPanel ${summary?.status || "handoffOnly"}`} data-testid="world-lead-panel">
      <div className="worldLeadHeader">
        <div><span>World Lead</span><strong>{session ? "Case & World Consequence" : "Next Case World Context"}</strong></div>
        <b>{summary?.status || handoff?.status || arc?.status || action.status}</b>
      </div>
      <div className={`worldCampaignCurrentAction ${action.status}`} data-testid="world-campaign-current-action" data-command-brief-layer="context">
        <span>Campaign priority</span><b>{commandBrief?.primaryAction?.label || action.label}</b><small>{commandBrief?.whyNow || action.detail}</small>
      </div>
      <div className="worldCampaignFocus" data-testid="world-campaign-focus" data-focus-surface={focusedEntry?.key || "overview"}>
        <span className="worldCampaignFocusLabel">Focused world context</span>
        {focusedEntry?.node || <small>Continue the certified investigation path; optional world context is archived below.</small>}
      </div>
      {archivedEntries.length > 0 && <details className="worldCampaignArchive" data-testid="world-campaign-archive">
        <summary>Other campaign context <b>{archivedEntries.length}</b></summary>
        <div className="worldCampaignArchiveList">
          {archivedEntries.map((entry) => <section key={entry.key} data-testid={`world-campaign-archive-${entry.key}`}>
            <h3>{entry.label}</h3>
            {entry.node}
          </section>)}
        </div>
      </details>}
      <em>{session ? "No hidden truth, raw ids, evidence bodies, or route coverage are changed." : "Choose any legal candidate; this one-time preference never changes candidate legality or the certified route."}</em>
    </section>
  );
}
