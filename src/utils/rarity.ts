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
import { getCurrentDay } from './dayCalc';

export function getSupplyCap(rarity: Rarity, cardDay?: number): number {
  if (rarity === 'mythic') return 1;

  const day = cardDay ?? 1;
  const today = getCurrentDay();
  const age = Math.max(0, today - day);

  if (age >= 180) {
    const caps: Record<Rarity, number> = {
      mythic: 1,
      legendary: 5,
      rare: 50,
      uncommon: 500,
      common: 1000
    };
    return caps[rarity] || 1000;
  } else if (age >= 30) {
    const caps: Record<Rarity, number> = {
      mythic: 1,
      legendary: 3,
      rare: 35,
      uncommon: 250,
      common: 500
    };
    return caps[rarity] || 500;
  } else {
    // Launch Week
    const caps: Record<Rarity, number> = {
      mythic: 1,
      legendary: 2,
      rare: 15,
      uncommon: 100,
      common: 250
    };
    return caps[rarity] || 250;
  }
}

export function getMintableCap(rarity: Rarity): number {
  const caps: Record<Rarity, number> = {
    mythic: 1,
    legendary: 3,
    rare: 25,
    uncommon: 50,
    common: 0
  };
  return caps[rarity] || 0;
}

// ===== SPECIAL PROOF TYPES =====
export type ProofType = 'proof_of_first' | 'heard_first' | null;

// ===== ULTRA REWARD =====
export interface UltraReward {
  type: 'custom_song';
  label: string;
  description: string;
}

import packData from '../../public/data/packs.json';

// ===== ROLL RATES & CONFIGS GENERATED FROM JSON =====
export const ROLL_RATES: Record<string, number[]> = {};
export const PACK_CONFIGS: Record<PackCategory, PackConfig> = {} as any;

for (const key of Object.keys(packData)) {
  const cfg = (packData as any)[key];
  ROLL_RATES[key] = cfg.rates;
  PACK_CONFIGS[key as PackCategory] = {
    category: cfg.category as PackCategory,
    label: cfg.label,
    description: cfg.description,
    icon: cfg.icon,
    accent: cfg.accent,
    gradient: cfg.gradient,
    tiers: cfg.tiers,
    filter: cfg.filter
  };
}

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

// Display ordering for the carousel (vault_token NOT in carousel — it has its own Token Shop section)
export const PACK_CAROUSEL_ORDER: PackCategory[] = [
  'free', 'taste', 'light', 'dark', 'miss_out', 'month',
  'special_picks', 'prophecy', 'alpha', 'vault_token', 'targeted_pull', 'rarity_upgrade',
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

