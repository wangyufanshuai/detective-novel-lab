import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { makeRuleBoundInterrogation, updateTestimonyWithContradiction } from "@/lib/engine";
import { generateGuardedNpcReplyWithAudit } from "@/lib/world/ai";
import { worldRepository } from "@/lib/world/repository";
import { getRuntimeFactionRelationshipSummary, recordRuntimeInvestigatorProgressionStep, recordRuntimePlayerResourceCommitmentStep } from "@/app/api/v1/_town-runtime";

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
    const commitmentLane = testimonyUpdate.contradictionHit.hit ? "challenge" : body.evidenceId ? undefined : "question";
    const investigatorProgression = session.playerId === "auto-player" || !commitmentLane
      ? undefined
      : recordRuntimeInvestigatorProgressionStep(session.worldId, {
          sourceKey: `${session.id}:${session.caseId}:${commitmentLane}`,
          kind: commitmentLane
        });
    const playerResourceCommitment = commitmentLane
      ? recordRuntimePlayerResourceCommitmentStep(session.worldId, { sessionId: session.id, caseId: session.caseId, lane: commitmentLane })
      : undefined;
    const factionRelationship = playerResourceCommitment ? getRuntimeFactionRelationshipSummary(session.worldId) : undefined;
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
      testimonyUpdated: testimonyUpdate.updated,
      playerResourceCommitment,
      factionRelationship,
      investigatorProgression
    });
  } catch (error) {
    return errorResponse(error);
  }
}
