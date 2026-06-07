import { NextResponse } from "next/server";
import { analyzeReachability, buildTravelConstraint } from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";

export async function GET(_request: Request, context: { params: Promise<{ worldId: string }> }) {
  const { worldId } = await context.params;
  const world = worldRepository.getWorld(worldId);
  if (!world) return NextResponse.json({ ok: false, error: "World not found" }, { status: 404 });
  const activeCase = world.activeCaseId ? worldRepository.getCase(world.activeCaseId) : worldRepository.getActiveCase(worldId);
  const events = worldRepository.getEvents(worldId);
  return NextResponse.json({
    ok: true,
    travelConstraint: buildTravelConstraint(world),
    reachability: activeCase ? analyzeReachability(world, events, activeCase) : []
  });
}
