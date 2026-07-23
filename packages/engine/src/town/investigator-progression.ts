import type { PersistentTownRuntime, WorldLeadFocus } from "../persistent-town";

export type InvestigatorProgressionKind = "search" | "question" | "challenge" | "evidence-selection" | "accepted-theory";
export type InvestigatorCompetency = "search" | "question" | "challenge" | "evidence-selection" | "case-closure";

export type InvestigatorProgressionEntry = {
  sourceKey: string;
  kind: InvestigatorProgressionKind;
  tick: number;
  amount: number;
};

export type InvestigatorProgressionRuntimeState = {
  points: number;
  competencies: Record<InvestigatorCompetency, number>;
  ledger: InvestigatorProgressionEntry[];
};

export type InvestigatorCompetencyPublicSummary = {
  label: string;
  level: number;
  progressLabel: string;
};

export type InvestigatorProgressionPublicSummary = {
  status: "developing" | "established";
  points: number;
  competencyLabels: InvestigatorCompetencyPublicSummary[];
  unlockedLabels: string[];
  nextAction: string;
};

const MAX_POINTS = 15;
const MAX_LEVEL = 3;
const MAX_LEDGER = 64;

const COMPETENCY_LABELS: Record<InvestigatorCompetency, string> = {
  search: "Field Search",
  question: "Witness Questioning",
  challenge: "Contradiction Challenge",
  "evidence-selection": "Evidence Selection",
  "case-closure": "Case Closure"
};

const KIND_TO_COMPETENCY: Record<InvestigatorProgressionKind, InvestigatorCompetency> = {
  search: "search",
  question: "question",
  challenge: "challenge",
  "evidence-selection": "evidence-selection",
  "accepted-theory": "case-closure"
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function emptyCompetencies(): Record<InvestigatorCompetency, number> {
  return {
    search: 0,
    question: 0,
    challenge: 0,
    "evidence-selection": 0,
    "case-closure": 0
  };
}

export function ensureInvestigatorProgression(runtime: PersistentTownRuntime) {
  if (!runtime.investigatorProgression) {
    runtime.investigatorProgression = {
      points: 0,
      competencies: emptyCompetencies(),
      ledger: []
    };
  } else {
    runtime.investigatorProgression.competencies = {
      ...emptyCompetencies(),
      ...runtime.investigatorProgression.competencies
    };
    runtime.investigatorProgression.ledger = Array.isArray(runtime.investigatorProgression.ledger)
      ? runtime.investigatorProgression.ledger.slice(-MAX_LEDGER)
      : [];
    runtime.investigatorProgression.points = clamp(runtime.investigatorProgression.points || 0, 0, MAX_POINTS);
  }
  return runtime.investigatorProgression;
}

function unlockLabels(state: InvestigatorProgressionRuntimeState) {
  const unlocked: string[] = [];
  if (state.competencies.search >= 2) unlocked.push("Search reserve efficiency");
  if (state.competencies.question >= 2) unlocked.push("Question reserve efficiency");
  if (state.competencies.challenge >= 2) unlocked.push("Challenge reserve efficiency");
  if (state.competencies["case-closure"] >= 2) unlocked.push("One safer offer recovery retry");
  return unlocked;
}

export function toInvestigatorProgressionPublicSummary(runtime: PersistentTownRuntime): InvestigatorProgressionPublicSummary {
  const state = ensureInvestigatorProgression(runtime);
  const competencyLabels = (Object.keys(COMPETENCY_LABELS) as InvestigatorCompetency[]).map((key) => {
    const level = state.competencies[key] || 0;
    return {
      label: COMPETENCY_LABELS[key],
      level,
      progressLabel: `${level}/${MAX_LEVEL} practice marks`
    };
  });
  const unlockedLabels = unlockLabels(state);
  return {
    status: state.points >= 5 ? "established" : "developing",
    points: state.points,
    competencyLabels,
    unlockedLabels,
    nextAction: state.points === 0
      ? "Complete a manual Search, Question, Challenge, evidence selection, or accepted theory to build investigator practice."
      : unlockedLabels.length
        ? "Use the unlocked bounded efficiency or recovery option on a future case; current-case fairness stays unchanged."
        : "Keep completing visible manual investigation steps to unlock one bounded future-world option."
  };
}

export function recordInvestigatorProgression(
  runtime: PersistentTownRuntime,
  input: { sourceKey: string; kind: InvestigatorProgressionKind; amount?: number }
) {
  const state = ensureInvestigatorProgression(runtime);
  if (state.ledger.some((entry) => entry.sourceKey === input.sourceKey)) {
    runtime.investigatorProgressionSummary = toInvestigatorProgressionPublicSummary(runtime);
    return runtime.investigatorProgressionSummary;
  }
  const amount = clamp(input.amount || 1, 1, 2);
  const competency = KIND_TO_COMPETENCY[input.kind];
  state.points = clamp(state.points + amount, 0, MAX_POINTS);
  state.competencies[competency] = clamp((state.competencies[competency] || 0) + amount, 0, MAX_LEVEL);
  state.ledger = [...state.ledger, { sourceKey: input.sourceKey, kind: input.kind, tick: runtime.tick, amount }].slice(-MAX_LEDGER);
  runtime.investigatorProgressionSummary = toInvestigatorProgressionPublicSummary(runtime);
  runtime.updatedAt = new Date().toISOString();
  return runtime.investigatorProgressionSummary;
}

export function investigatorProgressionReserveDiscount(runtime: PersistentTownRuntime, lane: WorldLeadFocus) {
  const state = ensureInvestigatorProgression(runtime);
  const competency = lane === "search" ? "search" : lane === "question" ? "question" : "challenge";
  return state.competencies[competency] >= 2 ? 1 : 0;
}

export function investigatorProgressionCanRecoverOffer(runtime: PersistentTownRuntime) {
  return ensureInvestigatorProgression(runtime).competencies["case-closure"] >= 2;
}
