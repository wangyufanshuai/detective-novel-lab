import { adminGuard, adminOk, errorResponse, fail, playerOk } from "@/app/api/v1/_utils";
import { buildInvestigationRoomProjection } from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";

/**
 * Returns the deterministic room projection for a case. Player mode is safe by
 * default; review mode is an operator surface because it contains source ids.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const caseId = url.searchParams.get("caseId");
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
    if (sessionId && !session) return fail("SESSION_NOT_FOUND", "Session not found", 404);
    if (session && (session.caseId !== caseId || session.worldId !== caseFromLog.worldId)) {
      return fail("SESSION_FORBIDDEN", "Session does not belong to this case", 403);
    }
    const events = worldRepository.getEvents(caseFromLog.worldId);
    const projection = buildInvestigationRoomProjection(caseFromLog, events, { mode, session });
    return mode === "review" ? adminOk({ projection }) : playerOk({ projection });
  } catch (error) {
    return errorResponse(error);
  }
}
