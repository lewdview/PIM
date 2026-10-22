/**
 * Story scenes of the monthly build, told from the month's chapter story
 * (chapter_stories.json) like the endings are:
 *
 *   prologue   the first time the chapter opens: the prologue lyric and the month's words
 *   act-<n>    the first time a run starts on an act's opening track: the act's
 *              word, mood and its three lyric beats (opens, turns, lands)
 *
 * Each plays once on its own and stays replayable from the chapter's Story panel.
 * The epilogue has no scene of its own: Chapter Clear teases it and the
 * Epilogue ending reveals it.
 */
import type { GameSong } from '@/game/api';
import { getMonthStory, hasClearedSong, type ChapterAct } from '@/game/chapterStory';
import { PLAYGAMA_MONTH } from './month';

export type StorySceneId = 'prologue' | `act-${string}`;

const seenKey = (id: StorySceneId) => `pg_story_seen_m${PLAYGAMA_MONTH}_${id}`;

export function isStorySeen(id: StorySceneId): boolean {
  try {
    return localStorage.getItem(seenKey(id)) === 'true';
  } catch {
    // Storage blocked: never force a scene the player can't mark as watched.
    return true;
  }
}

export function markStorySeen(id: StorySceneId): void {
  try {
    localStorage.setItem(seenKey(id), 'true');
  } catch { /* storage blocked */ }
}

/** The act whose first regular track is this song, if any. */
export function actOpenedBy(song: GameSong, regular: GameSong[]): ChapterAct | null {
  const acts = getMonthStory(PLAYGAMA_MONTH)?.acts ?? [];
  for (const act of acts) {
    const first = regular.find((s) => s.day >= act.fromDay && s.day <= act.toDay);
    if (first?.id === song.id) return act;
  }
  return null;
}

/**
 * Where to go to start a run: the run itself, or first the scene of the act it
 * opens when that hasn't been seen (plain runs on uncleared tracks only).
 */
export function routeThroughStory(song: GameSong, runPath: string, regular: GameSong[], deluxe = false): string {
  if (deluxe || hasClearedSong(song)) return runPath;
  const act = actOpenedBy(song, regular);
  if (!act || isStorySeen(`act-${act.act}`)) return runPath;
  return `/story/act-${act.act}?next=${encodeURIComponent(runPath)}`;
}
