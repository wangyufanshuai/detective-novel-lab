import fs from "node:fs/promises";
import path from "node:path";

const API = "http://localhost:3000/api/generate";
const outDir = path.resolve("outputs");
const provider = "deepseek";
const selectedCaseType = "死亡留言";
const lengthTarget = "3000-6000字";

const brief = `新题材测试：校园天文台推理。

我想写一篇中文本格推理短篇。

背景：
- 地点：大学山顶天文台，校庆前夜。
- 时代：现代。
- 氛围：夜间观测、暴雨、星图、旧仪器、学术竞争。

人物：
- 侦探：随机生成，但要有冷静的逻辑观察力。
- 死者：天体物理教授，校庆演讲前夕死亡。
- 嫌疑人：研究生、竞争教授、仪器管理员、校友赞助人、教授助理。

案件：
- 案件类型：死亡留言 + 不在场证明。
- 核心谜面：教授死在圆顶观测室内，监控显示案发时间没有人进入。死者手边留下半张星图，上面圈出“北极星”，但当天暴雨无星可见。
- 已有线索：望远镜指向错误、星图被撕成两半、观测日志时间被改动、备用电源短暂停过、有人提前知道云层会遮住天空。
- 想要的反转：死亡留言不是指星星，而是指“永远不动的位置”或某个固定参照物。
- 不想要的设定：不要超自然，不要双胞胎，不要秘密通道，不要高科技黑客万能解法。

其他要求：
- 先生成标准版故事大概，再生成完整小说。
- 保持公平推理，关键证据必须提前出现。
- 结尾要用清楚的证据链解释真相。`;

async function callGenerate(stage, stageLabel, currentDraft, userDirection) {
  const response = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider,
      stage,
      stageLabel,
      brief,
      currentDraft,
      selectedCaseType,
      hiddenTruthMode: false,
      userDirection,
      lengthTarget,
      variants: 1
    })
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(`${stageLabel} failed: ${data.error || response.status} ${data.detail || ""}`);
  }
  return data.content || "";
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  console.log("Generating synopsis...");
  const synopsis = await callGenerate(
    "quickSynopsis",
    "快速模式：故事大概",
    {},
    "生成标准版故事大概，显示幕后真相，方便创作者确认。"
  );
  await fs.writeFile(path.join(outDir, "quick-test-astronomy-synopsis.md"), synopsis, "utf8");
  console.log(`Synopsis: ${synopsis.replace(/\s/g, "").length} chars`);

  console.log("Generating outline...");
  const outline = await callGenerate(
    "quickOutline",
    "快速模式：章节大纲",
    { confirmedSynopsis: synopsis },
    `根据已确认故事大概生成章节大纲。目标篇幅：${lengthTarget}。`
  );
  await fs.writeFile(path.join(outDir, "quick-test-astronomy-outline.md"), outline, "utf8");
  console.log(`Outline: ${outline.replace(/\s/g, "").length} chars`);

  const total = 4;
  const chapters = [];
  for (let index = 1; index <= total; index += 1) {
    console.log(`Generating chapter ${index}/${total}...`);
    const chapter = await callGenerate(
      "quickChapter",
      `快速模式：正文第${index}章`,
      {
        confirmedSynopsis: synopsis,
        outline,
        previousChapters: chapters.join("\n\n---\n\n")
      },
      `生成第${index}章正文。全书共${total}章。只写本章正文，承接前文，不要重复大纲。`
    );
    chapters.push(chapter.trim());
    await fs.writeFile(path.join(outDir, `quick-test-astronomy-chapter-${String(index).padStart(2, "0")}.md`), chapter, "utf8");
    console.log(`Chapter ${index}: ${chapter.replace(/\s/g, "").length} chars`);
  }

  const manuscript = `# 北极星不在天上

> 本文由本地网站 /api/generate 调用 DeepSeek deepseek-v4-flash，使用快速模式“新题材测试：校园天文台推理”生成。

## 故事大概

${synopsis.trim()}

---

## 章节大纲

${outline.trim()}

---

## 完整小说

${chapters.join("\n\n---\n\n")}
`;

  const finalPath = path.join(outDir, "quick-test-astronomy-deepseek.md");
  await fs.writeFile(finalPath, manuscript, "utf8");
  console.log(
    JSON.stringify(
      {
        output: finalPath,
        charsNoWhitespace: manuscript.replace(/\s/g, "").length,
        chapters: total
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
