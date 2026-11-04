import { PACK_CONFIGS, type PackCategory, type PackSize } from '../../utils/rarity';
import { getTokenPackCost } from '../../services/vaultService';
import { getPackCoverFallback } from '../../utils/cardVariants';

/** One pack in a machine: a vending coil or the bonus claw's pile. */
export interface PitPack {
  id: string;
  category: PackCategory;
  size: PackSize;
  label: string;
  description: string;
  icon: string;
  accent: string;
  gradient: string;
  cardCount: number;
  price: string;
  priceValue: number;
  /** 'usd' goes through PaymentSelectModal, 'spark' spends V⚡, 'free' is the daily free pack. */
  currency: 'usd' | 'spark' | 'free';
  coverImage?: string;
}

export interface ClawPit {
  id: string;
  name: string;
  icon: string;
  accent: string;
  blurb: string;
  /** [category, size] pairs; empty → every tier of `category`. */
  category?: PackCategory;
  picks?: Array<[PackCategory, PackSize]>;
}

export function packsForPit(pit: ClawPit, bombshellArt: 'dark' | 'light'): PitPack[] {
  const pairs: Array<[PackCategory, PackSize]> = pit.picks
    ?? (PACK_CONFIGS[pit.category!]?.tiers ?? []).map(t => [pit.category!, t.size as PackSize]);

  return pairs.flatMap(([category, size]) => {
    const cfg = PACK_CONFIGS[category];
    const tier = cfg?.tiers.find(t => t.size === size);
    if (!cfg || !tier) return [];
    const isSpark = category === 'vault_token' || category === 'bombshell_token';
    const t = tier as typeof tier & { coverImage?: string; darkCoverImage?: string; lightCoverImage?: string };
    const c = cfg as typeof cfg & { coverImage?: string };
    // Same art the pack shop's cartridges use: bombshell tiers have their own covers,
    // every other pack shows a representative day cover.
    const cover = (bombshellArt === 'light' ? (t.lightCoverImage ?? t.coverImage) : (t.darkCoverImage ?? t.coverImage))
      ?? c.coverImage ?? getPackCoverFallback(category);
    return [{
      id: `${category}:${size}`,
      category,
      size,
      label: cfg.label,
      description: cfg.description,
      icon: cfg.icon,
      accent: cfg.accent,
      gradient: cfg.gradient,
      cardCount: tier.cardCount,
      // Vault Pack cost is admin-configurable; the packs.json label is only the default.
      price: category === 'vault_token' ? `${getTokenPackCost()} V⚡` : tier.price,
      priceValue: tier.priceValue,
      currency: isSpark ? 'spark' : (tier.price === 'FREE' || tier.priceValue <= 0 ? 'free' : 'usd'),
      coverImage: cover,
    } satisfies PitPack];
  });
}

/** V⚡ cost of a spark pack, read from its price label ("275 V⚡"). */
export function sparkCost(pack: PitPack): number {
  return parseInt(pack.price.replace(/[^0-9]/g, ''), 10) || 0;
}

/**
 * Vending machine layout: five shelves of six coils (A1–E6).
 * Each entry is a [category, size]; null leaves a coil empty.
 */
export const VENDING_ROWS: Array<Array<[PackCategory, PackSize] | null>> = [
  [['bombshell', 'single'], ['bombshell', 'double'], ['bombshell', 'five' as PackSize], ['bombshell', 'ten'], ['bombshell', 'twentyfive'], ['bombshell', 'fifty']],
  [['taste', 'single'], ['taste', 'triple'], ['taste', 'bulk'], ['light', 'single'], ['light', 'triple'], ['light', 'bulk']],
  [['dark', 'single'], ['dark', 'triple'], ['dark', 'bulk'], ['miss_out', 'single'], ['miss_out', 'triple'], ['free', 'single']],
  [['month', 'single'], ['month', 'triple'], ['special_picks', 'single'], ['special_picks', 'triple'], ['prophecy', 'single'], ['alpha', 'single']],
  [['vault_token', 'single'], ['bombshell_token', 'single'], ['bombshell_token', 'double'], ['bombshell_token', 'five' as PackSize], ['bombshell_token', 'ten'], null],
];

export interface VendSlot { code: string; pack: PitPack | null }

export function vendingSlots(bombshellArt: 'dark' | 'light'): VendSlot[][] {
  const pit: ClawPit = { id: 'vending', name: 'Vending', icon: '', accent: '', blurb: '' };
  return VENDING_ROWS.map((row, r) => row.map((pick, c) => {
    const code = `${'ABCDE'[r]}${c + 1}`;
    if (!pick) return { code, pack: null };
    const [pack] = packsForPit({ ...pit, picks: [pick] }, bombshellArt);
    return { code, pack: pack ?? null };
  }));
}

/**
 * Every pack the bonus claw can award: the vending machine except the daily free pack.
 * The V⚡ bombshell coils are the same packs as the paid bombshell row, so they're left out
 * (vault-engine awards them as 'bombshell'). Must match CLAW_PRIZES in vault-engine.
 */
export function clawPrizePacks(bombshellArt: 'dark' | 'light'): PitPack[] {
  const all = vendingSlots(bombshellArt).flat()
    .map(s => s.pack)
    .filter((p): p is PitPack => !!p && p.category !== 'free' && p.category !== 'bombshell_token');
  // Deterministic interleave: alternate from the front and back of the machine.
  const out: PitPack[] = [];
  for (let i = 0, j = all.length - 1; i <= j; i++, j--) {
    out.push(all[i]);
    if (i !== j) out.push(all[j]);
  }
  return out;
}

/**
 * How likely the claw is to land each pack, by its card count: small packs are common and
 * the big bundles are rare. vault-engine rolls the real prize with the same table
 * (CLAW_PRIZE_WEIGHTS); this copy only matters against an older vault-engine that still
 * takes the client's pick.
 */
const CLAW_WEIGHT_BY_CARDS: Array<[number, number]> = [
  [1, 40], [2, 30], [3, 20], [5, 10], [10, 4], [15, 3], [25, 1], [50, 0.5],
];

export function clawPrizeWeight(cardCount: number): number {
  for (const [cards, w] of CLAW_WEIGHT_BY_CARDS) if (cardCount <= cards) return w;
  return 0.5;
}

/** Weighted random prize from the claw's packs. */
export function rollClawPrize(packs: PitPack[]): PitPack {
  const total = packs.reduce((sum, p) => sum + clawPrizeWeight(p.cardCount), 0);
  let r = Math.random() * total;
  for (const p of packs) {
    r -= clawPrizeWeight(p.cardCount);
    if (r <= 0) return p;
  }
  return packs[0];
}
