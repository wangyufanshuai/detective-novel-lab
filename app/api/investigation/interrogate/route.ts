import { NextResponse } from "next/server";
import { makeRuleBoundInterrogation, updateTestimonyWithContradiction } from "@/lib/engine";
import { generateGuardedNpcReplyWithAudit } from "@/lib/world/ai";
import { InvestigationAccessError, worldRepository } from "@/lib/world/repository";
import { getRuntimeFactionRelationshipSummary, isRuntimeInvestigationAuthority, recordRuntimeInvestigatorProgressionStep, recordRuntimePlayerResourceCommitmentStep } from "@/app/api/v1/_town-runtime";
import { idempotencyKey, replayIdempotent, rememberIdempotent } from "@/app/api/v1/_utils";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      characterId?: string;
      question?: string;
      evidenceId?: string;
      provider?: "deepseek" | "siliconflow" | "mock";
      actionId?: string;
      sessionRevision?: string;
      playerId?: string;
    };
    if (!body || typeof body.sessionId !== "string" || !body.sessionId.trim() || typeof body.characterId !== "string" || !body.characterId.trim() || typeof body.question !== "string" || !body.question.trim() || (body.evidenceId !== undefined && (typeof body.evidenceId !== "string" || !body.evidenceId.trim()))) {
      return NextResponse.json({ ok: false, code: "BAD_REQUEST", error: "sessionId, characterId, and question are required; evidenceId must be a nonempty string when supplied" }, { status: 400 });
    }
    const key = idempotencyKey(request, body);
    const fingerprint = JSON.stringify({ sessionId: body.sessionId, characterId: body.characterId, question: body.question, evidenceId: body.evidenceId });
    const replay = replayIdempotent(key, fingerprint);
    if (replay) return replay;
    const { session, world, activeCase } = worldRepository.getInterrogationContext(body.sessionId, body.characterId, body.evidenceId);
    if (body.playerId && body.playerId !== session.playerId) throw new InvestigationAccessError("Session belongs to another player", 403, "SESSION_FORBIDDEN");
    if (body.sessionRevision && body.sessionRevision !== session.updatedAt) throw new InvestigationAccessError("Session revision is stale", 409, "BAD_REQUEST");
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
    let testimonyUpdate = updateTestimonyWithContradiction(activeCase.testimonies || [], body.characterId, body.evidenceId);
    const authoritative = session.playerId !== "auto-player" && isRuntimeInvestigationAuthority(session.worldId, { sessionId: session.id, caseId: session.caseId });
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
    const next = worldRepository.appendInterrogation(session, entry, (currentCase) => {
      if (currentCase.createdAt !== activeCase.createdAt || currentCase.deductionCase.id !== activeCase.deductionCase.id) {
        throw new InvestigationAccessError("Case changed while the interrogation was pending", 409, "BAD_REQUEST");
      }
      testimonyUpdate = updateTestimonyWithContradiction(currentCase.testimonies || [], entry.characterId, entry.evidenceId);
      return testimonyUpdate.updated && authoritative ? { ...currentCase, testimonies: testimonyUpdate.testimonies } : undefined;
    });
    const commitmentLane = testimonyUpdate.contradictionHit.hit ? "challenge" : body.evidenceId ? undefined : "question";
    const investigatorProgression = !authoritative || !commitmentLane
      ? undefined
      : recordRuntimeInvestigatorProgressionStep(session.worldId, {
          sourceKey: `${session.id}:${session.caseId}:${commitmentLane}`,
          kind: commitmentLane
        });
    const playerResourceCommitment = commitmentLane && authoritative
      ? recordRuntimePlayerResourceCommitmentStep(session.worldId, {
          sessionId: session.id,
          caseId: session.caseId,
          lane: commitmentLane,
          caseSceneLocationId: activeCase.generationProfile.sceneLocationId || activeCase.deductionCase.scenes[0]?.id
        })
      : undefined;
    const factionRelationship = playerResourceCommitment ? getRuntimeFactionRelationshipSummary(session.worldId) : undefined;
    const payload = {
      ok: true,
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
      investigatorProgression,
      revision: next.updatedAt,
      replayed: false,
      verdictSource: aiResult.mock ? "rule" : "llm-fallback"
    } as const;
    rememberIdempotent(key, fingerprint, payload);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof InvestigationAccessError) {
      return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) return NextResponse.json({ ok: false, code: "BAD_REQUEST", error: "Invalid JSON body" }, { status: 400 });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
