import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const sourcePath = path.join(process.cwd(), "app", "campaign", "presentation-feedback.ts");
const outputPath = path.join(process.cwd(), "outputs", "presentation-feedback-test.mjs");
const compiled = ts.transpileModule(await fs.readFile(sourcePath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, compiled, "utf8");
const { derivePresentationFeedback, PRESENTATION_FEEDBACK_STATES } = await import(`${pathToFileURL(outputPath).href}?test=${Date.now()}`);

const base = { turnPhase: "choose-target", turnNumber: 1 };
assert.equal(derivePresentationFeedback(base).state, "idle", "empty presentation waits for a public target");
assert.equal(derivePresentationFeedback({ ...base, enabledActionLabel: "Observe case window" }).state, "available", "enabled action becomes available feedback");
assert.equal(derivePresentationFeedback({ ...base, turnPhase: "choose-action", selectedContextLabel: "North Court" }).state, "selected", "public context becomes selected feedback");
assert.deepEqual(derivePresentationFeedback({ ...base, turnPhase: "resolve", lastActionLabel: "Join investigation" }), derivePresentationFeedback({ ...base, turnPhase: "resolve", lastActionLabel: "Join investigation" }), "feedback is deterministic");
assert.equal(derivePresentationFeedback({ ...base, turnPhase: "resolve", lastActionLabel: "Join investigation" }).audioCue, "resolve", "resolve exposes one stable audio hook");
assert.equal(derivePresentationFeedback({ ...base, turnPhase: "feedback", lastActionLabel: "Search location" }).state, "updated", "handler completion becomes updated feedback");
assert.equal(derivePresentationFeedback({ ...base, turnPhase: "next-objective" }).audioCue, "confirm", "next objective exposes confirm cue");
assert.equal(derivePresentationFeedback({ ...base, consequenceState: "blocked", campaignStatus: "completed" }).state, "blocked", "visible blocking work wins over completion presentation");
assert.equal(derivePresentationFeedback({ ...base, campaignStatus: "completed" }).state, "completed", "campaign completion receives success feedback");
assert.deepEqual(PRESENTATION_FEEDBACK_STATES, ["idle", "available", "selected", "resolving", "updated", "blocked", "completed"], "presentation states keep one fixed design-token order");

const safe = JSON.stringify(derivePresentationFeedback({ ...base, turnPhase: "resolve", selectedContextLabel: "Public Clinic", lastActionLabel: "Search location" }));
assert.equal(/(?:world|case|session|npc|location|evidence|event|source)Id|truth|routeCertificate|judgement|rawBody|checkpoint/i.test(safe), false, "presentation feedback duplicates no authority fields");
console.log(JSON.stringify({ ok: true, tests: ["idle", "available", "selected", "resolve", "updated", "blocked-priority", "completed", "audio-cue", "determinism", "safe-state"] }));
