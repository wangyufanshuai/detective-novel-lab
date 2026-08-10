import { errorResponse, fail, ok, readJson } from "@/app/api/v1/_utils";
import { isRuntimeInvestigationAuthority, loadRuntimeWorld, publicRuntime, publicWorld, recordRuntimeCampaignRecoveryDecision, recordRuntimeInvestigatorHeadquartersDecision, recordRuntimeInvestigationOperationsDecision, recordRuntimePlayerResourceCommitmentDecision, recordRuntimeWorldArcDirectiveDecision, recordRuntimeWorldEventOfferDecision, recordRuntimeWorldLeadDecision, stepRuntime } from "@/app/api/v1/_town-runtime";
import { worldRepository } from "@/lib/world/repository";

export async function POST(request: Request) {
  try {
    const body = await readJson<{
      worldId?: string;
      steps?: number;
      worldLeadDecision?: { sessionId?: string; action?: "follow" | "skip" | "resolve" };
      worldArcDirectiveDecision?: { choice?: "support" | "contain" | "defer" };
      playerResourceCommitmentDecision?: { sessionId?: string; choice?: "police-time" | "informant-trust" | "evidence-integrity" | "none"; allocations?: Array<"search" | "question" | "challenge"> };
      worldEventOfferDecision?: { choice?: "accept" | "decline" };
      campaignRecoveryDecision?: { choice?: "start" | "defer" | "use-headquarters" };
      investigatorHeadquartersDecision?: { choice?: "field-search" | "witness-work" | "contradiction-analysis" | "evidence-handling" | "institutional-access" };
    }>(request, {});
    if (!body.worldId) return fail("BAD_REQUEST", "worldId is required");
    const loaded = loadRuntimeWorld(body.worldId);
    if (!loaded) return fail("WORLD_NOT_FOUND", "World not found", 404);
    const decisionCount = [body.worldLeadDecision, body.worldArcDirectiveDecision, body.playerResourceCommitmentDecision, body.worldEventOfferDecision, body.campaignRecoveryDecision, body.investigatorHeadquartersDecision].filter(Boolean).length;
    if (decisionCount > 1) {
      return fail("BAD_REQUEST", "Only one zero-tick player decision can be submitted at a time");
    }
    if (body.campaignRecoveryDecision) {
      if (body.steps !== 0) return fail("BAD_REQUEST", "campaignRecoveryDecision requires steps: 0");
      if (!body.campaignRecoveryDecision.choice) return fail("BAD_REQUEST", "campaignRecoveryDecision requires choice");
      const result = recordRuntimeCampaignRecoveryDecision(loaded.world, loaded.events, { choice: body.campaignRecoveryDecision.choice });
      if (!result) return fail("CAMPAIGN_RECOVERY_NOT_READY", "No ready campaign recovery action is available", 409);
      return ok({
        runtime: publicRuntime(result.runtime),
        events: [],
        queue: result.queue,
        world: publicWorld(result.world),
        townSocialResponse: result.runtime.townSocialResponseSummary,
        campaignRecovery: result.campaignRecovery,
        factionRelationship: result.factionRelationship,
        worldEventOffer: result.worldEventOffer,
        investigatorProgression: result.runtime.investigatorProgressionSummary,
        investigatorHeadquarters: result.runtime.investigatorHeadquartersSummary,
        arcConvergence: result.runtime.arcConvergenceSummary
      });
    }
    if (body.investigatorHeadquartersDecision) {
      if (body.steps !== 0) return fail("BAD_REQUEST", "investigatorHeadquartersDecision requires steps: 0");
      if (!body.investigatorHeadquartersDecision.choice) return fail("BAD_REQUEST", "investigatorHeadquartersDecision requires choice");
      const choice = body.investigatorHeadquartersDecision.choice;
      if (loaded.runtime.investigatorHeadquartersSummary?.status !== "ready") {
        return fail("INVESTIGATOR_HEADQUARTERS_NOT_READY", "No Headquarters preparation is waiting before the next case", 409);
      }
      if (!["field-search", "witness-work", "contradiction-analysis", "evidence-handling", "institutional-access"].includes(choice)) {
        return fail("HEADQUARTERS_DIRECTION_LOCKED", "That Headquarters direction is not unlocked by current practice", 409);
      }
      const result = recordRuntimeInvestigatorHeadquartersDecision(loaded.world, loaded.events, { choice });
      if (!result) return fail("HEADQUARTERS_DIRECTION_LOCKED", "That Headquarters direction is not unlocked by current practice", 409);
      return ok({
        runtime: publicRuntime(result.runtime),
        events: [],
        queue: result.queue,
        world: publicWorld(result.world),
        investigatorHeadquarters: result.investigatorHeadquarters,
        investigatorProgression: result.runtime.investigatorProgressionSummary,
        campaignSession: result.runtime.campaignSessionSummary,
        campaignFinaleDebrief: result.runtime.campaignFinaleDebrief
      });
    }
    if (body.playerResourceCommitmentDecision) {
      if (body.steps !== 0) return fail("BAD_REQUEST", "playerResourceCommitmentDecision requires steps: 0");
      const decision = body.playerResourceCommitmentDecision;
      if (!decision.sessionId || (!decision.choice && !Array.isArray(decision.allocations))) return fail("BAD_REQUEST", "playerResourceCommitmentDecision requires sessionId and choice or allocations");
      const session = worldRepository.getSession(decision.sessionId);
      if (!session || session.worldId !== body.worldId) return fail("SESSION_NOT_FOUND", "Session does not belong to this world", 404);
      const activeCase = worldRepository.getCase(session.caseId);
      if (!activeCase) return fail("CASE_NOT_FOUND", "Session case was not found", 404);
      const baseInput = {
        sessionId: session.id,
        caseId: session.caseId,
        caseSceneLocationId: activeCase.generationProfile.sceneLocationId || activeCase.deductionCase.scenes[0]?.id
      };
      const result = Array.isArray(decision.allocations)
        ? recordRuntimeInvestigationOperationsDecision(loaded.world, loaded.events, { ...baseInput, allocations: decision.allocations })
        : recordRuntimePlayerResourceCommitmentDecision(loaded.world, loaded.events, { ...baseInput, choice: decision.choice! });
      if (!result) return fail("PLAYER_RESOURCE_COMMITMENT_NOT_READY", "The requested investigation operations plan is unavailable or already closed", 409);
      return ok({
        runtime: publicRuntime(result.runtime),
        events: [],
        queue: result.queue,
        world: publicWorld(result.world),
        townSocialResponse: result.runtime.townSocialResponseSummary,
        playerResourceCommitment: result.playerResourceCommitment,
        factionRelationship: result.factionRelationship,
        worldInfluenceBudget: result.worldInfluenceBudget,
        investigatorProgression: result.runtime.investigatorProgressionSummary,
        campaignRecovery: result.runtime.campaignRecoverySummary,
        investigatorHeadquarters: result.runtime.investigatorHeadquartersSummary,
        arcConvergence: result.runtime.arcConvergenceSummary
      });
    }
    if (body.worldEventOfferDecision) {
      if (body.steps !== 0) return fail("BAD_REQUEST", "worldEventOfferDecision requires steps: 0");
      if (!body.worldEventOfferDecision.choice) return fail("BAD_REQUEST", "worldEventOfferDecision requires choice");
      const result = recordRuntimeWorldEventOfferDecision(loaded.world, loaded.events, { choice: body.worldEventOfferDecision.choice });
      if (!result) return fail("WORLD_EVENT_OFFER_NOT_READY", "No offered world event opportunity is ready", 409);
      return ok({
        runtime: publicRuntime(result.runtime),
        events: [],
        queue: result.queue,
        world: publicWorld(result.world),
        townSocialResponse: result.runtime.townSocialResponseSummary,
        worldEventOffer: result.worldEventOffer,
        factionRelationship: result.factionRelationship,
        worldInfluenceBudget: result.worldInfluenceBudget,
        investigatorProgression: result.runtime.investigatorProgressionSummary,
        campaignRecovery: result.runtime.campaignRecoverySummary,
        investigatorHeadquarters: result.runtime.investigatorHeadquartersSummary,
        arcConvergence: result.runtime.arcConvergenceSummary
      });
    }
    if (body.worldArcDirectiveDecision) {
      if (body.steps !== 0) return fail("BAD_REQUEST", "worldArcDirectiveDecision requires steps: 0");
      if (!body.worldArcDirectiveDecision.choice) return fail("BAD_REQUEST", "worldArcDirectiveDecision requires choice");
      const result = recordRuntimeWorldArcDirectiveDecision(loaded.world, loaded.events, {
        choice: body.worldArcDirectiveDecision.choice
      });
      if (!result) return fail("WORLD_ARC_DIRECTIVE_NOT_READY", "No ready or retryable faction directive is available", 409);
      return ok({
        runtime: publicRuntime(result.runtime),
        events: [],
        queue: result.queue,
        world: publicWorld(result.world),
        townSocialResponse: result.runtime.townSocialResponseSummary,
        worldArcDirective: result.worldArcDirective,
        worldPressureCascade: result.worldPressureCascade,
        factionRelationship: result.factionRelationship,
        worldInfluenceBudget: result.worldInfluenceBudget,
        investigatorProgression: result.runtime.investigatorProgressionSummary,
        campaignRecovery: result.runtime.campaignRecoverySummary,
        investigatorHeadquarters: result.runtime.investigatorHeadquartersSummary,
        arcConvergence: result.runtime.arcConvergenceSummary
      });
    }
    if (body.worldLeadDecision) {
      if (!body.worldLeadDecision.sessionId || !body.worldLeadDecision.action) {
        return fail("BAD_REQUEST", "worldLeadDecision requires sessionId and action");
      }
      const session = worldRepository.getSession(body.worldLeadDecision.sessionId);
      if (!session || session.worldId !== body.worldId) {
        return fail("SESSION_NOT_FOUND", "Session does not belong to this world", 404);
      }
      const activeCase = worldRepository.getCase(session.caseId);
      if (!activeCase) return fail("CASE_NOT_FOUND", "Session case was not found", 404);
      if (!isRuntimeInvestigationAuthority(body.worldId, { sessionId: session.id, caseId: session.caseId })) {
        return fail("BAD_REQUEST", "Replay practice cannot change persistent world lead state", 409);
      }
      const result = recordRuntimeWorldLeadDecision(loaded.world, loaded.events, {
        sessionId: body.worldLeadDecision.sessionId,
        action: body.worldLeadDecision.action,
        caseId: session.caseId,
        caseSceneLocationId: activeCase.generationProfile.sceneLocationId || activeCase.deductionCase.scenes[0]?.id
      });
      return ok({
        runtime: publicRuntime(result.runtime),
        events: [],
        queue: result.queue,
        world: publicWorld(result.world),
        townSocialResponse: result.runtime.townSocialResponseSummary,
        worldLead: result.worldLead,
        worldLeadOutcome: result.worldLeadOutcome,
        worldArc: result.worldArc,
        worldInfluenceBudget: result.worldInfluenceBudget,
        investigatorProgression: result.runtime.investigatorProgressionSummary,
        campaignRecovery: result.runtime.campaignRecoverySummary,
        investigatorHeadquarters: result.runtime.investigatorHeadquartersSummary,
        arcConvergence: result.runtime.arcConvergenceSummary
      });
    }
    const result = stepRuntime(loaded.world, loaded.events, body.steps || 1, "running");
    return ok({
      runtime: publicRuntime(result.runtime),
      events: result.events,
      queue: result.queue,
      world: publicWorld(result.world),
      townSocialResponse: result.runtime.townSocialResponseSummary,
      worldArcDirective: result.runtime.worldArcDirectiveSummary,
      worldPressureCascade: result.runtime.worldPressureCascadeSummary,
      playerResourceCommitment: result.runtime.playerResourceCommitmentSummary,
      factionRelationship: result.runtime.factionRelationshipSummary,
      worldEventOffer: result.runtime.worldEventOfferSummary,
      worldInfluenceBudget: publicRuntime(result.runtime).worldInfluenceBudgetSummary,
      investigatorProgression: result.runtime.investigatorProgressionSummary,
      campaignRecovery: result.runtime.campaignRecoverySummary,
      investigatorHeadquarters: result.runtime.investigatorHeadquartersSummary,
      arcConvergence: result.runtime.arcConvergenceSummary,
      campaignSession: result.runtime.campaignSessionSummary,
      campaignFinaleDebrief: result.runtime.campaignFinaleDebrief
    });
  } catch (error) {
    return errorResponse(error);
  }
}
