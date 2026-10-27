import type { Rarity } from '../../utils/rarity';

/**
 * Escalating reveal language for the cinematic pack opening.
 *
 * Every tier shares one skeleton — CHARGE → IMPACT → AFTERGLOW — and each
 * step up the ladder adds a new layer on top of the one below it, so a
 * player learns to read the rarity from the build-up before the card turns:
 *
 *   common     clean flip, dust puff
 *   uncommon   + short charge, tinted pulse ring, spark motes
 *   rare       + screen dim, converging light streaks, shockwave, light rays, foil, shake
 *   legendary  + letterbox, energy arcs, card levitates, double shockwave, title slam
 *   mythic     + blackout, heartbeat, light-seam cracks, whiteout, prismatic sunburst, 1 OF 1 slam
 */

export type RevealStage = 'charge' | 'impact' | 'afterglow';

export interface RevealProfile {
  tier: number;
  /** Pre-flip build-up. 0 skips the charge stage entirely. */
  chargeMs: number;
  /** Flip + impact burst. */
  impactMs: number;
  /** Linger on the revealed card before the next one. */
  holdMs: number;
  color: string;
  /** Secondary color for particles / rays. */
  accent: string;
  /** Backdrop darkness during charge (0–1). */
  dim: number;
  letterbox: boolean;
  /** Converging light streaks during charge. */
  streaks: number;
  /** Jagged energy arcs during charge. */
  arcs: number;
  /** Mythic-only heartbeat pulses + light-seam cracks during charge. */
  heartbeat: boolean;
  /** Peak opacity of the impact flash. */
  flash: number;
  flashColor: string;
  shockwaves: number;
  /** 0 none, 1 single rotating rays, 2 counter-rotating prismatic sunburst. */
  rays: 0 | 1 | 2;
  particles: number;
  /** Screen shake amplitude in px at impact. */
  shake: number;
  /** Card scale while it is the active reveal. */
  cardScale: number;
  /** Card lifts toward the viewer during charge. */
  levitate: boolean;
  /** Big title slam at impact; null for none. */
  title: string | null;
  subtitle: string | null;
  /** Rare+ eligible for the near-miss tease and ultra roll. */
  highTier: boolean;
}

export const REVEAL_PROFILES: Record<Rarity, RevealProfile> = {
  common: {
    tier: 0,
    chargeMs: 0,
    impactMs: 320,
    holdMs: 160,
    color: '#8a8ea0',
    accent: '#c8ccd8',
    dim: 0,
    letterbox: false,
    streaks: 0,
    arcs: 0,
    heartbeat: false,
    flash: 0,
    flashColor: '#ffffff',
    shockwaves: 0,
    rays: 0,
    particles: 10,
    shake: 0,
    cardScale: 1,
    levitate: false,
    title: null,
    subtitle: null,
    highTier: false,
  },
  uncommon: {
    tier: 1,
    chargeMs: 260,
    impactMs: 420,
    holdMs: 220,
    color: '#4ade80',
    accent: '#bbf7d0',
    dim: 0.1,
    letterbox: false,
    streaks: 0,
    arcs: 0,
    heartbeat: false,
    flash: 0.18,
    flashColor: '#4ade80',
    shockwaves: 1,
    rays: 0,
    particles: 22,
    shake: 0,
    cardScale: 1.03,
    levitate: false,
    title: null,
    subtitle: null,
    highTier: false,
  },
  rare: {
    tier: 2,
    chargeMs: 900,
    impactMs: 720,
    holdMs: 480,
    color: '#3b82f6',
    accent: '#93c5fd',
    dim: 0.45,
    letterbox: false,
    streaks: 12,
    arcs: 0,
    heartbeat: false,
    flash: 0.55,
    flashColor: '#dbeafe',
    shockwaves: 1,
    rays: 1,
    particles: 48,
    shake: 5,
    cardScale: 1.08,
    levitate: false,
    title: 'RARE',
    subtitle: 'SIGNAL CLASS // 03',
    highTier: true,
  },
  legendary: {
    tier: 3,
    chargeMs: 1500,
    impactMs: 1050,
    holdMs: 700,
    color: '#b44dff',
    accent: '#ff4fd8',
    dim: 0.72,
    letterbox: true,
    streaks: 20,
    arcs: 4,
    heartbeat: false,
    flash: 0.8,
    flashColor: '#f5e1ff',
    shockwaves: 2,
    rays: 1,
    particles: 95,
    shake: 10,
    cardScale: 1.12,
    levitate: true,
    title: 'LEGENDARY',
    subtitle: 'SIGNAL CLASS // 04',
    highTier: true,
  },
  mythic: {
    tier: 4,
    chargeMs: 2400,
    impactMs: 1700,
    holdMs: 1000,
    color: '#ffd700',
    accent: '#ff3d9a',
    dim: 0.93,
    letterbox: true,
    streaks: 28,
    arcs: 6,
    heartbeat: true,
    flash: 1,
    flashColor: '#fffbe6',
    shockwaves: 3,
    rays: 2,
    particles: 180,
    shake: 16,
    cardScale: 1.16,
    levitate: true,
    title: 'MYTHIC',
    subtitle: '1 OF 1 // DISCOVERED',
    highTier: true,
  },
};

export function getRevealProfile(rarity: Rarity | string | undefined): RevealProfile {
  return REVEAL_PROFILES[(rarity as Rarity) ?? 'common'] ?? REVEAL_PROFILES.common;
}

/** Reduced-motion variant: same story, no shake/streaks, shorter, fewer particles. */
export function reduceProfile(p: RevealProfile): RevealProfile {
  return {
    ...p,
    chargeMs: Math.round(p.chargeMs * 0.5),
    impactMs: Math.round(p.impactMs * 0.7),
    streaks: 0,
    arcs: 0,
    shake: 0,
    rays: 0,
    particles: Math.round(p.particles * 0.25),
    flash: Math.min(p.flash, 0.35),
    levitate: false,
  };
}
