import type {
  NpcActionCandidate,
  NpcActionKind,
  NpcAgentState,
  PersistentTownRuntime,
  TownActionDefinition
} from "../persistent-town";
import type { NPCProfile, WorldEvent, WorldState } from "../world-types";

type ActionBuildInput = {
  world: WorldState;
  npc: NPCProfile;
  state: NpcAgentState;
  runtime?: PersistentTownRuntime | null;
  events: WorldEvent[];
  locations: Array<{ id: string }>;
  targetNpcId?: string;
  targetNpc?: NPCProfile;
  targetLocationId: string;
};

type ActionModuleDeps = {
  locationReachable: (world: WorldState, from: string, to: string) => boolean;
  scoreCandidate: TownActionDefinition["score"];
  createEventForAction: TownActionDefinition["execute"];
};

function candidateId(npc: NPCProfile, runtime: PersistentTownRuntime | null | undefined, kind: string) {
  return `candidate:${npc.id}:${runtime?.tick || 0}:${kind}`;
}

export function createTownActionDefinitions(deps: ActionModuleDeps): TownActionDefinition[] {
  const { locationReachable, scoreCandidate, createEventForAction } = deps;
  return [
    {
      kind: "observe",
      chainStage: "memory",
      expectedObservationKind: "direct",
      buildCandidate: ({ npc, state, runtime }: ActionBuildInput) => ({
        id: candidateId(npc, runtime, "observe"),
        npcId: npc.id,
        kind: "observe" as NpcActionKind,
        targetLocationId: state.locationId,
        description: `${npc.name} reviews nearby events and updates memory.`,
        legal: true
      }),
      canStart: () => ({ legal: true }),
      score: scoreCandidate,
      execute: createEventForAction
    },
    {
      kind: "move",
      chainStage: "opportunity",
      expectedObservationKind: "same-location",
      buildCandidate: ({ npc, runtime, targetLocationId }: ActionBuildInput) => ({
        id: candidateId(npc, runtime, "move"),
        npcId: npc.id,
        kind: "move" as NpcActionKind,
        targetLocationId,
        description: `${npc.name} moves toward ${targetLocationId} to follow the current plan.`,
        legal: true
      }),
      canStart: ({ world, state, candidate }) => ({
        legal: locationReachable(world, state.locationId, candidate.targetLocationId),
        reason: "target location is not reachable from current location"
      }),
      score: scoreCandidate,
      execute: createEventForAction
    },
    {
      kind: "talk",
      chainStage: "memory",
      expectedObservationKind: "direct",
      buildCandidate: ({ npc, runtime, targetLocationId, targetNpcId, targetNpc }: ActionBuildInput) => ({
        id: candidateId(npc, runtime, "talk"),
        npcId: npc.id,
        kind: "talk" as NpcActionKind,
        targetLocationId,
        targetNpcId,
        description: `${npc.name} talks with ${targetNpc?.name || targetNpcId || "a witness"} about recent pressure.`,
        legal: true
      }),
      canStart: ({ candidate }) => ({ legal: Boolean(candidate.targetNpcId), reason: "target NPC is missing" }),
      score: scoreCandidate,
      execute: createEventForAction
    },
    {
      kind: "investigate",
      chainStage: "opportunity",
      expectedObservationKind: "deduced",
      buildCandidate: ({ npc, state, runtime }: ActionBuildInput) => ({
        id: candidateId(npc, runtime, "investigate"),
        npcId: npc.id,
        kind: "investigate" as NpcActionKind,
        targetLocationId: state.locationId,
        description: `${npc.name} checks nearby traces and compares them with remembered events.`,
        legal: true
      }),
      canStart: () => ({ legal: true }),
      score: scoreCandidate,
      execute: createEventForAction
    },
    {
      kind: "spread-rumor",
      chainStage: "memory",
      expectedObservationKind: "rumor",
      buildCandidate: ({ npc, runtime, targetLocationId, targetNpcId, targetNpc }: ActionBuildInput) => ({
        id: candidateId(npc, runtime, "rumor"),
        npcId: npc.id,
        kind: "spread-rumor" as NpcActionKind,
        targetLocationId,
        targetNpcId,
        description: `${npc.name} passes a partial account to ${targetNpc?.name || targetNpcId || "another resident"}.`,
        legal: true
      }),
      canStart: ({ state, candidate }) => ({
        legal: Boolean(candidate.targetNpcId) && state.knownFactIds.length > 0,
        reason: !candidate.targetNpcId ? "target NPC is missing" : "known facts are not available for rumor propagation"
      }),
      score: scoreCandidate,
      execute: createEventForAction
    },
    {
      kind: "seek-alibi",
      chainStage: "alibi",
      expectedObservationKind: "alibi",
      buildCandidate: ({ world, npc, state, runtime, targetNpcId }: ActionBuildInput) => ({
        id: candidateId(npc, runtime, "alibi"),
        npcId: npc.id,
        kind: "seek-alibi" as NpcActionKind,
        targetLocationId: world.locations.find((location) => location.kind === "public")?.id || state.locationId,
        targetNpcId,
        description: `${npc.name} looks for a public alibi before pressure attaches to them.`,
        legal: true
      }),
      canStart: ({ state }) => ({
        legal: state.relationshipPressure >= 3 || state.secretRisk >= 3,
        reason: "relationship pressure or secret risk is too low to seek an alibi"
      }),
      score: scoreCandidate,
      execute: createEventForAction
    },
    {
      kind: "pressure",
      chainStage: "motive",
      expectedObservationKind: "direct",
      buildCandidate: ({ npc, runtime, targetLocationId, targetNpcId, targetNpc }: ActionBuildInput) => ({
        id: candidateId(npc, runtime, "pressure"),
        npcId: npc.id,
        kind: "pressure" as NpcActionKind,
        targetLocationId,
        targetNpcId,
        description: `${npc.name} applies pressure to ${targetNpc?.name || targetNpcId || "a rival"} over a risky secret.`,
        legal: true
      }),
      canStart: ({ state, candidate }) => ({
        legal: Boolean(candidate.targetNpcId) && state.relationshipPressure >= 3,
        reason: !candidate.targetNpcId ? "target NPC is missing" : "relationship pressure is too low"
      }),
      score: scoreCandidate,
      execute: createEventForAction
    },
    {
      kind: "confront",
      chainStage: "motive",
      expectedObservationKind: "direct",
      buildCandidate: ({ npc, runtime, targetLocationId, targetNpcId, targetNpc }: ActionBuildInput) => ({
        id: candidateId(npc, runtime, "confront"),
        npcId: npc.id,
        kind: "confront" as NpcActionKind,
        targetLocationId,
        targetNpcId,
        description: `${npc.name} confronts ${targetNpc?.name || targetNpcId || "a rival"} as secret risk rises.`,
        legal: true
      }),
      canStart: ({ state, candidate }) => ({
        legal: Boolean(candidate.targetNpcId) && state.relationshipPressure >= 4,
        reason: !candidate.targetNpcId ? "target NPC is missing" : "relationship pressure is too low"
      }),
      score: scoreCandidate,
      execute: createEventForAction
    },
    {
      kind: "obtain-resource",
      chainStage: "means",
      expectedObservationKind: "direct",
      buildCandidate: ({ world, npc, state, runtime }: ActionBuildInput) => ({
        id: candidateId(npc, runtime, "resource"),
        npcId: npc.id,
        kind: "obtain-resource" as NpcActionKind,
        targetLocationId: world.locations.find((location) => location.kind === "restricted" || location.kind === "work")?.id || state.locationId,
        resourceId: npc.skills.includes("medicine") ? "resource:medicine" : npc.skills.includes("mechanical") ? "resource:tool" : "resource:local-access",
        description: `${npc.name} tries to obtain a resource relevant to their skills.`,
        legal: true
      }),
      canStart: () => ({ legal: true }),
      score: scoreCandidate,
      execute: createEventForAction
    },
    {
      kind: "cover-up",
      chainStage: "cover-up",
      expectedObservationKind: "deduced",
      buildCandidate: ({ npc, state, runtime }: ActionBuildInput) => ({
        id: candidateId(npc, runtime, "cover-up"),
        npcId: npc.id,
        kind: "cover-up" as NpcActionKind,
        targetLocationId: state.locationId,
        description: `${npc.name} tries to muddy the source trail before witnesses connect it.`,
        legal: true
      }),
      canStart: ({ state, events, npc }) => ({
        legal: state.secretRisk >= 3 || events.some((event) => event.hidden && event.actorIds.includes(npc.id)),
        reason: "secret risk is too low and there is no hidden source trail"
      }),
      score: scoreCandidate,
      execute: createEventForAction
    },
    {
      kind: "hide-trace",
      chainStage: "cover-up",
      expectedObservationKind: "deduced",
      buildCandidate: ({ npc, state, runtime }: ActionBuildInput) => ({
        id: candidateId(npc, runtime, "hide-trace"),
        npcId: npc.id,
        kind: "hide-trace" as NpcActionKind,
        targetLocationId: state.locationId,
        description: `${npc.name} hides a trace that could expose the source chain.`,
        legal: true
      }),
      canStart: ({ state, events, npc }) => ({
        legal: state.secretRisk >= 5 || events.some((event) => event.hidden && event.actorIds.includes(npc.id)),
        reason: "secret risk is too low and there is no trace to hide"
      }),
      score: scoreCandidate,
      execute: createEventForAction
    }
  ];
}

export function strongestLegalAction(candidates: NpcActionCandidate[], fallbackIndex = 0) {
  return [...candidates]
    .filter((candidate) => candidate.legal)
    .sort((left, right) => right.score.total - left.score.total || left.id.localeCompare(right.id))[fallbackIndex] || candidates[0];
}
