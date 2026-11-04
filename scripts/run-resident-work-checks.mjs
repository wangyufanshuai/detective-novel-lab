import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createNoirTestLoader } from "./noir-player-test-loader.mjs";

const root = process.cwd();
const output = path.join(root, "output", "resident-work-v1");
fs.mkdirSync(output, { recursive: true });
const run = fs.mkdtempSync(path.join(output, "checks-"));
process.env.DATABASE_URL = path.join(run, "isolated.db");
const { load } = createNoirTestLoader(root);
const { createRiverbendWorld } = load("packages/engine/src/riverbend-world.ts");
const { advancePersistentTownTick, createTownStateSnapshot, rollbackTownRuntimeToSnapshot, normalizePersistentTownRuntime } = load("packages/engine/src/persistent-town.ts");
const work = load("packages/engine/src/town/resident-work.ts");
const { buildWorldReplayDigest } = load("packages/engine/src/town/replay-contract.ts");
const { startTownExploration, observeTownResidents, townExplorationPlayerView } = load("packages/engine/src/town-exploration.ts");
const { chooseResidentWork, residentDecisionProviderFromEnv } = load("lib/world/resident-decision-provider.ts");
const clone = value => JSON.parse(JSON.stringify(value));
const checks = [];
function pass(name) { checks.push(name); }
function fixture(id) {
  const value = createRiverbendWorld({ worldId: `work-check-${id}`, now: "2026-10-11T00:00:00.000Z" });
  work.enableTownResidentWork(value.world, value.world.persistentRuntime);
  return value;
}
function advance(world, events = [], steps = 1) {
  const result = advancePersistentTownTick(world, events, { steps, status: "paused", snapshotEveryTicks: 1, checkpointEveryTicks: 1 });
  return { world: { ...result.world, persistentRuntime: result.runtime }, events: [...events, ...result.events], added: result.events };
}

const original = fixture("lifecycle");
const originalJSON = JSON.stringify(original.world);
const first = advance(original.world);
assert.equal(JSON.stringify(original.world), originalJSON);
assert.equal(first.world.persistentRuntime.currentTime, "08:05");
assert.equal(first.added.filter(event => event.type === "work").length, 3);
assert.equal(first.world.persistentRuntime.residentWork.active["rb-xu-zhiwei"].elapsedMinutes, 5);
assert.equal(first.world.persistentRuntime.residentWork.stations["rb-xu-zhiwei"].reserved, 1);
assert(first.world.persistentRuntime.agentStates.find(agent => agent.npcId === "rb-xu-zhiwei").knownFactIds.some(id => id.includes("work-")), "New work memory missed this tick's goal phase");
assert(first.world.persistentRuntime.decisionTraces.every(trace => !work.RESIDENT_WORK_JOBS.some(job => job.npcId === trace.npcId)), "A worker simultaneously took a legacy action");
assert(first.added.filter(event => event.type === "work").every(event => first.world.persistentRuntime.reports.at(-1).eventIds.includes(event.id)), "Tick report omitted work events");
pass("real-clock-starts-work-reserves-input-and-updates-own-memory-once");

const second = advance(first.world, first.events);
assert.equal(second.world.persistentRuntime.residentWork.stations["rb-gu-yuanshan"].completed, 1);
assert.equal(second.world.persistentRuntime.residentWork.stations["rb-lin-ali"].completed, 1);
assert.equal(second.world.persistentRuntime.residentWork.stations["rb-xu-zhiwei"].completed, 0);
const third = advance(second.world, second.events);
assert.equal(third.world.persistentRuntime.residentWork.stations["rb-xu-zhiwei"].completed, 1);
for (const job of work.RESIDENT_WORK_JOBS) {
  const station = third.world.persistentRuntime.residentWork.stations[job.npcId];
  assert.equal(station.pending + station.reserved + station.completed, 6);
  assert.equal(station.outputEventIds.length, station.completed);
  for (const id of station.outputEventIds) {
    const event = third.events.find(event => event.id === id);
    assert(event?.tags.includes("work_completed"));
    assert.equal(event.evidenceId, undefined);
    assert.equal(third.world.memories.filter(memory => memory.eventId === id).length, 1);
  }
}
assert(third.world.persistentRuntime.ruleState.evidenceChain.items.every(item => item.sourceEventIds.every(id => !third.events.some(event => event.id === id && event.type === "work"))), "Routine outputs were promoted to investigation evidence");
assert.equal(new Set(third.events.map(event => event.id)).size, third.events.length);
pass("three-finite-jobs-complete-with-conserved-inputs-and-source-backed-outputs");
pass("ordinary-work-does-not-create-investigation-evidence");

const restored = clone(first.world);
restored.persistentRuntime = normalizePersistentTownRuntime(restored, first.events, restored.persistentRuntime);
const replayed = advance(restored, clone(first.events), 2);
assert.deepEqual(replayed.world.persistentRuntime.residentWork, third.world.persistentRuntime.residentWork);
assert.equal(buildWorldReplayDigest(replayed.world, replayed.events, replayed.world.persistentRuntime).combinedDigest, buildWorldReplayDigest(third.world, third.events, third.world.persistentRuntime).combinedDigest);
assert.throws(() => work.advanceResidentWorkInterval(third.world, third.world.persistentRuntime, []), /already applied/);
pass("save-normalize-and-replay-preserve-work-state-and-complete-world-digest");
pass("duplicate-clock-consumption-rejected");

const held = clone(first.world);
held.persistentRuntime.dailyRoutine.holds["rb-xu-zhiwei"] = { untilTick: 2, reason: "访客正在当面询问" };
const interrupted = advance(held, first.events);
const cancelled = interrupted.world.persistentRuntime.residentWork.history.find(action => action.npcId === "rb-xu-zhiwei");
assert.equal(cancelled.status, "interrupted");
assert.equal(cancelled.elapsedMinutes, 5);
assert.equal(interrupted.world.persistentRuntime.residentWork.stations["rb-xu-zhiwei"].pending, 6);
assert.equal(interrupted.world.persistentRuntime.residentWork.stations["rb-xu-zhiwei"].completed, 0);
pass("questioning-interrupts-work-and-returns-unfinished-order");

const departing = fixture("departure");
departing.world.npcs.find(npc => npc.id === "rb-xu-zhiwei").schedule = { "00:00": "books", "08:07": "town-square" };
const departOne = advance(departing.world);
const departTwo = advance(departOne.world, departOne.events);
const departed = departTwo.world.persistentRuntime.residentWork.history.find(action => action.npcId === "rb-xu-zhiwei");
assert.equal(departed.status, "interrupted");
assert.equal(departed.elapsedMinutes, 7);
assert.equal(departed.endedAtMinute, 487);
assert.equal(departTwo.events.find(event => event.id === departed.eventIds.at(-1)).time, "08:07");
assert.equal(departTwo.world.persistentRuntime.dailyRoutine.journeys["rb-xu-zhiwei"].remainingMinutes, 2);
pass("mid-tick-departure-credits-only-seven-real-minutes-and-preserves-road-time");

for (const reason of ["death", "institutional", "teleport"]) {
  const conflict = clone(first.world);
  if (reason === "death") conflict.npcs.find(npc => npc.id === "rb-xu-zhiwei").alive = false;
  if (reason === "institutional") conflict.persistentRuntime.ruleState.longActions.push({ id: "busy-fixture", actorId: "rb-xu-zhiwei", status: "running" });
  if (reason === "teleport") conflict.persistentRuntime.agentStates.find(agent => agent.npcId === "rb-xu-zhiwei").locationId = "station";
  // Exercise the production lifecycle directly so the deliberately minimal
  // institutional fixture does not enter the unrelated investigation runner.
  conflict.persistentRuntime.tick = 2; conflict.persistentRuntime.currentTime = "08:10";
  work.advanceResidentWorkInterval(conflict, conflict.persistentRuntime, []);
  assert.equal(conflict.persistentRuntime.residentWork.stations["rb-xu-zhiwei"].completed, 0);
  assert.equal(conflict.persistentRuntime.residentWork.history.find(action => action.npcId === "rb-xu-zhiwei").status, "interrupted");
}
pass("incapacity-other-long-action-and-location-loss-cannot-produce-output");

const observer = { ...startTownExploration(first.world, original.map, original.binding, "work-observer"), locationId: "books" };
const seen = observeTownResidents(first.world, original.binding, observer, first.world.persistentRuntime);
const publicView = townExplorationPlayerView(first.world, original.binding, seen, first.world.persistentRuntime);
assert.equal(publicView.residents.find(person => person.npcId === "rb-xu-zhiwei").work.progress, 33);
const away = { ...seen, locationId: "inn" };
const lastSeen = townExplorationPlayerView(first.world, original.binding, away, first.world.persistentRuntime).residents.find(person => person.npcId === "rb-xu-zhiwei");
assert.equal(lastSeen.visibility, "last-seen");
assert.equal(lastSeen.work, undefined);
assert(!JSON.stringify(publicView).includes("pendingDecisions"));
assert(!JSON.stringify(publicView).includes("modelBudget"));
pass("only-present-player-observes-current-work-no-offscreen-work-or-private-ledger-leak");

const deciding = fixture("decision");
const actor = "rb-xu-zhiwei";
deciding.world.npcs.find(npc => npc.id !== actor).secret = "OTHER-SECRET-CANARY";
deciding.world.memories.push({ id: "private-canary", worldId: deciding.world.id, npcId: "rb-lin-ali", day: 1, kind: "secret", eventId: "private-event", summary: "OTHER-MEMORY-CANARY", confidence: 1, visibleToPlayer: false, challengeableEvidenceIds: [] });
const context = work.prepareResidentWorkDecision(deciding.world, deciding.world.persistentRuntime, actor);
assert(context);
assert(!JSON.stringify(context).includes("CANARY"));
assert(!("npcs" in context) && !("schedule" in context) && !("secret" in context));
assert.throws(() => work.queueResidentWorkDecision(deciding.world, deciding.world.persistentRuntime, context, { candidateId: "invent-evidence", source: "offline" }), /legal candidate/);
assert.throws(() => work.queueResidentWorkDecision(deciding.world, deciding.world.persistentRuntime, context, { candidateId: "rest", source: "model" }), /budget reservation/);
assert(work.reserveResidentWorkModelAttempt(deciding.world.persistentRuntime, context));
assert.equal(work.reserveResidentWorkModelAttempt(deciding.world.persistentRuntime, context), false);
work.queueResidentWorkDecision(deciding.world, deciding.world.persistentRuntime, context, { candidateId: "rest", source: "model", provider: "fixture", model: "controlled-selector" });
const checkpoint = createTownStateSnapshot(deciding.world, [], { id: "work-choice-checkpoint", label: "Accepted controlled choice", mode: "checkpoint" });
const chosen = advance(deciding.world);
const rollback = rollbackTownRuntimeToSnapshot(chosen.world, checkpoint);
const chosenReplay = advance({ ...rollback.world, persistentRuntime: rollback.runtime });
assert.deepEqual(chosenReplay.world.persistentRuntime.residentWork, chosen.world.persistentRuntime.residentWork);
assert.equal(chosen.world.persistentRuntime.residentWork.history.find(action => action.npcId === actor).jobId, null);
assert.equal(chosen.world.persistentRuntime.residentWork.modelBudget.used, 1);
const stale = fixture("stale");
const staleContext = work.prepareResidentWorkDecision(stale.world, stale.world.persistentRuntime, actor);
work.queueResidentWorkDecision(stale.world, stale.world.persistentRuntime, staleContext, { candidateId: "repair-book", source: "offline" });
stale.world.persistentRuntime.agentStates.find(agent => agent.npcId === actor).fatigue = 9;
const staleResult = advance(stale.world);
assert.equal(staleResult.world.persistentRuntime.residentWork.decisions.find(decision => decision.context.npcId === actor).choice.source, "stale");
assert.equal(staleResult.world.persistentRuntime.residentWork.stations[actor].reserved, 0);
assert.throws(() => work.queueResidentWorkDecision(stale.world, stale.world.persistentRuntime, staleContext, { candidateId: "rest", source: "offline" }), /stale/);
pass("decision-allowlist-own-knowledge-exact-context-and-budget-admission");
pass("accepted-controlled-choice-replays-from-checkpoint-without-a-model-request");
pass("stale-choice-revalidated-before-execution-and-falls-back-to-legal-rest");

let requests = 0;
const provider = { name: "local", baseUrl: "http://127.0.0.1:9999/v1", model: "controlled-fixture" };
const answer = text => async (_url, options) => {
  requests++;
  const sent = JSON.parse(options.body);
  assert.equal(sent.max_tokens, 96);
  assert.deepEqual(JSON.parse(sent.messages[1].content), context);
  return new Response(JSON.stringify({ choices: [{ message: { content: text } }] }));
};
assert.equal((await chooseResidentWork({ context, provider: null, budgetReserved: false, fetcher: answer("") })).choice.source, "offline");
assert.equal((await chooseResidentWork({ context, provider, budgetReserved: false, fetcher: answer("") })).choice.source, "budget");
assert.equal(requests, 0);
for (const bad of ['{"candidateId":"invent-evidence"}', '{"candidateId":"rest","evidence":"fake"}', '```json\n{"candidateId":"rest"}\n```', "null"]) assert.equal((await chooseResidentWork({ context, provider, budgetReserved: true, fetcher: answer(bad) })).choice.source, "invalid");
const valid = await chooseResidentWork({ context, provider, budgetReserved: true, fetcher: answer('{"candidateId":"rest"}') });
assert.equal(valid.choice.source, "model");
assert.equal(valid.choice.candidateId, "rest");
const timeout = await chooseResidentWork({ context, provider, budgetReserved: true, timeoutMs: 20, fetcher: async () => new Promise(() => {}) });
assert.equal(timeout.choice.source, "timeout");
const failure = await chooseResidentWork({ context, provider, budgetReserved: true, fetcher: async () => { throw new Error("PRIVATE-ERROR-CANARY"); } });
assert.equal(failure.choice.source, "error");
assert(!JSON.stringify(failure).includes("CANARY"));
assert.equal(residentDecisionProviderFromEnv({}), null);
assert.equal(residentDecisionProviderFromEnv({ AI_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "fixture-only" }), null);
pass("transport-fixtures-cover-offline-budget-valid-invalid-timeout-and-error-without-secret-logging");

const { startTownPlay, readTownPlay, commandTownPlay, commandTownWorkStep } = load("lib/world/town-exploration-store.ts");
const repository = load("lib/world/repository.ts");
const { withPrivateWorldAccess } = load("lib/world/private-world-access.ts");
try {
  const created = startTownPlay();
  let view = created.result.view;
  const credentials = created.credentials;
  let serial = 0;
  function command(action) {
    const request = { ...action, actionId: `work-command-${++serial}`, expectedSessionRevision: view.revision, expectedWorldRevision: view.worldRevision };
    const result = commandTownPlay(credentials, request);
    assert.deepEqual(commandTownPlay(credentials, request).view, clone(result.view));
    view = result.view;
    return request;
  }
  assert.equal(view.residentWorkEnabled, undefined);
  const pristineRead = JSON.stringify(readTownPlay(credentials));
  assert.equal(JSON.stringify(readTownPlay(credentials)), pristineRead);
  command({ kind: "work-enable" });
  assert.equal(view.residentWorkEnabled, true);
  assert.equal(view.time, "08:00");
  command({ kind: "work-step" });
  assert.equal(view.time, "08:05");
  command({ kind: "arrive", sceneId: "books" });
  assert(view.residents.find(person => person.npcId === actor)?.work);
  command({ kind: "work-step" });
  const afterCommands = clone(view);
  const saved = withPrivateWorldAccess(view.worldId, () => repository.worldRepository.getWorld(view.worldId));
  assert(saved.persistentRuntime.residentWork.stations[actor].completed >= 1);
  assert.throws(() => commandTownPlay(credentials, { kind: "work-step", actionId: "stale-world-command", expectedSessionRevision: 0, expectedWorldRevision: 0 }), /小镇已发生变化/);
  assert.throws(() => readTownPlay({ ...credentials, secret: "not-the-secret" }), /另一个浏览器/);
  repository.closeDatabase();
  assert.deepEqual(readTownPlay(credentials), afterCommands);
  const secondOwner = startTownPlay();
  assert.equal(secondOwner.result.view.residentWorkEnabled, undefined);
  assert.deepEqual(readTownPlay(credentials), afterCommands);
  pass("owned-sqlite-opt-in-five-minute-steps-retries-CAS-reopen-and-world-isolation");

  const modelOwner = startTownPlay();
  let modelView = modelOwner.result.view;
  const modelCommand = (id, kind = "work-step") => ({ kind, actionId: id, expectedSessionRevision: modelView.revision, expectedWorldRevision: modelView.worldRevision });
  modelView = commandTownPlay(modelOwner.credentials, modelCommand("enable-controlled-model", "work-enable")).view;
  let modelCalls = 0;
  const controlledFetch = async (_url, options) => {
    modelCalls++;
    assert.equal(repository.getDb().inTransaction, false, "Network request happened inside SQLite transaction");
    const ownContext = JSON.parse(JSON.parse(options.body).messages[1].content);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ candidateId: ownContext.candidates[0].id }) } }] }));
  };
  const modelStep = modelCommand("controlled-model-step");
  const modelResult = await commandTownWorkStep(modelOwner.credentials, modelStep, { provider, fetcher: controlledFetch });
  assert.equal(modelCalls, 3);
  assert.equal(modelResult.view.time, "08:05");
  assert.deepEqual((await commandTownWorkStep(modelOwner.credentials, modelStep, { provider, fetcher: controlledFetch })).view, clone(modelResult.view));
  assert.equal(modelCalls, 3, "Durable retry charged for more model requests");
  modelView = modelResult.view;
  withPrivateWorldAccess(modelView.worldId, () => {
    const world = repository.worldRepository.getWorld(modelView.worldId);
    assert.equal(world.persistentRuntime.residentWork.modelBudget.used, 3);
    assert.equal(world.persistentRuntime.residentWork.decisions.filter(decision => decision.choice.source === "model").length, 3);
    // A controlled low budget tests the durable gate without spending 24 calls.
    world.persistentRuntime.residentWork.modelBudget.limit = 3;
    repository.worldRepository.saveWorld(world);
  });
  modelView = (await commandTownWorkStep(modelOwner.credentials, modelCommand("continue-controlled-work"), { provider, fetcher: controlledFetch })).view;
  modelView = (await commandTownWorkStep(modelOwner.credentials, modelCommand("exhaust-controlled-budget"), { provider, fetcher: controlledFetch })).view;
  assert.equal(modelCalls, 3);
  const budgetWorld = withPrivateWorldAccess(modelView.worldId, () => repository.worldRepository.getWorld(modelView.worldId));
  assert(budgetWorld.persistentRuntime.residentWork.decisions.some(decision => decision.choice.source === "budget"));
  pass("server-reserves-model-budget-before-network-and-commits-three-controlled-choices-once");
  pass("durable-model-budget-exhaustion-keeps-time-moving-with-labelled-fallback");

  const crashed = startTownPlay();
  let crashView = commandTownPlay(crashed.credentials, { kind: "work-enable", actionId: "crash-enable", expectedSessionRevision: crashed.result.view.revision, expectedWorldRevision: crashed.result.view.worldRevision }).view;
  const crashCommand = { kind: "work-step", actionId: "crash-step", expectedSessionRevision: crashView.revision, expectedWorldRevision: crashView.worldRevision };
  let unblock;
  const gate = new Promise(resolve => { unblock = resolve; });
  let crashCalls = 0;
  const lostResponse = commandTownWorkStep(crashed.credentials, crashCommand, { provider, timeoutMs: 2000, fetcher: async () => { crashCalls++; await gate; return new Response(JSON.stringify({ choices: [{ message: { content: '{"candidateId":"rest"}' } }] })); } });
  assert.equal(crashCalls, 3);
  await assert.rejects(() => commandTownWorkStep(crashed.credentials, crashCommand, { provider, fetcher: controlledFetch }), error => error.code === "WORK_BUSY");
  crashView = readTownPlay(crashed.credentials);
  assert.throws(() => commandTownPlay(crashed.credentials, { kind: "wait", minutes: 15, actionId: "competing-clock", expectedSessionRevision: crashView.revision, expectedWorldRevision: crashView.worldRevision }), error => error.code === "WORK_BUSY");
  repository.getDb().prepare("update town_resident_work_batches set expires_at = 0 where session_id = ?").run(crashed.credentials.id);
  const recovered = await commandTownWorkStep(crashed.credentials, crashCommand, { provider, fetcher: controlledFetch });
  assert.equal(crashCalls, 3);
  assert.equal(modelCalls, 3, "Expired batch called the provider again");
  assert.equal(recovered.view.time, "08:05");
  unblock();
  assert.equal((await lostResponse).replayed, true);
  const crashWorld = withPrivateWorldAccess(recovered.view.worldId, () => repository.worldRepository.getWorld(recovered.view.worldId));
  assert.equal(crashWorld.persistentRuntime.residentWork.modelBudget.used, 3);
  assert(crashWorld.persistentRuntime.residentWork.decisions.every(decision => decision.choice.source === "error"));
  pass("concurrent-tick-is-leased-and-expired-model-batch-recovers-without-rebilling-or-double-tick");
} finally { repository.closeDatabase(); }

const files = ["packages/engine/src/town/resident-work.ts", "packages/engine/src/town/daily-routine.ts", "packages/engine/src/persistent-town.ts", "packages/engine/src/world-types.ts", "packages/engine/src/town-exploration.ts", "lib/world/town-exploration-store.ts", "lib/world/resident-decision-provider.ts", "lib/town-play-contract.ts", "app/api/v1/town-play/route.ts", "scripts/run-resident-work-checks.mjs"];
const report = { schema: "resident-work-checks.v1", createdAt: new Date().toISOString(), passed: true, checks, evidence: { actualEngine: true, isolatedSqlite: true, controlledTransport: true, liveModel: false, blenderAnimationBound: false, humanReview: false }, sources: Object.fromEntries(files.map(file => [file, crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")])) };
fs.writeFileSync(path.join(run, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ passed: true, checks: checks.length, report: path.join(run, "report.json"), evidence: report.evidence }));
