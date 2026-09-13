import { NextResponse } from "next/server";
import { worldRepository } from "@/lib/world/repository";
import { playerCaseProjection } from "@/lib/world/player-projection";

export async function GET(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;
  const caseFromLog = worldRepository.getCase(caseId);
  if (!caseFromLog) return NextResponse.json({ ok: false, error: "Case not found" }, { status: 404 });
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  const session = sessionId ? worldRepository.getSession(sessionId) : null;
  if (session && (session.caseId !== caseId || session.worldId !== caseFromLog.worldId)) {
    return NextResponse.json({ ok: false, code: "BAD_REQUEST", error: "Session does not belong to this case" }, { status: 409 });
  }
  const publicCase = playerCaseProjection(caseFromLog, session);
  return NextResponse.json({
    ok: true,
    case: publicCase,
    caseFromLog: publicCase,
    session: publicCase.session
  });
}
