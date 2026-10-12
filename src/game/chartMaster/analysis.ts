/**
 * Chart Master — audio analysis layer.
 *
 * Turns mono PCM into the feature streams the composer needs:
 *  - per-band onset strength (SuperFlux-style log spectral flux) for
 *    low (kick/bass), mid (snare/vocal body) and high (hats/leads)
 *  - per-band log energy (for sustain / hold detection)
 *  - frame loudness, spectral centroid (melodic contour), and a coarse
 *    12-band spectral shape (for section repetition matching)
 *  - peak-picked onset events per band
 *
 * Pure TypeScript, no DOM — runs in the browser and in Node.
 */

export const ANALYSIS_SAMPLE_RATE = 22050;
const FRAME = 1024;
const HOP = 256;

export type Band = 0 | 1 | 2; // 0 = low, 1 = mid, 2 = high — maps directly to lanes

export interface OnsetEvent {
  frame: number;
  time: number;
  strength: number; // normalised, ~0..1+ (1 ≈ 95th percentile of the band)
}

export interface AudioAnalysis {
  sampleRate: number;
  hop: number;
  frameRate: number;
  nFrames: number;
  duration: number;
  /** Combined onset envelope, mean 0 / std 1 (beat tracking input). */
  onsetEnv: Float32Array;
  /** Per-band normalised flux (1 ≈ band's 95th percentile). */
  bandFlux: [Float32Array, Float32Array, Float32Array];
  /** Per-band mean log magnitude (sustain detection). */
  bandEnergy: [Float32Array, Float32Array, Float32Array];
  /** Peak-picked onsets per band. */
  bandOnsets: [OnsetEvent[], OnsetEvent[], OnsetEvent[]];
  /** Frame loudness, 0..1 relative to the track. */
  loudness: Float32Array;
  /** Spectral centroid in Hz. */
  centroid: Float32Array;
  /** 12 log-spaced band energies per frame, flattened [frame * 12 + k]. */
  shape: Float32Array;
  /** First / last time with meaningful audio. */
  activeStart: number;
  activeEnd: number;
  /**
   * Harmonic (sustained) layer, from a time-median-filtered spectrogram of
   * the 150 Hz–4 kHz range: percussion is removed, sung / held notes remain.
   */
  harmonicEnergy: Float32Array;
  /** New sustained notes / chord changes in the harmonic layer. */
  harmonicOnsets: OnsetEvent[];
}

// ── FFT (iterative radix-2, in place) ─────────────────────────────

function makeFft(n: number) {
  const levels = Math.log2(n);
  if (levels % 1 !== 0) throw new Error('FFT size must be a power of two');
  const cos = new Float64Array(n / 2);
  const sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = Math.sin((2 * Math.PI * i) / n);
  }
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0, x = i; b < levels; b++, x >>= 1) r = (r << 1) | (x & 1);
    rev[i] = r;
  }
  return (re: Float64Array, im: Float64Array) => {
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1;
      const step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = i, k = 0; j < i + half; j++, k += step) {
          const l = j + half;
          const tre = re[l] * cos[k] + im[l] * sin[k];
          const tim = -re[l] * sin[k] + im[l] * cos[k];
          re[l] = re[j] - tre;
          im[l] = im[j] - tim;
          re[j] += tre;
          im[j] += tim;
        }
      }
    }
  };
}

// ── Small numeric helpers ────────────────────────────────────────

export function percentile(values: ArrayLike<number>, p: number): number {
  const arr = Array.from(values).sort((a, b) => a - b);
  if (arr.length === 0) return 0;
  const idx = Math.min(arr.length - 1, Math.max(0, Math.round(p * (arr.length - 1))));
  return arr[idx];
}

function movingMean(x: Float32Array, radius: number): Float32Array {
  const out = new Float32Array(x.length);
  let sum = 0;
  let lo = 0;
  let hi = -1;
  for (let i = 0; i < x.length; i++) {
    const a = Math.max(0, i - radius);
    const b = Math.min(x.length - 1, i + radius);
    while (hi < b) sum += x[++hi];
    while (lo < a) sum -= x[lo++];
    out[i] = sum / (hi - lo + 1);
  }
  return out;
}

// ── Main analysis ────────────────────────────────────────────────

/**
 * Analyse mono PCM. Audio at any rate is accepted but ANALYSIS_SAMPLE_RATE
 * (22050) is expected — band edges are computed from the actual rate.
 */
export function analyzeAudio(pcm: Float32Array, sampleRate: number): AudioAnalysis {
  const nFrames = Math.max(1, Math.floor((pcm.length - FRAME) / HOP) + 1);
  const frameRate = sampleRate / HOP;
  const nBins = FRAME / 2 + 1;
  const binHz = sampleRate / FRAME;
  const bin = (hz: number) => Math.max(1, Math.min(nBins - 1, Math.round(hz / binHz)));

  // Band edges (bins, inclusive start / exclusive end)
  const bands: [number, number][] = [
    [bin(35), bin(180)],
    [bin(180), bin(2000)],
    [bin(2000), bin(Math.min(9000, sampleRate / 2 - binHz))],
  ];
  // 12 log-spaced shape bands 60 Hz .. 8 kHz
  const shapeEdges: number[] = [];
  for (let k = 0; k <= 12; k++) shapeEdges.push(bin(60 * Math.pow(8000 / 60, k / 12)));

  const fft = makeFft(FRAME);
  const window = new Float64Array(FRAME);
  for (let i = 0; i < FRAME; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FRAME);

  const re = new Float64Array(FRAME);
  const im = new Float64Array(FRAME);
  let prevLog = new Float32Array(nBins);
  let curLog = new Float32Array(nBins);

  const flux: [Float32Array, Float32Array, Float32Array] = [
    new Float32Array(nFrames), new Float32Array(nFrames), new Float32Array(nFrames),
  ];
  const energy: [Float32Array, Float32Array, Float32Array] = [
    new Float32Array(nFrames), new Float32Array(nFrames), new Float32Array(nFrames),
  ];
  const rmsDb = new Float32Array(nFrames);
  const centroid = new Float32Array(nFrames);
  const shape = new Float32Array(nFrames * 12);
  const hLo = bin(150);
  const hHi = bin(4000);
  const hBins = hHi - hLo;
  const spec = new Float32Array(nFrames * hBins); // log-mag, harmonic range

  for (let f = 0; f < nFrames; f++) {
    const off = f * HOP;
    let sq = 0;
    for (let i = 0; i < FRAME; i++) {
      const s = pcm[off + i] ?? 0;
      sq += s * s;
      re[i] = s * window[i];
      im[i] = 0;
    }
    rmsDb[f] = 10 * Math.log10(sq / FRAME + 1e-10);
    fft(re, im);

    let magSum = 0;
    let weighted = 0;
    for (let k = 0; k < nBins; k++) {
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      curLog[k] = Math.log1p(100 * mag);
      magSum += mag;
      weighted += mag * k * binHz;
    }
    centroid[f] = magSum > 1e-6 ? weighted / magSum : 0;
    spec.set(curLog.subarray(hLo, hHi), f * hBins);

    for (let b = 0; b < 3; b++) {
      const [lo, hi] = bands[b];
      let fl = 0;
      let en = 0;
      for (let k = lo; k < hi; k++) {
        // SuperFlux: compare against a frequency max-filtered previous frame,
        // which suppresses vibrato / pitch wobble false onsets.
        const ref = Math.max(prevLog[k - 1] ?? 0, prevLog[k], prevLog[k + 1] ?? 0);
        const d = curLog[k] - ref;
        if (d > 0) fl += d;
        en += curLog[k];
      }
      flux[b][f] = f === 0 ? 0 : fl / (hi - lo);
      energy[b][f] = en / (hi - lo);
    }
    for (let s = 0; s < 12; s++) {
      const lo = shapeEdges[s];
      const hi = Math.max(lo + 1, shapeEdges[s + 1]);
      let en = 0;
      for (let k = lo; k < hi; k++) en += curLog[k];
      shape[f * 12 + s] = en / (hi - lo);
    }
    const t = prevLog; prevLog = curLog; curLog = t;
  }

  // Loudness 0..1 against the track's own range
  const dbLo = percentile(rmsDb, 0.05);
  const dbHi = percentile(rmsDb, 0.98);
  const loudness = new Float32Array(nFrames);
  for (let f = 0; f < nFrames; f++) {
    loudness[f] = Math.max(0, Math.min(1, (rmsDb[f] - dbLo) / Math.max(1, dbHi - dbLo)));
  }

  // Active region: audible audio (> -45 dB below the loud level)
  const gate = dbHi - 45;
  let a = 0;
  while (a < nFrames - 1 && rmsDb[a] < gate) a++;
  let z = nFrames - 1;
  while (z > a && rmsDb[z] < gate) z--;

  // Normalise band flux to its 95th percentile within the active region
  const bandFlux = flux.map((x) => {
    const p = percentile(x.subarray(a, z + 1), 0.95) || 1e-6;
    const out = new Float32Array(nFrames);
    for (let i = 0; i < nFrames; i++) out[i] = x[i] / p;
    return out;
  }) as [Float32Array, Float32Array, Float32Array];

  // Combined envelope for beat tracking: weighted sum, z-scored
  const onsetEnv = new Float32Array(nFrames);
  for (let i = 0; i < nFrames; i++) {
    onsetEnv[i] = 1.0 * bandFlux[0][i] + 0.8 * bandFlux[1][i] + 0.6 * bandFlux[2][i];
  }
  let mean = 0;
  for (let i = 0; i < nFrames; i++) mean += onsetEnv[i];
  mean /= nFrames;
  let v = 0;
  for (let i = 0; i < nFrames; i++) v += (onsetEnv[i] - mean) ** 2;
  const sd = Math.sqrt(v / nFrames) || 1;
  for (let i = 0; i < nFrames; i++) onsetEnv[i] = (onsetEnv[i] - mean) / sd;

  // Peak picking: local max, above adaptive threshold, min gap
  const pickPeaks = (x: Float32Array, minGapS: number): OnsetEvent[] => {
    const peakRadius = Math.max(1, Math.round(minGapS * frameRate));
    const local = movingMean(x, Math.round(0.25 * frameRate));
    const out: OnsetEvent[] = [];
    let last = -1e9;
    for (let i = Math.max(1, a); i < Math.min(nFrames - 1, z + 1); i++) {
      const val = x[i];
      if (val < local[i] + 0.08 || val < 0.12) continue;
      let isMax = true;
      for (let j = Math.max(0, i - peakRadius); j <= Math.min(nFrames - 1, i + peakRadius); j++) {
        if (x[j] > val) { isMax = false; break; }
      }
      if (!isMax || i - last < peakRadius) continue;
      out.push({ frame: i, time: (i * HOP) / sampleRate, strength: val });
      last = i;
    }
    return out;
  };
  const bandOnsets = bandFlux.map((x) => pickPeaks(x, 0.03)) as [OnsetEvent[], OnsetEvent[], OnsetEvent[]];

  // ── Harmonic layer: median-filter each bin over ~200 ms of time ──
  // A transient lasts a frame or two and vanishes under the median; a held
  // note or chord survives. (Horizontal half of median-filter HPSS.)
  const K = 17;
  const half = K >> 1;
  const harm = new Float32Array(nFrames * hBins);
  const win = new Float32Array(K);
  for (let k = 0; k < hBins; k++) {
    for (let f = 0; f < nFrames; f++) {
      let n = 0;
      for (let j = f - half; j <= f + half; j++) {
        if (j < 0 || j >= nFrames) continue;
        // insertion into sorted window
        const v = spec[j * hBins + k];
        let p = n++;
        while (p > 0 && win[p - 1] > v) { win[p] = win[p - 1]; p--; }
        win[p] = v;
      }
      harm[f * hBins + k] = win[n >> 1];
    }
  }
  const harmonicEnergy = new Float32Array(nFrames);
  const hFluxRaw = new Float32Array(nFrames);
  for (let f = 0; f < nFrames; f++) {
    let en = 0;
    let fl = 0;
    const o = f * hBins;
    const p = (f - 1) * hBins;
    for (let k = 0; k < hBins; k++) {
      en += harm[o + k];
      if (f > 0) {
        const ref = Math.max(harm[p + k], k > 0 ? harm[p + k - 1] : 0, k < hBins - 1 ? harm[p + k + 1] : 0);
        const dlt = harm[o + k] - ref;
        if (dlt > 0) fl += dlt;
      }
    }
    harmonicEnergy[f] = en / hBins;
    hFluxRaw[f] = fl / hBins;
  }
  const hp = percentile(hFluxRaw.subarray(a, z + 1), 0.95) || 1e-6;
  for (let f = 0; f < nFrames; f++) hFluxRaw[f] /= hp;
  const harmonicOnsets = pickPeaks(hFluxRaw, 0.08);

  return {
    sampleRate,
    hop: HOP,
    frameRate,
    nFrames,
    duration: pcm.length / sampleRate,
    onsetEnv,
    bandFlux,
    bandEnergy: energy,
    bandOnsets,
    loudness,
    centroid,
    shape,
    activeStart: (a * HOP) / sampleRate,
    activeEnd: ((z * HOP) + FRAME) / sampleRate,
    harmonicEnergy,
    harmonicOnsets,
  };
}
