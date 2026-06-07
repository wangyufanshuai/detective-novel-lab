import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { worldRepository } from "@/lib/world/repository";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const worldId = params.get("worldId");
    const npcId = params.get("npcId");
    if (!worldId) return fail("BAD_REQUEST", "worldId is required");
    const world = worldRepository.getWorld(worldId);
    if (!world) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const memories = npcId ? world.memories.filter((memory) => memory.npcId === npcId) : world.memories;
    return ok({ memories, reports: world.simulationReports || [] });
  } catch (error) {
    return errorResponse(error);
  }
}
