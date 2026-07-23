import type { WorldLocation, WorldState } from "./world-types";

export type TownMapPackManifest = {
  id: string;
  name: string;
  version: string;
  schemaVersion: "town-map-pack.v1";
  author?: string;
  description?: string;
  createdAt: string;
  entrypoint: "map.json";
};

export type TownMapPackInteraction = {
  id: string;
  locationId: string;
  kind: "observe" | "question" | "search" | "work" | "socialize" | "travel";
  label: string;
  risk: number;
  tags: string[];
};

export type TownMapPackSpawnPoint = {
  id: string;
  locationId: string;
  roleHint: "detective" | "witness" | "suspect" | "official" | "worker" | "visitor";
  weight: number;
};

export type TownMapPack = {
  manifest: TownMapPackManifest;
  locations: WorldLocation[];
  connections: Array<{ from: string; to: string; kind: "street" | "alley" | "interior" | "route"; travelMinutes: number }>;
  interactions: TownMapPackInteraction[];
  spawnPoints: TownMapPackSpawnPoint[];
  assets?: Record<string, string>;
  docs?: Record<string, string>;
};

export type TownMapPackValidationReport = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    packId?: string;
    locationCount: number;
    connectionCount: number;
    interactionCount: number;
    spawnPointCount: number;
  };
};

function nowIso() {
  return new Date().toISOString();
}

function slug(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "town-map-pack";
}

function hasAbsolutePath(value: string) {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("/") || value.startsWith("\\\\");
}

function scanUnsafe(value: unknown, path = "$", errors: string[] = []) {
  if (typeof value === "string") {
    if (/sk-[a-z0-9]/i.test(value) || /api[_-]?key|secret|token/i.test(path)) errors.push(`${path} may contain a secret`);
    if (hasAbsolutePath(value)) errors.push(`${path} contains an absolute path`);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => scanUnsafe(item, `${path}[${index}]`, errors));
  } else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (["runtime", "snapshot", "benchmarkLatest", "hiddenDebugLog", "agent_state_snapshot"].includes(key)) {
        errors.push(`${path}.${key} contains runtime-only state`);
      }
      scanUnsafe(nested, `${path}.${key}`, errors);
    }
  }
  return errors;
}

function connectionKey(from: string, to: string) {
  return [from, to].sort().join("::");
}

function interactionKindFor(location: WorldLocation): TownMapPackInteraction["kind"] {
  if (location.kind === "restricted") return "search";
  if (location.kind === "work") return "work";
  if (location.kind === "home") return "question";
  if (location.kind === "public") return "socialize";
  return "observe";
}

function spawnRoleFor(location: WorldLocation): TownMapPackSpawnPoint["roleHint"] {
  const text = `${location.kind} ${location.name} ${location.description}`.toLowerCase();
  if (text.includes("police") || text.includes("hall")) return "official";
  if (text.includes("dock") || text.includes("shop") || location.kind === "work") return "worker";
  if (location.kind === "home") return "witness";
  return "visitor";
}

export function createTownMapPackFromWorld(
  world: WorldState,
  options: Partial<Pick<TownMapPackManifest, "id" | "name" | "author" | "description">> = {}
): TownMapPack {
  const name = options.name || "Fog Lamp Town";
  const id = options.id || slug(name);
  const seenConnections = new Set<string>();
  const connections: TownMapPack["connections"] = [];
  for (const location of world.locations) {
    for (const targetId of location.connectedLocationIds || []) {
      const key = connectionKey(location.id, targetId);
      if (seenConnections.has(key)) continue;
      seenConnections.add(key);
      connections.push({ from: location.id, to: targetId, kind: "street", travelMinutes: 10 });
    }
  }
  return {
    manifest: {
      id,
      name,
      version: "1.0.0",
      schemaVersion: "town-map-pack.v1",
      author: options.author,
      description: options.description || "Semantic map pack for Detective Novel Lab.",
      createdAt: nowIso(),
      entrypoint: "map.json"
    },
    locations: world.locations.map((location) => ({ ...location, connectedLocationIds: [...(location.connectedLocationIds || [])] })),
    connections,
    interactions: world.locations.map((location) => ({
      id: `interaction-${location.id}`,
      locationId: location.id,
      kind: interactionKindFor(location),
      label: `Inspect ${location.name}`,
      risk: location.kind === "restricted" ? 55 : 20,
      tags: [location.kind]
    })),
    spawnPoints: world.locations.map((location, index) => ({
      id: `spawn-${location.id}`,
      locationId: location.id,
      roleHint: index === 0 ? "detective" : spawnRoleFor(location),
      weight: index === 0 ? 80 : 40
    })),
    assets: {},
    docs: {
      "README.md": `# ${name}\n\n${options.description || "Semantic map pack for Detective Novel Lab."}\n`
    }
  };
}

export function builtInTownMapPacks(world: WorldState): TownMapPack[] {
  return [
    createTownMapPackFromWorld(world, {
      id: "fog-lamp-town",
      name: "Fog Lamp Town",
      description: "Default semantic town map exported from the current Detective Novel Lab location graph."
    })
  ];
}

export function validateTownMapPack(pack: unknown): TownMapPackValidationReport {
  const candidate = pack as Partial<TownMapPack>;
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!candidate || typeof candidate !== "object") errors.push("pack must be an object");
  if (!candidate.manifest?.id) errors.push("manifest.id is required");
  if (candidate.manifest?.schemaVersion !== "town-map-pack.v1") errors.push("manifest.schemaVersion must be town-map-pack.v1");
  if (candidate.manifest?.entrypoint !== "map.json") errors.push("manifest.entrypoint must be map.json");
  if (!candidate.locations?.length) errors.push("locations must not be empty");
  const locationIds = new Set((candidate.locations || []).map((location) => location.id));
  for (const location of candidate.locations || []) {
    if (!location.id) errors.push("location.id is required");
    for (const connectedId of location.connectedLocationIds || []) {
      if (!locationIds.has(connectedId)) errors.push(`location ${location.id} references missing connection ${connectedId}`);
    }
  }
  for (const connection of candidate.connections || []) {
    if (!locationIds.has(connection.from)) errors.push(`connection ${connection.from}->${connection.to} has missing from location`);
    if (!locationIds.has(connection.to)) errors.push(`connection ${connection.from}->${connection.to} has missing to location`);
  }
  for (const interaction of candidate.interactions || []) {
    if (!locationIds.has(interaction.locationId)) errors.push(`interaction ${interaction.id || "(missing id)"} references missing location ${interaction.locationId}`);
  }
  for (const spawnPoint of candidate.spawnPoints || []) {
    if (!locationIds.has(spawnPoint.locationId)) errors.push(`spawn point ${spawnPoint.id || "(missing id)"} references missing location ${spawnPoint.locationId}`);
  }
  if (!candidate.connections?.length) warnings.push("connections are empty");
  if (!candidate.interactions?.length) warnings.push("interactions are empty");
  if (!candidate.spawnPoints?.length) warnings.push("spawnPoints are empty");
  errors.push(...scanUnsafe(candidate));
  const uniqueErrors = Array.from(new Set(errors));
  return {
    ok: uniqueErrors.length === 0,
    errors: uniqueErrors,
    warnings: Array.from(new Set(warnings)),
    summary: {
      packId: candidate.manifest?.id,
      locationCount: candidate.locations?.length || 0,
      connectionCount: candidate.connections?.length || 0,
      interactionCount: candidate.interactions?.length || 0,
      spawnPointCount: candidate.spawnPoints?.length || 0
    }
  };
}

export function townMapPackToLocations(pack: TownMapPack): WorldLocation[] {
  const validation = validateTownMapPack(pack);
  if (!validation.ok) throw new Error(`Invalid TownMapPack: ${validation.errors.join("; ")}`);
  return pack.locations.map((location) => ({ ...location, connectedLocationIds: [...(location.connectedLocationIds || [])] }));
}

export function previewTownMapPackImport(pack: unknown) {
  const validation = validateTownMapPack(pack);
  return {
    validation,
    pack: validation.ok ? pack as TownMapPack : null,
    installable: validation.ok,
    message: validation.ok
      ? `TownMapPack ${validation.summary.packId} is valid and ready to import.`
      : `TownMapPack is invalid: ${validation.errors.join("; ")}`
  };
}
