"use client";

import { useEffect, useState } from "react";
import { DEFAULT_NOIR_AUDIO_SETTINGS, type NoirAudioSettings } from "@/app/audio/noir-audio-model";
import { townSound } from "./town-sound";
import styles from "./town-play.module.css";

const sliders: Array<{ key: "master" | "ambience" | "sfx"; label: string }> = [
  { key: "master", label: "总音量" },
  { key: "ambience", label: "环境 · 街声、河水、虫鸣" },
  { key: "sfx", label: "音效 · 脚步、翻页、物证" }
];

/** Sound settings, stored with the app's other audio preferences. */
export function TownSoundSettings() {
  // Defaults on the server and first paint; the stored choice loads after hydration.
  const [settings, setSettings] = useState<NoirAudioSettings>(DEFAULT_NOIR_AUDIO_SETTINGS);
  useEffect(() => { setSettings(townSound().getSettings()); }, []);
  const change = (next: Partial<NoirAudioSettings>) => {
    const sound = townSound();
    sound.unlock();
    sound.update(next);
    setSettings(sound.getSettings());
  };
  return <fieldset className={`${styles.settings} ${styles.soundSettings}`}>
    <legend>声音</legend>
    <label><input type="checkbox" checked={!settings.muted} onChange={e => change({ muted: !e.target.checked })} /> 开启声音</label>
    {sliders.map(s => <label key={s.key} className={styles.soundSlider}>
      <span>{s.label}</span>
      <input type="range" min={0} max={1} step={0.05} value={settings[s.key]} disabled={settings.muted} aria-valuetext={`${Math.round(settings[s.key] * 100)}%`}
        onChange={e => change({ [s.key]: Number(e.target.value) })} onPointerUp={() => s.key !== "ambience" && townSound().play("tick")} />
    </label>)}
    <label><input type="checkbox" checked={settings.lowSensory} onChange={e => change({ lowSensory: e.target.checked })} /> 柔和模式 · 环境声更轻</label>
  </fieldset>;
}
