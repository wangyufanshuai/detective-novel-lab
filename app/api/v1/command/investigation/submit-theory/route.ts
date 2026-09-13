import { errorResponse, fail, playerOk, readJson, idempotencyKey, replayIdempotent, claimIdempotent, rememberIdempotent } from "@/app/api/v1/_utils";
import { isRuntimeInvestigationAuthority, loadRuntimeWorld, recordRuntimeCampaignFailure, recordRuntimeInvestigatorProgressionStep, settleRuntimeWorldLeadOutcomeAndPrepareHandoff } from "@/app/api/v1/_town-runtime";
import { isPlayerTheoryInput, spoilerSafeCaseProofCoverage, submitWorldTheory, type PlayerTheory } from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";
import { PLAYER_RUNTIME_SURFACE } from "@/app/api/v1/_surface";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ sessionId?: string; theory?: PlayerTheory; actionId?: string; sessionRevision?: string; playerId?: string }>(request, {});
    if (!body || typeof body.sessionId !== "string" || !body.sessionId.trim() || !isPlayerTheoryInput(body.theory)) return fail("BAD_REQUEST", "A sessionId and a valid theory with evidence assignments are required");
    const theory = body.theory;
    if ((theory.motive?.length || 0) > 4000 || (theory.method?.length || 0) > 4000 || theory.evidenceIds.length > 100) return fail("BAD_REQUEST", "Theory fields exceed the allowed limits");
    const session = worldRepository.getSession(body.sessionId);
    if (!session) return fail("SESSION_NOT_FOUND", "Session not found", 404);
    if (body.playerId && body.playerId !== session.playerId) return fail("SESSION_FORBIDDEN", "Session belongs to another player", 403);
    const key = idempotencyKey(request, body);
    const fingerprint = JSON.stringify({ sessionId: body.sessionId, theory });
    const replay = replayIdempotent(key, fingerprint);
    if (replay) return replay;
    if (body.sessionRevision && body.sessionRevision !== session.updatedAt) return fail("BAD_REQUEST", "Session revision is stale", 409);
    const activeCase = worldRepository.getCase(session.caseId);
    if (!activeCase) return fail("CASE_NOT_FOUND", "Case not found", 404);
    if (activeCase.worldId !== session.worldId || !worldRepository.getWorld(session.worldId)) return fail("BAD_REQUEST", "Session world and case do not match", 409);
    const judgement = submitWorldTheory(activeCase.deductionCase, theory, session.discoveredEvidenceIds);
    if (judgement.proofCoverage) judgement.proofCoverage = spoilerSafeCaseProofCoverage(judgement.proofCoverage, judgement.accepted);
    const claimed = claimIdempotent(key, fingerprint);
    if (claimed) return claimed;
    return worldRepository.runInTransaction(() => {
      const next = { ...session, submittedTheory: theory, judgement, updatedAt: new Date().toISOString() };
      worldRepository.saveSession(next);
      const authoritative = session.playerId !== "auto-player" && isRuntimeInvestigationAuthority(session.worldId, { sessionId: session.id, caseId: session.caseId });
      let investigatorProgression = !authoritative
        ? undefined
          : theory.evidenceIds?.length
          ? recordRuntimeInvestigatorProgressionStep(session.worldId, { sourceKey: `${session.id}:${session.caseId}:evidence-selection`, kind: "evidence-selection" })
          : undefined;
      if (judgement.accepted && authoritative) {
        investigatorProgression = recordRuntimeInvestigatorProgressionStep(session.worldId, { sourceKey: `${session.id}:${session.caseId}:accepted-theory`, kind: "accepted-theory" });
      }
      const campaignRecovery = !judgement.accepted && authoritative
        ? recordRuntimeCampaignFailure(session.worldId, {
            sourceKey: `${session.id}:${session.caseId}:rejected-theory`,
            failureKind: "rejected-theory",
            sessionId: session.id,
            caseId: session.caseId
          })
        : undefined;
      const loaded = judgement.accepted && authoritative ? loadRuntimeWorld(session.worldId) : null;
      const settlement = loaded ? settleRuntimeWorldLeadOutcomeAndPrepareHandoff(loaded.world, session.caseId, session.id) : undefined;
      const payload = { surface: PLAYER_RUNTIME_SURFACE, judgement, session: next, investigatorProgression, campaignRecovery, ...settlement, revision: next.updatedAt, replayed: false, verdictSource: "rule" as const };
      const response = playerOk(payload);
      rememberIdempotent(key, fingerprint, { ok: true, data: payload });
      return response;
    });
  } catch (error) {
    return errorResponse(error);
  }
}
