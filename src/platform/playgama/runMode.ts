/**
 * Run modes of the monthly build (spec sections 4 and 11):
 *
 *   intro     every run until the player's first valid finish in this chapter:
 *             easiest chart, wider timing, half damage, Assist instead of
 *             failing, gentler stage-3 camera and short in-song tips.
 *   relaxed   the easier chart treatment with the same protection, by choice.
 *   standard  the chart and rules as designed. Only Standard runs set medals,
 *             write the track's best score and count toward the month's
 *             leaderboard (PIM_<Month>_Score).
 *
 * Everything lives in localStorage so bridge.ts mirrors it into the pim_save key.
 * Scores saved before modes existed (hs_<id>, medal_<id>) are legacy records:
 * they were set under Standard rules and stay where they are, untouched.
 */
import { PLAYGAMA_MONTH } from './month';

export type RunMode = 'intro' | 'relaxed' | 'standard';
export type ChosenMode = Exclude<RunMode, 'intro'>;

export interface ModeTuning {
  /** Multiplies every timing window. */
  timingScale: number;
  /** Strikes a miss costs (3 strikes is a fail in Standard). */
  strikeWeight: number;
  /** Running out of strikes turns Assist on instead of ending the run. */
  assist: boolean;
  /** In-song tips for the controls. */
  coach: boolean;
  /** Stage 3 keeps the classic camera (the stage still announces itself). */
  softCamera: boolean;
  /** Minimum seconds between notes after the chart is built (0 = chart's own). */
  minGap: number;
}

/** Starting settings from the spec; tune them against real play. */
export const MODE_TUNING: Record<RunMode, ModeTuning> = {
  intro: { timingScale: 1.25, strikeWeight: 0.5, assist: true, coach: true, softCamera: true, minGap: 0.5 },
  relaxed: { timingScale: 1.25, strikeWeight: 0.5, assist: true, coach: false, softCamera: false, minGap: 0 },
  standard: { timingScale: 1, strikeWeight: 1, assist: false, coach: false, softCamera: false, minGap: 0 },
};

export const MODE_LABEL: Record<RunMode, string> = {
  intro: 'First run',
  relaxed: 'Relaxed',
  standard: 'Standard',
};

/** Chart level a mode plays a stage at (stage level from calculateCampaignDifficulty). */
export function levelForMode(mode: RunMode, stageLevel: number): number {
  if (mode === 'intro') return 1;
  if (mode === 'relaxed') return Math.max(1, stageLevel - 3);
  return stageLevel;
}

const M = PLAYGAMA_MONTH;
const FIRST_FINISH_KEY = `pg_first_finish_m${M}`;
const PREF_KEY = `pg_mode_m${M}`;
const RECOMMEND_KEY = `pg_mode_rec_m${M}`;
const LAST_ENTRY_KEY = `pg_last_entry_m${M}`;
const finishKey = (songId: string) => `pg_finish_${songId}`;
const bestKey = (mode: ChosenMode, songId: string) => `pg_best_${mode}_${songId}`;
const runModeKey = (runId: string) => `run_mode_${runId}`;

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function set(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch { /* storage blocked */ }
}

/** True once the player has finished any entry here, including saves from before modes existed. */
export function hasFirstFinish(): boolean {
  if (!M) return true;
  if (get(FIRST_FINISH_KEY) === '1') return true;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if ((k.startsWith('hs_') && Number(localStorage.getItem(k)) > 0) || k.startsWith('pg_finish_')) {
        set(FIRST_FINISH_KEY, '1');
        return true;
      }
    }
  } catch { /* storage blocked */ }
  return false;
}

/** The player's explicit mode choice, if they made one. */
export function chosenMode(): ChosenMode | null {
  const v = get(PREF_KEY);
  return v === 'relaxed' || v === 'standard' ? v : null;
}
export function setChosenMode(mode: ChosenMode): void {
  set(PREF_KEY, mode);
}

/** What the game recommends after the first finish (Relaxed if it was rough). */
export function recommendedMode(): ChosenMode {
  return get(RECOMMEND_KEY) === 'relaxed' ? 'relaxed' : 'standard';
}

/** Mode the next regular run starts in: intro until the first finish, then the choice or the recommendation. */
export function nextRunMode(): RunMode {
  if (!hasFirstFinish()) return 'intro';
  return chosenMode() ?? recommendedMode();
}

/** Run mode handed to gameplay through sessionStorage, by the id in the play URL. */
export function setRunMode(runId: string, mode: RunMode): void {
  try { sessionStorage.setItem(runModeKey(runId), mode); } catch { /* ignore */ }
}
export function runModeFor(runId: string): RunMode {
  if (!M) return 'standard';
  try {
    const v = sessionStorage.getItem(runModeKey(runId));
    if (v === 'intro' || v === 'relaxed' || v === 'standard') return v;
  } catch { /* ignore */ }
  return 'standard';
}

export interface ModeBest {
  score: number;
  accuracy: number;
  medal: string;
  assisted: boolean;
  at: number;
}

export interface FinishRecord {
  /** Mode of the first finish. */
  mode: RunMode;
  assisted: boolean;
  at: number;
}

/** Whether a Relaxed/intro finish exists for this track (Standard finishes are in hs_/medal_). */
export function hasModeFinish(songId: string): boolean {
  return get(finishKey(songId)) !== null;
}

export function bestFor(mode: ChosenMode, songId: string): ModeBest | null {
  try {
    const raw = get(bestKey(mode, songId));
    return raw ? (JSON.parse(raw) as ModeBest) : null;
  } catch {
    return null;
  }
}

/**
 * Records a finished run (the song reached its end). Intro and Relaxed runs
 * keep their own best; a Standard run's best also lands here, tagged, next to
 * the hs_/medal_ save gameplay already does. Returns whether this was the
 * chapter's first finish.
 */
export function recordFinish(songId: string, mode: RunMode, run: { score: number; accuracy: number; medal: string; assisted: boolean }): boolean {
  const first = !hasFirstFinish();
  if (!hasModeFinish(songId)) {
    set(finishKey(songId), JSON.stringify({ mode, assisted: run.assisted, at: Date.now() } satisfies FinishRecord));
  }
  const bucket: ChosenMode = mode === 'standard' ? 'standard' : 'relaxed';
  const prev = bestFor(bucket, songId);
  if (!prev || run.score > prev.score) {
    set(bestKey(bucket, songId), JSON.stringify({ ...run, at: Date.now() } satisfies ModeBest));
  }
  if (first) {
    set(FIRST_FINISH_KEY, '1');
    // Section 4: Relaxed after a rough opener, otherwise Standard.
    set(RECOMMEND_KEY, run.accuracy < 80 || run.assisted ? 'relaxed' : 'standard');
  }
  return first;
}

/** The entry the player last started (returning players' Play goes on from here). */
export function lastEntry(): string | null {
  return get(LAST_ENTRY_KEY);
}
export function setLastEntry(songId: string): void {
  set(LAST_ENTRY_KEY, songId);
}
