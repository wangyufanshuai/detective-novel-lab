import { NextResponse } from "next/server";
import { worldRepository } from "@/lib/world/repository";

export async function GET(_request: Request, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;
  const caseFromLog = worldRepository.getCase(caseId);
  if (!caseFromLog) return NextResponse.json({ ok: false, error: "Case not found" }, { status: 404 });
  return NextResponse.json({
    ok: true,
    case: caseFromLog,
    qualityReport: caseFromLog.qualityReport,
    candidateAnalysis: caseFromLog.qualityReport?.candidateAnalysis || []
  });
}
