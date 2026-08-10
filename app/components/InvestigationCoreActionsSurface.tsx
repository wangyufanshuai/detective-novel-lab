"use client";

import { Bot, FileSearch, Gavel, GitBranch, MessageSquare, ShieldCheck } from "lucide-react";
import type { CertifiedInvestigationActionAdapter } from "@/app/hooks/useCertifiedInvestigationActions";
import type { EvidenceImpact } from "@/app/hooks/useInvestigationActions";
import type { AiSafetyView, GapCard, NotebookAction } from "@/app/campaign/investigation-workspace-model";
import type {
  DeductionCase,
  Evidence,
  EvidenceNotebookItem,
  PlayableCaseIntake,
  PlayableCaseNextAction,
  PlayerSession,
  PlayerTheory
} from "@/lib/engine";

function EvidenceNotebookPanel({ items, onAction }: { items: EvidenceNotebookItem[]; onAction: (item: EvidenceNotebookItem, action: NotebookAction) => void }) {
  const discoveredCount = items.filter((item) => item.discovered).length;
  return (
    <section className="actionPanel evidenceNotebookPanel" data-testid="evidence-notebook">
      <div className="panelHeaderLine"><h2><FileSearch size={16} /> Evidence Notebook</h2><span>{discoveredCount}/{items.length}</span></div>
      <p>笔记只展示玩家已发现线索的标题、来源和用途；锁定线索不剧透。</p>
      <div className="notebookList">
        {items.map((item) => (
          <article key={item.evidenceId} className={`notebookCard ${item.locked ? "locked" : ""} ${item.isKey && item.discovered ? "keyEvidence" : ""}`}>
            <span className="eyebrow">{item.locked ? "LOCKED" : item.isKey ? "关键线索" : "已发现"}</span>
            <h3>{item.title}</h3><p>{item.useHint}</p>
            {!item.locked && <><div className="notebookMeta"><span>{item.locationName}</span><span>{item.sourceEventLabel || "现场来源"}</span></div><div className="notebookTags">{item.supports.map((tag, index) => <span key={`support:${index}:${tag}`}>支持 {tag}</span>)}{item.contradicts.map((tag, index) => <span className="warn" key={`contradict:${index}:${tag}`}>矛盾 {tag}</span>)}</div></>}
            <div className="notebookActions">
              <button type="button" onClick={() => onAction(item, "source")}>{item.locked ? "前往地点" : "查看来源"}</button>
              <button type="button" onClick={() => onAction(item, "challenge")} disabled={!item.discovered || item.challengeNpcIds.length === 0}>用于质询</button>
              <button type="button" onClick={() => onAction(item, "chain")} disabled={item.locked}>加入推理链</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CaseIntakePanel({ intake, session, joinCase, onNextAction, commandDeckMode = false }: {
  intake: PlayableCaseIntake;
  session: PlayerSession | null;
  joinCase: () => void;
  onNextAction: (action: PlayableCaseNextAction) => void;
  commandDeckMode?: boolean;
}) {
  const nextAction = intake.nextAction || {
    kind: session ? "review" : "join",
    label: session ? "Review route" : "Join the investigation",
    detail: intake.readiness.summary,
    buttonLabel: session ? "Review route" : "Join investigation"
  } satisfies PlayableCaseNextAction;
  const progress = intake.progress;
  const coach = intake.coach;
  return (
    <section className="actionPanel caseIntakePanel" data-testid="case-intake">
      <div className="panelHeaderLine"><div><span className="eyebrow">Emerged from town runtime</span><h2><GitBranch size={16} /> Case Intake</h2></div><span className={`runtimePill ${intake.readiness.status}`}>{intake.readiness.score}%</span></div>
      <p>{intake.readiness.summary}</p>
      {coach && <article className="caseIntakeNext coachPanel" data-testid="investigation-coach">
        <span>Investigation Coach</span><strong>{coach.nextStep.label}</strong><small>{coach.summary}</small><small>{coach.nextStep.completion}</small>
        <div className="caseIntakeProgress compact" data-testid="investigation-coach-coverage"><span><b>{coach.stage}</b>coach stage</span><span><b>{coach.coverage.coveredRequired}/{coach.coverage.totalRequired}</b>ledger</span><span><b>{coach.coverage.discoveredEvidence}/{coach.coverage.totalEvidence}</b>evidence</span><span><b>{coach.coverage.challengeHitCount}</b>challenge hits</span><span><b>{coach.coverage.submitReady ? "ready" : "not ready"}</b>submit</span></div>
        {!!coach.blockers.length && <div className="caseIntakeGaps" data-testid="investigation-coach-blockers">{coach.blockers.slice(0, 3).map((blocker, index) => <span key={`${blocker.kind}:${index}`}>{blocker.kind}: {blocker.label}</span>)}</div>}
      </article>}
      <article className="caseIntakeNext" data-testid="case-intake-next-action"><span>Next action</span><strong>{nextAction.label}</strong><small>{nextAction.detail}</small>
        {!commandDeckMode && <button type="button" className="primaryButton full" data-testid="case-intake-next" onClick={() => nextAction.kind === "join" ? joinCase() : onNextAction(nextAction)}>{nextAction.buttonLabel}</button>}
      </article>
      {progress && <div className="caseIntakeProgress" data-testid="case-intake-progress"><span><b>{progress.currentStage}</b>stage</span><span><b>{progress.discoveredEvidence}/{progress.totalEvidence}</b>evidence</span><span><b>{progress.questionedWitnesses}/{progress.totalWitnesses}</b>witnesses</span><span><b>{progress.challengeReadyCount}</b>challenges ready</span><span><b>{progress.submitReady ? "ready" : "not ready"}</b>submit</span></div>}
      {intake.proofCoverage && <div className="caseIntakeProgress proofCoverage" data-testid="case-intake-proof-coverage"><span><b>{intake.proofCoverage.coveredRequired}/{intake.proofCoverage.totalRequired}</b>ledger coverage</span><span><b>{Math.round(intake.proofCoverage.coverageRatio * 100)}%</b>proof</span><span><b>{intake.proofCoverage.gaps.length}</b>proof gaps</span></div>}
      {intake.routeCertificate && <div className="caseIntakeProgress routeCertificate" data-testid="case-intake-route-certificate"><span><b>{intake.routeCertificate.routeCertified ? "certified" : "blocked"}</b>route</span><span><b>{intake.routeCertificate.routeStepCount}</b>steps</span><span><b>{intake.routeCertificate.coveredRequiredObligations}/{intake.routeCertificate.totalRequiredObligations}</b>obligations</span><span><b>{intake.routeCertificate.blockers.length}</b>blockers</span></div>}
      {intake.routeIntegrity && <div className={`routeIntegrity ${intake.routeIntegrity.playable ? "pass" : "fail"}`} data-testid="case-route-integrity"><span>{intake.routeIntegrity.playable ? "Route complete" : "Route blocked"}</span><small>
        motive {intake.routeIntegrity.criticalCoverage.motive ? "ok" : "gap"} / means {intake.routeIntegrity.criticalCoverage.means ? "ok" : "gap"} / opportunity {intake.routeIntegrity.criticalCoverage.opportunity ? "ok" : "gap"} / exclusion {intake.routeIntegrity.criticalCoverage.exclusion ? "ok" : "gap"}
        {typeof intake.routeIntegrity.proofLedgerValid === "boolean" ? ` / ledger ${intake.routeIntegrity.proofLedgerValid ? "ok" : "gap"}` : ""}{typeof intake.routeIntegrity.routeCertified === "boolean" ? ` / certificate ${intake.routeIntegrity.routeCertified ? "ok" : "gap"}` : ""}
      </small></div>}
      <div className="reviewMetricGrid compact"><span><b>{intake.sourceCounts.events}</b>source events</span><span><b>{intake.sourceCounts.memories}</b>memories</span><span><b>{intake.sourceCounts.observations}</b>observations</span><span><b>{intake.sourceCounts.discoveredEvidence}/{intake.sourceCounts.totalEvidence}</b>evidence</span></div>
      <div className="questChain intakeChain" data-testid="case-intake-chain">{intake.chainStages.map((stage) => <span key={stage.id} className={stage.complete ? "on" : ""}>{stage.label}</span>)}</div>
      <div className="caseIntakeGrid">
        <section><strong>Investigation route</strong>{(intake.progressStages || intake.starterTasks).slice(0, 5).map((task) => <article key={task.id} className={task.complete ? "complete" : task.locked ? "locked" : ""}><span>{task.complete ? "Done" : task.locked ? "Locked" : "Next"}</span><b>{task.title}</b><small>{task.detail}</small></article>)}</section>
        <section><strong>Evidence route</strong>{intake.evidenceRoute.slice(0, 5).map((item) => <article key={item.id} className={item.discovered ? "complete" : ""}><span>{item.discovered ? "Found" : item.isKey ? "Key clue" : "Support"}</span><b>{item.locationName}</b><small>{item.hint}</small></article>)}</section>
        <section><strong>Witness plan</strong>{intake.witnessPlan.slice(0, 4).map((item) => <article key={item.characterId} className={item.challengeReady ? "ready" : item.questioned ? "complete" : ""}><span>{item.challengeReady ? "Challenge ready" : item.questioned ? "Questioned" : "Question"}</span><b>{item.characterName}</b><small>{item.hint}</small></article>)}</section>
      </div>
      {!!intake.spoilerSafeGaps.length && <div className="caseIntakeGaps" data-testid="case-intake-gaps">{intake.spoilerSafeGaps.slice(0, 4).map((gap, index) => <span key={`${index}:${gap}`}>{gap}</span>)}</div>}
      <div className="sourceTrail" data-testid="case-intake-source-trail">{intake.sourceTrail.slice(0, 6).map((item) => <article key={item.id} className={item.hidden ? "locked" : ""}><span>{item.kind}</span><b>{item.label}</b><small>{item.detail}</small></article>)}</div>
      {!commandDeckMode && !session && <button type="button" className="primaryButton full" data-testid="case-intake-join" onClick={joinCase}>Join investigation</button>}
      <small className="sourceBackedPill" data-testid="source-backed-case">{session ? "source-backed / emerged from town runtime" : "source-backed / session pending"}</small>
    </section>
  );
}

export function InvestigationCoreActionsSurface({
  playableIntake, onIntakeNextAction, notebookItems, onNotebookAction, selectedSceneName, sceneEvidence,
  discoveredEvidence, discoveredIds, evidenceImpacts, actionAdapter, session, characters,
  selectedCharacterId, setSelectedCharacterId, selectedEvidenceId, setSelectedEvidenceId,
  selectedTestimony, question, setQuestion, aiSafety, memoryCount, evidenceCount, contradictionHit,
  dialogueLog, deductionCase, theory, setTheory, playerTheoryEvidence, submitTheory, revealText,
  judgementGaps, gapCards, onGapSelect, nextStepAdvice, busy, commandDeckMode
}: {
  playableIntake?: PlayableCaseIntake | null;
  onIntakeNextAction: (action: PlayableCaseNextAction) => void;
  notebookItems: EvidenceNotebookItem[];
  onNotebookAction: (item: EvidenceNotebookItem, action: NotebookAction) => void;
  selectedSceneName: string;
  sceneEvidence: Evidence[];
  discoveredEvidence: Evidence[];
  discoveredIds: Set<string>;
  evidenceImpacts: Map<string, EvidenceImpact>;
  actionAdapter: CertifiedInvestigationActionAdapter;
  session: PlayerSession | null;
  characters: DeductionCase["characters"];
  selectedCharacterId: string;
  setSelectedCharacterId: (value: string) => void;
  selectedEvidenceId: string;
  setSelectedEvidenceId: (value: string) => void;
  selectedTestimony?: { currentStatement: string };
  question: string;
  setQuestion: (value: string) => void;
  aiSafety: AiSafetyView | null;
  memoryCount: number;
  evidenceCount: number;
  contradictionHit: boolean;
  dialogueLog: PlayerSession["interrogationLog"];
  deductionCase: DeductionCase | null;
  theory: PlayerTheory;
  setTheory: (updater: (current: PlayerTheory) => PlayerTheory) => void;
  playerTheoryEvidence: Set<string>;
  submitTheory: () => void;
  revealText: string;
  judgementGaps: string[];
  gapCards: GapCard[];
  onGapSelect: (card: GapCard) => void;
  nextStepAdvice?: string;
  busy: boolean;
  commandDeckMode?: boolean;
}) {
  return <>
    {playableIntake && <CaseIntakePanel intake={playableIntake} session={session} joinCase={actionAdapter.joinCase} onNextAction={onIntakeNextAction} commandDeckMode={commandDeckMode} />}
    <EvidenceNotebookPanel items={notebookItems} onAction={onNotebookAction} />
    <section className="actionPanel">
      <h2><FileSearch size={16} /> 地点与证据</h2><p>{selectedSceneName || "选择地图地点"}</p>
      <div className="evidenceList">
        {sceneEvidence.map((item) => {
          const impact = evidenceImpacts.get(item.id);
          return <button key={item.id} className={discoveredIds.has(item.id) ? "found" : ""} onClick={() => actionAdapter.discoverEvidence(item.id)} disabled={!session || !item.discoverable || discoveredIds.has(item.id) || busy}>
            <strong>{discoveredIds.has(item.id) ? item.title : item.discoverable ? "未发现线索" : "公开现场记录"}</strong>
            <span>{discoveredIds.has(item.id) ? item.visibleDescription : item.discoverable ? `${selectedSceneName} 中可能存在调查价值。` : item.visibleDescription}</span>
            {discoveredIds.has(item.id) && impact && <small className={`evidenceImpact impact-${impact.tone}`} data-testid="evidence-use-hint">{impact.label}：{impact.detail}</small>}
          </button>;
        })}
        {!sceneEvidence.length && <span className="emptyText">该地点暂无可发现证据。</span>}
      </div>
    </section>
    <section className="actionPanel">
      <h2><MessageSquare size={16} /> NPC 询问</h2>
      <label>角色<select value={selectedCharacterId} onChange={(event) => setSelectedCharacterId(event.target.value)}>{characters.map((character) => <option key={character.id} value={character.id}>{character.name} - {character.role}</option>)}</select></label>
      <label>出示证据<select value={selectedEvidenceId} onChange={(event) => setSelectedEvidenceId(event.target.value)}><option value="">不出示证据</option>{discoveredEvidence.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      {selectedTestimony && <div className="testimonyBox"><span>当前证词</span><p>{selectedTestimony.currentStatement}</p></div>}
      <textarea value={question} onChange={(event) => setQuestion(event.target.value)} />
      <button className="primaryButton full" onClick={actionAdapter.interrogateSelected} disabled={!session || !selectedCharacterId || busy}><Bot size={16} /> 询问 NPC</button>
      <div className={`aiSafetyStrip ${aiSafety?.promptAudit?.safe === false ? "unsafe" : "safe"}`}><span>Prompt Safe: {aiSafety?.promptAudit?.safe === false ? "No" : "Yes"}</span><span>Memory: {aiSafety?.memoryCount ?? memoryCount}</span><span>Evidence: {aiSafety?.evidenceCount ?? evidenceCount}</span><span>Contradiction: {contradictionHit ? "Hit" : "None"}</span>{!!aiSafety?.safetyFlags?.length && <span>Flags: {aiSafety.safetyFlags.join(", ")}</span>}</div>
      <div className="dialogueLog">{dialogueLog.slice(-2).reverse().map((entry) => <article key={entry.id} className={entry.challenge?.hit ? "challengeHit" : ""}><p><strong>{deductionCase?.characters.find((item) => item.id === entry.characterId)?.name || entry.characterId}</strong><span>{entry.evidenceId ? `出示 ${entry.evidenceId}` : "普通询问"}</span></p>{entry.challenge?.hit && <small className="challengeBadge">命中证词矛盾：只暴露局部事实，不泄露真相</small>}<blockquote>{entry.answer}</blockquote></article>)}</div>
    </section>
    <section className="actionPanel">
      <h2><Gavel size={16} /> 提交推理</h2>
      <label>凶手<select data-testid="theory-culprit" value={theory.culpritId} onChange={(event) => setTheory((current) => ({ ...current, culpritId: event.target.value }))}><option value="">选择嫌疑人</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select></label>
      <textarea placeholder="动机" value={theory.motive} onChange={(event) => setTheory((current) => ({ ...current, motive: event.target.value }))} />
      <textarea placeholder="手法" value={theory.method} onChange={(event) => setTheory((current) => ({ ...current, method: event.target.value }))} />
      <div className="checkList" data-testid="theory-evidence-list">{discoveredEvidence.map((item) => <label className="checkRow" key={item.id}><input type="checkbox" checked={playerTheoryEvidence.has(item.id)} onChange={() => actionAdapter.toggleTheoryEvidence(item.id)} />{item.title}</label>)}</div>
      <button data-testid="submit-theory" className="primaryButton full" onClick={submitTheory} disabled={!session || busy}><ShieldCheck size={16} /> 判定推理</button>
      {session?.judgement && <div className={`judgement ${session.judgement.accepted ? "pass" : "fail"}`} data-testid="judgement-result">
        <strong>{session.judgement.accepted ? "推理成立" : "推理不成立"}</strong>
        {session.judgement.accepted ? <p>{session.judgement.explanation}</p> : <div className="gapHints" data-testid="theory-gap-cards"><span>缺口类型：</span>{(gapCards.length ? gapCards : judgementGaps.map((item, index) => ({ id: `${item}-${index}`, label: item, detail: "补齐这部分后再提交推理。", target: "logic" as const }))).map((item) => <button key={item.id} type="button" className="gapCard" onClick={() => onGapSelect(item)}><strong>{item.label}</strong><small>{item.detail}</small></button>)}</div>}
        {!session.judgement.accepted && nextStepAdvice && <article className="nextStepAdvice" data-testid="next-step-advice"><strong>下一步建议</strong><span>{nextStepAdvice}</span></article>}
        <button className="secondaryButton" onClick={actionAdapter.revealSolution} disabled={!session.judgement.accepted || busy}>生成解答篇</button>
      </div>}
      {revealText && <pre className="revealBox">{revealText}</pre>}
    </section>
  </>;
}
