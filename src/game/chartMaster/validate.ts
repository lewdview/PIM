/**
 * Chart Master — structural checks for a generated chart. Returns a list of
 * human-readable problems (empty = valid). Used by the bake script so a bad
 * chart fails loudly instead of shipping.
 */

import type { Note } from '../types.ts';
import type { AudioAnalysis } from './analysis.ts';
import type { ChartStage } from './index.ts';

export function validateChart(notes: Note[], stages: ChartStage[], duration: number): string[] {
  const issues: string[] = [];
  if (stages.length !== 5) issues.push(`expected 5 stages, got ${stages.length}`);
  for (let i = 1; i < stages.length; i++) {
    if (!(stages[i].startTime > stages[i - 1].startTime)) issues.push(`stage ${i + 1} does not start after stage ${i}`);
  }
  const stageAt = (t: number) => {
    let s = 1;
    for (const st of stages) if (t >= st.startTime - 1e-3) s = st.stage;
    return s;
  };

  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (i > 0 && n.time < notes[i - 1].time) issues.push(`notes not sorted at #${i}`);
    if (n.lane < 0 || n.lane > 2) issues.push(`#${i} bad lane ${n.lane}`);
    if (n.time < 1 || n.time > duration) issues.push(`#${i} time ${n.time} outside song`);
    if (n.stage !== stageAt(n.time)) issues.push(`#${i} stage ${n.stage} ≠ timeline stage ${stageAt(n.time)} at ${n.time}`);
    if (n.holdDuration) {
      const end = n.time + n.holdDuration;
      if (end > duration) issues.push(`#${i} hold runs past song end`);
      for (let j = i + 1; j < notes.length && notes[j].time <= end; j++) {
        if (notes[j].lane === n.lane) issues.push(`#${j} lands inside hold #${i} on lane ${n.lane}`);
      }
    }
    if (n.stage === 1 && n.type !== 'tap') issues.push(`#${i} ${n.type} in stage 1`);
  }

  // POV runways (stage 3 and 5 starts) must be clear
  for (const s of [3, 5]) {
    const B = stages[s - 1]?.startTime;
    if (B === undefined) continue;
    const blocked = notes.filter((n) => n.time > B - 0.9 && n.time < B + 0.85);
    if (blocked.length) issues.push(`${blocked.length} note(s) inside the stage ${s} POV runway`);
  }
  return issues;
}

/**
 * Share of notes (0..1) landing within 35 ms of a strong onset (≥ the band's
 * 95th percentile) in any band. Charts that ignore the audio score close to
 * `randomBaseline`, i.e. what uniformly placed notes would get.
 */
export function measureSync(an: AudioAnalysis, notes: { time: number }[]): { sync: number; randomBaseline: number } {
  const strong = [...an.bandOnsets[0], ...an.bandOnsets[1], ...an.bandOnsets[2]]
    .filter((o) => o.strength >= 1.0)
    .map((o) => o.time)
    .sort((a, b) => a - b);
  const near = (t: number) => {
    let lo = 0, hi = strong.length - 1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (strong[m] < t - 0.035) lo = m + 1; else hi = m - 1;
    }
    return lo < strong.length && strong[lo] <= t + 0.035;
  };
  const sync = notes.length ? notes.filter((n) => near(n.time)).length / notes.length : 0;
  // Deterministic grid of probe points across the active region
  const N = 2000;
  let hits = 0;
  for (let i = 0; i < N; i++) {
    if (near(an.activeStart + ((i + 0.5) / N) * (an.activeEnd - an.activeStart))) hits++;
  }
  return { sync, randomBaseline: hits / N };
}
