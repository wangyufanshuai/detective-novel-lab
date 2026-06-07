import { NextResponse } from "next/server";
import { worldRepository } from "@/lib/world/repository";

export async function GET(_request: Request, context: { params: Promise<{ worldId: string }> }) {
  const { worldId } = await context.params;
  const world = worldRepository.getWorld(worldId);
  if (!world) return NextResponse.json({ ok: false, error: "World not found" }, { status: 404 });
  return NextResponse.json({ ok: true, events: worldRepository.getEvents(worldId) });
}
