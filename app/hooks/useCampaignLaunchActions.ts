"use client";

import { useRef, type Dispatch, type SetStateAction } from "react";
import type { useCampaignController } from "@/app/controllers/useCampaignController";
import type { useInvestigationController } from "@/app/controllers/useInvestigationController";
import type { useReviewController } from "@/app/controllers/useReviewController";
import type { useTownRuntimeController } from "@/app/controllers/useTownRuntimeController";
import type { WorldSessionActionAdapter } from "@/app/hooks/useWorldSessionActions";
import { useAppLocale } from "@/app/localization/locale-context";
import { postV1 } from "@/app/lib/client-runtime";
import { listDetectiveCampaignDefinitions } from "@/lib/engine";
import type {
  CampaignSessionPublicSummary,
  CaseCandidate,
  PersistentTownRuntime,
  TownEmergenceQueue,
  WorldEvent,
  WorldState
} from "@/lib/engine";

type AppMode = "play" | "authoring" | "world-graph" | "persistent-town";
type InvestigationController = ReturnType<typeof useInvestigationController>;
type CampaignController = ReturnType<typeof useCampaignController>;
type TownRuntimeController = ReturnType<typeof useTownRuntimeController>;
type ReviewController = ReturnType<typeof useReviewController>;

const campaignDefinitions = listDetectiveCampaignDefinitions();

export type CampaignLaunchActionAdapter = {
  startSelectedCampaign: () => Promise<void>;
  continueSavedCampaign: () => Promise<void>;
};

type CampaignLaunchActionsInput = {
  investigation: InvestigationController;
  campaign: CampaignController;
  town: TownRuntimeController;
  review: ReviewController;
  worldSession: WorldSessionActionAdapter;
  extractPersistentCandidate: (candidate: CaseCandidate, worldId?: string) => Promise<boolean>;
  refreshTownRuntime: (worldId?: string, npcId?: string) => Promise<void>;
  setAppMode: Dispatch<SetStateAction<AppMode>>;
};

/** Owns the bounded Campaign Front Door start/continue request sequence. */
export function useCampaignLaunchActions({
  investigation,
  campaign,
  town,
  review,
  worldSession,
  extractPersistentCandidate,
  refreshTownRuntime,
  setAppMode
}: CampaignLaunchActionsInput): CampaignLaunchActionAdapter {
  const startInFlight = useRef(false);
  const continueInFlight = useRef(false);
  const runtimeActionSequence = useRef(0);
  const { t, text } = useAppLocale();
  const { runtimeMode, setInspectorTab, setStatus } = investigation;
  const {
    frontDoorSelection,
    frontDoorRouteSelection,
    setFrontDoorBusy,
    setFrontDoorStatus,
    setFrontDoorOpen,
    continueWorldId,
    continueSessionId,
  } = campaign;
  const { setSelectedScenarioPackId } = review;
  const { createWorld, loadWorld, persist } = worldSession;

  function runtimeCommandMeta(label: string, revision?: string) {
    runtimeActionSequence.current += 1;
    return { actionId: `${label}-${Date.now().toString(36)}-${runtimeActionSequence.current}`, sessionRevision: revision };
  }

  async function startSelectedCampaign() {
    if (runtimeMode !== "server") return;
    if (startInFlight.current) return;
    const definition = campaignDefinitions[frontDoorSelection] || campaignDefinitions[0];
    const route = definition?.routes[frontDoorRouteSelection] || definition?.routes[0];
    const packageId = definition?.worldPackageIds[0];
    if (!definition || !route || !packageId) {
      setFrontDoorStatus(t("front.routeUnavailable"));
      return;
    }
    startInFlight.current = true;
    setFrontDoorBusy(true);
    setFrontDoorStatus(t("front.status.preparing", { campaign: text(definition.label), route: text(route.label) }));
    try {
      const createdWorld = await createWorld("server", { saveAsContinue: false, campaignReady: true, applyToClient: false });
      if (!createdWorld) throw new Error("Campaign town creation did not complete.");
      const selected = await postV1<{
        currentExperiment: { scenarioPackId: string };
        campaignSession?: CampaignSessionPublicSummary;
      }>("/api/v1/command/player/world-pack/select", { worldId: createdWorld.id, packageId, campaignRouteId: route.id });
      let started = await postV1<{
        runtime: PersistentTownRuntime;
        events: WorldEvent[];
        queue: TownEmergenceQueue;
        world: WorldState;
      }>("/api/v1/command/town/runtime/start", { worldId: createdWorld.id, steps: 2, ...runtimeCommandMeta("campaign-start") });
      let candidate = started.queue.candidates.find((item) => item.validation.valid);
      for (let attempt = 0; attempt < 5 && !candidate; attempt += 1) {
        setFrontDoorStatus(t("front.status.validating", { campaign: text(definition.label), route: text(route.label), attempt: attempt + 1 }));
        started = await postV1<{
          runtime: PersistentTownRuntime;
          events: WorldEvent[];
          queue: TownEmergenceQueue;
          world: WorldState;
        }>("/api/v1/command/town/runtime/step", { worldId: createdWorld.id, steps: 8, ...runtimeCommandMeta("campaign-step", started.runtime.revision) });
        candidate = started.queue.candidates.find((item) => item.validation.valid);
      }
      if (!candidate) throw new Error("No route-certified opening case is available yet.");
      const extracted = await extractPersistentCandidate(candidate, createdWorld.id);
      if (!extracted) throw new Error("The opening case did not pass route-integrity extraction.");
      setSelectedScenarioPackId(selected.currentExperiment.scenarioPackId);
      persist(createdWorld.id, "");
      setFrontDoorStatus(t("front.status.started", { campaign: text(definition.label), route: text(route.label) }));
      setFrontDoorOpen(false);
      // A campaign begins in the living world. The extracted opening case is
      // available from the world console, but investigation remains a
      // deliberate downstream view rather than the product's default shell.
      setInspectorTab("agent");
      setAppMode("persistent-town");
    } catch {
      const message = t("error.campaignStart");
      setFrontDoorStatus(message);
      setStatus(message);
    } finally {
      startInFlight.current = false;
      setFrontDoorBusy(false);
    }
  }

  async function continueSavedCampaign() {
    if (runtimeMode !== "server" || !continueWorldId) return;
    if (continueInFlight.current) return;
    continueInFlight.current = true;
    setFrontDoorBusy(true);
    setFrontDoorStatus(t("front.status.restoring"));
    try {
      const loaded = await loadWorld(continueWorldId, continueSessionId);
      if (!loaded) throw new Error("The saved local Campaign could not be restored.");
      await refreshTownRuntime(loaded.world.id);
      setFrontDoorStatus(t("front.status.restored"));
      setFrontDoorOpen(false);
      setInspectorTab("agent");
      setAppMode("persistent-town");
    } catch {
      const message = t("error.campaignContinue");
      setFrontDoorStatus(message);
      setStatus(message);
    } finally {
      continueInFlight.current = false;
      setFrontDoorBusy(false);
    }
  }

  return { startSelectedCampaign, continueSavedCampaign };
}
