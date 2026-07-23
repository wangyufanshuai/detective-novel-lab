import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { importTownMapPack, loadRuntimeWorld, previewTownMapPack } from "@/app/api/v1/_town-runtime";
import type { TownMapPack } from "@/lib/engine";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ worldId?: string; pack?: TownMapPack; previewOnly?: boolean; overwrite?: boolean }>(request, {});
    if (!body.worldId) return fail("BAD_REQUEST", "worldId is required");
    if (!body.pack) return fail("BAD_REQUEST", "pack is required");
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const preview = previewTownMapPack(body.pack);
    if (body.previewOnly || !preview.validation.ok) return ok({ preview });
    return ok(importTownMapPack(loaded.world, loaded.runtime, body.pack, Boolean(body.overwrite)));
  } catch (error) {
    if (error instanceof Error && error.name === "TOWN_MAP_PACK_INVALID") return fail("TOWN_MAP_PACK_INVALID", error.message);
    if (error instanceof Error && error.name === "TOWN_MAP_PACK_CONFLICT") return fail("TOWN_MAP_PACK_CONFLICT", error.message, 409);
    if (error instanceof Error && error.name === "TOWN_MAP_PACK_READ_ONLY") return fail("TOWN_MAP_PACK_READ_ONLY", error.message, 409);
    return errorResponse(error);
  }
}
