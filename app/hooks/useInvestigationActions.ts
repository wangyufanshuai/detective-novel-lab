"use client";

import { useMemo } from "react";
import type { DeductionCase, Evidence, PlayerSession } from "@/lib/engine";

export type EvidenceImpact = {
  tone: "neutral" | "support" | "contradiction" | "key";
  label: string;
  detail: string;
};

const missingMap: Array<[RegExp, string]> = [
  [/culprit|killer|suspect/i, "Culprit selection"],
  [/motive/i, "Motive explanation"],
  [/method|means|weapon|tool/i, "Method and means"],
  [/evidence|clue/i, "Key evidence chain"],
  [/exclude|exclusion|alibi/i, "Non-culprit exclusion"]
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
      .join(", ") || "";

  if (contradicts.length > 0) {
    return {
      tone: "contradiction",
      label: "Can challenge testimony or timeline",
      detail: relatedNames ? `Present this clue to ${relatedNames} and check whether the statement still holds.` : "Compare this clue with public testimony and timeline records."
    };
  }
  if (isRequired) {
    return {
      tone: "key",
      label: "High-value reasoning clue",
      detail: relatedNames ? `This clue links to ${relatedNames}; add it to the key evidence chain.` : "This clue is likely part of the complete reasoning chain, but it does not reveal the truth by itself."
    };
  }
  if (supports.length > 0) {
    return {
      tone: "support",
      label: "Supports a local conclusion",
      detail: relatedNames ? `This clue is connected to ${relatedNames}'s action or statement.` : "Use it to support the evidence chain."
    };
  }
  return {
    tone: "neutral",
    label: "Context clue",
    detail: "Use it to reconstruct scene context and rule out weak theories."
  };
}

export function summarizeJudgementGaps(missing: string[] = []) {
  const labels = new Set<string>();
  for (const item of missing) {
    const hit = missingMap.find(([pattern]) => pattern.test(item));
    labels.add(hit?.[1] || "Reasoning chain completeness");
  }
  if (!labels.size) labels.add("Reasoning chain completeness");
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
