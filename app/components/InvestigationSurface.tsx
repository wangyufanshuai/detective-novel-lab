"use client";

import { InvestigationCoreActionsSurface } from "@/app/components/InvestigationCoreActionsSurface";
import { InvestigationDebriefReplaySurface } from "@/app/components/InvestigationDebriefReplaySurface";
import { InvestigationRouteReviewSurface } from "@/app/components/InvestigationRouteReviewSurface";
import {
  WorldCampaignPanel,
  type ArcConvergenceSummary,
  type CampaignFinaleDebriefSummary,
  type CampaignRecoverySummary,
  type CampaignSessionSummary,
  type FactionRelationshipSummary,
  type InvestigatorHeadquartersSummary,
  type InvestigatorProgressionSummary,
  type PlayerResourceCommitmentSummary,
  type TownSocialResponseSummary,
  type WorldArcDirectiveSummary,
  type WorldArcSummary,
  type WorldEventOfferSummary,
  type WorldInfluenceBudgetSummary,
  type WorldLeadHandoffSummary,
  type WorldLeadOutcomeSummary,
  type WorldLeadSummary,
  type WorldPressureCascadeSummary
} from "@/app/components/WorldCampaignPanel";
import {
  buildPlayableInvestigationPath,
  type AiSafetyView,
  type CertifiedPlaythroughProofSummary,
  type GapCard,
  type GuidedManualRunSummary,
  type GuidedStepJournalEntry,
  type ManualEvidenceDrillSummary,
  type ManualTheoryDrillSummary,
  type NotebookAction,
  type ReplayAttemptScorecardSummary,
  type ReplayGoalCoachSummary,
  type ReplayPracticeLoopSummary,
  type SolvedCaseDebriefSummary,
  type SourceReviewUnlockSummary
} from "@/app/campaign/investigation-workspace-model";
import type { CampaignPacingViewModel } from "@/app/campaign/campaign-pacing-model";
import type { CampaignCommandBrief } from "@/app/campaign/campaign-command-brief-model";
import type { CertifiedCaseRhythmViewModel } from "@/app/campaign/certified-case-rhythm-model";
import type { CertifiedInvestigationActionAdapter } from "@/app/hooks/useCertifiedInvestigationActions";
import type { EvidenceImpact } from "@/app/hooks/useInvestigationActions";
import type {
  CaseProofCoverage,
  CaseRouteCertificate,
  CaseTruthLedger,
  DeductionCase,
  Evidence,
  EvidenceNotebookItem,
  PlayableCaseIntake,
  PlayableCaseNextAction,
  PlayerSession,
  PlayerTheory,
  ProofTourStep,
  WorldLeadFocus
} from "@/lib/engine";

export function InvestigationPanel({
  playableIntake, caseRhythm, onIntakeNextAction, notebookItems, onNotebookAction, selectedSceneName,
  sceneEvidence, discoveredEvidence, discoveredIds, evidenceImpacts, actionAdapter, session,
  characters, selectedCharacterId, setSelectedCharacterId, selectedEvidenceId, setSelectedEvidenceId,
  selectedTestimony, question, setQuestion, aiSafety, memoryCount, evidenceCount, contradictionHit,
  dialogueLog, deductionCase, theory, setTheory, playerTheoryEvidence, submitTheory, revealText,
  judgementGaps, gapCards, onGapSelect, nextStepAdvice, staticPlaythroughProof,
  runStaticPlaythroughProof, serverPlaythroughProof, runServerPlaythroughProof, runtimeMode,
  worldLead, worldLeadOutcome, worldLeadCaseHandoff, worldArc, worldArcDirective,
  worldPressureCascade, worldInfluenceBudget, playerResourceCommitment, factionRelationship,
  worldEventOffer, investigatorProgression, campaignRecovery, investigatorHeadquarters,
  arcConvergence, campaignSession, campaignFinaleDebrief, townSocialResponse, campaignPacing, campaignCommandBrief, updateWorldLead,
  updateWorldArcDirective, updatePlayerResourceCommitment, updateWorldEventOffer,
  updateCampaignRecovery, updateInvestigatorHeadquarters, guidedManualRun, runGuidedManualStep,
  guidedStepJournal, sourceReviewUnlock, solvedCaseDebrief, replayPracticeLoop, replayGoalCoach,
  manualEvidenceDrill, toggleManualEvidenceDrillEvidence, manualTheoryDrill,
  updateManualTheoryDrillField, approveManualTheoryFallback, replayAttemptScorecard,
  startReplayGoalAttempt, proofLedger, proofCoverage, routeCertificate, proofTourSteps,
  busy, commandDeckMode = false
}: {
  playableIntake?: PlayableCaseIntake | null;
  caseRhythm?: CertifiedCaseRhythmViewModel | null;
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
  staticPlaythroughProof?: CertifiedPlaythroughProofSummary | null;
  runStaticPlaythroughProof?: () => void;
  serverPlaythroughProof?: CertifiedPlaythroughProofSummary | null;
  runServerPlaythroughProof?: () => void;
  runtimeMode: "static-demo" | "server";
  worldLead?: WorldLeadSummary | null;
  worldLeadOutcome?: WorldLeadOutcomeSummary | null;
  worldLeadCaseHandoff?: WorldLeadHandoffSummary | null;
  worldArc?: WorldArcSummary | null;
  worldArcDirective?: WorldArcDirectiveSummary | null;
  worldPressureCascade?: WorldPressureCascadeSummary | null;
  worldInfluenceBudget?: WorldInfluenceBudgetSummary | null;
  campaignPacing?: CampaignPacingViewModel | null;
  campaignCommandBrief?: CampaignCommandBrief | null;
  playerResourceCommitment?: PlayerResourceCommitmentSummary | null;
  factionRelationship?: FactionRelationshipSummary | null;
  worldEventOffer?: WorldEventOfferSummary | null;
  investigatorProgression?: InvestigatorProgressionSummary | null;
  campaignRecovery?: CampaignRecoverySummary | null;
  investigatorHeadquarters?: InvestigatorHeadquartersSummary | null;
  arcConvergence?: ArcConvergenceSummary | null;
  campaignSession?: CampaignSessionSummary | null;
  campaignFinaleDebrief?: CampaignFinaleDebriefSummary | null;
  townSocialResponse?: TownSocialResponseSummary | null;
  updateWorldLead?: (action: "follow" | "skip") => void;
  updateWorldArcDirective?: (choice: "support" | "contain" | "defer") => void;
  updatePlayerResourceCommitment?: (allocations: WorldLeadFocus[]) => void;
  updateWorldEventOffer?: (choice: "accept" | "decline") => void;
  updateCampaignRecovery?: (choice: "start" | "defer" | "use-headquarters") => void;
  updateInvestigatorHeadquarters?: (choice: InvestigatorHeadquartersSummary["availableDirections"][number]["choice"]) => void;
  guidedManualRun?: GuidedManualRunSummary | null;
  runGuidedManualStep?: () => void;
  guidedStepJournal: GuidedStepJournalEntry[];
  sourceReviewUnlock?: SourceReviewUnlockSummary | null;
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
  proofLedger?: CaseTruthLedger | null;
  proofCoverage?: CaseProofCoverage | null;
  routeCertificate?: CaseRouteCertificate | null;
  proofTourSteps: ProofTourStep[];
  busy: boolean;
  commandDeckMode?: boolean;
}) {
  const playablePathSteps = buildPlayableInvestigationPath({ playableIntake, session, notebookItems, discoveredEvidence, dialogueLog, playerTheoryEvidence, characters });
  const serverCampaignPacing = runtimeMode === "server" ? campaignPacing : null;
  const worldCampaign = <WorldCampaignPanel runtimeMode={runtimeMode} session={session} summary={worldLead} outcome={worldLeadOutcome} handoff={worldLeadCaseHandoff} arc={worldArc} directive={worldArcDirective} pressure={worldPressureCascade} influenceBudget={worldInfluenceBudget} playerResourceCommitment={playerResourceCommitment} factionRelationship={factionRelationship} worldEventOffer={worldEventOffer} investigatorProgression={investigatorProgression} campaignRecovery={campaignRecovery} investigatorHeadquarters={investigatorHeadquarters} arcConvergence={arcConvergence} campaignSession={campaignSession} campaignFinaleDebrief={campaignFinaleDebrief} townSocialResponse={townSocialResponse} campaignPacing={serverCampaignPacing} commandBrief={campaignCommandBrief} onDecision={updateWorldLead} onDirectiveDecision={updateWorldArcDirective} onResourceCommitmentDecision={updatePlayerResourceCommitment} onWorldEventOfferDecision={updateWorldEventOffer} onCampaignRecoveryDecision={updateCampaignRecovery} onInvestigatorHeadquartersDecision={updateInvestigatorHeadquarters} busy={busy} />;
  return (
    <div className="stackedInspector">
      <InvestigationRouteReviewSurface steps={playablePathSteps} onStepAction={onIntakeNextAction} joinCase={actionAdapter.joinCase} rhythm={caseRhythm} commandDeckMode={commandDeckMode} worldCampaign={worldCampaign} campaignPacing={serverCampaignPacing} guidedManualRun={guidedManualRun} runGuidedManualStep={runGuidedManualStep} guidedStepJournal={guidedStepJournal} staticPlaythroughProof={staticPlaythroughProof} runStaticPlaythroughProof={runStaticPlaythroughProof} serverPlaythroughProof={serverPlaythroughProof} runServerPlaythroughProof={runServerPlaythroughProof} sourceReviewUnlock={sourceReviewUnlock} playableIntake={playableIntake} proofLedger={proofLedger} proofCoverage={proofCoverage} routeCertificate={routeCertificate} proofTourSteps={proofTourSteps} revealText={revealText} judgementExplanation={session?.judgement?.explanation} />
      <InvestigationDebriefReplaySurface commandDeckMode={commandDeckMode} campaignPacing={serverCampaignPacing} solvedCaseDebrief={solvedCaseDebrief} replayPracticeLoop={replayPracticeLoop} replayGoalCoach={replayGoalCoach} manualEvidenceDrill={manualEvidenceDrill} toggleManualEvidenceDrillEvidence={toggleManualEvidenceDrillEvidence} manualTheoryDrill={manualTheoryDrill} updateManualTheoryDrillField={updateManualTheoryDrillField} approveManualTheoryFallback={approveManualTheoryFallback} replayAttemptScorecard={replayAttemptScorecard} startReplayGoalAttempt={startReplayGoalAttempt} />
      <InvestigationCoreActionsSurface playableIntake={playableIntake} onIntakeNextAction={onIntakeNextAction} notebookItems={notebookItems} onNotebookAction={onNotebookAction} selectedSceneName={selectedSceneName} sceneEvidence={sceneEvidence} discoveredEvidence={discoveredEvidence} discoveredIds={discoveredIds} evidenceImpacts={evidenceImpacts} actionAdapter={actionAdapter} session={session} characters={characters} selectedCharacterId={selectedCharacterId} setSelectedCharacterId={setSelectedCharacterId} selectedEvidenceId={selectedEvidenceId} setSelectedEvidenceId={setSelectedEvidenceId} selectedTestimony={selectedTestimony} question={question} setQuestion={setQuestion} aiSafety={aiSafety} memoryCount={memoryCount} evidenceCount={evidenceCount} contradictionHit={contradictionHit} dialogueLog={dialogueLog} deductionCase={deductionCase} theory={theory} setTheory={setTheory} playerTheoryEvidence={playerTheoryEvidence} submitTheory={submitTheory} revealText={revealText} judgementGaps={judgementGaps} gapCards={gapCards} onGapSelect={onGapSelect} nextStepAdvice={nextStepAdvice} busy={busy} commandDeckMode={commandDeckMode} />
    </div>
  );
}
