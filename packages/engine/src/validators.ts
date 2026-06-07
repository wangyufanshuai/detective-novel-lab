import type {
  CaseValidation,
  DeductionCase,
  EvidenceChallenge,
  ReasoningCoverage,
  ReasoningStep,
  SuspectMatrixRow,
  TimelineContradiction
} from "./types";

const emptyWords = new Set(["无", "没有", "未知", "不适用", "none", "no", ""]);

function hasContent(value?: string) {
  const text = (value || "").trim().toLowerCase();
  return Boolean(text) && !emptyWords.has(text);
}

function axisValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (["true", "yes", "有", "高", "强", "完整", "成立"].includes(text)) return true;
    if (["false", "no", "无", "低", "弱", "没有", "不成立"].includes(text)) return false;
  }
  return fallback;
}

function aliases(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") return [value];
  return [];
}

function evidenceMap(deductionCase: DeductionCase) {
  return new Map((deductionCase.evidence || []).map((item) => [item.id, item]));
}

function characterMap(deductionCase: DeductionCase) {
  return new Map((deductionCase.characters || []).map((item) => [item.id, item]));
}

function resolveCharacterId(deductionCase: DeductionCase, value: unknown) {
  if (typeof value !== "string") return "";
  if (deductionCase.characters.some((item) => item.id === value)) return value;
  return deductionCase.characters.find((item) => item.name === value)?.id || value;
}

function resolveEvidenceIds(deductionCase: DeductionCase, value: unknown) {
  const known = deductionCase.evidence || [];
  return aliases(value).map((raw) => known.find((item) => item.id === raw || item.title === raw)?.id || raw);
}

function evidenceIdsFromText(deductionCase: DeductionCase, text: string) {
  const hits = new Set<string>();
  for (const evidence of deductionCase.evidence || []) {
    if (text.includes(evidence.id) || text.includes(evidence.title)) hits.add(evidence.id);
    const short = evidence.id.match(/(?:^|[_-])([A-Z]?\d+)$/i)?.[1];
    if (short && new RegExp(`\\b${short}\\b`, "i").test(text)) hits.add(evidence.id);
  }
  return Array.from(hits);
}

export function getReasoningStepEvidenceIds(deductionCase: DeductionCase, step: ReasoningStep | string | unknown) {
  if (typeof step === "string") return evidenceIdsFromText(deductionCase, step);
  const raw = (step || {}) as Record<string, unknown>;
  return resolveEvidenceIds(deductionCase, raw.evidenceIds || raw.supportingEvidenceIds || raw.evidence || raw.keyEvidence);
}

export function deriveSuspectMatrix(deductionCase: DeductionCase): SuspectMatrixRow[] {
  const existing = Array.isArray(deductionCase.logicPuzzle?.suspectMatrix) ? deductionCase.logicPuzzle.suspectMatrix : [];
  const evidenceIds = new Set((deductionCase.evidence || []).map((item) => item.id));
  const exclusionByCharacter = new Map<string, string[]>();
  const exclusionChains = Array.isArray(deductionCase.logicPuzzle?.exclusionChains) ? deductionCase.logicPuzzle.exclusionChains : [];

  for (const chain of exclusionChains) {
    const raw = chain as unknown as Record<string, unknown>;
    const characterId = resolveCharacterId(deductionCase, chain.characterId || raw.suspectId || raw.suspect || raw.character);
    const ids = resolveEvidenceIds(deductionCase, chain.evidenceIds || raw.exclusionEvidenceIds || raw.exclusionEvidence || raw.evidence).filter((id) =>
      evidenceIds.has(id)
    );
    if (characterId && ids.length) {
      exclusionByCharacter.set(characterId, Array.from(new Set([...(exclusionByCharacter.get(characterId) || []), ...ids])));
    }
  }

  return (deductionCase.characters || [])
    .filter((character) => character.id !== "detective" && character.id !== "victim" && character.role !== "死者")
    .map((character) => {
      const declared = existing.find((row) => {
        const raw = row as unknown as Record<string, unknown>;
        return (
          row.characterId === character.id ||
          raw.suspectId === character.id ||
          raw.suspect === character.id ||
          raw.suspect === character.name ||
          raw.name === character.name
        );
      });
      const raw = (declared || {}) as unknown as Record<string, unknown>;
      const declaredExclusions = resolveEvidenceIds(
        deductionCase,
        declared?.excludedByEvidenceIds || raw.excludedBy || raw.exclusionEvidenceIds || raw.exclusionEvidence || raw.alibiEvidenceIds
      ).filter((id) => evidenceIds.has(id));
      const excludedByEvidenceIds = declaredExclusions.length ? declaredExclusions : exclusionByCharacter.get(character.id) || [];
      const motive = axisValue(declared?.motive, hasContent(character.motive));
      const means = axisValue(declared?.means, hasContent(character.means));
      const opportunity = axisValue(declared?.opportunity, hasContent(character.opportunity));
      return {
        characterId: character.id,
        name: character.name,
        motive,
        means,
        opportunity,
        excludedByEvidenceIds,
        completeAndUnexcluded: motive && means && opportunity && excludedByEvidenceIds.length === 0,
        isCulprit: character.isCulprit
      };
    });
}

export function getTimelineContradictions(deductionCase: DeductionCase, discoveredEvidenceIds: string[] = []): TimelineContradiction[] {
  const discovered = new Set(discoveredEvidenceIds);
  return (deductionCase.truth?.trueTimeline || [])
    .filter((event) => event.publicVersion && event.contradictedByEvidenceIds?.length)
    .map((event) => ({
      eventId: event.id,
      time: event.time,
      publicVersion: event.publicVersion,
      trueEvent: event.event,
      evidenceIds: event.contradictedByEvidenceIds,
      revealed: event.contradictedByEvidenceIds.some((id) => discovered.has(id))
    }));
}

export function getReasoningCoverage(deductionCase: DeductionCase, selectedEvidenceIds: string[] = []): ReasoningCoverage {
  const required = new Set<string>();
  for (const id of deductionCase.truth?.decisiveEvidenceIds || []) required.add(id);
  const chain = Array.isArray(deductionCase.logicPuzzle?.criticalReasoningChain) ? deductionCase.logicPuzzle.criticalReasoningChain : [];
  for (const step of chain) for (const id of getReasoningStepEvidenceIds(deductionCase, step)) required.add(id);
  const selected = new Set(selectedEvidenceIds);
  const requiredEvidenceIds = Array.from(required);
  const coveredEvidenceIds = requiredEvidenceIds.filter((id) => selected.has(id));
  const missingEvidenceIds = requiredEvidenceIds.filter((id) => !selected.has(id));
  return {
    requiredEvidenceIds,
    coveredEvidenceIds,
    missingEvidenceIds,
    coverageRatio: requiredEvidenceIds.length ? coveredEvidenceIds.length / requiredEvidenceIds.length : 1
  };
}

export function validateCase(deductionCase: DeductionCase): CaseValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixSuggestions: string[] = [];
  const characters = characterMap(deductionCase);
  const evidence = evidenceMap(deductionCase);
  const culpritFlags = (deductionCase.characters || []).filter((character) => character.isCulprit);

  if (culpritFlags.length !== 1) {
    errors.push(`Culprit flag must be unique; found ${culpritFlags.length}.`);
    fixSuggestions.push("Ensure exactly one character has isCulprit=true.");
  }
  const culprit = characters.get(deductionCase.truth?.culpritId);
  if (!culprit) errors.push("truth.culpritId must reference an existing character.");
  else if (!culprit.isCulprit) errors.push("truth.culpritId must point to the character marked isCulprit=true.");

  const decisive = deductionCase.truth?.decisiveEvidenceIds || [];
  const missingDecisive = decisive.filter((id) => !evidence.has(id));
  if (missingDecisive.length) errors.push(`Decisive evidence does not exist: ${missingDecisive.join(", ")}.`);
  const undiscoverableDecisive = decisive.filter((id) => evidence.has(id) && !evidence.get(id)?.discoverable);
  if (undiscoverableDecisive.length) errors.push(`Decisive evidence must be discoverable: ${undiscoverableDecisive.join(", ")}.`);
  if ((deductionCase.evidence || []).filter((item) => item.isKey && item.discoverable).length < 3) errors.push("At least 3 discoverable key clues are required.");

  for (const scene of deductionCase.scenes || []) {
    for (const id of scene.evidenceIds || []) if (!evidence.has(id)) errors.push(`Scene "${scene.name}" references missing evidence ${id}.`);
  }

  const suspectMatrix = deriveSuspectMatrix(deductionCase);
  const complete = suspectMatrix.filter((row) => row.completeAndUnexcluded);
  if (complete.length !== 1 || complete[0]?.characterId !== deductionCase.truth?.culpritId) {
    errors.push("The suspect matrix must leave exactly one complete and unexcluded suspect, and it must be truth.culpritId.");
    fixSuggestions.push("Add exclusion evidence for every non-culprit or lower at least one MMO axis.");
  }
  for (const row of suspectMatrix) {
    if (!row.isCulprit && row.motive && row.means && row.opportunity && row.excludedByEvidenceIds.length === 0) {
      errors.push(`Non-culprit "${row.name}" has motive/means/opportunity but no discoverable exclusion evidence.`);
    }
  }

  const exclusionChains = Array.isArray(deductionCase.logicPuzzle?.exclusionChains) ? deductionCase.logicPuzzle.exclusionChains : [];
  for (const chain of exclusionChains) {
    const raw = chain as unknown as Record<string, unknown>;
    const characterId = resolveCharacterId(deductionCase, chain.characterId || raw.suspectId || raw.suspect || raw.character);
    const ids = resolveEvidenceIds(deductionCase, chain.evidenceIds || raw.exclusionEvidenceIds || raw.exclusionEvidence || raw.evidence);
    if (!characters.has(characterId)) errors.push(`Exclusion chain references missing character ${characterId || "undefined"}.`);
    if (!ids.length) errors.push(`Exclusion chain ${characterId || "undefined"} has no evidence.`);
    for (const id of ids) if (!evidence.has(id) || !evidence.get(id)?.discoverable) errors.push(`Exclusion chain ${characterId} uses missing or undiscoverable evidence ${id}.`);
  }

  const criticalReasoningChain = Array.isArray(deductionCase.logicPuzzle?.criticalReasoningChain) ? deductionCase.logicPuzzle.criticalReasoningChain : [];
  for (const step of criticalReasoningChain) {
    const raw = (step || {}) as Record<string, unknown>;
    const conclusion = typeof step === "string" ? step : String(raw.conclusion || raw.step || raw.reason || "unnamed reasoning step");
    const ids = getReasoningStepEvidenceIds(deductionCase, step);
    if (!ids.length) errors.push(`Critical reasoning "${conclusion}" has no supporting evidence.`);
    for (const id of ids) if (!evidence.has(id) || !evidence.get(id)?.discoverable) errors.push(`Critical reasoning "${conclusion}" depends on missing or undiscoverable evidence ${id}.`);
  }

  const timelineContradictions = getTimelineContradictions(deductionCase);
  if (!deductionCase.truth?.trueTimeline?.length) errors.push("True timeline cannot be empty.");
  if (!timelineContradictions.length) errors.push("At least one public timeline/testimony contradiction must be discoverable by evidence.");

  const discoverableEvidenceIds = (deductionCase.evidence || []).filter((item) => item.discoverable).map((item) => item.id);
  const reasoningCoverage = getReasoningCoverage(deductionCase, discoverableEvidenceIds);
  if (reasoningCoverage.requiredEvidenceIds.length < 3) warnings.push("The reasoning chain is short; at least 3 evidence-backed steps are recommended.");
  if ((deductionCase.logicPuzzle?.redHerrings || []).length < 2) warnings.push("Few red herrings; the demo may feel thin.");

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    issues: errors,
    suspectMatrix,
    timelineContradictions,
    reasoningCoverage,
    fixSuggestions
  };
}

export function evaluateEvidenceChallenge(deductionCase: DeductionCase, characterId: string, evidenceId: string): EvidenceChallenge {
  const character = characterMap(deductionCase).get(characterId);
  const evidence = evidenceMap(deductionCase).get(evidenceId);
  const exposedContradictions = getTimelineContradictions(deductionCase, [evidenceId])
    .filter((item) => item.revealed)
    .map((item) => item.eventId);
  const hit =
    Boolean(character && evidence) &&
    (evidence!.relatedCharacterIds.includes(characterId) ||
      evidence!.contradicts.includes(characterId) ||
      character!.contradictionTriggers.includes(evidenceId) ||
      exposedContradictions.length > 0);
  return {
    hit,
    characterId,
    evidenceId,
    exposedContradictions,
    guidance: hit
      ? "Evidence hits a contradiction for this character. The answer may evade, partially admit, or revise testimony, but must not reveal the full truth."
      : "Evidence does not directly hit this character. Keep the answer within character knowledge."
  };
}

export function evidenceByScene(deductionCase: DeductionCase, sceneId: string) {
  const scene = deductionCase.scenes.find((item) => item.id === sceneId);
  if (!scene) return [];
  const ids = new Set(scene.evidenceIds);
  return deductionCase.evidence.filter((item) => ids.has(item.id) && item.discoverable);
}
