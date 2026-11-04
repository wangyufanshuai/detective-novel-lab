import assert from "node:assert/strict";
import fs from "node:fs";
import { startReleaseCandidateServer, waitForServer } from "./lib/release-candidate-server.mjs";

let server;
try {
  server = await startReleaseCandidateServer({
    prefix: "rc-agent-control-api-smoke",
    healthPath: "/api/v1/query/runtime/status",
    env: { AI_PROVIDER: "mock", DEEPSEEK_API_KEY: "", SILICONFLOW_API_KEY: "" }
  });
  const baseUrl = server.baseUrl;
  await waitForServer(baseUrl, { pathName: "/api/v1/query/runtime/status", timeoutMs: 30_000 });

  async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { "content-type": "application/json", ...(options.headers || {}) }
    });
    const json = await response.json();
    if (!response.ok || json.ok === false) throw new Error(`${options.method || "GET"} ${path} failed: ${response.status} ${JSON.stringify(json)}`);
    return json.data || json;
  }

  async function failure(path, options = {}, expectedStatus = 409) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { "content-type": "application/json", ...(options.headers || {}) }
    });
    const json = await response.json();
    assert.equal(response.status, expectedStatus);
    assert.equal(json.ok, false);
    return json.error;
  }

  const created = await request("/api/v1/command/town/create", {
    method: "POST",
    body: JSON.stringify({ seed: "agent-control-api-smoke", mode: "showcase", caseMode: "generated", npcCount: 8, timelineHours: 24 })
  });
  const worldId = created.world.id;
  const selectedPackage = await request("/api/v1/command/town/world-pack/select", {
    method: "POST",
    body: JSON.stringify({ worldId, packageId: "dock-court-market-town", campaignRouteId: "baseline" })
  });
  assert.equal(selectedPackage.currentExperiment.worldPackageId, "dock-court-market-town");
  assert.ok(selectedPackage.currentExperiment.worldPackageHash, "WorldPackage selection binds a content hash before agent control begins");
  assert.equal(selectedPackage.currentExperiment.worldPackageReceipt?.schema, "world-package-receipt.v1", "WorldPackage selection persists a versioned package receipt");
  assert.match(selectedPackage.currentExperiment.worldPackageReceipt?.receiptHash || "", /^h[0-9a-z]+$/, "WorldPackage receipt has a stable receipt hash");
  assert.equal(selectedPackage.currentExperiment.worldPackageReceipt?.contentHash, selectedPackage.currentExperiment.worldPackageHash, "WorldPackage receipt binds the selected content hash");
  assert.equal(selectedPackage.currentExperiment.worldPackageReceipt?.files.length >= 8, true, "WorldPackage receipt enumerates source files");
  const started = await request("/api/v1/command/town/runtime/start", {
    method: "POST",
    body: JSON.stringify({ worldId, steps: 1 })
  });
  const actorId = started.runtime.agentStates[0].npcId;
  const capabilities = await request(`/api/v1/query/town/agent-capabilities?worldId=${encodeURIComponent(worldId)}`);
  assert.equal(capabilities.manifest.schema, "agent-control.v1");
  assert.equal(capabilities.manifest.compatibility.schema, "world-replay-compat.v1");
  assert.equal(capabilities.manifest.compatibility.worldPackageId, "dock-court-market-town");
  assert.equal(capabilities.manifest.compatibility.worldPackageHash, selectedPackage.currentExperiment.worldPackageHash);
  assert.equal(capabilities.manifest.compatibility.worldPackageReceiptHash, selectedPackage.currentExperiment.worldPackageReceipt.receiptHash);
  assert.equal(capabilities.world.revision, started.runtime.revision);
  assert.equal(capabilities.manifest.commands.find((command) => command.id === "propose.intervention")?.status, "implemented");

  const body = {
    worldId,
    actionId: "agent-control-api-smoke-1",
    expectedRevision: capabilities.world.revision,
    reason: "Use the latest town brief to test one auditable intervention.",
    sourceRefs: [`brief:${worldId}`],
    intervention: { actorId, kind: "resource", value: "resource:agent-control-smoke" }
  };
  const proposed = await request("/api/v1/command/town/agent/propose", { method: "POST", body: JSON.stringify(body) });
  assert.equal(proposed.proposal.status, "validated");
  assert.equal(proposed.proposal.committable, true);
  assert.equal(proposed.proposal.sourceRefs[0].resolved, true);
  assert.match(proposed.proposalId, /^proposal-[a-f0-9]{32}$/);
  assert.equal(proposed.proposal.receiptHash.length, 64);
  assert.equal(proposed.revision, capabilities.world.revision, "proposal does not advance the world revision");
  const proposalReceipt = await request(`/api/v1/query/town/agent/proposal?worldId=${encodeURIComponent(worldId)}&proposalId=${encodeURIComponent(proposed.proposalId)}`);
  assert.equal(proposalReceipt.proposal.proposalId, proposed.proposalId);
  assert.equal(proposalReceipt.proposal.receiptHash, proposed.proposal.receiptHash);
  const proposalFile = `data/replay-store/agent-proposals/${proposed.proposalId}.json`;
  const proposalFileContents = fs.readFileSync(proposalFile, "utf8");
  try {
    const tampered = JSON.parse(proposalFileContents);
    tampered.reason = "tampered-after-write";
    fs.writeFileSync(proposalFile, `${JSON.stringify(tampered, null, 2)}\n`, "utf8");
    const tamperedReceipt = await failure(`/api/v1/query/town/agent/proposal?worldId=${encodeURIComponent(worldId)}&proposalId=${encodeURIComponent(proposed.proposalId)}`, {}, 404);
    assert.equal(tamperedReceipt.code, "PROPOSAL_NOT_FOUND");
  } finally {
    fs.writeFileSync(proposalFile, proposalFileContents, "utf8");
  }
  const proposedAgain = await request("/api/v1/command/town/agent/propose", { method: "POST", body: JSON.stringify(body) });
  assert.equal(proposedAgain.replayed, true, "same proposal reuses the persisted receipt");
  assert.equal(proposedAgain.proposalId, proposed.proposalId);
  const unresolved = await failure("/api/v1/command/town/agent/propose", {
    method: "POST",
    body: JSON.stringify({ ...body, actionId: "agent-control-api-smoke-unresolved", sourceRefs: ["event:missing-source"] })
  }, 400);
  assert.equal(unresolved.code, "BAD_REQUEST");
  const unresolvedCommit = await failure("/api/v1/command/town/agent/commit", {
    method: "POST",
    body: JSON.stringify({ ...body, actionId: "agent-control-api-smoke-unresolved-commit", sourceRefs: ["event:missing-source"] })
  }, 400);
  assert.equal(unresolvedCommit.code, "BAD_REQUEST");
  const committed = await request("/api/v1/command/town/agent/commit", { method: "POST", body: JSON.stringify({ ...body, proposalId: proposed.proposalId }) });
  assert.equal(committed.replayed, false);
  assert.equal(committed.intervention.actionId, body.actionId);
  assert.equal(committed.proposalId, proposed.proposalId);
  assert.equal(committed.runtime.agentDecisionTraceSummary.schema, "agent-decision-trace-links.v1");
  assert.equal(committed.runtime.agentDecisionTraceSummary.pendingInterventionCount >= 1, true);
  const replayed = await request("/api/v1/command/town/agent/commit", { method: "POST", body: JSON.stringify({ ...body, proposalId: proposed.proposalId }) });
  assert.equal(replayed.replayed, true);
  const mismatch = await failure("/api/v1/command/town/agent/commit", {
    method: "POST",
    body: JSON.stringify({ ...body, proposalId: proposed.proposalId, reason: "Different payload" })
  }, 409);
  assert.equal(mismatch.code, "PROPOSAL_MISMATCH");
  const stale = await failure("/api/v1/command/town/agent/commit", { method: "POST", body: JSON.stringify({ ...body, actionId: "agent-control-api-smoke-stale" }) });
  assert.equal(stale.code, "RUNTIME_REVISION_CONFLICT");

  const populationCapabilities = await request(`/api/v1/query/town/agent-capabilities?worldId=${encodeURIComponent(worldId)}`);
  const populationSourceEvent = created.events.find((event) => event.worldId === worldId);
  assert.ok(populationSourceEvent, "population-flow Agent smoke needs an authoritative source event");
  const populationBody = {
    worldId,
    actionId: "agent-control-api-smoke-population-1",
    expectedRevision: populationCapabilities.world.revision,
    reason: "Use one authoritative event to test an auditable newcomer flow.",
    sourceRefs: [`event:${populationSourceEvent.id}`],
    populationFlow: {
      sourceEventId: populationSourceEvent.id,
      sourceCandidateId: "agent-control-api-smoke-candidate",
      arrivalLocationId: populationSourceEvent.locationId
    }
  };
  const population = await request("/api/v1/command/town/agent/population-flow", { method: "POST", body: JSON.stringify(populationBody) });
  assert.equal(population.schema, "agent-control.v1");
  assert.equal(population.replayed, false);
  assert.equal(population.populationFlow.agentActionId, populationBody.actionId);
  assert.deepEqual(population.populationFlow.agentSourceRefs, populationBody.sourceRefs);
  assert.equal(population.sourceRefs[0].resolved, true);
  assert.equal(population.arrivalEvent.causedByEventIds[0], populationSourceEvent.id);
  const populationReplay = await request("/api/v1/command/town/agent/population-flow", { method: "POST", body: JSON.stringify(populationBody) });
  assert.equal(populationReplay.replayed, true);
  assert.equal(populationReplay.populationFlow.id, population.populationFlow.id);
  const populationMismatch = await failure("/api/v1/command/town/agent/population-flow", {
    method: "POST",
    body: JSON.stringify({ ...populationBody, reason: "Different population-flow payload" })
  }, 409);
  assert.equal(populationMismatch.code, "BAD_REQUEST");

  let candidateQueue = await request(`/api/v1/query/town/candidates?worldId=${encodeURIComponent(worldId)}`);
  let caseCandidate = candidateQueue.candidates.find((candidate) => candidate.validation?.valid);
  for (let attempt = 0; attempt < 5 && !caseCandidate; attempt += 1) {
    await request("/api/v1/command/town/runtime/step", {
      method: "POST",
      body: JSON.stringify({ worldId, steps: 8 })
    });
    candidateQueue = await request(`/api/v1/query/town/candidates?worldId=${encodeURIComponent(worldId)}`);
    caseCandidate = candidateQueue.candidates.find((candidate) => candidate.validation?.valid);
  }
  assert.ok(caseCandidate, "case-extract Agent smoke needs a valid persisted candidate");
  const caseProof = await request(`/api/v1/query/town/emergence-proof?worldId=${encodeURIComponent(worldId)}&candidateId=${encodeURIComponent(caseCandidate.id)}`);
  assert.ok(caseProof.candidate.triggeredEventId, "case-extract Agent smoke needs a source-backed triggered event");
  const caseCapabilities = await request(`/api/v1/query/town/agent-capabilities?worldId=${encodeURIComponent(worldId)}`);
  const caseBody = {
    worldId,
    actionId: "agent-control-api-smoke-case-1",
    expectedRevision: caseCapabilities.world.revision,
    reason: "Use the validated source-backed candidate to test the golden investigation handoff.",
    sourceRefs: [`candidate:${caseCandidate.id}`, `event:${caseProof.candidate.triggeredEventId}`],
    candidateId: caseCandidate.id
  };
  const extractedCase = await request("/api/v1/command/town/agent/case-extract", { method: "POST", body: JSON.stringify(caseBody) });
  assert.equal(extractedCase.schema, "agent-control.v1");
  assert.equal(extractedCase.replayed, false);
  assert.equal(extractedCase.receipt.schema, "agent-case-extraction-receipt.v1");
  assert.equal(extractedCase.receipt.actionId, caseBody.actionId);
  assert.equal(extractedCase.receipt.candidateId, caseCandidate.id);
  assert.equal(extractedCase.receipt.caseId, extractedCase.activeCase.id);
  assert.equal(extractedCase.playableIntake.routeIntegrity.playable, true);
  assert.equal(extractedCase.sourceRefs.every((ref) => ref.resolved), true);
  const extractedCaseReplay = await request("/api/v1/command/town/agent/case-extract", { method: "POST", body: JSON.stringify(caseBody) });
  assert.equal(extractedCaseReplay.replayed, true);
  assert.equal(extractedCaseReplay.receipt.receiptHash, extractedCase.receipt.receiptHash);
  const caseMismatch = await failure("/api/v1/command/town/agent/case-extract", {
    method: "POST",
    body: JSON.stringify({ ...caseBody, reason: "Different case extraction payload" })
  }, 409);
  assert.equal(caseMismatch.code, "BAD_REQUEST");

  const reviewBody = {
    worldId,
    actionId: "agent-control-api-smoke-review-1",
    expectedRevision: extractedCase.revision,
    reason: "Verify the extracted case route and room projection before exposing it to a player.",
    sourceRefs: [...caseBody.sourceRefs, `case:${extractedCase.activeCase.id}`],
    caseId: extractedCase.activeCase.id
  };
  const reviewed = await request("/api/v1/command/town/agent/review", { method: "POST", body: JSON.stringify(reviewBody) });
  assert.equal(reviewed.schema, "agent-control.v1");
  assert.equal(reviewed.replayed, false);
  assert.equal(reviewed.receipt.schema, "agent-case-review-receipt.v1");
  assert.equal(reviewed.receipt.caseId, reviewBody.caseId);
  assert.equal(reviewed.review.roomProjection.schema, "investigation-room-projection.v1");
  assert.equal(reviewed.review.roomProjection.mode, "review");
  assert.equal(reviewed.review.roomProjection.integrity.traceable, true);
  assert.equal(reviewed.review.routeIntegrity.playable, true);
  assert.equal(reviewed.sourceRefs.every((ref) => ref.resolved), true);
  await request("/api/v1/command/town/runtime/step", {
    method: "POST",
    body: JSON.stringify({ worldId, steps: 1 })
  });
  const reviewedReplay = await request("/api/v1/command/town/agent/review", { method: "POST", body: JSON.stringify(reviewBody) });
  assert.equal(reviewedReplay.replayed, true);
  assert.equal(reviewedReplay.receipt.receiptHash, reviewed.receipt.receiptHash);
  const reviewMismatch = await failure("/api/v1/command/town/agent/review", {
    method: "POST",
    body: JSON.stringify({ ...reviewBody, reason: "Different review payload" })
  }, 409);
  assert.equal(reviewMismatch.code, "BAD_REQUEST");

  const benchmarkCapabilities = await request(`/api/v1/query/town/agent-capabilities?worldId=${encodeURIComponent(worldId)}`);
  const benchmarkBody = {
    worldId,
    actionId: "agent-control-api-smoke-benchmark-1",
    expectedRevision: benchmarkCapabilities.world.revision,
    reason: "Measure emergence, route certification, and auto-solve rates for this world revision.",
    sourceRefs: [`world:${worldId}`],
    seedCount: 10
  };
  const benchmark = await request("/api/v1/command/town/agent/benchmark", { method: "POST", body: JSON.stringify(benchmarkBody) });
  assert.equal(benchmark.schema, "agent-control.v1");
  assert.equal(benchmark.replayed, false);
  assert.equal(benchmark.receipt.schema, "agent-benchmark-receipt.v1");
  assert.equal(benchmark.receipt.seedCount, 10);
  assert.equal(benchmark.report.seedCount, 10);
  assert.equal(benchmark.report.results.length, 10);
  assert.equal(benchmark.sourceRefs[0].resolved, true);
  await request("/api/v1/command/town/runtime/step", {
    method: "POST",
    body: JSON.stringify({ worldId, steps: 1 })
  });
  const benchmarkReplay = await request("/api/v1/command/town/agent/benchmark", { method: "POST", body: JSON.stringify(benchmarkBody) });
  assert.equal(benchmarkReplay.replayed, true);
  assert.equal(benchmarkReplay.receipt.receiptHash, benchmark.receipt.receiptHash);
  const benchmarkMismatch = await failure("/api/v1/command/town/agent/benchmark", {
    method: "POST",
    body: JSON.stringify({ ...benchmarkBody, seedCount: 20 })
  }, 409);
  assert.equal(benchmarkMismatch.code, "BAD_REQUEST");

  const exportCapabilities = await request(`/api/v1/query/town/agent-capabilities?worldId=${encodeURIComponent(worldId)}`);
  const exportBody = {
    worldId,
    actionId: "agent-control-api-smoke-export-1",
    expectedRevision: exportCapabilities.world.revision,
    reason: "Export the selected WorldPackage with an auditable file manifest and source binding.",
    sourceRefs: [`world:${worldId}`, "package:dock-court-market-town"],
    packageId: "dock-court-market-town"
  };
  const exported = await request("/api/v1/command/town/agent/package-export", { method: "POST", body: JSON.stringify(exportBody) });
  assert.equal(exported.schema, "agent-control.v1");
  assert.equal(exported.replayed, false);
  assert.equal(exported.receipt.schema, "agent-package-export-receipt.v1");
  assert.equal(exported.receipt.packageId, exportBody.packageId);
  assert.equal(exported.report.format, "folder");
  assert.equal(exported.report.validation.ok, true);
  assert.equal(exported.report.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)), true);
  assert.equal(exported.sourceRefs.every((ref) => ref.resolved), true);
  const exportReplay = await request("/api/v1/command/town/agent/package-export", { method: "POST", body: JSON.stringify(exportBody) });
  assert.equal(exportReplay.replayed, true);
  assert.equal(exportReplay.receipt.receiptHash, exported.receipt.receiptHash);
  const exportMismatch = await failure("/api/v1/command/town/agent/package-export", {
    method: "POST",
    body: JSON.stringify({ ...exportBody, reason: "Different package export payload" })
  }, 409);
  assert.equal(exportMismatch.code, "BAD_REQUEST");

  console.log(JSON.stringify({ ok: true, suite: "agent-control-api-smoke", schema: capabilities.manifest.schema, worldId, actionId: body.actionId, replayed: replayed.replayed, populationActionId: populationBody.actionId, populationReplayed: populationReplay.replayed, caseActionId: caseBody.actionId, caseReplayed: extractedCaseReplay.replayed, reviewActionId: reviewBody.actionId, reviewReplayed: reviewedReplay.replayed, benchmarkActionId: benchmarkBody.actionId, benchmarkReplayed: benchmarkReplay.replayed, exportActionId: exportBody.actionId, exportReplayed: exportReplay.replayed, staleCode: stale.code }));
} finally {
  await server?.cleanup();
}
