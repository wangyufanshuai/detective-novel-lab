import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const root = process.cwd();
const outputDir = path.join(root, "outputs", "first-case-goal");
const runtimeDir = path.join(outputDir, "first-case-loop-runtime");
const compiled = new Map();
const require = createRequire(import.meta.url);

async function resolveLocal(parent, request) {
  const base = request.startsWith("@/") ? path.join(root, request.slice(2)) : path.resolve(path.dirname(parent), request);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    try { if ((await fs.stat(candidate)).isFile()) return candidate; } catch {}
  }
  throw new Error(`Cannot resolve ${request} from ${parent}`);
}

async function compileFile(sourceFile) {
  if (compiled.has(sourceFile)) return compiled.get(sourceFile);
  const relative = path.relative(root, sourceFile);
  const target = path.join(runtimeDir, relative.replace(/\.(tsx?|css)$/, ".cjs"));
  compiled.set(sourceFile, target);
  await fs.mkdir(path.dirname(target), { recursive: true });
  if (sourceFile.endsWith(".css")) {
    // CSS is irrelevant to event routing; actual component code is still rendered.
    await fs.writeFile(target, "module.exports = new Proxy({}, {get: (_, key) => String(key)});\n", "utf8");
    return target;
  }
  if (sourceFile.endsWith(".json")) {
    await fs.copyFile(sourceFile, target);
    return target;
  }
  const source = await fs.readFile(sourceFile, "utf8");
  let output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  const replacements = new Map();
  for (const match of output.matchAll(/require\("([^\"]+)"\)/g)) {
    const request = match[1];
    if (!request.startsWith(".") && !request.startsWith("@/")) {
      // outputs/ can be a junction on a different drive from node_modules/.
      replacements.set(request, require.resolve(request));
      continue;
    }
    const dependency = await compileFile(await resolveLocal(sourceFile, request));
    let relativeTarget = path.relative(path.dirname(target), dependency).replaceAll("\\", "/");
    if (!relativeTarget.startsWith(".")) relativeTarget = `./${relativeTarget}`;
    replacements.set(request, relativeTarget);
  }
  output = output.replace(/require\("([^\"]+)"\)/g, (whole, request) => replacements.has(request) ? `require(${JSON.stringify(replacements.get(request))})` : whole);
  await fs.writeFile(target, output, "utf8");
  return target;
}

async function load(source) {
  return require(await compileFile(path.join(root, source)));
}

const { buildCertifiedCaseRhythm } = await load("app/campaign/certified-case-rhythm-model.ts");
const { buildFinalDetectiveWorkspace } = await load("app/campaign/final-detective-workspace-model.ts");
const { executeCertifiedInvestigationStep } = await load("app/campaign/execute-certified-investigation-step.ts");
const { useGuidedManualActions } = await load("app/hooks/useGuidedManualActions.ts");
const { TheoryProofFields } = await load("app/components/TheoryProofFields.tsx");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const checks = [];
async function check(name, run) {
  await run();
  checks.push({ name, passed: true });
}

const session = { id: "session-loop", worldId: "world-loop", caseId: "case-loop", discoveredEvidenceIds: ["clue-a", "clue-b"], interrogationLog: [] };
const evidence = [{ id: "clue-a", title: "Discovered receipt" }, { id: "clue-b", title: "Discovered tool trace" }];
const notebookItems = [...evidence.map((item) => ({
  evidenceId: item.id, title: item.title, discovered: true, locked: false, isKey: true,
  locationId: "archive", locationName: "Archive", sourceEventLabel: "Public entry",
  challengeNpcIds: ["witness"], challengeNpcNames: ["Lin"], supports: [], contradicts: [], useHint: "Compare this recorded observation."
})), {
  evidenceId: "clue-hidden", title: "UNREVEALED SECRET TITLE", discovered: false, locked: true, isKey: true,
  locationId: "market", locationName: "Market", challengeNpcIds: [], challengeNpcNames: [], supports: [], contradicts: [], useHint: "Search the market."
}];
const theory = {
  culpritId: "witness", motive: "", method: "", evidenceIds: ["clue-a", "clue-b"],
  proof: { motiveEvidenceIds: ["clue-a"], methodEvidenceIds: ["clue-b"] }
};
const intake = {
  readiness: { status: "investigating", score: 80, summary: "The investigation is open." },
  nextAction: { kind: "observe", label: "Review incident window", buttonLabel: "Observe", detail: "Review the public window." },
  sourceTrail: [],
  progress: { currentStage: "search", discoveredEvidence: 0, totalEvidence: 3, questionedWitnesses: 0, totalWitnesses: 1, challengeReadyCount: 0, challengeHitCount: 0, selectedTheoryEvidence: 0, submitReady: false, wrongTheorySubmitted: false, solved: false }
};

function modelInput(overrides = {}) {
  return {
    runtimeMode: "server", commandBrief: { status: "ready", objective: { title: "Investigate the public record", phase: "Fieldwork", detail: "Follow the evidence", progressLabel: "1/7" }, nextAction: "Review incident window" },
    rhythm: buildCertifiedCaseRhythm({ intake, session, observedCrimeWindow: false, revealAvailable: false }),
    playableIntake: intake, session, notebookItems, discoveredEvidence: evidence,
    characters: [{ id: "witness", name: "Lin", role: "Archivist" }], testimonies: [], theory,
    selectedCharacterId: "witness", selectedEvidenceId: "clue-a", selectedSceneName: "Archive",
    promptSafe: true, memoryCount: 0, gapCards: [], proofTourSteps: [], revealAvailable: false,
    ...overrides
  };
}

function actionHarness(overrides = {}) {
  const calls = [];
  const record = (name) => async (...args) => { calls.push({ name, args }); return { status: "succeeded", detail: name }; };
  const input = {
    kind: "search", action: undefined,
    adapter: { joinCase: record("join"), discoverEvidence: record("discover"), discoverFirstSceneEvidence: record("search-location"), runInterrogationTarget: record("interrogate"), interrogateSelected: record("interrogate-selected"), toggleTheoryEvidence: (id) => calls.push({ name: "select", args: [id] }), revealSolution: record("reveal") },
    observeCaseWindow: record("observe"), focusStep: (action) => calls.push({ name: "focus", args: [action] }),
    notebookItems, discoveredEvidence: evidence, theory,
    selectedCharacterId: "witness", selectedEvidenceId: "clue-a", question: "What did you observe?",
    submitTheory: record("submit"), onRecover: record("recover"),
    ...overrides
  };
  return { input, calls };
}

await check("Rhythm preserves observe identity inside the search stage in the workspace model", () => {
  const input = modelInput();
  assert.equal(input.rhythm.currentStep.kind, "search");
  assert.equal(input.rhythm.currentStep.action.kind, "observe");
  const model = buildFinalDetectiveWorkspace(input);
  assert.equal(model.currentTask.action.kind, "observe");
  assert.equal(model.currentTask.action.enabled, true);
});

await check("Model action executes observation once without accidentally discovering evidence", async () => {
  let observed = false;
  const model = buildFinalDetectiveWorkspace(modelInput());
  const harness = actionHarness({ kind: model.currentTask.action.kind, action: intake.nextAction });
  harness.input.observeCaseWindow = async () => { observed = true; harness.calls.push({ name: "observe", args: [] }); return { status: "succeeded", detail: "Incident window reviewed" }; };
  const result = await executeCertifiedInvestigationStep(harness.input);
  assert.equal(result.status, "succeeded");
  assert.deepEqual(harness.calls.map((item) => item.name), ["observe"]);
  const nextRhythm = buildCertifiedCaseRhythm({ intake, session, observedCrimeWindow: observed, revealAvailable: false });
  assert.equal(nextRhythm.currentStep.action.kind, "search");
  assert.equal(buildFinalDetectiveWorkspace(modelInput({ rhythm: nextRhythm })).currentTask.action.kind, "search");
});

await check("A normalized search stage carrying an observe action still executes observation", async () => {
  const { input, calls } = actionHarness({ kind: "search", action: intake.nextAction });
  await executeCertifiedInvestigationStep(input);
  assert.deepEqual(calls.map((item) => item.name), ["observe"]);
});

await check("Explicit search target executes one evidence mutation", async () => {
  const { input, calls } = actionHarness({ action: { kind: "search", targetEvidenceId: "clue-hidden", targetLocationId: "market" } });
  assert.equal((await executeCertifiedInvestigationStep(input)).status, "succeeded");
  assert.deepEqual(calls, [{ name: "discover", args: ["clue-hidden"] }]);
});

await check("Search without a target uses the remaining notebook location", async () => {
  const { input, calls } = actionHarness();
  assert.equal((await executeCertifiedInvestigationStep(input)).status, "succeeded");
  assert.deepEqual(calls, [{ name: "search-location", args: ["market"] }]);
});

await check("Mutation outcomes propagate as blocked, failed, rejected, or cancelled", async () => {
  for (const status of ["blocked", "failed", "rejected", "cancelled"]) {
    const expected = { status, detail: `fixture ${status}` };
    const { input } = actionHarness({ kind: "join" });
    input.adapter.joinCase = async () => expected;
    assert.deepEqual(await executeCertifiedInvestigationStep(input), expected);
  }
});

await check("Submit forwards the explicit action outcome", async () => {
  const expected = { status: "rejected", detail: "Repair evidence assignments" };
  const { input } = actionHarness({ kind: "submit", submitTheory: async () => expected });
  assert.deepEqual(await executeCertifiedInvestigationStep(input), expected);
});

await check("Questioning retains the player's own wording and selected witness when the route has no target", async () => {
  const { input, calls } = actionHarness({ kind: "question", question: "  Why did you leave before the bell?  " });
  assert.equal((await executeCertifiedInvestigationStep(input)).status, "succeeded");
  assert.deepEqual(calls, [{ name: "interrogate", args: ["witness", undefined, "Why did you leave before the bell?"] }]);
});

await check("Challenge route targets take precedence while retaining player wording", async () => {
  const { input, calls } = actionHarness({ kind: "challenge", action: { kind: "challenge", targetCharacterId: "route-witness", targetEvidenceId: "route-clue" }, question: "Explain the time on this receipt." });
  await executeCertifiedInvestigationStep(input);
  assert.deepEqual(calls, [{ name: "interrogate", args: ["route-witness", "route-clue", "Explain the time on this receipt."] }]);
});

await check("Selected challenge evidence remains subject to the authoritative adapter's discovery check", async () => {
  const rejected = { status: "blocked", detail: "Discover this clue before questioning" };
  const { input } = actionHarness({ kind: "challenge", selectedEvidenceId: "clue-hidden" });
  input.adapter.runInterrogationTarget = async (_characterId, evidenceId) => {
    assert.equal(evidenceId, "clue-hidden");
    return rejected;
  };
  assert.deepEqual(await executeCertifiedInvestigationStep(input), rejected);
});

const readyIntake = { ...intake, nextAction: { kind: "submit", label: "Submit theory", detail: "Test the evidence assignments", buttonLabel: "Submit" }, progress: { ...intake.progress, currentStage: "submit", discoveredEvidence: 2, questionedWitnesses: 1, challengeHitCount: 1, selectedTheoryEvidence: 2, submitReady: true } };
function readyInput(overrides = {}) {
  return modelInput({
    playableIntake: readyIntake,
    rhythm: buildCertifiedCaseRhythm({ intake: readyIntake, session, observedCrimeWindow: true, revealAvailable: false }),
    ...overrides
  });
}

await check("Both proof groups make an otherwise complete draft ready with empty optional notes", () => {
  const model = buildFinalDetectiveWorkspace(readyInput());
  assert.equal(model.theory.motiveComplete, true);
  assert.equal(model.theory.methodComplete, true);
  assert.equal(model.theory.state, "ready");
  assert.equal(model.currentTask.action.kind, "submit");
});

await check("Changing optional notes does not change structured readiness", () => {
  assert.deepEqual(buildFinalDetectiveWorkspace(readyInput({ theory: { ...theory, motive: "My own wording", method: "A different explanation" } })).theory, buildFinalDetectiveWorkspace(readyInput()).theory);
});

await check("Missing, unselected, or undiscovered assignments stay incomplete despite filled notes", () => {
  for (const proof of [
    { motiveEvidenceIds: [], methodEvidenceIds: ["clue-b"] },
    { motiveEvidenceIds: ["clue-hidden"], methodEvidenceIds: ["clue-b"] },
    { motiveEvidenceIds: ["clue-a"], methodEvidenceIds: ["clue-unknown"] }
  ]) {
    const model = buildFinalDetectiveWorkspace(readyInput({ theory: { ...theory, motive: "Filled note", method: "Filled note", proof } }));
    assert.equal(model.theory.state, "incomplete");
  }
  assert.equal(buildFinalDetectiveWorkspace(readyInput({ theory: { ...theory, evidenceIds: ["clue-a"] } })).theory.state, "incomplete");
});

await check("Readiness is a public completeness check and does not guess private correctness", () => {
  const swapped = { ...theory, proof: { motiveEvidenceIds: ["clue-b"], methodEvidenceIds: ["clue-a"] } };
  assert.equal(buildFinalDetectiveWorkspace(readyInput({ theory: swapped })).theory.state, "ready");
});

await check("Selected assignments cannot override a route that has not opened submission", () => {
  assert.equal(buildFinalDetectiveWorkspace(modelInput()).theory.state, "incomplete");
});

function guidedHarness(kind, status, submitCurrentTheory = async () => ({ accepted: false, missing: [], contradictions: [] })) {
  const journals = [];
  const leadSettlements = [];
  const lastResults = [];
  const noop = () => {};
  const result = async () => ({ status, detail: `Controlled ${status} outcome` });
  const handlers = useGuidedManualActions({
    investigation: {
      session, theory, activeCase: { deductionCase: { truth: { culpritId: "witness", motive: "Canonical motive", method: "Canonical method" } } },
      setSelectedSceneId: noop, setSelectedCharacterId: noop, setSelectedSuspectId: noop, setSelectedEvidenceId: noop,
      setQuestion: noop, setTheory: noop, setInspectorTab: noop, pushToast: noop, setStatus: noop
    },
    replay: { guidedManualRunning: false, setGuidedManualRunning: noop, setGuidedManualLastResult: (value) => lastResults.push(value), replayGoalAttempt: null, setReplayGoalAttempt: noop },
    target: { kind, label: `Guided ${kind}`, evidenceId: "clue-a", characterId: "witness", locationId: "archive" },
    scenes: [{ id: "archive", evidenceIds: ["clue-a", "clue-b"] }],
    caseRouteCertificate: { theoryEvidenceIds: ["clue-a", "clue-b"] },
    playableIntake: readyIntake, appendJournal: (entry) => journals.push(entry), highlightSelection: noop,
    actionAdapter: { joinCase: result, discoverEvidence: result, runInterrogationTarget: result },
    resolveWorldLeadAfterStep: async (step) => leadSettlements.push(step),
    submitCurrentTheory, recordGuidedStep: noop
  });
  return { ...handlers, journals, leadSettlements, lastResults };
}

for (const kind of ["join", "search", "question", "challenge"]) {
  await check(`Guided ${kind} does not report completion or settle a world lead for any non-success outcome`, async () => {
    for (const status of ["failed", "blocked", "cancelled", "rejected"]) {
      const harness = guidedHarness(kind, status);
      await harness.runGuidedManualStep();
      assert.equal(harness.journals.some((item) => item.status === "done"), false);
      assert.deepEqual(harness.leadSettlements, []);
      if (status === "cancelled") {
        assert.deepEqual(harness.journals, []);
        assert.deepEqual(harness.lastResults, []);
      } else {
        assert.equal(harness.journals.length, 1);
        assert.equal(harness.journals[0].status, "blocked");
      }
    }
  });
  await check(`Guided ${kind} still records a successful action once`, async () => {
    const harness = guidedHarness(kind, "succeeded");
    await harness.runGuidedManualStep();
    assert.equal(harness.journals.filter((item) => item.status === "done").length, 1);
    assert.deepEqual(harness.leadSettlements, kind === "join" ? [] : [kind]);
  });
}

await check("Guided submission preserves proof instead of downgrading an incorrect assignment to canonical text", async () => {
  let submitted;
  const harness = guidedHarness("submit", "succeeded", async (input) => {
    submitted = input;
    return { accepted: false, missing: ["Motive evidence assignments do not close the required proof for the accused character."], contradictions: [] };
  });
  await harness.runGuidedManualStep();
  assert.deepEqual(submitted.proof, theory.proof);
  assert.equal(harness.journals.some((item) => item.status === "done"), false);
  assert.deepEqual(harness.leadSettlements, []);
});

function renderProofFields(overrides = {}) {
  return renderToStaticMarkup(React.createElement(TheoryProofFields, {
    theory, setTheory: () => {},
    discoveredEvidence: evidence.map((item) => ({ ...item, visibleDescription: "A player-visible observation.", trueMeaning: "PRIVATE TRUTH MUST NOT RENDER", supportsConclusion: ["PRIVATE GROUP KEY MUST NOT RENDER"] })),
    ...overrides
  }));
}

await check("Actual React proof fields present both player-selectable groups and label notes optional", () => {
  const html = renderProofFields();
  assert.equal((html.match(/type="checkbox"/g) || []).length, 4);
  assert.equal((html.match(/checked=""/g) || []).length, 2);
  assert.equal((html.match(/Discovered receipt/g) || []).length, 2);
  assert.equal((html.match(/Discovered tool trace/g) || []).length, 2);
  assert.match(html, /optional|可选笔记/);
  assert.doesNotMatch(html, /PRIVATE TRUTH|PRIVATE GROUP KEY|UNREVEALED SECRET TITLE/);
});

await check("Actual React proof fields do not show deselected global evidence as an active assignment", () => {
  const html = renderProofFields({ theory: { ...theory, evidenceIds: ["clue-a"] } });
  assert.equal((html.match(/checked=""/g) || []).length, 1);
});

await check("Actual React proof fields disable both groups while an action is in flight", () => {
  const html = renderProofFields({ busy: true });
  assert.equal((html.match(/<fieldset[^>]*disabled=""/g) || []).length, 2);
});

await check("Actual React proof fields require discovery before offering a clue to assign", () => {
  const html = renderProofFields({ discoveredEvidence: [] });
  assert.equal((html.match(/type="checkbox"/g) || []).length, 0);
  assert.match(html, /Search the scene|先搜索现场/);
});

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, "first-case-loop-test-report.json"), `${JSON.stringify({
  generatedAt: new Date().toISOString(), passed: checks.length, failed: 0,
  scope: "Execution of the real rhythm model, workspace model, shared dispatcher, guided handler, and server rendering of the real React proof fields. DOM clicks, browser layout, and human tests are separate.", checks
}, null, 2)}\n`, "utf8");
console.log(`First-case loop tests passed: ${checks.length}/${checks.length}.`);
