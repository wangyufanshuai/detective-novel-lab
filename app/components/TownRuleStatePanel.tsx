import type { TownCaseLifecycleState, TownRuleSnapshotSummary } from "@/lib/engine";

type TownRuleStatePanelProps = {
  ruleState?: TownRuleSnapshotSummary | null;
  caseLifecycle?: TownCaseLifecycleState | null;
};

export function TownRuleStatePanel({ ruleState, caseLifecycle }: TownRuleStatePanelProps) {
  const institutions = ruleState?.institutions || [];
  const pressureLeaders = [...institutions]
    .sort((left, right) => right.pressure - left.pressure || left.resources - right.resources)
    .slice(0, 3);
  const latestDecision = ruleState?.institutionDecisions?.[0];
  const timeline = caseLifecycle?.caseTimeline || [];
  const uniqueCaseCount = new Set(timeline.map((item) => item.caseId)).size;
  const caseGraphEdgeCount = timeline.slice(1).reduce((sum, item) => sum + Math.max(1, item.influence?.length || 0), 0);
  const evidenceWarnings = timeline.filter((item) =>
    (ruleState?.evidenceChain.items || []).filter((evidence) =>
      evidence.usedInResolution && (evidence.caseId === item.caseId || evidence.caseIds?.includes(item.caseId))
    ).length < 3
  ).length;
  return (
    <section className="ruleStatePanel" data-testid="rule-state-panel">
      <div className="panelHeaderLine">
        <h3>Rule State / Case Lifecycle</h3>
        <span>{ruleState ? "live" : "not loaded"}</span>
      </div>
      <div className="reviewMetricGrid compact">
        <span><b>{ruleState?.publicOpinion.heat ?? 0}</b>media heat</span>
        <span><b>{ruleState?.publicOpinion.witnessFear ?? 0}</b>witness fear</span>
        <span><b>{ruleState?.evidenceChain.items.length ?? 0}</b>evidence chain</span>
        <span><b>{ruleState?.evidenceContamination.contamination ?? 0}</b>contamination</span>
        <span><b>{caseLifecycle?.activeCaseIds.length ?? 0}</b>active cases</span>
        <span><b>{caseLifecycle?.caseAftermathLog.length ?? 0}</b>aftermath</span>
        <span><b>{uniqueCaseCount}/{timeline.length}</b>unique cases</span>
        <span><b>{caseGraphEdgeCount}</b>case graph edges</span>
        <span className={evidenceWarnings ? "fail" : "pass"}><b>{evidenceWarnings}</b>evidence graph warnings</span>
      </div>
      <div className="reviewHistoryList compactJobs">
        {pressureLeaders.map((institution) => (
          <div key={institution.id} className="reviewJobCard">
            <strong>{institution.kind}</strong>
            <span>pressure {institution.pressure}</span>
            <small>resources {institution.resources} / reputation {institution.reputation}</small>
          </div>
        ))}
        {latestDecision && (
          <div className="reviewJobCard">
            <strong>{latestDecision.strategy}</strong>
            <span>{latestDecision.institutionId}</span>
            <small>{latestDecision.reason}</small>
          </div>
        )}
      </div>
      <small>
        Evidence and institution strategy are read-only here. Case lifecycle changes only after an explicit resolution path.
      </small>
    </section>
  );
}
