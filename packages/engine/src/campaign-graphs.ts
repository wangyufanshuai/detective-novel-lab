import type { CampaignCaseTimelineEntry, TownCaseType } from "./persistent-town";
import type { EvidenceChainItem, LongActionInstance } from "./town-rules";

export type CampaignCaseEdgeType =
  | "shared-npc"
  | "shared-location"
  | "aftermath"
  | "institution-pressure"
  | "resource-delta"
  | "evidence-contamination"
  | "public-opinion";

export type CampaignCaseNode = {
  caseId: string;
  ordinal: number;
  tick: number;
  caseType: TownCaseType;
  outcome: "solved" | "failed" | "extracted" | "forming";
  culpritId?: string;
  victimId?: string;
  locationId?: string;
  institutionIds: string[];
  evidenceIds: string[];
  aftermathIds: string[];
};

export type CampaignCaseEdge = {
  id: string;
  fromCaseId: string;
  toCaseId: string;
  type: CampaignCaseEdgeType;
  strength: number;
  sourceIds: string[];
  explanation: string;
};

export type CampaignTimelineGraph = {
  nodes: CampaignCaseNode[];
  edges: CampaignCaseEdge[];
  uniqueCaseCount: number;
  influencedLaterCaseCount: number;
  laterCaseInfluenceRate: number;
};

export type EvidenceGraphNodeKind = "evidence" | "case" | "event" | "npc" | "action";

export type EvidenceGraphNode = {
  id: string;
  kind: EvidenceGraphNodeKind;
  label: string;
  evidenceKind?: EvidenceChainItem["kind"];
  locationId?: string;
  integrity?: number;
  contamination?: number;
  provenance?: EvidenceChainItem["provenance"];
  publiclyKnown?: boolean;
};

export type EvidenceGraphEdgeType =
  | "source-event"
  | "handled-by"
  | "tampered-by"
  | "published-by"
  | "autopsy-derived"
  | "ledger-derived"
  | "used-in-resolution"
  | "contaminated-by";

export type EvidenceGraphEdge = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  type: EvidenceGraphEdgeType;
  tick?: number;
  actorId?: string;
  actionId?: string;
};

export type CaseEvidenceUse = {
  caseId: string;
  evidenceIds: string[];
  evidenceCount: number;
  warningCount: number;
  complete: boolean;
};

export type EvidenceGraph = {
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
  caseUses: CaseEvidenceUse[];
  warnings: string[];
};

export type CampaignGraphSummary = {
  uniqueCaseCount: number;
  caseCount: number;
  edgeCount: number;
  influencedLaterCaseCount: number;
  laterCaseInfluenceRate: number;
  edgeTypeDistribution: Partial<Record<CampaignCaseEdgeType, number>>;
};

export type EvidenceGraphSummary = {
  evidenceCount: number;
  edgeCount: number;
  resolvedCaseCount: number;
  completeCaseCount: number;
  warningCount: number;
  evidenceKindDistribution: Partial<Record<NonNullable<EvidenceChainItem["kind"]>, number>>;
};

export type CampaignGraphCaseInput = {
  caseId: string;
  tick: number;
  caseType?: TownCaseType;
  outcome: CampaignCaseNode["outcome"];
  culpritId?: string;
  victimId?: string;
  locationId?: string;
  institutionIds?: string[];
  evidenceIds?: string[];
  contaminatedEvidenceIds?: string[];
  aftermathIds?: string[];
  resourceDeltas?: Record<string, number>;
  publicOpinionDelta?: Record<string, number | undefined>;
};

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function edgeId(fromCaseId: string, toCaseId: string, type: CampaignCaseEdgeType) {
  return `case-edge-${fromCaseId}-${toCaseId}-${type}`;
}

export function buildCampaignTimelineGraph(cases: CampaignGraphCaseInput[]): CampaignTimelineGraph {
  const ordered = [...cases].sort((left, right) => left.tick - right.tick || left.caseId.localeCompare(right.caseId));
  const nodes = ordered.map((item, ordinal): CampaignCaseNode => ({
    caseId: item.caseId,
    ordinal: ordinal + 1,
    tick: item.tick,
    caseType: item.caseType || "murder",
    outcome: item.outcome,
    culpritId: item.culpritId,
    victimId: item.victimId,
    locationId: item.locationId,
    institutionIds: unique(item.institutionIds || []),
    evidenceIds: unique(item.evidenceIds || []),
    aftermathIds: unique(item.aftermathIds || [])
  }));
  const edges: CampaignCaseEdge[] = [];
  const seenEdges = new Set<string>();
  const addEdge = (
    from: CampaignCaseNode,
    to: CampaignCaseNode,
    type: CampaignCaseEdgeType,
    sourceIds: string[],
    explanation: string,
    strength = 1
  ) => {
    const id = edgeId(from.caseId, to.caseId, type);
    if (seenEdges.has(id)) return;
    seenEdges.add(id);
    edges.push({ id, fromCaseId: from.caseId, toCaseId: to.caseId, type, strength, sourceIds: unique(sourceIds), explanation });
  };

  for (let index = 1; index < nodes.length; index += 1) {
    const current = nodes[index];
    const currentInput = ordered[index];
    const previous = nodes.slice(0, index);
    for (const earlier of previous) {
      const sharedNpcIds = unique([current.culpritId, current.victimId].filter((id) => id === earlier.culpritId || id === earlier.victimId));
      if (sharedNpcIds.length) addEdge(earlier, current, "shared-npc", sharedNpcIds, `Reused ${sharedNpcIds.length} NPC(s) from an earlier case.`, sharedNpcIds.length);
      if (current.locationId && current.locationId === earlier.locationId) {
        addEdge(earlier, current, "shared-location", [current.locationId], "A prior case changed the same location context.");
      }
    }
    const nearest = previous[previous.length - 1];
    if (!nearest) continue;
    if ((currentInput.aftermathIds || []).length) {
      addEdge(nearest, current, "aftermath", currentInput.aftermathIds || [], "Prior case aftermath was present in candidate scoring.", 2);
    }
    if ((currentInput.institutionIds || []).length) {
      addEdge(nearest, current, "institution-pressure", currentInput.institutionIds || [], "Institution pressure propagated into the later case.", 2);
    }
    const changedResources = Object.entries(currentInput.resourceDeltas || {}).filter(([, delta]) => delta !== 0).map(([id]) => id);
    if (changedResources.length) {
      addEdge(nearest, current, "resource-delta", changedResources, "Resource flow from the campaign changed later candidate weights.");
    }
    if ((currentInput.contaminatedEvidenceIds || []).length) {
      addEdge(nearest, current, "evidence-contamination", currentInput.contaminatedEvidenceIds || [], "Contaminated evidence affected the later case validation.", 2);
    }
    const opinionChanges = Object.entries(currentInput.publicOpinionDelta || {}).filter(([, delta]) => Number(delta) !== 0).map(([id]) => id);
    if (opinionChanges.length) {
      addEdge(nearest, current, "public-opinion", opinionChanges, "Public opinion changes propagated into witness and institution behavior.");
    }
  }
  const influencedLaterCaseIds = new Set(edges.map((edge) => edge.toCaseId));
  return {
    nodes,
    edges,
    uniqueCaseCount: new Set(nodes.map((node) => node.caseId)).size,
    influencedLaterCaseCount: influencedLaterCaseIds.size,
    laterCaseInfluenceRate: nodes.length <= 1 ? 0 : Math.round((influencedLaterCaseIds.size / (nodes.length - 1)) * 100)
  };
}

function addGraphNode(nodes: Map<string, EvidenceGraphNode>, node: EvidenceGraphNode) {
  if (!nodes.has(node.id)) nodes.set(node.id, node);
}

export function buildEvidenceGraph(input: {
  evidenceItems: EvidenceChainItem[];
  resolvedCaseIds?: string[];
  longActions?: LongActionInstance[];
}): EvidenceGraph {
  const nodes = new Map<string, EvidenceGraphNode>();
  const edges: EvidenceGraphEdge[] = [];
  const seenEdges = new Set<string>();
  const actions = new Map((input.longActions || []).map((action) => [action.id, action]));
  const addEdge = (edge: Omit<EvidenceGraphEdge, "id">) => {
    const id = `evidence-edge-${edge.fromNodeId}-${edge.toNodeId}-${edge.type}`;
    if (seenEdges.has(id)) return;
    seenEdges.add(id);
    edges.push({ id, ...edge });
  };

  for (const item of input.evidenceItems) {
    addGraphNode(nodes, {
      id: item.id,
      kind: "evidence",
      label: item.kind || "evidence",
      evidenceKind: item.kind,
      locationId: item.locationId,
      integrity: item.integrity,
      contamination: item.contamination,
      provenance: item.provenance,
      publiclyKnown: item.publiclyKnown
    });
    for (const eventId of item.sourceEventIds) {
      addGraphNode(nodes, { id: eventId, kind: "event", label: "source event" });
      addEdge({ fromNodeId: eventId, toNodeId: item.id, type: "source-event" });
    }
    for (const npcId of unique([item.discoveredByNpcId, ...item.handledByNpcIds])) {
      addGraphNode(nodes, { id: npcId, kind: "npc", label: "evidence handler" });
      addEdge({ fromNodeId: item.id, toNodeId: npcId, type: "handled-by" });
    }
    for (const tamper of item.tamperHistory || []) {
      addGraphNode(nodes, { id: tamper.actionId, kind: "action", label: "tamper evidence" });
      addEdge({
        fromNodeId: item.id,
        toNodeId: tamper.actionId,
        type: "tampered-by",
        tick: tamper.tick,
        actorId: tamper.actorId,
        actionId: tamper.actionId
      });
      if (tamper.deltaContamination > 0) {
        addEdge({
          fromNodeId: tamper.actionId,
          toNodeId: item.id,
          type: "contaminated-by",
          tick: tamper.tick,
          actorId: tamper.actorId,
          actionId: tamper.actionId
        });
      }
    }
    for (const actionId of item.sourceActionIds || []) {
      const action = actions.get(actionId);
      addGraphNode(nodes, { id: actionId, kind: "action", label: action?.kind || "evidence action" });
      const type: EvidenceGraphEdgeType =
        action?.kind === "conduct-autopsy" ? "autopsy-derived" :
        action?.kind === "audit-ledger" ? "ledger-derived" :
        action?.kind === "publish-rumor" || action?.kind === "leak-to-press" ? "published-by" :
        action?.kind === "tamper-evidence" ? "tampered-by" :
        "source-event";
      addEdge({ fromNodeId: actionId, toNodeId: item.id, type, tick: action?.updatedAtTick, actorId: action?.actorId, actionId });
    }
    for (const caseId of unique([...(item.caseIds || []), item.caseId])) {
      if (!item.usedInResolution) continue;
      addGraphNode(nodes, { id: caseId, kind: "case", label: "resolved case" });
      addEdge({ fromNodeId: item.id, toNodeId: caseId, type: "used-in-resolution" });
    }
  }

  const resolvedCaseIds = unique([
    ...(input.resolvedCaseIds || []),
    ...input.evidenceItems.filter((item) => item.usedInResolution).flatMap((item) => [...(item.caseIds || []), item.caseId])
  ]);
  const caseUses = resolvedCaseIds.map((caseId): CaseEvidenceUse => {
    const evidence = input.evidenceItems.filter((item) => (item.caseId === caseId || item.caseIds?.includes(caseId)) && item.usedInResolution);
    const warningCount = evidence.filter((item) => item.provenance === "weak" || item.integrity <= 45 || item.contamination >= 55).length;
    return {
      caseId,
      evidenceIds: evidence.map((item) => item.id),
      evidenceCount: evidence.length,
      warningCount,
      complete: evidence.length >= 3
    };
  });
  const warnings = caseUses.filter((item) => !item.complete).map((item) => `${item.caseId} has ${item.evidenceCount}/3 evidence nodes.`);
  return { nodes: Array.from(nodes.values()), edges, caseUses, warnings };
}

export function summarizeCampaignGraph(graph: CampaignTimelineGraph): CampaignGraphSummary {
  const edgeTypeDistribution: CampaignGraphSummary["edgeTypeDistribution"] = {};
  for (const edge of graph.edges) edgeTypeDistribution[edge.type] = (edgeTypeDistribution[edge.type] || 0) + 1;
  return {
    uniqueCaseCount: graph.uniqueCaseCount,
    caseCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    influencedLaterCaseCount: graph.influencedLaterCaseCount,
    laterCaseInfluenceRate: graph.laterCaseInfluenceRate,
    edgeTypeDistribution
  };
}

export function summarizeEvidenceGraph(graph: EvidenceGraph): EvidenceGraphSummary {
  const evidenceKindDistribution: EvidenceGraphSummary["evidenceKindDistribution"] = {};
  for (const node of graph.nodes) {
    if (node.kind === "evidence" && node.evidenceKind) {
      evidenceKindDistribution[node.evidenceKind] = (evidenceKindDistribution[node.evidenceKind] || 0) + 1;
    }
  }
  return {
    evidenceCount: graph.nodes.filter((node) => node.kind === "evidence").length,
    edgeCount: graph.edges.length,
    resolvedCaseCount: graph.caseUses.length,
    completeCaseCount: graph.caseUses.filter((item) => item.complete).length,
    warningCount: graph.warnings.length,
    evidenceKindDistribution
  };
}

export function buildRuntimeGraphSummaries(input: {
  caseTimeline?: CampaignCaseTimelineEntry[];
  evidenceItems?: EvidenceChainItem[];
  longActions?: LongActionInstance[];
}) {
  const timeline = [...(input.caseTimeline || [])].reverse();
  const caseGraph = buildCampaignTimelineGraph(timeline.map((item) => ({
    caseId: item.caseId,
    tick: item.tick,
    caseType: item.caseType,
    outcome: item.outcome,
    culpritId: item.culpritId,
    victimId: item.victimId,
    locationId: item.locationId,
    institutionIds: item.influence
  })));
  const evidenceGraph = buildEvidenceGraph({
    evidenceItems: input.evidenceItems || [],
    resolvedCaseIds: timeline.map((item) => item.caseId),
    longActions: input.longActions
  });
  return {
    caseGraphSummary: summarizeCampaignGraph(caseGraph),
    evidenceGraphSummary: summarizeEvidenceGraph(evidenceGraph)
  };
}
