import type { PersistentTownRuntime } from "../persistent-town";
import type { WorldEvent, WorldState } from "../world-types";
import { townAbsoluteMinute } from "./resident-work";

export type AppointmentBelief = {
  appointmentId:string; npcId:string; peerId:string; locationId:string; deadlineMinute:number;
  observation:"agreed"|"declined"|"fulfilled"|"interrupted"|"unfulfilled-observed"|"self-unfulfilled";
  peerWasPresent?:boolean; acceptedEventId:string; observedEventId:string;
  reports:Array<{eventId:string;speakerId:string;verification:"unverified"}>;
};
export type ResidentSocialBeliefs = {schema:"resident-social-beliefs.v1";records:Record<string,AppointmentBelief>};
const key=(appointmentId:string,npcId:string)=>`${appointmentId}:${npcId}`;
const nowOf=(event:WorldEvent)=>{const [h,m]=event.time.split(":").map(Number);return(event.day-1)*1440+h*60+m;};
const ownedMemory=(world:WorldState,npcId:string,eventId:string)=>world.memories.some(m=>m.worldId===world.id&&m.npcId===npcId&&m.eventId===eventId);
function ledger(runtime:PersistentTownRuntime){return runtime.residentLife!.socialBeliefs??={schema:"resident-social-beliefs.v1",records:{}};}

/** Called only after a participant's actual event memory has been written.
 * World-level appointment status and refusal/no-show reasons never set beliefs. */
export function observeResidentSocialEvent(world:WorldState,runtime:PersistentTownRuntime,event:WorldEvent){
  if(!runtime.residentLife||event.worldId!==world.id)return;
  const appointment=runtime.residentLife.appointments?.items.find(a=>a.sourceEventIds.includes(event.id)||!!event.intentId&&(a.actionId===event.intentId||a.id===event.intentId));
  if(!appointment)return;
  const isAccepted=event.tags.includes("appointment_accepted"),isDeclined=event.tags.includes("appointment_declined"),isMeeting=event.tags.includes("appointment_meeting"),isOutcome=event.tags.includes("appointment_missed")||event.tags.includes("appointment_cancelled");
  const isSelf=event.tags.includes("self_unfulfilled"),isReport=event.tags.includes("social_account");
  if(!isAccepted&&!isDeclined&&!isMeeting&&!isOutcome&&!isSelf&&!isReport)return;
  if(isMeeting&&!event.tags.includes("life_completed")&&!event.tags.includes("life_interrupted"))return;
  const state=ledger(runtime);
  for(const npcId of event.actorIds){
    if(!appointment.npcIds.includes(npcId)||!ownedMemory(world,npcId,event.id))continue;
    const id=key(appointment.id,npcId);let belief=state.records[id];
    if(!belief){
      const accepted=appointment.sourceEventIds.find(id=>id.endsWith("-accepted")&&ownedMemory(world,npcId,id));
      if(!isAccepted&&!isDeclined&&!accepted)continue;
      if(Object.keys(state.records).length>=256)throw Error("Social belief ledger is full");
      belief={appointmentId:appointment.id,npcId,peerId:appointment.npcIds.find(id=>id!==npcId)!,locationId:appointment.locationId,deadlineMinute:appointment.deadlineMinute,
        observation:isDeclined?"declined":"agreed",acceptedEventId:accepted??event.id,observedEventId:event.id,reports:[]};state.records[id]=belief;
    }
    if(isReport){
      const speakerId=event.actorIds.find(id=>event.tags.includes(`speaker:${id}`));
      if(speakerId&&speakerId!==npcId&&!belief.reports.some(r=>r.eventId===event.id))belief.reports.push({eventId:event.id,speakerId,verification:"unverified"});
      continue;
    }
    if(isMeeting)belief.observation=event.tags.includes("life_completed")?"fulfilled":"interrupted";
    else if(isOutcome){belief.observation="unfulfilled-observed";belief.peerWasPresent=event.actorIds.includes(belief.peerId);}
    else if(isSelf)belief.observation="self-unfulfilled";
    else if(isDeclined)belief.observation="declined";
    belief.observedEventId=event.id;
  }
}
/** Legacy reconstruction uses only owned source memories, on a clock boundary.
 * It does not install knowledge just because a global record says 'completed'. */
export function seedResidentSocialBeliefs(world:WorldState,runtime:PersistentTownRuntime,sources:ReadonlyMap<string,WorldEvent>){
  if(!runtime.residentLife?.appointments||runtime.residentLife.socialBeliefs)return;
  ledger(runtime);
  for(const event of [...sources.values()].filter(e=>e.tags.includes("resident_appointment")||e.tags.includes("appointment_meeting")||e.tags.includes("resident_social_belief")).sort((a,b)=>nowOf(a)-nowOf(b)||a.id.localeCompare(b.id,"en")))observeResidentSocialEvent(world,runtime,event);
}
export function validateResidentSocialBeliefs(world:WorldState,runtime:PersistentTownRuntime,sources:ReadonlyMap<string,WorldEvent>){
  const state=runtime.residentLife?.socialBeliefs;if(!state)return;
  if(state.schema!=="resident-social-beliefs.v1"||Object.keys(state.records).length>256)throw Error("Invalid social belief ledger");
  const ownership=new Set(world.memories.filter(m=>m.worldId===world.id).map(m=>`${m.npcId}\0${m.eventId}`));
  for(const [id,b] of Object.entries(state.records)){
    const a=runtime.residentLife?.appointments?.items.find(a=>a.id===b.appointmentId);
    if(!a||id!==key(a.id,b.npcId)||!a.npcIds.includes(b.npcId)||b.peerId!==a.npcIds.find(p=>p!==b.npcId)||b.locationId!==a.locationId||b.deadlineMinute!==a.deadlineMinute||
      !["agreed","declined","fulfilled","interrupted","unfulfilled-observed","self-unfulfilled"].includes(b.observation))throw Error("Invalid personal belief owner");
    for(const eventId of [b.acceptedEventId,b.observedEventId,...b.reports.map(r=>r.eventId)]){
      const event=sources.get(eventId);if(!event||event.worldId!==world.id||!event.actorIds.includes(b.npcId)||!ownership.has(`${b.npcId}\0${eventId}`))throw Error("Unresolved personal belief source");
    }
    const observation=sources.get(b.observedEventId)!;
    if(!a.sourceEventIds.includes(b.acceptedEventId)||!sources.get(b.acceptedEventId)?.tags.some(tag=>tag==="appointment_accepted"||tag==="appointment_declined")||
      (!a.sourceEventIds.includes(b.observedEventId)&&!(observation.tags.includes("self_unfulfilled")&&observation.intentId===a.id)))throw Error("Belief refers to another appointment");
    const phase=b.observation==="fulfilled"?observation.tags.includes("appointment_meeting")&&observation.tags.includes("life_completed"):
      b.observation==="interrupted"?observation.tags.includes("appointment_meeting")&&observation.tags.includes("life_interrupted"):
      b.observation==="self-unfulfilled"?observation.tags.includes("self_unfulfilled"):
      b.observation==="unfulfilled-observed"?(observation.tags.includes("appointment_missed")||observation.tags.includes("appointment_cancelled"))&&b.peerWasPresent===observation.actorIds.includes(b.peerId):
      observation.tags.includes(b.observation==="declined"?"appointment_declined":"appointment_accepted");
    if(!phase||new Set(b.reports.map(r=>r.eventId)).size!==b.reports.length||b.reports.length>1||b.reports.some(r=>r.verification!=="unverified"||r.speakerId!==b.peerId||sources.get(r.eventId)?.intentId!==a.id||!sources.get(r.eventId)?.tags.includes("social_account")||!sources.get(r.eventId)?.tags.includes(`speaker:${r.speakerId}`)))throw Error("Invalid belief observation or report");
  }
}
export function residentSocialCaution(runtime:PersistentTownRuntime,npcId:string,peerId:string){
  const records=Object.values(runtime.residentLife?.socialBeliefs?.records??{});
  return Math.min(.9,records.filter(b=>b.npcId===npcId&&b.peerId===peerId&&b.observation==="unfulfilled-observed"&&b.peerWasPresent===false).reduce((sum,b)=>sum+(b.reports.length ? .1 : .3),0));
}
export function advanceResidentSocialBeliefs(world:WorldState,runtime:PersistentTownRuntime):WorldEvent[]{
  const events:WorldEvent[]=[],now=townAbsoluteMinute(runtime);
  for(const b of Object.values(runtime.residentLife?.socialBeliefs?.records??{})){
    if(b.observation!=="agreed"||now<=b.deadlineMinute||!world.npcs.some(n=>n.id===b.npcId&&n.alive))continue;
    const agent=runtime.agentStates.find(a=>a.npcId===b.npcId);if(!agent)continue;
    const clock=now%1440;
    events.push({id:`belief-${b.appointmentId}-${b.npcId}-self-unfulfilled`,worldId:world.id,day:runtime.currentDay,time:`${String(Math.floor(clock/60)).padStart(2,"0")}:${String(clock%60).padStart(2,"0")}`,
      type:"conversation",actorIds:[b.npcId],locationId:agent.locationId,summary:"约定时间已过，我没有完成这次见面；我不知道对方那时的情况。",publicSummary:"",hidden:true,
      relatedCharacterIds:[b.npcId],tags:["resident_social_belief","self_unfulfilled"],intentId:b.appointmentId,causedByEventIds:[b.acceptedEventId]});
  }
  return events;
}
function pendingPair(runtime:PersistentTownRuntime,a:string,b:string){
  const records=runtime.residentLife?.socialBeliefs?.records??{};
  return Object.values(records).find(r=>r.npcId===a&&r.peerId===b&&r.observation==="unfulfilled-observed"&&r.peerWasPresent===false&&!r.reports.length&&records[key(r.appointmentId,b)]?.observation==="self-unfulfilled");
}
export function hasResidentFollowup(runtime:PersistentTownRuntime,a:string,b:string){return Object.values(runtime.residentLife?.socialBeliefs?.records??{}).some(r=>r.npcId===a&&r.peerId===b&&r.observation==="unfulfilled-observed"&&r.peerWasPresent===false&&!r.reports.length);}
export function completeResidentFollowup(world:WorldState,runtime:PersistentTownRuntime,conversation:WorldEvent):WorldEvent[]{
  if(conversation.worldId!==world.id||conversation.actorIds.length!==2||!conversation.tags.includes("life_completed")||!conversation.tags.includes("socialize"))return[];
  const [a,b]=conversation.actorIds,waiting=pendingPair(runtime,a,b)??pendingPair(runtime,b,a);if(!waiting)return[];
  // A report can only be spoken by the person who knows their own failure.
  const speakerId=waiting.peerId,speaker=world.npcs.find(n=>n.id===speakerId)!;
  if(!conversation.actorIds.every(id=>runtime.agentStates.some(agent=>agent.npcId===id&&agent.locationId===conversation.locationId)&&!runtime.dailyRoutine?.journeys[id]))return[];
  const other=runtime.residentLife!.socialBeliefs!.records[key(waiting.appointmentId,speakerId)];
  return[{id:`account-${waiting.appointmentId}`,worldId:world.id,day:conversation.day,time:conversation.time,type:"conversation",actorIds:[...conversation.actorIds],locationId:conversation.locationId,
    summary:`双方提起上次的约定。${speaker.name}说自己没能按时来；具体原因尚未核实。`,publicSummary:"双方正在核对上次的约定。",hidden:false,relatedCharacterIds:[...conversation.actorIds],
    tags:["resident_social_belief","social_account",`speaker:${speakerId}`],intentId:waiting.appointmentId,causedByEventIds:[conversation.id,waiting.observedEventId,other.observedEventId]}];
}
export function projectResidentSocialBeliefs(world:WorldState,runtime:PersistentTownRuntime,npcId:string,sources:ReadonlyMap<string,WorldEvent>){
  const owned=new Set(world.memories.filter(m=>m.worldId===world.id&&m.npcId===npcId).map(m=>m.eventId));
  return Object.values(runtime.residentLife?.socialBeliefs?.records??{}).filter(b=>b.npcId===npcId&&b.reports.every(r=>r.verification==="unverified")&&[b.observedEventId,...b.reports.map(r=>r.eventId)].every(id=>sources.get(id)?.worldId===world.id&&sources.get(id)?.actorIds.includes(npcId)&&owned.has(id)))
    .sort((a,b)=>nowOf(sources.get(b.observedEventId)!)-nowOf(sources.get(a.observedEventId)!)||a.appointmentId.localeCompare(b.appointmentId,"en")).slice(0,4)
    .map(b=>({appointmentId:b.appointmentId,peerId:b.peerId,observation:b.observation,...(b.peerWasPresent!==undefined?{peerWasPresent:b.peerWasPresent}:{}),
      accounts:b.reports.map(r=>({speakerId:r.speakerId,verification:r.verification})),sourceRefs:[b.observedEventId,...b.reports.map(r=>r.eventId)].map(id=>`event:${id}`)}));
}
