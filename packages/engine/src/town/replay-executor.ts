import type { RunCommand } from "../run-catalog";
import {
  advancePersistentTownTick,
  applyTownRuntimeIntervention,
  rollbackTownRuntimeToSnapshot,
  type PersistentTownRuntime,
  type TownRuntimeIntervention,
  type TownStateSnapshot
} from "../persistent-town";
import type { WorldEvent, WorldState } from "../world-types";
import {
  buildWorldReplayCompatibility,
  buildWorldReplayDigest,
  isWorldReplayCompatibility,
  replayCompatibilityEqual,
  type WorldReplayDigest
} from "./replay-contract";
import {
  verifyReplayCommandSequence,
  verifyWorldReplayDigest,
  type ReplayVerificationFailure,
  type ReplayVerificationStatus
} from "./replay-verifier";

export type ReplayExecutionFailure = ReplayVerificationFailure | {
  code:
  | "checkpoint-required"
  | "checkpoint-world-mismatch"
  | "checkpoint-event-missing"
  | "branch-required"
  | "branch-mismatch"
  | "command-payload-invalid"
  | "command-offset-invalid"
  | "command-actor-missing"
  | "expected-digest-mismatch";
  message: string;
  path?: string;
  expected?: unknown;
  actual?: unknown;
};

export type ReplayExecutionResult = {
  status: ReplayVerificationStatus;
  runId: string;
  branchId?: string;
  steps: number;
  appliedCommandIds: string[];
  world?: WorldState;
  runtime?: PersistentTownRuntime;
  events?: WorldEvent[];
  digest?: WorldReplayDigest;
  failures: ReplayExecutionFailure[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type RuntimeWorld = WorldState & { persistentRuntime?: PersistentTownRuntime };

function failResult(runId: string, failures: ReplayExecutionFailure[], branchId?: string): ReplayExecutionResult {
  const mismatch = failures.some((failure) => !["checkpoint-required", "checkpoint-event-missing"].includes(failure.code));
  return {
    status: mismatch ? "mismatch" : "evidence-insufficient",
    runId,
    branchId,
    steps: 0,
    appliedCommandIds: [],
    failures
  };
}

function interventionFromPayload(value: unknown): { offset: number; intervention: Omit<TownRuntimeIntervention, "id" | "tick" | "createdAt" | "branch" | "impact" | "decisionTraceId" | "decisionTraceDigest" | "decisionStatus"> } | ReplayExecutionFailure {
  if (!isRecord(value) || !isRecord(value.intervention)) {
    return { code: "command-payload-invalid", message: "Scenario intervention command payload is missing an intervention object." };
  }
  const offset = value.atTickOffset;
  if (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0 || offset > 60) {
    return { code: "command-offset-invalid", message: "Scenario intervention offset must be an integer from 0 through 60.", actual: offset };
  }
  const intervention = value.intervention;
  if (typeof intervention.actorId !== "string" || !intervention.actorId || typeof intervention.kind !== "string" || typeof intervention.value === "undefined") {
    return { code: "command-payload-invalid", message: "Scenario intervention payload must include actorId, kind, and value." };
  }
  const allowedKinds = new Set(["goal", "location", "resource", "relationship-pressure", "knowledge", "action-bias"]);
  if (!allowedKinds.has(intervention.kind)) {
    return { code: "command-payload-invalid", message: "Scenario intervention kind is outside the replay command contract.", actual: intervention.kind };
  }
  if (!["string", "number", "boolean"].includes(typeof intervention.value)) {
    return { code: "command-payload-invalid", message: "Scenario intervention value must be a scalar." };
  }
  return {
    offset,
    intervention: {
      actorId: intervention.actorId,
      kind: intervention.kind as TownRuntimeIntervention["kind"],
      value: intervention.value as string | number | boolean
    }
  };
}

/** Execute a scenario intervention command stream from a private checkpoint copy. */
export function executeReplayFromCheckpoint(input: {
  runId: string;
  branchId?: string;
  world: WorldState;
  events?: WorldEvent[];
  startSnapshot: TownStateSnapshot;
  commands: RunCommand[];
  steps?: number;
  expectedDigest?: WorldReplayDigest | null;
}): ReplayExecutionResult {
  const events = input.events || [];
  const start = input.startSnapshot;
  if (!start.checkpoint) return failResult(input.runId, [{ code: "checkpoint-required", message: "Replay execution requires a private checkpoint snapshot." }], input.branchId);
  if (start.worldId !== input.world.id || start.checkpoint.world.id !== input.world.id) {
    return failResult(input.runId, [{ code: "checkpoint-world-mismatch", message: "Checkpoint does not belong to the requested world.", expected: input.world.id, actual: start.worldId }], input.branchId);
  }
  const commandCheck = verifyReplayCommandSequence(input.commands, input.runId);
  if (commandCheck.status === "mismatch") return failResult(input.runId, commandCheck.failures, input.branchId);
  const expectedCompatibility = input.expectedDigest?.compatibility;
  if (expectedCompatibility !== undefined) {
    if (!isWorldReplayCompatibility(expectedCompatibility)) {
      return failResult(input.runId, [{
        code: "compatibility-invalid",
        message: "Replay execution expected digest has an invalid compatibility receipt.",
        path: "$.compatibility",
        actual: expectedCompatibility
      }], input.branchId);
    }
    const checkpointCompatibility = buildWorldReplayCompatibility(start.checkpoint.runtime as PersistentTownRuntime);
    if (!replayCompatibilityEqual(checkpointCompatibility, expectedCompatibility)) {
      return failResult(input.runId, [{
        code: "compatibility-mismatch",
        message: "Checkpoint compatibility does not match the expected replay receipt.",
        path: "$.compatibility",
        expected: expectedCompatibility,
        actual: checkpointCompatibility
      }], input.branchId);
    }
    const liveRuntime = (input.world as RuntimeWorld).persistentRuntime;
    if (liveRuntime) {
      const liveCompatibility = buildWorldReplayCompatibility(liveRuntime);
      if (!replayCompatibilityEqual(liveCompatibility, expectedCompatibility)) {
        return failResult(input.runId, [{
          code: "compatibility-mismatch",
          message: "Live world compatibility does not match the expected replay receipt.",
          path: "$.compatibility",
          expected: expectedCompatibility,
          actual: liveCompatibility
        }], input.branchId);
      }
    }
  }
  const selectedCommands = input.branchId
    ? input.commands.filter((command) => command.branchId === input.branchId)
    : input.commands;
  if (input.commands.some((command) => command.branchId) && !input.branchId) {
    return failResult(input.runId, [{ code: "branch-required", message: "Replay execution requires branchId when a run contains branch-scoped commands." }]);
  }
  if (input.branchId && selectedCommands.length !== input.commands.length && !selectedCommands.length) {
    return failResult(input.runId, [{ code: "branch-mismatch", message: `No commands belong to branch ${input.branchId}.`, actual: input.branchId }], input.branchId);
  }
  const parsed: Array<{ command: RunCommand; offset: number; intervention: Omit<TownRuntimeIntervention, "id" | "tick" | "createdAt" | "branch" | "impact" | "decisionTraceId" | "decisionTraceDigest" | "decisionStatus"> }> = [];
  for (const command of selectedCommands) {
    if (command.type !== "scenario-intervention") {
      return failResult(input.runId, [{ code: "command-type-invalid", message: "Replay executor only executes scenario-intervention commands; other commands require a dedicated executor.", path: `$.commands.${command.id}`, actual: command.type }], input.branchId);
    }
    const parsedCommand = interventionFromPayload(command.payload);
    if ("code" in parsedCommand) return failResult(input.runId, [parsedCommand], input.branchId);
    parsed.push({ command, ...parsedCommand });
  }
  const snapshotEventIds = new Set(start.eventIds);
  const missingEvent = [...snapshotEventIds].find((eventId) => !events.some((event) => event.id === eventId));
  if (missingEvent) return failResult(input.runId, [{ code: "checkpoint-event-missing", message: `Checkpoint event ${missingEvent} is missing from the authoritative event log.`, actual: missingEvent }], input.branchId);
  let branchWorld: WorldState;
  let branchRuntime: PersistentTownRuntime;
  try {
    const restored = rollbackTownRuntimeToSnapshot(start.checkpoint.world, start);
    branchWorld = restored.world;
    branchRuntime = restored.runtime;
  } catch (error) {
    return failResult(input.runId, [{ code: "checkpoint-required", message: error instanceof Error ? error.message : "Checkpoint could not be restored." }], input.branchId);
  }
  let branchEvents = events.filter((event) => snapshotEventIds.has(event.id));
  const maxOffset = parsed.reduce((max, item) => Math.max(max, item.offset), 0);
  const steps = Math.max(1, Math.min(60, Math.round(input.steps ?? maxOffset + 1)));
  const appliedCommandIds: string[] = [];
  for (let offset = 0; offset < steps; offset += 1) {
    for (const item of parsed.filter((candidate) => candidate.offset === offset).sort((left, right) => left.command.id.localeCompare(right.command.id))) {
      if (!branchWorld.npcs.some((npc) => npc.id === item.intervention.actorId)) {
        return failResult(input.runId, [{ code: "command-actor-missing", message: `Intervention actor ${item.intervention.actorId} is not present in the checkpoint world.`, actual: item.intervention.actorId }], input.branchId);
      }
      const applied = applyTownRuntimeIntervention(branchWorld, item.intervention);
      branchWorld = applied.world;
      branchRuntime = applied.runtime;
      appliedCommandIds.push(item.command.id);
    }
    const advanced = advancePersistentTownTick(branchWorld, branchEvents, { steps: 1, status: "running" });
    branchWorld = advanced.world;
    branchRuntime = advanced.runtime;
    branchEvents = [...branchEvents, ...advanced.events];
  }
  const digest = buildWorldReplayDigest(branchWorld, branchEvents, branchRuntime);
  const verification = verifyWorldReplayDigest({
    world: branchWorld,
    events: branchEvents,
    runtime: branchRuntime,
    expectedDigest: input.expectedDigest
  });
  const failures: ReplayExecutionFailure[] = [...verification.failures];
  if (input.expectedDigest && input.expectedDigest.combinedDigest !== digest.combinedDigest) {
    failures.push({ code: "expected-digest-mismatch", message: "Replay execution digest does not match the expected receipt.", expected: input.expectedDigest.combinedDigest, actual: digest.combinedDigest });
  }
  return {
    status: verification.status,
    runId: input.runId,
    branchId: input.branchId,
    steps,
    appliedCommandIds,
    world: branchWorld,
    runtime: branchRuntime,
    events: branchEvents,
    digest,
    failures
  };
}
