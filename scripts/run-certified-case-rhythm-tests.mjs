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

const certifiedSearchTarget = build({
  selectedSceneName: "Unrelated selected place",
  intake: {
    progress: progress(),
    nextAction: {
      kind: "search",
      label: "Search certified archive",
      detail: "Focus the certified archive clue.",
      buttonLabel: "Search",
      targetLocationId: "public-archive"
    }
  }
});
assert.equal(certifiedSearchTarget.currentStep.detail, "Focus the certified archive clue.", "the certified target copy is not replaced by an unrelated map selection");
assert.equal(certifiedSearchTarget.currentStep.action.targetLocationId, "public-archive", "the certified Search target remains intact");

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

const draftClues = Array.from({ length: 7 }, (_, index) => `discovered-clue-${index + 1}`);
const draftSession = { ...session(undefined), discoveredEvidenceIds: draftClues };
const draftIntake = intake(progress({ currentStage: "select-evidence", discoveredEvidence: 7, questionedWitnesses: 1, challengeHitCount: 1, selectedTheoryEvidence: 0, submitReady: true }), "select-evidence");
const draftInput = { intake: draftIntake, session: draftSession, observedCrimeWindow: true, revealAvailable: false };
const draftBefore = structuredClone(draftInput);
const legacyDraft = model.buildCertifiedCaseRhythm(draftInput);
assert.equal(legacyDraft.completedStepCount, 4, "omitting draft evidence preserves the original server-only fixture contract");
assert.equal(legacyDraft.currentStep.kind, "select-evidence");
const selectedDraft = model.buildCertifiedCaseRhythm({ ...draftInput, theoryEvidenceIds: draftClues });
assert.equal(selectedDraft.progressLabel, "5/7 certified steps", "seven discovered draft selections complete the evidence-selection step");
assert.equal(selectedDraft.beats.find((beat) => beat.kind === "deduction").metric, "7 clue(s)");
assert.equal(selectedDraft.currentStep.kind, "submit", "an open public submit gate advances a completed local selection");
assert.equal(selectedDraft.currentStep.action.kind, "submit", "the actual proposed action advances with its displayed stage");
const reducedDraft = model.buildCertifiedCaseRhythm({ ...draftInput, theoryEvidenceIds: draftClues.slice(1) });
assert.equal(reducedDraft.beats.find((beat) => beat.kind === "deduction").metric, "6 clue(s)", "removing a draft clue immediately updates its display count");
const emptyDraft = model.buildCertifiedCaseRhythm({ ...draftInput, theoryEvidenceIds: [] });
assert.equal(emptyDraft.progressLabel, "4/7 certified steps");
assert.equal(emptyDraft.currentStep.kind, "select-evidence", "clearing valid draft choices restores the selection step");
assert.equal(emptyDraft.beats.find((beat) => beat.kind === "deduction").metric, "0 clue(s)");
const invalidDraft = model.buildCertifiedCaseRhythm({ ...draftInput, theoryEvidenceIds: ["undiscovered", "unknown", ""] });
assert.deepEqual(invalidDraft, emptyDraft, "unknown and undiscovered draft IDs do not increase progress or open submission");
assert.deepEqual(model.buildCertifiedCaseRhythm({ ...draftInput, theoryEvidenceIds: [...draftClues, ...draftClues, "unknown"] }), selectedDraft, "repeated IDs and unknown extras cannot inflate the selection count");
assert.equal(model.buildCertifiedCaseRhythm({ ...draftInput, theoryEvidenceIds: draftClues, intake: { ...draftIntake, progress: { ...draftIntake.progress, submitReady: false } } }).currentStep.kind, "select-evidence", "draft selections never override a closed public submission gate");
assert.equal(model.buildCertifiedCaseRhythm({ ...draftInput, theoryEvidenceIds: [], intake: { ...draftIntake, nextAction: { ...draftIntake.nextAction, kind: "submit" }, progress: { ...draftIntake.progress, selectedTheoryEvidence: 7 } } }).currentStep.kind, "select-evidence", "removing local choices overrides stale server selection display");
assert.equal(model.buildCertifiedCaseRhythm({ ...draftInput, theoryEvidenceIds: draftClues, intake: { ...draftIntake, nextAction: { ...draftIntake.nextAction, kind: "question" } } }).currentStep.kind, "question", "draft selections cannot skip earlier fieldwork");
assert.deepEqual(draftInput, draftBefore, "draft projection does not mutate the authoritative intake or session");

const memoHookSource = await fs.readFile(path.join(root, "app/hooks/useCertifiedCaseRhythm.ts"), "utf8");
const memoHookAst = ts.createSourceFile("useCertifiedCaseRhythm.ts", memoHookSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const memoHook = memoHookAst.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "useCertifiedCaseRhythm");
assert.ok(memoHook);
// Execute the actual hook body across renders with React-compatible dependency
// comparison. This isolates memo invalidation; DOM rendering is tested separately.
const memoRuntime = ts.transpileModule(`export function createMemoHarness(buildCertifiedCaseRhythm) {
  let previousDependencies, value, evaluations = 0;
  function useMemo(compute, dependencies) {
    if (!previousDependencies || dependencies.some((item, index) => !Object.is(item, previousDependencies[index]))) {
      previousDependencies = [...dependencies]; value = compute(); evaluations += 1;
    }
    return value;
  }
  ${memoHook.getText(memoHookAst).replace(/^export\s+/, "")}
  return { render: useCertifiedCaseRhythm, evaluations: () => evaluations };
}`, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createMemoHarness } = await import(`data:text/javascript;base64,${Buffer.from(memoRuntime).toString("base64")}`);
const memoHarness = createMemoHarness(model.buildCertifiedCaseRhythm);
const initiallyEmpty = { ...draftInput, theoryEvidenceIds: [] };
assert.equal(memoHarness.render(initiallyEmpty).completedStepCount, 4);
assert.equal(memoHarness.render(initiallyEmpty).completedStepCount, 4);
assert.equal(memoHarness.evaluations(), 1, "unchanged draft references keep their memoized result");
assert.equal(memoHarness.render({ ...draftInput, theoryEvidenceIds: draftClues }).completedStepCount, 5, "the actual hook invalidates when only draft evidence changes");
assert.equal(memoHarness.render(initiallyEmpty).currentStep.kind, "select-evidence", "the actual hook invalidates again when those choices are removed");
assert.equal(memoHarness.evaluations(), 3);

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
assert.match(component, /Full investigation route/, "expanded route keeps its English label");
assert.match(component, /完整调查步骤/, "expanded route has its Chinese label");
assert.match(strategic, /rhythmContextMatch/);
const pageAst = ts.createSourceFile("page.tsx", page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let rhythmCalls = 0;
function visitPage(node) {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "runCertifiedCaseRhythmStep") rhythmCalls += 1;
  ts.forEachChild(node, visitPage);
}
visitPage(pageAst);
assert.equal(rhythmCalls, 1, "Current Action delegates once through the rhythm adapter, preserving its returned outcome");
const hookAst = ts.createSourceFile("useCertifiedCaseRhythmActions.ts", actions, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const hookFunction = hookAst.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "useCertifiedCaseRhythmActions");
assert.ok(hookFunction, "execute the actual rhythm action wiring");
const dispatcherSource = await read("app/campaign/execute-certified-investigation-step.ts");
// Memoization is a passthrough here; this isolates callback routing, not React lifecycle.
const callbackRuntime = ts.transpileModule(`${dispatcherSource}\nconst useCallback = (callback) => callback;\n${hookFunction.getText(hookAst)}`, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { useCertifiedCaseRhythmActions } = await import(`data:text/javascript;base64,${Buffer.from(callbackRuntime).toString("base64")}`);
const routingSamples = [
  { rhythm: observePrelude, expected: "observe" },
  { rhythm: certifiedSearchTarget, expected: "discoverFirstSceneEvidence" },
  { rhythm: { currentStep: { kind: "question", action: { kind: "question", targetCharacterId: "route-witness" } } }, expected: "runInterrogationTarget" },
  { rhythm: { currentStep: { kind: "challenge", action: { kind: "challenge", targetCharacterId: "route-witness", targetEvidenceId: "route-clue" } } }, expected: "runInterrogationTarget" },
  { rhythm: stages[4][0], expected: "toggleTheoryEvidence" },
  { rhythm: stages[5][0], expected: "submit" },
  { rhythm: rejected, expected: "focus", status: "blocked" }
];
for (const sample of routingSamples) {
  const calls = [];
  const record = (name) => async (...args) => { calls.push({ name, args }); return { status: "succeeded", detail: name }; };
  const actionAdapter = Object.fromEntries(["joinCase", "discoverEvidence", "discoverFirstSceneEvidence", "runInterrogationTarget", "toggleTheoryEvidence", "revealSolution"].map((name) => [name, record(name)]));
  const runner = useCertifiedCaseRhythmActions({
    rhythm: sample.rhythm, actionAdapter, observeCaseWindow: record("observe"), focusStep: record("focus"),
    notebookItems: [], discoveredEvidence: [{ id: "route-clue" }], theory: { culpritId: "", motive: "", method: "", evidenceIds: [] },
    submitTheory: record("submit")
  });
  const outcome = await runner.runCurrentStep();
  assert.deepEqual(calls.map((item) => item.name), [sample.expected], `${sample.rhythm.currentStep.kind} executes only its corresponding shared action`);
  assert.equal(outcome.status, sample.status || "succeeded", "the rhythm entry preserves the real action result");
}
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
  checks: ["determinism", "four-beat-projection", "draft-evidence-progress", "draft-removal-regression", "draft-discovery-filter", "draft-memo-invalidation", "minimum-recovery", "shared-action-execution", "navigation-focus-only", "automation-budget", "public-safety", "request-storage-isolation", "source-budgets"]
}));
