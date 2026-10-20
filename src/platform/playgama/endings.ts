/**
 * The monthly build's four endings, earned in order through the chapter:
 *
 *   clear      every regular track cleared (track 26 in January)
 *   epilogue   every bonus track cleared too
 *   true       platinum on every track of the month
 *   bombshell  platinum on every track and on every track's Deluxe chart
 *
 * Each plays once on its own when earned (see MonthResults) and stays
 * replayable from the chapter's Endings panel. What an ending shows comes from
 * the month's chapter story, so the same four work for all twelve months.
 */
import type { GameSong } from '@/game/api';
import { getMedalForSong } from '@/game/progress';
import { hasClearedSong, type ChapterProgress } from '@/game/chapterStory';
import { PLAYGAMA_MONTH } from './month';

export type EndingId = 'clear' | 'epilogue' | 'true' | 'bombshell';
export const ENDING_ORDER: EndingId[] = ['clear', 'epilogue', 'true', 'bombshell'];

export const ENDING_INFO: Record<EndingId, { title: string; condition: string }> = {
  clear: { title: 'Chapter Clear', condition: 'Clear every track' },
  epilogue: { title: 'Epilogue', condition: 'Clear the bonus tracks' },
  true: { title: 'True Ending', condition: 'Platinum on every track' },
  bombshell: { title: 'Bombshell Ending', condition: 'Platinum on every track and every Deluxe chart' },
};

export interface EndingState {
  id: EndingId;
  have: number;
  need: number;
  earned: boolean;
  seen: boolean;
}

const seenKey = (id: EndingId) => `pg_ending_seen_m${PLAYGAMA_MONTH}_${id}`;
const platinum = (id: string) => getMedalForSong(id) === 'PLATINUM';

export function isEndingSeen(id: EndingId): boolean {
  try {
    return localStorage.getItem(seenKey(id)) === 'true';
  } catch {
    return false;
  }
}

export function markEndingSeen(id: EndingId): void {
  try {
    localStorage.setItem(seenKey(id), 'true');
  } catch { /* storage blocked */ }
}

export function endingStates(songs: GameSong[], p: ChapterProgress): EndingState[] {
  const all = songs.length;
  const plats = songs.filter((s) => platinum(s.id)).length;
  const deluxePlats = songs.filter((s) => platinum(`${s.id}_deluxe`)).length;
  const bonusCleared = p.bonus.filter(hasClearedSong).length;
  const counts: Record<EndingId, [number, number]> = {
    clear: [p.cleared, p.regular.length],
    epilogue: [bonusCleared, p.bonus.length],
    true: [plats, all],
    bombshell: [plats + deluxePlats, all * 2],
  };
  return ENDING_ORDER.map((id) => {
    const [have, need] = counts[id];
    return { id, have, need, earned: need > 0 && have >= need, seen: isEndingSeen(id) };
  });
}

/** The first ending earned but not yet watched, if any. */
export function pendingEnding(songs: GameSong[], p: ChapterProgress): EndingId | null {
  return endingStates(songs, p).find((e) => e.earned && !e.seen)?.id ?? null;
}

/** The month's final Bombshell piece, shipped as public/endings/mMM-final.jpg (bombshell ending only). */
export const finalPiecePath = () => `/endings/m${String(PLAYGAMA_MONTH).padStart(2, '0')}-final.jpg`;
