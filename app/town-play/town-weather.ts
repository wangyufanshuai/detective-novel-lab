import * as THREE from "three";
import type { TownGrade } from "./town-lighting";

/**
 * Riverbend's weather over the three-day notebook. Authored rather than random,
 * so every player sees the same days and a reload never changes the sky:
 *
 *   day 1  clear, a little cloud toward evening
 *   day 2  river fog at dawn that burns off by mid-morning; rain sets in at dusk
 *   day 3  grey, a midday shower, clearing for the last evening
 *
 * Purely visual and audible: residents and cases do not read it.
 */
export type Weather = { rain: number; fog: number; cloud: number };
type Key = Weather & { at: number };

const clear = (at: number, cloud = .08): Key => ({ at, rain: 0, fog: 0, cloud });
const DAYS: Key[][] = [
  [clear(0, .1), clear(14, .12), clear(18, .3), clear(24, .2)],
  [
    { at: 0, rain: 0, fog: .55, cloud: .3 }, { at: 5.5, rain: 0, fog: .95, cloud: .4 }, { at: 8.5, rain: 0, fog: .7, cloud: .4 },
    { at: 10.5, rain: 0, fog: .08, cloud: .25 }, { at: 15, rain: 0, fog: 0, cloud: .5 }, { at: 17.5, rain: .15, fog: .1, cloud: .85 },
    { at: 18.5, rain: .85, fog: .2, cloud: 1 }, { at: 22, rain: .7, fog: .25, cloud: 1 }, { at: 24, rain: .35, fog: .3, cloud: .9 }
  ],
  [
    { at: 0, rain: .25, fog: .3, cloud: .85 }, { at: 4, rain: 0, fog: .25, cloud: .7 }, { at: 9, rain: 0, fog: .05, cloud: .6 },
    { at: 12, rain: 0, fog: 0, cloud: .8 }, { at: 13, rain: .75, fog: .1, cloud: 1 }, { at: 15, rain: .6, fog: .1, cloud: 1 },
    { at: 16.3, rain: 0, fog: .05, cloud: .55 }, { at: 19, rain: 0, fog: 0, cloud: .25 }, clear(24, .15)
  ]
];

export function weatherAt(day: number | undefined, hours: number, out: Weather = { rain: 0, fog: 0, cloud: 0 }): Weather {
  const keys = DAYS[Math.min(Math.max((day ?? 1) - 1, 0), DAYS.length - 1)];
  const h = ((hours % 24) + 24) % 24;
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1].at <= h) i++;
  const a = keys[i], b = keys[i + 1], t = THREE.MathUtils.smoothstep(h, a.at, b.at);
  out.rain = THREE.MathUtils.lerp(a.rain, b.rain, t);
  out.fog = THREE.MathUtils.lerp(a.fog, b.fog, t);
  out.cloud = THREE.MathUtils.lerp(a.cloud, b.cloud, t);
  return out;
}

export function easeWeather(current: Weather, target: Weather, k: number) {
  current.rain += (target.rain - current.rain) * k;
  current.fog += (target.fog - current.fog) * k;
  current.cloud += (target.cloud - current.cloud) * k;
}

/** One word for the clock card. */
export function weatherWord(w: Weather, hours: number) {
  if (w.rain > .5) return "雨";
  if (w.rain > .1) return "小雨";
  if (w.fog > .45) return "雾";
  if (w.cloud > .7) return "阴";
  if (w.cloud > .4) return "多云";
  return hours >= 6 && hours < 19 ? "晴" : "晴夜";
}

const overcast = new THREE.Color("#8d979e"), mist = new THREE.Color("#b9c1c4"), nightMist = new THREE.Color("#3c4558");

/** Weather over a light grade: cloud flattens and greys the light, fog and rain thicken the air. */
export function weatherGrade(grade: TownGrade, w: Weather) {
  const dull = w.cloud * .55 + w.rain * .2;
  grade.sky.lerp(overcast, dull * (1 - grade.glow * .7));
  grade.sun.lerp(overcast, dull * .6);
  grade.sunI *= 1 - Math.min(.82, w.cloud * .6 + w.rain * .3 + w.fog * .3);
  grade.hemi *= 1 - w.cloud * .08 + w.fog * .06;
  grade.exposure *= 1 - w.cloud * .04 - w.rain * .03;
  const air = Math.max(w.fog, w.rain * .55);
  grade.fog.lerp(grade.glow > .5 ? nightMist : mist, air * .75);
  // Rain and fog by day bring the shop windows on early.
  grade.glow = Math.max(grade.glow, (w.rain * .45 + w.fog * .25) * (1 - grade.glow));
  return grade;
}

/** Fog distances for the town camera: clear air reaches the far hills, fog closes to a few streets. */
export function fogRange(w: Weather): [number, number] {
  const air = Math.max(w.fog, w.rain * .5);
  return [105 - air * 82, 175 - air * 105];
}
