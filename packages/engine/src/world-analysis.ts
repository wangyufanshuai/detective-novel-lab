import { deriveSuspectMatrix } from "./validators";
import type {
  CaseFromLog,
  CaseQualityReport,
  CulpritCandidateAnalysis,
  DeductionCase,
  ReachabilityResult,
  ReasoningTrace,
  TravelConstraint,
  TravelEdge,
  WorldEvent,
  WorldState
} from "./index";

function minutes(value: string) {
  const match = value.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function distanceMinutes(a: { x?: number; y?: number }, b: { x?: number; y?: number }) {
  const dx = (a.x || 0) - (b.x || 0);
  const dy = (a.y || 0) - (b.y || 0);
  return Math.max(6, Math.round(Math.sqrt(dx * dx + dy * dy) * 8));
}

export function buildTravelConstraint(world: WorldState): TravelConstraint {
  const edges: TravelEdge[] = [];
  for (const location of world.locations) {
    for (const to of location.connectedLocationIds) {
      const target = world.locations.find((item) => item.id === to);
      if (!target) continue;
      edges.push({ from: location.id, to, minutes: distanceMinutes(location, target) });
    }
  }
  return { edges, defaultMinutes: 24 };
}

export function shortestTravelMinutes(constraint: TravelConstraint, from: string, to: string) {
  if (from === to) return 0;
  const locations = new Set<string>();
  for (const edge of constraint.edges) {
    locations.add(edge.from);
    locations.add(edge.to);
  }
  const dist = new Map(Array.from(locations).map((id) => [id, Number.POSITIVE_INFINITY]));
  dist.set(from, 0);
  const queue = [from];
  while (queue.length) {
    const current = queue.shift()!;
    const currentDist = dist.get(current) || 0;
    for (const edge of constraint.edges.filter((item) => item.from === current)) {
      const next = currentDist + edge.minutes;
      if (next < (dist.get(edge.to) || Number.POSITIVE_INFINITY)) {
        dist.set(edge.to, next);
        queue.push(edge.to);
      }
    }
  }
  return dist.get(to) ?? constraint.defaultMinutes;
}

function latestLocationBefore(events: WorldEvent[], characterId: string, day: number, beforeTime: string) {
  const before = minutes(beforeTime);
  return events
    .filter((event) => event.day === day && event.actorIds.includes(characterId) && minutes(event.time) <= before && event.locationId)
    .sort((a, b) => minutes(b.time) - minutes(a.time))[0];
}

export function analyzeReachability(world: WorldState, events: WorldEvent[], caseFromLog: Pick<CaseFromLog, "generationProfile">): ReachabilityResult[] {
  const constraint = buildTravelConstraint(world);
  const death = events.find((event) => event.id === caseFromLog.generationProfile.deathEventId);
  if (!death) return [];
  return world.npcs
    .filter((npc) => npc.id !== caseFromLog.generationProfile.victimId)
    .map((npc) => {
      const source = latestLocationBefore(events, npc.id, death.day, death.time);
      const fromLocationId = source?.locationId || npc.homeLocationId;
      const requiredMinutes = shortestTravelMinutes(constraint, fromLocationId, death.locationId);
      const availableMinutes = source ? Math.max(0, minutes(death.time) - minutes(source.time)) : 0;
      return {
        characterId: npc.id,
        fromLocationId,
        toLocationId: death.locationId,
        availableMinutes,
        requiredMinutes,
        reachable: npc.id === caseFromLog.generationProfile.culpritId || availableMinutes >= requiredMinutes,
        sourceEventId: source?.id
      };
    });
}

export function buildReasoningTrace(deductionCase: DeductionCase, events: WorldEvent[]): ReasoningTrace[] {
  const evidenceToEvent = new Map(events.filter((event) => event.evidenceId).map((event) => [event.evidenceId!, event.id]));
  return (deductionCase.logicPuzzle.criticalReasoningChain || []).map((step) => {
    const eventIds = step.evidenceIds.map((id) => evidenceToEvent.get(id)).filter((id): id is string => Boolean(id));
    return {
      reasoningStepId: step.id,
      conclusion: step.conclusion,
      evidenceIds: step.evidenceIds,
      eventIds,
      complete: eventIds.length === step.evidenceIds.length
    };
  });
}

export function analyzeCulpritCandidates(world: WorldState, events: WorldEvent[], caseFromLog: Pick<CaseFromLog, "deductionCase" | "generationProfile">): CulpritCandidateAnalysis[] {
  const matrix = deriveSuspectMatrix(caseFromLog.deductionCase);
  const reachability = analyzeReachability(world, events, caseFromLog);
  return matrix.map((row) => {
    const reach = reachability.find((item) => item.characterId === row.characterId);
    const contradicted = row.isCulprit ? false : row.excludedByEvidenceIds.length > 0 || reach?.reachable === false;
    const excluded = !row.isCulprit && contradicted;
    const possibleCulprit = row.motive && row.means && row.opportunity && !excluded;
    const reasons = [
      row.motive ? "has motive" : "no motive",
      row.means ? "has means" : "no means",
      row.opportunity ? "has opportunity" : "no opportunity",
      reach?.reachable === false ? "not reachable in time" : "reachable or untested",
      row.excludedByEvidenceIds.length ? `excluded by ${row.excludedByEvidenceIds.join(",")}` : "not evidence-excluded"
    ];
    return {
      characterId: row.characterId,
      name: row.name,
      motive: row.motive,
      means: row.means,
      opportunity: row.opportunity,
      contradicted,
      excluded,
      exclusionEvidenceIds: row.excludedByEvidenceIds,
      reachability: reach,
      possibleCulprit,
      reasons
    };
  });
}

function scoreBool(value: boolean, points: number) {
  return value ? points : 0;
}

function eventMinutes(event: WorldEvent) {
  return (event.day - 1) * 24 * 60 + minutes(event.time);
}

export function buildCaseQualityReport(world: WorldState, events: WorldEvent[], caseFromLog: Pick<CaseFromLog, "deductionCase" | "generationProfile" | "testimonies">): CaseQualityReport {
  const candidateAnalysis = analyzeCulpritCandidates(world, events, caseFromLog);
  const reasoningTrace = buildReasoningTrace(caseFromLog.deductionCase, events);
  const possible = candidateAnalysis.filter((item) => item.possibleCulprit);
  const uniqueCulprit = possible.length === 1 && possible[0].characterId === caseFromLog.generationProfile.culpritId;
  const reachabilityValid = candidateAnalysis.every((item) => item.characterId === caseFromLog.generationProfile.culpritId || item.excluded || item.reachability?.reachable === false);
  const evidenceEventIds = new Set(events.filter((event) => event.evidenceId).map((event) => event.evidenceId || ""));
  const worldBackedEvidence = caseFromLog.deductionCase.truth.decisiveEvidenceIds.every((id) => evidenceEventIds.has(id));
  const memoryIds = new Set((world.memories || []).map((memory) => memory.id));
  const testimonyMemoryIds = (caseFromLog.testimonies || []).flatMap((testimony) => testimony.memoryIds);
  const memoryScopedTestimony = testimonyMemoryIds.length > 0 && testimonyMemoryIds.every((id) => memoryIds.has(id));
  const nonCulpritExcluded = candidateAnalysis.filter((item) => item.characterId !== caseFromLog.generationProfile.culpritId).every((item) => item.excluded);
  const reasoningTraceComplete = reasoningTrace.every((trace) => trace.complete);
  const orderedMinutes = events.map(eventMinutes).sort((a, b) => a - b);
  const spanHours = orderedMinutes.length ? (orderedMinutes[orderedMinutes.length - 1] - orderedMinutes[0]) / 60 : 0;
  const timeline24hComplete = (world.mode !== "showcase" || spanHours <= 24) && events.some((event) => event.time === "08:00") && events.some((event) => event.type === "death");
  const evidenceCoverage = Math.round((reasoningTrace.filter((trace) => trace.complete).length / Math.max(reasoningTrace.length, 1)) * 100);
  const testimonyScore = Math.min(100, (caseFromLog.testimonies || []).filter((item) => item.contradictionEvidenceIds.length > 0).length * 20);
  const memorySupport = Math.min(100, (world.memories || []).filter((memory) => memory.eventId).length >= 20 ? 100 : (world.memories || []).length * 4);
  const fairPlay = scoreBool(caseFromLog.deductionCase.evidence.filter((item) => item.isKey && item.discoverable).length >= 5, 55) + scoreBool(reasoningTrace.every((trace) => trace.complete), 45);
  const uniqueness = uniqueCulprit ? 100 : Math.max(0, 100 - possible.length * 25);
  const redHerringQuality = Math.min(100, (caseFromLog.deductionCase.logicPuzzle.redHerrings || []).length * 40 + candidateAnalysis.filter((item) => !item.possibleCulprit).length);
  const timelineReadability = Math.min(100, caseFromLog.deductionCase.truth.trueTimeline.length * 18);
  const structuralBonus = [worldBackedEvidence, memoryScopedTestimony, timeline24hComplete, nonCulpritExcluded, reasoningTraceComplete].filter(Boolean).length * 4;
  const score = Math.min(100, Math.round((fairPlay + uniqueness + evidenceCoverage + redHerringQuality + testimonyScore + timelineReadability + memorySupport) / 7 + structuralBonus));
  const warnings: string[] = [];
  if (!uniqueCulprit) warnings.push("Culprit is not unique.");
  if (!reachabilityValid) warnings.push("Some non-culprit reachability remains unresolved.");
  if (evidenceCoverage < 100) warnings.push("Some reasoning steps lack event-backed evidence.");
  if (!worldBackedEvidence) warnings.push("Some decisive evidence is not backed by world events.");
  if (!memoryScopedTestimony) warnings.push("Some testimony lacks NPC memory support.");
  if (!timeline24hComplete) warnings.push("Showcase timeline is not contained in a 24h explainable window.");
  return {
    score,
    qualityScore: score,
    fairPlay,
    uniqueness,
    evidenceCoverage,
    redHerringQuality,
    testimonyContradictions: testimonyScore,
    timelineReadability,
    memorySupport,
    worldBackedEvidence,
    memoryScopedTestimony,
    timeline24hComplete,
    nonCulpritExcluded,
    reasoningTraceComplete,
    uniqueCulprit,
    reachabilityValid,
    candidateAnalysis,
    reasoningTrace,
    warnings
  };
}
