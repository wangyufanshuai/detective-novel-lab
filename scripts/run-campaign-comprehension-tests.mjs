import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const sourcePath = path.join(root, "lib", "campaign-comprehension-study.ts");
const runtimeDir = path.join(root, "outputs", "campaign-comprehension-test-runtime");
const runtimePath = path.join(runtimeDir, "campaign-comprehension-study.cjs");

await fs.mkdir(runtimeDir, { recursive: true });
const source = await fs.readFile(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText;
await fs.writeFile(runtimePath, compiled, "utf8");
const study = await import(pathToFileURL(runtimePath).href);

let collection = study.createCampaignStudyCollection();
const started = study.startCampaignStudyRun(collection, {
  cohort: "mystery-first",
  protocol: "official",
  scenario: "recovery-probe",
  initialStage: "case-extraction"
});
collection = started.collection;
let run = started.run;
assert.equal(run.ordinal, 1, "first run receives a local ordinal only");
assert.equal(run.status, "active", "new study run is active");

run = study.recordCampaignStudyMeaningfulAction(run, 4.4);
run = study.recordCampaignStudyMeaningfulAction(run, 9);
assert.equal(run.firstMeaningfulActionSeconds, 4, "first meaningful action uses integer relative seconds and is idempotent");
run = study.advanceCampaignStudyStage(run, "join", 10);
run = study.advanceCampaignStudyStage(run, "join", 18);
assert.deepEqual(run.stageDurations["case-extraction"], { count: 1, totalSeconds: 10, maxSeconds: 10 }, "stage transition records one aggregate duration only");

run = study.startCampaignStudyWorldChoice(run, "world-lead", 20);
run = study.startCampaignStudyWorldChoice(run, "world-lead", 22);
run = study.completeCampaignStudyWorldChoice(run, "world-lead", 29);
assert.deepEqual(run.worldChoiceDurations["world-lead"], { count: 1, totalSeconds: 9, maxSeconds: 9 }, "world choice timer ignores duplicate readiness and stores no selected choice");

run = study.observeCampaignStudyRecovery(run, true, 30);
run = study.observeCampaignStudyRecovery(run, true, 31);
run = study.startCampaignStudyWorldChoice(run, "campaign-recovery", 30);
run = study.recordCampaignStudyRecoveryStarted(run, 34);
assert.equal(run.recoveryShownCount, 1, "recovery readiness counts once per open transition");
assert.equal(run.recoveryStartedCount, 1, "recovery start is aggregated without a source binding");

run = study.recordCampaignStudyAssistance(run, "guided-step", 35);
run = study.recordCampaignStudyAssistance(run, "explicit-fallback", 36);
assert.equal(run.guidedStepUseCount, 1, "guided assistance is counted");
assert.equal(run.explicitFallbackUseCount, 1, "explicit fallback is counted");

run = study.markCampaignStudyCompleted(run, 100);
assert.equal(run.status, "awaiting-assessment", "campaign completion waits for moderator assessment");
assert.equal(study.finalizeCampaignStudyRun(run), undefined, "unassessed run cannot finalize");
run = study.updateCampaignStudyAssessment(run, {
  primaryActionMisunderstandingCount: 1,
  confusionCategories: ["world-choice", "world-choice"],
  recoveryPrompted: false,
  finaleExplanation: "correct",
  replayIntent: "different-route"
});
run = study.finalizeCampaignStudyRun(run);
assert.equal(run.status, "completed", "assessed campaign run finalizes");
assert.deepEqual(run.assessment.confusionCategories, ["world-choice"], "fixed confusion categories deduplicate");
collection = study.updateCampaignStudyRun(collection, 1, () => run);

const interruptedStart = study.startCampaignStudyRun(collection, {
  cohort: "systems-first",
  protocol: "pilot",
  scenario: "standard",
  initialStage: "opening"
});
const interrupted = study.interruptActiveCampaignStudyRuns(interruptedStart.collection);
assert.equal(interrupted.runs.find((item) => item.ordinal === interruptedStart.run.ordinal).status, "interrupted", "reload marks an active run interrupted without reconstructing time");

let bounded = study.createCampaignStudyCollection();
for (let index = 0; index < 20; index += 1) {
  bounded = study.startCampaignStudyRun(bounded, {
    cohort: index % 2 ? "mystery-first" : "systems-first",
    protocol: index < 7 ? "official" : "pilot",
    scenario: "standard",
    initialStage: "opening"
  }).collection;
}
assert.equal(bounded.runs.length, 16, "study history is bounded to 16 runs");
assert.equal(bounded.runs.filter((item) => item.protocol === "official").length, 7, "official runs are retained before pilot runs");
assert.deepEqual(bounded.runs.filter((item) => item.protocol === "pilot").map((item) => item.ordinal), [12, 13, 14, 15, 16, 17, 18, 19, 20], "latest pilots fill only remaining slots");

const normalized = study.normalizeCampaignStudyCollection({
  formatVersion: 99,
  nextOrdinal: -4,
  runs: [{ cohort: "invalid", status: "active" }, ...bounded.runs]
});
assert.equal(normalized.formatVersion, 1, "storage normalization pins the supported format");
assert.equal(normalized.runs.length, 16, "invalid storage rows are discarded without exceeding the cap");

const exported = study.toCampaignStudyExport(collection);
const exportText = JSON.stringify(exported);
assert.equal(exportText.includes("measurement"), false, "export strips in-progress timing anchors");
assert.equal(/worldId|caseId|sessionId|npcId|locationId|sourceId|eventId|seed|timestamp|startedAt|updatedAt|selectedChoice|playerName|rawBody|\btruth\b|[A-Za-z]:[\\/]/i.test(exportText), false, "export contains no identity, source, wall-clock, choice, body, truth, or absolute-path fields");
assert.equal(exported.runs[0].firstMeaningfulActionSeconds, 4, "export retains only safe per-run aggregates");

let operationsCollection = study.createCampaignStudyCollection();
let operations = study.getCampaignStudyOperationsState(operationsCollection);
assert.equal(operations.status, "ready", "an empty study collection is ready");
assert.equal(operations.nextSlot.id, "P1", "the first fixed slot is P1");
assert.equal(study.canStartCampaignStudySlot(operationsCollection, operations.nextSlot), true, "the exact next slot is startable");
assert.equal(study.canStartCampaignStudySlot(operationsCollection, { protocol: "official", cohort: "mystery-first", scenario: "standard" }), false, "official work cannot start before both pilots");

let guarded = study.startNextCampaignStudyRun(operationsCollection, "opening");
let guardedRun = study.abandonCampaignStudyRun(guarded.run, 90);
operationsCollection = study.updateCampaignStudyRun(guarded.collection, guarded.run.ordinal, () => guardedRun);
assert.equal(study.getCampaignStudyOperationsState(operationsCollection).nextSlot.id, "P1", "an abandoned pilot does not consume its slot");

guarded = study.startNextCampaignStudyRun(operationsCollection, "opening");
guardedRun = study.interruptCampaignStudyRun(guarded.run);
operationsCollection = study.updateCampaignStudyRun(guarded.collection, guarded.run.ordinal, () => guardedRun);
assert.equal(study.getCampaignStudyOperationsState(operationsCollection).nextSlot.id, "P1", "an interrupted pilot repeats the same slot");

function completeGuardedRun(started, elapsed = 120) {
  let completed = study.markCampaignStudyCompleted(started.run, elapsed);
  completed = study.updateCampaignStudyAssessment(completed, { finaleExplanation: "correct", replayIntent: "different-route" });
  return study.finalizeCampaignStudyRun(completed);
}

guarded = study.startNextCampaignStudyRun(operationsCollection, "opening");
operationsCollection = study.updateCampaignStudyRun(guarded.collection, guarded.run.ordinal, () => completeGuardedRun(guarded));
assert.equal(study.getCampaignStudyOperationsState(operationsCollection).nextSlot.id, "P2", "completed P1 advances to P2");
guarded = study.startNextCampaignStudyRun(operationsCollection, "opening");
operationsCollection = study.updateCampaignStudyRun(guarded.collection, guarded.run.ordinal, () => completeGuardedRun(guarded));
assert.equal(study.getCampaignStudyOperationsState(operationsCollection).nextSlot.id, "O1", "official slots unlock only after both pilots complete");

guarded = study.startNextCampaignStudyRun(operationsCollection, "opening");
guardedRun = study.abandonCampaignStudyRun(guarded.run, 5400);
operationsCollection = study.updateCampaignStudyRun(guarded.collection, guarded.run.ordinal, () => guardedRun);
assert.equal(study.getCampaignStudyOperationsState(operationsCollection).nextSlot.id, "O2", "an abandoned official attempt stays eligible and advances");
guarded = study.startNextCampaignStudyRun(operationsCollection, "opening");
guardedRun = study.interruptCampaignStudyRun(guarded.run);
operationsCollection = study.updateCampaignStudyRun(guarded.collection, guarded.run.ordinal, () => guardedRun);
assert.equal(study.getCampaignStudyOperationsState(operationsCollection).nextSlot.id, "O2", "an interrupted official attempt requires the same slot again");

while (study.getCampaignStudyOperationsState(operationsCollection).status === "ready") {
  guarded = study.startNextCampaignStudyRun(operationsCollection, "opening");
  operationsCollection = study.updateCampaignStudyRun(guarded.collection, guarded.run.ordinal, () => completeGuardedRun(guarded));
}
assert.equal(study.getCampaignStudyOperationsState(operationsCollection).status, "complete", "the guard closes after all ten fixed slots are consumed");
assert.equal(study.startNextCampaignStudyRun(operationsCollection, "opening"), undefined, "completed operations cannot overfill the matrix");

const invalidLegacy = study.startCampaignStudyRun(study.createCampaignStudyCollection(), {
  cohort: "mystery-first",
  protocol: "official",
  scenario: "standard",
  initialStage: "opening"
}).collection;
assert.equal(study.getCampaignStudyOperationsState(invalidLegacy).status, "invalid", "out-of-order legacy state is locked instead of guessed");

const matrix = [
  ["mystery-first", "standard"],
  ["systems-first", "recovery-probe"],
  ["systems-first", "standard"],
  ["mystery-first", "recovery-probe"],
  ["mystery-first", "recovery-probe"],
  ["systems-first", "standard"],
  ["systems-first", "recovery-probe"],
  ["mystery-first", "standard"]
];
const confusionByRun = [
  ["current-objective"],
  ["recovery"],
  ["replay"],
  ["current-objective"],
  ["recovery"],
  ["replay"],
  [],
  []
];
const gateRuns = matrix.map(([cohort, scenario], index) => ({
  ...exported.runs[0],
  ordinal: index + 1,
  cohort,
  protocol: "official",
  scenario,
  status: index === 7 ? "abandoned" : "completed",
  currentStage: index === 7 ? "world-choice" : "debrief",
  elapsedSeconds: 1200 + index * 60,
  firstMeaningfulActionSeconds: 40 + index,
  recoveryShownCount: scenario === "recovery-probe" ? 1 : 0,
  recoveryStartedCount: scenario === "recovery-probe" ? 1 : 0,
  guidedStepUseCount: index % 2,
  explicitFallbackUseCount: index % 3 === 0 ? 1 : 0,
  campaignCompleted: index !== 7,
  abandonmentStage: index === 7 ? "world-choice" : undefined,
  assessment: {
    primaryActionMisunderstandingCount: index === 6 ? 1 : 0,
    confusionCategories: confusionByRun[index],
    recoveryPrompted: false,
    finaleExplanation: index === 7 ? "not-assessed" : "correct",
    replayIntent: index === 7 ? "not-assessed" : "different-route"
  }
}));
const gateExport = { formatVersion: 1, runs: gateRuns };
const passingGate = study.analyzeCampaignStudyGate(gateExport);
assert.equal(passingGate.sampleReady, true, "exact 2 x 2 official matrix is ready for analysis");
assert.equal(passingGate.officialOrderValid, true, "the fixed O1 through O8 order is part of sample readiness");
assert.equal(passingGate.eligibleOfficialCount, 8, "completed and abandoned official attempts share the eligible denominator");
assert.equal(passingGate.humanGatePassed, true, "one abandoned attempt can still pass the fixed aggregate thresholds");
assert.deepEqual(passingGate.topConfusions, ["current-objective", "recovery", "replay"], "confusion ties follow the fixed protocol order");

const insufficientGate = study.analyzeCampaignStudyGate({ formatVersion: 1, runs: gateRuns.slice(0, 7) });
assert.equal(insufficientGate.status, "insufficient-data", "seven eligible attempts cannot produce a gate verdict");
const imbalancedGate = study.analyzeCampaignStudyGate({
  formatVersion: 1,
  runs: gateRuns.map((item, index) => index === 7 ? { ...item, cohort: "systems-first" } : item)
});
assert.equal(imbalancedGate.sampleReady, false, "eight attempts with an invalid cohort/scenario matrix remain pending");
const reorderedRuns = gateRuns.map((item, index) => index === 0
  ? { ...item, cohort: gateRuns[1].cohort, scenario: gateRuns[1].scenario }
  : index === 1
    ? { ...item, cohort: gateRuns[0].cohort, scenario: gateRuns[0].scenario }
    : item);
const reorderedGate = study.analyzeCampaignStudyGate({ formatVersion: 1, runs: reorderedRuns });
assert.equal(reorderedGate.officialOrderValid, false, "the same 2 x 2 totals in the wrong order remain invalid");
assert.equal(reorderedGate.status, "insufficient-data", "wrong official order cannot produce a gate verdict");

const failedGate = study.analyzeCampaignStudyGate({
  formatVersion: 1,
  runs: gateRuns.map((item, index) => index === 6 ? {
    ...item,
    status: "abandoned",
    campaignCompleted: false,
    abandonmentStage: "recovery",
    assessment: { ...item.assessment, finaleExplanation: "not-assessed", replayIntent: "not-assessed" }
  } : item)
});
assert.equal(failedGate.status, "human-gate-failed", "eligible abandonments stay in the denominator and can fail the gate");
assert.equal(failedGate.metrics.finaleExplanation.passed, false, "unassessed abandoned attempts are not correct Finale explanations");

const missingActionGate = study.analyzeCampaignStudyGate({
  formatVersion: 1,
  runs: gateRuns.map((item, index) => index < 5 ? { ...item, firstMeaningfulActionSeconds: undefined } : item)
});
assert.equal(missingActionGate.metrics.firstMeaningfulAction.passed, false, "missing first actions count as infinite in the median");
const report = study.renderCampaignStudyGateReport(passingGate);
assert.equal(/\b(?:ordinal|worldId|caseId|sessionId|npcId|locationId|sourceId|eventId|seed|selectedAnswer|playerText|rawBody|hiddenTruth)\b|[A-Za-z]:[\\/]/i.test(report), false, "aggregate report contains no per-run or internal identifiers");
assert.equal(report.includes("human gate passed"), true, "report exposes the aggregate gate verdict");
assert.equal(report.includes("run 1"), false, "report contains no per-attempt row");
const cliInputPath = path.join(runtimeDir, "safe-gate-export.json");
const cliReportPath = path.join(runtimeDir, "safe-gate-report.md");
await fs.writeFile(cliInputPath, JSON.stringify(gateExport), "utf8");
const cliResult = JSON.parse(execFileSync(process.execPath, [
  path.join(root, "scripts", "analyze-campaign-comprehension-study.mjs"),
  `--input=${cliInputPath}`,
  `--output=${cliReportPath}`
], { cwd: root, encoding: "utf8" }));
assert.equal(cliResult.humanGatePassed, true, "CLI analyzer emits the pure aggregate verdict");
assert.equal((await fs.readFile(cliReportPath, "utf8")).includes("human gate passed"), true, "CLI writes the aggregate-only report outside public artifacts");
const invalidCliInputPath = path.join(runtimeDir, "wrong-order-gate-export.json");
const invalidCliReportPath = path.join(runtimeDir, "wrong-order-gate-report.md");
await fs.writeFile(invalidCliInputPath, JSON.stringify({ formatVersion: 1, runs: reorderedRuns }), "utf8");
assert.throws(() => execFileSync(process.execPath, [
  path.join(root, "scripts", "analyze-campaign-comprehension-study.mjs"),
  `--input=${invalidCliInputPath}`,
  `--output=${invalidCliReportPath}`
], { cwd: root, encoding: "utf8", stdio: "pipe" }), "CLI refuses to write a report for the right totals in the wrong order");

console.log(JSON.stringify({
  ok: true,
  tests: {
    lifecycle: true,
    timing: true,
    idempotence: true,
    boundedStorage: true,
    interruption: true,
    privacy: true,
    operationsGuard: true,
    fixedSlotOrder: true,
    gateAnalysis: true,
    aggregateReport: true,
    analyzerCli: true
  }
}));
