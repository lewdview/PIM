/**
 * Admin Config — Central configuration store for th3vault drop engine.
 *
 * Every value that was previously hardcoded in rarity.ts / vaultService.ts
 * can be overridden here.  Config lives in localStorage and can be
 * exported / imported as JSON.
 */

import type { Rarity } from './rarity';
import { getCurrentDay } from './dayCalc';
import { supabase } from '../services/supabaseClient';
import { useVaultStore } from '../store/useVaultStore';

// ===== CONDITIONAL MODIFIER TYPES =====

export type ModifierConditionType =
  | 'streak'           // Consecutive daily claims
  | 'collection_size'  // Total unique cards owned
  | 'time_of_day'      // Clock-based window
  | 'day_range'        // Specific vault day range
  | 'rarity_drought'   // N pulls with no Rare+
  | 'first_pack'       // User's very first pack
  | 'milestone';       // Collection milestones (50, 100, 200…)

export type ModifierEffectType =
  | 'rate_boost'        // Multiply a rarity's rate
  | 'rate_nerf'         // Reduce a rarity's rate
  | 'guaranteed_floor'  // Minimum rarity for the pull
  | 'bonus_card'        // Extra card(s) in pack
  | 'token_multiplier'; // Token earn multiplier on sell

export interface ModifierCondition {
  type: ModifierConditionType;
  threshold: number;       // e.g. streak >= 7
  timeStart?: string;      // "HH:MM" format
  timeEnd?: string;        // "HH:MM" format
}

export interface ModifierEffect {
  type: ModifierEffectType;
  target?: Rarity;         // Which rarity to boost/nerf
  value: number;           // Multiplier or flat bonus
  packFilter?: string;     // Only apply to this pack category
}

export interface ConditionalModifier {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  condition: ModifierCondition;
  effect: ModifierEffect;
}

// ===== FULL CONFIG SHAPE =====

export interface AdminConfig {
  // Per-pack rarity rates — key is PackCategory, value is [common%, uncommon%, rare%, legendary%, mythic?%]
  rollRates: Record<string, number[]>;

  // Proof rates — key is pack category
  proofRates: Record<string, number>;

  // Economy — token burn values per rarity
  tokenValues: Record<Rarity, number>;

  // Supply caps per rarity (max editions)
  supplyCaps: Record<Rarity, number>;

  // Ultra reward
  ultraRewardChance: number;  // 0–1 (0.003 = 0.3%)
  ultraRewardMax: number;

  // Daily limits
  dailyStandardLimit: number;
  dailyPremiumLimit: number;

  // Token pack cost
  tokenPackCost: number;

  // Token pack roll rates
  tokenPackRates: number[];   // [common%, uncommon%, rare%, legendary%, mythic%]

  // Daily claim rates
  dailyClaimRates: {
    standard: number[];       // [common%, uncommon%, rare%, legendary%]
    featured: number[];       // [common%, uncommon%, rare%, legendary%, mythic%]
  };

  // Pack pricing overrides — key = "category:size", value = priceValue
  packPricing: Record<string, number>;

  // Conditional modifiers
  modifiers: ConditionalModifier[];

  // Echo System
  echoSystem: {
    enabled: boolean;              // Master toggle
    echoChance: number;            // % chance per pack pull to draw echo (0-100)
    tokenSplitPercent: number;     // % of burn value kept as tokens (rest → echo)
    gen1ValueMultiplier: number;   // Token value multiplier for Gen 1 echoes
    gen2ValueMultiplier: number;   // Token value multiplier for Gen 2 echoes
    gen3ValueMultiplier: number;   // Token value multiplier for Gen 3+ echoes
    maxGeneration: number;         // Max generation before entropy death
  };

  // V2: Echo spawn rates (generational decay)
  echoSpawnRates?: { gen0: number; gen1: number; gen2: number; gen3: number };
  echoBurnBonus?: number;          // Bonus yield % when burning echoes (0.15 = 15%)
  echoSpawnMultiplier?: number;    // Admin override multiplier for spawn rates

  // V2: Anti-grind friction
  antiGrind?: {
    burnThreshold1: number;        // Burns/day before first reduction
    burnReduction1: number;        // First reduction factor (0.2 = -20%)
    burnThreshold2: number;        // Burns/day before second reduction
    burnReduction2: number;        // Second reduction factor (0.4 = -40%)
  };

  // V2: Pity counter
  pityCounter?: { enabled: boolean; threshold: number };

  // V2: Token sinks
  targetedPullCost?: number;
  rarityUpgradeCost?: number;
  pullWindowHours?: number;

  // V2: Admin multiplier controls (RC1)
  tokenYieldMultiplier?: number;
  dropRateOverrides?: Record<string, number[]>;

  // V2: RC1 test mode
  rc1TestMode?: boolean;

  // Metadata
  lastModified: string;
  version: number;
}

// ===== DEFAULT VALUES (mirror existing hardcoded values) =====

const DEFAULT_ROLL_RATES: Record<string, number[]> = {
  free:           [60, 25, 12, 3],
  taste:          [60, 25, 12, 3],
  light:          [60, 25, 12, 3],
  dark:           [60, 25, 12, 3],
  month:          [60, 25, 12, 3],
  miss_out:       [55, 25, 14, 6],
  special_picks:  [50, 27, 16, 7],
  prophecy:       [63, 22, 10, 5],
  alpha:          [43, 30, 20, 5, 2],
};

const DEFAULT_PROOF_RATES: Record<string, number> = {
  prophecy: 3,
  alpha: 8,
};

const DEFAULT_TOKEN_VALUES: Record<Rarity, number> = {
  common: 3,
  uncommon: 10,
  rare: 30,
  legendary: 80,
  mythic: 200,
};

const DEFAULT_SUPPLY_CAPS: Record<Rarity, number> = {
  common: 50,
  uncommon: 20,
  rare: 10,
  legendary: 2,
  mythic: 1,
};

const DEFAULT_TOKEN_PACK_RATES = [30, 28, 25, 14, 3];

const DEFAULT_DAILY_CLAIM_RATES = {
  standard: [42, 30, 18, 10],
  featured: [42, 28, 18, 8, 2],  // Note: doc says 2% mythic on featured
};

const DEFAULT_MODIFIERS: ConditionalModifier[] = [
  {
    id: 'streak_reward',
    name: 'Streak Reward',
    description: '7+ day login streak → +50% Rare & Legendary rates',
    enabled: false,
    condition: { type: 'streak', threshold: 7 },
    effect: { type: 'rate_boost', target: 'rare', value: 1.5 },
  },
  {
    id: 'midnight_drop',
    name: 'Midnight Drop',
    description: '12am–2am pulls → 2× Legendary chances',
    enabled: false,
    condition: { type: 'time_of_day', threshold: 0, timeStart: '00:00', timeEnd: '02:00' },
    effect: { type: 'rate_boost', target: 'legendary', value: 2.0 },
  },
  {
    id: 'drought_protection',
    name: 'Drought Protection',
    description: '20+ pulls with no Rare+ → guaranteed Rare floor',
    enabled: false,
    condition: { type: 'rarity_drought', threshold: 20 },
    effect: { type: 'guaranteed_floor', target: 'rare', value: 1 },
  },
  {
    id: 'collector_milestone',
    name: 'Collector Milestone',
    description: '100+ unique cards → +25% to Rare, Legendary, Mythic',
    enabled: false,
    condition: { type: 'collection_size', threshold: 100 },
    effect: { type: 'rate_boost', target: 'rare', value: 1.25 },
  },
  {
    id: 'first_pack_luck',
    name: 'First Pack Luck',
    description: 'Brand new user\u0027s first pack → guaranteed Uncommon+',
    enabled: false,
    condition: { type: 'first_pack', threshold: 1 },
    effect: { type: 'guaranteed_floor', target: 'uncommon', value: 1 },
  },
  {
    id: 'weekend_bonus',
    name: 'Weekend Bonus',
    description: 'Saturday & Sunday pulls → +30% Rare & Legendary rates',
    enabled: false,
    condition: { type: 'day_range', threshold: 6 },
    effect: { type: 'rate_boost', target: 'rare', value: 1.3 },
  },
  {
    id: 'token_whale',
    name: 'Token Whale',
    description: '5000+ V⚡ tokens → +20% Legendary, +50% Mythic chances',
    enabled: false,
    condition: { type: 'collection_size', threshold: 5000 },
    effect: { type: 'rate_boost', target: 'legendary', value: 1.2 },
  },
  {
    id: 'lucky_seven',
    name: 'Lucky Day 7s',
    description: 'On days ending in 7 (7, 17, 77, ...) → 2× Mythic chance',
    enabled: false,
    condition: { type: 'day_range', threshold: 7 },
    effect: { type: 'rate_boost', target: 'mythic', value: 2.0 },
  },
  {
    id: 'burn_streak',
    name: 'Burn Streak',
    description: '10+ burns today → +1 bonus card on next pull',
    enabled: false,
    condition: { type: 'milestone', threshold: 10 },
    effect: { type: 'bonus_card', value: 1 },
  },
  {
    id: 'codex_completionist',
    name: 'Codex Completionist',
    description: '50%+ Codex completion → ×1.5 token earn multiplier',
    enabled: false,
    condition: { type: 'collection_size', threshold: 182 },
    effect: { type: 'token_multiplier', value: 1.5 },
  },
];

// ===== STORAGE =====

const ADMIN_CONFIG_KEY = 'th3vault_admin_config';
const CONFIG_HISTORY_KEY = 'th3vault_admin_history';

function buildDefaultConfig(): AdminConfig {
  return {
    rollRates: { ...DEFAULT_ROLL_RATES },
    proofRates: { ...DEFAULT_PROOF_RATES },
    tokenValues: { ...DEFAULT_TOKEN_VALUES },
    supplyCaps: { ...DEFAULT_SUPPLY_CAPS },
    ultraRewardChance: 0.003,
    ultraRewardMax: 5,
    dailyStandardLimit: 60,  // V2 RC1: elevated from 30
    dailyPremiumLimit: 5,    // V2 RC1: elevated from 2
    tokenPackCost: 275,      // V2: increased from 200
    tokenPackRates: [...DEFAULT_TOKEN_PACK_RATES],
    dailyClaimRates: {
      standard: [...DEFAULT_DAILY_CLAIM_RATES.standard],
      featured: [...DEFAULT_DAILY_CLAIM_RATES.featured],
    },
    packPricing: {},
    modifiers: DEFAULT_MODIFIERS.map(m => ({ ...m, condition: { ...m.condition }, effect: { ...m.effect } })),
    echoSystem: {
      enabled: true,
      echoChance: 15,
      tokenSplitPercent: 50,
      gen1ValueMultiplier: 0.6,
      gen2ValueMultiplier: 0.3,
      gen3ValueMultiplier: 0.1,
      maxGeneration: 3,
    },
    // V2: Echo spawn rates (generational decay)
    echoSpawnRates: { gen0: 25, gen1: 15, gen2: 8, gen3: 0 },
    echoBurnBonus: 0.15,
    echoSpawnMultiplier: 1,
    // V2: Anti-grind friction
    antiGrind: {
      burnThreshold1: 20,
      burnReduction1: 0.2,
      burnThreshold2: 30,
      burnReduction2: 0.4,
    },
    // V2: Pity counter
    pityCounter: { enabled: true, threshold: 25 },
    // V2: Token sinks
    targetedPullCost: 500,
    rarityUpgradeCost: 150,
    pullWindowHours: 72,
    // V2: Admin multiplier controls (RC1)
    tokenYieldMultiplier: 1,
    dropRateOverrides: {},
    rc1TestMode: true,
    lastModified: new Date().toISOString(),
    version: 2,
  };
}

let configCache: AdminConfig | null = null;

export async function initAdminConfig(): Promise<AdminConfig> {
  const defaults = buildDefaultConfig();
  try {
    const { data, error } = await supabase.from('admin_config').select('config').eq('id', 1).single();
    if (!error && data?.config) {
      // Deep-merge remote config with defaults so partial configs don't crash
      const merged = { ...defaults, ...data.config } as AdminConfig;
      // Ensure nested objects are properly merged
      merged.rollRates = { ...defaults.rollRates, ...(data.config.rollRates || {}) };
      merged.proofRates = { ...defaults.proofRates, ...(data.config.proofRates || {}) };
      merged.tokenValues = { ...defaults.tokenValues, ...(data.config.tokenValues || {}) };
      merged.supplyCaps = { ...defaults.supplyCaps, ...(data.config.supplyCaps || {}) };
      merged.dailyClaimRates = { ...defaults.dailyClaimRates, ...(data.config.dailyClaimRates || {}) };
      merged.echoSystem = { ...defaults.echoSystem, ...(data.config.echoSystem || {}) };
      merged.modifiers = (data.config.modifiers && data.config.modifiers.length > 0)
        ? data.config.modifiers
        : defaults.modifiers;
      configCache = merged;
      localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(merged));
      return configCache;
    }
  } catch { /* fallback to local */ }
  return getAdminConfig();
}

export function getAdminConfig(): AdminConfig {
  if (configCache) return configCache;

  const defaults = buildDefaultConfig();
  try {
    const raw = localStorage.getItem(ADMIN_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AdminConfig;
      if (parsed.version && parsed.version >= 2) {
        const merged = { ...defaults, ...parsed };
        merged.rollRates = { ...defaults.rollRates, ...(parsed.rollRates || {}) };
        merged.proofRates = { ...defaults.proofRates, ...(parsed.proofRates || {}) };
        merged.tokenValues = { ...defaults.tokenValues, ...(parsed.tokenValues || {}) };
        merged.supplyCaps = { ...defaults.supplyCaps, ...(parsed.supplyCaps || {}) };
        merged.dailyClaimRates = { ...defaults.dailyClaimRates, ...(parsed.dailyClaimRates || {}) };
        merged.echoSystem = { ...defaults.echoSystem, ...(parsed.echoSystem || {}) };
        merged.modifiers = (parsed.modifiers && parsed.modifiers.length > 0)
          ? parsed.modifiers
          : defaults.modifiers;
        configCache = merged as AdminConfig;
        return configCache;
      }
    }
  } catch { /* fallback */ }

  configCache = defaults;
  return defaults;
}

export function saveAdminConfig(config: AdminConfig) {
  config.lastModified = new Date().toISOString();
  config.version = (config.version || 0) + 1;
  configCache = config;
  localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(config));

  // Sync to backend (fire and forget)
  supabase.functions.invoke('vault-engine', {
    body: { action: 'updateAdminConfig', payload: { config, passphrase: 'th3scr1b3' } }
  }).catch(e => console.error("Failed to sync admin config to backend", e));

  // Append to history (keep last 20 entries)
  try {
    const histRaw = localStorage.getItem(CONFIG_HISTORY_KEY);
    const history: Array<{ timestamp: string; version: number; snapshot: string }> = histRaw ? JSON.parse(histRaw) : [];
    history.push({
      timestamp: config.lastModified,
      version: config.version,
      snapshot: JSON.stringify(config),
    });
    if (history.length > 20) history.splice(0, history.length - 20);
    localStorage.setItem(CONFIG_HISTORY_KEY, JSON.stringify(history));
  } catch { /* ignore */ }
}

export function resetAdminConfig(): AdminConfig {
  const defaults = buildDefaultConfig();
  saveAdminConfig(defaults);
  return defaults;
}

export function exportAdminConfig(): string {
  return JSON.stringify(getAdminConfig(), null, 2);
}

export function importAdminConfig(json: string): AdminConfig | null {
  try {
    const parsed = JSON.parse(json) as AdminConfig;
    // Basic validation
    if (!parsed.rollRates || !parsed.modifiers) return null;
    saveAdminConfig(parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function getConfigHistory(): Array<{ timestamp: string; version: number }> {
  try {
    const raw = localStorage.getItem(CONFIG_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map((h: any) => ({ timestamp: h.timestamp, version: h.version }));
  } catch { return []; }
}

// ===== MODIFIER CONTEXT =====

export interface ModifierContext {
  streak: number;
  collectionSize: number;
  totalPulls: number;
  pullsSinceRarePlus: number;
  isFirstPack: boolean;
  currentHour: number;
  currentMinute: number;
  currentDayOfWeek: number;  // 0=Sunday, 6=Saturday
  currentVaultDay: number;   // 1-365
}

/**
 * Build a context object for evaluating conditional modifiers.
 */
export function buildModifierContext(): ModifierContext {
  const now = new Date();
  const state = useVaultStore.getState();

  // Streak from store
  let streak = state.streakCount || 0;

  // Collection size from store (unique cardIds)
  const ids = new Set((state.collection || []).map((c: any) => c.cardId));
  let collectionSize = ids.size;

  // Total pulls & drought tracking
  let totalPulls = state.totalPulls || 0;
  let pullsSinceRarePlus = state.pullsSinceRarePlus || 0;
  
  const isFirstPack = totalPulls === 0;

  return {
    streak,
    collectionSize,
    totalPulls,
    pullsSinceRarePlus,
    isFirstPack,
    currentHour: now.getHours(),
    currentMinute: now.getMinutes(),
    currentDayOfWeek: now.getDay(),
    currentVaultDay: getCurrentDay(),
  };
}

/**
 * Evaluate whether a modifier's condition is met given the current context.
 */
export function isModifierActive(mod: ConditionalModifier, ctx: ModifierContext): boolean {
  if (!mod.enabled) return false;

  const c = mod.condition;

  switch (c.type) {
    case 'streak':
      return ctx.streak >= c.threshold;

    case 'collection_size':
      return ctx.collectionSize >= c.threshold;

    case 'time_of_day': {
      if (!c.timeStart || !c.timeEnd) return false;
      const [sh, sm] = c.timeStart.split(':').map(Number);
      const [eh, em] = c.timeEnd.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      const nowMin = ctx.currentHour * 60 + ctx.currentMinute;
      // Handle overnight ranges (e.g. 23:00–02:00)
      if (startMin <= endMin) {
        return nowMin >= startMin && nowMin < endMin;
      } else {
        return nowMin >= startMin || nowMin < endMin;
      }
    }

    case 'rarity_drought':
      return ctx.pullsSinceRarePlus >= c.threshold;

    case 'first_pack':
      return ctx.isFirstPack;

    case 'milestone':
      return ctx.collectionSize >= c.threshold;

    case 'day_range': {
      // threshold === 6 → weekend mode (Saturday=6 or Sunday=0)
      if (c.threshold === 6) {
        return ctx.currentDayOfWeek === 0 || ctx.currentDayOfWeek === 6;
      }
      // threshold === 7 → lucky 7s (vault days ending in 7)
      if (c.threshold === 7) {
        return ctx.currentVaultDay % 10 === 7;
      }
      // Generic: match if vault day is divisible by threshold
      if (c.threshold > 0) {
        return ctx.currentVaultDay % c.threshold === 0;
      }
      return false;
    }

    default:
      return false;
  }
}

/**
 * Apply all active modifiers to a set of base rates.
 * Returns adjusted rates (still sums to ~100).
 */
export function applyActiveModifiers(
  baseRates: number[],
  packCategory: string,
  ctx: ModifierContext,
): { adjustedRates: number[]; guaranteedFloor: Rarity | null; bonusCards: number; tokenMultiplier: number } {
  const config = getAdminConfig();
  const rates = [...baseRates];
  let guaranteedFloor: Rarity | null = null;
  let bonusCards = 0;
  let tokenMultiplier = 1;

  const RARITY_INDEX: Record<Rarity, number> = {
    common: 0, uncommon: 1, rare: 2, legendary: 3, mythic: 4,
  };

  for (const mod of config.modifiers) {
    if (!isModifierActive(mod, ctx)) continue;

    // If modifier targets a specific pack and this isn't it, skip
    if (mod.effect.packFilter && mod.effect.packFilter !== packCategory) continue;

    switch (mod.effect.type) {
      case 'rate_boost': {
        if (mod.effect.target) {
          const idx = RARITY_INDEX[mod.effect.target];
          if (idx !== undefined && idx < rates.length) {
            rates[idx] *= mod.effect.value;
          }
          // Also boost everything above the target
          for (let i = idx + 1; i < rates.length; i++) {
            rates[i] *= mod.effect.value;
          }
        }
        break;
      }

      case 'rate_nerf': {
        if (mod.effect.target) {
          const idx = RARITY_INDEX[mod.effect.target];
          if (idx !== undefined && idx < rates.length) {
            rates[idx] /= mod.effect.value;
          }
        }
        break;
      }

      case 'guaranteed_floor': {
        if (mod.effect.target) {
          if (!guaranteedFloor || RARITY_INDEX[mod.effect.target] > RARITY_INDEX[guaranteedFloor]) {
            guaranteedFloor = mod.effect.target;
          }
        }
        break;
      }

      case 'bonus_card': {
        bonusCards += mod.effect.value;
        break;
      }

      case 'token_multiplier': {
        tokenMultiplier *= mod.effect.value;
        break;
      }
    }
  }

  // Re-normalize rates to sum to 100
  const sum = rates.reduce((a, b) => a + b, 0);
  if (sum > 0 && sum !== 100) {
    const scale = 100 / sum;
    for (let i = 0; i < rates.length; i++) {
      rates[i] = Math.round(rates[i] * scale * 100) / 100;
    }
  }

  return { adjustedRates: rates, guaranteedFloor, bonusCards, tokenMultiplier };
}

// ===== PULL STATS TRACKING =====

export function recordPull(_rarity: Rarity) {
  // Now handled securely on the backend (Supabase edge functions)
}

// ===== STREAK TRACKING =====

export function updateStreak() {
  // Now handled securely on the backend (Supabase edge functions)
}

export function getStreak(): number {
  return useVaultStore.getState().streakCount || 0;
}

// ===== SIMULATION =====

/**
 * Simulate N pulls for a given pack category and return distribution count.
 */
export function simulatePulls(
  packCategory: string,
  count: number,
  useModifiers: boolean = false,
): Record<Rarity, number> {
  const config = getAdminConfig();
  const baseRates = config.rollRates[packCategory] || config.rollRates.taste;
  const proofRate = config.proofRates[packCategory] || 0;

  const ctx = useModifiers ? buildModifierContext() : {
    streak: 0, collectionSize: 0, totalPulls: 0,
    pullsSinceRarePlus: 0, isFirstPack: false,
    currentHour: 12, currentMinute: 0,
    currentDayOfWeek: new Date().getDay(), currentVaultDay: getCurrentDay(),
  };

  const { adjustedRates } = applyActiveModifiers(baseRates, packCategory, ctx);

  const dist: Record<Rarity, number> = {
    common: 0, uncommon: 0, rare: 0, legendary: 0, mythic: 0,
  };

  const rarityPool: Rarity[] = ['common', 'uncommon', 'rare', 'legendary', 'mythic'];

  for (let i = 0; i < count; i++) {
    // Check proof first
    if (proofRate > 0 && Math.random() * 100 < proofRate) {
      dist.legendary += 1;
      continue;
    }

    const roll = Math.random() * 100;
    let cumulative = 0;
    let assigned = false;

    for (let j = 0; j < rarityPool.length; j++) {
      cumulative += (adjustedRates[j] || 0);
      if (roll < cumulative) {
        dist[rarityPool[j]] += 1;
        assigned = true;
        break;
      }
    }

    if (!assigned) dist.common += 1;
  }

  return dist;
}
