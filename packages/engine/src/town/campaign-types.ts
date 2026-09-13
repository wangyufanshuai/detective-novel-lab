import type { TownCaseType } from "../persistent-town";

export type LocalizedSafeText = Readonly<{
  "en-US": string;
  "zh-CN": string;
}>;

export type TownCaseMechanicProfileId =
  | "record-custody"
  | "witness-timeline"
  | "forensic-timing"
  | "evidence-chain"
  | "access-control";

export type DetectiveCampaignVolumeId = "public-records" | "moving-city" | "midnight-signals";
export type DetectiveCampaignRouteId = "baseline" | "counter-route";
export type AuthoredCampaignLeadFocus = "search" | "question" | "challenge";

export type DetectiveCampaignChapter = {
  ordinal: 1 | 2 | 3;
  label: string;
  objectiveLabel: string;
  preferredCaseTypes: readonly TownCaseType[];
  evidenceThemeLabel: string;
  worldSurfaceLabel: string;
};

export type DetectiveCampaignRouteDefinition = {
  id: DetectiveCampaignRouteId;
  label: string;
  strategyLabel: string;
  finaleLabel: string;
  finaleCaseType: TownCaseType;
  replayContrast: string;
  chapters: readonly [DetectiveCampaignChapter, DetectiveCampaignChapter, DetectiveCampaignChapter];
};

export type DetectiveCampaignDefinition<Id extends string = string> = {
  id: Id;
  worldPackageIds: readonly string[];
  volumeId: DetectiveCampaignVolumeId;
  volumeLabel: string;
  presentationKey: string;
  label: string;
  themeLabel: string;
  routes: readonly [DetectiveCampaignRouteDefinition, DetectiveCampaignRouteDefinition];
  /** Internal co-located localization index. Keys are canonical English strings, never runtime identifiers. */
  localizedText?: Readonly<Record<string, LocalizedSafeText>>;
};

export type AuthoredCampaignCaseDefinition = {
  campaignId: string;
  routeId: DetectiveCampaignRouteId;
  ordinal: 1 | 2 | 3;
  caseFamily: TownCaseType;
  title: string;
  theme: string;
  publicPremise: string;
  publicCaseFile: string;
  causalBridge: string;
  occupationalPressure: string;
  evidenceFrame: string;
  evidenceTitles: {
    means: string;
    motive: string;
    opportunity: string;
    staging: string;
    trace: string;
    exclusion: string;
  };
  redHerrings: [string, string];
  rhythm: ["staging" | "opportunity" | "means" | "motive" | "trace", "staging" | "opportunity" | "means" | "motive" | "trace", "staging" | "opportunity" | "means" | "motive" | "trace", "staging" | "opportunity" | "means" | "motive" | "trace", "staging" | "opportunity" | "means" | "motive" | "trace"];
  witnessFrame: string;
  challengeFrame: string;
  leadFocus: AuthoredCampaignLeadFocus;
  aftermathLabel: string;
  localizedText?: Readonly<Record<string, LocalizedSafeText>>;
};

export function localizedSafeText(en: string, zh: string): LocalizedSafeText {
  return Object.freeze({ "en-US": en, "zh-CN": zh });
}

export function localizeSafeText(value: LocalizedSafeText, locale: "en-US" | "zh-CN") {
  return value[locale] || value["en-US"];
}
