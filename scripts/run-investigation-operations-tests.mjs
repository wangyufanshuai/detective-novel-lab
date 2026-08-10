import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const sourceDir = path.join(root, "packages", "engine", "src");
const runtimeDir = path.join(root, "outputs", "investigation-operations-test-runtime");

async function collectTsFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTsFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
  }))).flat();
}

await fs.mkdir(runtimeDir, { recursive: true });
for (const file of await collectTsFiles(sourceDir)) {
  const source = await fs.readFile(file, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText.replace(/require\("(\.{1,2}\/.*?)"\)/g, 'require("$1.cjs")');
  const target = path.join(runtimeDir, path.relative(sourceDir, file).replace(/\.ts$/, ".cjs"));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, output, "utf8");
}

const engine = await import(`${pathToFileURL(path.join(runtimeDir, "index.cjs")).href}?operations=${Date.now()}`);
const lanes = ["search", "question", "challenge"];

function fixture(seed) {
  const world = engine.createInitialWorld(seed, { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const runtime = engine.createPersistentTownRuntime(world, []);
  const caseId = `case-${seed}`;
  engine.activateCampaignCase(runtime, caseId, `candidate-${seed}`);
  return { world, runtime, locationId: world.locations[0].id, sessionId: `session-${seed}`, caseId };
}

function ledgerSnapshot(runtime) {
  return Object.fromEntries(["police_time", "informant_trust", "evidence_integrity"].map((kind) => [kind, {
    available: runtime.ruleState.resourceLedger[kind].available,
    reserved: runtime.ruleState.resourceLedger[kind].reserved,
    spentThisRun: runtime.ruleState.resourceLedger[kind].spentThisRun,
    pressure: runtime.ruleState.resourceLedger[kind].pressure
  }]));
}

{
  const { runtime, sessionId, caseId, locationId } = fixture("operations-plan");
  const tick = runtime.tick;
  const beforeLedger = ledgerSnapshot(runtime);
  const manual = engine.applyInvestigationOperationsDecision(runtime, { sessionId, caseId, caseSceneLocationId: locationId, allocations: [] });
  assert.equal(manual.planStatus, "planned", "an empty support plan explicitly keeps Manual First available");
  assert.equal(manual.supportCount, 0, "Manual First plan reserves no support slots");
  assert.deepEqual(ledgerSnapshot(runtime), beforeLedger, "Manual First planning changes no resource ledger");
  assert.equal(runtime.tick, tick, "planning is zero tick");

  const planned = engine.applyInvestigationOperationsDecision(runtime, { sessionId, caseId, caseSceneLocationId: locationId, allocations: ["search", "question"] });
  assert.equal(planned.planStatus, "planned", "two supported lanes form one bounded plan");
  assert.equal(planned.supportCount, 2, "the operations budget accepts two support lanes");
  assert.deepEqual(planned.priorityOrder.slice(0, 2), ["search", "question"], "selected support establishes a stable execution priority");
  assert.equal(runtime.tick, tick, "resource reservation remains zero tick");
  assert.equal(runtime.ruleState.resourceLedger.police_time.reserved > beforeLedger.police_time.reserved, true, "Search reserves existing police time");
  assert.equal(runtime.ruleState.resourceLedger.informant_trust.reserved > beforeLedger.informant_trust.reserved, true, "Question reserves existing informant trust");

  const beforeRejected = ledgerSnapshot(runtime);
  assert.equal(engine.applyInvestigationOperationsDecision(runtime, { sessionId, caseId, caseSceneLocationId: locationId, allocations: lanes }), undefined, "a third support lane is rejected");
  assert.deepEqual(ledgerSnapshot(runtime), beforeRejected, "rejected over-capacity planning is atomic");

  const search = engine.recordInvestigationOperationStep(runtime, { sessionId, caseId, caseSceneLocationId: locationId, lane: "search" });
  assert.equal(search.lastAction.mode, "supported", "matching Search consumes its reserved support");
  assert.equal(search.lastAction.lane, "search", "After Action identifies the resolved lane");
  assert.equal(search.townTimeMinutes, runtime.tickIntervalMinutes, "supported operation records one existing town interval");
  const afterSearch = structuredClone(search);
  assert.deepEqual(engine.recordInvestigationOperationStep(runtime, { sessionId, caseId, caseSceneLocationId: locationId, lane: "search" }), afterSearch, "a lane completion is idempotent");

  const question = engine.recordInvestigationOperationStep(runtime, { sessionId, caseId, caseSceneLocationId: locationId, lane: "question" });
  assert.equal(question.lastAction.mode, "supported", "matching Question consumes its reserved support");
  const challenge = engine.recordInvestigationOperationStep(runtime, { sessionId, caseId, caseSceneLocationId: locationId, lane: "challenge" });
  assert.equal(challenge.lastAction.mode, "manual-first", "unfunded Challenge remains legal through Manual First");
  assert.equal(challenge.completedOperationCount, 3, "each certified investigation lane resolves once");
  assert.equal(challenge.townTimeMinutes, runtime.tickIntervalMinutes * 4, "two supported lanes plus one Manual First lane record four intervals");
  assert.equal(runtime.tick, tick, "investigation handlers add no hidden simulation tick");

  const pressureBefore = runtime.locationProfiles.find((item) => item.locationId === locationId).resourcePressure;
  const settled = engine.settleInvestigationOperations(runtime, { sessionId, caseId, accepted: true });
  const pressureAfter = runtime.locationProfiles.find((item) => item.locationId === locationId).resourcePressure;
  assert.equal(settled.planStatus, "settled", "accepted theory settles the case operations budget");
  assert.equal(pressureAfter - pressureBefore, -1, "efficient supported tempo applies one bounded future-town relief delta");
  assert.equal(engine.settleInvestigationOperations(runtime, { sessionId, caseId, accepted: true }), undefined, "accepted settlement cannot apply twice");
  assert.equal(runtime.locationProfiles.find((item) => item.locationId === locationId).resourcePressure, pressureAfter, "duplicate accepted settlement cannot apply tempo pressure twice");
}

{
  const { runtime, sessionId, caseId, locationId } = fixture("operations-replay-isolation");
  const authoritySummary = engine.preparePlayerResourceCommitment(runtime, { sessionId, caseId });
  assert.equal(authoritySummary.scope, "authoritative", "the first current-cycle player session owns the case operations authority");
  engine.applyInvestigationOperationsDecision(runtime, { sessionId, caseId, caseSceneLocationId: locationId, allocations: ["search", "question"] });
  for (const lane of lanes) engine.recordInvestigationOperationStep(runtime, { sessionId, caseId, caseSceneLocationId: locationId, lane });
  const settled = engine.settleInvestigationOperations(runtime, { sessionId, caseId, accepted: true });
  const replaySessionId = `${sessionId}-replay`;
  const beforeReplay = {
    tick: runtime.tick,
    ledger: ledgerSnapshot(runtime),
    profiles: structuredClone(runtime.locationProfiles),
    commitments: structuredClone(runtime.playerResourceCommitments),
    summary: structuredClone(runtime.playerResourceCommitmentSummary)
  };
  const replaySummary = engine.preparePlayerResourceCommitment(runtime, { sessionId: replaySessionId, caseId });
  assert.equal(replaySummary.scope, "practice", "a later session for the same settled cycle receives a practice-only summary");
  assert.equal(replaySummary.completedOperationCount, settled.completedOperationCount, "Replay shows the frozen authoritative operation count");
  assert.equal(replaySummary.townTimeMinutes, settled.townTimeMinutes, "Replay cannot add a second operations tempo");
  assert.equal(engine.applyInvestigationOperationsDecision(runtime, { sessionId: replaySessionId, caseId, caseSceneLocationId: locationId, allocations: ["challenge"] }), undefined, "Replay cannot reserve a new support plan");
  assert.equal(engine.recordInvestigationOperationStep(runtime, { sessionId: replaySessionId, caseId, caseSceneLocationId: locationId, lane: "search" }), undefined, "Replay cannot record a second authoritative lane");
  assert.equal(engine.settleInvestigationOperations(runtime, { sessionId: replaySessionId, caseId, accepted: true }), undefined, "Replay accepted proof cannot settle the world again");
  assert.deepEqual({
    tick: runtime.tick,
    ledger: ledgerSnapshot(runtime),
    profiles: runtime.locationProfiles,
    commitments: runtime.playerResourceCommitments,
    summary: runtime.playerResourceCommitmentSummary
  }, beforeReplay, "Replay planning, steps, and accepted proof leave Persistent Town byte-stable across authoritative Operations fields");
}

{
  const first = fixture("operations-order-a");
  const second = fixture("operations-order-a");
  const a = engine.applyInvestigationOperationsDecision(first.runtime, { sessionId: first.sessionId, caseId: first.caseId, caseSceneLocationId: first.locationId, allocations: ["question", "search"] });
  const b = engine.applyInvestigationOperationsDecision(second.runtime, { sessionId: second.sessionId, caseId: second.caseId, caseSceneLocationId: second.locationId, allocations: ["search", "question"] });
  assert.deepEqual(a.laneSummaries, b.laneSummaries, "allocation input order cannot change the deterministic plan");
  assert.deepEqual(ledgerSnapshot(first.runtime), ledgerSnapshot(second.runtime), "allocation input order cannot change resource accounting");
}

{
  const { runtime, sessionId, caseId, locationId } = fixture("operations-replan");
  engine.applyInvestigationOperationsDecision(runtime, { sessionId, caseId, caseSceneLocationId: locationId, allocations: ["search", "question"] });
  const initial = ledgerSnapshot(runtime);
  const replanned = engine.applyInvestigationOperationsDecision(runtime, { sessionId, caseId, caseSceneLocationId: locationId, allocations: ["question", "challenge"] });
  assert.equal(replanned.laneSummaries.find((item) => item.lane === "search").status, "released", "replanning releases an unused lane once");
  assert.equal(replanned.laneSummaries.find((item) => item.lane === "challenge").status, "reserved", "replanning can reserve another future lane");
  assert.equal(runtime.ruleState.resourceLedger.police_time.reserved < initial.police_time.reserved, true, "released Search support returns its reservation");
  engine.recordInvestigationOperationStep(runtime, { sessionId, caseId, caseSceneLocationId: locationId, lane: "question" });
  assert.equal(engine.applyInvestigationOperationsDecision(runtime, { sessionId, caseId, caseSceneLocationId: locationId, allocations: ["challenge"] }), undefined, "a used support lane cannot be removed by replanning");
}

{
  const { runtime, sessionId, caseId, locationId } = fixture("operations-switch");
  const before = ledgerSnapshot(runtime);
  engine.applyInvestigationOperationsDecision(runtime, { sessionId, caseId, caseSceneLocationId: locationId, allocations: ["search", "challenge"] });
  const pressureBefore = runtime.locationProfiles.find((item) => item.locationId === locationId).resourcePressure;
  const switched = engine.settleInvestigationOperations(runtime, { sessionId, caseId, accepted: false });
  assert.equal(switched.planStatus, "settled", "successful case switch closes the old operations plan");
  assert.deepEqual(ledgerSnapshot(runtime), before, "case switch returns every unused reserve exactly once");
  assert.equal(runtime.locationProfiles.find((item) => item.locationId === locationId).resourcePressure, pressureBefore, "case switch does not manufacture an accepted-case tempo result");
}

{
  const { runtime, sessionId, caseId, locationId } = fixture("operations-manual");
  for (const kind of ["police_time", "informant_trust", "evidence_integrity"]) runtime.ruleState.resourceLedger[kind].available = 0;
  const summary = engine.applyInvestigationOperationsDecision(runtime, { sessionId, caseId, caseSceneLocationId: locationId, allocations: [] });
  assert.equal(summary.laneSummaries.every((item) => item.availabilityBand === "unavailable"), true, "resource exhaustion is visible as a safe availability band");
  for (const lane of lanes) engine.recordInvestigationOperationStep(runtime, { sessionId, caseId, caseSceneLocationId: locationId, lane });
  const active = engine.toPlayerResourceCommitmentPublicSummary(runtime, { sessionId, caseId });
  assert.equal(active.completedOperationCount, 3, "resource exhaustion never deadlocks the three Manual First operations");
  assert.equal(active.townTimeMinutes, runtime.tickIntervalMinutes * 6, "all-Manual route records the slower six-interval tempo");
  const pressureBefore = runtime.locationProfiles.find((item) => item.locationId === locationId).resourcePressure;
  engine.settleInvestigationOperations(runtime, { sessionId, caseId, accepted: true });
  assert.equal(runtime.locationProfiles.find((item) => item.locationId === locationId).resourcePressure - pressureBefore, 1, "slow Manual First tempo carries only one bounded pressure delta");
}

{
  const base = engine.createStaticDemoRuntime("archive-blunt");
  const authorityBefore = {
    truth: structuredClone(base.activeCase.deductionCase.truth),
    evidenceIds: base.activeCase.deductionCase.evidence.map((item) => item.id).sort(),
    certificate: engine.certifyPlayableCase(base.activeCase, base.events),
    autoSolve: engine.autoSolvePlayableCase(base.activeCase, base.events)
  };
  const { world, runtime, sessionId, caseId, locationId } = fixture("operations-authority");
  const actor = world.npcs.find((item) => item.alive) || world.npcs[0];
  const legalBefore = engine.scoreNpcActionCandidates(world, actor, [], runtime).map((item) => ({ kind: item.kind, legal: item.legal, targetNpcId: item.targetNpcId, targetLocationId: item.targetLocationId })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  engine.applyInvestigationOperationsDecision(runtime, { sessionId, caseId, caseSceneLocationId: locationId, allocations: ["search", "challenge"] });
  const legalAfter = engine.scoreNpcActionCandidates(world, actor, [], runtime).map((item) => ({ kind: item.kind, legal: item.legal, targetNpcId: item.targetNpcId, targetLocationId: item.targetLocationId })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  assert.deepEqual(legalAfter, legalBefore, "operations planning does not add, remove, or legalize NPC actions");
  assert.deepEqual(base.activeCase.deductionCase.truth, authorityBefore.truth, "operations planning cannot rewrite extracted truth");
  assert.deepEqual(base.activeCase.deductionCase.evidence.map((item) => item.id).sort(), authorityBefore.evidenceIds, "operations planning cannot rewrite evidence membership");
  assert.deepEqual(engine.certifyPlayableCase(base.activeCase, base.events), authorityBefore.certificate, "operations planning cannot rewrite Route Certificate");
  assert.deepEqual(engine.autoSolvePlayableCase(base.activeCase, base.events), authorityBefore.autoSolve, "operations planning cannot rewrite deterministic judgement readiness");
}

{
  const { runtime, sessionId, caseId, locationId } = fixture("operations-public-safe");
  engine.applyInvestigationOperationsDecision(runtime, { sessionId, caseId, caseSceneLocationId: locationId, allocations: ["search"] });
  engine.recordInvestigationOperationStep(runtime, { sessionId, caseId, caseSceneLocationId: locationId, lane: "search" });
  const publicSummary = engine.toPlayerResourceCommitmentPublicSummary(runtime, { sessionId, caseId });
  assert.equal(/sessionId|caseId|locationId|resourceKind|selectedAtTick|completedAtTick|applied.*Delta|sourceKey|culprit|victim|hiddenTruth|rawBody|[A-Za-z]:[\\/]/i.test(JSON.stringify(publicSummary)), false, "operations public summary contains no internal binding, truth, raw body, or absolute path");
}

console.log(JSON.stringify({
  ok: true,
  tests: [
    "zero-tick-plan", "two-slot-budget", "atomic-cap", "stable-order", "replan-refund", "lane-idempotence",
    "supported-time", "manual-first-time", "accepted-pressure", "case-switch-refund", "no-deadlock",
    "authority-cycle", "replay-read-only", "duplicate-settlement", "truth-isolation", "evidence-isolation",
    "route-certificate", "auto-solve", "npc-legal-actions", "public-safe"
  ]
}));
