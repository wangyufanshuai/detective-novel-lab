"use client";

import { useMemo, useState, type ComponentProps } from "react";
import { Activity, ArrowRight, Brain, ChevronDown, FastForward, MapPinned, Pause, Play, RotateCcw, Search, ShieldAlert, Users } from "lucide-react";
import { PersistentTownCommandCenter } from "@/app/components/TownReviewSurface";

type WorldConsoleProps = ComponentProps<typeof PersistentTownCommandCenter>;

const phaseLabels: Record<string, string> = {
  observe: "感知", propagate: "传播", "memory-propagation": "记忆传播", plan: "计划", "update-goals": "目标更新",
  "goal-update": "目标更新", "generate-candidates": "生成候选", score: "行动评分", "score-actions": "行动评分",
  execute: "执行", "execute-actions": "执行行动", "advance-long-actions": "长期行动", consequence: "后果", "apply-consequences": "应用后果",
  "advance-case-chain": "推进案件链", "trigger-case": "触发案件", "candidate-extraction": "案件成形", "extract-candidates": "案件成形", finalize: "快照"
};

const caseTypeLabels: Record<string, string> = {
  "archive-vanishing": "档案失踪", blackmail: "勒索", "court-intimidation": "法庭施压", "dock-smuggling": "码头走私",
  "evidence-tampering": "证据篡改", "false-testimony": "伪证", "family-scandal": "家族丑闻", "forged-will": "伪造遗嘱",
  "ledger-fraud": "账目欺诈", "medical-coverup": "医疗掩盖", "witness-disappearance": "证人失踪", "clinic-inventory-gap": "诊所库存缺口",
  "dock-witness-swap": "码头证人调换", "editorial-coercion": "编辑部胁迫", "household-escrow": "家庭托管", "permit-forgery": "许可证伪造",
  murder: "谋杀", "missing-person": "失踪人口", "merchant-extortion": "商户敲诈", "police-misjudgment": "警方误判",
  "media-rumor": "媒体谣言", "signal-tampering": "信号篡改", "safety-inspection-fraud": "安全检查欺诈", "industrial-sabotage": "工业破坏",
  "water-rights-fraud": "水权欺诈", "floodgate-tampering": "闸门破坏", "academic-record-forgery": "学籍记录伪造", "patronage-coercion": "庇护关系胁迫",
  "identity-register-fraud": "身份登记欺诈", "utility-sabotage": "公用设施破坏", "burial-record-forgery": "墓葬记录伪造", "signal-interception": "信号截取"
};

const actionLabels: Record<string, string> = {
  investigate: "调查", "spread-rumor": "传播传闻", "seek-alibi": "寻找不在场证明", pressure: "施压", "cover-up": "掩盖", talk: "交谈", trade: "交易", move: "移动", rest: "休整", observe: "观察"
};

function score(value: number | undefined) {
  return typeof value === "number" ? Math.round(value) : 0;
}

const observationLabels: Record<string, string> = {
  direct: "直接观察", deduced: "推断关联", "same-location": "同地观察", rumor: "传闻线索", memory: "记忆回响"
};
const urgencyLabels: Record<string, string> = { critical: "紧急", elevated: "升高", stable: "稳定" };

function localizeWorldCopy(value: string | undefined) {
  if (!value) return "";
  return value
    .replace("Triggered case:", "案件涌现：")
    .replace("The Open Ledger", "公开账簿")
    .replace("Extract a playable case from the strongest valid candidate.", "从压力最高且已闭合的候选中提取案件。")
    .replace("reviews nearby events and updates memory.", "复核附近事件，并更新自己的记忆。")
    .replace("checks nearby traces and compares them with remembered events.", "复核附近线索，并与记忆中的事件比对。")
    .replace("moves toward town-square to follow the current plan.", "前往镇中心，执行当前计划。")
    .replace(/passes a partial account to\s+(.+)\./, "向 $1 透露一段不完整的说法。")
    .replace("talks with", "与")
    .replace("about recent pressure.", "交谈，了解近期压力。")
    .replace("Stage: alibi", "阶段：不在场证明")
    .replace("Act: seek-alibi", "行动：寻找不在场证明")
    .replace("Watch: town-square", "观察：镇中心")
    .replace("Stage: investigate", "阶段：调查")
    .replace("Act: investigate", "行动：调查")
    .replace("Watch: ", "观察：")
    .replace("Campaign path available", "可以进入案件恢复路线")
    .replace(/missing real case trigger:\s*/i, "")
    .replace("no death or crime event has been written yet", "尚未形成足够的现实事件记录");
}

/**
 * World-first presentation shell. It consumes the established Persistent Town
 * projection and callbacks; it owns no simulation or case authority.
 */
export function WorldConsoleSurface(props: WorldConsoleProps) {
  const {
    runtimeMode, worldName, caseTitle, runtime, queue, brief, snapshot, selectedAgent, selectedAgentCandidates,
    selectedCharacterId, selectedCharacterName, runningBusy, startRuntime, pauseRuntime, stepRuntime, stepRuntimeFast,
    resetRuntime, interveneAgent, extractCase, backToPlay, onActorSelect, onLocationSelect, snapshots, snapshotDiff,
    caseLifecycle,
    selectedSnapshotFromId, selectedSnapshotToId, setSelectedSnapshotFromId, setSelectedSnapshotToId, rollbackSnapshot,
    runScenario, scenarioReport, scenarioPresets, scenarioRuns, runCatalog, exportReplayBundle, reviewBusy
  } = props;
  const [reviewOpen, setReviewOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mapFilter, setMapFilter] = useState<"all" | "npc" | "events">("all");
  const [selectedEventId, setSelectedEventId] = useState("");
  const candidates = queue?.candidates || runtime?.candidates || [];
  const validCandidates = candidates.filter((candidate) => candidate.validation.valid);
  const actors = snapshot?.actors || [];
  const maxX = Math.max(1, (snapshot?.width || 28) - 1);
  const maxY = Math.max(1, (snapshot?.height || 18) - 1);
  const selectedActor = actors.find((actor) => actor.id === selectedCharacterId);
  const currentPhase = runtime?.simulationPhases?.length ? runtime.simulationPhases[(runtime.tick || 0) % runtime.simulationPhases.length] : "observe";
  const recentTraces = useMemo(() => [...(runtime?.decisionTraces || [])].slice(-8).reverse(), [runtime?.decisionTraces]);
  const recentEvents = useMemo(() => [...(runtime?.eventObservations || [])].slice(-6).reverse(), [runtime?.eventObservations]);
  const visibleActors = mapFilter === "events" ? [] : actors;
  const visibleMarkers = mapFilter === "npc" ? [] : (snapshot?.markers || []).slice(0, 20);
  const selectedSnapshotFrom = snapshots.find((item) => item.id === selectedSnapshotFromId);
  const selectedSnapshotTo = snapshots.find((item) => item.id === selectedSnapshotToId);
  const actorNames = useMemo(() => new Map(actors.map((actor) => [actor.id, actor.name])), [actors]);
  const publicActorName = (id: string | undefined) => (id && actorNames.get(id)) || "一位居民";
  const publicEventKind = (kind: string | undefined) => observationLabels[kind || ""] || "公开观察";
  const publicDescription = (description: string | undefined) => localizeWorldCopy(description).replace(/\bagent-[a-z0-9-]+\b/gi, "附近事件");
  const worldHeadline = localizeWorldCopy(brief?.headline) || "让小镇先自己运行起来";
  const worldNextAction = localizeWorldCopy(brief?.nextAction) || "推进世界，观察人物、机构和事件如何互相影响。";
  const publicCaseTitle = localizeWorldCopy(caseTitle);
  const publicUrgency = urgencyLabels[String(brief?.urgency || "stable").toLowerCase()] || "稳定";
  const aftermath = caseLifecycle?.caseAftermathLog || [];
  const latestAftermath = aftermath[0];
  const aftermathLabels: Record<string, string> = { solved: "案件已结算", failed: "案件受阻", extracted: "案件已提取", forming: "案件成形" };
  const recoveryStatus = runtime?.campaignRecoverySummary?.status;
  const leadStatus = runtime?.worldLeadOutcomeSummary?.status;
  const sourceBound = Boolean(runtime?.currentExperiment?.sourceWorldId);
  const branchBound = Boolean(runtime?.currentExperiment?.branchWorldId);
  const replayRunCount = (runCatalog || []).filter((run) => run.sourceWorldId || run.branchWorldId).length;
  const diffCount = snapshotDiff
    ? snapshotDiff.addedEventIds.length + snapshotDiff.addedMemoryIds.length + (snapshotDiff.addedObservationIds?.length || 0) + (snapshotDiff.changedLocations?.length || 0)
    : 0;

  function chooseActor(actor: typeof actors[number]) {
    onActorSelect(actor);
  }

  return (
    <main className="worldConsoleShell" data-testid="world-console" data-runtime-status={runtime?.status || "idle"} data-runtime-mode={runtimeMode}>
      <header className="worldConsoleHud" data-testid="world-console-hud">
        <button type="button" className="worldConsoleBrand" onClick={backToPlay} aria-label="进入案件调查">
          <span className="worldConsoleMark" aria-hidden="true">DT</span>
          <span><strong>城市脉搏</strong><small>DETECTIVE TOWN / LIVING WORLD</small></span>
        </button>
        <div className="worldConsoleIdentity"><span>当前世界</span><strong>{worldName}</strong><small>{publicCaseTitle || "等待案件从世界中涌现"}</small></div>
        <div className="worldConsoleStatusStrip" data-testid="world-console-status-strip" aria-label="小镇运行状态">
          <div className="worldConsoleMetric"><span>Tick</span><strong>{runtime?.tick ?? 0}</strong><small>/ {runtime?.maxTicks ?? 200}</small></div>
          <div className="worldConsoleMetric"><span>小镇时间</span><strong>{runtime?.currentTime || snapshot?.time || "--:--"}</strong><small>第 {runtime?.currentDay ?? snapshot?.day ?? 1} 天</small></div>
          <div className="worldConsoleMetric worldConsoleMetricAccent"><span>运行阶段</span><strong>{phaseLabels[currentPhase] || currentPhase}</strong><small>{runtime?.status === "running" ? "运行中" : runtime?.status === "paused" ? "已暂停" : "未启动"}</small></div>
          <div className="worldConsoleMetric"><span>活跃 NPC</span><strong>{runtime?.agentStates.length ?? actors.length}</strong><small>观察对象</small></div>
          <div className="worldConsoleMetric"><span>候选案件</span><strong>{queue?.validCount ?? validCandidates.length}</strong><small>{candidates.length} 条压力链</small></div>
        </div>
        <button type="button" className="worldConsoleCaseButton" onClick={backToPlay} disabled={!caseTitle}>案件调查 <ArrowRight size={15} aria-hidden="true" /></button>
      </header>

      <section className="worldConsoleCommandBar" aria-label="世界运行控制">
        <div className="worldConsoleCommandCopy"><span className="worldConsoleEyebrow">世界运行台 / 当前主循环</span><h1>{worldHeadline}</h1><p>{worldNextAction}</p></div>
        <div className="worldConsoleActions">
          <span className={`worldConsoleStatus status-${runtime?.status || "idle"}`}><Activity size={14} aria-hidden="true" /> {runtime?.status === "running" ? "运行中" : runtime?.status === "paused" ? "已暂停" : "等待启动"}</span>
          <button type="button" className="worldConsoleStartButton" onClick={startRuntime} disabled={runningBusy || runtime?.status === "running"}><Play size={15} aria-hidden="true" /> 开始运行</button>
          <details className="worldConsoleTools" data-testid="world-console-tools" open={toolsOpen} onToggle={(event) => setToolsOpen(event.currentTarget.open)}>
            <summary aria-label="打开世界运行工具"><Activity size={14} aria-hidden="true" /> 工具 <ChevronDown size={14} aria-hidden="true" /></summary>
            <div className="worldConsoleToolMenu">
              <button type="button" onClick={pauseRuntime} disabled={runningBusy || !runtime}><Pause size={15} aria-hidden="true" /> 暂停</button>
              <button type="button" onClick={stepRuntime} disabled={runningBusy || !runtime}><ArrowRight size={15} aria-hidden="true" /> 单步</button>
              <button type="button" onClick={stepRuntimeFast} disabled={runningBusy || !runtime}><FastForward size={15} aria-hidden="true" /> 快速 ×5</button>
              <button type="button" onClick={resetRuntime} disabled={runningBusy || !runtime} aria-label="重置世界运行"><RotateCcw size={15} aria-hidden="true" /> 重置</button>
            </div>
          </details>
        </div>
      </section>

      <section className="worldConsoleGrid">
        <aside className="worldConsoleBrief" data-testid="world-console-situation">
          <div className="worldConsoleSectionTitle"><span>01 / 小镇态势</span><h2>小镇态势</h2></div>
          {brief ? <>
            <div className={`worldConsoleUrgency urgency-${brief.urgency || "stable"}`}>{publicUrgency}</div>
            <div className="worldConsoleReadout"><strong>{brief.caseReadiness.highestMaturityScore}%</strong><span>最高案件成熟度</span></div>
            <div className="worldConsoleReadout"><strong>{brief.observationMix.direct + brief.observationMix.deduced}</strong><span>有依据的观察</span></div>
            <div className="worldConsoleListTitle">高压地点</div>
            {(brief.hotLocations || []).slice(0, 3).map((location) => <button type="button" className="worldConsoleListItem" key={location.locationId} onClick={() => onLocationSelect(location.locationId)}><span>{location.name}</span><small>热度 {score(location.heat)} · 安保 {score(location.security)}</small></button>)}
            <div className="worldConsoleListTitle">高风险人物</div>
            {(brief.riskAgents || []).slice(0, 3).map((agent) => { const actor = actors.find((item) => item.id === agent.npcId); return <button type="button" className="worldConsoleListItem" key={agent.npcId} onClick={() => actor && chooseActor(actor)}><span>{agent.name}</span><small>风险 {score(agent.score)} · 怀疑 {score(agent.suspicion)}</small></button>; })}
          </> : <p className="worldConsoleEmpty">启动运行后，这里会出现公开态势、地点压力和人物风险。</p>}
          <div className="worldConsoleRule"><ShieldAlert size={14} aria-hidden="true" /><span>只显示公开投影；真相、证据权威和案件判定仍由内核掌管。</span></div>
        </aside>

        <section className="worldConsoleMap" data-testid="world-console-map">
          <div className="worldConsoleSectionTitle"><span>02 / 地图现场</span><h2>世界现场</h2><div className="worldConsoleMapFilters"><button type="button" className={mapFilter === "all" ? "active" : ""} onClick={() => setMapFilter("all")}>全部</button><button type="button" className={mapFilter === "npc" ? "active" : ""} onClick={() => setMapFilter("npc")}>人物</button><button type="button" className={mapFilter === "events" ? "active" : ""} onClick={() => setMapFilter("events")}>事件</button></div></div>
          <div className="worldConsoleMapHero" aria-label="城市脉搏主叙事">
            <span>城市脉搏 / LIVING WORLD</span>
            <h1>城市有记忆，<br />而你，正在聆听。</h1>
            <p>{worldNextAction}</p>
          </div>
          <div className="worldConsoleMapCanvas">
            {snapshot ? <><img src="/command-center/town-map.webp" alt="小镇世界地图" />{(snapshot.tiles || []).filter((tile) => tile.locationId && tile.locationName).slice(0, 26).map((tile) => <button type="button" className="worldConsoleLocation" key={tile.id} style={{ left: `${(tile.x / maxX) * 100}%`, top: `${(tile.y / maxY) * 100}%` }} onClick={() => onLocationSelect(tile.locationId!)}>{tile.locationName}</button>)}{visibleMarkers.map((marker) => <button type="button" className={`worldConsoleMarker marker-${marker.type}`} key={marker.id} style={{ left: `${(marker.x / maxX) * 100}%`, top: `${(marker.y / maxY) * 100}%` }} onClick={() => onLocationSelect(marker.locationId)} aria-label={marker.label}>{marker.type === "crime" ? "!" : marker.type === "event" ? "•" : "＋"}</button>)}{visibleActors.map((actor) => <button type="button" className={`worldConsoleActor ${actor.id === selectedCharacterId ? "selected" : ""}`} key={actor.id} style={{ left: `${(actor.x / maxX) * 100}%`, top: `${(actor.y / maxY) * 100}%` }} onClick={() => chooseActor(actor)} aria-label={`${actor.name}，${actor.role}`}><Users size={14} aria-hidden="true" /></button>)}</> : <div className="worldConsoleEmpty"><MapPinned size={30} aria-hidden="true" /><span>世界地图将在运行时载入。</span></div>}
          </div>
          <div className="worldConsoleMapLegend"><span><i className="legendActor" /> 居民</span><span><i className="legendEvent" /> 事件</span><span><i className="legendLocation" /> 地点</span><span className="worldConsoleMapHint">点击地图对象查看因果上下文</span></div>
        </section>

        <aside className="worldConsoleInspector" data-testid="world-console-agent-inspector">
          <div className="worldConsoleSectionTitle"><span>03 / 人物观察</span><h2>人物观察</h2></div>
          {selectedAgent || selectedActor ? <>
            <div className="worldConsolePerson"><div className="worldConsoleAvatar"><Users size={24} aria-hidden="true" /></div><div><strong>{selectedCharacterName || selectedActor?.name || publicActorName(selectedAgent?.npcId)}</strong><small>{selectedActor?.role || "居民"} · {selectedActor?.locationName || "未知地点"}</small></div></div>
            <div className="worldConsoleMeters"><label>关系压力 <b>{score(selectedAgent?.relationshipPressure)}/100</b><meter value={score(selectedAgent?.relationshipPressure)} min={0} max={100} /></label><label>秘密风险 <b>{score(selectedAgent?.secretRisk)}/100</b><meter value={score(selectedAgent?.secretRisk)} min={0} max={100} /></label><label>警觉 <b>{score(selectedAgent?.alertness)}/100</b><meter value={score(selectedAgent?.alertness)} min={0} max={100} /></label></div>
            <div className="worldConsoleSubheading">当前计划</div><ul className="worldConsolePlan">{(selectedAgent?.currentPlan || ["等待下一次观察"]).slice(0, 3).map((item, index) => <li key={`${item}-${index}`}>{localizeWorldCopy(item)}</li>)}</ul>
            <div className="worldConsoleSubheading">可施加的有限干预</div><div className="worldConsoleInterventions">{selectedAgentCandidates.slice(0, 3).map((candidate) => <button type="button" key={candidate.id} onClick={() => interveneAgent("action-bias", candidate.kind)} disabled={runningBusy}><span>{actionLabels[candidate.kind] || candidate.kind}</span><small>{publicDescription(candidate.description)}</small></button>)}</div>
          </> : <div className="worldConsoleEmpty"><Users size={26} aria-hidden="true" /><span>选择地图上的人物，查看其计划、记忆和可行动作。</span></div>}
        </aside>
      </section>

      <details className="worldConsoleTimeline" data-testid="world-console-timeline">
        <summary className="worldConsoleDisclosureSummary"><span>04 / 因果流</span><strong>因果流</strong><small>{recentTraces.length || recentEvents.length ? `${recentTraces.length} 条决策 · ${recentEvents.length} 条公开观察` : "等待世界推进后出现记录"}</small><ChevronDown size={15} aria-hidden="true" /></summary>
        <div className="worldConsoleDisclosureBody">
          <div className="worldConsoleSectionTitle"><span>04 / 因果流</span><h2>因果流</h2><small>世界正在如何变化</small></div>
          <div className="worldConsoleTimelineGrid"><div><h3><Activity size={14} aria-hidden="true" /> 居民决策</h3>{recentTraces.length ? recentTraces.slice(0, 4).map((trace) => { const selected = trace.candidates.find((candidate) => candidate.id === trace.selectedCandidateId); return <button type="button" className={trace.id === selectedEventId ? "selected" : ""} key={trace.id} onClick={() => { setSelectedEventId(trace.id); const actor = actors.find((item) => item.id === trace.npcId); if (actor) chooseActor(actor); if (selected?.targetLocationId) onLocationSelect(selected.targetLocationId); }}><time>Tick {trace.tick}</time><span>{actionLabels[selected?.kind || ""] || selected?.kind || "行动"}</span><small>{publicActorName(trace.npcId)} · {publicDescription(selected?.description) || "正在调整自己的下一步行动。"}</small></button>; }) : <p className="worldConsoleEmpty">推进世界后，居民的决策会出现在这里。</p>}</div><div><h3><Brain size={14} aria-hidden="true" /> 观察与记忆</h3>{recentEvents.length ? recentEvents.slice(0, 4).map((event, index) => <div className="worldConsoleEvent" key={`${event.observerNpcId}-${event.eventId || index}`}><span>{publicEventKind(event.kind)}</span><small>{publicActorName(event.observerNpcId)} · 公开事件</small></div>) : <p className="worldConsoleEmpty">尚未形成可读的观察记录。</p>}</div></div>
        </div>
      </details>

      <details className="worldConsoleSettlement" data-testid="world-console-settlement">
        <summary className="worldConsoleDisclosureSummary"><span>05 / 余波与回放</span><strong>结算与世界回响</strong><small>{latestAftermath ? (aftermathLabels[latestAftermath.outcome] || "已有公开记录") : "尚无结算记录 · 回放只读"}</small><ChevronDown size={15} aria-hidden="true" /></summary>
        <div className="worldConsoleDisclosureBody">
          <div className="worldConsoleSectionTitle"><span>05 / 余波与回放</span><h2>结算与世界回响</h2><small>只读安全汇总 · 不展示真相绑定</small></div>
          <div className="worldConsoleSettlementGrid">
          <article className={`worldConsoleSettlementCard settlement-${latestAftermath?.outcome || "empty"}`}>
            <span>案件结算</span>
            <strong>{latestAftermath ? (aftermathLabels[latestAftermath.outcome] || "案件已记录") : "尚无结算记录"}</strong>
            <small>{latestAftermath ? `最近一次记录 · Tick ${latestAftermath.tick}` : "案件提取或结案后会在这里留下公开状态"}</small>
          </article>
          <article className="worldConsoleSettlementCard">
            <span>世界余波</span>
            <strong>{aftermath.length} 条记录</strong>
            <small>{runtime?.consequences?.length || 0} 条公开后果 · 世界 Lead {leadStatus === "settled" ? "已结算" : leadStatus === "active" ? "进行中" : "未激活"}</small>
          </article>
          <article className={`worldConsoleSettlementCard ${recoveryStatus && recoveryStatus !== "empty" ? "settlement-recovery" : ""}`}>
            <span>驳回与恢复</span>
            <strong>{recoveryStatus === "completed" ? "恢复已完成" : recoveryStatus === "ready" || recoveryStatus === "scheduled" ? "恢复待处理" : "无待恢复"}</strong>
            <small>{localizeWorldCopy(runtime?.campaignRecoverySummary?.progressLabel) || "等待下一次合法恢复行动"}</small>
          </article>
          <article className="worldConsoleSettlementCard">
            <span>源世界 / 分支回放</span>
            <strong>{sourceBound && branchBound ? "源世界与分支已关联" : sourceBound ? "源世界已记录" : "等待回放分支"}</strong>
            <small>{snapshotDiff ? `当前差异 ${diffCount} 项 · ${snapshots.length} 个快照` : `${replayRunCount} 条回放记录 · 尚未选择差异`}</small>
          </article>
          </div>
          <p className="worldConsoleSettlementNote"><ShieldAlert size={14} aria-hidden="true" /> 接受、驳回和恢复都沿用现有权威处理器；回放只能读取 source/branch 差异，不会再次推进世界。</p>
        </div>
      </details>

      <details className="worldConsoleCaseQueue" data-testid="world-console-case-queue">
        <summary className="worldConsoleDisclosureSummary"><span>06 / 涌现案件</span><strong>案件候选</strong><small>{candidates.length ? `${validCandidates.length} 条可抽取 · ${candidates.length} 条压力链` : "等待压力链自然形成"}</small><ChevronDown size={15} aria-hidden="true" /></summary>
        <div className="worldConsoleDisclosureBody">
          <div className="worldConsoleSectionTitle"><span>06 / 涌现案件</span><h2>案件候选</h2><small>{validCandidates.length} 条可抽取</small></div>
          {candidates.length ? <div className="worldConsoleCandidateList">{candidates.slice(0, 4).map((candidate) => <article key={candidate.id} className={candidate.validation.valid ? "valid" : "blocked"}><div><strong>{caseTypeLabels[candidate.caseType || ""] || "涌现案件候选"}</strong><small>压力 {score(candidate.pressureScore)} · 成熟度 {score(candidate.maturityScore)}% · {candidate.validation.valid ? "路线可验证" : "仍需世界事实"}</small></div>{candidate.validation.valid ? <button type="button" onClick={() => extractCase(candidate)} disabled={runningBusy}><Search size={14} aria-hidden="true" /> 提取案件</button> : <span className="worldConsoleBlocked">{localizeWorldCopy(candidate.validation.failureReasons?.[0]) || "仍需更多世界事实"}</span>}</article>)}</div> : <div className="worldConsoleEmpty">案件不是预先摆好的卡牌；继续运行，让事件压力自然形成候选。</div>}
        </div>
      </details>

      <details className="worldConsoleReplayDrawer" data-testid="world-console-replay-drawer" open={reviewOpen} onToggle={(event) => setReviewOpen(event.currentTarget.open)}>
        <summary><span><RotateCcw size={15} aria-hidden="true" /> 审计与回放</span><small>场景 · 快照 · 分支 · 差异</small><ChevronDown size={15} aria-hidden="true" /></summary>
        <div className="worldConsoleReplayBody"><div><strong>世界运行验证</strong><p>{scenarioReport ? (scenarioReport.passed ? "最近一次基线通过。" : "最近一次基线未通过，请检查差异。") : "尚未运行基线场景。"}</p><button type="button" onClick={() => runScenario()} disabled={runningBusy || reviewBusy}><Play size={14} aria-hidden="true" /> 运行默认场景</button></div><div><strong>时间机器</strong><p>{selectedSnapshotFrom?.label || "起点"} → {selectedSnapshotTo?.label || "终点"} · {snapshotDiff ? `${snapshotDiff.addedEventIds.length} 个新增事件` : "未选择差异"}</p><div className="worldConsoleReplayControls"><select value={selectedSnapshotFromId} onChange={(event) => setSelectedSnapshotFromId(event.target.value)} aria-label="回放起点"><option value="">起点</option>{snapshots.map((item) => <option key={item.id} value={item.id}>{item.label} / T{item.tick}</option>)}</select><select value={selectedSnapshotToId} onChange={(event) => setSelectedSnapshotToId(event.target.value)} aria-label="回放终点"><option value="">终点</option>{snapshots.map((item) => <option key={item.id} value={item.id}>{item.label} / T{item.tick}</option>)}</select><button type="button" onClick={() => selectedSnapshotFromId && rollbackSnapshot(selectedSnapshotFromId)} disabled={!selectedSnapshotFromId}><RotateCcw size={14} aria-hidden="true" /> 回滚</button><button type="button" onClick={exportReplayBundle} disabled={!snapshots.length}><ArrowRight size={14} aria-hidden="true" /> 导出回放</button></div></div></div>
      </details>
    </main>
  );
}
