import type { WorldEvent } from "../world-types";
import type { ResidentLifeKind } from "./resident-cognition";

export type ResidentGoalKind = "craft" | "recover" | "connect";
export type ResidentPersonalGoal = {
  id: string; kind: ResidentGoalKind; label: string; priority: number; target: number; progress: number;
  unit: "minutes" | "encounters"; status: "open" | "completed" | "expired";
  credits: Array<{ eventId: string; amount: number }>;
};
export type ResidentAgenda = {
  schema: "resident-agenda.v1"; worldId:string; npcId: string; day: number; commitmentId: string | null;
  goals: ResidentPersonalGoal[];
  history: Array<{ day: number; goals: ResidentPersonalGoal[] }>;
};
const goalKind = (kind: ResidentLifeKind): ResidentGoalKind | null => kind === "occupation" ? "craft" : kind === "rest" || kind === "sleep" ? "recover" : kind === "socialize" ? "connect" : null;
function variation(value: string) { let h=2166136261; for(const c of value){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0)%7; }

/** Authored, stable daily aims. No secrets, case truth or model-generated facts.
 * Progress is sourced from completed actions, never from a planning proposal. */
export function ensureResidentAgenda(input: { worldId: string; seed: string; npcId: string; day: number; previous?: ResidentAgenda }): ResidentAgenda {
  if(input.previous&&(input.previous.worldId!==input.worldId||input.previous.npcId!==input.npcId))throw Error("Resident agenda owner mismatch");
  if(input.previous?.day === input.day) return input.previous;
  const history=input.previous ? [...input.previous.history,{day:input.previous.day,goals:input.previous.goals.map(goal=>({...goal,status:goal.status==="open"?"expired" as const:goal.status}))}].slice(-3) : [];
  const definitions: Array<[ResidentGoalKind,string,number,number,"minutes"|"encounters"]> = [
    ["craft","推进手头事务",26,60,"minutes"], ["recover","留出安静休息的时间",20,30,"minutes"], ["connect","与街坊好好交谈一次",24,1,"encounters"]
  ];
  return {schema:"resident-agenda.v1",worldId:input.worldId,npcId:input.npcId,day:input.day,commitmentId:null,history,
    goals:definitions.map(([kind,label,priority,target,unit])=>({id:`life-goal:${input.worldId}:${input.npcId}:${input.day}:${kind}`,kind,label,
      priority:priority+variation(`${input.seed}:${input.npcId}:${kind}`),target,unit,progress:0,status:"open",credits:[]}))};
}
export function residentGoalForKind(agenda: ResidentAgenda | undefined, kind: ResidentLifeKind) {
  return agenda?.goals.find(goal=>goal.kind===goalKind(kind)&&goal.status==="open");
}
export function commitResidentGoal(agenda: ResidentAgenda | undefined, kind: ResidentLifeKind) {
  if(!agenda)return;
  const goal=residentGoalForKind(agenda,kind);if(goal)agenda.commitmentId=goal.id;
}
export function creditResidentGoal(agenda: ResidentAgenda | undefined, event: WorldEvent, kind: ResidentLifeKind, startedAtMinute: number, durationMinutes: number) {
  if(!agenda||event.worldId!==agenda.worldId||!event.actorIds.includes(agenda.npcId)||!(event.tags.includes("life_completed")||event.tags.includes("work_completed")))return false;
  if(event.tags.includes("resident_life")&&!event.tags.includes(kind))return false;
  const goal=residentGoalForKind(agenda,kind);if(!goal||goal.credits.some(credit=>credit.eventId===event.id))return false;
  const [hour,minute]=event.time.split(":").map(Number),end=(event.day-1)*1440+hour*60+minute;
  const overlap=Math.max(0,Math.min(end,agenda.day*1440)-Math.max(startedAtMinute,(agenda.day-1)*1440));
  const amount=goal.unit==="encounters" ? (event.day===agenda.day?1:0) : Math.min(durationMinutes,overlap,goal.target-goal.progress);
  if(amount<=0||!Number.isFinite(amount))return false;
  goal.progress=Math.min(goal.target,goal.progress+amount);goal.credits.push({eventId:event.id,amount});
  if(goal.progress>=goal.target){goal.status="completed";if(agenda.commitmentId===goal.id)agenda.commitmentId=null;}
  return true;
}
