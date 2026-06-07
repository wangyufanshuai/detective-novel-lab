import { NextRequest, NextResponse } from "next/server";
import { simulateDailyLife } from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";

export async function POST(request: NextRequest, context: { params: Promise<{ worldId: string }> }) {
  try {
    const { worldId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { days?: number };
    const world = worldRepository.getWorld(worldId);
    if (!world) return NextResponse.json({ ok: false, error: "World not found" }, { status: 404 });
    const days = Math.max(1, Math.min(14, body.days || 1));
    const previousEvents = worldRepository.getEvents(worldId);
    const result = simulateDailyLife(world, days, previousEvents);
    worldRepository.saveWorld(result.world);
    worldRepository.addEvents(result.events);
    return NextResponse.json({ ok: true, world: result.world, events: result.events, reports: result.reports });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
