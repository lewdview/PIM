/**
 * Live activity — turns raw telemetry events (from get_recent_activity or the
 * local telemetry queue) into short, human sentences for the navbar feed.
 *
 * Pure helpers only; data fetching and UI live in components/LiveActivity.tsx.
 */

import { PACK_CONFIGS, RARITY_CONFIG, type Rarity } from '../utils/rarity';

export const ACTIVITY_EVENT_TYPES = [
  'game_end',
  'daily_claim',
  'pack_purchase',
  'card_burn',
  'targeted_pull',
  'rarity_upgrade',
  'duplicate_fusion',
  'nft_mint',
  'bonus_code_redeem',
  'invite_redeem',
] as const;

export type ActivityKind = (typeof ACTIVITY_EVENT_TYPES)[number];

export interface RawActivityEvent {
  id: string;
  event_type: string;
  payload?: Record<string, unknown> | null;
  created_at?: string | null;
  user_id?: string | null;
}

export interface ActivityActor {
  userId: string | null;
  label: string;
  isYou: boolean;
}

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  at: number; // ms epoch
  actors: ActivityActor[]; // >1 when grouped
  count: number; // events merged into this item
  verb: string; // "cleared"
  subject: string; // "My Sacrifices"
  meta?: string; // "98% accuracy"
  badge?: { text: string; color: string };
  day?: number; // song / card day, for cover art + links
  href?: string;
  accent: string;
  /** Items with the same groupKey close together in time are merged. */
  groupKey: string;
}

export interface ActivityContext {
  myUserId: string | null;
  displayNames: Record<string, string | null | undefined>;
  songTitle: (day: number) => string | undefined;
}

// ── Names ─────────────────────────────────────────────────────────────────

const HANDLE_ADJ = [
  'Neon', 'Velvet', 'Static', 'Lunar', 'Solar', 'Chrome', 'Midnight', 'Cobalt',
  'Crimson', 'Golden', 'Silent', 'Electric', 'Hollow', 'Faded', 'Wired', 'Analog',
  'Cosmic', 'Paper', 'Glass', 'Rust', 'Ivory', 'Violet', 'Amber', 'Velour',
];
const HANDLE_NOUN = [
  'Fox', 'Comet', 'Signal', 'Tape', 'Vinyl', 'Ghost', 'Moth', 'Raven',
  'Tiger', 'Lotus', 'Prism', 'Pulse', 'Wave', 'Orbit', 'Cipher', 'Koi',
  'Lynx', 'Heron', 'Nova', 'Rider', 'Saint', 'Poet', 'Dancer', 'Drifter',
];

/** Stable, friendly stand-in name for a player with no display name. */
export function friendlyHandle(userId: string): string {
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = h >>> 0;
  return `${HANDLE_ADJ[u % HANDLE_ADJ.length]} ${HANDLE_NOUN[Math.floor(u / HANDLE_ADJ.length) % HANDLE_NOUN.length]}`;
}

function actorFor(userId: string | null | undefined, ctx: ActivityContext): ActivityActor {
  if (!userId) return { userId: null, label: 'A guest', isYou: false };
  if (ctx.myUserId && userId === ctx.myUserId) return { userId, label: 'You', isYou: true };
  const name = ctx.displayNames[userId]?.trim();
  return { userId, label: name || friendlyHandle(userId), isYou: false };
}

// ── Formatting helpers ───────────────────────────────────────────────────

const ACCENT = {
  play: '#00e5ff',
  claim: '#39ff14',
  pack: '#ff1e8c',
  forge: '#ff3800',
  gold: '#ffb800',
  chain: '#7c9cff',
};

const MEDAL_COLORS: Record<string, string> = {
  BRONZE: '#cd7f32',
  SILVER: '#c0c0c0',
  GOLD: '#ffd700',
  PLATINUM: '#e0e0ff',
};

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s_-])([a-z])/g, (_, sep: string, c: string) => `${sep === '_' ? ' ' : sep}${c.toUpperCase()}`);
}

function rarityBadge(raw: unknown): ActivityItem['badge'] | undefined {
  const key = String(raw || '').toLowerCase() as Rarity;
  const cfg = RARITY_CONFIG[key];
  return cfg ? { text: cfg.label, color: cfg.color } : undefined;
}

function rarityWord(raw: unknown): string {
  const key = String(raw || '').toLowerCase() as Rarity;
  return RARITY_CONFIG[key] ? titleCase(RARITY_CONFIG[key].label) : 'rare';
}

function dayFrom(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    if (typeof v === 'number' && v > 0) return v;
    if (typeof v === 'string') {
      const m = v.match(/(\d{1,3})\s*$/);
      if (m) return parseInt(m[1], 10);
    }
  }
  return undefined;
}

function packLabel(raw: unknown): string {
  const key = String(raw || '').toLowerCase();
  const cfg = (PACK_CONFIGS as Record<string, { label?: string }>)[key];
  const label = cfg?.label ? titleCase(cfg.label) : key ? titleCase(key) : 'Vault';
  return /pack|pull|roll|upgrade/i.test(label) ? label : `${label} Pack`;
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

// ── Event → item ──────────────────────────────────────────────────────────

export function toActivityItem(e: RawActivityEvent, ctx: ActivityContext): ActivityItem | null {
  if (!(ACTIVITY_EVENT_TYPES as readonly string[]).includes(e.event_type)) return null;
  const kind = e.event_type as ActivityKind;
  const p = (e.payload || {}) as Record<string, unknown>;
  const at = e.created_at ? Date.parse(e.created_at) : Date.now();
  const base = { id: e.id, kind, at: Number.isFinite(at) ? at : Date.now(), actors: [actorFor(e.user_id, ctx)], count: 1 };
  const songName = (day?: number) => (day ? ctx.songTitle(day) ?? `Day ${day}` : 'a transmission');

  switch (kind) {
    case 'game_end': {
      const day = dayFrom(p.songId);
      const cleared = p.completed !== false;
      const acc = typeof p.accuracy === 'number' ? `${Math.round(p.accuracy)}% accuracy` : undefined;
      const medal = typeof p.medal === 'string' ? p.medal.toUpperCase() : '';
      return {
        ...base,
        verb: cleared ? 'cleared' : 'took on',
        subject: songName(day),
        meta: cleared ? acc : 'not cleared yet',
        badge: cleared && MEDAL_COLORS[medal] ? { text: medal, color: MEDAL_COLORS[medal] } : undefined,
        day,
        href: day ? `/play/card-${day}` : '/campaign',
        accent: ACCENT.play,
        // Repeat plays of one song by one player collapse into "2 plays"
        groupKey: `game_end:${day}:${cleared}:${e.user_id ?? e.id}`,
      };
    }
    case 'daily_claim': {
      const day = dayFrom(p.day);
      return {
        ...base,
        verb: 'claimed',
        subject: day ? `Day ${day}` : "today's drop",
        meta: day ? ctx.songTitle(day) : undefined,
        badge: rarityBadge(p.rarity),
        day,
        href: '/vault',
        accent: ACCENT.claim,
        groupKey: `daily_claim:${day}`,
      };
    }
    case 'pack_purchase': {
      const label = packLabel(p.packType);
      const count = Number(p.count) || 0;
      return {
        ...base,
        verb: 'ripped',
        subject: `${article(label)} ${label}`,
        meta: count ? `${count} card${count === 1 ? '' : 's'}` : undefined,
        href: '/vault',
        accent: ACCENT.pack,
        groupKey: `pack_purchase:${label}`,
      };
    }
    case 'card_burn': {
      const tokens = Number(p.tokensEarned) || 0;
      const word = rarityWord(p.rarity);
      return {
        ...base,
        verb: 'burned',
        subject: `${article(word)} ${word} card`,
        meta: tokens ? `+${tokens} V⚡` : undefined,
        href: '/vault/forge',
        accent: ACCENT.forge,
        groupKey: `card_burn:${e.id}`,
      };
    }
    case 'targeted_pull': {
      const day = dayFrom(p.day, p.cardId);
      return {
        ...base,
        verb: 'pulled',
        subject: day ? songName(day) : 'a targeted card',
        badge: rarityBadge(p.rarity),
        day,
        href: '/vault',
        accent: ACCENT.gold,
        groupKey: `targeted_pull:${e.id}`,
      };
    }
    case 'rarity_upgrade': {
      const word = rarityWord(p.to);
      return {
        ...base,
        verb: 'upgraded a card to',
        subject: word,
        badge: rarityBadge(p.to),
        href: '/vault/forge',
        accent: ACCENT.gold,
        groupKey: `rarity_upgrade:${e.id}`,
      };
    }
    case 'duplicate_fusion': {
      const word = rarityWord(p.to);
      return {
        ...base,
        verb: 'fused duplicates into',
        subject: `${article(word)} ${word} card`,
        badge: rarityBadge(p.to),
        href: '/vault/forge',
        accent: ACCENT.forge,
        groupKey: `duplicate_fusion:${e.id}`,
      };
    }
    case 'nft_mint': {
      const day = dayFrom(p.cardId, p.day);
      return {
        ...base,
        verb: 'minted',
        subject: songName(day),
        meta: 'on Base',
        day,
        href: day ? `/play/card-${day}` : '/vault',
        accent: ACCENT.chain,
        groupKey: `nft_mint:${e.id}`,
      };
    }
    case 'bonus_code_redeem':
      return { ...base, verb: 'redeemed', subject: 'a promo code', href: '/vault/earn', accent: ACCENT.gold, groupKey: 'bonus_code_redeem' };
    case 'invite_redeem':
      return { ...base, verb: 'joined', subject: 'through an invite', href: '/vault', accent: ACCENT.claim, groupKey: 'invite_redeem' };
  }
}

// ── Grouping ─────────────────────────────────────────────────────────────

/**
 * Merge neighbouring items (newest first) that share a groupKey within
 * `windowMs` — "Neon Fox and 2 others claimed Day 289". The newest item's
 * fields win; actors are collected (you first, then by recency, deduped).
 */
export function groupActivity(items: ActivityItem[], windowMs = 10 * 60 * 1000): ActivityItem[] {
  const out: ActivityItem[] = [];
  for (const item of items) {
    const prev = out[out.length - 1];
    if (prev && prev.groupKey === item.groupKey && prev.at - item.at <= windowMs) {
      prev.count += item.count;
      for (const a of item.actors) {
        const dup = prev.actors.some((x) => (a.userId ? x.userId === a.userId : x.label === a.label && !x.userId));
        if (!dup) prev.actors.push(a);
      }
      prev.actors.sort((x, y) => Number(y.isYou) - Number(x.isYou));
      continue;
    }
    out.push({ ...item, actors: [...item.actors] });
  }
  return out;
}

/** "Neon Fox", "You and Neon Fox", "Neon Fox and 4 others" */
export function actorsLabel(actors: ActivityActor[]): string {
  if (actors.length === 0) return 'Someone';
  if (actors.length === 1) return actors[0].label;
  if (actors.length === 2) return `${actors[0].label} and ${actors[1].isYou ? 'you' : actors[1].label}`;
  return `${actors[0].label} and ${actors.length - 1} others`;
}

export function timeAgo(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
