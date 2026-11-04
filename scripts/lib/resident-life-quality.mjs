import assert from 'node:assert/strict';

const minute=e=>{const [h,m]=e.time.split(':').map(Number);return(e.day-1)*1440+h*60+m;};
/** Post-run measures from actual completions. Retained proposal metrics are
 * labelled separately; their last-512 ledger is not a whole-run sample. */
export function residentLifeQuality(world,events) {
  const runtime=world.persistentRuntime,life=runtime.residentLife;
  const index=new Map(events.map(e=>[e.id,e])),memories=new Map(world.memories.map(m=>[m.id,m]));
  let credits=0,completedGoals=0,totalGoals=0;
  const residents=world.npcs.map(npc=>{
    const person=life.people[npc.id],agenda=person.agenda;assert(agenda);
    const days=[...agenda.history,{day:agenda.day,goals:agenda.goals}];
    let completed=0,goals=0;
    for(const day of days)for(const goal of day.goals){
      assert.equal(new Set(goal.credits.map(c=>c.eventId)).size,goal.credits.length,'Duplicate goal credit');
      assert.equal(goal.progress,goal.credits.reduce((sum,c)=>sum+c.amount,0));
      assert(goal.progress>=0&&goal.progress<=goal.target);
      for(const credit of goal.credits){const event=index.get(credit.eventId);assert(event?.worldId===world.id&&event.actorIds.includes(npc.id));assert(event.tags.includes('life_completed')||event.tags.includes('work_completed'));assert(credit.amount>0);credits++;}
      // Day 1 starts at 08:00 and the final day ends at 08:00; compare only the
      // fully observed days 2 and 3 in this fixed 72-hour fixture.
      if(day.day>1&&day.day<runtime.currentDay){goals++;if(goal.status==='completed')completed++;}
    }
    completedGoals+=completed;totalGoals+=goals;
    return {npcId:npc.id,completedGoals:completed,totalGoals:goals,completedActions:{...person.completed},needs:{...person.needs}};
  });
  let discretionary=0,repeated=0,transitions=0;const last=new Map();
  for(const event of [...events].sort((a,b)=>minute(a)-minute(b)||a.id.localeCompare(b.id,'en'))){
    if(!event.tags.includes('life_completed'))continue;
    const kind=['rest','occupation'].find(kind=>event.tags.includes(kind));if(!kind)continue;
    for(const npcId of event.actorIds){const previous=last.get(npcId);discretionary++;if(previous?.kind===kind&&minute(event)-previous.minute<=60)repeated++;if(previous&&previous.kind!==kind)transitions++;last.set(npcId,{kind,minute:minute(event)});}
  }
  let referencedMemories=0,proposalsWithMemory=0,localDecisions=0;
  for(const proposal of life.planner.proposals){
    if(proposal.evaluation?.selectedBy==='local-goals')localDecisions++;
    if(proposal.retrievedMemoryIds.length)proposalsWithMemory++;
    for(const id of proposal.retrievedMemoryIds){const memory=memories.get(id),source=index.get(memory?.eventId);assert(memory?.npcId===proposal.npcId&&memory.worldId===world.id&&source?.actorIds.includes(proposal.npcId),'Unresolved private memory');referencedMemories++;}
  }
  const appointments=life.appointments?.items??[];
  for(const appointment of appointments){assert.equal(appointment.worldId,world.id);for(const id of appointment.sourceEventIds)assert(index.has(id),'Missing appointment source');
    if(appointment.status==='completed'){const event=index.get(appointment.completionEventId);assert(event?.tags.includes('appointment_meeting')&&event.tags.includes('life_completed'));}}
  const personal=Object.values(life.socialBeliefs?.records??{});
  for(const b of personal)for(const eventId of [b.acceptedEventId,b.observedEventId,...b.reports.map(r=>r.eventId)])assert(index.get(eventId)?.actorIds.includes(b.npcId)&&world.memories.some(m=>m.npcId===b.npcId&&m.worldId===world.id&&m.eventId===eventId),'Unowned personal belief');
  assert(personal.every(b=>b.reports.every(r=>r.verification==='unverified')));
  return {residents,fullyObservedGoalDays:[2,3],completedGoals,totalGoals,goalCompletionRate:totalGoals?completedGoals/totalGoals:0,
    sourcedGoalCredits:credits,discretionaryCompletions:discretionary,repeatedWithin60Minutes:repeated,repetitionRate:discretionary?repeated/discretionary:0,kindTransitions:transitions,
    retainedProposals:{count:life.planner.proposals.length,localDecisions,proposalsWithMemory,referencedMemories,sourceCoverage:referencedMemories?1:null},
    modelAttemptsReserved:life.planner.providerBudget.used,appointments:{total:appointments.length,byStatus:Object.fromEntries(['accepted','running','completed','declined','missed','cancelled'].map(status=>[status,appointments.filter(a=>a.status===status).length]))},
    personalBeliefs:{total:personal.length,byObservation:Object.fromEntries(['agreed','declined','fulfilled','interrupted','unfulfilled-observed','self-unfulfilled'].map(state=>[state,personal.filter(b=>b.observation===state).length])),unverifiedAccounts:personal.reduce((sum,b)=>sum+b.reports.length,0)}};
}
