import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const outputDir = path.join(root, "outputs");
const outputFile = path.join(outputDir, "v82-district-strategic-front-model-test.mjs");
await fs.mkdir(outputDir, { recursive: true });
const compiled = ts.transpileModule(
  await fs.readFile(path.join(root, "app", "campaign", "district-strategic-front-model.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }
).outputText;
await fs.writeFile(outputFile, compiled, "utf8");
const { buildDistrictStrategicFrontsViewModel } = await import(`${pathToFileURL(outputFile).href}?test=${Date.now()}`);

const action = (kind, target, label, priority, enabled = true) => ({
  kind,
  target,
  label,
  detail: `${label} through an existing handler.`,
  benefitLabel: `${label} public benefit.`,
  costLabel: `${label} visible cost.`,
  priority,
  enabled,
  blocking: priority < 5,
  contextActionKind: target === "context-action" ? "search" : undefined,
  disabledReason: enabled ? undefined : "Existing prerequisite is not ready."
});

const investigationAction = action("certified-investigation", "context-action", "Search location", 2);
const institutionAction = action("faction-directive", "show-world-choice", "Choose public response", 4);
const pressureAction = action("campaign-recovery", "show-world-choice", "Review recovery", 3);
const disabledAdvance = action("advance-town", "advance-town", "Advance Town", 7, false);
const locationSignals = [
  {
    locationName: "Archive District",
    institutionTone: "high",
    institutionLabel: "Civic Records influence",
    pressureTone: "watch",
    pressureLabel: "Pressure under watch",
    reactionTone: "quiet",
    reactionLabel: "No current public reaction",
    evidenceTone: "high",
    evidenceLabel: "2/4 clues found"
  },
  {
    locationName: "Harbor District",
    institutionTone: "watch",
    institutionLabel: "Dock Union influence",
    pressureTone: "watch",
    pressureLabel: "Pressure under watch",
    reactionTone: "quiet",
    reactionLabel: "No current public reaction",
    evidenceTone: "high",
    evidenceLabel: "1/3 clues found"
  },
  {
    locationName: "Market District",
    institutionTone: "quiet",
    institutionLabel: "No leading institution",
    pressureTone: "watch",
    pressureLabel: "Pressure under watch",
    reactionTone: "high",
    reactionLabel: "Residents remain guarded",
    evidenceTone: "quiet",
    evidenceLabel: "No case clue here"
  }
];

const command = {
  runtimeMode: "server",
  primaryAction: investigationAction,
  secondaryActions: [pressureAction, institutionAction],
  decisionQueue: [investigationAction, pressureAction, institutionAction, disabledAdvance],
  currentObjective: { nextAction: "Continue the certified route." },
  mapLenses: {
    defaultLens: "evidence",
    controls: [
      { kind: "institution", label: "Institution", summary: "2 influenced places" },
      { kind: "pressure", label: "Pressure", summary: "2 pressure signals" },
      { kind: "reaction", label: "Reaction", summary: "1 public response" },
      { kind: "evidence", label: "Evidence", summary: "3/7 clues found" }
    ],
    locationSignals
  },
  worldConsequenceTimeline: {
    state: "active",
    currentKind: "directive",
    headline: "Faction Directive",
    summary: "A public institution response is ready.",
    nextAction: "Choose one existing response.",
    beats: []
  }
};

const before = structuredClone(command);
const first = buildDistrictStrategicFrontsViewModel(command);
const second = buildDistrictStrategicFrontsViewModel(structuredClone(command));
assert.deepEqual(first, second, "same public command produces identical strategic fronts");
assert.deepEqual(command, before, "front derivation does not mutate Strategic Command input");
assert.equal(first.status, "ready", "Server Runtime exposes ready fronts");
assert.deepEqual(first.fronts.map((front) => front.key), ["investigation", "institution", "pressure"], "front order is fixed and bounded");
assert.equal(first.fronts.length, 3, "front count is capped at three");
assert.equal(first.fronts.filter((front) => front.state === "current").length, 1, "exactly one front is current");
assert.equal(first.currentFrontKey, "investigation", "the existing primary action owns the current front");
assert.equal(first.fronts[0].districtLabel, "Archive District", "evidence tie-break is stable by public district label");
assert.equal(first.fronts[1].districtLabel, "Archive District", "institution front selects the strongest institution signal");
assert.equal(first.fronts[2].districtLabel, "Market District", "pressure front can select the stronger public reaction signal");
assert.equal(first.fronts[2].lens, "reaction", "pressure front switches to the stronger existing reaction lens");
assert.deepEqual(first.fronts.map((front) => front.action?.kind), ["certified-investigation", "faction-directive", "campaign-recovery"], "front actions reuse the matching existing decision queue entries");
assert.deepEqual(first.fronts[0].action, investigationAction, "safe upstream action dispatch fields remain equivalent");
assert.equal(first.fronts.some((front) => front.action?.kind === "advance-town"), false, "disabled actions cannot become executable front actions");
assert.match(first.boundary, /map focus only.*Existing handlers/i, "front model states its zero-authority boundary");

const staticFronts = buildDistrictStrategicFrontsViewModel({ ...structuredClone(command), runtimeMode: "static-demo" });
assert.equal(staticFronts.status, "readonly", "Static Runtime fronts are read-only");
assert.equal(staticFronts.fronts.every((front) => front.state === "readonly" && !front.action), true, "Static fronts expose no executable action");

const noSignals = buildDistrictStrategicFrontsViewModel({
  ...structuredClone(command),
  primaryAction: undefined,
  secondaryActions: [],
  decisionQueue: [],
  mapLenses: { ...command.mapLenses, locationSignals: [] },
  worldConsequenceTimeline: { ...command.worldConsequenceTimeline, state: "empty", currentKind: undefined }
});
assert.deepEqual(noSignals, { status: "empty", currentFrontKey: undefined, fronts: [], boundary: first.boundary }, "no safe signal or action produces no synthetic front");

const unsafe = structuredClone(command);
unsafe.decisionQueue[0] = {
  ...unsafe.decisionQueue[0],
  label: "Inspect case-123",
  detail: "Question npc-7 at location-9.",
  benefitLabel: "Use evidence-4.",
  costLabel: "Do not expose source-2."
};
unsafe.primaryAction = unsafe.decisionQueue[0];
unsafe.mapLenses.locationSignals[0].locationName = "npc-1";
const safeSerialized = JSON.stringify(buildDistrictStrategicFrontsViewModel(unsafe));
assert.equal(/\b(?:npc|case|event|source|location|institution|resource|evidence)-[a-z0-9-]*\d[a-z0-9-]*\b|culpritId|hiddenTruth|rawBody/i.test(safeSerialized), false, "front projection strips identifier-shaped values and hidden fields");

for (let index = 0; index < 64; index += 1) {
  const authority = {
    truth: { culpritId: `hidden-${index}` },
    evidenceCoverage: { covered: index % 7, total: 7 },
    routeCertificate: { certified: index % 3 !== 0 },
    judgement: { accepted: index % 5 === 0 },
    npcLegalActions: ["move", "work", "speak"]
  };
  const authorityBefore = structuredClone(authority);
  const sampled = structuredClone(command);
  sampled.primaryAction = index % 3 === 0 ? investigationAction : index % 3 === 1 ? institutionAction : pressureAction;
  sampled.decisionQueue = sampled.decisionQueue.map((item, actionIndex) => ({ ...item, enabled: actionIndex !== index % 4 }));
  const fronts = buildDistrictStrategicFrontsViewModel(sampled);
  assert.equal(fronts.fronts.length <= 3, true, `sample ${index} remains bounded`);
  assert.equal(fronts.fronts.filter((front) => front.state === "current").length <= 1, true, `sample ${index} has at most one current front`);
  assert.equal(fronts.fronts.every((front) => !front.action || front.action.enabled), true, `sample ${index} never promotes a disabled action`);
  assert.deepEqual(authority, authorityBefore, `sample ${index} leaves case authority byte-equivalent`);
}

console.log(JSON.stringify({
  ok: true,
  suite: "district-strategic-fronts",
  checks: [
    "determinism",
    "non-mutation",
    "fixed-three-front-cap",
    "single-current-front",
    "stable-district-tie-break",
    "existing-lens-reuse",
    "existing-action-equivalence",
    "disabled-action-isolation",
    "static-readonly-boundary",
    "public-safe-text",
    "64-sample-authority-isolation"
  ]
}));
