import { invalidateTownCandidateCache } from "./cases";
import { deriveWorldPressureCandidateInfluence } from "./candidate-influence";
import type { LongActionKind, TownResourceKind, TownRuleRuntimeState } from "./rules";
import type {
  PersistentTownRuntime,
  WorldPressureCascadePublicSummary,
  WorldPressureDirection,
  WorldPressurePulse,
  WorldPressurePulseDerivationInput,
  WorldPressurePulseRuntimeState
} from "../persistent-town";

const WORLD_PRESSURE_FALLBACK_CASE_TYPES: Record<TownResourceKind, string[]> = {
  police_time: ["police-misjudgment", "witness-disappearance", "evidence-tampering"],
  media_attention: ["blackmail", "false-testimony", "ledger-fraud"],
  family_influence: ["family-scandal", "forged-will", "blackmail"],
  merchant_credit: ["ledger-fraud", "dock-smuggling", "blackmail"],
  medical_capacity: ["medical-coverup", "evidence-tampering", "witness-disappearance"],
  evidence_integrity: ["evidence-tampering", "medical-coverup", "witness-disappearance"],
  court_docket: ["court-intimidation", "forged-will", "false-testimony"],
  dock_credit: ["dock-smuggling", "witness-disappearance", "evidence-tampering"],
  informant_trust: ["false-testimony", "witness-disappearance", "blackmail"]
};

function firstResourceCost(runtime: TownRuleRuntimeState, kind: LongActionKind) {
  const definition = runtime.catalogLongActionDefinitions.find((item) => item.kind === kind);
  return Object.entries(definition?.resourceCosts || {})
    .filter(([, amount]) => Math.abs(amount || 0) > 0)
    .sort((left, right) => Math.abs(Number(right[1])) - Math.abs(Number(left[1])) || left[0].localeCompare(right[0]))[0]?.[0] as TownResourceKind | undefined;
}

export type WorldPressureDirectionDeltaInput = {
  evidenceContaminationDelta?: number;
  publicOpinionDelta?: Partial<Record<"heat" | "mediaPressure" | "witnessFear" | "rumorVelocity" | "trustInPolice", number>>;
  institutionPressureDelta?: number;
  resourceAvailableDelta?: number;
  resourcePressureDelta?: number;
  relationshipDelta?: number;
  opportunityDelta?: number;
};

export function deriveWorldPressureDirectionFromActualDeltas(input: WorldPressureDirectionDeltaInput): WorldPressureDirection {
  const contamination = input.evidenceContaminationDelta || 0;
  if (contamination !== 0) return contamination > 0 ? "rising" : "relief";
  for (const field of ["heat", "mediaPressure", "witnessFear", "rumorVelocity"] as const) {
    const value = input.publicOpinionDelta?.[field] || 0;
    if (value !== 0) return value > 0 ? "rising" : "relief";
  }
  const trust = input.publicOpinionDelta?.trustInPolice || 0;
  if (trust !== 0) return trust < 0 ? "rising" : "relief";
  const institutionPressure = input.institutionPressureDelta || 0;
  if (institutionPressure !== 0) return institutionPressure > 0 ? "rising" : "relief";
  const relationship = input.relationshipDelta || 0;
  if (relationship !== 0) return relationship > 0 ? "relief" : "rising";
  const opportunity = input.opportunityDelta || 0;
  if (opportunity !== 0) return opportunity > 0 ? "relief" : "rising";
  const resourceAvailable = input.resourceAvailableDelta || 0;
  if (resourceAvailable !== 0) return resourceAvailable > 0 ? "relief" : "rising";
  const resourcePressure = input.resourcePressureDelta || 0;
  if (resourcePressure !== 0) return resourcePressure < 0 ? "relief" : "rising";
  return "relief";
}

export function deriveCompletedActionWorldPressureDirection(runtime: TownRuleRuntimeState, action: WorldPressurePulseDerivationInput["action"]): WorldPressureDirection {
  const applied = action.appliedResult;
  if (applied) {
    const input = {
      evidenceContaminationDelta: applied.evidenceContaminationDelta,
      publicOpinionDelta: applied.publicOpinionDelta,
      institutionPressureDelta: Object.values(applied.institutionDeltas).reduce((total, delta) => total + delta.pressure, 0)
    };
    if (
      input.evidenceContaminationDelta !== 0
      || input.institutionPressureDelta !== 0
      || Object.values(input.publicOpinionDelta).some((value) => (value || 0) !== 0)
    ) return deriveWorldPressureDirectionFromActualDeltas(input);
  }
  const definition = runtime.catalogLongActionDefinitions.find((item) => item.kind === action.kind);
  return deriveWorldPressureDirectionFromActualDeltas({
    evidenceContaminationDelta: definition?.evidenceContaminationDelta || 0,
    publicOpinionDelta: definition?.publicOpinionDelta || {},
    institutionPressureDelta: Object.values(definition?.institutionDeltas || {}).reduce((total, delta) => total + (delta.pressure || 0), 0)
  });
}

export function deriveWorldPressurePulseFromCompletedAction(input: WorldPressurePulseDerivationInput): WorldPressurePulse {
  const resourceKind = (Object.entries(input.directive?.reservedResources || {})
    .filter(([, amount]) => Number(amount) > 0)
    .sort((left, right) => Number(right[1]) - Number(left[1]) || left[0].localeCompare(right[0]))[0]?.[0] as TownResourceKind | undefined)
    || firstResourceCost(input.runtime, input.action.kind);
  const focusKey = resourceKind || input.action.kind;
  const caseTypeIds = Array.from(new Set([
    ...(input.directive?.focusCaseTypeIds || []),
    ...(resourceKind ? WORLD_PRESSURE_FALLBACK_CASE_TYPES[resourceKind] || [] : [])
  ])).slice(0, 8);
  const focusLabel = input.directive?.focusCaseLabel || resourceKind?.replace(/_/g, " ") || "town pressure";
  return {
    id: `world-pressure-pulse-${input.directive?.id || input.action.id}`,
    focusKey,
    focusLabel,
    affectedCaseLabel: input.directive?.focusCaseLabel || "related case patterns",
    caseTypeIds,
    direction: deriveCompletedActionWorldPressureDirection(input.runtime, input.action),
    sourceDirectiveId: input.directive?.id,
    sourceCaseId: input.directive?.sourceCaseId,
    eventArchetypeId: input.directive?.eventArchetypeId,
    resourceKind,
    institutionId: input.directive?.institutionId,
    longActionKind: input.action.kind,
    createdAtTick: input.tick,
    updatedAtTick: input.tick,
    layers: 1,
    consumedLayers: 0
  };
}

function retainWorldPressurePulseState(state: WorldPressurePulseRuntimeState): WorldPressurePulseRuntimeState {
  const active = state.items
    .filter((item) => item.layers > 0)
    .sort((left, right) => left.createdAtTick - right.createdAtTick || left.id.localeCompare(right.id))
    .slice(-8);
  const history = state.items
    .filter((item) => item.layers <= 0)
    .sort((left, right) => left.updatedAtTick - right.updatedAtTick || left.id.localeCompare(right.id))
    .slice(-8);
  return { ...state, items: [...history, ...active] };
}

export function toWorldPressureCascadePublicSummary(runtime: PersistentTownRuntime): WorldPressureCascadePublicSummary {
  const state = runtime.worldPressurePulses;
  const active = (state?.items || []).filter((item) => item.layers > 0);
  if (!active.length) {
    return {
      status: state?.lastConsumedAtTick !== undefined ? "consumed" : "empty",
      activePulseCount: 0,
      directionLabel: "No active pressure",
      focusLabel: state?.lastConsumedFocusLabel || "No active pressure",
      affectedCaseLabel: "Future cases remain on the existing queue logic.",
      remainingLayers: 0,
      nextAction: state?.lastConsumedAtTick !== undefined
        ? "The latest pressure layer was consumed by a successful case extraction."
        : "Complete a supported faction operation to create a bounded future-case pressure layer."
    };
  }
  const directions = new Set(active.map((item) => item.direction));
  const focusLabels = Array.from(new Set(active.map((item) => item.focusLabel))).slice(0, 3);
  const affectedLabels = Array.from(new Set(active.map((item) => item.affectedCaseLabel))).slice(0, 3);
  return {
    status: "active",
    activePulseCount: active.length,
    directionLabel: directions.size > 1 ? "Mixed pressure directions" : active[0].direction === "rising" ? "Pressure building" : "Pressure easing",
    focusLabel: focusLabels.join(" / "),
    affectedCaseLabel: affectedLabels.join(" / "),
    remainingLayers: active.reduce((total, item) => total + item.layers, 0),
    nextAction: "Extract a future case to consume one bounded pressure layer; the current case remains unchanged."
  };
}

function refreshWorldPressureCascadeSummary(runtime: PersistentTownRuntime) {
  runtime.worldPressureCascadeSummary = toWorldPressureCascadePublicSummary(runtime);
  runtime.updatedAt = new Date().toISOString();
  return runtime.worldPressureCascadeSummary;
}

export function mergeWorldPressurePulse(runtime: PersistentTownRuntime, pulse: WorldPressurePulse) {
  const state = runtime.worldPressurePulses || { items: [] };
  const existing = state.items.find((item) => item.layers > 0 && item.focusKey === pulse.focusKey && item.direction === pulse.direction);
  const items = existing
    ? state.items.map((item) => item.id === existing.id
      ? { ...item, layers: Math.min(3, item.layers + 1), updatedAtTick: pulse.updatedAtTick, caseTypeIds: Array.from(new Set([...item.caseTypeIds, ...pulse.caseTypeIds])).slice(0, 8) }
      : item)
    : [...state.items, pulse];
  runtime.worldPressurePulses = retainWorldPressurePulseState({ ...state, items });
  invalidateTownCandidateCache(runtime);
  return refreshWorldPressureCascadeSummary(runtime);
}

export function consumeWorldPressurePulseOnExtraction(runtime: PersistentTownRuntime, caseId: string) {
  const state = runtime.worldPressurePulses;
  const active = (state?.items || [])
    .filter((item) => item.layers > 0)
    .sort((left, right) => left.createdAtTick - right.createdAtTick || left.id.localeCompare(right.id));
  if (!state || !active.length) return toWorldPressureCascadePublicSummary(runtime);
  const target = active[0];
  runtime.worldPressurePulses = retainWorldPressurePulseState({
    ...state,
    lastConsumedAtTick: runtime.tick,
    lastConsumedCaseId: caseId,
    lastConsumedFocusLabel: target.focusLabel,
    items: state.items.map((item) => item.id === target.id
      ? { ...item, layers: Math.max(0, item.layers - 1), consumedLayers: item.consumedLayers + 1, updatedAtTick: runtime.tick }
      : item)
  });
  invalidateTownCandidateCache(runtime);
  return refreshWorldPressureCascadeSummary(runtime);
}

export function deriveWorldPressureCasePriorityBonus(runtime: PersistentTownRuntime, caseTypeId?: string) {
  return deriveWorldPressureCandidateInfluence(runtime, caseTypeId)?.weight || 0;
}
