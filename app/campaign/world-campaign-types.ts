import type { InvestigatorHeadquartersPublicSummary, PlayerResourceCommitmentPublicSummary } from "@/lib/engine";

export type WorldLeadSummary = {
  status: "pending" | "followed" | "skipped" | "resolved";
  focus: "search" | "question" | "challenge";
  label: string;
  nextAction: string;
};

export type WorldLeadOutcomeSummary = {
  status: "active" | "settled";
  focus: "search" | "question" | "challenge";
  benefitLabel: string;
  costLabel: string;
  nextAction: string;
};

export type WorldLeadHandoffSummary = {
  status: "ready" | "consumed";
  focus: "search" | "question" | "challenge";
  label: string;
  nextAction: string;
};

export type WorldArcSummary = {
  status: "active" | "completed";
  label: string;
  completedStages: number;
  stageCount: number;
  progressLabel: string;
  pulseLabel: string;
  nextAction: string;
};

export type WorldArcDirectiveSummary = {
  status: "ready" | "scheduled" | "running" | "completed" | "blocked";
  choice?: "support" | "contain" | "defer";
  lineLabel: string;
  factionLabel: string;
  operationLabel: string;
  benefitLabel: string;
  costLabel: string;
  progressLabel: string;
  queuedCount: number;
  nextAction: string;
  blockedCategory?: "institution unavailable" | "staff unavailable" | "resource unavailable" | "operation unavailable";
  options: {
    support: { label: string; benefitLabel: string; costLabel: string };
    contain: { label: string; benefitLabel: string; costLabel: string };
  };
};

export type WorldPressureCascadeSummary = {
  status: "active" | "consumed" | "empty";
  activePulseCount: number;
  directionLabel: string;
  focusLabel: string;
  affectedCaseLabel: string;
  remainingLayers: number;
  nextAction: string;
};

export type WorldInfluenceBudgetSummary = {
  status: "active" | "empty";
  sourceCount: number;
  sourceLabel: string;
  directionLabel: string;
  strengthLabel: "none" | "light" | "bounded";
  maximumAbsoluteBonus: number;
  nextAction: string;
};

export type PlayerResourceCommitmentSummary = PlayerResourceCommitmentPublicSummary;

export type FactionRelationshipSummary = {
  status: "stable" | "changed";
  trustedCount: number;
  strainedCount: number;
  headline: string;
  lastChangeLabel: string;
  resourceEffectLabel: string;
  nextAction: string;
  standings: Array<{
    label: string;
    standing: "trusted" | "neutral" | "strained" | "hostile";
    directionLabel: "supportive" | "steady" | "guarded" | "closed";
  }>;
};

export type WorldEventOfferSummary = {
  status: "offered" | "accepted" | "declined" | "running" | "completed" | "failed" | "expired";
  label: string;
  factionLabel: string;
  actionLabel: string;
  benefitLabel: string;
  costLabel: string;
  deadlineBand: "several town cycles" | "accepted" | "closed";
  progressLabel: string;
  queuedCount: number;
  recoveryLabel: string;
  recoveryAvailable: boolean;
  nextAction: string;
};

export type InvestigatorProgressionSummary = {
  status: "developing" | "established";
  points: number;
  competencyLabels: Array<{ label: string; level: number; progressLabel: string }>;
  unlockedLabels: string[];
  nextAction: string;
};

export type InvestigatorHeadquartersSummary = InvestigatorHeadquartersPublicSummary;

export type CampaignRecoverySummary = {
  status: "empty" | "ready" | "scheduled" | "completed";
  failureLabel: string;
  recoveryActionLabel: string;
  costLabel: string;
  progressLabel: string;
  completedCount: number;
  queuedCount: number;
  headquartersAvailable?: boolean;
  headquartersActionLabel?: string;
  nextAction: string;
};

export type ArcConvergenceSummary = {
  status: "locked" | "forming" | "ready" | "active" | "completed";
  finaleLabel: string;
  approachLabel: string;
  caseProgressLabel: string;
  worldProgressLabel: string;
  contextLabels: string[];
  nextAction: string;
};

export type CampaignSessionSummary = {
  status: "opening" | "case-active" | "transition" | "finale-ready" | "finale-active" | "completed";
  campaignLabel?: string;
  routeLabel?: string;
  routeStrategyLabel?: string;
  themeLabel?: string;
  chapterLabel: string;
  chapterObjective?: string;
  evidenceThemeLabel?: string;
  worldSurfaceLabel?: string;
  progressLabel: string;
  primaryActionLabel: string;
  consequenceLabels: string[];
  replayLabel: string;
  nextAction: string;
};

export type CampaignFinaleDebriefSummary = {
  status: "locked" | "ready";
  title: string;
  approachLabel: string;
  causalBeats: string[];
  replayContrast: string;
  nextAction: string;
};

export type TownSocialResponseSummary = {
  status: "empty" | "ready" | "active" | "settled";
  direction: "supportive" | "guarded" | "none";
  directionLabel: string;
  progressLabel: string;
  headline: string;
  reactions: Array<{
    actorName: string;
    roleLabel: string;
    locationLabel: string;
    reactionLabel: string;
  }>;
  nextAction: string;
};
