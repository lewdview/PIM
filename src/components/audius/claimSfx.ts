/**
 * Small chiptune sound kit for the weekly Audius card claim reveal.
 * Square/triangle blips and a noise hit, synthesized with Web Audio (no files).
 * Follows the player's SFX on/off and volume options.
 */
import { loadOpts } from '@/lib/options';

let ctx: AudioContext | null = null;

function audio(): { c: AudioContext; out: GainNode } | null {
  let opts: { sfxEnabled?: boolean; sfxVolume?: number } = {};
  try {
    opts = loadOpts();
  } catch {
    /* defaults */
  }
  if (opts.sfxEnabled === false) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
    const out = ctx.createGain();
    out.gain.value = 0.16 * Math.max(0, Math.min(1, opts.sfxVolume ?? 0.8));
    out.connect(ctx.destination);
    return { c: ctx, out };
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', slideTo?: number) {
  const a = audio();
  if (!a) return;
  const { c, out } = a;
  const t = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(start: number, dur: number, level = 1) {
  const a = audio();
  if (!a) return;
  const { c, out } = a;
  const t = c.currentTime + start;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  // Stepped (sample-and-hold) noise for a crunchy 8-bit hit.
  let v = 0;
  for (let i = 0; i < len; i++) {
    if (i % 6 === 0) v = Math.random() * 2 - 1;
    d[i] = v * (1 - i / len);
  }
  const src = c.createBufferSource();
  const g = c.createGain();
  g.gain.value = level;
  src.buffer = buf;
  src.connect(g);
  g.connect(out);
  src.start(t);
}

export const claimSfx = {
  /** Cursor hop on the select grid. */
  tick(pitch = 0) {
    tone(880 * Math.pow(2, pitch / 12), 0, 0.045);
  },
  /** Banner whoosh-in. */
  swoosh() {
    tone(220, 0, 0.18, 'triangle', 880);
  },
  /** The × slam. */
  slam(heavy = false) {
    noise(0, heavy ? 0.32 : 0.22, heavy ? 1 : 0.8);
    tone(heavy ? 98 : 131, 0, heavy ? 0.35 : 0.25, 'square', heavy ? 41 : 55);
  },
  /** Cursor locks onto the card. */
  lock() {
    tone(1319, 0, 0.06);
    tone(1760, 0.07, 0.12);
  },
  /** Card reveal fanfare. Deluxe gets a longer, higher run. */
  fanfare(deluxe = false) {
    const run = deluxe
      ? [523, 659, 784, 1047, 784, 1047, 1319, 1568]
      : [392, 523, 659, 784, 1047];
    run.forEach((f, i) => tone(f, i * 0.07, 0.11));
    const end = run.length * 0.07;
    const chord = deluxe ? [1047, 1319, 1568] : [784, 988, 1175];
    chord.forEach((f) => tone(f, end, deluxe ? 0.7 : 0.5, 'square'));
    tone(deluxe ? 131 : 196, end, deluxe ? 0.7 : 0.5, 'triangle');
  },
  /** Letter blip while the headline types. */
  type() {
    tone(1568, 0, 0.02);
  },
};
