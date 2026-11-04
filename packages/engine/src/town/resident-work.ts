import type { PersistentTownRuntime } from "../persistent-town";
import type { MemoryRecord, WorldEvent, WorldState } from "../world-types";
import { townScheduleTarget } from "./daily-routine";

/** Ordinary work has no automatic evidence/rumour/institution resolution. The
 * existing investigation long actions retain their separate result contract. */
export const RESIDENT_WORK_JOBS = [
  { id: "repair-book", npcId: "rb-xu-zhiwei", locationId: "books", skill: "book_repair", label: "修复旧书", output: "完成一本旧书的修复", durationMinutes: 15 },
  { id: "verify-timetable", npcId: "rb-gu-yuanshan", locationId: "station", skill: "records", label: "核对车次记录", output: "完成一份车次记录的核对", durationMinutes: 10 },
  { id: "reconcile-guest-register", npcId: "rb-lin-ali", locationId: "inn", skill: "hospitality", label: "整理旅馆登记簿", output: "完成一份旅馆登记簿的整理", durationMinutes: 10 }
] as const;

type Job = typeof RESIDENT_WORK_JOBS[number];
export type ResidentWorkSource = "model" | "offline" | "timeout" | "invalid" | "error" | "budget" | "stale";
export type ResidentWorkChoice = { candidateId: string; source: ResidentWorkSource; provider?: string; model?: string };
export type ResidentWorkContext = {
  schema: "resident-work-context.v1";
  worldId: string; npcId: string; tick: number; worldRevision: number; day: number; time: string;
  self: { name: string; role: string; goal: string; fatigue: number; locationId: string };
  memories: Array<{ id: string; eventId: string; kind: MemoryRecord["kind"]; summary: string; confidence: number }>;
  candidates: Array<{ id: string; label: string; durationMinutes: number }>;
};
export type ResidentWorkDecision = {
  id: string; context: ResidentWorkContext; choice: ResidentWorkChoice;
};
export type ResidentWorkAction = {
  id: string; decisionId: string; npcId: string; jobId: string | null; locationId: string;
  status: "running" | "completed" | "interrupted";
  durationMinutes: number; elapsedMinutes: number; startedAtMinute: number; endedAtMinute?: number;
  startedAtTick: number; updatedAtTick: number; eventIds: string[]; reason?: string;
};
export type TownResidentWork = {
  schema: "town-resident-work.v1"; enabled: true; lastTick: number;
  stations: Record<string, { pending: number; reserved: number; completed: number; outputEventIds: string[] }>;
  active: Record<string, ResidentWorkAction>; history: ResidentWorkAction[];
  pendingDecisions: Record<string, ResidentWorkDecision>; decisions: ResidentWorkDecision[];
  rejectedDecisionIds: string[];
  modelBudget: { limit: number; used: number; reservationIds: string[] };
};

export function townAbsoluteMinute(runtime: Pick<PersistentTownRuntime, "currentDay" | "currentTime">) {
  const [h, m] = runtime.currentTime.split(":").map(Number);
  return (runtime.currentDay - 1) * 1440 + h * 60 + m;
}

/** Explicit opt-in only. Reading a legacy save never installs this policy. */
export function enableTownResidentWork(world: WorldState, runtime: PersistentTownRuntime) {
  if (runtime.residentWork) return runtime.residentWork;
  if (!runtime.dailyRoutine?.enabled) throw new Error("Resident work requires the authored daily routine");
  for (const job of RESIDENT_WORK_JOBS) {
    const npc = world.npcs.find(person => person.id === job.npcId);
    if (!npc?.skills.includes(job.skill) || !world.locations.some(place => place.id === job.locationId)) throw new Error("Resident work cast does not match this world");
  }
  runtime.residentWork = {
    schema: "town-resident-work.v1", enabled: true, lastTick: runtime.tick,
    stations: Object.fromEntries(RESIDENT_WORK_JOBS.map(job => [job.npcId, { pending: 6, reserved: 0, completed: 0, outputEventIds: [] }])),
    active: {}, history: [], pendingDecisions: {}, decisions: [], rejectedDecisionIds: [],
    modelBudget: { limit: 24, used: 0, reservationIds: [] }
  };
  return runtime.residentWork;
}

export function residentWorkOwnsActor(runtime: Pick<PersistentTownRuntime, "residentWork">, npcId: string) {
  return !!runtime.residentWork?.enabled && RESIDENT_WORK_JOBS.some(job => job.npcId === npcId);
}

function eligible(world: WorldState, runtime: PersistentTownRuntime, job: Job) {
  const state = runtime.residentWork;
  const npc = world.npcs.find(person => person.id === job.npcId);
  const agent = runtime.agentStates.find(person => person.npcId === job.npcId);
  if (!state?.enabled || !npc?.alive || !agent || state.active[job.npcId]) return false;
  if (runtime.residentLife?.people[job.npcId]?.activeId || (runtime.residentLife?.people[job.npcId] && runtime.residentLife.people[job.npcId].target !== agent.locationId)) return false;
  if (runtime.dailyRoutine?.journeys[job.npcId] || (runtime.dailyRoutine?.holds[job.npcId]?.untilTick ?? -1) > runtime.tick) return false;
  if (runtime.ruleState?.longActions.some(action => action.actorId === job.npcId && action.status === "running")) return false;
  return agent.locationId === job.locationId && townScheduleTarget(npc, townAbsoluteMinute(runtime)) === job.locationId;
}

/** Only this allowlist is sent to a model. Memories remain subjective records;
 * another NPC's memories, secrets, schedule and case truth are never included. */
export function prepareResidentWorkDecision(world: WorldState, runtime: PersistentTownRuntime, npcId: string): ResidentWorkContext | null {
  const job = RESIDENT_WORK_JOBS.find(item => item.npcId === npcId);
  if (!job || !eligible(world, runtime, job)) return null;
  const npc = world.npcs.find(person => person.id === npcId)!;
  const agent = runtime.agentStates.find(person => person.npcId === npcId)!;
  const candidates: ResidentWorkContext["candidates"] = [];
  if (runtime.residentWork!.stations[npcId].pending > 0 && npc.skills.includes(job.skill) && agent.fatigue < 8) candidates.push({ id: job.id, label: job.label, durationMinutes: job.durationMinutes });
  candidates.push({ id: "rest", label: "在工作地点休息片刻", durationMinutes: runtime.tickIntervalMinutes });
  return {
    schema: "resident-work-context.v1", worldId: world.id, npcId, tick: runtime.tick,
    worldRevision: runtime.commandRevision ?? 0, day: runtime.currentDay, time: runtime.currentTime,
    self: { name: npc.name, role: npc.role, goal: agent.currentGoal.slice(0, 240), fatigue: agent.fatigue, locationId: agent.locationId },
    memories: (world.memories || []).filter(memory => memory.npcId === npcId && memory.worldId === world.id && memory.day <= runtime.currentDay).slice(-6).map(memory => ({ id: memory.id, eventId: memory.eventId, kind: memory.kind, summary: memory.summary.slice(0, 320), confidence: memory.confidence })),
    candidates
  };
}

export function residentWorkDecisionId(context: ResidentWorkContext) {
  return `work-decision-${context.worldId}-${context.npcId}-${context.tick}`;
}

/** Invoke in a durable transaction BEFORE the external request. A repeated
 * reservation is denied, so retries/crashes cannot silently spend twice. */
export function reserveResidentWorkModelAttempt(runtime: PersistentTownRuntime, context: ResidentWorkContext) {
  const state = runtime.residentWork;
  if (!state || context.worldId !== runtime.worldId || context.tick !== runtime.tick || context.worldRevision !== (runtime.commandRevision ?? 0)) return false;
  const id = residentWorkDecisionId(context);
  if (state.modelBudget.used >= state.modelBudget.limit || state.modelBudget.reservationIds.includes(id)) return false;
  state.modelBudget.used++;
  state.modelBudget.reservationIds.push(id);
  return true;
}

/** Server-only proposal admission; callers still commit under the world's CAS.
 * Admission and execution both recheck the exact context and legal candidate. */
export function queueResidentWorkDecision(world: WorldState, runtime: PersistentTownRuntime, context: ResidentWorkContext, choice: ResidentWorkChoice) {
  const state = runtime.residentWork;
  const fresh = prepareResidentWorkDecision(world, runtime, context.npcId);
  if (!state || !fresh || JSON.stringify(fresh) !== JSON.stringify(context)) throw new Error("Resident decision context is stale");
  if (!fresh.candidates.some(candidate => candidate.id === choice.candidateId)) throw new Error("Resident decision is not a legal candidate");
  if (!["model", "offline", "timeout", "invalid", "error", "budget", "stale"].includes(choice.source)) throw new Error("Resident decision source is invalid");
  if (choice.source === "model" && !state.modelBudget.reservationIds.includes(residentWorkDecisionId(context))) throw new Error("Model decision has no durable budget reservation");
  const decision: ResidentWorkDecision = { id: residentWorkDecisionId(context), context: JSON.parse(JSON.stringify(context)), choice: { candidateId: choice.candidateId, source: choice.source, ...(choice.provider ? { provider: choice.provider.slice(0, 64) } : {}), ...(choice.model ? { model: choice.model.slice(0, 120) } : {}) } };
  const existing = state.pendingDecisions[context.npcId];
  if (existing && JSON.stringify(existing) !== JSON.stringify(decision)) throw new Error("Resident decision already has an accepted choice");
  state.pendingDecisions[context.npcId] = decision;
  return decision;
}

function recordWorkEvent(world: WorldState, runtime: PersistentTownRuntime, action: ResidentWorkAction, phase: "started" | "completed" | "interrupted", minute: number): WorldEvent {
  const npc = world.npcs.find(person => person.id === action.npcId)!;
  const job = RESIDENT_WORK_JOBS.find(job => job.id === action.jobId);
  const label = job?.label ?? "休息";
  const summary = phase === "started" ? `${npc.name}开始${label}。` : phase === "completed" ? `${npc.name}${job?.output ?? "结束了片刻休息"}。` : `${npc.name}中断${label}：${action.reason}。`;
  const clock = ((minute % 1440) + 1440) % 1440;
  const event: WorldEvent = {
    id: `${action.id}-${phase}`, worldId: world.id, day: Math.floor(minute / 1440) + 1,
    time: `${String(Math.floor(clock / 60)).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}`,
    type: "work", actorIds: [npc.id], locationId: action.locationId, summary, publicSummary: summary,
    hidden: false, relatedCharacterIds: [npc.id], tags: ["resident_work", `work_${phase}`],
    intentId: action.decisionId, causedByEventIds: phase === "started" ? [] : [action.eventIds[0]]
  };
  action.eventIds.push(event.id);
  world.memories ||= [];
  world.memories.push({ id: `memory-${event.id}`, worldId: world.id, npcId: npc.id, kind: "direct", eventId: event.id, day: event.day, summary, confidence: 1, visibleToPlayer: false, challengeableEvidenceIds: [] });
  npc.memoryEventIds.push(event.id);
  return event;
}

/** Called at the START of the existing clock phase, before any minute elapses. */
export function beginResidentWorkInterval(world: WorldState, runtime: PersistentTownRuntime): WorldEvent[] {
  const state = runtime.residentWork;
  if (!state?.enabled) return [];
  if (state.schema !== "town-resident-work.v1" || state.lastTick !== runtime.tick) throw new Error("Resident work clock is inconsistent");
  const events: WorldEvent[] = [];
  for (const job of RESIDENT_WORK_JOBS) {
    const context = prepareResidentWorkDecision(world, runtime, job.npcId);
    const pending = state.pendingDecisions[job.npcId];
    delete state.pendingDecisions[job.npcId];
    const accepted = pending && context && JSON.stringify(pending.context) === JSON.stringify(context) && context.candidates.some(candidate => candidate.id === pending.choice.candidateId);
    if (pending && !accepted) state.rejectedDecisionIds.push(pending.id);
    if (!context) continue;
    const decision: ResidentWorkDecision = accepted ? pending : { id: residentWorkDecisionId(context), context, choice: { candidateId: context.candidates[0].id, source: pending ? "stale" : "offline" } };
    // No duplicate execution after a saved interval boundary or a retried call.
    if (state.decisions.some(previous => previous.id === decision.id)) throw new Error("Resident decision was already executed");
    state.decisions.push(decision);
    const working = decision.choice.candidateId === job.id;
    const action: ResidentWorkAction = {
      id: `work-${world.id}-${job.npcId}-${runtime.tick}`, decisionId: decision.id, npcId: job.npcId,
      jobId: working ? job.id : null, locationId: job.locationId, status: "running",
      durationMinutes: working ? job.durationMinutes : runtime.tickIntervalMinutes,
      elapsedMinutes: 0, startedAtMinute: townAbsoluteMinute(runtime), startedAtTick: runtime.tick, updatedAtTick: runtime.tick, eventIds: []
    };
    if (working) { state.stations[job.npcId].pending--; state.stations[job.npcId].reserved++; }
    state.active[job.npcId] = action;
    events.push(recordWorkEvent(world, runtime, action, "started", action.startedAtMinute));
  }
  return events;
}

/** Called after commuting. Credit only complete minutes spent on this work;
 * departure, questioning, incapacity and conflicting long actions interrupt it.
 * Reservations return on interruption; only completion creates an output. */
export function advanceResidentWorkInterval(world: WorldState, runtime: PersistentTownRuntime, arrivals: WorldEvent[]): WorldEvent[] {
  const state = runtime.residentWork;
  if (!state?.enabled) return [];
  if (state.lastTick !== runtime.tick - 1) throw new Error("Resident work tick is stale or was already applied");
  const end = townAbsoluteMinute(runtime);
  const start = end - runtime.tickIntervalMinutes;
  const events: WorldEvent[] = [];
  for (const action of Object.values(state.active)) {
    const npc = world.npcs.find(person => person.id === action.npcId);
    const agent = runtime.agentStates.find(person => person.npcId === action.npcId);
    let interruptAt: number | undefined;
    let reason: string | undefined;
    if (!npc?.alive || !agent) reason = "居民已无法继续工作";
    else if ((runtime.dailyRoutine?.holds[npc.id]?.untilTick ?? -1) >= runtime.tick) reason = "正在处理当面询问或约定";
    else if (runtime.ruleState?.longActions.some(item => item.actorId === npc.id && item.status === "running")) reason = "需要处理另一项持续行动";
    if (reason) interruptAt = start;
    else if (npc) {
      for (let minute = start; minute < end; minute++) {
        if (townScheduleTarget(npc, minute) !== action.locationId) { reason = "按日程离开工作地点"; interruptAt = minute; break; }
      }
      if (interruptAt === undefined && (agent!.locationId !== action.locationId || runtime.dailyRoutine?.journeys[npc.id] || arrivals.some(event => event.actorIds.includes(npc.id)))) { reason = "已离开工作位置"; interruptAt = start; }
    }
    const credited = Math.max(0, (interruptAt ?? end) - start);
    const remaining = action.durationMinutes - action.elapsedMinutes;
    action.elapsedMinutes += Math.min(remaining, credited);
    action.updatedAtTick = runtime.tick;
    if (action.elapsedMinutes >= action.durationMinutes) {
      action.status = "completed";
      action.endedAtMinute = start + remaining;
      const event = recordWorkEvent(world, runtime, action, "completed", action.endedAtMinute);
      events.push(event);
      if (action.jobId) {
        const station = state.stations[action.npcId];
        station.reserved--; station.completed++; station.outputEventIds.push(event.id);
      }
      if (agent) agent.fatigue = Math.max(0, Math.min(10, agent.fatigue + (action.jobId ? 1 : -2)));
    } else if (interruptAt !== undefined) {
      action.status = "interrupted"; action.reason = reason; action.endedAtMinute = interruptAt;
      events.push(recordWorkEvent(world, runtime, action, "interrupted", interruptAt));
      if (action.jobId) { state.stations[action.npcId].reserved--; state.stations[action.npcId].pending++; }
    }
    if (action.status !== "running") { state.history.push(action); delete state.active[action.npcId]; }
  }
  state.lastTick = runtime.tick;
  return events;
}

/** Caller must separately prove same-location observation. No decisions,
 * private memories, budgets or off-screen history cross this projection. */
export function residentWorkPlayerView(runtime: Pick<PersistentTownRuntime, "residentWork" | "tick">, npcId: string) {
  const state = runtime.residentWork;
  if (!state?.enabled || !state.stations[npcId]) return null;
  const action = state.active[npcId];
  if (!action) return { status: "idle" as const, label: "此刻没有正在进行的工作", progress: 0, actionId: null };
  const job = RESIDENT_WORK_JOBS.find(job => job.id === action.jobId);
  return { status: action.jobId ? "working" as const : "resting" as const, label: job?.label ?? "休息片刻", progress: Math.floor(action.elapsedMinutes / action.durationMinutes * 100), actionId: action.id };
}
