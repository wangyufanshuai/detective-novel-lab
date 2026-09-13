import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";

const source = await fs.readFile(new URL("../app/campaign/cinematic-spatial-transfer.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { spatialTransferKeyframes, createCinematicSpatialTransfer } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const from = { left: 20, top: 40, width: 100, height: 80 };
const to = { left: 240, top: 160, width: 200, height: 120 };
assert.equal(spatialTransferKeyframes(from, to)[1].transform, "translate(220px, 120px)");
assert.equal(spatialTransferKeyframes(to, from).some((frame) => frame.transform.includes("scale")), false, "moving a small label back to a card never magnifies its text");
assert.equal(spatialTransferKeyframes({ ...from, width: 0 }, to), null);
assert.equal(spatialTransferKeyframes(from, { ...to, left: NaN }), null);

const frames = new Map();
const mounted = new Set();
const animations = [];
let frameId = 0;
const view = {
  innerWidth: 1440, innerHeight: 960,
  requestAnimationFrame: (callback) => { frames.set(++frameId, callback); return frameId; },
  cancelAnimationFrame: (id) => frames.delete(id),
  getComputedStyle: () => ({ font: "16px Georgia", color: "ivory", backgroundColor: "black", border: "1px solid gold", getPropertyValue: () => "gold" })
};
const document = { defaultView: view, body: { append: (node) => mounted.add(node) } };
function ghost() {
  const attributes = new Map([["id", "original-card"], ["data-testid", "original-selector"], ["aria-live", "polite"]]);
  return {
    style: { setProperty() {} },
    get attributes() { return [...attributes].map(([name]) => ({ name })); },
    removeAttribute: (name) => attributes.delete(name),
    setAttribute: (name, value) => attributes.set(name, value),
    getAttribute: (name) => attributes.get(name),
    querySelectorAll: () => [],
    remove() { mounted.delete(this); },
    animate(keyframes, options) {
      let resolve, reject;
      const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
      const animation = { keyframes, options, finished, finish: resolve, cancel: () => reject(new Error("cancelled")) };
      animations.push(animation);
      return animation;
    }
  };
}
const card = { ownerDocument: document, isConnected: true, getBoundingClientRect: () => from, cloneNode: ghost, animate() {} };
const target = { isConnected: true, getBoundingClientRect: () => to };
function flushFrame() { const queued = [...frames.values()]; frames.clear(); queued.forEach((callback) => callback()); }
const controller = createCinematicSpatialTransfer();
controller.start(card, () => target, true);
assert.equal(frames.size, 0, "reduced motion creates no scheduled animation");
controller.start(card, () => target, false);
const staleFrame = [...frames.values()][0];
controller.cancel();
staleFrame();
assert.equal(mounted.size, 0, "cancelled frame cannot reinsert a ghost");

controller.start(card, () => target, false);
flushFrame();
assert.equal(mounted.size, 1);
const firstGhost = [...mounted][0];
assert.equal(firstGhost.inert, true);
assert.equal(firstGhost.getAttribute("aria-hidden"), "true");
assert.equal(firstGhost.getAttribute("id"), undefined);
assert.equal(firstGhost.getAttribute("data-testid"), undefined);
assert.equal(firstGhost.getAttribute("aria-live"), undefined);
assert.equal(animations[0].options.duration, 320);
assert.deepEqual(animations[0].keyframes, spatialTransferKeyframes(from, to));
controller.start(card, () => target, false);
assert.equal(mounted.size, 0, "new selection cancels previous transfer synchronously");
flushFrame();
await Promise.resolve();
assert.equal(mounted.size, 1, "old completion cannot remove the new transfer");
animations.at(-1).finish();
await Promise.resolve();
assert.equal(mounted.size, 0, "finished transfer removes its copy");

controller.start(card, () => ({ ...target, getBoundingClientRect: () => ({ ...to, top: 1500 }) }), false);
flushFrame();
assert.equal(mounted.size, 0, "offscreen targets do not force animation or scroll");
controller.start(card, () => null, false);
flushFrame();
assert.equal(mounted.size, 0, "unmounted destination produces no ghost");
controller.start(card, () => target, false);
flushFrame();
controller.start(card, () => target, true);
await Promise.resolve();
assert.equal(mounted.size, 0, "switching to reduced mode cancels active motion");
controller.cancel();
assert.equal(frames.size, 0);
for (const kind of ["witness", "theory"]) {
  controller.start(card, () => target, false, kind);
  flushFrame();
  assert.equal([...mounted][0].getAttribute("data-cinematic-spatial-transfer"), kind);
  animations.at(-1).finish();
  await Promise.resolve();
  assert.equal(mounted.size, 0);
}

// Execute the actual theory-toggle callback with a failing presentation layer.
const boardSource = await fs.readFile(new URL("../app/components/CinematicDeductionBoard.tsx", import.meta.url), "utf8");
const boardFile = ts.createSourceFile("board.tsx", boardSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const toggleCallbacks = [];
function visit(node) {
  if (ts.isJsxAttribute(node) && node.name.getText(boardFile) === "onClick" && node.initializer && ts.isJsxExpression(node.initializer)) {
    const expression = node.initializer.expression?.getText(boardFile);
    if (expression?.includes("actionAdapter.toggleTheoryEvidence")) toggleCallbacks.push(expression);
  }
  ts.forEachChild(node, visit);
}
visit(boardFile);
assert.equal(toggleCallbacks.length, 1);
const callbackHarness = `export function run(removing, brokenMotion, effectiveBusy) {
  let toggles = 0; let cancelled = 0; let transfer;
  const card = {}; const pill = {};
  const item = { state: removing ? 'selected' : 'discovered', sourceIndex: 2 };
  const source = { evidenceId: 'test-clue' };
  const lowSensory = false;
  const window = { matchMedia: () => ({ matches: false }) };
  const theoryEvidenceRefs = { current: new Map([[2, pill]]) };
  const spatialTransfer = {
    cancel: () => { cancelled++; },
    start: (origin, destination, reduced, kind) => {
      transfer = { from: origin === card ? 'card' : 'pill', to: destination() === card ? 'card' : 'pill', kind };
      if (brokenMotion) throw new Error('controlled motion failure');
    }
  };
  const actionAdapter = { toggleTheoryEvidence: (id) => { if (id !== 'test-clue') throw new Error('wrong clue'); toggles++; } };
  const onClick = ${toggleCallbacks[0]};
  onClick({ currentTarget: { closest: () => card } });
  return { toggles, cancelled, transfer };
}`;
const callbackJs = ts.transpileModule(callbackHarness, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { run } = await import(`data:text/javascript;base64,${Buffer.from(callbackJs).toString("base64")}`);
for (const removing of [false, true]) for (const brokenMotion of [false, true]) for (const busy of [false, true]) {
  const result = run(removing, brokenMotion, busy);
  assert.equal(result.toggles, busy ? 0 : 1, "animation success/failure never changes the authoritative toggle count");
  if (!busy) {
    assert.deepEqual(result.transfer, { from: removing ? "pill" : "card", to: removing ? "card" : "pill", kind: "theory" });
    assert.equal(result.cancelled, brokenMotion ? 1 : 0);
  }
}
console.log(JSON.stringify({ ok: true, suite: "cinematic-spatial-transfer", checks: ["measured-geometry", "invalid-geometry", "reduced-motion", "pending-cancellation", "inert-copy", "rapid-replacement", "completion-cleanup", "offscreen-target", "unmounted-target", "midflight-reduction", "witness-and-theory-kinds", "add-remove-direction", "motion-failure-does-not-block-toggle", "busy-does-not-toggle"], limits: ["Mocked DOM/animation lifecycle and actual callback seam; rendered geometry and React integration still require browser verification."] }));
