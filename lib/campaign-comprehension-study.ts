export const CAMPAIGN_STUDY_FORMAT_VERSION = 1 as const;
export const CAMPAIGN_STUDY_STORAGE_KEY = "detective-town-campaign-study-v1";
export const CAMPAIGN_STUDY_EXPORT_FILE = "detective-town-campaign-study-v1.json";
export const CAMPAIGN_STUDY_MAX_RUNS = 16;

export const CAMPAIGN_STUDY_COHORTS = ["mystery-first", "systems-first"] as const;
export const CAMPAIGN_STUDY_PROTOCOLS = ["pilot", "official"] as const;
export const CAMPAIGN_STUDY_SCENARIOS = ["standard", "recovery-probe"] as const;
export const CAMPAIGN_STUDY_STATUSES = ["active", "awaiting-assessment", "completed", "abandoned", "interrupted"] as const;
export const CAMPAIGN_STUDY_STAGES = [
  "opening",
  "case-extraction",
  "join",
  "search",
  "question",
  "challenge",
  "pick-evidence",
  "fill-theory",
  "submit",
  "review-source",
  "world-choice",
  "recovery",
  "finale",
  "debrief"
] as const;
export const CAMPAIGN_STUDY_CONFUSIONS = [
  "current-objective",
  "certified-route",
  "world-choice",
  "advance-town",
  "recovery",
  "finale-cause",
  "replay"
] as const;
export const CAMPAIGN_STUDY_FINALE_RATINGS = ["correct", "partial", "incorrect", "not-assessed"] as const;
export const CAMPAIGN_STUDY_REPLAY_INTENTS = ["different-route", "same-route", "none", "not-assessed"] as const;
export const CAMPAIGN_STUDY_WORLD_CHOICES = [
  "world-lead",
  "resource-commitment",
  "faction-directive",
  "world-event-offer",
  "campaign-recovery",
  "finale-case"
] as const;

export type CampaignStudyCohort = typeof CAMPAIGN_STUDY_COHORTS[number];
export type CampaignStudyProtocol = typeof CAMPAIGN_STUDY_PROTOCOLS[number];
export type CampaignStudyScenario = typeof CAMPAIGN_STUDY_SCENARIOS[number];
export type CampaignStudyStatus = typeof CAMPAIGN_STUDY_STATUSES[number];
export type CampaignStudyStage = typeof CAMPAIGN_STUDY_STAGES[number];
export type CampaignStudyConfusion = typeof CAMPAIGN_STUDY_CONFUSIONS[number];
export type CampaignStudyFinaleRating = typeof CAMPAIGN_STUDY_FINALE_RATINGS[number];
export type CampaignStudyReplayIntent = typeof CAMPAIGN_STUDY_REPLAY_INTENTS[number];
export type CampaignStudyWorldChoice = typeof CAMPAIGN_STUDY_WORLD_CHOICES[number];

export type CampaignStudyTimingAggregate = {
  count: number;
  totalSeconds: number;
  maxSeconds: number;
};

export type CampaignStudyAssessment = {
  primaryActionMisunderstandingCount: number;
  confusionCategories: CampaignStudyConfusion[];
  recoveryPrompted: boolean;
  finaleExplanation: CampaignStudyFinaleRating;
  replayIntent: CampaignStudyReplayIntent;
};

type CampaignStudyMeasurementState = {
  stageStartedAtSeconds: number;
  activeWorldChoiceStartedAtSeconds: Partial<Record<CampaignStudyWorldChoice, number>>;
  recoveryReadyOpen: boolean;
};

export type CampaignStudyRun = {
  formatVersion: typeof CAMPAIGN_STUDY_FORMAT_VERSION;
  ordinal: number;
  cohort: CampaignStudyCohort;
  protocol: CampaignStudyProtocol;
  scenario: CampaignStudyScenario;
  status: CampaignStudyStatus;
  currentStage: CampaignStudyStage;
  elapsedSeconds: number;
  firstMeaningfulActionSeconds?: number;
  stageDurations: Partial<Record<CampaignStudyStage, CampaignStudyTimingAggregate>>;
  worldChoiceDurations: Partial<Record<CampaignStudyWorldChoice, CampaignStudyTimingAggregate>>;
  recoveryShownCount: number;
  recoveryStartedCount: number;
  guidedStepUseCount: number;
  explicitFallbackUseCount: number;
  campaignCompleted: boolean;
  abandonmentStage?: CampaignStudyStage;
  assessment: CampaignStudyAssessment;
  measurement: CampaignStudyMeasurementState;
};

export type CampaignStudyCollection = {
  formatVersion: typeof CAMPAIGN_STUDY_FORMAT_VERSION;
  nextOrdinal: number;
  runs: CampaignStudyRun[];
};

export type CampaignStudyStartInput = {
  cohort: CampaignStudyCohort;
  protocol: CampaignStudyProtocol;
  scenario: CampaignStudyScenario;
  initialStage: CampaignStudyStage;
};

export type CampaignStudySlot = {
  id: string;
  protocol: CampaignStudyProtocol;
  cohort: CampaignStudyCohort;
  scenario: CampaignStudyScenario;
};

export const CAMPAIGN_STUDY_SLOTS = [
  { id: "P1", protocol: "pilot", cohort: "mystery-first", scenario: "standard" },
  { id: "P2", protocol: "pilot", cohort: "systems-first", scenario: "recovery-probe" },
  { id: "O1", protocol: "official", cohort: "mystery-first", scenario: "standard" },
  { id: "O2", protocol: "official", cohort: "systems-first", scenario: "recovery-probe" },
  { id: "O3", protocol: "official", cohort: "systems-first", scenario: "standard" },
  { id: "O4", protocol: "official", cohort: "mystery-first", scenario: "recovery-probe" },
  { id: "O5", protocol: "official", cohort: "mystery-first", scenario: "recovery-probe" },
  { id: "O6", protocol: "official", cohort: "systems-first", scenario: "standard" },
  { id: "O7", protocol: "official", cohort: "systems-first", scenario: "recovery-probe" },
  { id: "O8", protocol: "official", cohort: "mystery-first", scenario: "standard" }
] as const satisfies readonly CampaignStudySlot[];

export type CampaignStudyOperationsState = {
  status: "ready" | "in-progress" | "complete" | "invalid";
  nextSlot?: CampaignStudySlot;
  completedPilotCount: number;
  eligibleOfficialCount: number;
  reason: string;
};

export type CampaignStudyExportRun = Omit<CampaignStudyRun, "measurement">;
export type CampaignStudyExport = {
  formatVersion: typeof CAMPAIGN_STUDY_FORMAT_VERSION;
  runs: CampaignStudyExportRun[];
};

export const CAMPAIGN_STUDY_CONFUSION_TIE_BREAK = [
  "current-objective",
  "certified-route",
  "world-choice",
  "advance-town",
  "recovery",
  "finale-cause",
  "replay"
] as const satisfies readonly CampaignStudyConfusion[];

export type CampaignStudyGateMetric = {
  passed: boolean;
  observed: string;
  threshold: string;
};

export type CampaignStudyGateBreakdown = {
  label: string;
  attempts: number;
  completed: number;
  medianFirstActionSeconds: number | null;
  meanMisunderstandings: number;
};

export type CampaignStudyGateAnalysis = {
  status: "insufficient-data" | "human-gate-passed" | "human-gate-failed";
  sampleReady: boolean;
  humanGatePassed: boolean;
  eligibleOfficialCount: number;
  interruptedOfficialCount: number;
  unfinishedOfficialCount: number;
  officialOrderValid: boolean;
  matrixCounts: Record<`${CampaignStudyCohort}/${CampaignStudyScenario}`, number>;
  metrics: {
    firstMeaningfulAction: CampaignStudyGateMetric;
    mainObjectiveUnderstanding: CampaignStudyGateMetric;
    recoveryWithoutPrompt: CampaignStudyGateMetric;
    campaignCompletion: CampaignStudyGateMetric;
    finaleExplanation: CampaignStudyGateMetric;
    replayIntent: CampaignStudyGateMetric;
  };
  assistance: {
    guidedStepUseCount: number;
    explicitFallbackUseCount: number;
    medianCompletedElapsedSeconds: number | null;
  };
  confusionFrequency: Array<{ category: CampaignStudyConfusion; attempts: number }>;
  topConfusions: CampaignStudyConfusion[];
  cohortBreakdown: CampaignStudyGateBreakdown[];
  scenarioBreakdown: CampaignStudyGateBreakdown[];
};

const emptyTiming = (): CampaignStudyTimingAggregate => ({ count: 0, totalSeconds: 0, maxSeconds: 0 });

function nonNegativeInteger(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function isOneOf<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function normalizeTiming(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyTiming();
  const record = value as Record<string, unknown>;
  return {
    count: nonNegativeInteger(record.count),
    totalSeconds: nonNegativeInteger(record.totalSeconds),
    maxSeconds: nonNegativeInteger(record.maxSeconds)
  };
}

function normalizeTimingMap<T extends readonly string[]>(values: T, input: unknown) {
  const record = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const entries = values.flatMap((key) => record[key] ? [[key, normalizeTiming(record[key])]] : []);
  return Object.fromEntries(entries) as Partial<Record<T[number], CampaignStudyTimingAggregate>>;
}

function addDuration(
  map: Partial<Record<string, CampaignStudyTimingAggregate>>,
  key: string,
  seconds: number
) {
  const duration = nonNegativeInteger(seconds);
  const current = map[key] || emptyTiming();
  return {
    ...map,
    [key]: {
      count: current.count + 1,
      totalSeconds: current.totalSeconds + duration,
      maxSeconds: Math.max(current.maxSeconds, duration)
    }
  };
}

function defaultAssessment(): CampaignStudyAssessment {
  return {
    primaryActionMisunderstandingCount: 0,
    confusionCategories: [],
    recoveryPrompted: false,
    finaleExplanation: "not-assessed",
    replayIntent: "not-assessed"
  };
}

export function createCampaignStudyCollection(): CampaignStudyCollection {
  return { formatVersion: CAMPAIGN_STUDY_FORMAT_VERSION, nextOrdinal: 1, runs: [] };
}

function normalizeRun(value: unknown): CampaignStudyRun | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (!isOneOf(CAMPAIGN_STUDY_COHORTS, record.cohort)
    || !isOneOf(CAMPAIGN_STUDY_PROTOCOLS, record.protocol)
    || !isOneOf(CAMPAIGN_STUDY_SCENARIOS, record.scenario)
    || !isOneOf(CAMPAIGN_STUDY_STATUSES, record.status)
    || !isOneOf(CAMPAIGN_STUDY_STAGES, record.currentStage)) return undefined;
  const assessmentRecord = record.assessment && typeof record.assessment === "object" && !Array.isArray(record.assessment)
    ? record.assessment as Record<string, unknown>
    : {};
  const confusionCategories = Array.isArray(assessmentRecord.confusionCategories)
    ? Array.from(new Set(assessmentRecord.confusionCategories.filter((item): item is CampaignStudyConfusion => isOneOf(CAMPAIGN_STUDY_CONFUSIONS, item))))
    : [];
  const measurementRecord = record.measurement && typeof record.measurement === "object" && !Array.isArray(record.measurement)
    ? record.measurement as Record<string, unknown>
    : {};
  const activeChoiceRecord = measurementRecord.activeWorldChoiceStartedAtSeconds && typeof measurementRecord.activeWorldChoiceStartedAtSeconds === "object" && !Array.isArray(measurementRecord.activeWorldChoiceStartedAtSeconds)
    ? measurementRecord.activeWorldChoiceStartedAtSeconds as Record<string, unknown>
    : {};
  const activeWorldChoiceStartedAtSeconds = Object.fromEntries(CAMPAIGN_STUDY_WORLD_CHOICES.flatMap((key) =>
    activeChoiceRecord[key] === undefined ? [] : [[key, nonNegativeInteger(activeChoiceRecord[key])]]
  ));
  return {
    formatVersion: CAMPAIGN_STUDY_FORMAT_VERSION,
    ordinal: Math.max(1, nonNegativeInteger(record.ordinal, 1)),
    cohort: record.cohort,
    protocol: record.protocol,
    scenario: record.scenario,
    status: record.status,
    currentStage: record.currentStage,
    elapsedSeconds: nonNegativeInteger(record.elapsedSeconds),
    firstMeaningfulActionSeconds: record.firstMeaningfulActionSeconds === undefined ? undefined : nonNegativeInteger(record.firstMeaningfulActionSeconds),
    stageDurations: normalizeTimingMap(CAMPAIGN_STUDY_STAGES, record.stageDurations),
    worldChoiceDurations: normalizeTimingMap(CAMPAIGN_STUDY_WORLD_CHOICES, record.worldChoiceDurations),
    recoveryShownCount: nonNegativeInteger(record.recoveryShownCount),
    recoveryStartedCount: nonNegativeInteger(record.recoveryStartedCount),
    guidedStepUseCount: nonNegativeInteger(record.guidedStepUseCount),
    explicitFallbackUseCount: nonNegativeInteger(record.explicitFallbackUseCount),
    campaignCompleted: Boolean(record.campaignCompleted),
    abandonmentStage: isOneOf(CAMPAIGN_STUDY_STAGES, record.abandonmentStage) ? record.abandonmentStage : undefined,
    assessment: {
      primaryActionMisunderstandingCount: nonNegativeInteger(assessmentRecord.primaryActionMisunderstandingCount),
      confusionCategories,
      recoveryPrompted: Boolean(assessmentRecord.recoveryPrompted),
      finaleExplanation: isOneOf(CAMPAIGN_STUDY_FINALE_RATINGS, assessmentRecord.finaleExplanation) ? assessmentRecord.finaleExplanation : "not-assessed",
      replayIntent: isOneOf(CAMPAIGN_STUDY_REPLAY_INTENTS, assessmentRecord.replayIntent) ? assessmentRecord.replayIntent : "not-assessed"
    },
    measurement: {
      stageStartedAtSeconds: nonNegativeInteger(measurementRecord.stageStartedAtSeconds),
      activeWorldChoiceStartedAtSeconds,
      recoveryReadyOpen: Boolean(measurementRecord.recoveryReadyOpen)
    }
  };
}

export function retainCampaignStudyRuns(runs: CampaignStudyRun[]) {
  const ordered = [...runs].sort((left, right) => left.ordinal - right.ordinal);
  if (ordered.length <= CAMPAIGN_STUDY_MAX_RUNS) return ordered;
  const official = ordered.filter((run) => run.protocol === "official").slice(-CAMPAIGN_STUDY_MAX_RUNS);
  const availablePilotSlots = Math.max(0, CAMPAIGN_STUDY_MAX_RUNS - official.length);
  const pilots = ordered.filter((run) => run.protocol === "pilot").slice(-availablePilotSlots);
  return [...official, ...pilots].sort((left, right) => left.ordinal - right.ordinal);
}

export function normalizeCampaignStudyCollection(value: unknown): CampaignStudyCollection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return createCampaignStudyCollection();
  const record = value as Record<string, unknown>;
  const runs = retainCampaignStudyRuns((Array.isArray(record.runs) ? record.runs : []).map(normalizeRun).filter((run): run is CampaignStudyRun => Boolean(run)));
  const highestOrdinal = runs.reduce((highest, run) => Math.max(highest, run.ordinal), 0);
  return {
    formatVersion: CAMPAIGN_STUDY_FORMAT_VERSION,
    nextOrdinal: Math.max(highestOrdinal + 1, nonNegativeInteger(record.nextOrdinal, 1)),
    runs
  };
}

function matchesCampaignStudySlot(run: Pick<CampaignStudyRun, "protocol" | "cohort" | "scenario">, slot: CampaignStudySlot) {
  return run.protocol === slot.protocol && run.cohort === slot.cohort && run.scenario === slot.scenario;
}

export function getCampaignStudyOperationsState(value: unknown): CampaignStudyOperationsState {
  const collection = normalizeCampaignStudyCollection(value);
  const ordered = [...collection.runs].sort((left, right) => left.ordinal - right.ordinal);
  const terminal = ordered.filter((run) => run.protocol === "pilot"
    ? run.status === "completed"
    : run.status === "completed" || run.status === "abandoned");
  const inProgress = ordered.filter((run) => run.status === "active" || run.status === "awaiting-assessment");
  let cursor = 0;

  for (const run of terminal) {
    const expected = CAMPAIGN_STUDY_SLOTS[cursor];
    if (!expected || !matchesCampaignStudySlot(run, expected)) {
      return {
        status: "invalid",
        completedPilotCount: Math.min(cursor, 2),
        eligibleOfficialCount: Math.max(0, cursor - 2),
        reason: "Stored study attempts do not match the fixed slot order. Reset study data before recruiting participants."
      };
    }
    cursor += 1;
  }

  if (inProgress.length > 1) {
    return {
      status: "invalid",
      completedPilotCount: Math.min(cursor, 2),
      eligibleOfficialCount: Math.max(0, cursor - 2),
      reason: "More than one unfinished study attempt is stored. Reset study data before recruiting participants."
    };
  }

  const current = inProgress[0];
  const nextSlot = CAMPAIGN_STUDY_SLOTS[cursor];
  if (current) {
    const lastTerminalOrdinal = terminal.at(-1)?.ordinal || 0;
    if (!nextSlot || current.ordinal < lastTerminalOrdinal || !matchesCampaignStudySlot(current, nextSlot)) {
      return {
        status: "invalid",
        completedPilotCount: Math.min(cursor, 2),
        eligibleOfficialCount: Math.max(0, cursor - 2),
        reason: "The unfinished attempt does not match the fixed next slot. Reset study data before recruiting participants."
      };
    }
    return {
      status: "in-progress",
      nextSlot,
      completedPilotCount: Math.min(cursor, 2),
      eligibleOfficialCount: Math.max(0, cursor - 2),
      reason: `${nextSlot.id} is already in progress.`
    };
  }

  if (!nextSlot) {
    return {
      status: "complete",
      completedPilotCount: 2,
      eligibleOfficialCount: 8,
      reason: "All fixed pilot and official slots are complete."
    };
  }

  return {
    status: "ready",
    nextSlot,
    completedPilotCount: Math.min(cursor, 2),
    eligibleOfficialCount: Math.max(0, cursor - 2),
    reason: `${nextSlot.id} is the only valid next study slot.`
  };
}

export function canStartCampaignStudySlot(
  collection: CampaignStudyCollection,
  input: Pick<CampaignStudyStartInput, "protocol" | "cohort" | "scenario">
) {
  const operations = getCampaignStudyOperationsState(collection);
  return operations.status === "ready" && Boolean(operations.nextSlot && matchesCampaignStudySlot(input, operations.nextSlot));
}

export function startNextCampaignStudyRun(collection: CampaignStudyCollection, initialStage: CampaignStudyStage) {
  const operations = getCampaignStudyOperationsState(collection);
  if (operations.status !== "ready" || !operations.nextSlot) return undefined;
  return startCampaignStudyRun(collection, { ...operations.nextSlot, initialStage });
}

export function startCampaignStudyRun(collection: CampaignStudyCollection, input: CampaignStudyStartInput) {
  const normalized = normalizeCampaignStudyCollection(collection);
  const ordinal = normalized.nextOrdinal;
  const run: CampaignStudyRun = {
    formatVersion: CAMPAIGN_STUDY_FORMAT_VERSION,
    ordinal,
    cohort: input.cohort,
    protocol: input.protocol,
    scenario: input.scenario,
    status: "active",
    currentStage: input.initialStage,
    elapsedSeconds: 0,
    stageDurations: {},
    worldChoiceDurations: {},
    recoveryShownCount: 0,
    recoveryStartedCount: 0,
    guidedStepUseCount: 0,
    explicitFallbackUseCount: 0,
    campaignCompleted: false,
    assessment: defaultAssessment(),
    measurement: {
      stageStartedAtSeconds: 0,
      activeWorldChoiceStartedAtSeconds: {},
      recoveryReadyOpen: false
    }
  };
  return {
    collection: {
      ...normalized,
      nextOrdinal: ordinal + 1,
      runs: retainCampaignStudyRuns([...normalized.runs, run])
    },
    run
  };
}

export function updateCampaignStudyRun(collection: CampaignStudyCollection, ordinal: number, update: (run: CampaignStudyRun) => CampaignStudyRun) {
  return {
    ...collection,
    runs: retainCampaignStudyRuns(collection.runs.map((run) => run.ordinal === ordinal ? update(run) : run))
  };
}

export function withCampaignStudyElapsed(run: CampaignStudyRun, elapsedSeconds: number) {
  return { ...run, elapsedSeconds: Math.max(run.elapsedSeconds, nonNegativeInteger(elapsedSeconds)) };
}

export function advanceCampaignStudyStage(run: CampaignStudyRun, nextStage: CampaignStudyStage, elapsedSeconds: number) {
  const elapsed = Math.max(run.elapsedSeconds, nonNegativeInteger(elapsedSeconds));
  if (run.status !== "active" || run.currentStage === nextStage) return withCampaignStudyElapsed(run, elapsed);
  const duration = Math.max(0, elapsed - run.measurement.stageStartedAtSeconds);
  return {
    ...run,
    currentStage: nextStage,
    elapsedSeconds: elapsed,
    stageDurations: addDuration(run.stageDurations, run.currentStage, duration),
    measurement: { ...run.measurement, stageStartedAtSeconds: elapsed }
  };
}

export function recordCampaignStudyMeaningfulAction(run: CampaignStudyRun, elapsedSeconds: number) {
  const elapsed = Math.max(run.elapsedSeconds, nonNegativeInteger(elapsedSeconds));
  if (run.status !== "active") return withCampaignStudyElapsed(run, elapsed);
  return {
    ...run,
    elapsedSeconds: elapsed,
    firstMeaningfulActionSeconds: run.firstMeaningfulActionSeconds ?? elapsed
  };
}

export function startCampaignStudyWorldChoice(run: CampaignStudyRun, kind: CampaignStudyWorldChoice, elapsedSeconds: number) {
  if (run.status !== "active" || run.measurement.activeWorldChoiceStartedAtSeconds[kind] !== undefined) return run;
  const elapsed = Math.max(run.elapsedSeconds, nonNegativeInteger(elapsedSeconds));
  return {
    ...run,
    elapsedSeconds: elapsed,
    measurement: {
      ...run.measurement,
      activeWorldChoiceStartedAtSeconds: { ...run.measurement.activeWorldChoiceStartedAtSeconds, [kind]: elapsed }
    }
  };
}

export function completeCampaignStudyWorldChoice(run: CampaignStudyRun, kind: CampaignStudyWorldChoice, elapsedSeconds: number) {
  const startedAt = run.measurement.activeWorldChoiceStartedAtSeconds[kind];
  const elapsed = Math.max(run.elapsedSeconds, nonNegativeInteger(elapsedSeconds));
  if (run.status !== "active" || startedAt === undefined) return recordCampaignStudyMeaningfulAction(run, elapsed);
  const activeWorldChoiceStartedAtSeconds = { ...run.measurement.activeWorldChoiceStartedAtSeconds };
  delete activeWorldChoiceStartedAtSeconds[kind];
  return recordCampaignStudyMeaningfulAction({
    ...run,
    elapsedSeconds: elapsed,
    worldChoiceDurations: addDuration(run.worldChoiceDurations, kind, Math.max(0, elapsed - startedAt)),
    measurement: { ...run.measurement, activeWorldChoiceStartedAtSeconds }
  }, elapsed);
}

export function observeCampaignStudyRecovery(run: CampaignStudyRun, ready: boolean, elapsedSeconds: number) {
  const elapsed = Math.max(run.elapsedSeconds, nonNegativeInteger(elapsedSeconds));
  if (run.status !== "active" || run.measurement.recoveryReadyOpen === ready) return withCampaignStudyElapsed(run, elapsed);
  return {
    ...run,
    elapsedSeconds: elapsed,
    recoveryShownCount: ready ? run.recoveryShownCount + 1 : run.recoveryShownCount,
    measurement: { ...run.measurement, recoveryReadyOpen: ready }
  };
}

export function recordCampaignStudyRecoveryStarted(run: CampaignStudyRun, elapsedSeconds: number) {
  const elapsed = Math.max(run.elapsedSeconds, nonNegativeInteger(elapsedSeconds));
  if (run.status !== "active") return withCampaignStudyElapsed(run, elapsed);
  const next = completeCampaignStudyWorldChoice(run, "campaign-recovery", elapsed);
  return { ...next, recoveryStartedCount: next.recoveryStartedCount + 1 };
}

export function recordCampaignStudyAssistance(run: CampaignStudyRun, kind: "guided-step" | "explicit-fallback", elapsedSeconds: number) {
  const elapsed = Math.max(run.elapsedSeconds, nonNegativeInteger(elapsedSeconds));
  if (run.status !== "active") return withCampaignStudyElapsed(run, elapsed);
  return {
    ...withCampaignStudyElapsed(run, elapsed),
    guidedStepUseCount: run.guidedStepUseCount + (kind === "guided-step" ? 1 : 0),
    explicitFallbackUseCount: run.explicitFallbackUseCount + (kind === "explicit-fallback" ? 1 : 0)
  };
}

export function markCampaignStudyCompleted(run: CampaignStudyRun, elapsedSeconds: number): CampaignStudyRun {
  if (run.status !== "active") return run;
  const elapsed = Math.max(run.elapsedSeconds, nonNegativeInteger(elapsedSeconds));
  const duration = Math.max(0, elapsed - run.measurement.stageStartedAtSeconds);
  return {
    ...run,
    status: "awaiting-assessment",
    currentStage: "debrief",
    elapsedSeconds: elapsed,
    stageDurations: addDuration(run.stageDurations, run.currentStage, duration),
    campaignCompleted: true,
    measurement: { ...run.measurement, stageStartedAtSeconds: elapsed, activeWorldChoiceStartedAtSeconds: {} }
  };
}

export function abandonCampaignStudyRun(run: CampaignStudyRun, elapsedSeconds: number): CampaignStudyRun {
  if (run.status !== "active" && run.status !== "awaiting-assessment") return run;
  const elapsed = Math.max(run.elapsedSeconds, nonNegativeInteger(elapsedSeconds));
  return {
    ...run,
    status: "abandoned",
    elapsedSeconds: elapsed,
    abandonmentStage: run.currentStage,
    measurement: { ...run.measurement, activeWorldChoiceStartedAtSeconds: {} }
  };
}

export function interruptCampaignStudyRun(run: CampaignStudyRun): CampaignStudyRun {
  if (run.status !== "active") return run;
  return {
    ...run,
    status: "interrupted",
    abandonmentStage: run.currentStage,
    measurement: { ...run.measurement, activeWorldChoiceStartedAtSeconds: {} }
  };
}

export function updateCampaignStudyAssessment(run: CampaignStudyRun, assessment: Partial<CampaignStudyAssessment>) {
  const confusionCategories = assessment.confusionCategories
    ? Array.from(new Set(assessment.confusionCategories.filter((item): item is CampaignStudyConfusion => isOneOf(CAMPAIGN_STUDY_CONFUSIONS, item))))
    : run.assessment.confusionCategories;
  return {
    ...run,
    assessment: {
      primaryActionMisunderstandingCount: assessment.primaryActionMisunderstandingCount === undefined
        ? run.assessment.primaryActionMisunderstandingCount
        : nonNegativeInteger(assessment.primaryActionMisunderstandingCount),
      confusionCategories,
      recoveryPrompted: assessment.recoveryPrompted ?? run.assessment.recoveryPrompted,
      finaleExplanation: assessment.finaleExplanation && isOneOf(CAMPAIGN_STUDY_FINALE_RATINGS, assessment.finaleExplanation)
        ? assessment.finaleExplanation
        : run.assessment.finaleExplanation,
      replayIntent: assessment.replayIntent && isOneOf(CAMPAIGN_STUDY_REPLAY_INTENTS, assessment.replayIntent)
        ? assessment.replayIntent
        : run.assessment.replayIntent
    }
  };
}

export function finalizeCampaignStudyRun(run: CampaignStudyRun) {
  if (run.status !== "awaiting-assessment"
    || run.assessment.finaleExplanation === "not-assessed"
    || run.assessment.replayIntent === "not-assessed") return undefined;
  return { ...run, status: "completed" as const };
}

export function interruptActiveCampaignStudyRuns(collection: CampaignStudyCollection): CampaignStudyCollection {
  return {
    ...collection,
    runs: collection.runs.map(interruptCampaignStudyRun)
  };
}

export function toCampaignStudyExport(collection: CampaignStudyCollection): CampaignStudyExport {
  return {
    formatVersion: CAMPAIGN_STUDY_FORMAT_VERSION,
    runs: normalizeCampaignStudyCollection(collection).runs.map(({ measurement: _measurement, ...run }) => run)
  };
}

function normalizeCampaignStudyExport(value: unknown): CampaignStudyExport {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const runs = (Array.isArray(record.runs) ? record.runs : [])
    .map(normalizeRun)
    .filter((run): run is CampaignStudyRun => Boolean(run))
    .map(({ measurement: _measurement, ...run }) => run);
  return { formatVersion: CAMPAIGN_STUDY_FORMAT_VERSION, runs };
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Number.isFinite(value) ? value : null;
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function fixed(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function buildBreakdown(label: string, runs: CampaignStudyExportRun[]): CampaignStudyGateBreakdown {
  return {
    label,
    attempts: runs.length,
    completed: runs.filter((run) => run.campaignCompleted).length,
    medianFirstActionSeconds: median(runs.map((run) => run.firstMeaningfulActionSeconds ?? Number.POSITIVE_INFINITY)),
    meanMisunderstandings: mean(runs.map((run) => run.assessment.primaryActionMisunderstandingCount))
  };
}

export function analyzeCampaignStudyGate(value: unknown): CampaignStudyGateAnalysis {
  const exported = normalizeCampaignStudyExport(value);
  const official = exported.runs.filter((run) => run.protocol === "official").sort((left, right) => left.ordinal - right.ordinal);
  const eligible = official.filter((run) => run.status === "completed" || run.status === "abandoned");
  const interruptedOfficialCount = official.filter((run) => run.status === "interrupted").length;
  const unfinishedOfficialCount = official.filter((run) => run.status === "active" || run.status === "awaiting-assessment").length;
  const matrixKeys = [
    "mystery-first/standard",
    "mystery-first/recovery-probe",
    "systems-first/standard",
    "systems-first/recovery-probe"
  ] as const;
  const matrixCounts = Object.fromEntries(matrixKeys.map((key) => {
    const [cohort, scenario] = key.split("/") as [CampaignStudyCohort, CampaignStudyScenario];
    return [key, eligible.filter((run) => run.cohort === cohort && run.scenario === scenario).length];
  })) as CampaignStudyGateAnalysis["matrixCounts"];
  const officialSlots = CAMPAIGN_STUDY_SLOTS.filter((slot) => slot.protocol === "official");
  const officialOrderValid = eligible.length <= officialSlots.length
    && eligible.every((run, index) => matchesCampaignStudySlot(run, officialSlots[index]));
  const sampleReady = eligible.length === 8 && officialOrderValid && matrixKeys.every((key) => matrixCounts[key] === 2);

  const firstActionValues = eligible.map((run) => run.firstMeaningfulActionSeconds ?? Number.POSITIVE_INFINITY);
  const firstActionMedian = median(firstActionValues);
  const firstActionMissing = eligible.filter((run) => run.firstMeaningfulActionSeconds === undefined).length;
  const withinOneMisunderstanding = eligible.filter((run) => run.assessment.primaryActionMisunderstandingCount <= 1).length;
  const misunderstandingMean = mean(eligible.map((run) => run.assessment.primaryActionMisunderstandingCount));
  const recoveryRuns = eligible.filter((run) => run.scenario === "recovery-probe");
  const unpromptedRecovery = recoveryRuns.filter((run) => run.recoveryStartedCount > 0 && !run.assessment.recoveryPrompted).length;
  const completed = eligible.filter((run) => run.campaignCompleted).length;
  const correctFinale = eligible.filter((run) => run.assessment.finaleExplanation === "correct").length;
  const differentRouteReplay = eligible.filter((run) => run.assessment.replayIntent === "different-route").length;

  const metricConditions = {
    firstMeaningfulAction: firstActionMedian !== null && firstActionMedian < 300,
    mainObjectiveUnderstanding: withinOneMisunderstanding >= 7 && misunderstandingMean <= 1,
    recoveryWithoutPrompt: recoveryRuns.length === 4 && unpromptedRecovery >= 3,
    campaignCompletion: completed >= 6,
    finaleExplanation: correctFinale >= 7,
    replayIntent: differentRouteReplay >= 4
  };
  const allMetricsPassed = Object.values(metricConditions).every(Boolean);
  const humanGatePassed = sampleReady && allMetricsPassed;

  const confusionFrequency = CAMPAIGN_STUDY_CONFUSION_TIE_BREAK.map((category) => ({
    category,
    attempts: eligible.filter((run) => run.assessment.confusionCategories.includes(category)).length
  })).sort((left, right) => right.attempts - left.attempts
    || CAMPAIGN_STUDY_CONFUSION_TIE_BREAK.indexOf(left.category) - CAMPAIGN_STUDY_CONFUSION_TIE_BREAK.indexOf(right.category));

  return {
    status: !sampleReady ? "insufficient-data" : humanGatePassed ? "human-gate-passed" : "human-gate-failed",
    sampleReady,
    humanGatePassed,
    eligibleOfficialCount: eligible.length,
    interruptedOfficialCount,
    unfinishedOfficialCount,
    officialOrderValid,
    matrixCounts,
    metrics: {
      firstMeaningfulAction: {
        passed: sampleReady && metricConditions.firstMeaningfulAction,
        observed: `${firstActionMedian === null ? "not measurable" : `${fixed(firstActionMedian)}s median`}; ${firstActionMissing} missing`,
        threshold: "median < 300s; missing values count as infinite"
      },
      mainObjectiveUnderstanding: {
        passed: sampleReady && metricConditions.mainObjectiveUnderstanding,
        observed: `${withinOneMisunderstanding}/8 at <=1; ${fixed(misunderstandingMean)} mean`,
        threshold: "at least 7/8 at <=1 and mean <=1"
      },
      recoveryWithoutPrompt: {
        passed: sampleReady && metricConditions.recoveryWithoutPrompt,
        observed: `${unpromptedRecovery}/${recoveryRuns.length} unprompted starts`,
        threshold: "at least 3/4 Recovery probes"
      },
      campaignCompletion: {
        passed: sampleReady && metricConditions.campaignCompletion,
        observed: `${completed}/8 completed`,
        threshold: "at least 6/8 completed"
      },
      finaleExplanation: {
        passed: sampleReady && metricConditions.finaleExplanation,
        observed: `${correctFinale}/8 correct`,
        threshold: "at least 7/8 correct"
      },
      replayIntent: {
        passed: sampleReady && metricConditions.replayIntent,
        observed: `${differentRouteReplay}/8 different-route`,
        threshold: "at least 4/8 different-route"
      }
    },
    assistance: {
      guidedStepUseCount: eligible.reduce((total, run) => total + run.guidedStepUseCount, 0),
      explicitFallbackUseCount: eligible.reduce((total, run) => total + run.explicitFallbackUseCount, 0),
      medianCompletedElapsedSeconds: median(eligible.filter((run) => run.campaignCompleted).map((run) => run.elapsedSeconds))
    },
    confusionFrequency,
    topConfusions: sampleReady ? confusionFrequency.slice(0, 3).map((item) => item.category) : [],
    cohortBreakdown: CAMPAIGN_STUDY_COHORTS.map((cohort) => buildBreakdown(cohort, eligible.filter((run) => run.cohort === cohort))),
    scenarioBreakdown: CAMPAIGN_STUDY_SCENARIOS.map((scenario) => buildBreakdown(scenario, eligible.filter((run) => run.scenario === scenario)))
  };
}

export function renderCampaignStudyGateReport(analysis: CampaignStudyGateAnalysis) {
  const metricLabels: Array<[keyof CampaignStudyGateAnalysis["metrics"], string]> = [
    ["firstMeaningfulAction", "First meaningful action"],
    ["mainObjectiveUnderstanding", "Main-objective understanding"],
    ["recoveryWithoutPrompt", "Unprompted Recovery"],
    ["campaignCompletion", "Campaign completion"],
    ["finaleExplanation", "Finale explanation"],
    ["replayIntent", "Different-route Replay intent"]
  ];
  const statusLabel = analysis.status === "human-gate-passed"
    ? "human gate passed"
    : analysis.status === "human-gate-failed"
      ? "human gate failed"
      : "instrumentation ready / human gate pending";
  const metricRows = metricLabels.map(([key, label]) => {
    const metric = analysis.metrics[key];
    return `| ${label} | ${metric.observed} | ${metric.threshold} | ${analysis.sampleReady ? metric.passed ? "PASS" : "FAIL" : "PENDING"} |`;
  });
  const breakdownRows = [...analysis.cohortBreakdown, ...analysis.scenarioBreakdown].map((item) =>
    `| ${item.label} | ${item.attempts} | ${item.completed} | ${item.medianFirstActionSeconds === null ? "not measurable" : `${fixed(item.medianFirstActionSeconds)}s`} | ${fixed(item.meanMisunderstandings)} |`
  );
  const confusionRows = analysis.confusionFrequency.map((item, index) => `| ${index + 1} | ${item.category} | ${item.attempts} |`);
  const completedMedian = analysis.assistance.medianCompletedElapsedSeconds;

  return [
    "# v6.2 Human Campaign Comprehension Gate Results",
    "",
    "## Status",
    "",
    `**${statusLabel}**`,
    "",
    `Eligible official attempts: ${analysis.eligibleOfficialCount}/8. Fixed order: ${analysis.officialOrderValid ? "valid" : "invalid"}. Interrupted official attempts: ${analysis.interruptedOfficialCount}. Unfinished official attempts: ${analysis.unfinishedOfficialCount}.`,
    "",
    "An eligible attempt is an uninterrupted official run ending as completed or abandoned. Abandoned attempts remain in the denominator and count as incomplete; interrupted attempts require replacement.",
    "",
    "## Exit Gate",
    "",
    "| Metric | Observed | Threshold | Result |",
    "|---|---:|---:|---|",
    ...metricRows,
    "",
    "## Aggregate Context",
    "",
    `Guided Step uses: ${analysis.assistance.guidedStepUseCount}. Explicit fallback uses: ${analysis.assistance.explicitFallbackUseCount}. Median elapsed time among completed attempts: ${completedMedian === null ? "not measurable" : `${fixed(completedMedian)}s`}.`,
    "",
    "| Aggregate | Attempts | Completed | Median first action | Mean misunderstandings |",
    "|---|---:|---:|---:|---:|",
    ...breakdownRows,
    "",
    "## Confusion Ranking",
    "",
    "Frequency is the number of eligible official attempts containing the fixed category. Ties follow the protocol order.",
    "",
    "| Rank | Category | Attempts |",
    "|---:|---|---:|",
    ...confusionRows,
    "",
    analysis.sampleReady
      ? `Top three for the v6.3 decision: ${analysis.topConfusions.map((item) => `\`${item}\``).join(", ")}.`
      : "Top three for the v6.3 decision are unavailable until the official matrix is complete.",
    "",
    "## Decision",
    "",
    analysis.status === "human-gate-passed"
      ? "All six thresholds pass. v6.3 Progressive Disclosure and Campaign Pacing may be planned from the observed aggregate evidence."
      : analysis.status === "human-gate-failed"
        ? "At least one threshold fails. The gate remains open; v6.3 is limited to layout, ordering, or copy changes addressing the three most frequent confusion categories."
        : "No result claim is permitted until the fixed 2 x 2 matrix contains eight eligible official attempts. Main-path behavior remains frozen.",
    "",
    "This report contains aggregate results only. The browser-local safe export remains outside the repository."
  ].join("\n");
}
