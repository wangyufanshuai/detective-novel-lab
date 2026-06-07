import { NextResponse } from "next/server";
import { buildCaseQualityReport } from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";

export async function GET(_request: Request, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;
  const caseFromLog = worldRepository.getCase(caseId);
  if (!caseFromLog) return NextResponse.json({ ok: false, error: "Case not found" }, { status: 404 });
  const world = worldRepository.getWorld(caseFromLog.worldId);
  if (!world) return NextResponse.json({ ok: false, error: "World not found" }, { status: 404 });
  const events = worldRepository.getEvents(world.id);
  const qualityReport = buildCaseQualityReport(world, events, caseFromLog);
  caseFromLog.qualityReport = qualityReport;
  worldRepository.saveCase(caseFromLog);
  return NextResponse.json({ ok: true, qualityReport, candidateAnalysis: qualityReport.candidateAnalysis });
}
