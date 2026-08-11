import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFile(path.join(root, file), "utf8");

const [page, worldSession, readQueries, launch, transient, choices, lifecycle, persistence] = await Promise.all([
  read("app/page.tsx"),
  read("app/hooks/useWorldSessionActions.ts"),
  read("app/hooks/useInvestigationReadQueries.ts"),
  read("app/hooks/useCampaignLaunchActions.ts"),
  read("app/hooks/useWorkspaceLifecycleEffects.ts"),
  read("app/hooks/useCampaignWorldChoiceActions.ts"),
  read("app/hooks/usePersistentTownLifecycle.ts"),
  read("app/lib/world-session-persistence.ts")
]);

for (const method of ["persist", "hydrateStatic", "currentStaticState", "hydrateCase", "createWorld", "loadWorld", "tickWorld", "switchRuntime", "switchCaseTemplate"]) {
  assert.match(worldSession, new RegExp(`\\b${method}\\b`), `World Session owns ${method}`);
}
for (const method of ["startSelectedCampaign", "continueSavedCampaign"]) {
  assert.match(launch, new RegExp(`\\b${method}\\b`), `Campaign Launch owns ${method}`);
}
assert.match(readQueries, /loadLatestLiveEval/);
assert.match(readQueries, /query\/world\/map/);
assert.match(readQueries, /query\/case\/deduction-graph/);
assert.match(transient, /setInterval/);
assert.match(transient, /setTimeout/);

for (const endpoint of ["/api/worlds/create", "/api/worlds/", "/api/ai/live-eval/latest", "/api/v1/query/world/map", "/api/v1/query/case/deduction-graph", "/api/v1/command/town/world-pack/select", "/api/v1/command/town/runtime/start", "/api/v1/command/town/runtime/step"]) {
  const owner = endpoint.includes("live-eval") || endpoint.includes("query/")
    ? readQueries
    : endpoint.includes("world-pack") || endpoint.includes("runtime/start") || endpoint.includes("runtime/step")
      ? launch
      : worldSession;
  assert.equal(owner.includes(endpoint), true, `${endpoint} remains in its adapter`);
  assert.equal(page.includes(endpoint), false, `${endpoint} is absent from the root page`);
}

assert.equal(/\b(fetch|postJson|postV1|getV1)\s*\(/.test(page), false, "root page has no request calls");
for (const source of [transient]) {
  assert.equal(/\/api\/|\b(fetch|postJson|postV1|getV1)\s*\(/.test(source), false, "request-free lifecycle boundary has no request authority");
}
assert.match(persistence, /detective-town-launch-v1/);
assert.match(persistence, /WORLD_BOOTSTRAP_STORAGE_KEY = "detective-town-bootstrap-v1"/);
assert.match(worldSession, /normalizeWorldSessionPointer/);
assert.match(worldSession, /serializeWorldSessionPointer/);
assert.match(worldSession, /initialized\.current/);
const runtimeGuard = worldSession.indexOf("const selectedRuntime = resolveRuntimeMode()");
const staticBranch = worldSession.indexOf('if (selectedRuntime === "static-demo")', runtimeGuard);
const liveEvalCall = worldSession.indexOf("loadLatestLiveEval()", runtimeGuard);
const bootstrapCreate = worldSession.indexOf('createWorld("server"', runtimeGuard);
assert.ok(runtimeGuard >= 0 && staticBranch > runtimeGuard && liveEvalCall > staticBranch && bootstrapCreate > liveEvalCall, "bootstrap resolves runtime and preserves Static guard before Server requests");
const bootstrapRead = worldSession.indexOf("sessionStorage.getItem(WORLD_BOOTSTRAP_STORAGE_KEY)", runtimeGuard);
assert.ok(bootstrapRead > staticBranch, "Static returns before the Server bootstrap pointer is read");
assert.match(worldSession, /sessionStorage\.setItem\(WORLD_BOOTSTRAP_STORAGE_KEY, "pending"\)/, "bootstrap claims a synchronous pending sentinel before world creation");
assert.doesNotMatch(worldSession, /localStorage\.(?:getItem|setItem|removeItem)\(WORLD_BOOTSTRAP_STORAGE_KEY\)/, "temporary bootstrap state never enters durable Continue storage");

const launchOrder = [
  'createWorld("server"',
  "/api/v1/command/town/world-pack/select",
  "/api/v1/command/town/runtime/start",
  "for (let attempt = 0; attempt < 5",
  "/api/v1/command/town/runtime/step",
  "const extracted = await extractPersistentCandidate",
  "persist(createdWorld.id, \"\")"
].map((needle) => launch.indexOf(needle));
assert.equal(launchOrder.every((index) => index >= 0), true, "Campaign launch contains every bounded phase");
for (let index = 1; index < launchOrder.length; index += 1) assert.ok(launchOrder[index] > launchOrder[index - 1], "Campaign launch phase order remains stable");
assert.match(launch, /createWorld\("server", \{ saveAsContinue: false, campaignReady: true, applyToClient: false \}\)/, "Campaign creation remains staged until route-integrity extraction succeeds");
assert.doesNotMatch(launch, /\bset(?:World|Events|TownRuntime|TownQueue)\s*\(/, "Campaign launch does not apply intermediate server state to the player workspace");
assert.match(launch, /if \(!loaded\) throw/);
assert.match(choices, /steps: 0/);
assert.match(choices, /investigatorHeadquartersDecision/);
assert.match(lifecycle, /appMode !== "persistent-town"/);

const budgets = [
  ["app/page.tsx", 1100],
  ["app/hooks/useWorldSessionActions.ts", 500],
  ["app/hooks/useCampaignLaunchActions.ts", 300],
  ["app/hooks/useInvestigationReadQueries.ts", 250],
  ["app/hooks/useWorkspaceLifecycleEffects.ts", 150]
];
for (const [file, maximum] of budgets) {
  const count = (await read(file)).split(/\r?\n/).length;
  assert.equal(count < maximum, true, `${file} remains below ${maximum} lines (actual ${count})`);
}

console.log(JSON.stringify({
  ok: true,
  suite: "world-session-boundaries",
  checks: ["adapter-surface", "request-ownership", "root-composition", "static-guard", "bootstrap-idempotence", "campaign-staging", "campaign-order", "headquarters-zero-tick", "lifecycle-readonly", "line-budgets"]
}));
