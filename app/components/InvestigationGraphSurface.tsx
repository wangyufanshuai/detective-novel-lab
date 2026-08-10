"use client";

import DeductionGraphView from "@/app/components/DeductionGraphView";
import type { DeductionGraph, DeductionGraphNode } from "@/lib/engine";

export function InvestigationGraphSurface({
  graph,
  discoveredEvidenceIds,
  solutionRevealed,
  selectedNodeId,
  onSelectNode,
  onSelectEvidence,
  onSelectEvent,
  onSelectCharacter
}: {
  graph: DeductionGraph | null;
  discoveredEvidenceIds: string[];
  solutionRevealed: boolean;
  selectedNodeId?: string;
  onSelectNode: (node: DeductionGraphNode) => void;
  onSelectEvidence: (evidenceId: string) => void;
  onSelectEvent: (eventId: string) => void;
  onSelectCharacter: (characterId: string) => void;
}) {
  return <DeductionGraphView graph={graph} discoveredEvidenceIds={discoveredEvidenceIds} solutionRevealed={solutionRevealed} selectedNodeId={selectedNodeId} onSelectNode={onSelectNode} onSelectEvidence={onSelectEvidence} onSelectEvent={onSelectEvent} onSelectCharacter={onSelectCharacter} />;
}
