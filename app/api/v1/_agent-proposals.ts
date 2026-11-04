import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  type AgentSourceReference,
  type TownRuntimeIntervention,
  type WorldReplayCompatibility
} from "@/lib/engine";

export const AGENT_PROPOSAL_RECEIPT_SCHEMA = "agent-proposal-receipt.v1" as const;

export type AgentProposalReceipt = {
  schema: typeof AGENT_PROPOSAL_RECEIPT_SCHEMA;
  proposalId: string;
  receiptHash: string;
  worldId: string;
  actionId: string;
  expectedRevision: string;
  reason: string;
  sourceRefs: AgentSourceReference[];
  intervention: Pick<TownRuntimeIntervention, "actorId" | "kind" | "value">;
  world: {
    id: string;
    tick: number;
    status: string;
    revision: string;
  };
  compatibility: WorldReplayCompatibility;
  status: "validated";
  committable: true;
  createdAt: string;
};

type AgentProposalInput = {
  worldId: string;
  actionId: string;
  expectedRevision: string;
  reason: string;
  sourceRefs: AgentSourceReference[];
  intervention: Pick<TownRuntimeIntervention, "actorId" | "kind" | "value">;
  world: AgentProposalReceipt["world"];
  compatibility: WorldReplayCompatibility;
};

const STORE_DIR = path.join(process.cwd(), "data", "replay-store", "agent-proposals");

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashPayload(value: unknown) {
  return crypto.createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function receiptPath(proposalId: string) {
  if (!/^proposal-[a-f0-9]{24,64}$/.test(proposalId)) return null;
  return path.join(STORE_DIR, `${proposalId}.json`);
}

function receiptPayload(input: AgentProposalInput) {
  return {
    schema: AGENT_PROPOSAL_RECEIPT_SCHEMA,
    worldId: input.worldId,
    actionId: input.actionId,
    expectedRevision: input.expectedRevision,
    reason: input.reason,
    sourceRefs: input.sourceRefs,
    intervention: input.intervention,
    world: input.world,
    compatibility: input.compatibility
  };
}

function normalizeReceipt(value: unknown): AgentProposalReceipt | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const receipt = value as Partial<AgentProposalReceipt>;
  if (
    receipt.schema !== AGENT_PROPOSAL_RECEIPT_SCHEMA ||
    typeof receipt.proposalId !== "string" ||
    typeof receipt.receiptHash !== "string" ||
    typeof receipt.worldId !== "string" ||
    typeof receipt.actionId !== "string" ||
    typeof receipt.expectedRevision !== "string" ||
    typeof receipt.reason !== "string" ||
    !Array.isArray(receipt.sourceRefs) ||
    !receipt.intervention ||
    !receipt.world ||
    !receipt.compatibility ||
    receipt.status !== "validated" ||
    receipt.committable !== true
  ) return null;
  const payload = {
    schema: AGENT_PROPOSAL_RECEIPT_SCHEMA,
    worldId: receipt.worldId,
    actionId: receipt.actionId,
    expectedRevision: receipt.expectedRevision,
    reason: receipt.reason,
    sourceRefs: receipt.sourceRefs,
    intervention: receipt.intervention,
    world: receipt.world,
    compatibility: receipt.compatibility
  };
  const receiptHash = hashPayload(payload);
  if (receipt.receiptHash !== receiptHash || receipt.proposalId !== `proposal-${receiptHash.slice(0, 32)}`) return null;
  return receipt as AgentProposalReceipt;
}

export function buildAgentProposalReceipt(input: AgentProposalInput) {
  const payload = receiptPayload(input);
  const receiptHash = hashPayload(payload);
  const proposalId = `proposal-${receiptHash.slice(0, 32)}`;
  return {
    ...payload,
    proposalId,
    receiptHash,
    status: "validated" as const,
    committable: true as const,
    createdAt: new Date().toISOString()
  } satisfies AgentProposalReceipt;
}

/** Persist a deterministic proposal receipt without changing authoritative world state. */
export function saveAgentProposalReceipt(input: AgentProposalInput) {
  const candidate = buildAgentProposalReceipt(input);
  const target = receiptPath(candidate.proposalId);
  if (!target) throw new Error("Invalid proposal receipt id.");
  fs.mkdirSync(STORE_DIR, { recursive: true });
  if (fs.existsSync(target)) {
    const existing = normalizeReceipt(JSON.parse(fs.readFileSync(target, "utf8")));
    if (!existing || existing.receiptHash !== candidate.receiptHash) {
      throw new Error("PROPOSAL_RECEIPT_COLLISION: Existing receipt does not match the proposed payload.");
    }
    return { receipt: existing, replayed: true };
  }
  fs.writeFileSync(target, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
  return { receipt: candidate, replayed: false };
}

export function loadAgentProposalReceipt(proposalId: string) {
  const target = receiptPath(proposalId);
  if (!target || !fs.existsSync(target)) return null;
  try {
    return normalizeReceipt(JSON.parse(fs.readFileSync(target, "utf8")));
  } catch {
    return null;
  }
}

export function proposalReceiptMatches(input: {
  receipt: AgentProposalReceipt;
  worldId: string;
  actionId: string;
  expectedRevision: string;
  reason: string;
  sourceRefs: string[];
  intervention: Pick<TownRuntimeIntervention, "actorId" | "kind" | "value">;
}) {
  return input.receipt.worldId === input.worldId
    && input.receipt.actionId === input.actionId
    && input.receipt.expectedRevision === input.expectedRevision
    && input.receipt.reason === input.reason
    && JSON.stringify(input.receipt.sourceRefs.map((ref) => ref.ref)) === JSON.stringify(input.sourceRefs)
    && JSON.stringify(input.receipt.intervention) === JSON.stringify(input.intervention);
}
