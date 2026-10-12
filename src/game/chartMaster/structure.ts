/**
 * Chart Master — song structure.
 *
 * Groups beats into bars, measures per-bar energy / timbre / rhythm,
 * finds section changes (novelty) and repeated material (so a returning
 * chorus can replay its learned pattern), then places the five stage
 * boundaries on real phrase starts. Stage 3 and stage 5 trigger the POV
 * camera switch in GameplayCore, so they are steered onto the biggest
 * energy lifts — the drops.
 */

import type { AudioAnalysis } from './analysis.ts';
import type { BeatGrid } from './beats.ts';

export interface Bar {
  index: number;
  start: number;
  end: number;
  beats: number[];       // 4 beat times
  energy: number;        // 0..1 loudness, normalised across the song
  activity: number;      // 0..1 onset density, normalised across the song
  repeatOf: number;      // earlier bar index with matching material, or -1
}

export interface Structure {
  bars: Bar[];
  /** Bar index where each stage begins (length 5, first is 0). */
  stageStartBars: number[];
  /** Stage boundary times (length 6: stage 1 start … song end). */
  stageTimes: number[];
  /** Novelty score at each bar boundary (0..1). */
  novelty: number[];
}

const STAGE_TARGETS = [0.15, 0.35, 0.6, 0.8];

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function normalise(xs: number[], lo = 0.05, hi = 0.95): number[] {
  const s = [...xs].sort((a, b) => a - b);
  const a = s[Math.floor(lo * (s.length - 1))] ?? 0;
  const b = s[Math.floor(hi * (s.length - 1))] ?? 1;
  return xs.map((x) => Math.max(0, Math.min(1, (x - a) / Math.max(1e-6, b - a))));
}

export function analyseStructure(an: AudioAnalysis, grid: BeatGrid, duration: number): Structure {
  const { beats, downbeatPhase } = grid;
  const fr = an.frameRate;

  // ── Bars ──
  const raw: { start: number; end: number; beats: number[] }[] = [];
  for (let i = downbeatPhase; i + 4 <= beats.length; i += 4) {
    const bb = beats.slice(i, i + 4);
    const end = beats[i + 4] ?? bb[3] + (bb[3] - bb[2]);
    raw.push({ start: bb[0], end, beats: bb });
  }

  // Per-bar features
  const feat = raw.map((b) => {
    const f0 = Math.max(0, Math.floor(b.start * fr));
    const f1 = Math.min(an.nFrames, Math.max(f0 + 1, Math.floor(b.end * fr)));
    let loud = 0;
    const flux = [0, 0, 0];
    const en = [0, 0, 0];
    const shape = new Array(12).fill(0);
    for (let f = f0; f < f1; f++) {
      loud += an.loudness[f];
      for (let k = 0; k < 3; k++) {
        flux[k] += an.bandFlux[k][f];
        en[k] += an.bandEnergy[k][f];
      }
      for (let s = 0; s < 12; s++) shape[s] += an.shape[f * 12 + s];
    }
    const len = f1 - f0;
    // 16-step rhythm fingerprint (low+mid+high flux at each 16th)
    const rhythm: number[] = [];
    for (let s = 0; s < 16; s++) {
      const beat = Math.floor(s / 4);
      const t0 = b.beats[beat];
      const t1 = b.beats[beat + 1] ?? b.end;
      const t = t0 + ((t1 - t0) * (s % 4)) / 4;
      const f = Math.round(t * fr);
      let m = 0;
      for (let j = f - 2; j <= f + 2; j++) {
        m = Math.max(m, (an.bandFlux[0][j] ?? 0) + (an.bandFlux[1][j] ?? 0) + (an.bandFlux[2][j] ?? 0));
      }
      rhythm.push(m);
    }
    return {
      loud: loud / len,
      flux: flux.map((x) => x / len),
      en: en.map((x) => x / len),
      shape: shape.map((x) => x / len),
      rhythm,
    };
  });

  const energyN = normalise(feat.map((f) => f.loud));
  const activityN = normalise(feat.map((f) => f.flux[0] + f.flux[1] + f.flux[2]));

  // Standardised timbre vectors for novelty / repetition
  const dims = 12 + 3 + 3 + 1;
  const vecs = feat.map((f) => [...f.shape, ...f.en, ...f.flux, f.loud]);
  const mu = new Array(dims).fill(0);
  const sd = new Array(dims).fill(0);
  for (const v of vecs) v.forEach((x, i) => (mu[i] += x / vecs.length));
  for (const v of vecs) v.forEach((x, i) => (sd[i] += (x - mu[i]) ** 2 / vecs.length));
  const z = vecs.map((v) => v.map((x, i) => (x - mu[i]) / (Math.sqrt(sd[i]) || 1)));

  // ── Novelty: distance between the 4 bars before and after each boundary ──
  const W = 4;
  const noveltyRaw = raw.map((_, i) => {
    if (i < 2 || i > raw.length - 2) return 0;
    const before = z.slice(Math.max(0, i - W), i);
    const after = z.slice(i, Math.min(raw.length, i + W));
    let d = 0;
    for (let k = 0; k < dims; k++) {
      d += (mean(before.map((v) => v[k])) - mean(after.map((v) => v[k]))) ** 2;
    }
    return Math.sqrt(d);
  });
  const novelty = normalise(noveltyRaw, 0, 1);

  // ── Repetition: a bar repeats an earlier one if timbre AND rhythm match ──
  const cos = (a: number[], b: number[]) => {
    let ab = 0, aa = 0, bb = 0;
    for (let i = 0; i < a.length; i++) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
    return ab / (Math.sqrt(aa * bb) || 1);
  };
  const rhythmVecs = feat.map((f) => {
    const m = Math.max(...f.rhythm) || 1;
    return f.rhythm.map((x) => x / m);
  });
  const repeatOf = raw.map(() => -1);
  for (let b = 0; b < raw.length; b++) {
    let best = -1;
    let bestSim = 0;
    // Look for material at least 2 bars back (skip trivially adjacent bars)
    for (let a = 0; a < b - 1; a++) {
      const tim = cos(z[a], z[b]);
      if (tim < 0.82) continue;
      const rhy = cos(rhythmVecs[a], rhythmVecs[b]);
      const sim = 0.55 * tim + 0.45 * rhy;
      if (sim > 0.88 && sim > bestSim) { bestSim = sim; best = a; }
    }
    // Follow chains to the root occurrence
    repeatOf[b] = best >= 0 && repeatOf[best] >= 0 ? repeatOf[best] : best;
  }

  const bars: Bar[] = raw.map((b, i) => ({
    index: i,
    start: b.start,
    end: b.end,
    beats: b.beats,
    energy: energyN[i],
    activity: activityN[i],
    repeatOf: repeatOf[i],
  }));

  // ── Stage boundaries: DP over bar boundaries ──
  const first = bars.find((b) => b.start >= an.activeStart - 0.05)?.index ?? 0;
  const lastBar = bars.length - 1;
  const span = Math.max(1, (bars[lastBar]?.end ?? duration) - (bars[first]?.start ?? 0));
  const t0 = bars[first]?.start ?? 0;
  const lift = (i: number) => {
    const before = mean(bars.slice(Math.max(0, i - 2), i).map((b) => b.energy));
    const after = mean(bars.slice(i, i + 2).map((b) => b.energy));
    return Math.max(0, after - before);
  };
  const phrase = (i: number) => ((i - first) % 8 === 0 ? 0.35 : (i - first) % 4 === 0 ? 0.2 : 0);
  const minBars = 4;

  const boundaryScore = (k: number, i: number) => {
    const target = t0 + STAGE_TARGETS[k] * span;
    const dist = (bars[i].start - target) / (0.1 * span);
    // k === 1 → stage 3 start (POV), k === 3 → stage 5 start (POV hyper)
    const liftWeight = k === 1 || k === 3 ? 1.6 : 0.6;
    return novelty[i] + phrase(i) + liftWeight * lift(i) * 2 - 1.2 * dist * dist;
  };

  // dp[k][i] = best total score placing boundary k at bar i
  const K = STAGE_TARGETS.length;
  const dp: number[][] = [];
  const arg: number[][] = [];
  for (let k = 0; k < K; k++) {
    dp.push(new Array(bars.length).fill(-Infinity));
    arg.push(new Array(bars.length).fill(-1));
    for (let i = first + minBars; i <= lastBar - minBars; i++) {
      const s = boundaryScore(k, i);
      if (k === 0) { dp[k][i] = s; continue; }
      for (let j = first + minBars; j <= i - minBars; j++) {
        if (dp[k - 1][j] === -Infinity) continue;
        const v = dp[k - 1][j] + s;
        if (v > dp[k][i]) { dp[k][i] = v; arg[k][i] = j; }
      }
    }
  }
  let end = -1;
  for (let i = 0; i < bars.length; i++) if (end === -1 || dp[K - 1][i] > dp[K - 1][end]) end = i;

  let stageStartBars: number[];
  if (end === -1 || dp[K - 1][end] === -Infinity) {
    // Too short for bar-level placement — fall back to proportional bars
    stageStartBars = [0, ...STAGE_TARGETS.map((p) => Math.round(first + p * (lastBar - first)))];
  } else {
    const picks: number[] = [];
    for (let k = K - 1, i = end; k >= 0; k--) { picks.push(i); i = arg[k][i]; }
    stageStartBars = [0, ...picks.reverse()];
  }

  const stageTimes = [0, ...stageStartBars.slice(1).map((i) => bars[i]?.start ?? 0), duration];

  return { bars, stageStartBars, stageTimes, novelty };
}
