// The monthly build's controls tutorial is its own node before track 1, so it
// can't borrow the opening song. It plays over "computer sounds" synthesized
// here when the tutorial starts: a soft kick on the beat, ticking hats, a
// square-wave arpeggio and the odd burst of data bleeps. Nothing ships in the
// zip; the WAV is rendered once into a blob URL and reused.

import type { GameSong } from '@/game/api';

/** Song id of the tutorial run (`/play/pg-tutorial?tutorial=true`). */
export const PG_TUTORIAL_ID = 'pg-tutorial';
/** localStorage flag the tutorial sets when it's finished (mirrored into the Playgama save). */
export const TUTORIAL_DONE_KEY = 'pim_tutorial_completed';

const BPM = 100;
// Longer than any tutorial takes: gameplay ends a run when its audio runs out.
const DURATION = 330;
// Low enough that the WAV stays under gameplay's 10 MB limit for loading audio
// into memory (bigger files are streamed by URL, which a blob URL can't do).
const RATE = 12000;

export function isTutorialDone(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_DONE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Small seeded PRNG so the track sounds the same every time. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

function render(): Float32Array {
  const out = new Float32Array(DURATION * RATE);
  const beat = 60 / BPM;
  const rand = rng(365);
  const add = (start: number, len: number, fn: (t: number, i: number) => number) => {
    const s0 = Math.floor(start * RATE);
    const n = Math.min(Math.floor(len * RATE), out.length - s0);
    for (let i = 0; i < n; i++) out[s0 + i] += fn(i / RATE, i);
  };

  // C minor pentatonic, four bars per pattern.
  const scale = [48, 51, 53, 55, 58, 60, 63, 65, 67, 70, 72];
  const roots = [36, 43, 39, 41];
  // Sixteen bars are rendered, then repeated to fill the track (rendering all
  // of it would hold up the loading screen for a second or more on a phone).
  const beats = 64;
  let pattern: number[] = [];

  for (let b = 0; b < beats; b++) {
    const t = b * beat;
    const bar = Math.floor(b / 4);
    // Kick: sine dropping 120 → 45 Hz.
    add(t, 0.18, (x) => {
      const f = 45 + 75 * Math.exp(-x * 30);
      return Math.sin(2 * Math.PI * f * x) * Math.exp(-x * 18) * 0.55;
    });
    // Hat on the off-beat: a short burst of differenced noise.
    let prev = 0;
    add(t + beat / 2, 0.035, (x) => {
      const n = rand() * 2 - 1;
      const v = n - prev;
      prev = n;
      return v * Math.exp(-x * 120) * 0.08;
    });
    // Bass: a triangle on the bar's root, once per bar.
    if (b % 4 === 0) {
      const f = midiHz(roots[bar % roots.length]);
      add(t, beat * 4, (x) => {
        const ph = (f * x) % 1;
        return (4 * Math.abs(ph - 0.5) - 1) * Math.min(1, x * 20) * Math.exp(-x * 0.6) * 0.12;
      });
    }
    // Arpeggio: square-wave 16ths, a new pattern every four bars.
    if (b % 16 === 0) pattern = Array.from({ length: 16 }, () => scale[Math.floor(rand() * scale.length)]);
    for (let k = 0; k < 4; k++) {
      const m = pattern[(b % 4) * 4 + k] + (bar % 8 >= 4 ? 12 : 0);
      const f = midiHz(m);
      add(t + (k * beat) / 4, beat / 4, (x) => (((f * x) % 1) < 0.5 ? 1 : -1) * Math.exp(-x * 28) * 0.07);
    }
    // Data bleeps every other bar: random pitches held for 25 ms.
    if (b % 8 === 6) {
      let f = 0;
      add(t + beat / 4, beat * 0.9, (x, i) => {
        if (i % Math.floor(RATE * 0.025) === 0) f = 900 + rand() * 2400;
        return Math.sin(2 * Math.PI * f * x) * 0.05 * (1 - x / (beat * 0.9));
      });
    }
  }

  const loop = Math.round(beats * beat * RATE);
  // Tails ringing past the loop's end wrap round to its start, so the repeat is seamless.
  for (let i = 0; i < RATE * 3; i++) out[i] += out[loop + i];
  for (let i = 0; i < loop; i++) out[i] = Math.tanh(out[i] * 1.2); // soft clip
  for (let i = loop; i < out.length; i++) out[i] = out[i - loop];
  // Fade in and out.
  const fadeIn = 1.5 * RATE;
  const fadeOut = 3 * RATE;
  for (let i = 0; i < fadeIn; i++) out[i] *= i / fadeIn;
  for (let i = 0; i < fadeOut; i++) out[out.length - 1 - i] *= i / fadeOut;
  return out;
}

function wav(samples: Float32Array): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

let audioUrl: string | null = null;

/** The tutorial "song": no chart (the tutorial writes its own notes) and synthesized audio. */
export function tutorialSong(): GameSong {
  if (!audioUrl) audioUrl = URL.createObjectURL(wav(render()));
  return {
    id: PG_TUTORIAL_ID,
    day: 0,
    date: '',
    title: 'Tutorial',
    artist: 'PIM',
    bpm: BPM,
    duration: DURATION,
    mood: 'light',
    valence: 0.5,
    moodTags: [],
    description: 'Learn the controls',
    audioUrl,
    coverArt: null,
    notes: [],
    key: 'C minor',
    genre: ['Electronic'],
    difficultyLevel: 1,
  };
}
