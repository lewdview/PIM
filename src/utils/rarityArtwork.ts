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

/**
 * Smart Cover Art Hook:
 * Handles automatic graceful fallback when a custom cover format is missing or 404s.
 * Prioritized Candidate List:
 * 1. Primary alternate cover (e.g. girls-cover/*.jpg or alternate-covers/*.jpg)
 * 2. Variant folder (e.g. girl-covers/*.jpg)
 * 3. Alternate PNG variant (e.g. girls-cover/*.png or alternate-covers/*.png)
 * 4. Alternate covers fallback (e.g. alternate-covers/*.jpg)
 * 5. Original cover (covers/*.jpg)
 */
export function useSmartCoverArt(
  originalCoverUrl: string | undefined | null,
  rarity?: string | Rarity
) {
  const original = originalCoverUrl || '';
  const primary = getCoverUrlForRarity(original, rarity);

  // Build ordered candidate sequence
  const candidates: string[] = [];

  if (primary) candidates.push(primary);

  // If primary is in girls-cover or girl-covers, check folder variant
  if (primary.includes('/girls-cover/')) {
    candidates.push(primary.replace(/\/girls-cover\//g, '/girl-covers/'));
  } else if (primary.includes('/girl-covers/')) {
    candidates.push(primary.replace(/\/girl-covers\//g, '/girls-cover/'));
  }

  // PNG/JPG extension swaps
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

  // Ensure original .jpg fallback if original was .png
  if (ogNormalized.endsWith('.png')) {
    const originalJpg = ogNormalized.replace(/\.png$/i, '.jpg');
    if (!candidates.includes(originalJpg)) candidates.push(originalJpg);
  }

  const uniqueCandidates = Array.from(new Set(candidates)).filter(Boolean);

  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setIndex(0);
    setFailed(false);
  }, [originalCoverUrl, rarity]);

  const currentSrc = uniqueCandidates[index] || original;

  const handleError = () => {
    if (index < uniqueCandidates.length - 1) {
      setIndex(prev => prev + 1);
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
