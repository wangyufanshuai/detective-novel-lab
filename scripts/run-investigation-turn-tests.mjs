import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const sourcePath = path.join(process.cwd(), "app", "campaign", "investigation-turn-model.ts");
const outputPath = path.join(process.cwd(), "outputs", "investigation-turn-model-test.mjs");
const compiled = ts.transpileModule(await fs.readFile(sourcePath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, compiled, "utf8");
const { createInvestigationTurnState, transitionInvestigationTurn, INVESTIGATION_TURN_PHASES } = await import(`${pathToFileURL(outputPath).href}?test=${Date.now()}`);

const initial = createInvestigationTurnState({ objectiveKey: "join", contextLabel: undefined });
assert.equal(initial.phase, "choose-target", "turn starts by asking for a public target");
const selected = transitionInvestigationTurn(initial, { type: "sync", objectiveKey: "join", contextLabel: "North Court" });
assert.equal(selected.phase, "choose-action", "selecting context advances to legal action choice");
const resolving = transitionInvestigationTurn(selected, { type: "start-action", actionKind: "join", actionLabel: "Join investigation" });
assert.equal(resolving.phase, "resolve", "existing handler execution is represented as resolve");
assert.equal(transitionInvestigationTurn(resolving, { type: "sync", objectiveKey: "search", contextLabel: "North Court" }), resolving, "in-flight resolve is stable across optimistic UI updates");
const feedback = transitionInvestigationTurn(resolving, { type: "finish-action", objectiveKey: "join" });
assert.equal(feedback.phase, "feedback", "unchanged objective produces visible feedback");
assert.equal(feedback.turnNumber, 2, "completed handler advances the browser-local turn count once");
const advanced = transitionInvestigationTurn(feedback, { type: "sync", objectiveKey: "search", contextLabel: "North Court" });
assert.equal(advanced.phase, "next-objective", "authoritative objective change becomes the next-objective phase");
const nextSelection = transitionInvestigationTurn(advanced, { type: "sync", objectiveKey: "search", contextLabel: "Public Dock" });
assert.equal(nextSelection.phase, "choose-action", "new public target begins the next action choice");
assert.equal(transitionInvestigationTurn(nextSelection, { type: "sync", objectiveKey: "search", contextLabel: "Public Dock" }), nextSelection, "duplicate sync is referentially idempotent");
assert.deepEqual(INVESTIGATION_TURN_PHASES.map((item) => item.phase), ["choose-target", "choose-action", "resolve", "feedback", "next-objective"], "turn phases keep one fixed order");

const serialized = JSON.stringify(nextSelection);
assert.equal(/\b(?:world|case|session|npc|location|evidence|event)Id\b/.test(serialized), false, "turn state contains no authority identifiers");
assert.equal(/truth|routeCertificate|judgement|legalActions/.test(serialized), false, "turn state contains no duplicated case authority");
console.log(JSON.stringify({ ok: true, tests: ["target", "action", "resolve", "feedback", "next-objective", "idempotence", "safe-state"] }));
