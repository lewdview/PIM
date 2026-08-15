import type { Rarity } from './rarity';
import type { OwnedCard, VaultCard } from '../services/vaultService';
import bombshellCoversMapRaw from '../game/bombshell_covers_map.json';

export interface BombshellDayCovers {
  day: number;
  dir: string;
  lbFiles: string[];
  normalFiles: string[];
  totalCovers: number;
}

export const BOMBSHELL_COVERS_MAP: Record<string, BombshellDayCovers> = bombshellCoversMapRaw as Record<string, BombshellDayCovers>;

const SUPABASE_BASE = 'https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready/';
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
 * Deterministically or randomly select an artwork for a Bombshell card pull:
 * - Common & Uncommon get LB cards (`lbFiles`)
 * - Rare, Legendary & Mythic get Normal cards (`normalFiles`)
 * Falls back gracefully if a category is empty for that day.
 */
export function pickBombshellArtwork(
  day: number,
  rarity: Rarity,
  preferredIndex?: number
): { fileName: string; coverUrl: string; isLB: boolean } {
  const dayCovers = getBombshellDayCovers(day);
  const isLBTier = rarity === 'common' || rarity === 'uncommon';

  let candidatePool = isLBTier ? dayCovers.lbFiles : dayCovers.normalFiles;
  let isLB = isLBTier;

  // Fallbacks if candidate pool is empty for that day
  if (!candidatePool || candidatePool.length === 0) {
    if (isLBTier && dayCovers.normalFiles.length > 0) {
      candidatePool = dayCovers.normalFiles;
      isLB = false;
    } else if (!isLBTier && dayCovers.lbFiles.length > 0) {
      candidatePool = dayCovers.lbFiles;
      isLB = true;
    }
  }

  // If still empty (should not happen with full map), fallback to formatted standard name
  if (!candidatePool || candidatePool.length === 0) {
    const padDay = String(day).padStart(3, '0');
    const fallbackName = isLBTier ? `lb day ${padDay} - 01.jpg` : `day ${padDay} - 01.jpg`;
    return {
      fileName: fallbackName,
      coverUrl: getBombshellCoverUrl(day, fallbackName),
      isLB,
    };
  }

  const selectedIdx = preferredIndex !== undefined && preferredIndex >= 0
    ? preferredIndex % candidatePool.length
    : Math.floor(Math.random() * candidatePool.length);

  const selectedFile = candidatePool[selectedIdx];

  return {
    fileName: selectedFile,
    coverUrl: getBombshellCoverUrl(day, selectedFile),
    isLB,
  };
}

/**
 * Check if a card belongs to the Bombshell set.
 */
export function isBombshellCard(cardOrOwned: any): boolean {
  if (!cardOrOwned) return false;
  if (cardOrOwned.cardSet === 'bombshell' || cardOrOwned.card?.cardSet === 'bombshell') return true;
  if (cardOrOwned.source?.includes('bombshell') || cardOrOwned.cardId?.startsWith('bombshell-')) return true;
  if (cardOrOwned.coverArtwork?.startsWith('lb day') || cardOrOwned.coverArtwork?.startsWith('day ')) return true;
  if (typeof cardOrOwned.coverUrl === 'string' && (cardOrOwned.coverUrl.includes('/girl-covers/days/') || cardOrOwned.coverUrl.includes('/rare_covers/'))) return true;
  if (typeof cardOrOwned.card?.coverUrl === 'string' && (cardOrOwned.card.coverUrl.includes('/girl-covers/days/') || cardOrOwned.card.coverUrl.includes('/rare_covers/'))) return true;
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

