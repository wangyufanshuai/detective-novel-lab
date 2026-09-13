import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

// Run the production hook callback with lightweight hook primitives; the
// production context resolver and presentation turn model are loaded intact.
const root = process.cwd();
const modules = new Map();
let presentationState;
const react = {
  useCallback: (callback) => callback,
  useMemo: (callback) => callback(),
  useEffect: () => {},
  useRef: (current) => ({ current }),
  useState(initial) {
    let value = typeof initial === "function" ? initial() : initial;
    presentationState = value;
    return [value, (update) => { value = typeof update === "function" ? update(value) : update; presentationState = value; }];
  }
};
function loadTs(file) {
  const absolute = path.resolve(root, file.endsWith(".ts") ? file : `${file}.ts`);
  if (modules.has(absolute)) return modules.get(absolute).exports;
  const module = { exports: {} };
  modules.set(absolute, module);
  const output = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const requireForFile = (specifier) => {
    if (specifier === "react") return react;
    if (specifier === "@/lib/engine") return { createDefaultTownRuleCatalog() { throw new Error("unused in action dispatch tests"); } };
    if (specifier.startsWith("@/")) return loadTs(specifier.slice(2));
    if (specifier.startsWith(".")) return loadTs(path.resolve(path.dirname(absolute), specifier));
    throw new Error(`Unexpected dependency: ${specifier}`);
  };
  vm.runInThisContext(`(function(require,module,exports) {\n${output}\n})`, { filename: absolute })(requireForFile, module, module.exports);
  return module.exports;
}
const { useCommandDeckContext } = loadTs("app/hooks/useCommandDeckContext.ts");
let calls;
let outcome;
function makeInput(extra = {}) {
  calls = [];
  outcome = { status: "succeeded", detail: "Confirmed outcome" };
  return {
    inspectorTab: "investigation", objectiveKey: "case-1:question", hasCase: true, hasSession: true,
    selectedCharacter: { id: "witness", name: "Witness", role: "witness" }, selectedSceneId: "scene", selectedSceneName: "Scene",
    progress: { observedCrimeWindow: true, joinedInvestigation: true, challengedTestimony: false, submittedTheory: false },
    searchableEvidenceIds: ["clue"], discoveredEvidenceIds: ["clue"], selectedEvidenceId: "clue", judgementAccepted: false, revealAvailable: false, questionText: "What happened?",
    actionAdapter: {
      async joinCase() { calls.push("join"); return outcome; },
      async discoverFirstSceneEvidence(sceneId) { calls.push(["search", sceneId]); return outcome; },
      async runInterrogationTarget(...args) { calls.push(["interrogate", ...args]); return outcome; },
      toggleTheoryEvidence(evidenceId) { calls.push(["toggle", evidenceId]); }
    },
    onSelectEvidence(evidenceId) { calls.push(["select", evidenceId]); },
    onShowInspector(tab) { calls.push(["inspector", tab]); },
    async onShowEvents() { calls.push("events"); },
    async onSubmitTheory() { calls.push("submit"); return outcome; },
    ...extra
  };
}
let checkCount = 0;
async function check(name, run) { await run(); checkCount += 1; console.log(`PASS ${name}`); }

await check("join, search, question, challenge, and submit preserve every adapter status", async () => {
  for (const kind of ["join", "search", "question", "challenge", "submit"]) {
    for (const status of ["succeeded", "rejected", "blocked", "cancelled", "failed"]) {
      const input = makeInput();
      if (kind === "join") input.hasSession = false;
      if (kind === "search") input.selectedCharacter = undefined;
      if (kind === "submit") input.inspectorTab = "logic";
      const hook = useCommandDeckContext(input);
      outcome = { status, detail: `Outcome ${status}`, ...(status === "rejected" ? { judgement: { accepted: false, score: 64 } } : {}) };
      assert.strictEqual(await hook.onAction(kind), outcome);
      assert.notEqual(presentationState.phase, "resolve", "finally releases execution presentation");
    }
  }
});

await check("missing and disabled actions report blocked without invoking adapters", async () => {
  const hook = useCommandDeckContext(makeInput({ hasCase: false, hasSession: false }));
  assert.equal((await hook.onAction("join")).status, "blocked");
  assert.equal((await hook.onAction("submit")).status, "blocked");
  assert.deepEqual(calls, []);
});

await check("search requires a selected scene and challenges require owned evidence", async () => {
  let hook = useCommandDeckContext(makeInput({ selectedCharacter: undefined, selectedSceneId: undefined }));
  assert.equal((await hook.onAction("search")).status, "blocked");
  assert.deepEqual(calls, []);
  hook = useCommandDeckContext(makeInput({ selectedEvidenceId: "undiscovered-clue" }));
  assert.equal((await hook.onAction("challenge")).status, "blocked");
  assert.deepEqual(calls, []);
  hook = useCommandDeckContext(makeInput({ selectedCharacter: { id: "", name: "Witness", role: "witness" } }));
  assert.equal((await hook.onAction("question")).status, "blocked");
  assert.equal((await hook.onAction("challenge")).status, "blocked");
  assert.deepEqual(calls, []);
});

await check("unconfirmed submission does not become success", async () => {
  const hook = useCommandDeckContext(makeInput({ inspectorTab: "logic", onSubmitTheory: async () => undefined }));
  assert.equal((await hook.onAction("submit")).status, "blocked");
});

await check("exceptions produce safe failure and still clear execution presentation", async () => {
  const input = makeInput();
  input.actionAdapter.runInterrogationTarget = async () => { throw new Error("secret-token-and-hidden-truth"); };
  const hook = useCommandDeckContext(input);
  const result = await hook.onAction("question");
  assert.equal(result.status, "failed");
  assert.equal(result.detail.includes("secret-token"), false);
  assert.notEqual(presentationState.phase, "resolve");
});

await check("navigation confirms only the opened surface and evidence toggles require discovered clues", async () => {
  let hook = useCommandDeckContext(makeInput({ inspectorTab: "logic" }));
  assert.equal((await hook.onAction("edit-theory")).status, "succeeded");
  assert.deepEqual(calls, [["inspector", "investigation"]]);
  hook = useCommandDeckContext(makeInput({ selectedCharacter: undefined, selectedEvidence: { title: "Clue", discovered: true, selectedForTheory: false } }));
  assert.equal((await hook.onAction("select-evidence")).status, "succeeded");
  assert.deepEqual(calls, [["toggle", "clue"], ["inspector", "investigation"]]);
  hook = useCommandDeckContext(makeInput({ selectedCharacter: undefined, selectedEvidenceId: undefined, selectedEvidence: { title: "Clue", discovered: true, selectedForTheory: false } }));
  assert.equal((await hook.onAction("select-evidence")).status, "blocked");
  assert.deepEqual(calls, []);
});

console.log(JSON.stringify({ ok: true, checkCount, productionHookCallback: true, adapterStatusCases: 25, realBrowser: false }));
