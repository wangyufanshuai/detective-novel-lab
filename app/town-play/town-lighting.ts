import * as THREE from "three";

/** One lighting key for a time of day. Colours are sRGB hex; intensities are three.js units. */
type Key = { at: number; sky: string; ground: string; hemi: number; sun: string; sunI: number; elevation: number; fog: string; exposure: number; glow: number };

// Hours on a 24h clock. The town keeps a soft, readable look at night: the
// world stays visible, windows and the lantern carry the warmth.
const KEYS: Key[] = [
  { at: 0, sky: "#5d6b8a", ground: "#2f3346", hemi: 1.05, sun: "#9fb3e0", sunI: .55, elevation: .9, fog: "#2e3650", exposure: .95, glow: 1 },
  { at: 5, sky: "#6c7896", ground: "#3a3a48", hemi: 1.1, sun: "#b4bde0", sunI: .7, elevation: .5, fog: "#465170", exposure: .97, glow: .9 },
  { at: 6.5, sky: "#e7c9b6", ground: "#8f7a66", hemi: 1.35, sun: "#ffc48f", sunI: 2.1, elevation: .32, fog: "#c9b3a8", exposure: 1.02, glow: .35 },
  { at: 9, sky: "#e2edf4", ground: "#b4a17e", hemi: 1.6, sun: "#fff0cd", sunI: 2.9, elevation: .8, fog: "#abbac0", exposure: 1.05, glow: 0 },
  { at: 15, sky: "#e4edf2", ground: "#b8a27c", hemi: 1.65, sun: "#fff0cd", sunI: 3.0, elevation: 1, fog: "#abbac0", exposure: 1.05, glow: 0 },
  { at: 17.5, sky: "#f0d6b4", ground: "#a88a64", hemi: 1.45, sun: "#ffbe7a", sunI: 2.5, elevation: .45, fog: "#d1b498", exposure: 1.04, glow: .2 },
  { at: 19, sky: "#b48c9a", ground: "#5a4650", hemi: 1.2, sun: "#ff9a6a", sunI: 1.3, elevation: .22, fog: "#7d6378", exposure: 1, glow: .75 },
  { at: 20.5, sky: "#6a7394", ground: "#353448", hemi: 1.08, sun: "#a9b4e0", sunI: .6, elevation: .7, fog: "#384263", exposure: .96, glow: 1 },
  { at: 24, sky: "#5d6b8a", ground: "#2f3346", hemi: 1.05, sun: "#9fb3e0", sunI: .55, elevation: .9, fog: "#2e3650", exposure: .95, glow: 1 }
];

export type TownGrade = { sky: THREE.Color; ground: THREE.Color; hemi: number; sun: THREE.Color; sunI: number; elevation: number; fog: THREE.Color; exposure: number; glow: number };

/** "HH:MM" → fractional hour. Unknown input is noon so the scene never goes dark by mistake. */
export function clockHours(time: string | undefined | null) {
  const match = /^(\d{1,2}):(\d{2})/.exec(time ?? "");
  if (!match) return 12;
  const hours = Number(match[1]) + Number(match[2]) / 60;
  return hours >= 0 && hours < 24 ? hours : 12;
}

export function gradeAt(hours: number, out?: TownGrade): TownGrade {
  const h = ((hours % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].at <= h) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = THREE.MathUtils.smoothstep(h, a.at, b.at);
  const g = out ?? { sky: new THREE.Color(), ground: new THREE.Color(), hemi: 0, sun: new THREE.Color(), sunI: 0, elevation: 0, fog: new THREE.Color(), exposure: 1, glow: 0 };
  g.sky.set(a.sky).lerp(scratch.set(b.sky), t);
  g.ground.set(a.ground).lerp(scratch.set(b.ground), t);
  g.sun.set(a.sun).lerp(scratch.set(b.sun), t);
  g.fog.set(a.fog).lerp(scratch.set(b.fog), t);
  g.hemi = THREE.MathUtils.lerp(a.hemi, b.hemi, t);
  g.sunI = THREE.MathUtils.lerp(a.sunI, b.sunI, t);
  g.elevation = THREE.MathUtils.lerp(a.elevation, b.elevation, t);
  g.exposure = THREE.MathUtils.lerp(a.exposure, b.exposure, t);
  g.glow = THREE.MathUtils.lerp(a.glow, b.glow, t);
  return g;
}
const scratch = new THREE.Color();

/** Ease the current grade toward a target; `k` is the per-frame blend (1 = snap). */
export function easeGrade(current: TownGrade, target: TownGrade, k: number) {
  current.sky.lerp(target.sky, k); current.ground.lerp(target.ground, k);
  current.sun.lerp(target.sun, k); current.fog.lerp(target.fog, k);
  current.hemi += (target.hemi - current.hemi) * k;
  current.sunI += (target.sunI - current.sunI) * k;
  current.elevation += (target.elevation - current.elevation) * k;
  current.exposure += (target.exposure - current.exposure) * k;
  current.glow += (target.glow - current.glow) * k;
}
