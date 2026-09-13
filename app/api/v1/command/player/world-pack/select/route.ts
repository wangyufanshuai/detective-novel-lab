import { errorResponse, fail, playerOk, readJson } from "@/app/api/v1/_utils";
import { loadRuntimeWorld, selectCurrentExperiment } from "@/app/api/v1/_town-runtime";
import { findWorldPackageRegistryEntryById } from "@/app/api/v1/_world-package-registry";
import { isDetectiveCampaignRouteId, type DetectiveCampaignRouteId } from "@/lib/engine";

/** Player bootstrap selection runs before a player session exists. */
export async function POST(request: Request) {
  try {
    const body = await readJson<{ worldId?: string; packageId?: string; campaignRouteId?: DetectiveCampaignRouteId }>(request, {});
    if (!body.worldId) return fail("BAD_REQUEST", "worldId is required", 400);
    if (!body.packageId) return fail("BAD_REQUEST", "packageId is required", 400);
    if (!/^[a-z0-9._-]+$/i.test(body.packageId)) return fail("BAD_REQUEST", "Invalid packageId", 400);
    if (body.campaignRouteId !== undefined && !isDetectiveCampaignRouteId(body.campaignRouteId)) return fail("BAD_REQUEST", "Invalid Campaign route", 400);
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const entry = findWorldPackageRegistryEntryById(body.packageId);
    if (!entry || !entry.validationOk || !entry.scenarioPackId) return fail("PACKAGE_NOT_FOUND", "Valid WorldPackage not found", 404);
    return playerOk(selectCurrentExperiment(loaded.world, loaded.runtime, { scenarioPackId: entry.scenarioPackId, campaignRouteId: body.campaignRouteId }));
  } catch (error) {
    if (error instanceof Error && error.name === "EXPERIMENT_PACK_NOT_FOUND") return fail("EXPERIMENT_PACK_NOT_FOUND", error.message, 404);
    if (error instanceof Error && error.name === "CAMPAIGN_ROUTE_LOCKED") return fail("CAMPAIGN_ROUTE_LOCKED", error.message, 409);
    return errorResponse(error);
  }
}
