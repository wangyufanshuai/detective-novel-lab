"use client";

import { useMemo } from "react";
import type { DeductionCase, Evidence, PlayerSession } from "@/lib/engine";

export type EvidenceImpact = {
  tone: "neutral" | "support" | "contradiction" | "key";
  label: string;
  detail: string;
};

const missingMap: Array<[RegExp, string]> = [
  [/culprit|凶手|犯人/i, "凶手选择"],
  [/motive|动机/i, "动机说明"],
  [/method|means|手法|工具/i, "作案手法"],
  [/evidence|clue|证据|线索/i, "关键证据链"],
  [/exclude|排除/i, "嫌疑人排除链"]
];

export function describeEvidenceImpact(evidence: Evidence, deductionCase: DeductionCase | null): EvidenceImpact {
  const clueOrder = new Set(deductionCase?.logicPuzzle.requiredClueOrder || []);
  const isRequired = clueOrder.has(evidence.id);
  const supports = evidence.supportsConclusion || [];
  const contradicts = evidence.contradicts || [];
  const relatedNames =
    deductionCase?.characters
      .filter((character) => evidence.relatedCharacterIds.includes(character.id))
      .map((character) => character.name)
      .slice(0, 3)
      .join("、") || "";

  if (contradicts.length > 0) {
    return {
      tone: "contradiction",
      label: "可能反驳证词或时间线",
      detail: relatedNames ? `可向 ${relatedNames} 出示此证据，检查其证词是否自洽。` : "建议和公开证词、时间线记录交叉比对。"
    };
  }
  if (isRequired) {
    return {
      tone: "key",
      label: "高价值线索",
      detail: relatedNames ? `它关联 ${relatedNames}，适合加入关键证据链。` : "它可能是完整推理链的一环，但不会单独给出真相。"
    };
  }
  if (supports.length > 0) {
    return {
      tone: "support",
      label: "可支持局部结论",
      detail: relatedNames ? `它与 ${relatedNames} 的行动或说法有关。` : "适合放入证据链中验证。"
    };
  }
  return {
    tone: "neutral",
    label: "背景线索",
    detail: "可用于还原场景和筛除不相关假设。"
  };
}

export function summarizeJudgementGaps(missing: string[] = []) {
  const labels = new Set<string>();
  for (const item of missing) {
    const hit = missingMap.find(([pattern]) => pattern.test(item));
    labels.add(hit?.[1] || "推理链完整性");
  }
  if (!labels.size) labels.add("推理链完整性");
  return Array.from(labels);
}

export function hasContradictionHit(session: PlayerSession | null, characterId: string) {
  return Boolean(session?.interrogationLog.some((entry) => entry.characterId === characterId && entry.challenge?.hit));
}

export function useInvestigationView(input: {
  deductionCase: DeductionCase | null;
  discoveredEvidence: Evidence[];
  session: PlayerSession | null;
}) {
  return useMemo(() => {
    const evidenceImpacts = new Map(
      input.discoveredEvidence.map((item) => [item.id, describeEvidenceImpact(item, input.deductionCase)])
    );
    return {
      evidenceImpacts,
      judgementGaps: summarizeJudgementGaps(input.session?.judgement?.missing)
    };
  }, [input.deductionCase, input.discoveredEvidence, input.session?.judgement?.missing]);
}
