/**
 * Echo System V2 — Card recycling engine for th3vault.
 *
 * When a card is burned (sold), it may fracture into an "Echo" —
 * a degraded copy that gets injected back into the pack pool.
 *
 * V2 Changes:
 *   - Generational spawn decay: 25% → 15% → 8% → 0% (terminal)
 *   - +15% bonus token yield when burning echoes
 *   - Echo tag: "Echo: Re-Entry ###"
 *   - Gen 3 burn = terminal destruction (no further spawn)
 *
 * Generation chain:
 *   Gen 0 = Original
 *   Gen 1 = First echo (rarity -1 tier, 25% spawn chance)
 *   Gen 2 = Second echo (rarity -2, 15% spawn chance)
 *   Gen 3 = Third echo (rarity -3, 8% spawn chance, terminal on burn)
 */

import type { Rarity } from './rarity';
import { getAdminConfig } from './adminConfig';

// ===== ECHO CARD TYPE =====

export interface EchoCard {
  id: string;
  sourceCardId: string;        // e.g. "card-42"
  sourceTitle: string;
  sourceDay: number;
  sourceMood: 'light' | 'dark';
  sourceRarity: Rarity;        // Rarity of the card that was burned
  echoRarity: Rarity;          // Degraded rarity for this echo
  generation: number;          // 1, 2, 3...
  coverUrl: string;
  audioUrl: string;
  energy: number;
  valence: number;
  tempo: number;
  genre: string[];
  tags: string[];
  createdAt: string;
}

// ===== STORAGE =====

const ECHO_POOL_KEY = 'th3vault_echo_pool';

function getEchoPoolRaw(): EchoCard[] {
  try {
    const raw = localStorage.getItem(ECHO_POOL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveEchoPool(pool: EchoCard[]) {
  localStorage.setItem(ECHO_POOL_KEY, JSON.stringify(pool));
}

// ===== RARITY DEGRADATION =====

const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'legendary', 'mythic'];

/**
 * Degrade a rarity by N tiers (clamped to Common floor).
 */
export function degradeRarity(rarity: Rarity, steps: number = 1): Rarity {
  const idx = RARITY_ORDER.indexOf(rarity);
  const degraded = Math.max(0, idx - steps);
  return RARITY_ORDER[degraded];
}

/**
 * Get the echo rarity for a card being burned at a given generation.
 * Gen 0 → Gen 1: drop 1 tier
 * Gen 1 → Gen 2: drop 1 more tier (2 total from original)
 * Gen 2 → Gen 3+: always Common
 */
export function getEchoRarity(sourceRarity: Rarity, currentGeneration: number): Rarity {
  const config = getAdminConfig();
  const maxGen = config.echoSystem?.maxGeneration ?? 3;

  // If at or past max generation, no further echo is produced
  if (currentGeneration >= maxGen) return 'common';

  // Each generation drops 1 tier from the source
  return degradeRarity(sourceRarity, 1);
}

// ===== VALUE MULTIPLIERS =====

/** Echo burn bonus: +15% token yield when burning an echo. */
export const ECHO_BURN_BONUS = 0.15;

/**
 * Get the token value multiplier for a given echo generation.
 */
export function getEchoValueMultiplier(generation: number): number {
  const config = getAdminConfig();
  const eco = config.echoSystem;

  if (!eco) {
    if (generation === 0) return 1;
    if (generation === 1) return 0.6;
    if (generation === 2) return 0.3;
    return 0.1;
  }

  if (generation === 0) return 1;
  if (generation === 1) return eco.gen1ValueMultiplier ?? 0.6;
  if (generation === 2) return eco.gen2ValueMultiplier ?? 0.3;
  return eco.gen3ValueMultiplier ?? 0.1;
}

// ===== GENERATIONAL SPAWN DECAY =====

/** V2 echo spawn rates per generation (replaces flat 50%). */
const ECHO_SPAWN_RATES: Record<number, number> = {
  0: 25,  // Gen 0 → 25% chance to create Gen 1 echo
  1: 15,  // Gen 1 → 15% chance to create Gen 2 echo
  2: 8,   // Gen 2 → 8% chance to create Gen 3 echo
  // Gen 3+ = 0% (terminal destruction)
};

/**
 * Get the echo spawn chance for a given generation.
 * Supports admin echoSpawnMultiplier override.
 */
export function getEchoSpawnChance(generation: number): number {
  const config = getAdminConfig();
  const multiplier = (config as any).echoSpawnMultiplier ?? 1;

  if (generation >= 3) return 0; // Terminal
  const baseRate = ECHO_SPAWN_RATES[generation] ?? 0;
  return Math.min(100, baseRate * multiplier);
}

// ===== ECHO IDENTITY TAGS =====

/**
 * Get the display tag for an echo card.
 * Returns "Echo: Re-Entry ###" format.
 */
export function getEchoTag(generation: number): string {
  if (generation <= 0) return '';
  return `Echo: Re-Entry ${String(generation).padStart(3, '0')}`;
}

/**
 * Check if a card at this generation can produce further echoes when burned.
 */
export function canProduceEcho(generation: number): boolean {
  const config = getAdminConfig();
  const maxGen = config.echoSystem?.maxGeneration ?? 3;
  return generation < maxGen;
}

// ===== BURN TO ECHO =====

export interface BurnResult {
  tokensEarned: number;
  echoCreated: boolean;
  echoGeneration?: number;
  echoRarity?: Rarity;
}

/**
 * Burn a card and create an echo in the pool.
 * Returns the tokens earned (50% of base value × generation multiplier)
 * and whether an echo was created.
 */
export function burnCardToEcho(card: {
  id: string;
  day: number;
  title: string;
  mood: 'light' | 'dark';
  rarity: Rarity;
  coverUrl: string;
  audioUrl: string;
  energy: number;
  valence: number;
  tempo: number;
  genre: string[];
  tags: string[];
}, baseTokenValue: number, currentGeneration: number = 0): BurnResult {
  const config = getAdminConfig();
  const eco = config.echoSystem;
  const enabled = eco?.enabled ?? true;

  // V2: Generational spawn decay (replaces flat 50%)
  const spawnChance = getEchoSpawnChance(currentGeneration);
  const isEchoCreated = spawnChance > 0 && (Math.random() * 100 < spawnChance);

  // Check if echo system is enabled and card can produce echo
  if (!enabled || !canProduceEcho(currentGeneration) || !isEchoCreated) {
    // Echo burn bonus: +15% if burning an echo
    const bonusMultiplier = currentGeneration > 0 ? (1 + ECHO_BURN_BONUS) : 1;
    return {
      tokensEarned: Math.ceil(baseTokenValue * bonusMultiplier),
      echoCreated: false,
    };
  }

  // Create the echo
  const nextGen = currentGeneration + 1;
  const echoRarity = getEchoRarity(card.rarity, currentGeneration);

  const echo: EchoCard = {
    id: `echo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sourceCardId: `card-${card.day}`,
    sourceTitle: card.title,
    sourceDay: card.day,
    sourceMood: card.mood,
    sourceRarity: card.rarity,
    echoRarity,
    generation: nextGen,
    coverUrl: card.coverUrl,
    audioUrl: card.audioUrl,
    energy: card.energy,
    valence: card.valence,
    tempo: card.tempo,
    genre: card.genre || [],
    tags: card.tags || [],
    createdAt: new Date().toISOString(),
  };

  // Add to echo pool
  const pool = getEchoPoolRaw();
  pool.push(echo);
  saveEchoPool(pool);

  return {
    tokensEarned: baseTokenValue,
    echoCreated: true,
    echoGeneration: nextGen,
    echoRarity,
  };
}

// ===== ECHO POOL QUERIES =====

/**
 * Get the full echo pool.
 */
export function getEchoPool(): EchoCard[] {
  return getEchoPoolRaw();
}

/**
 * Get echo pool stats for the admin dashboard.
 */
export function getEchoPoolStats() {
  const pool = getEchoPoolRaw();
  const byRarity: Record<string, number> = {};
  const byGeneration: Record<number, number> = {};

  for (const echo of pool) {
    byRarity[echo.echoRarity] = (byRarity[echo.echoRarity] || 0) + 1;
    byGeneration[echo.generation] = (byGeneration[echo.generation] || 0) + 1;
  }

  return {
    total: pool.length,
    byRarity,
    byGeneration,
  };
}

/**
 * Pull a random echo from the pool (removes it).
 * Optionally filter by mood.
 * Returns null if pool is empty.
 */
export function pullEchoFromPool(mood?: 'light' | 'dark'): EchoCard | null {
  const pool = getEchoPoolRaw();
  if (pool.length === 0) return null;

  // Filter by mood if specified
  const candidates = mood
    ? pool.filter(e => e.sourceMood === mood)
    : pool;

  if (candidates.length === 0) return null;

  // Pick random
  const idx = Math.floor(Math.random() * candidates.length);
  const picked = candidates[idx];

  // Remove from pool
  const poolIdx = pool.findIndex(e => e.id === picked.id);
  if (poolIdx !== -1) pool.splice(poolIdx, 1);
  saveEchoPool(pool);

  return picked;
}

/**
 * Should this pack pull attempt draw from the echo pool?
 * Rolls against the admin-configured echo chance.
 */
export function shouldPullEcho(): boolean {
  const config = getAdminConfig();
  const eco = config.echoSystem;
  if (!eco?.enabled) return false;

  const chance = eco.echoChance ?? 15;
  const pool = getEchoPoolRaw();

  // Can't pull if pool is empty
  if (pool.length === 0) return false;

  return Math.random() * 100 < chance;
}

/**
 * Flush the entire echo pool (admin/testing use).
 */
export function flushEchoPool() {
  localStorage.removeItem(ECHO_POOL_KEY);
}
