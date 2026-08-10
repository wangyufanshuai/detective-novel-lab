"use client";

import type { Dispatch, SetStateAction } from "react";
import type { useCampaignController } from "@/app/controllers/useCampaignController";
import type { useInvestigationController } from "@/app/controllers/useInvestigationController";
import type { useReviewController } from "@/app/controllers/useReviewController";
import type { useTownRuntimeController } from "@/app/controllers/useTownRuntimeController";
import type { WorldSessionActionAdapter } from "@/app/hooks/useWorldSessionActions";
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
  const { runtimeMode, setWorld, setEvents, setInspectorTab, setStatus } = investigation;
  const {
    frontDoorSelection,
    frontDoorRouteSelection,
    setFrontDoorBusy,
    setFrontDoorStatus,
    setFrontDoorOpen,
    continueWorldId,
    continueSessionId,
    setCampaignSession
  } = campaign;
  const { setTownRuntime, setTownQueue } = town;
  const { setSelectedScenarioPackId } = review;
  const { createWorld, loadWorld, persist } = worldSession;

  async function startSelectedCampaign() {
    if (runtimeMode !== "server") return;
    const definition = campaignDefinitions[frontDoorSelection] || campaignDefinitions[0];
    const route = definition?.routes[frontDoorRouteSelection] || definition?.routes[0];
    const packageId = definition?.worldPackageIds[0];
    if (!definition || !route || !packageId) {
      setFrontDoorStatus("The selected Campaign route is unavailable in this local build.");
      return;
    }
    setFrontDoorBusy(true);
    setFrontDoorStatus(`Preparing ${definition.label} / ${route.label} from a clean deterministic town…`);
    try {
      const createdWorld = await createWorld("server", { saveAsContinue: false, campaignReady: true });
      if (!createdWorld) throw new Error("Campaign town creation did not complete.");
      const selected = await postV1<{
        currentExperiment: { scenarioPackId: string };
        campaignSession?: CampaignSessionPublicSummary;
      }>("/api/v1/command/town/world-pack/select", { worldId: createdWorld.id, packageId, campaignRouteId: route.id });
      setSelectedScenarioPackId(selected.currentExperiment.scenarioPackId);
      if (selected.campaignSession) setCampaignSession(selected.campaignSession);
      let started = await postV1<{
        runtime: PersistentTownRuntime;
        events: WorldEvent[];
        queue: TownEmergenceQueue;
        world: WorldState;
      }>("/api/v1/command/town/runtime/start", { worldId: createdWorld.id, steps: 2 });
      setTownRuntime(started.runtime);
      setTownQueue(started.queue);
      setWorld(started.world);
      setEvents((items) => [...items, ...started.events]);
      setCampaignSession(started.runtime.campaignSessionSummary || selected.campaignSession || null);
      let candidate = started.queue.candidates.find((item) => item.validation.valid);
      for (let attempt = 0; attempt < 5 && !candidate; attempt += 1) {
        setFrontDoorStatus(`Preparing ${definition.label} / ${route.label}: validating the opening case route (${attempt + 1}/5)…`);
        started = await postV1<{
          runtime: PersistentTownRuntime;
          events: WorldEvent[];
          queue: TownEmergenceQueue;
          world: WorldState;
        }>("/api/v1/command/town/runtime/step", { worldId: createdWorld.id, steps: 8 });
        setTownRuntime(started.runtime);
        setTownQueue(started.queue);
        setWorld(started.world);
        setEvents((items) => [...items, ...started.events]);
        setCampaignSession(started.runtime.campaignSessionSummary || selected.campaignSession || null);
        candidate = started.queue.candidates.find((item) => item.validation.valid);
      }
      if (!candidate) throw new Error("No route-certified opening case is available yet.");
      const extracted = await extractPersistentCandidate(candidate, createdWorld.id);
      if (!extracted) throw new Error("The opening case did not pass route-integrity extraction.");
      persist(createdWorld.id, "");
      setFrontDoorStatus(`${definition.label} / ${route.label} started. The authored route is frozen after this successful extraction.`);
      setFrontDoorOpen(false);
      setInspectorTab("investigation");
      setAppMode("play");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start Campaign.";
      setFrontDoorStatus(message);
      setStatus(message);
    } finally {
      setFrontDoorBusy(false);
    }
  }

  async function continueSavedCampaign() {
    if (runtimeMode !== "server" || !continueWorldId) return;
    setFrontDoorBusy(true);
    setFrontDoorStatus("Restoring the saved local Campaign without creating a new world…");
    try {
      const loaded = await loadWorld(continueWorldId, continueSessionId);
      if (!loaded) throw new Error("The saved local Campaign could not be restored.");
      await refreshTownRuntime(loaded.world.id);
      setFrontDoorStatus("Saved Campaign restored from the existing local world state.");
      setFrontDoorOpen(false);
      setInspectorTab("investigation");
      setAppMode("play");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to continue Campaign.";
      setFrontDoorStatus(message);
      setStatus(message);
    } finally {
      setFrontDoorBusy(false);
    }
  }

  return { startSelectedCampaign, continueSavedCampaign };
}
