import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";
import { loadEngineForTool } from "./load-engine-for-tools.mjs";
import { startReleaseCandidateServer, waitForServer } from "./lib/release-candidate-server.mjs";
import {
  buildCampaignEvidenceManifest,
  createCandidateRejectionAccumulator,
  recordCandidateRejections,
  summarizeCandidateRejections
} from "./v11-alpha-evidence-lib.mjs";

const externalBaseUrl = process.env.NINE_CASE_PLAYTHROUGH_BASE_URL?.replace(/\/$/, "") || "";
let baseUrl = externalBaseUrl;
let serverHarness;
const strategicArtifacts = [
  path.join(os.tmpdir(), `v80-presentation-${process.pid}.mjs`),
  path.join(os.tmpdir(), `v80-command-deck-${process.pid}.mjs`),
  path.join(os.tmpdir(), `v80-strategic-command-${process.pid}.mjs`),
  path.join(os.tmpdir(), `v81-strategic-pacing-${process.pid}.mjs`),
  path.join(os.tmpdir(), `v82-district-fronts-${process.pid}.mjs`)
];

function compileStrategicSource(sourceFile, outputFile, replacements = []) {
  let compiled = ts.transpileModule(fs.readFileSync(sourceFile, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  for (const [pattern, value] of replacements) compiled = compiled.replace(pattern, value);
  fs.writeFileSync(outputFile, compiled, "utf8");
}

function replaceUtf8FileAtomically(filePath, contents) {
  const nonce = `${process.pid}-${Date.now()}`;
  const temporaryPath = `${filePath}.tmp-${nonce}`;
  const backupPath = `${filePath}.bak-${nonce}`;
  let backupCreated = false;
  try {
    fs.writeFileSync(temporaryPath, contents, "utf8");
    if (fs.existsSync(filePath)) {
      fs.renameSync(filePath, backupPath);
      backupCreated = true;
    }
    try {
      fs.renameSync(temporaryPath, filePath);
    } catch (error) {
      if (backupCreated && !fs.existsSync(filePath)) fs.renameSync(backupPath, filePath);
      throw error;
    }
    if (backupCreated) fs.rmSync(backupPath, { force: true });
  } finally {
    fs.rmSync(temporaryPath, { force: true });
    if (backupCreated && fs.existsSync(backupPath) && !fs.existsSync(filePath)) {
      fs.renameSync(backupPath, filePath);
    }
  }
}

compileStrategicSource(path.join(process.cwd(), "app/campaign/presentation-feedback.ts"), strategicArtifacts[0]);
compileStrategicSource(path.join(process.cwd(), "app/campaign/command-deck-model.ts"), strategicArtifacts[1], [
  [/from "\.\/presentation-feedback"/g, `from "${pathToFileURL(strategicArtifacts[0]).href}"`]
]);
compileStrategicSource(path.join(process.cwd(), "app/campaign/strategic-command-model.ts"), strategicArtifacts[2], [
  [/from "\.\/command-deck-model"/g, `from "${pathToFileURL(strategicArtifacts[1]).href}"`]
]);
compileStrategicSource(path.join(process.cwd(), "app/campaign/strategic-pacing-model.ts"), strategicArtifacts[3]);
compileStrategicSource(path.join(process.cwd(), "app/campaign/district-strategic-front-model.ts"), strategicArtifacts[4]);
const { buildStrategicCommandViewModel, resolveStrategicActionDispatch } = await import(`${pathToFileURL(strategicArtifacts[2]).href}?run=${Date.now()}`);
const { buildStrategicPacingViewModel } = await import(`${pathToFileURL(strategicArtifacts[3]).href}?run=${Date.now()}`);
const { buildDistrictStrategicFrontsViewModel } = await import(`${pathToFileURL(strategicArtifacts[4]).href}?run=${Date.now()}`);

const allRoutes = process.argv.includes("--all-routes");
const includeMidnight = process.argv.includes("--include-midnight");
const allCampaigns = process.argv.includes("--all-campaigns");
const campaignFilter = process.argv.find((argument) => argument.startsWith("--campaign="))?.slice("--campaign=".length);
const routeFilter = process.argv.find((argument) => argument.startsWith("--route="))?.slice("--route=".length);
const candidateAttemptLimit = Number(process.env.CAMPAIGN_PLAYTHROUGH_ATTEMPTS || 14);
const seedSuffix = process.env.CAMPAIGN_PLAYTHROUGH_SEED_SUFFIX || "";
// A few newly-authored routes need a deterministic simulation seed that reaches
// their first real crime trigger inside the bounded 112-tick release window.
// This keeps the gate reproducible without weakening candidate validity.
const STABLE_SEED_SUFFIX_BY_ROUTE = Object.freeze({
  "floodgate-covenant/counter-route": "a",
  "midnight-chorus/counter-route": "a"
});
const evidenceOutputArgument = process.argv.find((argument) => argument.startsWith("--evidence-output="))?.slice("--evidence-output=".length);
const candidateRejections = createCandidateRejectionAccumulator();
const caseEvidenceRecords = [];
let playthroughFailure = null;
const registryEngine = await loadEngineForTool("campaign-playthrough-registry");
const registry = registryEngine.listDetectiveCampaignDefinitions();
const selectedDefinitions = (allCampaigns
  ? registry
  : registry.filter((definition) => ["town-reckoning", "harbor-testimony", "clinic-headlines", ...(includeMidnight ? ["midnight-chorus"] : [])].includes(definition.id)))
  .filter((definition) => !campaignFilter || definition.id === campaignFilter);
const campaigns = selectedDefinitions.flatMap((definition) => {
  const routes = (allRoutes ? definition.routes : definition.routes.slice(0, 1)).filter((route) => !routeFilter || route.id === routeFilter);
  return routes.map((route) => ({
    id: definition.id,
    routeId: route.id,
    routeLabel: route.label,
    packageId: definition.worldPackageIds[0],
    finaleType: route.chapters[2].preferredCaseTypes[0],
    label: definition.label
  }));
});
const suite = allCampaigns
  ? allRoutes ? "seventy-two-case-campaign-playthrough" : "twelve-campaign-baseline-smoke"
  : includeMidnight && allRoutes ? "twenty-four-case-campaign-playthrough" : allRoutes ? "eighteen-case-campaign-playthrough" : "nine-case-campaign-playthrough";
const evidenceOutputPath = evidenceOutputArgument
  ? path.resolve(evidenceOutputArgument)
  : allCampaigns && allRoutes
    ? path.join(process.cwd(), "outputs", "v11-alpha", "72-case-evidence-manifest.json")
    : "";

async function request(pathname, options = {}) {
  const { signal, ...requestOptions } = options;
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...requestOptions,
    headers: { "content-type": "application/json", ...(requestOptions.headers || {}) },
    signal: AbortSignal.any([AbortSignal.timeout(60_000), ...(signal ? [signal] : [])])
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.ok === false) {
    throw new Error(`${options.method || "GET"} ${pathname} failed: ${response.status} ${JSON.stringify(json)}`);
  }
  return json.data || json;
}

async function runtime(worldId) {
  return request(`/api/v1/query/town/runtime?worldId=${encodeURIComponent(worldId)}`);
}

function withoutProjectionTimestamps(value) {
  if (Array.isArray(value)) return value.map(withoutProjectionTimestamps);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== "updatedAt")
    .map(([key, item]) => [key, withoutProjectionTimestamps(item)]));
}

async function queueUntilValid(worldId, wantedCaseType, context) {
  const startedAt = performance.now();
  let queue = await request(`/api/v1/query/town/candidates?worldId=${encodeURIComponent(worldId)}`);
  for (let attempt = 0; attempt < candidateAttemptLimit; attempt += 1) {
    recordCandidateRejections(candidateRejections, { ...context, candidates: queue.candidates });
    const valid = queue.candidates.filter((item) => item.validation?.valid);
    const targeted = wantedCaseType ? valid.find((item) => item.caseType === wantedCaseType) : undefined;
    if (targeted || (valid.length && !wantedCaseType)) {
      return {
        candidate: targeted || valid[0],
        candidatePolls: attempt + 1,
        candidateWaitMs: Math.round(performance.now() - startedAt)
      };
    }
    await request("/api/v1/command/town/runtime/step", {
      method: "POST",
      body: JSON.stringify({ worldId, steps: 8 })
    });
    queue = await request(`/api/v1/query/town/candidates?worldId=${encodeURIComponent(worldId)}`);
  }
  const diagnostics = queue.candidates.slice(0, 8).map((candidate) => ({
    caseType: candidate.caseType,
    valid: candidate.validation?.valid,
    reasons: candidate.validation?.reasons || candidate.validation?.errors || candidate.validation?.warnings || []
  }));
  throw new Error(`${context.label}: no ${wantedCaseType || "valid"} candidate reached the bounded playthrough window; candidates=${JSON.stringify(diagnostics)}`);
}

async function prepareHeadquarters(worldId, preferredChoice) {
  const current = await runtime(worldId);
  if (current.runtime.investigatorHeadquartersSummary.status !== "ready") return current.runtime.investigatorHeadquartersSummary;
  const available = current.runtime.investigatorHeadquartersSummary.availableDirections || [];
  const direction = available.find((item) => item.choice === preferredChoice && item.available) || available.find((item) => item.available);
  assert.ok(direction, "Headquarters exposes at least one legal direction before extraction");
  const beforeTick = current.runtime.tick;
  const chosen = await request("/api/v1/command/town/runtime/step", {
    method: "POST",
    body: JSON.stringify({ worldId, steps: 0, investigatorHeadquartersDecision: { choice: direction.choice } })
  });
  assert.equal(chosen.runtime.tick, beforeTick, "Headquarters preparation is zero tick");
  assert.deepEqual(chosen.events, [], "Headquarters preparation creates no events");
  assert.equal(chosen.investigatorHeadquarters.status, "prepared", "Headquarters choice enters prepared state");
  return chosen.investigatorHeadquarters;
}

async function solveCase(worldId, extracted, label) {
  const joined = await request("/api/v1/command/player/join", {
    method: "POST",
    body: JSON.stringify({ worldId, caseId: extracted.activeCase.id, displayName: `v7.5 ${label}` })
  });
  const beforeTick = (await runtime(worldId)).runtime.tick;
  const options = (joined.playerResourceCommitment?.options || []).filter((item) => item.available).slice(0, 2).map((item) => item.lane);
  if (options.length) {
    const commitment = await request("/api/v1/command/town/runtime/step", {
      method: "POST",
      body: JSON.stringify({ worldId, steps: 0, playerResourceCommitmentDecision: { sessionId: joined.session.id, allocations: options } })
    });
    assert.equal(commitment.runtime.tick, beforeTick, "operations commitment is zero tick");
    assert.deepEqual(commitment.events, [], "operations commitment creates no events");
  }
  const followed = await request("/api/v1/command/town/runtime/step", {
    method: "POST",
    body: JSON.stringify({ worldId, steps: 0, worldLeadDecision: { sessionId: joined.session.id, action: "follow" } })
  });
  assert.equal(followed.worldLead.status, "followed", `${label} follows the authored World Lead`);
  const resolved = await request("/api/v1/command/town/runtime/step", {
    method: "POST",
    body: JSON.stringify({ worldId, steps: 0, worldLeadDecision: { sessionId: joined.session.id, action: "resolve" } })
  });
  assert.equal(resolved.worldLead.status, "resolved", `${label} resolves the World Lead without a tick`);
  assert.equal(resolved.worldLeadOutcome.status, "active", `${label} activates a bounded World Lead outcome`);
  const commandModel = buildStrategicCommandViewModel({
    runtimeMode: "server",
    hasWorld: true,
    hasCase: true,
    hasSession: true,
    judgementAccepted: false,
    advanceAvailable: true,
    caseLabel: extracted.activeCase.deductionCase.title,
    suggestedAction: { phase: "Search", title: "Continue certified investigation", detail: "Use the existing certified Search handler." },
    campaign: joined.campaignSession,
    worldLead: resolved.worldLead,
    operations: joined.playerResourceCommitment,
    selectedContext: { kind: "location", label: "Certified investigation location" },
    contextActions: [{ kind: "search", label: "Search certified location", detail: "Use the existing certified Search handler.", enabled: true, primary: true, handlerKey: "discoverSceneEvidence" }]
  });
  assert.equal(commandModel.primaryAction?.kind, "certified-investigation", `${label} exposes the certified investigation as the Strategic Command primary action`);
  assert.equal(commandModel.secondaryActions.length <= 3, true, `${label} caps Strategic Command secondary actions at three`);
  assert.equal(commandModel.resourceRibbon.length, 8, `${label} exposes the fixed Strategic Command resource ribbon`);
  assert.deepEqual(resolveStrategicActionDispatch(commandModel.primaryAction), { handler: "context-action", actionKind: "search" }, `${label} routes Strategic Command through the existing Search adapter`);
  const activeCaseBeforeFronts = structuredClone(extracted.activeCase);
  const runtimeBeforeFronts = await runtime(worldId);
  const districtFronts = buildDistrictStrategicFrontsViewModel(commandModel);
  const runtimeAfterFronts = await runtime(worldId);
  const investigationFront = districtFronts.fronts.find((front) => front.key === "investigation");
  assert.equal(districtFronts.fronts.length <= 3, true, `${label} caps District Operations at three fronts`);
  assert.equal(districtFronts.fronts.filter((front) => front.state === "current").length, 1, `${label} exposes exactly one current district front`);
  assert.ok(investigationFront?.action, `${label} maps the certified investigation to an existing front action`);
  assert.deepEqual(resolveStrategicActionDispatch(investigationFront.action), resolveStrategicActionDispatch(commandModel.primaryAction), `${label} preserves the existing certified handler and payload adapter through District Operations`);
  assert.deepEqual(extracted.activeCase, activeCaseBeforeFronts, `${label} leaves truth, evidence coverage, Route Certificate, and judgement inputs byte-equivalent`);
  assert.equal(runtimeAfterFronts.runtime.tick, runtimeBeforeFronts.runtime.tick, `${label} front derivation does not advance the authoritative tick`);
  assert.deepEqual(withoutProjectionTimestamps(runtimeAfterFronts.runtime), withoutProjectionTimestamps(runtimeBeforeFronts.runtime), `${label} front derivation leaves candidate ordering and NPC legal-action inputs unchanged apart from the read-projection timestamp`);
  const runtimeBeforePacing = await runtime(worldId);
  const inspectPacing = buildStrategicPacingViewModel({ command: commandModel });
  const executePacing = buildStrategicPacingViewModel({ command: commandModel, actionLifecycle: { state: "resolving", action: commandModel.primaryAction } });
  const resolvePacing = buildStrategicPacingViewModel({ command: commandModel, actionLifecycle: { state: "succeeded", action: commandModel.primaryAction } });
  const runtimeAfterPacing = await runtime(worldId);
  assert.equal(inspectPacing.phase, "inspect", `${label} enters Inspect for the selected certified context`);
  assert.equal(executePacing.phase, "execute", `${label} enters Execute without replacing the existing handler`);
  assert.equal(resolvePacing.phase, "resolve", `${label} enters Resolve after the safe frontend lifecycle result`);
  assert.equal(inspectPacing.primaryAction?.kind, "certified-investigation", `${label} keeps the certified investigation first in Now`);
  assert.equal(inspectPacing.queueGroups.now[0]?.kind, inspectPacing.primaryAction?.kind, `${label} keeps one primary action as the first Now item`);
  assert.equal(inspectPacing.secondaryActions.length <= 3, true, `${label} caps pacing secondary actions at three`);
  assert.deepEqual(Object.keys(commandModel.outcomeFeedback), ["immediate", "world", "next"], `${label} retains Immediate, World, and Next feedback layers`);
  assert.equal(resolvePacing.recentSafeOutcomes.length, 1, `${label} records one session-safe resolved outcome`);
  assert.equal(resolvePacing.recentSafeOutcomes[0].nextObjective, commandModel.outcomeFeedback.next.detail, `${label} carries the existing safe next objective into Resolve`);
  assert.equal(runtimeAfterPacing.runtime.tick, runtimeBeforePacing.runtime.tick, `${label} pacing derivation does not advance the authoritative tick`);
  assert.deepEqual(withoutProjectionTimestamps(runtimeAfterPacing.runtime), withoutProjectionTimestamps(runtimeBeforePacing.runtime), `${label} pacing derivation leaves Persistent Town, candidate inputs, and NPC action inputs unchanged apart from the read-projection timestamp`);
  const evidenceIds = extracted.activeCase.deductionCase.evidence.map((item) => item.id);
  const testimony = extracted.activeCase.testimonies.find((item) => item.contradictionEvidenceIds?.length > 0) || extracted.activeCase.testimonies[0];
  if (testimony) {
    await request("/api/v1/command/investigation/interrogate", {
      method: "POST",
      body: JSON.stringify({ sessionId: joined.session.id, characterId: testimony.characterId, question: "What did you observe during the incident window?", provider: "mock" })
    });
    const contradictionEvidenceId = testimony.contradictionEvidenceIds?.[0];
    if (contradictionEvidenceId) {
      await request("/api/v1/command/investigation/discover", {
        method: "POST",
        body: JSON.stringify({ sessionId: joined.session.id, evidenceId: contradictionEvidenceId })
      });
      await request("/api/v1/command/investigation/interrogate", {
        method: "POST",
        body: JSON.stringify({ sessionId: joined.session.id, characterId: testimony.characterId, question: "How does this evidence change your statement?", evidenceId: contradictionEvidenceId, provider: "mock" })
      });
    }
  }
  for (const evidenceId of evidenceIds) {
    await request("/api/v1/command/investigation/discover", {
      method: "POST",
      body: JSON.stringify({ sessionId: joined.session.id, evidenceId })
    });
  }
  // Exercise the explicit, non-authoritative correction path once per case.
  // Recovery remains Manual First: it only clears the bounded failure state;
  // the accepted theory below still supplies the complete proof.
  const nonCulprit = extracted.activeCase.deductionCase.characters.find((item) => item.id !== extracted.activeCase.deductionCase.truth.culpritId);
  if (nonCulprit) {
    const rejected = await request("/api/v1/command/investigation/submit-theory", {
      method: "POST",
      body: JSON.stringify({
        sessionId: joined.session.id,
        theory: { culpritId: nonCulprit.id, motive: "", method: "", evidenceIds: [] }
      })
    });
    assert.equal(rejected.judgement.accepted, false, `${label} keeps wrong theory as a correction path`);
    if (rejected.campaignRecovery?.status === "ready") {
      let recovery = await request("/api/v1/command/town/runtime/step", {
        method: "POST",
        body: JSON.stringify({ worldId, steps: 0, campaignRecoveryDecision: { choice: "start" } })
      });
      if (recovery.campaignRecovery.status === "scheduled") {
        recovery = await request("/api/v1/command/town/runtime/step", {
          method: "POST",
          body: JSON.stringify({ worldId, steps: 5 })
        });
      }
      assert.equal(recovery.campaignRecovery.status, "completed", `${label} completes explicit Manual First recovery`);
    }
  }
  const solved = await request("/api/v1/command/investigation/submit-theory", {
    method: "POST",
    body: JSON.stringify({
      sessionId: joined.session.id,
      theory: {
        culpritId: extracted.activeCase.deductionCase.truth.culpritId,
        motive: extracted.activeCase.deductionCase.truth.motive,
        method: extracted.activeCase.deductionCase.truth.method,
        evidenceIds
      }
    })
  });
  assert.equal(solved.judgement.accepted, true, `${label} closes through the authoritative certified theory`);
  assert.equal(solved.worldLeadOutcome.status, "settled", `${label} settles its reversible World Lead outcome`);
  assert.equal(solved.campaignSession.progressLabel.endsWith("campaign cases closed"), true, `${label} returns campaign progress`);
  const publicBlob = JSON.stringify({
    campaign: solved.campaignSession,
    debrief: solved.campaignFinaleDebrief,
    lead: solved.worldLeadOutcome,
    arc: solved.worldArc,
    headquarters: solved.investigatorHeadquarters,
    directive: solved.worldArcDirective
  });
  const forbiddenPublicTerms = ["caseId", "routeId", "sessionId", "sourceKey", "eventId", "npcId", "locationId", "institutionId", "resourceKind", "longActionKind", "tick", "culprit", "victim", "rawBody"];
  const matchedPublicTerms = forbiddenPublicTerms.filter((term) => publicBlob.toLowerCase().includes(term.toLowerCase()));
  assert.deepEqual(matchedPublicTerms, [], `${label} public summaries remain safe (matched ${matchedPublicTerms.join(", ")})`);
  const resolvedCommand = buildStrategicCommandViewModel({
    runtimeMode: "server",
    hasWorld: true,
    hasCase: true,
    hasSession: true,
    judgementAccepted: true,
    advanceAvailable: true,
    caseLabel: extracted.activeCase.deductionCase.title,
    suggestedAction: { phase: "Review", title: "Review the accepted case", detail: "Review the visible result and next objective." },
    campaign: solved.campaignSession,
    worldLead: solved.worldLead,
    worldArc: solved.worldArc,
    directive: solved.worldArcDirective
  });
  const acceptedPacing = buildStrategicPacingViewModel({ command: resolvedCommand, actionLifecycle: { state: "succeeded", action: commandModel.primaryAction } });
  assert.equal(acceptedPacing.phase, "resolve", `${label} accepted theory remains in Resolve until the next player decision`);
  assert.equal(acceptedPacing.recentSafeOutcomes[0]?.state, "succeeded", `${label} accepted theory exposes only a safe successful outcome`);
  return { ...solved, sessionId: joined.session.id, evidenceIds, strategicCommandVerified: true, strategicPacingVerified: true, districtFrontsVerified: true, pacingPhases: [inspectPacing.phase, executePacing.phase, resolvePacing.phase] };
}

async function runCampaign(definition, index) {
  console.error(`[campaign-playthrough] ${definition.label} / ${definition.routeLabel}`);
  const stableSuffix = seedSuffix || STABLE_SEED_SUFFIX_BY_ROUTE[`${definition.id}/${definition.routeId}`] || "";
  const created = await request("/api/v1/command/town/create", {
    method: "POST",
    body: JSON.stringify({ seed: `v11-alpha-${definition.id}-${definition.routeId}${stableSuffix ? `-${stableSuffix}` : ""}`, mode: "showcase", caseMode: "generated", npcCount: 20, timelineHours: 24 })
  });
  const worldId = created.world.id;
  const selected = await request("/api/v1/command/town/world-pack/select", {
    method: "POST",
    body: JSON.stringify({ worldId, packageId: definition.packageId, campaignRouteId: definition.routeId })
  });
  assert.equal(selected.campaignSession.campaignLabel, definition.label, `${definition.label} selection binds the expected campaign`);
  assert.equal(selected.campaignSession.routeLabel, definition.routeLabel, `${definition.label}/${definition.routeLabel} selection binds the expected authored route`);
  let started = await request("/api/v1/command/town/runtime/start", {
    method: "POST",
    body: JSON.stringify({ worldId, steps: 2 })
  });
  assert.equal(started.runtime.campaignSessionSummary.status, "opening", `${definition.label} starts at Campaign opening`);
  const cases = [];
  for (let ordinal = 1; ordinal <= 3; ordinal += 1) {
    const caseStartedAt = performance.now();
    try {
      const desired = ordinal === 3 ? definition.finaleType : undefined;
      if (ordinal > 1) await prepareHeadquarters(worldId, ordinal === 2 ? "field-search" : "evidence-handling");
      const queueResult = await queueUntilValid(worldId, desired, {
        campaign: definition.id,
        route: definition.routeId,
        ordinal,
        label: `${definition.label} / ${definition.routeLabel} / chapter ${ordinal}`
      });
      const candidate = queueResult.candidate;
      const extracted = await request("/api/v1/command/town/case/extract", {
        method: "POST",
        body: JSON.stringify({ worldId, candidateId: candidate.id })
      });
    assert.equal(extracted.activeCase.validation.valid, true, `${definition.label} case ${ordinal} passes route integrity`);
    if (ordinal === 1) {
      const lockedResponse = await fetch(`${baseUrl}/api/v1/command/town/world-pack/select`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ worldId, packageId: definition.packageId, campaignRouteId: definition.routeId === "baseline" ? "counter-route" : "baseline" }) });
      const lockedBody = await lockedResponse.json();
      assert.equal(lockedResponse.status, 409, `${definition.label}/${definition.routeLabel} rejects route switching after extraction`);
      assert.equal(lockedBody.error?.code, "CAMPAIGN_ROUTE_LOCKED", `${definition.label}/${definition.routeLabel} returns the stable route lock error`);
      assert.equal((await runtime(worldId)).runtime.campaignSessionSummary.routeLabel, definition.routeLabel, `${definition.label}/${definition.routeLabel} failed switch leaves the persisted route unchanged`);
    }
    if (ordinal === 3) {
      assert.equal(
        extracted.campaignSession.status,
        "finale-active",
        `${definition.label} activates its finale case (campaign=${extracted.campaignSession.status}, arc=${extracted.arcConvergence?.status || "missing"}, directive=${extracted.worldArcDirective?.status || "missing"})`
      );
    }
      const solved = await solveCase(worldId, extracted, `${definition.label} / case ${ordinal}`);
      cases.push({ ordinal, candidate, extracted, solved });
      caseEvidenceRecords.push({
        campaign: definition.id,
        route: definition.routeId,
        ordinal,
        durationMs: Math.round(performance.now() - caseStartedAt),
        candidatePolls: queueResult.candidatePolls,
        candidateWaitMs: queueResult.candidateWaitMs,
        status: "automated-pass",
        safeSummary: "Certified investigation route completed with an accepted local judgement."
      });
      if (ordinal < 3) assert.equal(solved.campaignSession.progressLabel, `${ordinal}/3 campaign cases closed`, `${definition.label} advances one chapter exactly once`);
      if (ordinal === 2 && solved.campaignSession.status !== "finale-ready") {
        const snapshot = await runtime(worldId);
        throw new Error(`v7.5 convergence did not become ready: arc=${snapshot.runtime.arcConvergenceSummary?.status || "missing"}, stages=${snapshot.runtime.arcConvergenceSummary?.worldProgressLabel || "missing"}, relationship=${snapshot.runtime.factionRelationshipSummary?.status || "missing"}/${snapshot.runtime.factionRelationshipSummary?.trustedCount || 0} trusted, directive=${snapshot.runtime.worldArcDirectiveSummary?.status || "missing"}/${snapshot.runtime.worldArcDirectiveSummary?.blockedCategory || "none"}, offer=${snapshot.runtime.worldEventOfferSummary?.status || "missing"}`);
      }
    } catch (error) {
      if (!caseEvidenceRecords.some((item) => item.campaign === definition.id && item.route === definition.routeId && item.ordinal === ordinal)) {
        caseEvidenceRecords.push({
          campaign: definition.id,
          route: definition.routeId,
          ordinal,
          durationMs: Math.round(performance.now() - caseStartedAt),
          candidatePolls: 0,
          candidateWaitMs: 0,
          status: "failed",
          safeSummary: "Certified investigation route did not complete inside the bounded playthrough."
        });
      }
      throw error;
    }
  }
  const final = cases.at(-1).solved;
  assert.equal(final.campaignSession.status, "completed", `${definition.label} completes after three accepted cases`);
  assert.equal(final.campaignSession.progressLabel, "3/3 campaign cases closed", `${definition.label} reaches the authored target count`);
  assert.equal(final.campaignFinaleDebrief.status, "ready", `${definition.label} exposes a safe finale debrief`);
  assert.equal(final.arcConvergence.status, "completed", `${definition.label} completes Arc convergence`);
  const persisted = await runtime(worldId);
  assert.equal(persisted.runtime.campaignSessionSummary.status, "completed", `${definition.label} persists completed Campaign state`);
  assert.equal(persisted.runtime.campaignSession, undefined, `${definition.label} public runtime strips internal Campaign history`);
  assert.equal(persisted.runtime.investigatorHeadquarters, undefined, `${definition.label} public runtime strips internal Headquarters state`);
  await request("/api/v1/command/town/runtime/reset", { method: "POST", body: JSON.stringify({ worldId }) });
  return {
    campaign: definition.id,
    route: definition.routeLabel,
    label: definition.label,
    caseCount: cases.length,
    caseTitles: cases.map((item) => item.extracted.activeCase.deductionCase.title),
    chapterLabels: cases.map((item) => item.extracted.campaignSession.chapterLabel),
    finalStatus: final.campaignSession.status,
    finaleStatus: final.arcConvergence.status,
    strategicCommandCases: cases.filter((item) => item.solved.strategicCommandVerified).length,
    strategicPacingCases: cases.filter((item) => item.solved.strategicPacingVerified).length,
    districtFrontCases: cases.filter((item) => item.solved.districtFrontsVerified).length,
    pacingPhases: [...new Set(cases.flatMap((item) => item.solved.pacingPhases))]
  };
}

try {
  if (externalBaseUrl) {
    await waitForServer(baseUrl, { pathName: "/api/v1/query/runtime/status", timeoutMs: 45_000 });
  } else {
    serverHarness = await startReleaseCandidateServer({
      prefix: "rc-campaign-playthrough",
      healthPath: "/api/v1/query/runtime/status",
      env: { AI_PROVIDER: "mock", DEEPSEEK_API_KEY: "", SILICONFLOW_API_KEY: "" }
    });
    baseUrl = serverHarness.baseUrl;
  }
  const reports = [];
  for (let index = 0; index < campaigns.length; index += 1) reports.push(await runCampaign(campaigns[index], index));
  const expectedCases = campaigns.length * 3;
  assert.equal(reports.reduce((sum, item) => sum + item.caseCount, 0), expectedCases, `all selected routes complete exactly ${expectedCases} authored cases`);
  assert.equal(reports.reduce((sum, item) => sum + item.strategicCommandCases, 0), expectedCases, `all ${expectedCases} cases expose the Strategic Command primary route`);
  assert.equal(reports.reduce((sum, item) => sum + item.strategicPacingCases, 0), expectedCases, `all ${expectedCases} cases expose the Strategic Pacing lifecycle without authority writes`);
  assert.equal(reports.reduce((sum, item) => sum + item.districtFrontCases, 0), expectedCases, `all ${expectedCases} cases expose District Operations without authority writes`);
  console.log(JSON.stringify({ ok: true, suite, campaignCount: new Set(reports.map((item) => item.campaign)).size, routeCount: reports.length, campaigns: reports, totalCases: expectedCases, strategicCommandCases: expectedCases, strategicPacingCases: expectedCases, districtFrontCases: expectedCases }));
} catch (error) {
  playthroughFailure = error;
  throw error;
} finally {
  if (evidenceOutputPath) {
    const manifest = buildCampaignEvidenceManifest({
      suite,
      command: "npm.cmd run test:seventy-two-case-campaign -- --json",
      expectedCampaigns: new Set(campaigns.map((item) => item.id)).size,
      expectedRoutes: campaigns.length,
      expectedCases: campaigns.length * 3,
      cases: caseEvidenceRecords,
      candidateRejections: summarizeCandidateRejections(candidateRejections),
      candidateAttemptLimit,
      stableRouteSuffixes: STABLE_SEED_SUFFIX_BY_ROUTE,
      failure: playthroughFailure ? "Playthrough terminated before the complete matrix passed." : null
    });
    fs.mkdirSync(path.dirname(evidenceOutputPath), { recursive: true });
    replaceUtf8FileAtomically(evidenceOutputPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.error(`[campaign-playthrough] alpha evidence: ${path.relative(process.cwd(), evidenceOutputPath)}`);
  }
  await serverHarness?.cleanup();
  for (const artifact of strategicArtifacts) {
    try { fs.rmSync(artifact, { force: true }); } catch {}
  }
}
