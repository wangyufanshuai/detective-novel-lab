import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AgentSourceReference, WorldPackageReceipt } from "@/lib/engine";
import type { WorldPackageExportReport } from "@/lib/world-package-catalog";

export const AGENT_PACKAGE_EXPORT_RECEIPT_SCHEMA = "agent-package-export-receipt.v1" as const;

export type AgentPackageExportReceipt = {
  schema: typeof AGENT_PACKAGE_EXPORT_RECEIPT_SCHEMA;
  receiptId: string;
  receiptHash: string;
  worldId: string;
  actionId: string;
  expectedRevision: string;
  reason: string;
  sourceRefs: AgentSourceReference[];
  packageId: string;
  packageReceipt: WorldPackageReceipt;
  report: WorldPackageExportReport;
  createdAt: string;
};

type AgentPackageExportInput = Omit<AgentPackageExportReceipt, "receiptId" | "receiptHash" | "createdAt">;

const STORE_DIR = path.join(process.cwd(), "data", "replay-store", "agent-package-exports");

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

function receiptPayload(input: AgentPackageExportInput) {
  return {
    schema: AGENT_PACKAGE_EXPORT_RECEIPT_SCHEMA,
    worldId: input.worldId,
    actionId: input.actionId,
    expectedRevision: input.expectedRevision,
    reason: input.reason,
    sourceRefs: input.sourceRefs,
    packageId: input.packageId,
    packageReceipt: input.packageReceipt,
    report: { ...input.report, exportedAt: "" }
  };
}

function receiptPath(worldId: string, actionId: string) {
  return path.join(STORE_DIR, `export-${hashPayload({ schema: AGENT_PACKAGE_EXPORT_RECEIPT_SCHEMA, worldId, actionId })}.json`);
}

function normalizeReceipt(value: unknown): AgentPackageExportReceipt | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const receipt = value as Partial<AgentPackageExportReceipt>;
  if (
    receipt.schema !== AGENT_PACKAGE_EXPORT_RECEIPT_SCHEMA
    || typeof receipt.receiptId !== "string"
    || typeof receipt.receiptHash !== "string"
    || typeof receipt.worldId !== "string"
    || typeof receipt.actionId !== "string"
    || typeof receipt.expectedRevision !== "string"
    || typeof receipt.reason !== "string"
    || !Array.isArray(receipt.sourceRefs)
    || typeof receipt.packageId !== "string"
    || !receipt.packageReceipt
    || !receipt.report
  ) return null;
  const payload = receiptPayload(receipt as AgentPackageExportInput);
  const receiptHash = hashPayload(payload);
  if (receipt.receiptHash !== receiptHash || receipt.receiptId !== `export-${receiptHash.slice(0, 32)}`) return null;
  return receipt as AgentPackageExportReceipt;
}

export function saveAgentPackageExportReceipt(input: AgentPackageExportInput) {
  const payload = receiptPayload(input);
  const receiptHash = hashPayload(payload);
  const candidate: AgentPackageExportReceipt = {
    ...input,
    receiptId: `export-${receiptHash.slice(0, 32)}`,
    receiptHash,
    createdAt: new Date().toISOString()
  };
  fs.mkdirSync(STORE_DIR, { recursive: true });
  const target = receiptPath(input.worldId, input.actionId);
  if (fs.existsSync(target)) {
    const existing = normalizeReceipt(JSON.parse(fs.readFileSync(target, "utf8")));
    if (!existing || existing.receiptHash !== candidate.receiptHash) {
      throw new Error("AGENT_PACKAGE_EXPORT_CONFLICT: actionId is already bound to a different export payload.");
    }
    return { receipt: existing, replayed: true };
  }
  fs.writeFileSync(target, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
  return { receipt: candidate, replayed: false };
}

export function loadAgentPackageExportReceipt(worldId: string, actionId: string) {
  const target = receiptPath(worldId, actionId);
  if (!fs.existsSync(target)) return null;
  try {
    return normalizeReceipt(JSON.parse(fs.readFileSync(target, "utf8")));
  } catch {
    return null;
  }
}

