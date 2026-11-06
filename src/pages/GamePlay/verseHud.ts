// Stanza + Oracle HUD logic (rendered by GameplayCore, styled in src/styles/gameplayHud.css).
//
// Stanza: the lyric line being sung sits above the highway and inks letter by
// letter as it is sung. Each letter takes the colour of your latest judgment
// at that moment: the combo tier's ink after a hit, struck through after a
// miss. Lines follow the song's lyric timestamps, not the chart, so the same
// code works for any chart version or density (standard, Deluxe, v1–v6).
// Intros, instrumental gaps and songs without lyrics show the song title.
//
// Oracle: one short whisper under the line, picked by priority from what the
// player needs right now (a miss, healing, the next multiplier, a stage change,
// a lane drifting early or late), plus a timing tick per lane. Silent in flow.
//
// Everything here writes to the DOM directly from the game loop, like the other
// high-frequency HUD readouts, so the 13k-line component never re-renders for it.

import type { Note } from '@/game/types';
import type { TimedLine } from './trackLyrics';

export interface VerseLine {
  text: string;
  start: number;
  end: number;
  /** When each character is sung (s). */
  times: number[];
  filler: boolean;
}

interface NoteLike {
  note: Note;
  hit: boolean;
  missed: boolean;
  holdActive: boolean;
}

// Notes that never colour a letter.
const UNINKED = new Set(['mine', 'break', 'warp', 'warp-clear']);
// A gap between lyric lines longer than this shows the title.
const GAP_FOR_TITLE = 4;
const MULT_STEPS = [25, 50, 75, 100];
const MULT_COLORS = ['#71717a', '#00E5FF', '#39FF14', '#FFD700', '#FF1493', '#FF3800'];
const STAGE_COLORS = ['#00E5FF', '#39FF14', '#FFD700', '#FF1493', '#FF3800'];
const LANE_NAMES = ['LEFT', 'MIDDLE', 'RIGHT'];
// Mean hit offset (s) that counts as a lane drifting, and hits needed to judge it.
const DRIFT_S = 0.022;
const DRIFT_SAMPLES = 6;
const WHISPER_HOLD_MS = 2000;

export function comboInk(combo: number): string {
  return combo >= 100 ? '#39FF14' : combo >= 50 ? '#FF1493' : combo > 0 ? '#00E5FF' : '#f4f4f5';
}

/** Spread a string's characters evenly over [a, b). */
function spread(text: string, a: number, b: number): number[] {
  const n = Math.max(1, text.length);
  return [...text].map((_, i) => a + ((b - a) * i) / n);
}

/** Lines to show across the song: lyric lines, with the title over long gaps (or per stage when there are no lyrics). */
export function buildVerseLines(lyrics: TimedLine[], title: string, stageStarts: number[], duration: number): VerseLine[] {
  const dur = duration > 0 ? duration : 180;
  const name = (title || 'PIM').trim();
  const out: VerseLine[] = [];
  // The title inks over its gap (up to 6s), so it doubles as a lead-in to the vocals.
  const filler = (start: number, end: number) => {
    const a = Number.isFinite(start) ? start : 0;
    const b = Math.min(Number.isFinite(end) ? end : dur, a + 6);
    out.push({ text: name, start, end, times: spread(name, a, Math.max(a + 1, b)), filler: true });
  };
  if (!lyrics.length) {
    const starts = stageStarts.length ? stageStarts : [0];
    starts.forEach((s, i) => filler(i === 0 ? -Infinity : s, starts[i + 1] ?? Infinity));
    return out;
  }
  let cursor = -Infinity;
  lyrics.forEach((l, i) => {
    const words = l.words.filter((w) => w.text.trim());
    if (!words.length) return;
    if (l.start - (Number.isFinite(cursor) ? cursor : 0) > GAP_FOR_TITLE) filler(cursor, l.start);
    const end = Math.min(l.end, lyrics[i + 1]?.start ?? Infinity);
    let text = '';
    const times: number[] = [];
    words.forEach((w, wi) => {
      const word = w.text.trim();
      if (wi > 0) {
        text += ' ';
        times.push(w.start);
      }
      text += word;
      times.push(...spread(word, w.start, Math.max(w.start + 0.05, w.end)));
    });
    // The first line reaches back to the start of the song.
    out.push({ text, start: out.length ? l.start : -Infinity, end, times, filler: false });
    cursor = end;
  });
  if (dur - cursor > GAP_FOR_TITLE) filler(cursor, Infinity);
  else if (out.length) out[out.length - 1].end = Infinity;
  return out;
}

export interface VerseEls {
  root: HTMLElement | null;
  prev: HTMLElement | null;
  text: HTMLElement | null;
  whisper: HTMLElement | null;
  whisperMain: HTMLElement | null;
  whisperSub: HTMLElement | null;
  ticks: (HTMLElement | null)[];
}

export interface VerseFrame {
  t: number;
  combo: number;
  baseMult: number;
  shieldLeft: number;
  /** 0–1 heal gauge, and whether a hold is filling it right now. */
  heal: number;
  healing: boolean;
  misses: number;
  stage: number;
  stageStarts: number[];
  bpm: number;
  /** Recent hit telemetry: offset is hit time minus note time (s). */
  telemetry: { judgment: string; offset: number; lane: number }[];
  oracle: boolean;
}

interface Whisper {
  key: string;
  main: string;
  sub: string;
  color: string;
  urgent?: boolean;
}

// Same as the .pim-verse-enter / .pim-orc-in keyframes in gameplayHud.css
// (the empty end keyframe animates to the element's own computed values).
const VERSE_ENTER: Keyframe[] = [{ opacity: 0, filter: 'blur(3px)', transform: 'translateY(4px)' }, {}];
const ORC_IN: Keyframe[] = [{ opacity: 0, letterSpacing: '0.5em', filter: 'blur(3px)' }, {}];
let reducedMotionMq: MediaQueryList | null | undefined;
function prefersReducedMotion(): boolean {
  if (reducedMotionMq === undefined) {
    reducedMotionMq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  }
  return !!reducedMotionMq?.matches;
}

export class VerseHud {
  els: VerseEls = { root: null, prev: null, text: null, whisper: null, whisperMain: null, whisperSub: null, ticks: [] };
  private lines: VerseLine[] = [];
  private sourceKey = '';
  private lineIdx = -1;
  private spans: HTMLSpanElement[] = [];
  /** Span index of each letter (spaces carry no ink). */
  private letters: number[] = [];
  private lastMisses = 0;
  private lastMissT = -99;
  private lastShield = 3;
  private restoredT = -99;
  private lastCombo = 0;
  private crossedAt = -99;
  private crossedMult = 1;
  private whisperKey = '';
  private whisperSince = 0;
  private lastFrame = 0;
  private lastT = 0;
  private states: NoteLike[] = [];
  private statesLen = 0;
  /** Indices of letter-colouring notes, by time. */
  private order: number[] = [];
  private srcLyrics: TimedLine[] | null = null;
  private srcTitle = '';
  private srcStages: number[] | null = null;
  private srcStagesLen = -1;
  private srcDuration = -1;
  private lastInk = '';
  private inkEl: HTMLElement | null = null;
  private tickO: string[] = [];
  private tickEls: (HTMLElement | null)[] = [];

  /** Replay an entrance with the Web Animations API: no class toggle, no forced reflow. */
  private replay(el: HTMLElement, frames: Keyframe[], duration: number) {
    if (prefersReducedMotion() || typeof el.animate !== 'function') return;
    el.getAnimations().forEach((a) => a.cancel());
    el.animate(frames, { duration, easing: 'ease-out' });
  }

  setSource(lyrics: TimedLine[], states: NoteLike[], title: string, stageStarts: number[], duration: number) {
    // PERF: called every frame; skip the key string (and its join) when nothing changed.
    const same =
      lyrics === this.srcLyrics &&
      title === this.srcTitle &&
      stageStarts === this.srcStages &&
      stageStarts.length === this.srcStagesLen &&
      duration === this.srcDuration;
    const key = same ? this.sourceKey : `${lyrics.length}|${title}|${stageStarts.join(',')}|${duration}`;
    this.srcLyrics = lyrics;
    this.srcTitle = title;
    this.srcStages = stageStarts;
    this.srcStagesLen = stageStarts.length;
    this.srcDuration = duration;
    if (key !== this.sourceKey) {
      this.sourceKey = key;
      this.lines = buildVerseLines(lyrics, title, stageStarts, duration);
      this.lineIdx = -1;
    }
    // The note-state array is rebuilt on load, restart and chart swaps.
    if (states !== this.states || states.length !== this.statesLen) {
      this.states = states;
      this.statesLen = states.length;
      this.order = states
        .map((_, i) => i)
        .filter((i) => !UNINKED.has(states[i].note.type))
        .sort((a, b) => states[a].note.time - states[b].note.time);
    }
  }

  /** 'in' / 'x' for the latest judged note at or before time T, or '' if none yet. */
  private judgedAt(T: number): '' | 'in' | 'x' {
    const { order, states } = this;
    let lo = 0;
    let hi = order.length - 1;
    let at = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (states[order[mid]].note.time <= T) {
        at = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    // Step back past notes still inside their hit window or mid-hold.
    for (let k = at; k >= 0 && k > at - 12; k--) {
      const s = states[order[k]];
      if (s.missed) return 'x';
      if (s.hit && !s.holdActive) return 'in';
    }
    return '';
  }

  /** New attempt (restart / rewind): forget per-run memory. */
  reset() {
    this.lastMisses = 0;
    this.lastMissT = -99;
    this.lastShield = 3;
    this.restoredT = -99;
    this.lastCombo = 0;
    this.crossedAt = -99;
    this.whisperKey = '';
    this.lineIdx = -1;
    this.lastT = 0;
  }

  update(f: VerseFrame) {
    const now = performance.now();
    if (now - this.lastFrame < 33) return;
    this.lastFrame = now;
    if (!this.els.root || !this.els.text || !this.lines.length) return;
    this.track(f);
    this.drawLine(f);
    if (f.oracle) this.drawOracle(f, now);
  }

  // Remember the moments the whisper reacts to.
  private track(f: VerseFrame) {
    // The clock jumped back: restart or rewind.
    if (f.t < this.lastT - 1) this.reset();
    this.lastT = f.t;
    if (f.misses > this.lastMisses) this.lastMissT = f.t;
    this.lastMisses = f.misses;
    if (f.shieldLeft > this.lastShield) this.restoredT = f.t;
    this.lastShield = f.shieldLeft;
    const step = MULT_STEPS.find((s) => this.lastCombo < s && f.combo >= s);
    if (step) {
      this.crossedAt = f.t;
      this.crossedMult = f.baseMult;
    }
    this.lastCombo = f.combo;
  }

  private drawLine(f: VerseFrame) {
    let idx = this.lineIdx;
    if (idx < 0 || f.t < this.lines[idx].start || f.t >= this.lines[idx].end) {
      idx = this.lines.findIndex((l) => f.t >= l.start && f.t < l.end);
      if (idx < 0) idx = 0;
    }
    const line = this.lines[idx];
    const textEl = this.els.text!;
    if (idx !== this.lineIdx) {
      this.lineIdx = idx;
      this.spans = [];
      this.letters = [];
      // PERF: build the letters off-DOM and swap them in with one mutation.
      const frag = document.createDocumentFragment();
      for (const ch of line.text) {
        const s = document.createElement('span');
        s.textContent = ch === ' ' ? ' ' : ch;
        if (ch !== ' ') this.letters.push(this.spans.length);
        this.spans.push(s);
        frag.appendChild(s);
      }
      textEl.replaceChildren(frag);
      this.els.root!.style.setProperty('--len', String(line.text.length + 4));
      this.els.root!.dataset.filler = String(line.filler);
      // Retrigger the line's entrance (was a class toggle + offsetWidth read, which forced a
      // synchronous layout mid-frame on every line change).
      this.replay(textEl, VERSE_ENTER, 350);
      if (this.els.prev) {
        const before = this.lines[idx - 1];
        this.els.prev.textContent = before && !before.filler ? before.text : ' ';
      }
    }
    // PERF: only touch the root's custom property when it changes (it restyles the whole HUD).
    const ink = comboInk(f.combo);
    if (ink !== this.lastInk || this.inkEl !== this.els.root) {
      this.lastInk = ink;
      this.inkEl = this.els.root;
      this.els.root!.style.setProperty('--ink', ink);
    }

    for (const i of this.letters) {
      const T = line.times[i];
      const cls = f.t < T ? '' : this.judgedAt(T) || 'sung';
      const span = this.spans[i];
      if (span.className !== cls) span.className = cls;
    }
  }

  private pickWhisper(f: VerseFrame, drift: (number | null)[]): Whisper | null {
    if (f.t - this.lastMissT < 2.4) {
      return {
        key: 'miss',
        main: `MISSED · SHIELD ${f.shieldLeft}/3`,
        sub: f.shieldLeft <= 1 ? 'one more and the signal drops' : 'hold a long note to win it back',
        color: '#FF1493',
        urgent: true,
      };
    }
    if (f.t - this.restoredT < 2.2) return { key: 'restored', main: 'SHIELD RESTORED', sub: `${f.shieldLeft}/3 and holding`, color: '#39FF14' };
    if (f.shieldLeft < 3 && (f.healing || f.heal > 0.05)) {
      return {
        key: 'heal',
        main: `${f.healing ? 'HEALING' : 'HOLD A LONG NOTE TO HEAL'} · ${Math.round(f.heal * 100)}%`,
        sub: f.healing ? 'keep holding' : 'the shield mends on holds',
        color: f.healing ? '#00E5FF' : '#FFD700',
      };
    }
    if (f.t - this.crossedAt < 2) {
      return { key: 'mult', main: `×${this.crossedMult} MULTIPLIER`, sub: `every note is worth ${this.crossedMult}× now`, color: MULT_COLORS[this.crossedMult] };
    }
    const next = MULT_STEPS.find((s) => s > f.combo);
    if (next && f.combo > 0 && next - f.combo <= 8) {
      return { key: 'next', main: `${next - f.combo} TO ×${f.baseMult + 1}`, sub: 'keep the chain', color: MULT_COLORS[f.baseMult + 1] };
    }
    const nextStart = f.stageStarts[f.stage];
    if (nextStart !== undefined && f.bpm > 0) {
      const bars = Math.ceil((nextStart - f.t) / ((60 / f.bpm) * 4));
      if (bars > 0 && bars <= 4) {
        return {
          key: 'stage',
          main: `${f.stage + 1 === 5 ? 'FINAL STAGE' : `STAGE ${f.stage + 1}`} IN ${bars} BAR${bars > 1 ? 'S' : ''}`,
          sub: 'it gets denser from here',
          color: STAGE_COLORS[f.stage] ?? '#fff',
        };
      }
    }
    let worst = -1;
    drift.forEach((d, i) => {
      if (d !== null && Math.abs(d) >= DRIFT_S && (worst < 0 || Math.abs(d) > Math.abs(drift[worst]!))) worst = i;
    });
    if (worst >= 0) {
      const d = drift[worst]!;
      return {
        key: `drift${worst}`,
        main: `${LANE_NAMES[worst] ?? 'LANE'} LANE ${d > 0 ? 'LATE' : 'EARLY'} · ${Math.round(Math.abs(d) * 1000)}ms`,
        sub: d > 0 ? 'hit it a hair sooner' : 'let it come to you',
        color: '#00E5FF',
      };
    }
    return null;
  }

  private drawOracle(f: VerseFrame, now: number) {
    const el = this.els.whisper;
    const drift = laneDrift(f.telemetry);
    if (el && this.els.whisperMain && this.els.whisperSub) {
      const w = this.pickWhisper(f, drift);
      const key = w?.key ?? '';
      if (key !== this.whisperKey && (w?.urgent || now - this.whisperSince > WHISPER_HOLD_MS || !this.whisperKey)) {
        this.whisperKey = key;
        this.whisperSince = now;
        if (w) this.replay(el, ORC_IN, 450);
        el.dataset.on = String(!!w);
        this.els.root!.dataset.calm = String(!w);
      }
      if (w && key === this.whisperKey) {
        if (this.els.whisperMain.textContent !== w.main) this.els.whisperMain.textContent = w.main;
        if (this.els.whisperSub.textContent !== w.sub) this.els.whisperSub.textContent = w.sub;
        if (el.style.getPropertyValue('--wc') !== w.color) el.style.setProperty('--wc', w.color);
      }
    }
    this.els.ticks.forEach((tick, lane) => {
      if (!tick) return;
      const d = drift[lane];
      const ms = d === null ? 0 : Math.round(d * 1000);
      // ±60ms spans the whole tick. PERF: write styles/data only when they change.
      const o = String(Math.max(-1, Math.min(1, ms / 60)));
      if (this.tickO[lane] !== o || this.tickEls[lane] !== tick) {
        this.tickO[lane] = o;
        this.tickEls[lane] = tick;
        tick.style.setProperty('--o', o);
      }
      const on = String(d !== null);
      if (tick.dataset.on !== on) tick.dataset.on = on;
      const dr = String(d !== null && Math.abs(d) >= DRIFT_S);
      if (tick.dataset.drift !== dr) tick.dataset.drift = dr;
      const label = tick.lastElementChild as HTMLElement | null;
      if (label) {
        const txt = d === null ? '' : Math.abs(ms) < 6 ? 'ON TIME' : `${ms > 0 ? 'LATE' : 'EARLY'} ${Math.abs(ms)}ms`;
        if (label.textContent !== txt) label.textContent = txt;
      }
    });
  }
}

/** Mean hit offset (s) per lane over its recent hits; null until there are enough. */
export function laneDrift(telemetry: { judgment: string; offset: number; lane: number }[]): (number | null)[] {
  const sums = [0, 0, 0];
  const counts = [0, 0, 0];
  for (let i = telemetry.length - 1; i >= 0 && counts.some((c) => c < 12); i--) {
    const e = telemetry[i];
    if (e.judgment === 'MISS' || e.judgment === 'SHIELDED' || !Number.isFinite(e.offset) || Math.abs(e.offset) > 0.2) continue;
    const l = e.lane;
    if (l < 0 || l > 2 || counts[l] >= 12) continue;
    sums[l] += e.offset;
    counts[l]++;
  }
  return sums.map((s, i) => (counts[i] >= DRIFT_SAMPLES ? s / counts[i] : null));
}
