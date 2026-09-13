import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (file) => fs.readFile(path.join(root, file), "utf8");
const artifacts = {
  registry: path.join(os.tmpdir(), `investigation-registry-${process.pid}.mjs`),
  model: path.join(os.tmpdir(), `investigation-workspace-${process.pid}.mjs`)
};

try {
  const registrySource = await read("app/campaign/investigation-action-registry.ts");
  await fs.writeFile(artifacts.registry, ts.transpileModule(registrySource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText, "utf8");
  const modelSource = await read("app/campaign/investigation-workspace-model.ts");
  const compiledModel = ts.transpileModule(modelSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText.replace('"./investigation-action-registry"', `"${pathToFileURL(artifacts.registry).href}"`);
  await fs.writeFile(artifacts.model, compiledModel, "utf8");
  const { buildPlayableInvestigationPath } = await import(`${pathToFileURL(artifacts.model).href}?test=${Date.now()}`);

  const input = {
    playableIntake: null,
    session: {
      id: "session-safe",
      discoveredEvidenceIds: ["clue-safe"],
      interrogationLog: [{ id: "entry-safe", characterId: "witness-safe" }]
    },
    notebookItems: [{ evidenceId: "clue-safe", discovered: true, challengeNpcIds: ["witness-safe"], locationId: "archive-safe" }],
    discoveredEvidence: [{ id: "clue-safe" }],
    dialogueLog: [{ id: "entry-safe", characterId: "witness-safe" }],
    playerTheoryEvidence: new Set(["clue-safe"]),
    characters: [{ id: "witness-safe", role: "Witness" }]
  };
  const before = structuredClone(input);
  const first = buildPlayableInvestigationPath(input);
  const second = buildPlayableInvestigationPath(structuredClone(input));
  assert.deepEqual(first, second, "same safe workspace state produces the same seven-step path");
  assert.deepEqual(input, before, "workspace projection does not mutate inputs");
  assert.deepEqual(first.map((step) => step.kind), ["join", "search", "question", "challenge", "select-evidence", "submit", "review-source"], "certified path order remains fixed");

  const [actionSource, playthroughSource, navigationSource, contextSource, guidedSource, coreSource, finalWorkspaceSource, surfaceSource, routeSource, replaySource, pageSource] = await Promise.all([
    read("app/hooks/useCertifiedInvestigationActions.ts"),
    read("app/hooks/useCertifiedPlaythroughActions.ts"),
    read("app/hooks/useInvestigationNavigationActions.ts"),
    read("app/hooks/useCommandDeckContext.ts"),
    read("app/hooks/useGuidedManualActions.ts"),
    read("app/components/InvestigationCoreActionsSurface.tsx"),
    read("app/components/CinematicDeductionBoard.tsx"),
    read("app/components/InvestigationSurface.tsx"),
    read("app/components/InvestigationRouteReviewSurface.tsx"),
    read("app/components/InvestigationDebriefReplaySurface.tsx"),
    read("app/page.tsx")
  ]);

  const adapterMethods = ["joinCase", "discoverEvidence", "discoverFirstSceneEvidence", "runInterrogationTarget", "interrogateSelected", "toggleTheoryEvidence", "revealSolution"];
  for (const method of adapterMethods) {
    assert.match(actionSource, new RegExp(`\\b${method}\\b`), `certified adapter exports ${method}`);
  }
  for (const endpoint of ["/api/players/join", "/api/investigation/discover", "/api/investigation/interrogate", "/api/investigation/reveal"]) {
    assert.equal(actionSource.includes(endpoint), true, `certified adapter owns ${endpoint}`);
    assert.equal(pageSource.includes(endpoint), false, `player page no longer owns ${endpoint}`);
  }
  assert.match(actionSource, /discoverDemoEvidence/);
  assert.match(actionSource, /interrogateDemoNpc/);
  assert.match(actionSource, /revealDemoSolution/);
  assert.equal(playthroughSource.includes("/api/v1/command/investigation/autosolve"), true, "playthrough adapter owns existing autosolve endpoint");
  assert.equal(pageSource.includes("/api/v1/command/investigation/autosolve"), false, "player page no longer owns autosolve request");
  assert.match(playthroughSource, /autoSolvePlayableCase/);

  const presentationSources = [navigationSource, coreSource, finalWorkspaceSource, surfaceSource, routeSource, replaySource];
  for (const source of presentationSources) {
    assert.doesNotMatch(source, /\/api\/|\bfetch\s*\(|\bpostV1\s*\(|\bpostJson\s*\(/, "navigation and presentation boundaries cannot construct requests");
  }
  assert.match(contextSource, /CertifiedInvestigationActionAdapter/);
  assert.match(contextSource, /actionAdapter\.discoverFirstSceneEvidence/);
  assert.match(contextSource, /actionAdapter\.runInterrogationTarget/);
  assert.match(guidedSource, /actionAdapter\.joinCase/);
  assert.match(guidedSource, /actionAdapter\.discoverEvidence/);
  assert.match(coreSource, /FinalDetectiveWorkspace/);
  assert.match(finalWorkspaceSource, /executeCertifiedInvestigationStep\(\{[\s\S]*?adapter: actionAdapter/, "the workspace passes the certified adapter to the shared executor");
  const dispatcherSource = await read("app/campaign/execute-certified-investigation-step.ts");
  const dispatcherRuntime = ts.transpileModule(dispatcherSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const { executeCertifiedInvestigationStep } = await import(`data:text/javascript;base64,${Buffer.from(dispatcherRuntime).toString("base64")}`);
  const calls = [];
  const expectedOutcome = { status: "succeeded", detail: "Witness answered" };
  const dispatchInput = {
    kind: "question", selectedCharacterId: "selected-witness", selectedEvidenceId: "selected-clue", question: "My precise question about the receipt",
    adapter: { runInterrogationTarget: async (...args) => { calls.push(args); return expectedOutcome; } },
    observeCaseWindow: () => assert.fail("question cannot observe"), focusStep: () => assert.fail("a complete question cannot become mere focus"),
    notebookItems: [], discoveredEvidence: [], theory: { culpritId: "", motive: "", method: "", evidenceIds: [] },
    submitTheory: () => assert.fail("question cannot submit")
  };
  assert.deepEqual(await executeCertifiedInvestigationStep(dispatchInput), expectedOutcome);
  assert.deepEqual(calls.pop(), ["selected-witness", undefined, "My precise question about the receipt"], "free questioning retains the selected witness and exact player wording");
  await executeCertifiedInvestigationStep({ ...dispatchInput, kind: "challenge", action: { kind: "challenge", targetCharacterId: "route-witness", targetEvidenceId: "route-clue" } });
  assert.deepEqual(calls.pop(), ["route-witness", "route-clue", "My precise question about the receipt"], "certified challenge targets retain precedence without discarding the player's question");
  const blockedOutcome = { status: "blocked", detail: "Discover this clue first" };
  assert.deepEqual(await executeCertifiedInvestigationStep({ ...dispatchInput, kind: "challenge", adapter: { runInterrogationTarget: async () => blockedOutcome } }), blockedOutcome, "discovery rejection remains authoritative through the shared dispatcher");
  assert.match(finalWorkspaceSource, /actionAdapter\.toggleTheoryEvidence/);
  assert.match(surfaceSource, /actionAdapter=\{actionAdapter\}/);
  assert.match(pageSource, /actionAdapter=\{certifiedInvestigationActions\}/);

  const joinRequest = actionSource.indexOf('>("/api/players/join"');
  const joinedSession = actionSource.indexOf("setSession(data.session)", joinRequest);
  const joinedSummaries = actionSource.indexOf("setPlayerResourceCommitment", joinedSession);
  const joinedProgress = actionSource.indexOf("setProgress", joinedSummaries);
  const joinedPersist = actionSource.indexOf("persist(world.id, data.session.id)", joinedProgress);
  assert.ok(joinRequest < joinedSession && joinedSession < joinedSummaries && joinedSummaries < joinedProgress && joinedProgress < joinedPersist, "Join response application order remains stable");

  console.log(JSON.stringify({
    ok: true,
    suite: "certified-investigation-workspace",
    checks: ["adapter-methods", "request-ownership", "static-boundary", "playthrough-boundary", "navigation-readonly", "shared-entry-adapter", "setter-order", "path-determinism", "non-mutation"]
  }));
} finally {
  await Promise.all(Object.values(artifacts).map((file) => fs.rm(file, { force: true })));
}
