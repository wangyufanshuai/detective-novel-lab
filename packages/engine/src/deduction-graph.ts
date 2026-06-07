import { deriveSuspectMatrix } from "./validators";
import type {
  CaseFromLog,
  CaseLogicReport,
  DeductionGraph,
  DeductionGraphEdge,
  DeductionGraphNode,
  MisdirectionProfile,
  SuspectBoardRow,
  SuspectEliminationStep,
  WorldEvent,
  WorldState
} from "./world-types";

function eventByEvidence(events: WorldEvent[], evidenceId: string) {
  return events.find((event) => event.evidenceId === evidenceId);
}

function characterName(caseFromLog: CaseFromLog, characterId: string) {
  return caseFromLog.deductionCase.characters.find((character) => character.id === characterId)?.name || characterId;
}

function evidenceTitle(caseFromLog: CaseFromLog, evidenceId: string) {
  return caseFromLog.deductionCase.evidence.find((evidence) => evidence.id === evidenceId)?.title || evidenceId;
}

export function deriveSuspectBoard(caseFromLog: CaseFromLog, events: WorldEvent[] = []): SuspectBoardRow[] {
  const matrix = deriveSuspectMatrix(caseFromLog.deductionCase);
  const sourceByEvidence = new Map(events.filter((event) => event.evidenceId).map((event) => [event.evidenceId!, event.id]));
  const victimId = caseFromLog.generationProfile.victimId;
  return caseFromLog.deductionCase.characters
    .filter((character) => character.id !== victimId)
    .map((character) => {
      const row = matrix.find((item) => item.characterId === character.id);
      const exclusionEvidenceIds = row?.excludedByEvidenceIds || [];
      const sourceEventIds = exclusionEvidenceIds.map((id) => sourceByEvidence.get(id)).filter((id): id is string => Boolean(id));
      const isCulprit = character.id === caseFromLog.deductionCase.truth.culpritId;
      const isRedHerring = caseFromLog.generationProfile.focusSuspectIds.includes(character.id);
      return {
        characterId: character.id,
        name: character.name,
        role: character.role,
        motive: Boolean(row?.motive),
        means: Boolean(row?.means),
        opportunity: Boolean(row?.opportunity),
        surfaceSuspicion: isCulprit
          ? "Motive, means, and opportunity stay unrefuted."
          : isRedHerring
            ? "Looks plausible until the alibi/source evidence is found."
            : "Has town-level contact with the victim but lacks a complete chain.",
        exclusionEvidenceIds,
        sourceEventIds,
        status: isCulprit ? "culprit" : isRedHerring ? "red_herring" : "eliminated"
      };
    });
}

export function buildSuspectEliminationSteps(caseFromLog: CaseFromLog, events: WorldEvent[] = []): SuspectEliminationStep[] {
  const board = deriveSuspectBoard(caseFromLog, events);
  return board.map((row) => ({
    characterId: row.characterId,
    suspectName: row.name,
    surfaceSuspicion: row.surfaceSuspicion,
    eliminatedByEvidenceIds: row.exclusionEvidenceIds,
    sourceEventIds: row.sourceEventIds,
    explanation:
      row.status === "culprit"
        ? `${row.name} is the only suspect whose motive, means, and opportunity remain complete.`
        : `${row.name} is excluded by ${row.exclusionEvidenceIds.map((id) => evidenceTitle(caseFromLog, id)).join(", ") || "the case source log"}.`,
    isCulprit: row.status === "culprit"
  }));
}

export function buildMisdirectionProfiles(caseFromLog: CaseFromLog, events: WorldEvent[] = []): MisdirectionProfile[] {
  return caseFromLog.generationProfile.focusSuspectIds.slice(0, 2).map((characterId) => {
    const character = caseFromLog.deductionCase.characters.find((item) => item.id === characterId);
    const row = deriveSuspectBoard(caseFromLog, events).find((item) => item.characterId === characterId);
    return {
      characterId,
      apparentMotive: character?.motive || "Public tension with the victim.",
      apparentMeans: character?.means || "Possible access to a suspicious place or tool.",
      apparentOpportunity: character?.opportunity || "The public timeline initially leaves room for suspicion.",
      refutedByEvidenceIds: row?.exclusionEvidenceIds || [],
      sourceEventIds: row?.sourceEventIds || []
    };
  });
}

export function buildDeductionGraph(caseFromLog: CaseFromLog, events: WorldEvent[] = []): DeductionGraph {
  const nodes: DeductionGraphNode[] = [];
  const edges: DeductionGraphEdge[] = [];
  const sourceByEvidence = new Map(events.filter((event) => event.evidenceId).map((event) => [event.evidenceId!, event]));

  for (const evidence of caseFromLog.deductionCase.evidence) {
    const source = sourceByEvidence.get(evidence.id);
    nodes.push({
      id: `evidence:${evidence.id}`,
      type: "evidence",
      label: evidence.title,
      detail: evidence.visibleDescription,
      characterIds: evidence.relatedCharacterIds,
      evidenceIds: [evidence.id],
      eventIds: source ? [source.id] : []
    });
    if (source) {
      nodes.push({
        id: `event:${source.id}`,
        type: "event",
        label: source.publicSummary,
        detail: `${source.time} / ${source.locationId}`,
        characterIds: source.relatedCharacterIds,
        evidenceIds: [evidence.id],
        eventIds: [source.id]
      });
      edges.push({ id: `source:${source.id}:${evidence.id}`, from: `event:${source.id}`, to: `evidence:${evidence.id}`, label: "creates clue" });
    }
  }

  for (const testimony of caseFromLog.testimonies || []) {
    if (!testimony.contradictionEvidenceIds.length) continue;
    const nodeId = `testimony:${testimony.characterId}`;
    nodes.push({
      id: nodeId,
      type: "testimony",
      label: `${characterName(caseFromLog, testimony.characterId)} testimony contradiction`,
      detail: testimony.currentStatement,
      characterIds: [testimony.characterId],
      evidenceIds: testimony.contradictionEvidenceIds,
      eventIds: testimony.memoryIds
    });
    for (const evidenceId of testimony.contradictionEvidenceIds) {
      edges.push({ id: `contradicts:${evidenceId}:${testimony.characterId}`, from: `evidence:${evidenceId}`, to: nodeId, label: "contradicts" });
    }
  }

  for (const step of buildSuspectEliminationSteps(caseFromLog, events)) {
    const nodeId = step.isCulprit ? "conclusion:culprit" : `elimination:${step.characterId}`;
    nodes.push({
      id: nodeId,
      type: step.isCulprit ? "conclusion" : "elimination",
      label: step.isCulprit ? `${step.suspectName} remains` : `${step.suspectName} eliminated`,
      detail: step.explanation,
      characterIds: [step.characterId],
      evidenceIds: step.eliminatedByEvidenceIds,
      eventIds: step.sourceEventIds
    });
    for (const evidenceId of step.eliminatedByEvidenceIds) {
      edges.push({ id: `eliminates:${evidenceId}:${step.characterId}`, from: `evidence:${evidenceId}`, to: nodeId, label: step.isCulprit ? "supports final chain" : "excludes suspect" });
    }
  }

  for (const evidenceId of caseFromLog.deductionCase.truth.decisiveEvidenceIds) {
    edges.push({ id: `decisive:${evidenceId}`, from: `evidence:${evidenceId}`, to: "conclusion:culprit", label: "supports culprit" });
  }

  const complete =
    caseFromLog.deductionCase.truth.decisiveEvidenceIds.every((id) => Boolean(eventByEvidence(events, id))) &&
    buildSuspectEliminationSteps(caseFromLog, events).every((step) => step.isCulprit || (step.eliminatedByEvidenceIds.length > 0 && step.sourceEventIds.length > 0));

  return { caseId: caseFromLog.id, nodes, edges, culpritConclusionNodeId: "conclusion:culprit", complete };
}

export function buildCaseLogicReport(world: WorldState, events: WorldEvent[], caseFromLog: CaseFromLog): CaseLogicReport {
  const graph = buildDeductionGraph(caseFromLog, events);
  const eliminationSteps = buildSuspectEliminationSteps(caseFromLog, events);
  const strongMisdirections = buildMisdirectionProfiles(caseFromLog, events);
  const allNonCulpritsExplainablyExcluded = eliminationSteps.every((step) => step.isCulprit || (step.eliminatedByEvidenceIds.length > 0 && step.sourceEventIds.length > 0));
  const misdirectionQuality = Math.min(100, strongMisdirections.filter((item) => item.refutedByEvidenceIds.length > 0).length * 50);
  const logicStrength = Math.min(
    100,
    Math.round(((caseFromLog.qualityReport.qualityScore || 0) + (graph.complete ? 100 : 0) + (allNonCulpritsExplainablyExcluded ? 100 : 0) + misdirectionQuality) / 4)
  );
  return {
    caseId: caseFromLog.id,
    summary: `${world.name} case leaves exactly one complete suspect: ${characterName(caseFromLog, caseFromLog.deductionCase.truth.culpritId)}.`,
    fairPlay: caseFromLog.qualityReport.worldBackedEvidence && caseFromLog.qualityReport.memoryScopedTestimony,
    uniqueCulprit: caseFromLog.qualityReport.uniqueCulprit,
    logicStrength,
    misdirectionQuality,
    deductionGraphComplete: graph.complete,
    allNonCulpritsExplainablyExcluded,
    strongMisdirections,
    eliminationSteps,
    warnings: [...caseFromLog.qualityReport.warnings]
  };
}

export function validateHardCaseLogic(world: WorldState, events: WorldEvent[], caseFromLog: CaseFromLog) {
  const report = buildCaseLogicReport(world, events, caseFromLog);
  const errors: string[] = [];
  if (world.mode === "showcase" && world.npcs.length !== 8) errors.push("Premium Showcase must contain exactly 8 NPCs.");
  if (!report.uniqueCulprit) errors.push("Premium Showcase must have one unique culprit.");
  if (report.strongMisdirections.length < 2) errors.push("Premium Showcase must include at least two strong red herring suspects.");
  if (!report.deductionGraphComplete) errors.push("Deduction graph must be complete.");
  if (!report.allNonCulpritsExplainablyExcluded) errors.push("Every non-culprit must be explainably excluded.");
  return { valid: errors.length === 0, errors, report };
}
