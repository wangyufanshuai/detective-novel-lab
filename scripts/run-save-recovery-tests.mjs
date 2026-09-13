import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { loadEngineForTool } from "./load-engine-for-tools.mjs";

const root = process.cwd();
const fixtures = JSON.parse(await fs.readFile(path.join(root, "tests", "fixtures", "save-compatibility-v10.json"), "utf8"));
const runtimeDir = path.join(root, "outputs", "v96-save-recovery-runtime");
await fs.rm(runtimeDir, { recursive: true, force: true });
await fs.mkdir(runtimeDir, { recursive: true });
const pointerSource = await fs.readFile(path.join(root, "app", "lib", "world-session-persistence.ts"), "utf8");
const pointerOutput = ts.transpileModule(pointerSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText;
await fs.writeFile(path.join(runtimeDir, "world-session-persistence.cjs"), pointerOutput, "utf8");
const pointer = await import(`${pathToFileURL(path.join(runtimeDir, "world-session-persistence.cjs")).href}?v96=${Date.now()}`);

for (const [name, fixture] of Object.entries(fixtures.pointers)) {
  assert.equal(pointer.normalizeWorldSessionPointer(fixture.input).status, fixture.expectedStatus, `${name} pointer fixture is classified deterministically`);
}
assert.deepEqual(pointer.normalizeWorldSessionPointer(null), { status: "empty", pointer: null });
assert.deepEqual(pointer.normalizeWorldSessionPointer("not json"), { status: "invalid", pointer: null });
assert.equal(pointer.normalizeWorldSessionPointer({ worldId: "world-legacy", sessionId: "session-legacy" }).status, "legacy");
assert.deepEqual(pointer.normalizeWorldSessionPointer({ formatVersion: 1, worldId: "world-ready", sessionId: "" }), {
  status: "ready",
  pointer: { formatVersion: 1, worldId: "world-ready", sessionId: "" }
});
assert.deepEqual(pointer.normalizeWorldSessionPointer({ formatVersion: 2, worldId: "world-ready" }), { status: "invalid", pointer: null });
assert.deepEqual(pointer.normalizeWorldSessionPointer({ formatVersion: 1, worldId: "../../escape", sessionId: "" }), { status: "invalid", pointer: null });
assert.equal(pointer.serializeWorldSessionPointer("world-ready", "session-ready"), '{"formatVersion":1,"worldId":"world-ready","sessionId":"session-ready"}');
assert.equal(pointer.serializeWorldSessionPointer("", ""), null);
assert.equal(pointer.clientErrorIsPublicSafe(new Error("Retry the current action.")), true);
assert.equal(pointer.clientErrorIsPublicSafe(new Error("SQLite failed at C:\\private\\runtime.db")), false, "storage paths and implementation details are never public-safe");

const engine = await loadEngineForTool("v96-save-recovery");
const world = engine.createInitialWorld("v96-save-recovery", { mode: "showcase", npcCount: 8, timelineHours: 24 });
world.updatedAt = "2026-08-11T00:00:00.000Z";
const baseline = engine.createPersistentTownRuntime(world, [], { now: world.updatedAt });
const legacy = JSON.parse(JSON.stringify(baseline));
delete legacy.pressureLedger;
delete legacy.eventObservations;
delete legacy.locationProfiles;
delete legacy.townSocialResponses;
delete legacy.campaignSession;
legacy.caseLifecycle = { activeCaseIds: [], solvedCaseIds: [], failedCaseIds: [], caseCooldownByNpcId: {} };
legacy.unknownFutureField = { retained: true };
const beforeWorld = JSON.stringify(world);
const normalized = engine.normalizePersistentTownRuntime(world, [], legacy);
assert.equal(normalized.tick, baseline.tick, "normalization never advances a tick");
assert.equal(normalized.worldId, world.id, "runtime is rebound to the loaded world");
assert.equal(Array.isArray(normalized.pressureLedger), true);
assert.equal(Array.isArray(normalized.eventObservations), true);
assert.equal(Array.isArray(normalized.locationProfiles), true);
assert.equal(Array.isArray(normalized.townSocialResponses.items), true);
assert.equal(Array.isArray(normalized.caseLifecycle.caseAftermathLog), true);
assert.deepEqual(normalized.unknownFutureField, { retained: true }, "unknown optional fields remain forward-compatible");
assert.equal(Boolean(normalized.campaignSessionSummary), true, "legacy Campaign state receives a safe current summary");
assert.equal(JSON.stringify(world), beforeWorld, "normalization does not mutate world authority");

for (const [name, fixture] of Object.entries(fixtures.runtimes)) {
  const fixtureWorld = JSON.parse(JSON.stringify(world));
  const fixtureBefore = JSON.stringify(fixtureWorld);
  const fixtureEvents = [];
  const migrated = engine.normalizePersistentTownRuntime(fixtureWorld, fixtureEvents, fixture);
  assert.equal(migrated.worldId, fixtureWorld.id, `${name} runtime binds to the loaded world instead of a stale key`);
  assert.ok(migrated.maxTicks >= 1, `${name} runtime receives a bounded maximum tick`);
  assert.ok(migrated.tick >= 0 && migrated.tick <= migrated.maxTicks, `${name} runtime receives a bounded current tick`);
  assert.equal(Array.isArray(migrated.candidates), true, `${name} runtime has a valid candidate collection`);
  assert.equal(Array.isArray(migrated.reports), true, `${name} runtime has a valid report collection`);
  assert.equal(JSON.stringify(fixtureWorld), fixtureBefore, `${name} migration remains pure over world authority`);
  assert.equal(fixtureEvents.length, 0, `${name} migration emits no events`);
  if (fixture.forwardCompatibleExtension) {
    assert.deepEqual(migrated.forwardCompatibleExtension, fixture.forwardCompatibleExtension, `${name} preserves unknown fields`);
  }
}

const corrupt = engine.normalizePersistentTownRuntime(world, [], { status: "invented", tick: -9, maxTicks: 0, candidates: "bad", worldId: "another-world" });
assert.equal(corrupt.status, "paused");
assert.equal(corrupt.tick, 0);
assert.ok(corrupt.maxTicks >= 1);
assert.deepEqual(corrupt.candidates, []);
assert.equal(corrupt.worldId, world.id);
assert.equal(corrupt.reports.length, 0, "normalization creates no event/report history");

const sourceFiles = await Promise.all([
  "app/hooks/useWorldSessionActions.ts",
  "app/hooks/useCampaignLaunchActions.ts",
  "app/hooks/useCertifiedInvestigationActions.ts",
  "app/hooks/useTheorySubmissionActions.ts"
].map((file) => fs.readFile(path.join(root, file), "utf8")));
assert.doesNotMatch(sourceFiles[0], /loadLocal<[^>]*>\(WORLD_SESSION_STORAGE_KEY|loadLocal<[^>]*>\(storageKey/, "Static bootstrap cannot parse shared Server save through the legacy loader");
assert.match(sourceFiles[0], /selectedRuntime === "static-demo"[\s\S]{0,180}hydrateStatic\(createStaticDemoRuntime/);
assert.match(sourceFiles[0], /normalizeWorldSessionPointer/);
assert.match(sourceFiles[0], /createInFlight\.current/);
assert.match(sourceFiles[0], /sessionStorage\.setItem\(WORLD_BOOTSTRAP_STORAGE_KEY, "pending"\)/);
assert.doesNotMatch(sourceFiles[0], /localStorage\.(?:getItem|setItem|removeItem)\(WORLD_BOOTSTRAP_STORAGE_KEY\)/);
assert.match(sourceFiles[1], /startInFlight\.current/);
assert.match(sourceFiles[1], /applyToClient: false/, "Campaign start stages a temporary world until extraction succeeds");
assert.doesNotMatch(sourceFiles[1], /\bset(?:World|Events|TownRuntime|TownQueue)\s*\(/, "failed Campaign start cannot leave intermediate client state");
// Join now commits only confirmed server state. Exercise the actual function,
// including rejection and stale identity, instead of requiring obsolete rollback setters.
const investigationAst = ts.createSourceFile("useCertifiedInvestigationActions.ts", sourceFiles[2], ts.ScriptTarget.Latest, true);
let joinSource;
function findJoin(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "joinCase") joinSource = node.getText(investigationAst);
  ts.forEachChild(node, findJoin);
}
findJoin(investigationAst);
assert.ok(joinSource, "exercise the production joinCase handler");
const joinOutput = ts.transpileModule(`${joinSource}\nreturn joinCase;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
for (const scenario of ["rejected", "wrong-world", "wrong-case", "stale", "confirmed"]) {
  const writes = [];
  let finishCount = 0;
  const context = {
    world: { id: "world-confirmed" }, activeCase: { id: "case-confirmed" }, session: null,
    runtimeMode: "server", playerName: "Investigator",
    actionScope: { begin: () => "join-token", isCurrent: () => scenario !== "stale", finish: () => { finishCount += 1; } },
    investigationActionBusy: () => ({ status: "blocked" }), investigationActionCancelled: () => ({ status: "cancelled" }),
    postJson: async () => {
      assert.equal(writes.length, 0, "no session, progress or save is fabricated while Join is pending");
      if (scenario === "rejected") throw new Error("private database path");
      return { session: { id: "session-confirmed", worldId: scenario === "wrong-world" ? "world-other" : "world-confirmed", caseId: scenario === "wrong-case" ? "case-other" : "case-confirmed" } };
    },
    t: (key) => key,
    campaignStudy: { recordMeaningfulAction: () => writes.push(["meaningful"]) }
  };
  for (const name of ["setSession", "setSessions", "setProgress", "setStatus", "persist", "setPlayerResourceCommitment", "setFactionRelationship", "setInvestigatorProgression"]) {
    context[name] = (...args) => writes.push([name, ...args]);
  }
  const runJoin = new Function(...Object.keys(context), joinOutput)(...Object.values(context));
  const result = await runJoin();
  assert.equal(result.status, scenario === "confirmed" ? "succeeded" : scenario === "stale" ? "cancelled" : "failed", `${scenario} Join reports its confirmed outcome`);
  const commits = writes.filter(([name]) => ["setSession", "setSessions", "setProgress", "persist", "meaningful"].includes(name));
  assert.equal(commits.length, scenario === "confirmed" ? 5 : 0, `${scenario} Join cannot corrupt confirmed progress or persistence`);
  assert.equal(JSON.stringify(writes).includes("private database path"), false, "request failures remain public-safe");
  assert.equal(finishCount, 1, `${scenario} Join always releases its action scope`);
}
assert.match(sourceFiles[3], /const actionScope = useInvestigationActionScope\(\{[\s\S]*?worldId: world\?\.id, caseId: activeCase\?\.id, sessionId: session\?\.id, runtimeMode/, "Theory submission lock belongs to the current world, case and session");
assert.match(sourceFiles[3], /const token = actionScope\.begin\(\);\s*if \(!token\) return investigationActionBusy\(\)/, "Repeated theory submissions cannot bypass the scoped lock");
assert.match(sourceFiles[3], /finally\s*\{\s*actionScope\.finish\(token\)/, "Theory submission releases its lock on every outcome");
for (const source of sourceFiles) assert.doesNotMatch(source, /setStatus\(error instanceof Error \? error\.message/, "main-path request errors are not rendered raw");

console.log(JSON.stringify({ ok: true, suite: "save-recovery", pointerVersion: 1, fixtures: ["legacy", "current", "corrupt", "stale"], normalizedRuntime: true, unknownFieldsPreserved: true }));
