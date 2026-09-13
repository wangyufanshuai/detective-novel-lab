import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

// Execute the real route functions and repository against a new SQLite file.
// Only the LLM and persistent-town progression adapter are replaced: no HTTP,
// credentials, user saves, or production build are needed for these races.
const root = process.cwd();
fs.mkdirSync(path.join(root, "outputs"), { recursive: true });
const runtimeDir = fs.mkdtempSync(path.join(root, "outputs", "interrogation-boundary-"));
process.env.DATABASE_URL = path.join(runtimeDir, "test.db");
const nativeRequire = createRequire(import.meta.url);
const modules = new Map();
const pendingReplies = [];
const aiCalls = [];
const progressionCalls = [];
const aiStub = {
  generateGuardedNpcReplyWithAudit(input) {
    assert.equal(repository.getDb().inTransaction, false, "no SQLite transaction spans the model await");
    aiCalls.push(structuredClone(input));
    return new Promise((resolve) => pendingReplies.push(() => resolve({
      content: "我会解释自己知道的事情。", mock: true, promptAudit: {}, dialogueEval: {}, safetyFlags: [], memoryCount: 0, evidenceCount: input.discoveredEvidenceIds.length
    })));
  }
};
const runtimeStub = {
  isRuntimeInvestigationAuthority: () => true,
  getRuntimeFactionRelationshipSummary: () => undefined,
  recordRuntimeInvestigatorProgressionStep(...args) { progressionCalls.push(args); },
  recordRuntimePlayerResourceCommitmentStep(...args) { progressionCalls.push(args); },
  recordRuntimeCampaignFailure(...args) { progressionCalls.push(args); },
  loadRuntimeWorld: () => null,
  settleRuntimeWorldLeadOutcomeAndPrepareHandoff: () => undefined
};

function loadTs(relativePath) {
  let absolute = path.resolve(root, relativePath);
  if (!path.extname(absolute)) absolute = fs.existsSync(`${absolute}.ts`) ? `${absolute}.ts` : path.join(absolute, "index.ts");
  if (modules.has(absolute)) return modules.get(absolute).exports;
  const module = { exports: {} };
  modules.set(absolute, module);
  const source = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const requireForFile = (specifier) => {
    if (specifier === "@/lib/world/ai") return aiStub;
    if (specifier === "@/app/api/v1/_town-runtime") return runtimeStub;
    if (specifier.startsWith("@/")) return loadTs(specifier.slice(2));
    if (specifier.startsWith(".")) return loadTs(path.resolve(path.dirname(absolute), specifier));
    return nativeRequire(specifier);
  };
  vm.runInThisContext(`(function(require,module,exports,__filename,__dirname) {\n${source}\n})`, { filename: absolute })(requireForFile, module, module.exports, absolute, path.dirname(absolute));
  return module.exports;
}

const repository = loadTs("lib/world/repository.ts");
const { worldRepository: repo, closeDatabase, getDb } = repository;
const engine = loadTs("lib/engine/index.ts");
const playerInterrogate = loadTs("app/api/investigation/interrogate/route.ts").POST;
const v1Interrogate = loadTs("app/api/v1/command/investigation/interrogate/route.ts").POST;
const discover = loadTs("app/api/investigation/discover/route.ts").POST;
const submit = loadTs("app/api/investigation/submit-theory/route.ts").POST;
const v1Submit = loadTs("app/api/v1/command/investigation/submit-theory/route.ts").POST;
const checks = [];
const now = "2026-09-06T00:00:00.000Z";
const deductionCase = engine.createShowcaseCase("interrogation boundaries");
const characterId = deductionCase.characters[0].id;
const secondCharacterId = deductionCase.characters[1].id;
const evidenceIds = deductionCase.evidence.filter((evidence) => evidence.discoverable).map((evidence) => evidence.id);
assert.ok(evidenceIds.length >= 2);
const world = { id: "boundary-world", seed: "boundary", name: "Boundary test", day: 1, currentTime: "08:00", locations: [], npcs: [], memories: [], simulationReports: [], createdAt: now, updatedAt: now };
const activeCase = {
  id: "boundary-case", worldId: world.id, sourceEventIds: [], deathEventId: "test-event", createdAt: now,
  generationProfile: { sceneLocationId: deductionCase.scenes[0]?.id }, sourceMap: {}, qualityReport: { marker: "original" }, validation: {}, deductionCase,
  testimonies: [characterId, secondCharacterId].map((id, index) => ({
    id: `testimony-${index}`, characterId: id, currentStatement: "原证词", originalStatement: "原证词", contradictionEvidenceIds: [evidenceIds[index]], exposedContradictions: [], revised: false
  }))
};

function seed(suffix = "base") {
  repo.saveWorld(structuredClone(world));
  repo.saveCase(structuredClone(activeCase));
  const session = { id: `boundary-session-${suffix}`, worldId: world.id, caseId: activeCase.id, playerId: "test-player", displayName: "Test", discoveredEvidenceIds: [evidenceIds[0]], interrogationLog: [], createdAt: now, updatedAt: now };
  repo.saveSession(session);
  return session;
}

const request = (body) => new Request("http://localhost.test/api/investigation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const askBody = (session, extra = {}) => ({ sessionId: session.id, characterId, question: "请解释当时发生的事。", provider: "mock", ...extra });
async function startPending(handler, body) {
  const before = aiCalls.length;
  const result = handler(request(body));
  for (let attempt = 0; attempt < 100 && aiCalls.length === before; attempt += 1) await new Promise(setImmediate);
  assert.equal(aiCalls.length, before + 1, "request reached controlled model boundary");
  return { result, release: pendingReplies.pop() };
}
async function check(name, run) {
  await run();
  checks.push(name);
  console.log(`PASS ${name}`);
}

try {
  await check("both endpoints reject unknown characters and inaccessible evidence before AI or writes", async () => {
    const session = seed("validation");
    const startCalls = aiCalls.length;
    const startProgress = progressionCalls.length;
    for (const handler of [playerInterrogate, v1Interrogate]) {
      for (const extra of [{ characterId: "foreign-character" }, { evidenceId: "foreign-evidence" }, { evidenceId: evidenceIds[1] }, { evidenceId: "" }, { question: "  " }, { characterId: 3 }]) {
        const response = await handler(request(askBody(session, extra)));
        assert.equal(response.status, 400);
        assert.equal((await response.json()).ok, false);
      }
    }
    assert.equal(aiCalls.length, startCalls);
    assert.equal(progressionCalls.length, startProgress);
    assert.equal(repo.getSession(session.id).interrogationLog.length, 0);
    assert.equal(repo.getCase(activeCase.id).testimonies[0].revised, false);
  });

  await check("slow interrogation preserves discovery and submitted judgement committed during the wait", async () => {
    const session = seed("discover-submit");
    const pending = await startPending(playerInterrogate, askBody(session));
    const discoveredResponse = await discover(request({ sessionId: session.id, evidenceId: evidenceIds[1] }));
    assert.equal(discoveredResponse.status, 200);
    const theory = { culpritId: "wrong-character", motive: "", method: "", evidenceIds: [], proof: { motiveEvidenceIds: [], methodEvidenceIds: [] } };
    const submittedResponse = await submit(request({ sessionId: session.id, theory }));
    assert.equal(submittedResponse.status, 200);
    const submitted = await submittedResponse.json();
    pending.release();
    const response = await pending.result;
    assert.equal(response.status, 200);
    const result = await response.json();
    const saved = repo.getSession(session.id);
    assert.deepEqual(saved.discoveredEvidenceIds, [evidenceIds[0], evidenceIds[1]]);
    assert.deepEqual(saved.submittedTheory, theory);
    assert.deepEqual(saved.judgement, submitted.judgement);
    assert.equal(saved.interrogationLog.length, 1);
    assert.deepEqual(result.session, saved);
  });

  await check("two overlapping interrogations preserve both logs, testimony revisions, and newer case fields", async () => {
    const session = seed("two-replies");
    repo.saveSession({ ...session, discoveredEvidenceIds: evidenceIds });
    const first = await startPending(playerInterrogate, askBody(session, { evidenceId: evidenceIds[0] }));
    const second = await startPending(v1Interrogate, askBody(session, { characterId: secondCharacterId, evidenceId: evidenceIds[1] }));
    repo.saveCase({ ...repo.getCase(activeCase.id), qualityReport: { marker: "changed-while-model-pending" } });
    second.release();
    const secondResponse = await second.result;
    assert.equal(secondResponse.status, 200);
    const secondResult = await secondResponse.json();
    assert.equal(secondResult.ok, true);
    assert.equal(secondResult.data.entry.characterId, secondCharacterId, "v1 keeps its data envelope");
    first.release();
    assert.equal((await first.result).status, 200);
    const saved = repo.getSession(session.id);
    assert.deepEqual(saved.interrogationLog.map((entry) => entry.characterId), [secondCharacterId, characterId]);
    const currentCase = repo.getCase(activeCase.id);
    assert.equal(currentCase.qualityReport.marker, "changed-while-model-pending");
    assert.ok(currentCase.testimonies.every((testimony) => testimony.revised));
  });

  await check("evidence revoked during model wait is rejected again before logs or testimony writes", async () => {
    const session = seed("revoked");
    const pending = await startPending(playerInterrogate, askBody(session, { evidenceId: evidenceIds[0] }));
    repo.saveSession({ ...session, discoveredEvidenceIds: [] });
    const progressBefore = progressionCalls.length;
    pending.release();
    assert.equal((await pending.result).status, 400);
    assert.equal(repo.getSession(session.id).interrogationLog.length, 0);
    assert.equal(repo.getCase(activeCase.id).testimonies[0].revised, false);
    assert.equal(progressionCalls.length, progressBefore);
  });

  await check("character removed during model wait is rejected before writes", async () => {
    const session = seed("removed-character");
    const pending = await startPending(v1Interrogate, askBody(session));
    repo.saveCase({ ...activeCase, deductionCase: { ...deductionCase, characters: deductionCase.characters.filter((character) => character.id !== characterId) } });
    pending.release();
    assert.equal((await pending.result).status, 400);
    assert.equal(repo.getSession(session.id).interrogationLog.length, 0);
  });

  await check("session identity changes reject stale replies instead of writing into the new case", async () => {
    for (const replacement of [{ caseId: "other-case" }, { worldId: "other-world" }, { playerId: "other-player" }, { createdAt: "2026-09-06T01:00:00.000Z" }]) {
      const session = seed(`identity-${Object.keys(replacement)[0]}`);
      const pending = await startPending(playerInterrogate, askBody(session));
      repo.saveSession({ ...session, ...replacement });
      pending.release();
      assert.equal((await pending.result).status, 409);
      assert.equal(repo.getSession(session.id).interrogationLog.length, 0);
    }
  });

  await check("case world identity is rechecked after the model wait", async () => {
    const session = seed("case-world");
    const pending = await startPending(playerInterrogate, askBody(session));
    repo.saveCase({ ...activeCase, worldId: "foreign-world" });
    pending.release();
    assert.equal((await pending.result).status, 409);
    assert.equal(repo.getSession(session.id).interrogationLog.length, 0);
  });

  await check("case replaced under the same storage key rejects an old model reply", async () => {
    const session = seed("case-replacement");
    const pending = await startPending(playerInterrogate, askBody(session));
    repo.saveCase({ ...activeCase, deductionCase: { ...deductionCase, id: "replacement-deduction-case" } });
    pending.release();
    assert.equal((await pending.result).status, 409);
    assert.equal(repo.getSession(session.id).interrogationLog.length, 0);
  });

  await check("removed sessions are not resurrected by a late reply", async () => {
    const session = seed("removed-session");
    const pending = await startPending(playerInterrogate, askBody(session));
    getDb().prepare("delete from sessions where id = ?").run(session.id);
    pending.release();
    assert.equal((await pending.result).status, 404);
    assert.equal(repo.getSession(session.id), null);
  });

  await check("same persisted entry ID is idempotent and conflicting reuse is rejected", async () => {
    const session = seed("entry-retry");
    const entry = engine.makeRuleBoundInterrogation(world, [], deductionCase, session.id, characterId, "问题", session.discoveredEvidenceIds);
    repo.appendInterrogation(session, entry);
    const changed = repo.getSession(session.id);
    repo.saveSession({ ...changed, discoveredEvidenceIds: evidenceIds });
    const saved = repo.appendInterrogation(session, entry);
    assert.equal(saved.interrogationLog.length, 1);
    assert.deepEqual(saved.discoveredEvidenceIds, evidenceIds);
    assert.throws(() => repo.appendInterrogation(session, { ...entry, question: "不同问题" }), /already used/);
  });

  await check("transaction rolls back testimony when session persistence fails", async () => {
    const session = seed("rollback");
    const entry = engine.makeRuleBoundInterrogation(world, [], deductionCase, session.id, characterId, "问题", session.discoveredEvidenceIds, evidenceIds[0]);
    getDb().exec("create trigger reject_interrogation_test before update on sessions begin select raise(abort, 'forced persistence failure'); end");
    assert.throws(() => repo.appendInterrogation(session, entry, (currentCase) => ({ ...currentCase, qualityReport: { marker: "must-roll-back" } })), /forced persistence failure/);
    getDb().exec("drop trigger reject_interrogation_test");
    assert.equal(repo.getCase(activeCase.id).qualityReport.marker, "original");
    assert.equal(repo.getSession(session.id).interrogationLog.length, 0);
  });

  await check("both submission endpoints preserve proof assignments and redact rejected coverage answers", async () => {
    for (const [name, handler] of [["player", submit], ["v1", v1Submit]]) {
      const session = seed(`proof-${name}`);
      const proof = { motiveEvidenceIds: [evidenceIds[0]], methodEvidenceIds: [] };
      const theory = { culpritId: deductionCase.truth.culpritId, motive: "自己的笔记", method: "自己的笔记", evidenceIds: [evidenceIds[0]], proof };
      const response = await handler(request({ sessionId: session.id, theory }));
      assert.equal(response.status, 200);
      const envelope = await response.json();
      const result = name === "v1" ? envelope.data : envelope;
      assert.equal(result.judgement.accepted, false);
      assert.deepEqual(result.session.submittedTheory.proof, proof);
      assert.deepEqual(repo.getSession(session.id).submittedTheory.proof, proof);
      assert.ok(result.judgement.proofCoverage.gaps.length > 0);
      assert.ok(result.judgement.proofCoverage.gaps.every((gap) => gap.missingEvidenceIds.length === 0 && gap.missingEventIds.length === 0 && gap.missingMemoryIds.length === 0));
      assert.ok(result.judgement.proofCoverage.gaps.every((gap) => gap.obligationId.startsWith("proof-gap:")));
      assert.deepEqual(repo.getSession(session.id).judgement, result.judgement);
    }
  });

  await check("malformed theories are rejected before persistence or campaign side effects", async () => {
    const validShape = { culpritId: characterId, motive: "", method: "", evidenceIds: [] };
    const malformed = [null, [], "theory", {}, { ...validShape, motive: 4 }, { ...validShape, evidenceIds: "evidence" }, { ...validShape, proof: null }, { ...validShape, proof: { motiveEvidenceIds: [], methodEvidenceIds: [42] } }, { ...validShape, unknownAnswer: "injected" }];
    for (const [name, handler] of [["player", submit], ["v1", v1Submit]]) {
      const session = seed(`malformed-${name}`);
      const progressBefore = progressionCalls.length;
      for (const theory of malformed) {
        const response = await handler(request({ sessionId: session.id, theory }));
        assert.equal(response.status, 400);
      }
      assert.deepEqual(repo.getSession(session.id), session);
      assert.equal(progressionCalls.length, progressBefore);
      const malformedJson = new Request("http://localhost.test/api/investigation", { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
      assert.equal((await handler(malformedJson)).status, 400);
    }
  });

  await check("both APIs accept complete structured proof with empty optional notes", async () => {
    const demo = engine.createStaticDemoRuntime();
    const playableCase = demo.activeCase.deductionCase;
    const playableEvidenceIds = playableCase.evidence.filter((item) => item.discoverable).map((item) => item.id);
    const ledger = engine.buildDeductionCaseTruthLedger(playableCase);
    const proof = {
      motiveEvidenceIds: [...new Set(ledger.obligations.filter((item) => item.required && item.kind === "motive").flatMap((item) => item.evidenceIds))],
      methodEvidenceIds: [...new Set(ledger.obligations.filter((item) => item.required && item.kind === "means").flatMap((item) => item.evidenceIds))]
    };
    for (const [name, handler] of [["player", submit], ["v1", v1Submit]]) {
      repo.saveWorld(demo.world);
      repo.saveCase(demo.activeCase);
      const session = { ...demo.session, id: `boundary-empty-notes-${name}`, discoveredEvidenceIds: playableEvidenceIds };
      repo.saveSession(session);
      const theory = { culpritId: playableCase.truth.culpritId, motive: "", method: "", evidenceIds: playableEvidenceIds, proof };
      const response = await handler(request({ sessionId: session.id, theory }));
      assert.equal(response.status, 200);
      const envelope = await response.json();
      const result = name === "v1" ? envelope.data : envelope;
      assert.equal(result.judgement.accepted, true, `blank notes do not block correct structured proof: ${JSON.stringify({ judgement: result.judgement, proof })}`);
      assert.equal(result.judgement.score, 100);
      assert.deepEqual(repo.getSession(session.id).submittedTheory, theory);
    }
  });

  closeDatabase();
  assert.ok(repo.getSession("boundary-session-discover-submit").judgement, "merged judgement survives database reopen");
  const report = { ok: true, checkCount: checks.length, checks, database: process.env.DATABASE_URL, realSQLite: true, realRouteFunctions: true, model: "controlled deferred stub; no network", limitation: "No requestId protocol: separate HTTP retries still create separate questions. Runtime progression is outside the session/case transaction." };
  fs.writeFileSync(path.join(runtimeDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  closeDatabase();
}
