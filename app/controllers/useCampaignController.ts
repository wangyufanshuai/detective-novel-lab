"use client";

import { useState } from "react";
import type {
  ArcConvergencePublicSummary,
  CampaignFinaleDebriefPublicSummary,
  CampaignRecoveryPublicSummary,
  CampaignSessionPublicSummary,
  FactionRelationshipPublicSummary,
  InvestigatorProgressionPublicSummary,
  InvestigatorHeadquartersPublicSummary,
  PlayerResourceCommitmentPublicSummary,
  TownSocialResponsePublicSummary,
  WorldArcDirectivePublicSummary,
  WorldArcPublicSummary,
  WorldEventOfferPublicSummary,
  WorldInfluenceBudgetPublicSummary,
  WorldLeadCaseHandoffPublicSummary,
  WorldLeadOutcomePublicSummary,
  WorldLeadPublicSummary,
  WorldPressureCascadePublicSummary
} from "@/lib/engine";

/** Owns the public-safe campaign lifecycle state consumed by the player surfaces. */
export function useCampaignController() {
  const [frontDoorOpen, setFrontDoorOpen] = useState(true);
  const [frontDoorSelection, setFrontDoorSelection] = useState(0);
  const [frontDoorRouteSelection, setFrontDoorRouteSelection] = useState(0);
  const [frontDoorBusy, setFrontDoorBusy] = useState(false);
  const [frontDoorStatus, setFrontDoorStatus] = useState("Choose one three-case campaign, then start a clean local town.");
  const [continueWorldId, setContinueWorldId] = useState("");
  const [continueSessionId, setContinueSessionId] = useState("");
  const [worldLead, setWorldLead] = useState<WorldLeadPublicSummary | null>(null);
  const [worldLeadOutcome, setWorldLeadOutcome] = useState<WorldLeadOutcomePublicSummary | null>(null);
  const [worldLeadCaseHandoff, setWorldLeadCaseHandoff] = useState<WorldLeadCaseHandoffPublicSummary | null>(null);
  const [worldArc, setWorldArc] = useState<WorldArcPublicSummary | null>(null);
  const [worldArcDirective, setWorldArcDirective] = useState<WorldArcDirectivePublicSummary | null>(null);
  const [worldPressureCascade, setWorldPressureCascade] = useState<WorldPressureCascadePublicSummary | null>(null);
  const [worldInfluenceBudget, setWorldInfluenceBudget] = useState<WorldInfluenceBudgetPublicSummary | null>(null);
  const [playerResourceCommitment, setPlayerResourceCommitment] = useState<PlayerResourceCommitmentPublicSummary | null>(null);
  const [factionRelationship, setFactionRelationship] = useState<FactionRelationshipPublicSummary | null>(null);
  const [worldEventOffer, setWorldEventOffer] = useState<WorldEventOfferPublicSummary | null>(null);
  const [investigatorProgression, setInvestigatorProgression] = useState<InvestigatorProgressionPublicSummary | null>(null);
  const [investigatorHeadquarters, setInvestigatorHeadquarters] = useState<InvestigatorHeadquartersPublicSummary | null>(null);
  const [campaignRecovery, setCampaignRecovery] = useState<CampaignRecoveryPublicSummary | null>(null);
  const [arcConvergence, setArcConvergence] = useState<ArcConvergencePublicSummary | null>(null);
  const [campaignSession, setCampaignSession] = useState<CampaignSessionPublicSummary | null>(null);
  const [campaignFinaleDebrief, setCampaignFinaleDebrief] = useState<CampaignFinaleDebriefPublicSummary | null>(null);
  const [townSocialResponse, setTownSocialResponse] = useState<TownSocialResponsePublicSummary | null>(null);

  return {
    frontDoorOpen, setFrontDoorOpen,
    frontDoorSelection, setFrontDoorSelection,
    frontDoorRouteSelection, setFrontDoorRouteSelection,
    frontDoorBusy, setFrontDoorBusy,
    frontDoorStatus, setFrontDoorStatus,
    continueWorldId, setContinueWorldId,
    continueSessionId, setContinueSessionId,
    worldLead, setWorldLead,
    worldLeadOutcome, setWorldLeadOutcome,
    worldLeadCaseHandoff, setWorldLeadCaseHandoff,
    worldArc, setWorldArc,
    worldArcDirective, setWorldArcDirective,
    worldPressureCascade, setWorldPressureCascade,
    worldInfluenceBudget, setWorldInfluenceBudget,
    playerResourceCommitment, setPlayerResourceCommitment,
    factionRelationship, setFactionRelationship,
    worldEventOffer, setWorldEventOffer,
    investigatorProgression, setInvestigatorProgression,
    investigatorHeadquarters, setInvestigatorHeadquarters,
    campaignRecovery, setCampaignRecovery,
    arcConvergence, setArcConvergence,
    campaignSession, setCampaignSession,
    campaignFinaleDebrief, setCampaignFinaleDebrief,
    townSocialResponse, setTownSocialResponse
  };
}
