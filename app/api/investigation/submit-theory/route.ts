import { NextRequest, NextResponse } from "next/server";
import { loadRuntimeWorld, recordRuntimeCampaignFailure, recordRuntimeInvestigatorProgressionStep, settleRuntimeWorldLeadOutcomeAndPrepareHandoff } from "@/app/api/v1/_town-runtime";
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
    let investigatorProgression = session.playerId === "auto-player"
      ? undefined
      : body.theory.evidenceIds?.length
        ? recordRuntimeInvestigatorProgressionStep(session.worldId, { sourceKey: `${session.id}:${session.caseId}:evidence-selection`, kind: "evidence-selection" })
        : undefined;
    if (judgement.accepted && session.playerId !== "auto-player") {
      investigatorProgression = recordRuntimeInvestigatorProgressionStep(session.worldId, { sourceKey: `${session.id}:${session.caseId}:accepted-theory`, kind: "accepted-theory" });
    }
    const campaignRecovery = !judgement.accepted && session.playerId !== "auto-player"
      ? recordRuntimeCampaignFailure(session.worldId, {
          sourceKey: `${session.id}:${session.caseId}:rejected-theory`,
          failureKind: "rejected-theory",
          sessionId: session.id,
          caseId: session.caseId
        })
      : undefined;
    const loaded = judgement.accepted && session.playerId !== "auto-player" ? loadRuntimeWorld(session.worldId) : null;
    const settlement = loaded ? settleRuntimeWorldLeadOutcomeAndPrepareHandoff(loaded.world, session.caseId) : undefined;
    return NextResponse.json({ ok: true, judgement, session: next, investigatorProgression, campaignRecovery, ...settlement });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
