import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const runtimeDir = path.join(root, "outputs", "deepseek-live-runtime");
const outputDir = path.join(root, "outputs");

async function loadEnvLocal() {
  try {
    const text = await fs.readFile(path.join(root, ".env.local"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (!process.env[key]) process.env[key] = rest.join("=").replace(/^["']|["']$/g, "");
    }
  } catch {
    // Optional local file.
  }
}

async function compileFile(sourcePath, targetPath) {
  const source = await fs.readFile(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(
    targetPath,
    compiled
      .replaceAll("@/lib/engine", "../../engine/index.cjs")
      .replace(/require\("\.\/(.+?)"\)/g, 'require("./$1.cjs")'),
    "utf8"
  );
}

async function loadEngineAndAi() {
  const sourceDir = path.join(root, "packages", "engine", "src");
  const engineDir = path.join(runtimeDir, "engine");
  await fs.mkdir(engineDir, { recursive: true });
  for (const entry of (await fs.readdir(sourceDir)).filter((name) => name.endsWith(".ts"))) {
    await compileFile(path.join(sourceDir, entry), path.join(engineDir, entry.replace(/\.ts$/, ".cjs")));
  }
  await compileFile(path.join(root, "lib", "world", "ai.ts"), path.join(runtimeDir, "lib", "world", "ai.cjs"));
  return {
    engine: await import(pathToFileURL(path.join(engineDir, "index.cjs")).href),
    ai: await import(pathToFileURL(path.join(runtimeDir, "lib", "world", "ai.cjs")).href)
  };
}

function preview(text) {
  return (text || "").replace(/\s+/g, " ").slice(0, 240);
}

function evalSeeds() {
  if (process.env.DEEPSEEK_EVAL_SEEDS) {
    return process.env.DEEPSEEK_EVAL_SEEDS.split(",")
      .map((seed) => seed.trim())
      .filter(Boolean);
  }
  const count = Number(process.env.DEEPSEEK_EVAL_SEED_COUNT || "5");
  return Array.from({ length: Math.max(1, count) }, (_, index) => `deepseek-live-eval-v6-${index + 1}`);
}

function makeMarkdown(report) {
  const lines = [
    "# DeepSeek Live Eval",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Model: ${report.model}`,
    `- Passed: ${report.passed}`,
    `- Seeds: ${report.aggregate.seedCount}`,
    `- Passed seeds: ${report.aggregate.passedSeeds}`,
    `- Average reveal score: ${report.aggregate.averageRevealScore}`,
    `- Average fact contract score: ${report.aggregate.averageFactContractScore}`,
    `- Hard NPC failures: ${report.aggregate.hardNpcFailureCount}`,
    "",
    "## Seed Results",
    "",
    "| Seed | Passed | NPC hard failures | Reveal | Fact contract | Warnings |",
    "| --- | --- | ---: | ---: | ---: | --- |",
    ...report.seedResults.map(
      (seed) =>
        `| ${seed.seed} | ${seed.passed} | ${seed.hardNpcFailureCount} | ${seed.revealScore} | ${seed.revealFactContractScore} | ${seed.revealCheck.revealEval.warnings.join(", ") || "none"} |`
    ),
    "",
    "## Failed Previews",
    "",
    ...report.seedResults
      .filter((seed) => !seed.passed)
      .flatMap((seed) => [
        `### ${seed.seed}`,
        "",
        `- Reveal preview: ${seed.revealCheck.contentPreview}`,
        `- Misses: ${seed.revealCheck.revealEval.contractMisses.map((miss) => `${miss.field}:${miss.expected}`).join("; ") || "none"}`,
        ""
      ])
  ];
  return `${lines.join("\n")}\n`;
}

async function runSeed(seed, engine, ai) {
  const world0 = engine.createInitialWorld(seed);
  const daily = engine.simulateDailyLife(world0, 5, []);
  const tick = engine.simulateWorldTick(daily.world, daily.events);
  const world = tick.world;
  const events = [...daily.events, ...tick.events];
  const caseFromLog = engine.extractCaseFromWorld(world, events);
  const truth = caseFromLog.deductionCase.truth;
  const allEvidenceIds = caseFromLog.deductionCase.evidence.map((item) => item.id);
  const witnessId = caseFromLog.generationProfile.witnessId;
  const focusId =
    caseFromLog.generationProfile.focusSuspectIds.find((id) => id !== truth.culpritId && id !== witnessId) || caseFromLog.generationProfile.focusSuspectIds[0];

  const checks = [
    { role: "culprit", characterId: truth.culpritId, question: "案发窗口你在哪里？请只说你亲眼知道的事。" },
    { role: "witness", characterId: witnessId, evidenceId: "ev-opportunity", question: "我出示这条目击证据，你之前的说法哪里不完整？" },
    { role: "focus_suspect", characterId: focusId, evidenceId: "ev-town-rollcall", question: "这条不在场记录能解释你的行踪吗？" },
    { role: "culprit", characterId: truth.culpritId, evidenceId: "ev-trace", question: "这条现场痕迹和你的证词有矛盾，你怎么解释？" }
  ];

  const npcChecks = [];
  for (const check of checks) {
    const result = await ai.generateGuardedNpcReplyWithAudit({
      world,
      events,
      caseFromLog,
      characterId: check.characterId,
      question: check.question,
      discoveredEvidenceIds: allEvidenceIds,
      evidenceId: check.evidenceId
    });
    npcChecks.push({
      characterId: check.characterId,
      role: check.role,
      evidenceId: check.evidenceId,
      mock: result.mock,
      promptAudit: result.promptAudit,
      dialogueEval: result.dialogueEval,
      answerPreview: preview(result.content)
    });
  }

  const theory = {
    culpritId: truth.culpritId,
    motive: truth.motive,
    method: truth.method,
    evidenceIds: allEvidenceIds
  };
  const session = {
    id: `deepseek-live-session-${seed}`,
    worldId: world.id,
    caseId: caseFromLog.id,
    playerId: "live-eval",
    displayName: "Live Eval",
    discoveredEvidenceIds: allEvidenceIds,
    interrogationLog: [],
    submittedTheory: theory,
    judgement: engine.submitWorldTheory(caseFromLog.deductionCase, theory, allEvidenceIds),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  assert.equal(session.judgement.accepted, true, `Correct local theory must pass before reveal eval for ${seed}`);
  const reveal = await ai.generateCaseRevealWithEval({ caseFromLog, session });
  const hardNpcFailures = npcChecks.filter((check) =>
    check.dialogueEval.safetyFlags.some(
      (flag) => flag === "prompt_contains_forbidden_truth" || flag === "answer_mentions_culprit_before_reveal" || flag === "answer_mentions_hidden_method"
    )
  );
  const passed = hardNpcFailures.length === 0 && reveal.sourceLocked === true && reveal.revealEval.factContractScore >= 85 && !reveal.mock;
  return {
    seed,
    worldId: world.id,
    caseId: caseFromLog.id,
    passed,
    hardNpcFailureCount: hardNpcFailures.length,
    revealScore: reveal.revealEval.score,
    revealFactContractScore: reveal.revealEval.factContractScore,
    npcChecks,
    revealCheck: {
      mock: reveal.mock,
      sourceLocked: reveal.sourceLocked,
      revealEval: reveal.revealEval,
      contentPreview: preview(reveal.content)
    },
    summary: [
      `${npcChecks.length} NPC DeepSeek calls completed.`,
      `${npcChecks.filter((check) => check.mock).length} NPC calls fell back to mock/empty response.`,
      `Reveal fact contract score ${reveal.revealEval.factContractScore}.`,
      hardNpcFailures.length ? `${hardNpcFailures.length} hard NPC safety failures.` : "No hard NPC leakage flags."
    ]
  };
}

await loadEnvLocal();
process.env.AI_PROVIDER ||= "deepseek";
process.env.DEEPSEEK_BASE_URL ||= "https://api.deepseek.com";
process.env.DEEPSEEK_MODEL ||= "deepseek-v4-flash";

if (!process.env.DEEPSEEK_API_KEY) {
  throw new Error("DEEPSEEK_API_KEY is required for npm run test:deepseek. Put it in local .env.local.");
}

const { engine, ai } = await loadEngineAndAi();
const seedResults = [];
for (const seed of evalSeeds()) {
  seedResults.push(await runSeed(seed, engine, ai));
}

const aggregate = {
  seedCount: seedResults.length,
  passedSeeds: seedResults.filter((seed) => seed.passed).length,
  failedSeeds: seedResults.filter((seed) => !seed.passed).map((seed) => seed.seed),
  averageRevealScore: Math.round(seedResults.reduce((sum, seed) => sum + seed.revealScore, 0) / Math.max(seedResults.length, 1)),
  averageFactContractScore: Math.round(seedResults.reduce((sum, seed) => sum + seed.revealFactContractScore, 0) / Math.max(seedResults.length, 1)),
  hardNpcFailureCount: seedResults.reduce((sum, seed) => sum + seed.hardNpcFailureCount, 0)
};
const first = seedResults[0];
const report = {
  generatedAt: new Date().toISOString(),
  seed: first?.seed || "",
  model: ai.getAiModelName("deepseek"),
  worldId: first?.worldId || "",
  caseId: first?.caseId || "",
  passed: aggregate.passedSeeds === aggregate.seedCount,
  aggregate,
  seedResults,
  npcChecks: first?.npcChecks || [],
  revealCheck: first?.revealCheck || null,
  summary: [
    `${aggregate.seedCount} seeds evaluated.`,
    `${aggregate.passedSeeds} seeds passed.`,
    `Average fact contract score ${aggregate.averageFactContractScore}.`,
    aggregate.failedSeeds.length ? `Failed seeds: ${aggregate.failedSeeds.join(", ")}` : "All seeds passed."
  ]
};

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, "deepseek-live-eval.json"), JSON.stringify(report, null, 2), "utf8");
await fs.writeFile(path.join(outputDir, "deepseek-live-eval.md"), makeMarkdown(report), "utf8");

if (!report.passed) {
  console.error(JSON.stringify(report.summary, null, 2));
  throw new Error("DeepSeek live eval failed. See outputs/deepseek-live-eval.json.");
}

console.log("DeepSeek live eval passed.");
