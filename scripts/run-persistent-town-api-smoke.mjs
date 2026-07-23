import { spawn, spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const port = Number(process.env.PERSISTENT_TOWN_API_SMOKE_PORT || 3102);
let baseUrl = process.env.PERSISTENT_TOWN_API_BASE_URL || `http://127.0.0.1:${port}`;
const serverOutput = [];
const smokeTimeout = setTimeout(() => {
  console.error(`Persistent town Agent API smoke test timed out at ${baseUrl}.`);
  process.exit(1);
}, 180_000);

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) }
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.ok === false) {
    throw new Error(`${options.method || "GET"} ${path} failed: ${response.status} ${JSON.stringify(json)}`);
  }
  return json.data || json;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      await fetch(`${baseUrl}/api/v1/query/runtime/status`);
      return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error(`server did not start at ${baseUrl}\n${serverOutput.slice(-20).join("\n")}`);
}

const server = process.env.PERSISTENT_TOWN_API_BASE_URL
  ? null
  : spawn(process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "npm", process.platform === "win32" ? ["/c", "npm", "run", "dev", "--", "-p", String(port)] : ["run", "dev", "--", "-p", String(port)], {
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
      env: { ...process.env, PORT: String(port), AI_PROVIDER: "mock", DEEPSEEK_API_KEY: "", SILICONFLOW_API_KEY: "" }
    });

server?.stdout.on("data", (chunk) => serverOutput.push(String(chunk).trim()));
server?.stderr.on("data", (chunk) => serverOutput.push(String(chunk).trim()));

try {
  await waitForServer();
  const explicitCreated = await request("/api/v1/command/town/create", {
    method: "POST",
    body: JSON.stringify({ seed: "persistent-api-smoke-explicit", mode: "showcase", caseMode: "generated", npcCount: 8, timelineHours: 24 })
  });
  assert.equal(explicitCreated.world.npcs.length, 8, "explicit generated npcCount is preserved");

  const created = await request("/api/v1/command/town/create", {
    method: "POST",
    body: JSON.stringify({ seed: "persistent-api-smoke", mode: "showcase", caseMode: "generated", timelineHours: 24 })
  });
  const worldId = created.world.id;
  assert.ok(worldId, "world id is returned");
  assert.equal(created.world.npcs.length, 20, "generated server town defaults to 20 NPCs");

  const started = await request("/api/v1/command/town/runtime/start", {
    method: "POST",
    body: JSON.stringify({ worldId, steps: 2 })
  });
  assert.equal(started.runtime.status, "running", "runtime starts running");
  assert.equal(started.runtime.agentStates.length, 20, "runtime creates 20 agent states by default");
  assert.equal(started.runtime.socialProfiles.length, 20, "runtime exposes one social profile per generated NPC");
  assert.equal(started.runtime.locationProfiles.length > 0, true, "runtime exposes location pressure profiles");
  assert.ok(started.runtime.agentStates[0].socialProfile?.dominantTrait, "agent states expose social profile summaries");
  assert.ok(started.runtime.decisionTraces.length > 0, "runtime creates decisions");
  assert.ok(started.runtime.decisionTraces[0].phases?.includes("extract-candidates"), "decision traces expose simulation phases");
  assert.ok(started.runtime.decisionTraces[0].observationIds?.length, "decision traces expose event observations");
  assert.ok(started.runtime.eventObservations?.length > 0, "runtime exposes event observation index");
  assert.ok(started.runtime.relationshipLedger?.length > 0, "runtime exposes relationship ledger changes");
  assert.ok(started.runtime.locationLedger?.length > 0, "runtime exposes location ledger changes");
  assert.ok(started.runtime.decisionTraces[0].consequence?.actionKind, "decision traces expose action consequences");
  assert.ok(started.runtime.decisionTraces[0].consequence?.socialShift, "decision traces expose social consequences");

  const stepped = await request("/api/v1/command/town/runtime/step", {
    method: "POST",
    body: JSON.stringify({ worldId, steps: 5 })
  });
  assert.ok(stepped.queue.candidates.length > 0, "step returns candidates");

  const agents = await request(`/api/v1/query/town/agents?worldId=${encodeURIComponent(worldId)}`);
  assert.ok(agents.agents.length > 0, "agents query returns states");
  assert.ok("propagatedMemoryCount" in agents.agents[0], "agent states expose propagated memory count");
  const actorId = agents.agents[0].npcId;

  const agent = await request(`/api/v1/query/town/agent?worldId=${encodeURIComponent(worldId)}&npcId=${encodeURIComponent(actorId)}`);
  assert.ok(agent.candidates.length >= 3, "agent query returns action candidates");
  assert.ok(Number.isFinite(agent.candidates[0].score.socialAffinity), "agent query exposes social action affinity");
  assert.ok(Number.isFinite(agent.candidates[0].score.locationHeat), "agent query exposes location heat scoring");
  assert.ok(agent.candidates.some((candidate) => ["investigate", "spread-rumor", "seek-alibi", "pressure", "cover-up"].includes(candidate.kind)), "agent query returns core simulation actions");

  const brief = await request(`/api/v1/query/town/brief?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(brief.brief.worldId, worldId, "town brief returns the selected world");
  assert.ok(brief.brief.hotLocations.length > 0, "town brief ranks hot locations");
  assert.ok(brief.brief.riskAgents.length > 0, "town brief ranks high-risk agents");
  assert.ok(Array.isArray(brief.brief.recentSignals), "town brief exposes compact signals");
  assert.equal(brief.brief.arcConvergence.status, "locked", "fresh Server Runtime exposes a safe locked convergence summary");
  assert.equal(brief.brief.campaignSession.status, "opening", "fresh Server Runtime opens one safe three-case campaign journey");
  assert.equal(/caseId|tick|signalKey|sourceKey|culprit|evidenceId|internal-/i.test(JSON.stringify(brief.brief.arcConvergence)), false, "Situation Brief convergence omits internal bindings and truth material");

  const biased = await request("/api/v1/command/town/agent/intervene", {
    method: "POST",
    body: JSON.stringify({ worldId, intervention: { actorId, kind: "action-bias", value: "investigate" } })
  });
  assert.equal(biased.intervention.kind, "action-bias", "action bias intervention is accepted");
  const biasedAgent = await request(`/api/v1/query/town/agent?worldId=${encodeURIComponent(worldId)}&npcId=${encodeURIComponent(actorId)}`);
  assert.equal(
    biasedAgent.candidates.find((candidate) => candidate.kind === "investigate")?.score?.directorBias,
    18,
    "agent query exposes director action bias score"
  );

  const intervened = await request("/api/v1/command/town/agent/intervene", {
    method: "POST",
    body: JSON.stringify({ worldId, intervention: { actorId, kind: "resource", value: "resource:api-smoke" } })
  });
  assert.equal(intervened.intervention.branch, "counterfactual", "intervention is counterfactual");

  let candidateQueue = await request(`/api/v1/query/town/candidates?worldId=${encodeURIComponent(worldId)}`);
  let candidate = candidateQueue.candidates.find((item) => item.validation?.valid) || candidateQueue.candidates[0];
  for (let attempt = 0; attempt < 5 && !candidate?.validation?.valid; attempt += 1) {
    await request("/api/v1/command/town/runtime/step", {
      method: "POST",
      body: JSON.stringify({ worldId, steps: 8 })
    });
    candidateQueue = await request(`/api/v1/query/town/candidates?worldId=${encodeURIComponent(worldId)}`);
    candidate = candidateQueue.candidates.find((item) => item.validation?.valid) || candidateQueue.candidates[0];
  }
  assert.ok(candidate.id, "candidate id is available");
  assert.equal(candidate.validation.valid, true, "at least one valid candidate emerges before extraction");
  assert.ok(candidate.triggeredEventId, "valid candidate is backed by a real triggered case event");
  assert.equal(Object.values(candidate.chainCompleteness || {}).every(Boolean), true, "candidate exposes complete six-stage chain");
  assert.equal(candidate.validation.memoryConfidence.supportScore >= 55, true, "candidate exposes weighted memory support");
  assert.equal(candidate.validation.observationSupport.supportScore >= 55, true, "candidate exposes observation-backed support");
  assert.ok(Array.isArray(candidate.chainStageTags), "candidate exposes chain stage tags");
  assert.ok(Array.isArray(candidate.validation.failureReasons), "candidate exposes validation failure reasons");

  const proof = await request(`/api/v1/query/town/emergence-proof?worldId=${encodeURIComponent(worldId)}&candidateId=${encodeURIComponent(candidate.id)}`);
  assert.equal(proof.candidate.id, candidate.id, "proof returns selected candidate");

  const extracted = await request("/api/v1/command/town/case/extract", {
    method: "POST",
    body: JSON.stringify({ worldId, candidateId: candidate.id })
  });
  assert.ok(extracted.activeCase.id, "case extraction returns active case");
  assert.equal(extracted.activeCase.validation.valid, true, "extracted case validates");
  assert.ok(extracted.playableIntake?.caseId, "case extraction returns playable intake");
  assert.equal(extracted.playableIntake.caseId, extracted.activeCase.id, "playable intake binds to extracted case");
  assert.equal(extracted.playableIntake.sourceCandidateId, candidate.id, "playable intake preserves source candidate id");
  assert.equal(extracted.playableIntake.chainStages.filter((stage) => stage.complete).length >= 6, true, "playable intake exposes complete chain stages");
  assert.ok(extracted.playableIntake.starterTasks.length >= 5, "playable intake exposes starter tasks");
  assert.ok(extracted.playableIntake.evidenceRoute.length >= 5, "playable intake exposes evidence route");
  assert.ok(extracted.playableIntake.witnessPlan.length > 0, "playable intake exposes witness plan");
  assert.equal(extracted.playableIntake.routeIntegrity.playable, true, "playable intake exposes passing route integrity");
  assert.equal(extracted.playableIntake.progress.currentStage, "join", "playable intake exposes player progress");
  assert.equal(extracted.playableIntake.progress.coachStage, "join", "playable intake exposes coach progress");
  assert.equal(extracted.playableIntake.nextAction.kind, "join", "playable intake exposes next action");
  assert.equal(extracted.playableIntake.coach.stage, "join", "playable intake exposes investigation coach");
  assert.equal(extracted.playableIntake.coach.coverage.routeCertified, true, "coach reports route certificate state");
  assert.equal(extracted.playableIntake.coach.coverage.autoSolvePassed, true, "coach reports auto-solve state");
  assert.equal(extracted.worldArc.status, "active", "successful extraction binds a case-scoped world arc");
  assert.equal(extracted.worldArc.completedStages, 0, "new case-scoped world arc starts before its first accepted lead outcome");
  assert.equal(["locked", "forming"].includes(extracted.arcConvergence.status), true, "case extraction returns the safe campaign convergence state");
  assert.equal(extracted.campaignSession.status, "case-active", "first successful extraction activates campaign case one");
  assert.equal(extracted.campaignSession.progressLabel, "0/3 campaign cases closed", "campaign extraction exposes only bounded progress");
  assert.equal(/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:case|evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(JSON.stringify(extracted.worldArc)), false, "world arc extraction summary omits raw ids and sources");
  assert.equal(JSON.stringify(extracted.playableIntake).includes(extracted.activeCase.deductionCase.truth.culpritId), false, "playable intake does not leak culprit id before solve");
  assert.equal(extracted.activeCase.triggeredEventId, candidate.triggeredEventId, "extracted case preserves the triggered event id");
  assert.equal(extracted.activeCase.sourceCandidateId, candidate.id, "extracted case preserves the source candidate id");
  assert.equal(extracted.events.filter((event) => event.type === "death").length, 1, "extraction response contains one selected death event");
  assert.equal(extracted.activeCase.qualityReport.worldBackedEvidence, true, "extracted case keeps world-backed evidence quality");
  assert.equal(extracted.activeCase.qualityReport.nonCulpritExcluded, true, "extracted case excludes non-culprits");
  assert.equal(extracted.activeCase.qualityReport.reasoningTraceComplete, true, "extracted case has complete reasoning trace");
  for (const evidenceId of ["ev-motive", "ev-means", "ev-opportunity", "ev-staging", "ev-trace", "ev-town-rollcall"]) {
    assert.ok(extracted.activeCase.sourceMap.evidenceSourceEventIds?.[evidenceId]?.length, `${evidenceId} maps to original persistent source events`);
  }
  assert.ok(extracted.activeCase.sourceMap.memorySourceIds?.length, "extracted case exposes memory source ids");
  assert.ok(extracted.activeCase.sourceMap.observationSourceIds?.length, "extracted case exposes observation source ids");

  const queriedCase = await request(`/api/v1/query/case?caseId=${encodeURIComponent(extracted.activeCase.id)}&includeIntake=true`);
  assert.equal(queriedCase.caseFromLog.id, extracted.activeCase.id, "case query returns saved extracted case");
  assert.equal(queriedCase.playableIntake.caseId, extracted.activeCase.id, "case query can rebuild playable intake");
  assert.equal(queriedCase.playableIntake.routeIntegrity.playable, true, "case query rebuilds route integrity");
  assert.equal(queriedCase.playableIntake.routeIntegrity.proofLedgerValid, true, "case query rebuilds truth-ledger route validity");
  assert.ok(queriedCase.playableIntake.proofCoverage.totalRequired >= 8, "case query returns proof coverage in intake");
  assert.ok(queriedCase.playableIntake.nextAction.buttonLabel, "case query rebuilds next action");
  assert.equal(queriedCase.playableIntake.nextAction.coachStepId, queriedCase.playableIntake.coach.nextStep.id, "case query next action is backed by coach");
  assert.equal(queriedCase.playableIntake.coach.stage, "join", "case query rebuilds coach state");
  assert.equal(JSON.stringify(queriedCase.playableIntake.coach).includes(extracted.activeCase.deductionCase.truth.culpritId), false, "case query coach stays low-spoiler before solve");

  const proofLedger = await request(`/api/v1/query/case/proof-ledger?caseId=${encodeURIComponent(extracted.activeCase.id)}&includeCertificate=true`);
  assert.equal(proofLedger.ledger.caseId, extracted.activeCase.id, "proof ledger query returns the saved case ledger");
  assert.equal(proofLedger.ledger.valid, true, "proof ledger query validates extracted case");
  assert.ok(proofLedger.ledger.obligations.some((item) => item.kind === "conclusion"), "proof ledger query includes conclusion obligations");
  assert.ok(proofLedger.coverage.gaps.length, "proof ledger query exposes sessionless coverage gaps");
  assert.equal(proofLedger.certificate.routeCertified, true, "proof ledger query can include route certificate");
  assert.equal(proofLedger.certificate.steps.some((item) => item.evidenceIds.length > 0), false, "sessionless route certificate hides evidence ids");
  assert.equal(JSON.stringify(proofLedger).includes(extracted.activeCase.deductionCase.truth.culpritId), false, "sessionless proof ledger query stays low-spoiler");

  const stateBeforeAutoSolve = await request(`/api/v1/query/world/state?worldId=${encodeURIComponent(worldId)}`);
  const sessionCountBeforeAutoSolve = stateBeforeAutoSolve.sessions.length;
  const autoSolveDryRun = await request("/api/v1/command/investigation/autosolve", {
    method: "POST",
    body: JSON.stringify({ caseId: extracted.activeCase.id })
  });
  assert.equal(autoSolveDryRun.summary.passed, true, "auto-solve dry-run passes extracted case");
  assert.equal(autoSolveDryRun.summary.routeCertified, true, "auto-solve dry-run reports route certificate");
  assert.equal(autoSolveDryRun.summary.autoTheoryAccepted, true, "auto-solve dry-run reports accepted theory");
  assert.equal(autoSolveDryRun.summary.proofCoverageComplete, true, "auto-solve dry-run closes proof coverage");
  assert.equal(JSON.stringify(autoSolveDryRun).includes(extracted.activeCase.deductionCase.truth.culpritId), false, "default auto-solve response stays low-spoiler");
  const stateAfterDryRun = await request(`/api/v1/query/world/state?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(stateAfterDryRun.sessions.length, sessionCountBeforeAutoSolve, "auto-solve dry-run does not persist a session");

  const autoSolvePersistedSession = await request("/api/v1/command/investigation/autosolve", {
    method: "POST",
    body: JSON.stringify({ caseId: extracted.activeCase.id, persist: true, includeSession: true })
  });
  assert.equal(autoSolvePersistedSession.summary.passed, true, "persisted auto-solve summary passes with includeSession");
  assert.equal(autoSolvePersistedSession.session.playerId, "auto-player", "includeSession returns the persisted auto-player session");
  assert.equal(autoSolvePersistedSession.session.judgement.accepted, true, "includeSession returns a solved session");
  assert.ok(autoSolvePersistedSession.sessionId, "includeSession returns session id");

  const autoSolvePersisted = await request("/api/v1/command/investigation/autosolve", {
    method: "POST",
    body: JSON.stringify({ caseId: extracted.activeCase.id, persist: true, includeDetails: true })
  });
  assert.equal(autoSolvePersisted.report.passed, true, "persisted auto-solve returns a passing detailed report");
  assert.equal(autoSolvePersisted.report.session.playerId, "auto-player", "persisted auto-solve uses dedicated auto-player");
  assert.equal(autoSolvePersisted.report.session.judgement.accepted, true, "persisted auto-solve session is solved");
  assert.ok(autoSolvePersisted.sessionId, "persisted auto-solve returns session id");
  assert.equal(autoSolvePersisted.report.steps.some((step) => step.kind === "challenge" && step.challengeHit), true, "detailed auto-solve includes challenge hit steps");
  const stateAfterPersist = await request(`/api/v1/query/world/state?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(stateAfterPersist.sessions.some((session) => session.id === autoSolvePersistedSession.sessionId && session.playerId === "auto-player"), true, "includeSession auto-solve creates a dedicated session");
  assert.equal(stateAfterPersist.sessions.some((session) => session.id === autoSolvePersisted.sessionId && session.playerId === "auto-player"), true, "includeDetails auto-solve compatibility still creates a dedicated session");

  const joined = await request("/api/v1/command/player/join", {
    method: "POST",
    body: JSON.stringify({ worldId, caseId: extracted.activeCase.id, displayName: "Persistent Smoke" })
  });
  assert.equal(joined.investigatorProgression.status, "developing", "join returns the safe investigator progression summary");
  assert.equal(joined.investigatorProgression.points, 0, "new player progression starts at zero points");
  assert.equal(/sourceKey|session-|case-|npc-|event-/i.test(JSON.stringify(joined.investigatorProgression)), false, "join progression summary omits raw runtime keys");
  assert.equal(joined.playerResourceCommitment.status, "ready", "Join opens the optional case resource commitment without a new endpoint");
  assert.equal(joined.playerResourceCommitment.options.length, 3, "Join exposes the three safe certified-lane resource options");
  assert.equal(joined.factionRelationship.status, "stable", "Join exposes neutral faction standing through the existing response");
  assert.equal(/factionKind|sourceKey|tick|case-|directive-|resourceKind/i.test(JSON.stringify(joined.factionRelationship)), false, "Join faction summary contains no internal bindings");
  const allEvidenceIds = extracted.activeCase.deductionCase.evidence.map((item) => item.id);
  const commitmentOption = joined.playerResourceCommitment.options.find((option) => option.available && option.lane === "search")
    || joined.playerResourceCommitment.options.find((option) => option.available && option.lane === "question")
    || joined.playerResourceCommitment.options.find((option) => option.available);
  assert.ok(commitmentOption, "at least one existing town resource is available for the case commitment smoke path");
  const resourceKeyByChoice = {
    "police-time": "police_time",
    "informant-trust": "informant_trust",
    "evidence-integrity": "evidence_integrity"
  };
  const commitmentResourceKey = resourceKeyByChoice[commitmentOption.choice];
  const leadTickBefore = (await request(`/api/v1/query/town/runtime?worldId=${encodeURIComponent(worldId)}`)).runtime.tick;
  const resourceBeforeCommitment = await request(`/api/v1/query/town/rule-state?worldId=${encodeURIComponent(worldId)}`);
  const commitment = await request("/api/v1/command/town/runtime/step", {
    method: "POST",
    body: JSON.stringify({ worldId, steps: 0, playerResourceCommitmentDecision: { sessionId: joined.session.id, choice: commitmentOption.choice } })
  });
  assert.equal(commitment.events.length, 0, "case resource reservation emits no simulation event");
  assert.equal(commitment.runtime.tick, leadTickBefore, "case resource reservation is a zero-tick write");
  assert.equal(commitment.playerResourceCommitment.status, "reserved", "case resource choice returns a safe reserved summary");
  assert.equal(commitment.playerResourceCommitment.lane, commitmentOption.lane, "selected resource keeps its fixed certified lane");
  assert.equal(commitment.runtime.playerResourceCommitments, undefined, "public runtime strips internal commitment session, case, location, and resource keys");
  assert.equal(commitment.runtime.factionRelationships, undefined, "public runtime strips the internal faction matrix and relationship ledger");
  assert.equal(/police_time|session-|case-|locationId|resourceKind|selectedAtTick/i.test(JSON.stringify(commitment.playerResourceCommitment)), false, "commitment summary contains no raw runtime bindings");
  const resourceAfterCommitment = await request(`/api/v1/query/town/rule-state?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(resourceAfterCommitment.ruleState.resourceLedger[commitmentResourceKey].available, resourceBeforeCommitment.ruleState.resourceLedger[commitmentResourceKey].available - commitmentOption.reserveCost, "zero-tick choice applies the visible standing-priced reserve cost");
  assert.equal(resourceAfterCommitment.ruleState.resourceLedger[commitmentResourceKey].reserved, resourceBeforeCommitment.ruleState.resourceLedger[commitmentResourceKey].reserved + commitmentOption.reserveCost, "zero-tick choice moves only the standing-priced amount into the existing reserved ledger");
  const followedLead = await request("/api/v1/command/town/runtime/step", {
    method: "POST",
    body: JSON.stringify({ worldId, steps: 0, worldLeadDecision: { sessionId: joined.session.id, action: "follow" } })
  });
  assert.equal(followedLead.events.length, 0, "world lead update emits no simulation events");
  assert.equal(followedLead.runtime.tick, leadTickBefore, "world lead update does not advance the persistent town tick");
  assert.equal(followedLead.worldLead.status, "followed", "world lead follow returns a safe persisted summary");
  assert.equal(JSON.stringify(followedLead.runtime).includes(joined.session.id), false, "public runtime omits internal world lead session ids");
  const resolvedLead = await request("/api/v1/command/town/runtime/step", {
    method: "POST",
    body: JSON.stringify({ worldId, steps: 0, worldLeadDecision: { sessionId: joined.session.id, action: "resolve" } })
  });
  assert.equal(resolvedLead.worldLead.status, "resolved", "world lead resolve persists without a tick");
  assert.equal(resolvedLead.events.length, 0, "world lead outcome activation emits no simulation events");
  assert.equal(resolvedLead.runtime.tick, leadTickBefore, "world lead outcome activation does not advance the persistent town tick");
  assert.equal(resolvedLead.worldLeadOutcome.status, "active", "resolved lead returns a safe active world outcome");
  assert.equal(/case-|npc-|ev-|source/i.test(JSON.stringify(resolvedLead.worldLeadOutcome)), false, "world lead outcome summary omits raw ids and sources");
  const skippedSession = await request("/api/v1/command/player/join", {
    method: "POST",
    body: JSON.stringify({ worldId, caseId: extracted.activeCase.id, displayName: "Persistent Skip" })
  });
  const skippedLead = await request("/api/v1/command/town/runtime/step", {
    method: "POST",
    body: JSON.stringify({ worldId, steps: 0, worldLeadDecision: { sessionId: skippedSession.session.id, action: "skip" } })
  });
  assert.equal(skippedLead.worldLead.status, "skipped", "world lead skip persists separately per session");
  let consumedCommitment;
  let consumedRelationship;
  let investigatorProgression;
  if (commitmentOption.lane === "question") {
    const questioned = await request("/api/v1/command/investigation/interrogate", {
      method: "POST",
      body: JSON.stringify({
        sessionId: joined.session.id,
        characterId: extracted.activeCase.deductionCase.characters[0].id,
        question: "What did you observe during the incident window?",
        provider: "mock"
      })
    });
    consumedCommitment = questioned.playerResourceCommitment;
    consumedRelationship = questioned.factionRelationship;
    investigatorProgression = questioned.investigatorProgression;
  } else if (commitmentOption.lane === "challenge") {
    const testimony = extracted.activeCase.testimonies.find((item) => item.contradictionEvidenceIds.length > 0);
    assert.ok(testimony, "challenge commitment fixture has a certified testimony contradiction");
    const evidenceId = testimony.contradictionEvidenceIds[0];
    await request("/api/v1/command/investigation/discover", {
      method: "POST",
      body: JSON.stringify({ sessionId: joined.session.id, evidenceId })
    });
    const challenged = await request("/api/v1/command/investigation/interrogate", {
      method: "POST",
      body: JSON.stringify({
        sessionId: joined.session.id,
        characterId: testimony.characterId,
        question: "How does this evidence change your statement?",
        evidenceId,
        provider: "mock"
      })
    });
    consumedCommitment = challenged.playerResourceCommitment;
    consumedRelationship = challenged.factionRelationship;
    investigatorProgression = challenged.investigatorProgression;
  }
  for (const evidenceId of allEvidenceIds) {
    const discovery = await request("/api/v1/command/investigation/discover", {
      method: "POST",
      body: JSON.stringify({ sessionId: joined.session.id, evidenceId })
    });
    consumedCommitment ||= discovery.playerResourceCommitment;
    consumedRelationship ||= discovery.factionRelationship;
    investigatorProgression ||= discovery.investigatorProgression;
  }
  assert.equal(consumedCommitment.status, "used", "the first successful matching Search consumes the reserve exactly once");
  assert.equal(consumedCommitment.lane, commitmentOption.lane, "consumed summary keeps only the safe certified lane");
  assert.equal(consumedRelationship.status, "changed", "spending the matching case resource records one player-authoritative faction change");
  assert.equal(/factionKind|sourceKey|session-|case-|tick|requestedDelta/i.test(JSON.stringify(consumedRelationship)), false, "resource relationship response remains aggregate-only");
  assert.ok(investigatorProgression?.points >= 1, "a real manual investigation step records bounded progression");
  assert.equal(/sourceKey|session-|case-|npc-|event-/i.test(JSON.stringify(investigatorProgression)), false, "investigator progression response remains public-safe");
  const resourceAfterSearch = await request(`/api/v1/query/town/rule-state?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(resourceAfterSearch.ruleState.resourceLedger[commitmentResourceKey].reserved, resourceBeforeCommitment.ruleState.resourceLedger[commitmentResourceKey].reserved, "matching certified step clears the actual reservation");
  assert.equal(resourceAfterSearch.ruleState.resourceLedger[commitmentResourceKey].spentThisRun, resourceBeforeCommitment.ruleState.resourceLedger[commitmentResourceKey].spentThisRun + commitmentOption.reserveCost, "matching certified step records the actual standing-priced spend once");
  const rejected = await request("/api/v1/command/investigation/submit-theory", {
    method: "POST",
    body: JSON.stringify({
      sessionId: joined.session.id,
      theory: { culpritId: "not-the-culprit", motive: "", method: "", evidenceIds: [] }
    })
  });
  assert.equal(rejected.judgement.accepted, false, "wrong theory remains a non-terminal player correction path");
  assert.equal(rejected.worldLeadOutcome, undefined, "wrong theory does not settle the active world lead outcome");
  assert.equal(rejected.worldLeadCaseHandoff, undefined, "wrong theory never prepares a next-case handoff");
  assert.equal(rejected.worldArc, undefined, "wrong theory never advances a world arc");
  assert.equal(rejected.worldArcDirective, undefined, "wrong theory never prepares a faction directive");
  assert.equal(rejected.playerResourceCommitment, undefined, "wrong theory does not settle or refund the case resource cycle");
  assert.equal(rejected.factionRelationship, undefined, "wrong theory cannot award faction standing");
  assert.equal(rejected.investigatorProgression, undefined, "a wrong theory with no selected evidence records no progression step");
  assert.equal(rejected.campaignRecovery.status, "ready", "wrong theory prepares one explicit campaign recovery path");
  assert.equal(/sourceKey|sessionId|caseId|resourceKind|factionKind|offerId|tick|delta|not-the-culprit/i.test(JSON.stringify(rejected.campaignRecovery)), false, "theory recovery response strips internal bindings and player theory text");
  const recoveryRuntimeBefore = await request(`/api/v1/query/town/runtime?worldId=${encodeURIComponent(worldId)}`);
  const deferredRecovery = await request("/api/v1/command/town/runtime/step", {
    method: "POST",
    body: JSON.stringify({ worldId, steps: 0, campaignRecoveryDecision: { choice: "defer" } })
  });
  assert.equal(deferredRecovery.campaignRecovery.status, "ready", "campaign recovery may be deferred without closing the case path");
  assert.equal(deferredRecovery.runtime.tick, recoveryRuntimeBefore.runtime.tick, "recovery defer is zero tick");
  assert.deepEqual(deferredRecovery.events, [], "recovery defer creates no WorldEvent");
  const startedTheoryRecovery = await request("/api/v1/command/town/runtime/step", {
    method: "POST",
    body: JSON.stringify({ worldId, steps: 0, campaignRecoveryDecision: { choice: "start" } })
  });
  assert.equal(startedTheoryRecovery.campaignRecovery.status, "completed", "certified-route recovery completes without truth fallback");
  assert.equal(startedTheoryRecovery.runtime.tick, recoveryRuntimeBefore.runtime.tick, "certified-route recovery start is zero tick");
  assert.deepEqual(startedTheoryRecovery.events, [], "certified-route recovery creates no WorldEvent");
  const solved = await request("/api/v1/command/investigation/submit-theory", {
    method: "POST",
    body: JSON.stringify({
      sessionId: joined.session.id,
      theory: {
        culpritId: extracted.activeCase.deductionCase.truth.culpritId,
        motive: extracted.activeCase.deductionCase.truth.motive,
        method: extracted.activeCase.deductionCase.truth.method,
        evidenceIds: allEvidenceIds
      }
    })
  });
  assert.equal(solved.judgement.accepted, true, "smoke session can solve extracted case");
  assert.equal(solved.playerResourceCommitment.status, "used", "accepted theory preserves the already-spent commitment without refunding it");
  assert.equal(solved.factionRelationship.status, "changed", "accepted player theory records one safe source-faction standing result");
  assert.equal(solved.worldLeadOutcome.status, "settled", "accepted theory settles the active world lead outcome");
  assert.equal(/case-|npc-|ev-|source/i.test(JSON.stringify(solved.worldLeadOutcome)), false, "settled outcome summary remains low-spoiler");
  assert.equal(solved.worldLeadCaseHandoff.status, "ready", "accepted player theory prepares a one-time next-case handoff");
  assert.equal(/case-|npc-|ev-|source/i.test(JSON.stringify(solved.worldLeadCaseHandoff)), false, "ready handoff summary remains low-spoiler");
  assert.equal(solved.worldArc.completedStages, 1, "accepted followed lead advances the current world arc once");
  assert.equal(/\bnpc-\d+\b|\bev-[a-z0-9-]+\b|\b(?:case|evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(JSON.stringify(solved.worldArc)), false, "advanced world arc summary remains low-spoiler");
  assert.equal(solved.worldArcDirective.status, "ready", "accepted arc advance prepares a player-visible faction directive");
  assert.equal(/\b(?:case|npc|evidence|event|source)-[a-z0-9-]*\d[a-z0-9-]*\b|progressionLineId|institutionId|longActionId/i.test(JSON.stringify(solved.worldArcDirective)), false, "faction directive response strips internal runtime keys");
  assert.equal(solved.worldInfluenceBudget.status, "active", "accepted followed case activates the unified next-case influence budget");
  assert.equal(solved.worldInfluenceBudget.sourceCount, 2, "ready handoff and advanced arc share one safe influence budget");
  assert.equal(solved.worldInfluenceBudget.maximumAbsoluteBonus, 3, "API exposes the fixed total influence cap without raw scoring keys");
  assert.ok(solved.investigatorProgression?.points >= 2, "accepted manual theory records bounded investigator progression");
  assert.equal(solved.campaignSession.status, "transition", "first accepted theory advances the campaign into a between-case transition");
  assert.equal(solved.campaignSession.progressLabel, "1/3 campaign cases closed", "accepted theory advances campaign progress exactly once");
  assert.equal(solved.campaignFinaleDebrief.status, "locked", "finale debrief remains locked after the first case");
  assert.equal(solved.townSocialResponse.status, "ready", "accepted Follow settlement prepares one Server-only town social response");
  assert.equal(solved.townSocialResponse.progressLabel, "0/3", "new social response starts without advancing the zero-tick settlement");
  assert.equal(/npcId|locationId|institutionId|sourceKey|eventId|caseId|tick|delta|culprit|victim|raw/i.test(JSON.stringify(solved.townSocialResponse)), false, "settlement returns only the safe social response summary");
  assert.equal(/sourceKey|session-|case-|npc-|event-/i.test(JSON.stringify(solved.investigatorProgression)), false, "accepted progression summary omits raw runtime keys");
  let socialResponse = solved.townSocialResponse;
  const socialTickEvents = [];
  for (let step = 0; step < 3; step += 1) {
    const advancedSocial = await request("/api/v1/command/town/runtime/step", {
      method: "POST",
      body: JSON.stringify({ worldId, steps: 1 })
    });
    socialResponse = advancedSocial.townSocialResponse;
    socialTickEvents.push(...advancedSocial.events);
    assert.equal(socialResponse.reactions.length, step + 1, "each positive tick reveals exactly one additional public reaction");
  }
  assert.equal(socialResponse.status, "settled", "three normal ticks settle the bounded town response cycle");
  assert.equal(socialResponse.reactions.length, 3, "settled social response exposes at most three readable reactions");
  assert.equal(new Set(socialResponse.reactions.map((item) => item.actorName)).size, 3, "one public cycle never repeats an NPC");
  assert.equal(socialTickEvents.some((event) => event.tags?.includes("town_social_response")), false, "town social response creates no WorldEvent of its own");
  const settledSocialBrief = await request(`/api/v1/query/town/brief?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(settledSocialBrief.brief.townSocialResponse.status, "settled", "Situation Brief receives the latest settled social response");
  assert.equal(settledSocialBrief.brief.townSocialResponse.reactions.every((item) => item.actorName && item.roleLabel && item.locationLabel && item.reactionLabel), true, "Situation Brief exposes readable name, role, public place, and low-spoiler posture");
  const runtimeWithReadyHandoff = await request(`/api/v1/query/town/runtime?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(runtimeWithReadyHandoff.runtime.worldLeadCaseHandoffSummary.status, "ready", "ready handoff persists in existing runtime JSON through its safe summary");
  assert.equal(/case-|npc-|ev-|source/i.test(JSON.stringify(runtimeWithReadyHandoff.runtime.worldLeadCaseHandoffSummary)), false, "public runtime summary hides internal handoff keys");
  assert.equal(runtimeWithReadyHandoff.runtime.worldArcSummary.completedStages, 1, "world arc stage persists through the existing runtime JSON projection");
  assert.equal(runtimeWithReadyHandoff.runtime.worldArcProgress, undefined, "public runtime strips internal world arc keys and case bindings");
  assert.equal(runtimeWithReadyHandoff.runtime.worldArcDirectiveSummary.status, "ready", "ready directive persists through the existing runtime JSON projection");
  assert.equal(runtimeWithReadyHandoff.runtime.worldArcDirectives, undefined, "public runtime strips internal directive queue, actors, and action keys");
  assert.equal(runtimeWithReadyHandoff.runtime.playerResourceCommitments, undefined, "public runtime strips internal case resource history and raw bindings");
  assert.equal(runtimeWithReadyHandoff.runtime.factionRelationships, undefined, "public runtime strips internal faction scores, sources, and dedupe keys");
  assert.equal(runtimeWithReadyHandoff.runtime.factionRelationshipSummary.status, "changed", "public runtime persists only safe faction standing bands");
  assert.ok(runtimeWithReadyHandoff.runtime.investigatorProgressionSummary?.points >= 2, "public runtime persists the safe investigator progression aggregate");
  assert.equal(runtimeWithReadyHandoff.runtime.investigatorProgression, undefined, "public runtime strips the internal progression ledger");
  assert.equal(runtimeWithReadyHandoff.runtime.campaignRecoveries, undefined, "public runtime strips internal campaign failure sources, targets, ticks, and applied deltas");
  assert.equal(runtimeWithReadyHandoff.runtime.arcConvergence, undefined, "public runtime strips internal convergence signals, case binding, and ticks");
  assert.equal(runtimeWithReadyHandoff.runtime.campaignSession, undefined, "public runtime strips internal campaign case history, bindings, and ticks");
  assert.equal(runtimeWithReadyHandoff.runtime.campaignSessionSummary.status, "transition", "public runtime retains only safe campaign chapter progress");
  assert.equal(runtimeWithReadyHandoff.runtime.townSocialResponses, undefined, "public runtime strips the internal social response queue, raw actors, locations, sources, and ticks");
  assert.equal(runtimeWithReadyHandoff.runtime.townSocialResponseSummary.status, "settled", "public runtime retains only the safe settled social response summary");
  assert.equal(/caseId|tick|sourceKey|signalKey|culprit|evidenceId|internal-/i.test(JSON.stringify({ summary: runtimeWithReadyHandoff.runtime.campaignSessionSummary, debrief: runtimeWithReadyHandoff.runtime.campaignFinaleDebrief })), false, "public campaign summaries contain no internal case history or truth material");
  assert.equal(runtimeWithReadyHandoff.runtime.arcConvergenceSummary.status, "forming", "one accepted case exposes only safe forming progress");
  assert.equal(/caseId|tick|signalKey|sourceKey|culprit|evidenceId|internal-/i.test(JSON.stringify(runtimeWithReadyHandoff.runtime.arcConvergenceSummary)), false, "public convergence summary remains aggregate-only");
  assert.equal(runtimeWithReadyHandoff.runtime.campaignRecoverySummary.status, "completed", "public runtime persists only the safe completed recovery aggregate");
  assert.equal(/sourceKey|sessionId|caseId|resourceKind|factionKind|offerId|createdAtTick|completedAtTick|applied.*Delta/i.test(JSON.stringify(runtimeWithReadyHandoff.runtime.campaignRecoverySummary)), false, "public runtime recovery summary remains aggregate-only");
  assert.equal(/sourceKey|session-|case-|npc-|event-/i.test(JSON.stringify(runtimeWithReadyHandoff.runtime.investigatorProgressionSummary)), false, "runtime progression summary omits raw keys");
  assert.equal(runtimeWithReadyHandoff.runtime.playerResourceCommitmentSummary.status, "used", "public runtime persists only the safe case resource aggregate");
  assert.equal(runtimeWithReadyHandoff.runtime.worldInfluenceBudgetSummary.sourceCount, 2, "public runtime derives one influence summary from existing internal sources");
  assert.equal(/case-|pulse-|progression|institution|resource|event-/i.test(JSON.stringify(runtimeWithReadyHandoff.runtime.worldInfluenceBudgetSummary)), false, "public influence summary strips internal source bindings");
  const directiveTick = runtimeWithReadyHandoff.runtime.tick;
  const deferredDirective = await request("/api/v1/command/town/runtime/step", {
    method: "POST",
    body: JSON.stringify({ worldId, steps: 0, worldArcDirectiveDecision: { choice: "defer" } })
  });
  assert.equal(deferredDirective.worldArcDirective.status, "ready", "defer keeps the faction response open");
  assert.equal(deferredDirective.runtime.tick, directiveTick, "defer is a zero-tick write");
  assert.equal(deferredDirective.events.length, 0, "defer emits no world event");
  const scheduledDirective = await request("/api/v1/command/town/runtime/step", {
    method: "POST",
    body: JSON.stringify({ worldId, steps: 0, worldArcDirectiveDecision: { choice: "support" } })
  });
  assert.equal(scheduledDirective.worldArcDirective.status, "scheduled", "support schedules the content-configured response");
  assert.equal(scheduledDirective.runtime.tick, directiveTick, "support scheduling is a zero-tick write");
  assert.equal(scheduledDirective.events.length, 0, "support scheduling reserves no resources and emits no event");
  const directiveEvents = [];
  let directiveStatus = scheduledDirective.worldArcDirective;
  let directiveRelationship = scheduledDirective.factionRelationship;
  let directiveOffer = scheduledDirective.worldEventOffer;
  for (let step = 0; step < 24 && directiveStatus.status !== "completed"; step += 1) {
    const advancedDirective = await request("/api/v1/command/town/runtime/step", {
      method: "POST",
      body: JSON.stringify({ worldId, steps: 1 })
    });
    directiveEvents.push(...advancedDirective.events);
    directiveStatus = advancedDirective.worldArcDirective;
    directiveRelationship = advancedDirective.factionRelationship;
    directiveOffer = advancedDirective.worldEventOffer;
    if (directiveStatus.status === "blocked") {
      const alternate = await request("/api/v1/command/town/runtime/step", {
        method: "POST",
        body: JSON.stringify({ worldId, steps: 0, worldArcDirectiveDecision: { choice: "contain" } })
      });
      assert.equal(alternate.runtime.tick, advancedDirective.runtime.tick, "blocked alternate selection remains zero tick");
      directiveStatus = alternate.worldArcDirective;
    }
  }
  assert.equal(directiveStatus.status, "completed", "the selected response completes through existing institution ticks");
  assert.equal(["ready", "active"].includes((await request(`/api/v1/query/town/runtime?worldId=${encodeURIComponent(worldId)}`)).runtime.townSocialResponseSummary.status), true, "completed player directive prepares its own queued social response");
  assert.equal(directiveRelationship.status, "changed", "completed directive returns the updated safe faction standing summary");
  assert.equal(directiveOffer.status, "offered", "completed directive prepares one player-readable world event opportunity");
  assert.equal(/world-event-offer|world-arc-directive|eventArchetypeId|institutionKind|longActionKind|createdAtTick|expiresAtTick/i.test(JSON.stringify(directiveOffer)), false, "offer summary strips internal source, action, institution, and deadline keys");
  assert.equal(directiveEvents.filter((event) => event.tags?.includes("directive_start")).length, 1, "API flow emits exactly one successful directive start event");
  assert.equal(directiveEvents.filter((event) => event.tags?.includes("directive_complete")).length, 1, "API flow emits exactly one directive completion event");
  const offerTick = (await request(`/api/v1/query/town/runtime?worldId=${encodeURIComponent(worldId)}`)).runtime.tick;
  const acceptedOffer = await request("/api/v1/command/town/runtime/step", {
    method: "POST",
    body: JSON.stringify({ worldId, steps: 0, worldEventOfferDecision: { choice: "accept" } })
  });
  assert.equal(acceptedOffer.worldEventOffer.status, "accepted", "offer acceptance records intent through the existing runtime step endpoint");
  assert.equal(acceptedOffer.runtime.tick, offerTick, "offer acceptance is zero tick");
  assert.equal(acceptedOffer.events.length, 0, "offer acceptance emits no event and reserves no resources");
  const offerEvents = [];
  let offerStatus = acceptedOffer.worldEventOffer;
  for (let step = 0; step < 24 && offerStatus.status !== "completed" && offerStatus.status !== "failed"; step += 1) {
    const advancedOffer = await request("/api/v1/command/town/runtime/step", {
      method: "POST",
      body: JSON.stringify({ worldId, steps: 1 })
    });
    offerEvents.push(...advancedOffer.events);
    offerStatus = advancedOffer.worldEventOffer;
  }
  assert.ok(["completed", "failed"].includes(offerStatus.status), `accepted offer reaches a terminal safe state (${offerStatus.progressLabel || "no progress label"})`);
  assert.equal(offerEvents.filter((event) => event.tags?.includes("offer_start")).length, offerStatus.status === "completed" ? 1 : 0, "offer start event matches the resource-gated lifecycle");
  assert.equal(offerEvents.filter((event) => event.tags?.includes("offer_complete")).length, offerStatus.status === "completed" ? 1 : 0, "offer completion event matches the resource-gated lifecycle");
  if (offerStatus.status === "failed") {
    assert.match(offerStatus.progressLabel, /resource unavailable/i, "resource-gated failure explains the safe prerequisite category");
  }
  if (offerStatus.status === "completed") {
    const offerSocialRuntime = await request(`/api/v1/query/town/runtime?worldId=${encodeURIComponent(worldId)}`);
    assert.equal(["ready", "active"].includes(offerSocialRuntime.runtime.townSocialResponseSummary.status), true, "completed accepted offer prepares or queues its own social response");
  }
  const directiveBrief = await request(`/api/v1/query/town/brief?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(directiveBrief.brief.worldArcDirective.status, "completed", "Situation Brief exposes the safe completed directive summary");
  assert.equal(directiveBrief.brief.worldPressureCascade.status, "active", "Situation Brief exposes the safe active pressure cascade");
  assert.equal(directiveBrief.brief.worldInfluenceBudget.status, "active", "Situation Brief exposes the unified safe influence budget");
  assert.equal(directiveBrief.brief.playerResourceCommitment.status, "used", "Situation Brief exposes only the safe case resource aggregate");
  assert.equal(directiveBrief.brief.factionRelationship.status, "changed", "Situation Brief exposes only safe faction standing bands");
  assert.equal(directiveBrief.brief.worldEventOffer.status, offerStatus.status, "Situation Brief exposes the safe terminal world opportunity status");
  assert.ok(directiveBrief.brief.campaignRecovery, "Situation Brief exposes one safe campaign recovery aggregate");
  assert.equal(directiveBrief.brief.worldInfluenceBudget.maximumAbsoluteBonus, 3, "Situation Brief keeps the total future-case influence bounded");
  const runtimeWithCompletedDirective = await request(`/api/v1/query/town/runtime?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(runtimeWithCompletedDirective.runtime.worldArcDirectiveSummary.status, "completed", "completed directive persists in existing runtime JSON");
  assert.equal(runtimeWithCompletedDirective.runtime.worldArcDirectives, undefined, "completed public runtime still strips internal directive history");
  assert.equal(runtimeWithCompletedDirective.runtime.factionRelationships, undefined, "completed public runtime still strips internal relationship sources and values");
  assert.equal(runtimeWithCompletedDirective.runtime.worldEventOffers, undefined, "completed public runtime strips internal offer queue, source, actor, action, and deadline keys");
  assert.equal(runtimeWithCompletedDirective.runtime.worldEventOfferSummary.status, offerStatus.status, "public runtime persists only the safe terminal offer summary");
  assert.equal(runtimeWithCompletedDirective.runtime.worldPressureCascadeSummary.status, "active", "pressure cascade persists through the existing runtime JSON projection");
  assert.equal(runtimeWithCompletedDirective.runtime.worldPressurePulses, undefined, "public runtime strips internal pulse history and source bindings");
  assert.equal(runtimeWithCompletedDirective.runtime.worldInfluenceBudgetSummary.sourceCount, 3, "completed directive pressure joins handoff and arc inside one budget");
  assert.equal(
    /world-pressure-pulse|world-arc-directive|case-|npc-|event-|source-|institutionId|resourceKind|longActionKind|createdAtTick|updatedAtTick/i.test(JSON.stringify(runtimeWithCompletedDirective.runtime.worldPressureCascadeSummary)),
    false,
    "pressure public summary contains no internal pulse, source, resource, action, or tick keys"
  );
  const pressureLayersBeforePreview = runtimeWithCompletedDirective.runtime.worldPressureCascadeSummary.remainingLayers;
  await request(`/api/v1/query/town/candidates?worldId=${encodeURIComponent(worldId)}`);
  const runtimeAfterPressurePreview = await request(`/api/v1/query/town/runtime?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(runtimeAfterPressurePreview.runtime.worldPressureCascadeSummary.remainingLayers, pressureLayersBeforePreview, "candidate preview does not consume pressure");
  const solvedCaseQuery = await request(`/api/v1/query/case?caseId=${encodeURIComponent(extracted.activeCase.id)}&includeIntake=true&sessionId=${encodeURIComponent(joined.session.id)}`);
  assert.equal(solvedCaseQuery.playableIntake.coach.stage, "review-source", "solved case query coach unlocks source review");
  assert.equal(solvedCaseQuery.playableIntake.nextAction.kind, "review-source", "solved case query next action reviews source trail");
  assert.equal(solvedCaseQuery.playableIntake.sourceTrail.some((item) => item.hidden), false, "solved case query unlocks source trail");
  const solvedProofLedger = await request(`/api/v1/query/case/proof-ledger?caseId=${encodeURIComponent(extracted.activeCase.id)}&sessionId=${encodeURIComponent(joined.session.id)}&includeCertificate=true`);
  assert.equal(solvedProofLedger.certificate.steps.some((item) => item.evidenceIds.length > 0), true, "solved route certificate unlocks evidence ids");

  const extractedNextCase = await request("/api/v1/command/town/case/extract", {
    method: "POST",
    body: JSON.stringify({ worldId })
  });
  assert.ok(extractedNextCase.activeCase.id, "a subsequent legal case can be extracted after the handoff is ready");
  assert.equal(extractedNextCase.campaignSession.status, "case-active", "next legal extraction resumes the same campaign journey");
  assert.equal(extractedNextCase.campaignSession.progressLabel, "1/3 campaign cases closed", "next extraction preserves completed campaign progress");
  assert.equal(extractedNextCase.worldLeadCaseHandoff.status, "consumed", "any first successful next-case extraction consumes the handoff");
  assert.equal(/case-|npc-|ev-|source/i.test(JSON.stringify(extractedNextCase.worldLeadCaseHandoff)), false, "consumed handoff response remains low-spoiler");
  assert.ok(extractedNextCase.worldArc?.progressLabel, "next extraction activates or resumes a safe case-scoped world arc summary");
  assert.equal(extractedNextCase.worldPressureCascade.status, "consumed", "the next successful extraction consumes the single active pressure layer");
  assert.equal(extractedNextCase.worldPressureCascade.remainingLayers, 0, "one-layer cascade is exhausted after one successful extraction");
  assert.equal(extractedNextCase.worldInfluenceBudget.sourceLabel.includes("next-case follow-up"), false, "successful extraction removes consumed handoff from the unified influence budget");
  assert.equal(extractedNextCase.worldInfluenceBudget.sourceLabel.includes("world pressure"), false, "successful extraction removes exhausted pressure from the unified influence budget");
  const runtimeWithConsumedHandoff = await request(`/api/v1/query/town/runtime?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(runtimeWithConsumedHandoff.runtime.worldLeadCaseHandoffSummary.status, "consumed", "consumed handoff persists in existing runtime JSON");
  assert.equal(/case-|npc-|ev-|source/i.test(JSON.stringify(runtimeWithConsumedHandoff.runtime.worldLeadCaseHandoffSummary)), false, "public runtime omits internal consumed handoff keys");
  assert.equal(runtimeWithConsumedHandoff.runtime.worldPressureCascadeSummary.status, "consumed", "consumed pressure state persists through the safe runtime summary");

  async function solveCampaignCase(casePayload, label) {
    const campaignJoin = await request("/api/v1/command/player/join", {
      method: "POST",
      body: JSON.stringify({ worldId, caseId: casePayload.activeCase.id, displayName: `Campaign ${label}` })
    });
    await request("/api/v1/command/town/runtime/step", {
      method: "POST",
      body: JSON.stringify({ worldId, steps: 0, worldLeadDecision: { sessionId: campaignJoin.session.id, action: "follow" } })
    });
    await request("/api/v1/command/town/runtime/step", {
      method: "POST",
      body: JSON.stringify({ worldId, steps: 0, worldLeadDecision: { sessionId: campaignJoin.session.id, action: "resolve" } })
    });
    const evidenceIds = casePayload.activeCase.deductionCase.evidence.map((item) => item.id);
    for (const evidenceId of evidenceIds) {
      await request("/api/v1/command/investigation/discover", {
        method: "POST",
        body: JSON.stringify({ sessionId: campaignJoin.session.id, evidenceId })
      });
    }
    return request("/api/v1/command/investigation/submit-theory", {
      method: "POST",
      body: JSON.stringify({
        sessionId: campaignJoin.session.id,
        theory: {
          culpritId: casePayload.activeCase.deductionCase.truth.culpritId,
          motive: casePayload.activeCase.deductionCase.truth.motive,
          method: casePayload.activeCase.deductionCase.truth.method,
          evidenceIds
        }
      })
    });
  }

  const solvedSecondCampaignCase = await solveCampaignCase(extractedNextCase, "Case Two");
  assert.equal(solvedSecondCampaignCase.judgement.accepted, true, "the second campaign case closes through the normal player theory endpoint");
  assert.equal(solvedSecondCampaignCase.campaignSession.status, "finale-ready", "two accepted followed cases plus completed world history prepare the finale");
  assert.equal(solvedSecondCampaignCase.campaignSession.progressLabel, "2/3 campaign cases closed", "campaign reaches its intended finale transition after two cases");
  assert.equal(solvedSecondCampaignCase.arcConvergence.status, "ready", "the normal campaign flow reaches v5.39 convergence readiness");
  const finaleQueue = await request(`/api/v1/query/town/candidates?worldId=${encodeURIComponent(worldId)}`);
  const finaleCandidate = finaleQueue.candidates.find((item) => item.caseType === "court-intimidation" && item.validation?.valid);
  assert.ok(finaleCandidate, "the normal candidate queue exposes one validated shared-finale family candidate");
  const extractedFinale = await request("/api/v1/command/town/case/extract", {
    method: "POST",
    body: JSON.stringify({ worldId, candidateId: finaleCandidate.id })
  });
  assert.equal(extractedFinale.arcConvergence.status, "active", "successful finale-family extraction activates the converged finale");
  assert.equal(extractedFinale.campaignSession.status, "finale-active", "the finale becomes campaign case three");
  const solvedFinale = await solveCampaignCase(extractedFinale, "Finale");
  assert.equal(solvedFinale.judgement.accepted, true, "the finale closes through the unchanged certified theory judgement");
  assert.equal(solvedFinale.arcConvergence.status, "completed", "accepted finale completes Arc convergence");
  assert.equal(solvedFinale.campaignSession.status, "completed", "a clean Server Runtime path completes the packaged three-case campaign");
  assert.equal(solvedFinale.campaignSession.progressLabel, "3/3 campaign cases closed", "completed API campaign reports the intended target");
  assert.equal(solvedFinale.campaignFinaleDebrief.status, "ready", "completed campaign returns the safe causal finale debrief");
  assert.equal(solvedFinale.campaignFinaleDebrief.causalBeats.length >= 3, true, "finale debrief contains bounded causal campaign beats");
  assert.equal(/caseId|tick|sourceKey|signalKey|culprit|evidenceId|internal-|\bnpc-\d+\b|\bev-[a-z0-9-]+\b/i.test(JSON.stringify({ summary: solvedFinale.campaignSession, debrief: solvedFinale.campaignFinaleDebrief })), false, "completed campaign response strips internal history and truth bindings");

  await request("/api/v1/command/town/runtime/pause", {
    method: "POST",
    body: JSON.stringify({ worldId })
  });
  await request("/api/v1/command/town/runtime/reset", {
    method: "POST",
    body: JSON.stringify({ worldId })
  });

  console.log("Persistent town Agent API smoke test passed.");
} finally {
  clearTimeout(smokeTimeout);
  if (server) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {
        server.kill("SIGTERM");
      }
    }
  }
}
