import { adminGuard, adminOk, errorResponse, fail, readJson } from "@/app/api/v1/_utils";
import { resolveRuntimeAgentSourceRefs } from "@/app/api/v1/_agent-control";
import {
  extractCase,
  getRuntimeCandidate,
  loadRuntimeWorld,
  publicRuntime,
  publicWorld,
  runtimeRevision
} from "@/app/api/v1/_town-runtime";
import { worldRepository } from "@/lib/world/repository";
import {
  AGENT_CONTROL_SCHEMA,
  buildPlayableCaseIntake,
  validateAgentControlMetadata,
  type AgentCaseExtractionReceipt,
  type CaseCandidate
} from "@/lib/engine";

type AgentCaseExtractBody = {
  worldId?: string;
  actionId?: string;
  expectedRevision?: string;
  reason?: string;
  sourceRefs?: string[];
  candidateId?: string;
};

function receiptPayload(receipt: AgentCaseExtractionReceipt) {
  return {
    schema: receipt.schema,
    actionId: receipt.actionId,
    candidateId: receipt.candidateId,
    reason: receipt.reason,
    sourceRefs: receipt.sourceRefs,
    caseId: receipt.caseId,
    triggeredEventId: receipt.triggeredEventId,
    triggerKind: receipt.triggerKind,
    createdAtTick: receipt.createdAtTick
  };
}

function sameReceiptPayload(receipt: AgentCaseExtractionReceipt, body: AgentCaseExtractBody) {
  return receipt.actionId === body.actionId
    && receipt.candidateId === body.candidateId
    && receipt.reason === body.reason
    && JSON.stringify(receipt.sourceRefs) === JSON.stringify(body.sourceRefs);
}

function candidateForAgent(runtime: Parameters<typeof getRuntimeCandidate>[0], candidateId: string) {
  return runtime.candidates.find((candidate) => candidate.id === candidateId) || null;
}

function candidateSummary(candidate: CaseCandidate) {
  return {
    ...candidate,
    validation: candidate.validation,
    sourceEventId: candidate.triggeredEventId
  };
}

export async function POST(request: Request) {
  try {
    const unauthorized = adminGuard(request);
    if (unauthorized) return unauthorized;
    const body = await readJson<AgentCaseExtractBody>(request, {});
    if (!body.worldId || !body.candidateId) {
      return fail("BAD_REQUEST", "worldId, actionId, expectedRevision, reason, sourceRefs, and candidateId are required");
    }
    const metadataErrors = validateAgentControlMetadata(body);
    if (metadataErrors.length) return fail("BAD_REQUEST", metadataErrors.join(" "));
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const sourceResolution = resolveRuntimeAgentSourceRefs({
      world: loaded.world,
      runtime: loaded.runtime,
      events: loaded.events,
      sourceRefs: body.sourceRefs!
    });
    if (!sourceResolution.ok) return fail("BAD_REQUEST", `sourceRefs could not be resolved: ${sourceResolution.unresolved.join(", ")}`);

    const existingReceipt = (loaded.runtime.agentCaseExtractionReceipts || []).find((receipt) => receipt.actionId === body.actionId);
    if (existingReceipt) {
      if (!sameReceiptPayload(existingReceipt, body)) {
        return fail("BAD_REQUEST", "actionId is already bound to a different case extraction", 409);
      }
      const activeCase = worldRepository.getCase(existingReceipt.caseId);
      if (!activeCase || activeCase.worldId !== loaded.world.id) {
        return fail("BAD_REQUEST", `case extraction receipt is not replayable: ${existingReceipt.caseId}`, 409);
      }
      const candidate = candidateForAgent(loaded.runtime, existingReceipt.candidateId);
      return adminOk({
        schema: AGENT_CONTROL_SCHEMA,
        actionId: body.actionId,
        replayed: true,
        revision: runtimeRevision(loaded.runtime),
        receipt: existingReceipt,
        sourceRefs: sourceResolution.references,
        candidate: candidate ? candidateSummary(candidate) : { id: existingReceipt.candidateId },
        activeCase,
        playableIntake: buildPlayableCaseIntake(activeCase, loaded.events, loaded.world),
        runtime: publicRuntime(loaded.runtime),
        world: publicWorld(loaded.world)
      });
    }

    const candidate = candidateForAgent(loaded.runtime, body.candidateId);
    if (!candidate) return fail("BAD_REQUEST", "candidateId must resolve in the persisted runtime candidate ledger");
    if (!candidate.validation.valid) return fail("CASE_NOT_PLAYABLE", "candidateId is not currently a valid case candidate", 422);
    if (!candidate.triggeredEventId) return fail("BAD_REQUEST", "candidateId must be backed by a triggered source event");
    if (!(body.sourceRefs || []).includes(`candidate:${candidate.id}`)) {
      return fail("BAD_REQUEST", "sourceRefs must include the selected candidate");
    }
    if (!(body.sourceRefs || []).includes(`event:${candidate.triggeredEventId}`)) {
      return fail("BAD_REQUEST", "sourceRefs must include the candidate triggered event");
    }
    const currentRevision = runtimeRevision(loaded.runtime);
    if (body.expectedRevision !== currentRevision) {
      return fail("RUNTIME_REVISION_CONFLICT", "expectedRevision is stale; observe the world again before extracting a case", 409);
    }
    const result = extractCase(loaded.world, loaded.events, candidate, {
      agent: {
        actionId: body.actionId!,
        reason: body.reason!,
        sourceRefs: body.sourceRefs!
      }
    });
    const runtime = result.world.persistentRuntime;
    if (!runtime) throw new Error("Agent case extraction did not return a persistent runtime");
    const receipt = runtime.agentCaseExtractionReceipts?.find((item) => item.actionId === body.actionId);
    if (!receipt) throw new Error("Agent case extraction did not persist an action receipt");
    return adminOk({
      schema: AGENT_CONTROL_SCHEMA,
      actionId: body.actionId,
      replayed: false,
      revision: runtimeRevision(runtime),
      receipt,
      sourceRefs: sourceResolution.references,
      candidate: candidateSummary(result.candidate),
      activeCase: result.activeCase,
      playableIntake: buildPlayableCaseIntake(result.activeCase, result.events, result.world),
      runtime: publicRuntime(runtime),
      world: publicWorld(result.world)
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("INVESTIGATOR_HEADQUARTERS_REQUIRED:")) {
      return fail("INVESTIGATOR_HEADQUARTERS_REQUIRED", error.message.replace("INVESTIGATOR_HEADQUARTERS_REQUIRED: ", ""), 409);
    }
    if (error instanceof Error && error.message.startsWith("CASE_NOT_PLAYABLE:")) {
      return fail("CASE_NOT_PLAYABLE", error.message.replace("CASE_NOT_PLAYABLE: ", ""), 422);
    }
    if (error instanceof Error && error.message.startsWith("AGENT_CASE_EXTRACTION_CONFLICT:")) {
      return fail("BAD_REQUEST", error.message.replace("AGENT_CASE_EXTRACTION_CONFLICT: ", ""), 409);
    }
    return errorResponse(error);
  }
}
