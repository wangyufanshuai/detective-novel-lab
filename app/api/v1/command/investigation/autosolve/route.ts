import { autoSolvePlayableCase, spoilerSafeCaseAutoSolveReport } from "@/lib/engine";
import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { worldRepository } from "@/lib/world/repository";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ caseId?: string; persist?: boolean; includeDetails?: boolean }>(request, {});
    if (!body.caseId) return fail("BAD_REQUEST", "caseId is required");
    const caseFromLog = worldRepository.getCase(body.caseId);
    if (!caseFromLog) return fail("CASE_NOT_FOUND", "Case not found", 404);
    const events = worldRepository.getEvents(caseFromLog.worldId);
    const report = autoSolvePlayableCase(caseFromLog, events, {
      dryRun: !body.persist,
      sessionId: body.persist ? `auto-session:${caseFromLog.id}:${Date.now().toString(36)}` : undefined,
      playerId: "auto-player",
      displayName: "Auto Player"
    });
    const persisted = Boolean(body.persist && report.passed);
    if (persisted) worldRepository.saveSession(report.session);
    if (body.includeDetails) return ok({ report, sessionId: persisted ? report.session.id : undefined });
    return ok({ summary: spoilerSafeCaseAutoSolveReport(report), sessionId: persisted ? report.session.id : undefined });
  } catch (error) {
    return errorResponse(error);
  }
}
