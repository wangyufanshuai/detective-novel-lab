import { createSampleNavigator, type Point, type SampleContract } from "./sample-navigation";
import { classicWorldScene } from "@/lib/classic-living-contract";
import { residentSceneAnchor } from "./living-presentation";
import { classicMotionClearance } from "./motion-clearance";
import type { ObservedTownPassage, TownObservedMotion } from "@/packages/engine/src/town/observed-passages";

export type MotionActor = { actorId: string; roomId: string; position: Point; yaw: number };
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const lerp = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function clearLine(a: Point, b: Point, valid: (p: Point) => boolean) {
  const count = Math.ceil(distance(a, b) / .04);
  for (let i = 0; i <= count; i++) if (!valid(lerp(a, b, count ? i / count : 0))) return false;
  return true;
}

/** Deterministic geometry routing only. It cannot create a journey or decide a
 * destination. A server-observed threshold selects the visible local segment. */
export function planObservedPassage(data: SampleContract, actor: MotionActor, passage: ObservedTownPassage) {
  if (data.sourceSha256 !== classicMotionClearance.sourceSha256 || data.assetSha256 !== classicMotionClearance.assetSha256) throw new Error("居民行走净空与街区模型版本不一致");
  const homeWorkplace = passage.sceneId === classicWorldScene(actor.roomId);
  const staticData = { ...data, player: { ...data.player, radius: homeWorkplace ? .26 : .38 },
    colliders: [...data.colliders.filter(c => !c.id.startsWith("art_")), ...classicMotionClearance.colliders.map(c => ({ ...c, center: [...c.center] as Point, size: [...c.size] as Point }))] };
  const nav = createSampleNavigator(staticData);
  const workplace = passage.sceneId !== "town-square";
  const room = nav.rooms.find(r => classicWorldScene(r.id) === (workplace ? passage.sceneId : passage.portalSceneId));
  const sceneAnchor = residentSceneAnchor(actor, passage.sceneId);
  if (passage.actorId !== actor.actorId || !sceneAnchor || (workplace && !room)) throw new Error("移动记录与居民所在房间不一致");
  const anchor: Point = [...sceneAnchor];
  const portal: Point = room ? [room.door[0], room.door[1] - .45] : [data.bounds[1] - .65, -3.05];
  const insideScope = (p: Point) => {
    const current = nav.roomAt(p);
    return workplace ? current?.id === room?.id || (!current && Math.abs(p[0] - portal[0]) < .65 && p[1] >= portal[1] - .12) : !current;
  };
  const valid = (p: Point) => nav.valid(p) && insideScope(p);
  if (!valid(portal)) throw new Error("居民门口的通道被挡住了");
  // A resident stands closer to their own desk than the walking clearance.
  // Find a short step that monotonically increases desk clearance; all other
  // furniture stays solid. This exception never applies to the main route.
  let starts: Point[] = [[...anchor]];
  if (!valid(anchor)) {
    const own = staticData.colliders.find(c => c.id === "workplace_" + actor.actorId);
    if (!workplace || room?.id !== actor.roomId || !own) throw new Error("居民起点不可通行");
    const otherNav = createSampleNavigator({ ...staticData, colliders: staticData.colliders.filter(c => c !== own) });
    const clearance = (p: Point) => {
      const dx = p[0] - own.center[0], dy = p[1] - own.center[1];
      return Math.hypot(Math.max(Math.abs(Math.cos(own.angle) * dx + Math.sin(own.angle) * dy) - own.size[0] / 2, 0),
        Math.max(Math.abs(-Math.sin(own.angle) * dx + Math.cos(own.angle) * dy) - own.size[1] / 2, 0));
    };
    const candidates: Point[] = [];
    for (const radius of [.2, .3, .4, .5, .6]) for (let angle = 0; angle < 32; angle++) {
      const p: Point = [anchor[0] + Math.cos(angle * Math.PI / 16) * radius, anchor[1] + Math.sin(angle * Math.PI / 16) * radius];
      if (!valid(p) || !clearLine(anchor, p, q => otherNav.valid(q) && insideScope(q))) continue;
      let previous = clearance(anchor), increasing = true;
      for (let i = 1; i <= 20; i++) { const value = clearance(lerp(anchor, p, i / 20)); if (value < previous - 1e-6) increasing = false; previous = value; }
      if (increasing) candidates.push(p);
    }
    candidates.sort((a, b) => distance(a, anchor) + distance(a, portal) - distance(b, anchor) - distance(b, portal));
    if (!candidates.length) throw new Error("居民无法从工作台前退开");
    starts = candidates;
  }
  const step = .12, key = (x: number, y: number) => `${x},${y}`, point = (x: number, y: number): Point => [x * step, y * step];
  const open: [number, number][] = [], parents = new Map<string, string | null>(), origins = new Map<string, Point>();
  for (const start of starts) {
    const sx = Math.round(start[0] / step), sy = Math.round(start[1] / step);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const x = sx + dx, y = sy + dy, p = point(x, y), id = key(x, y);
      if (!parents.has(id) && clearLine(start, p, valid)) { open.push([x, y]); parents.set(id, null); origins.set(id, start); }
    }
  }
  let end: string | null = null;
  for (let head = 0; head < open.length && head < 100000; head++) {
    const [x, y] = open[head], p = point(x, y), id = key(x, y);
    if (distance(p, portal) < .25 && clearLine(p, portal, valid)) { end = id; break; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, next = key(nx, ny);
      if (!parents.has(next) && clearLine(p, point(nx, ny), valid)) { parents.set(next, id); origins.set(next, origins.get(id)!); open.push([nx, ny]); }
    }
  }
  if (!end) throw new Error("居民路线未能绕过房间里的家具");
  const routeStart = origins.get(end)!;
  const reverse: Point[] = [portal];
  for (let id: string | null = end; id !== null; id = parents.get(id) ?? null) { const [x, y] = id.split(",").map(Number); reverse.push(point(x, y)); }
  const raw = [routeStart, ...reverse.reverse()], simplified: Point[] = [routeStart];
  for (let i = 0; i < raw.length - 1;) {
    let next = raw.length - 1;
    while (next > i + 1 && !clearLine(raw[i], raw[next], valid)) next--;
    simplified.push(raw[next]); i = next;
  }
  const points = distance(anchor, routeStart) > 1e-6 ? [anchor, ...simplified] : simplified;
  return { points: passage.kind === "departure" ? points : points.reverse(), visitedNodes: open.length,
    lengthMeters: points.slice(1).reduce((sum, p, i) => sum + distance(p, points[i]), 0), startClearanceException: distance(anchor, routeStart) > 1e-6 };
}

export function advanceObservedWalker(position: Point, destination: Point, dt: number, obstacles: readonly Point[], speed = 1.05) {
  const remaining = distance(position, destination), amount = Math.min(remaining, Math.max(0, Math.min(dt, .045)) * speed);
  const next = remaining > 0 ? lerp(position, destination, amount / remaining) : [...position] as Point;
  // The player can step aside while world commands remain paused. Do not push
  // either body through the other; a shortened segment is checked as a sweep.
  if (obstacles.some(obstacle => !clearLine(position, next, p => distance(p, obstacle) >= .68)))
    return { position: [...position] as Point, distance: 0, blocked: true, reached: false };
  return { position: next, distance: amount, blocked: false, reached: remaining <= amount + 1e-7 };
}

export function createObservedMotionPlayback(data: SampleContract, actors: MotionActor[], batch: TownObservedMotion) {
  type Pose = { position: Point; yaw: number; visible: boolean; frameDistance: number };
  const poses = new Map<string, Pose>();
  let index = 0, target = 1, route: ReturnType<typeof planObservedPassage> | null = null;
  let travelled = 0, blocked = false, done = false;
  return {
    poses,
    update(dt: number, player: Point, others: { actorId: string; position: Point }[]) {
      for (const pose of poses.values()) pose.frameDistance = 0;
      if (done) return true;
      const passage = batch.passages[index], actor = actors.find(a => a.actorId === passage.actorId);
      if (!actor) throw new Error("移动记录中的居民造型未载入");
      if (!route) {
        const neighbours = others.filter(o => o.actorId !== actor.actorId && poses.get(o.actorId)?.visible !== false);
        route = planObservedPassage({ ...data, colliders: [...data.colliders, ...neighbours.map(o => ({ id: "motion_solid_" + o.actorId, center: poses.get(o.actorId)?.position ?? o.position, size: [.82, .82] as Point, angle: 0 }))] }, actor, passage);
        poses.set(actor.actorId, { position: [...route.points[0]], yaw: actor.yaw, visible: true, frameDistance: 0 });
        target = 1; travelled = 0;
      }
      const pose = poses.get(actor.actorId)!;
      if (target < route.points.length) {
        const moved = advanceObservedWalker(pose.position, route.points[target], dt, [player, ...others.filter(o => o.actorId !== actor.actorId && poses.get(o.actorId)?.visible !== false).map(o => poses.get(o.actorId)?.position ?? o.position)]);
        blocked = moved.blocked; pose.frameDistance = moved.distance;
        if (moved.distance) {
          const heading = Math.atan2(moved.position[0] - pose.position[0], -(moved.position[1] - pose.position[1]));
          const turn = Math.atan2(Math.sin(heading - pose.yaw), Math.cos(heading - pose.yaw));
          pose.yaw += turn * (1 - Math.exp(-Math.min(dt, .045) * 14));
          pose.position = moved.position; travelled += moved.distance;
        }
        if (moved.reached) target++;
        return false;
      }
      const turn = Math.atan2(Math.sin(actor.yaw - pose.yaw), Math.cos(actor.yaw - pose.yaw));
      if (passage.kind === "arrival" && Math.abs(turn) > .02) { pose.yaw += turn * (1 - Math.exp(-Math.min(dt, .045) * 14)); return false; }
      pose.yaw = actor.yaw; pose.visible = passage.kind === "arrival";
      index++; route = null; blocked = false; done = index === batch.passages.length;
      return done;
    },
    diagnostics() { return { id: batch.id, done, index, total: batch.passages.length, passage: batch.passages[index] ?? null,
      blocked, travelled, points: route?.points ?? [], lengthMeters: route?.lengthMeters ?? 0 }; }
  };
}
