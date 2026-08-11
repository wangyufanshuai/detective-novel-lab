"use client";

import { CommandDeckCollapsible } from "@/app/components/CommandDeckShell";
import type { CampaignPacingViewModel } from "@/app/campaign/campaign-pacing-model";
import type {
  ManualEvidenceDrillSummary,
  ManualTheoryDrillSummary,
  ReplayAttemptScorecardSummary,
  ReplayGoalCoachSummary,
  ReplayPracticeLoopSummary,
  SolvedCaseDebriefSummary
} from "@/app/campaign/investigation-workspace-model";
import { useAppLocale } from "@/app/localization/locale-context";

function SolvedCaseDebriefPanel({ summary, campaignPacing }: { summary: SolvedCaseDebriefSummary; campaignPacing?: CampaignPacingViewModel | null }) {
  const { number, t, text } = useAppLocale();
  if (!summary.accepted) return null;
  const coverageLabel = summary.totalObligations ? `${summary.coveredObligations}/${summary.totalObligations}` : `${summary.coveredObligations}`;
  return (
    <section className="solvedCaseDebrief" data-testid="solved-case-debrief">
      <div className="solvedCaseDebriefHeader"><div><span>{t("replay.debrief")}</span><strong>{t("replay.completedAccepted")}</strong></div><b>{summary.sourceReviewUnlocked ? t("replay.sourceUnlocked") : t("replay.sourceLocked")}</b></div>
      <div className="solvedCaseDebriefMetrics">
        <span className="pass"><b>{number(summary.manualStepsCompleted)}/{number(summary.totalManualSteps)}</b>{t("replay.manualGuidedSteps")}</span>
        <span className={summary.fallbackUsed ? "check" : "pass"}><b>{summary.fallbackUsed ? t("replay.used") : t("replay.notUsed")}</b>{t("replay.certifiedFallback")}</span>
        <span><b>{number(summary.selectedEvidenceCount)}</b>{t("replay.selectedEvidence")}</span><span><b>{number(summary.challengeHitCount)}</b>{t("replay.challengeHits")}</span><span><b>{coverageLabel}</b>{t("replay.coveredObligations")}</span>
        <span className={summary.proofGapCount ? "check" : "pass"}><b>{number(summary.proofGapCount)}</b>{t("replay.proofGaps")}</span>
        <span className={summary.worldLeadOutcomeStatus === "settled" ? "pass" : "check"}><b>{text(summary.worldLeadOutcomeStatus)}</b>{t("replay.worldLeadOutcome")}</span>
        <span className={summary.worldLeadHandoffStatus === "consumed" ? "pass" : "check"}><b>{text(summary.worldLeadHandoffStatus)}</b>{t("replay.nextCaseHandoff")}</span>
        <span className={summary.worldArcStatus === "completed" ? "pass" : "check"}><b>{text(summary.worldArcProgress)}</b>{t("replay.worldArc")}</span>
        <span className={summary.worldArcDirectiveStatus === "completed" ? "pass" : summary.worldArcDirectiveStatus === "blocked" ? "check" : ""}><b>{text(summary.worldArcDirectiveStatus)}</b>{t("replay.factionDirective")}</span>
        <span className={summary.worldPressureCascadeStatus === "consumed" ? "pass" : summary.worldPressureCascadeStatus === "active" ? "check" : ""}><b>{text(summary.worldPressureCascadeStatus)}</b>{t("replay.worldPressure")}</span>
        <span className={summary.townSocialResponseStatus === "settled" ? "pass" : summary.townSocialResponseStatus === "active" || summary.townSocialResponseStatus === "ready" ? "check" : ""}><b>{text(summary.townSocialResponseStatus)}</b>{t("replay.townReactions")}</span>
        <span className={summary.investigationOperationsStatus === "settled" ? "pass" : "check"}><b>{text(summary.investigationOperationsProgress)}</b>{t("replay.operations")} / {text(summary.investigationOperationsTime)}</span>
      </div>
      <div className="solvedCaseDebriefSections">
        <article><span>{t("replay.playerRoute")}</span><b>{t("replay.routeCompleted")}</b><small>{t("replay.lastGuidedResult", { result: text(summary.lastStepResult || "accepted") })}</small></article>
        <article><span>{t("replay.evidenceClosure")}</span><b>{number(summary.selectedEvidenceCount)} {t("replay.selectedEvidence")}</b><small>{coverageLabel} {t("replay.coveredObligations")} · {number(summary.proofGapCount)} {t("replay.proofGaps")}.</small></article>
        <article><span>{t("replay.sourceConfidence")}</span><b>{number(summary.sourceEventCount)} {t("workspace.sourceEvents")} / {number(summary.memoryCount)} {t("replay.memories")}</b><small>{t("replay.sourceDetail", { steps: number(summary.routeStepCount), hits: number(summary.challengeHitCount) })}</small></article>
        <article><span>{t("replay.nextGoal")}</span><b>{t(summary.fallbackUsed ? "replay.goal.reduceFallback" : "replay.goal.moreManual")}</b><small>{t("replay.goal.detail")}</small></article>
        <article><span>{t("replay.operations")}</span><b>{t("replay.operationsSupport", { status: text(summary.investigationOperationsStatus), support: text(summary.investigationOperationsSupport) })}</b><small>{t("replay.operationsDetail", { progress: text(summary.investigationOperationsProgress), time: text(summary.investigationOperationsTime) })}</small></article>
        <article><span>{t("replay.worldLeadOutcome")}</span><b>{summary.worldLeadOutcomeStatus === "settled" ? t("replay.outcome.settled") : summary.worldLeadOutcomeStatus === "active" ? t("replay.outcome.active") : t("replay.notUsed")}</b><small>{t("replay.outcome.detail")}</small></article>
        <article><span>{t("replay.nextCaseHandoff")}</span><b>{summary.worldLeadHandoffStatus === "ready" ? t("replay.handoff.ready") : summary.worldLeadHandoffStatus === "consumed" ? t("replay.handoff.carried") : t("replay.notUsed")}</b><small>{t("replay.handoff.detail")}</small></article>
        <article><span>{t("replay.worldArc")}</span><b>{summary.worldArcStatus === "completed" ? t("replay.arc.completed") : summary.worldArcStatus === "active" ? t("replay.arc.active") : t("replay.notUsed")}</b><small>{t("replay.arc.detail", { progress: text(summary.worldArcProgress) })}</small></article>
        <article><span>{t("replay.factionDirective")}</span><b>{text(summary.worldArcDirectiveStatus)}</b><small>{t("replay.directive.detail")}</small></article>
        <article><span>{t("replay.worldPressure")}</span><b>{text(summary.worldPressureCascadeStatus)}</b><small>{t("replay.pressure.detail")}</small></article>
        <article><span>{t("replay.townReactions")}</span><b>{text(summary.townSocialResponseStatus)}</b><small>{t("replay.reactions.detail")}</small></article>
        {campaignPacing && <article data-testid="debrief-campaign-pacing"><span>{t("replay.campaignPacing")}</span><b>{text(campaignPacing.status)} / {text(campaignPacing.value.primarySurface)}</b><small>{text(campaignPacing.safeForecast.whatChanges)} {text(campaignPacing.safeForecast.unchangedAuthority)}</small></article>}
      </div>
      <small className="solvedCaseDebriefBoundary">{t("replay.boundary.solved")}</small>
    </section>
  );
}

function ReplayGoalCoachPanel({ summary, onStartReplay }: { summary: ReplayGoalCoachSummary; onStartReplay: () => void }) {
  const { number, t, text } = useAppLocale();
  if (!summary.visible) return null;
  return (
    <section className={`replayGoalCoach ${summary.activeAttempt ? "active" : ""}`} data-testid="replay-goal-coach">
      <div className="replayGoalCoachHeader"><div><span>{t("replay.goalCoach")}</span><strong>{summary.activeAttempt ? t("replay.attemptActive") : t("replay.readyPractice")}</strong></div><button type="button" className="primaryButton" data-testid="start-replay-attempt" onClick={onStartReplay}>{t("replay.start")}</button></div>
      <div className="replayGoalCoachMetrics">
        <span><b>{number(summary.previousGuidedSteps)}</b>{t("replay.previousGuided")}</span><span className={summary.previousFallbackUsed ? "check" : "pass"}><b>{summary.previousFallbackUsed ? t("replay.used") : t("replay.notUsed")}</b>{t("replay.fallbackUsed")}</span>
        <span><b>{number(summary.previousSelectedEvidenceCount)}</b>{t("replay.selectedEvidence")}</span><span><b>{number(summary.previousProofGapCount)}</b>{t("replay.proofGaps")}</span>
        <span className={summary.previousSourceReviewUnlocked ? "pass" : "check"}><b>{summary.previousSourceReviewUnlocked ? t("common.unlocked") : t("common.locked")}</b>{t("replay.sourceReview")}</span>
        <span><b>{number(summary.completedGoalCount)}/{number(summary.totalGoalCount)}</b>{t("replay.completedGoals")}</span><span><b>{text(summary.currentStep)}</b>{t("replay.currentStep")}</span><span><b>{text(summary.lastResult)}</b>{t("replay.lastResult")}</span>
      </div>
      <div className="replayGoalCoachGoals">{summary.goals.map((goal) => <article key={goal.id} className={goal.status}><span>{text(goal.status)}</span><b>{text(goal.label)}</b><small>{text(goal.detail)}</small></article>)}</div>
      <small className="replayGoalCoachBoundary">{t("replay.boundary.goal")}</small>
    </section>
  );
}

function ReplayPracticeLoopPanel({ summary, campaignPacing }: { summary: ReplayPracticeLoopSummary; campaignPacing?: CampaignPacingViewModel | null }) {
  const { number, t, text } = useAppLocale();
  if (!summary.visible) return null;
  return (
    <section className={`replayPracticeLoop ${summary.activeAttempt ? "active" : ""}`} data-testid="replay-practice-loop">
      <div className="replayPracticeLoopHeader"><div><span>{t("replay.practice")}</span><strong>{summary.activeAttempt ? `${text(summary.currentPhaseLabel)} / ${t("replay.activeAttempt")}` : t("replay.readyAttempt")}</strong></div><b>{text(summary.nextAction)}</b></div>
      <div className="replayPracticeLoopStages" data-testid="replay-practice-loop-stages">{summary.stages.map((stage) => <span key={stage.id} className={stage.status}><b>{text(stage.label)}</b><small>{text(stage.status)}</small></span>)}</div>
      <div className="replayPracticeLoopMetrics">
        <span><b>{number(summary.manualEvidencePickCount)}</b>{t("replay.manualEvidencePicks")}</span><span><b>{number(summary.manualTheoryFieldCount)}</b>{t("replay.manualTheoryFields")}</span>
        <span className={summary.fallbackEvidencePickCount ? "check" : "pass"}><b>{number(summary.fallbackEvidencePickCount)}</b>{t("replay.fallbackEvidencePicks")}</span><span className={summary.fallbackTheoryFieldCount ? "check" : "pass"}><b>{number(summary.fallbackTheoryFieldCount)}</b>{t("replay.fallbackTheoryFields")}</span>
        <span className={summary.blockedGapCount ? "check" : "pass"}><b>{number(summary.blockedGapCount)}</b>{t("replay.blockedGaps")}</span><span className={summary.sourceReviewUnlocked ? "pass" : "check"}><b>{summary.sourceReviewUnlocked ? t("common.unlocked") : t("common.locked")}</b>{t("replay.sourceReview")}</span>
        <span className={summary.scorecardStatus === "completed" ? "pass" : "check"}><b>{text(summary.scorecardStatus)}</b>{t("replay.scorecard")}</span>
        <span className={summary.worldLeadOutcomeStatus === "settled" ? "pass" : summary.worldLeadOutcomeStatus === "active" ? "check" : ""}><b>{text(summary.worldLeadOutcomeStatus)}</b>{t("replay.worldLeadOutcome")}</span>
        <span className={summary.worldLeadHandoffStatus === "consumed" ? "pass" : summary.worldLeadHandoffStatus === "ready" ? "check" : ""}><b>{text(summary.worldLeadHandoffStatus)}</b>{t("replay.nextCaseHandoff")}</span>
        <span className={summary.worldArcStatus === "completed" ? "pass" : summary.worldArcStatus === "active" ? "check" : ""}><b>{text(summary.worldArcProgress)}</b>{t("replay.worldArc")}</span>
        <span className={summary.worldArcDirectiveStatus === "completed" ? "pass" : summary.worldArcDirectiveStatus === "blocked" ? "check" : ""}><b>{text(summary.worldArcDirectiveStatus)}</b>{t("replay.factionDirective")}</span>
        <span className={summary.worldPressureCascadeStatus === "consumed" ? "pass" : summary.worldPressureCascadeStatus === "active" ? "check" : ""}><b>{text(summary.worldPressureCascadeStatus)}</b>{t("replay.worldPressure")}</span>
        <span className={summary.townSocialResponseStatus === "settled" ? "pass" : summary.townSocialResponseStatus === "active" || summary.townSocialResponseStatus === "ready" ? "check" : ""}><b>{text(summary.townSocialResponseStatus)}</b>{t("replay.townReactions")}</span>
        <span className={summary.investigationOperationsStatus === "settled" ? "pass" : "check"}><b>{text(summary.investigationOperationsProgress)}</b>{t("replay.operations")}</span>
        {campaignPacing && <span><b>{text(campaignPacing.status)}</b>{t("replay.campaignPacing")}</span>}
      </div>
      <small className="replayPracticeLoopBoundary">{t("replay.boundary.loop")}</small>
    </section>
  );
}

function ManualEvidenceDrillPanel({ summary, onToggleEvidence }: { summary: ManualEvidenceDrillSummary; onToggleEvidence: (evidenceId: string) => void }) {
  const { number, t, text } = useAppLocale();
  if (!summary.visible) return null;
  const safeLabel = (label: string, fallback: string) => /\b(?:npc|evidence|event|source|ev)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(label) ? fallback : label;
  return (
    <section className="manualEvidenceDrill" data-testid="manual-evidence-drill">
      <div className="manualEvidenceDrillHeader"><div><span>{t("replay.manualEvidence")}</span><strong>{summary.readyForSubmit ? t("replay.manualPicksReady") : t("replay.manualPickFirst")}</strong></div><b>{number(summary.manualPickCount)} {t("replay.manualPicks")}</b></div>
      <div className="manualEvidenceDrillMetrics"><span><b>{number(summary.selectedEvidenceCount)}</b>{t("replay.selectedEvidence")}</span><span><b>{number(summary.routeEvidenceTargetCount)}</b>{t("replay.routeTarget")}</span><span><b>{number(summary.manualPickCount)}</b>{t("replay.manualPicks")}</span><span className={summary.remainingProofSlots ? "check" : "pass"}><b>{number(summary.remainingProofSlots)}</b>{t("replay.remainingSlots")}</span><span className={summary.readyForSubmit ? "pass" : "check"}><b>{summary.readyForSubmit ? t("common.ready") : t("replay.notReady")}</b>{t("replay.readySubmit")}</span></div>
      <div className="manualEvidenceDrillCandidates" data-testid="manual-evidence-drill-candidates">
        {summary.candidates.map((candidate) => (
          <article key={candidate.evidenceId} className={candidate.selected ? "selected" : ""}>
            <span>{candidate.selected ? t("common.selected") : t("replay.available")}</span><b>{text(candidate.title)}</b><small>{text(candidate.locationLabel)}{candidate.sourceLabel ? ` / ${text(candidate.sourceLabel)}` : ""}</small>
            <div className="manualEvidenceDrillTags">
              {candidate.supports.slice(0, 2).map((label, index) => <em key={`s:${candidate.evidenceId}:${index}`}>{t("replay.supports")}: {text(safeLabel(label, `proof lane ${index + 1}`))}</em>)}
              {candidate.contradicts.slice(0, 2).map((label, index) => <em key={`c:${candidate.evidenceId}:${index}`}>{t("replay.contradicts")}: {text(safeLabel(label, `testimony lane ${index + 1}`))}</em>)}
              {!candidate.supports.length && !candidate.contradicts.length && <em>{t("replay.routeCandidate")}</em>}
            </div>
            <button type="button" className={candidate.selected ? "secondaryButton" : "primaryButton"} data-testid={candidate.selected ? "manual-evidence-remove" : "manual-evidence-add"} onClick={() => onToggleEvidence(candidate.evidenceId)}>{candidate.selected ? t("workspace.removeTheory") : t("workspace.addTheory")}</button>
          </article>
        ))}
      </div>
      <small className="manualEvidenceDrillBoundary">{t("replay.boundary.evidence")}</small>
    </section>
  );
}

function ManualTheoryDrillPanel({ summary, onFieldChange, onApproveFallback }: { summary: ManualTheoryDrillSummary; onFieldChange: (field: "culpritId" | "motive" | "method", value: string) => void; onApproveFallback: () => void }) {
  const { number, t, text } = useAppLocale();
  if (!summary.visible) return null;
  const fallbackLabel = summary.blockedGapCount ? t("replay.fallbackUnresolved") : t("replay.fallbackRemaining");
  return (
    <section className="manualTheoryDrill" data-testid="manual-theory-drill">
      <div className="manualTheoryDrillHeader"><div><span>{t("replay.manualTheory")}</span><strong>{summary.readyForSubmit ? t("replay.manualTheoryReady") : summary.fallbackApproved ? t("replay.fallbackApproved") : t("replay.manualTheoryFirst")}</strong></div><b>{number(summary.manualFieldCount)}/3 {t("replay.manualFields")}</b></div>
      <div className="manualTheoryDrillMetrics"><span><b>{number(summary.manualFieldCount)}</b>{t("replay.manualFields")}</span><span className={summary.remainingFieldCount ? "check" : "pass"}><b>{number(summary.remainingFieldCount)}</b>{t("replay.remainingFields")}</span><span className={summary.fallbackFieldCount ? "check" : "pass"}><b>{number(summary.fallbackFieldCount)}</b>{t("replay.fallbackTheoryFields")}</span><span className={summary.blockedGapCount ? "check" : "pass"}><b>{number(summary.blockedGapCount)}</b>{t("replay.blockedGaps")}</span><span className={summary.evidenceReady ? "pass" : "check"}><b>{summary.evidenceReady ? t("common.ready") : t("replay.notReady")}</b>{t("replay.evidenceReady")}</span><span className={summary.readyForSubmit || summary.fallbackApproved ? "pass" : "check"}><b>{summary.readyForSubmit || summary.fallbackApproved ? t("common.ready") : t("replay.notReady")}</b>{t("replay.readySubmit")}</span></div>
      <div className="manualTheoryDrillForm">
        <label>{t("workspace.suspectHypothesis")}<select name="manual-theory-suspect" autoComplete="off" data-testid="manual-theory-culprit" value={summary.selectedCulpritId} onChange={(event) => onFieldChange("culpritId", event.target.value)}><option value="">{t("workspace.chooseSuspect")}</option>{summary.suspectOptions.map((option) => <option key={option.id} value={option.id}>{text(option.label)}</option>)}</select></label>
        <label>{t("workspace.motiveHypothesis")}<textarea name="manual-theory-motive" autoComplete="off" data-testid="manual-theory-motive" placeholder={t("workspace.motivePlaceholder")} value={summary.motiveText} onChange={(event) => onFieldChange("motive", event.target.value)} /></label>
        <label>{t("workspace.methodHypothesis")}<textarea name="manual-theory-method" autoComplete="off" data-testid="manual-theory-method" placeholder={t("workspace.methodPlaceholder")} value={summary.methodText} onChange={(event) => onFieldChange("method", event.target.value)} /></label>
      </div>
      <div className="manualTheoryDrillPrompts" data-testid="manual-theory-evidence-prompts">{summary.evidencePrompts.map((prompt, index) => <article key={`${prompt.title}:${index}`}><span>{t("replay.discoveredClue")}</span><b>{text(prompt.title)}</b><small>{text(prompt.detail)}</small><div>{prompt.supportLabels.map((label, labelIndex) => <em key={`${prompt.title}:${labelIndex}`}>{text(label)}</em>)}</div></article>)}</div>
      <button type="button" className="secondaryButton" data-testid="manual-theory-fallback" onClick={onApproveFallback} disabled={summary.fallbackApproved || (!summary.remainingFieldCount && !summary.blockedGapCount)}>{summary.fallbackApproved ? t("replay.explicitApproved") : fallbackLabel}</button>
      <small className="manualTheoryDrillBoundary">{t("replay.boundary.theory")}</small>
    </section>
  );
}

function ReplayAttemptScorecardPanel({ summary }: { summary: ReplayAttemptScorecardSummary }) {
  const { number, t, text } = useAppLocale();
  if (!summary.visible) return null;
  return (
    <section className={`replayAttemptScorecard ${summary.status}`} data-testid="replay-attempt-scorecard">
      <div className="replayAttemptScorecardHeader"><div><span>{t("replay.scorecard")}</span><strong>{summary.status === "completed" ? t("replay.completedDelta") : t("replay.pendingDelta")}</strong></div><b>{summary.activeAttempt ? t("replay.activeAttempt") : t("replay.waitingAttempt")}</b></div>
      <div className="replayAttemptScorecardMetrics">
        <span><b>{text(summary.currentStep)}</b>{t("replay.currentStep")}</span><span><b>{number(summary.completedGuidedSteps)}</b>{t("replay.guidedSteps")}</span><span className={summary.fallbackUsed ? "check" : "pass"}><b>{summary.fallbackUsed ? t("replay.used") : t("replay.notUsed")}</b>{t("replay.fallback")}</span><span><b>{number(summary.selectedEvidenceCount)}</b>{t("replay.selectedEvidence")}</span><span><b>{number(summary.manualEvidencePickCount)}</b>{t("replay.manualPicks")}</span>
        <span className={summary.fallbackEvidencePickCount ? "check" : "pass"}><b>{number(summary.fallbackEvidencePickCount)}</b>{t("replay.fallbackEvidencePicks")}</span><span><b>{number(summary.manualTheoryFieldCount)}</b>{t("replay.manualTheoryFields")}</span><span className={summary.fallbackTheoryFieldCount ? "check" : "pass"}><b>{number(summary.fallbackTheoryFieldCount)}</b>{t("replay.fallbackTheoryFields")}</span><span className={summary.blockedTheoryGapCount ? "check" : "pass"}><b>{number(summary.blockedTheoryGapCount)}</b>{t("replay.blockedGaps")}</span><span><b>{number(summary.proofGapCount)}</b>{t("replay.proofGaps")}</span>
        <span className={summary.sourceReviewUnlocked ? "pass" : "check"}><b>{summary.sourceReviewUnlocked ? t("common.unlocked") : t("common.locked")}</b>{t("replay.sourceReview")}</span><span className={summary.worldLeadOutcomeStatus === "settled" ? "pass" : summary.worldLeadOutcomeStatus === "active" ? "check" : ""}><b>{text(summary.worldLeadOutcomeStatus)}</b>{t("replay.worldLeadOutcome")}</span><span className={summary.worldLeadHandoffStatus === "consumed" ? "pass" : summary.worldLeadHandoffStatus === "ready" ? "check" : ""}><b>{text(summary.worldLeadHandoffStatus)}</b>{t("replay.nextCaseHandoff")}</span><span className={summary.worldArcStatus === "completed" ? "pass" : summary.worldArcStatus === "active" ? "check" : ""}><b>{text(summary.worldArcProgress)}</b>{t("replay.worldArc")}</span><span className={summary.worldArcDirectiveStatus === "completed" ? "pass" : summary.worldArcDirectiveStatus === "blocked" ? "check" : ""}><b>{text(summary.worldArcDirectiveStatus)}</b>{t("replay.factionDirective")}</span><span className={summary.worldPressureCascadeStatus === "consumed" ? "pass" : summary.worldPressureCascadeStatus === "active" ? "check" : ""}><b>{text(summary.worldPressureCascadeStatus)}</b>{t("replay.worldPressure")}</span><span className={summary.townSocialResponseStatus === "settled" ? "pass" : summary.townSocialResponseStatus === "active" || summary.townSocialResponseStatus === "ready" ? "check" : ""}><b>{text(summary.townSocialResponseStatus)}</b>{t("replay.townReactions")}</span><span className={summary.investigationOperationsStatus === "settled" ? "pass" : "check"}><b>{text(summary.investigationOperationsProgress)}</b>{t("replay.operations")}</span><span><b>{number(summary.completedReplayGoals)}/{number(summary.totalReplayGoals)}</b>{t("replay.replayGoals")}</span><span><b>{text(summary.lastResult)}</b>{t("replay.lastResult")}</span>
      </div>
      <div className="replayAttemptScorecardRows">{summary.rows.map((row) => <article key={row.id} className={row.status}><span>{text(row.status)}</span><b>{text(row.label)}</b><small>{t("replay.previous")}: {text(row.previous)}</small><small>{t("replay.current")}: {text(row.current)}</small><em>{text(row.detail)}</em></article>)}</div>
      <small className="replayAttemptScorecardBoundary">{t("replay.boundary.scorecard")}</small>
    </section>
  );
}

export function InvestigationDebriefReplaySurface({
  commandDeckMode = false, campaignPacing, solvedCaseDebrief, replayPracticeLoop, replayGoalCoach, manualEvidenceDrill,
  toggleManualEvidenceDrillEvidence, manualTheoryDrill, updateManualTheoryDrillField,
  approveManualTheoryFallback, replayAttemptScorecard, startReplayGoalAttempt
}: {
  commandDeckMode?: boolean;
  campaignPacing?: CampaignPacingViewModel | null;
  solvedCaseDebrief?: SolvedCaseDebriefSummary | null;
  replayPracticeLoop?: ReplayPracticeLoopSummary | null;
  replayGoalCoach?: ReplayGoalCoachSummary | null;
  manualEvidenceDrill?: ManualEvidenceDrillSummary | null;
  toggleManualEvidenceDrillEvidence?: (evidenceId: string) => void;
  manualTheoryDrill?: ManualTheoryDrillSummary | null;
  updateManualTheoryDrillField?: (field: "culpritId" | "motive" | "method", value: string) => void;
  approveManualTheoryFallback?: () => void;
  replayAttemptScorecard?: ReplayAttemptScorecardSummary | null;
  startReplayGoalAttempt?: () => void;
}) {
  const { t } = useAppLocale();
  return (
    <CommandDeckCollapsible enabled={commandDeckMode} title={t("replay.debriefReplay")}>
      {solvedCaseDebrief && <SolvedCaseDebriefPanel summary={solvedCaseDebrief} campaignPacing={campaignPacing} />}
      {replayPracticeLoop && <ReplayPracticeLoopPanel summary={replayPracticeLoop} campaignPacing={campaignPacing} />}
      {replayGoalCoach && startReplayGoalAttempt && <ReplayGoalCoachPanel summary={replayGoalCoach} onStartReplay={startReplayGoalAttempt} />}
      {manualEvidenceDrill && toggleManualEvidenceDrillEvidence && <ManualEvidenceDrillPanel summary={manualEvidenceDrill} onToggleEvidence={toggleManualEvidenceDrillEvidence} />}
      {manualTheoryDrill && updateManualTheoryDrillField && approveManualTheoryFallback && <ManualTheoryDrillPanel summary={manualTheoryDrill} onFieldChange={updateManualTheoryDrillField} onApproveFallback={approveManualTheoryFallback} />}
      {replayAttemptScorecard && <ReplayAttemptScorecardPanel summary={replayAttemptScorecard} />}
    </CommandDeckCollapsible>
  );
}
