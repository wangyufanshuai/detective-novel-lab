import { adminGuard, adminOk, errorResponse, fail, readJson } from "@/app/api/v1/_utils";
import { resolveRuntimeAgentSourceRefs } from "@/app/api/v1/_agent-control";
import { loadAgentPackageExportReceipt, saveAgentPackageExportReceipt } from "@/app/api/v1/_agent-package-export";
import { loadRuntimeWorld, runtimeRevision } from "@/app/api/v1/_town-runtime";
import { findWorldPackageRegistryEntryById } from "@/app/api/v1/_world-package-registry";
import {
  AGENT_CONTROL_SCHEMA,
  buildTownAgentControlManifest,
  validateAgentControlMetadata
} from "@/lib/engine";

type AgentPackageExportBody = {
  worldId?: string;
  actionId?: string;
  expectedRevision?: string;
  reason?: string;
  sourceRefs?: string[];
  packageId?: string;
};

export async function POST(request: Request) {
  try {
    const unauthorized = adminGuard(request);
    if (unauthorized) return unauthorized;
    const body = await readJson<AgentPackageExportBody>(request, {});
    if (!body.worldId || !body.packageId) {
      return fail("BAD_REQUEST", "worldId, actionId, expectedRevision, reason, sourceRefs, and packageId are required");
    }
    const metadataErrors = validateAgentControlMetadata(body);
    if (metadataErrors.length) return fail("BAD_REQUEST", metadataErrors.join(" "));
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const currentRevision = runtimeRevision(loaded.runtime);
    const existingReceipt = loadAgentPackageExportReceipt(loaded.world.id, body.actionId!);
    if (existingReceipt) {
      const sameRequest = existingReceipt.worldId === loaded.world.id
        && existingReceipt.packageId === body.packageId
        && existingReceipt.expectedRevision === body.expectedRevision
        && existingReceipt.reason === body.reason
        && JSON.stringify(existingReceipt.sourceRefs.map((ref) => ref.ref)) === JSON.stringify(body.sourceRefs);
      if (!sameRequest) return fail("BAD_REQUEST", "actionId is already bound to a different package export payload", 409);
      return adminOk({
        schema: AGENT_CONTROL_SCHEMA,
        actionId: body.actionId,
        replayed: true,
        revision: currentRevision,
        receipt: existingReceipt,
        packageReceipt: existingReceipt.packageReceipt,
        report: existingReceipt.report,
        sourceRefs: existingReceipt.sourceRefs
      });
    }
    const registryEntry = findWorldPackageRegistryEntryById(body.packageId);
    if (!registryEntry) return fail("PACKAGE_NOT_FOUND", "WorldPackage not found", 404);
    if (!registryEntry.validationOk) return fail("WORLD_PACKAGE_INVALID", registryEntry.validationSummary.errors.join("; "), 400);
    if (loaded.runtime.currentExperiment?.worldPackageId !== body.packageId) {
      return fail("BAD_REQUEST", "packageId must match the WorldPackage selected by the current experiment");
    }
    const sourceResolution = resolveRuntimeAgentSourceRefs({
      world: loaded.world,
      runtime: loaded.runtime,
      events: loaded.events,
      sourceRefs: body.sourceRefs!
    });
    if (!sourceResolution.ok) return fail("BAD_REQUEST", `sourceRefs could not be resolved: ${sourceResolution.unresolved.join(", ")}`);
    if (!(body.sourceRefs || []).includes(`world:${loaded.world.id}`)) return fail("BAD_REQUEST", "sourceRefs must include the export world");
    if (!(body.sourceRefs || []).includes(`package:${body.packageId}`)) return fail("BAD_REQUEST", "sourceRefs must include the selected WorldPackage");
    if (body.expectedRevision !== currentRevision) {
      return fail("RUNTIME_REVISION_CONFLICT", "expectedRevision is stale; observe the world again before exporting", 409);
    }
    const { exportWorldPackage } = await import("@/lib/world-package-catalog");
    const report = exportWorldPackage({ packageId: body.packageId, format: "folder" });
    const stored = saveAgentPackageExportReceipt({
      schema: "agent-package-export-receipt.v1",
      worldId: loaded.world.id,
      actionId: body.actionId!,
      expectedRevision: body.expectedRevision!,
      reason: body.reason!,
      sourceRefs: sourceResolution.references,
      packageId: body.packageId,
      packageReceipt: registryEntry.worldPackageReceipt,
      report
    });
    return adminOk({
      schema: AGENT_CONTROL_SCHEMA,
      actionId: body.actionId,
      replayed: stored.replayed,
      revision: currentRevision,
      receipt: stored.receipt,
      packageReceipt: registryEntry.worldPackageReceipt,
      report,
      sourceRefs: sourceResolution.references,
      compatibility: buildTownAgentControlManifest(loaded.runtime).compatibility
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("RUNTIME_REVISION_CONFLICT:")) {
      return fail("RUNTIME_REVISION_CONFLICT", error.message.replace("RUNTIME_REVISION_CONFLICT: ", ""), 409);
    }
    if (error instanceof Error && error.message.startsWith("AGENT_PACKAGE_EXPORT_CONFLICT:")) {
      return fail("BAD_REQUEST", error.message.replace("AGENT_PACKAGE_EXPORT_CONFLICT: ", ""), 409);
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("was not found")) return fail("PACKAGE_NOT_FOUND", message, 404);
    if (message.includes("invalid")) return fail("WORLD_PACKAGE_INVALID", message, 400);
    return errorResponse(error);
  }
}
