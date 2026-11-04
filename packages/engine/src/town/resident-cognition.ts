import type { PersistentTownRuntime } from "../persistent-town";
import type { MemoryRecord, NPCProfile, WorldEvent, WorldState } from "../world-types";
import type { ResidentWorkChoice } from "./resident-work";
import { residentGoalForKind, type ResidentAgenda } from "./resident-agenda";
import { projectResidentSocialBeliefs } from "./resident-social-beliefs";

export type ResidentLifeKind = "eat" | "sleep" | "rest" | "socialize" | "occupation";
export type ResidentPlannerMode = "rules" | "offline-agent";
export type ResidentMemoryHit = {
  memoryId: string;
  eventId: string;
  npcId: string;
  kind: MemoryRecord["kind"];
  summary: string;
  confidence: number;
  score: number;
  sourceRef: string;
  eventMinute: number;
  locationId: string | null;
  activityKind: ResidentLifeKind | null;
  completed: boolean;
  ageMinutes: number;
};
export type ResidentLifeOption = {
  id: string;
  kind: ResidentLifeKind;
  npcIds: string[];
  locationId: string;
  durationMinutes: number;
  label: string;
  ruleReasons: string[];
  sourceRefs: string[];
};
export type ResidentLifeProposal = {
  schema: "resident-life-proposal.v1";
  id: string;
  npcId: string;
  tick: number;
  expectedWorldRevision: number;
  mode: ResidentPlannerMode;
  candidateId: string;
  npcIds: string[];
  sourceRefs: string[];
  retrievedMemoryIds: string[];
  rationale: string;
  confidence: number;
  selection?: ResidentWorkChoice;
  evaluation?: { selectedBy: "rules" | "local-goals" | "provider" | "budget-fallback"; goalId: string | null;
    scores: Array<{ candidateId: string; needs: number; goal: number; repetitionPenalty: number; total: number }> };
};
export type ResidentLifeContext = {
  schema: "resident-life-context.v1"; policyVersion: "resident-life-policy.v4";
  worldId: string; npcId: string; tick: number; worldRevision: number; day: number; time: string;
  self: { name: string; role: string; goal: string; locationId: string; needs: { hunger: number; energy: number; loneliness: number } };
  memories: ResidentMemoryHit[]; candidates: ResidentLifeOption[]; preferredId: string;
  agenda: Pick<ResidentAgenda, "schema" | "npcId" | "day" | "commitmentId" | "goals"> | null;
  socialBeliefs:ReturnType<typeof projectResidentSocialBeliefs>;
};
export type ResidentProposalRejectionCode = "STALE_CONTEXT" | "UNKNOWN_SOURCE" | "ILLEGAL_CANDIDATE" | "BUDGET_EXHAUSTED" | "ACTION_REUSED";
export class ResidentProposalRejection extends Error {
  readonly schema = "resident-life-refusal.v1";
  constructor(public code: ResidentProposalRejectionCode, message: string) { super(message); }
}
export type ResidentLifePlanner = {
  mode: ResidentPlannerMode;
  modelBudget: { limit: number; used: number };
  proposals: ResidentLifeProposal[];
  rejected: Array<{ id: string; code: ResidentProposalRejectionCode; tick: number }>;
  providerBudget: { limit: number; used: number; reservationIds: string[] };
  pendingChoices: Record<string, { context: ResidentLifeContext; choice: ResidentWorkChoice }>;
  providerDecisions: Array<{ context: ResidentLifeContext; choice: ResidentWorkChoice }>;
};

export function createResidentLifePlanner(): ResidentLifePlanner {
  return { mode: "rules", modelBudget: { limit: 48, used: 0 }, proposals: [], rejected: [],
    providerBudget: { limit: 48, used: 0, reservationIds: [] }, pendingChoices: {}, providerDecisions: [] };
}
function eventMinute(event: Pick<WorldEvent, "day" | "time">) {
  if(!Number.isSafeInteger(event.day)||event.day<1||!/^([01]\d|2[0-3]):[0-5]\d$/.test(event.time))return NaN;
  const [hours, minutes] = event.time.split(":").map(Number);
  return (event.day - 1) * 1440 + hours * 60 + minutes;
}
function runtimeMinute(runtime: Pick<PersistentTownRuntime, "currentDay" | "currentTime">) {
  const [hours, minutes] = runtime.currentTime.split(":").map(Number);
  return (runtime.currentDay - 1) * 1440 + hours * 60 + minutes;
}
function sourcePolicy(world: WorldState, runtime: Pick<PersistentTownRuntime, "tick" | "commandRevision">) {
  return `life-policy:${world.id}:${runtime.tick}:${runtime.commandRevision ?? 0}`;
}
function clamp(value: number, min = 0, max = 100) { return Math.max(min, Math.min(max, value)); }

/** Deterministic, bounded retrieval. It never returns another person's private
 * memory and never uses an embedding/model call. The result is a proposal
 * source, not permission to mutate the world. */
export function retrieveResidentMemories(
  world: WorldState,
  runtime: Pick<PersistentTownRuntime, "currentDay" | "currentTime">,
  npcId: string,
  query: { locationId?: string; kinds?: MemoryRecord["kind"][]; limit?: number; events?: ReadonlyMap<string, WorldEvent> } = {}
): ResidentMemoryHit[] {
  const now = runtimeMinute(runtime);
  const memories = (world.memories || []).filter(memory => memory.npcId === npcId && memory.worldId === world.id &&
    (!query.kinds?.length || query.kinds.includes(memory.kind)) && memory.day <= runtime.currentDay && Number.isFinite(memory.confidence));
  return memories.flatMap(memory => {
    const event=query.events?.get(memory.eventId);
    // Only resolve a person's own witnessed participation. Do not enrich a
    // rumour from a hidden event's exact time, location or participants.
    if(!event||event.worldId!==world.id||!event.actorIds.includes(npcId)||memory.day!==event.day)return[];
    const at=eventMinute(event);if(!Number.isFinite(at)||at>now)return[];
    const ageMinutes=now-at,recency = clamp(1-ageMinutes/(24*60),0,1);
    const kindWeight = memory.kind === "direct" ? 1 : memory.kind === "rumor" ? .7 : memory.kind === "secret" ? .85 : .55;
    const locationBonus = query.locationId===event.locationId?.toString() ? .15 : 0;
    const activityKind=(["eat","sleep","rest","socialize","occupation"] as const).find(kind=>event.tags.includes(kind)) ??
      (event.tags.includes("resident_work")&&event.tags.includes("work_completed") ? "occupation" : null);
    return [{ memoryId: memory.id, eventId: memory.eventId, npcId, kind: memory.kind, summary: memory.summary.slice(0, 240),
      confidence: clamp(memory.confidence, 0, 1), score: Math.round((recency*.55+clamp(memory.confidence,0,1)*.25+kindWeight*.2+locationBonus)*1000)/1000,
      sourceRef: `memory:${memory.id}`,eventMinute:at,ageMinutes,locationId:event.locationId,activityKind,
      completed:event.tags.includes("life_completed")||event.tags.includes("work_completed") }];
  }).sort((a, b) => b.score-a.score || b.eventMinute-a.eventMinute || a.memoryId.localeCompare(b.memoryId,"en")).slice(0, Math.max(1,Math.min(8,query.limit??6)));
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) / 4294967296;
}

export function buildResidentLifeOptions(
  world: WorldState,
  runtime: Pick<PersistentTownRuntime, "tick" | "commandRevision" | "currentDay" | "currentTime">,
  npc: NPCProfile,
  options: Array<Omit<ResidentLifeOption, "sourceRefs">>,
  events?: ReadonlyMap<string, WorldEvent>
): ResidentLifeOption[] {
  const memories = retrieveResidentMemories(world, runtime, npc.id, { limit: 6,locationId:options[0]?.locationId,events });
  const policy = sourcePolicy(world, runtime);
  return options.map(option => ({ ...option, sourceRefs: [policy, ...memories.slice(0, 3).map(hit => hit.sourceRef)] }));
}

function scoreOption(option: ResidentLifeOption, person: { hunger: number; energy: number; loneliness: number }, memories: ResidentMemoryHit[], world: WorldState, tick: number, agenda?: ResidentAgenda) {
  const needs = option.kind === "eat" ? person.hunger * 1.4 : option.kind === "sleep" ? (100 - person.energy) * 1.25 :
    option.kind === "socialize" ? person.loneliness * 1.35 : option.kind === "occupation" ? 32 : (100 - person.energy) * .8;
  const goal=residentGoalForKind(agenda,option.kind),goalScore=goal ? goal.priority+(agenda?.commitmentId===goal.id?4:0) : 0;
  const repetitionPenalty=memories.filter(m=>m.completed&&m.activityKind===option.kind&&m.ageMinutes<=60)
    .reduce((sum,m)=>sum+18*(1-m.ageMinutes/65),0);
  const deterministic = stableHash(`${world.seed}:${tick}:${option.id}`) * 0.1;
  return {candidateId:option.id,needs,goal:goalScore,repetitionPenalty,total:needs+goalScore-repetitionPenalty+deterministic};
}

export function buildResidentLifeContext(world: WorldState, runtime: PersistentTownRuntime, npc: NPCProfile,
  options: ResidentLifeOption[], preferredId: string, events?: ReadonlyMap<string, WorldEvent>): ResidentLifeContext {
  const person = runtime.residentLife!.people[npc.id];
  return { schema: "resident-life-context.v1", policyVersion: "resident-life-policy.v4", worldId: world.id, npcId: npc.id,
    tick: runtime.tick, worldRevision: runtime.commandRevision ?? 0, day: runtime.currentDay, time: runtime.currentTime,
    self: { name: npc.name, role: npc.role, goal: person.goal.slice(0, 240), locationId: options[0].locationId, needs: { ...person.needs } },
    memories: retrieveResidentMemories(world, runtime, npc.id, { limit: 6,locationId:options[0]?.locationId,events }), candidates: structuredClone(options), preferredId,
    agenda:person.agenda?structuredClone({schema:person.agenda.schema,npcId:person.agenda.npcId,day:person.agenda.day,commitmentId:person.agenda.commitmentId,goals:person.agenda.goals}):null,
    socialBeliefs:projectResidentSocialBeliefs(world,runtime,npc.id,events??new Map()) };
}
export function residentLifeDecisionId(context: ResidentLifeContext) { return `life-provider:${context.worldId}:${context.tick}:${context.npcId}`; }
/** Persist this reservation under world CAS before awaiting any transport. */
export function reserveResidentLifeModelAttempt(runtime: PersistentTownRuntime, context: ResidentLifeContext) {
  const planner = runtime.residentLife?.planner, budget = planner?.providerBudget;
  if (!budget || context.worldId !== runtime.worldId || context.tick !== runtime.tick || context.worldRevision !== (runtime.commandRevision ?? 0)) return false;
  const id = residentLifeDecisionId(context);
  if (budget.used >= budget.limit || budget.reservationIds.includes(id)) return false;
  budget.used++; budget.reservationIds.push(id); return true;
}
export function queueResidentLifeChoice(runtime: PersistentTownRuntime, context: ResidentLifeContext, fresh: ResidentLifeContext | undefined, choice: ResidentWorkChoice) {
  const planner = runtime.residentLife?.planner;
  if (!planner || !fresh || JSON.stringify(context) !== JSON.stringify(fresh)) throw new ResidentProposalRejection("STALE_CONTEXT", "居民提案对应的生活状态已经变化。");
  if (!context.candidates.some(candidate => candidate.id === choice.candidateId) || !["offline", "budget", "model", "timeout", "invalid", "error"].includes(choice.source))
    throw new ResidentProposalRejection("ILLEGAL_CANDIDATE", "居民选择不属于当前候选。");
  if (choice.source === "model" && (!planner.providerBudget.reservationIds.includes(residentLifeDecisionId(context)) ||
    !choice.provider || choice.provider.length > 80 || !choice.model || choice.model.length > 120))
    throw new ResidentProposalRejection("BUDGET_EXHAUSTED", "模型选择缺少预留预算或来源。");
  const pending = planner.pendingChoices[context.npcId], entry = { context, choice };
  if (pending && JSON.stringify(pending) !== JSON.stringify(entry)) throw new ResidentProposalRejection("ACTION_REUSED", "这次居民选择已经登记。");
  planner.pendingChoices[context.npcId] = structuredClone(entry);
}

/** Local deterministic stand-in for an Agent proposal. It is intentionally
 * shaped like a future model proposal, but it has zero model calls and a hard
 * budget. The referee still admits only options produced by this exact context. */
export function proposeResidentLifeOption(
  world: WorldState,
  runtime: PersistentTownRuntime,
  npc: NPCProfile,
  person: { hunger: number; energy: number; loneliness: number },
  options: ResidentLifeOption[],
  preferredId: string,
  events?: ReadonlyMap<string, WorldEvent>
): { proposal: ResidentLifeProposal; option: ResidentLifeOption } {
  if (!options.length) throw new ResidentProposalRejection("ILLEGAL_CANDIDATE", "没有合法的居民生活候选。");
  const planner = runtime.residentLife?.planner ?? createResidentLifePlanner();
  const memories = retrieveResidentMemories(world, runtime, npc.id, { limit: 6,locationId:options[0]?.locationId,events });
  let selected = options.find(option => option.id === preferredId) ?? options[0];
  let selection: ResidentWorkChoice | undefined;
  let selectedBy:NonNullable<ResidentLifeProposal["evaluation"]>["selectedBy"]="rules";
  const agenda=runtime.residentLife?.people[npc.id]?.agenda;
  const scores=options.map(option=>scoreOption(option,person,memories,world,runtime.tick,agenda));
  const pending = planner.pendingChoices[npc.id];
  if (pending) {
    delete planner.pendingChoices[npc.id];
    const fresh = buildResidentLifeContext(world, runtime, npc, options, preferredId,events);
    const accepted = JSON.stringify(pending.context) === JSON.stringify(fresh) && options.some(option => option.id === pending.choice.candidateId);
    selection = accepted ? pending.choice : { candidateId: selected.id, source: "stale" };
    selected = options.find(option => option.id === selection!.candidateId)!;
    selectedBy="provider";
    planner.providerDecisions.push({ context: fresh, choice: structuredClone(selection) });
    planner.providerDecisions = planner.providerDecisions.slice(-512);
  } else if (planner.mode === "offline-agent" && options.length>1 && planner.modelBudget.used < planner.modelBudget.limit) {
    planner.modelBudget.used += 1;
    selected = options.find(option=>option.id===[...scores].sort((a,b)=>b.total-a.total||a.candidateId.localeCompare(b.candidateId,"en"))[0].candidateId)!;
    selectedBy="local-goals";
  } else if(planner.mode==="offline-agent"&&options.length>1)selectedBy="budget-fallback";
  const proposal: ResidentLifeProposal = {
    schema: "resident-life-proposal.v1", id: `life-proposal-${world.id}-${runtime.tick}-${npc.id}-${selected.id}`,
    npcId: npc.id, tick: runtime.tick, expectedWorldRevision: runtime.commandRevision ?? 0, mode: planner.mode,
    candidateId: selected.id, npcIds: [...selected.npcIds], sourceRefs: [...selected.sourceRefs], retrievedMemoryIds: memories.map(memory => memory.memoryId),
    rationale: selected.ruleReasons.join("；").slice(0, 240), confidence: Math.round(clamp(.55 + (memories[0]?.score ?? 0) * .35 + (planner.mode === "offline-agent" ? .1 : 0), 0, 1) * 1000) / 1000,
    ...(selection ? { selection } : {}),evaluation:{selectedBy,goalId:residentGoalForKind(agenda,selected.kind)?.id??null,scores}
  };
  return { proposal, option: admitResidentLifeProposal(world, runtime, proposal, options,events) };
}

export function admitResidentLifeProposal(world: WorldState, runtime: PersistentTownRuntime, proposal: ResidentLifeProposal, options: ResidentLifeOption[], events?: ReadonlyMap<string, WorldEvent>) {
  const planner = runtime.residentLife?.planner ?? createResidentLifePlanner();
  const option = options.find(candidate => candidate.id === proposal.candidateId);
  const policy = sourcePolicy(world, runtime);
  if (proposal.schema !== "resident-life-proposal.v1" || proposal.tick !== runtime.tick || proposal.expectedWorldRevision !== (runtime.commandRevision ?? 0))
    throw new ResidentProposalRejection("STALE_CONTEXT", "居民提案对应的生活状态已经变化。");
  if (!option || proposal.npcId !== option.npcIds[0] || proposal.npcIds.join("\u0000") !== option.npcIds.join("\u0000"))
    throw new ResidentProposalRejection("ILLEGAL_CANDIDATE", "居民提案不在当前合法候选中。");
  const memoryIds = retrieveResidentMemories(world, runtime, proposal.npcId, { limit: 6,locationId:option.locationId,events }).map(hit => hit.memoryId);
  if (!proposal.sourceRefs.includes(policy) || JSON.stringify(proposal.sourceRefs) !== JSON.stringify(option.sourceRefs) ||
    JSON.stringify(proposal.retrievedMemoryIds) !== JSON.stringify(memoryIds))
    throw new ResidentProposalRejection("UNKNOWN_SOURCE", "居民提案引用了无法解析的来源。");
  if (!Number.isFinite(proposal.confidence) || proposal.confidence < 0 || proposal.confidence > 1 || typeof proposal.rationale !== "string" || proposal.rationale.length > 240)
    throw new ResidentProposalRejection("ILLEGAL_CANDIDATE", "居民提案的说明无效。");
  if(proposal.evaluation&&proposal.evaluation.goalId!==(residentGoalForKind(runtime.residentLife?.people[proposal.npcId]?.agenda,option.kind)?.id??null))
    throw new ResidentProposalRejection("UNKNOWN_SOURCE","居民提案的个人目标来源无效。");
  const existing = planner.proposals.find(item => item.id === proposal.id);
  if (existing && JSON.stringify(existing) !== JSON.stringify(proposal)) throw new ResidentProposalRejection("ACTION_REUSED", "居民提案编号已经用于另一件事。");
  if (!existing) planner.proposals.push(structuredClone(proposal));
  planner.proposals = planner.proposals.slice(-512);
  return option;
}
