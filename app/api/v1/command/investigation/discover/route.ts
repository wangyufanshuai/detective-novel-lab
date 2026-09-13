import { errorResponse, fail, playerOk, readJson, idempotencyKey, replayIdempotent, claimIdempotent, rememberIdempotent } from "@/app/api/v1/_utils";
import { worldRepository } from "@/lib/world/repository";
import { getRuntimeFactionRelationshipSummary, isRuntimeInvestigationAuthority, recordRuntimeInvestigatorProgressionStep, recordRuntimePlayerResourceCommitmentStep } from "@/app/api/v1/_town-runtime";
import { PLAYER_RUNTIME_SURFACE } from "@/app/api/v1/_surface";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ sessionId?: string; evidenceId?: string; actionId?: string; sessionRevision?: string; playerId?: string }>(request, {});
    if (!body.sessionId || !body.evidenceId) return fail("BAD_REQUEST", "sessionId and evidenceId are required");
    const evidenceId = body.evidenceId;
    const key = idempotencyKey(request, body);
    const fingerprint = JSON.stringify({ sessionId: body.sessionId, evidenceId });
    const replay = replayIdempotent(key, fingerprint);
    if (replay) return replay;
    const session = worldRepository.getSession(body.sessionId);
    if (!session) return fail("SESSION_NOT_FOUND", "Session not found", 404);
    if (body.playerId && body.playerId !== session.playerId) return fail("SESSION_FORBIDDEN", "Session belongs to another player", 403);
    if (body.sessionRevision && body.sessionRevision !== session.updatedAt) return fail("BAD_REQUEST", "Session revision is stale", 409);
    const activeCase = worldRepository.getCase(session.caseId);
    if (!activeCase) return fail("CASE_NOT_FOUND", "Case not found", 404);
    if (activeCase.worldId !== session.worldId || !worldRepository.getWorld(session.worldId)) return fail("BAD_REQUEST", "Session world and case do not match", 409);
    const exists = activeCase.deductionCase.evidence.some((item) => item.id === evidenceId && item.discoverable);
    if (!exists) return fail("EVIDENCE_NOT_FOUND", "Evidence not discoverable", 400);
    const claimed = claimIdempotent(key, fingerprint);
    if (claimed) return claimed;
    return worldRepository.runInTransaction(() => {
      const next = {
        ...session,
        discoveredEvidenceIds: Array.from(new Set([...session.discoveredEvidenceIds, evidenceId])),
        updatedAt: new Date().toISOString()
      };
      worldRepository.saveSession(next);
      const authoritative = session.playerId !== "auto-player" && isRuntimeInvestigationAuthority(session.worldId, { sessionId: session.id, caseId: session.caseId });
      const investigatorProgression = !authoritative
        ? undefined
        : recordRuntimeInvestigatorProgressionStep(session.worldId, { sourceKey: `${session.id}:${session.caseId}:search`, kind: "search" });
      const playerResourceCommitment = !authoritative ? undefined : recordRuntimePlayerResourceCommitmentStep(session.worldId, {
        sessionId: session.id,
        caseId: session.caseId,
        lane: "search",
        caseSceneLocationId: activeCase.generationProfile.sceneLocationId || activeCase.deductionCase.scenes[0]?.id
      });
      const factionRelationship = playerResourceCommitment ? getRuntimeFactionRelationshipSummary(session.worldId) : undefined;
      const payload = { surface: PLAYER_RUNTIME_SURFACE, session: next, playerResourceCommitment, factionRelationship, investigatorProgression, revision: next.updatedAt, replayed: false, verdictSource: "rule" as const };
      const response = playerOk(payload);
      rememberIdempotent(key, fingerprint, { ok: true, data: payload });
      return response;
    });
  } catch (error) {
    return errorResponse(error);
  }
}
