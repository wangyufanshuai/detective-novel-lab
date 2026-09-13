import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = process.cwd();
const require = createRequire(import.meta.url);
const read = (file) => fs.readFile(path.join(root, file), "utf8");
async function load(source) {
  let output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  output = output.replace(/from "(react(?:\/jsx-runtime)?)"/g, (_all, request) => `from ${JSON.stringify(pathToFileURL(require.resolve(request)).href)}`);
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

function extractFunction(source, fileName, functionName) {
  const ast = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const functions = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName) functions.push(node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(functions.length, 1, `use the actual ${functionName} component handler`);
  return { ast, source: functions[0] };
}

const mapSource = await read("app/components/NoirMapStage.tsx");
const controlSource = await read("app/components/TownControlSurface.tsx");
const mapHandler = extractFunction(mapSource, "NoirMapStage.tsx", "encounterAction");
const joinHandler = extractFunction(controlSource, "TownControlSurface.tsx", "runJoinCase");
const context = await load(await read("app/components/InvestigationActionExecution.tsx"));
const { createMapHarness, createJoinHarness } = await load(`
  export function createMapHarness({ characterEncounter, onEncounterAction, runWithResolution, text = (value) => value }) {
    const props = { characterEncounter, onEncounterAction };
    const words = (_zh, en) => en;
    const encounterLock = { current: false };
    ${mapHandler.source}
    return { run: encounterAction, locked: () => encounterLock.current };
  }
  export function createJoinHarness({ busy = false, joinCase, runWithResolution, t = () => "Join investigation" }) {
    const joinActionLock = { current: false };
    ${joinHandler.source}
    return { run: runJoinCase, locked: () => joinActionLock.current };
  }
`);

// Use the real React context in both provider and no-provider configurations.
function executionContext(run) {
  let execute;
  function Probe() { execute = context.useInvestigationActionExecution(); return null; }
  const child = React.createElement(Probe);
  renderToStaticMarkup(run ? React.createElement(context.InvestigationActionExecutionProvider, { run }, child) : child);
  assert.equal(typeof execute, "function");
  return execute;
}

const checks = [];
async function check(name, run) { await run(); checks.push({ name, passed: true }); }
const encounter = { actions: [{ kind: "question", enabled: true, label: "Question the archivist", detail: "Ask about the receipt" }, { kind: "review", enabled: false, label: "Review conclusion" }] };

await check("The map card and legacy Join button are wired to their actual shared-execution handlers", () => {
  let mapWiring = 0;
  let joinWiring = 0;
  function visitMap(node) {
    if (ts.isJsxAttribute(node) && node.name.text === "onAction" && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression && ts.isIdentifier(node.initializer.expression) && node.initializer.expression.text === "encounterAction") mapWiring += 1;
    ts.forEachChild(node, visitMap);
  }
  function visitJoin(node) {
    if (ts.isJsxAttribute(node) && node.name.text === "onClick" && node.initializer && ts.isJsxExpression(node.initializer)) {
      function findCall(child) {
        if (ts.isCallExpression(child) && ts.isIdentifier(child.expression) && child.expression.text === "runJoinCase") joinWiring += 1;
        ts.forEachChild(child, findCall);
      }
      findCall(node.initializer);
    }
    ts.forEachChild(node, visitJoin);
  }
  visitMap(mapHandler.ast);
  visitJoin(joinHandler.ast);
  assert.equal(mapWiring, 1);
  assert.equal(joinWiring, 1);
});

for (const status of ["succeeded", "rejected", "blocked", "cancelled", "failed"]) {
  await check(`Map card sends ${status} once through the actual execution provider using its public label`, async () => {
    const records = [];
    let calls = 0;
    const expected = { status, detail: `Controlled ${status} result` };
    const runWithResolution = executionContext(async (label, execute) => records.push({ label, result: await execute() }));
    const harness = createMapHarness({ characterEncounter: encounter, runWithResolution, text: (label) => `Localized: ${label}`, onEncounterAction: async (kind) => { calls += 1; assert.equal(kind, "question"); return expected; } });
    await harness.run("question");
    assert.equal(calls, 1);
    assert.deepEqual(records, [{ label: "Localized: Question the archivist", result: expected }]);
    assert.equal(harness.locked(), false);
  });
  await check(`Legacy Join sends ${status} once through the actual execution provider`, async () => {
    const records = [];
    let calls = 0;
    const expected = { status, detail: `Controlled ${status} result` };
    const runWithResolution = executionContext(async (label, execute) => records.push({ label, result: await execute() }));
    const harness = createJoinHarness({ runWithResolution, joinCase: async () => { calls += 1; return expected; } });
    await harness.run();
    assert.equal(calls, 1);
    assert.deepEqual(records, [{ label: "Join investigation", result: expected }]);
    assert.equal(harness.locked(), false);
  });
}

for (const entry of ["map", "join"]) {
  await check(`${entry} suppresses rapid duplicate clicks and permits retry after the prior result`, async () => {
    let finish;
    let calls = 0;
    let executions = 0;
    const pending = new Promise((resolve) => { finish = resolve; });
    const action = async () => { calls += 1; return pending; };
    const runWithResolution = executionContext(async (_label, execute) => { executions += 1; await execute(); });
    const harness = entry === "map"
      ? createMapHarness({ characterEncounter: encounter, onEncounterAction: action, runWithResolution })
      : createJoinHarness({ joinCase: action, runWithResolution });
    const first = harness.run("question");
    await harness.run("question");
    assert.equal(harness.locked(), true);
    assert.equal(calls, 1);
    assert.equal(executions, 1);
    finish({ status: "succeeded", detail: "Completed" });
    await first;
    assert.equal(harness.locked(), false);
    await harness.run("question");
    assert.equal(calls, 2);
    assert.equal(executions, 2);
  });
  await check(`${entry} executes through the real no-provider fallback`, async () => {
    let calls = 0;
    const action = async () => { calls += 1; return { status: "succeeded", detail: "Standalone completed" }; };
    const runWithResolution = executionContext();
    const harness = entry === "map"
      ? createMapHarness({ characterEncounter: encounter, onEncounterAction: action, runWithResolution })
      : createJoinHarness({ joinCase: action, runWithResolution });
    await harness.run("question");
    assert.equal(calls, 1);
    assert.equal(harness.locked(), false);
  });
  await check(`${entry} releases its lock when a standalone callback throws`, async () => {
    const failure = new Error("Controlled callback failure");
    const action = async () => { throw failure; };
    const runWithResolution = executionContext();
    const harness = entry === "map"
      ? createMapHarness({ characterEncounter: encounter, onEncounterAction: action, runWithResolution })
      : createJoinHarness({ joinCase: action, runWithResolution });
    await assert.rejects(harness.run("question"), (error) => error === failure);
    assert.equal(harness.locked(), false);
  });
}

await check("Disabled or unavailable map card actions never enter the executor", async () => {
  const harness = createMapHarness({ characterEncounter: encounter, onEncounterAction: () => assert.fail("disabled action was dispatched"), runWithResolution: executionContext(async () => assert.fail("disabled action entered the executor")) });
  await harness.run("review");
  await harness.run("unknown");
});
await check("An externally busy legacy Join never enters the executor", async () => {
  await createJoinHarness({ busy: true, joinCase: () => assert.fail("busy join was dispatched"), runWithResolution: executionContext(async () => assert.fail("busy join entered the executor")) }).run();
});
await check("A legacy void encounter callback still runs without claiming a successful settlement", async () => {
  let calls = 0;
  let outcome;
  const harness = createMapHarness({ characterEncounter: encounter, onEncounterAction: () => { calls += 1; }, runWithResolution: executionContext(async (_label, execute) => { outcome = await execute(); }) });
  await harness.run("question");
  assert.equal(calls, 1);
  assert.equal(outcome.status, "blocked");
});

const outputDir = path.join(root, "outputs", "first-case-goal");
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, "legacy-investigation-entry-test-report.json"), `${JSON.stringify({
  generatedAt: new Date().toISOString(), passed: checks.length, failed: 0,
  scope: "Actual map/Join handler functions and real React execution-context provider/fallback; UI wiring inspected with TypeScript AST. Browser DOM clicks are separate.", checks
}, null, 2)}\n`, "utf8");
console.log(`Legacy investigation entry tests passed: ${checks.length}/${checks.length}.`);
