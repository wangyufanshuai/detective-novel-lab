import { judgeTheory } from "./judgement";
import { evaluateSessionProofCoverage } from "./proof-ledger";
import { certifyPlayableCase } from "./route-certificate";
import { evaluateEvidenceChallenge } from "./validators";
import type { EvidenceChallenge, PlayerTheory } from "./types";
import type {
  CaseAutoSolveFailure,
  CaseAutoSolveFailureKind,
  CaseAutoSolveReport,
  CaseAutoSolveStep,
  CaseAutoSolveSummary,
  CaseFromLog,
  InterrogationLogEntry,
  PlayerSession,
  WorldEvent
} from "./world-types";

type AutoSolveOptions = {
  sessionId?: string;
  playerId?: string;
  displayName?: string;
  now?: string;
  dryRun?: boolean;
};

const autoSolveTimestamp = "1970-01-01T00:00:00.000Z";

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function failureKind(kind: string): CaseAutoSolveFailureKind {
  if (kind === "witness") return "witness";
  if (kind === "challenge") return "challenge";
  if (kind === "exclusion") return "exclusion";
  if (kind === "source") return "source";
  if (kind === "search") return "search";
  if (kind === "submit") return "submit";
  return "certificate";
}

function makeSession(caseFromLog: CaseFromLog, options: AutoSolveOptions): PlayerSession {
  const now = options.now || autoSolveTimestamp;
  return {
    id: options.sessionId || `auto-session:${caseFromLog.id}`,
    worldId: caseFromLog.worldId,
    caseId: caseFromLog.id,
    playerId: options.playerId || "auto-player",
    displayName: options.displayName || "Auto Player",
    discoveredEvidenceIds: [],
    interrogationLog: [],
    createdAt: now,
    updatedAt: now
  };
}

function makeFailure(input: CaseAutoSolveFailure): CaseAutoSolveFailure {
  return {
    ...input,
    missingEvidenceIds: unique(input.missingEvidenceIds),
    missingObligationIds: unique(input.missingObligationIds)
  };
}

function failureFromCertificateBlocker(blocker: { kind: string; label: string; detail: string; missingEvidenceIds: string[]; missingObligationIds: string[]; target: CaseAutoSolveFailure["target"] }) {
  return makeFailure({
    kind: failureKind(blocker.kind),
    label: blocker.label,
    detail: blocker.detail,
    missingEvidenceIds: blocker.missingEvidenceIds,
    missingObligationIds: blocker.missingObligationIds,
    target: blocker.target
  });
}

function spoilerSafeFailure(failure: CaseAutoSolveFailure): Pick<CaseAutoSolveFailure, "kind" | "label" | "detail" | "target"> {
  return {
    kind: failure.kind,
    label: failure.label,
    detail: failure.detail,
    target: failure.target
  };
}

function testimonyChallengeHit(caseFromLog: CaseFromLog, characterId: string, evidenceId: string) {
  return caseFromLog.testimonies.some((item) => item.characterId === characterId && item.contradictionEvidenceIds.includes(evidenceId));
}

function challengeFor(caseFromLog: CaseFromLog, characterId: string, evidenceId: string): EvidenceChallenge {
  const engineChallenge = evaluateEvidenceChallenge(caseFromLog.deductionCase, characterId, evidenceId);
  const testimonyHit = testimonyChallengeHit(caseFromLog, characterId, evidenceId);
  if (engineChallenge.hit || !testimonyHit) return engineChallenge;
  return {
    ...engineChallenge,
    hit: true,
    guidance: "Evidence matches this witness testimony contradiction in the local case record."
  };
}

function makeInterrogationEntry(input: {
  sessionId: string;
  caseFromLog: CaseFromLog;
  characterId: string;
  evidenceId?: string;
  stepIndex: number;
  now: string;
}): InterrogationLogEntry {
  const character = input.caseFromLog.deductionCase.characters.find((item) => item.id === input.characterId);
  const testimony = input.caseFromLog.testimonies.find((item) => item.characterId === input.characterId);
  const challenge = input.evidenceId ? challengeFor(input.caseFromLog, input.characterId, input.evidenceId) : undefined;
  return {
    id: `auto-iq:${input.caseFromLog.id}:${input.stepIndex}`,
    sessionId: input.sessionId,
    characterId: input.characterId,
    question: input.evidenceId ? "Auto-solve challenge with certified evidence." : "Auto-solve baseline witness question.",
    evidenceId: input.evidenceId,
    answer: challenge?.hit
      ? `${character?.name || input.characterId} revises the statement after the certified contradiction evidence is presented.`
      : `${character?.name || input.characterId} answers within the local testimony and memory scope.`,
    memoryEventIds: testimony?.memoryIds || [],
    challenge,
    createdAt: input.now
  };
}

function buildSummary(report: Omit<CaseAutoSolveReport, "summary">): CaseAutoSolveSummary {
  const failures = report.failures.map(spoilerSafeFailure);
  const proofCoverage = report.proofCoverage;
  return {
    caseId: report.caseId,
    passed: report.passed,
    routeCertified: report.certificate.routeCertified,
    autoTheoryAccepted: Boolean(report.judgement?.accepted),
    stepCount: report.steps.length,
    discoveredEvidenceCount: report.session.discoveredEvidenceIds.length,
    questionedWitnessCount: new Set(report.session.interrogationLog.map((item) => item.characterId)).size,
    challengeHitCount: report.session.interrogationLog.filter((item) => item.challenge?.hit).length,
    selectedEvidenceCount: report.theory?.evidenceIds.length || 0,
    coveredRequiredObligations: proofCoverage?.coveredRequired || 0,
    totalRequiredObligations: proofCoverage?.totalRequired || report.certificate.totalRequiredObligations,
    proofCoverageComplete: Boolean(proofCoverage?.complete),
    failureKinds: unique(report.failures.map((item) => item.kind)),
    failures
  };
}

function completeReport(input: Omit<CaseAutoSolveReport, "summary">): CaseAutoSolveReport {
  return {
    ...input,
    summary: buildSummary(input)
  };
}

export function spoilerSafeCaseAutoSolveReport(report: CaseAutoSolveReport): CaseAutoSolveSummary {
  return report.summary;
}

export function autoSolvePlayableCase(caseFromLog: CaseFromLog, events: WorldEvent[] = [], options: AutoSolveOptions = {}): CaseAutoSolveReport {
  const now = options.now || autoSolveTimestamp;
  const certificate = certifyPlayableCase(caseFromLog, events);
  let session = makeSession(caseFromLog, { ...options, now });
  const steps: CaseAutoSolveStep[] = [];
  const failures: CaseAutoSolveFailure[] = [];

  if (!certificate.routeCertified) {
    failures.push(...certificate.blockers.map(failureFromCertificateBlocker));
    if (!failures.length) {
      failures.push(makeFailure({
        kind: "certificate",
        label: "Route certificate failed",
        detail: "The case did not produce a passing Route Certificate.",
        missingEvidenceIds: [],
        missingObligationIds: [],
        target: "logic"
      }));
    }
    return completeReport({
      caseId: caseFromLog.id,
      passed: false,
      dryRun: options.dryRun !== false,
      certificate,
      steps,
      failures,
      session
    });
  }

  let selectedEvidenceIds: string[] = [];
  let theory: PlayerTheory | undefined;
  let judgement = certificate.judgement;

  for (const [index, step] of certificate.steps.entries()) {
    const nextStep: CaseAutoSolveStep = {
      id: `auto:${step.id}`,
      kind: step.kind,
      label: step.label,
      detail: step.detail,
      complete: false,
      evidenceIds: step.evidenceIds,
      characterIds: step.characterIds,
      obligationIds: step.obligationIds
    };

    if (step.kind === "search") {
      const discoverable = step.evidenceIds.filter((evidenceId) => caseFromLog.deductionCase.evidence.some((item) => item.id === evidenceId && item.discoverable));
      session = {
        ...session,
        discoveredEvidenceIds: unique([...session.discoveredEvidenceIds, ...discoverable]),
        updatedAt: now
      };
      nextStep.complete = discoverable.length === step.evidenceIds.length && step.evidenceIds.length > 0;
      if (!nextStep.complete) {
        failures.push(makeFailure({
          kind: "search",
          label: "Search step could not discover required evidence",
          detail: "A certified search step referenced evidence that is not discoverable.",
          missingEvidenceIds: step.evidenceIds.filter((id) => !discoverable.includes(id)),
          missingObligationIds: step.obligationIds,
          target: "evidence"
        }));
      }
    } else if (step.kind === "question") {
      const entries = step.characterIds.map((characterId, characterIndex) => makeInterrogationEntry({
        sessionId: session.id,
        caseFromLog,
        characterId,
        stepIndex: index * 10 + characterIndex,
        now
      }));
      session = { ...session, interrogationLog: [...session.interrogationLog, ...entries], updatedAt: now };
      nextStep.complete = entries.length > 0;
      if (!nextStep.complete) {
        failures.push(makeFailure({
          kind: "witness",
          label: "Question step has no witness",
          detail: "The route needs at least one witness question before challenge.",
          missingEvidenceIds: [],
          missingObligationIds: step.obligationIds,
          target: "suspects"
        }));
      }
    } else if (step.kind === "challenge") {
      let challengeEntry: InterrogationLogEntry | undefined;
      for (const characterId of step.characterIds) {
        for (const evidenceId of step.evidenceIds.filter((id) => session.discoveredEvidenceIds.includes(id))) {
          const entry = makeInterrogationEntry({
            sessionId: session.id,
            caseFromLog,
            characterId,
            evidenceId,
            stepIndex: index,
            now
          });
          challengeEntry = entry;
          if (entry.challenge?.hit) break;
        }
        if (challengeEntry?.challenge?.hit) break;
      }
      if (challengeEntry) {
        session = { ...session, interrogationLog: [...session.interrogationLog, challengeEntry], updatedAt: now };
        nextStep.challengeHit = Boolean(challengeEntry.challenge?.hit);
        nextStep.complete = Boolean(challengeEntry.challenge?.hit);
      }
      if (!nextStep.complete) {
        failures.push(makeFailure({
          kind: "challenge",
          label: "Challenge step missed",
          detail: "The auto player could not hit a certified testimony contradiction.",
          missingEvidenceIds: step.evidenceIds.filter((id) => !session.discoveredEvidenceIds.includes(id)),
          missingObligationIds: step.obligationIds,
          target: "method"
        }));
      }
    } else if (step.kind === "select-evidence") {
      selectedEvidenceIds = unique([...selectedEvidenceIds, ...step.evidenceIds.filter((id) => session.discoveredEvidenceIds.includes(id))]);
      nextStep.complete = selectedEvidenceIds.length === step.evidenceIds.length && step.evidenceIds.length > 0;
      if (!nextStep.complete) {
        failures.push(makeFailure({
          kind: "submit",
          label: "Theory evidence selection is incomplete",
          detail: "The auto player could not select every certified proof clue.",
          missingEvidenceIds: step.evidenceIds.filter((id) => !selectedEvidenceIds.includes(id)),
          missingObligationIds: step.obligationIds,
          target: "logic"
        }));
      }
    } else if (step.kind === "submit") {
      theory = {
        culpritId: caseFromLog.deductionCase.truth.culpritId,
        motive: caseFromLog.deductionCase.truth.motive,
        method: caseFromLog.deductionCase.truth.method,
        evidenceIds: selectedEvidenceIds.length ? selectedEvidenceIds : certificate.theoryEvidenceIds
      };
      judgement = judgeTheory(caseFromLog.deductionCase, theory, session.discoveredEvidenceIds);
      session = { ...session, submittedTheory: theory, judgement, updatedAt: now };
      nextStep.complete = judgement.accepted;
      if (!nextStep.complete) {
        failures.push(makeFailure({
          kind: "submit",
          label: "Auto theory was rejected",
          detail: judgement.explanation,
          missingEvidenceIds: judgement.proofCoverage?.gaps.flatMap((item) => item.missingEvidenceIds) || [],
          missingObligationIds: judgement.proofCoverage?.missingObligationIds || [],
          target: "logic"
        }));
      }
    }

    steps.push(nextStep);
  }

  const proofCoverage = evaluateSessionProofCoverage(caseFromLog, events, session);
  if (!proofCoverage.complete) {
    failures.push(makeFailure({
      kind: "coverage",
      label: "Proof coverage incomplete after auto solve",
      detail: "The auto player finished the route but did not cover every required Truth Ledger obligation.",
      missingEvidenceIds: proofCoverage.gaps.flatMap((item) => item.missingEvidenceIds),
      missingObligationIds: proofCoverage.missingObligationIds,
      target: "logic"
    }));
  }

  const passed = Boolean(judgement?.accepted) && proofCoverage.complete && failures.length === 0;
  return completeReport({
    caseId: caseFromLog.id,
    passed,
    dryRun: options.dryRun !== false,
    certificate,
    steps,
    failures,
    session,
    theory,
    judgement,
    proofCoverage
  });
}
