import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";

// Test the component's actual async lock implementation, not a reimplementation
// or an assertion that its source happens to contain a ref name.
const source = await fs.readFile(new URL("../app/components/CinematicDeductionBoard.tsx", import.meta.url), "utf8");
const file = ts.createSourceFile("CinematicDeductionBoard.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = [];
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "runExclusive") functions.push(node.getText(file));
  ts.forEachChild(node, visit);
}
visit(file);
assert.equal(functions.length, 1, "one actual exclusive action implementation");
const harness = `export function createHarness(effectiveBusy = false) {
  const actionLock = { current: false };
  const model = { currentTask: { action: { label: "Controlled action" } } };
  let localBusy = false;
  const history = [];
  const resolutions = [];
  const setLocalBusy = (value) => { localBusy = value; history.push(value); };
  const runWithResolution = async (label, execute) => {
    const result = await execute();
    resolutions.push({ label, result });
  };
  ${functions[0]}
  return { run: runExclusive, locked: () => actionLock.current, busy: () => localBusy, history, resolutions };
}`;
const compiled = ts.transpileModule(harness, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createHarness } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const busy = createHarness(true);
let blockedCalls = 0;
await busy.run(() => { blockedCalls += 1; });
assert.equal(blockedCalls, 0, "an externally busy action is not dispatched");
assert.deepEqual(busy.history, [], "blocked actions do not invent local progress");

const active = createHarness();
let finish;
const pending = new Promise((resolve) => { finish = resolve; });
let dispatches = 0;
const first = active.run(() => { dispatches += 1; return pending; });
assert.equal(active.locked(), true, "lock is taken before the promise settles");
assert.equal(active.busy(), true, "pending action exposes local busy state");
await active.run(() => { dispatches += 1; });
assert.equal(dispatches, 1, "rapid duplicate calls dispatch only once");
finish();
await first;
assert.equal(active.locked(), false);
assert.equal(active.busy(), false);
assert.deepEqual(active.history, [true, false], "successful operation returns to idle once");

const rejection = new Error("controlled test rejection");
await assert.rejects(active.run(() => Promise.reject(rejection)), (error) => error === rejection);
assert.equal(active.locked(), false, "rejected promise releases lock");
assert.equal(active.busy(), false, "rejected promise releases local busy state");
await assert.rejects(active.run(() => { throw rejection; }), (error) => error === rejection);
assert.equal(active.locked(), false, "synchronous exception releases lock");
assert.equal(active.busy(), false);
await active.run(() => { dispatches += 1; });
assert.equal(dispatches, 2, "a player retry can run after failure");
assert.deepEqual(active.history, [true, false, true, false, true, false, true, false]);
assert.equal(active.resolutions[0].result.status, "blocked", "a void action result cannot invent a successful settlement");
const outcomes = createHarness();
for (const status of ["succeeded", "failed", "blocked", "rejected", "cancelled"]) {
  const result = { status, detail: `Controlled ${status}` };
  await outcomes.run(async () => result, `Action ${status}`);
  assert.deepEqual(outcomes.resolutions.at(-1), { label: `Action ${status}`, result }, "the component sends the actual outcome and label to the resolution owner");
  assert.equal(outcomes.locked(), false, `${status} returns the lock to idle`);
}

console.log(JSON.stringify({
  ok: true,
  suite: "cinematic-action-lock",
  checks: ["external-busy", "immediate-lock", "duplicate-suppression", "success-restoration", "async-failure-restoration", "sync-failure-restoration", "retry-after-failure", "void-not-success", "explicit-outcome-forwarding"],
  limits: ["Function-level checks, not DOM or unmount tests.", "The resolution owner is a recording test adapter; user-visible failure feedback is covered separately."]
}, null, 2));
