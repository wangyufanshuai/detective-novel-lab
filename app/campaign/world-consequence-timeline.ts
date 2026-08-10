export type WorldConsequenceKind = "world-lead" | "world-arc" | "directive" | "pressure" | "recovery" | "reaction";
export type WorldConsequenceBeatState = "inactive" | "pending" | "current" | "completed" | "blocked";

export type WorldConsequencePublicStatus = {
  status?: string;
  label?: string;
  headline?: string;
  nextAction?: string;
  progressLabel?: string;
  directionLabel?: string;
};

export type WorldConsequenceTimelineInput = {
  worldLead?: WorldConsequencePublicStatus;
  worldArc?: WorldConsequencePublicStatus;
  directive?: WorldConsequencePublicStatus;
  pressure?: WorldConsequencePublicStatus;
  recovery?: WorldConsequencePublicStatus;
  socialResponse?: WorldConsequencePublicStatus;
};

export type WorldConsequenceTimeline = {
  state: "empty" | "active" | "blocked" | "settled";
  headline: string;
  summary: string;
  nextAction: string;
  currentKind?: WorldConsequenceKind;
  beats: Array<{
    kind: WorldConsequenceKind;
    title: string;
    state: WorldConsequenceBeatState;
    summary: string;
  }>;
};

const RAW_IDENTIFIER_RE = /\b(?:npc|case|event|source|location|institution|resource|evidence|scene|session|character)-[a-z0-9-]*\d[a-z0-9-]*\b/gi;

function safeText(value: string | undefined, fallback: string): string {
  return (value || fallback).replace(RAW_IDENTIFIER_RE, "a recorded world signal").replace(/\s+/g, " ").trim().slice(0, 180);
}

function statusState(kind: WorldConsequenceKind, status = ""): WorldConsequenceBeatState {
  const normalized = status.toLowerCase();
  if (!normalized || normalized === "empty" || normalized === "not-used") return "inactive";
  if (normalized.includes("blocked") || normalized.includes("failed")) return "blocked";
  if (["completed", "settled", "consumed", "resolved", "skipped", "declined"].some((value) => normalized.includes(value))) return "completed";
  if (["pending", "offered"].some((value) => normalized.includes(value))) return kind === "world-lead" ? "current" : "pending";
  if (["ready", "active", "running", "scheduled", "followed", "accepted"].some((value) => normalized.includes(value))) return "current";
  return "pending";
}

const BEAT_DEFINITIONS: ReadonlyArray<{ kind: WorldConsequenceKind; title: string; priority: number; fallback: string }> = Object.freeze([
  { kind: "world-lead", title: "World Lead", priority: 70, fallback: "No world lead decision is active." },
  { kind: "world-arc", title: "World Arc", priority: 40, fallback: "No campaign arc change is active." },
  { kind: "directive", title: "Faction Directive", priority: 80, fallback: "No faction operation is active." },
  { kind: "pressure", title: "World Pressure", priority: 60, fallback: "No cross-case pressure is active." },
  { kind: "recovery", title: "Campaign Recovery", priority: 90, fallback: "No recovery action is required." },
  { kind: "reaction", title: "Town Reaction", priority: 50, fallback: "No public town reaction is active." }
]);

/** Aggregates already-public summaries. It never reads or changes runtime authority. */
export function deriveWorldConsequenceTimeline(input: WorldConsequenceTimelineInput): WorldConsequenceTimeline {
  const sourceByKind: Record<WorldConsequenceKind, WorldConsequencePublicStatus | undefined> = {
    "world-lead": input.worldLead,
    "world-arc": input.worldArc,
    directive: input.directive,
    pressure: input.pressure,
    recovery: input.recovery,
    reaction: input.socialResponse
  };
  const beats = BEAT_DEFINITIONS.map((definition) => {
    const source = sourceByKind[definition.kind];
    return {
      kind: definition.kind,
      title: definition.title,
      state: statusState(definition.kind, source?.status),
      summary: safeText(source?.headline || source?.progressLabel || source?.directionLabel || source?.label || source?.nextAction, definition.fallback)
    };
  });
  const ranked = beats
    .filter((beat) => beat.state === "current" || beat.state === "blocked")
    .map((beat) => ({ beat, priority: (beat.state === "blocked" ? 100 : 0) + (BEAT_DEFINITIONS.find((definition) => definition.kind === beat.kind)?.priority || 0) }))
    .sort((left, right) => right.priority - left.priority || left.beat.kind.localeCompare(right.beat.kind));
  const current = ranked[0]?.beat;
  const source = current ? sourceByKind[current.kind] : undefined;
  const visibleBeats = beats.map((beat) => beat.state === "current" && beat.kind !== current?.kind ? { ...beat, state: "pending" as const } : beat);
  const activeCount = beats.filter((beat) => beat.state !== "inactive").length;
  const completedCount = beats.filter((beat) => beat.state === "completed").length;
  return {
    state: current?.state === "blocked" ? "blocked" : current ? "active" : activeCount > 0 && completedCount === activeCount ? "settled" : "empty",
    headline: current?.title || (completedCount ? "World consequences settled" : "World state stable"),
    summary: current?.summary || (completedCount ? `${completedCount} world consequence beats are settled.` : "Player-facing world consequences will appear here after a real campaign choice."),
    nextAction: safeText(source?.nextAction, current ? "Complete the current player-facing world beat." : "Continue the certified investigation route."),
    currentKind: current?.kind,
    beats: visibleBeats
  };
}
