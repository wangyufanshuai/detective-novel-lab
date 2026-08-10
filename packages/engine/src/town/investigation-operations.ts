import type { PersistentTownRuntime, WorldLeadFocus } from "../persistent-town";
import { invalidateTownCandidateCache } from "./cases";
import {
  INVESTIGATION_OPERATION_SUPPORT_CAPACITY,
  PLAYER_RESOURCE_COMMITMENT_CONFIGS,
  activeInvestigationOperationsAuthority,
  applyPlayerResourceCommitmentDecision,
  bindInvestigationOperationsAuthority,
  consumePlayerResourceCommitment,
  investigationOperationsPlanForCase,
  investigationOperationsAuthorityForSession,
  playerResourceCommitmentPublicOptions,
  playerResourceCommitmentsForCase,
  releaseUnusedPlayerResourceCommitments,
  settleInvestigationOperationsAuthority,
  toPlayerResourceCommitmentPublicSummary,
  type InvestigationOperationsPlan,
  type PlayerResourceCommitmentChoice,
  type PlayerResourceCommitmentPublicSummary
} from "./player-resource-commitment";

export type InvestigationOperationsDecisionInput = {
  sessionId: string;
  caseId: string;
  caseSceneLocationId?: string;
  allocations: WorldLeadFocus[];
};

const LANES: WorldLeadFocus[] = ["search", "question", "challenge"];
const MAX_OPERATION_PLANS = 32;

function choiceForLane(lane: WorldLeadFocus) {
  return PLAYER_RESOURCE_COMMITMENT_CONFIGS.find((item) => item.lane === lane)?.choice;
}

function retainPlans(items: InvestigationOperationsPlan[]) {
  const active = items.filter((item) => item.status !== "settled");
  const settled = items
    .filter((item) => item.status === "settled")
    .sort((left, right) => right.updatedAtTick - left.updatedAtTick || right.sessionId.localeCompare(left.sessionId))
    .slice(0, Math.max(0, MAX_OPERATION_PLANS - active.length));
  return [...active, ...settled]
    .sort((left, right) => left.updatedAtTick - right.updatedAtTick || left.sessionId.localeCompare(right.sessionId))
    .slice(-MAX_OPERATION_PLANS);
}

function storePlan(runtime: PersistentTownRuntime, plan: InvestigationOperationsPlan) {
  const state = runtime.playerResourceCommitments || { items: [] };
  const operations = (state.operations || []).filter((item) => item.cycleKey !== plan.cycleKey);
  runtime.playerResourceCommitments = { ...state, operations: retainPlans([...operations, plan]) };
  runtime.playerResourceCommitmentSummary = toPlayerResourceCommitmentPublicSummary(runtime, {
    sessionId: plan.sessionId,
    caseId: plan.caseId
  });
  runtime.updatedAt = new Date().toISOString();
  return runtime.playerResourceCommitmentSummary;
}

function normalizeAllocations(allocations: WorldLeadFocus[]) {
  return LANES.filter((lane) => allocations.includes(lane));
}

export function applyInvestigationOperationsDecision(
  runtime: PersistentTownRuntime,
  input: InvestigationOperationsDecisionInput
): PlayerResourceCommitmentPublicSummary | undefined {
  const authority = bindInvestigationOperationsAuthority(runtime, input);
  if (!authority) return undefined;
  const requested = normalizeAllocations(input.allocations || []);
  if (requested.length !== new Set(input.allocations || []).size || requested.length > INVESTIGATION_OPERATION_SUPPORT_CAPACITY) return undefined;
  const current = playerResourceCommitmentsForCase(runtime, input.sessionId, input.caseId);
  const usedLanes = Array.from(new Set(current.filter((item) => item.status === "used" && item.lane).map((item) => item.lane!)));
  if (usedLanes.some((lane) => !requested.includes(lane))) return undefined;
  const reservedLanes = Array.from(new Set(current.filter((item) => item.status === "reserved" && item.lane).map((item) => item.lane!)));
  const additions = requested.filter((lane) => !usedLanes.includes(lane) && !reservedLanes.includes(lane));
  const options = playerResourceCommitmentPublicOptions(runtime);
  if (additions.some((lane) => !options.find((item) => item.lane === lane)?.available)) return undefined;

  const releases = reservedLanes.filter((lane) => !requested.includes(lane));
  if (releases.length) releaseUnusedPlayerResourceCommitments(runtime, { sessionId: input.sessionId, caseId: input.caseId, lanes: releases });
  for (const lane of additions) {
    const choice = choiceForLane(lane);
    if (!choice) return undefined;
    const reserved = applyPlayerResourceCommitmentDecision(runtime, {
      cycleKey: authority.cycleKey,
      sessionId: input.sessionId,
      caseId: input.caseId,
      caseSceneLocationId: input.caseSceneLocationId,
      choice
    }, { allowMultiple: true });
    if (!reserved) return undefined;
  }

  const existing = investigationOperationsPlanForCase(runtime, input.sessionId, input.caseId);
  const plan: InvestigationOperationsPlan = {
    cycleKey: authority.cycleKey,
    sessionId: input.sessionId,
    caseId: input.caseId,
    caseSceneLocationId: input.caseSceneLocationId || existing?.caseSceneLocationId,
    status: existing?.actions.length ? "active" : "planned",
    selectedLanes: requested,
    actions: existing?.actions || [],
    createdAtTick: existing?.createdAtTick ?? runtime.tick,
    updatedAtTick: runtime.tick
  };
  return storePlan(runtime, plan);
}

export function recordInvestigationOperationStep(
  runtime: PersistentTownRuntime,
  input: { sessionId: string; caseId: string; lane: WorldLeadFocus; caseSceneLocationId?: string }
) {
  const authority = bindInvestigationOperationsAuthority(runtime, input);
  if (!authority) return undefined;
  const existing = investigationOperationsPlanForCase(runtime, input.sessionId, input.caseId);
  if (existing?.actions.some((item) => item.lane === input.lane)) {
    return toPlayerResourceCommitmentPublicSummary(runtime, input);
  }
  const before = playerResourceCommitmentsForCase(runtime, input.sessionId, input.caseId)
    .find((item) => item.status === "reserved" && item.lane === input.lane);
  if (before) consumePlayerResourceCommitment(runtime, input);
  const after = playerResourceCommitmentsForCase(runtime, input.sessionId, input.caseId)
    .find((item) => item.status === "used" && item.lane === input.lane);
  const supported = Boolean(before && after);
  const selectedLanes = Array.from(new Set([
    ...(existing?.selectedLanes || []),
    ...playerResourceCommitmentsForCase(runtime, input.sessionId, input.caseId)
      .filter((item) => item.lane && (item.status === "reserved" || item.status === "used"))
      .map((item) => item.lane!)
  ]));
  const plan: InvestigationOperationsPlan = {
    cycleKey: authority.cycleKey,
    sessionId: input.sessionId,
    caseId: input.caseId,
    caseSceneLocationId: input.caseSceneLocationId || existing?.caseSceneLocationId || before?.caseSceneLocationId,
    status: "active",
    selectedLanes,
    actions: [...(existing?.actions || []), {
      lane: input.lane,
      mode: supported ? "supported" : "manual-first",
      timeBlocks: supported ? 1 : 2,
      resourceAmount: after?.amount || 0,
      completedAtTick: runtime.tick
    }],
    createdAtTick: existing?.createdAtTick ?? runtime.tick,
    updatedAtTick: runtime.tick
  };
  return storePlan(runtime, plan);
}

function applyTempoPressure(runtime: PersistentTownRuntime, plan: InvestigationOperationsPlan) {
  if (!plan.caseSceneLocationId || !plan.actions.length) return 0;
  const totalBlocks = plan.actions.reduce((total, item) => total + item.timeBlocks, 0);
  const intendedDelta = totalBlocks <= 4 ? -1 : totalBlocks >= 6 ? 1 : 0;
  let actualDelta = 0;
  runtime.locationProfiles = (runtime.locationProfiles || []).map((profile) => {
    if (profile.locationId !== plan.caseSceneLocationId || intendedDelta === 0) return profile;
    const next = Math.max(0, Math.min(100, profile.resourcePressure + intendedDelta));
    actualDelta = next - profile.resourcePressure;
    return { ...profile, resourcePressure: next, updatedAtTick: runtime.tick };
  });
  if (actualDelta) invalidateTownCandidateCache(runtime);
  return actualDelta;
}

export function settleInvestigationOperations(
  runtime: PersistentTownRuntime,
  input: { sessionId?: string; caseId: string; accepted: boolean }
) {
  const authority = input.sessionId
    ? investigationOperationsAuthorityForSession(runtime, { sessionId: input.sessionId, caseId: input.caseId })
    : activeInvestigationOperationsAuthority(runtime, input.caseId);
  if (!authority || authority.status !== "active") return undefined;
  const activeAuthority = activeInvestigationOperationsAuthority(runtime, input.caseId);
  if (input.accepted && activeAuthority?.cycleKey !== authority.cycleKey) return undefined;
  const released = releaseUnusedPlayerResourceCommitments(runtime, { sessionId: authority.sessionId, caseId: input.caseId });
  const plan = investigationOperationsPlanForCase(runtime, authority.sessionId, input.caseId);
  if (!plan) {
    settleInvestigationOperationsAuthority(runtime, authority);
    return released || toPlayerResourceCommitmentPublicSummary(runtime, { sessionId: authority.sessionId, caseId: input.caseId });
  }
  if (plan.status === "settled") return toPlayerResourceCommitmentPublicSummary(runtime, { sessionId: plan.sessionId, caseId: plan.caseId });
  const appliedTempoPressureDelta = input.accepted ? applyTempoPressure(runtime, plan) : 0;
  const summary = storePlan(runtime, {
    ...plan,
    status: "settled",
    updatedAtTick: runtime.tick,
    settledAtTick: runtime.tick,
    appliedTempoPressureDelta,
    settlementKind: input.accepted ? "accepted" : "case-switch"
  });
  settleInvestigationOperationsAuthority(runtime, authority);
  runtime.playerResourceCommitmentSummary = toPlayerResourceCommitmentPublicSummary(runtime, { sessionId: authority.sessionId, caseId: input.caseId });
  return runtime.playerResourceCommitmentSummary || summary;
}
