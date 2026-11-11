import { clockHours } from "./town-lighting";
import styles from "./town-play.module.css";

const PERIODS: Array<[number, string]> = [[5, "凌晨"], [8, "清晨"], [11, "上午"], [13, "正午"], [17, "午后"], [19.5, "黄昏"], [24, "夜晚"]];

export function dayPeriod(hours: number) {
  return PERIODS.find(([end]) => hours < end)?.[1] ?? "夜晚";
}

/** Sun by day, moon by night, riding one arc; matches the scene's light grade. */
export function TownDayDial({ time }: { time: string | null | undefined }) {
  const hours = clockHours(time);
  const day = hours >= 6 && hours < 18;
  // 0 at the left horizon, 1 at the right; night wraps 18 → 6.
  const t = day ? (hours - 6) / 12 : ((hours - 18 + 24) % 24) / 12;
  const angle = Math.PI * (1 - t);
  const x = 30 + Math.cos(angle) * 22, y = 30 - Math.sin(angle) * 20;
  return <svg className={styles.dayDial} data-phase={day ? "day" : "night"} viewBox="0 0 60 36" aria-hidden="true">
    <path className={styles.dialArc} d="M8 30 A22 20 0 0 1 52 30" />
    <path className={styles.dialTrail} d={`M8 30 A22 20 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`} />
    <line className={styles.dialHorizon} x1="2" y1="30.5" x2="58" y2="30.5" />
    {day
      ? <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}><circle className={styles.dialSun} r="4.6" />{[0, 45, 90, 135, 180, 225, 270, 315].map(r => <line key={r} className={styles.dialRay} x1="6.4" x2="8.4" transform={`rotate(${r})`} />)}</g>
      : <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}><circle className={styles.dialMoon} r="4.4" /><circle className={styles.dialMoonCut} cx="2" cy="-1.6" r="3.8" /></g>}
  </svg>;
}
