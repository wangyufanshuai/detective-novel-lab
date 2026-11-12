import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const runtimeDir = path.join(root, "outputs", "objective-first-command-deck-runtime");
await fs.mkdir(runtimeDir, { recursive: true });

async function loadModel(relativePath, outputName) {
  const source = await fs.readFile(path.join(root, relativePath), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const outputPath = path.join(runtimeDir, outputName);
  await fs.writeFile(outputPath, output, "utf8");
  return import(`${pathToFileURL(outputPath).href}?objective=${Date.now()}`);
}

const actionModel = await loadModel("app/campaign/world-campaign-action-model.ts", "world-campaign-action-model.cjs");
const empty = { session: null };
const lead = { status: "pending", focus: "Search", nextAction: "Search the public scene." };
const base = (overrides = {}) => ({ ...empty, lead, ...overrides });

const cases = [
  [base(), "lead"],
  [base({ commitment: { planStatus: "ready", nextAction: "Plan operations.", priorityOrder: ["search"] } , session: {} }), "operations"],
  [base({ recovery: { status: "ready", nextAction: "Start recovery." } }), "recovery"],
  [base({ headquarters: { status: "ready", nextAction: "Prepare." } }), "headquarters"],
  [base({ directive: { status: "ready", nextAction: "Choose." } }), "directive"],
  [base({ offer: { status: "offered", nextAction: "Accept." } }), "offer"],
  [base({ handoff: { status: "ready", nextAction: "Extract.", label: "Handoff" } }), "handoff"],
  [base({ pressure: { status: "active", nextAction: "Carry." }, lead: null }), "pressure"],
  [base({ outcome: { status: "active", nextAction: "Close." } , lead: null, session: {} }), "outcome"],
  [base({ arc: { status: "active", nextAction: "Continue." }, lead: null }), "arc"],
  [base({ campaign: { status: "completed", primaryActionLabel: "Finish", nextAction: "Debrief." }, lead: null }), "campaign"]
];
for (const [input, surface] of cases) {
  const first = actionModel.deriveCurrentWorldAction(input);
  const second = actionModel.deriveCurrentWorldAction(structuredClone(input));
  assert.equal(first.surface, surface, `priority maps to ${surface}`);
  assert.deepEqual(first, second, `${surface} mapping is deterministic`);
}
assert.equal(actionModel.deriveCurrentWorldAction({ session: null }).surface, "overview", "empty world context stays presentation-only overview");

const read = (file) => fs.readFile(path.join(root, file), "utf8");
const [panel, page, deckComponent, deckCss, deckResponsiveCss, pulseCss, pacingCss, briefModel, briefHook, presentation, drill, authoring, navigation] = await Promise.all([
  read("app/components/WorldCampaignPanel.tsx"),
  read("app/legacy/page.tsx"),
  read("app/components/CommandDeckShell.tsx"),
  read("app/components/CommandDeckShell.module.css"),
  read("app/components/CommandDeckShell.responsive.module.css"),
  read("app/components/TownPulseBar.module.css"),
  read("app/components/StrategicPacingSurface.module.css"),
  read("app/campaign/campaign-command-brief-model.ts"),
  read("app/hooks/useCampaignCommandBrief.ts"),
  read("app/hooks/useWorldCampaignPresentation.ts"),
  read("app/hooks/useManualReplayDrillActions.ts"),
  read("app/campaign/authoring-launch-adapter.ts"),
  read("app/hooks/useInvestigationNavigationActions.ts")
]);
const deckCssBundle = `${deckCss}\n${deckResponsiveCss}`;
assert.match(deckComponent, /import responsiveStyles from "\.\/CommandDeckShell\.responsive\.module\.css"/);
assert.match(deckComponent, /commandDeckShell:\s*`\$\{coreStyles\.commandDeckShell\}\s+\$\{responsiveStyles\.commandDeckShell\}`/);
assert.match(deckComponent, /data-testid="noir-current-action"[\s\S]*?brief\.objective\.title[\s\S]*?data-testid="strategic-primary-action"[\s\S]*?data-testid="command-deck-map-area"/, "Explore places the objective and single primary action before the map");
assert.equal((deckComponent.match(/data-testid="strategic-primary-action"/g) || []).length, 1, "Explore has one canonical primary action renderer");
assert.match(deckComponent, /activeView === "tools"[\s\S]*?toolTab === "world" \? control/, "World controls mount only inside the tools view");
assert.doesNotMatch(deckComponent, /commandDeckLegacyControl|command-deck-full-inspector/, "The old nested player workspace is removed rather than hidden");

assert.equal((panel.match(/data-testid="world-campaign-current-action"/g) || []).length, 1, "World Campaign owns one Current Action marker");
assert.match(panel, /data-testid="world-campaign-focus"/);
assert.match(panel, /data-testid="world-campaign-archive"/);
assert.match(panel, /<details className="worldCampaignArchive"/);
assert.match(panel, /t\("world\.focusedContext"\)/, "World Campaign uses the localized focused-context label");
assert.doesNotMatch(panel, /\b(fetch|postJson|postV1|getV1)\s*\(|\/api\//, "World Campaign presentation remains request-free");
assert.doesNotMatch(panel, /localStorage|sessionStorage|indexedDB/, "World Campaign focus/archive remains storage-free");
assert.match(panel, /commandBrief\?\.primaryAction\?\.label/, "World Campaign reuses the canonical brief action");
assert.match(briefModel, /export function buildCampaignCommandBrief/);
assert.match(briefHook, /export function useCampaignCommandBrief/);
assert.match(page, /useCampaignCommandBrief\(commandDeck\)/);
for (const [file, source] of [["brief model", briefModel], ["brief hook", briefHook]]) {
  assert.doesNotMatch(source, /\/api\/|\bfetch\s*\(|\bpostJson\s*\(|\bpostV1\s*\(|localStorage|sessionStorage|indexedDB/, `${file} remains request and storage free`);
}
for (const [file, source] of [["world presentation", presentation], ["replay drill", drill], ["authoring adapter", authoring], ["navigation", navigation]]) {
  assert.doesNotMatch(source, /\/api\/|\bfetch\s*\(|\bpostJson\s*\(|\bpostV1\s*\(/, `${file} does not own requests`);
}
assert.match(deckCssBundle, /noir-current-action[^}]*flex-direction:\s*column/s, "Compact layout stacks the existing objective before its action");
assert.match(deckComponent, /mapDetailsOpen && <aside[\s\S]*?viewModel\.secondaryActions\.map/, "Secondary decisions mount only when their disclosure is open");
assert.match(deckComponent, /activeView === "deduction"[\s\S]*?panels \? panel\(activePanelId\) : inspector/, "Deduction uses its own full-stage panel");
assert.match(deckCss, /\.deductionWorkspace\s*\{[^}]*min-height:\s*100%/, "Deduction owns the work area instead of a narrow drawer");
assert.match(deckComponent, /activeView === "explore" \?/, "Explore has an explicit view boundary");
assert.match(deckComponent, /data-testid="command-deck-feedback"/, "The canonical latest result remains reachable after an action");
assert.match(page, /useManualReplayDrillActions/);
assert.match(page, /useWorldCampaignPresentation/);
assert.match(page, /InvestigationGraphSurface/);
assert.match(page, /buildAuthoringRuntimeState/);
assert.doesNotMatch(page, /commandDeckPulse|commandDeckPulseBrand|commandDeckMark/);

const budgets = [
  ["page", page, 1100],
  ["Command Deck CSS", deckCss, 560],
  ["Command Deck responsive CSS", deckResponsiveCss, 320],
  ["Town Pulse CSS", pulseCss, 120],
  ["Campaign Command Brief model", briefModel, 300],
  ["Campaign Command Brief hook", briefHook, 80],
  ["World Campaign presentation", presentation, 350],
  ["Manual replay drill", drill, 200],
  ["World Campaign panel", panel, 300]
];
for (const [label, source, maximum] of budgets) assert.equal(source.split(/\r?\n/).length < maximum, true, `${label} stays below ${maximum} lines`);

console.log(JSON.stringify({
  ok: true,
  suite: "objective-first-command-deck",
  checks: ["surface-priority", "determinism", "single-current-action", "canonical-command-brief", "focus-archive", "request-free-presentation", "mobile-objective-action-map-order", "css-split", "page-budget", "authority-boundary"]
}));
