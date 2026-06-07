import type { CaseFromLog, PlayerSession, WorldEvent, WorldLocation, WorldMapActor, WorldMapMarker, WorldMapSnapshot, WorldMapTerrain, WorldMapTile, WorldState } from "./world-types";

const mapWidth = 28;
const mapHeight = 18;
const anchorPadding = 3;

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map((part) => Number(part));
  return hours * 60 + minutes;
}

function normalizeCoordinate(value: number | undefined, min: number, max: number, size: number) {
  if (value === undefined) return Math.floor(size / 2);
  if (max === min) return Math.floor(size / 2);
  return Math.round(anchorPadding + ((value - min) / (max - min)) * (size - anchorPadding * 2 - 1));
}

function locationPositions(locations: WorldLocation[]) {
  const xs = locations.map((location) => location.x ?? 0);
  const ys = locations.map((location) => location.y ?? 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const positions = new Map<string, { x: number; y: number }>();
  for (const location of locations) {
    positions.set(location.id, {
      x: normalizeCoordinate(location.x, minX, maxX, mapWidth),
      y: normalizeCoordinate(location.y, minY, maxY, mapHeight)
    });
  }
  return positions;
}

function locationName(world: WorldState, id: string) {
  return world.locations.find((location) => location.id === id)?.name || id;
}

function terrainFor(x: number, y: number): WorldMapTerrain {
  if (x >= 21 || (x >= 19 && y >= 9)) return "water";
  if (x <= 3 && y <= 11) return "hill";
  if (y >= 13 && x <= 11) return "forest";
  if ((x >= 11 && x <= 16 && y >= 3 && y <= 14) || Math.abs(y - Math.round(13 - x * 0.32)) <= 0) return "road";
  if (x >= 14 && x <= 20 && y >= 4 && y <= 8) return "district";
  return "grass";
}

function buildRoads(tiles: WorldMapTile[], locations: WorldLocation[], positions: Map<string, { x: number; y: number }>) {
  const byId = new Map(tiles.map((tile) => [tile.id, tile]));
  const setRoad = (x: number, y: number) => {
    const tile = byId.get(`${x}:${y}`);
    if (tile && tile.terrain !== "water" && tile.terrain !== "building") tile.terrain = "road";
  };
  for (const location of locations) {
    const from = positions.get(location.id);
    if (!from) continue;
    for (const targetId of location.connectedLocationIds) {
      const to = positions.get(targetId);
      if (!to) continue;
      let x = from.x;
      let y = from.y;
      while (x !== to.x) {
        setRoad(x, y);
        x += x < to.x ? 1 : -1;
      }
      while (y !== to.y) {
        setRoad(x, y);
        y += y < to.y ? 1 : -1;
      }
      setRoad(to.x, to.y);
    }
  }
}

function latestLocationForActor(world: WorldState, events: WorldEvent[], actorId: string, day: number, time: string) {
  const limit = toMinutes(time);
  const event = events
    .filter((item) => item.day === day && item.actorIds.includes(actorId) && toMinutes(item.time) <= limit)
    .sort((a, b) => toMinutes(b.time) - toMinutes(a.time))[0];
  if (event) return event.locationId;
  const npc = world.npcs.find((item) => item.id === actorId);
  const scheduleEntry = Object.entries(npc?.schedule || {})
    .filter(([entryTime]) => toMinutes(entryTime) <= limit)
    .sort(([a], [b]) => toMinutes(b) - toMinutes(a))[0];
  return scheduleEntry?.[1] || npc?.homeLocationId || "town-square";
}

function evidenceByScene(caseFromLog?: CaseFromLog) {
  const map = new Map<string, string[]>();
  if (!caseFromLog) return map;
  for (const scene of caseFromLog.deductionCase.scenes) map.set(scene.id, scene.evidenceIds);
  return map;
}

function actorStatus(actorId: string, caseFromLog: CaseFromLog | undefined, session: PlayerSession | undefined): WorldMapActor["status"] {
  if (!caseFromLog) return session?.interrogationLog.some((entry) => entry.characterId === actorId) ? "questioned" : "alive";
  if (actorId === caseFromLog.generationProfile.victimId) return "victim";
  if (actorId === caseFromLog.generationProfile.culpritId) return "culprit";
  if (actorId === caseFromLog.generationProfile.witnessId) return "witness";
  if (caseFromLog.generationProfile.focusSuspectIds.includes(actorId)) return "suspect";
  if (session?.interrogationLog.some((entry) => entry.characterId === actorId)) return "questioned";
  return "alive";
}

export function buildWorldMapSnapshot(world: WorldState, events: WorldEvent[], caseFromLog?: CaseFromLog, session?: PlayerSession | null, input: { day?: number; time?: string } = {}): WorldMapSnapshot {
  const day = input.day || Math.max(1, Math.min(world.day || 1, caseFromLog?.deductionCase.truth.trueTimeline[0]?.time.includes("第1日") ? 1 : world.day || 1));
  const time = input.time || "21:30";
  const positions = locationPositions(world.locations);
  const discovered = new Set(session?.discoveredEvidenceIds || []);
  const sceneEvidence = evidenceByScene(caseFromLog);
  const tiles: WorldMapTile[] = [];

  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) {
      tiles.push({ id: `${x}:${y}`, x, y, terrain: terrainFor(x, y), searchable: false, evidenceCount: 0, discoveredEvidenceCount: 0 });
    }
  }
  buildRoads(tiles, world.locations, positions);

  for (const location of world.locations) {
    const point = positions.get(location.id);
    if (!point) continue;
    const tile = tiles.find((item) => item.x === point.x && item.y === point.y);
    const evidenceIds = sceneEvidence.get(location.id) || [];
    if (tile) {
      tile.terrain = location.kind === "crime" ? "district" : "building";
      tile.locationId = location.id;
      tile.locationName = location.name;
      tile.searchable = evidenceIds.length > 0;
      tile.evidenceCount = evidenceIds.length;
      tile.discoveredEvidenceCount = evidenceIds.filter((id) => discovered.has(id)).length;
    }
  }

  const actors: WorldMapActor[] = world.npcs.map((npc, index) => {
    const locationId = latestLocationForActor(world, events, npc.id, day, time);
    const point = positions.get(locationId) || { x: 1 + (index % 5), y: 1 + Math.floor(index / 5) };
    const status = actorStatus(npc.id, caseFromLog, session || undefined);
    return {
      id: npc.id,
      name: npc.name,
      role: npc.role,
      locationId,
      locationName: locationName(world, locationId),
      x: point.x,
      y: point.y,
      status,
      isVictim: status === "victim",
      isCulprit: status === "culprit",
      isQuestioned: Boolean(session?.interrogationLog.some((entry) => entry.characterId === npc.id))
    };
  });

  const limit = toMinutes(time);
  const visibleEvents = events
    .filter((event) => event.day === day && toMinutes(event.time) <= limit)
    .sort((a, b) => toMinutes(b.time) - toMinutes(a.time))
    .slice(0, 80);
  const selectedEvents = events.filter((event) => event.day === day && Math.abs(toMinutes(event.time) - limit) <= 30);

  const markers: WorldMapMarker[] = [];
  for (const event of selectedEvents) {
    const point = positions.get(event.locationId);
    if (!point) continue;
    markers.push({
      id: `event-${event.id}`,
      type: event.type === "death" ? "crime" : "event",
      label: event.publicSummary,
      locationId: event.locationId,
      locationName: locationName(world, event.locationId),
      x: point.x,
      y: point.y,
      time: event.time,
      eventId: event.id,
      evidenceId: event.evidenceId,
      discovered: event.evidenceId ? discovered.has(event.evidenceId) : undefined,
      relatedCharacterIds: event.relatedCharacterIds.length ? event.relatedCharacterIds : event.actorIds
    });
  }
  if (caseFromLog) {
    for (const evidence of caseFromLog.deductionCase.evidence) {
      const scene = caseFromLog.deductionCase.scenes.find((item) => item.evidenceIds.includes(evidence.id));
      if (!scene) continue;
      const point = positions.get(scene.id);
      if (!point) continue;
      markers.push({
        id: `evidence-${evidence.id}`,
        type: discovered.has(evidence.id) ? "evidence" : "highlight",
        label: evidence.title,
        locationId: scene.id,
        locationName: scene.name,
        x: point.x,
        y: point.y,
        evidenceId: evidence.id,
        discovered: discovered.has(evidence.id),
        relatedCharacterIds: evidence.relatedCharacterIds
      });
    }
  }

  return {
    worldId: world.id,
    caseId: caseFromLog?.id,
    sessionId: session?.id,
    day,
    time,
    width: mapWidth,
    height: mapHeight,
    tiles,
    actors,
    markers,
    visibleEvents,
    selectedEventIds: selectedEvents.map((event) => event.id),
    discoveredEvidenceIds: Array.from(discovered)
  };
}
