import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const base = new URL(process.argv[2] || "http://127.0.0.1:3187");
assert(["127.0.0.1", "localhost"].includes(base.hostname), "Use a local development server");
const endpoint = new URL("/api/v1/town-play", base);
let cookie = "";
const requests = [];
async function request(body, options = {}) {
  const start = performance.now();
  const response = await fetch(endpoint, {
    method: body ? "POST" : "GET", signal: AbortSignal.timeout(60000),
    headers: { ...(cookie && !options.anonymous ? { Cookie: cookie } : {}), ...(body ? { Origin: options.origin ?? base.origin, "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    assert(setCookie.includes("HttpOnly") && setCookie.toLowerCase().includes("samesite=strict"));
    cookie = setCookie.split(";")[0];
  }
  const value = await response.json();
  requests.push({ kind: body?.kind ?? "read", status: response.status, elapsedMs: Math.round(performance.now() - start) });
  return { response, value };
}
const absent = await request(undefined, { anonymous: true });
assert.equal(absent.value.data.view, null);
const started = await request({ kind: "start" });
assert.equal(started.response.status, 200);
let view = started.value.data.view;
assert.equal(view.residentWorkEnabled, undefined);
let serial = 0;
async function command(action) {
  const body = { ...action, actionId: `work-http-${++serial}`, expectedSessionRevision: view.revision, expectedWorldRevision: view.worldRevision };
  const result = await request(body);
  assert.equal(result.response.status, 200, result.value.error?.message);
  assert.equal(result.response.headers.get("cache-control"), "private, no-store");
  view = result.value.data.view;
  return { body, result };
}
await command({ kind: "work-enable" });
assert.equal(view.time, "08:00");
const step = await command({ kind: "work-step" });
assert.equal(view.time, "08:05");
const retry = await request(step.body);
assert.equal(retry.value.data.replayed, true);
assert.deepEqual(retry.value.data.view, view);
await command({ kind: "arrive", sceneId: "books" });
const restorer = view.residents.find(person => person.npcId === "rb-xu-zhiwei");
assert.equal(restorer.visibility, "observed");
assert.equal(restorer.work.status, "working");
assert.equal(restorer.work.progress, 66);
const observed = { time: view.time, sceneId: view.sceneId, resident: { name: restorer.name, work: restorer.work } };
const completion = await command({ kind: "work-step" });
assert.equal(view.time, "08:15");
assert.equal(view.residents.find(person => person.npcId === "rb-xu-zhiwei").work.status, "idle");
const stale = await request({ ...completion.body, actionId: "work-http-stale" });
assert.equal(stale.response.status, 409);
const blocked = await request({ kind: "work-step" }, { origin: "https://foreign.invalid" });
assert.equal(blocked.response.status, 403);
await command({ kind: "arrive", sceneId: "inn" });
const remembered = view.residents.find(person => person.npcId === "rb-xu-zhiwei");
assert.equal(remembered.visibility, "last-seen");
assert.equal(remembered.work, undefined);
assert(!JSON.stringify(view).includes("pendingDecisions"));
assert(!JSON.stringify(view).includes("modelBudget"));
assert(!JSON.stringify(view).includes("currentGoal"));
assert.deepEqual((await request()).value.data.view, view);
assert.equal((await request(undefined, { anonymous: true })).value.data.view, null);
const files = ["app/api/v1/town-play/route.ts", "lib/world/town-exploration-store.ts", "lib/world/resident-decision-provider.ts", "packages/engine/src/town/resident-work.ts", "packages/engine/src/town-exploration.ts", "scripts/check-resident-work-http.mjs"];
const report = {
  schema: "resident-work-http-checks.v1", checkedAt: new Date().toISOString(), passed: true,
  base: base.origin, worldId: view.worldId, requests, observed,
  checks: ["anonymous-read-does-not-start-world", "owned-start-cookie", "explicit-work-opt-in", "real-five-minute-command", "idempotent-retry", "visible-work-66-percent", "real-completion-at-0815", "stale-CAS-rejected", "foreign-origin-rejected", "offscreen-work-private", "owned-reload", "anonymous-cannot-read-save"],
  evidence: { actualHttp: true, actualNextRoute: true, existingUserSaveTouched: false, modelProviderInspected: false, actualBrowserInteraction: false, blenderAnimationBound: false },
  sources: Object.fromEntries(files.map(file => [file, crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")]))
};
const output = path.join(process.cwd(), "output", "resident-work-v1");
fs.mkdirSync(output, { recursive: true });
const file = path.join(output, `http-${Date.now()}.json`);
fs.writeFileSync(file, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ passed: true, checks: report.checks.length, observed, report: file }));
