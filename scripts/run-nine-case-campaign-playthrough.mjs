import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";
import { startReleaseCandidateServer, waitForServer } from "./lib/release-candidate-server.mjs";

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
const baselineCampaigns = [
  { id: "town-reckoning", routeId: "baseline", routeLabel: "Civic Procedure", packageId: "city-hall-merchant-debt-town", finaleType: "court-intimidation", label: "Town Reckoning" },
  { id: "harbor-testimony", routeId: "baseline", routeLabel: "Cargo Testimony", packageId: "dock-court-market-town", finaleType: "dock-witness-swap", label: "Harbor Testimony" },
  { id: "clinic-headlines", routeId: "baseline", routeLabel: "Clinical Review", packageId: "hospital-family-press-town", finaleType: "medical-coverup", label: "Clinic Headlines" }
];
const counterCampaigns = [
  { id: "town-reckoning", routeId: "counter-route", routeLabel: "Merchant Leverage", packageId: "city-hall-merchant-debt-town", finaleType: "forged-will", label: "Town Reckoning" },
  { id: "harbor-testimony", routeId: "counter-route", routeLabel: "Chain Protection", packageId: "dock-court-market-town", finaleType: "evidence-tampering", label: "Harbor Testimony" },
  { id: "clinic-headlines", routeId: "counter-route", routeLabel: "Public Correction", packageId: "hospital-family-press-town", finaleType: "editorial-coercion", label: "Clinic Headlines" }
];
const midnightCampaigns = [
  { id: "midnight-chorus", routeId: "baseline", routeLabel: "Public Reckoning", packageId: "theatre-market-night-town", finaleType: "police-misjudgment", label: "Midnight Chorus" },
  { id: "midnight-chorus", routeId: "counter-route", routeLabel: "Backstage Compact", packageId: "theatre-market-night-town", finaleType: "missing-person", label: "Midnight Chorus" }
];
const campaigns = allRoutes
  ? [...baselineCampaigns, ...counterCampaigns, ...(includeMidnight ? midnightCampaigns : [])]
  : baselineCampaigns;

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

async function queueUntilValid(worldId, wantedCaseType) {
  let queue = await request(`/api/v1/query/town/candidates?worldId=${encodeURIComponent(worldId)}`);
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const valid = queue.candidates.filter((item) => item.validation?.valid);
    const targeted = wantedCaseType ? valid.find((item) => item.caseType === wantedCaseType) : undefined;
    if (targeted || (valid.length && !wantedCaseType)) return targeted || valid[0];
    await request("/api/v1/command/town/runtime/step", {
      method: "POST",
      body: JSON.stringify({ worldId, steps: 8 })
    });
    queue = await request(`/api/v1/query/town/candidates?worldId=${encodeURIComponent(worldId)}`);
  }
  throw new Error(`no ${wantedCaseType || "valid"} candidate reached the bounded playthrough window`);
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
      const recovery = await request("/api/v1/command/town/runtime/step", {
        method: "POST",
        body: JSON.stringify({ worldId, steps: 0, campaignRecoveryDecision: { choice: "start" } })
      });
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
  const created = await request("/api/v1/command/town/create", {
    method: "POST",
    body: JSON.stringify({ seed: `v75-nine-case-${definition.id}-${index}`, mode: "showcase", caseMode: "generated", npcCount: 20, timelineHours: 24 })
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
    const desired = ordinal === 3 ? definition.finaleType : undefined;
    if (ordinal > 1) await prepareHeadquarters(worldId, ordinal === 2 ? "field-search" : "evidence-handling");
    const candidate = await queueUntilValid(worldId, desired);
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
    if (ordinal < 3) assert.equal(solved.campaignSession.progressLabel, `${ordinal}/3 campaign cases closed`, `${definition.label} advances one chapter exactly once`);
    if (ordinal === 2 && solved.campaignSession.status !== "finale-ready") {
      const snapshot = await runtime(worldId);
      throw new Error(`v7.5 convergence did not become ready: arc=${snapshot.runtime.arcConvergenceSummary?.status || "missing"}, stages=${snapshot.runtime.arcConvergenceSummary?.worldProgressLabel || "missing"}, relationship=${snapshot.runtime.factionRelationshipSummary?.status || "missing"}/${snapshot.runtime.factionRelationshipSummary?.trustedCount || 0} trusted, directive=${snapshot.runtime.worldArcDirectiveSummary?.status || "missing"}/${snapshot.runtime.worldArcDirectiveSummary?.blockedCategory || "none"}, offer=${snapshot.runtime.worldEventOfferSummary?.status || "missing"}`);
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
      prefix: "rc-nine-case-playthrough",
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
  console.log(JSON.stringify({ ok: true, suite: includeMidnight ? "twenty-four-case-campaign-playthrough" : allRoutes ? "eighteen-case-campaign-playthrough" : "nine-case-campaign-playthrough", campaigns: reports, totalCases: expectedCases, strategicCommandCases: expectedCases, strategicPacingCases: expectedCases, districtFrontCases: expectedCases }));
} finally {
  await serverHarness?.cleanup();
  for (const artifact of strategicArtifacts) {
    try { fs.rmSync(artifact, { force: true }); } catch {}
  }
}
