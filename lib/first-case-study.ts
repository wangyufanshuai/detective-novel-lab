/** Manual observer records. These are never inferred from game telemetry. */
export const FIRST_CASE_STUDY_SCHEMA = "detective.first-case-observer.v1" as const;
export const FIRST_CASE_STUDY_PROTOCOL = "first-case-observer-20260906-v1" as const;
export const FIRST_CASE_STUDY_CASE_LABEL = "印刷低语" as const;
export const FIRST_CASE_STUDY_MAX_EVENTS = 200;
export const FIRST_CASE_STUDY_MAX_PLAY_SECONDS = 1800;
export const FIRST_CASE_STUDY_STAGES = ["join", "observe", "search", "question", "challenge", "organize", "submit", "review"] as const;
export const FIRST_CASE_STUDY_HELP_KINDS = ["neutral", "directional", "direct", "takeover"] as const;
export const FIRST_CASE_STUDY_CONFUSIONS = ["objective", "control", "evidence", "claim", "rejection", "other"] as const;
export const FIRST_CASE_STUDY_RATINGS = ["correct", "partial", "incorrect", "not-assessed"] as const;
export const FIRST_CASE_STUDY_PARTICIPANTS = ["P01", "P02", "P03", "P04", "P05"] as const;
export const FIRST_CASE_STUDY_STATUSES = ["active", "completed", "abandoned", "interrupted"] as const;
export const FIRST_CASE_STUDY_EVENT_KINDS = [
  "started", "first-effective-action", "stage", "help-neutral", "help-directional", "help-direct", "help-takeover",
  "confusion-objective", "confusion-control", "confusion-evidence", "confusion-claim", "confusion-rejection", "confusion-other",
  "ratings-updated", "completed", "abandoned", "interrupted"
] as const;

export type FirstCaseStudyStage = typeof FIRST_CASE_STUDY_STAGES[number];
export type FirstCaseStudyHelpKind = typeof FIRST_CASE_STUDY_HELP_KINDS[number];
export type FirstCaseStudyConfusion = typeof FIRST_CASE_STUDY_CONFUSIONS[number];
export type FirstCaseStudyRating = typeof FIRST_CASE_STUDY_RATINGS[number];
export type FirstCaseStudyStatus = typeof FIRST_CASE_STUDY_STATUSES[number];
export type FirstCaseStudyMode = "rehearsal" | "human";
export type FirstCaseStudyEvent = { kind: typeof FIRST_CASE_STUDY_EVENT_KINDS[number]; seconds: number; stage?: FirstCaseStudyStage };
export type FirstCaseStudyRun = {
  mode: FirstCaseStudyMode;
  participantId: "R01" | typeof FIRST_CASE_STUDY_PARTICIPANTS[number];
  attemptId: string;
  buildId: string;
  caseLabel: typeof FIRST_CASE_STUDY_CASE_LABEL;
  status: FirstCaseStudyStatus;
  elapsedSeconds: number;
  firstEffectiveActionSeconds: number | null;
  currentStage: FirstCaseStudyStage;
  /** Most recent 200 manual observations; ratings retain only their latest update. */
  events: FirstCaseStudyEvent[];
  helpCounts: Record<FirstCaseStudyHelpKind, number>;
  confusions: FirstCaseStudyConfusion[];
  motiveRating: FirstCaseStudyRating;
  methodRating: FirstCaseStudyRating;
  humanAttested: boolean;
};
export type FirstCaseStudyCollection = {
  schema: typeof FIRST_CASE_STUDY_SCHEMA;
  protocol: typeof FIRST_CASE_STUDY_PROTOCOL;
  /** Allocation high-water mark; removing records must not reissue an attempt identity. */
  lastAttemptNumber: number;
  runs: FirstCaseStudyRun[];
};
export type FirstCaseStudyStartInput = Pick<FirstCaseStudyRun, "mode" | "participantId" | "buildId" | "humanAttested">;

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function record(value: unknown, fields: readonly string[], label: string): Record<string, unknown> {
  check(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  const result = value as Record<string, unknown>;
  check(Object.keys(result).every((key) => fields.includes(key)), `${label} contains unsupported fields`);
  return result;
}
function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function member<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.includes(value);
}
const runFields = ["mode", "participantId", "attemptId", "buildId", "caseLabel", "status", "elapsedSeconds", "firstEffectiveActionSeconds", "currentStage", "events", "helpCounts", "confusions", "motiveRating", "methodRating", "humanAttested"] as const;

/** Strict import boundary: no unknown text, participant answers, or identity fields. */
export function validateFirstCaseStudyCollection(value: unknown): FirstCaseStudyCollection {
  const collection = record(value, ["schema", "protocol", "lastAttemptNumber", "runs"], "Collection");
  check(collection.schema === FIRST_CASE_STUDY_SCHEMA && collection.protocol === FIRST_CASE_STUDY_PROTOCOL, "Unsupported first-case study schema or protocol");
  check(Array.isArray(collection.runs) && collection.runs.length <= 1000, "Runs must be an array with at most 1000 attempts");
  const ids = new Set<string>();
  for (const item of collection.runs) {
    const run = record(item, runFields, "Run");
    check(run.mode === "rehearsal" || run.mode === "human", "Invalid run mode");
    check(run.mode === "rehearsal" ? run.participantId === "R01" : member(FIRST_CASE_STUDY_PARTICIPANTS, run.participantId), "Participant must match the rehearsal or human slot");
    check(typeof run.attemptId === "string" && /^A[0-9]{6}$/.test(run.attemptId) && run.attemptId !== "A000000", "Invalid attempt identifier");
    check(!ids.has(run.attemptId), "Duplicate attempt identifier");
    ids.add(run.attemptId);
    check(typeof run.buildId === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(run.buildId), "A safe production build identifier is required");
    check(run.caseLabel === FIRST_CASE_STUDY_CASE_LABEL, "Unexpected first-case label");
    check(member(FIRST_CASE_STUDY_STATUSES, run.status), "Invalid run status");
    check(typeof run.humanAttested === "boolean" && (run.mode !== "rehearsal" || !run.humanAttested), "Rehearsals cannot be attested human attempts");
    check(integer(run.elapsedSeconds), "Elapsed seconds must be a nonnegative integer");
    check(run.status !== "completed" || run.elapsedSeconds < FIRST_CASE_STUDY_MAX_PLAY_SECONDS, "Completion must occur before the 30-minute play limit");
    check(run.firstEffectiveActionSeconds === null || integer(run.firstEffectiveActionSeconds) && run.firstEffectiveActionSeconds <= run.elapsedSeconds, "First action must be null or an observed time within the run");
    check(member(FIRST_CASE_STUDY_STAGES, run.currentStage), "Invalid study stage");
    check(member(FIRST_CASE_STUDY_RATINGS, run.motiveRating) && member(FIRST_CASE_STUDY_RATINGS, run.methodRating), "Invalid explanation rating");
    const help = record(run.helpCounts, FIRST_CASE_STUDY_HELP_KINDS, "Help counts");
    check(FIRST_CASE_STUDY_HELP_KINDS.every((kind) => integer(help[kind])), "Every help count must be a nonnegative integer");
    check(Array.isArray(run.confusions) && run.confusions.every((kind) => member(FIRST_CASE_STUDY_CONFUSIONS, kind)) && new Set(run.confusions).size === run.confusions.length, "Confusions must be unique supported categories");
    check(Array.isArray(run.events) && run.events.length > 0 && run.events.length <= FIRST_CASE_STUDY_MAX_EVENTS, "Events must contain 1 to 200 manual observations");
    let previousSeconds = 0;
    for (const item of run.events) {
      const event = record(item, ["kind", "seconds", "stage"], "Event");
      check(member(FIRST_CASE_STUDY_EVENT_KINDS, event.kind), "Invalid observation event kind");
      check(integer(event.seconds) && event.seconds >= previousSeconds && event.seconds <= run.elapsedSeconds, "Observation times must be ordered and within the run");
      check(event.stage === undefined || member(FIRST_CASE_STUDY_STAGES, event.stage), "Invalid observation stage");
      check(event.kind !== "stage" || event.stage !== undefined, "Stage events need a stage");
      previousSeconds = event.seconds;
    }
    const terminal = run.events.filter((event) => ["completed", "abandoned", "interrupted"].includes(event.kind));
    check(run.status === "active" ? terminal.length === 0 : terminal.length === 1 && terminal[0].kind === run.status, "Run status must agree with its terminal observation");
  }
  check(collection.runs.filter((run) => run.status === "active").length <= 1, "Only one observation can be active");
  const retainedMaximum = Math.max(0, ...collection.runs.map((run) => Number(run.attemptId.slice(1))));
  // Older v1 exports have no counter. Their retained IDs establish the only known floor.
  const lastAttemptNumber = Object.hasOwn(collection, "lastAttemptNumber") ? collection.lastAttemptNumber : retainedMaximum;
  check(integer(lastAttemptNumber) && lastAttemptNumber >= retainedMaximum && lastAttemptNumber <= 999999, "Attempt allocation counter must cover retained identities and stay within capacity");
  return { ...structuredClone(value) as FirstCaseStudyCollection, lastAttemptNumber };
}

export function createFirstCaseStudyCollection(): FirstCaseStudyCollection {
  return { schema: FIRST_CASE_STUDY_SCHEMA, protocol: FIRST_CASE_STUDY_PROTOCOL, lastAttemptNumber: 0, runs: [] };
}

function idleStudyCollection(value: unknown): FirstCaseStudyCollection {
  const collection = validateFirstCaseStudyCollection(value);
  analyzeFirstCaseStudy(collection);
  check(!collection.runs.some((run) => run.status === "active"), "End the active observation before maintaining records");
  return collection;
}

/** A restored timer cannot continue across machines or page lifetimes. Preserve it as interrupted. */
export function prepareFirstCaseStudyRestore(value: unknown, buildId: string): FirstCaseStudyCollection {
  const collection = validateFirstCaseStudyCollection(value);
  analyzeFirstCaseStudy(collection);
  check(collection.runs.every((run) => run.mode !== "human" || run.buildId === buildId), "Human backup records must match the current frozen build; keep other rounds in their original archive");
  const restored = { ...collection, runs: collection.runs.map((run) => run.status === "active" ? finishFirstCaseStudyRun(run, "interrupted", run.elapsedSeconds) : run) };
  analyzeFirstCaseStudy(restored);
  return restored;
}

export function restoreFirstCaseStudyCollection(current: FirstCaseStudyCollection, backup: unknown, buildId: string): FirstCaseStudyCollection {
  const previous = idleStudyCollection(current);
  const restored = prepareFirstCaseStudyRestore(backup, buildId);
  return { ...restored, lastAttemptNumber: Math.max(previous.lastAttemptNumber, restored.lastAttemptNumber) };
}

/** Each attempt belongs to one person; a replacement may share only their P slot. */
export function withdrawFirstCaseStudyParticipant(value: FirstCaseStudyCollection, participantId: string, attemptId: string, confirmation: string): FirstCaseStudyCollection {
  const collection = idleStudyCollection(value);
  check(member(FIRST_CASE_STUDY_PARTICIPANTS, participantId) && typeof attemptId === "string" && /^A[0-9]{6}$/.test(attemptId) && confirmation === `${participantId}/${attemptId}`, "Type the exact participant/attempt ID pair to confirm withdrawal");
  const target = collection.runs.find((run) => run.mode === "human" && run.participantId === participantId && run.attemptId === attemptId);
  check(target, "No human record exists for this participant/attempt pair");
  return { ...collection, runs: collection.runs.filter((run) => run.attemptId !== target.attemptId) };
}

export function resetFirstCaseStudyCollection(value: FirstCaseStudyCollection, backedUp: boolean, confirmation: string): FirstCaseStudyCollection {
  const collection = idleStudyCollection(value);
  check(backedUp && confirmation === "开始新轮", "Confirm the archive is saved and type 开始新轮 before clearing this round");
  return { ...createFirstCaseStudyCollection(), lastAttemptNumber: collection.lastAttemptNumber };
}

export function startFirstCaseStudyRun(collection: FirstCaseStudyCollection, input: FirstCaseStudyStartInput) {
  const current = validateFirstCaseStudyCollection(collection);
  check(!current.runs.some((run) => run.status === "active"), "Finish or interrupt the active observation before starting another");
  if (input.mode === "human") {
    check(input.humanAttested === true, "Confirm a real human participant before starting a human observation");
    const human = current.runs.filter((run) => run.mode === "human" && run.humanAttested);
    check(human.every((run) => run.buildId === input.buildId), "Attested human attempts contain different production builds; do not pool them");
    check(!human.some((run) => run.participantId === input.participantId && (run.status === "completed" || run.status === "abandoned")), "This human participant already has a terminal outcome; do not select the better attempt");
  }
  const number = current.lastAttemptNumber + 1;
  check(number <= 999999, "Attempt identifier capacity reached");
  const run: FirstCaseStudyRun = {
    ...input, attemptId: `A${String(number).padStart(6, "0")}`, caseLabel: FIRST_CASE_STUDY_CASE_LABEL,
    status: "active", elapsedSeconds: 0, firstEffectiveActionSeconds: null, currentStage: "join",
    events: [{ kind: "started", seconds: 0 }], helpCounts: { neutral: 0, directional: 0, direct: 0, takeover: 0 }, confusions: [],
    motiveRating: "not-assessed", methodRating: "not-assessed"
  };
  const next = validateFirstCaseStudyCollection({ ...current, lastAttemptNumber: number, runs: [...current.runs, run] });
  return { collection: next, run: next.runs[next.runs.length - 1] };
}
export function updateFirstCaseStudyRun(collection: FirstCaseStudyCollection, attemptId: string, update: (run: FirstCaseStudyRun) => FirstCaseStudyRun) {
  const current = validateFirstCaseStudyCollection(collection);
  check(current.runs.some((run) => run.attemptId === attemptId), "Attempt not found");
  const runs = current.runs.map((run) => {
    if (run.attemptId !== attemptId) return run;
    const identity = { attemptId: run.attemptId, participantId: run.participantId, mode: run.mode, buildId: run.buildId, humanAttested: run.humanAttested };
    const next = update(run);
    check(next.attemptId === identity.attemptId && next.participantId === identity.participantId && next.mode === identity.mode && next.buildId === identity.buildId && next.humanAttested === identity.humanAttested, "An existing attempt cannot change its identity or attestation");
    return next;
  });
  return validateFirstCaseStudyCollection({ ...current, runs });
}
export function touchFirstCaseStudyRun(run: FirstCaseStudyRun, elapsedSeconds: number): FirstCaseStudyRun {
  check(typeof elapsedSeconds === "number" && Number.isFinite(elapsedSeconds) && elapsedSeconds >= 0, "Elapsed seconds must be finite and nonnegative");
  if (run.status !== "active") return run;
  return { ...run, elapsedSeconds: Math.max(run.elapsedSeconds, Math.floor(elapsedSeconds)) };
}
function observe(run: FirstCaseStudyRun, kind: FirstCaseStudyEvent["kind"], seconds: number, stage?: FirstCaseStudyStage): FirstCaseStudyRun {
  const next = touchFirstCaseStudyRun(run, seconds);
  return { ...next, events: [...next.events, { kind, seconds: next.elapsedSeconds, ...(stage ? { stage } : {}) }].slice(-FIRST_CASE_STUDY_MAX_EVENTS) };
}
function active(run: FirstCaseStudyRun) { check(run.status === "active", "This observation has already ended"); }
export function markFirstEffectiveAction(run: FirstCaseStudyRun, seconds: number): FirstCaseStudyRun {
  active(run);
  if (run.firstEffectiveActionSeconds !== null) return touchFirstCaseStudyRun(run, seconds);
  const next = observe(run, "first-effective-action", seconds);
  return { ...next, firstEffectiveActionSeconds: next.elapsedSeconds };
}
export function setFirstCaseStudyStage(run: FirstCaseStudyRun, stage: FirstCaseStudyStage, seconds: number): FirstCaseStudyRun {
  active(run);
  check(member(FIRST_CASE_STUDY_STAGES, stage), "Invalid study stage");
  if (run.currentStage === stage) return touchFirstCaseStudyRun(run, seconds);
  return { ...observe(run, "stage", seconds, stage), currentStage: stage };
}
export function recordFirstCaseStudyHelp(run: FirstCaseStudyRun, kind: FirstCaseStudyHelpKind, seconds: number): FirstCaseStudyRun {
  active(run);
  check(member(FIRST_CASE_STUDY_HELP_KINDS, kind), "Invalid help category");
  return { ...observe(run, `help-${kind}`, seconds), helpCounts: { ...run.helpCounts, [kind]: run.helpCounts[kind] + 1 } };
}
export function recordFirstCaseStudyConfusion(run: FirstCaseStudyRun, category: FirstCaseStudyConfusion, seconds: number): FirstCaseStudyRun {
  active(run);
  check(member(FIRST_CASE_STUDY_CONFUSIONS, category), "Invalid confusion category");
  if (run.confusions.includes(category)) return touchFirstCaseStudyRun(run, seconds);
  return { ...observe(run, `confusion-${category}`, seconds), confusions: [...run.confusions, category] };
}
export function rateFirstCaseStudyExplanation(run: FirstCaseStudyRun, ratings: Partial<Pick<FirstCaseStudyRun, "motiveRating" | "methodRating">>): FirstCaseStudyRun {
  const values = record(ratings, ["motiveRating", "methodRating"], "Ratings");
  check(Object.values(values).every((rating) => member(FIRST_CASE_STUDY_RATINGS, rating)), "Invalid explanation rating");
  if ((ratings.motiveRating === undefined || ratings.motiveRating === run.motiveRating) && (ratings.methodRating === undefined || ratings.methodRating === run.methodRating)) return run;
  // Interview ratings can follow completion; they do not extend play time.
  // Replace the previous rating event so repeated edits never evict the terminal observation.
  const withoutPreviousRating = { ...run, events: run.events.filter((event) => event.kind !== "ratings-updated") };
  return { ...observe(withoutPreviousRating, "ratings-updated", run.elapsedSeconds), ...ratings };
}
export function finishFirstCaseStudyRun(run: FirstCaseStudyRun, status: Exclude<FirstCaseStudyStatus, "active">, seconds: number, options?: { acceptedAndReviewed?: boolean }): FirstCaseStudyRun {
  active(run);
  check(status === "completed" || status === "abandoned" || status === "interrupted", "Invalid end status");
  check(status !== "completed" || options?.acceptedAndReviewed === true, "Completion requires moderator confirmation that the theory was accepted and reviewed");
  const next = observe(run, status, seconds);
  check(status !== "completed" || next.elapsedSeconds < FIRST_CASE_STUDY_MAX_PLAY_SECONDS, "Completion must occur before the 30-minute play limit");
  return { ...next, status };
}

export function analyzeFirstCaseStudy(value: unknown) {
  const collection = validateFirstCaseStudyCollection(value);
  const human = collection.runs.filter((run) => run.mode === "human" && run.humanAttested);
  const builds = new Set(human.map((run) => run.buildId));
  check(builds.size <= 1, "Attested human attempts contain different production builds; do not pool them");
  const eligible = human.filter((run) => run.status === "completed" || run.status === "abandoned");
  const seen = new Set<string>();
  for (const run of eligible) {
    check(!seen.has(run.participantId), `Duplicate terminal human participant ${run.participantId}; do not select the better attempt`);
    seen.add(run.participantId);
  }
  const observed = eligible.flatMap((run) => run.firstEffectiveActionSeconds === null ? [] : [run.firstEffectiveActionSeconds]).sort((a, b) => a - b);
  const missing = eligible.length - observed.length;
  const middle = Math.floor(observed.length / 2);
  const median = !observed.length || missing > 0 ? null : observed.length % 2 ? observed[middle] : (observed[middle - 1] + observed[middle]) / 2;
  const ratings = (field: "motiveRating" | "methodRating") => Object.fromEntries(FIRST_CASE_STUDY_RATINGS.map((rating) => [rating, eligible.filter((run) => run[field] === rating).length])) as Record<FirstCaseStudyRating, number>;
  return {
    schema: FIRST_CASE_STUDY_SCHEMA, protocol: FIRST_CASE_STUDY_PROTOCOL, caseLabel: FIRST_CASE_STUDY_CASE_LABEL,
    status: eligible.length === 5 ? "ready-for-review" as const : "insufficient-data" as const,
    buildId: [...builds][0] || null,
    eligibleCount: eligible.length, expectedParticipantCount: 5,
    missingParticipantIds: FIRST_CASE_STUDY_PARTICIPANTS.filter((id) => !seen.has(id)),
    completedCount: eligible.filter((run) => run.status === "completed").length,
    abandonedCount: eligible.filter((run) => run.status === "abandoned").length,
    abandonmentStageCounts: Object.fromEntries(FIRST_CASE_STUDY_STAGES.map((stage) => [stage, eligible.filter((run) => run.status === "abandoned" && run.currentStage === stage).length])) as Record<FirstCaseStudyStage, number>,
    independentCompletedCount: eligible.filter((run) => run.status === "completed" && FIRST_CASE_STUDY_HELP_KINDS.every((kind) => run.helpCounts[kind] === 0)).length,
    helpedParticipantCount: eligible.filter((run) => FIRST_CASE_STUDY_HELP_KINDS.some((kind) => run.helpCounts[kind] > 0)).length,
    bothGroupsCorrectCount: eligible.filter((run) => run.motiveRating === "correct" && run.methodRating === "correct").length,
    interruptedCount: human.filter((run) => run.status === "interrupted").length,
    activeCount: human.filter((run) => run.status === "active").length,
    rehearsalCount: collection.runs.filter((run) => run.mode === "rehearsal").length,
    unattestedHumanCount: collection.runs.filter((run) => run.mode === "human" && !run.humanAttested).length,
    firstActionObservedCount: observed.length, firstActionMissingCount: missing, firstActionMedianSeconds: median,
    helpCounts: Object.fromEntries(FIRST_CASE_STUDY_HELP_KINDS.map((kind) => [kind, eligible.reduce((sum, run) => sum + run.helpCounts[kind], 0)])) as Record<FirstCaseStudyHelpKind, number>,
    confusionCounts: Object.fromEntries(FIRST_CASE_STUDY_CONFUSIONS.map((category) => [category, eligible.filter((run) => run.confusions.includes(category)).length])) as Record<FirstCaseStudyConfusion, number>,
    motiveRatings: ratings("motiveRating"), methodRatings: ratings("methodRating")
  };
}
export type FirstCaseStudyAnalysis = ReturnType<typeof analyzeFirstCaseStudy>;
export function renderFirstCaseStudyReport(analysis: FirstCaseStudyAnalysis): string {
  const denominator = analysis.eligibleCount;
  const share = (count: number) => denominator ? `${count}/${denominator}` : "尚无数据（不计算）";
  const helpLabels: Record<FirstCaseStudyHelpKind, string> = { neutral: "中性提醒", directional: "方向提示", direct: "直接指导", takeover: "接管操作" };
  const confusionLabels: Record<FirstCaseStudyConfusion, string> = { objective: "目标", control: "操作", evidence: "证据", claim: "推理主张", rejection: "驳回反馈", other: "其他" };
  const ratingLabels: Record<FirstCaseStudyRating, string> = { correct: "正确", partial: "部分正确", incorrect: "不正确", "not-assessed": "未评估" };
  const stageLabels: Record<FirstCaseStudyStage, string> = { join: "进入案件", observe: "观察现场", search: "搜证", question: "问话", challenge: "质证", organize: "整理推理", submit: "提交理论", review: "复核最终解答" };
  return [
    "# 首案理解度观察记录", "", `案件：${analysis.caseLabel}`, `协议：${analysis.protocol}`, `构建：${analysis.buildId || "尚无已确认真人记录"}`, "",
    `数据状态：${analysis.status === "insufficient-data" ? "数据不足（insufficient-data）" : "资料齐备，等待评审"}。完整五人数据仅表示可以评审，不自动代表体验通过。`,
    "这些数据由主持手动观察和打点，不是游戏自动遥测；演练不计入真人结果。", "",
    `有效终止真人记录：${denominator}/5；完成：${share(analysis.completedCount)}；放弃：${share(analysis.abandonedCount)}。`,
    `无任何帮助的独立完成：${share(analysis.independentCompletedCount)}。`,
    `接受过帮助：${share(analysis.helpedParticipantCount)}；动机与手法两组解释均正确：${share(analysis.bothGroupsCorrectCount)}。`,
    `技术中断：${analysis.interruptedCount}；进行中：${analysis.activeCount}；演练：${analysis.rehearsalCount}；未确认真人：${analysis.unattestedHumanCount}。`,
    `首次有效行动：已观察 ${analysis.firstActionObservedCount}，缺失 ${analysis.firstActionMissingCount}；中位数 ${analysis.firstActionMedianSeconds === null ? "未计算（无观测或有缺失）" : `${analysis.firstActionMedianSeconds} 秒`}。`,
    `尚缺参与者槽位：${analysis.missingParticipantIds.join("、") || "无"}。`, "",
    "| 指标 | 计数 |", "| --- | ---: |",
    ...FIRST_CASE_STUDY_HELP_KINDS.map((kind) => `| 帮助：${helpLabels[kind]} | ${analysis.helpCounts[kind]} |`),
    ...FIRST_CASE_STUDY_CONFUSIONS.map((kind) => `| 困惑：${confusionLabels[kind]} | ${analysis.confusionCounts[kind]} |`),
    ...FIRST_CASE_STUDY_STAGES.map((stage) => `| 放弃时所在阶段：${stageLabels[stage]} | ${analysis.abandonmentStageCounts[stage]} |`),
    ...FIRST_CASE_STUDY_RATINGS.flatMap((rating) => [`| 动机解释：${ratingLabels[rating]} | ${analysis.motiveRatings[rating]} |`, `| 手法解释：${ratingLabels[rating]} | ${analysis.methodRatings[rating]} |`]),
    "", "分母保留放弃的有效真人尝试；中断单列，同一参与者多个有效终止尝试必须先解决记录冲突。五人观察用于发现问题，不能据此宣称统计显著或代表全部玩家。", ""
  ].join("\n");
}
