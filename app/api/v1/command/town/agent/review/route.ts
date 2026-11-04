import { adminGuard, adminOk, errorResponse, fail, readJson } from "@/app/api/v1/_utils";
import { resolveRuntimeAgentSourceRefs } from "@/app/api/v1/_agent-control";
import { loadAgentCaseReviewReceipt, saveAgentCaseReviewReceipt } from "@/app/api/v1/_agent-review";
import { loadRuntimeWorld, runtimeRevision } from "@/app/api/v1/_town-runtime";
import { worldRepository } from "@/lib/world/repository";
import {
  AGENT_CONTROL_SCHEMA,
  buildInvestigationRoomProjection,
  buildPlayableCaseIntake,
  buildTownAgentControlManifest,
  validateAgentControlMetadata
} from "@/lib/engine";

type AgentReviewBody = {
  worldId?: string;
  actionId?: string;
  expectedRevision?: string;
  reason?: string;
  sourceRefs?: string[];
  caseId?: string;
};

export async function POST(request: Request) {
  try {
    const unauthorized = adminGuard(request);
    if (unauthorized) return unauthorized;
    const body = await readJson<AgentReviewBody>(request, {});
    if (!body.worldId || !body.caseId) {
      return fail("BAD_REQUEST", "worldId, actionId, expectedRevision, reason, sourceRefs, and caseId are required");
    }
    const metadataErrors = validateAgentControlMetadata(body);
    if (metadataErrors.length) return fail("BAD_REQUEST", metadataErrors.join(" "));
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const caseFromLog = worldRepository.getCase(body.caseId);
    if (!caseFromLog) return fail("CASE_NOT_FOUND", "Case not found", 404);
    if (caseFromLog.worldId !== loaded.world.id) return fail("BAD_REQUEST", "caseId does not belong to worldId", 409);
    const currentRevision = runtimeRevision(loaded.runtime);
    const existingReceipt = loadAgentCaseReviewReceipt(loaded.world.id, body.actionId!);
    if (existingReceipt) {
      const sameRequest = existingReceipt.worldId === loaded.world.id
        && existingReceipt.caseId === caseFromLog.id
        && existingReceipt.expectedRevision === body.expectedRevision
        && existingReceipt.reason === body.reason
        && JSON.stringify(existingReceipt.sourceRefs.map((ref) => ref.ref)) === JSON.stringify(body.sourceRefs);
      if (!sameRequest) return fail("BAD_REQUEST", "actionId is already bound to a different review payload", 409);
      return adminOk({
        schema: AGENT_CONTROL_SCHEMA,
        actionId: body.actionId,
        replayed: true,
        revision: currentRevision,
        receipt: existingReceipt,
        review: existingReceipt.review,
        case: caseFromLog,
        sourceRefs: existingReceipt.sourceRefs
      });
    }
    const sourceResolution = resolveRuntimeAgentSourceRefs({
      world: loaded.world,
      runtime: loaded.runtime,
      events: loaded.events,
      sourceRefs: body.sourceRefs!
    });
    if (!sourceResolution.ok) return fail("BAD_REQUEST", `sourceRefs could not be resolved: ${sourceResolution.unresolved.join(", ")}`);
    if (!(body.sourceRefs || []).includes(`case:${caseFromLog.id}`)) return fail("BAD_REQUEST", "sourceRefs must include the reviewed case");
    if (caseFromLog.triggeredEventId && !(body.sourceRefs || []).includes(`event:${caseFromLog.triggeredEventId}`)) {
      return fail("BAD_REQUEST", "sourceRefs must include the reviewed case triggered event");
    }
    if (body.expectedRevision !== currentRevision) {
      return fail("RUNTIME_REVISION_CONFLICT", "expectedRevision is stale; observe the world again before reviewing", 409);
    }

    const intake = buildPlayableCaseIntake(caseFromLog, loaded.events, loaded.world);
    const roomProjection = buildInvestigationRoomProjection(caseFromLog, loaded.events, { mode: "review" });
    const routeIntegrity = intake.routeIntegrity;
    if (!routeIntegrity) throw new Error("Case review did not produce route integrity");
    const review = {
      routeIntegrity,
      roomProjection,
      sourceCounts: {
        events: intake.sourceCounts.events,
        memories: intake.sourceCounts.memories,
        observations: intake.sourceCounts.observations,
        evidence: intake.sourceCounts.totalEvidence
      },
      routeCertificate: {
        routeCertified: Boolean(intake.routeCertificate?.routeCertified),
        stepCount: intake.routeCertificate?.steps.length || 0,
        blockerCount: intake.routeCertificate?.blockers.length || 0
      },
      proofCoverage: {
        complete: Boolean(intake.proofCoverage?.complete),
        coverageRatio: intake.proofCoverage?.coverageRatio || 0,
        coveredObligationCount: intake.proofCoverage?.coveredObligationIds.length || 0,
        totalObligationCount: intake.proofCoverage?.caseId ? intake.proofCoverage.totalRequired : 0
      }
    };
    const stored = saveAgentCaseReviewReceipt({
      schema: "agent-case-review-receipt.v1",
      worldId: loaded.world.id,
      actionId: body.actionId!,
      expectedRevision: body.expectedRevision!,
      reason: body.reason!,
      sourceRefs: sourceResolution.references,
      caseId: caseFromLog.id,
      compatibility: buildTownAgentControlManifest(loaded.runtime).compatibility,
      review
    });
    return adminOk({
      schema: AGENT_CONTROL_SCHEMA,
      actionId: body.actionId,
      replayed: stored.replayed,
      revision: currentRevision,
      receipt: stored.receipt,
      review,
      case: caseFromLog,
      sourceRefs: sourceResolution.references
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("RUNTIME_REVISION_CONFLICT:")) {
      return fail("RUNTIME_REVISION_CONFLICT", error.message.replace("RUNTIME_REVISION_CONFLICT: ", ""), 409);
    }
    if (error instanceof Error && error.message.startsWith("AGENT_CASE_REVIEW_CONFLICT:")) {
      return fail("BAD_REQUEST", error.message.replace("AGENT_CASE_REVIEW_CONFLICT: ", ""), 409);
    }
    return errorResponse(error);
  }
}
