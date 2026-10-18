// Stage rules and run launch for a monthly Playgama build, shared by the
// chapter screen and the results screen so "play next" and "replay" start a
// run exactly the way the chapter does.

import type { GameSong } from '@/game/api';
import { getMedalForSong, getHighScore } from '@/game/progress';
import { calculateCampaignDifficulty, type ChapterMeta } from '@/game/campaign';
import { chapterProgress, hasClearedSong, isStageUnlocked, type ChapterProgress } from '@/game/chapterStory';
import { getBombshellCoverUrl, BOMBSHELL_COVERS_MAP } from '@/utils/bombshellCards';
import { bombshellFileForDay } from '@/platform/playgama/monthMedia.mjs';
import { MONTH_BOMBSHELL, isBonusSongBought } from '@/platform/playgama/month';

export interface MonthStage {
  song: GameSong;
  idx: number;
  isBonus: boolean;
  level: number;
  /** Playable now: the stage is unlocked, or it's a bonus song bought or opened by an ad. */
  open: boolean;
  /** Bonus song still behind the platinum target, an ad or the bundle. */
  bonusLocked: boolean;
}

/** The Bombshell art a platinum run on this song unlocks, or null. */
export function bombshellArtFor(song: GameSong): string | null {
  if (!MONTH_BOMBSHELL) return null;
  const file = bombshellFileForDay(song.day, BOMBSHELL_COVERS_MAP);
  return file ? getBombshellCoverUrl(song.day, file) : null;
}

export function monthStageAt(songs: GameSong[], meta: ChapterMeta, progress: ChapterProgress, idx: number): MonthStage {
  const song = songs[idx];
  const isBonus = idx >= progress.regular.length;
  const bought = isBonus && isBonusSongBought(song.id);
  const level = calculateCampaignDifficulty(
    meta.month,
    isBonus ? idx - progress.regular.length : idx,
    isBonus ? progress.bonus.length : progress.regular.length,
    isBonus,
  );
  return {
    song, idx, isBonus, level,
    open: isStageUnlocked(idx, progress) || bought,
    bonusLocked: isBonus && !progress.bonusUnlocked && !bought,
  };
}

export const monthProgress = (songs: GameSong[], meta: ChapterMeta) => chapterProgress(songs, meta);

/** What the player had on a song before this run, for "first clear" and "new record". */
export interface RunBefore { cleared: boolean; best: number; platinum: boolean }
const beforeKey = (id: string) => `pg_before_${id}`;

export function runBefore(songId: string): RunBefore | null {
  try {
    const raw = sessionStorage.getItem(beforeKey(songId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Starts a campaign run on `song` at `level`: records the before-run state,
 * puts the Bombshell art behind a song already platinumed, and sends a first
 * run of the game on the opening track through the tutorial.
 */
export function startMonthRun(song: GameSong, idx: number, level: number, month: number, navigate: (to: string) => void) {
  sessionStorage.removeItem(`result_${song.id}`);
  sessionStorage.setItem('campaign_last_song_id', song.id);
  sessionStorage.setItem(`game_origin_${song.id}`, `chapter/${month}`);
  sessionStorage.setItem(`diff_override_${song.id}`, String(level));
  sessionStorage.removeItem(`active_modifier_type_${song.id}`);
  const before: RunBefore = {
    cleared: hasClearedSong(song),
    best: getHighScore(song.id) || 0,
    platinum: getMedalForSong(song.id) === 'PLATINUM',
  };
  sessionStorage.setItem(beforeKey(song.id), JSON.stringify(before));
  const bombshell = bombshellArtFor(song);
  if (bombshell && before.platinum) {
    sessionStorage.setItem(`active_cover_url_${song.id}`, bombshell);
    sessionStorage.setItem(`active_cover_bombshell_${song.id}`, '1');
  } else {
    sessionStorage.removeItem(`active_cover_url_${song.id}`);
    sessionStorage.removeItem(`active_cover_bombshell_${song.id}`);
  }
  let tutorialDone = true;
  try {
    tutorialDone = localStorage.getItem('pim_tutorial_completed') === 'true';
  } catch { /* storage blocked */ }
  navigate(idx === 0 && !before.cleared && !tutorialDone ? `/play/${song.id}?tutorial=true` : `/play/${song.id}`);
}
