"use client";

import { useMemo } from "react";
import type { InvestigationProgress, PlayerSession } from "@/lib/engine";

export type SuggestedAction = {
  phase: string;
  title: string;
  detail: string;
  targetTab: "events" | "investigation" | "logic" | "people";
};

export function getSuggestedAction(input: {
  progress: InvestigationProgress;
  session: PlayerSession | null;
  selectedSceneName?: string;
  discoveredEvidenceCount: number;
  revealText?: string;
}): SuggestedAction {
  const { progress, session, selectedSceneName, discoveredEvidenceCount, revealText } = input;

  if (!progress.observedCrimeWindow) {
    return {
      phase: "观察",
      title: "观察案发窗口",
      detail: "拖动时间轴到案发前后，先看 NPC、事件和案发点如何同步变化。",
      targetTab: "events"
    };
  }
  if (!session || !progress.joinedInvestigation) {
    return {
      phase: "加入",
      title: "加入调查",
      detail: "创建玩家调查会话后，搜索、询问和推理结果才会保存。",
      targetTab: "investigation"
    };
  }
  if (!progress.discoveredEvidence || discoveredEvidenceCount === 0) {
    return {
      phase: "搜索",
      title: "搜索地点证据",
      detail: selectedSceneName ? `当前地点：${selectedSceneName}。优先找可搜索标记。` : "点击地图上的建筑或证据 marker，打开调查面板。",
      targetTab: "investigation"
    };
  }
  if (!progress.challengedTestimony) {
    return {
      phase: "质询",
      title: "出示证据质询 NPC",
      detail: "选择已发现证据后询问 NPC，系统只给角色可记得的信息。",
      targetTab: "investigation"
    };
  }
  if (!progress.submittedTheory || !session?.judgement?.accepted) {
    return {
      phase: "推理",
      title: "提交完整推理链",
      detail: "推理需要覆盖凶手、动机、手法和关键证据链。失败只会显示缺口类型。",
      targetTab: "investigation"
    };
  }
  if (!revealText) {
    return {
      phase: "解答",
      title: "查看解答篇",
      detail: "推理通过后才会展开最终结论节点和完整因果链。",
      targetTab: "logic"
    };
  }
  return {
    phase: "完成",
    title: "复盘案件逻辑",
    detail: "查看 Deduction Graph、嫌疑人排除链和 Causal Trace。",
    targetTab: "logic"
  };
}

export function useDetectiveTownRuntimeView(input: Parameters<typeof getSuggestedAction>[0]) {
  return useMemo(() => ({ suggestedAction: getSuggestedAction(input) }), [
    input.discoveredEvidenceCount,
    input.progress,
    input.revealText,
    input.selectedSceneName,
    input.session
  ]);
}
