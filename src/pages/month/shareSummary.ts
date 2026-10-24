// Builds what the share panel draws and copies from the saved progress
// (see platform/playgama/shareCard.ts for the card and text formats).

import type { GameSong } from '@/game/api';
import { CHAPTERS } from '@/game/campaign';
import { getMedalForSong } from '@/game/progress';
import { hasClearedSong, type ChapterProgress } from '@/game/chapterStory';
import { PLAYGAMA_MONTH } from '@/platform/playgama/month';
import { monthTotal } from '@/platform/playgama/monthLeaderboard';
import { ENDING_INFO, endingStates } from '@/platform/playgama/endings';
import { achievementStates } from '@/platform/playgama/achievements';
import type { ProgressSummary } from '@/platform/playgama/shareCard';

export const monthMeta = () => CHAPTERS.find((c) => c.month === PLAYGAMA_MONTH) ?? CHAPTERS[0];

export function monthSummary(songs: GameSong[], p: ChapterProgress): ProgressSummary {
  const meta = monthMeta();
  const trophies = achievementStates(songs, p);
  return {
    monthName: meta.name,
    color: meta.dc,
    tracks: songs.map((s, i) => ({
      title: s.title,
      day: s.day,
      coverArt: s.coverArt,
      medal: getMedalForSong(s.id),
      cleared: hasClearedSong(s),
      bonus: i >= p.regular.length,
    })),
    cleared: p.cleared,
    regularCount: p.regular.length,
    platinums: songs.filter((s) => getMedalForSong(s.id) === 'PLATINUM').length,
    deluxePlatinums: songs.filter((s) => getMedalForSong(`${s.id}_deluxe`) === 'PLATINUM').length,
    total: monthTotal(songs),
    endings: endingStates(songs, p).filter((e) => e.earned).map((e) => ENDING_INFO[e.id].title),
    trophies: trophies.filter((t) => t.earned).length,
    trophyCount: trophies.length,
  };
}

export const shareFileName = (what: string) =>
  `pim-${monthMeta().name.toLowerCase()}-${what.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`;
