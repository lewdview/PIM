/**
 * Beat clock + placeholder music for the secret levels.
 *
 * Each level is meant to run on its own hidden song. Until that audio is
 * added (set `audioUrl` in SECRET_TRACKS), a small WebAudio chiptune loop
 * plays instead. Either way the level reads the current beat from here, so
 * swapping in the real song only needs its URL, BPM and first-beat offset.
 */

export interface SecretTrack {
  /** Hidden song file, e.g. '/audio/secret/shooter.mp3'. Empty → chiptune. */
  audioUrl?: string;
  bpm: number;
  /** Seconds from the start of the file to beat 0. */
  offset?: number;
  /** Root note (MIDI) for the placeholder chiptune. */
  root: number;
}

export const SECRET_TRACKS: Record<'shooter' | 'runner', SecretTrack> = {
  shooter: { bpm: 140, root: 45 },
  runner: { bpm: 128, root: 50 },
};

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class BeatClock {
  private ctx: AudioContext | null = null;
  private audio: HTMLAudioElement | null = null;
  private startAt = 0;
  private nextStep = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private noise: AudioBuffer | null = null;
  private master: GainNode | null = null;
  private silentStart: number | null = null;
  private pausedBeat: number | null = null;

  constructor(private track: SecretTrack) {}

  get bpm() {
    return this.track.bpm;
  }

  async start(allowSilent = false): Promise<void> {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (this.track.audioUrl) {
      this.audio = new Audio(this.track.audioUrl);
      this.audio.crossOrigin = 'anonymous';
      await this.audio.play().catch(() => undefined);
      return;
    }
    if (allowSilent || !Ctx) this.silentStart = performance.now() / 1000 + 0.1;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    const audio = this.unlockSound();
    if (!allowSilent) await audio;
  }

  /** Gamepad presses may start play before the browser grants sound access. */
  async unlockSound() {
    const ctx = this.ctx;
    if (!ctx || this.master || this.pausedBeat !== null) return;
    await ctx.resume().catch(() => undefined);
    if (this.ctx !== ctx || this.master || ctx.state !== 'running') return;
    const beat = this.pausedBeat ?? this.beat();
    this.master = ctx.createGain();
    this.master.gain.value = 0.18;
    this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 0.2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.startAt = this.silentStart === null ? ctx.currentTime + 0.1 : ctx.currentTime - beat * 60 / this.track.bpm;
    this.nextStep = Math.max(0, Math.ceil(beat * 4));
    this.timer = setInterval(() => this.schedule(), 25);
    if (this.pausedBeat !== null) void ctx.suspend().catch(() => undefined);
    this.schedule();
  }

  /** Current position in beats (fractional). Negative before beat 0. */
  beat(): number {
    if (this.pausedBeat !== null) return this.pausedBeat;
    if (this.audio) return ((this.audio.currentTime - (this.track.offset ?? 0)) * this.track.bpm) / 60;
    if (this.ctx && this.master) return ((this.ctx.currentTime - this.startAt) * this.track.bpm) / 60;
    return this.silentStart === null ? -1 : ((performance.now() / 1000 - this.silentStart) * this.track.bpm) / 60;
  }

  pause() {
    if (this.pausedBeat !== null) return;
    this.pausedBeat = this.beat();
    this.audio?.pause();
    if (this.ctx?.state === 'running') void this.ctx.suspend().catch(() => undefined);
  }

  resume() {
    if (this.pausedBeat === null) return;
    if (this.silentStart !== null) this.silentStart = performance.now() / 1000 - this.pausedBeat * 60 / this.track.bpm;
    this.pausedBeat = null;
    void this.audio?.play().catch(() => undefined);
    if (this.master) void this.ctx?.resume().catch(() => undefined);
    else void this.unlockSound();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.audio?.pause();
    this.audio = null;
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.silentStart = null;
    this.pausedBeat = null;
  }

  // ── Placeholder chiptune: 16th-note sequencer, scheduled ahead ──
  private schedule() {
    const ctx = this.ctx;
    if (!ctx || this.pausedBeat !== null) return;
    const stepDur = 60 / this.track.bpm / 4;
    while (this.startAt + this.nextStep * stepDur < ctx.currentTime + 0.12) {
      this.playStep(this.nextStep, this.startAt + this.nextStep * stepDur, stepDur);
      this.nextStep++;
    }
  }

  private playStep(step: number, when: number, stepDur: number) {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const root = this.track.root;
    const prog = [0, 0, 5, 3, 0, 0, 7, 5][bar % 8]; // i i iv III i i v iv
    if (s % 4 === 0) this.kick(when);
    if (s % 8 === 4) this.snare(when);
    if (s % 2 === 1) this.hat(when);
    if (s % 2 === 0) this.tone('triangle', midiHz(root - 12 + prog + (s % 8 === 6 ? 12 : 0)), when, stepDur * 1.8, 0.5);
    const arp = [0, 3, 7, 12, 7, 3, 12, 15];
    if (bar >= 2) this.tone('square', midiHz(root + 12 + prog + arp[s % 8]), when, stepDur * 0.9, 0.18);
  }

  private tone(type: OscillatorType, hz: number, when: number, dur: number, vol: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = hz;
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(g).connect(this.master!);
    o.start(when);
    o.stop(when + dur + 0.02);
  }

  private kick(when: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, when);
    o.frequency.exponentialRampToValueAtTime(40, when + 0.12);
    g.gain.setValueAtTime(1, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.18);
    o.connect(g).connect(this.master!);
    o.start(when);
    o.stop(when + 0.2);
  }

  private noiseHit(when: number, dur: number, vol: number, hp: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(when);
    src.stop(when + dur);
  }

  private snare(when: number) {
    this.noiseHit(when, 0.14, 0.6, 1500);
  }

  private hat(when: number) {
    this.noiseHit(when, 0.04, 0.25, 7000);
  }
}
