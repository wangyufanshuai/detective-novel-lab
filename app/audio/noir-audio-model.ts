export const NOIR_AUDIO_STORAGE_KEY = "detective-town-audio-v1";
export const NOIR_AUDIO_FORMAT_VERSION = 1 as const;

export type NoirAudioSettings = Readonly<{
  formatVersion: typeof NOIR_AUDIO_FORMAT_VERSION;
  muted: boolean;
  master: number;
  music: number;
  ambience: number;
  sfx: number;
  lowSensory: boolean;
}>;

export const DEFAULT_NOIR_AUDIO_SETTINGS: NoirAudioSettings = Object.freeze({
  formatVersion: NOIR_AUDIO_FORMAT_VERSION,
  muted: false,
  master: 0.55,
  music: 0.35,
  ambience: 0.25,
  sfx: 0.65,
  lowSensory: false
});

const BUS_KEYS = ["master", "music", "ambience", "sfx"] as const;
export type NoirAudioBus = (typeof BUS_KEYS)[number];

function clamp(value: unknown, fallback: number) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(1, numeric));
}

export function normalizeNoirAudioSettings(value: unknown): NoirAudioSettings {
  if (!value || typeof value !== "object") return DEFAULT_NOIR_AUDIO_SETTINGS;
  const source = value as Partial<Record<keyof NoirAudioSettings, unknown>>;
  if (source.formatVersion !== NOIR_AUDIO_FORMAT_VERSION) return DEFAULT_NOIR_AUDIO_SETTINGS;
  return Object.freeze({
    formatVersion: NOIR_AUDIO_FORMAT_VERSION,
    muted: source.muted === true,
    master: clamp(source.master, DEFAULT_NOIR_AUDIO_SETTINGS.master),
    music: clamp(source.music, DEFAULT_NOIR_AUDIO_SETTINGS.music),
    ambience: clamp(source.ambience, DEFAULT_NOIR_AUDIO_SETTINGS.ambience),
    sfx: clamp(source.sfx, DEFAULT_NOIR_AUDIO_SETTINGS.sfx),
    lowSensory: source.lowSensory === true
  });
}

export function updateNoirAudioBus(settings: NoirAudioSettings, bus: NoirAudioBus, value: number): NoirAudioSettings {
  if (!BUS_KEYS.includes(bus)) return settings;
  return normalizeNoirAudioSettings({ ...settings, [bus]: value });
}

export function serializeNoirAudioSettings(settings: NoirAudioSettings) {
  const normalized = normalizeNoirAudioSettings(settings);
  return JSON.stringify(normalized);
}

export function readNoirAudioSettings(storage: Pick<Storage, "getItem"> | undefined): NoirAudioSettings {
  if (!storage) return DEFAULT_NOIR_AUDIO_SETTINGS;
  try {
    const raw = storage.getItem(NOIR_AUDIO_STORAGE_KEY);
    return raw ? normalizeNoirAudioSettings(JSON.parse(raw)) : DEFAULT_NOIR_AUDIO_SETTINGS;
  } catch {
    return DEFAULT_NOIR_AUDIO_SETTINGS;
  }
}

export function writeNoirAudioSettings(storage: Pick<Storage, "setItem"> | undefined, settings: NoirAudioSettings) {
  if (!storage) return false;
  try {
    storage.setItem(NOIR_AUDIO_STORAGE_KEY, serializeNoirAudioSettings(settings));
    return true;
  } catch {
    return false;
  }
}

export function audioCueIsEssential(cue: string) {
  return cue === "confirm" || cue === "warning" || cue === "complete" || cue === "resolve";
}
