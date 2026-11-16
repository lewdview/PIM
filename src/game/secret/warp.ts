/**
 * Secret warp notes — the game's "Toasty" moment.
 *
 * Once in a while a single tap in a song's final stage turns into a warp
 * note. Hitting it opens a hidden level:
 *   - 'warp'       → leaves the song right away for the shooter level
 *   - 'warp-clear' → unlocks the runner level, which starts once the song
 *                    is cleared
 * Missing a warp note costs nothing; most players never see one.
 */

import type { Note, NoteType } from '../types';

export type WarpType = Extract<NoteType, 'warp' | 'warp-clear'>;
export type SecretLevelId = 'shooter' | 'runner';

/** Share of runs that get a warp note at all. */
export const WARP_CHANCE = 1 / 8;
/** Of those, the share that warp immediately (the rest warp on clear). */
export const INSTANT_SHARE = 0.4;
/** Bonus points for hitting a warp note. */
export const WARP_SCORE_BONUS = 2000;
/** Delay between hitting an instant warp and leaving the song. */
export const INSTANT_WARP_DELAY_MS = 1400;

export const WARP_LEVEL: Record<WarpType, SecretLevelId> = {
  warp: 'shooter',
  'warp-clear': 'runner',
};

export function isWarpNote(note: { type?: string } | null | undefined): note is { type: WarpType } {
  return note?.type === 'warp' || note?.type === 'warp-clear';
}

export function secretLevelPath(level: SecretLevelId, fromSongId: string, via: WarpType): string {
  return `/secret/${level}?from=${encodeURIComponent(fromSongId)}&via=${via}`;
}

/**
 * Pick the note to turn into a warp note, or null for no warp this run.
 * `force` ('warp' | 'warp-clear') skips the dice roll, for testing via the
 * `?warp=now` / `?warp=clear` query.
 */
export function chooseWarpNote(
  notes: Pick<Note, 'time' | 'lane' | 'type'>[],
  finalStageStart: number,
  rand: () => number = Math.random,
  force?: WarpType,
): { index: number; type: WarpType } | null {
  if (!force && rand() >= WARP_CHANCE) return null;
  // A lone tap: nothing else within 0.35 s, so the warp reads clearly
  const candidates: number[] = [];
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (n.type !== 'tap' || n.time < finalStageStart) continue;
    const prev = notes[i - 1];
    const next = notes[i + 1];
    if (prev && n.time - prev.time < 0.35) continue;
    if (next && next.time - n.time < 0.35) continue;
    candidates.push(i);
  }
  if (!candidates.length) return null;
  const index = candidates[Math.floor(rand() * candidates.length) % candidates.length];
  const type: WarpType = force ?? (rand() < INSTANT_SHARE ? 'warp' : 'warp-clear');
  return { index, type };
}

/** Parse the `?warp=` test override. */
export function parseWarpOverride(search: string): WarpType | undefined {
  const v = new URLSearchParams(search).get('warp');
  if (v === 'now') return 'warp';
  if (v === 'clear') return 'warp-clear';
  return undefined;
}

const CLEARED_KEY = 'secret_levels_cleared';
const WHISTLE_KEY = 'warp_whistle';
type SecretClear = { best: number; clears: number };
let earnedWhistle = false;
let sessionClears: Partial<Record<string, SecretClear>> = {};

export function readSecretClears(): Partial<Record<string, SecretClear>> {
  try {
    const stored = JSON.parse(localStorage.getItem(CLEARED_KEY) ?? '{}');
    return { ...stored, ...sessionClears };
  } catch {
    return { ...sessionClears };
  }
}

export function collectWarpWhistle() {
  earnedWhistle = true;
  try {
    localStorage.setItem(WHISTLE_KEY, '1');
  } catch { /* Remember it for the current session. */ }
}

export function hasWarpWhistle() {
  if (earnedWhistle) return true;
  try {
    if (localStorage.getItem(WHISTLE_KEY) === '1') return true;
  } catch { /* Use existing clear records when available. */ }
  const clears = readSecretClears();
  return (clears.runner?.clears ?? 0) > 0 || (clears.shooter?.clears ?? 0) > 0;
}

export function markSecretLevelCleared(id: string, score: number) {
  const data = readSecretClears();
  const prev = data[id] ?? { best: 0, clears: 0 };
  const clear = { best: Math.max(prev.best, score), clears: prev.clears + 1 };
  data[id] = clear;
  try {
    localStorage.setItem(CLEARED_KEY, JSON.stringify(data));
    sessionClears = {};
  } catch {
    sessionClears[id] = clear;
  }
}
