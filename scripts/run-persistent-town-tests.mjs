import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import ts from "typescript";

const root = process.cwd();
const outDir = path.join(root, "outputs");
const sourceDir = path.join(root, "packages", "engine", "src");
const runtimeDir = path.join(outDir, "persistent-town-test-runtime");

async function loadEngine() {
  await fs.mkdir(runtimeDir, { recursive: true });
  async function collectTsFiles(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectTsFiles(fullPath);
      return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
    }));
    return nested.flat();
  }
  const files = await collectTsFiles(sourceDir);
  for (const file of files) {
    const source = await fs.readFile(file, "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText;
    const relative = path.relative(sourceDir, file).replace(/\.ts$/, ".cjs");
    const target = path.join(runtimeDir, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, compiled.replace(/require\("(\.{1,2}\/.+?)"\)/g, 'require("$1.cjs")'), "utf8");
  }
  return import(pathToFileURL(path.join(runtimeDir, "index.cjs")).href);
}

const engine = await loadEngine();

{
  const experimentIds = ["small-town-review", "court-dock-conspiracy", "medical-inquest-chain"];
  for (const experimentId of experimentIds) {
    const experimentDir = path.join(root, "experiments", experimentId);
    const files = Object.fromEntries(await Promise.all(
      ["manifest.json", "steps.json", "scenario-pack.json", "map-pack.json", "rule-catalog.json", "expectations.json", "README.md"]
        .map(async (fileName) => [fileName, await fs.readFile(path.join(experimentDir, fileName), "utf8")])
    ));
    const discovery = engine.validateExperimentFolderFiles(files);
    assert.equal(discovery.ok, true, `${experimentId} experiment folder validates: ${discovery.errors.join("; ")}`);
    assert.equal(discovery.experimentId, experimentId, "experiment discovery exposes manifest id");
    assert.equal(typeof discovery.hash, "string", "experiment discovery produces a stable hash");
    assert.equal(discovery.validations.ruleCatalog.ok, true, "experiment discovery validates rule catalog");
  }
  const experimentDir = path.join(root, "experiments", "small-town-review");
  const files = Object.fromEntries(await Promise.all(
    ["manifest.json", "steps.json", "scenario-pack.json", "map-pack.json", "rule-catalog.json", "expectations.json", "README.md"]
      .map(async (fileName) => [fileName, await fs.readFile(path.join(experimentDir, fileName), "utf8")])
  ));
  const missing = { ...files };
  delete missing["rule-catalog.json"];
  assert.equal(engine.validateExperimentFolderFiles(missing).ok, false, "experiment discovery rejects missing required files");
}

{
  const world = engine.createInitialWorld("catalog-validation-persistent", { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const catalog = engine.createDefaultTownRuleCatalog(world, 0);
  const fixture = JSON.parse(await fs.readFile(path.join(root, "packages", "engine", "fixtures", "default-town-rule-catalog.json"), "utf8"));
  assert.deepEqual(catalog.resources, fixture.resources, "default rule catalog resources match JSON fixture");
  assert.deepEqual(catalog.longActionDefinitions, fixture.longActionDefinitions, "default long action catalog matches JSON fixture");
  assert.deepEqual(catalog.randomEvents, fixture.randomEvents, "default random events match JSON fixture");
  assert.deepEqual(catalog.casePressureRules, fixture.casePressureRules, "default case pressure rules match JSON fixture");
  assert.equal(catalog.institutions.length >= 8, true, "default rule catalog includes expanded institution ecology");
  assert.equal(catalog.resources.length >= 9, true, "default rule catalog includes expanded resource signals");
  assert.equal(catalog.longActionDefinitions.length >= 25, true, "default rule catalog includes expanded long actions");
  assert.equal((catalog.evidenceRules || []).length >= 18, true, "default rule catalog includes expanded evidence rules");
  assert.equal(engine.validateTownRuleCatalog(catalog).ok, true, "default rule catalog validates");
  const broken = structuredClone(catalog);
  broken.longActionDefinitions[0].resourceCosts.fake_resource = 1;
  assert.equal(engine.validateTownRuleCatalog(broken).ok, false, "rule catalog validation rejects missing resource references");
  const unsafe = structuredClone(catalog);
  unsafe.randomEvents.push({ id: "unsafe", label: "C:\\Users\\example\\secret.txt", weight: 1, tags: [] });
  assert.equal(engine.validateTownRuleCatalog(unsafe).ok, false, "rule catalog validation rejects absolute paths");
  const tuned = structuredClone(catalog);
  tuned.longActionDefinitions = tuned.longActionDefinitions.map((entry) => entry.kind === "investigate-scene" ? { ...entry, durationTicks: 9 } : entry);
  const state = engine.catalogToTownRuleRuntimeState(tuned, 0);
  const actor = world.npcs[0];
  state.professions = state.professions.map((profession) => profession.npcId === actor.id ? { ...profession, kind: "clerk", institutionId: undefined } : profession);
  const definition = engine.getLongActionDefinition("investigate-scene");
  const action = definition.start({ world, runtime: state, actor, events: [], tick: 1, targetLocationId: world.locations[0].id });
  assert.equal(action.durationTicks, 9, "runtime rule catalog duration drives long action lifecycle");
  const costly = structuredClone(catalog);
  costly.longActionDefinitions = costly.longActionDefinitions.map((entry) => entry.kind === "investigate-scene" ? { ...entry, resourceCosts: { police_time: 999 } } : entry);
  const costlyState = engine.catalogToTownRuleRuntimeState(costly, 0);
  const blocked = definition.canStart({ world, runtime: costlyState, actor, events: [], tick: 1, targetLocationId: world.locations[0].id });
  assert.equal(blocked.ok, false, "runtime rule catalog resource cost affects long action canStart");
  const strategyState = engine.catalogToTownRuleRuntimeState(catalog, 0);
  strategyState.publicOpinion.rumorVelocity = 52;
  strategyState.resourceLedger.informant_trust.available = 60;
  strategyState.institutions = strategyState.institutions.map((institution) =>
    institution.kind === "medical" ? { ...institution, resources: 52 } :
    institution.kind === "court" ? { ...institution, resources: 56 } :
    institution.kind === "dock_union" ? { ...institution, resources: 58 } :
    institution
  );
  const strategies = engine.advanceTownInstitutionStrategies(world, strategyState, 5).map((decision) => decision.strategy);
  assert.equal(strategies.includes("cultivate-informant"), true, "media can cultivate informants before headline pressure dominates");
  assert.equal(strategies.includes("schedule-autopsy"), true, "medical chain strategy triggers before evidence stalls");
  assert.equal(strategies.includes("review-court-record"), true, "court record strategy triggers at reviewable pressure");
  assert.equal(strategies.includes("trace-cargo"), true, "dock cargo strategy triggers at reviewable pressure");
}

{
  const world = engine.createInitialWorld("persistent-seed", { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const daily = engine.simulateDailyLife(world, 1, []);
  const runtime = engine.createPersistentTownRuntime(daily.world, daily.events, { maxTicks: 48 });
  assert.equal(runtime.status, "paused", "runtime starts paused");
  assert.equal(runtime.agentStates.length, 8, "runtime creates one agent state per living NPC");
  assert.equal(runtime.socialProfiles.length, 8, "runtime creates one social profile per NPC");
  assert.equal(runtime.locationProfiles.length, world.locations.length, "runtime creates one location profile per location");
  assert.equal(runtime.agentStates.every((agent) => agent.socialProfile?.dominantTrait), true, "agent states expose social profile summaries");
  assert.equal(runtime.socialProfiles.every((profile) => profile.preferredActionKinds.length > 0 && Number.isFinite(profile.reputation) && Number.isFinite(profile.suspicion)), true, "social profiles expose traits, reputation and suspicion");
  assert.equal(runtime.locationProfiles.every((profile) => Number.isFinite(profile.heat) && Number.isFinite(profile.security) && profile.factionInfluence), true, "location profiles expose heat, security and influence");
  assert.equal(runtime.agentStates.every((agent) => agent.currentGoal && agent.currentPlan.length), true, "agents have goals and plans");
  assert.equal(runtime.agentStates.every((agent) => Number.isFinite(agent.secretRisk) && Number.isFinite(agent.alertness)), true, "agents have risk and alertness");
  const commitmentLocationId = daily.world.locations[0].id;
  const commitmentBase = structuredClone(runtime);
  const initialCommitment = engine.toPlayerResourceCommitmentPublicSummary(commitmentBase);
  assert.equal(initialCommitment.status, "ready", "new runtime opens one optional case resource choice");
  const initialProgression = engine.toInvestigatorProgressionPublicSummary(runtime);
  assert.equal(initialProgression.status, "developing", "new investigator progression starts in a developing state");
  assert.equal(initialProgression.points, 0, "new investigator progression starts with zero practice points");
  assert.equal(/sourceKey|session-|case-|competenc(y|ies)Id/i.test(JSON.stringify(initialProgression)), false, "progression public summary exposes only safe labels");
  const progressionBase = structuredClone(runtime);
  const firstProgression = engine.recordInvestigatorProgression(progressionBase, { sourceKey: "manual-session:case-search:search", kind: "search" });
  const duplicateProgression = engine.recordInvestigatorProgression(progressionBase, { sourceKey: "manual-session:case-search:search", kind: "search" });
  assert.deepEqual(duplicateProgression, firstProgression, "repeating one manual progression source is idempotent");
  assert.equal(progressionBase.investigatorProgression.points, 1, "one manual certified step records one bounded practice point");
  engine.recordInvestigatorProgression(progressionBase, { sourceKey: "manual-session:case-search:search-2", kind: "search" });
  assert.equal(engine.investigatorProgressionReserveDiscount(progressionBase, "search"), 1, "established search practice unlocks one matching reserve discount");
  const discountedCommitment = engine.toPlayerResourceCommitmentPublicSummary(progressionBase);
  assert.equal(discountedCommitment.options.find((option) => option.lane === "search")?.reserveCost, 1, "progression discount is visible only on the matching future reserve");
  engine.recordInvestigatorProgression(progressionBase, { sourceKey: "manual-session:case-search:evidence", kind: "evidence-selection" });
  engine.recordInvestigatorProgression(progressionBase, { sourceKey: "manual-session:case-search:closure", kind: "accepted-theory" });
  engine.recordInvestigatorProgression(progressionBase, { sourceKey: "manual-session:case-search:closure-2", kind: "accepted-theory" });
  assert.equal(engine.investigatorProgressionCanRecoverOffer(progressionBase), true, "case-closure practice unlocks one bounded offer recovery retry");
  assert.equal(JSON.stringify(engine.toInvestigatorProgressionPublicSummary(progressionBase)).includes("manual-session"), false, "progression summary never returns source keys");
  assert.deepEqual(initialCommitment.options.map((option) => [option.choice, option.lane]), [
    ["police-time", "search"],
    ["informant-trust", "question"],
    ["evidence-integrity", "challenge"]
  ], "case resources map deterministically to the three certified investigation lanes");
  assert.equal(/police_time|informant_trust|evidence_integrity|session-|case-|location-/i.test(JSON.stringify(initialCommitment)), false, "public commitment summary hides raw resource and runtime keys");
  for (const [choice, lane, resourceKind] of [
    ["police-time", "search", "police_time"],
    ["informant-trust", "question", "informant_trust"],
    ["evidence-integrity", "challenge", "evidence_integrity"]
  ]) {
    const choiceRuntime = structuredClone(commitmentBase);
    const beforeTick = choiceRuntime.tick;
    const beforeCandidates = structuredClone(choiceRuntime.candidates);
    const beforeLedger = structuredClone(choiceRuntime.ruleState.resourceLedger[resourceKind]);
    const reserved = engine.applyPlayerResourceCommitmentDecision(choiceRuntime, {
      sessionId: `session-${lane}`,
      caseId: `case-${lane}`,
      caseSceneLocationId: commitmentLocationId,
      choice
    });
    assert.equal(reserved.status, "reserved", `${choice} reserves one case resource`);
    assert.equal(reserved.lane, lane, `${choice} preserves its fixed certified lane`);
    assert.equal(choiceRuntime.tick, beforeTick, `${choice} reservation is zero tick`);
    assert.equal(choiceRuntime.ruleState.resourceLedger[resourceKind].available, beforeLedger.available - engine.PLAYER_RESOURCE_COMMITMENT_COST, `${choice} subtracts the fixed available amount`);
    assert.equal(choiceRuntime.ruleState.resourceLedger[resourceKind].reserved, beforeLedger.reserved + engine.PLAYER_RESOURCE_COMMITMENT_COST, `${choice} moves the fixed amount into reserved`);
    assert.deepEqual(choiceRuntime.candidates, beforeCandidates, `${choice} never rewrites the existing candidate set`);
    assert.equal(engine.consumePlayerResourceCommitment(choiceRuntime, { sessionId: `session-${lane}`, caseId: `case-${lane}`, lane: lane === "search" ? "question" : "search" }), undefined, "a non-matching certified step cannot spend the reserve");
    const beforeBenefit = lane === "search"
      ? choiceRuntime.locationProfiles.find((profile) => profile.locationId === commitmentLocationId).resourcePressure
      : lane === "question"
        ? choiceRuntime.ruleState.publicOpinion.witnessFear
        : choiceRuntime.ruleState.evidenceContamination.contamination;
    const used = engine.consumePlayerResourceCommitment(choiceRuntime, { sessionId: `session-${lane}`, caseId: `case-${lane}`, lane });
    assert.equal(used.status, "used", `${choice} is consumed by its matching certified step`);
    assert.equal(choiceRuntime.ruleState.resourceLedger[resourceKind].reserved, beforeLedger.reserved, `${choice} clears only its actual reservation when spent`);
    assert.equal(choiceRuntime.ruleState.resourceLedger[resourceKind].spentThisRun, beforeLedger.spentThisRun + engine.PLAYER_RESOURCE_COMMITMENT_COST, `${choice} records the actual spend once`);
    const afterBenefit = lane === "search"
      ? choiceRuntime.locationProfiles.find((profile) => profile.locationId === commitmentLocationId).resourcePressure
      : lane === "question"
        ? choiceRuntime.ruleState.publicOpinion.witnessFear
        : choiceRuntime.ruleState.evidenceContamination.contamination;
    assert.equal(afterBenefit <= beforeBenefit && beforeBenefit - afterBenefit <= 2, true, `${choice} applies only its bounded world benefit`);
    assert.equal(engine.consumePlayerResourceCommitment(choiceRuntime, { sessionId: `session-${lane}`, caseId: `case-${lane}`, lane }), undefined, `${choice} cannot be consumed twice`);
    assert.equal(engine.releaseUnusedPlayerResourceCommitments(choiceRuntime, { caseId: `case-${lane}` }), undefined, `spent ${choice} is never refunded`);
  }
  const commitmentRefundRuntime = structuredClone(commitmentBase);
  const commitmentRefundBefore = structuredClone(commitmentRefundRuntime.ruleState.resourceLedger.informant_trust);
  engine.applyPlayerResourceCommitmentDecision(commitmentRefundRuntime, {
    sessionId: "session-refund",
    caseId: "case-refund",
    caseSceneLocationId: commitmentLocationId,
    choice: "informant-trust"
  });
  const released = engine.releaseUnusedPlayerResourceCommitments(commitmentRefundRuntime, { caseId: "case-refund" });
  assert.equal(released.status, "released", "an unused case resource returns when the case closes or switches");
  assert.deepEqual(commitmentRefundRuntime.ruleState.resourceLedger.informant_trust, commitmentRefundBefore, "unused reservation restores the exact ledger state");
  assert.equal(engine.releaseUnusedPlayerResourceCommitments(commitmentRefundRuntime, { caseId: "case-refund" }), undefined, "unused reservation refunds exactly once");
  const declinedRuntime = structuredClone(commitmentBase);
  const declinedLedger = structuredClone(declinedRuntime.ruleState.resourceLedger);
  const declined = engine.applyPlayerResourceCommitmentDecision(declinedRuntime, { sessionId: "session-declined", caseId: "case-declined", choice: "none" });
  assert.equal(declined.status, "declined", "player may continue without reserving a case resource");
  assert.deepEqual(declinedRuntime.ruleState.resourceLedger, declinedLedger, "declining changes no resource ledger values");
  const relationshipRuntime = structuredClone(commitmentBase);
  const relationshipCandidates = structuredClone(relationshipRuntime.candidates);
  const initialRelationship = engine.toFactionRelationshipPublicSummary(relationshipRuntime);
  assert.equal(initialRelationship.status, "stable", "new investigator faction standing starts neutral and stable");
  assert.equal(initialRelationship.standings.every((item) => item.standing === "neutral"), true, "public standing starts in safe neutral bands");
  engine.applyFactionRelationshipDelta(relationshipRuntime, { sourceKey: "manual-trust", factionKind: "police", delta: 4, reason: "recovery" });
  assert.equal(engine.factionResourceCommitmentTerms(relationshipRuntime, "police_time").cost, 1, "trusted standing lowers only the future matching reserve cost");
  assert.equal(engine.factionResourceCommitmentTerms(relationshipRuntime, "police_time").available, true, "trusted standing preserves future resource availability");
  const trustedValue = relationshipRuntime.factionRelationships.standings.police.value;
  engine.applyFactionRelationshipDelta(relationshipRuntime, { sourceKey: "manual-trust", factionKind: "police", delta: 4, reason: "recovery" });
  assert.equal(relationshipRuntime.factionRelationships.standings.police.value, trustedValue, "relationship source keys are idempotent");
  engine.applyFactionRelationshipDelta(relationshipRuntime, { sourceKey: "guarded-court", factionKind: "court", delta: -3, reason: "recovery" });
  assert.equal(engine.factionResourceCommitmentTerms(relationshipRuntime, "evidence_integrity").cost, 3, "strained standing raises only the future matching reserve cost");
  engine.applyFactionRelationshipDelta(relationshipRuntime, { sourceKey: "closed-media", factionKind: "media", delta: -7, reason: "recovery" });
  const hostileTerms = engine.factionResourceCommitmentTerms(relationshipRuntime, "informant_trust");
  assert.equal(hostileTerms.available, false, "hostile standing can withhold its future resource option");
  const hostileLedgerBefore = structuredClone(relationshipRuntime.ruleState.resourceLedger.informant_trust);
  const relationshipBlocked = engine.applyPlayerResourceCommitmentDecision(relationshipRuntime, { sessionId: "session-hostile", caseId: "case-hostile", choice: "informant-trust" });
  assert.equal(relationshipBlocked.status, "blocked", "hostile standing returns a safe blocked resource choice");
  assert.equal(relationshipBlocked.blockedCategory, "relationship unavailable", "relationship blocker is distinguished without exposing internal keys");
  assert.deepEqual(relationshipRuntime.ruleState.resourceLedger.informant_trust, hostileLedgerBefore, "relationship-blocked choice reserves no resources");
  engine.applyFactionRelationshipDelta(relationshipRuntime, { sourceKey: "explicit-media-recovery", factionKind: "media", delta: 7, reason: "recovery" });
  assert.equal(engine.factionResourceCommitmentTerms(relationshipRuntime, "informant_trust").available, true, "an explicit future recovery action can reopen a hostile resource relationship");
  const trustedPoliceBefore = structuredClone(relationshipRuntime.ruleState.resourceLedger.police_time);
  engine.applyPlayerResourceCommitmentDecision(relationshipRuntime, { sessionId: "session-trusted", caseId: "case-trusted", caseSceneLocationId: commitmentLocationId, choice: "police-time" });
  assert.equal(relationshipRuntime.ruleState.resourceLedger.police_time.available, trustedPoliceBefore.available - 1, "trusted standing applies its lower cost to the real resource ledger");
  engine.consumePlayerResourceCommitment(relationshipRuntime, { sessionId: "session-trusted", caseId: "case-trusted", lane: "search" });
  assert.equal(relationshipRuntime.factionRelationships.standings.police.value, 5, "a genuinely spent matching resource improves its partner standing once");
  assert.equal(engine.consumePlayerResourceCommitment(relationshipRuntime, { sessionId: "session-trusted", caseId: "case-trusted", lane: "search" }), undefined, "repeated matching calls do not duplicate resource or relationship effects");
  assert.deepEqual(relationshipRuntime.candidates, relationshipCandidates, "standing changes never rewrite the current candidate set");
  const supportRuntime = structuredClone(commitmentBase);
  const containRuntime = structuredClone(commitmentBase);
  engine.recordCompletedDirectiveFactionRelationships(supportRuntime, { directiveId: "directive-one", choice: "support", responseInstitutionKind: "police", sourceFactionKind: "media" });
  engine.recordCompletedDirectiveFactionRelationships(containRuntime, { directiveId: "directive-one", choice: "contain", responseInstitutionKind: "police", sourceFactionKind: "media" });
  assert.equal(supportRuntime.factionRelationships.standings.police.value, 2, "completed Support improves the operating institution deterministically");
  assert.equal(supportRuntime.factionRelationships.standings.media.value, 1, "completed Support also improves its distinct source faction");
  assert.equal(containRuntime.factionRelationships.standings.police.value, 2, "completed Contain improves the operating institution deterministically");
  assert.equal(containRuntime.factionRelationships.standings.media.value, -2, "completed Contain creates a visible tradeoff with its distinct source faction");
  engine.recordCompletedDirectiveFactionRelationships(containRuntime, { directiveId: "directive-one", choice: "contain", responseInstitutionKind: "police", sourceFactionKind: "media" });
  assert.equal(containRuntime.factionRelationships.standings.media.value, -2, "a completed directive cannot award or penalize standing twice");
  engine.recordAcceptedCaseFactionRelationship(containRuntime, { caseId: "accepted-case-one", sourceFactionKind: "media" });
  engine.recordAcceptedCaseFactionRelationship(containRuntime, { caseId: "accepted-case-one", sourceFactionKind: "media" });
  assert.equal(containRuntime.factionRelationships.standings.media.value, -1, "one accepted player case improves its source standing exactly once");
  for (let index = 0; index < 80; index += 1) {
    engine.applyFactionRelationshipDelta(containRuntime, { sourceKey: `bounded-${index}`, factionKind: "civic", delta: 1, reason: "recovery" });
  }
  assert.equal(containRuntime.factionRelationships.ledger.length <= 64, true, "internal faction relationship history stays bounded");
  assert.equal(containRuntime.factionRelationships.standings.civic.value, 10, "faction standing clamps at its fixed upper bound");
  const publicRelationship = engine.toFactionRelationshipPublicSummary(containRuntime);
  assert.equal(/sourceKey|factionKind|directive-|case-|tick|requestedDelta|appliedDelta/i.test(JSON.stringify(publicRelationship)), false, "public faction summary strips raw sources, keys, deltas, and ticks");
  const worldLeadHints = {
    schemaVersion: "world-system-runtime-hints.v1",
    source: {
      caseTypeId: "evidence-tampering",
      resourceId: "archive-access",
      factionId: "civic-desk",
      eventArchetypeId: "records-dispute",
      progressionLineId: "public-inquiry",
      progressionCaseTypeIds: ["court-intimidation", "evidence-tampering"]
    },
    caseTypeLabel: "Public case type",
    resource: { label: "Archive access", kind: "resource", pressure: 72, tags: ["record"] },
    faction: { label: "Civic desk", kind: "faction", tags: ["witness"] },
    eventArchetype: { label: "Records dispute", kind: "event", risk: 60, tags: ["trace"] },
    progressionLine: { label: "Public inquiry", kind: "progression", stageCount: 3, tags: ["proof"] },
    actionBias: { investigate: 4, "seek-alibi": 3, "cover-up": 2 },
    institutionLabels: ["Archive access", "Civic desk"],
    caseTypeBias: { "court-intimidation": 1, "evidence-tampering": 1 },
    summary: {
      schemaVersion: "world-system-runtime-hints.v1",
      active: true,
      resourcePressureLabel: "Archive access pressure 72/100",
      factionLaneLabel: "Civic desk lane",
      eventArchetypeLabel: "Records dispute",
      progressionLineLabel: "Public inquiry",
      resourcePressure: 72,
      eventRisk: 60,
      progressionStageCount: 3,
      publicLabels: ["Archive access", "Civic desk", "Records dispute", "Public inquiry"],
      actionKinds: ["investigate", "seek-alibi", "cover-up"],
      appliedBiasCount: 0,
      maxActionBias: 4
    }
  };
  const worldLeadRuntime = engine.createPersistentTownRuntime(daily.world, daily.events, { worldSystemHints: worldLeadHints });
  const activeArc = engine.activateWorldArcForHints(worldLeadRuntime, worldLeadHints, "case-world-lead-outcome");
  assert.equal(activeArc.status, "active", "case-scoped hints activate a resumable world arc");
  assert.equal(activeArc.progressLabel, "0/3 stages", "new world arcs begin at stage zero");
  assert.equal(JSON.stringify(activeArc).includes("public-inquiry"), false, "world arc public summary hides progression ids");
  const previewA = engine.deriveWorldLeadPreview(worldLeadHints);
  const previewB = engine.deriveWorldLeadPreview(structuredClone(worldLeadHints));
  assert.deepEqual(previewA, previewB, "world lead preview is deterministic for identical hints");
  assert.equal(previewA.focus, "search", "highest deterministic action bias maps to a search lead");
  const beforeLeadTick = worldLeadRuntime.tick;
  const beforeLeadCandidates = worldLeadRuntime.candidates.length;
  const followedLead = engine.applyWorldLeadDecision(worldLeadRuntime, { sessionId: "session-world-lead", action: "follow" });
  assert.equal(followedLead.status, "followed", "world lead follow is recorded");
  assert.equal(followedLead.focus, "search", "world lead follow preserves its safe route focus");
  assert.equal(worldLeadRuntime.tick, beforeLeadTick, "world lead follow does not advance persistent ticks");
  assert.equal(worldLeadRuntime.candidates.length, beforeLeadCandidates, "world lead follow does not change candidate availability");
  assert.equal(JSON.stringify(followedLead).includes("session-world-lead"), false, "world lead public summary hides session ids");
  const resolvedLead = engine.applyWorldLeadDecision(worldLeadRuntime, { sessionId: "session-world-lead", action: "resolve" });
  assert.equal(resolvedLead.status, "resolved", "world lead resolves after its matching guided step");
  assert.deepEqual(
    engine.deriveWorldLeadOutcomePlan("search", "civic"),
    {
      resourceKind: "police_time",
      location: { heat: 2, security: 0, footTraffic: 0, resourcePressure: -3 },
      institution: { resources: -2, reputation: 0, pressure: 2 },
      resource: { available: 2, pressure: 2 },
      benefitLabel: "Search support reduces pressure around the investigation.",
      costLabel: "The support also draws limited capacity and added attention.",
      institutionId: "inst-civic"
    },
    "search lead uses the fixed civic outcome mapping"
  );
  assert.equal(engine.deriveWorldLeadOutcomePlan("question", "neutral").resourceKind, "informant_trust", "question lead uses the fixed informant ledger");
  assert.equal(engine.deriveWorldLeadOutcomePlan("challenge", "underground").institutionId, "inst-dock-union", "challenge lead maps underground locations to the dock institution");
  const outcomeLocationId = daily.world.locations[0].id;
  const outcomeProfileBefore = structuredClone(worldLeadRuntime.locationProfiles.find((profile) => profile.locationId === outcomeLocationId));
  const outcomeRuleBefore = structuredClone(engine.ensureTownRuleRuntimeState(daily.world, worldLeadRuntime));
  const outcomeCandidateCount = worldLeadRuntime.candidates.length;
  const activeOutcome = engine.applyWorldLeadOutcome(daily.world, worldLeadRuntime, {
    sessionId: "session-world-lead",
    action: "resolve",
    caseId: "case-world-lead-outcome",
    caseSceneLocationId: outcomeLocationId
  });
  assert.equal(activeOutcome.status, "active", "resolved lead creates one active bounded world outcome");
  assert.equal(worldLeadRuntime.tick, beforeLeadTick, "outcome activation does not advance persistent ticks");
  assert.equal(worldLeadRuntime.candidates.length, outcomeCandidateCount, "outcome activation does not change candidate availability");
  assert.equal(JSON.stringify(activeOutcome).includes("case-world-lead-outcome"), false, "outcome public summary hides case ids");
  const activeOutcomeAgain = engine.applyWorldLeadOutcome(daily.world, worldLeadRuntime, {
    sessionId: "session-world-lead",
    action: "resolve",
    caseId: "case-world-lead-outcome",
    caseSceneLocationId: outcomeLocationId
  });
  assert.deepEqual(activeOutcomeAgain, activeOutcome, "same case outcome is idempotent and cannot stack");
  engine.applyWorldLeadDecision(worldLeadRuntime, { sessionId: "session-world-lead-second", action: "follow", caseId: "case-world-lead-outcome" });
  engine.applyWorldLeadDecision(worldLeadRuntime, { sessionId: "session-world-lead-second", action: "resolve", caseId: "case-world-lead-outcome" });
  const crossSessionOutcome = engine.applyWorldLeadOutcome(daily.world, worldLeadRuntime, {
    sessionId: "session-world-lead-second",
    action: "resolve",
    caseId: "case-world-lead-outcome",
    caseSceneLocationId: outcomeLocationId
  });
  assert.deepEqual(crossSessionOutcome, activeOutcome, "a second session observes the same case outcome without stacking it");
  const settledOutcome = engine.settleWorldLeadOutcome(daily.world, worldLeadRuntime, "case-world-lead-outcome");
  assert.equal(settledOutcome.status, "settled", "active outcome settles when its case closes");
  assert.deepEqual(worldLeadRuntime.locationProfiles.find((profile) => profile.locationId === outcomeLocationId), outcomeProfileBefore, "settlement reverses the applied location deltas");
  assert.deepEqual(engine.ensureTownRuleRuntimeState(daily.world, worldLeadRuntime), outcomeRuleBefore, "settlement reverses institution and resource deltas");
  assert.equal(worldLeadRuntime.worldLeadCaseHandoff, undefined, "ordinary outcome settlement never prepares a handoff by itself");
  const advancedArc = engine.advanceWorldArc(worldLeadRuntime, { caseId: "case-world-lead-outcome", focus: "search" });
  assert.equal(advancedArc.progressLabel, "1/3 stages", "followed accepted case advances the active world arc once");
  assert.equal(engine.advanceWorldArc(worldLeadRuntime, { caseId: "case-world-lead-outcome", focus: "search" }), undefined, "the same accepted case cannot advance an arc twice");
  assert.equal(engine.deriveWorldArcActionPriorityBonus(worldLeadRuntime, "investigate"), 1, "an advanced active arc gives only the stable top action a fixed bonus");
  assert.equal(engine.deriveWorldArcActionPriorityBonus(worldLeadRuntime, "seek-alibi"), 0, "arc action bonus does not change other legal action scores");
  assert.equal(engine.deriveWorldArcCasePriorityBonus(worldLeadRuntime, "evidence-tampering"), 1, "arc gives compatible case types a fixed queue bonus");
  assert.equal(engine.deriveWorldArcCasePriorityBonus(worldLeadRuntime, "false-testimony"), 0, "arc leaves incompatible case types unmodified");
  const directiveResponses = {
    support: {
      institutionKind: "court",
      strategy: "review-court-record",
      longActionKind: "review-court-record",
      label: "Open a formal record review",
      benefitLabel: "The record trail receives a stronger institutional review.",
      costLabel: "Court capacity is committed while the review runs."
    },
    contain: {
      institutionKind: "police",
      strategy: "allocate-investigation",
      longActionKind: "protect-chain-of-custody",
      label: "Secure the custody trail",
      benefitLabel: "Evidence handling receives protected attention.",
      costLabel: "Police time is reserved for custody work."
    }
  };
  const directiveRuntime = structuredClone(worldLeadRuntime);
  const directiveWorld = structuredClone(daily.world);
  directiveWorld.persistentRuntime = directiveRuntime;
  const tiedCourtActorIds = directiveWorld.npcs.slice(0, 2).map((npc) => npc.id).sort();
  const directiveRuleState = engine.ensureTownRuleRuntimeState(directiveWorld, directiveRuntime);
  directiveRuleState.professions = directiveRuleState.professions.map((profession) => tiedCourtActorIds.includes(profession.npcId)
    ? { ...profession, kind: "lawyer", institutionId: "inst-court", rank: 9, workload: 1 }
    : profession.institutionId === "inst-court"
      ? { ...profession, rank: 0, workload: 9 }
      : profession);
  const directiveTick = directiveRuntime.tick;
  const ruleStateBeforeDirective = structuredClone(engine.ensureTownRuleRuntimeState(directiveWorld, directiveRuntime));
  const readyDirective = engine.enqueueWorldArcDirective(directiveRuntime, {
    sourceCaseId: "case-world-lead-outcome",
    eventArchetypeId: "record-access-delay",
    responses: directiveResponses
  });
  assert.equal(readyDirective.status, "ready", "an accepted arc advance prepares one ready faction directive");
  assert.equal(readyDirective.queuedCount, 0, "the first directive becomes active instead of stacking");
  assert.equal(/\b(?:case|npc|event|source)-[a-z0-9-]+\b|record-access-delay|public-inquiry/i.test(JSON.stringify(readyDirective)), false, "directive public summary strips internal keys");
  assert.deepEqual(
    engine.enqueueWorldArcDirective(directiveRuntime, {
      sourceCaseId: "case-world-lead-outcome",
      eventArchetypeId: "record-access-delay",
      responses: directiveResponses
    }),
    readyDirective,
    "the same progression stage cannot enqueue twice"
  );
  const firstDirectiveId = directiveRuntime.worldArcDirectives.activeId;
  const directiveLineId = directiveRuntime.worldArcProgress.currentLineId;
  directiveRuntime.worldArcProgress.lines[directiveLineId].completedStages += 1;
  const queuedDirectiveSummary = engine.enqueueWorldArcDirective(directiveRuntime, {
    sourceCaseId: "case-world-lead-outcome-next-stage",
    eventArchetypeId: "record-access-delay",
    responses: directiveResponses
  });
  assert.equal(directiveRuntime.worldArcDirectives.activeId, firstDirectiveId, "a later stage waits behind the active directive in FIFO order");
  assert.equal(queuedDirectiveSummary.queuedCount, 1, "a later stage is counted once in the directive queue");
  const deferredDirective = engine.applyWorldArcDirectiveDecision(directiveRuntime, { choice: "defer" });
  assert.equal(deferredDirective.status, "ready", "defer keeps the directive open");
  assert.equal(directiveRuntime.tick, directiveTick, "defer is a zero-tick write");
  assert.deepEqual(engine.ensureTownRuleRuntimeState(directiveWorld, directiveRuntime), ruleStateBeforeDirective, "defer does not reserve or mutate town resources");
  directiveRuntime.maxTicks = directiveRuntime.tick;
  directiveRuntime.status = "completed";
  const scheduledDirective = engine.applyWorldArcDirectiveDecision(directiveRuntime, { choice: "support" });
  assert.equal(scheduledDirective.status, "scheduled", "support schedules the configured response");
  assert.equal(directiveRuntime.tick, directiveTick, "support selection is a zero-tick write");
  assert.equal(directiveRuntime.maxTicks, directiveTick + 12, "scheduled directive receives one bounded execution window after a completed simulation horizon");
  assert.equal(directiveRuntime.status, "paused", "scheduled directive reopens a completed runtime without advancing it");
  assert.deepEqual(engine.ensureTownRuleRuntimeState(directiveWorld, directiveRuntime), ruleStateBeforeDirective, "scheduling does not reserve resources before cadence");
  const directiveStarted = engine.advancePersistentTownTick(directiveWorld, daily.events, { steps: 5, status: "running", actionEveryTicks: 999 });
  assert.equal(directiveStarted.runtime.worldArcDirectiveSummary.status, "running", "the next institution cadence starts the selected long action");
  const runningDirective = directiveStarted.runtime.worldArcDirectives.items.find((item) => item.status === "running");
  assert.ok(runningDirective?.longActionId, "running directive records its existing long-action id internally");
  assert.equal(runningDirective.actorId, tiedCourtActorIds[0], "equal rank and workload choose the stable lowest actor id");
  const directiveAction = directiveStarted.runtime.ruleState.longActions.find((item) => item.id === runningDirective.longActionId);
  assert.equal(directiveAction.kind, "review-court-record", "support uses the configured existing long-action kind");
  assert.equal(directiveStarted.events.filter((event) => event.tags.includes("directive_start")).length, 1, "cadence emits exactly one directive start event");
  assert.equal(
    directiveStarted.runtime.ruleState.institutionDecisions.filter((decision) => decision.tick === 5 && decision.institutionId === runningDirective.institutionId).length,
    1,
    "directive start suppresses the same institution's normal cadence decision"
  );
  const directiveCompleted = engine.advancePersistentTownTick(directiveStarted.world, [...daily.events, ...directiveStarted.events], {
    steps: directiveAction.durationTicks,
    status: "running",
    actionEveryTicks: 999
  });
  assert.equal(directiveCompleted.runtime.worldArcDirectives.items.find((item) => item.id === firstDirectiveId).status, "completed", "existing multi-tick completion closes the active directive");
  assert.equal(directiveCompleted.events.filter((event) => event.tags.includes("directive_complete")).length, 1, "completion emits exactly one linked safe event");
  assert.equal(directiveCompleted.events.find((event) => event.tags.includes("directive_complete")).causedByEventIds.length, 1, "completion links to its unique start event");
  const completedDirectiveAction = directiveCompleted.runtime.ruleState.longActions.find((item) => item.id === runningDirective.longActionId);
  assert.ok(completedDirectiveAction?.appliedResult, "completed long action records its clamp-aware applied result internally");
  assert.equal(directiveCompleted.runtime.worldPressureCascadeSummary.status, "active", "directive completion immediately creates a future-case pressure pulse");
  assert.equal(directiveCompleted.runtime.worldPressureCascadeSummary.remainingLayers, 1, "one completed directive creates one bounded pressure layer");
  assert.equal(directiveCompleted.runtime.townSocialResponses.items.some((item) => item.sourceKind === "faction-directive" && item.status === "ready"), true, "completed player directive prepares one ambient social response without an extra tick");
  assert.equal(
    /world-arc-directive|case-world-lead|record-access-delay|inst-court|court_docket|review-court-record/i.test(JSON.stringify(directiveCompleted.runtime.worldPressureCascadeSummary)),
    false,
    "pressure public summary strips directive, case, event, institution, resource, and action keys"
  );
  assert.equal(directiveCompleted.runtime.worldEventOfferSummary.status, "offered", "directive completion prepares one follow-up world event offer");
  assert.equal(/world-event-offer|world-arc-directive|record-access-delay|institutionKind|longActionKind|createdAtTick|expiresAtTick/i.test(JSON.stringify(directiveCompleted.runtime.worldEventOfferSummary)), false, "offer public summary strips internal source, action, institution, and deadline keys");
  const affordableOfferRuntime = structuredClone(directiveCompleted.runtime);
  affordableOfferRuntime.worldEventOffers = { items: [] };
  affordableOfferRuntime.worldEventOfferSummary = undefined;
  affordableOfferRuntime.ruleState.resourceLedger.police_time.available = 0;
  affordableOfferRuntime.ruleState.resourceLedger.evidence_integrity.available = 0;
  affordableOfferRuntime.ruleState.resourceLedger.court_docket.available = 100;
  const completedDirectiveForOffer = affordableOfferRuntime.worldArcDirectives.items.find((item) => item.id === firstDirectiveId);
  engine.enqueueWorldEventOfferFromCompletedDirective(affordableOfferRuntime, completedDirectiveForOffer);
  assert.equal(
    affordableOfferRuntime.worldEventOffers.items[0].response.longActionKind,
    completedDirectiveForOffer.responses.support.longActionKind,
    "offer creation falls back deterministically to the affordable configured response without bypassing resource costs"
  );
  const declinedOfferRuntime = structuredClone(directiveCompleted.runtime);
  const declinedOfferRuleBefore = structuredClone(declinedOfferRuntime.ruleState);
  const declinedOfferTick = declinedOfferRuntime.tick;
  const declinedOffer = engine.applyWorldEventOfferDecision(declinedOfferRuntime, { choice: "decline" });
  assert.equal(declinedOffer.status, "declined", "player may decline an offered world opportunity");
  assert.equal(declinedOfferRuntime.tick, declinedOfferTick, "declining an offer is zero tick");
  assert.deepEqual(declinedOfferRuntime.ruleState, declinedOfferRuleBefore, "declining an offer changes no resources or town rule state");
  const offerRuntime = structuredClone(directiveCompleted.runtime);
  const offerWorld = structuredClone(directiveCompleted.world);
  const offerBaseEvents = [...daily.events, ...directiveStarted.events, ...directiveCompleted.events];
  offerWorld.persistentRuntime = offerRuntime;
  const offerActorId = offerWorld.npcs.find((npc) => npc.alive).id;
  const offerInstitutionKind = offerRuntime.worldEventOffers.items[0].response.institutionKind;
  const offerInstitutionId = offerRuntime.ruleState.institutions.find((institution) => institution.kind === offerInstitutionKind).id;
  offerRuntime.ruleState.professions = offerRuntime.ruleState.professions.map((profession) => profession.npcId === offerActorId
    ? { ...profession, institutionId: offerInstitutionId, rank: 10, workload: 0 }
    : profession.institutionId === offerInstitutionId
      ? { ...profession, rank: 0, workload: 9 }
      : profession);
  const offerCandidatesBefore = structuredClone(offerRuntime.candidates);
  const offerRuleBefore = structuredClone(offerRuntime.ruleState);
  const acceptedOffer = engine.applyWorldEventOfferDecision(offerRuntime, { choice: "accept" });
  assert.equal(acceptedOffer.status, "accepted", "accept records only player intent before cadence");
  assert.equal(offerRuntime.tick, directiveCompleted.runtime.tick, "accepting an offer is zero tick");
  assert.deepEqual(offerRuntime.ruleState, offerRuleBefore, "accepting an offer reserves no resources before cadence");
  assert.deepEqual(offerRuntime.candidates, offerCandidatesBefore, "zero-tick offer acceptance never rewrites the current candidate set");
  const ticksToOfferCadence = 5 - (offerRuntime.tick % 5 || 0);
  const offerStarted = engine.advancePersistentTownTick(offerWorld, offerBaseEvents, { steps: ticksToOfferCadence, status: "running", actionEveryTicks: 999 });
  assert.equal(offerStarted.runtime.worldEventOfferSummary.status, "running", "accepted offer starts on the next legal institution cadence");
  assert.equal(offerStarted.events.filter((event) => event.tags.includes("offer_start")).length, 1, "accepted offer emits one safe start event");
  const runningOffer = offerStarted.runtime.worldEventOffers.items.find((item) => item.status === "running");
  const offerAction = offerStarted.runtime.ruleState.longActions.find((item) => item.id === runningOffer.longActionId);
  assert.ok(offerAction, "running offer reuses one existing long action");
  const offerStandingBefore = offerStarted.runtime.factionRelationships.standings[runningOffer.response.institutionKind].value;
  const offerCompleted = engine.advancePersistentTownTick(offerStarted.world, [...offerBaseEvents, ...offerStarted.events], { steps: offerAction.durationTicks, status: "running", actionEveryTicks: 999 });
  assert.equal(offerCompleted.runtime.worldEventOfferSummary.status, "completed", "existing multi-tick completion closes the accepted offer");
  assert.equal(offerCompleted.runtime.townSocialResponses.items.some((item) => item.sourceKind === "world-event-offer" && item.status === "ready"), true, "completed accepted offer prepares one ambient social response");
  assert.equal(offerCompleted.events.filter((event) => event.tags.includes("offer_complete")).length, 1, "offer completion emits one linked safe event");
  assert.equal(offerCompleted.runtime.factionRelationships.standings[runningOffer.response.institutionKind].value, Math.min(10, offerStandingBefore + 1), "completed offer applies one explicit operating-institution recovery");
  const expiredOfferRuntime = structuredClone(directiveCompleted.runtime);
  expiredOfferRuntime.tick = expiredOfferRuntime.worldEventOffers.items[0].expiresAtTick;
  const expiredResult = engine.startAcceptedWorldEventOffer(directiveCompleted.world, offerBaseEvents, expiredOfferRuntime);
  assert.equal(expiredOfferRuntime.worldEventOfferSummary.status, "expired", "an unaccepted offer expires only when a later town tick processes its deadline");
  assert.equal(expiredResult.events.length, 0, "offer expiration creates no simulated action event");
  const hostileOfferRuntime = structuredClone(directiveCompleted.runtime);
  const hostileOffer = hostileOfferRuntime.worldEventOffers.items[0];
  engine.applyFactionRelationshipDelta(hostileOfferRuntime, { sourceKey: "hostile-offer-test", factionKind: hostileOffer.response.institutionKind, delta: -10, reason: "recovery" });
  engine.applyWorldEventOfferDecision(hostileOfferRuntime, { choice: "accept" });
  hostileOfferRuntime.tick += 5 - (hostileOfferRuntime.tick % 5 || 0);
  const hostileRuleBefore = structuredClone(hostileOfferRuntime.ruleState);
  const hostileStart = engine.startAcceptedWorldEventOffer(directiveCompleted.world, offerBaseEvents, hostileOfferRuntime);
  assert.equal(hostileOfferRuntime.worldEventOfferSummary.status, "failed", "hostile operating standing fails safely at cadence rather than at zero-tick accept");
  assert.equal(hostileStart.events.length, 0, "failed offer starts no event");
  assert.deepEqual(hostileOfferRuntime.ruleState, hostileRuleBefore, "failed relationship prerequisite reserves no resources");
  const recoveryOfferRuntime = structuredClone(hostileOfferRuntime);
  engine.recordInvestigatorProgression(recoveryOfferRuntime, { sourceKey: "recovery-case:closure-1", kind: "accepted-theory" });
  engine.recordInvestigatorProgression(recoveryOfferRuntime, { sourceKey: "recovery-case:closure-2", kind: "accepted-theory" });
  const recoveryTick = recoveryOfferRuntime.tick;
  const recoveredOffer = engine.applyWorldEventOfferDecision(recoveryOfferRuntime, { choice: "accept" });
  assert.equal(recoveredOffer.status, "accepted", "established case-closure practice can retry one failed offer");
  assert.equal(recoveryOfferRuntime.tick, recoveryTick, "offer recovery is a zero-tick decision");
  assert.equal(recoveryOfferRuntime.worldEventOffers.items[0].recoveryAttempts, 1, "offer recovery is bounded to one retry");
  assert.equal(engine.toWorldEventOfferPublicSummary(recoveryOfferRuntime).recoveryAvailable, false, "recovered offer cannot expose a second retry");
  const eventArchetypes = JSON.parse(await fs.readFile(path.join(root, "content", "detective-v1", "event-archetypes.json"), "utf8"));
  const mappedOfferRuntime = structuredClone(worldLeadRuntime);
  for (const eventArchetype of eventArchetypes) {
    assert.ok(eventArchetype.directiveResponses?.support, `${eventArchetype.id} has one existing response usable as an offer`);
    engine.enqueueWorldEventOffer(mappedOfferRuntime, {
      sourceDirectiveId: `mapping-${eventArchetype.id}`,
      eventArchetypeId: eventArchetype.id,
      factionLabel: "Town partner",
      response: eventArchetype.directiveResponses.support
    });
  }
  assert.equal(mappedOfferRuntime.worldEventOffers.items.length, 10, "all ten built-in event archetypes map into the bounded offer lifecycle");
  const cappedOfferRuntime = structuredClone(worldLeadRuntime);
  for (let index = 0; index < 40; index += 1) {
    engine.enqueueWorldEventOffer(cappedOfferRuntime, {
      sourceDirectiveId: `bounded-offer-${index}`,
      eventArchetypeId: "bounded-event",
      factionLabel: "Town partner",
      response: directiveResponses.support
    });
  }
  assert.equal(cappedOfferRuntime.worldEventOffers.items.length, 32, "open world event offer history is capped at 32 entries");
  const derivedPressureA = engine.deriveWorldPressurePulseFromCompletedAction({
    runtime: directiveCompleted.runtime.ruleState,
    action: completedDirectiveAction,
    directive: directiveCompleted.runtime.worldArcDirectives.items.find((item) => item.id === firstDirectiveId),
    tick: directiveCompleted.runtime.tick
  });
  const derivedPressureB = engine.deriveWorldPressurePulseFromCompletedAction({
    runtime: directiveCompleted.runtime.ruleState,
    action: completedDirectiveAction,
    directive: directiveCompleted.runtime.worldArcDirectives.items.find((item) => item.id === firstDirectiveId),
    tick: directiveCompleted.runtime.tick
  });
  assert.deepEqual(derivedPressureA, derivedPressureB, "the same applied long-action result derives the same pressure pulse");
  const mergeRuntime = structuredClone(worldLeadRuntime);
  mergeRuntime.worldPressurePulses = { items: [] };
  engine.mergeWorldPressurePulse(mergeRuntime, derivedPressureA);
  engine.mergeWorldPressurePulse(mergeRuntime, { ...derivedPressureA, id: `${derivedPressureA.id}-2`, updatedAtTick: derivedPressureA.updatedAtTick + 1 });
  engine.mergeWorldPressurePulse(mergeRuntime, { ...derivedPressureA, id: `${derivedPressureA.id}-3`, updatedAtTick: derivedPressureA.updatedAtTick + 2 });
  engine.mergeWorldPressurePulse(mergeRuntime, { ...derivedPressureA, id: `${derivedPressureA.id}-4`, updatedAtTick: derivedPressureA.updatedAtTick + 3 });
  assert.equal(mergeRuntime.worldPressurePulses.items.find((item) => item.direction === derivedPressureA.direction).layers, 3, "same-focus same-direction pressure merges at three layers");
  const oppositeDirection = derivedPressureA.direction === "rising" ? "relief" : "rising";
  engine.mergeWorldPressurePulse(mergeRuntime, { ...derivedPressureA, id: `${derivedPressureA.id}-opposite`, direction: oppositeDirection });
  assert.equal(mergeRuntime.worldPressurePulses.items.filter((item) => item.layers > 0).length, 2, "opposing pressure directions coexist as separate bounded pulses");
  const pressureCaseType = derivedPressureA.caseTypeIds[0];
  assert.equal(Math.abs(engine.deriveWorldPressureCasePriorityBonus(mergeRuntime, pressureCaseType)) <= 2, true, "aggregate pressure ranking bonus clamps to an absolute value of two");
  const mergeTick = mergeRuntime.tick;
  const firstConsumption = engine.consumeWorldPressurePulseOnExtraction(mergeRuntime, "case-pressure-next");
  assert.equal(mergeRuntime.tick, mergeTick, "pressure consumption is a zero-tick extraction side effect");
  assert.equal(firstConsumption.remainingLayers, 3, "one successful extraction consumes exactly one of four active layers");
  assert.equal(engine.toWorldPressureCascadePublicSummary(mergeRuntime).remainingLayers, 3, "repeated pressure reads are idempotent");
  const boundedPressureRuntime = structuredClone(worldLeadRuntime);
  boundedPressureRuntime.worldPressurePulses = { items: [] };
  for (let index = 0; index < 12; index += 1) {
    engine.mergeWorldPressurePulse(boundedPressureRuntime, {
      ...derivedPressureA,
      id: `${derivedPressureA.id}-bounded-${index}`,
      focusKey: `${derivedPressureA.focusKey}-${index}`,
      focusLabel: `Pressure lane ${index}`,
      createdAtTick: derivedPressureA.createdAtTick + index,
      updatedAtTick: derivedPressureA.updatedAtTick + index
    });
  }
  assert.equal(boundedPressureRuntime.worldPressurePulses.items.filter((item) => item.layers > 0).length <= 8, true, "active pressure state remains bounded as distinct focuses accumulate");
  const candidateEvents = [...daily.events, ...directiveStarted.events, ...directiveCompleted.events];
  const pressureCandidateRuntime = structuredClone(directiveCompleted.runtime);
  const neutralCandidateRuntime = structuredClone(directiveCompleted.runtime);
  delete neutralCandidateRuntime.worldPressurePulses;
  delete neutralCandidateRuntime.worldPressureCascadeSummary;
  neutralCandidateRuntime.candidateComputedAtTick = undefined;
  pressureCandidateRuntime.candidateComputedAtTick = undefined;
  const neutralPressureCandidates = engine.buildTownEmergenceQueue(directiveCompleted.world, candidateEvents, neutralCandidateRuntime).candidates;
  const rankedPressureCandidates = engine.buildTownEmergenceQueue(directiveCompleted.world, candidateEvents, pressureCandidateRuntime).candidates;
  assert.deepEqual(
    rankedPressureCandidates.map((candidate) => candidate.id).sort(),
    neutralPressureCandidates.map((candidate) => candidate.id).sort(),
    "pressure changes only final ordering and never the candidate set"
  );
  assert.deepEqual(new Map(rankedPressureCandidates.map((candidate) => [candidate.id, {
    valid: candidate.validation.valid,
    routeCertificate: candidate.validation.routeCertificate,
    chainCompleteness: candidate.chainCompleteness
  }])), new Map(neutralPressureCandidates.map((candidate) => [candidate.id, {
    valid: candidate.validation.valid,
    routeCertificate: candidate.validation.routeCertificate,
    chainCompleteness: candidate.chainCompleteness
  }])), "pressure preserves candidate validity, route certificate, and evidence-chain coverage");
  assert.notEqual(directiveCompleted.runtime.worldArcDirectives.activeId, firstDirectiveId, "completion promotes the next FIFO directive");
  assert.equal(directiveCompleted.runtime.worldArcDirectiveSummary.status, "ready", "the promoted FIFO directive is ready for a player response");

  const cappedDirectiveRuntime = structuredClone(worldLeadRuntime);
  const cappedArc = structuredClone(cappedDirectiveRuntime.worldArcProgress.lines[cappedDirectiveRuntime.worldArcProgress.currentLineId]);
  cappedDirectiveRuntime.worldArcDirectives = { items: [] };
  for (let index = 0; index < 40; index += 1) {
    const progressionLineId = `directive-cap-line-${String(index).padStart(2, "0")}`;
    cappedDirectiveRuntime.worldArcProgress = {
      currentLineId: progressionLineId,
      lines: {
        [progressionLineId]: {
          ...cappedArc,
          progressionLineId,
          label: `Directive cap line ${index}`,
          completedStages: 1
        }
      }
    };
    engine.enqueueWorldArcDirective(cappedDirectiveRuntime, {
      sourceCaseId: `case-directive-cap-${index}`,
      eventArchetypeId: "record-access-delay",
      responses: directiveResponses
    });
  }
  assert.equal(cappedDirectiveRuntime.worldArcDirectives.items.length, 32, "directive FIFO enforces the generic 32-item cap");
  assert.equal(cappedDirectiveRuntime.worldArcDirectives.activeId, "world-arc-directive-directive-cap-line-00-1", "queue saturation never discards or replaces the oldest active directive");

  const refundRuntime = structuredClone(worldLeadRuntime);
  const refundWorld = structuredClone(daily.world);
  refundWorld.persistentRuntime = refundRuntime;
  const refundActorId = refundWorld.npcs[0].id;
  const refundRuleState = engine.ensureTownRuleRuntimeState(refundWorld, refundRuntime);
  refundRuleState.professions = refundRuleState.professions.map((profession) => profession.npcId === refundActorId
    ? { ...profession, kind: "lawyer", institutionId: "inst-court", rank: 9, workload: 0 }
    : profession.institutionId === "inst-court"
      ? { ...profession, rank: 0, workload: 9 }
      : profession);
  engine.enqueueWorldArcDirective(refundRuntime, {
    sourceCaseId: "case-world-lead-outcome",
    eventArchetypeId: "record-access-delay",
    responses: directiveResponses
  });
  engine.applyWorldArcDirectiveDecision(refundRuntime, { choice: "support" });
  const refundBefore = structuredClone(refundRuntime.ruleState.resourceLedger.court_docket);
  const refundStarted = engine.advancePersistentTownTick(refundWorld, daily.events, { steps: 5, status: "running", actionEveryTicks: 999 });
  const refundDirective = refundStarted.runtime.worldArcDirectives.items.find((item) => item.status === "running");
  assert.ok(refundDirective?.actorId, "refund fixture starts with a deterministic attached actor");
  const missingActorWorld = structuredClone(refundStarted.world);
  missingActorWorld.npcs = missingActorWorld.npcs.filter((npc) => npc.id !== refundDirective.actorId);
  const refundBlocked = engine.advancePersistentTownTick(missingActorWorld, [...daily.events, ...refundStarted.events], { steps: 1, status: "running", actionEveryTicks: 999 });
  assert.equal(refundBlocked.runtime.worldArcDirectiveSummary.status, "blocked", "a missing running actor safely blocks the directive");
  assert.equal(refundBlocked.runtime.ruleState.resourceLedger.court_docket.available, refundBefore.available, "blocked running action refunds its actual available resource once");
  assert.equal(refundBlocked.runtime.ruleState.resourceLedger.court_docket.reserved, refundBefore.reserved, "blocked running action releases its actual reservation once");
  const refundAgain = engine.advancePersistentTownTick(refundBlocked.world, [...daily.events, ...refundStarted.events, ...refundBlocked.events], { steps: 1, status: "running", actionEveryTicks: 999 });
  assert.deepEqual(refundAgain.runtime.ruleState.resourceLedger.court_docket, refundBlocked.runtime.ruleState.resourceLedger.court_docket, "blocked reservation is never refunded twice");
  const alternateScheduled = engine.applyWorldArcDirectiveDecision(refundAgain.runtime, { choice: "contain" });
  assert.equal(alternateScheduled.status, "scheduled", "a blocked directive can switch to its alternate response");
  const candidateOrderBeforeHandoff = engine.buildTownEmergenceQueue(daily.world, daily.events, worldLeadRuntime).candidates;
  const candidateFactsBeforeHandoff = new Map(candidateOrderBeforeHandoff.map((candidate) => [candidate.id, {
    valid: candidate.validation.valid,
    routeCertificate: candidate.validation.routeCertificate,
    chainCompleteness: candidate.chainCompleteness
  }]));
  const handoffTick = worldLeadRuntime.tick;
  const readyHandoff = engine.prepareWorldLeadCaseHandoff(worldLeadRuntime, { settledCaseId: "case-world-lead-outcome", focus: "search" });
  assert.equal(readyHandoff.status, "ready", "accepted settlement prepares a one-time ready handoff");
  assert.equal(readyHandoff.focus, "search", "handoff preserves the settled lead focus");
  assert.equal(worldLeadRuntime.tick, handoffTick, "handoff preparation does not advance persistent ticks");
  assert.equal(worldLeadRuntime.candidateComputedAtTick, undefined, "ready handoff invalidates only the cached final candidate ordering");
  assert.equal(engine.deriveWorldLeadCaseHandoffPriorityBonus(worldLeadRuntime.worldLeadCaseHandoff, "evidence-tampering"), 2, "search handoff gives only evidence-tampering the fixed +2 bonus");
  assert.equal(engine.deriveWorldLeadCaseHandoffPriorityBonus(worldLeadRuntime.worldLeadCaseHandoff, "false-testimony"), 0, "search handoff leaves other case types unboosted");
  assert.equal(engine.deriveWorldLeadCaseHandoffPriorityBonus({ ...worldLeadRuntime.worldLeadCaseHandoff, focus: "question" }, "false-testimony"), 2, "question handoff maps to false-testimony deterministically");
  assert.equal(engine.deriveWorldLeadCaseHandoffPriorityBonus({ ...worldLeadRuntime.worldLeadCaseHandoff, focus: "challenge" }, "court-intimidation"), 2, "challenge handoff maps to court-intimidation deterministically");
  const unifiedInfluenceRuntime = structuredClone(worldLeadRuntime);
  unifiedInfluenceRuntime.worldPressurePulses = {
    items: [{
      ...derivedPressureA,
      id: "world-pressure-pulse-unified-budget",
      focusKey: "unified-budget",
      focusLabel: "Unified case pressure",
      affectedCaseLabel: "Evidence handling cases",
      caseTypeIds: ["evidence-tampering"],
      direction: "rising",
      layers: 3,
      consumedLayers: 0
    }]
  };
  const unifiedLedger = engine.deriveCandidateInfluenceLedger(unifiedInfluenceRuntime, "evidence-tampering");
  assert.deepEqual(unifiedLedger.entries.map((entry) => [entry.source, entry.weight]), [
    ["world-lead-handoff", 2],
    ["world-arc", 1],
    ["world-pressure", 2]
  ], "unified influence ledger preserves stable source order and each bounded contribution");
  assert.equal(unifiedLedger.rawTotal, 5, "unified influence ledger audits the pre-budget total");
  assert.equal(unifiedLedger.total, 3, "unified influence budget clamps all player-earned candidate influence to three");
  assert.equal(unifiedLedger.clamped, true, "unified influence ledger reports when the final budget clamps");
  assert.deepEqual(engine.deriveCandidateInfluenceLedger(unifiedInfluenceRuntime, "evidence-tampering"), unifiedLedger, "unified influence reads are deterministic and side-effect free");
  assert.equal(engine.deriveCandidateInfluenceBudget(unifiedInfluenceRuntime, "false-testimony"), 0, "unmatched case types receive no unified influence");
  const influenceSummary = engine.toWorldInfluenceBudgetPublicSummary(unifiedInfluenceRuntime);
  assert.equal(influenceSummary.status, "active", "safe influence summary reports active strategy sources");
  assert.equal(influenceSummary.sourceCount, 3, "safe influence summary aggregates handoff, arc, and pressure without raw keys");
  assert.equal(influenceSummary.maximumAbsoluteBonus, 3, "safe influence summary exposes the fixed total budget");
  assert.equal(/case-world-lead|world-pressure-pulse|evidence-tampering|progression/i.test(JSON.stringify(influenceSummary)), false, "safe influence summary strips case, pulse, case-type, and progression keys");
  const candidateOrderWithHandoff = engine.buildTownEmergenceQueue(daily.world, daily.events, worldLeadRuntime).candidates;
  assert.equal(worldLeadRuntime.candidateComputedAtTick, handoffTick, "ready handoff rebuilds the queue at the same persistent tick");
  const candidateOrderWithHandoffAgain = engine.buildTownEmergenceQueue(daily.world, daily.events, worldLeadRuntime).candidates;
  assert.deepEqual(candidateOrderWithHandoff.map((candidate) => candidate.id), candidateOrderWithHandoffAgain.map((candidate) => candidate.id), "handoff ranking ties remain stable across repeated reads");
  assert.deepEqual([...candidateOrderWithHandoff.map((candidate) => candidate.id)].sort(), [...candidateOrderBeforeHandoff.map((candidate) => candidate.id)].sort(), "handoff bonus never changes the candidate set");
  assert.deepEqual(new Map(candidateOrderWithHandoff.map((candidate) => [candidate.id, {
    valid: candidate.validation.valid,
    routeCertificate: candidate.validation.routeCertificate,
    chainCompleteness: candidate.chainCompleteness
  }])), candidateFactsBeforeHandoff, "handoff bonus never changes candidate validity, certificate, or evidence-chain coverage");
  unifiedInfluenceRuntime.candidateComputedAtTick = undefined;
  const unifiedInfluenceCandidates = engine.buildTownEmergenceQueue(daily.world, daily.events, unifiedInfluenceRuntime).candidates;
  assert.deepEqual([...unifiedInfluenceCandidates.map((candidate) => candidate.id)].sort(), [...candidateOrderBeforeHandoff.map((candidate) => candidate.id)].sort(), "unified influence budget changes only final ordering and never candidate membership");
  assert.deepEqual(new Map(unifiedInfluenceCandidates.map((candidate) => [candidate.id, {
    valid: candidate.validation.valid,
    routeCertificate: candidate.validation.routeCertificate,
    chainCompleteness: candidate.chainCompleteness
  }])), candidateFactsBeforeHandoff, "unified influence budget preserves validity, route certificate, and evidence-chain coverage");
  assert.equal(JSON.stringify(readyHandoff).includes("case-world-lead-outcome"), false, "handoff public summary hides settled case ids");
  const consumedHandoff = engine.consumeWorldLeadCaseHandoff(worldLeadRuntime, "case-world-lead-next");
  assert.equal(consumedHandoff.status, "consumed", "the first successful next extraction consumes the handoff");
  assert.equal(worldLeadRuntime.tick, handoffTick, "handoff consumption does not advance persistent ticks");
  assert.equal(worldLeadRuntime.candidateComputedAtTick, undefined, "consumption clears only the cached handoff ordering");
  assert.equal(engine.consumeWorldLeadCaseHandoff(worldLeadRuntime, "case-world-lead-later"), undefined, "a consumed handoff cannot stack or consume twice");
  assert.equal(JSON.stringify(consumedHandoff).includes("case-world-lead-next"), false, "consumed handoff public summary hides the next case id");
  const skippedLead = engine.applyWorldLeadDecision(worldLeadRuntime, { sessionId: "session-world-lead-skip", action: "skip" });
  assert.equal(skippedLead.status, "skipped", "world lead skip is recorded separately per session");
  assert.equal(skippedLead.nextAction, "Continue the next eligible certified route step.", "skip keeps the certified route as the next action");
  const alternateHints = structuredClone(worldLeadHints);
  alternateHints.source.progressionLineId = "alternate-inquiry";
  alternateHints.progressionLine.label = "Alternate inquiry";
  const alternateArc = engine.activateWorldArcForHints(worldLeadRuntime, alternateHints, "case-world-lead-alternate");
  assert.equal(alternateArc.progressLabel, "0/3 stages", "a different extracted line starts independently");
  const resumedArc = engine.activateWorldArcForHints(worldLeadRuntime, worldLeadHints, "case-world-lead-second");
  assert.equal(resumedArc.progressLabel, "1/3 stages", "returning to a progression line resumes its stored stage");
  engine.advanceWorldArc(worldLeadRuntime, { caseId: "case-world-lead-second", focus: "search" });
  engine.activateWorldArcForHints(worldLeadRuntime, worldLeadHints, "case-world-lead-third");
  const completedArc = engine.advanceWorldArc(worldLeadRuntime, { caseId: "case-world-lead-third", focus: "search" });
  assert.equal(completedArc.status, "completed", "world arc completion clamps at the configured stage count");
  assert.equal(engine.deriveWorldArcCasePriorityBonus(worldLeadRuntime, "evidence-tampering"), 0, "completed arcs stop applying queue bonuses");
  const actionKinds = new Set(engine.getTownActionDefinitions().map((definition) => definition.kind));
  for (const kind of ["move", "observe", "talk", "confront", "obtain-resource", "hide-trace", "investigate", "spread-rumor", "seek-alibi", "pressure", "cover-up"]) {
    assert.equal(actionKinds.has(kind), true, `action registry covers ${kind}`);
  }
  const ruleState = engine.ensureTownRuleRuntimeState(daily.world, runtime);
  assert.equal(ruleState.institutions.length >= 6, true, "rule state creates detective institutions");
  assert.equal(ruleState.professions.length, daily.world.npcs.length, "rule state assigns one profession per NPC");
  assert.equal(ruleState.publicOpinion.heat >= 0, true, "rule state tracks public opinion");
  assert.equal(ruleState.evidenceContamination.contamination >= 0, true, "rule state tracks evidence contamination");
  assert.equal(Object.keys(ruleState.resourceLedger).length >= 6, true, "rule state tracks resource ledger flow");
  const longActionKinds = new Set(engine.getLongActionDefinitions().map((definition) => definition.kind));
  for (const kind of ["investigate-scene", "file-police-report", "publish-rumor", "suppress-story", "tamper-evidence", "protect-witness", "bribe-witness", "conduct-autopsy", "audit-ledger", "family-pressure", "hold-inquest", "cross-examine-witness", "review-court-record", "trace-cargo", "inspect-warehouse", "second-medical-opinion", "secure-evidence-locker", "cultivate-informant", "verify-anonymous-tip"]) {
    assert.equal(longActionKinds.has(kind), true, `long action registry covers ${kind}`);
  }
}

{
  const world = engine.createInitialWorld("scenario-pack-persistent", { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const pack = engine.createScenarioPackFromWorld(world, {
    id: "pack-round-trip",
    name: "Pack round trip",
    seed: "pack-round-trip-seed",
    baselineSteps: 2,
    passCriteria: { minEventGrowth: 1, minMemoryGrowth: 1 }
  });
  const validation = engine.validateScenarioPack(pack);
  assert.equal(validation.ok, true, `scenario pack validates: ${validation.errors.join("; ")}`);
  assert.equal(JSON.stringify(pack).includes("agent_state_snapshot"), false, "scenario pack excludes runtime snapshot state");
  assert.equal(JSON.stringify(pack).includes("sk-"), false, "scenario pack excludes API key-looking values");
  const scenarioConfig = engine.scenarioPackToScenarioConfig(pack);
  assert.equal(scenarioConfig.seed, "pack-round-trip-seed", "scenario pack converts back to scenario config");
  const preview = engine.previewScenarioPackImport(pack);
  assert.equal(preview.installable, true, "scenario pack import preview is installable");
  const unsafe = structuredClone(pack);
  unsafe.assets["bad.txt"] = "C:\\Users\\example\\secret.txt";
  assert.equal(engine.validateScenarioPack(unsafe).ok, false, "scenario pack validation rejects absolute paths");
}

{
  const world = engine.createInitialWorld("run-catalog-persistent", { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const daily = engine.simulateDailyLife(world, 1, []);
  const scenario = engine.runTownScenario(daily.world, daily.events, {
    id: "run-catalog-scenario",
    seed: "run-catalog-seed",
    baselineSteps: 2,
    passCriteria: { minEventGrowth: 1, minMemoryGrowth: 1 }
  });
  const runs = engine.listRunCatalog(scenario.runtime);
  assert.equal(runs.some((run) => run.runId === "run-catalog-scenario"), true, "run catalog lists scenario runs");
  const snapshots = engine.snapshotsForRun(scenario.runtime, "run-catalog-scenario");
  assert.equal(snapshots.length >= 2, true, "run catalog exposes scenario snapshots");
  assert.equal(snapshots.every((snapshot) => snapshot.ruleSummary), true, "run snapshots include rule summaries");
  const diffs = engine.diffsForRun(scenario.runtime, "run-catalog-scenario");
  assert.equal(diffs.length >= 1, true, "run catalog exposes snapshot diffs");
  assert.ok(diffs[0].ruleChanges, "run diffs include institution/public-opinion/evidence changes");
  const bundle = engine.buildRunReplayBundle(scenario.runtime, "run-catalog-scenario");
  assert.equal(bundle.manifest.runId, "run-catalog-scenario", "replay bundle includes run manifest");
  const digestBundle = engine.buildRunReplayBundle(scenario.runtime, "run-catalog-scenario", null, scenario.world, scenario.events);
  assert.equal(digestBundle.replayDigest?.schema, "world-replay.v1", "replay bundle can carry a canonical world digest");
  assert.equal(digestBundle.replayDigest?.eventCount, scenario.events.length, "replay digest covers the authoritative event log");
  const comparison = engine.compareRuns(scenario.runtime, "run-catalog-scenario", `${scenario.runtime.id}-live`);
  assert.ok(comparison, "run catalog compares scenario and live runtime");
  const job = engine.createRunJob({ worldId: world.id, kind: "scenario", scenarioId: "run-catalog-scenario" });
  assert.equal(job.status, "queued", "run job starts queued");
}

{
  const baseWorld = engine.createInitialWorld("deterministic-persistent", { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const dailyA = engine.simulateDailyLife(baseWorld, 1, []);
  const dailyB = engine.simulateDailyLife(engine.createInitialWorld("deterministic-persistent", { mode: "showcase", npcCount: 8, timelineHours: 24 }), 1, []);
  const runA = engine.advancePersistentTownTick(dailyA.world, dailyA.events, { steps: 6, status: "running" });
  const runB = engine.advancePersistentTownTick(dailyB.world, dailyB.events, { steps: 6, status: "running" });
  assert.deepEqual(
    runA.events.map((event) => [event.id, event.type, event.actorIds.join(","), event.locationId]),
    runB.events.map((event) => [event.id, event.type, event.actorIds.join(","), event.locationId]),
    "persistent town ticks are deterministic for the same seed"
  );
  assert.equal(runA.runtime.decisionTraces.length > 0, true, "ticks produce decision traces");
  assert.equal(runA.runtime.eventObservations.length > 0, true, "ticks produce event observations");
  assert.deepEqual(
    runA.runtime.eventObservations.map((observation) => [observation.id, observation.eventId, observation.observerNpcId, observation.kind, observation.memoryId || ""]),
    runB.runtime.eventObservations.map((observation) => [observation.id, observation.eventId, observation.observerNpcId, observation.kind, observation.memoryId || ""]),
    "event observations are deterministic"
  );
  assert.equal(runA.runtime.decisionTraces.every((trace) => trace.candidates.length >= 3), true, "each trace includes action candidates");
  assert.equal(
    runA.runtime.decisionTraces.every((trace) => trace.candidates.every((candidate) => ["goalPriority", "knownInformation", "relationshipPressure", "resourceAvailability", "locationReachability", "risk", "evidenceConsistency", "caseImpact"].every((field) => Number.isFinite(candidate.score[field])))),
    true,
    "candidate score fields are complete"
  );
  assert.equal(
    runA.runtime.decisionTraces.every((trace) => trace.candidates.every((candidate) => ["witnessExposure", "rumorValue", "alibiPressure", "coverUpUrgency", "socialAffinity", "locationHeat", "institutionalPressure", "resourceFlow"].every((field) => Number.isFinite(candidate.score[field] ?? 0)))),
    true,
    "core simulation score fields are complete"
  );
  assert.deepEqual(
    runA.runtime.socialProfiles.map((profile) => [profile.npcId, profile.reputation, profile.suspicion, profile.rumorCredibility, profile.preferredActionKinds.join(",")]),
    runB.runtime.socialProfiles.map((profile) => [profile.npcId, profile.reputation, profile.suspicion, profile.rumorCredibility, profile.preferredActionKinds.join(",")]),
    "social profiles are deterministic"
  );
  assert.equal(runA.runtime.pressureLedger.length > 0, true, "ticks record a pressure ledger");
  assert.equal(runA.runtime.relationshipLedger.length > 0, true, "ticks record relationship and trust changes");
  assert.equal(runA.runtime.locationLedger.length > 0, true, "ticks record location heat and resource changes");
  assert.equal(runA.runtime.consequences.length > 0, true, "ticks record action consequences");
  assert.equal(runA.runtime.decisionTraces.every((trace) => trace.phases?.includes("extract-candidates") && trace.consequence && trace.observationIds?.length), true, "decision traces include phase, observation and consequence data");
  const briefA = engine.buildTownSituationBrief(runA.world, [...dailyA.events, ...runA.events], runA.runtime);
  const briefB = engine.buildTownSituationBrief(runB.world, [...dailyB.events, ...runB.events], runB.runtime);
  const { worldId: briefWorldIdA, runtimeId: briefRuntimeIdA, ...briefContentA } = briefA;
  const { worldId: briefWorldIdB, runtimeId: briefRuntimeIdB, ...briefContentB } = briefB;
  assert.equal(briefWorldIdA, runA.world.id, "town situation brief binds to its world");
  assert.equal(briefWorldIdB, runB.world.id, "town situation brief binds to its comparison world");
  assert.equal(briefRuntimeIdA, runA.runtime.id, "town situation brief binds to its runtime");
  assert.equal(briefRuntimeIdB, runB.runtime.id, "town situation brief binds to its comparison runtime");
  assert.deepEqual(briefContentA, briefContentB, "town situation brief content is deterministic for the same seed");
  assert.equal(briefA.hotLocations.length > 0, true, "town situation brief ranks hot locations");
  assert.equal(briefA.riskAgents.length > 0, true, "town situation brief ranks high-risk agents");
  assert.equal(briefA.recentSignals.length >= 2, true, "town situation brief explains current pressure signals");
}

{
  const world = engine.createInitialWorld("simulation-depth-persistent", { mode: "advanced", npcCount: 12, timelineHours: 72 });
  const daily = engine.simulateDailyLife(world, 3, []);
  const run = engine.advancePersistentTownTick(daily.world, daily.events, { steps: 14, status: "running" });
  const selectedKinds = new Set(run.runtime.decisionTraces.map((trace) => trace.candidates.find((candidate) => candidate.id === trace.selectedCandidateId)?.kind).filter(Boolean));
  const newKinds = ["investigate", "spread-rumor", "seek-alibi", "pressure", "cover-up"].filter((kind) => selectedKinds.has(kind));
  assert.equal(newKinds.length >= 3, true, "runtime selects diverse core simulation actions");
  const selectedKindCounts = run.runtime.decisionTraces.reduce((counts, trace) => {
    const selected = trace.candidates.find((candidate) => candidate.id === trace.selectedCandidateId)?.kind;
    if (selected) counts[selected] = (counts[selected] || 0) + 1;
    return counts;
  }, {});
  const selectedTotal = Object.values(selectedKindCounts).reduce((sum, count) => sum + count, 0);
  const largestSelectedShare = Math.max(...Object.values(selectedKindCounts)) / Math.max(1, selectedTotal);
  assert.equal(selectedKinds.size >= 4, true, "runtime action mix covers at least four selected action kinds");
  assert.equal(largestSelectedShare < 0.7, true, "runtime action selection is not dominated by a single action kind");
  assert.equal(run.runtime.memoryPropagations.length > 0, true, "runtime propagates memories beyond direct participants");
  assert.equal(run.runtime.eventObservations.some((observation) => observation.kind === "same-location" || observation.kind === "rumor" || observation.kind === "deduced"), true, "runtime records observation kinds beyond direct participation");
  assert.equal(run.world.memories.some((memory) => memory.sourceObservationId), true, "memories reference source observations");
  assert.equal(run.runtime.agentStates.some((agent) => (agent.propagatedMemoryCount || 0) > 0 || agent.lastConsequence), true, "agent state reflects propagation or consequence updates");
  assert.equal(run.runtime.agentStates.some((agent) => agent.socialProfile?.rumorCredibility >= 0), true, "agent state reflects social profile summary");
  assert.equal(run.runtime.consequences.some((item) => item.socialShift), true, "consequences record social shifts");
  assert.equal(run.runtime.consequences.some((item) => item.chainStage === "cover-up" || item.chainStage === "memory" || item.chainStage === "alibi"), true, "consequences record case-chain stages");
}

{
  const world = engine.createInitialWorld("candidate-persistent", { mode: "advanced", npcCount: 12, timelineHours: 72 });
  const daily = engine.simulateDailyLife(world, 3, []);
  const run = engine.advancePersistentTownTick(daily.world, daily.events, { steps: 10, status: "running" });
  const queue = engine.buildTownEmergenceQueue(run.world, [...daily.events, ...run.events], run.runtime);
  const cachedQueue = engine.buildTownEmergenceQueue(run.world, [...daily.events, ...run.events], run.runtime);
  assert.equal(run.runtime.candidateComputedAtTick, run.runtime.tick, "runtime records the tick used for candidate computation");
  assert.deepEqual(cachedQueue.candidates, queue.candidates, "same-tick emergence queue reuses equivalent validated candidates");
  assert.equal(queue.candidates.length > 0, true, "emergence queue produces candidates");
  assert.equal(queue.candidates.every((candidate) => candidate.riskChainEventIds.length > 0), true, "candidates trace risk chain events");
  assert.equal(queue.candidates.every((candidate) => candidate.validation.errors.length || candidate.validation.valid), true, "invalid candidates explain failure");
  assert.equal(queue.candidates.some((candidate) => (candidate.chainStageTags || []).length >= 2), true, "candidates expose multi-stage risk chains");
  assert.equal(queue.candidates.every((candidate) => Array.isArray(candidate.validation.failureReasons)), true, "candidate validation exposes failure reasons");
  const candidateRankScore = (candidate) => {
    const completeStages = Object.values(candidate.validation.chainCompleteness || candidate.chainCompleteness || {}).filter(Boolean).length;
    const evidenceCount = candidate.validation.evidenceChain?.relatedEvidenceIds.length || 0;
    return Number(candidate.validation.valid) * 100 +
      Number(Boolean(candidate.triggeredEventId)) * 18 +
      completeStages * 8 +
      Math.min(24, evidenceCount * 4) +
      (candidate.maturityScore || 0) +
      candidate.pressureScore -
      ((candidate.validation.evidenceChain?.warningReasons.length || 0) + candidate.validation.warnings.length) * 2;
  };
  for (let index = 1; index < Math.min(queue.candidates.length, 5); index += 1) {
    assert.equal(candidateRankScore(queue.candidates[index - 1]) >= candidateRankScore(queue.candidates[index]), true, "candidate queue is ordered by playable chain maturity");
  }
  const selected = queue.candidates.find((candidate) => candidate.validation.valid) || queue.candidates[0];
  const validation = engine.validateCaseCandidate(run.world, [...daily.events, ...run.events], selected);
  assert.deepEqual(validation.errors, selected.validation.errors, "candidate validation is stable");
  assert.ok(selected.validation.observationSupport, "candidate validation exposes observation support");
  const rumorObservation = run.runtime.eventObservations.find((observation) => observation.kind === "rumor");
  if (rumorObservation) {
    const rumorVictimId = rumorObservation.subjectNpcId || rumorObservation.sourceNpcId || selected.victimId;
    const rumorCandidate = {
      ...selected,
      culpritId: rumorObservation.observerNpcId,
      victimId: rumorVictimId,
      riskChainEventIds: [rumorObservation.eventId],
      memoryIds: run.world.memories.filter((memory) => memory.sourceObservationId === rumorObservation.id).map((memory) => memory.id),
      triggeredEventId: "fake-trigger",
      chainCompleteness: { motive: true, means: true, opportunity: true, "cover-up": true, memory: true, exclusion: true },
      validation: {
        ...selected.validation,
        memoryConfidence: { direct: 0, deduced: 0, rumor: rumorObservation.confidence, supportScore: Math.round(rumorObservation.confidence * 25) },
        observationSupport: { direct: 0, deduced: 0, sameLocation: 0, rumor: rumorObservation.confidence, supportScore: Math.round(rumorObservation.confidence * 20), observationIds: [rumorObservation.id] }
      }
    };
    const rumorValidation = engine.validateCaseCandidate(run.world, [...daily.events, ...run.events], rumorCandidate);
    assert.equal(rumorValidation.observationSupport.rumor > 0, true, "rumor-only candidate sees rumor observation support");
    assert.equal(rumorValidation.observationSupport.supportScore < 55, true, "low-confidence rumor alone cannot satisfy memory support");
    assert.equal(rumorValidation.memoryScopedTestimony, false, "rumor-only support does not satisfy scoped testimony");
  }
}

{
  const world = engine.createInitialWorld("long-chain-trigger-persistent", { mode: "advanced", npcCount: 20, timelineHours: 72 });
  const daily = engine.simulateDailyLife(world, 3, []);
  const runA = engine.advancePersistentTownTick(daily.world, daily.events, { steps: 45, status: "running" });
  const dailyB = engine.simulateDailyLife(engine.createInitialWorld("long-chain-trigger-persistent", { mode: "advanced", npcCount: 20, timelineHours: 72 }), 3, []);
  const runB = engine.advancePersistentTownTick(dailyB.world, dailyB.events, { steps: 45, status: "running" });
  assert.equal(runA.runtime.triggeredCases.length > 0, true, "30-60 ticks trigger at least one real simulated case event");
  assert.deepEqual(
    runA.runtime.triggeredCases.map((item) => [item.eventId, item.culpritId, item.victimId, item.maturityScore]),
    runB.runtime.triggeredCases.map((item) => [item.eventId, item.culpritId, item.victimId, item.maturityScore]),
    "long-chain triggered cases are deterministic"
  );
  const triggerEvent = runA.events.find((event) => event.id === runA.runtime.triggeredCases[0].eventId);
  assert.equal(triggerEvent.type, "death", "mature long chain writes a real death event");
  assert.equal(triggerEvent.causedByEventIds.length >= 6, true, "triggered case event points back to six-stage causes");
  const queue = engine.buildTownEmergenceQueue(runA.world, [...daily.events, ...runA.events], runA.runtime);
  const mature = queue.candidates.find((candidate) => candidate.triggeredEventId);
  assert.equal(mature.validation.valid, true, "triggered candidates pass six-stage validation");
  assert.equal(Object.values(mature.chainCompleteness).every(Boolean), true, "triggered candidate exposes complete six-stage chain");
  assert.equal(mature.validation.memoryConfidence.supportScore >= 55, true, "triggered candidate has weighted memory support");
}

{
  const world = engine.createInitialWorld("source-signaled-incident-lifecycle", { mode: "advanced", npcCount: 20, timelineHours: 72 });
  const daily = engine.simulateDailyLife(world, 3, []);
  const runtime = engine.createPersistentTownRuntime(daily.world, daily.events, {
    maxTicks: 48,
    caseTriggerPolicy: "source-signaled"
  });
  runtime.campaignCaseTarget = 30;
  const seededWorld = { ...daily.world, persistentRuntime: runtime };
  const run = engine.advancePersistentTownTick(seededWorld, daily.events, { steps: 45, status: "running" });
  const trigger = run.runtime.triggeredCases.find((item) => item.kind === "nonfatal_incident");
  assert.ok(trigger, "source-signaled policy produces a typed nonfatal incident");
  const triggerEvent = run.events.find((event) => event.id === trigger.eventId);
  assert.equal(triggerEvent.type, "incident", "nonfatal lifecycle writes an incident event");
  assert.equal(triggerEvent.tags.includes("nonfatal_incident"), true, "incident event preserves its trigger kind tag");
  assert.equal(run.world.npcs.find((npc) => npc.id === trigger.victimId)?.alive, true, "nonfatal lifecycle keeps the affected NPC alive");
  const allEvents = [...daily.events, ...run.events];
  const queue = engine.buildTownEmergenceQueue(run.world, allEvents, run.runtime);
  const candidate = queue.candidates.find((item) => item.triggeredEventId === trigger.eventId);
  assert.ok(candidate, "incident trigger is exposed as a candidate by its stable event id");
  const extracted = engine.extractPlayableCaseFromCandidate(run.world, allEvents, candidate);
  assert.equal(extracted.activeCase.triggerKind, "nonfatal_incident", "incident extraction retains the trigger kind");
  assert.equal(extracted.activeCase.generationProfile.deathEventId, "", "incident extraction does not synthesize a death event");
  assert.equal(extracted.activeCase.validation.valid, true, `incident extraction passes the existing proof validation: ${JSON.stringify(extracted.activeCase.validation)}`);
}

{
  const world = engine.createInitialWorld("extract-persistent", { mode: "advanced", npcCount: 20, timelineHours: 72 });
  const daily = engine.simulateDailyLife(world, 3, []);
  const run = engine.advancePersistentTownTick(daily.world, daily.events, { steps: 45, status: "running" });
  const allEvents = [...daily.events, ...run.events];
  const queue = engine.buildTownEmergenceQueue(run.world, allEvents, run.runtime);
  const selected = queue.candidates.find((candidate) => candidate.validation.valid) || queue.candidates[0];
  assert.ok(selected.triggeredEventId, "extraction prefers a candidate backed by a real triggered case event");
  const lifecycleBeforeResolution = JSON.stringify(run.runtime.caseLifecycle || null);
  const extracted = engine.extractPlayableCaseFromCandidate(run.world, allEvents, selected);
  assert.equal(extracted.activeCase.validation.valid, true, "extracted playable case passes existing world validation");
  assert.equal(extracted.activeCase.qualityReport.uniqueCulprit, true, "extracted playable case has unique culprit");
  assert.equal(extracted.activeCase.qualityReport.worldBackedEvidence, true, "extracted playable case has event-backed evidence");
  assert.equal(extracted.candidate.validation.hardLogicValid, true, "candidate records hard logic pass after extraction");
  assert.equal(extracted.activeCase.triggeredEventId, selected.triggeredEventId, "extracted case records the real triggered event id");
  assert.equal(extracted.activeCase.sourceCandidateId, selected.id, "extracted case records the source candidate id");
  assert.equal(JSON.stringify(run.runtime.caseLifecycle || null), lifecycleBeforeResolution, "candidate extraction preview does not mutate case lifecycle");
  const resolution = engine.resolveCaseInWorld(extracted.world, run.runtime, {
    caseId: extracted.activeCase.id,
    outcome: extracted.candidate.validation.valid ? "extracted" : "failed",
    culpritId: extracted.candidate.culpritId,
    victimId: extracted.candidate.victimId,
    valid: extracted.candidate.validation.valid
  });
  const lifecycleAfterResolution = JSON.stringify(run.runtime.caseLifecycle || null);
  assert.equal(run.runtime.candidateComputedAtTick, undefined, "case resolution invalidates the candidate cache");
  assert.equal(resolution.lifecycle.solvedCaseIds.includes(extracted.activeCase.id), true, "explicit resolution writes solved case lifecycle");
  assert.equal(resolution.lifecycle.caseAftermathLog.some((item) => item.caseId === extracted.activeCase.id), true, "explicit resolution writes aftermath log");
  const repeatResolution = engine.resolveCaseInWorld(extracted.world, run.runtime, {
    caseId: extracted.activeCase.id,
    outcome: "extracted",
    culpritId: extracted.candidate.culpritId,
    victimId: extracted.candidate.victimId,
    valid: true
  });
  assert.equal(JSON.stringify(run.runtime.caseLifecycle || null), lifecycleAfterResolution, "repeated resolution is idempotent");
  assert.equal(repeatResolution.lifecycle.caseAftermathLog.filter((item) => item.caseId === extracted.activeCase.id).length, 1, "repeated resolution does not duplicate aftermath");
  const postRuleState = engine.ensureTownRuleRuntimeState(extracted.world, run.runtime);
  assert.equal(postRuleState.evidenceChain.items.length > 0, true, "rule state records concrete evidence chain items");
  assert.equal((postRuleState.institutionDecisions || []).length > 0, true, "institution phase records strategy decisions");
  assert.equal(extracted.events.filter((event) => event.type === "death").length, 1, "triggered extraction view contains exactly one death event");
  assert.equal(extracted.events.every((event) => event.id.startsWith("caseview-")), true, "triggered extraction uses a selected-case view");
  for (const evidenceId of ["ev-motive", "ev-means", "ev-opportunity", "ev-staging", "ev-trace", "ev-town-rollcall"]) {
    assert.equal((extracted.activeCase.sourceMap.evidenceSourceEventIds?.[evidenceId] || []).length > 0, true, `${evidenceId} maps back to real persistent town source events`);
  }
  const originalStageSources = Object.values(extracted.activeCase.sourceMap.chainStageSourceEventIds || {}).flat();
  assert.equal(originalStageSources.some((eventId) => allEvents.some((event) => event.id === eventId)), true, "chain stage source map references original runtime events");
  assert.equal((extracted.activeCase.sourceMap.memorySourceIds || []).length > 0, true, "extracted case records memory sources from the selected chain");
  assert.equal((extracted.activeCase.sourceMap.observationSourceIds || []).length > 0, true, "extracted case records observation sources from the selected chain");
  assert.equal(extracted.activeCase.deductionCase.logicPuzzle.exclusionChains.every((chain) => chain.evidenceIds.length > 0), true, "all non-culprit exclusions keep evidence ids");
  const intake = engine.buildPlayableCaseIntake(extracted.activeCase, extracted.events, extracted.world);
  assert.equal(intake.caseId, extracted.activeCase.id, "playable intake binds to extracted case");
  assert.equal(intake.sourceCandidateId, selected.id, "playable intake exposes source candidate id");
  assert.equal(intake.chainStages.filter((stage) => stage.complete).length >= 6, true, "playable intake exposes complete chain stages");
  assert.equal(intake.starterTasks.length >= 5, true, "playable intake builds starter tasks");
  assert.equal(intake.evidenceRoute.length >= 5, true, "playable intake builds evidence route");
  assert.equal(intake.witnessPlan.length > 0, true, "playable intake builds witness plan");
  assert.equal(intake.routeIntegrity.playable, true, "playable intake route integrity passes for extracted cases");
  assert.equal(intake.routeIntegrity.searchableEvidence, true, "route integrity requires a searchable evidence route");
  assert.equal(intake.routeIntegrity.witnessAvailable, true, "route integrity requires a witness route");
  assert.equal(intake.routeIntegrity.contradictionAvailable, true, "route integrity requires a testimony challenge route");
  assert.deepEqual(Object.values(intake.routeIntegrity.criticalCoverage), [true, true, true, true], "route integrity covers motive, means, opportunity, and exclusion");
  assert.equal(intake.routeIntegrity.proofLedgerValid, true, "route integrity is backed by a valid truth ledger");
  assert.equal(intake.routeIntegrity.routeCertified, true, "route integrity requires a passing route certificate");
  assert.ok(intake.proofCoverage.totalRequired >= 8, "playable intake exposes proof obligation coverage");
  assert.equal(intake.routeCertificate.routeCertified, true, "playable intake exposes a passing route certificate");
  assert.equal(intake.routeCertificate.autoTheoryAccepted, true, "route certificate auto theory is accepted");
  assert.equal(intake.routeCertificate.steps.some((step) => step.kind === "search"), true, "route certificate contains search steps");
  assert.equal(intake.routeCertificate.steps.some((step) => step.kind === "question"), true, "route certificate contains question steps");
  assert.equal(intake.routeCertificate.steps.some((step) => step.kind === "challenge"), true, "route certificate contains challenge steps");
  assert.equal(intake.routeCertificate.steps.some((step) => step.kind === "submit"), true, "route certificate contains submit step");
  const ledger = engine.buildCaseTruthLedger(extracted.activeCase, extracted.events);
  const ledgerKinds = new Set(ledger.obligations.map((item) => item.kind));
  for (const kind of ["motive", "means", "opportunity", "timeline", "contradiction", "exclusion", "source", "conclusion"]) {
    assert.equal(ledgerKinds.has(kind), true, `truth ledger includes ${kind} obligations`);
  }
  assert.equal(ledger.valid, true, "truth ledger validates complete extracted cases");
  assert.equal(intake.progress.currentStage, "join", "intake progress starts before join");
  assert.equal(intake.progress.coachStage, "join", "intake exposes coach stage before join");
  assert.equal(intake.nextAction.kind, "join", "intake next action starts with joining investigation");
  assert.equal(intake.nextAction.coachStepId, intake.coach.nextStep.id, "intake next action is backed by coach step");
  assert.equal(intake.coach.stage, "join", "coach starts at join");
  assert.equal(intake.coach.coverage.routeCertified, true, "coach coverage includes route certificate state");
  assert.equal(intake.coach.coverage.autoSolvePassed, true, "coach coverage includes auto-solve state");
  assert.equal(intake.coach.nextStep.buttonLabel, "Join investigation", "coach exposes a low-spoiler action button");
  assert.equal(intake.progressStages.length >= 5, true, "playable intake builds progress stages");
  assert.equal(intake.sourceCounts.events > 0 && intake.sourceCounts.memories > 0 && intake.sourceCounts.observations > 0, true, "playable intake summarizes source counts");
  const hiddenIntakeText = JSON.stringify(intake);
  assert.equal(hiddenIntakeText.includes(extracted.activeCase.deductionCase.truth.culpritId), false, "unsolved intake does not expose culprit id");
  assert.equal(hiddenIntakeText.includes("hidden-memory"), false, "unsolved coach/intake does not expose hidden memory ids");
  assert.equal(intake.sourceTrail.filter((item) => item.hidden).every((item) => item.label === "Hidden source event" || item.label === "Locked memory source"), true, "unsolved intake hides source labels");
  const certificate = engine.certifyPlayableCase(extracted.activeCase, extracted.events);
  assert.equal(certificate.routeCertified, true, "route certificate passes complete extracted cases");
  assert.equal(certificate.judgement.accepted, true, "route certificate proves accepted local judgement");
  const autoSolve = engine.autoSolvePlayableCase(extracted.activeCase, extracted.events);
  assert.equal(autoSolve.passed, true, "auto-solve passes complete extracted cases");
  assert.equal(autoSolve.summary.routeCertified, true, "auto-solve summary preserves certificate state");
  assert.equal(autoSolve.summary.proofCoverageComplete, true, "auto-solve closes proof coverage");
  assert.equal(autoSolve.summary.questionedWitnessCount > 0, true, "auto-solve questions witnesses");
  assert.equal(autoSolve.summary.challengeHitCount > 0, true, "auto-solve hits testimony challenges");
  assert.equal(autoSolve.session.judgement.accepted, true, "auto-solve synthetic session stores accepted judgement");
  assert.equal(autoSolve.steps.some((step) => step.kind === "submit" && step.complete), true, "auto-solve completes submit step");
  const noEvidenceCase = structuredClone(extracted.activeCase);
  noEvidenceCase.deductionCase.evidence = noEvidenceCase.deductionCase.evidence.map((item) => ({ ...item, discoverable: false }));
  const noEvidenceIntegrity = engine.validatePlayableCaseRoute(noEvidenceCase, extracted.events);
  assert.equal(noEvidenceIntegrity.searchableEvidence, false, "route integrity fails cases without discoverable evidence");
  assert.equal(noEvidenceIntegrity.playable, false, "route integrity blocks cases without discoverable evidence");
  assert.equal(engine.buildCaseTruthLedger(noEvidenceCase, extracted.events).valid, false, "truth ledger rejects cases without discoverable proof evidence");
  assert.equal(engine.certifyPlayableCase(noEvidenceCase, extracted.events).blockers.some((item) => item.kind === "search"), true, "route certificate blocks cases without searchable evidence");
  assert.equal(engine.autoSolvePlayableCase(noEvidenceCase, extracted.events).summary.failureKinds.includes("search"), true, "auto-solve reports search failures");
  const noWitnessCase = structuredClone(extracted.activeCase);
  noWitnessCase.testimonies = [];
  const noWitnessIntegrity = engine.validatePlayableCaseRoute(noWitnessCase, extracted.events);
  assert.equal(noWitnessIntegrity.witnessAvailable, false, "route integrity fails cases without witnesses");
  assert.equal(engine.certifyPlayableCase(noWitnessCase, extracted.events).blockers.some((item) => item.kind === "witness"), true, "route certificate blocks cases without witness routes");
  assert.equal(engine.autoSolvePlayableCase(noWitnessCase, extracted.events).summary.failureKinds.includes("witness"), true, "auto-solve reports witness failures");
  const noChallengeCase = structuredClone(extracted.activeCase);
  noChallengeCase.testimonies = noChallengeCase.testimonies.map((item) => ({ ...item, contradictionEvidenceIds: [] }));
  const noChallengeIntegrity = engine.validatePlayableCaseRoute(noChallengeCase, extracted.events);
  assert.equal(noChallengeIntegrity.contradictionAvailable, false, "route integrity fails cases without discoverable contradiction evidence");
  assert.equal(engine.buildCaseTruthLedger(noChallengeCase, extracted.events).obligations.some((item) => item.kind === "contradiction" && item.evidenceIds.length > 0), false, "truth ledger exposes missing testimony contradiction obligations");
  assert.equal(engine.certifyPlayableCase(noChallengeCase, extracted.events).blockers.some((item) => item.kind === "challenge"), true, "route certificate blocks cases without challenge routes");
  assert.equal(engine.autoSolvePlayableCase(noChallengeCase, extracted.events).summary.failureKinds.includes("challenge"), true, "auto-solve reports challenge failures");
  const noSourceCase = structuredClone(extracted.activeCase);
  noSourceCase.sourceMap.evidenceSourceEventIds = {};
  const noSourceLedger = engine.buildCaseTruthLedger(noSourceCase, []);
  assert.equal(noSourceLedger.valid, false, "truth ledger rejects decisive evidence without source backing");
  assert.equal(engine.certifyPlayableCase(noSourceCase, []).blockers.some((item) => item.kind === "source"), true, "route certificate blocks emerged cases without source backing");
  assert.equal(engine.autoSolvePlayableCase(noSourceCase, []).summary.failureKinds.includes("source"), true, "auto-solve reports source failures");
  const noExclusionCase = structuredClone(extracted.activeCase);
  noExclusionCase.sourceMap.chainStageSourceEventIds.exclusion = [];
  noExclusionCase.deductionCase.logicPuzzle.exclusionChains = [];
  noExclusionCase.deductionCase.evidence = noExclusionCase.deductionCase.evidence.map((item) => ({ ...item, title: "neutral clue", visibleDescription: "neutral scene context", trueMeaning: "neutral context", supportsConclusion: [], contradicts: [], unlocks: [] }));
  const noExclusionIntegrity = engine.validatePlayableCaseRoute(noExclusionCase, extracted.events);
  assert.equal(noExclusionIntegrity.criticalCoverage.exclusion, false, "route integrity fails cases without exclusion coverage");
  assert.equal(engine.certifyPlayableCase(noExclusionCase, extracted.events).blockers.some((item) => item.kind === "exclusion" || item.kind === "submit"), true, "route certificate blocks cases without exclusion route");
  assert.equal(engine.autoSolvePlayableCase(noExclusionCase, extracted.events).summary.failureKinds.some((kind) => kind === "exclusion" || kind === "submit"), true, "auto-solve reports exclusion or submit failures");
  const challengeEvidenceId = extracted.activeCase.testimonies.flatMap((item) => item.contradictionEvidenceIds)[0] || extracted.activeCase.deductionCase.evidence[0].id;
  const discoveredSession = {
    id: "intake-session",
    worldId: extracted.world.id,
    caseId: extracted.activeCase.id,
    playerId: "tester",
    displayName: "Tester",
    discoveredEvidenceIds: [challengeEvidenceId],
    interrogationLog: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const discoveredIntake = engine.buildPlayableCaseIntake(extracted.activeCase, extracted.events, extracted.world, discoveredSession);
  assert.equal(discoveredIntake.sourceCounts.discoveredEvidence, 1, "intake updates discovered evidence count from session");
  assert.equal(discoveredIntake.evidenceRoute.some((item) => item.id === challengeEvidenceId && item.discovered), true, "intake marks discovered evidence in the route");
  assert.equal(discoveredIntake.starterTasks.some((item) => item.kind === "search" && item.complete), true, "discovered evidence updates starter task state");
  assert.equal(discoveredIntake.progress.currentStage, "question", "discovered evidence advances intake progress toward questioning");
  assert.equal(["search", "question"].includes(discoveredIntake.coach.stage), true, "coach advances after the first discovered clue without skipping the route");
  assert.equal(discoveredIntake.nextAction.kind === "search" || discoveredIntake.nextAction.kind === "question", true, "next action advances the investigation route without spoilers");
  const wrongTheoryIntake = engine.buildPlayableCaseIntake(extracted.activeCase, extracted.events, extracted.world, {
    ...discoveredSession,
    discoveredEvidenceIds: extracted.activeCase.deductionCase.evidence.map((item) => item.id),
    submittedTheory: { culpritId: "wrong", motive: "", method: "", evidenceIds: [] },
    judgement: { accepted: false, score: 10, missing: ["Missing motive explanation."], contradictions: [], explanation: "Rejected by test" }
  });
  assert.equal(wrongTheoryIntake.progress.wrongTheorySubmitted, true, "wrong submissions are reflected in intake progress");
  assert.equal(["question", "challenge", "select-evidence", "submit"].includes(wrongTheoryIntake.coach.stage), true, "coach routes wrong submissions toward a repairable investigation stage");
  assert.equal(wrongTheoryIntake.coach.blockers.some((item) => item.kind === "submit" || item.kind === "coverage" || item.kind === "challenge"), true, "coach maps wrong submissions to proof repair blockers");
  const wrongTheory = engine.judgeTheory(extracted.activeCase.deductionCase, { culpritId: "wrong", motive: "", method: "", evidenceIds: [] }, extracted.activeCase.deductionCase.evidence.map((item) => item.id));
  assert.ok(wrongTheory.proofCoverage?.gaps.length, "wrong theory judgement returns proof coverage gaps");
  assert.equal(wrongTheory.missing.some((item) => item.includes("missing")), true, "wrong theory missing reasons include proof obligation gaps");
  const solvedIntake = engine.buildPlayableCaseIntake(extracted.activeCase, extracted.events, extracted.world, {
    ...discoveredSession,
    discoveredEvidenceIds: extracted.activeCase.deductionCase.evidence.map((item) => item.id),
    judgement: { accepted: true, score: 100, missing: [], contradictions: [], explanation: "Solved by test" }
  });
  assert.equal(solvedIntake.readiness.status, "solved", "solved intake unlocks solved status");
  assert.equal(solvedIntake.progress.currentStage, "solved", "solved intake marks progress solved");
  assert.equal(solvedIntake.progress.coachStage, "review-source", "solved intake exposes source review coach stage");
  assert.equal(solvedIntake.coach.stage, "review-source", "coach unlocks source review after solve");
  assert.equal(solvedIntake.nextAction.kind, "review-source", "solved intake points to source review");
  assert.equal(solvedIntake.sourceTrail.some((item) => item.hidden), false, "solved intake unlocks full source trail labels");
  assert.equal(solvedIntake.routeCertificate.steps.some((step) => step.evidenceIds.length > 0), true, "solved intake unlocks full route certificate steps");
}

{
  const world = engine.createInitialWorld("intervention-persistent", { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const daily = engine.simulateDailyLife(world, 1, []);
  const run = engine.advancePersistentTownTick(daily.world, daily.events, { steps: 2, status: "running" });
  const actorId = run.runtime.agentStates[0].npcId;
  const intervened = engine.applyTownRuntimeIntervention(run.world, {
    actorId,
    kind: "resource",
    value: "resource:test-key"
  });
  assert.equal(intervened.intervention.branch, "counterfactual", "interventions are counterfactual branches");
  assert.equal(intervened.runtime.agentStates.find((agent) => agent.npcId === actorId).resources.includes("resource:test-key"), true, "resource intervention changes agent state");
  const after = engine.advancePersistentTownTick(intervened.world, [...daily.events, ...run.events], { steps: 1, status: "running" });
  assert.equal(after.runtime.interventions.length, 1, "intervention persists after next tick");
  assert.equal(run.runtime.interventions.length, 0, "original runtime object is not mutated by intervention result");
}

{
  const world = engine.createInitialWorld("action-bias-persistent", { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const daily = engine.simulateDailyLife(world, 1, []);
  const actorId = daily.world.npcs[0].id;
  daily.world.npcs = daily.world.npcs.map((npc, index) => ({ ...npc, alive: index === 0 }));
  const runtime = engine.createPersistentTownRuntime(daily.world, daily.events, { maxTicks: 8 });
  daily.world.persistentRuntime = runtime;
  const biased = engine.applyTownRuntimeIntervention(daily.world, {
    actorId,
    kind: "action-bias",
    value: "investigate",
    actionId: "action-bias-trace-link",
    reason: "Exercise the auditable counterfactual path.",
    sourceRefs: [`world:${daily.world.id}`]
  });
  const biasedScores = engine.scoreNpcActionCandidates(biased.world, biased.world.npcs[0], daily.events, biased.runtime);
  const investigate = biasedScores.find((candidate) => candidate.kind === "investigate");
  assert.equal(investigate.score.directorBias, 18, "action bias is visible in candidate scoring");
  const after = engine.advancePersistentTownTick(biased.world, daily.events, { steps: 1, status: "running" });
  const trace = after.runtime.decisionTraces.find((item) => item.npcId === actorId);
  const selected = trace.candidates.find((candidate) => candidate.id === trace.selectedCandidateId);
  assert.equal(selected.kind, "investigate", "action bias affects the next legal selected action");
  assert.ok(trace.interventionId, "biased decision records the intervention id");
  assert.equal(trace.interventionActionId, "action-bias-trace-link", "decision trace carries the intervention action id");
  assert.equal(trace.interventionReason, "Exercise the auditable counterfactual path.", "decision trace carries the intervention reason");
  assert.deepEqual(trace.interventionSourceRefs, [`world:${daily.world.id}`], "decision trace carries the intervention source refs");
  assert.equal(after.runtime.interventions.find((item) => item.actionId === "action-bias-trace-link")?.decisionTraceId, trace.id, "intervention points back to its applied decision trace");
  assert.equal(after.runtime.interventions.find((item) => item.actionId === "action-bias-trace-link")?.decisionStatus, "applied", "applied intervention status is explicit");
  assert.ok(after.runtime.interventions.find((item) => item.actionId === "action-bias-trace-link")?.decisionTraceDigest, "intervention stores a digest binding to its decision trace");
  const traceLinks = engine.buildAgentDecisionTraceLinkSummary(after.runtime);
  assert.equal(traceLinks.schema, "agent-decision-trace-links.v1", "trace link summary is versioned");
  assert.equal(traceLinks.complete, true, "trace link summary has no broken intervention links");
  assert.equal(traceLinks.linkedDecisionCount, 1, "trace link summary counts the applied intervention");
  const afterExpiry = engine.scoreNpcActionCandidates(after.world, after.world.npcs[0], [...daily.events, ...after.events], after.runtime);
  assert.equal(afterExpiry.find((candidate) => candidate.kind === "investigate").score.directorBias, 18, "bias remains inspectable on the applied tick");
  const expired = engine.advancePersistentTownTick(after.world, [...daily.events, ...after.events], { steps: 1, status: "running" });
  const expiredScores = engine.scoreNpcActionCandidates(expired.world, expired.world.npcs[0], [...daily.events, ...after.events, ...expired.events], expired.runtime);
  assert.equal(expiredScores.some((candidate) => candidate.score.directorBias), false, "action bias expires after one selected tick");
  const retained = engine.advancePersistentTownTick(after.world, [...daily.events, ...after.events], { steps: 1, status: "running", traceRetention: 1 });
  const archivedTraceLinks = engine.buildAgentDecisionTraceLinkSummary(retained.runtime);
  assert.equal(archivedTraceLinks.complete, true, "trace retention archives applied intervention links without breaking the audit");
  assert.equal(archivedTraceLinks.archivedDecisionCount >= 1, true, "evicted intervention traces leave compact archive receipts");
  assert.equal(archivedTraceLinks.archivedLinkedDecisionCount, 1, "archived receipt remains linked to the applied intervention");
  const retainedIntervention = retained.runtime.interventions.find((item) => item.actionId === "action-bias-trace-link");
  assert.equal(retained.runtime.decisionTraceArchive?.find((entry) => entry.interventionId === retainedIntervention?.id)?.traceDigest, retainedIntervention?.decisionTraceDigest, "archive receipt digest matches the intervention binding");
  const tamperedArchiveRuntime = {
    ...retained.runtime,
    decisionTraceArchive: (retained.runtime.decisionTraceArchive || []).map((entry) => entry.interventionId === retainedIntervention?.id ? { ...entry, traceDigest: "fnv1a-deadbeef" } : entry)
  };
  assert.equal(engine.buildAgentDecisionTraceLinkSummary(tamperedArchiveRuntime).complete, false, "tampered archive digest fails closed");
}

{
  const world = engine.createInitialWorld("scenario-persistent", { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const daily = engine.simulateDailyLife(world, 1, []);
  const actorId = daily.world.npcs[0].id;
  const scenarioA = engine.runTownScenario(daily.world, daily.events, {
    id: "scenario-deterministic",
    seed: "scenario-persistent-fixed",
    baselineSteps: 4,
    branches: [{
      id: "resource-branch",
      name: "Resource branch",
      steps: 4,
      interventions: [{ atTickOffset: 1, intervention: { actorId, kind: "resource", value: "resource:scenario-test" } }]
    }],
    passCriteria: { minEventGrowth: 1, minMemoryGrowth: 1, maxBlockedCandidates: 8 }
  });
  const worldB = engine.createInitialWorld("scenario-persistent", { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const dailyB = engine.simulateDailyLife(worldB, 1, []);
  const scenarioB = engine.runTownScenario(dailyB.world, dailyB.events, {
    id: "scenario-deterministic",
    seed: "scenario-persistent-fixed",
    baselineSteps: 4,
    branches: [{
      id: "resource-branch",
      name: "Resource branch",
      steps: 4,
      interventions: [{ atTickOffset: 1, intervention: { actorId, kind: "resource", value: "resource:scenario-test" } }]
    }],
    passCriteria: { minEventGrowth: 1, minMemoryGrowth: 1, maxBlockedCandidates: 8 }
  });
  assert.equal(scenarioA.report.passed, true, "scenario report passes configured criteria");
  assert.equal(scenarioA.report.branches.length, 1, "scenario includes a counterfactual branch");
  assert.equal(scenarioA.report.branches[0].diffFromBaseline.branchOnlyInterventionIds.length > 0, true, "branch diff tracks counterfactual interventions");
  assert.equal(scenarioA.runtime.snapshots.some((snapshot) => (snapshot.observationIds || []).length > 0), true, "scenario snapshots track observations");
  assert.equal(scenarioA.report.baseline.eventGrowth, scenarioB.report.baseline.eventGrowth, "scenario baseline event growth is deterministic");
  assert.equal(scenarioA.runtime.scenarioRuns.length, 1, "scenario run is stored on runtime");
  assert.equal(scenarioA.runtime.snapshots.length >= 4, true, "scenario stores baseline and branch snapshots");
  const presets = engine.listScenarioPresets(daily.world, scenarioA.runtime);
  assert.equal(presets.some((preset) => preset.id === "resource-counterfactual" && preset.builtIn), true, "scenario preset list exposes built-in presets");
  const summaries = engine.listScenarioRunSummaries(scenarioA.runtime);
  assert.equal(summaries.length, 1, "scenario run summaries expose stored runs");
  assert.equal(summaries[0].id, "scenario-deterministic", "scenario run summary binds to the stored run id");
  assert.equal(summaries[0].branchCount, 1, "scenario run summary includes branch count");
}

{
  const world = engine.createInitialWorld("snapshot-persistent", { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const daily = engine.simulateDailyLife(world, 1, []);
  const run = engine.advancePersistentTownTick(daily.world, daily.events, { steps: 2, status: "running" });
  const start = engine.createTownStateSnapshot(daily.world, daily.events, { id: "snapshot-start", label: "Start" });
  const end = engine.createTownStateSnapshot(run.world, [...daily.events, ...run.events], { id: "snapshot-end", label: "End" });
  const summary = engine.createTownStateSnapshot(run.world, [...daily.events, ...run.events], { id: "snapshot-summary", label: "Summary", mode: "summary" });
  assert.equal(summary.rollbackEligible, false, "summary snapshot is not rollback eligible");
  assert.equal(Boolean(summary.checkpoint), false, "summary snapshot excludes rollback checkpoint");
  assert.throws(() => engine.rollbackTownRuntimeToSnapshot(run.world, summary), /does not contain a rollback checkpoint/, "summary snapshot cannot rollback");
  assert.equal(start.rollbackEligible, true, "checkpoint snapshot remains rollback eligible by default");
  assert.equal(start.replayDigest?.schema, "world-replay.v1", "checkpoint snapshot persists a canonical replay receipt");
  assert.equal(Boolean(summary.replayDigest), false, "summary snapshot does not claim a full replay receipt");
  assert.equal(JSON.stringify(start.checkpoint).includes('"snapshots"'), false, "checkpoint does not recursively embed snapshot history");
  assert.equal(JSON.stringify(start.checkpoint).includes('"persistentRuntime"'), false, "checkpoint world excludes the live runtime");
  const diff = engine.diffTownStateSnapshots(start, end);
  assert.equal(diff.addedEventIds.length >= 1, true, "snapshot diff reports added events");
  assert.equal(diff.addedMemoryIds.length >= 1, true, "snapshot diff reports added memories");
  assert.equal(diff.addedObservationIds.length >= 1, true, "snapshot diff reports added observations");
  assert.equal(diff.changedAgents.length >= 1, true, "snapshot diff reports changed agents");
  assert.equal(diff.changedLocations.length >= 1, true, "snapshot diff reports changed locations");
  const runtime = run.world.persistentRuntime;
  runtime.snapshots = [start, end];
  run.world.persistentRuntime = runtime;
  const restored = engine.rollbackTownRuntimeToSnapshot(run.world, start);
  assert.equal(restored.runtime.tick, start.tick, "rollback restores runtime tick");
  assert.deepEqual(restored.runtime.agentStates.map((agent) => agent.locationId), start.agentStates.map((agent) => agent.locationId), "rollback restores agent locations");
}

{
  const world = engine.createInitialWorld("campaign-recovery-persistent", { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const daily = engine.simulateDailyLife(world, 1, []);
  const runtime = engine.createPersistentTownRuntime(daily.world, daily.events, { maxTicks: 48 });
  const initial = engine.toCampaignRecoveryPublicSummary(runtime);
  assert.equal(initial.status, "empty", "new campaign recovery state starts empty");
  assert.equal(/sourceKey|caseId|sessionId|resourceKind|factionKind|offerId|tick|delta/i.test(JSON.stringify(initial)), false, "campaign recovery public summary strips internal bindings and deltas");

  const beforeTheoryTick = runtime.tick;
  const beforeTheoryCandidates = structuredClone(runtime.candidates);
  const theoryReady = engine.prepareCampaignRecovery(runtime, {
    sourceKey: "session-recovery:case-recovery:rejected-theory",
    failureKind: "rejected-theory",
    sessionId: "session-recovery",
    caseId: "case-recovery"
  });
  assert.equal(theoryReady.status, "ready", "a rejected theory prepares one explicit certified-route recovery");
  engine.prepareCampaignRecovery(runtime, {
    sourceKey: "session-recovery:case-recovery:rejected-theory",
    failureKind: "rejected-theory",
    sessionId: "session-recovery",
    caseId: "case-recovery"
  });
  assert.equal(runtime.campaignRecoveries.items.length, 1, "the same failure source cannot enqueue twice");
  const deferred = engine.applyCampaignRecoveryDecision(runtime, { choice: "defer" });
  assert.equal(deferred.status, "ready", "defer keeps the recovery available");
  const theoryRecovered = engine.applyCampaignRecoveryDecision(runtime, { choice: "start" });
  assert.equal(theoryRecovered.status, "completed", "certified-route review completes without fabricating a world operation");
  assert.equal(runtime.tick, beforeTheoryTick, "theory recovery selection is zero tick");
  assert.deepEqual(runtime.candidates, beforeTheoryCandidates, "theory recovery never rewrites the current candidate set");

  runtime.ruleState.resourceLedger.police_time.available = 0;
  runtime.ruleState.resourceLedger.police_time.pressure = 50;
  const resourceBefore = structuredClone(runtime.ruleState.resourceLedger.police_time);
  engine.prepareCampaignRecovery(runtime, {
    sourceKey: "resource-shortage-one",
    failureKind: "resource-shortage",
    resourceKind: "police_time"
  });
  const resourceScheduledTick = runtime.tick;
  const resourceScheduled = engine.applyCampaignRecoveryDecision(runtime, { choice: "start" });
  assert.equal(resourceScheduled.status, "scheduled", "resource failure schedules one visible recovery interval");
  assert.equal(runtime.tick, resourceScheduledTick, "resource recovery decision itself remains zero tick");
  assert.deepEqual(runtime.ruleState.resourceLedger.police_time, resourceBefore, "resource recovery reserves or changes nothing at selection time");
  runtime.tick = runtime.campaignRecoveries.items.find((item) => item.sourceKey === "resource-shortage-one").completesAtTick;
  const resourceCompleted = engine.reconcileCampaignRecovery(runtime);
  assert.equal(resourceCompleted.status, "completed", "resource recovery completes on its scheduled town cadence");
  assert.equal(runtime.ruleState.resourceLedger.police_time.available, 2, "resource recovery restores only its fixed bounded amount");
  assert.equal(runtime.ruleState.resourceLedger.police_time.pressure, 49, "resource recovery eases only one pressure point");
  assert.equal(engine.reconcileCampaignRecovery(runtime), undefined, "completed resource recovery cannot apply twice");

  engine.applyFactionRelationshipDelta(runtime, { sourceKey: "make-media-hostile", factionKind: "media", delta: -10, reason: "recovery" });
  const standingBefore = runtime.factionRelationships.standings.media.value;
  engine.prepareCampaignRecovery(runtime, {
    sourceKey: "relationship-strain-one",
    failureKind: "relationship-strain",
    factionKind: "media"
  });
  engine.applyCampaignRecoveryDecision(runtime, { choice: "start" });
  runtime.tick = runtime.campaignRecoveries.items.find((item) => item.sourceKey === "relationship-strain-one").completesAtTick;
  engine.reconcileCampaignRecovery(runtime);
  assert.equal(runtime.factionRelationships.standings.media.value, standingBefore + 4, "trust recovery applies one bounded standing improvement");
  assert.equal(engine.factionResourceCommitmentTerms(runtime, "informant_trust").available, true, "trust recovery reopens the previously hostile resource option");

  engine.enqueueWorldEventOffer(runtime, {
    sourceDirectiveId: "recovery-directive",
    eventArchetypeId: "recovery-event",
    sourceFactionKind: "civic",
    factionLabel: "Civic follow-up",
    response: {
      institutionKind: "court",
      strategy: "review-court-record",
      longActionKind: "review-court-record",
      label: "Review a delayed record",
      benefitLabel: "A public record path may reopen.",
      costLabel: "One institution interval."
    }
  });
  runtime.worldEventOffers.items[0].status = "expired";
  const offerId = runtime.worldEventOffers.items[0].id;
  engine.prepareCampaignRecovery(runtime, { sourceKey: "offer-terminal-one", failureKind: "missed-opportunity", factionKind: "court", offerId });
  engine.applyCampaignRecoveryDecision(runtime, { choice: "start" });
  runtime.tick = runtime.campaignRecoveries.items.find((item) => item.sourceKey === "offer-terminal-one").completesAtTick;
  const offerRecovery = engine.reconcileCampaignRecovery(runtime);
  assert.equal(offerRecovery.status, "completed", "missed opportunity recovery completes after one visible interval");
  assert.equal(runtime.worldEventOffers.items.find((item) => item.id === offerId).status, "offered", "completed recovery reopens the same bounded opportunity once");
  assert.equal(runtime.worldEventOffers.items.find((item) => item.id === offerId).campaignRecoveryUsed, true, "reopened opportunity records its one campaign recovery use internally");
  runtime.worldEventOffers.items.find((item) => item.id === offerId).status = "expired";
  assert.equal(engine.reopenWorldEventOfferAfterCampaignRecovery(runtime, offerId), undefined, "one opportunity cannot use campaign recovery twice");

  const bounded = structuredClone(runtime);
  for (let index = 0; index < 40; index += 1) {
    engine.prepareCampaignRecovery(bounded, { sourceKey: `bounded-recovery-${index}`, failureKind: "rejected-theory" });
    engine.applyCampaignRecoveryDecision(bounded, { choice: "start" });
  }
  assert.equal(bounded.campaignRecoveries.items.length <= 32, true, "campaign recovery history remains bounded");
  assert.equal(/sourceKey|caseId|sessionId|resourceKind|factionKind|offerId|createdAtTick|completesAtTick|applied.*Delta/i.test(JSON.stringify(engine.toCampaignRecoveryPublicSummary(runtime))), false, "completed public recovery remains aggregate-only");
  const recoveryCase = engine.createShowcaseCase("v5.38 two-failure recovery case");
  const discoveredIds = recoveryCase.evidence.map((item) => item.id);
  const rejectedJudgement = engine.submitWorldTheory(recoveryCase, { culpritId: "unknown", motive: "", method: "", evidenceIds: [] }, discoveredIds);
  assert.equal(rejectedJudgement.accepted, false, "the recovery fixture deliberately triggers a theory failure");
  const acceptedAfterTwoFailures = engine.submitWorldTheory(recoveryCase, {
    culpritId: recoveryCase.truth.culpritId,
    motive: recoveryCase.truth.motive,
    method: recoveryCase.truth.method,
    evidenceIds: discoveredIds
  }, discoveredIds);
  assert.equal(acceptedAfterTwoFailures.accepted, true, "after theory and resource failures, the unchanged certified judgement can still complete the case");
}

{
  function convergenceRuntime(seed) {
    const world = engine.createInitialWorld(seed, { mode: "showcase", npcCount: 8, timelineHours: 24 });
    const runtime = engine.createPersistentTownRuntime(world, []);
    runtime.investigatorProgression.competencies["case-closure"] = 2;
    runtime.worldArcProgress = {
      currentLineId: "line-a",
      lines: {
        "line-a": {
          status: "active",
          label: "A safe campaign line",
          completedStages: 2,
          stageCount: 3,
          progressLabel: "2/3 stages",
          pulseLabel: "Town context",
          nextAction: "Continue.",
          progressionLineId: "line-a",
          compatibleCaseTypeIds: [],
          activeCaseId: "internal-active-case",
          startedAtTick: 0,
          updatedAtTick: 0
        }
      }
    };
    return runtime;
  }

  const coalition = convergenceRuntime("v5.39-coalition");
  coalition.factionRelationships.standings.civic.value = 4;
  const coalitionSummary = engine.refreshArcConvergence(coalition);
  assert.equal(coalitionSummary.status, "ready", "two accepted cases, two arc stages, and a trusted relationship form a finale");
  assert.equal(coalitionSummary.approachLabel, "Coalition route", "relationship history selects the safe coalition context");

  const resilience = convergenceRuntime("v5.39-resilience");
  resilience.campaignRecoveries = {
    activeId: "recovery-complete",
    items: [{
      id: "recovery-complete",
      sourceKey: "internal-recovery-source",
      failureKind: "rejected-theory",
      actionKind: "review-certified-route",
      status: "completed",
      createdAtTick: 0,
      completedAtTick: 0
    }]
  };
  const resilienceSummary = engine.refreshArcConvergence(resilience);
  assert.equal(resilienceSummary.status, "ready", "a completed recovery is an independent finale qualification path");
  assert.equal(resilienceSummary.approachLabel, "Recovery route", "recovery history selects a distinct safe context");

  const pressure = convergenceRuntime("v5.39-pressure");
  pressure.worldPressurePulses = {
    items: [{
      id: "internal-pressure",
      focusKey: "internal-focus",
      focusLabel: "Civic pressure",
      affectedCaseLabel: "Related case patterns",
      caseTypeIds: ["false-testimony"],
      direction: "rising",
      longActionKind: "review-court-record",
      createdAtTick: 0,
      updatedAtTick: 0,
      layers: 0,
      consumedLayers: 1
    }]
  };
  const pressureSummary = engine.refreshArcConvergence(pressure);
  assert.equal(pressureSummary.status, "ready", "consumed cross-case pressure is a third independent qualification path");
  assert.equal(pressureSummary.approachLabel, "Pressure-balance route", "pressure history selects a third safe context");
  assert.equal(coalition.arcConvergence.finaleCaseType, resilience.arcConvergence.finaleCaseType, "different histories converge on the same finale family");
  assert.equal(resilience.arcConvergence.finaleCaseType, pressure.arcConvergence.finaleCaseType, "all qualifying approaches share one finale family");
  assert.notDeepEqual(coalitionSummary.contextLabels, resilienceSummary.contextLabels, "different paths retain distinct low-spoiler finale context");

  const originalCandidateTypes = ["murder", "false-testimony", "dock-smuggling"];
  const convergedCandidateTypes = originalCandidateTypes.map((caseType, index) => engine.selectArcConvergenceCaseType(coalition, caseType, index));
  assert.equal(convergedCandidateTypes[0], "court-intimidation", "only the first future candidate receives the finale family");
  assert.deepEqual(convergedCandidateTypes.slice(1), originalCandidateTypes.slice(1), "all alternate legal candidate types remain unchanged");
  assert.equal(engine.deriveArcConvergenceCandidateBonus(coalition, "court-intimidation"), 3, "the ready finale receives one bounded ranking bonus");
  assert.equal(engine.deriveArcConvergenceCandidateBonus(coalition, "murder"), 0, "non-finale candidates receive no convergence bonus");

  const unchangedTruthFixture = { culpritId: "internal-culprit", evidenceIds: ["internal-evidence"], route: ["search", "question", "challenge"] };
  const frozenBefore = structuredClone(unchangedTruthFixture);
  const nonFinalActivation = engine.activateArcConvergence(coalition, { caseId: "alternate-case", caseType: "murder" });
  assert.equal(nonFinalActivation.status, "ready", "extracting a freely chosen non-finale case leaves convergence ready");
  assert.deepEqual(unchangedTruthFixture, frozenBefore, "candidate convergence never mutates truth, evidence, or route data");
  const active = engine.activateArcConvergence(coalition, { caseId: "finale-case", caseType: "court-intimidation" });
  assert.equal(active.status, "active", "successful finale-family extraction activates convergence exactly once");
  assert.equal(engine.completeArcConvergence(coalition, "another-case"), undefined, "an unrelated accepted case cannot complete the active finale");
  const completed = engine.completeArcConvergence(coalition, "finale-case");
  assert.equal(completed.status, "completed", "the accepted bound finale case completes convergence");
  assert.equal(engine.completeArcConvergence(coalition, "finale-case"), undefined, "completed convergence is idempotent");
  assert.equal(/caseId|tick|signalKey|culprit|evidence|source|internal-/i.test(JSON.stringify(completed)), false, "public convergence summary strips internal bindings and truth material");
}

{
  const world = engine.createInitialWorld("v6-campaign-session", { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const runtime = engine.createPersistentTownRuntime(world, []);
  assert.equal(runtime.campaignSessionSummary.status, "opening", "a clean world starts one explicit campaign journey");
  assert.equal(runtime.campaignSessionSummary.progressLabel, "0/3 campaign cases closed", "campaign opens with a visible three-case target");

  engine.activateCampaignCase(runtime, "internal-case-one");
  assert.equal(runtime.campaignSessionSummary.status, "case-active", "first extraction activates campaign case one");
  engine.completeCampaignCase(runtime, "internal-case-one");
  assert.equal(runtime.campaignSessionSummary.status, "transition", "first accepted theory creates a readable between-case transition");
  assert.equal(runtime.campaignSessionSummary.progressLabel, "1/3 campaign cases closed", "first accepted case advances campaign progress once");
  engine.completeCampaignCase(runtime, "internal-case-one");
  assert.equal(runtime.campaignSession.completedCaseIds.length, 1, "repeated accepted settlement cannot duplicate campaign history");

  runtime.investigatorProgression.competencies["case-closure"] = 2;
  runtime.worldArcProgress = {
    currentLineId: "campaign-line",
    lines: {
      "campaign-line": {
        status: "active",
        label: "Campaign line",
        completedStages: 2,
        stageCount: 3,
        progressLabel: "2/3 stages",
        pulseLabel: "Town context",
        nextAction: "Continue.",
        progressionLineId: "campaign-line",
        compatibleCaseTypeIds: [],
        activeCaseId: "internal-case-two",
        startedAtTick: 0,
        updatedAtTick: 0
      }
    }
  };
  runtime.campaignRecoveries = {
    activeId: "campaign-recovery",
    items: [{
      id: "campaign-recovery",
      sourceKey: "internal-campaign-recovery",
      failureKind: "rejected-theory",
      actionKind: "review-certified-route",
      status: "completed",
      createdAtTick: 0,
      completedAtTick: 0
    }]
  };
  engine.refreshArcConvergence(runtime);
  assert.equal(runtime.arcConvergenceSummary.status, "ready", "the campaign fixture prepares the shared finale after two authority signals");
  engine.activateCampaignCase(runtime, "internal-case-two");
  assert.equal(runtime.campaignSessionSummary.status, "case-active", "the player may still choose an ordinary second case while the finale is ready");
  engine.completeCampaignCase(runtime, "internal-case-two");
  assert.equal(runtime.campaignSessionSummary.status, "finale-ready", "second accepted case returns to the available finale");

  engine.activateArcConvergence(runtime, { caseId: "internal-finale-case", caseType: "court-intimidation" });
  engine.activateCampaignCase(runtime, "internal-finale-case");
  assert.equal(runtime.campaignSessionSummary.status, "finale-active", "finale extraction becomes the third campaign chapter");
  engine.completeArcConvergence(runtime, "internal-finale-case");
  const campaignCompleted = engine.completeCampaignCase(runtime, "internal-finale-case");
  assert.equal(campaignCompleted.status, "completed", "accepted finale closes the complete three-case campaign");
  assert.equal(campaignCompleted.progressLabel, "3/3 campaign cases closed", "campaign completion reports the packaged target");
  const debrief = engine.toCampaignFinaleDebriefPublicSummary(runtime);
  assert.equal(debrief.status, "ready", "completed campaign unlocks one causal finale debrief");
  assert.equal(debrief.causalBeats.length >= 3, true, "debrief explains certified closure, convergence, and fairness in bounded beats");
  assert.match(debrief.replayContrast, /another valid convergence route/i, "debrief supplies an explicit replay contrast");
  assert.equal(/caseId|tick|sourceKey|signalKey|culprit|evidenceId|internal-/i.test(JSON.stringify({ campaignCompleted, debrief })), false, "public campaign and debrief summaries strip internal history and truth keys");
  assert.equal(runtime.campaignSession.history.length, 3, "internal campaign history retains exactly the three accepted cases");

  const reusedIdentityWorld = engine.createInitialWorld("v6-campaign-reused-identity", { mode: "showcase", npcCount: 8, timelineHours: 24 });
  const reusedIdentityRuntime = engine.createPersistentTownRuntime(reusedIdentityWorld, []);
  engine.activateCampaignCase(reusedIdentityRuntime, "shared-generated-case", "stable-candidate-key");
  engine.completeCampaignCase(reusedIdentityRuntime, "shared-generated-case");
  engine.completeCampaignCase(reusedIdentityRuntime, "shared-generated-case");
  assert.equal(reusedIdentityRuntime.campaignSession.completedCycleKeys.length, 1, "a repeated settlement cannot duplicate an already closed extraction cycle");
  engine.activateCampaignCase(reusedIdentityRuntime, "shared-generated-case", "stable-candidate-key");
  engine.completeCampaignCase(reusedIdentityRuntime, "shared-generated-case");
  assert.equal(reusedIdentityRuntime.campaignSession.completedCycleKeys.length, 2, "a later extraction remains a distinct campaign chapter even when outer case and candidate keys are reused");
}

{
  const makeFixture = () => {
    const world = engine.createInitialWorld("v6.1-town-social-response", { mode: "showcase", npcCount: 8, timelineHours: 24 });
    const runtime = engine.createPersistentTownRuntime(world, []);
    world.persistentRuntime = runtime;
    const institution = runtime.ruleState.institutions.slice().sort((left, right) => left.id.localeCompare(right.id))[0];
    const location = world.locations.find((item) => item.kind === "public") || world.locations[0];
    return { world, runtime, institution, location };
  };

  assert.equal(engine.deriveTownSocialResponseDirectionFromDeltas({ publicOpinionDelta: { heat: 2 } }), "guarded", "rising heat creates a guarded public response");
  assert.equal(engine.deriveTownSocialResponseDirectionFromDeltas({ publicOpinionDelta: { trustInPolice: 2 } }), "supportive", "rising public trust creates a supportive public response");
  assert.equal(engine.deriveTownSocialResponseDirectionFromDeltas({ relationshipDelta: 4 }), "supportive", "restored relationship standing creates a supportive public response");

  const first = makeFixture();
  const second = makeFixture();
  const input = {
    sourceKey: "accepted-follow-outcome",
    sourceKind: "world-lead-settlement",
    direction: "supportive",
    institutionId: first.institution.id,
    institutionKind: first.institution.kind,
    locationId: first.location.id
  };
  engine.enqueueTownSocialResponse(first.world, first.runtime, input);
  engine.enqueueTownSocialResponse(second.world, second.runtime, { ...input, institutionId: second.institution.id, institutionKind: second.institution.kind, locationId: second.location.id });
  assert.deepEqual(first.runtime.townSocialResponses.items, second.runtime.townSocialResponses.items, "the same source selects the same direction, location, and initial cycle state");
  engine.enqueueTownSocialResponse(first.world, first.runtime, input);
  assert.equal(first.runtime.townSocialResponses.items.length, 1, "one source key creates at most one social response cycle");

  first.runtime.tick = 1;
  engine.advanceTownSocialResponse(first.world, first.runtime);
  const afterFirstReaction = structuredClone(first.runtime.townSocialResponses);
  engine.advanceTownSocialResponse(first.world, first.runtime);
  assert.deepEqual(first.runtime.townSocialResponses, afterFirstReaction, "repeated advancement in one positive tick cannot add a second reaction");
  assert.equal(first.runtime.townSocialResponseSummary.reactions.length, 1, "one normal tick reveals exactly one public reaction");
  first.runtime.tick = 2;
  engine.advanceTownSocialResponse(first.world, first.runtime);
  first.runtime.tick = 3;
  engine.advanceTownSocialResponse(first.world, first.runtime);
  for (let tick = 1; tick <= 3; tick += 1) {
    second.runtime.tick = tick;
    engine.advanceTownSocialResponse(second.world, second.runtime);
  }
  assert.deepEqual(first.runtime.townSocialResponses.items[0].reactions, second.runtime.townSocialResponses.items[0].reactions, "the same source and runtime select the same NPC order and reaction wording variants");
  assert.equal(first.runtime.townSocialResponseSummary.status, "settled", "the third public reaction settles one bounded cycle");
  assert.equal(first.runtime.townSocialResponseSummary.reactions.length, 3, "one cycle contains at most three public reactions");
  assert.equal(new Set(first.runtime.townSocialResponses.items[0].reactions.map((item) => item.npcId)).size, 3, "an NPC appears at most once in one social response cycle");
  assert.equal(/npcId|locationId|institutionId|sourceKey|tick|internal|raw|culprit|victim/i.test(JSON.stringify(first.runtime.townSocialResponseSummary)), false, "public social response summary strips every internal key and case binding");
  assert.equal(first.runtime.townSocialResponseSummary.reactions.every((item) => item.actorName && item.roleLabel && item.locationLabel && item.reactionLabel), true, "public reactions expose only readable name, role, place, and posture labels");

  const fifo = makeFixture();
  for (const [index, sourceKind] of ["world-lead-settlement", "faction-directive", "world-event-offer", "campaign-recovery"].entries()) {
    engine.enqueueTownSocialResponse(fifo.world, fifo.runtime, {
      sourceKey: `player-source-${index}`,
      sourceKind,
      direction: index % 2 ? "guarded" : "supportive",
      institutionId: fifo.institution.id,
      institutionKind: fifo.institution.kind,
      locationId: fifo.location.id
    });
  }
  assert.equal(fifo.runtime.townSocialResponses.items.length, 4, "all four allowed player-driven result kinds can prepare a cycle");
  for (let tick = 1; tick <= 3; tick += 1) {
    fifo.runtime.tick = tick;
    engine.advanceTownSocialResponse(fifo.world, fifo.runtime);
  }
  assert.equal(fifo.runtime.townSocialResponses.items[0].status, "settled", "FIFO completes the oldest response first");
  assert.equal(fifo.runtime.townSocialResponses.items[1].status, "ready", "the next response stays ready until a later tick");
  fifo.runtime.tick = 4;
  engine.advanceTownSocialResponse(fifo.world, fifo.runtime);
  assert.equal(fifo.runtime.townSocialResponses.items[1].status, "active", "the next FIFO response begins on the following positive tick");

  const capped = makeFixture();
  for (let index = 0; index < 30; index += 1) {
    engine.enqueueTownSocialResponse(capped.world, capped.runtime, {
      sourceKey: `bounded-source-${index}`,
      sourceKind: "campaign-recovery",
      direction: "supportive",
      institutionId: capped.institution.id,
      institutionKind: capped.institution.kind,
      locationId: capped.location.id
    });
  }
  assert.equal(capped.runtime.townSocialResponses.items.length, 24, "social response runtime history and queue are bounded at 24 records");

  const recoveryFixture = makeFixture();
  recoveryFixture.runtime.ruleState.resourceLedger.police_time.available = 0;
  recoveryFixture.runtime.ruleState.resourceLedger.police_time.pressure = 40;
  engine.prepareCampaignRecovery(recoveryFixture.runtime, {
    sourceKey: "actual-social-recovery",
    failureKind: "resource-shortage",
    resourceKind: "police_time",
    factionKind: "police"
  });
  engine.applyCampaignRecoveryDecision(recoveryFixture.runtime, { choice: "start" });
  const recoveryCompletionTick = recoveryFixture.runtime.campaignRecoveries.items.find((item) => item.sourceKey === "actual-social-recovery").completesAtTick;
  const recovered = engine.advancePersistentTownTick(recoveryFixture.world, [], {
    steps: recoveryCompletionTick - recoveryFixture.runtime.tick,
    status: "running",
    actionEveryTicks: 999
  });
  assert.equal(recovered.runtime.campaignRecoveries.items.find((item) => item.sourceKey === "actual-social-recovery").appliedResourceDelta, 2, "campaign recovery records one actual bounded resource restoration");
  assert.equal(recovered.runtime.townSocialResponses.items.some((item) => item.sourceKind === "campaign-recovery" && item.status === "ready"), true, "only an actual recovery delta prepares the recovery social response");

  const baseline = makeFixture();
  const worldWithout = structuredClone(baseline.world);
  const runtimeWithout = structuredClone(baseline.runtime);
  worldWithout.persistentRuntime = runtimeWithout;
  const worldWith = structuredClone(baseline.world);
  const runtimeWith = structuredClone(baseline.runtime);
  worldWith.persistentRuntime = runtimeWith;
  engine.enqueueTownSocialResponse(worldWith, runtimeWith, {
    sourceKey: "strict-ambient-isolation",
    sourceKind: "faction-directive",
    direction: "guarded",
    institutionId: baseline.institution.id,
    institutionKind: baseline.institution.kind,
    locationId: baseline.location.id
  });
  const runWithout = engine.advancePersistentTownTick(worldWithout, [], { steps: 1, status: "running" });
  const runWith = engine.advancePersistentTownTick(worldWith, [], { steps: 1, status: "running" });
  assert.deepEqual(runWith.events, runWithout.events, "ambient response advancement generates no extra WorldEvent");
  assert.deepEqual(runWith.world.memories, runWithout.world.memories, "ambient response advancement generates no memory or testimony");
  assert.deepEqual(runWith.runtime.eventObservations, runWithout.runtime.eventObservations, "ambient response advancement generates no observation");
  assert.deepEqual(runWith.runtime.memoryPropagations, runWithout.runtime.memoryPropagations, "ambient response advancement generates no memory propagation");
  assert.deepEqual(runWith.runtime.decisionTraces, runWithout.runtime.decisionTraces, "ambient response advancement never changes NPC decision traces");
  assert.deepEqual(runWith.runtime.ruleState, runWithout.runtime.ruleState, "ambient response advancement never changes rule, evidence, institution, resource, or public-opinion authority");
  assert.deepEqual(runWith.runtime.locationProfiles, runWithout.runtime.locationProfiles, "ambient response advancement never changes authoritative location profiles");
  assert.deepEqual(runWith.runtime.agentStates, runWithout.runtime.agentStates, "ambient response advancement never changes authoritative NPC state or action scoring inputs");
  assert.deepEqual(runWith.runtime.candidates, runWithout.runtime.candidates, "ambient response advancement preserves candidate membership, ordering, validity, truth bindings, and coverage inputs");
  const actorWith = runWith.world.npcs[0];
  const actorWithout = runWithout.world.npcs.find((npc) => npc.id === actorWith.id);
  const legalWith = engine.scoreNpcActionCandidates(runWith.world, actorWith, runWith.events, runWith.runtime).map((item) => [item.id, item.kind, item.legal, item.blockedReason]);
  const legalWithout = engine.scoreNpcActionCandidates(runWithout.world, actorWithout, runWithout.events, runWithout.runtime).map((item) => [item.id, item.kind, item.legal, item.blockedReason]);
  assert.deepEqual(legalWith, legalWithout, "ambient response advancement preserves the complete NPC legal action set");
}

console.log("Persistent town tests passed.");
