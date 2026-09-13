import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const engine = read("packages/engine/src/persistent-town.ts");
const route = read("app/api/v1/query/town/brief/route.ts");
const townRuntime = read("app/api/v1/_town-runtime.ts");
const playerRuntimeRoute = read("app/api/v1/query/town/runtime/route.ts");
const playerCandidatesRoute = read("app/api/v1/query/town/candidates/route.ts");
const playerStartRoute = read("app/api/v1/command/town/runtime/start/route.ts");
const playerStepRoute = read("app/api/v1/command/town/runtime/step/route.ts");
const playerExtractRoute = read("app/api/v1/command/town/case/extract/route.ts");
const playerWorldPackSelectRoute = read("app/api/v1/command/player/world-pack/select/route.ts");
const campaignLaunchHook = read("app/hooks/useCampaignLaunchActions.ts");
const discoverRoute = read("app/api/v1/command/investigation/discover/route.ts");
const submitTheoryRoute = read("app/api/v1/command/investigation/submit-theory/route.ts");
const lifecycleHook = read("app/hooks/usePersistentTownLifecycle.ts");
const choiceHook = read("app/hooks/useCampaignWorldChoiceActions.ts");
const liveEval = read("app/api/ai/live-eval/latest/route.ts");
const utils = read("app/api/v1/_utils.ts");
const adminAuthSmoke = read("scripts/run-admin-auth-smoke.mjs");
const surface = read("app/api/v1/_surface.ts");
const adminAuditRoute = read("app/api/v1/query/admin/audit/route.ts");
const adminMetricsRoute = read("app/api/v1/query/admin/metrics/route.ts");

const projectionStart = townRuntime.indexOf("export function publicTownQueue");
const projectionSection = projectionStart >= 0 ? townRuntime.slice(projectionStart) : "";
const safePlayerRoutes = [playerRuntimeRoute, playerCandidatesRoute, playerStartRoute, playerStepRoute, playerExtractRoute];

const checks = [
  ["revision-in-brief", engine.includes("revision: string") && engine.includes("revision: `${world.seed}:${activeRuntime.tick}`")],
  ["projection-schema", engine.includes('city-pulse.world-projection.v1')],
  ["projection-spoiler-safe", engine.includes("buildCityPulseWorldProjection") && engine.includes("signals: brief.recentSignals")],
  ["brief-route-returns-projection", route.includes("projection: buildCityPulseWorldProjection")],
  ["live-eval-empty-state-is-success", liveEval.includes("available: false") && !liveEval.includes('status: 404')],
  ["player-projection-omits-truth-ids", projectionSection.includes("publicTownQueue") && !projectionSection.includes("culpritId: candidate") && !projectionSection.includes("victimId: candidate")],
  ["player-projection-omits-source-ledger", projectionSection.includes("publicPlayerRuntime") && !projectionSection.includes("memoryIds: trace") && !projectionSection.includes("sourceMap: runtime")],
  ["player-routes-use-safe-runtime", playerRuntimeRoute.includes("publicPlayerRuntime") && playerStartRoute.includes("publicPlayerRuntime") && playerStepRoute.includes("publicPlayerRuntime")],
  ["player-routes-use-safe-queue", playerCandidatesRoute.includes("publicTownQueue") && playerStartRoute.includes("publicTownQueue") && playerStepRoute.includes("publicTownQueue") && playerExtractRoute.includes("publicTownQueue")],
  ["player-extract-redacts-case", playerExtractRoute.includes("publicPlayerCase(result.activeCase)")],
  ["runtime-start-idempotency-cas", playerStartRoute.includes("replayIdempotent") && playerStartRoute.includes("claimIdempotent") && playerStartRoute.includes("sessionRevision") && playerStartRoute.includes("runtimeRevision(result.runtime)")],
  ["runtime-step-idempotency-cas", playerStepRoute.includes("replayIdempotent") && playerStepRoute.includes("claimIdempotent") && playerStepRoute.includes("sessionRevision") && playerStepRoute.includes("runtimeRevision")],
  ["player-surface-tag", playerStartRoute.includes("PLAYER_RUNTIME_SURFACE") && playerStepRoute.includes("PLAYER_RUNTIME_SURFACE")],
  ["player-campaign-bootstrap-surface", playerWorldPackSelectRoute.includes("playerOk") && !playerWorldPackSelectRoute.includes("adminGuard") && !playerWorldPackSelectRoute.includes("adminOk") && campaignLaunchHook.includes("/api/v1/command/player/world-pack/select")],
  ["runtime-command-transaction", playerStartRoute.includes("runInTransaction") && playerStepRoute.includes("runInTransaction")],
  ["investigation-command-transaction", discoverRoute.includes("claimIdempotent") && discoverRoute.includes("runInTransaction") && submitTheoryRoute.includes("claimIdempotent") && submitTheoryRoute.includes("runInTransaction")],
  ["admin-surface-marker", utils.includes("adminOk") && utils.includes("x-runtime-surface")],
  ["admin-auth-guard", utils.includes("adminGuard") && utils.includes("ADMIN_UNAUTHORIZED") && adminAuthSmoke.includes("unauthorized-admin-401")],
  ["admin-rotation-audit", surface.includes("RUNTIME_ADMIN_TOKENS") && surface.includes("RUNTIME_ADMIN_SESSION_TOKEN") && utils.includes("recordAdminAuditEvent") && adminAuthSmoke.includes("audit-without-secrets")],
  ["admin-audit-query", adminAuditRoute.includes("adminGuard") && adminAuditRoute.includes("listAdminAuditEvents") && adminAuditRoute.includes("adminOk")],
  ["admin-metrics-query", adminMetricsRoute.includes("adminGuard") && adminMetricsRoute.includes("getAdminOperationalMetrics") && adminMetricsRoute.includes("adminOk")],
  ["runtime-command-revision", townRuntime.includes("world.persistentRuntime.commandRevision = expectedRevision + 1") && townRuntime.includes("saveWorldBundleIfRuntimeRevision")],
  ["client-sends-runtime-meta", lifecycleHook.includes("runtimeCommandMeta") && lifecycleHook.includes("sessionRevision") && choiceHook.includes("runtimeCommandMeta")]
];
const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
assert.equal(failed.length, 0, `failed checks: ${failed.join(", ")}`);
console.log(JSON.stringify({ ok: true, suite: "world-projection-contracts", checks: checks.map(([name]) => name) }, null, 2));
