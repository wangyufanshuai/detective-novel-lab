import { NextRequest, NextResponse } from "next/server";
import { extractCaseFromWorld } from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { worldId?: string };
    if (!body.worldId) return NextResponse.json({ ok: false, error: "worldId is required" }, { status: 400 });
    const world = worldRepository.getWorld(body.worldId);
    if (!world) return NextResponse.json({ ok: false, error: "World not found" }, { status: 404 });
    const caseFromLog = extractCaseFromWorld(world, worldRepository.getEvents(world.id));
    world.activeCaseId = caseFromLog.id;
    worldRepository.saveWorld(world);
    worldRepository.saveCase(caseFromLog);
    return NextResponse.json({ ok: true, case: caseFromLog, generationProfile: caseFromLog.generationProfile });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
