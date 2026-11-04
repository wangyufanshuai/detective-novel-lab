import type { CaseRouteCertificate } from "./types";
import { certifyPlayableCase, spoilerSafeCaseRouteCertificate } from "./route-certificate";
import type { CaseFromLog, CaseTriggerKind, PlayerSession, WorldEvent } from "./world-types";

export type InvestigationRoomProjectionMode = "review" | "player";

export type InvestigationRoomProjectionLink = {
  routeStepId: string;
  evidenceNodeIds: string[];
  sourceEventIds: string[];
};

export type InvestigationRoomProjection = {
  schema: "investigation-room-projection.v1";
  roomId: string;
  mode: InvestigationRoomProjectionMode;
  caseId: string;
  triggerKind?: CaseTriggerKind;
  triggeredEventId?: string;
  locationId?: string;
  routeStepIds: string[];
  evidenceNodeIds: string[];
  sourceEventIds: string[];
  links: InvestigationRoomProjectionLink[];
  integrity: {
    sourceBacked: boolean;
    routeCertified: boolean;
    triggerResolved: boolean;
    sourceEventsResolved: boolean;
    traceable: boolean;
  };
};

export type InvestigationRoomProjectionOptions = {
  roomId?: string;
  mode?: InvestigationRoomProjectionMode;
  session?: PlayerSession | null;
  solved?: boolean;
};

export const DEFAULT_INVESTIGATION_ROOM_ID = "fog-lamp-evidence-room";

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function evidenceNodeId(evidenceId: string, index: number, solved: boolean) {
  return solved ? `evidence-node:${evidenceId}` : `evidence-node:locked-${index + 1}`;
}

function projectionSourceEventIds(caseFromLog: CaseFromLog, certificate: CaseRouteCertificate) {
  return unique([
    ...(caseFromLog.sourceEventIds || []),
    ...(caseFromLog.sourceMap?.sourceEventIds || []),
    ...certificate.steps.flatMap((step) => step.eventIds)
  ]);
}

function triggerIdFor(caseFromLog: CaseFromLog) {
  return caseFromLog.triggeredEventId || undefined;
}

/**
 * Project one certified investigation route into a deterministic 3D room contract.
 *
 * Review mode keeps the source identifiers needed to trace a render back to the
 * world log. Player mode uses the same route shape but masks hidden event,
 * evidence, and memory identifiers until the session has solved the case.
 */
export function buildInvestigationRoomProjection(
  caseFromLog: CaseFromLog,
  events: WorldEvent[] = [],
  options: InvestigationRoomProjectionOptions = {}
): InvestigationRoomProjection {
  const mode = options.mode || "player";
  const solved = options.solved ?? Boolean(options.session?.judgement?.accepted);
  const certificate = certifyPlayableCase(caseFromLog, events, options.session);
  const safeCertificate = mode === "review" || solved
    ? certificate
    : spoilerSafeCaseRouteCertificate(certificate, false);
  const rawEvidenceIds = unique(certificate.steps.flatMap((step) => step.evidenceIds));
  const rawEvidenceNodeIds = new Map(rawEvidenceIds.map((id, index) => [id, evidenceNodeId(id, index, mode === "review" || solved)]));
  const routeStepIds = safeCertificate.steps.map((step) => step.id);
  const evidenceNodeIds = Array.from(rawEvidenceNodeIds.values());
  const sourceEventIds = mode === "review" || solved ? projectionSourceEventIds(caseFromLog, certificate) : [];
  const triggerId = triggerIdFor(caseFromLog);
  const triggerEvent = triggerId ? events.find((event) => event.id === triggerId) : undefined;
  const exposedTriggerId = mode === "review" || solved || (triggerEvent ? !triggerEvent.hidden : false) ? triggerId : undefined;
  const triggerResolved = Boolean(!exposedTriggerId || triggerEvent);
  const sourceEventsResolved = sourceEventIds.every((id) => events.some((event) => event.id === id));
  const links = safeCertificate.steps.map((safeStep, index) => {
    const rawStep = certificate.steps[index];
    const stepEvidenceNodeIds = rawStep.evidenceIds
      .map((id) => rawEvidenceNodeIds.get(id))
      .filter((id): id is string => Boolean(id));
    return {
      routeStepId: safeStep.id,
      evidenceNodeIds: stepEvidenceNodeIds,
      sourceEventIds: mode === "review" || solved ? unique(rawStep.eventIds) : []
    };
  });
  const triggerLocationVisible = mode === "review" || solved || (triggerEvent ? !triggerEvent.hidden : false);
  const locationId = (triggerLocationVisible ? triggerEvent?.locationId : undefined)
    || caseFromLog.generationProfile.sceneLocationId
    || safeCertificate.steps.find((step) => step.locationId)?.locationId;
  const routeStepIdsPresent = routeStepIds.length > 0;
  const traceable = mode === "review"
    && Boolean(triggerId)
    && triggerResolved
    && sourceEventsResolved
    && certificate.routeCertified
    && routeStepIdsPresent;

  return {
    schema: "investigation-room-projection.v1",
    roomId: options.roomId || DEFAULT_INVESTIGATION_ROOM_ID,
    mode,
    caseId: caseFromLog.id,
    triggerKind: caseFromLog.triggerKind || caseFromLog.deductionCase.triggerKind,
    triggeredEventId: exposedTriggerId,
    locationId,
    routeStepIds,
    evidenceNodeIds,
    sourceEventIds,
    links,
    integrity: {
      sourceBacked: certificate.sourceBacked,
      routeCertified: certificate.routeCertified,
      triggerResolved,
      sourceEventsResolved,
      traceable
    }
  };
}
