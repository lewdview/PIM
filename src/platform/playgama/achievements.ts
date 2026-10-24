/**
 * Earns the monthly build's achievements (list in achievementList.ts) from the
 * saved medals and scores, so they can be checked again at any time and
 * nothing is lost if a portal call fails. Each newly earned one is sent to the
 * portal once through the Bridge; the ones already sent are kept in
 * localStorage, which bridge.ts mirrors into bridge.storage.
 */
import type { GameSong } from '@/game/api';
import { getHighScore, getMedalForSong } from '@/game/progress';
import { hasClearedSong, type ChapterProgress } from '@/game/chapterStory';
import { CHAPTERS } from '@/game/campaign';
import { ACHIEVEMENTS, type AchievementDef } from './achievementList';
import { unlockPortalAchievement } from './bridge';
import { PLAYGAMA_MONTH } from './month';

export type AchievementId = (typeof ACHIEVEMENTS)[number]['id'];
export interface AchievementState extends AchievementDef { earned: boolean }

const SENT_KEY = `pg_ach_sent_m${PLAYGAMA_MONTH}`;
const fcKey = (runId: string) => `pg_fc_${runId}`;
const deluxeId = (id: string) => `${id}_deluxe`;
const GOLD_UP = new Set(['GOLD', 'PLATINUM']);

/** Called from the results screen: a full combo isn't kept anywhere else. */
export function recordFullCombo(runId: string): void {
  try {
    localStorage.setItem(fcKey(runId), 'true');
  } catch { /* storage blocked */ }
}

function hasFullCombo(runId: string): boolean {
  try {
    return localStorage.getItem(fcKey(runId)) === 'true';
  } catch {
    return false;
  }
}

function readSent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SENT_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function achievementStates(songs: GameSong[], p: ChapterProgress): AchievementState[] {
  const meta = CHAPTERS.find((c) => c.month === PLAYGAMA_MONTH) ?? CHAPTERS[0];
  const medals = songs.map((s) => getMedalForSong(s.id));
  const deluxeMedals = songs.map((s) => getMedalForSong(deluxeId(s.id)));
  const plats = medals.filter((m) => m === 'PLATINUM').length;
  const deluxeCleared = songs.some((s, i) => (!!deluxeMedals[i] && deluxeMedals[i] !== 'NONE') || getHighScore(deluxeId(s.id)) > 0);
  const all = songs.length > 0;
  const earned: Record<string, boolean> = {
    first_clear: songs.some(hasClearedSong),
    first_gold: medals.some((m) => GOLD_UP.has(m)),
    first_platinum: plats > 0,
    full_combo: songs.some((s) => hasFullCombo(s.id) || hasFullCombo(deluxeId(s.id))),
    bonus_open: p.bonus.length > 0 && p.platinums >= meta.platNeeded,
    chapter_clear: p.complete,
    epilogue: p.bonus.length > 0 && p.bonus.every(hasClearedSong),
    deluxe_clear: deluxeCleared,
    deluxe_platinum: deluxeMedals.includes('PLATINUM'),
    all_gold: all && medals.every((m) => GOLD_UP.has(m)),
    true_ending: all && plats === songs.length,
    bombshell_ending: all && plats === songs.length && deluxeMedals.every((m) => m === 'PLATINUM'),
  };
  return ACHIEVEMENTS.map((a) => ({ ...a, earned: !!earned[a.id] }));
}

/**
 * Sends every earned achievement the portal hasn't had yet. Returns the ones
 * earned since the last check, so a screen can call them out.
 */
export async function syncAchievements(songs: GameSong[], p: ChapterProgress): Promise<AchievementState[]> {
  if (PLAYGAMA_MONTH === 0) return [];
  const sent = new Set(readSent());
  const fresh = achievementStates(songs, p).filter((a) => a.earned && !sent.has(a.id));
  if (!fresh.length) return [];
  // Recorded before the portal answers, so a slow call never shows a toast twice.
  fresh.forEach((a) => sent.add(a.id));
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify([...sent]));
  } catch { /* storage blocked */ }
  for (const a of fresh) await unlockPortalAchievement(a.id);
  return fresh;
}
