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

  if (!rule.useAlternate) {
    return originalUrlOrPath;
  }

  let url = originalUrlOrPath;

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
 * 1. Tries primary alternate cover (e.g. girls-cover/*.jpg)
 * 2. Tries girl-covers/*.jpg variant
 * 3. Tries alternate PNG variant (e.g. girls-cover/*.png)
 * 4. Tries alternate-covers/*.jpg if girls-cover is missing
 * 5. Gracefully falls back to original cover (covers/*.jpg) if all alternate art is missing/404!
 */
export function useSmartCoverArt(
  originalCoverUrl: string | undefined | null,
  rarity?: string | Rarity
) {
  const original = originalCoverUrl || '';
  const primary = getCoverUrlForRarity(original, rarity);
  
  const altPng = primary.endsWith('.jpg') ? primary.replace(/\.jpg$/i, '.png') : '';
  const altJpg = primary.endsWith('.png') ? primary.replace(/\.png$/i, '.jpg') : '';
  
  const altGirlCoversJpg = primary.includes('/girls-cover/')
    ? primary.replace(/\/girls-cover\//g, '/girl-covers/')
    : (primary.includes('/girl-covers/') ? primary.replace(/\/girl-covers\//g, '/girls-cover/') : '');

  const altCoversJpg = primary.includes('/girls-cover/') || primary.includes('/girl-covers/')
    ? primary.replace(/\/(girls-cover|girl-covers)\//g, '/alternate-covers/')
    : '';

  const [src, setSrc] = useState(primary);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const target = getCoverUrlForRarity(original, rarity);
    setSrc(target);
    setFailed(false);
  }, [original, rarity]);

  const handleError = () => {
    if (src === primary && altGirlCoversJpg && altGirlCoversJpg !== primary && altGirlCoversJpg !== original) {
      setSrc(altGirlCoversJpg);
    } else if (src === primary && altPng && altPng !== primary && altPng !== original) {
      setSrc(altPng);
    } else if (src === primary && altJpg && altJpg !== primary && altJpg !== original) {
      setSrc(altJpg);
    } else if (altCoversJpg && src !== altCoversJpg && altCoversJpg !== original) {
      setSrc(altCoversJpg);
    } else if (src !== original && original) {
      setSrc(original);
    } else {
      setFailed(true);
    }
  };

  return {
    src,
    failed,
    handleError,
    isFallback: src === original && primary !== original,
    isSquare: src.includes('/girls-cover/') || src.includes('/girl-covers/') || src.includes('/alternate-covers/'),
  };
}
