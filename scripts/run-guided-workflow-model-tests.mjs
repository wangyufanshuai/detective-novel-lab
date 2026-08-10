import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const artifacts = {
  react: path.join(os.tmpdir(), `guided-react-${process.pid}.mjs`),
  registry: path.join(os.tmpdir(), `guided-registry-${process.pid}.mjs`),
  replay: path.join(os.tmpdir(), `guided-replay-${process.pid}.mjs`),
  view: path.join(os.tmpdir(), `guided-view-${process.pid}.mjs`)
};

function compile(source, output, replacements = []) {
  return fs.readFile(path.join(root, source), "utf8").then((text) => {
    let compiled = ts.transpileModule(text, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    for (const [pattern, value] of replacements) compiled = compiled.replace(pattern, value);
    return fs.writeFile(output, compiled, "utf8");
  });
}

try {
  await fs.writeFile(artifacts.react, "export const useMemo = (factory) => factory();\n", "utf8");
  await compile("app/campaign/investigation-action-registry.ts", artifacts.registry);
  await compile("app/campaign/replay-practice-model.ts", artifacts.replay, [
    [/from "\.\/investigation-action-registry"/g, `from "${pathToFileURL(artifacts.registry).href}"`]
  ]);
  await compile("app/hooks/useGuidedManualViewModel.ts", artifacts.view, [
    [/from "react"/g, `from "${pathToFileURL(artifacts.react).href}"`],
    [/from "@\/app\/campaign\/replay-practice-model"/g, `from "${pathToFileURL(artifacts.replay).href}"`]
  ]);
  const { deriveGuidedManualTarget } = await import(`${pathToFileURL(artifacts.view).href}?test=${Date.now()}`);
  const scenes = [{ id: "archive", name: "Archive", evidenceIds: ["clue-a"] }];
  const routeCertificate = {
    steps: [
      { kind: "search", evidenceIds: ["clue-a"], characterIds: [], locationId: "archive" },
      { kind: "question", evidenceIds: [], characterIds: ["witness-a"] },
      { kind: "challenge", evidenceIds: ["clue-a"], characterIds: ["witness-a"] },
      { kind: "select-evidence", evidenceIds: ["clue-a"], characterIds: [] },
      { kind: "submit", evidenceIds: ["clue-a"], characterIds: [] }
    ],
    theoryEvidenceIds: ["clue-a"],
    blockers: []
  };
  const theory = { culpritId: "", motive: "", method: "", evidenceIds: [] };
  const session = (overrides = {}) => ({
    id: "session-a",
    worldId: "world-a",
    caseId: "case-a",
    playerId: "player-a",
    displayName: "Investigator",
    discoveredEvidenceIds: [],
    interrogationLog: [],
    createdAt: "local",
    updatedAt: "local",
    ...overrides
  });
  const base = { theory, scenes, caseRouteCertificate: routeCertificate, playableIntake: null, worldLead: null };
  assert.equal(deriveGuidedManualTarget({ ...base, session: null }).kind, "join", "no session starts at Join");
  assert.deepEqual(deriveGuidedManualTarget({ ...base, session: session() }), {
    kind: "search", label: "Search location", evidenceId: "clue-a", locationId: "archive"
  }, "the first undiscovered certified clue owns Search");
  const discovered = session({ discoveredEvidenceIds: ["clue-a"] });
  assert.equal(deriveGuidedManualTarget({ ...base, session: discovered }).kind, "question", "discovered evidence advances to Question");
  const leadChallenge = deriveGuidedManualTarget({
    ...base,
    session: discovered,
    worldLead: { status: "followed", focus: "challenge", label: "Public lead", nextAction: "Continue" }
  });
  assert.equal(leadChallenge.kind, "challenge", "an eligible followed lead deterministically prioritizes its certified lane");
  assert.match(leadChallenge.label, /world lead$/, "prioritized lane remains visibly labelled");
  const questioned = session({ discoveredEvidenceIds: ["clue-a"], interrogationLog: [{ characterId: "witness-a" }] });
  assert.equal(deriveGuidedManualTarget({ ...base, session: questioned }).kind, "challenge", "question completion advances to Challenge");
  const challenged = session({ discoveredEvidenceIds: ["clue-a"], interrogationLog: [{ characterId: "witness-a", challenge: { hit: true } }] });
  assert.equal(deriveGuidedManualTarget({ ...base, session: challenged }).kind, "select-evidence", "challenge completion advances to evidence selection");
  assert.equal(deriveGuidedManualTarget({ ...base, session: challenged, theory: { ...theory, evidenceIds: ["clue-a"] } }).kind, "submit", "selected certified evidence advances to Submit");
  const accepted = session({
    discoveredEvidenceIds: ["clue-a"],
    interrogationLog: [{ characterId: "witness-a", challenge: { hit: true } }],
    judgement: { accepted: true }
  });
  assert.equal(deriveGuidedManualTarget({ ...base, session: accepted, theory: { ...theory, evidenceIds: ["clue-a"] } }).kind, "review-source", "accepted theory advances to source review");
  const before = structuredClone({ ...base, session: questioned });
  const first = deriveGuidedManualTarget(before);
  const second = deriveGuidedManualTarget(structuredClone(before));
  assert.deepEqual(first, second, "same safe workflow state produces the same target");
  assert.deepEqual(before, { ...base, session: questioned }, "target projection does not mutate workflow input");
  console.log(JSON.stringify({ ok: true, suite: "guided-workflow-model", checks: ["join", "search", "question", "lead-priority", "challenge", "select-evidence", "submit", "review-source", "determinism", "non-mutation"] }));
} finally {
  await Promise.all(Object.values(artifacts).map((file) => fs.rm(file, { force: true })));
}
