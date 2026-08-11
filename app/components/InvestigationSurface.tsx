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
import { useFinalDetectiveWorkspace } from "@/app/hooks/useFinalDetectiveWorkspace";
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
  TestimonyRecord,
  WorldLeadFocus
} from "@/lib/engine";

export function InvestigationPanel({
  playableIntake, caseRhythm, onIntakeNextAction, notebookItems, onNotebookAction, selectedSceneName,
  discoveredEvidence, evidenceImpacts, actionAdapter, session, testimonies,
  characters, selectedCharacterId, setSelectedCharacterId, selectedEvidenceId, setSelectedEvidenceId,
  question, setQuestion, aiSafety, memoryCount, dialogueLog, theory, setTheory,
  playerTheoryEvidence, submitTheory, revealText, gapCards, onGapSelect, nextStepAdvice, staticPlaythroughProof,
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
  discoveredEvidence: Evidence[];
  evidenceImpacts: Map<string, EvidenceImpact>;
  actionAdapter: CertifiedInvestigationActionAdapter;
  session: PlayerSession | null;
  testimonies: TestimonyRecord[];
  characters: DeductionCase["characters"];
  selectedCharacterId: string;
  setSelectedCharacterId: (value: string) => void;
  selectedEvidenceId: string;
  setSelectedEvidenceId: (value: string) => void;
  question: string;
  setQuestion: (value: string) => void;
  aiSafety: AiSafetyView | null;
  memoryCount: number;
  dialogueLog: PlayerSession["interrogationLog"];
  theory: PlayerTheory;
  setTheory: (updater: (current: PlayerTheory) => PlayerTheory) => void;
  playerTheoryEvidence: Set<string>;
  submitTheory: () => void;
  revealText: string;
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
  const finalWorkspace = useFinalDetectiveWorkspace({
    runtimeMode,
    commandBrief: campaignCommandBrief,
    rhythm: caseRhythm,
    playableIntake,
    session,
    notebookItems,
    discoveredEvidence,
    characters,
    testimonies,
    theory,
    selectedCharacterId,
    selectedEvidenceId,
    selectedSceneName,
    promptSafe: aiSafety?.promptAudit?.safe,
    memoryCount,
    evidenceImpacts,
    gapCards,
    nextStepAdvice,
    campaignRecovery,
    sourceReviewUnlock,
    proofLedger,
    proofCoverage,
    routeCertificate,
    proofTourSteps,
    revealAvailable: Boolean(revealText)
  });
  const worldCampaign = <WorldCampaignPanel runtimeMode={runtimeMode} session={session} summary={worldLead} outcome={worldLeadOutcome} handoff={worldLeadCaseHandoff} arc={worldArc} directive={worldArcDirective} pressure={worldPressureCascade} influenceBudget={worldInfluenceBudget} playerResourceCommitment={playerResourceCommitment} factionRelationship={factionRelationship} worldEventOffer={worldEventOffer} investigatorProgression={investigatorProgression} campaignRecovery={campaignRecovery} investigatorHeadquarters={investigatorHeadquarters} arcConvergence={arcConvergence} campaignSession={campaignSession} campaignFinaleDebrief={campaignFinaleDebrief} townSocialResponse={townSocialResponse} campaignPacing={serverCampaignPacing} commandBrief={campaignCommandBrief} onDecision={updateWorldLead} onDirectiveDecision={updateWorldArcDirective} onResourceCommitmentDecision={updatePlayerResourceCommitment} onWorldEventOfferDecision={updateWorldEventOffer} onCampaignRecoveryDecision={updateCampaignRecovery} onInvestigatorHeadquartersDecision={updateInvestigatorHeadquarters} busy={busy} />;
  return (
    <div className="stackedInspector">
      <InvestigationCoreActionsSurface model={finalWorkspace} currentAction={caseRhythm?.currentStep.action} notebookItems={notebookItems} discoveredEvidence={discoveredEvidence} characters={characters} actionAdapter={actionAdapter} onIntakeNextAction={onIntakeNextAction} onNotebookAction={onNotebookAction} selectedCharacterId={selectedCharacterId} setSelectedCharacterId={setSelectedCharacterId} selectedEvidenceId={selectedEvidenceId} setSelectedEvidenceId={setSelectedEvidenceId} question={question} setQuestion={setQuestion} theory={theory} setTheory={setTheory} submitTheory={submitTheory} gapCards={gapCards} onGapSelect={onGapSelect} onCampaignRecoveryStart={updateCampaignRecovery ? () => updateCampaignRecovery("start") : undefined} busy={busy} />
      <InvestigationRouteReviewSurface steps={playablePathSteps} rhythm={caseRhythm} commandDeckMode={commandDeckMode} worldCampaign={worldCampaign} campaignPacing={serverCampaignPacing} guidedManualRun={guidedManualRun} runGuidedManualStep={runGuidedManualStep} guidedStepJournal={guidedStepJournal} staticPlaythroughProof={staticPlaythroughProof} runStaticPlaythroughProof={runStaticPlaythroughProof} serverPlaythroughProof={serverPlaythroughProof} runServerPlaythroughProof={runServerPlaythroughProof} />
      <InvestigationDebriefReplaySurface commandDeckMode={commandDeckMode} campaignPacing={serverCampaignPacing} solvedCaseDebrief={solvedCaseDebrief} replayPracticeLoop={replayPracticeLoop} replayGoalCoach={replayGoalCoach} manualEvidenceDrill={manualEvidenceDrill} toggleManualEvidenceDrillEvidence={toggleManualEvidenceDrillEvidence} manualTheoryDrill={manualTheoryDrill} updateManualTheoryDrillField={updateManualTheoryDrillField} approveManualTheoryFallback={approveManualTheoryFallback} replayAttemptScorecard={replayAttemptScorecard} startReplayGoalAttempt={startReplayGoalAttempt} />
    </div>
  );
}
