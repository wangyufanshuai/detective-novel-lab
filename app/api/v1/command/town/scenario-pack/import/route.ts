import { errorResponse, fail, adminOk, adminGuard, readJson } from "@/app/api/v1/_utils";
import { importScenarioPack, loadRuntimeWorld, previewScenarioPack } from "@/app/api/v1/_town-runtime";
import type { ScenarioPack } from "@/lib/engine";

export async function POST(request: Request) {
  try {
    const unauthorized = adminGuard(request);
    if (unauthorized) return unauthorized;
    const body = await readJson<{ worldId?: string; pack?: ScenarioPack; previewOnly?: boolean; overwrite?: boolean }>(request, {});
    if (!body.worldId) return fail("BAD_REQUEST", "worldId is required");
    if (!body.pack) return fail("BAD_REQUEST", "pack is required");
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const preview = previewScenarioPack(body.pack);
    if (body.previewOnly || !preview.validation.ok) return adminOk({ preview });
    return adminOk(importScenarioPack(loaded.world, loaded.runtime, body.pack, Boolean(body.overwrite)));
  } catch (error) {
    if (error instanceof Error && error.name === "SCENARIO_PACK_INVALID") return fail("SCENARIO_PACK_INVALID", error.message);
    if (error instanceof Error && error.name === "SCENARIO_PRESET_CONFLICT") return fail("SCENARIO_PRESET_CONFLICT", error.message, 409);
    if (error instanceof Error && error.name === "SCENARIO_PRESET_READ_ONLY") return fail("SCENARIO_PRESET_READ_ONLY", error.message, 409);
    return errorResponse(error);
  }
}
