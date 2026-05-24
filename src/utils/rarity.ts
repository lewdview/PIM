import {
  getAdminConfig,
  applyActiveModifiers,
  buildModifierContext,
  recordPull,
  type ModifierContext,
} from './adminConfig';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythic';

export interface RarityConfig {
  name: Rarity;
  label: string;
  weight: number;
  color: string;
  cssClass: string;
  points: number;
  /** Vault Tokens earned when selling this card */
  tokenValue: number;
}

export const RARITY_CONFIG: Record<Rarity, RarityConfig> = {
  common: {
    name: 'common',
    label: 'COMMON',
    weight: 60,
    color: '#8a8ea0',
    cssClass: 'rarity-common',
    points: 1,
    tokenValue: 3,
  },
  uncommon: {
    name: 'uncommon',
    label: 'UNCOMMON',
    weight: 25,
    color: '#4ade80',
    cssClass: 'rarity-uncommon',
    points: 2,
    tokenValue: 10,
  },
  rare: {
    name: 'rare',
    label: 'RARE',
    weight: 12,
    color: '#3b82f6',
    cssClass: 'rarity-rare',
    points: 5,
    tokenValue: 30,
  },
  legendary: {
    name: 'legendary',
    label: 'LEGENDARY',
    weight: 3,
    color: '#b44dff',
    cssClass: 'rarity-legendary',
    points: 10,
    tokenValue: 80,
  },
  mythic: {
    name: 'mythic',
    label: 'MYTHIC',
    weight: 0, // Only via daily claim on featured day
    color: '#ffd700',
    cssClass: 'rarity-mythic',
    points: 25,
    tokenValue: 200,
  },
};

export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'legendary', 'mythic'];

/**
 * Get the default supply cap for a rarity tier.
 * Matches backend vault-engine logic.
 */
export function getSupplyCap(rarity: Rarity): number {
  const caps: Record<Rarity, number> = {
    mythic: 1,
    legendary: 2,
    rare: 10,
    uncommon: 20,
    common: 50
  };
  return caps[rarity] || 50;
}

// ===== SPECIAL PROOF TYPES =====
export type ProofType = 'proof_of_first' | 'heard_first' | null;

// ===== ULTRA REWARD =====
export interface UltraReward {
  type: 'custom_song';
  label: string;
  description: string;
}

// ===== ROLL RATES BY PACK CATEGORY =====
// Each array is [common%, uncommon%, rare%, legendary%] — must sum to 100
export const ROLL_RATES: Record<string, number[]> = {
  free:           [60, 25, 12, 3],
  taste:          [60, 25, 12, 3],
  light:          [60, 25, 12, 3],
  dark:           [60, 25, 12, 3],
  month:          [60, 25, 12, 3],
  miss_out:       [55, 25, 14, 6],
  special_picks:  [50, 27, 16, 7],
  // Prophecy: proof check (3%) runs first; if it fails, these rates cover the remaining 100%
  prophecy:       [63, 22, 10, 5],
  // Alpha: proof check (8%) runs first; if it fails, these rates cover the remaining 100%
  alpha:          [43, 30, 20, 5, 2],
};

export const PROOF_RATES: Record<string, number> = {
  prophecy: 3,   // 3% chance of Proof of First (1/1)
  alpha: 8,      // 8% chance of Heard First Proof (1/1)
};

/**
 * Roll a rarity based on pack-specific rates.
 * Reads from admin config and applies active conditional modifiers.
 * Returns the rarity + whether a special proof was pulled.
 */
export function rollForPack(
  packCategory: string,
  ctx?: ModifierContext
): { rarity: Rarity; proof: ProofType } {
  const config = getAdminConfig();
  const baseRates = config.rollRates[packCategory] || ROLL_RATES[packCategory] || ROLL_RATES.taste;
  const proofRate = config.proofRates[packCategory] ?? PROOF_RATES[packCategory] ?? 0;

  // Check for special proof pull first
  if (proofRate > 0 && Math.random() * 100 < proofRate) {
    const proof: ProofType = packCategory === 'prophecy' ? 'proof_of_first' : 'heard_first';
    recordPull('legendary');
    return { rarity: 'legendary', proof };
  }

  // Build modifier context if not provided
  const modCtx = ctx || buildModifierContext();
  const { adjustedRates, guaranteedFloor } = applyActiveModifiers(baseRates, packCategory, modCtx);

  // Standard rarity roll
  const roll = Math.random() * 100;
  let cumulative = 0;
  const rarityPool: Rarity[] = ['common', 'uncommon', 'rare', 'legendary', 'mythic'];
  const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'legendary', 'mythic'];

  let result: Rarity = 'common';
  for (let i = 0; i < rarityPool.length; i++) {
    cumulative += (adjustedRates[i] || 0);
    if (roll < cumulative) {
      result = rarityPool[i];
      break;
    }
  }

  // Apply guaranteed floor if active
  if (guaranteedFloor) {
    const resultIdx = RARITY_ORDER.indexOf(result);
    const floorIdx = RARITY_ORDER.indexOf(guaranteedFloor);
    if (resultIdx < floorIdx) {
      result = guaranteedFloor;
    }
  }

  recordPull(result);
  return { rarity: result, proof: null };
}

/**
 * Roll rarity for the DAILY CLAIM.
 * Reads rates from admin config.
 * Mythic ONLY if it's the actual featured day for that card.
 */
export function rollDailyClaimRarity(isFeaturedDay: boolean): Rarity {
  const config = getAdminConfig();
  const rates = isFeaturedDay
    ? config.dailyClaimRates.featured
    : config.dailyClaimRates.standard;

  const roll = Math.random() * 100;
  let cumulative = 0;
  const rarityPool: Rarity[] = ['common', 'uncommon', 'rare', 'legendary', 'mythic'];

  for (let i = 0; i < rarityPool.length; i++) {
    cumulative += (rates[i] || 0);
    if (roll < cumulative) {
      const result = rarityPool[i];
      recordPull(result);
      return result;
    }
  }

  recordPull('common');
  return 'common';
}

// ===== PACK TYPES =====
export type PackCategory =
  | 'free' | 'taste' | 'light' | 'dark'
  | 'miss_out' | 'month'
  | 'special_picks'
  | 'prophecy' | 'alpha'
  | 'vault_token';

export type PackSize = 'single' | 'triple' | 'bulk';

export interface PackTier {
  size: PackSize;
  cardCount: number;
  price: string;
  priceValue: number;
}

export interface PackConfig {
  category: PackCategory;
  label: string;
  description: string;
  icon: string;
  accent: string;
  gradient: string;
  tiers: PackTier[];
  /** Filter constraint */
  filter?: 'light' | 'dark' | 'past_unclaimed' | 'future' | 'past';
}

export const PACK_CONFIGS: Record<PackCategory, PackConfig> = {
  free: {
    category: 'free',
    label: 'DAILY FREE PACK',
    description: 'A free 1-card pack, available daily',
    icon: '🎁',
    accent: '#ffffff',
    gradient: 'linear-gradient(160deg, #111111 0%, #333333 40%, #222222 100%)',
    tiers: [
      { size: 'single', cardCount: 1, price: 'FREE', priceValue: 0 },
    ],
  },
  taste: {
    category: 'taste',
    label: 'TASTE PACK',
    description: 'Any card up to today',
    icon: '🎧',
    accent: '#4ade80',
    gradient: 'linear-gradient(160deg, #1a2e2a 0%, #2d4840 40%, #1a3530 100%)',
    tiers: [
      { size: 'single', cardCount: 2,  price: '$0.25', priceValue: 0.25 },
      { size: 'triple', cardCount: 5,  price: '$1.00', priceValue: 1.00 },
      { size: 'bulk',   cardCount: 15, price: '$2.50', priceValue: 2.50 },
    ],
  },
  light: {
    category: 'light',
    label: 'LIGHT PACK',
    description: 'Only light mood tracks',
    icon: '☀️',
    accent: '#fbbf24',
    gradient: 'linear-gradient(160deg, #2a2810 0%, #4a4218 40%, #352e0d 100%)',
    filter: 'light',
    tiers: [
      { size: 'single', cardCount: 2,  price: '$0.25', priceValue: 0.25 },
      { size: 'triple', cardCount: 5,  price: '$1.00', priceValue: 1.00 },
      { size: 'bulk',   cardCount: 15, price: '$2.50', priceValue: 2.50 },
    ],
  },
  dark: {
    category: 'dark',
    label: 'DARK PACK',
    description: 'Only dark mood tracks',
    icon: '🌙',
    accent: '#8b5cf6',
    gradient: 'linear-gradient(160deg, #1a1530 0%, #2d2050 40%, #201540 100%)',
    filter: 'dark',
    tiers: [
      { size: 'single', cardCount: 2,  price: '$0.25', priceValue: 0.25 },
      { size: 'triple', cardCount: 5,  price: '$1.00', priceValue: 1.00 },
      { size: 'bulk',   cardCount: 15, price: '$2.50', priceValue: 2.50 },
    ],
  },
  miss_out: {
    category: 'miss_out',
    label: 'MISS OUT PACK',
    description: 'Past daily cards you didn\'t claim — always includes the daily drop banner',
    icon: '⏳',
    accent: '#f97316',
    gradient: 'linear-gradient(160deg, #2a1a10 0%, #4a2a18 40%, #35200d 100%)',
    filter: 'past_unclaimed',
    tiers: [
      { size: 'single', cardCount: 2, price: '$1.00', priceValue: 1.00 },
      { size: 'triple', cardCount: 5, price: '$2.00', priceValue: 2.00 },
    ],
  },
  month: {
    category: 'month',
    label: 'MONTH PACK',
    description: 'Cards from a completed month',
    icon: '📅',
    accent: '#06b6d4',
    gradient: 'linear-gradient(160deg, #0a2030 0%, #1a3848 40%, #0d2838 100%)',
    tiers: [
      { size: 'single', cardCount: 2, price: '$0.25', priceValue: 0.25 },
      { size: 'triple', cardCount: 5, price: '$1.00', priceValue: 1.00 },
    ],
  },
  special_picks: {
    category: 'special_picks',
    label: 'SPECIAL PICKS',
    description: 'Curated weekly set — every card drops at Rare or higher',
    icon: '⭐',
    accent: '#ec4899',
    gradient: 'linear-gradient(160deg, #2a1025 0%, #4a1840 40%, #351030 100%)',
    tiers: [
      { size: 'single', cardCount: 2, price: '$0.25', priceValue: 0.25 },
      { size: 'triple', cardCount: 5, price: '$1.00', priceValue: 1.00 },
    ],
  },
  prophecy: {
    category: 'prophecy',
    label: 'PROPHECY PULL',
    description: 'Contains 1 unreleased future track',
    icon: '🔮',
    accent: '#a78bfa',
    gradient: 'linear-gradient(160deg, #1a1040 0%, #2d1860 40%, #201050 100%)',
    filter: 'future',
    tiers: [
      { size: 'single', cardCount: 1, price: '$5.00', priceValue: 5.00 },
    ],
  },
  alpha: {
    category: 'alpha',
    label: 'ALPHA ROLL',
    description: 'Contains 1 archival past track',
    icon: '🎲',
    accent: '#ef4444',
    gradient: 'linear-gradient(160deg, #2a1010 0%, #4a1818 40%, #351010 100%)',
    filter: 'past',
    tiers: [
      { size: 'single', cardCount: 1, price: '$1.00', priceValue: 1.00 },
    ],
  },
  vault_token: {
    category: 'vault_token',
    label: 'VAULT PACK',
    description: 'Premium 3-card pack • token holders only',
    icon: '⚡',
    accent: '#ff9900',
    gradient: 'linear-gradient(160deg, #1a1000 0%, #332200 50%, #1a0f00 100%)',
    filter: 'past',
    tiers: [
      { size: 'single', cardCount: 3, price: '275 V⚡', priceValue: 0 },
    ],
  },
};

// Display ordering for the carousel (vault_token NOT in carousel — it has its own Token Shop section)
export const PACK_CAROUSEL_ORDER: PackCategory[] = [
  'free', 'taste', 'light', 'dark', 'miss_out', 'month',
  'special_picks', 'prophecy', 'alpha',
];

// Legacy compat — kept so existing code that imports PackType doesn't break
export type PackType = PackCategory;

/**
 * Generate cards for a pack — rolls rarity per the pack's category rates.
 * Builds modifier context once and shares it across all rolls.
 */
export function rollPackCards(
  category: PackCategory,
  cardCount: number
): Array<{ rarity: Rarity; proof: ProofType }> {
  const ctx = buildModifierContext();
  const config = getAdminConfig();
  const { bonusCards } = applyActiveModifiers(
    config.rollRates[category] || ROLL_RATES[category] || ROLL_RATES.taste,
    category,
    ctx
  );

  const totalCards = cardCount + bonusCards;
  const results: Array<{ rarity: Rarity; proof: ProofType }> = [];
  for (let i = 0; i < totalCards; i++) {
    results.push(rollForPack(category, ctx));
  }
  return results;
}
