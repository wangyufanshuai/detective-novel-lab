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
  PlayableInvestigationPathStep
} from "@/app/campaign/investigation-workspace-model";

function PlayableInvestigationPathPanel({
  steps,
  rhythm,
  commandDeckMode = false
}: {
  steps: PlayableInvestigationPathStep[];
  rhythm?: CertifiedCaseRhythmViewModel | null;
  commandDeckMode?: boolean;
}) {
  if (commandDeckMode && rhythm) return <div data-testid="playable-investigation-path"><CertifiedCaseRhythmSurface rhythm={rhythm} steps={steps} /></div>;
  return (
    <section className="playableInvestigationPath" data-testid="playable-investigation-path">
      <div className="playablePathHeader">
        <div>
          <span>Playable Investigation Path</span>
          <strong>Join -&gt; Search -&gt; Question -&gt; Challenge -&gt; Select Evidence -&gt; Submit -&gt; Review Source</strong>
        </div>
      </div>
      <div className="playablePathSteps">
        {steps.map((step) => {
          const content = <><span>{step.label}</span><b>{step.metric}</b><strong>{step.question}</strong><small>{step.detail}</small></>;
          return <article key={step.kind} className={step.status} data-testid="playable-investigation-step">{content}</article>;
        })}
      </div>
      <small className="playablePathBoundary">Read-only route audit. The Final Detective Workspace owns the single Current Action and continues through the existing certified adapter.</small>
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

export function InvestigationRouteReviewSurface({
  steps, rhythm, commandDeckMode = false, worldCampaign, guidedManualRun, runGuidedManualStep,
  guidedStepJournal, campaignPacing, staticPlaythroughProof, runStaticPlaythroughProof, serverPlaythroughProof,
  runServerPlaythroughProof
}: {
  steps: PlayableInvestigationPathStep[];
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
}) {
  return <>
    <PlayableInvestigationPathPanel steps={steps} rhythm={rhythm} commandDeckMode={commandDeckMode} />
    {worldCampaign}
    <CommandDeckCollapsible enabled={commandDeckMode} title="Guided run and journal">
      {guidedManualRun && runGuidedManualStep && <GuidedManualRunPanel summary={guidedManualRun} onRunNext={runGuidedManualStep} />}
      <GuidedStepJournalPanel entries={guidedStepJournal} campaignPacing={campaignPacing} />
    </CommandDeckCollapsible>
    <CommandDeckCollapsible enabled={commandDeckMode} title="Proof and source review">
      {staticPlaythroughProof && runStaticPlaythroughProof && <CertifiedPlaythroughProofPanel proof={staticPlaythroughProof} onRun={runStaticPlaythroughProof} />}
      {serverPlaythroughProof && runServerPlaythroughProof && <CertifiedPlaythroughProofPanel proof={serverPlaythroughProof} onRun={runServerPlaythroughProof} />}
    </CommandDeckCollapsible>
  </>;
}
