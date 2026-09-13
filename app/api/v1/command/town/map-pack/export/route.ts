import { errorResponse, fail, adminOk, adminGuard, readJson } from "@/app/api/v1/_utils";
import { exportTownMapPack, loadRuntimeWorld } from "@/app/api/v1/_town-runtime";

export async function POST(request: Request) {
  try {
    const unauthorized = adminGuard(request);
    if (unauthorized) return unauthorized;
    const body = await readJson<{ worldId?: string; packId?: string }>(request, {});
    if (!body.worldId) return fail("BAD_REQUEST", "worldId is required");
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const pack = exportTownMapPack(loaded.world, loaded.runtime, { packId: body.packId });
    return adminOk({ pack, fileName: `${pack.manifest.id}.town-map-pack.json` });
  } catch (error) {
    return errorResponse(error);
  }
}
