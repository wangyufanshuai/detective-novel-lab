import type {
  PersistentTownRuntime,
  TownSituationBrief,
  WorldMapSnapshot,
  WorldState
} from "@/lib/engine";

export type TownMapLensKind = "institution" | "pressure" | "reaction" | "evidence";
export type TownMapLensTone = "quiet" | "watch" | "high";

export type TownMapLensLocationSignal = {
  locationName: string;
  institutionTone: TownMapLensTone;
  institutionLabel: string;
  pressureTone: TownMapLensTone;
  pressureLabel: string;
  reactionTone: TownMapLensTone;
  reactionLabel: string;
  evidenceTone: TownMapLensTone;
  evidenceLabel: string;
};

export type TownMapLensViewModel = {
  defaultLens: TownMapLensKind;
  controls: Array<{
    kind: TownMapLensKind;
    label: string;
    summary: string;
  }>;
  locationSignals: TownMapLensLocationSignal[];
};

type SocialResponseLike = {
  direction?: "supportive" | "guarded" | "none";
  reactions?: Array<{ locationLabel: string; reactionLabel: string }>;
};

export type TownMapLensInput = {
  world: WorldState | null;
  snapshot: WorldMapSnapshot | null;
  runtime: PersistentTownRuntime | null;
  brief: TownSituationBrief | null;
  socialResponse?: SocialResponseLike | null;
};

function boundedTone(value: number, watch: number, high: number): TownMapLensTone {
  if (value >= high) return "high";
  if (value >= watch) return "watch";
  return "quiet";
}

/** Pure, public-safe projection. Internal keys are used only for lookup. */
export function deriveTownMapLensViewModel(input: TownMapLensInput): TownMapLensViewModel {
  const world = input.world;
  const locations = world?.locations || [];
  const locationNameById = new Map(locations.map((location) => [location.id, location.name]));
  const ruleState = input.runtime?.ruleState;
  const institutions = ruleState?.institutions || [];
  const profileByLocationName = new Map((input.runtime?.locationProfiles || []).map((profile) => [locationNameById.get(profile.locationId) || "", profile]));
  const briefByLocationName = new Map((input.brief?.hotLocations || []).map((location) => [location.name, location]));
  const reactionsByLocation = new Map<string, string[]>();
  for (const reaction of input.socialResponse?.reactions || []) {
    reactionsByLocation.set(reaction.locationLabel, [...(reactionsByLocation.get(reaction.locationLabel) || []), reaction.reactionLabel]);
  }
  const evidenceByLocation = new Map<string, { found: number; total: number }>();
  for (const tile of input.snapshot?.tiles || []) {
    if (!tile.locationName) continue;
    const current = evidenceByLocation.get(tile.locationName) || { found: 0, total: 0 };
    current.found += tile.discoveredEvidenceCount || 0;
    current.total += tile.evidenceCount || 0;
    evidenceByLocation.set(tile.locationName, current);
  }

  const locationSignals = locations.map((location) => {
    const leadingInstitution = institutions
      .map((institution) => ({ name: institution.name, influence: institution.influenceByLocation[location.id] || 0 }))
      .sort((left, right) => right.influence - left.influence || left.name.localeCompare(right.name))[0];
    const profile = profileByLocationName.get(location.name);
    const brief = briefByLocationName.get(location.name);
    const pressure = Math.max(profile?.heat || brief?.heat || 0, profile?.resourcePressure || brief?.resourcePressure || 0);
    const reactions = reactionsByLocation.get(location.name) || [];
    const evidence = evidenceByLocation.get(location.name) || { found: 0, total: 0 };
    const remainingEvidence = Math.max(0, evidence.total - evidence.found);
    return {
      locationName: location.name,
      institutionTone: boundedTone(leadingInstitution?.influence || 0, 40, 60),
      institutionLabel: leadingInstitution ? `${leadingInstitution.name} influence` : "No leading institution",
      pressureTone: boundedTone(pressure, 4, 7),
      pressureLabel: pressure >= 7 ? "High public pressure" : pressure >= 4 ? "Pressure under watch" : "Pressure stable",
      reactionTone: reactions.length ? (input.socialResponse?.direction === "guarded" ? "high" : "watch") : "quiet",
      reactionLabel: reactions[0] || "No current public reaction",
      evidenceTone: remainingEvidence > 0 ? "high" : evidence.found > 0 ? "watch" : "quiet",
      evidenceLabel: evidence.total ? `${evidence.found}/${evidence.total} clues found` : "No case clue here"
    } satisfies TownMapLensLocationSignal;
  }).sort((left, right) => left.locationName.localeCompare(right.locationName));

  const countActive = (field: "institutionTone" | "pressureTone" | "reactionTone" | "evidenceTone") => locationSignals.filter((signal) => signal[field] !== "quiet").length;
  const evidenceTotals = [...evidenceByLocation.values()].reduce((total, item) => ({ found: total.found + item.found, all: total.all + item.total }), { found: 0, all: 0 });
  return {
    defaultLens: "evidence",
    controls: [
      { kind: "institution", label: "Institution", summary: `${countActive("institutionTone")} influenced places` },
      { kind: "pressure", label: "Pressure", summary: `${countActive("pressureTone")} pressure signals` },
      { kind: "reaction", label: "Reaction", summary: `${countActive("reactionTone")} public responses` },
      { kind: "evidence", label: "Evidence", summary: `${evidenceTotals.found}/${evidenceTotals.all} clues found` }
    ],
    locationSignals
  };
}
