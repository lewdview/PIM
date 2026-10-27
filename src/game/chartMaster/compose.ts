/**
 * Chart Master — composer.
 *
 * Places notes on a beat-locked 16th grid, bar by bar:
 *  - rhythm follows real onsets, weighted by metrical position
 *  - density follows stage, difficulty and how busy the music is
 *  - lanes follow sound: low → 0, mid → 1, high → 2, melodic contour moves
 *    the hand up/down, with jack / jump ergonomics
 *  - holds come from genuinely sustained sounds, slides from pitch glides
 *  - repeated sections replay the pattern learned the first time, and are
 *    embellished when they return in a harder stage
 *  - stage 3 / stage 5 (POV switches) get a clear runway and an entrance hit
 *
 * Deluxe mode (`deluxe: true`) is the same composer pushed harder: +2
 * difficulty, denser and tighter spacing, every note type from earlier
 * stages, and extra passes for lifts, zigzags, mines, breaks and remixes
 * that stay tied to the music.
 */

import type { Note, NoteType } from '../types.ts';
import type { AudioAnalysis, OnsetEvent } from './analysis.ts';
import type { BeatGrid } from './beats.ts';
import type { Bar, Structure } from './structure.ts';

export interface ComposeInput {
  difficulty: number; // 1..10
  seed: number;
  duration: number;
  /** Chart Master Deluxe: harder, and uses every note type. */
  deluxe?: boolean;
}

type SwipeDir = NonNullable<Note['swipeDirection']>;

interface TemplateNote {
  slot: number;
  lane: number;
  type: NoteType;
  holdBeats?: number;
  targetLane?: number;
  swipeDirection?: SwipeDir;
}

const POV_STAGES = new Set([3, 5]);

const STAGE_TYPES: Record<number, Set<NoteType>> = {
  1: new Set<NoteType>(['tap']),
  2: new Set<NoteType>(['tap', 'hold']),
  3: new Set<NoteType>(['tap', 'hold', 'slide', 'swipe', 'accent']),
  4: new Set<NoteType>(['tap', 'hold', 'slide', 'swipe', 'accent', 'hold-swipe']),
  5: new Set<NoteType>(['tap', 'hold', 'slide', 'swipe', 'accent', 'hold-swipe']),
};

const DELUXE_STAGE_TYPES: Record<number, Set<NoteType>> = {
  1: new Set<NoteType>(['tap', 'hold', 'swipe']),
  2: new Set<NoteType>(['tap', 'hold', 'swipe', 'slide', 'accent', 'hold-swipe', 'lift']),
  3: new Set<NoteType>(['tap', 'hold', 'swipe', 'slide', 'accent', 'hold-swipe', 'lift', 'zigzag', 'mine']),
  4: new Set<NoteType>(['tap', 'hold', 'swipe', 'slide', 'accent', 'hold-swipe', 'lift', 'zigzag', 'mine', 'remix', 'break']),
  5: new Set<NoteType>(['tap', 'hold', 'swipe', 'slide', 'accent', 'hold-swipe', 'lift', 'zigzag', 'mine', 'remix', 'break']),
};

/** Downgrade a note type to what a stage allows. */
function gateType(type: NoteType, stage: number, types: Record<number, Set<NoteType>>): NoteType {
  const ok = types[stage];
  if (ok.has(type)) return type;
  if ((type === 'slide' || type === 'hold-swipe' || type === 'zigzag') && ok.has('hold')) return 'hold';
  return 'tap';
}

/** 8-way swipe direction: the lane gives left/right, the melody gives up/down. */
function swipeDirFor(lane: number, contour: number): SwipeDir {
  const h = lane === 0 ? 'left' : lane === 2 ? 'right' : '';
  const v = contour > 0.15 ? 'up' : contour < -0.15 ? 'down' : '';
  if (h && v) return `${v}-${h}` as SwipeDir;
  return (h || v || 'up') as SwipeDir;
}

const METRIC = [1.0, 0.3, 0.5, 0.3, 0.75, 0.3, 0.5, 0.3, 0.85, 0.3, 0.5, 0.3, 0.75, 0.3, 0.5, 0.3];
const LANE_DIR: SwipeDir[] = ['left', 'up', 'right'];

function createPrng(seed: number) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function composeChart(an: AudioAnalysis, grid: BeatGrid, st: Structure, input: ComposeInput): Note[] {
  const deluxe = !!input.deluxe;
  const types = deluxe ? DELUXE_STAGE_TYPES : STAGE_TYPES;
  const d = Math.max(1, Math.min(10, Math.round(input.difficulty || 5) + (deluxe ? 2 : 0)));
  const rand = createPrng(input.seed);
  const fr = an.frameRate;
  const beatDur = 60 / grid.bpm;

  // ── Difficulty parameters ──
  // Spacing and density are defined in seconds, so they don't depend on
  // whether the tracker settled on half- or double-time.
  const diffScale = 0.6 + 0.08 * d;            // density: d1 0.68× … d10 1.4×
  const spacingScale = 1.5 - 0.1 * d;          // spacing: d1 1.4× … d10 0.5×
  const STAGE_GAP_S = deluxe ? [0.45, 0.3, 0.22, 0.16, 0.13] : [0.6, 0.4, 0.3, 0.22, 0.2];
  const minGapFor = (stage: number) => Math.max(0.1, STAGE_GAP_S[stage - 1] * spacingScale * 0.9);
  const slotDur = beatDur / 4;
  /** Coarsest grid step (in 16ths) that still respects the stage's spacing. */
  const stepSlots = (stage: number) => {
    for (const s of [1, 2, 4, 8]) if (s * slotDur >= minGapFor(stage) * 0.97) return s;
    return 8;
  };
  /** Notes per second at full activity, by stage (d = 5). */
  const PER_SEC = [0.9, 1.4, 1.9, 2.4, 2.7].map((x) => x * (deluxe ? 1.35 : 1));
  const allowOverlapHolds = (stage: number) => stage >= 4 || (stage === 3 && d >= 5);

  // ── Stage lookup + gap zones around boundaries ──
  const stageTimes = st.stageTimes;
  const stageOf = (t: number) => {
    for (let s = 5; s >= 1; s--) if (t >= stageTimes[s - 1] - 1e-6) return s;
    return 1;
  };
  const gaps: { from: number; to: number; stage: number; entrance: number }[] = [];
  for (let s = 2; s <= 5; s++) {
    const B = stageTimes[s - 1];
    const pov = POV_STAGES.has(s);
    const before = pov ? Math.max(1.0, 2 * beatDur) : Math.max(0.5, beatDur);
    // POV warp runs ~700 ms from the boundary — keep the highway clear through it
    const after = pov ? Math.ceil(0.9 / beatDur) * beatDur : 0;
    gaps.push({ from: B - before, to: B + after, stage: s, entrance: B + after });
  }
  const inGap = (t: number) => gaps.some((g) => t >= g.from && t < g.to);
  const nextGapStart = (t: number) => {
    let m = Infinity;
    for (const g of gaps) if (g.from > t && g.from < m) m = g.from;
    return m;
  };

  const tStart = Math.max(1.8, an.activeStart + 0.1);
  const tEnd = Math.min(input.duration, an.activeEnd) - 0.3;

  // ── Salience lookup ──
  const onsetAt = (list: OnsetEvent[], t: number, win: number) => {
    let lo = 0, hi = list.length - 1, best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid].time < t - win) lo = mid + 1; else hi = mid - 1;
    }
    for (let i = lo; i < list.length && list[i].time <= t + win; i++) best = Math.max(best, list[i].strength);
    return best;
  };
  const salience = (t: number): [number, number, number] => {
    const f = Math.round(t * fr);
    return [0, 1, 2].map((b) => {
      const peak = onsetAt(an.bandOnsets[b], t, 0.045);
      return peak > 0 ? Math.min(2, peak) : 0.35 * (an.bandFlux[b][f] ?? 0);
    }) as [number, number, number];
  };
  const combined = (s: [number, number, number]) => {
    const w = [s[0] * 1.0, s[1] * 0.95, s[2] * 0.8];
    const top = Math.max(...w);
    return top + 0.2 * (w[0] + w[1] + w[2] - top);
  };
  const centroidAt = (t: number) => {
    const f = Math.round(t * fr);
    let s = 0, n = 0;
    for (let j = f - 3; j <= f + 3; j++) if (j >= 0 && j < an.nFrames) { s += an.centroid[j]; n++; }
    return n ? s / n : 0;
  };

  // Song-wide accent threshold (top ~4% of grid salience)
  const allSal: number[] = [];
  for (const bar of st.bars) for (let s = 0; s < 16; s += 2) allSal.push(combined(salience(slotTime(bar, s))));
  allSal.sort((a, b) => a - b);
  const accentThreshold = allSal[Math.floor(allSal.length * 0.96)] ?? 1.2;

  // ── State ──
  const notes: Note[] = [];
  const holds: { lane: number; start: number; end: number }[] = [];
  const composed = new Map<number, TemplateNote[]>();
  const counts = {
    notes: [0, 0, 0, 0, 0, 0],
    hold: [0, 0, 0, 0, 0, 0],
    type: {} as Record<string, number[]>,
  };
  /** Per-stage quota for each special mechanic, as a share of the stage's notes. */
  const QUOTA: Partial<Record<NoteType, number>> = deluxe
    ? { slide: 0.08, 'hold-swipe': 0.05, swipe: 0.1, accent: 0.05, double: 0.1, lift: 0.05, zigzag: 0.04 }
    : { slide: 0.07, 'hold-swipe': 0.04, swipe: 0.08, accent: 0.05, double: 0.07 };
  /** Deluxe: short same-lane repeats (jacks, trills) are fair game late in the song. */
  const jacksOk = (stage: number) => deluxe && stage >= 4;
  const room = (type: NoteType, stage: number) =>
    ((counts.type[type] ?? [])[stage] ?? 0) < (QUOTA[type] ?? 0) * Math.max(12, counts.notes[stage]);
  const bump = (type: string, stage: number) => {
    (counts.type[type] ??= [0, 0, 0, 0, 0, 0])[stage]++;
  };
  let lastSwipe = -Infinity;

  const lastNoteBefore = (t: number, sameLane?: number) => {
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      if (n.time < t - 1e-6 && (sameLane === undefined || n.lane === sameLane)) return n;
    }
    return undefined;
  };

  const canPlace = (t: number, lane: number, stage: number, simultaneousOk = false): boolean => {
    if (t < tStart || t > tEnd || inGap(t)) return false;
    for (const h of holds) {
      if (t >= h.start - 0.02 && t <= h.end + 0.12) {
        if (h.lane === lane) return false;
        if (!allowOverlapHolds(stage)) return false;
      }
    }
    const minGap = minGapFor(stage);
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      if (t - n.time > 1.5) break;
      const dt = Math.abs(t - n.time);
      if (n.lane === lane && dt < (jacksOk(stage) ? 0.15 : 0.21)) return false;
      if (dt < 0.01) { if (!simultaneousOk) return false; continue; }
      if (dt < minGap) return false;
    }
    return true;
  };

  const chooseLane = (t: number, sal: [number, number, number], stage: number): number => {
    const prev = lastNoteBefore(t);
    const prev2 = prev ? lastNoteBefore(prev.time) : undefined;
    const maxSal = Math.max(...sal, 1e-6);
    const c = centroidAt(t);
    const cPrev = prev ? centroidAt(prev.time) : c;
    const contour = cPrev > 0 && c > 0 ? Math.log2(c / cPrev) : 0;
    let best = 1;
    let bestScore = -Infinity;
    for (let L = 0; L < 3; L++) {
      if (!canPlace(t, L, stage)) continue;
      let score = sal[L] / maxSal + rand() * 0.06;
      if (prev) {
        const dt = t - prev.time;
        if (contour > 0.15 && L > prev.lane) score += 0.4;
        if (contour < -0.15 && L < prev.lane) score += 0.4;
        if (Math.abs(contour) <= 0.15 && Math.abs(L - prev.lane) === 1) score += 0.1;
        if (L === prev.lane) {
          score -= (dt < 0.3 ? 0.7 : dt < 0.6 ? 0.25 : 0) * (jacksOk(stage) ? 0.4 : 1);
          if (prev2 && prev2.lane === L && t - prev2.time < 1.2) score -= jacksOk(stage) ? 0.6 : 1.5;
        }
        if (Math.abs(L - prev.lane) === 2 && dt < 0.25) score -= 0.35;
      }
      if (stage === 1 && L === 1) score += 0.05;
      if (score > bestScore) { bestScore = score; best = L; }
    }
    return bestScore === -Infinity ? -1 : best;
  };

  /**
   * How long the sustained (harmonic) layer rings from t: until the next
   * strong new note / chord change, or until it fades by ~8 dB. Percussion
   * is excluded by construction, so a sung note held over a busy drum part
   * still reads as a hold.
   */
  const hOn = an.harmonicOnsets.filter((h) => h.strength >= 1.0);
  const sustainAt = (t: number): number => {
    const e = an.harmonicEnergy;
    const f0 = Math.round(t * fr);
    let peak = 0;
    for (let j = f0; j <= f0 + 6 && j < an.nFrames; j++) peak = Math.max(peak, e[j]);
    const next = hOn.find((h) => h.time > t + 0.12)?.time ?? an.duration;
    let f = f0 + 1;
    while (f < an.nFrames && e[f] >= peak - 0.9 && f / fr < next) f++;
    return f / fr - t;
  };

  /** No other note anywhere on the highway while a zigzag would be held. */
  const zigzagClear = (t: number, len: number) =>
    !notes.some((n) => n.time > t - 0.2 && n.time < t + len + 0.25) &&
    !holds.some((h) => h.end > t - 0.2 && h.start < t + len + 0.25);

  const pushNote = (n: Omit<Note, 'id'>) => {
    const stage = n.stage ?? stageOf(n.time);
    notes.push({ ...n, id: 0, stage });
    notes.sort((a, b) => a.time - b.time);
    counts.notes[stage]++;
    if (n.holdDuration) {
      holds.push({ lane: n.lane, start: n.time, end: n.time + n.holdDuration });
      counts.hold[stage]++;
    }
    bump(n.type, stage);
  };

  /** Decide hold length (beats, quantised) for a note, or 0. */
  const holdFor = (t: number, lane: number, stage: number, barNotes: number[]): number => {
    if (!types[stage].has('hold')) return 0;
    if (counts.hold[stage] > 0.35 * Math.max(4, counts.notes[stage])) return 0;
    const sustain = sustainAt(t);
    const q = stage >= 4 ? 0.25 : 0.5;
    let beats = Math.floor(sustain / beatDur / q) * q;
    if (beats < 1) return 0;
    beats = Math.min(beats, d <= 3 ? 6 : 4);
    // Don't run into the next note on this lane, the next gap, or (when holds
    // are exclusive) the next note anywhere
    let limit = nextGapStart(t) - 0.15 - t;
    for (const nt of barNotes) {
      if (nt <= t + 1e-6) continue;
      limit = Math.min(limit, nt - t - (allowOverlapHolds(stage) ? 0 : 0.15));
    }
    for (const n of notes) {
      if (n.time > t && n.lane === lane) limit = Math.min(limit, n.time - t - 0.25);
    }
    const maxBeats = Math.floor(limit / beatDur / q) * q;
    beats = Math.min(beats, maxBeats);
    return beats >= 1 ? beats : 0;
  };

  // ── Compose bar by bar ──
  for (const bar of st.bars) {
    const stage = stageOf(bar.start + 1e-3);
    const sIdx = stage - 1;
    const stageStart = stageTimes[sIdx];
    const stageEnd = stageTimes[stage];
    const progress = Math.max(0, Math.min(1, (bar.start - stageStart) / Math.max(1, stageEnd - stageStart)));
    const silent = bar.activity < 0.06 && bar.energy < 0.08;
    const ramp = 0.85 + 0.3 * progress;
    const barSec = bar.end - bar.start;
    const raw = PER_SEC[sIdx] * barSec * diffScale * ramp * (0.3 + 0.7 * Math.pow(bar.activity, 0.7));
    const dither = (bar.index * 0.6180339887) % 1;
    const budget = silent ? 0 : Math.max(1, Math.floor(raw + dither));

    const step = stepSlots(stage);
    const template = bar.repeatOf >= 0 ? composed.get(bar.repeatOf) : undefined;
    const templateStage = bar.repeatOf >= 0 ? stageOf(st.bars[bar.repeatOf].start + 1e-3) : stage;
    const placed: TemplateNote[] = [];

    // Candidate slots for this bar
    const candidates: { slot: number; t: number; sal: [number, number, number]; score: number }[] = [];
    for (let s = 0; s < 16; s += step) {
      const t = slotTime(bar, s);
      const sal = salience(t);
      const score = combined(sal) * (0.65 + 0.35 * METRIC[s]);
      candidates.push({ slot: s, t, sal, score });
    }

    // Pick the rhythm: template first (learnable repeats), then fresh slots
    const chosen: { slot: number; t: number; sal: [number, number, number]; tpl?: TemplateNote }[] = [];
    if (template) {
      for (const tn of template) {
        const c = candidates.find((x) => x.slot === tn.slot) ?? (() => {
          const t = slotTime(bar, tn.slot);
          return { slot: tn.slot, t, sal: salience(t), score: 0 };
        })();
        chosen.push({ slot: c.slot, t: c.t, sal: c.sal, tpl: tn });
      }
    }
    // Deluxe embellishes every return of a section, not only harder ones
    const embellish = !template || stage > templateStage || deluxe;
    if (embellish) {
      const ranked = candidates
        .filter((c) => !chosen.some((x) => x.slot === c.slot))
        .sort((a, b) => b.score - a.score);
      for (const c of ranked) {
        if (chosen.length >= budget) break;
        if (c.score < 0.18) break;
        const tooClose = chosen.some((x) => Math.abs(x.t - c.t) < minGapFor(stage) - 1e-6);
        if (tooClose) continue;
        chosen.push({ slot: c.slot, t: c.t, sal: c.sal });
      }
    }
    chosen.sort((a, b) => a.t - b.t);
    const barTimes = chosen.map((c) => c.t);

    for (const c of chosen) {
      let lane = c.tpl ? c.tpl.lane : chooseLane(c.t, c.sal, stage);
      if (lane < 0) continue;
      if (!canPlace(c.t, lane, stage)) {
        lane = chooseLane(c.t, c.sal, stage);
        if (lane < 0) continue;
      }

      let type: NoteType = 'tap';
      let holdBeats = 0;
      let targetLane: number | undefined;
      let swipeDirection: SwipeDir | undefined;

      if (c.tpl) {
        type = gateType(c.tpl.type, stage, types);
        holdBeats = type === 'hold' || type === 'slide' || type === 'hold-swipe' || type === 'zigzag' ? (c.tpl.holdBeats ?? 0) : 0;
        if (type === 'slide' || type === 'zigzag') targetLane = c.tpl.targetLane;
        if (type === 'zigzag' && !zigzagClear(c.t, holdBeats * beatDur)) { type = 'hold'; targetLane = undefined; }
        if (type === 'swipe' || type === 'hold-swipe') swipeDirection = c.tpl.swipeDirection;
        // Re-validate the template hold against the current context
        if (holdBeats > 0) {
          const maxH = holdFor(c.t, lane, stage, barTimes);
          if (maxH < 1) { type = 'tap'; holdBeats = 0; targetLane = undefined; swipeDirection = undefined; }
          else holdBeats = Math.min(holdBeats, maxH);
        }
      } else {
        holdBeats = holdFor(c.t, lane, stage, barTimes);
        if (holdBeats > 0) {
          type = 'hold';
          const ok = types[stage];
          const endT = c.t + holdBeats * beatDur;
          // Pitch glide → slide toward the direction the melody moves
          const glide = Math.log2((centroidAt(endT - 0.05) || 1) / (centroidAt(c.t + 0.05) || 1));
          if (ok.has('slide') && room('slide', stage) && Math.abs(glide) > 0.4) {
            const tl = lane + (glide > 0 ? 1 : -1);
            if (tl >= 0 && tl <= 2 && canPlace(c.t, tl, stage)) { type = 'slide'; targetLane = tl; }
          }
          // Deluxe: a long outer-lane hold over a wobbling melody → zigzag across the highway
          if (
            type === 'hold' && ok.has('zigzag') && room('zigzag', stage) && lane !== 1 &&
            holdBeats >= 2 && Math.abs(glide) <= 0.4 && zigzagClear(c.t, holdBeats * beatDur)
          ) {
            type = 'zigzag';
            targetLane = 2 - lane;
          }
          // Hold released on a hit → hold-swipe (flick out on the accent)
          if (type === 'hold' && ok.has('hold-swipe') && room('hold-swipe', stage)) {
            const release = combined(salience(endT));
            if (release > 1.0) {
              type = 'hold-swipe';
              swipeDirection = deluxe ? swipeDirFor(lane, Math.log2((centroidAt(endT + 0.05) || 1) / (centroidAt(endT - 0.1) || 1))) : LANE_DIR[lane];
            }
          }
        } else {
          const ok = types[stage];
          const sc = combined(c.sal);
          const prev = lastNoteBefore(c.t);
          const contour = prev ? Math.log2((centroidAt(c.t) || 1) / (centroidAt(prev.time) || 1)) : 0;
          if (ok.has('accent') && room('accent', stage) && (c.slot === 0 || c.slot === 8) && sc >= accentThreshold) {
            type = 'accent';
          } else if (
            ok.has('swipe') && room('swipe', stage) && c.t - lastSwipe > 1.5 * beatDur && sc > 0.7 &&
            ((c.slot === 0 && (!prev || c.t - prev.time >= beatDur)) ||
             (c.slot >= 12 && (bar.index % 4) === 3 && c === chosen[chosen.length - 1]))
          ) {
            type = 'swipe';
            swipeDirection = deluxe ? swipeDirFor(lane, contour) : LANE_DIR[lane];
            lastSwipe = c.t;
          } else if (ok.has('lift') && room('lift', stage) && contour > 0.35 && sc > 0.6) {
            // Deluxe: the melody jumps up → flick the note up and away
            type = 'lift';
          }
        }
      }

      const holdDuration = holdBeats > 0 ? +(holdBeats * beatDur).toFixed(3) : undefined;
      pushNote({
        time: +c.t.toFixed(3),
        lane,
        type,
        ...(holdDuration ? { holdDuration } : {}),
        ...(targetLane !== undefined ? { targetLane } : {}),
        ...(swipeDirection ? { swipeDirection } : {}),
        ...(type === 'zigzag' ? { zigzagAmplitude: 1.2 } : {}),
        ...(type === 'lift' ? { releaseWindowBonusMs: 20 } : {}),
        stage,
      });
      if (type === 'zigzag' && holdDuration) {
        // A zigzag sweeps the whole highway, so it blocks every lane while held
        for (const L of [0, 1, 2]) if (L !== lane) holds.push({ lane: L, start: c.t, end: c.t + holdDuration });
      }
      placed.push({ slot: c.slot, lane, type, holdBeats: holdBeats || undefined, targetLane, swipeDirection });

      // Doubles: strong kick + strong top on a main beat in stages 4–5 (3–5 in Deluxe)
      if (
        stage >= (deluxe ? 3 : 4) && d >= 3 && type === 'tap' && (c.slot === 0 || c.slot === 8) &&
        c.sal[0] >= 0.7 && c.sal[2] >= 0.6 && room('double', stage)
      ) {
        const partner = lane === 0 ? 2 : lane === 2 ? 0 : (c.sal[0] >= c.sal[2] ? 0 : 2);
        if (canPlace(c.t, partner, stage, true)) {
          pushNote({ time: +c.t.toFixed(3), lane: partner, type: 'tap', stage });
          bump('double', stage);
        }
      }
    }
    if (!template) composed.set(bar.index, placed);
    else if (embellish) composed.set(bar.index, placed);
  }

  // ── POV entrances: guarantee a clear landing hit after each warp ──
  for (const g of gaps) {
    if (!POV_STAGES.has(g.stage)) continue;
    const first = notes.find((n) => n.time >= g.to - 1e-6);
    if (first && first.time - g.entrance <= beatDur + 1e-3) {
      if (first.type === 'tap') { first.type = 'accent'; bump('accent', g.stage); }
      continue;
    }
    const t = +g.entrance.toFixed(3);
    if (canPlace(t, 1, g.stage)) pushNote({ time: t, lane: 1, type: 'accent', stage: g.stage });
  }

  if (deluxe) addDeluxeSpecials();

  notes.sort((a, b) => a.time - b.time || a.lane - b.lane);
  return notes.map((n, i) => ({ ...n, id: i }));

  // ── Deluxe passes: breaks on the drops, remixes on section starts, mines ──
  function addDeluxeSpecials() {
    const taps = (from: number, to: number) => notes.filter((n) => n.time >= from && n.time < to && n.type === 'tap');
    const dropBars = st.bars
      .map((bar, i) => ({ bar, jump: i > 0 ? bar.energy - st.bars[i - 1].energy : 0 }))
      .filter((x) => x.jump > 0);

    for (let stage = 3; stage <= 5; stage++) {
      const from = stageTimes[stage - 1];
      const to = stageTimes[stage];

      // Break: a two-lane hit on the downbeat of the stage's biggest drop
      if (types[stage].has('break')) {
        const drops = dropBars.filter((x) => x.bar.start >= from && x.bar.start < to).sort((p, q) => q.jump - p.jump);
        for (const { bar } of drops) {
          const head = notes.find((n) => n.type === 'tap' && Math.abs(n.time - bar.start) < 0.01);
          if (!head || head.lane === 1) continue;
          const partner = 2 - head.lane;
          const twin = notes.find((n) => Math.abs(n.time - head.time) < 0.01 && n.lane === partner);
          if (twin && twin.type !== 'tap') continue;
          head.type = 'break';
          if (twin) twin.type = 'break';
          else if (canPlace(head.time, partner, stage, true)) pushNote({ time: head.time, lane: partner, type: 'break', stage });
          break;
        }
      }

      // Remix: one per stage from 4, where a repeated section starts
      if (types[stage].has('remix')) {
        const starts = st.bars.filter((bar, i) =>
          bar.start >= from && bar.start < to - 6 && bar.repeatOf >= 0 && (i === 0 || st.bars[i - 1].repeatOf < 0));
        const bar = starts[0] ?? st.bars.find((x) => x.start >= from + 2 && x.start < to - 6 && x.activity > 0.3);
        // A lone tap, so the remix never shares its moment with another note
        const head = bar && taps(bar.start - 0.01, bar.end)
          .find((n) => !notes.some((m) => m !== n && Math.abs(m.time - n.time) < 0.01));
        if (head) {
          head.type = 'remix';
          head.remixEffect = remixEffectAt(head.time);
        }
      }

      // Mines: on a lane the music isn't using, clear of every note in that lane
      if (types[stage].has('mine')) {
        const share = stage === 3 ? 0.04 : 0.06;
        const stageNotes = notes.filter((n) => n.stage === stage && n.type !== 'mine');
        const want = Math.round(share * stageNotes.length);
        const every = Math.max(2, Math.floor(stageNotes.length / Math.max(1, want)));
        let placedMines = 0;
        for (let i = Math.floor(every / 2); i < stageNotes.length && placedMines < want; i += every) {
          const t = stageNotes[i].time;
          if (inGap(t) || t < tStart || t > tEnd) continue;
          const sal = salience(t);
          const lanes = [0, 1, 2]
            .filter((L) => mineClear(t, L))
            .sort((p, q) => sal[p] - sal[q]);
          if (!lanes.length) continue;
          pushNote({ time: +t.toFixed(3), lane: lanes[0], type: 'mine', stage });
          placedMines++;
        }
      }
    }
  }

  function mineClear(t: number, lane: number) {
    if (notes.some((n) => n.lane === lane && Math.abs(n.time - t) < 0.25)) return false;
    return !holds.some((h) => h.lane === lane && t >= h.start - 0.25 && t <= h.end + 0.25);
  }

  function remixEffectAt(t: number): NonNullable<Note['remixEffect']> {
    const f = Math.round(t * fr);
    const e = an.harmonicEnergy;
    let below = 0;
    for (let j = 0; j < an.nFrames; j += 8) if (e[j] < e[f]) below++;
    // Mostly drums with little harmony → mute the drums for a moment
    if (below / Math.max(1, Math.ceil(an.nFrames / 8)) < 0.25) return 'drums_mute';
    const sal = salience(t);
    const top = sal.indexOf(Math.max(...sal));
    return top === 0 ? 'bass_boost' : top === 1 ? 'vocals_isolate' : 'lead_solo';
  }
}

/** Time of 16th-note slot s (0..15) inside a bar, following the tracked beats. */
function slotTime(bar: Bar, s: number): number {
  const beat = Math.floor(s / 4);
  const t0 = bar.beats[beat];
  const t1 = bar.beats[beat + 1] ?? bar.end;
  return t0 + ((t1 - t0) * (s % 4)) / 4;
}
