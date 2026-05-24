import fs from "node:fs/promises";
import path from "node:path";

const API = "http://localhost:3000/api/generate";
const outDir = path.resolve("outputs");

const topic = `题材：校园天文台死亡留言

背景：大学校庆前夜，暴雨，山顶天文台。
谜面：教授死在圆顶观测室，死者手边留下半张星图，圈出北极星。当晚暴雨无星可见，监控显示案发时无人进入。
要求：凶手唯一，线索公平，不要超自然、双胞胎、秘密通道。`;

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

  console.log("Generating structured case...");
  const seed = await callGenerate("gameTruthSeed");
  const deductionCase = seed.json;
  await fs.writeFile(path.join(outDir, "deduction-game-test-case.json"), JSON.stringify(deductionCase, null, 2), "utf8");

  console.log("Generating public case file...");
  const caseFile = await callGenerate(
    "gameCaseFile",
    { structuredCase: JSON.stringify(deductionCase, null, 2) },
    "生成玩家可见案卷，不泄露凶手和幕后真相。"
  );

  const firstCharacter = deductionCase.characters.find((character) => !character.isCulprit) || deductionCase.characters[0];
  console.log("Generating dialogue...");
  const dialogue = await callGenerate(
    "gameDialogue",
    {
      structuredCase: JSON.stringify(deductionCase, null, 2),
      character: JSON.stringify(firstCharacter, null, 2),
      discoveredEvidence: "[]"
    },
    "玩家问题：案发时你在哪里？"
  );

  const log = `# Deduction Game Test

## Validation

${JSON.stringify(seed.validation, null, 2)}

## Public Case File

${caseFile.content}

## Dialogue Probe

角色：${firstCharacter.name}

${dialogue.content}
`;

  await fs.writeFile(path.join(outDir, "deduction-game-test-log.md"), log, "utf8");
  console.log(
    JSON.stringify(
      {
        caseTitle: deductionCase.title,
        validation: seed.validation,
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
