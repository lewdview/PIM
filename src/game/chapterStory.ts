// Campaign story layer: what each month's chapter "says", distilled from the
// track lyrics by scripts/build_chapter_stories.mjs into chapter_stories.json.
// Also the shared chapter rules (regular vs bonus split, clears, unlocks) so
// the campaign list and the chapter screen agree on progress.

import stories from '@/data/chapter_stories.json';
import { loadCatalog, isSongTimeLocked, type GameSong } from './api';
import { hasCampaignClear, getCampaignPlatinums } from './progress';
import { CHAPTERS, calculateCampaignDifficulty, type ChapterMeta } from './campaign';
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

/** Cleared in the campaign: a passed run launched from the chapter. On-demand plays don't count. */
export function hasClearedSong(song?: GameSong): boolean {
  return !!song && hasCampaignClear(song.id);
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
  const platinums = getCampaignPlatinums(regular.map((s) => s.id));
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

/** Campaign difficulty for stage `idx` of a chapter. */
export function stageLevel(month: number, idx: number, p: ChapterProgress): number {
  const isBonus = idx >= p.regular.length;
  return calculateCampaignDifficulty(
    month,
    isBonus ? idx - p.regular.length : idx,
    isBonus ? p.bonus.length : p.regular.length,
    isBonus,
  );
}

export interface CampaignStage {
  song: GameSong;
  month: number;
  meta: ChapterMeta;
  songs: GameSong[];
  progress: ChapterProgress;
  idx: number;
  isBonus: boolean;
  level: number;
  unlocked: boolean;
  timeLocked: boolean;
  cleared: boolean;
}

/** Where a song sits in its chapter, with its campaign level and lock state. */
export async function getCampaignStage(songId: string): Promise<CampaignStage | null> {
  const catalog = await loadCatalog();
  const song = catalog.find((s) => s.id === songId);
  if (!song) return null;
  const month = song.day !== undefined
    ? getMonthNumFromDay(song.day)
    : parseInt(song.date?.split('-')[1] ?? '', 10);
  const meta = CHAPTERS.find((c) => c.month === month);
  if (!meta) return null;
  const songs = songsForMonth(catalog, month);
  const idx = songs.findIndex((s) => s.id === songId);
  if (idx === -1) return null;
  return stageAt(songs, meta, idx);
}

export function stageAt(songs: GameSong[], meta: ChapterMeta, idx: number): CampaignStage {
  const progress = chapterProgress(songs, meta);
  const song = songs[idx];
  return {
    song,
    month: meta.month,
    meta,
    songs,
    progress,
    idx,
    isBonus: idx >= progress.regular.length,
    level: stageLevel(meta.month, idx, progress),
    unlocked: isStageUnlocked(idx, progress),
    timeLocked: isSongTimeLocked(song),
    cleared: hasClearedSong(song),
  };
}
