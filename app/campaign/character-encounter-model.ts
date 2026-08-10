import type { SafeContextAction } from "./context-action-resolver";

export type CharacterEncounterPosture = "supportive" | "guarded" | "busy" | "avoidant" | "routine";
export type CharacterEncounterAvailability = "available" | "limited" | "public-only" | "practice";
export type CharacterEncounterPressureBand = "quiet" | "watch" | "high";

export type CharacterEncounterAction = {
  kind: SafeContextAction["kind"];
  label: string;
  detail: string;
  enabled: boolean;
  primary: boolean;
  shortcut?: string;
  disabledReason?: string;
};

export type CharacterEncounterViewModel = {
  actorName: string;
  roleLabel: string;
  locationLabel: string;
  availability: CharacterEncounterAvailability;
  availabilityLabel: string;
  posture: CharacterEncounterPosture;
  postureLabel: string;
  postureDetail: string;
  factionLabel: string;
  factionStandingLabel: string;
  latestReaction?: string;
  progressLabel: string;
  boundaryLabel: string;
  nextAction: string;
  actions: CharacterEncounterAction[];
};

export type CharacterEncounterInput = {
  actor: {
    name: string;
    roleLabel?: string;
    locationLabel?: string;
  };
  institution?: {
    label: string;
    pressureBand: CharacterEncounterPressureBand;
  };
  faction?: {
    label: string;
    standing: "trusted" | "neutral" | "strained" | "hostile";
    directionLabel: "supportive" | "steady" | "guarded" | "closed";
  };
  locationPressure?: CharacterEncounterPressureBand;
  socialResponse?: {
    direction?: "supportive" | "guarded" | "none";
    reactions?: Array<{
      actorName: string;
      roleLabel: string;
      locationLabel: string;
      reactionLabel: string;
    }>;
  } | null;
  investigation: {
    hasCase: boolean;
    hasSession: boolean;
    joined: boolean;
    observed: boolean;
    questioned: boolean;
    challenged: boolean;
    accepted: boolean;
    scope?: "authoritative" | "practice";
    caseLinked: boolean;
  };
  actions: SafeContextAction[];
};

const POSTURE_PRESENTATION: Record<CharacterEncounterPosture, Pick<CharacterEncounterViewModel, "postureLabel" | "postureDetail">> = {
  supportive: {
    postureLabel: "Supportive",
    postureDetail: "Openly coordinating with the town's current public response."
  },
  guarded: {
    postureLabel: "Guarded",
    postureDetail: "Keeping a careful public watch while pressure remains visible."
  },
  busy: {
    postureLabel: "Busy",
    postureDetail: "Public duties or recent case contact are limiting attention."
  },
  avoidant: {
    postureLabel: "Avoidant",
    postureDetail: "Public contact is restrained; no hidden motive is inferred."
  },
  routine: {
    postureLabel: "Routine",
    postureDetail: "Following an ordinary public routine without a current town signal."
  }
};

const AVAILABILITY_LABELS: Record<CharacterEncounterAvailability, string> = {
  available: "Available for current action",
  limited: "Available with public pressure",
  "public-only": "Public context only",
  practice: "Replay practice · world frozen"
};

function matchedReaction(input: CharacterEncounterInput) {
  return (input.socialResponse?.reactions || []).find((reaction) => reaction.actorName === input.actor.name);
}

function reactionSuggestsAvoidance(label: string) {
  return /avoid|changes? (?:a )?(?:familiar )?(?:public )?routine|keeps? distance|withdraw/i.test(label);
}

function derivePosture(input: CharacterEncounterInput, reaction?: ReturnType<typeof matchedReaction>): CharacterEncounterPosture {
  if (reaction && input.socialResponse?.direction === "supportive") return "supportive";
  if (reaction && reactionSuggestsAvoidance(reaction.reactionLabel)) return "avoidant";
  if (reaction && input.socialResponse?.direction === "guarded") return "guarded";
  if (input.faction?.standing === "hostile" || input.faction?.directionLabel === "closed") return "avoidant";
  if (input.faction?.directionLabel === "guarded" || input.locationPressure === "high") return "guarded";
  if (input.institution?.pressureBand === "high" || input.investigation.questioned) return "busy";
  if (input.locationPressure === "watch" || input.institution?.pressureBand === "watch") return "guarded";
  return "routine";
}

function deriveAvailability(input: CharacterEncounterInput, posture: CharacterEncounterPosture, actions: CharacterEncounterAction[]): CharacterEncounterAvailability {
  if (input.investigation.scope === "practice") return "practice";
  if (!input.investigation.hasCase || !input.investigation.caseLinked) return "public-only";
  if (!actions.some((action) => action.enabled)) return "public-only";
  if (posture === "guarded" || posture === "avoidant" || posture === "busy") return "limited";
  return "available";
}

function progressLabel(input: CharacterEncounterInput) {
  if (!input.investigation.hasCase) return "No active case context";
  if (!input.investigation.caseLinked) return "Visible resident · outside the current certified route";
  if (input.investigation.accepted) return "Case accepted · review context only";
  if (input.investigation.challenged) return "Challenge recorded on the certified route";
  if (input.investigation.questioned) return "Questioning recorded · follow-up remains route-bound";
  if (!input.investigation.joined) return "Join required before case contact";
  if (!input.investigation.observed) return "Observe the public case window first";
  return "Prepared for the current certified action";
}

function nextAction(input: CharacterEncounterInput, actions: CharacterEncounterAction[]) {
  const primary = actions.find((action) => action.primary && action.enabled) || actions.find((action) => action.enabled);
  if (primary) return `${primary.label}. ${primary.detail}`;
  if (!input.investigation.caseLinked) return "Select a case-linked character or continue from the Current Objective.";
  return "Continue from the Current Objective; this encounter does not create a new legal action.";
}

/**
 * Pure public-safe projection. It receives only labels, bounded bands, public
 * investigation progress, and actions already selected by the existing
 * context resolver. It never reads case roles, memories, truth, or raw events.
 */
export function deriveCharacterEncounter(input: CharacterEncounterInput): CharacterEncounterViewModel {
  const reaction = matchedReaction(input);
  const actions = input.actions.slice(0, 3).map((action) => ({
    kind: action.kind,
    label: action.label,
    detail: action.detail,
    enabled: action.enabled,
    primary: action.primary,
    shortcut: action.shortcut,
    disabledReason: action.disabledReason
  }));
  const posture = derivePosture(input, reaction);
  const availability = deriveAvailability(input, posture, actions);
  const presentation = POSTURE_PRESENTATION[posture];
  const factionLabel = input.faction?.label || input.institution?.label || "Independent town resident";
  const factionStandingLabel = input.faction
    ? `${input.faction.standing} · ${input.faction.directionLabel}`
    : "neutral · no recorded player-authoritative change";
  return {
    actorName: input.actor.name || "Town resident",
    roleLabel: input.actor.roleLabel || "Town resident",
    locationLabel: input.actor.locationLabel || "Public town location",
    availability,
    availabilityLabel: AVAILABILITY_LABELS[availability],
    posture,
    ...presentation,
    factionLabel,
    factionStandingLabel,
    latestReaction: reaction?.reactionLabel,
    progressLabel: progressLabel(input),
    boundaryLabel: input.investigation.scope === "practice"
      ? "Practice actions may update this investigation session; Persistent Town remains frozen."
      : "Public posture guides presentation only; case truth and legal actions remain unchanged.",
    nextAction: nextAction(input, actions),
    actions
  };
}

export type CharacterEncounterCollectionInput = {
  actors: Array<{ id: string; name: string; role: string; locationName: string }>;
  professions: Array<{ npcId: string; institutionId?: string }>;
  institutions: Array<{ id: string; name: string; kind: string; pressure?: number }>;
  factionStandings?: Array<{ label: string; standing: "trusted" | "neutral" | "strained" | "hostile"; directionLabel: "supportive" | "steady" | "guarded" | "closed" }>;
  factionLabelByInstitutionKind: Record<string, string>;
  locationSignals: Array<{ locationName: string; pressureTone: CharacterEncounterPressureBand }>;
  socialResponse?: CharacterEncounterInput["socialResponse"];
  caseCharacterIds: Set<string>;
  selectedCharacterId?: string;
  selectedCharacterAvailable: boolean;
  selectedActions: SafeContextAction[];
  investigation: Omit<CharacterEncounterInput["investigation"], "questioned" | "challenged" | "caseLinked">;
  questionedCharacterIds: Set<string>;
  challengedCharacterIds: Set<string>;
};

/** Builds all visible encounter cards from already public-safe town projections. */
export function deriveCharacterEncounters(input: CharacterEncounterCollectionInput) {
  const encounters = new Map<string, CharacterEncounterViewModel>();
  const locationSignals = new Map(input.locationSignals.map((signal) => [signal.locationName, signal]));
  for (const actor of input.actors) {
    const profession = input.professions.find((item) => item.npcId === actor.id);
    const institution = input.institutions.find((item) => item.id === profession?.institutionId);
    const factionLabel = input.factionLabelByInstitutionKind[institution?.kind || "civic"];
    const factionEntry = input.factionStandings?.find((entry) => entry.label === factionLabel);
    const signal = locationSignals.get(actor.locationName);
    encounters.set(actor.id, deriveCharacterEncounter({
      actor: { name: actor.name, roleLabel: actor.role, locationLabel: actor.locationName },
      institution: {
        label: institution?.name || factionLabel || "Town institution",
        pressureBand: institution?.pressure && institution.pressure >= 70 ? "high" : institution?.pressure && institution.pressure >= 45 ? "watch" : "quiet"
      },
      faction: factionEntry ? {
        label: factionLabel || "Town network",
        standing: factionEntry.standing,
        directionLabel: factionEntry.directionLabel
      } : undefined,
      locationPressure: signal?.pressureTone || "quiet",
      socialResponse: input.socialResponse,
      investigation: {
        ...input.investigation,
        questioned: input.questionedCharacterIds.has(actor.id),
        challenged: input.challengedCharacterIds.has(actor.id),
        caseLinked: input.caseCharacterIds.has(actor.id)
      },
      actions: actor.id === input.selectedCharacterId && input.selectedCharacterAvailable ? input.selectedActions : []
    }));
  }
  return encounters;
}
