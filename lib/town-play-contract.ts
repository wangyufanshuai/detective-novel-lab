import type { townExplorationPlayerView, TownExplorationState } from "@/packages/engine/src/town-exploration";
import type { PlayerTheory } from "@/packages/engine/src/types";
import type { TownObservedMotion } from "@/packages/engine/src/town/observed-passages";

export type TownCaseView = {
  id: string; revision: string; ordinal: string; question: string; title: string; premise: string; brief: string; solved: boolean;
  suspects: Array<{ id: string; name: string; role: string }>;
  clues: Array<{ id: string; title: string; sceneId: string; description: string }>;
  searchTargets: Array<{ id: string; label: string; found: boolean }>;
  /** Places that still hold unchecked items, with a count only; never which items. */
  leads: Array<{ sceneId: string; open: number }>;
  conversations: Array<{ id: string; characterId: string; name: string; question: string; answer: string; evidenceId?: string; corrected: boolean }>;
  questionedIds: string[];
  message?: string;
  lastTheory?: PlayerTheory;
  resolution?: { person: string; headline: string; motive: string; method: string; timeline: Array<{ time: string; event: string }>; ending: string[] };
};
/** The next authored case the player can take, and where its notebook is handed out. */
export type TownCommissionView = { ordinal: string; hook: string; detail: string; openAt: string[]; /** Set while the case waits for a later morning; openAt is then empty. */ opensOnDay?: number };
/** Resting skips to 08:00 the next morning. `wake` is the day it lands on. */
export type TownRestView = { open: true; wakeDay: number } | { open: false; reason: string };
export type TownClosedCaseView = { id: string; ordinal: string; title: string; person: string };
export type TownCaseAction = { kind: "case-open" } | { kind: "case-search"; targetId: string } |
  { kind: "case-question"; characterId: string } | { kind: "case-challenge"; characterId: string; evidenceId: string } |
  { kind: "case-submit"; theory: PlayerTheory };
export type TownPlayAction = { kind: "arrive"; sceneId: string } | { kind: "wait"; minutes: 15 | 30 | 60 } | { kind: "work-enable" } | { kind:"life-enable" } | {kind:"life-mode";mode:"rules"|"offline-agent"} | { kind: "work-step" } | { kind: "work-interrupt"; npcId: string } | { kind: "rest" } | TownCaseAction;

/** Public transport only. The private world, schedules and identity secret must
 * never be attached to this response as extra convenience fields. */
export type TownPlayView = ReturnType<typeof townExplorationPlayerView> & {
  assetSha256: string;
  visitedSceneIds: string[];
  lastArrival?: TownExplorationState["lastArrival"];
  investigation: TownCaseView | null;
  commission?: TownCommissionView | null;
  closedCases?: TownClosedCaseView[];
  residentWorkEnabled?: boolean;
  /** Overnight stay at the inn: open, or closed with the reason shown to the player. */
  rest?: TownRestView | null;
  residentLife?: { schema:"town-resident-life.v1"; elapsedMinutes:number; remainingMinutes:number; plannerMode:"rules"|"offline-agent"; proposalCount:number; modelCalls:0|null; modelAttemptsReserved:number };
};
export type TownPlayCommand = {
  actionId: string;
  expectedSessionRevision: number;
  expectedWorldRevision: number;
} & TownPlayAction;
export type TownPlayResult = { view: TownPlayView; replayed: boolean; motion?: TownObservedMotion };
