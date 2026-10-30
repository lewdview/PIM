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

  setSource(lyrics: TimedLine[], states: NoteLike[], title: string, stageStarts: number[], duration: number) {
    const key = `${lyrics.length}|${title}|${stageStarts.join(',')}|${duration}`;
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
      textEl.textContent = '';
      this.spans = [];
      this.letters = [];
      for (const ch of line.text) {
        const s = document.createElement('span');
        s.textContent = ch === ' ' ? ' ' : ch;
        if (ch !== ' ') this.letters.push(this.spans.length);
        this.spans.push(s);
        textEl.appendChild(s);
      }
      this.els.root!.style.setProperty('--len', String(line.text.length + 4));
      this.els.root!.dataset.filler = String(line.filler);
      // Retrigger the line's entrance.
      textEl.classList.remove('pim-verse-enter');
      void textEl.offsetWidth;
      textEl.classList.add('pim-verse-enter');
      if (this.els.prev) {
        const before = this.lines[idx - 1];
        this.els.prev.textContent = before && !before.filler ? before.text : ' ';
      }
    }
    this.els.root!.style.setProperty('--ink', comboInk(f.combo));

    for (const i of this.letters) {
      const T = line.times[i];
      const cls = f.t < T ? '' : this.judgedAt(T) || 'sung';
      const span = this.spans[i];
      if (span.className !== cls) span.className = cls;
    }
  }

  private pickWhisper(f: VerseFrame): Whisper | null {
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
    const drift = laneDrift(f.telemetry);
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
    if (el && this.els.whisperMain && this.els.whisperSub) {
      const w = this.pickWhisper(f);
      const key = w?.key ?? '';
      if (key !== this.whisperKey && (w?.urgent || now - this.whisperSince > WHISPER_HOLD_MS || !this.whisperKey)) {
        this.whisperKey = key;
        this.whisperSince = now;
        if (w) {
          el.classList.remove('pim-orc-in');
          void el.offsetWidth;
          el.classList.add('pim-orc-in');
        }
        el.dataset.on = String(!!w);
        this.els.root!.dataset.calm = String(!w);
      }
      if (w && key === this.whisperKey) {
        if (this.els.whisperMain.textContent !== w.main) this.els.whisperMain.textContent = w.main;
        if (this.els.whisperSub.textContent !== w.sub) this.els.whisperSub.textContent = w.sub;
        el.style.setProperty('--wc', w.color);
      }
    }
    const drift = laneDrift(f.telemetry);
    this.els.ticks.forEach((tick, lane) => {
      if (!tick) return;
      const d = drift[lane];
      const ms = d === null ? 0 : Math.round(d * 1000);
      // ±60ms spans the whole tick.
      tick.style.setProperty('--o', String(Math.max(-1, Math.min(1, ms / 60))));
      tick.dataset.on = String(d !== null);
      tick.dataset.drift = String(d !== null && Math.abs(d) >= DRIFT_S);
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
