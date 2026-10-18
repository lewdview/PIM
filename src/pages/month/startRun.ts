// Starts a stage of the monthly Playgama build. Shared by the chapter screen
// and the results screen so "Play", "Retry" and "Play next" set up the run the
// same way: the campaign level for that stage, its Bombshell backdrop when a
// platinum run has unlocked it, and the controls tutorial on the very first run.

import type { GameSong } from '@/game/api';
import { getMedalForSong } from '@/game/progress';
import { calculateCampaignDifficulty } from '@/game/campaign';
import { bombshellFileForDay } from '@/platform/playgama/monthMedia.mjs';
import { MONTH_BOMBSHELL } from '@/platform/playgama/month';
import { getBombshellCoverUrl, BOMBSHELL_COVERS_MAP } from '@/utils/bombshellCards';
import type { ChapterProgress } from '@/game/chapterStory';

/** The Bombshell art a platinum run on this song unlocks, or null. */
export function bombshellArtFor(song: GameSong): string | null {
  if (!MONTH_BOMBSHELL) return null;
  const file = bombshellFileForDay(song.day, BOMBSHELL_COVERS_MAP);
  return file ? getBombshellCoverUrl(song.day, file) : null;
}

/** Campaign difficulty for stage `idx` of the chapter. */
export function monthStageLevel(month: number, idx: number, p: ChapterProgress): number {
  const isBonus = idx >= p.regular.length;
  return calculateCampaignDifficulty(
    month,
    isBonus ? idx - p.regular.length : idx,
    isBonus ? p.bonus.length : p.regular.length,
    isBonus,
  );
}

/** Sets the session keys for a run and returns the path to navigate to. */
export function prepareMonthRun(song: GameSong, opts: {
  month: number;
  level: number;
  /** Index of the stage in the chapter; stage 0 can open the tutorial. */
  idx: number;
  cleared: boolean;
}): string {
  sessionStorage.setItem('campaign_last_song_id', song.id);
  sessionStorage.setItem(`game_origin_${song.id}`, `chapter/${opts.month}`);
  sessionStorage.setItem(`diff_override_${song.id}`, String(opts.level));
  sessionStorage.removeItem(`active_modifier_type_${song.id}`);
  const bombshell = bombshellArtFor(song);
  if (bombshell && getMedalForSong(song.id) === 'PLATINUM') {
    sessionStorage.setItem(`active_cover_url_${song.id}`, bombshell);
    sessionStorage.setItem(`active_cover_bombshell_${song.id}`, '1');
  } else {
    sessionStorage.removeItem(`active_cover_url_${song.id}`);
    sessionStorage.removeItem(`active_cover_bombshell_${song.id}`);
  }
  // First run of the game teaches the controls on the opening track.
  if (opts.idx === 0 && !opts.cleared && localStorage.getItem('pim_tutorial_completed') !== 'true') {
    return `/play/${song.id}?tutorial=true`;
  }
  return `/play/${song.id}`;
}
