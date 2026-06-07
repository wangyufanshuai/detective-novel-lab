import { NextRequest, NextResponse } from "next/server";
import { createInitialWorld, extractCaseFromWorld, simulateDailyLife, simulateWorldTick, type MurderArchetype, type WorldMode } from "@/lib/engine";
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
    };
    const mode = body.mode || "showcase";
    const world = createInitialWorld(body.seed || "detective-town-showcase", {
      mode,
      npcCount: body.npcCount || (mode === "advanced" ? 30 : 8),
      timelineHours: body.timelineHours || (mode === "advanced" ? 120 : 24),
      caseArchetype: body.caseArchetype === "auto" ? undefined : body.caseArchetype
    });
    const preSimDays = mode === "advanced" ? Math.max(3, Math.min(7, body.preSimDays || 5)) : 1;
    const daily = simulateDailyLife(world, preSimDays, []);
    const tick = simulateWorldTick(daily.world, daily.events);
    const savedWorld = worldRepository.saveWorld(tick.world);
    worldRepository.addEvents([...daily.events, ...tick.events]);
    const events = worldRepository.getEvents(savedWorld.id);
    const activeCase = extractCaseFromWorld(savedWorld, events);
    savedWorld.activeCaseId = activeCase.id;
    worldRepository.saveWorld(savedWorld);
    worldRepository.saveCase(activeCase);

    return NextResponse.json({ ok: true, world: savedWorld, events, activeCase, qualityReport: activeCase.qualityReport, simulationReports: daily.reports });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
