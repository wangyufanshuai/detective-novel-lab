import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { buildPlayableCaseIntake } from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";
import { playerCaseProjection } from "@/lib/world/player-projection";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const caseId = url.searchParams.get("caseId");
    const includeIntake = url.searchParams.get("includeIntake") === "true";
    const sessionId = url.searchParams.get("sessionId");
    if (!caseId) return fail("BAD_REQUEST", "caseId is required");
    const caseFromLog = worldRepository.getCase(caseId);
    if (!caseFromLog) return fail("CASE_NOT_FOUND", "Case not found", 404);
    const session = sessionId ? worldRepository.getSession(sessionId) : null;
    // Player queries receive a spoiler-safe projection by default. The full
    // case object remains available only to internal/admin callers that omit
    // the player-facing include flag.
    if (!includeIntake) {
      const publicCase = playerCaseProjection(caseFromLog, session);
      return ok({ publicCase, caseFromLog: publicCase });
    }
    const world = worldRepository.getWorld(caseFromLog.worldId);
    const events = worldRepository.getEvents(caseFromLog.worldId);
    const playableIntake = buildPlayableCaseIntake(caseFromLog, events, world, session);
    const publicCase = playerCaseProjection(caseFromLog, session);
    return ok({ publicCase, caseFromLog: publicCase, playableIntake });
  } catch (error) {
    return errorResponse(error);
  }
}
