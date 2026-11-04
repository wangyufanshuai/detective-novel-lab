import type { Point } from "./sample-navigation";

type Sample = [seconds: number, clip: string, clipSeconds: number, x: number, y: number, yaw: number];
interface Route { actorId: string; kind: "departure" | "arrival"; seconds: number; samples: Sample[] }
export interface MotionPreviewData { schema: string; worldBound: boolean; sceneAssetSha256: string; routes: Route[] }
export interface PreviewPose { position: Point; yaw: number; clip: string; seconds: number; phase: string }
const angle = (from: number, to: number, q: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * q;

function sample(route: Route, seconds: number): PreviewPose {
  const rows = route.samples;
  let lo = 0, hi = rows.length - 1;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (rows[mid][0] <= seconds) lo = mid; else hi = mid - 1; }
  const a = rows[lo], b = rows[Math.min(lo + 1, rows.length - 1)];
  const q = b[0] > a[0] ? Math.min(1, Math.max(0, (seconds - a[0]) / (b[0] - a[0]))) : 0;
  let clipSeconds = a[2];
  if (a[1] === b[1]) {
    let delta = b[2] - a[2];
    if (a[1] === "Walk" && delta < -.4) delta += .8;
    clipSeconds += delta * q;
    if (a[1] === "Walk") clipSeconds %= .8;
  }
  return { position: [a[3] + (b[3] - a[3]) * q, a[4] + (b[4] - a[4]) * q], yaw: angle(a[5], b[5], q), clip: a[1], seconds: clipSeconds, phase: route.kind };
}

/** Rehearses source-checked routes. It does not issue agent decisions or events. */
export function createMotionPreviewPlayback(data: MotionPreviewData, sceneHash: string) {
  if (data.schema !== "classic-motion-preview.v1" || data.worldBound || data.sceneAssetSha256 !== sceneHash || data.routes.length !== 6) throw new Error("动线样板与场景版本不一致");
  for (const route of data.routes) {
    if (!route.samples.length || !Number.isFinite(route.seconds) || route.seconds <= 0) throw new Error("动线样板不完整");
    let previous = -1;
    for (const row of route.samples) {
      if (row.length !== 6 || ![row[0], row[2], row[3], row[4], row[5]].every(Number.isFinite) || row[0] < previous) throw new Error("动线样板数据无效");
      previous = row[0];
    }
  }
  let actorId: string | null = null, clock = 0, completed = 0, pose: PreviewPose | null = null;
  let departure: Route, arrival: Route, turn: Route;
  return {
    start(id: string) {
      const out = data.routes.find(r => r.actorId === id && r.kind === "departure"), back = data.routes.find(r => r.actorId === id && r.kind === "arrival");
      if (!out || !back) throw new Error("这位居民的动线尚未就绪");
      const rows = out.samples.filter(s => s[1] === "TurnLeft");
      if (rows.length < 2) throw new Error("转身动作尚未就绪");
      const first = rows[0];
      turn = { ...out, seconds: 1.6, samples: rows.map(r => [r[0] - first[0], r[1], r[2], 0, 0, r[5] - first[5]]) };
      // Source arrival traces start after their first 60 Hz walking step.
      // Restore the shared doorway at t=0 so high refresh rates interpolate
      // that step instead of jumping directly to its endpoint.
      const doorway = out.samples[out.samples.length - 1];
      const initial: Sample = [0, back.samples[0][1], 0, doorway[3], doorway[4], back.samples[0][5]];
      actorId = id; departure = out;
      arrival = back.samples[0][0] > 0 ? { ...back, samples: [initial, ...back.samples] } : back;
      clock = 0; pose = sample(out, 0);
    },
    update(dt: number) {
      if (!actorId) return null;
      if (!Number.isFinite(dt) || dt < 0 || dt > .1) throw new Error("动线时间无效");
      clock += dt;
      let t = clock;
      if (t < .3) pose = { ...sample(departure, 0), clip: "Idle", seconds: t, phase: "ready" };
      else if ((t -= .3) <= departure.seconds) pose = sample(departure, t);
      else if ((t -= departure.seconds) < .4) pose = { ...sample(departure, departure.seconds), clip: "Idle", seconds: t, phase: "at-door" };
      else if ((t -= .4) < 3.2) {
        const end = sample(departure, departure.seconds), part = Math.min(1, Math.floor(t / 1.6));
        const rotated = sample(turn, t - part * 1.6);
        pose = { ...rotated, position: end.position, yaw: end.yaw - part * Math.PI / 2 + rotated.yaw, phase: "return-turn" };
      } else if ((t -= 3.2) <= arrival.seconds) pose = sample(arrival, t);
      else {
        t -= arrival.seconds;
        pose = { ...sample(arrival, arrival.seconds), clip: "Idle", seconds: t, phase: "home" };
        if (t > .4) { actorId = null; completed++; }
      }
      return pose;
    },
    stop() { actorId = null; pose = null; clock = 0; },
    get actorId() { return actorId; },
    diagnostics() { return { actorId, seconds: clock, pose, completed, worldBound: false }; },
  };
}
