import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const outputDir = path.join(root, "outputs", "campaign-command-brief-runtime");
const sourcePath = path.join(root, "app", "campaign", "campaign-command-brief-model.ts");
const outputPath = path.join(outputDir, "campaign-command-brief-model.mjs");
await fs.mkdir(outputDir, { recursive: true });
const source = await fs.readFile(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
await fs.writeFile(outputPath, compiled, "utf8");
const { buildCampaignCommandBrief } = await import(`${pathToFileURL(outputPath).href}?test=${Date.now()}`);

const primaryAction = {
  kind: "certified-investigation",
  target: "show-investigation",
  label: "Search location",
  detail: "Search the selected public scene through the certified handler.",
  benefitLabel: "Advances the certified route.",
  costLabel: "No additional world cost.",
  priority: 2,
  enabled: true,
  blocking: true
};

const baseCommand = {
  runtimeMode: "server",
  currentObjective: {
    action: "search",
    phase: "Fieldwork",
    title: "Search location",
    detail: "Inspect the public scene for discoverable evidence.",
    nextAction: "Use the certified Search action.",
    recoveryLabel: "not needed",
    progressLabel: "Chapter 1 / Fieldwork"
  },
  selectedContext: {
    kind: "location",
    label: "Market Square",
    detail: "Selected public location.",
    actions: []
  },
  campaignProgress: {
    chapterLabel: "Town Reckoning / Chapter 1",
    progressLabel: "1/3 chapters",
    nextAction: "Complete Fieldwork."
  },
  worldConsequenceTimeline: {
    state: "active",
    headline: "Town response active",
    summary: "A public response is visible.",
    nextAction: "Continue the current case.",
    beats: [
      { kind: "world-lead", title: "World Lead", state: "active", summary: "The followed lead remains active." },
      { kind: "directive", title: "Faction Directive", state: "ready", summary: "A public directive choice is ready." },
      { kind: "recovery", title: "Campaign Recovery", state: "inactive", summary: "No recovery is needed." }
    ]
  },
  presentationFeedback: {
    state: "available",
    tone: "info",
    audioCue: "none",
    label: "Action available",
    detail: "The certified Search action is available.",
    signature: "safe-feedback"
  },
  campaignPacing: {
    whyNow: "The public record points back to Market Square.",
    nextAction: "Search before optional world context.",
    value: { primarySurface: "Market Square" },
    safeForecast: {
      whatChanges: "The visible investigation context advances.",
      visibleSurface: "Town map and Investigation workspace.",
      unchangedAuthority: "Case truth and the certified route remain unchanged."
    }
  },
  outcomeFeedback: {
    immediate: { label: "Immediate Result", detail: "The existing route advances." },
    world: { label: "World Consequence", detail: "No world state changes before the action resolves." },
    next: { label: "Next Objective", detail: "Continue to the next certified step." }
  },
  advanceState: { state: "blocked", label: "Advance held", detail: "Complete Search first." },
  primaryAction,
  secondaryActions: [],
  decisionQueue: [
    primaryAction,
    { ...primaryAction, kind: "faction-directive", target: "show-world-choice", label: "Review directive", priority: 4, blocking: false }
  ]
};

const before = structuredClone(baseCommand);
const first = buildCampaignCommandBrief({ command: baseCommand });
const second = buildCampaignCommandBrief({ command: structuredClone(baseCommand) });
assert.deepEqual(first, second, "same safe command state produces the same brief");
assert.deepEqual(baseCommand, before, "brief derivation does not mutate its input");
assert.deepEqual(first.hierarchy, ["objective", "action", "map", "context"], "fixed hierarchy is objective, action, map, context");
assert.equal(first.objective.title, "Search location");
assert.equal(first.primaryAction.label, "Search location");
assert.equal(first.status, "ready");
assert.equal(first.focus.target, "investigation");
assert.equal(first.context.state, "focused");
assert.equal(first.world.signalCount, 3, "active lead plus ready directive sources are aggregated without raw bodies");
assert.equal(first.world.signals.some((signal) => signal.label === "World Lead"), true);
assert.match(first.whyNow, /certified handler/i, "certified action owns Why Now over optional world prose");
assert.match(first.whatChanges, /visible investigation context/i);

const fallbackCommand = structuredClone(baseCommand);
delete fallbackCommand.selectedContext;
fallbackCommand.primaryAction = undefined;
fallbackCommand.decisionQueue = [];
fallbackCommand.advanceState = { state: "blocked", label: "Advance held", detail: "Select public context." };
const fallback = buildCampaignCommandBrief({ command: fallbackCommand });
assert.equal(fallback.status, "blocked");
assert.equal(fallback.focus.target, "map");
assert.equal(fallback.context.state, "empty");
assert.equal(fallback.context.label, "Context Rail");

const privateCommand = structuredClone(baseCommand);
privateCommand.currentObjective.title = "case-2026-001-abcd culpritId C:\\private\\case.json";
privateCommand.selectedContext.label = "npc-2048-secret";
privateCommand.outcomeFeedback.next.detail = "hiddenTruth sourceId /Users/private/replay.json";
const privateProjection = JSON.stringify(buildCampaignCommandBrief({ command: privateCommand }));
assert.equal(/\b(?:case|npc|event|source|location|institution|resource|evidence|scene|session|world|campaign|package)-[a-z0-9-]*\d[a-z0-9-]*\b|culpritId|victimId|hiddenTruth|rawBody|sourceId|[A-Za-z]:[\\/]|\/Users\//i.test(privateProjection), false, "brief strips raw identifiers, private fields, and absolute paths");

const staticCommand = structuredClone(fallbackCommand);
staticCommand.runtimeMode = "static-demo";
staticCommand.advanceState = { state: "readonly", label: "Server only", detail: "Static remains read-only." };
const staticBrief = buildCampaignCommandBrief({ command: staticCommand });
assert.equal(staticBrief.status, "readonly");
assert.equal(staticBrief.primaryAction, undefined, "Static brief exposes no persistent action control");

assert.doesNotMatch(source, /\/api\/|\bfetch\s*\(|\bpostJson\s*\(|\bpostV1\s*\(|localStorage|sessionStorage|indexedDB|advancePersistentTown|stepPersistentTown/, "brief model has no request, storage, or tick authority");
assert.equal(source.split(/\r?\n/).length < 300, true, "brief model stays below 300 lines");

console.log(JSON.stringify({
  ok: true,
  suite: "campaign-command-brief",
  checks: ["determinism", "one-objective", "one-action", "fixed-hierarchy", "safe-copy", "context-fallback", "world-aggregation", "input-non-mutation", "static-readonly", "request-free"]
}));
