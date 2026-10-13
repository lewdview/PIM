// Campaign story layer: what each month's chapter "says", distilled from the
// track lyrics by scripts/build_chapter_stories.mjs into chapter_stories.json.
// Also the shared chapter rules (regular vs bonus split, clears, unlocks) so
// the campaign list and the chapter screen agree on progress.

import stories from '@/data/chapter_stories.json';
import type { GameSong } from './api';
import { getMedalForSong, getHighScore, getChapterPlatinums } from './progress';
import type { ChapterMeta } from './campaign';
import { getMonthNumFromDay } from '@/utils/dayCalc';

/** A track that marks a turn in an act; `line` is its hook when it has lyrics. */
export interface StoryBeat {
  day: number;
  line: string | null;
}

export interface ChapterAct {
  act: string;
  word: string;
  fromDay: number;
  toDay: number;
  themes: string[];
  mood: 'bright' | 'rising' | 'restless' | 'heavy' | string;
  open: StoryBeat;
  turn: (StoryBeat & { dir: 'lifts' | 'drops' }) | null;
  close: StoryBeat | null;
}

export interface MonthStory {
  month: number;
  words: string[];
  themes: string[];
  prologue: { day: number; line: string; lyric: boolean };
  acts: ChapterAct[];
  epilogue: Omit<ChapterAct, 'act'> | null;
  lyricCoverage: number;
  trackCount: number;
}

export interface TrackStory {
  hook: string;
  words: string[];
  themes: string[];
  hasLyrics: boolean;
}

const MONTHS = new Map<number, MonthStory>((stories.months as unknown as MonthStory[]).map((m) => [m.month, m]));
const TRACKS = stories.tracks as Record<string, TrackStory>;

export function getMonthStory(month: number): MonthStory | undefined {
  return MONTHS.get(month);
}

export function getTrackStory(day: number): TrackStory | undefined {
  return TRACKS[String(day)];
}

/** Last five tracks of a month are its bonus stages (when it has more than five). */
export const BONUS_COUNT = 5;

export function songsForMonth(catalog: GameSong[], month: number): GameSong[] {
  return catalog
    .filter((s) => {
      if (s.day !== undefined) return getMonthNumFromDay(s.day) === month;
      if (!s.date) return false;
      const parts = s.date.split('-');
      return parts.length > 1 && parseInt(parts[1], 10) === month;
    })
    .sort((a, b) => a.day - b.day);
}

export function splitChapter(songs: GameSong[]) {
  const hasBonus = songs.length > BONUS_COUNT;
  return {
    regular: hasBonus ? songs.slice(0, -BONUS_COUNT) : songs,
    bonus: hasBonus ? songs.slice(-BONUS_COUNT) : [],
  };
}

export function hasClearedSong(song?: GameSong): boolean {
  if (!song) return false;
  const medal = getMedalForSong(song.id);
  return (!!medal && medal !== '') || getHighScore(song.id) > 0;
}

export interface ChapterProgress {
  regular: GameSong[];
  bonus: GameSong[];
  cleared: number;
  platinums: number;
  bonusUnlocked: boolean;
  complete: boolean;
}

export function chapterProgress(songs: GameSong[], meta: ChapterMeta): ChapterProgress {
  const { regular, bonus } = splitChapter(songs);
  const cleared = regular.filter(hasClearedSong).length;
  const platinums = getChapterPlatinums(regular.map((s) => s.id));
  return {
    regular,
    bonus,
    cleared,
    platinums,
    bonusUnlocked: bonus.length === 0 || platinums >= meta.platNeeded,
    complete: regular.length > 0 && cleared >= regular.length,
  };
}

/**
 * Track-level unlock inside a chapter: regular stages open one after another;
 * bonus stages open in order once the chapter's platinum target is met.
 */
export function isStageUnlocked(idx: number, p: ChapterProgress): boolean {
  if (idx < 0) return false;
  if (idx < p.regular.length) return idx === 0 || hasClearedSong(p.regular[idx - 1]);
  if (!p.bonusUnlocked) return false;
  const b = idx - p.regular.length;
  return b === 0 || hasClearedSong(p.bonus[b - 1]);
}

/** Split a line into plain and highlighted runs for the given words. */
export function highlightRuns(line: string, words: string[]): { text: string; hit: boolean }[] {
  if (!words.length) return [{ text: line, hit: false }];
  const set = new Set(words.map((w) => w.toLowerCase()));
  const runs: { text: string; hit: boolean }[] = [];
  for (const part of line.split(/(\s+)/)) {
    const key = part.toLowerCase().replace(/[’`]/g, "'").replace(/^[^a-z']+|[^a-z']+$/g, '');
    const hit = !!key && (set.has(key) || set.has(key.replace(/in'$/, 'ing')));
    const last = runs[runs.length - 1];
    if (last && last.hit === hit) last.text += part;
    else runs.push({ text: part, hit });
  }
  return runs;
}

export const MOOD_LABEL: Record<string, string> = {
  bright: 'Bright',
  rising: 'Rising',
  restless: 'Restless',
  heavy: 'Heavy',
};
