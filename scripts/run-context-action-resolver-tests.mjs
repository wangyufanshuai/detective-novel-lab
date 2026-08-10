import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const sourcePath = path.join(process.cwd(), "app", "campaign", "context-action-resolver.ts");
const registryPath = path.join(process.cwd(), "app", "campaign", "investigation-action-registry.ts");
const outputPath = path.join(process.cwd(), "outputs", "context-action-resolver-test.mjs");
const source = await fs.readFile(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText.replace('"./investigation-action-registry"', '"./investigation-action-registry-test.mjs"');
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(path.join(path.dirname(outputPath), "investigation-action-registry-test.mjs"), ts.transpileModule(await fs.readFile(registryPath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText, "utf8");
await fs.writeFile(outputPath, compiled, "utf8");
const [{ resolveSafeContextActions }, registry] = await Promise.all([
  import(`${pathToFileURL(outputPath).href}?test=${Date.now()}`),
  import(`${pathToFileURL(path.join(path.dirname(outputPath), "investigation-action-registry-test.mjs")).href}?test=${Date.now()}`)
]);

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
assert.deepEqual(locationActions.map((item) => item.kind), ["search"], "location actions stay on the certified search route");
assert.equal(locationActions.filter((item) => item.primary).length, 1, "location context exposes exactly one primary action");
assert.equal(locationActions[0].handlerKey, "discoverSceneEvidence", "search delegates to the existing certified handler");

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
assert.deepEqual(institutionActions.map((item) => item.kind), ["advance"], "institution context stays descriptive and case-safe");
assert.equal(institutionActions[0].handlerKey, "showInstitution", "institution action only opens the existing inspector");

const evidenceActions = resolveSafeContextActions({
  contextKind: "evidence",
  hasCase: true,
  hasSession: true,
  observed: true,
  joined: true,
  hasSearchableEvidence: false,
  hasDiscoveredEvidence: true,
  challengedTestimony: false,
  theorySubmitted: false,
  judgementAccepted: false,
  revealAvailable: false,
  selectedEvidenceDiscovered: true,
  selectedEvidenceInTheory: false
});
assert.deepEqual(evidenceActions.map((item) => item.kind), ["select-evidence", "edit-theory"], "evidence context routes theory work through one registry");

const theoryActions = resolveSafeContextActions({
  contextKind: "theory",
  hasCase: true,
  hasSession: true,
  observed: true,
  joined: true,
  hasSearchableEvidence: false,
  hasDiscoveredEvidence: true,
  challengedTestimony: true,
  theorySubmitted: false,
  judgementAccepted: false,
  revealAvailable: false
});
assert.deepEqual(theoryActions.map((item) => item.kind), ["edit-theory", "submit"], "theory context exposes the existing workspace and judgement handler");
assert.equal(theoryActions.find((item) => item.kind === "submit")?.handlerKey, "submitTheory", "submit action binds the existing judgement handler");

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
assert.ok(noContext[0].disabledReason, "disabled actions explain the public-safe reason");
assert.equal(noContext.filter((item) => item.primary).length, 0, "disabled-only context has no primary mutation");
assert.equal(/"(?:id|[A-Za-z]+Ids?)":/.test(JSON.stringify(locationActions)), false, "resolver output contains no internal id fields");
const definitions = registry.listInvestigationActionDefinitions();
assert.equal(definitions.length, new Set(definitions.map((item) => item.kind)).size, "registry action kinds are unique");
assert.ok(definitions.every((item) => item.handlerKey && item.label && item.detail && item.targetKinds.length), "every registry action has a handler binding and safe presentation metadata");
assert.equal(definitions.some((item) => item.kind === "select-evidence"), true, "registry includes evidence workflow");
assert.equal(definitions.some((item) => item.kind === "submit"), true, "registry includes theory submission workflow");
console.log(JSON.stringify({ ok: true, tests: ["registry-completeness", "location-order", "actor-order", "institution-context", "evidence-context", "theory-context", "primary-uniqueness", "disabled-reason", "safe-output"] }));
