import assert from "node:assert/strict";
import fs from "node:fs";
import { loadEngineForTool } from "./load-engine-for-tools.mjs";

const engine = await loadEngineForTool("agent-control");
const route = fs.readFileSync("app/api/v1/command/town/agent/commit/route.ts", "utf8");
const populationRoute = fs.readFileSync("app/api/v1/command/town/agent/population-flow/route.ts", "utf8");
const caseExtractRoute = fs.readFileSync("app/api/v1/command/town/agent/case-extract/route.ts", "utf8");
const reviewRoute = fs.readFileSync("app/api/v1/command/town/agent/review/route.ts", "utf8");
const reviewReceipt = fs.readFileSync("app/api/v1/_agent-review.ts", "utf8");
const benchmarkRoute = fs.readFileSync("app/api/v1/command/town/agent/benchmark/route.ts", "utf8");
const benchmarkReceipt = fs.readFileSync("app/api/v1/_agent-benchmark.ts", "utf8");
const packageExportRoute = fs.readFileSync("app/api/v1/command/town/agent/package-export/route.ts", "utf8");
const packageExportReceipt = fs.readFileSync("app/api/v1/_agent-package-export.ts", "utf8");
const proposeRoute = fs.readFileSync("app/api/v1/command/town/agent/propose/route.ts", "utf8");
const proposalStore = fs.readFileSync("app/api/v1/_agent-proposals.ts", "utf8");
const proposalQueryRoute = fs.readFileSync("app/api/v1/query/town/agent/proposal/route.ts", "utf8");
const worldPackageRegistry = fs.readFileSync("app/api/v1/_world-package-registry.ts", "utf8");
const worldPackageExportRoute = fs.readFileSync("app/api/v1/command/town/world-pack/export/route.ts", "utf8");
const worldPackageValidateRoute = fs.readFileSync("app/api/v1/command/town/world-pack/validate/route.ts", "utf8");
const worldPackageCatalog = fs.readFileSync("lib/world-package-catalog.ts", "utf8");
const capabilityRoute = fs.readFileSync("app/api/v1/query/town/agent-capabilities/route.ts", "utf8");
const manifest = engine.buildTownAgentControlManifest();

assert.equal(manifest.schema, "agent-control.v1");
assert.equal(manifest.compatibility.schema, "world-replay-compat.v1");
assert.equal(manifest.invariants.commitsAreCasBound, true);
assert.equal(manifest.invariants.decisionTraceLinksAudited, true);
assert.equal(manifest.commands.find((command) => command.id === "commit.intervention")?.requiresRevision, true);
assert.equal(manifest.commands.find((command) => command.id === "commit.intervention")?.requiresSourceRefs, true);
assert.equal(manifest.commands.find((command) => command.id === "commit.population-flow")?.status, "implemented");
assert.equal(manifest.commands.find((command) => command.id === "commit.population-flow")?.requiresRevision, true);
assert.equal(manifest.commands.find((command) => command.id === "commit.population-flow")?.requiresSourceRefs, true);
assert.equal(manifest.commands.find((command) => command.id === "commit.case-extract")?.status, "implemented");
assert.equal(manifest.commands.find((command) => command.id === "commit.case-extract")?.requiresRevision, true);
assert.equal(manifest.commands.find((command) => command.id === "commit.case-extract")?.requiresSourceRefs, true);
assert.equal(manifest.commands.find((command) => command.id === "review.case")?.status, "implemented");
assert.equal(manifest.commands.find((command) => command.id === "review.case")?.mutates, false);
assert.equal(manifest.commands.find((command) => command.id === "review.case")?.requiresRevision, true);
assert.equal(manifest.commands.find((command) => command.id === "benchmark.emergence")?.status, "implemented");
assert.equal(manifest.commands.find((command) => command.id === "benchmark.emergence")?.mutates, false);
assert.equal(manifest.commands.find((command) => command.id === "benchmark.emergence")?.requiresSourceRefs, true);
assert.equal(manifest.commands.find((command) => command.id === "package.export")?.status, "implemented");
assert.equal(manifest.commands.find((command) => command.id === "package.export")?.requiresRevision, true);
assert.equal(manifest.commands.find((command) => command.id === "package.export")?.requiresSourceRefs, true);
assert.equal(manifest.commands.find((command) => command.id === "propose.intervention")?.status, "implemented");
assert.equal(manifest.commands.find((command) => command.id === "observe.proposal-receipt")?.status, "implemented");
assert.equal(manifest.commands.find((command) => command.id === "package.world")?.requiresRevision, false);
assert.equal(manifest.commands.find((command) => command.id === "package.world")?.requiresSourceRefs, false);
assert.match(route, /runtimeRevision\(/, "commit route performs a runtime CAS check");
assert.match(route, /replayed: true/, "commit route returns an idempotent replay receipt");
assert.match(populationRoute, /validateAgentControlMetadata/, "population-flow executor validates Agent metadata");
assert.match(populationRoute, /resolveRuntimeAgentSourceRefs/, "population-flow executor resolves source references");
assert.match(populationRoute, /RUNTIME_REVISION_CONFLICT/, "population-flow executor enforces runtime CAS");
assert.match(populationRoute, /agentActionId/, "population-flow executor persists an action identity");
assert.match(populationRoute, /replayed: true/, "population-flow executor returns an idempotent replay receipt");
assert.match(caseExtractRoute, /validateAgentControlMetadata/, "case extractor validates Agent metadata");
assert.match(caseExtractRoute, /resolveRuntimeAgentSourceRefs/, "case extractor resolves source references");
assert.match(caseExtractRoute, /RUNTIME_REVISION_CONFLICT/, "case extractor enforces runtime CAS");
assert.match(caseExtractRoute, /agentCaseExtractionReceipts/, "case extractor persists a durable action receipt");
assert.match(caseExtractRoute, /replayed: true/, "case extractor returns an idempotent replay receipt");
assert.match(reviewRoute, /buildInvestigationRoomProjection/, "reviewer checks the deterministic room projection");
assert.match(reviewRoute, /buildPlayableCaseIntake/, "reviewer checks the playable investigation intake");
assert.match(reviewRoute, /saveAgentCaseReviewReceipt/, "reviewer persists a hash-bound review receipt");
assert.match(reviewReceipt, /agent-case-review-receipt\.v1/, "review receipt has a versioned schema");
assert.match(reviewReceipt, /loadAgentCaseReviewReceipt/, "review receipt can be recovered across later runtime revisions");
assert.match(benchmarkRoute, /runEmergenceBenchmark/, "benchmark executor runs the deterministic emergence benchmark");
assert.match(benchmarkRoute, /validateAgentControlMetadata/, "benchmark executor validates Agent metadata");
assert.match(benchmarkRoute, /sourceRefs must include the benchmark world/, "benchmark executor binds the world source");
assert.match(benchmarkReceipt, /agent-benchmark-receipt\.v1/, "benchmark receipt has a versioned schema");
assert.match(benchmarkReceipt, /loadAgentBenchmarkReceipt/, "benchmark receipt can be recovered across later runtime revisions");
assert.match(packageExportRoute, /exportWorldPackage/, "package exporter invokes the audited WorldPackage export");
assert.match(packageExportRoute, /packageRefs|package:/, "package exporter binds the selected WorldPackage source");
assert.match(packageExportRoute, /saveAgentPackageExportReceipt/, "package exporter persists a hash-bound export receipt");
assert.match(packageExportReceipt, /agent-package-export-receipt\.v1/, "package export receipt has a versioned schema");
assert.match(proposeRoute, /resolveRuntimeAgentSourceRefs/, "proposal route resolves source references");
assert.match(proposalStore, /committable: true/, "proposal receipt returns a validated commit handoff");
assert.match(proposeRoute, /saveAgentProposalReceipt/, "proposal route persists a cross-process receipt");
assert.match(route, /proposalReceiptMatches/, "commit route can verify the proposal payload");
assert.match(proposalStore, /agent-proposal-receipt\.v1/, "proposal receipt has a versioned schema");
assert.match(proposalStore, /createHash\("sha256"\)/, "proposal receipt has a stable content hash");
assert.match(proposalQueryRoute, /loadAgentProposalReceipt/, "proposal receipt can be read across processes");
assert.match(worldPackageRegistry, /WorldPackage content hash is required/, "WorldPackage registry fails closed when a package hash is missing");
assert.match(worldPackageRegistry, /world-package-receipt\.v1/, "WorldPackage registry emits a versioned package receipt");
assert.match(worldPackageRegistry, /fileReceipts/, "WorldPackage receipt binds individual source file hashes");
assert.match(worldPackageRegistry, /assetManifest/, "WorldPackage receipt carries the optional asset provenance manifest");
assert.match(worldPackageCatalog, /auditWorldAssetManifestFiles/, "WorldPackage catalog verifies declared asset bytes and hashes");
assert.match(worldPackageCatalog, /Asset path must stay inside the package root/, "WorldPackage asset paths are sandboxed");
assert.match(worldPackageExportRoute, /worldPackageReceipt/, "WorldPackage export returns the package receipt");
assert.match(worldPackageValidateRoute, /worldPackageReceipt/, "WorldPackage validation returns the package receipt");
assert.match(capabilityRoute, /buildTownAgentControlManifest\(/, "capability route serves the engine manifest");

assert.deepEqual(engine.validateAgentControlMetadata({
  actionId: "action-1",
  expectedRevision: "runtime:0:0",
  reason: "brief-backed test",
  sourceRefs: ["brief:world-1"]
}), [], "valid agent metadata passes validation");
assert.deepEqual(engine.parseAgentSourceRef("package:dock-court-market-town"), { kind: "package", id: "dock-court-market-town" }, "package source references are part of the Agent grammar");
assert.equal(engine.validateWorldAssetManifest({
  schema: "world-asset-manifest.v1",
  packageId: "dock-court-market-town",
  version: "1.0.0",
  generatedAt: "2026-10-03T00:00:00.000Z",
  policy: { licenseRequired: true, humanReviewRequired: true, runtimeVerificationRequired: true },
  assets: []
}, "dock-court-market-town").ok, true, "asset provenance manifests have a strict versioned schema");
assert.ok(engine.validateAgentControlMetadata({ actionId: "bad", expectedRevision: "", reason: "x", sourceRefs: [] }).length >= 3, "invalid metadata fails closed");

console.log(JSON.stringify({
  ok: true,
  suite: "agent-control-contract",
  schema: manifest.schema,
  compatibility: manifest.compatibility.schema,
  implementedCommands: manifest.commands.filter((command) => command.status === "implemented").map((command) => command.id)
}));
