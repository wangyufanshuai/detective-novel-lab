import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const outputDir = path.join(root, "outputs", "campaign-resolution-ledger-runtime");
const sourcePath = path.join(root, "app", "campaign", "campaign-resolution-ledger-model.ts");
const outputPath = path.join(outputDir, "campaign-resolution-ledger-model.mjs");
await fs.mkdir(outputDir, { recursive: true });
const source = await fs.readFile(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
await fs.writeFile(outputPath, compiled, "utf8");
const { buildCampaignResolutionLedger } = await import(`${pathToFileURL(outputPath).href}?test=${Date.now()}`);

function command(overrides = {}) {
  return {
    runtimeMode: "server",
    currentObjective: {
      title: "Search the public archive",
      detail: "Inspect the certified scene.",
      nextAction: "Use the certified Search action.",
      progressLabel: "2/7 certified steps"
    },
    campaignProgress: {
      chapterLabel: "Public Record",
      progressLabel: "1/3 campaign cases closed",
      nextAction: "Continue the current route."
    },
    caseRhythm: { progressLabel: "2/7 certified steps" },
    campaignPacing: { status: "active", progressLabel: "1/3 campaign cases closed" },
    presentationFeedback: {
      state: "available",
      tone: "info",
      label: "Action available",
      detail: "Search is available.",
      signature: "available"
    },
    outcomeFeedback: {
      immediate: { label: "Immediate Result", detail: "The existing route advances." },
      world: { label: "World Consequence", detail: "World state stable." },
      next: { label: "Next Objective", detail: "Question the prepared witness." }
    },
    worldConsequenceTimeline: {
      state: "empty",
      headline: "World state stable",
      summary: "No player-facing consequence is active.",
      nextAction: "Continue the certified route.",
      beats: []
    },
    primaryAction: {
      kind: "certified-investigation",
      label: "Search location"
    },
    ...overrides
  };
}

function brief(overrides = {}) {
  return {
    runtimeMode: "server",
    nextAction: "Question the prepared witness through the certified handler.",
    safeBoundary: "Case truth, evidence coverage, the certified route, judgement, and NPC legal actions remain unchanged.",
    ...overrides
  };
}

function journal(label, result, progressDelta, options = {}) {
  return {
    id: options.id || `guided-${label}`,
    journalKey: options.journalKey,
    step: options.step || "search",
    label,
    status: options.status || "done",
    result,
    progressDelta,
    nextAction: options.nextAction || "This historical next action must not replace the canonical current action."
  };
}

const baseInput = { command: command(), commandBrief: brief(), guidedJournal: [] };
const before = structuredClone(baseInput);
const idle = buildCampaignResolutionLedger(baseInput);
assert.equal(idle.status, "idle");
assert.equal(idle.entries.length, 0);
assert.equal(idle.latest.actionLabel, "No action resolved");
assert.equal(idle.latest.chain.result, "No result has been recorded yet.");
assert.equal(idle.latest.chain.worldChange, "No persistent world change");
assert.equal(idle.latest.chain.nextAction, baseInput.commandBrief.nextAction);
assert.deepEqual(baseInput, before, "Ledger does not mutate its inputs");
assert.deepEqual(idle, buildCampaignResolutionLedger(structuredClone(baseInput)), "same safe input produces byte-stable output");

const resolving = buildCampaignResolutionLedger({
  ...baseInput,
  command: command({ presentationFeedback: { state: "resolving", tone: "focus", label: "Resolving action", detail: "Search is resolving.", signature: "resolve" } }),
  transition: { visible: true, phase: "action-resolving", kind: "investigation-action-resolved", title: "Search location", detail: "The existing handler is resolving." }
});
assert.equal(resolving.status, "resolving");
assert.equal(resolving.entries.length, 0, "transient resolving state never enters completed history");
assert.match(resolving.latest.chain.result, /resolving/i);

const investigationActions = [
  ["Join investigation", "Investigation session opened.", "Player can now search scenes.", "join"],
  ["Search location", "Evidence was discovered.", "3/7 certified steps", "search"],
  ["Question witness", "Public testimony was recorded.", "4/7 certified steps", "question"],
  ["Challenge testimony", "A contradiction was recorded.", "5/7 certified steps", "challenge"]
];
for (const [label, result, progress, step] of investigationActions) {
  const ledger = buildCampaignResolutionLedger({ ...baseInput, guidedJournal: [journal(label, result, progress, { step })] });
  assert.equal(ledger.status, "recorded", `${label} creates a recorded resolution`);
  assert.equal(ledger.latest.chain.result, result);
  assert.equal(ledger.latest.chain.worldChange, "No persistent world change");
  assert.equal(ledger.latest.chain.objectiveProgress, progress);
  assert.equal(ledger.latest.chain.nextAction, baseInput.commandBrief.nextAction, "latest Next Action always comes from the same Command Brief");
}

const wrongTheory = buildCampaignResolutionLedger({
  ...baseInput,
  guidedJournal: [journal("Theory recovery path prepared", "The theory has certified gaps.", "Review one visible gap.", { step: "submit", status: "blocked", journalKey: "campaign-recovery-theory" })]
});
assert.equal(wrongTheory.status, "blocked");
assert.equal(wrongTheory.latest.tone, "warning");
assert.notEqual(wrongTheory.latest.status, "completed", "blocked theory cannot masquerade as completed");

const worldKinds = [
  ["World lead outcome settled", "world-lead-outcome"],
  ["Faction directive completed", "world-arc-directive-completed"],
  ["World event offer completed", "world-event-offer-completed"],
  ["Campaign recovery completed", "campaign-recovery-completed"]
];
for (const [label, journalKey] of worldKinds) {
  const ledger = buildCampaignResolutionLedger({
    command: command({ worldConsequenceTimeline: { state: "settled", headline: label, summary: "A bounded public result remains visible.", nextAction: "Continue.", beats: [] } }),
    commandBrief: brief(),
    guidedJournal: [journal(label, `${label} safely.`, "A public world surface changed.", { step: "submit", journalKey })]
  });
  assert.equal(ledger.latest.chain.worldChange, "A public world surface changed.", `${label} records a persistent world result`);
  assert.equal(ledger.latest.chain.objectiveProgress, "2/7 certified steps");
}

const acceptedTheory = buildCampaignResolutionLedger({
  command: command({ presentationFeedback: { state: "completed", tone: "success", label: "Campaign complete", detail: "Accepted theory recorded.", signature: "complete" }, campaignPacing: { status: "settled", progressLabel: "3/3 campaign cases closed" } }),
  commandBrief: brief({ nextAction: "Review the debrief or begin a clean route." }),
  guidedJournal: [journal("Campaign convergence completed", "Finale route completed.", "3/3 campaign cases closed", { step: "submit", journalKey: "arc-convergence-completed" })]
});
assert.equal(acceptedTheory.status, "completed");
assert.equal(acceptedTheory.latest.tone, "success");
assert.equal(acceptedTheory.latest.chain.nextAction, "Review the debrief or begin a clean route.");

const caseOpened = buildCampaignResolutionLedger({
  command: command({ worldConsequenceTimeline: { state: "active", headline: "Next-case handoff", summary: "One bounded queue preference was consumed.", nextAction: "Join the new case.", beats: [] } }),
  commandBrief: brief({ nextAction: "Join the newly extracted investigation." }),
  transition: { visible: true, phase: "immediate-result", kind: "case-opened", eyebrow: "Case opened", title: "Next case opened", detail: "Route integrity passed." },
  guidedJournal: []
});
assert.equal(caseOpened.status, "recorded");
assert.match(caseOpened.latest.chain.worldChange, /handoff/i);
assert.equal(caseOpened.latest.chain.nextAction, "Join the newly extracted investigation.");

const manyEntries = Array.from({ length: 9 }, (_, index) => journal(
  `Recorded action ${index + 1}`,
  `Safe result ${index + 1}`,
  `${index + 1}/9 route marks`,
  { id: `entry-${index + 1}`, step: index % 2 ? "question" : "search" }
));
manyEntries.push({ ...manyEntries[8], id: "duplicate-last" });
const bounded = buildCampaignResolutionLedger({ ...baseInput, guidedJournal: manyEntries });
assert.equal(bounded.entries.length, 6, "history is bounded to six entries");
assert.equal(bounded.entryCount, 6);
assert.equal(new Set(bounded.entries.map((entry) => entry.signature)).size, 6, "semantic duplicate entries are removed deterministically");
assert.equal(bounded.entries[0].chain.result, "Safe result 9", "latest unique Journal result remains first");

const staticWorld = buildCampaignResolutionLedger({
  command: command({ runtimeMode: "static-demo", worldConsequenceTimeline: { state: "settled", headline: "Server result", summary: "Server-only persistence.", nextAction: "Continue.", beats: [] } }),
  commandBrief: brief({ runtimeMode: "static-demo" }),
  guidedJournal: [journal("World lead outcome settled", "Practice result.", "Persistent server delta.", { journalKey: "world-lead-outcome" })]
});
assert.equal(staticWorld.latest.chain.worldChange, "No persistent world change", "Static never presents a persistent Server result");

const unsafe = buildCampaignResolutionLedger({
  command: command({ presentationFeedback: { state: "updated", tone: "info", label: "npc-42", detail: "hiddenTruth C:\\private\\case.json", signature: "unsafe" } }),
  commandBrief: brief({ nextAction: "sourceId /Users/private/replay.json" }),
  guidedJournal: [journal("case-2026-001", "rawBody culpritId", "institution-2048-secret", { journalKey: "world-event-42" })]
});
const publicProjection = JSON.stringify(unsafe);
assert.equal(/\b(?:case|npc|event|source|location|institution|resource|evidence|scene|session|world|campaign|package|character)-[a-z0-9-]*\d[a-z0-9-]*\b|culpritId|victimId|hiddenTruth|rawBody|sourceId|[A-Za-z]:[\\/]|\/Users\//i.test(publicProjection), false, "Ledger strips raw identifiers, private fields, and absolute paths");

for (const relative of [
  "app/campaign/campaign-resolution-ledger-model.ts",
  "app/hooks/useCampaignResolutionLedger.ts",
  "app/components/CampaignResolutionLedger.tsx",
  "app/components/CampaignTransitionTheatre.tsx",
  "app/components/InvestigationRouteReviewSurface.tsx"
]) {
  const moduleSource = await fs.readFile(path.join(root, relative), "utf8");
  assert.doesNotMatch(moduleSource, /\bfetch\s*\(|\bpostV1\s*\(|\bpostJson\s*\(|\/api\//, `${relative} remains request-free`);
  assert.doesNotMatch(moduleSource, /localStorage|sessionStorage|indexedDB/, `${relative} remains storage-free`);
}

const componentSource = await fs.readFile(path.join(root, "app/components/CampaignResolutionLedger.tsx"), "utf8");
const shellSource = await fs.readFile(path.join(root, "app/components/CommandDeckShell.tsx"), "utf8");
const theatreSource = await fs.readFile(path.join(root, "app/components/CampaignTransitionTheatre.tsx"), "utf8");
const journalSource = await fs.readFile(path.join(root, "app/components/InvestigationRouteReviewSurface.tsx"), "utf8");
assert.deepEqual([...componentSource.matchAll(/messageKey: "(ledger\.(?:result|worldChange|objectiveProgress|nextAction))"/g)].map((match) => match[1]), ["ledger.result", "ledger.worldChange", "ledger.objectiveProgress", "ledger.nextAction"], "one shared component owns the localized fixed four-stage chain");
assert.match(shellSource, /CampaignResolutionLedgerProvider ledger=\{resolutionLedger\}/, "Command Deck provides one canonical Ledger object to all descendants");
assert.match(shellSource, /<CampaignResolutionLatest ledger=\{resolutionLedger\}/, "Command Deck consumes the canonical latest resolution");
assert.match(shellSource, /<CampaignTransitionTheatre presentation=\{theatre\.presentation\} ledger=\{resolutionLedger\}/, "Theatre consumes that same Ledger object");
assert.match(theatreSource, /CampaignResolutionChain/, "Theatre renders the shared causal chain instead of rewriting result copy");
assert.match(journalSource, /<CampaignResolutionJournal\s*\/>/, "Guided Journal consumes the Ledger from the same provider");
assert.doesNotMatch(theatreSource, /commandBrief\?\.nextAction|presentation\.benefitLabel|presentation\.costLabel/, "Theatre no longer independently rewrites canonical Result, World Change, or Next Action copy");
assert.match(componentSource, /ariaLive=\{ledger\.runtimeMode === "static-demo" \? "polite" : undefined\}/, "Static owns one local polite result announcement while Server leaves live ownership to Theatre");

const hookSource = await fs.readFile(path.join(root, "app/hooks/useCampaignResolutionLedger.ts"), "utf8");
const pageSource = await fs.readFile(path.join(root, "app/page.tsx"), "utf8");
assert.equal(source.split(/\r?\n/).length < 350, true, "Ledger model stays below 350 lines");
assert.equal(hookSource.split(/\r?\n/).length < 100, true, "Ledger hook stays below 100 lines");
assert.equal(pageSource.split(/\r?\n/).length < 1100, true, "page.tsx stays below 1,100 lines");

console.log(JSON.stringify({
  ok: true,
  suite: "campaign-resolution-ledger",
  checks: [
    "five-states", "four-stage-chain", "certified-actions", "wrong-theory", "accepted-theory",
    "world-choices", "case-transition", "campaign-completion", "six-entry-bound",
    "deterministic-deduplication", "input-non-mutation", "static-no-persistence", "public-safe",
    "single-provider", "shared-consumers", "request-free", "storage-free", "source-budgets"
  ]
}));
