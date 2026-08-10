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

function SolvedCaseDebriefPanel({ summary, campaignPacing }: { summary: SolvedCaseDebriefSummary; campaignPacing?: CampaignPacingViewModel | null }) {
  if (!summary.accepted) return null;
  const coverageLabel = summary.totalObligations ? `${summary.coveredObligations}/${summary.totalObligations}` : `${summary.coveredObligations}`;
  return (
    <section className="solvedCaseDebrief" data-testid="solved-case-debrief">
      <div className="solvedCaseDebriefHeader"><div><span>Solved Case Debrief</span><strong>investigation completed / accepted</strong></div><b>{summary.sourceReviewUnlocked ? "source review unlocked" : "source review locked"}</b></div>
      <div className="solvedCaseDebriefMetrics">
        <span className="pass"><b>{summary.manualStepsCompleted}/{summary.totalManualSteps}</b>manual guided steps</span>
        <span className={summary.fallbackUsed ? "check" : "pass"}><b>{summary.fallbackUsed ? "used" : "not used"}</b>certified fallback</span>
        <span><b>{summary.selectedEvidenceCount}</b>selected evidence</span><span><b>{summary.challengeHitCount}</b>challenge hits</span><span><b>{coverageLabel}</b>covered obligations</span>
        <span className={summary.proofGapCount ? "check" : "pass"}><b>{summary.proofGapCount}</b>proof gaps</span>
        <span className={summary.worldLeadOutcomeStatus === "settled" ? "pass" : "check"}><b>{summary.worldLeadOutcomeStatus}</b>world lead outcome</span>
        <span className={summary.worldLeadHandoffStatus === "consumed" ? "pass" : "check"}><b>{summary.worldLeadHandoffStatus}</b>next-case handoff</span>
        <span className={summary.worldArcStatus === "completed" ? "pass" : "check"}><b>{summary.worldArcProgress}</b>world arc</span>
        <span className={summary.worldArcDirectiveStatus === "completed" ? "pass" : summary.worldArcDirectiveStatus === "blocked" ? "check" : ""}><b>{summary.worldArcDirectiveStatus}</b>faction directive</span>
        <span className={summary.worldPressureCascadeStatus === "consumed" ? "pass" : summary.worldPressureCascadeStatus === "active" ? "check" : ""}><b>{summary.worldPressureCascadeStatus}</b>world pressure</span>
        <span className={summary.townSocialResponseStatus === "settled" ? "pass" : summary.townSocialResponseStatus === "active" || summary.townSocialResponseStatus === "ready" ? "check" : ""}><b>{summary.townSocialResponseStatus}</b>town reactions</span>
        <span className={summary.investigationOperationsStatus === "settled" ? "pass" : "check"}><b>{summary.investigationOperationsProgress}</b>operations / {summary.investigationOperationsTime}</span>
      </div>
      <div className="solvedCaseDebriefSections">
        <article><span>Player Route</span><b>Seven-step route completed</b><small>Last guided result: {summary.lastStepResult || "accepted"}. Join, Search, Question, Challenge, Select Evidence, Submit, and Review Source are closed.</small></article>
        <article><span>Evidence Closure</span><b>{summary.selectedEvidenceCount} selected proof clue(s)</b><small>{coverageLabel} proof obligation(s) covered with {summary.proofGapCount} public gap(s) remaining.</small></article>
        <article><span>Source Confidence</span><b>{summary.sourceEventCount} source events / {summary.memoryCount} memories</b><small>{summary.routeStepCount} certified route step(s) and {summary.challengeHitCount} challenge hit(s) support the accepted theory.</small></article>
        <article><span>Next Replay Goal</span><b>{summary.fallbackUsed ? "Reduce certified fallback use" : "Try a more manual replay"}</b><small>Replay with fewer guided clicks, choose evidence manually, and use the journal to compare route confidence without exposing hidden truth.</small></article>
        <article><span>Investigation Operations</span><b>{summary.investigationOperationsStatus} / {summary.investigationOperationsSupport} support</b><small>{summary.investigationOperationsProgress} certified lanes resolved in {summary.investigationOperationsTime}; costs and tempo never changed case proof.</small></article>
        <article><span>World Lead Outcome</span><b>{summary.worldLeadOutcomeStatus === "settled" ? "bounded effect settled" : summary.worldLeadOutcomeStatus === "active" ? "bounded effect active" : "not used"}</b><small>World state effects stay low-spoiler, reversible, and separate from the certified evidence route.</small></article>
        <article><span>Next Case Handoff</span><b>{summary.worldLeadHandoffStatus === "ready" ? "follow-up ready" : summary.worldLeadHandoffStatus === "consumed" ? "follow-up carried" : "not used"}</b><small>The one-time queue preference never changes the next case's fair-play route or candidate legality.</small></article>
        <article><span>Case-Scoped World Arc</span><b>{summary.worldArcStatus === "completed" ? "world line completed" : summary.worldArcStatus === "active" ? "world line active" : "not used"}</b><small>{summary.worldArcProgress} stages recorded through followed leads and accepted theories.</small></article>
        <article><span>Faction Directive</span><b>{summary.worldArcDirectiveStatus}</b><small>The selected Support or Contain response uses the existing institution and multi-tick action cycle.</small></article>
        <article><span>World Pressure Cascade</span><b>{summary.worldPressureCascadeStatus}</b><small>Completed world action pressure only influences future candidate ordering and is consumed one layer at a time.</small></article>
        <article><span>Town Social Response</span><b>{summary.townSocialResponseStatus}</b><small>Named public reactions remain ambient presentation and never enter case proof, memory testimony, or action authority.</small></article>
        {campaignPacing && <article data-testid="debrief-campaign-pacing"><span>Campaign Pacing</span><b>{campaignPacing.status} / {campaignPacing.value.primarySurface}</b><small>{campaignPacing.safeForecast.whatChanges} {campaignPacing.safeForecast.unchangedAuthority}</small></article>}
      </div>
      <small className="solvedCaseDebriefBoundary">Low-spoiler solved-case summary only: no hidden truth, raw bodies, internal ids, source ids, public catalog writes, dataset refreshes, or SQLite schema changes.</small>
    </section>
  );
}

function ReplayGoalCoachPanel({ summary, onStartReplay }: { summary: ReplayGoalCoachSummary; onStartReplay: () => void }) {
  if (!summary.visible) return null;
  return (
    <section className={`replayGoalCoach ${summary.activeAttempt ? "active" : ""}`} data-testid="replay-goal-coach">
      <div className="replayGoalCoachHeader"><div><span>Replay Goal Coach</span><strong>{summary.activeAttempt ? "replay attempt active" : "ready for replay practice"}</strong></div><button type="button" className="primaryButton" data-testid="start-replay-attempt" onClick={onStartReplay}>Start Replay Attempt</button></div>
      <div className="replayGoalCoachMetrics">
        <span><b>{summary.previousGuidedSteps}</b>previous guided steps</span><span className={summary.previousFallbackUsed ? "check" : "pass"}><b>{summary.previousFallbackUsed ? "used" : "not used"}</b>fallback used</span>
        <span><b>{summary.previousSelectedEvidenceCount}</b>selected evidence</span><span><b>{summary.previousProofGapCount}</b>proof gaps</span>
        <span className={summary.previousSourceReviewUnlocked ? "pass" : "check"}><b>{summary.previousSourceReviewUnlocked ? "unlocked" : "locked"}</b>source review</span>
        <span><b>{summary.completedGoalCount}/{summary.totalGoalCount}</b>completed replay goals</span><span><b>{summary.currentStep}</b>current step</span><span><b>{summary.lastResult}</b>last result</span>
      </div>
      <div className="replayGoalCoachGoals">{summary.goals.map((goal) => <article key={goal.id} className={goal.status}><span>{goal.status}</span><b>{goal.label}</b><small>{goal.detail}</small></article>)}</div>
      <small className="replayGoalCoachBoundary">Session-local replay practice only: no hidden truth, raw bodies, internal ids, source ids, public catalog writes, dataset refreshes, or SQLite schema changes.</small>
    </section>
  );
}

function ReplayPracticeLoopPanel({ summary, campaignPacing }: { summary: ReplayPracticeLoopSummary; campaignPacing?: CampaignPacingViewModel | null }) {
  if (!summary.visible) return null;
  return (
    <section className={`replayPracticeLoop ${summary.activeAttempt ? "active" : ""}`} data-testid="replay-practice-loop">
      <div className="replayPracticeLoopHeader"><div><span>Replay Practice Loop</span><strong>{summary.activeAttempt ? `${summary.currentPhaseLabel} / active attempt` : "ready for replay attempt"}</strong></div><b>{summary.nextAction}</b></div>
      <div className="replayPracticeLoopStages" data-testid="replay-practice-loop-stages">{summary.stages.map((stage) => <span key={stage.id} className={stage.status}><b>{stage.label}</b><small>{stage.status}</small></span>)}</div>
      <div className="replayPracticeLoopMetrics">
        <span><b>{summary.manualEvidencePickCount}</b>manual evidence picks</span><span><b>{summary.manualTheoryFieldCount}</b>manual theory fields</span>
        <span className={summary.fallbackEvidencePickCount ? "check" : "pass"}><b>{summary.fallbackEvidencePickCount}</b>fallback evidence picks</span><span className={summary.fallbackTheoryFieldCount ? "check" : "pass"}><b>{summary.fallbackTheoryFieldCount}</b>fallback theory fields</span>
        <span className={summary.blockedGapCount ? "check" : "pass"}><b>{summary.blockedGapCount}</b>blocked gaps</span><span className={summary.sourceReviewUnlocked ? "pass" : "check"}><b>{summary.sourceReviewUnlocked ? "unlocked" : "locked"}</b>source review</span>
        <span className={summary.scorecardStatus === "completed" ? "pass" : "check"}><b>{summary.scorecardStatus}</b>scorecard</span>
        <span className={summary.worldLeadOutcomeStatus === "settled" ? "pass" : summary.worldLeadOutcomeStatus === "active" ? "check" : ""}><b>{summary.worldLeadOutcomeStatus}</b>world lead outcome</span>
        <span className={summary.worldLeadHandoffStatus === "consumed" ? "pass" : summary.worldLeadHandoffStatus === "ready" ? "check" : ""}><b>{summary.worldLeadHandoffStatus}</b>next-case handoff</span>
        <span className={summary.worldArcStatus === "completed" ? "pass" : summary.worldArcStatus === "active" ? "check" : ""}><b>{summary.worldArcProgress}</b>world arc</span>
        <span className={summary.worldArcDirectiveStatus === "completed" ? "pass" : summary.worldArcDirectiveStatus === "blocked" ? "check" : ""}><b>{summary.worldArcDirectiveStatus}</b>faction directive</span>
        <span className={summary.worldPressureCascadeStatus === "consumed" ? "pass" : summary.worldPressureCascadeStatus === "active" ? "check" : ""}><b>{summary.worldPressureCascadeStatus}</b>world pressure</span>
        <span className={summary.townSocialResponseStatus === "settled" ? "pass" : summary.townSocialResponseStatus === "active" || summary.townSocialResponseStatus === "ready" ? "check" : ""}><b>{summary.townSocialResponseStatus}</b>town reactions</span>
        <span className={summary.investigationOperationsStatus === "settled" ? "pass" : "check"}><b>{summary.investigationOperationsProgress}</b>investigation operations</span>
        {campaignPacing && <span><b>{campaignPacing.status}</b>campaign pacing</span>}
      </div>
      <small className="replayPracticeLoopBoundary">Manual First practice loop only: aggregate counts, phase labels, and next action. No player text, hidden truth, raw bodies, internal ids, source ids, public catalog writes, dataset refreshes, or runtime scoring changes.</small>
    </section>
  );
}

function ManualEvidenceDrillPanel({ summary, onToggleEvidence }: { summary: ManualEvidenceDrillSummary; onToggleEvidence: (evidenceId: string) => void }) {
  if (!summary.visible) return null;
  const safeLabel = (label: string, fallback: string) => /\b(?:npc|evidence|event|source|ev)-[a-z0-9-]*\d[a-z0-9-]*\b/i.test(label) ? fallback : label;
  return (
    <section className="manualEvidenceDrill" data-testid="manual-evidence-drill">
      <div className="manualEvidenceDrillHeader"><div><span>Manual Evidence Drill</span><strong>{summary.readyForSubmit ? "manual picks ready for submit" : "manual pick first"}</strong></div><b>{summary.manualPickCount} manual pick(s)</b></div>
      <div className="manualEvidenceDrillMetrics"><span><b>{summary.selectedEvidenceCount}</b>selected evidence</span><span><b>{summary.routeEvidenceTargetCount}</b>route target count</span><span><b>{summary.manualPickCount}</b>manual picks</span><span className={summary.remainingProofSlots ? "check" : "pass"}><b>{summary.remainingProofSlots}</b>remaining proof slots</span><span className={summary.readyForSubmit ? "pass" : "check"}><b>{summary.readyForSubmit ? "ready" : "not ready"}</b>ready for submit</span></div>
      <div className="manualEvidenceDrillCandidates" data-testid="manual-evidence-drill-candidates">
        {summary.candidates.map((candidate) => (
          <article key={candidate.evidenceId} className={candidate.selected ? "selected" : ""}>
            <span>{candidate.selected ? "selected" : "available"}</span><b>{candidate.title}</b><small>{candidate.locationLabel}{candidate.sourceLabel ? ` / ${candidate.sourceLabel}` : ""}</small>
            <div className="manualEvidenceDrillTags">
              {candidate.supports.slice(0, 2).map((label, index) => <em key={`s:${candidate.evidenceId}:${index}`}>supports: {safeLabel(label, `proof lane ${index + 1}`)}</em>)}
              {candidate.contradicts.slice(0, 2).map((label, index) => <em key={`c:${candidate.evidenceId}:${index}`}>contradicts: {safeLabel(label, `testimony lane ${index + 1}`)}</em>)}
              {!candidate.supports.length && !candidate.contradicts.length && <em>route evidence candidate</em>}
            </div>
            <button type="button" className={candidate.selected ? "secondaryButton" : "primaryButton"} data-testid={candidate.selected ? "manual-evidence-remove" : "manual-evidence-add"} onClick={() => onToggleEvidence(candidate.evidenceId)}>{candidate.selected ? "Remove from Theory" : "Add to Theory"}</button>
          </article>
        ))}
      </div>
      <small className="manualEvidenceDrillBoundary">Manual pick first: browser/session-local theory evidence only. No hidden truth, raw bodies, internal ids, source ids, public catalog writes, dataset refreshes, SQLite schema changes, or runtime scoring changes.</small>
    </section>
  );
}

function ManualTheoryDrillPanel({ summary, onFieldChange, onApproveFallback }: { summary: ManualTheoryDrillSummary; onFieldChange: (field: "culpritId" | "motive" | "method", value: string) => void; onApproveFallback: () => void }) {
  if (!summary.visible) return null;
  const fallbackLabel = summary.blockedGapCount ? "Use Explicit Fallback for Unresolved Fields" : "Use Explicit Fallback for Remaining Fields";
  return (
    <section className="manualTheoryDrill" data-testid="manual-theory-drill">
      <div className="manualTheoryDrillHeader"><div><span>Manual Theory Drill</span><strong>{summary.readyForSubmit ? "manual theory ready" : summary.fallbackApproved ? "certified fallback approved" : "manual theory first"}</strong></div><b>{summary.manualFieldCount}/3 manual field(s)</b></div>
      <div className="manualTheoryDrillMetrics"><span><b>{summary.manualFieldCount}</b>manual fields</span><span className={summary.remainingFieldCount ? "check" : "pass"}><b>{summary.remainingFieldCount}</b>remaining fields</span><span className={summary.fallbackFieldCount ? "check" : "pass"}><b>{summary.fallbackFieldCount}</b>fallback fields</span><span className={summary.blockedGapCount ? "check" : "pass"}><b>{summary.blockedGapCount}</b>blocked gaps</span><span className={summary.evidenceReady ? "pass" : "check"}><b>{summary.evidenceReady ? "ready" : "not ready"}</b>evidence ready</span><span className={summary.readyForSubmit || summary.fallbackApproved ? "pass" : "check"}><b>{summary.readyForSubmit || summary.fallbackApproved ? "ready" : "not ready"}</b>ready for submit</span></div>
      <div className="manualTheoryDrillForm">
        <label>Suspect hypothesis<select data-testid="manual-theory-culprit" value={summary.selectedCulpritId} onChange={(event) => onFieldChange("culpritId", event.target.value)}><option value="">Choose a suspect</option>{summary.suspectOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <label>Motive hypothesis<textarea data-testid="manual-theory-motive" placeholder="Explain the pressure or conflict supported by discovered clues." value={summary.motiveText} onChange={(event) => onFieldChange("motive", event.target.value)} /></label>
        <label>Method hypothesis<textarea data-testid="manual-theory-method" placeholder="Explain the means and scene mechanism supported by discovered clues." value={summary.methodText} onChange={(event) => onFieldChange("method", event.target.value)} /></label>
      </div>
      <div className="manualTheoryDrillPrompts" data-testid="manual-theory-evidence-prompts">{summary.evidencePrompts.map((prompt, index) => <article key={`${prompt.title}:${index}`}><span>discovered clue</span><b>{prompt.title}</b><small>{prompt.detail}</small><div>{prompt.supportLabels.map((label, labelIndex) => <em key={`${prompt.title}:${labelIndex}`}>{label}</em>)}</div></article>)}</div>
      <button type="button" className="secondaryButton" data-testid="manual-theory-fallback" onClick={onApproveFallback} disabled={summary.fallbackApproved || (!summary.remainingFieldCount && !summary.blockedGapCount)}>{summary.fallbackApproved ? "Explicit Fallback Approved" : fallbackLabel}</button>
      <small className="manualTheoryDrillBoundary">Evidence-guided free text only. Certified values stay internal and are never copied into visible fields. No hidden truth, raw bodies, internal ids, source ids, public writes, dataset refreshes, or runtime scoring changes.</small>
    </section>
  );
}

function ReplayAttemptScorecardPanel({ summary }: { summary: ReplayAttemptScorecardSummary }) {
  if (!summary.visible) return null;
  return (
    <section className={`replayAttemptScorecard ${summary.status}`} data-testid="replay-attempt-scorecard">
      <div className="replayAttemptScorecardHeader"><div><span>Replay Attempt Scorecard</span><strong>{summary.status === "completed" ? "completed replay delta" : "pending replay delta"}</strong></div><b>{summary.activeAttempt ? "attempt active" : "waiting for attempt"}</b></div>
      <div className="replayAttemptScorecardMetrics">
        <span><b>{summary.currentStep}</b>current step</span><span><b>{summary.completedGuidedSteps}</b>guided steps</span><span className={summary.fallbackUsed ? "check" : "pass"}><b>{summary.fallbackUsed ? "used" : "not used"}</b>fallback</span><span><b>{summary.selectedEvidenceCount}</b>selected evidence</span><span><b>{summary.manualEvidencePickCount}</b>manual picks</span>
        <span className={summary.fallbackEvidencePickCount ? "check" : "pass"}><b>{summary.fallbackEvidencePickCount}</b>fallback picks</span><span><b>{summary.manualTheoryFieldCount}</b>manual theory fields</span><span className={summary.fallbackTheoryFieldCount ? "check" : "pass"}><b>{summary.fallbackTheoryFieldCount}</b>fallback theory fields</span><span className={summary.blockedTheoryGapCount ? "check" : "pass"}><b>{summary.blockedTheoryGapCount}</b>blocked theory gaps</span><span><b>{summary.proofGapCount}</b>proof gaps</span>
        <span className={summary.sourceReviewUnlocked ? "pass" : "check"}><b>{summary.sourceReviewUnlocked ? "unlocked" : "locked"}</b>source review</span><span className={summary.worldLeadOutcomeStatus === "settled" ? "pass" : summary.worldLeadOutcomeStatus === "active" ? "check" : ""}><b>{summary.worldLeadOutcomeStatus}</b>world lead outcome</span><span className={summary.worldLeadHandoffStatus === "consumed" ? "pass" : summary.worldLeadHandoffStatus === "ready" ? "check" : ""}><b>{summary.worldLeadHandoffStatus}</b>next-case handoff</span><span className={summary.worldArcStatus === "completed" ? "pass" : summary.worldArcStatus === "active" ? "check" : ""}><b>{summary.worldArcProgress}</b>world arc</span><span className={summary.worldArcDirectiveStatus === "completed" ? "pass" : summary.worldArcDirectiveStatus === "blocked" ? "check" : ""}><b>{summary.worldArcDirectiveStatus}</b>faction directive</span><span className={summary.worldPressureCascadeStatus === "consumed" ? "pass" : summary.worldPressureCascadeStatus === "active" ? "check" : ""}><b>{summary.worldPressureCascadeStatus}</b>world pressure</span><span className={summary.townSocialResponseStatus === "settled" ? "pass" : summary.townSocialResponseStatus === "active" || summary.townSocialResponseStatus === "ready" ? "check" : ""}><b>{summary.townSocialResponseStatus}</b>town reactions</span><span className={summary.investigationOperationsStatus === "settled" ? "pass" : "check"}><b>{summary.investigationOperationsProgress}</b>investigation operations</span><span><b>{summary.completedReplayGoals}/{summary.totalReplayGoals}</b>replay goals</span><span><b>{summary.lastResult}</b>last result</span>
      </div>
      <div className="replayAttemptScorecardRows">{summary.rows.map((row) => <article key={row.id} className={row.status}><span>{row.status}</span><b>{row.label}</b><small>Previous: {row.previous}</small><small>Current: {row.current}</small><em>{row.detail}</em></article>)}</div>
      <small className="replayAttemptScorecardBoundary">Descriptive session-local delta only: no score, no pass gate, no hidden truth, raw bodies, internal ids, source ids, public catalog writes, dataset refreshes, or runtime scoring changes.</small>
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
  return (
    <CommandDeckCollapsible enabled={commandDeckMode} title="Debrief and replay">
      {solvedCaseDebrief && <SolvedCaseDebriefPanel summary={solvedCaseDebrief} campaignPacing={campaignPacing} />}
      {replayPracticeLoop && <ReplayPracticeLoopPanel summary={replayPracticeLoop} campaignPacing={campaignPacing} />}
      {replayGoalCoach && startReplayGoalAttempt && <ReplayGoalCoachPanel summary={replayGoalCoach} onStartReplay={startReplayGoalAttempt} />}
      {manualEvidenceDrill && toggleManualEvidenceDrillEvidence && <ManualEvidenceDrillPanel summary={manualEvidenceDrill} onToggleEvidence={toggleManualEvidenceDrillEvidence} />}
      {manualTheoryDrill && updateManualTheoryDrillField && approveManualTheoryFallback && <ManualTheoryDrillPanel summary={manualTheoryDrill} onFieldChange={updateManualTheoryDrillField} onApproveFallback={approveManualTheoryFallback} />}
      {replayAttemptScorecard && <ReplayAttemptScorecardPanel summary={replayAttemptScorecard} />}
    </CommandDeckCollapsible>
  );
}
