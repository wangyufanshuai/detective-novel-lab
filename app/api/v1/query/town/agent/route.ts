import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { buildAgentDecisionTrace, scoreNpcActionCandidates } from "@/lib/engine";
import { loadRuntimeWorld } from "@/app/api/v1/_town-runtime";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const worldId = url.searchParams.get("worldId");
    const npcId = url.searchParams.get("npcId");
    if (!worldId || !npcId) return fail("BAD_REQUEST", "worldId and npcId are required");
    const loaded = loadRuntimeWorld(worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const npc = loaded.world.npcs.find((item) => item.id === npcId);
    if (!npc) return fail("BAD_REQUEST", "NPC not found", 404);
    const agent = loaded.runtime.agentStates.find((item) => item.npcId === npcId);
    const candidates = scoreNpcActionCandidates(loaded.world, npc, loaded.events, loaded.runtime);
    const trace = agent?.lastDecisionId ? buildAgentDecisionTrace(loaded.runtime, agent.lastDecisionId) : null;
    return ok({ agent, candidates, trace });
  } catch (error) {
    return errorResponse(error);
  }
}
