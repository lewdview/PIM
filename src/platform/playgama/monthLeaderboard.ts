/**
 * Monthly Playgama build's leaderboard: one board per month whose score is
 * the sum of the player's best score on every track of the chapter. It only
 * exists where the portal offers Bridge leaderboards (leaderboardKind()), so
 * the Supabase leaderboards of the web build never appear here.
 */
import { loadCatalog, type GameSong } from '@/game/api';
import { getHighScore } from '@/game/progress';
import { songsForMonth } from '@/game/chapterStory';
import {
  getLeaderboardEntries, leaderboardKind, setLeaderboardScore, showLeaderboardPopup,
  type LeaderboardKind, type LeaderboardRow,
} from './bridge';
import { PLAYGAMA_MONTH } from './month';

export const LEADERBOARD_ID: string = __PIM_LEADERBOARD_ID__;
const SENT_KEY = `pg_lb_sent_m${PLAYGAMA_MONTH}`;

export type { LeaderboardKind, LeaderboardRow };
export const monthLeaderboardKind = (): LeaderboardKind =>
  PLAYGAMA_MONTH > 0 ? leaderboardKind() : 'not_available';

export function monthTotal(songs: GameSong[]): number {
  return songs.reduce((sum, s) => sum + (getHighScore(s.id) || 0), 0);
}

/** Posts the month total when it beats what was last posted. */
export async function submitMonthScore(): Promise<void> {
  if (monthLeaderboardKind() === 'not_available') return;
  const songs = songsForMonth(await loadCatalog(), PLAYGAMA_MONTH);
  const total = monthTotal(songs);
  const sent = Number(localStorage.getItem(SENT_KEY) || 0);
  if (total <= sent) return;
  if (await setLeaderboardScore(LEADERBOARD_ID, total)) localStorage.setItem(SENT_KEY, String(total));
}

export const getMonthEntries = () => getLeaderboardEntries(LEADERBOARD_ID);
export const showMonthPopup = () => showLeaderboardPopup(LEADERBOARD_ID);
