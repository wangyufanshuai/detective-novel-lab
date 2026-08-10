"use client";

import { useMemo } from "react";
import { deriveCampaignPacingViewModel } from "@/app/campaign/campaign-pacing-model";
import { deriveTownMapLensViewModel } from "@/app/campaign/town-map-lens-model";
import { deriveWorldConsequenceTimeline } from "@/app/campaign/world-consequence-timeline";
import { deriveCommandDeckInstitutionName } from "@/app/hooks/useCommandDeckContext";
import type { useInvestigationController } from "@/app/controllers/useInvestigationController";
import type { useCampaignController } from "@/app/controllers/useCampaignController";
import type { useTownRuntimeController } from "@/app/controllers/useTownRuntimeController";
import type { SuggestedAction } from "@/app/hooks/useDetectiveTownRuntime";

type InvestigationState = ReturnType<typeof useInvestigationController>;
type CampaignState = ReturnType<typeof useCampaignController>;
type TownState = ReturnType<typeof useTownRuntimeController>;

export function useWorldCampaignPresentation(input: {
  world: InvestigationState["world"];
  snapshot: InvestigationState["snapshot"];
  townRuntime: TownState["townRuntime"];
  townBrief: TownState["townBrief"];
  selectedCharacterId: string;
  runtimeMode: "static-demo" | "server";
  activeCase: InvestigationState["activeCase"];
  session: InvestigationState["session"];
  suggestedAction: SuggestedAction;
  busy: boolean;
  townRuntimeBusy: boolean;
  campaignSession: CampaignState["campaignSession"];
  campaignRecovery: CampaignState["campaignRecovery"];
  investigatorHeadquarters: CampaignState["investigatorHeadquarters"];
  worldLead: CampaignState["worldLead"];
  worldArc: CampaignState["worldArc"];
  worldArcDirective: CampaignState["worldArcDirective"];
  worldEventOffer: CampaignState["worldEventOffer"];
  worldPressureCascade: CampaignState["worldPressureCascade"];
  townSocialResponse: CampaignState["townSocialResponse"];
}) {
  const selectedInstitutionName = deriveCommandDeckInstitutionName(input.world, input.townRuntime, input.selectedCharacterId);
  const townMapLenses = useMemo(() => deriveTownMapLensViewModel({
    world: input.world,
    snapshot: input.snapshot,
    runtime: input.townRuntime,
    brief: input.townBrief,
    socialResponse: input.townSocialResponse || input.townRuntime?.townSocialResponseSummary
  }), [input.snapshot, input.townBrief, input.townRuntime, input.townSocialResponse, input.world]);
  const worldConsequenceTimeline = useMemo(() => deriveWorldConsequenceTimeline({
    worldLead: input.worldLead || input.townRuntime?.worldLeadPreview,
    worldArc: input.worldArc || input.townRuntime?.worldArcSummary,
    directive: input.worldArcDirective || input.townRuntime?.worldArcDirectiveSummary,
    pressure: input.worldPressureCascade || input.townRuntime?.worldPressureCascadeSummary,
    recovery: input.campaignRecovery || input.townRuntime?.campaignRecoverySummary,
    socialResponse: input.townSocialResponse || input.townRuntime?.townSocialResponseSummary
  }), [input.campaignRecovery, input.townRuntime, input.townSocialResponse, input.worldArc, input.worldArcDirective, input.worldLead, input.worldPressureCascade]);
  const campaignPacing = useMemo(() => deriveCampaignPacingViewModel({
    runtimeMode: input.runtimeMode,
    campaign: input.campaignSession || input.townRuntime?.campaignSessionSummary,
    currentAction: {
      status: input.suggestedAction.phase,
      label: input.suggestedAction.title,
      detail: input.suggestedAction.detail,
      nextAction: input.campaignSession?.nextAction || input.townRuntime?.campaignSessionSummary?.nextAction
    },
    signals: [
      input.campaignRecovery || input.townRuntime?.campaignRecoverySummary ? { kind: "recovery" as const, ...(input.campaignRecovery || input.townRuntime?.campaignRecoverySummary) } : undefined,
      input.investigatorHeadquarters || input.townRuntime?.investigatorHeadquartersSummary ? { kind: "headquarters" as const, ...(input.investigatorHeadquarters || input.townRuntime?.investigatorHeadquartersSummary) } : undefined,
      input.worldLead || input.townRuntime?.worldLeadPreview ? { kind: "lead" as const, ...(input.worldLead || input.townRuntime?.worldLeadPreview) } : undefined,
      input.worldArcDirective || input.townRuntime?.worldArcDirectiveSummary ? { kind: "directive" as const, ...(input.worldArcDirective || input.townRuntime?.worldArcDirectiveSummary) } : undefined,
      input.worldEventOffer || input.townRuntime?.worldEventOfferSummary ? { kind: "offer" as const, ...(input.worldEventOffer || input.townRuntime?.worldEventOfferSummary) } : undefined,
      input.worldPressureCascade || input.townRuntime?.worldPressureCascadeSummary ? { kind: "pressure" as const, ...(input.worldPressureCascade || input.townRuntime?.worldPressureCascadeSummary) } : undefined,
      input.townSocialResponse || input.townRuntime?.townSocialResponseSummary ? { kind: "reaction" as const, ...(input.townSocialResponse || input.townRuntime?.townSocialResponseSummary) } : undefined
    ].filter((signal): signal is NonNullable<typeof signal> => Boolean(signal)),
    consequence: worldConsequenceTimeline.state === "empty" ? undefined : {
      status: worldConsequenceTimeline.state,
      label: worldConsequenceTimeline.headline,
      detail: worldConsequenceTimeline.summary,
      nextAction: worldConsequenceTimeline.nextAction
    },
    hasCase: Boolean(input.activeCase),
    judgementAccepted: Boolean(input.session?.judgement?.accepted),
    busy: input.busy || input.townRuntimeBusy
  }), [input.activeCase, input.busy, input.campaignRecovery, input.campaignSession, input.investigatorHeadquarters, input.runtimeMode, input.session?.judgement?.accepted, input.suggestedAction.detail, input.suggestedAction.phase, input.suggestedAction.title, input.townRuntime, input.townRuntimeBusy, input.townSocialResponse, input.worldArcDirective, worldConsequenceTimeline, input.worldEventOffer, input.worldLead, input.worldPressureCascade]);
  return { selectedInstitutionName, townMapLenses, worldConsequenceTimeline, campaignPacing };
}
