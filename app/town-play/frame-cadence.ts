export type TownQuality = "high" | "balanced";

/** Use whole display callbacks so a 30/60 Hz wall-clock deadline does not beat
 * against a different browser refresh rate. Physics still uses elapsed time. */
export function createRefreshCadence() {
  let previous = Number.NaN, callback = 0, stride = 1, refreshMs = 1000 / 60;
  let mode: TownQuality = "high";
  const intervals: number[] = [];
  return {
    shouldRender(now: number, quality: TownQuality) {
      const interval = now - previous;
      previous = now;
      if (interval >= 2 && interval <= 50) {
        intervals.push(interval);
        if (intervals.length === 120) {
          const ordered = [...intervals].sort((a, b) => a - b);
          refreshMs = ordered[60]; intervals.length = 0;
        }
      }
      // The high tier follows a display divisor at approximately 60 Hz or
      // higher; 144 Hz, for example, renders at 72 Hz. Balanced is the nearest
      // divisor to 30 Hz. Neither mode invents extra rAF callbacks.
      const nextStride = quality === "high"
        ? Math.max(1, Math.floor((1000 / 60 + .5) / refreshMs))
        : Math.max(1, Math.round((1000 / 30) / refreshMs));
      if (mode !== quality || stride !== nextStride || interval > 250) callback = 0;
      mode = quality; stride = nextStride;
      const render = callback === 0;
      callback = (callback + 1) % stride;
      return render;
    },
    snapshot: () => ({ refreshMs, stride, mode, scheduledHz: 1000 / (refreshMs * stride) })
  };
}
