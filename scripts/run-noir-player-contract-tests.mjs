import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createNoirTestLoader } from "./noir-player-test-loader.mjs";

const { load } = createNoirTestLoader();
const { deriveCampaignFrontDoorCards } = load("app/campaign/campaign-front-door-model.ts");
const { buildStrategicCommandViewModel } = load("app/campaign/strategic-command-model.ts");
const { buildCampaignCommandBrief } = load("app/campaign/campaign-command-brief-model.ts");
const { buildCertifiedCaseRhythm } = load("app/campaign/certified-case-rhythm-model.ts");
const { buildFinalDetectiveWorkspace } = load("app/campaign/final-detective-workspace-model.ts");
const { isCinematicDeductionGoldSlice } = load("app/campaign/cinematic-deduction-model.ts");
const { CommandDeckShell } = load("app/components/CommandDeckShell.tsx");
const { FinalDetectiveWorkspace } = load("app/components/FinalDetectiveWorkspace.tsx");
const { CinematicDeductionBoard } = load("app/components/CinematicDeductionBoard.tsx");
const { NoirMapStage } = load("app/components/NoirMapStage.tsx");
const cards = deriveCampaignFrontDoorCards();
const count = (source, pattern) => (source.match(pattern) || []).length;
const rows = [];
let actionCalls = 0;
const noAction = () => { actionCalls += 1; };
const theory = { culpritId: "", motive: "", method: "", evidenceIds: [], motiveEvidenceIds: [], methodEvidenceIds: [] };
for (const card of cards) {
  for (const route of card.routes) {
    const campaign = { status: "case-active", campaignLabel: card.label, routeLabel: route.label, chapterLabel: route.chapterLabels[0], chapterObjective: "Investigate the public record", progressLabel: "0/3" };
    const rhythm = buildCertifiedCaseRhythm({ session: null, revealAvailable: false, observedCrimeWindow: false });
    const command = buildStrategicCommandViewModel({ runtimeMode: "server", hasWorld: true, hasCase: true, hasSession: false, judgementAccepted: false, busy: false, caseLabel: route.chapterLabels[0], currentTime: "09:00", campaign, caseRhythm: rhythm });
    const before = JSON.stringify(command);
    const brief = buildCampaignCommandBrief({ command });
    const workspace = buildFinalDetectiveWorkspace({ runtimeMode: "server", commandBrief: brief, rhythm, session: null, notebookItems: [], discoveredEvidence: [], characters: [], testimonies: [], theory });
    const props = { model: workspace, currentAction: rhythm.currentStep.action, observeCaseWindow: noAction, notebookItems: [], discoveredEvidence: [], characters: [], actionAdapter: {}, onIntakeNextAction: noAction, onNotebookAction: noAction, selectedCharacterId: "", setSelectedCharacterId: noAction, selectedEvidenceId: "", setSelectedEvidenceId: noAction, question: "", setQuestion: noAction, theory, setTheory: noAction, submitTheory: noAction, gapCards: [], onGapSelect: noAction, busy: false, lowSensory: true };
    const gold = isCinematicDeductionGoldSlice(campaign);
    const desk = React.createElement(gold ? CinematicDeductionBoard : FinalDetectiveWorkspace, { ...props, ...(gold ? { campaignSession: campaign } : {}) });
    const deskMarkup = renderToStaticMarkup(desk);
    assert.equal(count(deskMarkup, /data-testid="cinematic-deduction-board"/g), 1, `${card.label}/${route.label} shares one actual deduction desk`);
    assert.ok(deskMarkup.includes(`data-variant="${gold ? "cinematic" : "standard"}"`));
    assert.equal(count(deskMarkup, /data-testid="cinematic-submit-theory"/g), 1);
    assert.match(deskMarkup, /data-testid="cinematic-submit-theory"[^>]*disabled=""/, "An empty theory stays disabled on every route");
    assert.doesNotMatch(deskMarkup, /Midnight Chorus|Public Reckoning/, "Shared idle desk contains no invented gold-route identity");
    const shellMarkup = renderToStaticMarkup(React.createElement(CommandDeckShell, { viewModel: command, commandBrief: brief, activeInspectorTab: "investigation", control: React.createElement("div", null, "PRIVATE_TOOLS_SENTINEL"), map: React.createElement("section", { "data-public-map": true }), panels: [{ id: "investigation", label: "Investigation", content: desk }], onContextAction: noAction, onStrategicAction: noAction }));
    assert.equal(count(shellMarkup, /data-testid="command-deck-shell"/g), 1);
    assert.equal(count(shellMarkup, /<main\b/g), 1);
    for (const view of ["explore", "deduction", "journal", "settings", "tools"]) assert.ok(shellMarkup.includes(`data-testid="noir-nav-${view}"`));
    assert.doesNotMatch(shellMarkup, /PRIVATE_TOOLS_SENTINEL|command-deck-full-inspector|cinematic-deduction-board/, "Inactive views and old tools are not secretly mounted on Explore");
    assert.ok(count(shellMarkup, /data-testid="strategic-primary-action"/g) <= 1, "Only one canonical Explore primary action is rendered");
    assert.equal(JSON.stringify(command), before, "Rendering the shared UI never mutates its public command model");
    rows.push({ campaign: card.label, route: route.label, deskVariant: gold ? "cinematic" : "standard", sharedDeskCount: 1, sourceReview: workspace.sourceReview.state, emptyTheory: workspace.theory.state });
  }
}
assert.equal(rows.length, 24);
assert.equal(new Set(rows.map((row) => row.campaign)).size, 12);
assert.equal(rows.filter((row) => row.deskVariant === "cinematic").length, 1, "Only the original Public Reckoning route retains cinematic authority rules");
assert.equal(rows.every((row) => row.sourceReview === "locked"), true, "No route reveals its solution on initial intake");

const publicSnapshot = { width: 10, height: 10, tiles: [
  { locationId: "location-private-01", locationName: "Public court", x: 1, y: 1, searchable: true },
  { locationId: "location-private-01", locationName: "Public court", x: 2, y: 1, searchable: true },
  { locationId: "location-private-02", locationName: "Town archive", x: 8, y: 6, searchable: true }
], actors: [], markers: [] };
const mapProps = { snapshot: publicSnapshot, actorsByTile: new Map(), markersByTile: new Map(), selectedSceneId: "location-private-01", selectedCharacterId: "", currentTime: "09:00", campaignMapReady: false, characterEncounter: null, hoverInfo: null, timeValue: 540, timeMin: 0, timeMax: 1440, replaying: false, onTileClick: noAction, onTileHover: noAction, onActorClick: noAction, onMarkerClick: noAction, onEncounterAction: noAction, onEncounterDismiss: noAction, onLocationAction: noAction, setTimeValue: noAction, setReplaying: noAction, minutesToTime: () => "09:00", timeToMinutes: () => 540 };
const mapBefore = JSON.stringify(publicSnapshot);
const mapMarkup = renderToStaticMarkup(React.createElement(NoirMapStage, mapProps));
assert.equal(count(mapMarkup, /aria-label="Public court"/g), 1, "Repeated map tiles produce one actual public location button");
assert.equal(count(mapMarkup, /aria-label="Town archive"/g), 1, "Every distinct location is reachable");
assert.doesNotMatch(mapMarkup, /location-private-0[12]/, "Map labels expose public names instead of private identifiers");
assert.equal(JSON.stringify(publicSnapshot), mapBefore, "Map projection never mutates the snapshot");
assert.match(renderToStaticMarkup(React.createElement(NoirMapStage, { ...mapProps, snapshot: null })), /data-testid="noir-map-stage"/, "The real map renders a safe empty state");
assert.equal(actionCalls, 0, "Pure rendering never dispatches gameplay actions");
const report = { status: "passed", campaigns: 12, routes: 24, modelAndReactSSR: true, realBrowser: false, routeRows: rows, checks: ["shared-desk-24-routes", "gold-authority-gate-one-route", "locked-source-review", "empty-theory-disabled", "five-view-navigation", "no-hidden-tools-or-legacy-dom", "one-explore-primary", "model-non-mutation", "native-location-deduplication", "public-map-labels", "empty-map", "no-action-during-render"] };
const reportPath = path.join(process.cwd(), "outputs/detective-noir-ui-20260907/shared-ui-coverage.json");
await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
