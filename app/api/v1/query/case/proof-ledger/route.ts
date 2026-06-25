import { errorResponse, fail, ok } from "@/app/api/v1/_utils";
import {
  buildCaseTruthLedger,
  certifyPlayableCase,
  evaluateCaseProofCoverage,
  spoilerSafeCaseProofCoverage,
  spoilerSafeCaseRouteCertificate,
  spoilerSafeCaseTruthLedger
} from "@/lib/engine";
import { worldRepository } from "@/lib/world/repository";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const caseId = url.searchParams.get("caseId");
    const sessionId = url.searchParams.get("sessionId");
    const includeCertificate = url.searchParams.get("includeCertificate") === "true";
    if (!caseId) return fail("BAD_REQUEST", "caseId is required");
    const caseFromLog = worldRepository.getCase(caseId);
    if (!caseFromLog) return fail("CASE_NOT_FOUND", "Case not found", 404);
    const events = worldRepository.getEvents(caseFromLog.worldId);
    const session = sessionId ? worldRepository.getSession(sessionId) : null;
    const ledger = buildCaseTruthLedger(caseFromLog, events);
    const solved = Boolean(session?.judgement?.accepted);
    const coverage = evaluateCaseProofCoverage(ledger, {
      discoveredEvidenceIds: session?.discoveredEvidenceIds || [],
      selectedEvidenceIds: session?.submittedTheory?.evidenceIds,
      challengedCharacterIds: session?.interrogationLog.filter((entry) => entry.challenge?.hit).map((entry) => entry.characterId) || [],
      solved
    });
    const data = {
      ledger: spoilerSafeCaseTruthLedger(ledger, solved),
      coverage: spoilerSafeCaseProofCoverage(coverage, solved)
    };
    if (includeCertificate) {
      return ok({
        ...data,
        certificate: spoilerSafeCaseRouteCertificate(certifyPlayableCase(caseFromLog, events, session), solved)
      });
    }
    return ok(data);
  } catch (error) {
    return errorResponse(error);
  }
}
