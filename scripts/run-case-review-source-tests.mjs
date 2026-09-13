import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repo = fileURLToPath(new URL("..", import.meta.url));
const sourceDir = path.join(repo, "packages", "engine", "src");
const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "case-review-source-tests-"));
const compiled = new Set();
function compile(relative) {
  if (compiled.has(relative)) return;
  compiled.add(relative);
  const source = fs.readFileSync(path.join(sourceDir, `${relative}.ts`), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  for (const [, dependency] of output.matchAll(/require\("(\.{1,2}\/[^\"]+)"\)/g)) compile(path.normalize(path.join(path.dirname(relative), dependency)));
  const target = path.join(runtime, `${relative}.cjs`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output.replace(/require\("(\.{1,2}\/[^\"]+)"\)/g, 'require("$1.cjs")'));
}
compile("demo-runtime");
compile("deduction-graph");
const require = createRequire(import.meta.url);
const { createStaticDemoRuntime } = require(path.join(runtime, "demo-runtime.cjs"));
const engine = require(path.join(runtime, "deduction-graph.cjs"));
const fixture = createStaticDemoRuntime();
let currentCase = structuredClone(fixture.activeCase);
let repositoryEvents = structuredClone(fixture.events);
const worldRepository = {
  getCase: (caseId) => caseId === currentCase.id ? currentCase : null,
  getWorld: (worldId) => worldId === fixture.world.id ? fixture.world : null,
  getEvents: (worldId) => { assert.equal(worldId, fixture.world.id); return repositoryEvents; }
};

// Run the actual route with in-memory persistence and HTTP-envelope adapters.
// Graph, suspect and report builders are the unmodified engine implementations.
const routeSource = fs.readFileSync(path.join(repo, "app/api/v1/query/case/deduction-graph/route.ts"), "utf8");
const routeOutput = ts.transpileModule(routeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const routeModule = { exports: {} };
new Function("require", "exports", "module", routeOutput)((name) => {
  if (name === "@/lib/engine") return engine;
  if (name === "@/lib/world/repository") return { worldRepository };
  if (name === "@/app/api/v1/_utils") return { ok: (data) => ({ ok: true, data }), errorResponse: (error) => ({ ok: false, error: String(error) }) };
  throw new Error(`Unexpected route dependency: ${name}`);
}, routeModule.exports, routeModule);
const query = async () => {
  const result = await routeModule.exports.GET(new Request(`http://localhost/api/v1/query/case/deduction-graph?caseId=${encodeURIComponent(currentCase.id)}`));
  assert.equal(result.ok, true, result.error);
  return result.data;
};
const checks = [];
const sourceIds = new Set([...fixture.activeCase.sourceEventIds, ...(fixture.activeCase.sourceMap?.sourceEventIds || [])]);
const caseEvents = fixture.events.filter((event) => sourceIds.has(event.id));
const expected = {
  graph: engine.buildDeductionGraph(currentCase, caseEvents),
  suspectBoard: engine.deriveSuspectBoard(currentCase, caseEvents),
  logicReport: engine.buildCaseLogicReport(fixture.world, caseEvents, currentCase)
};
assert.deepEqual(await query(), expected);
checks.push("existing case source events preserve the graph, suspect exclusions and logic report");

const foreignEvents = caseEvents.filter((event) => event.evidenceId).map((event) => ({
  ...structuredClone(event),
  id: `zz-other-case-${event.id}`,
  publicSummary: "Different case victim at a different location",
  summary: "Unrelated case source",
  locationId: "unrelated-location"
}));
// Demonstrate the regression: unscoped engine input really does select the
// later foreign events because evidence identifiers are reused.
assert(engine.buildDeductionGraph(currentCase, [...caseEvents, ...foreignEvents]).nodes.some((node) => node.type === "event" && node.label === "Different case victim at a different location"));
for (const mixed of [[...caseEvents, ...foreignEvents], [...foreignEvents, ...caseEvents]]) {
  repositoryEvents = mixed;
  assert.deepEqual(await query(), expected);
}
checks.push("other-case events with the same evidence IDs cannot replace this case in either repository order");

const decisiveId = currentCase.deductionCase.truth.decisiveEvidenceIds[0];
repositoryEvents = [...caseEvents.filter((event) => event.evidenceId !== decisiveId), ...foreignEvents];
const missing = await query();
assert.equal(missing.graph.complete, false);
assert.equal(missing.logicReport.deductionGraphComplete, false);
assert(missing.graph.nodes.filter((node) => node.type === "event").every((node) => !node.eventIds.some((id) => id.startsWith("zz-other-case-"))));
checks.push("missing case source remains incomplete instead of borrowing another case's evidence");

currentCase = structuredClone(fixture.activeCase);
currentCase.sourceEventIds = [];
currentCase.sourceMap = { ...currentCase.sourceMap, sourceEventIds: [...sourceIds] };
repositoryEvents = [...caseEvents, ...foreignEvents];
assert.deepEqual(await query(), expected);
checks.push("recorded sourceMap case sources remain usable without a duplicate top-level list");

currentCase.sourceMap.sourceEventIds = [];
const noSources = await query();
assert.equal(noSources.graph.complete, false);
assert.equal(noSources.graph.nodes.some((node) => node.type === "event"), false);
checks.push("absent case scope never falls back to the whole world's event pool");

console.log(JSON.stringify({ ok: true, checks: checks.length, evidence: checks, source: "synthetic fixture and actual route/engine; no player data or game service" }, null, 2));
