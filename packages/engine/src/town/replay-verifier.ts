import type { PersistentTownRuntime } from "../persistent-town";
import type { WorldEvent, WorldState } from "../world-types";
import {
  buildCanonicalReplayState,
  buildWorldReplayDigest,
  compareCanonicalReplayStates,
  isWorldReplayCompatibility,
  replayCompatibilityEqual,
  type CanonicalReplayState,
  type ReplayDivergence,
  type WorldReplayDigest,
  type WorldReplayCompatibility
} from "./replay-contract";

export type ReplayVerificationStatus = "verified" | "mismatch" | "evidence-insufficient";

export type ReplayVerificationFailure = {
  code:
  | "missing-expected-digest"
  | "invalid-expected-digest"
  | "incomplete-expected-digest"
  | "compatibility-invalid"
  | "compatibility-mismatch"
  | "schema-mismatch"
  | "seed-mismatch"
  | "tick-mismatch"
  | "event-count-mismatch"
  | "state-digest-mismatch"
  | "event-digest-mismatch"
  | "combined-digest-mismatch"
  | "computed-live-digest"
  | "missing-expected-state"
  | "manifest-run-mismatch"
  | "commands-not-an-array"
  | "command-id-missing"
  | "command-id-duplicate"
  | "command-run-mismatch"
  | "command-type-invalid"
  | "command-created-at-invalid"
  | "snapshots-not-an-array"
  | "checkpoint-receipt-missing"
  | "checkpoint-receipt-invalid"
  | "checkpoint-tick-invalid"
  | "checkpoint-tick-duplicate";
  message: string;
  path?: string;
  expected?: unknown;
  actual?: unknown;
};

export type ReplayDigestVerification = {
  status: ReplayVerificationStatus;
  actualDigest: WorldReplayDigest;
  expectedDigest: Partial<WorldReplayDigest> | null;
  comparedFields: Array<keyof WorldReplayDigest>;
  failures: ReplayVerificationFailure[];
  firstDivergence?: ReplayDivergence;
};

export type ReplayCommandLike = {
  id?: unknown;
  runId?: unknown;
  type?: unknown;
  createdAt?: unknown;
};

export type ReplayCommandVerification = {
  status: ReplayVerificationStatus;
  commandCount: number;
  uniqueCommandCount: number;
  failures: ReplayVerificationFailure[];
};

export type ReplayCheckpointVerification = {
  status: ReplayVerificationStatus;
  snapshotCount: number;
  checkpointCount: number;
  receiptCount: number;
  ticks: number[];
  failures: ReplayVerificationFailure[];
};

export type ReplayBundleLike = {
  manifest?: { runId?: unknown } | null;
  replayDigest?: unknown;
  replayDigestSource?: "artifact" | "computed-live" | unknown;
  snapshots?: unknown;
  commands?: unknown;
};

export type ReplayBundleVerification = {
  status: ReplayVerificationStatus;
  manifestRunId: string | null;
  digestSource: "artifact" | "computed-live" | "missing";
  failures: ReplayVerificationFailure[];
  digest: ReplayDigestVerification;
  commands: ReplayCommandVerification;
  checkpoints: ReplayCheckpointVerification;
};

const DIGEST_FIELDS: Array<keyof WorldReplayDigest> = [
  "schema",
  "compatibility",
  "seed",
  "tick",
  "eventCount",
  "stateDigest",
  "eventDigest",
  "combinedDigest"
];

const COMMAND_TYPES = new Set([
  "scenario-intervention",
  "reviewer-action",
  "benchmark-rerun",
  "export-action"
]);

const DIGEST_FAILURE_CODES: Record<keyof WorldReplayDigest, ReplayVerificationFailure["code"]> = {
  schema: "schema-mismatch",
  compatibility: "compatibility-mismatch",
  seed: "seed-mismatch",
  tick: "tick-mismatch",
  eventCount: "event-count-mismatch",
  stateDigest: "state-digest-mismatch",
  eventDigest: "event-digest-mismatch",
  combinedDigest: "combined-digest-mismatch"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDigestField(field: keyof WorldReplayDigest, value: unknown): boolean {
  if (field === "compatibility") return isWorldReplayCompatibility(value);
  if (field === "schema" || field === "seed" || field === "stateDigest" || field === "eventDigest" || field === "combinedDigest") {
    return typeof value === "string" && value.length > 0;
  }
  if (field === "tick") return value === null || (typeof value === "number" && Number.isInteger(value) && value >= 0);
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function normalizeExpectedDigest(value: unknown): { digest: Partial<WorldReplayDigest> | null; invalid: boolean } {
  if (value === undefined || value === null) return { digest: null, invalid: false };
  if (!isRecord(value)) return { digest: null, invalid: true };
  const digest: Partial<WorldReplayDigest> = {};
  let invalid = false;
  for (const field of DIGEST_FIELDS) {
    if (!(field in value)) continue;
    const candidate = value[field];
    if (!isDigestField(field, candidate)) invalid = true;
    else (digest[field] as unknown) = candidate;
  }
  return { digest, invalid };
}

function statusFromFailures(failures: ReplayVerificationFailure[], hasMissingEvidence: boolean): ReplayVerificationStatus {
  if (failures.some((failure) => !["missing-expected-digest", "incomplete-expected-digest", "missing-expected-state"].includes(failure.code))) return "mismatch";
  return hasMissingEvidence ? "evidence-insufficient" : "verified";
}

/** Compare a current authoritative world against a stored replay receipt. */
export function verifyWorldReplayDigest(input: {
  world: WorldState;
  events?: WorldEvent[];
  runtime?: PersistentTownRuntime | null;
  expectedDigest?: unknown;
  expectedCanonicalState?: CanonicalReplayState | null;
}): ReplayDigestVerification {
  const actualDigest = buildWorldReplayDigest(input.world, input.events || [], input.runtime);
  const actualCanonicalState = input.expectedCanonicalState ? buildCanonicalReplayState(input.world, input.events || [], input.runtime) : null;
  const normalized = normalizeExpectedDigest(input.expectedDigest);
  const failures: ReplayVerificationFailure[] = [];

  if (normalized.invalid) {
    failures.push({ code: "invalid-expected-digest", message: "Expected replay digest is not a valid digest object." });
  }
  if (!normalized.digest) {
    failures.push({ code: "missing-expected-digest", message: "No stored replay digest is available for comparison." });
  }

  const expectedDigest = normalized.digest;
  const comparedFields: Array<keyof WorldReplayDigest> = [];
  if (expectedDigest) {
    for (const field of DIGEST_FIELDS) {
      if (!(field in expectedDigest)) continue;
      comparedFields.push(field);
      const matches = field === "compatibility"
        ? replayCompatibilityEqual(expectedDigest.compatibility as WorldReplayCompatibility, actualDigest.compatibility)
        : expectedDigest[field] === actualDigest[field];
      if (!matches) {
        const code = DIGEST_FAILURE_CODES[field];
        failures.push({
          code,
          message: `Replay ${field} does not match the current authoritative state.`,
          path: `$.${field}`,
          expected: expectedDigest[field],
          actual: actualDigest[field]
        });
      }
    }
    if (comparedFields.length !== DIGEST_FIELDS.length && !failures.some((failure) => failure.code === "invalid-expected-digest")) {
      failures.push({ code: "incomplete-expected-digest", message: "Stored replay digest is incomplete; all canonical fields are required." });
    }
  }

  let firstDivergence: ReplayDivergence | undefined;
  if (input.expectedCanonicalState) {
    if (!actualCanonicalState) {
      failures.push({ code: "missing-expected-state", message: "Expected canonical replay state is unavailable." });
    } else {
      firstDivergence = compareCanonicalReplayStates(input.expectedCanonicalState, actualCanonicalState) || undefined;
      if (firstDivergence) {
        failures.push({
          code: "combined-digest-mismatch",
          message: "Canonical replay state diverges from the expected replay state.",
          path: firstDivergence.path,
          expected: firstDivergence.left,
          actual: firstDivergence.right
        });
      }
    }
  }

  return {
    status: statusFromFailures(
      failures,
      !expectedDigest || failures.some((failure) => ["incomplete-expected-digest", "missing-expected-state"].includes(failure.code))
    ),
    actualDigest,
    expectedDigest,
    comparedFields,
    failures,
    firstDivergence
  };
}

/** Validate the replay command envelope without executing privileged actions. */
export function verifyReplayCommandSequence(commands: unknown, runId: string): ReplayCommandVerification {
  const failures: ReplayVerificationFailure[] = [];
  if (!Array.isArray(commands)) {
    return {
      status: "evidence-insufficient",
      commandCount: 0,
      uniqueCommandCount: 0,
      failures: [{ code: "commands-not-an-array", message: "Replay command sequence is unavailable or is not an array." }]
    };
  }

  const ids = new Set<string>();
  for (const [index, candidate] of commands.entries()) {
    const path = `$.commands[${index}]`;
    if (!isRecord(candidate) || typeof candidate.id !== "string" || !candidate.id.trim()) {
      failures.push({ code: "command-id-missing", message: "Replay command has no stable id.", path: `${path}.id` });
      continue;
    }
    if (ids.has(candidate.id)) failures.push({ code: "command-id-duplicate", message: `Replay command id ${candidate.id} is duplicated.`, path: `${path}.id` });
    ids.add(candidate.id);
    if (candidate.runId !== runId) {
      failures.push({ code: "command-run-mismatch", message: "Replay command belongs to a different run.", path: `${path}.runId`, expected: runId, actual: candidate.runId });
    }
    if (typeof candidate.type !== "string" || !COMMAND_TYPES.has(candidate.type)) {
      failures.push({ code: "command-type-invalid", message: "Replay command type is outside the canonical command envelope.", path: `${path}.type`, actual: candidate.type });
    }
    if (typeof candidate.createdAt !== "string" || !Number.isFinite(Date.parse(candidate.createdAt))) {
      failures.push({ code: "command-created-at-invalid", message: "Replay command createdAt is not a valid timestamp.", path: `${path}.createdAt`, actual: candidate.createdAt });
    }
  }
  return {
    status: failures.length ? "mismatch" : "verified",
    commandCount: commands.length,
    uniqueCommandCount: ids.size,
    failures
  };
}

/** Validate persisted checkpoint receipt shape without exposing private checkpoint state. */
export function verifyReplayCheckpointReceipts(snapshots: unknown): ReplayCheckpointVerification {
  if (snapshots === undefined || snapshots === null) {
    return { status: "verified", snapshotCount: 0, checkpointCount: 0, receiptCount: 0, ticks: [], failures: [] };
  }
  if (!Array.isArray(snapshots)) {
    return {
      status: "evidence-insufficient",
      snapshotCount: 0,
      checkpointCount: 0,
      receiptCount: 0,
      ticks: [],
      failures: [{ code: "snapshots-not-an-array", message: "Replay snapshots are unavailable or are not an array." }]
    };
  }
  const failures: ReplayVerificationFailure[] = [];
  const ticks: number[] = [];
  const checkpointKeys = new Set<string>();
  let checkpointCount = 0;
  let receiptCount = 0;
  for (const [index, value] of snapshots.entries()) {
    const path = `$.snapshots[${index}]`;
    if (!isRecord(value)) {
      failures.push({ code: "checkpoint-receipt-invalid", message: "Replay snapshot is not an object.", path });
      continue;
    }
    const mode = value.mode;
    const isCheckpoint = mode === "checkpoint" || "checkpoint" in value;
    if (!isCheckpoint) continue;
    checkpointCount += 1;
    if (typeof value.tick !== "number" || !Number.isInteger(value.tick) || value.tick < 0) {
      failures.push({ code: "checkpoint-tick-invalid", message: "Checkpoint tick is not a non-negative integer.", path: `${path}.tick`, actual: value.tick });
    } else {
      const checkpointKey = `${typeof value.branchId === "string" ? value.branchId : "main"}:${value.tick}`;
      if (checkpointKeys.has(checkpointKey)) {
        failures.push({ code: "checkpoint-tick-duplicate", message: `Checkpoint tick ${value.tick} is duplicated within branch ${checkpointKey.split(":")[0]}.`, path: `${path}.tick`, actual: value.tick });
      } else {
        checkpointKeys.add(checkpointKey);
        ticks.push(value.tick);
      }
    }
    const normalized = normalizeExpectedDigest(value.replayDigest);
    if (!normalized.digest) {
      failures.push({ code: "checkpoint-receipt-missing", message: "Checkpoint has no persisted replay digest receipt.", path: `${path}.replayDigest` });
      continue;
    }
    if (normalized.invalid || Object.keys(normalized.digest).length !== DIGEST_FIELDS.length) {
      failures.push({ code: "checkpoint-receipt-invalid", message: "Checkpoint replay digest is invalid or incomplete.", path: `${path}.replayDigest` });
      continue;
    }
    receiptCount += 1;
  }
  const hasMismatch = failures.some((failure) => !["checkpoint-receipt-missing"].includes(failure.code));
  const hasGap = failures.some((failure) => failure.code === "checkpoint-receipt-missing");
  return {
    status: hasMismatch ? "mismatch" : hasGap ? "evidence-insufficient" : "verified",
    snapshotCount: snapshots.length,
    checkpointCount,
    receiptCount,
    ticks: ticks.sort((left, right) => left - right),
    failures
  };
}

/** Verify the digest and command envelope exposed by a run replay bundle. */
export function verifyReplayBundle(input: {
  runId: string;
  bundle: ReplayBundleLike;
  world: WorldState;
  events?: WorldEvent[];
  runtime?: PersistentTownRuntime | null;
}): ReplayBundleVerification {
  const digestSource: ReplayBundleVerification["digestSource"] = input.bundle.replayDigestSource === "computed-live"
    ? "computed-live"
    : input.bundle.replayDigest
      ? "artifact"
      : "missing";
  const digest = verifyWorldReplayDigest({
    world: input.world,
    events: input.events,
    runtime: input.runtime,
    expectedDigest: digestSource === "artifact" ? input.bundle.replayDigest : undefined
  });
  const commands = verifyReplayCommandSequence(input.bundle.commands, input.runId);
  const checkpoints = verifyReplayCheckpointReceipts(input.bundle.snapshots);
  const manifestRunId = typeof input.bundle.manifest?.runId === "string" ? input.bundle.manifest.runId : null;
  const manifestFailure = manifestRunId === input.runId
    ? []
    : [{
        code: "manifest-run-mismatch" as const,
        message: "Replay bundle manifest does not belong to the requested run.",
        path: "$.manifest.runId",
        expected: input.runId,
        actual: manifestRunId
      }];
  const status: ReplayVerificationStatus = manifestFailure.length || digest.status === "mismatch" || commands.status === "mismatch" || checkpoints.status === "mismatch"
    ? "mismatch"
    : digest.status === "evidence-insufficient" || digestSource !== "artifact" || checkpoints.status === "evidence-insufficient"
      ? "evidence-insufficient"
      : "verified";
  return {
    status,
    manifestRunId,
    digestSource,
    failures: manifestFailure,
    digest,
    commands,
    checkpoints
  };
}
