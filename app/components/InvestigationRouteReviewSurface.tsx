"use client";

import type { ReactNode } from "react";
import { CommandDeckCollapsible } from "@/app/components/CommandDeckShell";
import { CampaignResolutionJournal } from "@/app/components/CampaignResolutionLedger";
import { CertifiedCaseRhythmSurface } from "@/app/components/CertifiedCaseRhythmSurface";
import type { CampaignPacingViewModel } from "@/app/campaign/campaign-pacing-model";
import type { CertifiedCaseRhythmViewModel } from "@/app/campaign/certified-case-rhythm-model";
import type {
  CertifiedPlaythroughProofSummary,
  GuidedManualRunSummary,
  GuidedStepJournalEntry,
  PlayableInvestigationPathStep,
  SourceReviewUnlockSummary
} from "@/app/campaign/investigation-workspace-model";
import type {
  CaseProofCoverage,
  CaseRouteCertificate,
  CaseTruthLedger,
  PlayableCaseIntake,
  PlayableCaseNextAction,
  ProofTourStep
} from "@/lib/engine";

function PlayableInvestigationPathPanel({
  steps,
  onStepAction,
  joinCase,
  rhythm,
  commandDeckMode = false
}: {
  steps: PlayableInvestigationPathStep[];
  onStepAction: (action: PlayableCaseNextAction) => void;
  joinCase: () => void;
  rhythm?: CertifiedCaseRhythmViewModel | null;
  commandDeckMode?: boolean;
}) {
  if (commandDeckMode && rhythm) return <div data-testid="playable-investigation-path"><CertifiedCaseRhythmSurface rhythm={rhythm} steps={steps} /></div>;
  const currentStep = steps.find((step) => step.status === "current") || steps.find((step) => step.status === "ready") || steps[0];
  function handleStep(step: PlayableInvestigationPathStep) {
    if (step.action.kind === "join") joinCase();
    else onStepAction(step.action);
  }
  return (
    <section className="playableInvestigationPath" data-testid="playable-investigation-path">
      <div className="playablePathHeader">
        <div>
          <span>Playable Investigation Path</span>
          <strong>Join -&gt; Search -&gt; Question -&gt; Challenge -&gt; Select Evidence -&gt; Submit -&gt; Review Source</strong>
        </div>
        {!commandDeckMode && <button type="button" className="primaryButton" data-testid="playable-path-next-action" onClick={() => handleStep(currentStep)}>{currentStep.action.buttonLabel}</button>}
      </div>
      <div className="playablePathSteps">
        {steps.map((step) => {
          const content = <><span>{step.label}</span><b>{step.metric}</b><strong>{step.question}</strong><small>{step.detail}</small></>;
          return commandDeckMode
            ? <article key={step.kind} className={step.status} data-testid="playable-investigation-step">{content}</article>
            : <button key={step.kind} type="button" className={step.status} data-testid="playable-investigation-step" onClick={() => handleStep(step)}>{content}</button>;
        })}
      </div>
      <small className="playablePathBoundary">Low-spoiler route guidance only: no hidden truth, raw bodies, internal ids, or source trail details.</small>
    </section>
  );
}

function CertifiedPlaythroughProofPanel({ proof, onRun }: { proof: CertifiedPlaythroughProofSummary; onRun: () => void }) {
  const pass = proof.status === "accepted" || (proof.routeCertified && proof.autoRoutePassed && proof.blockerCount === 0);
  const statusLabel = proof.status === "accepted" ? proof.acceptedLabel : proof.status === "blocked" ? proof.blockedLabel : proof.readyLabel;
  return (
    <section className={`staticPlaythroughProof ${pass ? "pass" : "check"}`} data-testid={proof.testId}>
      <div className="staticPlaythroughHeader">
        <div><span>{proof.title}</span><strong>{statusLabel}</strong></div>
        <button type="button" className="primaryButton" data-testid={proof.runTestId} onClick={onRun}>{proof.actionLabel}</button>
      </div>
      <div className="staticPlaythroughMetrics">
        {typeof proof.sourceBackedRoute === "boolean" && <span className={proof.sourceBackedRoute ? "pass" : "fail"}><b>{proof.sourceBackedRoute ? "source-backed" : "missing"}</b>source-backed route</span>}
        <span className={proof.routeCertified ? "pass" : "fail"}><b>{proof.routeCertified ? "certified" : "blocked"}</b>route certified</span>
        <span className={proof.autoRoutePassed ? "pass" : "fail"}><b>{proof.autoRoutePassed ? "pass" : "check"}</b>auto route pass</span>
        <span className={proof.acceptedTheory ? "pass" : "check"}><b>{proof.acceptedTheory ? "accepted" : "pending"}</b>accepted theory</span>
        <span><b>{proof.searchStepCount}</b>search steps</span>
        <span><b>{proof.questionedWitnessCount}</b>questioned witnesses</span>
        <span><b>{proof.challengeHitCount}</b>challenge hits</span>
        <span><b>{proof.selectedEvidenceCount}</b>selected evidence</span>
        <span><b>{proof.coveredRequiredObligations}/{proof.totalRequiredObligations}</b>covered obligations</span>
      </div>
      <small>{proof.boundaryText}</small>
    </section>
  );
}

function GuidedManualRunPanel({ summary, onRunNext }: { summary: GuidedManualRunSummary; onRunNext: () => void }) {
  return (
    <section className={`guidedManualRun ${summary.readyToReview ? "ready" : "active"}`} data-testid="guided-manual-run">
      <div className="guidedManualHeader">
        <div><span>Guided Manual Run</span><strong>{summary.currentLabel}</strong></div>
        <button type="button" className="primaryButton" data-testid="run-next-guided-step" onClick={onRunNext} disabled={summary.running}>
          {summary.running ? "Running Guided Step" : summary.readyToReview ? "Review Source" : "Run Next Guided Step"}
        </button>
      </div>
      <div className="guidedManualMetrics">
        <span><b>{summary.currentStep}</b>current step</span>
        <span><b>{summary.completedSteps}/{summary.totalSteps}</b>completed steps</span>
        <span className={summary.readyToReview ? "pass" : "check"}><b>{summary.readyToReview ? "ready" : "not ready"}</b>ready to review</span>
        <span><b>{summary.lastResult}</b>last result</span>
      </div>
      <small>{summary.blockerSummary}</small>
    </section>
  );
}

function GuidedStepJournalPanel({ entries, campaignPacing }: { entries: GuidedStepJournalEntry[]; campaignPacing?: CampaignPacingViewModel | null }) {
  const visibleEntries = entries.slice(-20).reverse();
  const completedCount = entries.filter((entry) => entry.status === "done").length;
  const completedSteps = Array.from(new Set(entries.filter((entry) => entry.status === "done").map((entry) => entry.step))).join(" ");
  const fallbackUsed = entries.some((entry) => entry.fallbackUsed);
  const reviewUnlocked = entries.some((entry) => entry.reviewUnlocked);
  const lastStatus = entries[entries.length - 1]?.status || "info";
  return (
    <section className="guidedStepJournal" data-testid="guided-step-journal" data-completed-steps={completedSteps}>
      <div className="guidedStepJournalHeader">
        <div><span>Guided Step Journal</span><strong>{entries.length ? "Session route explanation" : "No guided steps run yet"}</strong></div>
        <b>{reviewUnlocked ? "review unlocked" : "session-only"}</b>
      </div>
      <CampaignResolutionJournal />
      <div className="guidedStepJournalMetrics">
        <span><b>{completedCount}</b>completed entries</span>
        <span><b>{lastStatus}</b>last status</span>
        <span className={fallbackUsed ? "check" : "pass"}><b>{fallbackUsed ? "used" : "unused"}</b>certified fallback</span>
        <span className={reviewUnlocked ? "pass" : "check"}><b>{reviewUnlocked ? "unlocked" : "locked"}</b>review source</span>
      </div>
      {campaignPacing && <div className={`guidedCampaignPacing ${campaignPacing.status}`} data-testid="guided-campaign-pacing">
        <span>Campaign context / {campaignPacing.status}</span>
        <b>{campaignPacing.currentObjective.label}</b>
        <small>{campaignPacing.whyNow}</small>
        <em>{campaignPacing.nextAction}</em>
      </div>}
      <div className="guidedStepJournalEntries">
        {visibleEntries.length ? visibleEntries.map((entry) => (
          <article key={entry.id} className={entry.status}>
            <span>{entry.step} / {entry.status}</span><b>{entry.label}</b><small>{entry.result}</small><small>{entry.progressDelta}</small>
            <em>{entry.nextAction}{entry.fallbackUsed ? " / certified fallback used" : ""}</em>
          </article>
        )) : (
          <article className="info"><span>ready / info</span><b>Run one guided step</b><small>The journal records only low-spoiler step results for this browser session.</small><em>No repo files, public artifacts, or SQLite schema are written.</em></article>
        )}
      </div>
    </section>
  );
}

function sourceReviewRouteCopy(step: CaseRouteCertificate["steps"][number]) {
  if (step.kind === "question") return { label: "Question a certified witness", detail: "Ask the required witness before presenting contradiction evidence." };
  if (step.kind === "challenge") return { label: "Challenge certified testimony", detail: "Present discovered contradiction evidence to the required witness." };
  if (step.kind === "select-evidence") return { label: "Select certified evidence", detail: "Add the required discovered evidence to the theory." };
  if (step.kind === "submit") return { label: "Submit the certified theory", detail: "Complete local judgement after the proof obligations are covered." };
  return { label: step.label, detail: step.detail };
}

function SourceReviewUnlockPanel({
  summary, intake, proofLedger, proofCoverage, routeCertificate, proofTourSteps, revealText, judgementExplanation
}: {
  summary: SourceReviewUnlockSummary;
  intake?: PlayableCaseIntake | null;
  proofLedger?: CaseTruthLedger | null;
  proofCoverage?: CaseProofCoverage | null;
  routeCertificate?: CaseRouteCertificate | null;
  proofTourSteps: ProofTourStep[];
  revealText: string;
  judgementExplanation?: string;
}) {
  const sourceTrail = intake?.sourceTrail || [];
  const obligations = proofLedger?.obligations || [];
  const routeSteps = routeCertificate?.steps || [];
  return (
    <section className={`sourceReviewUnlock ${summary.unlocked ? "unlocked" : "locked"}`} data-testid="source-review-unlock">
      <div className="sourceReviewHeader"><div><span>Source Review Unlock</span><strong>{summary.statusLabel}</strong></div><b>{summary.unlocked ? "audit ready" : "accepted theory required"}</b></div>
      <div className="sourceReviewMetrics">
        <span><b>{summary.sourceEventCount}</b>source events</span><span><b>{summary.memoryCount}</b>memories</span>
        <span><b>{summary.coveredObligations}/{summary.totalObligations}</b>covered obligations</span><span><b>{summary.routeStepCount}</b>route steps</span>
        <span><b>{summary.challengeHitCount}</b>challenge hits</span><span><b>{summary.selectedEvidenceCount}</b>selected evidence</span><span><b>{summary.proofGapCount}</b>proof gaps</span>
      </div>
      {!summary.unlocked ? <small>Locked source audit: complete the certified route and submit an accepted theory before source trail labels and conclusion review are shown.</small> : (
        <div className="sourceReviewWorkbench" data-testid="source-review-workbench">
          <section data-testid="source-review-trail"><strong>Source Trail</strong>
            {(sourceTrail.length ? sourceTrail : [{ id: "source-review-empty", kind: "source", label: "Solved source trail", detail: "No separate source trail rows are available for this case.", hidden: false }]).slice(0, 6).map((item, index) => (
              <article key={`${item.kind}:${index}`} className={item.hidden ? "locked" : "complete"}><span>{item.kind}</span><b>{item.label}</b><small>{item.detail}</small></article>
            ))}
          </section>
          <section data-testid="source-review-obligations"><strong>Proof Obligations</strong>
            {obligations.slice(0, 8).map((item, index) => {
              const covered = Boolean(proofCoverage?.coveredObligationIds.includes(item.id));
              return <article key={`${item.kind}:${index}`} className={covered ? "complete" : "locked"}><span>{covered ? "covered" : "open"} / {item.kind}</span><b>{item.label}</b><small>{item.detail}</small></article>;
            })}
          </section>
          <section data-testid="source-review-route"><strong>Certified Route</strong>
            {routeSteps.slice(0, 8).map((step, index) => {
              const copy = sourceReviewRouteCopy(step);
              return <article key={`${step.kind}:${index}`} className={step.complete ? "complete" : "locked"}><span>{step.complete ? "complete" : "blocked"} / {step.kind}</span><b>{copy.label}</b><small>{copy.detail}</small></article>;
            })}
          </section>
          <section data-testid="source-review-conclusion"><strong>Conclusion Review</strong>
            {proofTourSteps.filter((step) => !step.locked).slice(0, 5).map((step, index) => (
              <article key={`${step.stage}:${index}`} className={step.complete ? "complete" : ""}><span>{step.stage}</span><b>{step.title}</b><small>{step.detail}</small></article>
            ))}
            <article className="complete conclusionText"><span>accepted theory</span><b>{judgementExplanation || "Local judgement accepted the submitted theory."}</b><small>{revealText ? "Reveal text is available below without raw replay or case body." : "Generate the answer review for final prose."}</small></article>
            {revealText && <pre className="revealBox">{revealText}</pre>}
          </section>
        </div>
      )}
    </section>
  );
}

export function InvestigationRouteReviewSurface({
  steps, onStepAction, joinCase, rhythm, commandDeckMode = false, worldCampaign, guidedManualRun, runGuidedManualStep,
  guidedStepJournal, campaignPacing, staticPlaythroughProof, runStaticPlaythroughProof, serverPlaythroughProof,
  runServerPlaythroughProof, sourceReviewUnlock, playableIntake, proofLedger, proofCoverage,
  routeCertificate, proofTourSteps, revealText, judgementExplanation
}: {
  steps: PlayableInvestigationPathStep[];
  onStepAction: (action: PlayableCaseNextAction) => void;
  joinCase: () => void;
  rhythm?: CertifiedCaseRhythmViewModel | null;
  commandDeckMode?: boolean;
  worldCampaign: ReactNode;
  guidedManualRun?: GuidedManualRunSummary | null;
  runGuidedManualStep?: () => void;
  guidedStepJournal: GuidedStepJournalEntry[];
  campaignPacing?: CampaignPacingViewModel | null;
  staticPlaythroughProof?: CertifiedPlaythroughProofSummary | null;
  runStaticPlaythroughProof?: () => void;
  serverPlaythroughProof?: CertifiedPlaythroughProofSummary | null;
  runServerPlaythroughProof?: () => void;
  sourceReviewUnlock?: SourceReviewUnlockSummary | null;
  playableIntake?: PlayableCaseIntake | null;
  proofLedger?: CaseTruthLedger | null;
  proofCoverage?: CaseProofCoverage | null;
  routeCertificate?: CaseRouteCertificate | null;
  proofTourSteps: ProofTourStep[];
  revealText: string;
  judgementExplanation?: string;
}) {
  return <>
    <PlayableInvestigationPathPanel steps={steps} onStepAction={onStepAction} joinCase={joinCase} rhythm={rhythm} commandDeckMode={commandDeckMode} />
    {worldCampaign}
    <CommandDeckCollapsible enabled={commandDeckMode} title="Guided run and journal">
      {guidedManualRun && runGuidedManualStep && <GuidedManualRunPanel summary={guidedManualRun} onRunNext={runGuidedManualStep} />}
      <GuidedStepJournalPanel entries={guidedStepJournal} campaignPacing={campaignPacing} />
    </CommandDeckCollapsible>
    <CommandDeckCollapsible enabled={commandDeckMode} title="Proof and source review">
      {staticPlaythroughProof && runStaticPlaythroughProof && <CertifiedPlaythroughProofPanel proof={staticPlaythroughProof} onRun={runStaticPlaythroughProof} />}
      {serverPlaythroughProof && runServerPlaythroughProof && <CertifiedPlaythroughProofPanel proof={serverPlaythroughProof} onRun={runServerPlaythroughProof} />}
      {sourceReviewUnlock && <SourceReviewUnlockPanel summary={sourceReviewUnlock} intake={playableIntake} proofLedger={proofLedger} proofCoverage={proofCoverage} routeCertificate={routeCertificate} proofTourSteps={proofTourSteps} revealText={revealText} judgementExplanation={judgementExplanation} />}
    </CommandDeckCollapsible>
  </>;
}
