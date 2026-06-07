import { NextRequest, NextResponse } from "next/server";
import type { PlayerSession } from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { worldId?: string; caseId?: string; playerId?: string; displayName?: string };
    if (!body.worldId) return NextResponse.json({ ok: false, error: "worldId is required" }, { status: 400 });
    const world = worldRepository.getWorld(body.worldId);
    if (!world) return NextResponse.json({ ok: false, error: "World not found" }, { status: 404 });
    const activeCase = body.caseId ? worldRepository.getCase(body.caseId) : worldRepository.getActiveCase(world.id);
    if (!activeCase) return NextResponse.json({ ok: false, error: "No active case found" }, { status: 404 });
    const now = new Date().toISOString();
    const playerId = body.playerId || `player-${Math.random().toString(36).slice(2, 8)}`;
    const session: PlayerSession = {
      id: `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      worldId: world.id,
      caseId: activeCase.id,
      playerId,
      displayName: body.displayName || `调查员 ${playerId.slice(-4)}`,
      discoveredEvidenceIds: [],
      interrogationLog: [],
      createdAt: now,
      updatedAt: now
    };
    worldRepository.saveSession(session);
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
