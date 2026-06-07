import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
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
    return ok({ judgement, session: next });
  } catch (error) {
    return errorResponse(error);
  }
}
