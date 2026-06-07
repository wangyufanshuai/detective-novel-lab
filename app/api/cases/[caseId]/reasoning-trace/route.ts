import { NextResponse } from "next/server";
import { buildReasoningTrace } from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";

export async function GET(_request: Request, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;
  const caseFromLog = worldRepository.getCase(caseId);
  if (!caseFromLog) return NextResponse.json({ ok: false, error: "Case not found" }, { status: 404 });
  const events = worldRepository.getEvents(caseFromLog.worldId);
  const reasoningTrace = buildReasoningTrace(caseFromLog.deductionCase, events);
  return NextResponse.json({ ok: true, reasoningTrace });
}
