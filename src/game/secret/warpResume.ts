/**
 * Warp resume — an instant warp leaves the song mid-transmission for
 * SIGNAL SIEGE; when the level ends, the song picks up where it stopped.
 *
 * GameplayCore saves a snapshot of the run as it warps out, SecretLevel
 * sends the player back to /play/<songId>?resume=warp, and GameplayCore
 * restores the snapshot: same score and judgments, notes before the warp
 * already resolved, audio seeked back to the stop point.
 */

import type { GameState } from '../types';

export interface WarpResumeSnapshot {
  songId: string;
  /** Song time (s) the transmission stopped at. */
  time: number;
  /** The run's original query string (campaign params etc.), without `resume`. */
  search: string;
  gs: GameState;
  missCount: number;
  continuesUsed: number;
  shieldCharges: number;
  /** Active power-up and consumed combo thresholds (`triggered` as an array). */
  powerUp: Record<string, unknown> & { triggered: number[] };
  /** `time:lane` keys of every note already judged (hit early, hit, or missed). */
  resolvedNotes: string[];
  /** Per-hit telemetry so far, for the ghost replay and lane stats. */
  telemetry: unknown[];
  savedAt: number;
}

/** Stable key for a note across chart rebuilds. */
export const noteKey = (n: { time: number; lane: number }) => `${n.time.toFixed(3)}:${n.lane}`;

/** Seconds of music replayed before the stop point so the return isn't abrupt. */
export const WARP_RESUME_LEAD_IN = 1.5;
/** A snapshot older than this is stale (the player wandered off). */
const MAX_AGE_MS = 30 * 60 * 1000;
const RESUME_PARAM = 'resume';

const key = (songId: string) => `warp_resume_${songId}`;

export function saveWarpResume(snap: Omit<WarpResumeSnapshot, 'savedAt' | 'search'> & { search: string }) {
  try {
    const params = new URLSearchParams(snap.search);
    params.delete(RESUME_PARAM);
    params.delete('warp');
    const search = params.toString();
    const data: WarpResumeSnapshot = { ...snap, search: search ? `?${search}` : '', savedAt: Date.now() };
    sessionStorage.setItem(key(snap.songId), JSON.stringify(data));
  } catch {
    /* storage unavailable: the level ends on the song list instead */
  }
}

function readWarpResume(songId: string): WarpResumeSnapshot | null {
  try {
    const raw = sessionStorage.getItem(key(songId));
    if (!raw) return null;
    const snap = JSON.parse(raw) as WarpResumeSnapshot;
    if (snap.songId !== songId || !(snap.time > 0) || Date.now() - snap.savedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(key(songId));
      return null;
    }
    return snap;
  } catch {
    return null;
  }
}

/** Where SIGNAL SIEGE should send the player back to, or null when there's no song to return to. */
export function warpResumePath(songId: string): string | null {
  const snap = readWarpResume(songId);
  if (!snap) return null;
  const params = new URLSearchParams(snap.search);
  params.set(RESUME_PARAM, 'warp');
  return `/play/${encodeURIComponent(songId)}?${params.toString()}`;
}

/** Read and clear the snapshot when the gameplay URL asks to resume. */
export function takeWarpResume(songId: string | undefined, search: string): WarpResumeSnapshot | null {
  if (!songId || new URLSearchParams(search).get(RESUME_PARAM) !== 'warp') return null;
  const snap = readWarpResume(songId);
  try {
    sessionStorage.removeItem(key(songId));
  } catch {
    /* ignore */
  }
  return snap;
}
