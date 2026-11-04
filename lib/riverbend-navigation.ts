/** Local physical movement only. This module has no authority over case facts or world time. */
export type TownPoint = [number, number];
export type TownBounds = [number, number, number, number];
export interface TownDestination { id: string; label: string; entrance: TownPoint }
export interface TownNavigationData {
  schema: string;
  assetSha256: string;
  sourceSha256: string;
  player: { spawn: TownPoint; radius: number; height: number; speed: number; interactionDistance: number };
  bounds: TownBounds;
  surfaces: { id: string; bounds: TownBounds; height: number }[];
  colliders: { id: string; bounds: TownBounds; z: [number, number] }[];
  destinations: TownDestination[];
  residents: { id: string; position: TownPoint }[];
  worldBound: false;
  caseIntegrated: false;
}

function distanceToBounds(x: number, y: number, b: TownBounds) {
  return Math.hypot(Math.max(b[0] - x, 0, x - b[2]), Math.max(b[1] - y, 0, y - b[3]));
}

/** Spatial index and swept movement use the geometry measured from the saved Blender scene. */
export function createTownNavigator(data: TownNavigationData) {
  const radius = data.player.radius;
  const grid = new Map<string, TownBounds[]>();
  for (const { bounds: b } of data.colliders) {
    for (let x = Math.floor(b[0] - radius - .02); x <= Math.floor(b[2] + radius + .02); x++) {
      for (let y = Math.floor(b[1] - radius - .02); y <= Math.floor(b[3] + radius + .02); y++) {
        const key = `${x},${y}`;
        const entries = grid.get(key) ?? [];
        entries.push(b);
        grid.set(key, entries);
      }
    }
  }
  const onSurface = (x: number, y: number) => data.surfaces.some(({ bounds: b }) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]);
  const valid = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    // Test the capsule footprint against the union, allowing transitions onto the bridge.
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      if (!onSurface(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)) return false;
    }
    return (grid.get(`${Math.floor(x)},${Math.floor(y)}`) ?? []).every(b => distanceToBounds(x, y, b) > radius + .01);
  };
  const move = (start: TownPoint, dx: number, dy: number): TownPoint => {
    if (![...start, dx, dy].every(Number.isFinite) || !valid(...start)) return [...start];
    const count = Math.max(1, Math.ceil(Math.hypot(dx, dy) / .075));
    if (count > 200) return [...start]; // Reject a corrupt or suspended-tab timestep.
    let [x, y] = start;
    for (let i = 0; i < count; i++) {
      const nx = x + dx / count, ny = y + dy / count;
      if (valid(nx, ny)) { x = nx; y = ny; }
      else if (valid(nx, y)) x = nx;
      else if (valid(x, ny)) y = ny;
    }
    return [x, y];
  };
  const nearest = (point: TownPoint): TownDestination | null => {
    let result: TownDestination | null = null, best = data.player.interactionDistance;
    for (const d of data.destinations) {
      const distance = Math.hypot(point[0] - d.entrance[0], point[1] - d.entrance[1]);
      if (distance <= best) { best = distance; result = d; }
    }
    return result;
  };
  const height = (point: TownPoint) => Math.max(.04, ...data.surfaces
    .filter(s => point[0] >= s.bounds[0] && point[0] <= s.bounds[2] && point[1] >= s.bounds[1] && point[1] <= s.bounds[3])
    .map(s => s.height));
  return { valid, move, nearest, height };
}
