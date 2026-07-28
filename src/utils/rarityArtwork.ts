import { useState, useEffect } from 'react';
import type { Rarity } from './rarity';

export interface RarityArtworkRule {
  /** Whether this rarity uses alternate artwork instead of original covers */
  useAlternate: boolean;
  /** Storage folder name relative to bucket (e.g. 'alternate-covers' or 'covers') */
  folder: string;
  /** File extension override (e.g. '.png' or '.jpg'). null to keep original extension */
  extension: '.png' | '.jpg' | '.jpeg' | '.webp' | null;
}

/**
 * Registry of artwork rules per rarity level.
 * To enable alternate artwork for another rarity level:
 * set useAlternate: true, folder: 'alternate-covers', and extension: '.png'.
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
    extension: '.png',
  },
  rare: {
    useAlternate: false,
    folder: 'covers',
    extension: null,
  },
  legendary: {
    useAlternate: true,
    folder: 'alternate-covers',
    extension: '.png',
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
 * E.g. setRarityArtworkConfig('uncommon', { useAlternate: true, folder: 'alternate-covers', extension: '.png' })
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
 * Uncommon/Legendary (useAlternate=true, folder='alternate-covers', extension='.png'):
 *   => https://.../releaseready/alternate-covers/january/01%20-%20Were%20Going%20Crazy%20World.png
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

  // Replace /covers/ folder with the target rarity folder (e.g. /alternate-covers/)
  if (url.includes('/covers/')) {
    url = url.replace(/\/covers\//g, `/${rule.folder}/`);
  } else if (url.startsWith('covers/')) {
    url = url.replace(/^covers\//, `${rule.folder}/`);
  }

  // Replace file extension if specified in rule (e.g. .jpg -> .png)
  if (rule.extension) {
    url = url.replace(/\.(jpg|jpeg|png|webp)($|\?)/i, `${rule.extension}$2`);
  }

  return url;
}

/**
 * Smart Cover Art Hook:
 * Handles automatic graceful fallback when an alternate cover is missing or 404s.
 * 1. Tries primary alternate cover (e.g. alternate-covers/*.png)
 * 2. Tries alternate JPG variant if primary is PNG (e.g. alternate-covers/*.jpg)
 * 3. Gracefully falls back to original cover (covers/*.jpg) if alternate art is missing/404!
 */
export function useSmartCoverArt(
  originalCoverUrl: string | undefined | null,
  rarity?: string | Rarity
) {
  const original = originalCoverUrl || '';
  const primary = getCoverUrlForRarity(original, rarity);
  const altJpg = primary.endsWith('.png') ? primary.replace(/\.png$/i, '.jpg') : '';

  const [src, setSrc] = useState(primary);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const target = getCoverUrlForRarity(original, rarity);
    setSrc(target);
    setFailed(false);
  }, [original, rarity]);

  const handleError = () => {
    if (src === primary && altJpg && altJpg !== primary && altJpg !== original) {
      setSrc(altJpg);
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
  };
}
