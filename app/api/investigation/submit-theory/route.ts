import { NextRequest, NextResponse } from "next/server";
import { isRuntimeInvestigationAuthority, loadRuntimeWorld, recordRuntimeCampaignFailure, recordRuntimeInvestigatorProgressionStep, settleRuntimeWorldLeadOutcomeAndPrepareHandoff } from "@/app/api/v1/_town-runtime";
import { isPlayerTheoryInput, spoilerSafeCaseProofCoverage, submitWorldTheory, type PlayerTheory } from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";
import { idempotencyKey, replayIdempotent, rememberIdempotent } from "@/app/api/v1/_utils";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { sessionId?: string; theory?: PlayerTheory; actionId?: string; sessionRevision?: string; playerId?: string };
    if (!body || typeof body.sessionId !== "string" || !body.sessionId.trim() || !isPlayerTheoryInput(body.theory)) return NextResponse.json({ ok: false, error: "A sessionId and a valid theory with evidence assignments are required" }, { status: 400 });
    if ((body.theory.motive?.length || 0) > 4000 || (body.theory.method?.length || 0) > 4000 || body.theory.evidenceIds.length > 100) return NextResponse.json({ ok: false, code: "BAD_REQUEST", error: "Theory fields exceed the allowed limits" }, { status: 400 });
    const session = worldRepository.getSession(body.sessionId);
    if (!session) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
    if (body.playerId && body.playerId !== session.playerId) return NextResponse.json({ ok: false, code: "SESSION_FORBIDDEN", error: "Session belongs to another player" }, { status: 403 });
    const key = idempotencyKey(request, body);
    const fingerprint = JSON.stringify({ sessionId: body.sessionId, theory: body.theory });
    const replay = replayIdempotent(key, fingerprint);
    if (replay) return replay;
    if (body.sessionRevision && body.sessionRevision !== session.updatedAt) return NextResponse.json({ ok: false, code: "BAD_REQUEST", error: "Session revision is stale" }, { status: 409 });
    const activeCase = worldRepository.getCase(session.caseId);
    if (!activeCase) return NextResponse.json({ ok: false, error: "Case not found" }, { status: 404 });
    if (activeCase.worldId !== session.worldId || !worldRepository.getWorld(session.worldId)) return NextResponse.json({ ok: false, code: "BAD_REQUEST", error: "Session world and case do not match" }, { status: 409 });
    const judgement = submitWorldTheory(activeCase.deductionCase, body.theory, session.discoveredEvidenceIds);
    if (judgement.proofCoverage) judgement.proofCoverage = spoilerSafeCaseProofCoverage(judgement.proofCoverage, judgement.accepted);
    const next = {
      ...session,
      submittedTheory: body.theory,
      judgement,
      updatedAt: new Date().toISOString()
    };
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
    const payload = { ok: true, judgement, session: next, investigatorProgression, campaignRecovery, ...settlement, revision: next.updatedAt, replayed: false, verdictSource: "rule" as const };
    rememberIdempotent(key, fingerprint, payload);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
