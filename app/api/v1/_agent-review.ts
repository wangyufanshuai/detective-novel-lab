import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  AgentSourceReference,
  InvestigationRoomProjection,
  PlayableCaseRouteIntegrity,
  WorldReplayCompatibility
} from "@/lib/engine";

export const AGENT_CASE_REVIEW_RECEIPT_SCHEMA = "agent-case-review-receipt.v1" as const;

export type AgentCaseReview = {
  routeIntegrity: PlayableCaseRouteIntegrity;
  roomProjection: InvestigationRoomProjection;
  sourceCounts: {
    events: number;
    memories: number;
    observations: number;
    evidence: number;
  };
  routeCertificate: {
    routeCertified: boolean;
    stepCount: number;
    blockerCount: number;
  };
  proofCoverage: {
    complete: boolean;
    coverageRatio: number;
    coveredObligationCount: number;
    totalObligationCount: number;
  };
};

export type AgentCaseReviewReceipt = {
  schema: typeof AGENT_CASE_REVIEW_RECEIPT_SCHEMA;
  reviewId: string;
  receiptHash: string;
  worldId: string;
  actionId: string;
  expectedRevision: string;
  reason: string;
  sourceRefs: AgentSourceReference[];
  caseId: string;
  compatibility: WorldReplayCompatibility;
  review: AgentCaseReview;
  createdAt: string;
};

type AgentCaseReviewInput = Omit<AgentCaseReviewReceipt, "reviewId" | "receiptHash" | "createdAt">;

const STORE_DIR = path.join(process.cwd(), "data", "replay-store", "agent-case-reviews");

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

function receiptPayload(input: AgentCaseReviewInput) {
  return {
    schema: AGENT_CASE_REVIEW_RECEIPT_SCHEMA,
    worldId: input.worldId,
    actionId: input.actionId,
    expectedRevision: input.expectedRevision,
    reason: input.reason,
    sourceRefs: input.sourceRefs,
    caseId: input.caseId,
    compatibility: input.compatibility,
    review: input.review
  };
}

function receiptPath(worldId: string, actionId: string) {
  return path.join(STORE_DIR, `review-${hashPayload({ schema: AGENT_CASE_REVIEW_RECEIPT_SCHEMA, worldId, actionId })}.json`);
}

function normalizeReceipt(value: unknown): AgentCaseReviewReceipt | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const receipt = value as Partial<AgentCaseReviewReceipt>;
  if (
    receipt.schema !== AGENT_CASE_REVIEW_RECEIPT_SCHEMA
    || typeof receipt.reviewId !== "string"
    || typeof receipt.receiptHash !== "string"
    || typeof receipt.worldId !== "string"
    || typeof receipt.actionId !== "string"
    || typeof receipt.expectedRevision !== "string"
    || typeof receipt.reason !== "string"
    || !Array.isArray(receipt.sourceRefs)
    || typeof receipt.caseId !== "string"
    || !receipt.compatibility
    || !receipt.review
  ) return null;
  const payload = receiptPayload(receipt as AgentCaseReviewInput);
  const receiptHash = hashPayload(payload);
  if (receipt.receiptHash !== receiptHash || receipt.reviewId !== `review-${receiptHash.slice(0, 32)}`) return null;
  return receipt as AgentCaseReviewReceipt;
}

export function saveAgentCaseReviewReceipt(input: AgentCaseReviewInput) {
  const payload = receiptPayload(input);
  const receiptHash = hashPayload(payload);
  const candidate: AgentCaseReviewReceipt = {
    ...payload,
    reviewId: `review-${receiptHash.slice(0, 32)}`,
    receiptHash,
    createdAt: new Date().toISOString()
  };
  fs.mkdirSync(STORE_DIR, { recursive: true });
  const target = receiptPath(input.worldId, input.actionId);
  if (fs.existsSync(target)) {
    const existing = normalizeReceipt(JSON.parse(fs.readFileSync(target, "utf8")));
    if (!existing || existing.receiptHash !== candidate.receiptHash) {
      throw new Error("AGENT_CASE_REVIEW_CONFLICT: actionId is already bound to a different review payload.");
    }
    return { receipt: existing, replayed: true };
  }
  fs.writeFileSync(target, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
  return { receipt: candidate, replayed: false };
}

export function loadAgentCaseReviewReceipt(worldId: string, actionId: string) {
  const target = receiptPath(worldId, actionId);
  if (!fs.existsSync(target)) return null;
  try {
    return normalizeReceipt(JSON.parse(fs.readFileSync(target, "utf8")));
  } catch {
    return null;
  }
}
