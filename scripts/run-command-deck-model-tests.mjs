import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const sourcePath = path.join(root, "app", "campaign", "command-deck-model.ts");
const outputPath = path.join(root, "outputs", "command-deck-model-test.mjs");
const feedbackSourcePath = path.join(root, "app", "campaign", "presentation-feedback.ts");
const feedbackOutputPath = path.join(root, "outputs", "presentation-feedback-test.mjs");
const source = await fs.readFile(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText.replace(/from "\.\/presentation-feedback"/g, 'from "./presentation-feedback-test.mjs"');
const feedbackCompiled = ts.transpileModule(await fs.readFile(feedbackSourcePath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(feedbackOutputPath, feedbackCompiled, "utf8");
await fs.writeFile(outputPath, compiled, "utf8");
const { deriveCampaignCommandDeckViewModel } = await import(`${pathToFileURL(outputPath).href}?test=${Date.now()}`);

const input = {
  runtimeMode: "server",
  caseLabel: "Archive review",
  currentTime: "09:30",
  suggestedAction: { phase: "搜索", title: "搜索地点证据", detail: "Inspect the selected location." },
  urgency: "elevated",
  campaign: { status: "case-active", chapterLabel: "Case 1", progressLabel: "1/3 campaign cases closed", nextAction: "Continue the certified investigation" },
  worldLead: { status: "followed", label: "Followed world lead", nextAction: "Continue the certified route" },
  pressure: { status: "active", directionLabel: "Pressure building", affectedCaseLabel: "Related case patterns", nextAction: "Extract a future case" },
  worldConsequenceTimeline: {
    state: "active",
    headline: "World Pressure",
    summary: "Pressure building",
    nextAction: "Extract a future case",
    currentKind: "pressure",
    beats: [
      { kind: "world-lead", title: "World Lead", state: "completed", summary: "Followed" },
      { kind: "world-arc", title: "World Arc", state: "inactive", summary: "Stable" },
      { kind: "directive", title: "Faction Directive", state: "inactive", summary: "Stable" },
      { kind: "pressure", title: "World Pressure", state: "current", summary: "Pressure building" },
      { kind: "recovery", title: "Campaign Recovery", state: "inactive", summary: "Not needed" },
      { kind: "reaction", title: "Town Reaction", state: "inactive", summary: "Stable" }
    ]
  },
  selectedContext: { kind: "location", label: "Court" }
};
const first = deriveCampaignCommandDeckViewModel(input);
const second = deriveCampaignCommandDeckViewModel(structuredClone(input));
assert.deepEqual(first, second, "same safe input produces deterministic view model");
assert.equal(first.currentObjective.action, "search", "search phase becomes the current objective action");
assert.equal(first.townPulse.caseLabel, "Archive review", "case label stays in the top pulse");
assert.equal(first.selectedContext?.kind, "location", "selected context preserves public kind");
assert.equal(first.selectedContext?.actions.length, 0, "view model does not invent context actions");
assert.equal(first.notifications.length, 1, "world systems collapse into one consequence notification");
assert.equal(JSON.stringify(first).includes('"id"'), false, "view model does not expose internal identifier fields");
const empty = deriveCampaignCommandDeckViewModel({ runtimeMode: "static-demo" });
assert.equal(empty.currentObjective.action, "advance", "empty state degrades to a safe next action");
assert.equal(empty.notifications.length, 0, "empty state does not invent notifications");
const metrics = deriveCampaignCommandDeckViewModel({ runtimeMode: "server", tickLabel: "T12 / observation", heat: 81, publicTrust: 24, resourcePressure: 45, recovery: { status: "ready", nextAction: "Review recovery" } });
assert.deepEqual([metrics.townPulse.timeLabel, metrics.townPulse.heatLabel, metrics.townPulse.trustLabel, metrics.townPulse.pressureLabel], ["T12 / observation", "high", "fragile", "watch"], "numeric town state becomes bounded safe bands");
assert.equal(metrics.currentObjective.recoveryLabel, "ready", "agenda exposes recovery state without internal keys");
assert.deepEqual(Object.keys(metrics.mapSignals), ["institutionLabel", "pressureLabel", "socialResponseLabel"], "map signals expose only bounded presentation labels");
console.log(JSON.stringify({ ok: true, tests: ["determinism", "objective", "pulse", "safe-bands", "context", "notification", "safe-empty"] }));
