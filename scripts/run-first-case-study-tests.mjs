import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "first-case-study-tests-"));
const runtimePath = path.join(runtime, "model.cjs");
fs.writeFileSync(runtimePath, ts.transpileModule(fs.readFileSync(new URL("../lib/first-case-study.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
const model = createRequire(import.meta.url)(runtimePath);
const checks = [];
function check(name, test) { test(); checks.push(name); console.log(`PASS ${name}`); }
function human(id = "P01", collection = model.createFirstCaseStudyCollection()) {
  return model.startFirstCaseStudyRun(collection, { mode: "human", participantId: id, buildId: "frozen-build-1", humanAttested: true });
}
function finish(collection, run, status = "completed") {
  return model.updateFirstCaseStudyRun(collection, run.attemptId, () => model.finishFirstCaseStudyRun(run, status, 100, { acceptedAndReviewed: true }));
}

check("empty and rehearsal data cannot become human results", () => {
  assert.equal(model.analyzeFirstCaseStudy(model.createFirstCaseStudyCollection()).status, "insufficient-data");
  const started = model.startFirstCaseStudyRun(model.createFirstCaseStudyCollection(), { mode: "rehearsal", participantId: "R01", buildId: "test-build", humanAttested: false });
  const analysis = model.analyzeFirstCaseStudy(finish(started.collection, started.run));
  assert.equal(analysis.eligibleCount, 0);
  assert.equal(analysis.rehearsalCount, 1);
  assert.equal(analysis.firstActionMedianSeconds, null);
  assert.doesNotMatch(model.renderFirstCaseStudyReport(analysis), /human-pass|human-gate-passed/);
  assert.doesNotMatch(model.renderFirstCaseStudyReport(analysis), /0\/0/);
  assert.match(model.renderFirstCaseStudyReport(analysis), /尚无数据（不计算）/);
  assert.match(model.renderFirstCaseStudyReport(analysis), /中性提醒/);
});
check("manual first action is nullable, monotonic and recorded once", () => {
  let { collection, run } = human();
  assert.equal(run.firstEffectiveActionSeconds, null);
  run = model.markFirstEffectiveAction(run, 12.9);
  run = model.markFirstEffectiveAction(run, 40);
  run = model.setFirstCaseStudyStage(run, "search", 25);
  assert.equal(run.firstEffectiveActionSeconds, 12);
  assert.equal(run.elapsedSeconds, 40);
  assert.equal(run.events.filter((event) => event.kind === "first-effective-action").length, 1);
  assert.equal(model.analyzeFirstCaseStudy(finish(collection, run)).firstActionMedianSeconds, 12);
});
check("completed requires accepted-and-reviewed confirmation and terminal play cannot continue", () => {
  const { run } = human();
  assert.throws(() => model.finishFirstCaseStudyRun(run, "completed", 30), /confirmation/);
  const ended = model.finishFirstCaseStudyRun(run, "completed", 30, { acceptedAndReviewed: true });
  assert.throws(() => model.recordFirstCaseStudyHelp(ended, "direct", 31), /already ended/);
  assert.throws(() => model.finishFirstCaseStudyRun(ended, "abandoned", 31), /already ended/);
  const rated = model.rateFirstCaseStudyExplanation(ended, { motiveRating: "correct" });
  assert.equal(rated.elapsedSeconds, 30);
  assert.equal(rated.motiveRating, "correct");
  assert.strictEqual(model.rateFirstCaseStudyExplanation(rated, { motiveRating: "correct" }), rated);
});
check("five participants keep abandonment in denominator and any help defeats independence", () => {
  let collection = model.createFirstCaseStudyCollection();
  for (const [index, id] of model.FIRST_CASE_STUDY_PARTICIPANTS.entries()) {
    let started = human(id, collection);
    let run = model.markFirstEffectiveAction(started.run, 10 * (index + 1));
    if (index === 1) run = model.recordFirstCaseStudyHelp(run, "neutral", 50);
    if (index === 4) run = model.setFirstCaseStudyStage(run, "organize", 70);
    run = model.rateFirstCaseStudyExplanation(run, { motiveRating: "correct", methodRating: index === 4 ? "incorrect" : "correct" });
    collection = finish(started.collection, run, index === 4 ? "abandoned" : "completed");
  }
  const analysis = model.analyzeFirstCaseStudy(collection);
  assert.equal(analysis.status, "ready-for-review");
  assert.equal(analysis.eligibleCount, 5);
  assert.equal(analysis.completedCount, 4);
  assert.equal(analysis.abandonedCount, 1);
  assert.equal(analysis.independentCompletedCount, 3);
  assert.equal(analysis.helpedParticipantCount, 1);
  assert.equal(analysis.bothGroupsCorrectCount, 4);
  assert.equal(analysis.abandonmentStageCounts.organize, 1);
  assert.equal(analysis.abandonmentStageCounts.join, 0);
  assert.equal(analysis.firstActionMedianSeconds, 30);
});
check("completion must precede the play-time cap in live actions and imported records", () => {
  const { collection, run } = human();
  assert.equal(model.FIRST_CASE_STUDY_MAX_PLAY_SECONDS, 1800);
  assert.equal(model.finishFirstCaseStudyRun(run, "completed", 1799.9, { acceptedAndReviewed: true }).status, "completed");
  for (const seconds of [1800, 1801]) {
    assert.throws(() => model.finishFirstCaseStudyRun(run, "completed", seconds, { acceptedAndReviewed: true }), /30-minute play limit/);
  }
  const alreadyLate = model.touchFirstCaseStudyRun(run, 1801);
  assert.throws(() => model.finishFirstCaseStudyRun(alreadyLate, "completed", 10, { acceptedAndReviewed: true }), /30-minute play limit/);
  const lateImport = finish(collection, run);
  lateImport.runs[0].elapsedSeconds = 1800;
  assert.throws(() => model.validateFirstCaseStudyCollection(lateImport), /30-minute play limit/);
  const timedOut = model.updateFirstCaseStudyRun(collection, run.attemptId, () => model.finishFirstCaseStudyRun(run, "abandoned", 1800));
  assert.equal(model.analyzeFirstCaseStudy(timedOut).abandonedCount, 1);
  assert.equal(model.analyzeFirstCaseStudy(timedOut).independentCompletedCount, 0);
});
check("missing first action is not zero and suppresses a misleading complete-sample median", () => {
  const first = human();
  let collection = finish(first.collection, first.run, "abandoned");
  const second = human("P02", collection);
  collection = finish(second.collection, model.markFirstEffectiveAction(second.run, 8));
  const analysis = model.analyzeFirstCaseStudy(collection);
  assert.equal(analysis.firstActionMissingCount, 1);
  assert.equal(analysis.firstActionObservedCount, 1);
  assert.equal(analysis.firstActionMedianSeconds, null);
});
check("interruptions can be replaced but two terminal outcomes for one participant are rejected", () => {
  const first = human();
  const interrupted = finish(first.collection, first.run, "interrupted");
  const replacement = human("P01", interrupted);
  const valid = finish(replacement.collection, replacement.run);
  assert.equal(model.analyzeFirstCaseStudy(valid).eligibleCount, 1);
  assert.equal(model.analyzeFirstCaseStudy(valid).interruptedCount, 1);
  assert.notEqual(first.run.attemptId, replacement.run.attemptId);
  assert.throws(() => human("P01", valid), /already has a terminal outcome/);
  const duplicate = structuredClone(valid);
  duplicate.runs.push({ ...structuredClone(duplicate.runs[1]), attemptId: "A000003" });
  duplicate.lastAttemptNumber = 3;
  assert.throws(() => model.analyzeFirstCaseStudy(duplicate), /Duplicate terminal human/);
});
check("human builds cannot be pooled and unattested human records are excluded", () => {
  const first = human();
  const completed = finish(first.collection, first.run);
  assert.throws(() => model.startFirstCaseStudyRun(completed, { mode: "human", participantId: "P02", buildId: "different-build", humanAttested: true }), /different production builds/);
  const mismatched = structuredClone(completed);
  mismatched.runs.push({ ...structuredClone(mismatched.runs[0]), participantId: "P02", attemptId: "A000002", buildId: "different-build" });
  mismatched.lastAttemptNumber = 2;
  assert.throws(() => model.analyzeFirstCaseStudy(mismatched), /different production builds/);
  assert.throws(() => model.startFirstCaseStudyRun(model.createFirstCaseStudyCollection(), { mode: "human", participantId: "P01", buildId: "build", humanAttested: false }), /real human participant/);
  const unattested = structuredClone(completed);
  unattested.runs[0].humanAttested = false;
  assert.equal(model.analyzeFirstCaseStudy(unattested).eligibleCount, 0);
});
check("event limit preserves full help counters and valid terminal events", () => {
  let { collection, run } = human();
  for (let index = 1; index <= 240; index += 1) run = model.recordFirstCaseStudyHelp(run, "neutral", index);
  run = model.finishFirstCaseStudyRun(run, "abandoned", 245);
  for (let index = 0; index < 250; index += 1) run = model.rateFirstCaseStudyExplanation(run, { motiveRating: index % 2 ? "correct" : "partial" });
  collection = model.updateFirstCaseStudyRun(collection, run.attemptId, () => run);
  assert.equal(run.events.length, 200);
  assert.equal(run.helpCounts.neutral, 240);
  assert.equal(run.events.filter((event) => event.kind === "abandoned").length, 1);
  assert.equal(run.events.filter((event) => event.kind === "ratings-updated").length, 1);
  assert.equal(model.validateFirstCaseStudyCollection(collection).runs[0].status, "abandoned");
});
check("strict import rejects text, unsafe identities, malformed counts and inconsistent outcomes", () => {
  const { collection } = human();
  for (const change of [
    (run) => { run.answerText = "private answer"; },
    (run) => { run.participantId = "Person Name"; },
    (run) => { run.helpCounts.direct = -1; },
    (run) => { run.events[0].seconds = 4; },
    (run) => { run.events[0].kind = "raw question"; },
    (run) => { run.status = "completed"; },
    (run) => { run.buildId = "../private-path"; },
    (run) => { run.confusions = ["objective", "objective"]; }
  ]) {
    const malformed = structuredClone(collection);
    change(malformed.runs[0]);
    assert.throws(() => model.validateFirstCaseStudyCollection(malformed));
  }
  assert.throws(() => model.updateFirstCaseStudyRun(collection, "A000001", (run) => ({ ...run, humanAttested: false })), /cannot change/);
  assert.throws(() => model.updateFirstCaseStudyRun(collection, "A000001", (run) => { run.humanAttested = false; return run; }), /cannot change/);
  const twoActive = structuredClone(collection);
  twoActive.runs.push({ ...structuredClone(twoActive.runs[0]), participantId: "P02", attemptId: "A000002" });
  assert.throws(() => model.validateFirstCaseStudyCollection(twoActive), /Only one observation/);
});
check("backup recovery validates first, keeps rehearsal separation and interrupts saved timers", () => {
  const source = human();
  const backup = model.updateFirstCaseStudyRun(source.collection, source.run.attemptId, (run) => model.recordFirstCaseStudyHelp(run, "neutral", 24));
  const before = structuredClone(backup);
  const preview = model.prepareFirstCaseStudyRestore(backup, "frozen-build-1");
  assert.deepEqual(backup, before, "preview must not mutate its input");
  assert.equal(preview.runs[0].status, "interrupted");
  assert.equal(preview.runs[0].elapsedSeconds, 24);
  assert.equal(preview.runs[0].helpCounts.neutral, 1);
  assert.equal(model.analyzeFirstCaseStudy(preview).eligibleCount, 0);
  assert.equal(model.analyzeFirstCaseStudy(preview).interruptedCount, 1);
  assert.deepEqual(model.restoreFirstCaseStudyCollection(model.createFirstCaseStudyCollection(), preview, "frozen-build-1"), preview);
  assert.throws(() => model.restoreFirstCaseStudyCollection(source.collection, preview, "frozen-build-1"), /active observation/);
  assert.throws(() => model.prepareFirstCaseStudyRestore(backup, "other-build"), /current frozen build/);
  const invalid = structuredClone(backup);
  invalid.runs[0].participantName = "private";
  assert.throws(() => model.prepareFirstCaseStudyRestore(invalid, "frozen-build-1"), /unsupported fields/);
  const duplicate = finish(source.collection, source.run);
  duplicate.runs.push({ ...structuredClone(duplicate.runs[0]), attemptId: "A000002" });
  duplicate.lastAttemptNumber = 2;
  assert.throws(() => model.prepareFirstCaseStudyRestore(duplicate, "frozen-build-1"), /Duplicate terminal human/);
  const rehearsal = model.startFirstCaseStudyRun(model.createFirstCaseStudyCollection(), { mode: "rehearsal", participantId: "R01", buildId: "older-build", humanAttested: false });
  const oldRehearsal = model.prepareFirstCaseStudyRestore(rehearsal.collection, "newer-build");
  assert.equal(model.analyzeFirstCaseStudy(oldRehearsal).rehearsalCount, 1);
  assert.equal(model.analyzeFirstCaseStudy(oldRehearsal).eligibleCount, 0);
});
check("withdrawal identifies one person by P slot and attempt, preserving their replacement and other failures", () => {
  const first = human();
  let collection = finish(first.collection, first.run, "interrupted");
  const replacement = human("P01", collection);
  collection = finish(replacement.collection, replacement.run, "abandoned");
  const other = human("P02", collection);
  collection = finish(other.collection, other.run, "abandoned");
  const rehearsal = model.startFirstCaseStudyRun(collection, { mode: "rehearsal", participantId: "R01", buildId: "test-build", humanAttested: false });
  collection = finish(rehearsal.collection, rehearsal.run);
  const before = structuredClone(collection);
  assert.throws(() => model.withdrawFirstCaseStudyParticipant(collection, "P01", first.run.attemptId, "P01"), /exact participant\/attempt ID pair/);
  assert.throws(() => model.withdrawFirstCaseStudyParticipant(collection, "P01", first.run.attemptId, `P01/${replacement.run.attemptId}`), /exact participant\/attempt ID pair/);
  assert.throws(() => model.withdrawFirstCaseStudyParticipant(collection, "R01", rehearsal.run.attemptId, `R01/${rehearsal.run.attemptId}`), /exact participant\/attempt ID pair/);
  assert.throws(() => model.withdrawFirstCaseStudyParticipant(collection, "P01", rehearsal.run.attemptId, `P01/${rehearsal.run.attemptId}`), /No human record/);
  assert.throws(() => model.withdrawFirstCaseStudyParticipant(collection, "P02", first.run.attemptId, `P02/${first.run.attemptId}`), /No human record/);
  assert.throws(() => model.withdrawFirstCaseStudyParticipant(first.collection, "P01", first.run.attemptId, `P01/${first.run.attemptId}`), /active observation/);
  const withoutOriginal = model.withdrawFirstCaseStudyParticipant(collection, "P01", first.run.attemptId, `P01/${first.run.attemptId}`);
  assert.deepEqual(withoutOriginal.runs, before.runs.filter((run) => run.attemptId !== first.run.attemptId));
  assert.equal(model.analyzeFirstCaseStudy(withoutOriginal).abandonedCount, 2, "the replacement's failure still belongs in the denominator");
  assert.equal(model.analyzeFirstCaseStudy(withoutOriginal).interruptedCount, 0);
  assert.throws(() => human("P01", withoutOriginal), /already has a terminal outcome/);
  const remaining = model.withdrawFirstCaseStudyParticipant(collection, "P01", replacement.run.attemptId, `P01/${replacement.run.attemptId}`);
  assert.deepEqual(collection, before, "withdrawal must not mutate its input");
  assert.deepEqual(remaining.runs, before.runs.filter((run) => run.attemptId !== replacement.run.attemptId));
  assert.equal(model.analyzeFirstCaseStudy(remaining).interruptedCount, 1, "the earlier person's interruption must remain");
  assert.equal(model.analyzeFirstCaseStudy(remaining).abandonedCount, 1);
  assert.equal(model.analyzeFirstCaseStudy(remaining).rehearsalCount, 1);
  assert.equal(human("P01", remaining).run.attemptId, "A000005");
  const activeOther = human("P03", remaining);
  assert.throws(() => model.withdrawFirstCaseStudyParticipant(activeOther.collection, "P01", first.run.attemptId, `P01/${first.run.attemptId}`), /active observation/);
});
check("withdrawing the highest or only attempt never reissues that person's identity", () => {
  const first = human();
  const completed = finish(first.collection, first.run);
  const empty = model.withdrawFirstCaseStudyParticipant(completed, "P01", first.run.attemptId, `P01/${first.run.attemptId}`);
  assert.equal(empty.runs.length, 0);
  assert.equal(empty.lastAttemptNumber, 1);
  const replacement = human("P01", JSON.parse(JSON.stringify(empty)));
  assert.equal(replacement.run.attemptId, "A000002");
  assert.equal(replacement.collection.lastAttemptNumber, 2);
  const endedReplacement = finish(replacement.collection, replacement.run, "abandoned");
  assert.throws(() => model.withdrawFirstCaseStudyParticipant(endedReplacement, "P01", first.run.attemptId, `P01/${first.run.attemptId}`), /No human record/);
  assert.equal(model.analyzeFirstCaseStudy(endedReplacement).abandonedCount, 1);
});
check("legacy imports migrate their allocation floor and reject counters that can reuse retained identities", () => {
  const first = human();
  const legacy = finish(first.collection, first.run, "interrupted");
  delete legacy.lastAttemptNumber;
  const normalized = model.validateFirstCaseStudyCollection(legacy);
  assert.equal(normalized.lastAttemptNumber, 1);
  assert.equal(Object.hasOwn(legacy, "lastAttemptNumber"), false, "migration must not mutate the original export");
  assert.equal(human("P01", legacy).run.attemptId, "A000002");
  const legacyEmpty = { schema: model.FIRST_CASE_STUDY_SCHEMA, protocol: model.FIRST_CASE_STUDY_PROTOCOL, runs: [] };
  assert.deepEqual(model.validateFirstCaseStudyCollection(legacyEmpty), model.createFirstCaseStudyCollection());
  for (const lastAttemptNumber of [-1, 0, 1.5, 1000000, "2", null, undefined]) {
    assert.throws(() => model.validateFirstCaseStudyCollection({ ...legacy, lastAttemptNumber }), /Attempt allocation counter/);
  }
  const capacity = { ...model.createFirstCaseStudyCollection(), lastAttemptNumber: 999999 };
  assert.equal(model.validateFirstCaseStudyCollection(capacity).lastAttemptNumber, 999999);
  assert.throws(() => human("P01", capacity), /capacity reached/);
});
check("restoring older or empty backups cannot lower the current allocation floor", () => {
  const first = human();
  const olderBackup = finish(first.collection, first.run);
  const second = human("P02", olderBackup);
  const current = model.withdrawFirstCaseStudyParticipant(finish(second.collection, second.run), "P02", second.run.attemptId, `P02/${second.run.attemptId}`);
  for (const backup of [olderBackup, { schema: model.FIRST_CASE_STUDY_SCHEMA, protocol: model.FIRST_CASE_STUDY_PROTOCOL, runs: olderBackup.runs }]) {
    const restored = model.restoreFirstCaseStudyCollection(current, backup, "frozen-build-1");
    assert.deepEqual(restored.runs, olderBackup.runs);
    assert.equal(restored.lastAttemptNumber, 2);
    assert.equal(human("P02", restored).run.attemptId, "A000003");
  }
  const blankLegacyBackup = { schema: model.FIRST_CASE_STUDY_SCHEMA, protocol: model.FIRST_CASE_STUDY_PROTOCOL, runs: [] };
  const restoredEmpty = model.restoreFirstCaseStudyCollection(current, blankLegacyBackup, "frozen-build-1");
  assert.equal(restoredEmpty.lastAttemptNumber, 2);
  assert.equal(human("P01", restoredEmpty).run.attemptId, "A000003");
  const newerBackup = { ...blankLegacyBackup, lastAttemptNumber: 9 };
  assert.equal(human("P01", model.restoreFirstCaseStudyCollection(current, newerBackup, "frozen-build-1")).run.attemptId, "A000010");
});
check("new rounds require archive acknowledgement and exact confirmation, never reset a live run", () => {
  const started = human();
  const oldRound = finish(started.collection, started.run, "abandoned");
  const before = structuredClone(oldRound);
  assert.throws(() => model.resetFirstCaseStudyCollection(oldRound, false, "开始新轮"), /archive/);
  assert.throws(() => model.resetFirstCaseStudyCollection(oldRound, true, "reset"), /archive/);
  assert.throws(() => model.resetFirstCaseStudyCollection(started.collection, true, "开始新轮"), /active observation/);
  const empty = model.resetFirstCaseStudyCollection(oldRound, true, "开始新轮");
  assert.deepEqual(empty, { ...model.createFirstCaseStudyCollection(), lastAttemptNumber: oldRound.lastAttemptNumber });
  assert.deepEqual(oldRound, before);
  assert.equal(model.analyzeFirstCaseStudy(oldRound).abandonedCount, 1);
  assert.equal(model.analyzeFirstCaseStudy(empty).eligibleCount, 0);
  assert.equal(human("P01", empty).run.attemptId, "A000002", "a new round must not reissue a previously handed-out pair");
});
check("analysis CLI validates before writing and supports honest empty reports", () => {
  const input = path.join(runtime, "input.json");
  const output = path.join(runtime, "report.md");
  const cli = new URL("./analyze-first-case-study.mjs", import.meta.url);
  fs.writeFileSync(input, JSON.stringify(model.createFirstCaseStudyCollection()));
  let result = spawnSync(process.execPath, [fileURLToPath(cli), "--input", input, "--output", output], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(output, "utf8"), /insufficient-data/);
  const legacy = model.createFirstCaseStudyCollection();
  delete legacy.lastAttemptNumber;
  fs.writeFileSync(input, JSON.stringify(legacy));
  result = spawnSync(process.execPath, [fileURLToPath(cli), "--input", input, "--output", output], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).eligibleCount, 0);
  const invalidOutput = path.join(runtime, "must-not-exist.md");
  fs.writeFileSync(input, JSON.stringify({ schema: "wrong", runs: [], participantName: "unsafe" }));
  result = spawnSync(process.execPath, [fileURLToPath(cli), `--input=${input}`, `--output=${invalidOutput}`], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.equal(fs.existsSync(invalidOutput), false);
});
console.log(JSON.stringify({ ok: true, checks: checks.length, source: "synthetic test fixtures only", runtime }, null, 2));
