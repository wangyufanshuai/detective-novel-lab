import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { isRuntimeInvestigationAuthority, loadRuntimeWorld, recordRuntimeCampaignFailure, recordRuntimeInvestigatorProgressionStep, settleRuntimeWorldLeadOutcomeAndPrepareHandoff } from "@/app/api/v1/_town-runtime";
import { submitWorldTheory, type PlayerTheory } from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ sessionId?: string; theory?: PlayerTheory }>(request, {});
    if (!body.sessionId || !body.theory) return fail("BAD_REQUEST", "sessionId and theory are required");
    const session = worldRepository.getSession(body.sessionId);
    if (!session) return fail("SESSION_NOT_FOUND", "Session not found", 404);
    const activeCase = worldRepository.getCase(session.caseId);
    if (!activeCase) return fail("CASE_NOT_FOUND", "Case not found", 404);
    const judgement = submitWorldTheory(activeCase.deductionCase, body.theory, session.discoveredEvidenceIds);
    const next = { ...session, submittedTheory: body.theory, judgement, updatedAt: new Date().toISOString() };
    worldRepository.saveSession(next);
    const authoritative = session.playerId !== "auto-player" && isRuntimeInvestigationAuthority(session.worldId, { sessionId: session.id, caseId: session.caseId });
    let investigatorProgression = !authoritative
      ? undefined
      : body.theory.evidenceIds?.length
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
    return ok({ judgement, session: next, investigatorProgression, campaignRecovery, ...settlement });
  } catch (error) {
    return errorResponse(error);
  }
}
