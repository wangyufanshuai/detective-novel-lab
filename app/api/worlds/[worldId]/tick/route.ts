import { NextResponse } from "next/server";
import { extractCaseFromWorld, simulateWorldTick } from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";

export async function POST(_request: Request, context: { params: Promise<{ worldId: string }> }) {
  try {
    const { worldId } = await context.params;
    const world = worldRepository.getWorld(worldId);
    if (!world) return NextResponse.json({ ok: false, error: "World not found" }, { status: 404 });
    const previousEvents = worldRepository.getEvents(worldId);
    const tick = simulateWorldTick(world, previousEvents);
    worldRepository.saveWorld(tick.world);
    worldRepository.addEvents(tick.events);
    const events = worldRepository.getEvents(worldId);
    const activeCase = worldRepository.getActiveCase(worldId) || extractCaseFromWorld(tick.world, events);
    if (!tick.world.activeCaseId) {
      tick.world.activeCaseId = activeCase.id;
    }
    worldRepository.saveWorldBundle({ world: tick.world, activeCase });
    return NextResponse.json({ ok: true, world: tick.world, events: tick.events, activeCase });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
