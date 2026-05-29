"use client";

import {
  BookOpen,
  CheckCircle2,
  ClipboardCopy,
  Download,
  Eye,
  FileJson,
  GitBranch,
  KeyRound,
  Loader2,
  MessageSquare,
  Network,
  Search,
  Sparkles,
  Target,
  Wand2,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Character,
  DeductionCase,
  Evidence,
  EvidenceChallenge,
  PlayerTheory,
  createFallbackCase,
  evaluateEvidenceChallenge,
  evidenceByScene,
  getReasoningCoverage,
  getTimelineContradictions,
  judgeTheory,
  validateCase
} from "@/lib/engine";

type Provider = "deepseek" | "siliconflow";
type Mode = "game" | "novel";
type WorkbenchView = "truth" | "matrix" | "evidence" | "timeline" | "report" | "json";

type DialogueEntry = {
  characterId: string;
  question: string;
  evidenceId?: string;
  challenge?: EvidenceChallenge;
  answer: string;
};

const storageKey = "deduction-engine-v4";
const caseTypes = ["随机组合", "密室杀人", "死亡留言", "不在场证明", "毒杀", "身份误认", "消失的凶器"];
const lengthTargets = ["3000-6000字", "8000-15000字", "15000-25000字"];

const gameStarter = `题材：校园天文台死亡留言

背景：
- 大学校庆前夜，暴雨，山顶天文台。
- 天体物理教授死在圆顶观测室。

谜面：
- 监控显示案发时间无人进入。
- 死者手边留下半张星图，圈出“北极星”。
- 当晚暴雨无星可见。

要求：
- 公平推理。
- 凶手唯一。
- 每个非凶手都要有可发现的排除证据。
- 不要超自然、双胞胎、秘密通道。`;

const novelStarter = `我想写一篇中文本格推理小说。
背景：
- 地点：
- 时代：

人物：
- 侦探：
- 死者：
- 嫌疑人：

案件：
- 核心谜面：
- 已有线索：
- 不想要的设定：`;

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function safeIdList(value: string) {
  return value
    .split(/[,\s，、]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function characterName(deductionCase: DeductionCase | null, id: string) {
  return deductionCase?.characters.find((character) => character.id === id)?.name || id;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("game");
  const [provider, setProvider] = useState<Provider>("deepseek");
  const [caseType, setCaseType] = useState("死亡留言");
  const [lengthTarget, setLengthTarget] = useState("3000-6000字");
  const [topic, setTopic] = useState(gameStarter);
  const [status, setStatus] = useState("准备开始。");
  const [progress, setProgress] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const [deductionCase, setDeductionCase] = useState<DeductionCase | null>(null);
  const [caseFile, setCaseFile] = useState("");
  const [discoveredEvidenceIds, setDiscoveredEvidenceIds] = useState<string[]>([]);
  const [exposedContradictionIds, setExposedContradictionIds] = useState<string[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState("");
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState("");
  const [question, setQuestion] = useState("");
  const [dialogues, setDialogues] = useState<DialogueEntry[]>([]);
  const [theory, setTheory] = useState<PlayerTheory>({ culpritId: "", motive: "", method: "", evidenceIds: [] });
  const [judgementText, setJudgementText] = useState("");
  const [solutionText, setSolutionText] = useState("");
  const [workbenchView, setWorkbenchView] = useState<WorkbenchView>("truth");

  const [novelBrief, setNovelBrief] = useState(novelStarter);
  const [novelSynopsis, setNovelSynopsis] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      setMode(data.mode || "game");
      setProvider(data.provider || "deepseek");
      setCaseType(data.caseType || "死亡留言");
      setLengthTarget(data.lengthTarget || "3000-6000字");
      setTopic(data.topic || gameStarter);
      setDeductionCase(data.deductionCase || null);
      setCaseFile(data.caseFile || "");
      setDiscoveredEvidenceIds(data.discoveredEvidenceIds || []);
      setExposedContradictionIds(data.exposedContradictionIds || []);
      setSelectedSceneId(data.selectedSceneId || "");
      setSelectedCharacterId(data.selectedCharacterId || "");
      setSelectedEvidenceId(data.selectedEvidenceId || "");
      setDialogues(data.dialogues || []);
      setTheory(data.theory || { culpritId: "", motive: "", method: "", evidenceIds: [] });
      setJudgementText(data.judgementText || "");
      setSolutionText(data.solutionText || "");
      setWorkbenchView(data.workbenchView || "truth");
      setNovelBrief(data.novelBrief || novelStarter);
      setNovelSynopsis(data.novelSynopsis || "");
    } catch {
      setStatus("本地进度读取失败，已使用空白项目。");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        mode,
        provider,
        caseType,
        lengthTarget,
        topic,
        deductionCase,
        caseFile,
        discoveredEvidenceIds,
        exposedContradictionIds,
        selectedSceneId,
        selectedCharacterId,
        selectedEvidenceId,
        dialogues,
        theory,
        judgementText,
        solutionText,
        workbenchView,
        novelBrief,
        novelSynopsis
      })
    );
  }, [
    mode,
    provider,
    caseType,
    lengthTarget,
    topic,
    deductionCase,
    caseFile,
    discoveredEvidenceIds,
    exposedContradictionIds,
    selectedSceneId,
    selectedCharacterId,
    selectedEvidenceId,
    dialogues,
    theory,
    judgementText,
    solutionText,
    workbenchView,
    novelBrief,
    novelSynopsis
  ]);

  const validation = useMemo(() => (deductionCase ? validateCase(deductionCase) : null), [deductionCase]);
  const discoveredEvidence = useMemo(
    () => (deductionCase ? deductionCase.evidence.filter((item) => discoveredEvidenceIds.includes(item.id)) : []),
    [deductionCase, discoveredEvidenceIds]
  );
  const timelineContradictions = useMemo(
    () => (deductionCase ? getTimelineContradictions(deductionCase, discoveredEvidenceIds) : []),
    [deductionCase, discoveredEvidenceIds]
  );
  const reasoningCoverage = useMemo(
    () => (deductionCase ? getReasoningCoverage(deductionCase, theory.evidenceIds) : null),
    [deductionCase, theory.evidenceIds]
  );

  const exportMarkdown = useMemo(() => {
    if (!deductionCase) return "";
    return [
      `# ${deductionCase.title}`,
      "## Player Case File",
      caseFile,
      "## Rule Report",
      "```json",
      renderJson(validation),
      "```",
      "## Discovered Evidence",
      discoveredEvidence.map((item) => `- ${item.id} ${item.title}: ${item.visibleDescription}`).join("\n"),
      "## Dialogues",
      dialogues.map((item) => `### ${characterName(deductionCase, item.characterId)}\nEvidence: ${item.evidenceId || "none"}\nQ: ${item.question}\nA: ${item.answer}`).join("\n\n"),
      "## Judgement",
      judgementText,
      "## Solution",
      solutionText,
      "## Structured Case",
      "```json",
      renderJson(deductionCase),
      "```"
    ].join("\n\n");
  }, [caseFile, deductionCase, dialogues, discoveredEvidence, judgementText, solutionText, validation]);

  async function callGenerate(stage: string, body: Record<string, unknown>) {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        stage,
        stageLabel: stage,
        brief: topic,
        selectedCaseType: caseType,
        lengthTarget,
        hiddenTruthMode: false,
        ...body
      })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "生成失败");
    return data;
  }

  function hydrateCase(nextCase: DeductionCase, nextCaseFile = nextCase.publicCaseFile, nextStatus = "案件已载入。") {
    setDeductionCase(nextCase);
    setCaseFile(nextCaseFile);
    setDiscoveredEvidenceIds([]);
    setExposedContradictionIds([]);
    setDialogues([]);
    setJudgementText("");
    setSolutionText("");
    setTheory({ culpritId: "", motive: "", method: "", evidenceIds: [] });
    setSelectedSceneId(nextCase.scenes[0]?.id || "");
    setSelectedCharacterId(nextCase.characters.find((character) => !character.isCulprit)?.id || nextCase.characters[0]?.id || "");
    setSelectedEvidenceId("");
    setStatus(nextStatus);
    setWorkbenchView("truth");
  }

  function loadShowcase() {
    const showcase = createFallbackCase("Showcase: 校园天文台死亡留言");
    hydrateCase(showcase, showcase.publicCaseFile, "Showcase 案件已载入：无需 API Key，可完整体验工作台和规则引擎。");
  }

  async function generateCase() {
    setIsGenerating(true);
    setStatus("正在调用模型生成并校验结构化案件...");
    setProgress("gameTruthSeed");
    try {
      const seed = await callGenerate("gameTruthSeed", { currentDraft: {} });
      const nextCase = seed.json as DeductionCase;
      const nextValidation = validateCase(nextCase);
      setProgress("gameCaseFile");
      const file = await callGenerate("gameCaseFile", {
        currentDraft: { structuredCase: renderJson(nextCase), validation: renderJson(nextValidation) },
        userDirection: "生成玩家可见案卷，不要泄露凶手、幕后真相、证据真实含义和完整排除链。"
      });
      hydrateCase(nextCase, file.content, seed.repaired ? "案件已生成，自动修复过逻辑结构。" : "案件已生成。");
      setProgress("");
    } catch (error) {
      const fallback = createFallbackCase(topic);
      hydrateCase(fallback, fallback.publicCaseFile, error instanceof Error ? `生成失败，已载入 Showcase：${error.message}` : "生成失败，已载入 Showcase。");
    } finally {
      setIsGenerating(false);
    }
  }

  function searchScene() {
    if (!deductionCase || !selectedSceneId) return;
    const found = evidenceByScene(deductionCase, selectedSceneId).map((item) => item.id);
    setDiscoveredEvidenceIds((current) => Array.from(new Set([...current, ...found])));
    setStatus(found.length ? `发现 ${found.length} 条证据。` : "这个场景没有新的可发现证据。");
  }

  async function challengeCharacter() {
    if (!deductionCase || !selectedCharacterId || !question.trim()) return;
    setIsGenerating(true);
    setStatus("正在生成质询回答...");
    try {
      const character = deductionCase.characters.find((item) => item.id === selectedCharacterId) as Character;
      const evidence = deductionCase.evidence.find((item) => item.id === selectedEvidenceId) as Evidence | undefined;
      const challenge = evidence ? evaluateEvidenceChallenge(deductionCase, selectedCharacterId, selectedEvidenceId) : undefined;
      if (challenge?.exposedContradictions.length) {
        setExposedContradictionIds((current) => Array.from(new Set([...current, ...challenge.exposedContradictions])));
      }
      const result = await callGenerate(evidence ? "gameEvidenceChallenge" : "gameDialogue", {
        currentDraft: {
          structuredCase: renderJson(deductionCase),
          character: renderJson(character),
          selectedEvidence: renderJson(evidence || null),
          challenge: renderJson(challenge || null),
          discoveredEvidence: renderJson(discoveredEvidence)
        },
        userDirection: `玩家问题：${question}`
      });
      setDialogues((items) => [...items, { characterId: selectedCharacterId, evidenceId: selectedEvidenceId || undefined, question, challenge, answer: result.content }]);
      setQuestion("");
      setStatus(challenge?.hit ? "质询命中矛盾，已记录。" : "角色回答已记录。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "质询失败");
    } finally {
      setIsGenerating(false);
    }
  }

  async function submitTheory() {
    if (!deductionCase) return;
    const result = judgeTheory(deductionCase, theory, discoveredEvidenceIds);
    setIsGenerating(true);
    setStatus("正在解释判定结果...");
    try {
      const explanation = await callGenerate("gameJudgement", {
        currentDraft: {
          structuredCase: renderJson(deductionCase),
          ruleJudgement: renderJson(result),
          playerTheory: renderJson(theory)
        },
        userDirection: `规则结论必须保持为：${result.accepted ? "推理成立" : "推理不成立"}。`
      });
      setJudgementText(`${result.accepted ? "推理成立" : "推理不成立"}，得分 ${result.score}/100\n\n${explanation.content}`);
      if (result.accepted) {
        const solution = await callGenerate("gameSolutionReveal", {
          currentDraft: { structuredCase: renderJson(deductionCase), playerTheory: renderJson(theory), ruleJudgement: renderJson(result) },
          userDirection: "玩家已通过规则判定，生成完整解答篇。"
        });
        setSolutionText(solution.content);
        setStatus("推理通过，解答篇已生成。");
      } else {
        setSolutionText("");
        setStatus("推理未通过，只展示缺口提示。");
      }
    } catch {
      setJudgementText(`${result.accepted ? "推理成立" : "推理不成立"}，得分 ${result.score}/100\n\n${result.explanation}\n\n缺口：${result.missing.join("；") || "无"}\n矛盾：${result.contradictions.join("；") || "无"}`);
      setStatus("已使用本地规则结果展示判定。");
    } finally {
      setIsGenerating(false);
    }
  }

  async function generateNovelSynopsis() {
    setIsGenerating(true);
    setStatus("正在生成小说故事大概...");
    try {
      const result = await callGenerate("quickSynopsis", {
        brief: novelBrief,
        currentDraft: {},
        userDirection: "生成标准版故事大概。"
      });
      setNovelSynopsis(result.content);
      setStatus("小说故事大概已生成。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "生成失败");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">
            <Network size={22} />
          </div>
          <div>
            <p>Deduction Engine</p>
            <h1>Engine + Workbench</h1>
          </div>
        </div>

        <div className="modeSwitch">
          <button className={mode === "game" ? "selected" : ""} onClick={() => setMode("game")} type="button">
            <Target size={16} />
            Deduction Game
          </button>
          <button className={mode === "novel" ? "selected" : ""} onClick={() => setMode("novel")} type="button">
            <BookOpen size={16} />
            小说生成
          </button>
        </div>

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
          <p className="hint">LLM 负责候选结构和文本，本地规则引擎负责最终裁判。Showcase 模式无需 API Key。</p>
        </div>
      </aside>

      {mode === "game" ? (
        <section className="workspace">
          <header className="topbar">
            <div>
              <p className="eyebrow">LLM + Symbolic Rules + Visual Case Workbench</p>
              <h2>{deductionCase?.title || "Deduction Engine"}</h2>
            </div>
            <div className="topActions">
              <button className="iconButton" onClick={() => navigator.clipboard.writeText(exportMarkdown)} title="复制案卷" type="button">
                <ClipboardCopy size={18} />
              </button>
              <button className="iconButton" onClick={() => downloadFile("deduction-case.md", exportMarkdown, "text/markdown;charset=utf-8")} title="导出 Markdown" type="button">
                <Download size={18} />
              </button>
              <button className="iconButton" onClick={() => deductionCase && downloadFile("deduction-case.json", renderJson(deductionCase), "application/json;charset=utf-8")} title="导出 JSON" type="button">
                <FileJson size={18} />
              </button>
            </div>
          </header>

          <div className="heroBand">
            <div>
              <p>GitHub-ready AI deduction engine</p>
              <h3>不是让 AI 直接编故事，而是让 AI 生成可验证的案件结构。</h3>
            </div>
            <div className="heroActions">
              <button className="primaryButton" onClick={loadShowcase} type="button">
                <Sparkles size={18} />
                Demo Case
              </button>
              <button className="secondaryButton" disabled={isGenerating} onClick={generateCase} type="button">
                {isGenerating ? <Loader2 className="spin" size={18} /> : <Wand2 size={18} />}
                Generate Case
              </button>
            </div>
          </div>

          <div className="gameGrid">
            <section className="inputDeck">
              <div className="cardHeader">
                <div>
                  <p className="cardKicker">Generate Case</p>
                  <h3>题材与约束</h3>
                </div>
              </div>
              <div className="twoCols">
                <label className="field">
                  <span>案件类型</span>
                  <select value={caseType} onChange={(event) => setCaseType(event.target.value)}>
                    {caseTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>篇幅档位</span>
                  <select value={lengthTarget} onChange={(event) => setLengthTarget(event.target.value)}>
                    {lengthTargets.map((target) => (
                      <option key={target}>{target}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="field grow">
                <span>Prompt Brief</span>
                <textarea value={topic} onChange={(event) => setTopic(event.target.value)} spellCheck={false} translate="no" />
              </label>
            </section>

            <section className="outputDeck">
              <div className="cardHeader">
                <div>
                  <p className="cardKicker">Player Case File</p>
                  <h3>玩家可见案卷</h3>
                </div>
                <div className="truthToggle">{progress || "Rule First"}</div>
              </div>
              <textarea className="draftEditor" value={caseFile} readOnly placeholder="点击 Demo Case 立即载入示范案，或调用 DeepSeek 生成新案。" />
            </section>

            <section className="reviewStrip">
              <div className="reviewItem">
                {validation?.valid ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                <span>规则校验</span>
                <strong>{validation ? (validation.valid ? "通过" : "有问题") : "未载入"}</strong>
              </div>
              <div className="reviewItem">
                <Eye size={18} />
                <span>已发现证据</span>
                <strong>{discoveredEvidenceIds.length}</strong>
              </div>
              <div className="reviewItem">
                <GitBranch size={18} />
                <span>推理覆盖</span>
                <strong>{reasoningCoverage ? `${Math.round(reasoningCoverage.coverageRatio * 100)}%` : "0%"}</strong>
              </div>
              <div className="reviewItem wide">
                <Sparkles size={18} />
                <span>状态</span>
                <strong>{status}</strong>
              </div>
            </section>

            {deductionCase && (
              <>
                <Workbench deductionCase={deductionCase} validation={validation} discoveredEvidenceIds={discoveredEvidenceIds} view={workbenchView} setView={setWorkbenchView} />

                <section className="panel">
                  <div className="cardHeader">
                    <div>
                      <p className="cardKicker">Scene Search</p>
                      <h3>搜索证据</h3>
                    </div>
                  </div>
                  <label className="field">
                    <span>场景</span>
                    <select value={selectedSceneId} onChange={(event) => setSelectedSceneId(event.target.value)}>
                      {deductionCase.scenes.map((scene) => (
                        <option key={scene.id} value={scene.id}>
                          {scene.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="secondaryButton" onClick={searchScene} type="button">
                    <Search size={17} />
                    搜索场景
                  </button>
                  <div className="scrollList">
                    {discoveredEvidence.map((item) => (
                      <div className="miniCard" key={item.id}>
                        <strong>{item.title}</strong>
                        <p>{item.visibleDescription}</p>
                        <code>{item.id}</code>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="panel">
                  <div className="cardHeader">
                    <div>
                      <p className="cardKicker">Evidence Challenge</p>
                      <h3>证据质询</h3>
                    </div>
                  </div>
                  <div className="twoCols">
                    <label className="field">
                      <span>角色</span>
                      <select value={selectedCharacterId} onChange={(event) => setSelectedCharacterId(event.target.value)}>
                        {deductionCase.characters.map((character) => (
                          <option key={character.id} value={character.id}>
                            {character.name} - {character.role}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>出示证据</span>
                      <select value={selectedEvidenceId} onChange={(event) => setSelectedEvidenceId(event.target.value)}>
                        <option value="">不出示证据</option>
                        {discoveredEvidence.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="field">
                    <span>问题</span>
                    <textarea className="smallArea" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="这条证据和你的证词是否矛盾？" />
                  </label>
                  <button className="secondaryButton" disabled={isGenerating || !question.trim()} onClick={challengeCharacter} type="button">
                    <MessageSquare size={17} />
                    质询
                  </button>
                  <div className="scrollList">
                    {dialogues.map((item, index) => (
                      <div className={item.challenge?.hit ? "miniCard hot" : "miniCard"} key={`${item.characterId}-${index}`}>
                        <strong>{characterName(deductionCase, item.characterId)}</strong>
                        <p>证据：{item.evidenceId || "未出示"}</p>
                        <p>问：{item.question}</p>
                        <p>答：{item.answer}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="panel widePanel">
                  <div className="cardHeader">
                    <div>
                      <p className="cardKicker">Final Theory</p>
                      <h3>提交推理</h3>
                    </div>
                  </div>
                  <div className="twoCols">
                    <label className="field">
                      <span>凶手</span>
                      <select value={theory.culpritId} onChange={(event) => setTheory((current) => ({ ...current, culpritId: event.target.value }))}>
                        <option value="">选择嫌疑人</option>
                        {deductionCase.characters.map((character) => (
                          <option key={character.id} value={character.id}>
                            {character.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>证据 ID，逗号分隔</span>
                      <input
                        value={theory.evidenceIds.join(",")}
                        onChange={(event) => setTheory((current) => ({ ...current, evidenceIds: safeIdList(event.target.value) }))}
                        placeholder="e-power-log,e-base-mark,e-dust"
                      />
                    </label>
                  </div>
                  <label className="field">
                    <span>动机</span>
                    <textarea className="smallArea" value={theory.motive} onChange={(event) => setTheory((current) => ({ ...current, motive: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>手法</span>
                    <textarea className="smallArea" value={theory.method} onChange={(event) => setTheory((current) => ({ ...current, method: event.target.value }))} />
                  </label>
                  <button className="primaryButton" disabled={isGenerating} onClick={submitTheory} type="button">
                    <Target size={18} />
                    判定推理
                  </button>
                  {judgementText && <pre className="judgement">{judgementText}</pre>}
                  {solutionText && <pre className="solution">{solutionText}</pre>}
                </section>
              </>
            )}
          </div>
        </section>
      ) : (
        <NovelWorkspace isGenerating={isGenerating} novelBrief={novelBrief} novelSynopsis={novelSynopsis} setNovelBrief={setNovelBrief} generateNovelSynopsis={generateNovelSynopsis} status={status} />
      )}
    </main>
  );
}

function Workbench({
  deductionCase,
  validation,
  discoveredEvidenceIds,
  view,
  setView
}: {
  deductionCase: DeductionCase;
  validation: ReturnType<typeof validateCase> | null;
  discoveredEvidenceIds: string[];
  view: WorkbenchView;
  setView: (view: WorkbenchView) => void;
}) {
  const tabs: Array<[WorkbenchView, string]> = [
    ["truth", "Truth"],
    ["matrix", "Matrix"],
    ["evidence", "Evidence Graph"],
    ["timeline", "Timeline"],
    ["report", "Rule Report"],
    ["json", "JSON"]
  ];
  return (
    <section className="panel widePanel workbench">
      <div className="cardHeader">
        <div>
          <p className="cardKicker">Visual Workbench</p>
          <h3>案件逻辑工作台</h3>
        </div>
        <div className="tabs">
          {tabs.map(([id, label]) => (
            <button className={view === id ? "selected" : ""} key={id} onClick={() => setView(id)} type="button">
              {label}
            </button>
          ))}
        </div>
      </div>
      {view === "truth" && <TruthPanel deductionCase={deductionCase} />}
      {view === "matrix" && <MatrixPanel validation={validation} />}
      {view === "evidence" && <EvidenceGraph deductionCase={deductionCase} discoveredEvidenceIds={discoveredEvidenceIds} />}
      {view === "timeline" && <TimelinePanel deductionCase={deductionCase} discoveredEvidenceIds={discoveredEvidenceIds} />}
      {view === "report" && <ReportPanel validation={validation} />}
      {view === "json" && <pre className="jsonBlock">{renderJson(deductionCase)}</pre>}
    </section>
  );
}

function TruthPanel({ deductionCase }: { deductionCase: DeductionCase }) {
  const culprit = deductionCase.characters.find((item) => item.id === deductionCase.truth.culpritId);
  return (
    <div className="truthGrid">
      <div className="factBox">
        <span>Culprit</span>
        <strong>{culprit?.name || deductionCase.truth.culpritId}</strong>
      </div>
      <div className="factBox">
        <span>Motive</span>
        <p>{deductionCase.truth.motive}</p>
      </div>
      <div className="factBox">
        <span>Method</span>
        <p>{deductionCase.truth.method}</p>
      </div>
      <div className="factBox">
        <span>Opportunity</span>
        <p>{deductionCase.truth.opportunity}</p>
      </div>
    </div>
  );
}

function MatrixPanel({ validation }: { validation: ReturnType<typeof validateCase> | null }) {
  if (!validation) return null;
  return (
    <div className="matrixTable">
      <div className="matrixHead">
        <span>Suspect</span>
        <span>Motive</span>
        <span>Means</span>
        <span>Opportunity</span>
        <span>Excluded By</span>
      </div>
      {validation.suspectMatrix.map((row) => (
        <div className={row.completeAndUnexcluded ? "matrixRow active" : "matrixRow"} key={row.characterId}>
          <strong>{row.name}</strong>
          <span>{row.motive ? "yes" : "no"}</span>
          <span>{row.means ? "yes" : "no"}</span>
          <span>{row.opportunity ? "yes" : "no"}</span>
          <code>{row.excludedByEvidenceIds.join(", ") || "-"}</code>
        </div>
      ))}
    </div>
  );
}

function EvidenceGraph({ deductionCase, discoveredEvidenceIds }: { deductionCase: DeductionCase; discoveredEvidenceIds: string[] }) {
  const steps = deductionCase.logicPuzzle.criticalReasoningChain.slice(0, 5);
  return (
    <svg className="caseGraph" viewBox="0 0 980 360" role="img" aria-label="证据链图">
      {steps.map((step, index) => {
        const y = 54 + index * 58;
        const evidenceId = step.evidenceIds[0];
        const found = discoveredEvidenceIds.includes(evidenceId);
        return (
          <g key={step.id}>
            <rect x="24" y={y - 22} width="170" height="44" rx="8" fill={found ? "#2f6b4f" : "#827766"} />
            <text x="109" y={y + 5} textAnchor="middle" fill="#fffaf0" fontSize="12">
              {evidenceId}
            </text>
            <line x1="194" y1={y} x2="286" y2={y} stroke="#cab98f" strokeWidth="2" />
            <rect x="286" y={y - 24} width="420" height="48" rx="8" fill="#fffaf0" stroke="#cab98f" />
            <text x="496" y={y + 5} textAnchor="middle" fill="#191711" fontSize="13">
              {step.conclusion.slice(0, 32)}
            </text>
            <line x1="706" y1={y} x2="788" y2="180" stroke="#cab98f" strokeWidth="2" />
          </g>
        );
      })}
      <circle cx="840" cy="180" r="58" fill="#8d1d2c" />
      <text x="840" y="185" textAnchor="middle" fill="#fffaf0" fontSize="14">
        Conclusion
      </text>
    </svg>
  );
}

function TimelinePanel({ deductionCase, discoveredEvidenceIds }: { deductionCase: DeductionCase; discoveredEvidenceIds: string[] }) {
  const items = getTimelineContradictions(deductionCase, discoveredEvidenceIds);
  return (
    <div className="timeline">
      {items.map((item) => (
        <div className={item.revealed ? "timelineItem revealed" : "timelineItem"} key={item.eventId}>
          <span>{item.time}</span>
          <strong>{item.publicVersion}</strong>
          <p>{item.revealed ? item.trueEvent : "需要找到对应证据后才会揭示矛盾。"}</p>
          <code>{item.evidenceIds.join(", ")}</code>
        </div>
      ))}
    </div>
  );
}

function ReportPanel({ validation }: { validation: ReturnType<typeof validateCase> | null }) {
  if (!validation) return null;
  return (
    <div className="reportGrid">
      <div className={validation.valid ? "reportCard pass" : "reportCard fail"}>
        <span>Valid</span>
        <strong>{validation.valid ? "true" : "false"}</strong>
      </div>
      <div className="reportCard">
        <span>Errors</span>
        <strong>{validation.errors.length}</strong>
      </div>
      <div className="reportCard">
        <span>Warnings</span>
        <strong>{validation.warnings.length}</strong>
      </div>
      <div className="reportCard">
        <span>Coverage</span>
        <strong>{Math.round(validation.reasoningCoverage.coverageRatio * 100)}%</strong>
      </div>
      <pre className="jsonBlock">{renderJson({ errors: validation.errors, warnings: validation.warnings, fixSuggestions: validation.fixSuggestions })}</pre>
    </div>
  );
}

function NovelWorkspace({
  isGenerating,
  novelBrief,
  novelSynopsis,
  setNovelBrief,
  generateNovelSynopsis,
  status
}: {
  isGenerating: boolean;
  novelBrief: string;
  novelSynopsis: string;
  setNovelBrief: (value: string) => void;
  generateNovelSynopsis: () => void;
  status: string;
}) {
  return (
    <section className="workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">保留原小说生成入口</p>
          <h2>小说生成</h2>
        </div>
      </header>
      <div className="contentGrid">
        <section className="inputDeck">
          <div className="cardHeader">
            <div>
              <p className="cardKicker">大纲</p>
              <h3>输入素材</h3>
            </div>
          </div>
          <textarea value={novelBrief} onChange={(event) => setNovelBrief(event.target.value)} spellCheck={false} />
          <button className="primaryButton" disabled={isGenerating} onClick={generateNovelSynopsis} type="button">
            {isGenerating ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
            生成故事大概
          </button>
        </section>
        <section className="outputDeck">
          <div className="cardHeader">
            <div>
              <p className="cardKicker">输出</p>
              <h3>故事大概</h3>
            </div>
          </div>
          <textarea className="draftEditor" value={novelSynopsis} readOnly placeholder={status} />
        </section>
      </div>
    </section>
  );
}
