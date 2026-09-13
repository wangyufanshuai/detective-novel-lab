import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createNoirTestLoader } from "./noir-player-test-loader.mjs";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const sourceDir = path.join(root, "packages", "engine", "src");
const runtimeDir = path.join(root, "outputs", "campaign-front-door-runtime");

async function collectTsFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTsFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
  }))).flat();
}

await fs.mkdir(runtimeDir, { recursive: true });
for (const file of await collectTsFiles(sourceDir)) {
  const source = await fs.readFile(file, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText.replace(/require\("(\.{1,2}\/.*?)"\)/g, 'require("$1.cjs")');
  const target = path.join(runtimeDir, path.relative(sourceDir, file).replace(/\.ts$/, ".cjs"));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, output, "utf8");
}
const modelSource = await fs.readFile(path.join(root, "app", "campaign", "campaign-front-door-model.ts"), "utf8");
const modelOutput = ts.transpileModule(modelSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText.replace('require("@/lib/engine")', 'require("./index.cjs")');
await fs.writeFile(path.join(runtimeDir, "campaign-front-door-model.cjs"), modelOutput, "utf8");

const engine = await import(`${pathToFileURL(path.join(runtimeDir, "index.cjs")).href}?front=${Date.now()}`);
const model = await import(`${pathToFileURL(path.join(runtimeDir, "campaign-front-door-model.cjs")).href}?front=${Date.now()}`);
const cards = model.deriveCampaignFrontDoorCards();
assert.equal(cards.length, 12, "front door exposes exactly twelve safe Campaign previews");
assert.deepEqual(cards.map((card) => card.label), ["Town Reckoning", "Clinic Headlines", "Scholarly Silence", "Memorial Trust", "Harbor Testimony", "Railbound Alibi", "Furnace Oath", "Floodgate Covenant", "Midnight Chorus", "Grand Hotel Register", "Blackout Ledger", "Wireless Shadows"], "Campaign order is stable");
assert.deepEqual(cards.map((card) => card.volumeId), ["public-records", "public-records", "public-records", "public-records", "moving-city", "moving-city", "moving-city", "moving-city", "midnight-signals", "midnight-signals", "midnight-signals", "midnight-signals"], "Campaigns are grouped into the three archive volumes");
assert.equal(cards.every((card) => card.routes.length === 2 && card.districtLabel && card.motifLabel), true, "each Campaign preview exposes two routes and a presentation district");
assert.equal(new Set(cards.flatMap((card) => card.routes.map((route) => route.finaleLabel))).size, 24, "each authored route has a distinct finale");
for (const card of cards) {
  for (const route of card.routes) {
    assert.equal(route.chapterLabels.length, 3, `${card.label}/${route.label} shows a three-chapter structure`);
    assert.equal(Boolean(card.investigationTheme && route.strategyLabel && route.primarySurfaceLabel && route.evidenceStyleLabel && route.pressureLabel && route.replayContrast), true, `${card.label}/${route.label} exposes every required safe field`);
  }
}
assert.deepEqual(model.deriveCampaignFrontDoorCards(), cards, "front door catalog is deterministic");
assert.equal(model.campaignFrontDoorSelection(cards, 2).selected.label, "Scholarly Silence", "valid selection is retained");
assert.equal(model.campaignFrontDoorSelection(cards, 11).selected.label, "Wireless Shadows", "twelfth Campaign selection is retained");
assert.equal(model.campaignFrontDoorSelection(cards, 99).selected.label, "Town Reckoning", "invalid selection falls back deterministically");
assert.equal(model.campaignFrontDoorSelection(cards, 4, 1).selectedRoute.label, "Chain Protection", "valid counter-route selection is retained");
assert.equal(model.campaignFrontDoorSelection(cards, 4, 99).selectedRoute.label, "Cargo Testimony", "invalid route selection falls back deterministically");

const serialized = JSON.stringify(cards);
assert.equal(/\b(?:campaignId|routeId|packageId|caseTypeId|worldId|caseId|sessionId|npcId|locationId|sourceId|eventId|culpritId|victimId|hiddenTruth|rawBody)\b/i.test(serialized), false, "public cards contain no internal keys");
assert.equal(/\b(?:case|npc|event|source|location|institution|resource|evidence|session|world)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(serialized), false, "public cards contain no raw identifier-shaped values");

const world = engine.createInitialWorld("campaign-front-door-freeze", { mode: "showcase", npcCount: 8, timelineHours: 24 });
const runtime = engine.createPersistentTownRuntime(world, []);
runtime.currentExperiment = { scenarioPackId: "dock-court-market-town", mapPackId: "dock-court-market-town-map", ruleCatalogId: "dock-court-market-town-rules", selectedAt: "safe", worldPackageId: "dock-court-market-town" };
runtime.currentScenarioPackId = "dock-court-market-town";
engine.refreshCampaignSession(runtime);
assert.equal(runtime.campaignSessionSummary.campaignLabel, "Harbor Testimony", "pre-extraction WorldPackage selection binds the Campaign");
assert.equal(engine.bindCampaignRoute(runtime, "counter-route"), true, "pre-extraction Front Door route selection is accepted");
engine.refreshCampaignSession(runtime);
assert.equal(runtime.campaignSessionSummary.routeLabel, "Chain Protection", "public summary exposes only the safe selected route label");
const originalTruth = engine.createStaticDemoRuntime("archive-blunt").activeCase.deductionCase.truth;
engine.activateCampaignCase(runtime, "internal-case", "internal-cycle");
assert.equal(engine.bindCampaignRoute(runtime, "baseline"), false, "first extraction freezes the authored route");
runtime.currentExperiment.worldPackageId = "hospital-family-press-town";
engine.refreshCampaignSession(runtime);
assert.equal(runtime.campaignSessionSummary.campaignLabel, "Harbor Testimony", "first extraction freezes the Campaign binding");
assert.equal(runtime.campaignSessionSummary.routeLabel, "Chain Protection", "first extraction freezes the route binding");
assert.deepEqual(engine.createStaticDemoRuntime("archive-blunt").activeCase.deductionCase.truth, originalTruth, "front-door selection never changes extracted case truth");

const componentSource = await fs.readFile(path.join(root, "app", "components", "CampaignFrontDoor.tsx"), "utf8");
const localeCatalogSource = await fs.readFile(path.join(root, "app", "localization", "locale-catalog.ts"), "utf8");
assert.doesNotMatch(componentSource, /\bfetch\s*\(|\bpostV1\s*\(|\bpostJson\s*\(/, "Front Door presentation cannot issue requests");
assert.match(componentSource, /archiveIndex/, "Front Door uses a volume archive index");
assert.match(componentSource, /campaign-front-door-dossier/, "Front Door renders one selected dossier");
const { load: loadComponent } = createNoirTestLoader(root);
const { CampaignFrontDoor } = loadComponent("app/components/CampaignFrontDoor.tsx");
const renderFrontDoor = (overrides = {}) => renderToStaticMarkup(React.createElement(CampaignFrontDoor, {
  runtimeMode: "server", open: true, cards, selectedIndex: 0, selectedRouteIndex: 0,
  busy: false, status: "", canContinue: true, onSelect() {}, onSelectRoute() {}, onStart() {}, onContinue() {}, onDismiss() {}, ...overrides
}));
const staticMarkup = renderFrontDoor({ runtimeMode: "static-demo" });
assert.equal((staticMarkup.match(/data-testid="campaign-front-door-card"/g) || []).length, 12, "Static renders all twelve real preview cards");
assert.doesNotMatch(staticMarkup, /<button|role="dialog"|campaign-front-door-start|campaign-front-door-continue|campaign-front-door-route-choice/, "Actual Static branch has no route-selection/start/continue command controls");
assert.match(staticMarkup, /完整游戏|full game/, "Static copy explains the playable-game boundary in player language");
for (const [campaignIndex, card] of cards.entries()) {
  for (const routeIndex of [0, 1]) {
    const rendered = renderFrontDoor({ selectedIndex: campaignIndex, selectedRouteIndex: routeIndex });
    assert.equal((rendered.match(/data-testid="campaign-front-door-card"/g) || []).length, 12, "All campaigns share the same real archive component");
    assert.equal((rendered.match(/data-testid="campaign-front-door-dossier"/g) || []).length, 1, `${card.label} renders exactly one selected dossier`);
    assert.equal((rendered.match(/data-testid="campaign-front-door-route"/g) || []).length, 2, `${card.label} exposes its two real routes`);
    assert.equal((rendered.match(/aria-pressed="true"/g) || []).length, 2, "One campaign and one route are selected");
    assert.match(rendered, /role="dialog" aria-modal="true"/, "The real archive retains its modal accessibility contract");
    for (const label of card.routes[routeIndex].chapterLabels) assert.ok(rendered.includes(renderToStaticMarkup(React.createElement("span", null, label)).slice(6, -7)), `The selected route renders ${label}`);
  }
}
assert.equal(renderFrontDoor({ open: false }), "", "A closed Front Door leaves no hidden player DOM");
const busyMarkup = renderFrontDoor({ busy: true });
assert.equal((busyMarkup.match(/<button/g) || []).length, (busyMarkup.match(/<button[^>]*disabled=""/g) || []).length, "Every real archive action is disabled during launch");
const frontDoorCss = await fs.readFile(path.join(root, "app", "components", "CampaignFrontDoor.module.css"), "utf8");
const routeCss = await fs.readFile(path.join(root, "app", "components", "CampaignFrontDoor.routes.module.css"), "utf8");
assert.match(frontDoorCss, /composes:\s*routeChoice\s+from\s+"\.\/CampaignFrontDoor\.routes\.module\.css"/, "route styles use the explicit composition boundary");
assert.equal(frontDoorCss.split(/\r?\n/).length < 360, true, "Front Door shell CSS stays below 360 lines");
assert.equal(routeCss.split(/\r?\n/).length < 160, true, "Front Door route CSS stays below 160 lines");

console.log(JSON.stringify({ ok: true, campaigns: cards.map((card) => card.label), routeCount: cards.flatMap((card) => card.routes).length, tests: ["twelve-safe-cards", "twenty-four-safe-routes", "determinism", "selection", "public-safe", "pre-extraction-rebind", "route-freeze", "first-extraction-freeze", "truth-isolation", "static-boundary", "24-route-real-react-render", "closed-no-dom", "busy-actions-disabled", "css-ownership"] }));
