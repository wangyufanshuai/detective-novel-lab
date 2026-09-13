import { errorResponse, ok } from "@/app/api/v1/_utils";
import { buildCaseLogicReport, buildDeductionGraph, deriveSuspectBoard } from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get("caseId");
    const sessionId = searchParams.get("sessionId");
    if (!caseId) throw new Error("caseId is required.");
    const caseFromLog = worldRepository.getCase(caseId);
    if (!caseFromLog) throw new Error("Case not found.");
    const world = worldRepository.getWorld(caseFromLog.worldId);
    if (!world) throw new Error("World not found.");
    const session = sessionId ? worldRepository.getSession(sessionId) : null;
    if (session && (session.caseId !== caseId || session.worldId !== caseFromLog.worldId)) throw new Error("Session does not belong to this case");
    // Evidence IDs are reused between extracted cases in the same world. Only
    // this case's recorded source events may back its graph and exclusions.
    const sourceIds = new Set([...(caseFromLog.sourceEventIds || []), ...(caseFromLog.sourceMap?.sourceEventIds || [])]);
    const events = worldRepository.getEvents(world.id).filter((event) => sourceIds.has(event.id));
    const solved = Boolean(session?.judgement?.accepted);
    const board = deriveSuspectBoard(caseFromLog, events).map((row) => solved ? row : ({
      ...row,
      motive: false,
      means: false,
      opportunity: false,
      exclusionEvidenceIds: row.exclusionEvidenceIds.filter((id) => session?.discoveredEvidenceIds.includes(id)),
      sourceEventIds: [],
      status: "eliminated" as const,
      surfaceSuspicion: "嫌疑状态将在证据链完成后揭示。"
    }));
    const graph = buildDeductionGraph(caseFromLog, events);
    return ok({ graph: solved ? graph : { ...graph, culpritConclusionNodeId: "", complete: false }, suspectBoard: board, logicReport: solved ? buildCaseLogicReport(world, events, caseFromLog) : { caseId, summary: "推理图将在结案后揭示。", fairPlay: true, uniqueCulprit: false, logicStrength: 0, misdirectionQuality: 0, deductionGraphComplete: false, allNonCulpritsExplainablyExcluded: false, strongMisdirections: [], eliminationSteps: [], warnings: [] }});
  } catch (error) {
    return errorResponse(error);
  }
}
