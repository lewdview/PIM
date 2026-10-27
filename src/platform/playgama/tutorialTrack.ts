// The monthly build's controls tutorial is its own node before track 1, so it
// can't borrow the opening song. It plays over "computer sounds" baked into
// public/tutorial/pg-tutorial.mp3 by scripts/make-tutorial-track.mjs; the
// tutorial writes its own notes, so the song has no chart.

import type { GameSong } from '@/game/api';

/** Song id of the tutorial run (`/play/pg-tutorial?tutorial=true`). */
export const PG_TUTORIAL_ID = 'pg-tutorial';
/** localStorage flag the tutorial sets when it's finished (mirrored into the Playgama save). */
export const TUTORIAL_DONE_KEY = 'pim_tutorial_completed';

export function isTutorialDone(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_DONE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** The tutorial "song". BPM and duration match the baked track. */
export function tutorialSong(): GameSong {
  return {
    id: PG_TUTORIAL_ID,
    day: 0,
    date: '',
    title: 'Tutorial',
    artist: 'PIM',
    bpm: 100,
    duration: 330,
    mood: 'light',
    valence: 0.5,
    moodTags: [],
    description: 'Learn the controls',
    audioUrl: '/tutorial/pg-tutorial.mp3',
    coverArt: null,
    notes: [],
    key: 'C minor',
    genre: ['Electronic'],
    difficultyLevel: 1,
  };
}
