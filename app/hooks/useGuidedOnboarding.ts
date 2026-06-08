"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { InvestigationProgress, PlayerSession, RuntimeMode } from "@/lib/engine";
import type { InspectorTabId } from "@/app/components/DetectiveTownUI";

export type OnboardingStep =
  | "observe"
  | "search"
  | "question"
  | "challenge"
  | "wrong-theory"
  | "correct-theory"
  | "reveal";

export type TaskCompletionState = "pending" | "current" | "complete";

export type GuidedTask = {
  id: OnboardingStep;
  title: string;
  detail: string;
  targetTab: InspectorTabId;
  state: TaskCompletionState;
};

export type SelectionHighlight = {
  locationId?: string;
  characterId?: string;
  evidenceId?: string;
  eventId?: string;
};

type PersistedOnboarding = {
  dismissed: boolean;
  wrongTheorySubmitted: boolean;
};

const storageKey = "detective-town-onboarding-v1";

const definitions: Array<Omit<GuidedTask, "state">> = [
  { id: "observe", title: "观察案发窗口", detail: "把时间轴移动到 21:47，观察事件和 NPC 位置。", targetTab: "events" },
  { id: "search", title: "搜索地点", detail: "点击地图上的可搜索建筑，发现第一条证据。", targetTab: "investigation" },
  { id: "question", title: "询问 NPC", detail: "选择一名 NPC，先进行一次普通询问。", targetTab: "investigation" },
  { id: "challenge", title: "出示证据质询", detail: "选择已发现证据，再询问相关 NPC。", targetTab: "investigation" },
  { id: "wrong-theory", title: "测试错误推理", detail: "提交一个不完整或错误的推理，查看缺口提示。", targetTab: "investigation" },
  { id: "correct-theory", title: "提交完整推理", detail: "补齐凶手、动机、手法和关键证据链。", targetTab: "investigation" },
  { id: "reveal", title: "查看解答", detail: "解锁最终结论节点并复盘完整因果链。", targetTab: "logic" }
];

function readPersisted(): PersistedOnboarding {
  if (typeof window === "undefined") return { dismissed: false, wrongTheorySubmitted: false };
  try {
    const value = localStorage.getItem(storageKey);
    const parsed = value ? JSON.parse(value) : {};
    return {
      dismissed: Boolean(parsed.dismissed),
      wrongTheorySubmitted: Boolean(parsed.wrongTheorySubmitted)
    };
  } catch {
    return { dismissed: false, wrongTheorySubmitted: false };
  }
}

function writePersisted(value: PersistedOnboarding) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey, JSON.stringify(value));
}

export function useGuidedOnboarding(input: {
  runtimeMode: RuntimeMode;
  progress: InvestigationProgress;
  session: PlayerSession | null;
  revealText: string;
}) {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [wrongTheorySubmitted, setWrongTheorySubmitted] = useState(false);
  const [manuallyOpened, setManuallyOpened] = useState(false);

  useEffect(() => {
    const saved = readPersisted();
    setDismissed(saved.dismissed);
    setWrongTheorySubmitted(saved.wrongTheorySubmitted);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || input.runtimeMode !== "static-demo") return;
    localStorage.setItem(storageKey, JSON.stringify({ dismissed, wrongTheorySubmitted }));
  }, [dismissed, input.runtimeMode, ready, wrongTheorySubmitted]);

  const interrogationCount = input.session?.interrogationLog.length || 0;
  const accepted = Boolean(input.session?.judgement?.accepted);
  const completed = useMemo<Record<OnboardingStep, boolean>>(
    () => ({
      observe: input.progress.observedCrimeWindow,
      search: input.progress.discoveredEvidence,
      question: interrogationCount > 0,
      challenge: input.progress.challengedTestimony,
      "wrong-theory": wrongTheorySubmitted,
      "correct-theory": accepted,
      reveal: accepted && Boolean(input.revealText)
    }),
    [accepted, input.progress, input.revealText, interrogationCount, wrongTheorySubmitted]
  );

  const firstPending = definitions.find((task) => !completed[task.id])?.id;
  const tasks = definitions.map<GuidedTask>((task) => ({
    ...task,
    state: completed[task.id] ? "complete" : task.id === firstPending ? "current" : "pending"
  }));

  return {
    tasks,
    currentTask: tasks.find((task) => task.state === "current") || tasks[tasks.length - 1],
    overlayOpen: ready && input.runtimeMode === "static-demo" && (!dismissed || manuallyOpened),
    dismiss: useCallback(() => {
      writePersisted({ dismissed: true, wrongTheorySubmitted });
      setDismissed(true);
      setManuallyOpened(false);
    }, [wrongTheorySubmitted]),
    reopen: useCallback(() => setManuallyOpened(true), []),
    recordTheoryResult: useCallback((acceptedTheory: boolean) => {
      if (!acceptedTheory) {
        const saved = readPersisted();
        const nextDismissed = dismissed || saved.dismissed;
        writePersisted({ dismissed: nextDismissed, wrongTheorySubmitted: true });
        if (nextDismissed) setDismissed(true);
        setWrongTheorySubmitted(true);
      }
    }, [dismissed])
  };
}
