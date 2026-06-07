import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import type { PlayerSession } from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ worldId?: string; caseId?: string; playerId?: string; displayName?: string }>(request, {});
    if (!body.worldId) return fail("BAD_REQUEST", "worldId is required");
    const world = worldRepository.getWorld(body.worldId);
    if (!world) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const activeCase = body.caseId ? worldRepository.getCase(body.caseId) : worldRepository.getActiveCase(world.id);
    if (!activeCase) return fail("CASE_NOT_FOUND", "No active case found", 404);
    const now = new Date().toISOString();
    const playerId = body.playerId || `player-${Math.random().toString(36).slice(2, 8)}`;
    const session: PlayerSession = {
      id: `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      worldId: world.id,
      caseId: activeCase.id,
      playerId,
      displayName: body.displayName || `Investigator ${playerId.slice(-4)}`,
      discoveredEvidenceIds: [],
      interrogationLog: [],
      createdAt: now,
      updatedAt: now
    };
    worldRepository.saveSession(session);
    return ok({ session });
  } catch (error) {
    return errorResponse(error);
  }
}
