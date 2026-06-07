import type {
  CaseFromLog,
  CausalEventLink,
  CausalTraceReport,
  NpcGoal,
  NpcIntent,
  WorldCausalTrace,
  WorldEvent,
  WorldState
} from "./world-types";

const keyEventTags = ["secret_leak", "motive", "means", "opportunity", "murder", "staging", "trace", "alibi", "exclusion"];

function eventTimeValue(event: WorldEvent) {
  const [hours, minutes] = event.time.split(":").map(Number);
  return (event.day - 1) * 24 * 60 + hours * 60 + minutes;
}

function relationFor(from: WorldEvent, to: WorldEvent): CausalEventLink["relation"] {
  if (to.tags.includes("means")) return "means-enables";
  if (to.tags.includes("secret_leak") || to.tags.includes("motive")) return "secret-risk-raises";
  if (to.tags.includes("opportunity")) return "opportunity-enables";
  if (to.type === "death") return "crime-causes";
  if (to.tags.includes("staging")) return "staging-creates";
  if (to.tags.includes("trace")) return "trace-reveals";
  if (to.tags.includes("alibi") || to.tags.includes("exclusion")) return "alibi-excludes";
  if (from.type === "move") return "schedule-enables";
  return "conflict-triggers";
}

function actionFor(event: WorldEvent): NpcIntent["intendedAction"] {
  if (event.type === "move") return "routine";
  if (event.tags.includes("means")) return "obtain_means";
  if (event.tags.includes("secret_leak") || event.type === "conflict") return "threaten";
  if (event.tags.includes("opportunity")) return "follow";
  if (event.type === "death") return "attack";
  if (event.tags.includes("staging")) return "stage_scene";
  if (event.tags.includes("trace")) return "hide_trace";
  if (event.type === "alibi") return "avoid";
  if (event.type === "witness") return "testify";
  return "routine";
}

function riskFactors(event: WorldEvent) {
  const risks: string[] = [];
  if (event.tags.includes("secret_leak")) risks.push("秘密暴露风险");
  if (event.tags.includes("motive")) risks.push("动机升级");
  if (event.tags.includes("means")) risks.push("手段接触");
  if (event.tags.includes("opportunity")) risks.push("案发窗口接近");
  if (event.tags.includes("staging")) risks.push("伪装现场");
  if (event.tags.includes("trace")) risks.push("物证残留");
  if (event.tags.includes("alibi")) risks.push("不在场排除");
  return risks.length ? risks : ["日程行为"];
}

function keyEvents(events: WorldEvent[], caseFromLog: CaseFromLog) {
  const caseEventIds = new Set([
    ...caseFromLog.sourceEventIds,
    caseFromLog.deathEventId,
    caseFromLog.generationProfile.motiveEventId,
    caseFromLog.generationProfile.meansEventId,
    caseFromLog.generationProfile.opportunityEventId,
    caseFromLog.generationProfile.stagingEventId,
    caseFromLog.generationProfile.traceEventId,
    caseFromLog.generationProfile.groupAlibiEventId
  ]);
  return events
    .filter((event) => caseEventIds.has(event.id) || keyEventTags.some((tag) => event.tags.includes(tag)))
    .sort((a, b) => eventTimeValue(a) - eventTimeValue(b));
}

export function deriveNpcIntentTimeline(world: WorldState, events: WorldEvent[]): NpcIntent[] {
  return events
    .filter((event) => event.actorIds.length > 0)
    .map((event) => {
      const npcId = event.actorIds[0];
      const npc = world.npcs.find((item) => item.id === npcId);
      const goalId = event.goalId || `goal-${npcId}-protect-secret`;
      return {
        id: event.intentId || `intent-${event.id}`,
        npcId,
        goalId,
        time: `第${event.day}日 ${event.time}`,
        locationId: event.locationId,
        reason: event.explanation || event.summary || event.publicSummary,
        riskFactors: riskFactors(event),
        intendedAction: actionFor(event),
        visibleToPlayer: !event.hidden || event.type === "alibi" || event.type === "witness",
        relatedSecret: npc?.secret
      } as NpcIntent;
    });
}

export function buildWorldCausalTrace(world: WorldState, events: WorldEvent[], caseFromLog: CaseFromLog): WorldCausalTrace {
  const ordered = keyEvents(events, caseFromLog);
  const goalsByNpc = new Map<string, NpcGoal>();
  for (const npc of world.npcs) {
    goalsByNpc.set(npc.id, {
      id: `goal-${npc.id}-protect-secret`,
      npcId: npc.id,
      label: npc.id === caseFromLog.generationProfile.culpritId ? "阻止秘密公开并转移嫌疑" : "维持日常并保护个人秘密",
      priority: npc.id === caseFromLog.generationProfile.culpritId ? 100 : caseFromLog.generationProfile.focusSuspectIds.includes(npc.id) ? 72 : 45,
      targetLocationId: npc.id === caseFromLog.generationProfile.culpritId ? caseFromLog.generationProfile.sceneLocationId : npc.schedule["20:00"] || "town-square",
      relatedSecret: npc.secret,
      activeFrom: "08:00",
      activeUntil: "23:00"
    });
  }
  const intents = deriveNpcIntentTimeline(world, ordered);
  const links: CausalEventLink[] = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const from = ordered[index - 1];
    const to = ordered[index];
    if (to.causedByEventIds?.length) {
      for (const fromEventId of to.causedByEventIds) {
        links.push({ fromEventId, toEventId: to.id, relation: relationFor(from, to), explanation: to.explanation || `${fromEventId} 推动了 ${to.id}` });
      }
    } else {
      links.push({ fromEventId: from.id, toEventId: to.id, relation: relationFor(from, to), explanation: to.explanation || `${from.publicSummary} 推动了后续事件。` });
    }
  }
  const keyEventIds = new Set(ordered.map((event) => event.id));
  const intentBacked = ordered.filter((event) => event.intentId || intents.some((intent) => intent.id === `intent-${event.id}`)).length;
  const complete =
    ordered.some((event) => event.tags.includes("motive")) &&
    ordered.some((event) => event.tags.includes("means")) &&
    ordered.some((event) => event.tags.includes("opportunity")) &&
    ordered.some((event) => event.type === "death") &&
    ordered.some((event) => event.tags.includes("staging")) &&
    ordered.some((event) => event.tags.includes("trace")) &&
    links.length >= Math.max(0, keyEventIds.size - 1) &&
    intentBacked === ordered.length;
  const emergenceScore = Math.min(100, Math.round((intentBacked / Math.max(ordered.length, 1)) * 55 + (links.length / Math.max(ordered.length - 1, 1)) * 25 + (complete ? 20 : 0)));
  return {
    caseId: caseFromLog.id,
    goals: Array.from(goalsByNpc.values()),
    intents,
    links,
    orderedEventIds: ordered.map((event) => event.id),
    publicEventIds: ordered.filter((event) => !event.hidden).map((event) => event.id),
    hiddenEventIds: ordered.filter((event) => event.hidden).map((event) => event.id),
    complete,
    emergenceScore
  };
}

export function validateCausalTrace(world: WorldState, events: WorldEvent[], caseFromLog: CaseFromLog): CausalTraceReport {
  const trace = caseFromLog.causalTrace || buildWorldCausalTrace(world, events, caseFromLog);
  const eventIds = new Set(events.map((event) => event.id));
  const errors: string[] = [];
  const warnings: string[] = [];
  const totalKeyEvents = trace.orderedEventIds.length;
  const intentBackedEvents = trace.orderedEventIds.filter((id) => trace.intents.some((intent) => intent.id === `intent-${id}` || events.find((event) => event.id === id)?.intentId === intent.id)).length;
  for (const id of trace.orderedEventIds) if (!eventIds.has(id)) errors.push(`Causal trace references missing event ${id}.`);
  for (const link of trace.links) {
    if (!eventIds.has(link.fromEventId)) errors.push(`Causal link references missing source event ${link.fromEventId}.`);
    if (!eventIds.has(link.toEventId)) errors.push(`Causal link references missing target event ${link.toEventId}.`);
  }
  if (!trace.complete) errors.push("Causal trace must include motive, means, opportunity, crime, staging, trace, intents, and links.");
  if (trace.emergenceScore < 85) warnings.push("Emergence score is below showcase quality target.");
  return {
    valid: errors.length === 0,
    complete: trace.complete,
    emergenceScore: trace.emergenceScore,
    intentBackedEvents,
    totalKeyEvents,
    errors,
    warnings
  };
}
