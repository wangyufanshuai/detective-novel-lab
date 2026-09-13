import { errorResponse, fail, playerOk, readJson } from "@/app/api/v1/_utils";
import { extractCase, getRuntimeCandidate, loadRuntimeWorld, publicPlayerCase, publicPlayerWorld, publicTownQueue } from "@/app/api/v1/_town-runtime";
import { buildPlayableCaseIntake, buildTownEmergenceQueue } from "@/lib/engine";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ worldId?: string; candidateId?: string }>(request, {});
    if (!body.worldId) return fail("BAD_REQUEST", "worldId is required");
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const fallbackQueue = buildTownEmergenceQueue(loaded.world, loaded.events, loaded.runtime);
    const candidate =
      getRuntimeCandidate(loaded.runtime, body.candidateId) ||
      fallbackQueue.candidates.find((item) => body.candidateId && item.id === body.candidateId) ||
      fallbackQueue.candidates[0] ||
      null;
    if (!candidate) return fail("BAD_REQUEST", "No case candidate is available", 404);
    const candidates = [candidate, ...fallbackQueue.candidates, ...loaded.runtime.candidates]
      .filter((item, index, items) => items.findIndex((candidateItem) => candidateItem.id === item.id) === index)
      .sort((left, right) => {
        const leftScore = (left.validation.valid ? 1000 : 0) + (left.triggeredEventId ? 500 : 0) + (left.maturityScore || 0) + left.riskChainEventIds.length;
        const rightScore = (right.validation.valid ? 1000 : 0) + (right.triggeredEventId ? 500 : 0) + (right.maturityScore || 0) + right.riskChainEventIds.length;
        if (left.id === candidate.id) return -1;
        if (right.id === candidate.id) return 1;
        return rightScore - leftScore;
      });
    let result: ReturnType<typeof extractCase> | null = null;
    let lastCaseError: Error | null = null;
    for (const item of candidates) {
      try {
        result = extractCase(loaded.world, loaded.events, item);
        break;
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("CASE_NOT_PLAYABLE:")) {
          lastCaseError = error;
          continue;
        }
        throw error;
      }
    }
    if (!result) throw lastCaseError || new Error("CASE_NOT_PLAYABLE: No case candidate passed route integrity.");
    const playableIntake = buildPlayableCaseIntake(result.activeCase, result.events, result.world);
    return playerOk({
      world: publicPlayerWorld(result.world),
      events: result.events.map((event) => ({ id: event.id, day: event.day, time: event.time, type: event.type, locationId: event.locationId, publicSummary: event.publicSummary })),
      activeCase: publicPlayerCase(result.activeCase),
      candidate: publicTownQueue({ ...result.queue, candidates: [result.candidate] }).candidates[0],
      queue: publicTownQueue(result.queue),
      playableIntake,
      playerResourceCommitment: result.playerResourceCommitment,
      worldLeadCaseHandoff: result.worldLeadCaseHandoff,
      worldPressureCascade: result.worldPressureCascade,
      worldArc: result.worldArc,
      investigatorHeadquarters: result.investigatorHeadquarters,
      arcConvergence: result.arcConvergence,
      campaignSession: result.campaignSession,
      campaignFinaleDebrief: result.campaignFinaleDebrief,
      worldInfluenceBudget: result.worldInfluenceBudget
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("INVESTIGATOR_HEADQUARTERS_REQUIRED:")) {
      return fail("INVESTIGATOR_HEADQUARTERS_REQUIRED", error.message.replace("INVESTIGATOR_HEADQUARTERS_REQUIRED: ", ""), 409);
    }
    if (error instanceof Error && error.message.startsWith("CASE_NOT_PLAYABLE:")) {
      return fail("CASE_NOT_PLAYABLE", error.message.replace("CASE_NOT_PLAYABLE: ", ""), 422);
    }
    return errorResponse(error);
  }
}
