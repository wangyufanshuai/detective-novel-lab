"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NoirAudioDirector } from "@/app/audio/noir-audio-director";
import { DEFAULT_NOIR_AUDIO_SETTINGS, normalizeNoirAudioSettings, updateNoirAudioBus, type NoirAudioBus, type NoirAudioSettings } from "@/app/audio/noir-audio-model";

export function useNoirAudioDirector(input: { runtimeMode: "server" | "static-demo"; presentationKey?: string }) {
  const directorRef = useRef<NoirAudioDirector | null>(null);
  const settingsRef = useRef<NoirAudioSettings>(DEFAULT_NOIR_AUDIO_SETTINGS);
  const [settings, setSettings] = useState<NoirAudioSettings>(DEFAULT_NOIR_AUDIO_SETTINGS);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (input.runtimeMode !== "server") {
      directorRef.current?.dispose();
      directorRef.current = null;
      setUnlocked(false);
      settingsRef.current = DEFAULT_NOIR_AUDIO_SETTINGS;
      setSettings(DEFAULT_NOIR_AUDIO_SETTINGS);
      return;
    }
    if (!directorRef.current) {
      const director = new NoirAudioDirector(window);
      directorRef.current = director;
      settingsRef.current = director.getSettings();
      setSettings(settingsRef.current);
    }
    directorRef.current?.setCampaign(input.presentationKey);
    return () => undefined;
  }, [input.presentationKey, input.runtimeMode]);

  useEffect(() => {
    if (input.runtimeMode !== "server") return;
    const onCue = (event: Event) => {
      const cue = (event as CustomEvent<{ cue?: string }>).detail?.cue;
      if (cue) directorRef.current?.playCue(cue);
    };
    window.addEventListener("detective-town:audio-cue", onCue);
    return () => window.removeEventListener("detective-town:audio-cue", onCue);
  }, [input.runtimeMode]);

  useEffect(() => () => directorRef.current?.dispose(), []);

  const unlock = useCallback(async () => {
    if (input.runtimeMode !== "server") return false;
    const didUnlock = await directorRef.current?.unlock();
    setUnlocked(Boolean(didUnlock));
    return Boolean(didUnlock);
  }, [input.runtimeMode]);
  const updateSettings = useCallback((next: NoirAudioSettings) => {
    if (input.runtimeMode !== "server") return DEFAULT_NOIR_AUDIO_SETTINGS;
    const normalized = normalizeNoirAudioSettings(next);
    const applied = directorRef.current?.setSettings(normalized) || normalized;
    settingsRef.current = applied;
    setSettings(applied);
    return applied;
  }, [input.runtimeMode]);
  const setBusVolume = useCallback((bus: NoirAudioBus, value: number) => updateSettings(updateNoirAudioBus(settingsRef.current, bus, value)), [updateSettings]);
  const toggleMuted = useCallback(() => updateSettings({ ...settingsRef.current, muted: !settingsRef.current.muted }), [updateSettings]);
  const toggleLowSensory = useCallback(() => updateSettings({ ...settingsRef.current, lowSensory: !settingsRef.current.lowSensory }), [updateSettings]);

  return { settings, unlocked, unlock, updateSettings, setBusVolume, toggleMuted, toggleLowSensory };
}
