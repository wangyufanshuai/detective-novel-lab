import type { PersistentTownRuntime, WorldLeadFocus } from "../persistent-town";

export type InvestigatorHeadquartersChoice =
  | "field-search"
  | "witness-work"
  | "contradiction-analysis"
  | "evidence-handling"
  | "institutional-access";

export type InvestigatorHeadquartersStatus = "ready" | "prepared" | "active" | "completed";

export type InvestigatorHeadquartersPreparation = {
  id: string;
  cycleKey: string;
  sourceCaseId?: string;
  targetCaseId?: string;
  status: InvestigatorHeadquartersStatus;
  choice?: InvestigatorHeadquartersChoice;
  createdAtTick: number;
  preparedAtTick?: number;
  activatedAtTick?: number;
  completedAtTick?: number;
  recoveryUsed?: boolean;
  benefitConsumed?: boolean;
};

export type InvestigatorHeadquartersRuntimeState = {
  activeId?: string;
  items: InvestigatorHeadquartersPreparation[];
};

export type InvestigatorHeadquartersPublicDirection = {
  choice: InvestigatorHeadquartersChoice;
  label: string;
  benefitLabel: string;
  timingLabel: string;
  available: boolean;
  lockedReason?: string;
};

export type InvestigatorHeadquartersPublicSummary = {
  status: "empty" | InvestigatorHeadquartersStatus;
  choice?: InvestigatorHeadquartersChoice;
  choiceLabel?: string;
  progressLabel: string;
  benefitLabel: string;
  activeCaseLabel: string;
  availableDirections: InvestigatorHeadquartersPublicDirection[];
  completedCount: number;
  maximumCount: number;
  recoveryAvailable: boolean;
  recoveryLabel: string;
  nextAction: string;
};

export type InvestigatorHeadquartersDecisionInput = { choice: InvestigatorHeadquartersChoice };

const MAX_PREPARATIONS = 2;

const DIRECTION_DEFINITIONS: Record<InvestigatorHeadquartersChoice, Omit<InvestigatorHeadquartersPublicDirection, "choice" | "available" | "lockedReason"> & { competency: "search" | "question" | "challenge" | "evidence-selection" | "case-closure" }> = {
  "field-search": {
    label: "Field Search",
    benefitLabel: "One Search reserve costs one less capacity on the next case, with a clearer public-location cue after Join.",
    timingLabel: "Next case · Search reserve",
    competency: "search"
  },
  "witness-work": {
    label: "Witness Work",
    benefitLabel: "One Question reserve costs one less capacity on the next case; testimony and legality stay unchanged.",
    timingLabel: "Next case · Question reserve",
    competency: "question"
  },
  "contradiction-analysis": {
    label: "Contradiction Analysis",
    benefitLabel: "One Challenge reserve costs one less capacity on the next case; no contradiction is revealed automatically.",
    timingLabel: "Next case · Challenge reserve",
    competency: "challenge"
  },
  "evidence-handling": {
    label: "Evidence Handling",
    benefitLabel: "One safe Recovery choice becomes available after a rejected theory; it never fills evidence or theory fields.",
    timingLabel: "Next case · Recovery option",
    competency: "evidence-selection"
  },
  "institutional-access": {
    label: "Institutional Access",
    benefitLabel: "The next extracted case shows an early public institution-pressure band before Join, without exposing values or internal keys.",
    timingLabel: "Next case · public context",
    competency: "case-closure"
  }
};

const CHOICE_ORDER: InvestigatorHeadquartersChoice[] = [
  "field-search",
  "witness-work",
  "contradiction-analysis",
  "evidence-handling",
  "institutional-access"
];

const CAMPAIGN_RECOMMENDATIONS: Record<string, InvestigatorHeadquartersChoice[]> = {
  "town-reckoning": ["institutional-access", "evidence-handling", "field-search", "witness-work", "contradiction-analysis"],
  "harbor-testimony": ["field-search", "witness-work", "evidence-handling", "institutional-access", "contradiction-analysis"],
  "clinic-headlines": ["contradiction-analysis", "evidence-handling", "witness-work", "institutional-access", "field-search"]
};

function competencies(runtime: PersistentTownRuntime) {
  return runtime.investigatorProgression?.competencies || {
    search: 0,
    question: 0,
    challenge: 0,
    "evidence-selection": 0,
    "case-closure": 0
  };
}

function clampItems(items: InvestigatorHeadquartersPreparation[]) {
  const deduped = items.filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
  const open = deduped.filter((item) => item.status !== "completed");
  const completed = deduped.filter((item) => item.status === "completed");
  return [...completed.slice(-Math.max(0, MAX_PREPARATIONS - open.length)), ...open]
    .sort((left, right) => left.createdAtTick - right.createdAtTick || left.id.localeCompare(right.id))
    .slice(-MAX_PREPARATIONS);
}

function isOpen(item: InvestigatorHeadquartersPreparation) {
  return item.status !== "completed";
}

function currentPreparation(runtime: PersistentTownRuntime) {
  const state = runtime.investigatorHeadquarters;
  if (!state?.items.length) return undefined;
  return state.items.find((item) => item.id === state.activeId && isOpen(item))
    || state.items.find(isOpen)
    || [...state.items].reverse().find((item) => item.status === "completed");
}

function labelFor(choice?: InvestigatorHeadquartersChoice) {
  return choice ? DIRECTION_DEFINITIONS[choice].label : "No direction selected";
}

function recommendationRank(runtime: PersistentTownRuntime, choice: InvestigatorHeadquartersChoice) {
  const campaignId = runtime.campaignSession?.campaignId || "";
  const recommended = CAMPAIGN_RECOMMENDATIONS[campaignId] || [];
  const index = recommended.indexOf(choice);
  return index < 0 ? CHOICE_ORDER.length + CHOICE_ORDER.indexOf(choice) : index;
}

function choiceAvailable(runtime: PersistentTownRuntime, choice: InvestigatorHeadquartersChoice) {
  const marks = competencies(runtime);
  const definition = DIRECTION_DEFINITIONS[choice];
  if (choice === "institutional-access") return marks[definition.competency] >= 1 || CHOICE_ORDER.every((item) => item === choice || marks[DIRECTION_DEFINITIONS[item].competency] < 1);
  return marks[definition.competency] >= 1;
}

export function ensureInvestigatorHeadquarters(runtime: PersistentTownRuntime) {
  const raw = runtime.investigatorHeadquarters;
  if (!raw || !Array.isArray(raw.items)) {
    runtime.investigatorHeadquarters = { items: [] };
  } else {
    raw.items = clampItems(raw.items.map((item) => ({
      ...item,
      status: item.status === "ready" || item.status === "prepared" || item.status === "active" || item.status === "completed" ? item.status : "ready",
      cycleKey: String(item.cycleKey || item.id)
    })));
    const open = raw.items.find(isOpen);
    raw.activeId = open?.id || raw.items.at(-1)?.id;
  }
  return runtime.investigatorHeadquarters!;
}

export function investigatorHeadquartersDecisionAvailable(runtime: PersistentTownRuntime, choice: InvestigatorHeadquartersChoice) {
  const state = ensureInvestigatorHeadquarters(runtime);
  const current = currentPreparation(runtime);
  return Boolean(current?.status === "ready" && choiceAvailable(runtime, choice) && !state.items.some((item) => item.status === "prepared" || item.status === "active"));
}

export function investigatorHeadquartersExtractionRequired(runtime: PersistentTownRuntime) {
  return currentPreparation(runtime)?.status === "ready";
}

export function toInvestigatorHeadquartersPublicSummary(runtime: PersistentTownRuntime): InvestigatorHeadquartersPublicSummary {
  const state = ensureInvestigatorHeadquarters(runtime);
  const current = currentPreparation(runtime);
  const completedCount = state.items.filter((item) => item.status === "completed").length;
  if (!current) {
    return {
      status: "empty",
      progressLabel: `${completedCount}/${MAX_PREPARATIONS} intermission preparations completed`,
      benefitLabel: "Headquarters opens between accepted campaign cases; it does not replace investigation work.",
      activeCaseLabel: "No Headquarters stage is waiting",
      availableDirections: [],
      completedCount,
      maximumCount: MAX_PREPARATIONS,
      recoveryAvailable: false,
      recoveryLabel: "No Headquarters Recovery option is active.",
      nextAction: "Continue the opening case through the existing certified route."
    };
  }
  const directions = current.status === "ready"
    ? [...CHOICE_ORDER]
      .sort((left, right) => recommendationRank(runtime, left) - recommendationRank(runtime, right) || left.localeCompare(right))
      .map((choice) => {
        const definition = DIRECTION_DEFINITIONS[choice];
        const available = choiceAvailable(runtime, choice);
        return {
          choice,
          label: definition.label,
          benefitLabel: definition.benefitLabel,
          timingLabel: definition.timingLabel,
          available,
          ...(available ? {} : { lockedReason: "Build one matching manual practice mark first." })
        };
      })
    : [];
  const choice = current.choice;
  const recoveryAvailable = current.status === "prepared" || current.status === "active"
    ? choice === "evidence-handling" && !current.recoveryUsed
    : false;
  const statusLabel = current.status === "ready"
    ? `${completedCount}/${MAX_PREPARATIONS} preparations completed; one choice is required before the next extraction`
    : current.status === "prepared"
      ? "Preparation locked for the next successful extraction"
      : current.status === "active"
        ? "Preparation is active on the current case"
        : "Preparation completed once; its bounded benefit will not repeat";
  const nextAction = current.status === "ready"
    ? "Choose one available Headquarters direction before extracting the next case."
    : current.status === "prepared"
      ? "Extract any legal next case; the selected bounded benefit will activate once."
      : current.status === "active"
        ? recoveryAvailable
          ? "Complete the current case; one safe Recovery option will remain available after a rejected theory."
          : "Complete the current case through the unchanged certified route."
        : "Continue the campaign; no Headquarters direction can change this closed case.";
  return {
    status: current.status,
    ...(choice ? { choice, choiceLabel: labelFor(choice) } : {}),
    progressLabel: statusLabel,
    benefitLabel: choice ? DIRECTION_DEFINITIONS[choice].benefitLabel : "Choose one bounded preparation.",
    activeCaseLabel: current.status === "active" ? "Current case" : current.status === "prepared" ? "Next case" : "Campaign transition",
    availableDirections: directions,
    completedCount,
    maximumCount: MAX_PREPARATIONS,
    recoveryAvailable,
    recoveryLabel: recoveryAvailable ? "One Headquarters Recovery assist is available after a rejected theory." : "No extra Recovery assist is currently available.",
    nextAction
  };
}

export function prepareInvestigatorHeadquarters(runtime: PersistentTownRuntime, input: { cycleKey: string; sourceCaseId?: string }) {
  const state = ensureInvestigatorHeadquarters(runtime);
  if (state.items.some((item) => item.cycleKey === input.cycleKey)) {
    runtime.investigatorHeadquartersSummary = toInvestigatorHeadquartersPublicSummary(runtime);
    return runtime.investigatorHeadquartersSummary;
  }
  if (state.items.filter((item) => item.status !== "completed").length || state.items.filter((item) => item.status === "completed").length >= MAX_PREPARATIONS) {
    runtime.investigatorHeadquartersSummary = toInvestigatorHeadquartersPublicSummary(runtime);
    return runtime.investigatorHeadquartersSummary;
  }
  const item: InvestigatorHeadquartersPreparation = {
    id: `investigator-headquarters-${input.cycleKey}`,
    cycleKey: input.cycleKey,
    sourceCaseId: input.sourceCaseId,
    status: "ready",
    createdAtTick: runtime.tick
  };
  runtime.investigatorHeadquarters = { activeId: item.id, items: clampItems([...state.items, item]) };
  runtime.investigatorHeadquartersSummary = toInvestigatorHeadquartersPublicSummary(runtime);
  runtime.updatedAt = new Date().toISOString();
  return runtime.investigatorHeadquartersSummary;
}

export function applyInvestigatorHeadquartersDecision(runtime: PersistentTownRuntime, input: InvestigatorHeadquartersDecisionInput) {
  const state = ensureInvestigatorHeadquarters(runtime);
  const current = currentPreparation(runtime);
  if (!current || current.status !== "ready" || !investigatorHeadquartersDecisionAvailable(runtime, input.choice)) return undefined;
  const next = {
    ...current,
    choice: input.choice,
    status: "prepared" as const,
    preparedAtTick: runtime.tick
  };
  runtime.investigatorHeadquarters = { activeId: next.id, items: clampItems(state.items.map((item) => item.id === next.id ? next : item)) };
  runtime.investigatorHeadquartersSummary = toInvestigatorHeadquartersPublicSummary(runtime);
  runtime.updatedAt = new Date().toISOString();
  return runtime.investigatorHeadquartersSummary;
}

export function activateInvestigatorHeadquarters(runtime: PersistentTownRuntime, targetCaseId: string) {
  const state = ensureInvestigatorHeadquarters(runtime);
  const current = currentPreparation(runtime);
  if (!current || current.status !== "prepared") return toInvestigatorHeadquartersPublicSummary(runtime);
  const next = { ...current, status: "active" as const, targetCaseId, activatedAtTick: runtime.tick };
  runtime.investigatorHeadquarters = { activeId: next.id, items: clampItems(state.items.map((item) => item.id === next.id ? next : item)) };
  runtime.investigatorHeadquartersSummary = toInvestigatorHeadquartersPublicSummary(runtime);
  runtime.updatedAt = new Date().toISOString();
  return runtime.investigatorHeadquartersSummary;
}

export function completeInvestigatorHeadquarters(runtime: PersistentTownRuntime, caseId: string) {
  const state = ensureInvestigatorHeadquarters(runtime);
  const current = currentPreparation(runtime);
  if (!current || current.status !== "active" || (current.targetCaseId && current.targetCaseId !== caseId)) return toInvestigatorHeadquartersPublicSummary(runtime);
  const next = { ...current, status: "completed" as const, completedAtTick: runtime.tick };
  runtime.investigatorHeadquarters = { activeId: next.id, items: clampItems(state.items.map((item) => item.id === next.id ? next : item)) };
  runtime.investigatorHeadquartersSummary = toInvestigatorHeadquartersPublicSummary(runtime);
  runtime.updatedAt = new Date().toISOString();
  return runtime.investigatorHeadquartersSummary;
}

function activePreparation(runtime: PersistentTownRuntime) {
  const current = currentPreparation(runtime);
  return current?.status === "active" ? current : undefined;
}

export function investigatorHeadquartersReserveDiscount(runtime: PersistentTownRuntime, lane: WorldLeadFocus, caseId?: string) {
  const current = activePreparation(runtime);
  if (!current || current.benefitConsumed || (caseId && current.targetCaseId && current.targetCaseId !== caseId)) return 0;
  const laneForChoice = current.choice === "field-search" ? "search" : current.choice === "witness-work" ? "question" : current.choice === "contradiction-analysis" ? "challenge" : undefined;
  return laneForChoice === lane ? 1 : 0;
}

export function consumeInvestigatorHeadquartersReserveBenefit(runtime: PersistentTownRuntime, input: { lane: WorldLeadFocus; caseId?: string }) {
  const state = ensureInvestigatorHeadquarters(runtime);
  const current = activePreparation(runtime);
  if (!current || current.benefitConsumed || (input.caseId && current.targetCaseId && current.targetCaseId !== input.caseId) || investigatorHeadquartersReserveDiscount(runtime, input.lane, input.caseId) === 0) return false;
  const next = { ...current, benefitConsumed: true };
  runtime.investigatorHeadquarters = { activeId: next.id, items: clampItems(state.items.map((item) => item.id === next.id ? next : item)) };
  runtime.investigatorHeadquartersSummary = toInvestigatorHeadquartersPublicSummary(runtime);
  runtime.updatedAt = new Date().toISOString();
  return true;
}
export function investigatorHeadquartersCanRecover(runtime: PersistentTownRuntime) {
  const current = activePreparation(runtime);
  return Boolean(current?.choice === "evidence-handling" && !current.recoveryUsed);
}

export function consumeInvestigatorHeadquartersRecovery(runtime: PersistentTownRuntime) {
  const state = ensureInvestigatorHeadquarters(runtime);
  const current = activePreparation(runtime);
  if (!current || current.choice !== "evidence-handling" || current.recoveryUsed) return false;
  const next = { ...current, recoveryUsed: true };
  runtime.investigatorHeadquarters = { activeId: next.id, items: clampItems(state.items.map((item) => item.id === next.id ? next : item)) };
  runtime.investigatorHeadquartersSummary = toInvestigatorHeadquartersPublicSummary(runtime);
  runtime.updatedAt = new Date().toISOString();
  return true;
}
