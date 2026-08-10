import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const sourcePath = path.join(process.cwd(), "app", "campaign", "world-consequence-timeline.ts");
const outputPath = path.join(process.cwd(), "outputs", "world-consequence-timeline-test.mjs");
const compiled = ts.transpileModule(await fs.readFile(sourcePath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, compiled, "utf8");
const { deriveWorldConsequenceTimeline } = await import(`${pathToFileURL(outputPath).href}?test=${Date.now()}`);

const input = {
  worldLead: { status: "resolved", headline: "A followed lead changed the public situation." },
  worldArc: { status: "active", progressLabel: "Campaign arc 2/3" },
  directive: { status: "ready", headline: "A faction response is ready.", nextAction: "Choose a public response." },
  pressure: { status: "active", directionLabel: "Pressure rising" },
  recovery: { status: "blocked", headline: "Recovery is blocked at location-private-01.", nextAction: "Review the public recovery condition." },
  socialResponse: { status: "ready", headline: "A town reaction is ready." }
};
const before = structuredClone(input);
const first = deriveWorldConsequenceTimeline(input);
const second = deriveWorldConsequenceTimeline(structuredClone(input));
assert.deepEqual(first, second, "same safe summaries produce the same consequence chain");
assert.deepEqual(input, before, "timeline projection never mutates world summaries");
assert.deepEqual(first.beats.map((beat) => beat.kind), ["world-lead", "world-arc", "directive", "pressure", "recovery", "reaction"], "six existing systems keep one fixed reading order");
assert.equal(first.state, "blocked", "blocked player-facing consequence wins current priority");
assert.equal(first.currentKind, "recovery", "recovery is the current beat when blocked");
assert.equal(first.beats.find((beat) => beat.kind === "world-lead")?.state, "completed", "resolved lead becomes a completed beat");
assert.equal(first.beats.find((beat) => beat.kind === "directive")?.state, "pending", "non-current active directive remains visible without competing for current status");
assert.equal(JSON.stringify(first).includes("location-private-01"), false, "raw identifier-like text is sanitized from public summaries");
assert.equal(/"[A-Za-z]+Ids?":/.test(JSON.stringify(first)), false, "timeline contains no internal id fields");

const settled = deriveWorldConsequenceTimeline({ worldLead: { status: "resolved" }, worldArc: { status: "completed" }, directive: { status: "completed" }, pressure: { status: "consumed" }, recovery: { status: "completed" }, socialResponse: { status: "settled" } });
assert.equal(settled.state, "settled", "fully completed existing systems collapse to settled");
const empty = deriveWorldConsequenceTimeline({});
assert.equal(empty.state, "empty", "absent public summaries do not invent a consequence");
console.log(JSON.stringify({ ok: true, tests: ["determinism", "no-mutation", "fixed-order", "priority", "settled", "empty", "safe-output"] }));
