import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { NextRequest } from "next/server.js";
import { createNoirTestLoader } from "./noir-player-test-loader.mjs";

const root = process.cwd();
const run = fs.mkdtempSync(path.join(root, "outputs", "riverbend-session-"));
process.env.DATABASE_URL = path.join(run, "isolated.db");
const { load } = createNoirTestLoader(root);
const { GET, POST } = load("app/api/v1/town-play/route.ts");
const repository = load("lib/world/repository.ts");
const { worldRepository: repo } = repository;
const { withPrivateWorldAccess } = load("lib/world/private-world-access.ts");
const { createInitialWorld } = load("packages/engine/src/world-simulator.ts");
const origin = "http://localhost:3187";
const endpoint = `${origin}/api/v1/town-play`;
const old = createInitialWorld("legacy-preserved");
repo.saveWorld(old);
const oldData = JSON.stringify(repo.getWorld(old.id));
const checks = [];
function check(name, condition = true) { assert(condition, name); checks.push(name); }
async function send(body, cookie, requestOrigin = origin) {
  const response = await POST(new NextRequest(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Origin: requestOrigin, ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) }));
  return { response, status: response.status, body: await response.json() };
}
async function read(cookie) {
  const response = await GET(new NextRequest(endpoint, { headers: cookie ? { Cookie: cookie } : {} }));
  return { status: response.status, body: await response.json() };
}
try {
  assert.equal((await read()).body.data.view, null);
  const started = await send({ kind: "start" });
  assert.equal(started.status, 200);
  const setCookie = started.response.headers.get("set-cookie");
  const cookie = setCookie.split(";")[0];
  assert(/HttpOnly/i.test(setCookie) && /SameSite=strict/i.test(setCookie));
  check("httponly-browser-identity");
  let view = started.body.data.view;
  assert.equal(view.time, "08:00");
  assert.equal(view.residents.length, 3);
  assert(view.residents.every(resident => resident.visibility === "observed"));
  const originalWorldId = view.worldId;
  assert.equal((await send({ kind: "start" }, cookie)).body.data.view.worldId, originalWorldId);
  check("start-resumes-owned-world");
  const make = (kind, extra, id) => ({ kind, ...extra, actionId: id, expectedSessionRevision: view.revision, expectedWorldRevision: view.worldRevision });
  const cafe = make("arrive", { sceneId: "cafe" }, "first-cafe");
  const arrived = await send(cafe, cookie);
  assert.equal(arrived.status, 200);
  view = arrived.body.data.view;
  assert.equal(view.time, "08:05");
  assert.equal(view.sceneId, "cafe");
  assert.deepEqual(view.visitedSceneIds, ["cafe"]);
  assert.equal(view.residents.filter(resident => resident.visibility === "observed").length, 2);
  assert.equal(view.residents.filter(resident => resident.visibility === "last-seen").length, 3);
  check("real-world-travel-and-observed-people");
  const serialized = JSON.stringify(view);
  for (const field of ["schedule", "secret", "motiveSeed", "truth", "owner_hash", "agentStates", "dailyRoutine", "secretRisk"]) assert(!serialized.includes(`"${field}"`));
  check("player-response-whitelist");
  repository.closeDatabase();
  assert.deepEqual((await read(cookie)).body.data.view, view);
  const replay = await send(cafe, cookie);
  assert.equal(replay.body.data.replayed, true);
  assert.equal(replay.body.data.view.time, "08:05");
  check("save-reopen-and-durable-retry");
  assert.equal((await send({ ...cafe, sceneId: "post" }, cookie)).status, 409);
  assert.equal((await send({ ...cafe, actionId: "stale-cafe" }, cookie)).status, 409);
  assert.equal((await send(make("wait", { minutes: -10 }, "bad-wait"), cookie)).status, 400);
  assert.equal((await send(make("arrive", { sceneId: "house-east" }, "private-home"), cookie)).status, 400);
  assert.equal((await send(make("arrive", { sceneId: "books" }, "cross-site"), cookie, "https://other.invalid")).status, 403);
  const forged = cookie.slice(0, -64) + "0".repeat(64);
  assert.equal((await read(forged)).status, 401);
  assert.equal((await send({ kind: "start" }, forged)).status, 401);
  check("stale-reused-forged-cross-site-and-closed-place-rejections");
  const second = await send({ kind: "start" });
  const secondCookie = second.response.headers.get("set-cookie").split(";")[0];
  const secondView = second.body.data.view;
  assert.notEqual(secondView.worldId, view.worldId);
  const townId = view.worldId;
  const db = repository.getDb();
  const snapshot = () => withPrivateWorldAccess(townId, () => ({ world: JSON.stringify(repo.getWorld(townId)), session: db.prepare("select data from town_exploration_sessions where world_id = ?").get(townId).data, events: repo.getEvents(townId) }));
  const before = snapshot();
  db.exec("create trigger test_receipt_failure before insert on town_exploration_receipts begin select raise(abort, 'intentional receipt failure'); end;");
  const bookCommand = make("arrive", { sceneId: "books" }, "save-books");
  assert.equal((await send(bookCommand, cookie)).status, 500);
  assert.deepEqual(snapshot(), before, "A failed receipt left partial world or player writes");
  db.exec("drop trigger test_receipt_failure;");
  const books = await send({ ...bookCommand, worldId: secondView.worldId, sessionId: secondView.sessionId }, cookie);
  assert.equal(books.status, 200);
  view = books.body.data.view;
  assert.equal(view.worldId, townId);
  assert.deepEqual((await read(secondCookie)).body.data.view, secondView);
  check("receipt-failure-rolls-back-world-events-and-player");
  check("client-world-id-cannot-select-another-save");
  db.prepare("update town_exploration_receipts set created_at = '2020-01-01T00:00:00Z' where action_id = 'save-books'").run();
  assert.equal((await send(bookCommand, cookie)).body.data.replayed, true);
  check("retry-remains-idempotent-after-old-15-minute-window");
  for (let hour = 0; hour < 4; hour++) {
    const result = await send(make("wait", { minutes: 60 }, `wait-hour-${hour}`), cookie);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    view = result.body.data.view;
  }
  const noon = await send(make("wait", { minutes: 30 }, "finish-lunch-commute"), cookie);
  assert.equal(noon.status, 200);
  view = noon.body.data.view;
  const actual = withPrivateWorldAccess(townId, () => repo.getWorld(townId));
  assert.equal(actual.npcs.filter(npc => npc.alive).length, 12);
  for (const npc of actual.npcs) assert.equal(actual.persistentRuntime.agentStates.find(agent => agent.npcId === npc.id).locationId, npc.schedule["12:00"], `${npc.name} did not reach the authored lunch destination`);
  assert(withPrivateWorldAccess(townId, () => repo.getEvents(townId)).some(event => event.tags.includes("daily_routine")));
  check("all-12-residents-follow-lunch-routes-in-real-engine");
  assert.equal(JSON.stringify(repo.getWorld(old.id)), oldData);
  check("legacy-world-left-intact");
  assert.equal(repo.getWorld(townId), null);
  assert.deepEqual(repo.getEvents(townId), []);
  assert(!repo.listWorlds().some(world => world.id === townId || world.id === secondView.worldId));
  assert(repo.listWorlds().some(world => world.id === old.id));
  assert.throws(() => repo.saveWorld(actual), /Private town access/);
  assert.throws(() => repo.saveWorldBundle({ world: actual }), /Private town access/);
  assert.throws(() => repo.saveWorldBundleIfRuntimeRevision({ world: actual, expectedRevision: view.worldRevision }), /Private town access/);
  await Promise.all([
    withPrivateWorldAccess(townId, async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal(repo.getWorld(townId).id, townId);
      assert.equal(repo.getWorld(secondView.worldId), null);
    }),
    (async () => { await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(repo.getWorld(townId), null); })()
  ]);
  assert.equal(repo.getWorld(townId), null, "Authenticated scope leaked beyond its callback");
  check("private-world-read-write-list-and-concurrent-scope-isolation");
  // Sentinel records test storage isolation only; these are not playable case
  // content or investigation proof, and live solely in this disposable DB.
  const boundaryCase = { id: "private-boundary-case", worldId: townId, createdAt: new Date().toISOString(), sentinel: "not-a-real-case" };
  const boundarySession = { id: "private-boundary-player", worldId: townId, caseId: boundaryCase.id, playerId: "boundary", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  withPrivateWorldAccess(townId, () => { repo.saveCase(boundaryCase); repo.saveSession(boundarySession); });
  assert.equal(repo.getCase(boundaryCase.id), null);
  assert.equal(repo.getActiveCase(townId), null);
  assert.equal(repo.getSession(boundarySession.id), null);
  assert.deepEqual(repo.listSessions(townId, boundaryCase.id), []);
  const privateEvent = withPrivateWorldAccess(townId, () => repo.getEvents(townId)[0]);
  assert(privateEvent);
  assert.throws(() => repo.addEvents([{ ...privateEvent, worldId: old.id }]), /Private town access/);
  assert.throws(() => repo.saveCase({ ...boundaryCase, worldId: old.id }), /Private town access/);
  assert.throws(() => repo.saveSession({ ...boundarySession, worldId: old.id }), /Private town access/);
  check("case-session-and-event-identifiers-cannot-rebind-private-records");
  const historicalState = load("app/api/v1/query/world/state/route.ts");
  assert.equal((await historicalState.GET(new Request(`${origin}/api/v1/query/world/state?worldId=${townId}`))).status, 404);
  const historicalTick = load("app/api/worlds/[worldId]/tick/route.ts");
  assert.equal((await historicalTick.POST(new Request(`${origin}/api/worlds/${townId}/tick`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }), { params: Promise.resolve({ worldId: townId }) })).status, 404);
  assert.deepEqual((await read(cookie)).body.data.view, view);
  check("legacy-world-query-and-tick-cannot-bypass-owned-session");
  const paths = ["lib/world/town-exploration-store.ts", "lib/world/repository.ts", "lib/world/private-world-access.ts", "app/api/v1/town-play/route.ts", "lib/town-play-contract.ts", "packages/engine/src/town/daily-routine.ts", "packages/engine/src/persistent-town.ts", "packages/engine/src/town-exploration.ts", "packages/engine/src/riverbend-world.ts", "scripts/run-town-play-session-checks.mjs"];
  const receipt = { schema: "riverbend-session-checks.v1", passed: true, checkedAt: new Date().toISOString(), checks, sources: Object.fromEntries(paths.map(p => [p, crypto.createHash("sha256").update(fs.readFileSync(path.join(root, p))).digest("hex")])), scope: "Real Next route functions, SQLite transactions and engine in an isolated database; browser, full case and production deployment remain separate.", finalPublicTime: view.time };
  fs.writeFileSync(path.join(root, "docs/3d-town/riverbend-v1/session-review.json"), JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify({ passed: true, checks, finalPublicTime: view.time, databaseScope: "isolated test database" }));
} finally { repository.closeDatabase(); }
