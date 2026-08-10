import type { TownMapLensKind, TownMapLensLocationSignal, TownMapLensTone } from "./town-map-lens-model";
import type {
  StrategicCommandAction,
  StrategicCommandViewModel,
  StrategicDecisionKind
} from "./strategic-command-model";
import type { WorldConsequenceKind } from "./world-consequence-timeline";

export type DistrictStrategicFrontKind = "investigation" | "institution" | "pressure";
export type DistrictStrategicFrontState = "current" | "available" | "watch" | "readonly";

export type DistrictStrategicFront = {
  key: DistrictStrategicFrontKind;
  label: string;
  districtLabel: string;
  lens: TownMapLensKind;
  tone: TownMapLensTone;
  state: DistrictStrategicFrontState;
  summary: string;
  whyNow: string;
  benefitLabel: string;
  costLabel: string;
  nextAction: string;
  action?: StrategicCommandAction;
};

export type DistrictStrategicFrontsViewModel = {
  status: "empty" | "ready" | "readonly";
  currentFrontKey?: DistrictStrategicFrontKind;
  fronts: DistrictStrategicFront[];
  boundary: string;
};

const FRONT_ORDER: readonly DistrictStrategicFrontKind[] = ["investigation", "institution", "pressure"];
const TONE_WEIGHT: Record<TownMapLensTone, number> = { quiet: 0, watch: 1, high: 2 };
const SAFE_BOUNDARY = "Front selection changes map focus only. Existing handlers own every resource, tick, world, and case result.";
const RAW_IDENTIFIER_RE = /\b(?:npc|case|event|source|location|institution|resource|evidence|scene|session|character)-[a-z0-9-]*\d[a-z0-9-]*\b/gi;

const ACTION_FRONT: Record<StrategicDecisionKind, DistrictStrategicFrontKind> = {
  campaign: "institution",
  "certified-investigation": "investigation",
  "campaign-recovery": "pressure",
  "world-lead": "pressure",
  "faction-directive": "institution",
  "world-event-offer": "pressure",
  "outcome-review": "pressure",
  headquarters: "institution",
  operations: "investigation",
  "advance-town": "pressure",
  "next-case": "pressure"
};

const CONSEQUENCE_FRONT: Record<WorldConsequenceKind, DistrictStrategicFrontKind> = {
  "world-lead": "pressure",
  "world-arc": "institution",
  directive: "institution",
  pressure: "pressure",
  recovery: "pressure",
  reaction: "pressure"
};

function safeText(value: string | undefined, fallback: string) {
  return (value || fallback)
    .replace(RAW_IDENTIFIER_RE, "a recorded public signal")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function cloneAction(action: StrategicCommandAction | undefined): StrategicCommandAction | undefined {
  return action ? {
    ...action,
    label: safeText(action.label, "Continue existing action"),
    detail: safeText(action.detail, "Continue through the existing handler."),
    benefitLabel: safeText(action.benefitLabel, "Existing public benefit"),
    costLabel: safeText(action.costLabel, SAFE_BOUNDARY),
    disabledReason: action.disabledReason ? safeText(action.disabledReason, "Existing prerequisite is not ready.") : undefined
  } : undefined;
}

function toneFor(signal: TownMapLensLocationSignal, lens: TownMapLensKind) {
  if (lens === "institution") return signal.institutionTone;
  if (lens === "pressure") return signal.pressureTone;
  if (lens === "reaction") return signal.reactionTone;
  return signal.evidenceTone;
}

function labelFor(signal: TownMapLensLocationSignal, lens: TownMapLensKind) {
  if (lens === "institution") return signal.institutionLabel;
  if (lens === "pressure") return signal.pressureLabel;
  if (lens === "reaction") return signal.reactionLabel;
  return signal.evidenceLabel;
}

function pressureLens(signal: TownMapLensLocationSignal): TownMapLensKind {
  return TONE_WEIGHT[signal.reactionTone] > TONE_WEIGHT[signal.pressureTone] ? "reaction" : "pressure";
}

function pickSignal(signals: readonly TownMapLensLocationSignal[], kind: DistrictStrategicFrontKind) {
  const ranked = signals.map((signal) => {
    const lens = kind === "investigation" ? "evidence" : kind === "institution" ? "institution" : pressureLens(signal);
    return { signal, lens, score: TONE_WEIGHT[toneFor(signal, lens)] };
  }).sort((left, right) => right.score - left.score || left.signal.locationName.localeCompare(right.signal.locationName));
  return ranked[0];
}

function frontLabel(kind: DistrictStrategicFrontKind) {
  if (kind === "investigation") return "Investigation Front";
  if (kind === "institution") return "Institution Front";
  return "Pressure Front";
}

function matchingAction(command: StrategicCommandViewModel, kind: DistrictStrategicFrontKind) {
  return command.decisionQueue.find((action) => action.enabled && ACTION_FRONT[action.kind] === kind);
}

function buildFront(command: StrategicCommandViewModel, kind: DistrictStrategicFrontKind, current: DistrictStrategicFrontKind | undefined): DistrictStrategicFront | undefined {
  const rankedSignal = pickSignal(command.mapLenses.locationSignals, kind);
  const signal = rankedSignal?.signal;
  const lens = rankedSignal?.lens || (kind === "investigation" ? "evidence" : kind === "institution" ? "institution" : "pressure");
  const action = command.runtimeMode === "server" ? matchingAction(command, kind) : undefined;
  if (!signal && !action) return undefined;
  const summary = signal ? labelFor(signal, lens) : command.mapLenses.controls.find((control) => control.kind === lens)?.summary || "Townwide signal stable";
  const tone = signal ? toneFor(signal, lens) : "quiet";
  const state: DistrictStrategicFrontState = command.runtimeMode === "static-demo"
    ? "readonly"
    : current === kind
      ? "current"
      : action
        ? "available"
        : tone === "quiet" ? "watch" : "available";
  return {
    key: kind,
    label: frontLabel(kind),
    districtLabel: safeText(signal?.locationName, "Townwide"),
    lens,
    tone,
    state,
    summary: safeText(summary, "Townwide signal stable"),
    whyNow: safeText(action?.detail, command.worldConsequenceTimeline.currentKind && CONSEQUENCE_FRONT[command.worldConsequenceTimeline.currentKind] === kind
      ? command.worldConsequenceTimeline.summary
      : summary),
    benefitLabel: safeText(action?.benefitLabel, summary),
    costLabel: safeText(action?.costLabel, SAFE_BOUNDARY),
    nextAction: safeText(action?.label, command.runtimeMode === "static-demo" ? "Server Runtime enables front actions." : command.currentObjective.nextAction),
    action: cloneAction(action)
  } satisfies DistrictStrategicFront;
}

/** Pure public-safe spatial projection over existing map signals and Strategic Command actions. */
export function buildDistrictStrategicFrontsViewModel(command: StrategicCommandViewModel): DistrictStrategicFrontsViewModel {
  const primaryKind = command.primaryAction ? ACTION_FRONT[command.primaryAction.kind] : undefined;
  const consequenceKind = command.worldConsequenceTimeline.currentKind
    ? CONSEQUENCE_FRONT[command.worldConsequenceTimeline.currentKind]
    : undefined;
  const initialCurrent = primaryKind || consequenceKind;
  const provisional = FRONT_ORDER
    .map((kind) => buildFront(command, kind, initialCurrent))
    .filter((front): front is DistrictStrategicFront => Boolean(front))
    .slice(0, 3);
  const currentFrontKey = provisional.some((front) => front.key === initialCurrent)
    ? initialCurrent
    : provisional[0]?.key;
  const fronts = provisional.map((front) => ({
    ...front,
    state: command.runtimeMode === "static-demo" ? "readonly" as const : front.key === currentFrontKey ? "current" as const : front.state,
    action: cloneAction(front.action)
  }));
  return {
    status: fronts.length === 0 ? "empty" : command.runtimeMode === "static-demo" ? "readonly" : "ready",
    currentFrontKey,
    fronts,
    boundary: SAFE_BOUNDARY
  };
}
