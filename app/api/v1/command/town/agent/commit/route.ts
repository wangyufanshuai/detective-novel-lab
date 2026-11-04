import { errorResponse, fail, adminOk, adminGuard, readJson } from "@/app/api/v1/_utils";
import { resolveRuntimeAgentSourceRefs } from "@/app/api/v1/_agent-control";
import { loadAgentProposalReceipt, proposalReceiptMatches } from "@/app/api/v1/_agent-proposals";
import { applyRuntimeIntervention, loadRuntimeWorld, publicRuntime, publicWorld, runtimeRevision } from "@/app/api/v1/_town-runtime";
import { AGENT_CONTROL_SCHEMA, validateAgentControlMetadata, validateAgentIntervention, type TownRuntimeIntervention } from "@/lib/engine";

type CommitBody = {
  worldId?: string;
  actionId?: string;
  proposalId?: string;
  expectedRevision?: string;
  reason?: string;
  sourceRefs?: string[];
  intervention?: Omit<TownRuntimeIntervention, "id" | "tick" | "createdAt" | "branch" | "impact" | "actionId" | "reason" | "sourceRefs" | "decisionTraceId" | "decisionTraceDigest" | "decisionStatus">;
};

function stableActionPayload(body: CommitBody) {
  return JSON.stringify({
    reason: body.reason,
    sourceRefs: body.sourceRefs,
    intervention: body.intervention
  });
}

export async function POST(request: Request) {
  try {
    const unauthorized = adminGuard(request);
    if (unauthorized) return unauthorized;
    const body = await readJson<CommitBody>(request, {});
    if (!body.worldId || !body.intervention) {
      return fail("BAD_REQUEST", "worldId, actionId, expectedRevision, reason, sourceRefs, and intervention are required");
    }
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
    if (!sourceResolution.ok) return fail("BAD_REQUEST", `sourceRefs could not be resolved: ${sourceResolution.unresolved.join(", ")}`);
    if (body.proposalId) {
      const proposal = loadAgentProposalReceipt(body.proposalId);
      if (!proposal) return fail("PROPOSAL_NOT_FOUND", "proposalId does not identify a persisted proposal receipt", 404);
      if (!proposalReceiptMatches({
        receipt: proposal,
        worldId: body.worldId,
        actionId: body.actionId!,
        expectedRevision: body.expectedRevision!,
        reason: body.reason!,
        sourceRefs: body.sourceRefs!,
        intervention: body.intervention
      })) {
        return fail("PROPOSAL_MISMATCH", "proposalId does not match the commit payload", 409);
      }
    }
    const currentRevision = runtimeRevision(loaded.runtime);
    const existing = loaded.runtime.interventions.find((intervention) => intervention.actionId === body.actionId);
    if (existing) {
      const existingPayload = JSON.stringify({
        reason: existing.reason,
        sourceRefs: existing.sourceRefs,
        intervention: { actorId: existing.actorId, kind: existing.kind, value: existing.value }
      });
      if (existingPayload !== stableActionPayload(body)) {
        return fail("BAD_REQUEST", "actionId is already bound to a different intervention", 409);
      }
      return adminOk({
        schema: AGENT_CONTROL_SCHEMA,
        actionId: body.actionId,
        proposalId: body.proposalId,
        replayed: true,
        revision: currentRevision,
        runtime: publicRuntime(loaded.runtime),
        intervention: existing,
        world: publicWorld(loaded.world)
      });
    }
    if (body.expectedRevision !== currentRevision) {
      return fail("RUNTIME_REVISION_CONFLICT", "expectedRevision is stale; observe the world again before committing", 409);
    }
    const result = applyRuntimeIntervention(loaded.world, {
      ...body.intervention,
      actionId: body.actionId,
      reason: body.reason,
      sourceRefs: body.sourceRefs
    });
    return adminOk({
      schema: AGENT_CONTROL_SCHEMA,
      actionId: body.actionId,
      proposalId: body.proposalId,
      replayed: false,
      revision: runtimeRevision(result.runtime),
      runtime: publicRuntime(result.runtime),
      intervention: result.intervention,
      world: publicWorld(result.world)
    });
  } catch (error) {
    return errorResponse(error);
  }
}
