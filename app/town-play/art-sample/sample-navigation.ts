export type Point = [number, number];
export type SampleMode = "explore" | "detail" | "overview";
export interface SampleInteraction { id: string; label: string; position: Point; description: string; roomId?: string | null; actorId?: string; workLabel?: string }
export interface SampleRoom { id: string; label: string; bounds: [number, number, number, number]; door: Point; cutawayLayers: string[] }
export interface SampleContract {
  floor: number;
  bounds: [number, number, number, number];
  player: { spawn: Point; radius: number; height: number; speed: number };
  colliders: { id: string; center: Point; size: Point; angle: number }[];
  interior: { bounds: [number, number, number, number]; door: Point; cutawayLayers: string[] };
  interiors?: SampleRoom[];
  camera?: { overview: { sourceCoordinates: true; target: [number, number, number]; offset: [number, number, number]; verticalSize: number; horizontalSize: number } };
  interactions: SampleInteraction[];
  sourceSha256: string;
  assetSha256: string;
}

/** Read-only sample geometry. No world session, case knowledge or persistence. */
export function createSampleNavigator(data: SampleContract) {
  const r = data.player.radius;
  const rooms: SampleRoom[] = data.interiors ?? [{ ...data.interior, id: "inn", label: "铁路旅馆会客室" }];
  const inside = (p: Point, b: SampleContract["bounds"], margin = 0) =>
    p[0] >= b[0] + margin && p[0] <= b[1] - margin && p[1] >= b[2] + margin && p[1] <= b[3] - margin;
  function valid(p: Point) {
    if (!p.every(Number.isFinite) || !inside(p, data.bounds, r)) return false;
    return data.colliders.every(c => {
      const dx = p[0] - c.center[0], dy = p[1] - c.center[1];
      const x = Math.cos(c.angle) * dx + Math.sin(c.angle) * dy;
      const y = -Math.sin(c.angle) * dx + Math.cos(c.angle) * dy;
      return Math.hypot(Math.max(Math.abs(x) - c.size[0] / 2, 0), Math.max(Math.abs(y) - c.size[1] / 2, 0)) > r + .012;
    });
  }
  function move(start: Point, dx: number, dy: number): Point {
    if (![...start, dx, dy].every(Number.isFinite) || !valid(start)) return [...start];
    const steps = Math.ceil(Math.hypot(dx, dy) / .06) || 1;
    if (steps > 160) return [...start];
    let p: Point = [...start];
    for (let i = 0; i < steps; i++) {
      const nx = p[0] + dx / steps, ny = p[1] + dy / steps;
      if (valid([nx, ny])) p = [nx, ny];
      else if (valid([nx, p[1]])) p = [nx, p[1]];
      else if (valid([p[0], ny])) p = [p[0], ny];
    }
    return p;
  }
  const roomAt = (p: Point) => rooms.find(room => inside(p, room.bounds)) ?? null;
  function nearest(p: Point, available: (item: SampleInteraction) => boolean = () => true) {
    const room = roomAt(p);
    return data.interactions.filter(item => available(item) && (!data.interiors || (item.roomId ?? null) === (room?.id ?? null)))
      .map(item => ({ item, distance: Math.hypot(item.position[0] - p[0], item.position[1] - p[1]) }))
      .filter(i => i.distance < 1.25).sort((a, b) => a.distance - b.distance)[0]?.item ?? null;
  }
  return { valid, move, nearest, rooms, roomAt, indoors: (p: Point) => roomAt(p) !== null };
}
