import type {
  PersistentTownRuntime,
  TownCaseType,
  WorldLeadCaseHandoff,
  WorldLeadFocus
} from "../persistent-town";

export const MAX_CANDIDATE_INFLUENCE_BONUS = 3;

export type CandidateInfluenceSource = "world-lead-handoff" | "world-arc" | "world-pressure";

export type CandidateInfluenceEntry = {
  source: CandidateInfluenceSource;
  weight: number;
  label: string;
};

export type CandidateInfluenceLedger = {
  caseType?: TownCaseType;
  entries: CandidateInfluenceEntry[];
  rawTotal: number;
  total: number;
  maximumAbsoluteBonus: number;
  clamped: boolean;
};

export type WorldInfluenceBudgetPublicSummary = {
  status: "active" | "empty";
  sourceCount: number;
  sourceLabel: string;
  directionLabel: string;
  strengthLabel: "none" | "light" | "bounded";
  maximumAbsoluteBonus: number;
  nextAction: string;
};

const WORLD_LEAD_HANDOFF_CASE_TYPE: Record<WorldLeadFocus, TownCaseType> = {
  search: "evidence-tampering",
  question: "false-testimony",
  challenge: "court-intimidation"
};

function currentWorldArc(runtime: PersistentTownRuntime | null | undefined) {
  const lineId = runtime?.worldArcProgress?.currentLineId;
  return lineId ? runtime?.worldArcProgress?.lines[lineId] : undefined;
}

export function deriveWorldLeadHandoffInfluence(handoff: WorldLeadCaseHandoff | null | undefined, caseType?: TownCaseType): CandidateInfluenceEntry | undefined {
  if (!handoff || handoff.status !== "ready" || !caseType || WORLD_LEAD_HANDOFF_CASE_TYPE[handoff.focus] !== caseType) return undefined;
  return { source: "world-lead-handoff", weight: 2, label: "Next-case follow-up" };
}

export function deriveWorldLeadHandoffCandidateInfluence(runtime: PersistentTownRuntime | null | undefined, caseType?: TownCaseType) {
  return deriveWorldLeadHandoffInfluence(runtime?.worldLeadCaseHandoff, caseType);
}

export function deriveWorldArcCandidateInfluence(runtime: PersistentTownRuntime | null | undefined, caseType?: TownCaseType): CandidateInfluenceEntry | undefined {
  const arc = currentWorldArc(runtime);
  if (!arc || arc.status !== "active" || arc.completedStages < 1 || !caseType || !arc.compatibleCaseTypeIds.includes(caseType)) return undefined;
  const weight = Math.min(1, runtime?.worldSystemHints?.caseTypeBias[caseType] || 0);
  return weight > 0 ? { source: "world-arc", weight, label: "Active world line" } : undefined;
}

export function deriveWorldPressureCandidateInfluence(runtime: PersistentTownRuntime | null | undefined, caseType?: string): CandidateInfluenceEntry | undefined {
  if (!runtime || !caseType) return undefined;
  const rawWeight = (runtime.worldPressurePulses?.items || [])
    .filter((item) => item.layers > 0 && item.caseTypeIds.includes(caseType))
    .reduce((sum, item) => sum + (item.direction === "rising" ? item.layers : -item.layers), 0);
  const weight = Math.max(-2, Math.min(2, rawWeight));
  return weight === 0 ? undefined : { source: "world-pressure", weight, label: "World pressure" };
}

export function deriveCandidateInfluenceLedger(runtime: PersistentTownRuntime | null | undefined, caseType?: TownCaseType): CandidateInfluenceLedger {
  const entries = [
    deriveWorldLeadHandoffCandidateInfluence(runtime, caseType),
    deriveWorldArcCandidateInfluence(runtime, caseType),
    deriveWorldPressureCandidateInfluence(runtime, caseType)
  ].filter((entry): entry is CandidateInfluenceEntry => Boolean(entry));
  const rawTotal = entries.reduce((total, entry) => total + entry.weight, 0);
  const total = Math.max(-MAX_CANDIDATE_INFLUENCE_BONUS, Math.min(MAX_CANDIDATE_INFLUENCE_BONUS, rawTotal));
  return {
    caseType,
    entries,
    rawTotal,
    total,
    maximumAbsoluteBonus: MAX_CANDIDATE_INFLUENCE_BONUS,
    clamped: total !== rawTotal
  };
}

export function deriveCandidateInfluenceBudget(runtime: PersistentTownRuntime | null | undefined, caseType?: TownCaseType) {
  return deriveCandidateInfluenceLedger(runtime, caseType).total;
}

export function toWorldInfluenceBudgetPublicSummary(runtime: PersistentTownRuntime): WorldInfluenceBudgetPublicSummary {
  const handoffActive = runtime.worldLeadCaseHandoff?.status === "ready";
  const arc = currentWorldArc(runtime);
  const arcActive = Boolean(arc && arc.status === "active" && arc.completedStages >= 1);
  const activePressure = (runtime.worldPressurePulses?.items || []).filter((item) => item.layers > 0);
  const sourceLabels = [
    handoffActive ? "next-case follow-up" : "",
    arcActive ? "world line" : "",
    activePressure.length ? "world pressure" : ""
  ].filter(Boolean);
  if (!sourceLabels.length) {
    return {
      status: "empty",
      sourceCount: 0,
      sourceLabel: "No active influence",
      directionLabel: "Existing candidate order",
      strengthLabel: "none",
      maximumAbsoluteBonus: MAX_CANDIDATE_INFLUENCE_BONUS,
      nextAction: "Future cases continue through the existing eligibility and fairness rules."
    };
  }
  const pressureDirections = new Set(activePressure.map((item) => item.direction));
  const directionLabel = pressureDirections.size > 1
    ? "Mixed bounded influence"
    : pressureDirections.has("relief")
      ? "Support with counter-pressure"
      : "Focused bounded support";
  return {
    status: "active",
    sourceCount: sourceLabels.length,
    sourceLabel: sourceLabels.join(" / "),
    directionLabel,
    strengthLabel: sourceLabels.length === 1 ? "light" : "bounded",
    maximumAbsoluteBonus: MAX_CANDIDATE_INFLUENCE_BONUS,
    nextAction: "Choose any legal case; the unified budget can reorder but never remove candidates or change case truth."
  };
}
