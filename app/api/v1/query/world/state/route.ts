import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { worldRepository } from "@/lib/world/repository";

export async function GET(request: Request) {
  try {
    const worldId = new URL(request.url).searchParams.get("worldId");
    if (!worldId) return fail("BAD_REQUEST", "worldId is required");
    const world = worldRepository.getWorld(worldId);
    if (!world) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const activeCase = world.activeCaseId ? worldRepository.getCase(world.activeCaseId) : worldRepository.getActiveCase(world.id);
    const sessions = activeCase ? worldRepository.listSessions(world.id, activeCase.id) : [];
    return ok({ world, activeCase, sessions });
  } catch (error) {
    return errorResponse(error);
  }
}
