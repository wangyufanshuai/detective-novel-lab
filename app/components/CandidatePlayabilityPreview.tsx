import type { CaseCandidate, CaseChainStage } from "@/lib/engine";

export function CandidatePlayabilityPreview({ candidate }: { candidate: CaseCandidate }) {
  const stages = ["motive", "means", "opportunity", "cover-up", "memory", "exclusion"];
  const complete = stages.filter((stage) =>
    candidate.chainCompleteness?.[stage as CaseChainStage]
    || candidate.validation.chainCompleteness?.[stage as CaseChainStage]
    || candidate.chainStageTags?.includes(stage)
    || candidate.validation.chainStages?.includes(stage)
  );
  return (
    <div className="playabilityPreview" data-testid="playability-preview">
      <strong>Playability Preview</strong>
      <span>{candidate.validation.valid ? "Ready for low-spoiler intake" : "Still forming"}</span>
      <div className="logicBadges">
        <span>{complete.length}/6 chain stages</span>
        <span>{candidate.riskChainEventIds.length} source events</span>
        <span>{candidate.memoryIds.length} memories</span>
        <span>{candidate.validation.failureReasons?.[0] || (candidate.validation.valid ? "extractable" : "validation pending")}</span>
      </div>
    </div>
  );
}
