"use client";

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
import { useAppLocale } from "@/app/localization/locale-context";

export function InvestigationOperationsPanel({ summary, onDecision, busy }: {
  summary: PlayerResourceCommitmentSummary;
  onDecision?: (allocations: WorldLeadFocus[]) => void;
  busy: boolean;
}) {
  const { number, t, text } = useAppLocale();
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
      <div className="worldLeadHeader"><div><span>{authoritative ? t("world.operations") : t("world.replayPractice")}</span><strong>{authoritative ? t("world.currentCaseOperations") : t("world.frozenOperations")}</strong></div><b>{text(authoritative ? summary.planStatus : "practice")}</b></div>
      <small className="investigationOperationsScope">{text(summary.scopeLabel || t("world.currentCaseAuthority"))}</small>
      <div className="worldLeadMetrics investigationOperationsMetrics"><span><b>{number(summary.supportCount)}/{number(summary.supportCapacity)}</b>{t("world.supportSlots")}</span><span><b>{number(summary.completedOperationCount)}/3</b>{t("world.operationsResolved")}</span><span><b>{number(summary.townTimeMinutes)} min</b>{t("world.caseTime")}</span></div>
      <div className="playerResourceCommitmentOptions investigationOperationsLanes">{summary.laneSummaries.map((lane) => {
        const selected = draft.includes(lane.lane);
        const locked = lane.status === "used";
        return <article key={lane.lane} className={`${lane.status} ${selected ? "selected" : ""}`} data-operation-lane={lane.lane}>
          <span>{text(lane.lane)} / {text(lane.availabilityBand)}</span><b>{text(lane.label)}</b><small>{text(lane.resourceLabel)} · {t("world.reserve")} {number(lane.reserveCost)}</small><small>{text(lane.benefitLabel)}</small><small>{selected ? text(lane.costLabel) : t("world.standardPlan", { minutes: number(lane.timeCostMinutes) })}</small>
          {decisionOpen && onDecision && <button type="button" aria-pressed={selected} data-testid={`investigation-operations-${lane.lane}`} onClick={() => toggleLane(lane.lane, locked, lane.available)} disabled={busy || locked || (!lane.available && !selected) || (!selected && draft.length >= summary.supportCapacity)}>{locked ? t("world.supportSpent") : selected ? t("world.supported") : lane.available ? t("world.useSupport") : t("world.standardOnly")}</button>}
        </article>;
      })}</div>
      {decisionOpen && onDecision && <button type="button" className="primaryButton" data-testid="investigation-operations-confirm" onClick={() => onDecision(draft)} disabled={busy || !canSave}>{draft.length ? t("world.confirmOperations") : t("world.confirmManual")}</button>}
      <div className="worldLeadOutcome active investigationOperationsTime"><span><b>{t("world.mapSelectionTime")}</b>{t("world.townIntervals")}</span><span><b>{t("world.investigationTime")}</b>{t("world.townIntervals")}</span><span><b>{t("world.advanceTownTime")}</b>{t("world.simulationClock")}</span><small>{text(summary.townTimeLabel)}</small></div>
      {summary.lastAction && <div className="investigationOperationsAfterAction" data-testid="investigation-operations-after-action"><span>{t("world.afterAction")} / {text(summary.lastAction.lane)} / {text(summary.lastAction.mode)}</span><b>{text(summary.lastAction.costLabel)}</b><small>{text(summary.lastAction.gainLabel)}</small><small>{text(summary.lastAction.pressureLabel)}</small><em>{text(summary.lastAction.timeLabel)} {text(summary.lastAction.nextAction)}</em></div>}
      {summary.blockedCategory && <small>{t("world.safeBlocker")}: {text(summary.blockedCategory)}</small>}
      <em>{text(summary.nextAction)}</em>
      <small>{authoritative ? "Operations alter bounded cost, tempo, and future town pressure only. They never buy evidence, change truth, or bypass the certified handlers." : "Replay remains session-local: no resource reserve, town pressure, Campaign aftermath, or world-cycle settlement can be written."}</small>
    </div>
  );
}

export function FactionRelationshipPanel({ summary }: { summary: FactionRelationshipSummary }) {
  const { number, t, text } = useAppLocale();
  return <div className={`factionRelationshipSummary ${summary.status}`} data-testid="faction-relationship-summary">
    <div className="worldLeadHeader"><div><span>{t("world.factionStanding")}</span><strong>{text(summary.headline)}</strong></div><b>{text(summary.status)}</b></div>
    <div className="worldLeadMetrics"><span><b>{number(summary.trustedCount)}</b>{t("world.trusted")}</span><span><b>{number(summary.strainedCount)}</b>{t("world.guarded")}</span></div>
    <div className="factionRelationshipBands">{summary.standings.map((standing) => <span key={standing.label} className={standing.standing}><b>{text(standing.label)}</b>{text(standing.standing)} / {text(standing.directionLabel)}</span>)}</div>
    <small>{text(summary.lastChangeLabel)}</small><small>{text(summary.resourceEffectLabel)}</small><em>{text(summary.nextAction)}</em>
  </div>;
}

export function WorldInfluenceBudgetPanel({ summary }: { summary: WorldInfluenceBudgetSummary }) {
  const { number, t, text } = useAppLocale();
  return <div className={`worldInfluenceBudget ${summary.status}`} data-testid="world-influence-budget">
    <span><b>{text(summary.strengthLabel)}</b>{t("world.unifiedInfluence")}</span>
    <div className="worldLeadMetrics"><span><b>{number(summary.sourceCount)}</b>{t("world.activeSources")}</span><span><b>±{number(summary.maximumAbsoluteBonus)}</b>{t("world.totalCap")}</span></div>
    <small>{text(summary.sourceLabel)} · {text(summary.directionLabel)}</small><em>{text(summary.nextAction)}</em>
  </div>;
}

export function WorldPressureCascadePanel({ summary }: { summary: WorldPressureCascadeSummary }) {
  const { number, t, text } = useAppLocale();
  return <div className={`worldPressureCascade ${summary.status}`} data-testid="world-pressure-cascade">
    <div className="worldLeadHeader"><div><span>{t("world.pressure")}</span><strong>{text(summary.focusLabel)}</strong></div><b>{text(summary.status)}</b></div>
    <div className="worldLeadMetrics"><span><b>{text(summary.directionLabel)}</b>{t("world.direction")}</span><span><b>{number(summary.activePulseCount)}</b>{t("world.activePulses")}</span><span><b>{number(summary.remainingLayers)}</b>{t("world.remainingLayers")}</span></div>
    <small>{text(summary.affectedCaseLabel)}</small><em>{text(summary.nextAction)}</em>
  </div>;
}

export function WorldArcDirectivePanel({ summary, onDecision, busy }: {
  summary: WorldArcDirectiveSummary;
  onDecision?: (choice: "support" | "contain" | "defer") => void;
  busy: boolean;
}) {
  const { number, t, text } = useAppLocale();
  const decisionOpen = summary.status === "ready" || summary.status === "blocked";
  return <div className={`worldArcDirective ${summary.status}`} data-testid="world-arc-directive">
    <div className="worldLeadHeader"><div><span>{t("world.directive")}</span><strong>{text(summary.factionLabel)} / {text(summary.lineLabel)}</strong></div><b>{text(summary.status)}</b></div>
    <div className="worldLeadMetrics"><span><b>{text(summary.choice || "open")}</b>{t("world.response")}</span><span><b>{number(summary.queuedCount)}</b>{t("world.queued")}</span><span><b>{text(summary.progressLabel)}</b>{t("world.operation")}</span></div>
    {decisionOpen ? <div className="worldArcDirectiveOptions">{(["support", "contain"] as const).map((choice) => <article key={choice}>
      <span>{t(choice === "support" ? "world.support" : "world.contain")}</span><b>{text(summary.options[choice].label)}</b><small>{text(summary.options[choice].benefitLabel)}</small><small>{text(summary.options[choice].costLabel)}</small>
      {onDecision && <button type="button" className={choice === "support" ? "primaryButton" : ""} data-testid={`world-arc-directive-${choice}`} onClick={() => onDecision(choice)} disabled={busy}>{t(choice === "support" ? "world.support" : "world.contain")}</button>}
    </article>)}</div> : <div className="worldLeadOutcome active"><span><b>{text(summary.operationLabel)}</b>{t("world.selectedOperation")}</span><small>{text(summary.benefitLabel)}</small><small>{text(summary.costLabel)}</small></div>}
    {decisionOpen && onDecision && <button type="button" data-testid="world-arc-directive-defer" onClick={() => onDecision("defer")} disabled={busy}>{t("world.defer")}</button>}
    {summary.blockedCategory && <small>{t("world.safeBlocker")}: {text(summary.blockedCategory)}</small>}<em>{text(summary.nextAction)}</em>
  </div>;
}

export function WorldArcProgress({ summary }: { summary: WorldArcSummary }) {
  const { text } = useAppLocale();
  const percent = summary.stageCount ? Math.round(summary.completedStages / summary.stageCount * 100) : 0;
  return <div className={`worldArcProgress ${summary.status}`} data-testid="world-arc-progress">
    <span><b>{text(summary.status)}</b>{text(summary.label)}</span><div className="worldArcProgressTrack" aria-label={text(summary.progressLabel)}><i style={{ width: `${percent}%` }} /></div>
    <small>{text(summary.progressLabel)} · {text(summary.pulseLabel)}</small><em>{text(summary.nextAction)}</em>
  </div>;
}
