import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { worldRepository } from "@/lib/world/repository";
import { getRuntimeFactionRelationshipSummary, isRuntimeInvestigationAuthority, recordRuntimeInvestigatorProgressionStep, recordRuntimePlayerResourceCommitmentStep } from "@/app/api/v1/_town-runtime";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ sessionId?: string; evidenceId?: string }>(request, {});
    if (!body.sessionId || !body.evidenceId) return fail("BAD_REQUEST", "sessionId and evidenceId are required");
    const session = worldRepository.getSession(body.sessionId);
    if (!session) return fail("SESSION_NOT_FOUND", "Session not found", 404);
    const activeCase = worldRepository.getCase(session.caseId);
    if (!activeCase) return fail("CASE_NOT_FOUND", "Case not found", 404);
    const exists = activeCase.deductionCase.evidence.some((item) => item.id === body.evidenceId && item.discoverable);
    if (!exists) return fail("EVIDENCE_NOT_FOUND", "Evidence not discoverable", 400);
    const next = {
      ...session,
      discoveredEvidenceIds: Array.from(new Set([...session.discoveredEvidenceIds, body.evidenceId])),
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
    return ok({ session: next, playerResourceCommitment, factionRelationship, investigatorProgression });
  } catch (error) {
    return errorResponse(error);
  }
}
