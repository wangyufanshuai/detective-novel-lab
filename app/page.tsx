"use client";

import {
  BookOpen,
  Check,
  ClipboardCopy,
  Download,
  Eye,
  EyeOff,
  FileText,
  FlaskConical,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Wand2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Provider = "deepseek" | "siliconflow";
type Mode = "quick" | "expert";

type Stage = {
  id: string;
  label: string;
  short: string;
  description: string;
};

const stages: Stage[] = [
  { id: "material", label: "素材输入", short: "材料", description: "整理人物、场景、已有线索与创作边界" },
  { id: "schemes", label: "案件方案", short: "方案", description: "生成三套可选谜面与案件方向" },
  { id: "truth", label: "真相骨架", short: "真相", description: "确定凶手、动机、手法与核心诡计" },
  { id: "timeline", label: "嫌疑人与时间线", short: "时间线", description: "梳理行动、谎言、不在场证明与漏洞" },
  { id: "clues", label: "线索与红鲱鱼", short: "线索", description: "设计公平线索、误导、伏笔与回收方式" },
  { id: "fairness", label: "公平推理检查", short: "审计", description: "检查读者是否能在揭晓前推出真相" },
  { id: "outline", label: "章节大纲", short: "大纲", description: "生成含挑战读者段落的短篇结构" },
  { id: "prose", label: "正文生成", short: "正文", description: "逐步汇总并生成完整中文短篇草稿" }
];

const caseTypes = [
  "随机组合",
  "密室杀人",
  "不在场证明",
  "毒杀诡计",
  "死亡留言",
  "身份误认",
  "伪装自杀",
  "消失的凶器",
  "童谣杀人",
  "多重时间线",
  "叙述性误导"
];

const lengthTargets = [
  "3000-6000字",
  "8000-15000字",
  "15000-25000字"
];

const starterBrief = `人物：
- 侦探：随机生成
- 死者：
- 嫌疑人：
- 关键关系：

案件素材：
- 场景：
- 已有线索：
- 希望出现的谜面：
- 不希望出现的设定：

大纲灵感：
- `;

const quickStarter = `我想写一篇中文本格推理小说。

背景：
- 地点：
- 时代：
- 氛围：

人物：
- 侦探：
- 死者：
- 嫌疑人：

案件：
- 案件类型：
- 核心谜面：
- 已有线索：
- 想要的反转：
- 不想要的设定：

其他要求：
- `;

function stripHiddenTruth(text: string) {
  return text
    .replace(/幕后真相[：:][\s\S]*?(?=\n#{1,4}\s|\n##\s|$)/g, "幕后真相：已隐藏")
    .replace(/隐藏真相[：:][\s\S]*?(?=\n[-#]|$)/g, "隐藏真相：已隐藏")
    .replace(/凶手[：:][^\n]+/g, "凶手：已隐藏");
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function chapterCountFor(lengthTarget: string) {
  if (lengthTarget === "3000-6000字") return 4;
  if (lengthTarget === "15000-25000字") return 10;
  return 7;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("quick");
  const [provider, setProvider] = useState<Provider>("deepseek");
  const [selectedCaseType, setSelectedCaseType] = useState("随机组合");
  const [lengthTarget, setLengthTarget] = useState("8000-15000字");
  const [hiddenTruthMode, setHiddenTruthMode] = useState(false);
  const [status, setStatus] = useState("准备开始。");
  const [isGenerating, setIsGenerating] = useState(false);

  const [quickBrief, setQuickBrief] = useState(quickStarter);
  const [quickDirection, setQuickDirection] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [confirmedSynopsis, setConfirmedSynopsis] = useState("");
  const [quickOutline, setQuickOutline] = useState("");
  const [fullNovel, setFullNovel] = useState("");
  const [progress, setProgress] = useState("");

  const [activeStage, setActiveStage] = useState("material");
  const [brief, setBrief] = useState(starterBrief);
  const [direction, setDirection] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [workingText, setWorkingText] = useState("");

  const activeIndex = stages.findIndex((stage) => stage.id === activeStage);
  const active = stages[activeIndex] || stages[0];

  useEffect(() => {
    const saved = localStorage.getItem("detective-novel-lab");
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      setMode(data.mode || "quick");
      setProvider(data.provider || "deepseek");
      setSelectedCaseType(data.selectedCaseType || "随机组合");
      setLengthTarget(data.lengthTarget || "8000-15000字");
      setHiddenTruthMode(Boolean(data.hiddenTruthMode));
      setQuickBrief(data.quickBrief || quickStarter);
      setQuickDirection(data.quickDirection || "");
      setSynopsis(data.synopsis || "");
      setConfirmedSynopsis(data.confirmedSynopsis || "");
      setQuickOutline(data.quickOutline || "");
      setFullNovel(data.fullNovel || "");
      setActiveStage(data.activeStage || "material");
      setBrief(data.brief || starterBrief);
      setDirection(data.direction || "");
      setDrafts(data.drafts || {});
      setWorkingText(data.workingText || "");
    } catch {
      setStatus("本地草稿读取失败，已使用空白项目。");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "detective-novel-lab",
      JSON.stringify({
        mode,
        provider,
        selectedCaseType,
        lengthTarget,
        hiddenTruthMode,
        quickBrief,
        quickDirection,
        synopsis,
        confirmedSynopsis,
        quickOutline,
        fullNovel,
        activeStage,
        brief,
        direction,
        drafts,
        workingText
      })
    );
  }, [
    mode,
    provider,
    selectedCaseType,
    lengthTarget,
    hiddenTruthMode,
    quickBrief,
    quickDirection,
    synopsis,
    confirmedSynopsis,
    quickOutline,
    fullNovel,
    activeStage,
    brief,
    direction,
    drafts,
    workingText
  ]);

  useEffect(() => {
    if (mode === "expert") {
      setWorkingText(drafts[activeStage] || "");
      setDirection("");
    }
  }, [activeStage, drafts, mode]);

  const compiledExpert = useMemo(() => {
    return stages
      .map((stage) => {
        const text = drafts[stage.id];
        return text?.trim() ? `# ${stage.label}\n\n${text.trim()}` : "";
      })
      .filter(Boolean)
      .join("\n\n---\n\n");
  }, [drafts]);

  const quickExport = useMemo(() => {
    return [
      synopsis ? `# 故事大概\n\n${synopsis.trim()}` : "",
      quickOutline ? `# 章节大纲\n\n${quickOutline.trim()}` : "",
      fullNovel ? `# 完整小说\n\n${fullNovel.trim()}` : ""
    ]
      .filter(Boolean)
      .join("\n\n---\n\n");
  }, [synopsis, quickOutline, fullNovel]);

  async function callGenerate(stage: string, stageLabel: string, payload: Record<string, string>, userDirection: string) {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        stage,
        stageLabel,
        brief: mode === "quick" ? quickBrief : brief,
        currentDraft: payload,
        selectedCaseType,
        hiddenTruthMode,
        userDirection,
        lengthTarget,
        variants: 1
      })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "生成失败");
    }
    return String(data.content || "");
  }

  async function generateSynopsis(regenerate = false) {
    setIsGenerating(true);
    setProgress("");
    setStatus(regenerate ? "正在按修改意见重生成故事大概..." : "正在生成故事大概...");
    try {
      const content = await callGenerate(
        "quickSynopsis",
        "快速模式：故事大概",
        { previousSynopsis: synopsis },
        regenerate ? quickDirection : "生成标准版故事大概，显示幕后真相，方便创作者确认。"
      );
      setSynopsis(content);
      setConfirmedSynopsis("");
      setFullNovel("");
      setQuickOutline("");
      setStatus("故事大概已生成。你可以修改意见后重生成，或确认并生成完整小说。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "生成失败");
    } finally {
      setIsGenerating(false);
    }
  }

  async function generateFullNovel() {
    const baseSynopsis = (synopsis || confirmedSynopsis).trim();
    if (!baseSynopsis) {
      setStatus("请先生成并确认故事大概。");
      return;
    }

    setIsGenerating(true);
    setFullNovel("");
    setQuickOutline("");
    setConfirmedSynopsis(baseSynopsis);
    setStatus("正在生成完整小说...");

    try {
      setProgress("正在生成章节大纲...");
      const outline = await callGenerate(
        "quickOutline",
        "快速模式：章节大纲",
        { confirmedSynopsis: baseSynopsis },
        `根据已确认故事大概生成章节大纲。目标篇幅：${lengthTarget}。`
      );
      setQuickOutline(outline);

      const total = chapterCountFor(lengthTarget);
      const chapters: string[] = [];
      for (let index = 1; index <= total; index += 1) {
        setProgress(`正在生成第 ${index}/${total} 章...`);
        const chapter = await callGenerate(
          "quickChapter",
          `快速模式：正文第${index}章`,
          {
            confirmedSynopsis: baseSynopsis,
            outline,
            previousChapters: chapters.join("\n\n---\n\n")
          },
          `生成第${index}章正文。全书共${total}章。只写本章正文，承接前文，不要重复大纲。`
        );
        chapters.push(chapter.trim());
        setFullNovel(chapters.join("\n\n---\n\n"));
      }

      setProgress("完成。");
      setStatus("完整小说已生成，可以复制或导出。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "生成失败");
    } finally {
      setIsGenerating(false);
    }
  }

  async function generateExpert(regenerate = false) {
    setIsGenerating(true);
    setStatus(regenerate ? "正在按修改要求重生成..." : "正在生成当前阶段...");
    try {
      const content = await callGenerate(
        activeStage,
        active.label,
        drafts,
        regenerate ? direction : direction || "按当前阶段要求生成。"
      );
      setWorkingText(content);
      setStatus("生成完成，等待你采用或编辑。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "生成失败");
    } finally {
      setIsGenerating(false);
    }
  }

  function acceptStage() {
    setDrafts((current) => ({ ...current, [activeStage]: workingText }));
    const nextStage = stages[Math.min(activeIndex + 1, stages.length - 1)];
    setActiveStage(nextStage.id);
    setStatus(`已采用「${active.label}」，进入「${nextStage.label}」。`);
  }

  function saveEdit() {
    setDrafts((current) => ({ ...current, [activeStage]: workingText }));
    setStatus(`已保存「${active.label}」的手动编辑。`);
  }

  async function copyAll() {
    await navigator.clipboard.writeText(mode === "quick" ? quickExport : compiledExpert || workingText || "");
    setStatus("已复制当前项目文本。");
  }

  const visibleSynopsis = hiddenTruthMode ? stripHiddenTruth(synopsis) : synopsis;
  const visibleWorkingText = hiddenTruthMode ? stripHiddenTruth(workingText) : workingText;
  const exportText = mode === "quick" ? quickExport : compiledExpert || workingText;

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">
            <FlaskConical size={22} />
          </div>
          <div>
            <p>逻辑之王</p>
            <h1>推理工坊</h1>
          </div>
        </div>

        <div className="modeSwitch">
          <button className={mode === "quick" ? "selected" : ""} onClick={() => setMode("quick")} type="button">
            <Wand2 size={16} />
            快速模式
          </button>
          <button className={mode === "expert" ? "selected" : ""} onClick={() => setMode("expert")} type="button">
            <BookOpen size={16} />
            专家模式
          </button>
        </div>

        {mode === "expert" && (
          <div className="stageList" aria-label="创作流程">
            {stages.map((stage, index) => (
              <button
                className={`stageButton ${stage.id === activeStage ? "active" : ""} ${drafts[stage.id] ? "done" : ""}`}
                key={stage.id}
                onClick={() => setActiveStage(stage.id)}
                type="button"
              >
                <span className="stageNumber">{drafts[stage.id] ? <Check size={15} /> : index + 1}</span>
                <span>
                  <strong>{stage.label}</strong>
                  <small>{stage.description}</small>
                </span>
              </button>
            ))}
          </div>
        )}

        {mode === "quick" && (
          <div className="quickSteps">
            <div className={synopsis ? "step done" : "step active"}>1. 输入大纲，生成故事大概</div>
            <div className={confirmedSynopsis ? "step done" : "step"}>2. 确认或修改故事大概</div>
            <div className={fullNovel ? "step done" : "step"}>3. 一键生成完整小说</div>
          </div>
        )}

        <div className="sidebarPanel">
          <div className="panelTitle">
            <KeyRound size={16} />
            <span>模型</span>
          </div>
          <div className="segmented">
            <button className={provider === "deepseek" ? "selected" : ""} onClick={() => setProvider("deepseek")} type="button">
              DeepSeek
            </button>
            <button className={provider === "siliconflow" ? "selected" : ""} onClick={() => setProvider("siliconflow")} type="button">
              硅基流动
            </button>
          </div>
          <p className="hint">修改 `.env` 后请重启开发服务器。</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{mode === "quick" ? "大纲 → 故事大概 → 完整小说" : "8000-15000字 · 公平推理 · 分阶段确认"}</p>
            <h2>{mode === "quick" ? "快速生成" : active.label}</h2>
          </div>
          <div className="topActions">
            <button className="iconButton" onClick={() => setHiddenTruthMode((value) => !value)} title="切换真相显示" type="button">
              {hiddenTruthMode ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <button className="iconButton" onClick={copyAll} title="复制项目文本" type="button">
              <ClipboardCopy size={18} />
            </button>
            <button
              className="iconButton"
              onClick={() => downloadFile("推理小说项目.md", exportText, "text/markdown;charset=utf-8")}
              title="导出 Markdown"
              type="button"
            >
              <Download size={18} />
            </button>
            <button
              className="iconButton"
              onClick={() => downloadFile("推理小说项目.txt", exportText, "text/plain;charset=utf-8")}
              title="导出 TXT"
              type="button"
            >
              <FileText size={18} />
            </button>
          </div>
        </header>

        {mode === "quick" ? (
          <div className="quickGrid">
            <section className="inputDeck">
              <div className="cardHeader">
                <div>
                  <p className="cardKicker">快速输入</p>
                  <h3>你的故事大纲</h3>
                </div>
                <button className="softButton" onClick={() => setQuickBrief(quickStarter)} type="button">
                  重置模板
                </button>
              </div>

              <div className="twoCols">
                <label className="field">
                  <span>案件类型</span>
                  <select value={selectedCaseType} onChange={(event) => setSelectedCaseType(event.target.value)}>
                    {caseTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>默认篇幅</span>
                  <select value={lengthTarget} onChange={(event) => setLengthTarget(event.target.value)}>
                    {lengthTargets.map((target) => (
                      <option key={target} value={target}>
                        {target}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field grow">
                <span>输入大纲</span>
                <textarea
                  value={quickBrief}
                  onChange={(event) => setQuickBrief(event.target.value)}
                  spellCheck={false}
                  translate="no"
                  autoComplete="off"
                  data-gramm="false"
                  data-ms-editor="false"
                />
              </label>

              <label className="field">
                <span>修改意见</span>
                <textarea
                  className="smallArea"
                  placeholder="例如：凶手换成医生；密室诡计更简单；时代改成民国；减少人物数量。"
                  value={quickDirection}
                  onChange={(event) => setQuickDirection(event.target.value)}
                  spellCheck={false}
                  translate="no"
                  autoComplete="off"
                  data-gramm="false"
                  data-ms-editor="false"
                />
              </label>

              <div className="actionRow">
                <button className="primaryButton" disabled={isGenerating} onClick={() => generateSynopsis(false)} type="button">
                  {isGenerating ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
                  生成故事大概
                </button>
                <button className="secondaryButton" disabled={isGenerating || !synopsis.trim()} onClick={() => generateSynopsis(true)} type="button">
                  <RefreshCw size={17} />
                  按意见重生成
                </button>
              </div>
            </section>

            <section className="outputDeck">
              <div className="cardHeader">
                <div>
                  <p className="cardKicker">确认稿</p>
                  <h3>故事大概</h3>
                </div>
                <div className="truthToggle">{hiddenTruthMode ? "隐藏真相" : "显示真相"}</div>
              </div>
              <textarea
                className="draftEditor"
                placeholder="先点击“生成故事大概”。满意后可以直接点击“确认并生成完整小说”。"
                value={hiddenTruthMode ? visibleSynopsis : synopsis}
                onChange={(event) => setSynopsis(event.target.value)}
                readOnly={hiddenTruthMode}
                spellCheck={false}
                translate="no"
                autoComplete="off"
                data-gramm="false"
                data-ms-editor="false"
              />
              <div className="actionRow compact">
                <button className="primaryButton" disabled={isGenerating || !synopsis.trim()} onClick={generateFullNovel} type="button">
                  {isGenerating ? <Loader2 className="spin" size={18} /> : <Wand2 size={18} />}
                  确认并生成完整小说
                </button>
                <button className="secondaryButton" disabled={!synopsis.trim()} onClick={() => { setConfirmedSynopsis(synopsis); setStatus("故事大概已确认。"); }} type="button">
                  <Save size={17} />
                  仅确认大概
                </button>
              </div>
            </section>

            <section className="fullOutput">
              <div className="cardHeader">
                <div>
                  <p className="cardKicker">成稿</p>
                  <h3>完整小说</h3>
                </div>
                <div className="truthToggle">{progress || "等待生成"}</div>
              </div>
              <textarea
                className="novelEditor"
                placeholder="确认故事大概后，这里会逐章显示完整小说。"
                value={fullNovel}
                onChange={(event) => setFullNovel(event.target.value)}
                spellCheck={false}
                translate="no"
                autoComplete="off"
                data-gramm="false"
                data-ms-editor="false"
              />
            </section>
          </div>
        ) : (
          <div className="contentGrid">
            <section className="inputDeck" aria-label="输入区">
              <div className="cardHeader">
                <div>
                  <p className="cardKicker">案件档案</p>
                  <h3>创作素材</h3>
                </div>
                <button className="softButton" onClick={() => setBrief(starterBrief)} type="button">
                  重置模板
                </button>
              </div>

              <label className="field">
                <span>案件类型库</span>
                <select value={selectedCaseType} onChange={(event) => setSelectedCaseType(event.target.value)}>
                  {caseTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field grow">
                <span>中等输入模板</span>
                <textarea value={brief} onChange={(event) => setBrief(event.target.value)} spellCheck={false} translate="no" />
              </label>

              <label className="field">
                <span>本轮修改要求</span>
                <textarea
                  className="smallArea"
                  placeholder="例如：让诡计更依赖时间线；减少怪奇元素；把地点改成民国报馆。"
                  value={direction}
                  onChange={(event) => setDirection(event.target.value)}
                  spellCheck={false}
                  translate="no"
                />
              </label>

              <div className="actionRow">
                <button className="primaryButton" disabled={isGenerating} onClick={() => generateExpert(false)} type="button">
                  {isGenerating ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
                  生成本阶段
                </button>
                <button className="secondaryButton" disabled={isGenerating} onClick={() => generateExpert(true)} type="button">
                  <RefreshCw size={17} />
                  按要求重生成
                </button>
              </div>
            </section>

            <section className="outputDeck" aria-label="输出区">
              <div className="cardHeader">
                <div>
                  <p className="cardKicker">AI 草案</p>
                  <h3>{active.short}工作纸</h3>
                </div>
                <div className="truthToggle">{hiddenTruthMode ? "读者体验" : "创作者模式"}</div>
              </div>

              <textarea
                className="draftEditor"
                placeholder="点击“生成本阶段”，或直接在这里手写你的设定。"
                value={hiddenTruthMode ? visibleWorkingText : workingText}
                onChange={(event) => setWorkingText(event.target.value)}
                readOnly={hiddenTruthMode}
                spellCheck={false}
                translate="no"
              />

              <div className="actionRow compact">
                <button className="primaryButton" disabled={!workingText.trim()} onClick={acceptStage} type="button">
                  <Check size={18} />
                  采用并进入下一步
                </button>
                <button className="secondaryButton" disabled={!workingText.trim()} onClick={saveEdit} type="button">
                  <Save size={17} />
                  保存编辑
                </button>
              </div>
            </section>
          </div>
        )}

        <section className="reviewStrip" aria-label="项目摘要">
          <div className="reviewItem">
            <BookOpen size={18} />
            <span>{mode === "quick" ? "快速状态" : "已确认阶段"}</span>
            <strong>{mode === "quick" ? (fullNovel ? "已成稿" : synopsis ? "待确认" : "未开始") : `${Object.values(drafts).filter(Boolean).length}/8`}</strong>
          </div>
          <div className="reviewItem">
            <Eye size={18} />
            <span>真相显示</span>
            <strong>{hiddenTruthMode ? "隐藏" : "可见"}</strong>
          </div>
          <div className="reviewItem wide">
            <Sparkles size={18} />
            <span>状态</span>
            <strong>{status}</strong>
          </div>
        </section>
      </section>
    </main>
  );
}
