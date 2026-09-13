import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";

// Execute the actual JSX onChange callback at the state-setter seam. This is
// not a DOM interaction test; browser verification is still required.
const source = await fs.readFile(new URL("../app/components/CinematicDeductionBoard.tsx", import.meta.url), "utf8");
const file = ts.createSourceFile("CinematicDeductionBoard.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const fieldByName = { "cinematic-theory-suspect": "culpritId", "cinematic-theory-motive": "motive", "cinematic-theory-method": "method" };
const handlers = new Map();
function visit(node) {
  if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ["select", "textarea"].includes(node.tagName.getText(file))) {
    const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
    const name = attributes.find((item) => item.name.getText(file) === "name")?.initializer;
    if (name && ts.isStringLiteral(name) && Object.hasOwn(fieldByName, name.text)) {
      const callback = attributes.find((item) => item.name.getText(file) === "onChange")?.initializer;
      assert.ok(callback && ts.isJsxExpression(callback) && callback.expression, "theory input must expose its actual change callback");
      assert.equal(handlers.has(name.text), false, "each theory input is unique");
      handlers.set(name.text, callback.expression.getText(file));
    }
  }
  ts.forEachChild(node, visit);
}
visit(file);
assert.equal(handlers.size, 3, "all three theory inputs are tested");
const dispatchers = new Map();
for (const [name, handler] of handlers) {
  const harness = `export function dispatch(value, characters, current, laterValue) {
  let pendingUpdate;
  const setTheory = (update) => { pendingUpdate = update; };
  const onChange = ${handler};
  const target = { value };
  onChange({ target, currentTarget: target });
  if (laterValue !== undefined) target.value = laterValue;
  return pendingUpdate(current);
}`;
  const compiled = ts.transpileModule(harness, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const { dispatch } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
  dispatchers.set(name, dispatch);
}
const characters = Object.freeze([Object.freeze({ id: "test-person-a" }), Object.freeze({ id: "test-person-b" })]);
const current = Object.freeze({ culpritId: "test-person-b", motive: "Player's motive", method: "Player's method", evidenceIds: Object.freeze(["player-selected-clue"]) });
const cases = [["", ""], ["0", "test-person-a"], ["1", "test-person-b"], ["99", ""], ["-1", ""], ["invalid", ""], ["1", "test-person-b", "0"]]
  .map((args) => ["cinematic-theory-suspect", ...args]);
for (const name of ["cinematic-theory-motive", "cinematic-theory-method"]) {
  cases.push([name, "", ""], [name, "玩家的解释", "玩家的解释"], [name, "First claim", "First claim", "Later claim"]);
}
const failures = [];
for (const [name, value, expected, laterValue] of cases) {
  try {
    const field = fieldByName[name];
    const next = dispatchers.get(name)(value, characters, current, laterValue);
    assert.equal(next[field], expected);
    assert.deepEqual({ ...next, [field]: current[field] }, current, "only the edited theory field may change");
    assert.equal(current.culpritId, "test-person-b", "existing theory is immutable");
  } catch (error) { failures.push({ field: fieldByName[name], input: value, laterValue, actual: error.actual, expected: error.expected }); }
}
console.log(JSON.stringify({ suite: "cinematic-theory-input", ok: failures.length === 0, checks: cases.length, passed: cases.length - failures.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
