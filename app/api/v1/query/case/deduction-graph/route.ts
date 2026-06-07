import { errorResponse, ok } from "@/app/api/v1/_utils";
import { buildCaseLogicReport, buildDeductionGraph, deriveSuspectBoard } from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get("caseId");
    if (!caseId) throw new Error("caseId is required.");
    const caseFromLog = worldRepository.getCase(caseId);
    if (!caseFromLog) throw new Error("Case not found.");
    const world = worldRepository.getWorld(caseFromLog.worldId);
    if (!world) throw new Error("World not found.");
    const events = worldRepository.getEvents(world.id);
    return ok({
      graph: buildDeductionGraph(caseFromLog, events),
      suspectBoard: deriveSuspectBoard(caseFromLog, events),
      logicReport: buildCaseLogicReport(world, events, caseFromLog)
    });
  } catch (error) {
    return errorResponse(error);
  }
}
