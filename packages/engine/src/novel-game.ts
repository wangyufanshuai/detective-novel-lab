import type {
  NovelGameActorSprite,
  NovelGameEventMarker,
  NovelGameLocationNode,
  NovelGameSceneState,
  NovelGameSpriteDefinition,
  NovelGameVisualEffect,
  NovelGameVisualPreferences,
  NovelGameVisualProfile,
  NovelSimulationRun,
  NovelWorldGraph,
  NovelWorldValidationReport
} from "./novel-world";

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeCoord(value: number | undefined, fallback: number, min = 80, max = 920) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const normalized = value > 1 || value < -1 ? value : value * 100;
  return clamp(min + ((normalized + 100) / 200) * (max - min), min, max);
}

function fallbackLocation(): NovelGameLocationNode {
  return {
    id: "game-fallback-stage",
    label: "Story Stage",
    x: 500,
    y: 300,
    kind: "fallback",
    tension: 40,
    active: true
  };
}

function layoutLocations(graph: NovelWorldGraph, activeLocationIds: Set<string>) {
  const sourceLocations = graph.entities.filter((entity) => entity.kind === "location");
  if (!sourceLocations.length) return { locations: [fallbackLocation()], warnings: ["No location entities were found; using a fallback story stage."] };
  const count = sourceLocations.length;
  const centerX = 500;
  const centerY = 300;
  const radius = Math.min(300, Math.max(160, count * 32));
  const locations: NovelGameLocationNode[] = sourceLocations.map((entity, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(count, 1) - Math.PI / 2;
    const fallbackX = centerX + Math.cos(angle) * radius;
    const fallbackY = centerY + Math.sin(angle) * Math.min(radius * 0.62, 220);
    return {
      id: entity.id,
      label: entity.name,
      x: normalizeCoord(entity.x, fallbackX),
      y: normalizeCoord(entity.y, fallbackY, 80, 520),
      kind: "location",
      tension: clamp(entity.tension || 40, 0, 100),
      active: activeLocationIds.has(entity.id)
    };
  });
  return { locations, warnings: [] };
}

function nearestLocation(locations: NovelGameLocationNode[]) {
  return locations[0]?.id || "game-fallback-stage";
}

function locationById(locations: NovelGameLocationNode[]) {
  return new Map(locations.map((location) => [location.id, location]));
}

function hexColor(value: number) {
  return `#${(value & 0xffffff).toString(16).padStart(6, "0")}`;
}

function palette(seed: number, pressure = 0) {
  const hueA = (seed % 360 + pressure) % 360;
  const hueB = (hueA + 58 + seed % 37) % 360;
  const hueC = (hueA + 178) % 360;
  return {
    primary: hexColor(hslToRgb(hueA, 62, 58)),
    secondary: hexColor(hslToRgb(hueB, 44, 38)),
    outline: "#071019",
    accent: hexColor(hslToRgb(hueC, 78, 66))
  };
}

function hslToRgb(hue: number, saturation: number, lightness: number) {
  const s = saturation / 100;
  const l = lightness / 100;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return (Math.round(255 * f(0)) << 16) + (Math.round(255 * f(8)) << 8) + Math.round(255 * f(4));
}

function band(value: number, low: number, high: number, labels: [string, string, string]) {
  return value >= high ? labels[2] : value >= low ? labels[1] : labels[0];
}

function normalizeVisualPreferences(value?: Partial<NovelGameVisualPreferences> | null): NovelGameVisualPreferences {
  return {
    labels: value?.labels === "focus" || value?.labels === "off" ? value.labels : "all",
    evidenceHeat: typeof value?.evidenceHeat === "boolean" ? value.evidenceHeat : true,
    motionTrails: typeof value?.motionTrails === "boolean" ? value.motionTrails : true,
    pixelScale: value?.pixelScale === 2 ? 2 : 1
  };
}

export function createNovelGameSceneState(
  run: NovelSimulationRun | null | undefined,
  graph: NovelWorldGraph,
  selected?: NovelGameSceneState["selected"]
): NovelGameSceneState {
  const currentStep = run?.steps[run.steps.length - 1];
  const activeLocationIds = new Set<string>();
  for (const actor of run?.currentSnapshot.actorStates || []) if (actor.locationEntityId) activeLocationIds.add(actor.locationEntityId);
  if (currentStep) {
    for (const candidate of currentStep.candidates) if (candidate.targetLocationEntityId) activeLocationIds.add(candidate.targetLocationEntityId);
  }
  const { locations, warnings } = layoutLocations(graph, activeLocationIds);
  const locationMap = locationById(locations);
  const fallbackId = nearestLocation(locations);
  const actors: NovelGameActorSprite[] = (run?.currentSnapshot.actorStates || []).map((actor, index) => {
    const locationId = locationMap.has(actor.locationEntityId || "") ? actor.locationEntityId as string : fallbackId;
    const location = locationMap.get(locationId) || locations[0];
    const offset = ((index % 5) - 2) * 70;
    return {
      id: actor.actorEntityId,
      label: actor.name,
      locationId,
      x: location.x + offset,
      y: location.y + 30 + Math.floor(index / 5) * 26,
      bodyCapability: actor.bodyCapability,
      relationshipPressure: actor.relationshipPressure,
      selected: selected?.type === "actor" && selected.id === actor.actorEntityId
    };
  });
  const events: NovelGameEventMarker[] = (run?.steps || []).slice(-8).map((step, index) => {
    const selectedCandidate = step.candidates.find((candidate) => candidate.id === step.selectedCandidateId);
    const locationId = locationMap.has(selectedCandidate?.targetLocationEntityId || "") ? selectedCandidate!.targetLocationEntityId! : fallbackId;
    const location = locationMap.get(locationId) || locations[0];
    return {
      id: `game-event-${step.id}`,
      stepId: step.id,
      eventId: step.sourceEventId,
      label: step.title,
      summary: step.summary,
      locationId,
      x: location.x + ((index % 3) - 1) * 22,
      y: location.y - 34 - Math.floor(index / 3) * 20,
      provenance: step.provenance,
      evidenceCount: step.evidence.length,
      active: selected?.type === "event" ? selected.id === step.id : step.id === currentStep?.id
    };
  });
  const pathWeights = new Map<string, number>();
  for (const event of graph.events) {
    const from = event.locationEntityId;
    if (!from || !locationMap.has(from)) continue;
    for (const participantId of event.participantEntityIds) {
      const actor = actors.find((item) => item.id === participantId);
      if (!actor || actor.locationId === from) continue;
      const key = [actor.locationId, from].sort().join("::");
      pathWeights.set(key, (pathWeights.get(key) || 0) + 1);
    }
  }
  const paths = Array.from(pathWeights.entries()).map(([key, weight]) => {
    const [fromLocationId, toLocationId] = key.split("::");
    return {
      id: `game-path-${fromLocationId}-${toLocationId}`,
      fromLocationId,
      toLocationId,
      weight,
      active: activeLocationIds.has(fromLocationId) || activeLocationIds.has(toLocationId)
    };
  });
  const missingActorLocations = (run?.currentSnapshot.actorStates || []).filter((actor) => actor.locationEntityId && !locationMap.has(actor.locationEntityId)).map((actor) => actor.locationEntityId as string);
  return {
    id: `game-scene-${run?.id || graph.id}`,
    runId: run?.id,
    stepIndex: run?.currentStepIndex || 0,
    mode: run?.mode || "empty",
    status: run?.status || "empty",
    locations,
    actors,
    events,
    paths,
    selected,
    warnings: [...warnings, ...Array.from(new Set(missingActorLocations)).map((id) => `Actor referenced unknown location ${id}; placed on fallback node.`)]
  };
}

export function validateNovelGameSceneState(state: NovelGameSceneState): NovelWorldValidationReport {
  const errors: string[] = [];
  const warnings = [...state.warnings];
  const locationIds = new Set(state.locations.map((location) => location.id));
  const actorIds = new Set<string>();
  if (!state.locations.length) errors.push("game scene requires at least one location node.");
  for (const location of state.locations) {
    if (!Number.isFinite(location.x) || !Number.isFinite(location.y)) errors.push(`location ${location.id} has invalid coordinates.`);
  }
  for (const actor of state.actors) {
    if (actorIds.has(actor.id)) errors.push(`duplicate actor sprite ${actor.id}.`);
    actorIds.add(actor.id);
    if (!locationIds.has(actor.locationId)) errors.push(`actor ${actor.id} references unknown location ${actor.locationId}.`);
  }
  for (const event of state.events) {
    if (!locationIds.has(event.locationId)) errors.push(`event ${event.id} references unknown location ${event.locationId}.`);
    if (!["source", "inferred", "counterfactual", "gap"].includes(event.provenance)) errors.push(`event ${event.id} has invalid provenance.`);
  }
  for (const path of state.paths) {
    if (!locationIds.has(path.fromLocationId) || !locationIds.has(path.toLocationId)) warnings.push(`path ${path.id} references a missing location.`);
  }
  if (!state.actors.length) warnings.push("game scene has no actors yet.");
  return { valid: errors.length === 0, errors, warnings };
}

export function createNovelGameVisualProfile(
  sceneState: NovelGameSceneState,
  graph: NovelWorldGraph,
  preferences?: Partial<NovelGameVisualPreferences> | null
): NovelGameVisualProfile {
  const normalizedPreferences = normalizeVisualPreferences(preferences);
  const entityById = new Map(graph.entities.map((entity) => [entity.id, entity]));
  const locationEventCounts = new Map<string, number>();
  for (const event of graph.events) {
    if (event.locationEntityId) locationEventCounts.set(event.locationEntityId, (locationEventCounts.get(event.locationEntityId) || 0) + 1);
  }
  const sprites: NovelGameSpriteDefinition[] = sceneState.actors.map((actor) => {
    const entity = entityById.get(actor.id);
    const seed = stableHash(`${sceneState.id}:actor:${actor.id}:${entity?.role || ""}`);
    const actorPalette = palette(seed, actor.relationshipPressure);
    return {
      id: `sprite-${actor.id}`,
      actorId: actor.id,
      textureKey: `novel-actor-${seed.toString(36)}`,
      palette: actorPalette,
      bodyCapabilityBand: band(actor.bodyCapability, 45, 75, ["low", "steady", "strong"]) as NovelGameSpriteDefinition["bodyCapabilityBand"],
      pressureBand: band(actor.relationshipPressure, 55, 78, ["calm", "strained", "critical"]) as NovelGameSpriteDefinition["pressureBand"],
      evidenceCount: entity?.evidence?.length || 0,
      seed
    };
  });
  const locations = sceneState.locations.map((location) => {
    const entity = entityById.get(location.id);
    const seed = stableHash(`${sceneState.id}:location:${location.id}:${entity?.traits?.join("/") || ""}`);
    const locationPalette = {
      ground: hexColor(hslToRgb(seed % 360, 32, location.active ? 25 : 18)),
      wall: hexColor(hslToRgb((seed + 38) % 360, 40, location.active ? 42 : 30)),
      accent: hexColor(hslToRgb((seed + 180) % 360, 65, 62)),
      heat: location.tension >= 75 ? "#ff6f74" : location.tension >= 50 ? "#ffe06a" : "#65ffc4"
    };
    return {
      id: `tile-${location.id}`,
      locationId: location.id,
      textureKey: `novel-location-${seed.toString(36)}`,
      palette: locationPalette,
      tensionBand: band(location.tension, 45, 72, ["low", "medium", "high"]) as "low" | "medium" | "high",
      evidenceCount: entity?.evidence?.length || 0,
      eventCount: locationEventCounts.get(location.id) || 0,
      seed
    };
  });
  const effects: NovelGameVisualEffect[] = sceneState.events.map((event) => ({
    id: `effect-${event.id}`,
    targetType: "event" as const,
    targetId: event.id,
    kind: event.provenance === "counterfactual" ? "branch-glitch" as const : event.provenance === "gap" ? "evidence-gap" as const : "source-pulse" as const,
    color: event.provenance === "counterfactual" ? "#ff9f6a" : event.provenance === "gap" ? "#ffe06a" : "#8cc7ff",
    intensity: clamp(event.active ? 0.95 : 0.62, 0, 1)
  }));
  if (normalizedPreferences.evidenceHeat) {
    for (const location of locations.filter((item) => item.evidenceCount || item.eventCount)) {
      effects.push({
        id: `effect-heat-${location.locationId}`,
        targetType: "location",
        targetId: location.locationId,
        kind: "evidence-heat",
        color: location.palette.heat,
        intensity: clamp((location.evidenceCount + location.eventCount) / 8, 0.2, 0.9)
      });
    }
  }
  if (normalizedPreferences.motionTrails) {
    for (const actor of sceneState.actors.filter((item) => item.selected || sceneState.events.some((event) => event.active && event.locationId === item.locationId))) {
      effects.push({
        id: `effect-trail-${actor.id}`,
        targetType: "actor",
        targetId: actor.id,
        kind: "motion-trail",
        color: "#65ffc4",
        intensity: actor.selected ? 0.9 : 0.45
      });
    }
  }
  if (sceneState.selected) {
    effects.push({
      id: `effect-selected-${sceneState.selected.type}-${sceneState.selected.id}`,
      targetType: sceneState.selected.type,
      targetId: sceneState.selected.id,
      kind: "selection",
      color: "#ffffff",
      intensity: 0.9
    });
  }
  return {
    id: `visual-${sceneState.id}-${stableHash(JSON.stringify(normalizedPreferences)).toString(36)}`,
    sceneId: sceneState.id,
    sprites,
    locations,
    effects,
    preferences: normalizedPreferences,
    warnings: sceneState.warnings
  };
}

export function validateNovelGameVisualProfile(profile: NovelGameVisualProfile, sceneState: NovelGameSceneState): NovelWorldValidationReport {
  const errors: string[] = [];
  const warnings = [...profile.warnings];
  const actorIds = new Set(sceneState.actors.map((actor) => actor.id));
  const locationIds = new Set(sceneState.locations.map((location) => location.id));
  const eventIds = new Set(sceneState.events.map((event) => event.id));
  const spriteTextureKeys = new Set<string>();
  if (profile.sceneId !== sceneState.id) errors.push("visual profile sceneId does not match scene state.");
  if (!["all", "focus", "off"].includes(profile.preferences.labels)) errors.push("visual labels preference is invalid.");
  if (![1, 2].includes(profile.preferences.pixelScale)) errors.push("visual pixelScale preference is invalid.");
  for (const sprite of profile.sprites) {
    if (!actorIds.has(sprite.actorId)) errors.push(`visual sprite references unknown actor ${sprite.actorId}.`);
    if (spriteTextureKeys.has(sprite.textureKey)) warnings.push(`visual sprite texture ${sprite.textureKey} is reused.`);
    spriteTextureKeys.add(sprite.textureKey);
  }
  for (const location of profile.locations) {
    if (!locationIds.has(location.locationId)) errors.push(`visual tile references unknown location ${location.locationId}.`);
  }
  for (const effect of profile.effects) {
    if (effect.intensity < 0 || effect.intensity > 1) errors.push(`visual effect ${effect.id} intensity is outside 0-1.`);
    if (effect.targetType === "actor" && !actorIds.has(effect.targetId)) errors.push(`visual effect ${effect.id} references unknown actor ${effect.targetId}.`);
    if (effect.targetType === "location" && !locationIds.has(effect.targetId)) errors.push(`visual effect ${effect.id} references unknown location ${effect.targetId}.`);
    if (effect.targetType === "event" && !eventIds.has(effect.targetId)) errors.push(`visual effect ${effect.id} references unknown event ${effect.targetId}.`);
  }
  return { valid: errors.length === 0, errors, warnings };
}
