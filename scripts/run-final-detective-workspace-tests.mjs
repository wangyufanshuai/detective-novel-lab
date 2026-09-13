import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const read = (file) => fs.readFile(path.join(root, file), "utf8");
const artifact = path.join(os.tmpdir(), `final-detective-workspace-${process.pid}.mjs`);

const commandBrief = {
  runtimeMode: "server",
  status: "ready",
  objective: { phase: "Fieldwork", title: "Test the public record", detail: "Follow the visible certified route.", progressLabel: "2/7 certified steps" },
  nextAction: "Question the selected public witness with one discovered clue.",
  safeBoundary: "Case truth, evidence coverage, the certified route, judgement, and NPC legal actions remain unchanged."
};

const rhythm = {
  status: "active",
  currentStep: {
    kind: "challenge",
    beat: "fieldwork",
    label: "Challenge certified testimony",
    detail: "Present a discovered clue.",
    metric: "test statement",
    action: { kind: "challenge", label: "Challenge", detail: "Present a discovered clue.", buttonLabel: "Challenge", targetCharacterId: "npc-private-01", targetEvidenceId: "evidence-private-01" }
  },
  beats: [
    { kind: "intake", label: "Intake", metric: "joined", status: "done" },
    { kind: "fieldwork", label: "Fieldwork", metric: "2/3 steps", status: "current" },
    { kind: "deduction", label: "Deduction", metric: "1 clue", status: "ready" },
    { kind: "review", label: "Review", metric: "locked", status: "locked" }
  ],
  completedStepCount: 3,
  totalStepCount: 7,
  progressLabel: "3/7 certified steps",
  suggestedAction: { phase: "Fieldwork", title: "Challenge", detail: "Present a discovered clue.", targetTab: "investigation" }
};

const baseInput = {
  runtimeMode: "server",
  commandBrief,
  rhythm,
  playableIntake: {
    readiness: { status: "investigating", score: 92, summary: "The public route is ready." },
    progress: { submitReady: true },
    sourceTrail: [{ id: "source-private-01", kind: "event", label: "Archive entry", detail: "A public archive entry anchors the route.", hidden: false }]
  },
  session: {
    id: "session-private-01",
    discoveredEvidenceIds: ["evidence-private-01"],
    interrogationLog: [{
      id: "entry-private-01",
      characterId: "npc-private-01",
      evidenceId: "evidence-private-01",
      question: "PLAYER PRIVATE TEXT",
      answer: "RAW BODY PRIVATE",
      challenge: { hit: true }
    }]
  },
  notebookItems: [{
    evidenceId: "evidence-private-01",
    title: "Stamped ledger copy",
    locked: false,
    discovered: true,
    isKey: true,
    locationId: "location-private-01",
    locationName: "Public archive",
    sourceEventId: "event-private-01",
    sourceEventLabel: "Morning archive entry",
    challengeNpcIds: ["npc-private-01"],
    challengeNpcNames: ["Lin"],
    supports: ["record access"],
    contradicts: ["the stated arrival time"],
    useHint: "Use the visible stamp to test the public timeline."
  }, {
    evidenceId: "evidence-private-02",
    title: "SECRET UNDISCOVERED TITLE",
    locked: true,
    discovered: false,
    isKey: false,
    locationId: "location-private-02",
    locationName: "Market awning",
    challengeNpcIds: [],
    challengeNpcNames: [],
    supports: [],
    contradicts: [],
    useHint: "Search the market awning."
  }],
  discoveredEvidence: [{ id: "evidence-private-01", title: "Stamped ledger copy" }],
  characters: [{ id: "npc-private-01", name: "Lin", role: "Archivist" }],
  testimonies: [{
    id: "testimony-private-01",
    caseId: "case-private-01",
    characterId: "npc-private-01",
    initialStatement: "I arrived after opening.",
    currentStatement: "I arrived before the public counter opened.",
    contradictionEvidenceIds: ["evidence-private-01"],
    exposedContradictions: ["arrival time changed"],
    revised: true,
    memoryIds: ["memory-private-01"]
  }],
  theory: { culpritId: "", motive: "", method: "", evidenceIds: ["evidence-private-01"] },
  selectedCharacterId: "npc-private-01",
  selectedEvidenceId: "evidence-private-01",
  selectedSceneName: "Public archive",
  promptSafe: true,
  memoryCount: 2,
  gapCards: [],
  proofTourSteps: [],
  revealAvailable: false
};

try {
  const source = await read("app/campaign/final-detective-workspace-model.ts");
  await fs.writeFile(artifact, ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText, "utf8");
  const { buildFinalDetectiveWorkspace } = await import(`${pathToFileURL(artifact).href}?test=${Date.now()}`);

  const before = structuredClone(baseInput);
  const first = buildFinalDetectiveWorkspace(baseInput);
  const idContradictionInput = structuredClone(baseInput);
  idContradictionInput.testimonies[0].exposedContradictions = ["evidence-private-01", "ev-undiscovered-private"];
  const idContradictions = buildFinalDetectiveWorkspace(idContradictionInput);
  const visibleContradictionLabels = idContradictions.contradictions.map((item) => item.label);
  assert.ok(visibleContradictionLabels.includes("Stamped ledger copy"), "exposed references use a discovered evidence title");
  assert.ok(visibleContradictionLabels.includes("Exposed testimony contradiction"), "unknown exposed references use a public generic label");
  assert.doesNotMatch(JSON.stringify(idContradictions), /ev-undiscovered-private|evidence-private-01/, "opaque evidence identifiers do not become player copy");
  const second = buildFinalDetectiveWorkspace(structuredClone(baseInput));
  assert.deepEqual(first, second, "same safe input produces the same workspace");
  assert.deepEqual(baseInput, before, "workspace projection does not mutate input");
  assert.equal(first.stage, "contradiction", "certified rhythm owns the active contradiction stage");
  assert.equal(first.currentTask.nextAction, commandBrief.nextAction, "the only Next Action comes from Campaign Command Brief");
  assert.equal(first.evidence.rows[1].title, "Undiscovered clue", "locked evidence title stays hidden");
  assert.equal(first.testimony.rows[0].state, "contradicted", "only an already-exposed contradiction is presented");
  assert.equal(first.contradictions.some((item) => item.state === "exposed"), true, "exposed contradiction is present");
  assert.equal(first.theory.state, "incomplete", "incomplete theory is explicit");

  const intake = buildFinalDetectiveWorkspace({ ...baseInput, session: null, rhythm: { ...rhythm, currentStep: { ...rhythm.currentStep, kind: "join" } } });
  assert.equal(intake.stage, "intake");
  assert.equal(intake.currentTask.action.kind, "join");

  const ready = buildFinalDetectiveWorkspace({
    ...baseInput,
    theory: { culpritId: "npc-private-01", motive: "Entered motive", method: "Entered method", evidenceIds: ["evidence-private-01"] },
    rhythm: { ...rhythm, currentStep: { ...rhythm.currentStep, kind: "submit", label: "Submit theory", action: { kind: "submit", label: "Submit", detail: "Test theory", buttonLabel: "Submit" } } }
  });
  assert.equal(ready.stage, "theory");
  assert.equal(ready.theory.state, "ready");
  assert.equal(ready.currentTask.action.kind, "submit");

  const rejectedInput = {
    ...baseInput,
    session: {
      ...baseInput.session,
      judgement: {
        accepted: false,
        proofCoverage: { gaps: [{ kind: "motive", label: "Public motive gap", detail: "Connect one discovered clue.", obligationId: "private-obligation" }] }
      }
    },
    campaignRecovery: { status: "ready", failureLabel: "The theory has a public proof gap.", recoveryActionLabel: "Review certified route", costLabel: "No hidden answer is granted.", nextAction: "Repair one visible gap." },
    gapCards: [{ id: "private-gap", label: "Motive gap", detail: "Connect one clue.", target: "motive" }]
  };
  const rejected = buildFinalDetectiveWorkspace(rejectedInput);
  assert.equal(rejected.stage, "recovery");
  assert.equal(rejected.theory.state, "rejected");
  assert.equal(rejected.currentTask.action.kind, "recover");
  assert.equal(rejected.recovery.state, "ready");

  const localRejected = buildFinalDetectiveWorkspace({ ...rejectedInput, runtimeMode: "static-demo", campaignRecovery: null });
  assert.equal(localRejected.stage, "recovery");
  assert.equal(localRejected.currentTask.action.kind, "submit", "local repair returns the sole primary action to revised theory submission");
  assert.equal(localRejected.currentTask.action.label, "Submit revised theory");

  const accepted = buildFinalDetectiveWorkspace({
    ...baseInput,
    session: { ...baseInput.session, judgement: { accepted: true } },
    sourceReviewUnlock: { unlocked: true, statusLabel: "audit ready", sourceEventCount: 1, coveredObligations: 1, totalObligations: 1 },
    proofLedger: { obligations: [{ id: "private-obligation", kind: "motive", required: true, lowSpoilerLabel: "Motive connection", lowSpoilerDetail: "A discovered clue closes the public motive lane." }] },
    proofCoverage: { coveredObligationIds: ["private-obligation"] },
    routeCertificate: { steps: [{ kind: "question", complete: true, lowSpoilerLabel: "Question witness", lowSpoilerDetail: "The public witness step is complete." }] },
    proofTourSteps: [{ id: "private-tour", stage: "conclusion", title: "Conclusion audit", detail: "The accepted route closes without revealing private bodies.", locked: false, complete: true }]
  });
  assert.equal(accepted.stage, "source-review");
  assert.equal(accepted.theory.state, "accepted");
  assert.equal(accepted.sourceReview.state, "unlocked");
  assert.equal(new Set(accepted.sourceReview.rows.map((item) => item.category)).size, 4, "source review unifies four safe categories");

  const serialized = JSON.stringify({ first, rejected, accepted });
  assert.doesNotMatch(serialized, /PLAYER PRIVATE TEXT|RAW BODY PRIVATE|SECRET UNDISCOVERED TITLE/);
  assert.doesNotMatch(serialized, /\b(?:case|session|npc|character|location|institution|resource|evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b/i);
  assert.doesNotMatch(serialized, /\b(?:culpritId|victimId|hiddenTruth|rawBody|sourceId|eventId|npcId|locationId|sessionId|caseId)\b|[A-Za-z]:[\\/]/i);

  const [surfaceSource, coreSource, routeSource, hookSource, panelSource] = await Promise.all([
    read("app/components/FinalDetectiveWorkspace.tsx"),
    read("app/components/InvestigationCoreActionsSurface.tsx"),
    read("app/components/InvestigationRouteReviewSurface.tsx"),
    read("app/hooks/useFinalDetectiveWorkspace.ts"),
    read("app/components/InvestigationSurface.tsx")
  ]);
  assert.match(surfaceSource, /<CinematicDeductionBoard \{\.\.\.props\} variant="standard"/, "all non-gold routes delegate controlled props to the shared desk");
  const deskSource = await read("app/components/CinematicDeductionBoard.tsx");
  assert.equal((deskSource.match(/data-testid="cinematic-certified-action"/g) || []).length, 1, "the shared desk owns one primary action");
  const componentAst = ts.createSourceFile("CinematicDeductionBoard.tsx", deskSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const primaryHandlers = [];
  function visitHandler(node) {
    if (ts.isFunctionDeclaration(node) && ["runCertifiedAction", "executeCertifiedAction", "runExclusive"].includes(node.name?.text)) primaryHandlers.push(node.getText(componentAst));
    ts.forEachChild(node, visitHandler);
  }
  visitHandler(componentAst);
  assert.equal(primaryHandlers.length, 3, "test the shared component's actual dispatcher and exclusive primary handler");
  const dispatcherSource = await read("app/campaign/execute-certified-investigation-step.ts");
  const handlerRuntime = ts.transpileModule(`${dispatcherSource}
    export function createPrimaryHarness(input) {
      const {busy, model, currentAction, actionAdapter, observeCaseWindow, onIntakeNextAction,
        notebookItems, discoveredEvidence, theory, submitTheory, selectedCharacterId,
        selectedEvidenceId, question, onCampaignRecoveryStart, gapCards, onGapSelect,
        runWithResolution} = input;
      const effectiveBusy = busy;
      const actionLock = {current:false};
      const setLocalBusy = () => {};
      ${primaryHandlers.join("\n")}
      return runCertifiedAction;
    }`, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const { createPrimaryHarness } = await import(`data:text/javascript;base64,${Buffer.from(handlerRuntime).toString("base64")}`);
  const primaryCases = [
    { kind: "join", expected: ["joinCase"] },
    { kind: "observe", expected: ["observe"] },
    { kind: "search", action: { kind: "search", targetEvidenceId: "clue" }, expected: ["discoverEvidence"] },
    { kind: "search", action: { kind: "search", targetLocationId: "archive" }, expected: ["discoverFirstSceneEvidence"] },
    { kind: "question", expected: ["runInterrogationTarget"] },
    { kind: "challenge", expected: ["runInterrogationTarget"] },
    { kind: "select-evidence", expected: ["toggleTheoryEvidence"] },
    { kind: "submit", expected: ["submitTheory"] },
    { kind: "review-source", expected: ["revealSolution"] }
  ];
  for (const sample of primaryCases) {
    const calls = [];
    const outcomes = [];
    const record = (name) => async (...args) => { calls.push({ name, args }); return { status: "succeeded", detail: name }; };
    const adapter = Object.fromEntries(["joinCase", "discoverEvidence", "discoverFirstSceneEvidence", "runInterrogationTarget", "toggleTheoryEvidence", "revealSolution"].map((name) => [name, record(name)]));
    const run = createPrimaryHarness({
      busy: false, model: { ...ready, currentTask: { action: { kind: sample.kind, enabled: true, label: "Current action" } } },
      currentAction: sample.action, actionAdapter: adapter, observeCaseWindow: record("observe"), onIntakeNextAction: record("focus"),
      notebookItems: [], discoveredEvidence: [{ id: "clue" }], theory: { ...baseInput.theory, evidenceIds: [] },
      submitTheory: record("submitTheory"), selectedCharacterId: "selected-witness", selectedEvidenceId: "selected-clue", question: "My own question",
      gapCards: [], onGapSelect: record("gap"), focusSourceReview: record("focus-review"),
      runWithResolution: async (label, execute) => outcomes.push({ label, result: await execute() })
    });
    await run();
    assert.deepEqual(calls.map((item) => item.name), sample.expected, `${sample.kind} uses its existing adapter once through the shared dispatcher`);
    assert.equal(outcomes.length, 1, `${sample.kind} reports one result to the resolution owner`);
    if (sample.kind === "question" || sample.kind === "challenge") {
      assert.deepEqual(calls[0].args, ["selected-witness", sample.kind === "challenge" ? "selected-clue" : undefined, "My own question"], "the actual component preserves player-selected context and question text");
    }
  }
  assert.match(coreSource, /FinalDetectiveWorkspace/);
  assert.doesNotMatch(routeSource, /SourceReviewUnlockPanel|source-review-workbench/, "route audit no longer duplicates Source Review");
  assert.match(panelSource, /useFinalDetectiveWorkspace/);
  assert.match(panelSource, /testimonies=\{activeCase\?\.testimonies|testimonies/);
  for (const requestFree of [source, surfaceSource, deskSource, coreSource, routeSource, hookSource]) {
    assert.doesNotMatch(requestFree, /\/api\/|\bfetch\s*\(|\bpostJson\s*\(|\bpostV1\s*\(|localStorage|sessionStorage|indexedDB/);
  }
  assert.equal(source.split(/\r?\n/).length < 500, true, "workspace model stays below 500 lines");
  assert.equal(surfaceSource.split(/\r?\n/).length < 500, true, "workspace surface stays below 500 lines");

  const suspectSelection = JSON.parse(execFileSync(process.execPath, ["scripts/run-cinematic-suspect-selection-tests.mjs"], { cwd: root, encoding: "utf8" }));
  assert.equal(suspectSelection.ok, true, "clearing and deferred suspect changes preserve player intent");
  const actionLock = JSON.parse(execFileSync(process.execPath, ["scripts/run-cinematic-action-lock-tests.mjs"], { cwd: root, encoding: "utf8" }));
  assert.equal(actionLock.ok, true, "exclusive actions release their lock after success and failure");
  const spatialTransfer = JSON.parse(execFileSync(process.execPath, ["scripts/run-cinematic-spatial-transfer-tests.mjs"], { cwd: root, encoding: "utf8" }));
  assert.equal(spatialTransfer.ok, true, "spatial transfer cancels and cleans up without owning selection");
  console.log(JSON.stringify({
    ok: true,
    suite: "final-detective-workspace",
    suspectSelectionChecks: suspectSelection.checks,
    actionLockChecks: actionLock.checks.length,
    spatialTransferChecks: spatialTransfer.checks.length,
    checks: ["stage-projection", "single-next-action", "evidence-provenance", "testimony-contradiction", "theory-readiness", "recovery", "source-review", "determinism", "input-non-mutation", "public-safe", "single-primary-action", "shared-adapter", "request-free", "source-budgets"]
  }));
} finally {
  await fs.rm(artifact, { force: true });
}
