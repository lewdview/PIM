import { useState, useEffect } from 'react';
import type { Rarity } from './rarity';

export interface RarityArtworkRule {
  /** Whether this rarity uses alternate artwork instead of original covers */
  useAlternate: boolean;
  /** Storage folder name relative to bucket (e.g. 'girls-cover', 'girl-covers', 'alternate-covers', or 'covers') */
  folder: string;
  /** File extension override (e.g. '.jpg' or '.png'). null to keep original extension */
  extension: '.png' | '.jpg' | '.jpeg' | '.webp' | null;
}

/**
 * Registry of artwork rules per rarity level:
 * - common: Original covers ('covers')
 * - uncommon: Alternate covers ('alternate-covers/*.jpg')
 * - rare: Square covers ('girls-cover/*.jpg' / 'girl-covers/*.jpg') with multi-tier fallback
 * - legendary: Alternate covers ('alternate-covers/*.jpg')
 */
export const RARITY_ARTWORK_CONFIG: Record<string, RarityArtworkRule> = {
  common: {
    useAlternate: false,
    folder: 'covers',
    extension: null,
  },
  uncommon: {
    useAlternate: true,
    folder: 'alternate-covers',
    extension: '.jpg',
  },
  rare: {
    useAlternate: true,
    folder: 'girls-cover',
    extension: '.jpg',
  },
  legendary: {
    useAlternate: true,
    folder: 'alternate-covers',
    extension: '.jpg',
  },
  mythic: {
    useAlternate: false,
    folder: 'covers',
    extension: null,
  },
  mythical: {
    useAlternate: false,
    folder: 'covers',
    extension: null,
  },
};

/**
 * Easy configuration helper to toggle or update custom artwork for any rarity.
 * E.g. setRarityArtworkConfig('rare', { useAlternate: true, folder: 'girls-cover', extension: '.jpg' })
 */
export function setRarityArtworkConfig(
  rarity: string | Rarity,
  rule: Partial<RarityArtworkRule>
): void {
  const key = String(rarity).toLowerCase();
  const existing = RARITY_ARTWORK_CONFIG[key] || {
    useAlternate: false,
    folder: 'covers',
    extension: null,
  };
  RARITY_ARTWORK_CONFIG[key] = {
    ...existing,
    ...rule,
  };
}

/**
 * Resolves the artwork URL/path for a given card based on its original cover URL and rarity level.
 *
 * Examples:
 * Original: https://.../releaseready/covers/january/01%20-%20Were%20Going%20Crazy%20World.jpg
 * Rare (useAlternate=true, folder='girls-cover', extension='.jpg'):
 *   => https://.../releaseready/girls-cover/january/01%20-%20Were%20Going%20Crazy%20World.jpg
 */
export function getCoverUrlForRarity(
  originalUrlOrPath: string | undefined | null,
  rarity?: string | Rarity
): string {
  if (!originalUrlOrPath) return '';

  // Preserve Bombshell and rare_covers artwork directly without mutating folder paths
  if (
    originalUrlOrPath.includes('/girl-covers/days/') ||
    originalUrlOrPath.includes('/rare_covers/') ||
    originalUrlOrPath.includes('lb%20day') ||
    originalUrlOrPath.includes('lb day') ||
    originalUrlOrPath.includes('day%200') ||
    originalUrlOrPath.includes('day 0')
  ) {
    return originalUrlOrPath;
  }

  const key = String(rarity || 'common').toLowerCase();
  const rule = RARITY_ARTWORK_CONFIG[key] || RARITY_ARTWORK_CONFIG.common;

  // Normalize any previous alternate folder back to /covers/ first
  let url = originalUrlOrPath.replace(/\/(girls-cover|girl-covers|alternate-covers)\//g, '/covers/');
  if (url.startsWith('girls-cover/') || url.startsWith('girl-covers/') || url.startsWith('alternate-covers/')) {
    url = url.replace(/^(girls-cover|girl-covers|alternate-covers)\//, 'covers/');
  }

  if (!rule.useAlternate) {
    return url;
  }

  // Replace /covers/ folder with the target rarity folder (e.g. /girls-cover/ or /alternate-covers/)
  if (url.includes('/covers/')) {
    url = url.replace(/\/covers\//g, `/${rule.folder}/`);
  } else if (url.startsWith('covers/')) {
    url = url.replace(/^covers\//, `${rule.folder}/`);
  }

  // Replace file extension if specified in rule (e.g. .png -> .jpg)
  if (rule.extension) {
    url = url.replace(/\.(jpg|jpeg|png|webp)($|\?)/i, `${rule.extension}$2`);
  }

  return url;
}

const IMAGE_EXISTENCE_CACHE = new Map<string, boolean>();
const RESOLVED_COVER_CACHE = new Map<string, string>();

/**
 * Returns ordered candidate sequence of URLs to try for a card cover.
 */
export function getSmartCoverCandidates(
  originalCoverUrl: string | undefined | null,
  rarity?: string | Rarity
): string[] {
  const original = originalCoverUrl || '';
  if (!original) return [];

  if (
    original.includes('/girl-covers/days/') ||
    original.includes('/rare_covers/') ||
    original.includes('lb%20day') ||
    original.includes('lb day')
  ) {
    return [original];
  }

  const primary = getCoverUrlForRarity(original, rarity);
  const candidates: string[] = [];

  if (primary) candidates.push(primary);

  // Folder variants (girls-cover <-> girl-covers)
  if (primary.includes('/girls-cover/')) {
    candidates.push(primary.replace(/\/girls-cover\//g, '/girl-covers/'));
  } else if (primary.includes('/girl-covers/')) {
    candidates.push(primary.replace(/\/girl-covers\//g, '/girls-cover/'));
  }

  // Extension swaps (.jpg <-> .png)
  if (primary.endsWith('.jpg')) {
    candidates.push(primary.replace(/\.jpg$/i, '.png'));
  } else if (primary.endsWith('.png')) {
    candidates.push(primary.replace(/\.png$/i, '.jpg'));
  }

  // Fallback to alternate-covers if girls-cover / girl-covers fails
  if (primary.includes('/girls-cover/') || primary.includes('/girl-covers/')) {
    candidates.push(primary.replace(/\/(girls-cover|girl-covers)\//g, '/alternate-covers/'));
  }

  // Fallback to original covers/*.jpg (ensuring normalization back to covers/)
  const ogNormalized = original.replace(/\/(girls-cover|girl-covers|alternate-covers)\//g, '/covers/');
  if (ogNormalized && !candidates.includes(ogNormalized)) {
    candidates.push(ogNormalized);
  }

  if (ogNormalized.endsWith('.png')) {
    const originalJpg = ogNormalized.replace(/\.png$/i, '.jpg');
    if (!candidates.includes(originalJpg)) candidates.push(originalJpg);
  }

  return Array.from(new Set(candidates)).filter(Boolean);
}

/**
 * Tests if an image URL exists and loads cleanly. Caches test results in memory.
 */
export function checkImageExists(url: string): Promise<boolean> {
  if (IMAGE_EXISTENCE_CACHE.has(url)) {
    return Promise.resolve(IMAGE_EXISTENCE_CACHE.get(url)!);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      IMAGE_EXISTENCE_CACHE.set(url, true);
      resolve(true);
    };
    img.onerror = () => {
      IMAGE_EXISTENCE_CACHE.set(url, false);
      resolve(false);
    };
    img.src = url;
  });
}

/**
 * Asynchronously resolves and preloads the best working cover image URL before reveal.
 */
export async function resolveSmartCoverUrl(
  originalCoverUrl: string | undefined | null,
  rarity?: string | Rarity
): Promise<string> {
  const original = originalCoverUrl || '';
  if (!original) return '';

  const cacheKey = `${original}_${rarity || 'common'}`;
  if (RESOLVED_COVER_CACHE.has(cacheKey)) {
    return RESOLVED_COVER_CACHE.get(cacheKey)!;
  }

  const candidates = getSmartCoverCandidates(original, rarity);

  for (const candidate of candidates) {
    const exists = await checkImageExists(candidate);
    if (exists) {
      RESOLVED_COVER_CACHE.set(cacheKey, candidate);
      return candidate;
    }
  }

  RESOLVED_COVER_CACHE.set(cacheKey, original);
  return original;
}

/**
 * Smart Cover Art Hook:
 * Handles automatic graceful fallback when a custom cover format is missing or 404s.
 * Uses in-memory image pre-resolution cache so covers never flicker or glitch during reveals.
 */
export function useSmartCoverArt(
  originalCoverUrl: string | undefined | null,
  rarity?: string | Rarity
) {
  const original = originalCoverUrl || '';
  const cacheKey = `${original}_${rarity || 'common'}`;
  const cachedUrl = RESOLVED_COVER_CACHE.get(cacheKey);

  const candidates = getSmartCoverCandidates(original, rarity);
  const primary = getCoverUrlForRarity(original, rarity);

  const [currentSrc, setCurrentSrc] = useState<string>(cachedUrl || candidates[0] || original);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    if (RESOLVED_COVER_CACHE.has(cacheKey)) {
      setCurrentSrc(RESOLVED_COVER_CACHE.get(cacheKey)!);
      setFailed(false);
      return;
    }

    resolveSmartCoverUrl(original, rarity).then((resolved) => {
      if (active) {
        setCurrentSrc(resolved);
        setFailed(false);
      }
    });

    return () => {
      active = false;
    };
  }, [originalCoverUrl, rarity]);

  const handleError = () => {
    const currentIndex = candidates.indexOf(currentSrc);
    if (currentIndex >= 0 && currentIndex < candidates.length - 1) {
      const next = candidates[currentIndex + 1];
      setCurrentSrc(next);
      RESOLVED_COVER_CACHE.set(cacheKey, next);
    } else {
      setFailed(true);
    }
  };

  return {
    src: currentSrc,
    failed,
    handleError,
    isFallback: currentSrc === original && primary !== original,
    isSquare: currentSrc.includes('/girls-cover/') || currentSrc.includes('/girl-covers/') || currentSrc.includes('/alternate-covers/'),
  };
}
