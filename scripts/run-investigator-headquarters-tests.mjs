import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";

const root = process.cwd();
const sourceDir = path.join(root, "packages", "engine", "src");
const outDir = path.join(root, "outputs", "investigator-headquarters-test-runtime");

async function collect(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? collect(file) : entry.name.endsWith(".ts") ? [file] : [];
  }));
  return nested.flat();
}

await fs.rm(outDir, { recursive: true, force: true });
for (const file of await collect(sourceDir)) {
  const source = await fs.readFile(file, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const target = path.join(outDir, path.relative(sourceDir, file).replace(/\.ts$/, ".cjs"));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, compiled.replace(/require\("(\.{1,2}\/[^\"]+?)"\)/g, 'require("$1.cjs")'), "utf8");
}
const engine = await import(pathToFileURL(path.join(outDir, "index.cjs")).href);

function baseRuntime(seed) {
  const world = engine.createInitialWorld(seed, { mode: "showcase", npcCount: 8, timelineHours: 24 });
  return engine.createPersistentTownRuntime(world, []);
}

function givePractice(runtime) {
  runtime.investigatorProgression = {
    points: 5,
    competencies: { search: 1, question: 1, challenge: 1, "evidence-selection": 1, "case-closure": 1 },
    ledger: []
  };
  runtime.investigatorProgressionSummary = engine.toInvestigatorProgressionPublicSummary(runtime);
  runtime.campaignSession = {
    campaignId: "harbor-testimony",
    status: "transition",
    targetCaseCount: 3,
    maximumCaseCount: 5,
    startedAtTick: 0,
    cycleSequence: 1,
    completedCaseIds: ["public-case"],
    completedCycleKeys: [],
    history: []
  };
}

{
  const runtime = baseRuntime("headquarters-empty");
  assert.equal(engine.toInvestigatorHeadquartersPublicSummary(runtime).status, "empty", "old runtime has an empty safe Headquarters summary");
  assert.equal(engine.investigatorHeadquartersExtractionRequired(runtime), false, "opening extraction is not gated");
}

{
  const runtime = baseRuntime("headquarters-cycle");
  givePractice(runtime);
  const baseline = JSON.stringify({ candidates: runtime.candidates, tick: runtime.tick, ledger: runtime.ruleState?.resourceLedger });
  const ready = engine.prepareInvestigatorHeadquarters(runtime, { cycleKey: "cycle-one", sourceCaseId: "case-one" });
  assert.equal(ready.status, "ready", "accepted transition prepares a Headquarters stage");
  assert.equal(ready.availableDirections[0].choice, "field-search", "Harbor recommendation is stable and first");
  assert.equal(engine.investigatorHeadquartersExtractionRequired(runtime), true, "unselected Headquarters blocks the next extraction");
  assert.equal(JSON.stringify({ candidates: runtime.candidates, tick: runtime.tick, ledger: runtime.ruleState?.resourceLedger }), baseline, "preparation does not change case candidates, tick, or resources");
  const prepared = engine.applyInvestigatorHeadquartersDecision(runtime, { choice: "field-search" });
  assert.equal(prepared.status, "prepared", "choice locks as prepared");
  assert.equal(runtime.tick, 0, "zero-tick Headquarters choice does not advance town time");
  assert.equal(engine.applyInvestigatorHeadquartersDecision(runtime, { choice: "witness-work" }), undefined, "a second choice cannot replace the locked direction");
  const active = engine.activateInvestigatorHeadquarters(runtime, "case-two");
  assert.equal(active.status, "active", "successful extraction activates the preparation");
  assert.equal(engine.investigatorHeadquartersReserveDiscount(runtime, "search", "case-two"), 1, "Field Search grants one matching bounded reserve discount");
  assert.equal(engine.consumeInvestigatorHeadquartersReserveBenefit(runtime, { lane: "search", caseId: "case-two" }), true, "reserve benefit is consumed once");
  assert.equal(engine.investigatorHeadquartersReserveDiscount(runtime, "search", "case-two"), 0, "reserve discount cannot repeat");
  assert.equal(engine.consumeInvestigatorHeadquartersReserveBenefit(runtime, { lane: "search", caseId: "case-two" }), false, "reserve benefit consumption is idempotent");
  assert.equal(engine.completeInvestigatorHeadquarters(runtime, "case-two").status, "completed", "accepted case completes the active preparation");
  assert.equal(engine.prepareInvestigatorHeadquarters(runtime, { cycleKey: "cycle-two", sourceCaseId: "case-two" }).status, "ready", "second campaign transition can prepare one more stage");
  assert.equal(engine.prepareInvestigatorHeadquarters(runtime, { cycleKey: "cycle-three", sourceCaseId: "case-three" }).status, "ready", "third preparation request is ignored at the two-stage bound");
  const safe = JSON.stringify(engine.toInvestigatorHeadquartersPublicSummary(runtime));
  assert.equal(/cycle-one|cycle-two|case-two|createdAtTick|targetCaseId|sourceCaseId/i.test(safe), false, "public Headquarters summary excludes internal keys and ticks");
}

{
  const runtime = baseRuntime("headquarters-recovery");
  givePractice(runtime);
  engine.prepareInvestigatorHeadquarters(runtime, { cycleKey: "recovery-cycle", sourceCaseId: "case-one" });
  engine.applyInvestigatorHeadquartersDecision(runtime, { choice: "evidence-handling" });
  engine.activateInvestigatorHeadquarters(runtime, "case-two");
  engine.prepareCampaignRecovery(runtime, { sourceKey: "rejected-theory", failureKind: "rejected-theory", caseId: "case-two", sessionId: "session-one" });
  const ready = engine.toCampaignRecoveryPublicSummary(runtime);
  assert.equal(ready.headquartersAvailable, true, "Evidence Handling exposes one safe Headquarters Recovery choice");
  const tickBefore = runtime.tick;
  const scheduled = engine.applyCampaignRecoveryDecision(runtime, { choice: "use-headquarters" });
  assert.equal(scheduled.status, "scheduled", "Headquarters Recovery is scheduled through the existing cadence");
  assert.equal(runtime.tick, tickBefore, "Recovery decision is zero tick");
  runtime.tick = scheduled.status === "scheduled" ? (runtime.campaignRecoveries.items[0].completesAtTick || runtime.tick) : runtime.tick;
  const completed = engine.reconcileCampaignRecovery(runtime);
  assert.equal(completed?.status, "completed", "scheduled Headquarters Recovery completes at the next legal cadence");
  assert.equal(engine.investigatorHeadquartersCanRecover(runtime), false, "Headquarters Recovery assist is consumed once");
}

console.log(JSON.stringify({ ok: true, suite: "investigator-headquarters", cases: 3 }));
