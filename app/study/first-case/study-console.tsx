"use client";

import { useEffect, useRef, useState } from "react";
import {
  createFirstCaseStudyCollection, startFirstCaseStudyRun, updateFirstCaseStudyRun,
  markFirstEffectiveAction, setFirstCaseStudyStage, recordFirstCaseStudyHelp,
  recordFirstCaseStudyConfusion, rateFirstCaseStudyExplanation, finishFirstCaseStudyRun,
  touchFirstCaseStudyRun, validateFirstCaseStudyCollection, analyzeFirstCaseStudy,
  renderFirstCaseStudyReport,
  prepareFirstCaseStudyRestore, restoreFirstCaseStudyCollection,
  withdrawFirstCaseStudyParticipant, resetFirstCaseStudyCollection,
  FIRST_CASE_STUDY_MAX_PLAY_SECONDS,
  type FirstCaseStudyCollection, type FirstCaseStudyRun,
} from "@/lib/first-case-study";
import styles from "./study.module.css";

const storageKey = "detective-town-first-case-study-v1";
const stages = { join: "加入调查", observe: "观察现场", search: "搜索证据", question: "询问证人", challenge: "质证证词", organize: "组织推理", submit: "提交结论", review: "复核解答" } as const;
const helps = { neutral: "中性追问", directional: "指出区域", direct: "明确操作提示", takeover: "主持人代操作" } as const;
const confusions = { objective: "不清楚目标", control: "找不到操作", evidence: "不理解证据", claim: "不理解证明分组", rejection: "不理解拒绝反馈", other: "其他困惑" } as const;
const ratings = { "not-assessed": "尚未评分", correct: "正确", partial: "部分正确", incorrect: "不正确" } as const;
const statusLabels = { active: "计时中", completed: "已完成", abandoned: "已放弃", interrupted: "技术中断" } as const;
const secondsLabel = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

function download(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function FirstCaseStudyConsole({ buildId }: { buildId: string }) {
  const [collection, setCollection] = useState<FirstCaseStudyCollection>(createFirstCaseStudyCollection);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"rehearsal" | "human">("rehearsal");
  const [participantId, setParticipantId] = useState<FirstCaseStudyRun["participantId"]>("R01");
  const [prepared, setPrepared] = useState(false);
  const [humanAttested, setHumanAttested] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState("");
  const [restorePreview, setRestorePreview] = useState<{ collection: FirstCaseStudyCollection; filename: string; interruptedTimers: number } | null>(null);
  const [maintenanceBackedUp, setMaintenanceBackedUp] = useState(false);
  const [newRoundConfirmation, setNewRoundConfirmation] = useState("");
  const [withdrawAttemptId, setWithdrawAttemptId] = useState("");
  const [withdrawConfirmation, setWithdrawConfirmation] = useState("");
  const [maintenanceNotice, setMaintenanceNotice] = useState("");
  const clockOrigin = useRef(0);
  const loaded = useRef(false);
  const active = collection.runs.find((run) => run.status === "active");
  const run = active || collection.runs.find((item) => item.attemptId === selectedAttempt) || collection.runs.at(-1);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    try {
      const raw = localStorage.getItem(storageKey);
      const saved = raw ? validateFirstCaseStudyCollection(JSON.parse(raw)) : createFirstCaseStudyCollection();
      analyzeFirstCaseStudy(saved);
      setCollection({ ...saved, runs: saved.runs.map((item) => item.status === "active" ? finishFirstCaseStudyRun(item, "interrupted", item.elapsedSeconds) : item) });
      setReady(true);
    } catch {
      setError("现有记录无法读取。为避免覆盖，已停止记录；请先导出原始备份，按主持协议处理后再继续。");
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(storageKey, JSON.stringify(collection)); }
    catch { setError("本机保存失败。请立即导出记录，结束本次测试并按技术中断处理。"); }
  }, [collection, ready]);

  useEffect(() => {
    setMaintenanceBackedUp(false);
    setNewRoundConfirmation("");
    setWithdrawConfirmation("");
  }, [collection]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const elapsed = Math.floor((performance.now() - clockOrigin.current) / 1000);
      setCollection((current) => updateFirstCaseStudyRun(current, active.attemptId, (item) => item.status !== "active" ? item : elapsed >= FIRST_CASE_STUDY_MAX_PLAY_SECONDS ? finishFirstCaseStudyRun(item, "abandoned", FIRST_CASE_STUDY_MAX_PLAY_SECONDS) : touchFirstCaseStudyRun(item, elapsed)));
    }, 1000);
    return () => clearInterval(id);
  }, [active?.attemptId]); // A stable clock is retained across state saves.

  function change(update: (current: FirstCaseStudyRun, seconds: number) => FirstCaseStudyRun) {
    if (!run) return;
    const elapsed = run.status === "active" ? Math.floor((performance.now() - clockOrigin.current) / 1000) : run.elapsedSeconds;
    try { setCollection(updateFirstCaseStudyRun(collection, run.attemptId, (item) => item.status === "active" && elapsed >= FIRST_CASE_STUDY_MAX_PLAY_SECONDS ? finishFirstCaseStudyRun(item, "abandoned", FIRST_CASE_STUDY_MAX_PLAY_SECONDS) : update(item, elapsed))); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "记录失败，请检查本次状态。"); }
  }

  function start() {
    try {
      const result = startFirstCaseStudyRun(collection, { mode, participantId, buildId, humanAttested });
      clockOrigin.current = performance.now();
      setCollection(result.collection); setSelectedAttempt(result.run.attemptId);
      setAccepted(false); setReviewed(false); setPrepared(false); setHumanAttested(false); setError("");
      setRestorePreview(null); setMaintenanceNotice("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "无法开始记录。"); }
  }

  const analysis = analyzeFirstCaseStudy(collection);
  const report = renderFirstCaseStudyReport(analysis);
  const snapshot = () => {
    if (!active) return collection;
    const elapsed = Math.floor((performance.now() - clockOrigin.current) / 1000);
    const next = updateFirstCaseStudyRun(collection, active.attemptId, (item) => elapsed >= FIRST_CASE_STUDY_MAX_PLAY_SECONDS ? finishFirstCaseStudyRun(item, "abandoned", FIRST_CASE_STUDY_MAX_PLAY_SECONDS) : touchFirstCaseStudyRun(item, elapsed));
    setCollection(next);
    return next;
  };

  async function inspectBackup(file: File) {
    if (active) return;
    setRestorePreview(null); setMaintenanceNotice("");
    try {
      const original = validateFirstCaseStudyCollection(JSON.parse(await file.text()));
      const restored = prepareFirstCaseStudyRestore(original, buildId);
      setRestorePreview({ collection: restored, filename: file.name, interruptedTimers: original.runs.filter((item) => item.status === "active").length });
      setError("");
    } catch (cause) { setError(`备份未通过校验，本机记录未变更。${cause instanceof Error ? cause.message : "请选择主持台导出的 JSON。"}`); }
  }

  function maintain(update: () => FirstCaseStudyCollection, notice: string) {
    if (active) return;
    try {
      const next = update();
      // Persist first: a failed browser write must not appear to have restored or erased records.
      localStorage.setItem(storageKey, JSON.stringify(next));
      setCollection(next); setReady(true); setSelectedAttempt(""); setWithdrawAttemptId("");
      setAccepted(false); setReviewed(false); setPrepared(false); setHumanAttested(false);
      setRestorePreview(null); setError(""); setMaintenanceNotice(notice);
    } catch (cause) { setError(`维护未完成，本机记录未变更。${cause instanceof Error ? cause.message : "请检查浏览器存储。"}`); }
  }

  const withdrawalRuns = collection.runs.filter((item) => item.mode === "human");
  const withdrawalRun = withdrawalRuns.find((item) => item.attemptId === withdrawAttemptId);
  const withdrawalPair = withdrawalRun ? `${withdrawalRun.participantId}/${withdrawalRun.attemptId}` : "";

  return <main className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>DETECTIVE TOWN / 主持人专用</p><h1>首案理解度测试</h1><p>固定案例：午夜合唱 · 公开追责路线 · 印刷低语</p></div><a className={styles.link} href="/?runtime=server&lang=zh-CN" target="_blank" rel="noreferrer">打开参与者游戏页 ↗</a></header>
    <p className={styles.notice}>这是观察者手动打点工具，不读取游戏状态或答案。参与者只看游戏页。计时包含思考与系统等待；记录秒数存在主持人反应误差。预试记录永不计入真人样本。</p>
    <p className={styles.version}>冻结版本 <code>{buildId}</code> · 最多 30 分钟游戏，再访谈 5–10 分钟</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.columns}>
      <section className={styles.card} aria-label="测试准备">
        <h2>开始前</h2>
        <ol><li>每位参与者前停止并重启测试服务，得到干净数据库。</li><li>在游戏页选择「午夜合唱」和默认「公开追责」路线，开始所选战役。</li><li>确认「印刷低语」、等待加入调查、证据 0/7。不要替玩家加入或搜索。</li><li>读参与者任务，交还操作权，然后在这里开始计时。</li></ol>
        <label>记录类型<select disabled={!!active} value={mode} onChange={(event) => { const value = event.target.value as "human" | "rehearsal"; setMode(value); setParticipantId(value === "human" ? "P01" : "R01"); setHumanAttested(false); }}><option value="rehearsal">工具预试（不计入真人）</option><option value="human">真人观察</option></select></label>
        <label>{mode === "human" ? "样本槽位" : "预试编号"}<select disabled={!!active} value={participantId} onChange={(event) => setParticipantId(event.target.value as FirstCaseStudyRun["participantId"])}>{(mode === "human" ? ["P01", "P02", "P03", "P04", "P05"] : ["R01"]).map((id) => <option key={id}>{id}</option>)}</select></label>
        {mode === "human" && <p className={styles.hint}>P01–P05 是样本槽位，替补可以使用同一槽位。请用槽位与尝试号的组合（如 P01/A000001）区分每条记录。</p>}
        <label className={styles.check}><input type="checkbox" checked={prepared} disabled={!!active} onChange={(event) => setPrepared(event.target.checked)} />已确认固定首案和干净起点，参与者已可操作</label>
        {mode === "human" && <label className={styles.check}><input type="checkbox" disabled={!!active} checked={humanAttested} onChange={(event) => setHumanAttested(event.target.checked)} />我正在观察真人；对方未看过答案、首次体验，已同意匿名记录并知道可随时停止</label>}
        <button className={styles.primary} disabled={!ready || !!active || !prepared || (mode === "human" && !humanAttested)} onClick={start}>开始 {participantId} 计时</button>
      </section>
      <section className={styles.card} aria-label="观察记录">
        <div className={styles.clock}><strong data-testid="study-elapsed">{secondsLabel(run?.elapsedSeconds || 0)}</strong><span>{run ? `${run.participantId} · ${statusLabels[run.status]}` : "尚未开始"}</span></div>
        {run && <>
          <p>记录：{run.attemptId} · {run.mode === "human" ? "真人观察" : "工具预试"} · {stages[run.currentStage]}</p>
          <button disabled={!active || run.firstEffectiveActionSeconds !== null} onClick={() => change(markFirstEffectiveAction)}>标记首个有效动作成功</button>
          <p className={styles.hint}>只在看到加入、观察、搜索、询问等行动的成功反馈后标记。打开面板、误点和规则拒绝不算。首次有效动作：{run.firstEffectiveActionSeconds === null ? "尚未观察到" : `${run.firstEffectiveActionSeconds} 秒`}。</p>
          <label>玩家当前停留阶段<select disabled={!active} value={run.currentStage} onChange={(event) => change((item, seconds) => setFirstCaseStudyStage(item, event.target.value as keyof typeof stages, seconds))}>{Object.entries(stages).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <h3>主持帮助</h3><div className={styles.buttons}>{Object.entries(helps).map(([id, label]) => <button key={id} disabled={!active} onClick={() => change((item, seconds) => recordFirstCaseStudyHelp(item, id as keyof typeof helps, seconds))}>{label} +1 <small>({run.helpCounts[id as keyof typeof helps]})</small></button>)}</div>
          <h3>本次出现的困惑</h3><div className={styles.buttons}>{Object.entries(confusions).map(([id, label]) => <button key={id} disabled={!active || run.confusions.includes(id as keyof typeof confusions)} onClick={() => change((item, seconds) => recordFirstCaseStudyConfusion(item, id as keyof typeof confusions, seconds))}>{run.confusions.includes(id as keyof typeof confusions) ? "✓ " : ""}{label}</button>)}</div>
          {run.elapsedSeconds >= FIRST_CASE_STUDY_MAX_PLAY_SECONDS && <p role="alert" className={styles.error}>已到 30 分钟上限，记录为未完成并保留在样本分母中。请停止游戏，进行访谈。</p>}
          <div className={styles.finish}>
            <label className={styles.check}><input type="checkbox" disabled={!active} checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />已观察到理论判定通过</label>
            <label className={styles.check}><input type="checkbox" disabled={!active} checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />已观察到最终解答复核完成</label>
            <p className={styles.hint}>完成要求判定通过且复核完成（7/7）。游戏自身故障导致无法继续，请记放弃；只有外部干扰或测试设施故障才记中断。</p>
            <div className={styles.buttons}><button className={styles.primary} disabled={!active || !accepted || !reviewed || run.elapsedSeconds >= FIRST_CASE_STUDY_MAX_PLAY_SECONDS} onClick={() => change((item, seconds) => finishFirstCaseStudyRun(item, "completed", seconds, { acceptedAndReviewed: true }))}>记录完成，停止计时</button><button disabled={!active} onClick={() => change((item, seconds) => finishFirstCaseStudyRun(item, "abandoned", seconds))}>参与者放弃 / 游戏故障</button><button disabled={!active} onClick={() => change((item, seconds) => finishFirstCaseStudyRun(item, "interrupted", seconds))}>外部设施中断</button></div>
          </div>
        </>}
      </section>
    </div>
    <section className={styles.card} aria-label="访谈与导出"><h2>结束后访谈与记录</h2><p>先让参与者解释两组证据的作用，再由主持人按评分说明评定。不要在这里填写姓名、原话或标准答案。</p>
      {run && <><label>查看记录<select disabled={!!active} value={run.attemptId} onChange={(event) => setSelectedAttempt(event.target.value)}>{collection.runs.map((item) => <option key={item.attemptId} value={item.attemptId}>{item.attemptId} · {item.participantId} · {statusLabels[item.status]}</option>)}</select></label><div className={styles.ratingRow}>{(["motiveRating", "methodRating"] as const).map((field) => <label key={field}>{field === "motiveRating" ? "动机证据解释" : "手法证据解释"}<select disabled={!!active} value={run[field]} onChange={(event) => change((item) => rateFirstCaseStudyExplanation(item, { [field]: event.target.value as keyof typeof ratings }))}>{Object.entries(ratings).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>)}</div></>}
      <div className={styles.buttons}><button disabled={!ready} onClick={() => download("detective-first-case-study-v1.json", JSON.stringify(snapshot(), null, 2), "application/json;charset=utf-8")}>导出匿名 JSON</button><button disabled={!ready} onClick={() => download("first-case-study-results.md", renderFirstCaseStudyReport(analyzeFirstCaseStudy(snapshot())), "text/markdown;charset=utf-8")}>导出当前分析</button><button onClick={() => download("first-case-study-raw-backup.json", localStorage.getItem(storageKey) || "{}", "application/json;charset=utf-8")}>备份本机原始记录</button></div>
      <p className={styles.hint}>每次结束并评分后立即导出。刷新中的活动记录会成为技术中断；按协议在同一槽位重新安排时，会产生新的尝试号，请用 P/A 组合区分原记录和替补。不要用预试替代真人，也不要删除弃玩记录。完整 JSON 只交主持人保管。</p>
      <pre data-testid="study-analysis" className={styles.report}>{report}</pre>
      <details><summary>查看当前安全记录 JSON</summary><pre data-testid="study-safe-json" className={styles.report}>{JSON.stringify(collection, null, 2)}</pre></details>
    </section>
    <section className={styles.card} aria-label="记录维护">
      <details><summary>主持人记录维护：恢复备份、参与者撤回、开始新轮</summary>
        <p className={styles.hint}>仅在没有活动计时时操作。恢复备份会替换本机整轮记录，不合并文件；开始新轮会清空本机记录。请先使用上方导出或原始备份按钮保存本轮档案。正常弃玩仍应保留，不能通过撤回或新轮提高完成率。</p>
        {active && <p role="status">当前正在计时，请先结束或中断本次观察。</p>}
        {maintenanceNotice && <p role="status">{maintenanceNotice}</p>}
        <label className={styles.check}><input type="checkbox" disabled={!!active} checked={maintenanceBackedUp} onChange={(event) => setMaintenanceBackedUp(event.target.checked)} />恢复或开始新轮前，我已导出并妥善保存当前记录；当前为空时已确认无需备份</label>
        <h3>恢复主持台备份</h3>
        <p className={styles.hint}>先校验与预览，确认后才替换。真人记录必须与上方冻结版本一致；其他版本留在原轮档案。备份中的活动计时会按中断恢复，不继续计时。本机记录损坏时，也可在备份原始文件后从这里恢复有效文件。</p>
        <label>选择主持台 JSON 备份<input type="file" accept=".json,application/json" disabled={!!active} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void inspectBackup(file); }} /></label>
        {restorePreview && <>
          <p role="status">待恢复：{restorePreview.filename}；共 {restorePreview.collection.runs.length} 条尝试，其中真人 {restorePreview.collection.runs.filter((item) => item.mode === "human").length} 条、预试 {restorePreview.collection.runs.filter((item) => item.mode === "rehearsal").length} 条；{restorePreview.interruptedTimers} 条活动计时将记为中断。确认会替换本机现有 {collection.runs.length} 条尝试。</p>
          <div className={styles.buttons}><button disabled={!!active || !maintenanceBackedUp} onClick={() => maintain(() => restoreFirstCaseStudyCollection(collection, restorePreview.collection, buildId), "备份已恢复。请核对上方分析与记录列表；准备好干净起点后再开始观察。")}>确认替换为这份备份</button><button disabled={!!active} onClick={() => setRestorePreview(null)}>取消恢复</button></div>
        </>}
        <h3>处理参与者撤回</h3>
        <p className={styles.hint}>仅用于参与者明确撤回同意。先核对槽位与尝试号，本次只移除所选的一条真人记录。同一 P 槽位可能先后属于不同参与者，不能据此批量删除。若对方有多条尝试，请逐条核对并处理；其他尝试和预试保留。</p>
        <p className={styles.hint}>已导出的 JSON、分析、访谈笔记和其他副本仍须由主持人按参与者同意范围处理，旧备份不能重新带回已撤回记录。</p>
        <label>选择要撤回的真人尝试<select disabled={!ready || !!active || withdrawalRuns.length === 0} value={withdrawalRun?.attemptId || ""} onChange={(event) => { setWithdrawAttemptId(event.target.value); setWithdrawConfirmation(""); }}><option value="">请选择一条真人尝试</option>{withdrawalRuns.map((item) => <option key={item.attemptId} value={item.attemptId}>{item.participantId}/{item.attemptId} · {statusLabels[item.status]}{item.humanAttested ? "" : " · 未确认真人"}</option>)}</select></label>
        {withdrawalRuns.length === 0 && <p className={styles.hint}>当前没有可撤回的真人尝试；工具预试不在此列表中。</p>}
        <label>{withdrawalRun ? `输入 ${withdrawalPair}，确认这条记录属于要求撤回的参与者` : "选定尝试后，输入完整 P/A 标识确认"}<input disabled={!ready || !!active || !withdrawalRun} value={withdrawConfirmation} onChange={(event) => setWithdrawConfirmation(event.target.value)} autoComplete="off" /></label>
        <button disabled={!ready || !!active || !withdrawalRun || withdrawConfirmation !== withdrawalPair} onClick={() => { if (withdrawalRun) maintain(() => withdrawFirstCaseStudyParticipant(collection, withdrawalRun.participantId, withdrawalRun.attemptId, withdrawConfirmation), `${withdrawalPair} 这一条真人记录已从本机移除，其他尝试保留。请处理对应的已导出副本及笔记；如对方有其他尝试，请逐条核对。`); }}>{withdrawalRun ? `确认撤回 ${withdrawalPair}（仅此一条）` : "确认撤回所选尝试"}</button>
        <h3>开始新的测试轮次</h3>
        <p className={styles.hint}>先归档完整旧轮，再建立空白轮次；不要把旧轮失败者与新版本的成功者拼成五人结果。此操作仅清空主持台记录，仍需重启测试服务并创建干净首案。</p>
        <label>输入「开始新轮」确认清空本机记录<input disabled={!ready || !!active} value={newRoundConfirmation} onChange={(event) => setNewRoundConfirmation(event.target.value)} autoComplete="off" /></label>
        <button disabled={!ready || !!active || !maintenanceBackedUp || newRoundConfirmation !== "开始新轮"} onClick={() => maintain(() => resetFirstCaseStudyCollection(collection, maintenanceBackedUp, newRoundConfirmation), "本机已建立空白新轮；旧轮请保存在独立档案中。本次尚无真人记录。")}>确认清空并开始新轮</button>
      </details>
    </section>
  </main>;
}
