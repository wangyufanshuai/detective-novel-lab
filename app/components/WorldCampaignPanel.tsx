"use client";

import type { PlayerSession } from "@/lib/engine";

export type WorldLeadSummary = {
  status: "pending" | "followed" | "skipped" | "resolved";
  focus: "search" | "question" | "challenge";
  label: string;
  nextAction: string;
};

export type WorldLeadOutcomeSummary = {
  status: "active" | "settled";
  focus: "search" | "question" | "challenge";
  benefitLabel: string;
  costLabel: string;
  nextAction: string;
};

export type WorldLeadHandoffSummary = {
  status: "ready" | "consumed";
  focus: "search" | "question" | "challenge";
  label: string;
  nextAction: string;
};

export type WorldArcSummary = {
  status: "active" | "completed";
  label: string;
  completedStages: number;
  stageCount: number;
  progressLabel: string;
  pulseLabel: string;
  nextAction: string;
};

export type WorldArcDirectiveSummary = {
  status: "ready" | "scheduled" | "running" | "completed" | "blocked";
  choice?: "support" | "contain" | "defer";
  lineLabel: string;
  factionLabel: string;
  operationLabel: string;
  benefitLabel: string;
  costLabel: string;
  progressLabel: string;
  queuedCount: number;
  nextAction: string;
  blockedCategory?: "institution unavailable" | "staff unavailable" | "resource unavailable" | "operation unavailable";
  options: {
    support: { label: string; benefitLabel: string; costLabel: string };
    contain: { label: string; benefitLabel: string; costLabel: string };
  };
};

export type WorldPressureCascadeSummary = {
  status: "active" | "consumed" | "empty";
  activePulseCount: number;
  directionLabel: string;
  focusLabel: string;
  affectedCaseLabel: string;
  remainingLayers: number;
  nextAction: string;
};

export type WorldInfluenceBudgetSummary = {
  status: "active" | "empty";
  sourceCount: number;
  sourceLabel: string;
  directionLabel: string;
  strengthLabel: "none" | "light" | "bounded";
  maximumAbsoluteBonus: number;
  nextAction: string;
};

export type PlayerResourceCommitmentSummary = {
  status: "ready" | "reserved" | "used" | "released" | "declined" | "blocked";
  choice?: "police-time" | "informant-trust" | "evidence-integrity" | "none";
  lane?: "search" | "question" | "challenge";
  label: string;
  benefitLabel: string;
  costLabel: string;
  progressLabel: string;
  nextAction: string;
  blockedCategory?: "resource unavailable" | "relationship unavailable";
  reserveCost?: number;
  options: Array<{
    choice: "police-time" | "informant-trust" | "evidence-integrity";
    label: string;
    lane: "search" | "question" | "challenge";
    benefitLabel: string;
    costLabel: string;
    available: boolean;
    standingLabel: string;
    reserveCost: number;
  }>;
};

export type FactionRelationshipSummary = {
  status: "stable" | "changed";
  trustedCount: number;
  strainedCount: number;
  headline: string;
  lastChangeLabel: string;
  resourceEffectLabel: string;
  nextAction: string;
  standings: Array<{
    label: string;
    standing: "trusted" | "neutral" | "strained" | "hostile";
    directionLabel: "supportive" | "steady" | "guarded" | "closed";
  }>;
};

export type WorldEventOfferSummary = {
  status: "offered" | "accepted" | "declined" | "running" | "completed" | "failed" | "expired";
  label: string;
  factionLabel: string;
  actionLabel: string;
  benefitLabel: string;
  costLabel: string;
  deadlineBand: "several town cycles" | "accepted" | "closed";
  progressLabel: string;
  queuedCount: number;
  recoveryLabel: string;
  recoveryAvailable: boolean;
  nextAction: string;
};

export type InvestigatorProgressionSummary = {
  status: "developing" | "established";
  points: number;
  competencyLabels: Array<{ label: string; level: number; progressLabel: string }>;
  unlockedLabels: string[];
  nextAction: string;
};

export type CampaignRecoverySummary = {
  status: "empty" | "ready" | "scheduled" | "completed";
  failureLabel: string;
  recoveryActionLabel: string;
  costLabel: string;
  progressLabel: string;
  completedCount: number;
  queuedCount: number;
  nextAction: string;
};

export type ArcConvergenceSummary = {
  status: "locked" | "forming" | "ready" | "active" | "completed";
  finaleLabel: string;
  approachLabel: string;
  caseProgressLabel: string;
  worldProgressLabel: string;
  contextLabels: string[];
  nextAction: string;
};

export type CampaignSessionSummary = {
  status: "opening" | "case-active" | "transition" | "finale-ready" | "finale-active" | "completed";
  chapterLabel: string;
  progressLabel: string;
  primaryActionLabel: string;
  consequenceLabels: string[];
  replayLabel: string;
  nextAction: string;
};

export type CampaignFinaleDebriefSummary = {
  status: "locked" | "ready";
  title: string;
  approachLabel: string;
  causalBeats: string[];
  replayContrast: string;
  nextAction: string;
};

export type TownSocialResponseSummary = {
  status: "empty" | "ready" | "active" | "settled";
  direction: "supportive" | "guarded" | "none";
  directionLabel: string;
  progressLabel: string;
  headline: string;
  reactions: Array<{
    actorName: string;
    roleLabel: string;
    locationLabel: string;
    reactionLabel: string;
  }>;
  nextAction: string;
};

type CurrentWorldAction = {
  status: string;
  label: string;
  detail: string;
};

function currentWorldAction(input: {
  session: PlayerSession | null;
  lead?: WorldLeadSummary | null;
  outcome?: WorldLeadOutcomeSummary | null;
  handoff?: WorldLeadHandoffSummary | null;
  arc?: WorldArcSummary | null;
  directive?: WorldArcDirectiveSummary | null;
  pressure?: WorldPressureCascadeSummary | null;
  commitment?: PlayerResourceCommitmentSummary | null;
  offer?: WorldEventOfferSummary | null;
  recovery?: CampaignRecoverySummary | null;
  convergence?: ArcConvergenceSummary | null;
  campaign?: CampaignSessionSummary | null;
}): CurrentWorldAction {
  if (input.recovery?.status === "ready") {
    return { status: "ready", label: "Choose the available recovery action", detail: input.recovery.nextAction };
  }
  if (input.recovery?.status === "scheduled") {
    return { status: "scheduled", label: "Advance the recovery interval", detail: input.recovery.nextAction };
  }
  if (input.campaign?.status === "completed") {
    return { status: "completed", label: input.campaign.primaryActionLabel, detail: input.campaign.nextAction };
  }
  if (input.directive?.status === "ready" || input.directive?.status === "blocked") {
    return { status: input.directive.status, label: "Choose one faction response", detail: input.directive.nextAction };
  }
  if (input.directive?.status === "scheduled" || input.directive?.status === "running") {
    return { status: input.directive.status, label: "Advance the existing town operation", detail: input.directive.nextAction };
  }
  if (input.offer?.status === "offered") {
    return { status: "offered", label: "Choose this world opportunity", detail: input.offer.nextAction };
  }
  if (input.offer?.status === "accepted" || input.offer?.status === "running") {
    return { status: input.offer.status, label: "Advance the accepted opportunity", detail: input.offer.nextAction };
  }
  if (!input.session && input.handoff?.status === "ready") {
    return { status: "ready", label: "Choose the next legal case", detail: input.handoff.nextAction };
  }
  if (input.convergence?.status === "ready") {
    return { status: "ready", label: "Choose a finale-family case or any legal alternative", detail: input.convergence.nextAction };
  }
  if (input.convergence?.status === "active") {
    return { status: "active", label: "Resolve the converged campaign case", detail: input.convergence.nextAction };
  }
  if (input.session && (input.commitment?.status === "ready" || input.commitment?.status === "blocked")) {
    return { status: input.commitment.status, label: "Choose one case resource", detail: input.commitment.nextAction };
  }
  if (input.lead?.status === "pending") {
    return { status: "choice", label: "Choose how to approach this case", detail: "Follow the safe world lead or keep the certified route order." };
  }
  if (input.session && input.commitment?.status === "reserved") {
    return { status: "reserved", label: `Use the reserve on ${input.commitment.lane}`, detail: input.commitment.nextAction };
  }
  if (input.outcome?.status === "active") {
    return { status: "active", label: "Close the certified investigation", detail: input.outcome.nextAction };
  }
  if (input.pressure?.status === "active") {
    return { status: "active", label: "Carry world pressure into a future case", detail: input.pressure.nextAction };
  }
  if (input.lead) return { status: input.lead.status, label: "Continue the certified investigation", detail: input.lead.nextAction };
  if (input.arc) return { status: input.arc.status, label: "Continue the case-scoped world line", detail: input.arc.nextAction };
  return { status: "ready", label: "Continue the existing investigation path", detail: "World systems remain optional and never replace certified case work." };
}

export function WorldCampaignPanel({
  runtimeMode,
  session,
  summary,
  outcome,
  handoff,
  arc,
  directive,
  pressure,
  influenceBudget,
  playerResourceCommitment,
  factionRelationship,
  worldEventOffer,
  investigatorProgression,
  campaignRecovery,
  arcConvergence,
  campaignSession,
  campaignFinaleDebrief,
  townSocialResponse,
  onDecision,
  onDirectiveDecision,
  onResourceCommitmentDecision,
  onWorldEventOfferDecision,
  onCampaignRecoveryDecision,
  busy
}: {
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
  arcConvergence?: ArcConvergenceSummary | null;
  campaignSession?: CampaignSessionSummary | null;
  campaignFinaleDebrief?: CampaignFinaleDebriefSummary | null;
  townSocialResponse?: TownSocialResponseSummary | null;
  onDecision?: (action: "follow" | "skip") => void;
  onDirectiveDecision?: (choice: "support" | "contain" | "defer") => void;
  onResourceCommitmentDecision?: (choice: "police-time" | "informant-trust" | "evidence-integrity" | "none") => void;
  onWorldEventOfferDecision?: (choice: "accept" | "decline") => void;
  onCampaignRecoveryDecision?: (choice: "start" | "defer") => void;
  busy: boolean;
}) {
  if (!session && runtimeMode === "static-demo") return null;
  if (!session && runtimeMode === "server" && !(handoff || arc || directive || pressure || worldEventOffer || investigatorProgression || campaignRecovery || arcConvergence || campaignSession || townSocialResponse)) return null;
  if (runtimeMode === "static-demo") {
    return (
      <section className="worldLeadPanel static" data-testid="world-lead-panel">
        <div className="worldLeadHeader"><div><span>World Lead</span><strong>Server Runtime loop</strong></div><b>static-safe</b></div>
        <div className="worldCampaignCurrentAction" data-testid="world-campaign-current-action">
          <span>Current world action</span>
          <b>Continue the certified investigation path</b>
          <small>World campaign choices remain Server-only.</small>
        </div>
        <div className="worldInfluenceBudget empty" data-testid="world-influence-budget">
          <span><b>Server-only</b>unified influence budget</span>
          <small>Static keeps future-case ordering read-only and never requests persistent influence state.</small>
        </div>
        <div className="playerResourceCommitment static" data-testid="player-resource-commitment">
          <span><b>Server-only</b>player resource commitment</span>
          <small>Static keeps resource reservation read-only and never exposes persistent choice controls.</small>
        </div>
        <div className="factionRelationshipSummary static" data-testid="faction-relationship-summary">
          <span><b>Server-only</b>faction relationship ledger</span>
          <small>Static does not expose persistent standing or relationship-priced resource controls.</small>
        </div>
        <div className="worldEventOffer static" data-testid="world-event-offer">
          <span><b>Server-only</b>world event offer lifecycle</span>
          <small>Static exposes no persistent offer, deadline state, or Accept / Decline controls.</small>
        </div>
        <div className="investigatorProgression static" data-testid="investigator-progression">
          <span><b>Server-only</b>investigator progression</span>
          <small>Static does not persist practice marks, efficiency unlocks, or recovery retries.</small>
        </div>
        <div className="campaignRecovery static" data-testid="campaign-recovery">
          <span><b>Server-only</b>failure and recovery</span>
          <small>Static does not persist failure state, recovery intervals, or recovery decisions.</small>
        </div>
        <div className="arcConvergence static" data-testid="arc-convergence">
          <span><b>Server-only</b>arc convergence finale</span>
          <small>Static does not read campaign history, activate a finale candidate, or persist completion state.</small>
        </div>
        <div className="campaignSession static" data-testid="campaign-session">
          <span><b>Server-only</b>three-case campaign journey</span>
          <small>Static does not persist campaign chapters, consequence history, finale activation, or campaign debrief state.</small>
        </div>
        <div className="townSocialResponse static" data-testid="town-social-response">
          <span><b>Server-only</b>town social response</span>
          <small>Static does not read public NPC reactions, persist ambient posture, or expose response controls.</small>
        </div>
        <div className="townSocialResponse campaignStudyBoundary static" data-testid="campaign-study-boundary">
          <span><b>Server-only</b>campaign comprehension study</span>
          <small>Even with ?study=1, Static initializes no recorder, writes no study localStorage, and exposes no study controls.</small>
        </div>
        <small>Static Runtime keeps the certified route unchanged. Player case resources, the case-scoped World Arc, the Support / Contain faction directive, the Server-only pressure cascade, town social response, and their unified influence budget run only in local Server Runtime and never call /api/* here.</small>
      </section>
    );
  }

  const action = currentWorldAction({ session, lead: summary, outcome, handoff, arc, directive, pressure, commitment: playerResourceCommitment, offer: worldEventOffer, recovery: campaignRecovery, convergence: arcConvergence, campaign: campaignSession });
  const pending = summary?.status === "pending";
  return (
    <section className={`worldLeadPanel ${summary?.status || "handoffOnly"}`} data-testid="world-lead-panel">
      <div className="worldLeadHeader">
        <div><span>World Lead</span><strong>{session ? "Case & World Consequence" : "Next Case World Context"}</strong></div>
        <b>{summary?.status || handoff?.status || arc?.status || action.status}</b>
      </div>
      <div className={`worldCampaignCurrentAction ${action.status}`} data-testid="world-campaign-current-action">
        <span>Current world action</span>
        <b>{action.label}</b>
        <small>{action.detail}</small>
      </div>
      {campaignSession && <CampaignSessionPanel summary={campaignSession} debrief={campaignFinaleDebrief} />}
      {townSocialResponse && <TownSocialResponsePanel summary={townSocialResponse} />}
      {influenceBudget && <WorldInfluenceBudgetPanel summary={influenceBudget} />}
      {factionRelationship && <FactionRelationshipPanel summary={factionRelationship} />}
      {worldEventOffer && <WorldEventOfferPanel summary={worldEventOffer} onDecision={onWorldEventOfferDecision} busy={busy} />}
      {campaignRecovery && <CampaignRecoveryPanel summary={campaignRecovery} onDecision={onCampaignRecoveryDecision} busy={busy} />}
      {investigatorProgression && <InvestigatorProgressionPanel summary={investigatorProgression} />}
      {arcConvergence && <ArcConvergencePanel summary={arcConvergence} />}
      {session && playerResourceCommitment && <PlayerResourceCommitmentPanel summary={playerResourceCommitment} onDecision={onResourceCommitmentDecision} busy={busy} />}
      {summary && (
        <div className="worldLeadMetrics">
          <span><b>{summary.focus}</b>preferred route step</span>
          <span><b>{summary.status === "followed" ? "active" : summary.status === "resolved" ? "complete" : "optional"}</b>lead status</span>
        </div>
      )}
      {arc && <WorldArcProgress summary={arc} />}
      {directive && <WorldArcDirectivePanel summary={directive} onDecision={onDirectiveDecision} busy={busy} />}
      {pressure && <WorldPressureCascadePanel summary={pressure} />}
      {outcome && (
        <div className={`worldLeadOutcome ${outcome.status}`} data-testid="world-lead-outcome">
          <span><b>{outcome.status}</b>world effect</span>
          <small>{outcome.benefitLabel}</small>
          <small>{outcome.costLabel}</small>
          <em>{outcome.nextAction}</em>
        </div>
      )}
      {handoff && (
        <div className={`worldLeadHandoff ${handoff.status}`} data-testid="world-lead-handoff">
          <span><b>{handoff.status}</b>{handoff.label}</span>
          <small>{handoff.nextAction}</small>
        </div>
      )}
      {pending && onDecision && (
        <div className="worldLeadActions">
          <button type="button" className="primaryButton" data-testid="world-lead-follow" onClick={() => onDecision("follow")} disabled={busy}>Follow World Lead</button>
          <button type="button" data-testid="world-lead-skip" onClick={() => onDecision("skip")} disabled={busy}>Keep Certified Route</button>
        </div>
      )}
      <em>{session ? "No hidden truth, raw ids, evidence bodies, or route coverage are changed." : "Choose any legal candidate; this one-time preference never changes candidate legality or the certified route."}</em>
    </section>
  );
}

function TownSocialResponsePanel({ summary }: { summary: TownSocialResponseSummary }) {
  return (
    <div className={`townSocialResponse ${summary.status} ${summary.direction}`} data-testid="town-social-response">
      <div className="worldLeadHeader">
        <div><span>Town Reactions</span><strong>{summary.directionLabel}</strong></div>
        <b>{summary.status}</b>
      </div>
      <div className="worldLeadMetrics">
        <span><b>{summary.progressLabel}</b>public reactions</span>
        <span><b>{summary.direction}</b>ambient posture</span>
      </div>
      <small>{summary.headline}</small>
      {summary.reactions.length > 0 && (
        <ul className="townSocialResponseList">
          {summary.reactions.map((reaction, index) => (
            <li key={`${reaction.actorName}-${reaction.locationLabel}-${index}`}>
              <b>{reaction.actorName}</b>
              <span>{reaction.roleLabel} · {reaction.locationLabel}</span>
              <small>{reaction.reactionLabel}</small>
            </li>
          ))}
        </ul>
      )}
      <em>{summary.nextAction}</em>
    </div>
  );
}

function CampaignSessionPanel({ summary, debrief }: { summary: CampaignSessionSummary; debrief?: CampaignFinaleDebriefSummary | null }) {
  return (
    <div className={`campaignSession ${summary.status}`} data-testid="campaign-session">
      <div className="worldLeadHeader">
        <div><span>Campaign Journey</span><strong>{summary.chapterLabel}</strong></div>
        <b>{summary.status}</b>
      </div>
      <div className="worldLeadMetrics">
        <span><b>{summary.progressLabel}</b>campaign progress</span>
        <span><b>{summary.primaryActionLabel}</b>primary action</span>
      </div>
      {summary.consequenceLabels.length > 0 && <small>{summary.consequenceLabels.join(" / ")}</small>}
      <small>{summary.replayLabel}</small>
      <em>{summary.nextAction}</em>
      {debrief?.status === "ready" && (
        <div className="campaignFinaleDebrief" data-testid="campaign-finale-debrief">
          <b>{debrief.title}</b>
          <small>{debrief.approachLabel}</small>
          <ol>{debrief.causalBeats.map((beat) => <li key={beat}>{beat}</li>)}</ol>
          <small>{debrief.replayContrast}</small>
          <em>{debrief.nextAction}</em>
        </div>
      )}
    </div>
  );
}

function ArcConvergencePanel({ summary }: { summary: ArcConvergenceSummary }) {
  return (
    <div className={`arcConvergence ${summary.status}`} data-testid="arc-convergence">
      <div className="worldLeadHeader">
        <div><span>Arc Convergence</span><strong>{summary.finaleLabel}</strong></div>
        <b>{summary.status}</b>
      </div>
      <div className="worldLeadMetrics">
        <span><b>{summary.caseProgressLabel}</b>case path</span>
        <span><b>{summary.worldProgressLabel}</b>world path</span>
      </div>
      <small>{summary.approachLabel}</small>
      {summary.contextLabels.length > 0 && <small>{summary.contextLabels.join(" / ")}</small>}
      <em>{summary.nextAction}</em>
    </div>
  );
}

function CampaignRecoveryPanel({ summary, onDecision, busy }: {
  summary: CampaignRecoverySummary;
  onDecision?: (choice: "start" | "defer") => void;
  busy: boolean;
}) {
  return (
    <div className={`campaignRecovery ${summary.status}`} data-testid="campaign-recovery">
      <div className="worldLeadHeader">
        <div><span>Failure & Recovery</span><strong>{summary.recoveryActionLabel}</strong></div>
        <b>{summary.status}</b>
      </div>
      <div className="worldLeadMetrics">
        <span><b>{summary.completedCount}</b>recoveries completed</span>
        <span><b>{summary.queuedCount}</b>queued</span>
      </div>
      <small>{summary.failureLabel}</small>
      <small>{summary.costLabel}</small>
      <small>{summary.progressLabel}</small>
      {summary.status === "ready" && onDecision && (
        <div className="worldEventOfferActions">
          <button type="button" className="primaryButton" data-testid="campaign-recovery-start" onClick={() => onDecision("start")} disabled={busy}>Start Recovery</button>
          <button type="button" data-testid="campaign-recovery-defer" onClick={() => onDecision("defer")} disabled={busy}>Defer</button>
        </div>
      )}
      <em>{summary.nextAction}</em>
    </div>
  );
}

function InvestigatorProgressionPanel({ summary }: { summary: InvestigatorProgressionSummary }) {
  return (
    <div className={`investigatorProgression ${summary.status}`} data-testid="investigator-progression">
      <div className="worldLeadHeader">
        <div><span>Investigator Progression</span><strong>Practice profile</strong></div>
        <b>{summary.status}</b>
      </div>
      <div className="worldLeadMetrics">
        <span><b>{summary.points}</b>practice marks</span>
        <span><b>{summary.unlockedLabels.length}</b>bounded unlocks</span>
      </div>
      <div className="investigatorProgressionCompetencies">
        {summary.competencyLabels.map((item) => <span key={item.label}><b>{item.level}</b>{item.label} · {item.progressLabel}</span>)}
      </div>
      {summary.unlockedLabels.map((label) => <small key={label}>Unlocked: {label}</small>)}
      <em>{summary.nextAction}</em>
    </div>
  );
}

function WorldEventOfferPanel({ summary, onDecision, busy }: {
  summary: WorldEventOfferSummary;
  onDecision?: (choice: "accept" | "decline") => void;
  busy: boolean;
}) {
  return (
    <div className={`worldEventOffer ${summary.status}`} data-testid="world-event-offer">
      <div className="worldLeadHeader">
        <div><span>World Opportunity</span><strong>{summary.label}</strong></div>
        <b>{summary.status}</b>
      </div>
      <div className="worldLeadMetrics">
        <span><b>{summary.deadlineBand}</b>deadline</span>
        <span><b>{summary.queuedCount}</b>queued</span>
      </div>
      <b>{summary.actionLabel}</b>
      <small>{summary.benefitLabel}</small>
      <small>{summary.costLabel}</small>
      <small>{summary.progressLabel}</small>
      {(summary.status === "failed" || summary.status === "expired") && <small>{summary.recoveryLabel}</small>}
      {summary.status === "offered" && onDecision && (
        <div className="worldEventOfferActions">
          <button type="button" className="primaryButton" data-testid="world-event-offer-accept" onClick={() => onDecision("accept")} disabled={busy}>Accept</button>
          <button type="button" data-testid="world-event-offer-decline" onClick={() => onDecision("decline")} disabled={busy}>Decline</button>
        </div>
      )}
      {summary.recoveryAvailable && onDecision && (
        <div className="worldEventOfferActions">
          <button type="button" className="primaryButton" data-testid="world-event-offer-retry" onClick={() => onDecision("accept")} disabled={busy}>Retry Recovery</button>
        </div>
      )}
      <em>{summary.nextAction}</em>
    </div>
  );
}

function PlayerResourceCommitmentPanel({ summary, onDecision, busy }: {
  summary: PlayerResourceCommitmentSummary;
  onDecision?: (choice: "police-time" | "informant-trust" | "evidence-integrity" | "none") => void;
  busy: boolean;
}) {
  const decisionOpen = summary.status === "ready" || summary.status === "blocked";
  return (
    <div className={`playerResourceCommitment ${summary.status}`} data-testid="player-resource-commitment">
      <div className="worldLeadHeader">
        <div><span>Case Resource</span><strong>{summary.label}</strong></div>
        <b>{summary.status}</b>
      </div>
      {decisionOpen ? (
        <div className="playerResourceCommitmentOptions">
          {summary.options.map((option) => (
            <article key={option.choice}>
              <span>{option.lane}</span>
              <b>{option.label}</b>
              <small>{option.benefitLabel}</small>
              <small>{option.costLabel}</small>
              <small>{option.standingLabel} / cost {option.reserveCost}</small>
              {onDecision && <button type="button" className={option.choice === "police-time" ? "primaryButton" : ""} data-testid={`player-resource-${option.choice}`} onClick={() => onDecision(option.choice)} disabled={busy || !option.available}>{option.available ? "Reserve" : "Unavailable"}</button>}
            </article>
          ))}
        </div>
      ) : (
        <div className="worldLeadOutcome active">
          <span><b>{summary.progressLabel}</b>case resource</span>
          <small>{summary.benefitLabel}</small>
          <small>{summary.costLabel}</small>
        </div>
      )}
      {decisionOpen && onDecision && <button type="button" data-testid="player-resource-none" onClick={() => onDecision("none")} disabled={busy}>Continue without reserve</button>}
      {summary.blockedCategory && <small>Safe blocker: {summary.blockedCategory}</small>}
      <em>{summary.nextAction}</em>
    </div>
  );
}

function FactionRelationshipPanel({ summary }: { summary: FactionRelationshipSummary }) {
  return (
    <div className={`factionRelationshipSummary ${summary.status}`} data-testid="faction-relationship-summary">
      <div className="worldLeadHeader">
        <div><span>Faction Standing</span><strong>{summary.headline}</strong></div>
        <b>{summary.status}</b>
      </div>
      <div className="worldLeadMetrics">
        <span><b>{summary.trustedCount}</b>trusted</span>
        <span><b>{summary.strainedCount}</b>guarded</span>
      </div>
      <div className="factionRelationshipBands">
        {summary.standings.map((standing) => (
          <span key={standing.label} className={standing.standing}><b>{standing.label}</b>{standing.standing} / {standing.directionLabel}</span>
        ))}
      </div>
      <small>{summary.lastChangeLabel}</small>
      <small>{summary.resourceEffectLabel}</small>
      <em>{summary.nextAction}</em>
    </div>
  );
}

function WorldInfluenceBudgetPanel({ summary }: { summary: WorldInfluenceBudgetSummary }) {
  return (
    <div className={`worldInfluenceBudget ${summary.status}`} data-testid="world-influence-budget">
      <span><b>{summary.strengthLabel}</b>unified influence budget</span>
      <div className="worldLeadMetrics">
        <span><b>{summary.sourceCount}</b>active sources</span>
        <span><b>±{summary.maximumAbsoluteBonus}</b>total cap</span>
      </div>
      <small>{summary.sourceLabel} · {summary.directionLabel}</small>
      <em>{summary.nextAction}</em>
    </div>
  );
}

function WorldPressureCascadePanel({ summary }: { summary: WorldPressureCascadeSummary }) {
  return (
    <div className={`worldPressureCascade ${summary.status}`} data-testid="world-pressure-cascade">
      <div className="worldLeadHeader">
        <div><span>World Pressure</span><strong>{summary.focusLabel}</strong></div>
        <b>{summary.status}</b>
      </div>
      <div className="worldLeadMetrics">
        <span><b>{summary.directionLabel}</b>direction</span>
        <span><b>{summary.activePulseCount}</b>active pulses</span>
        <span><b>{summary.remainingLayers}</b>remaining layers</span>
      </div>
      <small>{summary.affectedCaseLabel}</small>
      <em>{summary.nextAction}</em>
    </div>
  );
}

function WorldArcDirectivePanel({ summary, onDecision, busy }: {
  summary: WorldArcDirectiveSummary;
  onDecision?: (choice: "support" | "contain" | "defer") => void;
  busy: boolean;
}) {
  const decisionOpen = summary.status === "ready" || summary.status === "blocked";
  return (
    <div className={`worldArcDirective ${summary.status}`} data-testid="world-arc-directive">
      <div className="worldLeadHeader">
        <div><span>Faction Directive</span><strong>{summary.factionLabel} / {summary.lineLabel}</strong></div>
        <b>{summary.status}</b>
      </div>
      <div className="worldLeadMetrics">
        <span><b>{summary.choice || "open"}</b>response</span>
        <span><b>{summary.queuedCount}</b>queued</span>
        <span><b>{summary.progressLabel}</b>operation</span>
      </div>
      {decisionOpen ? (
        <div className="worldArcDirectiveOptions">
          {(["support", "contain"] as const).map((choice) => (
            <article key={choice}>
              <span>{choice}</span>
              <b>{summary.options[choice].label}</b>
              <small>{summary.options[choice].benefitLabel}</small>
              <small>{summary.options[choice].costLabel}</small>
              {onDecision && <button type="button" className={choice === "support" ? "primaryButton" : ""} data-testid={`world-arc-directive-${choice}`} onClick={() => onDecision(choice)} disabled={busy}>{choice}</button>}
            </article>
          ))}
        </div>
      ) : (
        <div className="worldLeadOutcome active">
          <span><b>{summary.operationLabel}</b>selected operation</span>
          <small>{summary.benefitLabel}</small>
          <small>{summary.costLabel}</small>
        </div>
      )}
      {decisionOpen && onDecision && <button type="button" data-testid="world-arc-directive-defer" onClick={() => onDecision("defer")} disabled={busy}>Defer</button>}
      {summary.blockedCategory && <small>Safe blocker: {summary.blockedCategory}</small>}
      <em>{summary.nextAction}</em>
    </div>
  );
}

function WorldArcProgress({ summary }: { summary: WorldArcSummary }) {
  const percent = summary.stageCount ? Math.round(summary.completedStages / summary.stageCount * 100) : 0;
  return (
    <div className={`worldArcProgress ${summary.status}`} data-testid="world-arc-progress">
      <span><b>{summary.status}</b>{summary.label}</span>
      <div className="worldArcProgressTrack" aria-label={summary.progressLabel}><i style={{ width: `${percent}%` }} /></div>
      <small>{summary.progressLabel} · {summary.pulseLabel}</small>
      <em>{summary.nextAction}</em>
    </div>
  );
}
