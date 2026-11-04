import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AgentSourceReference, EmergenceBenchmarkReport, WorldReplayCompatibility } from "@/lib/engine";

export const AGENT_BENCHMARK_RECEIPT_SCHEMA = "agent-benchmark-receipt.v1" as const;

export type AgentBenchmarkReceipt = {
  schema: typeof AGENT_BENCHMARK_RECEIPT_SCHEMA;
  receiptId: string;
  receiptHash: string;
  worldId: string;
  actionId: string;
  expectedRevision: string;
  reason: string;
  sourceRefs: AgentSourceReference[];
  seedCount: 10 | 20;
  compatibility: WorldReplayCompatibility;
  report: EmergenceBenchmarkReport;
  reportHash: string;
  createdAt: string;
};

type AgentBenchmarkInput = Omit<AgentBenchmarkReceipt, "receiptId" | "receiptHash" | "reportHash" | "createdAt">;

const STORE_DIR = path.join(process.cwd(), "data", "replay-store", "agent-benchmarks");

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

function canonicalReport(report: EmergenceBenchmarkReport) {
  return { ...report, generatedAt: "" };
}

function receiptPayload(input: AgentBenchmarkInput, reportHash: string) {
  return {
    schema: AGENT_BENCHMARK_RECEIPT_SCHEMA,
    worldId: input.worldId,
    actionId: input.actionId,
    expectedRevision: input.expectedRevision,
    reason: input.reason,
    sourceRefs: input.sourceRefs,
    seedCount: input.seedCount,
    compatibility: input.compatibility,
    reportHash
  };
}

function receiptPath(worldId: string, actionId: string) {
  return path.join(STORE_DIR, `benchmark-${hashPayload({ schema: AGENT_BENCHMARK_RECEIPT_SCHEMA, worldId, actionId })}.json`);
}

function normalizeReceipt(value: unknown): AgentBenchmarkReceipt | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const receipt = value as Partial<AgentBenchmarkReceipt>;
  if (
    receipt.schema !== AGENT_BENCHMARK_RECEIPT_SCHEMA
    || typeof receipt.receiptId !== "string"
    || typeof receipt.receiptHash !== "string"
    || typeof receipt.worldId !== "string"
    || typeof receipt.actionId !== "string"
    || typeof receipt.expectedRevision !== "string"
    || typeof receipt.reason !== "string"
    || !Array.isArray(receipt.sourceRefs)
    || (receipt.seedCount !== 10 && receipt.seedCount !== 20)
    || !receipt.compatibility
    || !receipt.report
    || typeof receipt.reportHash !== "string"
  ) return null;
  const calculatedReportHash = hashPayload(canonicalReport(receipt.report));
  if (receipt.reportHash !== calculatedReportHash) return null;
  const payload = receiptPayload(receipt as AgentBenchmarkInput, calculatedReportHash);
  const receiptHash = hashPayload(payload);
  if (receipt.receiptHash !== receiptHash || receipt.receiptId !== `benchmark-${receiptHash.slice(0, 32)}`) return null;
  return receipt as AgentBenchmarkReceipt;
}

export function saveAgentBenchmarkReceipt(input: AgentBenchmarkInput) {
  const reportHash = hashPayload(canonicalReport(input.report));
  const payload = receiptPayload(input, reportHash);
  const receiptHash = hashPayload(payload);
  const candidate: AgentBenchmarkReceipt = {
    ...input,
    receiptId: `benchmark-${receiptHash.slice(0, 32)}`,
    receiptHash,
    reportHash,
    createdAt: new Date().toISOString()
  };
  fs.mkdirSync(STORE_DIR, { recursive: true });
  const target = receiptPath(input.worldId, input.actionId);
  if (fs.existsSync(target)) {
    const existing = normalizeReceipt(JSON.parse(fs.readFileSync(target, "utf8")));
    if (!existing || existing.receiptHash !== candidate.receiptHash) {
      throw new Error("AGENT_BENCHMARK_CONFLICT: actionId is already bound to a different benchmark payload.");
    }
    return { receipt: existing, replayed: true };
  }
  fs.writeFileSync(target, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
  return { receipt: candidate, replayed: false };
}

export function loadAgentBenchmarkReceipt(worldId: string, actionId: string) {
  const target = receiptPath(worldId, actionId);
  if (!fs.existsSync(target)) return null;
  try {
    return normalizeReceipt(JSON.parse(fs.readFileSync(target, "utf8")));
  } catch {
    return null;
  }
}

