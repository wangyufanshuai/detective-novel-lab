import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import { loadRuntimeWorld, getRuntimeCandidate } from "@/app/api/v1/_town-runtime";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const worldId = url.searchParams.get("worldId");
    const candidateId = url.searchParams.get("candidateId");
    if (!worldId) return fail("BAD_REQUEST", "worldId is required");
    const loaded = loadRuntimeWorld(worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const candidate = getRuntimeCandidate(loaded.runtime, candidateId);
    if (!candidate) return fail("BAD_REQUEST", "No case candidate is available", 404);
    const events = loaded.events.filter((event) => candidate.riskChainEventIds.includes(event.id));
    const memories = loaded.world.memories.filter((memory) => candidate.memoryIds.includes(memory.id));
    const agents = loaded.runtime.agentStates.filter((agent) => [candidate.culpritId, candidate.victimId].includes(agent.npcId));
    return ok({
      candidate,
      proof: {
        agents,
        events,
        memories,
        validation: candidate.validation,
        chain: [
          "NPC goals and relationship pressure create risk.",
          "Agent decisions write source WorldEvents.",
          "NPC memories are scoped to observed or involved events.",
          "Case candidate validation checks motive, means, opportunity, and memory support.",
          candidate.validation.valid ? "Candidate can be extracted into a playable fair-play case." : "Candidate is still blocked by validation gaps."
        ]
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
