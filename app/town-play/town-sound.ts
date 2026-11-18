import type { RoomTone } from "./interior-rooms";
import { DEFAULT_NOIR_AUDIO_SETTINGS, readNoirAudioSettings, writeNoirAudioSettings, normalizeNoirAudioSettings, type NoirAudioSettings } from "@/app/audio/noir-audio-model";

/**
 * Riverbend's sound, synthesized with Web Audio: no audio files, nothing to
 * download, and every layer follows the same clock and position as the scene.
 *
 *   ambience bus: street murmur and birds by day, crickets and wind by night,
 *                 the river louder as you walk toward it, rain when it rains,
 *                 the tower clock on the hour; indoors the street drops to a
 *                 murmur and the room takes over (a ticking clock, a typewriter,
 *                 cups, the sorting stamp, the fire, a distant train)
 *   sfx bus:      footsteps on stone, page turns, pins, discoveries
 *
 * The context starts on the first user gesture (browser autoplay rules) and
 * suspends while the tab is hidden. Settings share the app's audio storage key.
 */
export type TownSfx = "page" | "close" | "pin" | "tick" | "discover" | "correct" | "solved" | "commission" | "refuse";

const RIVER_CENTRE = -15.75, RIVER_HALF_WIDTH = 3.9;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export class TownSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private sfx: GainNode | null = null;
  private layers: Record<"street" | "river" | "riverBabble" | "wind" | "rain" | "rainDrum" | "room", GainNode> | null = null;
  private noise: AudioBuffer | null = null;
  private brown: AudioBuffer | null = null;
  private timer = 0;
  private nextStep = 0;
  private stepSide = 1;
  private nextBird = 0;
  private nextCricket = 0;
  private nextBell = 0;
  private nextRoom = 0;
  private nextRoomTick = 0;
  private clockHour: number | null = null;
  private settings: NoirAudioSettings = DEFAULT_NOIR_AUDIO_SETTINGS;
  private state = { night: 0, river: 0, moving: false, ducked: false, overview: false, rain: 0, room: null as RoomTone | null };

  constructor() {
    if (typeof window === "undefined") return;
    this.settings = readNoirAudioSettings(window.localStorage);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  getSettings() { return this.settings; }

  update(next: Partial<NoirAudioSettings>) {
    this.settings = normalizeNoirAudioSettings({ ...this.settings, ...next });
    writeNoirAudioSettings(window.localStorage, this.settings);
    this.applyLevels();
  }

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (typeof window === "undefined") return;
    if (this.ctx) { if (this.ctx.state === "suspended" && !document.hidden) void this.ctx.resume(); return; }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18; compressor.ratio.value = 3;
    this.master = ctx.createGain(); this.ambience = ctx.createGain(); this.sfx = ctx.createGain();
    this.ambience.connect(this.master); this.sfx.connect(this.master); this.master.connect(compressor).connect(ctx.destination);
    this.noise = this.makeNoise(false); this.brown = this.makeNoise(true);
    this.layers = {
      street: this.loop(this.noise, [["bandpass", 650, .7], ["lowpass", 1600, .5]]),
      river: this.loop(this.brown, [["lowpass", 720, .6]]),
      riverBabble: this.loop(this.noise, [["bandpass", 2300, 1.4]]),
      wind: this.loop(this.brown, [["bandpass", 320, .9]]),
      rain: this.loop(this.noise, [["highpass", 1400, .5], ["lowpass", 7000, .4]]),
      rainDrum: this.loop(this.brown, [["lowpass", 520, .7]]),
      room: this.loop(this.brown, [["lowpass", 190, .6]])
    };
    this.applyLevels();
    this.timer = window.setInterval(() => this.tick(), 120);
  }

  setWorld(input: { hours?: number; position?: [number, number]; moving?: boolean; ducked?: boolean; overview?: boolean; rain?: number; room?: RoomTone | null }) {
    const h = input.hours;
    if (h !== undefined) this.strikeHour(h);
    if (input.rain !== undefined) this.state.rain = clamp01(input.rain);
    if (input.room !== undefined) { this.state.room = input.room; this.nextRoom = 0; }
    // Same shape as the light grade: night from 20:30 to 05:00, easing at dusk and dawn.
    if (h !== undefined) this.state.night = h >= 20.5 || h < 5 ? 1 : h >= 19 ? (h - 19) / 1.5 : h < 6.5 ? 1 - (h - 5) / 1.5 : 0;
    if (input.position) this.state.river = clamp01(1 - (Math.abs(input.position[1] - RIVER_CENTRE) - RIVER_HALF_WIDTH) / 14);
    if (input.moving !== undefined) this.state.moving = input.moving;
    if (input.ducked !== undefined) this.state.ducked = input.ducked;
    if (input.overview !== undefined) this.state.overview = input.overview;
  }

  play(cue: TownSfx) {
    const ctx = this.ctx;
    if (!ctx || !this.sfx || this.settings.muted || ctx.state !== "running") return;
    const t = ctx.currentTime + .01;
    switch (cue) {
      case "page": this.sweep(t, 1800, 5200, .16, .22); this.sweep(t + .09, 2600, 900, .12, .12); break;
      case "close": this.sweep(t, 3800, 1200, .1, .14); this.thump(t + .05, 140, .1); break;
      case "pin": this.tone(t, 2900, .06, .16, "triangle"); this.tone(t + .012, 4400, .04, .07, "sine"); this.thump(t, 220, .14); break;
      case "tick": this.tone(t, 1700, .035, .07, "triangle"); break;
      case "discover": this.tone(t, 784, .28, .14); this.tone(t + .09, 1175, .4, .12); this.tone(t + .09, 1568, .3, .04); break;
      case "correct": [523, 659, 784].forEach((f, i) => this.tone(t + i * .07, f, .55 - i * .1, .11)); break;
      case "solved": [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(t + i * .13, f, 1.1 - i * .12, .12)); this.tone(t + .65, 392, 1.4, .08); break;
      case "commission": this.bell(t, 1320); this.bell(t + .18, 990); break;
      case "refuse": this.tone(t, 330, .16, .1, "triangle"); this.tone(t + .1, 262, .2, .1, "triangle"); break;
    }
  }

  dispose() {
    if (typeof window === "undefined") return;
    window.clearInterval(this.timer);
    document.removeEventListener("visibilitychange", this.onVisibility);
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }

  private onVisibility = () => {
    if (!this.ctx) return;
    if (document.hidden) void this.ctx.suspend(); else void this.ctx.resume();
  };

  private applyLevels() {
    if (!this.ctx || !this.master || !this.ambience || !this.sfx) return;
    const s = this.settings, t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, .08);
    this.ambience.gain.setTargetAtTime(s.ambience * (s.lowSensory ? .45 : 1), t, .2);
    this.sfx.gain.setTargetAtTime(s.sfx, t, .05);
  }

  /** Runs ~8x a second: steers layer levels and schedules sparse events a little ahead. */
  private tick() {
    const ctx = this.ctx, layers = this.layers;
    if (!ctx || !layers || ctx.state !== "running") return;
    const t = ctx.currentTime, { night, river, ducked, overview, rain, room } = this.state, day = 1 - night;
    const duck = (ducked ? .45 : 1) * (overview ? .6 : 1);
    // Indoors the town is heard through the walls; the cafe has its own murmur of customers.
    const outside = room ? .2 : 1;
    const wobble = .85 + Math.sin(t * .37) * .1 + Math.sin(t * 1.13) * .05;
    const murmur = room === "cafe" ? .2 * (.6 + .4 * day) : 0;
    layers.street.gain.setTargetAtTime((.32 * day * (1 - rain * .5) * outside + murmur) * wobble * duck, t, .6);
    layers.river.gain.setTargetAtTime((.08 + .5 * river) * outside * duck, t, .5);
    layers.riverBabble.gain.setTargetAtTime((.015 + .07 * river) * (.7 + .3 * Math.sin(t * 2.7)) * outside * duck, t, .25);
    layers.wind.gain.setTargetAtTime((.05 + .16 * night + .1 * rain) * (.6 + .4 * Math.sin(t * .21)) * (room ? .3 : 1) * duck, t, .8);
    layers.rain.gain.setTargetAtTime(.3 * rain * (room ? .3 : 1) * (.9 + .1 * Math.sin(t * .5)) * duck, t, .8);
    layers.rainDrum.gain.setTargetAtTime(.22 * rain * (room ? .8 : .5) * duck, t, .8);
    layers.room.gain.setTargetAtTime((room === "inn" ? .16 : room ? .06 : 0) * duck, t, .4);
    if (!this.settings.muted && this.settings.ambience > 0) {
      const open = day * outside * (1 - rain * .8);
      if (open > .3 && t > this.nextBird) { this.bird(t + .05, open * duck); this.nextBird = t + 3 + Math.random() * 7; }
      if (day > .5 && t > this.nextBell) { if (this.nextBell) this.bell(t + .05, 2100, .05 * day * outside * duck); this.nextBell = t + 35 + Math.random() * 50; }
      if (night > .3 && rain < .3 && t > this.nextCricket) { this.crickets(t + .05, night * outside * duck); this.nextCricket = t + .7 + Math.random() * 1.4; }
      if (room) this.roomSounds(room, t, duck);
    }
    if (this.state.moving && !this.state.overview) {
      if (t >= this.nextStep) { this.step(Math.max(t, this.nextStep)); this.nextStep = Math.max(t, this.nextStep) + .33 + Math.random() * .03; }
    } else this.nextStep = 0;
  }

  /** The tower clock strikes the hour when play crosses it; long jumps (a night's sleep) stay silent. */
  private strikeHour(hours: number) {
    const hour = Math.floor(hours), before = this.clockHour;
    this.clockHour = hour;
    const ctx = this.ctx;
    if (before === null || hour === before || !ctx || ctx.state !== "running" || this.settings.muted) return;
    const ahead = (hour - before + 24) % 24;
    if (ahead < 1 || ahead > 2) return;
    const strikes = hour % 12 || 12, level = this.state.room ? .03 : .07, start = ctx.currentTime + .3;
    for (let i = 0; i < strikes; i++) this.bell(start + i * 1.7, 523, level, 2.4);
  }

  /** Sparse sounds that make each room itself. Scheduled a little ahead, on the ambience bus. */
  private roomSounds(room: RoomTone, t: number, duck: number) {
    const out = this.ambience!;
    // A wall clock in the quieter rooms, one tick a second.
    if ((room === "books" || room === "police" || room === "station") && t > this.nextRoomTick) {
      const at = Math.max(t + .02, this.nextRoomTick);
      this.tone(at, room === "station" ? 1250 : 1600, .03, (room === "police" ? .03 : .018) * duck, "triangle", out);
      this.nextRoomTick = at + (room === "station" ? 2 : 1);
    }
    if (t < this.nextRoom) return;
    const later = (min: number, spread: number) => { this.nextRoom = t + min + Math.random() * spread; };
    const at = t + .05;
    switch (room) {
      case "books": this.sweep(at, 1600, 4200, .2, .05 * duck, out); later(6, 9); break;
      case "police": {
        const keys = 5 + Math.floor(Math.random() * 6);
        for (let i = 0; i < keys; i++) this.burst(at + i * (.09 + Math.random() * .06), .025, .07 * duck, ["highpass", 2600, .7], out, .2);
        this.tone(at + keys * .12 + .1, 2200, .25, .025 * duck, "sine", out);
        later(7, 10); break;
      }
      case "cafe":
        if (Math.random() < .2) { this.burst(at, 1.6, .05 * duck, ["bandpass", 5200, .8], out, -.3); later(8, 8); }
        else { this.tone(at, 3100 + Math.random() * 500, .12, .03 * duck, "sine", out); this.tone(at + .01, 4700, .08, .015 * duck, "sine", out); later(2.5, 4); }
        break;
      case "post":
        if (Math.random() < .6) { this.thump(at, 120, .08 * duck, out); this.burst(at + .01, .03, .05 * duck, ["highpass", 3000, .7], out); }
        else this.sweep(at, 900, 2600, .35, .04 * duck, out);
        later(3, 6); break;
      case "inn":
        // The fire: a run of small crackles.
        for (let i = 0, k = 2 + Math.floor(Math.random() * 4); i < k; i++) this.burst(at + Math.random() * .4, .012, (.03 + Math.random() * .05) * duck, ["bandpass", 1800 + Math.random() * 2400, 1.2], out, -.4);
        later(.3, 1.2); break;
      case "station":
        if (Math.random() < .35) this.train(at, duck);
        else { this.bell(at, 880, .025 * duck); this.bell(at + .45, 659, .025 * duck); }
        later(25, 30); break;
    }
  }

  /** A train horn far off down the line. */
  private train(at: number, duck: number) {
    const ctx = this.ctx!, filter = ctx.createBiquadFilter();
    filter.type = "lowpass"; filter.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.03 * duck, at + .35);
    gain.gain.setValueAtTime(.03 * duck, at + 1.6); gain.gain.exponentialRampToValueAtTime(.0001, at + 2.8);
    filter.connect(gain).connect(this.ambience!);
    for (const f of [311, 370]) { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.connect(filter); o.start(at); o.stop(at + 2.9); }
  }

  // ---- building blocks -------------------------------------------------

  private makeNoise(brown: boolean) {
    const ctx = this.ctx!, length = ctx.sampleRate * 3, buffer = ctx.createBuffer(1, length, ctx.sampleRate), data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) { last = (last + .02 * white) / 1.02; data[i] = last * 3.5; } else data[i] = white;
    }
    return buffer;
  }

  private loop(buffer: AudioBuffer, filters: Array<[BiquadFilterType, number, number]>) {
    const ctx = this.ctx!, source = ctx.createBufferSource(), gain = ctx.createGain();
    source.buffer = buffer; source.loop = true;
    source.loopStart = Math.random() * 1.5; // decorrelate layers that share a buffer
    gain.gain.value = 0;
    let node: AudioNode = source;
    for (const [type, frequency, q] of filters) { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = frequency; f.Q.value = q; node.connect(f); node = f; }
    node.connect(gain).connect(this.ambience!);
    source.start();
    return gain;
  }

  private envelope(at: number, peak: number, attack: number, decay: number, out: AudioNode) {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(.0001, at + attack + decay);
    g.connect(out);
    return g;
  }

  private tone(at: number, frequency: number, decay: number, peak: number, type: OscillatorType = "sine", out: AudioNode = this.sfx!) {
    const o = this.ctx!.createOscillator();
    o.type = type; o.frequency.value = frequency;
    o.connect(this.envelope(at, peak, .006, decay, out));
    o.start(at); o.stop(at + decay + .05);
  }

  private burst(at: number, duration: number, peak: number, filter: [BiquadFilterType, number, number], out: AudioNode, pan = 0) {
    const ctx = this.ctx!, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), p = ctx.createStereoPanner();
    src.buffer = this.noise; f.type = filter[0]; f.frequency.value = filter[1]; f.Q.value = filter[2]; p.pan.value = pan;
    src.connect(f).connect(p).connect(this.envelope(at, peak, .004, duration, out));
    src.start(at, Math.random() * 2, duration + .05);
    return f;
  }

  private sweep(at: number, from: number, to: number, duration: number, peak: number, out: AudioNode = this.sfx!) {
    const f = this.burst(at, duration, peak, ["bandpass", from, 1.1], out);
    f.frequency.setValueAtTime(from, at); f.frequency.exponentialRampToValueAtTime(to, at + duration);
  }

  private thump(at: number, frequency: number, peak: number, out: AudioNode = this.sfx!) {
    const o = this.ctx!.createOscillator();
    o.frequency.setValueAtTime(frequency, at); o.frequency.exponentialRampToValueAtTime(frequency * .5, at + .08);
    o.connect(this.envelope(at, peak, .003, .09, out)); o.start(at); o.stop(at + .15);
  }

  /** Leather on stone: a short bright scuff over a soft heel thump, alternating sides. */
  private step(at: number) {
    this.stepSide = -this.stepSide;
    const pan = this.stepSide * .12, pitch = .9 + Math.random() * .2;
    this.burst(at, .045, .16, ["bandpass", 1900 * pitch, 1.6], this.sfx!, pan);
    this.burst(at + .006, .08, .1, ["lowpass", 420 * pitch, .8], this.sfx!, pan);
  }

  private bird(at: number, level: number) {
    const notes = 2 + Math.floor(Math.random() * 3), base = 2600 + Math.random() * 1400, pan = Math.random() * 1.4 - .7;
    for (let i = 0; i < notes; i++) {
      const t = at + i * (.09 + Math.random() * .05), o = this.ctx!.createOscillator(), p = this.ctx!.createStereoPanner();
      p.pan.value = pan;
      o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * .3), t + .06);
      o.connect(p).connect(this.envelope(t, .025 * level, .01, .07, this.ambience!)); o.start(t); o.stop(t + .12);
    }
  }

  private crickets(at: number, level: number) {
    const pan = Math.random() * 1.6 - .8, f = 4300 + Math.random() * 600, pulses = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < pulses; i++) {
      const t = at + i * .055, o = this.ctx!.createOscillator(), p = this.ctx!.createStereoPanner();
      p.pan.value = pan; o.frequency.value = f;
      o.connect(p).connect(this.envelope(t, .018 * level, .004, .03, this.ambience!)); o.start(t); o.stop(t + .05);
    }
  }

  private bell(at: number, frequency: number, peak = .09, decay = 1.1) {
    const out = peak < .09 ? this.ambience! : this.sfx!;
    this.tone(at, frequency, decay, peak, "sine", out);
    this.tone(at, frequency * 2.76, decay * .45, peak * .3, "sine", out);
    if (decay > 2) this.tone(at, frequency * .5, decay, peak * .5, "sine", out);
  }
}

let shared: TownSound | null = null;
/** One sound engine per page. */
export function townSound() {
  if (!shared) shared = new TownSound();
  return shared;
}
