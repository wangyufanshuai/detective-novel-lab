import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const runtimeDir = path.join(root, "outputs", "certified-case-rhythm-runtime");
await fs.mkdir(runtimeDir, { recursive: true });

async function compile(sourcePath, outputPath, replacements = []) {
  let output = ts.transpileModule(await fs.readFile(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  for (const [pattern, replacement] of replacements) output = output.replace(pattern, replacement);
  await fs.writeFile(outputPath, output, "utf8");
}

const registryOutput = path.join(runtimeDir, "investigation-action-registry.mjs");
const rhythmOutput = path.join(runtimeDir, "certified-case-rhythm-model.mjs");
await compile(path.join(root, "app/campaign/investigation-action-registry.ts"), registryOutput);
await compile(path.join(root, "app/campaign/certified-case-rhythm-model.ts"), rhythmOutput, [
  [/from "\.\/investigation-action-registry"/g, 'from "./investigation-action-registry.mjs"']
]);

const model = await import(`${pathToFileURL(rhythmOutput).href}?test=${Date.now()}`);

const progress = (overrides = {}) => ({
  currentStage: "search",
  discoveredEvidence: 0,
  totalEvidence: 5,
  questionedWitnesses: 0,
  totalWitnesses: 2,
  challengeReadyCount: 0,
  challengeHitCount: 0,
  selectedTheoryEvidence: 0,
  submitReady: false,
  wrongTheorySubmitted: false,
  solved: false,
  ...overrides
});
const intake = (progressValue, kind = progressValue.currentStage) => ({
  progress: progressValue,
  nextAction: { kind, label: `Next ${kind}`, detail: `Continue ${kind}.`, buttonLabel: `Run ${kind}` }
});
const session = (judgement) => ({ id: "private-session", discoveredEvidenceIds: [], interrogationLog: [], judgement });
const build = (overrides = {}) => model.buildCertifiedCaseRhythm({
  intake: intake(progress()),
  session: session(undefined),
  selectedSceneName: "Public Archive",
  revealAvailable: false,
  ...overrides
});

const stages = [
  [build({ session: null, intake: intake(progress({ currentStage: "join" }), "join") }), "join", "intake"],
  [build(), "search", "fieldwork"],
  [build({ intake: intake(progress({ currentStage: "question", discoveredEvidence: 1 }), "question") }), "question", "fieldwork"],
  [build({ intake: intake(progress({ currentStage: "challenge", discoveredEvidence: 1, questionedWitnesses: 1 }), "challenge") }), "challenge", "fieldwork"],
  [build({ intake: intake(progress({ currentStage: "select-evidence", discoveredEvidence: 1, questionedWitnesses: 1, challengeHitCount: 1 }), "select-evidence") }), "select-evidence", "deduction"],
  [build({ intake: intake(progress({ currentStage: "submit", discoveredEvidence: 1, questionedWitnesses: 1, challengeHitCount: 1, selectedTheoryEvidence: 2, submitReady: true }), "submit") }), "submit", "deduction"]
];
for (const [result, step, beat] of stages) {
  assert.equal(result.currentStep.kind, step);
  assert.equal(result.currentStep.beat, beat);
  assert.equal(result.beats.filter((item) => item.status === "current").length, 1, `${step} owns one current beat`);
}
const observePrelude = build({ observedCrimeWindow: false });
assert.equal(observePrelude.currentStep.kind, "search", "Observe remains a Fieldwork prelude rather than a new certified proof step");
assert.equal(observePrelude.currentStep.action.kind, "observe", "the existing Observe action runs before Search");
assert.equal(observePrelude.currentStep.label, "Observe case window");

const rejected = build({
  session: session({ accepted: false, missing: ["motive"], contradictions: [], explanation: "blocked" }),
  recoveryGap: { label: "Motive coverage", detail: "Revise one visible proof obligation." },
  recoveryAdvice: "Do not reveal an answer."
});
assert.equal(rejected.status, "recovery");
assert.equal(rejected.currentStep.kind, "recover");
assert.equal(rejected.currentStep.action.kind, "submit", "Recovery opens the existing theory path without auto-submitting");
assert.equal(rejected.recoveryLabel, "Motive coverage");
assert.equal(rejected.beats.find((beat) => beat.kind === "deduction")?.status, "current");

const acceptedIntake = intake(progress({ currentStage: "review-source", discoveredEvidence: 1, questionedWitnesses: 1, challengeHitCount: 1, selectedTheoryEvidence: 2, submitReady: true, solved: true }), "review-source");
const accepted = build({
  intake: acceptedIntake,
  session: session({ accepted: true, missing: [], contradictions: [], explanation: "accepted" })
});
assert.equal(accepted.currentStep.kind, "review-source");
assert.equal(accepted.beats.find((beat) => beat.kind === "review")?.status, "current");
const complete = build({ intake: acceptedIntake, session: session({ accepted: true }), revealAvailable: true });
assert.equal(complete.status, "complete");
assert.equal(complete.completedStepCount, 7);
assert.equal(complete.beats.every((beat) => beat.status === "done"), true);

const unsafe = build({ recoveryGap: { label: "case-2026-001-deadbeef", detail: "C:\\private\\truth.json culpritId" }, session: session({ accepted: false }) });
assert.equal(/case-2026|culpritId|[A-Za-z]:[\\/]/i.test(JSON.stringify(unsafe)), false, "visible rhythm copy sanitizes raw references");
const frozenInput = structuredClone({ intake: intake(progress()), session: session(undefined), selectedSceneName: "Public Archive", revealAvailable: false });
const before = JSON.stringify(frozenInput);
assert.deepEqual(model.buildCertifiedCaseRhythm(frozenInput), model.buildCertifiedCaseRhythm(structuredClone(frozenInput)), "same safe state yields the same rhythm");
assert.equal(JSON.stringify(frozenInput), before, "rhythm derivation does not mutate input");

const budgetPass = model.evaluateCertifiedCaseRhythmAutomation(stages.map(([, step]) => ({ stage: step, primaryClicks: 1, panelSwitches: 1, settleMs: 900 })));
assert.equal(budgetPass.ok, true);
const budgetFail = model.evaluateCertifiedCaseRhythmAutomation([{ stage: "search", primaryClicks: 3, panelSwitches: 2, settleMs: 3001 }]);
assert.equal(budgetFail.ok, false);
assert.equal(budgetFail.failures.length, 3);

const read = (file) => fs.readFile(path.join(root, file), "utf8");
const [source, component, css, page, strategic, navigation, actions] = await Promise.all([
  read("app/campaign/certified-case-rhythm-model.ts"),
  read("app/components/CertifiedCaseRhythmSurface.tsx"),
  read("app/components/CertifiedCaseRhythmSurface.module.css"),
  read("app/page.tsx"),
  read("app/campaign/strategic-command-model.ts"),
  read("app/hooks/useInvestigationNavigationActions.ts"),
  read("app/hooks/useCertifiedCaseRhythmActions.ts")
]);
for (const [label, text] of [["model", source], ["surface", component], ["navigation", navigation], ["actions", actions]]) {
  assert.doesNotMatch(text, /\/api\/|\bfetch\s*\(|\bpostJson\s*\(|\bpostV1\s*\(/, `${label} remains request-free`);
}
assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|setInterval/, "rhythm remains storage/background-free");
assert.match(component, /Manual First/);
assert.match(component, /Full certified route/);
assert.match(strategic, /rhythmContextMatch/);
assert.match(page, /await runCertifiedCaseRhythmStep\(\)/, "Current Action delegates through the rhythm adapter");
assert.match(actions, /discoverFirstSceneEvidence/);
assert.match(actions, /runInterrogationTarget/);
assert.doesNotMatch(actions, /toggleTheoryEvidence|submitTheory/, "Manual First evidence and theory steps only focus their existing workspace");
assert.doesNotMatch(navigation.match(/function focusCertifiedStep[\s\S]*?\n  }/m)?.[0] || "", /setTheory|discover|interrogate|submit/, "route focusing does not execute or fill an investigation action");
assert.match(css, /@media\s*\(max-width:\s*520px\)/);

const budgets = [
  ["rhythm model", source, 300],
  ["rhythm surface", component, 100],
  ["rhythm CSS", css, 180],
  ["rhythm actions", actions, 80],
  ["page", page, 1350],
  ["navigation", navigation, 350]
];
for (const [label, text, maximum] of budgets) assert.equal(text.split(/\r?\n/).length < maximum, true, `${label} stays below ${maximum} lines`);

console.log(JSON.stringify({
  ok: true,
  suite: "certified-case-rhythm",
  stages: stages.map(([, step]) => step),
  automationBudget: model.CERTIFIED_CASE_RHYTHM_AUTOMATION_BUDGET,
  checks: ["determinism", "four-beat-projection", "minimum-recovery", "manual-first-focus", "automation-budget", "public-safety", "request-storage-isolation", "source-budgets"]
}));
