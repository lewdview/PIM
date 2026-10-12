/**
 * Chart Master — tempo + beat tracking.
 *
 * 1. Global tempo from the onset envelope's autocorrelation, reconciled with
 *    the catalog BPM (which is often right up to an octave, and often rounded).
 * 2. Dynamic-programming beat tracker (Ellis 2007): picks the beat sequence
 *    that maximises onset strength while penalising tempo deviation, so the
 *    grid follows small drifts instead of sliding off over three minutes.
 * 3. Downbeat phase: which beat of four carries the kick / phrase starts.
 */

import type { AudioAnalysis } from './analysis.ts';

/** Playable "chart pulse" range — the catalog BPM is folded into this. */
const PULSE_MIN = 70;
const PULSE_MAX = 165;

export interface BeatGrid {
  bpm: number;            // refined chart-pulse tempo
  catalogBpm: number;
  beats: number[];        // beat times (s), covering the active region
  downbeatPhase: number;  // index into beats of the first downbeat (0..3)
  /** Agreement between analysed tempo and catalog BPM (0..1). */
  confidence: number;
}

function foldBpm(bpm: number): number {
  let b = bpm > 0 ? bpm : 120;
  while (b < PULSE_MIN) b *= 2;
  while (b > PULSE_MAX) b /= 2;
  return b;
}

function autocorr(x: Float32Array, lag: number): number {
  let s = 0;
  for (let i = lag; i < x.length; i++) s += Math.max(0, x[i]) * Math.max(0, x[i - lag]);
  return s / Math.max(1, x.length - lag);
}

/** Refine a tempo guess by searching the ACF peak within ±pct, with sub-lag interpolation. */
function refineTempo(env: Float32Array, frameRate: number, bpm: number, pct: number): { bpm: number; score: number } {
  const lagOf = (b: number) => (60 * frameRate) / b;
  const loLag = Math.floor(lagOf(bpm * (1 + pct)));
  const hiLag = Math.ceil(lagOf(bpm * (1 - pct)));
  let best = loLag;
  let bestVal = -Infinity;
  const vals = new Map<number, number>();
  for (let lag = Math.max(2, loLag - 1); lag <= hiLag + 1; lag++) {
    // Sum over the first few multiples sharpens the peak (comb filter)
    const v = autocorr(env, lag) + 0.5 * autocorr(env, lag * 2) + 0.33 * autocorr(env, lag * 4);
    vals.set(lag, v);
    if (lag >= loLag && lag <= hiLag && v > bestVal) { bestVal = v; best = lag; }
  }
  const y0 = vals.get(best - 1) ?? bestVal;
  const y2 = vals.get(best + 1) ?? bestVal;
  const denom = y0 - 2 * bestVal + y2;
  const shift = denom !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / denom)) : 0;
  return { bpm: (60 * frameRate) / (best + shift), score: bestVal };
}

export function trackBeats(an: AudioAnalysis, catalogBpm: number): BeatGrid {
  const { onsetEnv: env, frameRate } = an;
  const target = foldBpm(catalogBpm);

  // Catalog BPMs are unreliable — sometimes rounded by a few percent (enough
  // to drift a full beat over a song), sometimes simply wrong. Estimate the
  // tempo from the audio across 50–220 BPM, with a log-Gaussian preference
  // for ~120 BPM (Ellis) and a modest bonus where the catalog agrees (up to
  // an octave). Then fold into the playable pulse range and refine.
  const lagOf = (b: number) => (60 * frameRate) / b;
  let bestBpm = target;
  let bestVal = -Infinity;
  for (let b = 50; b <= 220; b += 0.5) {
    const lag = Math.round(lagOf(b));
    const acf = autocorr(env, lag) + 0.5 * autocorr(env, lag * 2);
    const prior = Math.exp(-0.5 * (Math.log2(b / 120) / 0.9) ** 2);
    const agrees = [0.5, 1, 2].some((m) => Math.abs(Math.log2(b / (target * m))) < 0.04);
    const v = acf * prior * (agrees ? 1.25 : 1);
    if (v > bestVal) { bestVal = v; bestBpm = b; }
  }
  const { bpm } = refineTempo(env, frameRate, foldBpm(bestBpm), 0.025);
  const ratio = bpm / target;
  const confidence = Math.max(0, 1 - Math.min(...[1, 0.5, 2].map((m) => Math.abs(Math.log2(ratio / m)))) * 8);

  // ── DP beat tracking ──
  const period = (60 * frameRate) / bpm;
  const n = env.length;
  // Local score: onset envelope smoothed by a Gaussian of width period/32
  const sigma = Math.max(1, period / 32);
  const radius = Math.ceil(sigma * 3);
  const kernel: number[] = [];
  for (let k = -radius; k <= radius; k++) kernel.push(Math.exp(-0.5 * (k / sigma) ** 2));
  const local = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = -radius; k <= radius; k++) {
      const j = i + k;
      if (j >= 0 && j < n) s += env[j] * kernel[k + radius];
    }
    local[i] = s;
  }

  const tightness = 400; // higher = stiffer tempo
  const score = new Float32Array(n);
  const back = new Int32Array(n).fill(-1);
  const pMin = Math.round(period * 0.5);
  const pMax = Math.round(period * 2);
  for (let i = 0; i < n; i++) {
    let best = 0;
    let arg = -1;
    for (let prev = i - pMax; prev <= i - pMin; prev++) {
      if (prev < 0) continue;
      const dev = Math.log((i - prev) / period);
      const v = score[prev] - tightness * dev * dev;
      if (arg === -1 || v > best) { best = v; arg = prev; }
    }
    score[i] = local[i] + (arg >= 0 ? Math.max(0, best) : 0);
    back[i] = arg >= 0 && best > 0 ? arg : -1;
  }

  // Backtrace from the best-scoring frame near the active end
  const endFrame = Math.min(n - 1, Math.round(an.activeEnd * frameRate));
  let cur = endFrame;
  for (let i = Math.max(0, endFrame - Math.round(period)); i <= endFrame; i++) {
    if (score[i] > score[cur]) cur = i;
  }
  const frames: number[] = [];
  while (cur >= 0) {
    frames.push(cur);
    cur = back[cur];
  }
  frames.reverse();

  // Convert to seconds; extend with the period to cover the active region
  const periodS = 60 / bpm;
  let beats = frames.map((f) => (f * an.hop) / an.sampleRate);
  if (beats.length < 4) {
    beats = [];
    for (let t = an.activeStart; t < an.activeEnd; t += periodS) beats.push(t);
  }
  while (beats[0] - periodS >= an.activeStart - periodS * 0.5) beats.unshift(beats[0] - periodS);
  while (beats[beats.length - 1] + periodS <= an.activeEnd) beats.push(beats[beats.length - 1] + periodS);

  // ── Downbeat phase: beat-of-four with the strongest low-band hits ──
  const lowAt = (t: number) => {
    const f = Math.round(t * frameRate);
    let m = 0;
    for (let j = f - 2; j <= f + 2; j++) m = Math.max(m, an.bandFlux[0][j] ?? 0);
    return m;
  };
  const phaseScore = [0, 0, 0, 0];
  beats.forEach((t, i) => {
    phaseScore[i % 4] += lowAt(t) + 0.35 * Math.max(0, env[Math.round(t * frameRate)] ?? 0);
  });
  let downbeatPhase = 0;
  for (let p = 1; p < 4; p++) if (phaseScore[p] > phaseScore[downbeatPhase]) downbeatPhase = p;

  return { bpm, catalogBpm, beats, downbeatPhase, confidence };
}
