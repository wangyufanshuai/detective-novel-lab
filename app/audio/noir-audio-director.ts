import { listCampaignAudioManifests, NOIR_GLOBAL_AUDIO_CUES, type CampaignAudioManifest } from "@/lib/engine";
import {
  audioCueIsEssential,
  DEFAULT_NOIR_AUDIO_SETTINGS,
  readNoirAudioSettings,
  normalizeNoirAudioSettings,
  writeNoirAudioSettings,
  type NoirAudioBus,
  type NoirAudioSettings
} from "./noir-audio-model";

type AudioContextLike = AudioContext & { createGain: AudioContext["createGain"] };

export class NoirAudioDirector {
  private context: AudioContextLike | null = null;
  private masterGain: GainNode | null = null;
  private busGains = new Map<NoirAudioBus, GainNode>();
  private activeCue: HTMLAudioElement | null = null;
  private activeTheme: HTMLAudioElement | null = null;
  private activeAmbience: HTMLAudioElement | null = null;
  private settings: NoirAudioSettings = DEFAULT_NOIR_AUDIO_SETTINGS;
  private unlocked = false;
  private hidden = false;
  private campaign: CampaignAudioManifest | null = null;

  constructor(private readonly browserWindow: Window) {
    this.settings = readNoirAudioSettings(browserWindow.localStorage);
    browserWindow.document.addEventListener("visibilitychange", this.handleVisibility);
  }

  dispose() {
    this.stopCue();
    this.stopTracks();
    this.context?.close().catch(() => undefined);
    this.browserWindow.document.removeEventListener("visibilitychange", this.handleVisibility);
    this.context = null;
    this.masterGain = null;
    this.busGains.clear();
  }

  getSettings() { return this.settings; }

  setSettings(next: NoirAudioSettings) {
    this.settings = normalizeNoirAudioSettings(next);
    writeNoirAudioSettings(this.browserWindow.localStorage, this.settings);
    this.applyGainSettings();
    if (this.settings.muted || this.settings.lowSensory) this.stopTracks();
    else if (this.unlocked) this.startTracks();
    return this.settings;
  }

  setCampaign(presentationKey?: string) {
    this.campaign = presentationKey ? listCampaignAudioManifests().find((manifest) => manifest.presentationKey === presentationKey) || null : null;
    if (this.unlocked) {
      this.stopTracks();
      this.startTracks();
    }
  }

  async unlock() {
    if (!this.context) {
      const AudioContextCtor = (this.browserWindow as Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
        || (this.browserWindow as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return false;
      this.context = new AudioContextCtor() as AudioContextLike;
      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);
      for (const bus of ["music", "ambience", "sfx"] as const) {
        const gain = this.context.createGain();
        gain.connect(this.masterGain);
        this.busGains.set(bus, gain);
      }
    }
    if (this.context.state === "suspended") await this.context.resume().catch(() => undefined);
    this.unlocked = this.context.state === "running";
    this.applyGainSettings();
    this.startTracks();
    return this.unlocked;
  }

  playCue(cue: string) {
    if (!this.unlocked || !this.context || this.settings.muted || this.hidden) return false;
    if (this.settings.lowSensory && !audioCueIsEssential(cue)) return false;
    const track = NOIR_GLOBAL_AUDIO_CUES.find((item) => item.label === cue);
    if (!track || track.status !== "ready" || this.activeCue) return false;
    const audio = this.createTrack(track.opusPath, track.mp3Path, "sfx", false);
    audio.onended = () => { if (this.activeCue === audio) this.activeCue = null; };
    this.activeCue = audio;
    return true;
  }

  private startTracks() {
    if (!this.unlocked || this.settings.muted || this.settings.lowSensory || this.hidden || !this.campaign) return;
    const manifest = this.campaign;
    if (manifest.theme.status === "ready" && !this.activeTheme) this.activeTheme = this.createTrack(manifest.theme.opusPath, manifest.theme.mp3Path, "music");
    if (manifest.ambience.status === "ready" && !this.activeAmbience) this.activeAmbience = this.createTrack(manifest.ambience.opusPath, manifest.ambience.mp3Path, "ambience");
  }

  private createTrack(opusPath: string, mp3Path: string, bus: "music" | "ambience" | "sfx", loop = true) {
    const AudioCtor = (this.browserWindow as Window & { Audio: typeof Audio }).Audio;
    const audio = new AudioCtor();
    audio.loop = loop;
    audio.preload = "metadata";
    audio.src = opusPath;
    audio.onerror = () => { if (audio.src.endsWith(".opus")) { audio.src = mp3Path; void audio.play().catch(() => undefined); } };
    const source = this.context?.createMediaElementSource(audio);
    source?.connect(this.busGains.get(bus)!);
    void audio.play().catch(() => undefined);
    return audio;
  }

  private stopTracks() {
    for (const track of [this.activeTheme, this.activeAmbience]) {
      track?.pause();
      if (track) track.currentTime = 0;
    }
    this.activeTheme = null;
    this.activeAmbience = null;
  }

  private stopCue() {
    this.activeCue?.pause();
    if (this.activeCue) this.activeCue.currentTime = 0;
    this.activeCue = null;
  }

  private applyGainSettings() {
    if (this.masterGain) this.masterGain.gain.value = this.settings.muted ? 0 : this.settings.master;
    for (const bus of ["music", "ambience", "sfx"] as const) this.busGains.get(bus)?.gain && (this.busGains.get(bus)!.gain.value = this.settings[bus]);
  }

  private handleVisibility = () => {
    this.hidden = this.browserWindow.document.visibilityState === "hidden";
    if (this.hidden) { this.stopCue(); this.stopTracks(); } else this.startTracks();
  };
}
