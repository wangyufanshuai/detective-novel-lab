import type { PersistentTownRuntime } from "../persistent-town";
import type { WorldEvent, WorldState } from "../world-types";
import { townScheduleTarget } from "./daily-routine";
import { enableTownResidentWork, RESIDENT_WORK_JOBS, townAbsoluteMinute } from "./resident-work";
import { buildResidentLifeContext, buildResidentLifeOptions, createResidentLifePlanner, proposeResidentLifeOption, queueResidentLifeChoice, type ResidentLifeContext, type ResidentLifeKind, type ResidentLifeOption, type ResidentLifePlanner } from "./resident-cognition";
import type { ResidentWorkChoice } from "./resident-work";
import { ensureResidentAgenda, commitResidentGoal, creditResidentGoal, type ResidentAgenda } from "./resident-agenda";
import { dueResidentAppointment, appointmentCanStart, expireResidentAppointments, proposeResidentAppointment, finishResidentAppointment, validateResidentAppointments, type ResidentAppointments, type ResidentAppointment } from "./resident-appointments";
import { observeResidentSocialEvent, seedResidentSocialBeliefs, validateResidentSocialBeliefs, advanceResidentSocialBeliefs, completeResidentFollowup, residentSocialCaution, hasResidentFollowup, type ResidentSocialBeliefs } from "./resident-social-beliefs";

export type LifeKind = ResidentLifeKind;
type Needs = { hunger: number; energy: number; loneliness: number };
export type LifeAction = { id: string; npcIds: string[]; kind: LifeKind; label: string; locationId: string;
  startMinute: number; durationMinutes: number; elapsedMinutes: number; sourceRefs: string[]; startedEventId: string; appointmentId?:string };
export type LifePerson = { needs: Needs; target: string; goal: string; activeId: string | null;
  completed: Record<LifeKind, number>; lastSocialTick: number; memoryEventIds: string[]; agenda?:ResidentAgenda };
export type TownResidentLife = {
  schema: "town-resident-life.v1"; enabled: true; startedAtTick: number; endTick: number; lastTick: number;
  people: Record<string, LifePerson>; active: Record<string, LifeAction>; lastSupplyDay: number;
  relationshipChanges: Array<{ eventId: string; from: string; to: string; before: number; after: number }>;
  decisions: Array<{ id: string; tick: number; npcIds: string[]; kind: LifeKind; reason: string; sourceRefs: string[]; proposalId?: string }>;
  planner: ResidentLifePlanner;
  appointments?:ResidentAppointments;
  socialBeliefs?:ResidentSocialBeliefs;
};
const labels:Record<LifeKind,string>={eat:"吃一顿热饭",sleep:"回家睡觉",rest:"歇脚整理思绪",socialize:"与街坊交谈",occupation:"处理日常事务"};
const occupations:Record<string,string>={"咖啡馆店主":"整理咖啡馆的杯盘","值班警员":"核对街区巡查记录","投递员":"核对投递路线","邮局分拣员":"分拣今日信件","花摊摊主":"整理花束与摊位","桥梁木工":"检查桥梁木料","地方记者":"整理采访笔记","钟表维修工":"调校钟表","退休教师":"整理旧课堂笔记"};
const completed=():Record<LifeKind,number>=>({eat:0,sleep:0,rest:0,socialize:0,occupation:0});
const clamp=(n:number)=>Math.round(Math.max(0,Math.min(100,n))*1000)/1000;
function jitter(seed:string){let n=2166136261;for(const char of seed){n^=char.charCodeAt(0);n=Math.imul(n,16777619);}return(n>>>0)/4294967296;}

/** Explicit, versioned policy installation. No legacy read changes its horizon. */
export function enableTownResidentLife(world:WorldState,runtime:PersistentTownRuntime){
  if(runtime.residentLife)return runtime.residentLife;
  if(!runtime.dailyRoutine?.enabled||runtime.tickIntervalMinutes!==5)throw Error("Resident life requires the authored five-minute road clock");
  enableTownResidentWork(world,runtime);
  const endTick=runtime.tick+864;
  runtime.residentLife={schema:"town-resident-life.v1",enabled:true,startedAtTick:runtime.tick,endTick,lastTick:runtime.tick,
    lastSupplyDay:runtime.currentDay,active:{},relationshipChanges:[],decisions:[],planner:createResidentLifePlanner(),
    people:Object.fromEntries(world.npcs.map(npc=>[npc.id,{needs:{hunger:25+Math.floor(jitter(`${world.seed}:${npc.id}:hunger`)*20),
      energy:75+Math.floor(jitter(`${world.seed}:${npc.id}:energy`)*20),loneliness:30+Math.floor(jitter(`${world.seed}:${npc.id}:social`)*25)},
      target:townScheduleTarget(npc,townAbsoluteMinute(runtime)),goal:"照顾自己并完成今日安排",activeId:null,completed:completed(),lastSocialTick:-100,memoryEventIds:[]}]))};
  runtime.maxTicks=endTick;
  if(runtime.status==="completed")runtime.status="paused";
  return runtime.residentLife;
}
export function residentLifeOwnsActor(runtime:Pick<PersistentTownRuntime,"residentLife">,npcId:string){return !!runtime.residentLife?.people[npcId];}
export function residentLifeIsOccupied(runtime:Pick<PersistentTownRuntime,"residentLife">,npcId:string){return !!runtime.residentLife?.people[npcId]?.activeId;}
export function setResidentLifePlannerMode(runtime:PersistentTownRuntime,mode:"rules"|"offline-agent"){
  const planner=ensureResidentLifePlanner(runtime);if(!planner)throw Error("Resident life is disabled");
  planner.mode=mode;
  // CPU-only scoring: at most one discretionary proposal per resident per tick
  // in this fixed horizon. This never changes the separate model-call budget.
  if(mode==="offline-agent")planner.modelBudget.limit=Math.max(planner.modelBudget.limit,864*Object.keys(runtime.residentLife!.people).length);
}
export function ensureResidentLifePlanner(runtime:Pick<PersistentTownRuntime,"residentLife">){
  const life=runtime.residentLife;if(!life)return undefined;
  life.planner??=createResidentLifePlanner();life.planner.modelBudget??={limit:48,used:0};life.planner.proposals??=[];life.planner.rejected??=[];
  life.planner.providerBudget??={limit:48,used:0,reservationIds:[]};life.planner.pendingChoices??={};life.planner.providerDecisions??=[];
  return life.planner;
}
function ref(runtime:PersistentTownRuntime,npcId:string){return `life-observation:${runtime.worldId}:${npcId}:${runtime.tick}:${runtime.commandRevision??0}`;}
function remember(world:WorldState,runtime:PersistentTownRuntime,event:WorldEvent){
  for(const npcId of event.actorIds){
    const npc=world.npcs.find(n=>n.id===npcId)!;const person=runtime.residentLife?.people[npcId];if(!person)continue;
    world.memories??=[];
    world.memories.push({id:`memory-${event.id}-${npcId}`,worldId:world.id,npcId,kind:"direct",eventId:event.id,day:event.day,summary:event.summary,confidence:1,visibleToPlayer:false,challengeableEvidenceIds:[]});
    npc.memoryEventIds.push(event.id);person.memoryEventIds=[...person.memoryEventIds,event.id].slice(-16);
  }
  observeResidentSocialEvent(world,runtime,event);
}
function eventAt(world:WorldState,minute:number,id:string,actors:string[],locationId:string,type:WorldEvent["type"],summary:string,tags:string[],causes:string[]=[]):WorldEvent{
  const clock=((minute%1440)+1440)%1440;
  return{id,worldId:world.id,day:Math.floor(minute/1440)+1,time:`${String(Math.floor(clock/60)).padStart(2,"0")}:${String(clock%60).padStart(2,"0")}`,
    type,actorIds:actors,locationId,summary,publicSummary:summary,hidden:false,relatedCharacterIds:actors,tags:["resident_life",...tags],causedByEventIds:causes};
}
function start(world:WorldState,runtime:PersistentTownRuntime,npcIds:string[],kind:LifeKind,durationMinutes:number,reason:string,proposal?:{id:string;sourceRefs:string[];label?:string}):WorldEvent{
  const state=runtime.residentLife!,minute=townAbsoluteMinute(runtime),id=`life-${world.id}-${runtime.tick}-${npcIds.join("-")}`;
  const agent=runtime.agentStates.find(a=>a.npcId===npcIds[0])!;
  const names=npcIds.map(id=>world.npcs.find(p=>p.id===id)!.name).join("与");
  const label=proposal?.label??(kind==="occupation"?(occupations[world.npcs.find(p=>p.id===npcIds[0])!.role]??"处理日常事务"):labels[kind]);
  const event=eventAt(world,minute,`${id}-started`,npcIds,agent.locationId,kind==="socialize"?"conversation":"work",`${names}开始${label}。`,[kind,"life_started"]);
  const refs=proposal?.sourceRefs??npcIds.map(id=>ref(runtime,id));
  state.active[id]={id,npcIds,kind,label,locationId:agent.locationId,startMinute:minute,durationMinutes,elapsedMinutes:0,sourceRefs:refs,startedEventId:event.id};
  state.decisions.push({id,tick:runtime.tick,npcIds,kind,reason,sourceRefs:refs,proposalId:proposal?.id});state.decisions=state.decisions.slice(-240);
  for(const npcId of npcIds){state.people[npcId].activeId=id;state.people[npcId].goal=reason;}
  remember(world,runtime,event);return event;
}

/** One planning phase at the existing interval boundary. Needs may change the
 * commute target, but roads still consume real minutes in daily-routine.ts.
 * Existing three specialist work actions continue to own their work outputs. */
export function beginResidentLifeInterval(world:WorldState,runtime:PersistentTownRuntime,events:readonly WorldEvent[]=[]):WorldEvent[]{
  if(!runtime.residentLife)return[];
  return runResidentLifeBoundary(world,runtime,new Map(events.map(event=>[event.id,event])));
}
/** Preview on an isolated clone using the same boundary planner as execution.
 * Only independent, solo alternatives are exported. Joint encounters and urgent
 * needs remain rule-owned, so a provider cannot reserve another resident. */
export function prepareResidentLifeDecisions(world:WorldState,runtime:PersistentTownRuntime,events:readonly WorldEvent[]=[]):ResidentLifeContext[]{
  if(!runtime.residentLife)return[];
  const draft=structuredClone(world),state=structuredClone(runtime),contexts:ResidentLifeContext[]=[];
  ensureResidentLifePlanner(state);
  state.residentLife!.planner.mode="rules";state.residentLife!.planner.pendingChoices={};
  runResidentLifeBoundary(draft,state,new Map(events.map(event=>[event.id,event])),context=>{
    if(context.candidates.length>1&&context.candidates.every(c=>c.npcIds.length===1&&c.npcIds[0]===context.npcId))contexts.push(context);
  });
  return contexts;
}
export function queueResidentLifeDecision(world:WorldState,runtime:PersistentTownRuntime,context:ResidentLifeContext,choice:ResidentWorkChoice,events:readonly WorldEvent[]=[]){
  const fresh=prepareResidentLifeDecisions(world,runtime,events).find(item=>item.npcId===context.npcId);
  return queueResidentLifeChoice(runtime,context,fresh,choice);
}
function runResidentLifeBoundary(world:WorldState,runtime:PersistentTownRuntime,eventIndex:Map<string,WorldEvent>,onContext?:(context:ResidentLifeContext)=>void):WorldEvent[]{
  const state=runtime.residentLife;if(!state)return[];
  ensureResidentLifePlanner(runtime);
  if(state.schema!=="town-resident-life.v1"||state.lastTick!==runtime.tick)throw Error("Resident life boundary is stale");
  validateResidentAppointments(world,runtime,eventIndex);
  seedResidentSocialBeliefs(world,runtime,eventIndex);
  validateResidentSocialBeliefs(world,runtime,eventIndex);
  for(const npc of world.npcs){const person=state.people[npc.id];if(person)person.agenda=ensureResidentAgenda({worldId:world.id,seed:world.seed,npcId:npc.id,day:runtime.currentDay,previous:person.agenda});}
  const minute=townAbsoluteMinute(runtime),clock=minute%1440,events:WorldEvent[]=[];
  const launch=(npc:typeof world.npcs[number],agent:{locationId:string},options:Array<Omit<ResidentLifeOption,"sourceRefs">>,preferredId:string,reason:string,appointment?:ResidentAppointment)=>{
    const candidates=buildResidentLifeOptions(world,runtime,npc,options,eventIndex);
    onContext?.(buildResidentLifeContext(world,runtime,npc,candidates,preferredId,eventIndex));
    const decision=proposeResidentLifeOption(world,runtime,npc,state.people[npc.id].needs,candidates,preferredId,eventIndex);
    const proposal=decision.proposal,selected=decision.option;
    const chosenReason=selected.id===preferredId?reason:`${selected.label}：${proposal.rationale}`;
    const event=start(world,runtime,selected.npcIds,selected.kind,selected.durationMinutes,chosenReason,{id:proposal.id,sourceRefs:proposal.sourceRefs,label:selected.label});
    if(appointment){
      const action=state.active[state.people[selected.npcIds[0]].activeId!];
      action.appointmentId=appointment.id;appointment.actionId=action.id;appointment.status="running";
      event.tags.push("appointment_meeting");event.causedByEventIds=appointment.sourceEventIds.slice(-1);appointment.sourceEventIds.push(event.id);
    }
    for(const id of selected.npcIds)commitResidentGoal(state.people[id].agenda,selected.kind);
    events.push(event);eventIndex.set(event.id,event);
  };
  for(const event of expireResidentAppointments(world,runtime)){events.push(event);remember(world,runtime,event);eventIndex.set(event.id,event);}
  for(const event of advanceResidentSocialBeliefs(world,runtime)){events.push(event);remember(world,runtime,event);eventIndex.set(event.id,event);}
  // Replenishment is a visible authored daily delivery with a source event, not
  // an infinite job inventory. Only delivered units can subsequently be reserved.
  if(state.lastSupplyDay<runtime.currentDay&&clock>=480){
    for(const job of RESIDENT_WORK_JOBS){
      runtime.residentWork!.stations[job.npcId].pending+=6;
      events.push(eventAt(world,minute,`life-delivery-${world.id}-${runtime.currentDay}-${job.npcId}`,[job.npcId],job.locationId,"obtain_item",`${world.locations.find(p=>p.id===job.locationId)!.name}收到今日六份待办材料。`,["daily_delivery"]));
    }state.lastSupplyDay=runtime.currentDay;
  }
  // Seeded rotation gives each resident access to social partners rather than
  // letting fixed array order reserve every encounter for the first residents.
  const cast=[...world.npcs].sort((a,b)=>(state.people[b.id]?.needs.loneliness??0)-(state.people[a.id]?.needs.loneliness??0)||jitter(`${world.seed}:${runtime.tick}:${a.id}`)-jitter(`${world.seed}:${runtime.tick}:${b.id}`)||a.id.localeCompare(b.id));
  for(const npc of cast){
    const p=state.people[npc.id],a=runtime.agentStates.find(a=>a.npcId===npc.id);if(!p||!a||!npc.alive||p.activeId)continue;
    if((runtime.dailyRoutine!.holds[npc.id]?.untilTick??-1)>=runtime.tick+1||runtime.ruleState?.longActions.some(action=>action.actorId===npc.id&&action.status==="running"))continue;
    const night=clock>=1320||clock<420;
    const appointment=dueResidentAppointment(runtime,npc.id);
    p.target=night||p.needs.energy<22?npc.homeLocationId:p.needs.hunger>=65?(a.locationId===npc.homeLocationId?npc.homeLocationId:(["inn","cafe"].includes(a.locationId)?a.locationId:"cafe")):appointment?.locationId??(p.needs.loneliness>=65?"cafe":townScheduleTarget(npc,minute));
    p.goal=night||p.needs.energy<22?"回家恢复精力":p.needs.hunger>=65?"找个地方吃热饭":p.needs.loneliness>=65?"去咖啡馆与街坊碰面":"完成今天的日常安排";
    if(runtime.dailyRoutine!.journeys[npc.id]||p.target!==a.locationId||runtime.residentWork?.active[npc.id])continue;
    if((night||p.needs.energy<40)&&a.locationId===npc.homeLocationId){launch(npc,a,[{id:"sleep",kind:"sleep",npcIds:[npc.id],locationId:a.locationId,durationMinutes:60,label:"回家睡觉",ruleReasons:["夜间或精力不足"]}],"sleep","在家睡觉，恢复精力");continue;}
    if(p.needs.hunger>=65){launch(npc,a,[{id:"eat",kind:"eat",npcIds:[npc.id],locationId:a.locationId,durationMinutes:20,label:"吃一顿热饭",ruleReasons:["饥饿需求超过阈值"]}],"eat","饥饿影响了计划，先吃热饭");continue;}
    if(p.needs.energy<35){launch(npc,a,[{id:"rest",kind:"rest",npcIds:[npc.id],locationId:a.locationId,durationMinutes:30,label:"歇脚整理思绪",ruleReasons:["精力不足"]}],"rest","精力不足，先歇一会儿");continue;}
    if(appointment){
      if(appointmentCanStart(world,runtime,appointment)){
        const lead=world.npcs.find(n=>n.id===appointment.npcIds[0])!;
        launch(lead,a,[{id:`appointment:${appointment.id}`,kind:"socialize",npcIds:[...appointment.npcIds],locationId:a.locationId,durationMinutes:15,label:"赴约交谈",ruleReasons:["双方已接受约定并实际到场"]}],`appointment:${appointment.id}`,"按约定与街坊交谈",appointment);
      }else launch(npc,a,[{id:"wait-appointment",kind:"rest",npcIds:[npc.id],locationId:a.locationId,durationMinutes:5,label:"等候街坊赴约",ruleReasons:["为已接受的约定短暂等候"]}],"wait-appointment","等候约定时间与街坊到场");
      continue;
    }
    if(p.needs.loneliness>=48&&runtime.tick-p.lastSocialTick>=12&&world.locations.find(l=>l.id===a.locationId)?.kind!=="home"){
      const peer=cast.filter(other=>{
        const q=state.people[other.id],b=runtime.agentStates.find(a=>a.npcId===other.id);
        return other.id!==npc.id&&other.alive&&q&&!q.activeId&&!dueResidentAppointment(runtime,other.id)&&q.needs.hunger<65&&q.needs.energy>=35&&q.needs.loneliness>=25&&runtime.tick-q.lastSocialTick>=12&&
          b?.locationId===a.locationId&&!runtime.dailyRoutine!.journeys[other.id]&&!runtime.residentWork?.active[other.id]&&
          (runtime.dailyRoutine!.holds[other.id]?.untilTick??-1)<runtime.tick+1&&!runtime.ruleState?.longActions.some(action=>action.actorId===other.id&&action.status==="running");
      }).sort((x,y)=>((runtime.socialProfiles?.find(s=>s.npcId===npc.id)?.trust[y.id]??5)-residentSocialCaution(runtime,npc.id,y.id))-((runtime.socialProfiles?.find(s=>s.npcId===npc.id)?.trust[x.id]??5)-residentSocialCaution(runtime,npc.id,x.id))||x.id.localeCompare(y.id))[0];
      if(peer){const followup=hasResidentFollowup(runtime,npc.id,peer.id);launch(npc,a,[{id:`socialize:${peer.id}`,kind:"socialize",npcIds:[npc.id,peer.id],locationId:a.locationId,durationMinutes:15,label:followup?"核对上次约定":"与街坊交谈",ruleReasons:[followup?"亲历的约定结果尚待当面核对":"同地点有可交谈居民"]}],`socialize:${peer.id}`,followup?"当面核对上次约定":"身边有人，聊聊今天的日常");continue;}
    }
    // A resident who came here to meet somebody waits briefly. Starting another
    // half-hour task would keep phase-offset workers permanently unavailable.
    if(p.needs.loneliness>=65&&a.locationId==="cafe"){launch(npc,a,[{id:"wait-social",kind:"rest",npcIds:[npc.id],locationId:a.locationId,durationMinutes:5,label:"短暂等候",ruleReasons:["社交需求高，等待街坊空闲"]}],"wait-social","等街坊忙完，再打个招呼");continue;}
    if(RESIDENT_WORK_JOBS.some(job=>job.npcId===npc.id&&job.locationId===a.locationId)){
      if(runtime.residentWork!.stations[npc.id].pending>0)continue;
      launch(npc,a,[{id:"rest-after-work",kind:"rest",npcIds:[npc.id],locationId:a.locationId,durationMinutes:30,label:"歇脚整理思绪",ruleReasons:["今日材料已处理完"]}],"rest-after-work","今日材料已处理完，稍作休息");continue;
    }
    const kind:LifeKind=a.locationId===npc.homeLocationId?"rest":"occupation";
    const ordinary:Omit<ResidentLifeOption,"sourceRefs">={id:kind,kind,npcIds:[npc.id],locationId:a.locationId,durationMinutes:30,label:kind==="occupation"?(occupations[npc.role]??"处理日常事务"):"歇脚整理思绪",ruleReasons:[a.locationId===npc.homeLocationId?"当前在家":"遵循公开日程"]};
    const alternative:Omit<ResidentLifeOption,"sourceRefs">=kind==="occupation"?
      {id:"rest-short",kind:"rest",npcIds:[npc.id],locationId:a.locationId,durationMinutes:15,label:"稍作歇脚",ruleReasons:["没有紧急生理需求，可短暂休息"]}:
      {id:"personal-notes",kind:"occupation",npcIds:[npc.id],locationId:a.locationId,durationMinutes:15,label:"整理个人手记",ruleReasons:["没有紧急生理需求，可整理私人笔记"]};
    launch(npc,a,[ordinary,alternative],kind,a.locationId===npc.homeLocationId?"在家休息，等下一项安排":`履行${npc.role}的日常安排`);
  }
  return events;
}

/** Commit elapsed needs and outcomes after real commuting/work. A joint action
 * ends only while both participants are still alive and physically co-present.
 * Direct memories cite its event; trust deltas cite the same completion event. */
export function finishResidentLifeInterval(world:WorldState,runtime:PersistentTownRuntime,workFinished:readonly WorldEvent[]=[]):WorldEvent[]{
  const state=runtime.residentLife;if(!state)return[];
  if(state.lastTick!==runtime.tick-1)throw Error("Resident life tick is stale or already applied");
  const events:WorldEvent[]=[],minutes=runtime.tickIntervalMinutes,end=townAbsoluteMinute(runtime);
  const validAction=(action:LifeAction)=>action.npcIds.every(id=>world.npcs.some(n=>n.id===id&&n.alive)&&runtime.agentStates.some(a=>a.npcId===id&&a.locationId===action.locationId)&&
    !runtime.dailyRoutine!.journeys[id]&&(runtime.dailyRoutine!.holds[id]?.untilTick??-1)<runtime.tick&&!runtime.ruleState?.longActions.some(a=>a.actorId===id&&a.status==="running"));
  for(const npc of world.npcs){
    const p=state.people[npc.id],a=runtime.agentStates.find(a=>a.npcId===npc.id);if(!p||!a||!npc.alive)continue;
    const action=p.activeId?state.active[p.activeId]:null,kind=action&&validAction(action)?action.kind:null;
    p.needs.hunger=clamp(p.needs.hunger+minutes*.1-(kind==="eat"?minutes*2.6:0));
    p.needs.loneliness=clamp(p.needs.loneliness+minutes*.065-(kind==="socialize"?minutes*2.5:0));
    p.needs.energy=clamp(p.needs.energy+minutes*(kind==="sleep"?.32:kind==="rest"?.16:kind==="eat"?.04:runtime.residentWork?.active[npc.id]||kind==="occupation"?-.065:-.035));
    a.fatigue=Math.round((100-p.needs.energy)/10*100)/100;
    a.currentGoal=p.goal;a.currentPlan=[p.goal,`前往 ${p.target}`];
  }
  for(const action of Object.values(state.active)){
    const valid=validAction(action);
    if(valid)action.elapsedMinutes+=minutes;
    if(valid&&action.elapsedMinutes<action.durationMinutes)continue;
    const names=action.npcIds.map(id=>world.npcs.find(n=>n.id===id)!.name).join("与");
    const event=eventAt(world,end,`${action.id}-${valid?"completed":"interrupted"}`,action.npcIds,action.locationId,action.kind==="socialize"?"conversation":"work",
      `${names}${valid?"结束":"中断"}${action.label}。`,[action.kind,valid?"life_completed":"life_interrupted"],[action.startedEventId]);
    if(action.appointmentId)event.tags.push("appointment_meeting");
    event.intentId=action.id;events.push(event);remember(world,runtime,event);
    for(const id of action.npcIds){const p=state.people[id];p.activeId=null;if(valid){p.completed[action.kind]++;creditResidentGoal(p.agenda,event,action.kind,action.startMinute,action.durationMinutes);}if(action.kind==="socialize")p.lastSocialTick=runtime.tick;}
    if(valid&&action.kind==="socialize")for(const from of action.npcIds)for(const to of action.npcIds){
      if(from===to)continue;const profile=runtime.socialProfiles?.find(p=>p.npcId===from);if(!profile)continue;
      const before=profile.trust[to]??5,after=Math.min(10,Math.round((before+.15)*100)/100);profile.trust[to]=after;profile.updatedAtTick=runtime.tick;
      state.relationshipChanges.push({eventId:event.id,from,to,before,after});
    }
    if(action.appointmentId)finishResidentAppointment(runtime,action.appointmentId,action.id,event,valid);
    if(valid&&action.kind==="socialize"){
      for(const account of completeResidentFollowup(world,runtime,event)){events.push(account);remember(world,runtime,account);}
      if(!action.appointmentId)for(const appointmentEvent of proposeResidentAppointment(world,runtime,event,new Map([[event.id,event]]))){events.push(appointmentEvent);remember(world,runtime,appointmentEvent);}
    }
    delete state.active[action.id];
  }
  for(const event of workFinished){
    if(!event.tags.includes("work_completed"))continue;
    const action=runtime.residentWork?.history.find(action=>action.eventIds.includes(event.id)&&action.status==="completed");
    if(action)creditResidentGoal(state.people[action.npcId]?.agenda,event,action.jobId?"occupation":"rest",action.startedAtMinute,action.durationMinutes);
  }
  state.relationshipChanges=state.relationshipChanges.slice(-240);state.lastTick=runtime.tick;
  return events;
}

/** Same-location authorization is required before calling this display helper. */
export function residentLifePlayerActivity(runtime:Pick<PersistentTownRuntime,"residentLife">,npcId:string){
  const state=runtime.residentLife,p=state?.people[npcId],action=p?.activeId?state!.active[p.activeId]:undefined;
  return action?{label:action.label,progress:Math.floor(action.elapsedMinutes/action.durationMinutes*100)}:null;
}
