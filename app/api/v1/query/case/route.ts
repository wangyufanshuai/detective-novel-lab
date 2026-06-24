import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { buildPlayableCaseIntake } from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const caseId = url.searchParams.get("caseId");
    const includeIntake = url.searchParams.get("includeIntake") === "true";
    const sessionId = url.searchParams.get("sessionId");
    if (!caseId) return fail("BAD_REQUEST", "caseId is required");
    const caseFromLog = worldRepository.getCase(caseId);
    if (!caseFromLog) return fail("CASE_NOT_FOUND", "Case not found", 404);
    if (!includeIntake) return ok({ caseFromLog });
    const world = worldRepository.getWorld(caseFromLog.worldId);
    const events = worldRepository.getEvents(caseFromLog.worldId);
    const session = sessionId ? worldRepository.getSession(sessionId) : null;
    const playableIntake = buildPlayableCaseIntake(caseFromLog, events, world, session);
    return ok({ caseFromLog, playableIntake });
  } catch (error) {
    return errorResponse(error);
  }
}
