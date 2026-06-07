import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { worldRepository } from "@/lib/world/repository";

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
    return ok({ session: next });
  } catch (error) {
    return errorResponse(error);
  }
}
