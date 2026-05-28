import fs from "node:fs/promises";
import path from "node:path";

const API = "http://localhost:3000/api/generate";
const outDir = path.resolve("outputs");

const topic = `题材：校园天文台死亡留言

背景：大学校庆前夜，暴雨，山顶天文台。
谜面：教授死在圆顶观测室，死者手边留下半张星图，圈出北极星。当晚暴雨无星可见，监控显示案发时无人进入。
要求：凶手唯一，线索公平，每个非凶手都有可发现排除证据，不要超自然、双胞胎、秘密通道。`;

async function callGenerate(stage, currentDraft = {}, userDirection = "") {
  const response = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "deepseek",
      stage,
      stageLabel: stage,
      brief: topic,
      selectedCaseType: "死亡留言",
      lengthTarget: "3000-6000字",
      hiddenTruthMode: false,
      currentDraft,
      userDirection
    })
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(`${stage} failed: ${data.error || response.status}`);
  }
  return data;
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  console.log("Generating and validating structured case...");
  const seed = await callGenerate("gameTruthSeed");
  const deductionCase = seed.json;
  await fs.writeFile(path.join(outDir, "deduction-game-test-case.json"), JSON.stringify(deductionCase, null, 2), "utf8");

  console.log("Generating public case file...");
  const caseFile = await callGenerate(
    "gameCaseFile",
    { structuredCase: JSON.stringify(deductionCase, null, 2), validation: JSON.stringify(seed.validation, null, 2) },
    "生成玩家可见案卷，不泄露凶手、幕后真相、证据真实含义和完整排除链。"
  );

  const firstEvidence = deductionCase.evidence.find((item) => item.discoverable) || deductionCase.evidence[0];
  const firstCharacter =
    deductionCase.characters.find((character) => firstEvidence.relatedCharacterIds?.includes(character.id)) || deductionCase.characters.find((character) => !character.isCulprit) || deductionCase.characters[0];

  console.log("Generating evidence challenge...");
  const challenge = await callGenerate(
    "gameEvidenceChallenge",
    {
      structuredCase: JSON.stringify(deductionCase, null, 2),
      character: JSON.stringify(firstCharacter, null, 2),
      selectedEvidence: JSON.stringify(firstEvidence, null, 2),
      discoveredEvidence: JSON.stringify([firstEvidence], null, 2)
    },
    `玩家向 ${firstCharacter.name} 出示证据“${firstEvidence.title}”，问题：这条证据和你的证词是否矛盾？`
  );

  console.log("Generating solution reveal...");
  const solution = await callGenerate(
    "gameSolutionReveal",
    {
      structuredCase: JSON.stringify(deductionCase, null, 2),
      ruleJudgement: JSON.stringify({ accepted: true, score: 100 }, null, 2)
    },
    "玩家已通过规则判定，生成完整解答篇。"
  );

  const log = `# Deduction Game v3 API Test

## Validation

${JSON.stringify(seed.validation, null, 2)}

## Public Case File

${caseFile.content}

## Evidence Challenge

角色：${firstCharacter.name}

证据：${firstEvidence.title}

${challenge.content}

## Solution Reveal

${solution.content}
`;

  await fs.writeFile(path.join(outDir, "deduction-game-test-log.md"), log, "utf8");
  console.log(
    JSON.stringify(
      {
        caseTitle: deductionCase.title,
        valid: seed.validation?.valid,
        repaired: seed.repaired,
        issueCount: seed.validation?.issues?.length || 0,
        files: ["outputs/deduction-game-test-case.json", "outputs/deduction-game-test-log.md"]
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
