/**
 * Chart Master (v6) — audio-driven procedural chart generator.
 *
 *   analysis → beats → structure → compose
 *
 * Deterministic for a given audio + metadata. Runs in the browser (runtime
 * fallback, see GameplayCore) and in Node (scripts/bake_master_charts.ts).
 */

import type { Note } from '../types.ts';
import { analyzeAudio, ANALYSIS_SAMPLE_RATE, type AudioAnalysis } from './analysis.ts';
import { trackBeats } from './beats.ts';
import { analyseStructure } from './structure.ts';
import { composeChart } from './compose.ts';

export { ANALYSIS_SAMPLE_RATE, analyzeAudio };
export type { AudioAnalysis };
export const CHART_MASTER_VERSION = 'v6_master';
/** Chart Master Deluxe: the harder edition, stored as day-XXX_deluxe.json next to v6. */
export const CHART_MASTER_DELUXE_VERSION = 'v6_deluxe';

export interface ChartMasterInput {
  bpm: number;
  duration?: number;
  difficultyLevel?: number;
  day?: number;
  deluxe?: boolean;
}

export interface ChartStage {
  stage: number;
  name: string;
  difficulty: string;
  startTime: number;
  endTime: number;
  noteCount: number;
}

export interface ChartMasterReport {
  version: string;
  bpm: number;
  catalogBpm: number;
  tempoConfidence: number;
  beats: number;
  bars: number;
  repeatedBars: number;
  povTimes: number[];
  typeCounts: Record<string, number>;
  ms: number;
}

export interface ChartMasterResult {
  notes: Note[];
  stages: ChartStage[];
  report: ChartMasterReport;
}

const STAGE_META = [
  { name: 'Stage 1', difficulty: 'EASY' },
  { name: 'Stage 2', difficulty: 'MEDIUM' },
  { name: 'Stage 3', difficulty: 'HARD' },
  { name: 'Stage 4', difficulty: 'BRUTAL' },
  { name: 'FINAL STAGE', difficulty: 'BRUTAL' },
];

export function generateMasterChart(
  pcm: Float32Array,
  sampleRate: number,
  meta: ChartMasterInput,
  analysis?: AudioAnalysis,
): ChartMasterResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const an = analysis ?? analyzeAudio(pcm, sampleRate);
  const duration = Math.min(meta.duration || an.duration, an.duration) || an.duration;
  const grid = trackBeats(an, meta.bpm || 120);
  const st = analyseStructure(an, grid, duration);
  const notes = composeChart(an, grid, st, {
    difficulty: meta.difficultyLevel || 5,
    seed: (meta.day || 1) * 7919 + Math.round(grid.bpm * 100),
    duration,
    deluxe: meta.deluxe,
  });

  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  const stages: ChartStage[] = STAGE_META.map((m, i) => ({
    stage: i + 1,
    name: m.name,
    difficulty: m.difficulty,
    startTime: r3(st.stageTimes[i]),
    endTime: r3(st.stageTimes[i + 1]),
    noteCount: notes.filter((n) => n.stage === i + 1).length,
  }));

  const typeCounts: Record<string, number> = {};
  for (const n of notes) typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    notes,
    stages,
    report: {
      version: meta.deluxe ? CHART_MASTER_DELUXE_VERSION : CHART_MASTER_VERSION,
      bpm: Math.round(grid.bpm * 100) / 100,
      catalogBpm: grid.catalogBpm,
      tempoConfidence: Math.round(grid.confidence * 100) / 100,
      beats: grid.beats.length,
      bars: st.bars.length,
      repeatedBars: st.bars.filter((b) => b.repeatOf >= 0).length,
      povTimes: [r3(st.stageTimes[2]), r3(st.stageTimes[4])],
      typeCounts,
      ms: Math.round(t1 - t0),
    },
  };
}
