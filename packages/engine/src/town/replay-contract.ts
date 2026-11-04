import type { AgentDecisionTrace, PersistentTownRuntime } from "../persistent-town";
import type { WorldEvent, WorldState } from "../world-types";

/** Canonical replay contract for simulation truth, independent of wall-clock metadata. */
export const WORLD_REPLAY_SCHEMA = "world-replay.v1" as const;
/** Compatibility receipt schema for the executable persistent-town replay surface. */
export const WORLD_REPLAY_COMPATIBILITY_SCHEMA = "world-replay-compat.v1" as const;
/** Version of the persistent-town state transition implementation bound to a receipt. */
export const PERSISTENT_TOWN_ENGINE_VERSION = "persistent-town.v1" as const;
/** The LCG used by persistent-town tick selection and agent decisions. */
export const WORLD_RANDOM_SOURCE_VERSION = "persistent-town-lcg.v1" as const;

export type CanonicalReplayState = {
  schema: typeof WORLD_REPLAY_SCHEMA;
  world: unknown;
  events: unknown[];
  runtime: unknown | null;
};

export type WorldReplayCompatibility = {
  schema: typeof WORLD_REPLAY_COMPATIBILITY_SCHEMA;
  engineVersion: string;
  randomSourceVersion: string;
  tickIntervalMinutes: number | null;
  scenarioPackId: string | null;
  scenarioPackHash: string | null;
  mapPackId: string | null;
  mapPackHash: string | null;
  ruleCatalogId: string | null;
  ruleCatalogHash: string | null;
  worldPackageId: string | null;
  worldPackageHash: string | null;
  worldPackageReceiptHash: string | null;
  experimentId: string | null;
  experimentHash: string | null;
  experimentPathHash: string | null;
  agentPackId: string | null;
  ecosystemCatalogId: string | null;
};

export type WorldReplayDigest = {
  schema: typeof WORLD_REPLAY_SCHEMA;
  compatibility: WorldReplayCompatibility;
  seed: string;
  tick: number | null;
  eventCount: number;
  stateDigest: string;
  eventDigest: string;
  combinedDigest: string;
};

export type ReplayDivergence = {
  path: string;
  reason: "value" | "type" | "missing" | "length";
  left: unknown;
  right: unknown;
};

type ReplayIdentityContext = {
  worldId?: string;
  runtimeId?: string;
};

const REPLAY_METADATA_KEYS = new Set([
  "createdAt",
  "updatedAt",
  "startedAt",
  "finishedAt",
  "completedAt",
  "generatedAt",
  "selectedAt",
  "lastHeartbeatAt"
]);

const WORLD_ROOT_OMIT_KEYS = new Set(["id", "createdAt", "updatedAt", "persistentRuntime"]);
const EVENT_ROOT_OMIT_KEYS = new Set(["worldId"]);
const RUNTIME_ROOT_OMIT_KEYS = new Set(["id", "worldId", "revision", "commandRevision", "createdAt", "updatedAt"]);
const RUNTIME_OMIT_KEYS = new Set(["snapshots", "scenarioRuns", "runJobs", "benchmarkRuns", "performance"]);

function normalizeIdentityString(value: string, context: ReplayIdentityContext): string {
  let normalized = value;
  const runtimeId = context.runtimeId;
  const worldId = context.worldId;
  if (runtimeId) normalized = normalized.split(runtimeId).join("@runtime");
  if (worldId) normalized = normalized.split(worldId).join("@world");
  return normalized;
}

function canonicalizeValue(
  value: unknown,
  context: ReplayIdentityContext,
  rootOmitKeys: ReadonlySet<string>,
  path: string,
  seen: WeakSet<object>
): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") return normalizeIdentityString(value, context);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Replay canonicalization rejected non-finite number at ${path || "$"}.`);
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value !== "object") throw new Error(`Replay canonicalization rejected unsupported value at ${path || "$"}.`);
  if (seen.has(value)) throw new Error(`Replay canonicalization rejected cyclic value at ${path || "$"}.`);
  seen.add(value);

  let result: unknown;
  if (Array.isArray(value)) {
    result = value.map((item, index) => {
      const canonical = canonicalizeValue(item, context, new Set(), `${path}[${index}]`, seen);
      return canonical === undefined ? null : canonical;
    });
  } else {
    const record: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      if (REPLAY_METADATA_KEYS.has(key)) continue;
      if (!path && rootOmitKeys.has(key)) continue;
      const canonical = canonicalizeValue(
        (value as Record<string, unknown>)[key],
        context,
        new Set(),
        path ? `${path}.${key}` : `$.${key}`,
        seen
      );
      if (canonical !== undefined) record[key] = canonical;
    }
    result = record;
  }
  seen.delete(value);
  return result;
}

function canonicalizeRoot(value: unknown, context: ReplayIdentityContext, rootOmitKeys: ReadonlySet<string>): unknown {
  return canonicalizeValue(value, context, rootOmitKeys, "", new WeakSet<object>());
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/** A replay-stable checksum, not a cryptographic signature or a full trace backup. */
export function buildAgentDecisionTraceDigest(
  trace: AgentDecisionTrace,
  runtime: Pick<PersistentTownRuntime, "id" | "worldId">
): string {
  const canonical = canonicalizeRoot(trace, { worldId: runtime.worldId, runtimeId: runtime.id }, new Set());
  return fnv1a(stableStringify(canonical));
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Build the immutable implementation/package identity bound to a replay receipt. */
export function buildWorldReplayCompatibility(runtime?: PersistentTownRuntime | null): WorldReplayCompatibility {
  const experiment = runtime?.currentExperiment;
  return {
    schema: WORLD_REPLAY_COMPATIBILITY_SCHEMA,
    engineVersion: optionalString(experiment?.engineVersion) || PERSISTENT_TOWN_ENGINE_VERSION,
    randomSourceVersion: WORLD_RANDOM_SOURCE_VERSION,
    tickIntervalMinutes: typeof runtime?.tickIntervalMinutes === "number" && Number.isFinite(runtime.tickIntervalMinutes)
      ? runtime.tickIntervalMinutes
      : null,
    scenarioPackId: optionalString(experiment?.scenarioPackId || runtime?.currentScenarioPackId),
    scenarioPackHash: optionalString(experiment?.scenarioPackHash),
    mapPackId: optionalString(experiment?.mapPackId || runtime?.currentMapPackId),
    mapPackHash: optionalString(experiment?.mapPackHash),
    ruleCatalogId: optionalString(experiment?.ruleCatalogId || runtime?.currentRuleCatalogId),
    ruleCatalogHash: optionalString(experiment?.ruleCatalogHash),
    worldPackageId: optionalString(experiment?.worldPackageId),
    worldPackageHash: optionalString(experiment?.worldPackageHash),
    worldPackageReceiptHash: optionalString(experiment?.worldPackageReceipt?.receiptHash),
    experimentId: optionalString(experiment?.experimentId),
    experimentHash: optionalString(experiment?.experimentHash),
    experimentPathHash: optionalString(experiment?.experimentPathHash),
    agentPackId: optionalString(experiment?.agentPackId),
    ecosystemCatalogId: optionalString(experiment?.ecosystemCatalogId)
  };
}

/** Validate a compatibility receipt before it is used as an execution authority. */
export function isWorldReplayCompatibility(value: unknown): value is WorldReplayCompatibility {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.schema !== WORLD_REPLAY_COMPATIBILITY_SCHEMA) return false;
  if (typeof candidate.engineVersion !== "string" || !candidate.engineVersion) return false;
  if (typeof candidate.randomSourceVersion !== "string" || !candidate.randomSourceVersion) return false;
  if (candidate.tickIntervalMinutes !== null && (
    typeof candidate.tickIntervalMinutes !== "number" ||
    !Number.isFinite(candidate.tickIntervalMinutes) ||
    candidate.tickIntervalMinutes < 0
  )) return false;
  const stringFields = [
    "scenarioPackId", "scenarioPackHash", "mapPackId", "mapPackHash",
    "ruleCatalogId", "ruleCatalogHash", "worldPackageId", "worldPackageHash", "worldPackageReceiptHash",
    "experimentId", "experimentHash", "experimentPathHash", "agentPackId", "ecosystemCatalogId"
  ];
  return stringFields.every((field) => candidate[field] === undefined || candidate[field] === null || (typeof candidate[field] === "string" && Boolean(candidate[field])));
}

/** Compare compatibility receipts without relying on object identity or property order. */
export function replayCompatibilityEqual(left: WorldReplayCompatibility, right: WorldReplayCompatibility): boolean {
  if (!isWorldReplayCompatibility(left) || !isWorldReplayCompatibility(right)) return false;
  const fields: Array<keyof WorldReplayCompatibility> = [
    "schema", "engineVersion", "randomSourceVersion", "tickIntervalMinutes",
    "scenarioPackId", "scenarioPackHash", "mapPackId", "mapPackHash",
    "ruleCatalogId", "ruleCatalogHash", "worldPackageId", "worldPackageHash", "worldPackageReceiptHash",
    "experimentId", "experimentHash", "experimentPathHash", "agentPackId", "ecosystemCatalogId"
  ];
  return fields.every((field) => left[field] === right[field]);
}

/** Build the serializable state used by the replay digest and divergence checker. */
export function buildCanonicalReplayState(
  world: WorldState,
  events: WorldEvent[] = [],
  runtime?: PersistentTownRuntime | null
): CanonicalReplayState {
  if (!world || typeof world.id !== "string" || typeof world.seed !== "string") {
    throw new Error("Replay canonicalization requires a world with string id and seed.");
  }
  const context: ReplayIdentityContext = { worldId: world.id, runtimeId: runtime?.id };
  const canonicalWorld = canonicalizeRoot(world, context, WORLD_ROOT_OMIT_KEYS);
  const canonicalEvents = events.map((event, index) => {
    if (!event || typeof event.id !== "string") throw new Error(`Replay event at index ${index} has no stable id.`);
    return canonicalizeRoot(event, context, EVENT_ROOT_OMIT_KEYS);
  });
  const canonicalRuntime = runtime
    ? canonicalizeRoot(runtime, context, RUNTIME_ROOT_OMIT_KEYS)
    : null;

  if (canonicalRuntime && typeof canonicalRuntime === "object" && !Array.isArray(canonicalRuntime)) {
    for (const key of RUNTIME_OMIT_KEYS) delete (canonicalRuntime as Record<string, unknown>)[key];
    // An absent legacy archive and an initialized empty archive carry the same evidence.
    const record = canonicalRuntime as Record<string, unknown>;
    if (Array.isArray(record.decisionTraceArchive) && record.decisionTraceArchive.length === 0) {
      delete record.decisionTraceArchive;
    }
  }

  return {
    schema: WORLD_REPLAY_SCHEMA,
    world: canonicalWorld,
    events: canonicalEvents,
    runtime: canonicalRuntime
  };
}

/** Produce stable component and combined hashes for a world replay checkpoint. */
export function buildWorldReplayDigest(
  world: WorldState,
  events: WorldEvent[] = [],
  runtime?: PersistentTownRuntime | null
): WorldReplayDigest {
  const canonical = buildCanonicalReplayState(world, events, runtime);
  const compatibility = buildWorldReplayCompatibility(runtime);
  const state = { world: canonical.world, runtime: canonical.runtime };
  const eventLog = canonical.events;
  const stateDigest = fnv1a(stableStringify(state));
  const eventDigest = fnv1a(stableStringify(eventLog));
  const tick = runtime?.tick ?? null;
  const combinedDigest = fnv1a(stableStringify({
    schema: WORLD_REPLAY_SCHEMA,
    compatibility,
    seed: world.seed,
    tick,
    eventCount: eventLog.length,
    stateDigest,
    eventDigest
  }));
  return {
    schema: WORLD_REPLAY_SCHEMA,
    compatibility,
    seed: world.seed,
    tick,
    eventCount: eventLog.length,
    stateDigest,
    eventDigest,
    combinedDigest
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Find the first deterministic path at which two canonical replay states diverge. */
export function findFirstReplayDivergence(left: unknown, right: unknown, path = "$", seen = new WeakMap<object, object>()): ReplayDivergence | null {
  if (Object.is(left, right)) return null;
  if (typeof left !== typeof right || (left === null) !== (right === null)) {
    return { path, reason: "type", left, right };
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return { path, reason: "type", left, right };
    if (left.length !== right.length) return { path, reason: "length", left: left.length, right: right.length };
    for (let index = 0; index < left.length; index += 1) {
      const divergence = findFirstReplayDivergence(left[index], right[index], `${path}[${index}]`, seen);
      if (divergence) return divergence;
    }
    return null;
  }
  if (isRecord(left) || isRecord(right)) {
    if (!isRecord(left) || !isRecord(right)) return { path, reason: "type", left, right };
    if (seen.get(left) === right) return null;
    seen.set(left, right);
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    for (const key of keys) {
      const leftHas = Object.prototype.hasOwnProperty.call(left, key);
      const rightHas = Object.prototype.hasOwnProperty.call(right, key);
      if (!leftHas || !rightHas) {
        return { path: `${path}.${key}`, reason: "missing", left: leftHas ? left[key] : undefined, right: rightHas ? right[key] : undefined };
      }
      const divergence = findFirstReplayDivergence(left[key], right[key], `${path}.${key}`, seen);
      if (divergence) return divergence;
    }
    return null;
  }
  return { path, reason: "value", left, right };
}

export function compareCanonicalReplayStates(left: CanonicalReplayState, right: CanonicalReplayState): ReplayDivergence | null {
  return findFirstReplayDivergence(left, right);
}
