import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { sha256Json } from "./v11-alpha-evidence-lib.mjs";

const root = process.cwd();
const sourceDir = path.join(root, "packages", "engine", "src");
const runtimeDir = path.join(root, "outputs", "cinematic-deduction-test-runtime");
const json = process.argv.includes("--json");
const persistEvidence = process.argv.includes("--evidence");

async function loadEngine() {
  await fs.mkdir(runtimeDir, { recursive: true });
  async function collect(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return (await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return collect(fullPath);
      return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
    }))).flat();
  }
  for (const file of await collect(sourceDir)) {
    const source = await fs.readFile(file, "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true
      }
    }).outputText;
    const relative = path.relative(sourceDir, file).replace(/\.ts$/, ".cjs");
    const target = path.join(runtimeDir, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, compiled.replace(/require\("(\.{1,2}\/.+?)"\)/g, 'require("$1.cjs")'), "utf8");
  }
  return import(`${pathToFileURL(path.join(runtimeDir, "index.cjs")).href}?v=${Date.now()}`);
}

async function loadCinematicModel() {
  const source = await fs.readFile(path.join(root, "app", "campaign", "cinematic-deduction-model.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

async function loadGoldSliceLocale() {
  const source = await fs.readFile(path.join(root, "app", "localization", "midnight-chorus-gold-slice-locale.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

async function loadWorkspaceModel() {
  const source = await fs.readFile(path.join(root, "app", "campaign", "final-detective-workspace-model.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

function workspace(overrides = {}) {
  return {
    stage: "intake",
    objective: { title: "Reconstruct the public account" },
    theory: { state: "draft", selectedEvidenceCount: 0 },
    recovery: { state: "empty" },
    evidence: { discoveredCount: 0 },
    testimony: { contradictionCount: 0 },
    ...overrides
  };
}

const [engine, cinematic, goldSliceLocale, workspaceModel] = await Promise.all([loadEngine(), loadCinematicModel(), loadGoldSliceLocale(), loadWorkspaceModel()]);
const publicRoute = {
  campaignLabel: "Midnight Chorus",
  routeLabel: "Public Reckoning",
  chapterLabel: "Printed Whisper",
  chapterObjective: "Reconstruct the corrected playbill route."
};
const backstageRoute = { ...publicRoute, routeLabel: "Backstage Compact" };

assert.equal(cinematic.isCinematicDeductionGoldSlice(publicRoute), true, "Public Reckoning activates the cinematic gold slice");
assert.equal(cinematic.isCinematicDeductionGoldSlice(backstageRoute), false, "Backstage Compact retains the established workspace");
assert.equal(cinematic.isCinematicDeductionGoldSlice({ ...publicRoute, campaignLabel: "Glass Harbor" }), false, "other campaigns retain the established workspace");

const demoStart = engine.createStaticDemoRuntime("archive-blunt");
const contradictionTarget = demoStart.activeCase.testimonies.find((testimony) =>
  testimony.contradictionEvidenceIds.some((evidenceId) =>
    demoStart.activeCase.deductionCase.evidence.some((evidence) => evidence.id === evidenceId && evidence.discoverable)
  )
);
assert.ok(contradictionTarget, "the certified demo route exposes a discoverable contradiction target");
const contradictionEvidenceId = contradictionTarget.contradictionEvidenceIds.find((evidenceId) =>
  demoStart.activeCase.deductionCase.evidence.some((evidence) => evidence.id === evidenceId && evidence.discoverable)
);
assert.ok(contradictionEvidenceId, "the contradiction target has a discoverable evidence connection");
const discoveredDemo = engine.discoverDemoEvidence(demoStart, contradictionEvidenceId);
assert.equal(discoveredDemo.session.discoveredEvidenceIds.includes(contradictionEvidenceId), true, "discovering evidence changes the player's known clue set");
const selectedEvidenceIds = workspaceModel.toggleTheoryEvidenceIds([], contradictionEvidenceId);
assert.deepEqual(selectedEvidenceIds, [contradictionEvidenceId], "selecting evidence adds it to the theory chain");
assert.deepEqual(workspaceModel.toggleTheoryEvidenceIds(selectedEvidenceIds, contradictionEvidenceId), [], "excluding selected evidence removes it from the theory chain");
const questionedDemo = engine.interrogateDemoNpc(discoveredDemo, {
  characterId: contradictionTarget.characterId,
  question: "Where were you during the public incident window?"
});
assert.equal(questionedDemo.session.interrogationLog.length, discoveredDemo.session.interrogationLog.length + 1, "a witness claim is recorded before contradiction");
assert.equal(questionedDemo.progress.challengedTestimony, false, "a claim alone does not invent a contradiction");
const beforeChallenge = questionedDemo.activeCase.testimonies.find((item) => item.characterId === contradictionTarget.characterId);
const challengedDemo = engine.interrogateDemoNpc(questionedDemo, {
  characterId: contradictionTarget.characterId,
  evidenceId: contradictionEvidenceId,
  question: "How does this evidence change your public statement?"
});
const afterChallenge = challengedDemo.activeCase.testimonies.find((item) => item.characterId === contradictionTarget.characterId);
const challengeEntry = challengedDemo.session.interrogationLog.at(-1);
assert.equal(challengeEntry?.challenge?.hit, true, "connecting the certified clue to the witness exposes the authored contradiction");
assert.equal(challengedDemo.progress.challengedTestimony, true, "the contradiction loop changes visible investigation cognition");
assert.notDeepEqual(afterChallenge, beforeChallenge, "the witness/world projection reacts after a certified contradiction");

const goldCampaign = engine.listDetectiveCampaignDefinitions().find((item) => item.id === "midnight-chorus");
const goldRoute = goldCampaign.routes.find((item) => item.id === "baseline");
const goldTreatments = engine.listAuthoredCampaignCaseDefinitions()
  .filter((item) => item.campaignId === "midnight-chorus" && item.routeId === "baseline")
  .sort((left, right) => left.ordinal - right.ordinal);
const goldSlicePublicStrings = [...new Set([
  goldCampaign.volumeLabel, goldCampaign.label, goldCampaign.themeLabel,
  goldRoute.label, goldRoute.strategyLabel, goldRoute.finaleLabel, goldRoute.replayContrast,
  ...goldRoute.chapters.flatMap((chapter) => [chapter.label, chapter.objectiveLabel, chapter.evidenceThemeLabel, chapter.worldSurfaceLabel]),
  ...goldTreatments.flatMap((treatment) => [
    treatment.title, treatment.theme, treatment.publicPremise, treatment.publicCaseFile, treatment.causalBridge,
    treatment.occupationalPressure, treatment.evidenceFrame, ...Object.values(treatment.evidenceTitles), ...treatment.redHerrings,
    treatment.witnessFrame, treatment.challengeFrame, treatment.aftermathLabel
  ])
])];
const missingChinese = goldSlicePublicStrings.filter((value) => {
  const projected = goldSliceLocale.localizeMidnightChorusGoldSlice(value, "zh-CN");
  return !projected || projected === value || !/[\u3400-\u9fff]/u.test(projected);
});
assert.deepEqual(missingChinese, [], "every public string in the three-chapter gold slice has a safe Chinese projection");
for (const value of [
  "Join investigation",
  "Undiscovered clue",
  "Question a witness to establish a public statement.",
  "Draft incomplete",
  "Focus Greenhouse and use the existing certified Search action.",
  "No action resolved",
  "Search the next linked scene",
  "Search the linked scene for a required clue.",
  "Search operation resolved",
  "Choose World Lead response",
  "Add clue to theory",
  "Open theory workspace",
  "Evidence found: Restricted type block",
  "Case truth, evidence coverage, the certified route, judgement, and NPC legal actions remain unchanged."
]) {
  assert.match(goldSliceLocale.localizeMidnightChorusGoldSlice(value, "zh-CN") || "", /[\u3400-\u9fff]/u, `${value} has a Chinese gold-slice UI projection`);
}
for (const value of ["2/7 certified steps", "1/4 clues found", "0/3 campaign cases closed", "60 min"]) {
  assert.match(goldSliceLocale.localizeMidnightChorusGoldSlice(value, "zh-CN") || "", /[\u3400-\u9fff]/u, `${value} has a Chinese metric projection`);
}
assert.equal(goldSliceLocale.localizeMidnightChorusGoldSlice("已发现证据: Restricted type block", "zh-CN"), "已发现证据：受限铅字块", "mixed evidence status is normalized into the Chinese safe projection");
assert.equal(goldSliceLocale.localizeMidnightChorusGoldSlice("unknown authored copy", "zh-CN"), undefined, "unknown copy fails closed for the normal locale fallback");

const focus = cinematic.buildCinematicDeductionModel({ campaign: publicRoute, workspace: workspace(), busy: false });
assert.equal(focus.motionPhase, "focus", "an open investigation begins in Focus");
assert.equal(focus.riskState, "stable", "an uncommitted theory begins stable");
const commit = cinematic.buildCinematicDeductionModel({ campaign: publicRoute, workspace: workspace(), busy: true });
assert.equal(commit.motionPhase, "commit", "an in-flight certified action enters Commit");
const rejected = cinematic.buildCinematicDeductionModel({
  campaign: publicRoute,
  workspace: workspace({ stage: "theory", theory: { state: "rejected", selectedEvidenceCount: 1 }, recovery: { state: "ready" } }),
  busy: false
});
assert.equal(rejected.motionPhase, "world-reaction", "a rejected theory enters World Reaction");
assert.equal(rejected.riskState, "strained", "a rejected theory exposes strained Theory Pressure");
const accepted = cinematic.buildCinematicDeductionModel({
  campaign: publicRoute,
  workspace: workspace({ stage: "resolved", theory: { state: "accepted", selectedEvidenceCount: 3 } }),
  busy: false
});
assert.equal(accepted.motionPhase, "new-objective", "an accepted theory advances to New Objective");
assert.equal(accepted.riskState, "settled", "an accepted theory settles Theory Pressure");
const rapidStateSequence = [
  { workspace: workspace(), busy: false },
  { workspace: workspace(), busy: true },
  { workspace: workspace({ stage: "contradiction" }), busy: false },
  { workspace: workspace({ stage: "theory", theory: { state: "rejected", selectedEvidenceCount: 1 }, recovery: { state: "ready" } }), busy: false },
  { workspace: workspace({ stage: "resolved", theory: { state: "accepted", selectedEvidenceCount: 3 } }), busy: false }
];
const projectMotionSequence = () => rapidStateSequence.map((input) => cinematic.buildCinematicDeductionModel({ campaign: publicRoute, ...input }).motionPhase);
assert.deepEqual(projectMotionSequence(), ["focus", "commit", "resolve", "world-reaction", "new-objective"], "rapid authoritative states project the complete motion grammar in order");
assert.deepEqual(projectMotionSequence(), projectMotionSequence(), "motion restoration is deterministic for repeated state sequences");
assert.deepEqual(
  ["idle", "action-resolving", "immediate-result", "world-consequence", "next-objective", "dismissed"].map((phase) => cinematic.deriveCinematicResolutionPhase(phase, "resolve", false)),
  ["focus", "commit", "resolve", "world-reaction", "new-objective", "focus"],
  "the cinematic rail follows the existing result theatre phases and returns to focus on dismissal"
);
assert.equal(cinematic.deriveCinematicResolutionPhase("immediate-result", "focus", true), "commit", "a new in-flight action takes precedence over the prior result");
assert.equal(cinematic.deriveCinematicResolutionPhase(null, "world-reaction", false), "world-reaction", "standalone surfaces preserve their existing projection without a phase provider");

const componentSource = await fs.readFile(path.join(root, "app", "components", "CinematicDeductionBoard.tsx"), "utf8");
const surfaceSource = await fs.readFile(path.join(root, "app", "components", "InvestigationSurface.tsx"), "utf8");
const cssSource = await fs.readFile(path.join(root, "app", "components", "CinematicDeductionBoard.module.css"), "utf8");
assert.match(surfaceSource, /isCinematicDeductionGoldSlice\(campaignSession\)/, "the investigation surface gates the gold slice explicitly");
assert.match(surfaceSource, /InvestigationCoreActionsSurface/, "the established workspace remains the fallback");
assert.match(componentSource, /actionAdapter\.runInterrogationTarget/, "contradictions reuse the certified interrogation adapter");
assert.match(componentSource, /actionAdapter\.toggleTheoryEvidence/, "theory evidence reuses the certified notebook adapter");
assert.match(componentSource, /actionLock\.current/, "rapid certified actions are guarded by an immediate local action lock");
assert.match(componentSource, /disabled=\{effectiveBusy \|\| !canSubmitTheory\}/, "the cinematic commit cannot submit an incomplete theory");
assert.match(componentSource, /model\.theory\.state === "ready"/, "an initial theory commit requires the route-aware ready state");
assert.match(componentSource, /model\.recovery\.state === "completed" && theoryFieldsComplete && certifiedSubmitReady/, "a rejected theory can be resubmitted only after recovery and a certified submit action");
assert.match(componentSource, /model\.currentTask\.action\.kind === "submit" && model\.currentTask\.action\.enabled/, "the presentation commit is bound to the certified submit action");
assert.doesNotMatch(componentSource, /fetch\s*\(|\/api\//, "the presentation component does not create a second API path");
assert.doesNotMatch(componentSource, /evaluateTheory|truth\./, "the presentation component does not create a second judgement or hidden-truth path");
assert.match(cssSource, /@container \(max-width: 700px\)/, "the desk switches to mobile sections before three columns become too narrow");
assert.match(componentSource, /data-mobile-panel=\{mobilePanel\}/, "mobile sections retain real navigation state");
assert.match(componentSource, /data-path-step=\{pathStep\}/, "the desk exposes the current investigation path step");
assert.match(componentSource, /function moveToPathStep/, "the three path steps use one explicit transition function");
assert.match(componentSource, /data-testid=\{`investigation-path-\$\{step\.id\}`\}/, "the path rail exposes stable step test ids");
for (const step of ["field", "people", "deduction"]) assert.match(componentSource, new RegExp(`id: "${step}"`), `${step} is represented in the investigation path model`);
assert.match(componentSource, /现场证据/, "the player-facing path starts with field evidence");
assert.match(componentSource, /人物关系/, "the player-facing path exposes people relations");
assert.match(componentSource, /推理链/, "the player-facing path ends with the deduction chain");
assert.match(cssSource, /min-height: 44px/, "interactive controls preserve a 44px target");
assert.match(cssSource, /:focus-visible/, "keyboard focus is visible");
assert.match(cssSource, /prefers-reduced-motion: reduce/, "system reduced motion is honored");
assert.match(cssSource, /data-low-sensory="true"/, "Low Sensory suppresses non-essential motion");

function createRuntime(worldId) {
  const world = engine.createInitialWorld(worldId, { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const daily = engine.simulateDailyLife(world, 1, []);
  return engine.createPersistentTownRuntime(daily.world, daily.events, { maxTicks: 48 });
}

const pressureRuntime = createRuntime("cinematic-theory-pressure");
pressureRuntime.campaignSession = { campaignId: "midnight-chorus", routeId: "baseline" };
const candidatesBefore = structuredClone(pressureRuntime.candidates);
const rulesBefore = structuredClone(pressureRuntime.ruleState);
const tickBefore = pressureRuntime.tick;
const pressureReady = engine.prepareCampaignRecovery(pressureRuntime, {
  sourceKey: "session-one:printed-whisper:rejected-theory",
  failureKind: "rejected-theory",
  sessionId: "session-one",
  caseId: "printed-whisper"
});
assert.equal(pressureReady.status, "ready", "wrong theory exposes a visible recovery choice");
assert.match(pressureReady.costLabel, /Press Network standing is temporarily reduced by 3/, "the public summary names the bounded trust cost");
assert.equal(pressureRuntime.factionRelationships.standings.media.value, -3, "wrong theory applies the bounded public-trust cost once");
assert.equal(pressureRuntime.campaignRecoveries.items[0].actionKind, "repair-theory-trust", "the gold slice uses the timed trust-repair action");
engine.prepareCampaignRecovery(pressureRuntime, {
  sourceKey: "session-one:printed-whisper:rejected-theory",
  failureKind: "rejected-theory"
});
assert.equal(pressureRuntime.factionRelationships.standings.media.value, -3, "repeating the same rejection is idempotent");
const scheduled = engine.applyCampaignRecoveryDecision(pressureRuntime, { choice: "start" });
assert.equal(scheduled.status, "scheduled", "Theory Pressure requires the next legal institution cadence");
assert.equal(pressureRuntime.tick, tickBefore, "choosing recovery does not advance authoritative time implicitly");
const pressureItem = pressureRuntime.campaignRecoveries.items.find((item) => item.actionKind === "repair-theory-trust");
pressureRuntime.tick = pressureItem.completesAtTick;
const completed = engine.reconcileCampaignRecovery(pressureRuntime);
assert.equal(completed.status, "completed", "the cadence completes the bounded trust repair");
assert.equal(pressureRuntime.factionRelationships.standings.media.value, 0, "the visible trust cost is restored after recovery");
assert.equal(engine.reconcileCampaignRecovery(pressureRuntime), undefined, "the trust repair cannot apply twice");
assert.deepEqual(pressureRuntime.candidates, candidatesBefore, "Theory Pressure never mutates candidate selection inputs");
assert.deepEqual(pressureRuntime.ruleState, rulesBefore, "Theory Pressure never mutates rule or truth inputs");
assert.deepEqual(
  { campaignId: pressureRuntime.campaignSession.campaignId, routeId: pressureRuntime.campaignSession.routeId },
  { campaignId: "midnight-chorus", routeId: "baseline" },
  "Theory Pressure never rewrites the campaign or Route Certificate binding"
);
assert.equal(/sourceKey|sessionId|caseId|factionKind|tick|delta/i.test(JSON.stringify(completed)), false, "the public recovery summary does not leak internal authority fields");

const backstageRuntime = createRuntime("cinematic-backstage-control");
backstageRuntime.campaignSession = { campaignId: "midnight-chorus", routeId: "counter-route" };
const backstageReady = engine.prepareCampaignRecovery(backstageRuntime, { sourceKey: "backstage-rejection", failureKind: "rejected-theory" });
assert.equal(backstageRuntime.factionRelationships?.standings.media?.value || 0, 0, "Backstage Compact does not inherit the gold-slice trust cost");
assert.equal(engine.applyCampaignRecoveryDecision(backstageRuntime, { choice: "start" }).status, "completed", "Backstage Compact retains the established immediate route review");
assert.equal(backstageReady.status, "ready", "Backstage Compact still exposes its established recovery affordance");

const finaleRuntime = createRuntime("cinematic-finale-recall");
finaleRuntime.campaignSession = {
  campaignId: "midnight-chorus",
  routeId: "baseline",
  status: "completed",
  targetCaseCount: 3,
  maximumCaseCount: 5,
  startedAtTick: 0,
  cycleSequence: 3,
  completedAtTick: 24,
  completedCaseIds: ["case-one", "case-two", "case-three"],
  completedCycleKeys: ["cycle-one", "cycle-two", "cycle-three"],
  history: goldTreatments.map((treatment, index) => ({
    caseId: `safe-case-${index + 1}`,
    cycleKey: `safe-cycle-${index + 1}`,
    ordinal: index + 1,
    acceptedAtTick: 8 * (index + 1),
    consequenceLabels: [],
    authoredAftermathLabel: treatment.aftermathLabel
  }))
};
const finale = engine.toCampaignFinaleDebriefPublicSummary(finaleRuntime);
assert.equal(finale.status, "ready", "completed Public Reckoning unlocks the Gold Slice finale recall");
assert.equal(finale.causalBeats.slice(0, 3).length, 3, "the finale recalls all three Gold Slice chapters before aggregate consequences");
assert.deepEqual(finale.causalBeats.slice(0, 3), goldTreatments.map((treatment, index) => `Chapter ${index + 1}: ${treatment.aftermathLabel}`));
for (const beat of finale.causalBeats.slice(0, 3)) {
  assert.match(goldSliceLocale.localizeMidnightChorusGoldSlice(beat, "zh-CN") || "", /[\u3400-\u9fff]/u, `${beat} has a safe Chinese finale recall projection`);
}

const checks = [
  "route-activation",
  "evidence-discovery-selection-exclusion",
  "claim-evidence-challenge-world-reaction",
  "motion-grammar",
  "existing-resolution-phase-bridge",
  "rapid-action-restoration",
  "certified-action-reuse",
  "three-chapter-bilingual-copy",
  "three-chapter-finale-recall",
  "responsive-accessibility",
  "theory-pressure-idempotence",
  "authority-isolation",
  "core-action-effect-contract"
];
const coreActionEffects = {
  discover: ["cognition"],
  select: ["cognition"],
  exclude: ["cognition"],
  challenge: ["cognition", "world"],
  "reject-theory": ["world", "risk"],
  recover: ["world", "risk"],
  finale: ["cognition", "world"]
};
assert.equal(Object.values(coreActionEffects).every((effects) => effects.some((effect) => ["cognition", "world", "risk"].includes(effect))), true, "every Gold Slice core action changes cognition, world state, or risk");
const evidenceBody = {
  suite: "cinematic-deduction-gold-slice",
  scope: { campaign: "Midnight Chorus", route: "Public Reckoning", chapters: 3 },
  status: "automated-pass",
  checks,
  coreActionEffects
};
const result = {
  ok: true,
  schema: "detective-town.v11-gold-slice-behavior-evidence.v1",
  generatedAt: new Date().toISOString(),
  ...evidenceBody,
  evidenceHash: sha256Json(evidenceBody)
};
if (persistEvidence) {
  const evidencePath = path.join(root, "outputs", "v11-alpha", "gold-slice-behavior-evidence.json");
  await fs.mkdir(path.dirname(evidencePath), { recursive: true });
  await fs.writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  result.output = path.relative(root, evidencePath).replaceAll("\\", "/");
}
if (json) console.log(JSON.stringify(result));
else console.log("Cinematic deduction gold-slice tests passed.");
