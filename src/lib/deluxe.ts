/**
 * Deluxe edition access.
 *
 * A song's Deluxe chart (`day-XXX_deluxe`, see src/game/chartMaster) opens
 * for a player who either
 *   - owns that day's Deluxe card (minted by the Deluxe pack, source
 *     `pack_deluxe`), or
 *   - earned it in gameplay: a run of the standard chart at or above
 *     DELUXE_UNLOCK_ACCURACY, the same bar as the top (Prophecy) reward tier.
 *
 * Earned unlocks come from the player's own gameplay_records, cached here and
 * mirrored to localStorage so the unlock shows immediately after a run.
 *
 * Audius weekly contest songs ("aud-<id>") have a Deluxe chart too
 * ("aud-<id>_deluxe"). There is no Deluxe card for them, so only a run of the
 * standard chart at DELUXE_UNLOCK_ACCURACY opens it. Those unlocks are kept by
 * song id instead of day.
 */

import { supabase } from '@/services/supabaseClient';
import type { OwnedCard } from '@/services/vaultService';
import { cardMatchesDay } from '@/store/useVaultStore';

/** Same bar as the Prophecy reward tier (GameResults getTierForAccuracy). */
export const DELUXE_UNLOCK_ACCURACY = 97;

const LOCAL_KEY = 'pim_deluxe_unlocked_days';
const LOCAL_SONGS_KEY = 'pim_deluxe_unlocked_songs';
const CONTEST_PREFIX = 'aud-';

export function deluxeSongId(day: number): string {
  return `day-${String(day).padStart(3, '0')}_deluxe`;
}

export function isDeluxeSongId(id: string | null | undefined): boolean {
  return !!id && id.endsWith('_deluxe');
}

/** Day number of a standard or Deluxe song id ('day-014', 'card-14', 'day-014_deluxe'). */
export function dayFromSongId(id: string | null | undefined): number | null {
  const m = (id || '').match(/^(?:day|card)[-_]0*(\d{1,3})(?:_deluxe)?$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 365 ? n : null;
}

/** Deluxe cards come from the Deluxe pack; vault-engine tags them `pack_deluxe`. */
export function isDeluxeCard(c: OwnedCard | null | undefined): boolean {
  return !!c && c.source === 'pack_deluxe';
}

export function ownsDeluxeCardForDay(collection: OwnedCard[] | null | undefined, day: number): boolean {
  return Array.isArray(collection) && collection.some((c) => isDeluxeCard(c) && cardMatchesDay(c, day));
}

function readLocal(): Set<number> {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    return new Set(Array.isArray(raw) ? raw.filter((n) => Number.isInteger(n)) : []);
  } catch {
    return new Set();
  }
}

function writeLocal(days: Set<number>) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify([...days].sort((a, b) => a - b)));
  } catch {
    // storage unavailable — the server records still hold the unlock
  }
}

function readLocalSongs(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_SONGS_KEY) || '[]');
    return new Set(Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeLocalSongs(ids: Set<string>) {
  try {
    localStorage.setItem(LOCAL_SONGS_KEY, JSON.stringify([...ids].sort()));
  } catch {
    // storage unavailable — the server records still hold the unlock
  }
}

/** Standard song id of a contest song's Deluxe id, or null when it isn't one. */
export function contestBaseSongId(id: string | null | undefined): string | null {
  if (!id || !id.startsWith(CONTEST_PREFIX)) return null;
  return id.replace(/_deluxe$/, '');
}

let earned = readLocal();
let earnedSongs = readLocalSongs();
let loadedFor: string | null = null;
let loading: Promise<Set<number>> | null = null;

/** Days the player has earned Deluxe on, from their gameplay records. */
export function loadEarnedDeluxeDays(userId: string | null | undefined): Promise<Set<number>> {
  if (!userId) return Promise.resolve(earned);
  if (loadedFor === userId) return Promise.resolve(earned);
  if (loading) return loading;
  loading = (async () => {
    try {
      const { data, error } = await supabase
        .from('gameplay_records')
        .select('song_id')
        .eq('user_id', userId)
        .gte('accuracy', DELUXE_UNLOCK_ACCURACY);
      if (error) throw error;
      for (const row of data ?? []) {
        if (isDeluxeSongId(row.song_id)) continue;
        if (row.song_id?.startsWith(CONTEST_PREFIX)) {
          earnedSongs.add(row.song_id);
          continue;
        }
        const day = dayFromSongId(row.song_id);
        if (day) earned.add(day);
      }
      writeLocal(earned);
      writeLocalSongs(earnedSongs);
      loadedFor = userId;
    } catch (err) {
      console.warn('[Deluxe] Could not load earned unlocks:', err);
    } finally {
      loading = null;
    }
    return earned;
  })();
  return loading;
}

/** Record an unlock earned this session (the run's gameplay record is the source of truth). */
export function markDeluxeEarned(day: number) {
  if (!Number.isInteger(day) || day < 1 || day > 365) return;
  earned = new Set(earned).add(day);
  writeLocal(earned);
}

export function hasEarnedDeluxe(day: number): boolean {
  return earned.has(day);
}

export function isDeluxeUnlocked(collection: OwnedCard[] | null | undefined, day: number): boolean {
  return hasEarnedDeluxe(day) || ownsDeluxeCardForDay(collection, day);
}

/** Record a contest song's Deluxe unlock earned this session. */
export function markSongDeluxeEarned(baseSongId: string) {
  if (!baseSongId.startsWith(CONTEST_PREFIX) || isDeluxeSongId(baseSongId)) return;
  earnedSongs = new Set(earnedSongs).add(baseSongId);
  writeLocalSongs(earnedSongs);
}

/** Whether the player has opened a contest song's Deluxe chart (by its standard id). */
export function hasEarnedSongDeluxe(baseSongId: string): boolean {
  return earnedSongs.has(baseSongId);
}
