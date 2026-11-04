import { adminGuard, adminOk, errorResponse, fail, readJson } from "@/app/api/v1/_utils";
import { resolveRuntimeAgentSourceRefs } from "@/app/api/v1/_agent-control";
import { saveAgentProposalReceipt } from "@/app/api/v1/_agent-proposals";
import { loadRuntimeWorld, runtimeRevision } from "@/app/api/v1/_town-runtime";
import {
  AGENT_CONTROL_SCHEMA,
  buildTownAgentControlManifest,
  validateAgentControlMetadata,
  validateAgentIntervention,
  type TownRuntimeIntervention
} from "@/lib/engine";

type ProposeBody = {
  worldId?: string;
  actionId?: string;
  expectedRevision?: string;
  reason?: string;
  sourceRefs?: string[];
  intervention?: Omit<TownRuntimeIntervention, "id" | "tick" | "createdAt" | "branch" | "impact" | "actionId" | "reason" | "sourceRefs" | "decisionTraceId" | "decisionTraceDigest" | "decisionStatus">;
};

/** Validate an intervention without mutating the authoritative town. */
export async function POST(request: Request) {
  try {
    const unauthorized = adminGuard(request);
    if (unauthorized) return unauthorized;
    const body = await readJson<ProposeBody>(request, {});
    if (!body.worldId || !body.intervention) return fail("BAD_REQUEST", "worldId, actionId, expectedRevision, reason, sourceRefs, and intervention are required");
    const metadataErrors = validateAgentControlMetadata(body);
    if (metadataErrors.length) return fail("BAD_REQUEST", metadataErrors.join(" "));
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const interventionErrors = validateAgentIntervention(body.intervention, loaded.world.npcs.map((npc) => npc.id));
    if (interventionErrors.length) return fail("BAD_REQUEST", interventionErrors.join(" "));
    const sourceResolution = resolveRuntimeAgentSourceRefs({
      world: loaded.world,
      runtime: loaded.runtime,
      events: loaded.events,
      sourceRefs: body.sourceRefs!
    });
    if (!sourceResolution.ok) {
      return fail("BAD_REQUEST", `sourceRefs could not be resolved: ${sourceResolution.unresolved.join(", ")}`);
    }
    const currentRevision = runtimeRevision(loaded.runtime);
    if (body.expectedRevision !== currentRevision) {
      return fail("RUNTIME_REVISION_CONFLICT", "expectedRevision is stale; observe the world again before proposing", 409);
    }
    const stored = saveAgentProposalReceipt({
      worldId: loaded.world.id,
      actionId: body.actionId!,
      expectedRevision: body.expectedRevision!,
      reason: body.reason!,
      sourceRefs: sourceResolution.references,
      intervention: body.intervention,
      world: {
        id: loaded.world.id,
        tick: loaded.runtime.tick,
        status: loaded.runtime.status,
        revision: currentRevision
      },
      compatibility: buildTownAgentControlManifest(loaded.runtime).compatibility
    });
    return adminOk({
      schema: AGENT_CONTROL_SCHEMA,
      proposal: stored.receipt,
      proposalId: stored.receipt.proposalId,
      receiptHash: stored.receipt.receiptHash,
      replayed: stored.replayed,
      revision: currentRevision,
      world: stored.receipt.world
    });
  } catch (error) {
    return errorResponse(error);
  }
}
