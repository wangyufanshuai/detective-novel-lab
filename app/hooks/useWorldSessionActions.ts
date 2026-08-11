"use client";

import { useEffect, useRef } from "react";
import type { useCampaignController } from "@/app/controllers/useCampaignController";
import type { useInvestigationController } from "@/app/controllers/useInvestigationController";
import type { useReplayController } from "@/app/controllers/useReplayController";
import type { useTownRuntimeController } from "@/app/controllers/useTownRuntimeController";
import type { useCampaignComprehensionStudy } from "@/app/hooks/useCampaignComprehensionStudy";
import { useAppLocale } from "@/app/localization/locale-context";
import { apiUrl, postJson, resolveRuntimeMode } from "@/app/lib/client-runtime";
import {
  WORLD_SESSION_STORAGE_KEY,
  WORLD_BOOTSTRAP_STORAGE_KEY,
  normalizeWorldSessionPointer,
  serializeWorldSessionPointer
} from "@/app/lib/world-session-persistence";
import {
  createStaticDemoRuntime,
  listCaseTemplates,
  markDemoCrimeObserved
} from "@/lib/engine";
import type {
  CaseFromLog,
  CaseTemplateId,
  DemoRuntimeState,
  InvestigationProgress,
  PersistentTownRuntime,
  PlayerSession,
  RuntimeMode,
  WorldEvent,
  WorldState
} from "@/lib/engine";

type InvestigationController = ReturnType<typeof useInvestigationController>;
type CampaignController = ReturnType<typeof useCampaignController>;
type ReplayController = ReturnType<typeof useReplayController>;
type TownRuntimeController = ReturnType<typeof useTownRuntimeController>;
type CampaignStudy = Pick<ReturnType<typeof useCampaignComprehensionStudy>, "recordMeaningfulAction">;

export type WorldCreationOptions = {
  saveAsContinue?: boolean;
  campaignReady?: boolean;
  sessionBootstrap?: boolean;
  applyToClient?: boolean;
};

export type WorldLoadOptions = { saveAsContinue?: boolean };

export type HydratedCasePayload = {
  world: WorldState;
  events?: WorldEvent[];
  activeCase?: CaseFromLog;
  sessions?: PlayerSession[];
};

export type LoadedWorldResult = {
  world: WorldState;
  activeCase?: CaseFromLog;
  sessions: PlayerSession[];
  events: WorldEvent[];
  restoredSession: PlayerSession | null;
};

export type WorldSessionActionAdapter = {
  persist: (worldId?: string, sessionId?: string) => void;
  hydrateStatic: (state: DemoRuntimeState, resetTime?: boolean) => void;
  currentStaticState: () => DemoRuntimeState | null;
  hydrateCase: (data: HydratedCasePayload) => void;
  createWorld: (forcedRuntime?: RuntimeMode, options?: WorldCreationOptions) => Promise<WorldState | null>;
  loadWorld: (targetWorldId?: string, preferredSessionId?: string, options?: WorldLoadOptions) => Promise<LoadedWorldResult | null>;
  tickWorld: () => Promise<void>;
  switchRuntime: (next: RuntimeMode) => void;
  switchCaseTemplate: (next: CaseTemplateId) => void;
};

type WorldSessionActionsInput = {
  investigation: InvestigationController;
  campaign: CampaignController;
  town: TownRuntimeController;
  replay: ReplayController;
  campaignStudy: CampaignStudy;
  initialProgress: InvestigationProgress;
  loadLatestLiveEval: () => Promise<void>;
};

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Owns browser persistence plus Static/Server world bootstrap and lifecycle mutations. */
export function useWorldSessionActions({
  investigation,
  campaign,
  town,
  replay,
  campaignStudy,
  initialProgress,
  loadLatestLiveEval
}: WorldSessionActionsInput): WorldSessionActionAdapter {
  const initialized = useRef(false);
  const createInFlight = useRef(false);
  const loadInFlight = useRef(false);
  const tickInFlight = useRef(false);
  const { t } = useAppLocale();
  const {
    world,
    setWorld,
    events,
    setEvents,
    activeCase,
    setActiveCase,
    session,
    setSession,
    setSessions,
    worldIdInput,
    setWorldIdInput,
    seedInput,
    caseMode,
    caseTemplateId,
    setCaseTemplateId,
    caseArchetype,
    mode,
    timeValue,
    setTimeValue,
    setSelectedSceneId,
    setSelectedCharacterId,
    setSnapshot,
    setTheory,
    setStatus,
    revealText,
    setRevealText,
    setLastAiSafety,
    setBusy,
    runtimeMode,
    setRuntimeMode,
    progress,
    setProgress
  } = investigation;
  const {
    setFrontDoorOpen,
    setFrontDoorStatus,
    continueWorldId,
    continueSessionId,
    setContinueWorldId,
    setContinueSessionId
  } = campaign;
  const { setTownRuntime, setTownQueue, setSelectedAgentCandidates } = town;
  const { setReplaying, setServerPlaythroughSummary } = replay;

  function persist(nextWorldId?: string, nextSessionId?: string) {
    if (runtimeMode !== "server") return;
    const persistedWorldId = nextWorldId ?? world?.id;
    const persistedSessionId = nextSessionId ?? session?.id;
    if (!persistedWorldId) {
      try { localStorage.removeItem(WORLD_SESSION_STORAGE_KEY); } catch {}
      setContinueWorldId("");
      setContinueSessionId("");
      return;
    }
    const serialized = serializeWorldSessionPointer(persistedWorldId, persistedSessionId || "");
    if (!serialized) return;
    try { localStorage.setItem(WORLD_SESSION_STORAGE_KEY, serialized); } catch {}
    try { sessionStorage.removeItem(WORLD_BOOTSTRAP_STORAGE_KEY); } catch {}
    if (persistedWorldId) {
      setContinueWorldId(persistedWorldId);
      setContinueSessionId(persistedSessionId || "");
    }
  }

  function hydrateStatic(state: DemoRuntimeState, resetTime = true) {
    setWorld(state.world);
    setEvents(state.events);
    setActiveCase(state.activeCase);
    setSession(state.session);
    setSessions([state.session]);
    setProgress(state.progress);
    setRevealText(state.revealText);
    setWorldIdInput(state.world.id);
    setSelectedSceneId(state.activeCase.generationProfile.sceneLocationId);
    const firstCharacter = state.activeCase.deductionCase.characters.find((item) => item.role !== "死者");
    setSelectedCharacterId((current) => current || firstCharacter?.id || "");
    if (resetTime) setTimeValue(timeToMinutes("08:00"));
    setStatus("Premium Showcase loaded. Drag the time rail to observe the case, then search scenes and question witnesses.");
  }

  function currentStaticState(): DemoRuntimeState | null {
    if (!world || !activeCase || !session) return null;
    return { mode: "static-demo", world, events, activeCase, session, progress, revealText };
  }

  function hydrateCase(data: HydratedCasePayload) {
    setWorld(data.world);
    setTownRuntime((data.world as WorldState & { persistentRuntime?: PersistentTownRuntime }).persistentRuntime || null);
    if (data.events) setEvents(data.events);
    if (data.activeCase) {
      setActiveCase(data.activeCase);
      setSelectedSceneId(data.activeCase.generationProfile.sceneLocationId);
      const firstCharacter = data.activeCase.deductionCase.characters.find((item) => item.role !== "死者");
      setSelectedCharacterId(firstCharacter?.id || data.activeCase.generationProfile.culpritId);
      setTheory({ culpritId: "", motive: "", method: "", evidenceIds: [] });
      setServerPlaythroughSummary(null);
      setTimeValue(timeToMinutes("08:00"));
    }
    if (data.sessions) setSessions(data.sessions);
  }

  async function createWorld(forcedRuntime?: RuntimeMode, options: WorldCreationOptions = {}): Promise<WorldState | null> {
    const targetRuntime = forcedRuntime || runtimeMode;
    if (targetRuntime === "static-demo") {
      const staticState = createStaticDemoRuntime(caseTemplateId);
      hydrateStatic(staticState);
      setLastAiSafety(null);
      setReplaying(false);
      return staticState.world;
    }
    if (createInFlight.current) return null;
    createInFlight.current = true;
    setBusy(true);
    try {
      const generatedNpcCount = options.campaignReady ? 20 : mode === "advanced" ? 30 : caseMode === "generated" ? 20 : 8;
      const data = await postJson<{ world: WorldState; events: WorldEvent[]; activeCase: CaseFromLog }>("/api/worlds/create", {
        seed: seedInput.trim() || (caseMode === "premium" ? "premium-showcase" : "showcase-seed"),
        mode,
        caseMode: options.campaignReady ? "generated" : mode === "showcase" ? caseMode : "generated",
        caseTemplateId,
        npcCount: generatedNpcCount,
        timelineHours: mode === "advanced" ? 120 : 24,
        preSimDays: mode === "advanced" ? 5 : 1,
        caseArchetype
      });
      if (options.applyToClient === false) return data.world;
      hydrateCase(data);
      setWorldIdInput(data.world.id);
      setSession(null);
      setSessions([]);
      setRevealText("");
      setLastAiSafety(null);
      setProgress(initialProgress);
      setReplaying(false);
      if (options.saveAsContinue !== false) persist(data.world.id, "");
      if (options.sessionBootstrap) {
        const bootstrapPointer = serializeWorldSessionPointer(data.world.id, "");
        if (bootstrapPointer) try { sessionStorage.setItem(WORLD_BOOTSTRAP_STORAGE_KEY, bootstrapPointer); } catch {}
      }
      setStatus(t("status.worldCreated"));
      setTownRuntime(null);
      setTownQueue(null);
      setSelectedAgentCandidates([]);
      return data.world;
    } catch {
      if (options.sessionBootstrap) try { sessionStorage.removeItem(WORLD_BOOTSTRAP_STORAGE_KEY); } catch {}
      setStatus(t("error.create"));
      return null;
    } finally {
      createInFlight.current = false;
      setBusy(false);
    }
  }

  async function loadWorld(targetWorldId = worldIdInput.trim(), preferredSessionId = "", options: WorldLoadOptions = {}): Promise<LoadedWorldResult | null> {
    if (runtimeMode === "static-demo") {
      setStatus("Static demo uses a built-in deterministic world. Switch to Server Runtime to load a SQLite world.");
      return null;
    }
    if (!targetWorldId) return null;
    if (loadInFlight.current) return null;
    loadInFlight.current = true;
    setBusy(true);
    try {
      const stateResponse = await fetch(apiUrl(`/api/worlds/${targetWorldId}/state`));
      if (stateResponse.status === 404 && targetWorldId === continueWorldId) {
        persist("", "");
        setFrontDoorStatus(t("front.recovery.stale"));
      }
      const state = await stateResponse.json() as {
        ok: boolean;
        error?: string;
        world: WorldState;
        activeCase?: CaseFromLog;
        sessions?: PlayerSession[];
      };
      if (!state.ok) throw new Error(state.error || "Failed to read town");
      const eventResult = await fetch(apiUrl(`/api/worlds/${targetWorldId}/events`)).then((response) => response.json()) as { events?: WorldEvent[] };
      const sessions = state.sessions || [];
      const restoredEvents = eventResult.events || [];
      hydrateCase({ world: state.world, activeCase: state.activeCase, sessions, events: restoredEvents });
      const restoredSession = sessions.find((item) => item.id === (preferredSessionId || continueSessionId))
        || sessions.find((item) => item.caseId === state.activeCase?.id)
        || null;
      setSession(restoredSession);
      setProgress(restoredSession ? {
        observedCrimeWindow: true,
        joinedInvestigation: true,
        discoveredEvidence: restoredSession.discoveredEvidenceIds.length > 0,
        challengedTestimony: restoredSession.interrogationLog.some((entry) => Boolean(entry.challenge?.hit)),
        submittedTheory: Boolean(restoredSession.judgement),
        solvedCase: Boolean(restoredSession.judgement?.accepted)
      } : initialProgress);
      setWorldIdInput(state.world.id);
      if (options.saveAsContinue !== false) persist(state.world.id, restoredSession?.id || "");
      setStatus(t("status.worldLoaded"));
      return { world: state.world, activeCase: state.activeCase, sessions, events: restoredEvents, restoredSession };
    } catch {
      setStatus(t("error.load"));
      return null;
    } finally {
      loadInFlight.current = false;
      setBusy(false);
    }
  }

  async function tickWorld() {
    if (!world) return;
    if (runtimeMode === "static-demo") {
      setStatus("Static demo is fixed to the 24-hour Premium case. Use the time rail for playback.");
      return;
    }
    if (tickInFlight.current) return;
    tickInFlight.current = true;
    setBusy(true);
    try {
      const data = await postJson<{ world: WorldState; events: WorldEvent[]; activeCase: CaseFromLog }>(`/api/worlds/${world.id}/tick`, {});
      setWorld(data.world);
      setEvents((items) => [...items, ...data.events]);
      setActiveCase(data.activeCase);
      setRevealText("");
      setStatus(t("status.worldAdvanced"));
      campaignStudy.recordMeaningfulAction();
    } catch {
      setStatus(t("error.tick"));
    } finally {
      tickInFlight.current = false;
      setBusy(false);
    }
  }

  function switchRuntime(next: RuntimeMode) {
    if (next === runtimeMode) return;
    setRuntimeMode(next);
    setReplaying(false);
    setFrontDoorOpen(true);
    if (next === "static-demo") {
      hydrateStatic(createStaticDemoRuntime(caseTemplateId));
      return;
    }
    setWorld(null);
    setEvents([]);
    setActiveCase(null);
    setSession(null);
    setSnapshot(null);
    setProgress(initialProgress);
    setStatus("Switched to Server Runtime. New towns will use SQLite and can call DeepSeek for NPC surface replies.");
  }

  function switchCaseTemplate(next: CaseTemplateId) {
    setCaseTemplateId(next);
    if (runtimeMode === "static-demo" && caseMode === "premium") {
      hydrateStatic(createStaticDemoRuntime(next));
      setReplaying(false);
      setLastAiSafety(null);
      setStatus(`Case template switched: ${listCaseTemplates().find((item) => item.id === next)?.title || next}`);
    }
  }

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const selectedRuntime = resolveRuntimeMode();
    setRuntimeMode(selectedRuntime);
    if (selectedRuntime === "static-demo") {
      hydrateStatic(createStaticDemoRuntime(caseTemplateId));
      return;
    }
    let saved = normalizeWorldSessionPointer(null);
    try { saved = normalizeWorldSessionPointer(localStorage.getItem(WORLD_SESSION_STORAGE_KEY)); } catch {}
    if (saved.status === "invalid") {
      try { localStorage.removeItem(WORLD_SESSION_STORAGE_KEY); } catch {}
      setFrontDoorStatus(t("front.recovery.corrupt"));
    } else if (saved.pointer) {
      setContinueWorldId(saved.pointer.worldId);
      setContinueSessionId(saved.pointer.sessionId);
      setWorldIdInput(saved.pointer.worldId);
      if (saved.status === "legacy") {
        const migrated = serializeWorldSessionPointer(saved.pointer.worldId, saved.pointer.sessionId);
        if (migrated) try { localStorage.setItem(WORLD_SESSION_STORAGE_KEY, migrated); } catch {}
      }
    }
    void loadLatestLiveEval();
    if (saved.pointer) return;
    void (async () => {
      let bootstrapRaw: string | null = null;
      try { bootstrapRaw = sessionStorage.getItem(WORLD_BOOTSTRAP_STORAGE_KEY); } catch {}
      if (bootstrapRaw === "pending") {
        for (let attempt = 0; attempt < 120 && bootstrapRaw === "pending"; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 100));
          try { bootstrapRaw = sessionStorage.getItem(WORLD_BOOTSTRAP_STORAGE_KEY); } catch { bootstrapRaw = null; }
        }
      }
      const bootstrap = normalizeWorldSessionPointer(bootstrapRaw);
      if (bootstrap.pointer) {
        const restored = await loadWorld(bootstrap.pointer.worldId, bootstrap.pointer.sessionId, { saveAsContinue: false });
        if (restored) return;
        try { sessionStorage.removeItem(WORLD_BOOTSTRAP_STORAGE_KEY); } catch {}
      }
      try { sessionStorage.setItem(WORLD_BOOTSTRAP_STORAGE_KEY, "pending"); } catch {}
      await createWorld("server", { saveAsContinue: false, sessionBootstrap: true });
    })();
    // Bootstrap intentionally runs once; adapter functions preserve the legacy request order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (runtimeMode !== "static-demo" || !world || !activeCase || !session || timeValue < timeToMinutes("21:47") || progress.observedCrimeWindow) return;
    hydrateStatic(markDemoCrimeObserved({ mode: "static-demo", world, events, activeCase, session, progress, revealText }), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCase, events, progress, revealText, runtimeMode, session, timeValue, world]);

  return {
    persist,
    hydrateStatic,
    currentStaticState,
    hydrateCase,
    createWorld,
    loadWorld,
    tickWorld,
    switchRuntime,
    switchCaseTemplate
  };
}
