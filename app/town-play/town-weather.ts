import * as THREE from "three";
import type { TownGrade } from "./town-lighting";
import { weatherAt, weatherWord, type Weather } from "@/packages/engine/src/riverbend-weather";

/**
 * How the town draws its weather. The schedule itself (fog on day 2's dawn,
 * rain that evening, day 3's shower) lives in the engine, where cases can
 * read it too.
 */
export { weatherAt, weatherWord, type Weather };

export function easeWeather(current: Weather, target: Weather, k: number) {
  current.rain += (target.rain - current.rain) * k;
  current.fog += (target.fog - current.fog) * k;
  current.cloud += (target.cloud - current.cloud) * k;
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
