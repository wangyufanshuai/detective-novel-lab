"use client";

import { LockKeyhole } from "lucide-react";
import type { DeductionGraph, DeductionGraphNode } from "@/lib/engine";

type Props = {
  graph: DeductionGraph | null;
  discoveredEvidenceIds: string[];
  solutionRevealed: boolean;
  onSelectEvidence: (evidenceId: string) => void;
  onSelectEvent: (eventId: string) => void;
  onSelectCharacter: (characterId: string) => void;
};

type PositionedNode = DeductionGraphNode & { x: number; y: number; locked: boolean };

const width = 820;
const height = 460;
const columns: Record<DeductionGraphNode["type"], number> = {
  event: 95,
  evidence: 300,
  testimony: 510,
  elimination: 510,
  conclusion: 725
};

function layoutNodes(graph: DeductionGraph, discovered: Set<string>, solutionRevealed: boolean): PositionedNode[] {
  const groups = new Map<DeductionGraphNode["type"], DeductionGraphNode[]>();
  for (const node of graph.nodes) {
    if (node.type === "conclusion" && !solutionRevealed) continue;
    groups.set(node.type, [...(groups.get(node.type) || []), node]);
  }

  const result: PositionedNode[] = [];
  for (const type of ["event", "evidence", "testimony", "elimination", "conclusion"] as const) {
    const nodes = groups.get(type) || [];
    const gap = height / Math.max(nodes.length + 1, 2);
    nodes.forEach((node, index) => {
      const evidenceLocked = node.evidenceIds.length > 0 && !node.evidenceIds.some((id) => discovered.has(id));
      result.push({
        ...node,
        x: columns[type],
        y: gap * (index + 1),
        locked: type !== "conclusion" && evidenceLocked
      });
    });
  }
  return result;
}

export default function DeductionGraphView({
  graph,
  discoveredEvidenceIds,
  solutionRevealed,
  onSelectEvidence,
  onSelectEvent,
  onSelectCharacter
}: Props) {
  if (!graph) return <div className="graphEmpty">正在构建推理图...</div>;

  const discovered = new Set(discoveredEvidenceIds);
  const nodes = layoutNodes(graph, discovered, solutionRevealed);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visibleEdges = graph.edges.filter((edge) => byId.has(edge.from) && byId.has(edge.to));

  function selectNode(node: PositionedNode) {
    if (node.locked) return;
    if (node.evidenceIds[0]) onSelectEvidence(node.evidenceIds[0]);
    else if (node.eventIds[0]) onSelectEvent(node.eventIds[0]);
    else if (node.characterIds[0]) onSelectCharacter(node.characterIds[0]);
  }

  return (
    <div className="deductionGraphViewport" data-testid="deduction-graph">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="交互式推理图">
        <defs>
          <marker id="graph-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#5d7387" />
          </marker>
        </defs>
        <g className="graphEdges">
          {visibleEdges.map((edge) => {
            const from = byId.get(edge.from)!;
            const to = byId.get(edge.to)!;
            const muted = from.locked || to.locked;
            return (
              <path
                key={edge.id}
                d={`M ${from.x + 68} ${from.y} C ${from.x + 110} ${from.y}, ${to.x - 110} ${to.y}, ${to.x - 68} ${to.y}`}
                className={muted ? "locked" : ""}
                markerEnd="url(#graph-arrow)"
              />
            );
          })}
        </g>
        <g className="graphNodesSvg">
          {nodes.map((node) => (
            <g
              key={node.id}
              className={`svgGraphNode type-${node.type} ${node.locked ? "locked" : "unlocked"}`}
              transform={`translate(${node.x - 68} ${node.y - 24})`}
              onClick={() => selectNode(node)}
              role="button"
              aria-label={node.locked ? "未发现的推理节点" : node.label}
              data-node-type={node.type}
            >
              <rect width="136" height="48" rx="5" />
              <text x="68" y="19" textAnchor="middle">
                {node.locked ? "未发现线索" : node.label.slice(0, 14)}
              </text>
              <text className="nodeType" x="68" y="36" textAnchor="middle">
                {node.locked ? "LOCKED" : node.type.toUpperCase()}
              </text>
              {node.locked && (
                <foreignObject x="7" y="15" width="16" height="16">
                  <LockKeyhole size={14} />
                </foreignObject>
              )}
            </g>
          ))}
        </g>
      </svg>
      <div className="graphLegend">
        <span>事件</span><span>证据</span><span>矛盾 / 排除</span><span>唯一结论</span>
      </div>
    </div>
  );
}
