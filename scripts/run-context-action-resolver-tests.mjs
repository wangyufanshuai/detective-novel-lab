import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const sourcePath = path.join(process.cwd(), "app", "campaign", "context-action-resolver.ts");
const outputPath = path.join(process.cwd(), "outputs", "context-action-resolver-test.mjs");
const source = await fs.readFile(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, compiled, "utf8");
const { resolveSafeContextActions } = await import(`${pathToFileURL(outputPath).href}?test=${Date.now()}`);

const locationActions = resolveSafeContextActions({
  contextKind: "location",
  hasSession: true,
  observed: true,
  joined: true,
  hasSearchableEvidence: true,
  hasDiscoveredEvidence: true,
  challengedTestimony: false,
  theorySubmitted: false,
  judgementAccepted: false,
  revealAvailable: false
});
assert.deepEqual(locationActions.map((item) => item.kind), ["search", "challenge"], "location actions follow certified route order");

const actorActions = resolveSafeContextActions({
  contextKind: "actor",
  hasSession: true,
  observed: true,
  joined: true,
  hasSearchableEvidence: false,
  hasDiscoveredEvidence: true,
  challengedTestimony: false,
  theorySubmitted: false,
  judgementAccepted: false,
  revealAvailable: false
});
assert.deepEqual(actorActions.map((item) => item.kind), ["question", "challenge"], "actor actions expose question then challenge");

const institutionActions = resolveSafeContextActions({
  contextKind: "institution",
  hasCase: true,
  hasSession: true,
  observed: true,
  joined: true,
  hasSearchableEvidence: false,
  hasDiscoveredEvidence: false,
  challengedTestimony: false,
  theorySubmitted: false,
  judgementAccepted: false,
  revealAvailable: false
});
assert.deepEqual(institutionActions.map((item) => item.kind), ["inspect"], "institution context stays descriptive and case-safe");

const noContext = resolveSafeContextActions({
  hasSession: false,
  observed: false,
  joined: false,
  hasSearchableEvidence: false,
  hasDiscoveredEvidence: false,
  challengedTestimony: false,
  theorySubmitted: false,
  judgementAccepted: false,
  revealAvailable: false
});
assert.equal(noContext.length, 1, "empty selection produces one safe disabled affordance");
assert.equal(noContext[0].enabled, false, "empty selection action cannot mutate runtime");
assert.equal(JSON.stringify(locationActions).includes("id"), false, "resolver output contains no internal ids");
console.log(JSON.stringify({ ok: true, tests: ["location-order", "actor-order", "institution-context", "empty-selection", "safe-output"] }));
