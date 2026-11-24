import type { WorldState } from "./world-types";
import { buildCasePackage, validateCasePackage, validateCaseSeries, type CasePack, type CasePackage, type CaseScript } from "./case-pack";
import { SEVENTH_MINUTE } from "./cases/seventh-minute";
import { BORROWED_CHISEL } from "./cases/borrowed-chisel";
import { MISSING_FAREWELL_PAGE } from "./cases/missing-farewell-page";
import { SAME_NUMBERED_LUGGAGE } from "./cases/same-numbered-luggage";
import { RETURNED_WINDOW } from "./cases/returned-window";
import { SILENT_TOWER_BELL } from "./cases/silent-tower-bell";
import { EMPTY_EIGHTH_TRAIN } from "./cases/empty-eighth-train";
import { BORROWED_BRIDGE_SEAL } from "./cases/borrowed-bridge-seal";
import { SECOND_SEVEN_RECEIPT } from "./cases/second-seven-receipt";
import { MAP_WITHOUT_NORTH } from "./cases/map-without-north";

/** PRIVATE. Riverbend's authored cases, in play order. Each opens after the
 * previous one is closed. Never import values from this module in a client. */
export const RIVERBEND_CASES: readonly CasePack[] = [SEVENTH_MINUTE, BORROWED_CHISEL, MISSING_FAREWELL_PAGE, SAME_NUMBERED_LUGGAGE, BORROWED_BRIDGE_SEAL, SILENT_TOWER_BELL, RETURNED_WINDOW, EMPTY_EIGHTH_TRAIN, SECOND_SEVEN_RECEIPT, MAP_WITHOUT_NORTH];
export const RIVERBEND_CASE_REVISION = SEVENTH_MINUTE.revision;

export type RiverbendCaseScript = CaseScript;
export type RiverbendCasePackage = CasePackage;

export function riverbendCasePack(key: string) {
  return RIVERBEND_CASES.find(pack => pack.key === key);
}

/** First case, kept under its original name for existing callers and checks. */
export function createRiverbendCase(world: WorldState, now: string): RiverbendCasePackage {
  return buildCasePackage(world, SEVENTH_MINUTE, now);
}

export function validateRiverbendCasePackage(world: WorldState, bundle: RiverbendCasePackage): string[] {
  return validateCasePackage(world, bundle, SEVENTH_MINUTE.window);
}

/** Builds every case against one world and checks they can share its morning. */
export function validateRiverbendCaseSeries(world: WorldState, now: string): string[] {
  return validateCaseSeries(world, RIVERBEND_CASES.map(pack => ({ pack, bundle: buildCasePackage(world, pack, now) })));
}
