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
 * To enable alternate artwork for another rarity level (uncommon, legendary, mythic):
 * simply set useAlternate: true, folder: 'alternate-covers' (or custom folder), and extension: '.png'.
 */
export const RARITY_ARTWORK_CONFIG: Record<string, RarityArtworkRule> = {
  common: {
    useAlternate: false,
    folder: 'covers',
    extension: null,
  },
  uncommon: {
    useAlternate: false,
    folder: 'covers',
    extension: null,
  },
  rare: {
    useAlternate: true,
    folder: 'alternate-covers',
    extension: '.png',
  },
  legendary: {
    useAlternate: false,
    folder: 'covers',
    extension: null,
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
 * Rare (useAlternate=true, folder='alternate-covers', extension='.png'):
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
