#!/usr/bin/env node
// Bakes the monthly build's tutorial track, public/tutorial/pg-tutorial.mp3:
// "computer sounds" (a soft kick on the beat, ticking hats, a square-wave
// arpeggio and the odd burst of data bleeps) at 100 BPM, 330 s long, so it
// outlasts any tutorial run (gameplay ends a run when its audio runs out).
// It ships as an ordinary MP3 so it loads exactly like a song in every
// browser. Re-run after changing the sound: node scripts/make-tutorial-track.mjs

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BPM = 100;
const DURATION = 330;
const RATE = 22050;
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '../public/tutorial/pg-tutorial.mp3');

/** Small seeded PRNG so the track sounds the same every time. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

function render() {
  const out = new Float32Array(DURATION * RATE);
  const beat = 60 / BPM;
  const rand = rng(365);
  const add = (start, len, fn) => {
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
  let pattern = [];

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

function wav(samples) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
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
  return Buffer.from(buf);
}

const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pg-tutorial-')), 'track.wav');
fs.writeFileSync(tmp, wav(render()));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', tmp, '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '96k', OUT], { stdio: 'inherit' });
fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
console.log(`[tutorial-track] wrote ${path.relative(process.cwd(), OUT)} (${(fs.statSync(OUT).size / 1048576).toFixed(1)} MB)`);
