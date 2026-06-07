import { NextRequest, NextResponse } from "next/server";
import { makeRuleBoundInterrogation, updateTestimonyWithContradiction } from "@/lib/engine";
import { generateGuardedNpcReplyWithAudit } from "@/lib/world/ai";
import { worldRepository } from "@/lib/world/repository";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      characterId?: string;
      question?: string;
      evidenceId?: string;
      provider?: "deepseek" | "siliconflow" | "mock";
    };
    if (!body.sessionId || !body.characterId || !body.question) {
      return NextResponse.json({ ok: false, error: "sessionId, characterId, and question are required" }, { status: 400 });
    }
    const session = worldRepository.getSession(body.sessionId);
    if (!session) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
    const world = worldRepository.getWorld(session.worldId);
    const activeCase = worldRepository.getCase(session.caseId);
    if (!world || !activeCase) return NextResponse.json({ ok: false, error: "World or case not found" }, { status: 404 });
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
    return NextResponse.json({
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
      testimonyUpdated: testimonyUpdate.updated
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
