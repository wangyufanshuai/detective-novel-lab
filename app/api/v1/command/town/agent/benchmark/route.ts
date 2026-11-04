import { adminGuard, adminOk, errorResponse, fail, readJson } from "@/app/api/v1/_utils";
import { resolveRuntimeAgentSourceRefs } from "@/app/api/v1/_agent-control";
import { loadAgentBenchmarkReceipt, saveAgentBenchmarkReceipt } from "@/app/api/v1/_agent-benchmark";
import { loadRuntimeWorld, runtimeRevision } from "@/app/api/v1/_town-runtime";
import {
  AGENT_CONTROL_SCHEMA,
  buildTownAgentControlManifest,
  runEmergenceBenchmark,
  validateAgentControlMetadata
} from "@/lib/engine";

type AgentBenchmarkBody = {
  worldId?: string;
  actionId?: string;
  expectedRevision?: string;
  reason?: string;
  sourceRefs?: string[];
  seedCount?: 10 | 20;
};

function benchmarkSeeds(worldSeed: string, seedCount: 10 | 20) {
  return Array.from({ length: seedCount }, (_, index) => `agent-emergence:${worldSeed}:${String(index + 1).padStart(2, "0")}`);
}

export async function POST(request: Request) {
  try {
    const unauthorized = adminGuard(request);
    if (unauthorized) return unauthorized;
    const body = await readJson<AgentBenchmarkBody>(request, {});
    if (!body.worldId || (body.seedCount !== 10 && body.seedCount !== 20)) {
      return fail("BAD_REQUEST", "worldId, actionId, expectedRevision, reason, sourceRefs, and seedCount (10 or 20) are required");
    }
    const metadataErrors = validateAgentControlMetadata(body);
    if (metadataErrors.length) return fail("BAD_REQUEST", metadataErrors.join(" "));
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const currentRevision = runtimeRevision(loaded.runtime);
    const existingReceipt = loadAgentBenchmarkReceipt(loaded.world.id, body.actionId!);
    if (existingReceipt) {
      const sameRequest = existingReceipt.worldId === loaded.world.id
        && existingReceipt.expectedRevision === body.expectedRevision
        && existingReceipt.reason === body.reason
        && existingReceipt.seedCount === body.seedCount
        && JSON.stringify(existingReceipt.sourceRefs.map((ref) => ref.ref)) === JSON.stringify(body.sourceRefs);
      if (!sameRequest) return fail("BAD_REQUEST", "actionId is already bound to a different benchmark payload", 409);
      return adminOk({
        schema: AGENT_CONTROL_SCHEMA,
        actionId: body.actionId,
        replayed: true,
        revision: currentRevision,
        receipt: existingReceipt,
        report: existingReceipt.report,
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
    if (!(body.sourceRefs || []).includes(`world:${loaded.world.id}`)) return fail("BAD_REQUEST", "sourceRefs must include the benchmark world");
    if (body.expectedRevision !== currentRevision) {
      return fail("RUNTIME_REVISION_CONFLICT", "expectedRevision is stale; observe the world again before benchmarking", 409);
    }
    const report = runEmergenceBenchmark(benchmarkSeeds(loaded.world.seed, body.seedCount));
    const stored = saveAgentBenchmarkReceipt({
      schema: "agent-benchmark-receipt.v1",
      worldId: loaded.world.id,
      actionId: body.actionId!,
      expectedRevision: body.expectedRevision!,
      reason: body.reason!,
      sourceRefs: sourceResolution.references,
      seedCount: body.seedCount,
      compatibility: buildTownAgentControlManifest(loaded.runtime).compatibility,
      report
    });
    return adminOk({
      schema: AGENT_CONTROL_SCHEMA,
      actionId: body.actionId,
      replayed: stored.replayed,
      revision: currentRevision,
      receipt: stored.receipt,
      report,
      sourceRefs: sourceResolution.references
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("RUNTIME_REVISION_CONFLICT:")) {
      return fail("RUNTIME_REVISION_CONFLICT", error.message.replace("RUNTIME_REVISION_CONFLICT: ", ""), 409);
    }
    if (error instanceof Error && error.message.startsWith("AGENT_BENCHMARK_CONFLICT:")) {
      return fail("BAD_REQUEST", error.message.replace("AGENT_BENCHMARK_CONFLICT: ", ""), 409);
    }
    return errorResponse(error);
  }
}
