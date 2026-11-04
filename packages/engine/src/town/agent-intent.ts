import { EXPLORATION_PLACES, type ExplorationPlaceId, type ExplorationObservation } from "./agent-observation";
import { resolveAgentSourceRefs } from "./agent-control";
import { prepareResidentWorkDecision, queueResidentWorkDecision, residentWorkDecisionId } from "./resident-work";
import type { ResidentWorkContext, ResidentWorkChoice } from "./resident-work";
import type { WorldState } from "../world-types";
import type { PersistentTownRuntime } from "../persistent-town";

export type ExplorationAction = { kind: "arrive"; sceneId: ExplorationPlaceId } | { kind: "wait"; minutes: 15 } | { kind:"life-enable" } | {kind:"life-mode"; mode:"rules"|"offline-agent"};
export type ExplorationIntent = {
  schema: "agent-first-intent.v1"; actionId: string; expectedSessionRevision: number; expectedWorldRevision: number;
  reason: string; sourceRefs: string[]; action: ExplorationAction;
};
export type RefereeCode = "BAD_INTENT" | "FORBIDDEN_FIELD" | "MISSING_SOURCE" | "UNKNOWN_SOURCE" | "STATE_CHANGED" | "ACTION_REUSED" | "PLACE_CLOSED" | "RESIDENT_REFUSED";
export class RefereeRejection extends Error {
  readonly schema = "agent-first-refusal.v1";
  constructor(public code: RefereeCode, message: string, public status = 400) { super(message); }
}
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function exact(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some(key => !keys.includes(key))) throw new RefereeRejection("FORBIDDEN_FIELD", "这个动作包含不允许改写的字段。");
}
/** Parse unknown input before touching the world or the durable retry ledger. */
export function parseExplorationIntent(value: unknown): ExplorationIntent {
  if (!object(value)) throw new RefereeRejection("BAD_INTENT", "动作格式未能读取。");
  exact(value, ["schema", "actionId", "expectedSessionRevision", "expectedWorldRevision", "reason", "sourceRefs", "action"]);
  if (value.schema !== "agent-first-intent.v1" || typeof value.actionId !== "string" || !/^[a-zA-Z0-9_-]{1,120}$/.test(value.actionId) ||
    !Number.isSafeInteger(value.expectedSessionRevision) || (value.expectedSessionRevision as number) < 0 ||
    !Number.isSafeInteger(value.expectedWorldRevision) || (value.expectedWorldRevision as number) < 0 ||
    typeof value.reason !== "string" || !value.reason.trim() || value.reason.length > 240)
    throw new RefereeRejection("BAD_INTENT", "请根据当前手记重新选择行动。");
  if (!Array.isArray(value.sourceRefs) || !value.sourceRefs.length) throw new RefereeRejection("MISSING_SOURCE", "这个动作需要引用当前观察。");
  if (value.sourceRefs.length > 12 || value.sourceRefs.some(ref => typeof ref !== "string" || ref.length > 240) || new Set(value.sourceRefs).size !== value.sourceRefs.length)
    throw new RefereeRejection("BAD_INTENT", "观察引用无效。");
  const action = value.action;
  if (!object(action)) throw new RefereeRejection("BAD_INTENT", "请选择到访或等待。");
  exact(action, action.kind === "arrive" ? ["kind", "sceneId"] : action.kind==="life-enable"?["kind"]:action.kind==="life-mode"?["kind","mode"]:["kind", "minutes"]);
  if (action.kind === "arrive") {
    if (!EXPLORATION_PLACES.some(place => place.id === action.sceneId)) throw new RefereeRejection("PLACE_CLOSED", "这处地点尚未开放。");
  } else if(action.kind==="life-mode") {
    if(!["rules","offline-agent"].includes(action.mode as string))throw new RefereeRejection("BAD_INTENT","请选择日程或目标安排。 ");
  } else if (action.kind !== "life-enable" && (action.kind !== "wait" || action.minutes !== 15)) throw new RefereeRejection("BAD_INTENT", "请选择到访、等待或启用三日生活。");
  return { schema: "agent-first-intent.v1", actionId: value.actionId, reason: value.reason.trim(),
    expectedSessionRevision: value.expectedSessionRevision as number, expectedWorldRevision: value.expectedWorldRevision as number,
    sourceRefs: [...value.sourceRefs] as string[], action: { ...action } as ExplorationAction };
}
export function admitExplorationIntent(intent: ExplorationIntent, observation: ExplorationObservation) {
  if (intent.expectedSessionRevision !== observation.revision || intent.expectedWorldRevision !== observation.worldRevision)
    throw new RefereeRejection("STATE_CHANGED", "小镇已更新，请刷新手记再继续。", 409);
  if (!resolveAgentSourceRefs({ sourceRefs: intent.sourceRefs, availableRefs: [observation.sourceRef] }).ok)
    throw new RefereeRejection("UNKNOWN_SOURCE", "引用不属于这份当前观察。");
  if(intent.action.kind==="life-mode"&&!observation.life)throw new RefereeRejection("BAD_INTENT","请先启用三日生活。",409);
  return { ...intent.action, actionId: intent.actionId, expectedSessionRevision: intent.expectedSessionRevision, expectedWorldRevision: intent.expectedWorldRevision };
}

/** Resident planning stays separate from the public visitor command surface.
 * Admission delegates to the existing legal-candidate and budget referee.
 * Callers must commit this mutation under world CAS; no new simulator lives here. */
export type ResidentIntent = { schema: "resident-intent.v1"; actionId: string; sourceRefs: string[]; reason: string;
  context: ResidentWorkContext; choice: ResidentWorkChoice };
export function admitResidentIntent(world: WorldState, runtime: PersistentTownRuntime, intent: ResidentIntent) {
  const fresh = prepareResidentWorkDecision(world, runtime, intent.context.npcId);
  if (intent.schema !== "resident-intent.v1" || !intent.reason.trim() || intent.reason.length > 240 || !fresh || JSON.stringify(fresh) !== JSON.stringify(intent.context))
    throw new RefereeRejection("STATE_CHANGED", "居民的行动条件已经变化。", 409);
  const ref = `observation:${residentWorkDecisionId(fresh)}`;
  if (!intent.sourceRefs.length) throw new RefereeRejection("MISSING_SOURCE", "居民行动缺少观察来源。");
  if (intent.actionId !== residentWorkDecisionId(fresh) || !resolveAgentSourceRefs({ sourceRefs: intent.sourceRefs, availableRefs: [ref] }).ok)
    throw new RefereeRejection("UNKNOWN_SOURCE", "居民行动引用无法解析。");
  try { return queueResidentWorkDecision(world, runtime, fresh, intent.choice); }
  catch { throw new RefereeRejection("RESIDENT_REFUSED", "居民提案未通过合法候选、预算或既有决定检查。", 409); }
}
