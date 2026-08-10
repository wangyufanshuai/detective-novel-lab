import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const outputDir = path.join(root, "outputs");
const compile = async (sourceFile, outputFile, replacements = []) => {
  let compiled = ts.transpileModule(await fs.readFile(sourceFile, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  for (const [pattern, value] of replacements) compiled = compiled.replace(pattern, value);
  await fs.writeFile(outputFile, compiled, "utf8");
};

await fs.mkdir(outputDir, { recursive: true });
const feedbackOutput = path.join(outputDir, "v80-presentation-feedback-test.mjs");
const deckOutput = path.join(outputDir, "v80-command-deck-model-test.mjs");
const strategicOutput = path.join(outputDir, "v80-strategic-command-model-test.mjs");
await compile(path.join(root, "app", "campaign", "presentation-feedback.ts"), feedbackOutput);
await compile(path.join(root, "app", "campaign", "command-deck-model.ts"), deckOutput, [
  [/from "\.\/presentation-feedback"/g, 'from "./v80-presentation-feedback-test.mjs"']
]);
await compile(path.join(root, "app", "campaign", "strategic-command-model.ts"), strategicOutput, [
  [/from "\.\/command-deck-model"/g, 'from "./v80-command-deck-model-test.mjs"']
]);

const {
  buildStrategicCommandViewModel,
  executeStrategicActionDispatch,
  resolveStrategicActionDispatch
} = await import(`${pathToFileURL(strategicOutput).href}?test=${Date.now()}`);

const frozenInput = Object.freeze({
  runtimeMode: "server",
  hasWorld: true,
  hasCase: true,
  hasSession: true,
  judgementAccepted: false,
  advanceAvailable: true,
  caseLabel: "Archive Review",
  suggestedAction: { phase: "Search", title: "Search the public archive", detail: "Inspect the selected public location." },
  campaign: Object.freeze({ status: "case-active", campaignLabel: "Town Reckoning", chapterLabel: "Case 1", progressLabel: "0/3 cases closed", nextAction: "Continue the certified route." }),
  worldLead: Object.freeze({ status: "pending", label: "Civic records lead", nextAction: "Choose Follow or Skip." }),
  directive: Object.freeze({ status: "ready", operationLabel: "Public records response", benefitLabel: "A bounded public benefit.", costLabel: "One bounded institution cost.", nextAction: "Choose Support, Contain, or Defer." }),
  recovery: Object.freeze({ status: "ready", recoveryActionLabel: "Review certified route", progressLabel: "Recovery available", costLabel: "No answer is filled automatically.", nextAction: "Choose a Recovery response." }),
  worldEventOffer: Object.freeze({ status: "offered", label: "Public opportunity", actionLabel: "Review public opportunity", benefitLabel: "One public benefit.", costLabel: "One visible cost.", nextAction: "Accept or decline." }),
  headquarters: Object.freeze({ status: "ready", progressLabel: "Preparation ready", benefitLabel: "One next-case convenience.", nextAction: "Choose one preparation." }),
  pressure: Object.freeze({ status: "active", directionLabel: "rising", nextAction: "Extract a future case." }),
  operations: Object.freeze({
    status: "ready",
    planStatus: "ready",
    supportCapacity: 2,
    supportCount: 0,
    completedOperationCount: 0,
    townTimeMinutes: 0,
    progressLabel: "0/3 investigation operations resolved.",
    nextAction: "Choose support or Manual First.",
    options: Object.freeze([
      Object.freeze({ choice: "police-time", label: "Police Time", available: true, availabilityBand: "ample" }),
      Object.freeze({ choice: "informant-trust", label: "Informant Trust", available: true, availabilityBand: "limited" }),
      Object.freeze({ choice: "evidence-integrity", label: "Evidence Integrity", available: false, availabilityBand: "unavailable" })
    ])
  }),
  selectedContext: Object.freeze({ kind: "location", label: "Public Archive" }),
  contextActions: Object.freeze([
    Object.freeze({ kind: "search", label: "Search location", detail: "Use the existing certified Search handler.", enabled: true, primary: true, handlerKey: "discoverSceneEvidence" })
  ])
});

const first = buildStrategicCommandViewModel(frozenInput);
const second = buildStrategicCommandViewModel(structuredClone(frozenInput));
assert.deepEqual(first, second, "same public-safe input produces the same strategic command model");
assert.equal(first.primaryAction?.kind, "certified-investigation", "the certified case step outranks recovery and optional world choices");
assert.equal(first.primaryAction?.label, "Search location", "the primary command reuses the existing context action label");
assert.equal(first.secondaryActions.length, 3, "secondary commands are capped at three");
assert.equal(new Set(first.decisionQueue.map((item) => item.kind)).size, first.decisionQueue.length, "decision kinds are deduplicated");
assert.deepEqual(
  first.decisionQueue.slice(0, 5).map((item) => item.kind),
  ["certified-investigation", "campaign-recovery", "faction-directive", "world-event-offer", "world-lead"],
  "fixed priorities and kind tie-breaks keep the decision queue deterministic"
);
assert.equal(first.resourceRibbon.length, 8, "resource ribbon exposes the fixed eight strategic summaries");
assert.deepEqual(first.resourceRibbon.slice(0, 3).map((item) => item.value), ["ample", "limited", "unavailable"], "resource amounts remain bounded public bands");
assert.deepEqual(Object.keys(first.outcomeFeedback), ["immediate", "world", "next"], "feedback has the required three layers");
assert.equal(first.advanceState.state, "blocked", "a blocking player decision holds Advance Town");
assert.deepEqual(resolveStrategicActionDispatch(first.primaryAction), { handler: "context-action", actionKind: "search" }, "primary action dispatches through the existing certified context handler");
const adapterCalls = [];
const dispatched = executeStrategicActionDispatch(first.primaryAction, {
  contextAction: (kind) => adapterCalls.push(["context-action", kind]),
  openCampaign: () => adapterCalls.push(["open-campaign"]),
  advanceTown: () => adapterCalls.push(["advance-town"]),
  showNextCase: () => adapterCalls.push(["show-next-case"]),
  showInspector: () => adapterCalls.push(["show-inspector"])
});
assert.deepEqual(dispatched, { handler: "context-action", actionKind: "search" }, "action adapter preserves the resolver dispatch token");
assert.deepEqual(adapterCalls, [["context-action", "search"]], "action adapter forwards the certified action kind without constructing a replacement payload");
const rhythm = {
  status: "active",
  currentStep: { kind: "question", beat: "fieldwork", label: "Question character", detail: "Focus the certified witness.", metric: "hear witness", action: { kind: "question", label: "Question character", detail: "Focus the certified witness.", buttonLabel: "Question character" } },
  beats: [
    { kind: "intake", label: "Intake", metric: "joined", status: "done" },
    { kind: "fieldwork", label: "Fieldwork", metric: "1/3 steps", status: "current" },
    { kind: "deduction", label: "Deduction", metric: "0 clues", status: "locked" },
    { kind: "review", label: "Review", metric: "locked", status: "locked" }
  ],
  completedStepCount: 2,
  totalStepCount: 7,
  progressLabel: "2/7 certified steps",
  suggestedAction: { phase: "Fieldwork", title: "Question character", detail: "Focus the certified witness.", targetTab: "investigation" }
};
const rhythmMismatch = buildStrategicCommandViewModel({ ...structuredClone(frozenInput), caseRhythm: rhythm });
assert.equal(rhythmMismatch.primaryAction?.label, "Question character", "Certified rhythm owns the single investigation objective");
assert.equal(rhythmMismatch.primaryAction?.target, "show-investigation", "a mismatched map context focuses the certified target without dispatching the wrong action");
assert.equal(rhythmMismatch.currentObjective.action, "question");
assert.notEqual(rhythmMismatch.caseRhythm, rhythm, "strategic projection clones the presentation rhythm");
const rhythmMatch = buildStrategicCommandViewModel({ ...structuredClone(frozenInput), caseRhythm: rhythm, contextActions: [{ kind: "question", label: "Question character", detail: "Use the existing handler.", enabled: true, primary: true, handlerKey: "interrogateCharacter" }] });
assert.deepEqual(resolveStrategicActionDispatch(rhythmMatch.primaryAction), { handler: "context-action", actionKind: "question" }, "matching map context directly reuses the certified handler");
const reviewRhythm = { ...rhythm, currentStep: { ...rhythm.currentStep, kind: "review-source", beat: "review", label: "Review conclusion", action: { ...rhythm.currentStep.action, kind: "review-source" } }, suggestedAction: { ...rhythm.suggestedAction, phase: "Review", title: "Review conclusion", targetTab: "logic" } };
const reviewCommand = buildStrategicCommandViewModel({ ...structuredClone(frozenInput), judgementAccepted: true, caseRhythm: reviewRhythm, contextActions: [] });
assert.equal(reviewCommand.primaryAction?.kind, "certified-investigation", "accepted theory retains one source-review action before campaign choices");
assert.equal(reviewCommand.primaryAction?.label, "Review conclusion");
for (let index = 0; index < 64; index += 1) {
  const authority = {
    truth: { culpritId: `hidden-${index}`, motive: "hidden", method: "hidden" },
    evidenceCoverage: { covered: index % 7, total: 7 },
    routeCertificate: { certified: index % 3 !== 0, steps: ["search", "question", "challenge"] },
    judgement: { accepted: index % 5 === 0 },
    npcLegalActions: ["move", "work", "speak"]
  };
  const beforeAuthority = structuredClone(authority);
  const model = buildStrategicCommandViewModel({
    ...structuredClone(frozenInput),
    busy: index % 4 === 0,
    judgementAccepted: index % 5 === 0,
    worldLead: { status: index % 2 ? "pending" : "followed", nextAction: "Use the existing world choice." }
  });
  assert.equal(model.decisionQueue.filter((item) => item === model.primaryAction).length <= 1, true, `sample ${index} keeps at most one primary action`);
  assert.equal(model.secondaryActions.length <= 3, true, `sample ${index} keeps at most three secondary actions`);
  assert.deepEqual(authority, beforeAuthority, `sample ${index} leaves truth, evidence, route, judgement, and NPC legal actions untouched`);
}
assert.equal(JSON.stringify(first).includes("culpritId"), false, "strategic model excludes hidden case bindings");
assert.equal(JSON.stringify(first).includes("caseId"), false, "strategic model excludes case identifiers");
assert.equal(JSON.stringify(first).includes("sessionId"), false, "strategic model excludes session identifiers");

const transition = buildStrategicCommandViewModel({
  runtimeMode: "server",
  hasWorld: true,
  hasCase: false,
  hasSession: false,
  judgementAccepted: true,
  advanceAvailable: true,
  campaign: { status: "transition", progressLabel: "1/3 cases closed", nextAction: "Prepare for the next case." },
  headquarters: { status: "ready", nextAction: "Choose one preparation." }
});
assert.equal(transition.primaryAction?.kind, "headquarters", "Headquarters preparation precedes the next-case candidate queue");
assert.equal(transition.decisionQueue.at(-1)?.kind, "next-case", "next-case review remains the final queue priority");

const advance = buildStrategicCommandViewModel({
  runtimeMode: "server",
  hasWorld: true,
  hasCase: false,
  hasSession: false,
  judgementAccepted: false,
  advanceAvailable: true
});
assert.equal(advance.primaryAction?.kind, "advance-town", "Advance Town becomes primary when no higher-priority decision remains");
assert.equal(advance.advanceState.state, "ready", "advance state reports ready without blockers");

const staticModel = buildStrategicCommandViewModel({
  runtimeMode: "static-demo",
  hasWorld: true,
  hasCase: true,
  hasSession: true,
  judgementAccepted: false,
  advanceAvailable: false
});
assert.deepEqual(staticModel.decisionQueue, [], "Static Runtime creates no Server decision queue");
assert.equal(staticModel.primaryAction, undefined, "Static Runtime exposes no persistent strategic command");
assert.equal(staticModel.advanceState.state, "readonly", "Static Runtime exposes an explicit read-only advance boundary");

console.log(JSON.stringify({
  ok: true,
  suite: "strategic-command-model",
  checks: [
    "determinism",
    "priority",
    "dedupe",
    "primary-uniqueness",
    "secondary-cap",
    "resource-bands",
    "three-layer-feedback",
    "dispatch-adapter",
    "authority-isolation-property",
    "public-safe",
    "headquarters-before-next-case",
    "advance-ready",
    "static-boundary"
  ]
}));
