import type { PersistentTownRuntime } from "../persistent-town";
import type { TownInstitutionKind, TownResourceKind } from "./rules";

export type FactionRelationshipBand = "trusted" | "neutral" | "strained" | "hostile";
export type FactionRelationshipReason = "directive" | "resource-commitment" | "accepted-case" | "recovery";

export type InvestigatorFactionStanding = {
  factionKind: TownInstitutionKind;
  value: number;
  updatedAtTick: number;
};

export type FactionRelationshipLedgerEntry = {
  id: string;
  sourceKey: string;
  factionKind: TownInstitutionKind;
  requestedDelta: number;
  appliedDelta: number;
  reason: FactionRelationshipReason;
  tick: number;
};

export type FactionRelationshipRuntimeState = {
  standings: Partial<Record<TownInstitutionKind, InvestigatorFactionStanding>>;
  ledger: FactionRelationshipLedgerEntry[];
};

export type FactionRelationshipPublicEntry = {
  label: string;
  standing: FactionRelationshipBand;
  directionLabel: "supportive" | "steady" | "guarded" | "closed";
};

export type FactionRelationshipPublicSummary = {
  status: "stable" | "changed";
  trustedCount: number;
  strainedCount: number;
  headline: string;
  lastChangeLabel: string;
  resourceEffectLabel: string;
  nextAction: string;
  standings: FactionRelationshipPublicEntry[];
};

export type FactionResourceCommitmentTerms = {
  factionKind: TownInstitutionKind;
  standing: FactionRelationshipBand;
  standingLabel: string;
  cost: number;
  available: boolean;
};

const MAX_RELATIONSHIP_LEDGER_ENTRIES = 64;
const RELATIONSHIP_MIN = -10;
const RELATIONSHIP_MAX = 10;

const FACTION_KINDS: TownInstitutionKind[] = [
  "police",
  "media",
  "family",
  "commerce",
  "civic",
  "medical",
  "court",
  "dock_union"
];

const FACTION_LABELS: Record<TownInstitutionKind, string> = {
  police: "Police Service",
  media: "Press Network",
  family: "Household Network",
  commerce: "Merchant Circle",
  civic: "Civic Records Office",
  medical: "Medical Review Board",
  court: "Court Administration",
  dock_union: "Dock Union"
};

const RESOURCE_FACTIONS: Partial<Record<TownResourceKind, TownInstitutionKind>> = {
  police_time: "police",
  informant_trust: "media",
  evidence_integrity: "court"
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function factionRelationshipBand(value: number): FactionRelationshipBand {
  if (value >= 4) return "trusted";
  if (value <= -7) return "hostile";
  if (value <= -3) return "strained";
  return "neutral";
}

function directionLabel(band: FactionRelationshipBand): FactionRelationshipPublicEntry["directionLabel"] {
  if (band === "trusted") return "supportive";
  if (band === "strained") return "guarded";
  if (band === "hostile") return "closed";
  return "steady";
}

export function mapContentFactionKindToInstitutionKind(kind?: string): TownInstitutionKind {
  if (kind === "commerce") return "commerce";
  if (kind === "media") return "media";
  if (kind === "medical") return "medical";
  if (kind === "private" || kind === "family") return "family";
  if (kind === "labor" || kind === "underground" || kind === "dock_union") return "dock_union";
  if (kind === "court") return "court";
  if (kind === "police") return "police";
  return "civic";
}

export function ensureFactionRelationshipState(runtime: PersistentTownRuntime): FactionRelationshipRuntimeState {
  const state = runtime.factionRelationships || { standings: {}, ledger: [] };
  for (const factionKind of FACTION_KINDS) {
    state.standings[factionKind] ||= { factionKind, value: 0, updatedAtTick: runtime.tick };
  }
  state.ledger = (state.ledger || []).slice(-MAX_RELATIONSHIP_LEDGER_ENTRIES);
  runtime.factionRelationships = state;
  return state;
}

function latestAppliedChange(state: FactionRelationshipRuntimeState) {
  return [...state.ledger]
    .filter((entry) => entry.appliedDelta !== 0)
    .sort((left, right) => right.tick - left.tick || right.id.localeCompare(left.id))[0];
}

export function toFactionRelationshipPublicSummary(runtime: PersistentTownRuntime): FactionRelationshipPublicSummary {
  const state = ensureFactionRelationshipState(runtime);
  const all = FACTION_KINDS.map((factionKind) => {
    const value = state.standings[factionKind]?.value || 0;
    const standing = factionRelationshipBand(value);
    return { factionKind, value, label: FACTION_LABELS[factionKind], standing, directionLabel: directionLabel(standing) };
  });
  const trustedCount = all.filter((entry) => entry.standing === "trusted").length;
  const strainedCount = all.filter((entry) => entry.standing === "strained" || entry.standing === "hostile").length;
  const latest = latestAppliedChange(state);
  const visible = [...all]
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value) || left.label.localeCompare(right.label))
    .slice(0, 4)
    .map(({ label, standing, directionLabel: publicDirection }) => ({ label, standing, directionLabel: publicDirection }));
  const latestLabel = latest ? FACTION_LABELS[latest.factionKind] : undefined;
  return {
    status: latest ? "changed" : "stable",
    trustedCount,
    strainedCount,
    headline: trustedCount
      ? `${trustedCount} town partner${trustedCount === 1 ? "" : "s"} now offer trusted standing.`
      : strainedCount
        ? `${strainedCount} town partner${strainedCount === 1 ? "" : "s"} now require careful recovery.`
        : "Institution relationships remain neutral.",
    lastChangeLabel: latest && latestLabel
      ? `${latestLabel} standing ${latest.appliedDelta > 0 ? "improved" : "declined"}.`
      : "No player-authoritative relationship change has been recorded.",
    resourceEffectLabel: "Trusted standing can lower a future reserve cost; strained standing raises it; hostile standing can withhold that option.",
    nextAction: strainedCount
      ? "Use future completed operations or case work to rebuild guarded relationships explicitly."
      : "Continue making visible case and faction choices; current-case truth remains unchanged.",
    standings: visible
  };
}

function refreshSummary(runtime: PersistentTownRuntime) {
  runtime.factionRelationshipSummary = toFactionRelationshipPublicSummary(runtime);
  runtime.updatedAt = new Date().toISOString();
  return runtime.factionRelationshipSummary;
}

export function applyFactionRelationshipDelta(runtime: PersistentTownRuntime, input: {
  sourceKey: string;
  factionKind: TownInstitutionKind;
  delta: number;
  reason: FactionRelationshipReason;
}) {
  const state = ensureFactionRelationshipState(runtime);
  const id = `faction-relationship-${input.reason}-${input.sourceKey}-${input.factionKind}`;
  if (state.ledger.some((entry) => entry.id === id)) return refreshSummary(runtime);
  const current = state.standings[input.factionKind] || { factionKind: input.factionKind, value: 0, updatedAtTick: runtime.tick };
  const nextValue = clamp(current.value + input.delta, RELATIONSHIP_MIN, RELATIONSHIP_MAX);
  const appliedDelta = nextValue - current.value;
  state.standings[input.factionKind] = { factionKind: input.factionKind, value: nextValue, updatedAtTick: runtime.tick };
  state.ledger = [...state.ledger, {
    id,
    sourceKey: input.sourceKey,
    factionKind: input.factionKind,
    requestedDelta: input.delta,
    appliedDelta,
    reason: input.reason,
    tick: runtime.tick
  }].slice(-MAX_RELATIONSHIP_LEDGER_ENTRIES);
  runtime.factionRelationships = state;
  return refreshSummary(runtime);
}

export function recordCompletedDirectiveFactionRelationships(runtime: PersistentTownRuntime, input: {
  directiveId: string;
  choice: "support" | "contain";
  responseInstitutionKind: TownInstitutionKind;
  sourceFactionKind?: string;
}) {
  const sourceKind = mapContentFactionKindToInstitutionKind(input.sourceFactionKind);
  const sameFaction = sourceKind === input.responseInstitutionKind;
  applyFactionRelationshipDelta(runtime, {
    sourceKey: `${input.directiveId}:${input.choice}:response`,
    factionKind: input.responseInstitutionKind,
    delta: input.choice === "support" ? 2 : sameFaction ? 1 : 2,
    reason: "directive"
  });
  if (!sameFaction) {
    applyFactionRelationshipDelta(runtime, {
      sourceKey: `${input.directiveId}:${input.choice}:source`,
      factionKind: sourceKind,
      delta: input.choice === "support" ? 1 : -2,
      reason: "directive"
    });
  }
  return refreshSummary(runtime);
}

export function recordAcceptedCaseFactionRelationship(runtime: PersistentTownRuntime, input: {
  caseId: string;
  sourceFactionKind?: string;
}) {
  return applyFactionRelationshipDelta(runtime, {
    sourceKey: input.caseId,
    factionKind: mapContentFactionKindToInstitutionKind(input.sourceFactionKind),
    delta: 1,
    reason: "accepted-case"
  });
}

export function recordResourceCommitmentFactionRelationship(runtime: PersistentTownRuntime, input: {
  sourceKey: string;
  resourceKind: TownResourceKind;
}) {
  const factionKind = RESOURCE_FACTIONS[input.resourceKind];
  if (!factionKind) return refreshSummary(runtime);
  return applyFactionRelationshipDelta(runtime, {
    sourceKey: input.sourceKey,
    factionKind,
    delta: 1,
    reason: "resource-commitment"
  });
}

export function factionResourceCommitmentTerms(runtime: PersistentTownRuntime, resourceKind: TownResourceKind): FactionResourceCommitmentTerms {
  const factionKind = RESOURCE_FACTIONS[resourceKind] || "civic";
  const state = ensureFactionRelationshipState(runtime);
  const standing = factionRelationshipBand(state.standings[factionKind]?.value || 0);
  return {
    factionKind,
    standing,
    standingLabel: `${FACTION_LABELS[factionKind]} / ${standing}`,
    cost: standing === "trusted" ? 1 : standing === "strained" || standing === "hostile" ? 3 : 2,
    available: standing !== "hostile"
  };
}

export function factionStandingForInstitution(runtime: PersistentTownRuntime, factionKind: TownInstitutionKind) {
  const state = ensureFactionRelationshipState(runtime);
  return factionRelationshipBand(state.standings[factionKind]?.value || 0);
}
