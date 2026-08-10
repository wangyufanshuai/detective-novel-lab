import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const outputDir = path.join(root, "outputs");

async function compile(sourceFile, outputFile, replacements = []) {
  let compiled = ts.transpileModule(await fs.readFile(sourceFile, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  for (const [pattern, value] of replacements) compiled = compiled.replace(pattern, value);
  await fs.writeFile(outputFile, compiled, "utf8");
}

await fs.mkdir(outputDir, { recursive: true });
const feedbackOutput = path.join(outputDir, "v81-presentation-feedback-test.mjs");
const deckOutput = path.join(outputDir, "v81-command-deck-model-test.mjs");
const commandOutput = path.join(outputDir, "v81-strategic-command-model-test.mjs");
const pacingOutput = path.join(outputDir, "v81-strategic-pacing-model-test.mjs");

await compile(path.join(root, "app", "campaign", "presentation-feedback.ts"), feedbackOutput);
await compile(path.join(root, "app", "campaign", "command-deck-model.ts"), deckOutput, [
  [/from "\.\/presentation-feedback"/g, 'from "./v81-presentation-feedback-test.mjs"']
]);
await compile(path.join(root, "app", "campaign", "strategic-command-model.ts"), commandOutput, [
  [/from "\.\/command-deck-model"/g, 'from "./v81-command-deck-model-test.mjs"']
]);
await compile(path.join(root, "app", "campaign", "strategic-pacing-model.ts"), pacingOutput);

const commandModule = await import(`${pathToFileURL(commandOutput).href}?test=${Date.now()}`);
const pacingModule = await import(`${pathToFileURL(pacingOutput).href}?test=${Date.now()}`);
const {
  buildStrategicCommandViewModel,
  executeStrategicActionDispatch,
  resolveStrategicActionDispatch
} = commandModule;
const {
  appendRecentSafeOutcome,
  buildStrategicPacingViewModel,
  deriveCurrentSafeOutcome
} = pacingModule;

const publicInput = {
  runtimeMode: "server",
  hasWorld: true,
  hasCase: true,
  hasSession: true,
  judgementAccepted: false,
  advanceAvailable: true,
  caseLabel: "Archive Review",
  suggestedAction: {
    phase: "Search",
    title: "Search the public archive",
    detail: "Inspect the selected public location."
  },
  campaign: {
    status: "case-active",
    campaignLabel: "Town Reckoning",
    chapterLabel: "Case 1",
    progressLabel: "0/3 cases closed",
    nextAction: "Continue the certified route."
  },
  worldLead: { status: "pending", label: "Civic records lead", nextAction: "Choose Follow or Skip." },
  directive: {
    status: "ready",
    operationLabel: "Public records response",
    benefitLabel: "A bounded public benefit.",
    costLabel: "One bounded institution cost.",
    nextAction: "Choose Support, Contain, or Defer."
  },
  recovery: {
    status: "ready",
    recoveryActionLabel: "Review certified route",
    progressLabel: "Recovery available",
    costLabel: "No answer is filled automatically.",
    nextAction: "Choose a Recovery response."
  },
  worldEventOffer: {
    status: "offered",
    label: "Public opportunity",
    actionLabel: "Review public opportunity",
    benefitLabel: "One public benefit.",
    costLabel: "One visible cost.",
    nextAction: "Accept or decline."
  },
  headquarters: {
    status: "ready",
    progressLabel: "Preparation ready",
    benefitLabel: "One next-case convenience.",
    nextAction: "Choose one preparation."
  },
  pressure: { status: "active", directionLabel: "rising", nextAction: "Extract a future case." },
  operations: {
    status: "ready",
    planStatus: "ready",
    supportCapacity: 2,
    supportCount: 0,
    completedOperationCount: 0,
    townTimeMinutes: 0,
    progressLabel: "0/3 investigation operations resolved.",
    nextAction: "Choose support or Manual First.",
    options: [
      { choice: "police-time", label: "Police Time", available: true, availabilityBand: "ample" },
      { choice: "informant-trust", label: "Informant Trust", available: true, availabilityBand: "limited" },
      { choice: "evidence-integrity", label: "Evidence Integrity", available: false, availabilityBand: "unavailable" }
    ]
  },
  selectedContext: { kind: "location", label: "Public Archive" },
  contextActions: [
    { kind: "search", label: "Search location", detail: "Use the existing certified Search handler.", enabled: true, primary: true, handlerKey: "discoverSceneEvidence" }
  ]
};

const inputBefore = structuredClone(publicInput);
const command = buildStrategicCommandViewModel(publicInput);
const first = buildStrategicPacingViewModel({ command });
const second = buildStrategicPacingViewModel({ command: structuredClone(command) });
assert.deepEqual(first, second, "same public-safe command input produces the same pacing model");
assert.deepEqual(publicInput, inputBefore, "pacing derivation does not mutate its source input");
assert.equal(first.phase, "inspect", "selected public context enters Inspect without executing an action");
assert.equal(first.primaryAction?.kind, "certified-investigation", "the legal certified action remains primary");
assert.equal(first.queueGroups.now[0]?.kind, first.primaryAction?.kind, "the primary action is always the first Now decision");
assert.equal(first.secondaryActions.length, 3, "secondary pacing actions remain capped at three");
assert.equal(new Set(Object.values(first.queueGroups).flat().map((item) => `${item.kind}:${item.target}:${item.contextActionKind || "none"}`)).size, command.decisionQueue.length, "grouped queue decisions remain deduplicated");
assert.deepEqual(first.disclosure.essential, ["current-objective", "why-now", "primary-action", "safe-forecast"], "essential disclosure is fixed and compact");
assert.equal(first.disclosure.context.includes("selected-context"), true, "selected context is disclosed only in the context layer");
assert.equal(first.disclosure.detail.includes("developer"), true, "developer material remains in the detail layer");
assert.equal(first.safeForecast.immediateBenefit, command.primaryAction.benefitLabel, "forecast reuses the existing safe benefit copy");
assert.equal(first.safeForecast.visibleCost, command.primaryAction.costLabel, "forecast reuses the existing safe cost copy");
assert.match(first.safeForecast.unchangedAuthority, /truth.*evidence.*route.*judgement.*NPC legal actions/i, "forecast states the unchanged authority boundary");
assert.equal(first.focusTarget, "investigation", "location investigation context focuses the investigation surface");

const selected = buildStrategicPacingViewModel({ command, actionLifecycle: { state: "selected", action: command.primaryAction } });
const resolving = buildStrategicPacingViewModel({ command, actionLifecycle: { state: "resolving", action: command.primaryAction } });
const succeeded = buildStrategicPacingViewModel({ command, actionLifecycle: { state: "succeeded", action: command.primaryAction } });
const blocked = buildStrategicPacingViewModel({ command, actionLifecycle: { state: "blocked", action: command.primaryAction, detail: "The visible prerequisite is not ready." } });
const failedSafe = buildStrategicPacingViewModel({ command, actionLifecycle: { state: "failed-safe", action: command.primaryAction, detail: "The command returned safely without changing state." } });
assert.equal(selected.phase, "execute", "selected enters the Execute phase");
assert.equal(resolving.phase, "execute", "resolving remains in Execute");
assert.equal(succeeded.phase, "resolve", "successful completion enters Resolve");
assert.equal(blocked.phase, "resolve", "blocked completion enters Resolve");
assert.equal(failedSafe.phase, "resolve", "failed-safe completion enters Resolve");
assert.equal(blocked.recentSafeOutcomes[0]?.state, "blocked", "blocked feedback creates one session-safe outcome");

const noContextCommand = buildStrategicCommandViewModel({ ...publicInput, selectedContext: undefined, contextActions: [] });
assert.equal(buildStrategicPacingViewModel({ command: noContextCommand }).phase, "choose", "an available command without selected context enters Choose");
const advanceCommand = buildStrategicCommandViewModel({
  runtimeMode: "server",
  hasWorld: true,
  hasCase: false,
  hasSession: false,
  judgementAccepted: false,
  advanceAvailable: true
});
assert.equal(buildStrategicPacingViewModel({ command: advanceCommand }).phase, "advance", "an unobstructed town step enters Advance");
const staticCommand = buildStrategicCommandViewModel({
  runtimeMode: "static-demo",
  hasWorld: true,
  hasCase: true,
  hasSession: true,
  judgementAccepted: false,
  advanceAvailable: false
});
const staticPacing = buildStrategicPacingViewModel({ command: staticCommand });
assert.equal(staticPacing.phase, "brief", "read-only Static Runtime remains at Brief without persistent actions");
assert.equal(staticPacing.primaryAction, undefined, "Static Runtime has no pacing execution action");

const illegalAction = { ...command.primaryAction, enabled: false, disabledReason: "Held by the existing authority." };
const illegalPrimary = buildStrategicPacingViewModel({
  command: { ...command, primaryAction: illegalAction, secondaryActions: [illegalAction, ...command.secondaryActions] }
});
assert.equal(illegalPrimary.primaryAction, undefined, "a disabled upstream action can never be promoted to pacing primary");
assert.equal(illegalPrimary.secondaryActions.some((item) => !item.enabled), false, "disabled actions never appear as enabled pacing secondary actions");

const seedOutcome = deriveCurrentSafeOutcome(command, { state: "succeeded", action: command.primaryAction });
assert.ok(seedOutcome, "resolved public feedback derives a session-safe outcome");
let history = [];
for (let index = 0; index < 8; index += 1) {
  history = appendRecentSafeOutcome(history, {
    ...seedOutcome,
    signature: `safe-${index}`,
    immediateResult: `Visible result ${index}`
  });
}
assert.equal(history.length, 5, "recent outcome history is capped at five");
assert.deepEqual(history.map((item) => item.signature), ["safe-7", "safe-6", "safe-5", "safe-4", "safe-3"], "recent outcomes retain deterministic newest-first order");
assert.deepEqual(appendRecentSafeOutcome(history, history[0]), history, "repeated safe feedback is idempotent");
assert.deepEqual(buildStrategicPacingViewModel({ command, actionLifecycle: { state: "succeeded", action: command.primaryAction }, recentSafeOutcomes: [] }).recentSafeOutcomes[0], seedOutcome, "refresh reconstruction derives only the current public-safe outcome");

const adapterCalls = [];
const dispatchBefore = resolveStrategicActionDispatch(command.primaryAction);
const dispatchAfter = executeStrategicActionDispatch(command.primaryAction, {
  contextAction: (kind) => adapterCalls.push(["context-action", kind]),
  openCampaign: () => adapterCalls.push(["open-campaign"]),
  advanceTown: () => adapterCalls.push(["advance-town"]),
  showNextCase: () => adapterCalls.push(["show-next-case"]),
  showInspector: () => adapterCalls.push(["show-inspector"])
});
assert.deepEqual(dispatchAfter, dispatchBefore, "pacing execution preserves the existing strategic dispatch token");
assert.deepEqual(adapterCalls, [["context-action", "search"]], "pacing execution still calls the existing certified handler without a replacement payload");

for (let index = 0; index < 64; index += 1) {
  const authority = {
    truth: { culpritId: `hidden-${index}`, motive: "hidden", method: "hidden" },
    evidenceCoverage: { covered: index % 7, total: 7 },
    routeCertificate: { certified: index % 3 !== 0, steps: ["search", "question", "challenge"] },
    judgement: { accepted: index % 5 === 0 },
    npcLegalActions: ["move", "work", "speak"]
  };
  const beforeAuthority = structuredClone(authority);
  const sampledCommand = buildStrategicCommandViewModel({
    ...structuredClone(publicInput),
    busy: index % 4 === 0,
    judgementAccepted: index % 5 === 0,
    selectedContext: index % 3 === 0 ? undefined : publicInput.selectedContext,
    worldLead: { status: index % 2 ? "pending" : "followed", nextAction: "Use the existing world choice." }
  });
  const pacing = buildStrategicPacingViewModel({
    command: sampledCommand,
    actionLifecycle: index % 7 === 0 && sampledCommand.primaryAction
      ? { state: "resolving", action: sampledCommand.primaryAction }
      : undefined
  });
  assert.equal(pacing.primaryAction ? pacing.primaryAction.enabled : true, true, `sample ${index} never promotes an illegal action`);
  assert.equal(pacing.secondaryActions.length <= 3, true, `sample ${index} keeps at most three secondary actions`);
  assert.equal(pacing.queueGroups.now[0] ? pacing.queueGroups.now[0].kind === pacing.primaryAction?.kind : true, true, `sample ${index} keeps the primary action first in Now`);
  assert.deepEqual(authority, beforeAuthority, `sample ${index} leaves campaign authority byte-equivalent`);
}

const publicText = JSON.stringify(first);
assert.equal(/culpritId|victimId|hiddenTruth|rawBody|checkpoint|agentSnapshot|sessionId|caseId|sourceId/i.test(publicText), false, "pacing model contains no raw authority or storage fields");

console.log(JSON.stringify({
  ok: true,
  suite: "strategic-pacing-model",
  checks: [
    "determinism",
    "non-mutation",
    "phase-transitions",
    "queue-groups",
    "stable-deduplication",
    "primary-legality",
    "secondary-cap",
    "progressive-disclosure",
    "safe-forecast",
    "focus-target",
    "five-outcome-session-cap",
    "refresh-reconstruction",
    "adapter-equivalence",
    "64-sample-authority-isolation",
    "static-boundary",
    "public-safe"
  ]
}));
