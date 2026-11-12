import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const read = (file) => fs.readFile(path.join(root, file), "utf8");

const [page, worldSession, readQueries, launch, transient, choices, lifecycle, persistence] = await Promise.all([
  read("app/legacy/page.tsx"),
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
  ["app/legacy/page.tsx", 1100],
  ["app/hooks/useWorldSessionActions.ts", 500],
  ["app/hooks/useCampaignLaunchActions.ts", 300],
  ["app/hooks/useInvestigationReadQueries.ts", 250],
  ["app/hooks/useWorkspaceLifecycleEffects.ts", 150]
];
for (const [file, maximum] of budgets) {
  const count = (await read(file)).split(/\r?\n/).length;
  assert.equal(count < maximum, true, `${file} remains below ${maximum} lines (actual ${count})`);
}

// Exercise the actual adapter callbacks with deterministic controller setters
// and network replies. Bootstrap effects are outside this callback regression;
// no browser, server, storage, or alternate copy of the request logic is used.
const networkReplies = [];
const postReplies = [];
const refs = [];
let refCursor = 0;
const hookModule = { exports: {} };
const hookCode = ts.transpileModule(worldSession, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
new Function("require", "module", "exports", "fetch", hookCode)((name) => {
  if (name === "react") return { useRef: (initial) => refs[refCursor++] ||= { current: initial }, useEffect: () => {} };
  if (name === "@/app/localization/locale-context") return { useAppLocale: () => ({ t: (key) => key }) };
  if (name === "@/app/lib/client-runtime") return {
    apiUrl: (url) => url,
    postJson: async (url) => { assert.ok(postReplies.length, `Unexpected POST ${url}`); return postReplies.shift(); }
  };
  if (name === "@/app/lib/world-session-persistence" || name === "@/lib/engine") return {};
  throw new Error(`Unexpected hook dependency ${name}`);
}, hookModule, hookModule.exports, async (url) => {
  assert.ok(networkReplies.length, `Unexpected fetch ${url}`);
  return { status: 200, json: async () => networkReplies.shift() };
});

const caseFixture = (id) => ({ id, generationProfile: { sceneLocationId: "scene", culpritId: "person" }, deductionCase: { characters: [{ id: "person", role: "证人" }] } });
const sessionFixture = (worldId, caseId) => ({ id: `session-${worldId}-${caseId}`, worldId, caseId, judgement: { accepted: true }, discoveredEvidenceIds: [], interrogationLog: [] });
const investigation = {
  world: { id: "world-old" }, activeCase: caseFixture("case-old"), events: [],
  session: sessionFixture("world-old", "case-old"), runtimeMode: "server", progress: {},
  revealText: "上一局已经返回的解答", lastAiSafety: { factContract: { caseId: "case-old" }, revealEval: { accepted: true } }
};
for (const name of ["World", "Events", "ActiveCase", "Session", "Sessions", "WorldIdInput", "TimeValue", "SelectedSceneId", "SelectedCharacterId", "Snapshot", "Theory", "Status", "RevealText", "LastAiSafety", "Busy", "RuntimeMode", "Progress"]) {
  const key = `${name[0].toLowerCase()}${name.slice(1)}`;
  investigation[`set${name}`] = (value) => { investigation[key] = typeof value === "function" ? value(investigation[key]) : value; };
}
const noOp = () => {};
const input = {
  investigation,
  campaign: { setFrontDoorOpen: noOp, setFrontDoorStatus: noOp, continueWorldId: "", continueSessionId: "", setContinueWorldId: noOp, setContinueSessionId: noOp },
  town: { setTownRuntime: noOp, setTownQueue: noOp, setSelectedAgentCandidates: noOp },
  replay: { setReplaying: noOp, setServerPlaythroughSummary: noOp },
  campaignStudy: { recordMeaningfulAction: noOp }, initialProgress: {}, loadLatestLiveEval: async () => {}
};
const renderHook = () => { refCursor = 0; return hookModule.exports.useWorldSessionActions(input); };
const setReturnedAnswer = () => {
  investigation.revealText = "当前局已经返回的解答";
  investigation.lastAiSafety = { factContract: { caseId: investigation.activeCase.id }, revealEval: { accepted: true } };
};
const queueLoaded = (worldId, caseId) => networkReplies.push(
  { ok: true, world: { id: worldId }, activeCase: caseFixture(caseId), sessions: [sessionFixture(worldId, caseId)] },
  { events: [] }
);

queueLoaded("world-new", "case-new");
assert.ok(await renderHook().loadWorld("world-new", "", { saveAsContinue: false }));
assert.equal(investigation.session.judgement.accepted, true);
assert.equal(investigation.session.caseId, "case-new");
assert.equal(investigation.revealText, "", "loading an already-accepted case cannot reuse the previous answer");
assert.equal(investigation.lastAiSafety, null, "the previous reveal fact contract is cleared with its text");

setReturnedAnswer();
queueLoaded("world-new", "case-new");
await renderHook().loadWorld("world-new", "", { saveAsContinue: false });
assert.equal(investigation.revealText, "", "explicitly reloading the same saved case requires a fresh answer response");
assert.equal(investigation.lastAiSafety, null);

setReturnedAnswer();
const currentAnswer = investigation.revealText;
const currentSafety = investigation.lastAiSafety;
postReplies.push({ world: { id: "world-new" }, activeCase: caseFixture("case-new"), events: [{ id: "new-event" }] });
await renderHook().tickWorld();
assert.equal(investigation.revealText, currentAnswer, "an ordinary tick of the same case preserves the unlocked answer");
assert.equal(investigation.lastAiSafety, currentSafety);
assert.equal(investigation.events.length, 1);

postReplies.push({ world: { id: "world-new" }, activeCase: caseFixture("case-next"), events: [] });
await renderHook().tickWorld();
assert.equal(investigation.revealText, "", "a tick that changes the case invalidates its old answer");
assert.equal(investigation.lastAiSafety, null);

setReturnedAnswer();
networkReplies.push({ ok: false, error: "controlled load failure" });
assert.equal(await renderHook().loadWorld("world-unavailable", "", { saveAsContinue: false }), null);
assert.equal(investigation.revealText, "当前局已经返回的解答", "a failed load leaves the still-current case answer intact");

renderHook().hydrateCase({ world: { id: "world-extracted" }, activeCase: caseFixture("case-extracted") });
assert.equal(investigation.revealText, "", "direct case extraction invalidates the previous answer");
assert.equal(investigation.lastAiSafety, null);
setReturnedAnswer();
investigation.runtimeMode = "static-demo";
renderHook().switchRuntime("server");
assert.equal(investigation.revealText, "");
assert.equal(investigation.lastAiSafety, null);
assert.equal(networkReplies.length + postReplies.length, 0, "all controlled API replies were consumed");

console.log(JSON.stringify({
  ok: true,
  suite: "world-session-boundaries",
  checks: ["adapter-surface", "request-ownership", "root-composition", "static-guard", "bootstrap-idempotence", "campaign-staging", "campaign-order", "headquarters-zero-tick", "lifecycle-readonly", "line-budgets", "accepted-case-load-clears-answer", "same-case-reload-clears-answer", "same-case-tick-retains-answer", "case-changing-tick-clears-answer", "failed-load-retains-answer", "extraction-clears-answer", "runtime-switch-clears-answer"]
}));
