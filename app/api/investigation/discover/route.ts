import { NextRequest, NextResponse } from "next/server";
import { worldRepository } from "@/lib/world/repository";
import { getRuntimeFactionRelationshipSummary, isRuntimeInvestigationAuthority, recordRuntimeInvestigatorProgressionStep, recordRuntimePlayerResourceCommitmentStep } from "@/app/api/v1/_town-runtime";
import { idempotencyKey, replayIdempotent, rememberIdempotent } from "@/app/api/v1/_utils";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { sessionId?: string; evidenceId?: string; actionId?: string; sessionRevision?: string; playerId?: string };
    if (!body.sessionId || !body.evidenceId) return NextResponse.json({ ok: false, error: "sessionId and evidenceId are required" }, { status: 400 });
    const key = idempotencyKey(request, body);
    const fingerprint = JSON.stringify({ sessionId: body.sessionId, evidenceId: body.evidenceId });
    const replay = replayIdempotent(key, fingerprint);
    if (replay) return replay;
    const session = worldRepository.getSession(body.sessionId);
    if (!session) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
    if (body.playerId && body.playerId !== session.playerId) return NextResponse.json({ ok: false, code: "SESSION_FORBIDDEN", error: "Session belongs to another player" }, { status: 403 });
    if (body.sessionRevision && body.sessionRevision !== session.updatedAt) return NextResponse.json({ ok: false, code: "BAD_REQUEST", error: "Session revision is stale" }, { status: 409 });
    const activeCase = worldRepository.getCase(session.caseId);
    if (!activeCase) return NextResponse.json({ ok: false, error: "Case not found" }, { status: 404 });
    if (activeCase.worldId !== session.worldId || !worldRepository.getWorld(session.worldId)) return NextResponse.json({ ok: false, code: "BAD_REQUEST", error: "Session world and case do not match" }, { status: 409 });
    const exists = activeCase.deductionCase.evidence.some((item) => item.id === body.evidenceId && item.discoverable);
    if (!exists) return NextResponse.json({ ok: false, error: "Evidence not discoverable" }, { status: 400 });
    const next = {
      ...session,
      discoveredEvidenceIds: Array.from(new Set([...session.discoveredEvidenceIds, body.evidenceId])),
      updatedAt: new Date().toISOString()
    };
    worldRepository.saveSession(next);
    const authoritative = session.playerId !== "auto-player" && isRuntimeInvestigationAuthority(session.worldId, { sessionId: session.id, caseId: session.caseId });
    const investigatorProgression = !authoritative
      ? undefined
      : recordRuntimeInvestigatorProgressionStep(session.worldId, { sourceKey: `${session.id}:${session.caseId}:search`, kind: "search" });
    const playerResourceCommitment = !authoritative ? undefined : recordRuntimePlayerResourceCommitmentStep(session.worldId, {
      sessionId: session.id,
      caseId: session.caseId,
      lane: "search",
      caseSceneLocationId: activeCase.generationProfile.sceneLocationId || activeCase.deductionCase.scenes[0]?.id
    });
    const factionRelationship = playerResourceCommitment ? getRuntimeFactionRelationshipSummary(session.worldId) : undefined;
    const payload = { ok: true, session: next, playerResourceCommitment, factionRelationship, investigatorProgression, revision: next.updatedAt, replayed: false, verdictSource: "rule" as const };
    rememberIdempotent(key, fingerprint, payload);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
