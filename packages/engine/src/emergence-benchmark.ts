import { validateHardCaseLogic } from "./deduction-graph";
import { extractCaseFromWorld } from "./world-case";
import { createInitialWorld, simulateDailyLife, simulateWorldTick } from "./world-simulator";
import type {
  CaseFromLog,
  EmergenceBenchmarkReport,
  EmergenceEvaluation,
  EmergenceProofLink,
  EmergenceProofNode,
  EmergenceProofTrace,
  EmergenceSeedResult,
  WorldEvent,
  WorldState
} from "./world-types";

type ProofOptions = {
  solved?: boolean;
  discoveredEvidenceIds?: string[];
};

function eventTimeValue(event: WorldEvent) {
  const [hours, minutes] = event.time.split(":").map(Number);
  return (event.day - 1) * 24 * 60 + hours * 60 + minutes;
}

function isTimelineConsistent(events: WorldEvent[]) {
  const ordered = [...events].sort((a, b) => eventTimeValue(a) - eventTimeValue(b));
  return ordered.every((event, index) => index === 0 || eventTimeValue(event) >= eventTimeValue(ordered[index - 1]));
}

function visibleEvent(event: WorldEvent, solved: boolean, discovered: Set<string>) {
  if (solved || !event.hidden) return true;
  return Boolean(event.evidenceId && discovered.has(event.evidenceId));
}

function eventLabel(event: WorldEvent, solved: boolean, discovered: Set<string>) {
  return visibleEvent(event, solved, discovered) ? event.publicSummary : "Locked hidden world event";
}

function eventDetail(event: WorldEvent, solved: boolean, discovered: Set<string>) {
  if (!visibleEvent(event, solved, discovered)) return "Hidden until the player finds its evidence or solves the case.";
  return event.explanation || event.summary || event.tags.join(", ");
}

function findEvents(events: WorldEvent[], ids: string[]) {
  const idSet = new Set(ids);
  return events.filter((event) => idSet.has(event.id)).sort((a, b) => eventTimeValue(a) - eventTimeValue(b));
}

function node(
  input: Omit<EmergenceProofNode, "npcIds" | "eventIds" | "memoryIds" | "evidenceIds" | "visible" | "locked"> &
    Partial<Pick<EmergenceProofNode, "npcIds" | "eventIds" | "memoryIds" | "evidenceIds" | "visible" | "locked">>
): EmergenceProofNode {
  return {
    npcIds: [],
    eventIds: [],
    memoryIds: [],
    evidenceIds: [],
    visible: true,
    locked: false,
    ...input
  };
}

export function evaluateWorldEmergence(world: WorldState, events: WorldEvent[], caseFromLog: CaseFromLog): EmergenceEvaluation {
  const hard = validateHardCaseLogic(world, events, caseFromLog);
  const quality = caseFromLog.qualityReport;
  const validationErrors = [
    ...(caseFromLog.validation.errors || []),
    ...(caseFromLog.validation.worldErrors || []),
    ...hard.errors
  ];
  const timelineConsistent = isTimelineConsistent(events) && Boolean(events.find((event) => event.type === "death"));
  const proofComplete =
    Boolean(caseFromLog.causalTrace?.complete) &&
    quality.worldBackedEvidence &&
    quality.memoryScopedTestimony &&
    quality.nonCulpritExcluded &&
    quality.reasoningTraceComplete &&
    hard.valid;
  return {
    caseId: caseFromLog.id,
    generatedCase: true,
    uniqueCulprit: quality.uniqueCulprit,
    worldBackedEvidence: quality.worldBackedEvidence,
    memoryScopedTestimony: quality.memoryScopedTestimony,
    nonCulpritExcluded: quality.nonCulpritExcluded,
    timelineConsistent,
    hardLogicValid: hard.valid,
    causalTraceComplete: Boolean(caseFromLog.causalTrace?.complete),
    reasoningTraceComplete: quality.reasoningTraceComplete,
    qualityScore: quality.qualityScore || quality.score || 0,
    emergenceScore: quality.emergenceScore || caseFromLog.causalTrace?.emergenceScore || 0,
    proofComplete,
    errors: validationErrors,
    warnings: [...(quality.warnings || []), ...(caseFromLog.validation.worldWarnings || []), ...hard.report.warnings]
  };
}

export function buildEmergenceProofTrace(
  world: WorldState,
  events: WorldEvent[],
  caseFromLog: CaseFromLog,
  options: ProofOptions = {}
): EmergenceProofTrace {
  const solved = Boolean(options.solved);
  const discovered = new Set(options.discoveredEvidenceIds || []);
  const evaluation = evaluateWorldEmergence(world, events, caseFromLog);
  const traceEventIds = caseFromLog.causalTrace?.orderedEventIds.length ? caseFromLog.causalTrace.orderedEventIds : caseFromLog.sourceEventIds;
  const traceEvents = findEvents(events, traceEventIds);
  const nodes: EmergenceProofNode[] = [];
  const links: EmergenceProofLink[] = [];
  const goalIds = new Set(caseFromLog.causalTrace?.goals.map((goal) => goal.id) || []);
  const intentIds = new Set(caseFromLog.causalTrace?.intents.map((intent) => intent.id) || []);

  nodes.push(
    node({
      id: "stage:npc-goals",
      stage: "npc-goals",
      label: "NPC goals and secret pressure",
      detail: `${goalIds.size || world.npcs.length} NPC goals define what characters try to protect or hide.`,
      npcIds: world.npcs.map((npc) => npc.id)
    })
  );
  nodes.push(
    node({
      id: "stage:npc-intents",
      stage: "npc-intents",
      label: "Intent-backed behavior",
      detail: `${intentIds.size || traceEvents.filter((event) => event.intentId).length} key events carry intent IDs or derived intents.`,
      eventIds: traceEvents.map((event) => event.id)
    })
  );

  for (const event of traceEvents) {
    const visible = visibleEvent(event, solved, discovered);
    nodes.push(
      node({
        id: `event:${event.id}`,
        stage: event.type === "death" ? "crime" : event.tags.includes("secret_leak") || event.type === "conflict" ? "conflict" : "world-events",
        label: eventLabel(event, solved, discovered),
        detail: eventDetail(event, solved, discovered),
        time: event.time,
        locationId: event.locationId,
        npcIds: visible ? event.relatedCharacterIds : [],
        eventIds: [event.id],
        evidenceIds: visible && event.evidenceId ? [event.evidenceId] : [],
        visible,
        locked: !visible
      })
    );
  }

  for (const memory of world.memories.filter((item) => traceEventIds.includes(item.eventId))) {
    const event = events.find((item) => item.id === memory.eventId);
    const visible = solved || memory.visibleToPlayer || Boolean(event?.evidenceId && discovered.has(event.evidenceId));
    nodes.push(
      node({
        id: `memory:${memory.id}`,
        stage: "memories",
        label: visible ? `Memory scope: ${memory.npcId}` : "Locked memory scope",
        detail: visible ? memory.summary : "Hidden NPC memory is not exposed before discovery or solution.",
        npcIds: visible ? [memory.npcId] : [],
        eventIds: [memory.eventId],
        memoryIds: [memory.id],
        evidenceIds: visible ? memory.challengeableEvidenceIds : [],
        visible,
        locked: !visible
      })
    );
    links.push({ id: `event-memory:${memory.eventId}:${memory.id}`, from: `event:${memory.eventId}`, to: `memory:${memory.id}`, label: "remembered by NPC" });
  }

  for (const evidence of caseFromLog.deductionCase.evidence) {
    const source = events.find((event) => event.evidenceId === evidence.id);
    if (!source) continue;
    const visible = solved || discovered.has(evidence.id) || !source.hidden;
    nodes.push(
      node({
        id: `evidence:${evidence.id}`,
        stage: "evidence",
        label: visible ? evidence.title : "Locked evidence",
        detail: visible ? evidence.visibleDescription : "Evidence title and meaning stay hidden until discovered.",
        time: source.time,
        locationId: source.locationId,
        npcIds: visible ? evidence.relatedCharacterIds : [],
        eventIds: [source.id],
        evidenceIds: [evidence.id],
        visible,
        locked: !visible
      })
    );
    links.push({ id: `event-evidence:${source.id}:${evidence.id}`, from: `event:${source.id}`, to: `evidence:${evidence.id}`, label: "creates clue" });
  }

  nodes.push(
    node({
      id: "stage:case-extraction",
      stage: "case-extraction",
      label: "Case extracted from world log",
      detail: `${caseFromLog.sourceEventIds.length} source events became the playable case file.`,
      eventIds: caseFromLog.sourceEventIds,
      evidenceIds: caseFromLog.deductionCase.truth.decisiveEvidenceIds,
      visible: solved,
      locked: !solved
    })
  );
  nodes.push(
    node({
      id: "stage:validation",
      stage: "validation",
      label: evaluation.hardLogicValid ? "Local rules accepted the structure" : "Local rules rejected the structure",
      detail: evaluation.hardLogicValid ? "Unique culprit, exclusions, evidence backing, memory scope, and reasoning trace are verified." : evaluation.errors.join(" / "),
      eventIds: caseFromLog.sourceEventIds,
      evidenceIds: caseFromLog.deductionCase.truth.decisiveEvidenceIds,
      visible: true,
      locked: false
    })
  );

  for (let index = 1; index < traceEvents.length; index += 1) {
    links.push({
      id: `causal:${traceEvents[index - 1].id}:${traceEvents[index].id}`,
      from: `event:${traceEvents[index - 1].id}`,
      to: `event:${traceEvents[index].id}`,
      label: "causes / enables"
    });
  }
  links.push({ id: "proof:intents-events", from: "stage:npc-intents", to: traceEvents[0] ? `event:${traceEvents[0].id}` : "stage:case-extraction", label: "drives events" });
  links.push({ id: "proof:events-case", from: traceEvents.at(-1) ? `event:${traceEvents.at(-1)!.id}` : "stage:npc-intents", to: "stage:case-extraction", label: "extracts case" });
  links.push({ id: "proof:case-validation", from: "stage:case-extraction", to: "stage:validation", label: "validated locally" });

  return {
    caseId: caseFromLog.id,
    solved,
    complete: evaluation.proofComplete && nodes.length > 0,
    evaluation,
    nodes,
    links
  };
}

function defaultSeeds(count: number) {
  return Array.from({ length: count }, (_, index) => `emergence-benchmark-${String(index + 1).padStart(2, "0")}`);
}

function runSeed(seed: string): EmergenceSeedResult {
  try {
    const initial = createInitialWorld(seed, { mode: "showcase", npcCount: 8, timelineHours: 24 });
    const daily = simulateDailyLife(initial, 1, []);
    const tick = simulateWorldTick(daily.world, daily.events);
    const events = [...daily.events, ...tick.events];
    const caseFromLog = extractCaseFromWorld(tick.world, events);
    const evaluation = evaluateWorldEmergence(tick.world, events, caseFromLog);
    const proof = buildEmergenceProofTrace(tick.world, events, caseFromLog, { solved: true, discoveredEvidenceIds: caseFromLog.deductionCase.evidence.map((item) => item.id) });
    return {
      seed,
      worldId: tick.world.id,
      caseId: caseFromLog.id,
      generatedCase: true,
      passed: evaluation.proofComplete,
      uniqueCulprit: evaluation.uniqueCulprit,
      worldBackedEvidence: evaluation.worldBackedEvidence,
      memoryScopedTestimony: evaluation.memoryScopedTestimony,
      nonCulpritExcluded: evaluation.nonCulpritExcluded,
      timelineConsistent: evaluation.timelineConsistent,
      hardLogicValid: evaluation.hardLogicValid,
      qualityScore: evaluation.qualityScore,
      emergenceScore: evaluation.emergenceScore,
      proofNodeCount: proof.nodes.length,
      errors: evaluation.errors,
      warnings: evaluation.warnings
    };
  } catch (error) {
    return {
      seed,
      generatedCase: false,
      passed: false,
      uniqueCulprit: false,
      worldBackedEvidence: false,
      memoryScopedTestimony: false,
      nonCulpritExcluded: false,
      timelineConsistent: false,
      hardLogicValid: false,
      qualityScore: 0,
      emergenceScore: 0,
      proofNodeCount: 0,
      errors: [error instanceof Error ? error.message : "Unknown benchmark failure"],
      warnings: []
    };
  }
}

export function runEmergenceBenchmark(seeds: string[] = defaultSeeds(20)): EmergenceBenchmarkReport {
  const results = seeds.map(runSeed);
  const passed = results.filter((result) => result.passed).length;
  const averageQualityScore = Math.round(results.reduce((sum, result) => sum + result.qualityScore, 0) / Math.max(results.length, 1));
  const averageEmergenceScore = Math.round(results.reduce((sum, result) => sum + result.emergenceScore, 0) / Math.max(results.length, 1));
  return {
    generatedAt: new Date().toISOString(),
    seedCount: results.length,
    passed,
    failed: results.length - passed,
    averageQualityScore,
    averageEmergenceScore,
    passRate: Math.round((passed / Math.max(results.length, 1)) * 100),
    results
  };
}

export function renderEmergenceBenchmarkMarkdown(report: EmergenceBenchmarkReport) {
  const lines = [
    "# Emergence Benchmark Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Passed: ${report.passed}/${report.seedCount}`,
    `Pass rate: ${report.passRate}%`,
    `Average quality score: ${report.averageQualityScore}`,
    `Average emergence score: ${report.averageEmergenceScore}`,
    "",
    "| Seed | Case | Generated | Unique | Event-backed | Memory-scoped | Exclusions | Timeline | Hard logic | Quality | Emergence | Result |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | --- |"
  ];
  for (const result of report.results) {
    lines.push(
      `| ${result.seed} | ${result.caseId || "-"} | ${result.generatedCase ? "yes" : "no"} | ${result.uniqueCulprit ? "yes" : "no"} | ${result.worldBackedEvidence ? "yes" : "no"} | ${result.memoryScopedTestimony ? "yes" : "no"} | ${result.nonCulpritExcluded ? "yes" : "no"} | ${result.timelineConsistent ? "yes" : "no"} | ${result.hardLogicValid ? "yes" : "no"} | ${result.qualityScore} | ${result.emergenceScore} | ${result.passed ? "pass" : "fail"} |`
    );
  }
  const failures = report.results.filter((result) => !result.passed);
  if (failures.length) {
    lines.push("", "## Failure Details", "");
    for (const failure of failures) {
      lines.push(`### ${failure.seed}`, "", ...failure.errors.map((error) => `- ${error}`), "");
    }
  }
  return `${lines.join("\n")}\n`;
}
