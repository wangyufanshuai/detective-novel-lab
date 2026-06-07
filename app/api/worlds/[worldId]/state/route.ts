import { NextResponse } from "next/server";
import { worldRepository } from "@/lib/world/repository";

export async function GET(_request: Request, context: { params: Promise<{ worldId: string }> }) {
  const { worldId } = await context.params;
  const world = worldRepository.getWorld(worldId);
  if (!world) return NextResponse.json({ ok: false, error: "World not found" }, { status: 404 });
  const activeCase = world.activeCaseId ? worldRepository.getCase(world.activeCaseId) : worldRepository.getActiveCase(worldId);
  const sessions = activeCase ? worldRepository.listSessions(worldId, activeCase.id) : [];
  return NextResponse.json({ ok: true, world, activeCase, sessions });
}
