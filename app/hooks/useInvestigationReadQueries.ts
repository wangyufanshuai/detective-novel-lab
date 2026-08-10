"use client";

import { useCallback, useEffect, useMemo } from "react";
import type { useInvestigationController } from "@/app/controllers/useInvestigationController";
import { apiUrl, getV1, resolveRuntimeMode } from "@/app/lib/client-runtime";
import {
  buildCaseLogicReport,
  buildDeductionGraph,
  buildWorldMapSnapshot,
  deriveSuspectBoard
} from "@/lib/engine";
import type {
  CaseLogicReport,
  DeductionGraph,
  DeepSeekLiveEvalReport,
  SuspectBoardRow,
  WorldMapSnapshot
} from "@/lib/engine";

type InvestigationController = ReturnType<typeof useInvestigationController>;

export type InvestigationReadQueryAdapter = {
  loadLatestLiveEval: () => Promise<void>;
  agentApiExample: string;
};

function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Owns read-only investigation projections without granting presentation code request authority. */
export function useInvestigationReadQueries(investigation: InvestigationController): InvestigationReadQueryAdapter {
  const {
    world,
    events,
    activeCase,
    session,
    runtimeMode,
    timeValue,
    seedInput,
    mode,
    caseMode,
    caseTemplateId,
    caseArchetype,
    selectedCharacterId,
    selectedEvidenceId,
    question,
    setLatestLiveEval,
    setSnapshot,
    setDeductionGraph,
    setSuspectBoard,
    setLogicReport
  } = investigation;

  const loadLatestLiveEval = useCallback(async () => {
    if (resolveRuntimeMode() !== "server") return;
    try {
      const response = await fetch(apiUrl("/api/ai/live-eval/latest"));
      const data = response.ok ? await response.json() as { ok?: boolean; report?: DeepSeekLiveEvalReport } : null;
      if (data?.ok && data.report) setLatestLiveEval(data.report);
    } catch {
      // Live evaluation is optional and must never block local world bootstrap.
    }
  }, [setLatestLiveEval]);

  const agentApiExample = useMemo(
    () => JSON.stringify({
      createTown: { method: "POST", url: "/api/v1/command/town/create", body: { seed: seedInput, mode, caseMode, caseTemplateId, npcCount: mode === "advanced" ? 30 : caseMode === "generated" ? 20 : 8, timelineHours: mode === "advanced" ? 120 : 24, caseArchetype } },
      mapSnapshot: world ? { method: "GET", url: `/api/v1/query/world/map?worldId=${world.id}&caseId=${activeCase?.id || ""}&sessionId=${session?.id || ""}&day=1&time=${minutesToTime(timeValue)}` } : null,
      deductionGraph: activeCase ? { method: "GET", url: `/api/v1/query/case/deduction-graph?caseId=${activeCase.id}` } : null,
      interrogate: session ? { method: "POST", url: "/api/v1/command/investigation/interrogate", body: { sessionId: session.id, characterId: selectedCharacterId, question, evidenceId: selectedEvidenceId || undefined } } : null
    }, null, 2),
    [activeCase?.id, caseArchetype, caseMode, caseTemplateId, mode, question, seedInput, selectedCharacterId, selectedEvidenceId, session?.id, timeValue, world]
  );

  useEffect(() => {
    if (!world) {
      setSnapshot(null);
      return;
    }
    if (runtimeMode === "static-demo" && activeCase) {
      setSnapshot(buildWorldMapSnapshot(world, events, activeCase, session || undefined, { day: 1, time: minutesToTime(timeValue) }));
      return;
    }
    const query = new URLSearchParams({
      worldId: world.id,
      day: "1",
      time: minutesToTime(timeValue)
    });
    if (activeCase?.id) query.set("caseId", activeCase.id);
    if (session?.id) query.set("sessionId", session.id);
    getV1<{ snapshot: WorldMapSnapshot }>(`/api/v1/query/world/map?${query.toString()}`)
      .then((data) => setSnapshot(data.snapshot))
      .catch(() => {
        setSnapshot(buildWorldMapSnapshot(world, events, activeCase || undefined, session || undefined, { day: 1, time: minutesToTime(timeValue) }));
      });
  }, [activeCase, events, runtimeMode, session, setSnapshot, timeValue, world]);

  useEffect(() => {
    if (!activeCase?.id) {
      setDeductionGraph(null);
      setSuspectBoard([]);
      setLogicReport(null);
      return;
    }
    if (runtimeMode === "static-demo" && world) {
      setDeductionGraph(buildDeductionGraph(activeCase, events));
      setSuspectBoard(deriveSuspectBoard(activeCase, events));
      setLogicReport(buildCaseLogicReport(world, events, activeCase));
      return;
    }
    getV1<{ graph: DeductionGraph; suspectBoard: SuspectBoardRow[]; logicReport: CaseLogicReport }>(`/api/v1/query/case/deduction-graph?caseId=${activeCase.id}`)
      .then((data) => {
        setDeductionGraph(data.graph);
        setSuspectBoard(data.suspectBoard);
        setLogicReport(data.logicReport);
      })
      .catch(() => undefined);
  }, [activeCase, events, runtimeMode, setDeductionGraph, setLogicReport, setSuspectBoard, world]);

  return { loadLatestLiveEval, agentApiExample };
}
