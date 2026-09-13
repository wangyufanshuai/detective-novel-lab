import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

// Exercise the actual engine functions; artifacts remain outside public/.
const root = process.cwd();
const sourceDir = path.join(root, "packages", "engine", "src");
const outputDir = path.join(root, "outputs", "first-case-goal");
const runtimeDir = path.join(outputDir, "theory-proof-runtime");
const compiledFiles = new Set();

async function compileModule(relative) {
  if (compiledFiles.has(relative)) return;
  compiledFiles.add(relative);
  const source = await fs.readFile(path.join(sourceDir, `${relative}.ts`), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const localImports = [...output.matchAll(/require\("(\.{1,2}\/[^\"]+)"\)/g)];
  for (const match of localImports) await compileModule(path.normalize(path.join(path.dirname(relative), match[1])));
  const target = path.join(runtimeDir, `${relative}.cjs`);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, output.replace(/require\("(\.{1,2}\/[^\"]+)"\)/g, 'require("$1.cjs")'), "utf8");
}

for (const entry of ["judgement", "fixtures", "demo-runtime", "proof-ledger"]) await compileModule(entry);
const require = createRequire(import.meta.url);
const { judgeTheory } = require(path.join(runtimeDir, "judgement.cjs"));
const { createShowcaseCase } = require(path.join(runtimeDir, "fixtures.cjs"));
const { createStaticDemoRuntime } = require(path.join(runtimeDir, "demo-runtime.cjs"));
const { buildDeductionCaseTruthLedger } = require(path.join(runtimeDir, "proof-ledger.cjs"));
const checks = [];

function check(name, run) {
  run();
  checks.push({ name, passed: true });
}

function canonicalInput(deductionCase) {
  return {
    culpritId: deductionCase.truth.culpritId,
    motive: deductionCase.truth.motive,
    method: deductionCase.truth.method,
    evidenceIds: deductionCase.evidence.filter((item) => item.discoverable).map((item) => item.id)
  };
}

// Private test fixtures derive assignments from the internal ledger. Product UI
// must never use this helper or receive the correct assignments from the server.
function structuredInput(deductionCase) {
  const ledger = buildDeductionCaseTruthLedger(deductionCase);
  const idsFor = (kind) => [...new Set(ledger.obligations.filter((item) => item.required && item.kind === kind).flatMap((item) => item.evidenceIds))];
  return {
    ...canonicalInput(deductionCase),
    motive: "",
    method: "",
    proof: { motiveEvidenceIds: idsFor("motive"), methodEvidenceIds: idsFor("means") }
  };
}

const showcase = createShowcaseCase("first-case-theory-contract");
const canonical = canonicalInput(showcase);
const judgeShowcase = (theory) => judgeTheory(showcase, theory, canonical.evidenceIds);

check("Existing complete canonical statement remains accepted", () => {
  assert.equal(judgeShowcase(canonical).accepted, true);
});
check("Canonical formatting permits NFKC and outer whitespace normalization", () => {
  assert.equal(judgeShowcase({ ...canonical, motive: ` \n${canonical.motive.normalize("NFKC")}\t`, method: canonical.method.normalize("NFKC") }).accepted, true);
});
check("Original one-character motive and method exploit is rejected", () => {
  const result = judgeShowcase({ ...canonical, motive: "陆", method: "陆" });
  assert.equal(result.accepted, false);
  assert.equal(result.score, 64);
});
check("Original eight-character prefix followed by explicit denial is rejected", () => {
  const result = judgeShowcase({ ...canonical, motive: `${canonical.motive.slice(0, 8)}，但我明确否认这就是他的动机。`, method: `${canonical.method.slice(0, 8)}，但我认为他没有这样做。` });
  assert.equal(result.accepted, false);
  assert.equal(result.score, 64);
});
check("Full canonical text followed by negation is rejected", () => {
  assert.equal(judgeShowcase({ ...canonical, motive: `${canonical.motive}以上动机不成立。`, method: `${canonical.method}以上手法不成立。` }).accepted, false);
});
check("Legacy paraphrases fail explicitly instead of pretending to understand semantics", () => {
  assert.equal(judgeShowcase({ ...canonical, motive: "为了阻止教授公开自己造假和挪用经费的行为。", method: "切换备用电源造成监控中断，然后进入观测室并伪造留言。" }).accepted, false);
});
check("Malformed or unsupported theory fields cannot silently bypass validation", () => {
  for (const theory of [null, [], {}, { ...canonical, accepted: true }, { ...canonical, claims: [] }, { ...canonical, evidenceIds: "e-power-log" }, { ...canonical, motive: null }, { ...canonical, method: [] }]) {
    const result = judgeShowcase(theory);
    assert.equal(result.accepted, false);
    assert.equal(result.score, 0);
  }
});
check("Present malformed proof never falls back to canonical text", () => {
  for (const proof of [null, undefined, [], {}, { motiveEvidenceIds: [], methodEvidenceIds: [], accepted: true }, { motiveEvidenceIds: "ev-motive", methodEvidenceIds: [] }, { motiveEvidenceIds: [null], methodEvidenceIds: [] }]) {
    assert.equal(judgeShowcase({ ...canonical, proof }).accepted, false);
  }
});
check("Legacy selections reject nonexistent and undiscovered extra evidence", () => {
  assert.equal(judgeShowcase({ ...canonical, evidenceIds: [...canonical.evidenceIds, "forged-clue"] }).accepted, false);
  assert.equal(judgeTheory(showcase, canonical, canonical.evidenceIds.slice(1)).accepted, false);
});

for (const template of ["archive-blunt", "clocktower-locked-room", "clinic-poison", "greenhouse-blade"]) {
  const deductionCase = createStaticDemoRuntime(template).activeCase.deductionCase;
  const legacy = canonicalInput(deductionCase);
  const theory = structuredInput(deductionCase);
  const discovered = legacy.evidenceIds;
  const judge = (input, available = discovered) => judgeTheory(deductionCase, input, available);
  const alteredProof = (proof) => ({ ...theory, proof: { ...theory.proof, ...proof } });

  check(`${template}: canonical certification input remains accepted`, () => assert.equal(judge(legacy).accepted, true));
  check(`${template}: complete evidence assignments with empty notes are accepted`, () => {
    const result = judge(theory);
    assert.equal(result.accepted, true);
    assert.equal(result.score, 100);
  });
  check(`${template}: differently worded optional notes do not change the result`, () => {
    const original = judge(theory);
    for (const notes of [
      { motive: "我把动机判断建立在这组已发现的材料上。", method: "这里的实物线索说明了实施工具及其使用。" },
      { motive: "Notes only: I am still comparing my earlier ideas.", method: "No canonical wording is required in these optional notes." }
    ]) assert.deepEqual(judge({ ...theory, ...notes }), original);
  });
  check(`${template}: wrong accused character is rejected`, () => {
    assert.equal(judge({ ...theory, culpritId: deductionCase.characters.find((item) => item.id !== theory.culpritId).id }).accepted, false);
  });
  check(`${template}: empty assignments are rejected even with canonical text`, () => {
    assert.equal(judge({ ...legacy, proof: { motiveEvidenceIds: [], methodEvidenceIds: [] } }).accepted, false);
    assert.equal(judge(alteredProof({ motiveEvidenceIds: [] })).accepted, false);
    assert.equal(judge(alteredProof({ methodEvidenceIds: [] })).accepted, false);
  });
  check(`${template}: swapped motive and method assignments are rejected`, () => {
    assert.equal(judge(alteredProof({ motiveEvidenceIds: theory.proof.methodEvidenceIds, methodEvidenceIds: theory.proof.motiveEvidenceIds })).accepted, false);
  });
  check(`${template}: assigning every clue to both groups is rejected`, () => {
    assert.equal(judge(alteredProof({ motiveEvidenceIds: discovered, methodEvidenceIds: discovered })).accepted, false);
  });
  check(`${template}: incomplete means proof is rejected despite full global selection`, () => {
    assert.equal(judge(alteredProof({ methodEvidenceIds: theory.proof.methodEvidenceIds.slice(1) })).accepted, false);
  });
  check(`${template}: assigned evidence must also be selected and discovered`, () => {
    const omitted = theory.proof.motiveEvidenceIds[0];
    assert.equal(judge({ ...theory, evidenceIds: discovered.filter((id) => id !== omitted) }).accepted, false);
    assert.equal(judge(theory, discovered.filter((id) => id !== omitted)).accepted, false);
  });
  check(`${template}: unknown evidence cannot pass even if claimed discovered`, () => {
    const invalid = { ...alteredProof({ motiveEvidenceIds: [...theory.proof.motiveEvidenceIds, "forged-clue"] }), evidenceIds: [...discovered, "forged-clue"] };
    assert.equal(judge(invalid, [...discovered, "forged-clue"]).accepted, false);
  });
  check(`${template}: hidden evidence cannot pass even if claimed discovered`, () => {
    const hiddenCase = structuredClone(deductionCase);
    hiddenCase.evidence.find((item) => item.id === theory.proof.motiveEvidenceIds[0]).discoverable = false;
    assert.equal(judgeTheory(hiddenCase, theory, discovered).accepted, false);
  });
  check(`${template}: unrelated evidence assignment is rejected without naming the solution`, () => {
    const unrelated = discovered.find((id) => !theory.proof.motiveEvidenceIds.includes(id));
    const result = judge(alteredProof({ motiveEvidenceIds: [...theory.proof.motiveEvidenceIds, unrelated] }));
    assert.equal(result.accepted, false);
    assert.equal(result.missing.some((message) => message.includes("Motive evidence assignments")), true);
    assert.equal(result.missing.some((message) => theory.proof.motiveEvidenceIds.some((id) => message.includes(id))), false);
  });
  check(`${template}: repeated valid evidence does not change the result`, () => {
    assert.deepEqual(judge(alteredProof({ motiveEvidenceIds: [...theory.proof.motiveEvidenceIds, ...theory.proof.motiveEvidenceIds] })), judge(theory));
  });
}

check("A legacy fixture without backed motive/means cannot invent a structured proof", () => {
  assert.equal(judgeShowcase({ ...canonical, proof: { motiveEvidenceIds: canonical.evidenceIds, methodEvidenceIds: canonical.evidenceIds } }).accepted, false);
});

const report = {
  generatedAt: new Date().toISOString(),
  suite: "First-case theory evidence-assignment contract",
  passed: checks.length,
  failed: 0,
  scope: "Direct engine execution on four playable templates and the original exploit fixture; not a browser or human usability test.",
  checks
};
await fs.writeFile(path.join(outputDir, "theory-proof-test-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Theory proof tests passed: ${checks.length}/${checks.length}. Evidence: outputs/first-case-goal/theory-proof-test-report.json`);
