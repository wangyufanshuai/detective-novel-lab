import { errorResponse, fail, playerOk, readJson, idempotencyKey, replayIdempotent, claimIdempotent, rememberIdempotent } from "@/app/api/v1/_utils";
import { loadRuntimeWorld, publicPlayerRuntime, publicPlayerWorld, publicTownQueue, runtimeRevision, stepRuntime } from "@/app/api/v1/_town-runtime";
import { worldRepository } from "@/lib/world/repository";
import { PLAYER_RUNTIME_SURFACE } from "@/app/api/v1/_surface";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ worldId?: string; steps?: number; actionId?: string; sessionRevision?: string; sessionId?: string; playerId?: string }>(request, {});
    if (!body.worldId) return fail("BAD_REQUEST", "worldId is required");
    if (body.steps !== undefined && (!Number.isInteger(body.steps) || body.steps < 0 || body.steps > 60)) return fail("BAD_REQUEST", "steps must be an integer between 0 and 60");
    const key = idempotencyKey(request, body);
    const scopedKey = key ? `town-runtime:start:${body.worldId}:${key}` : undefined;
    const { actionId: _actionId, sessionRevision: _sessionRevision, ...command } = body;
    const fingerprint = JSON.stringify(command);
    const replay = replayIdempotent(scopedKey, fingerprint);
    if (replay) return replay;
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    if (body.sessionId) {
      const session = worldRepository.getSession(body.sessionId);
      if (!session || session.worldId !== body.worldId) return fail("SESSION_NOT_FOUND", "Session does not belong to this world", 404);
      if (body.playerId && session.playerId !== body.playerId) return fail("SESSION_FORBIDDEN", "Session belongs to another player", 403);
    }
    const currentRevision = runtimeRevision(loaded.runtime);
    if (body.sessionRevision && body.sessionRevision !== currentRevision) return fail("RUNTIME_REVISION_CONFLICT", "Runtime revision is stale", 409);
    const claimed = claimIdempotent(scopedKey, fingerprint);
    if (claimed) return claimed;
    return worldRepository.runInTransaction(() => {
      const result = stepRuntime(loaded.world, loaded.events, body.steps || 1, "running");
      const payload = { surface: PLAYER_RUNTIME_SURFACE, runtime: publicPlayerRuntime(result.runtime), events: result.events.map((event) => ({ id: event.id, day: event.day, time: event.time, type: event.type, locationId: event.locationId, publicSummary: event.publicSummary })), queue: publicTownQueue(result.queue), world: publicPlayerWorld(result.world), revision: runtimeRevision(result.runtime), replayed: false };
      const response = playerOk(payload);
      rememberIdempotent(scopedKey, fingerprint, { ok: true, data: payload });
      return response;
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("RUNTIME_REVISION_CONFLICT:")) return fail("RUNTIME_REVISION_CONFLICT", error.message.replace("RUNTIME_REVISION_CONFLICT: ", ""), 409);
    return errorResponse(error);
  }
}
