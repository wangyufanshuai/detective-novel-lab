import { NextRequest, NextResponse } from "next/server";
import { generateCaseRevealWithEval } from "@/lib/world/ai";
import { worldRepository } from "@/lib/world/repository";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { sessionId?: string; provider?: "deepseek" | "siliconflow" };
    if (!body.sessionId) return NextResponse.json({ ok: false, error: "sessionId is required" }, { status: 400 });
    const session = worldRepository.getSession(body.sessionId);
    if (!session) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
    if (!session.judgement?.accepted) return NextResponse.json({ ok: false, error: "Theory must be accepted before reveal" }, { status: 400 });
    const caseFromLog = worldRepository.getCase(session.caseId);
    if (!caseFromLog) return NextResponse.json({ ok: false, error: "Case not found" }, { status: 404 });
    const result = await generateCaseRevealWithEval({ provider: body.provider, caseFromLog, session });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
