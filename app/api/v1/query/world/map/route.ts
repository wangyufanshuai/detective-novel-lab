import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { buildWorldMapSnapshot } from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const worldId = params.get("worldId");
    const caseId = params.get("caseId");
    const sessionId = params.get("sessionId");
    const day = params.get("day") ? Number(params.get("day")) : undefined;
    const time = params.get("time") || undefined;

    if (!worldId) return fail("BAD_REQUEST", "worldId is required");
    const world = worldRepository.getWorld(worldId);
    if (!world) return fail("WORLD_NOT_FOUND", "World not found", 404);

    const activeCase = caseId ? worldRepository.getCase(caseId) : world.activeCaseId ? worldRepository.getCase(world.activeCaseId) : worldRepository.getActiveCase(world.id);
    if (caseId && !activeCase) return fail("CASE_NOT_FOUND", "Case not found", 404);
    const session = sessionId ? worldRepository.getSession(sessionId) : null;
    if (sessionId && !session) return fail("SESSION_NOT_FOUND", "Session not found", 404);

    const events = worldRepository.getEvents(world.id);
    const snapshot = buildWorldMapSnapshot(world, events, activeCase || undefined, session, { day, time });
    return ok({ snapshot });
  } catch (error) {
    return errorResponse(error);
  }
}
