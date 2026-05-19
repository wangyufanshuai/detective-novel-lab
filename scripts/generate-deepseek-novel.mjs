import fs from "node:fs/promises";
import path from "node:path";

const API = "http://localhost:3000/api/generate";
const outDir = path.resolve("outputs");

const brief = `已选方案：雪后第十三把钥匙。

背景：现代偏复古，山中旧别墅“听雪馆”，暴雪封路，众人因贺家遗产信托会议聚集。
类型：密室杀人。
目标篇幅：约12000字中文推理小说。
风格：逻辑至上、公平推理、古典本格，包含“挑战读者”章节；不要仿写任何具体作者原句或可识别文风。

核心谜面：
家族律师许文谦死在二楼书房。书房门从内侧看似反锁，窗外新雪无脚印。门内侧插着第十二号书房钥匙。死者手边便签写着“十三”。大厅钥匙柜本应只有十二把钥匙，许文谦案发前当众取走第十二号书房钥匙，可案发后柜中又出现一把“书房”钥匙。

固定人物：
- 侦探：顾晏初，逻辑学者与推理评论者，冷静，重视数目、证词边界与物证的含义。
- 死者：许文谦，贺家信托律师。
- 嫌疑人：贺明修（长孙，欠债）、贺微澜（妹妹，公益基金负责人）、贺叔平（叔父，古董和锁具收藏家）、邵景年（私人医生）、林棠（年轻秘书）、周佩兰（女管家）。

固定真相：
- 凶手是贺叔平。
- 动机：他私自变卖贺家信托名下的古锁、钟表和古董，许文谦准备在十点说明会上公开附件。
- 密室：贺叔平预先配出第十三把书房钥匙。听雪馆老锁即使内侧插着钥匙，也能用外侧钥匙上锁。他杀人后从门离开并锁门，门内真钥匙仍插着，于是形成“钥匙在内”的假密室。窗外新雪只证明没人从窗出入。
- “十三”：许文谦发现钥匙数量异常，留下“十三”作为提示。凶手又把书房座钟拨慢十三分钟，试图让“十三”误导成时间差。
- 关键线索：第十二号钩的空痕、柜中假钥匙的烟熏做旧痕迹、蜡线绳结、蜡块钥齿印、书房煤灰、座钟内铜屑、贺叔平懂锁和钟表、他说给大厅壁炉添煤但大厅实际烧木柴。

严禁漂移：
不要写成冰封密室、不要出现碳纤维冰条、记忆合金线、游戏设计师、智能别墅、湖边枪声等其他方案元素。`;

const lockedPlan = `章节计划：
第一章《雪封听雪馆》：暴雪、听雪馆、众人登场，许文谦当众取走第十二号书房钥匙并宣布十点说明会。
第二章《门内的钥匙》：九点三十四分响声，众人破门，许文谦死在书房；门内钥匙、窗外无脚印、便签“十三”。
第三章《多出来的钥匙》：顾晏初发现钥匙柜第十二号钩又挂着书房钥匙，提出第十三把钥匙矛盾。
第四章《九点钟的证词》：逐一询问嫌疑人，建立时间线与动机，发现贺叔平懂锁、下午看过钥匙。
第五章《慢了十三分钟的钟》：座钟、煤灰、铜屑、假钥匙做旧、绳结、蜡块等线索逐渐收束。
第六章《挑战读者》：顾晏初明确告诉众人关键线索已经齐备，逐条列出读者可以推理出的事实，但暂不直接点名。
第七章《第十三把钥匙》：终局推理，揭露贺叔平，解释密室、十三、时间误导和所有证据，余韵收束。`;

const chapterDirections = [
  "生成第一章《雪封听雪馆》。只写小说正文，约1500-1900字。重点写暴雪封路、听雪馆气氛、人物登场、许文谦当众取走第十二号书房钥匙、第十二号钩空了、十点说明会悬念。",
  "生成第二章《门内的钥匙》。只写小说正文，约1500-1900字。重点写九点三十四分响声、破门、尸体、门内钥匙、窗外无脚印、便签十三。不要揭露凶手。",
  "生成第三章《多出来的钥匙》。只写小说正文，约1500-1900字。重点写顾晏初检查钥匙柜，发现柜中又有书房钥匙，提出第十三把钥匙矛盾，并说明窗外雪地只能排除窗户路线。",
  "生成第四章《九点钟的证词》。只写小说正文，约1500-1900字。重点写六名嫌疑人的证词、动机、行动边界。公平埋下贺叔平下午看钥匙、懂锁、修表、所谓添煤等线索。",
  "生成第五章《慢了十三分钟的钟》。只写小说正文，约1500-1900字。重点写座钟被拨慢、钟内铜屑、假钥匙烟熏做旧、蜡线绳结、煤灰与大厅木柴矛盾。仍保留最后悬念。",
  "生成第六章《挑战读者》。只写小说正文，约1200-1600字。用小说场景让顾晏初列出所有已出现关键事实，明确这是挑战读者的时刻，但暂不直接点名凶手。",
  "生成第七章《第十三把钥匙》。只写小说正文，约1800-2300字。完整终局推理并揭露贺叔平，解释密室、十三、座钟误导、假钥匙、动机和证据，最后写雪停后的余韵。不要新增前文没有铺垫的关键证据。"
];

async function callGenerate(stageLabel, currentDraft, userDirection) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "deepseek",
      stage: "chapter",
      stageLabel,
      brief,
      currentDraft,
      selectedCaseType: "密室杀人",
      hiddenTruthMode: false,
      userDirection,
      variants: 1
    })
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(`${stageLabel} failed: ${data.error || res.status} ${data.detail || ""}`);
  }
  return data.content || "";
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const currentDraft = {
    lockedPlan,
    lockedTruth: brief
  };
  const chapters = [];

  for (let index = 0; index < chapterDirections.length; index += 1) {
    const chapterNo = index + 1;
    console.log(`Generating DeepSeek chapter ${chapterNo}/7...`);
    const content = await callGenerate(
      `正文第${chapterNo}章`,
      { ...currentDraft, previousChapters: chapters.join("\n\n") },
      chapterDirections[index]
    );
    chapters.push(content.trim());
    await fs.writeFile(path.join(outDir, `deepseek-key-chapter-${String(chapterNo).padStart(2, "0")}.md`), content, "utf8");
    console.log(`Chapter ${chapterNo}: ${content.replace(/\s/g, "").length} chars`);
  }

  const manuscript = `# 听雪馆第十三把钥匙\n\n> 本文由本地网站 /api/generate 调用 DeepSeek deepseek-v4-flash 按“第十三把钥匙”方案分章生成。\n\n${chapters.join("\n\n---\n\n")}\n`;
  const finalPath = path.join(outDir, "听雪馆第十三把钥匙.deepseek.md");
  await fs.writeFile(finalPath, manuscript, "utf8");
  await fs.writeFile(path.join(outDir, "deepseek-key-generation-context.json"), JSON.stringify({ brief, lockedPlan }, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        output: finalPath,
        charsNoWhitespace: manuscript.replace(/\s/g, "").length,
        chapters: chapters.length
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
