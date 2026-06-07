import { NextRequest, NextResponse } from "next/server";
import { submitWorldTheory, type PlayerTheory } from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { sessionId?: string; theory?: PlayerTheory };
    if (!body.sessionId || !body.theory) return NextResponse.json({ ok: false, error: "sessionId and theory are required" }, { status: 400 });
    const session = worldRepository.getSession(body.sessionId);
    if (!session) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
    const activeCase = worldRepository.getCase(session.caseId);
    if (!activeCase) return NextResponse.json({ ok: false, error: "Case not found" }, { status: 404 });
    const judgement = submitWorldTheory(activeCase.deductionCase, body.theory, session.discoveredEvidenceIds);
    const next = {
      ...session,
      submittedTheory: body.theory,
      judgement,
      updatedAt: new Date().toISOString()
    };
    worldRepository.saveSession(next);
    return NextResponse.json({ ok: true, judgement, session: next });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
