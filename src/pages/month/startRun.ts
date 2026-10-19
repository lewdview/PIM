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

/** Song id of a run: the plain track, or its Chart Master Deluxe chart. */
export const deluxeRunId = (songId: string) => `${songId}_deluxe`;
export const isDeluxeRun = (runId: string) => runId.endsWith('_deluxe');
export const baseSongId = (runId: string) => runId.replace(/_deluxe$/, '');

/** Sets the session keys for a run and returns the path to navigate to. */
export function prepareMonthRun(song: GameSong, opts: {
  month: number;
  level: number;
  /** Index of the stage in the chapter; stage 0 can open the tutorial. */
  idx: number;
  cleared: boolean;
  /** Play the Chart Master Deluxe chart (opens once the track is cleared). */
  deluxe?: boolean;
}): string {
  // Gameplay reads these keys by the id in the play URL.
  const runId = opts.deluxe ? deluxeRunId(song.id) : song.id;
  sessionStorage.setItem('campaign_last_song_id', runId);
  sessionStorage.setItem(`game_origin_${runId}`, `chapter/${opts.month}`);
  // Deluxe keeps its own difficulty (two above the chart's); a plain run plays at the stage level.
  if (opts.deluxe) sessionStorage.removeItem(`diff_override_${runId}`);
  else sessionStorage.setItem(`diff_override_${runId}`, String(opts.level));
  sessionStorage.removeItem(`active_modifier_type_${runId}`);
  const bombshell = bombshellArtFor(song);
  if (bombshell && getMedalForSong(song.id) === 'PLATINUM') {
    sessionStorage.setItem(`active_cover_url_${runId}`, bombshell);
    sessionStorage.setItem(`active_cover_bombshell_${runId}`, '1');
  } else {
    sessionStorage.removeItem(`active_cover_url_${runId}`);
    sessionStorage.removeItem(`active_cover_bombshell_${runId}`);
  }
  // First run of the game teaches the controls on the opening track.
  if (!opts.deluxe && opts.idx === 0 && !opts.cleared && localStorage.getItem('pim_tutorial_completed') !== 'true') {
    return `/play/${runId}?tutorial=true`;
  }
  return `/play/${runId}`;
}
