"use client";

import {
  CAMPAIGN_STUDY_CONFUSIONS,
  CAMPAIGN_STUDY_FINALE_RATINGS,
  CAMPAIGN_STUDY_REPLAY_INTENTS,
  type CampaignStudyAssessment,
  type CampaignStudyConfusion,
  type CampaignStudyOperationsState,
  type CampaignStudyRun,
} from "@/lib/campaign-comprehension-study";

type CampaignStudyRecorderProps = {
  runs: CampaignStudyRun[];
  currentRun?: CampaignStudyRun;
  operations: CampaignStudyOperationsState;
  elapsedSeconds: number;
  canStart: boolean;
  startBlockedReason: string;
  start: () => boolean;
  abandon: () => void;
  finalize: () => boolean;
  exportStudy: () => void;
  reset: () => void;
  incrementMisunderstanding: () => void;
  toggleConfusion: (confusion: CampaignStudyConfusion) => void;
  updateAssessment: (assessment: Partial<CampaignStudyAssessment>) => void;
};

const labelFor = (value: string) => value.split("-").map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(" ");

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function CampaignStudyRecorder(props: CampaignStudyRecorderProps) {
  const run = props.currentRun;
  const officialCount = props.operations.eligibleOfficialCount;
  const pilotCount = props.operations.completedPilotCount;
  const canFinalize = Boolean(
    run?.status === "awaiting-assessment"
      && run.assessment.finaleExplanation !== "not-assessed"
      && run.assessment.replayIntent !== "not-assessed"
  );

  return (
    <details className="campaignStudyRecorder" data-testid="campaign-study-recorder">
      <summary>
        <span>Campaign Study Recorder</span>
        <small>{run ? `${labelFor(run.status)} / run ${run.ordinal}` : `${officialCount}/8 eligible official`}</small>
      </summary>
      <div className="campaignStudyBody">
        <div className="campaignStudyNotice">
          <strong>Browser-local comprehension baseline</strong>
          <p>Stores at most 16 anonymous summaries in this browser. It never records names, timestamps, device data, internal IDs, selected answers, player text, event sequences, source bodies, or hidden truth.</p>
        </div>

        {!run && (
          <div className="campaignStudySetup">
            {props.operations.nextSlot && (
              <div className="campaignStudyNextSlot" data-testid="campaign-study-next-slot">
                <small>Required next slot</small>
                <strong>{props.operations.nextSlot.id}</strong>
                <span>{labelFor(props.operations.nextSlot.protocol)} · {labelFor(props.operations.nextSlot.cohort)} · {labelFor(props.operations.nextSlot.scenario)}</span>
              </div>
            )}
            <p className="campaignStudyHint">Fixed progress: {pilotCount}/2 pilots completed · {officialCount}/8 eligible official attempts.</p>
            <button
              data-testid="campaign-study-start"
              type="button"
              disabled={!props.canStart}
              onClick={props.start}
            >
              {props.operations.nextSlot ? `Start ${props.operations.nextSlot.id}` : "Study slots complete"}
            </button>
            {!props.canStart && <p className="campaignStudyHint">{props.startBlockedReason}</p>}
          </div>
        )}

        {run && (
          <>
            <div className="campaignStudyMetrics" aria-live="polite">
              <span><small>Stage</small><strong data-testid="campaign-study-stage">{labelFor(run.currentStage)}</strong></span>
              <span><small>Elapsed</small><strong data-testid="campaign-study-elapsed">{formatDuration(props.elapsedSeconds)}</strong></span>
              <span><small>First action</small><strong data-testid="campaign-study-first-action">{run.firstMeaningfulActionSeconds === undefined ? "Waiting" : formatDuration(run.firstMeaningfulActionSeconds)}</strong></span>
              <span><small>Recovery</small><strong>{run.recoveryStartedCount}/{run.recoveryShownCount} started</strong></span>
              <span><small>Assistance</small><strong>{run.guidedStepUseCount} guided / {run.explicitFallbackUseCount} fallback</strong></span>
              <span><small>Run</small><strong>{labelFor(run.cohort)} / {labelFor(run.scenario)}</strong></span>
            </div>

            <fieldset className="campaignStudyAssessment">
              <legend>Moderator marks</legend>
              <div className="campaignStudyAssessmentLine">
                <span>Main-objective misunderstandings: <strong>{run.assessment.primaryActionMisunderstandingCount}</strong></span>
                <button data-testid="campaign-study-misunderstanding" type="button" onClick={props.incrementMisunderstanding}>+1</button>
              </div>
              <div className="campaignStudyChecks">
                {CAMPAIGN_STUDY_CONFUSIONS.map((confusion) => (
                  <label key={confusion}>
                    <input
                      type="checkbox"
                      checked={run.assessment.confusionCategories.includes(confusion)}
                      onChange={() => props.toggleConfusion(confusion)}
                    />
                    {labelFor(confusion)}
                  </label>
                ))}
              </div>
              <label className="campaignStudyPrompted">
                <input
                  data-testid="campaign-study-recovery-prompted"
                  type="checkbox"
                  checked={run.assessment.recoveryPrompted}
                  onChange={(event) => props.updateAssessment({ recoveryPrompted: event.target.checked })}
                />
                Moderator prompted Recovery
              </label>
              <div className="campaignStudyAssessmentSelects">
                <label>
                  Finale explanation
                  <select
                    data-testid="campaign-study-finale-rating"
                    value={run.assessment.finaleExplanation}
                    onChange={(event) => props.updateAssessment({ finaleExplanation: event.target.value as CampaignStudyAssessment["finaleExplanation"] })}
                  >
                    {CAMPAIGN_STUDY_FINALE_RATINGS.map((value) => <option key={value} value={value}>{labelFor(value)}</option>)}
                  </select>
                </label>
                <label>
                  Replay intent
                  <select
                    data-testid="campaign-study-replay-intent"
                    value={run.assessment.replayIntent}
                    onChange={(event) => props.updateAssessment({ replayIntent: event.target.value as CampaignStudyAssessment["replayIntent"] })}
                  >
                    {CAMPAIGN_STUDY_REPLAY_INTENTS.map((value) => <option key={value} value={value}>{labelFor(value)}</option>)}
                  </select>
                </label>
              </div>
            </fieldset>

            <div className="campaignStudyActions">
              <button data-testid="campaign-study-abandon" type="button" onClick={props.abandon}>Abandon</button>
              <button data-testid="campaign-study-finalize" type="button" disabled={!canFinalize} onClick={props.finalize}>Finalize</button>
            </div>
            {run.status === "active" && props.elapsedSeconds >= 5400 && <p className="campaignStudyHint" role="alert">90-minute cap reached. The moderator should select Abandon; this attempt remains eligible and incomplete.</p>}
            {run.status === "awaiting-assessment" && !canFinalize && <p className="campaignStudyHint">Rate the Finale explanation and Replay intent before finalizing.</p>}
          </>
        )}

        <div className="campaignStudyFooter">
          <span>{props.runs.length}/16 stored / {pilotCount}/2 completed pilots / {officialCount}/8 eligible official</span>
          <div>
            <button data-testid="campaign-study-export" type="button" disabled={!props.runs.length} onClick={props.exportStudy}>Export safe JSON</button>
            <button
              data-testid="campaign-study-reset"
              type="button"
              disabled={!props.runs.length}
              onClick={() => {
                if (window.confirm("Delete only the browser-local Campaign Study summaries? The game world will not be reset.")) props.reset();
              }}
            >
              Reset study data
            </button>
          </div>
        </div>
      </div>
    </details>
  );
}
