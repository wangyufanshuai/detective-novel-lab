import type { PersistentTownRuntime } from "../persistent-town";
import type { WorldEvent, WorldState } from "../world-types";
import { townAbsoluteMinute } from "./resident-work";
import { residentSocialCaution } from "./resident-social-beliefs";

export type ResidentAppointment = {
  id:string; worldId:string; npcIds:[string,string]; locationId:string; proposedMinute:number;
  meetMinute:number; deadlineMinute:number; durationMinutes:15;
  status:"proposed"|"accepted"|"declined"|"running"|"completed"|"missed"|"cancelled";
  reason:string; sourceEventIds:string[]; actionId?:string; completionEventId?:string;
};
export type ResidentAppointments = {schema:"resident-appointments.v1"; items:ResidentAppointment[]; lastProposalDay:Record<string,number>};
export function createResidentAppointments():ResidentAppointments{return{schema:"resident-appointments.v1",items:[],lastProposalDay:{}};}
export function validateResidentAppointments(world:WorldState,runtime:PersistentTownRuntime,sources:ReadonlyMap<string,WorldEvent>){
  const state=runtime.residentLife?.appointments;if(!state)return;
  if(state.schema!=="resident-appointments.v1"||state.items.length>128||new Set(state.items.map(a=>a.id)).size!==state.items.length)throw Error("Invalid appointment ledger");
  for(const a of state.items){
    if(a.worldId!==world.id||a.npcIds.length!==2||new Set(a.npcIds).size!==2||!a.npcIds.every(id=>runtime.residentLife?.people[id])||
      !world.locations.some(place=>place.id===a.locationId)||![a.proposedMinute,a.meetMinute,a.deadlineMinute].every(Number.isSafeInteger)||a.durationMinutes!==15||a.meetMinute<a.proposedMinute+60||a.deadlineMinute!==a.meetMinute+30||
      !["proposed","accepted","declined","running","completed","missed","cancelled"].includes(a.status))throw Error("Invalid appointment context");
    const origin=sources.get(a.sourceEventIds[0]);
    if(!origin||origin.worldId!==world.id||!origin.tags.includes("life_completed")||!origin.tags.includes("socialize")||origin.actorIds.join("\0")!==a.npcIds.join("\0")||
      a.sourceEventIds.some(id=>sources.get(id)?.worldId!==world.id)||new Set(a.sourceEventIds).size!==a.sourceEventIds.length||
      (a.status==="completed"&&(!a.completionEventId||!sources.get(a.completionEventId)?.tags.includes("appointment_meeting")||!sources.get(a.completionEventId)?.tags.includes("life_completed"))))throw Error("Unresolved appointment source");
  }
}
const active=(a:ResidentAppointment)=>["proposed","accepted","running"].includes(a.status);
function at(world:WorldState,runtime:PersistentTownRuntime,a:ResidentAppointment,phase:string,actors:string[],summary:string,causes:string[]):WorldEvent{
  const minute=townAbsoluteMinute(runtime),clock=minute%1440;
  return{id:`${a.id}-${phase}`,worldId:world.id,day:Math.floor(minute/1440)+1,time:`${String(Math.floor(clock/60)).padStart(2,"0")}:${String(clock%60).padStart(2,"0")}`,
    type:"conversation",actorIds:actors,locationId:a.locationId,summary,publicSummary:summary,hidden:false,
    relatedCharacterIds:actors,tags:["resident_appointment",`appointment_${phase}`],causedByEventIds:causes};
}
function travelMinutes(world:WorldState,runtime:PersistentTownRuntime,npcId:string,target:string){
  const map=runtime.mapPacks?.find(m=>m.manifest.id===runtime.dailyRoutine?.mapId),agent=runtime.agentStates.find(a=>a.npcId===npcId);
  if(!map||!agent)return Infinity;
  const pending=[{id:agent.locationId,cost:0}],seen=new Set<string>();
  while(pending.length){pending.sort((a,b)=>a.cost-b.cost||a.id.localeCompare(b.id,"en"));const p=pending.shift()!;if(seen.has(p.id))continue;seen.add(p.id);if(p.id===target)return p.cost;
    for(const edge of map.connections){const next=edge.from===p.id?edge.to:edge.to===p.id?edge.from:null;if(next&&!seen.has(next))pending.push({id:next,cost:p.cost+edge.travelMinutes});}}
  return Infinity;
}
/** A future promise is grounded in a real, jointly completed conversation.
 * The other resident explicitly accepts/declines through a bounded policy.
 * This is deterministic social planning, not generated dialogue or an LLM. */
export function proposeResidentAppointment(world:WorldState,runtime:PersistentTownRuntime,origin:WorldEvent,sources:ReadonlyMap<string,WorldEvent>):WorldEvent[]{
  const life=runtime.residentLife,now=townAbsoluteMinute(runtime);
  if(!life||life.planner.mode!=="offline-agent"||origin.worldId!==world.id||origin.type!=="conversation"||origin.actorIds.length!==2||new Set(origin.actorIds).size!==2||
    !origin.tags.includes("life_completed")||!origin.tags.includes("socialize")||origin.tags.includes("appointment_meeting")||JSON.stringify(sources.get(origin.id))!==JSON.stringify(origin))return[];
  const [h,m]=origin.time.split(":").map(Number);if((origin.day-1)*1440+h*60+m!==now)return[];
  const [proposer,recipient]=origin.actorIds;
  if(!origin.actorIds.every(id=>world.npcs.some(n=>n.id===id&&n.alive)&&runtime.agentStates.some(a=>a.npcId===id&&a.locationId===origin.locationId)&&!runtime.dailyRoutine?.journeys[id]))return[];
  const state=life.appointments??=createResidentAppointments();
  const id=`appointment-${world.id}-${origin.id}`;
  if(state.items.some(item=>item.id===id)||state.items.length>=128||state.lastProposalDay[proposer]===runtime.currentDay||state.items.some(a=>active(a)&&a.npcIds.includes(proposer)))return[];
  let meet=(runtime.currentDay-1)*1440+13*60;
  if(meet<now+60)meet+=1440;
  const endMinute=now+(life.endTick-runtime.tick)*runtime.tickIntervalMinutes;
  if(meet+30>endMinute)return[];
  const appointment:ResidentAppointment={id,worldId:world.id,npcIds:[proposer,recipient],locationId:"cafe",proposedMinute:now,meetMinute:meet,deadlineMinute:meet+30,durationMinutes:15,
    status:"proposed",reason:"completed-conversation",sourceEventIds:[origin.id]};
  const names=origin.actorIds.map(id=>world.npcs.find(n=>n.id===id)!.name);
  const day=Math.floor(meet/1440)+1;
  // Proposal and response happen at their current conversation location. The
  // future meeting place is a separate field, never a fabricated relocation.
  const proposed=at(world,runtime,{...appointment,locationId:origin.locationId},"proposed",[proposer,recipient],`${names[0]}邀请${names[1]}于第${day}日13:00在咖啡馆再聊一刻钟。`,[origin.id]);
  appointment.sourceEventIds.push(proposed.id);state.items.push(appointment);state.lastProposalDay[proposer]=runtime.currentDay;
  const person=life.people[recipient],busy=state.items.some(a=>a.id!==id&&active(a)&&a.npcIds.includes(recipient));
  const trust=(runtime.socialProfiles?.find(p=>p.npcId===recipient)?.trust[proposer]??5)-residentSocialCaution(runtime,recipient,proposer);
  const reason=!person?"unavailable":busy?"existing-promise":person.needs.hunger>=65||person.needs.energy<35?"needs-first":trust<4?"low-trust":
    origin.actorIds.some(id=>travelMinutes(world,runtime,id,"cafe")>30)?"unreachable-in-window":"accepted";
  appointment.status=reason==="accepted"?"accepted":"declined";appointment.reason=reason;
  const response=at(world,runtime,{...appointment,locationId:origin.locationId},appointment.status,[proposer,recipient],`${names[1]}${reason==="accepted"?"答应了这次约定":"婉拒了这次约定"}。`,[proposed.id]);
  appointment.sourceEventIds.push(response.id);return[proposed,response];
}
export function dueResidentAppointment(runtime:PersistentTownRuntime,npcId:string){
  const now=townAbsoluteMinute(runtime);
  return runtime.residentLife?.appointments?.items.find(a=>a.worldId===runtime.worldId&&a.status==="accepted"&&a.npcIds.includes(npcId)&&now>=a.meetMinute-45&&now<=a.deadlineMinute-a.durationMinutes);
}
export function appointmentCanStart(world:WorldState,runtime:PersistentTownRuntime,a:ResidentAppointment){
  const now=townAbsoluteMinute(runtime),life=runtime.residentLife;
  return !!life&&a.worldId===world.id&&a.status==="accepted"&&now>=a.meetMinute&&now+a.durationMinutes<=a.deadlineMinute&&a.npcIds.every(id=>{
    const person=life.people[id];return person&&!person.activeId&&person.needs.hunger<65&&person.needs.energy>=35&&world.npcs.some(n=>n.id===id&&n.alive)&&
      runtime.agentStates.some(agent=>agent.npcId===id&&agent.locationId===a.locationId)&&!runtime.dailyRoutine?.journeys[id]&&!runtime.residentWork?.active[id]&&
      (runtime.dailyRoutine?.holds[id]?.untilTick??-1)<runtime.tick+1&&!runtime.ruleState?.longActions.some(action=>action.actorId===id&&action.status==="running");});
}
/** Resolve only due, unstarted appointments. A no-show is not proof of why
 * somebody was absent. Only residents actually at the meeting get a memory. */
export function expireResidentAppointments(world:WorldState,runtime:PersistentTownRuntime):WorldEvent[]{
  const events:WorldEvent[]=[],now=townAbsoluteMinute(runtime);
  for(const a of runtime.residentLife?.appointments?.items??[]){
    if(a.status!=="accepted")continue;
    const alive=a.npcIds.every(id=>world.npcs.some(n=>n.id===id&&n.alive));
    // Hidden incapacity must not magically inform the other resident. Keep
    // their plan until its start window expires, just like any other no-show.
    if(now<=a.deadlineMinute-a.durationMinutes)continue;
    a.status=alive?"missed":"cancelled";a.reason=alive?"start-window-expired":"participant-unavailable";
    const witnesses=a.npcIds.filter(id=>world.npcs.some(n=>n.id===id&&n.alive)&&runtime.agentStates.some(p=>p.npcId===id&&p.locationId===a.locationId)&&!runtime.dailyRoutine?.journeys[id]);
    const event=at(world,runtime,a,a.status,witnesses,"咖啡馆的这次约定未能如期开始。",a.sourceEventIds.slice(-1));
    if(!witnesses.length){event.hidden=true;event.publicSummary="";}
    a.sourceEventIds.push(event.id);events.push(event);
  }
  return events;
}
export function finishResidentAppointment(runtime:PersistentTownRuntime,appointmentId:string,actionId:string,event:WorldEvent,completed:boolean){
  const a=runtime.residentLife?.appointments?.items.find(a=>a.id===appointmentId);
  if(!a||a.status!=="running"||a.actionId!==actionId||event.worldId!==a.worldId||event.actorIds.join("\0")!==a.npcIds.join("\0")||event.locationId!==a.locationId)return false;
  const action=runtime.residentLife?.active[actionId],now=townAbsoluteMinute(runtime);
  if(!action||action.appointmentId!==a.id||!event.causedByEventIds?.includes(action.startedEventId)||!a.sourceEventIds.includes(action.startedEventId)||
    !event.tags.includes(completed?"life_completed":"life_interrupted")||(completed&&(action.elapsedMinutes<a.durationMinutes||now>a.deadlineMinute||now<a.meetMinute+a.durationMinutes)))return false;
  a.status=completed?"completed":"cancelled";a.reason=completed?"joint-action-completed":"meeting-interrupted";
  a.sourceEventIds.push(event.id);if(completed)a.completionEventId=event.id;return true;
}
