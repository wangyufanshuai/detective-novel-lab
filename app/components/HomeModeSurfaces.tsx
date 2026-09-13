import type { ReactNode } from "react";
import { CampaignStudyRecorder } from "@/app/components/CampaignStudyRecorder";
import { WorldConsoleSurface } from "@/app/components/WorldConsoleSurface";
import type { useCampaignComprehensionStudy } from "@/app/hooks/useCampaignComprehensionStudy";
import type { useInvestigationController } from "@/app/controllers/useInvestigationController";
import type { useReviewController } from "@/app/controllers/useReviewController";
import type { useTownRuntimeController } from "@/app/controllers/useTownRuntimeController";
import type { usePersistentTownLifecycle } from "@/app/hooks/usePersistentTownLifecycle";
import type {
  ScenarioConfig,
  ScenarioPreset,
  NpcAgentState,
  WorldMapActor
} from "@/lib/engine";

type CampaignStudy = ReturnType<typeof useCampaignComprehensionStudy>;
type InvestigationController = ReturnType<typeof useInvestigationController>;
type ReviewController = ReturnType<typeof useReviewController>;
type TownRuntimeController = ReturnType<typeof useTownRuntimeController>;
type PersistentTownLifecycle = ReturnType<typeof usePersistentTownLifecycle>;

export function CampaignStudySurface({ study, onExport }: { study: CampaignStudy; onExport: () => void }) {
  if (!study.visible) return null;
  return (
    <CampaignStudyRecorder
      runs={study.collection.runs}
      currentRun={study.currentRun}
      operations={study.operations}
      elapsedSeconds={study.elapsedSeconds}
      canStart={study.canStart}
      startBlockedReason={study.startBlockedReason}
      start={study.start}
      abandon={study.abandon}
      finalize={study.finalize}
      exportStudy={onExport}
      reset={study.reset}
      incrementMisunderstanding={study.incrementMisunderstanding}
      toggleConfusion={study.toggleConfusion}
      updateAssessment={study.updateAssessment}
    />
  );
}

type PersistentTownReviewActions = {
  selectScenarioRun: (runId: string) => void;
  runScenario: (config?: ScenarioConfig) => void;
  saveScenarioPreset: (preset: ScenarioPreset, overwrite: boolean) => void;
  deleteScenarioPreset: (presetId: string) => void;
  exportScenarioPack: () => void;
  validateScenarioPack: () => void;
  exportReplayBundle: () => void;
  startScenarioJob: () => void;
  startBenchmarkJob: () => void;
  cancelRunJob: (jobId: string) => void;
  copyReviewJson: () => void;
  exportReviewMarkdown: () => void;
  exportReviewBundle: () => void;
  rollbackSnapshot: (snapshotId: string) => void;
  markReviewExportTarget: () => void;
  runBenchmark: (seedCount: 10 | 20) => void;
};

type PersistentTownModeSurfaceProps = {
  studyRecorder: ReactNode;
  investigation: InvestigationController;
  town: TownRuntimeController;
  review: ReviewController;
  lifecycle: PersistentTownLifecycle;
  worldName: string;
  caseTitle: string;
  selectedAgent: NpcAgentState | null;
  selectedCharacterName?: string;
  reviewActions: PersistentTownReviewActions;
  onBackToPlay: () => void;
  onActorSelect: (actor: WorldMapActor) => void;
  onLocationSelect: (locationId: string) => void;
};

export function PersistentTownModeSurface({
  studyRecorder,
  investigation,
  town,
  review,
  lifecycle,
  worldName,
  caseTitle,
  selectedAgent,
  selectedCharacterName,
  reviewActions,
  onBackToPlay,
  onActorSelect,
  onLocationSelect
}: PersistentTownModeSurfaceProps) {
  return (
    <>
      {studyRecorder}
      <WorldConsoleSurface
        runtimeMode={investigation.runtimeMode}
        worldName={worldName}
        caseTitle={caseTitle}
        runtime={town.townRuntime}
        queue={town.townQueue}
        brief={town.townBrief}
        snapshot={investigation.snapshot}
        selectedAgent={selectedAgent}
        selectedAgentCandidates={town.selectedAgentCandidates}
        selectedLocationId={investigation.selectedSceneId}
        selectedCharacterName={selectedCharacterName}
        selectedCharacterId={investigation.selectedCharacterId}
        runningBusy={town.townRuntimeBusy}
        startRuntime={() => void lifecycle.startPersistentTown()}
        pauseRuntime={() => void lifecycle.pausePersistentTown()}
        stepRuntime={() => void lifecycle.stepPersistentTown()}
        stepRuntimeFast={() => void lifecycle.stepPersistentTown(5)}
        resetRuntime={() => void lifecycle.resetPersistentTown()}
        interveneAgent={(kind, value) => void lifecycle.intervenePersistentAgent(kind, value)}
        extractCase={(candidate) => void lifecycle.extractPersistentCandidate(candidate)}
        scenarioPresets={review.scenarioPresets}
        scenarioPacks={review.scenarioPacks}
        scenarioRuns={review.scenarioRuns}
        runCatalog={review.runCatalog}
        runJobs={review.runJobs}
        ruleState={town.townRuleState}
        caseLifecycle={town.townCaseLifecycle}
        selectedScenarioPackId={review.selectedScenarioPackId}
        setSelectedScenarioPackId={review.setSelectedScenarioPackId}
        selectedRunCatalogId={review.selectedRunCatalogId}
        setSelectedRunCatalogId={review.setSelectedRunCatalogId}
        selectedScenarioPresetId={review.selectedScenarioPresetId}
        setSelectedScenarioPresetId={review.setSelectedScenarioPresetId}
        selectScenarioRun={reviewActions.selectScenarioRun}
        runScenario={reviewActions.runScenario}
        saveScenarioPreset={reviewActions.saveScenarioPreset}
        deleteScenarioPreset={reviewActions.deleteScenarioPreset}
        exportScenarioPack={reviewActions.exportScenarioPack}
        validateScenarioPack={reviewActions.validateScenarioPack}
        exportReplayBundle={reviewActions.exportReplayBundle}
        startScenarioJob={reviewActions.startScenarioJob}
        startBenchmarkJob={reviewActions.startBenchmarkJob}
        cancelRunJob={reviewActions.cancelRunJob}
        copyReviewJson={reviewActions.copyReviewJson}
        exportReviewMarkdown={reviewActions.exportReviewMarkdown}
        exportReviewBundle={reviewActions.exportReviewBundle}
        rollbackSnapshot={reviewActions.rollbackSnapshot}
        markReviewExportTarget={reviewActions.markReviewExportTarget}
        backToPlay={onBackToPlay}
        onActorSelect={onActorSelect}
        onLocationSelect={onLocationSelect}
        selectedScenarioRun={review.scenarioRun}
        scenarioReport={review.scenarioReport}
        snapshots={review.townSnapshots}
        selectedSnapshotFromId={review.selectedSnapshotFromId}
        selectedSnapshotToId={review.selectedSnapshotToId}
        setSelectedSnapshotFromId={review.setSelectedSnapshotFromId}
        setSelectedSnapshotToId={review.setSelectedSnapshotToId}
        snapshotDiff={review.snapshotDiff}
        benchmarkSummary={review.benchmarkSummary}
        runBenchmark={reviewActions.runBenchmark}
        reviewBusy={review.reviewBusy}
      />
    </>
  );
}
