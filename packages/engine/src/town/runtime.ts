export type TownTickPhaseName =
  | "observe"
  | "propagate-memory"
  | "update-goals"
  | "score-actions"
  | "advance-long-actions"
  | "execute-actions"
  | "evolve-relationships-locations"
  | "extract-candidates"
  | "validate-candidates"
  | "finalize"
  | "observe-events"
  | "apply-consequences"
  | "advance-case-chain"
  | "advance-population-flow"
  | "trigger-case";

export const PERSISTENT_TOWN_TICK_PHASES: readonly TownTickPhaseName[] = [
  "observe",
  "propagate-memory",
  "update-goals",
  "score-actions",
  "advance-long-actions",
  "execute-actions",
  "advance-population-flow",
  "evolve-relationships-locations",
  "extract-candidates",
  "validate-candidates",
  "finalize"
];

export type TownPhaseBoundary = {
  name: TownTickPhaseName;
  domain: "observation" | "memory" | "goals" | "actions" | "rules" | "cases" | "finalize";
  purpose: string;
};

export const PERSISTENT_TOWN_PHASE_BOUNDARIES: readonly TownPhaseBoundary[] = [
  { name: "observe", domain: "observation", purpose: "Read current world pressure and location state before any new action is chosen." },
  { name: "propagate-memory", domain: "memory", purpose: "Carry forward already known memories and confidence before goal scoring." },
  { name: "update-goals", domain: "goals", purpose: "Derive NPC agent goals from memories, pressure, relationships, and resources." },
  { name: "score-actions", domain: "actions", purpose: "Score legal instant and long-action candidates with deterministic rule inputs." },
  { name: "advance-long-actions", domain: "rules", purpose: "Tick running long actions before executing fresh instant actions." },
  { name: "execute-actions", domain: "actions", purpose: "Execute selected actions and generate world events." },
  { name: "advance-population-flow", domain: "rules", purpose: "Apply only opt-in, source-backed population changes under a bounded cadence and resident cap." },
  { name: "evolve-relationships-locations", domain: "rules", purpose: "Apply social, organization, public opinion, evidence, and location consequences." },
  { name: "extract-candidates", domain: "cases", purpose: "Build case candidates from the current event and memory ledger." },
  { name: "validate-candidates", domain: "cases", purpose: "Validate candidate playability, evidence support, and hidden-truth safety." },
  { name: "finalize", domain: "finalize", purpose: "Write reports, snapshots, diffs, and run history artifacts." }
];
