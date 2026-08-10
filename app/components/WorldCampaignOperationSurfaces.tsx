import { useEffect, useState } from "react";
import type { WorldLeadFocus } from "@/lib/engine";
import type {
  FactionRelationshipSummary,
  PlayerResourceCommitmentSummary,
  WorldArcDirectiveSummary,
  WorldArcSummary,
  WorldInfluenceBudgetSummary,
  WorldPressureCascadeSummary
} from "@/app/campaign/world-campaign-types";

export function InvestigationOperationsPanel({ summary, onDecision, busy }: {
  summary: PlayerResourceCommitmentSummary;
  onDecision?: (allocations: WorldLeadFocus[]) => void;
  busy: boolean;
}) {
  const selectedFromSummary = summary.laneSummaries.filter((item) => item.selected).map((item) => item.lane);
  const [draft, setDraft] = useState<WorldLeadFocus[]>(selectedFromSummary);
  const selectedSignature = selectedFromSummary.join("|");
  useEffect(() => setDraft(selectedFromSummary), [summary.completedOperationCount, summary.planStatus, selectedSignature]);
  const authoritative = summary.scope !== "practice";
  const decisionOpen = authoritative && summary.planStatus !== "settled" && summary.completedOperationCount < 3;
  const changed = [...draft].sort().join("|") !== [...selectedFromSummary].sort().join("|");
  const canSave = decisionOpen && (summary.planStatus === "ready" || changed);

  function toggleLane(lane: WorldLeadFocus, locked: boolean, available: boolean) {
    if (locked || (!available && !draft.includes(lane))) return;
    setDraft((current) => current.includes(lane)
      ? current.filter((item) => item !== lane)
      : current.length < summary.supportCapacity ? [...current, lane] : current);
  }

  return (
    <div className={`playerResourceCommitment investigationOperations ${summary.planStatus} ${summary.scope || "authoritative"}`} data-testid="player-resource-commitment" data-operation-scope={summary.scope || "authoritative"}>
      <div className="worldLeadHeader"><div><span>{authoritative ? "Investigation Operations" : "Replay Practice"}</span><strong>{authoritative ? "Current Case Operations" : "Frozen Operations Summary"}</strong></div><b>{authoritative ? summary.planStatus : "practice"}</b></div>
      <small className="investigationOperationsScope">{summary.scopeLabel || "Current case authority"}</small>
      <div className="worldLeadMetrics investigationOperationsMetrics"><span><b>{summary.supportCount}/{summary.supportCapacity}</b>support slots</span><span><b>{summary.completedOperationCount}/3</b>operations resolved</span><span><b>{summary.townTimeMinutes} min</b>case time recorded</span></div>
      <div className="playerResourceCommitmentOptions investigationOperationsLanes">{summary.laneSummaries.map((lane) => {
        const selected = draft.includes(lane.lane);
        const locked = lane.status === "used";
        return <article key={lane.lane} className={`${lane.status} ${selected ? "selected" : ""}`} data-operation-lane={lane.lane}>
          <span>{lane.lane} / {lane.availabilityBand}</span><b>{lane.label}</b><small>{lane.resourceLabel} 路 reserve {lane.reserveCost}</small><small>{lane.benefitLabel}</small><small>{selected ? lane.costLabel : `Standard: ${lane.timeCostMinutes} minutes, no reserve, always legal.`}</small>
          {decisionOpen && onDecision && <button type="button" aria-pressed={selected} data-testid={`investigation-operations-${lane.lane}`} onClick={() => toggleLane(lane.lane, locked, lane.available)} disabled={busy || locked || (!lane.available && !selected) || (!selected && draft.length >= summary.supportCapacity)}>{locked ? "Support spent" : selected ? "Supported" : lane.available ? "Use support" : "Standard only"}</button>}
        </article>;
      })}</div>
      {decisionOpen && onDecision && <button type="button" className="primaryButton" data-testid="investigation-operations-confirm" onClick={() => onDecision(draft)} disabled={busy || !canSave}>{draft.length ? "Confirm Operations Plan" : "Confirm Manual First Plan"}</button>}
      <div className="worldLeadOutcome active investigationOperationsTime"><span><b>Map selection: 0</b>town intervals</span><span><b>Investigation: 1 supported / 2 Manual First</b>town intervals</span><span><b>Advance Town: +1 real tick</b>simulation clock</span><small>{summary.townTimeLabel}</small></div>
      {summary.lastAction && <div className="investigationOperationsAfterAction" data-testid="investigation-operations-after-action"><span>After Action / {summary.lastAction.lane} / {summary.lastAction.mode}</span><b>{summary.lastAction.costLabel}</b><small>{summary.lastAction.gainLabel}</small><small>{summary.lastAction.pressureLabel}</small><em>{summary.lastAction.timeLabel} {summary.lastAction.nextAction}</em></div>}
      {summary.blockedCategory && <small>Safe blocker: {summary.blockedCategory}</small>}
      <em>{summary.nextAction}</em>
      <small>{authoritative ? "Operations alter bounded cost, tempo, and future town pressure only. They never buy evidence, change truth, or bypass the certified handlers." : "Replay remains session-local: no resource reserve, town pressure, Campaign aftermath, or world-cycle settlement can be written."}</small>
    </div>
  );
}

export function FactionRelationshipPanel({ summary }: { summary: FactionRelationshipSummary }) {
  return <div className={`factionRelationshipSummary ${summary.status}`} data-testid="faction-relationship-summary">
    <div className="worldLeadHeader"><div><span>Faction Standing</span><strong>{summary.headline}</strong></div><b>{summary.status}</b></div>
    <div className="worldLeadMetrics"><span><b>{summary.trustedCount}</b>trusted</span><span><b>{summary.strainedCount}</b>guarded</span></div>
    <div className="factionRelationshipBands">{summary.standings.map((standing) => <span key={standing.label} className={standing.standing}><b>{standing.label}</b>{standing.standing} / {standing.directionLabel}</span>)}</div>
    <small>{summary.lastChangeLabel}</small><small>{summary.resourceEffectLabel}</small><em>{summary.nextAction}</em>
  </div>;
}

export function WorldInfluenceBudgetPanel({ summary }: { summary: WorldInfluenceBudgetSummary }) {
  return <div className={`worldInfluenceBudget ${summary.status}`} data-testid="world-influence-budget">
    <span><b>{summary.strengthLabel}</b>unified influence budget</span>
    <div className="worldLeadMetrics"><span><b>{summary.sourceCount}</b>active sources</span><span><b>±{summary.maximumAbsoluteBonus}</b>total cap</span></div>
    <small>{summary.sourceLabel} 路 {summary.directionLabel}</small><em>{summary.nextAction}</em>
  </div>;
}

export function WorldPressureCascadePanel({ summary }: { summary: WorldPressureCascadeSummary }) {
  return <div className={`worldPressureCascade ${summary.status}`} data-testid="world-pressure-cascade">
    <div className="worldLeadHeader"><div><span>World Pressure</span><strong>{summary.focusLabel}</strong></div><b>{summary.status}</b></div>
    <div className="worldLeadMetrics"><span><b>{summary.directionLabel}</b>direction</span><span><b>{summary.activePulseCount}</b>active pulses</span><span><b>{summary.remainingLayers}</b>remaining layers</span></div>
    <small>{summary.affectedCaseLabel}</small><em>{summary.nextAction}</em>
  </div>;
}

export function WorldArcDirectivePanel({ summary, onDecision, busy }: {
  summary: WorldArcDirectiveSummary;
  onDecision?: (choice: "support" | "contain" | "defer") => void;
  busy: boolean;
}) {
  const decisionOpen = summary.status === "ready" || summary.status === "blocked";
  return <div className={`worldArcDirective ${summary.status}`} data-testid="world-arc-directive">
    <div className="worldLeadHeader"><div><span>Faction Directive</span><strong>{summary.factionLabel} / {summary.lineLabel}</strong></div><b>{summary.status}</b></div>
    <div className="worldLeadMetrics"><span><b>{summary.choice || "open"}</b>response</span><span><b>{summary.queuedCount}</b>queued</span><span><b>{summary.progressLabel}</b>operation</span></div>
    {decisionOpen ? <div className="worldArcDirectiveOptions">{(["support", "contain"] as const).map((choice) => <article key={choice}>
      <span>{choice}</span><b>{summary.options[choice].label}</b><small>{summary.options[choice].benefitLabel}</small><small>{summary.options[choice].costLabel}</small>
      {onDecision && <button type="button" className={choice === "support" ? "primaryButton" : ""} data-testid={`world-arc-directive-${choice}`} onClick={() => onDecision(choice)} disabled={busy}>{choice}</button>}
    </article>)}</div> : <div className="worldLeadOutcome active"><span><b>{summary.operationLabel}</b>selected operation</span><small>{summary.benefitLabel}</small><small>{summary.costLabel}</small></div>}
    {decisionOpen && onDecision && <button type="button" data-testid="world-arc-directive-defer" onClick={() => onDecision("defer")} disabled={busy}>Defer</button>}
    {summary.blockedCategory && <small>Safe blocker: {summary.blockedCategory}</small>}<em>{summary.nextAction}</em>
  </div>;
}

export function WorldArcProgress({ summary }: { summary: WorldArcSummary }) {
  const percent = summary.stageCount ? Math.round(summary.completedStages / summary.stageCount * 100) : 0;
  return <div className={`worldArcProgress ${summary.status}`} data-testid="world-arc-progress">
    <span><b>{summary.status}</b>{summary.label}</span><div className="worldArcProgressTrack" aria-label={summary.progressLabel}><i style={{ width: `${percent}%` }} /></div>
    <small>{summary.progressLabel} 路 {summary.pulseLabel}</small><em>{summary.nextAction}</em>
  </div>;
}
