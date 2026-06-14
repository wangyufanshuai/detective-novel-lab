import { NextRequest, NextResponse } from "next/server";
import { createInitialWorld, createPremiumShowcaseWorld, extractCaseFromWorld, simulateDailyLife, simulateWorldTick, type CaseTemplateId, type MurderArchetype, type WorldMode } from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      seed?: string;
      caseArchetype?: MurderArchetype | "auto";
      mode?: WorldMode;
      npcCount?: number;
      timelineHours?: number;
      preSimDays?: number;
      caseMode?: "premium" | "generated";
      caseTemplateId?: CaseTemplateId;
    };
    const mode = body.mode || "showcase";
    if (mode === "showcase" && (body.caseMode || "generated") === "premium") {
      const premium = createPremiumShowcaseWorld(body.seed || "premium-showcase", body.caseTemplateId || "archive-blunt");
      const savedWorld = worldRepository.saveWorldBundle({ world: premium.world, events: premium.events, activeCase: premium.activeCase });
      return NextResponse.json({ ok: true, world: savedWorld, events: premium.events, activeCase: premium.activeCase, qualityReport: premium.activeCase.qualityReport, simulationReports: [] });
    }
    const generatedNpcCount = mode === "advanced" ? 30 : 20;
    const world = createInitialWorld(body.seed || "detective-town-showcase", {
      mode,
      npcCount: body.npcCount ?? generatedNpcCount,
      timelineHours: body.timelineHours || (mode === "advanced" ? 120 : 24),
      caseArchetype: body.caseArchetype === "auto" ? undefined : body.caseArchetype
    });
    const preSimDays = mode === "advanced" ? Math.max(3, Math.min(7, body.preSimDays || 5)) : 1;
    const daily = simulateDailyLife(world, preSimDays, []);
    const tick = simulateWorldTick(daily.world, daily.events);
    const events = [...daily.events, ...tick.events];
    const activeCase = extractCaseFromWorld(tick.world, events);
    tick.world.activeCaseId = activeCase.id;
    const savedWorld = worldRepository.saveWorldBundle({ world: tick.world, events, activeCase });

    return NextResponse.json({ ok: true, world: savedWorld, events, activeCase, qualityReport: activeCase.qualityReport, simulationReports: daily.reports });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
