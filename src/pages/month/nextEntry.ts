// Which entry to offer next (spec section 5): the next unfinished, open regular
// entry after the current one, wrapping round; never a locked bonus entry.
// Once every regular entry is finished, a replay with a stated goal.

import type { GameSong } from '@/game/api';
import { getMedalForSong } from '@/game/progress';
import { hasClearedSong, isStageUnlocked, type ChapterProgress } from '@/game/chapterStory';
import { bestFor, hasFirstFinish, lastEntry } from '@/platform/playgama/runMode';

/** First regular entry a new player's Play starts (chapter configuration). */
export const OPENER_IDX = 0;

export interface EntryPick {
  song: GameSong;
  idx: number;
  /** Set when every regular entry is finished: what the replay is for. */
  goal?: string;
}

const MEDAL_RANK: Record<string, number> = { '': 0, NONE: 0, BRONZE: 1, SILVER: 2, GOLD: 3, PLATINUM: 4 };

/** Next unfinished, unlocked regular entry after `idx` (wrapping), or null when all are finished. */
export function nextUnfinished(p: ChapterProgress, idx: number): EntryPick | null {
  const n = p.regular.length;
  for (let step = 1; step <= n; step++) {
    const i = (Math.max(-1, idx) + step) % n;
    const song = p.regular[i];
    if (!hasClearedSong(song) && isStageUnlocked(i, p)) return { song, idx: i };
  }
  return null;
}

/** A replay worth playing once the regular entries are all finished, with its goal. */
export function replayGoal(p: ChapterProgress, after: number): EntryPick {
  const n = p.regular.length;
  const order = Array.from({ length: n }, (_, k) => (Math.max(-1, after) + 1 + k) % n);
  // No Standard medal yet (finished only in Relaxed or on the first run).
  for (const i of order) {
    const s = p.regular[i];
    if (!MEDAL_RANK[getMedalForSong(s.id)]) {
      return { song: s, idx: i, goal: bestFor('relaxed', s.id) ? 'Finish it in Standard to earn a medal' : 'Earn a medal on it' };
    }
  }
  // Lowest medal below platinum.
  let pick = -1;
  for (const i of order) {
    const r = MEDAL_RANK[getMedalForSong(p.regular[i].id)] ?? 0;
    if (r < 4 && (pick === -1 || r < (MEDAL_RANK[getMedalForSong(p.regular[pick].id)] ?? 0))) pick = i;
  }
  if (pick !== -1) {
    const medal = getMedalForSong(p.regular[pick].id).toLowerCase();
    return { song: p.regular[pick], idx: pick, goal: `Go for platinum (best so far: ${medal})` };
  }
  const i = order[0];
  return { song: p.regular[i], idx: i, goal: 'Every track is platinum. Beat your best score' };
}

/** What the result screen's Next Entry offers after the entry at `idx`. */
export function nextEntryAfter(p: ChapterProgress, idx: number): EntryPick {
  return nextUnfinished(p, idx) ?? replayGoal(p, idx);
}

/** What the title screen's Play starts. */
export function playTarget(songs: GameSong[], p: ChapterProgress): EntryPick | null {
  if (!p.regular.length) return null;
  if (!hasFirstFinish()) {
    const last = lastEntry();
    const idx = last ? p.regular.findIndex((s) => s.id === last) : -1;
    // A new player who already picked an entry goes back to it; otherwise the opener.
    const i = idx !== -1 && isStageUnlocked(idx, p) ? idx : OPENER_IDX;
    return { song: p.regular[i], idx: i };
  }
  const last = lastEntry();
  const lastIdx = last ? songs.findIndex((s) => s.id === last) : -1;
  // Returning: carry on from the last entry played (it itself if it's still unfinished and open).
  if (lastIdx !== -1 && lastIdx < p.regular.length && !hasClearedSong(songs[lastIdx]) && isStageUnlocked(lastIdx, p)) {
    return { song: songs[lastIdx], idx: lastIdx };
  }
  return nextEntryAfter(p, lastIdx >= p.regular.length ? -1 : lastIdx);
}
