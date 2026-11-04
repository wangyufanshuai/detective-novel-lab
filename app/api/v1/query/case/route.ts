import { adminGuard, adminOk, errorResponse, fail, playerOk } from "@/app/api/v1/_utils";
import { buildPlayableCaseIntake } from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";
import { playerCaseProjection } from "@/lib/world/player-projection";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const caseId = url.searchParams.get("caseId");
    const includeIntake = url.searchParams.get("includeIntake") === "true";
    const sessionId = url.searchParams.get("sessionId");
    const mode = url.searchParams.get("mode") || "player";
    if (!caseId) return fail("BAD_REQUEST", "caseId is required");
    if (mode !== "player" && mode !== "review") return fail("BAD_REQUEST", "mode must be player or review");
    if (mode === "review") {
      const unauthorized = adminGuard(request);
      if (unauthorized) return unauthorized;
    }
    const caseFromLog = worldRepository.getCase(caseId);
    if (!caseFromLog) return fail("CASE_NOT_FOUND", "Case not found", 404);
    const session = sessionId ? worldRepository.getSession(sessionId) : null;
    if (mode === "review") {
      const world = worldRepository.getWorld(caseFromLog.worldId);
      const events = worldRepository.getEvents(caseFromLog.worldId);
      return adminOk({
        caseFromLog,
        ...(includeIntake ? { playableIntake: buildPlayableCaseIntake(caseFromLog, events, world, session) } : {})
      });
    }
    // Player queries receive a spoiler-safe projection by default. The full
    // case object is only available through the explicit, guarded review mode.
    if (!includeIntake) {
      const publicCase = playerCaseProjection(caseFromLog, session);
      return playerOk({ publicCase, caseFromLog: publicCase });
    }
    const world = worldRepository.getWorld(caseFromLog.worldId);
    const events = worldRepository.getEvents(caseFromLog.worldId);
    const playableIntake = buildPlayableCaseIntake(caseFromLog, events, world, session);
    const publicCase = playerCaseProjection(caseFromLog, session);
    return playerOk({ publicCase, caseFromLog: publicCase, playableIntake });
  } catch (error) {
    return errorResponse(error);
  }
}
