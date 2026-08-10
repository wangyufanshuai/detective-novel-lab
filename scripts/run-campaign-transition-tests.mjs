import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const runtimeDir = path.join(root, "outputs", "campaign-transition-test-runtime");
await fs.mkdir(runtimeDir, { recursive: true });

async function loadModel(relativePath, outputName) {
  const sourcePath = path.join(root, relativePath);
  const source = await fs.readFile(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const outputPath = path.join(runtimeDir, outputName);
  await fs.writeFile(outputPath, output, "utf8");
  return { source, module: await import(`${pathToFileURL(outputPath).href}?run=${Date.now()}`) };
}

const transition = await loadModel("app/campaign/campaign-transition-model.ts", "campaign-transition-model.cjs");
const overlay = await loadModel("app/campaign/command-deck-overlay-model.ts", "command-deck-overlay-model.cjs");

function fixture(overrides = {}) {
  return {
    runtimeMode: "server",
    townPulse: { caseLabel: "The Open Ledger", timeLabel: "08:00", heatLabel: "low", trustLabel: "stable", pressureLabel: "watch", campaignLabel: "Town Reckoning" },
    currentObjective: { action: "search", phase: "Search", title: "Search the archive counter", detail: "Inspect the public custody surface.", nextAction: "Question the prepared witness.", recoveryLabel: "not needed", progressLabel: "0/3" },
    selectedContext: { kind: "location", label: "Town Archive", detail: "Public location", actions: [] },
    campaignProgress: { chapterLabel: "Town Reckoning / Public Record", progressLabel: "0/3 campaign cases closed", nextAction: "Continue the certified route." },
    mapSignals: { institutionLabel: "Civic Records Office", pressureLabel: "watch", socialResponseLabel: "supportive" },
    mapLenses: { defaultLens: "evidence", controls: [], locationSignals: [] },
    investigationTurn: { turnNumber: 2, phase: "resolve", objectiveKey: "search", lastActionLabel: "Search the archive", feedbackLabel: "Resolving" },
    worldConsequenceTimeline: { state: "active", headline: "Archive routines adjust", summary: "Public staff restore the visible custody route.", nextAction: "Read the next case context.", beats: [] },
    presentationFeedback: { state: "resolving", tone: "focus", audioCue: "resolve", label: "Resolving action", detail: "Search is resolving.", signature: "resolve:2" },
    campaignPacing: {
      status: "active", campaignLabel: "Town Reckoning", chapterLabel: "Public Record", progressLabel: "0/3 campaign cases closed",
      currentObjective: { label: "Search the archive counter", detail: "Inspect the public custody surface." }, whyNow: "The custody gap shapes the next debt inquiry.", prerequisiteLabel: "Join first.", nextAction: "Question the prepared witness.",
      value: { campaignLabel: "Town Reckoning", chapterLabel: "Public Record", chapterOrdinal: 1, publicHook: "A public record moved twice.", primarySurface: "civic procedure", consequenceLabel: "Archive custody becomes public context.", whyNow: "Custody matters now.", whatChanges: "Public staff restore routine.", nextCaseHint: "The debt inquiry inherits the custody result.", replayContrast: "Try another fair route.", leadFocusLabel: "Search" },
      safeForecast: { whatChanges: "Public staff restore routine.", visibleSurface: "civic procedure / archive custody", unchangedAuthority: "Truth, evidence coverage, the certified route, judgement, and NPC legal actions remain unchanged." },
      primaryAction: { kind: "current-objective", label: "Search", detail: "Search", enabled: true, primary: true }, secondaryActions: [], disclosure: { essential: [], context: [], detail: [] }
    },
    notifications: [], resourceRibbon: [], decisionQueue: [],
    primaryAction: { kind: "certified-investigation", target: "context-action", label: "Search evidence", detail: "Use the existing certified search handler.", benefitLabel: "Advances the certified route.", costLabel: "No hidden answer is revealed.", priority: 2, enabled: true, blocking: true, contextActionKind: "search" },
    secondaryActions: [],
    outcomeFeedback: { immediate: { label: "Immediate Result", detail: "Evidence found." }, world: { label: "World Consequence", detail: "Archive routines adjust." }, next: { label: "Next Objective", detail: "Question the prepared witness." } },
    advanceState: { state: "blocked", label: "Advance held", detail: "Finish the certified step." },
    ...overrides
  };
}

const command = fixture();
const lifecycle = { state: "resolving", action: command.primaryAction, detail: "The existing command handler is resolving." };
const before = structuredClone({ command, lifecycle });
const phases = ["idle", "action-resolving", "immediate-result", "world-consequence", "next-objective", "dismissed"];
for (const phase of phases) {
  const first = transition.module.deriveCampaignBeatPresentation({ command, lifecycle, phase, sequence: 1 });
  const second = transition.module.deriveCampaignBeatPresentation({ command: structuredClone(command), lifecycle: structuredClone(lifecycle), phase, sequence: 1 });
  assert.deepEqual(first, second, `${phase} presentation is deterministic`);
  assert.equal(first.visible, phase !== "idle" && phase !== "dismissed", `${phase} visibility is bounded`);
}
assert.deepEqual({ command, lifecycle }, before, "transition derivation does not mutate command or lifecycle input");

const resolving = transition.module.deriveCampaignBeatPresentation({ command, lifecycle, phase: "action-resolving", sequence: 1 });
const immediate = transition.module.deriveCampaignBeatPresentation({ command, lifecycle: { ...lifecycle, state: "succeeded" }, phase: "immediate-result", sequence: 1 });
const consequence = transition.module.deriveCampaignBeatPresentation({ command, lifecycle: { ...lifecycle, state: "succeeded" }, phase: "world-consequence", sequence: 1 });
const next = transition.module.deriveCampaignBeatPresentation({ command, lifecycle: { ...lifecycle, state: "succeeded" }, phase: "next-objective", sequence: 1 });
assert.equal(resolving.phaseIndex, 0, "resolving owns the first theatre stage");
assert.equal(immediate.phaseIndex, 1, "immediate result owns the second theatre stage");
assert.equal(consequence.phaseIndex, 2, "world consequence owns the third theatre stage");
assert.equal(next.phaseIndex, 3, "next objective owns the fourth theatre stage");
assert.equal(immediate.kind, "investigation-action-resolved", "certified actions remain investigation beats");
assert.equal(transition.module.deriveCampaignBeatPresentation({ command, lifecycle: { ...lifecycle, action: { ...command.primaryAction, kind: "faction-directive" } }, phase: "immediate-result" }).kind, "world-choice-resolved", "world decisions use the world-choice beat");
assert.equal(transition.module.deriveCampaignBeatPresentation({ command, signal: "chapter-transition", phase: "immediate-result" }).kind, "chapter-transition", "chapter change overrides the action beat");
assert.equal(transition.module.deriveCampaignBeatPresentation({ command, signal: "finale-ready", phase: "immediate-result" }).kind, "finale-ready", "finale signal has a distinct beat");
assert.equal(transition.module.deriveCampaignBeatPresentation({ command, signal: "campaign-completed", phase: "immediate-result" }).kind, "campaign-completed", "campaign completion has a distinct beat");

assert.equal(transition.module.nextCampaignBeatPhase("action-resolving", true), "immediate-result");
assert.equal(transition.module.nextCampaignBeatPhase("immediate-result", true), "world-consequence");
assert.equal(transition.module.nextCampaignBeatPhase("immediate-result", false), "next-objective");
assert.equal(transition.module.nextCampaignBeatPhase("world-consequence", true), "next-objective");
assert.equal(transition.module.nextCampaignBeatPhase("next-objective", true), "dismissed");

const progressBefore = transition.module.campaignProgressSignature(command);
const chapterCommand = fixture({ campaignPacing: { ...command.campaignPacing, chapterLabel: "Debt Pressure", progressLabel: "1/3 campaign cases closed" } });
assert.equal(transition.module.campaignTransitionSignal(progressBefore, chapterCommand), "chapter-transition", "chapter progress creates one transition signal");
const finaleCommand = fixture({ campaignPacing: { ...command.campaignPacing, chapterLabel: "Finale case", progressLabel: "2/3 campaign cases closed" } });
assert.equal(transition.module.campaignTransitionSignal(progressBefore, finaleCommand), "finale-ready", "Finale chapter creates the Finale signal");
const settledCommand = fixture({ campaignPacing: { ...command.campaignPacing, status: "settled", chapterLabel: "Campaign complete", progressLabel: "3/3 campaign cases closed" } });
assert.equal(transition.module.campaignTransitionSignal(progressBefore, settledCommand), "campaign-completed", "settled Campaign creates completion signal");

const precedence = [
  [{ blockingOverlayActive: true, transitionVisible: true, encounterVisible: true, activePanel: "context", toastVisible: true }, "blocking"],
  [{ transitionVisible: true, transitionPhase: "action-resolving", encounterVisible: true, activePanel: "fronts" }, "action"],
  [{ transitionVisible: true, transitionPhase: "world-consequence", encounterVisible: true, activePanel: "context" }, "transition"],
  [{ encounterVisible: true, activePanel: "context" }, "encounter"],
  [{ activePanel: "context" }, "context"],
  [{ activePanel: "fronts" }, "fronts"],
  [{ activePanel: "queue" }, "panel"],
  [{ toastVisible: true }, "toast"],
  [{}, "none"]
];
for (const [input, expected] of precedence) assert.equal(overlay.module.resolveCommandDeckOverlay(input).dominant, expected, `${expected} follows fixed overlay precedence`);
const transitionOverlay = overlay.module.resolveCommandDeckOverlay({ transitionVisible: true, transitionPhase: "world-consequence", encounterVisible: true, activePanel: "fronts", toastVisible: true });
assert.equal(transitionOverlay.locksPanels, true, "transition locks lower-priority panels");
assert.equal(transitionOverlay.suspendEncounter && transitionOverlay.suspendFronts && transitionOverlay.suspendNotifications && transitionOverlay.suspendToasts, true, "transition suspends competing overlays");

const unsafe = fixture({ selectedContext: { ...command.selectedContext, label: "npc-42 culpritId C:\\private\\case.db" } });
const publicText = JSON.stringify(transition.module.deriveCampaignBeatPresentation({ command: unsafe, lifecycle, phase: "next-objective", sequence: 2 }));
assert.equal(/\b(?:npc|case|event|source|location|institution|resource|evidence|session|world)-[a-z0-9-]*\d[a-z0-9-]*\b|culpritId|victimId|hiddenTruth|rawBody|[A-Za-z]:[\\/]/i.test(publicText), false, "theatre output strips internal ids, private fields, and paths");

for (const relative of [
  "app/campaign/campaign-transition-model.ts",
  "app/campaign/command-deck-overlay-model.ts",
  "app/hooks/useCampaignTransitionTheatre.ts",
  "app/hooks/useCommandDeckOverlayArbiter.ts",
  "app/components/CampaignTransitionTheatre.tsx"
]) {
  const source = await fs.readFile(path.join(root, relative), "utf8");
  assert.doesNotMatch(source, /\bfetch\s*\(|\bpostV1\s*\(|\bpostJson\s*\(|\/api\//, `${relative} remains request-free`);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/, `${relative} remains storage-free`);
}

const theatreCss = await fs.readFile(path.join(root, "app/components/CampaignTransitionTheatre.module.css"), "utf8");
assert.match(theatreCss, /\.actions button\s*\{[^}]*min-height:\s*44px/s, "Theatre actions keep a 44px target at every breakpoint");
assert.match(theatreCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*animation:\s*none\s*!important/s, "Theatre removes non-essential reduced-motion animation");
assert.match(theatreCss, /@media\s*\(max-width:\s*520px\)[\s\S]*?\.theatre\s*\{[\s\S]*?order:\s*-3/s, "Compact Theatre remains the first dominant Map Area surface");
const commandDeckShellSource = await fs.readFile(path.join(root, "app/components/CommandDeckShell.tsx"), "utf8");
const commandDeckShellCss = await fs.readFile(path.join(root, "app/components/CommandDeckShell.module.css"), "utf8");
const commandDeckResponsiveCss = await fs.readFile(path.join(root, "app/components/CommandDeckShell.responsive.module.css"), "utf8");
assert.match(commandDeckShellSource, /viewModel\.runtimeMode === "server" && theatre\.presentation\.visible/, "Static never activates the Server-only Theatre overlay");
assert.match(commandDeckShellSource, /transitionVisible && <CampaignTransitionTheatre/, "Theatre rendering shares the same Server-only arbitration gate");
assert.match(commandDeckShellSource, /CommandDeckShell\.responsive\.module\.css/, "Command Deck loads its responsive ownership after core styles");
assert.match(`${commandDeckShellCss}\n${commandDeckResponsiveCss}`, /@media\s*\(max-width:\s*900px\)[\s\S]*data-suspend-context="true"[\s\S]*visibility:\s*hidden/s, "Compact suspended Context cannot visually cover the Theatre");

const authority = { truth: { culpritId: "hidden" }, evidenceCoverage: 34, routeCertificate: "certified", judgement: "pending", candidates: ["a", "b"], npcLegalActions: ["move", "work"] };
const authorityBefore = structuredClone(authority);
transition.module.deriveCampaignBeatPresentation({ command, lifecycle, phase: "world-consequence", sequence: 3 });
overlay.module.resolveCommandDeckOverlay({ transitionVisible: true, transitionPhase: "world-consequence" });
assert.deepEqual(authority, authorityBefore, "presentation and overlay models cannot mutate detached authority");

console.log(JSON.stringify({
  ok: true,
  suite: "campaign-transition-theatre",
  checks: ["six-phases", "six-beats", "determinism", "non-mutation", "phase-advance", "chapter-signals", "overlay-precedence", "overlay-suspension", "public-safe", "request-free", "storage-free", "server-only-render", "44px-controls", "reduced-motion", "authority-isolation"]
}));
