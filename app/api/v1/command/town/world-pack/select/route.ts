import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { loadRuntimeWorld, selectCurrentExperiment } from "@/app/api/v1/_town-runtime";
import { findWorldPackageRegistryEntryById } from "@/app/api/v1/_world-package-registry";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ worldId?: string; packageId?: string }>(request, {});
    if (!body.worldId) return fail("BAD_REQUEST", "worldId is required", 400);
    if (!body.packageId) return fail("BAD_REQUEST", "packageId is required", 400);
    if (!/^[a-z0-9._-]+$/i.test(body.packageId)) return fail("BAD_REQUEST", "Invalid packageId", 400);
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const entry = findWorldPackageRegistryEntryById(body.packageId);
    if (!entry || !entry.validationOk || !entry.scenarioPackId) return fail("PACKAGE_NOT_FOUND", "Valid WorldPackage not found", 404);
    return ok(selectCurrentExperiment(loaded.world, loaded.runtime, { scenarioPackId: entry.scenarioPackId }));
  } catch (error) {
    if (error instanceof Error && error.name === "EXPERIMENT_PACK_NOT_FOUND") return fail("EXPERIMENT_PACK_NOT_FOUND", error.message, 404);
    return errorResponse(error);
  }
}
