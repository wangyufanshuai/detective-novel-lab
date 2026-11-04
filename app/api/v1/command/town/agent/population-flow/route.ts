import { adminGuard, adminOk, errorResponse, fail, readJson } from "@/app/api/v1/_utils";
import { resolveRuntimeAgentSourceRefs } from "@/app/api/v1/_agent-control";
import { loadRuntimeWorld, persistRuntimeWorld, publicRuntime, publicWorld, runtimeRevision } from "@/app/api/v1/_town-runtime";
import {
  AGENT_CONTROL_SCHEMA,
  applyPopulationFlow,
  validateAgentControlMetadata,
  type PopulationFlowInput,
  type PopulationFlowRecord
} from "@/lib/engine";

type AgentPopulationFlowBody = {
  worldId?: string;
  actionId?: string;
  expectedRevision?: string;
  reason?: string;
  sourceRefs?: string[];
  populationFlow?: Omit<PopulationFlowInput, "agentActionId" | "agentSourceRefs" | "reason">;
};

function stablePayload(input: {
  reason: string;
  sourceRefs: string[];
  populationFlow: {
    sourceEventId: string;
    sourceCandidateId?: string;
    arrivalLocationId?: string;
    day?: number;
    time?: string;
  };
}) {
  return JSON.stringify({
    reason: input.reason,
    sourceRefs: input.sourceRefs,
    populationFlow: input.populationFlow
  });
}

function existingPayload(record: PopulationFlowRecord) {
  return stablePayload({
    reason: record.reason,
    sourceRefs: record.agentSourceRefs || [],
    populationFlow: {
      sourceEventId: record.sourceEventId,
      sourceCandidateId: record.sourceCandidateId,
      arrivalLocationId: record.arrivalLocationId,
      day: record.createdAtDay,
      time: record.createdAtTime
    }
  });
}

function requestedPayload(body: AgentPopulationFlowBody, record?: PopulationFlowRecord) {
  const input = body.populationFlow!;
  return stablePayload({
    reason: body.reason!,
    sourceRefs: body.sourceRefs!,
    populationFlow: {
      sourceEventId: input.sourceEventId,
      sourceCandidateId: input.sourceCandidateId,
      arrivalLocationId: input.arrivalLocationId ?? record?.arrivalLocationId,
      day: input.day ?? record?.createdAtDay,
      time: input.time ?? record?.createdAtTime
    }
  });
}

export async function POST(request: Request) {
  try {
    const unauthorized = adminGuard(request);
    if (unauthorized) return unauthorized;
    const body = await readJson<AgentPopulationFlowBody>(request, {});
    if (!body.worldId || !body.populationFlow || typeof body.populationFlow.sourceEventId !== "string" || !body.populationFlow.sourceEventId) {
      return fail("BAD_REQUEST", "worldId, actionId, expectedRevision, reason, sourceRefs, and populationFlow.sourceEventId are required");
    }
    const metadataErrors = validateAgentControlMetadata(body);
    if (metadataErrors.length) return fail("BAD_REQUEST", metadataErrors.join(" "));
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const sourceEvent = loaded.events.find((event) => event.id === body.populationFlow!.sourceEventId);
    if (!sourceEvent) return fail("BAD_REQUEST", "populationFlow.sourceEventId must resolve in the authoritative world event log");
    if (!(body.sourceRefs || []).includes(`event:${sourceEvent.id}`)) {
      return fail("BAD_REQUEST", "sourceRefs must include the population-flow source event");
    }
    const sourceResolution = resolveRuntimeAgentSourceRefs({
      world: loaded.world,
      runtime: loaded.runtime,
      events: loaded.events,
      sourceRefs: body.sourceRefs!
    });
    if (!sourceResolution.ok) return fail("BAD_REQUEST", `sourceRefs could not be resolved: ${sourceResolution.unresolved.join(", ")}`);

    const ledger = loaded.runtime.populationFlowLedger || [];
    const existingAction = ledger.find((record) => record.agentActionId === body.actionId);
    if (existingAction) {
      if (existingPayload(existingAction) !== requestedPayload(body, existingAction)) {
        return fail("BAD_REQUEST", "actionId is already bound to a different population flow", 409);
      }
      const existingEvent = loaded.events.find((event) => event.id === existingAction.arrivalEventId);
      if (!existingEvent) return fail("BAD_REQUEST", `population flow ledger is not replayable: ${existingAction.id}`, 409);
      return adminOk({
        schema: AGENT_CONTROL_SCHEMA,
        actionId: body.actionId,
        replayed: true,
        revision: runtimeRevision(loaded.runtime),
        sourceRefs: sourceResolution.references,
        populationFlow: existingAction,
        arrivalEvent: existingEvent,
        runtime: publicRuntime(loaded.runtime),
        world: publicWorld(loaded.world)
      });
    }

    const sameSource = ledger.find((record) => record.sourceEventId === body.populationFlow!.sourceEventId && (record.sourceCandidateId || "") === (body.populationFlow!.sourceCandidateId || ""));
    if (sameSource) {
      return fail("BAD_REQUEST", sameSource.agentActionId
        ? `source tuple is already bound to Agent action ${sameSource.agentActionId}`
        : "source tuple was already created outside an Agent action", 409);
    }

    const currentRevision = runtimeRevision(loaded.runtime);
    if (body.expectedRevision !== currentRevision) {
      return fail("RUNTIME_REVISION_CONFLICT", "expectedRevision is stale; observe the world again before committing", 409);
    }
    const result = applyPopulationFlow(loaded.world, loaded.runtime, loaded.events, {
      ...body.populationFlow,
      agentActionId: body.actionId,
      agentSourceRefs: body.sourceRefs,
      reason: body.reason
    });
    const nextWorld = result.world as typeof loaded.world & { persistentRuntime?: typeof result.runtime };
    nextWorld.persistentRuntime = result.runtime;
    persistRuntimeWorld(nextWorld, result.createdEvents);
    return adminOk({
      schema: AGENT_CONTROL_SCHEMA,
      actionId: body.actionId,
      replayed: false,
      revision: runtimeRevision(result.runtime),
      sourceRefs: sourceResolution.references,
      populationFlow: result.record,
      arrivalEvent: result.event,
      runtime: publicRuntime(result.runtime),
      world: publicWorld(nextWorld)
    });
  } catch (error) {
    return errorResponse(error);
  }
}
