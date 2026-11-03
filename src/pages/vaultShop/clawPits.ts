import { PACK_CONFIGS, type PackCategory, type PackSize } from '../../utils/rarity';
import { getTokenPackCost } from '../../services/vaultService';

/** One pack sitting in the claw pit. Grabbing it opens checkout for that exact tier. */
export interface PitPack {
  id: string;
  category: PackCategory;
  size: PackSize;
  label: string;
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

export const CLAW_PITS: ClawPit[] = [
  { id: 'free', name: 'Free', icon: '🎁', accent: '#ffffff', blurb: 'A free 1-card pack, once a day.', category: 'free' },
  { id: 'bombshell', name: 'Bombshells', icon: '💖', accent: '#FF1493', blurb: 'The 365 Days of Light & Dark artwork series.', category: 'bombshell' },
  { id: 'taste', name: 'Taste', icon: '🎧', accent: '#4ade80', blurb: 'Any card up to today.', category: 'taste' },
  { id: 'light', name: 'Light', icon: '☀️', accent: '#fbbf24', blurb: 'Only light mood tracks.', category: 'light' },
  { id: 'dark', name: 'Dark', icon: '🌙', accent: '#8b5cf6', blurb: 'Only dark mood tracks.', category: 'dark' },
  { id: 'miss_out', name: 'Missed', icon: '⏳', accent: '#f97316', blurb: 'Past daily cards you didn’t claim.', category: 'miss_out' },
  { id: 'month', name: 'Monthly', icon: '📅', accent: '#06b6d4', blurb: 'Cards from a completed month.', category: 'month' },
  { id: 'special_picks', name: 'Specials', icon: '⭐', accent: '#ec4899', blurb: 'Curated weekly set, every card Rare or higher.', category: 'special_picks' },
  { id: 'prophecy', name: 'Prophecy', icon: '🔮', accent: '#a78bfa', blurb: 'One unreleased future track.', category: 'prophecy' },
  { id: 'alpha', name: 'Alpha', icon: '🎲', accent: '#ef4444', blurb: 'One archival past track.', category: 'alpha' },
  {
    id: 'sparks', name: 'Spark pit', icon: '⚡', accent: '#ff9900', blurb: 'Packs you pay for with V⚡.',
    picks: [['vault_token', 'single'], ['bombshell_token', 'single'], ['bombshell_token', 'double'], ['bombshell_token', 'five' as PackSize], ['bombshell_token', 'ten']],
  },
];

export function packsForPit(pit: ClawPit, bombshellArt: 'dark' | 'light'): PitPack[] {
  const pairs: Array<[PackCategory, PackSize]> = pit.picks
    ?? (PACK_CONFIGS[pit.category!]?.tiers ?? []).map(t => [pit.category!, t.size as PackSize]);

  return pairs.flatMap(([category, size]) => {
    const cfg = PACK_CONFIGS[category];
    const tier = cfg?.tiers.find(t => t.size === size);
    if (!cfg || !tier) return [];
    const isSpark = category === 'vault_token' || category === 'bombshell_token';
    const t = tier as typeof tier & { coverImage?: string; darkCoverImage?: string; lightCoverImage?: string };
    const cover = bombshellArt === 'light' ? (t.lightCoverImage ?? t.coverImage) : (t.darkCoverImage ?? t.coverImage);
    return [{
      id: `${category}:${size}`,
      category,
      size,
      label: cfg.label,
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
