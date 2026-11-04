import { EXPLORATION_PLACES } from "@/packages/engine/src/town/agent-observation";
export type Point = { x: number; y: number };
export const MAP_WIDTH = 1040, MAP_HEIGHT = 720;
export const places = EXPLORATION_PLACES;
export function placeById(id: string) { return places.find(place => place.id === id); }
export function door(id: string): Point { const p = placeById(id) ?? places[0]; return { x: p.x, y: p.y + 23 }; }
export function walkable(point: Point) {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 42 || point.x > 998 || point.y < 192 || point.y > 648) return false;
  // River crossing at the stone bridge; the bank elsewhere cannot be walked over.
  if (point.y > 403 && point.y < 452 && (point.x < 486 || point.x > 578)) return false;
  return places.every(p => !p.w || point.x < p.x - p.w / 2 - 8 || point.x > p.x + p.w / 2 + 8 || point.y < p.y - p.h - 8 || point.y > p.y + 6);
}
export function movePoint(start: Point, dx: number, dy: number) {
  const steps = Math.ceil(Math.hypot(dx, dy) / 5) || 1;
  if (steps > 200) return { ...start };
  let p = { ...start };
  for (let i = 0; i < steps; i++) {
    const x = p.x + dx / steps, y = p.y + dy / steps;
    if (walkable({ x, y })) p = { x, y };
    else if (walkable({ x, y: p.y })) p = { x, y: p.y };
    else if (walkable({ x: p.x, y })) p = { x: p.x, y };
  }
  return p;
}
export function nearbyPlace(point: Point) { return places.find(p => Math.hypot(p.x - point.x, p.y + 23 - point.y) < 46) ?? null; }
/** Screen navigation over collision grid; this never authorizes world travel. */
export function routeTo(start: Point, target: Point): Point[] {
  const step = 10, snap = (p: Point): Point => ({ x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step });
  const a = snap(start), b = snap(target), key = (p: Point) => `${p.x},${p.y}`;
  if (!walkable(b)) return [];
  const queue: Point[] = [a], previous = new Map<string, Point | null>([[key(a), null]]);
  for (let index = 0; index < queue.length && index < 9000; index++) {
    const p = queue[index];
    if (key(p) === key(b)) {
      const result: Point[] = [target]; let q: Point | null = p;
      while (q) { result.unshift(q); q = previous.get(key(q)) ?? null; }
      return result.slice(1);
    }
    for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const q = { x: p.x + dx, y: p.y + dy };
      if (!previous.has(key(q)) && walkable(q)) { previous.set(key(q), p); queue.push(q); }
    }
  }
  return [];
}
