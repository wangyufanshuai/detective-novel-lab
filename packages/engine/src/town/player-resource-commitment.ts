import { invalidateTownCandidateCache } from "./cases";
import type { PersistentTownRuntime, TownLocationProfile, WorldLeadFocus } from "../persistent-town";
import type { TownResourceKind } from "./rules";
import { factionResourceCommitmentTerms, recordResourceCommitmentFactionRelationship } from "./faction-relationship";
import { investigatorProgressionReserveDiscount } from "./investigator-progression";

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
};

export type PlayerResourceCommitmentPublicSummary = {
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
};

export type PlayerResourceCommitment = {
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
};

export type PlayerResourceCommitmentDecisionInput = {
  sessionId: string;
  caseId: string;
  caseSceneLocationId?: string;
  choice: PlayerResourceCommitmentChoice;
};

type CommitmentConfig = {
  choice: Exclude<PlayerResourceCommitmentChoice, "none">;
  resourceKind: TownResourceKind;
  lane: WorldLeadFocus;
  label: string;
  benefitLabel: string;
  costLabel: string;
};

export const PLAYER_RESOURCE_COMMITMENT_COST = 2;
const MAX_PLAYER_RESOURCE_COMMITMENTS = 32;

const COMMITMENT_CONFIGS: CommitmentConfig[] = [
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
  return COMMITMENT_CONFIGS.find((item) => item.choice === choice);
}

function latestCommitment(runtime: PersistentTownRuntime, sessionId?: string, caseId?: string) {
  return (runtime.playerResourceCommitments?.items || [])
    .filter((item) => (!sessionId || item.sessionId === sessionId) && (!caseId || item.caseId === caseId))
    .sort((left, right) => right.selectedAtTick - left.selectedAtTick || right.sessionId.localeCompare(left.sessionId))[0];
}

function publicOptions(runtime: PersistentTownRuntime): PlayerResourceCommitmentPublicOption[] {
  return COMMITMENT_CONFIGS.map((config) => {
    const terms = factionResourceCommitmentTerms(runtime, config.resourceKind);
    const discount = investigatorProgressionReserveDiscount(runtime, config.lane);
    const cost = Math.max(1, terms.cost - discount);
    return {
      choice: config.choice,
      label: config.label,
      lane: config.lane,
      benefitLabel: config.benefitLabel,
      costLabel: `${terms.standingLabel}. Reserve ${cost} capacity${discount ? " after investigator practice" : ""}; the relationship rate applies only to a future choice.`,
      available: terms.available && (runtime.ruleState?.resourceLedger[config.resourceKind]?.available || 0) >= cost,
      standingLabel: terms.standingLabel,
      reserveCost: cost
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

export function toPlayerResourceCommitmentPublicSummary(
  runtime: PersistentTownRuntime,
  input: { sessionId?: string; caseId?: string; forceReady?: boolean } = {}
): PlayerResourceCommitmentPublicSummary {
  const commitment = input.forceReady ? undefined : latestCommitment(runtime, input.sessionId, input.caseId);
  const config = configFor(commitment?.choice);
  const status = commitment?.status || "ready";
  const reserveCost = commitment && commitment.amount > 0 ? commitment.amount : undefined;
  return {
    status,
    ...(commitment?.choice ? { choice: commitment.choice } : {}),
    ...(commitment?.lane ? { lane: commitment.lane } : {}),
    label: config?.label || "Case resource commitment",
    benefitLabel: config?.benefitLabel || "One matching certified step can produce a small, bounded world benefit.",
    costLabel: reserveCost
      ? `${reserveCost} capacity ${status === "released" ? "was reserved and returned" : status === "used" ? "was reserved and spent" : "is reserved"} at the standing rate fixed when this choice opened.`
      : config?.costLabel || "Unused reserves return once when the case closes or another case opens.",
    progressLabel: status === "reserved"
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
    nextAction: nextActionFor(status, commitment?.lane),
    ...(commitment?.blockedCategory ? { blockedCategory: commitment.blockedCategory } : {}),
    ...(reserveCost ? { reserveCost } : {}),
    options: publicOptions(runtime)
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
  const items = runtime.playerResourceCommitments?.items || [];
  const filtered = items.filter((item) => !(item.sessionId === commitment.sessionId && item.caseId === commitment.caseId));
  runtime.playerResourceCommitments = { items: retainCommitments([...filtered, commitment]) };
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
  const summary = toPlayerResourceCommitmentPublicSummary(runtime, input);
  runtime.playerResourceCommitmentSummary = summary;
  runtime.updatedAt = new Date().toISOString();
  return summary;
}

export function applyPlayerResourceCommitmentDecision(
  runtime: PersistentTownRuntime,
  input: PlayerResourceCommitmentDecisionInput
): PlayerResourceCommitmentPublicSummary | undefined {
  const existing = latestCommitment(runtime, input.sessionId, input.caseId);
  if (existing && existing.status !== "blocked") return undefined;
  if (input.choice === "none") {
    return storeCommitment(runtime, {
      sessionId: input.sessionId,
      caseId: input.caseId,
      caseSceneLocationId: input.caseSceneLocationId,
      choice: "none",
      amount: 0,
      status: "declined",
      selectedAtTick: runtime.tick
    });
  }
  const config = configFor(input.choice);
  if (!config) return undefined;
  const terms = factionResourceCommitmentTerms(runtime, config.resourceKind);
  const discount = investigatorProgressionReserveDiscount(runtime, config.lane);
  const cost = Math.max(1, terms.cost - discount);
  const ledger = runtime.ruleState?.resourceLedger[config.resourceKind];
  if (!terms.available || !ledger || ledger.available < cost) {
    return storeCommitment(runtime, {
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
  return storeCommitment(runtime, {
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
  const commitment = latestCommitment(runtime, input.sessionId, input.caseId);
  if (!commitment || commitment.status !== "reserved" || commitment.lane !== input.lane || !commitment.resourceKind) return undefined;
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
  input: { sessionId?: string; caseId?: string } = {}
): PlayerResourceCommitmentPublicSummary | undefined {
  const state = runtime.playerResourceCommitments;
  if (!state) return undefined;
  let changed = false;
  let lastReleased: PlayerResourceCommitment | undefined;
  const items = state.items.map((commitment) => {
    const matches = (!input.sessionId || commitment.sessionId === input.sessionId) && (!input.caseId || commitment.caseId === input.caseId);
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
  runtime.playerResourceCommitments = { items: retainCommitments(items) };
  invalidateTownCandidateCache(runtime);
  runtime.playerResourceCommitmentSummary = toPlayerResourceCommitmentPublicSummary(runtime, {
    sessionId: lastReleased.sessionId,
    caseId: lastReleased.caseId
  });
  runtime.updatedAt = new Date().toISOString();
  return runtime.playerResourceCommitmentSummary;
}
