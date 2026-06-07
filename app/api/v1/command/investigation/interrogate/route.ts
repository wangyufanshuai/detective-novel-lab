import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { makeRuleBoundInterrogation, updateTestimonyWithContradiction } from "@/lib/engine";
import { generateGuardedNpcReplyWithAudit } from "@/lib/world/ai";
import { worldRepository } from "@/lib/world/repository";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ sessionId?: string; characterId?: string; question?: string; evidenceId?: string; provider?: "deepseek" | "siliconflow" | "mock" }>(request, {});
    if (!body.sessionId || !body.characterId || !body.question) return fail("BAD_REQUEST", "sessionId, characterId, and question are required");
    const session = worldRepository.getSession(body.sessionId);
    if (!session) return fail("SESSION_NOT_FOUND", "Session not found", 404);
    const world = worldRepository.getWorld(session.worldId);
    const activeCase = worldRepository.getCase(session.caseId);
    if (!world) return fail("WORLD_NOT_FOUND", "World not found", 404);
    if (!activeCase) return fail("CASE_NOT_FOUND", "Case not found", 404);
    const events = worldRepository.getEvents(world.id);
    const aiResult = await generateGuardedNpcReplyWithAudit({
      provider: body.provider,
      world,
      events,
      caseFromLog: activeCase,
      deductionCase: activeCase.deductionCase,
      characterId: body.characterId,
      question: body.question,
      discoveredEvidenceIds: session.discoveredEvidenceIds,
      evidenceId: body.evidenceId
    });
    const testimonyUpdate = updateTestimonyWithContradiction(activeCase.testimonies || [], body.characterId, body.evidenceId);
    if (testimonyUpdate.updated) {
      activeCase.testimonies = testimonyUpdate.testimonies;
      worldRepository.saveCase(activeCase);
    }
    const entry = makeRuleBoundInterrogation(
      world,
      events,
      activeCase.deductionCase,
      session.id,
      body.characterId,
      body.question,
      session.discoveredEvidenceIds,
      body.evidenceId,
      aiResult.content
    );
    const next = worldRepository.appendInterrogation(session, entry);
    return ok({
      entry,
      session: next,
      mock: aiResult.mock,
      promptAudit: aiResult.promptAudit,
      dialogueEval: aiResult.dialogueEval,
      safetyFlags: aiResult.safetyFlags,
      memoryCount: aiResult.memoryCount,
      evidenceCount: aiResult.evidenceCount,
      contradictionHit: testimonyUpdate.contradictionHit,
      testimonyUpdated: testimonyUpdate.updated
    });
  } catch (error) {
    return errorResponse(error);
  }
}
