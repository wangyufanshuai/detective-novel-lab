import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { useCampaignComprehensionStudy } from "@/app/hooks/useCampaignComprehensionStudy";
import type { useCampaignController } from "@/app/controllers/useCampaignController";
import type { useInvestigationController } from "@/app/controllers/useInvestigationController";
import type { useReviewController } from "@/app/controllers/useReviewController";
import type { useTownRuntimeController } from "@/app/controllers/useTownRuntimeController";
import { getV1, postV1 } from "@/app/lib/client-runtime";
import { useAppLocale } from "@/app/localization/locale-context";
import type { GuidedStepJournalEntry } from "@/app/campaign/replay-practice-model";
import type {
  ArcConvergencePublicSummary,
  CampaignFinaleDebriefPublicSummary,
  CampaignRecoveryPublicSummary,
  CampaignSessionPublicSummary,
  CaseCandidate,
  CaseFromLog,
  EmergenceBenchmarkReport,
  FactionRelationshipPublicSummary,
  InvestigatorHeadquartersPublicSummary,
  InvestigatorProgressionPublicSummary,
  NpcActionCandidate,
  NpcAgentState,
  PersistentTownRuntime,
  PlayableCaseIntake,
  PlayerResourceCommitmentPublicSummary,
  PlayerSession,
  RunCatalogEntry,
  ScenarioPack,
  ScenarioPreset,
  ScenarioRunSummary,
  TownCaseLifecycleState,
  TownEmergenceQueue,
  TownRuleSnapshotSummary,
  TownRuntimeIntervention,
  TownSituationBrief,
  TownSocialResponsePublicSummary,
  TownStateDiff,
  WorldArcDirectivePublicSummary,
  WorldArcPublicSummary,
  WorldEvent,
  WorldEventOfferPublicSummary,
  WorldInfluenceBudgetPublicSummary,
  WorldLeadCaseHandoffPublicSummary,
  WorldPressureCascadePublicSummary,
  WorldState
} from "@/lib/engine";

type AppMode = "play" | "authoring" | "world-graph" | "persistent-town";
type InvestigationController = ReturnType<typeof useInvestigationController>;
type CampaignController = ReturnType<typeof useCampaignController>;
type TownRuntimeController = ReturnType<typeof useTownRuntimeController>;
type ReviewController = ReturnType<typeof useReviewController>;
type CampaignStudy = Pick<ReturnType<typeof useCampaignComprehensionStudy>, "recordMeaningfulAction" | "recordWorldChoice">;

type UsePersistentTownLifecycleInput = {
  investigation: InvestigationController;
  campaign: CampaignController;
  town: TownRuntimeController;
  review: ReviewController;
  campaignStudy: CampaignStudy;
  appMode: AppMode;
  setAppMode: Dispatch<SetStateAction<AppMode>>;
  appendGuidedStepJournal: (entry: Omit<GuidedStepJournalEntry, "id">) => void;
  hydrateCase: (data: { world: WorldState; events?: WorldEvent[]; activeCase?: CaseFromLog; sessions?: PlayerSession[] }) => void;
};

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function usePersistentTownLifecycle({
  investigation,
  campaign,
  town,
  review,
  campaignStudy,
  appMode,
  setAppMode,
  appendGuidedStepJournal,
  hydrateCase
}: UsePersistentTownLifecycleInput) {
  const { t } = useAppLocale();
  const actionSequence = useRef(0);
  const {
    world,
    setWorld,
    setEvents,
    selectedCharacterId,
    setSession,
    setRevealText,
    setStatus,
    setTimeValue,
    setInspectorTab,
    runtimeMode
  } = investigation;
  const {
    worldArcDirective,
    setWorldArcDirective,
    worldPressureCascade,
    setWorldPressureCascade,
    setWorldInfluenceBudget,
    playerResourceCommitment,
    setPlayerResourceCommitment,
    factionRelationship,
    setFactionRelationship,
    worldEventOffer,
    setWorldEventOffer,
    setInvestigatorProgression,
    investigatorHeadquarters,
    setInvestigatorHeadquarters,
    campaignRecovery,
    setCampaignRecovery,
    arcConvergence,
    setArcConvergence,
    setCampaignSession,
    setCampaignFinaleDebrief,
    townSocialResponse,
    setTownSocialResponse,
    setWorldArc,
    setWorldLeadCaseHandoff
  } = campaign;
  const {
    townRuntime,
    setTownRuntime,
    setTownQueue,
    setTownBrief,
    setSelectedAgentCandidates,
    setTownRuntimeBusy,
    setTownRuleState,
    setTownCaseLifecycle
  } = town;
  const {
    scenarioRun,
    setScenarioRun,
    setScenarioReport,
    selectedSnapshotFromId,
    setSelectedSnapshotFromId,
    selectedSnapshotToId,
    setSelectedSnapshotToId,
    setReviewExportTarget,
    setScenarioPresets,
    setScenarioRuns,
    setSelectedScenarioPresetId,
    setScenarioPacks,
    setSelectedScenarioPackId,
    setRunCatalog,
    setRunJobs,
    setSelectedRunCatalogId,
    setTownSnapshots,
    setSnapshotDiff,
    setBenchmarkSummary
  } = review;

  function runtimeCommandMeta(label: string) {
    actionSequence.current += 1;
    return { actionId: `${label}-${Date.now().toString(36)}-${actionSequence.current}`, sessionRevision: townRuntime?.revision };
  }

  function selectScenarioRunFromRuntime(runtime: PersistentTownRuntime | null | undefined, scenarioId?: string | null, forceSnapshots = false) {
    const runs = runtime?.scenarioRuns || [];
    const nextRun = (scenarioId ? runs.find((item) => item.id === scenarioId) : null) || runs[0] || null;
    setScenarioRun(nextRun);
    setScenarioReport(nextRun?.report || null);
    if (!nextRun) return;
    const availableSnapshotIds = new Set((runtime?.snapshots || []).map((snapshot) => snapshot.id));
    const nextFromId = nextRun.report.baseline.startSnapshotId;
    const nextToId = nextRun.report.baseline.endSnapshotId;
    if (forceSnapshots || !availableSnapshotIds.has(selectedSnapshotFromId) || !availableSnapshotIds.has(selectedSnapshotToId)) {
      setSelectedSnapshotFromId(nextFromId);
      setSelectedSnapshotToId(nextToId);
      setReviewExportTarget({ fromId: nextFromId, toId: nextToId });
    }
  }

  async function loadScenarioArtifacts(targetWorldId: string) {
    const data = await getV1<{ presets: ScenarioPreset[]; runs: ScenarioRunSummary[] }>(`/api/v1/query/town/scenarios?worldId=${encodeURIComponent(targetWorldId)}`);
    setScenarioPresets(data.presets);
    setScenarioRuns(data.runs);
    setSelectedScenarioPresetId((current) => {
      if (current && data.presets.some((preset) => preset.id === current)) return current;
      return data.presets[0]?.id || "";
    });
  }

  async function loadScenarioPacks(targetWorldId: string) {
    const data = await getV1<{ packs: Array<ScenarioPack & { builtIn?: boolean; source?: string; experimentId?: string; experimentHash?: string; experimentPathHash?: string; validation?: { ok: boolean } }> }>(`/api/v1/query/town/scenario-packs?worldId=${encodeURIComponent(targetWorldId)}`);
    setScenarioPacks(data.packs);
    setSelectedScenarioPackId((current) => {
      if (current && data.packs.some((pack) => pack.manifest.id === current)) return current;
      return data.packs[0]?.manifest.id || "";
    });
  }

  async function loadRunCatalog(targetWorldId: string, runtime?: PersistentTownRuntime | null) {
    const data = await getV1<{ runs: RunCatalogEntry[] }>(`/api/v1/query/town/runs?worldId=${encodeURIComponent(targetWorldId)}`);
    setRunCatalog(data.runs);
    setRunJobs(runtime?.runJobs || []);
    setSelectedRunCatalogId((current) => {
      if (current && data.runs.some((run) => run.runId === current)) return current;
      return data.runs[0]?.runId || "";
    });
  }

  async function loadRuleState(targetWorldId: string) {
    const [ruleData, lifecycleData] = await Promise.all([
      getV1<{ ruleState: TownRuleSnapshotSummary }>(`/api/v1/query/town/rule-state?worldId=${encodeURIComponent(targetWorldId)}`),
      getV1<{ lifecycle: TownCaseLifecycleState }>(`/api/v1/query/town/case-lifecycle?worldId=${encodeURIComponent(targetWorldId)}`)
    ]);
    setTownRuleState(ruleData.ruleState);
    setTownCaseLifecycle(lifecycleData.lifecycle);
  }

  async function refreshTownRuntime(targetWorldId = world?.id, targetNpcId = selectedCharacterId, preferredScenarioId?: string | null, forceScenarioSnapshots = false) {
    if (!targetWorldId || runtimeMode === "static-demo") return;
    const runtimeData = await getV1<{ runtime: PersistentTownRuntime; queue: TownEmergenceQueue }>(`/api/v1/query/town/runtime?worldId=${encodeURIComponent(targetWorldId)}`);
    setTownRuntime(runtimeData.runtime);
    setTownQueue(runtimeData.queue);
    setWorldArc(runtimeData.runtime.worldArcSummary || null);
    setWorldArcDirective(runtimeData.runtime.worldArcDirectiveSummary || null);
    setWorldPressureCascade(runtimeData.runtime.worldPressureCascadeSummary || null);
    // Handoff is a runtime-owned summary too. Refreshing the Persistent Town
    // after extraction must surface ready -> consumed instead of retaining the
    // previous React snapshot when the command response is no longer present.
    const refreshedHandoff = runtimeData.runtime.worldLeadCaseHandoffSummary || null;
    setWorldLeadCaseHandoff((current) => current?.status === "consumed" && refreshedHandoff?.status === "ready" ? current : refreshedHandoff);
    setWorldInfluenceBudget(runtimeData.runtime.worldInfluenceBudgetSummary || null);
    setPlayerResourceCommitment(runtimeData.runtime.playerResourceCommitmentSummary || null);
    setFactionRelationship(runtimeData.runtime.factionRelationshipSummary || null);
    setWorldEventOffer(runtimeData.runtime.worldEventOfferSummary || null);
    setInvestigatorProgression(runtimeData.runtime.investigatorProgressionSummary || null);
    setInvestigatorHeadquarters(runtimeData.runtime.investigatorHeadquartersSummary || null);
    setCampaignRecovery(runtimeData.runtime.campaignRecoverySummary || null);
    setArcConvergence(runtimeData.runtime.arcConvergenceSummary || null);
    setCampaignSession(runtimeData.runtime.campaignSessionSummary || null);
    setCampaignFinaleDebrief(runtimeData.runtime.campaignFinaleDebrief || null);
    setTownSocialResponse(runtimeData.runtime.townSocialResponseSummary || null);
    setTownSnapshots(runtimeData.runtime.snapshots || []);
    selectScenarioRunFromRuntime(runtimeData.runtime, preferredScenarioId || scenarioRun?.id, forceScenarioSnapshots);
    await loadScenarioArtifacts(targetWorldId).catch(() => {
      setScenarioPresets([]);
      setScenarioRuns([]);
    });
    await loadScenarioPacks(targetWorldId).catch(() => setScenarioPacks([]));
    await loadRunCatalog(targetWorldId, runtimeData.runtime).catch(() => {
      setRunCatalog([]);
      setRunJobs(runtimeData.runtime.runJobs || []);
    });
    await loadRuleState(targetWorldId).catch(() => {
      setTownRuleState(null);
      setTownCaseLifecycle(null);
    });
    try {
      const briefData = await getV1<{ brief: TownSituationBrief }>(`/api/v1/query/town/brief?worldId=${encodeURIComponent(targetWorldId)}`);
      setTownBrief(briefData.brief);
    } catch {
      setTownBrief(null);
    }
    const latestSnapshots = runtimeData.runtime.snapshots || [];
    if (!runtimeData.runtime.scenarioRuns?.length) {
      if (!selectedSnapshotFromId && latestSnapshots.length >= 2) setSelectedSnapshotFromId(latestSnapshots[1].id);
      if (!selectedSnapshotToId && latestSnapshots.length >= 1) setSelectedSnapshotToId(latestSnapshots[0].id);
    }
    if (targetNpcId) {
      const agentData = await getV1<{ agent?: NpcAgentState; candidates: NpcActionCandidate[]; trace?: unknown }>(`/api/v1/query/town/agent?worldId=${encodeURIComponent(targetWorldId)}&npcId=${encodeURIComponent(targetNpcId)}`);
      setSelectedAgentCandidates(agentData.candidates || []);
    }
  }

  useEffect(() => {
    if (appMode !== "persistent-town" || runtimeMode === "static-demo" || !world?.id) return;
    void refreshTownRuntime(world.id, selectedCharacterId).catch(() => setStatus(t("error.load")));
    // Refresh is the lifecycle boundary; keep the same dependency shape as the former page effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appMode, runtimeMode, selectedCharacterId, world?.id]);

  useEffect(() => {
    if (!world?.id || runtimeMode === "static-demo" || !selectedSnapshotFromId || !selectedSnapshotToId || selectedSnapshotFromId === selectedSnapshotToId) {
      setSnapshotDiff(null);
      return;
    }
    getV1<{ diff: TownStateDiff }>(`/api/v1/query/town/snapshot/diff?worldId=${encodeURIComponent(world.id)}&from=${encodeURIComponent(selectedSnapshotFromId)}&to=${encodeURIComponent(selectedSnapshotToId)}`)
      .then((data) => setSnapshotDiff(data.diff))
      .catch(() => setSnapshotDiff(null));
  }, [runtimeMode, selectedSnapshotFromId, selectedSnapshotToId, setSnapshotDiff, world?.id]);

  useEffect(() => {
    if (runtimeMode === "static-demo" || appMode !== "persistent-town" || !world?.id) {
      setBenchmarkSummary(null);
      return;
    }
    getV1<{ available: boolean; report: EmergenceBenchmarkReport | null }>("/api/v1/query/benchmark/emergence")
      .then((data) => setBenchmarkSummary(data.available && data.report ? data.report : null))
      .catch(() => setBenchmarkSummary(null));
  }, [appMode, runtimeMode, setBenchmarkSummary, townRuntime?.id, world?.id]);

  async function startPersistentTown() {
    if (!world) return;
    if (runtimeMode === "static-demo") {
      setStatus("Persistent Agent Town uses SQLite server runtime. Switch to Server Runtime first.");
      return;
    }
    setTownRuntimeBusy(true);
    try {
      const data = await postV1<{ runtime: PersistentTownRuntime; events: WorldEvent[]; queue: TownEmergenceQueue; world: WorldState }>("/api/v1/command/town/runtime/start", { worldId: world.id, steps: 1, ...runtimeCommandMeta("town-start") });
      setTownRuntime(data.runtime);
      setTownQueue(data.queue);
      setWorld(data.world);
      setEvents((items) => [...items, ...data.events]);
      setInspectorTab("agent");
      setAppMode("persistent-town");
      setStatus("Persistent Agent Town started. NPC decisions are now writing WorldEvents.");
      campaignStudy.recordMeaningfulAction();
      await refreshTownRuntime(data.world.id);
    } catch {
      setStatus(t("error.generic"));
    } finally {
      setTownRuntimeBusy(false);
    }
  }

  async function pausePersistentTown() {
    if (!world) return;
    setTownRuntimeBusy(true);
    try {
      const data = await postV1<{ runtime: PersistentTownRuntime }>("/api/v1/command/town/runtime/pause", { worldId: world.id });
      setTownRuntime(data.runtime);
      setStatus("Persistent Agent Town paused.");
    } catch {
      setStatus(t("error.generic"));
    } finally {
      setTownRuntimeBusy(false);
    }
  }

  async function stepPersistentTown(steps = 1) {
    if (!world) return;
    if (runtimeMode === "static-demo") {
      setStatus("Persistent Agent Town uses SQLite server runtime. Switch to Server Runtime first.");
      return;
    }
    setTownRuntimeBusy(true);
    try {
      const data = await postV1<{ runtime: PersistentTownRuntime; events: WorldEvent[]; queue: TownEmergenceQueue; world: WorldState; worldArcDirective?: WorldArcDirectivePublicSummary; worldPressureCascade?: WorldPressureCascadePublicSummary; playerResourceCommitment?: PlayerResourceCommitmentPublicSummary; factionRelationship?: FactionRelationshipPublicSummary; worldEventOffer?: WorldEventOfferPublicSummary; worldInfluenceBudget?: WorldInfluenceBudgetPublicSummary; investigatorProgression?: InvestigatorProgressionPublicSummary; investigatorHeadquarters?: InvestigatorHeadquartersPublicSummary; campaignRecovery?: CampaignRecoveryPublicSummary; arcConvergence?: ArcConvergencePublicSummary; campaignSession?: CampaignSessionPublicSummary; campaignFinaleDebrief?: CampaignFinaleDebriefPublicSummary; townSocialResponse?: TownSocialResponsePublicSummary }>("/api/v1/command/town/runtime/step", { worldId: world.id, steps, ...runtimeCommandMeta("town-step") });
      setTownRuntime(data.runtime);
      setTownQueue(data.queue);
      setWorld(data.world);
      if (data.worldArcDirective) {
        const previousStatus = worldArcDirective?.status;
        setWorldArcDirective(data.worldArcDirective);
        if (previousStatus !== data.worldArcDirective.status && ["running", "blocked", "completed"].includes(data.worldArcDirective.status)) {
          appendGuidedStepJournal({ journalKey: `world-arc-directive-${data.worldArcDirective.status}`, step: "submit", label: data.worldArcDirective.status === "running" ? "Faction directive started" : data.worldArcDirective.status === "completed" ? "Faction directive completed" : "Faction directive blocked", status: data.worldArcDirective.status === "blocked" ? "blocked" : "done", result: data.worldArcDirective.status === "completed" ? "The selected response is now durable town history." : data.worldArcDirective.progressLabel, progressDelta: data.worldArcDirective.operationLabel, nextAction: data.worldArcDirective.nextAction });
        }
      }
      if (data.worldPressureCascade) {
        const previousStatus = worldPressureCascade?.status;
        setWorldPressureCascade(data.worldPressureCascade);
        if (data.worldPressureCascade.status === "active" && previousStatus !== "active") {
          appendGuidedStepJournal({ journalKey: "world-pressure-active", step: "submit", label: "World pressure activated", status: "done", result: `${data.worldPressureCascade.directionLabel} now carries into future, unextracted cases.`, progressDelta: `${data.worldPressureCascade.remainingLayers} bounded layer(s) remain.`, nextAction: data.worldPressureCascade.nextAction });
        }
      }
      if (data.worldInfluenceBudget) setWorldInfluenceBudget(data.worldInfluenceBudget);
      if (data.playerResourceCommitment) setPlayerResourceCommitment(data.playerResourceCommitment);
      if (data.factionRelationship) {
        const previousChange = factionRelationship?.lastChangeLabel;
        setFactionRelationship(data.factionRelationship);
        if (previousChange !== data.factionRelationship.lastChangeLabel && data.factionRelationship.status === "changed") {
          appendGuidedStepJournal({ journalKey: `faction-standing-${data.factionRelationship.lastChangeLabel}`, step: "submit", label: "Faction standing changed", status: "done", result: data.factionRelationship.lastChangeLabel, progressDelta: data.factionRelationship.resourceEffectLabel, nextAction: data.factionRelationship.nextAction });
        }
      }
      if (data.worldEventOffer) {
        const previousStatus = worldEventOffer?.status;
        setWorldEventOffer(data.worldEventOffer);
        if (previousStatus !== data.worldEventOffer.status && ["offered", "running", "completed", "failed", "expired"].includes(data.worldEventOffer.status)) {
          appendGuidedStepJournal({ journalKey: `world-event-offer-${data.worldEventOffer.status}`, step: "submit", label: data.worldEventOffer.status === "offered" ? "World opportunity offered" : `World opportunity ${data.worldEventOffer.status}`, status: data.worldEventOffer.status === "failed" || data.worldEventOffer.status === "expired" ? "blocked" : "done", result: data.worldEventOffer.progressLabel, progressDelta: data.worldEventOffer.status === "completed" ? data.worldEventOffer.recoveryLabel : data.worldEventOffer.benefitLabel, nextAction: data.worldEventOffer.nextAction });
        }
      }
      if (data.investigatorProgression) setInvestigatorProgression(data.investigatorProgression);
      if (data.investigatorHeadquarters) {
        const previousStatus = investigatorHeadquarters?.status;
        setInvestigatorHeadquarters(data.investigatorHeadquarters);
        if (previousStatus !== data.investigatorHeadquarters.status && ["ready", "active", "completed"].includes(data.investigatorHeadquarters.status)) {
          appendGuidedStepJournal({ journalKey: `investigator-headquarters-${data.investigatorHeadquarters.status}`, step: data.investigatorHeadquarters.status === "ready" ? "submit" : "join", label: data.investigatorHeadquarters.status === "ready" ? "Investigator Headquarters prepared" : data.investigatorHeadquarters.status === "active" ? "Headquarters preparation activated" : "Headquarters preparation completed", status: "done", result: data.investigatorHeadquarters.progressLabel, progressDelta: data.investigatorHeadquarters.benefitLabel, nextAction: data.investigatorHeadquarters.nextAction });
        }
      }
      if (data.campaignRecovery) {
        const previousStatus = campaignRecovery?.status;
        setCampaignRecovery(data.campaignRecovery);
        if (previousStatus !== data.campaignRecovery.status && ["ready", "completed"].includes(data.campaignRecovery.status)) {
          appendGuidedStepJournal({ journalKey: `campaign-recovery-${data.campaignRecovery.status}-${data.campaignRecovery.completedCount}`, step: "submit", label: data.campaignRecovery.status === "ready" ? "Recovery path prepared" : "Campaign recovery completed", status: data.campaignRecovery.status === "ready" ? "blocked" : "done", result: data.campaignRecovery.failureLabel, progressDelta: data.campaignRecovery.progressLabel, nextAction: data.campaignRecovery.nextAction });
        }
      }
      if (data.arcConvergence) {
        const previousStatus = arcConvergence?.status;
        setArcConvergence(data.arcConvergence);
        if (previousStatus !== data.arcConvergence.status && ["ready", "active", "completed"].includes(data.arcConvergence.status)) {
          appendGuidedStepJournal({ journalKey: `arc-convergence-${data.arcConvergence.status}`, step: data.arcConvergence.status === "completed" ? "submit" : "search", label: data.arcConvergence.status === "ready" ? "Campaign finale formed" : data.arcConvergence.status === "active" ? "Campaign finale activated" : "Campaign convergence completed", status: "done", result: `${data.arcConvergence.finaleLabel} / ${data.arcConvergence.approachLabel}`, progressDelta: `${data.arcConvergence.caseProgressLabel} / ${data.arcConvergence.worldProgressLabel}`, nextAction: data.arcConvergence.nextAction });
        }
      }
      if (data.campaignSession) setCampaignSession(data.campaignSession);
      if (data.campaignFinaleDebrief) setCampaignFinaleDebrief(data.campaignFinaleDebrief);
      if (data.townSocialResponse) {
        const previousStatus = townSocialResponse?.status;
        const previousProgress = townSocialResponse?.progressLabel;
        setTownSocialResponse(data.townSocialResponse);
        if (data.townSocialResponse.status !== "empty" && (previousStatus !== data.townSocialResponse.status || previousProgress !== data.townSocialResponse.progressLabel)) {
          appendGuidedStepJournal({ journalKey: `town-social-response-${data.townSocialResponse.status}-${data.townSocialResponse.progressLabel}`, step: "submit", label: data.townSocialResponse.status === "ready" ? "Town response prepared" : data.townSocialResponse.status === "settled" ? "Town response settled" : "Town response surfaced", status: "done", result: data.townSocialResponse.headline, progressDelta: `${data.townSocialResponse.progressLabel} public reactions`, nextAction: data.townSocialResponse.nextAction });
        }
      }
      setEvents((items) => [...items, ...data.events]);
      setTimeValue(timeToMinutes(data.runtime.currentTime));
      setInspectorTab("agent");
      setAppMode("persistent-town");
      setStatus(`Persistent tick ${data.runtime.tick}: ${data.events.length} WorldEvents added, ${data.queue.candidates.length} candidates in queue.`);
      campaignStudy.recordMeaningfulAction();
      await refreshTownRuntime(data.world.id);
    } catch {
      setStatus(t("error.tick"));
    } finally {
      setTownRuntimeBusy(false);
    }
  }

  async function resetPersistentTown() {
    if (!world) return;
    setTownRuntimeBusy(true);
    try {
      const data = await postV1<{ runtime: PersistentTownRuntime }>("/api/v1/command/town/runtime/reset", { worldId: world.id });
      setTownRuntime(data.runtime);
      setTownQueue(null);
      setTownBrief(null);
      setWorldArcDirective(null);
      setWorldPressureCascade(null);
      setTownSocialResponse(data.runtime.townSocialResponseSummary || null);
      setPlayerResourceCommitment(null);
      setSelectedAgentCandidates([]);
      setStatus("Persistent Agent Town runtime reset.");
    } catch {
      setStatus(t("error.generic"));
    } finally {
      setTownRuntimeBusy(false);
    }
  }

  async function intervenePersistentAgent(kind: TownRuntimeIntervention["kind"] = "resource", value: string | number | boolean = "resource:player-intervention") {
    if (!world || !selectedCharacterId) return;
    setTownRuntimeBusy(true);
    try {
      const data = await postV1<{ runtime: PersistentTownRuntime; intervention: unknown; world: WorldState }>("/api/v1/command/town/agent/intervene", { worldId: world.id, intervention: { actorId: selectedCharacterId, kind, value } });
      setTownRuntime(data.runtime);
      setWorld(data.world);
      setStatus(kind === "action-bias" ? `Director action bias applied: ${String(value)} will influence the selected NPC next tick.` : "Counterfactual resource intervention applied to selected NPC.");
      await refreshTownRuntime(data.world.id);
    } catch {
      setStatus(t("error.generic"));
    } finally {
      setTownRuntimeBusy(false);
    }
  }

  async function extractPersistentCandidate(candidate: CaseCandidate, targetWorldId = world?.id) {
    if (!targetWorldId) return false;
    const finaleStudyChoiceReady = arcConvergence?.status === "ready";
    setTownRuntimeBusy(true);
    setInspectorTab("investigation");
    setAppMode("play");
    setStatus("Playable case extraction started. Route integrity will be checked before the Case Intake opens.");
    try {
      const data = await postV1<{ world: WorldState; events: WorldEvent[]; activeCase: CaseFromLog; candidate: CaseCandidate; queue: TownEmergenceQueue; playableIntake?: PlayableCaseIntake; worldLeadCaseHandoff?: WorldLeadCaseHandoffPublicSummary; worldArc?: WorldArcPublicSummary; worldPressureCascade?: WorldPressureCascadePublicSummary; investigatorHeadquarters?: InvestigatorHeadquartersPublicSummary; playerResourceCommitment?: PlayerResourceCommitmentPublicSummary; worldInfluenceBudget?: WorldInfluenceBudgetPublicSummary; arcConvergence?: ArcConvergencePublicSummary; campaignSession?: CampaignSessionPublicSummary; campaignFinaleDebrief?: CampaignFinaleDebriefPublicSummary; townSocialResponse?: TownSocialResponsePublicSummary }>("/api/v1/command/town/case/extract", { worldId: targetWorldId, candidateId: candidate.id });
      hydrateCase({ world: data.world, activeCase: data.activeCase, events: data.events });
      setTownQueue(data.queue);
      if (data.playerResourceCommitment) setPlayerResourceCommitment(data.playerResourceCommitment);
      if (data.worldArc) {
        setWorldArc(data.worldArc);
        appendGuidedStepJournal({ journalKey: "world-arc", step: "join", label: data.worldArc.completedStages > 0 ? "World arc resumed" : "World arc activated", status: "info", result: `${data.worldArc.label} is aligned to the extracted case context.`, progressDelta: data.worldArc.progressLabel, nextAction: data.worldArc.nextAction });
      }
      const extractedHandoff = data.worldLeadCaseHandoff
        || (data.world as WorldState & { persistentRuntime?: PersistentTownRuntime }).persistentRuntime?.worldLeadCaseHandoffSummary;
      if (extractedHandoff) {
        setWorldLeadCaseHandoff(extractedHandoff);
        appendGuidedStepJournal({ journalKey: "world-lead-handoff", step: "join", label: "World lead handoff carried", status: "done", result: "The settled world lead follow-up was carried into this extracted case without changing its certified route.", progressDelta: "The next-case queue preference was consumed after the successful extraction.", nextAction: extractedHandoff.nextAction });
      }
      if (data.worldPressureCascade) {
        setWorldPressureCascade(data.worldPressureCascade);
        appendGuidedStepJournal({ journalKey: "world-pressure-consumed", step: "join", label: "World pressure carried into next case", status: "done", result: data.worldPressureCascade.status === "consumed" ? "The successful extraction consumed the final bounded pressure layer." : "The successful extraction consumed one bounded pressure layer; the current case remains frozen.", progressDelta: `${data.worldPressureCascade.remainingLayers} bounded layer(s) remain.`, nextAction: data.worldPressureCascade.nextAction });
      }
      if (data.investigatorHeadquarters) {
        setInvestigatorHeadquarters(data.investigatorHeadquarters);
        if (data.investigatorHeadquarters.status === "active") appendGuidedStepJournal({ journalKey: "investigator-headquarters-active", step: "join", label: "Headquarters preparation activated", status: "done", result: data.investigatorHeadquarters.progressLabel, progressDelta: data.investigatorHeadquarters.benefitLabel, nextAction: data.investigatorHeadquarters.nextAction });
      }
      if (data.worldInfluenceBudget) setWorldInfluenceBudget(data.worldInfluenceBudget);
      if (data.arcConvergence) {
        setArcConvergence(data.arcConvergence);
        if (data.arcConvergence.status === "active") appendGuidedStepJournal({ journalKey: "arc-convergence-active", step: "join", label: "Campaign finale activated", status: "done", result: `${data.arcConvergence.finaleLabel} entered the normal certified case path.`, progressDelta: data.arcConvergence.approachLabel, nextAction: data.arcConvergence.nextAction });
      }
      if (data.campaignSession) {
        setCampaignSession(data.campaignSession);
        appendGuidedStepJournal({ journalKey: `campaign-session-${data.campaignSession.status}-${data.campaignSession.progressLabel}`, step: "submit", label: data.campaignSession.status === "completed" ? "Campaign completed" : data.campaignSession.status === "finale-ready" ? "Campaign finale ready" : "Campaign chapter closed", status: "done", result: data.campaignSession.progressLabel, progressDelta: data.campaignSession.primaryActionLabel, nextAction: data.campaignSession.nextAction });
      }
      if (data.campaignFinaleDebrief) setCampaignFinaleDebrief(data.campaignFinaleDebrief);
      setSession(null);
      setRevealText("");
      setInspectorTab("investigation");
      setAppMode("play");
      setStatus("Playable case extracted. Review the Case Intake, then join the investigation.");
      campaignStudy.recordMeaningfulAction();
      if (finaleStudyChoiceReady) campaignStudy.recordWorldChoice("finale-case");
      return true;
    } catch {
      setStatus(t("error.generic"));
      return false;
    } finally {
      setTownRuntimeBusy(false);
    }
  }

  return {
    selectScenarioRunFromRuntime,
    loadScenarioPacks,
    refreshTownRuntime,
    startPersistentTown,
    pausePersistentTown,
    stepPersistentTown,
    resetPersistentTown,
    intervenePersistentAgent,
    extractPersistentCandidate
  };
}
