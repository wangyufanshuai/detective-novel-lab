/**
 * Riverbend's weather over the three-day notebook. Authored rather than random,
 * so every player sees the same days and a reload never changes the sky:
 *
 *   day 1  clear, a little cloud toward evening
 *   day 2  river fog at dawn that burns off by mid-morning; rain sets in at dusk
 *   day 3  grey, a midday shower, clearing for the last evening
 *
 * The client draws it (light, fog, rain, sound). Cases may read it through an
 * evidence's `weather` condition: a mark that rain washes away, or a sighting
 * that needs the fog to lift. Pure numbers, no rendering dependencies.
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

const smoothstep = (x: number, a: number, b: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function weatherAt(day: number | undefined, hours: number, out: Weather = { rain: 0, fog: 0, cloud: 0 }): Weather {
  const keys = DAYS[Math.min(Math.max((day ?? 1) - 1, 0), DAYS.length - 1)];
  const h = ((hours % 24) + 24) % 24;
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1].at <= h) i++;
  const a = keys[i], b = keys[i + 1], t = smoothstep(h, a.at, b.at);
  out.rain = lerp(a.rain, b.rain, t);
  out.fog = lerp(a.fog, b.fog, t);
  out.cloud = lerp(a.cloud, b.cloud, t);
  return out;
}

/** One word for the clock card and the notebook. */
export function weatherWord(w: Weather, hours: number) {
  if (w.rain > .5) return "雨";
  if (w.rain > .1) return "小雨";
  if (w.fog > THICK_FOG) return "雾";
  if (w.cloud > .7) return "阴";
  if (w.cloud > .4) return "多云";
  return hours >= 6 && hours < 19 ? "晴" : "晴夜";
}

/** Rain this heavy wets the streets; fog this thick hides the far bank. */
export const WET = .3;
export const THICK_FOG = .45;

/** What an evidence's `weather` condition means for finding it. */
export type EvidenceWeather =
  /** A mark outdoors-ish (chalk, mud, a wet footprint) that the first real rain after the case opens washes away. */
  | "washes-away"
  /** Something seen across distance (a window over the river, a far signal) that cannot be checked in thick fog. */
  | "needs-clear-air";

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const clockText = (day: number, minutes: number) => `第 ${day} 天 ${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** First minute from (day, minutes) on through `lastDay` when the rain reaches WET, sampled every five minutes. */
export function firstWetFrom(day: number, minutes: number, lastDay: number): { day: number; minutes: number } | null {
  for (let d = day; d <= lastDay; d++) for (let m = d === day ? minutes : 0; m < 1440; m += 5) if (weatherAt(d, m / 60).rain >= WET) return { day: d, minutes: m };
  return null;
}

/**
 * Why this evidence cannot be searched right now, or null when it can.
 * `opensOn` is the case's day: a mark is only lost to rain that falls after the case opens (08:00 that day).
 */
export function evidenceWeatherBlock(condition: EvidenceWeather | undefined, opensOn: number, clock: { day: number; currentTime: string }, lastDay: number): string | null {
  if (!condition) return null;
  const now = minutesOf(clock.currentTime);
  if (condition === "needs-clear-air") return weatherAt(clock.day, now / 60).fog > THICK_FOG ? "雾太浓，看不清远处。等雾散了再来核对。" : null;
  const wet = firstWetFrom(opensOn, 8 * 60, lastDay);
  if (!wet) return null;
  const passed = clock.day > wet.day || (clock.day === wet.day && now >= wet.minutes);
  return passed ? "雨水已经把这里冲刷过了，原来的痕迹看不出来了。" : null;
}

/** For authors: when a "washes-away" mark of a case on `day` is lost, in words. */
export function washesAwayAt(day: number, lastDay: number) {
  const wet = firstWetFrom(day, 8 * 60, lastDay);
  return wet ? clockText(wet.day, wet.minutes) : null;
}

/** For authors: the hours of a day the fog is too thick, as "HH:MM—HH:MM" ranges. */
export function thickFogHours(day: number) {
  const spans: string[] = [];
  let start: number | null = null;
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  for (let m = 0; m <= 1440; m += 5) {
    const thick = m < 1440 && weatherAt(day, m / 60).fog > THICK_FOG;
    if (thick && start === null) start = m;
    if (!thick && start !== null) { spans.push(`${hhmm(start)}—${hhmm(m)}`); start = null; }
  }
  return spans;
}
