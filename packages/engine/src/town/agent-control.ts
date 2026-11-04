import {
  buildWorldReplayCompatibility,
  type WorldReplayCompatibility
} from "./replay-contract";
import type { PersistentTownRuntime } from "../persistent-town";

/** Stable discovery contract for external world agents. */
export const AGENT_CONTROL_SCHEMA = "agent-control.v1" as const;

export type AgentControlCommandDescriptor = {
  id: string;
  phase: "observe" | "propose" | "commit" | "review" | "benchmark" | "replay" | "package";
  method: "GET" | "POST";
  path: string;
  auth: "public" | "admin";
  mutates: boolean;
  requiresRevision: boolean;
  requiresSourceRefs: boolean;
  status: "implemented" | "planned";
};

export type AgentControlManifest = {
  schema: typeof AGENT_CONTROL_SCHEMA;
  protocolVersion: "v1";
  sourceOfTruth: "persistent-town";
  compatibility: WorldReplayCompatibility;
  commands: AgentControlCommandDescriptor[];
  invariants: {
    observationReadOnly: true;
    commitsAreCasBound: true;
    replayRequiresPersistedDigest: true;
    decisionTraceLinksAudited: true;
    unknownCommandsFailClosed: true;
  };
};

export type AgentSourceRefKind =
  | "world"
  | "brief"
  | "event"
  | "candidate"
  | "case"
  | "agent"
  | "observation"
  | "memory"
  | "intervention"
  | "package";

export type AgentSourceReference = {
  ref: string;
  kind: AgentSourceRefKind | "unknown";
  id: string;
  resolved: boolean;
};

export const AGENT_INTERVENTION_KINDS = [
  "goal",
  "location",
  "resource",
  "relationship-pressure",
  "knowledge",
  "action-bias"
] as const;

export type AgentInterventionInput = {
  actorId?: unknown;
  kind?: unknown;
  value?: unknown;
};

/** Parse the intentionally small source-reference grammar used by Agent v1. */
export function parseAgentSourceRef(value: string): { kind: AgentSourceRefKind; id: string } | null {
  const separator = value.indexOf(":");
  if (separator <= 0 || separator === value.length - 1) return null;
  const kind = value.slice(0, separator) as AgentSourceRefKind;
  const id = value.slice(separator + 1);
  if (![
    "world",
    "brief",
    "event",
    "candidate",
    "case",
    "agent",
    "observation",
    "memory",
    "intervention",
    "package"
  ].includes(kind)) return null;
  return { kind, id };
}

/** Resolve references against a route-provided immutable source index. */
export function resolveAgentSourceRefs(input: {
  sourceRefs: string[];
  availableRefs: Iterable<string>;
}) {
  const available = new Set(input.availableRefs);
  const references: AgentSourceReference[] = input.sourceRefs.map((ref) => {
    const parsed = parseAgentSourceRef(ref);
    return parsed
      ? { ref, kind: parsed.kind, id: parsed.id, resolved: available.has(ref) }
      : { ref, kind: "unknown", id: ref, resolved: false };
  });
  return {
    ok: references.every((reference) => reference.resolved),
    references,
    unresolved: references.filter((reference) => !reference.resolved).map((reference) => reference.ref)
  };
}

export function validateAgentIntervention(input: AgentInterventionInput, actorIds?: Iterable<string>): string[] {
  const errors: string[] = [];
  if (typeof input.actorId !== "string" || !input.actorId.trim()) errors.push("intervention.actorId is required.");
  if (typeof input.kind !== "string" || !(AGENT_INTERVENTION_KINDS as readonly string[]).includes(input.kind)) {
    errors.push("intervention.kind is outside the agent control contract.");
  }
  if (!Object.prototype.hasOwnProperty.call(input, "value") || !["string", "number", "boolean"].includes(typeof input.value)) {
    errors.push("intervention.value must be a string, number, or boolean.");
  } else if (typeof input.value === "string" && (input.value.length === 0 || input.value.length > 240)) {
    errors.push("intervention.value must contain 1-240 characters.");
  } else if (typeof input.value === "number" && !Number.isFinite(input.value)) {
    errors.push("intervention.value number must be finite.");
  }
  if (actorIds && typeof input.actorId === "string" && !new Set(actorIds).has(input.actorId)) {
    errors.push("intervention actor is not present in the world.");
  }
  return errors;
}

const COMMANDS: AgentControlCommandDescriptor[] = [
  {
    id: "observe.runtime-status",
    phase: "observe",
    method: "GET",
    path: "/api/v1/query/runtime/status",
    auth: "public",
    mutates: false,
    requiresRevision: false,
    requiresSourceRefs: false,
    status: "implemented"
  },
  {
    id: "observe.town-brief",
    phase: "observe",
    method: "GET",
    path: "/api/v1/query/town/brief?worldId={worldId}",
    auth: "public",
    mutates: false,
    requiresRevision: false,
    requiresSourceRefs: false,
    status: "implemented"
  },
  {
    id: "observe.agents",
    phase: "observe",
    method: "GET",
    path: "/api/v1/query/town/agents?worldId={worldId}",
    auth: "public",
    mutates: false,
    requiresRevision: false,
    requiresSourceRefs: false,
    status: "implemented"
  },
  {
    id: "observe.agent",
    phase: "observe",
    method: "GET",
    path: "/api/v1/query/town/agent?worldId={worldId}&npcId={npcId}",
    auth: "public",
    mutates: false,
    requiresRevision: false,
    requiresSourceRefs: false,
    status: "implemented"
  },
  {
    id: "observe.proposal-receipt",
    phase: "observe",
    method: "GET",
    path: "/api/v1/query/town/agent/proposal?worldId={worldId}&proposalId={proposalId}",
    auth: "admin",
    mutates: false,
    requiresRevision: false,
    requiresSourceRefs: false,
    status: "implemented"
  },
  {
    id: "propose.intervention",
    phase: "propose",
    method: "POST",
    path: "/api/v1/command/town/agent/propose",
    auth: "admin",
    mutates: false,
    requiresRevision: true,
    requiresSourceRefs: true,
    status: "implemented"
  },
  {
    id: "commit.intervention",
    phase: "commit",
    method: "POST",
    path: "/api/v1/command/town/agent/commit",
    auth: "admin",
    mutates: true,
    requiresRevision: true,
    requiresSourceRefs: true,
    status: "implemented"
  },
  {
    id: "commit.population-flow",
    phase: "commit",
    method: "POST",
    path: "/api/v1/command/town/agent/population-flow",
    auth: "admin",
    mutates: true,
    requiresRevision: true,
    requiresSourceRefs: true,
    status: "implemented"
  },
  {
    id: "commit.case-extract",
    phase: "commit",
    method: "POST",
    path: "/api/v1/command/town/agent/case-extract",
    auth: "admin",
    mutates: true,
    requiresRevision: true,
    requiresSourceRefs: true,
    status: "implemented"
  },
  {
    id: "review.case",
    phase: "review",
    method: "POST",
    path: "/api/v1/command/town/agent/review",
    auth: "admin",
    mutates: false,
    requiresRevision: true,
    requiresSourceRefs: true,
    status: "implemented"
  },
  {
    id: "benchmark.emergence",
    phase: "benchmark",
    method: "POST",
    path: "/api/v1/command/town/agent/benchmark",
    auth: "admin",
    mutates: false,
    requiresRevision: true,
    requiresSourceRefs: true,
    status: "implemented"
  },
  {
    id: "package.export",
    phase: "package",
    method: "POST",
    path: "/api/v1/command/town/agent/package-export",
    auth: "admin",
    mutates: false,
    requiresRevision: true,
    requiresSourceRefs: true,
    status: "implemented"
  },
  {
    id: "replay.execute",
    phase: "replay",
    method: "POST",
    path: "/api/v1/command/town/replay/execute",
    auth: "admin",
    mutates: false,
    requiresRevision: false,
    requiresSourceRefs: false,
    status: "implemented"
  },
  {
    id: "package.world",
    phase: "package",
    method: "POST",
    path: "/api/v1/command/town/world-pack/export",
    auth: "admin",
    mutates: false,
    requiresRevision: false,
    requiresSourceRefs: false,
    status: "implemented"
  }
];

/** Return a copy so callers cannot mutate the process-wide command catalog. */
export function buildTownAgentControlManifest(runtime?: PersistentTownRuntime | null): AgentControlManifest {
  return {
    schema: AGENT_CONTROL_SCHEMA,
    protocolVersion: "v1",
    sourceOfTruth: "persistent-town",
    compatibility: buildWorldReplayCompatibility(runtime),
    commands: COMMANDS.map((command) => ({ ...command })),
    invariants: {
      observationReadOnly: true,
      commitsAreCasBound: true,
      replayRequiresPersistedDigest: true,
      decisionTraceLinksAudited: true,
      unknownCommandsFailClosed: true
    }
  };
}

export function validateAgentControlMetadata(input: {
  actionId?: unknown;
  expectedRevision?: unknown;
  reason?: unknown;
  sourceRefs?: unknown;
}): string[] {
  const errors: string[] = [];
  if (typeof input.actionId !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,127}$/.test(input.actionId)) {
    errors.push("actionId must be 3-128 characters using letters, numbers, '.', '_', ':', or '-'.");
  }
  if (typeof input.expectedRevision !== "string" || !input.expectedRevision.trim()) errors.push("expectedRevision is required.");
  if (typeof input.reason !== "string" || input.reason.trim().length < 3 || input.reason.length > 500) errors.push("reason must be 3-500 characters.");
  if (!Array.isArray(input.sourceRefs) || input.sourceRefs.length < 1 || input.sourceRefs.length > 12 || input.sourceRefs.some((value) => typeof value !== "string" || !value.trim() || value.length > 240)) {
    errors.push("sourceRefs must contain 1-12 non-empty strings of at most 240 characters.");
  }
  return errors;
}
