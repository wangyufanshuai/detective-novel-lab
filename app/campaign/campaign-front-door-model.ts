import { getCampaignPresentationManifest, listDetectiveCampaignDefinitions, toDetectiveCampaignPublicPreview } from "@/lib/engine";

export type CampaignFrontDoorRouteCard = {
  label: string;
  strategyLabel: string;
  primarySurfaceLabel: string;
  evidenceStyleLabel: string;
  pressureLabel: string;
  chapterLabels: [string, string, string];
  finaleLabel: string;
  replayContrast: string;
};

export type CampaignFrontDoorCard = {
  presentationKey: string;
  volumeId: "public-records" | "moving-city" | "midnight-signals";
  volumeLabel: string;
  label: string;
  investigationTheme: string;
  districtLabel: string;
  motifLabel: string;
  coverPath?: string;
  coverReady: boolean;
  routes: [CampaignFrontDoorRouteCard, CampaignFrontDoorRouteCard];
};

const rawIdentifierPattern = /\b(?:case|npc|event|source|location|institution|resource|evidence|session|world)-[a-z0-9-]*\d[a-z0-9-]*\b/gi;

function safeLabel(value: string, fallback: string, maximum = 180) {
  const normalized = value.replace(rawIdentifierPattern, "").replace(/\s+/g, " ").trim();
  return (normalized || fallback).slice(0, maximum);
}

function uniqueLabels(values: string[]) {
  return Array.from(new Set(values.map((value) => safeLabel(value, "public town surface", 72))));
}

/** Returns a display-only catalog with no campaign, route, package, case-family, or runtime keys. */
export function deriveCampaignFrontDoorCards(): CampaignFrontDoorCard[] {
  return listDetectiveCampaignDefinitions().map((definition) => {
    const preview = toDetectiveCampaignPublicPreview(definition);
    const presentation = getCampaignPresentationManifest(definition.presentationKey);
    const routes = preview.routes.map((route) => {
      const evidenceStyles = uniqueLabels(route.chapters.map((chapter) => chapter.evidenceThemeLabel));
      const surfaces = uniqueLabels(route.chapters.map((chapter) => chapter.worldSurfaceLabel));
      return {
        label: safeLabel(route.label, "Authored route", 64),
        strategyLabel: safeLabel(route.strategyLabel, "A distinct three-case strategy route", 180),
        primarySurfaceLabel: safeLabel([surfaces[0], surfaces.at(-1)].filter(Boolean).join(" → "), "town institutions", 120),
        evidenceStyleLabel: safeLabel(evidenceStyles.join(" / "), "certified evidence", 140),
        pressureLabel: safeLabel(surfaces[1] || surfaces[0], "bounded world pressure", 100),
        chapterLabels: route.chapters.map((chapter) => safeLabel(chapter.label, "Campaign chapter", 64)) as [string, string, string],
        finaleLabel: safeLabel(route.finaleLabel, "Campaign finale", 72),
        replayContrast: safeLabel(route.replayContrast, "Replay with another fair authored route.", 180)
      };
    }) as [CampaignFrontDoorRouteCard, CampaignFrontDoorRouteCard];
    return {
      presentationKey: definition.presentationKey,
      volumeId: definition.volumeId,
      volumeLabel: safeLabel(preview.volumeLabel, "Noir Archive", 64),
      label: safeLabel(preview.label, "Detective Campaign", 64),
      investigationTheme: safeLabel(preview.themeLabel, "A three-case public investigation", 160),
      districtLabel: safeLabel(presentation.districtLabel, "Noir Archive district", 80),
      motifLabel: safeLabel(presentation.motifLabel, "archive motif", 56),
      ...(presentation.cover.status === "ready" ? { coverPath: presentation.cover.path } : {}),
      coverReady: presentation.cover.status === "ready",
      routes
    };
  });
}

export function campaignFrontDoorSelection(cards: CampaignFrontDoorCard[], selectedIndex: number, selectedRouteIndex = 0) {
  const normalizedIndex = Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex < cards.length ? selectedIndex : 0;
  const selected = cards[normalizedIndex] || null;
  const normalizedRouteIndex = selected && Number.isInteger(selectedRouteIndex) && selectedRouteIndex >= 0 && selectedRouteIndex < selected.routes.length ? selectedRouteIndex : 0;
  return { selectedIndex: normalizedIndex, selectedRouteIndex: normalizedRouteIndex, selected, selectedRoute: selected?.routes[normalizedRouteIndex] || null };
}
