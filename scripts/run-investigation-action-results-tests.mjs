import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

// Run the actual hooks with a small deterministic React hook host. Network and
// controller boundaries are controlled; request/result logic is never copied.
let rendering;
const changed = (before, after) => !before || !after || before.length !== after.length || before.some((value, index) => !Object.is(value, after[index]));
const react = {
  useRef(initial) {
    const host = rendering;
    const index = host.cursor++;
    host.slots[index] ??= { current: initial };
    return host.slots[index];
  },
  useState(initial) {
    const host = rendering;
    const index = host.cursor++;
    if (!host.slots[index]) {
      const slot = { value: typeof initial === "function" ? initial() : initial };
      slot.set = (next) => {
        const value = typeof next === "function" ? next(slot.value) : next;
        if (!Object.is(value, slot.value)) { slot.value = value; host.dirty = true; }
      };
      host.slots[index] = slot;
    }
    return [host.slots[index].value, host.slots[index].set];
  },
  useMemo(factory, dependencies) {
    const host = rendering;
    const index = host.cursor++;
    if (changed(host.slots[index]?.dependencies, dependencies)) host.slots[index] = { value: factory(), dependencies };
    return host.slots[index].value;
  },
  useCallback(callback, dependencies) { return react.useMemo(() => callback, dependencies); },
  useEffect(effect, dependencies) {
    const host = rendering;
    const index = host.cursor++;
    if (!changed(host.slots[index]?.dependencies, dependencies)) return;
    host.effects.push(() => {
      host.slots[index]?.cleanup?.();
      host.slots[index] = { dependencies, cleanup: effect() };
    });
  }
};
react.useLayoutEffect = react.useEffect;

function hookHost(hook) {
  const host = { slots: [], effects: [], cursor: 0, dirty: false };
  return {
    render(input) {
      let result;
      for (let pass = 0; pass < 30; pass += 1) {
        host.cursor = 0; host.dirty = false; rendering = host;
        result = hook(input); rendering = undefined;
        for (const effect of host.effects.splice(0)) effect();
        if (!host.dirty) return result;
      }
      throw new Error("Hook host did not stabilize");
    },
    unmount() { for (const slot of host.slots) slot?.cleanup?.(); }
  };
}

const requests = [];
const replies = [];
const engine = {};
const modules = new Map();
function loadActual(relative) {
  const file = path.resolve(relative);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const source = fs.readFileSync(file, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  new Function("require", "module", "exports", output)((name) => {
    if (name === "react") return react;
    if (name === "@/app/localization/locale-context") return { useAppLocale: () => ({ t: (key) => key }) };
    if (name === "@/app/lib/client-runtime") return {
      apiUrl: (url) => url,
      postJson: (url, body) => {
        requests.push({ url, body });
        const reply = replies.shift();
        if (!reply) throw new Error("Unexpected test request");
        return reply();
      }
    };
    if (name === "@/lib/engine") return engine;
    return loadActual(name.startsWith("@/") ? `${name.slice(2)}.ts` : path.join(path.dirname(file), `${name}.ts`));
  }, module, module.exports);
  return module.exports;
}

const { useCertifiedInvestigationActions } = loadActual("app/hooks/useCertifiedInvestigationActions.ts");
const { useTheorySubmissionActions } = loadActual("app/hooks/useTheorySubmissionActions.ts");
const { useStrategicPacing } = loadActual("app/hooks/useStrategicPacing.ts");
const { buildCampaignResolutionLedger } = loadActual("app/campaign/campaign-resolution-ledger-model.ts");
const { deriveCampaignBeatPresentation } = loadActual("app/campaign/campaign-transition-model.ts");
const { deriveCurrentSafeOutcome, appendRecentSafeOutcome } = loadActual("app/campaign/strategic-pacing-model.ts");
engine.isPlayerTheoryInput = loadActual("packages/engine/src/theory-proof.ts").isPlayerTheoryInput;

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const sessionFor = (suffix = "a") => ({ id: `session-${suffix}`, worldId: `world-${suffix}`, caseId: `case-${suffix}`, discoveredEvidenceIds: [], interrogationLog: [] });
function fixture(joined = true) {
  const writes = [];
  const investigation = {
    world: { id: "world-a" }, activeCase: { id: "case-a" }, session: joined ? sessionFor() : null,
    runtimeMode: "server", playerName: "Test investigator", selectedCharacterId: "witness", selectedEvidenceId: "", question: "What did you see?",
    theory: { culpritId: "suspect", motive: "", method: "", evidenceIds: [] },
    progress: { joinedInvestigation: joined }, sessions: []
  };
  for (const name of ["Session", "Sessions", "Busy", "Progress", "SelectedEvidenceId", "SelectedSceneId", "InspectorTab", "LastAiSafety", "ActiveCase", "Theory", "Status", "RevealText"]) {
    const key = `${name[0].toLowerCase()}${name.slice(1)}`;
    investigation[`set${name}`] = (value) => {
      investigation[key] = typeof value === "function" ? value(investigation[key]) : value;
      writes.push([name, investigation[key]]);
    };
  }
  investigation.pushToast = (toast) => writes.push(["Toast", toast]);
  const campaign = new Proxy({}, { get: (_, name) => (value) => writes.push([String(name), value]) });
  const deductionCase = {
    characters: [{ id: "witness" }],
    evidence: [{ id: "clue", title: "A public clue", discoverable: true }, { id: "hidden", title: "Hidden clue", discoverable: false }]
  };
  const common = {
    investigation, campaign, deductionCase, scenes: [{ id: "scene", evidenceIds: ["clue"] }],
    discoveredEvidenceCount: 0, selectedNpcMemoryCount: 0,
    campaignStudy: { recordMeaningfulAction: () => writes.push(["meaningful"]) },
    appendJournal: (entry) => writes.push(["journal", entry]), highlightSelection: (value) => writes.push(["highlight", value]),
    persist: (...value) => writes.push(["persist", value]), currentStaticState: () => null, hydrateStatic: (value) => writes.push(["hydrate", value]),
    replay: {}, refreshTownRuntime: () => { throw new Error("No unscoped refresh during submission"); },
    recordTheoryResult: (accepted) => writes.push(["theoryResult", accepted]), recordMeaningfulAction: () => writes.push(["meaningful"])
  };
  const actionHost = hookHost(useCertifiedInvestigationActions);
  const theoryHost = hookHost(useTheorySubmissionActions);
  const render = () => ({ actions: actionHost.render(common), theory: theoryHost.render(common) });
  return { common, investigation, writes, render, unmount: () => { actionHost.unmount(); theoryHost.unmount(); } };
}

// Missing prerequisites and optimistic Join must not claim success.
const joining = fixture(false);
let current = joining.render();
assert.equal((await current.actions.discoverEvidence("clue")).status, "blocked");
const joinReply = deferred(); replies.push(() => joinReply.promise);
const joinTask = current.actions.joinCase();
assert.equal(joining.investigation.session, null, "pending join does not fabricate a session");
assert.equal(joining.investigation.progress.joinedInvestigation, false);
assert.equal((await current.actions.joinCase()).status, "blocked");
joinReply.resolve({ session: sessionFor() });
assert.equal((await joinTask).status, "succeeded");
assert.equal(joining.investigation.progress.joinedInvestigation, true);
current = joining.render();
assert.equal((await current.actions.joinCase()).status, "blocked", "joining an existing session is not a new settlement");
joining.unmount();

const searching = fixture(); current = searching.render();
replies.push(() => Promise.reject(new Error("SECRET_INTERNAL_PATH")));
assert.deepEqual(await current.actions.discoverEvidence("clue"), { status: "failed", detail: "error.search" });
assert.equal(searching.writes.some(([kind]) => kind === "Toast"), false, "failed request does not publish a success toast");
assert.equal(JSON.stringify(searching.writes).includes("SECRET_INTERNAL_PATH"), false);
replies.push(() => Promise.resolve({ session: sessionFor() }));
assert.equal((await current.actions.discoverEvidence("clue")).status, "rejected", "fulfilled response without the clue is not successful");
replies.push(() => Promise.resolve({ session: { ...sessionFor(), discoveredEvidenceIds: ["clue"] } }));
assert.equal((await current.actions.discoverEvidence("clue")).status, "succeeded");
current = searching.render();
assert.equal((await current.actions.discoverEvidence("clue")).status, "blocked");
assert.equal((await current.actions.discoverFirstSceneEvidence("scene")).status, "blocked");
assert.equal((await current.actions.runInterrogationTarget("witness", "hidden", "Explain")).status, "blocked");
replies.push(() => Promise.resolve({ session: searching.investigation.session, entry: { id: "entry" }, testimonyUpdated: false }));
assert.equal((await current.actions.runInterrogationTarget("witness", "clue", "Explain")).status, "rejected", "a non-contradictory challenge is a business rejection");
searching.investigation.theory = { ...searching.investigation.theory, evidenceIds: ["clue"], proof: { motiveEvidenceIds: ["clue"], methodEvidenceIds: ["clue"] } };
searching.render().actions.toggleTheoryEvidence("clue");
assert.deepEqual(searching.investigation.theory.proof, { motiveEvidenceIds: [], methodEvidenceIds: [] });
searching.unmount();

// Two adapters share one lock, and an old request cannot release a new lock.
for (const suffix of ["case", "world", "session"]) {
  const switched = fixture(); current = switched.render();
  const oldReply = deferred(); replies.push(() => oldReply.promise);
  const oldTask = current.actions.discoverEvidence("clue");
  assert.equal((await current.theory.submitTheory()).status, "blocked", "search locks theory submission too");
  if (suffix === "case") { switched.investigation.activeCase = { id: "case-b" }; switched.investigation.session = { ...sessionFor(), id: "session-b", caseId: "case-b" }; }
  if (suffix === "world") { switched.investigation.world = { id: "world-b" }; switched.investigation.session = { ...sessionFor(), id: "session-b", worldId: "world-b" }; }
  if (suffix === "session") switched.investigation.session = { ...sessionFor(), id: "session-b" };
  current = switched.render();
  const newReply = deferred(); replies.push(() => newReply.promise);
  const newTask = current.actions.discoverEvidence("clue");
  const before = switched.writes.length;
  oldReply.resolve({ session: { ...sessionFor(), discoveredEvidenceIds: ["clue"] } });
  assert.equal((await oldTask).status, "cancelled");
  assert.equal(switched.writes.length, before, `${suffix} switch: stale response and finally do not write`);
  assert.equal(switched.investigation.busy, true, "old finally does not release the new request");
  assert.equal((await current.theory.submitTheory()).status, "blocked");
  newReply.resolve({ session: { ...switched.investigation.session, discoveredEvidenceIds: ["clue"] } });
  assert.equal((await newTask).status, "succeeded");
  assert.equal(switched.investigation.busy, false);
  switched.unmount();
}

const removed = fixture(); current = removed.render();
const removedReply = deferred(); replies.push(() => removedReply.promise);
const removedTask = current.actions.discoverEvidence("clue");
removed.unmount(); const removedWrites = removed.writes.length;
removedReply.reject(new Error("late network failure"));
assert.equal((await removedTask).status, "cancelled");
assert.equal(removed.writes.length, removedWrites, "unmounted hook ignores late errors and finally");

// Joining creates a session, but switching the investigation before the join
// reply arrives must not resurrect the old investigation or its save pointer.
const staleJoin = fixture(false); current = staleJoin.render();
const staleJoinReply = deferred(); replies.push(() => staleJoinReply.promise);
const staleJoinTask = current.actions.joinCase();
staleJoin.investigation.world = { id: "world-b" }; staleJoin.investigation.activeCase = { id: "case-b" };
staleJoin.render(); const joinWrites = staleJoin.writes.length;
staleJoinReply.resolve({ session: sessionFor() });
assert.equal((await staleJoinTask).status, "cancelled");
assert.equal(staleJoin.writes.length, joinWrites);
assert.equal(staleJoin.investigation.session, null);
staleJoin.unmount();

const staleQuestion = fixture(); staleQuestion.investigation.session.discoveredEvidenceIds = ["clue"];
current = staleQuestion.render();
const caseReply = deferred();
const originalFetch = globalThis.fetch;
globalThis.fetch = () => caseReply.promise;
try {
  replies.push(() => Promise.resolve({ session: staleQuestion.investigation.session, entry: { id: "entry" }, testimonyUpdated: true }));
  const questionTask = current.actions.runInterrogationTarget("witness", "clue", "Explain");
  await Promise.resolve();
  staleQuestion.investigation.activeCase = { id: "case-b" }; staleQuestion.investigation.session = { ...sessionFor(), caseId: "case-b", id: "session-b" };
  staleQuestion.render(); const questionWrites = staleQuestion.writes.length;
  caseReply.resolve({ json: () => Promise.resolve({ ok: true, activeCase: { id: "case-a" } }) });
  assert.equal((await questionTask).status, "cancelled");
  assert.equal(staleQuestion.writes.length, questionWrites, "the follow-up testimony fetch cannot write into the next case");
} finally { globalThis.fetch = originalFetch; staleQuestion.unmount(); }

for (const actionKind of ["submit", "reveal"]) {
  const stale = fixture(); stale.investigation.session.judgement = { accepted: true };
  current = stale.render(); const reply = deferred(); replies.push(() => reply.promise);
  const task = actionKind === "submit" ? current.theory.submitTheory() : current.actions.revealSolution();
  stale.unmount(); const count = stale.writes.length;
  reply.resolve(actionKind === "submit" ? { session: sessionFor(), judgement: { accepted: true } } : { content: "An old answer" });
  assert.equal((await task).status, "cancelled");
  assert.equal(stale.writes.length, count, `${actionKind} result ignores unmount`);
}

for (const runtimeMode of ["server", "static-demo"]) {
  const malformed = fixture(); malformed.investigation.runtimeMode = runtimeMode;
  current = malformed.render();
  const beforeTheory = malformed.investigation.theory;
  assert.equal(await current.theory.submitCurrentTheory({ ...beforeTheory, proof: { motiveEvidenceIds: null, methodEvidenceIds: [] } }), null);
  assert.equal(malformed.investigation.theory, beforeTheory, `${runtimeMode}: malformed override does not enter visible theory`);
  assert.equal(malformed.writes.some(([kind]) => kind === "hydrate" || kind === "Session"), false);
  malformed.unmount();
}

const submitting = fixture(); current = submitting.render();
const judgement = { accepted: false, missing: ["motive"], contradictions: [], score: 30, explanation: "Incomplete evidence" };
replies.push(() => Promise.resolve({ session: sessionFor(), judgement }));
const rejected = await current.theory.submitTheory();
assert.equal(rejected.status, "rejected"); assert.deepEqual(rejected.judgement, judgement);
replies.push(() => Promise.resolve({ session: sessionFor(), judgement }));
assert.deepEqual(await current.theory.submitCurrentTheory(), judgement, "guided practice judgement contract remains compatible");
replies.push(() => Promise.reject(new Error("network failed")));
assert.equal((await current.theory.submitTheory()).status, "failed");
const accepted = { ...judgement, accepted: true };
replies.push(() => Promise.resolve({ session: sessionFor(), judgement: accepted }));
assert.equal((await current.theory.submitTheory()).status, "succeeded");
submitting.unmount();

const action = { kind: "certified-investigation", target: "context-action", contextActionKind: "join", label: "Join investigation", detail: "Start the case", benefitLabel: "Open investigation", costLabel: "No cost", priority: 1, enabled: true, blocking: false };
const command = {
  runtimeMode: "server", presentationFeedback: { state: "idle", signature: "idle", label: "Observe crime window", detail: "Ready" },
  currentObjective: { title: "Investigate", nextAction: "Observe next", progressLabel: "1/7" },
  campaignProgress: { chapterLabel: "Chapter", progressLabel: "1/3", nextAction: "Continue" },
  primaryAction: action, secondaryActions: [], decisionQueue: [action],
  advanceState: { state: "blocked", detail: "Finish investigating" },
  outcomeFeedback: { immediate: { label: "Observe next", detail: "Observation available" }, world: { detail: "No persistent world change" }, next: { detail: "Observe crime window" } },
  worldConsequenceTimeline: { state: "empty" }, investigationTurn: { turnNumber: 1 }
};
const pacingHost = hookHost(useStrategicPacing);
let pacing = pacingHost.render(command);
const pendingAction = deferred(); let executions = 0;
const task = pacing.runAction(action, () => { executions += 1; return pendingAction.promise; });
await Promise.resolve();
assert.equal(await pacing.runAction(action, () => { executions += 1; }), false);
assert.equal(executions, 1);
pendingAction.resolve({ status: "succeeded", detail: "Joined investigation" });
assert.equal(await task, true);
pacing = pacingHost.render({ ...command, presentationFeedback: { state: "resolving", signature: "busy-late", detail: "Old busy render" } });
assert.equal(pacing.actionLifecycle.state, "succeeded", "late busy feedback cannot overwrite a confirmed terminal result");
assert.equal(pacing.viewModel.phase, "resolve");
const beforeHistory = pacing.viewModel.recentSafeOutcomes.length;
pacing = pacingHost.render({ ...command, outcomeFeedback: { ...command.outcomeFeedback, next: { detail: "Next objective changed" } } });
assert.equal(pacing.viewModel.recentSafeOutcomes.length, beforeHistory, "one completed action creates one outcome despite later projections");
const brief = { nextAction: "Observe crime window", safeBoundary: "Public investigation results" };
const ledger = buildCampaignResolutionLedger({ command, commandBrief: brief, actionLifecycle: pacing.actionLifecycle, recentSafeOutcomes: pacing.viewModel.recentSafeOutcomes,
  guidedJournal: [{ id: "old", step: "search", label: "Old search result", status: "done", result: "Old clue", progressDelta: "Before Join", nextAction: "Old next action" }] });
assert.equal(ledger.latest.actionLabel, "Join investigation", "latest action keeps its own label and precedes old guided entries");
assert.equal(ledger.latest.chain.result, "Joined investigation");

const oldWorldSignal = {
  ...command,
  worldConsequenceTimeline: { state: "ready", headline: "An old world lead", summary: "A lead at the municipal archive already existed" },
  outcomeFeedback: { ...command.outcomeFeedback, world: { detail: "An old world lead at the municipal archive" } }
};
for (const contextActionKind of ["join", "observe", "search", "question", "challenge", "review"]) {
  const scopedAction = { ...action, contextActionKind, label: `Current ${contextActionKind}` };
  await pacing.runAction(scopedAction, () => ({ status: "succeeded", detail: `${contextActionKind} confirmed` }));
  pacing = pacingHost.render(oldWorldSignal);
  const noWorldLedger = buildCampaignResolutionLedger({ command: oldWorldSignal, commandBrief: brief, actionLifecycle: pacing.actionLifecycle,
    recentSafeOutcomes: pacing.viewModel.recentSafeOutcomes, transition: { kind: "world-choice-resolved", phase: "world-consequence", visible: true } });
  assert.equal(noWorldLedger.latest.chain.worldChange, "No persistent world change", `${contextActionKind} cannot claim an existing world lead`);
  assert.equal(noWorldLedger.entries[0].chain.worldChange, "No persistent world change");
  assert.equal(deriveCampaignBeatPresentation({ command: oldWorldSignal, lifecycle: pacing.actionLifecycle }).hasWorldConsequence, false);
}
for (const accepted of [false, true]) {
  const worldChange = accepted ? "The followed world lead was settled" : "A recovery action was prepared for the rejected theory";
  await pacing.runAction({ ...action, contextActionKind: "submit", label: "Submit theory" }, () => ({ status: accepted ? "succeeded" : "rejected", detail: "Theory judged", judgement: { accepted }, worldChange }));
  pacing = pacingHost.render(oldWorldSignal);
  const submissionLedger = buildCampaignResolutionLedger({ command: oldWorldSignal, commandBrief: brief, actionLifecycle: pacing.actionLifecycle, recentSafeOutcomes: pacing.viewModel.recentSafeOutcomes });
  assert.equal(submissionLedger.latest.chain.worldChange, worldChange, "submission displays only its response-confirmed effect");
  assert.equal(submissionLedger.entries[0].chain.worldChange, worldChange);
  const beat = deriveCampaignBeatPresentation({ command: oldWorldSignal, lifecycle: pacing.actionLifecycle, phase: "world-consequence" });
  assert.equal(beat.detail, worldChange); assert.equal(beat.hasWorldConsequence, true);
  assert.equal(beat.title.includes("old"), false);
}

for (const status of ["rejected", "blocked", "cancelled", "failed"]) {
  assert.equal(await pacing.runAction(action, () => ({ status, detail: `Controlled ${status}` })), false);
  pacing = pacingHost.render(command);
  assert.equal(pacing.actionLifecycle.state, status === "failed" ? "failed-safe" : status);
  const outcome = deriveCurrentSafeOutcome(command, pacing.actionLifecycle);
  const resultLedger = buildCampaignResolutionLedger({ command, commandBrief: brief, actionLifecycle: pacing.actionLifecycle, recentSafeOutcomes: [outcome] });
  assert.equal(resultLedger.status, status);
  const beat = deriveCampaignBeatPresentation({ command, lifecycle: pacing.actionLifecycle });
  assert.equal(beat.visible, true); assert.equal(beat.tone, "warning"); assert.equal(beat.hasWorldConsequence, false);
}
assert.equal(await pacing.runAction(action, () => undefined), false, "an investigation callback without a result cannot claim success");
assert.equal(await pacing.runAction({ ...action, target: "show-investigation" }, () => undefined), false, "golden board actions require explicit results too");
assert.equal(await pacing.runAction(action, () => { throw new Error("Transport interrupted"); }), false);
pacing = pacingHost.render(command);
assert.equal(pacing.actionLifecycle.state, "failed-safe");
assert.equal(pacing.actionLifecycle.detail.includes("without changing"), false, "a failed transport does not promise that the server was unchanged");
assert.equal(appendRecentSafeOutcome([], deriveCurrentSafeOutcome(command, { state: "resolving", action })).length, 0, "in-flight actions never manufacture historical success");
pacingHost.unmount();

assert.equal(replies.length, 0, "every controlled network reply was consumed");
console.log(JSON.stringify({ ok: true, suite: "investigation-action-results", checks: ["explicit-statuses", "join-confirmation", "shared-lock", "case-world-session-scope", "stale-finally", "unmount", "undiscovered-evidence", "challenge-rejection", "theory-compatibility", "proof-removal", "pacing-terminal-ownership", "one-outcome-per-action", "ledger-action-label", "ledger-latest-precedence", "rejected-cancelled-failed-presentation"], limits: ["Actual hooks run in a deterministic hook host; this is not a DOM or live-server test."] }, null, 2));
