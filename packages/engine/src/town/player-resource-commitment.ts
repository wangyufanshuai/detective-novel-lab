import { invalidateTownCandidateCache } from "./cases";
import type { PersistentTownRuntime, TownLocationProfile, WorldLeadFocus } from "../persistent-town";
import type { TownResourceKind } from "./rules";
import { factionResourceCommitmentTerms, recordResourceCommitmentFactionRelationship } from "./faction-relationship";
import { investigatorProgressionReserveDiscount } from "./investigator-progression";
import {
  consumeInvestigatorHeadquartersReserveBenefit,
  investigatorHeadquartersReserveDiscount
} from "./investigator-headquarters";

export type PlayerResourceCommitmentChoice = "police-time" | "informant-trust" | "evidence-integrity" | "none";
export type PlayerResourceCommitmentStatus = "ready" | "reserved" | "used" | "released" | "declined" | "blocked";

export type PlayerResourceCommitmentPublicOption = {
  choice: Exclude<PlayerResourceCommitmentChoice, "none">;
  label: string;
  lane: WorldLeadFocus;
  benefitLabel: string;
  costLabel: string;
  available: boolean;
  standingLabel: string;
  reserveCost: number;
  availabilityBand: "ample" | "limited" | "critical" | "unavailable";
};

export type InvestigationOperationMode = "supported" | "manual-first";
export type InvestigationOperationPlanStatus = "ready" | "planned" | "active" | "settled" | "blocked";
export type InvestigationOperationScope = "authoritative" | "practice";

export type InvestigationOperationsAuthority = {
  cycleKey: string;
  caseId: string;
  sessionId: string;
  status: "active" | "settled";
  boundAtTick: number;
  settledAtTick?: number;
};

export type InvestigationOperationRecord = {
  lane: WorldLeadFocus;
  mode: InvestigationOperationMode;
  timeBlocks: number;
  resourceAmount: number;
  completedAtTick: number;
};

export type InvestigationOperationsPlan = {
  cycleKey: string;
  sessionId: string;
  caseId: string;
  caseSceneLocationId?: string;
  status: Exclude<InvestigationOperationPlanStatus, "ready">;
  selectedLanes: WorldLeadFocus[];
  actions: InvestigationOperationRecord[];
  createdAtTick: number;
  updatedAtTick: number;
  settledAtTick?: number;
  appliedTempoPressureDelta?: number;
  settlementKind?: "accepted" | "case-switch";
};

export type InvestigationOperationLanePublicSummary = {
  lane: WorldLeadFocus;
  label: string;
  resourceLabel: string;
  status: "standard" | "reserved" | "used" | "released" | "blocked";
  selected: boolean;
  available: boolean;
  availabilityBand: PlayerResourceCommitmentPublicOption["availabilityBand"];
  reserveCost: number;
  timeCostMinutes: number;
  benefitLabel: string;
  costLabel: string;
};

export type InvestigationOperationActionPublicSummary = {
  lane: WorldLeadFocus;
  mode: InvestigationOperationMode;
  costLabel: string;
  gainLabel: string;
  pressureLabel: string;
  timeLabel: string;
  nextAction: string;
};

export type PlayerResourceCommitmentPublicSummary = {
  scope: InvestigationOperationScope;
  scopeLabel: string;
  status: PlayerResourceCommitmentStatus;
  choice?: PlayerResourceCommitmentChoice;
  lane?: WorldLeadFocus;
  label: string;
  benefitLabel: string;
  costLabel: string;
  progressLabel: string;
  nextAction: string;
  blockedCategory?: "resource unavailable" | "relationship unavailable";
  reserveCost?: number;
  options: PlayerResourceCommitmentPublicOption[];
  planStatus: InvestigationOperationPlanStatus;
  supportCapacity: number;
  supportCount: number;
  completedOperationCount: number;
  townTimeMinutes: number;
  townTimeLabel: string;
  priorityOrder: WorldLeadFocus[];
  laneSummaries: InvestigationOperationLanePublicSummary[];
  lastAction?: InvestigationOperationActionPublicSummary;
};

export type PlayerResourceCommitment = {
  cycleKey?: string;
  sessionId: string;
  caseId: string;
  caseSceneLocationId?: string;
  choice: PlayerResourceCommitmentChoice;
  lane?: WorldLeadFocus;
  resourceKind?: TownResourceKind;
  amount: number;
  status: Exclude<PlayerResourceCommitmentStatus, "ready">;
  selectedAtTick: number;
  usedAtTick?: number;
  releasedAtTick?: number;
  appliedBenefit?: {
    locationResourcePressure?: number;
    witnessFear?: number;
    evidenceContamination?: number;
  };
  blockedCategory?: PlayerResourceCommitmentPublicSummary["blockedCategory"];
};

export type PlayerResourceCommitmentRuntimeState = {
  items: PlayerResourceCommitment[];
  operations?: InvestigationOperationsPlan[];
  authorities?: InvestigationOperationsAuthority[];
};

export type PlayerResourceCommitmentDecisionInput = {
  cycleKey?: string;
  sessionId: string;
  caseId: string;
  caseSceneLocationId?: string;
  choice: PlayerResourceCommitmentChoice;
};

export type PlayerResourceCommitmentConfig = {
  choice: Exclude<PlayerResourceCommitmentChoice, "none">;
  resourceKind: TownResourceKind;
  lane: WorldLeadFocus;
  label: string;
  benefitLabel: string;
  costLabel: string;
};

export const PLAYER_RESOURCE_COMMITMENT_COST = 2;
export const INVESTIGATION_OPERATION_SUPPORT_CAPACITY = 2;
const MAX_PLAYER_RESOURCE_COMMITMENTS = 32;
const MAX_INVESTIGATION_OPERATION_AUTHORITIES = 32;

export const PLAYER_RESOURCE_COMMITMENT_CONFIGS: PlayerResourceCommitmentConfig[] = [
  {
    choice: "police-time",
    resourceKind: "police_time",
    lane: "search",
    label: "Police time",
    benefitLabel: "A completed certified search eases local resource pressure.",
    costLabel: "Reserve 2 capacity now; the reserve is spent only when Search is completed."
  },
  {
    choice: "informant-trust",
    resourceKind: "informant_trust",
    lane: "question",
    label: "Informant trust",
    benefitLabel: "A completed certified question lowers bounded witness fear.",
    costLabel: "Reserve 2 trust now; the reserve is spent only when Question is completed."
  },
  {
    choice: "evidence-integrity",
    resourceKind: "evidence_integrity",
    lane: "challenge",
    label: "Evidence integrity",
    benefitLabel: "A completed certified challenge lowers bounded evidence contamination.",
    costLabel: "Reserve 2 integrity now; the reserve is spent only when Challenge is completed."
  }
];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function configFor(choice?: PlayerResourceCommitmentChoice) {
  return PLAYER_RESOURCE_COMMITMENT_CONFIGS.find((item) => item.choice === choice);
}

export function playerResourceCommitmentConfigFor(choice?: PlayerResourceCommitmentChoice) {
  return configFor(choice);
}

export function playerResourceCommitmentsForCase(runtime: PersistentTownRuntime, sessionId?: string, caseId?: string) {
  return (runtime.playerResourceCommitments?.items || [])
    .filter((item) => (!sessionId || item.sessionId === sessionId) && (!caseId || item.caseId === caseId));
}

export function activeInvestigationOperationsCycleKey(runtime: PersistentTownRuntime, caseId: string) {
  const campaign = runtime.campaignSession;
  return campaign?.activeCaseId === caseId ? campaign.activeCycleKey : undefined;
}

function retainAuthorities(items: InvestigationOperationsAuthority[]) {
  const active = items.filter((item) => item.status === "active");
  const settled = items
    .filter((item) => item.status === "settled")
    .sort((left, right) => right.boundAtTick - left.boundAtTick || right.cycleKey.localeCompare(left.cycleKey))
    .slice(0, Math.max(0, MAX_INVESTIGATION_OPERATION_AUTHORITIES - active.length));
  return [...active, ...settled]
    .sort((left, right) => left.boundAtTick - right.boundAtTick || left.cycleKey.localeCompare(right.cycleKey))
    .slice(-MAX_INVESTIGATION_OPERATION_AUTHORITIES);
}

export function investigationOperationsAuthorityForSession(
  runtime: PersistentTownRuntime,
  input: { sessionId: string; caseId: string }
) {
  return [...(runtime.playerResourceCommitments?.authorities || [])]
    .filter((item) => item.sessionId === input.sessionId && item.caseId === input.caseId)
    .sort((left, right) => right.boundAtTick - left.boundAtTick || right.cycleKey.localeCompare(left.cycleKey))[0];
}

export function activeInvestigationOperationsAuthority(runtime: PersistentTownRuntime, caseId: string) {
  const cycleKey = activeInvestigationOperationsCycleKey(runtime, caseId);
  if (!cycleKey) return undefined;
  return (runtime.playerResourceCommitments?.authorities || [])
    .find((item) => item.cycleKey === cycleKey && item.caseId === caseId && item.status === "active");
}

export function isInvestigationOperationsAuthoritativeSession(
  runtime: PersistentTownRuntime,
  input: { sessionId: string; caseId: string }
) {
  const authority = investigationOperationsAuthorityForSession(runtime, input);
  return Boolean(
    authority?.status === "active" &&
    authority.cycleKey === activeInvestigationOperationsCycleKey(runtime, input.caseId)
  );
}

export function bindInvestigationOperationsAuthority(
  runtime: PersistentTownRuntime,
  input: { sessionId: string; caseId: string }
) {
  const cycleKey = activeInvestigationOperationsCycleKey(runtime, input.caseId);
  if (!cycleKey) return undefined;
  const state = runtime.playerResourceCommitments || { items: [] };
  const existing = (state.authorities || []).find((item) => item.cycleKey === cycleKey);
  if (existing) return existing.sessionId === input.sessionId && existing.status === "active" ? existing : undefined;
  const authority: InvestigationOperationsAuthority = {
    cycleKey,
    caseId: input.caseId,
    sessionId: input.sessionId,
    status: "active",
    boundAtTick: runtime.tick
  };
  runtime.playerResourceCommitments = {
    ...state,
    authorities: retainAuthorities([...(state.authorities || []), authority])
  };
  runtime.updatedAt = new Date().toISOString();
  return authority;
}

export function settleInvestigationOperationsAuthority(runtime: PersistentTownRuntime, authority: InvestigationOperationsAuthority) {
  if (authority.status === "settled") return authority;
  const state = runtime.playerResourceCommitments || { items: [] };
  const settled: InvestigationOperationsAuthority = {
    ...authority,
    status: "settled",
    settledAtTick: runtime.tick
  };
  runtime.playerResourceCommitments = {
    ...state,
    authorities: retainAuthorities((state.authorities || []).map((item) => item.cycleKey === authority.cycleKey ? settled : item))
  };
  runtime.updatedAt = new Date().toISOString();
  return settled;
}

function latestCommitment(runtime: PersistentTownRuntime, sessionId?: string, caseId?: string) {
  return playerResourceCommitmentsForCase(runtime, sessionId, caseId)
    .sort((left, right) => right.selectedAtTick - left.selectedAtTick || (right.lane || "").localeCompare(left.lane || "") || right.sessionId.localeCompare(left.sessionId))[0];
}

export function playerResourceCommitmentPublicOptions(runtime: PersistentTownRuntime): PlayerResourceCommitmentPublicOption[] {
  return PLAYER_RESOURCE_COMMITMENT_CONFIGS.map((config) => {
    const terms = factionResourceCommitmentTerms(runtime, config.resourceKind);
    const discount = investigatorProgressionReserveDiscount(runtime, config.lane) + investigatorHeadquartersReserveDiscount(runtime, config.lane);
    const cost = Math.max(1, terms.cost - discount);
    const availableAmount = runtime.ruleState?.resourceLedger[config.resourceKind]?.available || 0;
    const available = terms.available && availableAmount >= cost;
    return {
      choice: config.choice,
      label: config.label,
      lane: config.lane,
      benefitLabel: config.benefitLabel,
      costLabel: `${terms.standingLabel}. Reserve ${cost} capacity${discount ? " after investigator practice" : ""}; the relationship rate applies only to a future choice.`,
      available,
      standingLabel: terms.standingLabel,
      reserveCost: cost,
      availabilityBand: !available ? "unavailable" : availableAmount === cost ? "critical" : availableAmount <= cost * 2 ? "limited" : "ample"
    };
  });
}

function nextActionFor(status: PlayerResourceCommitmentStatus, lane?: WorldLeadFocus) {
  if (status === "ready") return "Choose one case resource to reserve, or continue without a commitment.";
  if (status === "reserved") return `Complete the next legal certified ${lane || "matching"} step to use the reserve.`;
  if (status === "used") return "The case resource was spent once; continue the unchanged certified route.";
  if (status === "released") return "The unused reserve was returned once; the next case may open a new choice.";
  if (status === "declined") return "Continue the unchanged certified route without a case resource reserve.";
  return "Choose another available resource or continue without a commitment.";
}

export function investigationOperationsPlanForCase(runtime: PersistentTownRuntime, sessionId?: string, caseId?: string) {
  return (runtime.playerResourceCommitments?.operations || [])
    .filter((item) => (!sessionId || item.sessionId === sessionId) && (!caseId || item.caseId === caseId))
    .sort((left, right) => right.updatedAtTick - left.updatedAtTick || right.sessionId.localeCompare(left.sessionId))[0];
}

function commitmentPriority(status: PlayerResourceCommitmentStatus) {
  return status === "used" ? 5 : status === "reserved" ? 4 : status === "blocked" ? 3 : status === "released" ? 2 : status === "declined" ? 1 : 0;
}

export function toPlayerResourceCommitmentPublicSummary(
  runtime: PersistentTownRuntime,
  input: { sessionId?: string; caseId?: string; forceReady?: boolean } = {}
): PlayerResourceCommitmentPublicSummary {
  const exactAuthority = input.sessionId && input.caseId
    ? investigationOperationsAuthorityForSession(runtime, { sessionId: input.sessionId, caseId: input.caseId })
    : undefined;
  const fallbackAuthority = input.caseId
    ? [...(runtime.playerResourceCommitments?.authorities || [])]
        .filter((item) => item.caseId === input.caseId)
        .sort((left, right) => right.boundAtTick - left.boundAtTick || right.cycleKey.localeCompare(left.cycleKey))[0]
    : undefined;
  const summaryAuthority = exactAuthority || fallbackAuthority;
  const scope: InvestigationOperationScope = input.sessionId && (!exactAuthority || exactAuthority.sessionId !== input.sessionId)
    ? "practice"
    : "authoritative";
  const summarySessionId = summaryAuthority?.sessionId || input.sessionId;
  const commitments = input.forceReady ? [] : playerResourceCommitmentsForCase(runtime, summarySessionId, input.caseId);
  const commitment = [...commitments]
    .sort((left, right) => commitmentPriority(right.status) - commitmentPriority(left.status) || right.selectedAtTick - left.selectedAtTick || (right.lane || "").localeCompare(left.lane || ""))[0];
  const plan = input.forceReady ? undefined : investigationOperationsPlanForCase(runtime, summarySessionId, input.caseId);
  const config = configFor(commitment?.choice);
  const status = commitment?.status || "ready";
  const reserveCost = commitment && commitment.amount > 0 ? commitment.amount : undefined;
  const options = playerResourceCommitmentPublicOptions(runtime);
  const completedLanes = new Set(plan?.actions.map((item) => item.lane) || []);
  const selectedLanes = Array.from(new Set([
    ...(plan?.selectedLanes || []),
    ...commitments.filter((item) => item.lane && (item.status === "reserved" || item.status === "used")).map((item) => item.lane!)
  ]));
  const priorityOrder = Array.from(new Set([
    ...selectedLanes.filter((lane) => !completedLanes.has(lane)),
    ...(runtime.worldLeadPreview?.focus ? [runtime.worldLeadPreview.focus] : []),
    "search" as const,
    "question" as const,
    "challenge" as const
  ])).filter((lane) => !completedLanes.has(lane));
  const laneSummaries = options.map((option): InvestigationOperationLanePublicSummary => {
    const laneCommitment = commitments
      .filter((item) => item.lane === option.lane)
      .sort((left, right) => commitmentPriority(right.status) - commitmentPriority(left.status) || right.selectedAtTick - left.selectedAtTick)[0];
    const laneStatus = laneCommitment?.status === "reserved" || laneCommitment?.status === "used" || laneCommitment?.status === "released" || laneCommitment?.status === "blocked"
      ? laneCommitment.status
      : "standard";
    const selected = selectedLanes.includes(option.lane);
    return {
      lane: option.lane,
      label: option.lane === "search" ? "Search operation" : option.lane === "question" ? "Question operation" : "Challenge operation",
      resourceLabel: option.label,
      status: laneStatus,
      selected,
      available: option.available || selected,
      availabilityBand: selected ? option.availabilityBand === "unavailable" ? "critical" : option.availabilityBand : option.availabilityBand,
      reserveCost: laneCommitment?.amount || option.reserveCost,
      timeCostMinutes: runtime.tickIntervalMinutes * (selected ? 1 : 2),
      benefitLabel: option.benefitLabel,
      costLabel: selected
        ? `${laneCommitment?.amount || option.reserveCost} existing capacity and one town-time interval.`
        : `No resource reserve; Manual First uses two town-time intervals.`
    };
  });
  const townTimeMinutes = (plan?.actions || []).reduce((total, item) => total + item.timeBlocks * runtime.tickIntervalMinutes, 0);
  const lastOperation = plan?.actions.at(-1);
  const lastConfig = PLAYER_RESOURCE_COMMITMENT_CONFIGS.find((item) => item.lane === lastOperation?.lane);
  const nextLane = priorityOrder[0];
  const lastAction = lastOperation ? {
    lane: lastOperation.lane,
    mode: lastOperation.mode,
    costLabel: lastOperation.mode === "supported"
      ? `${lastOperation.resourceAmount} existing capacity spent once.`
      : "No reserved capacity spent; Manual First remained legal.",
    gainLabel: lastOperation.mode === "supported"
      ? lastConfig?.benefitLabel || "A bounded world benefit was applied."
      : "Certified investigation progress was preserved through the slower route.",
    pressureLabel: plan?.status === "settled"
      ? (plan.appliedTempoPressureDelta || 0) < 0
        ? "Efficient case tempo eased one bounded layer of future town pressure."
        : (plan.appliedTempoPressureDelta || 0) > 0
          ? "Manual case tempo carried one bounded layer of pressure toward the next case."
          : "Case tempo settled without an additional pressure shift."
      : lastOperation.mode === "supported"
        ? "The support benefit is already reflected in the existing town state."
        : "The extra town-time interval remains part of this case's bounded tempo.",
    timeLabel: `${lastOperation.timeBlocks * runtime.tickIntervalMinutes} minutes of case operations time.`,
    nextAction: nextLane
      ? `Continue with the next legal certified ${nextLane} action; another order remains available when legal.`
      : "Select evidence and complete the unchanged theory route."
  } satisfies InvestigationOperationActionPublicSummary : undefined;
  const planStatus: InvestigationOperationPlanStatus = plan?.status || (commitments.length ? "planned" : "ready");
  return {
    scope,
    scopeLabel: scope === "authoritative" ? "Current case authority" : "Replay practice / world state frozen",
    status,
    ...(commitment?.choice ? { choice: commitment.choice } : {}),
    ...(commitment?.lane ? { lane: commitment.lane } : {}),
    label: config?.label || "Investigation Operations",
    benefitLabel: config?.benefitLabel || "One matching certified step can produce a small, bounded world benefit.",
    costLabel: reserveCost
      ? `${reserveCost} capacity ${status === "released" ? "was reserved and returned" : status === "used" ? "was reserved and spent" : "is reserved"} at the standing rate fixed when this choice opened.`
      : config?.costLabel || "Unused reserves return once when the case closes or another case opens.",
    progressLabel: plan
      ? `${plan.actions.length}/3 investigation operations resolved; ${selectedLanes.length}/${INVESTIGATION_OPERATION_SUPPORT_CAPACITY} support slots assigned.`
      : status === "reserved"
      ? `${config?.label || "Resource"} reserved for ${commitment?.lane || "a matching step"}.`
      : status === "used"
        ? `${config?.label || "Resource"} consumed once; bounded benefit applied.`
        : status === "released"
          ? "Unused reserve returned once."
          : status === "declined"
            ? "No resource reserved for this case."
            : status === "blocked"
              ? "The selected reserve is currently unavailable."
              : "No case resource is reserved yet.",
    nextAction: scope === "practice"
      ? "Continue the session-local replay route; this frozen Operations result cannot reserve resources or change town pressure."
      : nextLane
      ? `Use the existing certified handler for ${nextLane}; map selection costs no town time and only Advance Town moves the simulation clock.`
      : nextActionFor(status, commitment?.lane),
    ...(commitment?.blockedCategory ? { blockedCategory: commitment.blockedCategory } : {}),
    ...(reserveCost ? { reserveCost } : {}),
    options,
    planStatus,
    supportCapacity: INVESTIGATION_OPERATION_SUPPORT_CAPACITY,
    supportCount: selectedLanes.length,
    completedOperationCount: plan?.actions.length || 0,
    townTimeMinutes,
    townTimeLabel: `${townTimeMinutes} minutes recorded in ${runtime.tickIntervalMinutes}-minute town intervals. Investigation handlers add no hidden tick; normal Advance Town remains the only simulation clock action.`,
    priorityOrder,
    laneSummaries,
    ...(lastAction ? { lastAction } : {})
  };
}

function retainCommitments(items: PlayerResourceCommitment[]) {
  const active = items.filter((item) => item.status === "reserved");
  const terminal = items
    .filter((item) => item.status !== "reserved")
    .sort((left, right) => right.selectedAtTick - left.selectedAtTick || right.sessionId.localeCompare(left.sessionId))
    .slice(0, Math.max(0, MAX_PLAYER_RESOURCE_COMMITMENTS - active.length));
  return [...active, ...terminal]
    .sort((left, right) => left.selectedAtTick - right.selectedAtTick || left.sessionId.localeCompare(right.sessionId))
    .slice(-MAX_PLAYER_RESOURCE_COMMITMENTS);
}

function storeCommitment(runtime: PersistentTownRuntime, commitment: PlayerResourceCommitment) {
  const state = runtime.playerResourceCommitments || { items: [] };
  const filtered = state.items.filter((item) => !(
    item.sessionId === commitment.sessionId &&
    item.caseId === commitment.caseId &&
    (!commitment.cycleKey || !item.cycleKey || item.cycleKey === commitment.cycleKey) &&
    (commitment.lane ? item.lane === commitment.lane : item.choice === commitment.choice)
  ));
  runtime.playerResourceCommitments = { ...state, items: retainCommitments([...filtered, commitment]) };
  runtime.playerResourceCommitmentSummary = toPlayerResourceCommitmentPublicSummary(runtime, {
    sessionId: commitment.sessionId,
    caseId: commitment.caseId
  });
  runtime.updatedAt = new Date().toISOString();
  return runtime.playerResourceCommitmentSummary;
}

export function preparePlayerResourceCommitment(
  runtime: PersistentTownRuntime,
  input: Pick<PlayerResourceCommitmentDecisionInput, "sessionId" | "caseId">
) {
  const authority = bindInvestigationOperationsAuthority(runtime, input);
  const summary = toPlayerResourceCommitmentPublicSummary(runtime, input);
  if (authority) {
    runtime.playerResourceCommitmentSummary = summary;
    runtime.updatedAt = new Date().toISOString();
  }
  return summary;
}

export function applyPlayerResourceCommitmentDecision(
  runtime: PersistentTownRuntime,
  input: PlayerResourceCommitmentDecisionInput,
  options: { allowMultiple?: boolean } = {}
): PlayerResourceCommitmentPublicSummary | undefined {
  const existing = latestCommitment(runtime, input.sessionId, input.caseId);
  const config = configFor(input.choice);
  const existingLane = config
    ? playerResourceCommitmentsForCase(runtime, input.sessionId, input.caseId).find((item) => item.lane === config.lane)
    : undefined;
  if ((!options.allowMultiple && existing && existing.status !== "blocked") || (options.allowMultiple && existingLane && (existingLane.status === "reserved" || existingLane.status === "used"))) return undefined;
  if (input.choice === "none") {
    return storeCommitment(runtime, {
      ...(input.cycleKey ? { cycleKey: input.cycleKey } : {}),
      sessionId: input.sessionId,
      caseId: input.caseId,
      caseSceneLocationId: input.caseSceneLocationId,
      choice: "none",
      amount: 0,
      status: "declined",
      selectedAtTick: runtime.tick
    });
  }
  if (!config) return undefined;
  const terms = factionResourceCommitmentTerms(runtime, config.resourceKind);
  const discount = investigatorProgressionReserveDiscount(runtime, config.lane) + investigatorHeadquartersReserveDiscount(runtime, config.lane, input.caseId);
  const cost = Math.max(1, terms.cost - discount);
  const ledger = runtime.ruleState?.resourceLedger[config.resourceKind];
  if (!terms.available || !ledger || ledger.available < cost) {
    return storeCommitment(runtime, {
      ...(input.cycleKey ? { cycleKey: input.cycleKey } : {}),
      sessionId: input.sessionId,
      caseId: input.caseId,
      caseSceneLocationId: input.caseSceneLocationId,
      choice: input.choice,
      lane: config.lane,
      resourceKind: config.resourceKind,
      amount: 0,
      status: "blocked",
      selectedAtTick: runtime.tick,
      blockedCategory: terms.available ? "resource unavailable" : "relationship unavailable"
    });
  }
  ledger.available = clamp(ledger.available - cost);
  ledger.reserved = clamp(ledger.reserved + cost);
  invalidateTownCandidateCache(runtime);
  consumeInvestigatorHeadquartersReserveBenefit(runtime, { lane: config.lane, caseId: input.caseId });
  return storeCommitment(runtime, {
    ...(input.cycleKey ? { cycleKey: input.cycleKey } : {}),
    sessionId: input.sessionId,
    caseId: input.caseId,
    caseSceneLocationId: input.caseSceneLocationId,
    choice: input.choice,
    lane: config.lane,
    resourceKind: config.resourceKind,
      amount: cost,
    status: "reserved",
    selectedAtTick: runtime.tick
  });
}

function updateLocationResourcePressure(runtime: PersistentTownRuntime, locationId?: string) {
  if (!locationId) return 0;
  let actualDelta = 0;
  runtime.locationProfiles = (runtime.locationProfiles || []).map((profile: TownLocationProfile) => {
    if (profile.locationId !== locationId) return profile;
    const next = clamp(profile.resourcePressure - 2);
    actualDelta = next - profile.resourcePressure;
    return { ...profile, resourcePressure: next, updatedAtTick: runtime.tick };
  });
  return actualDelta;
}

export function consumePlayerResourceCommitment(
  runtime: PersistentTownRuntime,
  input: { sessionId: string; caseId: string; lane: WorldLeadFocus }
): PlayerResourceCommitmentPublicSummary | undefined {
  const commitment = playerResourceCommitmentsForCase(runtime, input.sessionId, input.caseId)
    .filter((item) => item.status === "reserved" && item.lane === input.lane && item.resourceKind)
    .sort((left, right) => right.selectedAtTick - left.selectedAtTick)[0];
  if (!commitment || !commitment.resourceKind) return undefined;
  const ledger = runtime.ruleState?.resourceLedger[commitment.resourceKind];
  if (!ledger) return undefined;
  const spent = Math.min(commitment.amount, ledger.reserved);
  ledger.reserved = clamp(ledger.reserved - spent);
  ledger.spentThisRun = clamp(ledger.spentThisRun + spent);
  ledger.pressure = clamp(ledger.pressure + Math.ceil(spent / 2));
  const appliedBenefit: NonNullable<PlayerResourceCommitment["appliedBenefit"]> = {};
  if (input.lane === "search") {
    appliedBenefit.locationResourcePressure = updateLocationResourcePressure(runtime, commitment.caseSceneLocationId);
  } else if (input.lane === "question" && runtime.ruleState) {
    const before = runtime.ruleState.publicOpinion.witnessFear;
    runtime.ruleState.publicOpinion.witnessFear = clamp(before - 2);
    runtime.ruleState.publicOpinion.updatedAtTick = runtime.tick;
    appliedBenefit.witnessFear = runtime.ruleState.publicOpinion.witnessFear - before;
  } else if (input.lane === "challenge" && runtime.ruleState) {
    const before = runtime.ruleState.evidenceContamination.contamination;
    runtime.ruleState.evidenceContamination.contamination = clamp(before - 2);
    runtime.ruleState.evidenceContamination.updatedAtTick = runtime.tick;
    appliedBenefit.evidenceContamination = runtime.ruleState.evidenceContamination.contamination - before;
  }
  invalidateTownCandidateCache(runtime);
  const summary = storeCommitment(runtime, {
    ...commitment,
    amount: spent,
    status: "used",
    usedAtTick: runtime.tick,
    appliedBenefit
  });
  recordResourceCommitmentFactionRelationship(runtime, {
    sourceKey: `${commitment.sessionId}:${commitment.caseId}:${commitment.choice}`,
    resourceKind: commitment.resourceKind
  });
  runtime.playerResourceCommitmentSummary = toPlayerResourceCommitmentPublicSummary(runtime, {
    sessionId: commitment.sessionId,
    caseId: commitment.caseId
  });
  return runtime.playerResourceCommitmentSummary || summary;
}

export function releaseUnusedPlayerResourceCommitments(
  runtime: PersistentTownRuntime,
  input: { sessionId?: string; caseId?: string; lanes?: WorldLeadFocus[] } = {}
): PlayerResourceCommitmentPublicSummary | undefined {
  const state = runtime.playerResourceCommitments;
  if (!state) return undefined;
  let changed = false;
  let lastReleased: PlayerResourceCommitment | undefined;
  const items = state.items.map((commitment) => {
    const matches = (!input.sessionId || commitment.sessionId === input.sessionId) &&
      (!input.caseId || commitment.caseId === input.caseId) &&
      (!input.lanes || Boolean(commitment.lane && input.lanes.includes(commitment.lane)));
    if (!matches || commitment.status !== "reserved" || !commitment.resourceKind) return commitment;
    const ledger = runtime.ruleState?.resourceLedger[commitment.resourceKind];
    if (ledger) {
      const released = Math.min(commitment.amount, ledger.reserved);
      ledger.available = clamp(ledger.available + released);
      ledger.reserved = clamp(ledger.reserved - released);
    }
    changed = true;
    lastReleased = { ...commitment, status: "released", releasedAtTick: runtime.tick };
    return lastReleased;
  });
  if (!changed || !lastReleased) return undefined;
  runtime.playerResourceCommitments = { ...state, items: retainCommitments(items) };
  invalidateTownCandidateCache(runtime);
  runtime.playerResourceCommitmentSummary = toPlayerResourceCommitmentPublicSummary(runtime, {
    sessionId: lastReleased.sessionId,
    caseId: lastReleased.caseId
  });
  runtime.updatedAt = new Date().toISOString();
  return runtime.playerResourceCommitmentSummary;
}
