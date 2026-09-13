"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, AudioLines, CircleDot, Eye, FileWarning, Link2, ScanSearch, VolumeX, Search, FileText, Users, MessageSquare, LockKeyhole, Check, X } from "lucide-react";
import { buildCinematicDeductionModel, deriveCinematicResolutionPhase } from "@/app/campaign/cinematic-deduction-model";
import { useCampaignResolutionLedgerContext, useCampaignResolutionPhase } from "./CampaignResolutionLedger";
import { createCinematicSpatialTransfer } from "@/app/campaign/cinematic-spatial-transfer";
import type { FinalDetectiveWorkspaceProps } from "./FinalDetectiveWorkspace";
import type { CampaignFinaleDebriefSummary, CampaignSessionSummary } from "./WorldCampaignPanel";
import { executeCertifiedInvestigationStep } from "@/app/campaign/execute-certified-investigation-step";
import type { InvestigationActionResult } from "@/app/campaign/investigation-action-result";
import { useInvestigationActionExecution } from "./InvestigationActionExecution";
import { TheoryProofFields } from "./TheoryProofFields";
import { useAppLocale } from "@/app/localization/locale-context";
import { getNoirEvidenceArt, getNoirPortrait } from "@/app/campaign/noir-player-assets";
import styles from "./CinematicDeductionBoard.module.css";

export type CinematicDeductionBoardProps = FinalDetectiveWorkspaceProps & {
  campaignSession?: CampaignSessionSummary | null;
  campaignFinaleDebrief?: CampaignFinaleDebriefSummary | null;
  lowSensory: boolean;
  onToggleLowSensory?: () => void;
  variant?: "cinematic" | "standard";
};

const MOTION_PHASES = ["focus", "commit", "resolve", "world-reaction", "new-objective"] as const;

export function CinematicDeductionBoard(props: CinematicDeductionBoardProps) {
  const {
    model, currentAction, observeCaseWindow, notebookItems, discoveredEvidence, characters, actionAdapter,
    onIntakeNextAction, onNotebookAction, selectedCharacterId, setSelectedCharacterId,
    selectedEvidenceId, setSelectedEvidenceId, question, setQuestion, dialogueLog = [], theory, setTheory,
    submitTheory, gapCards, onGapSelect, onCampaignRecoveryStart, busy, campaignSession,
    campaignFinaleDebrief, lowSensory, onToggleLowSensory, variant = "cinematic"
  } = props;
  const { locale, number, text } = useAppLocale();
  const runWithResolution = useInvestigationActionExecution();
  const resolutionLedger = useCampaignResolutionLedgerContext();
  const resolutionPhase = useCampaignResolutionPhase();
  const cn = locale === "zh-CN";
  const copy = cn ? {
    aria: "午夜合唱电影化推理台", investigation: "午夜调查档案", publicRoute: "公开追责路线", risk: "理论压力",
    stable: "稳定：结论未获支持时，会产生可恢复的信任审查", watch: "证据已加入推理，提交后会检验证据链并记录结果",
    strained: "受压：先完成恢复行动，再修订推理", settled: "结案：结论已通过，证据链获得支持",
    evidence: "证据桌", found: "已发现", locked: "未发现", select: "置于推理台", remove: "移出理论",
    source: "定位来源", witness: "证人证词", chooseWitness: "选择一名证人", selectedClue: "当前证据",
    chooseClue: "从左侧选择一条已发现证据", question: "询问或质证的问题", challenge: "质证证词",
    challengeHint: "选择证人和一条已发现证据，检验他的陈述是否矛盾。", theory: "组织推理",
    suspect: "嫌疑人", motive: "动机", method: "手法", chooseSuspect: "选择嫌疑人", submit: "提交结论",
    selected: "推理中的证据", noSelected: "尚未建立证据链", next: "下一步调查", recovery: "恢复行动",
    finale: "终章回收", sensoryOn: "低感官模式已开启", sensoryOff: "开启低感官模式",
    objective: "当前目标", phaseNow: "当前阶段", phaseAria: "当前推理阶段",
    phaseDetail: {
      focus: "先把一个公共线索放到视线中央。",
      commit: "行动正在执行，请等待结果。",
      resolve: "读取裁定结果，并确认哪条链发生变化。",
      "world-reaction": "世界正在回应；先处理可恢复的公开压力。",
      "new-objective": "结果已记录，可以继续下一步调查。"
    },
    motionAria: "推理行动阶段：定位、承诺、裁定、世界反应、新目标",
    focus: "定位", commit: "承诺", resolve: "裁定", worldReaction: "世界反应", newObjective: "新目标",
    contradictionStage: "02 / 矛盾循环", commitStage: "03 / 承诺", theoryBlocked: "先补齐嫌疑人、动机、手法与证据链。",
    recoveryFirst: "先完成恢复行动，再提交修订后的结论。", routeFirst: "先完成当前调查步骤，再提交结论。"
  } : {
    aria: "Midnight Chorus cinematic deduction table", investigation: "Midnight investigation dossier", publicRoute: "Public Reckoning route", risk: "Theory pressure",
    stable: "Stable: a wrong theory creates a recoverable public-trust review interval", watch: "Watch: evidence is committed; submission will create a world consequence",
    strained: "Strained: complete the visible recovery, then revise the theory", settled: "Settled: the local judgement accepted this evidence chain",
    evidence: "Evidence table", found: "found", locked: "undiscovered", select: "Place on theory table", remove: "Remove from theory",
    source: "Locate source", witness: "Testimony pressure room", chooseWitness: "Choose a witness", selectedClue: "Evidence in focus",
    chooseClue: "Choose a discovered clue from the left", question: "Challenge question", challenge: "Connect evidence and challenge",
    challengeHint: "With a witness and clue selected, the challenge reuses the certified interrogation route.", theory: "Theory chain",
    suspect: "Suspect", motive: "Motive", method: "Method", chooseSuspect: "Choose a suspect", submit: "Commit theory and accept consequences",
    selected: "Evidence in theory", noSelected: "No evidence chain committed", next: "Next certified action", recovery: "Recoverable consequence",
    finale: "Finale recall", sensoryOn: "Low Sensory is on", sensoryOff: "Turn on Low Sensory",
    objective: "Current objective", phaseNow: "Current phase", phaseAria: "Current deduction phase",
    phaseDetail: {
      focus: "Put one public clue in focus before you act.",
      commit: "The certified action is committing; wait for the authoritative result.",
      resolve: "Read the judgement and confirm which visible chain changed.",
      "world-reaction": "The world is reacting; handle the recoverable public pressure first.",
      "new-objective": "The result is archived and the next certified action is ready."
    },
    motionAria: "Deduction action phases: Focus, Commit, Resolve, World Reaction, New Objective",
    focus: "Focus", commit: "Commit", resolve: "Resolve", worldReaction: "World reaction", newObjective: "New objective",
    contradictionStage: "02 / CONTRADICTION LOOP", commitStage: "03 / COMMIT", theoryBlocked: "Complete the suspect, motive, method, and evidence chain first.",
    recoveryFirst: "Complete the visible recovery before committing a revised theory.", routeFirst: "Continue the current certified route until theory submission is available."
  };
  const actionLock = useRef(false);
  const focusedEvidenceRef = useRef<HTMLElement>(null);
  const focusedWitnessRef = useRef<HTMLElement>(null);
  const theoryHeadingRef = useRef<HTMLHeadingElement>(null);
  const theoryEvidenceRefs = useRef(new Map<number, HTMLElement>());
  const spatialTransfer = useMemo(() => createCinematicSpatialTransfer(), []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onPreferenceChange = () => { if (media.matches) spatialTransfer.cancel(); };
    if (lowSensory || media.matches) spatialTransfer.cancel();
    media.addEventListener("change", onPreferenceChange);
    window.addEventListener("scroll", spatialTransfer.cancel, true);
    window.addEventListener("resize", spatialTransfer.cancel);
    return () => {
      media.removeEventListener("change", onPreferenceChange);
      window.removeEventListener("scroll", spatialTransfer.cancel, true);
      window.removeEventListener("resize", spatialTransfer.cancel);
      spatialTransfer.cancel();
    };
  }, [lowSensory, spatialTransfer]);
  const [localBusy, setLocalBusy] = useState(false);
  type InvestigationPathStep = "field" | "people" | "deduction";
  const [pathStep, setPathStep] = useState<InvestigationPathStep>("field");
  type QuestionRecord = { id: string; witness: string; question: string; evidence?: string; verdict: "yes" | "no" | "irrelevant"; detail: string };
  const [questionHistory, setQuestionHistory] = useState<QuestionRecord[]>(() => dialogueLog.slice(-8).reverse().map((entry) => ({
    id: entry.id,
    witness: characters.find((character) => character.id === entry.characterId)?.name || entry.characterId,
    question: entry.question,
    evidence: entry.evidenceId ? notebookItems.find((item) => item.evidenceId === entry.evidenceId)?.title : undefined,
    verdict: entry.challenge?.hit ? "yes" : entry.challenge ? "no" : "irrelevant",
    detail: entry.answer
  } as QuestionRecord)));
  const effectiveBusy = busy || localBusy;
  const cinematic = useMemo(() => buildCinematicDeductionModel({ campaign: campaignSession, finale: campaignFinaleDebrief, workspace: model, busy: effectiveBusy }), [effectiveBusy, campaignFinaleDebrief, campaignSession, model]);
  const motionPhase = deriveCinematicResolutionPhase(resolutionPhase, cinematic.motionPhase, effectiveBusy);
  const resolutionDetail = motionPhase === "resolve" ? resolutionLedger?.latest.chain.result
    : motionPhase === "world-reaction" ? resolutionLedger?.latest.chain.worldChange
      : motionPhase === "new-objective" ? resolutionLedger?.latest.chain.nextAction : undefined;
  const selectedCharacterIndex = characters.findIndex((item) => item.id === selectedCharacterId);
  const selectedEvidenceIndex = notebookItems.findIndex((item) => item.evidenceId === selectedEvidenceId);
  const selectedSuspectIndex = characters.findIndex((item) => item.id === theory.culpritId);
  const selectedWitness = model.testimony.rows.find((item) => item.characterIndex === selectedCharacterIndex);
  const selectedClue = model.evidence.rows.find((item) => item.sourceIndex === selectedEvidenceIndex && item.state !== "locked");
  const [libraryMode, setLibraryMode] = useState<"evidence" | "witness">(model.currentTask.action.kind === "question" || model.currentTask.action.kind === "challenge" ? "witness" : "evidence");
  const [mobilePanel, setMobilePanel] = useState<"library" | "focus" | "theory">("library");
  const [filter, setFilter] = useState("");
  const [sealedArchiveOpen, setSealedArchiveOpen] = useState(false);
  const evidenceArt = selectedClue ? getNoirEvidenceArt(selectedClue.title) : null;
  const witnessPortrait = selectedWitness ? getNoirPortrait(selectedWitness.actorName) : null;
  const filteredEvidence = model.evidence.rows.filter((item) => !filter.trim() || text(item.title).toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()));
  const discoveredEvidenceRows = filteredEvidence.filter((item) => item.state !== "locked");
  const sealedEvidenceRows = filteredEvidence.filter((item) => item.state === "locked");
  const filteredWitnesses = model.testimony.rows.filter((item) => !filter.trim() || text(item.actorName + " " + item.roleLabel).toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()));
  const investigationJoined = model.currentTask.action.kind !== "join";
  const lastCharacter = useRef(selectedCharacterId);
  useEffect(() => {
    if (selectedCharacterId && lastCharacter.current !== selectedCharacterId) { setLibraryMode("witness"); setMobilePanel("focus"); setFilter(""); }
    lastCharacter.current = selectedCharacterId;
  }, [selectedCharacterId]);
  useEffect(() => {
    if (model.currentTask.action.kind === "question" || model.currentTask.action.kind === "challenge") { setLibraryMode("witness"); setMobilePanel("focus"); }
    if (model.currentTask.action.kind === "question" || model.currentTask.action.kind === "challenge") setPathStep("people");
    else if (model.currentTask.action.kind === "select-evidence" || model.currentTask.action.kind === "submit" || model.currentTask.action.kind === "review-source") { setPathStep("deduction"); setLibraryMode("evidence"); setMobilePanel("theory"); }
    else if (model.currentTask.action.kind === "join" || model.currentTask.action.kind === "search" || model.currentTask.action.kind === "observe") { setPathStep("field"); setLibraryMode("evidence"); setMobilePanel("library"); }
  }, [model.currentTask.action.kind]);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const syncKeyboardInset = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty("--noir-keyboard-inset", `${Math.round(inset)}px`);
    };
    syncKeyboardInset();
    viewport.addEventListener("resize", syncKeyboardInset);
    viewport.addEventListener("scroll", syncKeyboardInset);
    return () => { viewport.removeEventListener("resize", syncKeyboardInset); viewport.removeEventListener("scroll", syncKeyboardInset); };
  }, []);

  async function runExclusive(action: () => void | InvestigationActionResult | Promise<void | InvestigationActionResult>, label = model.currentTask.action.label): Promise<InvestigationActionResult | undefined> {
    if (effectiveBusy || actionLock.current) return;
    actionLock.current = true;
    setLocalBusy(true);
    let outcome: InvestigationActionResult | undefined;
    try { await runWithResolution(label, async () => { outcome = (await action()) || { status: "blocked", detail: "Review the visible recovery status before continuing." }; return outcome; }); return outcome; }
    finally { actionLock.current = false; setLocalBusy(false); }
  }

  async function executeContradiction() {
    return actionAdapter.runInterrogationTarget(
      selectedCharacterId,
      selectedEvidenceId,
      question.trim() || (cn ? "这条证据如何改变你刚才对公开案发时段的陈述？" : "How does this evidence change your statement about the public incident window?")
    );
  }

  async function runContradiction() {
    if (!selectedCharacterId || !selectedEvidenceId) return;
    const result = await runExclusive(executeContradiction, copy.challenge);
    if (result && selectedWitness) appendQuestionRecord(result, selectedWitness.actorName, selectedClue?.title);
  }

  async function runQuestion() {
    if (!selectedWitness || !investigationJoined) return;
    const asked = question.trim() || (cn ? "案发时段你在哪里？你看到了什么？" : "Where were you during the incident, and what did you see?");
    const result = await runExclusive(() => actionAdapter.runInterrogationTarget(selectedCharacterId, undefined, asked), cn ? "询问证人" : "Question witness");
    if (result) appendQuestionRecord(result, selectedWitness.actorName);
  }

  function appendQuestionRecord(result: InvestigationActionResult, witness: string, evidence?: string) {
    const verdict: QuestionRecord["verdict"] = result.status === "succeeded" ? "yes" : result.status === "rejected" ? "irrelevant" : "no";
    setQuestionHistory((current) => [{ id: `${Date.now()}-${current.length}`, witness, question: question.trim() || (cn ? "未填写问题（使用了当前行动提示）" : "Prepared route question"), evidence, verdict, detail: result.detail }, ...current].slice(0, 8));
  }

  function toggleFocusedEvidence() {
    if (!effectiveBusy && selectedClue) actionAdapter.toggleTheoryEvidence(notebookItems[selectedClue.sourceIndex].evidenceId);
  }

  async function executeCertifiedAction() {
    return executeCertifiedInvestigationStep({
      kind: model.currentTask.action.kind, action: currentAction, adapter: actionAdapter,
      observeCaseWindow, focusStep: onIntakeNextAction, notebookItems, discoveredEvidence, theory, submitTheory,
      selectedCharacterId, selectedEvidenceId, question,
      onRecover: () => {
        if (model.runtimeMode === "server" && model.recovery.state === "ready" && onCampaignRecoveryStart) onCampaignRecoveryStart();
        else if (gapCards[0]) onGapSelect(gapCards[0]);
      }
    });
  }

  async function runCertifiedAction() {
    if (!model.currentTask.action.enabled) return;
    await runExclusive(executeCertifiedAction);
  }

  const pressureCopy = cinematic.riskState === "strained" ? copy.strained : cinematic.riskState === "settled" ? copy.settled : cinematic.riskState === "watch" ? copy.watch : copy.stable;
  const phaseLabel = (phase: typeof MOTION_PHASES[number]) => phase === "focus" ? copy.focus : phase === "commit" ? copy.commit : phase === "resolve" ? copy.resolve : phase === "world-reaction" ? copy.worldReaction : copy.newObjective;
  const theoryFieldsComplete = model.theory.suspectComplete && model.theory.motiveComplete && model.theory.methodComplete && model.theory.evidenceComplete;
  const recoveryBlocksTheory = model.theory.state === "rejected" && model.recovery.state !== "completed";
  const certifiedSubmitReady = model.currentTask.action.kind === "submit" && model.currentTask.action.enabled;
  const canSubmitTheory = variant === "standard" ? certifiedSubmitReady : model.theory.state === "ready"
    || (model.theory.state === "rejected" && model.recovery.state === "completed" && theoryFieldsComplete && certifiedSubmitReady);
  const theoryBlockReason = recoveryBlocksTheory
    ? copy.recoveryFirst
    : !theoryFieldsComplete
      ? copy.theoryBlocked
      : copy.routeFirst;
  const evidenceRatio = model.evidence.totalCount ? model.evidence.discoveredCount / model.evidence.totalCount : 0;
  const contradictionRatio = model.testimony.totalCount ? model.testimony.contradictionCount / model.testimony.totalCount : 0;
  const theoryRatio = [model.theory.suspectComplete, model.theory.motiveComplete, model.theory.methodComplete, model.theory.evidenceComplete].filter(Boolean).length / 4;
  const routeDone = model.progress.filter((item) => item.state === "done").length;
  const routeRatio = model.progress.length ? routeDone / model.progress.length : 0;
  const chainProgress = Math.round((evidenceRatio * 0.35 + contradictionRatio * 0.2 + theoryRatio * 0.35 + routeRatio * 0.1) * 100);
  const chainProgressLabel = cn
    ? `${number(model.evidence.discoveredCount)}/${number(model.evidence.totalCount)} 条证据 · ${number(model.testimony.contradictionCount)} 条矛盾 · ${number(chainProgress)}% 完成度`
    : `${number(model.evidence.discoveredCount)}/${number(model.evidence.totalCount)} clues · ${number(model.testimony.contradictionCount)} contradictions · ${number(chainProgress)}% complete`;
  const pathSteps: { id: InvestigationPathStep; ordinal: string; label: string; detail: string; ready: boolean }[] = cn ? [
    { id: "field", ordinal: "01", label: "现场证据", detail: `${number(model.evidence.discoveredCount)}/${number(model.evidence.totalCount)} 已发现`, ready: model.evidence.discoveredCount > 0 },
    { id: "people", ordinal: "02", label: "人物关系", detail: `${number(model.testimony.contradictionCount)} 条矛盾`, ready: questionHistory.length > 0 || model.testimony.contradictionCount > 0 },
    { id: "deduction", ordinal: "03", label: "推理链", detail: `${number(chainProgress)}% 完成`, ready: model.theory.selectedEvidenceCount > 0 || theoryRatio > 0 }
  ] : [
    { id: "field", ordinal: "01", label: "Field evidence", detail: `${number(model.evidence.discoveredCount)}/${number(model.evidence.totalCount)} found`, ready: model.evidence.discoveredCount > 0 },
    { id: "people", ordinal: "02", label: "People", detail: `${number(model.testimony.contradictionCount)} contradictions`, ready: questionHistory.length > 0 || model.testimony.contradictionCount > 0 },
    { id: "deduction", ordinal: "03", label: "Deduction chain", detail: `${number(chainProgress)}% complete`, ready: model.theory.selectedEvidenceCount > 0 || theoryRatio > 0 }
  ];
  function moveToPathStep(next: InvestigationPathStep) {
    setPathStep(next);
    if (next === "field") { setLibraryMode("evidence"); setMobilePanel("library"); }
    if (next === "people") { setLibraryMode("witness"); setMobilePanel("focus"); }
    if (next === "deduction") { setLibraryMode("evidence"); setMobilePanel("theory"); }
    window.requestAnimationFrame(() => {
      const target = next === "people" ? focusedWitnessRef.current : next === "deduction" ? theoryHeadingRef.current : focusedEvidenceRef.current;
      target?.focus({ preventScroll: true });
    });
  }

  return <section className={styles.board} data-testid="cinematic-deduction-board" data-motion-phase={motionPhase} data-low-sensory={lowSensory} data-runtime-mode={model.runtimeMode} data-variant={variant} data-mobile-panel={mobilePanel} data-path-step={pathStep} data-action-kind={model.currentTask.action.kind} aria-label={cn ? "案件调查与推理桌" : "Case investigation and deduction desk"}>
    <header className={styles.dossierHeader}>
      <div><span className={styles.eyebrow}>{cn ? "案件调查" : "CASE INVESTIGATION"}</span><p className={styles.headerContext}>{text(pressureCopy)}</p></div>
      <div className={styles.caseTally}><b>{number(model.evidence.discoveredCount).padStart(2, "0")}</b><span>{cn ? "已发现证据" : "clues discovered"}<small>{text(model.objective.progressLabel)}</small></span></div>
      {onToggleLowSensory && <button type="button" className={styles.sensoryToggle} data-testid="cinematic-low-sensory-toggle" aria-label={lowSensory ? copy.sensoryOn : copy.sensoryOff} title={lowSensory ? copy.sensoryOn : copy.sensoryOff} aria-pressed={lowSensory} onClick={onToggleLowSensory}>{lowSensory ? <VolumeX aria-hidden="true" /> : <AudioLines aria-hidden="true" />}</button>}
    </header>
    <nav className={styles.pathStepper} aria-label={cn ? "案件调查路径" : "Investigation path"} data-testid="investigation-path-stepper">
      {pathSteps.map((step) => <button type="button" key={step.id} data-testid={`investigation-path-${step.id}`} aria-current={pathStep === step.id ? "step" : undefined} aria-pressed={pathStep === step.id} onClick={() => moveToPathStep(step.id)}>
        <span className={styles.pathOrdinal}>{step.ordinal}</span><span className={styles.pathLabel}><strong>{step.label}</strong><small>{step.detail}</small></span>{step.ready && <Check size={15} aria-label={cn ? "已完成" : "Ready"} />}
      </button>)}
    </nav>
    <section className={styles.certifiedAction} data-testid="final-workspace-current-action" data-primary-action="true">
      <div><span>{copy.objective}</span><strong>{text(model.currentTask.action.label)}</strong><p>{text(model.currentTask.nextAction)}</p></div>
      <button type="button" data-testid="cinematic-certified-action" data-action-kind={model.currentTask.action.kind} onClick={() => void runCertifiedAction()} disabled={effectiveBusy || !model.currentTask.action.enabled}>{effectiveBusy ? cn ? "正在处理…" : "Resolving…" : text(model.currentTask.action.label)}<ArrowRight size={19} /></button>
    </section>
    <div className={styles.deductionGrid}>
      <aside className={styles.evidenceTable} data-panel="library" aria-label={cn ? "案件档案库" : "Case library"}>
        <div className={styles.libraryTabs}>
          <button type="button" aria-pressed={libraryMode === "evidence"} onClick={() => { setLibraryMode("evidence"); setFilter(""); }}><FileText size={17} />{cn ? "证据" : "Evidence"}<span>{model.evidence.discoveredCount}</span></button>
          <button type="button" aria-pressed={libraryMode === "witness"} onClick={() => { setLibraryMode("witness"); setFilter(""); }}><Users size={17} />{cn ? "人物" : "People"}<span>{model.testimony.totalCount}</span></button>
        </div>
        <label className={styles.librarySearch}><Search size={17} aria-hidden="true" /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={cn ? "查找档案" : "Find in the library"} aria-label={cn ? "筛选档案" : "Filter the library"} /></label>
        {libraryMode === "evidence" ? <div className={styles.evidenceStack}>
           {discoveredEvidenceRows.map((item) => {
            const source = notebookItems[item.sourceIndex];
            const active = item.sourceIndex === selectedEvidenceIndex;
            const art = item.state !== "locked" ? getNoirEvidenceArt(item.title) : null;
            return <article key={item.key} className={styles.evidenceCard} data-state={item.state} data-active={active}>
              <button type="button" className={styles.evidenceFace} aria-pressed={active} disabled={effectiveBusy} onClick={(event) => {
                if (item.state === "locked") { spatialTransfer.cancel(); onNotebookAction(source, "source"); return; }
                const card = event.currentTarget.closest("article");
                setSelectedEvidenceId(source.evidenceId); setMobilePanel("focus");
                window.requestAnimationFrame(() => focusedEvidenceRef.current?.focus({ preventScroll: true }));
                if (!active && card) {
                  try { spatialTransfer.start(card, () => focusedEvidenceRef.current, lowSensory || window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
                  catch { spatialTransfer.cancel(); }
                }
              }}>
                <span className={styles.evidenceThumb}>{art ? <img src={art.src} alt="" /> : item.state === "locked" ? <LockKeyhole size={22} /> : <FileText size={24} />}</span>
                <span className={styles.evidenceText}><small>{item.state === "locked" ? (cn ? "密封档案" : "SEALED DOSSIER") : text(item.provenanceLabel)}</small><strong>{text(item.title)}</strong><span data-evidence-status={item.state}>{item.state === "selected" ? <><Check size={12} />{cn ? "已关联 · 推理链" : "LINKED · THEORY"}</> : item.state === "locked" ? <><LockKeyhole size={12} />{cn ? "尚未发现" : "UNDISCOVERED"}</> : <><CircleDot size={11} />{cn ? "已发现" : "DISCOVERED"}</>}</span></span>
              </button>
              {item.state !== "locked" && <div className={styles.cardActions}><button type="button" onClick={() => onNotebookAction(source, "source")} disabled={effectiveBusy}><Eye size={15} />{copy.source}</button><button type="button" onClick={(event) => {
                if (effectiveBusy) return;
                const card = event.currentTarget.closest("article");
                const removing = item.state === "selected";
                const origin = removing ? theoryEvidenceRefs.current.get(item.sourceIndex) : card;
                try {
                  if (origin) spatialTransfer.start(origin, () => removing ? card : theoryEvidenceRefs.current.get(item.sourceIndex) || null, lowSensory || window.matchMedia("(prefers-reduced-motion: reduce)").matches, "theory");
                  else spatialTransfer.cancel();
                } catch { spatialTransfer.cancel(); }
                actionAdapter.toggleTheoryEvidence(source.evidenceId);
              }} disabled={effectiveBusy}>{item.state === "selected" ? <X size={15} /> : <Link2 size={15} />}{item.state === "selected" ? copy.remove : copy.select}</button></div>}
            </article>;
          })}
           {!discoveredEvidenceRows.length && <div className={styles.emptyState}>
             <strong>{filter.trim() ? (cn ? "没有符合条件的已发现证据" : "No discovered evidence matches") : (cn ? "证据库还没有打开的档案" : "No discovered evidence yet")}</strong>
             <p>{filter.trim() ? (cn ? "清除筛选，或打开密封档案查看可调查的线索。" : "Clear the filter, or open the sealed archive to inspect available leads.") : (cn ? "先执行上方的当前行动，线索会在调查后进入这里。" : "Complete the current action above; discovered leads will appear here.")}</p>
             {!!sealedEvidenceRows.length && <button type="button" data-testid="cinematic-open-sealed-archive" aria-expanded={sealedArchiveOpen} onClick={() => setSealedArchiveOpen((open) => !open)}>{sealedArchiveOpen ? (cn ? "收起密封档案" : "Hide sealed archive") : (cn ? `查看 ${sealedEvidenceRows.length} 份密封档案` : `View ${sealedEvidenceRows.length} sealed dossiers`)}<ArrowRight size={15} /></button>}
           </div>}
           {!!discoveredEvidenceRows.length && !!sealedEvidenceRows.length && <button type="button" className={styles.sealedArchiveToggle} data-testid="cinematic-open-sealed-archive" aria-expanded={sealedArchiveOpen} onClick={() => setSealedArchiveOpen((open) => !open)}><span>{cn ? "密封档案" : "Sealed archive"}<small>{sealedEvidenceRows.length}</small></span><span>{sealedArchiveOpen ? (cn ? "收起" : "Hide") : (cn ? "查看" : "Reveal")}<ArrowRight size={15} /></span></button>}
           {sealedArchiveOpen && !!sealedEvidenceRows.length && <div className={styles.sealedArchive} aria-label={cn ? "密封档案" : "Sealed archive"}>{sealedEvidenceRows.map((item) => {
             const source = notebookItems[item.sourceIndex];
             return <article key={item.key} className={styles.evidenceCard} data-state={item.state} data-active="false">
               <button type="button" className={styles.evidenceFace} onClick={() => { spatialTransfer.cancel(); onNotebookAction(source, "source"); }} disabled={effectiveBusy}>
                 <span className={styles.evidenceThumb}><LockKeyhole size={22} /></span>
                 <span className={styles.evidenceText}><small>{cn ? "密封档案" : "SEALED DOSSIER"}</small><strong>{cn ? "未发现的线索" : "Undiscovered lead"}</strong><span><LockKeyhole size={12} />{cn ? "尚未发现" : "UNDISCOVERED"}</span></span>
               </button>
             </article>;
           })}</div>}
        </div> : <div className={styles.witnessStrip} role="group" aria-label={copy.chooseWitness}>
          {filteredWitnesses.map((item) => {
            const portrait = getNoirPortrait(item.actorName);
            return <button type="button" key={item.key} aria-pressed={item.characterIndex === selectedCharacterIndex} data-state={item.state} onClick={(event) => {
              const characterId = characters[item.characterIndex]?.id || "";
              setSelectedCharacterId(characterId); setMobilePanel("focus");
              window.requestAnimationFrame(() => focusedWitnessRef.current?.focus({ preventScroll: true }));
              if (characterId && item.characterIndex !== selectedCharacterIndex) {
                try { spatialTransfer.start(event.currentTarget, () => focusedWitnessRef.current, lowSensory || window.matchMedia("(prefers-reduced-motion: reduce)").matches, "witness"); }
                catch { spatialTransfer.cancel(); }
              }
            }}><span className={styles.personThumb}>{portrait ? <img src={portrait.src} alt="" /> : <Users size={23} />}</span><span><strong>{text(item.actorName)}</strong><small>{text(item.roleLabel)}</small><em>{item.state === "unasked" ? cn ? "尚未询问" : "Not questioned" : item.state === "contradicted" ? cn ? "证词已修正" : "Statement revised" : cn ? "证词已记录" : "Statement recorded"}</em></span></button>;
          })}
          {!filteredWitnesses.length && <p className={styles.empty}>{cn ? "没有符合条件的人物。" : "No people match your search."}</p>}
        </div>}
      </aside>
      <section className={styles.contradictionChamber} data-panel="focus" aria-label={cn ? "查看证据与询问人物" : "Inspect evidence and question people"}>
        {libraryMode === "evidence" ? <article ref={focusedEvidenceRef} tabIndex={-1} className={styles.focusedDocument} data-testid="cinematic-focused-evidence">
          <div className={styles.documentArtwork}>{evidenceArt ? <img src={evidenceArt.src} alt={evidenceArt.alt} /> : <div className={styles.documentPlaceholder}><span>{cn ? "雾灯镇 · 调查档案" : "FOGLAMP TOWN · INVESTIGATION"}</span><FileText size={72} strokeWidth={.6} /><b>{selectedClue ? cn ? "证物记录" : "EVIDENCE RECORD" : cn ? "待检视" : "AWAITING INSPECTION"}</b></div>}<span className={styles.documentStamp}>{cn ? "物证档案" : "EVIDENCE FILE"}</span></div>
          <div className={styles.documentCopy}><span className={styles.eyebrow}>{selectedClue ? text(selectedClue.provenanceLabel) : cn ? "从左侧档案库开始" : "START WITH THE LIBRARY"}</span><h3>{selectedClue ? text(selectedClue.title) : cn ? "每一条线索，都值得细看。" : "Every detail deserves a closer look."}</h3><p>{selectedClue ? text(selectedClue.description) : cn ? "选择已发现的证据，查看记录。用它检验证词，或把它加入你的推理。" : "Choose a discovered clue to inspect its record, test a statement, or connect it to your theory."}</p>
            {selectedClue && <div className={styles.documentActions}><button type="button" onClick={() => { moveToPathStep("people"); setFilter(""); }}><MessageSquare size={18} />{cn ? "进入人物关系" : "Move to people"}</button><button type="button" disabled={effectiveBusy} onClick={toggleFocusedEvidence}><Link2 size={18} />{selectedClue.state === "selected" ? copy.remove : copy.select}</button></div>}
          </div>
        </article> : <div className={styles.questionRoom}>
          <article ref={focusedWitnessRef} tabIndex={-1} className={styles.witnessPortrait} data-testid="cinematic-focused-witness"><div>{witnessPortrait ? <img src={witnessPortrait.src} alt={witnessPortrait.alt} /> : <span className={styles.personPlaceholder}><Users size={72} strokeWidth={.6} /></span>}</div><header><span className={styles.eyebrow}>{selectedWitness ? text(selectedWitness.roleLabel) : cn ? "人物档案" : "PERSON FILE"}</span><h3>{selectedWitness ? text(selectedWitness.actorName) : copy.chooseWitness}</h3><p>{selectedWitness?.state === "unasked" ? cn ? "尚未记录他的陈述。" : "Their statement has not been recorded." : cn ? "已记录的公开陈述" : "RECORDED PUBLIC STATEMENT"}</p></header></article>
          <blockquote>{selectedWitness ? text(selectedWitness.statement) : cn ? "选择一名人物，听听他在案发时段看到了什么。" : "Choose someone to hear what they saw during the incident."}</blockquote>
          <label className={styles.questionField}>{copy.question}<textarea name="cinematic-challenge-question" autoComplete="off" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={cn ? "你想核实哪一个细节？" : "What detail would you like to verify?"} /></label>
          <div className={styles.presentedClue}><Link2 size={18} /><div><small>{cn ? "准备出示" : "READY TO PRESENT"}</small><strong>{selectedClue ? text(selectedClue.title) : cn ? "尚未选择证据" : "No evidence selected"}</strong></div><button type="button" onClick={() => { setLibraryMode("evidence"); setMobilePanel("library"); }}>{cn ? "更换" : "Change"}</button></div>
          <div className={styles.interrogationActions}><button type="button" onClick={() => void runQuestion()} disabled={effectiveBusy || !selectedWitness || !investigationJoined}><MessageSquare size={18} />{cn ? "询问证人" : "Question witness"}</button><button type="button" className={styles.challengeAction} data-testid="cinematic-challenge-action" onClick={() => void runContradiction()} disabled={effectiveBusy || !selectedWitness || !selectedClue || !investigationJoined}><Link2 size={18} />{copy.challenge}</button></div>
          <p className={styles.challengeHint}>{selectedClue ? copy.challengeHint : cn ? "先从证据库选择已发现的证据，才能质证。" : "Select a discovered clue from the library before challenging a statement."}</p>
          <details className={styles.questionHistory} open={questionHistory.length > 0}>
            <summary><MessageSquare size={16} />{cn ? "提问记录" : "Question history"}<span>{number(questionHistory.length)}</span></summary>
            {questionHistory.length ? <ol>{questionHistory.map((item) => <li key={item.id} data-verdict={item.verdict}><div className={styles.historyMeta}><b>{text(item.witness)}</b>{item.evidence && <small>{text(item.evidence)}</small>}<em>{item.verdict === "yes" ? cn ? "是" : "YES" : item.verdict === "no" ? cn ? "否" : "NO" : cn ? "无关" : "IRRELEVANT"}</em></div><p>{text(item.question)}</p><small>{text(item.detail)}</small></li>)}</ol> : <p className={styles.empty}>{cn ? "提交第一个问题后，回答会自动归档在这里。" : "Ask your first question to archive the answer here."}</p>}
          </details>
          <button type="button" className={styles.pathAdvance} data-testid="investigation-path-advance-deduction" onClick={() => moveToPathStep("deduction")} disabled={effectiveBusy || (!questionHistory.length && !model.contradictions.length)}><span>{cn ? "证词已记录？进入推理链" : "Ready to connect the testimony?"}</span><ArrowRight size={18} /></button>
        </div>}
        {!!model.contradictions.length && <div className={styles.contradictionLog} aria-live="polite"><span className={styles.eyebrow}>{cn ? "已暴露的矛盾" : "EXPOSED CONTRADICTIONS"}</span>{model.contradictions.slice(0, 3).map((item) => <article key={item.key} data-state={item.state}><Link2 size={18} /><div><b>{text(item.label)}</b><p>{text(item.detail)}</p></div></article>)}</div>}
        {(resolutionLedger || effectiveBusy) && <section className={styles.resolutionNotice} data-state={model.theory.state} aria-live="polite" data-testid="final-workspace-latest-resolution"><span>{effectiveBusy ? cn ? "行动进行中" : "ACTION IN PROGRESS" : motionPhase === "world-reaction" ? cn ? "小镇的回应" : "THE TOWN RESPONDS" : cn ? "最新调查记录" : "LATEST INVESTIGATION RECORD"}</span><strong>{effectiveBusy ? cn ? "正在等待行动结果…" : "Waiting for the action result…" : text(resolutionLedger?.latest.chain.result || "")}</strong>{!effectiveBusy && resolutionLedger && <p>{text(resolutionLedger.latest.chain.worldChange)}</p>}</section>}
      </section>
      <aside className={styles.theoryChain} data-panel="theory" aria-label={copy.theory} aria-describedby="cinematic-theory-evidence" data-state={model.theory.state}>
        <header><span className={styles.eyebrow}>{cn ? "推理工作区" : "DEDUCTION WORKSPACE"}</span><h3 ref={theoryHeadingRef} tabIndex={-1}>{cn ? "推理链" : "Deduction chain"}</h3><p>{text(model.theory.statusLabel)} · {chainProgressLabel}</p></header>
        <label>{copy.suspect}<select name="cinematic-theory-suspect" autoComplete="off" value={selectedSuspectIndex >= 0 ? String(selectedSuspectIndex) : ""} onChange={(event) => {
          const value = event.currentTarget.value;
          const culpritId = value === "" ? "" : characters[Number(value)]?.id || "";
          setTheory((current) => ({ ...current, culpritId }));
        }}><option value="">{copy.chooseSuspect}</option>{characters.map((character, index) => <option key={character.id} value={index}>{text(character.name)}</option>)}</select></label>
        <div className={`${styles.chainLinks} ${styles.theoryChecklist}`} id="cinematic-theory-evidence" role="group" aria-label={copy.selected} data-testid="cinematic-theory-links"><span>{copy.selected} · {model.theory.selectedEvidenceCount}</span>{model.theory.selectedEvidenceLabels.length ? model.evidence.rows.filter((item) => item.state === "selected").map((item) => <b key={item.key} ref={(node) => { if (node) theoryEvidenceRefs.current.set(item.sourceIndex, node); else theoryEvidenceRefs.current.delete(item.sourceIndex); }}><Link2 size={12} />{text(item.title)}</b>) : <small>{cn ? "从档案库加入证据，再分别关联动机与手法。" : "Add clues from the library, then connect them to motive and method."}</small>}</div>
        <TheoryProofFields theory={theory} setTheory={setTheory} discoveredEvidence={discoveredEvidence} busy={effectiveBusy} />
        <details className={styles.optionalNotes}><summary>{cn ? "写下推理笔记（可选）" : "Write theory notes (optional)"}</summary><label>{cn ? "动机笔记（可选）" : "Motive notes (optional)"}<textarea name="cinematic-theory-motive" autoComplete="off" value={theory.motive} onChange={(event) => { const motive = event.currentTarget.value; setTheory((current) => ({ ...current, motive })); }} /></label><label>{cn ? "手法笔记（可选）" : "Method notes (optional)"}<textarea name="cinematic-theory-method" autoComplete="off" value={theory.method} onChange={(event) => { const method = event.currentTarget.value; setTheory((current) => ({ ...current, method })); }} /></label></details>
        <button type="button" className={styles.submitAction} data-testid="cinematic-submit-theory" data-secondary-action={certifiedSubmitReady ? "true" : undefined} aria-describedby={!canSubmitTheory ? "cinematic-theory-block-reason" : undefined} onClick={() => void runExclusive(submitTheory, copy.submit)} disabled={effectiveBusy || !canSubmitTheory}>{model.theory.state === "accepted" ? <Check size={18} /> : <CircleDot size={18} />}{model.theory.state === "accepted" ? cn ? "结论已通过" : "Conclusion accepted" : copy.submit}<ArrowRight size={18} /></button>
        {!canSubmitTheory && model.theory.state !== "accepted" && <small id="cinematic-theory-block-reason" className={styles.theoryBlockReason}>{theoryBlockReason}</small>}
        {model.recovery.state !== "empty" && <section className={styles.recoveryBand} data-testid="cinematic-theory-pressure" data-state={model.recovery.state}><FileWarning size={25} /><div><span>{copy.recovery}</span><strong>{text(model.recovery.label)}</strong><p>{text(model.recovery.detail)}</p><small>{text(model.recovery.costLabel)}</small></div>{model.recovery.state === "ready" && onCampaignRecoveryStart && <button type="button" onClick={() => void runExclusive(onCampaignRecoveryStart)} disabled={effectiveBusy}>{text(model.recovery.nextAction)}<ArrowRight size={18} /></button>}</section>}
      </aside>
    </div>
    {!!cinematic.finaleBeats.length && <section className={styles.finale} data-testid="cinematic-finale-recall"><span className={styles.eyebrow}>{copy.finale}</span>{cinematic.finaleBeats.map((beat, index) => <p key={index}><b>{number(index + 1).padStart(2, "0")}</b>{text(beat)}</p>)}</section>}
    {variant === "standard" && model.sourceReview.state !== "locked" && <details className={styles.reviewArchive} data-testid="source-review-unlock"><summary><FileText size={18} />{cn ? "查看已解锁的结案档案" : "View the unlocked case record"}</summary><div data-testid="source-review-workbench">{model.sourceReview.rows.map((item) => <article key={item.key}><strong>{text(item.label)}</strong><p>{text(item.detail)}</p></article>)}</div></details>}
  </section>;
}
