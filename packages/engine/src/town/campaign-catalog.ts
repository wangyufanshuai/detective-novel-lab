import type { PersistentTownRuntime, TownCaseType } from "../persistent-town";

export type DetectiveCampaignId = "town-reckoning" | "harbor-testimony" | "clinic-headlines";
export type DetectiveCampaignRouteId = "baseline" | "counter-route";

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

export type DetectiveCampaignDefinition = {
  id: DetectiveCampaignId;
  worldPackageIds: readonly string[];
  label: string;
  themeLabel: string;
  routes: readonly [DetectiveCampaignRouteDefinition, DetectiveCampaignRouteDefinition];
};

export const DEFAULT_DETECTIVE_CAMPAIGN_ROUTE_ID: DetectiveCampaignRouteId = "baseline";

const CAMPAIGNS: readonly DetectiveCampaignDefinition[] = [
  {
    id: "town-reckoning",
    worldPackageIds: ["city-hall-merchant-debt-town", "small-town-review"],
    label: "Town Reckoning",
    themeLabel: "Civic records, merchant debt, and institutional pressure",
    routes: [
      {
        id: "baseline",
        label: "Civic Procedure",
        strategyLabel: "Follow public custody, debt records, and hearing access through civic institutions.",
        finaleLabel: "Civic Reckoning",
        finaleCaseType: "court-intimidation",
        replayContrast: "Change the balance between civic procedure, merchant pressure, and town recovery.",
        chapters: [
          {
            ordinal: 1,
            label: "Public Record",
            objectiveLabel: "Establish which public record can anchor the first certified investigation.",
            preferredCaseTypes: ["archive-vanishing", "permit-forgery", "ledger-fraud"],
            evidenceThemeLabel: "records and custody",
            worldSurfaceLabel: "civic procedure"
          },
          {
            ordinal: 2,
            label: "Debt Pressure",
            objectiveLabel: "Trace how institutional access and private debt reshape the next case queue.",
            preferredCaseTypes: ["ledger-fraud", "household-escrow", "blackmail"],
            evidenceThemeLabel: "ledgers and obligations",
            worldSurfaceLabel: "commerce pressure"
          },
          {
            ordinal: 3,
            label: "Civic Reckoning",
            objectiveLabel: "Resolve the converged hearing through the unchanged certified route.",
            preferredCaseTypes: ["court-intimidation"],
            evidenceThemeLabel: "testimony and court records",
            worldSurfaceLabel: "institutional accountability"
          }
        ]
      },
      {
        id: "counter-route",
        label: "Merchant Leverage",
        strategyLabel: "Follow permits, escrow, and inheritance pressure through the town's commercial edge.",
        finaleLabel: "Inheritance Review",
        finaleCaseType: "forged-will",
        replayContrast: "Compare civic custody with a commerce-first route built from permits, escrow, and inheritance access.",
        chapters: [
          {
            ordinal: 1,
            label: "Permit Trail",
            objectiveLabel: "Test which authorization crossed from the public counter into a private market route.",
            preferredCaseTypes: ["permit-forgery", "ledger-fraud", "archive-vanishing"],
            evidenceThemeLabel: "signatures and permits",
            worldSurfaceLabel: "market authorization"
          },
          {
            ordinal: 2,
            label: "Escrow Breach",
            objectiveLabel: "Trace how household access and commercial custody reshaped the disputed obligation.",
            preferredCaseTypes: ["household-escrow", "blackmail", "ledger-fraud"],
            evidenceThemeLabel: "escrow receipts and access",
            worldSurfaceLabel: "household commerce pressure"
          },
          {
            ordinal: 3,
            label: "Inheritance Review",
            objectiveLabel: "Resolve the inherited document conflict through the same certified proof authority.",
            preferredCaseTypes: ["forged-will"],
            evidenceThemeLabel: "signatures, custody, and exclusion",
            worldSurfaceLabel: "property accountability"
          }
        ]
      }
    ]
  },
  {
    id: "harbor-testimony",
    worldPackageIds: ["dock-court-market-town"],
    label: "Harbor Testimony",
    themeLabel: "Cargo movement, witness identity, and court pressure",
    routes: [
      {
        id: "baseline",
        label: "Cargo Testimony",
        strategyLabel: "Follow manifests, witness identity, and court pressure into the harbor inquest.",
        finaleLabel: "Harbor Inquest",
        finaleCaseType: "dock-witness-swap",
        replayContrast: "Change whether cargo control, witness protection, or court pressure carries the harbor into its inquest.",
        chapters: [
          {
            ordinal: 1,
            label: "Broken Route",
            objectiveLabel: "Establish a certified movement trail before dock routines shift again.",
            preferredCaseTypes: ["dock-smuggling", "witness-disappearance", "dock-witness-swap"],
            evidenceThemeLabel: "cargo logs and movement",
            worldSurfaceLabel: "dock route control"
          },
          {
            ordinal: 2,
            label: "Borrowed Account",
            objectiveLabel: "Compare witness identity and court pressure without treating rumor as proof.",
            preferredCaseTypes: ["false-testimony", "court-intimidation", "evidence-tampering"],
            evidenceThemeLabel: "testimony and chain integrity",
            worldSurfaceLabel: "witness pressure"
          },
          {
            ordinal: 3,
            label: "Harbor Inquest",
            objectiveLabel: "Close the identity conflict through the same evidence and judgement authority as earlier cases.",
            preferredCaseTypes: ["dock-witness-swap"],
            evidenceThemeLabel: "identity, timing, and route",
            worldSurfaceLabel: "harbor accountability"
          }
        ]
      },
      {
        id: "counter-route",
        label: "Chain Protection",
        strategyLabel: "Follow a missing watch, borrowed seals, and custody breaks before cargo ownership.",
        finaleLabel: "Custody Tribunal",
        finaleCaseType: "evidence-tampering",
        replayContrast: "Compare the cargo-first inquest with a witness-safety route that culminates in chain-of-custody review.",
        chapters: [
          {
            ordinal: 1,
            label: "Missing Watch",
            objectiveLabel: "Reconstruct which public watch disappeared before accepting the loudest cargo explanation.",
            preferredCaseTypes: ["witness-disappearance", "dock-witness-swap", "false-testimony"],
            evidenceThemeLabel: "watch records and movement",
            worldSurfaceLabel: "witness shelter"
          },
          {
            ordinal: 2,
            label: "Borrowed Seal",
            objectiveLabel: "Separate a borrowed official mark from the account used to justify its movement.",
            preferredCaseTypes: ["false-testimony", "evidence-tampering", "court-intimidation"],
            evidenceThemeLabel: "statements, seals, and custody",
            worldSurfaceLabel: "court-chain pressure"
          },
          {
            ordinal: 3,
            label: "Custody Tribunal",
            objectiveLabel: "Resolve the final custody break without allowing a public accusation to replace proof.",
            preferredCaseTypes: ["evidence-tampering"],
            evidenceThemeLabel: "custody, trace, and exclusion",
            worldSurfaceLabel: "harbor chain integrity"
          }
        ]
      }
    ]
  },
  {
    id: "clinic-headlines",
    worldPackageIds: ["hospital-family-press-town"],
    label: "Clinic Headlines",
    themeLabel: "Medical timing, household access, and public reputation",
    routes: [
      {
        id: "baseline",
        label: "Clinical Review",
        strategyLabel: "Follow medical timing, household access, and forensic custody into a public trust review.",
        finaleLabel: "Public Trust Review",
        finaleCaseType: "medical-coverup",
        replayContrast: "Change whether medical review, household protection, or public scrutiny defines the final trust hearing.",
        chapters: [
          {
            ordinal: 1,
            label: "Missing Interval",
            objectiveLabel: "Reconstruct the clinic interval from certified timing and inventory evidence.",
            preferredCaseTypes: ["clinic-inventory-gap", "medical-coverup", "evidence-tampering"],
            evidenceThemeLabel: "medical timing and inventory",
            worldSurfaceLabel: "clinical trust"
          },
          {
            ordinal: 2,
            label: "Private Copy",
            objectiveLabel: "Test how household access became public pressure without exposing private text.",
            preferredCaseTypes: ["household-escrow", "family-scandal", "editorial-coercion"],
            evidenceThemeLabel: "access records and published proof",
            worldSurfaceLabel: "family and media pressure"
          },
          {
            ordinal: 3,
            label: "Public Trust Review",
            objectiveLabel: "Resolve the medical trust conflict through the unchanged certified route.",
            preferredCaseTypes: ["medical-coverup"],
            evidenceThemeLabel: "forensic timing and custody",
            worldSurfaceLabel: "public accountability"
          }
        ]
      },
      {
        id: "counter-route",
        label: "Public Correction",
        strategyLabel: "Follow household silence, escrow access, and editorial coercion around the clinic record.",
        finaleLabel: "Correction Hearing",
        finaleCaseType: "editorial-coercion",
        replayContrast: "Compare the clinical review with a public-correction route built from household access and editorial custody.",
        chapters: [
          {
            ordinal: 1,
            label: "Household Silence",
            objectiveLabel: "Establish which household obligation shaped the first public account of the clinic interval.",
            preferredCaseTypes: ["family-scandal", "household-escrow", "blackmail"],
            evidenceThemeLabel: "letters, attendance, and access",
            worldSurfaceLabel: "household protection"
          },
          {
            ordinal: 2,
            label: "Escrow Copy",
            objectiveLabel: "Trace how a protected copy moved from household custody into editorial leverage.",
            preferredCaseTypes: ["household-escrow", "editorial-coercion", "evidence-tampering"],
            evidenceThemeLabel: "copy custody and publication timing",
            worldSurfaceLabel: "editorial access pressure"
          },
          {
            ordinal: 3,
            label: "Correction Hearing",
            objectiveLabel: "Resolve the publication chain while keeping medical reputation separate from certified proof.",
            preferredCaseTypes: ["editorial-coercion"],
            evidenceThemeLabel: "source custody, timing, and exclusion",
            worldSurfaceLabel: "public correction"
          }
        ]
      }
    ]
  }
] as const;

const DEFAULT_CAMPAIGN = CAMPAIGNS[0];

export function isDetectiveCampaignRouteId(value: unknown): value is DetectiveCampaignRouteId {
  return value === "baseline" || value === "counter-route";
}

export function listDetectiveCampaignDefinitions() {
  return CAMPAIGNS;
}

export function getDetectiveCampaignDefinition(campaignId?: string) {
  return CAMPAIGNS.find((campaign) => campaign.id === campaignId) || DEFAULT_CAMPAIGN;
}

export function getDetectiveCampaignRoute(definition: DetectiveCampaignDefinition, routeId?: string) {
  return definition.routes.find((route) => route.id === routeId) || definition.routes[0];
}

export function selectDetectiveCampaignDefinition(input?: { worldPackageId?: string; scenarioPackId?: string }) {
  const selectionKeys = [input?.worldPackageId, input?.scenarioPackId].filter((value): value is string => Boolean(value));
  return CAMPAIGNS.find((campaign) => selectionKeys.some((key) => campaign.worldPackageIds.includes(key))) || DEFAULT_CAMPAIGN;
}

export function selectedDetectiveCampaignForRuntime(runtime: Pick<PersistentTownRuntime, "currentExperiment" | "currentScenarioPackId">) {
  return selectDetectiveCampaignDefinition({
    worldPackageId: runtime.currentExperiment?.worldPackageId,
    scenarioPackId: runtime.currentScenarioPackId
  });
}

export function detectiveCampaignForRuntime(runtime: Pick<PersistentTownRuntime, "campaignSession" | "currentExperiment" | "currentScenarioPackId">) {
  return runtime.campaignSession?.campaignId
    ? getDetectiveCampaignDefinition(runtime.campaignSession.campaignId)
    : selectedDetectiveCampaignForRuntime(runtime);
}

export function detectiveCampaignRouteForRuntime(runtime: Pick<PersistentTownRuntime, "campaignSession" | "currentExperiment" | "currentScenarioPackId">) {
  const campaign = detectiveCampaignForRuntime(runtime);
  return getDetectiveCampaignRoute(campaign, runtime.campaignSession?.routeId);
}

export function detectiveCampaignChapter(runtime: Pick<PersistentTownRuntime, "campaignSession" | "currentExperiment" | "currentScenarioPackId">) {
  const route = detectiveCampaignRouteForRuntime(runtime);
  const completed = runtime.campaignSession?.completedCycleKeys?.length || 0;
  const chapterIndex = runtime.campaignSession?.status === "finale-ready" || runtime.campaignSession?.status === "finale-active"
    ? 2
    : Math.max(0, Math.min(2, completed));
  return route.chapters[chapterIndex];
}

export function deriveDetectiveCampaignCaseTypeBonus(
  runtime: Pick<PersistentTownRuntime, "campaignSession" | "currentExperiment" | "currentScenarioPackId">,
  caseType?: TownCaseType
) {
  if (!caseType) return 0;
  const chapter = detectiveCampaignChapter(runtime);
  const index = chapter.preferredCaseTypes.indexOf(caseType);
  return index < 0 ? 0 : Math.max(1, 3 - index);
}

export function toDetectiveCampaignPublicPreview(definition: DetectiveCampaignDefinition) {
  return {
    label: definition.label,
    themeLabel: definition.themeLabel,
    routes: definition.routes.map((route) => ({
      label: route.label,
      strategyLabel: route.strategyLabel,
      finaleLabel: route.finaleLabel,
      chapters: route.chapters.map((chapter) => ({
        label: chapter.label,
        objectiveLabel: chapter.objectiveLabel,
        evidenceThemeLabel: chapter.evidenceThemeLabel,
        worldSurfaceLabel: chapter.worldSurfaceLabel
      })),
      replayContrast: route.replayContrast
    }))
  };
}
