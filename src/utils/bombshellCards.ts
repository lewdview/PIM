import type { Rarity } from './rarity';
import type { OwnedCard, VaultCard } from '../services/vaultService';
import bombshellCoversMapRaw from '../game/bombshell_covers_map.json';

import { STORAGE_BASE } from '../services/supabaseClient';

export interface BombshellDayCovers {
  day: number;
  dir: string;
  lbFiles: string[];
  normalFiles: string[];
  totalCovers: number;
}

export const BOMBSHELL_COVERS_MAP: Record<string, BombshellDayCovers> = bombshellCoversMapRaw as Record<string, BombshellDayCovers>;

const SUPABASE_BASE = STORAGE_BASE;
const LOCAL_BASE = '/@fs/Volumes/extremeUno/th3scr1b3-365-warp/365-releases/rare_covers/';

/**
 * Resolves full public Supabase or local URL for a specific bombshell cover file.
 */
export function getBombshellCoverUrl(day: number, fileName: string): string {
  const useLocal = (typeof localStorage !== 'undefined' && 
    (localStorage.getItem('opt_useLocalFiles') === 'true' || localStorage.getItem('useLocalFiles') === 'true')) || 
    (import.meta.env && import.meta.env.VITE_USE_LOCAL_FILES === 'true');

  if (useLocal) {
    return `${LOCAL_BASE}day ${day}/${fileName}`;
  }

  return `${SUPABASE_BASE}girl-covers/days/day%20${day}/${encodeURIComponent(fileName)}`;
}

/**
 * Returns ordered candidate URLs to try for a Bombshell cover.
 * Completely independent of month folders (Supabase <-> Local <-> Sibling covers).
 */
export function getBombshellCoverCandidates(day: number, fileName: string): string[] {
  const primary = getBombshellCoverUrl(day, fileName);
  const supabaseUrl = `${SUPABASE_BASE}girl-covers/days/day%20${day}/${encodeURIComponent(fileName)}`;
  const localUrl = `${LOCAL_BASE}day ${day}/${fileName}`;

  const candidates: string[] = [primary];
  if (primary !== supabaseUrl) candidates.push(supabaseUrl);
  if (primary !== localUrl) candidates.push(localUrl);

  // Sibling cover fallback for this day if specific file is missing
  const dayCovers = getBombshellDayCovers(day);
  const allDayFiles = [...dayCovers.lbFiles, ...dayCovers.normalFiles];
  for (const f of allDayFiles) {
    if (f !== fileName) {
      const sibUrl = getBombshellCoverUrl(day, f);
      if (!candidates.includes(sibUrl)) {
        candidates.push(sibUrl);
      }
    }
  }

  return Array.from(new Set(candidates)).filter(Boolean);
}

/**
 * Get available cover list for a specific day.
 */
export function getBombshellDayCovers(day: number): BombshellDayCovers {
  const entry = BOMBSHELL_COVERS_MAP[String(day)];
  if (entry) return entry;

  return {
    day,
    dir: `day ${day}`,
    lbFiles: [],
    normalFiles: [],
    totalCovers: 0,
  };
}

/**
 * Master collection of all Bombshell pack designs across top, bot, light, and dark variants.
 */
export const ALL_BOMBSHELL_PACK_COVERS = [
  '/data/packs/bombshell_top_1card.jpg',
  '/data/packs/bombshell_bot_1card.jpg',
  '/data/packs/bombshell_top_2cards.jpg',
  '/data/packs/bombshell_bot_2cards.jpg',
  '/data/packs/bombshell_top_5cards.jpg',
  '/data/packs/bombshell_bot_5cards.jpg',
  '/data/packs/bombshell_top_10cards.jpg',
  '/data/packs/bombshell_bot_10cards.jpg',
  '/data/packs/bombshell_top_25cards.jpg',
  '/data/packs/bombshell_bot_25cards.jpg',
  '/data/packs/bombshell_top_50cards.jpg',
  '/data/packs/bombshell_bot_50cards.jpg',
  '/data/packs/bombshell_dark_1card.jpg',
  '/data/packs/bombshell_light_1card.jpg',
  '/data/packs/bombshell_dark_2cards.jpg',
  '/data/packs/bombshell_light_2cards.jpg',
  '/data/packs/bombshell_dark_5cards.jpg',
  '/data/packs/bombshell_light_5cards.jpg',
  '/data/packs/bombshell_dark_10cards.jpg',
  '/data/packs/bombshell_light_10cards.jpg',
  '/data/packs/bombshell_dark_25cards.jpg',
  '/data/packs/bombshell_light_25cards.jpg',
  '/data/packs/bombshell_dark_50cards.jpg',
  '/data/packs/bombshell_light_50cards.jpg',
];

/**
 * Returns both candidate cover images for a bombshell pack size (top and bottom variants).
 * Supported counts: 1, 2, 5, 10, 25, 50
 */
export function getBombshellPackCovers(cardCount: number = 1): { top: string; bot: string } {
  const normalizedCount = cardCount >= 50 ? 50 : cardCount >= 25 ? 25 : cardCount >= 10 ? 10 : cardCount >= 5 ? 5 : cardCount >= 2 ? 2 : 1;
  const plural = normalizedCount === 1 ? 'card' : 'cards';
  return {
    top: `/data/packs/bombshell_top_${normalizedCount}${plural}.jpg`,
    bot: `/data/packs/bombshell_bot_${normalizedCount}${plural}.jpg`,
  };
}

/**
 * Returns a random pack design from the Bombshell collection.
 * If a standard count (1, 2, 5, 10, 25, 50) is passed, picks between matching top/bot variants.
 * For 3-card token packs or general pulls, picks randomly from all pack designs in the collection.
 */
export function getRandomBombshellPackCover(cardCount?: number): string {
  if (cardCount && [1, 2, 5, 10, 25, 50].includes(cardCount)) {
    const { top, bot } = getBombshellPackCovers(cardCount);
    return Math.random() < 0.5 ? top : bot;
  }
  return ALL_BOMBSHELL_PACK_COVERS[Math.floor(Math.random() * ALL_BOMBSHELL_PACK_COVERS.length)];
}

/**
 * Returns a featured close-up bombshell cover URL for pack backgrounds and foil artwork embedding.
 */
export function getFeaturedBombshellFoilCover(day?: number, cardCount?: number): string {
  return getRandomBombshellPackCover(cardCount);
}

/**
 * Deterministically or randomly select an artwork for a Bombshell card pull:
 * Both Letterbox (LB) and Normal (Full Frame) covers can be pulled on ANY card rarity tier.
 * Falls back gracefully if a category is empty for that day.
 */
export function pickBombshellArtwork(
  day: number,
  rarity?: Rarity,
  preferredIndex?: number
): { fileName: string; coverUrl: string; isLB: boolean } {
  const dayCovers = getBombshellDayCovers(day);
  const allFiles = [...dayCovers.lbFiles, ...dayCovers.normalFiles];

  // If no files found in map, fallback to formatted standard name
  if (allFiles.length === 0) {
    const padDay = String(day).padStart(3, '0');
    const isLB = Math.random() > 0.5;
    const fallbackName = isLB ? `lb day ${padDay} - 01.jpg` : `day ${padDay} - 01.jpg`;
    return {
      fileName: fallbackName,
      coverUrl: getBombshellCoverUrl(day, fallbackName),
      isLB,
    };
  }

  const selectedIdx = preferredIndex !== undefined && preferredIndex >= 0
    ? preferredIndex % allFiles.length
    : Math.floor(Math.random() * allFiles.length);

  const selectedFile = allFiles[selectedIdx];
  const isLB = selectedFile.toLowerCase().startsWith('lb');

  return {
    fileName: selectedFile,
    coverUrl: getBombshellCoverUrl(day, selectedFile),
    isLB,
  };
}

/**
 * Get user-selected active custom cover preference for a specific day.
 */
export function getCustomBombshellCover(day: number): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(`preferred_bombshell_cover_${day}`);
  } catch {
    return null;
  }
}

/**
 * Set user-selected active custom cover preference for a specific day.
 */
export function setCustomBombshellCover(day: number, fileName: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`preferred_bombshell_cover_${day}`, fileName);
    window.dispatchEvent(new CustomEvent('bombshell_cover_changed', { detail: { day, fileName } }));
  } catch {}
}

/**
 * Resolves the active display cover for a day (honoring user preference, owned cards, or day default).
 */
export function getActiveBombshellCover(
  day: number,
  unlockedCovers?: Set<string>,
  latestCard?: OwnedCard
): { fileName: string; coverUrl: string; isLB: boolean } {
  const dayCovers = getBombshellDayCovers(day);
  const customPref = getCustomBombshellCover(day);

  let fileName = '';
  if (customPref && (unlockedCovers?.has(customPref) || dayCovers.totalCovers > 0)) {
    fileName = customPref;
  } else if (latestCard?.coverArtwork) {
    fileName = latestCard.coverArtwork;
  } else if (unlockedCovers && unlockedCovers.size > 0) {
    fileName = Array.from(unlockedCovers)[0];
  } else if (dayCovers.normalFiles.length > 0) {
    fileName = dayCovers.normalFiles[0];
  } else if (dayCovers.lbFiles.length > 0) {
    fileName = dayCovers.lbFiles[0];
  } else {
    fileName = `day ${String(day).padStart(3, '0')} - 01.jpg`;
  }

  const isLB = fileName.toLowerCase().startsWith('lb');
  return {
    fileName,
    coverUrl: getBombshellCoverUrl(day, fileName),
    isLB,
  };
}

/**
 * Check if a card belongs to the Bombshell set.
 */
export function isBombshellCard(cardOrOwned: any): boolean {
  if (!cardOrOwned) return false;

  // Explicit cardSet property
  const setStr = cardOrOwned.cardSet || cardOrOwned.card_set || cardOrOwned.card?.cardSet || cardOrOwned.card?.card_set;
  if (typeof setStr === 'string' && setStr.toLowerCase() === 'bombshell') return true;

  // Card ID prefix (e.g. "bombshell-1", "bombshell-day-1")
  const cardId = cardOrOwned.cardId || cardOrOwned.card_id || cardOrOwned.card?.id || cardOrOwned.id;
  if (typeof cardId === 'string' && cardId.toLowerCase().startsWith('bombshell')) return true;

  // Pack / Pull source (e.g. "Bombshell Pack", "The Bombshell Archive", "pack_bombshell")
  const source = cardOrOwned.source || cardOrOwned.card?.source;
  if (typeof source === 'string' && source.toLowerCase().includes('bombshell')) return true;

  // Proof metadata
  if (cardOrOwned.proof && typeof cardOrOwned.proof === 'object') {
    if (cardOrOwned.proof.set === 'bombshell' || cardOrOwned.proof.type === 'bombshell') return true;
  }

  // Cover Artwork filename check (e.g. "lb day 001 - 01.jpg", "day 001 - 01.jpg")
  const coverArtwork = cardOrOwned.coverArtwork || cardOrOwned.cover_artwork || cardOrOwned.card?.coverArtwork;
  if (typeof coverArtwork === 'string' && coverArtwork.trim().length > 0) {
    const lower = coverArtwork.toLowerCase();
    if (lower.startsWith('lb day') || lower.startsWith('day ') || lower.includes('day_') || /^(lb\s*)?day\s*\d+/i.test(lower)) {
      return true;
    }
  }

  // Cover URL path inspection (e.g. /girl-covers/days/day 1/...)
  const coverUrl = cardOrOwned.coverUrl || cardOrOwned.cover_url || cardOrOwned.card?.coverUrl || cardOrOwned.card?.cover_url;
  if (typeof coverUrl === 'string') {
    const lowerUrl = coverUrl.toLowerCase();
    if (
      lowerUrl.includes('/girl-covers/') || 
      lowerUrl.includes('/rare_covers/') || 
      lowerUrl.includes('rare_covers') || 
      lowerUrl.includes('girl-covers')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Get all unlocked cover filenames for a specific day from the user's collection.
 */
export function getBombshellUnlockedCoversForDay(collection: OwnedCard[], day: number): Set<string> {
  const unlocked = new Set<string>();
  const dayCovers = getBombshellDayCovers(day);
  const allDayFiles = new Set([...dayCovers.lbFiles, ...dayCovers.normalFiles]);

  for (const c of collection) {
    if (!c || !c.card || c.card.day !== day) continue;
    if (!isBombshellCard(c)) continue;

    // Check specific cover artwork field
    const artwork = (c as any).coverArtwork || (c.card as any).coverArtwork;
    if (artwork && allDayFiles.has(artwork)) {
      unlocked.add(artwork);
      continue;
    }

    // Check by matching coverUrl filename
    const coverUrl = c.card.coverUrl || '';
    for (const f of allDayFiles) {
      if (coverUrl.includes(encodeURIComponent(f)) || coverUrl.includes(f)) {
        unlocked.add(f);
      }
    }
  }

  return unlocked;
}

/**
 * Global Bombshell Collection Statistics.
 */
export function getBombshellCollectionStats(collection: OwnedCard[]): {
  totalUnlockedCovers: number;
  totalAvailableCovers: number;
  daysWithAtLeastOne: number;
  percentComplete: number;
} {
  let totalAvailableCovers = 0;
  let totalUnlockedCovers = 0;
  let daysWithAtLeastOne = 0;

  for (let day = 1; day <= 365; day++) {
    const dayCovers = getBombshellDayCovers(day);
    totalAvailableCovers += dayCovers.totalCovers;

    const unlockedSet = getBombshellUnlockedCoversForDay(collection, day);
    totalUnlockedCovers += unlockedSet.size;

    if (unlockedSet.size > 0) {
      daysWithAtLeastOne++;
    }
  }

  const percentComplete = totalAvailableCovers > 0 
    ? Math.round((totalUnlockedCovers / totalAvailableCovers) * 100) 
    : 0;

  return {
    totalUnlockedCovers,
    totalAvailableCovers,
    daysWithAtLeastOne,
    percentComplete,
  };
}

/**
 * Resolves the High-Resolution PNG URL from the 'hi res' folder inside the day directory.
 */
export function getBombshellHiResPngUrl(day: number, fileName: string): string {
  const pngFileName = fileName.replace(/\.jpe?g$/i, '.png');
  const useLocal = (typeof localStorage !== 'undefined' && 
    (localStorage.getItem('opt_useLocalFiles') === 'true' || localStorage.getItem('useLocalFiles') === 'true')) || 
    (import.meta.env && import.meta.env.VITE_USE_LOCAL_FILES === 'true');

  if (useLocal) {
    return `${LOCAL_BASE}day ${day}/hi res/${pngFileName}`;
  }

  return `${SUPABASE_BASE}girl-covers/days/day%20${day}/hi%20res/${encodeURIComponent(pngFileName)}`;
}

/**
 * Returns candidate URLs for high-resolution PNG downloads (Local <-> Supabase <-> JPG Fallback).
 */
export function getBombshellHiResCandidates(day: number, fileName: string): string[] {
  const pngFileName = fileName.replace(/\.jpe?g$/i, '.png');
  const primary = getBombshellHiResPngUrl(day, fileName);
  const supabaseUrl = `${SUPABASE_BASE}girl-covers/days/day%20${day}/hi%20res/${encodeURIComponent(pngFileName)}`;
  const localUrl = `${LOCAL_BASE}day ${day}/hi res/${pngFileName}`;
  const jpgUrl = getBombshellCoverUrl(day, fileName);

  const list = [primary];
  if (primary !== supabaseUrl) list.push(supabaseUrl);
  if (primary !== localUrl) list.push(localUrl);
  list.push(jpgUrl);

  return Array.from(new Set(list));
}

/**
 * Direct High-Resolution Master PNG Downloader.
 * Fetches original binary asset and triggers a native client download.
 */
export async function downloadBombshellHiResArtwork(day: number, fileName: string): Promise<boolean> {
  const pngFileName = fileName.replace(/\.jpe?g$/i, '.png');
  const candidates = getBombshellHiResCandidates(day, fileName);

  for (const url of candidates) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `Day_${String(day).padStart(3, '0')}_${pngFileName.replace(/\s+/g, '_')}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
      return true;
    } catch (e) {
      console.warn(`Could not fetch hi-res from candidate: ${url}`, e);
    }
  }

  // Fallback: window.open direct URL in a new window/tab
  const fallbackUrl = getBombshellHiResPngUrl(day, fileName);
  window.open(fallbackUrl, '_blank');
  return true;
}

